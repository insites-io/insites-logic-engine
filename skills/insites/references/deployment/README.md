# Deployment

## Pre-Deployment Checklist

1. Run `insites-cli audit` and clear what it reports (it exits 0 either way, so read the `[Audit] N rules detected issues.` line)
2. Verify all changes work on staging
3. Review any pending migrations

## Deploy

```bash
# Deploy to staging
insites-cli deploy dev

# Deploy to production
insites-cli deploy production
```

## What Happens on Deploy

1. All files in `app/` are synced to the platform
2. Pending migrations are executed in chronological order
3. Schema changes are applied
4. Assets are uploaded to CDN
5. Cache is invalidated

## Development Sync

For live development, use sync mode:

```bash
insites-cli sync dev
```

This watches for file changes and syncs them immediately. Do NOT use in production.

## Environment Setup

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

## CI/CD

Example CI pipeline:

```bash
# 1. Install tools
npm install -g @insites/insites-cli
# 2. Lint
insites-cli audit

# 3. Deploy to staging
insites-cli deploy staging

# 4. Deploy to production
insites-cli deploy production
```

## Deploying Through CloudShell

Insites CloudShell is the remote MCP server (`https://cloudshell.insites.io/mcp`) an AI assistant uses to deploy without the CLI. It signs in as the person, so what it can do follows their Console role. Behaviour below is CloudShell v1.2.2 (19 October 2026).

**Pick the tool by the file, not by habit:**

| File | Tool | Notes |
|---|---|---|
| Text under about 32 KB | `insites_deploy`, `insites_sync_file` | Contents go inline. Over 32 KB the model has to retype every byte and the file arrives cut short |
| Larger `.html`, `.liquid`, `.css`, `.js`, `.graphql` | `insites_request_upload` then `insites_commit_upload` | Size and SHA-256 are checked before deploy |
| `.yml`, `.yaml`, `.json` | `insites_request_upload` then `insites_commit_upload` with `destinationPath` | Needs the path, so a schema file lands where it belongs |
| Images, fonts, PDF | `insites_request_upload` then `insites_upload_asset` | PNG, JPG, SVG, WebP, GIF, ICO, WOFF, WOFF2, TTF, OTF, PDF. Returns the public URL |
| Audio and video, up to 100 MB | `insites_request_upload` then `insites_upload_asset` | MP3, M4A, WAV, OGG, MP4, WebM, MOV. Filed under `app/assets/media/`, so reference them as `{{ 'media/intro.mp4' \| asset_url }}` |

**What CloudShell refuses, with a reason:** paths containing `..`, absolute paths, and file types outside the lists above. `.avi`, `.eot`, archives and data files are refused. Every asset is checked by its bytes, so a file whose contents do not match its extension is refused, and so is an SVG containing a script.

**The selected instance belongs to the session.** `insites_select_instance` sets the default for that Claude session only; another session keeps its own. When several sessions or agents work at once, pass `instance_uuid` on each call, which targets that call only and cannot be moved by anyone else's selection. Every result names the instance it acted on, so check it.

**A refused deploy is recorded as failed**, with the instance's reason, and an upload deploy rolls back only the files it actually wrote. Read `insites_deploy_status`, then `insites_get_logs`.

**GitHub auto-deploy** (watched branch, through the Insites GitHub App) deploys with the instance's own credentials. A failed GitHub deploy is retried after 60 seconds. Changing the watched branch with `insites_github_update_branch` moves branch protection to the new branch.

**Everything CloudShell changes reaches the Console change log**: deploys, file deletes, environment variable changes, record edits, asset writes and rollbacks, each with the changed paths, the source and the person who did it.

Full tool list and examples: https://docs.insites.io/developers-guide/cloudshell-tools-troubleshooting

## Rules

- Always lint before deploying
- Verify on staging before production
- Never sync to production (deploy only)
- Pending migrations run automatically on deploy
- Only sync files inside `app/`
