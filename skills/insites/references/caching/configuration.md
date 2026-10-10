# Caching Configuration

## Overview

The Insites caching system uses Liquid's `{% cache %}` tag to store computed results in memory or Redis, reducing database queries and expensive computations. Caches have unique keys, configurable expiration times, and support dynamic key generation. Proper cache strategy—combining static caches (long TTL) with dynamic caches (short TTL)—is essential for performance.

## Cache Storage Backends

### In-Memory Cache

Fast access for single-server deployments:

```liquid
{% cache 'static-homepage', expire: 86400 %}
  <!-- Cached for 24 hours -->
  {% include 'components/hero-section' %}
{% endcache %}
```

Useful for small, frequently-accessed data.

### Redis Cache

Distributed cache for multi-server setups:

Caching backend is managed by the platform automatically. In production, all servers share the same cache pool. There is no user-configurable cache backend setting.

## Cache Expiration Strategy

### Static Content

Long TTL (hours or days) for content that rarely changes:

```liquid
{% cache 'product-listings', expire: 86400 %}
  <!-- Product list: expires in 24 hours -->
  {% graphql products = 'get_products', limit: 100 %}
  {% for product in products.products %}
    <div class="product">{{ product.name }}</div>
  {% endfor %}
{% endcache %}
```

### Dynamic Content

Short TTL (minutes or seconds) for user-specific or frequently-changing content:

```liquid
{% cache 'user-dashboard-' | append: context.session.user_id, expire: 300 %}
  <!-- Per-user cache: expires in 5 minutes -->
  {% graphql user_data = 'get_user_dashboard', user_id: context.session.user_id %}
  {% include 'dashboard/summary', data: user_data %}
{% endcache %}
```

### Per-Request

No caching, compute fresh for security-sensitive data:

```liquid
<!-- CSRF token: never cache -->
<input type="hidden" name="csrf" value="{{ context.csrf_token }}">

<!-- Current user: fetch fresh -->
{{ context.current_user.name }}
```

## Cache Key Design

### Unique Cache Keys

Every cache needs a unique key:

```liquid
<!-- Good: Descriptive key -->
{% cache 'featured-products-en', expire: 3600 %}...{% endcache %}

<!-- Good: Appended identifiers for multi-variant -->
{% cache 'product-' | append: product.id | append: '-en', expire: 1800 %}...{% endcache %}

<!-- Avoid: Duplicate keys create conflicts -->
{% cache 'content', expire: 1800 %}...{% endcache %}
{% cache 'content', expire: 1800 %}...{% endcache %}  <!-- Overwrites above -->
```

Duplicate keys overwrite each other, causing data loss.

## Cache Invalidation

### Manual Invalidation

There is no CLI command to clear the cache. To make new content show, change the cache key (for example, put the record's `updated_at` or a version number in it) or let `expire` run out.

### Time-Based Invalidation

Let cache expire naturally:

```liquid
{% cache 'key', expire: 3600 %}
  <!-- Auto-invalidates after 1 hour -->
{% endcache %}
```

### Deployment Invalidation

A deploy does not clear the cache, and there is no command to clear it. Put a version in keys whose content changes with a release.

## Cache Configuration

Cache settings are managed by the platform. The `.insites` file only contains environment credentials — it does not have cache configuration options. Cache behavior is controlled through the `{% cache %}` Liquid tag parameters (key, expire) on a per-usage basis.

## Cache Metrics

Monitor cache effectiveness:

```yaml
# Metrics available in dashboard
cache_hits: 95000
cache_misses: 5000
cache_hit_ratio: 95%
cache_size: 500MB
```

## See Also

- [API Reference](./api.md)
- [Patterns Guide](./patterns.md)
- [Advanced Techniques](./advanced.md)
- [Gotchas & Issues](./gotchas.md)
