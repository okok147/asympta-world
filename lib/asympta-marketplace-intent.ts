import {
  compileAsymptaContext as compileBaseAsymptaContext,
  type CompilerOptions,
  type ContextCompilation,
} from "./asympta-context-compiler.ts";
import { compileDurableProductContext } from "./asympta-durable-product.ts";
import { compileSimpleConsumableContext } from "./asympta-simple-consumable.ts";
import { compileSimpleProductContext } from "./asympta-simple-product.ts";

export const MARKETPLACE_CONTEXT_EVENT = "asympta:marketplace-context" as const;
export const MARKETPLACE_EXECUTION_EVENT = "asympta:marketplace-execution" as const;
export const MARKETPLACE_PROFILE_REQUIRED_EVENT = "asympta:marketplace-profile-required" as const;

export function compileAsymptaContext(
  intention: string,
  options: CompilerOptions = {},
): ContextCompilation {
  const compiled = compileBaseAsymptaContext(intention, options);
  if (compiled.supported) return compiled;
  return compileSimpleConsumableContext(intention, options)
    ?? compileDurableProductContext(intention, options)
    ?? compileSimpleProductContext(intention, options)
    ?? compiled;
}

export * from "./asympta-context-compiler.ts";
export * from "./asympta-durable-product.ts";
export * from "./asympta-marketplace-profile.ts";
export * from "./asympta-marketplace-task-protocol.ts";
export * from "./asympta-marketplace-workflow-routing.ts";
export * from "./asympta-marketplace-execution.ts";
export * from "./asympta-simple-product.ts";
export { syncMarketplaceExecution } from "./asympta-marketplace-execution-safe.ts";
