# insites-cli

Command-line tools for Insites development.

> **CLI COMMAND STATUS: read before using any CLI examples:**
> - `insites-cli logs <environment>` (alias `l`) streams the instance's logs live and works on both stacks. Use it to watch logs.
> - `insites-cli constants` works: `set`, `unset` and `list`. See `references/constants/`.
> - `insites-cli cache` does not exist. See `references/caching/`.
> - `insites-cli sessions` does not exist. See `references/sessions/`.
> - `insites-cli assets` does not exist. See `references/assets/`.

## insites-cli Commands

### Deployment
```bash
insites-cli deploy dev                          # Deploy to environment
insites-cli deploy production                   # Deploy to production
```

### Development
```bash
insites-cli sync dev                            # Watch and sync file changes
insites-cli gui serve dev                       # Start GraphQL GUI explorer
```

### Debugging
```bash
insites-cli logs dev                            # Stream live logs until Ctrl+C (alias: l)
insites-cli logs dev --filter error             # Only entries whose type is "error"
insites-cli exec liquid dev '<code>'            # Execute Liquid snippet
insites-cli exec graphql dev '<query>'          # Execute GraphQL query
```

### Testing
```bash
insites-cli test run dev                        # Run every *_test.liquid (staging/development only)
insites-cli test run dev -n <NAME>              # Run tests whose path contains NAME
insites-cli test run dev --min-tests 12         # Fail unless at least 12 tests run
insites-cli test run dev --isolate              # Roll back DB writes the tests make
```
See `references/testing/` for writing tests and gating CI.

### Modules
```bash
insites-cli modules pull dev <name>             # Pull a module's public files from an instance
insites-cli modules init <name>                 # Create modules/<name> from the bundled starter
insites-cli modules list dev                    # List installed modules
insites-cli modules remove dev <name>           # Remove a module and its data
```

### Constants
```bash
insites-cli constants set --name KEY --value "val" dev    # Set constant
insites-cli constants list dev                             # List constants
```

### Migrations
```bash
insites-cli migrations generate dev <name>      # Create migration file
insites-cli migrations run TIMESTAMP dev        # Run specific migration
insites-cli migrations list dev                 # List migration states
```

### Data
```bash
insites-cli data export dev --path=data.zip     # Export all data
insites-cli data import dev --path=data.zip --zip  # Import data
insites-cli data clean dev                      # Clean all data (DANGEROUS)
```

## Linting (insites-cli audit)

**Run after every file change and read the report.**

```bash
insites-cli audit                            # Scans app/ and modules/; takes no arguments
```

### What it checks

- Deprecated tags, filters and front-matter keys
- File types in the wrong folder
- A partial and its underscore twin at the same path
- Characters not allowed in file names
- Partials no `include` or `function` call names

It does not check Liquid syntax, translations or credentials. It exits 0 even when a rule fires, so read the `[Audit] N rules detected issues.` line. Full list in [`api.md`](api.md#audit).

## Environment Configuration

### .insites file (JSON)
```json
{
  "dev": {
    "instance_uuid": "uuid",
    "token": "token",
    "email": "dev@example.com",
    "url": "https://your-instance.staging-insites.io",
    "key": "key"
  }
}
```

Generate with: `insites-cli env add dev --email dev@example.com --instance-uuid your-uuid`

## Debugging Workflow

```bash
# Terminal 1: Watch logs
insites-cli logs dev

# Terminal 2: Make changes and observe
insites-cli sync dev

# Terminal 3: Test endpoints
curl -i https://your-instance.staging-insites.io/endpoint
```

Check logs when you get 5xx responses.
