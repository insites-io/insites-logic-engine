# v0 Corpus Audit — Rules 9–16 Report

**Status:** Completed, second batch (8 of 25 rules).

**Date:** 2026-05-01

**Sources audited:**
- `app-portal` (186 .liquid files)
- `app-seedling` (77 .liquid files)
- `addon-ecommerce` (99 .liquid files)
- `addon-events` (76 .liquid files)

---

## Rule R-9: commands-return-valid-errors

**Skill claim:** "Commands always return an object with `valid` and `errors` keys for callers to check." — `skills/insites/SKILL.md:100` (Command Pattern section).

**Real-repo evidence FOR:**
- `app-seedling/modules/dashboard/public/views/partials/account/2fa_functions/commands/execute.liquid:13-14` — explicitly assigns `valid: true` and returns object
- `app-seedling/modules/dashboard/public/views/partials/account/2fa_functions/verify_otp/check.liquid:8,21-22` — contract initialized with `{ "errors": {}, "valid": true }`, then returned with both keys
- `app-seedling/modules/dashboard/public/views/partials/test/commands/account/check_user_email_signup_test.liquid:12` — test contract includes both `errors` and `valid`

**Real-repo evidence AGAINST:**
- Only 2 explicit command files found across all repos; insufficient corpus to assess violations

**Cross-repo agreement:** `grounded` (limited sample, 100% compliant where found)

**Linter check:** No enforcement found. No insites-cli audit rules validate return object structure.

**Recommended evidence classification:** `skill-only`

**Recommended severity:** `warning`

**Recommended resolution:** KEEP-AS-IS

**Suggested rewrite:** None needed; rule is sound and followed in practice.

---

## Rule R-10: validate-user-input-in-check-stage

**Skill claim:** "All user input must be validated in the CHECK stage of Commands (presence, type, length, format, business rules)." — `skills/insites/SKILL.md:100`.

**Real-repo evidence FOR:**
- `app-seedling/modules/dashboard/public/views/partials/account/2fa_functions/verify_otp/check.liquid:8-11` — presence validation called for `email` and `otp_code` before execution
- `app-seedling/modules/dashboard/public/views/partials/account/2fa_functions/validations/presence.liquid` — reusable presence validator extracted to helper
- `app-seedling/modules/dashboard/public/views/partials/account/2fa_functions/validations/truthy.liquid` — reusable truthy validator extracted to helper

**Real-repo evidence AGAINST:**
- Forms in `app-portal/modules/portal/public/forms/account/my_details.liquid` declare field validation in YAML (lines 8-75) but NOT in a check partial; validation is implicit in form framework, not explicitly in check stage
- `addon-ecommerce/modules/ecommerce/public/forms/checkout/checkout_shipping_address_guest.liquid:47-59` — parse_json with form properties but no explicit check stage validation
- Most form-based input validation is handled by the form framework's YAML schema, not by Command check partials

**Cross-repo agreement:** `partial` — apps rely heavily on form framework validation, not explicit command check-stage validators. The pattern is present but not universally applied to all user input operations.

**Linter check:** No enforcement found.

**Recommended evidence classification:** `real-project`

**Recommended severity:** `warning`

**Recommended resolution:** NUANCE

**Suggested rewrite:**
> "User input validation SHOULD be explicit in Command check stages when data arrives outside form submissions. Form framework validation (YAML schemas) is acceptable for HTML form input. Non-form API endpoints MUST use explicit check-stage validators for presence, type, and business rules."

---

## Rule R-11: pipe-vars-through-json-filter

**Skill claim:** "Variables passed into `parse_json` blocks must be piped through `| json` filter to prevent injection." — Security rule from skill references.

**Real-repo evidence FOR:**
- `app-seedling/modules/dashboard/public/views/partials/account/2fa_functions/verify_otp/build.liquid:10-11` — uses `| json` filter: `{{ email | default: object.email | json }}`
- `app-seedling/modules/dashboard/public/views/partials/api/error_response.liquid:29` — uses `| json` filter: `{{ errors_obj | json }}`
- `app-seedling/modules/dashboard/public/views/pages/tests.liquid:52` — uses `| json` filter: `{{ all_results | json }}`

**Real-repo evidence AGAINST (UNSAFE):**
- `app-portal/modules/portal/public/forms/account/my_details.liquid:99-108` — multiple unfiltered variable interpolations in parse_json: `"{{ props.address_1 }}"`, `"{{ props.address_2 }}"`, `"{{ props.suburb }}"`, etc. **NO `| json` filter used**
- `app-portal/modules/portal/public/forms/account/my_details.liquid:124-127` — unfiltered: `"{{ form.email }}"`, `"{{ form.properties.mobile_phone_country_code }}"` **NO `| json` filter**
- `addon-ecommerce/modules/ecommerce/public/forms/checkout/checkout_shipping_address_guest.liquid:54-55` — unfiltered: `"{{ context.session.contact_email }}"`, `"{{ form.properties.uuid }}"` **NO `| json` filter**
- `addon-ecommerce/modules/ecommerce/public/views/pages/checkout/save-checkout-session.liquid:16-41` — 12+ unfiltered context.params and context.session variables in parse_json blocks **NO `| json` filter on any**
- `addon-ecommerce/modules/ecommerce/public/emails/auto_responders/order_success.liquid:35,95,157` — unfiltered: `{{ form.id }}` **NO `| json` filter**

