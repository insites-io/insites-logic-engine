# Partials -- Patterns & Best Practices

## UI Component Pattern

Presentational partials receive all data as parameters and produce HTML.

```liquid
{% comment %} app/views/partials/products/card.liquid {% endcomment %}
<div class="pos-card">
  <h3 class="pos-card__title">{{ product.title }}</h3>
  {% if show_price %}
    <p class="pos-card__price">{{ product.price | pricify }}</p>
  {% endif %}
  <a href="/products/{{ product.id }}" class="pos-button">View</a>
</div>
```

Called from a page:

```liquid
{% for product in products.results %}
  {% render 'products/card', product: product, show_price: true %}
{% endfor %}
```

## Function Partial Pattern (Query Wrapper)

Put a query used in several places in its own partial, run it there, and return the result. Call it with `{% function %}`; the caller then passes the result on to presentation partials.

```liquid
{% comment %}
  app/views/partials/queries/products/list.liquid
  Called as: function products = 'queries/products/list', limit: 20
{% endcomment %}
{%- graphql r, limit: limit -%}
  query ($limit: Int) {
    records(per_page: $limit, filter: { table: { value: "product" } }) {
      results { id properties }
    }
  }
{%- endgraphql -%}
{%- return r.records.results -%}
```

```liquid
{% comment %} In the page {% endcomment %}
{%- function products = 'queries/products/list', limit: 20 -%}
{%- render 'products/grid', products: products -%}
```

The platform runs `{% graphql %}` inside a partial called this way: `signin/take_slot` in [authentication patterns](../authentication/patterns.md) does the same with a mutation, measured on a production instance on 9 October 2026.

## Command Partial Pattern

> **Note:** the older "command partial" pattern (build → check → execute under `lib/commands/`) is **not used in canonical Combinate**. State-changing logic lives in `forms/<name>.liquid` `callback_actions` blocks. See [Forms](../forms/README.md). The example below is retained only as a reference for legacy partial-as-function patterns; do not generate code at `lib/commands/` paths.

```liquid
{% comment %} app/views/partials/lib/commands/products/create.liquid {% endcomment %}
{% liquid
  comment Build: parse_json IS the build step
%}
{% parse_json object %}
  { "title": {{ title | json }}, "price": {{ price | json }} }
{% endparse_json %}
{% liquid
  hash_assign object['valid'] = true
  hash_assign object['errors'] = '{}' | parse_json

  comment Check: inline validation
  if object.title == blank
    assign field_errors = object.errors.title | default: '[]' | parse_json | add_to_array: "can't be blank"
    hash_assign object['errors']['title'] = field_errors
    hash_assign object['valid'] = false
  endif

  comment Execute: run GraphQL mutation if valid
  if object.valid
    graphql r = 'products/create', args: object
    assign object = r.record_create
    hash_assign object['valid'] = true
  endif

  return object
%}
```

## Form Partial with Validation Errors

```liquid
{% comment %} app/views/partials/products/form.liquid {% endcomment %}
<form method="post" action="/products">
  <input type="hidden" name="authenticity_token" value="{{ context.authenticity_token }}">

  <div class="pos-form-group {% if product.errors.title %}pos-form-group--error{% endif %}">
    <label for="title">Title</label>
    <input type="text" id="title" name="product[title]" value="{{ product.title }}">
    {% if product.errors.title %}
      <span class="pos-form-error">{{ product.errors.title | join: ', ' }}</span>
    {% endif %}
  </div>

  <button type="submit" class="pos-button pos-button--primary">Save</button>
</form>
```

## Nested Partials

Partials can render other partials (but watch nesting depth):

```liquid
{% comment %} products/list.liquid {% endcomment %}
<div class="products-grid">
  {% for product in products %}
    {% render 'products/card', product: product, show_price: true %}
  {% endfor %}
</div>
{% render 'shared/pagination', total_pages: total_pages %}
```

## Helper Function Pattern

Small utility partials that return computed values:

```liquid
{% comment %} lib/helpers/format_price.liquid {% endcomment %}
{% if currency == blank %}
  {% assign currency = 'USD' %}
{% endif %}
{% assign formatted = amount | pricify: currency %}
{% return formatted %}
```

## Extracting Reusable Code (Refactoring)

When you see the same logic repeated across multiple files, extract it into a reusable partial. This is the primary way to keep code DRY in Insites.

### When to extract

| Signal | Extract into |
|--------|-------------|
| Same validation check in 3+ commands | `lib/validations/presence.liquid` |
| Same GraphQL execute + error log in every command | `lib/commands/execute.liquid` |
| Same UI block on multiple pages | `shared/card.liquid`, `shared/pagination.liquid` |
| Same auth guard in multiple pages | `authorization_policies/is_admin.liquid` or `lib/helpers/guard.liquid` |
| Same data transformation | `lib/helpers/format_price.liquid` |

