# Rules — Schema

Rules that apply to schema definitions and the GraphQL property-access functions used to read them.

---

```yaml
---
id: schema-property-functions
applies_to: [graphql]
severity: error
evidence: real-project
evidence_source: "100% compliance across 30+ GraphQL files. property(), property_int(), property_float(), property_boolean(), property_array(), property_upload() used universally."
audit_ref: audit/v0-conflicts-batch3.md#rule-r-25
---
```

**Rule:** Access schema properties in GraphQL via the typed property functions:

| Function | For property type |
|---|---|
| `property(name: "...")` | string (default) |
| `property_int(name: "...")` | integer |
| `property_float(name: "...")` | float / decimal |
| `property_boolean(name: "...")` | boolean |
| `property_array(name: "...")` | array |
| `property_upload(name: "...")` | file upload |
| `property_upload_presigned_url(name: "...")` | presigned upload URL |

**Why:** The platform stores all properties as strings under the hood. The typed accessor functions cast to the correct runtime type and surface errors when a property is misused (e.g. requesting `property_int` for a string property fails clearly, instead of silently returning a string with surprising behaviour downstream).

**How to apply:**
```graphql
results {
  id
  email: property(name: "email")
  age: property_int(name: "age")
  is_active: property_boolean(name: "is_active")
  tags: property_array(name: "tags")
  avatar: property_upload(name: "avatar")
}
```

**Verified by:**
- `app-portal/modules/portal/public/graphql/credit_cards/get_selected_credit_card.graphql` — `property()` and `property_boolean()`
- `app-portal/modules/portal/public/graphql/clients/get_discount_by_code.graphql` — `property_int()` for usage_count, usage_limit
- `app-portal/modules/portal/public/graphql/uploads/get_s3_upload.graphql` — `property_upload_presigned_url()`

---

```yaml
---
id: schema-table-metadata
applies_to: [schema]
severity: error
evidence: skill-only
evidence_source: "Insites product decision by the Product Owner, 17 October 2026: every table has a name, field groups, and a tooltip on every field. Not yet followed by the IIA modules: of 114 schema files across the 10 v6 module repos that have a schema folder (counted 17 October 2026), 1 carries a table label (module-v6-cms system_api_enpoints.yml, with an empty groups list), 1 carries property labels, and none carry a group or a tooltip. The keys and how the IIA Databases screen reads them come from module-v6-data v6.0.2 (2755e6c), module-v6-cms v6.0.2 (946e189) and the cli-tool mock of the databases response (v5.9.2); the citations are under Verified by. Read from source, not yet measured on an instance."
related: [schema-property-functions]
---
```

**Rule:** Every table schema you write names the table, groups its fields, and gives every field a label, a place and a tooltip:

| Key | Where | What it holds |
|---|---|---|
| `metadata.label` | table | The table's plain name, as people say it ("Website Enquiries", not `enquiry`) |
| `metadata.groups` | table | An array of `{id, name, weight}`. `id` is a uuid, `name` is the heading, `weight` orders the groups |
| `metadata.label` | every property | The field's plain name |
| `metadata.group_id` | every property | The `id` of the group the field sits in |
| `metadata.weight` | every property | The field's order inside its group |
| `metadata.help_text_tooltip` | every property | What the field holds, in one or two plain sentences |

What a tooltip says:

- **What the field holds**, in words the person editing the record uses. "The email address the enquiry came from", not "string".
- **For a field that stores a code, every permitted value**, and what each means: "One of: `new` (not yet answered), `contacted` (we replied), `closed` (no further action)."
- **For a code, that the code is permanent.** Renaming a property, or changing a stored code, orphans the rows that already hold the old one. Labels, group names and tooltips are display only and can be reworded at any time.

Hard-code the group uuids in the file. Generate each one once, when you write the schema, and never regenerate it: `group_id` on every property points at it, so a uuid that changes between deploys or between instances leaves every field pointing at a group that no longer exists.

**Why:** These keys are what the IIA Databases screen shows. The table list's "Database Table Name" column is `metadata.label` with nothing to fall back on, so a table with no label has a blank name in the list. The item form shows each group as a heading with its fields under it in `weight` order, labels each field with `metadata.label` (or its raw `name`), and shows `metadata.help_text_tooltip` beside it. Fields with no `group_id`, or with a `group_id` that matches no group, are moved below every group, so an ungrouped field sinks to the bottom of the form. In the items list, a table with no groups at all sorts its columns on a `weight` outside `metadata`, so the weights you set are not used there. Without the tooltips, the next person to open a record has to guess what a field holds and which codes are allowed.

The severity is `error` because it is a required Insites standard, not a suggestion: a table that ships without these keys is incomplete, even though nothing fails at runtime.

**How to apply:**