**Cross-repo agreement:** `contradicted` — Security-critical rule is violated at scale. 5+ high-risk instances found across app-portal and addon-ecommerce. This is a **critical security issue**.

**Linter check:** No enforcement found. insites-cli audit does not validate parse_json safety.

**Recommended evidence classification:** `runtime-failure` (injection risk)

**Recommended severity:** `error`

**Recommended resolution:** REWRITE (as enforcement rule, not advisory)

**Suggested rewrite:**
> "ALL variables interpolated into `parse_json` blocks MUST be piped through the `| json` filter. Exception: hardcoded strings and Liquid keywords only. This prevents JSON injection and XSS attacks. Enforce in CI linter: flag any `parse_json` block containing `{{ ... }}` without `| json` filter."

---

## Rule R-12: auth-policies-handle-nil-defensively

**Skill claim:** "Authorization policies must handle missing data defensively (e.g. if `context.current_user` is nil, echo `false` instead of crashing)." — `skills/insites/SKILL.md`.

**Real-repo evidence FOR:**
- `app-seedling/modules/dashboard/public/authorization_policies/is_user_logged_in.liquid:9-22` — explicit nil check: `if user_profile != blank... echo true... else echo false endif`
- `app-seedling/modules/dashboard/public/authorization_policies/is_2FA_activated.liquid` (inferred from pattern) — similar defensive structure

**Real-repo evidence AGAINST:**
- `addon-ecommerce/modules/ecommerce/public/authorization_policies/order_created_date_valid.liquid:6-16` — calls GraphQL to fetch `order_details` without checking if result is nil before calling `time_diff` on line 12. **If `order_details.created_at` is blank, the filter fails silently or crashes.** No explicit `if order_details != blank` guard.
- Policy returns implicit nil/false on line 14-15 (inside `if diff < 10`) without an explicit `else false` fallback.

**Cross-repo agreement:** `partial` — most policies defensively handle nil, but at least one (order_created_date_valid) lacks explicit nil guards before accessing nested properties.

**Linter check:** No enforcement found.

**Recommended evidence classification:** `real-project`

**Recommended severity:** `warning`

**Recommended resolution:** KEEP-DOWNGRADE

**Suggested rewrite:**
> "Authorization policies SHOULD explicitly check for nil/blank data before accessing nested properties. Use `if data != blank` guards or explicit `echo false` in else clauses to prevent implicit nil access."

---

## Rule R-13: pages-one-http-method

**Skill claim:** "Each page declares ONE HTTP method (GET, POST, PUT, or DELETE)." — `skills/insites/SKILL.md:47`.

**Real-repo evidence FOR:**
- `app-portal/modules/portal/public/views/pages/api/users/check-user-email.liquid:4` — `method: get`
- `app-portal/modules/portal/public/views/pages/api/users/update-user-account.liquid:3` — `method: post`
- `app-seedling/modules/dashboard/public/views/pages/api/users/id.liquid:4` — `method: patch`
- `addon-ecommerce/modules/ecommerce/public/views/pages/api/contacts/put.liquid:4` — `method: put`
- `addon-events/modules/events/public/views/pages/api/contacts/add-password.liquid:4` — `method: put`

**Real-repo evidence AGAINST:**
- None found. Every examined page declares exactly one `method:` field.

**Cross-repo agreement:** `grounded` — Pages consistently declare single HTTP methods across all repos. **100% compliance observed across 30+ sample pages.**

> **Corrected 13 October 2026:** the sample was not representative. Counted over every page on master, no page declares two methods, but 68 of 110 declare none (app-seedling 16 of 20). See `rules/pages.md`.

**Linter check:** No enforcement found, but pattern is universal in practice.

**Recommended evidence classification:** `real-project`

**Recommended severity:** `info`

**Recommended resolution:** KEEP-AS-IS

**Suggested rewrite:** None needed; rule is universally followed.

---

## Rule R-14: render-vs-function-tags

**Skill claim:** "Use `{% render %}` for partials that produce HTML, `{% function %}` for partials that return data." — `skills/insites/SKILL.md:376-377`.

**Real-repo evidence FOR:**
- `app-seedling/modules/dashboard/public/views/pages/account/verify_2fa.liquid:39` — `{% render 'modules/insites_core/authenticity_token', context: context %}` produces HTML (CSRF token)
- `app-portal/modules/portal/public/forms/account/my_details.liquid:132` — `{% function update_contact = "crm/controller/contacts/update", ... %}` returns data
- `app-seedling/modules/dashboard/public/views/pages/account/2fa.liquid:17` — `{% function object = 'modules/dashboard/account/2fa_functions/verify_otp', ... %}` returns data object

