import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildPublicAgentCityContext,
  isPublicAgentCityPlan,
} from "../lib/asympta-city-plan.ts";
import {
  applyAtlasCityPlan,
  atlasSnapshot,
  createAtlasWorld,
  resolveAtlasApproval,
} from "../lib/atlas-simulation.ts";

const worldSource = await readFile(new URL("../components/asympta-world-live-60hz.tsx", import.meta.url), "utf8");
const webMcpSource = await readFile(new URL("../components/asympta-webmcp-tools.tsx", import.meta.url), "utf8");
const cardCss = await readFile(new URL("../app/asympta-request-cards.css", import.meta.url), "utf8");

const readPlan = {
  access: "READ",
  operation: "inspect_agent",
  targetAgentId: "agent-business",
  workflowId: null,
  actionType: null,
  message: null,
  reason: "Inspect the business agent selected for this simulated enquiry.",
};

const messagePlan = {
  access: "WRITE_REQUEST",
  operation: "send_simulated_message",
  targetAgentId: "agent-logistics",
  workflowId: null,
  actionType: null,
  message: "Record one simulated pickup request.",
  reason: "The user explicitly asked the logistics agent to record a simulated pickup.",
};

test("bounded city context strips coordinates, storage, credentials, and all non-allowlisted fields", () => {
  const context = buildPublicAgentCityContext({
    foreground: {
      phase: "running",
      workflowId: "custom-order",
      pendingApprovals: [{ id: "approval-1", private: "ignore" }],
      localStorage: { token: "must-never-leave-browser" },
      agents: [
        {
          id: "agent-user",
          role: "Personal intent agent",
          status: "moving",
          lon: 139.7,
          lat: 35.6,
          organisation: "You",
          credential: "must-never-leave-browser",
        },
        {
          id: "agent-business",
          role: "Business coordinator",
          status: "working",
          lon: 139.76,
          lat: 35.68,
        },
      ],
    },
  });

  assert.deepEqual(context, {
    phase: "running",
    workflow: "custom-order",
    pendingApprovalCount: 1,
    agents: [
      { id: "agent-user", role: "Personal intent agent", status: "moving" },
      { id: "agent-business", role: "Business coordinator", status: "working" },
    ],
  });
  const serialized = JSON.stringify(context);
  assert.doesNotMatch(serialized, /lon|lat|localStorage|credential|token|organisation/i);
});

test("city plan validator is exact and fail-closed", () => {
  assert.equal(isPublicAgentCityPlan(readPlan), true);
  assert.equal(isPublicAgentCityPlan(messagePlan), true);
  assert.equal(isPublicAgentCityPlan({ ...readPlan, targetAgentId: "unknown" }), false);
  assert.equal(isPublicAgentCityPlan({ ...readPlan, extra: true }), false);
  assert.equal(isPublicAgentCityPlan({ ...readPlan, operation: "send_simulated_message", message: "mutate" }), false);
  assert.equal(isPublicAgentCityPlan({ ...messagePlan, access: "READ" }), false);
  assert.equal(isPublicAgentCityPlan({ ...messagePlan, reason: "token=secret" }), false);
});

test("READ selects evidence without changing world revision or approvals", () => {
  const initial = createAtlasWorld(1_000);
  const revision = initial.revision;
  const next = applyAtlasCityPlan(initial, "request-city-read-0001", readPlan);
  assert.equal(next.revision, revision);
  assert.equal(next.approvals.length, 0);
  assert.equal(next.messages.length, 0);
  assert.equal(next.lastCityPlan.status, "observed");
  assert.equal(next.lastCityPlan.selectedAgentId, "agent-business");
  assert.equal(next.lastCityPlan.worldRevision, revision);
  const snapshot = atlasSnapshot(next);
  assert.equal(snapshot.revision, revision);
  assert.equal(snapshot.lastCityPlan.requestId, "request-city-read-0001");
  assert.equal(snapshot.lastCityPlan.operation, "inspect_agent");
});

