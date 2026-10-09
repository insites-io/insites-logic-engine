# Data — Configuration

What an instance administrator can configure in IIA's Data module. Database creation and column schema management are **IIA-only** — there is no V2 API for them. Once a database exists in IIA, the V2 API takes over for items inside it.

For authentication, see the shared [`references/api/authentication.md`](../../api/authentication.md).

---

## IIA admin paths

| What | IIA path |
|---|---|
| Databases list | `<your-insites-instance>/admin/insites#/databases` |
| Create a new database | `<your-insites-instance>/admin/insites#/databases/add` |
| Edit a database (overview) | `<your-insites-instance>/admin/insites#/databases/:id` |
| Manage a database's column schema | `<your-insites-instance>/admin/insites#/databases/:id/fields` |
| View a database's audit / event-stream history | `<your-insites-instance>/admin/insites#/databases/:id/event-stream` |
| Database system info | `<your-insites-instance>/admin/insites#/databases/:id/system-info` |
| View items inside a database | `<your-insites-instance>/admin/insites#/databases/:id/items` |
| Add an item | `<your-insites-instance>/admin/insites#/databases/:database_id/items/add` |
| Edit an item | `<your-insites-instance>/admin/insites#/databases/:database_id/items/:id` |
| View an item | `<your-insites-instance>/admin/insites#/databases/:database_id/items/:id/view` |
| Reports (cross-database analytics) | `<your-insites-instance>/admin/insites#/reports` |

---

## Editing a database — IIA tabs

When editing a database in IIA, the form is split into tabs:

| Tab | Path suffix | Manages |
|---|---|---|
| Details | (default) | Database name, label, description, metadata |
| Fields | `/fields` | Column schema — name, type, validation, defaults, options |
| Event Stream | `/event-stream` | Audit log of changes for this database |
| System Info | `/system-info` | Internal system metadata |

---

## Defining columns (the Fields tab)

Each column on a database has:

| Property | Description |
|---|---|
| `name` | The column's name. Becomes the dotted key when writing items: `properties.<name>` |
| `attribute_type` | Storage type: `string`, `integer`, `float`, `boolean`, `array`, `geo_json` |
| `belongs_to` | If the column is a related-record reference, the schema path it points at (e.g. `modules/insites_crm/crm_contact`) |
| `metadata.label` | Display label used in IIA tables and forms |
| `metadata.ui_element` | UI hint: `input`, `dropdown`, `checkbox`, `card_select_multiple`, `textarea`, `file_multiple`, etc. |
| `options` | Allowed values for enum-style columns |
| `default_value` | Default applied when not provided |

The full column schema for a database is exposed via the V2 API at `GET /databases/api/v2/databases/:id` — useful when generating form UIs or validating item payloads against the database's expected shape.

---

## Reports

A separate `Reports` view at `/reports` provides cross-database analytics. This is IIA-only — there is no V2 REST API for reports.

---

## Out of scope for this document

- **Module install / version updates** — handled through the Insites console.
- **Roles** — Insites does not have built-in roles. Per-instance access is controlled via `authorization_policies`.
- **Auth** — handled in [`references/api/authentication.md`](../../api/authentication.md). Same instance API key as every other V2 surface.
- **Webhooks** — data fires none.
