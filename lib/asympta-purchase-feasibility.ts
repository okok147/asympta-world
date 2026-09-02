export type PurchaseFeasibilityStatus =
  | "eligible_for_further_review"
  | "needs_funds_evidence"
  | "insufficient_funds";

export type PurchaseFeasibility = {
  requestedAsset: string;
  assetClass: "rail_vehicle";
  status: PurchaseFeasibilityStatus;
  canProceed: boolean;
  availableFundsJPY: number | null;
  minimumProofOfFundsJPY: number;
  reason: string;
  nextRequirements: string[];
  provenance: "real_world_feasibility_policy";
  priceBasis: "conservative_preflight_floor_not_quote";
};

const PURCHASE_ACTION = /\b(?:buy|purchase|order|get\s+me|acquire)\b|幫我買|帮我买|想買|想买|要買|要买|購入|買いたい/iu;
const RAIL_VEHICLE = /\b(?:train|locomotive|railcar|rail\s+car|metro\s+train|subway\s+train)\b|列車|列车|火車|火车|機関車|電車/iu;

// This is deliberately a conservative proof-of-funds floor, not a claim that a
// train costs exactly this amount. A real rolling-stock acquisition must still
// discover a seller, an exact vehicle, operating/storage arrangements, legal
// constraints, delivery logistics and a verified quote before any commitment.
const RAIL_VEHICLE_MINIMUM_PROOF_OF_FUNDS_JPY = 100_000_000;

export function evaluatePurchaseFeasibility(intent: string, availableFundsJPY: number | null): PurchaseFeasibility | null {
  const clean = intent.trim();
  if (!PURCHASE_ACTION.test(clean) || !RAIL_VEHICLE.test(clean)) return null;

  const common = {
    requestedAsset: "train / rolling stock",
    assetClass: "rail_vehicle" as const,
    availableFundsJPY: Number.isFinite(availableFundsJPY) ? Math.max(0, Number(availableFundsJPY)) : null,
    minimumProofOfFundsJPY: RAIL_VEHICLE_MINIMUM_PROOF_OF_FUNDS_JPY,
    nextRequirements: [
      "proof of funds",
      "exact rolling-stock product or vehicle",
      "real seller or specialist market",
      "legal and operating eligibility",
      "storage / track / transport plan",
      "verified quote before commitment",
    ],
    provenance: "real_world_feasibility_policy" as const,
    priceBasis: "conservative_preflight_floor_not_quote" as const,
  };

  if (common.availableFundsJPY == null) {
    return {
      ...common,
      status: "needs_funds_evidence",
      canProceed: false,
      reason: "A train is a major rolling-stock acquisition. Asympta needs credible proof of funds before spending agent effort on a specialist market search.",
    };
  }

  if (common.availableFundsJPY < RAIL_VEHICLE_MINIMUM_PROOF_OF_FUNDS_JPY) {
    return {
      ...common,
      status: "insufficient_funds",
      canProceed: false,
      reason: `Available simulated funds are JPY ${Math.round(common.availableFundsJPY).toLocaleString("en-US")}; this does not meet the conservative JPY ${RAIL_VEHICLE_MINIMUM_PROOF_OF_FUNDS_JPY.toLocaleString("en-US")} proof-of-funds floor for starting a rolling-stock acquisition process.`,
    };
  }

  return {
    ...common,
    status: "eligible_for_further_review",
    canProceed: true,
    reason: "The proof-of-funds preflight is sufficient to continue into exact-product, seller, legal, infrastructure and verified-quote checks. It is not purchase approval.",
  };
}

export function userFundsFromWorldSnapshot(snapshot: unknown): number | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const root = snapshot as Record<string, unknown>;
  const foreground = root.foreground && typeof root.foreground === "object" ? root.foreground as Record<string, unknown> : root;
  const runtime = foreground.runtime && typeof foreground.runtime === "object" ? foreground.runtime as Record<string, unknown> : null;
  const accounts = Array.isArray(runtime?.accounts) ? runtime.accounts : [];
  const records = accounts.filter((value): value is Record<string, unknown> => Boolean(value && typeof value === "object"));
  const preferred = records.find((account) => account.ownerId === "agent-user")
    ?? records.find((account) => account.ownerId === "agent-customer");
  const balance = Number(preferred?.balance);
  return Number.isFinite(balance) ? Math.max(0, balance) : null;
}
