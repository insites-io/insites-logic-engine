# Forms Module

The Insites Forms module (machine name `insites_forms`, repo `module-v6-forms`, git tag v6.0.3) is the admin form builder. An administrator picks a user database as the target table, lays out fields from its columns, generates the embed code, and attaches two emails: an autoresponder to the submitter and a site-owner ("workflow") notification. The module owns no tables: a form is a platform form definition written by `admin_form_create` (`private/graphql/forms/add_form.graphql`), a submission is a row in the chosen database, an uploaded file is a CRM attachment.

HTML forms, CSRF and form definitions with `callback_actions` are covered in [`../../forms/README.md`](../../forms/README.md) and not repeated here.

## Where to look

| If you're… | Read |
|---|---|
| Calling the admin endpoints | [`api.md`](api.md) |
| Setting a form up in IIA; field types, validation rules, the migration | [`configuration.md`](configuration.md) |
| Embedding a form, uploading from a public page, reading submissions | [`patterns.md`](patterns.md) |
| Hitting an edge | [`gotchas.md`](gotchas.md) |
| Rendering the module's partials or hooks from your own code | [`advanced.md`](advanced.md) |

## No controller aliases

Forms declares **no** controller aliases, so there is nothing to `{% function %}` ([`alias-inventory.md`](../../building-on-insites/reference/alias-inventory.md), "Modules that declare no controller aliases"). Every page includes a private controller partial by file path. Reach the module over HTTP, or render the partials listed in [`advanced.md`](advanced.md).

## Surface at a glance

Counted in module-v6-forms v6.0.3 on 9 October 2026: 20 page files under `private/views/pages/api/forms/`, all under `/insites/forms`. 16 carry `modules/insites_crm/insites_only_allowed_by_administrators`; 4 carry no policy and say "public on purpose" in their front matter.

| Resource | Operations | Access |
|---|---|---|
| **Forms** | List, read one, create, update, delete | Admin |
| **Lookups** | Databases, authorization policies, email layouts, environment flag, my profile | Admin |
| **Email notifications** | Create, update, send a test, two previews | Admin |
| **Attachments** | Credentials, register, delete | Credentials and register public; delete admin |
| **Presigner** | Credentials for a file field of a published form | Public |
| **Viewer** | Renders a published form as a page | Public |

## Layout map

```
modules/forms/
├── README.md            ← you are here
├── api.md               ← the 20 endpoints
├── configuration.md     ← IIA walkthrough, field types, migration
├── patterns.md          ← worked examples
├── gotchas.md           ← edges visible in source
└── advanced.md          ← hooks, partials, cross-module dependencies
```

## Auth, in one sentence

Admin endpoints take the signed-in administrator's session plus an `X-CSRF-Token` header (the SPA reads the `csrf-token` meta tag in `vue/src/services/CoreServices.js`); the instance API key opens nothing here, because no page calls the CRM API-key guard.

## Webhooks, in one sentence

**Forms fires no webhooks** (no `send_webhook` in source); what fires on submit is the per-form email notification created through `admin_email_notification_create`.

## What the module stores, and where

No `schema/` directory, and no migration creates a table.

| Data | Where | Source |
|---|---|---|
| Form definition | Platform form at the admin-typed `physical_file_path`; `resource_owner` always `anyone` | `graphql/forms/add_form.graphql` |
| Submissions | Rows of the form's `resource` table | `email_notifications/workflow_content.liquid` links `/admin/insites#/databases/<table_id>/items/<id>` |
| Email notifications | `modules/ins_forms/public/notifications/email_notifications/<type>_<form_id>.liquid` | `controllers/forms/email_notifications/add_email_notification.liquid` |
| Uploads | `modules/insites_crm/attachment`, tagged `module_source: "Insites Databases"` | `pages/api/forms/attachments/post.liquid` |
| Date and time format | Read from `modules/insites_crm/localisation` | `graphql/forms/get_localisation.graphql` |

## Module detection

`modules/insites_forms/lib/hooks/hook_module_info` returns `name: "Insites Forms"`, `machine_name: "insites_forms"`, `type: "module"`, `version: "6.0.3"`. The version matches the git tag in this release.
