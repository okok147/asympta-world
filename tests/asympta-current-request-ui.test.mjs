import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const composer = await readFile(new URL("../components/asympta-intent-composer.tsx", import.meta.url), "utf8");
const requestCard = await readFile(new URL("../components/asympta-safe-schedule.tsx", import.meta.url), "utf8");
const currentRequest = await readFile(new URL("../lib/asympta-current-request.ts", import.meta.url), "utf8");
const requestCss = await readFile(new URL("../app/asympta-request-cards.css", import.meta.url), "utf8");

test("a WebMCP submit becomes a visible human-reviewed draft instead of auto-running", () => {
  assert.match(composer, /subscribeBrowserWebMcpRequests/);
  assert.match(composer, /request\.status === "pending_human_review"/);
  assert.match(composer, /setWebMcpDraft\(request\)/);
  assert.match(composer, /reviewWebMcpDraft/);
  assert.match(composer, /setText\(webMcpDraft\.intent\)/);
  assert.match(composer, /reviewedWebMcpRequest/);
  assert.match(composer, /await runIntent\(intention, reviewedWebMcpRequest/);
  assert.doesNotMatch(composer, /subscribeBrowserWebMcpRequests\([\s\S]{0,320}runIntent\(/);
});

test("request execution publishes one shared current-request journey and updates the exact WebMCP ID", () => {
  assert.match(currentRequest, /ASYMPTA_CURRENT_REQUEST_EVENT = "asympta:current-request"/);
  assert.match(composer, /publishAsymptaCurrentRequest/);
  assert.match(composer, /requestId: trackedRequestId/);
  assert.match(composer, /status: "gathering"/);
  assert.match(composer, /status: "returning"/);
  assert.match(composer, /status: "awaiting_confirmation"/);
  assert.match(composer, /status: requestStatus/);
  assert.match(composer, /\? "needs_clarification"/);
  assert.match(composer, /status: "completed"/);
  assert.match(composer, /updateBrowserWebMcpRequest\(requestContext\.requestId/);
  assert.match(composer, /2 research agents \+ 1 cross-check agent/);
});

test("the top-right card is request-scoped, source-honest, and absent before a request", () => {
  assert.match(requestCard, /subscribeAsymptaCurrentRequest/);
  assert.match(requestCard, /if \(!request\) return null/);
  assert.match(requestCard, /request\.requestId/);
  assert.match(requestCard, /Cross-checked · source links not verified/);
  assert.match(requestCard, /sourceCount > 0/);
  assert.match(requestCard, /events\.slice\(-3\)/);
  assert.doesNotMatch(requestCard, /__ASYMPTA_DEMO__|resources|Auto Approve|simulation speed/i);
  assert.match(requestCss, /\.asympta-global-console[\s\S]*display: none !important/);
});

test("source-less cross-check status is shown to the user instead of failing silently", () => {
  assert.match(composer, /asympta-intent-result__verification/);
  assert.match(composer, /data-verification=\{response\.result\.verification\.status\}/);
  assert.match(requestCss, /data-verification="not_verified"/);
});
