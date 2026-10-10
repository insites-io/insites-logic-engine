# GraphQL Gotchas

Common errors, limits, and troubleshooting for GraphQL in Insites.

## Common Errors

### "Liquid error: graphql tag is not allowed in partials"

**Cause:** You placed a `{% graphql %}` tag inside a partial file (`app/views/partials/`). Insites prohibits GraphQL calls from partials.

**Solution:** Move the `{% graphql %}` call to the page that renders the partial. Pass the query result to the partial as a variable: `{% render 'my_partial', products: result.records.results %}`.

### "QueryNotFound: 'products/serch'"

**Cause:** The file path in the `{% graphql %}` tag does not match any `.graphql` file. Usually a typo or wrong subdirectory.

**Solution:** Verify the file exists at `app/graphql/products/serch.graphql`. The path is relative to `app/graphql/` without the `.graphql` extension. Check spelling and directory names.

> **Module note:** If the GraphQL file is inside a module, check `modules/<module_name>/public/graphql/` or `private/graphql/` instead.

### "Variable $id of type ID! was provided invalid value"

**Cause:** A required variable (marked with `!`) was not passed or was passed as `nil`/empty.

**Solution:** Ensure the Liquid invocation provides all required variables: `{% graphql result = 'products/find', id: context.params.id %}`. Check that `context.params.id` is not nil. Add a guard: `{% if context.params.id %}...{% endif %}`.

### Query returns empty results when data exists

**Cause:** Missing or incorrect `table` filter. Without `table: { value: "product" }`, the query searches across all tables and may not match expected records.

**Solution:** Always include the `table` filter in `records()` queries. Double-check the table name matches the schema `name` exactly (case-sensitive).

### Property accessor returns null for existing data

**Cause:** Using the wrong accessor type. For example, `property(name: "price")` returns a string, not a number. Or `property_int(name: "price")` on a float field returns null.

**Solution:** Match the accessor to the schema property type. Use `property_float` for `float`, `property_int` for `integer`, `property_boolean` for `boolean`. When in doubt, `property()` always returns the string representation.

### "Cannot query field 'custom_type' on type 'Query'"

**Cause:** Attempting to define or use custom GraphQL types. The Insites schema is closed.

**Solution:** You cannot create custom types. Use the provided root operations (`records`, `record_create`, etc.) with property accessors to shape your response. All data modeling is done through schema YAML files.

### Mutation updates wrong record or all records

**Cause:** Passing a nil or incorrect `$id` to `record_update`. If `id` is nil, behavior is unpredictable.

**Solution:** Always validate the ID exists before calling update mutations. Guard with `{% if id %}` in Liquid.

### "Filter value must be a String" on property filter

**Cause:** Passing a non-string value (integer, boolean, object) directly to a property filter.

**Solution:** All property filter values must be strings. Convert in Liquid if needed: `{{ count | json }}` or simply pass as quoted string in the GraphQL variable.

### related_record returns null

**Cause:** The `join_on_property` value does not contain a valid ID, or the referenced record does not exist in the specified table.

**Solution:** Verify the stored ID value is correct. Check that `join_on_property` names the property on the **current** record. For `related_records`, check that `foreign_property` names the property on the **related** table.

## Limits

| Resource | Limit | Notes |
|----------|-------|-------|
| `per_page` maximum | ~1000 | Use pagination for larger sets |
| Default `per_page` | 20 | If not specified |
| Query depth | ~5 levels | Nested `related_record` / `related_records` |
| Properties per filter | No hard limit | Performance degrades with many conditions |
| Inline query size | Practical only | Long queries should use named files |
| GraphQL file size | No hard limit | Keep operations focused and single-purpose |
| Concurrent queries per request | No hard limit | Each `{% graphql %}` tag is a separate call |
| Sort fields | Multiple allowed | Applied in array order |

## Measured on v6 instances, October 2026