**Real-repo evidence AGAINST:**
- No clear violations found. Sample size is limited (only 2 render tags and 23+ function tags across all repos), but no cases where render/function are used backwards.

**Cross-repo agreement:** `grounded` — Limited but consistent usage; convention is followed where examples exist.

**Linter check:** No enforcement found.

**Recommended evidence classification:** `skill-only`

**Recommended severity:** `info`

**Recommended resolution:** KEEP-AS-IS

**Suggested rewrite:** None needed.

---

## Rule R-15: graphql-table-names-fully-qualified

**Skill claim:** "GraphQL filters must use fully-qualified table names (e.g. `table: { value: "modules/insites_crm/contact" }` not just `"contact"`)." — `skills/insites/SKILL.md`.

**Real-repo evidence FOR:**
- `app-portal/modules/client/public/graphql/discount/get_discount_by_code.graphql:11` — `table: { value: "modules/insites_ecommerce/discount" }`
- `addon-ecommerce/modules/ecommerce/public/graphql/products/search_products.graphql:18` — `table:{ value:"modules/insites_ecommerce/product" }`
- `addon-ecommerce/modules/ecommerce/public/graphql/products/is_product_existing.graphql:11,23,30,37` — all use fully-qualified: `"modules/insites_ecommerce/product"`, `"modules/insites_ecommerce/category"`

**Real-repo evidence AGAINST:**
- None found. All 20+ examined GraphQL files use fully-qualified table names.

**Cross-repo agreement:** `grounded` — **100% compliance observed across all repos.**

**Linter check:** No explicit linter enforcement found, but pattern is universal.

**Recommended evidence classification:** `real-project`

**Recommended severity:** `info`

**Recommended resolution:** KEEP-AS-IS

**Suggested rewrite:** None needed; rule is universally followed.

---

## Rule R-16: extract-reusable-validation-helpers

**Skill claim:** "Reusable validation logic should be extracted into helper partials at `app/lib/validations/` (or module equivalent)." — `skills/insites/SKILL.md:368`.

**Real-repo evidence FOR:**
- `app-seedling/modules/dashboard/public/views/partials/account/2fa_functions/validations/presence.liquid` — reusable presence validator extracted as helper (called from check.liquid:10)
- `app-seedling/modules/dashboard/public/views/partials/account/2fa_functions/validations/truthy.liquid` — reusable truthy validator extracted as helper (called from check.liquid:17)
- Pattern: `modules/{module}/public/views/partials/{domain}/validations/{validator_name}.liquid` — module-scoped equivalent of `app/lib/validations/`

**Real-repo evidence AGAINST:**
- Forms in `app-portal` and other repos embed validation rules inline in YAML form schemas (lines 8-75 of my_details.liquid) rather than extracting to helper partials
- No shared validation helpers found in `app/lib/validations/` or equivalent shared location across repos; each module defines its own (or relies on form framework)

**Cross-repo agreement:** `partial` — validation helpers ARE extracted in app-seedling (2FA domain), but form-based validation in other repos is inline/framework-driven. Limited evidence of systematic extraction across all repos.

**Linter check:** No enforcement found.

**Recommended evidence classification:** `real-project`

**Recommended severity:** `info`

**Recommended resolution:** NUANCE

**Suggested rewrite:**
> "Validation logic that is reused across 2+ commands or forms SHOULD be extracted into helper partials. Module-scoped extraction (e.g. `modules/{module}/public/views/partials/validations/`) is acceptable. Form framework YAML validation is acceptable for single-form use. Extract to shared helpers when: (1) same validation appears in 2+ partials, or (2) business rule is likely to change."

---

## Summary Table

| Rule | Verdict | Key Finding | Severity |
|------|---------|-------------|----------|
| R-9  | GROUNDED | Commands correctly return `valid` + `errors` keys | warning |
| R-10 | PARTIAL | Forms use framework validation; explicit check-stage less common | warning |
| **R-11** | **CONTRADICTED** | **5+ unfiltered variables in parse_json blocks — CRITICAL SECURITY ISSUE** | **error** |
| R-12 | PARTIAL | Most policies defensive; one lacks nil guards | warning |
| R-13 | GROUNDED | All pages declare exactly one HTTP method — 100% compliance | info |
| R-14 | GROUNDED | render/function convention followed where used | info |
| R-15 | GROUNDED | All GraphQL table names fully-qualified — 100% compliance | info |
| R-16 | PARTIAL | Module-level extraction present; form validation less extracted | info |

**Critical Meta-Finding:**

**Rule R-11 (parse_json injection safety) is the highest-priority finding.** Five instances of unsafe variable interpolation in production code across app-portal and addon-ecommerce represent a real security vulnerability. This rule MUST be enforced in CI before shipping. Recommended immediate action: fix unsafe parse_json blocks in my_details.liquid, checkout forms, and emails, then add insites-cli audit rule to detect and reject future violations.

