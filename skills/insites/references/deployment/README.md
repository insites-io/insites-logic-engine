# Deployment

## Pre-Deployment Checklist

1. Run `insites-cli audit` and clear what it reports (it exits 0 either way, so read the `[Audit] N rules detected issues.` line)
2. Verify all changes work on staging
3. Review any pending migrations

## Deploy

```bash
# Deploy to staging
insites-cli deploy dev

# Deploy to production
insites-cli deploy production
```

## What Happens on Deploy

1. All files in `app/` are synced to the platform
2. Pending migrations are executed in chronological order
3. Schema changes are applied
4. Assets are uploaded to CDN
5. Cache is invalidated

## Development Sync

For live development, use sync mode:

```bash
insites-cli sync dev
```

This watches for file changes and syncs them immediately. Do NOT use in production.

## Environment Setup

### .insites file (JSON)
```json
{
  "dev": {
    "instance_uuid": "uuid",
    "token": "token",
    "email": "dev@example.com",
    "url": "https://your-instance.staging-insites.io",
    "key": "key"
  }
}
```

Generate with: `insites-cli env add dev --email dev@example.com --instance-uuid your-uuid`

## CI/CD

Example CI pipeline:

```bash
# 1. Install tools
npm install -g /insites-cli
# 2. Lint
insites-cli audit

# 3. Deploy to staging
insites-cli deploy staging

# 4. Deploy to production
insites-cli deploy production
```

## Rules

- Always lint before deploying
- Verify on staging before production
- Never sync to production (deploy only)
- Pending migrations run automatically on deploy
- Only sync files inside `app/`
