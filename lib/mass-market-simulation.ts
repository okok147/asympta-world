export type StoreStrategy =
  | "penetration"
  | "premium"
  | "inventory-defense"
  | "reputation-first"
  | "relationship"
  | "urgency-surge"
  | "bundle"
  | "anchor-and-concede"
  | "fixed-margin"
  | "adaptive";

export type TrajectoryPhase =
  | "demand"
  | "heard"
  | "bid"
  | "counter"
  | "concession"
  | "deal"
  | "walkaway";

export type MarketTrajectoryStep = {
  phase: TrajectoryPhase;
  actor: string;
  message: string;
  storeId?: string;
  strategy?: StoreStrategy;
  price?: number;
};

export type MarketTrajectory = {
  id: string;
  index: number;
  title: string;
  product: string;
  buyer: string;
  budget: number;
  urgency: number;
  competitors: number;
  winnerStoreId?: string;
  winnerStoreName?: string;
  winnerStrategy?: StoreStrategy;
  finalPrice?: number;
  outcome: "deal" | "walkaway";
  steps: MarketTrajectoryStep[];
};

export type MassMarketSummary = {
  actorCount: number;
  simultaneousAt: number;
  trajectoryCount: number;
  demandCount: number;
  bidCount: number;
  negotiationRounds: number;
  deals: number;
  walkaways: number;
  grossMarketValue: number;
  averageClearingPrice: number;
  strategyWins: Record<StoreStrategy, number>;
};

export type MassMarketSimulation = {
  version: 1;
  seed: number;
  summary: MassMarketSummary;
  trajectories: MarketTrajectory[];
};

type Category = {
  product: string;
  baseCost: number;
  market: string;
};

type BidCandidate = {
  storeId: string;
  storeName: string;
  strategy: StoreStrategy;
  ask: number;
  score: number;
  reputation: number;
  stock: number;
};

export const MARKET_STRATEGIES: StoreStrategy[] = [
  "penetration",
  "premium",
  "inventory-defense",
  "reputation-first",
  "relationship",
  "urgency-surge",
  "bundle",
  "anchor-and-concede",
  "fixed-margin",
  "adaptive",
];

const CATEGORIES: Category[] = [
  { product: "fresh bread", baseCost: 8, market: "food" },
  { product: "coffee", baseCost: 6, market: "food" },
  { product: "grocery pack", baseCost: 18, market: "food" },
  { product: "same-day delivery", baseCost: 24, market: "service" },
  { product: "battery repair", baseCost: 42, market: "repair" },
  { product: "visual concept", baseCost: 58, market: "creative" },
  { product: "brand sprint", baseCost: 86, market: "creative" },
  { product: "automation workflow", baseCost: 74, market: "automation" },
  { product: "research brief", baseCost: 48, market: "research" },
  { product: "focus booth", baseCost: 16, market: "workspace" },
  { product: "learning session", baseCost: 32, market: "learning" },
  { product: "prototype hour", baseCost: 54, market: "maker" },
];

