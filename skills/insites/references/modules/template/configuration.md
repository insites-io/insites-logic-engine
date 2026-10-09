# Module Name - Configuration

## Installation

```bash
insites-cli modules install <module-name>
insites-cli deploy staging
```

## Required Constants

| Constant | Description | Example |
|----------|-------------|---------|
| `MODULE_API_KEY` | API key for the module | `sk_test_...` |

Set in the Insites Console or:
```bash
insites-cli constants set staging MODULE_API_KEY "value"
```

## Dependencies

List any modules this module depends on:
- `core` (required)

## Directory Structure

```
modules/<module-name>/
├── public/
│   ├── lib/           # Public functions (callable from app)
│   ├── views/
│   │   └── partials/  # Public partials (renderable from app)
│   └── graphql/       # Public GraphQL files
└── private/
    ├── lib/           # Internal functions
    └── views/
        └── partials/  # Internal partials
```

## See Also

- [README](./README.md)
- [API Reference](./api.md)
- [Gotchas](./gotchas.md)
