# Events: Configuration

What an administrator sets up in IIA for the Events module, and what the module's migrations seed on install. Read from `module-v6-events` v6.0.2 on 9 October 2026.

For authentication, see [`../../api/authentication.md`](../../api/authentication.md).

---

## IIA admin paths

The side menu partial `private/views/partials/insites_menu/insites_events_side_menu.liquid` registers these routes inside the IIA shell:

| What | IIA path |
|---|---|
| All events | `<your-insites-instance>/admin/insites#/events/all-events` |
| Tickets (across events) | `<your-insites-instance>/admin/insites#/events/tickets` |
| Venues | `<your-insites-instance>/admin/insites#/events/venues` |
| System fields | `<your-insites-instance>/admin/insites#/events/system-fields` |
| Custom fields | `<your-insites-instance>/admin/insites#/events/custom-fields` |
| Webhooks | `<your-insites-instance>/admin/insites#/events/webhooks` |
| QR check-in | `<your-insites-instance>/admin/insites#/events/qr-check-in` |

The Vue SPA behind those routes calls 128 admin pages at `/insites/events/...` (`private/views/pages/api/`, everything outside `_external/`). All 128 carry an `authorization_policies` block; 127 list `modules/insites_crm/insites_only_allowed_by_administrators`, and 8 also list `modules/insites_crm/insites_only_allowed_if_logged_in`. None of them is reachable with the API key.

## Admin-only versus API

| Capability | Admin UI | V2 API |
|---|---|---|
| Events, expenses, FAQs, speakers, sponsors, tickets | yes | yes |
| Venues | full CRUD, plus venue areas | list and create only |
| Pricing divisions and tiers (per event) | yes (`insites/events/:uuid/pricing/...`) | no |
| System fields | yes | yes |
| Custom fields on events (define) | yes (`insites/events/custom-fields`) | no; values only, via `custom_field.<name>` |
| Webhook subscriptions | yes (`insites/events/webhooks` GET, POST, PUT) | no |
| Table columns, saved filters, import, export, PDF ticket layout, QR check-in | yes | no |
| Ex-Tax/Gross display preference | yes (`insites/events/user-preferences` GET, PUT) | no |

## System fields

System fields are option lists (industry, category, venue type and so on) kept as metadata on one table, `event_system_field`, which the migration `private/migrations/20240226040708_add_system_fields_schema.liquid` creates with `admin_table_create`. The migration seeds `Event Category` (uuid `df2c607d-…`), `Event Industry` (`4b6256f7-…`), `Venue Type` (`161f7292-…`) and placeholder `System Field 1..n` slots. `20240228035826_set_event_system_fields.liquid` adds the initial option values; `20250307034362_set_expenses_system_fields.liquid` and `20250905033557_set_sponsor_category_system_fields.liquid` add the expense and sponsor categories. The V2 options endpoint marks those fixed fields `is_configurable: false`, and the option-configuration controller refuses to rename them.

In the API, a system field is addressed by its label downcased with underscores (`event_category`), never by uuid; see [`api.md#system-fields`](api.md#system-fields).

## Custom fields

`20240226015750_add_custom_field_schema.liquid` creates the custom-field table with `physical_file_path: modules/ins_events/public/schema/event_custom_field.yml`. The `ins_events` prefix is the table's real name and 30 references across `private/graphql/` use it; do not "fix" it. Administrators define columns in IIA; the API writes values through `custom_field.<name>` keys on the event, coerced by `attribute_type` (`integer`, `float`, `boolean`, `array`, `geo_json`, else string) in `controllers/_external/v2/events/add_event.liquid`.

## Webhooks

The Webhooks screen creates one row per event type in the `webhook` table (`private/schema/webhook.yml`): `event_type`, `webhook_url`, `is_webhook_enabled`, `payload_schema`. The three types the module fires are `event_added`, `event_ticket_added` and `event_expense_added`, all on create only. Delivery is a plain JSON POST with no signature; put the secret in the URL or restrict by source if the receiver needs it. The events API doc in IIA sits at `<your-insites-instance>/admin/api/events/...` (slugs from `private/views/partials/insites_api/external_api.liquid`: `all-events`, `event-speakers`, `event-sponsors`, `event-expenses`, `event-faqs`, `event-tickets`, `system-fields`, `venues`).

## What the other migrations do

| Migration | Effect |
|---|---|
| `20250730083065_add_event_venue_area_uuid_to_all_tickets` | backfills the pricing division uuid on every ticket from `venue_area_name` |
| `20250730083078_add_name_to_all_event_venue_areas` | copies `area_name` into `name` on every division |
| `20250807063157_reset_table_columns` | resets saved column layouts on `event_column`, `event_ticket_column`, `ticket_column` |
| `20250905033555_update_ticket_qr_codes` | regenerates QR codes on every ticket |
| `20250909055320_change_event_venue_area_to_event_pricing_division` | copies legacy `event_venue_area` rows into `event_pricing_division`, idempotent per row |
| `20260824090000_backfill_event_financial_summary` | writes the eight `revenue_*`, `expenses_*`, `net_pnl_*`, `margin_percent_*` columns on each event, and only touches events whose figures differ so `updated_at` is preserved |

Migrations run on deploy; none needs an administrator action.

## Out of scope

- **Module install and version updates**: through the Insites console.
- **Roles**: per-instance access is the two CRM policies above.
- **Instance API key**: issued and rotated in IIA; the Events policy reads the same `instance_api_key` configuration the CRM policy reads.
