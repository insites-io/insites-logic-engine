# Locator: Patterns

Worked examples against the Locator V2 REST API and its controller aliases. Conventions (auth, `format=json`, dotted keys, list envelope) are in [`api.md`](api.md). The `Authorization: <instance api key>` header is omitted from the curl snippets. Replace `<instance>` with your instance host.

Controller calls follow [`../../building-on-insites/02-calling-a-controller.md`](../../building-on-insites/02-calling-a-controller.md): use `{% function %}`, never `{% include %}`, and remember that 22 of the 23 Locator controllers only touch your HTTP response when the request carries `?format=json`.

---

## 1. List locations, newest first

```bash
curl "https://<instance>/locator/api/v2/locations?page=1&size=50&sort_by=updated_at&sort_order=DESC&format=json" \
  -H "Authorization: $INSTANCE_API_KEY"
```

Returns `{ total_entries, total_pages, page, size, results[] }`. Pass `sort_by` explicitly; the controller default is `uuid`, which gives no useful order (`controllers/_external/v2/locations/list.liquid`).

Search a joined field with a dotted `search_by`:

```bash
curl "https://<instance>/locator/api/v2/locations?search_by=category.category_name&keyword=Retail&format=json" \
  -H "Authorization: $INSTANCE_API_KEY"
```

---

## 2. Create a location with a category, opening hours and a custom field

```bash
curl -X POST "https://<instance>/locator/api/v2/locations?format=json" \
  -H "Authorization: $INSTANCE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "enabled",
    "location_name": "Downtown Coffee House",
    "location_slug": "downtown-coffee-house",
    "category.uuid": "6f9017ff-cde4-45c6-afb3-f178151733b0",
    "address_1": "456 Main Street",
    "city": "San Francisco",
    "country_code": "US",
    "latitude": "37.7749",
    "longitude": "-122.4194",
    "is_open_on_monday": true,
    "monday_opening_time": "7:00 AM",
    "monday_closing_time": "6:00 PM",
    "is_open_on_sunday": false,
    "custom_field.parking_spaces": 12
  }'
```

`category.uuid` becomes `category_uuid` (`locations/models/payload_fields.liquid`). `custom_field.parking_spaces` is written as a row in `modules/ins_locator/location_custom_field`; the field must already be defined in the admin. The response is the created location with `category`, `custom_field` and `system_fields` nested.

---

## 3. Raise an enquiry against a location, then move its status

```bash
curl -X POST "https://<instance>/locator/api/v2/enquiries?format=json" \
  -H "Authorization: $INSTANCE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "location.uuid": "6f9017ff-cde4-45c6-afb3-f178151733b0",
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "phone_country_code": "+61",
    "phone_number": "412345678",
    "message": "Do you open on public holidays?",
    "status": "new"
  }'
```

`location.uuid` is required (`add_enquiry.graphql` declares `$location_uuid: String!`). The controller strips the `+` from `phone_country_code`. Update is `PUT`, not `PATCH`, on every resource:

```bash
curl -X PUT "https://<instance>/locator/api/v2/enquiries/<enquiry uuid>?format=json" \
  -H "Authorization: $INSTANCE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "status": "closed", "assigned_to.uuid": "<administrator uuid>" }'
```

Status values are free strings; source applies no list.

---

## 4. Inspect, then delete, a custom-field definition

```bash
curl "https://<instance>/locator/api/v2/custom-fields?format=json" -H "Authorization: $INSTANCE_API_KEY"
```

Read the numeric `id` of the property you want gone from `results[]`, then:

```bash
curl -X DELETE "https://<instance>/locator/api/v2/custom-fields/<property id>?format=json" \
  -H "Authorization: $INSTANCE_API_KEY"
```

The response is the remaining definitions in the same `{ results, created_at, updated_at }` shape. A missing id returns `400 missing_field_id`; an unknown one `404 field_not_found`.

---

## 5. Read a location inside a Liquid page

```liquid
{%- function location = "locator/controller/locations/get", uuid: context.params.uuid -%}
{{ location.location_name }} opens Monday at {{ location.monday_opening_time }}
```

`locator/controller/locations/get` returns the same object the REST endpoint does, including the seven-day opening-hours fields, `custom_field` and `system_fields`. A miss returns `{ errors: [ { code: "no_location" } ] }`, so test `location.errors` before rendering.

---

## 6. List locations inside a Liquid page without exposing the handler

```liquid
{%- function locations = "locator/controller/locations/list", params: context.params -%}
{%- for item in locations.results -%}
  {{ item.location_name }}
{%- endfor -%}
```

Passing `context.params` straight through means a visitor who appends `?format=json` to your HTML page makes the controller set a JSON `Content-Type` on your HTML response. When the page must not do that, build the hash yourself and leave `format` out; the technique is in [`02-calling-a-controller.md`](../../building-on-insites/02-calling-a-controller.md#the-formatjson-trap-on-an-html-page).

---

## 7. Do not `{% function %}` the filter-options controller

`locator/controller/enquiries/filters/get_filter_options` (`controllers/enquiries/filters/get_filter_options.liquid`) has no `{% return %}` and includes `response_handler` unconditionally. Calling it with `{% function %}` binds nothing and still sets your page's status and `Content-Type`; `{% include %}` prints the JSON into your page. To read the enquiry field list, inspect a result from `GET /locator/api/v2/enquiries` or read `private/schema/enquiry.yml`.

---

## What's intentionally not here

- **FAQs, attachments, imports, exports, saved filters:** admin-only, see [`configuration.md`](configuration.md).
- **The legacy `/locator/api/v1/` pages:** undocumented and slated to move; build on V2.
- **Webhooks:** none.
