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
  insites-cli modules pull $ENV $MODULE
done
```

## Advanced Logging

### Real-time Log Monitoring

```bash
insites-cli logs dev --filter error
```

### Log Export to File

`logs` keeps running and writes new entries as they arrive. Stop it with Ctrl+C.

```bash
insites-cli logs staging --json > logs.jsonl
```

### Pattern-based Filtering

`--filter` matches the log type only. To match text in the message, search the JSON output:

```bash
insites-cli logs dev --json | grep -E 'api_call.*timeout'
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
insites-cli deploy dev    # deploy runs the pending migrations
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

`data export`, `data import` and `data clean` work on all data on the instance. There is no per-table export or clean.

### Data Migration Pattern

```bash
#!/bin/bash
# Export all data from staging
insites-cli data export staging -p data/staging.zip

# Transform if needed
# ... processing script ...

# Import to dev
insites-cli data import dev -p data/staging_processed.zip --zip
```

### Cleanup Strategy

```bash
# Back up before cleanup
insites-cli data export dev -p data/backup.zip

# Then remove all data on the instance
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
      - run: insites-cli audit
      - run: insites-cli deploy staging
        env:
          INSITES_URL: ${{ secrets.INSITES_URL }}
          INSITES_EMAIL: ${{ secrets.INSITES_EMAIL }}
          INSITES_TOKEN: ${{ secrets.INSITES_TOKEN }}
          INSITES_INSTANCE: ${{ secrets.INSITES_INSTANCE }}
          INSITES_INSTANCE_KEY: ${{ secrets.INSITES_INSTANCE_KEY }}
```

### GitLab CI Example

```yaml
deploy:
  image: node:16
  script:
    - npm install -g @insites/insites-cli
    - insites-cli audit
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

Set `DEBUG` to print the CLI's debug lines. (`deploy --verbose`, from 6.1.0, only lists every file in the deploy report; `sync` has no `--verbose`.)

```bash
DEBUG=1 insites-cli deploy dev
```

### Checking a Build Without Deploying

On the private stack, `insites-cli deploy <env> --dry-run` (6.1.0 and later) validates the release on the instance and shows what would change without applying anything. To check a build without touching the instance at all, build the archive and run the audit locally:

```bash
insites-cli archive              # writes ./tmp/release.zip; -o picks another path
insites-cli audit                # the same report a deploy prints first
```

### Environment Inspection

There is no `env info` or `env current` command. `env list` prints every environment in `.insites` with its stack, instance and email:

```bash
insites-cli env list
```

## Workflows Built on Git

The CLI deliberately has no `diff`, `rollback` or `benchmark` command. Git, the commands below and an agent reading their output do each job better.

### Get an Existing Instance into Git

`pull` downloads the instance's whole `app/` folder in one archive. Modules come separately, one `modules pull` each; pull only the project's own modules, never the Insites modules every instance carries.

```bash
insites-cli pull staging -p app.zip && unzip -o app.zip && rm app.zip
insites-cli modules list staging
insites-cli modules pull staging my_module      # repeat for each of the project's own modules
git init && git add app modules && git commit -m "Code as it is on staging"
```

Check the result: `insites-cli deploy staging --dry-run` should report nothing to upsert or delete.

### Compare Two Environments

To see what a deploy would change on one environment, use the dry run: it compares your release with the instance, file by file.

```bash
insites-cli deploy production --dry-run --verbose
```

To compare the content of two environments line by line, pull both and let git compare them:

```bash
mkdir -p /tmp/a /tmp/b
insites-cli pull staging -p /tmp/a/app.zip && (cd /tmp/a && unzip -oq app.zip)
insites-cli pull production -p /tmp/b/app.zip && (cd /tmp/b && unzip -oq app.zip)
git diff --no-index --stat /tmp/a/app /tmp/b/app
git diff --no-index /tmp/a/app /tmp/b/app
```

### Roll Back a Deploy

A full deploy replaces the instance's `app/` folder with the release, so deploying the previous git tag puts the previous code back.

```bash
git checkout v1.4.2
insites-cli deploy production --dry-run --verbose    # see exactly what will change
insites-cli deploy production
git checkout -
```

Data is not rolled back, and neither are migrations: a migration that ran stays run. If the release you are leaving changed data, write a compensating migration (see Rollback Pattern above). CloudShell can do the same for an instance connected to GitHub.

### Check Performance

Measure page speed with Lighthouse or PageSpeed Insights on the pages that matter, on a desktop and a mobile profile, then give the reports to an agent and ask it to explain the slowest items and what to change. For a slow page, follow `insites-cli logs <environment>` while you load it to see the errors it logs.

## See Also

- [CLI Commands Reference](./api.md)
- [CLI Patterns](./patterns.md)
- [Deployment Advanced Patterns](../deployment/advanced.md)
