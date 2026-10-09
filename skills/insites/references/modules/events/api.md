# Events: V2 REST API

The Events module serves 35 endpoints at `/events/api/v2/...`. Each is one page under `private/views/pages/api/_external/v2/` in `module-v6-events` (counted at v6.0.2 on 9 October 2026); each page `{% include %}`s one controller under `private/views/partials/controllers/_external/v2/`. The module's own API documentation lives in `private/views/partials/insites_api/external_api/` and is the source for the field tables below.

For authentication, see [`../../api/authentication.md`](../../api/authentication.md). Every request needs the raw instance API key in the `Authorization` header, no `Bearer` prefix.

---

## Conventions

### Auth guard

All 35 pages list one policy, `modules/insites_events/has_valid_instance_api_authorization` (`private/authorization_policies/has_valid_instance_api_authorization.liquid`). It fetches `instance_api_key` through `modules/insites_crm/instance_configurations/get_instance_configuration`, returns `false` when either the stored key or the header is blank, and otherwise compares the two. Failures redirect to `api/v2/401.json` (`private/views/pages/system/401.json.liquid`), which sets status 401 and returns `type: "invalid_credentials_error"`. No endpoint uses an inline guard.

### URL pattern

```
<method> /events/api/v2/<resource>[/<uuid>][/<sub-resource>[/<uuid>]][/<action>]
```

Every id in a path is a UUID. Sub-resources nest under the parent event: `/events/:event_uuid/tickets/:uuid`. Two shapes break the pattern: status update is `PATCH /events/status/:uuid` (status segment before the uuid), and system-field option configuration is `PUT /system-fields/options/:uuid`.

### Methods

Update is `PATCH` for events and all event sub-resources, and `PUT` for the two system-field updates. Delete is `DELETE`. Ticket contact assignment is `POST .../assign`.

### Request format

JSON body. Related records are referenced by dotted keys that the CRM helper `modules/insites_crm/functions/_external/payload_api` maps onto storage columns (`private/views/partials/controllers/_external/v2/<resource>/models/payload_fields.liquid`):

| Resource | Dotted keys accepted |
|---|---|
| Events | `industry.uuid`, `category.uuid`, `event_manager.uuid`, `venue.uuid`, `system_fields.uuids`, `last_updated_by_administrator.uuid`, `custom_field.<name>` |
| Expenses | `event.uuid`, `category.uuid`, `vendor_company.uuid`, `vendor_contact.uuid` |
| Speakers | `event.uuid`, `contact.uuid`, `company.uuid` |
| Sponsors | `event.uuid`, `category.uuid`, `company.uuid` |
| Tickets | `event.uuid`, `contact.uuid`, `contact_crm_contact_type.uuid`, `contact_company.uuid`, `venue.uuid`, `event_pricing_division.uuid`, `event_pricing_tier.uuid`, `purchased_by.uuid`, `purchased_by_company.uuid`, `ticket_scanned_by_administrator.uuid` |
| Venues | `venue_areas.uuids`, `contacts.uuids`, `crm_company.uuid`, `venue_type.uuid` |

Responses inflate these into nested objects (`industry: {id, uuid, value}`, `event_manager: {id, uuid, name, email}`) through `modules/insites_crm/functions/_external/results_api`. On events, the controller also folds the custom-field table into a `custom_field` object and strips `event_uuid`.

### Datetimes

`events/events/create` and `.../update` run `private/views/partials/functions/events/validate_datetime_fields.liquid` on `start_date_time`, `end_date_time` and `registration_deadline_date`. A value must end in `Z` or a `±HH:MM` offset; offsets are normalised to UTC (`...T..:..:..000Z`) before saving; a naive datetime returns 400 with `errors: [{attribute, message}]`.

### Response, success

The resource at the top level (create, get, update, delete, assign) or the list envelope. Delete on an event returns the record plus cascade counts: `deleted_custom_fields`, `deleted_faqs`, `deleted_venue_areas` (pricing divisions, name kept from an older schema), `deleted_speakers`, `deleted_sponsors`, `deleted_expenses`, `deleted_tickets`.

### Response, error

One structured shape across the 35 controllers:

```json
{ "code": "404", "status": "Not Found", "message": "Event with the provided UUID was not found.",
  "type": "resource_not_found_error", "details": { "requested_uuid": "…", "resource_type": "Event" },
  "timestamp": "2026-10-09T03:00:00Z", "path": "/events/api/v2/events/…" }
```

- `400` `invalid_request_error` with an `errors` array (validation or GraphQL failure)
- `401` `invalid_credentials_error` from the policy
- `404` `resource_not_found_error` with `details` (unknown event, ticket, contact or system field)

