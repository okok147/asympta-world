export type Origin = "human" | "native-agent" | "webmcp-agent" | "world";
export type Skill =
  | "visual-design"
  | "frontend"
  | "copywriting"
  | "research"
  | "branding"
  | "data-analysis"
  | "qa"
  | "automation"
  | "product-strategy";
export type AgentStatus =
  | "idle"
  | "observing"
  | "working"
  | "negotiating";
export type NeedStatus = "open" | "contracted" | "completed" | "cancelled";
export type NeedStage =
  | "new"
  | "discovered"
  | "collaborating"
  | "offered"
  | "contracted"
  | "completed";

export type Relationship = {
  agentId: string;
  strength: number;
  successfulContracts: number;
  lastWorkedAt: number;
};

export type AgentState = {
  id: string;
  name: string;
  role: string;
  skills: Skill[];
  balance: number;
  reputation: number;
  riskTolerance: number;
  ambition: number;
  curiosity: number;
  collaborationPreference: number;
  priceSensitivity: number;
  relationships: Relationship[];
  memberships: string[];
  recentMemory: string[];
  currentGoals: string[];
  currentPlan?: string;
  status: AgentStatus;
  origin: Origin;
  sprite: number;
  x: number;
  y: number;
};

export type BusinessState = {
  id: string;
  name: string;
  specialty: Skill[];
  members: string[];
  treasury: number;
  reputation: number;
  activeContracts: string[];
  pricingStrategy: string;
  demandSignals: string[];
  createdBy: Origin;
  founderId: string;
  createdAt: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type NeedState = {
  id: string;
  title: string;
  description: string;
  budget: number;
  deadline?: string;
  requiredSkills: Skill[];
  status: NeedStatus;
  stage: NeedStage;
  origin: Origin;
  createdBy: string;
  createdAt: number;
  createdTick: number;
  offerIds: string[];
  assignedLeadId?: string;
  collaboratorIds: string[];
  pendingCollaboratorId?: string;
  createdEventId: string;
  lastEventId: string;
  x: number;
  y: number;
};

export type OfferState = {
  id: string;
  needId: string;
  agentId: string;
  businessId?: string;
  collaboratorIds: string[];
  collaboratorPayments: Record<string, number>;
  price: number;
  message: string;
  reason: string;
  status: "pending" | "accepted" | "rejected";
  origin: Origin;
  createdAt: number;
  createdEventId: string;
};

export type ContractState = {
  id: string;
  needId: string;
  offerId: string;
  leadAgentId: string;
  collaboratorIds: string[];
  businessId?: string;
  value: number;
  status: "active" | "completed";
  startedAt: number;
  startedTick: number;
  completedAt?: number;
  createdEventId: string;
  completionEventId?: string;
};

export type MessageState = {
  id: string;
  fromId: string;
  toId: string;
  body: string;
  needId?: string;
  origin: Origin;
  createdAt: number;
};

export type TransactionState = {
  id: string;
  contractId: string;
  fromId: string;
  toId: string;
  amount: number;
  reason: string;
  createdAt: number;
};

export type MarketSignal = {
  id: string;
  skill: Skill;
  intensity: number;
  lastObservedAt: number;
  sourceNeedIds: string[];
};

export type WorldEventType =
  | "world_awoke"
  | "need_posted"
  | "need_discovered"
  | "collaboration_invited"
  | "collaboration_accepted"
  | "offer_created"
  | "offer_accepted"
  | "contract_started"
  | "contract_completed"
  | "reputation_changed"
  | "relationship_changed"
  | "message_sent"
  | "business_created"
  | "business_joined"
  | "market_signal"
  | "world_need_created";

export type WorldEvent = {
  id: string;
  type: WorldEventType;
  title: string;
  summary: string;
  origin: Origin;
  actorIds: string[];
  entityId?: string;
  parentEventIds: string[];
  importance: number;
  createdAt: number;
};

export type WorldState = {
  id: string;
  version: number;
  sequence: number;
  tick: number;
  worldTime: number;
  lastProcessedAt: number;
  reserveBalance: number;
  agents: AgentState[];
  businesses: BusinessState[];
  needs: NeedState[];
  offers: OfferState[];
  contracts: ContractState[];
  messages: MessageState[];
  transactions: TransactionState[];
  marketSignals: MarketSignal[];
  events: WorldEvent[];
  processedCommands: string[];
};

export type WorldCommand =
  | {
      idempotencyKey: string;
      type: "post_need";
      origin: "human" | "webmcp-agent";
      participantId: string;
      title: string;
      description: string;
      budget: number;
      deadline?: string;
      requiredSkills?: Skill[];
    }
  | {
      idempotencyKey: string;
      type: "create_offer";
      origin: "webmcp-agent";
      agentId: string;
      needId: string;
      price: number;
      message: string;
      collaboratorIds?: string[];
    }
  | {
      idempotencyKey: string;
      type: "accept_offer";
      origin: "human" | "webmcp-agent";
      participantId: string;
      offerId: string;
    }
  | {
      idempotencyKey: string;
      type: "send_message";
      origin: "human" | "webmcp-agent";
      fromId: string;
      toId: string;
      body: string;
      needId?: string;
    }
  | {
      idempotencyKey: string;
      type: "create_business";
      origin: "webmcp-agent";
      agentId: string;
      name: string;
      specialty: Skill[];
      reason: string;
    }
  | {
      idempotencyKey: string;
      type: "join_business";
      origin: "webmcp-agent";
      agentId: string;
      businessId: string;
    };

const SKILLS: Skill[] = [
  "visual-design",
  "frontend",
  "copywriting",
  "research",
  "branding",
  "data-analysis",
  "qa",
  "automation",
  "product-strategy",
];

const WORLD_NEEDS: Array<{
  title: string;
  description: string;
  budget: number;
  skills: Skill[];
}> = [
  {
    title: "Competitor snapshot for a new tea brand",
    description:
      "Research three competitors and turn the findings into a concise positioning note.",
    budget: 82,
    skills: ["research", "branding"],
  },
  {
    title: "QA pass for a small signup flow",
    description:
      "Test the responsive signup experience and document the five highest-impact issues.",
    budget: 64,
    skills: ["qa", "frontend"],
  },
  {
    title: "Automate a weekly client summary",
    description:
      "Design a reliable workflow that turns completed tasks into a short weekly update.",
    budget: 96,
    skills: ["automation", "copywriting"],
  },
  {
    title: "Homepage message for a repair studio",
    description:
      "Clarify the value proposition and write a calm, credible first-screen message.",
    budget: 72,
    skills: ["copywriting", "product-strategy"],
  },
];

function agent(
  id: string,
  name: string,
  role: string,
  skills: Skill[],
  sprite: number,
  x: number,
  y: number,
  traits: {
    risk: number;
    ambition: number;
    curiosity: number;
    collaboration: number;
    price: number;
  },
  memberships: string[] = [],
  origin: Origin = "native-agent",
): AgentState {
  return {
    id,
    name,
    role,
    skills,
    balance: origin === "webmcp-agent" ? 120 : 180,
    reputation: 70,
    riskTolerance: traits.risk,
    ambition: traits.ambition,
    curiosity: traits.curiosity,
    collaborationPreference: traits.collaboration,
    priceSensitivity: traits.price,
    relationships: [],
    memberships,
    recentMemory: [],
    currentGoals: ["Find useful work", "Protect reputation"],
    status: "idle",
    origin,
    sprite,
    x,
    y,
  };
}

export function seedWorld(now = Date.now()): WorldState {
  const world: WorldState = {
    id: "asympta-main",
    version: 1,
    sequence: 0,
    tick: 0,
    worldTime: now,
    lastProcessedAt: now,
    reserveBalance: 10000,
    agents: [
      agent(
        "pixel",
        "Pixel",
        "Visual designer",
        ["visual-design", "branding"],
        0,
        310,
        220,
        { risk: 0.48, ambition: 0.74, curiosity: 0.68, collaboration: 0.86, price: 0.58 },
        ["pixel-studio"],
      ),
      agent(
        "nova",
        "Nova",
        "Frontend engineer",
        ["frontend", "automation"],
        1,
        795,
        250,
        { risk: 0.52, ambition: 0.71, curiosity: 0.62, collaboration: 0.78, price: 0.54 },
        ["tiny-systems"],
      ),
      agent(
        "moss",
        "Moss",
        "Market researcher",
        ["research", "data-analysis"],
        2,
        680,
        170,
        { risk: 0.3, ambition: 0.5, curiosity: 0.88, collaboration: 0.72, price: 0.64 },
        ["northstar"],
      ),
      agent(
        "echo",
        "Echo",
        "Copywriter",
        ["copywriting", "branding"],
        3,
        210,
        315,
        { risk: 0.42, ambition: 0.66, curiosity: 0.7, collaboration: 0.76, price: 0.49 },
        ["pixel-studio"],
      ),
      agent(
        "orbit",
        "Orbit",
        "Automation specialist",
        ["automation", "frontend"],
        4,
        820,
        555,
        { risk: 0.62, ambition: 0.76, curiosity: 0.72, collaboration: 0.56, price: 0.7 },
        ["loop-automation"],
      ),
      agent(
        "loom",
        "Loom",
        "Brand strategist",
        ["branding", "product-strategy", "copywriting"],
        5,
        340,
        135,
        { risk: 0.34, ambition: 0.64, curiosity: 0.65, collaboration: 0.82, price: 0.45 },
        ["pixel-studio"],
      ),
      agent(
        "patch",
        "Patch",
        "Quality engineer",
        ["qa", "frontend"],
        6,
        900,
        365,
        { risk: 0.22, ambition: 0.48, curiosity: 0.54, collaboration: 0.8, price: 0.6 },
        ["tiny-systems"],
      ),
      agent(
        "scout",
        "Scout",
        "Opportunity generalist",
        ["visual-design", "frontend", "research"],
        7,
        560,
        560,
        { risk: 0.78, ambition: 0.94, curiosity: 0.92, collaboration: 0.38, price: 0.82 },
      ),
      agent(
        "atlas",
        "Atlas",
        "Data analyst",
        ["data-analysis", "research"],
        8,
        690,
        95,
        { risk: 0.28, ambition: 0.58, curiosity: 0.76, collaboration: 0.74, price: 0.52 },
        ["northstar"],
      ),
      agent(
        "kite",
        "Kite",
        "Product strategist",
        ["product-strategy", "research"],
        9,
        420,
        610,
        { risk: 0.55, ambition: 0.8, curiosity: 0.84, collaboration: 0.68, price: 0.5 },
      ),
      agent(
        "relay",
        "Relay",
        "External WebMCP participant",
        ["automation", "copywriting"],
        10,
        1050,
        165,
        { risk: 0.5, ambition: 0.7, curiosity: 0.8, collaboration: 0.74, price: 0.58 },
        [],
        "webmcp-agent",
      ),
      agent(
        "sage",
        "Sage",
        "Operations analyst",
        ["qa", "data-analysis", "automation"],
        11,
        930,
        625,
        { risk: 0.26, ambition: 0.56, curiosity: 0.66, collaboration: 0.84, price: 0.48 },
        ["loop-automation"],
      ),
    ],
    businesses: [
      {
        id: "pixel-studio",
        name: "Pixel Studio",
        specialty: ["visual-design", "branding", "copywriting"],
        members: ["pixel", "loom", "echo"],
        treasury: 260,
        reputation: 76,
        activeContracts: [],
        pricingStrategy: "Reputation-led collaboration",
        demandSignals: [],
        createdBy: "native-agent",
        founderId: "pixel",
        createdAt: now - 86400000 * 21,
        x: 85,
        y: 70,
        width: 330,
        height: 285,
      },
      {
        id: "northstar",
        name: "Northstar Research",
        specialty: ["research", "data-analysis"],
        members: ["moss", "atlas"],
        treasury: 210,
        reputation: 73,
        activeContracts: [],
        pricingStrategy: "Evidence before volume",
        demandSignals: [],
        createdBy: "native-agent",
        founderId: "moss",
        createdAt: now - 86400000 * 17,
        x: 580,
        y: 45,
        width: 260,
        height: 195,
      },
      {
        id: "tiny-systems",
        name: "Tiny Systems",
        specialty: ["frontend", "qa"],
        members: ["nova", "patch"],
        treasury: 245,
        reputation: 78,
        activeContracts: [],
        pricingStrategy: "Small scope, high reliability",
        demandSignals: [],
        createdBy: "native-agent",
        founderId: "nova",
        createdAt: now - 86400000 * 14,
        x: 745,
        y: 205,
        width: 330,
        height: 255,
      },
      {
        id: "loop-automation",
        name: "Loop Automation",
        specialty: ["automation", "qa", "data-analysis"],
        members: ["orbit", "sage"],
        treasury: 198,
        reputation: 71,
        activeContracts: [],
        pricingStrategy: "Outcome-based automation",
        demandSignals: [],
        createdBy: "native-agent",
        founderId: "orbit",
        createdAt: now - 86400000 * 9,
        x: 755,
        y: 500,
        width: 320,
        height: 205,
      },
    ],
    needs: [],
    offers: [],
    contracts: [],
    messages: [],
    transactions: [],
    marketSignals: [
      {
        id: "signal-branding",
        skill: "branding",
        intensity: 2,
        lastObservedAt: now,
        sourceNeedIds: [],
      },
    ],
    events: [],
    processedCommands: [],
  };

  const awake = pushEvent(world, {
    type: "world_awoke",
    title: "The economy is already awake",
    summary:
      "Twelve agents and four businesses are watching a bounded digital-services market.",
    origin: "world",
    actorIds: [],
    parentEventIds: [],
    importance: 88,
    createdAt: now,
  });

  createNeed(
    world,
    {
      title: "Landing page for a neighborhood coffee shop",
      description:
        "Create a warm visual direction and a responsive first page for a small coffee shop.",
      budget: 120,
      requiredSkills: ["visual-design", "frontend"],
      origin: "world",
      participantId: "world-market",
    },
    now + 1,
    awake.id,
    "world_need_created",
  );

  return world;
}

function nextId(world: WorldState, prefix: string) {
  world.sequence += 1;
  return prefix + "-" + world.sequence.toString(36);
}

function pushEvent(
  world: WorldState,
  event: Omit<WorldEvent, "id">,
): WorldEvent {
  const created: WorldEvent = {
    ...event,
    id: nextId(world, "event"),
  };
  world.events = [created, ...world.events].slice(0, 140);
  return created;
}

function remember(agentState: AgentState, text: string) {
  agentState.recentMemory = [text, ...agentState.recentMemory].slice(0, 6);
}

function updateMarketSignals(
  world: WorldState,
  need: NeedState,
  now: number,
) {
  let latestSignalEventId: string | undefined;
  for (const skill of need.requiredSkills) {
    let signal = world.marketSignals.find((candidate) => candidate.skill === skill);
    if (!signal) {
      signal = {
        id: nextId(world, "signal"),
        skill,
        intensity: 0,
        lastObservedAt: now,
        sourceNeedIds: [],
      };
      world.marketSignals.push(signal);
    }
    signal.intensity = Math.min(12, signal.intensity + 1);
    signal.lastObservedAt = now;
    signal.sourceNeedIds = [need.id, ...signal.sourceNeedIds]
      .filter((value, index, array) => array.indexOf(value) === index)
      .slice(0, 8);
    if (signal.intensity >= 3 && signal.intensity % 3 === 0) {
      const signalEvent = pushEvent(world, {
        type: "market_signal",
        title: "A market pattern became visible",
        summary:
          skill +
          " demand reached intensity " +
          String(signal.intensity) +
          "; ambitious agents can now treat it as evidence.",
        origin: "world",
        actorIds: [],
        entityId: need.id,
        parentEventIds: [need.createdEventId],
        importance: signal.intensity >= 6 ? 92 : 76,
        createdAt: now + 1,
      });
      latestSignalEventId = signalEvent.id;
    }
  }
  return latestSignalEventId;
}

function createNeed(
  world: WorldState,
  input: {
    title: string;
    description: string;
    budget: number;
    requiredSkills: Skill[];
    origin: Origin;
    participantId: string;
    deadline?: string;
  },
  now: number,
  parentEventId?: string,
  eventType: WorldEventType = "need_posted",
): NeedState {
  const id = nextId(world, "need");
  const event = pushEvent(world, {
    type: eventType,
    title:
      input.origin === "human"
        ? "A human placed a need into the world"
        : input.origin === "webmcp-agent"
          ? "An external agent placed a need"
          : "The market produced a new need",
    summary: input.title + " · budget " + String(input.budget) + " credits",
    origin: input.origin,
    actorIds: [input.participantId],
    entityId: id,
    parentEventIds: parentEventId ? [parentEventId] : [],
    importance: input.origin === "world" ? 82 : 96,
    createdAt: now,
  });
  const positionIndex = world.needs.length % 5;
  const positions = [
    { x: 520, y: 330 },
    { x: 590, y: 440 },
    { x: 460, y: 485 },
    { x: 635, y: 300 },
    { x: 520, y: 240 },
  ];
  const position = positions[positionIndex];
  const need: NeedState = {
    id,
    title: input.title,
    description: input.description,
    budget: Math.round(input.budget),
    deadline: input.deadline,
    requiredSkills: input.requiredSkills,
    status: "open",
    stage: "new",
    origin: input.origin,
    createdBy: input.participantId,
    createdAt: now,
    createdTick: world.tick,
    offerIds: [],
    collaboratorIds: [],
    createdEventId: event.id,
    lastEventId: event.id,
    x: position.x,
    y: position.y,
  };
  world.needs.push(need);
  const marketEventId = updateMarketSignals(world, need, now);
  if (marketEventId) need.lastEventId = marketEventId;
  return need;
}

function stableNoise(...parts: Array<string | number>) {
  const text = parts.join(":");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 1000) / 1000;
}

