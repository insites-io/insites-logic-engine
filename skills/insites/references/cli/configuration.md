# CLI Configuration Reference

## Overview

The Insites CLI (insites-cli) requires configuration through `.insites` environment files to manage deployments across different environments (development, staging, production).

## Environment Configuration (.insites File)

### File Location and Structure

The `.insites` file is a JSON file in your project root. Generate it using `insites-cli env add`:

```bash
insites-cli env add dev --email dev@example.com --instance-uuid your-uuid
```

This produces a `.insites` file like:

```json
{
  "dev": {
    "instance_uuid": "your-instance-uuid",
    "token": "your-token",
    "email": "dev@example.com",
    "url": "https://your-instance.staging-insites.io",
    "key": "your-key"
  }
}
```

### Required Fields

| Field | Description |
|-------|-------------|
| `instance_uuid` | Unique identifier for the instance (from Insites dashboard) |
| `token` | API authentication token |
| `email` | Account email associated with the instance |
| `url` | Instance URL for deployment |
| `key` | Authentication key |

### Security Best Practices

- Never commit `.insites` file to version control
- Use environment variables for sensitive data
- Rotate tokens regularly
- Restrict token permissions to necessary scopes

## CLI Installation

Install Insites CLI via npm:

```bash
npm install -g /insites-cli
```

Verify installation:

```bash
insites-cli --version
```

## Configuration Verification

Test your configuration:

```bash
insites-cli env list
insites-cli env current
```

## Environment Selection

Specify environment for commands:

```bash
insites-cli deploy production
insites-cli sync staging
```

Default environment is typically `development`.

## Advanced Configuration

### Custom Configuration Paths

Set custom `.insites` file location:

```bash
insites-cli deploy development --config /path/to/.insites
```

### Multiple Projects

Maintain separate `.insites` files per project. The CLI has no `--config` option; point it at another file with `CONFIG_FILE_PATH`:

```bash
CONFIG_FILE_PATH=./config/.insites insites-cli sync staging
```

## Common Issues

- **Token Expired**: Regenerate in Insites dashboard
- **Invalid URL**: Ensure HTTPS format without trailing slash
- **Credentials Not Found**: Verify `.insites` file exists and is readable

## See Also

- [CLI Commands Reference](./api.md)
- [Deployment Patterns](../deployment/patterns.md)
