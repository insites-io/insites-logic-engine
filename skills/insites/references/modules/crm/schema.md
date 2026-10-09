# CRM — Schema reference

Field-by-field shape for every CRM-specific resource. Use this when you need to know what fields a resource has, what their types are, what's required, how related-record fields are exposed, and which fields drive the IIA list views.

For endpoints, conventions, and worked examples see [`api.md`](api.md) and [`patterns.md`](patterns.md). For globals (tasks, activities, attachments, event streams) see [`globals/`](globals/).

---

## Three layers of schema

This document synthesizes three sources of truth that exist in the codebase:

| Layer | What it defines |
|---|---|
| **Wire shape** | What an API consumer sees in request/response bodies (friendly names like `category`, `assigned_to`; nested `{uuid, value}` objects for related records). |
| **Storage schema** | The actual database columns. Often uses a `<name>_uuid` suffix (e.g. `category_uuid`) and refers to related records by UUID only. |
| **IIA UI usage** | Which fields show up in IIA's list/table view, which appear in filter UI, which use `select_data_source` dropdowns, etc. |

The API layer translates wire ↔ storage. When you write `{"category.uuid": "abc-…"}` on input, the server stores `category_uuid = "abc-…"`. On output the server inflates `category_uuid` back to `{ "category": { "uuid": "abc-…", "value": "Customer" } }`.

### Where Contact base fields live

Contacts are not a standalone schema. The base identity fields — `uuid`, `first_name`, `last_name`, `name` (auto-generated), `email` — live on the platform's `users` table. Everything else (job_title, phone numbers, social links, alerts, addresses, custom fields, etc.) lives on the `crm_contact` user_profile_type that extends `users`. The API hides this layering and presents both as one flat resource.

Companies have their own `crm_company` schema (no user-table dependency).

---

## Reading the field tables

- **Wire field** — the name as seen in API request/response bodies.
- **Storage** — the underlying column name when it differs from the wire field. Blank means wire and storage match.
- **Required** — required at the **API level** on `POST` (create). Update (`PATCH`) accepts any subset of fields. Object-level "required" labels in the IIA admin UI may differ — they reflect UI-form requirements, not API ones.
- **Type** — the field type. `data_source` indicates a related-record reference; on input send `<field>.uuid`, on output you get a nested object.
- **In list table** — appears in the IIA contacts/companies list view as a column (from `is_in_column: true` in the vue field model).
- **System** — server-managed, read-only on input.

Common LIST query params (params-only fields like `page`, `size`, `sort_by`, etc.) are shared across resources and documented once at the top of this file.

---

## Shared list query params

These appear on every paginated LIST endpoint in CRM v2 (with the divergences noted in [`gotchas.md`](gotchas.md) — notably `event-streams` uses `per_page` instead of `size`).

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | integer | `1` | 1-based page index |
| `size` | integer | `10` | Page size |
| `search_by` | string | resource-specific | Field name to search against |
| `keyword` | string | — | Search keyword |
| `exact` | boolean | `false` | When `"true"`, exact-match (case-sensitive) instead of substring |
| `sort_by` | string | `last_updated` | Field name to sort by |
| `sort_order` | string | `DESC` | `ASC` or `DESC`, case-insensitive |

For per-resource sort/search defaults that differ from the table above, see the resource section.

---

## Contacts

A person record. Core CRM resource. Extensive field set including identity, contact info, social links, alert messages, ownership, custom fields, and surfaced profiles.

**Storage:** identity (`uuid`, `first_name`, `last_name`, `name`, `email`) lives on the platform's `users` table. Everything else lives on the `crm_contact` user_profile_type. The API hides this and presents both as one resource.

**IIA list-table columns** (visible in `<your-instance>/admin/insites#/crm/contacts`):
`name` · `email` · `email_2` · `job_title` · `company` · `assigned_to` · `category` · `type` · `lead_source` · `created_at`

