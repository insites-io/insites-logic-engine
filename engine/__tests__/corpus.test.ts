import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadDecisions, loadRules, clearCache } from "../src/corpus.js";
import { evaluate } from "../src/runtime.js";

// These tests load the real corpus from the repo's logic-engine/ directory.
// They guard against the regressions identified in PR #1 review:
//   C-1 — DecisionSchema mismatch causing all module-detection decisions to fail Zod parse
//         (would surface as decisions.length being lower than the corpus file count)
//   C-2 — __dirname unavailable in compiled output (would throw at module init)

describe("corpus loader (integration)", () => {
  it("loads rules without parse errors", async () => {
    clearCache();
    const rules = await loadRules();
    expect(rules.length).toBeGreaterThan(0);
    // Each rule has a kebab-case id, severity, evidence class.
    for (const r of rules) {
      expect(r.id).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(["error", "warning", "info"]).toContain(r.severity);
    }
  });

  it("loads decisions of all three kinds without parse errors", async () => {
    clearCache();
    const decisions = await loadDecisions();
    expect(decisions.length).toBeGreaterThan(0);

    const byKind = decisions.reduce<Record<string, number>>(
      (acc, d) => ({ ...acc, [d.kind]: (acc[d.kind] || 0) + 1 }),
      {}
    );

    // All three kinds should be represented. The exact counts depend on the corpus, but
    // none should be zero — that would mean an entire kind silently failed parsing.
    expect(byKind["module-detection"]).toBeGreaterThan(0);
    expect(byKind["feature-pattern"]).toBeGreaterThan(0);
    expect(byKind["scaffold"]).toBeGreaterThan(0);
  });

  it("evaluate() runs end-to-end with a known-matching intent", async () => {
    clearCache();
    const result = await evaluate({
      surface: "studio-chat",
      intent: "auth login flow",
      signals: { has_login_form: true },
    });

    // We get rules markdown back, decisions filtered by the DSL, and (potentially empty) scaffolds.
    expect(typeof result.rulesMarkdown).toBe("string");
    expect(result.rulesMarkdown.length).toBeGreaterThan(0);
    expect(Array.isArray(result.decisions)).toBe(true);
    expect(Array.isArray(result.scaffolds)).toBe(true);
    expect(Array.isArray(result.firedRuleIds)).toBe(true);
  });

  it("evaluate() does not throw on a no-match intent", async () => {
    clearCache();
    const result = await evaluate({
      surface: "studio-chat",
      intent: "nothing matches this xyzzy",
      signals: {},
    });
    expect(result).toBeDefined();
    expect(Array.isArray(result.decisions)).toBe(true);
  });
});

// Rule codes: SCOPE-AREA-NNN (Teamwork 27038895). Every rule has exactly one code, the code is
// well formed, its AREA matches the file, no code is used twice, and index.json agrees.
describe("rule codes", () => {
  const AREAS: Record<string, string> = {
    "api-endpoints.md": "APIS",
    "authorization.md": "AUTH",
    "commands.md": "CMND",
    "forms.md": "FORM",
    "graphql.md": "GRPH",
    "liquid-syntax.md": "LIQD",
    "modules.md": "MODL",
    "pages.md": "PAGE",
    "partials.md": "PART",
    "schema.md": "SCHM",
  };
  const rulesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../logic-engine/rules");

  it("every rule on disk parses and carries a well-formed, unique code in its file's area", async () => {
    clearCache();
    const rules = await loadRules();
    let onDisk = 0;
    for (const f of Object.keys(AREAS)) {
      const text = await fs.readFile(path.join(rulesDir, f), "utf8");
      onDisk += (text.match(/^id: /gm) || []).length;
    }
    // A rule that fails to parse is dropped silently by the loader, so compare with the file count.
    expect(rules.length).toBe(onDisk);
    const seen = new Set<string>();
    for (const r of rules) {
      expect(r.code, r.id).toMatch(/^INS-[A-Z]{4}-\d{3}$/);
      expect(r.code.split("-")[1], `${r.id} in ${r.file}`).toBe(AREAS[r.file]);
      expect(seen.has(r.code), `duplicate code ${r.code}`).toBe(false);
      seen.add(r.code);
    }
  });

  it("index.json lists the same code for every rule", async () => {
    clearCache();
    const rules = await loadRules();
    const index = JSON.parse(await fs.readFile(path.join(rulesDir, "index.json"), "utf8"));
    const byId = new Map(rules.map((r) => [r.id, r.code]));
    expect(index.rules.length).toBe(rules.length);
    for (const entry of index.rules) {
      expect(entry.code, entry.id).toBe(byId.get(entry.id));
    }
  });
});
