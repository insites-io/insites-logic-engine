# v0 Corpus Audit — Conflict Report

**Status:** Draft 1, first batch (8 of 25 rules). Awaiting Shane review on format + per-rule resolutions.

**Date:** 2026-05-01

**Sources audited:**
- `app-portal` (186 .liquid files)
- `app-seedling` (77 .liquid files)
- `addon-ecommerce` (99 .liquid files)
- `addon-events` (76 .liquid files)
- `insites-ai-tool/skills/insites/SKILL.md` and references (the existing public skill content)

**Total files inspected:** 438 .liquid files across the four reference repos.

---

## Executive summary

| Verdict | Count | Rules |
|---|---|---|
| **GROUNDED** — rule correct, ship as-is | 1 | R-3 |
| **CORRECT-INTENT, VIOLATED-IN-CORPUS** — rule sound but reference repos themselves break it | 2 | R-5, R-7 |
| **COMPLIANT** — rule sound, real repos comply | 1 | R-6 |
| **CONTRADICTED** — rule contradicted at scale, needs rewrite/nuance | 2 | R-1, R-2 |
| **ABSENT** — too few real examples to ground; rule is aspirational | 1 | R-4 |
| **FALSE** — rule is factually wrong, must be dropped or rewritten | 1 | R-8 |

**Key meta-findings:**

1. **No `insites-cli audit` enforcement detected** for any of the 8 rules audited. The skill cites the linter repeatedly but no actual enforcement was found in the reference repos (no audit-config files, no CI gates, no test fixtures showing rejected violations). **This invalidates the original `evidence: cli-audit` classification for several rules.** Before any rule ships as `evidence: cli-audit` we need an explicit verification that running `insites-cli audit` against a known-bad fixture produces a flag. Until then, all rules drop one tier.

2. **The reference repos themselves violate rules they advocate** (R-5, R-7). Before shipping these rules in the engine, the violations in the addon repos should be fixed (single-line corrections each). Otherwise the engine will flag the canonical reference code as wrong, which destroys credibility.

3. **`addon-ecommerce` is the most rule-noisy repo** — 18/99 files violate R-2 (graphql-in-partials), 7/99 violate R-1 (html-in-pages), and it contains the only R-7 violation. Either the ecommerce domain genuinely needs different rules, or the addon predates the rules and represents a refactoring backlog.

4. **The build → check → execute Command pattern is ~theoretical.** Across 438 files, only 1 explicit command file (`app-seedling/.../2fa_functions/commands/execute.liquid`) follows the pattern. Most state-changing logic lives inline in pages. Either the pattern is a future direction, or the rule is mis-stated.

5. **Module structure differs from the skill.** The skill describes `app/views/pages/` etc. at project root; real repos use `modules/{module-name}/public/views/...`. Path-based rules need to be qualified accordingly.

**Net impact on the planned 25-rule corpus:** assuming similar contradiction rate continues across the remaining 17 rules, expect ~10 rewrites, ~3 drops, ~5 severity downgrades. The audit is doing exactly the job it was designed to do.

---

## Format reference

Every entry below contains:

- **Skill claim** — verbatim quote of the rule from existing skill content with file:line citation
- **Real-repo evidence FOR** — examples of the rule being followed (with file:line)
- **Real-repo evidence AGAINST** — examples of the rule being violated (with file:line) — these are the gold findings
- **Cross-repo agreement** — `grounded` (consistently followed), `partial` (mixed), `contradicted` (mostly violated), or `absent` (too few examples)
- **Linter check** — whether `insites-cli audit` actually flags violations (or not)
- **Recommended evidence classification** — `cli-audit`, `runtime-failure`, `real-project`, or `skill-only`
- **Recommended severity** — `error`, `warning`, or `info`
- **Recommended resolution** — KEEP-AS-IS / KEEP-DOWNGRADE / REWRITE / DROP / NUANCE
- **Suggested rewrite** — exact new wording (when applicable)

**Shane's job:** review each entry, log decisions in the corresponding sub-task or as inline comments below, and approve the resulting v1 corpus.

---

## Rule R-1: pages-no-html

**Skill claim:** "NO raw HTML/JS/CSS in pages (pages = controllers)" — `skills/insites/SKILL.md:48`. Detailed at lines 335-340: "Page files: fetch data via `{% graphql %}`, delegate to partials via `{% render %}`. Partials: contain ALL HTML/JS/CSS presentation."