Other fields exist on the resource but are only visible in the detail view, not the list table.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | number | — | Auto-assigned numeric id (read-only) |
| `uuid` | string | yes (read; auto on create) | Auto-assigned UUID for this contact |
| `uuids` | array | — | Set of UUIDs for bulk-style query params (params-only) |
| `is_archived` | boolean | — | Whether the contact is archived. Default `false` |
| `contact_avatar` | upload | — | Profile image. JPG/JPEG/PNG, recommended ≤100KB / 360×360 |
| `prefix` | string | — | Mr., Ms., Dr., etc. |
| `first_name` | string | — | First name (UI-required, not API-required) |
| `last_name` | string | — | Last name (UI-required, not API-required) |
| `name` | string | system | Full name, auto-generated as "First Last" |
| `gender` | string | — | One of: `male`, `female`, `other`, `not_supplied` |
| `birth_date` | string | — | ISO date |
| `nationality` | string | — | Country/nationality string |
| `job_title` | string | — | The contact's job title |
| `company` | data_source `companies` | — | Linked company. Send `company.uuid`, receive `{uuid, company_name}` |
| `email` | string | **yes** | Primary email address (only API-required field) |
| `email_2` | string | — | Secondary email |
| `work_phone_country_code` / `work_phone_number` | string | — | Work phone |
| `home_phone_country_code` / `home_phone_number` | string | — | Home phone |
| `mobile_phone_country_code` / `mobile_phone_number` | string | — | Mobile phone |
| `default_address` | data_source `addresses` | — | Default contact address. `{uuid, address_label}` |
| `assigned_to` | data_source `contacts` (admins) | — | Admin responsible. `{uuid, name, email}` |
| `type` | data_source `system_fields` | — | Contact type. `{uuid, value}`. Values from `system_field=contact_type` |
| `category` | data_source `system_fields` | — | Contact category. `{uuid, value}`. Values from `system_field=contact_category` |
| `lead_source` | data_source `system_fields` | — | Lead source. `{uuid, value}`. Values from `system_field=lead_source` |
| `facebook_link` / `twitter_link` / `youtube_link` / `linkedin_link` / `instagram_link` / `snapchat_link` | string | — | Social URLs |
| `social_1_link` / `social_2_link` | string | — | Additional social URLs |
| `has_alert_message_on_view` | boolean | — | Toggle for view-time alert |
| `alert_message_on_view` | string | — | Message shown on view |
| `has_alert_message_on_edit` | boolean | — | Toggle for edit-time alert |
| `alert_message_on_edit` | string | — | Message shown on edit |
| `notes` | string | — | Free-form notes (textarea) |
| `custom_field` | object | — | Nested object of custom-field values. On input use dotted keys (`custom_field.<name>`). Schema defined under contact_custom_fields. **GeoJSON / media files / media images not currently supported via this API.** |
| `stripe_id` | string | — | Stripe customer ID for payments |
| `owner_company` | data_source `companies` | — | Company that owns this contact |
| `owner_contact` | data_source `contacts` | — | Contact who owns this contact |
| `profiles` | object | system | User-assigned profiles (excludes internal `modules/insites_crm/*`). Keys are profile names with `/` and `-` replaced by `_`; values are property objects. See [`patterns.md`](patterns.md) and [`gotchas.md`](gotchas.md). |
| `created_at` / `updated_at` | string (ISO) | system | Timestamps |

**LIST defaults:** `sort_by=last_updated DESC`, `search_by=name`.

---

## Contact Addresses

Address records linked to a contact. Multiple per contact. Standard postal address fields plus geocoding. The IIA UI for managing them is the **Addresses** sub-tab on the contact detail view at `<your-instance>/admin/insites#/crm/contacts/<uuid>/addresses` — the same `Addresses` component is reused for both contacts and companies, so the field set and column layout are identical to *Company Addresses* below.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | number | — | Auto-assigned numeric id |
| `uuid` | string | yes (read; auto on create) | Auto-assigned UUID |
| `contact` | data_source `contacts` | — | Contact this address belongs to. Send `contact.uuid` |
| `address_label` | string | — | User-defined label ("Head Office", "Billing", etc.) |
| `address_1` / `address_2` / `address_3` | string | — | Address lines |
| `city` | string | — | City / town / locality |
| `county` | string | — | County / region |
| `district` | string | — | District |
| `suburb` | string | — | Suburb / locality within city |
| `state` | string | — | State / province / territory |
| `country` | string | — | Country full name |
| `country_code` | string | — | ISO 3166-1 alpha-2 code |
| `postcode` | string | — | Postal / ZIP code |
| `latitude` / `longitude` | string | — | Geographic coordinates |
| `geojson` | geojson | — | GeoJSON for the point or boundary |

