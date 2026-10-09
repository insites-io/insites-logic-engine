# Partials (Templates & Functions)

Partials contain all presentation HTML and reusable logic. They are the building blocks of the UI layer.

## Location

`app/views/partials/`

> **Module path:** When building a module, use `modules/<module_name>/public/views/partials/` for partials accessible to the app and other modules, or `modules/<module_name>/private/views/partials/` for partials only used within the module.

## Rendering Partials

### As a template (render)
```liquid
{% render 'products/card', product: product, show_price: true %}
```

### As a function (returns data)
```liquid
{% function result = 'lib/commands/products/create', title: "New Product", price: 19.99 %}
```

## Naming Rules

- **NO underscore prefix** in filenames (e.g., `card.liquid`, NOT `_card.liquid`)
- Path in render/function maps to: `app/views/partials/<path>.liquid`
- Example: `render 'products/card'` → `app/views/partials/products/card.liquid`

## Variable Scope

Variables in Insites partials are **LOCAL**. A variable defined inside a partial is NOT available in the page that includes it.

### Exporting variables
Use the `export` tag to make variables available via `context.exports`:

```liquid
{% comment %} In partial {% endcomment %}
{% export my_var, namespace: 'my_namespace' %}

{% comment %} In page after calling partial {% endcomment %}
{{ context.exports.my_namespace.my_var }}
```

### Returning data from function partials
Use the `return` tag:

```liquid
{% comment %} app/views/partials/lib/helpers/calculate_tax.liquid {% endcomment %}
{% assign tax = price | times: 0.2 %}
{% return tax %}
```

## Partial Organization

```
app/views/partials/
├── lib/
│   ├── commands/        # Business logic partials
│   ├── queries/         # Data query wrappers
│   └── helpers/         # Utility functions
├── products/            # Product-related templates
│   ├── card.liquid
│   ├── list.liquid
│   └── form.liquid
├── shared/              # Shared UI components
│   ├── navigation.liquid
│   └── footer.liquid
└── layouts/             # Layout sub-components
```

## Guidelines

- Partials hold most HTML/JS/CSS presentation; small amounts of page-specific markup may live inline in a page (see [Pages](../pages/README.md#inline-html--when-its-allowed)).
- **Pages own data fetching.** Pages call `{% graphql %}` and pass results to partials as render arguments. Partials that need data should receive it from their caller.
- **GraphQL inside partials — when it appears.** Real Combinate addons (notably some older `addon-*` repos) do contain partials that call `{% graphql %}` directly, and `{% function %}`-style partials that exist specifically to encapsulate a query. Treat those as legacy debt: when adding new code, fetch in the page; when working in an existing addon, follow the addon's local convention until you can refactor it. Don't introduce *new* GraphQL-in-partial code in `app-portal` / `app-seedling`-style repos.
- User-facing text can sit in the partial or come from translations with the `t` filter (see Translation Filter in [`liquid/filters/README.md`](../liquid/filters/README.md#translation-filter)).
- Use `{% render %}` for display-only partials; use `{% function %}` for partials that return data.
