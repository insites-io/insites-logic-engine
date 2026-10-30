# Rules — Pages

Rules that apply to files under `app/views/pages/` (or module-equivalent paths like `modules/{name}/public/views/pages/`).

---

```yaml
---
id: pages-one-http-method
applies_to: [page]
severity: info
evidence: real-project
evidence_source: "No page in app-portal, app-seedling, addon-ecommerce or addon-events declares more than one method, but most declare none and fall back to get (master, 13 October 2026): 68 of 110 pages have no method: line. app-seedling 16 of 20, app-portal 31 of 39, addon-ecommerce 9 of 22, addon-events 12 of 29. The reference repos do not follow this convention yet."
audit_ref: audit/v0-conflicts-batch2.md#rule-r-13
---
```

**Rule:** Each page declares exactly one HTTP method (`get`, `post`, `put`, `patch`, or `delete`) in its YAML front matter.

**Why:** Pages are HTTP endpoints. Mixing methods makes routing behaviour ambiguous and breaks the platform's request-handler contract.

**How to apply:** When creating a page, add `method: <verb>` to the front matter. If you need the same URL to serve multiple methods, create separate page files (e.g. `users/get.liquid`, `users/post.liquid`).

**Verified by:** No page in the four reference repos declares two methods. Most declare none and fall back to `get`, so the repos do not follow this rule yet: 68 of 110 pages have no `method:` line (app-seedling 16 of 20, app-portal 31 of 39, addon-ecommerce 9 of 22, addon-events 12 of 29, counted on master on 13 October 2026). Pages that do declare one:
- `app-portal/modules/portal/public/views/pages/api/users/check-user-email.liquid:4` — `method: get`
- `addon-ecommerce/modules/ecommerce/public/views/pages/api/contacts/put.liquid:4` — `method: put`
- `addon-events/modules/events/public/views/pages/api/contacts/add-password.liquid:4` — `method: put`

---

```yaml
---
id: pages-prefer-partials-for-shared-html
applies_to: [page]
severity: warning
evidence: real-project
evidence_source: "Rewrite of original R-1 'pages-no-html'. Original rule said pages must contain no HTML, but 49/438 real-world pages contain inline HTML and the pattern is widespread. Real convention: pages may contain inline HTML for simple content; HTML reused across pages should be extracted to partials."
audit_ref: audit/v0-conflicts-batch1.md#rule-r-1
supersedes: [pages-no-html]
---
```

**Rule:** HTML chunks reused across multiple pages, or composed from 3+ distinct UI blocks, SHOULD be extracted into partials and rendered via `{% render %}`. Inline HTML in a page is acceptable for simple content (static text, single forms, system pages).

**Why:** Reusable HTML in partials prevents drift, makes refactoring easier, and keeps page files focused on routing + data fetching. Forcing every page to be a thin controller is overkill for simple content pages and is contradicted by widespread practice in the canonical repos.

**How to apply:**
- If your page contains a hero + featured products + footer → extract each into a partial.
- If your page contains a single static block of marketing copy → inline HTML is fine.
- If you find yourself copy-pasting HTML between pages → extract.

**Verified by:** Real-world examples show both patterns:
- Inline HTML in pages (acceptable): `app-portal/modules/website/public/views/pages/privacy_policy.liquid` (static legal copy), `app-seedling/modules/website/public/views/pages/index.liquid` (hero section)
- Partial-based pages (preferred for composition): `app-portal/modules/website/public/views/pages/index.liquid` (uses `{% render %}` to delegate)

**Note:** This rule was substantially rewritten during the v0 audit. The original wording ("NO raw HTML/JS/CSS in pages") was contradicted by 11.2% of real-world pages.

---

```yaml
---
id: pages-name-in-front-matter
applies_to: [page]
severity: warning
evidence: runtime-failure
evidence_source: "Measured on a v6 production instance on 30 October 2026 through CloudShell: the CMS page list reads metadata.page_name; a page deployed with no metadata read back metadata {} and showed no name; a name set in the admin was blanked by the next deploy of a file without it; a file carrying metadata.page_name read the name back after deploy."
audit_ref: skills/insites/references/modules/cms/gotchas.md#13-deployed-pages-partials-and-layouts-have-no-name-in-the-cms
---
```

**Rule:** Every page sets `metadata.page_name` in its front matter: a short, human name for the CMS page list, such as `Client - Page` or `Feature - Screen`.

**Why:** The CMS shows a page by `metadata.page_name`, and a deploy replaces the page's `metadata` with the file's. A page without it is listed with no name, and a name typed into the admin is wiped by the next deploy, so the only name that lasts is the one in the file.

**How to apply:** When creating or editing a page, add `metadata:` with `page_name:` to the front matter, alongside `slug` and `layout`. Keep any other `metadata` keys the page already uses in the same block.

