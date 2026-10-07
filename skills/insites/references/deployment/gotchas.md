# Deployment Gotchas and Troubleshooting

## Never Sync to Production

### Critical Rule

Never synchronize directly to production:

```bash
# WRONG - Never do this!
insites-cli sync production
insites-cli sync production --watch
```

### Why This Is Dangerous

- No validation occurs with sync
- No insites-cli audit
- Changes applied immediately
- No rollback point
- Breaks production for users

### Correct Approach

Always use deploy for production:

```bash
# CORRECT
insites-cli audit
insites-cli deploy production
```

Deployment includes:
1. Full validation
2. Staging tests
3. Atomic changes
4. Audit trail

## Deployment Validation Failures

### Linting (insites-cli audit) Failure

**Issue**: Deployment blocked by validation errors

**Solution**:
```bash
insites-cli audit
# Fix reported issues
insites-cli deploy staging
```

### Common Validation Errors

**Syntax Error**:
```liquid
# WRONG
{% if user %}{{ user.name }}

# CORRECT
{% if user %}
  {{ user.name }}
{% endif %}
```

**Missing Partial**:
```bash
# Error: Partial 'header' not found
# Solution: Create file at:
# app/views/partials/header.html.liquid
```

**Translation Missing**:
```yaml
# Add to config/translations.yml
en:
  errors:
    not_found: "Page not found"
```

## Migration Issues

### Failed Migration

**Issue**: Migration fails during deployment

**Problem**: Database inconsistency

**Solution**:
1. Investigate error: `insites-cli logsv2 staging --filter migration`
2. Fix migration file
3. Create compensating migration
4. Rerun deployment

### Migration Conflicts

**Issue**: "Cannot run migration, previous migration incomplete"

**Solution**:
```bash
# Check migration status
insites-cli migrations list staging

# If stuck, may need manual intervention
# Contact Insites support if persistent
```

### Data Type Mismatch

**Issue**: Migration applies, but queries fail

**Solution**:
```graphql
# Verify schema after migration
{
  users {
    id
    email
  }
}
```

## File Sync Issues

### Changes Not Syncing

**Issue**: `insites-cli sync` shows no changes

**Causes**:
- Correct files not in `app/` directory (or `modules/<module_name>/public/` / `private/` for module code)
- Files ignored by Insites
- Syntax errors preventing sync
- Network connectivity

**Solutions**:
```bash
# Verify file structure
ls -la app/views/

# Explicit sync with verbose output
insites-cli sync dev --verbose

# Note: insites-cli env clear-cache does not exist.
# Manually verify your .insites file if sync issues persist.
```

### Partial Sync Failures

**Issue**: Some files sync, others fail

**Solution**:
```bash
# Deploy all at once instead
insites-cli deploy staging

# Or debug individual files
insites-cli sync dev --verbose --include "app/views/pages"
```

## Asset Deployment

### Assets Not Appearing on CDN

**Issue**: Static files missing after deployment

**Causes**:
- Files not in `app/assets/`
- CDN not configured
- Asset references using wrong paths

**Solution**:
```bash
# Verify asset structure
ls -la app/assets/

# Check asset references
grep -r "asset_path" app/views/

# Redeploy assets
insites-cli deploy staging
```

### Asset Cache Issues

**Issue**: Old assets served from CDN cache

**Solution**:
- Reference the file through `asset_url`, which changes its `?updated=` address on every upload
- Where code builds asset addresses itself, use versioned file names: `app-v2.js`
- Do not plan on a purge. An edge purge of the exact URL is an Insites operator action on the stack's CDN, and it does not reach browsers that already cached the file. See [The File Host Keeps Serving Old Bytes at the Plain Address](../assets/gotchas.md#the-file-host-keeps-serving-old-bytes-at-the-plain-address)

## Schema Application Failures

### Schema Not Applying

**Issue**: New model properties not available

**Causes**:
- Schema syntax error
- Conflicting property definitions
- Missing required fields

**Solution**:
```yaml
# Verify schema syntax
# app/schema/models/user.yml
properties:
  email:
    type: string
    required: true
  name:
    type: string
```

## Deployment Rollback

### Cannot Rollback Automatically

**Issue**: No automatic rollback mechanism

**Mitigation**:
1. Always verify on staging first
2. Create backup migrations
3. Version schema changes
4. Keep previous code branch ready

### Manual Rollback

```bash
# Checkout previous code version
git checkout HEAD~1

# Redeploy previous version
insites-cli deploy production

# Create compensating migrations if needed
```

## Environment Configuration Errors

### Wrong Credentials

**Issue**: Deployment fails with "Invalid token"

**Solution**:
- Verify `.insites` file (JSON): `cat .insites | python3 -m json.tool | head -10`
- Check token in dashboard
- Regenerate if expired
- Use environment variables: `export POS_TOKEN=`

### Mismatched Environment

**Issue**: Deploying to wrong environment

**Prevention**:
```bash
# Note: insites-cli env current does not exist.
# Verify your target by checking the .insites file directly.

# Use explicit environment
insites-cli deploy production  # Not "insites-cli deploy"
```

## See Also

- [CLI Gotchas](../cli/gotchas.md)
- [Deployment Patterns](./patterns.md)
