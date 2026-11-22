import { z } from "zod";

// ---------- Surfaces ----------

export const SurfaceSchema = z.enum([
  "studio-chat",
  "new-project",
  "migration",
  "edit-existing",
  "lint",
]);
export type Surface = z.infer<typeof SurfaceSchema>;

// ---------- Severity / evidence ----------

export const SeveritySchema = z.enum(["error", "warning", "info"]);
export type Severity = z.infer<typeof SeveritySchema>;

export const EvidenceClassSchema = z.enum([
  "cli-audit",
  "runtime-failure",
  "real-project",
  "skill-only",
]);
export type EvidenceClass = z.infer<typeof EvidenceClassSchema>;

// ---------- Rule frontmatter ----------

export const AppliesToSchema = z.enum([
  "page",
  "partial",
  "layout",
  "command",
  "graphql",
  "schema",
  "policy",
  "form",
  "module",
  "global",
]);
export type AppliesTo = z.infer<typeof AppliesToSchema>;

export const RuleFrontmatterSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/, "id must be kebab-case"),
  code: z.string().regex(/^[A-Z]{3}-[A-Z]{4}-\d{3}$/, "code must be SCOPE-AREA-NNN, for example INS-AUTH-001"),
  applies_to: z.array(AppliesToSchema).min(1),
  severity: SeveritySchema,
  evidence: EvidenceClassSchema,
  evidence_source: z.string().optional(),
  audit_ref: z.string().optional(),
  validator: z.string().optional(),
  related: z.array(z.string()).optional(),
  supersedes: z.array(z.string()).optional(),
  aspirational: z.boolean().optional(),
  preship_action: z.string().optional(),
});
export type RuleFrontmatter = z.infer<typeof RuleFrontmatterSchema>;

export const RuleSchema = RuleFrontmatterSchema.extend({
  body: z.string(),
  file: z.string(),
});
export type Rule = z.infer<typeof RuleSchema>;

// ---------- Decision DSL ----------

export const ConditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.object({ all: z.array(ConditionSchema) }),
    z.object({ any: z.array(ConditionSchema) }),
    z.object({ not: ConditionSchema }),
    z.object({
      signal: z.string(),
      gte: z.number().optional(),
      lte: z.number().optional(),
      equals: z.unknown().optional(),
      contains: z.unknown().optional(),
      matches: z.array(z.string()).optional(),
      value: z.unknown().optional(),
    }),
    z.object({ module_version_gte: z.object({ module: z.string(), version: z.string() }) }),
    z.object({ module_version_lt: z.object({ module: z.string(), version: z.string() }) }),
    z.object({ module_version_in_range: z.object({ module: z.string(), min: z.string(), max: z.string() }) }),
    z.object({ constant_exists: z.string() }),
    z.object({ schema_exists: z.string() }),
  ])
);
export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { signal: string; gte?: number; lte?: number; equals?: unknown; contains?: unknown; matches?: string[]; value?: unknown }
  | { module_version_gte: { module: string; version: string } }
  | { module_version_lt: { module: string; version: string } }
  | { module_version_in_range: { module: string; min: string; max: string } }
  | { constant_exists: string }
  | { schema_exists: string };

export const ReferenceSchema = z.object({
  repo: z.string(),
  path: z.string(),
});
export type Reference = z.infer<typeof ReferenceSchema>;

export const FilePlanFileSchema = z.object({
  template: z.string(),
  path: z.string(),
  params: z.record(z.string(), z.unknown()).optional(),
  source: z.string().optional(),
});
export type FilePlanFile = z.infer<typeof FilePlanFileSchema>;

export const DecisionOutputSchema = z.object({
  scaffold: z.string().optional(),
  files: z.array(FilePlanFileSchema).optional(),
  reference: z.array(ReferenceSchema).optional(),
  recommend: z.string().optional(),
  forbid: z.string().optional(),
  rationale: z.string(),
});
export type DecisionOutput = z.infer<typeof DecisionOutputSchema>;

