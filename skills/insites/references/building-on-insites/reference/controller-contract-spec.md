# Controller contract — endpoint doc-data specification

Every documented endpoint declares a machine-readable **contract** — what its controller
accepts, returns, and does on bad input (including the silent-failure traps). The contract
is the source of truth the instance's API docs render from: the `/admin/api` Controller
Contract section and the `.md` twin display it per endpoint.

The worked example this spec was proven against is
[`crm/controller/contacts/list`](crm-contacts-list.md).

## Carrier — the endpoint doc-data partial

The contract is a `contract` key on the endpoint's **existing doc-data partial** — the same
`{% parse_json content %}` object that already carries `title`, `method`, `url`,
`controller_name`, `params`, `example_payload` and `example_response`, and that the docs
renderer already loads by path with `{% function content = <endpoint-path> %}`.

This is the only mechanism that works. A controller's own front matter cannot carry the
contract: controllers live under `private/`, and a private partial's metadata is not
readable — `admin_liquid_partials` (the GraphQL query) returns `public/` partials only, and
`{% function %}` returns a partial's executed output, not its front matter. The endpoint
doc-data partial, by contrast, is read by `{% function %}` and *returns* its data, so a
`contract` key on it is available to the renderer as `content.contract` with no extra query.

Add the `contract` key to the endpoint's doc-data (example: CRM contacts list, at
`modules/insites_crm/.../insites_api/external_api/contacts/get_contacts.liquid`):

```liquid
{% parse_json content %}
{
  "title": "Get Contacts",
  "method": "get",
  "url": "/crm/api/v2/contacts",
  "controller_name": "crm/controller/contacts/list",
  "params": ["page", "size", "sort_by", "sort_order", "search_by", "keyword", "exact"],
  "example_payload": { "page": 1, "size": 10 },
  "example_response": [ /* ... */ ],

  "contract": {
    "module": "module-v6-crm",
    "stability": "stable",
    "safe_in_function": true,
    "http_twin": "GET /crm/api/v2/contacts",
    "summary": "Returns a page of CRM contacts with relations and custom fields inflated.",
    "returns": [
      { "name": "total_entries", "type": "integer", "notes": "Total matching contacts, not the page size." }
    ],
    "errors": [
      { "condition": "GraphQL query failure", "response": "errors array in the return value; the HTTP twin answers 400 (never 5xx)." }
    ],
    "silent_failures": [
      { "input": "No keyword", "behavior": "No filter — returns every contact on the instance, size per page, HTTP 200." },
      { "input": "Dotted search_by (company.name)", "behavior": "Filter discarded; every contact returned." }
    ]
  }
}
{% endparse_json %}

{% return content %}
```

The renderer reads `content.contract` directly — no separate query, no controller metadata.
The `params` / `example_payload` the renderer already renders stay where they are; the
`contract` adds the guarantees (returns, errors, silent failures) the endpoint docs did not
previously carry.

## Field semantics

| Field | Rule |
|---|---|
| `module` | Repo name (`module-v6-crm`, `module-v6-data`, …). |
| `stability` | `stable`, `beta`, or `deprecated`. |
| `safe_in_function` | `true` only when the controller both returns a value and gates its response handler. The two data-module write controllers with no `{% return %}` are `false`. |
| `http_twin` | The REST endpoint that wraps this controller, `METHOD /path` form, omitted when none exists. |
| `params` | One entry per key the controller reads (from `params.*` or named arguments). Every entry states type, default, and meaning. Named arguments (e.g. `uuid` passed beside `params`) are listed with `argument: true`. |
| `returns` | One entry per top-level key of the return hash. |
| `errors` | Conditions that populate `errors` in the return value; note there is no 5xx — the failure status on the HTTP twin is 400. |
| `silent_failures` | Inputs that return 200 with plausible-but-wrong data. This table is the most valuable part of the contract — do not leave it empty if the controller has list semantics (missing keyword, dotted search_by, invalid sort_by). |

`module_version`, `last_updated` and `canonical_url` from the original proposal are
deliberately **not** stored per-partial: the version is the installed module's version
(already known to the instance), staleness is the drift check's job, and the canonical URL
is derivable from the alias. Storing them per-file guarantees they rot.

## Authoring rules

- Facts come from reading the controller source and its calling endpoint page, not from
  the HTTP docs. Where they disagree, the source wins and the discrepancy is worth a task.
- Defaults are what the code applies (`| default:` filters), not what feels sensible.
- A param compared against a string (e.g. `exact` vs `"true"`) is documented as type
  `string` with the comparison spelled out in `description`.
- If the controller's response handler is ungated (fires regardless of `?format=json`),
  say so in `silent_failures` and set `safe_in_function: false`.

## Rendering

The module-api docs renderer reads `content.contract` from the endpoint doc-data it already
loads, and renders it as the Controller Contract section (HTML) and contract tables in the
`.md` twin: returns, errors, silent failures — same section order as
[crm-contacts-list.md](crm-contacts-list.md). Endpoints without a `contract` key render
exactly as before.

## Drift checks (CI, proposed)

- Contract coverage: % of documented endpoints whose doc-data carries a complete `contract`.
- Reference integrity: every `controller_name` in the doc-data resolves to a partial declaring that `path:` alias.
- Drift: every argument the controller reads is reflected in the contract, and vice versa.
