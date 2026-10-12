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
- Point to another file with the `CONFIG_FILE_PATH` environment variable: `CONFIG_FILE_PATH=/path/to/.insites insites-cli sync dev`

### Port Already in Use

**Issue**: `gui serve` fails with port conflict

**Solution**:
```bash
insites-cli gui serve --port 3001
# Or kill existing process
lsof -i :3030 | kill -9
```

### Migration Conflicts

**Issue**: Migration fails due to schema conflict

**Solution**:
- Check current migrations: `insites-cli migrations list dev`
- Review conflicting migrations
- Resolve manually or create compensating migration

## Linting (insites-cli audit) Failures

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
# File should be at: app/views/partials/components/button.html.liquid
```

### Tag Validation

**Error**: "Unknown tag"

Verify tag spelling and Insites support:

```bash
insites-cli audit --help
```

### Translation Keys

**Error**: "Untranslated string"

Define all strings in translation files:

```yaml
# config/translations.yml
en:
  hello: "Hello"
  goodbye: "Goodbye"
```

## Log Filtering Issues

### No Logs Appearing

**Issue**: Logs filter returns no results

**Solutions**:
- Check environment is correct: `insites-cli logs dev`
- Keep `insites-cli logs dev` running while you load the page. It shows new entries as they arrive
- Check application activity generating logs

### Filter Not Matching

`--filter` matches the log type, for example `error`, not text in the message. To find the entries for one job or API call, search the JSON output:

```bash
insites-cli logs staging --filter error
insites-cli logs staging --json | grep 'job_name'
```

## Module Problems

### Module Not Found

**Issue**: A command or page refers to a module the instance does not have

**Solution**:
- List the modules on the instance: `insites-cli modules list staging`
- Insites modules come with the instance and are managed in the Insites Console; there is no CLI command that installs one

## Data Operations Risks

### Data Cleanup Without Backup

**Issue**: Accidentally deleted all data

**Prevention**:
```bash
# Always back up first. This exports all data on the instance
insites-cli data export dev -p backup.zip

# Then clean. This removes all data on the instance
insites-cli data clean dev
```

### Import Format Errors

**Issue**: Import fails due to file format

**Solution**:
- Import a `.json` file, or the `.zip` that `data export` produces with `--zip`. The CLI does not import CSV
- Check encoding: UTF-8 required
- Test on dev first: `insites-cli data import dev -p data.zip --zip`

## See Also

- [CLI Configuration](./configuration.md)
- [Deployment Issues](../deployment/gotchas.md)