// Decision kinds have different shapes — module-detection puts module/label/rationale at the
// top level (no `then` wrapper); feature-pattern and scaffold use `then: DecisionOutputSchema`.
// They're modeled as a discriminated union on `kind`.

const ConfidenceSchema = z.enum(["high", "medium", "low"]).default("medium");
const StatusSchema = z.enum(["draft", "active", "deprecated"]).default("active");

export const ModuleDetectionDecisionSchema = z.object({
  id: z.string(),
  kind: z.literal("module-detection"),
  module: z.string(),
  label: z.string(),
  intent_keywords: z.array(z.string()).optional(),
  when: ConditionSchema.optional(),
  rationale: z.string(),
  audit_ref: z.string().optional(),
  status: StatusSchema,
});
export type ModuleDetectionDecision = z.infer<typeof ModuleDetectionDecisionSchema>;

export const FeaturePatternDecisionSchema = z.object({
  id: z.string(),
  kind: z.literal("feature-pattern"),
  intent_keywords: z.array(z.string()).optional(),
  when: ConditionSchema.optional(),
  module_version_required: z.record(z.string(), z.string()).optional(),
  then: DecisionOutputSchema,
  confidence: ConfidenceSchema,
  audit_ref: z.string().optional(),
  status: StatusSchema,
});
export type FeaturePatternDecision = z.infer<typeof FeaturePatternDecisionSchema>;

export const ScaffoldDecisionSchema = z.object({
  id: z.string(),
  kind: z.literal("scaffold"),
  intent_keywords: z.array(z.string()).optional(),
  params: z.record(z.string(), z.string()).optional(),
  when: ConditionSchema.optional(),
  then: DecisionOutputSchema,
  confidence: ConfidenceSchema.optional(),
  audit_ref: z.string().optional(),
  status: StatusSchema,
});
export type ScaffoldDecision = z.infer<typeof ScaffoldDecisionSchema>;

export const DecisionSchema = z.discriminatedUnion("kind", [
  ModuleDetectionDecisionSchema,
  FeaturePatternDecisionSchema,
  ScaffoldDecisionSchema,
]);
export type Decision = z.infer<typeof DecisionSchema>;

/** True when a decision has a `then` block with structured output (feature-pattern or scaffold). */
export function hasThen(d: Decision): d is FeaturePatternDecision | ScaffoldDecision {
  return d.kind === "feature-pattern" || d.kind === "scaffold";
}

/** Get the rationale string from any decision shape. */
export function rationaleOf(d: Decision): string {
  return hasThen(d) ? d.then.rationale : d.rationale;
}

// ---------- Selection input/output ----------

export const InstalledModuleSchema = z.object({
  id: z.string(),
  version: z.string(),
});
export type InstalledModule = z.infer<typeof InstalledModuleSchema>;

export const SelectionInputSchema = z.object({
  surface: SurfaceSchema,
  intent: z.string().optional(),
  projectFiles: z
    .array(z.object({ path: z.string(), size: z.number() }))
    .optional(),
  installedModules: z.array(InstalledModuleSchema).optional(),
  availableConstants: z.array(z.string()).optional(),
  signals: z.record(z.string(), z.unknown()).optional(),
});
export type SelectionInput = z.infer<typeof SelectionInputSchema>;

export type FilePlan = {
  files: FilePlanFile[];
  rationale: string;
  source_decision_id: string;
};

export type SelectionResult = {
  rulesMarkdown: string;
  decisions: Decision[];
  scaffolds: FilePlan[];
  firedRuleIds: string[];
};

// ---------- Validation ----------

export type ValidationViolation = {
  ruleId: string;
  severity: Severity;
  line?: number;
  message: string;
};

export type ValidationResult = {
  violations: ValidationViolation[];
};

export type ValidatorFn = (
  filePath: string,
  content: string
) => Promise<ValidationViolation[]> | ValidationViolation[];
