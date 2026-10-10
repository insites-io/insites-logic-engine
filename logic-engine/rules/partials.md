# Rules — Partials

Rules that apply to files under `app/views/partials/` (or module-equivalent paths).

---

```yaml
---
id: partials-no-underscore-prefix
applies_to: [partial]
severity: error
evidence: real-project
evidence_source: "100% compliance across 438 partials in app-portal, app-seedling, addon-ecommerce, addon-events. Zero underscore-prefixed partials found. insites-cli audit (5.10.2) does not flag a lone underscore partial, only a partial with an underscore twin at the same path, so the evidence stays real-project."
audit_ref: audit/v0-conflicts-batch1.md#rule-r-3
---
```

**Rule:** Partial filenames MUST NOT start with an underscore. Use `partials/products/card.liquid`, not `partials/products/_card.liquid`.

**Why:** The platform's render resolution treats underscore-prefixed files differently (or rejects them outright). Conventional naming guarantees `{% render 'products/card' %}` resolves to the expected file across all environments.

**How to apply:** When creating a partial, name it without a leading underscore. The render path matches the filename without the `.liquid` extension: `app/views/partials/products/card.liquid` → `{% render 'products/card' %}`.

**Verified by:** 438 partials inspected, zero violations.

---

```yaml
---
id: render-vs-function-tags
applies_to: [partial, page]
severity: info
evidence: real-project
evidence_source: "Convention followed where used. render produces HTML output; function returns a value the caller assigns."
audit_ref: audit/v0-conflicts-batch2.md#rule-r-14
---
```

**Rule:** Use `{% render 'path/name' %}` for partials that produce HTML output. Use `{% function result = 'path/name' %}` for partials that return a value the caller will use.

**Why:** The two tags have different semantics. `render` is a side-effect (HTML emitted into the output stream). `function` is a return-a-value call (assigns to a variable). Mixing them makes templates harder to read and reason about.

**How to apply:**
- HTML-producing partial (e.g. a card, header, form widget): call with `{% render %}`. Examples: `{% render 'products/card', product: p %}`, `{% render 'shared/navigation' %}`.
- Data-returning partial (e.g. a validator, a query wrapper, a calculation): call with `{% function %}`. Examples: `{% function user = 'crm/get_current_user' %}`, `{% function valid = 'validations/presence', value: input %}`.

**Verified by:**
- `app-seedling/modules/dashboard/public/views/pages/account/verify_2fa.liquid:39` — render for HTML (CSRF token)
- `app-portal/modules/portal/public/forms/account/my_details.liquid:132` — function for data (update_contact returns object)

---

```yaml
---
id: graphql-in-partials-restricted
applies_to: [partial]
severity: warning
evidence: real-project
evidence_source: "Rewrite of original R-2 'graphql-not-in-partials'. Original rule said NO GraphQL in partials, but 35/438 partials in canonical repos use GraphQL — particularly in block partials (recommendations, filters), checkout calculations, and callbacks. Pure presentation partials should still be GraphQL-free."
audit_ref: audit/v0-conflicts-batch1.md#rule-r-2
supersedes: [graphql-not-in-partials]
---
```

**Rule:** GraphQL calls in partials are permitted ONLY for:

1. **Data-heavy block partials** — product recommendations, category filters, search facets, anything that's a self-contained data block reused across pages.
2. **Internal calculations** — discount validation, order total computation, date math against records.
3. **Callback / mutation handlers** — partials that handle the post-action side of a workflow (sign-in callbacks, payment confirmations).

Pure presentation partials (cards, headers, layouts, UI components) MUST NOT contain GraphQL. Pass data in as parameters from the caller.

**Platform behavior:** this is a convention, not a platform limit. The platform runs `{% graphql %}` inside a partial: a partial called with `{% function %}` ran an inline mutation and returned its result on a production instance on 9 October 2026. No Liquid error forbids it, and `insites-cli audit` does not check it.

**Why:** Calling GraphQL in every render of a UI component creates N+1 query explosions and tight coupling between presentation and data. But forbidding it everywhere is contradicted by real-world practice — block partials and calculation partials are legitimate use cases.

**How to apply:**
- Building a card / header / layout / nav / form widget? → No GraphQL. Take data as parameters.
- Building a "what's hot" block, a recommendation widget, a discount-code validator? → GraphQL OK if the data is self-contained to that block.
- For repeated query patterns, wrap in `app/lib/queries/` (or module equivalent) and call via `{% function %}`.

**Verified by:**
- Acceptable GraphQL-in-partial: `addon-ecommerce/modules/ecommerce/public/views/partials/blocks/new_arrivals.liquid:9,13` — block partial fetching its own products
- Platform runs it: `signin/take_slot` in `skills/insites/references/authentication/patterns.md`, a calculation partial called with `{% function %}` that runs a `record_create` per slot, run on a production instance on 9 October 2026
- Forbidden pattern (no real examples violate): a UI card partial doing a GraphQL fetch on every render
- Compliant pure-presentation partials: `addon-ecommerce/modules/ecommerce/public/views/partials/products/product_card.liquid` (receives data as parameters)

**Note:** This rule was substantially rewritten during the v0 audit. The original wording ("NO GraphQL calls from partials") was contradicted by 8% of real-world partials.
