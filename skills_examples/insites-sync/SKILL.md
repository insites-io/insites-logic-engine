---
name: insites-sync
description: Sync files to Insites staging instance with automatic validation
---

# Insites File Sync

Sync files to the Insites staging instance and validate after sync.

## Usage

Provide the file path or use without arguments to sync all changes.

## Commands

### Sync change
```bash
insites-cli sync -f PATH_TO_FILE staging
```

## Process

1. Execute sync command
2. Wait for confirmation output
3. Check for any sync errors
4. If file provided, run insites-cli audit on that file
5. Report sync status

## Output Interpretation

### Success
```
Syncing to staging...
[timestamp] Synced: app/views/pages/articles/index.liquid
```

### Error
```
Error: File not found: app/views/pages/missing.liquid
```
```
Error: Invalid Liquid syntax in app/views/pages/broken.liquid
```

## Post-Sync Validation

After successful sync, automatically run:
```bash
insites-cli audit
```

Report any linting errors found.

## Sync Scope

Only sync files within the `./app/` directory:
- `app/views/` - Pages, layouts, partials
- `app/lib/` - Commands, queries
- `app/graphql/` - GraphQL operations
- `app/schema/` - Table definitions
- `app/translations/` - i18n files
- `app/assets/` - Static files
- `app/emails/` - Email templates
- `app/api_calls/` - API call definitions

## Important Notes

- This example targets a flat `./app/` layout; sync only files under `./app/`
- Always validate after sync to catch issues early
