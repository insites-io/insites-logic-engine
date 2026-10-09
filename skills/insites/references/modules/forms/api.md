# Forms — Endpoints

All 20 endpoints sit under `/insites/forms`. File paths are relative to the module's `private/views/pages/api/forms/`. Counted in module-v6-forms v6.0.3 on 9 October 2026.

## Conventions

- **Layout.** `modules/insites_crm/json`, except the two previews (CRM's `external_email_layout` and `internal_email_layout`).
- **Auth.** "Admin" = front matter lists `modules/insites_crm/insites_only_allowed_by_administrators`. "Public" = no `authorization_policies` key.
- **Bodies.** Writes read `context.params.payload`; the SPA posts `{ "payload": { ... } }`.
- **Status.** Controllers set `200` only when the GraphQL result has `items`, then call `modules/insites_crm/functions/response_handler`; a failed mutation leaves the status unset and the body carries `errors`. List and read-one use `insites_response_handler` / `insites_response_util` and set `400`. The helpers' `format=json` rule is [`../crm/gotchas.md`](../crm/gotchas.md) gotcha 3.

| Method | Path | Access | Page file |
|---|---|---|---|
| GET | `/insites/forms` | Admin | `get_list.liquid` |
| GET | `/insites/forms/:id` | Admin | `get_by_id.liquid` |
| POST | `/insites/forms` | Admin | `post.liquid` |
| PUT | `/insites/forms` | Admin | `put.liquid` |
| DELETE | `/insites/forms` | Admin | `delete.liquid` |
| GET | `/insites/forms/databases` | Admin | `databases/get.liquid` |
| GET | `/insites/forms/auth-policies` | Admin | `auth_policies/get.liquid` |
| GET | `/insites/forms/email-layouts` | Admin | `email_layouts/get.liquid` |
| GET | `/insites/forms/type` | Admin | `env/get.liquid` |
| GET | `/insites/forms/my-profile` | Admin | `my_profile/get.liquid` |
| POST | `/insites/forms/email-notifications` | Admin | `email_notifications/post.liquid` |
| PUT | `/insites/forms/email-notifications` | Admin | `email_notifications/put.liquid` |
| POST | `/insites/forms/email-notifications/test-email` | Admin | `email_notifications/test_email/post.liquid` |
| GET | `/insites/forms/email-notifications/autoresponder` | Admin | `email_notifications/default/autoresponder.liquid` |
| GET | `/insites/forms/email-notifications/workflow` | Admin | `email_notifications/default/workflow.liquid` |
| DELETE | `/insites/forms/attachments` | Admin | `attachments/delete.liquid` |
| GET | `/insites/forms/attachments/credentials` | Public | `attachments/credentials/get.liquid` |
| POST | `/insites/forms/attachments` | Public | `attachments/post.liquid` |
| GET | `/insites/forms/presigner` | Public | `upload/upload.liquid` |
| GET | `/insites/forms/viewer` | Public | `viewer/viewer.liquid` |

`controllers/forms/file/get_credentials.liquid` is empty and unreferenced.

## Forms

**`GET /insites/forms`** (`controllers/forms/get_list.liquid`, `admin_forms`). Params: `page` (1), `size` (10), `search` (lower-cased), `field` (`File Path`, `Form Path`, `Resource`, `Form Name`; the last searches `metadata.label`, the rest use `contains` on `physical_file_path`, `name`, `resource`), `sort` and `order` (same labels, default `updated_at DESC`). Returns `items.total_entries` and `items.results[]` of `{ id, metadata, resource, form_path, file_path, last_updated }`.

**`GET /insites/forms/:id`** (`controllers/forms/get_details.liquid`). The full form (`graphql/forms/get_form.graphql`): every `admin_form_create` field below plus `authorization_policies[]`, `email_notifications[]`, `configuration` (the platform's `fields`) and timestamps. `400` when nothing comes back.

**`POST` / `PUT /insites/forms`** (`controllers/forms/add.liquid`, `edit.liquid`; `admin_form_create`, `admin_form_update` keyed on `physical_file_path`). The whole `payload` is spread into the mutation, so the accepted keys are its variables: `configuration`, `default_payload`, `metadata`, `liquid_body`, `resource` (required), `physical_file_path` (required), `spam_protection`, `redirect_to`, `flash_alert`, `flash_notice`, `callback_actions`, `async_callback_actions`, `async_callback_priority`, `async_callback_max_attempts`, `async_callback_delay` (coerced to a string), `authorization_policy_ids`. Returns the read-one shape.

**`DELETE /insites/forms`** (`controllers/forms/delete.liquid`). Needs `payload.id` **and** `payload.physical_file_path` equal to the stored path, else nothing is deleted and the status stays unset. On a match it deletes the form's notifications by path, then the form. Returns `items.id`.

## Lookups

**`GET /insites/forms/databases`**. Without `name`: `admin_tables` minus names starting `modules/insites_`, nine `modules/ins_*/*_custom_field` tables and tables with the metadata key `insites_databases_hidden`; `functions/databases/drop_archived` then drops `metadata.is_archived == true` and recounts. With `name=<table>`: that table with its `properties[]` (`name`, `attribute_type`, `belongs_to`, `metadata`, `options`, `default_value`, and more).

**`GET /insites/forms/auth-policies`**. `admin_authorization_policies` not under `modules/insites_`, up to 1,000.

**`GET /insites/forms/email-layouts`**. `admin_liquid_layouts`, up to 1,000: `{ id, format, path, metadata, physical_file_path }`.

**`GET /insites/forms/type`**. `{ "results": false }` on `context.environment == "staging"`, else `true`.

**`GET /insites/forms/my-profile`**. `{ "name", "email" }` of the current user.

## Email notifications

**`POST` / `PUT /insites/forms/email-notifications`** (`controllers/forms/email_notifications/add_email_notification.liquid`, `edit_email_notification.liquid`). Payload keys: `form_configuration_ids` (array with the form id), `form_name`, `physical_file_path`, `layout`, `content`, `trigger_condition`, `subject`, `to`, `reply_to`, `from`, `from_name`, `cc`, `bcc`, `metadata` with `type` (`autoresponder` | `workflow`), `email_design` (`default_template` | `cms_layout` | `visual_editor`), `design`.

The controller rewrites before saving:

- Create path: `modules/ins_forms/public/notifications/email_notifications/<type>_<form id>.liquid`.
- `default_template`: layout becomes `modules/insites_crm/insites_internal_email_layout` (workflow) or `insites_external_email_layout` (autoresponder); content becomes an include of `email_notifications/workflow_content` or `autoresponder_content`. `cms_layout`: a workflow is forced onto the internal layout. `visual_editor`: layout null.
- Workflow `from` becomes an include of `modules/insites_crm/email_layout/form_notification_from` with only the From Name (`functions/notifications/sender_fields`) when the installed CRM is 6.1.2 or later (`functions/notifications/core_sender_ready`). An autoresponder keeps the typed `from`. `metadata.from_name` is always written.
- `trigger_condition == "true"` picks the strict mutation (subject, to, from, content required); anything else the draft mutation.

Returns `{ id, trigger_condition, subject, to, reply_to, from, cc, bcc, physical_file_path, content, metadata }`.

**`POST /insites/forms/email-notifications/test-email`** (`controllers/forms/email_notifications/send_test_email.liquid`). Payload: `design` (selects `test_email_default_template`, `test_email_cms_layout` or `test_email_visual_editor`), `type` (`Workflow` | `Autoresponder`), `to`, `subject`, `from_name`, `from_email`, `reply_to`, `content`, `layout`, `fields`, `database_id`, `data`.

| Status | When | Body |
|---|---|---|
| 409 | CRM below 6.1.2 | `errors.insites_crm`, `insites_crm.installed_version`, `required_version` |
| 422 | CRM's `email_sender/customer_sender` says not sendable, or the From renders blank | `errors.email_sender`, `email_sender.mode`, `validation_status`, `uses_own_sendgrid` |
| 200 | `email_send` accepted it | `items.is_scheduled_to_send` |

A workflow test renders the same `form_notification_from` include the live notification stores. Reply-To falls back to CMS global `company_email_1`.

**`GET .../autoresponder` and `.../workflow`**. HTML previews; the workflow one takes `fields` (JSON `{ name: label }`) and `database_id`.

## Attachments and uploads

Both public presigns cap at `max_kib = 10240` (10 MiB) and allow `pdf doc docx xls xlsx csv txt png jpg jpeg gif webp` (`functions/attachments/allowed_upload.liquid`). Content-Type is pinned to the extension's canonical type; a declared type the extension cannot produce is refused; no `filename` means an older client and pins `application/octet-stream`. Refusals are `422` with `{ "errors": { "file": "<reason>" }, "max_kib": 10240 }`.

**`GET /insites/forms/attachments/credentials`** (public). Params `filename`, `content_type`. Presigns `modules/insites_crm/attachment.file`. Returns `{ "file": { "s3_upload": { "direct_upload_url", "form_data" } } }`.

**`POST /insites/forms/attachments`** (public). `payload.file` = the uploaded object's URL; the extension is re-checked from its last path segment, then CRM's `_globals/add_attachment` writes the record.

**`DELETE /insites/forms/attachments`** (admin). Passes `context.params` to CRM's `_globals/delete_attachments`; body in [`../crm/globals/attachments.md`](../crm/globals/attachments.md).

**`GET /insites/forms/presigner`** (public). Params `model`, `property`, `filename`, `content_type`. Allowed only when `model` is the `resource` of one of the first 200 `admin_forms` and `property` is a field of it whose `field_type` is blank or in `upload file photo image attachment` (`functions/attachments/presigner_target`). Returns `{ "s3_upload": { "direct_upload_url", "form_data" } }`. Every refusal, platform errors included, carries the fixed reason `upload is not available for this field`.

**`GET /insites/forms/viewer?form=<name>`** (public). A full HTML document: the v2.15.1 component bundle, the `form_code` partial, `{% include_form %}` of the named form with `<form>` swapped for `<div>` and reCAPTCHA removed, then `InsitesFormProcessor.formPreview(...)`.
