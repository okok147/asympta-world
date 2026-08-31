import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  MARKETPLACE_PROFILE_REQUIRED_EVENT,
  compileAsymptaContext,
  createMarketplaceExecution,
  marketplaceProfilePreset,
} from "../lib/asympta-marketplace-intent.ts";
import {
  marketplaceCurrentRequestForProfile,
  marketplaceCurrentRequestForStart,
  marketplaceCurrentRequestFromExecution,
} from "../lib/asympta-marketplace-request-routing.ts";

test("a complete saved profile makes a vague food request executable without public-agent clarification", () => {
  const profile = marketplaceProfilePreset("local_delivery", 0);
  const compilation = compileAsymptaContext("我想買食物", {
    requestId: "request-owned-marketplace",
    conversationId: "conversation-owned-marketplace",
    locale: "zh-Hant",
    now: 0,
    profile,
  });

  assert.equal(compilation.supported, true, compilation.issues.join(" "));
  assert.ok(compilation.envelope);
  assert.deepEqual(compilation.profileRequirements.missing, []);
  assert.equal(compilation.envelope.goals[0].facts.find((fact) => fact.key === "food_preference")?.value, "local_cantonese");
  assert.equal(compilation.envelope.goals[0].facts.find((fact) => fact.key === "fulfilment_mode")?.value, "courier_delivery");
  assert.equal(compilation.envelope.goals[0].facts.find((fact) => fact.key === "payment_method")?.value, "card_on_file");

  const request = marketplaceCurrentRequestForStart(compilation.envelope, "human", "zh-Hant");
  assert.equal(request.kind, "marketplace");
  assert.equal(request.status, "gathering");
  assert.equal(request.goal, "購買食物");
  assert.match(request.step, /啟動模擬市場流程/);
  assert.doesNotMatch(request.step, /補充|研究/);
});

test("marketplace execution owns the current-request status throughout the simulated workflow", () => {
  const profile = marketplaceProfilePreset("local_delivery", 0);
  const compilation = compileAsymptaContext("我想買食物", {
    requestId: "request-marketplace-state",
    locale: "zh-Hant",
    now: 0,
    profile,
  });
  assert.ok(compilation.envelope);

  const execution = createMarketplaceExecution(compilation.envelope);
  const routed = marketplaceCurrentRequestFromExecution(execution, "human", "zh-Hant");
  assert.equal(routed.kind, "marketplace");
  assert.equal(routed.status, "gathering");
  assert.equal(routed.sourceCount, 0);
  assert.match(routed.actor, /市場/);
  assert.doesNotMatch(routed.step, /公開|研究|資料來源/);

  const completed = marketplaceCurrentRequestFromExecution({
    ...execution,
    status: "completed",
    progress: 1,
  }, "human", "zh-Hant");
  assert.equal(completed.status, "completed");
  assert.equal(completed.verification, "verified");
  assert.match(completed.step, /交付/);
});

test("waiting input is reserved for genuinely missing profile fields", () => {
  const request = marketplaceCurrentRequestForProfile({
    intent: "我想買食物",
    requestId: "request-missing-profile",
    missing: ["foodPreference", "fulfilmentMethod", "paymentMethod"],
  }, "human", "zh-Hant");

  assert.equal(request.kind, "marketplace");
  assert.equal(request.status, "waiting_input");
  assert.match(request.step, /食物偏好/);
  assert.match(request.step, /配送方式/);
  assert.match(request.step, /付款方式/);
});

test("browser router claims marketplace forms before the public information journey", async () => {
  const [page, router, css, requestState, requestCard] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/asympta-marketplace-intent-router.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/asympta-marketplace-intent-router.module.css", import.meta.url), "utf8"),
    readFile(new URL("../lib/asympta-current-request.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/asympta-safe-schedule.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /AsymptaMarketplaceIntentRouter/);
  assert.ok(page.indexOf("<AsymptaMarketplaceIntentRouter") < page.indexOf("<AsymptaIntentComposer"));
  assert.match(router, /addEventListener\("submit", onSubmit, true\)/);
  assert.match(router, /addEventListener\("keydown", onKeyDown, true\)/);
  assert.match(router, /stopImmediatePropagation\(\)/);
  assert.match(router, /compileAsymptaContext/);
  assert.match(router, /__ASYMPTA_MARKETPLACE__/);
  assert.match(router, /runIntent\(intent\)/);
  assert.match(router, /MARKETPLACE_EXECUTION_EVENT/);
  assert.match(router, new RegExp(MARKETPLACE_PROFILE_REQUIRED_EVENT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(router, /runPublicAgentIntent|beginInformationJourney|public-web/);
  assert.match(css, /data-asympta-intent-owner="marketplace"/);
  assert.match(css, /asympta-information-journey/);
  assert.match(css, /asympta-intent-result/);
  assert.match(requestState, /"marketplace"/);
  assert.match(requestCard, /sourceMarketplace/);
  assert.match(requestCard, /marketplaceStatuses/);
  assert.match(requestCard, /data-request-kind/);
});
