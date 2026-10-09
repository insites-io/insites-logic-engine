# CRM — V2 REST API

The CRM module exposes a V2 REST API at the `/crm/api/v2/...` URL prefix. It covers contacts, companies (and their sub-resources), custom fields, system fields, and a small geocoding utility.

This document describes the **CRM-specific** resources. Resources owned by CRM but consumed cross-module (tasks, activities, attachments, event streams) live under [globals/](globals/) at the same `/crm/api/v2/...` URL space.

For the field-by-field shape of every CRM resource (types, required flags, related-record references, IIA list-table columns, wire ↔ storage naming), see [schema.md](schema.md).

For authentication, see [`references/api/authentication.md`](../../api/authentication.md). Every request needs an `Authorization` header carrying the raw instance API key — there is no `Bearer` prefix.

---

## Conventions

The following hold for every CRM-specific endpoint unless explicitly noted on a resource section.

### URL pattern

```
<method> /crm/api/v2/<resource>[/<id-or-uuid>][/<action>]
```

- IDs are UUIDs everywhere except **custom fields**, which use numeric `:id` (platform schema constraint — not a bug, do not "fix" it).
- Lifecycle operations are exposed as `PATCH` with a semantic suffix:
  - `PATCH /crm/api/v2/contacts/:uuid/archive`
  - `PATCH /crm/api/v2/contacts/:uuid/restore`
  - `PATCH /crm/api/v2/companies/:uuid/assign-contacts`

### Request format

- **Body:** JSON. Form-encoded params also work via `context.params`.
- **Path parameters:** `:uuid`, `:id`, `:contact_uuid`, `:company_uuid` per endpoint.
- **Nested references via dotted-path keys:** to reference a related record by UUID, send a flat key with a dotted name, e.g.:

  ```json
  { "company.uuid": "abc-…", "default_address.uuid": "zxy-…" }
  ```

  The response inflates these into nested objects:

  ```json
  { "company": { "uuid": "abc-…", "company_name": "Acme" }, ... }
  ```

- **Custom field values** use the same dotted style: `"custom_field.<field_name>": <value>`. The response nests them under a `custom_field` object.

### Response — success

The resource (or list envelope) is returned at the top level:

```json
{ "uuid": "abc-…", "first_name": "Jane", "...": "..." }
```

Date/time fields use ISO 8601. Every resource includes `id`, `uuid`, `created_at`, `updated_at`.

### Response — error

**The error response shape is not yet standardized across CRM v2 endpoints.** Two forms are observed in the wild:

```json
{ "error": "Bad Request - Validation Failed" }
```

```json
{ "errors": [{ "code": "no_contact", "message": "The requested contact doesn't exist." }] }
```

The single-string `error` form is what the public docs advertise; the `errors` array form is what the controller layer produces internally for validation/business failures. Until a standard lands, **client code should accept both** — check for `error` (string) and `errors` (array) keys and treat either as failure.

Status codes:

- `400` — validation or business-rule failure
- `401` — auth header missing or invalid (returned by the auth policy, not the controller)
- `404` — resource not found (only on GET-by-uuid endpoints)

Treat any non-2xx response, or any payload containing an `error`/`errors` key, as a failure.

### List envelope

LIST endpoints return:

```json
{
  "total_entries": 142,
  "total_pages": 15,
  "page": 1,
  "size": 10,
  "results": [ /* items */ ]
}
```

### Common LIST query parameters

| Param | Default | Notes |
|---|---|---|
| `page` | `1` | 1-based page index |
| `size` | `10` | Page size |
| `sort_by` | resource-specific | e.g. `last_updated` for contacts |
| `sort_order` | `DESC` | `ASC` or `DESC` (case-insensitive) |
| `search_by` | resource-specific | Field name to search against |
| `keyword` | — | Search keyword |
| `exact` | `false` | `"true"` matches whole-value, case-sensitive |

Resource-specific filters (e.g. `system_field` on system fields) are documented per resource.

### Response headers

Every JSON response includes:

```
Content-Type: application/json
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'none'; frame-ancestors 'none'
```

### Webhooks

Webhook coverage on CRM v2 is limited to **create and update on the two core resources** (contacts, companies). The full list:

| Endpoint | Event type | Payload |
|---|---|---|
| `POST /crm/api/v2/contacts` | `contact_created` | The created contact |
| `PATCH /crm/api/v2/contacts/:uuid` | `contact_updated` | The updated contact |
| `POST /crm/api/v2/companies` | `company_created` | The created company |
| `PATCH /crm/api/v2/companies/:uuid` | `company_updated` | The updated company |

**No webhooks fire on:** `DELETE`, archive/restore, `assign-contacts`, any sub-resource (addresses, info, personal_info, profiles, relationships), custom fields, system fields, google maps.

---

## Resources

### Contacts

CRUD plus archive/restore lifecycle. Sub-resources for addresses, personal info, profiles, and contact-to-contact relationships.

