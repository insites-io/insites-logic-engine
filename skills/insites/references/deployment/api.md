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

`deploy` takes two options, and has no `--force`, `--skip-tests` or `--verbose`:

```bash
insites-cli deploy staging -p                 # partial: keep files in folders missing from the build
insites-cli deploy production --stack <name>  # override the stack read from the environment
DEBUG=1 insites-cli deploy dev                # print the CLI's debug lines
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

The environment name is a key in `.insites`, and the deploy does the same work whatever it is called. No environment runs tests or extra checks: run `insites-cli test run staging` yourself before you deploy to production.

```bash
insites-cli deploy development
insites-cli deploy staging
insites-cli deploy production
```

## Deployment Status and Monitoring

### Check Deployment Status

The deploy command waits for the instance and ends with `Deploy succeeded after <time>` or `Deploy failed.` and the reason. There is no separate status command (`env info` does not exist); `insites-cli env list` only shows which environments are configured.

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
