# Calling V2 API controllers from Liquid

Inside Insites Liquid (in a page or partial of your own app), you can invoke the same controllers that back the V2 HTTP API directly — in-process — without making an HTTP round trip. This is faster than calling the API over HTTP from your own server and lets you compose multiple operations in one request lifecycle.

It also bypasses the V2 API's authentication policy. **That's a feature, not a bug** — the calling page is expected to gate access via its own `authorization_policies:` front matter — but it requires care. See *Auth context* below.

This doc is the canonical reference for the in-Liquid pattern. For the guided external-builder track (credentials, pages, authorization, silent failures), see [building-on-insites](../building-on-insites/README.md). Module-specific docs (e.g. [`../modules/crm/patterns.md`](../modules/crm/patterns.md)) link here rather than re-explaining it.

---

## How it works

Every V2 endpoint is a tiny page file that includes a controller partial:

```liquid
{# page file at private/views/pages/api/_external/v2/contacts/get_contact.liquid #}
---
slug: crm/api/v2/contacts/:uuid
method: get
format: json
---

{%- function api_auth_passed = 'modules/insites_core/functions/auth/api_key_guard' -%}
{%- if api_auth_passed -%}
  {%- include "crm/controller/contacts/get", uuid: context.params.uuid -%}
{%- else -%}
  {%- include 'modules/insites_core/functions/auth/respond_401' -%}
{%- endif -%}
```

The controller partial has a `path:` front-matter alias that decouples its include path from its file location:

```liquid
{# partial at private/views/partials/controllers/_external/v2/contacts/get_contact.liquid #}
---
path: crm/controller/contacts/get
---

{%- graphql results = 'modules/insites_core/_external/v2/contacts/get_contact', uuid: uuid -%}
{# ... build a `data` variable from results, set status, etc. ... #}

{%- if context.params.format == 'json' -%}
  {%- include "modules/insites_core/functions/response_handler", data: data, status: status -%}
{%- endif -%}

{% return data %}
```

Two important properties of every V2 controller:

1. It runs `{% return data %}` at the end. The controller's logic is reusable as a function.
2. The HTTP response handling is gated on `params.format == 'json'`. When you call the controller from your own page (not via the V2 URL), `format` won't be `json`, so the `response_handler` is skipped — you just get the data back via `{% return %}`.

That's the whole pattern: **call the controller partial as a function and capture its return value.**

---

## Calling syntax

Use `{% function %}` to capture the controller's return value:

```liquid
{%- function contact = "crm/controller/contacts/get", uuid: "01HF..." -%}

{# `contact` is now the contact data hash, same shape as the HTTP API response #}
<h1>{{ contact.name }}</h1>
<p>{{ contact.email }}</p>
```

The first arg is the controller's path alias (matches its `path:` front-matter). Remaining args are passed as Liquid variables into the partial.

**Don't use `{% include %}`.** `include` discards the return value and emits the partial's output text to the page. Controllers don't render HTML — their text output is empty by design — so `include` produces no useful effect when called this way.

---

## Argument passing

Each controller partial expects specific Liquid variables — match the names the V2 endpoint passes when including it. Common patterns:

- **Read by id/uuid:** the page passes `uuid: context.params.uuid` → you pass `uuid: "..."`
- **Create / update:** the page passes `params: context.params` (the whole HTTP body) → you build a JSON-like payload and pass it as `params:`

Example — update a contact:

```liquid
{%- assign update_payload = '{}' | parse_json -%}
{%- assign update_payload = update_payload | add_hash_key: 'first_name', "Jane" -%}
{%- assign update_payload = update_payload | add_hash_key: 'company.uuid', "abc-..." -%}

{%- function updated = "crm/controller/contacts/update",
    uuid: "01HF...",
    params: update_payload -%}
```

The `update_payload` hash plays the role the HTTP request body plays — same `properties.<name>` dotted-path convention for nested fields, same custom-field semantics. See the module's `api.md` for the per-resource shape.

---

## Reading the result

The controller returns a single Liquid variable (a hash). Its shape mirrors the V2 HTTP response:

- **Success:** the resource object as documented in the module's `api.md`
- **Failure:** a hash with an `error` (string) or `errors` (array) key — same shapes as the HTTP API

Always check both error keys — see the module's `gotchas.md` for the error-shape inconsistency:

```liquid
{%- function result = "crm/controller/contacts/get", uuid: "..." -%}

{%- if result.error or result.errors -%}
  {# handle failure — log, set flash, redirect #}
{%- else -%}
  {# success — use result fields #}
{%- endif -%}
```

---