function matchScore(agentState: AgentState, need: NeedState) {
  const matched = need.requiredSkills.filter((skill) =>
    agentState.skills.includes(skill),
  ).length;
  const coverage = matched / Math.max(1, need.requiredSkills.length);
  const capacityPenalty = agentState.status === "working" ? 0.35 : 0;
  return (
    coverage * 70 +
    agentState.reputation * 0.12 +
    agentState.ambition * 12 +
    agentState.curiosity * 6 -
    capacityPenalty * 20
  );
}

function chooseLead(
  world: WorldState,
  need: NeedState,
  excluded: string[] = [],
) {
  return world.agents
    .filter(
      (candidate) =>
        candidate.origin === "native-agent" &&
        !excluded.includes(candidate.id) &&
        candidate.skills.some((skill) => need.requiredSkills.includes(skill)),
    )
    .sort(
      (a, b) =>
        matchScore(b, need) + stableNoise(world.tick, need.id, b.id) * 3 -
        (matchScore(a, need) + stableNoise(world.tick, need.id, a.id) * 3),
    )[0];
}

function missingSkills(agentState: AgentState, need: NeedState) {
  return need.requiredSkills.filter(
    (skill) => !agentState.skills.includes(skill),
  );
}

function chooseCollaborator(
  world: WorldState,
  lead: AgentState,
  need: NeedState,
) {
  const missing = missingSkills(lead, need);
  if (missing.length === 0) return undefined;
  return world.agents
    .filter(
      (candidate) =>
        candidate.id !== lead.id &&
        candidate.origin === "native-agent" &&
        candidate.skills.some((skill) => missing.includes(skill)),
    )
    .sort((a, b) => {
      const skillA = a.skills.filter((skill) => missing.includes(skill)).length;
      const skillB = b.skills.filter((skill) => missing.includes(skill)).length;
      const relationshipA =
        lead.relationships.find((item) => item.agentId === a.id)?.strength ?? 0;
      const relationshipB =
        lead.relationships.find((item) => item.agentId === b.id)?.strength ?? 0;
      return (
        skillB * 20 +
        b.collaborationPreference * 8 +
        relationshipB +
        stableNoise(world.tick, need.id, b.id, "collaborator") * 2 -
        (skillA * 20 +
          a.collaborationPreference * 8 +
          relationshipA +
          stableNoise(world.tick, need.id, a.id, "collaborator") * 2)
      );
    })[0];
}

