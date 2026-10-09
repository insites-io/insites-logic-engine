# Events: Patterns

Worked examples against the Events V2 API and its controllers. Conventions (auth, dotted keys, envelope, errors) are in [`api.md`](api.md). The `Authorization: <instance key>` header is omitted from the curl lines.

## Calling a controller from Liquid

All 35 short controllers (`private/views/partials/controllers/_external/v2/`, module-v6-events v6.0.2, checked 9 October 2026) share one shape: do the work, then

```liquid
{% if context.params.format == 'json' %}
  {%- include "modules/insites_crm/functions/response_handler", data: data, status: status -%}
{% endif %}
{%- return data -%}
```

So a `{% function %}` call from a page binds the data, and the response handler stays quiet unless the page's own URL carries `?format=json`. The rules in [`02-calling-a-controller.md`](../../building-on-insites/02-calling-a-controller.md) apply unchanged. The two `modules/insites_events/controllers/user_preferences/*` controllers are the exception: no gate, no `{% return %}`; see [`gotchas.md`](gotchas.md).

Argument names follow the pages: top-level lists and creates take `params:`; `get` takes `uuid:`; sub-resource lists take `uuid:` (the event) and `params:`; sub-resource creates take `event_uuid:` and `params:`; sub-resource updates and deletes take `event_uuid:`, `uuid:` and `params:`.

---

## 1. List events, paginated

```http
GET /events/api/v2/events?page=1&size=25&sort_by=start_date_time&sort_order=ASC&search_by=event_name&keyword=festival&format=json
```

Returns `{ total_entries, total_pages, page, size, results }`. In Liquid, pass the same keys as a hash:

```liquid
{%- parse_json query -%}
  { "page": 1, "size": 25, "sort_by": "start_date_time", "sort_order": "ASC", "keyword": "festival" }
{%- endparse_json -%}
{%- function events = "events/events/list", params: query -%}
{{ events.total_entries }} events, {{ events.total_pages }} pages
```

`total_entries` on the return value was verified on a live instance on 7 October 2026.

## 2. Get one event by uuid

`events/events/get` takes `uuid:` directly, not inside `params` (verified live, 7 October 2026):

```liquid
{%- function event = "events/events/get", uuid: context.params.uuid -%}
{{ event.event_name }} at {{ event.venue_name }}
```

```http
GET /events/api/v2/events/2a4e7c10-8b3d-4e9f-9a1c-5d6e7f8a9b0c?format=json
```

An unknown uuid returns `code: "404"`, `type: "resource_not_found_error"`, `details.resource_type: "Event"`.

## 3. Create an event with related records and a custom field

```http
POST /events/api/v2/events?format=json
Content-Type: application/json

{
  "event_name": "Riverside Community Art Festival",
  "status": "Published",
  "category.uuid": "85e6f4c2-94b6-4393-af99-9890c3102206",
  "event_manager.uuid": "ee5c5002-0e19-488c-a917-0a570f8d09a5",
  "venue.uuid": "1b2a3c4d-5e6f-7890-abcd-ef1234567890",
  "event_time_zone": "Australia/Brisbane",
  "start_date_time": "2026-11-01T09:00:00+10:00",
  "end_date_time": "2026-11-01T17:00:00+10:00",
  "custom_field.field_1": "value"
}
```

The offsets are normalised to UTC before saving. Omit the `Z`/offset and the call returns 400 with `errors[0].attribute: "start_date_time"`. On success the response nests `category`, `event_manager`, `venue` and `custom_field` as objects and fires `event_added`.

## 4. Add tickets in a batch

The body is an array. Each item names the pricing division and tier it draws from:

```http
POST /events/api/v2/events/2a4e7c10-…/tickets?format=json
Content-Type: application/json

[
  { "ticket_type": "individual",
    "event_pricing_division.uuid": "d1…", "event_pricing_tier.uuid": "t1…",
    "contact.uuid": "c1…", "price": 120.0, "price_includes_tax": true },
  { "ticket_type": "group", "group_id": "table-7",
    "event_pricing_division.uuid": "d1…", "event_pricing_tier.uuid": "t2…" }
]
```

Each accepted ticket decrements the division's remaining counters and gets a PDF; one rejected item fails the whole call with 404 and per-item reasons in `details`. `event_ticket_added` fires once with the batch result.

## 5. Assign a CRM contact to a ticket

```http
POST /events/api/v2/events/2a4e7c10-…/tickets/9f0e…/assign?format=json
Content-Type: application/json

{ "contact.uuid": "c1…", "confirmation_status": "Confirmed", "dietary_notes": "Vegetarian" }
```

The controller copies name, email, job title, type and phone from the CRM contact onto the ticket and regenerates the PDF. Send the `contact_*` fields instead of `contact.uuid` for a guest who is not in CRM.

## 6. Read an event's expenses from Liquid

```liquid
{%- function expenses = "events/event_expenses/list", uuid: event.uuid, params: context.params -%}
{%- for expense in expenses.results -%}
  {{ expense.expense_item }}: {{ expense.amount }}
{%- endfor -%}
```

The list controller filters on `event_uuid` and defaults `search_by` to `expense_item`.

## 7. Discover system-field options, then add a category

```http
GET /events/api/v2/system-fields/options?format=json
```

returns `[{ "label": "Event Category", "value": "event_category", "uuid": "df2c607d-…", "is_configurable": false }, …]`. Use the `value` as the `system_field` key:

```http
POST /events/api/v2/system-fields?format=json
Content-Type: application/json

{ "system_field": "event_category", "value": "Workshop" }
```

An unknown `system_field` returns 404 with `details.requested_system_field_label`.

## 8. Create a venue

```http
POST /events/api/v2/venues?format=json
Content-Type: application/json

{ "venue_name": "Riverside Park Grounds", "city": "Brisbane", "state": "QLD", "country_code": "AU",
  "crm_company.uuid": "…", "contacts.uuids": ["…"] }
```

There is no update or delete for venues over the API and no venue-area endpoint; both stay in IIA (`#/events/venues`).

## What is intentionally not here

- Pricing divisions and tiers, imports, exports, PDF layouts and QR check-in: admin UI only.
- Webhook registration: admin UI only.
- The `/events/api/v1/...` pages: legacy, see [`gotchas.md`](gotchas.md).
