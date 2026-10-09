# Pipelines Module

The Insites Pipelines module (machine name `insites_pipeline`, repo `module-v6-pipelines`, documented at git tag v6.0.2) manages sales pipelines: pipelines and their ordered stages, opportunities (deals) moving through those stages, the contacts attached to each opportunity, per-pipeline custom fields, and the lookup values (won reason, lost reason, division, lead source) the module calls system fields. It ships an admin UI inside IIA (board and table views, reports, activities, tasks) and a V2 REST API for the core records.

Every fact in this folder was read from the module source at `pos/modules/insites_pipeline/` in module-v6-pipelines v6.0.2 on 9 October 2026. Paths below are relative to that directory unless they start with `modules/`.

## Where to look

| If you're… | Read |
|---|---|
| Building an external app against the pipelines REST API | [`api.md`](api.md) |
| Calling the module's controllers from inside Liquid | [`api.md`](api.md) + [`../../building-on-insites/02-calling-a-controller.md`](../../building-on-insites/02-calling-a-controller.md) |
| Setting up pipelines, stages, custom fields, system fields or webhooks in IIA | [`configuration.md`](configuration.md) |
| Looking for curl and `{% function %}` examples of common flows | [`patterns.md`](patterns.md) |
| Hitting an edge or an unexpected response | [`gotchas.md`](gotchas.md) |
| Hooks, cross-module dependencies, partials other modules can render | [`advanced.md`](advanced.md) |

## V2 REST API is the supported surface

The module exposes a V2 REST API under `/pipeline/api/v2/...` (singular `pipeline`, declared in the `slug:` front matter of every page under `private/views/pages/api/_external/v2/`). A legacy v1 API under `/pipeline/api/v1/...` still exists in `private/views/pages/api/_external/{opportunities,pipelines,webhooks}/`; its `GET /pipeline/api/v1/opportunities` page sends `Deprecation: true` and a `Link: </pipeline/api/v2/opportunities>; rel="successor-version"` header. Use V2.

## Surface at a glance

| Resource | URL root | Operations | Notes |
|---|---|---|---|
| **Pipelines** | `/pipeline/api/v2/pipelines` | Create, list, read, update, delete | Delete cascades to activities, custom-field data, opportunities and stages |
| **Pipeline stages** | `/pipeline/api/v2/pipelines/stages/:pipeline_uuid` | Create, list, update, delete | No read-one endpoint. Nested `/pipelines/:uuid/stages` routes exist only to answer 404 |
| **Opportunities** | `/pipeline/api/v2/opportunities` | Create, list, read, update, delete | Plus two `OPTIONS` preflight pages. Custom-field values ride in the same body |
| **Related contacts** | `/pipeline/api/v2/opportunities/:opportunity_uuid/related-contacts` | Create, list, update, delete one | `DELETE` on the collection answers 405 |
| **System fields** | `/pipeline/api/v2/system-fields` | Create, list, read, update, delete | One table for won_reason, lost_reason, division and lead_source values |
| **Opportunity custom fields** | `/pipeline/api/v2/custom-fields/opportunities` | List (by opportunity uuid), delete (by numeric id) | Definitions only; values live on the opportunity |

Counted in module-v6-pipelines v6.0.2 on 9 October 2026: 33 page files under `private/views/pages/api/_external/v2/`. 25 of them do work; the other 8 are two `OPTIONS` preflight pages, one 405 stub and five 404 "phantom route" stubs. A further 17 page files under `_external/` are the v1 API, and two of those (`webhooks/post.liquid`, `webhooks/put.liquid`) are empty files. Admin-only JSON pages under `private/views/pages/api/` (not `_external`) number 75; all 74 that carry a policy use `modules/insites_crm/insites_only_allowed_by_administrators`, and one (`stages/delete.liquid`) is empty.

## Controller aliases

The module declares 107 controller aliases and 60 internal aliases. They are listed under `module-v6-pipelines` in [`../../building-on-insites/reference/alias-inventory.md`](../../building-on-insites/reference/alias-inventory.md); do not copy them from here.

