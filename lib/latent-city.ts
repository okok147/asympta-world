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

export type CityAvatar = "human" | "cat" | "fox" | "rabbit" | "bear";
export type CityAgentStatus = "idle" | "walking" | "interacting" | "working";
export type UserCreditMode = "unlimited" | "metered";

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
  traits: {
    thrift: number;
    quality: number;
    curiosity: number;
    sociability: number;
    patience: number;
  };
  preferredKinds: CityBusinessKind[];
  missionNeed: CityNeed;
  ownerGoal: string;
  status: CityAgentStatus;
  targetBusinessId?: string;
  currentNeed?: CityNeed;
  interactionUntil?: number;
  pendingAction?: CityActionId;
  nextDecisionAt: number;
  thought?: {
    label: string;
    kind: "food" | "deal" | "service" | "resource" | "work" | "search" | "status";
    until: number;
  };
  memory: Array<{
    businessId: string;
    visits: number;
    spent: number;
    satisfaction: number;
  }>;
};

export type CityTransaction = {
  id: string;
  at: number;
  agentId: string;
  ownerId: string;
  businessId: string;
  action: CityActionId;
  itemId?: string;
  itemName?: string;
  quantity?: number;
  credits: number;
  summary: string;
  actorDelta: string;
  businessDelta: string;
};

export type LatentCityState = {
  version: 1;
  worldTime: number;
  userCreditMode?: UserCreditMode;
  externalCredits: number;
  externalResources: number;
  externalInventory: Record<string, number>;
  externalServices: Record<string, number>;
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
  actorDelta?: string;
  businessDelta?: string;
  creditMode?: UserCreditMode;
};