1. **Put `metadata` at the top of the schema file**, beside `name` and `properties`, with `label` and `groups`.
2. **Give every property its own `metadata`** with `label`, `group_id`, `weight` and `help_text_tooltip`. Add `ui_element` to choose how the admin edits the field (`input`, `multi_line`, `select`, `toggle`, `date_time` and others, listed in module-v6-data `vue/src/models/uiElements.js`).
3. **Use three to five groups of three to six fields**, named for what the reader is looking at ("Contact details", "Follow-up"), not for the form that wrote the row. Number group weights from 0 and field weights from 0 inside each group.
4. **A `select` stores its option text.** Each entry in `metadata.options` is both what the admin shows and what the row stores, so an option is a stored code: list the options in the tooltip, and treat changing one as changing a code.
5. **Tables you create or change through the admin GraphQL API need the same keys.** `admin_table_create`, `admin_table_update` and `admin_property_update` take `metadata`. The admin's own save sends the whole metadata object: it starts from the table's existing metadata and carries every key of each field. Do the same, so a key you did not mean to change is not lost.

✅ **Correct:** `app/schema/enquiry.yml`
```yml
name: enquiry
metadata:
  label: "Website Enquiries"
  groups:
    - id: "0566723b-8958-4dbe-bdfa-bd591be5d059"
      name: "Contact details"
      weight: 0
    - id: "c3be7356-fb4a-41f4-bd3f-946c27afa4e2"
      name: "Enquiry"
      weight: 1
    - id: "461612aa-e5a6-45ac-b8bd-5a0f2f19ea93"
      name: "Follow-up"
      weight: 2
properties:
  - name: full_name
    type: string
    metadata:
      label: "Name"
      group_id: "0566723b-8958-4dbe-bdfa-bd591be5d059"
      weight: 0
      ui_element: input
      help_text_tooltip: "The name the person typed into the enquiry form."
  - name: email
    type: string
    metadata:
      label: "Email"
      group_id: "0566723b-8958-4dbe-bdfa-bd591be5d059"
      weight: 1
      ui_element: input
      help_text_tooltip: "The email address to reply to. Stored in lowercase."
  - name: message
    type: string
    metadata:
      label: "Message"
      group_id: "c3be7356-fb4a-41f4-bd3f-946c27afa4e2"
      weight: 0
      ui_element: multi_line
      help_text_tooltip: "What the person asked, exactly as they wrote it."
  - name: status
    type: string
    metadata:
      label: "Status"
      group_id: "461612aa-e5a6-45ac-b8bd-5a0f2f19ea93"
      weight: 0
      ui_element: select
      options: ["new", "contacted", "closed"]
      help_text_tooltip: "Where the enquiry is. One of: new (not yet answered), contacted (we replied), closed (no further action). These are stored codes: changing one orphans the rows that hold it. The label can be reworded freely."
```

❌ **Wrong:**
```yml
name: enquiry
properties:
  - name: full_name
    type: string
  - name: status
    type: string
```

No table name, so the Databases list shows a blank name. No groups, labels or tooltips, so the item form shows raw field names in no set order, and nothing says that `status` takes `new`, `contacted` or `closed`.

**Verified by:**
- The file's `metadata` is what the instance stores: the bundled GraphQL schema describes `Table.metadata` and `Property.metadata` as "Free-form data attached to the resource with the metadata key of its file (or the metadata argument of an admin mutation)". See [`graphql/schema/schema.json`](../../skills/insites/references/graphql/schema/schema.json).
- A shipped schema file with table and property metadata: `module-v6-cms` v6.0.2 `schema/system_api_enpoints.yml` (`metadata.label`, `metadata.groups`, and `label` and `weight` on each property).
- The shape of groups and of each field's keys: `cli-tool` v5.9.2 `cli/mock/responses/databases.js:464-520`, a databases response with four groups of `{id: <uuid>, name, weight}` and properties carrying `group_id`, `weight` and `help_text_tooltip`.
- The table list: `module-v6-data` v6.0.2 `vue/src/views/Databases/Databases.vue:320`, the "Database Table Name" column is `metadata?.label` with no fallback.
- Grouping and order: `module-v6-data` v6.0.2 `vue/src/modules/DatabasesModule.js:4-55` (`sortDatabaseFields`: groups by `weight`, fields by `metadata.weight` inside each group, ungrouped fields appended after every group, and with no groups a sort on `field.weight` at line 50; called for the items list at `DatabaseItems.vue:1269`) and `:98-136` (`setFieldGrouping`: a `group_id` that matches no group is cleared and the field is placed after the groups).
- The item form: `module-v6-data` v6.0.2 `vue/src/views/Databases/routes/DatabaseItems/routes/ManageDatabaseItem/sections/DatabaseItemForm/DatabaseItemForm.vue:14` (group heading), `:23` and `:51` (`metadata.label || name`), `:26` and `:54` (`help_text_tooltip`).
- Select options are stored codes: `module-v6-data` v6.0.2 `vue/src/components/DynamicFields/DynamicFields.vue:145-148`, each option is both the label and the value.
- The admin's save: `module-v6-data` v6.0.2 `vue/src/views/Databases/routes/ManageDatabase/ManageDatabase.vue:399-422` (starts from the existing metadata and writes `label` and `groups` as `{id, name, weight}`) and `.../ManageField/ManageField.vue:119-143` (the full list of field metadata keys, `help_text_tooltip` among them).
