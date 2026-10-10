# Configuration API Reference

## context.environment

Access current deployment environment.

**Type:** String

**Values:** `'staging'`, `'production'`, or custom environment names

**Example:**

```liquid
<!-- Get current environment -->
{{ context.environment }}

<!-- Conditional logic by environment -->
{% if context.environment == 'production' %}
  Production Mode
{% else %}
  Staging/Development Mode
{% endif %}
```

## context.config

Access application configuration from `app/config.yml`.

**Type:** Object (hash)

**Example:**

```liquid
<!-- Access nested config -->
{{ context.config.app.name }}
{{ context.config.app.version }}

<!-- Access feature flags -->
{% if context.config.features.enable_reviews %}
  Reviews are enabled
{% endif %}

<!-- Access module config -->
{{ context.config.modules.shipping.enabled }}
{{ context.config.modules.seo.max_title_length }}
```

## context.constants

Access defined constants from configuration.

**Type:** Object (hash)

**Example:**

```liquid
<!-- Access constants -->
{{ context.constants.MAX_PRODUCTS_PER_PAGE }}
{{ context.constants.FREE_SHIPPING_THRESHOLD | money }}

<!-- Use in calculations -->
{% assign items_per_page = context.constants.MAX_PRODUCTS_PER_PAGE %}
{% assign shipping_free = total | >=: context.constants.FREE_SHIPPING_THRESHOLD %}
```

## context.cdn_url

Access CDN base URL from `.insites` configuration.

**Type:** String

**Example:**

```liquid
<!-- Get CDN URL -->
{{ context.cdn_url }}

<!-- Use for assets -->
<img src="{{ context.cdn_url }}/images/logo.png" alt="Logo">

<!-- Combine with asset filter -->
{{ 'images/logo.png' | asset_url }}
```

## context.app_url

Access application URL from `.insites` configuration.

**Type:** String

**Example:**

```liquid
{{ context.app_url }}
<!-- https://app.example.com -->

<!-- Use for internal links -->
<a href="{{ context.app_url }}/products">Products</a>
```

## context.deployment

Access deployment metadata.

**Type:** Object

**Example:**

```liquid
{{ context.deployment.version }}
{{ context.deployment.timestamp }}
{{ context.deployment.git_hash }}
```

## Changing Configuration

The CLI has no `config` command. Edit `app/config.yml` and deploy it (`insites-cli deploy <env>`, or `insites-cli sync <env>` while you work); read a value back with `insites-cli exec liquid <env> "{{ context.config.<key> }}"`.

## Accessing Module Configuration

### Module-Specific Config

```liquid
<!-- Check if module enabled -->
{% if context.config.modules.seo.enabled %}
  {% graphql seo = 'get_seo_data' %}
{% endif %}

<!-- Use module settings -->
<meta name="description" content="{{ seo.description | truncate: context.config.modules.seo.max_description_length }}">
```

## Environment Variable Access

Access `.insites` environment variables in templates:

```liquid
<!-- Environment is set from .insites -->
{% if context.environment == 'production' %}
  Using production API
{% else %}
  Using staging API
{% endif %}
```

## Configuration Error Handling

Check if configuration key exists:

```liquid
{% if context.config.modules.custom_module %}
  {{ context.config.modules.custom_module.setting }}
{% else %}
  Module not configured
{% endif %}
```

Use conditional checks for optional configuration.

## See Also

- [Configuration Guide](./configuration.md)
- [Patterns Guide](./patterns.md)
- [Advanced Techniques](./advanced.md)
- [Gotchas & Issues](./gotchas.md)
