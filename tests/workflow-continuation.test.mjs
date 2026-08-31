import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ATLAS_WORKFLOWS,
  atlasSnapshot,
  advanceAtlasWorld,
  createAtlasWorld,
  resolveAtlasApproval,
  startAtlasWorkflow,
} from "../lib/atlas-simulation.ts";
import {
  compileAsymptaContext,
  createMarketplaceExecution,
  marketplaceInventoryInvariant,
  marketplaceProfilePreset,
  syncMarketplaceExecution,
  upsertMarketplaceWorkflow,
} from "../lib/asympta-marketplace-intent.ts";

function runUntilDecisionOrTerminal(world, limit = 20_000) {
  let next = world;
  for (let index = 0; index < limit; index += 1) {
    if (["blocked", "completed"].includes(next.phase)) return next;
    const approval = next.approvals.find((candidate) => candidate.status === "pending");
    if (approval) return next;
    next = advanceAtlasWorld(next, 120);
  }
  assert.fail(`Workflow did not reach a decision or terminal state from ${world.phase}.`);
}

function approveToCompletion(workflowId) {
  let world = startAtlasWorkflow(createAtlasWorld(0), workflowId);
  let decisions = 0;
  for (let cycle = 0; cycle < 80 && world.phase !== "completed"; cycle += 1) {
    world = runUntilDecisionOrTerminal(world);
    assert.notEqual(world.phase, "blocked", `${workflowId} entered an unowned blocked state`);
    const approval = world.approvals.find((candidate) => candidate.status === "pending");
    if (!approval) continue;
    decisions += 1;
    world = resolveAtlasApproval(world, approval.id, true);
  }
  assert.equal(world.phase, "completed", `${workflowId} did not complete after explicit decisions`);
  assert.ok(decisions > 0, `${workflowId} should expose at least one human decision`);
}

test("every built-in workflow has an explicit approval route to completion", () => {
  for (const workflow of ATLAS_WORKFLOWS.filter((candidate) => candidate.id !== "marketplace-intent")) {
    approveToCompletion(workflow.id);
  }
});

test("a declined workflow can restart safely and complete", () => {
  let world = runUntilDecisionOrTerminal(startAtlasWorkflow(createAtlasWorld(0), "custom-order"));
  const firstApproval = world.approvals.find((candidate) => candidate.status === "pending");
  assert.ok(firstApproval);
  world = resolveAtlasApproval(world, firstApproval.id, false);
  assert.equal(world.phase, "blocked");

  world = startAtlasWorkflow(world, "custom-order");
  for (let cycle = 0; cycle < 80 && world.phase !== "completed"; cycle += 1) {
    world = runUntilDecisionOrTerminal(world);
    const approval = world.approvals.find((candidate) => candidate.status === "pending");
    if (approval) world = resolveAtlasApproval(world, approval.id, true);
  }
  assert.equal(world.phase, "completed");
});

test("every marketplace fulfilment and payment route reaches delivery after explicit approval", () => {
  const fulfilmentMethods = ["personal_agent_pickup", "courier_delivery"];
  const paymentMethods = ["asympta_wallet", "card_on_file", "pay_on_delivery"];

  for (const fulfilmentMethod of fulfilmentMethods) {
    for (const paymentMethod of paymentMethods) {
      const requestId = `continuation-${fulfilmentMethod}-${paymentMethod}`;
      const profile = {
        ...marketplaceProfilePreset("everyday", 0),
        fulfilmentMethod,
        paymentMethod,
      };
      const compilation = compileAsymptaContext("Buy food", {
        requestId,
        conversationId: requestId,
        locale: "en",
        now: 0,
        profile,
      });
      assert.ok(compilation.envelope, compilation.issues.join(" "));
      upsertMarketplaceWorkflow(compilation.envelope);

      let execution = createMarketplaceExecution(compilation.envelope);
      let world = startAtlasWorkflow(createAtlasWorld(0), "marketplace-intent");
      let decisions = 0;
      for (let index = 0; index < 20_000 && world.phase !== "completed"; index += 1) {
        world = advanceAtlasWorld(world, 120);
        execution = syncMarketplaceExecution(execution, atlasSnapshot(world));
        const approval = world.approvals.find((candidate) => candidate.status === "pending");
        if (approval) {
          decisions += 1;
          world = resolveAtlasApproval(world, approval.id, true);
          execution = syncMarketplaceExecution(execution, atlasSnapshot(world));
        }
        assert.notEqual(world.phase, "blocked", `${fulfilmentMethod}/${paymentMethod} blocked unexpectedly`);
      }

      execution = syncMarketplaceExecution(execution, atlasSnapshot(world));
      const invariant = marketplaceInventoryInvariant(execution);
      assert.equal(world.phase, "completed", `${fulfilmentMethod}/${paymentMethod} did not complete`);
      assert.equal(execution.status, "completed");
      assert.equal(execution.ledger[0].userInventory, 1);
      assert.equal(decisions, 1, "each simulated payment must have exactly one explicit decision");
      assert.equal(invariant.valid, true, invariant.issues.join(" "));
    }
  }
});

test("the browser continuation surface owns local approvals and recovery", async () => {
  const [page, continuation, snapshotSource] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/asympta-workflow-continuation.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/atlas-simulation.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /AsymptaWorkflowContinuation/);
  assert.match(continuation, /candidate\.source !== "webmcp"/);
  assert.match(continuation, /ownsSpecializedMarketplaceCard/);
  assert.match(continuation, /bridge\.approve\(view\.approval\.id, approved\)/);
  assert.match(continuation, /bridge\.startWorkflow\(view\.workflowId\)/);
  assert.match(continuation, /Confirm and continue/);
  assert.match(continuation, /Retry safely/);
  assert.match(continuation, /確認並繼續/);
  assert.match(snapshotSource, /workflowId: world\.workflowId \?\? null/);
  assert.match(snapshotSource, /detail: approval\.detail/);
  assert.match(snapshotSource, /consequence: approval\.consequence/);
});
