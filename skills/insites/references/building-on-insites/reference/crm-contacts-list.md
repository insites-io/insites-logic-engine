---
alias: crm/controller/contacts/list
kind: controller
module: module-v6-crm
module_version: "6.1.2"
stability: stable
safe_in_function: true
http_twin: GET /crm/api/v2/contacts
source: modules/insites_crm/private/views/partials/controllers/_external/v2/contacts/get_contacts.liquid
verified: 2026-10-09
related:
  - crm/controller/contacts/get
  - crm/controller/companies/list
---

# `crm/controller/contacts/list`

Returns a page of CRM contacts with relations and custom fields already inflated.

```liquid
{%- function contacts = "crm/controller/contacts/list", params: context.params -%}
{{ contacts.total_entries }}
```

No HTTP request, no API key, no round trip to your own instance.

`crm/controller/contacts/list` is an **alias, not a file path.** Searching module source
for that string finds nothing: it is declared in the `path:` front matter of the partial
that implements it. The alias is stable, the file behind it moves between versions.

## Arguments

One argument, `params`, a hash. Every key is optional.

| Key | Type | Default | Meaning |
|---|---|---|---|
| `page` | Integer | `1` | 1-indexed page number |
| `size` | Integer | `10` | Records per page |
| `search_by` | String | `"name"` | The field to match `keyword` against |
| `keyword` | String | none | The value to match. **With no keyword there is no filter and you get every contact on the instance** |
| `exact` | String | none | The literal string `"true"` switches matching from *contains* to *equals*. A Liquid boolean does nothing |
| `sort_by` | String | `"uuid"` | One of `uuid`, `name`, `email`, `first_name`, `last_name`, `slug`, `created_at`, `updated_at` |
| `sort_order` | String | `"ASC"` | `"ASC"` or `"DESC"`, upcased for you |

### How `search_by` resolves

`search_by` is checked against the contact's own **user fields** first. If it is not one of
those, it is treated as the name of a **profile property** on the
`modules/insites_crm/crm_contact` profile, where `job_title`, `email_2`,
`mobile_phone_number`, `notes` and `is_archived` live.

That is why `search_by: "email"` finds a contact by their primary address but **never by
`email_2`**. `email` is a user field; `email_2` is a profile property. Search them
separately.

Two special cases in the same code path:

- `search_by: "uuid"` forces exact matching regardless of `exact`.
- `exact` is compared against the **string** `"true"`. Anything else, including a Liquid
  boolean, leaves matching as *contains*.

## Returns

A hash. Never null, and it never raises.

| Key | Type | Notes |
|---|---|---|
| `total_entries` | Integer | Total matching contacts, not the page size |
| `total_pages` | Integer | |
| `page` | Integer | Echo of what you asked for |
| `size` | Integer | Echo of what you asked for |
| `results` | Array | The contacts. Empty array when nothing matched |
| `errors` | Array | **Present only on failure.** Check this first |

Relations come back as **objects, not ids**, and any of them can be null:

```json
{
  "uuid": "3f1c8a90-2d44-4e51-9a7b-6c0b2f8d1e33",
  "name": "Priya Raman",
  "email": "priya@example.com",
  "email_2": "p.raman@example.com",
  "job_title": "Operations Lead",
  "is_archived": false,
  "company":     { "uuid": "...", "company_name": "Example Pty Ltd" },
  "assigned_to": { "uuid": "...", "name": "...", "email": "..." },
  "category":    { "uuid": "...", "value": "Active Client" }
}
```

So `contact.company_uuid` is nothing. It is `contact.company.uuid`, and
`contact.company` may be null.

## Errors

Errors are returned, not raised. On failure you get `errors` and **no `results`**.
The failure status on this route is **400**: there is no 500 and no 422, so monitoring
that watches for 5xx sees a healthy service throughout an outage.

## Silent failures

Every row returns data, a 200 and no error. **This table is the reason to read this page
rather than guess.**

