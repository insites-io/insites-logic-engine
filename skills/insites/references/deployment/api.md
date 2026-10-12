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
insites-cli deploy production --dry-run
insites-cli deploy staging --partial-deploy
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

Continuous synchronization is the default. `sync` watches your files until you stop it:

```bash
insites-cli sync dev
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
app/views/
app/api_calls/
app/lib/
config/
```

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
```

## Deployment Status and Monitoring

### Check Deployment Status

`insites-cli deploy <env>` waits for the deploy to finish and prints its result. There is no separate status command.

### View Deployment Logs

```bash
insites-cli logs production
insites-cli logs production --filter "deployment"
```

### Monitor in Progress

`logs` keeps showing new entries until you stop it:

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
insites-cli migrations run <timestamp> staging
# Verify data integrity (exports all data on the instance)
insites-cli data export staging -p verify.zip
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
