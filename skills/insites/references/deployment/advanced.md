# Advanced Deployment Techniques

## Blue-Green Deployment Pattern

### Two Production Environments

Maintain two identical production instances:

Add both with `insites-cli env add`, so `.insites` holds two entries:

```json
{
  "production_blue": { "url": "https://blue-instance.prod01-insites.io", "email": "...", "instance_uuid": "...", "token": "...", "key": "..." },
  "production_green": { "url": "https://green-instance.prod01-insites.io", "email": "...", "instance_uuid": "...", "token": "...", "key": "..." }
}
```

### Deployment Strategy

```bash
# 1. Deploy to inactive environment (green)
insites-cli deploy production_green

# 2. Switch traffic to green
# Update load balancer / DNS

# 3. Keep blue as instant rollback
```

## Canary Deployments

### Feature Flags for Gradual Rollout

```liquid
{% if context.constants.CANARY_NEW_FEATURE == 'true' %}
  {% include 'pages/new_feature_layout' %}
{% else %}
  {% include 'pages/old_feature_layout' %}
{% endif %}
```

### Deployment Steps

```bash
# 1. Deploy with feature disabled
insites-cli deploy production
insites-cli constants set --name CANARY_NEW_FEATURE --value "false" production

# 2. Enable for small percentage
insites-cli constants set --name CANARY_PERCENTAGE --value "10" production

# 3. Monitor metrics
insites-cli logs production --filter error

# 4. Gradually increase
insites-cli constants set --name CANARY_PERCENTAGE --value "50" production
insites-cli constants set --name CANARY_PERCENTAGE --value "100" production
```

## Database Migration Strategies

### Zero-Downtime Migrations

```bash
# 1. Deploy backward-compatible schema changes
insites-cli deploy staging

# 2. Add new column without removing old
insites-cli migrations generate staging add_new_user_field

# 3. Deploy gradually using dual-write pattern
insites-cli deploy production

# 4. After all services updated, deploy removal
insites-cli migrations generate production remove_old_user_field
```

### Complex Schema Changes

```bash
# 1. Add new table/property
insites-cli migrations generate prod add_user_profile

# 2. Backfill data
insites-cli data import prod --path data/profiles.json    # JSON, or a zip with --zip; no CSV, no table argument

# 3. Switch code to new schema
git checkout new-schema-branch

# 4. Deploy
insites-cli deploy production
```

## Performance Optimization During Deployment

### Parallel Deployments

Deploy multiple environments concurrently:

```bash
#!/bin/bash
# Deploy in background
(insites-cli deploy staging &) && \
(insites-cli deploy production_canary &) && \
wait
```

### Incremental Asset Deployment

`sync` has no folder option, and production should not be synced. A partial deploy leaves files that are missing from the build in place:

```bash
insites-cli deploy production -p
```

## Deployment Verification

### Health Check Pattern

```bash
#!/bin/bash
verify_deployment() {
  ENV=$1

  # insites-cli logs streams until Ctrl+C, so it cannot be counted here.
  # Watch it in another terminal: insites-cli logs $ENV --filter error

  # Run health check endpoint
  RESPONSE=$(curl -s https://$ENV-instance.prod01-insites.io/health)
  if [ $RESPONSE != "OK" ]; then
    return 1
  fi

  return 0
}

insites-cli deploy production
verify_deployment production
```

## Automated Deployment Pipeline

### Full CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Full Deployment Pipeline

on:
  push:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm install -g @insites/insites-cli
      - run: insites-cli audit

  deploy_staging:
    needs: validate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm install -g @insites/insites-cli
      - run: insites-cli deploy staging
        env:
          INSITES_URL: ${{ secrets.STAGING_INSITES_URL }}
          INSITES_EMAIL: ${{ secrets.STAGING_INSITES_EMAIL }}
          INSITES_TOKEN: ${{ secrets.STAGING_INSITES_TOKEN }}
          INSITES_INSTANCE: ${{ secrets.STAGING_INSITES_INSTANCE }}
          INSITES_POS_KEY: ${{ secrets.STAGING_INSITES_KEY }}

  deploy_production:
    needs: deploy_staging
    runs-on: ubuntu-latest
    if: success()
    steps:
      - uses: actions/checkout@v2
      - run: npm install -g @insites/insites-cli
      - run: insites-cli deploy production
        env:
          INSITES_URL: ${{ secrets.PROD_INSITES_URL }}
          INSITES_EMAIL: ${{ secrets.PROD_INSITES_EMAIL }}
          INSITES_TOKEN: ${{ secrets.PROD_INSITES_TOKEN }}
          INSITES_INSTANCE: ${{ secrets.PROD_INSITES_INSTANCE }}
          INSITES_POS_KEY: ${{ secrets.PROD_INSITES_KEY }}
```

## Disaster Recovery

### Backup Before Critical Deployments

```bash
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Backup all data (one zip archive)
insites-cli data export production --path data/backup_${TIMESTAMP}.zip

# Save current state
insites-cli migrations list production > data/backup_${TIMESTAMP}_migrations.txt

# Proceed with deployment
insites-cli deploy production
```

### Rollback Procedures

```bash
#!/bin/bash
BACKUP_TIMESTAMP=$1

# Restore from backup if needed
# data clean removes ALL data on the instance, not one table,
# and asks you to type CLEAN DATA
insites-cli data clean production
insites-cli data import production --path data/backup_${BACKUP_TIMESTAMP}.zip --zip

# Revert code
git checkout production/stable

# Redeploy previous version
insites-cli deploy production
```

## Monitoring and Observability

### Deployment Metrics

```bash
# Stream errors after a deploy; it runs until Ctrl+C
insites-cli logs production --filter error

# Keep a copy to read afterwards
insites-cli logs production --filter error | tee deploy-errors.log
```

### Custom Monitoring

```liquid
<!-- Add monitoring endpoint -->
<script>
  fetch('/api/deployment-status')
    .then(r => r.json())
    .then(data => {
      if (data.errors > 0) {
        console.warn('Deployment errors detected');
      }
    });
</script>
```

## See Also

- [CLI Advanced Techniques](../cli/advanced.md)
- [Deployment Patterns](./patterns.md)
