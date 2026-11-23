# Deployment Gotchas and Troubleshooting

## Never Sync to Production

### Critical Rule

Never synchronize directly to production:

```bash
# WRONG - Never do this!
insites-cli sync production
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

### Linting (insites-cli audit) Findings

**Issue**: The deploy printed audit findings. The audit never blocks a deploy; validation errors that stop one come from the platform (see below).

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
# Add to app/translations/en.yml
en:
  errors:
    not_found: "Page not found"
```

### What the Deploy Now Rejects

The platform tightened deploy-time validation through 2026. Deploy to staging to find
these: nothing else reports them.

- **YAML that used to deploy silently wrong.** Since 9 September 2026 the parser that
  reads every front matter and `.yml` file refuses three spellings instead of rewriting
  them: `status: :draft` (was deployed as the string `":draft"`), `thing: !ruby/object:Foo`
  (deployed with the tag dropped) and `other: *missing` (deployed as nothing). The error
  names the fix. Anchors, aliases, the `<<:` merge key and dates are unchanged.
- **Two files claiming the same Table or Form name** fail the deploy, on deploys of
  any size (12 August 2026). Two Model Schemas, Profile Types or User Profiles that
  resolve to the same parameterized name fail fast with both files named (20 April).
- **A Liquid syntax error, unknown tag or unknown filter** is reported with its line:
  `Liquid syntax error (line 4): Unknown filters: not_a_filter` (26 August).
- **Every validation error is reported together** in one response rather than stopping
  at the first (20 April), and the deploy returns a report of what was upserted or
  deleted per resource type, with an `asset_status` of `in_progress`, `success` or
  `error` for the asset phase.
- **A stale partial after a large deploy** is no longer the platform's fault: before
  12 August 2026 a deploy touching more than 250 partials expired the compiled-template
  cache for the last batch only, so partials outside it kept serving their previous
  compiled version. The same fix expires a deleted partial's `path:` alias properly and
  warns on a `Duplicate pk` collision split across batches (the last file still wins).

## Migration Issues

### Failed Migration

**Issue**: Migration fails during deployment

**Problem**: Database inconsistency

**Solution**:
1. Investigate error: `insites-cli logs staging | grep -i migration` (`--filter` matches an entry's type, not its text)
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

# Sync with the CLI's debug output (sync has no --verbose option)
DEBUG=1 insites-cli sync dev

# Note: insites-cli env clear-cache does not exist.
# Manually verify your .insites file if sync issues persist.
```

### Partial Sync Failures

**Issue**: Some files sync, others fail

**Solution**:
```bash
# Deploy all at once instead
insites-cli deploy staging

# Or debug one file at a time (DEBUG prints the CLI's debug lines)
DEBUG=1 insites-cli sync dev -f app/views/pages/home.liquid
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
# Verify schema syntax: properties is a list, not a map
# app/user.yml
properties:
  - name: roles
    type: array
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
- In CI, set all five of `INSITES_URL`, `INSITES_EMAIL`, `INSITES_TOKEN`, `INSITES_INSTANCE` and `INSITES_INSTANCE_KEY`; with any one missing the CLI ignores them and reads `.insites` (see [configuration](configuration.md#credentials-from-environment-variables))

### Mismatched Environment

**Issue**: Deploying to wrong environment

**Prevention**:
```bash
# Note: insites-cli env current does not exist.
# Verify your target by checking the .insites file directly.

# Use explicit environment
insites-cli deploy production  # always name the environment
```

## CloudShell

### Header Credentials Are Refused

CloudShell (`https://cloudshell.insites.io/mcp`) answers a request signed with header credentials with `401 WorkOS authentication required`. Only the browser WorkOS sign-in works. In Claude Code, add it as an HTTP MCP server (`claude mcp add cloudshell --scope user --transport http https://cloudshell.insites.io/mcp`), then sign in from `/mcp`. Measured July 2026.

### Deploying Needs the Developer Role

Console v6 roles are Viewer, Editor, Developer, Admin and Owner; the wire names `read`, `edit` and `deploy` map to Viewer, Editor and Developer. Read from source on 7 October 2026, as the default gating (an organization can edit it):

| Level | CloudShell tools |
|---|---|
| read | logs, environment variable get, history, GitHub reads |
| edit | environment variable set, push to a branch, change the watched branch |
| deploy | deploy, sync, upload, asset, GitHub push, connect, disconnect and revert |

So deploying needs Developer or above. `insites_list_instances` is not filtered by role: it lists every instance in the caller's Console accounts plus explicit grants, including ones they cannot change.

### CloudShell Cannot See an Instance

An instance appears in CloudShell once it has a connection, created by the Console OAuth callback or by the CloudShell connection registration at the end of the v6 instance setup. An instance created in the v5 Console is not connected automatically. Measured 16 October 2026: a setup run with no subdomain and no packages returned `skipped` without reaching the backend, so the registration never ran and CloudShell could not see the instance.

`insites_github_tree` on an instance with no GitHub connection answers "No GitHub connection found for this instance", so it cannot list that instance's files.

### An Upload Slot Belongs to Its Instance

`insites_select_instance` is per session since CloudShell v1.2.2 (see [Deploying Through CloudShell](README.md#deploying-through-cloudshell)). A client that sends no MCP session id falls back to a single per-person selection, shared by all that person's sessions. A slot from `insites_request_upload` stays bound to the instance it was requested for. Before v1.2.2 the selection was shared, and on 29 September 2026 another session switched it mid-batch so files landed on the wrong instance.

### Check `backupRetained` Before Relying on a Rollback

When `insites_commit_upload` overwrites a file, CloudShell normally keeps the replaced file for 30 days. The commit result says whether it did in `backupRetained`. On 13 November 2026 a second overwrite of the same file returned `false` ("No copy of the replaced file could be read"). When it is `false`, roll back by uploading the previous version yourself.

### A Migration Runs When It Is Committed

A migration file committed through CloudShell runs once, at commit. To run it again, give it a new timestamp. Measured 29 to 30 September 2026.

## Instance and Console Addresses

- Console v6 is `https://console.insites.io/` since 13 October 2026. The v5 Console moved to `https://console-v5.prod01.sydney.platformos.com`.
- Signed in to the Console, a browser is signed in to every instance the person can reach (28 October 2026).
- v6 instances are `<name>.prod01-insites.io` (production) and `<name>.staging-insites.io` (staging), not `.insites.site`.
- The v6 admin is `<instance>/admin/insites`. Bare `/admin` answers 404 even when signed in, so a 404 there does not mean you are signed out (28 October 2026).
- Giving a production instance a subdomain moves it to `<subdomain>.prod01-insites.io` at once. Its old `site-<id>` address then answers 302 to insites.io, and an admin key answers 401 there, so point credentials at the new address straight away (17 October 2026).

## See Also

- [CLI Gotchas](../cli/gotchas.md)
- [Deployment Patterns](./patterns.md)
