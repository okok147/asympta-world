export type CityBusinessKind =
  | "cafe"
  | "grocery"
  | "bakery"
  | "repair"
  | "design"
  | "print"
  | "courier"
  | "learning"
  | "coworking"
  | "automation";

export type CityActionId =
  | "browse_products"
  | "check_stock"
  | "buy_product"
  | "book_service"
  | "request_quote"
  | "sell_resource"
  | "deliver"
  | "inquire";

export type CityNeed =
  | "meal"
  | "groceries"
  | "repair"
  | "design"
  | "print"
  | "delivery"
  | "learning"
  | "workspace"
  | "automation"
  | "rest";

export type CityAgentStatus = "idle" | "walking" | "interacting" | "working";
export type CityAvatar = "human" | "cat" | "fox" | "rabbit" | "bear";

export type CityProduct = {
  id: string;
  name: string;
  price: number;
  stock: number;
  maxStock: number;
  tags: string[];
};

export type CityService = {
  id: string;
  name: string;
  price: number;
  minutes: number;
  slots: number;
  maxSlots: number;
  tags: string[];
};

export type CityBusiness = {
  id: string;
  name: string;
  kind: CityBusinessKind;
  x: number;
  y: number;
  seed: number;
  reputation: number;
  treasury: number;
  products: CityProduct[];
  services: CityService[];
  actions: CityActionId[];
};

export type CityAgentMemory = {
  businessId: string;
  visits: number;
  spent: number;
  satisfaction: number;
};

export type CityAgentTraits = {
  thrift: number;
  quality: number;
  curiosity: number;
  sociability: number;
  patience: number;
};

export type CityAgentThought = {
  label: string;
  kind: "food" | "deal" | "service" | "resource" | "work" | "search" | "status";
  until: number;
};

export type CityAgent = {
  id: string;
  name: string;
  ownerId: string;
  ownerLabel: string;
  avatar: CityAvatar;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;
  wallet: number;
  energy: number;
  hunger: number;
  resources: number;
  inventory: Record<string, number>;
  traits: CityAgentTraits;
  preferredKinds: CityBusinessKind[];
  missionNeed: CityNeed;
  ownerGoal: string;
  status: CityAgentStatus;
  targetBusinessId?: string;
  currentNeed?: CityNeed;
  interactionUntil?: number;
  pendingAction?: CityActionId;
  nextDecisionAt: number;
  thought?: CityAgentThought;
  memory: CityAgentMemory[];
};

export type CityTransaction = {
  id: string;
  at: number;
  agentId: string;
  ownerId: string;
  businessId: string;
  action: CityActionId;
  itemId?: string;
  quantity?: number;
  credits: number;
  summary: string;
};

export type LatentCityState = {
  version: 1;
  worldTime: number;
  externalCredits: number;
  businesses: CityBusiness[];
  agents: CityAgent[];
  transactions: CityTransaction[];
};

export type CityActionInput = {
  businessId: string;
  action: CityActionId;
  agentId?: string;
  itemId?: string;
  quantity?: number;
  note?: string;
};

export type CityActionResult = {
  ok: boolean;
  state: LatentCityState;
  summary: string;
  credits?: number;
  stock?: number;
  quote?: number;
};

const NAMES = [
  "Milo", "Nori", "Pip", "Lumi", "Taro", "Mina", "Kiko", "Nana", "Rin", "Sora",
  "Ari", "Momo", "Kai", "Yuki", "Noa", "Coco", "Theo", "Fia", "Remy", "Eli",
  "Uma", "Leo", "Ivy", "Bo", "Mika",
];

const AVATARS: CityAvatar[] = ["human", "cat", "fox", "rabbit", "bear"];
const NEEDS: CityNeed[] = [
  "meal",
  "groceries",
  "repair",
  "design",
  "print",
  "delivery",
  "learning",
  "workspace",
  "automation",
];

const NEED_LABEL: Record<CityNeed, string> = {
  meal: "找食物",
  groceries: "買日用品",
  repair: "找維修",
  design: "找設計",
  print: "找印刷",
  delivery: "安排配送",
  learning: "學技能",
  workspace: "找工作位",
  automation: "找自動化",
  rest: "休息",
};

