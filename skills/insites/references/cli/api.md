# CLI Commands Reference

Complete reference for `insites-cli`. All command signatures verified against `insites-cli help <command>` output.

The CLI's top-level commands fall into three groups:
- **Direct verbs**: `archive`, `audit`, `deploy`, `doctor`, `init`, `logs`, `pull`, `sync`
- **Subcommand groups**: `constants`, `data`, `duplicate`, `env`, `exec`, `gui`, `migrations`, `modules`

Run `insites-cli help <command>` for the live signature on any instance; this doc reflects the same source.

---

## archive

Create a deployment archive without deploying. Useful for CI/CD pipelines.

```bash
insites-cli archive
insites-cli archive -o ./tmp/release.zip
```

| Option | Default | Description |
|---|---|---|
| `-o, --output <output>` | `./tmp/release.zip` | Archive output path |

---

## audit

Scan the project for deprecated code and file-layout faults.

```bash
insites-cli audit
```

No options, and no arguments: `insites-cli audit app/views/pages/` scans the whole project. It reads `app/` and `modules/`, prints `[Audit] N rules detected issues.`, then lists each rule's message and files.

**It exits 0 whether or not a rule fires.** A CI step such as `insites-cli audit || exit 1` never fails. To gate on it, fail when the summary count is not 0.

What it checks (insites-cli 6.1.0, `lib/audit/`):

| Check | Fires on |
|---|---|
| Deprecated tags | A fixed list of retired tags, such as `form_tag`, `input`, `select`, `query_graph`, `will_paginate` |
| Deprecated filters | A fixed list of retired filters, such as `to_money`, `timeago`, `strip_tags`, `pagination_links` |
| Deprecated keys | `enable_profiler: true` in a page; `[]` after an input name; `resource_id:` on `include_form`; `configuration:` in a form (use `fields`); `attribute_type:` or `custom_attributes:` in a profile or model type (use `type`, `properties`); `headers:` in an API call (use `request_headers`); a model `name:` that is not snake_case |
| File types per folder | A non-`.liquid` file in `forms`, `authorization_policies`, `notifications`, `emails`, `api_calls` or `smses`; a non-`.yml` file in `user_profile_types` or `model_schemas`; a non-`.graphql` file in `graphql` |
| Partial name clash | A partial and an underscore twin at the same path (`card.liquid` and `_card.liquid`) |
| File names | A character outside letters, digits, spaces and `- _ ~ @ % + . / \ ( ) ' & ]` |
| Partials never included | A partial no `include` or `function` call names. `render` calls are not counted, so a partial used only through `render` is listed. The check turns itself off when any `include` or `function` takes a variable, which includes every `{% function result = '...' %}` |

It does not check Liquid syntax, GraphQL, page front matter, HTML in pages, GraphQL in partials, translations, or credentials. Those are conventions; see `SKILL.md` section 2.

---

## deploy

Deploy code to an environment. The environment is required.

```bash
insites-cli deploy <environment>
insites-cli deploy --partial-deploy <environment>
insites-cli deploy <environment> --dry-run --verbose
```

(Alias: `d`)

| Option | Description |
|---|---|
| `-p, --partial-deploy` | Partial deployment: does not remove data from directories missing in the build |
| `--dry-run` | Validate the release on the instance and print what would change, without applying anything. Every validation error is listed at once, each starting with its file path. Private stack only (insites-cli 6.1.0 and later) |
| `--verbose` | List every file path in the deploy report, not just the counts (6.1.0 and later) |
| `--json` | Print the result and the deploy report as JSON on stdout; everything else goes to stderr (6.1.0 and later) |

After each deploy, insites-cli 6.1.0 and later print the instance's report: for each type of file, how many were upserted, deleted and skipped (unchanged). Run `--dry-run` before a deploy you are unsure of, especially a full deploy, which deletes files that are not in the release.

Deployment runs the audit (skipped when `CI=true`), then deploys whatever it reports, executes pending migrations, and updates the environment.

---

## sync

Synchronize local changes to an environment. **Watch mode is the default**: `sync <env>` opens a long-running watcher that pushes changes as files are saved.

```bash
insites-cli sync <environment>
insites-cli sync <environment> -c 5
insites-cli sync <environment> -f path/to/file.liquid
insites-cli sync <environment> -l
```

(Alias: `s`)

