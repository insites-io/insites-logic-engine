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

### 403 With `error code: 1010`

**Issue**: a script gets `403` and a 17-byte body, `error code: 1010`, on every URL, while the same request from `curl` works.

**Cause**: the firewall in front of instances on the Insites stack refuses some HTTP library default user agents. Measured on a v6 production instance on 24 October 2026: Python `urllib`'s default `Python-urllib/3.x` was refused; `curl`, `python-requests`, a custom string and no `User-Agent` at all were answered.

**Solution**: send your own `User-Agent` (and an `Accept` header) from every script. See [Two APIs, two credentials](../building-on-insites/01-two-apis-two-credentials.md#send-accept-and-user-agent-from-every-script).

### `sync --file` Throws `RangeError`

**Issue**: `insites-cli sync <env> --file <path>` (or `-f`) stops with `RangeError: path should be a path.relative()d string`, for any path, relative or absolute.

**Cause**: the CLI resolves the argument to an absolute path and passes that to its ignore-list check, which accepts only relative paths.

**Solution**: until the CLI is fixed, run `insites-cli sync <env>` on the directory and stop it once the file has synced, or deploy. Measured in September 2026.

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

## Large Files Through the Insites Proxy

An environment added with an Insites Console access token (`insites-cli env add <environment> --url <proxy> --token iak_...`) sends every request through the Insites proxy, not straight to the instance. The proxy has two size limits that the instance itself does not have. Measured on 17 October 2026 on a fresh v6 production instance, with a 4.8 MB page (`views/pages/<name>.html.liquid`, 4,800,056 bytes of body):

| Request through the proxy | Answer |
|---|---|
| `admin_page_create` with the page in `content` (a 5.17 MB JSON request) | 200, the page is created |
| `admin_pages` asking for that page's `content`, even one page per request | **502** `{"error": "The instance response is too large for the proxy"}` |
| The same list without `content` | 200 |
| `sync` of the page's file (`PUT /api/app_builder/marketplace_releases/sync`) | **413** `{"message":"Request Entity Too Large"}` |
| `pull` (`POST /api/app_builder/marketplace_releases/backup`, then the zip) | 200. The zip is downloaded from storage, so it never passes through the proxy |
| A partial release of the page's file, zipped (`deploy --partial-deploy`) | 200. Compressed, the page is a fraction of its size |

**The limits:**
- An answer over **4 MB** is refused with a 502. The proxy's code sets this limit (`MAX_RESPONSE_BYTES = 4 * 1024 * 1024`), and the 502 above is it. Asking for fewer items per page does not help once a single item is over 4 MB.
- A request is refused with a 413 at about 5 MB. A single-file sync of the 4.8 MB page was refused. insites-cli's own deploy code records that the proxy passed a 4.5 MB release and refused a 5.5 MB one (12 October 2026).

**What to do instead:**
- **Read** a large file's content from `pull`. The body of each page in the zip is the file without its front matter, and on 17 October 2026 it matched the admin API's `content` byte for byte for all 129 pages of a v6 production instance. Read everything else about the file with the admin API, leaving the large field out.
- **Write** a large file with `deploy --partial-deploy` of just that file. The release is zipped, and a partial deploy leaves files outside the build in place. The admin API's create and update also accept a page over 4 MB, but they cannot write the settings that only a page's file carries.
- Neither limit applies to an environment added with the browser sign-in (`insites-cli env add <environment> --instance-uuid <uuid>`), which talks to the instance directly.

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
- Keep `insites-cli logs dev` running while you load the page. It shows new entries as they arrive
- Remove `--filter` and see whether anything arrives. It keeps only entries whose type equals the value, ignoring case

### Filter Not Matching

`--filter` compares an entry's type, not its text, and it is not a pattern. Case does not matter. `{% log x, type: 'background_job' %}` matches `--filter background_job`. To match text, pipe the stream:

```bash
insites-cli logs staging --filter background_job
insites-cli logs staging | grep api_call
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
