# Pages

A page is a Liquid template with front matter. It is the only thing on an instance that a
browser can reach, so nothing you build works until a page exists.

## Filesystem pages do not route

**Putting a `.liquid` file in the repository is not enough.** Only pages registered
through the instance route. A file at `app/views/pages/thing.liquid` that has not been
registered returns 404 and does not appear in the instance admin.

So you create and update pages through the admin GraphQL API. See
[Two APIs, two credentials](01-two-apis-two-credentials.md) for the token.

## Creating a page

```graphql
mutation {
  admin_page_create(page: {
    physical_file_path: "app/views/pages/team/contacts.liquid"
    slug: "team/contacts"
    format: html
    layout_name: "application"
    content: "<h1>Contacts</h1>"
  }) {
    id
    slug
  }
}
```

**`physical_file_path` is the only required field.** `slug` is optional, which is
surprising: the natural assumption is that the URL is the identifier, and it is not. Set
both, and keep them consistent, or later updates become hard to target.

## Updating a page

`admin_page_update` accepts **either** an `id` **or** a `physical_file_path` to identify
the page:

```graphql
mutation {
  admin_page_update(
    physical_file_path: "app/views/pages/team/contacts.liquid"
    page: { content: "<h1>Our contacts</h1>" }
  ) { id }
}
```

Updating by `physical_file_path` means a deploy script does not have to store ids, which
is why it is the better choice for anything repeatable.

## Every field you can set

Identical on create and update, except that update also accepts `deleted_at`.

| Field | Type | Notes |
|---|---|---|
| `physical_file_path` | String | **Required on create.** The identifier |
| `slug` | String | The URL path. Optional, and it should not be |
| `content` | String | The Liquid template body |
| `format` | PageFormat | `html`, `json` and others |
| `layout_name` | String | The layout to render inside |
| `layout` | String | |
| `authorization_policies` | String | See [Authorization](04-authorization.md) |
| `authorization_policy_ids` | ID | |
| `request_method` | PageRequestMethod | `get`, `post` and others |
| `response_headers` | HashObject | |
| `metadata` | HashObject | |
| `searchable` | Boolean | |
| `max_deep_level` | Int | |
| `subdomain` | String | |
| `redirect_to` | String | |
| `redirect_code` | PageRedifectCode | The misspelling is the platform's, not a typo here. Use it as written or the query is invalid |
| `static_cache_expire` | Int | |
| `dynamic_cache_expire` | Int | |
| `dynamic_cache_key` | String | |
| `dynamic_cache_layout` | Boolean | |
| `handler` | PageHandler | |
| `manually_managed` | Boolean | |

## Reading pages back

```graphql
{
  admin_pages(per_page: 400) {
    total_entries
    results { id slug format request_method physical_file_path content }
  }
}
```

**Read the page back after every write.** A mutation that answers without errors is not
proof that the field you set was stored; check the field you changed.

## Front matter against mutation arguments

The same settings can be expressed two ways, and they are not interchangeable in one
direction. A page's front matter is part of its `content`:

```liquid
---
slug: team/contacts
layout_name: application
format: html
authorization_policies:
  - modules/insites_crm/insites_only_allowed_if_logged_in
---
<h1>Contacts</h1>
```

Setting these in front matter keeps the whole page definition in one string, which is
easier to keep in version control. **Put your `authorization_policies` in the front matter
rather than only in the mutation**, so that a person reading the page file can see the
access control without querying the instance.

Verified against a live instance on 13 August 2026 by schema introspection.
