# CLI Commands Reference

Complete reference for `insites-cli`. All command signatures verified against `insites-cli help <command>` output.

The CLI's top-level commands fall into three groups:
- **Direct verbs**: `archive`, `audit`, `deploy`, `init`, `logs`, `pull`, `sync`
- **Subcommand groups**: `constants`, `data`, `duplicate`, `env`, `exec`, `gui`, `logsv2`, `migrations`, `modules`

Run `insites-cli help <command>` for the live signature on any instance — this doc reflects the same source.

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

What it checks (CLI 5.10.2, `lib/audit/`):

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
```

(Alias: `d`)

| Option | Description |
|---|---|
| `-p, --partial-deploy` | Partial deployment — does not remove data from directories missing in the build |

Deployment runs the audit (skipped when `CI=true`), then deploys whatever it reports, executes pending migrations, and updates the environment.

---

## sync

Synchronize local changes to an environment. **Watch mode is the default** — `sync <env>` opens a long-running watcher that pushes changes as files are saved.

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
| `-f, --file <file>` | — | Sync a single file once and exit (no watcher) |
| `-l, --livereload` | off | Use livereload to refresh the browser on each sync |

**There is no `--watch` flag** — watch is the default. Use `-f` to opt out and sync exactly one file.

---

## gui

Manage the local GUI for content editing, GraphQL, and logs.

```bash
insites-cli gui serve [environment]
```

| Subcommand | Description |
|---|---|
| `serve [environment]` | Serve the GUI for files from the given environment |

`gui serve` takes `-p, --port <port>` (default `3030`), `-o, --open` to open a browser when ready, and `-s, --sync` to sync files while it runs.

---

## logs

Stream an instance's logs to the terminal. It reads from the instance itself, so it works on every stack.

```bash
insites-cli logs staging
insites-cli logs staging --filter error
insites-cli logs staging --interval 1000 -q
```

(Alias: `l`)

| Option | Default | Description |
|---|---|---|
| `--interval <ms>` | `3000` | Time between polls, in milliseconds |
| `--filter <type>` | none | Show only entries of this type, compared without case. An entry with no type counts as `error`. `{% log x, type: 'debug' %}` writes an entry of type `debug` |
| `-q, --quiet` | off | Print the message only, without the path, page, partial and user line |

It runs until you press `Ctrl+C`. It never exits on its own, so `$(insites-cli logs ...)` and `insites-cli logs ... | wc -l` never finish. It has no `--follow`, `--tail` or `--source-name` option; each is rejected as an unknown option. To narrow by text, pipe it: `insites-cli logs staging | grep send_email`.

---

## logsv2

Search log history, and manage alerts and reports. **`logsv2` takes a subcommand first, then the environment.** `insites-cli logsv2 staging` is rejected as an unknown command.

```bash
insites-cli logsv2 search staging --size 50
insites-cli logsv2 search staging --start_time <t> --end_time <t> --json
insites-cli logsv2 searchAround staging --key 1701428187696722
insites-cli logsv2 alerts list staging
insites-cli logsv2 reports staging --json
```

(Alias: `l2`)

| Subcommand | Options |
|---|---|
| `search [environment]` | `--sql <sql>`, `--size <n>` (default 10), `--from <n>` (default 0), `--start_time`, `--end_time`, `--json` |
| `searchAround [environment]` | `--key <timestamp>`, `--stream_name <name>` (default `logs`), `--size <n>` (default 10), `--json` |
| `alerts list [environment]` | `--json` |
| `alerts add [environment]` | `--name`, `--keyword`, `--url`, `--operator` (default `Contains`), `--column` (default `message`), `--channel`, `--json` |
| `alerts trigger [environment]` | `--name`, `--json` |
| `reports [environment]` | `--json` |

None of them takes `--filter`. `alerts rm` is listed in the help, but CLI 5.10.2 ships no script for it, so it fails.

**`logsv2` needs a log proxy, and only the shared stack has one.** On the Insites stack (`*.staging-insites.io` and `*.prod01-insites.io` hosts, where v6 instances run) every `logsv2` subcommand prints `logsv2 is not available on the Insites dedicated stack: it publishes no log proxy` and stops. Use `insites-cli logs` there, or set `LOGS_PROXY_URL` to a proxy that serves the instance.

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

## pull

Export app data from an environment into a zip file.

```bash
insites-cli pull <environment>
insites-cli pull <environment> -p ./backup.zip
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
| `pull [environment] <name>` | name required | Pull a module from an instance. Only the module's `public/` files come back; its `private/` files, including every schema and migration of an IIA module, stay on the instance. Pulling `insites_events` from a v6 instance returned one file, its `hook_module_info` partial |
| `remove [environment] <name>` | name required | Remove module from instance (removes configuration and data) |
| `version [version] --package` | `--package` required | Create a new version of the module |

---

## migrations

Manage migrations on an environment.

```bash
insites-cli migrations generate [environment] <name>
insites-cli migrations list [environment]
insites-cli migrations run <timestamp> [environment]
```

| Subcommand | Args | Description |
|---|---|---|
| `generate [environment] <name>` | name required | Generate a new empty migration file |
| `list [environment]` | env optional | List migrations and their statuses |
| `run <timestamp> [environment]` | timestamp required | Run the migration matching the timestamp |

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
insites-cli env add [environment] --email user@example.com --instance-uuid abcd-ef123-4567
insites-cli env list
```

| Subcommand | Args | Description |
|---|---|---|
| `add [environment] --email <e> --instance-uuid <u>` | flags required | Add a new environment |
| `list` | no args | List all known environments |

Example:

```bash
insites-cli env add staging --email dev@example.com --instance-uuid 12345-abcde-67890
```

---

## data

Export, import, or clean data on an instance.

```bash
insites-cli data export [environment]
insites-cli data import [environment]
insites-cli data clean [environment]
```

| Subcommand | Args | Description |
|---|---|---|
| `export [environment]` | `-p, --path <file>`, `-e, --export-internal-ids`, `-z, --zip` (on by default) | Export instance data. Writes a zip archive, `data.zip` unless `--path` names another |
| `import [environment]` | `-p, --path <file>` (default `data.json`), `-z, --zip`, `--raw-ids` | Import a JSON file, or a zip archive with `--zip`. No CSV, and no table argument |
| `clean [environment]` | `--auto-confirm`, `-i, --include-schema` | Remove all stored data (users, records). Asks you to type `CLEAN DATA` unless `--auto-confirm`; `--include-schema` also removes pages, schemas and other files. **Irreversible.** |

`clean` is destructive and not reversible — only use against staging/dev environments you are willing to wipe.

---

## help

Display help for any command or subcommand.

```bash
insites-cli help                  # top-level commands
insites-cli help <command>        # signature for a specific command
insites-cli help <command> <sub>  # falls back to top-level help (CLI limitation)
```

The CLI's help system surfaces the top-level signature for each command but does not currently render per-leaf-subcommand help — if `insites-cli help modules version` returns top-level help, look at the parent command's help (`insites-cli help modules`) for the subcommand signature.

---

## See Also

- [CLI Configuration](./configuration.md) — environment files, auth tokens, env var setup
- [Advanced CLI Patterns](./advanced.md) — composing commands in CI, scripting
- [CLI Troubleshooting](./gotchas.md) — common failure modes
