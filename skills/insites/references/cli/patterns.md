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

4. View real-time logs:

```bash
insites-cli logs dev
```

## Pre-Deployment Validation

### Linting and Checks

Always run insites-cli audit before deployment:

```bash
insites-cli audit
```

Checks performed:
- Liquid syntax validation
- Tag usage correctness
- Translation file completeness
- Partial naming conventions
- Asset references

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
insites-cli modules pull dev <module-name>
insites-cli modules pull dev my-custom-module
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
insites-cli migrations run <timestamp> dev
insites-cli migrations list dev
```

## Data Operations Pattern

These commands work on all data on the instance. There is no per-table export, import or clean.

### Backup Before Operations

```bash
insites-cli data export dev -p backup.zip
```

### Bulk Operations

```bash
insites-cli data import staging -p data.zip --zip
```

### Data Cleanup

Removes all data on the instance. Use it on staging only.

```bash
insites-cli data clean staging
```

## Batch Command Execution

### Shell Scripts for Deployments

```bash
#!/bin/bash
ENV=$1
insites-cli audit
insites-cli deploy $ENV
```

## See Also

- [CLI Commands](./api.md)
- [Advanced Patterns](./advanced.md)
- [Deployment Patterns](../deployment/patterns.md)
