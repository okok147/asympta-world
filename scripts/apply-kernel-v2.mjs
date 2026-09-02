import fs from "node:fs";

function patch(path, transform) {
  const before = fs.readFileSync(path, "utf8");
  const after = transform(before);
  if (after === before) throw new Error(`No change applied to ${path}`);
  fs.writeFileSync(path, after);
}

function replaceOrThrow(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`Missing patch anchor: ${label}`);
  return source.replace(needle, replacement);
}

patch("lib/asympta-semantic-kernel.ts", (source) => {
  const needle = 'valueType: typeof requirement.value,';
  const matches = source.split(needle).length - 1;
  if (matches !== 2) throw new Error(`Expected two CanonicalFact valueType sites, found ${matches}`);
  return source.replaceAll(needle, 'valueType: typeof requirement.value as "string" | "number" | "boolean",');
});

patch("lib/asympta-task-kernel-types.ts", (source) => {
  source = replaceOrThrow(
    source,
    'export type AsymptaTaskAnswerValue = string | number | boolean;\n',
    `export type AsymptaTaskAnswerValue = string | number | boolean;\n\nexport type AsymptaDataClass =\n  | "public"\n  | "personal"\n  | "sensitive_personal"\n  | "identity"\n  | "credential"\n  | "financial"\n  | "health";\n\nexport type AsymptaEffectClass =\n  | "read"\n  | "communicate"\n  | "external_commitment"\n  | "money_movement"\n  | "account_mutation"\n  | "shipment"\n  | "publication"\n  | "deletion"\n  | "application"\n  | "scheduling";\n\nexport type AsymptaTaskEffect = {\n  effectClass: AsymptaEffectClass;\n  requiresApproval: boolean;\n  externalWrite: boolean;\n  matchedAction?: string;\n};\n\nexport type AsymptaCanonicalFactStatus = "asserted" | "conflicted";\n\nexport type AsymptaCanonicalFact = {\n  id: string;\n  semantic: string;\n  value: AsymptaTaskAnswerValue;\n  displayValue: string;\n  valueType: "string" | "number" | "boolean";\n  source: AsymptaTaskFactSource;\n  actorId?: string;\n  confidence: number;\n  dataClass: AsymptaDataClass;\n  sensitive: boolean;\n  status: AsymptaCanonicalFactStatus;\n  currency?: string;\n  unit?: string;\n  at: string;\n};\n`,
    "semantic kernel types",
  );
  source = replaceOrThrow(
    source,
    '  required: true;\n  sensitive: boolean;\n',
    '  required: true;\n  dataClass?: AsymptaDataClass;\n  sensitive: boolean;\n',
    "requirement data class",
  );
  source = replaceOrThrow(
    source,
    '  requirements: AsymptaTaskRequirement[];\n  assignments: AsymptaTaskAssignment[];\n',
    '  requirements: AsymptaTaskRequirement[];\n  /** Typed semantic projection derived from resolved requirements and their provenance. */\n  facts?: AsymptaCanonicalFact[];\n  /** Highest material external effect shared by policy, UI, audit, and execution. */\n  effect?: AsymptaTaskEffect;\n  assignments: AsymptaTaskAssignment[];\n',
    "task semantic projection",
  );
  return source;
});