The HTTP status is set only when the request carries `?format=json`; the controllers wrap `modules/insites_crm/functions/response_handler` in `{% if context.params.format == 'json' %}`. The pages declare `format: json` in front matter; whether that alone populates `context.params.format` is not answered by the source, so send `?format=json` and read `code` in the body as the source of truth.

### List envelope and parameters

Lists return `{ total_entries, total_pages, page, size, results }`. `total_entries` and `total_pages` come from a second query, `graphql/_external/v2/totals/get_total_entries.graphql`.

| Param | Default | Notes |
|---|---|---|
| `page` | `1` | |
| `size` | `10` | read as `params['size']` |
| `sort_by` | `updated_at` | `created_at` or `updated_at` sort on the system column; any other name sorts on that property |
| `sort_order` | `DESC` | upcased |
| `search_by` | resource-specific | `event_name` (events), `venue_name` (tickets), `expense_item` (expenses); FAQs list documents only `page` and `size` |
| `keyword` | | search term |
| `system_field` | | system-fields list only; the label as `event_category`, `event_industry`, `venue_type` |

---

## Events

Table `modules/insites_events/event` (86 properties in `private/schema/event.yml`).

| Method | Path | Controller |
|---|---|---|
| `GET` | `/events/api/v2/events` | `events/events/list` |
| `GET` | `/events/api/v2/events/:uuid` | `events/events/get` |
| `POST` | `/events/api/v2/events` | `events/events/create` |
| `PATCH` | `/events/api/v2/events/:uuid` | `events/events/update` |
| `PATCH` | `/events/api/v2/events/status/:uuid` | `events/events/update_event_status` (body: `status`) |
| `DELETE` | `/events/api/v2/events/:uuid` | `events/events/delete` |

Writable fields (doc partial `all_events/add_event.liquid`): `event_name` (required), `event_slug`, `reference_number`, `status`, `category.uuid`, `industry.uuid`, `event_manager.uuid`, `event_time_zone`, `start_date_time`, `end_date_time`, `registration_deadline_date`, `notes`, `short_description`, `long_description`, `event_image`, `event_type`, `online_event_id`, `password`, `link`, `venue.uuid` and the 19 denormalised `venue_*` columns, sitemap and `meta_*`/`open_graph_*` SEO fields, `schema_content`, `image_1..5`, `file_1..5`, `gallery_1..3`, `is_faqs_displayed`, `faqs_section_heading`, `faqs_section_subheading`, `system_fields.uuids`, `custom_field.<name>`. Not listed as writable in the doc partial: `ticket_layout`, `ticket_layout_pdf`, `total_individual_tickets_remaining`, `total_group_tickets_remaining`, `last_updated_by_administrator` (the payload map does accept `last_updated_by_administrator.uuid`), and the eight financial-summary columns (`revenue_ex_tax`, `revenue_gross`, `expenses_ex_tax`, `expenses_gross`, `net_pnl_ex_tax`, `net_pnl_gross`, `margin_percent_ex_tax`, `margin_percent_gross`) which exist in the schema but not in the doc partial.

Create fires the `event_added` webhook. Upload fields (`event_image`, `image_n`, `file_n`, `gallery_n`) return `{file_name, extension, url}`; the doc partial describes the nested file keys to send.

## Event expenses

Table `event_expense`. Controllers `events/event_expenses/{list,create,update,delete}`.

| Method | Path |
|---|---|
| `GET` | `/events/api/v2/events/:uuid/expenses` |
| `POST` | `/events/api/v2/events/:uuid/expenses` |
| `PATCH` | `/events/api/v2/events/:event_uuid/expenses/:uuid` |
| `DELETE` | `/events/api/v2/events/:event_uuid/expenses/:uuid` |

Fields: `expense_item` (required), `category.uuid`, `description`, `notes`, `attachment`, `vendor_company.uuid`, `vendor_contact.uuid`, `amount`, `tax`, `price_includes_tax`, `tax_type`, `payment_status`, `invoice_number`, `invoice_date`, `due_date`, `payment_date`, `invoice`. Create fires `event_expense_added` and recalculates the event's financial summary (`functions/events/recalculate_financial_summary`).

## Event FAQs

Table `event_faq`. Controllers `events/event_faqs/{list,create,update,delete}`; same four paths with `faqs`. Fields: `question`, `answer` (both required).

## Event speakers

Table `event_speaker`. Controllers `events/event_speakers/{list,create,update,delete}`; paths with `speakers`. Fields: `contact.uuid`, `company.uuid`, `first_name`, `last_name`, `company_name`, `job_title`, `image`, `speaker_weighting`, `content`.

## Event sponsors

Table `event_sponsor`. Controllers `events/event_sponsors/{list,create,update,delete}`; paths with `sponsors`. Fields: `company.uuid`, `logo`, `company_name`, `link`, `category.uuid`, `value`, `tax`, `price_includes_tax`, `tax_type`, `sponsor_weighting`, `content`.

