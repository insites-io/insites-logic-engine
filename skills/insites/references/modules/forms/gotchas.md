# Forms — Gotchas

Edges visible in module-v6-forms v6.0.3 source on 9 October 2026. Each entry: what bites, why, how to avoid.

## 1. Nothing to `{% function %}`

**Bites:** `forms/controller/forms/list` fails with partial not found. **Why:** no controller aliases ([`alias-inventory.md`](../../building-on-insites/reference/alias-inventory.md)). **Avoid:** use HTTP, or include the partials in [`advanced.md`](advanced.md) by path.

## 2. The instance API key opens nothing

**Bites:** `Authorization: instance_...` against `/insites/forms` runs as an anonymous visitor and the admin policy refuses it. **Why:** no page calls the CRM API-key guard; the 17 admin pages (v6.1.1) check the session. **Avoid:** a signed-in administrator session with `X-CSRF-Token`, as the SPA does.

## 3. The presigner serves only forms the admin created

**Bites:** a hand-written form file gets `422 upload is not available for this field`. **Why:** `functions/attachments/presigner_target` allows a `model`/`property` pair only when `admin_forms` lists a form with that `resource` and field; `get_forms_for_presigner.graphql` notes module-shipped forms are not listed, and it reads at most 200 forms. **Avoid:** build the form in IIA, or presign from your own page.

## 4. Field refusals are generic; file refusals say why

**Bites:** debugging a presign from the response, and getting `upload is not available for this field` with no detail. **Why:** at v6.1.1, `controllers/attachments/presign_public_form_upload` answers that one generic reason when the `model`/`property` pair is not a form's upload field and when the platform refuses the presign, so the platform's "did you mean" table list never leaks; a platform refusal logs `Insites Forms - presigner refused by the platform`. A refusal of the file itself returns its specific reason from `functions/attachments/allowed_upload` (line 49 assigns `verdict.reason`), for example `file type .exe is not allowed`, `declared content type image/png does not match .pdf` or `filename is required`, in `{ "errors": { "file": "<reason>" }, "max_kib": <cap> }` with status `422`. **Avoid:** read `errors.file` first; for the generic reason, check the form's `resource` and field, then read the instance logs.

## 5. Twelve extensions, 10 MiB, type pinned by extension

**Bites:** `.zip`, `.svg`, `.heic` refused; a `.pdf` declared `image/png` refused; a 12 MB PDF refused by the bucket after a successful presign; yet a request with no `filename` is served. **Why:** `functions/attachments/allowed_upload` allowlists twelve extensions and pins Content-Type, the presign caps `content_length` at 10240 KiB, and bytes are never inspected (the comment says that lives outside this repo). No `filename` is treated as a client from before TW#26791366 and pinned to `application/octet-stream`. **Avoid:** check extension and size client-side and send `filename` plus the browser's `file.type`.

## 6. Generated form code presigns through the Data module

**Bites:** watching `/insites/forms/presigner` and seeing nothing. **Why:** `GenerateFormCode.js` writes `credentials-url="/insites/api/database/presigner-auto-upload.json?..."` (or `presigner-auto.json`) into the embed code, while the forms presigner's comment says the public script calls it with `model` and `property`. Which URL a live form hits depends on the uploader script on the CDN, not in this repo. **Avoid:** check the page's network tab.

## 7. A notification never stores the typed From address

**Bites:** `PUT` `from: "Acme <hello@acme.com>"` and read back an include, on a workflow notification or an autoresponder. **Why:** `functions/notifications/sender_fields` stores an include of `modules/insites_crm/email_layout/form_notification_from` so the address is chosen at send time; the production stack refuses other senders with a 550 while reporting the mail scheduled (comment in the function, measured 29 September 2026). Workflow notifications have done this since TW#26813291; autoresponders store the same include since v6.1.0. Since v6.1.1 the include also carries the Sender chosen in the Form Builder (`metadata.sender_address`), and `form_notification_from` honours it only on Insites CRM 6.1.4 or later and only when it is on the instance's Console sender list; otherwise it sends from the list's default. **Avoid:** read `metadata.from_name` and `metadata.sender_address`; never parse `from`.

## 8. CRM 6.1.2 is a runtime requirement

**Bites:** sender rewrite, migration and test email all stop on an older CRM. **Why:** `functions/notifications/core_sender_ready` reads CRM's `hook_module_info`; the stored include does not exist earlier. Below it, notifications keep the typed From, the migration only logs an error, the test email answers `409`. **Avoid:** update the CRM first, then re-save each workflow notification.

## 9. `trigger_condition` is the string `"true"` or it is a draft

**Bites:** boolean `true` or `"True"` creates a draft that never fires. And an autoresponder sent with `trigger_condition: "true"` on a form with no spam protection is saved with `trigger_condition` `"false"` and `metadata.held_for_spam_protection: true`, so it never sends, unless its chosen Sender is on the instance's Console sender list and not at `insites.site`. **Why:** both controllers compare `== "true"`. For an autoresponder, `controllers/forms/email_notifications/add_email_notification.liquid` lines 30 to 43 (and the edit controller) ask `functions/notifications/autoresponder_allowed`: with reCAPTCHA on it may send from any listed sender; with it off, only from a listed sender at a verified customer domain, read through Insites CRM 6.1.4 (`functions/notifications/listed_senders`). On an older CRM the list counts as absent and the autoresponder stays held. **Avoid:** send the exact string; read `trigger_condition` and `metadata.held_for_spam_protection` back after saving an autoresponder; turn on spam protection or choose a customer-domain sender.

## 10. Delete needs the matching path

**Bites:** `DELETE /insites/forms` with only `payload.id` deletes nothing. **Why:** `controllers/forms/delete.liquid` requires `payload.physical_file_path` equal to the stored path. **Avoid:** read the form first, send both.

## 11. Two path prefixes say `ins_forms`

**Bites:** searching notifications under `modules/insites_forms/`. **Why:** they are stored at `modules/ins_forms/public/notifications/email_notifications/<type>_<id>.liquid`; `functions/notifications/email/generate_physical_file_path` builds `modules/ins_forms/public/emails/forms/` and nothing calls it. **Avoid:** filter on `ins_forms`.

## 12. The database list is filtered in Liquid

**Bites:** adding an `is_archived` exclude to `get_databases.graphql` returns nothing on the dedicated stack. **Why:** an attribute exclude also drops tables that lack the key, and dedicated-stack tables carry none (TW#26813287, `functions/databases/drop_archived`). **Avoid:** reuse the function.
