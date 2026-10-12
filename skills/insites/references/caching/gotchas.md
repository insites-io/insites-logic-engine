# Caching Gotchas

## CSRF Token Caching

### Never Cache Security Tokens

```liquid
<!-- WRONG: Caching CSRF token across requests -->
{% cache 'form-with-token', expire: 3600 %}
  <form>
    <input type="hidden" name="csrf" value="{{ context.csrf_token }}">
  </form>
{% endcache %}

<!-- RIGHT: Keep token outside cache -->
{% cache 'form-content', expire: 3600 %}
  <form>
    <input type="hidden" name="csrf" value="{{ context.csrf_token }}">
    <!-- form fields cached -->
  </form>
{% endcache %}
```

Cached CSRF tokens fail validation on POST requests.

## Cache Key Collisions

### Different Content with Same Key

```liquid
<!-- WRONG: Duplicate key -->
<!-- layout-en.html -->
{% cache 'main-content', expire: 3600 %}
  English version
{% endcache %}

<!-- layout-de.html -->
{% cache 'main-content', expire: 3600 %}
  German version
{% endcache %}

<!-- RIGHT: Include language in key -->
{% cache 'main-content-' | append: context.language, expire: 3600 %}
  {{ context.language }} version
{% endcache %}
```

Same cache key overwrites previous content, causing wrong language or data to display.

## Stale Content from Long TTL

### Users See Outdated Information

```liquid
{% cache 'product-price', expire: 86400 %}
  <!-- Price cached for 24 hours -->
  {% graphql product = 'get_product', id: params.id %}
  <p>Price: {{ product.price | money }}</p>
{% endcache %}

<!-- If price changes, users see old cached price for up to 24 hours -->
```

**Solution:** Use shorter TTL for frequently-changing data:

```liquid
{% cache 'product-price', expire: 1800 %}
  <!-- Price cached for 30 minutes only -->
  {% graphql product = 'get_product', id: params.id %}
  <p>Price: {{ product.price | money }}</p>
{% endcache %}
```

## User Data Leakage

### Private Data Visible to Multiple Users

```liquid
<!-- WRONG: Cache without user ID -->
{% cache 'user-dashboard', expire: 3600 %}
  <div>Wallet: {{ context.current_user.wallet }}</div>
  <div>Orders: {{ context.current_user.order_count }}</div>
{% endcache %}

<!-- First user A caches their dashboard -->
<!-- User B visits, sees user A's cached dashboard -->
```

**Solution:** Always include user ID in cache key:

```liquid
{% cache 'user-dashboard-' | append: context.current_user.id, expire: 3600 %}
  <div>Wallet: {{ context.current_user.wallet }}</div>
  <div>Orders: {{ context.current_user.order_count }}</div>
{% endcache %}
```

## Cache Size Growing Unbounded

### Memory Exhaustion from Too Many Cache Keys

```liquid
<!-- WRONG: Unique key for every session/user -->
{% cache 'session-data-' | append: context.session_id, expire: 300 %}
  <!-- Millions of unique keys accumulate -->
{% endcache %}

<!-- RIGHT: Limit cache keys or use TTL -->
{% cache 'session-data-' | append: context.session_id, expire: 300 %}
  <!-- TTL ensures old sessions expire -->
{% endcache %}
```

Monitor cache size in metrics. Use TTL to auto-expire old entries.

## Cache Invalidation Timing

### Changes Not Reflected Immediately

```liquid
{% if params.update %}
  <!-- Update database -->
  {% graphql update = 'update_product', id: product.id, name: params.name %}

  <!-- OLD VALUE STILL CACHED -->
  {% cache 'product-' | append: product.id, expire: 3600 %}
    {% graphql product = 'get_product', id: product.id %}
  {% endcache %}
{% endif %}
```

**Solution:** Clear cache immediately after update:

```liquid
{% if params.update %}
  {% graphql update = 'update_product', id: product.id, name: params.name %}
  <!-- no command clears the old entry: the next render must use a new key -->
{% endif %}
```

## Partial Cache Invalidation Failures

### There Is No Command to Clear a Cache

`insites-cli` has no `cache` subcommand, so there is no wildcard or per-key clear. A key that never changes serves stale content until `expire` runs out. Build every key from the data that can change it (an id plus `updated_at`, or a version constant).

## Race Conditions with Cache

### Multiple Requests Computing Same Cache Simultaneously

```liquid
{% cache 'expensive-query', expire: 3600 %}
  <!-- Multiple concurrent requests compute this simultaneously -->
  {% graphql result = 'very_expensive_operation' %}
{% endcache %}
```

First request caches result. Concurrent requests still compute independently before cache exists.

**Solution:** Use locking mechanism or accept initial thundering herd:

```liquid
{% if context.cache_warmed == false %}
  <!-- Pre-warm cache to avoid concurrent computations -->
  {% cache 'expensive-query', expire: 3600 %}
    {% graphql result = 'very_expensive_operation' %}
  {% endcache %}
{% endif %}
```

## See Also

- [Configuration Guide](./configuration.md)
- [API Reference](./api.md)
- [Patterns Guide](./patterns.md)
- [Advanced Techniques](./advanced.md)
