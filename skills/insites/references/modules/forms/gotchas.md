# Forms — Gotchas

Edges visible in module-v6-forms v6.0.3 source on 9 October 2026. Each entry: what bites, why, how to avoid.

## 1. Nothing to `{% function %}`

**Bites:** `forms/controller/forms/list` fails with partial not found. **Why:** no controller aliases ([`alias-inventory.md`](../../building-on-insites/reference/alias-inventory.md)). **Avoid:** use HTTP, or include the partials in [`advanced.md`](advanced.md) by path.

## 2. The instance API key opens nothing

**Bites:** `Authorization: instance_...` against `/insites/forms` runs as an anonymous visitor and the admin policy refuses it. **Why:** no page calls the CRM API-key guard; the 16 admin pages check the session. **Avoid:** a signed-in administrator session with `X-CSRF-Token`, as the SPA does.

## 3. The presigner serves only forms the admin created

**Bites:** a hand-written form file gets `422 upload is not available for this field`. **Why:** `functions/attachments/presigner_target` allows a `model`/`property` pair only when `admin_forms` lists a form with that `resource` and field; `get_forms_for_presigner.graphql` notes module-shipped forms are not listed, and it reads at most 200 forms. **Avoid:** build the form in IIA, or presign from your own page.

## 4. Refusals are always the same text

**Bites:** debugging a presign from the response. **Why:** every refusal, platform errors included, answers one generic reason so the platform's "did you mean" table list never leaks; a platform refusal logs `Insites Forms - presigner refused by the platform`. **Avoid:** read the instance logs.

## 5. Twelve extensions, 10 MiB, type pinned by extension

**Bites:** `.zip`, `.svg`, `.heic` refused; a `.pdf` declared `image/png` refused; a 12 MB PDF refused by the bucket after a successful presign; yet a request with no `filename` is served. **Why:** `functions/attachments/allowed_upload` allowlists twelve extensions and pins Content-Type, the presign caps `content_length` at 10240 KiB, and bytes are never inspected (the comment says that lives outside this repo). No `filename` is treated as a client from before TW#26791366 and pinned to `application/octet-stream`. **Avoid:** check extension and size client-side and send `filename` plus the browser's `file.type`.

## 6. Generated form code presigns through the Data module

**Bites:** watching `/insites/forms/presigner` and seeing nothing. **Why:** `GenerateFormCode.js` writes `credentials-url="/insites/api/database/presigner-auto-upload.json?..."` (or `presigner-auto.json`) into the embed code, while the forms presigner's comment says the public script calls it with `model` and `property`. Which URL a live form hits depends on the uploader script on the CDN, not in this repo. **Avoid:** check the page's network tab.

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
