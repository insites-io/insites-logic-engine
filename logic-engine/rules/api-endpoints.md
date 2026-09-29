# Rules — API Endpoints

Rules that apply to pages under `views/pages/api/` (app or module paths) that return JSON to a caller.

Evidence for every rule in this file was measured over the default branch of all 14 IIA modules on 26 September 2026: 1,368 API pages. See `audit/api-endpoints-2026-09.md` for the method.

---

```yaml
---
id: api-pages-declare-a-guard
applies_to: [page]
severity: warning
evidence: real-project
evidence_source: "1,344 of 1,368 IIA module API pages carry a guard: 1,256 declare authorization_policies in front matter and 88 call an inline guard function (CRM V2, since TW#26083226). The rest are empty files, OPTIONS preflights, or were reported to the module owners separately."
audit_ref: audit/api-endpoints-2026-09.md#guards
validator: api-pages-declare-a-guard
related: [auth-policies-in-front-matter, auth-policy-explicit-true-false]
---
```

**Rule:** Every page under `views/pages/api/` MUST either declare `authorization_policies` in front matter, call a guard function before touching data, or state in a comment that it is public and why:

```liquid
{% comment %}public endpoint: Stripe calls this; the signature is verified below{% endcomment %}
```

**Why:** A page with no guard is public, and an API page usually returns records. The platform gives no warning, and the page works perfectly for everyone. A reviewer cannot tell a deliberately public webhook from a forgotten guard unless the page says which it is. The marker is a Liquid comment rather than a front-matter key because what the platform does with an unknown front-matter key is not documented.

**How to apply:**
- Called by a browser session: a front-matter policy.
- Called by a machine with the instance API key: `modules/insites_core/has_valid_instance_api_authorization`, or an inline guard if the caller needs a 401 on the original URL rather than a redirect. See `skills/insites/references/api-endpoints/README.md`.
- Deliberately public: the `public endpoint:` comment, with the reason.
- `method: options` preflight pages and empty files are skipped.

**Verified by:** census over 1,368 API pages; the validator flags exactly the pages the census classes as unguarded.

---

```yaml
---
id: api-slug-no-format-extension
applies_to: [page]
severity: warning
evidence: real-project
evidence_source: "0 of 1,368 IIA module API pages put .json in the slug. 304 of 1,368 set format: json in front matter; the rest rely on a JSON layout."
audit_ref: audit/api-endpoints-2026-09.md#slugs
validator: api-slug-no-format-extension
related: [pages-one-http-method]
---
```

**Rule:** A page's `slug` (or `path`) MUST NOT contain `.json`. Declare the format with `format: json` in front matter.

**Why:** The format belongs to the response, not the URL. A `.json` slug forks the URL space (`/products` and `/products.json`) and every module endpoint already avoids it, so a slug that carries it is almost always a mistake copied from another platform.

**How to apply:**
```liquid
---
slug: api/_external/v2/products
method: get
format: json
---
```

**Verified by:** census over 1,368 API pages, 0 violations.

---

```yaml
---
id: api-no-credentials-in-url
applies_to: [page]
severity: error
evidence: real-project
evidence_source: "0 of 1,368 IIA module API pages take a credential as a slug segment or read one from a GET query string."
audit_ref: audit/api-endpoints-2026-09.md#credentials
validator: api-no-credentials-in-url
related: [use-context-constants-for-secrets]
---
```

**Rule:** A credential MUST NOT travel in the URL. No slug segment named like a credential (`:api_key`, `:secret`, `:password`, `:access_token`), and no GET page reading one from `context.params`. Read it from a header instead.

**Why:** URLs are written to browser history, server and proxy logs, analytics, and `Referer` headers. A key in a URL is a key that has already been shared.

**How to apply:** Send the key in a header and read it the CGI way: `X-Api-Key` arrives as `context.headers.HTTP_X_API_KEY`. `context.headers['X-Api-Key']` is blank, so a guard written that way never sees the key. A one-time `token` in a verification link is not covered by this rule.

**Verified by:** census over 1,368 API pages, 0 violations.
