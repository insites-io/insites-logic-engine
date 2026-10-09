# Pipelines - V2 REST API

The pipelines module exposes a V2 REST API at the `/pipeline/api/v2/...` prefix. It covers pipelines, pipeline stages, opportunities, opportunity related contacts, system fields and opportunity custom-field definitions.

Every page, controller and GraphQL file named here lives under `pos/modules/insites_pipeline/private/` in module-v6-pipelines v6.0.2, read on 9 October 2026. Pages are in `views/pages/api/_external/v2/`, controllers in `views/partials/controllers/_external/v2/`, and the API documentation data (title, params, example payload and response) in `views/partials/insites_api/external_api/`.

For authentication see [`../../api/authentication.md`](../../api/authentication.md). Send the raw instance API key in the `Authorization` header; there is no `Bearer` prefix.

---

## Surface at a glance

25 working endpoints across six resources, plus 8 stub pages (two `OPTIONS`, one 405, five 404).

| Method | Path | Operation | Controller alias |
|---|---|---|---|
| `POST` | `/pipeline/api/v2/pipelines` | Create a pipeline | `pipeline/controller/pipelines/create` |
| `GET` | `/pipeline/api/v2/pipelines` | List pipelines | `pipeline/controller/pipelines/list` |
| `GET` | `/pipeline/api/v2/pipelines/:uuid` | Read one pipeline | `pipeline/controller/pipelines/get` |
| `PATCH` | `/pipeline/api/v2/pipelines/:uuid` | Update a pipeline | `pipeline/controller/pipelines/update` |
| `DELETE` | `/pipeline/api/v2/pipelines/:uuid` | Delete a pipeline and everything in it | `pipeline/controller/pipelines/delete` |
| `POST` | `/pipeline/api/v2/pipelines/stages/:pipeline_uuid` | Create a stage | `pipeline/controller/stages/create` |
| `GET` | `/pipeline/api/v2/pipelines/stages/:pipeline_uuid` | List a pipeline's stages | `pipeline/controller/stages/list` |
| `PATCH` | `/pipeline/api/v2/pipelines/stages/:pipeline_uuid/:stage_uuid` | Update a stage | `pipeline/controller/stages/update` |
| `DELETE` | `/pipeline/api/v2/pipelines/stages/:pipeline_uuid/:stage_uuid` | Delete a stage | `pipeline/controller/stages/delete` |
| `POST` | `/pipeline/api/v2/opportunities` | Create an opportunity | `pipeline/controller/opportunities/create` |
| `GET` | `/pipeline/api/v2/opportunities` | List opportunities | `pipeline/controller/opportunities/list` |
| `GET` | `/pipeline/api/v2/opportunities/:uuid` | Read one opportunity | `pipeline/controller/opportunities/get` |
| `PATCH` | `/pipeline/api/v2/opportunities/:uuid` | Update an opportunity | `pipeline/controller/opportunities/update` |
| `DELETE` | `/pipeline/api/v2/opportunities/:uuid` | Delete an opportunity | `pipeline/controller/opportunities/delete` |
| `OPTIONS` | `/pipeline/api/v2/opportunities` | CORS preflight, `Allow: GET, POST, OPTIONS` | none (page only) |
| `OPTIONS` | `/pipeline/api/v2/opportunities/:uuid` | CORS preflight, `Allow: GET, PATCH, DELETE, OPTIONS` | none (page only) |
| `POST` | `/pipeline/api/v2/opportunities/:opportunity_uuid/related-contacts` | Link a contact | `pipeline/controller/related_contacts/create` |
| `GET` | `/pipeline/api/v2/opportunities/:opportunity_uuid/related-contacts` | List linked contacts | `pipeline/controller/related_contacts/list` |
| `PATCH` | `/pipeline/api/v2/opportunities/:opportunity_uuid/related-contacts/:uuid` | Update a link | `pipeline/controller/related_contacts/update` |
| `DELETE` | `/pipeline/api/v2/opportunities/:opportunity_uuid/related-contacts/:uuid` | Remove a link | `pipeline/controller/related_contacts/delete` |
| `DELETE` | `/pipeline/api/v2/opportunities/:opportunity_uuid/related-contacts` | Always 405 | none (page only) |
| `POST` | `/pipeline/api/v2/system-fields` | Create a system field value | `pipeline/controller/system_fields/create` |
| `GET` | `/pipeline/api/v2/system-fields` | List system field values | `pipeline/controller/system_fields/list` |
| `GET` | `/pipeline/api/v2/system-fields/:uuid` | Read one | `pipeline/controller/system_fields/get` |
| `PATCH` | `/pipeline/api/v2/system-fields/:uuid` | Update one | `pipeline/controller/system_fields/update` |
| `DELETE` | `/pipeline/api/v2/system-fields/:uuid` | Delete one | `pipeline/controller/system_fields/delete` |
| `GET` | `/pipeline/api/v2/custom-fields/opportunities/:uuid` | List custom-field definitions for an opportunity's pipeline | `pipeline/controller/custom_fields/list` |
| `DELETE` | `/pipeline/api/v2/custom-fields/opportunities/:id` | Delete a custom-field definition by numeric id | `pipeline/controller/custom_fields/delete` |

