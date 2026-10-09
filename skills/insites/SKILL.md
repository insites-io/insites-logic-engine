---
name: insites
description: Consolidated skill for building on the Insites platform. Use decision trees below to find the right component, then load detailed references.
---

# Critical rules

Follow these rules as written. Where they say "never" or "must", treat that literally — those constraints exist to prevent specific real failures (Liquid syntax errors, security holes, audit failures). Conventions described in plain prose elsewhere in this document are guidance, not absolutes; use judgement.

## 1. Source of truth

- The references in this document are the source of truth for Insites conventions.
- Don't invent undocumented behaviors, APIs, configurations, Liquid tags/filters, or directory structures. If you can't find it documented, ask rather than guess.
- The GraphQL schema is strict and closed — custom GraphQL types are not creatable.
- When uncertain, consult the reference file rather than improvising.

## 2. Pre-flight validation

After every file change, run the audit and fix what it reports:

```bash
insites-cli audit
```

It reads `app/` and `modules/`, prints `[Audit] N rules detected issues.`, and lists the files for each. It takes no arguments. It exits 0 even when a rule fires, so read the count, not the exit code. `insites-cli deploy` runs the same audit first (unless `CI=true`) and deploys anyway. What it checks (CLI 5.10.2):

- **Deprecated tags and filters.** A fixed list of retired Liquid tags (`form_tag`, `input`, `query_graph` and others) and filters (`to_money`, `timeago` and others).
- **Deprecated keys.** `enable_profiler: true` in a page, `[]` after an input name, `resource_id:` on `include_form`, `configuration:` in a form, `attribute_type:` and `custom_attributes:` in a profile or model type, `headers:` in an API call (use `request_headers`), and model names that are not snake_case.
- **File types per folder.** Only `.liquid` in `forms`, `authorization_policies`, `emails`, `smses`, `api_calls` and `notifications`; only `.yml` in `user_profile_types` and `model_schemas`; only `.graphql` in `graphql`.
- **Partial name clashes.** A partial and an underscore twin at the same path (`card.liquid` and `_card.liquid`).
- **File names.** Characters outside letters, digits, spaces and `- _ ~ @ % + . / \ ( ) ' & ]`.
- **Partials never included.** It counts `include` and `function` calls only, so a partial used only through `render` is listed. It skips this check when any `include` or `function` takes a variable, which includes every `{% function result = '...' %}`.

It does not check Liquid syntax, GraphQL, page front matter, HTML in pages, or credentials. See `references/cli/api.md`.

**Conventions (not checked by the audit).** The Logic Engine rules in `logic-engine/rules/` hold these:

- Partial file names have no leading underscore (`partials-no-underscore-prefix`).
- Each page declares one HTTP method (`pages-one-http-method`).
- HTML reused across pages, or built from several UI blocks, goes in partials. A simple page can keep its own HTML (`pages-prefer-partials-for-shared-html`).
- Presentation partials (cards, headers, layouts, nav) do not call `{% graphql %}`. Block, calculation and callback partials may, and a reusable query goes in a partial called with `{% function %}` (`graphql-in-partials-restricted`). This is a convention: the platform runs `{% graphql %}` inside a partial.
- Secrets come from `context.constants`, never from the template (`use-context-constants-for-secrets`).

User-facing text can be written in the template or kept in translations. See **Translation Filter** in `references/liquid/filters/README.md`.

## 3. Decision trees

The decision trees below map common developer questions to the relevant reference doc. Walk through the matching tree before writing code so you load the right reference.

---

### "I'm building ON an instance from outside — agency / external builder track"

```
Building on a hosted instance (not developing a module in this repo)?
├─ Start here — what an instance is, the four traps, build order → building-on-insites/README.md
├─ Which API + which credential (instance key vs Console CLI token) → building-on-insites/01-two-apis-two-credentials.md
├─ Call module logic from Liquid ({% function %}, aliases)          → building-on-insites/02-calling-a-controller.md
│    └─ Deep in-Liquid reference (auth context, arg passing)        → api/calling-from-liquid.md
├─ Create/update pages via admin GraphQL                            → building-on-insites/03-pages.md
├─ Lock a page down (controller calls bypass endpoint policies)     → building-on-insites/04-authorization.md
├─ Store data (check what modules already store first)              → building-on-insites/05-storing-data.md
├─ Handle errors + the silent failures that return 200              → building-on-insites/06-errors-and-silent-failures.md
├─ Look up a controller alias (all 225, by module)                  → building-on-insites/reference/alias-inventory.md
└─ Full controller contract example (crm/controller/contacts/list)  → building-on-insites/reference/crm-contacts-list.md
```

