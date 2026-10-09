# Pipelines - Advanced

Hooks, partials other modules may render, cross-module dependencies and the places where behaviour can be changed. Read from `pos/modules/insites_pipeline/` in module-v6-pipelines v6.0.2 on 9 October 2026.

---

## Module detection: `hook_module_info`

The only public partial the module ships is `public/views/partials/lib/hooks/hook_module_info.liquid`, callable as `modules/insites_pipeline/lib/hooks/hook_module_info`. It asks CRM for its own registration (`modules/insites_crm/hook/get_implementations` with `hook: "/hook_module_info", machine_name: "insites_pipeline"`) to fill `updated_at`, then returns:

```json
{ "name": "Insites Pipeline", "machine_name": "insites_pipeline", "type": "module",
  "version": "6.0.2", "updated_at": "<timestamp>", "slug": "pipeline", "label": "Pipeline" }
```

Use it for "is pipelines installed". Do not override it.

Everything else lives under `private/`, so nothing else is shadowable from an app.

---

## Partials other modules or an app may call

The 60 internal aliases are listed in [`../../building-on-insites/reference/alias-inventory.md`](../../building-on-insites/reference/alias-inventory.md). Three groups are worth knowing:

| Group | Aliases | What they are |
|---|---|---|
| Functions | `modules/insites_pipeline/functions/...` (22) | Helpers the controllers share: `opportunities/get_opportunities` (the admin list query builder, joins ecommerce orders), `pipelines/custom_fields/get_pipeline_custom_fields` (definitions for one pipeline; pass `destroy_all: true` to mark them all `_destroy`), `database_items/get_details` (reads a Data module item), `generate_advanced_filters`, `generate_advanced_custom_filters`, `export_custom_fields_mapper`, `custom_fields/get_custom_field`, and 14 `opportunities/histories/*` partials that post event-stream entries |
| GraphQL wrappers | `modules/insites_pipeline/graphql/custom_fields/data_sources/{get_databases,get_selected_databases}` | Inline GraphQL in Liquid because the query needs a dynamic fragment |
| API doc data | `modules/insites_pipeline/insites_api/external_api` and 35 partials under it | What the IIA API reference page renders: resource list, per-endpoint `title`, `controller_name`, `params`, `example_payload`, `example_response`, and per-resource `object` field lists (`pipelines`, `pipeline_stages`, `opportunities`, `opportunity_related_contacts`, `system_fields`, `opportunity_custom_fields`, plus `won_reasons`, `lost_reasons`, `custom_fields_opportunities` objects that no endpoint entry references) |
| Schema | `modules/insites_pipeline/schema/opportunity` | A JSON description of the opportunity table with labels and `belongs_to` hints, used by the admin app |

None of these has a published contract. The `histories/*` partials **write** (they `api_call_send` to the event stream and read the current administrator), and `get_pipeline_custom_fields` prints its result rather than returning it (`{{ _results }}`; callers wrap it in `parse_json`). Build on the 25 short-form controllers; reach for these only when you accept that a module update can change them.

---

## Cross-module dependencies

Counted by grepping `modules/<name>/` references across `private/` on 9 October 2026.

### CRM (`modules/insites_crm/`): required, 575 references

Every page layout (`modules/insites_crm/json`), both authorization policies (`has_valid_instance_api_authorization` on the 31 API pages, `insites_only_allowed_by_administrators` on the 74 admin pages), the response helpers (`response_handler`, `insites_response_util`, `insites_response_handler`), the V2 helpers (`functions/get_id`, `functions/_external/{payload_api,results_api,record_filter}`, `functions/generate_sort`), `users/get_current_user` (29 uses: every admin write stamps `administrator_uuid`), `functions/event_stream/get_api_key` (15 uses, the histories partials), and four tables the module joins or writes: `crm_company` (46), `activity` (15), `attachment` (12), `task` (11), plus `crm_contact`, `lead_source`, `division`, `insites_company`. Opportunity activities and tasks are **stored in CRM's `activity` and `task` tables**, not in pipelines' own `opportunity_activity` (which the 2024-09-18 migration empties).

