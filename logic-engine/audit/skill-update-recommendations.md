# Skill update recommendations — based on `app-portal` ground truth

**Audience:** Ezekiel (and the wider Insites team).

**Author:** Generated alongside the v0 corpus audit. Part of the engine handoff PR.

**Status:** Draft 1. Recommendations only — no skill content has been changed yet. Each section ends with concrete suggested rewrites Ezekiel can adopt verbatim or modify.

---

## 1. Why this rewrite is needed

The v0 corpus audit (see [`v0-conflicts.md`](v0-conflicts.md)) audited 25 candidate rules extracted from `insites-ai-tool/skills/insites/SKILL.md` and its references. Of those 25, 5 were contradicted at scale by real production code, 4 were correct in intent but violated in the canonical reference repos themselves, 3 were absent from real practice (~aspirational), and 2 were factually wrong about platform mechanics.

**Root cause:** The existing skill content was generated from general documentation that describes a different file/folder structure from the one Combinate uses to build templates in production. The "wrong" rules aren't author errors — they're inherited from conventions that do not match how Insites projects are built. Trying to enforce them against real Combinate code surfaces violations everywhere because the rules don't describe what the team actually builds.

**The fix:** stop sourcing skills from that general documentation. Use `app-portal` (Combinate's working production project) as the canonical reference. Rewrite the skill content section by section based on what that codebase actually does.

This document is structured to make the rewrite incremental: section 2 establishes the layout, sections 3–9 cover canonical anatomies (one per file kind), section 10 lists patterns the existing skill misses entirely, and section 11 recommends the order in which Ezekiel should ship follow-up PRs.

---

## 2. Canonical Combinate project layout

The existing skill describes a flat `app/views/pages/` layout at project root. **Real Combinate projects use a multi-module structure under `modules/`.** Here's the actual layout from `app-portal`:

```
app-portal/
├── modules/
│   ├── client/public/         (shared between app-portal and addons)
│   │   ├── api_calls/
│   │   ├── graphql/
│   │   └── views/
│   ├── ins_forms/
│   ├── portal/public/         (the dashboard module)
│   │   ├── api_calls/         third-party API integrations
│   │   ├── assets/            module-scoped JS, CSS, images
│   │   ├── authorization_policies/
│   │   ├── emails/            email templates (workflows, autoresponders)
│   │   ├── forms/             form definitions (YAML + Liquid callbacks)
│   │   ├── graphql/           queries + mutations grouped by domain
│   │   ├── schema/            database table definitions
│   │   ├── user_profile_types/  custom user-profile schemas
│   │   └── views/
│   │       ├── layouts/       page wrappers (portal_default, portal_form, etc.)
│   │       ├── pages/         routed Liquid pages
│   │       └── partials/      reusable HTML/data fragments
│   └── website/public/        (the public marketing site module)
│       ├── api_calls/
│       ├── assets/
│       ├── graphql/
│       ├── migrations/        idempotent data seeding
│       ├── schema/
│       └── views/             (layouts, pages, partials)
├── public/                    (top-level static assets)
└── vercel.json                (deploy config — Vercel-hosted)
```

**Key differences from the existing skill:**

| Existing skill says | Reality in `app-portal` |
|---|---|
| Pages live at `app/views/pages/{slug}.liquid` | Pages live at `modules/{module}/public/views/pages/{slug}.liquid`. Module name prefix is part of every render path. |
| `app/lib/commands/` is the canonical command location | `app-portal` has zero files under any `lib/commands/` path. State-changing logic lives inline in pages or in `forms/{name}.liquid` `callback_actions`. |
| `app/lib/queries/` for shared queries | No `lib/queries/` directory in `app-portal`. GraphQL files live at `modules/{module}/public/graphql/{domain}/{operation}.graphql` and are called directly from pages or forms. |
| `app/views/layouts/` | `modules/{module}/public/views/layouts/`. Layout names are namespaced (e.g. `portal_default`, `portal_form`, `portal_system_pages`). |

**Suggested rewrite for `skills/insites/SKILL.md` "Project Structure" section:**

> "Insites projects organise code by **module**, not by a flat root layout. Every project has a top-level `modules/` directory containing one or more module folders (e.g. `modules/portal/`, `modules/website/`). Each module follows the same internal structure under `modules/{name}/public/`:
>
> - `views/pages/` — routed Liquid pages
> - `views/partials/` — reusable HTML/data fragments
> - `views/layouts/` — page wrappers
> - `forms/` — form definitions (YAML + Liquid `callback_actions`)
> - `graphql/` — queries + mutations grouped by domain (e.g. `account/`, `users/`, `payments/`)
> - `authorization_policies/` — page-level access control
> - `api_calls/` — third-party API integrations grouped by service
> - `schema/` — database table definitions
> - `assets/` — module-scoped JS, CSS, images
> - `emails/` — email templates
>
> Render paths always start with the module: `{% render 'modules/{module}/path/to/partial' %}`, `{% include 'modules/{module}/path/to/partial' %}`, `{% graphql x = 'modules/{module}/domain/operation' %}`."

---

## 3. Page anatomy (canonical)

Real `app-portal` page (`modules/portal/public/views/pages/overview.liquid`):

```liquid
---
slug: overview
layout: modules/portal/portal_default
searchable: true
max_deep_level: 1
metadata: {
    "status": "published",
    "page_name": "Overview | Insites Portal",
    "open_graph:url": "",
    ...
    "is_visible_to_search_engines": true,
    "sitemap_enabled": true,
    "sitemap_priority": "1.0",## primary order (DESC)
    "sitemap_order": "1", ## secondary order (ASC)
    "sitemap_changefreq": "monthly"
}
authorization_policies:
  - modules/portal/is_user_logged_in
---
{% comment %} Overview {% endcomment %}
{% include 'modules/portal/overview/overview' %}
```

**Front matter fields actually used in `app-portal` pages** (this is the canonical set — the skill should document only these):

| Field | Purpose | Required? |
|---|---|---|
| `slug` | URL path | yes |
| `layout` | full module path to a layout in `views/layouts/` | yes for HTML pages; omit (`layout: ""`) for self-contained pages |
| `format` | `html` (default), `json`, etc. | for API endpoints, set `json` |
| `method` | `get`, `post`, `put`, `patch`, `delete` | for API endpoints |
| `searchable` | boolean — show in site search | yes |
| `max_deep_level` | nesting depth cap | yes |
| `metadata` | hash of SEO + display fields (status, page_name, open_graph:*, meta_*, sitemap_*) | yes |
| `authorization_policies` | list of module-prefixed policy names | required for any gated page |

**Patterns the skill should call out:**

1. **Module-prefixed layout paths** — `layout: modules/portal/portal_default` (not just `portal_default`).
2. **Include vs render** — `app-portal` uses **both** `{% include %}` and `{% render %}` interchangeably for partials. The existing skill says "use `render`" without acknowledging `include` is also widely used. Don't mandate one over the other; document both as equivalent for pages calling partials.
3. **Inline conditional redirects** — pages frequently check session state and `{%- redirect_to '/overview' -%}` early-exit. Example: `pages/account/sign_in.liquid:30` — `{%- if context.current_user -%}{%- redirect_to '/overview' -%}{%- endif -%}`.
4. **API endpoints get `format: json` + `method:`** — see `pages/api/users/check-user-email.liquid` (returns JSON via inline parse_json + `add_hash_key`, no separate handler file needed).
5. **System pages live under `views/pages/system/`** — `403.html.liquid`, `404.html.liquid`, etc. Use the `system` subfolder convention.

**Suggested rewrite for `skills/insites/SKILL.md` "Pages" section:**

> "A page is a Liquid file under `modules/{module}/public/views/pages/{slug}.liquid` with YAML front matter at the top.
>
> **HTML pages** specify `layout: modules/{module}/{layout-name}` and contain markup or call partials via `{% render %}` or `{% include %}` (both are valid). Pages may contain inline HTML for simple content; reusable HTML chunks belong in partials.
>
> **API endpoints** specify `format: json` and `method: <verb>`. The page body builds a hash (typically with `parse_json` + `add_hash_key`) and outputs it. No separate route file is needed.
>
> **Authorisation** is declared in front matter via the `authorization_policies:` key, listing module-prefixed policy names. Inline auth checks (e.g. `if context.current_user == blank redirect_to ...`) are permitted as secondary guards but the primary check belongs in front matter."

---

## 4. Partial anatomy

`app-portal` uses partials extensively but with **less rigid rules** than the existing skill suggests. Specifically:

- Partials sometimes contain `{% graphql %}` calls (e.g. `views/partials/users/list.liquid:24,40`). The audit-rewritten rule (`graphql-in-partials-restricted`) permits this for data-heavy block partials.
- Partials are called with **either** `{% render %}` or `{% include %}`. The runtime treats them similarly enough that both are in active use.
- Parameters are typically passed as hash arguments: `{% render 'partial-name', user: current_user, mode: 'edit' %}`. There's no required header documenting params — partials are expected to be discoverable via grep.

**Filename rule:** no underscore prefix (`_card.liquid` would be wrong; `card.liquid` is correct). This rule is grounded — 0/438 violations across all 4 reference repos.

**Suggested rewrite for "Partials" section:**

> "A partial is a Liquid file under `modules/{module}/public/views/partials/...` that produces HTML or returns data when called from a page or another partial. Filenames must not start with an underscore.
>
> Partials are called with `{% render 'modules/{module}/path/name' %}` (HTML output) or `{% function result = 'modules/{module}/path/name' %}` (data return). `{% include %}` is also accepted and behaves similarly to `render` in current Insites projects.
>
> **GraphQL in partials:** permitted for data-heavy block partials (recommendations, filters, search facets), self-contained calculation partials (discount validation, total computation), and callback handlers (post-action workflows). Pure presentation partials (UI components, cards, headers, layouts) should receive their data as parameters from the calling page."

---

## 5. Layout anatomy

`app-portal` ships four layouts in `modules/portal/public/views/layouts/`:

- `portal_default.liquid` — main authenticated wrapper
- `portal_form.liquid` — wrapper for form-heavy pages
- `portal_system_pages.liquid` — sign-in, password reset, 403/404
- `portal_account.liquid` — account-detail pages

Layouts are referenced by full path: `layout: modules/portal/portal_default`.

**Suggested rewrite:**

> "A layout wraps a page's body with shared chrome (header, nav, footer). Layouts live at `modules/{module}/public/views/layouts/{name}.liquid`. They're referenced from page front matter as `layout: modules/{module}/{name}` (no `.liquid` extension).
>
> A layout renders the page body via `{{ content_for_layout }}`. It can pull in further partials via `{% render %}` and access the page's metadata hash via `{{ page.metadata.* }}`."

---

## 6. Form anatomy

Real `app-portal` form (`modules/portal/public/forms/account/my_details.liquid`):

```liquid
---
name: my_details
resource: User
resource_owner: anyone
flash_alert: Error-My-Details
flash_notice: Success-My-Details
redirect_to: my-details
fields:
  email:
    validation:
      unique: { message: "Email already exist" }
      presence: { message: "Please use a valid email address" }
      email: { message: "Please use a valid email address" }
  first_name:
    validation:
      presence: { message: "First name is required." }
  ...
  properties:
    address_1:
      validation:
        presence: { message: "Address 1 is required." }
      property_options:
        virtual: true
    ...

callback_actions: |-
  {% comment %} ... {% endcomment %}
  {% assign data = form | json %}
  {% assign props = form.properties %}

  {% graphql current_user = 'modules/portal/account/get_current_user' | dig: 'current_user' %}

  {% parse_json contact_address_details %}
  {
    "address_label": "{{ props.address_1 | default: 'Default' }}",
    ...
  }
  {% endparse_json %}

  {% liquid
    if form.properties.contact_address_uuid
      function contact_address = "crm/controller/addresses/update", type: "contact", uuid: props.contact_address_uuid, params: contact_address_details
    else
      assign contact_address_details = contact_address_details | add_hash_key: "contact.uuid", context.current_user.external_id
      function contact_address = "crm/controller/addresses/create", type: "contact", params: contact_address_details
    endif
  %}

  ...
---
```

**Form anatomy in real practice:**

1. **Front matter** declares `name`, `resource`, `resource_owner`, `flash_alert`, `flash_notice`, `redirect_to`, and a `fields:` schema with per-field `validation:` rules.
2. **`fields.{name}.validation`** carries presence/email/unique/length validators inline. The form framework runs these BEFORE the callback executes. Failed validation triggers `flash_alert` and re-renders the form page with errors.
3. **`callback_actions:`** is a Liquid block that runs after validation passes. This is where `parse_json` shapes data, `graphql` calls execute mutations, and `function` calls invoke shared CRM controllers (`crm/controller/contacts/update`, `crm/controller/addresses/create`).
4. **Forms are NOT separate Commands.** The build → check → execute pattern documented in the existing skill exists in *one* file across all 438 .liquid files in the four reference repos (`app-seedling/.../2fa_functions/commands/execute.liquid`). In production Combinate practice, form callbacks ARE the build → check → execute equivalent — validation in `fields.*.validation`, mutations in `callback_actions`. Document them as the actual pattern; tag `lib/commands/` as aspirational.

**Two violations of existing rules in this very file** (already flagged in audit):
- Lines 99-108 + 124-127: variables interpolated into `parse_json` without `| json` filter. Security violation.

**Suggested rewrite for "Forms" section:**

> "A form is a YAML+Liquid file under `modules/{module}/public/forms/{path}/{name}.liquid` with two halves: front matter declaring the form schema, and a `callback_actions:` Liquid block running on successful submission.
>
> **Front matter fields:** `name`, `resource` (target table or 'User'), `resource_owner` (`anyone` or a permission rule), `flash_alert`, `flash_notice`, `redirect_to` (slug to redirect to on success), and `fields:` (per-field validators).
>
> **Validation in `fields.{name}.validation`:** the form framework runs `presence`, `email`, `unique`, `length` validators before the callback. Failed validation re-renders the form page with `flash_alert`.
>
> **Callback in `callback_actions:`:** Liquid block that runs after validation passes. Use `parse_json` to shape data, `{% graphql %}` for mutations, and `{% function %}` to invoke shared CRM controllers (`crm/controller/contacts/update`, `crm/controller/addresses/create`).
>
> **Security:** every variable interpolated into a `parse_json` block must be piped through `| json`. Without it, JSON injection is possible — see [pipe-vars-through-json-filter rule](../rules/commands.md).
>
> **HTML forms in pages/partials:** use plain `<form action='/{form-name}' method='post'>` plus `{% render 'modules/insites_core/authenticity_token' %}`. Do not use the deprecated `{% form %}` tag (audit found 4 violations in canonical repos)."

---

## 7. GraphQL anatomy

Real `app-portal` GraphQL file (`modules/portal/public/graphql/account/get_current_user.graphql`):

```graphql
query get_current_user {
  current_user {
    id
    first_name
    last_name
    name
    email
    external_id

    crm_contact: profiles(
      profile_type: "modules/insites_core/crm_contact"
    ) {
      id
      company_uuid: property(name: "company_uuid")
      mobile_phone_number: property(name: "mobile_phone_number")
      mobile_phone_country_code: property(name: "mobile_phone_country_code")
      crm_company: related_record(
        table: "modules/insites_core/crm_company"
        join_on_property: "company_uuid"
        foreign_property: "uuid"
      ) {
        uuid: property(name: "uuid")
        company_name: property(name: "company_name")
      }
    }

    portal: profiles(
      profile_type: "modules/portal/portal"
    ) {
      is_enabled: property_boolean(name: "is_enabled")
      primary_account_holder: property_boolean(name: "primary_account_holder")
    }
  }
}
```

**Patterns:**
1. **`profiles(profile_type: "modules/{module}/{type}")`** — the canonical way to access user-attached records (CRM contact, portal profile, etc.). The existing skill doesn't document this; it's the foundational pattern for all user-scoped data.
2. **`property(name: "...")`, `property_boolean(name: "...")`, `property_int(name: "...")`** — typed property accessors. Already grounded in the audit (R-25).
3. **`related_record(table: "modules/{module}/{table}", join_on_property: "...", foreign_property: "...")`** — joins. Already grounded (R-21).
4. **Aliases for results** — `crm_contact: profiles(...)`, `crm_company: related_record(...)` rename query results so the calling Liquid uses sensible names.
5. **Fully-qualified table names** — every `table:` value uses the `modules/{module}/{table}` form. Already grounded (R-15).

**Calling GraphQL from Liquid** (canonical patterns from `app-portal`):

```liquid
{% graphql data = 'modules/portal/account/get_current_user' %}
{% graphql results = "modules/portal/account/check_user_email_signup", email: email | dig: "items" %}
{% graphql get_pah_users = 'modules/portal/users/get_pah_users', args: pah_filters | dig: 'items' %}
```

Three styles in active use: positional (just the query name), named arguments (e.g. `email: email`), and `args:` (pass a whole hash). All are valid.

**Suggested rewrite for "GraphQL" section:**

> "GraphQL files live at `modules/{module}/public/graphql/{domain}/{operation}.graphql`. They're called from Liquid as `{% graphql result = 'modules/{module}/{domain}/{operation}' %}`. You can pass arguments by name (`, email: $email`) or as a hash (`, args: filters`).
>
> **User-attached records:** access via `profiles(profile_type: 'modules/{module}/{type}')`. The platform automatically joins records that have the current user's UUID set as `user_id` (or equivalent foreign key for the profile type).
>
> **Typed property accessors:** every property must be selected via `property(name: ...)` for strings, `property_int(name: ...)` for integers, `property_boolean(name: ...)` for booleans, etc. Untyped property access is not supported.
>
> **Joins:** use `related_record(table: ..., join_on_property: ..., foreign_property: ...)` for belongs-to and `related_records(...)` for has-many. Don't filter using property arrays as a substitute for a join."

---

## 8. Authorization policy anatomy

Real `app-portal` policy (`modules/portal/public/authorization_policies/is_user_logged_in.liquid`):

```liquid
---
name: is_user_logged_in
metadata: {
    auth_policy_name: "Is User Logged In"
}
---
{%  liquid
    graphql data = 'modules/portal/account/get_current_user'
    assign profile = data.current_user.portal | first

    session user_uuid = data.current_user.external_id

    if data.current_user.portal != blank
        if  profile.is_enabled == true
            echo true
        else
            echo false
        endif
    endif
%}
```

**Issue:** **this file has the same R-7 bug we flagged in `addon-ecommerce`.** When `data.current_user.portal` IS blank (user with no portal profile), the outer `if` is skipped and the policy outputs nothing — not explicit `false`. **Fix:** add an `else echo false` branch.

```liquid
{%  liquid
    graphql data = 'modules/portal/account/get_current_user'
    assign profile = data.current_user.portal | first

    if data.current_user.portal != blank
        if profile.is_enabled == true
            echo true
        else
            echo false
        endif
    else
        echo false
    endif
%}
```

This fix should land in the same PR set as the `addon-ecommerce/.../order_created_date_valid.liquid` fix (already tracked on the [e-commerce-fixes Teamwork task](https://pm.cbo.me/app/tasks/26186624)). Track this one alongside it as a related fix in `app-portal`.

**Other patterns observed:**

1. **Front matter** declares `name` and `metadata`. Some policies also add `redirect_to` (where unauthorised users go) and `flash_alert`.
2. **`session user_uuid = ...`** — assigns into the session. Auth policies double as session bootstrappers in `app-portal`.
3. **Module-prefixed paths in pages** — pages reference policies as `modules/portal/is_user_logged_in` (full module path, not just the local name).

**Suggested rewrite for "Authorization Policies" section:**

> "Policies live at `modules/{module}/public/authorization_policies/{name}.liquid` with front matter (`name`, `metadata`, optional `redirect_to`, optional `flash_alert`) and a body that evaluates a boolean.
>
> **Critical invariant:** the body MUST echo either `true` or `false` in EVERY code path. Never let a code path produce no output — that's ambiguous and may be interpreted as truthy by the auth runtime. Use early-exit patterns or always include an `else` branch.
>
> **Defensive nil handling:** check that data is present before accessing nested properties. Do not call filters or property lookups on potentially-blank GraphQL results.
>
> **Pages reference policies by full module path:** `authorization_policies: [modules/{module}/{name}]` in the page front matter."

---

## 9. API endpoint anatomy

Real `app-portal` endpoint (`modules/portal/public/views/pages/api/users/check-user-email.liquid`):

```liquid
---
slug: api/check-user-email
format: json
method: get
searchable: false
metadata: {
    page_name: "API | Users | Check User Email",
}
---
{%- assign email = context.params.email | replace: " ", "+" | default: "noemail@combinate.me" -%}
{%- graphql results = "modules/portal/account/check_user_email_signup", email: email | dig: "items" -%}

{%- assign email_check = '{}' | parse_json -%}
{%-
    liquid
    if results.total_entries > 0
        assign item = results | dig: "results" | first
        ...
        assign email_check = email_check | add_hash_key: "id", item.id
        assign email_check = email_check | add_hash_key: "has_email", true
        ...
    else
        assign email_check = email_check | add_hash_key: "has_email", false
    endif
-%}

{{ email_check }}
```

**The skill doesn't document the `api/...` page convention but it's heavily used.** API endpoints are just pages with `format: json`, `method: <verb>`, and a JSON output as the page body. The conventional location is `views/pages/api/{domain}/{operation}.liquid`.

**Suggested addition to the skill (new section "API endpoints"):**

> "API endpoints are pages with `format: json` (or `format: js` for JS endpoints) and a `method:` declaration. They live at `modules/{module}/public/views/pages/api/{domain}/{operation}.liquid`.
>
> The page body builds a hash via `parse_json` + `add_hash_key`, then outputs it. No separate route handler is needed; the page IS the handler.
>
> **Authentication** still uses `authorization_policies:` in front matter — the same way HTML pages do.
>
> **CORS / authentication for unauthenticated calls** is handled at the platform level; the page itself doesn't set headers."

---

## 10. Patterns the existing skill misses entirely

These are features used in `app-portal` that the skill doesn't document at all:

### 10.1 `api_calls/` — third-party API integrations

`app-portal/modules/portal/public/api_calls/` contains subdirectories for each external service:

```
api_calls/
├── companies/
├── contacts/
├── events/
├── google_maps/
├── orders/
├── payments/
├── stripe/
└── users/
```

Each file is a Liquid template that constructs an HTTP request to a third-party API. Auth headers come from `context.constants` or `context.exports`. These are invoked from Liquid via `{% function result = 'api_calls/{service}/{operation}' %}`.

**Suggested addition to the skill:** new section "Third-party API integrations" documenting the `api_calls/` pattern, the conventional directory grouping (one per service), the standard structure (Liquid template emitting an HTTP request via `{% api_call %}` tag), and the auth pattern (always pull keys from `context.constants` — never hardcode).

### 10.2 `crm/controller/*` shared functions

`app-portal` heavily uses `{% function result = 'crm/controller/contacts/update' %}` and similar. These appear to be platform-shared controllers (not in the `app-portal` repo itself). The skill doesn't document what's available, what each controller takes as params, or what each returns.

**Suggested addition:** new section "CRM controllers" listing the available shared `crm/controller/*` functions (contacts/update, contacts/create, addresses/update, addresses/create, etc.) with their params and return shapes. This is critical knowledge for anyone building a Combinate site that has CRM integration.

### 10.3 `user_profile_types/` schema

`app-portal/modules/portal/public/user_profile_types/` contains schema definitions for custom user-attached profiles (e.g. "portal profile" with `is_enabled`, `primary_account_holder`). The skill mentions profiles in passing but doesn't explain how to define one.

**Suggested addition:** new section "User profile types" covering the `user_profile_types/` directory, the schema format, how a profile gets attached to a user record, and how to query it via `profiles(profile_type: ...)` in GraphQL.

### 10.4 `assign data = form | json` pattern in callbacks

`form | json` is widely used in form callbacks (e.g. `forms/account/my_details.liquid:91`) but the skill doesn't document it. It serialises the entire form state for inspection or passing to downstream functions.

### 10.5 Stripe integration

`app-portal` has a complete Stripe integration spanning `api_calls/stripe/`, `views/partials/stripe/`, `forms/pay_bills/`, and `views/pages/api/stripe/cards/{post,delete,put}.liquid`. None of this multi-step flow is documented in the skill but it's the canonical reference for any Combinate project doing payments.

**Suggested addition:** new section "Payments — Stripe integration pattern" walking through the multi-step flow: card creation (POST endpoint → `api_calls/stripe/customers/post`), card listing (GraphQL via `credit_cards/get_selected_credit_card`), payment submission (form → `payments/checkout_payment_paybill`), and webhook handling.

### 10.6 Inline conditional redirects

Pages frequently include patterns like `{%- if context.current_user -%}{%- redirect_to '/overview' -%}{%- endif -%}` directly in the page body. The skill documents `redirect_to` but not this conditional pattern, which is the standard way to handle "already-logged-in" redirects on sign-in / sign-up pages.

---

## 11. Rules from the v0 audit needing Ezekiel's attention

Each entry below points to a specific rule in [`v0-conflicts.md`](v0-conflicts.md) and groups them by the action needed.

### 11.1 Rules to drop or rewrite (inherited artefacts)

These rules came from the general documentation the early content was generated from and don't reflect Combinate practice. Drop the originals; the engine ships the rewrites listed in [`logic-engine/rules/`](../rules/).

| Original rule | Action | Replaced by |
|---|---|---|
| pages-no-html (R-1) | DROP | [pages-prefer-partials-for-shared-html](../rules/pages.md) |
| graphql-not-in-partials (R-2) | DROP | [graphql-in-partials-restricted](../rules/partials.md) |
| modules-never-install (R-8) | DROP | [modules-always-present](../rules/modules.md) |
| never-edit-modules-folder (R-17) | DROP | [modules-always-present](../rules/modules.md) |

### 11.2 Rules that need nuance for Combinate practice

| Rule | Why nuance | Suggested action |
|---|---|---|
| commands-build-check-execute (R-4) | Only 1 of 438 real files follows the pattern; form `callback_actions` is the actual canonical place | Tag `aspirational: true` in the rule; document `callback_actions` as the *current* canonical pattern; build → check → execute is the future direction for extracted reusable commands |
| validate-input-in-check-stage (R-10) | Form framework's `fields.*.validation` does most validation; explicit CHECK only needed for non-form input | Already nuanced in [commands.md](../rules/commands.md) — accept as-is |
| extract-reusable-validations (R-16) | Module-level extraction is the norm, not project-root | Already nuanced in [commands.md](../rules/commands.md) — accept as-is |
| events-via-background-tag (R-23) | Zero `{% background %}` usage in 438 files | Tag `aspirational: true` or drop; clarify whether this is current/future/different-codebase |
| run-cli-audit-before-deploy (R-20) | No CI evidence in any reference repo | Move out of the engine corpus into a contributing guide; it's a process rule, not a code rule |

### 11.3 Rules that need a canonical-repo fix first (pre-ship action)

These rules are correct in spirit but the canonical repos themselves violate them. Fix the violations before the engine ships these rules at `error` severity, or the engine flags the canonical examples on day one.

| Rule | File(s) needing fix | Tracking |
|---|---|---|
| forms-no-form-tag (R-5) | 4 files in `app-portal`, `app-seedling`, `addon-ecommerce` | One PR per repo (3 total) |
| auth-policy-explicit-true-false (R-7) | `addon-ecommerce/.../order_created_date_valid.liquid:14-16` AND **`app-portal/.../is_user_logged_in.liquid:13-19`** (newly identified during this skill review) | [e-commerce-fixes task](https://pm.cbo.me/app/tasks/26186624) covers ecommerce; new app-portal fix needs adding to the same task or a parallel one |
| pipe-vars-through-json-filter (R-11) | 5+ files across `app-portal` and `addon-ecommerce` | [e-commerce-fixes task](https://pm.cbo.me/app/tasks/26186624) covers ecommerce; `app-portal/.../my_details.liquid:99-127` covered separately |
| use-context-constants-for-secrets (R-18) | 1 hardcoded Statsig key in `app-portal/.../technical_foot.liquid:19` | Standalone fix |
| auth-policies-handle-nil (R-12) | `addon-ecommerce/.../order_created_date_valid.liquid` | [e-commerce-fixes task](https://pm.cbo.me/app/tasks/26186624) |

---

## 12. Migration path — recommended sequence of follow-up PRs

Each item is a small, reviewable PR Ezekiel can ship one at a time. Order is important: foundational sections (layout) before downstream sections (anatomies); rule deletions before rule rewrites.

| Step | PR title | Touches |
|---|---|---|
| 1 | `skills: fix project layout — modules-based structure` | `SKILL.md` Project Structure section + `references/project-structure.md` (new) |
| 2 | `skills: drop inherited rules superseded by audit` | Remove R-1 (pages-no-html), R-2 (graphql-not-in-partials), R-8 (modules-never-install), R-17 (never-edit-modules-folder) from any rule lists in skills |
| 3 | `skills: rewrite Pages section based on app-portal anatomy` | `SKILL.md` Pages section + `references/pages/*.md` |
| 4 | `skills: rewrite Partials section + clarify render/include` | `SKILL.md` Partials section + `references/partials/*.md` |
| 5 | `skills: rewrite Forms section — fields validation + callback_actions` | `SKILL.md` Forms section + `references/forms/*.md` |
| 6 | `skills: rewrite GraphQL section — profiles + property accessors + joins` | `SKILL.md` GraphQL section + `references/graphql/*.md` |
| 7 | `skills: rewrite Authorization section — explicit true/false invariant` | `SKILL.md` Authorization section + `references/authorization_policies/*.md` |
| 8 | `skills: add API endpoints section` | New `references/api-endpoints/*.md` |
| 9 | `skills: add api_calls section` | New `references/api-calls/*.md` |
| 10 | `skills: add CRM controllers section` | New `references/crm-controllers/*.md` |
| 11 | `skills: add User profile types section` | New `references/user-profile-types/*.md` |
| 12 | `skills: add Stripe / payments integration walkthrough` | New `references/payments/*.md` |
| 13 | `skills: tag aspirational rules (commands, events, audit-process)` | `SKILL.md` decision trees |

PRs 1, 2, 3 are the foundation — once those land, the rest are independent and can ship in any order.

---

## 13. Verification

For each rewrite PR, the verification is the same: read the relevant section of `app-portal` (the file:line references throughout this document), confirm the new skill content matches what's there, and add new file:line citations as evidence under the rule frontmatter or in the skill body.

The audit scripts in [`logic-engine/audit/`](.) can be re-run against new skill claims at any time — the output stays in the same conflict-report format.

---

## Open questions for Ezekiel

1. **Build → check → execute Command pattern (R-4):** is this current standard, future direction, or applied to a different codebase? The fact that 1 of 438 real files follows it tells us the answer is "not current" but doesn't tell us what to communicate to the team.
2. **Events / `{% background %}` (R-23):** zero usage in any reference repo. Is this a feature the platform has but the team hasn't adopted, or a feature that doesn't exist on Combinate's tier of Insites?
3. **`crm/controller/*` functions:** where's the canonical reference? `app-portal` calls them but the skill doesn't list them — they must live in the `module-crm` source. Should I dive into that codebase next to enumerate them, or is there an existing reference I missed?
4. **Audit ownership:** for follow-up rule additions, should `app-portal` continue to be the single source of truth, or should we sample across multiple production projects (Combinate's other clients) to spot common patterns?