Two naming forms coexist:

- **Short form** `pipeline/controller/<resource>/<verb>` (25 aliases): the V2 controllers under `private/views/partials/controllers/_external/v2/`. Each gates its response handler on `context.params.format == 'json'` and ends with `{% return data %}`. These are the ones to call from Liquid.
- **Long form** `modules/insites_pipeline/controllers/...` (82 aliases): the admin controllers that back the IIA Vue app. None of the 82 contains a `{% return %}`; each writes its own JSON response through `modules/insites_crm/functions/insites_response_util`, `insites_response_handler` or an ungated `response_handler` (counted by grep on 9 October 2026). A `{% function %}` on one of these binds nothing and sets your page's headers. See [`gotchas.md`](gotchas.md).

The v1 controllers under `controllers/_external/{opportunities,pipelines,webhooks}/` declare no `path:` and have no alias at all.

## hook_module_info

`public/views/partials/lib/hooks/hook_module_info.liquid` returns:

```json
{ "name": "Insites Pipeline", "machine_name": "insites_pipeline", "type": "module",
  "version": "6.0.2", "slug": "pipeline", "label": "Pipeline" }
```

At tag v6.0.2 the hook string matches the tag. Release tooling does not bump this partial (see the alias inventory's note on other modules reporting 6.0.0 at v6.0.2), and two other version strings in this tree disagree: the generated `insites_admin/insites_pipeline_dependencies.liquid` says "v6.0.1" and `CLAUDE.md` says "v6.0.0". Use the hook to answer "is it installed"; use the git tag for "which version".

## Tables the module creates

Thirteen schema files under `private/schema/` (table names take the `modules/insites_pipeline/` prefix on the instance): `pipeline`, `pipeline_stage`, `pipeline_system_field`, `pipeline_webhook`, `pipeline_display_field`, `opportunity`, `opportunity_activity`, `opportunity_related_contact`, `opportunity_column`, `opportunity_filter`, `opportunity_search`, `opportunity_report_filters`, `custom_fields`.

One more table is created by migration, not schema: `private/migrations/20240403102750_add_custom_field_schema.liquid` runs `admin_table_create` with `physical_file_path: modules/ins_pipeline/public/schema/pipeline_opportunity_custom_field.yml`. Every custom-field query references it as `modules/ins_pipeline/pipeline_opportunity_custom_field` (note `ins_pipeline`, not `insites_pipeline`). The other three migrations seed system fields and move old activity rows; see [`configuration.md`](configuration.md).

## Layout map

```
modules/pipelines/
├── README.md            ← you are here
├── api.md               ← every V2 endpoint: method, path, guard, params, response, errors
├── configuration.md     ← IIA admin paths, what install seeds and migrates
├── patterns.md          ← curl and {% function %} worked examples
├── gotchas.md           ← edges visible in source
└── advanced.md          ← hooks, public partials, cross-module dependencies, override points
```

## Auth, in one sentence

Every V2 page lists `modules/insites_crm/has_valid_instance_api_authorization` in its front matter, which compares the raw `Authorization` header against the instance API key (no `Bearer` prefix); the two `OPTIONS` pages carry no policy on purpose (comment in `get_options.liquid`: "public on purpose: CORS preflight, returns Allow only, no data"). Full reference: [`../../api/authentication.md`](../../api/authentication.md).

## Webhooks, in one sentence

Pipelines fires six webhook event types (`opportunity_created`, `opportunity_updated`, `opportunity_deleted`, `pipeline_created`, `pipeline_updated`, `pipeline_deleted`) through `private/api_calls/webhooks/send_webhook.liquid`, but only from the admin (long-form) controllers; no V2 REST endpoint sends a webhook (grep for `add_webhook_api_call` on 9 October 2026 matches nine files, none under `_external`). Subscriptions are rows in `pipeline_webhook`, managed in IIA. See [`api.md#webhooks`](api.md#webhooks).
