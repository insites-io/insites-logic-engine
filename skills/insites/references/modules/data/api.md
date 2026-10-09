# Data — V2 REST API

The Data module (POS module name `insites_databases`) exposes a V2 REST API at the `/databases/api/v2/...` URL prefix. It lets external clients read database definitions and CRUD database items (rows in user-defined tables).

For authentication, see [`references/api/authentication.md`](../../api/authentication.md). Every request needs an `Authorization` header carrying the raw instance API key. There is no `Bearer` prefix.

---

## Surface at a glance

7 endpoints across two resources:

- **Databases** — read-only via the API (creation/editing happens in IIA)
- **Database items** — full CRUD

| Method | Path | Operation |
|---|---|---|
| `GET` | `/databases/api/v2/databases` | List all databases |
| `GET` | `/databases/api/v2/databases/:id` | Read one database |
| `POST` | `/databases/api/v2/database/:table_id/items` | Create an item |
| `GET` | `/databases/api/v2/database/:table_id/items` | List items in a database |
| `GET` | `/databases/api/v2/database/:table_id/items/:id` | Read one item |
| `PUT` | `/databases/api/v2/database/:table_id/items/:id` | Update an item |
| `DELETE` | `/databases/api/v2/database/:table_id/items/:id` | Delete an item |

---

## Conventions

### URL pattern

The URL prefix is `/databases/api/v2/`, not `/data/api/v2/`. The module is named "data" externally but its URL space is "databases" (matches the POS module name `insites_databases`).

Note the singular `database/:table_id/items` for item endpoints — `:table_id` is the parent database's numeric id; the literal segment is `database` (singular). The databases list and read endpoints use plural `databases`.

### IDs are numeric, not UUIDs

Both databases and database items are addressed by numeric `:id` (or `:table_id`), not UUID. This differs from the CRM module's UUID convention. There's no UUID field on the wire shape; use the integer `id` returned in responses.

### Update uses `PUT`, not `PATCH`

Item update is `PUT /databases/api/v2/database/:table_id/items/:id`. Other modules in the platform use `PATCH` for partial updates; data uses `PUT`. Treat as full-replacement semantically (send the complete `properties` object you want).

### Authentication

All endpoints are gated by `modules/insites_crm/has_valid_instance_api_authorization` — the same instance API key used for every V2 surface. The single-database read also adds `modules/insites_databases/is_valid_database_id` to verify the path's `:id` resolves to a real database.

### Request format

