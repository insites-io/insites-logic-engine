# CRM Controllers

The CRM module exposes its V2 API at `/<module>/api/v2/...` via **controller pages** that use the `path:` front-matter alias to remap their slug. Controllers are not free-form pages — they conform to the CRM module's URL conventions and return CRM-shaped JSON.

> **Read first:** [`modules/crm/api.md`](../modules/crm/api.md) for the full V2 endpoint catalogue (contacts, companies, tasks, activities, attachments). This directory covers **how to write** a CRM-style controller, not the endpoint catalogue itself.

## The `path:` alias

A controller declares its public URL via the `path:` key in front matter, separately from its file location. This lets the file live under `modules/insites_crm/public/views/pages/api/_external/v2/contacts/` while serving requests at `/crm/api/v2/contacts`.

```liquid
---
path: crm/api/v2/contacts/:id
method: get
authorization_policies:
  - modules/insites_crm/has_valid_instance_api_authorization
---
{% liquid
  graphql res = 'modules/insites_crm/contacts/find', id: context.params.id
  assign body = res.records.results.first | json
  print body
%}
```

The `path:` value takes priority over `slug:`; if both are present, `path:` wins.

## Conventions inherited from CRM

- **Auth:** raw `instance_<50chars>` token in `Authorization` header (no Bearer). See [`api/authentication.md`](../api/authentication.md). The CRM module's own V2 pages guard inline with `modules/insites_crm/functions/auth/api_key_guard` so that a failure answers 401 on the original URL; the front-matter policy above redirects to `api/401` instead. See [`api-endpoints/`](../api-endpoints/README.md) for the trade-off.
- **JSON shape:** controllers emit the CRM module's canonical shape — `{ "data": { ... } }` for single records, `{ "data": [...], "meta": { "total_entries": N, ... } }` for lists. Match what the module's existing endpoints already produce; don't invent new shapes.
- **Webhooks:** only `contact_created`, `contact_updated`, `company_created`, `company_updated` fire today. Don't promise webhook coverage your controller can't deliver.
- **Custom fields:** read/write through the property accessor pattern documented in [`modules/crm/configuration.md`](../modules/crm/configuration.md).

## When to add a controller (vs a generic API endpoint)

Add a CRM controller when the endpoint logically extends the CRM module's V2 surface — a new resource (e.g. `cases`), a new action on an existing resource (e.g. `contacts/:id/merge`), or a custom report that joins CRM tables.

For non-CRM resources (your own product's data), use a generic API endpoint under your module's `api/_external/v2/...` tree instead. See [`api-endpoints/`](../api-endpoints/README.md).

## See Also

- [`modules/crm/api.md`](../modules/crm/api.md) — full V2 endpoint catalogue
- [`modules/crm/configuration.md`](../modules/crm/configuration.md) — custom fields, system fields
- [`api/authentication.md`](../api/authentication.md) — V2 token format
- [`api/calling-from-liquid.md`](../api/calling-from-liquid.md) — how `path:` aliases resolve
- [`api-endpoints/`](../api-endpoints/README.md) — generic (non-CRM) API endpoints

---

A complete, verified controller contract — arguments, returns, errors, and the silent-failure table for `crm/controller/contacts/list` — lives at [building-on-insites/reference/crm-contacts-list.md](../building-on-insites/reference/crm-contacts-list.md). Use it as the template shape for documenting any controller.
