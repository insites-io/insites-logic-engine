# GraphQL Configuration Reference

File structure, naming conventions, variable types, and invocation syntax for GraphQL in Insites.

## File Location and Structure

```
app/
└── graphql/
    ├── products/
    │   ├── search.graphql
    │   ├── find.graphql
    │   ├── create.graphql
    │   ├── update.graphql
    │   └── delete.graphql
    ├── orders/
    │   ├── list.graphql
    │   └── create.graphql
    ├── users/
    │   └── find.graphql
    └── constants/
        ├── set.graphql
        └── get.graphql
```

### Rules

- Files go in `app/graphql/` (or a module's `graphql/`, below) with a `.graphql` extension.
- Subdirectories are supported and recommended for organization.
- Each file contains **one** GraphQL operation (query or mutation).
- The file path (without extension) becomes the invocation name: `app/graphql/products/search.graphql` is invoked as `'products/search'`.

> **Module path:** In modules, GraphQL files live in `modules/<module_name>/public/graphql/` (accessible to app and other modules) or `modules/<module_name>/private/graphql/` (internal only). Invoke them with the module prefix: `{% graphql r = 'modules/<module_name>/products/search' %}` reads `modules/<module_name>/public/graphql/products/search.graphql` or the same path under `private/`.

## Invocation Syntax

### Named file invocation (recommended)

```liquid
{% graphql result = 'products/search', page: 1, limit: 20, title: "Widget" %}
```

| Part | Description |
|------|-------------|
| `result` | Liquid variable to store the response |
| `'products/search'` | Path to `.graphql` file (without extension) |
| `page: 1` | Mapped to `$page` variable in the GraphQL operation |
| `limit: 20` | Mapped to `$limit` variable |
| `title: "Widget"` | Mapped to `$title` variable |

### Inline invocation

For simple one-off queries, embed GraphQL directly in Liquid:

```liquid
{% graphql result %}
  query {
    records(per_page: 5, filter: { table: { value: "product" } }) {
      results { id }
    }
  }
{% endgraphql %}
```

Inline queries do not accept variables. Values must be hardcoded or interpolated via Liquid before execution.

### Passing arguments as a hash

```liquid
{% parse_json filters %}
  { "page": 1, "limit": 10, "status": "active" }
{% endparse_json %}
{% graphql result = 'orders/list', args: filters %}
```

The `args` parameter passes a JSON object where keys match GraphQL variable names. Individual named arguments override keys in `args`.

### Discarding the result

Use `_` when you do not need the return value:

```liquid
{% graphql _ = 'products/delete', id: product.id %}
```

## GraphQL Variable Types

Variables are declared in the operation signature:

```graphql
query search($page: Int = 1, $limit: Int = 20, $title: String, $id: ID!) {
  ...
}
```

| GraphQL Type | Liquid Source | Notes |
|--------------|--------------|-------|
| `String` | Any Liquid value | Most common; property values are strings |
| `Int` | Integer or numeric string | Used for pagination, counts |
| `Float` | Decimal number | Less common in variables |
| `Boolean` | `true` / `false` | Liquid boolean values |
| `ID` | String or integer | Used for record/user IDs |
| `ID!` | Required ID | `!` means non-nullable |

Default values are declared with `=`: `$page: Int = 1`.

## Property Input Format

When creating or updating records, properties are passed as an array of name-value pairs:

```graphql
mutation create($title: String!, $price: String) {
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
  }
}
```

**All property values are strings** in the input, regardless of the schema type. The platform coerces them:

| Schema Type | GraphQL Input Example |
|-------------|----------------------|
| `string` | `value: "hello"` |
| `integer` | `value: "42"` |
| `float` | `value: "19.99"` |
| `boolean` | `value: "true"` |
| `datetime` | `value: "2024-01-15T10:30:00Z"` |
| `date` | `value: "2024-01-15"` |
| `array` | `value: "[\"a\", \"b\"]"` (JSON string) |

## Filter Input Format

```graphql
filter: {
  table: { value: "product" }
  id: { value: "123" }
  properties: [
    { name: "status", value: "active" }
    { name: "category_id", value: $category_id }
  ]
  created_at: { gte: "2024-01-01" }
}
```

### Available filter fields

| Field | Format | Description |
|-------|--------|-------------|
| `table` | `{ value: String }` | Required for record queries |
| `id` | `{ value: ID }` | Single ID match |
| `ids` | `{ value: [ID] }` | Multiple ID match |
| `properties` | `[{ name, value }]` | Property value equality |
| `created_at` | `{ gte, lte, gt, lt }` | Date range |
| `updated_at` | `{ gte, lte, gt, lt }` | Date range |

## Sort Input Format

```graphql
sort: [
  { created_at: { order: DESC } }
  { properties: { name: "title", order: ASC } }
]
```

- `order` accepts `ASC` or `DESC`.
- Multiple sort fields are applied in order.
- Sort by built-in fields: `created_at`, `updated_at`, `id`.
- Sort by properties: `{ properties: { name: "field_name", order: ASC } }`.

## Response Structure

Every query returns a collection object:

```json
{
  "records": {
    "total_entries": 42,
    "total_pages": 3,
    "has_previous_page": false,
    "has_next_page": true,
    "results": [
      { "id": "1", "title": "Widget" }
    ]
  }
}
```

Mutations return the affected record:

```json
{
  "record_create": {
    "id": "123",
    "title": "New Product"
  }
}
```

## Invocation Restrictions

- **Pages:** `{% graphql %}` tag is fully supported.
- **Partials:** **NEVER** call `{% graphql %}` from partials. Pass data from pages instead.
- **Commands:** GraphQL can be called from command files.
- **Migrations:** GraphQL can be called from migration files.

## See Also

- [README.md](README.md) -- overview and getting started
- [api.md](api.md) -- root types, property accessors, and full API reference
- [patterns.md](patterns.md) -- common query and mutation patterns
- [gotchas.md](gotchas.md) -- common errors and limits
- [../schema/configuration.md](../schema/configuration.md) -- schema YAML that defines queryable tables
