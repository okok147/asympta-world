import assert from "node:assert/strict";
import test from "node:test";

import {
  ATLAS_AGENTS,
  ATLAS_WORKFLOWS,
  advanceAtlasWorld,
  createAtlasWorld,
} from "../lib/atlas-simulation.ts";
import { startAtlasDemoWorkflow } from "../lib/atlas-demo.ts";
import { workflowTaskExchange } from "../lib/atlas-workflow-expansion.ts";
import { estimateWorkflowRemainingMs } from "../lib/atlas-workflow-time.ts";

function timingSnapshot(world) {
  return {
    tasks: world.tasks.map((task) => ({
      id: task.id,
      agentId: task.agentId,
      status: task.status,
      progress: task.progress,
      approvalStatus: task.approvalStatus ?? null,
    })),
    agents: world.agents.map((agent) => ({
      id: agent.id,
      lon: agent.position.lon,
      lat: agent.position.lat,
    })),
  };
}

test("foreground workflows model deep multi-stakeholder economic coordination", () => {
  const sideByAgent = new Map(ATLAS_AGENTS.map((agent) => [agent.id, agent.side]));
  const expectedSides = new Set(ATLAS_AGENTS.map((agent) => agent.side));

  for (const workflow of ATLAS_WORKFLOWS) {
    assert.ok(workflow.tasks.length >= 18, `${workflow.id} should expose at least 18 coordinated subtasks`);

    const taskIds = new Set(workflow.tasks.map((task) => task.id));
    const sides = new Set(workflow.tasks.map((task) => sideByAgent.get(task.agentId)));
    assert.deepEqual(sides, expectedSides, `${workflow.id} should involve every stakeholder side`);

    for (const task of workflow.tasks) {
      for (const dependency of task.dependsOn) {
        assert.ok(taskIds.has(dependency), `${workflow.id}:${task.id} has missing dependency ${dependency}`);
      }
      const exchange = workflowTaskExchange(task.id);
      assert.ok(exchange, `${workflow.id}:${task.id} should publish an exchange packet`);
      assert.ok(exchange.handoff.length > 10, `${workflow.id}:${task.id} should describe the information handoff`);
      assert.ok(Object.keys(exchange.resourceDelta).length > 0, `${workflow.id}:${task.id} should model resource effects`);
    }
  }
});

test("live remaining ETA is recalculated from subtask completion and travel state", () => {
  let world = startAtlasDemoWorkflow(createAtlasWorld(0), "custom-order");
  const initial = estimateWorkflowRemainingMs("custom-order", timingSnapshot(world));
  assert.ok(initial > 0);

  let completed = 0;
  for (let index = 0; index < 2_000; index += 1) {
    world = advanceAtlasWorld(world, 120);
    completed = world.tasks.filter((task) => task.status === "done").length;
    if (completed > 0) break;
  }

  assert.ok(completed > 0, "at least one small task should finish during the calibration window");
  const afterCompletion = estimateWorkflowRemainingMs("custom-order", timingSnapshot(world));
  assert.ok(afterCompletion < initial, `remaining ETA should fall after completed work (${initial} -> ${afterCompletion})`);
});