### "I need to build a page/endpoint"

```
Need a page or endpoint?
├─ HTML page with data → pages/ + partials/ + graphql/
├─ JSON API endpoint → pages/ (with .json.liquid extension)
├─ JavaScript endpoint → pages/ (with .js.liquid extension)
├─ Form submission handler → pages/ (method: post) + forms/
├─ File download/redirect → pages/ + routing/
├─ Admin-only page → pages/ + authentication/ (page front-matter `authorization_policies:`)
├─ Layout wrapper → layouts/
└─ Reusable UI component → partials/
```

### "I need to work with data"

```
Need data operations?
├─ Define a data model/table → schema/
├─ Query records (list/search/filter) → graphql/ (records query)
├─ Query single record by ID → graphql/ (records query with id filter)
├─ Create a record → graphql/ (record_create mutation), called from forms/ callback_actions
├─ Update a record → graphql/ (record_update mutation), called from forms/ callback_actions
├─ Delete a record → graphql/ (record_delete mutation), called from forms/ callback_actions
├─ Related records (belongs-to/has-many) → graphql/ (related_record/related_records)
├─ Paginate results → graphql/ (page/per_page args)
├─ Upload files → schema/ (upload type) + forms/
├─ Seed/migrate data → migrations/
├─ Bulk import/export → migrations/ or insites-cli data commands
├─ Access existing Postgres/ES/Redis → graphql/ (all DB access via GraphQL only)
├─ Contacts / companies / tasks / activities → modules/crm/ (V2 REST API; see "I need CRM data" tree below)
└─ Events, products and orders, locations, pipelines, assets, forms, profiles → see "I need another module's data" tree below
```

### "I need CRM data (contacts, companies, tasks, activities, attachments)"

```
Need CRM operations?
├─ Start here (overview, audience routing)         → modules/crm/README.md
├─ Look up V2 REST endpoints, conventions, errors  → modules/crm/api.md
├─ Look up field-by-field schema (types, required, IIA columns) → modules/crm/schema.md
├─ Worked HTTP examples for common flows           → modules/crm/patterns.md
├─ API edges and quirks (no Bearer prefix, etc.)   → modules/crm/gotchas.md
├─ Configure custom fields / system fields / webhooks in IIA → modules/crm/configuration.md
├─ Override email layouts, hook into webhooks      → modules/crm/advanced.md
│
├─ Contacts (CRUD + addresses + personal info + profiles + relationships) → modules/crm/api.md (Contacts)
├─ Companies (CRUD + addresses + info + relationships + assign-contacts)  → modules/crm/api.md (Companies)
├─ Custom fields (definitions in IIA, values via API)                     → modules/crm/configuration.md + api.md (Custom fields)
├─ System fields (contact type, lead source, industry, etc.)              → modules/crm/api.md (System fields) + configuration.md
│
├─ Tasks (CRUD + complete/open lifecycle) + task comments                 → modules/crm/globals/tasks.md
├─ Activities (calls, meetings, notes — attached to a feature)            → modules/crm/globals/activities.md
├─ File attachments (two-step S3 direct-upload flow)                      → modules/crm/globals/attachments.md
├─ Event streams (audit / activity feed, append-only)                     → modules/crm/globals/event_streams.md
│
├─ Auth (instance API key, no Bearer prefix)                              → references/api/authentication.md
└─ Pipelines / stages / opportunities → modules/pipelines/ (its own V2 API; see "I need another module's data")
```

### "I need CMS-managed content (pages, layouts, partials, globals, emails, …)"

