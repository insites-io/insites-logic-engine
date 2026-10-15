# WebSockets (Channels)

An instance can push messages to a browser over a WebSocket channel. The browser subscribes
to a channel and a room. Liquid then sends a JSON payload to everyone in that room with the
`channel_send_message` mutation, from a page or from a background job.

The main use is delivering a result that cannot be produced inside a page request: a slow
outbound API call, such as a language model reply, made from a background job and pushed to
the browser when it finishes. The full recipe is in [patterns](patterns.md).

Everything on this page was measured on 14 October 2026 on a v6 production instance and a
v6 staging instance, with the same result on both (TW#26888003).

## Files

| File | What it does |
|---|---|
| `app/views/partials/channels/<channel>/subscribed.liquid` | Runs on every subscription to `<channel>`. Output `true` to admit the subscriber. Any other output, or no partial at all, refuses it |

With `websockets_require_subscribed_partial` on (the default, see
[configuration](../configuration/README.md)), a channel with no `subscribed` partial refuses
everyone. A partial that outputs `false` refuses too. Both answer the same way:

```json
{"identifier":"{\"channel\":\"replies\",\"room_id\":\"r1\"}","message":{"type":"subscription_error","code":"unauthorized","message":"You are not authorized to subscribe to this room.","retryable":false}}
{"identifier":"{\"channel\":\"replies\",\"room_id\":\"r1\"}","type":"reject_subscription"}
```

## What the subscribed partial can read

| Object | In `subscribed` |
|---|---|
| `context.params.channel`, `context.params.room_id` | The channel and room the client asked for |
| `context.constants` | Available. An HMAC check against a constant admitted a correctly signed room and refused a forged one |
| `context.session` | **`null`**, even when the same browser session set a value on a page a moment earlier |
| `context.current_user` | `null` for an anonymous visitor. Not measured for a signed-in user |

So a `subscribed` partial cannot ask "is this the visitor who owns the room". **The room id
has to carry the authority itself.** Issue it on a page, sign it with a secret constant, and
have `subscribed` check the signature ([patterns](patterns.md#3-admit-only-signed-rooms)).
Anyone holding a signed room id can subscribe to it, from any session, so treat it like a
password: never put it in a URL or a log.

## Connecting from the browser

| | |
|---|---|
| URL | `wss://<instance host>/websocket?authenticity_token=<context.authenticity_token>` |
| Subprotocol | `actioncable-v1-json` |
| Cookie | The browser sends the session cookie itself |

**The token has to be in the URL.** A connection opened without it receives one message and is
closed:

```json
{"type":"disconnect","reason":"Can't verify CSRF token authenticity.","reconnect":true}
```

The conversation, in order:

| Direction | Message |
|---|---|
| server | `{"type":"welcome"}` |
| client | `{"command":"subscribe","identifier":"{\"channel\":\"replies\",\"room_id\":\"...\"}"}`. `identifier` is a **string** holding JSON, not an object |
| server | `{"identifier":"...","type":"confirm_subscription"}`, or the refusal above |
| server | `{"type":"ping","message":...}` every few seconds. Ignore it |
| server | `{"identifier":"...","message":{...}}` for each `channel_send_message` to that room. `message` is the payload as sent |

A connection with no traffic stayed open for 130 seconds. One connection, during a run that
held several open at once, closed with code 1006 after 51 seconds, so reconnect and resubscribe
when the socket closes.

## Sending a message

```graphql
mutation send_reply($room: String!, $reply: JSONPayload!) {
  channel_send_message(channel_name: "replies", room_id: $room, payload: $reply)
}
```

```liquid
{% liquid
  assign reply = {}
  assign reply['text'] = 'Done'
  graphql sent = 'ask/send_reply', room: room, reply: reply
%}
```

The mutation answers `{"channel_send_message": "dispatched"}`. A hash passed as `payload`
arrives in the browser as a JSON object. It worked from a background job, which is the case
that matters: the job has no browser of its own and the room is how it finds one.

## Server-Sent Events

A page that only listens can subscribe with `EventSource` at `/anycable-events` instead of a
WebSocket. The channels, the `subscribed` partial, the config flags and `channel_send_message`
are the same, and a broadcast reaches SSE and WebSocket subscribers alike.

```js
const identifier = JSON.stringify({ channel: 'replies', room_id: room });
const source = new EventSource('/anycable-events?identifier=' + encodeURIComponent(identifier)
  + '&authenticity_token=' + encodeURIComponent(token));
source.onmessage = function (event) { show(JSON.parse(event.data)); };
```

Measured on a v6 production and a v6 staging instance at 18:45 (UTC+7) on 15 October 2026
(TW#26892599), with a session cookie and the page's CSRF token:

| Case | Result on both instances |
|---|---|
| Subscribe | `200 text/event-stream`, then `welcome` and `confirm_subscription` events |
| A background job calls a 3-second API and sends the result to the room | One `message` event 4.6 s after subscribing, whose `data` is the payload itself, with no `identifier`/`message` envelope |
| A room the `subscribed` partial refuses | 400, no `confirm_subscription`, stream closed |
| A channel with no `subscribed` partial | 400, as above |
| No session cookie and no token | 401 |

How it differs from the WebSocket:

- **The identifier goes in the URL** as URL-encoded JSON, and the CSRF token goes in the same
  URL as `authenticity_token`. Render it with `{{ context.authenticity_token }}`.
- **Read-only.** There is no `send`, and `receive.liquid` is never called over SSE.
- **The payload arrives bare.** `event.data` is exactly what `channel_send_message` sent.
- **A refusal is an error status, not a message.** `EventSource` reports it as `onerror`, with
  no reason. The reason is in the instance log as before.
- **Reconnect yourself.** The browser's own retry reuses the same URL and token, which fails
  once the session changes. Close the source and open a new one with a fresh token.

Availability: SSE arrived with the 6 October 2026 platform release, but it also needs the
stack's real-time server, which serves both `/websocket` and `/anycable-events`, to support
and route it. On the Insites stacks that happened on 15 October 2026: the server moved from
version 1.2.3, which predates SSE, to 1.6.16 at about 18:25, and SSE was switched on and
routed by 18:41. Before that, `/anycable-events` answered with the instance's own 404 page.
To check any instance:

```bash
curl -s -m 5 -o /dev/null -D - "https://<host>/anycable-events?identifier=x"
```

`text/event-stream` (a 401 here is expected, as the request has no session) means it is
served; a `text/html` 404 means it is not. Use a GET: a HEAD request gets 405.

## See also

- [Patterns](patterns.md): a slow API call in a background job, pushed to the browser
- [API calls](../api-calls/README.md): the measured timeout behaviour that makes this necessary
- [Background jobs](../background-jobs/README.md)