- **Body:** JSON.
- **Path parameters:** `:id` (database or item), `:table_id` (parent database id for item endpoints).
- **Query parameters:** common across LIST endpoints (see below). `format=json` is required for proper HTTP status codes (same as other v2 modules — see [`../crm/api.md#status-codes`](../crm/api.md#status-codes)).

### Database items use dynamic field-bag — `properties.<name>` keys

Database item bodies wrap user-defined column values inside a dotted-path key style. To set a column's value:

```json
{ "properties.name": "John Doe", "properties.email": "john@example.com" }
```

The server builds these into a `properties` object on the underlying record. On output, the response inflates them as a nested object:

```json
{ "id": 1213, "properties": { "name": "John Doe", "email": "john@example.com" } }
```

Which columns exist on a given database is determined by that database's `properties` schema (returned by `GET /databases/:id`).

### Response — success

The resource (or list envelope) is returned at the top level. Database items always include `id`, `properties`, `created_at`, `updated_at`.

### Response — error

```json
{ "error": "Bad Request - Validation Failed" }
```

Status codes: `400` validation, `401` auth missing/invalid, `404` not found. Treat any non-2xx response or any payload with an `error` key as a failure.

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
| `sort_by` | `last_updated` | For databases list, can target `metadata.label` or other fields |
| `sort_order` | `DESC` | `ASC` or `DESC` |
| `search_by` | resource-specific | For databases list, `metadata.label` is common |
| `keyword` | — | Search keyword |

### Webhooks

**The data module fires no webhooks.** Confirmed by audit of all V2 controllers — no `send_webhook` calls. If you need notifications on data changes, poll the items list and watch `updated_at`, or wire your own integration through the api module.

---

## Resources

### Databases

Read-only via the API. Creation and column schema management happen in IIA at `<your-insites-instance>/admin/insites#/databases` (see [`configuration.md`](configuration.md)).

**Full field reference:** `<your-insites-instance>/admin/api/databases/databases/overview`

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/databases/api/v2/databases` | List databases (paginated) |
| `GET` | `/databases/api/v2/databases/:id` | Read one database |

#### Database object shape

| Field | Type | Description |
|---|---|---|
| `id` | number | Auto-assigned numeric id |
| `path` | string | Path of the database (table path) |
| `table_name` | string | Underlying table name |
| `physical_file_path` | string | File path of the database definition |
| `metadata` | object | Free-form metadata (label, description, etc.) |
| `properties` | array | Column schema — see below |
| `no_of_items` | number | Count of rows currently stored |

**Each entry in `properties` (a column definition):**

| Field | Type | Description |
|---|---|---|
| `id` | string | The column's id |
| `name` | string | The column's name (used in `properties.<name>` keys when writing items) |
| `attribute_type` | string | Storage type (`string`, `integer`, `float`, `boolean`, `array`, `geo_json`) |
| `belongs_to` | string | If the column is a related-record reference, the schema path it points at |
| `metadata` | object | Display hints (label, ui_element, options) |
| `options` | array | Allowed values for enum-style columns |
| `default_value` | string | Default value when not provided |

#### Example — list databases

```http
GET /databases/api/v2/databases?page=1&size=10&sort_by=metadata.label&sort_order=ASC&format=json HTTP/1.1
Authorization: instance_aB3xK9pQ7mN2vL8wR4tY1zE6cF5sJ0hG
```

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "total_entries": 3,
  "total_pages": 1,
  "page": 1,
  "size": 10,
  "results": [
    {
      "id": 1,
      "name": "Database 1",
      "table_name": "database_1",
      "physical_file_path": "database_1.json",
      "metadata": {},
      "properties": []
    }
  ]
}
```

---

### Database items

Full CRUD on rows in a specific database. The shape of an item is determined by the parent database's `properties` schema — items have a fixed wire shape (`id`, `properties`, `created_at`, `updated_at`) but the contents of `properties` vary per database.

**Full field reference:** `<your-insites-instance>/admin/api/databases/database-items/overview`

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/databases/api/v2/database/:table_id/items` | Create an item |
| `GET` | `/databases/api/v2/database/:table_id/items` | List items (paginated) |
| `GET` | `/databases/api/v2/database/:table_id/items/:id` | Read one item |
| `PUT` | `/databases/api/v2/database/:table_id/items/:id` | Update an item (full replacement) |
| `DELETE` | `/databases/api/v2/database/:table_id/items/:id` | Delete an item |

#### Example — create an item

```http
POST /databases/api/v2/database/1/items?format=json HTTP/1.1
Authorization: instance_aB3xK9pQ7mN2vL8wR4tY1zE6cF5sJ0hG
Content-Type: application/json

{
  "properties.name": "John Doe",
  "properties.email": "john.doe@example.com",
  "properties.phone": "1234567890"
}
```

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": 1213,
  "properties": {
    "name": "John Doe",
    "email": "john.doe@example.com",
    "phone": "1234567890"
  },
  "created_at": "2021-01-01T00:00:00Z",
  "updated_at": "2021-01-01T00:00:00Z"
}
```

The `:table_id` in the path is the parent database's numeric `id`. To know what columns are valid in `properties.<name>` keys for a given database, fetch that database's `properties` array via `GET /databases/api/v2/databases/:id`.

---

## Notes for the LLM consumer

- **`properties.<name>` dotted keys on input**, nested `properties` object on output — same dual-form pattern as CRM custom fields.
- **Update is `PUT`, not `PATCH`** — semantically a full replacement; send the complete `properties` you want.
- **IDs are numeric**, not UUIDs. Don't generate or expect UUIDs anywhere on this surface.
- **No webhooks** fire from data. Don't tell users to subscribe to data events; there are none.
- **`format=json` query param** is required for reliable HTTP status. Always include it.
- **`Authorization` header has no `Bearer` prefix** — same as every other V2 module. Send the raw instance API key.
- **Database creation is IIA-only.** If a user asks how to create a new database programmatically via this API, the answer is: not supported. They define it in IIA at `<your-instance>/admin/insites#/databases/add`.
