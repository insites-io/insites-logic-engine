# Pipelines - Gotchas

Edges visible in the module source (`modules/insites_pipeline/private/`, module-v6-pipelines v6.0.2, read 9 October 2026). Each entry: what bites, why, how to avoid.

---

## 1. The 82 long-form controllers return nothing to `{% function %}`

**Bites:** `{%- function deals = "modules/insites_pipeline/controllers/opportunities/get_opportunities" -%}` binds blank, and your page's `Content-Type` is now `application/json`.

**Why:** none of the 82 `modules/insites_pipeline/controllers/...` partials contains a `{% return %}` (grep on 9 October 2026). They print their JSON and call `modules/insites_crm/functions/insites_response_util` (67 includes), `insites_response_handler` (12) or an ungated `response_handler` (two files use the ecommerce copy, `modules/insites_ecommerce/functions/response_handler`), each of which runs `response_headers` and `response_status` unconditionally.

**Avoid:** call only the 25 short-form `pipeline/controller/...` aliases from Liquid. Those gate the handler on `context.params.format == 'json'` and return `data`.

---

## 2. Two custom-field controllers also return nothing on a page without `?format=json` when the id is bad

**Bites:** `pipeline/controller/custom_fields/delete` with an unknown `id` returns `{ "errors": "Custom field not found" }` and `status` 404, and on success returns the raw GraphQL `items` hash, not the resource.

**Why:** `delete_custom_field.liquid` is older than the opportunity controllers and never adopted the `code/status/message/type` error shape.

**Avoid:** treat an `errors` key of any type (string or array) as failure on these two endpoints.

---

## 3. Stages are `/pipelines/stages/:pipeline_uuid`, not `/pipelines/:uuid/stages`

**Bites:** the natural REST spelling returns 404 `resource_not_found_error` with a message telling you the other form.

