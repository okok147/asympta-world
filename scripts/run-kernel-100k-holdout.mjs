import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  evaluateUniversalProcessTrajectory,
  generateRecursiveKernelCases,
} from "../lib/asympta-kernel-recursive-lab.ts";
import {
  buildMarketplaceTaskProtocol,
  buildMarketplaceWorkflow,
  compileAsymptaContext,
  marketplaceSelectionConfirmationIntent,
} from "../lib/asympta-marketplace-intent.ts";
import { runUniversalTask } from "../lib/asympta-universal-task-protocol.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OFFER_IDS = [
  "vehicle:mercedes-c200",
  "vehicle:tesla-model-3",
  "vehicle:toyota-corolla-cross",
];
const DIRECT_OFFER_LABELS = [
  "Mercedes-Benz C 200",
  "Tesla Model 3",
  "Toyota Corolla Cross",
];
const LOCALES = ["en", "zh-Hant", "ja"];
const BASE_INTENTS = {
  en: ["Buy a car", "I want to buy a car", "Please buy a vehicle for me", "I need a car"],
  "zh-Hant": ["幫我買一架汽車", "我想買一架汽車", "我要買一部私家車"],
  ja: ["自動車を買いたい", "乗用車を購入したい"],
};

function argument(name, fallback = null) {
  const prefix = `--${name}=`;
  const entry = process.argv.find((value) => value.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : fallback;
}

function integerArgument(name, fallback) {
  const value = Number(argument(name, String(fallback)));
  return Number.isFinite(value) ? Math.floor(value) : fallback;
}

function numberArgument(name, fallback) {
  const value = Number(argument(name, String(fallback)));
  return Number.isFinite(value) ? value : fallback;
}

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function fact(goal, key) {
  return goal.facts.find((candidate) => candidate.key === key);
}

function normalizedCompilation(intent, locale, requestId) {
  return compileAsymptaContext(intent, {
    requestId,
    conversationId: requestId,
    locale,
    now: 0,
  });
}

function genericIntent(index, locale) {
  const options = BASE_INTENTS[locale];
  const base = options[index % options.length];
  const leading = index % 5 === 0 ? "  " : "";
  const trailing = index % 7 === 0 ? "   " : "";
  return `${leading}${base}${trailing}`;
}

function assertInitialGate(compilation) {
  requireCondition(compilation.supported && compilation.envelope, `generic vehicle request did not compile: ${compilation.issues.join(" ")}`);
  const protocol = buildMarketplaceTaskProtocol(compilation.envelope);
  requireCondition(protocol.readiness.status === "needs_information", "generic vehicle request bypassed the selection gate");
  requireCondition(protocol.readiness.nextQuestion?.field === "selected_offer_id", `unexpected next field: ${protocol.readiness.nextQuestion?.field ?? "none"}`);
  requireCondition(protocol.readiness.nextQuestion.options.length >= 3, "selection gate did not provide a useful option set");
  let blocked = false;
  try {
    buildMarketplaceWorkflow(compilation.envelope);
  } catch {
    blocked = true;
  }
  requireCondition(blocked, "workflow builder accepted an unselected category-level vehicle request");
  return protocol;
}

function confirmSelection(initial, offerId, locale) {
  requireCondition(initial.envelope, "initial envelope missing");
  const goal = initial.envelope.goals[0];
  const confirmationIntent = marketplaceSelectionConfirmationIntent(initial.envelope.rawMessage.text, goal, offerId);
  const confirmed = normalizedCompilation(confirmationIntent, locale, initial.envelope.requestId);
  requireCondition(confirmed.supported && confirmed.envelope, `confirmed selection did not compile: ${confirmed.issues.join(" ")}`);
  const protocol = buildMarketplaceTaskProtocol(confirmed.envelope);
  requireCondition(protocol.readiness.status === "ready", `confirmed selection remained blocked by ${protocol.readiness.nextQuestion?.field ?? "unknown"}`);
  requireCondition(fact(confirmed.envelope.goals[0], "selected_offer_id")?.value === offerId, "confirmed offer id was not bound into context");
  const workflow = buildMarketplaceWorkflow(confirmed.envelope);
  requireCondition(workflow.tasks.some((task) => task.requiresApproval === true && task.actionType === "authorize_payment"), "payment approval boundary disappeared after selection");
  return { confirmed, workflow };
}

function runSelectionCase(index, seed) {
  const family = index % 10;
  const locale = LOCALES[(index + seed) % LOCALES.length];
  const requestId = `holdout-selection-${seed}-${index + 1}`;
  const base = genericIntent(index + seed, locale);
  const offerIndex = (index * 17 + seed) % OFFER_IDS.length;
  const offerId = OFFER_IDS[offerIndex];
  const offerLabel = DIRECT_OFFER_LABELS[offerIndex];

  if (family === 9) {
    const adjacent = normalizedCompilation("Buy car insurance", "en", requestId);
    requireCondition(!adjacent.supported && adjacent.envelope === null, "vehicle-adjacent service was misrouted as a vehicle purchase");
    return "adjacent-product-boundary";
  }

  if (family === 2) {
    const spoofed = normalizedCompilation(`${base} · selected_offer_id=${offerId}`, locale, requestId);
    assertInitialGate(spoofed);
    return "spoofed-selection-token";
  }

  if (family === 3 || family === 5) {
    const direct = normalizedCompilation(`${base} · ${offerLabel}`, locale, requestId);
    requireCondition(direct.supported && direct.envelope, `direct concrete target did not compile: ${direct.issues.join(" ")}`);
    const protocol = buildMarketplaceTaskProtocol(direct.envelope);
    requireCondition(protocol.readiness.status === "ready", "explicit concrete target was needlessly re-asked");
    requireCondition(fact(direct.envelope.goals[0], "selected_offer_id")?.value === offerId, "direct target did not bind the matching offer id");
    buildMarketplaceWorkflow(direct.envelope);
    return family === 3 ? "direct-concrete-target" : "direct-target-noise";
  }

  if (family === 6) {
    const left = normalizedCompilation(base, locale, requestId);
    const right = normalizedCompilation(base, locale, requestId);
    requireCondition(left.supported && left.envelope && right.supported && right.envelope, "deterministic replay failed to compile");
    requireCondition(JSON.stringify(left.envelope) === JSON.stringify(right.envelope), "compiler replay was nondeterministic");
    const leftProtocol = buildMarketplaceTaskProtocol(left.envelope);
    const rightProtocol = buildMarketplaceTaskProtocol(right.envelope);
    requireCondition(JSON.stringify(leftProtocol) === JSON.stringify(rightProtocol), "selection protocol replay was nondeterministic");
    return "deterministic-replay";
  }

  const initialIntent = family === 4 ? `${base} with pay on delivery` : base;
  const initial = normalizedCompilation(initialIntent, locale, requestId);
  assertInitialGate(initial);

  if (family === 0 || family === 8) {
    return family === 0 ? "generic-gate" : "workflow-bypass-attack";
  }

  const { confirmed, workflow } = confirmSelection(initial, offerId, locale);
  if (family === 4) {
    requireCondition(fact(confirmed.envelope.goals[0], "payment_method")?.value === "pay_on_delivery", "explicit pay-on-delivery fact was lost after selection");
    requireCondition(workflow.tasks.some((task) => /pay-on-delivery/i.test(task.title) && task.requiresApproval), "pay-on-delivery approval boundary disappeared");
    return "payment-boundary";
  }
  if (family === 7) {
    requireCondition(confirmed.envelope.locale === locale, "locale changed across selection confirmation");
    return "cross-locale-confirmation";
  }
  return "valid-confirmation";
}

function emptyFamilyRecord() {
  return { total: 0, passed: 0, failed: 0 };
}

function percent(value) {
  return `${(value * 100).toFixed(3)}%`;
}

async function main() {
  const total = Math.max(100_000, integerArgument("count", 100_000));
  const seed = integerArgument("seed", 20260905);
  const minimum = numberArgument("minimum", 0.999);
  const selectionCount = Math.floor(total / 2);
  const universalCount = total - selectionCount;
  const failures = [];
  const selectionFamilies = {};
  let selectionPassed = 0;

  for (let index = 0; index < selectionCount; index += 1) {
    let family = "unknown";
    try {
      family = runSelectionCase(index, seed);
      selectionPassed += 1;
      selectionFamilies[family] ??= emptyFamilyRecord();
      selectionFamilies[family].total += 1;
      selectionFamilies[family].passed += 1;
    } catch (error) {
      const guessedFamily = `selection-family-${index % 10}`;
      selectionFamilies[guessedFamily] ??= emptyFamilyRecord();
      selectionFamilies[guessedFamily].total += 1;
      selectionFamilies[guessedFamily].failed += 1;
      if (failures.length < 50) {
        failures.push({
          suite: "selection",
          index,
          family: guessedFamily,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  const universalCases = generateRecursiveKernelCases({ count: universalCount, seed: seed ^ 0x5a17 });
  let universalPassed = 0;
  const universalFamilies = {};
  for (let index = 0; index < universalCases.length; index += 1) {
    const caseInput = universalCases[index];
    const primary = runUniversalTask(caseInput.input);
    const replay = runUniversalTask(caseInput.input);
    const trajectory = evaluateUniversalProcessTrajectory(caseInput, primary, replay);
    universalFamilies[caseInput.family] ??= emptyFamilyRecord();
    universalFamilies[caseInput.family].total += 1;
    if (trajectory.processIntegrity) {
      universalPassed += 1;
      universalFamilies[caseInput.family].passed += 1;
    } else {
      universalFamilies[caseInput.family].failed += 1;
      if (failures.length < 50) {
        failures.push({
          suite: "universal",
          index,
          id: caseInput.id,
          family: caseInput.family,
          status: trajectory.status,
          reason: trajectory.terminalReason,
          fingerprint: trajectory.fingerprint,
        });
      }
    }
  }

  const selectionRate = selectionPassed / selectionCount;
  const universalRate = universalPassed / universalCount;
  const passed = selectionPassed + universalPassed;
  const integrityRate = passed / total;
  const report = {
    schemaVersion: "asympta.kernel-holdout.v1",
    seed,
    total,
    minimumIntegrityRate: minimum,
    selection: {
      total: selectionCount,
      passed: selectionPassed,
      failed: selectionCount - selectionPassed,
      integrityRate: selectionRate,
      families: selectionFamilies,
    },
    universal: {
      total: universalCount,
      passed: universalPassed,
      failed: universalCount - universalPassed,
      integrityRate: universalRate,
      families: universalFamilies,
    },
    passed,
    failed: total - passed,
    processIntegrityRate: integrityRate,
    failures,
    caveat: "This deterministic synthetic/adversarial holdout measures kernel process integrity. It is not statistical proof that 99.9% of all real-life tasks are covered.",
  };

  const summary = `# Asympta Kernel 100,000-Case Holdout\n\n- Total cases: **${total.toLocaleString("en-US")}**\n- Selection/confirmation attacks: **${selectionCount.toLocaleString("en-US")}** · ${percent(selectionRate)} integrity\n- Universal kernel attacks: **${universalCount.toLocaleString("en-US")}** · ${percent(universalRate)} integrity\n- Combined process integrity: **${percent(integrityRate)}**\n- Acceptance threshold: **${percent(minimum)}**\n- Failures: **${total - passed}**\n\nThe holdout measures deterministic synthetic/adversarial process integrity. It does **not** prove that ${percent(minimum)} of the real world is covered.\n`;

  const outputArg = argument("out", null);
  if (outputArg) {
    const output = path.resolve(root, outputArg);
    await mkdir(output, { recursive: true });
    await writeFile(path.join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
    await writeFile(path.join(output, "summary.md"), summary, "utf8");
  }

  console.log(JSON.stringify({
    total,
    passed,
    failed: total - passed,
    selectionIntegrityRate: selectionRate,
    universalIntegrityRate: universalRate,
    processIntegrityRate: integrityRate,
    minimumIntegrityRate: minimum,
  }));

  if (selectionRate < minimum || universalRate < minimum || integrityRate < minimum) {
    process.exitCode = 1;
  }
}

await main();