| What you write | What happens |
|---|---|
| No `keyword` | No filter. You get **every contact on the instance**, 10 at a time, on a page that looks like it works |
| `search_by: "company.name"` | The dotted form is detected and the filter is **set to empty**. The related-record branch is commented out in source, so you get every contact, not the ones at that company |
| `sort_by: "company_name"` | Anything outside the eight sortable fields produces **no sort at all**. Not an error, not a default sort |
| `exact: true` | A Liquid boolean is not the string `"true"`. Matching stays *contains* |
| `search_by: "email"` for a secondary address | Matches `email` only. `email_2` is a profile property |
| `{% include %}` instead of `{% function %}` | The return value is discarded and the output is printed into your page |

The first two turn a filtered list into a full table dump. Against a dozen test contacts
that is indistinguishable from working code.

## Security: the endpoint's policy does not protect your page

`GET /crm/api/v2/contacts` is protected by a policy declared on **the endpoint page**, not
on the controller. Calling the controller directly never involves that page, **so its
policy never runs.**

Your page carries its own access control. A page that omits `authorization_policies` and
calls this controller **publishes your entire contact database.** Prefer your own policy
over `insites_only_allowed_if_logged_in`, which admits any signed-in user on the instance.

## Complete example

```liquid
---
slug: team/contacts
layout_name: application
format: html
authorization_policies:
  - modules/insites_crm/insites_only_allowed_if_logged_in
---
{%- assign keyword = context.params.q | default: '' | strip -%}

{%- parse_json query -%}
  {
    "page":       {{ context.params.page | default: 1 | plus: 0 }},
    "size":       25,
    "search_by":  "name",
    "keyword":    {{ keyword | json }},
    "sort_by":    "name",
    "sort_order": "ASC"
  }
{%- endparse_json -%}

{%- function contacts = "crm/controller/contacts/list", params: query -%}

{%- if contacts.errors -%}
  {%- log contacts.errors, type: 'team/contacts' -%}
  <p class="error">Contacts are unavailable right now.</p>
{%- else -%}
  <form method="get">
    <input type="search" name="q" value="{{ keyword | escape }}">
    <button type="submit">Search</button>
  </form>

  <p>{{ contacts.total_entries }} contacts</p>

  <ul>
    {%- for contact in contacts.results -%}
      <li>
        <a href="/team/contacts/{{ contact.uuid }}">{{ contact.name | escape }}</a>
        {%- if contact.company -%}
          <span>{{ contact.company.company_name | escape }}</span>
        {%- endif -%}
      </li>
    {%- else -%}
      <li>No contacts match "{{ keyword | escape }}".</li>
    {%- endfor -%}
  </ul>

  {%- if contacts.page < contacts.total_pages -%}
    <a href="?page={{ contacts.page | plus: 1 }}&q={{ keyword | url_encode }}">Next</a>
  {%- endif -%}
{%- endif -%}
```

Note what the example does deliberately: it builds the argument hash **explicitly** rather
than passing `context.params` through, so a caller cannot append `?format=json` and change
the page's response headers, and a missing argument cannot widen the result set.

## What people get wrong

1. **Passing the file path instead of the alias.** It works for some partials today, is
   not supported, and moves between versions.
2. **Assuming an empty filter is an error.** It is the most common cause of a page that
   works against 12 test contacts and leaks 9,000 in production.
3. **Assuming the API raises.** Branch on `contacts.errors` before touching `results`.
4. **Reaching into a relation without a guard.** `contact.company.company_name` on a
   contact with no company renders empty rather than failing, so the bug ships.
5. **Inheriting the REST endpoint's protection.** See above. This is the one that matters.
6. **Reaching for the REST API for your own instance's data.** The controller is faster,
   needs no key and is not rate limited.

Every statement on this page was traced to `get_contacts.liquid` and
`functions/_external/user_filter.liquid` in module-crm v5.14.0 on 13 August 2026. The
same two files in module-v6-crm v6.1.2 differ only by the module rename (`insites_core`
to `insites_crm`), checked 9 October 2026, so every statement holds on v6.