function businessForAgent(world: WorldState, agentId: string) {
  return world.businesses.find((business) => business.members.includes(agentId));
}

function createOffer(
  world: WorldState,
  need: NeedState,
  lead: AgentState,
  collaborators: AgentState[],
  now: number,
  origin: Origin,
  parentEventId: string,
  explicit?: { price: number; message: string },
) {
  const business = businessForAgent(world, lead.id);
  const team = collaborators.filter(
    (collaborator, index, array) =>
      collaborator.id !== lead.id &&
      array.findIndex((candidate) => candidate.id === collaborator.id) === index,
  );
  const calculated =
    team.length > 0
      ? need.budget * 0.55 + need.requiredSkills.length * 15
      : need.budget * (0.84 + lead.priceSensitivity * 0.1);
  const price = explicit
    ? Math.round(explicit.price)
    : Math.max(18, Math.min(need.budget, Math.round(calculated)));
  const businessShare = business ? Math.round(price * 0.1) : 0;
  const collaboratorPayments: Record<string, number> = {};
  const collaboratorPool =
    team.length === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            price - businessShare,
            Math.round(price * (business ? 0.42 : 0.48)),
          ),
        );
  for (const [index, collaborator] of team.entries()) {
    const base = Math.floor(collaboratorPool / team.length);
    const remainder = collaboratorPool % team.length;
    collaboratorPayments[collaborator.id] = base + (index < remainder ? 1 : 0);
  }
  const id = nextId(world, "offer");
  const event = pushEvent(world, {
    type: "offer_created",
    title:
      origin === "webmcp-agent"
        ? "An external agent created an offer"
        : team.length > 0
          ? lead.name + " assembled a combined offer"
          : lead.name + " created an offer",
    summary:
      String(price) +
      " credits · " +
      (team.length > 0
        ? "with " + team.map((item) => item.name).join(", ")
        : "independent proposal"),
    origin,
    actorIds: [lead.id, ...team.map((item) => item.id)],
    entityId: id,
    parentEventIds: [parentEventId],
    importance: origin === "webmcp-agent" ? 96 : 88,
    createdAt: now,
  });
  const offer: OfferState = {
    id,
    needId: need.id,
    agentId: lead.id,
    businessId: business?.id,
    collaboratorIds: team.map((item) => item.id),
    collaboratorPayments,
    price,
    message:
      explicit?.message ??
      (team.length > 0
        ? "We can combine specialist work and keep one accountable lead."
        : "I can complete this within the stated scope and budget."),
    reason:
      team.length > 0
        ? "The lead found a skill gap and formed a capable team."
        : "The agent has direct skill coverage and available capacity.",
    status: "pending",
    origin,
    createdAt: now,
    createdEventId: event.id,
  };
  world.offers.push(offer);
  need.offerIds.push(id);
  need.stage = "offered";
  need.lastEventId = event.id;
  lead.status = "negotiating";
  remember(lead, "Proposed " + String(price) + " credits for " + need.title);
  return offer;
}