```
Need CMS operations?
├─ Start here (overview, file-based stance)               → modules/cms/README.md
├─ Look up object-type field shapes / front-matter        → modules/cms/metadata.md
├─ Liquid-side consumption examples                       → modules/cms/patterns.md
├─ API edges / partial-alias quirks / overrides           → modules/cms/gotchas.md
├─ IIA admin walkthrough per object type                  → modules/cms/configuration.md
├─ Override layouts/partials, hook_module_info             → modules/cms/advanced.md
│
├─ Pages (URL-addressable controllers)                    → modules/cms/metadata.md (Pages)
├─ Layouts (HTML scaffold wrappers)                       → modules/cms/metadata.md (Layouts)
├─ Partials (reusable HTML snippets, alias paths)         → modules/cms/metadata.md (Partials)
├─ Web Files (static .js/.css/.html assets)               → modules/cms/metadata.md (Web Files)
├─ Global Content (company-wide settings record)          → modules/cms/metadata.md (Global Content)
├─ Collections (data-backed listing views)                → modules/cms/metadata.md (Collections)
├─ Emails / SMS (templates)                               → modules/cms/metadata.md (Emails/SMS)
└─ Authorization Policies (page-gating rules)             → modules/cms/metadata.md (Authorization Policies)
```

### "I need another module's data (events, ecommerce, locator, pipelines, assets, forms, permissions, API)"

Every module below has the same six pages: `README.md` (surface at a glance, auth, webhooks),
`api.md` (every endpoint), `configuration.md` (admin setup, migrations), `patterns.md`
(curl and `{% function %}` examples), `gotchas.md`, `advanced.md` (hooks, cross-module
dependencies). All written from the v6 module source on 9 October 2026.

```
Which module?
├─ Events, venues, tickets, speakers, sponsors, expenses, FAQs → modules/events/      (35 V2 endpoints, 37 aliases, 3 webhooks)
├─ Products, variants, categories, carts, orders, quotes, payments → modules/ecommerce/ (109 V2 endpoints, 105 aliases, 4 webhooks)
├─ Locations, categories, enquiries, opening hours             → modules/locator/     (22 V2 endpoints, 23 aliases, no webhooks)
├─ Pipelines, stages, opportunities, related contacts          → modules/pipelines/   (25 V2 endpoints, 107 aliases, 6 webhook events)
├─ Uploaded assets, folders, upload credentials                → modules/assets/      (8 V2 endpoints, 7 aliases; platform filters are in assets/)
├─ Custom API endpoints, policies, the instance's API docs     → modules/api/         (5 aliases; how /admin/api is rendered)
├─ Form builder, submissions, public upload routes             → modules/forms/       (20 admin endpoints, no aliases; HTML forms are in forms/)
├─ User profile schemas ("permissions")                        → modules/permissions/ (12 admin endpoints, no aliases, no RBAC)
├─ Shared admin UI assets (components.insites.io)              → modules/general/README.md (not an instance module)
└─ MCP server that wraps the CRM API                           → modules/ai/README.md      (not an instance module)
```

Before calling any alias, check `references/building-on-insites/reference/alias-inventory.md`,
and read `02-calling-a-controller.md` for the response-handler and long-form-alias traps.

### "I need user-definable data tables (databases + items)"

```
Need data operations against user-defined databases?
├─ Start here (overview, V2-first)                        → modules/data/README.md
├─ Look up V2 REST endpoints, conventions, item schema    → modules/data/api.md
├─ Worked HTTP examples (CRUD, pagination, schema lookup) → modules/data/patterns.md
├─ API edges (URL prefix, PUT-not-PATCH, no UUIDs, etc.)  → modules/data/gotchas.md
├─ Create / configure databases + columns in IIA          → modules/data/configuration.md
│
├─ Read database list / one database (read-only via API)  → modules/data/api.md (Databases)
├─ CRUD database items                                    → modules/data/api.md (Database items)
├─ Discover a database's column schema                    → modules/data/patterns.md (#1)
├─ Bulk import — loop pattern (no native bulk endpoint)   → modules/data/patterns.md (#6)
│
├─ Auth (instance API key, no Bearer)                     → references/api/authentication.md
└─ Webhooks — NONE on data module (audit-confirmed)
```

### "I need business logic"

```
Need business logic?
├─ Encapsulate a create/update/delete operation → forms/ (callback_actions block)
├─ Validate user input → forms/ (YAML `validation:` blocks for fields; cross-field checks in callback_actions)
├─ Run code asynchronously → background-jobs/
├─ Run code on a schedule → background-jobs/ (with delay)
└─ Send email after an action → forms/ (callback_actions invoke email partial) + emails-sms/
```

### "I need authentication & authorization"

