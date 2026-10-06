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
  "text": "{{ data.message }}"
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

`api_call` is `{ url: String!, method: String!, headers: HashObject, body: String }`. `options.timeout` is in seconds: for a call made from a web request the default and the maximum are both 5, for one made from a background job the default is 8 and the maximum 180. The answer is `response { status body }`. Measured creating and reading Stripe Checkout Sessions from a page on a v6 instance, 5 and 6 October 2026 (TW#26855354).

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
