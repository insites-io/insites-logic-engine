# Locator: Gotchas

Edges visible in the module source (module-v6-locator v6.0.2, read 9 October 2026; paths relative to `modules/insites_locator/`). Each entry: **what bites**, **why**, **how to avoid**.

---

## 1. `format=json` is required for a real status code

**Bites:** a failed write comes back `200` with an `errors` array in the body.

**Why:** all 22 V2 controllers wrap `response_handler` in `{%- if context.params.format == 'json' -%}`; without it nothing sets the status.

**Avoid:** append `?format=json` to every request and treat an `errors` key as failure whatever the status.

---

## 2. `enquiries/filters/get_filter_options` is ungated, returns nothing, and is an orphan

**Bites:** `{% function x = "locator/controller/enquiries/filters/get_filter_options" %}` leaves `x` blank and rewrites your page's headers.

**Why:** `controllers/enquiries/filters/get_filter_options.liquid` includes `response_handler` with no gate and has no `{% return %}`; it also tests `results.errors` where `results` is never assigned, so it always reports `200`. No page under `private/views/pages/` includes it, and its own comment records that the endpoint it was written for never worked. The other 22 controllers gate and return.

**Avoid:** do not call it. See [`patterns.md`](patterns.md#7-do-not--function--the-filter-options-controller).

---

## 3. The custom-field table is named `modules/ins_locator/...`, not `insites_locator`

**Bites:** a query against `modules/insites_locator/location_custom_field` finds no table.

**Why:** `private/migrations/20231002003624_add_custom_field_schema.liquid` creates the table with `physical_file_path: "modules/ins_locator/public/schema/location_custom_field.yml"`, a module name from before the rename. The API defaults to that path (`controllers/_external/v2/custom_fields/get.liquid`) and the CRM, Data and Forms modules hard-code it ([`advanced.md`](advanced.md)).

**Avoid:** use `modules/ins_locator/location_custom_field` as the table and the `.../public/schema/...` path as `table`. Do not "fix" the name; it is the live table on every instance. Neither this table nor `location_system_field` has a YAML file; both come from migrations, so count nine tables, not seven ([`05-storing-data.md`](../../building-on-insites/05-storing-data.md) carries the same warning).

---

## 4. `belongs_to` in the YAML points at a module that does not exist

**Bites:** tooling that follows `belongs_to` to resolve relationships finds `modules/insites_locations/location`.

**Why:** `private/schema/enquiry.yml` and `location_faq.yml` declare `belongs_to: modules/insites_locations/location` (note `locations`), and `location.yml` has its `category_uuid` and `system_field_uuids` `belongs_to` lines commented out. The GraphQL queries join with explicit `related_record` calls, so the API works regardless.

**Avoid:** take relationships from the `_external/v2/*.graphql` files, not the YAML.

---

## 5. Sorting: the default is `uuid ASC`, and slug wire names are not property names

**Bites:** list results look shuffled, and `sort_by=location_slug` or `sort_by=category_slug` sorts on nothing.

**Why:** every list controller sets `sort_by | default: "uuid"` and `sort_order | default: "ASC"`. The stored slug property is `slug` (`location.yml`, `category.yml`); the queries alias it to `location_slug` / `category_slug`, and the list controllers build a property sort from `sort_by` as given with no translation in `models/payload_fields.liquid`. Source shows the mismatch; the sort outcome was not tested.

**Avoid:** always send `sort_by=updated_at` (or `created_at`, or a real property name) with an explicit `sort_order`.

---

## 6. Custom-field delete takes a numeric id; everything else takes a uuid

**Bites:** `DELETE /locator/api/v2/custom-fields/<uuid>` returns `404 field_not_found`.

**Why:** `:id` is the property id inside the admin table's `properties[]` (`custom_fields/delete.liquid`), not a record uuid.

**Avoid:** read the id from `GET /locator/api/v2/custom-fields` first.

---

## 7. Creating a location writes every custom field; updating writes only what you send

**Bites:** after `POST`, the location has a custom-field row with blank values for every defined field; after `PUT` with one key, the others are untouched.

**Why:** `locations/create.liquid` loops over all defined fields; `locations/update.liquid` adds `properties_keys contains field.name` to the loop.

**Avoid:** expect empty values on a fresh record and treat `PUT` as a merge for custom fields.

---

## 8. System-field `system_field` is a uuid on write and a name on read

**Bites:** `POST /locator/api/v2/system-fields` with `"system_field": "location_type"` succeeds, but `GET` on it returns no `system_field` key.

**Why:** `add_system_field.graphql` stores the value as sent. `system_fields/get.liquid` maps it through the table metadata (`uuid` to `system_field_name`) and adds the key only when a match exists; the location controllers fall back to the raw uuid. The doc data's example payload uses a free label.

**Avoid:** send the uuid of a defined system field (the migration seeds ten; the admin renames them).

---

## 9. `+` is stripped from `phone_country_code` on enquiries only

**Bites:** a location saved with `"phone_country_code": "+61"` keeps the `+`; an enquiry with the same input is stored as `61`.

**Why:** `enquiries/create.liquid` and `update.liquid` run `replace: '+', ''`; the location controllers do not.

**Avoid:** normalise before sending.

---

## 10. The doc data's error examples do not match source

**Bites:** client code written from the admin API docs expects `{ "error": "Unauthorized" }` on 401 and a string on 400.

**Why:** the partials under `private/views/partials/insites_api/external_api/` show those strings. The real 401 body comes from the CRM `api/401` page (`{ "error": "unauthorized", "message": "Invalid or revoked API key", "type": "authentication_error" }`) and the controllers' own 400 and 404 bodies are `{ "errors": [ { "code", "message" } ] }`.

**Avoid:** accept both the `error` string and the `errors` array as failure.

---

## 11. The legacy v1 pages still exist, and single-enquiry GET is broken

**Bites:** `GET /locator/api/v1/enquiries/<uuid>` returns the list.

**Why:** `private/views/pages/api/_external/enquiries/get.liquid` extracts `{id}` from the path template then tests `params.uuid`, which is never set, so it always takes the list branch. The ten v1 pages include their controllers by file path, declare no alias and have no doc data; `CHANGELOG.md` v6.0.2 (TW#26801435) waives the versioning lint until they move.

**Avoid:** use V2.

---

## 12. Three version strings, none of them the tag

**Bites:** "which Locator is installed?" gets three answers.

**Why:** `hook_module_info.liquid` says `6.0.0`, the generated `insites_locator_dependencies.liquid` header says `v6.0.1`, `vue/package.json` says `6.0.2`; the tag is `v6.0.2`. Release tooling bumps neither the hook nor the partial header.

**Avoid:** read the tag or the Console changelog; use the hook only for "is it installed".
