# Pipelines - Patterns

Worked examples against the V2 REST API and the matching in-Liquid controller calls. Conventions (auth header, `?format=json`, dotted keys, list envelope, error shape) are in [`api.md`](api.md). The curl examples set `Authorization` to the raw instance API key; replace `<key>` and `<host>`.

Controller facts below were checked in `pos/modules/insites_pipeline/private/views/partials/controllers/_external/v2/` (module-v6-pipelines v6.0.2, 9 October 2026): all 25 short-form `pipeline/controller/...` aliases gate their response handler on `context.params.format == 'json'` and end with `{% return data %}`. So a `{% function %}` call binds the same object the HTTP endpoint would serialise, and your page's headers are untouched unless the request itself carried `format=json`. Read [`../../building-on-insites/02-calling-a-controller.md`](../../building-on-insites/02-calling-a-controller.md) before copying these onto an HTML page.

---

## 1. Create a pipeline, then its stages

```bash
curl -s -X POST "https://<host>/pipeline/api/v2/pipelines?format=json" \
  -H "Authorization: <key>" -H "Content-Type: application/json" \
  -d '{"name":"Enterprise Sales","status":"active","is_won_reason_required":true}'
```

Take `uuid` from the response, then add stages in weighting order:

```bash
curl -s -X POST "https://<host>/pipeline/api/v2/pipelines/stages/<pipeline_uuid>?format=json" \
  -H "Authorization: <key>" -H "Content-Type: application/json" \
  -d '{"name":"Qualification","background_colour":"#2147de","stage_weighting":1}'
```

The stage response nests `pipeline: {id, uuid, name}`. `GET /pipeline/api/v2/pipelines/<pipeline_uuid>` returns the pipeline with its `stages` array, which is the only way to read one stage.

In Liquid:

```liquid
{%- parse_json body -%}{ "name": "Enterprise Sales", "status": "active" }{%- endparse_json -%}
{%- function pipeline = "pipeline/controller/pipelines/create", params: body -%}
{%- parse_json stage_body -%}{ "name": "Qualification", "stage_weighting": 1 }{%- endparse_json -%}
{%- function stage = "pipeline/controller/stages/create", params: stage_body, pipeline_uuid: pipeline.uuid -%}
```

`stages/create` reads `pipeline_uuid` from its argument first and falls back to `context.params.pipeline_uuid` (`add_stage.liquid`).

---

## 2. Create an opportunity with custom-field values

`status`, `pipeline.uuid` and `stage.uuid` are validated in code; a bad one is a 422 with `errors: [{field, message}]` and nothing written.

```bash
curl -s -X POST "https://<host>/pipeline/api/v2/opportunities?format=json" \
  -H "Authorization: <key>" -H "Content-Type: application/json" \
  -d '{
    "name": "New Enterprise Deal",
    "pipeline.uuid": "<pipeline_uuid>",
    "stage.uuid": "<stage_uuid>",
    "contact.uuid": "<crm contact uuid>",
    "company.uuid": "<crm company uuid>",
    "value": "150000",
    "probability": "60",
    "status": "open",
    "custom_field.priority_level": "High"
  }'
```

`custom_field.<name>` keys are matched against the pipeline's definitions; a `select` field with a value outside `metadata.options` is a 422, an integer field is coerced with `plus: 0`. The response's `custom_field` object only contains fields defined for this opportunity's pipeline.

In Liquid:

```liquid
{%- function opportunity = "pipeline/controller/opportunities/create", params: body -%}
{%- if opportunity.code -%}
  {{ opportunity.message }}
{%- else -%}
  {{ opportunity.uuid }}
{%- endif -%}
```

Error objects carry `code`; success objects do not. Test on that rather than on blankness.

---

## 3. Move an opportunity to a stage, mark it won

Update is a `PATCH` with only the keys you change. Custom-field keys you omit keep their stored values (`update_opportunity.liquid` only writes `properties_keys contains field.name`).

```bash
curl -s -X PATCH "https://<host>/pipeline/api/v2/opportunities/<uuid>?format=json" \
  -H "Authorization: <key>" -H "Content-Type: application/json" \
  -d '{"stage.uuid":"<closed stage uuid>","status":"won","won_reason.uuid":"<system field uuid>"}'
```

