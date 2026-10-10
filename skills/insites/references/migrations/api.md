# Migrations API Reference

## Migration File Structure

Basic migration template:

```liquid
{% comment %}
Migration: Create Initial Products
Description: Seeds initial product catalog
Created: 2024-01-10 12:00:00
{% endcomment %}

<!-- Migration code executes here -->
```

## Context Variables in Migrations

### context.environment

Current environment (staging, production):

```liquid
{% if context.environment == 'production' %}
  <!-- Production-only migration -->
{% endif %}
```

### context.first_deployment

True on first deployment, false on subsequent:

```liquid
{% if context.first_deployment %}
  <!-- Initial setup -->
  {% graphql setup = 'initialize_system' %}
{% endif %}
```

### context.migration

Migration metadata:

```liquid
{{ context.migration.name }}        <!-- My Migration -->
{{ context.migration.timestamp }}   <!-- 20240110120000 -->
{{ context.migration.file }}        <!-- my_migration.liquid -->
```

## GraphQL Mutations in Migrations

Execute database operations:

```liquid
<!-- Create resource -->
{% graphql result = 'create_product',
  name: 'Product Name',
  description: 'Description',
  price: 99.99
%}

{% if result.error %}
  Error: {{ result.error }}
{% else %}
  Created: {{ result.product.id }}
{% endif %}
```

## Checking Existing Data

Prevent duplicate creation:

```liquid
{% graphql existing = 'get_product_by_slug', slug: 'featured' %}

{% if existing.product %}
  Product already exists
{% else %}
  {% graphql create = 'create_product', slug: 'featured' %}
{% endif %}
```

## CLI: List Migrations

```bash
insites-cli migrations list staging
```

Shows all migrations with status (pending, done, error).

## CLI: Show Migration Status

```bash
insites-cli migrations status 20240110120000 staging
```

Shows that one migration's state and its error messages, if it failed. Says so when no migration has that timestamp. Takes `--json`. Added in insites-cli 6.0.0.

## CLI: Retry a Migration

```bash
insites-cli migrations retry 20240110120000 staging
```

Shows the migration's current state, then runs it again. The same call as `migrations run`. Added in insites-cli 6.0.0.

There is no command to reset a migration to pending or to read a migration's output. The instance API has no endpoint for either. The error messages `migrations status` prints are what the instance records.

## Constants in Migrations

Define application constants during migration:

```liquid
{% graphql set = 'set_constant',
  key: 'MAX_PRODUCTS_PER_PAGE',
  value: '20',
  type: 'number'
%}

{% graphql set = 'set_constant',
  key: 'STORE_NAME',
  value: 'My Store',
  type: 'string'
%}
```

Constants available via `context.constants` after deployment.

## Migration Timing

Control execution timing:

```liquid
<!-- Always run -->
{% graphql result = 'update_metadata' %}

<!-- Run only in production -->
{% if context.environment == 'production' %}
  {% graphql result = 'backup_database' %}
{% endif %}

<!-- Run only on first deployment -->
{% if context.first_deployment %}
  {% graphql result = 'initialize_defaults' %}
{% endif %}
```

## Error Handling in Migrations

Stop migration on error:

```liquid
{% graphql result = 'critical_operation' %}

{% if result.error %}
  <!-- Mark migration as failed -->
  CRITICAL ERROR: {{ result.error }}
  {% break %}  <!-- Stop execution -->
{% endif %}

<!-- Continue if no error -->
```

## Data Export from Migrations

Export data during migration:

```liquid
{% graphql export = 'export_products', format: 'json' %}

{% if export.success %}
  Exported {{ export.count }} products
{% endif %}
```

## Conditional Migrations

Execute conditionally:

```liquid
<!-- Only if feature enabled -->
{% if context.config.features.enable_advanced_search %}
  {% graphql result = 'create_search_indexes' %}
{% endif %}

<!-- Only if database ready -->
{% graphql db_check = 'check_database_health' %}
{% if db_check.healthy %}
  {% graphql result = 'run_maintenance' %}
{% endif %}
```

## Logging in Migrations

Output migration progress:

```liquid
Processing migration...

{% graphql result1 = 'step_one' %}
Step 1: Success

{% graphql result2 = 'step_two' %}
Step 2: Success

Migration complete
```

Anything the migration writes with `{% log %}` is in the instance logs (`insites-cli logs <env>`).

## See Also

- [Configuration Guide](./configuration.md)
- [Patterns Guide](./patterns.md)
- [Advanced Techniques](./advanced.md)
- [Gotchas & Issues](./gotchas.md)
