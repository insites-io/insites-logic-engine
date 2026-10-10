# Liquid Tags -- Patterns

Common workflows, best practices, and real-world examples for Insites Liquid tags.

## Page Controller Pattern

Every page should follow the thin-controller pattern: authenticate, fetch, delegate.

```liquid
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
  graphql orders = 'orders/search', user_id: profile.id, page: context.params.page
  render 'orders/index', orders: orders.records.results, user: profile
%}
```

**Key rules:**
- Pages contain NO HTML -- only logic tags
- Always check authorization before fetching data
- Pass only the data each partial needs

## Function + Return Pattern

Use `function` for partials that compute and return data. Use `render` for partials that produce HTML.

### Data function partial (`app/views/partials/lib/commands/orders/create.liquid`)

```liquid
{% liquid
  assign order_data = '{ "table": "orders", "properties": [{ "name": "status", "value": "pending" }] }' | parse_json
  graphql result = 'records/create', record: order_data
  return result
%}
```

### Calling the function

```liquid
{% liquid
  function order = 'lib/commands/orders/create', user_id: profile.id, items: cart_items
  if order.errors
    render 'orders/errors', errors: order.errors
    break
  endif
  redirect_to '/orders/' | append: order.id
%}
```

## Background Job Pattern

Offload slow operations (emails, API calls, heavy processing) to background jobs.

```liquid
{% liquid
  graphql order = 'orders/create', data: payload
  background job_id = 'jobs/order_confirmation', to: email, order_id: order.id, source_name: 'order_confirmation', delay: 0.1, priority: 'default', max_attempts: 3
%}
```

`jobs/order_confirmation` sends the email with `to` and `order_id`, the only page values it can see.

### Background partial form (preferred for complex jobs)

```liquid
{% background job = 'lib/jobs/process_payment', order_id: order.id, amount: total, delay: 0, priority: 'high' %}
```

## Transaction Pattern

Use transactions for multi-step operations that must succeed or fail together.

```liquid
{% liquid
  try
    transaction timeout: 5
      graphql order = 'orders/create', data: order_data
      graphql _ = 'inventory/decrement', product_id: pid, quantity: qty
      graphql _ = 'ledger/credit', account_id: account, amount: total
      if order.errors
        rollback
      endif
    endtransaction
  catch error
    log error, type: 'error'
    assign error_message = 'Transaction failed. Please try again.'
  endtry
%}
```

## Caching Pattern

Cache expensive queries or rendered fragments.

```liquid
{% cache 'homepage_featured', expire: 1800 %}
  {% graphql featured = 'products/featured', limit: 12 %}
  {% render 'products/grid', products: featured.records.results %}
{% endcache %}
```

### Dynamic cache keys

```liquid
{% liquid
  assign cache_key = 'products_' | append: context.params.category | append: '_page_' | append: context.params.page
%}
{% cache cache_key, expire: 600 %}
  {% graphql products = 'products/by_category', category: context.params.category, page: context.params.page %}
  {% render 'products/list', products: products.records.results %}
{% endcache %}
```

## Error Handling Pattern

Wrap external calls and risky operations in try/catch.

```liquid
{% liquid
  try
    graphql result = 'integrations/stripe/charge', amount: total, token: token
  catch error
    log error, type: 'error'
    assign result = '{ "errors": [{ "message": "Payment processing failed" }] }' | parse_json
  endtry
%}
```

## Building JSON Payloads with parse_json

Use `parse_json` with Liquid interpolation to build dynamic hashes.

```liquid
{% parse_json filters %}
  {
    "table": { "value": "products" },
    "properties": [
      { "name": "status", "value": "active" },
      { "name": "category", "value": {{ category | json }} }
    ]
  }
{% endparse_json %}
{% liquid
  graphql products = 'records/search', filter: filters, per_page: 20
%}
```

## Session + Authentication Flow

```liquid
{% liquid
  graphql user = 'users/authenticate', email: context.params.email, password: context.params.password
  if user.errors
    render 'sessions/login_form', errors: user.errors
    break
  endif
  sign_in user_id: user.id, timeout_in_minutes: 1440
  session last_login = 'now' | to_time
  redirect_to context.params.return_url | default: '/'
%}
```

## Export Pattern for Cross-Partial Communication

When partials need to share computed data without direct argument passing:

### Producer partial

```liquid
{% liquid
  graphql nav = 'navigation/main'
  export nav, namespace: 'layout'
%}
```

### Consumer (in layout or another partial)

