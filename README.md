# Insites Logic Engine

Source-controlled rules, decisions, templates, and reference docs that drive AI/LLM tooling for the Insites platform. The repository ships **two complementary deliverables**:

1. **`skills/insites/`** — markdown reference docs consumed as context by Claude Code, OpenCode, Cursor, and any other LLM-aware editor that loads skills.
2. **`engine/` + `logic-engine/`** — a TypeScript npm package (`@insites/logic-engine`) that loads the rule/decision corpus at runtime, used by Insites Studio, MCP servers, and IDE plugins for deterministic checks.

Both consume the same audit-grounded rules so the guidance LLMs receive matches what programmatic tooling enforces.

## Install the Insites skill

### For Claude Code

```bash
# Local (current project only)
curl -fsSL https://raw.githubusercontent.com/insites-io/insites-logic-engine/main/claude-install.sh | bash

# Global (available in all projects)
curl -fsSL https://raw.githubusercontent.com/insites-io/insites-logic-engine/main/claude-install.sh | bash -s -- --global
```

### For OpenCode

```bash
# Local
curl -fsSL https://raw.githubusercontent.com/insites-io/insites-logic-engine/main/install.sh | bash

# Global
curl -fsSL https://raw.githubusercontent.com/insites-io/insites-logic-engine/main/install.sh | bash -s -- --global
```

## Install example skills

Example skills: `code-review`, `insites-auth`, `insites-debugging`, `insites-sync`, `insites-unit-tests` and `project-init`.

```bash
# Claude Code (local / global)
curl -fsSL https://raw.githubusercontent.com/insites-io/insites-logic-engine/main/install-examples.sh | bash -s -- --claude
curl -fsSL https://raw.githubusercontent.com/insites-io/insites-logic-engine/main/install-examples.sh | bash -s -- --claude --global

# OpenCode (local / global)
curl -fsSL https://raw.githubusercontent.com/insites-io/insites-logic-engine/main/install-examples.sh | bash -s -- --opencode
curl -fsSL https://raw.githubusercontent.com/insites-io/insites-logic-engine/main/install-examples.sh | bash -s -- --opencode --global
```

## Usage

Once installed, the skill appears in your editor's available skills and loads automatically when working on Insites tasks. You can also invoke it explicitly:

```
/insites initialize new project directory structure
```

To update the installed skill to the latest version:

```
/insites --update-skill
```

## Repository layout

```
.
├── README.md                  this file
├── LICENSE                    MIT
├── CHANGELOG.md
├── install.sh                 installer for OpenCode
├── claude-install.sh          installer for Claude Code
├── install-examples.sh        installs example skills
├── command/                   slash-command definition (/insites)
├── skills/insites/            the skill consumed by LLMs
│   ├── SKILL.md               main manifest + decision trees
│   └── references/            domain reference docs (per category)
├── skills_examples/           optional secondary skills
├── engine/                    TypeScript npm package: @insites/logic-engine
└── logic-engine/              the rule/decision/template corpus
```

### `skills/insites/`

The skill is organised by **domain category**, not by source-file directory. Each category lives at `skills/insites/references/<category>/` and ships the same six-file shape:

```
references/<category>/
├── README.md          overview, when to use
├── api.md             tags, filters, GraphQL operations relevant to the category
├── configuration.md   YAML / front-matter / install-time settings
├── patterns.md        worked examples
├── gotchas.md         pitfalls, error conditions, quirks
└── advanced.md        edge cases, optimisation, multi-step flows
```

Categories currently covered (see `SKILL.md` for the full index):

- **Views & Routing** — `pages/`, `partials/`, `layouts/`, `routing/`
- **Data & Storage** — `schema/`, `graphql/`, `migrations/`
- **Business Logic** — `forms/` (state changes via `callback_actions`), `background-jobs/`
- **Liquid Templating** — `liquid/{tags,filters,objects,types,variables,flow-control,loops}/`
- **Authentication & Security** — `authentication/`, `forms/`
- **Notifications** — `emails-sms/`, `flash-messages/`
- **Modules** — `modules/{crm,cms,data,template}/` plus a project-level [`project-structure.md`](skills/insites/references/project-structure.md)
- **Configuration & Infrastructure** — `constants/`, `configuration/`, `assets/`, `sessions/`, `caching/`
- **External Integrations** — `api-calls/` (outbound HTTP), `api-endpoints/` (inbound JSON), `crm-controllers/`, `user-profile-types/`, `payments/`
- **Developer Tools** — `cli/`, `deployment/`

### `engine/` — `@insites/logic-engine` npm package

A TypeScript library that loads and evaluates the corpus. Source under `engine/src/`:

| File | Role |
|---|---|
| `corpus.ts` | Loads `logic-engine/` (rules, decisions, templates) into memory |
| `dsl.ts` | Parses the JSON `when`/`then` decision DSL |
| `runtime.ts` | Evaluates decisions against a project's tree |
| `validators.ts` | Zod schemas for the corpus (discriminated unions for decision kinds) |
| `render.ts` | Renders Eta templates from scaffold decisions |
| `cli.ts` | `npx insites-logic-engine` entry point |
| `mcp-server.ts` | MCP-server entry — exposes the engine to MCP-aware clients |
| `index.ts` | Public exports for npm consumers |

Build, test, lint:

```bash
cd engine
npm install
npm run build
npm test          # vitest run
npm run lint      # biome check
```

The `prepack` script copies `logic-engine/` into the package before publishing so the npm bundle ships with the corpus baked in.

### `logic-engine/` — the corpus

| Subdirectory | Contents |
|---|---|
| `rules/` | Markdown constraint files (pages, partials, graphql, schema, authorization, forms, modules, liquid-syntax, commands) plus `index.json` registry. Loaded into LLM prompts. |
| `decisions/` | JSON `when`/`then` DSL files in three categories: `module-detection/`, `feature-pattern/`, `scaffold/`. Code-evaluated. |
| `templates/` | Eta file skeletons rendered into projects by scaffold decisions. |
| `audit/` | Cross-repo grounding evidence for v0 corpus rules (R-1 through R-25). The audit drives the `skills/insites/` rewrite cadence. |

## Versioning & releases

Releases are cut on a `release/vX.Y.Z` branch and merged to `master` through a pull request; merging is the release, because the installers fetch the default branch. Each release is tagged `vX.Y.Z` on `master` and listed in `CHANGELOG.md`.

Latest: **v2.0.0** (9 October 2026). The skill now describes the v6 Insites modules and the 2026 platform releases as they are: the controller alias inventory is regenerated from the v6 module source (404 controller aliases), every module has a six-page reference, `insites_core` is `insites_crm` throughout, the twelve 2026 platform releases are folded into the Liquid, GraphQL, API, asset, page, configuration and deployment references with a dated digest, and no upstream vendor name remains anywhere in the skill. See `CHANGELOG.md` for the full list.

## License

MIT — see [LICENSE](LICENSE).
