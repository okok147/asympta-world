import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  APPROVAL_ESCALATION_MS,
  BLOCKED_RECOVERY_MS,
  CORE_STALL_ESCALATION_MS,
  decideWorkflowEscalation,
  foregroundProgressSignature,
} from "../lib/asympta-escalation-policy.ts";
import {
  buildJobStages,
  completionLikelihood,
  humanWorkDurationMs,
  rankJobOpportunities,
} from "../lib/asympta-job-mode.ts";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const jobComponent = await readFile(new URL("../components/asympta-job-mode.tsx", import.meta.url), "utf8");
const guardComponent = await readFile(new URL("../components/asympta-escalation-guard.tsx", import.meta.url), "utf8");
const escalationPolicy = await readFile(new URL("../lib/asympta-escalation-policy.ts", import.meta.url), "utf8");

test("Job Mode ranks work from user skills, reward and difficulty", () => {
  const profile = {
    skills: ["AI", "LLM", "evaluation", "research"],
    summary: "I can evaluate model failures and write evidence-backed reports.",
    availability: "flexible",
    minReward: 5000,
  };
  const ranked = rankJobOpportunities(profile);
  assert.equal(ranked[0].id, "ai-evaluation-sprint");
  assert.equal(ranked[0].match, 1);
  assert.ok(ranked[0].negotiatedReward >= 5000);
  assert.ok(ranked[0].completionLikelihood > 0.7);

  const weakProfile = { ...profile, skills: ["painting"], summary: "", minReward: 0 };
  const skilledDuration = humanWorkDurationMs(profile, ranked[0]);
  const weakDuration = humanWorkDurationMs(weakProfile, ranked[0]);
  assert.ok(skilledDuration < weakDuration);
  assert.ok(completionLikelihood(profile, ranked[0]) > completionLikelihood(weakProfile, ranked[0]));
});

test("Job Mode leaves only necessary execution to the human and closes the deal with agents", () => {
  const profile = { skills: ["javascript", "web", "qa", "automation"], summary: "Browser QA", availability: "weekends", minReward: 4000 };
  const best = rankJobOpportunities(profile)[0];
  const { stages } = buildJobStages(profile, best);
  assert.ok(stages.length >= 10);
  assert.ok(stages.some((stage) => stage.id === "scout"));
  assert.ok(stages.some((stage) => stage.id === "enquiry"));
  assert.ok(stages.some((stage) => stage.id === "negotiate"));
  assert.ok(stages.some((stage) => stage.id === "offer"));
  assert.ok(stages.some((stage) => stage.id === "prepare"));
  assert.ok(stages.some((stage) => stage.id === "review"));
  assert.ok(stages.some((stage) => stage.id === "handoff"));
  assert.ok(stages.some((stage) => stage.id === "settle"));
  const humanStages = stages.filter((stage) => stage.humanRequired);
  assert.equal(humanStages.length, 1);
  assert.equal(humanStages[0].id, "human");
});

test("stalled Dinner workflow stays in the same world for higher-agent recovery", () => {
  const snapshot = {
    phase: "running",
    workflow: "Dinner Coordination",
    tasks: [{ id: "dn-plan", status: "working", progress: 0.42 }],
    agents: [{ id: "agent-operations", status: "working", lon: 139.7568, lat: 35.6556, taskId: "dn-plan" }],
    pendingApprovals: [],
  };
  assert.deepEqual(decideWorkflowEscalation(snapshot, CORE_STALL_ESCALATION_MS - 1, false), { kind: "none" });
  assert.deepEqual(decideWorkflowEscalation(snapshot, CORE_STALL_ESCALATION_MS + 1, false), { kind: "none" });
});

