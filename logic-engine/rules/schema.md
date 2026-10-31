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
evidence_source: "Insites product decision by the Product Owner, 17 October 2026: every table a person sees in the IIA Databases screen has a name, field groups, and a tooltip on every field. The rule covers those tables only. The Databases list (module-v6-data v6.0.2, controllers/databases/get_list.liquid:41-87) leaves out every table whose name starts with modules/insites_, nine named modules/ins_* custom field tables, and any table whose metadata has the key insites_databases_hidden. All 114 schema files in the v6 IIA modules sit under modules/insites_*/private/schema, so none of them is listed there and none is in scope. The keys and how the screen reads them come from module-v6-data v6.0.2 (2755e6c), module-v6-cms v6.0.2 (946e189) and the cli-tool mock of the databases response (v5.9.2); the citations are under Verified by. Read from source, not yet measured on an instance."
related: [schema-property-functions]
---
```

**Rule:** Every table that appears in the IIA Databases screen names the table, groups its fields, and gives every field a label, a place and a tooltip. In practice that is a project's own `app/schema` tables: the customer and app tables a person opens, reads and edits in the admin.

**Scope:** The rule is about what people see, so it covers the tables the Databases screen lists and nothing else. The list leaves out:

- every table whose name starts with `modules/insites_`, which is every schema file under `modules/insites_<name>/private/schema` in the IIA modules,
- every table whose name starts with `modules/ins_` and not with `modules/ins_databases/` (module-v6-data v6.0.3 `functions/databases/table_rule`),
- any table whose `metadata` has the key `insites_databases_hidden`.

A table a person should see therefore goes in `app/schema`, in a site's own module (`modules/website/...`), or under `modules/ins_databases/`.

Those tables are not shown to anyone in the admin, so they are exempt. If you are unsure whether a table is listed, apply the rule: the keys cost nothing on a hidden table.

What each key holds:

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

**Why:** Customer tables are shown in the admin, and these keys are what the IIA Databases screen shows. The table list's "Database Table Name" column is `metadata.label` with nothing to fall back on, so a table with no label has a blank name in the list. The item form shows each group as a heading with its fields under it in `weight` order, labels each field with `metadata.label` (or its raw `name`), and shows `metadata.help_text_tooltip` beside it. Fields with no `group_id`, or with a `group_id` that matches no group, are moved below every group, so an ungrouped field sinks to the bottom of the form. In the items list, a table with no groups at all sorts its columns on a `weight` outside `metadata`, so the weights you set are not used there. Without the tooltips, the next person to open a record has to guess what a field holds and which codes are allowed.

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
- Which tables are listed: `module-v6-data` v6.0.2 `pos/modules/insites_databases/private/views/partials/controllers/databases/get_list.liquid:41-87`, the filter behind `/insites/databases` (`vue/src/services/DatabasesServices.js:3-9`, called from `Databases.vue:197`): `not_starts_with: "modules/insites_"` on `name` and `parameterized_name`, a `not_value_in` list of nine `modules/ins_*` custom field tables, and `has_key: "insites_databases_hidden"` with `exclude: true`. All 114 schema files in the v6 IIA modules are under `modules/insites_*/private/schema` (counted 17 October 2026).
- The table list: `module-v6-data` v6.0.2 `vue/src/views/Databases/Databases.vue:320`, the "Database Table Name" column is `metadata?.label` with no fallback.
- Grouping and order: `module-v6-data` v6.0.2 `vue/src/modules/DatabasesModule.js:4-55` (`sortDatabaseFields`: groups by `weight`, fields by `metadata.weight` inside each group, ungrouped fields appended after every group, and with no groups a sort on `field.weight` at line 50; called for the items list at `DatabaseItems.vue:1269`) and `:98-136` (`setFieldGrouping`: a `group_id` that matches no group is cleared and the field is placed after the groups).
- The item form: `module-v6-data` v6.0.2 `vue/src/views/Databases/routes/DatabaseItems/routes/ManageDatabaseItem/sections/DatabaseItemForm/DatabaseItemForm.vue:14` (group heading), `:23` and `:51` (`metadata.label || name`), `:26` and `:54` (`help_text_tooltip`).
- Select options are stored codes: `module-v6-data` v6.0.2 `vue/src/components/DynamicFields/DynamicFields.vue:145-148`, each option is both the label and the value.
- The admin's save: `module-v6-data` v6.0.2 `vue/src/views/Databases/routes/ManageDatabase/ManageDatabase.vue:399-422` (starts from the existing metadata and writes `label` and `groups` as `{id, name, weight}`) and `.../ManageField/ManageField.vue:119-143` (the full list of field metadata keys, `help_text_tooltip` among them).

---

```yaml
---
id: schema-ui-element-matches-type
applies_to: [schema]
severity: error
evidence: real-project
evidence_source: "Measured on a v6 production instance on 31 October 2026 (Click Therapy rebuild, TW#26951046): fields set to ui_element image on an upload column, and phone on a string column, saved without error, offered no table-view toggle and showed no column. Changing them to media_image and input fixed both. The type list, each element's attribute types and has_show_in_table are module-v6-data v6.0.3 vue/src/models/uiElements.js; the column keys are ColumnSettings.vue and useItemColumns.js."
related: [schema-table-metadata]
---
```

**Rule:** Give every property a `metadata.ui_element` that the Data module allows for its `attribute_type`, and set the table-view keys on the fields a person scans the list by.

The admin saves any `ui_element` without complaint, so a mismatch fails silently: the field edits oddly, cannot be shown as a column, and the "Display Fields" panel leaves it out.

| `attribute_type` | Use | Not |
|---|---|---|
| `upload` | `media_image`, `media_file` | `image` and `file` (those are for the legacy `photo` and `file` types) |
| `string` phone numbers | `input` | `phone`, which requires `integer` and drops a leading zero |
| `string` rich text | `html` | `rich_text`, which is not a ui_element |
| `string` long text | `multi_line` | |

**Which elements can be a column.** `multi_line`, `html`, `markdown`, `code`, `table`, and every image, file and media element have `has_show_in_table: false`. The Display Fields panel does not offer them, whatever you set. A long message field cannot be a list column on v6; show the name, email and subject, and open the item for the message.

**Table-view keys**, on each property's `metadata`:

| Key | Does |
|---|---|
| `is_shown_in_table: true` | The field is a column in the items list and appears switched on in Display Fields |
| `column_weigthing: <n>` | Column order. **Spelled `weigthing`**, as the module reads it |
| `is_searchable: true` | Offered in "Search By" |
| `is_sortable: true` | The column header sorts |

With none set, the items list shows only ID, Date Created and Last Updated, which reads as "the fields are missing".

**Email fields:** set `is_linked_to_crm_contact: true` (element `email` on a `string`). The item screen then links the address to the matching CRM contact (`ManageDatabaseItem.vue` `setLinks`). This is separate from the contact's "Related data" panel, which lists every record whose `user_id` is that contact (module-v6-crm v6.1.6 `graphql/contacts/related_data/get_related_data.graphql`), so a form must also set the row's `user_id`.

✅ **Correct:**
```yml
  - name: email_address
    type: string
    metadata:
      label: "Email"
      group_id: "a1f0c7d2-1b11-4c51-9e01-000000000001"
      weight: 2
      ui_element: email
      is_linked_to_crm_contact: true
      is_shown_in_table: true
      is_searchable: true
      is_sortable: true
      column_weigthing: 2
      help_text_tooltip: "The email address to reply to."
  - name: photo
    type: upload
    metadata:
      ui_element: media_image
```

❌ **Wrong:** `ui_element: image` on an `upload`, `ui_element: phone` on a `string`, `ui_element: rich_text`, and no `is_shown_in_table` anywhere.

**Verified by:**
- `module-v6-data` v6.0.3 `vue/src/models/uiElements.js` (`id`, `field_types`, `has_show_in_table`, `has_link_to_crm_contact` per element).
- `module-v6-data` v6.0.3 `vue/src/components/ListPage/ColumnSettings/ColumnSettings.vue` and `.../DatabaseItems/composables/useItemColumns.js` (`is_shown_in_table`, `column_weigthing`).
- Measured on a v6 production instance, 31 October 2026: the four fixes above, read back in the admin.

