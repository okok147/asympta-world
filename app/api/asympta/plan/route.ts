import { buildDeterministicIntentPlan } from "../../../../lib/intent-world/fallback.ts";
import { describePlannerCapabilities, PLANNER_RESPONSE_JSON_SCHEMA } from "../../../../lib/intent-world/schema.ts";
import { normalizeUserIntent, validatePlannerResult } from "../../../../lib/intent-world/validation.ts";
import type {
  IntentConversationMessage,
  IntentPlannerResponse,
  PlannerResult,
} from "../../../../lib/intent-world/types.ts";

export const dynamic = "force-dynamic";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "openai/gpt-oss-120b:free";
const MAX_BODY_BYTES = 32_000;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 12;
const REQUEST_TIMEOUT_MS = 28_000;

const requestsByClient = new Map<string, number[]>();

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function cleanConversation(value: unknown): IntentConversationMessage[] {
  if (!Array.isArray(value)) return [];
  const messages: IntentConversationMessage[] = [];
  for (const item of value.slice(-12)) {
    const message = record(item);
    const role = message?.role;
    const rawContent = message?.content;
    if ((role !== "user" && role !== "assistant") || typeof rawContent !== "string") continue;
    const content = rawContent.replace(/\s+/g, " ").trim().slice(0, 800);
    if (!content) continue;
    messages.push({ role, content });
  }
  return messages;
}

function responseHeaders(request: Request) {
  const origin = request.headers.get("origin");
  const allowed = origin && (
    origin === "https://okok147.github.io"
    || origin === "https://asympta-world.oklauuuuu.chatgpt.site"
    || origin.startsWith("http://localhost:")
    || origin.startsWith("http://127.0.0.1:")
  );
  const headers = new Headers({
    "Cache-Control": "no-store, max-age=0",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
  });
  if (allowed && origin) headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  return headers;
}

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders(request) });
}

function clientKey(request: Request) {
  return request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "anonymous";
}

function rateLimited(request: Request) {
  const key = clientKey(request);
  const now = Date.now();
  const recent = (requestsByClient.get(key) ?? []).filter((timestamp) => now - timestamp < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    requestsByClient.set(key, recent);
    return true;
  }
  recent.push(now);
  requestsByClient.set(key, recent);
  if (requestsByClient.size > 500) {
    for (const [client, timestamps] of requestsByClient) {
      const active = timestamps.filter((timestamp) => now - timestamp < RATE_WINDOW_MS);
      if (active.length) requestsByClient.set(client, active);
      else requestsByClient.delete(client);
    }
  }
  return false;
}

function textContent(value: unknown) {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value
    .map((part) => {
      const item = record(part);
      return item?.type === "text" && typeof item.text === "string" ? item.text : "";
    })
    .filter(Boolean)
    .join("\n");
}

function parseJsonContent(content: string) {
  const trimmed = content.trim();
  const withoutFence = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
    : trimmed;
  return JSON.parse(withoutFence) as unknown;
}

function fallbackResponse(reason: string, intent: string): IntentPlannerResponse {
  return {
    ok: true,
    result: buildDeterministicIntentPlan(intent),
    provenance: {
      provider: "deterministic-fallback",
      model: OPENROUTER_MODEL,
      fallbackReason: reason.slice(0, 300),
    },
  };
}

function systemPrompt() {
  const capabilities = describePlannerCapabilities();
  return [
    "You are the planning layer for Asympta World, a visibly simulated multi-agent coordination environment.",
    "Convert the user's natural-language intention into either concise clarification questions or one bounded executable task graph.",
    "Use the same language as the user.",
    "Ask clarification only when missing information would materially change the plan, acceptance criteria, authority boundary, or safety. Otherwise plan immediately.",
    "Every task must have one known agent, one known location, explicit dependencies, a bounded duration, an action type, and a concrete validation rule.",
    "Tasks are proposals for a deterministic simulation engine. Never claim that a real purchase, payment, booking, shipment, email, supplier, business, or external tool action occurred.",
    "Set requiresApproval=true for reserve_capacity, place_order, authorize_payment, commit_contract, release_shipment, and send_external_message. Human approval can never be inferred from conversation.",
    "Prefer 5 to 10 meaningful tasks. Parallel tasks are welcome when dependencies permit, but do not assign one agent two simultaneous branches that must run at the same time.",
    "The plan must be a DAG. dependsOn values must exactly match task ids in the same plan.",
    "End with a verification task and an inspectable completion/delivery task.",
    "Return only JSON matching the supplied schema.",
    `Allowed capabilities: ${JSON.stringify(capabilities)}`,
  ].join("\n");
}

async function callOpenRouter(
  apiKey: string,
  intent: string,
  conversation: IntentConversationMessage[],
): Promise<PlannerResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const messages = [
      { role: "system", content: systemPrompt() },
      ...conversation,
      {
        role: "user",
        content: `Current complete intention and constraints:\n${intent}\n\nCreate the next clarification or executable plan now.`,
      },
    ];
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://asympta-world.oklauuuuu.chatgpt.site",
        "X-OpenRouter-Title": "Asympta World",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages,
        temperature: 0.2,
        max_tokens: 6_000,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "asympta_intent_plan",
            strict: true,
            schema: PLANNER_RESPONSE_JSON_SCHEMA,
          },
        },
      }),
      signal: controller.signal,
    });

    const rawText = await response.text();
    if (!response.ok) {
      let detail = `OpenRouter returned ${response.status}.`;
      try {
        const body = record(JSON.parse(rawText));
        const error = record(body?.error);
        if (typeof error?.message === "string") detail = `${detail} ${error.message}`;
      } catch {
        // Keep the bounded status-only error.
      }
      throw new Error(detail);
    }

    const payload = record(JSON.parse(rawText));
    const choices = Array.isArray(payload?.choices) ? payload.choices : [];
    const choice = record(choices[0]);
    const message = record(choice?.message);
    const content = textContent(message?.content);
    if (!content) throw new Error("OpenRouter returned no structured planner content.");

    const validation = validatePlannerResult(parseJsonContent(content), intent);
    if (!validation.ok) throw new Error(`Planner output was rejected: ${validation.error}`);
    return validation.value;
  } finally {
    clearTimeout(timeout);
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: responseHeaders(request) });
}

export async function POST(request: Request) {
  if (rateLimited(request)) {
    return json(request, { ok: false, error: "Too many planning requests. Please continue the same conversation after a short pause." }, 429);
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return json(request, { ok: false, error: "Request body is too large." }, 413);
  }

  let body: Record<string, unknown> | null = null;
  try {
    body = record(await request.json());
  } catch {
    return json(request, { ok: false, error: "Request body must be valid JSON." }, 400);
  }

  const intentValidation = normalizeUserIntent(body?.intent);
  if (!intentValidation.ok) return json(request, { ok: false, error: intentValidation.error }, 400);
  const intent = intentValidation.value;
  const conversation = cleanConversation(body?.conversation);
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();

  if (!apiKey) {
    return json(request, fallbackResponse("OPENROUTER_API_KEY is not configured on the server.", intent));
  }

  try {
    const result = await callOpenRouter(apiKey, intent, conversation);
    const response: IntentPlannerResponse = {
      ok: true,
      result,
      provenance: {
        provider: "openrouter",
        model: OPENROUTER_MODEL,
        fallbackReason: null,
      },
    };
    return json(request, response);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "OpenRouter planning failed.";
    return json(request, fallbackResponse(reason, intent));
  }
}
