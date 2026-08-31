import assert from "node:assert/strict";
import test from "node:test";

import {
  inferUnsafeProposalMissingFields,
  isRecoverableUnsafeProposal,
  unsafeProposalRecoveryPrompt,
} from "../lib/asympta-unsafe-proposal-recovery.ts";

test("unsafe action validation errors become recoverable clarification states", () => {
  assert.equal(isRecoverableUnsafeProposal("The action proposal was unsafe."), true);
  assert.equal(isRecoverableUnsafeProposal("The action proposal contained invalid fields."), true);
  assert.equal(isRecoverableUnsafeProposal("The agent returned an invalid goal."), true);
  assert.equal(isRecoverableUnsafeProposal("A network request failed."), false);
});

test("purchase recovery is generic and television only adds its useful size field", () => {
  assert.deepEqual(
    inferUnsafeProposalMissingFields("Buy a television"),
    ["screen size", "budget", "brand preference", "purchase location", "fulfilment"],
  );
  assert.deepEqual(
    inferUnsafeProposalMissingFields("Buy a desk chair"),
    ["budget", "quantity", "fulfilment", "purchase location", "deadline"],
  );
});

test("confirmed fields are removed so recovery progresses instead of asking the same question again", () => {
  const intent = [
    "Buy a television",
    "User-confirmed details: screen size: 55″; budget: Best value / balanced.",
  ].join("\n\n");
  assert.deepEqual(
    inferUnsafeProposalMissingFields(intent),
    ["brand preference", "purchase location", "fulfilment"],
  );
});

test("other action families recover without television-specific logic", () => {
  assert.deepEqual(inferUnsafeProposalMissingFields("Book a haircut"), ["deadline", "quantity", "location", "confirmation"]);
  assert.deepEqual(inferUnsafeProposalMissingFields("Email the supplier"), ["recipient", "purpose", "deadline", "confirmation"]);
  assert.deepEqual(inferUnsafeProposalMissingFields("Delete the draft"), ["confirmation"]);
  assert.deepEqual(inferUnsafeProposalMissingFields("Repair my air conditioner"), ["budget", "deadline", "location", "confirmation"]);
});

test("recovery prompt is localized", () => {
  assert.match(unsafeProposalRecoveryPrompt("en"), /same task/i);
  assert.match(unsafeProposalRecoveryPrompt("zh-Hant"), /同一任務/);
  assert.match(unsafeProposalRecoveryPrompt("ja"), /同じタスク/);
});
