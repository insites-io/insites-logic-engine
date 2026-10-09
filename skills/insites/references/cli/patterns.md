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
insites-cli sync dev --watch
```

4. View real-time logs:

```bash
insites-cli logsv2 dev --follow
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
insites-cli constants set dev API_KEY "key_xyz"
insites-cli constants set staging WEBHOOK_SECRET "secret_abc"
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
insites-cli data export dev users data/backup_users.csv
```

### Bulk Operations

```bash
insites-cli data import staging users data/import_users.csv
```

### Data Cleanup

```bash
insites-cli data clean staging test_records
```

## Batch Command Execution

### Shell Scripts for Deployments

```bash
#!/bin/bash
ENV=$1
insites-cli audit
insites-cli deploy $ENV
insites-cli logsv2 search
```

## See Also

- [CLI Commands](./api.md)
- [Advanced Patterns](./advanced.md)
- [Deployment Patterns](../deployment/patterns.md)