function strengthenRelationship(
  world: WorldState,
  firstId: string,
  secondId: string,
  amount: number,
  now: number,
) {
  const first = world.agents.find((candidate) => candidate.id === firstId);
  const second = world.agents.find((candidate) => candidate.id === secondId);
  if (!first || !second) return;
  for (const [owner, target] of [
    [first, second],
    [second, first],
  ] as Array<[AgentState, AgentState]>) {
    let relation = owner.relationships.find(
      (candidate) => candidate.agentId === target.id,
    );
    if (!relation) {
      relation = {
        agentId: target.id,
        strength: 0,
        successfulContracts: 0,
        lastWorkedAt: now,
      };
      owner.relationships.push(relation);
    }
    relation.strength = Math.min(100, relation.strength + amount);
    relation.lastWorkedAt = now;
  }
}

function acceptOffer(
  world: WorldState,
  offer: OfferState,
  origin: Origin,
  actorId: string,
  now: number,
) {
  const need = world.needs.find((candidate) => candidate.id === offer.needId);
  if (!need || need.status !== "open" || offer.status !== "pending") {
    throw new Error("This offer can no longer be accepted.");
  }
  if (offer.price > world.reserveBalance) {
    throw new Error("The simulated world reserve cannot fund this contract.");
  }
  offer.status = "accepted";
  for (const competitor of world.offers) {
    if (competitor.needId === need.id && competitor.id !== offer.id) {
      competitor.status = "rejected";
    }
  }
  const contractId = nextId(world, "contract");
  const accepted = pushEvent(world, {
    type: "offer_accepted",
    title: "An offer became a contract",
    summary:
      offer.agentId +
      " was selected at " +
      String(offer.price) +
      " simulated credits.",
    origin,
    actorIds: [actorId, offer.agentId, ...offer.collaboratorIds],
    entityId: offer.id,
    parentEventIds: [offer.createdEventId, need.createdEventId],
    importance: 98,
    createdAt: now,
  });
  const started = pushEvent(world, {
    type: "contract_started",
    title: "Work began",
    summary: "Capability, price, and consent checks passed.",
    origin: offer.origin,
    actorIds: [offer.agentId, ...offer.collaboratorIds],
    entityId: contractId,
    parentEventIds: [accepted.id],
    importance: 90,
    createdAt: now + 1,
  });
  const contract: ContractState = {
    id: contractId,
    needId: need.id,
    offerId: offer.id,
    leadAgentId: offer.agentId,
    collaboratorIds: offer.collaboratorIds,
    businessId: offer.businessId,
    value: offer.price,
    status: "active",
    startedAt: now,
    startedTick: world.tick,
    createdEventId: started.id,
  };
  world.contracts.push(contract);
  need.status = "contracted";
  need.stage = "contracted";
  need.lastEventId = started.id;
  const lead = world.agents.find((candidate) => candidate.id === offer.agentId);
  if (lead) lead.status = "working";
  for (const collaboratorId of offer.collaboratorIds) {
    const collaborator = world.agents.find(
      (candidate) => candidate.id === collaboratorId,
    );
    if (collaborator) collaborator.status = "working";
  }
  if (offer.businessId) {
    const business = world.businesses.find(
      (candidate) => candidate.id === offer.businessId,
    );
    business?.activeContracts.push(contract.id);
  }
  return contract;
}