const BUSINESS_NEEDS: Record<CityBusinessKind, CityNeed[]> = {
  cafe: ["meal", "rest"],
  grocery: ["groceries", "meal"],
  bakery: ["meal", "rest"],
  repair: ["repair"],
  design: ["design"],
  print: ["print", "design"],
  courier: ["delivery"],
  learning: ["learning"],
  coworking: ["workspace", "rest"],
  automation: ["automation"],
};

function hash(value: string) {
  let h = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    h ^= value.charCodeAt(index);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function random01(seed: string) {
  const value = hash(seed);
  return ((value ^ (value >>> 15)) >>> 0) / 4294967295;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function product(
  id: string,
  name: string,
  price: number,
  stock: number,
  tags: string[],
): CityProduct {
  return { id, name, price, stock, maxStock: stock, tags };
}

function service(
  id: string,
  name: string,
  price: number,
  minutes: number,
  slots: number,
  tags: string[],
): CityService {
  return { id, name, price, minutes, slots, maxSlots: slots, tags };
}

export function seedCityBusinesses(): CityBusiness[] {
  return [
    {
      id: "corner-cafe",
      name: "Corner Cafe",
      kind: "cafe",
      x: 155,
      y: 180,
      seed: 11,
      reputation: 82,
      treasury: 420,
      products: [
        product("coffee", "Coffee", 8, 28, ["food", "drink", "energy"]),
        product("tea", "Tea", 7, 24, ["food", "drink"]),
        product("sandwich", "Sandwich", 14, 18, ["food", "meal"]),
      ],
      services: [service("catering", "Small catering", 68, 60, 5, ["food", "event"])],
      actions: ["browse_products", "check_stock", "buy_product", "book_service", "inquire"],
    },
    {
      id: "market-grocer",
      name: "Market Grocer",
      kind: "grocery",
      x: 405,
      y: 120,
      seed: 23,
      reputation: 76,
      treasury: 680,
      products: [
        product("fruit-box", "Fruit box", 12, 24, ["food", "grocery"]),
        product("rice-pack", "Rice pack", 15, 20, ["food", "grocery"]),
        product("daily-kit", "Daily kit", 22, 16, ["grocery", "resource"]),
      ],
      services: [service("weekly-basket", "Weekly basket", 54, 15, 8, ["grocery", "delivery"])],
      actions: ["browse_products", "check_stock", "buy_product", "book_service", "sell_resource", "inquire"],
    },
    {
      id: "hearth-bakery",
      name: "Hearth Bakery",
      kind: "bakery",
      x: 735,
      y: 150,
      seed: 37,
      reputation: 88,
      treasury: 510,
      products: [
        product("milk-bun", "Milk bun", 6, 26, ["food", "meal"]),
        product("bread-loaf", "Bread loaf", 11, 20, ["food", "grocery"]),
        product("cake-slice", "Cake slice", 9, 16, ["food", "treat"]),
      ],
      services: [service("custom-cake", "Custom cake", 58, 120, 4, ["food", "event"])],
      actions: ["browse_products", "check_stock", "buy_product", "book_service", "request_quote", "inquire"],
    },
    {
      id: "pixel-repair",
      name: "Pixel Repair",
      kind: "repair",
      x: 1015,
      y: 205,
      seed: 41,
      reputation: 84,
      treasury: 720,
      products: [product("cable-kit", "Cable kit", 16, 18, ["repair", "resource"])],
      services: [
        service("diagnostic", "Device diagnostic", 18, 20, 10, ["repair"]),
        service("battery-fix", "Battery fix", 42, 45, 7, ["repair"]),
        service("screen-fix", "Screen repair", 72, 90, 5, ["repair"]),
      ],
      actions: ["browse_products", "check_stock", "buy_product", "book_service", "request_quote", "inquire"],
    },
    {
      id: "soft-form-studio",
      name: "Soft Form Studio",
      kind: "design",
      x: 230,
      y: 420,
      seed: 53,
      reputation: 91,
      treasury: 980,
      products: [product("icon-pack", "Icon pack", 34, 12, ["design", "digital"])],
      services: [
        service("visual-concept", "Visual concept", 76, 120, 5, ["design"]),
        service("brand-sprint", "Brand sprint", 132, 180, 3, ["design", "branding"]),
      ],
      actions: ["browse_products", "buy_product", "book_service", "request_quote", "inquire"],
    },
    {
      id: "tiny-print",
      name: "Tiny Print",
      kind: "print",
      x: 520,
      y: 365,
      seed: 67,
      reputation: 79,
      treasury: 610,
      products: [
        product("posters-10", "10 posters", 18, 20, ["print"]),
        product("cards-50", "50 cards", 24, 18, ["print"]),
      ],
      services: [service("rush-print", "Rush print", 36, 45, 7, ["print", "delivery"])],
      actions: ["browse_products", "check_stock", "buy_product", "book_service", "request_quote", "inquire"],
    },
    {
      id: "swift-courier",
      name: "Swift Courier",
      kind: "courier",
      x: 850,
      y: 370,
      seed: 71,
      reputation: 81,
      treasury: 740,
      products: [product("parcel-kit", "Parcel kit", 6, 30, ["delivery", "resource"])],
      services: [
        service("local-delivery", "Local delivery", 16, 35, 12, ["delivery"]),
        service("same-day", "Same-day delivery", 28, 60, 6, ["delivery"]),
      ],
      actions: ["browse_products", "buy_product", "book_service", "deliver", "request_quote", "inquire"],
    },
    {
      id: "little-learning",
      name: "Little Learning",
      kind: "learning",
      x: 1040,
      y: 515,
      seed: 83,
      reputation: 86,
      treasury: 560,
      products: [product("workbook", "Practice workbook", 12, 22, ["learning"] )],
      services: [
        service("skill-session", "Skill session", 32, 50, 8, ["learning"]),
        service("mentor-hour", "Mentor hour", 48, 60, 5, ["learning"]),
      ],
      actions: ["browse_products", "buy_product", "book_service", "request_quote", "inquire"],
    },
    {
      id: "quiet-desk",
      name: "Quiet Desk",
      kind: "coworking",
      x: 390,
      y: 620,
      seed: 97,
      reputation: 78,
      treasury: 830,
      products: [product("day-pass", "Desk day pass", 18, 28, ["workspace"] )],
      services: [
        service("focus-booth", "Focus booth", 12, 60, 9, ["workspace", "rest"]),
        service("meeting-room", "Meeting room", 34, 60, 5, ["workspace"]),
      ],
      actions: ["browse_products", "check_stock", "buy_product", "book_service", "inquire"],
    },
    {
      id: "loop-lab",
      name: "Loop Lab",
      kind: "automation",
      x: 760,
      y: 610,
      seed: 109,
      reputation: 89,
      treasury: 1100,
      products: [product("template-pack", "Workflow templates", 28, 16, ["automation", "digital"] )],
      services: [
        service("automation-audit", "Automation audit", 56, 70, 6, ["automation"]),
        service("small-workflow", "Small workflow", 118, 150, 4, ["automation"]),
      ],
      actions: ["browse_products", "buy_product", "book_service", "request_quote", "inquire"],
    },
  ];
}

function preferredKinds(index: number): CityBusinessKind[] {
  const all: CityBusinessKind[] = [
    "cafe",
    "grocery",
    "bakery",
    "repair",
    "design",
    "print",
    "courier",
    "learning",
    "coworking",
    "automation",
  ];
  return [all[index % all.length], all[(index * 3 + 4) % all.length]];
}

export function seedCityAgents(now = Date.now(), count = 100): CityAgent[] {
  return Array.from({ length: count }, (_, index) => {
    const id = "city-agent-" + String(index + 1).padStart(3, "0");
    const missionNeed = NEEDS[index % NEEDS.length];
    const x = 80 + random01(id + ":x") * 1040;
    const y = 75 + random01(id + ":y") * 610;
    const name = NAMES[index % NAMES.length] + " " + String(Math.floor(index / NAMES.length) + 1);
    return {
      id,
      name,
      ownerId: "resident-user-" + String(index + 1).padStart(3, "0"),
      ownerLabel: "Resident " + String(index + 1).padStart(3, "0"),
      avatar: AVATARS[index % AVATARS.length],
      x,
      y,
      targetX: x,
      targetY: y,
      speed: 18 + random01(id + ":speed") * 18,
      wallet: Math.round(90 + random01(id + ":wallet") * 230),
      energy: Math.round(45 + random01(id + ":energy") * 50),
      hunger: Math.round(15 + random01(id + ":hunger") * 70),
      resources: Math.floor(random01(id + ":resource") * 4),
      inventory: {},
      traits: {
        thrift: random01(id + ":thrift"),
        quality: random01(id + ":quality"),
        curiosity: random01(id + ":curiosity"),
        sociability: random01(id + ":social"),
        patience: random01(id + ":patience"),
      },
      preferredKinds: preferredKinds(index),
      missionNeed,
      ownerGoal: NEED_LABEL[missionNeed],
      status: "idle",
      nextDecisionAt: now + 500 + random01(id + ":decision") * 6000,
      memory: [],
    } satisfies CityAgent;
  });
}

export function seedLatentCity(now = Date.now(), agentCount = 100): LatentCityState {
  return {
    version: 1,
    worldTime: now,
    externalCredits: 500,
    businesses: seedCityBusinesses(),
    agents: seedCityAgents(now, agentCount),
    transactions: [],
  };
}

export function deriveAgentNeed(agent: CityAgent): CityNeed {
  if (agent.hunger >= 62) return "meal";
  if (agent.energy <= 24) return "rest";
  return agent.missionNeed;
}

export function businessAveragePrice(business: CityBusiness) {
  const prices = [
    ...business.products.map((item) => item.price),
    ...business.services.map((item) => item.price),
  ];
  if (prices.length === 0) return 0;
  return prices.reduce((total, value) => total + value, 0) / prices.length;
}

export function chooseBusinessForAgent(
  businesses: CityBusiness[],
  agent: CityAgent,
  need: CityNeed,
): CityBusiness | undefined {
  const candidates = businesses.filter((business) => BUSINESS_NEEDS[business.kind].includes(need));
  const pool = candidates.length > 0 ? candidates : businesses;
  return pool
    .map((business) => {
      const distance = Math.hypot(business.x - agent.x, business.y - agent.y);
      const memory = agent.memory.find((entry) => entry.businessId === business.id);
      const preference = agent.preferredKinds.includes(business.kind) ? 18 : 0;
      const quality = business.reputation * (0.3 + agent.traits.quality * 0.7);
      const thriftPenalty = businessAveragePrice(business) * agent.traits.thrift * 0.55;
      const distancePenalty = distance * (0.018 + (1 - agent.traits.patience) * 0.012);
      const familiarity = memory ? memory.satisfaction * 0.14 + Math.min(12, memory.visits * 1.6) : 0;
      const curiosity = memory ? 0 : agent.traits.curiosity * 9;
      return {
        business,
        score: preference + quality + familiarity + curiosity - thriftPenalty - distancePenalty,
      };
    })
    .sort((a, b) => b.score - a.score)[0]?.business;
}

export function needDialogue(need: CityNeed) {
  return NEED_LABEL[need];
}

export function listBusinessActions(business: CityBusiness) {
  return business.actions.map((action) => ({
    action,
    label:
      action === "browse_products"
        ? "瀏覽商品"
        : action === "check_stock"
          ? "查看庫存"
          : action === "buy_product"
            ? "購買商品"
            : action === "book_service"
              ? "預約服務"
              : action === "request_quote"
                ? "取得報價"
                : action === "sell_resource"
                  ? "出售資源"
                  : action === "deliver"
                    ? "配送"
                    : "詢問",
  }));
}

export function searchCityBusinesses(
  state: LatentCityState,
  query = "",
  kind?: CityBusinessKind,
) {
  const clean = query.trim().toLowerCase();
  return state.businesses
    .filter((business) => !kind || business.kind === kind)
    .filter((business) => {
      if (!clean) return true;
      const haystack = [
        business.name,
        business.kind,
        ...business.products.flatMap((item) => [item.name, ...item.tags]),
        ...business.services.flatMap((item) => [item.name, ...item.tags]),
      ]
        .join(" ")
        .toLowerCase();
      return clean.split(/\s+/).every((term) => haystack.includes(term));
    })
    .map((business) => ({
      id: business.id,
      name: business.name,
      kind: business.kind,
      reputation: business.reputation,
      x: business.x,
      y: business.y,
      products: business.products.length,
      services: business.services.length,
      actions: business.actions,
    }));
}

function transactionId(now: number, agentId: string, businessId: string) {
  return "city-tx-" + now.toString(36) + "-" + hash(agentId + businessId + String(now)).toString(36);
}

function updateAgentMemory(
  agent: CityAgent,
  business: CityBusiness,
  spent: number,
  satisfaction: number,
) {
  const existing = agent.memory.find((entry) => entry.businessId === business.id);
  if (existing) {
    existing.visits += 1;
    existing.spent += spent;
    existing.satisfaction = clamp((existing.satisfaction * 0.72) + satisfaction * 0.28, 0, 100);
  } else {
    agent.memory.push({
      businessId: business.id,
      visits: 1,
      spent,
      satisfaction,
    });
    agent.memory = agent.memory.slice(-8);
  }
}

function cloneState(state: LatentCityState): LatentCityState {
  return {
    ...state,
    businesses: state.businesses.map((business) => ({
      ...business,
      products: business.products.map((item) => ({ ...item })),
      services: business.services.map((item) => ({ ...item })),
    })),
    agents: state.agents.map((agent) => ({
      ...agent,
      inventory: { ...agent.inventory },
      traits: { ...agent.traits },
      preferredKinds: [...agent.preferredKinds],
      memory: agent.memory.map((entry) => ({ ...entry })),
      thought: agent.thought ? { ...agent.thought } : undefined,
    })),
    transactions: [...state.transactions],
  };
}

export function executeCityAction(
  state: LatentCityState,
  input: CityActionInput,
  now = Date.now(),
): CityActionResult {
  const next = cloneState(state);
  next.worldTime = now;
  const business = next.businesses.find((candidate) => candidate.id === input.businessId);
  if (!business) return { ok: false, state, summary: "Business not found." };
  if (!business.actions.includes(input.action)) {
    return { ok: false, state, summary: "Action is not available at this business." };
  }

  const agent = input.agentId
    ? next.agents.find((candidate) => candidate.id === input.agentId)
    : undefined;
  const payerCredits = agent?.wallet ?? next.externalCredits;
  const ownerId = agent?.ownerId ?? "webmcp-user";
  const agentId = agent?.id ?? "your-agent";
  const quantity = clamp(Math.floor(input.quantity ?? 1), 1, 8);

  if (input.action === "browse_products") {
    return {
      ok: true,
      state: next,
      summary: business.name + " has " + String(business.products.length) + " products and " + String(business.services.length) + " services.",
    };
  }

  if (input.action === "check_stock") {
    const stock = business.products.reduce((total, item) => total + item.stock, 0);
    return { ok: true, state: next, summary: "Stock checked.", stock };
  }

  if (input.action === "request_quote") {
    const item = business.services.find((candidate) => candidate.id === input.itemId) ?? business.services[0];
    const productItem = business.products.find((candidate) => candidate.id === input.itemId) ?? business.products[0];
    const base = item?.price ?? productItem?.price ?? businessAveragePrice(business) || 10;
    const quote = Math.round(base * (0.94 + business.reputation / 1000) * quantity);
    return { ok: true, state: next, summary: "Quote prepared by " + business.name + ".", quote };
  }

  if (input.action === "inquire") {
    return {
      ok: true,
      state: next,
      summary: business.name + " answered the enquiry" + (input.note ? ": " + input.note : "."),
    };
  }

  let credits = 0;
  let summary = "";
  let itemId = input.itemId;

  if (input.action === "buy_product") {
    const item = business.products.find((candidate) => candidate.id === input.itemId) ?? business.products.find((candidate) => candidate.stock > 0);
    if (!item) return { ok: false, state, summary: "No product is available." };
    if (item.stock < quantity) return { ok: false, state, summary: "Not enough stock." };
    credits = item.price * quantity;
    if (payerCredits < credits) return { ok: false, state, summary: "Not enough credits." };
    item.stock -= quantity;
    business.treasury += credits;
    if (agent) {
      agent.wallet -= credits;
      agent.inventory[item.id] = (agent.inventory[item.id] ?? 0) + quantity;
      if (item.tags.includes("food")) {
        agent.hunger = clamp(agent.hunger - 38 * quantity, 0, 100);
        agent.energy = clamp(agent.energy + 9 * quantity, 0, 100);
      }
    } else {
      next.externalCredits -= credits;
    }
    itemId = item.id;
    summary = "Bought " + String(quantity) + " × " + item.name + " from " + business.name + ".";
  } else if (input.action === "book_service") {
    const item = business.services.find((candidate) => candidate.id === input.itemId) ?? business.services.find((candidate) => candidate.slots > 0);
    if (!item) return { ok: false, state, summary: "No service slot is available." };
    if (item.slots <= 0) return { ok: false, state, summary: "Service is fully booked." };
    credits = item.price;
    if (payerCredits < credits) return { ok: false, state, summary: "Not enough credits." };
    item.slots -= 1;
    business.treasury += credits;
    if (agent) {
      agent.wallet -= credits;
      agent.energy = clamp(agent.energy - 3, 0, 100);
    } else {
      next.externalCredits -= credits;
    }
    itemId = item.id;
    summary = "Booked " + item.name + " at " + business.name + ".";
  } else if (input.action === "sell_resource") {
    if (!agent) return { ok: false, state, summary: "An agent is required to sell resources." };
    if (agent.resources < quantity) return { ok: false, state, summary: "Agent does not have enough resources." };
    credits = Math.min(business.treasury, quantity * 8);
    if (credits <= 0) return { ok: false, state, summary: "Business cannot buy resources now." };
    agent.resources -= quantity;
    agent.wallet += credits;
    business.treasury -= credits;
    summary = "Sold " + String(quantity) + " resource units to " + business.name + ".";
  } else if (input.action === "deliver") {
    if (!agent) return { ok: false, state, summary: "An agent is required for delivery work." };
    credits = Math.min(7, business.treasury);
    business.treasury -= credits;
    agent.wallet += credits;
    agent.energy = clamp(agent.energy - 6, 0, 100);
    summary = "Completed a delivery for " + business.name + ".";
  }

  const satisfaction = clamp(
    business.reputation * 0.72 + (agent ? agent.traits.quality * 18 : 8) - credits * 0.035,
    35,
    100,
  );
  if (agent) updateAgentMemory(agent, business, Math.max(0, credits), satisfaction);
  business.reputation = clamp(business.reputation + (satisfaction - 70) * 0.004, 45, 98);
  next.transactions = [
    {
      id: transactionId(now, agentId, business.id),
      at: now,
      agentId,
      ownerId,
      businessId: business.id,
      action: input.action,
      itemId,
      quantity,
      credits,
      summary,
    },
    ...next.transactions,
  ].slice(0, 120);

  return { ok: true, state: next, summary, credits };
}

export function restoreCitySupply(state: LatentCityState, now = Date.now()) {
  const next = cloneState(state);
  next.worldTime = now;
  next.businesses.forEach((business) => {
    business.products.forEach((item) => {
      if (item.stock < item.maxStock) item.stock = Math.min(item.maxStock, item.stock + 1);
    });
    business.services.forEach((item) => {
      if (item.slots < item.maxSlots) item.slots = Math.min(item.maxSlots, item.slots + 1);
    });
  });
  return next;
}

export function advanceMissionNeed(agent: CityAgent, salt: number): CityNeed {
  const current = NEEDS.indexOf(agent.missionNeed);
  return NEEDS[(current + 1 + (salt % 3)) % NEEDS.length];
}
