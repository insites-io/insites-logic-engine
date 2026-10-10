# Pages (Controllers)

Pages in Insites act primarily as **controllers**. They live in `app/views/pages/` or `modules/<name>/public/views/pages/`, fetch data via `{% graphql %}`, and delegate the bulk of rendering to partials via `{% render %}`.

> **Module path:** Pages live in `app/views/pages/` or `modules/<module_name>/public/views/pages/`. Both trees are valid: `app/` holds the site itself, and `modules/<name>/` holds code you want to reuse or package (see [`project-structure.md`](../project-structure.md)).

## Inline HTML — when it's allowed

The strict rule "pages never contain HTML, JS, or CSS" reflects an *ideal* — not what real Combinate codebases enforce. Reading the canonical reference repos (`app-portal`, `app-seedling`), pages routinely contain small amounts of inline HTML where extracting a partial would be more friction than payoff:

- **Tiny page-specific markup** — a single wrapper `<div>`, a `<title>` set, or a one-off heading that no other page reuses.
- **JSON pages (`.json.liquid`)** — frequently inline their entire JSON body since there is nothing to delegate.
- **Redirect/error pages** — short flow-control pages whose entire body is a status code + a one-line message.

The hard rule is the **opposite**: anything that could plausibly be reused — a card, a list item, a form section, a navigation block — belongs in a partial. The `{% render %}` boundary exists so that markup is shareable, not because every page must be a pure controller.

If you find yourself writing more than ~10 lines of HTML in a page, that's the signal to extract a partial.

## Key Purpose

Pages are the entry point for every HTTP request in a Insites application. They serve three roles:

1. **Route handling** -- each file maps to a URL endpoint with a single HTTP method
2. **Data fetching** -- pages call GraphQL queries/mutations to interact with the database
3. **Delegation** -- pages pass fetched data to partials for rendering or processing

Think of pages as thin controllers: authenticate, fetch, delegate, done.

## When to Use

- **Creating a new URL endpoint** -- every publicly accessible route needs a page file
- **Handling form submissions** -- POST/PUT/DELETE actions each get their own page
- **Building API endpoints** -- use `.json.liquid` extension for JSON responses
- **Serving dynamic content** -- combine GraphQL data fetching with partial rendering

You do NOT need a page when:
- You need a reusable UI component (use a partial instead)
- You need a shared function (use a `lib/` partial)
- You need to define data structure (use a schema table)

## How It Works

1. A request arrives at a URL (e.g., `GET /products/123`)
2. Insites matches the URL against page file slugs
3. The matching page's front matter defines method, layout, and metadata
4. The page body executes: authenticate user, run GraphQL, render partials
5. The output is wrapped in the specified layout and returned to the client

```
Request → Route Match → Front Matter → Page Body → Layout Wrap → Response
```

### Minimal page example

```liquid
---
slug: products/:id
authorization_policies:
  - is_logged_in
---
{% liquid
  if context.current_user
    graphql g = 'users/current', id: context.current_user.id
    assign profile = g.users.results.first
  else
    assign profile = null
  endif
  unless profile
    response_status 403
    render 'errors/unauthorized'
    break
  endunless
  graphql product = 'products/find', id: context.params.id
  render 'products/show', product: product
%}
```

## Getting Started

1. Create a file in `modules/<module>/public/views/pages/` (e.g., `modules/dashboard/public/views/pages/products/index.liquid`)
2. Add front matter with `slug` and optionally `method` and `layout`
3. Write the controller logic using `{% liquid %}` block
4. Fetch data with `{% graphql %}` and delegate with `{% render %}`
5. Run `insites-cli deploy` or use `insites-cli gui serve` to test locally

### File naming conventions

| Action  | File                         | Method | Slug               |
|---------|------------------------------|--------|---------------------|
| List    | `products/index.liquid`      | GET    | `products`          |
| Show    | `products/show.liquid`       | GET    | `products/:id`      |
| New     | `products/new.liquid`        | GET    | `products/new`      |
| Create  | `products/create.liquid`     | POST   | `products`          |
| Edit    | `products/edit.liquid`       | GET    | `products/:id/edit` |
| Update  | `products/update.liquid`     | PUT    | `products/:id`      |
| Delete  | `products/delete.liquid`     | DELETE | `products/:id`      |

### File extensions and content types

| Extension          | Content-Type             | URL        |
|--------------------|--------------------------|------------|
| `.liquid`          | `text/html`              | `/path`    |
| `.html.liquid`     | `text/html`              | `/path`    |
| `.json.liquid`     | `application/json`       | `/path.json` |
| `.js.liquid`       | `application/javascript` | `/path.js` |

## See Also

- [Routing](../routing/README.md) -- how URLs map to page files
- [Layouts](../layouts/README.md) -- how pages are wrapped in HTML shells
- [Partials](../partials/README.md) -- the templates pages delegate to
- [GraphQL](../graphql/README.md) -- data fetching used inside pages
- [Liquid Tags](../liquid/tags/README.md) -- `graphql`, `render`, `redirect_to` tags
