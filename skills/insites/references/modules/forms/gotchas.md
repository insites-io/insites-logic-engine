# Forms — Gotchas

Edges visible in module-v6-forms v6.0.3 source on 9 October 2026; item 5 re-read at module-v6-forms v6.1.1 with module-v6-crm v6.1.4 on 20 October 2026; item 6 re-read on 21 October 2026. Each entry: what bites, why, how to avoid.

## 1. Nothing to `{% function %}`

**Bites:** `forms/controller/forms/list` fails with partial not found. **Why:** no controller aliases ([`alias-inventory.md`](../../building-on-insites/reference/alias-inventory.md)). **Avoid:** use HTTP, or include the partials in [`advanced.md`](advanced.md) by path.

## 2. The instance API key opens nothing

**Bites:** `Authorization: instance_...` against `/insites/forms` runs as an anonymous visitor and the admin policy refuses it. **Why:** no page calls the CRM API-key guard; the 16 admin pages check the session. **Avoid:** a signed-in administrator session with `X-CSRF-Token`, as the SPA does.

## 3. The presigner serves only forms the admin created

**Bites:** a hand-written form file gets `422 upload is not available for this field`. **Why:** `functions/attachments/presigner_target` allows a `model`/`property` pair only when `admin_forms` lists a form with that `resource` and field; `get_forms_for_presigner.graphql` notes module-shipped forms are not listed, and it reads at most 200 forms. **Avoid:** build the form in IIA, or presign from your own page.

## 4. Refusals are always the same text

**Bites:** debugging a presign from the response. **Why:** every refusal, platform errors included, answers one generic reason so the platform's "did you mean" table list never leaks; a platform refusal logs `Insites Forms - presigner refused by the platform`. **Avoid:** read the instance logs.

## 5. Uploads follow the instance's upload settings, not a fixed list

**Bites:** a `.heic` photo is accepted, then served as `application/octet-stream`, so it downloads instead of displaying; an administrator adds `pdf` to the denylist at `<your-insites-instance>/admin/insites#/assets/configuration` and public forms refuse PDFs too; in allowlist mode everything unlisted is refused, including a file with no extension; a `.jpg` declared `application/octet-stream`, or a `.csv` declared `text/plain`, is refused; a 12 MB PDF is refused by the bucket after a successful presign; a request with no `filename` is still served. **Why:** since v6.1.0, `functions/attachments/allowed_upload` checks whether the CRM is 6.1.1 or later. If it is, the CRM's `functions/validate_upload` decides, reading the instance's one `modules/insites_crm/upload_restrictions` record (`mode`, `extensions`, `max_file_size_mb`), the record the Assets Configuration screen edits. `mode` defaults to `denylist`, and CRM 6.1.1 seeds a denylist of 19 script and executable types (`php phtml phar exe dll msi com scr bat cmd sh ps1 vbs jar js mjs html htm svg`) with no size limit, so any other extension, `.heic` included, is allowed. When the CRM's check passes, the Forms module's own refusal is dropped; when it fails, its reason is returned. The CRM's check compares the declared type exactly against its own type table, which does not exempt `application/octet-stream` and lists only `text/csv` and `application/vnd.ms-excel` for `.csv`. The built-in list of twelve (`pdf doc docx xls xlsx csv txt png jpg jpeg gif webp`) applies only when the CRM is older than 6.1.1; on 6.1.1 or later with the record deleted, the empty denylist refuses no extension. `functions/attachments/upload_rules` still pins Content-Type from its own type table, and `.heic` and `.heif` are in neither module's table, so an allowed `.heic` is pinned to `application/octet-stream`. The presign caps `content_length` at 10240 KiB, or at `max_file_size_mb` x 1024 KiB when that is smaller. Bytes are never inspected (the comment says that lives outside this repo). No `filename` is treated as a client from before TW#26791366: it skips the extension check and the settings size limit and is pinned to `application/octet-stream`, unless the constant `insites_forms_require_filename` is `"true"`, which refuses it. **Avoid:** read the instance's upload settings to know what a form accepts; send `filename` and the browser's `file.type`, or no type at all, never `application/octet-stream`; check size client-side against the smaller limit; convert HEIC to JPEG in the browser when the file must display.

## 6. Generated form code uploads through the Forms endpoints

**Bites:** reading `GenerateFormCode.js`, finding `credentials-url="/insites/api/database/presigner-auto-upload.json?..."` (or `presigner-auto.json`), and concluding that generated forms skip the upload checks; no v6 module serves either URL, so both answer `404`. **Why:** the generator writes that URL only for a field with `auto_upload: true` (`generateFileAutoUploader`), and nothing sets that flag: both writers in `ManageForm.vue` are commented out, as they were in v5. Generated embed code loads `InsitesFormProcessor.js` from `components.insites.io/forms/` through the `form_code` partial, and that script, whose own auto-upload code is also commented out, sends a single-file field to `GET /insites/forms/presigner?model=<resource>&property=<field>` and a `file_multiple` field to `GET /insites/forms/attachments/credentials` then `POST /insites/forms/attachments`. All three run `functions/attachments/allowed_upload` (item 5). A field given `auto-upload` with that URL by hand never uploads: `<ins-input-file>` waits on the credentials request, which resolves only on a `200`. **Avoid:** watch those three endpoints in the network tab when debugging a form upload; never add `auto-upload` to a generated field by hand.

## 7. A workflow notification never stores the typed From address

**Bites:** `PUT` `from: "Acme <hello@acme.com>"` and read back an include. **Why:** `functions/notifications/sender_fields` stores `modules/insites_crm/email_layout/form_notification_from` so the address is chosen at send time; the production stack refuses other senders with a 550 while reporting the mail scheduled (comment in the function, measured 29 September 2026). Autoresponders keep the typed From. **Avoid:** read `metadata.from_name`; never parse `from`.

## 8. CRM 6.1.2 is a runtime requirement

**Bites:** sender rewrite, migration and test email all stop on an older CRM. **Why:** `functions/notifications/core_sender_ready` reads CRM's `hook_module_info`; the stored include does not exist earlier. Below it, notifications keep the typed From, the migration only logs an error, the test email answers `409`. **Avoid:** update the CRM first, then re-save each workflow notification.

## 9. `trigger_condition` is the string `"true"` or it is a draft

**Bites:** boolean `true` or `"True"` creates a draft that never fires. **Why:** both controllers compare `== "true"`. **Avoid:** send the exact string.

## 10. Delete needs the matching path

**Bites:** `DELETE /insites/forms` with only `payload.id` deletes nothing. **Why:** `controllers/forms/delete.liquid` requires `payload.physical_file_path` equal to the stored path. **Avoid:** read the form first, send both.

## 11. Two path prefixes say `ins_forms`

**Bites:** searching notifications under `modules/insites_forms/`. **Why:** they are stored at `modules/ins_forms/public/notifications/email_notifications/<type>_<id>.liquid`; `functions/notifications/email/generate_physical_file_path` builds `modules/ins_forms/public/emails/forms/` and nothing calls it. **Avoid:** filter on `ins_forms`.

## 12. The database list is filtered in Liquid

**Bites:** adding an `is_archived` exclude to `get_databases.graphql` returns nothing on the dedicated stack. **Why:** an attribute exclude also drops tables that lack the key, and dedicated-stack tables carry none (TW#26813287, `functions/databases/drop_archived`). **Avoid:** reuse the function.
