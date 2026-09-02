import {
  compileAsymptaContext as compileBaseAsymptaContext,
  type CompilerOptions,
  type ContextCompilation,
} from "./asympta-context-compiler.ts";
import { evaluatePurchaseFeasibility } from "./asympta-purchase-feasibility.ts";
import { compileSimpleConsumableContext } from "./asympta-simple-consumable.ts";
import { compileSimpleProductContext } from "./asympta-simple-product.ts";

export const MARKETPLACE_CONTEXT_EVENT = "asympta:marketplace-context" as const;
export const MARKETPLACE_EXECUTION_EVENT = "asympta:marketplace-execution" as const;
export const MARKETPLACE_PROFILE_REQUIRED_EVENT = "asympta:marketplace-profile-required" as const;

export type MarketplaceCompilerOptions = CompilerOptions & {
  availableFundsJPY?: number | null;
};

function requiresExactProductDecision(compilation: ContextCompilation) {
  return Boolean(compilation.envelope?.goals.some((goal) => {
    const keys = new Set(goal.facts.map((fact) => fact.key));
    return keys.has("product_catalog_category") && !keys.has("exact_product_id");
  }));
}

function exactProductIssue(compilation: ContextCompilation): ContextCompilation {
  if (!requiresExactProductDecision(compilation)) return compilation;
  return {
    ...compilation,
    supported: false,
    issues: [...compilation.issues, "A verified exact product choice is required before marketplace execution."],
  };
}

export function compileAsymptaContext(
  intention: string,
  options: MarketplaceCompilerOptions = {},
): ContextCompilation {
  const feasibility = evaluatePurchaseFeasibility(intention, options.availableFundsJPY ?? null);
  if (feasibility && !feasibility.canProceed) {
    return {
      supported: false,
      envelope: null,
      issues: [feasibility.reason],
      profileRequirements: { required: [], missing: [], resolvedFromProfile: [] },
    };
  }

  const compiled = compileBaseAsymptaContext(intention, options);
  if (compiled.supported) return compiled;
  const consumable = compileSimpleConsumableContext(intention, options);
  if (consumable) return consumable;
  const product = compileSimpleProductContext(intention, options);
  if (product) return exactProductIssue(product);
  return compiled;
}

export * from "./asympta-context-compiler.ts";
export * from "./asympta-marketplace-profile.ts";
export * from "./asympta-marketplace-task-protocol.ts";
export * from "./asympta-marketplace-workflow.ts";
export * from "./asympta-marketplace-execution.ts";
export * from "./asympta-simple-product.ts";
export * from "./asympta-product-decision.ts";
export * from "./asympta-purchase-feasibility.ts";
export { syncMarketplaceExecution } from "./asympta-marketplace-execution-safe.ts";