```
Need auth?
├─ Get current user → authentication/ (context.current_user + GraphQL)
├─ Check if user can do something → authentication/ (authorization_policies + inline guard patterns)
├─ Block unauthorized access (403) → authentication/ (page front-matter `authorization_policies:`)
├─ Redirect if not permitted → authentication/ (inline unless/redirect_to, or a policy's own `redirect_to`)
├─ Sign in a user → authentication/ (sign_in tag)
├─ Define a custom authorization policy → authentication/ (file at `app/authorization_policies/<name>.liquid` referenced from page front matter)
├─ OAuth2/social login → authentication/
├─ CSRF protection → forms/ (authenticity_token)
└─ Spam protection (reCAPTCHA/hCaptcha) → forms/ (spam_protection tag)
```

### "I need Liquid templating"

```
Need Liquid help?
├─ Insites-specific tags → liquid/tags/
│   ├─ Execute GraphQL → graphql tag
│   ├─ Call partial as function → function tag
│   ├─ Render a partial → render tag
│   ├─ Build a hash or array → assign literal (parse_json is deprecated for JSON written in the template)
│   ├─ Redirect user → redirect_to tag
│   ├─ Set session data → session tag
│   ├─ Log for debugging → log tag
│   ├─ Cache output → cache tag
│   ├─ Run code in background → background tag
│   ├─ Database transactions → transaction tag
│   ├─ Error handling → try/catch tag
│   ├─ Export variables → export tag
│   ├─ Set response headers/status → response_headers/response_status tags
│   ├─ Sign in user → sign_in tag
│   └─ Spam protection → spam_protection tag
├─ Filters (data transformation) → liquid/filters/
│   ├─ Array operations → array_* filters
│   ├─ Hash/object operations → hash_* filters
│   ├─ Date/time operations → add_to_time, localize, strftime, to_time, etc.
│   ├─ String operations → parameterize, slugify, titleize, humanize, etc.
│   ├─ JSON/encoding → json, parse_json, base64_encode/decode, etc.
│   ├─ Validation → is_email_valid, is_json_valid, matches, etc.
│   ├─ Currency/pricing → pricify, pricify_cents, amount_to_fractional, etc.
│   ├─ Cryptography → encrypt, decrypt, digest, compute_hmac, jwt_encode/decode
│   ├─ Translation → t (translate), t_escape; files in app/translations/<locale>.yml (see Translation Filter in liquid/filters/README.md)
│   └─ Assets → asset_url, asset_path
├─ Objects (global data) → liquid/objects/
│   ├─ context.params → HTTP parameters
│   ├─ context.session → session storage
│   ├─ context.location → URL info
│   ├─ context.current_user → user data
│   ├─ context.constants → secrets/config
│   ├─ context.environment → staging/production
│   ├─ context.exports → exported partial variables
│   ├─ context.headers → HTTP request headers
│   └─ forloop/tablerowloop → iteration helpers
├─ Types → liquid/types/
├─ Variables (assign, capture) → liquid/variables/
├─ Flow control (if/elsif/else/unless/case) → liquid/flow-control/
└─ Loops (for, cycle, tablerow) → liquid/loops/
```

### "I need to handle forms"

```
Need forms?
├─ HTML form with CSRF → forms/ (use <form> tag, NOT {% form %})
├─ File upload → forms/ (upload field type) + modules/cms/metadata.md (Web Files / Attachments)
├─ Form validation → forms/ (YAML `validation:` blocks; cross-field checks in callback_actions)
├─ Display validation errors → partials/ (render errors from form result)
├─ Multi-step form → pages/ + sessions/
├─ AJAX form submission → forms/ + pages/ (.json.liquid endpoint)
└─ Spam protection → forms/ (spam_protection tag)
```

### "I need notifications"

```
Need notifications?
├─ Send email → emails-sms/ (email templates)
├─ Send SMS → emails-sms/ (SMS templates)
├─ Flash messages/toasts → flash-messages/
├─ Send async (after action) → background-jobs/ + emails-sms/
└─ Email layout/styling → layouts/ (mailer layout)
```

### "I need styling & UI"

```
Need UI/styling?
├─ View available styled components → /style-guide on your instance
├─ Layout structure → layouts/
├─ Reusable UI snippets → partials/
└─ Static assets (images, fonts, JS) → assets/
```

### "I need to integrate external services"

