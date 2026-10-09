# GraphQL API Reference

Complete reference for root operations, property accessors, filters, pagination, sorting, related records, and user/constant operations.

## Root Query Operations

### records

Query records from any schema-defined table.

```graphql
records(
  page: Int
  per_page: Int
  filter: RecordFilter
  sort: [RecordSort]
  options: { read_replica: Boolean, timeout: Int }
) : RecordCollection
```

`options` (also on `users`, `admin_versions` and the deprecated `models`) controls how the
read executes. `read_replica: true` runs the whole operation on a read replica when the
environment has one, for listings, search, reports and exports; without a reachable
replica it is ignored and the query runs on the primary. Replica reads can lag a write,
so do not use it right after one; inside a `{% transaction %}` it is ignored and mutations
refuse it. `timeout` is the database statement timeout in seconds for the operation; once
`options` is passed it defaults to 19 (one second under the request timeout), and the
largest value in a query wins. Accepted on a v6 staging instance, 9 October 2026.

`min` and `max` aggregations compute against the requested field and return a scalar
`{ "value": x }` like `avg`; before the 29 June 2026 platform release they computed
against the record id and could return a per-shard array.

**RecordCollection fields:**

| Field | Type | Description |
|-------|------|-------------|
| `total_entries` | Int | Total matching records across all pages |
| `total_pages` | Int | Total pages at current `per_page` |
| `has_previous_page` | Boolean | `true` if current page > 1 |
| `has_next_page` | Boolean | `true` if more pages remain |
| `results` | [Record] | Array of records for current page |

### users

Query user records (built-in user table).

```graphql
users(
  page: Int
  per_page: Int
  filter: UserFilter
  sort: [UserSort]
) : UserCollection
```

User records have built-in fields: `id`, `email`, `created_at`, `updated_at`. Custom properties are accessed via the same property accessors as records.

## Root Mutation Operations

### record_create

```graphql
record_create(record: RecordInput!) : Record
```

```graphql
mutation($title: String!, $price: String) {
  record_create(
    record: {
      table: "product"
      properties: [
        { name: "title", value: $title }
        { name: "price", value: $price }
      ]
    }
  ) {
    id
    created_at
  }
}
```

### record_update

```graphql
record_update(id: ID!, record: RecordInput!) : Record
```

Only properties listed in the `properties` array are modified. Omitted properties are untouched.

```graphql
mutation($id: ID!, $price: String) {
  record_update(
    id: $id
    record: {
      properties: [
        { name: "price", value: $price }
      ]
    }
  ) {
    id
    updated_at
  }
}
```

### record_delete

```graphql
record_delete(id: ID!, table: String, form_name: String) : Record!
```

