# Schema Gotchas

Common errors, limits, and troubleshooting for schema files.

## Common Errors

### "Table not found" or "Unknown table" in GraphQL

**Cause:** The schema file has not been deployed, or the `table` value in your GraphQL filter does not match the schema `name`.

**Solution:** Verify the `name` field in your YAML matches exactly what you use in `filter: { table: { value: "..." } }`. Run `insites-cli deploy dev` to push schema changes. Names are case-sensitive.

### The `name:` Key Decides the Table, Not the Filename

**Symptom:** a query for the table named after the file finds nothing, or two files you expected to be two tables are one.

**Cause:** when a schema file has a `name:` key, that key is the table name, whatever the file is called. Measured on a v6 production instance on 24 October 2026: syncing `app/schema/a.yml` holding `name: b` was accepted with no error and created a table named `b`, recorded against the file `schema/a.yml`. One v6 IIA module ships exactly this (a schema file whose name has a typo, with the correct spelling in `name:`), and the module queries the table by the `name:` value. Through the admin API (`admin_table_create`), which has no `name` argument, the table name comes from `physical_file_path`.

**Solution:** keep `name:` equal to the filename so the two cannot disagree, and when they do, query by `name:`.

### "Property not found" or null values in query results

**Cause:** The property name in your GraphQL accessor does not match the property name in the schema, or you are using the wrong accessor type.

**Solution:** Check spelling and case. Use the correct accessor -- `property_int()` for integers, `property_float()` for floats, `property_boolean()` for booleans. Using `property()` for a boolean field returns the string `"true"` or `"false"`, not an actual boolean.

### Upload returns null URL

**Cause:** The file was not uploaded correctly, or the property was set with a string value instead of an actual file upload through a form.

**Solution:** Uploads must come through multipart form submissions using the `file` input type. You cannot set upload properties via GraphQL string values. Ensure your form has `enctype="multipart/form-data"`.

### "Array values must be JSON"

**Cause:** Setting an `array` property with a plain string instead of a JSON array string.

**Solution:** Pass array values as JSON strings: `{ name: "tags", value: "[\"tag1\", \"tag2\"]" }`. In Liquid, use `| json` filter to serialize arrays.

### Removing a property from schema does not delete data

**Cause:** Schema deploys are additive. Removing a property from the YAML file does not drop the column or delete existing data.

**Solution:** This is by design. Old data remains accessible. If you need to clean up data, use a migration to null out or delete records. You can re-add the property later and existing data will still be there.

### Boolean filter not working

**Cause:** Filtering with `properties: [{ name: "active", value: true }]` -- passing a boolean literal instead of a string.

**Solution:** All property filter values must be strings: `{ name: "active", value: "true" }`.

## Limits

| Resource | Limit | Notes |
|----------|-------|-------|
| Properties per schema | ~200 | Practical limit; no hard cap documented |
| Property name length | 255 chars | Must be valid identifier |
| String property value | No limit stated in the schema | `string` holds long text; do not use `text` |
| `text` type | Deprecated | The schema's `PropertyTypeEnum` says "Deprecated, use string instead" |
| Upload max file size | Configurable | Set via `max_size` in options |
| Schema files per app | No hard limit | Limited by deploy time |
| Array property values | JSON array | Must be valid JSON string |
| Nested objects | Not supported | Use a `string` holding JSON (it reads back as a string; see below), or separate tables |

## Troubleshooting Flowchart

```
Schema issue?
├── Deploy error?
│   └── YAML syntax error
│       └── Fix: Validate YAML (check indentation, colons, dashes)
│
├── Data not appearing?
│   ├── Is the table name correct in your GraphQL filter?
│   │   └── Fix: Must match schema name exactly (case-sensitive)
│   ├── Was the schema deployed?
│   │   └── Fix: Run insites-cli deploy dev
│   └── Are you using the right property accessor?
│       └── Fix: Match accessor to type (property_int for integer, etc.)
│
├── Upload not working?
│   ├── Is the form multipart?
│   │   └── Fix: Add enctype="multipart/form-data"
│   ├── Is the file within size/type limits?
│   │   └── Fix: Check max_size and content_type in schema options
│   └── Is acl set correctly?
│       └── public = CDN URL, private = signed URL; no acl option means public
│
└── Relationship not resolving?
    ├── Is the _id property storing the correct ID?
    │   └── Fix: Verify the stored value matches the target record ID
    └── Are related_record arguments correct?
        └── Fix: Check table, join_on_property, foreign_property
```

## `updated_at` is a stamp, not a change log