```
Need integrations?
├─ Call external REST API → api-calls/
├─ OAuth2 providers → authentication/ (OAuth2 flow with sign_in tag)
├─ Webhook receiver → pages/ (POST endpoint)
└─ Store API keys/secrets → constants/
```

### "I need deployment & DevOps"

```
Need deployment?
├─ Deploy to environment → deployment/ (insites-cli deploy)
├─ Watch logs → cli/ (insites-cli logs)
├─ Run Liquid/GraphQL ad-hoc → cli/ (insites-cli exec)
├─ Pull a module's code from an instance → cli/ (insites-cli modules pull)
├─ Set environment constants → constants/ (insites-cli constants set)
├─ Run migrations → migrations/
├─ Lint/validate code → cli/ (insites-cli audit)
├─ Sync files in development → cli/ (insites-cli sync)
└─ Environment configuration → configuration/
```

### "I need to test my Liquid (unit tests)"

```
Need to test a command, query, validator or partial?
├─ Write a test — a partial named <name>_test.liquid that mutates the runner's contract → testing/
├─ Run it — insites-cli test run <env> (staging/development only; deploy first)   → testing/ + cli/
├─ Gate CI — exit code, or --min-tests <n> so an empty run fails                  → testing/
└─ Assertions — equal / presence / includes / match / valid_object / type / …    → testing/
```

### "I need performance optimization"

```
Need performance?
├─ Cache page fragments → caching/ (cache tag)
├─ Run heavy work in background → background-jobs/ (background tag)
├─ Avoid N+1 queries → graphql/ (related_record/related_records)
├─ Optimize pagination → graphql/ (per_page limits)
├─ Static asset CDN → assets/ (asset_url filter)
├─ Frontend optimization → assets/ (lazy loading, code splitting)
└─ Database query optimization → graphql/ (filters, sorting)
```

## Categories Index

Use the decision trees above to identify which category applies, then load the matching reference below. Each reference directory contains: `README.md`, `configuration.md`, `api.md`, `patterns.md`, `gotchas.md`, `advanced.md`.

### Building on an Instance (external builder track)
| Category | Reference |
|----------|-----------|
| Guided track (README, credentials, controllers, pages, auth, data, errors) | `references/building-on-insites/` |
| Controller alias inventory (404 controller aliases on v6) | `references/building-on-insites/reference/alias-inventory.md` |
| Contract template (crm/controller/contacts/list) | `references/building-on-insites/reference/crm-contacts-list.md` |

### Views & Routing
| Category | Reference |
|----------|-----------|
| Pages | `references/pages/` |
| Layouts | `references/layouts/` |
| Partials | `references/partials/` |
| Routing | `references/routing/` |

### Data & Storage
| Category | Reference |
|----------|-----------|
| Schema | `references/schema/` |
| GraphQL | `references/graphql/` |
| Migrations | `references/migrations/` |

### Business Logic
| Category | Reference |
|----------|-----------|
| Forms (state-changing logic via `callback_actions`) | `references/forms/` |
| Background Jobs | `references/background-jobs/` |

### Liquid Templating
| Category | Reference |
|----------|-----------|
| Tags | `references/liquid/tags/` |
| Filters | `references/liquid/filters/` |
| Objects | `references/liquid/objects/` |
| Types | `references/liquid/types/` |
| Variables | `references/liquid/variables/` |
| Flow Control | `references/liquid/flow-control/` |
| Loops | `references/liquid/loops/` |

### Authentication & Security
| Category | Reference |
|----------|-----------|
| Authentication | `references/authentication/` |
| Forms | `references/forms/` |

### Notifications
| Category | Reference |
|----------|-----------|
| Emails & SMS | `references/emails-sms/` |
| Flash Messages | `references/flash-messages/` |

### Modules
| Category | Reference |
|----------|-----------|
| CRM (insites_crm) | `references/modules/crm/` |
| CMS (insites_cms) | `references/modules/cms/` |
| Data (insites_databases) | `references/modules/data/` |
| Events (insites_events) | `references/modules/events/` |
| Ecommerce (insites_ecommerce) | `references/modules/ecommerce/` |
| Locator (insites_locator) | `references/modules/locator/` |
| Pipelines (insites_pipeline) | `references/modules/pipelines/` |
| Assets (insites_assets) | `references/modules/assets/` |
| API (insites_api) | `references/modules/api/` |
| Forms (insites_forms) | `references/modules/forms/` |
| Permissions (insites_permissions) | `references/modules/permissions/` |
| General (shared admin UI assets, not a module) | `references/modules/general/README.md` |
| AI (MCP server, not a module) | `references/modules/ai/README.md` |
| Module Template | `references/modules/template/` |