**LIST defaults:** `sort_by=last_updated DESC`. Standard list params apply.

---

## Contact Personal Info

Free-form additional contact info, modelled as label/attribute/value triples. One contact can have many entries.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | number | — | Auto-assigned numeric id |
| `uuid` | string | — | Auto-assigned UUID |
| `related_uuid` | string | — | UUID of the parent contact |
| `related_type` | string | — | Always `contact` for this resource |
| `unique_content_label` | string | **yes** | Label for the info group (e.g., "Emergency Contact", "Social Media") |
| `attribute` | string | **yes** | Specific attribute (e.g., "Name", "Phone", "URL") |
| `value` | string | **yes** | The actual value |

---

## Contact Profiles

Used to assign or update profile properties on a contact. Profile assignment is hierarchical — a contact can have many profiles, each with many fields, each field having a typed value.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | number | — | Auto-assigned numeric id |
| `uuid` | string | yes | Contact UUID (path param) |
| `full_name` | string | system | Auto-generated contact full name |
| `email` | string | — | Contact's primary email |
| `profiles` | array | **yes** | Profile objects to assign or update |
| `profile` | string | **yes** | Profile name (within a `profiles[]` entry) |
| `fields` | object | **yes** | The fields of the profile (within a `profiles[]` entry) |

**Field value typing — params-only inside `fields`:**

| Field | Type | Description |
|---|---|---|
| `name` | string | Profile field name |
| `value` | string | If field type is String |
| `value_array` | array | If field type is Array |
| `value_int` | integer | If field type is Integer |
| `value_float` | float | If field type is Float |
| `value_boolean` | boolean | If field type is Boolean |
| `value_json` | geojson | If field type is GeoJSON |

Use the matching `value*` key for each field's declared type. Internal Insites profiles (`modules/insites_crm/*`) are stripped from responses — see [`gotchas.md`](gotchas.md).

---

## Contact Relationships

Links between contacts (or contact-to-company). The relationship has its own UUID and metadata.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | number | — | Auto-assigned numeric id |
| `uuid` | string | — | Auto-assigned UUID for this relationship |
| `contact` | data_source `contacts` | **yes** | Contact in the relationship |
| `related_crm_type` | string | **yes** | `contact` or `company` |
| `related_crm` | data_source `contacts`/`companies` | **yes** | UUID of the related entity |
| `related_contact` | data_source `contacts` | yes (when `related_crm_type=contact`) | The related contact |
| `related_company` | data_source `companies` | yes (when `related_crm_type=company`) | The related company |
| `relationship_type` | data_source `system_fields` | — | `{uuid, value}` from `system_field=relationship` |
| `notes` | string | — | Free-form notes |

**LIST defaults:** `sort_by=last_updated DESC`. Standard list params apply.

---

## Companies

A company record. Core CRM resource. Identity, contact info, social links, alerts, ownership, custom fields, plus an `assign-contacts` lifecycle action.

**Storage:** all fields live on the `crm_company` schema (no `users`-table dependency, unlike contacts).

**IIA list-table columns** (visible in `<your-instance>/admin/insites#/crm/companies`):
`company_name` · `email_1` · `registered_business_number` · `category` · `industry` · `type` · `assigned_to` · `created_at`

