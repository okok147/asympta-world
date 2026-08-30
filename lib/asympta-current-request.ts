export type AsymptaCurrentRequestSource = "human" | "webmcp";

export type AsymptaCurrentRequestPermission = "READ" | "WRITE_REQUEST";

export type AsymptaCurrentRequestStatus =
  | "interpreting"
  | "gathering"
  | "returning"
  | "completed"
  | "waiting_input"
  | "awaiting_confirmation"
  | "failed";

export type AsymptaCurrentRequest = {
  requestId: string;
  source: AsymptaCurrentRequestSource;
  intent: string;
  goal: string | null;
  kind: "weather" | "research" | "action" | "clarification" | null;
  permission: AsymptaCurrentRequestPermission;
  status: AsymptaCurrentRequestStatus;
  actor: string;
  step: string;
  destination: string | null;
  sourceCount: number;
  verification: "verified" | "partially_verified" | "not_verified" | null;
  events: string[];
  updatedAt: string;
};

export const ASYMPTA_CURRENT_REQUEST_EVENT = "asympta:current-request" as const;

export function publishAsymptaCurrentRequest(request: AsymptaCurrentRequest) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<AsymptaCurrentRequest>(ASYMPTA_CURRENT_REQUEST_EVENT, {
    detail: request,
  }));
}

export function subscribeAsymptaCurrentRequest(listener: (request: AsymptaCurrentRequest) => void) {
  if (typeof window === "undefined") return () => undefined;
  const onRequest = (event: Event) => {
    const request = (event as CustomEvent<AsymptaCurrentRequest>).detail;
    if (request?.requestId) listener(request);
  };
  window.addEventListener(ASYMPTA_CURRENT_REQUEST_EVENT, onRequest);
  return () => window.removeEventListener(ASYMPTA_CURRENT_REQUEST_EVENT, onRequest);
}