> Copy `references/modules/template/` to create documentation for new Insites modules. Each module gets its own directory with: README.md, api.md, configuration.md, patterns.md, gotchas.md, advanced.md.

### Configuration & Infrastructure
| Category | Reference |
|----------|-----------|
| Constants | `references/constants/` |
| Configuration | `references/configuration/` |
| Assets | `references/assets/` |
| Sessions | `references/sessions/` |
| Caching | `references/caching/` |

### External Integrations
| Category | Reference |
|----------|-----------|
| API Calls (outbound HTTP) | `references/api-calls/` |
| API Endpoints (inbound, JSON) | `references/api-endpoints/` |
| CRM Controllers | `references/crm-controllers/` |
| User Profile Types | `references/user-profile-types/` |
| Payments (Stripe) | `references/payments/` |

### Developer Tools
| Category | Reference |
|----------|-----------|
| Platform changes in 2026 (what changed, what is live on Insites instances) | `references/platform-changes-2026.md` |
| CLI | `references/cli/` |
| Deployment | `references/deployment/` |
| Testing (insites_test + insites-cli) | `references/testing/` |

## Critical Architecture Rules

### 1. Pages are primarily controllers — extract reusable markup into partials
Pages fetch data via `{% graphql %}` and delegate the bulk of rendering to partials via `{% render %}`. Small amounts of page-specific inline HTML are acceptable in practice (a wrapper element, a one-off heading, the body of a `.json.liquid` page) — what's *not* acceptable is duplicating markup that other pages could reuse, or putting form/card/list markup inline. Rule of thumb: more than ~10 lines of HTML in a page → extract a partial.
→ `references/pages/`, `references/partials/`

### 2. Pages own the data they show
A page fetches what it displays and passes it to partials as render arguments, so presentation partials (cards, headers, layouts, nav) never query. Block, calculation and callback partials may call `{% graphql %}`, and a query used in more than one place goes in a partial called with `{% function %}`. This is the `graphql-in-partials-restricted` convention, not a platform limit: the platform runs `{% graphql %}` inside a partial.
→ `references/graphql/`, `references/partials/`

### 3. State changes live in form `callback_actions`
Create/update/delete operations are driven by forms. Each `forms/<name>.liquid` declares its YAML schema (fields, validation) and a Liquid `callback_actions` block that runs the GraphQL mutations and side effects when the form is submitted. There is no separate `app/lib/commands/` directory in canonical Combinate.
→ `references/forms/`

### 4. Modules are your code
The `modules/` directory is checked-in source in your repo. Every module in it is yours to edit, `public/` and `private/` alike. Insites-supplied modules (`insites_crm`, `insites_cms`, `insites_databases` and the rest) are not in your repo, so there is nothing there to edit by mistake. To change how one of them behaves, don't reach for its files — shadow it with a same-path file in your own code (first match wins) or compose around its exports with `{% render %}`, `{% function %}` and its GraphQL. See `references/modules/cms/advanced.md` for resolution order.
→ `references/modules/`

### 5. Extract reusable code (DRY)
When the same logic appears twice, extract it. Use `{% function %}` for partials that return data; use `{% render %}` for partials that produce HTML. Repeated access checks belong in a reusable `authorization_policies` file referenced from page front matter, not duplicated inline.
→ `references/partials/`

### 6. Liquid coding standards
Statements within `{% liquid %}` blocks must stay on a single line each, except that a `{ }` or `[ ]` literal argument may continue across lines until it closes (see `references/liquid/types/api.md`) — line-wrapping causes Liquid syntax errors. Variables in Insites are local to the partial; use the `export` tag to share them across renders.
→ `references/liquid/`

## Project Structure

**A project has two code trees, and both are valid. `app/` holds the site itself. `modules/<name>/` holds code you want to reuse or package.** A project can use either or both. `insites-cli sync` and `insites-cli deploy` read whichever of the two exist.

A module keeps its code under `public/` (callable from `app/` and other modules), `private/` (internal to the module), or both. Both use the same layout as `app/`.

