# Storing data

**Check what already exists before you create anything.** An instance arrives with the
CRM, ecommerce, events, locator and data modules installed, each with its own tables and
its own controllers for reading and writing them. Rebuilding one of those by hand is the
most common and most expensive mistake on this platform: you inherit none of the admin
screens, none of the validation and none of the API.

## What to check, in order

1. **Does a module already store this?** Contacts, companies, activities, tasks,
   opportunities, orders, products, events and locations all have tables and controllers
   already. Read the [alias inventory](reference/alias-inventory.md).
2. **Is there a table already?** List them:

   ```graphql
   { admin_tables { results { id name properties } } }
   ```

   Names are namespaced: `modules/ins_core/...` for CRM structures,
   `modules/ins_databases/...` for instance-specific tables.
3. **Only then create your own.**

## Creating a table

```graphql
mutation {
  admin_table_create(table: {
    name: "modules/ins_databases/my_thing"
    physical_file_path: "modules/ins_databases/schema/my_thing.yml"
  }) { id name }
}
```

A table carries `name`, `parameterized_name`, `properties`, `metadata`,
`physical_file_path`, `manually_managed` and `records_count_rc`.

## Records

Rows in a table are records.

| Operation | Mutation |
|---|---|
| Create one | `record_create` |
| Update one | `record_update` |
| Delete one | `record_delete` |
| Update many | `records_update_all` |
| Delete all | `records_delete_all` |

Read them with the `records` query, filtered by table:

```graphql
{
  records(
    per_page: 20
    filter: { table: { value: "modules/ins_databases/my_thing" } }
    sort: { created_at: { order: DESC } }
  ) {
    total_entries
    results { id created_at properties }
  }
}
```

**Field values live under `properties`**, not at the top level of the record.

## Two things worth knowing before you design a schema

- **Give every field a description.** The instance generates its own API reference from
  the schema, so a field with no description produces a documented endpoint that explains
  nothing. You are writing documentation whether you intend to or not.
- **A delete keeps the row, and its id.** `record_delete` and `records_delete_all` set
  `deleted_at` rather than removing anything: a plain `records` query stops returning the row,
  and `filter: { deleted_at: { exists: true } }` still finds it under the same id. There is
  no documented way to restore one, so if a record needs to disappear from a list but be
  recoverable, add your own flag rather than deleting.

## Do not reach for the REST API for your own instance's data

If the data is on the instance serving your page, call the controller. The REST endpoint
costs an HTTP round trip to yourself, a key to manage and a rate limit of 300 requests per
60 seconds that you did not need. See [Calling a controller](02-calling-a-controller.md).

Verified against a live instance on 13 August 2026 by schema introspection.
