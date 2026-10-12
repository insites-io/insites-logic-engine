# Data Module

The Insites Data module (machine name `insites_databases`) provides user-definable databases — admin-defined tables with arbitrary columns plus a V2 REST API for reading definitions and CRUD on rows ("database items"). Use it when you need to store structured app-specific data without writing schema YAML, or when an end-user needs to manage their own data tables through IIA.

## Where to look

| If you're… | Read |
|---|---|
| Building an external app that reads/writes database items | [`api.md`](api.md) |
| Calling these endpoints from inside Liquid | [`api.md`](api.md) + [`../../api/calling-from-liquid.md`](../../api/calling-from-liquid.md) |
| Creating or configuring databases (column schema, etc.) in IIA | [`configuration.md`](configuration.md) |
| Looking for HTTP examples of common flows | [`patterns.md`](patterns.md) |
| Hitting an edge or unexpected behavior | [`gotchas.md`](gotchas.md) |

## V2 REST API is the supported surface

The Data module exposes a V2 REST API at `/databases/api/v2/...`. **The V2 API is the supported way to interact with database items** for both external integrations and in-Liquid callers. Database creation itself is **IIA-only** — there is no API endpoint to create or modify a database's column schema. Items inside an existing database are full-CRUD via the API.

## Surface at a glance

| Resource | Operations | Notes |
|---|---|---|
| **Databases** | List + read one | Read-only via API. Create/edit in IIA. |
| **Database items** | Full CRUD | Wire shape: `{id, properties, created_at, updated_at}`. `properties` is dynamic per database. |

Total: 7 endpoints, all under `/databases/api/v2/...`.

## Layout map

```
modules/data/
├── README.md            ← you are here
├── api.md               ← V2 REST endpoints + conventions
├── configuration.md     ← IIA admin walkthrough (creating databases, column schema)
├── patterns.md          ← worked HTTP examples for common flows
└── gotchas.md           ← API edges and quirks
```

## Auth, in one sentence

Send the raw instance API key as the `Authorization` header. **No `Bearer` prefix.** Acquire and rotate the key from the IIA admin UI. Full reference: [`../../api/authentication.md`](../../api/authentication.md).

## Webhooks, in one sentence

**Data fires no webhooks.** If you need change notifications, poll the items list and watch `updated_at`, or wire integrations through the api module.