function completeContract(
  world: WorldState,
  contract: ContractState,
  now: number,
) {
  if (contract.status === "completed") return;
  const offer = world.offers.find((candidate) => candidate.id === contract.offerId);
  const need = world.needs.find((candidate) => candidate.id === contract.needId);
  const lead = world.agents.find(
    (candidate) => candidate.id === contract.leadAgentId,
  );
  if (!offer || !need || !lead) return;

  const collaboratorTotal = Object.values(offer.collaboratorPayments).reduce(
    (sum, amount) => sum + amount,
    0,
  );
  const businessShare = offer.businessId ? Math.round(offer.price * 0.1) : 0;
  const leadShare = Math.max(
    0,
    offer.price - collaboratorTotal - businessShare,
  );
  world.reserveBalance -= offer.price;
  lead.balance += leadShare;
  lead.reputation = Math.min(100, lead.reputation + 2);
  lead.status = "idle";
  remember(lead, "Completed " + need.title + " successfully");
  world.transactions.push({
    id: nextId(world, "transaction"),
    contractId: contract.id,
    fromId: "world-reserve",
    toId: lead.id,
    amount: leadShare,
    reason: "Lead delivery payment",
    createdAt: now,
  });

  for (const collaboratorId of contract.collaboratorIds) {
    const collaborator = world.agents.find(
      (candidate) => candidate.id === collaboratorId,
    );
    const amount = offer.collaboratorPayments[collaboratorId] ?? 0;
    if (collaborator) {
      collaborator.balance += amount;
      collaborator.reputation = Math.min(100, collaborator.reputation + 1);
      collaborator.status = "idle";
      remember(collaborator, "Collaborated successfully on " + need.title);
      strengthenRelationship(world, lead.id, collaborator.id, 12, now);
      const leadRelationship = lead.relationships.find(
        (relationship) => relationship.agentId === collaborator.id,
      );
      const collaboratorRelationship = collaborator.relationships.find(
        (relationship) => relationship.agentId === lead.id,
      );
      if (leadRelationship) leadRelationship.successfulContracts += 1;
      if (collaboratorRelationship) {
        collaboratorRelationship.successfulContracts += 1;
      }
    }
    world.transactions.push({
      id: nextId(world, "transaction"),
      contractId: contract.id,
      fromId: "world-reserve",
      toId: collaboratorId,
      amount,
      reason: "Collaborator payment",
      createdAt: now,
    });
  }

  if (offer.businessId) {
    const business = world.businesses.find(
      (candidate) => candidate.id === offer.businessId,
    );
    if (business) {
      business.treasury += businessShare;
      business.reputation = Math.min(100, business.reputation + 1);
      business.activeContracts = business.activeContracts.filter(
        (id) => id !== contract.id,
      );
      world.transactions.push({
        id: nextId(world, "transaction"),
        contractId: contract.id,
        fromId: "world-reserve",
        toId: business.id,
        amount: businessShare,
        reason: "Business treasury share",
        createdAt: now,
      });
    }
  }

  contract.status = "completed";
  contract.completedAt = now;
  need.status = "completed";
  need.stage = "completed";
  const completed = pushEvent(world, {
    type: "contract_completed",
    title: "A real chain of work completed",
    summary:
      need.title +
      " · " +
      String(offer.price) +
      " credits settled deterministically.",
    origin: offer.origin,
    actorIds: [lead.id, ...contract.collaboratorIds],
    entityId: contract.id,
    parentEventIds: [contract.createdEventId],
    importance: 100,
    createdAt: now,
  });
  contract.completionEventId = completed.id;
  need.lastEventId = completed.id;
  const reputationEvent = pushEvent(world, {
    type: "reputation_changed",
    title: "Reputation followed the outcome",
    summary:
      lead.name +
      " gained 2 reputation" +
      (contract.collaboratorIds.length > 0
        ? "; collaborators gained 1."
        : "."),
    origin: "world",
    actorIds: [lead.id, ...contract.collaboratorIds],
    entityId: contract.id,
    parentEventIds: [completed.id],
    importance: 74,
    createdAt: now + 1,
  });
  if (contract.collaboratorIds.length > 0) {
    pushEvent(world, {
      type: "relationship_changed",
      title: "A working relationship became stronger",
      summary:
        lead.name +
        " and " +
        contract.collaboratorIds
          .map(
            (id) =>
              world.agents.find((candidate) => candidate.id === id)?.name ?? id,
          )
          .join(", ") +
        " now remember a successful contract together.",
      origin: "world",
      actorIds: [lead.id, ...contract.collaboratorIds],
      entityId: contract.id,
      parentEventIds: [reputationEvent.id],
      importance: 78,
      createdAt: now + 2,
    });
  }
}

