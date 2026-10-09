# Partials -- Gotchas & Troubleshooting

## Common Errors

### "Partial not found"

**Cause:** The path in render/function does not match a file in `app/views/partials/`.

**Solution:** Verify the path maps correctly. `{% render 'products/card' %}` expects `app/views/partials/products/card.liquid`. Check for typos and ensure the `.liquid` extension exists on disk.

> **Module note:** If the partial is inside a module, check `modules/<module_name>/public/views/partials/` or `private/views/partials/` instead.

### "Variable is nil inside partial"

**Cause:** Variables are LOCAL to each partial. The caller's variables are not accessible unless explicitly passed.

**Solution:** Pass all needed variables as parameters:
```liquid
{% render 'products/card', product: product, user: profile %}
```

### "GraphQL tag in partial causes error or is ignored"

**Cause:** GraphQL calls should only be made in pages. Using `{% graphql %}` in a presentation partial breaks the `graphql-in-partials-restricted` rule. `insites-cli audit` does not check this.

**Solution:** Move the GraphQL call to the page and pass the result to the partial as a parameter.

### "Function returns nil"

**Cause:** The partial called via `{% function %}` does not have a `{% return %}` tag, or execution does not reach the return statement.

**Solution:** Ensure every code path in a function partial ends with `{% return value %}`.

### "Underscore-prefixed partial not found"

**Cause:** Insites does NOT use underscore prefixes for partials (unlike Rails/Shopify conventions).

**Solution:** Rename `_card.liquid` to `card.liquid`. `insites-cli audit` flags it only when `card.liquid` and `_card.liquid` both exist at the same path; a lone `_card.liquid` passes.

### "Export variable not accessible"

**Cause:** Missing namespace in export tag, or accessing wrong namespace path.

**Solution:** Always provide namespace: `{% export var, namespace: 'ns' %}`. Access via `{{ context.exports.ns.var }}`.

### "Should user-facing text be hardcoded?"

**Cause:** Nothing flags it. `insites-cli audit` does not check user-facing text.

**Solution:** Text written in the partial works (`<h1>Products</h1>`). When the site serves more than one language, move it to translation files and read it with `{{ 'app.products.title' | t }}` (see Translation Filter in [`liquid/filters/README.md`](../liquid/filters/README.md#translation-filter)).

## Limits

| Limit | Value | Notes |
|-------|-------|-------|
| Nested render depth | 10 levels | Default max_deep_level |
| Partial file size | 1 MB | Keep partials focused and small |
| Variables per render | No hard limit | Pass only what's needed |
| Partials per page | No hard limit | But more partials = slower render |

## Troubleshooting Flowchart

```
Partial problem?
├── Partial not found?
│   ├── Check path matches app/views/partials/<path>.liquid
│   ├── Check no underscore prefix in filename
│   └── Check file has .liquid extension
├── Variable is nil?
│   ├── Check variable is passed as parameter in render/function
│   ├── Check parameter name matches (case-sensitive)
│   └── Remember: variables are LOCAL to each partial
├── Function returns nil?
│   ├── Check {% return %} exists in the partial
│   ├── Check all code paths reach return
│   └── Check partial is called via function (not render)
└── Linter errors?
    ├── No underscore prefix in filenames
    ├── Use clear, descriptive text for user-facing strings
    └── No GraphQL calls in partials
```

## See Also

- [Partials Overview](README.md)
- [configuration.md](configuration.md) — file naming and structure
- [api.md](api.md) — render, function, return, export reference
- [patterns.md](patterns.md) — best practices
- [CLI](../cli/README.md) — insites-cli audit linter
