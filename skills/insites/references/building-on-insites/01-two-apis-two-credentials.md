# Two APIs, two credentials

**This is the first wall, and it stops nearly everyone.** An instance exposes two
different APIs at two different paths, and each accepts a different class of credential.
Using the wrong one returns a bare `401` with nothing to tell you the credential was the
wrong *kind* rather than the wrong *value*.

## Which API you want

| You want to work with | Use | Path |
|---|---|---|
| **Module data** — contacts, companies, orders, activities, tasks | The module REST API | `https://<instance>/<module>/api/v2/<resource>` |
| **The instance itself** — pages, partials, assets, tables | The admin GraphQL API | `POST https://<instance>/api/graph` |

There is no third option. `/api/graphql`, `/graphql`, `/api/v2/graph` and
`/admin/graphql` all return 404.

## The module REST API

Takes the **instance API key**, sent raw.

```
GET https://<instance>/crm/api/v2/contacts?per_page=1
Authorization: <instance-api-key>
Accept: application/json
```

- **No `Bearer` prefix.** Adding one returns `401`.
- Rate limited to 300 requests per 60 seconds.
- Every endpoint and every field it returns is documented on the instance itself at
  `https://<instance>/admin/api`, which is readable without credentials, and in
  machine-readable form at `https://<instance>/admin/json/<module>/<resource>`.

**Do not use this for data on the instance serving your page.** It is an HTTP round trip
to yourself, a key to manage and a rate limit you did not need. Call the controller
instead. See [Calling a controller](02-calling-a-controller.md).

## The admin GraphQL API

Takes a **Console CLI token**. The instance API key does not work here, in any header
form.

Mint the token:

```
POST https://console.insites.io/api/console/cli/login
UserAuthorization: <console-email>:<console-password>
InstanceUUID: <instance-uuid>
Content-Type: application/json
Accept: application/json

{}
```

Returns `{"pos_login": {"token": "..."}}`.

Then use it:

```
POST https://<instance>/api/graph
Authorization: Token <token>
Content-Type: application/json
Accept: application/json

{"query": "{ admin_pages(per_page: 1) { total_entries } }"}
```

## Introspection hides a third of the schema

The default introspection view reports **36 queries and 93 mutations**. With
`includeDeprecated: true` it reports **57 and 145**. The extra 21 queries and 52
mutations are marked deprecated and **all still execute**.

Always introspect with the flag, or a validator built on the default view will report
every use of a live deprecated field as an invented one:

```graphql
{
  __schema { queryType { name } mutationType { name } }
}
```

then, using the names it returns:

```graphql
{
  q: __type(name: "<queryTypeName>")    { fields(includeDeprecated: true) { name } }
  m: __type(name: "<mutationTypeName>") { fields(includeDeprecated: true) { name } }
}
```

Note that `__type(name: "Mutation")` returns `null` on an instance. The mutation type is
not called `Mutation`, so ask the schema for its real name first.

## Send `Accept` and `User-Agent` from every script

Two headers that browsers and `curl` send for you, and some HTTP libraries do not:

- **`Accept`.** An instance picks a page's response format from the `Accept` header. Measured on a v6 production instance on 24 October 2026: a module REST call (`/crm/api/v2/contacts`) with no `Accept` header, from Python's `urllib`, which sends none, answered **404 with the HTML Not Found page**; the same call with `Accept: */*` answered 200 with JSON. On other instances the same request has come back as the Not Found body with HTTP 200. Send `Accept: application/json` (or `*/*`) on every call.
- **`User-Agent`.** Instances on the Insites stack sit behind a firewall that refuses some library default agents with **403** and the body `error code: 1010`. Measured the same day: Python `urllib`'s default (`Python-urllib/3.x`) was refused on every URL, while `curl`, `python-requests`, a custom string and a request with no `User-Agent` header at all were answered. Send your own `User-Agent` naming your tool.

A 403 with `error code: 1010` is the firewall, not the instance and not your credential.

## Diagnosing a 401

| Symptom | Cause |
|---|---|
| `401` on `/api/graph` with the instance API key | Wrong credential class. You need a Console CLI token |
| `401` on `/<module>/api/v2/...` with a `Bearer` prefix | Send the key raw, with no prefix |
| `HTTP Token: Access denied.` on `/api/graph` | No `Authorization` header reached the server, or the token is not a Console CLI token |

Verified against a live instance on 13 August 2026.