```
project-root/
├── app/                               # The site itself
│   ├── views/
│   │   ├── pages/                     # Routed Liquid pages
│   │   ├── layouts/                   # Page wrappers
│   │   └── partials/                  # Reusable template snippets
│   ├── forms/                         # Form definitions (YAML + Liquid callback_actions)
│   ├── graphql/                       # Queries + mutations grouped by domain
│   ├── authorization_policies/
│   ├── api_calls/                     # Third-party API integrations grouped by service
│   ├── schema/                        # Database table definitions (YAML)
│   ├── user_profile_types/            # Custom user-profile schemas
│   ├── emails/                        # Email templates
│   ├── smses/                         # SMS templates
│   ├── translations/                  # One YAML file per language
│   ├── migrations/                    # Data seeding and schema migrations
│   └── assets/                        # JS/CSS/images
└── modules/                           # Code to reuse or package
    └── <module>/                      # e.g. dashboard, website, portal
        ├── public/                    # Same layout as app/
        ├── private/                   # Same layout as app/, internal to this module
        └── test/                      # Module-level tests (if any)
```

**How paths resolve.** A path with no prefix reads `app/`. A path that starts `modules/<name>/` reads that module's `public/` or `private/` tree:

| Call | `app/` | `modules/<name>/` |
|---|---|---|
| `{% render %}`, `{% function %}`, `{% include %}` | `'path/name'` → `app/views/partials/path/name.liquid` | `'modules/<name>/path/name'` → `modules/<name>/public/views/partials/path/name.liquid` or `private/views/partials/...` |
| `{% graphql %}` | `'path/name'` → `app/graphql/path/name.graphql` | `'modules/<name>/path/name'` → `modules/<name>/public/graphql/path/name.graphql` or `private/graphql/...` |
| `layout:` | `name` → `app/views/layouts/name.liquid` | `modules/<name>/name` → `modules/<name>/public/views/layouts/name.liquid` or `private/views/layouts/...` |
| `authorization_policies:` | `name` → `app/authorization_policies/name.liquid` | `modules/<name>/name` → `modules/<name>/public/authorization_policies/name.liquid` or `private/...` |

For the per-directory reference, see [`references/project-structure.md`](references/project-structure.md).

### Cross-module conventions

- **No `app/lib/commands/` directory.** State-changing logic lives inline in pages or in `forms/<name>.liquid` `callback_actions` blocks.
- **No `app/lib/queries/` directory.** GraphQL files live at `app/graphql/<domain>/<operation>.graphql` or `modules/<module>/public/graphql/<domain>/<operation>.graphql` and are called directly from pages or forms.
- **Layouts are namespaced.** E.g. `portal_default`, `portal_form`, `dashboard_default`.

## File Extension Conventions

| Extension | Content-Type | URL |
|-----------|--------------|-----|
| `*.liquid` or `*.html.liquid` | `text/html` | `/path` |
| `*.json.liquid` | `application/json` | `/path.json` |
| `*.js.liquid` | `application/javascript` | `/path.js` |

## REST CRUD Convention

| Method | Page File | GraphQL Operation |
|--------|-----------|-------------------|
| GET | index, show, new, edit | records (search/find) |
| POST | create | record_create |
| PUT | update | record_update |
| DELETE | delete | record_delete |

## Forbidden Behaviors

- Breaking long lines in `{% liquid %}` blocks (causes syntax errors)
- Inventing Liquid tags, filters, or GraphQL types not in the platform
- Using `{% form %}` tag for HTML forms (use plain `<form>` with CSRF token)
- Bypassing security (CSRF tokens, authorization)
- Direct database access outside GraphQL
- Deploying without reading the `insites-cli audit` report (it never blocks a deploy)
- Putting code outside `app/` and `modules/` (the CLI syncs and deploys nothing else)
- Hardcoding API keys or secrets (use `context.constants`)

## Documentation Links

| Resource | Where |
|----------|-----|
| Insites docs and change log | https://docs.insites.io and https://docs.insites.io/change-log |
| GraphQL schema | `references/graphql/schema/schema.json` (introspected from a live instance) |
| Liquid filters, tags, objects | `references/liquid/filters/`, `references/liquid/tags/`, `references/liquid/objects/` |
| What the platform changed this year | `references/platform-changes-2026.md` |
