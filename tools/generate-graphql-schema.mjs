#!/usr/bin/env node
// Regenerates skills/insites/references/graphql/schema/schema.json (the SDL of the Insites
// GraphQL API) and AGENTS.md (a compact index of it) from an introspection result taken on a
// live instance. Writes nothing unless --write is passed; without it, prints what would change.
//
// Usage:
//   node tools/generate-graphql-schema.mjs [--write] <introspection.json> [<introspection.json> ...]
//
// Take the introspection on an instance with a page that runs the standard introspection
// query (graphql-js getIntrospectionQuery with descriptions and inputValueDeprecation) inside
// {% graphql %} and returns {{ r | json }} from a `format: json` page. Pass the result of
// more than one instance to check they agree: the run stops if any two differ.
//
// Three things it does that a plain printSchema would not:
//   - Each defaultValue is printed as the instance wrote it. graphql-js cannot re-serialise a
//     default on a custom scalar (HashObject's {}), so printSchema throws on this schema.
//   - Upstream names in descriptions are rewritten (REWRITES below) and the run stops if any
//     survive, because these files are public Insites documentation.
//   - AGENTS.md is generated, not written by hand. The hand-written index it replaced listed
//     queries and mutations the schema does not have.

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = join(HERE, "..", "skills", "insites", "references", "graphql", "schema");
const args = process.argv.slice(2);
const write = args.includes("--write");
const inputs = args.filter((a) => a !== "--write");
if (inputs.length === 0) {
  console.error("Usage: node tools/generate-graphql-schema.mjs [--write] <introspection.json> [...more]");
  process.exit(2);
}

const REWRITES = [
  [/\bpos-cli\b/g, "insites-cli"],
  [/use the pos-module-oauth modules instead/g, "use an OAuth module instead"],
  [/Use the pos-module-oauth modules/g, "Use an OAuth module"],
  [/\bplatformOS\b/g, "Insites"],
];
const FORBIDDEN = /platform\s?os|pos-cli|pos-module|\bpOS\b/i;
const BUILTIN_SCALARS = new Set(["String", "Int", "Float", "Boolean", "ID"]);
const BUILTIN_DIRECTIVES = new Set(["skip", "include", "deprecated", "specifiedBy", "oneOf"]);

const rewrite = (s) => (s == null ? s : REWRITES.reduce((t, [re, to]) => t.replace(re, to), s));

function load(path) {
  const j = JSON.parse(readFileSync(path, "utf8"));
  const s = j.__schema || (j.data && j.data.__schema);
  if (!s || !Array.isArray(s.types) || !s.queryType) throw new Error(`${path}: not an introspection result`);
  return s;
}

