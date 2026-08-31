import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { marketplaceSimulatedQuote } from "../lib/asympta-marketplace-offer.ts";

test("simulated marketplace quote is deterministic and exposes a payable total", () => {
  const first = marketplaceSimulatedQuote("food", "ready-to-eat meal", 1);
  const second = marketplaceSimulatedQuote("food", "ready-to-eat meal", 1);

  assert.deepEqual(first, second);
  assert.equal(first.currency, "JPY");
  assert.equal(first.unitAmount, 1_280);
  assert.equal(first.totalAmount, 1_280);
  assert.equal(first.provenance, "simulated");
});

test("pending marketplace payment renders explicit confirm and decline controls", async () => {
  const [page, approvalUi] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/asympta-marketplace-payment-approval.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /AsymptaMarketplacePaymentApproval/);
  assert.match(approvalUi, /authorize_payment/);
  assert.match(approvalUi, /pendingMarketplacePayment/);
  assert.match(approvalUi, /\.approve\(pending\.id, approved\)/);
  assert.match(approvalUi, /Confirm \$\{amount\}/);
  assert.match(approvalUi, /Decline/);
  assert.match(approvalUi, /Simulation only/);
  assert.doesNotMatch(approvalUi, /runIntent\(/);
});
