# Rules — Forms

Rules that apply to files under `app/forms/` (or module-equivalent paths) and to HTML forms in pages/partials.

---

```yaml
---
id: forms-no-form-tag
applies_to: [form]
severity: error
evidence: real-project
evidence_source: "Rule sound. 4 violations in canonical repos must be fixed before shipping (app-portal sign_out, pay_bills; app-seedling sign_out; addon-ecommerce checkout_payment)."
audit_ref: audit/v0-conflicts-batch1.md#rule-r-5
preship_action: "Open 4 PRs replacing {% form %} with plain <form> + authenticity_token before shipping this rule."
---
```

**Rule:** Do NOT use the deprecated `{% form ... %}` Liquid tag. All forms MUST use plain HTML `<form>` tags with `{% render 'modules/insites_crm/authenticity_token' %}` (or equivalent CSRF mechanism) for POST, PUT, and DELETE operations.

**Why:** The `{% form %}` tag is deprecated. The platform supports plain HTML forms which give developers full control over markup and integrate cleanly with modern JS, validation libraries, and accessibility tools.

**How to apply:**

✅ **Correct:**
```liquid
<form action="/account/update" method="post">
  {% render 'modules/insites_crm/authenticity_token', context: context %}
  <input type="text" name="user[email]" required>
  <button type="submit">Save</button>
</form>
```

❌ **Deprecated (forbidden):**
```liquid
{% form method: 'post' %}
  <input type="text" name="user[email]">
{% endform %}
```

**Verified by:**
- Compliant: `app-seedling/modules/dashboard/public/views/pages/account/verify_2fa.liquid:38-39`
- VIOLATIONS (must fix before rule ships):
  - `app-portal/modules/portal/public/forms/account/sign_out.liquid:16` — `{% form method: 'delete' %}`
  - `app-portal/modules/portal/public/forms/pay_bills/pay_bills.liquid:102` — `{% form html-id: "checkout-form" %}`
  - `app-seedling/modules/dashboard/public/forms/account/sign_out.liquid:12` — `{% form method: 'delete' %}`
  - `addon-ecommerce/modules/ecommerce/public/forms/checkout/checkout_payment.liquid:199` — `{% form html-id: "checkout-form" %}`

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