```liquid
{% render 'shared/build_navigation' %}
{% assign nav = context.exports.layout.nav %}
<nav>
  {% for item in nav %}
    <a href="{{ item.url }}">{{ item.title }}</a>
  {% endfor %}
</nav>
```

## Content Blocks for Layouts

Push page-specific content into layout slots.

### In a page or partial

```liquid
{% content_for 'meta' %}
  <meta name="description" content="{{ product.description | truncate: 160 }}">
  <meta property="og:title" content="{{ product.name }}">
{% endcontent_for %}

{% content_for 'page_scripts' %}
  <script src="{{ 'product-gallery.js' | asset_url }}" defer></script>
{% endcontent_for %}
```

### In the layout

```liquid
<head>
  {% yield 'meta' %}
</head>
<body>
  {{ content_for_layout }}
  {% yield 'page_scripts' %}
</body>
```

## API Endpoint Pattern

Build JSON API responses with proper headers and status codes.

```liquid
{% liquid
  response_headers '{"Content-Type": "application/json", "Cache-Control": "no-store"}'
  if context.current_user
    graphql g = 'users/current', id: context.current_user.id
    assign profile = g.users.results.first
  else
    assign profile = null
  endif
  unless profile
    response_status 401
    render 'api/error', message: 'Unauthorized'
    break
  endunless
  graphql data = 'products/search', user_id: profile.id
  response_status 200
  render 'api/products/list', products: data.records.results
%}
```

## Hash Manipulation Pattern

Build and modify hashes dynamically.

```liquid
{% liquid
  assign defaults = '{ "per_page": 20, "sort": "created_at", "order": "desc" }' | parse_json
  hash_assign defaults["per_page"] = context.params.per_page | default: 20 | to_positive_integer: 20
  hash_assign defaults["sort"] = context.params.sort | default: 'created_at'
  graphql results = 'records/search', options: defaults
%}
```

## Whitespace Stripping with `{%- -%}`

Use `{%- -%}` (hyphenated tags) to strip whitespace before and after the tag. This prevents blank lines in rendered HTML output.

### When to use `{%- -%}` — HTML template partials

Without stripping, every Liquid tag leaves a blank line in the output:

```liquid
{% comment %} BAD: Produces blank lines between each element {% endcomment %}
{% assign name = user.first_name %}
{% assign greeting = 'Hello, ' | append: name %}
<h1>{{ greeting }}</h1>
```

Output has empty lines above `<h1>`. With stripping:

```liquid
{%- assign name = user.first_name -%}
{%- assign greeting = 'Hello, ' | append: name -%}
<h1>{{ greeting }}</h1>
```

Clean output with no blank lines.

### When NOT to use `{%- -%}` — inside `{% liquid %}` blocks

Inside `{% liquid %}` blocks, there is no HTML output, so whitespace stripping is irrelevant and adds visual noise:

```liquid
{% comment %} CORRECT: No hyphens needed inside liquid block {% endcomment %}
{% liquid
  assign name = user.first_name
  assign greeting = 'Hello, ' | append: name
  render 'shared/greeting', message: greeting
%}
```

### Practical rule

| Context | Use | Example |
|---------|-----|---------|
| Tags mixed with HTML | `{%- -%}` | `{%- assign logo = brand.logo | asset_url -%}` |
| `{{ }}` output mixed with HTML | `{{- -}}` | `{{- product.title -}}` |
| Inside `{% liquid %}` blocks | Plain (no hyphens) | `assign logo = brand.logo | asset_url` |
| Logic-only partials (commands, queries) | `{% liquid %}` block (preferred) | Keeps all logic clean without needing hyphens |

### Real-world example — layout partial with clean output

```liquid
{%- function brand = 'lib/queries/brand/get' -%}
{%- assign logo = brand.logo | asset_url -%}
{%- assign icon = brand.icon | asset_url -%}
<link rel="icon" href="{{ icon }}">
<img src="{{ logo }}" alt="{{ brand.name }}">
```

Without the `{%- -%}`, there would be 2 blank lines above the `<link>` tag in the rendered HTML.

## See Also

- [Tags Overview](README.md) -- tag categories and concepts
- [Tags API](api.md) -- complete syntax reference
- [Tags Configuration](configuration.md) -- all parameters and options
- [Tags Gotchas](gotchas.md) -- common errors to avoid
- [Tags Advanced](advanced.md) -- optimization techniques
- [Partials](../../partials/README.md) -- partial organization and conventions
- [GraphQL](../../graphql/README.md) -- query and mutation patterns