Find the `won_reason.uuid` first:

```bash
curl -s "https://<host>/pipeline/api/v2/system-fields?search_by=system_field&keyword=won_reason&size=50&format=json" \
  -H "Authorization: <key>"
```

Nothing in the V2 controller enforces the pipeline's `is_won_reason_required`; that switch is read by the admin form. Enforce it client-side if your integration needs it. No webhook fires for this update; only the admin controllers send webhooks.

---

## 4. List open opportunities for one stage, paginated

```bash
curl -s "https://<host>/pipeline/api/v2/opportunities?status=open&stage.uuid=<stage_uuid>&page=1&size=100&sort_by=updated_at&sort_order=DESC&format=json" \
  -H "Authorization: <key>"
```

`size` is capped at 100 on this endpoint (`get_opportunities.liquid`: `at_most: 100`). Loop `page` up to `total_pages`. `owner.uuid` is the third filter the controller recognises.

In Liquid, build the argument hash yourself so a visitor cannot append `?format=json` to your HTML page and flip its `Content-Type`:

```liquid
{%- parse_json query -%}
  { "status": "open", "stage.uuid": "<stage_uuid>", "page": 1, "size": 100 }
{%- endparse_json -%}
{%- function open_deals = "pipeline/controller/opportunities/list", params: query -%}
{{ open_deals.total_entries }} open
{%- for deal in open_deals.results -%}
  {{ deal.name }} ({{ deal.stage.name }})
{%- endfor -%}
```

---

## 5. Attach a second contact to an opportunity

```bash
curl -s -X POST "https://<host>/pipeline/api/v2/opportunities/<opportunity_uuid>/related-contacts?format=json" \
  -H "Authorization: <key>" -H "Content-Type: application/json" \
  -d '{"contact.uuid":"<crm contact uuid>","relationship":"Budget Owner"}'
```

Linking the same contact twice returns 409 `duplicate_resource_error`. Remove with `DELETE …/related-contacts/<link uuid>` (the link's own uuid from the list, not the contact's). A `DELETE` on the collection is a 405.

---

## 6. Discover a pipeline's custom-field definitions before writing values

The list endpoint takes an **opportunity** uuid, not a pipeline uuid, because the controller resolves the pipeline through the opportunity:

```bash
curl -s "https://<host>/pipeline/api/v2/custom-fields/opportunities/<opportunity_uuid>?format=json" \
  -H "Authorization: <key>"
```

Returns `{ "results": [ { "id", "name", "attribute_type", "metadata": { "label", "ui_element", "options", "configuration_id" }, … } ] }`. Use `name` for the `custom_field.<name>` keys and `metadata.options` for select values. To do this before any opportunity exists in the pipeline, create one placeholder opportunity, read the definitions, then delete it (`DELETE` returns 204).

In Liquid the controller wants its arguments by name:

```liquid
{%- function fields = "pipeline/controller/custom_fields/list", type: "opportunity", opportunity_uuid: "<opportunity_uuid>" -%}
```

Without `type: "opportunity"` the controller never assigns the table and the GraphQL filter runs with a blank path.

---

## 7. Delete a pipeline and everything in it

```bash
curl -s -X DELETE "https://<host>/pipeline/api/v2/pipelines/<pipeline_uuid>?format=json" \
  -H "Authorization: <key>"
```

`delete_pipeline.liquid` deletes activities, custom-field data, opportunities and stages first, then the pipeline, and returns 200 with the raw record. There is no archive and no undo; set `status` to `archived` with a `PATCH` if you want to hide a pipeline instead.

---

## What is intentionally not here

- **Activities and tasks**: no V2 endpoints. Activities have v1 pages at `/pipeline/api/v1/opportunities-activities`; tasks are admin-only.
- **Webhook subscriptions**: admin-only. See [`configuration.md`](configuration.md).
- **Reports, board columns, display fields, saved filters**: admin-only long-form controllers that return nothing to a `{% function %}` call. See [`gotchas.md`](gotchas.md).