**Field grouping in the IIA detail view** — fields are grouped into sections shown in this order: *Details* (avatar, name, registration number, stripe_id, category, industry, type, lead_source, assigned_to, owner_company, owner_contact), *Company Details* (website, email_1/2/3, phones), *Social Media*, *Tax*, *Alert Message*, *Notes*.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | number | — | Auto-assigned numeric id |
| `uuid` | string | yes (read; auto on create) | Auto-assigned UUID |
| `is_archived` | boolean | — | Default `false` |
| `company_avatar` | upload | — | Logo / branding. JPG/JPEG/PNG, ≤100KB / 360×360 recommended |
| `company_name` | string | UI-required | Full company name (UI-required, not API-required) |
| `registered_business_number` | string | — | Official registration number |
| `category` | data_source `system_fields` | — | `{uuid, value}` from `system_field=company_category` |
| `industry` | data_source `system_fields` | — | `{uuid, value}` from `system_field=industry` |
| `assigned_to` | data_source `contacts` (admins) | — | Admin user responsible |
| `type` | data_source `system_fields` | — | `{uuid, value}` from `system_field=company_type` |
| `website` | string | — | Company website URL |
| `email_1` / `email_2` / `email_3` | string | — | Email addresses (primary, secondary, alternative) |
| `phone_1_*` / `phone_2_*` / `phone_3_*` | string | — | Three phone slots, each with country_code + number |
| `mobile_phone_country_code` / `mobile_phone_number` | string | — | Mobile phone |
| `facebook_link` / `twitter_link` / `youtube_link` / `linkedin_link` / `instagram_link` / `snapchat_link` | string | — | Social URLs |
| `social_1_link` / `social_2_link` | string | — | Additional social URLs |
| `is_tax_registered` | boolean | — | Tax registration flag |
| `tax_reference` | string | — | Tax reference number |
| `notes` | string | — | Free-form notes |
| `has_alert_message_on_view` / `alert_message_on_view` | boolean / string | — | View-time alert |
| `has_alert_message_on_edit` / `alert_message_on_edit` | boolean / string | — | Edit-time alert |
| `default_address` | data_source `addresses` | — | `{uuid, address_label}` |
| `owner_company` | data_source `companies` | — | Parent / owner company |
| `contact_uuids` | array | — | List of contact UUIDs to assign to the company (used by `assign-contacts` lifecycle action) |
| `owner_contact` | data_source `contacts` | — | Contact who owns this company |
| `stripe_id` | string | — | Stripe customer ID |
| `lead_source` | data_source `system_fields` | — | `{uuid, value}` from `system_field=lead_source` |
| `custom_field` | object | — | Custom-field values via dotted keys. **GeoJSON / media files / media images not supported via this API.** |
| `created_at` / `updated_at` | string (ISO) | system | Timestamps |

**LIST defaults:** `sort_by=last_updated DESC`.

---

## Company Addresses

Address records linked to a company. Same field set as contact_addresses except the parent reference is `company` instead of `contact`. The IIA UI is the **Addresses** sub-tab on the company detail view at `<your-instance>/admin/insites#/crm/companies/<uuid>/addresses` — same `Addresses` component as for contacts.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | number | — | Auto-assigned numeric id |
| `uuid` | string | yes (read; auto on create) | Auto-assigned UUID |
| `company` | data_source `companies` | — | Company this address belongs to. Send `company.uuid` |
| `address_label` | string | — | User-defined label |
| `address_1` / `address_2` / `address_3` | string | — | Address lines |
| `city` / `county` / `district` / `suburb` / `state` | string | — | Locality fields |
| `country` | string | — | Country full name |
| `country_code` | string | — | ISO 3166-1 alpha-2 code |
| `postcode` | string | — | Postal / ZIP code |
| `latitude` / `longitude` | string | — | Geographic coordinates |
| `geojson` | geojson | — | GeoJSON point or boundary |

**LIST defaults:** `sort_by=last_updated DESC`.

---

## Company Info

Same shape as contact_personal_info, but parent is a company. Free-form label/attribute/value triples.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | number | — | Auto-assigned numeric id |
| `uuid` | string | — | Auto-assigned UUID |
| `related_uuid` | string | — | UUID of the parent company |
| `related_type` | string | — | Always `company` for this resource |
| `unique_content_label` | string | **yes** | Label for the info group |
| `attribute` | string | **yes** | Specific attribute |
| `value` | string | **yes** | The actual value |

---

## Company Relationships

Links between a company and another company or contact. Same shape as contact_relationships with the parent being a company.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | number | — | Auto-assigned numeric id |
| `uuid` | string | — | Auto-assigned UUID for this relationship |
| `company` | data_source `companies` | **yes** | Company in the relationship |
| `related_crm_type` | string | **yes** | `contact` or `company` |
| `related_crm` | data_source `contacts`/`companies` | **yes** | UUID of the related entity |
| `relationship_type` | data_source `system_fields` | — | `{uuid, value}` from `system_field=relationship` |
| `notes` | string | — | Free-form notes |

**LIST defaults:** `sort_by=last_updated DESC`. Standard list params apply.

---

## Contact Custom Fields

Definition records for the contact custom-field schema. The endpoint manages **definitions**, not values. To set values per-contact, use `custom_field.<name>` dotted keys on the Contact endpoints.

