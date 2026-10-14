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

## Server-Sent Events are not served yet

The 6 October 2026 platform release adds subscribing over Server-Sent Events at
`/anycable-events` ([platform changes](../platform-changes-2026.md)). On 14 October 2026 both
instances answered `/anycable-events?identifier=...` with the instance's own 404 page, byte for
byte the body served for a made-up path apart from its CSRF token. Use the WebSocket until an
instance answers that path with an event stream.

## See also

- [Patterns](patterns.md): a slow API call in a background job, pushed to the browser
- [API calls](../api-calls/README.md): the measured timeout behaviour that makes this necessary
- [Background jobs](../background-jobs/README.md)
