# CMS — Gotchas

Edges and quirks of the CMS module that bite when authoring or consuming file-based content. Each entry: **what bites**, **why**, **how to avoid**.

---

## 1. No V2 REST API for CMS objects

**Bites:** code that tries `POST /cms/api/v2/pages` to create a page programmatically gets 404.

**Why:** CMS does not expose a V2 REST API. Object create/update happens through IIA, the platform CLI's file sync, or direct file commits — not over HTTP.

**Avoid:** if you need to author CMS objects from a script, sync files into the project tree via the platform CLI rather than calling an API. For runtime data lookups (read-only), use Liquid functions (see [`patterns.md`](patterns.md)).

---

## 2. Pages must not contain HTML

**Bites:** putting `<div>...</div>` in a page file. `insites-cli audit` does not check this, and the request can return malformed output because the layout already wrapped what should have been delegated.

**Why:** pages are controllers. They fetch data via `{% graphql %}` and delegate rendering to partials. HTML lives in partials only.

**Avoid:** keep page bodies to `{% graphql %}`, `{% function %}`, `{% assign %}`, and `{% render %}` calls. If a page is short and you're tempted to inline a `<p>`, extract it to a partial.

---

## 3. Presentation partials do not call `{% graphql %}`

**Bites:** copy-pasting a `{% graphql %}` query into a card or header partial because the page got crowded. It works, because the platform runs `{% graphql %}` inside a partial, but it runs once per render: a list of 50 cards runs 50 queries.

**Why:** the `graphql-in-partials-restricted` convention. Presentation partials take their data as render arguments. Block, calculation and callback partials may query.

**Avoid:** fetch in the page and pass the result down. For a query used in several places, put it in a partial called with `{% function %}` that returns the result, then pass that to the presentation partial.

---

## 4. `{% form %}` tag is not used in Insites

**Bites:** writing `{% form %}...{% endform %}` because that is what the underlying platform's generic docs show. The form renders but CSRF doesn't behave as expected.

**Why:** Insites uses plain `<form>` elements with explicit CSRF tokens; the `{% form %}` tag is the underlying platform's legacy pattern, not adopted here.

**Avoid:** write forms as `<form action="..." method="post">...{{ context.csrf_tag }}...</form>` with the explicit CSRF token field. See [`../../forms/`](../../forms/) for the canonical form patterns.

---

## 5. Partials can have an alias path that doesn't match their location

**Bites:** searching for a partial referenced as `{% render "crm/controller/contacts/get" %}` and not finding `crm/controller/contacts/get.liquid` anywhere in the tree.

**Why:** partials can declare a `path:` front-matter alias that decouples the include path from the file location. The CRM V2 controllers all use this pattern — the actual file lives at `partials/controllers/_external/v2/contacts/get_contact.liquid` but it is included via the alias `crm/controller/contacts/get`.

**Avoid:** if the include path doesn't lead anywhere, grep for the full alias string in `path:` front-matter of partial files. The location and the resolution name are separate concerns.

---

## 6. Trying to patch the CMS module itself

**Bites:** looking for `modules/insites_cms/...` in your repo to fix a bug in module behavior. It isn't there. The CMS module ships with the instance, not with your project.

**Why:** Insites-supplied modules live on the instance. Your repo's `modules/` directory holds only your own modules, which you can edit freely.

**Avoid:** shadow the file you want to change with a same-path file in your own code (first match wins), or compose around the module's exports. See [`advanced.md`](advanced.md) for resolution order. If the bug is in the module, report it to Insites.

---

## 7. Layout and partial overrides are path-based, not name-based

**Bites:** creating `app/views/layouts/default-v2.liquid` and expecting it to override the module's `default.liquid`. It doesn't — overrides match by path, not by tag or name.

**Why:** Insites' partial-shadowing rule resolves the include/render path against `app/` first, then `modules/<name>/`, in order. The first match wins. New names create new partials; they don't override.

**Avoid:** to override `modules/insites_cms/views/layouts/email_layout`, place a file at `app/views/layouts/email_layout.liquid` (matching the path under each tree). The path determines the override target.

---

## 8. On v6, `/sitemap.xml` is the CRM module's page, and `metadata.is_sitemap_enabled` decides what it lists

**Bites:** expecting `searchable: true` to put a page in `/sitemap.xml`, or adding your own page at `sitemap.xml` to replace it.

**Why:** on v6, `/sitemap.xml` is a page the CRM module ships (`modules/insites_crm/public/views/pages/sitemap.xml.liquid`). Its query, `modules/insites_crm/sitemap/get_sitemap_pages`, lists a page when `metadata.is_sitemap_enabled` is true, plus CMS list and detail pages whose layout has the sitemap switched on. It orders them by `metadata.sitemap_priority` (descending), then `metadata.sitemap_order`, and reads `sitemap_change_frequency` for each entry. It reads `searchable` but never uses it to decide. So pages made by code or by a deploy, with no sitemap metadata, are missing: measured on two v6 instances that were given a moved website in October 2026, `/sitemap.xml` answered an empty `<urlset>` while dozens of pages were live. A page of your own at slug `sitemap.xml` does not replace the module's page. Nothing serves `/robots.txt` unless a page does.

**Avoid:** set `metadata.is_sitemap_enabled: true` (and, if wanted, `sitemap_priority`, `sitemap_order`, `sitemap_change_frequency`) on every page that belongs in the sitemap; the CMS's Sitemap tab does the same. Add a `robots` page with `format: txt` that names the sitemap. For a page search engines must skip, a missing sitemap entry is not enough: add `<meta name="robots" content="noindex">` through the page's `metadata:`.

---

## 9. Global Content is a single record — concurrent edits will clash

**Bites:** two admins editing globals simultaneously, both saving — last-write-wins on the entire record, not per-field merging.

**Why:** there is one Global Content record per instance, replaced wholesale on save. The IIA UI does not implement field-level merge or optimistic locking.

**Avoid:** coordinate Global Content edits administratively. For high-churn data don't use globals — use a database (the data module) where individual rows can be edited independently.

---

## 10. Web Files have aggressive CDN caching

**Bites:** updating `app/assets/js/app.js` and seeing old behavior in production for hours.

**Why:** static assets are served through a CDN with long cache TTLs. The `asset_url` filter handles cache-busting via versioned URLs, but only when you go through the filter.

**Avoid:** always reference assets via `{{ 'js/app.js' | asset_url }}` (not hardcoded paths). For emergency cache invalidation, bump the asset version through the IIA Web Files Details tab.

---

## 11. Authorization policies are evaluated in order — short-circuits on first failure

**Bites:** a page with `[allowed_if_admin, allowed_if_logged_in]` denies a non-logged-in user with the admin policy's flash message instead of the login policy's.

**Why:** policies execute in declaration order, and the first one to fail wins (its `flash_alert` and `redirect_to` apply). They don't all run and produce a combined error message.

**Avoid:** order policies from most-permissive to most-restrictive (or order them so the **most-relevant** failure message appears first). For the example, list `allowed_if_logged_in` before `allowed_if_admin`.

---

## 12. CMS does not fire webhooks

**Bites:** subscribing to a `page_updated` event and never receiving anything.

**Why:** CMS does not have webhook integration. Only modules with API-driven write paths (CRM contact/company create+update) fire webhooks.

**Avoid:** for change notifications on CMS content, watch git history (if you sync files to a repo) or use the event stream API from the data module to log application-level events.
