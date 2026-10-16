# Rules — Forms

Rules that apply to files under `app/forms/` (or module-equivalent paths) and to HTML forms in pages/partials.

---

```yaml
---
id: forms-no-form-tag
applies_to: [form]
severity: error
evidence: real-project
evidence_source: "A convention, not a deprecation: the insites-cli 6.1.0 tag reference marks {% form %} current and the v6 CRM module uses it once. The reference repos use it 27 times (master, 13 October 2026): app-seedling 8, app-portal 11, addon-ecommerce 7, addon-events 1. 25 are in form definitions, 1 in a page (app-seedling api/users/id) and 1 in a partial (addon-ecommerce write_a_review_form). An earlier count of 4 matched only {% form and missed {%- form."
audit_ref: audit/v0-conflicts-batch1.md#rule-r-5
preship_action: "The reference repos do not follow this convention yet (27 uses in four repos). Do not cite them as compliant until they are changed."
---
```

**Rule:** Do NOT use the `{% form ... %}` Liquid tag in pages and partials. All forms MUST use plain HTML `<form>` tags with `{% render 'modules/insites_crm/authenticity_token' %}` (or equivalent CSRF mechanism) for POST, PUT, and DELETE operations.

**Why:** Plain HTML forms give full control over markup and integrate cleanly with modern JS, validation libraries, and accessibility tools. This is a convention. The tag itself is **not** deprecated: the tag reference shipped with insites-cli 6.1.0 marks `form` current, the CLI audit flags `form_tag` and not `form`, and the v6 CRM module uses `{% form method: 'delete' %}` in `private/forms/sessions/lock_admin.liquid`. Earlier versions of this rule called it deprecated.

**How to apply:**

✅ **Correct:**
```liquid
<form action="/account/update" method="post">
  {% render 'modules/insites_crm/authenticity_token', context: context %}
  <input type="text" name="user[email]" required>
  <button type="submit">Save</button>
</form>
```

❌ **Against the convention:**
```liquid
{% form method: 'post' %}
  <input type="text" name="user[email]">
{% endform %}
```

**Verified by:**
- Compliant: `app-seedling/modules/dashboard/public/views/pages/account/verify_2fa.liquid:38-39`
- Not following it, counted on each repo's master on 13 October 2026 (27 uses; the earlier list of 4 missed every `{%- form`):

| Repo | Uses | Where |
|---|---|---|
| `app-seedling` (1d76aab) | 8 | 7 form definitions under `modules/dashboard/public/forms/account/` (`my_details`, `password_reset`, `register`, `sign_out`, `sign_in`, `change_password`, `forgot_password`) and 1 page, `views/pages/api/users/id.liquid:48` |
| `app-portal` (2e2032a) | 11 | 11 form definitions (9 under `modules/portal/public/forms/`, 2 under `modules/ins_forms/public/forms/`) |
| `addon-ecommerce` (1f3969e) | 7 | 6 checkout form definitions and 1 partial, `views/partials/forms/review/write_a_review_form.liquid:7` |
| `addon-events` (4f46a83) | 1 | 1 form definition, `forms/create_password.liquid:22` |

---

```yaml
---
id: csrf-token-required
applies_to: [form, page]
severity: warning
evidence: real-project
evidence_source: "All POST forms found include authenticity_token. Global meta-tag pattern covers other cases."
audit_ref: audit/v0-conflicts-batch1.md#rule-r-6
---
```

**Rule:** All POST, PUT, and DELETE forms MUST include `{% render 'modules/insites_crm/authenticity_token' %}` (or equivalent), OR rely on the global CSRF meta-tag pattern in the layout.

GET forms do NOT require CSRF tokens — by definition GET should not change state, so CSRF protection isn't applicable.

**Why:** Cross-Site Request Forgery (CSRF) attacks trick a logged-in user's browser into submitting state-changing requests. The token ties each request to the user's session, so attackers can't forge submissions from external sites.

**How to apply:**
```liquid
<form action="/account/update" method="post">
  {% render 'modules/insites_crm/authenticity_token', context: context %}
  <!-- form fields -->
</form>
```

Or rely on the global meta tag pattern in the layout:
```liquid
{% comment %} In layout head: {% endcomment %}
<meta name="csrf-token" content="{{ context.authenticity_token }}">
```

**Verified by:**
- Render-based: `app-seedling/modules/dashboard/public/views/pages/account/verify_2fa.liquid:38-39`
- Meta-tag based: `app-portal/modules/website/public/views/partials/layout/head.liquid` (global)

