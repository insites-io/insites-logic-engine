# Locator: V2 REST API

The Locator module exposes a V2 REST API at the `/locator/api/v2/...` prefix: 22 endpoints across five resources, counted in module-v6-locator v6.0.2 on 9 October 2026. Paths below are relative to `modules/insites_locator/`.

For authentication, see [`../../api/authentication.md`](../../api/authentication.md). Every request needs an `Authorization` header carrying the raw instance API key, no `Bearer` prefix.

---

## Surface at a glance

| Method | Path | Controller alias |
|---|---|---|
| `GET` | `/locator/api/v2/categories` | `locator/controller/categories/list` |
| `GET` | `/locator/api/v2/categories/:uuid` | `locator/controller/categories/get` |
| `POST` | `/locator/api/v2/categories` | `locator/controller/categories/create` |
| `PUT` | `/locator/api/v2/categories/:uuid` | `locator/controller/categories/update` |
| `DELETE` | `/locator/api/v2/categories/:uuid` | `locator/controller/categories/delete` |
| `GET` | `/locator/api/v2/locations` | `locator/controller/locations/list` |
| `GET` | `/locator/api/v2/locations/:uuid` | `locator/controller/locations/get` |
| `POST` | `/locator/api/v2/locations` | `locator/controller/locations/create` |
| `PUT` | `/locator/api/v2/locations/:uuid` | `locator/controller/locations/update` |
| `DELETE` | `/locator/api/v2/locations/:uuid` | `locator/controller/locations/delete` |
| `GET` | `/locator/api/v2/enquiries` | `locator/controller/enquiries/list` |
| `GET` | `/locator/api/v2/enquiries/:uuid` | `locator/controller/enquiries/get` |
| `POST` | `/locator/api/v2/enquiries` | `locator/controller/enquiries/create` |
| `PUT` | `/locator/api/v2/enquiries/:uuid` | `locator/controller/enquiries/update` |
| `DELETE` | `/locator/api/v2/enquiries/:uuid` | `locator/controller/enquiries/delete` |
| `GET` | `/locator/api/v2/system-fields` | `locator/controller/system_fields/list` |
| `GET` | `/locator/api/v2/system-fields/:uuid` | `locator/controller/system_fields/get` |
| `POST` | `/locator/api/v2/system-fields` | `locator/controller/system_fields/create` |
| `PUT` | `/locator/api/v2/system-fields/:uuid` | `locator/controller/system_fields/update` |
| `DELETE` | `/locator/api/v2/system-fields/:uuid` | `locator/controller/system_fields/delete` |
| `GET` | `/locator/api/v2/custom-fields` | `locator/controller/custom_fields/get` |
| `DELETE` | `/locator/api/v2/custom-fields/:id` | `locator/controller/custom_fields/delete` |

The pages sit under `private/views/pages/api/_external/v2/<resource>/`, one `{% include %}` of the alias each. The admin API doc data under `private/views/partials/insites_api/external_api/` names a `controller_name` for every endpoint, and all 22 resolve to a declared alias (checked 9 October 2026).

---

## Conventions

### Auth and the 401 body

All 22 pages declare `authorization_policies: [modules/insites_crm/has_valid_instance_api_authorization]` and `layout: modules/insites_crm/json`. The policy compares `context.headers.HTTP_AUTHORIZATION` with the CRM instance configuration `instance_api_key` and redirects a miss to the CRM page `api/401`, whose body is:

```json
{ "error": "unauthorized", "message": "Invalid or revoked API key", "type": "authentication_error" }
```

The doc data's example `{ "error": "Unauthorized" }` does not match that; trust the page.

### `format=json` sets the status code

Every controller runs `modules/insites_crm/functions/response_handler` (which sets `Content-Type: application/json` and the HTTP status) only when `context.params.format == 'json'`. Add `?format=json` to every request or the body may arrive with a `200` even when it carries `errors`. Same trap as CRM and Data.

### IDs and verbs

Categories, locations, enquiries and system fields are addressed by `uuid`, resolved to the record id with `modules/insites_crm/functions/get_id` before every update or delete. Custom-field delete takes the numeric property `:id` from the table's `properties[]`. Update is `PUT`; there is no `PATCH` on this surface.

### Dotted keys on write, nested objects on read

`modules/insites_crm/functions/_external/payload_api` rewrites dotted keys per each resource's `models/payload_fields.liquid`:

| Resource | Send | Stored as |
|---|---|---|
| Locations | `category.uuid` | `category_uuid` |
| Enquiries | `location.uuid` | `location_uuid` |
| Enquiries | `assigned_to.uuid` | `assigned_to_administrator_uuid` |
| Locations | `custom_field.<name>` | a row in `modules/ins_locator/location_custom_field` |

Categories and system fields have empty payload maps. On read, the GraphQL queries join the related record, so responses carry `category`, `location`, `assigned_to` and `custom_field` as nested objects.

### List envelope and query parameters

List controllers (`categories/list.liquid`, `locations/list.liquid`, `enquiries/list.liquid`, `system_fields/list.liquid`) read:

| Param | Default | Notes |
|---|---|---|
| `page` | `1` | |
| `size` | `10` | |
| `sort_by` | `uuid` | `created_at` and `updated_at` sort on the record; anything else on a property of that name |
| `sort_order` | `ASC` | |
| `search_by` | `category_name`, `location_name`, `first_name`, `value` per resource | A dotted value such as `category.category_name` joins through `models/related_fields.liquid` |
| `keyword` | none | `contains` match; exact when `search_by=uuid` |

