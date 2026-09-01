import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  compileAsymptaContext,
  createMarketplaceExecution,
  marketplaceProfilePreset,
  patchMarketplaceProfile,
} from "../lib/asympta-marketplace-intent.ts";
import {
  marketplaceCurrentRequestForProfile,
  marketplaceCurrentRequestForStart,
  marketplaceCurrentRequestFromExecution,
  marketplaceProfilePrompt,
  nextMarketplaceProfileField,
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

  const unprovenCompletion = marketplaceCurrentRequestFromExecution({
    ...execution,
    status: "completed",
    progress: 1,
  }, "human", "zh-Hant");
  assert.equal(unprovenCompletion.status, "gathering");
  assert.equal(unprovenCompletion.verification, null);
  assert.match(unprovenCompletion.step, /市場|供應|商戶/);
});

test("an incomplete profile asks only the next necessary question", () => {
  const missing = ["paymentMethod", "fulfilmentMethod", "foodPreference"];
  assert.equal(nextMarketplaceProfileField(missing), "foodPreference");
  const prompt = marketplaceProfilePrompt(missing, "zh-Hant");
  assert.equal(prompt?.field, "foodPreference");
  assert.match(prompt?.question ?? "", /哪一類食物/);
  assert.doesNotMatch(prompt?.question ?? "", /配送|付款/);

  const request = marketplaceCurrentRequestForProfile({
    intent: "我想買食物",
    requestId: "request-missing-profile",
    missing,
  }, "human", "zh-Hant");

  assert.equal(request.kind, "marketplace");
  assert.equal(request.status, "waiting_input");
  assert.match(request.step, /哪一類食物/);
  assert.doesNotMatch(request.step, /配送|付款/);
});

test("each profile answer recompiles the same intent and advances to the next missing field", () => {
  const intent = "I want to buy some food";
  let profile = null;

  let compilation = compileAsymptaContext(intent, { requestId: "request-progressive", now: 0, profile });
  assert.equal(nextMarketplaceProfileField(compilation.profileRequirements.missing), "foodPreference");

  profile = patchMarketplaceProfile(profile, { foodPreference: "japanese" }, 1);
  compilation = compileAsymptaContext(intent, { requestId: "request-progressive", now: 1, profile });
  assert.equal(nextMarketplaceProfileField(compilation.profileRequirements.missing), "fulfilmentMethod");
  assert.deepEqual(compilation.profileRequirements.missing, ["fulfilmentMethod", "paymentMethod"]);

  profile = patchMarketplaceProfile(profile, { fulfilmentMethod: "courier_delivery" }, 2);
  compilation = compileAsymptaContext(intent, { requestId: "request-progressive", now: 2, profile });
  assert.equal(nextMarketplaceProfileField(compilation.profileRequirements.missing), "paymentMethod");
  assert.deepEqual(compilation.profileRequirements.missing, ["paymentMethod"]);

  profile = patchMarketplaceProfile(profile, { paymentMethod: "asympta_wallet" }, 3);
  compilation = compileAsymptaContext(intent, { requestId: "request-progressive", now: 3, profile });
  assert.deepEqual(compilation.profileRequirements.missing, []);
  assert.equal(nextMarketplaceProfileField(compilation.profileRequirements.missing), null);
});

test("browser router claims marketplace forms, asks one field at a time and finishes local simulation", async () => {
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
  assert.match(router, /addEventListener\("click", onProfileChoice, true\)/);
  assert.match(router, /stopImmediatePropagation\(\)/);
  assert.match(router, /compileAsymptaContext/);
  assert.match(router, /createMarketplaceRequestId/);
  assert.match(router, /crypto\?\.randomUUID/);
  assert.match(router, /runIntent\(intent, envelope\.requestId\)/);
  assert.match(router, /__ASYMPTA_MARKETPLACE__/);
  assert.match(router, /runIntent\(pending\.intent, pending\.requestId\)/);
  assert.match(router, /writeAsymptaMarketplaceProfile/);
  assert.match(router, /patchMarketplaceProfile/);
  assert.match(router, /marketplaceProfilePrompt/);
  assert.match(router, /MARKETPLACE_EXECUTION_EVENT/);
  assert.match(router, /MARKETPLACE_PROFILE_REQUIRED_EVENT/);
  assert.doesNotMatch(router, /autoApproveSimulatedMarketplacePayment/);
  assert.doesNotMatch(router, /demo\.approve\(/);
  assert.doesNotMatch(router, /runPublicAgentIntent|beginInformationJourney|public-web/);
  assert.match(css, /data-asympta-intent-owner="marketplace"/);
  assert.match(css, /data-asympta-marketplace-next-field="foodPreference"/);
  assert.match(css, /fieldset:nth-of-type\(1\)/);
  assert.match(css, /fieldset:nth-of-type\(2\)/);
  assert.match(css, /fieldset:nth-of-type\(3\)/);
  assert.match(css, /asympta-marketplace-progressive-question/);
  assert.match(css, /asympta-information-journey/);
  assert.match(css, /asympta-intent-result/);
  assert.match(requestState, /"marketplace"/);
  assert.match(requestCard, /sourceMarketplace/);
  assert.match(requestCard, /marketplaceStatuses/);
  assert.match(requestCard, /data-request-kind/);
});
