# CLI Commands Reference

Complete reference for `insites-cli`. All command signatures verified against `insites-cli help <command>` output.

The CLI's top-level commands fall into three groups:
- **Direct verbs** — `archive`, `audit`, `deploy`, `init`, `pull`, `sync`
- **Subcommand groups** — `constants`, `data`, `duplicate`, `env`, `exec`, `gui`, `logsv2`, `migrations`, `modules`

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

Check the project for deprecations, recommendations, and errors. Used in pre-commit and pre-deploy gates.

```bash
insites-cli audit
```

No options. The audit traverses `app/` and reports any rules that fire. Exit code is non-zero on errors, zero on warnings/info only.

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

Deployment runs the audit, syncs files, executes pending migrations, and updates the environment.

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

`gui serve` does not accept a `--port` flag — it picks an available port and prints the URL on start.

---

## logsv2

Display logs and errors. **`logsv2` has subcommands, not flags** — pick the one you need.

```bash
insites-cli logsv2 search
insites-cli logsv2 searchAround
insites-cli logsv2 alerts
insites-cli logsv2 reports
```

(Alias: `l2`)

| Subcommand | Description |
|---|---|
| `search` | Search logs |
| `searchAround` | Search the stream for records around a timestamp |
| `alerts` | Manage alerts |
| `reports` | Predefined reports based on logs |

The CLI's per-subcommand help does not surface argument detail beyond what's shown here; check `insites-cli logsv2 search` interactive output (or your instance's docs) for filter/range arguments.

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

On the private stack the CLI stores your Insites Console sign-in, not the instance key, and asks the Console for the key at the start of each command (insites-cli 6.0.0 and later). Removing someone's access in the Console stops their next command. When nothing identifies the stack, a new environment uses `private`.

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
| `export [environment]` | env optional | Export instance data to a JSON file |
| `import [environment]` | env optional | Import instance data from a JSON file |
| `clean [environment]` | env optional | Remove all stored data (users, models, etc.). **Irreversible.** |

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
