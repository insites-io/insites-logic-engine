# Module Name - API Reference

## Public API

Document the module's public-facing functions, partials, and GraphQL queries/mutations.

### Function: example_function

The file is `modules/<module-name>/public/lib/example_function.liquid`; the call drops `public/lib/` (insites-cli 6.1.0 resolves partial paths this way).

```liquid
{% liquid
  function result = 'modules/<module-name>/example_function', arg1: value1, arg2: value2
%}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `arg1` | string | yes | Description |
| `arg2` | string | no | Description |

**Returns:** Description of return value.

## Public Partials

### Partial: example_partial

```liquid
{% render 'modules/<module-name>/public/views/partials/example', param: value %}
```

## GraphQL Queries

Document any GraphQL files the module provides.

## See Also

- [README](./README.md)
- [Configuration](./configuration.md)
- [Patterns](./patterns.md)
