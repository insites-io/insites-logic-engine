# Pipelines - Configuration

What an instance administrator sets up in IIA for the pipelines module, and what the module seeds or migrates on install. Modules are preinstalled and updated through the Insites console. Deploying a working copy to a test instance is `insites-cli deploy <env>` from the repo's `pos/` directory.

Source: `pos/modules/insites_pipeline/` in module-v6-pipelines v6.0.2 (read 9 October 2026). Admin routes come from `vue/src/router/*.js` and the sidebar partial `private/views/partials/insites_menu/insites_pipeline_side_menu.liquid`.

---

## IIA admin paths

| What | IIA path |
|---|---|
| All opportunities (table view) | `<your-insites-instance>/admin/insites#/pipeline/opportunities` |
| Opportunity board | `<your-insites-instance>/admin/insites#/pipeline/opportunities/board` |
| Add an opportunity | `<your-insites-instance>/admin/insites#/pipeline/opportunities/add` |
| View an opportunity (tabs: details, related-contacts, tasks, event-stream, form-submissions) | `<your-insites-instance>/admin/insites#/pipeline/opportunities/:uuid` |
| Reports (tabs: all, open, won, lost, withdrawn opportunities) | `<your-insites-instance>/admin/insites#/pipeline/reports` |
| Custom fields | `<your-insites-instance>/admin/insites#/pipeline/custom-fields` |
| Edit a custom field | `<your-insites-instance>/admin/insites#/pipeline/custom-fields/:id/edit` |
| System fields (router tabs: division, lead-source, lost-reason; no won-reason tab is declared in `SystemFieldsRoute.js`) | `<your-insites-instance>/admin/insites#/pipeline/system-fields` |
| Pipelines ("Configuration") | `<your-insites-instance>/admin/insites#/pipeline/configuration` |
| Add a pipeline (tabs: details, stages, display-fields, webhooks) | `<your-insites-instance>/admin/insites#/pipeline/configuration/add` |
| Edit a pipeline (same tabs) | `<your-insites-instance>/admin/insites#/pipeline/configuration/:uuid/edit` |
| Global webhooks | `<your-insites-instance>/admin/insites#/pipeline/webhooks` |

The sidebar (`insites_pipeline_side_menu.liquid`) shows seven entries under "Pipelines": All Opportunities, Opportunity Board, Reports, Custom Fields, System Fields, Configuration, Webhooks.

Every admin JSON page the Vue app calls sits under `/insites/pipeline/...` (75 pages in `private/views/pages/api/`, excluding `_external`) and is gated by `modules/insites_crm/insites_only_allowed_by_administrators`. These are not for external callers; use the V2 API in [`api.md`](api.md).

---

## Pipelines and stages

A pipeline (`schema/pipeline.yml`) has a `name`, `status`, an optional sales target (`sales_target_value`, `sales_target_start_date`, `sales_target_end_date`) and two switches, `is_won_reason_required` and `is_lost_reason_required`, that make the admin form demand a reason when an opportunity is marked won or lost. Stages (`schema/pipeline_stage.yml`) belong to one pipeline and carry `background_colour`, `font_colour`, `empty_message` and `stage_weighting` (the board order).

Both can be managed in IIA under Configuration or through the V2 API. The `display-fields` tab writes `pipeline_display_field` rows (which fields show on a board card, per pipeline, per administrator); there is no API for those.

---

## Custom fields

Opportunity custom fields are **per pipeline**. Definitions are properties of one shared admin table created by migration (`modules/ins_pipeline/public/schema/pipeline_opportunity_custom_field.yml`); each property's `metadata.configuration_id` holds the uuid of the pipeline it belongs to, and `functions/pipelines/custom_fields/get_pipeline_custom_fields.liquid` filters on that. Values for one opportunity live in a single row of that table keyed by `opportunity_uuid`.

Definition `attribute_type` values the V2 write path understands (`controllers/_external/v2/opportunities/add_opportunity.liquid`): `string` (default), `integer`, `float`, `boolean`, `array`, `geojson`. The admin app also stores `upload` fields for media (noted in the repo's `CLAUDE.md`); the V2 controllers have no `upload` branch and write such a value as a plain string. `metadata.ui_element == 'select'` fields validate against `metadata.options`. `metadata.show_in_quick_view` controls the quick-view card.

Create and edit definitions in IIA at `#/pipeline/custom-fields` (admin pages `insites/pipeline/custom-fields` GET/POST/PUT, controllers `custom_fields/{get_fields,create,save,get_details}`). The V2 API only lists and deletes definitions.

Data-source custom fields (`custom_fields/data_sources/*` controllers) can point at CRM users or companies, or at a Data module database; `graphql/custom_fields/data_sources/get_data_sources.graphql` hides databases flagged `insites_databases_hidden`.

---

## System fields

One table, `pipeline_system_field`, holds every lookup value with a `system_field` group name. Groups the module seeds: `won_reason`, `lost_reason`, `division`, `lead_source`. Manage them at `#/pipeline/system-fields` or through `/pipeline/api/v2/system-fields`.

---

## Webhooks

Two scopes, both stored in `pipeline_webhook`:

| Scope | Where | Row shape |
|---|---|---|
| Per pipeline | Configuration → edit pipeline → webhooks tab | `pipeline_uuid` set, `is_global` absent |
| Global | `#/pipeline/webhooks` | `is_global: true` |

Each row names one `event_type`, a `webhook_url` and `is_webhook_enabled`. The six event types and which admin actions fire them are in [`api.md#webhooks`](api.md#webhooks). The admin pages are `insites/pipeline/pipelines/webhooks` (GET, POST, PUT). No V2 endpoint manages subscriptions.

---

## What install seeds or migrates

Four files under `private/migrations/`, run in timestamp order on install or update:

| Migration | Effect |
|---|---|
| `20240403102750_add_custom_field_schema.liquid` | Creates the admin table `modules/ins_pipeline/public/schema/pipeline_opportunity_custom_field.yml` with one property, `opportunity_uuid`; if the table already exists, adds `opportunity_uuid` when missing |
| `20240403102761_set_default_system_fields_pipeline.liquid` | Whole body is inside `{% comment %}`; it does nothing |
| `20240614102840_seed_pipeline_system_fields.liquid` | If the old-style system-field table is empty, seeds 39 values: 8 `won_reason`, 10 `lost_reason`, 10 `division`, 11 `lead_source`; otherwise deletes current `pipeline_system_field` rows and re-creates one per old row (`system_field` from `type`, `value` from `field_label`) |
| `20240918060100_migrate_activities.liquid` | Copies every `opportunity_activity` row into the CRM activity store via `opportunities/activities/add_activity`, adding `related_table: modules/insites_pipeline/opportunity` and `module: opportunity`, then `records_delete_all` on `opportunity_activity` when no copy failed |

So on a fresh instance you get the custom-field table and 39 system-field values. Pipelines, stages and opportunities are not seeded.

---

## Tests shipped with the module

`private/lib/test/` holds five test partials for the Tests module (`modules/insites_test`): `custom_fields/opportunity_custom_fields_api_test`, `opportunities/{activities_widened,export_referring_company,quick_select,referring_company}_test`. They run only when that module is installed. Browser tests live in the repo's `e2e/` (Playwright) and need a signed-in instance.

---

## Out of scope for this document

- **Module install and version updates**: Insites console.
- **Roles**: there are none; access is the instance API key (V2) or an administrator session (admin pages).
- **Auth**: [`../../api/authentication.md`](../../api/authentication.md).