Facts the schema does not state, each measured on `combinate-intranet.prod01-insites.io` (v6, CRM 6.1.2) while building the Insites Migration Tool (TW#26848218). Where a date is given, that is when it was measured; re-measure before relying on one for a release decision.

### Never pair an import's `ids` with the input by position

- `import_users` with `_id_remap: true` answered its `ids` **out of the order the people were sent**: 232 people loaded again over earlier deletions, and 37 profiles written to the returned ids by position landed on someone else (5 October 2026, TW#26855352). A fresh batch of 12 came back in order, so it is not every batch, which is worse. The payload carries `external_ids` beside `ids`; pair those two arrays with each other, or read each person back by email.
- `import_models` with `_id_remap: true` kept order in every measurement (0 of 10 positional mismatches across repeated batches, 6 October 2026) and echoes `external_ids` in the same order. Pair `ids` with `external_ids`, never with the models you sent: the order is observed, not promised.
- `created_at` and `updated_at` sent on each model are **preserved** on the remapped rows.
- With `_id_remap`, the platform stores the model's `id` field **as the external id** and generates a new row id. `external_id` sent beside it is ignored; a batch sent with only `external_id` came back with a fresh uuid in that field (29 September 2026).
- **Sent twice, a remap import creates a second copy of every row in the batch.** A write whose answer was lost (gateway timeout, empty 200) must be **read back, never resent**: query the table with `filter: { external_id: { value_in: [...] } }` and treat "every id present" as "the write landed".
- Without `_id_remap`, ids are kept as sent, so the same batch twice is idempotent.

### Names go in variables, not in the query text

`property_upload(name:)`, `property_upload_presigned_url(table:, property_name:)` and the `table` filter all accept variables. Pass a property or table name as a `String!` variable; a name interpolated into the query text is a GraphQL injection path when the name comes from a schema you did not write (a source instance being migrated, for example).

```graphql
query($t: String, $i: [ID!], $p: String!) {
  records(per_page: 100, filter: { table: { value: $t }, id: { value_in: $i } }) {
    results { id u: property_upload(name: $p) { url } }
  }
}
```

### `admin_table_delete` takes a path, not an id

`admin_table_delete(physical_file_path: String!)`. There is no id form.

### The admin API never lists a module's private files

`admin_liquid_partials` and `admin_liquid_layouts` return a module's `public/` files. The CRM module's private partials are not listed (7 of its partials and layouts appear, 6 October 2026). A page that includes a partial the module does not ship cannot be checked against the listing; only rendering the page shows the error.

The same holds for every admin listing measured on two v6 instances on 7 October 2026: `admin_pages`, `admin_liquid_partials`, `admin_graphql`, `admin_email_notifications` and `admin_authorization_policies` each returned 0 files under a `/private/` path. It holds for tables too: `admin_tables` and `admin_model_schemas` do not list a table whose schema is in `private/schema/`, even filtered by its exact name or id, and every IIA module's tables are there. The error from `record_create` on a table named `~` lists every table instead; see [storing data](../building-on-insites/05-storing-data.md#what-to-check-in-order).

### A table-not-found error names every table

`record_create` on a table that does not exist answers `Could not find Table with name: <name>. Did you mean one of: <names> ?`. When the name matches no table, `<names>` is every table on the instance, private module tables included, with no cap (350 names measured). When the name is part of some table names, it is only those. `records` filtered by a missing table answers 0 with no error instead, so it cannot tell a missing table from an empty one.

### A policy's `http_status` cannot be written

`AuthorizationPolicy` exposes `http_status` on read, but no input type for creating or updating a policy carries it. A policy created through the admin API answers with the default status.

### A list paged without a sort repeats rows and misses others

`users(page:, per_page:)` with no `sort` pages in no stable order. Read straight after 232 people were imported, the full read came back as 233 rows holding 199 distinct people (TW#26855353). With `sort: [{ id: { order: ASC } }]` the same read was stable. Give every paged read a sort on a unique field, and treat a repeated id in a listing as a sign to read again.

### `encrypted_password` must be bcrypt, and nothing checks it on import

`import_users` stores any string as `encrypted_password` and answers with ids as usual. Only bcrypt (`$2a$`, `$2b$`, `$2y$`, any cost) works afterwards. For anything else (WordPress `$P$`, `$wp$2y$`, MD5, `$6$`, Argon2, Django, plain text) `authenticate { password }` raises `invalid hash` and the **whole query's result is lost**, and `user_session_create` answers that the password "is corrupted, most likely due to the manual import". Measured on a v6 production instance, 10 October 2026 (TW#26866602). How to move other formats safely is in [authentication patterns](../authentication/patterns.md#moving-people-and-their-passwords-from-another-platform).

### `constants` answers at most one page

`constants(per_page: 1000)` returns the first 1000 and no `total_entries`. Page with `page:` until a page comes back short; an instance can hold more than 1000 constants, and a reader that stops at one page sees a constant past it as absent.

## Troubleshooting Flowchart

```
GraphQL issue?
├── Query returns error?
│   ├── "QueryNotFound"
│   │   └── Fix: Check file path and spelling (relative to app/graphql/)
│   ├── "not allowed in partials"
│   │   └── Fix: Move {% graphql %} to page, pass data to partial
│   ├── "Variable ... invalid value"
│   │   └── Fix: Ensure all required (!) variables are provided and non-nil
│   └── "Cannot query field"
│       └── Fix: Use only built-in root types (records, record_create, etc.)
│
├── Query returns empty results?
│   ├── Is table filter present and correct?
│   │   └── Fix: Add filter: { table: { value: "exact_name" } }
│   ├── Are property filters using string values?
│   │   └── Fix: All filter values must be strings
│   └── Is the data deployed?
│       └── Fix: Run insites-cli deploy dev
│
├── Property value is null or wrong type?
│   ├── Is the accessor matching the schema type?
│   │   └── Fix: property_float for float, property_int for integer, etc.
│   └── Is the property name spelled correctly?
│       └── Fix: Case-sensitive match against schema property name
│
└── Related record is null?
    ├── Does the ID property contain a valid value?
    │   └── Fix: Verify stored ID points to existing record
    └── Are join_on_property / foreign_property correct?
        └── Fix: join_on_property = field on THIS record,
            foreign_property = field on RELATED record
```

## See Also

- [README.md](README.md) -- overview and getting started
- [configuration.md](configuration.md) -- file structure and invocation syntax
- [api.md](api.md) -- complete API reference
- [patterns.md](patterns.md) -- correct usage patterns
- [advanced.md](advanced.md) -- advanced techniques
- [../schema/gotchas.md](../schema/gotchas.md) -- schema-related errors
