# WebSockets - Patterns

## A slow API call, pushed to the browser when it finishes

The case this exists for: a page needs an answer from a service that takes longer than a page
request should wait, a language model being the common one. The page queues a background job
and returns at once. The job makes the call, which may take up to 180 seconds, and sends the
result to the visitor's room on a channel. The browser, already subscribed, shows it.

Run as written on a v6 production instance on 14 October 2026 (TW#26888003), with the service
URL pointed at a test endpoint that answers after 8 seconds. In a headless browser the reply
arrived 9.6 seconds after the form was submitted, with the question text intact, and no console
errors. A forged room id and an unsigned room id were both refused.

Six files:

| File | Role |
|---|---|
| `app/views/pages/ask.liquid` | Issues a signed room, renders the form, opens the socket |
| `app/views/pages/ask-start.liquid` | Receives the question and queues the job |
| `app/views/partials/ask/answer.liquid` | The background job: calls the service, sends the reply |
| `app/graphql/ask/call_service.graphql` | The outbound call |
| `app/graphql/ask/send_reply.graphql` | The push to the room |
| `app/views/partials/channels/replies/subscribed.liquid` | Admits only rooms this instance signed |

It needs two constants: `REPLY_ROOM_SECRET`, any long random string, and
`ANSWER_SERVICE_KEY`, the service's API key. See [constants](../constants/README.md).

### 1. The page: issue a signed room and subscribe

The room id is a fresh UUID plus its HMAC, kept in the visitor's session so a reload reuses it.
The script subscribes, enables the button only once the subscription is confirmed, and writes
whatever arrives for this room into a live region.

```liquid
---
slug: ask
---
{% liquid
  assign room = context.session.reply_room
  if room == blank
    assign id = '' | uuid
    assign signature = id | compute_hmac: context.constants.REPLY_ROOM_SECRET
    assign room = id | append: '.' | append: signature
    session reply_room = room
  endif
%}
<form id="ask-form">
  <label for="question">Your question</label>
  <input id="question" name="question" required>
  <button type="submit" disabled>Ask</button>
</form>
<p id="reply" aria-live="polite"></p>

<script>
  const token = {{ context.authenticity_token | json }};
  const identifier = JSON.stringify({ channel: 'replies', room_id: {{ room | json }} });
  const form = document.getElementById('ask-form');
  const reply = document.getElementById('reply');

  const socket = new WebSocket(
    'wss://' + location.host + '/websocket?authenticity_token=' + encodeURIComponent(token),
    ['actioncable-v1-json']
  );
  socket.onmessage = function (event) {
    const msg = JSON.parse(event.data);
    if (msg.type === 'welcome') {
      socket.send(JSON.stringify({ command: 'subscribe', identifier: identifier }));
    } else if (msg.type === 'confirm_subscription') {
      form.querySelector('button').disabled = false;
    } else if (msg.identifier === identifier && msg.message) {
      reply.textContent = msg.message.text || msg.message.error;
    }
  };

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    reply.textContent = 'Working on it...';
    fetch('/ask-start', {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
      body: new URLSearchParams({ question: form.question.value, authenticity_token: token })
    });
  });
</script>
```

### 2. The endpoint: queue the job and return

The question goes to the job as an argument, and the room comes from the session rather than
from the request, so a visitor can only queue work for their own room.

```liquid
---
slug: ask-start
method: post
format: json
layout: ''
---
{% liquid
  assign room = context.session.reply_room
  if room == blank or context.params.question == blank
    response_status 422
    echo '{"queued": false}'
  else
    background job_id = 'ask/answer', room: room, question: context.params.question
    echo '{"queued": true}'
  endif
%}
```

### 3. Admit only signed rooms

`subscribed` cannot read the session ([README](README.md#what-the-subscribed-partial-can-read)),
so it checks the signature instead. A room this instance did not issue is refused.

```liquid
{% liquid
  assign parts = context.params.room_id | split: '.'
  assign expected = parts[0] | compute_hmac: context.constants.REPLY_ROOM_SECRET
  if parts.size == 2 and parts[1] == expected
    echo 'true'
  else
    echo 'false'
  endif
%}
```

### 4. The job: make the call, send the reply

```liquid
{% liquid
  assign payload = { "question": question }
  assign body = payload | json
  assign headers = { "Content-Type": "application/json" }
  assign headers['Authorization'] = 'Bearer ' | append: context.constants.ANSWER_SERVICE_KEY

  graphql r = 'ask/call_service', body: body, headers: headers

  assign reply = {}
  if r.api_call_send.response.status == 200
    assign reply['text'] = r.api_call_send.response.body
  else
    assign reply['error'] = 'No answer this time. Please try again.'
  endif
  graphql sent = 'ask/send_reply', room: room, reply: reply
%}
```

```graphql
mutation call_service($body: String!, $headers: HashObject) {
  api_call_send(
    api_call: { url: "https://api.example.com/answer", method: "POST", headers: $headers, body: $body }
    options: { timeout: 120 }
  ) {
    response { status body }
  }
}
```

```graphql
mutation send_reply($room: String!, $reply: JSONPayload!) {
  channel_send_message(channel_name: "replies", room_id: $room, payload: $reply)
}
```

`timeout: 120` is the longest the call may wait **between** bytes, not for the whole answer
([API calls](../api-calls/README.md#how-long-a-call-may-take)). A service that streams its answer
keeps the call alive for as long as bytes keep arriving: a 60-second response sent one byte a
second completed in a job with `timeout: 5`.

### What to expect

| Measured | Result |
|---|---|
| Job start | 4 of 6 jobs started within a second of being queued. Two, queued together with a third on the production instance, waited 20.5 and 22.2 seconds |
| A 10-second call, `timeout: 30` | Pushed with status 200 on both instances |
| A 10-second call, `timeout: 5` | Pushed with `status` null and the error `ApiCallFailed: "Timeout - <url> did not respond within expected time"` after about 12 seconds, so the browser hears about the failure too |

Always send something when the call fails, as `answer.liquid` does, or the visitor waits for a
message that never comes.

### Variations, not measured

- **A signed-in user's room.** Sign the user's id instead of a UUID, so every tab the user has
  open shares one room.
- **Progress.** Call `channel_send_message` more than once from the job, for example "searching"
  then the answer. Each send is a separate message to the room.
- **Not token by token.** `api_call_send` returns the whole body once the call ends, so the job
  cannot forward a streamed answer word by word. To show text as it is generated, the browser has
  to read the stream from the service directly.
