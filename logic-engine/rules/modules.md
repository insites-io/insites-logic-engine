# Rules — Modules and platform configuration

Rules about the module model, platform configuration, secrets management, and how to extend shared code.

---

```yaml
---
id: modules-always-present
applies_to: [global]
severity: info
evidence: real-project
evidence_source: "All four reference repos check modules into source under modules/ folders. No installation manifest, no install command, no manifest.yml. They are always present; only versions vary across instances. A root app.yml, as in app-seedling, describes the repository: insites-cli 6.1.0 deploys only app/ and modules/ and never reads app.yml."
audit_ref: audit/v0-conflicts.md#open-questions
supersedes:
  - modules-never-install (original R-8)
  - never-edit-modules-folder (original R-17)
---
```

**Rule:** Every Insites module is **always present** on every instance. Modules are checked-in source code under `modules/{module-name}/` — they are never installed at runtime. What varies between instances is the **version** of each module.

**Why:** The skill content originally said modules are "installed once and brought in via app.yml" and that the `modules/` folder is "READ-ONLY because addons are installed there and changes will be overwritten on upgrade." Both are factually wrong:

- There is no installer, no manifest.yml, no `insites-cli modules install` command anywhere in the platform.
- The `modules/` folder is just checked-in source code in the project's git repo.
- A root `app.yml` (app-seedling has one) lists local `path:` entries such as `path: modules/dashboard/public`. It describes the repository only: insites-cli 6.1.0 uploads `app/` and `modules/<name>/{public,private}/` and never reads `app.yml`.

This matters because users coming from other platforms (Webflow, Shopify, WordPress) might assume installs are required. They aren't.

**How to apply:**
- When checking module availability in a decision rule, use `module_version_gte` / `module_version_lt` / `module_version_in_range` to test the version on the current instance — never `module_installed` (which would always return true).
- A module's tables can gain, lose or rename fields between versions (ecommerce 6.1.0 replaced `is_website_display` with `out_of_stock_action` on product, and fills `net_price` and `unit_tax` with 0 by default). Before writing or importing into `modules/<module>/<table>`, read the installed module version and build field lists for that version. A module's private table may not appear in `admin_tables`, so do not rely on it to validate fields.
- When extending another team's module, don't edit their files directly. Use composition: write your own pages/partials/commands that call the shared module's exports (`{% function %}`, `{% render %}`, GraphQL queries to shared schemas).
- When you control the module, you can edit it freely. Modules in your own repo are yours to evolve.

**Verified by:**
- `app-seedling/app.yml:5-11`: a repository description with `path:` entries, not an installation manifest; the CLI does not read it
- `app-portal/modules/` — four local module directories (client, ins_forms, portal, website) all checked into the repo
- Across all four repos: no `manifest.yml`, no install command, no install hooks

**Note:** This rule replaces two original rules from the planning audit:
- ~~R-8 modules-never-install~~ ("Addons are installed once and brought in via app.yml") — dropped, premise was wrong.
- ~~R-17 never-edit-modules-folder~~ ("modules/ is READ-ONLY") — dropped, modules are just checked-in code.

---

```yaml
---
id: use-context-constants-for-secrets
applies_to: [page, partial, command, graphql]
severity: error
evidence: runtime-failure
evidence_source: "Most code uses context.constants correctly. 1 hardcoded Statsig API key found in app-portal/.../technical_foot.liquid:19. Must be migrated before shipping this rule."
audit_ref: audit/v0-conflicts-batch3.md#rule-r-18
preship_action: "Migrate hardcoded Statsig key in app-portal/modules/website/public/views/partials/layout/technical_foot.liquid:19 to context.constants.statsig_api_key."
---
```

**Rule:** Secrets — API keys, auth tokens, endpoints, credentials of any kind — MUST come from `context.constants` (or environment-injected values). They MUST NOT be hardcoded in templates, GraphQL files, JavaScript, or HTML.

**Why:** Hardcoded secrets get committed to git, leak via view-source, ship into client bundles, and are nearly impossible to rotate without a code change. Even "client-safe" keys (like Statsig client keys) follow this rule because:
- It establishes the secrets-management pattern for the team.
- A "client-safe" key today might gain capabilities tomorrow.
- The rotation story is uniform.

**How to apply:**
```liquid
{% comment %} Correct {% endcomment %}
{% assign stripe_key = context.constants.insites_stripe_pk_live_key %}

{% comment %} Correct {% endcomment %}
{% assign auth = context.constants.statsig_api_key %}

{% comment %} Wrong {% endcomment %}
<script src="...?apikey=client-8HmZGdyAduoHQGaUN4NoQFHjqaAyALhVPF790bQzPl4"></script>
```

For external API URLs that are static (e.g. Google Maps embed URL), the URL itself can be inline; the **key** must come from constants:
```liquid
<script src="https://maps.googleapis.com/maps/api/js?key={{ context.constants.google_maps_api_key }}"></script>
```

**Verified by:**
- Compliant: `app-portal/modules/portal/public/views/partials/stripe/get_stripe_settings.liquid:9` — uses `context.constants.insites_stripe_sk_live_key`
- Compliant: `app-portal/modules/portal/public/api_calls/stripe/customers/post.liquid:5` — `Bearer {{ context.exports.stripe.data.sk_key }}`
- VIOLATION: `app-portal/modules/website/public/views/partials/layout/technical_foot.liquid:19` — hardcoded Statsig key. **Pre-ship fix required.**
