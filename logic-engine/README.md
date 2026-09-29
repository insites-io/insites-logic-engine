# Insites Logic Engine

Versioned, source-controlled rules + decisions + templates + validators that power the Insites Logic Engine. Consumed by `insites-studio`, the `@insites/logic-engine-mcp` MCP server, the `npx @insites/logic-engine` CLI, and any tool that imports the npm package.

## Layout

```
logic-engine/
├── README.md                          this file
├── audit/                             grounding for v0 corpus (cross-repo evidence per rule)
│   ├── v0-conflicts.md                executive summary + 25-rule table + meta-findings
│   ├── v0-conflicts-batch1.md         R-1 to R-8 entries
│   ├── v0-conflicts-batch2.md         R-9 to R-16 entries
│   ├── v0-conflicts-batch3.md         R-17 to R-25 entries
│   └── api-endpoints-2026-09.md       census behind rules/api-endpoints.md
├── rules/                             markdown constraint corpus (loaded into LLM prompts)
│   ├── index.json                     registry: id → file path + frontmatter
│   ├── pages.md
│   ├── partials.md
│   ├── commands.md
│   ├── graphql.md
│   ├── schema.md
│   ├── authorization.md
│   ├── api-endpoints.md
│   ├── forms.md
│   ├── modules.md
│   └── liquid-syntax.md
├── decisions/                         JSON DSL files (when/then) — code-evaluated
│   ├── module-detection/              12 module-detection rules
│   ├── feature-pattern/               6 feature-pattern rules
│   └── scaffold/                      6 scaffold rules
├── templates/                         Eta file skeletons rendered into projects
│   ├── command.eta
│   ├── page.eta
│   ├── partial.eta
│   ├── schema.eta
│   ├── graphql-crud.eta
│   └── auth-policy.eta
└── validators/                        per-rule validation logic (pure TS functions)
    ├── pages.ts
    ├── partials.ts
    ├── commands.ts
    └── ...
```

## Authoring

See `audit/v0-conflicts.md` for the v0 grounding work. New rules must follow the same evidence pattern: cite real-repo file:line, classify evidence (`cli-audit` / `runtime-failure` / `real-project` / `skill-only`), set severity that matches the evidence tier.

## Consumed by

- `engine/` — the TS library that interprets this content. Published as `@insites/logic-engine` to npm.
- `insites-studio` — imports the engine npm package.
- Any IDE via the MCP server (`@insites/logic-engine-mcp`).
- Anyone via the CLI (`npx @insites/logic-engine ...`).