The response is `{ total_entries, total_pages, page, size, results[] }`.

### Errors

Every controller builds `{ "errors": [ { "code", "message" } ] }`. Single-record reads return `404` with `no_category`, `no_location`, `no_enquiry` or `no_system_field`; custom-field delete returns `400 missing_field_id` or `404 field_not_found`. A failed mutation copies `results.errors` and leaves `status` unset, so `response_handler` defaults to `400`.

---

## Resources

### Categories

Fields (`private/graphql/_external/v2/categories/get_category.graphql`, doc data `external_api/categories/object.liquid`): `id`, `uuid`, `status`, `category_name`, `category_slug` (stored as property `slug`), `short_description`, `long_description`, `category_image` (`{file_name, extension, url}`), sitemap fields `is_sitemap_enabled`, `sitemap_priority`, `sitemap_order`, `sitemap_change_frequency`, SEO fields `is_visible_to_search_engines`, `canonical_url`, `meta_title`, `meta_description`, Open Graph fields `open_graph_title`, `open_graph_description`, `open_graph_url`, `open_graph_site_name`, `open_graph_type`, `open_graph_image`, and `schema_content`. The doc data marks `category_name` required.

### Locations

`GET /locator/api/v2/locations/:uuid` returns the full record, verified on a live instance on 7 October 2026. Field names from `private/graphql/_external/v2/locations/get_location.graphql`:

- **Identity:** `id`, `uuid`, `status`, `location_name`, `location_slug` (property `slug`), `category` (`{uuid, category_name, category_slug}`), `start_date`, `end_date`, `created_at`, `updated_at`.
- **Content:** `short_description`, `long_description`, `location_image`, `pin_icon`.
- **Address:** `address_1`, `address_2`, `address_3`, `city`, `county`, `district`, `suburb`, `state`, `country`, `country_code`, `postcode`, `latitude`, `longitude`, `geojson` (JSON).
- **Contact:** `phone_number`, `phone_country_code`, `fax_number`, `fax_country_code`, `email`, `website`.
- **Social:** `facebook_link`, `twitter_link`, `youtube_link`, `linkedin_link`, `instagram_link`, `snapchat_link`, `social_1_link`, `social_2_link`.
- **Opening hours, seven days:** for each of `monday` … `sunday`, four fields: `is_open_on_<day>` (boolean), `<day>_opening_time`, `<day>_closing_time`, `<day>_notes` (strings, free text such as `"7:00 AM"`).
- **Sitemap, SEO, Open Graph, `schema_content`:** same names as categories.
- **Media:** `image_1` … `image_5`, `file_1` … `file_5` (uploads), `gallery_1`, `gallery_2` (arrays of `modules/insites_crm/attachment` records).
- **FAQs:** `is_faqs_displayed`, `faqs_section_heading`, `faqs_section_subheading`. The FAQ rows themselves are admin-only.
- **Custom fields:** `custom_field` object, keyed by field name, joined from `modules/ins_locator/location_custom_field` with `location_uuid` removed.
- **System fields:** `system_fields[]` of `{id, uuid, system_field, value}`. The controller rebuilds this from `system_field_data` and the system-field table's metadata so `system_field` is the field's display name; it strips `system_field_uuids` and the raw `system_field` from the response.

On write, `locations/create.liquid` and `locations/update.liquid` accept every field above plus `category.uuid`, `custom_field.<name>` and `system_field_uuids`. Create writes a custom-field row for every defined field; update writes only the keys you send. The doc data for `custom_field` says GeoJSON, media files and media images are not supported through the API.

### Enquiries

Fields (`get_enquiry.graphql`): `id`, `uuid`, `location_uuid`, `location` (`{uuid, location_name, location_slug}`), `first_name`, `last_name`, `email`, `phone_number`, `phone_country_code`, `message`, `status`, `assigned_to_administrator_uuid`, `assigned_to` (joined to `users` on `external_id`), `created_at`, `updated_at`. `add_enquiry.graphql` declares `$location_uuid: String!`, so `location.uuid` is required on create. The create and update controllers strip a leading `+` from `phone_country_code`.

### System fields

Rows in `modules/insites_locator/location_system_field`: `id`, `uuid`, `system_field`, `value`, `created_at`, `updated_at` (`add_system_field.graphql`). The migration seeds the table's `metadata.system_fields` with ten entries named `System Field 1` … `System Field 10`, each with a fresh uuid; `system_fields/get.liquid` maps a row's stored `system_field` through that metadata and omits the key when no name matches. The create mutation stores `system_field` as sent, so send the uuid of a defined system field, not a free label. The doc example sends `"location_type"`; nothing in source makes that resolve.

### Custom fields

`GET /locator/api/v2/custom-fields` takes an optional `table` (default `modules/ins_locator/public/schema/location_custom_field.yml`) and returns `{ results: [ {id, name, attribute_type, metadata, belongs_to} ], created_at, updated_at }` (`get_custom_fields.graphql`). `DELETE /locator/api/v2/custom-fields/:id` re-submits the table's properties with the matching one flagged `_destroy` and returns the remaining list in the same shape. Definitions are created and edited in the admin only.