test("blocked workflow is preserved instead of recovered by a fresh attempt", () => {
  const blocked = {
    phase: "blocked",
    workflow: "Dinner Coordination",
    tasks: [
      { id: "dn-dispatch", status: "blocked", progress: 0 },
      { id: "dn-deliver", status: "queued", progress: 0 },
    ],
    agents: [{ id: "agent-logistics", status: "waiting", lon: 139.7568, lat: 35.6556, taskId: "dn-dispatch" }],
    pendingApprovals: [],
  };
  assert.deepEqual(decideWorkflowEscalation(blocked, BLOCKED_RECOVERY_MS - 1, false), { kind: "none" });
  assert.deepEqual(decideWorkflowEscalation(blocked, BLOCKED_RECOVERY_MS + 1, false), { kind: "none" });
});

test("senior agent recovers missed Auto Approve but never overrides WebMCP or explicit human authority", () => {
  const workflowApproval = {
    phase: "waiting_approval",
    workflow: "Dinner Coordination",
    tasks: [{ id: "dn-authorize", status: "waiting_approval", progress: 0 }],
    agents: [{ id: "agent-finance", status: "waiting", lon: 139.7666, lat: 35.6868, taskId: "dn-authorize" }],
    pendingApprovals: [{ id: "approval-1", source: "workflow", taskId: "dn-authorize" }],
  };
  assert.deepEqual(decideWorkflowEscalation(workflowApproval, APPROVAL_ESCALATION_MS + 1, true), {
    kind: "approve-missed-auto",
    approvalId: "approval-1",
    code: "auto-approve-recovery",
  });
  assert.deepEqual(decideWorkflowEscalation(workflowApproval, APPROVAL_ESCALATION_MS + 1, false), {
    kind: "remind-human",
    approvalId: "approval-1",
    code: "human-authority-required",
  });

  const webMcpApproval = { ...workflowApproval, pendingApprovals: [{ id: "approval-web", source: "webmcp", taskId: "dn-authorize" }] };
  assert.deepEqual(decideWorkflowEscalation(webMcpApproval, APPROVAL_ESCALATION_MS + 1, true), {
    kind: "remind-human",
    approvalId: "approval-web",
    code: "human-authority-required",
  });
});

test("progress signature observes both task progress and agent movement", () => {
  const base = {
    phase: "running",
    workflow: "Dinner Coordination",
    tasks: [{ id: "dn-deliver", status: "moving", progress: 0 }],
    agents: [{ id: "agent-logistics", status: "moving", lon: 139.75, lat: 35.65, taskId: "dn-deliver" }],
    pendingApprovals: [],
  };
  const moved = { ...base, agents: [{ ...base.agents[0], lon: 139.751 }] };
  const worked = { ...base, tasks: [{ ...base.tasks[0], status: "working", progress: 0.2 }] };
  assert.notEqual(foregroundProgressSignature(base), foregroundProgressSignature(moved));
  assert.notEqual(foregroundProgressSignature(base), foregroundProgressSignature(worked));
});

test("legacy Job Mode and escalation guard remain safe but are not mounted by the intention world", () => {
  assert.match(page, /AsymptaIntentWorld/);
  assert.doesNotMatch(page, /AsymptaJobMode|AsymptaEscalationGuard/);
  assert.match(jobComponent, /PROFILE_KEY = "asympta-world\.job-profile\.v1"/);
  assert.match(jobComponent, /BALANCE_KEY = "asympta-world\.job-balance\.v1"/);
  assert.match(jobComponent, /targetEarned/);
  assert.match(jobComponent, /balanceRef\.current \+= delta/);
  assert.match(jobComponent, /animalSvgMarkup/);
  assert.match(jobComponent, /buildJobStages/);
  assert.match(guardComponent, /decideWorkflowEscalation/);
  assert.match(guardComponent, /api\.approve\(decision\.approvalId, true\)/);
  assert.doesNotMatch(guardComponent, /api\.startWorkflow/);
  assert.doesNotMatch(escalationPolicy, /restart-workflow/);
  assert.doesNotMatch(escalationPolicy, /safe-replay/);
});
