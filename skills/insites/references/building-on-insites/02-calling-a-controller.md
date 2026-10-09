# Calling a controller

A controller is a piece of logic a module already ships. Calling one is how you get real
data onto a page without an HTTP request, an API key or a rate limit.

## The call

```liquid
{%- function contacts = "crm/controller/contacts/list", params: context.params -%}
{{ contacts.total_entries }}
```

`{% function %}` binds the controller's return value to a variable. That is the whole
mechanism.

## An alias is not a file path

`crm/controller/contacts/list` appears **nowhere in module source as a string**. Searching
for it finds nothing, which makes it look like the documentation is wrong. It is not: the
alias is declared in the `path:` front matter of the partial that implements it.

```liquid
---
  path: crm/controller/contacts/list
---
```

The alias is the stable name. The file behind it moves between module versions; the alias
does not. **Always call the alias, never the file path.** Passing the path works for some
partials today and is not a supported call.

## `{% function %}` against `{% include %}`

They look interchangeable. They are not, and the difference can break your page's HTTP
response.

| | `{% function %}` | `{% include %}` |
|---|---|---|
| The return value | Bound to your variable | **Discarded** |
| The controller's text output | Discarded | **Printed into your page** |
| Can it set your page's status and `Content-Type`? | No | **Yes, on some controllers** |

**Use `{% function %}` for every controller call.** `{% include %}` is for your own
presentational partials.

## Why `{% include %}` can hijack your page

Every controller ends by returning its data. Most also call a shared response handler,
which sets the HTTP status and `Content-Type` on the response, and **whether that is
gated differs by module.**

The CRM controllers gate it on a query parameter:

```liquid
{%- if context.params.format == 'json' -%}
  {%- include "modules/insites_crm/functions/response_handler",
      data: data, status: status -%}
{%- endif -%}

{% return data %}
```

So a CRM controller only touches your response if the request carried `?format=json`.
All 59 CRM controllers do this, and all 59 return a value. The ecommerce, events,
locator, assets, API and pipelines short-form controllers follow the same shape, with
one exception: `locator/controller/enquiries/filters/get_filter_options` neither gates
its handler nor returns a value. (Counted on the v6 module trees, 9 October 2026.)

**The data module controllers do not gate it at all.** Verified in module-data on
13 August 2026 and unchanged in module-v6-data v6.0.2 on 9 October 2026:

| Alias | Returns a value | Response handler |
|---|---|---|
| `databases/controller/databases/list` | yes | **ungated** |
| `databases/controller/databases/get` | yes | **ungated** |
| `databases/controller/databases/create` | yes | **ungated** |
| `databases/controller/deprecated/databases/list` | yes | **ungated** |
| `databases/controller/database/items/list` | yes | **ungated** |
| `databases/controller/database/items/get` | yes | **ungated** |
| `databases/controller/database/items/delete` | yes | **ungated** |
| `databases/controller/database/items/add` | **no `{% return %}` at all** | **ungated** |
| `databases/controller/database/items/update` | **no `{% return %}` at all** | **ungated** |

Two consequences, and both look like your own bug:

1. **`items/add` and `items/update` return nothing.** Your variable is blank even when the
   write succeeded. Do not test success by checking the return value; re-read the record.
2. **All nine set your page's `Content-Type` and status** whatever the request looked
   like. Call one from a page that renders HTML and the response headers stop matching the
   body.

**So learning the calling convention from a CRM example and applying it to a data
controller does not work.** Check the module before you assume a controller behaves like
the last one you called.

## The `?format=json` trap on an HTML page

Because the CRM gate reads `context.params.format`, which is a **query parameter and not
your page's front matter**, anyone can append `?format=json` to your HTML page's URL. If
that page calls a CRM controller, the response handler fires mid-render and sets a JSON
`Content-Type` on a response whose body is your HTML.

If your page must not do that, do not pass `context.params` straight through. Build the
argument hash explicitly and leave `format` out of it:

```liquid
{%- parse_json query -%}
  {
    "page":    {{ context.params.page | default: 1 | plus: 0 }},
    "size":    25,
    "keyword": {{ context.params.q | default: '' | json }}
  }
{%- endparse_json -%}
{%- function contacts = "crm/controller/contacts/list", params: query -%}
```

Passing `context.params` through is the common case and it is fine for a page that is
meant to serve both HTML and JSON. It is a trap only when it is not.

## Finding the alias you need

Check the [alias inventory](reference/alias-inventory.md). **A call to an alias that does
not exist fails at render time** with a partial-not-found error, and inventing plausible
names is the single most common way an agent wastes a build.

404 controller aliases exist on the v6 modules (9 October 2026), up from 225 on v5.
Naming is not uniform. Most are the short form `<module>/controller/<resource>/<verb>`;
the 35 short events aliases carry no `controller` word at all (`events/venues/list`); and
the pipelines, data and events modules also declare long-form controllers under
`modules/<module>/controllers/...`. Filter on none of these.

**The long-form aliases are admin controllers, and they behave like the data module's
writes.** The 82 `modules/insites_pipeline/controllers/...`, 52
`modules/insites_databases/controllers/...` and 2 `modules/insites_events/controllers/...`
aliases back the admin screens: none of the 136 contains a `{% return %}`, none gates
its response handler, and all but a handful write the HTTP response unconditionally
(counted 9 October 2026). Call them from a page and your variable is blank and your
response is theirs. The short-form aliases are the API controllers; build on those.

A further 90 partials declare a `path:` that is **not** a controller: a module's own
functions, GraphQL wrappers, schema and API-doc partials under `modules/<module>/...`.
They answer a `{% function %}` call, but they have no published contract and some of
them write. The inventory lists them apart. Build on the controllers.

**Nine controller names in the modules' own API documentation do not exist.** The v6
API docs name `crm/controller/company-info/{create,get,list,update}`,
`crm/controller/contact-personal-info/{create,get,list,update}` and
`modules/insites_assets/controllers/credentials/get_details` as the controllers behind
their endpoints, and no partial declares any of them: the first eight endpoints are
pages with the logic inline. A `{% function %}` on one of those names fails with
partial-not-found. Found with `tools/lint-controller-contracts.mjs` against the v6
trees on 9 October 2026.

---

For the deep in-Liquid reference — argument passing per controller, auth context, worked page examples — see [calling-from-liquid](../api/calling-from-liquid.md).
