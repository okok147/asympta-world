import assert from "node:assert/strict";
import test from "node:test";

import {
  ASYMPTA_WEBMCP_REQUEST_LIMIT,
  createWebMcpRequestState,
  readWebMcpRequest,
  restoreWebMcpRequestState,
  serializeWebMcpRequestState,
  submitWebMcpRequest,
  updateWebMcpRequest,
} from "../lib/asympta-webmcp-request-state.ts";

test("WebMCP submit creates an ID-scoped request that waits for human review", () => {
  const submitted = submitWebMcpRequest(
    createWebMcpRequestState(),
    "  Check today's weather in Hong Kong.  ",
    1_000,
  );

  assert.match(submitted.request.requestId, /^request-[a-z0-9-]{8,100}$/);
  assert.equal(submitted.request.intent, "Check today's weather in Hong Kong.");
  assert.equal(submitted.request.status, "pending_human_review");
  assert.equal(submitted.request.source, "webmcp");
  assert.deepEqual(readWebMcpRequest(submitted.state, submitted.request.requestId), submitted.request);
  assert.equal(readWebMcpRequest(submitted.state, "request-does-not-exist"), null);
});

test("WebMCP request storage is bounded and survives safe serialization", () => {
  let state = createWebMcpRequestState();
  const ids = [];
  for (let index = 0; index < ASYMPTA_WEBMCP_REQUEST_LIMIT + 5; index += 1) {
    const submitted = submitWebMcpRequest(state, `Request number ${index}`, 2_000 + index);
    state = submitted.state;
    ids.push(submitted.request.requestId);
  }

  assert.equal(state.requests.length, ASYMPTA_WEBMCP_REQUEST_LIMIT);
  assert.equal(readWebMcpRequest(state, ids[0]), null);
  assert.equal(readWebMcpRequest(state, ids.at(-1))?.intent, `Request number ${ASYMPTA_WEBMCP_REQUEST_LIMIT + 4}`);
  assert.deepEqual(restoreWebMcpRequestState(serializeWebMcpRequestState(state)), state);
});

test("WebMCP request storage refuses credentials and discards unsafe restored records", () => {
  assert.throws(
    () => submitWebMcpRequest(createWebMcpRequestState(), "x".repeat(601), 3_000),
    /at most 600 characters/,
  );
  assert.throws(
    () => submitWebMcpRequest(createWebMcpRequestState(), `Use api_key=${"x".repeat(32)} for this request`, 3_000),
    /Remove passwords, API keys and other credentials/,
  );
  assert.throws(
    () => submitWebMcpRequest(createWebMcpRequestState(), `Use sk-or-v1-${"a".repeat(48)} for this request`, 3_000),
    /Remove passwords, API keys and other credentials/,
  );

  const restored = restoreWebMcpRequestState(JSON.stringify({
    schema: "asympta-webmcp-requests",
    version: 1,
    revision: 2,
    requests: [
      {
        requestId: "request-safe-record-1234",
        intent: "Read the current weather.",
        status: "pending_human_review",
        source: "webmcp",
        createdAt: 1,
        updatedAt: 1,
      },
      {
        requestId: "request-unsafe-record-1234",
        intent: `Authorization: Bearer ${"z".repeat(40)}`,
        status: "pending_human_review",
        source: "webmcp",
        createdAt: 2,
        updatedAt: 2,
      },
    ],
  }));
  assert.ok(restored);
  assert.deepEqual(restored.requests.map((request) => request.requestId), ["request-safe-record-1234"]);
});

test("WebMCP request status updates remain scoped to the exact request ID", () => {
  const first = submitWebMcpRequest(createWebMcpRequestState(), "Find today's weather.", 4_000);
  const second = submitWebMcpRequest(first.state, "Find tomorrow's weather.", 4_001);
  const updated = updateWebMcpRequest(second.state, first.request.requestId, {
    status: "completed",
    resultSummary: "Weather returned after human review.",
  }, 4_100);

  assert.ok(updated);
  assert.equal(readWebMcpRequest(updated.state, first.request.requestId)?.status, "completed");
  assert.equal(readWebMcpRequest(updated.state, second.request.requestId)?.status, "pending_human_review");
  assert.equal(updateWebMcpRequest(updated.state, "request-does-not-exist", { status: "failed" }, 4_200), null);
  assert.throws(
    () => updateWebMcpRequest(updated.state, first.request.requestId, {
      status: "completed",
      resultSummary: `token=${"q".repeat(32)}`,
    }, 4_300),
    /Credentials cannot be stored/,
  );
});

test("WebMCP request reads preserve waiting states instead of reporting completion", () => {
  const submitted = submitWebMcpRequest(createWebMcpRequestState(), "Prepare an action proposal.", 5_000);
  const awaiting = updateWebMcpRequest(submitted.state, submitted.request.requestId, {
    status: "awaiting_confirmation",
    resultSummary: "The proposal still needs human approval.",
  }, 5_100);
  assert.equal(readWebMcpRequest(awaiting.state, submitted.request.requestId)?.status, "awaiting_confirmation");

  const clarification = updateWebMcpRequest(awaiting.state, submitted.request.requestId, {
    status: "needs_clarification",
    resultSummary: "The location is still required.",
  }, 5_200);
  assert.equal(readWebMcpRequest(clarification.state, submitted.request.requestId)?.status, "needs_clarification");
});
