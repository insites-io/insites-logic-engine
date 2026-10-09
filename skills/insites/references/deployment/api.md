# Deployment API Reference

## Deploy Command

### Basic Deployment

Deploy application to environment:

```bash
insites-cli deploy [environment]
insites-cli deploy production
```

Deployment process:
1. Runs insites-cli audit and prints its report (skipped when `CI=true`; it never stops the deploy)
2. Syncs all files in `app/` and `modules/`
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

`sync` watches by default and has no `--watch` or `--filter` option:

```bash
insites-cli sync dev
insites-cli sync staging -f app/views/pages/home.liquid   # one file, then exit
```

## Deployment Lifecycle

### Pre-Deployment Phase

Runs automatically:

```bash
insites-cli audit
```

Reports deprecated tags, filters and keys, file types per folder, partial name clashes, file names and partials never included. It does not validate Liquid syntax or translations, and the deploy goes ahead whatever it finds. See [`../cli/api.md`](../cli/api.md#audit).

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
insites-cli logs production --filter error
```

### Monitor in Progress

`insites-cli logs` always follows: it streams until you press `Ctrl+C` and has no `--follow` option. Run it in a second terminal while the deploy runs:

```bash
insites-cli logs production
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
insites-cli data export staging --path verify.zip
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
