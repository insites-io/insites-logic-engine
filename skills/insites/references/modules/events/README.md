# Events Module

The Insites Events module (machine name `insites_events`, repo `module-v6-events`, tag v6.0.2) plans and sells in-person and online events: the event record itself, its venue, pricing divisions and tiers, tickets with QR check-in, speakers, sponsors, FAQs, expenses and a financial summary. It exposes a V2 REST API for external integrations, 37 controller aliases for in-Liquid callers, and an admin UI inside IIA.

Every fact below was read from the module tree at `modules/insites_events/` in `module-v6-events` at tag v6.0.2 (the checked-out HEAD is two commits past the tag, and neither commit changes the module tree). Counts are as of 9 October 2026.

## Where to look

| If you're… | Read |
|---|---|
| Building an external app that calls the Events API | [`api.md`](api.md) |
| Calling the controllers from inside Liquid | [`patterns.md`](patterns.md) + [`../../building-on-insites/02-calling-a-controller.md`](../../building-on-insites/02-calling-a-controller.md) |
| Setting the module up in IIA (system fields, custom fields, webhooks, what migrations seed) | [`configuration.md`](configuration.md) |
| Looking for worked curl and `{% function %}` examples | [`patterns.md`](patterns.md) |
| Hitting an edge or an odd name | [`gotchas.md`](gotchas.md) |
| Rendering the module's partials, or tracing its dependency on CRM and Ecommerce | [`advanced.md`](advanced.md) |

## V2 REST API is the supported surface

The module serves its public API at `/events/api/v2/...`. The 35 pages under `private/views/pages/api/_external/v2/` are the contract. A second, un-versioned folder `private/views/pages/api/_external/events/` holds 27 pages at `/events/api/v1/...`; the module's own `CLAUDE.md` calls that folder drift to be migrated, and this skill does not document it beyond [`gotchas.md`](gotchas.md).

## Surface at a glance

| Resource | Operations | Path root |
|---|---|---|
| **Events** | List, get, create, update, delete, update status | `/events/api/v2/events` |
| **Event expenses** | List, create, update, delete | `/events/api/v2/events/:uuid/expenses` |
| **Event FAQs** | List, create, update, delete | `/events/api/v2/events/:uuid/faqs` |
| **Event speakers** | List, create, update, delete | `/events/api/v2/events/:uuid/speakers` |
| **Event sponsors** | List, create, update, delete | `/events/api/v2/events/:uuid/sponsors` |
| **Event tickets** | List, create (batch), update, delete, assign contact | `/events/api/v2/events/:uuid/tickets` |
| **System fields** | List, options, create, update, delete, update option label | `/events/api/v2/system-fields` |
| **Venues** | List, create | `/events/api/v2/venues` |

Total: 35 endpoints, counted in module-v6-events v6.0.2 on 9 October 2026. Venue areas, pricing divisions and tiers, event managers, columns, filters, imports, exports, QR check-in and PDF generation have no V2 endpoint; they are admin-UI only (128 pages under `insites/events/...`, every one gated by `modules/insites_crm/insites_only_allowed_by_administrators`).

## Controllers

Each V2 page does one thing: `{% include %}` a controller partial under `private/views/partials/controllers/_external/v2/` and pass `context.params`. The 35 controllers declare a short alias with **no `controller` word**, for example `events/venues/list` and `events/event_tickets/assign_contact`. Two more long-form controllers exist, `modules/insites_events/controllers/user_preferences/get` and `.../upsert`, which serve the admin-only Ex-Tax/Gross toggle. The full list of 37 is in the [alias inventory](../../building-on-insites/reference/alias-inventory.md#module-v6-events-37); do not copy it, link to it.

All 35 short controllers gate their response handler on `context.params.format == 'json'` and end with `{% return data %}`. The two user-preference controllers do neither. Details and consequences in [`patterns.md`](patterns.md) and [`gotchas.md`](gotchas.md).

## Module identity

`public/views/partials/lib/hooks/hook_module_info.liquid` returns `machine_name: "insites_events"`, `slug: "events"`, `version: "6.0.2"`. The hook version matches the git tag at v6.0.2; it does not lag.

## Tables

21 schema files under `private/schema/`: `event`, `event_column`, `event_expense`, `event_faq`, `event_filter`, `event_pricing_division`, `event_pricing_tier`, `event_revenue`, `event_speaker`, `event_sponsor`, `event_ticket`, `event_ticket_column`, `event_ticket_filter`, `event_user_preference`, `ticket_column`, `ticket_filter`, `venue`, `venue_area`, `venue_column`, `venue_filter`, `webhook`. Two more tables come from migrations, not schema files: `event_system_field` (migration `20240226040708`) and the custom-field table at `modules/ins_events/event_custom_field` (migration `20240226015750`, note the `ins_events` prefix). See [`configuration.md`](configuration.md).

## Layout map

```
modules/events/
├── README.md            ← you are here
├── api.md               ← the 35 V2 endpoints, grouped by resource
├── configuration.md     ← IIA admin paths, what migrations seed, webhooks setup
├── patterns.md          ← curl and {% function %} worked examples
├── gotchas.md           ← edges visible in source
└── advanced.md          ← hooks, renderable partials, cross-module dependencies
```

## Auth, in one sentence

Send the raw instance API key as the `Authorization` header, no `Bearer` prefix: every V2 page lists the module's own copy of the policy, `private/authorization_policies/has_valid_instance_api_authorization.liquid`, which compares `context.headers.HTTP_AUTHORIZATION` to the instance's `instance_api_key` and redirects failures to the module's `api/v2/401` page. Full reference: [`../../api/authentication.md`](../../api/authentication.md).

## Webhooks, in one sentence

Events fires three webhook types and only on **create**: `event_added`, `event_ticket_added`, `event_expense_added` (table `webhook`, delivery through `private/api_calls/webhoooks/call_event_webhook.liquid`); no update, delete, speaker, sponsor, FAQ or venue events exist. Registration is admin-UI only; see [`configuration.md`](configuration.md) and [`api.md#webhooks`](api.md#webhooks).
