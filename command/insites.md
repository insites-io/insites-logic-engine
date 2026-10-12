---
description: Load Insites skill and get contextual guidance for your task
---

Load the Insites platform skill and help with any Insites development task.

## Workflow

### Step 1: Check for --update-skill flag

If $ARGUMENTS contains `--update-skill`:

1. Determine install location by checking which path exists:
   - Claude Code global: `~/.claude/skills/insites/`
   - Claude Code local: `.claude/skills/insites/`
   - OpenCode global: `~/.config/opencode/skills/insites/`
   - OpenCode local: `.opencode/skills/insites/`

2. Run the appropriate install command based on which path was found:
   ```bash
   # For Claude Code global
   curl -fsSL https://raw.githubusercontent.com/insites-io/insites-logic-engine/master/claude-install.sh | bash -s -- --global

   # For Claude Code local
   curl -fsSL https://raw.githubusercontent.com/insites-io/insites-logic-engine/master/claude-install.sh | bash

   # For OpenCode global
   curl -fsSL https://raw.githubusercontent.com/insites-io/insites-logic-engine/master/install.sh | bash -s -- --global

   # For OpenCode local
   curl -fsSL https://raw.githubusercontent.com/insites-io/insites-logic-engine/master/install.sh | bash
   ```

3. Output success message and stop (do not continue to other steps).

### Step 2: Load insites skill

```
skill({ name: 'insites' })
```

### Step 3: Identify task type from user request

Analyze $ARGUMENTS to determine:
- **Resource(s) needed** (Liquid, Graphql, Deployment, Modules, etc.)
- **Task type** (new project setup, feature implementation, debugging, config)

Use decision trees in SKILL.md to select correct compnent.

### Step 4: Read relevant reference files

Based on task type, read from `references/<component>/`:

| Task | Files to Read |
|------|---------------|
| New project | `README.md` + `configuration.md` |
| Implement feature | `README.md` + `api.md` + `patterns.md` |
| Debug/troubleshoot | `gotchas.md` |
| All-in-one (monolithic) | `SKILL.md` |

### Step 5: Execute task

Apply Insites-specific patterns and APIs from references to complete the user's request.

### Step 6: Summarize

```
=== Insites Task Complete ===

Product(s): <products used>
Files referenced: <reference files consulted>

<brief summary of what was done>
```

<user-request>
$ARGUMENTS
</user-request>