const NAMES = [
  "Milo",
  "Nori",
  "Pip",
  "Lumi",
  "Taro",
  "Mina",
  "Kiko",
  "Nana",
  "Rin",
  "Sora",
  "Ari",
  "Momo",
  "Kai",
  "Yuki",
  "Noa",
  "Coco",
  "Theo",
  "Fia",
  "Remy",
  "Eli",
  "Uma",
  "Leo",
  "Ivy",
  "Bo",
  "Mika",
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
const KINDS: CityBusinessKind[] = [
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

const NEED_LABEL: Record<CityNeed, string> = {
  meal: "尋找食物",
  groceries: "購買日用品",
  repair: "尋找維修",
  design: "尋找設計",
  print: "尋找印刷",
  delivery: "安排配送",
  learning: "學習技能",
  workspace: "尋找工作位",
  automation: "尋找自動化",
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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function random01(seed: string) {
  const value = hash(seed);
  return ((value ^ (value >>> 15)) >>> 0) / 4294967295;
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

function business(
  id: string,
  name: string,
  kind: CityBusinessKind,
  x: number,
  y: number,
  seed: number,
  reputation: number,
  treasury: number,
  products: CityProduct[],
  services: CityService[],
  actions: CityActionId[],
): CityBusiness {
  return {
    id,
    name,
    kind,
    x,
    y,
    seed,
    reputation,
    treasury,
    products,
    services,
    actions,
  };
}

export function seedCityBusinesses(): CityBusiness[] {
  return [
    business(
      "corner-cafe",
      "Corner Cafe",
      "cafe",
      155,
      180,
      11,
      82,
      420,
      [
        product("coffee", "Coffee", 8, 28, ["food", "drink", "energy"]),
        product("tea", "Tea", 7, 24, ["food", "drink"]),
        product("sandwich", "Sandwich", 14, 18, ["food", "meal"]),
      ],
      [service("catering", "Small catering", 68, 60, 5, ["food", "event"])],
      ["browse_products", "check_stock", "buy_product", "book_service", "inquire"],
    ),
    business(
      "market-grocer",
      "Market Grocer",
      "grocery",
      405,
      120,
      23,
      76,
      680,
      [
        product("fruit-box", "Fruit box", 12, 24, ["food", "grocery"]),
        product("rice-pack", "Rice pack", 15, 20, ["food", "grocery"]),
        product("daily-kit", "Daily kit", 22, 16, ["grocery", "resource"]),
      ],
      [service("weekly-basket", "Weekly basket", 54, 15, 8, ["grocery", "delivery"])],
      [
        "browse_products",
        "check_stock",
        "buy_product",
        "book_service",
        "sell_resource",
        "inquire",
      ],
    ),
    business(
      "hearth-bakery",
      "Hearth Bakery",
      "bakery",
      735,
      150,
      37,
      88,
      510,
      [
        product("milk-bun", "Milk bun", 6, 26, ["food", "meal"]),
        product("bread-loaf", "Bread loaf", 11, 20, ["food", "grocery"]),
        product("cake-slice", "Cake slice", 9, 16, ["food", "treat"]),
      ],
      [service("custom-cake", "Custom cake", 58, 120, 4, ["food", "event"])],
      [
        "browse_products",
        "check_stock",
        "buy_product",
        "book_service",
        "request_quote",
        "inquire",
      ],
    ),
    business(
      "pixel-repair",
      "Pixel Repair",
      "repair",
      1015,
      205,
      41,
      84,
      720,
      [product("cable-kit", "Cable kit", 16, 18, ["repair", "resource"])],
      [
        service("diagnostic", "Device diagnostic", 18, 20, 10, ["repair"]),
        service("battery-fix", "Battery fix", 42, 45, 7, ["repair"]),
        service("screen-fix", "Screen repair", 72, 90, 5, ["repair"]),
      ],
      [
        "browse_products",
        "check_stock",
        "buy_product",
        "book_service",
        "request_quote",
        "inquire",
      ],
    ),
    business(
      "soft-form-studio",
      "Soft Form Studio",
      "design",
      230,
      420,
      53,
      91,
      980,
      [product("icon-pack", "Icon pack", 34, 12, ["design", "digital"])],
      [
        service("visual-concept", "Visual concept", 76, 120, 5, ["design"]),
        service("brand-sprint", "Brand sprint", 132, 180, 3, ["design", "branding"]),
      ],
      ["browse_products", "buy_product", "book_service", "request_quote", "inquire"],
    ),
    business(
      "tiny-print",
      "Tiny Print",
      "print",
      520,
      365,
      67,
      79,
      610,
      [
        product("posters-10", "10 posters", 18, 20, ["print"]),
        product("cards-50", "50 cards", 24, 18, ["print"]),
      ],
      [service("rush-print", "Rush print", 36, 45, 7, ["print", "delivery"])],
      [
        "browse_products",
        "check_stock",
        "buy_product",
        "book_service",
        "request_quote",
        "inquire",
      ],
    ),
    business(
      "swift-courier",
      "Swift Courier",
      "courier",
      850,
      370,
      71,
      81,
      740,
      [product("parcel-kit", "Parcel kit", 6, 30, ["delivery", "resource"])],
      [
        service("local-delivery", "Local delivery", 16, 35, 12, ["delivery"]),
        service("same-day", "Same-day delivery", 28, 60, 6, ["delivery"]),
      ],
      [
        "browse_products",
        "buy_product",
        "book_service",
        "deliver",
        "request_quote",
        "inquire",
      ],
    ),
    business(
      "little-learning",
      "Little Learning",
      "learning",
      1040,
      515,
      83,
      86,
      560,
      [product("workbook", "Practice workbook", 12, 22, ["learning"])],
      [
        service("skill-session", "Skill session", 32, 50, 8, ["learning"]),
        service("mentor-hour", "Mentor hour", 48, 60, 5, ["learning"]),
      ],
      ["browse_products", "buy_product", "book_service", "request_quote", "inquire"],
    ),
    business(
      "quiet-desk",
      "Quiet Desk",
      "coworking",
      390,
      620,
      97,
      78,
      830,
      [product("day-pass", "Desk day pass", 18, 28, ["workspace"])],
      [
        service("focus-booth", "Focus booth", 12, 60, 9, ["workspace", "rest"]),
        service("meeting-room", "Meeting room", 34, 60, 5, ["workspace"]),
      ],
      ["browse_products", "check_stock", "buy_product", "book_service", "inquire"],
    ),
    business(
      "loop-lab",
      "Loop Lab",
      "automation",
      760,
      610,
      109,
      89,
      1100,
      [
        product("template-pack", "Workflow templates", 28, 16, [
          "automation",
          "digital",
        ]),
      ],
      [
        service("automation-audit", "Automation audit", 56, 70, 6, ["automation"]),
        service("small-workflow", "Small workflow", 118, 150, 4, ["automation"]),
      ],
      ["browse_products", "buy_product", "book_service", "request_quote", "inquire"],
    ),
  ];
}

function preferredKinds(index: number): CityBusinessKind[] {
  return [KINDS[index % KINDS.length], KINDS[(index * 3 + 4) % KINDS.length]];
}

export function seedCityAgents(now = Date.now(), count = 100): CityAgent[] {
  return Array.from({ length: count }, (_, index) => {
    const id = "city-agent-" + String(index + 1).padStart(3, "0");
    const missionNeed = NEEDS[index % NEEDS.length];
    const x = 80 + random01(id + ":x") * 1040;
    const y = 75 + random01(id + ":y") * 610;
    return {
      id,
      name: NAMES[index % NAMES.length] + " " + String(Math.floor(index / NAMES.length) + 1),
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
    userCreditMode: "unlimited",
    externalCredits: 500,
    externalResources: 3,
    externalInventory: {},
    externalServices: {},
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

export function businessAveragePrice(businessState: CityBusiness) {
  const prices = [
    ...businessState.products.map((item) => item.price),
    ...businessState.services.map((item) => item.price),
  ];
  return prices.length > 0
    ? prices.reduce((total, price) => total + price, 0) / prices.length
    : 0;
}

export function chooseBusinessForAgent(
  businesses: CityBusiness[],
  agent: CityAgent,
  need: CityNeed,
): CityBusiness | undefined {
  const matching = businesses.filter((candidate) =>
    BUSINESS_NEEDS[candidate.kind].includes(need),
  );
  const pool = matching.length > 0 ? matching : businesses;
  return pool
    .map((candidate) => {
      const memory = agent.memory.find((entry) => entry.businessId === candidate.id);
      const distance = Math.hypot(candidate.x - agent.x, candidate.y - agent.y);
      const preference = agent.preferredKinds.includes(candidate.kind) ? 18 : 0;
      const quality = candidate.reputation * (0.3 + agent.traits.quality * 0.7);
      const thriftPenalty = businessAveragePrice(candidate) * agent.traits.thrift * 0.55;
      const distancePenalty =
        distance * (0.018 + (1 - agent.traits.patience) * 0.012);
      const familiarity = memory
        ? memory.satisfaction * 0.14 + Math.min(12, memory.visits * 1.6)
        : 0;
      const curiosity = memory ? 0 : agent.traits.curiosity * 9;
      return {
        business: candidate,
        score:
          preference +
          quality +
          familiarity +
          curiosity -
          thriftPenalty -
          distancePenalty,
      };
    })
    .sort((left, right) => right.score - left.score)[0]?.business;
}

export function needDialogue(need: CityNeed) {
  return NEED_LABEL[need];
}

export function listBusinessActions(businessState: CityBusiness) {
  const labels: Record<CityActionId, string> = {
    browse_products: "瀏覽商品",
    check_stock: "查看庫存",
    buy_product: "購買商品",
    book_service: "預約服務",
    request_quote: "取得報價",
    sell_resource: "出售資源",
    deliver: "配送",
    inquire: "詢問",
  };
  return businessState.actions.map((action) => ({ action, label: labels[action] }));
}

export function searchCityBusinesses(
  state: LatentCityState,
  query = "",
  kind?: CityBusinessKind,
) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return state.businesses
    .filter((candidate) => !kind || candidate.kind === kind)
    .filter((candidate) => {
      if (terms.length === 0) return true;
      const text = [
        candidate.name,
        candidate.kind,
        ...candidate.products.flatMap((item) => [item.name, ...item.tags]),
        ...candidate.services.flatMap((item) => [item.name, ...item.tags]),
      ]
        .join(" ")
        .toLowerCase();
      return terms.every((term) => text.includes(term));
    })
    .map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      kind: candidate.kind,
      reputation: candidate.reputation,
      x: candidate.x,
      y: candidate.y,
      products: candidate.products.length,
      services: candidate.services.length,
      actions: candidate.actions,
    }));
}

function cloneState(state: LatentCityState): LatentCityState {
  return {
    ...state,
    userCreditMode: state.userCreditMode ?? "unlimited",
    externalInventory: { ...(state.externalInventory ?? {}) },
    externalServices: { ...(state.externalServices ?? {}) },
    externalResources: state.externalResources ?? 3,
    businesses: state.businesses.map((candidate) => ({
      ...candidate,
      products: candidate.products.map((item) => ({ ...item })),
      services: candidate.services.map((item) => ({ ...item })),
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

function remember(
  agent: CityAgent,
  businessState: CityBusiness,
  spent: number,
  satisfaction: number,
) {
  const entry = agent.memory.find((candidate) => candidate.businessId === businessState.id);
  if (entry) {
    entry.visits += 1;
    entry.spent += spent;
    entry.satisfaction = clamp(
      entry.satisfaction * 0.72 + satisfaction * 0.28,
      0,
      100,
    );
  } else {
    agent.memory.push({
      businessId: businessState.id,
      visits: 1,
      spent,
      satisfaction,
    });
  }
  agent.memory = agent.memory.slice(-8);
}

function transactionId(now: number, agentId: string, businessId: string) {
  return (
    "city-tx-" +
    now.toString(36) +
    "-" +
    hash(agentId + businessId + String(now)).toString(36)
  );
}

function deltaLabels(
  action: CityActionId,
  credits: number,
  itemName: string,
  quantity: number,
) {
  const item = (quantity > 1 ? String(quantity) + "×" : "") + itemName;
  if (action === "buy_product") {
    return { actor: `−₡${credits} +${item}`, business: `+₡${credits} −${item}` };
  }
  if (action === "book_service") {
    return { actor: `−₡${credits} +${itemName}`, business: `+₡${credits} −1 slot` };
  }
  if (action === "sell_resource") {
    return {
      actor: `+₡${credits} −${quantity} resource`,
      business: `−₡${credits} +${quantity} resource`,
    };
  }
  if (action === "deliver") {
    return { actor: `+₡${credits} −energy`, business: `−₡${credits} +delivery` };
  }
  if (action === "request_quote") return { actor: "+quote", business: "+enquiry" };
  if (action === "check_stock") return { actor: "+stock info", business: "+enquiry" };
  if (action === "browse_products") {
    return { actor: "+product info", business: "+visitor" };
  }
  return { actor: "+answer", business: "+enquiry" };
}

export function executeCityAction(
  state: LatentCityState,
  input: CityActionInput,
  now = Date.now(),
): CityActionResult {
  const next = cloneState(state);
  next.worldTime = now;
  const businessState = next.businesses.find(
    (candidate) => candidate.id === input.businessId,
  );
  if (!businessState) return { ok: false, state, summary: "Business not found." };
  if (!businessState.actions.includes(input.action)) {
    return {
      ok: false,
      state,
      summary: "Action is not available at this business.",
    };
  }

  const agent =
    input.agentId && input.agentId !== "your-agent"
      ? next.agents.find((candidate) => candidate.id === input.agentId)
      : undefined;
  const isUser = input.agentId === "your-agent" || !input.agentId;
  const creditMode = next.userCreditMode ?? "unlimited";
  next.userCreditMode = creditMode;
  const userHasUnlimitedCredits = isUser && creditMode === "unlimited";
  const payerCredits = agent?.wallet ??
    (userHasUnlimitedCredits ? Number.MAX_SAFE_INTEGER : next.externalCredits);
  const quantity = clamp(Math.floor(input.quantity ?? 1), 1, 8);

  if (input.action === "browse_products") {
    return {
      ok: true,
      state: next,
      summary:
        businessState.name +
        " has " +
        String(businessState.products.length) +
        " products and " +
        String(businessState.services.length) +
        " services.",
      actorDelta: "+product info",
      businessDelta: "+visitor",
      creditMode,
    };
  }

  if (input.action === "check_stock") {
    const stock = businessState.products.reduce((total, item) => total + item.stock, 0);
    return {
      ok: true,
      state: next,
      summary: "Stock checked.",
      stock,
      actorDelta: "+stock info",
      businessDelta: "+enquiry",
      creditMode,
    };
  }

  if (input.action === "request_quote") {
    const serviceItem =
      businessState.services.find((candidate) => candidate.id === input.itemId) ??
      businessState.services[0];
    const productItem =
      businessState.products.find((candidate) => candidate.id === input.itemId) ??
      businessState.products[0];
    const base =
      serviceItem?.price ??
      productItem?.price ??
      (businessAveragePrice(businessState) || 10);
    const quote = Math.round(
      base * (0.94 + businessState.reputation / 1000) * quantity,
    );
    return {
      ok: true,
      state: next,
      summary: "Quote prepared by " + businessState.name + ".",
      quote,
      actorDelta: "+quote",
      businessDelta: "+enquiry",
      creditMode,
    };
  }

  if (input.action === "inquire") {
    return {
      ok: true,
      state: next,
      summary:
        businessState.name +
        " answered the enquiry" +
        (input.note ? ": " + input.note : "."),
      actorDelta: "+answer",
      businessDelta: "+enquiry",
      creditMode,
    };
  }

  let credits = 0;
  let summary = "";
  let itemId = input.itemId;
  let resolvedName = "item";

  if (input.action === "buy_product") {
    const item =
      businessState.products.find((candidate) => candidate.id === input.itemId) ??
      businessState.products.find((candidate) => candidate.stock > 0);
    if (!item) return { ok: false, state, summary: "No product is available." };
    if (item.stock < quantity) {
      return { ok: false, state, summary: "Not enough stock." };
    }
    credits = item.price * quantity;
    if (payerCredits < credits) {
      return { ok: false, state, summary: "Not enough credits." };
    }
    item.stock -= quantity;
    businessState.treasury += credits;
    itemId = item.id;
    resolvedName = item.name;
    if (agent) {
      agent.wallet -= credits;
      agent.inventory[item.id] = (agent.inventory[item.id] ?? 0) + quantity;
      if (item.tags.includes("food")) {
        agent.hunger = clamp(agent.hunger - 38 * quantity, 0, 100);
        agent.energy = clamp(agent.energy + 9 * quantity, 0, 100);
      }
    } else {
      if (!userHasUnlimitedCredits) next.externalCredits -= credits;
      next.externalInventory[item.id] =
        (next.externalInventory[item.id] ?? 0) + quantity;
    }
    summary =
      "Bought " +
      String(quantity) +
      " × " +
      item.name +
      " from " +
      businessState.name +
      ".";
  } else if (input.action === "book_service") {
    const item =
      businessState.services.find((candidate) => candidate.id === input.itemId) ??
      businessState.services.find((candidate) => candidate.slots > 0);
    if (!item) {
      return { ok: false, state, summary: "No service slot is available." };
    }
    if (item.slots <= 0) {
      return { ok: false, state, summary: "Service is fully booked." };
    }
    credits = item.price;
    if (payerCredits < credits) {
      return { ok: false, state, summary: "Not enough credits." };
    }
    item.slots -= 1;
    businessState.treasury += credits;
    itemId = item.id;
    resolvedName = item.name;
    if (agent) {
      agent.wallet -= credits;
      agent.energy = clamp(agent.energy - 3, 0, 100);
    } else {
      if (!userHasUnlimitedCredits) next.externalCredits -= credits;
      next.externalServices[item.id] = (next.externalServices[item.id] ?? 0) + 1;
    }
    summary = "Booked " + item.name + " at " + businessState.name + ".";
  } else if (input.action === "sell_resource") {
    const resources = agent?.resources ?? next.externalResources;
    if (resources < quantity) {
      return { ok: false, state, summary: "Not enough resources." };
    }
    credits = Math.min(businessState.treasury, quantity * 8);
    if (credits <= 0) {
      return {
        ok: false,
        state,
        summary: "Business cannot buy resources now.",
      };
    }
    businessState.treasury -= credits;
    resolvedName = "resource";
    if (agent) {
      agent.resources -= quantity;
      agent.wallet += credits;
    } else {
      next.externalResources -= quantity;
      if (!userHasUnlimitedCredits) next.externalCredits += credits;
    }
    summary =
      "Sold " +
      String(quantity) +
      " resource units to " +
      businessState.name +
      ".";
  } else if (input.action === "deliver") {
    credits = Math.min(7, businessState.treasury);
    businessState.treasury -= credits;
    resolvedName = "delivery";
    if (agent) {
      agent.wallet += credits;
      agent.energy = clamp(agent.energy - 6, 0, 100);
    } else if (!userHasUnlimitedCredits) {
      next.externalCredits += credits;
    }
    summary = "Completed a delivery for " + businessState.name + ".";
  }

  const satisfaction = clamp(
    businessState.reputation * 0.72 +
      (agent ? agent.traits.quality * 18 : 8) -
      credits * 0.035,
    35,
    100,
  );
  if (agent) remember(agent, businessState, Math.max(0, credits), satisfaction);
  businessState.reputation = clamp(
    businessState.reputation + (satisfaction - 70) * 0.004,
    45,
    98,
  );

  const deltas = deltaLabels(input.action, credits, resolvedName, quantity);
  next.transactions = [
    {
      id: transactionId(now, agent?.id ?? "your-agent", businessState.id),
      at: now,
      agentId: agent?.id ?? "your-agent",
      ownerId: agent?.ownerId ?? "current-user",
      businessId: businessState.id,
      action: input.action,
      itemId,
      itemName: resolvedName,
      quantity,
      credits,
      summary,
      actorDelta: deltas.actor,
      businessDelta: deltas.business,
    },
    ...next.transactions,
  ].slice(0, 120);

  if (isUser && !userHasUnlimitedCredits) {
    next.externalCredits = Math.max(0, next.externalCredits);
  }

  return {
    ok: true,
    state: next,
    summary,
    credits,
    actorDelta: deltas.actor,
    businessDelta: deltas.business,
    creditMode,
  };
}

export function restoreCitySupply(state: LatentCityState, now = Date.now()) {
  const next = cloneState(state);
  next.worldTime = now;
  for (const businessState of next.businesses) {
    for (const item of businessState.products) {
      if (item.stock < item.maxStock) {
        item.stock = Math.min(item.maxStock, item.stock + 1);
      }
    }
    for (const item of businessState.services) {
      if (item.slots < item.maxSlots) {
        item.slots = Math.min(item.maxSlots, item.slots + 1);
      }
    }
  }
  return next;
}

export function advanceMissionNeed(agent: CityAgent, salt: number): CityNeed {
  const current = NEEDS.indexOf(agent.missionNeed);
  return NEEDS[(current + 1 + (salt % 3)) % NEEDS.length];
}
