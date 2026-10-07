# Data — Gotchas

Edges and quirks of the Data V2 REST API. Each entry: **what bites**, **why**, **how to avoid**.

---

## 1. URL prefix is `/databases/api/v2/`, not `/data/api/v2/`

**Bites:** code that follows the module's external name ("data") and constructs `/data/api/v2/databases` gets 404.

**Why:** the module's external label is "data" but its URL space is "databases" — derived from the POS module name `insites_databases`. The two don't match.

**Avoid:** always use the literal `/databases/api/v2/...` prefix. Don't substitute the friendly module name.

---

## 2. The item endpoint uses singular `database/:table_id/items` (with `:table_id`)

**Bites:** writing `POST /databases/api/v2/databases/1/items` (plural `databases` in the path) returns 404.

**Why:** the database **list** endpoint is plural (`/databases`), but the item endpoints use singular (`/database/:table_id/items`). The two don't share a path prefix.

**Avoid:** treat `databases` (plural, for the resource list) and `database/:table_id` (singular, for parent reference) as two separate path segments. Snippet:

```
GET    /databases/api/v2/databases             ← plural, list
GET    /databases/api/v2/databases/:id         ← plural, read one
POST   /databases/api/v2/database/:table_id/items   ← singular
GET    /databases/api/v2/database/:table_id/items   ← singular
```

---

## 3. IDs are numeric, not UUIDs

**Bites:** generating or storing UUIDs and using them in paths returns 404.

**Why:** databases and database items use numeric ids — there's no UUID column on either. CRM uses UUIDs; data does not.

**Avoid:** capture the integer `id` from the create / list responses; use it in subsequent path params. Don't infer a UUID convention from CRM and apply it here.

---

## 4. Update is `PUT`, not `PATCH`

**Bites:** `PATCH /databases/api/v2/database/1/items/1213` returns 404 (or method-not-allowed).

**Why:** data uses `PUT` for item update; the rest of the V2 surface across other modules typically uses `PATCH`.

**Avoid:** use `PUT`. Treat semantics as full replacement of `properties` — send the complete object you want, not just changed fields.

---

## 5. `PUT` is full-replacement — omitted columns get cleared

**Bites:** sending only the changed columns in a `PUT` and finding the others cleared on the next read.

**Why:** `PUT` semantics here replace the full `properties` object. Anything you don't send is treated as "not present in the new state," which means cleared.

**Avoid:** read the item first, mutate the relevant column in memory, then send back the full `properties` payload. Or build the new full payload from the database schema + your changes.

---

## 6. Database creation is IIA-only

**Bites:** trying to `POST /databases/api/v2/databases` to create a new table — gets 404 (no such endpoint).

**Why:** database (schema) creation is intentionally administrative and lives in IIA. Only items can be created via the API.

**Avoid:** for programmatic schema creation, this isn't a supported flow. Create the database in IIA, then use the API for rows. If you need fully programmatic schema definition, that's an architectural concern — flag it for the team.

---

## 7. Item shape varies per database

**Bites:** writing client code that assumes specific keys inside `properties` (e.g. always `properties.name`) and finding them missing or differently named on a different database.

**Why:** `properties` is a dynamic field-bag determined by the parent database's column schema. Two databases can have entirely different column sets.

**Avoid:** always look up the database's `properties[]` schema first (via `GET /databases/api/v2/databases/:id`) and drive your client logic from that. Don't hardcode column names unless you control both the database and the client.

---

## 8. No bulk endpoint

**Bites:** code that POSTs 1000 items in parallel and trips a rate limit, or tries `POST /database/:table_id/items/bulk` and gets 404.

**Why:** the v2 API is one-item-per-request by design, same as CRM.

**Avoid:** loop sequentially with appropriate backoff. For large initial imports, do them in IIA's database UI (which has bulk-import affordances) rather than the API.

---

## 9. No webhooks

**Bites:** subscribing to a `database_item_created` event and never receiving anything.

**Why:** the data module fires no webhooks. Confirmed by audit of all V2 controllers.

**Avoid:** for change notifications, poll the items list and watch `updated_at`, or wire your own integration via the api module's user-defined endpoints. If your downstream depends on knowing about deletes specifically, consider archiving items via a custom flag column instead of deleting them.

---

## 10. List defaults differ from CRM in `sort_by` choices

**Bites:** code that copies CRM patterns assumes `sort_by=last_updated` works the same way and is surprised by what fields are sortable.

**Why:** databases list (the resource definitions) sorts on metadata fields (e.g. `metadata.label`); items list sorts on `last_updated` and other top-level fields. Items don't have a uniform field set across databases, so per-database sorting on a `properties.<name>` field can be inconsistent.

**Avoid:** stick to top-level sortable fields (`last_updated`, `created_at`, `id`) for items unless you've verified a `properties.<name>` field works on the specific database you're querying.

---

## 11. `format=json` is required for proper HTTP status codes

**Bites:** without `?format=json`, validation errors come back with a `200` status even though the body has an `error` key.

**Why:** the controller's `response_handler` (which sets `Content-Type` and HTTP status) only fires when `format=json` is set. Same gotcha as CRM.

**Avoid:** always include `?format=json` (or `&format=json`) on every API request. Treat the body's `error`/`errors` key as the source of truth for failure regardless of status.

---

## 12. `:table_id` and `:id` in item paths are different things

**Bites:** confusing `:table_id` (the parent database id) with `:id` (the specific item id) and constructing wrong paths.

**Why:** item endpoints have two path params: `database/:table_id/items/:id`. `:table_id` identifies which database the item belongs to; `:id` identifies the item within that database. Two different numeric ids in the same path.

**Avoid:** when building paths, source `:table_id` from the database you're working in (probably constant for a given client) and `:id` from the item itself. Mismatching them returns 404 (the item exists but belongs to a different table) or 401 (auth policy `is_valid_database_id` rejects).
