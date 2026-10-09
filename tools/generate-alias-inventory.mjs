#!/usr/bin/env node
// Regenerates skills/insites/references/building-on-insites/reference/alias-inventory.md
// from module source, per that file's own footer ("regenerate rather than trusting a
// copied figure"). Reads the given module repos; writes nothing unless --write is passed.
//
// Usage:
//   node tools/generate-alias-inventory.mjs [--write] <module-repo-dir> [...more]
//   node tools/generate-alias-inventory.mjs --write ~/Desktop/Projects/iia-v6/module-v6-*
//
// Point it at a checkout of the tree you mean to describe (a `git worktree add --detach
// <dir> origin/master` of each module is the clean way). The version column is the newest
// git tag reachable from that checkout; the hook_module_info version is reported beside it
// when the two disagree, because release tooling does not bump the hook.

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "skills", "insites", "references", "building-on-insites", "reference", "alias-inventory.md");

const args = process.argv.slice(2);
const write = args.includes("--write");
const repos = args.filter((a) => a !== "--write");
if (repos.length === 0) {
  console.error("Usage: node tools/generate-alias-inventory.mjs [--write] <module-repo-dir> [...more]");
  process.exit(2);
}

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name === "node_modules" || name === ".git") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else if (name.endsWith(".liquid")) yield full;
  }
}

// A callable alias is a partial declaring `path:` in its front matter.
function aliasOf(file) {
  const src = readFileSync(file, "utf8");
  if (!src.startsWith("---")) return null;
  const end = src.indexOf("---", 3);
  if (end === -1) return null;
  const fm = src.slice(3, end);
  const m = fm.match(/^\s*path:\s*(\S+)\s*$/m);
  return m ? m[1] : null;
}

// A controller alias is the short form every module publishes (`crm/controller/...`,
// `events/venues/list`, `databases/controller/...`) or the long form some v6 modules
// use for their own controllers (`modules/<module>/controllers/...`). Everything else
// declared with `path:` under `modules/<module>/` is an internal helper: a function,
// a GraphQL wrapper, a schema partial or API doc data. It is callable, but it is the
// module's own plumbing with no published contract.
function isController(alias) {
  return !alias.startsWith("modules/") || /\/controllers?\//.test(alias);
}

function gitTag(repo) {
  try {
    return execFileSync("git", ["-C", repo, "describe", "--tags", "--abbrev=0"], { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

function hookVersion(repo) {
  for (const f of walk(repo)) {
    if (f.endsWith("hook_module_info.liquid")) {
      const m = readFileSync(f, "utf8").match(/"version":\s*"([^"]+)"/);
      if (m) return `v${m[1]}`;
    }
  }
  return null;
}

const perModule = new Map(); // repoName -> { version, hook, controllers: [], internal: [] }
for (const repo of repos) {
  const name = basename(repo).replace(/^module-v5-core$/, "module-crm").replace(/^module-v5-/, "module-");
  const controllers = [];
  const internal = [];
  for (const f of walk(repo)) {
    if (!f.includes("/views/partials/")) continue;
    const alias = aliasOf(f);
    if (!alias) continue;
    (isController(alias) ? controllers : internal).push(alias);
  }
  controllers.sort();
  internal.sort();
  const tag = gitTag(repo);
  const hook = hookVersion(repo);
  perModule.set(name, { version: tag ?? hook ?? "unknown", hook, controllers, internal });
}

const withAliases = [...perModule.entries()].filter(([, v]) => v.controllers.length > 0).sort((a, b) => b[1].controllers.length - a[1].controllers.length);
const without = [...perModule.entries()].filter(([, v]) => v.controllers.length === 0).map(([k]) => k);
const total = withAliases.reduce((n, [, v]) => n + v.controllers.length, 0);
const internalTotal = [...perModule.values()].reduce((n, v) => n + v.internal.length, 0);
const lagging = [...perModule.entries()].filter(([, v]) => v.hook && v.hook !== v.version);
const shortOnly = withAliases.filter(([, v]) => v.controllers.every((a) => !a.startsWith("modules/")));
const longForm = withAliases.filter(([, v]) => v.controllers.some((a) => a.startsWith("modules/")));
const noWord = withAliases.filter(([, v]) => v.controllers.some((a) => !/controller/.test(a)));
const names = (list) => list.map(([k]) => `\`${k}\``).join(", ").replace(/, ([^,]*)$/, " and $1");
const verb = (list, s, p) => (list.length === 1 ? s : p);

let md = `# Alias inventory

Every controller alias on an instance with these modules installed, generated from
module source. **Check a name here before you call it.** An alias that does not exist
fails at render time with a partial-not-found error, and inventing plausible names is
the most common way a build is wasted.

**${total} controller aliases** across ${withAliases.length} modules${internalTotal ? `, plus ${internalTotal} internal aliases listed at the end` : ""}.

| Module | Controller aliases | Internal aliases | Version |
|---|---|---|---|
${withAliases.map(([k, v]) => `| \`${k}\` | ${v.controllers.length} | ${v.internal.length} | ${v.version} |`).join("\n")}
`;

if (lagging.length) {
  md += `
The version is the module's newest git tag. Release tooling does not bump the
\`hook_module_info\` partial, so the version a running instance reports can lag: ${lagging
    .map(([k, v]) => `\`${k}\` says ${v.hook} at ${v.version}`)
    .join(", ")}. Read the tag or the Console changelog for "which version"; use the hook only for "is it installed".
