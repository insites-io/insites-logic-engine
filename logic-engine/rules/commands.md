# Rules — Commands

Rules that apply to files under `app/lib/commands/` (or module-equivalent paths).

---

```yaml
---
id: pipe-vars-through-json-filter
applies_to: [command, form, page]
severity: error
evidence: runtime-failure
evidence_source: "5+ unsafe instances of unfiltered variable interpolation in parse_json blocks found in production code (app-portal, addon-ecommerce). Critical security issue: opens JSON-injection / XSS attack surface."
audit_ref: audit/v0-conflicts-batch2.md#rule-r-11
preship_action: "Fix all unsafe parse_json blocks before shipping (see audit for locations)."
---
```

**Rule:** Every variable interpolated into a `{% parse_json %}` block MUST be piped through the `| json` filter.

**Why:** Without the `| json` filter, user-controlled or external data interpolated into JSON breaks the JSON when it contains quotes, backslashes, or control characters. Beyond breaking the parse, attacker-controlled values can inject additional JSON properties, escape into surrounding code, or exfiltrate data via XSS in the rendered output.

**How to apply:**
- ✅ `"email": {{ form.email | json }}`
- ✅ `"address": {{ context.params.address_1 | json }}`
- ❌ `"email": "{{ form.email }}"` (unfiltered)
- ❌ `"address": "{{ context.params.address_1 }}"` (unfiltered)

The `| json` filter handles all escaping correctly and emits the value with proper JSON quoting. Never wrap an unfiltered variable in literal `"..."` quotes — the filter does the quoting for you.

Two more rules close the same hole:
- **Take identity from the session, never from the object.** Read the email or user id from `context.current_user` inside the command, not from a caller-supplied `object`, so no caller can point the command at another account.
- **Prefer an `assign` hash literal.** The insites-cli 6.1.0 tag reference marks `{% parse_json %}` deprecated in favor of `assign` with a JSON literal (see [platform changes](../../skills/insites/references/platform-changes-2026.md)). Values written as variables are never parsed as JSON, so there is nothing to inject: `{% assign object = { "email": context.current_user.email, "otp_code": otp_code } %}`.

**Verified by:**
- Compliant file, unsafe caller: `app-seedling/modules/dashboard/public/views/partials/account/2fa_functions/verify_otp/build.liquid:10-11` pipes every value through `| json`, but its only caller, `app-seedling/modules/dashboard/public/views/pages/account/2fa.liquid:10-15`, builds `object` with `"otp_code": "{{ otp_code }}"` from the request. A crafted code can add keys, including a second `email`, before the build runs, and the build then reads `object.email`. A safe build does not repair an unsafe caller. Do not copy that page.
- VIOLATION: `app-portal/modules/portal/public/forms/account/my_details.liquid:99-127` — 8+ unfiltered variables
- VIOLATION: `addon-ecommerce/.../save-checkout-session.liquid:16-41` — 12+ unfiltered variables

**Pre-ship fix:** every violation in the canonical repos must be patched before this rule ships, or the engine will flag the canonical examples on day one.

---

```yaml
---
id: commands-return-valid-errors
applies_to: [command]
severity: warning
evidence: real-project
evidence_source: "100% compliance in the limited sample of 2 command files in app-seedling. Pattern correct, sample small."
audit_ref: audit/v0-conflicts-batch2.md#rule-r-9
---
```

**Rule:** Commands MUST return an object containing `valid: <boolean>` and `errors: <object>` keys. Callers depend on these to decide whether to redirect, render an error state, or continue.

**Why:** A single uniform return contract lets callers handle command results consistently. Without it, every caller has to know the internal shape of every command — and exception-based error handling doesn't compose with the rest of Liquid.

**How to apply:**
```liquid
{% comment %} CHECK stage initialises the contract {% endcomment %}
{% assign c = '{ "errors": {}, "valid": true }' | parse_json %}

{% comment %} Accumulate field errors {% endcomment %}
{% if object.title == blank %}
  {% assign field_errors = c.errors.title | default: '[]' | parse_json | add_to_array: "can't be blank" %}
  {% assign c['errors']['title'] = field_errors %}
  {% assign c['valid'] = false %}
{% endif %}

{% comment %} EXECUTE only if valid; merge result back {% endcomment %}
{% assign object = object | hash_merge: c %}
{% if object.valid %}
  {% graphql r = 'products/create', args: object %}
  {% assign object = r.record_create | hash_merge: c %}
{% endif %}

{% return object %}
```

`hash_assign` is deprecated; `assign` writes hash keys directly.

**Verified by:** `app-seedling/modules/dashboard/public/views/partials/account/2fa_functions/commands/execute.liquid:13-14` — explicitly assigns `valid: true` and returns object with both keys.

---

```yaml
---
id: commands-args-object-syntax
applies_to: [command, page]
severity: warning
evidence: real-project
evidence_source: "Consistent usage of args: object syntax in graphql tags across the corpus."
audit_ref: audit/v0-conflicts-batch3.md#rule-r-22
---
```