The five phantom routes `GET`/`POST /pipeline/api/v2/pipelines/:pipeline_uuid/stages` and `GET`/`PATCH`/`DELETE /pipeline/api/v2/pipelines/:pipeline_uuid/stages/:stage_uuid` (`pipelines/phantom_stage_*.liquid`) exist so that the nested spelling answers a 404 with a message pointing at the `/pipelines/stages/{pipeline_uuid}` form instead of falling through to another page.

Every `controller_name` in the 25 documentation partials under `insites_api/external_api/` matches a declared alias; none is missing (checked against the `path:` front matter of all 25 V2 controllers on 9 October 2026).

---

## Conventions

### Auth guard

All 31 non-`OPTIONS` pages declare `authorization_policies: [modules/insites_crm/has_valid_instance_api_authorization]` in front matter. The policy (`modules/insites_crm/private/authorization_policies/has_valid_instance_api_authorization.liquid`) reads the instance API key from instance configuration and compares it with `context.headers.HTTP_AUTHORIZATION`; on failure it redirects to `api/401`. There is no inline `api_key_guard` in this module. The two `OPTIONS` pages carry no policy.

### Layout and `format=json`

Every V2 page sets `layout: modules/insites_crm/json` and `format: json`. Each controller gates its call to `modules/insites_crm/functions/response_handler` on `context.params.format == 'json'`, so over HTTP you must send `?format=json` (or a `format=json` body field) to receive the status code the controller computed. Without it the body is still the JSON the controller built, but the HTTP status is whatever the platform defaulted to. Same rule as CRM and Data.

### Identifiers

Pipelines, stages, opportunities, related contacts and system fields are addressed by `uuid` (36 characters, 5 dash-separated groups). Three opportunity controllers (`get`, `update`, `delete`) validate the format first and return `400 invalid_uuid_error` on a malformed value; the others resolve the uuid through `modules/insites_crm/functions/get_id` and return 404 when nothing matches. Custom-field **definitions** are the exception: `DELETE /custom-fields/opportunities/:id` takes the numeric property `id` returned by the list endpoint.

### Request body and dotted keys

Bodies are JSON (form-encoded params also arrive via `context.params`). Related records are referenced with dotted keys that `modules/insites_crm/functions/_external/payload_api` folds into the stored `_uuid` column using each resource's `models/payload_fields.liquid`:

| Resource | Dotted keys accepted |
|---|---|
| Opportunity | `pipeline.uuid`, `stage.uuid`, `contact.uuid`, `company.uuid`, `owner.uuid`, `lead_source.uuid`, `lead_referred_by.uuid`, `lead_referred_by_company.uuid`, `division.uuid`, `administrator.uuid`, `last_updated_by_administrator.uuid`, `won_reason.uuid`, `lost_reason.uuid`, `order.uuid` |
| Related contact | `contact.uuid` |
| Pipeline, stage, system field, custom field | none (`payload_fields` is `{}`) |

Opportunity custom-field values are sent either as flat `custom_field.<name>` keys or as a nested `custom_field` object; `add_opportunity.liquid` and `update_opportunity.liquid` read both (a code comment there records that the nested form used to write nothing).

### Response shapes

Success returns the resource (or a list envelope) at the top level. Related records come back nested, inflated by `modules/insites_crm/functions/_external/results_api`. The opportunity's `custom_field` object is flattened from the custom-field record's `properties`, with `opportunity_uuid` removed, then filtered to the fields whose `metadata.configuration_id` equals the opportunity's pipeline uuid (`functions/pipelines/custom_fields/get_pipeline_custom_fields.liquid`).

List envelope, from `results_api`:

```json
{ "total_entries": 1, "total_pages": 1, "page": 1, "size": 10, "results": [ ] }
```

### Common list query parameters

| Param | Default in controller | Notes |
|---|---|---|
| `page` | `1` | `at_least: 1` |
| `size` | `10` | Opportunities list caps at 100 (`at_most: 100`); the other lists do not cap |
| `sort_by` | `updated_at` (`created_at` for system fields) | `created_at`/`updated_at` sort on the system column; anything else sorts on a property of that name |
| `sort_order` | `DESC` | upcased |
| `search_by` | `name` (opportunities, pipelines, stages), `relationship` (related contacts), `value` (system fields) | |
| `keyword` | none | passed to `modules/insites_crm/functions/_external/record_filter` |

The documentation partials (`*/object.liquid`) advertise `sort_by` default `name` and `sort_order` default `ASC`; the controllers use `updated_at` and `DESC`. Trust the controller.

### Error shape

Controllers build errors as:

```json
{ "code": "404", "status": "Not Found", "message": "…", "type": "resource_not_found_error",
  "details": { "requested_uuid": "…", "resource_type": "Opportunity" },
  "timestamp": "2026-10-09T00:00:00Z", "path": "/pipeline/api/v2/opportunities/…" }
```

`type` values seen in source: `invalid_request_error` (400, carries an `errors` array from GraphQL), `invalid_uuid_error` (400), `resource_not_found_error` (404), `validation_error` (422, `errors: [{field, message}]`), `duplicate_resource_error` (409), `method_not_allowed_error` (405). The two custom-field controllers differ: they return `{ "errors": "Custom field not found" }` (string) on 404 and raw GraphQL `errors` on failure. Treat any non-2xx or any body with `errors` as failure.

### Response headers

`response_handler` sets `Content-Type: application/json`, `Strict-Transport-Security: max-age=31536000; includeSubDomains` and `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`, and prints no body on 204.

---

## Resources

### Pipelines

Pages: `pipelines/{add,get,get_pipelines,update,delete}_pipeline.liquid`. GraphQL: `graphql/_external/v2/pipelines/*.graphql`. Documentation: `insites_api/external_api/pipelines/*.liquid`.

**Fields** (`schema/pipeline.yml`, labels from `pipelines/object.liquid`): `uuid`, `name`, `status` (`active`, `inactive`, `archived`), `sales_target_value` (integer), `sales_target_start_date`, `sales_target_end_date` (date), `is_won_reason_required`, `is_lost_reason_required` (boolean). Responses add `id`, `created_at`, `updated_at` and a `stages` array (`uuid`, `name`, `background_colour`, `font_colour`, `empty_message`, `stage_weighting`) joined through `pipelines/models/related_fields.liquid`.

**Required on create** per the documentation partial: `name`, `status`. The controller itself validates nothing before calling `add_pipeline.graphql`; a GraphQL error becomes a 400.

| Operation | Status on success | Errors |
|---|---|---|
| `POST /pipelines` | 200, the pipeline | 400 |
| `GET /pipelines` | 200, list envelope | 400 |
| `GET /pipelines/:uuid` | 200, the pipeline | 400, 404 |
| `PATCH /pipelines/:uuid` | 200, the pipeline | 400, 404 |
| `DELETE /pipelines/:uuid` | 200, the deleted record as GraphQL returned it (not inflated) | 400, 404 |

`delete_pipeline.liquid` cascades in order: fetch the pipeline's opportunity uuids (`opportunities/get_opportunities_uuid`, `per_page: 1000`), delete their activities, delete their custom-field data, delete the opportunities, delete the stages, then delete the pipeline. Nothing is archived.

Example from `pipelines/add_pipeline.liquid` documentation partial:

```http
POST /pipeline/api/v2/pipelines?format=json HTTP/1.1
Authorization: <instance api key>
Content-Type: application/json

{ "name": "Mid-Market Sales", "status": "active", "sales_target_value": 250000,
  "sales_target_start_date": "2025-01-01", "sales_target_end_date": "2025-12-31",
  "is_won_reason_required": true, "is_lost_reason_required": false }
```

```json
{ "id": "1004", "uuid": "d4e5f6a7-…", "name": "Mid-Market Sales", "status": "active",
  "sales_target_value": 250000, "sales_target_start_date": "2025-01-01",
  "sales_target_end_date": "2025-12-31", "is_won_reason_required": true,
  "is_lost_reason_required": false, "stages": [],
  "created_at": "2025-06-13T10:15:20.000Z", "updated_at": "2025-06-13T10:15:20.000Z" }
```