**Real-repo evidence FOR:**
- `app-portal/modules/website/public/views/pages/index.liquid` — uses `{% render %}` to delegate; no inline HTML
- `app-seedling/modules/dashboard/public/views/pages/overview.liquid` — GraphQL fetch + partial rendering
- `addon-ecommerce/modules/ecommerce/public/views/pages/shop/index.liquid` — clean controller pattern
- `addon-events/modules/events/public/views/pages/portal/overview.liquid` — HTML delegated to partials

**Real-repo evidence AGAINST:**
- `addon-events/modules/events/public/views/pages/account/create-password.liquid:35-44` — inline `<div>`, `<h3>`, `<p>` tags
- `addon-events/modules/events/public/views/pages/account/create-password.liquid:27` — HTML markup in GraphQL parse_json response message
- `addon-ecommerce/modules/ecommerce/public/views/pages/shop/products.liquid:55-76` — multiple `<div>` tags with grid layout
- `addon-ecommerce/modules/ecommerce/public/views/pages/checkout/checkout-billing.liquid` — inline checkout-form HTML
- `addon-ecommerce/modules/ecommerce/public/views/pages/checkout/checkout-payment.liquid` — inline payment form HTML
- `app-portal/modules/website/public/views/pages/contact.liquid` — `<div>`, `<form>`, `<label>` tags
- `app-portal/modules/portal/public/views/pages/my_details.liquid` — user-detail form HTML
- `app-portal/modules/website/public/views/pages/privacy_policy.liquid` — static `<h1>`, `<p>`, `<strong>`
- `app-seedling/modules/website/public/views/pages/index.liquid` — hero with `<section>`, `<div>`, `<h1>` inline
- `app-seedling/modules/dashboard/public/views/pages/profile.liquid` — profile form HTML

**Cross-repo agreement:** `contradicted` — 49/438 files (11.2%) violate. app-portal 11.8%, app-seedling 16.9%, addon-ecommerce 7.1%, addon-events 9.2%.

**Linter check:** No enforcement found. Skill cites `insites-cli audit` but no audit configuration or test fixture flags inline HTML in pages.

**Recommended evidence classification:** `skill-only`

**Recommended severity:** `warning` (not `error`)

**Recommended resolution:** `REWRITE`

**Suggested rewrite:**
> "Pages SHOULD delegate complex presentation to partials via `{% render %}`. Inline HTML is permitted for simple content pages (static text, single forms, system pages). Multi-component layouts (3+ distinct UI blocks, repeated structures, or HTML reused across pages) MUST be extracted to partials."

---

## Rule R-2: graphql-not-in-partials

**Skill claim:** "NO GraphQL calls from partials (pages only)" — `skills/insites/SKILL.md:49`. Detailed at lines 342-347: "NEVER call `{% graphql %}` from partials. Wrap GraphQL calls in query files at `app/lib/queries/`."

**Real-repo evidence FOR:**
- `app-portal/modules/portal/public/views/partials/shared/header.liquid` — uses `{% function %}` for queries
- `addon-ecommerce/modules/ecommerce/public/views/partials/products/product_card.liquid` — receives data as parameters
- `addon-events/modules/events/public/views/partials/events/details/base.liquid` — pure presentation
- `app-seedling/modules/dashboard/public/views/partials/ui/card.liquid` — reusable UI component