**Rule:** When calling a GraphQL mutation from a Command (or page), use `args: <object>` syntax to pass the validated object directly.

**Why:** Eliminates parameter-unpacking boilerplate, ensures all input was validated as a unit, and keeps the call site readable.

**How to apply:**
- ✅ `{% graphql r = 'products/create', args: object %}`
- ✅ `{% graphql orders = 'modules/ecommerce/orders/get_orders', args: order_filters %}`
- ❌ `{% graphql r = 'products/create', title: object.title, price: object.price, status: object.status %}` (parameter-by-parameter — fine for short calls but boilerplate-heavy for objects with many keys)

**Verified by:**
- `app-seedling/modules/dashboard/public/views/partials/account/2fa_functions/commands/execute.liquid:10`
- `app-portal/modules/portal/public/views/partials/users/list.liquid:3-4`
- `addon-ecommerce/modules/ecommerce/public/views/pages/orders/purchase-again.liquid:10-11`

---

```yaml
---
id: commands-build-check-execute
applies_to: [command]
severity: warning
evidence: skill-only
evidence_source: "Pattern documented in skill but only 1 explicit command file in 438 real .liquid files. Tagged aspirational pending team decision on whether this is current standard or future direction."
audit_ref: audit/v0-conflicts-batch1.md#rule-r-4
aspirational: true
---
```

**Rule (aspirational):** State-changing operations extracted into reusable functions SHOULD follow the build → check → execute pattern.

1. **BUILD** — `{% parse_json object %}` to whitelist input fields, with every variable piped through `| json` (see `pipe-vars-through-json-filter`).
2. **CHECK** — initialise a `{ "valid": true, "errors": {} }` contract; accumulate per-field validation errors; merge back into the object.
3. **EXECUTE** — if `object.valid`, call the GraphQL mutation with `args: object`. Always return the object whether valid or not.

**Why (aspirational caveat):** The pattern is documented and clean, but the canonical repos have only adopted it in one place (`app-seedling/.../2fa_functions/`). The engine treats this rule as guidance for *new* command files, not as a violation when state-changing logic lives inline in pages.

**How to apply (when writing a new command):** see `commands-return-valid-errors` for the canonical skeleton. The engine's `command.eta` template generates this skeleton automatically.

**Open question for team:** is build → check → execute current standard or future direction? If current → upgrade severity to `error` and refactor inline mutations across the canonical repos. If future → keep `aspirational: true` and don't flag inline mutations.

---

```yaml
---
id: validate-input-in-check-stage
applies_to: [command]
severity: warning
evidence: real-project
evidence_source: "Form-framework validation handles HTML form input. Explicit check required for non-form API endpoints."
audit_ref: audit/v0-conflicts-batch2.md#rule-r-10
---
```

**Rule:** User input arriving outside form submissions MUST be validated explicitly in the CHECK stage of a Command. Form-framework YAML validation is sufficient for input that arrives via standard HTML form submission.

**Why:** Form framework validates input automatically using the YAML schema. API endpoints, webhooks, and direct GraphQL mutations bypass that — so explicit validation in the command's CHECK stage is the only line of defense.

**How to apply:**
- HTML form submission → form YAML schema can carry the validation. CHECK stage may still add business-rule validation on top (e.g. "user already exists").
- API endpoint, webhook receiver, programmatic call → explicit CHECK validation REQUIRED.

**Verified by:**
- `app-seedling/.../2fa_functions/verify_otp/check.liquid:8-11` — explicit presence validation for `email` and `otp_code` before execution
- `app-portal/.../forms/account/my_details.liquid` — relies on form YAML schema validation (acceptable for HTML form input)

---

```yaml
---
id: extract-reusable-validations
applies_to: [command, form]
severity: info
evidence: real-project
evidence_source: "Module-level extraction observed in app-seedling. Recommend extracting when a validation is reused 2+ times."
audit_ref: audit/v0-conflicts-batch2.md#rule-r-16
---
```

**Rule:** Validation logic reused across 2+ commands or forms SHOULD be extracted into a helper partial under `app/lib/validations/` (or module-equivalent path).

**Why:** Inline validation duplication leads to drift — when business rules change, you only want to update one file. Extraction is unnecessary overhead for one-off validations, but valuable once a check appears in multiple places.

**How to apply:**
- 1 use of a validation rule → inline in the command CHECK stage is fine.
- 2+ uses → extract to `app/lib/validations/<name>.liquid` (or module equivalent like `modules/{name}/public/views/partials/validations/`) and call via `{% function valid = 'validations/<name>', value: input %}`.

**Verified by:** `app-seedling/modules/dashboard/public/views/partials/account/2fa_functions/validations/presence.liquid` — reusable presence validator extracted as helper.
- The v6 CRM module keeps `presence`, `truthy` and `date_range` at `modules/insites_crm/private/views/partials/lib/validations/` and calls them as `modules/insites_crm/lib/validations/<name>` from its relationship controllers.
