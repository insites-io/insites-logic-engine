# CMS — Object metadata reference

The CMS module manages **file-based** objects: pages, layouts, partials, web files, global content, collections, emails, SMS templates, and authorization policies. They are stored as files in the project tree (mostly `.liquid`, some `.yml`/`.html`/`.js`/`.css`). Each has a front-matter section that controls metadata, behavior, and IIA UI display.

This file is the field-by-field reference for those object types. For consumption from Liquid (rendering pages, including partials, fetching globals), see [`patterns.md`](patterns.md). For the IIA admin walkthrough see [`configuration.md`](configuration.md).

CMS does **not** expose a V2 REST API — the only way to create or edit these objects is through IIA, the platform CLI's file sync, or by committing files into the project tree directly. There is no equivalent of [`../crm/api.md`](../crm/api.md) for CMS.

---

## Object types at a glance

| Object | File location | Purpose | IIA route |
|---|---|---|---|
| Page | `app/views/pages/...liquid` | A URL-addressable controller. Pages fetch data and delegate rendering to partials. | `/cms/pages` |
| Layout | `app/views/layouts/...liquid` | Wrapper template for pages and emails. | `/cms/layouts` |
| Partial | `app/views/partials/...liquid` | Reusable template snippet. Holds HTML; called via `{% render %}` or `{% function %}`. | `/cms/partials` |
| Web File | `app/assets/...` (static) | Static asset served as web content (`.js`, `.css`, `.html`, etc.). | `/cms/web-files` |
| File Explorer | (browse all of `app/`) | Browse and manage the project file tree. | `/cms/explorer` |
| Global Content | `app/forms/global_content/...` | Single shared record with company-wide settings (logo, contact info, locations, social links). | `/cms/globals` |
| Collection | `app/views/pages/...` (special-cased) | A data-backed listing view with separate list/details layouts. | `/cms/collections` |
| Email | `app/emails/...liquid` | Email template — subject, recipient, body, layout. | `/cms/emails` |
| SMS | `app/smses/...liquid` | SMS template — recipient and body. | `/cms/sms` |
| Authorization Policy | `app/authorization_policies/...liquid` | Access-control rule referenced from page front-matter. | `/cms/auth-policies` |

Most administration happens at `<your-insites-instance>/admin/insites#<route>`, e.g. `<your-insites-instance>/admin/insites#/cms/pages`.

---

## Pages

A page is a controller. It fetches data via `{% graphql %}`, then renders by delegating to partials. Pages contain no HTML directly — that lives in partials.

**File location:** `app/views/pages/<path>.liquid` — the file's path under `pages/` becomes the URL slug by default.

**Front-matter keys** (the IIA UI exposes these as tabs):

| Key | IIA tab | Description |
|---|---|---|
| `slug` | Details | URL pattern, e.g. `crm/api/v2/contacts/:uuid`. Path params use `:name`. |
| `method` | Details | HTTP method: `get`, `post`, `put`, `patch`, `delete`. One method per file — separate file per method. |
| `layout` | Details | Layout to wrap the page output, e.g. `modules/insites_crm/json` or `default`. |
| `format` | Details | `json`, `html`, `js`, `xml`, etc. Drives `Content-Type`. |
| `searchable` | Sitemap | Platform search flag. On v6 the CRM module's `/sitemap.xml` does not use it: a page is listed when `metadata.is_sitemap_enabled` is true. See [gotcha 8](gotchas.md#8-on-v6-sitemapxml-is-the-crm-modules-page-and-metadatais_sitemap_enabled-decides-what-it-lists). |
| `metadata` | Metadata | Object of free-form key/value pairs surfaced as `<meta name=...>` in HTML pages. |
| `max_deep_level` | Details | URL nesting this page's slug resolves, per the platform schema. Not a reliable cap: see [routing gotchas](../../routing/gotchas.md#a-static-slug-also-answers-deeper-paths). |
| `authorization_policies` | Security | List of policy names that gate access; e.g. `- modules/insites_crm/has_valid_instance_api_authorization`. |
| Open Graph fields | Open Graph | OG: title, description, image, type, etc. Used by social-share cards. |
| Schema fields | Schema | JSON-LD structured data block for SEO. |
| Cache config | Cache | TTL, key strategy, vary-by — controls server-side fragment cache for the page. |

**Body:** the Liquid below the front-matter. Should be lean — call `{% graphql %}` for data, then `{% render 'path/to/partial' %}` to render.

**Forbidden in pages:** raw HTML/JS/CSS (delegate to partials), `{% form %}` tag (use plain `<form>` with CSRF token), file extensions other than `.liquid`.

---

## Layouts

A wrapper template for pages and emails. Contains the outer HTML scaffold (`<html>`, `<head>`, `<body>`), navigation, footer, and a `{{ content_for_layout }}` slot where the page body is injected.

**File location:** `app/views/layouts/<name>.liquid`

**Front-matter:** typically minimal or empty. Layouts are referenced by the `layout:` key in page front-matter.

**Body:** full-page HTML with `{{ content_for_layout }}` placed where page content should render.

---

## Partials

Reusable template snippets. The only place HTML/CSS/JS should live in the views layer.

**File location:** `app/views/partials/<path>.liquid`

**Front-matter keys:**

| Key | Description |
|---|---|
| `path` | Optional alias path. When present, `{% render "<path>" %}` resolves to this partial regardless of the file's actual location. (Used heavily by the V2 controller layer — the `crm/controller/<resource>/<action>` aliases are partial path aliases.) |

