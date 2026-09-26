# Changelog

All notable changes to the Insites Logic Engine will be documented in this file.

## [1.2.0] - 2026-09-26

### New Feature

- **API endpoint rules with validators** (`logic-engine/rules/api-endpoints.md`). Three rules, each with a validator in `engine/src/validators.ts` and two-sided tests: `api-pages-declare-a-guard` (every page under `views/pages/api/` declares a policy, calls a guard function, or states in a `public endpoint:` comment why it is public), `api-slug-no-format-extension` (no `.json` in a slug; use `format: json`), and `api-no-credentials-in-url` (no credential as a slug segment or a GET query parameter). Evidence is a census of all 1,368 API pages in the 14 IIA module default branches (`audit/api-endpoints-2026-09.md`), and the guard validator flags exactly the pages that census classes as unguarded.

### Bug Fix

- **`context.headers` is keyed the CGI way, and bracket reads by HTTP name return blank.** A header's name is uppercased, hyphens become underscores, and `HTTP_` is prefixed (`X-Api-Key` → `HTTP_X_API_KEY`). The references documented `context.headers['User-Agent']` as case-insensitive in 22 places across 7 files, including the Stripe webhook example; every one of those reads returns blank. Measured on two instances with a read-only probe. All examples now use the dot form, and the rule is stated once in `liquid/objects/README.md`.
- **The endpoint examples named a policy that does not exist.** `api-endpoints/README.md` and `crm-controllers/README.md` used `is_api_authenticated`, which no module ships. They now use `modules/insites_core/has_valid_instance_api_authorization`.
- **Endpoint auth documented as it ships.** The CRM V2 endpoints moved from a front-matter policy to an inline `api_key_guard` function in May 2026 (TW#26083226), because a failed policy answers with a 302 redirect rather than a 401. `api/authentication.md`, `api/calling-from-liquid.md`, `api-endpoints/README.md` and `building-on-insites/04-authorization.md` now describe both guards and how each fails.
- **`auth-policy-explicit-true-false` states what was measured.** Whitespace around `true` is trimmed, and blank output currently fails closed. The rule stands, and now records that 12 of 31 module policy files rely on blank meaning deny.

## [1.1.1] - 2026-08-25

### New Feature

- **Building on an instance — external-builder track** (`skills/insites/references/building-on-insites/`). The controller-layer documentation pack an agency needs to build on a hosted instance unaided: a README and six mechanism pages (two APIs / two credentials, calling a controller, pages, authorization, storing data, errors and silent failures), a curated `llms.txt`, a paste-in `AGENTS.md`, the 225-alias inventory, and a full `crm/controller/contacts/list` contract. Routed from `SKILL.md` via a dedicated decision tree and Categories Index entry. Every code example is verified against a live instance.
- **Controller contract specification** (`building-on-insites/reference/controller-contract-spec.md`). Defines the machine-readable contract (stability, `safe_in_function`, HTTP twin, returns, errors, silent failures) carried on each endpoint's doc-data partial and rendered into the instance's API docs.
- **Testing reference** (`skills/insites/references/testing/`). How to write `insites_test` Liquid tests and run them with `insites-cli test run`: the file-naming and `contract` rules that prevent silent passes, where module tests live (private = CLI-only), the assertion catalogue, `--isolate`/CI gating, and troubleshooting. Cross-linked from the CLI reference.
- **Repo tooling** (`tools/`). `generate-alias-inventory.mjs` rebuilds the controller-alias inventory from local module checkouts; `lint-controller-contracts.mjs` validates contract front matter and catches doc references to aliases no partial declares. Both read module repos, never modify them.

### Bug Fix

- **Controller contract source corrected.** The initial design stored the contract in controller front matter and read it via `admin_liquid_partials` — which returns only `public/` partials, so a private controller's contract could never be read and the docs would silently render nothing. The specification now carries the contract on the endpoint's doc-data partial, read the same way the docs already read every per-endpoint field.
- **Documented the custom-field write-side silent failure.** A parsed-object value on a `geojson`-typed custom-field key returns HTTP 200 with the whole `custom_field` block null — valid sibling keys included. Added to the silent-failures page with its verified mechanism and the read-back-after-write defense.

## [1.1.0] - 2026-05-06

### New Feature

- **`@insites/logic-engine` npm package** — new TypeScript library that loads the rule and decision corpus, evaluates `when`/`then` decisions, renders scaffold templates, and exposes an MCP-server entry point.
- **Versioned rule + decision corpus** — markdown rule files plus JSON decision files for module detection, feature-pattern recognition, and scaffolding, used by the engine and by AI tooling.
- **API endpoints reference** — building inbound JSON endpoints under the V2 surface (`api/_external/v2/<resource>/<action>.json.liquid`), with auth, method, status-code, error, and pagination conventions.
- **CRM controllers reference** — controllers that conform to the CRM module's V2 surface using the `path:` front-matter alias.
- **User profile types reference** — schema location, GraphQL read via `related_record` + property accessors, write via `record_create`/`record_update`, multi-profile users.
- **Payments reference** — Stripe integration assembled from `api_calls/`, `constants/`, and form `callback_actions`. Worked Checkout Session example and webhook receiver shape.
- **CRM module reference** — V2 REST endpoints, custom and system fields, webhook coverage, tasks, activities, attachments, event streams, and a field-by-field schema reference.
- **CMS module reference** — covers 10 object types (Pages, Layouts, Partials, Web Files, Globals, Collections, Emails, SMS, Authorization Policies), file-based stance, IIA admin paths, and override patterns.
- **Data module reference** — V2 endpoints for user-defined databases, schema discovery, bulk-loop patterns, and an IIA configuration walkthrough.
- **GraphQL profile queries** — new section explaining how `user_profile_types/` schemas are queried via `related_record` + property accessors, with multi-profile-type users called out explicitly.

### Improvement

- **Repository renamed** `insites-ai-tools` → `insites-logic-engine` to align with the npm package identifier `@insites/logic-engine`. Install URLs and the GitHub repository updated; the previous URLs remain redirected for a transition period.
- **README rewritten** around the two deliverables: `skills/insites/` for AI-tool consumption (Claude Code, OpenCode, Cursor) and `engine/` + `logic-engine/` for programmatic tooling.
- **Modules-based project layout** documented as the canonical structure: `modules/<name>/public/{views,forms,graphql,authorization_policies,api_calls,schema,user_profile_types,emails,migrations,assets}/`. New `project-structure.md` reference covers per-directory purpose, naming conventions, and module-prefixed render/include/graphql paths.
- **State changes via form `callback_actions`** — form definitions at `modules/<name>/public/forms/<name>.liquid` are documented as the canonical pattern for create/update/delete operations: YAML schema for field declarations and per-field validation, a Liquid `callback_actions` block for GraphQL mutations and side effects. Worked `update_password` example covering `form_set_error` / `form_set_field_error` / `form.errors`.
- **Pages-as-controllers rule calibrated** — small page-specific markup, JSON-page bodies, and short redirect/error pages may live inline; reusable markup belongs in partials, with ~10 lines of HTML as the extract-it threshold.
- **Data-fetching boundary** — pages own GraphQL calls for new code; partials receive their data through render arguments.
- **CLI reference rewritten** against the actual `insites-cli help` output (see also Bug Fix below).

### Bug Fix

- **Authorization policy output invariant** — corrected the truthy/falsy framing. Policies are not Liquid `return true/false` controllers; the platform compares the file's *output* as a string against the literal `"true"`. Canonical examples now use single-line `{%- ... -%}` whitespace-trimmed Liquid that emits exactly `true` or `false`. Three concrete failure modes documented: trailing newline, returning a Liquid truthy object, and policy-name typos.
- **Logic Engine corpus loading** — discriminated-union schema for decision kinds so every module-detection decision is loaded and validated correctly. Added a `prepack` script that bundles the corpus into the published npm package, plus regex tightening on partial-resolution rules. 23/23 tests passing.
- **CLI reference accuracy** — the CLI command reference contained 8 inaccurate command signatures, 1 invented command, and 6 missing real commands. Rewritten against the actual `insites-cli help` output.
- **26 broken markdown links** across the skill repaired in a single sweep. Post-fix scan: 0 broken across 812 relative links in 201 files.
- **Modules install messaging** — replaced misleading "`insites-cli modules install` is not yet available" copy with accurate prose: modules are preinstalled per Insites instance and updated through the Insites console; there is no CLI command to install or uninstall modules.
- **Install URL branch reference** — install scripts pointed at `master`, but the repository's default branch is `main`. Corrected to `main` everywhere so install commands work.

## [1.0.0] - 2026-03-19

### What is this?

Insites AI Tools is a skill documentation package that teaches LLMs (Claude, GPT, etc.) how to write correct code for the Insites platform. When installed, AI assistants can help developers build pages, query data, create commands, handle authentication, deploy code, and follow Insites coding conventions — without hallucinating unsupported features.

### Key Features

- **Liquid Templating** — Complete reference for Insites-specific tags (`graphql`, `function`, `render`, `background`, `cache`, `session`, `sign_in`, etc.), filters, objects, and coding standards including whitespace stripping guidance
- **GraphQL Data Layer** — Queries, mutations, property accessors, relationships (`related_record` / `related_records`), filtering, sorting, and pagination patterns
- **Command Pattern** — Build → Check → Execute workflow with inline validation, contract-based error accumulation, and 16 documented validation patterns (presence, uniqueness, number, email, length, format, date, and more)
- **Authentication & Authorization** — `authorization_policies/` for page guards, `context.current_user` for user access, role-based permission checking, sign-in/sign-out flows
- **Routing** — File-based routing with dynamic parameters, content-type mapping, HTTP method handling, and slug configuration
- **Schema & Migrations** — YAML schema definitions, property types, relationship conventions, migration lifecycle, and deployment
- **Events & Background Jobs** — Asynchronous event consumers, background job dispatch with `{% background %}` tag, priority and retry configuration
- **Sessions, Caching, Flash Messages** — Native session management via `context.session`, cache tag patterns, flash message flows with redirect
- **Module Development** — `public/` vs `private/` path conventions for building reusable modules
- **Code Refactoring Guide** — When and how to extract reusable partials (validations, execute helpers, UI components, authorization policies) with before/after examples
- **CLI Reference** — All `insites-cli` commands (`audit`, `deploy`, `sync`, `logsv2`, `env add`, `gui serve`, `migrations`, `modules`, `data`) with correct syntax and status notices on under-development commands
- **Decision Trees** — Deterministic routing from any developer request to the correct reference docs