| Option | Default | Description |
|---|---|---|
| `-c, --concurrency <number>` | `3` | Maximum concurrent connections to the server |
| `-f, --file <file>` | none | Meant to sync a single file once and exit. Currently throws `RangeError: path should be a path.relative()d string` for any path; see [gotchas](gotchas.md#sync---file-throws-rangeerror) |
| `-l, --livereload` | off | Use livereload to refresh the browser on each sync |

**There is no `--watch` flag**; watch is the default.

**Syncing a schema file provisions the table.** Syncing `app/schema/<name>.yml` creates or updates the table, answering `WARNING: Data schema was updated. It will take a while for the change to be applied.`, and the table is usable within seconds. A full `deploy` is not needed for a schema change.

---

## gui

Manage the local GUI for content editing, GraphQL, and logs.

```bash
insites-cli gui serve [environment]
```

| Subcommand | Description |
|---|---|
| `serve [environment]` | Serve the GUI for files from the given environment |

| Option | Default | Description |
|---|---|---|
| `-p, --port <port>` | `3030` | Port to serve the GUI on |
| `-o, --open` | off | Open the GraphQL editor in your default browser when ready |
| `-s, --sync` | off | Sync files while the GUI runs |

---

## exec

Execute Liquid or GraphQL on an instance. **Type goes first, environment second.**

```bash
insites-cli exec liquid <environment> [code]
insites-cli exec graphql <environment> [graphql]
```

| Subcommand | Args | Description |
|---|---|---|
| `liquid <environment> [code]` | env required, code optional | Execute Liquid code |
| `graphql <environment> [graphql]` | env required, query optional | Execute a GraphQL query |

Examples:

```bash
insites-cli exec liquid staging "{{ 'now' | date: '%Y-%m-%d' }}"
insites-cli exec graphql staging "{ records(per_page: 1) { results { id } } }"
```

If `[code]` / `[graphql]` is omitted, the CLI reads from stdin or opens an editor (depends on terminal).

---

## init

Initialize the project directory structure.

```bash
insites-cli init
```

No arguments. Run once at the start of a new project.

---

## doctor

Check the setup and say how to fix each problem (insites-cli 6.1.0 and later).

```bash
insites-cli doctor
insites-cli doctor staging --json
```

Checks the Node.js version, whether a newer CLI is published, the `.insites` file, how each environment signs in, whether the sign-in works, whether the instance answers and accepts it, and the linter config. Exit code 1 when a check fails. It never prints a key or token. Run it first when a command fails with an authentication or connection error.

---

## logs

Stream an instance's logs live.

```bash
insites-cli logs <environment>
insites-cli logs <environment> --filter error
insites-cli logs <environment> --json | jq 'select(.error_type == "error")'
```

| Option | Default | Description |
|---|---|---|
| `--interval <ms>` | `3000` | Time between polls |
| `--filter <type>` | | Only entries of this type, compared without case. An entry with no type counts as `error`. `{% log x, type: 'debug' %}` writes an entry of type `debug` |
| `-q, --quiet` | | The message only, without the path, page, partial and user line |
| `--json` | | One JSON object per entry (`id`, `created_at`, `error_type`, `message`, `data`), for `jq` or an agent. 6.1.0 and later |

(Alias: `l`)

`logs` always follows new entries until you press `Ctrl+C`; there is no `--follow`, `--tail` or `--source-name` flag, and each is rejected as an unknown option. Because it never exits on its own, `$(insites-cli logs ...)` and `insites-cli logs ... | wc -l` never finish. To find the entries for one job or partial, give it a log entry with its own type (`{% log note, type: 'send_email' %}`) and run `insites-cli logs staging --filter send_email`, or filter the text: `insites-cli logs staging --json | grep 'job_name'`.

---

## pull

Download the instance's `app/` folder as a zip: code only, with no records, modules or assets. It is not a backup. On 27 September 2026 it returned 16 files (7.7 KB) from an instance holding about 13,000 records, 25 modules and 126 assets. For the data, use [`data export`](#data) (see [Backup Before Operations](patterns.md#backup-before-operations)). Through the Insites proxy, `pull` is also how to read a file over 4 MB: the zip is downloaded from storage, so the proxy's size limit does not apply (see [Large Files Through the Insites Proxy](gotchas.md#large-files-through-the-insites-proxy)).

```bash
insites-cli pull <environment>
insites-cli pull <environment> -p ./app.zip
```

| Option | Default | Description |
|---|---|---|
| `-p, --path <export-file-path>` | `app.zip` | Output file path |

---

## duplicate

Duplicate one environment into another.

```bash
insites-cli duplicate init <sourceEnv> <targetEnv>
```

| Subcommand | Args | Description |
|---|---|---|
| `init <sourceEnv> <targetEnv>` | both required | Duplicate source into target (code, data, configuration) |

---

## modules

Manage modules on an instance.

```bash
insites-cli modules init <name>
insites-cli modules list [environment]
insites-cli modules pull [environment] <name>
insites-cli modules remove [environment] <name>
insites-cli modules version [version] --package
```

| Subcommand | Args | Description |
|---|---|---|
| `init <name>` | name required | Initialize a module locally with the starter structure |
| `list [environment]` | env optional | List installed modules on the environment |
| `pull [environment] <name>` | name required | Pull a module from an instance. Only the module's `public/` files come back; its `private/` files, including every schema and migration of an IIA module, stay on the instance. Pulling `insites_events` from a v6 instance returned one file, its `hook_module_info` partial. The files arrive as a zip, `modules.zip` unless `-p <path>` names another, and are not unpacked |
| `remove [environment] <name>` | name required | Remove module from instance (removes configuration and data) |
| `version [version] --package` | `--package` required | Create a new version of the module |

`modules pull` writes a zip and leaves `modules/` untouched (insites-cli 6.1.0, `bin/insites-cli-modules-pull.js`). Unpack it yourself: `insites-cli modules pull staging my_module -p my_module.zip && unzip -o my_module.zip && rm my_module.zip`.

---

## migrations

Manage migrations on an environment.

```bash
insites-cli migrations generate [environment] <name>
insites-cli migrations list [environment]
insites-cli migrations run <timestamp> [environment]
insites-cli migrations status <timestamp> [environment]
insites-cli migrations retry <timestamp> [environment]
```

| Subcommand | Args | Description |
|---|---|---|
| `generate [environment] <name>` | name required | Generate a new empty migration file |
| `list [environment]` | env optional | List migrations and their statuses |
| `run <timestamp> [environment]` | timestamp required | Run the migration matching the timestamp |
| `status <timestamp> [environment]` | timestamp required | One migration's state and error messages; `--json`. insites-cli 6.0.0 and later |
| `retry <timestamp> [environment]` | timestamp required | Show the state, then run it again. insites-cli 6.0.0 and later |

---

## constants

Manage constant variables on an instance. **Values are passed via `--name` / `--value` flags, not positional arguments.**

```bash
insites-cli constants set [environment] --name TOKEN --value SECRET_TOKEN
insites-cli constants unset [environment] --name TOKEN
insites-cli constants list [environment]
SAFE=1 insites-cli constants list [environment]
```

| Subcommand | Args | Description |
|---|---|---|
| `set [environment] --name X --value Y` | both flags required | Set a constant |
| `unset [environment] --name X` | name required | Unset a constant |
| `list [environment]` | env optional | List all constants. Values are masked by default |

The `SAFE=1` env var on `constants list` shows the full unmasked values:

```bash
SAFE=1 insites-cli constants list staging
```

---

## env

Manage environments (the local CLI registry of instances you can target).

```bash
insites-cli env add [environment] --instance-uuid abcd-ef123-4567
insites-cli env list
insites-cli env refresh-token [environment]
```

| Subcommand | Args | Description |
|---|---|---|
| `add [environment] --instance-uuid <u>` | UUID required; `--email` for a shared-stack instance | Add a new environment. On the private stack it signs you in to the Insites Console in the browser |
| `list` | no args | List all known environments |
| `refresh-token <environment>` | environment required | Sign in again for one environment, changing only its entry. insites-cli 6.0.0 and later |
| `add <environment> --url <proxy> --token iak_...` | both required | Sign in with a personal access token from the Insites Console's CLI tab, using the command the Console shows. Requests go through the Insites proxy, which checks your role on each request and records each deploy against you. The proxy refuses an answer over 4 MB and a request of about 5 MB: see [Large Files Through the Insites Proxy](gotchas.md#large-files-through-the-insites-proxy). insites-cli 6.1.0 and later |

On the private stack the CLI stores your Insites Console sign-in, not the instance key, and asks the Console for the key at the start of each command (insites-cli 6.0.0 and later). Removing someone's access in the Console stops their next command. When nothing identifies the stack, a new environment uses `private`.

Example:

```bash
insites-cli env add staging --email dev@example.com --instance-uuid 12345-abcde-67890
```

---

## data

Export, import, or clean data on an instance.

```bash
insites-cli data export [environment] -p data.zip
insites-cli data import [environment] -p data.zip --zip
insites-cli data clean [environment]
```

| Subcommand | Args | Description |
|---|---|---|
| `export [environment]` | `-p, --path <file>`, `-e, --export-internal-ids`, `-z, --zip` (on by default) | Export all data on the instance. Writes a zip archive, `data.zip` unless `--path` names another |
| `import [environment]` | `-p, --path <file>` (default `data.json`), `-z, --zip`, `--raw-ids` | Import a JSON file, or a zip archive with `--zip`. No CSV, and no table argument |
| `clean [environment]` | `--auto-confirm`, `-i, --include-schema` | Remove all stored data (users, records). Asks you to type `CLEAN DATA` unless `--auto-confirm`; `--include-schema` also removes pages, schemas and other files. **Irreversible.** |

These commands work on the whole instance. There is no per-table export or clean.

`clean` is destructive and not reversible. Only use against staging/dev environments you are willing to wipe.

---

## help

Display help for any command or subcommand.

```bash
insites-cli help                  # top-level commands
insites-cli help <command>        # signature for a specific command
insites-cli help <command> <sub>  # falls back to top-level help (CLI limitation)
```

The CLI's help system surfaces the top-level signature for each command but does not currently render per-leaf-subcommand help. If `insites-cli help modules version` returns top-level help, look at the parent command's help (`insites-cli help modules`) for the subcommand signature.

---

## See Also

- [CLI Configuration](./configuration.md): environment files, auth tokens, env var setup
- [Advanced CLI Patterns](./advanced.md): composing commands in CI, scripting
- [CLI Troubleshooting](./gotchas.md): common failure modes
