# CLI Configuration Reference

## Overview

The Insites CLI (insites-cli) requires configuration through `.insites` environment files to manage deployments across different environments (development, staging, production).

## Environment Configuration (.insites File)

### File Location and Structure

The `.insites` file is a JSON file in your project root. Generate it using `insites-cli env add`:

```bash
insites-cli env add dev --email dev@example.com --instance-uuid your-uuid
```

This produces a `.insites` file. A private-stack entry made by insites-cli 6.0.0 or later stores the Insites Console sign-in, never the instance key:

```json
{
  "dev": {
    "instance_uuid": "your-instance-uuid",
    "email": "dev@example.com",
    "url": "https://your-instance.staging-insites.io",
    "stack": "private",
    "auth": "workos",
    "console_tier": "production",
    "workos": { "refresh_token": "...", "access_token": "..." }
  }
}
```

A shared-stack entry, and a private-stack entry made before 6.0.0, stores `token` and `key` instead. Move an old private-stack entry onto the Console sign-in with `insites-cli env refresh-token dev`.

For CI, set `INSITES_URL`, `INSITES_EMAIL`, `INSITES_TOKEN`, `INSITES_INSTANCE` and `INSITES_INSTANCE_KEY` (called `INSITES_POS_KEY` before 6.0.0; the old name still works with a warning), and optionally `INSITES_STACK`.

### Required Fields

| Field | Description |
|-------|-------------|
| `instance_uuid` | Unique identifier for the instance (from Insites dashboard) |
| `token` | API authentication token (shared stack, and entries made before 6.0.0) |
| `email` | Account email associated with the instance |
| `url` | Instance URL for deployment |
| `key` | Authentication key (shared stack, and entries made before 6.0.0) |
| `auth`, `console_tier`, `workos` | The Insites Console sign-in on the private stack (6.0.0 and later) |

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

Maintain separate `.insites` files per project:

```bash
insites-cli sync staging --config ./config/.insites
```

## Common Issues

- **Token Expired**: Regenerate in Insites dashboard
- **Invalid URL**: Ensure HTTPS format without trailing slash
- **Credentials Not Found**: Verify `.insites` file exists and is readable

## See Also

- [CLI Commands Reference](./api.md)
- [Deployment Patterns](../deployment/patterns.md)