Measured on v5 and v6 instances between 28 September and 6 October 2026 (TW#26848289):

- An import that **clears** a property does not move `updated_at`; one that changes a value does. A `record_update` can leave it where it was.
- Two edits inside the same second carry the same `updated_at`.
- A row is only listed while it exists: a table whose rows were all deleted drops out of a `records` listing entirely, so a count of rows with `updated_at` after a point in time cannot show deletions.

So `filter: { updated_at: { gt: $since } }` is a guard, not a proof of "nothing changed". Anything that must know for certain (a final sync before a cutover, an audit) compares content, or freezes the source first.

## A deleted row keeps its id reserved

`record_delete` and `records_delete_all` set `deleted_at` and keep the row under its id (see `api.md`). The consequence for anyone re-importing: **that id cannot be imported again**. A row deleted and then imported under the same id comes back under a **new** id, with the old one in `external_id` when `_id_remap` is used (measured 28 September 2026: faqs row 4965, deleted and re-imported, returned as 17714 with `external_id` 4965).

## An Upload Property Can Hold an Upload, an Address or Nothing

Three states, three different reads (TW#26855355, measured on the v6 Ecommerce module's `product_image`, 5 October 2026):

| The property holds | `property(name:)` returns | `property_upload(name:) { url }` |
|---|---|---|
| a file uploaded through the platform | the upload's hash | the CDN `url` |
| an address a module's admin stored as text | that address, as a String | fails: `Property upload should contain only hash ... given of class String` |
| nothing | the text `{}` | null |

Writing the empty `{}` into another upload property is refused (`tried to store {} in property upload which is not a valid URL`). Read with `property(name:)` first and branch on the shape before copying one upload property into another.

## A Property's Type Cannot Be Changed

A property's `attribute_type` cannot be changed after it exists. `admin_property_update` refuses string to upload (`conversion of attribute from string to upload not supported`), and settings for the new type are accepted silently while the column stays the old type. Presigned upload URLs need the column to really be `upload` (otherwise `Could not find Property with type upload`).

To convert: back up each row's value, delete the property, create it as `upload`, then write `null` to every affected row. Writing null clears old text; without it every `property_upload` read on the table fails with `Property upload should contain only hash`. Re-upload the files after that.

## Use `string` for All Text

Use `string` for all text, short or long. It has no 255-character limit, and `text` is deprecated. For long text, set `metadata.ui_element: multi_line`.

## A Table With No Metadata Looks Broken in the Admin

The IIA Databases screen reads the table and field `metadata` (see `schema-table-metadata` in `logic-engine/rules/schema.md`, and [configuration.md](configuration.md#table-and-field-metadata)). This matters for the tables that screen lists, which are a project's own `app/schema` tables. It does not list tables whose name starts with `modules/insites_` (every IIA module private table), any `modules/ins_*` table outside `modules/ins_databases/` (module-v6-data v6.0.3; v6.0.2 hid only nine named custom field tables), or tables whose metadata has `insites_databases_hidden`. Read from module-v6-data v6.0.2, not measured on an instance:

- **No `metadata.label` on the table:** the "Database Table Name" column in the table list is blank. It has no fallback to the table's `name`.
- **A field with no `group_id`:** it is placed after every group, so it sinks to the bottom of the item form. A `group_id` that matches no group is treated the same way, which is what happens when a group's uuid changes between deploys.
- **No groups at all:** the items list sorts its columns on a `weight` outside `metadata`, so `metadata.weight` is not used there.
- **Updating metadata through the admin API:** the admin's own save sends the whole metadata object, starting from what the table already has. Do the same, and send every key of a field's `metadata`, so nothing you did not mean to change is dropped.

## A `string` Holding JSON Reads Back as a String

A `string` property that stores JSON comes back from `property(name: ...)` as text, not as an object, and `property_object` does not parse it: that accessor is for properties stored as objects, not for a `string` column. Measured on an instance in September 2026. Parse it in the template:

```liquid
{% assign settings = row.settings | parse_json %}
```

## Restricted Property Names: `errors` and `model`

A property named `errors` or `model` is refused at deploy with `Name not allowed name, list of restricted names: errors, model`. Measured on an instance in September 2026. Rename it (`car_model`, `validation_errors`).

## A Property Name Can Start With a Digit

Measured on a v6 production instance on 24 October 2026: `admin_table_create` accepted a property named `1abc`, and `record_create` wrote it and `property(name: "1abc")` read it back. This was checked through the admin API only, not through a schema file deployed by the CLI. A name starting with a letter is still the safer choice for anything that turns property names into identifiers (generated forms, exports, JavaScript).

## A v5 Site's Tables Are Hidden on v6

A v5 site keeps its own tables under `modules/ins_database/<name>` (singular). module-v6-data v6.0.3 hides every `modules/ins_*` table outside `modules/ins_databases/` (`functions/databases/table_rule`), so after a move to v6 the site still reads and writes them and the Databases screen lists none of them. Measured on a v6 production instance on 31 October 2026: ten v5 tables with 7,424 rows, none listed. "No databases" here is a hidden namespace, not lost data.

To fix: create each table as `modules/ins_databases/<name>` (`admin_table_create` with `physical_file_path: "modules/ins_databases/public/schema/<name>.yml"`; `app/schema/...` and `schema/...` were refused as invalid paths), copy the rows, repoint the GraphQL and forms, then delete the old tables.

## `record_create` Ignores `created_at`; `record_update` Honours It

`RecordInputType` takes `created_at` and `updated_at`. On `record_create` both are accepted and silently replaced with the current time. On `record_update` they are written. Measured on a v6 production instance on 31 October 2026: 7,424 copied rows all carried the copy date until a second pass set the originals with `record_update`, which left every property untouched. Copy, then restore the dates, then read them back.

## `records_delete_all` With `sync: true` Times Out on a Large Table

On a table of about 5,000 rows `records_delete_all(table:, sync: true)` answered 504 Gateway Timeout. Without `sync` it returns at once and the rows go in the background; poll `total_entries` until it is 0 before `admin_table_delete`. Measured on a v6 production instance on 31 October 2026. Deleted rows are soft-deleted, so the Databases screen counts them under "Soft Deleted" for 30 days.

## See Also

- [README.md](README.md) -- overview and getting started
- [configuration.md](configuration.md) -- full YAML format reference
- [api.md](api.md) -- GraphQL operations
- [patterns.md](patterns.md) -- recommended schema patterns
- [advanced.md](advanced.md) -- advanced techniques
