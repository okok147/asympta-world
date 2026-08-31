import {
  createMarketplaceExecution,
  syncMarketplaceExecution as syncMarketplaceExecutionBase,
  type MarketplaceExecution,
  type MarketplaceWorldSnapshot,
} from "./asympta-marketplace-execution.ts";
import { marketplaceTaskIds } from "./asympta-marketplace-workflow.ts";

function cloneSnapshot(snapshot: MarketplaceWorldSnapshot): MarketplaceWorldSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as MarketplaceWorldSnapshot;
}

function isInventoryProjectionError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return /negative or invalid quantity|inventory is not conserved|cargo is inconsistent/i.test(error.message);
}

/**
 * A COD decline can race the marketplace projection: the canonical world may
 * already have completed handoff/return while the slower projection still has
 * the item reserved at the store. If the blocked payment is projected first,
 * the old reducer releases that reservation and then subtracts it again for the
 * already-completed handoff.
 *
 * Stage the missed handoff with payment still waiting, then apply the real
 * blocked snapshot. This preserves the causal order and the inventory invariant.
 */
function syncBlockedMarketplaceExecution(
  current: MarketplaceExecution,
  snapshot: MarketplaceWorldSnapshot,
): MarketplaceExecution {
  if (snapshot.phase !== "blocked" || !snapshot.tasks?.length) {
    return syncMarketplaceExecutionBase(current, snapshot);
  }

  const stagedSnapshot = cloneSnapshot(snapshot);
  const stagedGoalIds = new Set<string>();

  for (const [index, goal] of current.envelope.goals.entries()) {
    const ids = marketplaceTaskIds(goal, index);
    const payment = stagedSnapshot.tasks?.find((task) => task.id === ids.payment);
    const handoff = stagedSnapshot.tasks?.find((task) => task.id === ids.handoff);
    const handoffAlreadyProjected = current.appliedEffects.includes(`${goal.id}:handoff`);

    if (payment?.status !== "blocked" || handoff?.status !== "done" || handoffAlreadyProjected) continue;
    payment.status = "waiting_approval";
    stagedGoalIds.add(goal.id);
  }

  if (stagedGoalIds.size === 0) {
    return syncMarketplaceExecutionBase(current, snapshot);
  }

  stagedSnapshot.phase = "waiting_approval";
  let next = syncMarketplaceExecutionBase(current, stagedSnapshot);
  next = syncMarketplaceExecutionBase(next, snapshot);

  // A declined COD happens after the item left reserved stock. The item remains
  // with the courier until a future return/recovery flow; do not claim a second
  // reservation release.
  for (const goalId of stagedGoalIds) {
    const transaction = next.transactions.find((candidate) => candidate.goalId === goalId);
    if (transaction?.payment === "declined") transaction.status = "blocked";

    const blockedPacket = [...next.packets].reverse().find((packet) => (
      packet.goalId === goalId && packet.kind === "blocked"
    ));
    if (blockedPacket) blockedPacket.payload.inventoryReleased = false;
  }
  next.status = "blocked";
  return next;
}

/**
 * The world state is canonical; MarketplaceExecution is only a projection.
 * Never let a stale projection permanently poison a run. If a browser timing
 * race makes the incremental projection violate the ledger invariant, rebuild
 * that projection from the same canonical snapshot and continue. No approval
 * or world action is invented by this recovery path.
 */
export function syncMarketplaceExecution(
  current: MarketplaceExecution,
  snapshot: MarketplaceWorldSnapshot,
): MarketplaceExecution {
  try {
    return syncBlockedMarketplaceExecution(current, snapshot);
  } catch (error) {
    if (!isInventoryProjectionError(error)) throw error;
    const rebuilt = createMarketplaceExecution(current.envelope);
    return syncBlockedMarketplaceExecution(rebuilt, snapshot);
  }
}
