# Locator Module

The Insites Locator module (machine name `insites_locator`, repo `module-v6-locator`) stores the data behind a store or branch finder: **locations** with addresses, coordinates, weekly opening hours and media; **categories** that group them; **enquiries** raised against a location; and per-location **FAQs**, **custom fields** and **system fields**. It exposes a V2 REST API and 23 controller aliases, and it is administered through the IIA admin UI.

Paths below are relative to `modules/insites_locator/` in `module-v6-locator`, read on `origin/master` at `v6.0.2-2-g5242b65` (two release-workflow commits after the v6.0.2 tag) on 9 October 2026.

## Where to look

| If you're… | Read |
|---|---|
| Building an external app that calls the Locator API | [`api.md`](api.md) |
| Calling the controllers from inside Liquid | [`patterns.md`](patterns.md) + [`../../building-on-insites/02-calling-a-controller.md`](../../building-on-insites/02-calling-a-controller.md) |
| Setting up the module in the IIA admin (fields, Google Maps key, imports) | [`configuration.md`](configuration.md) |
| Looking for worked curl and `{% function %}` examples | [`patterns.md`](patterns.md) |
| Hitting an edge or something that looks like your bug | [`gotchas.md`](gotchas.md) |
| Rendering Locator partials from another module, or tracing its dependencies | [`advanced.md`](advanced.md) |

## V2 REST API is the supported surface

The module serves 22 pages under `private/views/pages/api/_external/v2/` at the `/locator/api/v2/...` prefix (counted in module-v6-locator v6.0.2 on 9 October 2026). Ten more pages under `_external/{enquiries,locations}/` serve a legacy `/locator/api/v1/...` surface with no alias and no doc data; `CHANGELOG.md` (v6.0.2, TW#26801435) records a CI waiver until they move under `v2/`. Build on V2.

## Surface at a glance

| Resource | URL | Operations | Notes |
|---|---|---|---|
| **Categories** | `/locator/api/v2/categories` | Full CRUD | By `uuid` |
| **Locations** | `/locator/api/v2/locations` | Full CRUD | By `uuid`; `category.uuid`, `custom_field.<name>`, `system_field_uuids` on write |
| **Enquiries** | `/locator/api/v2/enquiries` | Full CRUD | By `uuid`; `location.uuid`, `assigned_to.uuid` on write |
| **System fields** | `/locator/api/v2/system-fields` | Full CRUD | By `uuid` |
| **Custom fields** | `/locator/api/v2/custom-fields` | List, delete | Delete by numeric property `:id`; no create or update |

Total: 22 endpoints. Update is `PUT`, not `PATCH`.

## Controller aliases

The module declares 23 controller aliases, all of the form `locator/controller/<resource>/<verb>`, in the `path:` front matter of partials under `private/views/partials/controllers/_external/v2/` (22) and `controllers/enquiries/filters/get_filter_options.liquid` (1). The full list is in the [alias inventory](../../building-on-insites/reference/alias-inventory.md#module-v6-locator-23). 22 of the 23 gate their response handler on `context.params.format == 'json'` and `{% return %}` a value; `locator/controller/enquiries/filters/get_filter_options` does neither (see [`gotchas.md`](gotchas.md)).

## Module identity

`public/views/partials/lib/hooks/hook_module_info.liquid` returns `machine_name: "insites_locator"`, `slug: "locator"` and `version: "6.0.0"`. The git tag is v6.0.2 (24 September 2026 per `CHANGELOG.md`); release tooling does not bump the hook, so use it only to answer "is the module installed".

## Tables the module creates

Seven tables come from `private/schema/`: `category.yml`, `enquiry.yml`, `location.yml`, `location_faq.yml`, and the saved-filter tables `filters/locator_{category,enquiry,location}_filter.yml`. Two more are created by migrations and have no YAML file in the repo:

| Table | Created by |
|---|---|
| `modules/ins_locator/location_custom_field` | `private/migrations/20231002003624_add_custom_field_schema.liquid` |
| `modules/insites_locator/location_system_field` | `private/migrations/20231018065328_add_system_fields_schema.liquid` |

The `ins_locator` prefix on the custom-field table is the real table name on every instance; three other modules hard-code it (see [`advanced.md`](advanced.md)). Nine tables in all.

## What is admin-UI-only

51 pages under `private/views/pages/api/` (everything outside `_external/`) serve the admin SPA at `insites/locator/...` behind `modules/insites_crm/insites_only_allowed_by_administrators`. They cover what the API does not: FAQs, attachments, imports and exports, saved filters, system-field label renaming, custom-field definition create and update, and the Google Maps key lookup. Details in [`configuration.md`](configuration.md).

## Layout map

```
modules/locator/
├── README.md            ← you are here
├── api.md               ← V2 REST endpoints, params, response shapes, errors
├── configuration.md     ← IIA admin walkthrough, migrations, what is seeded
├── patterns.md          ← curl and {% function %} worked examples
├── gotchas.md           ← edges visible in source
└── advanced.md          ← hooks, partials other modules render, dependencies
```

## Auth, in one sentence

Send the raw instance API key as the `Authorization` header, no `Bearer` prefix; all 22 V2 pages declare `modules/insites_crm/has_valid_instance_api_authorization`, which redirects a miss to the CRM `api/401` page. Full reference: [`../../api/authentication.md`](../../api/authentication.md).

## Webhooks, in one sentence

**Locator fires no webhooks and sends no email.** The module has no `api_calls/`, `notifications/` or `emails/` directory and no `send_webhook` call anywhere in its tree (searched 9 October 2026). Poll the list endpoints and watch `updated_at`.
