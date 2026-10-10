# Advanced CLI Techniques

## Scripting and Automation

### Deployment Automation Script

Create reusable deployment script:

```bash
#!/bin/bash
set -e

ENV=${1:-staging}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "Starting deployment to $ENV at $TIMESTAMP"

# Run validation. audit exits 0 even when rules fire, so
# "insites-cli audit || exit 1" can never fail: gate on the summary line
insites-cli audit 2>&1 | tee audit.log
grep -q '\[Audit\] 0 rules detected issues' audit.log || exit 1

# Deploy
insites-cli deploy $ENV

# logs streams until Ctrl+C, so watch it in another terminal rather than here:
#   insites-cli logs $ENV --filter error

echo "Deployment completed successfully"
```

Usage:

```bash
./deploy.sh production
```

### Batch Module Pull

Modules are preinstalled and console-managed; the CLI's `modules pull` is for fetching a module's local source. Pull several at once:

```bash
#!/bin/bash
MODULES=("module-a" "module-b" "my-module")
ENV=$1

for MODULE in "${MODULES[@]}"; do
  echo "Pulling $MODULE..."
  insites-cli modules pull $MODULE $ENV
done
```

## Advanced Logging

### Real-time Log Monitoring

```bash
insites-cli logs dev --filter error
```

### Log Export to File

`logs` streams until you stop it, so the file grows until `Ctrl+C`:

```bash
insites-cli logs staging -q | tee logs.txt
```

### Pattern-based Filtering

`--filter` matches an entry's type, not a pattern. Pipe the stream to match text:

```bash
insites-cli logs dev | grep -E 'api_call.*timeout'
```

## Constants Management at Scale

### Bulk Constants from Environment

```bash
#!/bin/bash
ENV=$1

# Load from environment variables
insites-cli constants set --name DATABASE_URL --value "$DATABASE_URL" $ENV
insites-cli constants set --name API_KEY --value "$API_KEY" $ENV
insites-cli constants set --name WEBHOOK_SECRET --value "$WEBHOOK_SECRET" $ENV
```

### Constants Versioning

Track constants changes:

```bash
insites-cli constants list dev > constants_backup_$(date +%Y%m%d).txt
```

## Migration Strategies

### Complex Migrations

Create multiple migration files for clarity:

```bash
insites-cli migrations generate dev 001_create_users
insites-cli migrations generate dev 002_add_user_roles
insites-cli migrations generate dev 003_create_indices
insites-cli migrations run dev
```

### Rollback Pattern

Create compensating migrations:

```bash
# Forward migration: add_column
insites-cli migrations generate dev add_feature_flag

# Rollback migration: remove_column
insites-cli migrations generate dev remove_feature_flag
```

## Bulk Data Operations

### Data Migration Pattern

```bash
#!/bin/bash
# Export from staging (a zip archive by default)
insites-cli data export staging --path staging.zip

# Import to dev: a zip with --zip, or a JSON file without it
insites-cli data import dev --path staging.zip --zip
```

### Cleanup Strategy

```bash
# Back up before cleanup
insites-cli data export dev --path backup.zip

# Then clean. This removes ALL data on the instance; there is no per-table clean
insites-cli data clean dev
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy Insites
on: [push]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm install -g @insites/insites-cli
      # audit exits 0 even when rules fire; fail on its summary line instead
      - run: |
          insites-cli audit 2>&1 | tee audit.log
          grep -q '\[Audit\] 0 rules detected issues' audit.log
      - run: insites-cli deploy staging
        env:
          INSITES_URL: ${{ secrets.INSITES_URL }}
          INSITES_EMAIL: ${{ secrets.INSITES_EMAIL }}
          INSITES_TOKEN: ${{ secrets.INSITES_TOKEN }}
          INSITES_INSTANCE: ${{ secrets.INSITES_INSTANCE }}
          INSITES_POS_KEY: ${{ secrets.INSITES_KEY }}
```

### GitLab CI Example

```yaml
deploy:
  image: node:16
  script:
    - npm install -g @insites/insites-cli
    - insites-cli audit 2>&1 | tee audit.log
    - grep -q '\[Audit\] 0 rules detected issues' audit.log   # audit itself always exits 0
    - insites-cli deploy $CI_ENVIRONMENT_NAME
  only:
    - main
```

## Performance Optimization

### Selective Sync

`sync` has no directory option. Leave paths out with `.insitesignore`, or push one file with `-f`:

```bash
insites-cli sync dev -f app/views/pages/home.liquid
```

### Parallel Operations

Use multiple terminal sessions:

```bash
# Terminal 1: Watch and sync
insites-cli sync dev

# Terminal 2: Monitor logs
insites-cli logs dev

# Terminal 3: Local development
insites-cli gui serve
```

## Debugging Techniques

### Verbose Output

Enable detailed logging:

```bash
insites-cli deploy dev --verbose
```

### Dry Run Deployments

Preview changes without applying:

```bash
insites-cli deploy dev --dry-run
```

### Environment Inspection

View current environment:

```bash
# Note: insites-cli env current does not exist.
# Check your .insites file directly to verify environment configuration.
insites-cli env info dev
```

## See Also

- [CLI Commands Reference](./api.md)
- [CLI Patterns](./patterns.md)
- [Deployment Advanced Patterns](../deployment/advanced.md)