---

```yaml
---
id: forms-enquiry-to-sales-pipeline
applies_to: [form, page]
severity: info
evidence: skill-only
evidence_source: "Insites product decision by the Product Owner, 17 October 2026: strongly recommended, never built unasked. No reference app sends enquiries to Pipelines; app-portal's contact_us form (29a2772) creates a CRM contact from its callback but no opportunity. Endpoints, fields and seed values read from module-v6-pipelines v6.0.2 (81df2fd) and module-v6-crm v6.1.4 (a9a8bb9) on 17 October 2026. The worked example has not yet been run on an instance; the checks still to run are listed under Verified by."
related: [csrf-token-required, pipe-vars-through-json-filter, render-vs-function-tags]
---
```

**Rule (strongly recommended, ask first):** When you build an **enquiry form**, a form where someone asks to buy or book (a contact form, a quote request, a booking request), recommend that every submission also goes into the site's sales pipeline. Say why in one line, ask, and build it only if the user says yes. Never build it unasked.

This rule does not apply to newsletter, support or job application forms.

What to say, in one line:

> I strongly recommend sending each enquiry to your sales pipeline too, so every enquiry shows up there and you can follow it up. Shall I set that up?

**Why:** An enquiry that only lands in a database table and a staff inbox is easy to lose. In the pipeline it has a stage, a status and a contact, so someone can see it, follow it up and close it. The severity is `info`: an agent that does not offer it gets no warning and nothing fails. The recommendation is still strong, so make it every time the trigger applies.

**How to apply:**

1. **Ask first.** Use the line above. If the user says no, stop. The form works without it.

2. **Use the pipeline the site already has.** List pipelines with `GET /pipeline/api/v2/pipelines`. If the site has an active sales pipeline, offer to send enquiries into it rather than creating a second one, and ask which one if there are several. The first stage is the one with the lowest `stage_weighting` in the `stages` array of `GET /pipeline/api/v2/pipelines/:uuid`. There is no read-one stage endpoint.

3. **Otherwise create a simple pipeline.** `POST /pipeline/api/v2/pipelines` with `name` and `status` (for example `{"name": "Website Enquiries", "status": "active"}`), then three stages with `POST /pipeline/api/v2/pipelines/stages/:pipeline_uuid`: `New` (`stage_weighting` 1), `Contacted` (2), `Quoted` (3). The nested `/pipelines/:uuid/stages` spelling is a deliberate 404.

   **Won and lost are not stages.** Every opportunity already has a `status` of `open`, `won` or `lost` (`schema/opportunity.yml`; create defaults to `open` and answers 422 for anything else). Closing a deal is a `PATCH` of `status`, with `won_reason.uuid` or `lost_reason.uuid`, and the IIA reports split opportunities by status. A Won or Lost stage repeats the status, and the two can disagree.

4. **Find the "Website" lead source in Pipelines, not in the CRM.** An opportunity's `lead_source.uuid` points at Pipelines' own system-field table (`pipeline_system_field`). The CRM's `lead_source` system field, which a contact uses, is a different table, and its uuids do not resolve on an opportunity. Search with `GET /pipeline/api/v2/system-fields?search_by=value&keyword=Website&size=50`. The keyword is a contains match, so keep the row whose `system_field` is `lead_source` and whose `value` is exactly `Website`. Pipelines seeds `Website` as one of ten lead sources on a fresh instance (`migrations/20240614102840_seed_pipeline_system_fields.liquid`), but an instance upgraded from the older table keeps its own list. If there is no such row, create it once with `POST /pipeline/api/v2/system-fields` and `{"system_field": "lead_source", "value": "Website"}`.

5. **Keep the three uuids as constants**, for example `ENQUIRY_PIPELINE_UUID`, `ENQUIRY_STAGE_UUID` and `ENQUIRY_LEAD_SOURCE_UUID`, so a submission does not look them up again. They are settings, not secrets.

