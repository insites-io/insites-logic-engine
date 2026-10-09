# Deployment API Reference

## Deploy Command

### Basic Deployment

Deploy application to environment:

```bash
insites-cli deploy [environment]
insites-cli deploy production
```

Deployment process:
1. Validates with insites-cli audit
2. Syncs all files
3. Executes pending migrations
4. Applies schema updates
5. Uploads assets to CDN

### Deployment with Options

```bash
insites-cli deploy production --force
insites-cli deploy staging --skip-tests
insites-cli deploy dev --verbose
```

## Sync Command

Synchronize changes without full deployment:

```bash
insites-cli sync [environment]
insites-cli sync dev
```

File sync only - no migrations or schema changes.

### Watch Mode

Continuous synchronization:

```bash
insites-cli sync dev --watch
insites-cli sync staging --watch --filter "app/views"
```

## Deployment Lifecycle

### Pre-Deployment Phase

Runs automatically:

```bash
insites-cli audit
```

Validates:
- Liquid syntax
- Tag correctness
- Partial references
- Translation keys

### Sync Phase

Files synchronized:

```
app/
modules/
```

The CLI deploys these two trees and nothing else.

### Migration Phase

Migrations execute in order:

```bash
insites-cli migrations list staging
# Shows migration execution order
```

### Schema Application

Schema changes applied:

```yaml
# app/schema/models/user.yml
properties:
  email:
    type: string
  name:
    type: string
```

### Asset Upload

Assets pushed to CDN:

```bash
# From app/assets/
# Images, stylesheets, javascripts deployed
```

## Environment-Specific Deployment

### Development Deployment

```bash
insites-cli deploy development
# Fast, minimal checks
```

### Staging Deployment

```bash
insites-cli deploy staging
# Full validation, runnable tests
```

### Production Deployment

```bash
insites-cli deploy production
# Full validation, mandatory tests
# No --skip-tests allowed
```

## Deployment Status and Monitoring

### Check Deployment Status

```bash
insites-cli env info production
```

### View Deployment Logs

```bash
insites-cli logs production
insites-cli logs production --filter "deployment"
```

### Monitor in Progress

```bash
insites-cli logs production --follow
```

## Rollback Procedures

### View Deployment History

```bash
insites-cli migrations list production
```

### Create Compensating Changes

For data changes, create new migrations:

```bash
insites-cli migrations generate production rollback_feature
```

## Pre-Deployment

### Verify Schema Changes

Test migrations on staging first:

```bash
insites-cli migrations run staging
# Verify data integrity
insites-cli data export staging users data/verify.csv
```

## Continuous Integration Deployment

### Deployment Validation in CI

```bash
insites-cli audit
insites-cli deploy production
```

## See Also

- [Deployment Configuration](./configuration.md)
- [Deployment Patterns](./patterns.md)
- [CLI Commands](../cli/api.md)