### Pipeline stages

Pages: `pipelines/stages/{add,get_stages,update,delete}_stage.liquid`. The pipeline uuid is a path segment **before** the resource word: `/pipelines/stages/:pipeline_uuid[/:stage_uuid]`.

**Fields** (`schema/pipeline_stage.yml`): `uuid`, `name`, `background_colour`, `font_colour`, `empty_message`, `pipeline_uuid`, `stage_weighting` (integer, orders stages). Responses nest `pipeline: {id, uuid, name}`.

**Required on create** per documentation: `name`. The controller sets `pipeline_uuid` from the path and does not validate the body.

| Operation | Success | Errors |
|---|---|---|
| `POST /pipelines/stages/:pipeline_uuid` | 200, the stage | 400; 404 when the pipeline uuid does not resolve |
| `GET /pipelines/stages/:pipeline_uuid` | 200, list envelope filtered on `pipeline_uuid` | 400, 404 (pipeline) |
| `PATCH /pipelines/stages/:pipeline_uuid/:stage_uuid` | 200, the stage | 400; 404 names whichever of pipeline or stage failed to resolve |
| `DELETE /pipelines/stages/:pipeline_uuid/:stage_uuid` | 200, raw GraphQL record | 400, 404 |

There is no `GET` for a single stage; read the pipeline and pick from `stages`.

### Opportunities

Pages: `opportunities/{add,get,get_opportunities,update,delete}_opportunity.liquid` plus `get_option.liquid` and `get_options.liquid` (`OPTIONS`). GraphQL: `graphql/_external/v2/opportunities/*.graphql`.

**Fields** (`schema/opportunity.yml`): `uuid`, `name`, `status` (`open`, `won`, `lost`; defaults to `open` on create), `probability` (string), `value` (string), `target_conversion_date` (date), `database_item_id`, `opportunity_weighting` (integer, default 0, admin board order), plus the `*_uuid` columns the dotted keys above fill. The response from `get_opportunity.graphql` nests `pipeline`, `stage`, `contact` (a platform user joined on `external_id`; includes `email_2` and CRM profile phone numbers), `company` (filtered to `is_archived: false`), `owner`, `division`, `lead_source`, `won_reason`, `lost_reason` (all four read from `pipeline_system_field`), `lead_referred_by`, `lead_referred_by_company`, `related_contacts[]` and `custom_field`. `order.uuid` is accepted on input but no V2 GraphQL file returns an `order` object.

**Required on create** per documentation: `name`, `pipeline.uuid`, `stage.uuid`, `status`. `add_opportunity.liquid` enforces in code: `status` in `open,won,lost` (422), `pipeline.uuid` resolves (422 `pipeline_uuid`), `stage.uuid` resolves (422 `stage_uuid`). It does not check `name`.

**Custom-field handling on create and update.** The controller loads the field definitions from the `modules/ins_pipeline/public/schema/pipeline_opportunity_custom_field.yml` table, then for each defined field coerces the supplied value by `attribute_type`: `integer` to `value_int`, `float` to `value_float`, `boolean` to `value_boolean` (only the literals `true`/`false`), `array` to `value_array` (parsed JSON), `geojson` to `value_json` (parsed JSON; an unparsable non-blank value is a 422), everything else to `value`. A `select` field (`metadata.ui_element == 'select'`) whose value is not in `metadata.options` is a 422. On create every defined field is written (missing ones as null); on update only the keys you sent are written. The custom-field record is written **before** the opportunity, and a custom-field GraphQL error returns 400 `"The custom field values could not be saved."` with no opportunity write.

| Operation | Success | Errors |
|---|---|---|
| `POST /opportunities` | 200, the opportunity | 400, 422 |
| `GET /opportunities` | 200, list envelope | 400 |
| `GET /opportunities/:uuid` | 200, the opportunity | 400 (`invalid_uuid_error` or GraphQL), 404 |
| `PATCH /opportunities/:uuid` | 200, the opportunity | 400, 404, 422 |
| `DELETE /opportunities/:uuid` | **204, empty body** | 400, 404 |

**List filters** beyond the common parameters (`get_opportunities.liquid`): `status`, `stage.uuid`, `owner.uuid` are added as property filters when present. Sorting on a dotted key maps through `payload_fields` (so `sort_by=stage.uuid` sorts on `stage_uuid`).

