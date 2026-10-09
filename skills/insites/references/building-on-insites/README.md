# Building on an Insites instance

You have an Insites instance and you want to put something on it. This is everything
you need, in the order you need it.

**Read this page fully before you write anything.** It is short, and two of the four
sections describe failures that return HTTP 200.

## What an instance is

An Insites instance is a hosted application with a set of modules already installed
(CRM, ecommerce, events, locator, data, assets, forms, CMS and others). You build on
it by adding **pages**, which are Liquid templates, and by calling the **controllers**
those modules already ship.

You do not need to build a database, an admin, an auth system or a REST API. Those
exist. Most of the work of building on Insites is finding what is already there.

## The four things that trip everyone up

Each has its own page. If you read nothing else, read the first two.

| | |
|---|---|
| [Two APIs, two credentials](01-two-apis-two-credentials.md) | There are two APIs and each takes a different credential. Using the wrong one returns **401 with no hint that the credential class was wrong** |
| [Calling a controller](02-calling-a-controller.md) | `{% function %}` and `{% include %}` look interchangeable and are not. One returns a value, the other prints and can hijack your page's HTTP response |
| [Authorization](04-authorization.md) | Calling a controller directly **bypasses** the policy on the REST endpoint that wraps it. A page that omits its own policy publishes whatever the controller returns |
| [Errors and silent failures](06-errors-and-silent-failures.md) | Nothing raises. Errors arrive inside the return value, and several argument mistakes return 200 with plausible data. Two of them return an entire table where you asked for a filtered subset |

## The order to build in

1. **[Get a credential](01-two-apis-two-credentials.md)** and confirm it works with one
   read call.
2. **[Create a page](03-pages.md)**. Nothing renders until a page exists, and a page on
   the filesystem does not route.
3. **[Call a controller](02-calling-a-controller.md)** to get real data onto it.
4. **[Add your own policy](04-authorization.md)** to the page. Do this before the page
   has real data on it, not after.
5. **[Store data](05-storing-data.md)** only once you have checked no module already
   stores it for you.

## Reference

- [Alias inventory](reference/alias-inventory.md) — all 404 controllers, by module.
  **Check here before you invent an endpoint name.**
- [`crm/controller/contacts/list`](reference/crm-contacts-list.md) — a full contract,
  written in the shape every controller reference should have.

## What this pack does not cover

Stated so you can tell a gap from an absence, and so you do not guess:

- Full contracts for the other 403 aliases. The inventory lists their names and modules;
  their arguments are not documented here.
- Anything about the Console beyond minting a token.
- Deploying assets, themes or translations.
- The ecommerce, events and locator modules beyond their alias names.

Everything in this pack was verified against module source or a live instance on
13 August 2026 and re-checked against the v6 module trees (CRM v6.1.2, the rest v6.0.2
to v6.1.0) on 9 October 2026. The version each figure came from is stated where it
matters.