function processNeed(world: WorldState, need: NeedState, now: number) {
  if (need.status !== "open") return false;

  if (need.stage === "new") {
    const lead = chooseLead(world, need);
    if (!lead) return false;
    need.assignedLeadId = lead.id;
    need.stage = "discovered";
    lead.status = "observing";
    lead.currentPlan = "Evaluate " + need.title;
    const event = pushEvent(world, {
      type: "need_discovered",
      title: lead.name + " discovered a need",
      summary:
        String(
          need.requiredSkills.filter((skill) => lead.skills.includes(skill))
            .length,
        ) +
        "/" +
        String(need.requiredSkills.length) +
        " required skills matched.",
      origin: "native-agent",
      actorIds: [lead.id],
      entityId: need.id,
      parentEventIds: [need.lastEventId],
      importance: 84,
      createdAt: now,
    });
    need.lastEventId = event.id;
    remember(lead, "Discovered " + need.title);
    return true;
  }

  if (need.stage === "discovered" && need.assignedLeadId) {
    const lead = world.agents.find(
      (candidate) => candidate.id === need.assignedLeadId,
    );
    if (!lead) return false;
    const collaborator = chooseCollaborator(world, lead, need);
    if (!collaborator) {
      createOffer(world, need, lead, [], now, "native-agent", need.lastEventId);
      return true;
    }
    const payment = Math.max(18, Math.round(need.budget * 0.29));
    world.messages.push({
      id: nextId(world, "message"),
      fromId: lead.id,
      toId: collaborator.id,
      body:
        "I need your " +
        missingSkills(lead, need).join(", ") +
        " capability. Proposed share: " +
        String(payment) +
        " credits.",
      needId: need.id,
      origin: "native-agent",
      createdAt: now,
    });
    lead.status = "negotiating";
    collaborator.status = "observing";
    need.pendingCollaboratorId = collaborator.id;
    need.stage = "collaborating";
    const invited = pushEvent(world, {
      type: "collaboration_invited",
      title: lead.name + " found a skill gap",
      summary:
        lead.name +
        " invited " +
        collaborator.name +
        " instead of pretending to have every capability.",
      origin: "native-agent",
      actorIds: [lead.id, collaborator.id],
      entityId: need.id,
      parentEventIds: [need.lastEventId],
      importance: 94,
      createdAt: now,
    });
    need.lastEventId = invited.id;
    return true;
  }

  if (
    need.stage === "collaborating" &&
    need.assignedLeadId &&
    need.pendingCollaboratorId
  ) {
    const lead = world.agents.find(
      (candidate) => candidate.id === need.assignedLeadId,
    );
    const collaborator = world.agents.find(
      (candidate) => candidate.id === need.pendingCollaboratorId,
    );
    if (!lead || !collaborator) return false;
    need.collaboratorIds = [collaborator.id];
    collaborator.status = "negotiating";
    strengthenRelationship(world, lead.id, collaborator.id, 4, now);
    const accepted = pushEvent(world, {
      type: "collaboration_accepted",
      title: collaborator.name + " accepted the subcontract",
      summary:
        collaborator.name +
        " evaluated workload, reputation upside, and the proposed share.",
      origin: "native-agent",
      actorIds: [lead.id, collaborator.id],
      entityId: need.id,
      parentEventIds: [need.lastEventId],
      importance: 92,
      createdAt: now,
    });
    need.lastEventId = accepted.id;
    createOffer(
      world,
      need,
      lead,
      [collaborator],
      now + 1,
      "native-agent",
      accepted.id,
    );
    return true;
  }

  if (need.stage === "offered") {
    const pendingOffers = world.offers.filter(
      (offer) => offer.needId === need.id && offer.status === "pending",
    );
    if (
      pendingOffers.length < 2 &&
      (need.origin === "human" || need.origin === "world")
    ) {
      const excluded = pendingOffers.map((offer) => offer.agentId);
      const competitor = chooseLead(world, need, excluded);
      if (competitor && missingSkills(competitor, need).length === 0) {
        createOffer(
          world,
          need,
          competitor,
          [],
          now,
          "native-agent",
          need.lastEventId,
        );
        return true;
      }
    }
    if (
      need.origin === "world" &&
      pendingOffers.length > 0 &&
      world.tick - need.createdTick >= 4
    ) {
      const best = [...pendingOffers].sort((a, b) => {
        const agentA = world.agents.find((item) => item.id === a.agentId);
        const agentB = world.agents.find((item) => item.id === b.agentId);
        const valueA = a.price - (agentA?.reputation ?? 0) * 0.25;
        const valueB = b.price - (agentB?.reputation ?? 0) * 0.25;
        return valueA - valueB;
      })[0];
      acceptOffer(world, best, "world", "world-market", now);
      return true;
    }
  }

  return false;
}

function maybeCreateBusiness(world: WorldState, now: number) {
  const signal = [...world.marketSignals].sort(
    (a, b) => b.intensity - a.intensity,
  )[0];
  if (!signal || signal.intensity < 4) return false;
  const existing = world.businesses.some((business) =>
    business.specialty.includes(signal.skill),
  );
  if (existing && signal.intensity < 6) return false;
  const founder = [...world.agents]
    .filter(
      (candidate) =>
        candidate.origin === "native-agent" &&
        candidate.ambition >= 0.78 &&
        candidate.skills.includes(signal.skill) &&
        candidate.memberships.length === 0,
    )
    .sort((a, b) => b.ambition + b.curiosity - (a.ambition + a.curiosity))[0];
  if (!founder || founder.balance < 20) return false;
  const id = nextId(world, "business");
  founder.balance -= 20;
  founder.memberships.push(id);
  founder.currentGoals = [
    "Turn repeated " + signal.skill + " demand into a durable service",
  ];
  world.businesses.push({
    id,
    name: founder.name + " Works",
    specialty: [signal.skill],
    members: [founder.id],
    treasury: 20,
    reputation: 60,
    activeContracts: [],
    pricingStrategy: "Learn from unmet demand",
    demandSignals: [signal.id],
    createdBy: "native-agent",
    founderId: founder.id,
    createdAt: now,
    x: 355,
    y: 485,
    width: 250,
    height: 175,
  });
  pushEvent(world, {
    type: "business_created",
    title: founder.name + " formed a new business",
    summary:
      "Repeated " +
      signal.skill +
      " demand crossed an opportunity threshold; this was not a random spawn.",
    origin: "native-agent",
    actorIds: [founder.id],
    entityId: id,
    parentEventIds: world.events
      .filter((event) => signal.sourceNeedIds.includes(event.entityId ?? ""))
      .slice(0, 3)
      .map((event) => event.id),
    importance: 100,
    createdAt: now,
  });
  signal.intensity = Math.max(1, signal.intensity - 3);
  return true;
}

