import { getWorldSummary } from "./catalog.js";
import { ACTION_TYPES, sanitizeRef, validatePlan } from "./validation.js";

const API_ROUTE = "/api/agent";

function step(id, title, type, params, rationale = "") {
  return { id, title, rationale, action: { type, params } };
}

function inferItem(intent) {
  const text = intent.toLowerCase();
  if (/meal|lunch|dinner|breakfast|飯|餐|午餐|晚餐|早餐/.test(text)) return "meal";
  if (/vegetable|fruit|grocery|food|菜|水果|雜貨|食物|食品/.test(text)) return "groceries";
  return "food";
}

function isPurchaseIntent(intent) {
  return /buy|order|deliver|purchase|food|meal|grocery|買|訂|送|食物|飯|餐|雜貨/i.test(intent);
}

function isRepairIntent(intent) {
  return /repair|fix|broken|make|build|維修|修理|壞|製作|打造/i.test(intent);
}

function isSkillIntent(intent) {
  return /learn|teacher|skill|expert|collaborat|學|老師|技能|專家|合作/i.test(intent);
}

function localPlan(intent, world) {
  const suffix = sanitizeRef(intent, "task").slice(0, 20);
  const orderRef = `order-${suffix}`;
  const reservationRef = `reserve-${suffix}`;

  if (isPurchaseIntent(intent)) {
    const item = inferItem(intent);
    return {
      objective: intent,
      summary: `Coordinate a simulated ${item} order, delivery, and proof of completion.`,
      assumptions: ["This is a simulation; no real purchase or payment will occur."],
      steps: [
        step("inspect-market", "Inspect the market", "inspect_entity", { entityId: "market" }),
        step("contact-market", "Ask the market agent", "send_message", {
          fromAgentId: "personal-agent",
          toEntityId: "market",
          intent: `Check availability and coordinate this request: ${intent}`,
        }),
        step("quote", "Request a quote", "request_quote", {
          buyerAgentId: "personal-agent",
          sellerEntityId: "market",
          item,
          quantity: 1,
          currency: "HKD",
        }),
        step("reserve", "Reserve the requested resource", "reserve_resource", {
          ownerEntityId: "market",
          item,
          quantity: 1,
          reservationRef,
          unit: item === "groceries" ? "basket" : "set",
        }),
        step("order", "Create the order", "create_order", {
          orderRef,
          buyerAgentId: "personal-agent",
          sellerEntityId: "market",
          item,
          quantity: 1,
          destinationEntityId: "home",
        }),
        step("prepare", "Prepare the order", "prepare_order", { orderRef, byEntityId: "market" }),
        step("handoff", "Hand the order to the courier", "handoff_order", {
          orderRef,
          courierAgentId: "courier-agent",
        }),
        step("deliver", "Deliver to the user", "deliver_order", {
          orderRef,
          destinationEntityId: "home",
        }),
        step("verify", "Verify delivery state", "verify_condition", {
          subjectRef: orderRef,
          condition: "order_delivered",
        }),
        step("complete", "Close the task", "complete_task", {
          summary: `The simulated ${item} request was coordinated, delivered, and verified in world state.`,
        }),
      ],
    };
  }

  if (isRepairIntent(intent)) {
    return {
      objective: intent,
      summary: "Coordinate a simulated workshop service and verify the reservation.",
      assumptions: ["The workshop action is simulated and does not create a real booking."],
      steps: [
        step("inspect-workshop", "Inspect workshop capacity", "inspect_entity", { entityId: "workshop" }),
        step("contact-workshop", "Describe the request", "send_message", {
          fromAgentId: "personal-agent",
          toEntityId: "workshop",
          intent,
        }),
        step("reserve-slot", "Reserve a workshop slot", "reserve_resource", {
          ownerEntityId: "workshop",
          item: "repair_slot",
          quantity: 1,
          reservationRef,
          unit: "slot",
        }),
        step("verify-slot", "Verify the reservation", "verify_condition", {
          subjectRef: reservationRef,
          condition: "reservation_active",
        }),
        step("complete", "Close the task", "complete_task", {
          summary: "A workshop agent accepted the simulated request and the service slot was verified.",
        }),
      ],
    };
  }

  if (isSkillIntent(intent)) {
    return {
      objective: intent,
      summary: "Coordinate a simulated community skill match.",
      assumptions: ["The match exists only inside the simulation."],
      steps: [
        step("inspect-community", "Inspect the community exchange", "inspect_entity", { entityId: "community" }),
        step("ask-community", "Ask for a suitable match", "send_message", {
          fromAgentId: "personal-agent",
          toEntityId: "community",
          intent,
        }),
        step("reserve-match", "Reserve a skill match", "reserve_resource", {
          ownerEntityId: "community",
          item: "skill_match",
          quantity: 1,
          reservationRef,
          unit: "match",
        }),
        step("verify-match", "Verify the match", "verify_condition", {
          subjectRef: reservationRef,
          condition: "reservation_active",
        }),
        step("complete", "Close the task", "complete_task", {
          summary: "The community agent found and verified a simulated collaboration match.",
        }),
      ],
    };
  }

  const entityRef = `service-${suffix}`;
  return {
    objective: intent,
    summary: "Discover a relevant simulated service, coordinate with it, and verify the resulting state.",
    assumptions: ["A missing service may be represented as a newly discovered simulation entity."],
    steps: [
      step("discover", "Discover a capable service", "discover_entity", {
        entityRef,
        name: "Discovered Service",
        nameZh: "新發現服務",
        entityType: "service",
        capability: intent.slice(0, 80),
        agentName: "Nova",
      }),
      step("inspect", "Inspect the service", "inspect_entity", { entityId: entityRef }),
      step("coordinate", "Send the user intent", "send_message", {
        fromAgentId: "personal-agent",
        toEntityId: entityRef,
        intent,
      }),
      step("verify", "Verify the service exists", "verify_condition", {
        subjectRef: entityRef,
        condition: "entity_exists",
      }),
      step("complete", "Close the task", "complete_task", {
        summary: "A suitable simulated service was discovered, contacted, and verified.",
      }),
    ],
  };
}