**Why:** five "phantom" pages (`pipelines/phantom_stage_*.liquid`) claim the nested slugs and answer 404 on purpose (TW#26354968 in the changelog) so the platform does not route them to the single-pipeline pages.

**Avoid:** use `/pipeline/api/v2/pipelines/stages/<pipeline_uuid>[/<stage_uuid>]`.

---

## 4. Prefix is singular `/pipeline/`; three error bodies say `/pipelines/`

**Bites:** copying the `path` string out of a 400 from the opportunity list, opportunity read or pipeline read gives `/pipelines/api/v2/...`, which 404s.

**Why:** `get_opportunities.liquid`, `get_opportunity.liquid` and `get_pipeline.liquid` hard-code the plural into their 400 branches; every other branch uses `context.headers.REQUEST_URI`.

**Avoid:** never build a URL from an error body.

---

## 5. Custom-field definitions: read by opportunity uuid, delete by numeric id

**Bites:** `DELETE /custom-fields/opportunities/<uuid>` 404s; `GET /custom-fields/opportunities/<id>` 400s with `invalid_uuid_error`.

**Why:** `get_custom_fields.liquid` resolves the **opportunity** to find its pipeline, then lists definitions whose `metadata.configuration_id` equals that pipeline uuid. `delete_custom_field.liquid` works on the admin-table property `id`.

**Avoid:** read the list, keep each definition's `id`, delete with that.

---

## 6. `DELETE` on an opportunity is 204 with no body; every other delete is 200 with the raw record

**Bites:** a client that parses every delete response as JSON fails on the empty body (or, the other way round, expects an empty body and gets a record hash with `*_uuid` columns).

**Why:** `delete_opportunity.liquid` sets `status = 204, data = null` (TW#26099866); `delete_pipeline`, `delete_stage`, `delete_related_contact` and `delete_system_field` assign `results.items` straight through without `results_api`.

**Avoid:** branch on status, not on body shape.

---

## 7. The custom-field table is `modules/ins_pipeline/...`, not `modules/insites_pipeline/...`

**Bites:** a GraphQL query or `insites-cli` audit that assumes every pipelines table is under `modules/insites_pipeline/` cannot find the custom-field values.

**Why:** `migrations/20240403102750_add_custom_field_schema.liquid` creates the table at `modules/ins_pipeline/public/schema/pipeline_opportunity_custom_field.yml`; 26 files under `modules/insites_pipeline/` reference it by that path. The documentation partial `insites_api/external_api.liquid` advertises `modules/insites_pipeline/opportunity_custom_field` at `public/schema/opportunity_custom_field.yml`, and `opportunities/models/related_fields.liquid` names `modules/insites_pipeline/opportunity_custom_field`; neither of those tables is created anywhere in this tree. The same `external_api.liquid` lists the system-field table as `modules/insites_pipeline/system_fields` with file `system_fields.yml`; the real schema file is `pipeline_system_field.yml`.

**Avoid:** take table names from `schema/*.yml` and the migrations, not from the API-doc partials.

---

## 8. `won_reason` and `lost_reason` join tables that do not exist in `related_fields`

**Bites:** the `record_filter` helper, which reads `opportunities/models/related_fields.liquid`, is told `won_reason` lives in `modules/insites_pipeline/opportunity_won_reason` and `lost_reason` in `…/opportunity_lost_reason`. No schema or migration creates either table. Searching opportunities with `search_by=won_reason.value` cannot match.

**Why:** the GraphQL files resolve both from `pipeline_system_field`; the model partial was never updated.

**Avoid:** filter won/lost reasons client-side from the response, or sort by `won_reason.uuid` (mapped to the `won_reason_uuid` column via `payload_fields`).

---

## 9. Documentation defaults differ from controller defaults

**Bites:** code that relies on the advertised `sort_by: name, sort_order: ASC` gets `updated_at DESC`.

**Why:** the `*/object.liquid` doc partials carry the CRM defaults; the controllers set `updated_at`/`DESC` (`created_at` for system fields).

**Avoid:** always pass `sort_by` and `sort_order` explicitly.

---

## 10. Only the opportunity list caps `size`; the others do not

**Bites:** `GET /pipelines?size=100000` runs an unbounded `records` query; `GET /opportunities?size=100000` silently returns 100.

**Why:** `get_opportunities.liquid` applies `at_most: 100`; `get_pipelines`, `get_stages`, `get_related_contacts` and `get_system_fields` only do `plus: 0`.

**Avoid:** keep `size` at or below 100 everywhere.

---

## 11. `order.uuid` goes in, no `order` comes out

**Bites:** you set `order.uuid` on an opportunity and the response has no `order` key.

**Why:** `payload_fields.liquid` maps `order.uuid` to `order_uuid` and the schema stores it, but no file under `graphql/_external/v2/opportunities/` selects an `order` relation (the admin `get_details.liquid` and `functions/opportunities/get_opportunities.liquid` do, joining `modules/insites_ecommerce/order`).

**Avoid:** keep the order uuid on your side, or read it through the admin UI.

---

## 12. Create writes custom fields before the opportunity

**Bites:** a 400 `"The custom field values could not be saved."` means no opportunity exists, but a GraphQL failure on the opportunity write after a successful custom-field write leaves a custom-field row keyed by a uuid no opportunity has.

**Why:** `add_opportunity.liquid` generates the uuid, writes the custom-field record, then calls `add_opportunity.graphql`; there is no rollback.

**Avoid:** on a 400 from create, do not retry with the same custom-field values until you have checked for orphans in `modules/ins_pipeline/pipeline_opportunity_custom_field`.

---

## 13. No V2 write fires a webhook or an event-stream entry

**Bites:** a webhook subscriber configured for `opportunity_created` hears nothing when the record came through `POST /pipeline/api/v2/opportunities`; the opportunity's Event Stream tab in IIA stays empty for API-created records.

**Why:** `add_webhook_api_call` is called only from the nine admin controllers listed in [`api.md#webhooks`](api.md#webhooks); the 14 `functions/opportunities/histories/*` partials are included by admin and v1 controllers only.

**Avoid:** poll `updated_at`, or write through v1 for activities if the event-stream entry matters.

---

## 14. Three empty page files

**Bites:** `POST` or `PUT /pipeline/api/v1/webhooks` and `DELETE` on `views/pages/api/stages/delete.liquid` are zero-byte files. They declare no slug, so they route nowhere; the v1 webhook write endpoints the folder names imply do not exist.

**Avoid:** manage webhook subscriptions in IIA.

---

## 15. `DELETE …/related-contacts` is a 405 by design

**Bites:** an attempt to clear all related contacts at once returns `method_not_allowed_error`.

**Why:** `delete_related_contacts.liquid` exists only to answer 405 with the per-contact route in its message.

**Avoid:** list, then delete each link by its own uuid.

---

## 16. `custom_fields/list` and `custom_fields/delete` need `type: "opportunity"`

**Bites:** calling `pipeline/controller/custom_fields/list` from Liquid with only `opportunity_uuid` runs the admin-table lookup with a blank `table` and returns an empty `results`.

**Why:** both controllers only assign `table` inside `{% if type == 'opportunity' %}`; the V2 pages pass `type: "opportunity"` explicitly.

**Avoid:** pass `type: "opportunity"` on every call.

---

## 17. Two version strings in the tree disagree with the hook

**Bites:** `hook_module_info` says 6.0.2, the generated `insites_admin/insites_pipeline_dependencies.liquid` comment says v6.0.1, `CLAUDE.md` says v6.0.0.

**Why:** release tooling bumps the hook and the Vue `package.json` (both 6.0.2) but not the generated comment or the hand-written doc.

**Avoid:** read the git tag.