**Full field reference:** `<your-insites-instance>/admin/api/crm/contacts/overview`

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/crm/api/v2/contacts` | Create a contact |
| `GET` | `/crm/api/v2/contacts` | List contacts (paginated) |
| `GET` | `/crm/api/v2/contacts/:uuid` | Read one contact |
| `PATCH` | `/crm/api/v2/contacts/:uuid` | Update a contact |
| `DELETE` | `/crm/api/v2/contacts/:uuid` | Delete a contact |
| `PATCH` | `/crm/api/v2/contacts/:uuid/archive` | Archive (soft-hide) |
| `PATCH` | `/crm/api/v2/contacts/:uuid/restore` | Restore from archive |

**Sub-resources** — same CRUD shape, full field references at `<your-insites-instance>/admin/api/crm/<sub-resource>/overview`:

- `contact_addresses` — `/crm/api/v2/contacts/addresses[/:uuid]`
- `contact_personal_info` — `/crm/api/v2/contacts/:contact_uuid/personal_info[/:uuid]`
- `contact_profiles` — `POST` and `PATCH` only at `/crm/api/v2/contacts/:contact_uuid/profiles`
- `contact_relationships` — `/crm/api/v2/contacts/relationships[/:uuid]`

**Required fields on create:** `email` only.

#### Example — create a contact

```http
POST /crm/api/v2/contacts?format=json HTTP/1.1
Authorization: instance_aB3xK9pQ7mN2vL8wR4tY1zE6cF5sJ0hG
Content-Type: application/json

{
  "first_name": "Jane",
  "last_name": "Smith",
  "email": "jane.smith@example.com",
  "company.uuid": "abcdef12-3456-7890-abcd-ef1234567890",
  "type.uuid": "type-uuid-example",
  "custom_field.region": "EMEA"
}
```

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": 1213,
  "uuid": "generated-contact-uuid-123",
  "is_archived": false,
  "first_name": "Jane",
  "last_name": "Smith",
  "name": "Jane Smith",
  "email": "jane.smith@example.com",
  "company": {
    "uuid": "abcdef12-3456-7890-abcd-ef1234567890",
    "company_name": "Acme Marketing Solutions"
  },
  "type": { "uuid": "type-uuid-example", "value": "Customer" },
  "custom_field": { "region": "EMEA" },
  "profiles": null,
  "created_at": "2025-05-02T09:07:00.000Z",
  "updated_at": "2025-05-02T09:07:00.000Z"
}
```

**Profile filtering on the response.** Internal Insites profiles (anything matching `modules/insites_crm/*`) are stripped. Only user-assigned feature profiles surface, with their `/` and `-` characters replaced by `_` in the key — e.g. a profile named `modules/ins_permission_manager/admin` is returned at `profiles.modules_ins_permission_manager_admin`.

---

### Companies

CRUD plus archive/restore. Includes an `assign-contacts` lifecycle action.

**Full field reference:** `<your-insites-instance>/admin/api/crm/companies/overview`

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/crm/api/v2/companies` | Create a company |
| `GET` | `/crm/api/v2/companies` | List companies |
| `GET` | `/crm/api/v2/companies/:uuid` | Read one company |
| `PATCH` | `/crm/api/v2/companies/:uuid` | Update a company |
| `DELETE` | `/crm/api/v2/companies/:uuid` | Delete a company |
| `PATCH` | `/crm/api/v2/companies/:uuid/archive` | Archive |
| `PATCH` | `/crm/api/v2/companies/:uuid/restore` | Restore |
| `PATCH` | `/crm/api/v2/companies/:uuid/assign-contacts` | Link contacts to a company |

**Sub-resources** — full field references at `<your-insites-instance>/admin/api/crm/<sub-resource>/overview`:

- `company_addresses` — `/crm/api/v2/companies/addresses[/:uuid]`
- `company_info` (extensible "about" entries) — `/crm/api/v2/companies/:company_uuid/info[/:uuid]`
- `company_relationships` — `/crm/api/v2/companies/relationships[/:uuid]`

#### Example — assign contacts to a company

```http
PATCH /crm/api/v2/companies/generated-company-uuid-987/assign-contacts?format=json HTTP/1.1
Authorization: instance_aB3xK9pQ7mN2vL8wR4tY1zE6cF5sJ0hG
Content-Type: application/json

