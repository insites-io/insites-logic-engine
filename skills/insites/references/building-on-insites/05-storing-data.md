# Storing data

**Check what already exists before you create anything.** An instance arrives with the
CRM, ecommerce, events, locator and data modules installed, each with its own tables and
its own controllers for reading and writing them. Rebuilding one of those by hand is the
most common and most expensive mistake on this platform: you inherit none of the admin
screens, none of the validation and none of the API.

## What to check, in order

1. **Does a module already store this?** Contacts, companies, activities, tasks,
   opportunities, orders, products, events and locations all have tables and controllers
   already. Read the [alias inventory](reference/alias-inventory.md). For a shop, the
   Ecommerce module stores carts, cart items, orders, products and variants; the cart and
   checkout pages are the project's to build (see [payments](../payments/README.md#carts-orders-and-checkout)).
2. **Is there a table already?** List them:

   ```graphql
   { admin_tables { results { id name properties } } }
   ```

   This lists only tables whose schema file sits in a **public** place: `app/schema/`, and a
   module's `public/schema/`. On an instance that means `modules/ins_databases/...` and the
   `*_custom_field` tables. A table whose schema file sits in a module's **`private/`** folder
   is not listed, not even when filtered by its exact name or id, and `admin_model_schemas`
   answers the same set. Every IIA module keeps its schemas in `private/schema/` (114 of 114
   schema files across the ten v6 module repositories), so no `modules/insites_crm/...`,
   `modules/insites_ecommerce/...` or other module table ever appears.

   The folder alone decides it. A table created at `modules/ins_databases/private/schema/` is
   hidden in the same way while its twin under `public/schema/` is listed, and a table synced to
   `app/schema/` is listed. A hidden table still works: `records` reads it and `record_create`
   writes it by name. Measured on two v6 instances on 7 October 2026 (TW#26860280).

   **To list every table, the modules' included,** ask for a table that cannot exist. The error
   names every table on the instance:

   ```graphql
   mutation { record_create(record: { table: "~", properties: [] }) { id } }
   ```

   ```
   Could not find Table with name: ~. Did you mean one of: modules/ins_core/crm_company_custom_field, ..., modules/insites_crm/activity, ... ?
   ```

   No `~` table can exist, so nothing is written. Measured on two v6 instances: 150 and 126
   names, including every table `admin_tables` lists, every module table holding rows, every
   schema file in the v6 module repositories, and the two tables the Events and Locator modules
   create in migrations. With 200 tables added, the list grew to 350, so it is not capped. Two
   things to handle when you use it:

   - **The list is complete only when the name you send matches none of them.** A name that is
     part of some table names answers only those: `ecommerce` answers 38. Send `~`.
   - **It is error text, not an API.** Split it on `Did you mean one of: ` and on commas, strip
     the trailing ` ?`, and check the result contains everything `admin_tables` lists before
     trusting it.

   The other routes each give part of the answer:

   | Route | What it gives |
   |---|---|
   | `records` with no table filter | Only the tables that hold rows. An empty module table is missing |
   | `/admin/api` | The tables behind an API resource: 43 of 126 on one instance |
   | A module's source at the installed version | Its schema files, but not tables its migrations create (`modules/insites_events/event_system_field`, `modules/insites_locator/location_system_field`) |
   | `insites-cli modules pull` | The module's `public/` files only, so no schemas |
   | `cms_items(type: CustomModelType)` (deprecated) | `app/schema/` tables only |

   Nor can a `records` query prove a table exists: filtered by a table that does not exist, it
   answers `total_entries: 0` with no error, exactly as an empty table does. The error above is
   the existence check: a name that exists is absent from it.
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
  `deleted_at` and keep the row for 30 days before an overnight job removes it: a plain `records` query stops returning the row,
  and `filter: { deleted_at: { exists: true } }` still finds it under the same id. There is
  no documented way to restore one, so if a record needs to disappear from a list but be
  recoverable, add your own flag rather than deleting.

## Do not reach for the REST API for your own instance's data

If the data is on the instance serving your page, call the controller. The REST endpoint
costs an HTTP round trip to yourself, a key to manage and a rate limit of 300 requests per
60 seconds that you did not need. See [Calling a controller](02-calling-a-controller.md).

Verified against a live instance on 13 August 2026 by schema introspection.
