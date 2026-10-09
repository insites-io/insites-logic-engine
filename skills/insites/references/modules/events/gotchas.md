# Events: Gotchas

Edges visible in `module-v6-events` v6.0.2 source (read 9 October 2026). Each entry: what bites, why, how to avoid.

---

## 1. The two long-form controllers return nothing and set headers unconditionally

**Bites:** `{% function prefs = "modules/insites_events/controllers/user_preferences/get" %}` leaves `prefs` blank, and the call sets a JSON status and `Content-Type` on whatever page ran it.

**Why:** `private/views/partials/controllers/user_preferences/get.liquid` and `upsert.liquid` end with an ungated `{%- include "modules/insites_crm/functions/insites_response_util" -%}` and have no `{% return %}`. The 35 short controllers all gate on `context.params.format == 'json'` and return.

**Avoid:** treat these two as page-only. They serve `GET`/`PUT /insites/events/user-preferences` behind the administrator policy; do not call them from your own pages.

## 2. The 401 body is not valid JSON

**Bites:** a client that parses the 401 response throws before it can read `code`.

**Why:** `private/views/pages/system/401.json.liquid` renders `"timestamp": "{{ "now" | date: … }},` with no closing quote on the value.

**Avoid:** branch on the HTTP status 401 before parsing. Every other error body parses.

## 3. Aliases carry no `controller` word

**Bites:** a search for `controller/` in a tree or in the inventory misses all 35 short aliases.

**Why:** the `path:` front matter is `events/<resource>/<verb>`, for example `events/venues/list`. The resource segment uses the table name (`event_tickets`, `event_faqs`), not the URL segment (`tickets`, `faqs`).

**Avoid:** take names from the [alias inventory](../../building-on-insites/reference/alias-inventory.md#module-v6-events-37). `events/tickets/list` does not exist; `events/event_tickets/list` does.

## 4. `get` takes `uuid:`, lists take `params:`

**Bites:** `{% function e = "events/events/get", params: { uuid: x } %}` returns a 404 shape because `uuid` is blank.

**Why:** `get_event.liquid` reads a bare `uuid` variable; the page passes `uuid: context.params.uuid`. Sub-resource controllers read `uuid` and `event_uuid` the same way and read everything else from `params`.

**Avoid:** follow the argument table in [`patterns.md`](patterns.md).

## 5. Ticket create is all-or-nothing and reports failure as 404

**Bites:** one bad `event_pricing_tier.uuid` in a batch of 50 rejects all 50, and the status is 404, not 400.

**Why:** `add_event_tickets.liquid` sets `has_ticket_processing_error` on any item and then returns `code: "404", message: "A field in the request payload is invalid."` with the per-ticket messages in `details`. Items processed before the failure have already decremented the division counters and been written.

**Avoid:** validate division, tier and `ticket_type` per item before sending; send small batches; re-read the ticket list after a 404.

## 6. The custom-field table lives under `modules/ins_events/`

**Bites:** a GraphQL query against `modules/insites_events/event_custom_field` finds no table.

**Why:** migration `20240226015750` created it at `modules/ins_events/public/schema/event_custom_field.yml`, and 30 references in `private/graphql/` and the delete controller use that path.

**Avoid:** use the `ins_events` path for that one table and `insites_events` for the other 22.

## 7. `deleted_venue_areas` counts pricing divisions

**Bites:** the delete response names a table that no longer holds the data.

**Why:** `delete_event.liquid` deletes from `event_pricing_division` but keeps the key `deleted_venue_areas` from the pre-`20250909055320` schema. The same rename shows in `related_fields` of several resources.

**Avoid:** read the count, ignore the name.

## 8. System fields are addressed by label, not uuid, and update is `PUT`

**Bites:** `POST /system-fields` with `"system_field": "df2c607d-…"` returns 404 "System Field with the provided label value was not found."; `PATCH /system-fields/:uuid` returns nothing useful.

**Why:** `add_system_field.liquid` matches `params.system_field` against `system_field_name | downcase | split: " " | join: "_"`. The two update pages declare `method: put`.

**Avoid:** call `GET /system-fields/options` first and send its `value`. Use `PUT` on system fields and `PATCH` everywhere else.

## 9. `?format=json` is required for a status code

**Bites:** a 404 body arrives with HTTP 200.

**Why:** every short controller wraps `response_handler` in `{% if context.params.format == 'json' %}`. The pages' `format: json` front matter is a different thing, and the source does not show it populating `context.params.format`.

**Avoid:** append `?format=json` and read `code` in the body.

## 10. `/events/api/v1/...` is live but undocumented

**Bites:** 27 pages under `private/views/pages/api/_external/events/` answer at `events/api/v1/...` with `PUT` for update, the CRM copy of the API-key policy and ungated `insites_response_util` responses; the module's `CLAUDE.md` flags the folder as un-versioned drift.

**Avoid:** build on v2. Their controllers declare no `path:` alias, so nothing in v1 is callable by name.

## 11. Webhooks fire on create only, with no signature

**Bites:** subscribing to `event_updated` or `event_deleted` and waiting.

**Why:** `call_events_webhook` is called with three types only: `event_added`, `event_ticket_added`, `event_expense_added`. The api_call sets `Content-Type` and nothing else.

**Avoid:** poll `updated_at` for changes; authenticate the receiver by URL secret or allow-list.

## 12. Version strings disagree inside the repo

**Bites:** reading "v6.0.1", "v6.0.0" or "v5.5.4" and thinking the module is behind.

**Why:** `hook_module_info` says `6.0.2` and matches the tag. The generated dependency partials under `private/views/partials/insites_admin/` say `v6.0.1` in their comment, the repo `CLAUDE.md` says v6.0.0 and `README.md` says v5.5.4.

**Avoid:** trust the git tag, then the hook.

## 13. Datetimes must carry a zone

**Bites:** `"start_date_time": "2026-11-01T09:00:00"` returns 400.

**Why:** `validate_datetime_fields.liquid` requires `Z` or `±HH:MM` on `start_date_time`, `end_date_time`, `registration_deadline_date`, and rewrites offsets to UTC.

**Avoid:** send ISO 8601 with an offset; expect `Z` back.
