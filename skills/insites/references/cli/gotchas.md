# CLI Gotchas and Troubleshooting

## Common Issues

### Never Sync to Production Directly

Never use sync command on production:

```bash
# WRONG - Never do this!
insites-cli sync production
```

Always use deploy which includes validation:

```bash
# CORRECT
insites-cli deploy production
```

Production should only receive through:
1. insites-cli audit validation
2. Staging tests
3. Formal deployment process

### Token Expiration

**Issue**: Authentication fails with "Invalid token"

**Solution**:
- Regenerate token in Insites dashboard
- Update `.insites` file
- Note: `insites-cli env clear-cache` does not exist. Manually update the `.insites` file instead.

### Configuration File Not Found

**Issue**: "Cannot find .insites file"

**Solution**:
- Verify `.insites` exists in project root
- Check file permissions: `ls -la .insites`
- Specify explicit path: `CONFIG_FILE_PATH=/path/to/.insites insites-cli sync dev` (there is no `--config` option)

### Port Already in Use

**Issue**: `gui serve` fails with port conflict

**Solution**:
```bash
insites-cli gui serve staging --port 3031
# Or stop whatever holds the default port, 3030
lsof -ti :3030 | xargs kill
```

### Migration Conflicts

**Issue**: Migration fails due to schema conflict

**Solution**:
- Check current migrations: `insites-cli migrations list dev`
- Review conflicting migrations
- Resolve manually or create compensating migration

## Linting (insites-cli audit) Findings

`insites-cli audit` reports deprecated code and file-layout faults (see [`api.md`](api.md#audit)) and exits 0 either way. The errors below come from a sync, a deploy or a page render, not from the audit.

### Syntax Errors

**Error**: "Invalid Liquid syntax"

```liquid
# WRONG
{% if user %}
  {{ user.name }

# CORRECT
{% if user %}
  {{ user.name }}
{% endif %}
```

### Missing Partial

**Error**: "Partial not found"

Ensure partial exists at correct path:

```bash
# Referencing: {% include 'components/button' %}
# File should be at: app/views/partials/components/button.liquid
# Referencing: {% include 'modules/ui/components/button' %}
# File should be at: modules/ui/public/views/partials/components/button.liquid (or private/)
```

### Tag Validation

**Error**: "Unknown tag"

Verify tag spelling and Insites support against the tag reference (`references/liquid/tags/`). The audit flags only the retired tags on its own list.

### Translation Keys

`insites-cli audit` does not check translations. A key that is missing renders `translation missing:` on the page. Define keys in one file per language:

```yaml
# app/translations/en.yml
en:
  hello: "Hello"
  goodbye: "Goodbye"
```

## Log Filtering Issues

### No Logs Appearing

**Issue**: `insites-cli logs` prints nothing

**Solutions**:
- Check the environment name matches one in `.insites`: `insites-cli logs dev`
- Remove `--filter` and see whether anything arrives. It keeps only entries whose type equals the value, ignoring case
- Load a page on the instance so something writes a log entry
- `insites-cli logsv2` on the Insites stack prints that it is not available and stops; use `logs` there

### Filter Not Matching

`--filter` compares an entry's type, not its text, and it is not a pattern. Case does not matter. `{% log x, type: 'background_job' %}` matches `--filter background_job`. To match text, pipe the stream:

```bash
insites-cli logs staging --filter background_job
insites-cli logs staging | grep api_call
```

## Module Installation Problems

### Module Not Found

**Issue**: Module installation fails

**Solution**:
- Verify module name: `insites-cli modules list`
- Check marketplace availability
- Ensure authentication with private modules

### Version Conflicts

**Issue**: Incompatible module versions

**Solution**:
- Review module dependencies
- Check documentation for version requirements
- Downgrade/upgrade compatible versions

## Data Operations Risks

### Data Cleanup Without Backup

**Issue**: Accidentally deleted all data

**Prevention**:
```bash
# Always back up first (writes a zip archive)
insites-cli data export dev --path backup.zip

# Then clean. This removes ALL data on the instance, not one table,
# and asks you to type CLEAN DATA unless --auto-confirm is given
insites-cli data clean dev
```

### Import Format Errors

**Issue**: Import fails with "Invalid format ... Must be a valid json file"

**Solution**:
- `data import` reads a JSON file, or a zip archive with `--zip`. It does not read CSV, and it takes no table argument.
- Test on dev first: `insites-cli data import dev --path data.json`, or `insites-cli data import dev --path backup.zip --zip`

## See Also

- [CLI Configuration](./configuration.md)
- [Deployment Issues](../deployment/gotchas.md)
