import path from "node:path";
import type { ValidationResult, ValidatorFn } from "./types.js";

const VALIDATORS = new Map<string, ValidatorFn>();

/** Register a validator function under a rule id. */
export function registerValidator(ruleId: string, fn: ValidatorFn): void {
  VALIDATORS.set(ruleId, fn);
}

/** Validate a file against all registered validators that apply to its file kind. */
export async function validate(
  filePath: string,
  content: string
): Promise<ValidationResult> {
  const violations = [];
  for (const fn of VALIDATORS.values()) {
    const result = await fn(filePath, content);
    violations.push(...result);
  }
  return { violations };
}

/** Identify which file kind a path represents (page, partial, command, etc.). */
export function fileKindForPath(filePath: string): string | null {
  const p = filePath.replace(/\\/g, "/");
  if (/\/views\/pages\//.test(p)) return "page";
  if (/\/views\/partials\//.test(p)) return "partial";
  if (/\/views\/layouts\//.test(p)) return "layout";
  if (/\/lib\/commands\//.test(p)) return "command";
  if (/\/authorization_policies\//.test(p)) return "policy";
  if (/\/forms\//.test(p)) return "form";
  if (/\/graphql\//.test(p) || p.endsWith(".graphql")) return "graphql";
  if (/\/schema\//.test(p)) return "schema";
  return null;
}

// ---- Built-in validators (one per rule that has a validator: frontmatter entry) ----

/** R-3 / partials-no-underscore-prefix: filename must not start with underscore. */
registerValidator("partials-no-underscore-prefix", (filePath: string) => {
  if (fileKindForPath(filePath) !== "partial") return [];
  const base = path.basename(filePath);
  if (base.startsWith("_")) {
    return [
      {
        ruleId: "partials-no-underscore-prefix",
        severity: "error" as const,
        message: `Partial filename '${base}' starts with an underscore. Rename without the leading underscore.`,
      },
    ];
  }
  return [];
});

/** R-11 / pipe-vars-through-json-filter: scan parse_json blocks for unfiltered variable interpolation. */
registerValidator("pipe-vars-through-json-filter", (filePath: string, content: string) => {
  const violations = [];
  const blockRe = /\{%\s*parse_json[^%]*%\}([\s\S]*?)\{%\s*endparse_json\s*%\}/g;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(content)) !== null) {
    const blockStart = m.index;
    const blockBody = m[1];
    // Find {{ ... }} interpolations without | json
    const interpRe = /\{\{\s*([^}]+?)\s*\}\}/g;
    let im: RegExpExecArray | null;
    while ((im = interpRe.exec(blockBody)) !== null) {
      const expr = im[1];
      if (!/\|\s*json(\s|$)/.test(expr)) {
        const absoluteIndex = blockStart + (m[0].indexOf(im[0]));
        const line = content.substring(0, absoluteIndex).split("\n").length;
        violations.push({
          ruleId: "pipe-vars-through-json-filter",
          severity: "error" as const,
          line,
          message: `Variable '${expr.trim()}' interpolated into parse_json without '| json' filter. Add '| json' to prevent injection.`,
        });
      }
    }
  }
  return violations;
});

/** R-5 / forms-no-form-tag: flag the {% form %} tag (a convention; the tag is not deprecated).
 *
 * Matches `{% form ... %}` and `{% form %}` and the trim variants `{%- form ... -%}` etc.,
 * but does NOT match other tags whose name happens to start with "form" (e.g. `{% format %}`
 * if that ever exists, or `{% formula %}`). The `\b` boundary ensures the tag name is exactly
 * `form` followed by a non-word character (whitespace or `%`).
 */
registerValidator("forms-no-form-tag", (filePath: string, content: string) => {
  const violations = [];
  // Anchor on the opening of the tag; `\b` after `form` guarantees it's not a longer tag name.
  const openRe = /\{%-?\s*form\b/g;
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(content)) !== null) {
    const line = content.substring(0, m.index).split("\n").length;
    violations.push({
      ruleId: "forms-no-form-tag",
      severity: "error" as const,
      line,
      message: "{% form %} tag detected. By convention use plain HTML <form> with {% render 'authenticity_token' %}.",
    });
  }
  return violations;
});

// ---- API endpoint validators (rules/api-endpoints.md) ----

/** True for a page under a `views/pages/api/` directory. */
export function isApiPage(filePath: string): boolean {
  const p = filePath.replace(/\\/g, "/");
  return fileKindForPath(p) === "page" && /\/views\/pages\/api\//.test(p);
}

/** Split a Liquid file into its YAML front matter and body. Front matter is "" when absent. */
export function splitFrontMatter(content: string): { frontMatter: string; body: string } {
  const m = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(content);
  if (!m) return { frontMatter: "", body: content };
  return { frontMatter: m[1], body: content.slice(m[0].length) };
}

/** Read a scalar front-matter key, unquoted. */
function frontMatterValue(frontMatter: string, key: string): string {
  const m = new RegExp(`^${key}:[ \\t]*(.*)$`, "m").exec(frontMatter);
  return m ? m[1].trim().replace(/^['"]|['"]$/g, "") : "";
}

/** `authorization_policies:` with at least one entry, as a YAML list or an inline array. */
const POLICY_LIST_RE = /^authorization_policies:[ \t]*(?:\r?\n[ \t]*-[ \t]*\S|\[[ \t]*\S)/m;
/** A `{% function %}` call to a partial whose path names a guard or an auth check. */
const GUARD_FUNCTION_RE = /\{%-?\s*function\s+\w+\s*=\s*['"][^'"]*(?:guard|auth)[^'"]*['"]/i;
/** An explicit, reviewable statement that the page is meant to be public. */
const PUBLIC_MARKER_RE = /\{%-?\s*comment\s*-?%\}[\s\S]*?\bpublic endpoint:\s*\S[\s\S]*?\{%-?\s*endcomment\s*-?%\}/i;

/** api-pages-declare-a-guard: every API page is guarded or explicitly declared public. */
registerValidator("api-pages-declare-a-guard", (filePath: string, content: string) => {
  if (!isApiPage(filePath) || content.trim() === "") return [];
  const { frontMatter, body } = splitFrontMatter(content);
  if (frontMatterValue(frontMatter, "method").toLowerCase() === "options") return [];
  if (POLICY_LIST_RE.test(frontMatter)) return [];
  if (GUARD_FUNCTION_RE.test(body)) return [];
  if (PUBLIC_MARKER_RE.test(body)) return [];
  return [
    {
      ruleId: "api-pages-declare-a-guard",
      severity: "warning" as const,
      message:
        "API page has no authorization_policies and calls no guard function, so it is public. " +
        "Add a policy or an inline guard, or, if it is meant to be public, say why in a " +
        "{% comment %}public endpoint: <reason>{% endcomment %} block.",
    },
  ];
});

/** api-slug-no-format-extension: the slug carries no `.json`; use `format: json` instead. */
registerValidator("api-slug-no-format-extension", (filePath: string, content: string) => {
  if (fileKindForPath(filePath) !== "page") return [];
  const { frontMatter } = splitFrontMatter(content);
  const slug = frontMatterValue(frontMatter, "slug") || frontMatterValue(frontMatter, "path");
  if (!/\.json(?:$|[/?])/.test(slug)) return [];
  const line = content.split("\n").findIndex((l) => /^(slug|path):/.test(l)) + 1;
  return [
    {
      ruleId: "api-slug-no-format-extension",
      severity: "warning" as const,
      line: line || undefined,
      message: `Slug '${slug}' includes '.json'. Remove it and set 'format: json' in the front matter.`,
    },
  ];
});

/** Parameter names that carry a credential. `token` alone is excluded: one-time links use it legitimately. */
const CREDENTIAL_NAME = "(?:instance_api_key|api_?key|apikey|access_token|secret|password|passwd)";
const CREDENTIAL_SLUG_RE = new RegExp(`:${CREDENTIAL_NAME}\\b`, "i");
const CREDENTIAL_PARAM_RE = new RegExp(`context\\.params\\.${CREDENTIAL_NAME}\\b`, "gi");

/** api-no-credentials-in-url: no credential in the slug, and no GET page reads one from the query string. */
registerValidator("api-no-credentials-in-url", (filePath: string, content: string) => {
  if (fileKindForPath(filePath) !== "page") return [];
  const { frontMatter } = splitFrontMatter(content);
  const violations = [];
  const slug = frontMatterValue(frontMatter, "slug") || frontMatterValue(frontMatter, "path");
  if (CREDENTIAL_SLUG_RE.test(slug)) {
    violations.push({
      ruleId: "api-no-credentials-in-url",
      severity: "error" as const,
      message: `Slug '${slug}' takes a credential as a URL segment. Send credentials in a header.`,
    });
  }
  const method = frontMatterValue(frontMatter, "method").toLowerCase() || "get";
  if (method === "get") {
    let m: RegExpExecArray | null;
    CREDENTIAL_PARAM_RE.lastIndex = 0;
    while ((m = CREDENTIAL_PARAM_RE.exec(content)) !== null) {
      violations.push({
        ruleId: "api-no-credentials-in-url",
        severity: "error" as const,
        line: content.substring(0, m.index).split("\n").length,
        message: `GET page reads '${m[0]}', which arrives in the query string. Send credentials in a header.`,
      });
    }
  }
  return violations;
});