function cleanPlan(raw, intent) {
  const candidate = raw?.plan ?? raw;
  const normalized = {
    objective: String(candidate?.objective || intent).slice(0, 500),
    summary: String(candidate?.summary || "Agent-generated execution plan.").slice(0, 500),
    assumptions: Array.isArray(candidate?.assumptions)
      ? candidate.assumptions.slice(0, 6).map((value) => String(value).slice(0, 240))
      : [],
    steps: Array.isArray(candidate?.steps)
      ? candidate.steps
          .slice(0, 14)
          .filter((item) => ACTION_TYPES.includes(item?.action?.type))
          .map((item, index) => ({
            id: sanitizeRef(item.id || `step-${index + 1}`, "step"),
            title: String(item.title || `Step ${index + 1}`).slice(0, 140),
            rationale: String(item.rationale || "").slice(0, 320),
            action: {
              type: item.action.type,
              params: item.action.params && typeof item.action.params === "object" ? item.action.params : {},
            },
          }))
      : [],
  };

  if (!normalized.steps.some((item) => item.action.type === "complete_task")) {
    normalized.steps.push(
      step("complete-task", "Close the task", "complete_task", {
        summary: normalized.summary || "The simulated task finished with validated state transitions.",
      }),
    );
  }

  const validation = validatePlan(normalized);
  if (!validation.ok) throw new Error(`Invalid plan: ${validation.errors.join("; ")}`);
  return normalized;
}

async function callPlanner(body, signal) {
  const response = await fetch(API_ROUTE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Planner request failed (${response.status})`);
  return payload;
}

export async function requestAgentPlan({ intent, world, language = "en", signal, repair = null }) {
  const summary = getWorldSummary(world);
  try {
    const payload = await callPlanner(
      {
        mode: repair ? "repair" : "plan",
        intent,
        language,
        world: summary,
        repair,
      },
      signal,
    );
    return {
      plan: cleanPlan(payload.plan, intent),
      source: "openrouter",
      model: payload.model || "free GPT-OSS",
      note: payload.note || "",
    };
  } catch (error) {
    if (signal?.aborted) throw error;
    return {
      plan: cleanPlan(localPlan(intent, world), intent),
      source: "local-fallback",
      model: "deterministic safety planner",
      note: error instanceof Error ? error.message : "Model route unavailable",
    };
  }
}