**Body:** HTML with embedded Liquid. Free to call `{% render %}`, `{% function %}`, filters, control flow. **Cannot call `{% graphql %}`** — pages do data fetching, partials only render.

**Two ways to invoke a partial:**
- `{% render "path/to/partial", arg1: value1 %}` — produces HTML output
- `{% function result = "path/to/partial", arg1: value1 %}` — captures the return value (`{% return data %}` inside the partial); produces no HTML

---

## Web Files

Static assets served at a fixed URL. Distinct from attachments (which are uploaded blobs with UUIDs).

**File location:** `app/assets/<path>`

**Common types:** `.js`, `.css`, `.html`, fonts, icons. Fetched via `{{ "<path>" | asset_url }}`.

**IIA tabs on a web file:**

| Tab | Description |
|---|---|
| Details | Filename, MIME type, version, cache settings |
| Content | The file's actual byte content (text editor for text types) |

The File Explorer view (`/cms/explorer`) browses the entire `app/` tree, including web files alongside Liquid sources.

---

## Global Content

Single shared record with company-wide settings used by every page and email. Backed by the form file `app/forms/global_content/insites_global_content.liquid` and the schema `private/schema/globals/global.yml`.

Stored as one record; addressed by name `global`. Read in Liquid via `{% function globals = 'modules/insites_cms/.../get_globals' %}` patterns or via the rendered `globals` variable in IIA-bootstrapped contexts.

**Field groups** (all under one record):

- **Brand identity:** `business_registration`, `company_id`, `company_name`, `company_slogan`, `company_url`, `company_email_1`, `company_email_2`
- **Brand assets:** `company_logo`, `company_icon`, `alternate_company_logo`, `alternate_company_icon`, `email_logo`, `alternate_email_logo` (all `upload` type)
- **Social links:** `facebook_link`, `youtube_link`, `google_plus_link`, `twitter_link`, `linkedin_link`, `instagram_link`, `pinterest_link`, `other_1_link`, `other_2_link`
- **Locations** (5 slots, named `loc_1_*` through `loc_5_*`): name, address (1/2/3, county, district, suburb, city, state, postcode, country), email, contact_person, timezone, schedule_format, weekday open/close hours (mon–sun, each with `_enable`/`_open`/`_close`), notes, phone (country_code, area_code, number), fax (country_code, area_code, number), image
- **PO Boxes** (2 slots, `po_1_*`, `po_2_*`): box_number, address, city, state, postcode, country
- **Custom addresses** (per location, alongside the flat fields): structured address with `street_number`, `address`, `address2`, `city`, `state`, `street`, `country`, `iso_country_code`, `postcode`, `lat`, `lng`

The full field list is large (~600 keys); see the `global.yml` schema for the exhaustive enumeration. Most pages only consume a handful of fields (`company_name`, `company_logo`, social links, `loc_1_*`).

**Authorization:** the form requires `insites_only_allowed_if_logged_in` + `insites_only_allowed_by_administrators` — only admins can edit globals.

---

## Collections

A data-backed listing view with separate list and details layouts. Use a collection when you need a paginated/filterable index page plus per-record detail pages, both styled and rendered through CMS-managed templates.

**File location:** `app/views/pages/<path>` — collections are special-cased pages.

**IIA tabs:**

| Tab | Description |
|---|---|
| Details | Slug, source data, layout selection |
| List Layout | Template for the index/listing view |
| Details Layout | Template for the per-record detail view |
| Security | Authorization policies |
| Cache | Cache TTL and key strategy |

---

## Emails

Email template. Like pages but for outbound email — has a recipient, subject, body, and is sent rather than rendered to HTTP.

**File location:** `app/emails/<path>.liquid`

**Front-matter keys:**

| Key | Description |
|---|---|
| `to` | Recipient. Liquid expression evaluated against the email's render context. |
| `from` | Sender address. |
| `subject` | Email subject. Supports Liquid for dynamic subjects. |
| `layout` | Email layout to wrap the body (typically the module's `external_email_layout` or `internal_email_layout` — see [`../crm/advanced.md`](../crm/advanced.md)). |
| `reply_to` | Optional reply-to address. |
| `cc` / `bcc` | Optional CC / BCC. |

**Body:** HTML email content with embedded Liquid. Use a layout for consistent header/footer styling.

---

## SMS Templates

Similar to emails but for SMS. Smaller front-matter, plain-text body.

**File location:** `app/smses/<path>.liquid`

**Front-matter keys:**

| Key | Description |
|---|---|
| `to` | Recipient phone number. |
| `from` | Sender (long code, short code, or alphanumeric ID). |

**Body:** Plain text. Watch the 160-character SMS limit — long messages segment into multiple billable SMS.

---

## Authorization Policies

Files that define a single yes/no access rule. Referenced by name from page front-matter via `authorization_policies:`.

**File location:** `app/authorization_policies/<name>.liquid`

**Front-matter keys:**

| Key | Description |
|---|---|
| `name` | Policy name. Matches the file path used by pages to reference this policy. |
| `flash_alert` | Flash message shown to the user when access is denied. |
| `redirect_to` | Path the user is redirected to on denial (e.g. `api/401`, `/login`). |

**Body:** Liquid that evaluates to truthy (allowed) or falsy/blank (denied). Often calls `{% graphql %}` to look up tokens, sessions, or user state.

**Example:** `modules/insites_crm/has_valid_instance_api_authorization.liquid` (the V2 API auth policy) — receives the `Authorization` header, compares to the stored instance API key, returns `true` on match.

Policies are pure rule files — no side effects beyond returning their boolean result. Don't write data or send notifications from inside a policy.
