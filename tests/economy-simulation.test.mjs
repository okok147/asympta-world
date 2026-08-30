import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  jobAccruedExpense,
  jobProjectedEconomy,
  workflowAccruedEconomy,
  workflowTaskAccruedEconomy,
  workflowTaskCostPlan,
} from "../lib/asympta-economy.ts";
import { buildJobStages, rankJobOpportunities } from "../lib/asympta-job-mode.ts";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const jobMode = await readFile(new URL("../components/asympta-job-mode.tsx", import.meta.url), "utf8");
const workflowEconomy = await readFile(new URL("../components/asympta-workflow-economy.tsx", import.meta.url), "utf8");
const ultraCalm = await readFile(new URL("../components/asympta-ultra-calm.tsx", import.meta.url), "utf8");

test("Dinner costs reflect ingredients, kitchen work and delivery rather than one flat fee", () => {
  const ingredients = workflowTaskCostPlan({ id: "dn-supplier", title: "Verify ingredient supply", agentSide: "supplier" });
  const kitchen = workflowTaskCostPlan({ id: "dn-prepare", title: "Prepare dinner", agentSide: "business" });
  const courier = workflowTaskCostPlan({ id: "dn-deliver", title: "Complete dinner delivery", agentSide: "logistics" });

  assert.ok(ingredients.breakdown.materials >= 600);
  assert.ok(kitchen.breakdown.materials >= 600);
  assert.ok(courier.breakdown.logistics >= 250);
  assert.ok(courier.breakdown.travel > ingredients.breakdown.travel);
  assert.notEqual(ingredients.total, courier.total);
});

test("workflow task expense accrues continuously by the real process phase", () => {
  const base = { id: "dn-deliver", title: "Complete dinner delivery", agentSide: "logistics", progress: 0 };
  const movingEarly = workflowTaskAccruedEconomy({ ...base, status: "moving", travelProgress: 0.2 });
  const movingLate = workflowTaskAccruedEconomy({ ...base, status: "moving", travelProgress: 0.8 });
  const workingHalf = workflowTaskAccruedEconomy({ ...base, status: "working", travelProgress: 1, progress: 0.5 });
  const done = workflowTaskAccruedEconomy({ ...base, status: "done", travelProgress: 1, progress: 1 });

  assert.ok(movingEarly.accrued > 0);
  assert.ok(movingLate.accrued > movingEarly.accrued);
  assert.ok(workingHalf.accrued > movingLate.accrued);
  assert.equal(done.accrued, done.projected);
});

test("whole workflow accrued cost is the sum of real-time task economics", () => {
  const economy = workflowAccruedEconomy([
    { id: "dn-supplier", title: "Verify ingredient supply", agentSide: "supplier", status: "done", progress: 1, travelProgress: 1 },
    { id: "dn-prepare", title: "Prepare dinner", agentSide: "business", status: "working", progress: 0.5, travelProgress: 1 },
    { id: "dn-deliver", title: "Complete dinner delivery", agentSide: "logistics", status: "queued", progress: 0, travelProgress: 0 },
  ]);
  assert.ok(economy.accrued > 0);
  assert.ok(economy.projected > economy.accrued);
  assert.ok(economy.breakdown.materials > 0);
});

test("Job Mode models gross income, expenses and positive expected net value", () => {
  const profile = { skills: ["ai", "llm", "evaluation", "research"], summary: "evaluation", availability: "flexible", minReward: 4000 };
  const opportunity = rankJobOpportunities(profile)[0];
  const { stages } = buildJobStages(profile, opportunity);
  const projected = jobProjectedEconomy(stages, opportunity);
  const early = jobAccruedExpense(stages, opportunity, 2, 0.25);
  const later = jobAccruedExpense(stages, opportunity, 8, 0.65);

  assert.ok(projected.total > 0);
  assert.ok(opportunity.negotiatedReward > projected.total);
  assert.ok(later.total > early.total);
  assert.ok(projected.breakdown.platform > 0);
  assert.ok(projected.breakdown.compute > 0);
});

test("real-time economics reuse calm UI without cross-root React portals", () => {
  assert.match(page, /AsymptaWorkflowEconomy/);
  assert.match(page, /AsymptaUltraCalm/);
  assert.match(workflowEconomy, /REFRESH_MS = 350/);
  assert.match(workflowEconomy, /workflowTaskAccruedEconomy/);
  assert.match(workflowEconomy, /dataset\.asymptaWorkflowCost/);
  assert.match(workflowEconomy, /dataset\.asymptaTaskCost/);
  assert.doesNotMatch(workflowEconomy, /createPortal/);
  assert.match(jobMode, /spent: number/);
  assert.match(jobMode, /const expenseDelta = Math\.max\(0, targetExpense - current\.spent\)/);
  assert.match(jobMode, /balanceRef\.current \+= delta/);
  assert.match(jobMode, /Gross|gross/);
  assert.match(jobMode, /Cost|cost/);
  assert.match(jobMode, /Net|net/);
  assert.match(ultraCalm, /rgba\(248,246,239,\.88\)/);
  assert.match(ultraCalm, /Human-decision surfaces/);
  assert.match(ultraCalm, /data-asympta-workflow-cost/);
  assert.match(ultraCalm, /data-asympta-task-cost/);
});
