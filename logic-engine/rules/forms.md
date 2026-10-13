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