6. **On each submission, add these steps on top of what the form already does.** The form's own database row and its staff notification email stay exactly as they are; nothing here replaces them.

   1. **Find or create the CRM contact by email.** `crm/controller/contacts/list` with `search_by: "email"`, the email as `keyword`, and `exact: "true"`. `exact` switches the filter from contains to equality, which is case-sensitive, so lowercase the email first. If nothing comes back, create the contact with `crm/controller/contacts/create`; `email` is its only required field.
   2. **Create the opportunity** with `pipeline/controller/opportunities/create`: `name` as `<Person name> - <Form name>`, `pipeline.uuid`, `stage.uuid` (the first stage), `contact.uuid`, `lead_source.uuid` (Website), and `status: "open"`. Leave `value` out; a blank value is not the same as 0.
   3. **Put the message on the opportunity as an activity.** An opportunity has no notes or description field (`schema/opportunity.yml`). Create a CRM activity with `crm/controller/activities/create`: `type: "file_note"`, a `subject`, the message in `notes`, `feature_type: "opportunity"` and `feature.uuid` set to the new opportunity's uuid.
   4. **Never let these steps fail the submission.** The visitor's enquiry is already saved. Log a failure and carry on.

7. **Where the steps run.** A form built in the Insites form builder has no page of its own; put the call in the form's `async_callback_actions`, which runs in a background job after the submission is saved (Settings tab). A form you code yourself posts to a `method: post` page; make the call after the page has saved the row.

The worked example is one partial that does step 6, called with `{% function %}` because it returns a value. Every value goes into an `assign` hash literal, so nothing is interpolated into JSON.

✅ **Correct:** `app/views/partials/enquiries/send_to_pipeline.liquid`
```liquid
{%- comment -%}
  Sends one enquiry to the sales pipeline. Call with function.
  Takes email, first_name, last_name, message, form_name.
  Returns { "valid": true or false, "errors": {}, "opportunity_uuid": uuid }.
  The pipeline, first stage and Website lead source come from constants set up once.
{%- endcomment -%}
{%- assign email = email | strip | downcase -%}
{%- assign person_name = first_name | append: " " | append: last_name | strip | default: email -%}
{%- assign result = { "valid": false, "errors": {}, "opportunity_uuid": "" } -%}

{%- assign query = { "search_by": "email", "keyword": email, "exact": "true", "size": 1 } -%}
{%- comment -%}insites-check-disable-next-line MissingPartial{%- endcomment -%}
{%- function found = "crm/controller/contacts/list", params: query -%}
{%- assign contact_uuid = found.results.first.uuid -%}

{%- if contact_uuid == blank -%}
  {%- assign contact_params = { "email": email, "first_name": first_name, "last_name": last_name } -%}
  {%- comment -%}insites-check-disable-next-line MissingPartial{%- endcomment -%}
  {%- function contact = "crm/controller/contacts/create", params: contact_params -%}
  {%- assign contact_uuid = contact.uuid -%}
{%- endif -%}

{%- if contact_uuid == blank -%}
  {%- assign result = { "valid": false, "errors": { "contact": "The contact could not be found or created." }, "opportunity_uuid": "" } -%}
{%- else -%}
  {%- assign opportunity_name = person_name | append: " - " | append: form_name -%}
  {%- assign opportunity_params = { "name": opportunity_name, "status": "open", "pipeline.uuid": context.constants.ENQUIRY_PIPELINE_UUID, "stage.uuid": context.constants.ENQUIRY_STAGE_UUID, "lead_source.uuid": context.constants.ENQUIRY_LEAD_SOURCE_UUID, "contact.uuid": contact_uuid } -%}
  {%- comment -%}insites-check-disable-next-line MissingPartial{%- endcomment -%}
  {%- function opportunity = "pipeline/controller/opportunities/create", params: opportunity_params -%}

  {%- if opportunity.code or opportunity.uuid == blank -%}
    {%- assign result = { "valid": false, "errors": { "opportunity": opportunity.message }, "opportunity_uuid": "" } -%}
  {%- else -%}
    {%- assign subject = "Website enquiry: " | append: form_name -%}
    {%- assign activity_params = { "type": "file_note", "subject": subject, "notes": message, "feature_type": "opportunity", "feature.uuid": opportunity.uuid } -%}
    {%- comment -%}insites-check-disable-next-line MissingPartial{%- endcomment -%}
    {%- function note = "crm/controller/activities/create", params: activity_params -%}
    {%- assign result = { "valid": true, "errors": {}, "opportunity_uuid": opportunity.uuid } -%}
    {%- if note.error or note.errors -%}
      {%- assign result = { "valid": true, "errors": { "activity": "The opportunity was created but the message was not attached." }, "opportunity_uuid": opportunity.uuid } -%}
    {%- endif -%}
  {%- endif -%}
{%- endif -%}

{%- return result -%}
```

