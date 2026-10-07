# Data — Patterns

Worked examples for the most common multi-step flows against the Data V2 REST API. **HTTP examples only.** For in-Liquid use, see [`../../api/calling-from-liquid.md`](../../api/calling-from-liquid.md).

For conventions (auth, response shape, dotted-path keys, list envelope), see [`api.md`](api.md). Auth header is `Authorization: instance_<token>` — no `Bearer` prefix — and is omitted from the snippets below for brevity.

---

## 1. Discover the column schema of a database

Before writing items, fetch the parent database to learn what `properties.<name>` keys are valid:

```http
GET /databases/api/v2/databases/1?format=json HTTP/1.1
```

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": 1,
  "name": "Customers",
  "table_name": "customers",
  "physical_file_path": "customers.json",
  "metadata": { "label": "Customers" },
  "properties": [
    { "id": "...", "name": "name",  "attribute_type": "string",  "metadata": { "label": "Name" } },
    { "id": "...", "name": "email", "attribute_type": "string",  "metadata": { "label": "Email" } },
    { "id": "...", "name": "age",   "attribute_type": "integer", "metadata": { "label": "Age" } }
  ],
  "no_of_items": 42
}
```

The `properties[]` array gives you the full column list; use `name` and `attribute_type` to drive your client logic.

---

## 2. Create an item

Use `properties.<name>` dotted keys for column values. The server inflates them into a nested `properties` object on the response.

```http
POST /databases/api/v2/database/1/items?format=json HTTP/1.1
Content-Type: application/json

{
  "properties.name": "John Doe",
  "properties.email": "john.doe@example.com",
  "properties.age": 32
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
    "age": 32
  },
  "created_at": "2021-01-01T00:00:00Z",
  "updated_at": "2021-01-01T00:00:00Z"
}
```

`:table_id` in the path (here `1`) is the parent database's numeric `id`.

---

## 3. List + paginate items

Items list uses the standard pagination envelope:

```http
GET /databases/api/v2/database/1/items?page=1&size=50&sort_by=last_updated&sort_order=DESC&format=json HTTP/1.1
```

```json
{
  "total_entries": 142,
  "total_pages": 3,
  "page": 1,
  "size": 50,
  "results": [
    {
      "id": 1213,
      "properties": { "name": "John Doe", "email": "john@example.com", "age": 32 },
      "created_at": "2021-01-01T00:00:00Z",
      "updated_at": "2021-01-15T00:00:00Z"
    }
  ]
}
```

Loop `page=1..total_pages` to drain. Default `sort_by=last_updated DESC` — useful for "show me what changed recently."

---

## 4. Update an item (full replacement)

Update uses `PUT`, not `PATCH`. Semantically it's a full replacement of `properties` — send the complete object you want.

```http
PUT /databases/api/v2/database/1/items/1213?format=json HTTP/1.1
Content-Type: application/json

{
  "properties.name": "John Doe",
  "properties.email": "john.doe@example.com",
  "properties.age": 33
}
```

Returns the updated item with the new `updated_at`. If you omit a column from the request, expect it to be cleared — treat update as replacement, not merge.

---

## 5. Delete an item

```http
DELETE /databases/api/v2/database/1/items/1213?format=json HTTP/1.1
```

Returns `200` on success. There is no archive flow on data items. `DELETE` deletes the item.

---

## 6. Bulk import — loop pattern (no native bulk endpoint)

There is no `POST /database/:table_id/items/bulk` endpoint. To import many items, loop:

```http
POST /databases/api/v2/database/1/items?format=json
{ "properties.name": "Row 1", ... }

POST /databases/api/v2/database/1/items?format=json
{ "properties.name": "Row 2", ... }
```

Watch for rate limits if you parallelize. For very large initial imports, do it in IIA at `<your-instance>/admin/insites#/databases/1/items/add` (or whatever the bulk-import affordance is in your instance's Data UI).

---

## 7. Validate a payload against a database's schema

Round-trip the schema lookup before each create batch:

```text
1. GET /databases/api/v2/databases/:id  →  remember `properties[]`
2. For each input row:
   - For each user-supplied key, check it matches a `properties[].name`
   - For each value, coerce/validate against `properties[].attribute_type`
3. POST  the validated rows
```

The API will reject malformed payloads with a 400, but client-side validation produces better error messages and avoids round-trips.

---

## What's intentionally not here

- **Database creation / column schema editing** — IIA-only; no API. See [`configuration.md`](configuration.md).
- **Reports** — IIA-only.
- **History / audit queries** — visible in IIA's Event Stream tab on each database, not exposed via the V2 API.
- **Webhooks** — data fires none.
- **GraphQL examples** — V2 is the supported surface.
