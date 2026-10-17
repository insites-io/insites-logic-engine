# Schema Configuration Reference

Complete reference for schema YAML files, property types, options, and file structure.

## File Location and Structure

```
app/
└── schema/
    ├── product.yml
    ├── category.yml
    ├── order.yml
    ├── order_item.yml
    └── user_profile.yml
```

Every schema file lives in `app/schema/` and has a `.yml` extension.

> **Module path:** In modules, schema files live in `modules/<module_name>/public/schema/` or `modules/<module_name>/private/schema/`. A table in either is read and written by name in the same way; only `public/` tables appear in `admin_tables` and `admin_model_schemas`. Every IIA module uses `private/schema/`.

## YAML Format

A schema file has two required top-level keys, `name` and `properties`, and a `metadata` key that every table must carry (see [Table and Field Metadata](#table-and-field-metadata)). The short examples on this page leave `metadata` out to keep the property types readable.

```yaml
name: product
properties:
  - name: title
    type: string
  - name: description
    type: string
  - name: price
    type: float
```

### Rules

- `name` **must** match the filename without extension (`product.yml` requires `name: product`).
- `properties` is an array of objects, each with `name` and `type`.
- Property names must be unique within a schema.
- Property names should use `snake_case`.

## Property Types

| Type | Storage | Use Case | GraphQL Accessor |
|------|---------|----------|------------------|
| `string` | Short text, indexed | Titles, names, slugs, IDs | `property(name:)` |
| `text` | **Deprecated.** The schema's `PropertyTypeEnum` says "Deprecated, use string instead"; `string` holds long text | Do not use | `property(name:)` |
| `integer` | Whole numbers | Quantities, counts, ages | `property_int(name:)` |
| `float` | Decimal numbers | Prices, ratings, coordinates | `property_float(name:)` |
| `boolean` | `true` / `false` | Flags, toggles, status | `property_boolean(name:)` |
| `datetime` | Date + time with timezone | Timestamps, scheduled dates | `property(name:)` |
| `date` | Date only (no time) | Birthdays, due dates | `property(name:)` |
| `array` | Ordered list of values | Tags, categories, multi-select | `property_array(name:)` |
| `upload` | File reference | Images, documents, media | `property_upload(name:)` |

## Upload Type Options

The `upload` type accepts an `options` object:

```yaml
- name: avatar
  type: upload
  options:
    acl: public              # public (CDN-accessible) or private (signed URL)
    max_size: 2097152        # bytes (2 MB)
    content_type:            # allowed MIME types
      - image/jpeg
      - image/png
      - image/webp
```

| Option | Values | Default | Description |
|--------|--------|---------|-------------|
| `acl` | `public`, `private` | **`public`** | Public files served via CDN; private require signed URLs |
| `max_size` | Integer (bytes) | Platform default | Maximum upload file size |
| `content_type` | Array of MIME strings | All types | Restrict accepted file types |

**Leaving `acl` out makes the file public.** The platform schema sets the default on
`PropertyUploadOptionsInput.acl` to `public`, and a presign for an upload property with no
`acl` option comes back with `acl: public-read`, so anyone holding the URL can open the file.
Set `acl: private` (in the property options, or as `acl` in the `presign_url` argument of
`property_upload_presigned_url`) for anything a visitor submits. A private file is then read with
`property_upload(name: "...", expires_in: <seconds>) { url }`: the schema says `expires_in` must
be set when the ACL is private, and the unsigned `url` does not open it.

## Table and Field Metadata

**Required for every table shown in the IIA Databases screen**, which means a project's own `app/schema` tables: each carries a name, field groups, and a label, group, order and tooltip on every field (rule `schema-table-metadata` in `logic-engine/rules/schema.md`). Module private tables (`modules/insites_<name>/private/schema`) are not listed in that screen and are exempt. The `metadata` you write in the file is what the instance stores as the table's and each property's `metadata`, and it is what the IIA Databases screen shows.

```yml
name: enquiry
metadata:
  label: "Website Enquiries"            # the table's name in the Databases list
  groups:                               # headings on the item form, ordered by weight
    - id: "0566723b-8958-4dbe-bdfa-bd591be5d059"   # a uuid, generated once and hard-coded
      name: "Contact details"
      weight: 0
    - id: "461612aa-e5a6-45ac-b8bd-5a0f2f19ea93"
      name: "Follow-up"
      weight: 1
properties:
  - name: email
    type: string
    metadata:
      label: "Email"
      group_id: "0566723b-8958-4dbe-bdfa-bd591be5d059"
      weight: 0                         # order inside the group
      ui_element: input
      help_text_tooltip: "The email address to reply to. Stored in lowercase."
  - name: status
    type: string
    metadata:
      label: "Status"
      group_id: "461612aa-e5a6-45ac-b8bd-5a0f2f19ea93"
      weight: 0
      ui_element: select
      options: ["new", "contacted", "closed"]
      help_text_tooltip: "One of: new (not yet answered), contacted (we replied), closed (no further action). Stored codes: changing one orphans the rows that hold it."
```

| Key | On | Holds |
|---|---|---|
| `metadata.label` | table | The table's plain name |
| `metadata.groups` | table | `[{id, name, weight}]`; `id` is a uuid |
| `metadata.label` | property | The field's plain name |
| `metadata.group_id` | property | The `id` of its group |
| `metadata.weight` | property | Its order inside the group |
| `metadata.help_text_tooltip` | property | What it holds; for a code, every permitted value |
| `metadata.ui_element` | property | How the admin edits it: `input`, `multi_line`, `select`, `toggle`, `date_time` and others |
| `metadata.options` | property (`select`) | The choices. Each one is both the text shown and the value stored |

- **Hard-code the group uuids.** Every `group_id` points at one, so a uuid that changes between deploys leaves fields pointing at a group that no longer exists, and they drop below every group.
- **Labels, group names and tooltips can be reworded at any time.** Property names and stored codes (including `select` options) cannot: renaming one orphans the rows that already hold the old value.
- Tables created or changed with `admin_table_create`, `admin_table_update` or `admin_property_update` take the same keys in their `metadata` argument.

## Built-in Fields

Every record automatically has these fields (do **not** declare them in your schema):

| Field | Type | Description |
|-------|------|-------------|
| `id` | ID | Unique auto-generated identifier |
| `created_at` | DateTime | Set on creation, immutable |
| `updated_at` | DateTime | Updated on every mutation |
| `table` | String | The schema name (e.g., `"product"`) |

## Relationship Conventions

Insites has no foreign key constraints. Relationships are modeled by property naming convention and resolved in GraphQL.

### Belongs-to (store an ID reference)

```yaml
# app/schema/order.yml
name: order
properties:
  - name: user_id
    type: string
  - name: status
    type: string
  - name: total
    type: float
```

### Has-many (referenced from the child side)

```yaml
# app/schema/order_item.yml
name: order_item
properties:
  - name: order_id
    type: string
  - name: product_id
    type: string
  - name: quantity
    type: integer
  - name: unit_price
    type: float
```

The `_id` suffix is a convention, not enforced. Use `string` type for ID references -- this works for both record IDs and user IDs.

### Resolution in GraphQL

Relationships are resolved at query time using `related_record` and `related_records`:

```graphql
results {
  id
  user: related_record(table: "user", join_on_property: "user_id") {
    email
  }
  items: related_records(table: "order_item", join_on_property: "id", foreign_property: "order_id") {
    quantity: property_int(name: "quantity")
  }
}
```

## Minimal Example

```yaml
# app/schema/tag.yml
name: tag
properties:
  - name: label
    type: string
```

## Complete Example

```yaml
# app/schema/blog_post.yml
name: blog_post
properties:
  - name: title
    type: string
  - name: slug
    type: string
  - name: body
    type: string
  - name: author_id
    type: string
  - name: category_id
    type: string
  - name: published
    type: boolean
  - name: published_at
    type: datetime
  - name: view_count
    type: integer
  - name: rating
    type: float
  - name: tags
    type: array
  - name: cover_image
    type: upload
    options:
      acl: public
      max_size: 10485760
      content_type:
        - image/jpeg
        - image/png
        - image/webp
```

## Deploying Schema Changes

```bash
# Deploy all schema files to your instance
insites-cli deploy dev

# Schema changes are applied automatically during deploy
# Adding new properties is non-destructive
# Removing properties does NOT delete existing data
```

## See Also

- [README.md](README.md) -- overview and getting started
- [api.md](api.md) -- GraphQL operations for schema-defined records
- [patterns.md](patterns.md) -- schema design patterns
- [gotchas.md](gotchas.md) -- common errors and limits
- [advanced.md](advanced.md) -- advanced schema techniques
- [../graphql/configuration.md](../graphql/configuration.md) -- GraphQL file configuration
