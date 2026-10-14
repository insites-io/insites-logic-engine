# API Calls (External API Integration)

Insites can call external REST APIs via the `api_calls` directory or using `download_file` filter.

## Location

`app/api_calls/`

> **Module path:** When building a module, use `modules/<module_name>/public/api_calls/` for API call definitions accessible to the app and other modules, or `modules/<module_name>/private/api_calls/` for API calls only used within the module.

## API Call Definition

```liquid
{% comment %} app/api_calls/slack_notification.liquid {% endcomment %}
---
to: https://hooks.slack.com/services/{{ context.constants.SLACK_WEBHOOK }}
format: http
request_type: POST
request_headers: >
  {
    "Content-Type": "application/json"
  }
---
{
  "text": {{ data.message | json }}
}
```

## Inline API Call From a Page: `api_call_send`

An API call does not need a file. The `api_call_send` mutation takes the request inline, and this is the form to reach for from a page or a job when the request is built at run time:

```liquid
{%- parse_json headers -%}
{ "Authorization": "Bearer {{ context.constants.stripe_sk_live }}", "Content-Type": "application/x-www-form-urlencoded" }
{%- endparse_json -%}
{%- graphql r, h: headers, b: body -%}
mutation ($h: HashObject, $b: String) {
  api_call_send(
    api_call: { url: "https://api.stripe.com/v1/checkout/sessions", method: "POST", headers: $h, body: $b }
    options: { timeout: 10 }
  ) { response { status body } }
}
{%- endgraphql -%}
```

`api_call` is `{ url: String!, method: String!, headers: HashObject, body: String }`. `options.timeout` is in seconds, from 1 to 180; see [How Long a Call May Take](#how-long-a-call-may-take). The answer is `response { status body }`. Measured creating and reading Stripe Checkout Sessions from a page on a v6 instance, 5 and 6 October 2026 (TW#26855354).

## How Long a Call May Take

The schema describes `options.timeout` as a read timeout: "For calls triggered from background jobs default is 8s and max 180s. For calls triggered from web request default is 5s and max 5s." Measured on 14 October 2026 on a v6 production instance and a v6 staging instance (TW#26888003), a page is **not** held to 5 seconds, and the timeout is not a limit on the whole call. Every row ran on both instances; times are the range across the two.

| Call made from a page | Result |
|---|---|
| `timeout: 30`, the server answers after 7 s | 200, after 7.9 to 8.7 s |
| No `timeout`, the server answers after 10 s | 200, after 11.5 to 11.7 s |
| `timeout: 5`, the server answers after 7 s | Error, after 12.1 to 12.8 s |
| `timeout: 8`, the server answers after 10 s | Error, after 17.3 to 18.7 s |
| `timeout: 5`, the server sends 8 bytes one a second | 200, after 8.6 to 8.9 s |
| `timeout: 5`, the server sends 2 bytes 10 s apart | Error, after 12.3 to 12.6 s |
| `timeout: 0` or `timeout: 181` | Refused at once: `timeout must be greater than or equal to 1`, `timeout must be less than or equal to 180` |
| A page waiting on a 15 s response | 200, after 16.1 to 18.0 s |
| A page waiting on a 25 s response | 504 from the edge after about 21 s, whatever the timeout |

What follows from it:

- **The timeout is the longest wait for the next bytes**, not for the whole response. A service that streams its answer keeps the call alive past the timeout.
- **A call that times out fails after about twice its timeout**, with `response` null and `ApiCallFailed: "Timeout - <url> did not respond within expected time"` in `errors`.
- **The page request is cut off at about 20 seconds**, whatever the call's timeout says.
- **Do not build on a page waiting longer than 5 seconds.** That is what the schema promises, and an instance may start enforcing it. Make slow calls from a background job, where 180 seconds is documented, and push the result to the browser over a channel: [WebSockets patterns](../websockets/patterns.md).

A job got the same timeout behaviour: a 10 s call with `timeout: 5` failed after about 12 s, and a 60 s response sent one byte a second completed with `timeout: 5`.

The file form above uses `to`, `request_type` and `request_headers` in its front matter. Those are the keys; `method:` and `headers:` are the inline mutation's names, not front-matter keys.

## Using download_file Filter

For simpler API calls, use the `download_file` filter:

```liquid
{% assign response = 'https://api.example.com/data' | download_file %}
{% assign data = response | parse_json %}
```

With max size:
```liquid
{% assign response = url | download_file: 5242880 %}
```

## Storing API Credentials

Always use constants:

```bash
insites-cli constants set --name SLACK_WEBHOOK --value "T00000000/B00000000/XXXXXXX" dev
insites-cli constants set --name API_BASE_URL --value "https://api.example.com" dev
```

Access in templates:
```liquid
{{ context.constants.API_BASE_URL }}
{{ context.constants.SLACK_WEBHOOK }}
```

## Rules

- NEVER hardcode API keys or URLs
- Store all credentials in constants
- Use `api_calls/` for structured API integrations
- Use `download_file` for simple GET requests
- Handle API calls in background jobs when possible
- Use `try/catch` for error handling on external calls