## Auth context

**The V2 endpoint's guard does not run when you call the controller directly.** That guard (a front-matter policy, or on CRM V2 pages an inline `api_key_guard` function) is on the V2 *endpoint page*, not on the controller partial. When you invoke the controller from your own page via `{% function %}`, you're bypassing it.

This is intentional — the controller is reusable logic. The expectation is that **your calling page enforces its own access control** via its own `authorization_policies:` front matter:

```liquid
---
slug: admin/contacts/:uuid
method: get
layout: admin
authorization_policies:
  - modules/insites_core/insites_only_allowed_if_logged_in
  - modules/insites_core/insites_only_allowed_by_administrators
---

{%- function contact = "crm/controller/contacts/get", uuid: context.params.uuid -%}
{# rendering logic #}
```

If your calling page has no authorization policy, then anyone reaching that page can read/write through the controller. Don't rely on the V2 policy to gate logic invoked through this path.

`context.current_user` is whatever the platform sets for the request hitting your page — same as in any other page. The controller sees that context.

---

## When to use this vs. an HTTP call

Use the in-Liquid pattern when:

- You're rendering data inside a page on the same instance — no reason to round-trip through HTTP
- You're composing several CRM/data/CMS operations in one page (the in-process path is faster and shares the request lifecycle)
- You need access to `context.current_user` or `context.session` and want to drive the controller from that

Stick with HTTP (curl / `api_calls/` partial) when:

- The caller is genuinely external (another service, a webhook receiver, a non-Liquid client)
- You want the V2 auth policy to enforce per-call (HTTP gives you that for free; in-Liquid bypasses it)
- You want the V2 response shape with HTTP status codes set, not just the data hash

---

## Worked example — read a contact, render the page

```liquid
---
slug: my-app/contacts/:uuid
method: get
layout: app_default
authorization_policies:
  - modules/insites_core/insites_only_allowed_if_logged_in
---

{%- function contact = "crm/controller/contacts/get", uuid: context.params.uuid -%}

{%- if contact.error or contact.errors -%}
  {%- assign flash = contact.error | default: contact.errors.first.message -%}
  {%- session flash: flash -%}
  {%- redirect_to "/my-app/contacts" -%}
{%- else -%}
  {%- render "my-app/contacts/show", contact: contact -%}
{%- endif -%}
```

The page uses its own auth policy (`insites_only_allowed_if_logged_in`), then calls the CRM `get` controller directly to fetch the contact. No HTTP overhead, no auth bypass risk because the page itself is gated.

---

## Worked example — create a contact via callback action

```liquid
---
slug: my-app/contacts
method: post
layout: app_default
authorization_policies:
  - modules/insites_core/insites_only_allowed_if_logged_in
---

{%- function created = "crm/controller/contacts/create", params: context.params -%}

{%- if created.error or created.errors -%}
  {%- session flash: created.error | default: "Could not create contact" -%}
  {%- redirect_to "/my-app/contacts/new" -%}
{%- else -%}
  {%- session flash: "Contact created" -%}
  {%- redirect_to "/my-app/contacts/" | append: created.uuid -%}
{%- endif -%}
```

The page is `method: post`, so `context.params` carries the form body. Pass the whole thing as `params:` into the controller — it accepts the same dotted-path convention (`first_name`, `email`, `custom_field.region`, `company.uuid`, etc.) that the HTTP endpoint accepts.

---

## Gotchas

- **`{% include %}` is the wrong verb.** Use `{% function %}`. `include` doesn't capture the controller's return value.
- **No automatic auth.** The V2 auth policy is on the endpoint page, not the controller. Add `authorization_policies:` to your calling page.
- **`format` is not `json`.** Don't expect `Content-Type: application/json` headers, status codes, or security headers — those only fire on the V2 endpoint via `response_handler`. Your page's response is whatever your page renders.
- **Path aliases vs. file locations.** The first arg to `{% function %}` is the controller's `path:` front-matter alias (e.g. `crm/controller/contacts/get`), not the file path under `partials/`. Look for the alias in the canonical doc files (one alias per controller); use that.
- **Per-resource argument names matter.** Each controller expects specific Liquid var names (`uuid`, `params`, `id`, `table_id`, etc.). Mismatches silently produce empty/error results. Check the controller's first few lines or the V2 endpoint page that includes it for the canonical arg list.
- **Errors from the controller and errors from the V2 endpoint may differ in shape.** Auth-policy failures are HTTP-only (the in-Liquid path doesn't run them); validation failures from the controller layer come through the same `error` / `errors` keys. Code defensively for both keys regardless.
