# Caching

> **There is no cache command.** `insites-cli` has no `cache` subcommand (no `clear`, `stats` or `inspect`), and the GraphQL schema has no mutation that clears a cache. A cached fragment is replaced when its `expire` runs out, when its key changes, or when a deploy changes any view or translation (insites-cli 6.1.0 tag reference). A data change alone does not replace it, so put a version or the record's `updated_at` in the key. Do not suggest any `insites-cli cache` subcommands to users.

Insites provides fragment caching via the `{% cache %}` tag to avoid re-executing expensive operations.

## Syntax

```liquid
{% cache 'unique_key', expire: 3600 %}
  {% comment %} Expensive content to cache {% endcomment %}
  {% graphql products = 'products/featured' %}
  {% render 'products/featured_list', products: products %}
{% endcache %}
```

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | String | Unique cache identifier |
| `expire` | Integer | Seconds until cache expires |

## Dynamic Cache Keys

Include dynamic values in keys to cache per-user or per-page:

```liquid
{% cache 'products_page_' | append: context.params.page, expire: 600 %}
  {% render 'products/list', products: products %}
{% endcache %}

{% cache 'user_dashboard_' | append: profile.id, expire: 300 %}
  {% render 'dashboard/summary', user: profile %}
{% endcache %}
```

## Cache Strategies

### Static Content
Long expiry for rarely changing content:
```liquid
{% cache 'footer_navigation', expire: 86400 %}
  {% render 'shared/footer' %}
{% endcache %}
```

### Dynamic Content
Short expiry for frequently changing data:
```liquid
{% cache 'recent_orders', expire: 60 %}
  {% graphql orders = 'orders/recent' %}
  {% render 'orders/recent_list', orders: orders %}
{% endcache %}
```

### Per-User Content
Include user ID in cache key:
```liquid
{% cache 'user_cart_' | append: profile.id, expire: 300 %}
  {% render 'cart/summary', user: profile %}
{% endcache %}
```

## Whole-Page Caching

A page can cache its whole output instead of a fragment. The schema's `Page` type holds the settings:

| Field | What it does (schema description) |
|---|---|
| `dynamic_cache_key` | Liquid that evaluates to the cache key; blank uses the full URL |
| `dynamic_cache_layout` | Cache the layout too; default false, because a layout usually shows the signed-in person |
| `dynamic_cache_expire` | Seconds to cache. "Triggers authorization", so `authorization_policies` still run |
| `static_cache_expire` | Seconds to cache as static HTML; "works only for not logged in users, skips any authorization" |

In front matter, app-seedling's `pages/dashboard.liquid` sets them as one `dynamic_cache` hash with `layout: true` and a multi-line `key:`, and puts `{{ context.current_user.id }}` in the key. **Any page that shows the signed-in person must do the same**, or one person's page is served to the next. The front-matter name for the expiry was not found in a reference repo; check it on an instance before relying on it. See also the `layout: ""` trap in [pages gotchas](../pages/gotchas.md).

## Rules

- Cache keys must be unique across the application
- Cached content is HTML output (not data)
- Use short expiry for dynamic data
- Include user/page identifiers in keys for personalized content
- Don't cache content with CSRF tokens (they change per session)
