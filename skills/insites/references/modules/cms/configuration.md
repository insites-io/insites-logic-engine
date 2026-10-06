# CMS — Configuration

What an instance administrator can manage through IIA's CMS module — file editing, metadata configuration, organization. **Modules are preinstalled** on Insites instances; CMS module updates ship through the Insites console.

For the field shapes of each object type, see [`metadata.md`](metadata.md).

---

## IIA admin paths

| Object type | IIA path |
|---|---|
| Pages | `<your-insites-instance>/admin/insites#/cms/pages` |
| Layouts | `<your-insites-instance>/admin/insites#/cms/layouts` |
| Partials | `<your-insites-instance>/admin/insites#/cms/partials` |
| Web Files | `<your-insites-instance>/admin/insites#/cms/web-files` |
| File Explorer | `<your-insites-instance>/admin/insites#/cms/explorer` |
| Global Content | `<your-insites-instance>/admin/insites#/cms/globals` |
| Collections | `<your-insites-instance>/admin/insites#/cms/collections` |
| Emails | `<your-insites-instance>/admin/insites#/cms/emails` |
| SMS | `<your-insites-instance>/admin/insites#/cms/sms` |
| Authorization Policies | `<your-insites-instance>/admin/insites#/cms/auth-policies` |

Each object type has a list view at the path above, plus `.../add` and `.../edit` paths for create/edit forms.

---

## Pages — IIA tabs

When editing a page in IIA, the form is split into tabs corresponding to front-matter sections:

| Tab | Path suffix | Manages |
|---|---|---|
| Details | (default) | `slug`, `method`, `layout`, `format`, `max_deep_level` |
| Content | `/content` | The Liquid body |
| Sitemap | `/sitemap` | Sitemap inclusion (`metadata.is_sitemap_enabled`), priority, order and change frequency |
| Metadata | `/metadata` | SEO `<meta>` tags via the `metadata:` front-matter object |
| Open Graph | `/open-graph` | OG title/description/image/type for social shares |
| Schema | `/schema` | JSON-LD structured data block |
| Security | `/security` | `authorization_policies:` to gate access |
| Cache | `/cache` | Server-side fragment cache TTL and key strategy |

---

## Partials — IIA tabs

Simpler than pages, two tabs:

| Tab | Path suffix | Manages |
|---|---|---|
| Details | (default) | Path alias (the `path:` key), name |
| Content | `/content` | The Liquid body |

---

## Collections — IIA tabs

Collections are special-cased pages with separate list/details layouts:

| Tab | Path suffix | Manages |
|---|---|---|
| Details | (default) | Slug, source data, layout selection |
| List Layout | `/list-layout` | Template for the index/listing view |
| Details Layout | `/details-layout` | Template for the per-record detail view |
| Security | `/security` | Authorization policies |
| Cache | `/cache` | Cache configuration |

---

## Web Files — IIA tabs

| Tab | Path suffix | Manages |
|---|---|---|
| Details | (default) | Filename, MIME type, version, cache settings |
| Content | `/content` | The file's byte content (text editor for text types) |

---

## Global Content

A single record with company-wide settings. Editing happens through one large form rather than a list view. Field groups visible in the IIA editor:

- **Brand identity** — registration, company id, name, slogan, URL, primary/secondary email
- **Brand assets** — logos and icons (`upload` fields)
- **Social links** — Facebook, YouTube, Google+, Twitter, LinkedIn, Instagram, Pinterest, plus two free slots
- **Locations** — five named slots with address, contact info, schedule (per-weekday open/close), phone, fax, image
- **PO Boxes** — two slots
- **Custom addresses** — structured per-location addresses with lat/lng

See [`metadata.md#global-content`](metadata.md#global-content) for the full field enumeration.

**Authorization:** the form is gated by `insites_only_allowed_if_logged_in` + `insites_only_allowed_by_administrators`. Only admin sessions can edit globals.

---

## File Explorer

Browse-and-edit interface for the entire `app/` tree, including non-CMS files (forms, schemas, GraphQL queries, etc.). Use this for ad-hoc edits or to inspect how a feature is laid out across object types.

The Explorer reads the actual file structure on the instance — what you see here is what's deployed. Edits here take effect immediately (subject to caching).

---

## Out of scope for this document

- **Module install / version updates** — handled through the Insites console.
- **Roles** — Insites does not have built-in roles. Page access is gated by per-instance `authorization_policies` (see [`metadata.md#authorization-policies`](metadata.md#authorization-policies)).
- **API endpoints / API keys** — these live in the api module, not CMS.
- **Webhooks** — CMS does not fire webhooks. Other modules (CRM, etc.) do.
