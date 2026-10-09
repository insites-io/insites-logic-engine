# API Endpoints (inbound)

API endpoints expose JSON over HTTP from a module. They are pages that read `context.params`, run GraphQL or call other partials, and emit a JSON response. Mark the page as JSON with `format: json` in its front matter (a `.json.liquid` filename also works). The IIA modules use `format: json` or a JSON layout; none of their API page files uses the `.json.liquid` name. Never put `.json` in the `slug`.

> **Distinction:** this directory covers **endpoints you build** (inbound HTTP into your project). For **outbound calls** to third-party services (Stripe, Twilio, etc.), see [`api-calls/`](../api-calls/README.md).

## Where they live

API endpoints follow the canonical V2 API surface: `modules/<module>/public/views/pages/api/_external/v2/<resource>/<action>.json.liquid`. The `_external/v2/` segment is the public V2 surface — sibling folders under `api/` are internal IIA-only and should not be exposed to API consumers.

## Minimal endpoint

```liquid
{% comment %} modules/dashboard/public/views/pages/api/_external/v2/products/index.json.liquid {% endcomment %}
---
slug: api/_external/v2/products
method: get
format: json
authorization_policies:
  - modules/insites_crm/has_valid_instance_api_authorization
---
{% liquid
  graphql res = 'modules/dashboard/products/list',
    page: context.params.page | default: 1,
    per_page: context.params.per_page | default: 25
  assign body = res.records | json
  print body
%}
```

## Conventions

- **Authentication.** V2 endpoints expect a raw `instance_<50-char-alphanumeric>` token in the `Authorization` header (no `Bearer` prefix). See [`api/authentication.md`](../api/authentication.md) for the exact contract. Every API page needs a guard; a page with no guard is public. There are two guard shapes, and they fail differently:
  - **Front-matter policy.** `modules/insites_crm/has_valid_instance_api_authorization` compares `Authorization` with the key managed in IIA (Integrations → Instance API Key), so it follows a key rotation. A caller that fails it gets a **302 redirect to `api/401`**, not a 401 on the URL it called. Browsers cope; API clients often do not, and a redirected POST becomes a GET.
  - **Inline guard function.** The CRM V2 endpoints switched to this in May 2026 so that a failed call answers 401 JSON on the original URL for every method: `{%- function api_auth_passed = 'modules/insites_crm/functions/auth/api_key_guard' -%}`, then `respond_401` on the false branch. The function is private to `insites_core`; whether app code may call it is not yet documented.
  - **Never copy the instance key into a constant** to compare against. The copy does not change when an administrator replaces the key, so the old key keeps working on your endpoint.
- **Method handling.** One file per HTTP verb. PUT/DELETE need `_method` only when called via HTML forms; native API clients send the verb directly.
- **Status codes.** Set explicit response codes via `{% response_status N %}` for non-200 outcomes (validation 422, not found 404, unauthenticated 401, forbidden 403).
- **Errors.** Emit `{ "errors": [{ "message": "...", "field": "..." }] }` shaped responses for validation failures so consumers can pattern-match. Note that the IIA module V2 endpoints do not use this shape today: a 400 returns `{ "error": "<message>" }` and a 401 returns `{ "error": "unauthorized", "message": "Invalid or revoked API key", "type": "authentication_error" }`.
- **Pagination.** Mirror what GraphQL returns: `{ "results": [...], "total_entries": N, "current_page": N, "total_pages": N }`.

## See Also

- [`api/authentication.md`](../api/authentication.md) — V2 auth (instance token, no Bearer prefix)
- [`api/calling-from-liquid.md`](../api/calling-from-liquid.md) — how controllers/pages alias paths via `path:` front-matter
- [`api-calls/`](../api-calls/README.md) — outbound HTTP from Liquid
- [`pages/`](../pages/README.md) — pages as controllers
- [`graphql/`](../graphql/README.md) — data layer behind endpoints