Example from the `add_opportunity` documentation partial (abridged):

```http
POST /pipeline/api/v2/opportunities?format=json HTTP/1.1
Authorization: <instance api key>
Content-Type: application/json

{ "name": "New Enterprise Deal", "pipeline.uuid": "a1b2c3d4-…", "stage.uuid": "a1b2c3d4-…91",
  "owner.uuid": "b2c3d4e5-…", "contact.uuid": "d3e4f5a6-…", "company.uuid": "e4f5a6b7-…",
  "target_conversion_date": "2025-10-15", "probability": "60", "value": "150000",
  "status": "open", "custom_field.field_1": "Custom value 1" }
```

```json
{ "id": "3003", "uuid": "e5f6a7b8-…", "name": "New Enterprise Deal", "status": "open",
  "probability": "60", "value": "150000", "target_conversion_date": "2025-10-15",
  "database_item_id": null,
  "pipeline": { "id": "101", "uuid": "a1b2c3d4-…", "name": "Enterprise Sales" },
  "stage":    { "id": "202", "uuid": "a1b2c3d4-…91", "name": "Qualification" },
  "contact":  { "id": "401", "uuid": "d3e4f5a6-…", "name": "John Doe", "email": "john.doe@example.com" },
  "company":  { "id": "501", "uuid": "e4f5a6b7-…", "company_name": "Acme Corporation" },
  "owner":    { "id": "601", "uuid": "b2c3d4e5-…", "name": "Jane Smith", "email": "owner@example.com" },
  "division": null, "lead_source": { "id": "801", "uuid": "f5a6b7c8-…", "value": "Email Marketing" },
  "lead_referred_by": null, "lead_referred_by_company": null, "won_reason": null, "lost_reason": null,
  "related_contacts": [], "custom_field": null,
  "created_at": "2025-06-13T14:30:00.000Z", "updated_at": "2025-06-13T14:30:00.000Z" }
```

### Opportunity related contacts

Pages: `opportunities/related_contacts/{add,get_related_contacts,update,delete}_related_contact.liquid` plus `delete_related_contacts.liquid` (collection `DELETE`, always 405).

**Fields** (`schema/opportunity_related_contact.yml`): `uuid`, `opportunity_uuid`, `contact_uuid`, `relationship` (free text). Input key for the contact is `contact.uuid`. Responses nest `opportunity {name}` and `contact {name, email}` per `related_contacts/models/related_fields.liquid`.

| Operation | Success | Errors |
|---|---|---|
| `POST …/related-contacts` | 200, the link | 404 (opportunity), **409** `duplicate_resource_error` when the same contact is already linked (`get_related_contact_exists.graphql`), 400 |
| `GET …/related-contacts` | 200, list envelope filtered on `opportunity_uuid` | 404, 400 |
| `PATCH …/related-contacts/:uuid` | 200, the link | 404 (names opportunity or related contact), 400 |
| `DELETE …/related-contacts/:uuid` | 200, raw GraphQL record | 404, 400 |
| `DELETE …/related-contacts` | 405 with a message naming the per-contact route | |

### System fields

Pages: `system_fields/{add,get,get_system_fields,edit,delete}_system_field.liquid`. GraphQL: `graphql/_external/v2/system_fields/*.graphql`. Table: `pipeline_system_field` (`schema/pipeline_system_field.yml`): `uuid`, `system_field`, `value`.

`system_field` is the group name. The seed migration uses exactly four: `won_reason`, `lost_reason`, `division`, `lead_source`. The controller accepts any string; nothing validates the group name.

| Operation | Body | Success | Errors |
|---|---|---|---|
| `POST /system-fields` | `value`, `system_field` (both required per documentation; the controller passes them straight to GraphQL) | 200, raw GraphQL record | 400 |
| `GET /system-fields` | common list params; default `search_by=value`, `sort_by=created_at` | 200, list envelope | 400 |
| `GET /system-fields/:uuid` | | 200, raw record | 404, 400 |
| `PATCH /system-fields/:uuid` | `value` and/or `system_field`; a key you omit keeps its current value (`edit_system_field.liquid` reads the current record first) | 200, raw record | 404, 400 |
| `DELETE /system-fields/:uuid` | | 200, raw record | 404, 400 |

The create, read, update and delete responses are the GraphQL `items` object as returned, not passed through `results_api`; the documentation partial's examples omit `id`, `uuid` and timestamps and carry trailing commas (`system_fields/*.liquid`), so do not parse those examples as literal JSON.