| Field | Type | Description |
|---|---|---|
| `id` | string | Numeric id of the custom-field definition (used in DELETE path — note: `:id`, not `:uuid`) |
| `name` | string | Field name (used as the dotted key when setting values: `custom_field.<name>`) |
| `attribute_type` | string | Storage type: `string`, `integer`, `float`, `boolean`, `array`, `geo_json` |
| `belongs_to` | string | Schema path the field belongs to |
| `metadata` | object | Display metadata: `label`, `weight`, `options`, `ui_element`, `show_in_quick_view` |

The list response is **not paginated** — see [`gotchas.md`](gotchas.md).

---

## Company Custom Fields

Same shape as contact_custom_fields, scoped to companies.

| Field | Type | Description |
|---|---|---|
| `id` | string | Numeric id of the custom-field definition |
| `name` | string | Field name (dotted key for value-setting on Companies: `custom_field.<name>`) |
| `attribute_type` | string | `string`, `integer`, `float`, `boolean`, `array`, `geo_json` |
| `belongs_to` | string | Schema path the field belongs to |
| `metadata` | object | Display metadata |

---

## System Fields

Named option lists that populate dropdowns across the CRM (contact type, company category, lead source, industry, relationships, etc.). Each row is one value within one named group.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | number | — | Auto-assigned numeric id |
| `uuid` | string | system | Auto-assigned UUID |
| `system_field` | string | **yes** | Group name. One of: `company_category`, `company_type`, `contact_category`, `contact_type`, `industry`, `lead_source`, `relationship` |
| `value` | string | **yes** | The specific option value |
| `created_at` / `updated_at` | string (ISO) | system | Timestamps |

**LIST defaults:** `sort_by=created_at`. Resource-specific filter param: `system_field` (filter to one group). Standard list params apply.

---

## Field-typing notes

- **Custom-field values via dotted keys.** When sending a custom-field value, use a flat dotted key in the request body: `"custom_field.region": "EMEA"`. The server maps the value into the correct typed slot (`value`, `value_int`, `value_float`, `value_boolean`, `value_array`, `value_json`) based on the definition's `attribute_type`. Do not send a nested object on input.
- **GeoJSON, media files, and media images** are not currently writable via the V2 API for `custom_field` values. They appear in `attribute_type` but require a different (non-public) write path.
- **Data-source dropdowns.** Where a field has `data_source: { module, object, fields }`, the response inflates that field to a nested object containing the listed fields (e.g., `company: { uuid, company_name }`). On input you send `<field>.uuid` only — additional related fields are ignored.
- **`is_system_field: true`** — these are server-managed and read-only on input. Sending them in a request body has no effect.
- **`params_only: true`** — these are query-string-only fields used by LIST endpoints. They are not part of the request/response body of POST/PATCH calls.

---

## Wire ↔ storage name mapping

For most fields, the wire name and storage column name are identical (`first_name`, `email`, `notes`, etc.). The exceptions are related-record references — wire side uses friendly names with inflated objects; storage uses `<name>_uuid` columns. This table is for understanding how queries against the schema layer map back to API-visible fields:

| Wire field (API) | Storage column | Notes |
|---|---|---|
| `company` | `company_uuid` | Contacts only — links to `crm_company` |
| `assigned_to` | `assigned_to_administrator_uuid` | Both — links to `users` |
| `type` | `type_uuid` | Both — links to `crm_system_field` (group `contact_type` / `company_type`) |
| `category` | `category_uuid` | Both — links to `crm_system_field` |
| `industry` | `industry_uuid` | Companies only — links to `crm_system_field` |
| `lead_source` | `lead_source_uuid` | Both — links to `crm_system_field` |
| `default_address` | `default_address_uuid` | Both — links to `crm_address` |
| `owner_company` | `owner_company_uuid` | Both — links to `crm_company` |
| `owner_contact` | `owner_contact_uuid` | Both — links to `users` |
| `custom_field` | `custom_field_uuid` | One-to-one with a `crm_custom_field` properties record (the bag holding all `custom_field.<name>` values) |

You should not need to use the storage names from API code — they're documented here only so you understand what's happening underneath when reading IIA URL configurations, GraphQL queries, or schema YAML.
