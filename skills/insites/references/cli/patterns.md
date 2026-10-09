# CLI Usage Patterns

## Development Workflow

### Local Development Setup

1. Configure development environment in `.insites` file
2. Start GUI server for hot reload:

```bash
insites-cli gui serve
```

3. In another terminal, watch file synchronization:

```bash
insites-cli sync dev
```

4. View real-time logs (runs until `Ctrl+C`):

```bash
insites-cli logs dev
```

## Pre-Deployment Validation

### Linting and Checks

Always run insites-cli audit before deployment and read the summary count:

```bash
insites-cli audit
```

Checks performed: deprecated tags, filters and keys; file types per folder; partial name clashes; file names; partials never included. It does not check Liquid syntax, translations or asset references, and it exits 0 either way. Full list in [`api.md`](api.md#audit).

## Environment Promotion Pipeline

### Dev → Staging → Production

```bash
# 1. Deploy to development
insites-cli deploy dev

# 2. Deploy to staging for QA
insites-cli deploy staging

# 3. Deploy to production
insites-cli deploy production
```

## Module Management Pattern

### Working with modules

Modules are preinstalled per Insites instance and updated through the Insites console, not the CLI. There is no `insites-cli modules install` command. The CLI's module commands are for **pulling a module's local source** (to read or override its files locally), not for installing modules onto an instance.

Pull a module's source from an instance:

```bash
insites-cli modules pull <module-name> dev
insites-cli modules pull my-custom-module dev
```

### Updating Modules

Check current versions:

```bash
insites-cli modules list dev
```

## Secrets and Configuration Pattern

### Managing API Keys

Store all secrets as constants:

```bash
insites-cli constants set --name API_KEY --value "key_xyz" dev
insites-cli constants set --name WEBHOOK_SECRET --value "secret_abc" staging
```

Reference in code:

```liquid
{% assign api_key = context.constants.API_KEY %}
```

## Migration Workflow

### Creating and Running Migrations

```bash
insites-cli migrations generate dev add_user_status
# Edit generated migration file
insites-cli migrations run dev
insites-cli migrations list dev
```

## Data Operations Pattern

### Backup Before Operations

```bash
insites-cli data export dev --path backup.zip     # every table, as a zip archive
```

### Bulk Operations

```bash
insites-cli data import staging --path data.json    # JSON, or a zip with --zip
```

### Data Cleanup

```bash
insites-cli data clean staging    # removes ALL data on the instance; there is no per-table clean
```

## Batch Command Execution

### Shell Scripts for Deployments

```bash
#!/bin/bash
ENV=$1
insites-cli audit
insites-cli deploy $ENV
# Watch the result in another terminal: insites-cli logs $ENV
# (logs streams until Ctrl+C, so it does not belong inside a script)
```

## See Also

- [CLI Commands](./api.md)
- [Advanced Patterns](./advanced.md)
- [Deployment Patterns](../deployment/patterns.md)