`;
}

if (without.length) {
  md += `\nModules that declare **no** controller aliases, so there is nothing to call in them:\n\n${without.map((m) => `\`${m}\``).join(", ")}\n`;
}

md += `
## Naming is not uniform

Three shapes exist, so do not filter on one of them:

- The short form, \`<module>/controller/<resource>/<verb>\`, is what most modules publish${shortOnly.length ? ` (${names(shortOnly)} ${verb(shortOnly, "uses", "use")} nothing else)` : ""}.
- ${noWord.length ? `${names(noWord)} ${verb(noWord, "publishes", "publish")} short aliases **without** the word \`controller\`, such as \`events/venues/list\`, so a search for \`controller\` undercounts them.` : "Every short alias contains the word `controller`."}
- ${longForm.length ? `${names(longForm)} also ${verb(longForm, "declares", "declare")} long-form controllers under \`modules/<module>/controllers/...\`. Those are controllers too, and they are listed below with the short ones.` : "No module uses a long-form controller alias."}

Internal aliases (\`modules/<module>/functions/...\`, \`graphql/...\`, \`schema/...\`,
\`insites_api/...\`) are the module's own helpers. They answer a \`{% function %}\` call, but
they carry no published contract, their arguments change between releases, and some of
them write. Build on the controllers.
`;

for (const [k, v] of withAliases) {
  md += `\n## ${k} (${v.controllers.length})\n\n${v.controllers.map((a) => `- \`${a}\``).join("\n")}\n`;
}

if (internalTotal) {
  md += `\n## Internal aliases (${internalTotal})\n\nCallable, undocumented, not a contract. Listed so a name you meet in module source can be placed.\n`;
  for (const [k, v] of [...perModule.entries()].filter(([, v]) => v.internal.length > 0).sort((a, b) => b[1].internal.length - a[1].internal.length)) {
    md += `\n### ${k} (${v.internal.length})\n\n${v.internal.map((a) => `- \`${a}\``).join("\n")}\n`;
  }
}

md += `
---

Generated from module source by tools/generate-alias-inventory.mjs. Counts are per
scanned module version, so they move between releases: regenerate rather than trusting
a copied figure.
`;

if (write) {
  writeFileSync(OUT, md);
  console.log(`wrote ${OUT}: ${total} controller aliases across ${withAliases.length} modules, ${internalTotal} internal`);
} else {
  for (const [k, v] of withAliases) console.log(`${k} ${v.version}${v.hook && v.hook !== v.version ? ` (hook ${v.hook})` : ""}: ${v.controllers.length} controllers, ${v.internal.length} internal`);
  console.log(`total: ${total} controllers, ${internalTotal} internal — run with --write to update alias-inventory.md`);
}
