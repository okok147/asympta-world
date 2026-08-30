import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createAgentMessageState,
  ingestWorkflowMessages,
  listStructuredMessages,
  restoreAgentMessageState,
  serializeAgentMessageState,
  submitStructuredMessage,
} from "../lib/agent-message-state.ts";

test("plain human language is enough to enter the structured agent economy", () => {
  const { state, message } = submitStructuredMessage(
    createAgentMessageState(),
    { body: "I need dinner around 7pm and I do not know which service to use." },
    { workflow: null, worldRevision: 3 },
    1_000,
  );

  assert.equal(message.from.id, "human");
  assert.equal(message.from.kind, "human");
  assert.equal(message.to.id, "agent-user");
  assert.equal(message.to.kind, "agent");
  assert.equal(message.kind, "request");
  assert.equal(message.body, "I need dinner around 7pm and I do not know which service to use.");
  assert.deepEqual(message.semantics.data, {});
  assert.equal(message.worldContext?.worldRevision, 3);
  assert.equal(state.messages.length, 1);
});

test("technical participants can add semantics without changing the human-readable message", () => {
  let state = createAgentMessageState();
  const first = submitStructuredMessage(state, {
    body: "Can supplier B cover 12 units by 17:00?",
    fromId: "agent-business",
    toId: "agent-supplier",
    kind: "question",
    subject: "fallback supply",
    source: "webmcp",
    intent: "request_quote",
    action: "check_capacity",
    entities: ["supplier B", "material-unit"],
    data: { quantity: 12, deadline: "17:00" },
  }, { workflow: "Custom Order Network", worldRevision: 9 }, 2_000);
  state = first.state;

  assert.equal(first.message.body, "Can supplier B cover 12 units by 17:00?");
  assert.equal(first.message.semantics.intent, "request_quote");
  assert.equal(first.message.semantics.action, "check_capacity");
  assert.equal(first.message.semantics.data.quantity, 12);
  assert.equal(listStructuredMessages(state, { participantId: "agent-supplier" }).length, 1);
});

test("workflow bubbles are mirrored into persistent structured communication state without duplicate polling", () => {
  const raw = [{ id: "atlas-1", from: "agent-business", to: "agent-supplier", text: "Please confirm the material window." }];
  const once = ingestWorkflowMessages(createAgentMessageState(), raw, { workflow: "Custom Order Network", worldRevision: 10 }, 3_000);
  const twice = ingestWorkflowMessages(once, raw, { workflow: "Custom Order Network", worldRevision: 11 }, 4_000);

  assert.equal(once.messages.length, 1);
  assert.equal(twice.messages.length, 1);
  assert.equal(twice.messages[0].source, "workflow");
  assert.equal(twice.messages[0].kind, "handoff");
});

test("message state survives serialization and restoration", () => {
  const { state } = submitStructuredMessage(createAgentMessageState(), { body: "Please help me with this order." }, {}, 5_000);
  const restored = restoreAgentMessageState(serializeAgentMessageState(state));
  assert.ok(restored);
  assert.equal(restored.messages.length, 1);
  assert.equal(restored.messages[0].body, "Please help me with this order.");
});

test("camera process follow respects sticky manual off and only task interaction re-arms automatic follow", () => {
  const source = readFileSync(new URL("../components/asympta-process-camera-follow.tsx", import.meta.url), "utf8");
  assert.match(source, /manualFollowLock/);
  assert.match(source, /asymptaCameraFollowManualLock/);
  assert.match(source, /disableProcessLock\(true\)/);
  assert.match(source, /const scheduledTask = element\?\.closest\("\.atlas-safe-task"\)/);
  assert.match(source, /if \(scheduledTask\) clearManualFollowLock\(\)/);
  assert.match(source, /if \(manualFollowLock\) return/);
  assert.match(source, /disableVisibleCameraFollow/);
  assert.match(source, /taskChanged/);
  assert.match(source, /followDropped/);
  assert.match(source, /clickAgent\(nextAgentId\)/);
  assert.match(source, /activeMap\.on\("dragstart", manualMapDrag\)/);
  assert.match(source, /FOLLOW_REFRESH_MS = 450/);
  assert.doesNotMatch(source, /requestAnimationFrame|MutationObserver|preventDefault\(\)|stopPropagation\(\)/);
});

test("WebMCP message tool keeps the lowest-barrier schema: only body is required", () => {
  const source = readFileSync(new URL("../components/asympta-webmcp-tools.tsx", import.meta.url), "utf8");
  assert.match(source, /asympta_send_agent_message/);
  assert.match(source, /asympta_list_agent_messages/);
  assert.match(source, /required: \["body"\]/);
  assert.match(source, /Defaults to agent-user, the personal intent agent/);
  assert.match(source, /human-readable message with optional machine-readable semantics/);
});