{
  "contact_uuids": [
    "123e4567-e89b-12d3-a456-426614174000",
    "f0e1d2c3-b4a5-6789-0abc-def123456789"
  ]
}
```

The response is the full updated company object (id, uuid, company_name, contact info, owner_company / owner_contact / assigned_to / category / industry / type / lead_source as nested `{uuid, ...}` references, custom_field, timestamps).

---

### Custom fields

Manage the custom-field **schema** (definitions) for contacts and companies. **This is the only CRM resource that uses numeric `:id` instead of `:uuid`** — platform schema constraint.

**Full field reference:**
- `<your-insites-instance>/admin/api/crm/contact-custom-fields/overview`
- `<your-insites-instance>/admin/api/crm/company-custom-fields/overview`

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/crm/api/v2/custom-fields/contacts` | List contact custom-field definitions |
| `DELETE` | `/crm/api/v2/custom-fields/contacts/:id` | Remove a contact custom-field definition |
| `GET` | `/crm/api/v2/custom-fields/companies` | List company custom-field definitions |
| `DELETE` | `/crm/api/v2/custom-fields/companies/:id` | Remove a company custom-field definition |

Setting and reading custom-field **values** for a specific contact or company happens via the contact/company endpoints using `custom_field.<name>` dotted keys (see *Contacts* example). The endpoints in this section manage definitions only.

#### Example — list contact custom-field definitions

```http
GET /crm/api/v2/custom-fields/contacts?format=json HTTP/1.1
Authorization: instance_aB3xK9pQ7mN2vL8wR4tY1zE6cF5sJ0hG
```

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "results": [
    {
      "name": "array_card_select_multiple",
      "attribute_type": "array",
      "metadata": {
        "label": "Array Card Select Multiple",
        "weight": 7,
        "options": [
          { "value": "Value 1", "content": "Content 1" },
          { "value": "Value 2", "content": "Content 2" }
        ],
        "ui_element": "card_select_multiple",
        "show_in_quick_view": true
      },
      "options": {},
      "belongs_to": null
    }
  ]
}
```

This response is **not paginated** — the full definitions list is returned as a single `results` array.

---

### System fields

Configuration values surfaced to the CRM as named fields (used for templated text, type/category dropdowns, lead-source values, etc.).

**Full field reference:** `<your-insites-instance>/admin/api/crm/system-fields/overview`

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/crm/api/v2/system-fields` | Create a system field |
| `GET` | `/crm/api/v2/system-fields` | List (paginated) |
| `GET` | `/crm/api/v2/system-fields/:uuid` | Read one |
| `PATCH` | `/crm/api/v2/system-fields/:uuid` | Update |
| `DELETE` | `/crm/api/v2/system-fields/:uuid` | Delete |

**Resource-specific LIST param:** `system_field` — filter the list to one named system field group (e.g. `contact_type`, `lead_source`).

#### Example — list values for a specific system field

```http
GET /crm/api/v2/system-fields?system_field=contact_type&size=20&format=json HTTP/1.1
Authorization: instance_aB3xK9pQ7mN2vL8wR4tY1zE6cF5sJ0hG
```

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "total_entries": 11,
  "total_pages": 1,
  "page": 1,
  "size": 20,
  "results": [
    {
      "id": 432,
      "uuid": "18fd4f95-b6db-4f66-80ce-952059a5c7ac",
      "system_field": "contact_type",
      "value": "Senior Management",
      "created_at": "2023-02-01T02:30:13.271Z",
      "updated_at": "2024-02-27T08:58:54.405Z"
    }
  ]
}
```

---

### Google Maps

Single-endpoint geocoding/lookup utility. Lives under the CRM URL prefix because `module-v5-core` houses it; treat it as a shared utility rather than a CRM-conceptual feature.

**Full field reference:** `<your-insites-instance>/admin/api/crm/google-maps-api-key/overview`

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/crm/api/v2/google-maps` | Lookup details / geocode |

---

## Global resources (used by other modules)

The following resources are owned by CRM but accessed by other modules under the same `/crm/api/v2/` URL prefix. Their reference docs live in [`globals/`](globals/) so other modules can link there without duplicating:

- [`globals/tasks.md`](globals/tasks.md) — tasks (with `complete`/`open` lifecycle) + task comments
- [`globals/activities.md`](globals/activities.md) — activities (calls, meetings, emails, tasks)
- [`globals/attachments.md`](globals/attachments.md) — attachments + temporary upload credentials
- [`globals/event_streams.md`](globals/event_streams.md) — event stream / audit feed

---

## Notes for the LLM consumer

- **Error shape is not yet standardized.** Check for both `error` (single string) and `errors` (array of `{code, message}`) keys in the response; treat either as failure regardless of HTTP status.
- **Dotted-path keys in requests**: when documenting a CRM call, build the request body using `<relation>.uuid` keys for nested references (e.g. `company.uuid`, `default_address.uuid`, `assigned_to.uuid`). The same fields come back as nested objects on the response.
- **Required fields**: most resources have very few API-level required fields (e.g. only `email` on contacts). Object-level "required" labels visible in the IIA admin doc URL refer to UI requirements, not API requirements. Don't over-require in generated requests.
- **The `format=json` query param** is what causes the controller to set HTTP status and security headers via `response_handler`. For machine consumers, always include `format=json`.
- **No `Bearer` prefix on the Authorization header.** Send the raw instance API key.
