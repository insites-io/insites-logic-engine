# Pages -- Patterns & Best Practices

Common workflows and real-world patterns for page files in Insites.

## Standard CRUD Resource

The most common pattern: a full set of pages for managing a resource.

### List page (GET)

```liquid
---
slug: products
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
  assign page = context.params.page | default: 1 | plus: 0
  graphql result = 'products/search', page: page
  render 'products/index', products: result.records.results, total_pages: result.records.total_pages, current_page: page
%}
```

### Show page (GET)

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
  graphql result = 'products/find', id: context.params.id
  assign product = result.records.results.first
  if product == blank
    render '404'
    break
  endif
  render 'products/show', product: product
%}
```

### Create page (POST)

```liquid
---
slug: products
method: post
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
  function result = 'lib/commands/products/create', params: context.params
  if result.errors != blank
    render 'products/new', errors: result.errors, params: context.params
    break
  endif
%}
{% parse_json flash %}
  { "notice": "Product created", "from": {{ context.location.pathname | json }} }
{% endparse_json %}
{% liquid
  assign flash_json = flash | json
  session sflash = flash_json
  redirect_to '/products'
  break
%}
```

### Update page (PUT)

```liquid
---
slug: products/:id
method: put
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
  function result = 'lib/commands/products/update', id: context.params.id, params: context.params
  if result.errors != blank
    render 'products/edit', errors: result.errors, params: context.params, id: context.params.id
    break
  endif
%}
{% parse_json flash %}
  { "notice": "Product updated", "from": {{ context.location.pathname | json }} }
{% endparse_json %}
{% liquid
  assign flash_json = flash | json
  session sflash = flash_json
  redirect_to '/products/' | append: context.params.id
  break
%}
```

### Delete page (DELETE)

```liquid
---
slug: products/:id
method: delete
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
  graphql _ = 'products/delete', id: context.params.id
  assign flash = '{"notice": "Product deleted", "from": "/products"}' | parse_json
  assign flash_json = flash | json
  session sflash = flash_json
  redirect_to '/products'
  break
%}
```

## API Endpoint Pattern

Return JSON instead of rendering HTML.

```liquid
---
slug: api/products
layout: ""
---
{% liquid
  assign page = context.params.page | default: 1 | plus: 0
  graphql result = 'products/search', page: page
  render 'api/products/list', products: result.records.results
%}
```

The partial (`api/products/list.liquid`) outputs JSON:

```json
{
  "products": [
    {% for product in products %}
      { "id": {{ product.id }}, "title": {{ product.title | json }} }{% unless forloop.last %},{% endunless %}
    {% endfor %}
  ]
}
```

For `.json.liquid` files the content type is set automatically.

## Flash Message Pattern

Set a flash message before redirecting, then display it via the layout toast system.

```liquid
{% parse_json flash %}
  { "notice": "Operation successful", "from": {{ context.location.pathname | json }} }
{% endparse_json %}
{% liquid
  assign flash_json = flash | json
  session sflash = flash_json
  redirect_to '/products'
  break
%}
```

The `from` property ensures the flash is cleared after being shown on the target page.

## Authentication Guard Pattern

Every page that requires login should check authentication early. Use `authorization_policies` in front matter for page-level guards, and inline checks for finer control:

```liquid
---
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
%}
```

The `authorization_policies` in front matter blocks unauthenticated users at the platform level. The inline check provides additional profile-level validation.

## Conditional Rendering Pattern

Use `break` to exit early after rendering an error or alternate view:

```liquid
{% liquid
  graphql result = 'products/find', id: context.params.id
  assign product = result.records.results.first
  if product == blank
    render '404'
    break
  endif
  if product.status == 'draft'
    render 'products/preview', product: product
    break
  endif
  render 'products/show', product: product
%}
```

## Form Handling Pattern

A GET page renders the form; a POST page processes the submission:

```liquid
{% comment %} GET: products/new.liquid {% endcomment %}
---
slug: products/new
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
  render 'products/form', action: '/products', method: 'post'
%}
```

The form partial includes CSRF token and submits to the POST endpoint.

## Best Practices

1. **Keep pages thin** -- pages should be 5-15 lines of Liquid logic maximum
2. **Authenticate first** -- always check permissions before fetching data
3. **Use `break` for early returns** -- render an error view and `break` to stop execution
4. **One method per file** -- never check `context.method` to branch logic
5. **Shared HTML in partials** -- markup reused across pages, or composed from three or more blocks, goes in partials; a simple page can keep its own HTML (`pages-prefer-partials-for-shared-html`)
6. **Fetch in the page** -- pass data down to presentation partials; only block, calculation and callback partials query (`graphql-in-partials-restricted`)
7. **Flash before redirect** -- set session flash, then redirect
8. **Use translations for more than one language** -- text in the template works; move it to `app/translations/<locale>.yml` and the `t` filter when the site serves more than one language

## See Also

- [Pages Overview](README.md) -- introduction and key concepts
- [Pages Configuration](configuration.md) -- front matter and file structure
- [Pages API](api.md) -- tags and filters available in pages
- [Pages Gotchas](gotchas.md) -- common errors and limits
- [Partials Patterns](../partials/patterns.md) -- patterns for the partials pages delegate to
- [Forms Reference](../forms/README.md) -- `callback_actions` blocks handle create/update/delete (canonical replacement for the older command pattern)
