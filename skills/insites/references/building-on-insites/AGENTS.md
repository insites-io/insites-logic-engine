# Insites

Paste this file into the root of a project that builds on an Insites instance.

## Two APIs, two credentials. This is the mistake to avoid

| You want | Endpoint | Credential | Header |
|---|---|---|---|
| Module data (contacts, orders, activities) | `https://<instance>/<module>/api/v2/...` | Instance API key | `Authorization: <key>` — no `Bearer` prefix |
| The instance itself (pages, partials, assets, tables) | `POST https://<instance>/api/graph` | Console CLI token | `Authorization: Token <token>` |

The instance API key on `/api/graph` returns **401 with no indication that the credential
class was wrong**. If a call 401s, check which API you are on before you check the key.

Mint a Console CLI token:

```
POST https://console.insites.io/api/console/cli/login
UserAuthorization: <console-email>:<console-password>
InstanceUUID: <instance-uuid>
```

Returns `{"pos_login": {"token": "..."}}`.

## Two calling rules

1. **`{% function %}` to call a controller, never `{% include %}`.**
   `{% function x = 'crm/controller/contacts/list', params: p %}` binds the return value.
   `{% include %}` prints the controller's output into your page and discards the return
   value, and on some controllers it will also set your page's `Content-Type` and HTTP
   status.

2. **An alias is not a file path.** `crm/controller/contacts/list` appears nowhere in
   module source as a string. It is declared in the `path:` front matter of the partial
   that implements it. The alias is stable; the file behind it moves between versions.

## Three traps

- **Nothing raises.** A failed call returns a hash with an `errors` key and no `results`.
  Branch on `errors` before touching `results`, every time.
- **A missing filter is not an error.** Omit the `keyword` argument on a list controller
  and you get the whole table, ten rows at a time, on a page that looks like it works.
- **Calling a controller bypasses the REST endpoint's authorization policy**, because that
  endpoint's page is never involved. Declare `authorization_policies:` in your own page's
  front matter or your page has no access control.

## Before inventing an endpoint

404 controller aliases exist across eight v6 modules (pipelines 107, ecommerce 105,
data 61, crm 59, events 37, locator 23, assets 7, api 5; counted 9 October 2026). Check
the inventory before writing a name. A call to an alias that does not exist fails at
render time with a partial-not-found error, and nine names the modules' own API docs
quote are among the ones that do not exist.

## Do not

- Call `<instance>/<module>/api/v2/...` for data on the instance that is serving your
  page. Call the controller: no HTTP round trip, no key to manage, no rate limit.
- Introspect the GraphQL schema without `includeDeprecated: true`. The default view hides
  21 queries and 52 mutations that all still execute.