patch("lib/asympta-requirement-contracts.ts", (source) => {
  source = replaceOrThrow(
    source,
    'import { expandAutomaticClarificationFields } from "./asympta-automatic-clarification-options.ts";\n',
    'import { expandAutomaticClarificationFields } from "./asympta-automatic-clarification-options.ts";\nimport { canonicalizeRequirementSemantic } from "./asympta-semantic-kernel.ts";\n',
    "contract semantic import",
  );
  const pattern = /function normalize\(value: string\) \{[\s\S]*?export function requirementSemantic\(value: string\) \{[\s\S]*?\n\}\n\nfunction isAbstractField/;
  if (!pattern.test(source)) throw new Error("Missing contract canonicalizer block");
  return source.replace(pattern, 'export function requirementSemantic(value: string) {\n  return canonicalizeRequirementSemantic(value);\n}\n\nfunction isAbstractField');
});

patch("lib/asympta-task-kernel-core-impl.ts", (source) => {
  source = source.replace('  AsymptaTaskAnswerValue,\n', '');
  source = replaceOrThrow(
    source,
    '} from "./asympta-task-policy.ts";\n',
    `} from "./asympta-task-policy.ts";\nimport {\n  canonicalFactsFromRequirements,\n  canonicalizeRequirementSemantic,\n  classifyDataClass,\n  classifyTaskEffect,\n  dataClassIsSensitive,\n  resolveExplicitRequirementValue,\n  upsertCanonicalFact,\n} from "./asympta-semantic-kernel.ts";\n`,
    "core semantic imports",
  );
  const parserBlock = /function requirementSemantic\(key: string\) \{[\s\S]*?\n\}\n\nfunction event\(/;
  if (!parserBlock.test(source)) throw new Error("Missing core semantic parser block");
  source = source.replace(parserBlock, `function requirementSemantic(key: string) {\n  return canonicalizeRequirementSemantic(key);\n}\n\nfunction sensitiveRequirement(key: string) {\n  return dataClassIsSensitive(classifyDataClass(requirementSemantic(key), key));\n}\n\nfunction consequentialRequirement(key: string) {\n  return /(?:payment|approval|amount|account|identity)/iu.test(requirementSemantic(key));\n}\n\nfunction explicitRequirementValue(intent: string, key: string) {\n  return resolveExplicitRequirementValue(intent, key);\n}\n\nfunction event(`);
  source = replaceOrThrow(
    source,
    '      required: true,\n      sensitive: sensitiveRequirement(field.key),\n',
    '      required: true,\n      dataClass: classifyDataClass(requirementSemantic(field.key), field.sourceField),\n      sensitive: sensitiveRequirement(field.key),\n',
    "compiled data class",
  );
  source = replaceOrThrow(
    source,
    '    requirements,\n    assignments: [],\n',
    '    requirements,\n    facts: canonicalFactsFromRequirements(requirements, at),\n    effect: classifyTaskEffect({ intent: input.rootIntent, actionFamily }),\n    assignments: [],\n',
    "initial semantic projection",
  );
  source = replaceOrThrow(
    source,
    '  requirement.lockedBy = "human";\n  rememberCommand(next, command.commandId);\n',
    '  requirement.lockedBy = "human";\n  next.facts = upsertCanonicalFact(next.facts ?? canonicalFactsFromRequirements(next.requirements, next.updatedAt), requirement, next.updatedAt);\n  rememberCommand(next, command.commandId);\n',
    "human fact registry update",
  );
  source = replaceOrThrow(
    source,
    '      requirement.provenance = {\n        source: operation.source,\n        actorId: patch.agentId,\n        confidence: operation.confidence,\n        at: next.updatedAt,\n      };\n      event(next, "requirement_resolved"',
    '      requirement.provenance = {\n        source: operation.source,\n        actorId: patch.agentId,\n        confidence: operation.confidence,\n        at: next.updatedAt,\n      };\n      next.facts = upsertCanonicalFact(next.facts ?? canonicalFactsFromRequirements(next.requirements, next.updatedAt), requirement, next.updatedAt);\n      event(next, "requirement_resolved"',
    "agent fact registry update",
  );
  source = replaceOrThrow(
    source,
    'export function advanceAsymptaTask(task: AsymptaTaskState) {\n  let current = normalizeLegacyDeadEnd(cloneTask(task));\n',
    'export function advanceAsymptaTask(task: AsymptaTaskState) {\n  let current = normalizeLegacyDeadEnd(cloneTask(task));\n  current.facts ??= canonicalFactsFromRequirements(current.requirements, current.updatedAt);\n  current.effect ??= classifyTaskEffect({ intent: current.rootIntent.raw, actionFamily: current.actionFamily });\n',
    "restored semantic projection",
  );
  return source;
});

patch("tests/universal-benchmark.test.mjs", (source) => {
  source = replaceOrThrow(
    source,
    '  assert.ok(report.failed <= 790, `Kernel attack regressed beyond the measured total failure ceiling: ${report.failed} > 790.`);\n',
    '  assert.equal(report.failed, 0, `Frozen kernel regression suite must stay fully green: ${report.failed} failures.`);\n',
    "freeze old holdout",
  );
  source = replaceOrThrow(
    source,
    '  for (const family of Object.values(report.byFamily)) assert.equal(family.total, 100);\n\n  console.log(`KERNEL_HOLDOUT_V2_REPORT ${JSON.stringify({',
    '  for (const family of Object.values(report.byFamily)) assert.equal(family.total, 100);\n\n  console.log(`KERNEL_HOLDOUT_V2_REPORT ${JSON.stringify({',
    "holdout report anchor",
  );
  const endAnchor = '    byFamily: report.byFamily,\n  })}`);\n});\n';
  const replacement = '    byFamily: report.byFamily,\n  })}`);\n\n  assert.equal(report.failed, 0, `Fresh semantic holdout must be fully green: ${JSON.stringify(report.failures.slice(0, 10), null, 2)}`);\n});\n';
  const last = source.lastIndexOf(endAnchor);
  if (last < 0) throw new Error("Missing holdout assertion anchor");
  return source.slice(0, last) + replacement + source.slice(last + endAnchor.length);
});