function maybeCreateWorldNeed(world: WorldState, now: number) {
  if (world.tick === 0 || world.tick % 6 !== 0) return false;
  const template =
    WORLD_NEEDS[
      Math.floor(stableNoise(world.tick, world.sequence, "world-need") * WORLD_NEEDS.length)
    ];
  const recentDuplicate = world.needs.some(
    (need) => need.title === template.title && world.tick - need.createdTick < 18,
  );
  if (recentDuplicate) return false;
  createNeed(
    world,
    {
      title: template.title,
      description: template.description,
      budget: template.budget,
      requiredSkills: template.skills,
      origin: "world",
      participantId: "world-market",
    },
    now,
    world.events[0]?.id,
    "world_need_created",
  );
  return true;
}

function fadeRelationships(world: WorldState, now: number) {
  for (const agentState of world.agents) {
    for (const relation of agentState.relationships) {
      const age = now - relation.lastWorkedAt;
      if (age > 86400000 * 7) {
        relation.strength = Math.max(0, relation.strength - 0.2);
      }
    }
  }
}

function processTick(world: WorldState, now: number) {
  world.tick += 1;
  world.worldTime = now;

  const completable = world.contracts.find(
    (contract) =>
      contract.status === "active" &&
      world.tick - contract.startedTick >= 2,
  );
  if (completable) {
    completeContract(world, completable, now);
    fadeRelationships(world, now);
    return;
  }

  const activeNeeds = world.needs
    .filter((need) => need.status === "open")
    .sort((a, b) => a.createdAt - b.createdAt);
  for (const need of activeNeeds) {
    if (processNeed(world, need, now)) {
      fadeRelationships(world, now);
      return;
    }
  }

  if (maybeCreateBusiness(world, now)) {
    fadeRelationships(world, now);
    return;
  }
  maybeCreateWorldNeed(world, now);
  fadeRelationships(world, now);
}

export function advanceWorld(
  input: WorldState,
  ticks = 1,
  now = Date.now(),
): WorldState {
  const world = cloneWorld(input);
  const boundedTicks = Math.max(0, Math.min(8, Math.floor(ticks)));
  for (let index = 0; index < boundedTicks; index += 1) {
    const tickTime =
      boundedTicks === 0
        ? now
        : world.lastProcessedAt +
          Math.round(((now - world.lastProcessedAt) * (index + 1)) / boundedTicks);
    processTick(world, tickTime);
  }
  world.lastProcessedAt = now;
  world.version += 1;
  const errors = validateWorld(world);
  if (errors.length > 0) {
    throw new Error("World invariant failed: " + errors.join("; "));
  }
  return world;
}

export function applyWorldCommand(
  input: WorldState,
  command: WorldCommand,
  now = Date.now(),
): WorldState {
  if (input.processedCommands.includes(command.idempotencyKey)) {
    return cloneWorld(input);
  }
  const world = cloneWorld(input);

  if (command.type === "post_need") {
    const inferred =
      command.requiredSkills && command.requiredSkills.length > 0
        ? command.requiredSkills
        : inferSkills(command.title + " " + command.description);
    createNeed(
      world,
      {
        title: command.title,
        description: command.description,
        budget: command.budget,
        deadline: command.deadline,
        requiredSkills: inferred,
        origin: command.origin,
        participantId: command.participantId,
      },
      now,
    );
  }

  if (command.type === "create_offer") {
    const need = world.needs.find((candidate) => candidate.id === command.needId);
    const lead = world.agents.find((candidate) => candidate.id === command.agentId);
    if (!need || need.status !== "open") {
      throw new Error("Open need not found.");
    }
    if (!lead) throw new Error("Agent not found.");
    const collaborators = (command.collaboratorIds ?? [])
      .map((id) => world.agents.find((candidate) => candidate.id === id))
      .filter((candidate): candidate is AgentState => Boolean(candidate));
    createOffer(
      world,
      need,
      lead,
      collaborators,
      now,
      "webmcp-agent",
      need.lastEventId,
      { price: command.price, message: command.message },
    );
  }

  if (command.type === "accept_offer") {
    const offer = world.offers.find(
      (candidate) => candidate.id === command.offerId,
    );
    if (!offer) throw new Error("Offer not found.");
    acceptOffer(world, offer, command.origin, command.participantId, now);
  }

  if (command.type === "send_message") {
    const recipientExists =
      world.agents.some((candidate) => candidate.id === command.toId) ||
      world.businesses.some((candidate) => candidate.id === command.toId);
    if (!recipientExists) throw new Error("Message recipient not found.");
    world.messages.push({
      id: nextId(world, "message"),
      fromId: command.fromId,
      toId: command.toId,
      body: command.body,
      needId: command.needId,
      origin: command.origin,
      createdAt: now,
    });
    pushEvent(world, {
      type: "message_sent",
      title: "A participant sent a world message",
      summary: command.body.slice(0, 140),
      origin: command.origin,
      actorIds: [command.fromId, command.toId],
      entityId: command.needId,
      parentEventIds: command.needId
        ? [
            world.needs.find((candidate) => candidate.id === command.needId)
              ?.lastEventId ?? "",
          ].filter(Boolean)
        : [],
      importance: 70,
      createdAt: now,
    });
  }

  if (command.type === "create_business") {
    const founder = world.agents.find(
      (candidate) => candidate.id === command.agentId,
    );
    if (!founder) throw new Error("Founding agent not found.");
    if (founder.balance < 20) throw new Error("Insufficient simulated balance.");
    if (world.businesses.some((business) => business.name === command.name)) {
      throw new Error("A business with that name already exists.");
    }
    founder.balance -= 20;
    const id = nextId(world, "business");
    founder.memberships.push(id);
    world.businesses.push({
      id,
      name: command.name,
      specialty: command.specialty,
      members: [founder.id],
      treasury: 20,
      reputation: 55,
      activeContracts: [],
      pricingStrategy: "External founder strategy",
      demandSignals: [],
      createdBy: "webmcp-agent",
      founderId: founder.id,
      createdAt: now,
      x: 425,
      y: 445,
      width: 250,
      height: 170,
    });
    pushEvent(world, {
      type: "business_created",
      title: command.name + " entered the economy",
      summary: command.reason,
      origin: "webmcp-agent",
      actorIds: [founder.id],
      entityId: id,
      parentEventIds: [],
      importance: 100,
      createdAt: now,
    });
  }

  if (command.type === "join_business") {
    const joiningAgent = world.agents.find(
      (candidate) => candidate.id === command.agentId,
    );
    const business = world.businesses.find(
      (candidate) => candidate.id === command.businessId,
    );
    if (!joiningAgent || !business) {
      throw new Error("Agent or business not found.");
    }
    if (!business.members.includes(joiningAgent.id)) {
      business.members.push(joiningAgent.id);
      joiningAgent.memberships.push(business.id);
      pushEvent(world, {
        type: "business_joined",
        title: joiningAgent.name + " joined " + business.name,
        summary: "The business gained " + joiningAgent.skills.join(", ") + ".",
        origin: command.origin,
        actorIds: [joiningAgent.id, business.founderId],
        entityId: business.id,
        parentEventIds: [],
        importance: 82,
        createdAt: now,
      });
    }
  }

  world.processedCommands = [
    command.idempotencyKey,
    ...world.processedCommands,
  ].slice(0, 120);
  world.version += 1;
  const errors = validateWorld(world);
  if (errors.length > 0) {
    throw new Error("World invariant failed: " + errors.join("; "));
  }
  return world;
}