Sets `deleted_at` and keeps the row for 30 days (see [schema/api.md](../schema/api.md#record_delete)). No cascade to related records. **Pass `table` as well as `id`.** The schema marks `table` optional, but a delete with `id` alone was refused on a v6 instance with "You must specify table to which the record should belong" (2 September 2026), and 107 of the 108 `record_delete` calls in the v6 module source pass it.

### user_create

```graphql
user_create(user: UserInput!) : User
```

### user_update

```graphql
user_update(id: ID!, user: UserInput!) : User
```

### user_delete

```graphql
user_delete(id: ID!) : User
```

### admin_page_create / admin_page_update
Both accept `authorization_policies: [String]`, the policy **names** as written in page
front matter (`modules/insites_crm/insites_only_allowed_if_logged_in`), beside the older
`authorization_policy_ids`. Names and ids combine; every name must resolve to an
existing policy or the mutation fails.

### admin_assets_create / admin_asset_update
`cache_control: "max-age=31536000, public"` is stored in the asset's metadata and applied
as the `Cache-Control` header on the stored object, so edge caches and browsers follow
your policy. Upload the bytes with `admin_assets_presign_urls`, then call
`admin_assets_create` with `name` and `physical_file_path`. Sources disagree about `url`:
the bundled schema declares `AssetInput.url: String!` and the v6 assets module sends it,
while the 19 May release notes call it deprecated and ignored. Send it, and do not rely on
its value.

### admin_logs
```graphql
query logs($last_id: ID) {
  admin_logs(filter: { id: { range: { gt: $last_id } }, type: { value: "payment" } }) {
    id type message data created_at
  }
}
```
Reads the entries the `log` tag writes, oldest first: the latest 20 with no lower bound,
up to 500 after `id` when one is given, so pass the last id back to follow the log.
`type` and `message` take the usual string operators (`contains`, `starts_with`,
`ends_with`, case-insensitive unless `case_sensitive: true`), applied to roughly the
latest 1000 entries. Part of the 6 October 2026 platform release: on 9 October 2026 a v6
staging instance still answered `Field 'admin_logs' doesn't exist on type 'RootQuery'`,
so check before building on it.

### constant_set

```graphql
constant_set(name: String!, value: String!) : Constant
```

Store a key-value pair accessible via `context.constants`.

### constant_unset

```graphql
constant_unset(name: String!) : Constant
```

Remove a constant by name.

## Property Accessors

Used on `results` items to read typed property values.

| Accessor | Return Type | Usage |
|----------|-------------|-------|
| `property(name: String!)` | String | `title: property(name: "title")` |
| `property_int(name: String!)` | Int | `count: property_int(name: "count")` |
| `property_float(name: String!)` | Float | `price: property_float(name: "price")` |
| `property_boolean(name: String!)` | Boolean | `active: property_boolean(name: "active")` |
| `property_array(name: String!)` | [String] | `tags: property_array(name: "tags")` |
| `property_upload(name: String!)` | Upload | `image: property_upload(name: "image") { url }` |
| `property_object(name: String!)` | JSON | `meta: property_object(name: "metadata")` |

### Upload accessor fields

```graphql
property_upload(name: "avatar") {
  url          # CDN URL (public) or signed URL (private)
}
```

### Aliasing property accessors

You can alias any accessor to create a clean result shape:

```graphql
results {
  id
  name: property(name: "name")
  email: property(name: "email")
  age: property_int(name: "age")
  verified: property_boolean(name: "verified")
}
```

## Filter Reference

### RecordFilter

```graphql
filter: {
  table: { value: "product" }                              # required
  id: { value: "123" }                                     # single ID
  ids: { value: ["1", "2", "3"] }                          # multiple IDs
  properties: [
    { name: "status", value: "active" }                    # equality
    { name: "category_id", value: $cat_id }                # variable
  ]
  created_at: { gte: "2024-01-01", lte: "2024-12-31" }    # date range
  updated_at: { gt: "2024-06-01" }                         # after date
}
```

### Date range operators

| Operator | Meaning |
|----------|---------|
| `gte` | Greater than or equal |
| `gt` | Greater than |
| `lte` | Less than or equal |
| `lt` | Less than |

### UserFilter

```graphql
filter: {
  id: { value: "123" }
  email: { value: "user@example.com" }
  created_at: { gte: "2024-01-01" }
}
```

## Sort Reference

```graphql
sort: [
  { created_at: { order: DESC } }
  { updated_at: { order: ASC } }
  { properties: { name: "title", order: ASC } }
  { properties: { name: "price", order: DESC } }
]
```

Sort fields are applied in array order (first field is primary sort).

## Related Records

### related_record (belongs-to / single record)

```graphql
related_record(
  table: String!
  join_on_property: String!
) : Record
```

Joins the current record to a single related record. `join_on_property` is the property on the **current** record containing the target record's ID.

```graphql
results {
  id
  author: related_record(table: "user", join_on_property: "author_id") {
    id
    email
    name: property(name: "name")
  }
}
```

### related_records (has-many / multiple records)

```graphql
related_records(
  table: String!
  join_on_property: String!
  foreign_property: String!
) : [Record]
```

Joins the current record to multiple related records. `join_on_property` is the property on the **current** record (usually `"id"`). `foreign_property` is the property on the **related** records pointing back.

```graphql
results {
  id
  items: related_records(
    table: "order_item"
    join_on_property: "id"
    foreign_property: "order_id"
  ) {
    id
    quantity: property_int(name: "quantity")
    product: related_record(table: "product", join_on_property: "product_id") {
      title: property(name: "title")
    }
  }
}
```

## Pagination

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | Int | 1 | Current page number (1-indexed) |
| `per_page` | Int | 20 | Records per page |

### Response fields

| Field | Type | Description |
|-------|------|-------------|
| `total_entries` | Int | Total matching records |
| `total_pages` | Int | Computed from total_entries / per_page |
| `has_previous_page` | Boolean | `page > 1` |
| `has_next_page` | Boolean | `page < total_pages` |

### Liquid pagination example

```liquid
{% graphql result = 'products/search', page: context.params.page | default: 1 %}
{% for product in result.records.results %}
  {{ product.title }}
{% endfor %}
{% if result.records.has_next_page %}
  <a href="?page={{ context.params.page | default: 1 | plus: 1 }}">Next</a>
{% endif %}
```

## See Also

- [README.md](README.md) -- overview and getting started
- [configuration.md](configuration.md) -- file structure and invocation syntax
- [patterns.md](patterns.md) -- common workflows and examples
- [gotchas.md](gotchas.md) -- common errors and limits
- [advanced.md](advanced.md) -- optimization and advanced techniques
- [../schema/api.md](../schema/api.md) -- schema-level API reference