Pipelines v6.0.2 references `insites_crm` only; the `insites_core` name was removed in TW#26796156 (changelog, v6.0.2).

### Ecommerce (`modules/insites_ecommerce/`): optional at runtime, required by two admin controllers, 13 references

Seven GraphQL files and `functions/opportunities/get_opportunities.liquid` join `modules/insites_ecommerce/order` on `order_uuid` (a missing table makes the join return null, not an error). Three Liquid includes are hard dependencies: `controllers/opportunities/order/get_orders.liquid` includes `modules/insites_ecommerce/functions/orders/get_orders`; `controllers/opportunities/related_contacts/get_related_contacts.liquid` calls `modules/insites_ecommerce/functions/generate_sort`; and `controllers/{opportunities,pipelines}/columns/update_columns.liquid` include `modules/insites_ecommerce/functions/response_handler`. On an instance without ecommerce those three admin endpoints fail with partial-not-found. The V2 API has no ecommerce dependency.

### Data (`modules/insites_databases/`): optional, 3 references

`functions/database_items/get_details.liquid` calls `modules/insites_databases/database_items/get_database_item` and `databases/get_database` to resolve data-source custom fields; `graphql/custom_fields/data_sources/get_data_sources.graphql` filters on `insites_databases_hidden`. Only reached when a custom field points at a database.

### Tests (`modules/insites_test/`): optional, 31 references, all in `private/lib/test/`

### Platform users

Contacts, owners, referrers and administrators are platform `users` joined on `external_id` (`related_user` in every opportunity query). There is no pipelines-owned contact table.

---

## Outbound calls

Three `api_calls/` templates:

| Template | Called as | Target |
|---|---|---|
| `api_calls/webhooks/send_webhook.liquid` | `api_call_send(template: "modules/insites_pipeline/send_webhook")` from `graphql/pipelines/webhooks/add_webhook_api_call.graphql` | `POST data.webhook_url` with `data.payload` |
| `api_calls/event_stream/add_event.liquid` | `graphql/opportunities/histories/add_history.graphql` | `POST https://api.insites.io/v1/events` with the Insites event-stream key from CRM |
| `api_calls/event_stream/get_events.liquid` | `graphql/opportunities/histories/get_histories.graphql` | `GET https://api.insites.io/v1/events{params}` |

The event-stream host is hard-coded in both templates. There is no `notifications/` directory in this module; it sends no email.

---

## Override points

- **Webhook subscriptions** are data (`pipeline_webhook` rows), so an integration changes delivery by editing rows in IIA, not code. The payload is the raw `properties` hash; `payload_schema` is stored but no controller reads it.
- **Custom fields** are the supported way to add data to an opportunity. The definitions live in one admin table keyed by `metadata.configuration_id`; `get_pipeline_custom_fields` is the single filter point.
- **Board card content** is `pipeline_display_field` rows per pipeline per administrator; **table columns** are `opportunity_column` rows per administrator; **saved filters** are `opportunity_filter`, `opportunity_search` and `opportunity_report_filters` rows. All admin-only, all per-user.
- **Status vocabulary** is fixed in code: opportunities `open`, `won`, `lost` (`add_opportunity.liquid`, `valid_statuses`); pipelines `active`, `inactive`, `archived` (documentation partial; the controller does not validate it). The admin app also uses "withdrawn" in its reports routes (`vue/src/router/ReportsRoute.js`, `withdrawn-opportunities`); no V2 controller accepts it.

## What is intentionally not extensible

- **Schema**: the thirteen YAML files are fixed; a module update overwrites them.
- **Endpoint set**: you cannot add pages under `/pipeline/api/v2/` from an app.
- **Webhook event set**: six names, hard-coded at the call sites.
- **Auth**: instance API key for V2, administrator session for admin pages; nothing per user or per scope.