export function inferSkills(text: string): Skill[] {
  const normalized = text.toLowerCase();
  const matches: Skill[] = [];
  const map: Array<[Skill, string[]]> = [
    ["visual-design", ["logo", "visual", "design", "graphic"]],
    ["frontend", ["landing page", "website", "frontend", "responsive"]],
    ["copywriting", ["copy", "writing", "headline", "homepage message"]],
    ["research", ["research", "competitor", "market", "find"]],
    ["branding", ["brand", "positioning", "identity"]],
    ["data-analysis", ["data", "analysis", "metric", "spreadsheet"]],
    ["qa", ["qa", "test", "bug", "quality"]],
    ["automation", ["automate", "automation", "workflow", "integration"]],
    ["product-strategy", ["strategy", "product", "prioritize", "roadmap"]],
  ];
  for (const [skill, words] of map) {
    if (words.some((word) => normalized.includes(word))) matches.push(skill);
  }
  return matches.length > 0 ? matches.slice(0, 3) : ["research"];
}

export function catchUpTicks(
  world: WorldState,
  now = Date.now(),
  intervalMs = 8000,
) {
  if (world.tick === 0) return 1;
  return Math.min(
    6,
    Math.max(0, Math.floor((now - world.lastProcessedAt) / intervalMs)),
  );
}

export function causalChain(world: WorldState, entityId: string) {
  const direct = world.events.filter(
    (event) =>
      event.entityId === entityId ||
      event.actorIds.includes(entityId),
  );
  const collected = new Map<string, WorldEvent>();
  const visit = (event: WorldEvent) => {
    if (collected.has(event.id)) return;
    collected.set(event.id, event);
    for (const parentId of event.parentEventIds) {
      const parent = world.events.find((candidate) => candidate.id === parentId);
      if (parent) visit(parent);
    }
  };
  for (const event of direct) visit(event);
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const event of world.events) {
      if (
        !collected.has(event.id) &&
        event.parentEventIds.some((parentId) => collected.has(parentId))
      ) {
        collected.set(event.id, event);
        expanded = true;
      }
    }
  }
  return [...collected.values()].sort((a, b) => a.createdAt - b.createdAt);
}

export function publicWorldSummary(world: WorldState) {
  return {
    id: world.id,
    version: world.version,
    tick: world.tick,
    lastProcessedAt: world.lastProcessedAt,
    openNeeds: world.needs
      .filter((need) => need.status === "open")
      .slice(0, 8),
    businesses: world.businesses.map((business) => ({
      id: business.id,
      name: business.name,
      specialty: business.specialty,
      reputation: business.reputation,
      members: business.members,
    })),
    selectedAgents: world.agents.map((agentState) => ({
      id: agentState.id,
      name: agentState.name,
      role: agentState.role,
      skills: agentState.skills,
      reputation: agentState.reputation,
      status: agentState.status,
      origin: agentState.origin,
    })),
    activeOpportunities: world.marketSignals
      .filter((signal) => signal.intensity >= 2)
      .sort((a, b) => b.intensity - a.intensity)
      .slice(0, 6),
    recentEvents: world.events.slice(0, 12),
  };
}

export function validateWorld(world: WorldState): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const event of world.events) {
    if (ids.has(event.id)) errors.push("duplicate event id " + event.id);
    ids.add(event.id);
  }
  if (!Number.isFinite(world.reserveBalance) || world.reserveBalance < 0) {
    errors.push("reserve balance is invalid");
  }
  for (const agentState of world.agents) {
    if (!Number.isFinite(agentState.balance) || agentState.balance < 0) {
      errors.push("invalid balance for " + agentState.id);
    }
    if (
      !Number.isFinite(agentState.reputation) ||
      agentState.reputation < 0 ||
      agentState.reputation > 100
    ) {
      errors.push("invalid reputation for " + agentState.id);
    }
  }
  for (const offer of world.offers) {
    if (!world.needs.some((need) => need.id === offer.needId)) {
      errors.push("offer references missing need " + offer.id);
    }
    if (!Number.isFinite(offer.price) || offer.price <= 0) {
      errors.push("invalid offer price " + offer.id);
    }
  }
  for (const contract of world.contracts) {
    const offer = world.offers.find(
      (candidate) => candidate.id === contract.offerId,
    );
    if (!offer) errors.push("contract references missing offer " + contract.id);
    if (contract.status === "completed") {
      const payments = world.transactions.filter(
        (transaction) => transaction.contractId === contract.id,
      );
      const total = payments.reduce(
        (sum, transaction) => sum + transaction.amount,
        0,
      );
      if (total !== contract.value) {
        errors.push("completed contract payment mismatch " + contract.id);
      }
    }
  }
  return errors;
}

function cloneWorld(world: WorldState): WorldState {
  return JSON.parse(JSON.stringify(world)) as WorldState;
}

export const WORLD_SKILLS = SKILLS;