**Real-repo evidence AGAINST (sample of 21 violations):**
- `addon-ecommerce/modules/ecommerce/public/views/partials/blocks/new_arrivals.liquid:9,13` — direct `{% graphql products = ... %}` and `{% graphql all_categories = ... %}`
- `addon-ecommerce/modules/ecommerce/public/views/partials/blocks/you_may_also_like.liquid` — GraphQL recommendations
- `addon-ecommerce/modules/ecommerce/public/views/partials/blocks/whats_hot.liquid` — GraphQL fetch in block
- `addon-ecommerce/modules/ecommerce/public/views/partials/products/sidebar_categories.liquid` — direct category fetch
- `addon-ecommerce/modules/ecommerce/public/views/partials/layout/order_summary.liquid` — GraphQL mutations for order updates
- `addon-ecommerce/modules/ecommerce/public/views/partials/discounts/update_discount.liquid` — discount mutation
- `addon-ecommerce/modules/ecommerce/public/views/partials/checkout/validate_discount_code.liquid` — validation query
- `addon-ecommerce/modules/ecommerce/public/views/partials/checkout/compute_completed_order_amounts.liquid` — calculation query
- `addon-ecommerce/modules/ecommerce/public/views/partials/carts/cart_data.liquid` — cart fetch
- `addon-ecommerce/modules/ecommerce/public/views/partials/carts/cart_drawer.liquid` — cart queries
- `app-portal/modules/portal/public/views/partials/users/list.liquid:24,40` — two separate GraphQL queries
- `app-portal/modules/portal/public/views/partials/stripe/payments/checkout_payment_paybill.liquid` — payment mutation
- `app-portal/modules/portal/public/views/partials/stripe/credit_cards/create_credit_card.liquid` — card creation
- `app-seedling/modules/dashboard/public/views/partials/dashboard/dashboard_content.liquid:11` — direct query
- `app-seedling/modules/dashboard/public/views/partials/account/setup_2fa.liquid` — 2FA setup query
- `addon-events/modules/events/public/views/partials/orders/callback_init.liquid` — order init
- `addon-events/modules/events/public/views/partials/events/list/list.liquid` — event listing
- `addon-events/modules/events/public/views/partials/purchase_ticket/ticket_purchase_form.liquid` — ticket ops

**Cross-repo agreement:** `contradicted` — 35/438 files (8.0%). addon-ecommerce 18.2%, addon-events 15.8%, app-portal 1.6%, app-seedling 2.6%.

**Linter check:** No enforcement found.

**Recommended evidence classification:** `skill-only`

**Recommended severity:** `warning`

**Recommended resolution:** `NUANCE`

**Suggested rewrite:**
> "GraphQL calls in partials are discouraged but permitted for: (1) data-heavy block partials (product recommendations, category filters), (2) internal calculations (discount validation, order totals), and (3) callback/mutation handlers within self-contained workflows. Pure presentation partials (UI components, cards, headers, layouts) MUST NOT contain GraphQL. For simple, reusable query patterns, wrap in `app/lib/queries/` (or module-equivalent path) and call via `{% function %}`."

---

## Rule R-3: partials-no-underscore-prefix

**Skill claim:** "NO underscore prefix in partial filenames" — `skills/insites/SKILL.md:45`, Pre-Flight Validation checklist.

**Real-repo evidence FOR:** All 438 partials across all four repos comply. Zero underscore-prefixed partials found.

**Real-repo evidence AGAINST:** None.

**Cross-repo agreement:** `grounded` — 100% compliance.

**Linter check:** No explicit linter flag found, but the consistent absence of violations across 438 files suggests strict enforcement (either by convention or by build system rejection). **TODO before shipping `evidence: cli-audit`:** verify by creating `app/views/partials/_test.liquid` and running `insites-cli audit` on it.

**Recommended evidence classification:** `real-project` (upgrade to `cli-audit` after the verification TODO above)

**Recommended severity:** `error`

**Recommended resolution:** `KEEP-AS-IS`

---

## Rule R-4: commands-build-check-execute

**Skill claim:** "All create/update/delete operations go through Commands. Commands use inline build → check → execute pattern" — `skills/insites/SKILL.md:99-100`. Reference: `references/commands/api.md:5-72`.

**Real-repo evidence FOR:**
- `app-seedling/modules/dashboard/public/views/partials/account/2fa_functions/commands/execute.liquid` — partial pattern (parse_json BUILD, no explicit CHECK, GraphQL EXECUTE, returns `valid: true`)
- `references/commands/api.md:12-18, 28-43, 53-62` — canonical examples in skill, but only in skill, not in real code

**Real-repo evidence AGAINST:**
- `app-portal/modules/portal/public/views/pages/api/stripe/cards/post.liquid:20-119` — STATE-CHANGING operation (Stripe customer/card creation) does NOT follow the pattern. Inline ad-hoc logic, no `parse_json` build, no `valid`/`errors` contract, mutations called inline.
- `app-portal/modules/portal/public/forms/pay_bills/pay_bills.liquid` — form definition with GraphQL in default_payload, no command extraction

**Search results:** Only 2 explicit command files in `*/commands/` directories across 438 files. Most state-changing logic is inline in pages or forms.