Pipelines controllers return an error object carrying `code`; CRM controllers return `error` or `errors`. Each is tested the way its module documents. The `MissingPartial` lines are there because `insites-cli check` cannot see installed modules and reports a controller alias as missing.

A form you code yourself: a plain `<form>` with the token, posting to a `method: post` page.

```liquid
<form action="/enquiry" method="post">
  {% render 'modules/insites_crm/authenticity_token', context: context %}
  <input type="text" name="enquiry[first_name]" required>
  <input type="text" name="enquiry[last_name]">
  <input type="email" name="enquiry[email]" required>
  <textarea name="enquiry[message]" required></textarea>
  <button type="submit">Send enquiry</button>
</form>
```

```liquid
---
slug: enquiry
method: post
---
{%- assign enquiry = context.params.enquiry -%}
{%- comment -%}
  The page's existing steps run first, unchanged: save the enquiry row and send the staff notification email.
{%- endcomment -%}
{%- function pipeline = "enquiries/send_to_pipeline", email: enquiry.email, first_name: enquiry.first_name, last_name: enquiry.last_name, message: enquiry.message, form_name: "Quote request" -%}
{%- unless pipeline.valid -%}
  {%- log pipeline.errors, type: "enquiry_pipeline" -%}
{%- endunless -%}
{%- redirect_to "/enquiry/thanks" -%}
```

A form built in the form builder: the same call in the form's `async_callback_actions`, reading the submitted values from `form.properties`, as app-portal's `contact_us` callback does.

```liquid
{%- function pipeline = "enquiries/send_to_pipeline", email: form.properties.email, first_name: form.properties.first_name, last_name: form.properties.last_name, message: form.properties.message, form_name: "Contact us" -%}
```

❌ **Incorrect:**
- Building the pipeline setup without asking, or not offering it on a quote or booking form.
- Offering it on a newsletter, support or job application form.
- Creating a second pipeline when the site already has a sales pipeline.
- Adding Won and Lost stages. Set the opportunity's `status` instead.
- Taking the Website uuid from the CRM's system fields (`/crm/api/v2/system-fields`). An opportunity reads its lead source from `/pipeline/api/v2/system-fields`.
- Setting `"value": "0"` to fill the field. Leave it blank until someone prices the work.
- Replacing the form's database row or its staff email with the pipeline. This is added on top.
- Building the request with quoted interpolation, as in `{% parse_json %}{ "email": "{{ form.properties.email }}" }{% endparse_json %}`. That breaks the `pipe-vars-through-json-filter` rule; use an `assign` hash literal.

**Verified by:**
- Endpoints, required fields and status values: `module-v6-pipelines` v6.0.2 `controllers/_external/v2/opportunities/add_opportunity.liquid` (422 on `status`, `pipeline.uuid`, `stage.uuid`), `schema/opportunity.yml` (no notes or description column), `controllers/_external/v2/system_fields/get_system_fields.liquid` (keyword is a contains match through `record_filter`), `migrations/20240614102840_seed_pipeline_system_fields.liquid` (`Website` among ten seeded lead sources). See [`modules/pipelines/api.md`](../../skills/insites/references/modules/pipelines/api.md).
- Contact lookup and create: `module-v6-crm` v6.1.4 `controllers/_external/v2/contacts/get_contacts.liquid:57-66` (`exact: "true"` sets the `value` condition), `contacts/models/user_fields.liquid` (`email` filters the user's email), `contacts/add_contact.liquid`. See [`modules/crm/api.md`](../../skills/insites/references/modules/crm/api.md).
- Activity types: `module-v6-crm` v6.1.4 `vue/src/views/CRM/sections/Activities/Activities.vue:235-245` lists Call, Chat, Email, Event, File Note, Meeting, SMS and Other; the API type is `file_note`.
- A form callback creating a CRM contact: `app-portal/modules/ins_forms/public/forms/contact_us.liquid:6` calls `modules/website/public/views/partials/forms/contact_event_stream.liquid`, which runs `crm/controller/contacts/create` from `form.properties`. It builds that request with quoted interpolation; do not copy that part.
- **Not yet run on an instance.** Still to measure: the contact lookup by exact email; what `contacts/create` answers for an email that already exists; an opportunity created with the Pipelines Website uuid and no `value`; and the activity on the opportunity. `activities/add_activity.liquid:10-21` sets the related table from `params.related_type`, while the documented key is `feature_type`, so whether `feature_type: "opportunity"` attaches the note is the first thing to check.
