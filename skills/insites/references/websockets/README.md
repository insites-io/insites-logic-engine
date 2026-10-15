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

## Server-Sent Events are not available yet

The 6 October 2026 platform release lets a page subscribe to a channel with `EventSource` at
`/anycable-events` instead of a WebSocket ([platform changes](../platform-changes-2026.md)).
The release reached Insites v6 production and staging instances on 15 October 2026, and
`/anycable-events` still answers with the instance's own 404 page on both.

The cause is the stack, not the instance. That address is served by the stack's real-time
server (AnyCable), which also serves `/websocket`; the instance never sees it. Measured on
15 October 2026 from the response headers:

| | Insites production and staging, until about 18:25 (UTC+7) | Insites production and staging, from then | A stack that serves SSE |
|---|---|---|---|
| `X-Anycable-Version` on a `/websocket` upgrade | `1.2.3` | `1.6.16` | `1.6.15` or `1.6.16` |
| `/anycable-events` answered by | the instance (its 404 page) | the instance (its 404 page) | the real-time server, as `text/event-stream` |

Both Insites stacks were upgraded to 1.6.16 that evening, and the WebSocket kept working. SSE
still has to be switched on in the real-time server and its address routed to it, which is
the remaining step. AnyCable added Server-Sent Events in 1.4.4 (September 2023), so 1.2.3 could not serve them:
run locally, it refuses the `--sse` option, while 1.6.16 with `--sse --sse_path=/anycable-events`
delivered a broadcast to the release note's `EventSource` code unchanged. On a staging stack
that serves SSE, the documented request with a session cookie and the page's CSRF token
answered `200 text/event-stream` with `welcome` then `confirm_subscription`, and 401 without
them, so the feature works as documented where the stack has it. Three other v6
instances on the same two stacks gave the same answers. Instances still hosted on the older
shared production stack run 1.6.15, which could serve SSE, but there `/anycable-events`
reaches the instance and answers 404, so it is not switched on or not routed (TW#26892599).

Until the stacks are upgraded:

- **Use the WebSocket.** Everything above works today.
- **Or try SSE first and fall back.** A read-only page can open an `EventSource`, and if it
  errors before `confirm_subscription`, open the WebSocket instead. It then switches to SSE
  by itself once the stack serves it. See [patterns](patterns.md#server-sent-events-first-websocket-fallback).
- **Check an instance yourself.** `curl -s -m 5 -o /dev/null -D - "https://<host>/anycable-events?identifier=x"`
  (a GET; a HEAD request gets 405 from a server that does serve SSE):
  a `text/html` 404 means not available; `text/event-stream` (even with a 401, which is a
  refused subscription) means it is.

What SSE will change, from the release note and the local run: the identifier goes in the
URL as URL-encoded JSON, the CSRF token as `authenticity_token` in the same URL, the
connection is read-only (`receive.liquid` is never called), each broadcast arrives as a
`message` event whose `data` is the payload itself (no `identifier`/`message` envelope), and
a refused room ends the stream with an error status (400 in the local run, 401 for a
connection refused outright), which `EventSource` reports as `onerror`. The browser's own
reconnect retries the same URL and token, so reconnect with a new `EventSource` and a fresh
token.

## See also

- [Patterns](patterns.md): a slow API call in a background job, pushed to the browser
- [API calls](../api-calls/README.md): the measured timeout behaviour that makes this necessary
- [Background jobs](../background-jobs/README.md)