const STORE_NAMES = [
  "Morning Crumb",
  "Grain & Glow",
  "Corner Cafe",
  "Market Grocer",
  "Swift Courier",
  "Pixel Repair",
  "Soft Form Studio",
  "Tiny Print",
  "Loop Lab",
  "Little Learning",
  "Quiet Desk",
  "Neighbour Tool Shelf",
  "Calm Wellness Corner",
  "Neighbour Care Desk",
  "Soft Light Photo Lab",
  "Slow Tea Room",
  "Tiny Maker Bench",
  "Northstar Research",
  "Pixel Studio",
  "Tiny Systems",
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function unit(seed: number, index: number, salt: number) {
  let value = (seed ^ Math.imul(index + 1, 0x45d9f3b) ^ Math.imul(salt + 7, 0x27d4eb2d)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967295;
}

function roundMoney(value: number) {
  return Math.max(1, Math.round(value * 100) / 100);
}

function strategyAsk(
  strategy: StoreStrategy,
  baseCost: number,
  budget: number,
  reputation: number,
  stock: number,
  urgency: number,
  relationship: number,
  pressure: number,
) {
  const floor = baseCost * (0.74 + (1 - stock) * 0.12);
  let multiplier = 1.05;
  if (strategy === "penetration") multiplier = 0.88 - pressure * 0.05;
  else if (strategy === "premium") multiplier = 1.24 + reputation * 0.12;
  else if (strategy === "inventory-defense") multiplier = stock < 0.35 ? 1.26 : 0.98;
  else if (strategy === "reputation-first") multiplier = 0.98 - reputation * 0.08;
  else if (strategy === "relationship") multiplier = 1.01 - relationship * 0.16;
  else if (strategy === "urgency-surge") multiplier = 1.02 + urgency * 0.24;
  else if (strategy === "bundle") multiplier = 0.96 + (1 - pressure) * 0.04;
  else if (strategy === "anchor-and-concede") multiplier = 1.2;
  else if (strategy === "fixed-margin") multiplier = 1.08;
  else if (strategy === "adaptive") multiplier = 1.1 - pressure * 0.14 + urgency * 0.05;

  const budgetPull = budget * (0.68 + reputation * 0.12 + urgency * 0.05);
  return roundMoney(Math.max(floor, baseCost * multiplier * 0.62 + budgetPull * 0.38));
}

function bidScore(
  ask: number,
  budget: number,
  reputation: number,
  stock: number,
  relationship: number,
  urgency: number,
) {
  const affordability = clamp(1 - Math.max(0, ask - budget) / Math.max(1, budget), 0, 1);
  const priceValue = clamp(budget / Math.max(1, ask), 0, 1.25);
  return (
    affordability * 32 +
    priceValue * 21 +
    reputation * 19 +
    stock * 12 +
    relationship * 10 +
    urgency * 6
  );
}

function concessionRate(strategy: StoreStrategy, round: number, pressure: number) {
  if (strategy === "anchor-and-concede") return 0.055 + round * 0.018;
  if (strategy === "premium") return 0.012 + pressure * 0.012;
  if (strategy === "fixed-margin") return 0.008;
  if (strategy === "relationship") return 0.04 + pressure * 0.02;
  if (strategy === "penetration") return 0.022;
  if (strategy === "adaptive") return 0.025 + pressure * 0.025;
  return 0.018 + pressure * 0.018;
}

function candidateFor(
  seed: number,
  actionIndex: number,
  candidateIndex: number,
  category: Category,
  budget: number,
  urgency: number,
  competitorCount: number,
): BidCandidate {
  const storeIndex = (actionIndex * 7 + candidateIndex * 11 + Math.floor(unit(seed, actionIndex, 31) * STORE_NAMES.length)) % STORE_NAMES.length;
  const strategy = MARKET_STRATEGIES[(storeIndex + candidateIndex + actionIndex) % MARKET_STRATEGIES.length];
  const reputation = 0.55 + unit(seed, actionIndex, 40 + candidateIndex) * 0.43;
  const stock = 0.14 + unit(seed, actionIndex, 60 + candidateIndex) * 0.86;
  const relationship = unit(seed, actionIndex, 80 + candidateIndex);
  const pressure = clamp((competitorCount - 2) / 6, 0, 1);
  const ask = strategyAsk(
    strategy,
    category.baseCost,
    budget,
    reputation,
    stock,
    urgency,
    relationship,
    pressure,
  );
  return {
    storeId: "store-" + String(storeIndex + 1),
    storeName: STORE_NAMES[storeIndex],
    strategy,
    ask,
    score: bidScore(ask, budget, reputation, stock, relationship, urgency),
    reputation,
    stock,
  };
}

function buildTrajectory(
  seed: number,
  index: number,
  category: Category,
  buyer: string,
  budget: number,
  urgency: number,
  bids: BidCandidate[],
  winner: BidCandidate,
  rounds: number,
  finalPrice: number,
  outcome: "deal" | "walkaway",
): MarketTrajectory {
  const steps: MarketTrajectoryStep[] = [
    {
      phase: "demand",
      actor: buyer,
      message:
        buyer + " broadcasts demand for " + category.product +
        " with a ceiling of ₡" + budget.toFixed(0) + ".",
    },
  ];

  bids.forEach((bid) => {
    steps.push({
      phase: "heard",
      actor: bid.storeName + " Store Agent",
      storeId: bid.storeId,
      strategy: bid.strategy,
      message:
        bid.storeName + " hears the demand signal and evaluates stock, reputation, urgency and competitive pressure.",
    });
    steps.push({
      phase: "bid",
      actor: bid.storeName + " Store Agent",
      storeId: bid.storeId,
      strategy: bid.strategy,
      price: bid.ask,
      message:
        bid.storeName + " bids ₡" + bid.ask.toFixed(2) +
        " using " + bid.strategy + " strategy.",
    });
  });

  let current = winner.ask;
  for (let round = 1; round <= rounds; round += 1) {
    const buyerTarget = budget * (0.79 + urgency * 0.12 + round * 0.025);
    steps.push({
      phase: "counter",
      actor: buyer,
      storeId: winner.storeId,
      price: roundMoney(buyerTarget),
      message:
        buyer + " counters at ₡" + roundMoney(buyerTarget).toFixed(2) +
        " after comparing competing offers.",
    });
    const rate = concessionRate(
      winner.strategy,
      round,
      clamp((bids.length - 2) / 6, 0, 1),
    );
    current = roundMoney(Math.max(category.baseCost * 0.78, current * (1 - rate)));
    steps.push({
      phase: "concession",
      actor: winner.storeName + " Store Agent",
      storeId: winner.storeId,
      strategy: winner.strategy,
      price: current,
      message:
        winner.storeName + " responds at ₡" + current.toFixed(2) +
        "; strategy remains " + winner.strategy + ".",
    });
  }

  steps.push(
    outcome === "deal"
      ? {
          phase: "deal",
          actor: buyer + " + " + winner.storeName,
          storeId: winner.storeId,
          strategy: winner.strategy,
          price: finalPrice,
          message:
            "Deal clears at ₡" + finalPrice.toFixed(2) +
            ". Inventory, revenue and reputation signals update.",
        }
      : {
          phase: "walkaway",
          actor: buyer,
          storeId: winner.storeId,
          strategy: winner.strategy,
          price: finalPrice,
          message:
            "No agreement clears the buyer threshold. The buyer walks away and stores remember the lost demand signal.",
        },
  );

  return {
    id: "trajectory-" + String(index + 1).padStart(3, "0"),
    index,
    title: category.product + " · " + winner.strategy,
    product: category.product,
    buyer,
    budget,
    urgency,
    competitors: bids.length,
    winnerStoreId: winner.storeId,
    winnerStoreName: winner.storeName,
    winnerStrategy: winner.strategy,
    finalPrice,
    outcome,
    steps,
  };
}

function emptyStrategyWins(): Record<StoreStrategy, number> {
  return Object.fromEntries(
    MARKET_STRATEGIES.map((strategy) => [strategy, 0]),
  ) as Record<StoreStrategy, number>;
}

export function runMassMarketStress(
  actorCount = 100_000,
  trajectoryCount = 100,
  seed = 20260827,
): MassMarketSimulation {
  const actors = Math.max(1, Math.floor(actorCount));
  const trajectoriesRequested = clamp(Math.floor(trajectoryCount), 1, Math.min(actors, 500));
  const strategyWins = emptyStrategyWins();
  const trajectories: MarketTrajectory[] = [];
  let bidCount = 0;
  let negotiationRounds = 0;
  let deals = 0;
  let walkaways = 0;
  let grossMarketValue = 0;

  for (let actionIndex = 0; actionIndex < actors; actionIndex += 1) {
    const category = CATEGORIES[(actionIndex + Math.floor(unit(seed, actionIndex, 2) * CATEGORIES.length)) % CATEGORIES.length];
    const urgency = 0.08 + unit(seed, actionIndex, 3) * 0.92;
    const budget = roundMoney(
      category.baseCost * (1.04 + unit(seed, actionIndex, 4) * 1.45 + urgency * 0.22),
    );
    const competitorCount = 3 + Math.floor(unit(seed, actionIndex, 5) * 5);
    const detailedBids: BidCandidate[] = [];
    let best: BidCandidate | null = null;
    let second: BidCandidate | null = null;

    for (let candidateIndex = 0; candidateIndex < competitorCount; candidateIndex += 1) {
      const candidate = candidateFor(
        seed,
        actionIndex,
        candidateIndex,
        category,
        budget,
        urgency,
        competitorCount,
      );
      bidCount += 1;
      if (actionIndex < trajectoriesRequested) detailedBids.push(candidate);
      if (!best || candidate.score > best.score) {
        second = best;
        best = candidate;
      } else if (!second || candidate.score > second.score) {
        second = candidate;
      }
    }

    if (!best) continue;
    const pressure = second
      ? clamp(1 - Math.abs(best.score - second.score) / 35, 0, 1)
      : 0.25;
    const priceGap = Math.max(0, best.ask - budget) / Math.max(1, budget);
    const rounds = 1 + Math.min(3, Math.floor(priceGap * 8 + pressure * 2 + unit(seed, actionIndex, 7) * 1.8));
    negotiationRounds += rounds;

    let finalPrice = best.ask;
    for (let round = 1; round <= rounds; round += 1) {
      finalPrice = roundMoney(
        finalPrice * (1 - concessionRate(best.strategy, round, pressure)),
      );
    }

    const buyerTolerance = budget * (0.96 + urgency * 0.12);
    const outcome: "deal" | "walkaway" =
      finalPrice <= buyerTolerance && best.score >= 45 ? "deal" : "walkaway";

    if (outcome === "deal") {
      deals += 1;
      grossMarketValue += finalPrice;
      strategyWins[best.strategy] += 1;
    } else {
      walkaways += 1;
    }

    if (actionIndex < trajectoriesRequested) {
      trajectories.push(
        buildTrajectory(
          seed,
          actionIndex,
          category,
          "Buyer " + String(actionIndex + 1),
          budget,
          urgency,
          detailedBids,
          best,
          rounds,
          finalPrice,
          outcome,
        ),
      );
    }
  }

  return {
    version: 1,
    seed,
    summary: {
      actorCount: actors,
      simultaneousAt: seed,
      trajectoryCount: trajectories.length,
      demandCount: actors,
      bidCount,
      negotiationRounds,
      deals,
      walkaways,
      grossMarketValue: roundMoney(grossMarketValue),
      averageClearingPrice: deals > 0 ? roundMoney(grossMarketValue / deals) : 0,
      strategyWins,
    },
    trajectories,
  };
}
