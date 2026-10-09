# API Module

The Insites API module (machine name `insites_api`, repo `module-v6-api`, tag v6.0.2) is the admin surface for an instance's developer plumbing: Custom API Endpoints (pages that serve JSON), authorization policies, saved GraphQL queries, an API usage report, and the instance's own API reference at `/admin/api`. It holds no business data. The one resource it exposes over the instance API is the Custom API Endpoint itself.

Every fact here comes from `pos/modules/insites_api/` in module-v6-api, read on 9 October 2026.

## Where to look

| If you're… | Read |
|---|---|
| Creating or editing Custom API Endpoints from an external app or from Liquid | [`api.md`](api.md) |
| Calling the five `insites/controller/endpoints/...` aliases | [`patterns.md`](patterns.md) + [`../../building-on-insites/02-calling-a-controller.md`](../../building-on-insites/02-calling-a-controller.md) |
| Setting up endpoints, policies, GraphQL and reports in IIA | [`configuration.md`](configuration.md) |
| Hitting an edge (namespace rules, missing partials, fields reset on update) | [`gotchas.md`](gotchas.md) |
| Making your module appear in the `/admin/api` reference | [`advanced.md`](advanced.md) |
| Writing the body of an endpoint | [`../../api-endpoints/README.md`](../../api-endpoints/README.md) |

## Surface at a glance

| Resource | Over the instance API | Admin UI (IIA session) |
|---|---|---|
| **Custom API Endpoints** | Full CRUD at `/insites/api/v2/endpoints` | List, create, edit, patch metadata, delete, paths |
| **Authorization policies** | none | List, read, create, update, delete, paths |
| **GraphQL queries** | none | List, read, create, update, delete, paths |
| **Reports** (API usage) | none | Read, proxied to `api.insites.io/metrics` |
| **Themes** (docs light/dark) | none | Save |
| **API reference** (`/admin/api`, `/admin/api_md`, `/admin/json`, `/llms`) | public, no session | |

Counted in module-v6-api v6.0.2 on 9 October 2026: 27 page files under `private/views/pages/api/` (6 external, 21 admin), 6 docs pages, 24 GraphQL files, 1 outbound API call, 1 table, 5 controller aliases.

## The five controller aliases

`insites/controller/endpoints/{create,get,list,update,delete}`, declared in the `path:` front matter of `private/views/partials/controllers/_external/v2/endpoints/*.liquid` and listed under `module-v6-api` in the [alias inventory](../../building-on-insites/reference/alias-inventory.md). All five gate their response handler on `context.params.format == 'json'` and end with `{% return data %}`.

## hook_module_info

`public/views/partials/lib/hooks/hook_module_info.liquid` returns `name: "Insites API"`, `machine_name: "insites_api"`, `version: "6.0.2"`, `slug: "api"`, `label: "API"`. The version matches the git tag.

## Tables

One schema file, `private/schema/api_key.yml` (`uuid`, `key_name`, `secret_api_key`, `status`). No GraphQL file in the module reads or writes it; policies replaced keys in v5.2.0 (CHANGELOG, TW#24522553).

## How the API reference is rendered

`/admin/api` is generated per request. `docs/functions/session_data.liquid` finds every installed module through `docs/get_modules.graphql` (`admin_liquid_partials` whose path ends with `/lib/hooks/hook_module_info`), calls each hook, then calls `modules/<machine_name>/insites_api/external_api` and drops modules where that partial is missing. `docs/content.liquid` maps `/admin/api/<slug>/<feature>/<endpoint>` to `modules/<module>/insites_api/external_api/<feature>/object` and `.../<endpoint_slug>` (hyphens become underscores), and `docs/content/methods.liquid` reads `content.contract` from the endpoint partial. That is the carrier the [controller contract spec](../../building-on-insites/reference/controller-contract-spec.md) relies on; [`advanced.md`](advanced.md) lists the partial shapes.

## Layout map

```
modules/api/
├── README.md            ← you are here
├── api.md               ← every page: method, path, guard, params, response, errors
├── configuration.md     ← IIA paths and what each admin form writes
├── patterns.md          ← worked {% function %} and HTTP examples
├── gotchas.md           ← namespace rules, dangling include, fields reset on update
└── advanced.md          ← hooks, doc-data partials, CRM dependencies
```

## Auth, in one sentence

The six `/insites/api/v2/endpoints` pages carry `modules/insites_crm/has_valid_instance_api_authorization` (raw instance key in `Authorization`, no `Bearer`; [`../../api/authentication.md`](../../api/authentication.md)); every admin page carries `modules/insites_crm/insites_only_allowed_by_administrators`; the docs pages carry no policy by decision (TW#26617714).

## Webhooks, in one sentence

The module fires no webhooks; the external create, update and delete controllers write an event-stream row through `modules/insites_crm/functions/event_stream/add_event` with `module_source: 'insites_api'`.
