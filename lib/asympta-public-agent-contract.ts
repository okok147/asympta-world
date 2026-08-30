export const ASYMPTA_PUBLIC_AGENT_API_PATH = "/v1/intent" as const;
export const ASYMPTA_PUBLIC_AGENT_TURNSTILE_ACTION = "asympta_public_intent" as const;

export type PublicAgentIntentKind = "weather" | "research" | "action" | "clarification";
export type PublicAgentStage = "completed" | "needs_clarification" | "awaiting_confirmation";
export type PublicAgentRisk = "none" | "low" | "medium" | "high";

export type PublicAgentRequest = {
  intent: string;
  locale: string;
  timezone: string;
  turnstileToken: string;
  clientId: string;
};

export type PublicAgentGoal = {
  title: string;
  summary: string;
  kind: PublicAgentIntentKind;
  status: PublicAgentStage;
  missingFields: string[];
  requiresConfirmation: boolean;
  risk: PublicAgentRisk;
};

export type PublicAgentSource = {
  title: string;
  url: string;
  provider: "open-meteo" | "openrouter-web-search";
  publishedAt: string | null;
};

export type PublicAgentVerification = {
  status: "verified" | "partially_verified" | "not_verified";
  details: string;
};

export type PublicAgentResult = {
  answer: string;
  checkedAt: string;
  sources: PublicAgentSource[];
  verification: PublicAgentVerification;
};

export type PublicAgentAction = {
  description: string;
  consequence: string;
};

export type PublicAgentProvenance = {
  provider: "openrouter" | "asympta";
  model: string | null;
  tools: string[];
  simulated: boolean;
};

export type PublicAgentSuccessResponse = {
  ok: true;
  activityId: string;
  goal: PublicAgentGoal;
  result: PublicAgentResult | null;
  action: PublicAgentAction | null;
  provenance: PublicAgentProvenance;
};

export type PublicAgentErrorCode =
  | "invalid_origin"
  | "method_not_allowed"
  | "unsupported_media_type"
  | "request_too_large"
  | "invalid_request"
  | "turnstile_failed"
  | "rate_limited"
  | "budget_exhausted"
  | "missing_configuration"
  | "upstream_timeout"
  | "upstream_error"
  | "invalid_upstream_response"
  | "internal_error";

export type PublicAgentErrorResponse = {
  ok: false;
  activityId: string | null;
  error: {
    code: PublicAgentErrorCode;
    message: string;
    retryable: boolean;
  };
};

export type PublicAgentResponse = PublicAgentSuccessResponse | PublicAgentErrorResponse;