### Example: Extracting a validation helper

**Before** — same presence check duplicated in every command:
```liquid
{% comment %} commands/products/create.liquid {% endcomment %}
{% if object.title == blank %}
  {% assign errs = c.errors.title | default: '[]' | parse_json | add_to_array: "can't be blank" %}
  {% hash_assign c['errors']['title'] = errs %}
  {% hash_assign c['valid'] = false %}
{% endif %}

{% comment %} commands/orders/create.liquid — same pattern, different field {% endcomment %}
{% if object.customer_name == blank %}
  {% assign errs = c.errors.customer_name | default: '[]' | parse_json | add_to_array: "can't be blank" %}
  {% hash_assign c['errors']['customer_name'] = errs %}
  {% hash_assign c['valid'] = false %}
{% endif %}
```

**After** — extracted into a reusable helper:
```liquid
{% comment %} app/views/partials/lib/validations/presence.liquid {% endcomment %}
{% liquid
  if object[field_name] == blank
    assign message = message | default: "can't be blank"
    assign errs = c.errors[field_name] | default: '[]' | parse_json | add_to_array: message
    hash_assign c['errors'][field_name] = errs
    hash_assign c['valid'] = false
  endif
  return c
%}
```

Now every command calls it in one line:
```liquid
{% function c = 'lib/validations/presence', c: c, object: object, field_name: 'title' %}
{% function c = 'lib/validations/presence', c: c, object: object, field_name: 'price' %}
```

### Example: Extracting the execute pattern

**Before** — same 4 lines in every command:
```liquid
{% graphql r = 'products/create', args: object %}
{% if r.errors %}{% log r, type: 'ERROR' %}{% endif %}
{% assign object = r.record_create %}
{% hash_assign object['valid'] = true %}
```

**After** — reusable execute helper:
```liquid
{% comment %} app/views/partials/lib/commands/execute.liquid {% endcomment %}
{% liquid
  assign selection = selection | default: 'record'
  graphql r = mutation_name, args: object
  if r.errors
    log r, type: 'ERROR: execute'
  endif
  assign object = r[selection]
  hash_assign object['valid'] = true
  return object
%}
```

Called as:
```liquid
{% function object = 'lib/commands/execute', mutation_name: 'products/create', selection: 'record_create', object: object %}
```

### Example: Extracting a shared UI component

**Before** — same card markup in 3 different list pages:
```liquid
<div class="pos-card">
  <h3>{{ item.title }}</h3>
  <p>{{ item.description | truncate: 100 }}</p>
  <a href="/{{ resource }}/{{ item.id }}">View</a>
</div>
```

**After** — one reusable partial:
```liquid
{% comment %} app/views/partials/shared/card.liquid {% endcomment %}
<div class="pos-card">
  <h3>{{ title }}</h3>
  {% if description %}
    <p>{{ description | truncate: 100 }}</p>
  {% endif %}
  <a href="{{ url }}" class="pos-button">{{ link_text | default: 'View' }}</a>
</div>
```

Called as:
```liquid
{% render 'shared/card', title: product.title, description: product.description, url: '/products/' | append: product.id %}
```

### Example: Extracting an authorization policy

**Before** — same inline guard repeated in every admin page:
```liquid
{% unless context.current_user %}
  {% response_status 403 %}
  {% render 'errors/unauthorized' %}
  {% break %}
{% endunless %}
```

**After** — authorization policy file:
```liquid
{% comment %} app/authorization_policies/is_logged_in.liquid {% endcomment %}
---
name: is_logged_in
redirect_to: /login
flash_alert: Please log in to access this page.
---
{% if context.current_user %}true{% endif %}
```

Applied declaratively in page front matter:
```yaml
---
slug: admin/dashboard
authorization_policies:
  - is_logged_in
---
```

### When NOT to extract

- **Used only once** — extracting a one-off block adds indirection without reducing duplication
- **Logic differs between uses** — if the "shared" code needs heavy conditional branches per caller, keep it inline
- **Trivial code** — a single `if` check isn't worth a separate file

## Best Practices

1. **Presentation partials take their data as parameters.** Only block, calculation and callback partials, and query wrappers called with `function`, run GraphQL (`graphql-in-partials-restricted`)
2. **Write clear user-facing strings**, in the partial or in translations when the site serves more than one language
3. **No underscore prefix** — `card.liquid` not `_card.liquid`
4. **Keep partials focused** — one component or one function per file
5. **Use function for data, render for HTML** — clear separation of concerns
6. **Pass only needed data** — don't pass the entire context object

## See Also

- [Partials Overview](README.md)
- [api.md](api.md) — tag reference
- [gotchas.md](gotchas.md) — common errors
- [Forms](../forms/README.md) — state-changing logic via `callback_actions` (canonical replacement for the older command pattern)