### Opportunity custom fields (definitions)

Pages: `opportunity_custom_fields/get_custom_fields.liquid` (`GET /custom-fields/opportunities/:uuid`) and `delete_custom_field.liquid` (`DELETE /custom-fields/opportunities/:id`). Both include the controller with `type: "opportunity"`; the controller maps that to the `modules/ins_pipeline/public/schema/pipeline_opportunity_custom_field.yml` table and does nothing for any other `type`.

- `GET` takes an **opportunity** uuid, validates the format (400), resolves the opportunity's pipeline (404 if none), then returns `{ "results": [ … ] }` with each property's `id`, `name`, `attribute_type`, `metadata` (`label`, `weight`, `ui_element`, `options`, `configuration_id`, `show_in_quick_view`), `options`, `belongs_to`, filtered to `metadata.configuration_id == <pipeline uuid>` and excluding `opportunity_uuid`.
- `DELETE` takes the numeric property `id` from that list, marks the property `_destroy: "1"` and re-saves the whole table through `save_custom_fields.graphql`. Returns the GraphQL `items` on 200, `{ "errors": "Custom field not found" }` on 404.

There is no V2 endpoint to create or update a definition; that is admin-only (`#/pipeline/custom-fields`, see [`configuration.md`](configuration.md)).

---

## Webhooks

Subscriptions are rows in `modules/insites_pipeline/pipeline_webhook` (`schema/pipeline_webhook.yml`): `uuid`, `event_type`, `webhook_url`, `is_webhook_enabled`, `payload_schema`, `pipeline_uuid`, `is_global`. Delivery is `api_calls/webhooks/send_webhook.liquid`: a `POST` to `webhook_url` with `Content-Type: application/json` and the record's `properties` hash as the body, sent through `graphql/pipelines/webhooks/add_webhook_api_call.graphql`.

Each firing controller looks up two rows and sends to each that is enabled: the pipeline-scoped row (`get_pipeline_webhook.graphql`: matching `pipeline_uuid` + `event_type`, `is_global` absent) and the global row (`get_global_webhook.graphql`: `is_global: true` + `event_type`). Only the first matching row of each kind is used (`results[0]`).

| Event type | Fired by (admin controller alias) |
|---|---|
| `opportunity_created` | `modules/insites_pipeline/controllers/opportunities/add` |
| `opportunity_updated` | `…/opportunities/edit`, `…/opportunities/modify`, `…/opportunities/stage/modify` |
| `opportunity_deleted` | `…/opportunities/remove` |
| `pipeline_created` | `…/pipelines/add` |
| `pipeline_updated` | `…/pipelines/edit`, `…/pipelines/update_status` |
| `pipeline_deleted` | `…/pipelines/remove` |

**No V2 REST endpoint fires a webhook.** A `POST /pipeline/api/v2/opportunities` creates the record silently. The payload is the raw `properties` hash (`*_uuid` columns, not the inflated API shape). The v1 `GET /pipeline/api/v1/webhooks?pipeline_uuid=…` page lists a pipeline's subscriptions; its `POST` and `PUT` page files are empty.

---

## Legacy v1 (not documented further)

`views/pages/api/_external/{opportunities,pipelines,webhooks}/` declare `pipeline/api/v1/opportunities` (GET/POST/PUT/DELETE, plus PATCH at `opportunities-status`), `pipeline/api/v1/opportunities-activities` (GET/POST/PUT/DELETE), `pipeline/api/v1/configuration` (pipelines; GET/POST/PUT/PATCH/DELETE) and `pipeline/api/v1/webhooks` (GET). Same policy as V2. They respond through `insites_response_util` with status 200 or 400 only. Activities have no V2 equivalent in this module; the v1 activity endpoints are the only REST path to them.

---

## Notes for the LLM consumer

- URL prefix is `/pipeline/api/v2/` (singular). Three controllers hard-code `"/pipelines/api/v2/…"` (plural) into the error `path` field; that string is informational only.
- Stages hang off `/pipelines/stages/:pipeline_uuid`, not `/pipelines/:uuid/stages`; the nested form is a deliberate 404.
- `DELETE` on an opportunity is 204 with no body; every other delete is 200 with the raw record.
- Custom-field **values** go on the opportunity body; custom-field **definitions** are read with an opportunity uuid and deleted with a numeric id.
- Always send `?format=json`.