**Cross-repo agreement:** `absent` — insufficient real-world examples to ground the rule. The pattern is documented but rarely implemented.

**Linter check:** No enforcement detected. No validator checks for `parse_json` presence or `valid`/`errors` contract structure.

**Recommended evidence classification:** `skill-only`

**Recommended severity:** `warning`

**Recommended resolution:** `NUANCE` (and tag as aspirational until Insites itself adopts the pattern more broadly)

**Suggested rewrite:**
> "State-changing operations extracted into reusable functions SHOULD follow the build → check → execute pattern: (1) BUILD via `parse_json` to whitelist input, (2) CHECK initialising a `{ valid: true, errors: {} }` contract and accumulating field errors, (3) EXECUTE the GraphQL mutation inside an `if object.valid` guard. Inline state-changing logic in pages or forms is acceptable today, but extraction to commands is recommended as the codebase grows."

**Open question for Shane:** is the build → check → execute pattern a current standard or a future direction? If future, the rule should be tagged `aspirational` and the engine should not flag inline mutations as violations.

---

## Rule R-5: forms-no-form-tag

**Skill claim:** "HTML form with CSRF → forms/ (use `<form>` tag, NOT `{% form %}`)" — `skills/insites/SKILL.md:175, 440`. Listed under "Forbidden Behaviors."

**Real-repo evidence FOR:**
- `app-seedling/modules/dashboard/public/views/pages/account/verify_2fa.liquid:38` — plain `<form>` POST with `{% render 'modules/insites_core/authenticity_token' %}` on line 39
- `app-seedling/modules/dashboard/public/views/partials/account/setup_2fa.liquid:12` — plain `<form>` multipart with authenticity_token
- 5 plain `<form>` tags across repos for authenticated endpoints

**Real-repo evidence AGAINST (the canonical repos themselves violate this):**
- `app-portal/modules/portal/public/forms/account/sign_out.liquid:16` — uses deprecated `{% form method: 'delete' %}...{% endform %}`
- `app-portal/modules/portal/public/forms/pay_bills/pay_bills.liquid:102` — uses deprecated `{% form html-id: "checkout-form"... %}`
- `app-seedling/modules/dashboard/public/forms/account/sign_out.liquid:12` — uses deprecated `{% form method: 'delete' %}...{% endform %}`
- `addon-ecommerce/modules/ecommerce/public/forms/checkout/checkout_payment.liquid:199` — uses deprecated `{% form html-id: "checkout-form"... %}`

**Cross-repo agreement:** `partial` — rule is sound but the reference repos themselves contain 4 violations. If we ship this as `error`-severity, the engine will flag the canonical examples as wrong.

**Linter check:** Not verified at audit time. **TODO:** run `insites-cli audit` on a `{% form %}` fixture to confirm.

**Recommended evidence classification:** `real-project` (pending cli-audit verification)

**Recommended severity:** `error`

**Recommended resolution:** `REWRITE` for clarity, AND **fix the 4 violations in the canonical repos before shipping the rule**.

**Suggested rewrite:**
> "Do not use the deprecated `{% form %}` tag. All forms must use plain HTML `<form>` tags with `{% render 'modules/insites_core/authenticity_token' %}` (or equivalent CSRF mechanism) for POST, PUT, DELETE operations."

**Pre-ship action:** open 4 PRs (one per violating file) replacing `{% form %}` with `<form>` + authenticity_token.

---

## Rule R-6: csrf-token-required

**Skill claim:** "CSRF protection → forms/ (authenticity_token)" — `skills/insites/SKILL.md:120`. Implies all POST forms must include the token.

**Real-repo evidence FOR:**
- `app-seedling/.../verify_2fa.liquid:38-39` — POST form with `{% render 'modules/insites_core/authenticity_token', context: context %}`
- `app-seedling/.../setup_2fa.liquid:12-13` — POST multipart form with authenticity_token render
- `app-portal/.../layout/head.liquid` — global meta tag setup
- `app-seedling/.../layout/technical_head.liquid` — global meta tag approach
- `addon-ecommerce/.../checkout_layout.liquid` — meta tags configured

**Real-repo evidence AGAINST:** None. Both POST forms found include the token. Global meta-tag pattern covers other cases.

**Cross-repo agreement:** `grounded` — 100% compliance among inspected POST forms.

