export type MarketplaceSimulatedQuote = {
  currency: "JPY";
  unitAmount: number;
  totalAmount: number;
  quantity: number;
  provenance: "simulated";
};

function normalizedQuantity(quantity: number) {
  if (!Number.isFinite(quantity)) return 1;
  return Math.max(1, Math.min(99, Math.trunc(quantity)));
}

function simulatedUnitAmount(domain: string, itemLabel: string) {
  const label = itemLabel.trim().toLocaleLowerCase();

  if (domain === "food") {
    if (/cola|coke|soda|soft drink|energy drink|sports drink|juice/.test(label)) return 280;
    if (/chips|crisps|gum/.test(label)) return 320;
    if (/ice cream/.test(label)) return 480;
    if (/meal|dinner|lunch|food|ready-to-eat/.test(label)) return 1_280;
    return 980;
  }

  if (domain === "clothing") {
    if (/shirt|tee|t-shirt/.test(label)) return 3_800;
    if (/jacket|coat/.test(label)) return 8_800;
    return 4_800;
  }

  return 1_200;
}

/**
 * Deterministic demo quote used only by the simulated marketplace.
 * It intentionally contains no real merchant, card, or settlement data.
 */
export function marketplaceSimulatedQuote(
  domain: string,
  itemLabel: string,
  quantity: number,
): MarketplaceSimulatedQuote {
  const safeQuantity = normalizedQuantity(quantity);
  const unitAmount = simulatedUnitAmount(domain, itemLabel);
  return {
    currency: "JPY",
    unitAmount,
    totalAmount: unitAmount * safeQuantity,
    quantity: safeQuantity,
    provenance: "simulated",
  };
}
