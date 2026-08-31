import {
  syncMarketplaceExecution as syncMarketplaceExecutionBase,
  type MarketplaceExecution,
  type MarketplaceWorldSnapshot,
} from "./asympta-marketplace-execution.ts";
import { marketplaceTaskIds } from "./asympta-marketplace-workflow.ts";

function cloneSnapshot(snapshot: MarketplaceWorldSnapshot): MarketplaceWorldSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as MarketplaceWorldSnapshot;
}

/**
 * The marketplace UI and the canonical world intentionally poll at different
 * cadences. A user can therefore decline a courier pay-on-delivery approval in
 * the small window after the canonical handoff/return has completed but before
 * the marketplace projection has observed that handoff.
 *
 * In that race, the legacy projection used to process the final blocked payment
 * first (releasing the still-projected reservation) and then process the already
 * completed handoff (subtracting the reservation again), producing -1 stock.
 *
 * Stage that missed handoff once with the payment still represented as waiting,
 * then apply the real blocked snapshot. This preserves packet ordering and the
 * inventory invariant without weakening the approval boundary.
 */
export function syncMarketplaceExecution(
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

  // A blocked COD attempt occurs after the item has left reserved stock. Make
  // the projection explicit: the payment was declined, the item remains with
  // the courier, and no market reservation was released a second time.
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