## Event tickets

Table `event_ticket` (42 properties). Controllers `events/event_tickets/{list,create,update,delete,assign_contact}`.

| Method | Path |
|---|---|
| `GET` | `/events/api/v2/events/:uuid/tickets` |
| `POST` | `/events/api/v2/events/:uuid/tickets` |
| `PATCH` | `/events/api/v2/events/:event_uuid/tickets/:uuid` |
| `DELETE` | `/events/api/v2/events/:event_uuid/tickets/:uuid` |
| `POST` | `/events/api/v2/events/:event_uuid/tickets/:uuid/assign` |

Create takes a JSON **array** of tickets (the controller reads `params._json`, and falls back to treating the body as one ticket). Each item needs `ticket_type` (`individual` or `group`), `event_pricing_division.uuid` and `event_pricing_tier.uuid`; group tickets also need `group_id`. The controller decrements the division's remaining counters, generates the ticket PDF, and fires `event_ticket_added` once for the batch. Any rejected item turns the whole response into a 404 `"A field in the request payload is invalid."` with per-ticket reasons under `details`.

Assign takes `contact.uuid` (resolved against CRM; unknown uuid is a 404 with `resource_type: "CRM Contact"`) or the manual `contact_first_name`, `contact_last_name`, `contact_email`, `contact_job_title`, `contact_crm_contact_type.uuid`, `contact_phone_country_code`, `contact_phone_number`, plus `dietary_notes`, `allocation_status`, `confirmation_status`, `attended_status`, `purchased_by.uuid`, `purchased_by_company.uuid`. It regenerates the ticket PDF.

Ticket reads join `modules/insites_ecommerce/order` on `order_number` (`graphql/_external/v2/events/tickets/get_event_tickets.graphql`).

## System fields

Stored as metadata on the `event_system_field` table, not as rows (`graphql/system_fields/get_system_fields.graphql` reads `admin_table_update.properties[].metadata.system_fields`). Controllers `events/system_fields/{list,get_options,create,update,delete,update_configuration}`.

| Method | Path | Body / params |
|---|---|---|
| `GET` | `/events/api/v2/system-fields/options` | none; returns `[{label, value, uuid, is_configurable}]` |
| `GET` | `/events/api/v2/system-fields` | `page`, `size`, `system_field` |
| `POST` | `/events/api/v2/system-fields` | `system_field` (the option `value`, e.g. `event_category`), `value` |
| `PUT` | `/events/api/v2/system-fields/:uuid` | `value` |
| `DELETE` | `/events/api/v2/system-fields/:uuid` | |
| `PUT` | `/events/api/v2/system-fields/options/:uuid` | `label`; refused for the four fixed uuids hard-coded in the controller |

## Venues

Table `venue`. Controllers `events/venues/{list,create}` only.

| Method | Path |
|---|---|
| `GET` | `/events/api/v2/venues` |
| `POST` | `/events/api/v2/venues` |

Fields: `venue_name` (required), `venue_areas.uuids`, `venue_type`, `contacts.uuids`, `crm_company.uuid`, `address_1..3`, `city`, `county`, `district`, `suburb`, `state`, `country`, `country_code`, `postcode`, `latitude`, `longitude`, `geojson`. There is no get, update or delete for a venue, and no venue-area endpoint at all.

---

## Webhooks

Three event types, all on create, declared in `private/schema/webhook.yml` (`uuid`, `event_type`, `webhook_url`, `is_webhook_enabled`, `payload_schema`):

| Type | Fired by |
|---|---|
| `event_added` | `events/events/create` |
| `event_ticket_added` | `events/event_tickets/create` (once per batch, payload is the batch result) |
| `event_expense_added` | `events/event_expenses/create` |

`private/views/partials/functions/call_events_webhook.liquid` looks up the enabled subscription for the type and POSTs through `private/api_calls/webhoooks/call_event_webhook.liquid` with `Content-Type: application/json` and body `{ "type", "created": <unix seconds>, "data": <resource> }`. No signing header is set. The admin controllers fire the same three types. Nothing fires on update, delete, speaker, sponsor, FAQ, venue or system-field changes. Subscriptions are managed at `/insites/events/webhooks` (admin-only, see [`configuration.md`](configuration.md)); no V2 endpoint lists or creates them.

---

## Notes for the LLM consumer

- Dotted keys in, nested objects out. `custom_field.<name>` works on events only.
- `PATCH` for events and sub-resources, `PUT` for system fields. There is no `PUT` on an event.
- Ticket create is a batch and fails as a batch.
- Venues: list and create only. Venue areas, pricing divisions and tiers are admin-UI only.
- Send `?format=json`; read `code` in the body regardless.