test("WRITE REQUEST creates exactly one pending human approval and only writes after approval", () => {
  const initial = createAtlasWorld(2_000);
  const queued = applyAtlasCityPlan(initial, "request-city-write-0001", messagePlan);
  assert.equal(queued.phase, "waiting_approval");
  assert.equal(queued.approvals.filter((approval) => approval.status === "pending").length, 1);
  assert.equal(queued.messages.length, 0);
  assert.equal(queued.workflowId, undefined);
  assert.equal(queued.lastCityPlan.status, "pending_approval");
  assert.equal(queued.lastCityPlan.approvalId, queued.approvals[0].id);
  assert.equal(queued.approvals[0].cityRequestId, "request-city-write-0001");

  const approved = resolveAtlasApproval(queued, queued.approvals[0].id, true);
  assert.equal(approved.approvals[0].status, "approved");
  assert.equal(approved.lastCityPlan.status, "approved");
  assert.equal(approved.messages.length, 1);
  assert.equal(approved.messages[0].fromAgentId, "agent-user");
  assert.equal(approved.messages[0].toAgentId, "agent-logistics");
  assert.equal(approved.messages[0].text, messagePlan.message);
  assert.equal(approved.phase, "idle");
});

test("workflow WRITE REQUEST cannot start before approval and preserves exact read-back evidence", () => {
  const workflowPlan = {
    access: "WRITE_REQUEST",
    operation: "start_simulated_workflow",
    targetAgentId: "agent-user",
    workflowId: "dinner-network",
    actionType: null,
    message: null,
    reason: "Coordinate the simulated dinner network after the person approves.",
  };
  const queued = applyAtlasCityPlan(createAtlasWorld(3_000), "request-city-workflow-0001", workflowPlan);
  assert.equal(queued.workflowId, undefined);
  assert.equal(queued.tasks.length, 0);
  assert.equal(queued.approvals.filter((approval) => approval.status === "pending").length, 1);
  assert.equal(atlasSnapshot(queued).lastCityPlan.status, "pending_approval");

  const approved = resolveAtlasApproval(queued, queued.approvals[0].id, true);
  assert.equal(approved.workflowId, "dinner-network");
  assert.ok(approved.tasks.length > 0);
  assert.ok(approved.agents.some((agent) => agent.status === "moving" || agent.status === "working"));
  assert.equal(atlasSnapshot(approved).lastCityPlan.requestId, "request-city-workflow-0001");
  assert.equal(atlasSnapshot(approved).lastCityPlan.status, "approved");
});

test("duplicate request IDs and declined requests cannot overwrite newer state", () => {
  const queued = applyAtlasCityPlan(createAtlasWorld(4_000), "request-city-duplicate-0001", messagePlan);
  const duplicate = applyAtlasCityPlan(queued, "request-city-duplicate-0001", {
    ...messagePlan,
    message: "This must not replace the first request.",
  });
  assert.equal(duplicate, queued);
  assert.equal(duplicate.approvals.length, 1);
  const declined = resolveAtlasApproval(duplicate, duplicate.approvals[0].id, false);
  assert.equal(declined.messages.length, 0);
  assert.equal(declined.lastCityPlan.status, "declined");
});

test("product card and WebMCP read-back expose formatted JSON from canonical state", () => {
  assert.match(worldSource, /ASYMPTA_CITY_PLAN_EVENT/);
  assert.match(worldSource, /data-webmcp-json-output="true"/);
  assert.match(worldSource, /JSON\.stringify\(value, null, 2\)/);
  assert.match(worldSource, /queuedForHumanApproval/);
  assert.match(worldSource, /snapshot: atlasSnapshot\(worldRef\.current\)/);
  assert.match(webMcpSource, /cityEvidence/);
  assert.match(webMcpSource, /foreground\.lastCityPlan/);
  assert.match(cardCss, /\.asympta-access-json pre/);
  assert.match(cardCss, /ui-monospace/);
});