**Linter check:** No enforcement detected, but no violations in the corpus either.

**Recommended evidence classification:** `real-project`

**Recommended severity:** `warning`

**Recommended resolution:** `KEEP-AS-IS` (with a small clarification about GET vs POST)

**Suggested clarification:**
> "GET forms do not require CSRF tokens. POST, PUT, DELETE forms MUST include `{% render 'authenticity_token' %}` (or equivalent), OR the global meta-tag CSRF pattern in the layout."

---

## Rule R-7: auth-policy-explicit-true-false

**Skill claim:** "Authorization policies must explicitly echo `true` or `false`, never neither" — inferred from `skills/insites/SKILL.md` architecture and `references/authorization_policies/` patterns; explicit comment in `app-seedling/.../is_user_logged_in.liquid` says "Explicitly echo true/false to avoid implicit behavior."

**Real-repo evidence FOR:**
- `app-portal/modules/portal/public/authorization_policies/is_user_logged_in.liquid:14-18` — all paths echo true or false
- `app-seedling/modules/dashboard/public/authorization_policies/is_user_logged_in.liquid:18-22` — explicit echo statements with confirming comment
- `app-seedling/.../allow_2fa_verification.liquid:17-31` — guard clause + explicit branches
- `app-seedling/.../is_2FA_activated.liquid` — explicit echo in all paths
- `app-seedling/.../is_user_allowed.liquid` — explicit echo
- `app-portal/.../has_client_profile.liquid:15-16` — two explicit echo true statements

**Real-repo evidence AGAINST:**
- `addon-ecommerce/modules/ecommerce/public/authorization_policies/order_created_date_valid.liquid:14-16` — **CRITICAL VIOLATION:** policy reads `{%- if diff < 10 -%}true{%- endif -%}`. If `diff >= 10`, nothing is echoed. Policy implicitly returns nil/blank instead of explicit `false`. Indistinguishable from a syntax-correct policy that always returns true → potential auth bypass risk.

**Cross-repo agreement:** `partial` — 6 of 7 inspected policies compliant; 1 violation in `addon-ecommerce`.

**Linter check:** Would NOT be caught by a syntax linter. This is logic/semantics. A custom validator would need to enforce "every code path in a policy file echoes true or false."

**Recommended evidence classification:** `real-project`

**Recommended severity:** `error`

