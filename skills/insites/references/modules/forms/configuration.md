# Forms — Configuration

Paths and tab names from `vue/src/router/FormsRoute.js`; the side menu from `private/views/partials/insites_menu/insites_forms_side_menu.liquid`.

## IIA paths

| What | Path |
|---|---|
| All forms (menu: Forms, All Forms) | `<your-insites-instance>/admin/insites#/forms` |
| Add a form | `<your-insites-instance>/admin/insites#/forms/add` |
| Edit a form | `<your-insites-instance>/admin/insites#/forms/:id` |

Add and Edit share six tabs: Details, Settings, Fields, Form Code, Security, Email Notifications. On Add, the last four stay disabled until a database is chosen (`ManageForm.vue`, `enableTabs`).

## What each tab writes

From `setPayload` in `vue/src/views/Forms/routes/ManageForm/ManageForm.vue`; keys are the `admin_form_create` variables.

| Tab | Writes |
|---|---|
| Details | `name` and `metadata.label`, `physical_file_path`, `resource` (a database from `GET /insites/forms/databases`), `redirect_to`, `spam_protection` (`{ recaptcha_v2: ... }` or `{ recaptcha_v3: { action } }`) |
| Settings | `callback_actions`, the four `async_callback_*` keys, `flash_notice` (success message), `flash_alert` (error message), button metadata (alignment, label, icon, colours) |
| Fields | `configuration.properties.<column>` with `validation` and `property_options.virtual` for a virtual field; `metadata.properties[]` (label, placeholder, tooltip, UI element, weighting, conditional visibility); `metadata.form_steps` |
| Form Code | `liquid_body`. "Generate Form Code" overwrites hand edits after a confirm |
| Security | `authorization_policy_ids`, from `GET /insites/forms/auth-policies` |
| Email Notifications | Saved separately via `POST`/`PUT /insites/forms/email-notifications`: one autoresponder and one workflow per form |

## Field types

Fields come from the chosen database's `properties[]`; the builder creates no columns. Types and UI elements live in the admin SPA (`vue/src/models/fieldTypes.js`, `uiElements.js`), not in the module's Liquid. Sixteen types on 9 October 2026:

| Type | UI elements (default first) |
|---|---|
| `string` | `input`, `code`, `color`, `card_select`, `html`, `markdown`, `multi_line`, `link`, `select`, `radio`, `phone` |
| `array` | `input_multiple`, `card_select_multiple`, `checkbox`, `select_multiple`, `file_multiple`, `table` |
| `integer` | `number`, `stepper` |
| `float`, `decimal` | `decimal`, `stepper` |
| `boolean` | `toggle` |
| `date`, `datetime`, `time` | `date`, `date_time`, `time` |
| `datasource`, `datasource_array` | `select_data_source`, `select_data_source_multiple` |
| `geojson` | `code` |
| `upload` ("Media") | `media_file`, `media_image` |
| `file`, `photo`, `text` | Marked deprecated |

Validation rules (`vue/src/models/validationRules.js`): `presence`, `email`, `date`, `datetime`, `format` (regular expression), `length`, `numericality`, `unique`, each limited to the types the file lists.

## Email designs

`metadata.email_design` is `default_template` (module content on a CRM layout), `cms_layout` (a layout from `GET /insites/forms/email-layouts`) or `visual_editor` (stored HTML, no layout). A notification is live only when `trigger_condition` is the string `"true"`; the SPA sends `null` when the toggle is off, which stores a draft.

## Seeds and migrations

Nothing is seeded. One migration, `private/migrations/20260929220000_form_notifications_platform_sender.liquid`, rewrites the stored `from` of every workflow notification (prefix `modules/ins_forms/public/notifications/email_notifications/workflow_`) to the `form_notification_from` include and keeps the typed name in `metadata.from_name`. It skips already-migrated rows and autoresponders, passes `trigger_condition` and `delay_by` back so drafts stay drafts, and only logs an error when the CRM is below 6.1.2.

## Tests

Three function tests under `private/lib/test/` (`attachments/presigner_target_test`, `databases/drop_archived_test`, `notifications/sender_fields_test`) run with `insites-cli test run`; see [`../../testing/README.md`](../../testing/README.md).

## Out of scope

Module install and updates go through the Insites console. There is no setting beyond what the tabs write.