// Block strings, as graphql-js prints them: one line when it fits, otherwise opened and
// closed on their own lines. A """ inside the text is escaped.
function block(text, indent) {
  const t = text.replace(/"""/g, '\\"""');
  if (!t.includes("\n") && t.length <= 70 && !t.endsWith('"') && !t.endsWith("\\")) return `${indent}"""${t}"""\n`;
  return `${indent}"""\n${t.split("\n").map((l) => (l ? indent + l : "")).join("\n")}\n${indent}"""\n`;
}
const desc = (d, indent) => (d ? block(rewrite(d), indent) : "");
const ref = (t) => (t.kind === "NON_NULL" ? ref(t.ofType) + "!" : t.kind === "LIST" ? `[${ref(t.ofType)}]` : t.name);
const dep = (x) => (!x.isDeprecated ? "" : x.deprecationReason && x.deprecationReason !== "No longer supported" ? ` @deprecated(reason: ${JSON.stringify(rewrite(x.deprecationReason))})` : " @deprecated");
const inputValue = (a, indent) => `${desc(a.description, indent)}${indent}${a.name}: ${ref(a.type)}${a.defaultValue != null ? ` = ${a.defaultValue}` : ""}${dep(a)}`;
const argList = (as, indent) => {
  if (!as || as.length === 0) return "";
  if (!as.some((a) => a.description)) return `(${as.map((a) => inputValue(a, "")).join(", ")})`;
  return `(\n${as.map((a) => inputValue(a, indent + "  ")).join("\n\n")}\n${indent})`;
};
const byName = (a, b) => a.name.localeCompare(b.name);
const userTypes = (s) => s.types.filter((t) => !t.name.startsWith("__") && !BUILTIN_SCALARS.has(t.name)).sort(byName);

function sdl(s, header) {
  const out = [header];
  const roots = [["query", s.queryType], ["mutation", s.mutationType], ["subscription", s.subscriptionType]].filter(([, v]) => v);
  out.push(`schema {\n${roots.map(([k, v]) => `  ${k}: ${v.name}`).join("\n")}\n}`);
  for (const d of s.directives.filter((d) => !BUILTIN_DIRECTIVES.has(d.name)).sort(byName))
    out.push(`${desc(d.description, "")}directive @${d.name}${argList(d.args, "")}${d.isRepeatable ? " repeatable" : ""} on ${d.locations.join(" | ")}`);
  for (const t of userTypes(s)) {
    const head = desc(t.description, "");
    if (t.kind === "SCALAR") out.push(`${head}scalar ${t.name}`);
    else if (t.kind === "ENUM") out.push(`${head}enum ${t.name} {\n${t.enumValues.map((v) => `${desc(v.description, "  ")}  ${v.name}${dep(v)}`).join("\n\n")}\n}`);
    else if (t.kind === "UNION") out.push(`${head}union ${t.name} = ${t.possibleTypes.map((p) => p.name).join(" | ")}`);
    else if (t.kind === "INPUT_OBJECT") out.push(`${head}input ${t.name} {\n${t.inputFields.map((f) => inputValue(f, "  ")).join("\n\n")}\n}`);
    else {
      const impl = t.interfaces && t.interfaces.length ? ` implements ${t.interfaces.map((i) => i.name).join(" & ")}` : "";
      const kw = t.kind === "INTERFACE" ? "interface" : "type";
      out.push(`${head}${kw} ${t.name}${impl} {\n${t.fields.map((f) => `${desc(f.description, "  ")}  ${f.name}${argList(f.args, "  ")}: ${ref(f.type)}${dep(f)}`).join("\n\n")}\n}`);
    }
  }
  return out.join("\n\n") + "\n";
}

// AGENTS.md: one line per entry, so grep returns the whole entry.
function index(s, provenance) {
  const types = userTypes(s);
  const kinds = (k) => types.filter((t) => t.kind === k);
  const named = (t) => { while (t.ofType) t = t.ofType; return t.name; };
  const argSig = (as) => (as && as.length ? `(${as.map((a) => a.name + (a.type.kind === "NON_NULL" ? "!" : "")).join(", ")})` : "");
  const op = (f) => `${f.name}${argSig(f.args)}: ${ref(f.type)}${f.isDeprecated ? `  [deprecated: ${rewrite(f.deprecationReason || "")}]` : ""}`;
  const fields = (t) => t.fields.map((f) => f.name).join(", ");
  const root = (name) => s.types.find((t) => t.name === name);
  const q = root(s.queryType.name), m = s.mutationType && root(s.mutationType.name);
  const impls = new Map();
  for (const t of kinds("OBJECT").concat(kinds("INTERFACE"))) for (const i of t.interfaces || []) impls.set(i.name, [...(impls.get(i.name) || []), t.name]);
  const L = [];
  L.push("# GraphQL Schema Index");
  L.push("");
  L.push(`Generated by \`tools/generate-graphql-schema.mjs\` from ${provenance}. Do not edit by hand: regenerate it. The full definitions (descriptions, argument types, defaults, nullability) are in [schema.json](schema.json), which is SDL despite its name.`);
  L.push("");
  L.push(`Counts: ${(q.fields || []).length} queries, ${m ? m.fields.length : 0} mutations, ${kinds("OBJECT").length - 2} object types, ${kinds("INPUT_OBJECT").length} input types, ${kinds("ENUM").length} enums, ${kinds("INTERFACE").length} interfaces, ${kinds("UNION").length} union${kinds("UNION").length === 1 ? "" : "s"}, ${kinds("SCALAR").length} custom scalars. Deprecated operations are included and marked, because the platform keeps them working; prefer the name the deprecation reason gives.`);
  L.push("");
  L.push("How to use it: find the operation or type here, then read its definition in schema.json (`grep -nE '^  <name>[(:]' schema.json` for an operation, `grep -n '^type <Name> ' schema.json` for a type). `!` after an argument means it is required. A name not in this file does not exist on the instance.");
  L.push("", "## QUERY", "", ...q.fields.slice().sort(byName).map(op));
  if (m) L.push("", "## MUTATION", "", ...m.fields.slice().sort(byName).map(op));
  L.push("", "## OBJECTS", "", ...kinds("OBJECT").filter((t) => t !== q && t !== m).map((t) => `${t.name} {${fields(t)}}`));
  L.push("", "## INPUTS", "", ...kinds("INPUT_OBJECT").map((t) => `${t.name} {${t.inputFields.map((f) => f.name + (f.type.kind === "NON_NULL" ? "!" : "")).join(", ")}}`));
  L.push("", "## ENUMS", "", ...kinds("ENUM").map((t) => `${t.name} {${t.enumValues.map((v) => v.name).join(", ")}}`));
  L.push("", "## INTERFACES", "", ...kinds("INTERFACE").map((t) => `${t.name} {${fields(t)}} -> ${(impls.get(t.name) || []).sort().join(", ")}`));
  L.push("", "## UNIONS", "", ...kinds("UNION").map((t) => `${t.name} = ${t.possibleTypes.map((p) => p.name).join(" | ")}`));
  L.push("", "## SCALARS", "", ...kinds("SCALAR").map((t) => `${t.name}${t.description ? ": " + rewrite(t.description).split("\n")[0] : ""}`));
  L.push("");
  return L.join("\n");
}

const schemas = inputs.map(load);
const printed = schemas.map((s) => sdl(s, ""));
for (let i = 1; i < printed.length; i++)
  if (printed[i] !== printed[0]) { console.error(`${inputs[i]} and ${inputs[0]} describe different schemas; refusing to pick one`); process.exit(1); }

const date = new Date().toLocaleDateString("sv-SE"); // the local date, YYYY-MM-DD
const provenance = `the introspection of ${inputs.length === 1 ? "one v6 instance" : `${inputs.length} v6 instances, which agreed,`} on ${date}`;
const schemaOut = sdl(schemas[0], `# The Insites GraphQL schema, as SDL. Generated by tools/generate-graphql-schema.mjs from\n# ${provenance}. Do not edit by hand: regenerate it. Index: AGENTS.md.`);
const indexOut = index(schemas[0], provenance);
for (const [name, text] of [["schema.json", schemaOut], ["AGENTS.md", indexOut]]) {
  const m = text.match(FORBIDDEN);
  if (m) { console.error(`${name}: an upstream name survived the rewrite: "${m[0]}". Add a rule to REWRITES.`); process.exit(1); }
}
const s0 = schemas[0];
const rootCount = (n) => (s0.types.find((t) => t.name === n) || { fields: [] }).fields.length;
console.log(`${userTypes(s0).length} types, ${rootCount(s0.queryType.name)} queries, ${rootCount(s0.mutationType.name)} mutations; schema.json ${schemaOut.length} bytes, AGENTS.md ${indexOut.length} bytes`);
if (write) {
  writeFileSync(join(DIR, "schema.json"), schemaOut);
  writeFileSync(join(DIR, "AGENTS.md"), indexOut);
  console.log(`wrote ${join(DIR, "schema.json")} and AGENTS.md`);
} else console.log("dry run: pass --write to write both files");