**Recommended resolution:** `KEEP-AS-IS` (rule is correct), AND **fix the violation in `addon-ecommerce` before shipping the rule** (or it'll flag the canonical repo on first scan).

**Pre-ship action:** PR against `addon-ecommerce/.../order_created_date_valid.liquid` adding the explicit `else false` branch:

```liquid
{%- if diff < 10 -%}
    true
{%- else -%}
    false
{%- endif -%}
```

---

## Rule R-8: modules-never-install

**Skill claim (ORIGINAL, INCORRECT):** "Addons are installed once and brought in via app.yml" — implies a runtime installation process. Originally extracted from skill content during planning.

**Shane's correction:** "Every Insites module is always present on every instance, only versions vary."

**Real-repo evidence (supporting Shane's correction):**
- `app-seedling/app.yml:5-11` — modules section uses `path: modules/dashboard/public` directives, NOT installation manifest
- `app-portal/modules/` — four local module directories (client, ins_forms, portal, website) checked into the repo
- `addon-ecommerce/modules/ecommerce/` — local code directory, not a package reference
- `addon-events/modules/events/` — local code directory, not a package reference
- No `manifest.yml` files in any repo
- No `modules install` CLI references in any config or documentation
- `app.yml` uses local-filesystem `path:` directives, not version/install-from references

**Real-repo evidence AGAINST original rule:** No installation mechanism exists. The rule describes behaviour the platform doesn't actually have.

**Cross-repo agreement:** `absent` (the rule's premise is unsupported)

**Linter check:** N/A — architectural/deployment claim, not syntax.

**Recommended evidence classification:** N/A (rule is wrong)

**Recommended resolution:** `DROP` the original rule. Optionally `REWRITE` to capture the correct architectural truth.

**Suggested rewrite (if keeping a rule on this topic):**
> "Modules are always present as checked-in code under `modules/` directories. Modules are not dynamically installed at runtime. All modules available on an instance are determined by what code is checked into the repo. Module versions are controlled via `app.yml` `path:` directives. Use `insites-cli modules pull` (in development) to sync module code during development. The decision DSL uses `module_version_gte` and similar conditions to check available platform features, never `module_installed`."

---

## Summary table

| Rule | Skill claim | Real-repo evidence | Verdict | Severity | Resolution |
|---|---|---|---|---|---|
| **R-1** pages-no-html | NO HTML/JS/CSS in pages | 49/438 violate (11.2%) | `contradicted` | `warning` | REWRITE |
| **R-2** graphql-not-in-partials | NO GraphQL in partials | 35/438 violate (8.0%) | `contradicted` | `warning` | NUANCE |
| **R-3** partials-no-underscore-prefix | No leading `_` in partial names | 0/438 violate | `grounded` | `error` | KEEP-AS-IS |
| **R-4** commands-build-check-execute | Build → check → execute pattern | 1/438 follows pattern | `absent` | `warning` | NUANCE (aspirational) |
| **R-5** forms-no-form-tag | No deprecated `{% form %}` | 4/438 violate (in own repos) | `partial` | `error` | REWRITE + fix violations |
| **R-6** csrf-token-required | CSRF token on POST forms | 0/2 inspected violate | `grounded` | `warning` | KEEP-AS-IS |
| **R-7** auth-policy-explicit-true-false | Always echo true/false | 1/7 violates (in own repos) | `partial` | `error` | KEEP-AS-IS + fix violation |
| **R-8** modules-never-install | Modules installed via app.yml | Rule premise false | `false` | N/A | DROP or REWRITE |

---

## Pre-ship action items (before any rule lands in v1 corpus)

1. **R-3 verification:** create a fixture file `app/views/partials/_test.liquid` and run `insites-cli audit` to confirm whether the linter flags it. If yes → upgrade evidence to `cli-audit`; if no → leave as `real-project`.
2. **R-5 fixes:** open 4 PRs replacing `{% form %}` with `<form>` + authenticity_token in the canonical repos before shipping the rule:
   - `app-portal/modules/portal/public/forms/account/sign_out.liquid:16`
   - `app-portal/modules/portal/public/forms/pay_bills/pay_bills.liquid:102`
   - `app-seedling/modules/dashboard/public/forms/account/sign_out.liquid:12`
   - `addon-ecommerce/modules/ecommerce/public/forms/checkout/checkout_payment.liquid:199`
3. **R-7 fix:** open 1 PR adding explicit `else false` branch in `addon-ecommerce/.../order_created_date_valid.liquid:14-16`. **Note:** this is also a potential auth bypass — should be fixed regardless of the engine.
4. **Meta-finding follow-up:** for every rule planned with `evidence: cli-audit`, verify that `insites-cli audit` actually flags violations against a known-bad fixture. Until proven, no rule ships as `cli-audit`.

---

## Open questions for Shane

1. **R-1 / R-2 nuance:** the proposed rewrites permit inline HTML in simple pages and GraphQL in block/calculation partials. Is that the right line, or do you want stricter rules with a corresponding push to refactor the addon repos?

2. **R-4 status:** is the build → check → execute Command pattern current standard or a future direction? This determines whether the engine treats inline mutations as violations or as acceptable.

3. **R-5 / R-7 sequencing:** should the engine ship with these rules disabled until the canonical repos are fixed, or should we fix the canonical repos first (4 + 1 = 5 small PRs) and ship the engine afterwards? I'd suggest fixing first — engine credibility depends on it.

4. **R-8 replacement:** drop entirely or keep a rewritten rule clarifying the always-present module model? My suggestion is to keep a rewrite because it's load-bearing knowledge for users coming from other platforms (Webflow, Shopify) who'd assume installs are required.

5. **Format approval:** is this entry format clear enough? Each entry runs ~150 lines; the full 25-rule report would be ~3,500 lines. Acceptable, or would you prefer a more compact format (e.g. machine-readable JSON with a separate human-readable summary)?

---

## Next steps

- Await Shane's review on format and the 8 worked entries.
- On approval, audit remaining 17 rules in batches of 8 (two more passes).
- Final consolidated report becomes input to the v1 corpus PR.
- Pre-ship action items (the 5 fixes + the cli-audit verification) get tracked as small follow-on PRs against the appropriate repos.
