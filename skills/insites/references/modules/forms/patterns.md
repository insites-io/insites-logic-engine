# Forms — Patterns

Worked examples against [`api.md`](api.md). Admin calls carry the administrator's session cookie and `X-CSRF-Token`, left out below.

## 1. Find a form and read its definition

```http
GET /insites/forms?page=1&size=10&search=contact&field=Form%20Name HTTP/1.1
```

```json
{ "items": { "total_entries": 1, "results": [
  { "id": 41, "metadata": { "label": "Contact us" }, "resource": "modules/insites_databases/contact_us",
    "form_path": "contact_us", "file_path": "forms/contact_us", "last_updated": "2026-10-01T03:12:44Z" } ] } }
```

Then `GET /insites/forms/41` for `configuration`, `metadata.properties`, `liquid_body` and `email_notifications`.

## 2. Embed a published form

`GenerateFormCode.dependencies()` and `includeForm` in `vue/src/views/Forms/routes/ManageForm/sections/FormCode/` give two snippets. In `<head>`:

```liquid
{%- include 'modules/insites_forms/form_code' -%}
```

In the body, by the form's `name`:

```liquid
{%- include_form 'contact_us' -%}
```

The generated `liquid_body` opens with `form_localisation`, ends with `InsitesFormProcessor.initialize(...)` fed by `form_properties` and `form_redirect`, and posts to the platform's form endpoint. No page in this module receives the submission.

## 3. Preview without a page

```http
GET /insites/forms/viewer?form=contact_us HTTP/1.1
```

A standalone HTML document with submit disabled (the `<form>` becomes a `<div>`). Public.

## 4. Upload a file from a public form

```http
GET /insites/forms/presigner?model=modules/insites_databases/contact_us&property=brochure&filename=quote.pdf&content_type=application/pdf HTTP/1.1
```

```json
{ "s3_upload": { "direct_upload_url": "https://...", "form_data": { "Content-Type": "application/pdf", "...": "..." } } }
```

POST the file to `direct_upload_url` with every `form_data` key as a multipart field. The bucket refuses a body over 10 MiB or a different Content-Type (`graphql/attachments/presign_public_form_upload.graphql`). A `.exe`, a `.pdf` declared `image/png`, or a property no form owns gets:

```json
HTTP/1.1 422
{ "errors": { "file": "upload is not available for this field" }, "max_kib": 10240 }
```

For the attachment path (`file_multiple` fields): `GET /insites/forms/attachments/credentials?filename=quote.pdf`, upload, then `POST /insites/forms/attachments` with `{ "payload": { "file": "<object URL>" } }`.

## 5. Add a workflow notification and prove it sends

```http
POST /insites/forms/email-notifications HTTP/1.1
Content-Type: application/json

{ "payload": {
  "form_configuration_ids": [41], "form_name": "contact_us",
  "metadata": { "type": "workflow", "email_design": "default_template" },
  "trigger_condition": "true", "subject": "New enquiry",
  "to": "sales@example.com", "from_name": "Acme Ltd", "from": "Acme Ltd <hello@example.com>",
  "reply_to": "", "cc": "", "bcc": "", "content": "", "layout": "" } }
```

The stored `from` comes back as `{%- include 'modules/insites_crm/email_layout/form_notification_from', from_name: "Acme Ltd" -%}`, not the typed address. Then:

```http
POST /insites/forms/email-notifications/test-email HTTP/1.1

{ "payload": { "design": "default_template", "type": "Workflow", "to": "me@example.com",
  "subject": "New enquiry", "from_name": "Acme Ltd", "reply_to": "", "fields": "{\"email\":\"Email\"}", "database_id": 7 } }
```

`409`: the CRM module is older than 6.1.2. `422`: the instance has no sendable sender. Both bodies say which.

## 6. Read submissions

Submissions are rows of the form's `resource` table and this module has no read endpoint for them. Use the Data module ([`../data/api.md`](../data/api.md)): list databases, match `table_name` to the form's `resource`, list that database's items. The workflow email's button goes to `/admin/insites#/databases/<table_id>/items/<id>` (`email_notifications/workflow_content.liquid`).

## Not here

- Creating a database or its columns: Data module, IIA only.
- Posting a submission by hand: the target is the platform form definition, see [`../../forms/README.md`](../../forms/README.md).
- Webhooks: none.
