# insites-cli

Command-line tools for Insites development.

> **CLI COMMAND STATUS — read before using any CLI examples:**
> - `insites-cli logs` → **does not exist**. Use `insites-cli logsv2` (alias: `l2`) instead.
> - `insites-cli constants` → **not yet available** (under development). See `references/constants/`.
> - `insites-cli cache` → **not yet available** (under development). See `references/caching/`.
> - `insites-cli sessions` → **not yet available** (under development). See `references/sessions/`.
> - `insites-cli assets` → **not yet available** (under development). See `references/assets/`.

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
insites-cli logsv2 dev                          # Watch real-time logs (alias: l2)
insites-cli logsv2 dev --filter type:error      # Filter error logs
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
insites-cli modules pull <name>               # Pull a module from instance
insites-cli modules init <name>               # Initialize a new module
insites-cli modules download <name>             # Download module source
insites-cli modules list dev                    # List installed modules
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
insites-cli data export dev --path=data.json    # Export data
insites-cli data import dev --path=data.json    # Import data
insites-cli data clean dev                      # Clean all data (DANGEROUS)
```

## Linting (insites-cli audit)

**Must run after EVERY file change.**

```bash
insites-cli audit                            # Lint all files
insites-cli audit app/views/pages/           # Lint specific directory
```

### What it checks

- Liquid syntax errors
- Invalid tag/filter usage
- Missing translations
- Broken partial references
- Incorrect file naming
- Deprecated patterns

### Must pass with 0 errors before deployment.

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
insites-cli logsv2 dev

# Terminal 2: Make changes and observe
insites-cli sync dev

# Terminal 3: Test endpoints
curl -i https://your-instance.staging-insites.io/endpoint
```

Check logs when you get 5xx responses.
