# Locator: Configuration

What an instance administrator sets up in the IIA admin for the Locator module, and what the module creates on install. Modules are preinstalled on Insites instances; updates arrive through the Insites console. Paths below are relative to `pos/modules/insites_locator/` in module-v6-locator (v6.0.2, read 9 October 2026).

For authentication, see [`../../api/authentication.md`](../../api/authentication.md).

---

## IIA admin paths

The admin SPA routes come from `vue/src/router/` and the side menu from `private/views/partials/insites_menu/insites_locator_side_menu.liquid`, which lists Categories, Locations, Enquiries, Custom Fields and System Fields under a "Locator" entry.

| What | IIA path |
|---|---|
| Categories list / add / edit | `<your-insites-instance>/admin/insites#/locator/categories`, `/add`, `/:uuid` |
| Locations list / add / edit | `<your-insites-instance>/admin/insites#/locator/locations`, `/add`, `/:uuid` |
| Enquiries list / view | `<your-insites-instance>/admin/insites#/locator/enquiries`, `/:uuid` |
| Custom-field definitions for locations | `<your-insites-instance>/admin/insites#/locator/custom-fields/locations/configuration` |
| System fields | `<your-insites-instance>/admin/insites#/locator/system-fields` |

The location editor's tabs (`vue/src/router/`: `content`, `address`, `contact-details`, `social-media`, `open-hours`, `media`, `gallery`, `faqs`, `metadata`, `open-graph`, `sitemap`, `schema`, `custom-fields`, `system-fields`) map one-to-one onto the field groups in [`api.md`](api.md#locations). The CRM admin shell renders the menu only when `context.modules.insites_locator` is set.

---

## What the admin can do that the API cannot

The 51 admin pages under `private/views/pages/api/` (slug prefix `insites/locator/`, policy `modules/insites_crm/insites_only_allowed_by_administrators`) add:

| Capability | Admin page slug |
|---|---|
| FAQs per location | `insites/locator/locations/:uuid/faqs` (GET, POST, PUT, DELETE) |
| Attachments for locations, categories and FAQ answers | `insites/locator/locations/attachments`, `.../categories/attachments`, `.../faqs/attachments` |
| CSV import and export | `insites/locator/{locations,categories,enquiries}/import` (POST), `.../exports` (GET) |
| Saved advanced filters per administrator | `insites/locator/{locations,categories,enquiries}/filters` |
| Custom-field definition create and update | `insites/locator/locations/custom-fields` (POST, PUT), `insites/locator/custom-fields/locations` (POST) |
| Renaming the ten system-field labels | `insites/locator/system-fields/labels` (PUT) |
| Administrator options for enquiry assignment | `insites/locator/administrators/options` |
| Google Maps API key for the editor | `insites/locator/utilities/google-maps` |

Saved filters are stored in the three `filters/locator_*_filter.yml` tables keyed by `administrator_uuid`.

---

## Custom fields on locations

Definitions are properties of the table `modules/ins_locator/location_custom_field`: `name`, `attribute_type` (`string`, `integer`, `float`, `boolean`, `array`, `geo_json`, per `controllers/_external/v2/locations/create.liquid`), `metadata` and `belongs_to`. Define them at the configuration path above, then write values through the API as `custom_field.<name>`. The API lists and deletes definitions ([`api.md`](api.md#custom-fields)) but cannot create or edit them.

---

## System fields

`private/migrations/20231018065328_add_system_fields_schema.liquid` creates `modules/insites_locator/location_system_field` with a `system_field` property whose metadata holds ten placeholders, `System Field 1` to `System Field 10`, each with a generated uuid. The admin renames them through the labels page; values attach to locations as rows (`system_field` = the placeholder's uuid, `value` = text) referenced from the location's `system_field_uuids` array.

---

## Google Maps

The admin page `insites/locator/utilities/google-maps` calls CRM's `modules/insites_crm/integrations/google_maps/get_google_maps_api_key` (`controllers/utilities/google_maps/get_details.liquid`). The key is configured in the CRM integrations settings; the Locator source does not contain the admin path for that.

---

## What install creates and seeds

Seven tables from `private/schema/` and two from `private/migrations/` (list in [`README.md`](README.md#tables-the-module-creates)); both migrations log "already exist" and continue when the table is present. The only seeded data is the ten system-field placeholders. No categories, locations or enquiries are seeded, no webhooks or email exist, and module install and updates happen through the Insites console.
