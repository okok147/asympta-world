import type {
  AgentState,
  Skill,
  TransactionState,
  WorldEvent,
  WorldState,
} from "@/lib/world-engine";

type ThoughtKind =
  | "energy"
  | "food"
  | "skill"
  | "enquiry"
  | "deal"
  | "resource"
  | "status";

type AgentThought = {
  kind: ThoughtKind;
  text: string;
  createdAt: number;
  expiresAt: number;
  targetId?: string;
};

type Destination = {
  x: number;
  y: number;
  label: string;
  reason: string;
};

type LivingAgent = AgentState & {
  energy?: number;
  food?: number;
  resources?: number;
  skillPractice?: Partial<Record<Skill, number>>;
  thought?: AgentThought;
  destination?: Destination;
  lastAutonomousActionAt?: number;
};

const MIN_X = 68;
const MAX_X = 1132;
const MIN_Y = 78;
const MAX_Y = 688;
const THOUGHT_LIFETIME = 10500;

function stableNoise(...parts: Array<string | number>) {
  const text = parts.join(":");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function living(agent: AgentState) {
  return agent as LivingAgent;
}

function nextId(world: WorldState, prefix: string) {
  world.sequence += 1;
  return prefix + "-" + world.sequence.toString(36);
}

function hydrateAgent(agent: LivingAgent, world: WorldState, now: number) {
  if (!Number.isFinite(agent.energy)) {
    agent.energy = Math.round(58 + stableNoise(world.id, agent.id, "energy") * 34);
  }
  if (!Number.isFinite(agent.food)) {
    agent.food = 1 + Math.floor(stableNoise(world.id, agent.id, "food") * 4);
  }
  if (!Number.isFinite(agent.resources)) {
    agent.resources = Math.floor(stableNoise(world.id, agent.id, "resource") * 4);
  }
  if (!agent.skillPractice) agent.skillPractice = {};
  if (!agent.thought) {
    agent.thought = {
      kind: "status",
      text: agent.status === "idle" ? "Looking around" : agent.status,
      createdAt: now,
      expiresAt: now + THOUGHT_LIFETIME,
    };
  }
}

function setThought(
  agent: LivingAgent,
  kind: ThoughtKind,
  text: string,
  now: number,
  targetId?: string,
) {
  agent.thought = {
    kind,
    text,
    createdAt: now,
    expiresAt: now + THOUGHT_LIFETIME,
    targetId,
  };
  agent.lastAutonomousActionAt = now;
}

function pushAutonomousEvent(
  world: WorldState,
  input: Omit<WorldEvent, "id" | "type"> & { type: string },
) {
  const event = {
    ...input,
    id: nextId(world, "event"),
    type: input.type as WorldEvent["type"],
  } satisfies WorldEvent;
  world.events = [event, ...world.events].slice(0, 140);
  return event;
}

function pushTrade(
  world: WorldState,
  fromId: string,
  toId: string,
  amount: number,
  reason: string,
  now: number,
) {
  const transaction = {
    id: nextId(world, "transaction"),
    contractId: "autonomous-market",
    fromId,
    toId,
    amount,
    reason,
    createdAt: now,
  } satisfies TransactionState;
  world.transactions = [...world.transactions, transaction].slice(-420);
}

function nearestAgent(
  world: WorldState,
  source: LivingAgent,
  predicate: (candidate: LivingAgent) => boolean,
) {
  return world.agents
    .map(living)
    .filter((candidate) => candidate.id !== source.id && predicate(candidate))
    .sort((a, b) => {
      const distanceA = Math.hypot(a.x - source.x, a.y - source.y);
      const distanceB = Math.hypot(b.x - source.x, b.y - source.y);
      return distanceA - distanceB;
    })[0];
}

function targetForAgent(world: WorldState, agent: LivingAgent): Destination {
  if (agent.thought?.targetId) {
    const peer = world.agents.find((candidate) => candidate.id === agent.thought?.targetId);
    if (peer) {
      return {
        x: peer.x + 44,
        y: peer.y + 18,
        label: peer.name,
        reason: "interaction",
      };
    }
    const business = world.businesses.find(
      (candidate) => candidate.id === agent.thought?.targetId,
    );
    if (business) {
      return {
        x: business.x + business.width / 2,
        y: business.y + business.height / 2,
        label: business.name,
        reason: "business",
      };
    }
  }

  if (agent.status === "working") {
    const activeContract = world.contracts.find(
      (contract) =>
        contract.status === "active" &&
        (contract.leadAgentId === agent.id || contract.collaboratorIds.includes(agent.id)),
    );
    const need = activeContract
      ? world.needs.find((candidate) => candidate.id === activeContract.needId)
      : undefined;
    if (need) {
      return { x: need.x, y: need.y, label: need.title, reason: "work" };
    }
  }

  if (agent.status === "observing" || agent.status === "negotiating") {
    const need = [...world.needs]
      .reverse()
      .find(
        (candidate) =>
          candidate.status === "open" &&
          (candidate.assignedLeadId === agent.id ||
            candidate.pendingCollaboratorId === agent.id ||
            candidate.collaboratorIds.includes(agent.id)),
      );
    if (need) {
      return { x: need.x, y: need.y, label: need.title, reason: agent.status };
    }
  }

  const home = world.businesses.find((business) => business.members.includes(agent.id));
  const wanderSeed = stableNoise(world.tick, agent.id, "wander");
  if (home && wanderSeed < 0.64) {
    return {
      x: home.x + 56 + stableNoise(world.tick, agent.id, "home-x") * (home.width - 112),
      y: home.y + 68 + stableNoise(world.tick, agent.id, "home-y") * (home.height - 106),
      label: home.name,
      reason: "home base",
    };
  }

  return {
    x: MIN_X + stableNoise(world.tick, agent.id, "world-x") * (MAX_X - MIN_X),
    y: MIN_Y + stableNoise(world.tick, agent.id, "world-y") * (MAX_Y - MIN_Y),
    label: "open world",
    reason: "explore",
  };
}

function moveAgents(world: WorldState) {
  for (const raw of world.agents) {
    const agent = living(raw);
    const target = targetForAgent(world, agent);
    agent.destination = target;
    const dx = target.x - agent.x;
    const dy = target.y - agent.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 3) continue;
    const pace =
      agent.status === "working"
        ? 31
        : agent.status === "negotiating"
          ? 27
          : 20 + stableNoise(world.tick, agent.id, "pace") * 9;
    const step = Math.min(distance, pace);
    agent.x = Math.round(clamp(agent.x + (dx / distance) * step, MIN_X, MAX_X));
    agent.y = Math.round(clamp(agent.y + (dy / distance) * step, MIN_Y, MAX_Y));
  }
}

function metabolize(world: WorldState, now: number) {
  for (const raw of world.agents) {
    const agent = living(raw);
    const drain = 1.6 + stableNoise(world.tick, agent.id, "drain") * 2.2;
    agent.energy = clamp((agent.energy ?? 70) - drain, 4, 100);

    if ((agent.energy ?? 70) < 38 && (agent.food ?? 0) > 0) {
      agent.food = Math.max(0, (agent.food ?? 0) - 1);
      agent.energy = clamp((agent.energy ?? 0) + 38, 0, 100);
      setThought(
        agent,
        "energy",
        "Ate food · energy " + String(Math.round(agent.energy)),
        now,
      );
    } else if ((agent.energy ?? 70) < 48 && (agent.food ?? 0) === 0) {
      setThought(agent, "food", "Need food", now);
    } else if (stableNoise(world.tick, agent.id, "status-thought") > 0.9) {
      setThought(
        agent,
        "status",
        agent.status === "idle"
          ? "Scanning nearby activity"
          : agent.status + " · energy " + String(Math.round(agent.energy ?? 0)),
        now,
      );
    }
  }
}

function maybeFoodTrade(world: WorldState, now: number) {
  const buyers = world.agents
    .map(living)
    .filter(
      (agent) =>
        (agent.food ?? 0) <= 1 &&
        agent.balance >= 4 &&
        ((agent.energy ?? 80) < 66 || stableNoise(world.tick, agent.id, "food-want") > 0.76),
    )
    .sort((a, b) => (a.energy ?? 100) - (b.energy ?? 100));
  const buyer = buyers[0];
  if (!buyer) return false;
  const seller = nearestAgent(
    world,
    buyer,
    (candidate) =>
      (candidate.food ?? 0) >= 3 &&
      (candidate.energy ?? 0) >= 46 &&
      candidate.status !== "working",
  );
  if (!seller) return false;

  const price = Math.max(
    3,
    Math.min(8, Math.round(3 + seller.priceSensitivity * 4 + stableNoise(world.tick, buyer.id, seller.id) * 2)),
  );
  if (buyer.balance < price) return false;
  buyer.balance -= price;
  seller.balance += price;
  buyer.food = (buyer.food ?? 0) + 1;
  seller.food = Math.max(0, (seller.food ?? 0) - 1);
  setThought(buyer, "deal", "Bought food · -" + String(price) + "cr", now, seller.id);
  setThought(seller, "food", "Sold food · +" + String(price) + "cr", now, buyer.id);
  pushTrade(world, buyer.id, seller.id, price, "Autonomous food trade", now);
  pushAutonomousEvent(world, {
    type: "resource_trade",
    title: buyer.name + " bought food from " + seller.name,
    summary:
      "Low food stock triggered a direct " + String(price) + " credit trade between two agents.",
    origin: "native-agent",
    actorIds: [buyer.id, seller.id],
    entityId: buyer.id,
    parentEventIds: world.events[0] ? [world.events[0].id] : [],
    importance: 82,
    createdAt: now,
  });
  return true;
}

function maybeResourceTrade(world: WorldState, now: number) {
  const buyer = world.agents
    .map(living)
    .filter(
      (agent) =>
        (agent.resources ?? 0) === 0 &&
        agent.balance >= 5 &&
        stableNoise(world.tick, agent.id, "resource-need") > 0.46,
    )
    .sort(
      (a, b) =>
        stableNoise(world.tick, b.id, "resource-rank") -
        stableNoise(world.tick, a.id, "resource-rank"),
    )[0];
  if (!buyer) return false;
  const seller = nearestAgent(
    world,
    buyer,
    (candidate) => (candidate.resources ?? 0) >= 2,
  );
  if (!seller) return false;
  const price = 5 + Math.floor(stableNoise(world.tick, buyer.id, seller.id, "resource-price") * 6);
  if (buyer.balance < price) return false;

  buyer.balance -= price;
  seller.balance += price;
  buyer.resources = (buyer.resources ?? 0) + 1;
  seller.resources = Math.max(0, (seller.resources ?? 0) - 1);
  setThought(buyer, "resource", "Resource +1 · -" + String(price) + "cr", now, seller.id);
  setThought(seller, "deal", "Resource sold · +" + String(price) + "cr", now, buyer.id);
  pushTrade(world, buyer.id, seller.id, price, "Autonomous resource exchange", now);
  pushAutonomousEvent(world, {
    type: "resource_trade",
    title: buyer.name + " sourced a resource from " + seller.name,
    summary:
      "Inventory pressure produced a voluntary " + String(price) + " credit exchange.",
    origin: "native-agent",
    actorIds: [buyer.id, seller.id],
    entityId: buyer.id,
    parentEventIds: world.events[0] ? [world.events[0].id] : [],
    importance: 76,
    createdAt: now,
  });
  return true;
}

function maybeSkillExchange(world: WorldState, now: number) {
  const learners = world.agents
    .map(living)
    .filter(
      (agent) =>
        agent.balance >= 6 &&
        agent.skills.length < 5 &&
        agent.curiosity >= 0.58 &&
        stableNoise(world.tick, agent.id, "learn") > 0.42,
    )
    .sort((a, b) => b.curiosity - a.curiosity);
  const learner = learners[0];
  if (!learner) return false;
  const teacher = nearestAgent(
    world,
    learner,
    (candidate) => candidate.skills.some((skill) => !learner.skills.includes(skill)),
  );
  if (!teacher) return false;
  const skill = teacher.skills.find((candidate) => !learner.skills.includes(candidate));
  if (!skill) return false;
  const price = 5 + Math.round(teacher.reputation / 32);
  if (learner.balance < price) return false;

  learner.balance -= price;
  teacher.balance += price;
  const previous = learner.skillPractice?.[skill] ?? 0;
  const progress = previous + 1;
  if (!learner.skillPractice) learner.skillPractice = {};
  learner.skillPractice[skill] = progress;
  const learned = progress >= 3 && !learner.skills.includes(skill);
  if (learned) learner.skills.push(skill);

  setThought(
    learner,
    "skill",
    learned ? "Learned " + skill : skill + " practice " + String(progress) + "/3",
    now,
    teacher.id,
  );
  setThought(teacher, "deal", "Shared " + skill + " · +" + String(price) + "cr", now, learner.id);
  pushTrade(world, learner.id, teacher.id, price, "Autonomous skill exchange: " + skill, now);
  pushAutonomousEvent(world, {
    type: learned ? "skill_learned" : "skill_exchange",
    title:
      learner.name +
      (learned ? " learned " : " practised ") +
      skill +
      " with " +
      teacher.name,
    summary:
      "Curiosity, missing capability, proximity, and price produced a " +
      String(price) +
      " credit learning exchange.",
    origin: "native-agent",
    actorIds: [learner.id, teacher.id],
    entityId: learner.id,
    parentEventIds: world.events[0] ? [world.events[0].id] : [],
    importance: learned ? 88 : 79,
    createdAt: now,
  });
  return true;
}

function maybeEnquiry(world: WorldState, now: number) {
  const asker = world.agents
    .map(living)
    .filter((agent) => agent.status !== "working")
    .sort(
      (a, b) =>
        stableNoise(world.tick, b.id, "ask") - stableNoise(world.tick, a.id, "ask"),
    )[0];
  if (!asker) return false;
  const peer = nearestAgent(world, asker, () => true);
  if (!peer) return false;
  const topics = [
    "Any work nearby?",
    "What are you learning?",
    "Do you have spare resources?",
    "What skill is in demand?",
    "Want to compare opportunities?",
  ];
  const text = topics[Math.floor(stableNoise(world.tick, asker.id, peer.id, "topic") * topics.length)];
  world.messages = [
    ...world.messages,
    {
      id: nextId(world, "message"),
      fromId: asker.id,
      toId: peer.id,
      body: text,
      origin: "native-agent",
      createdAt: now,
    },
  ].slice(-220);
  setThought(asker, "enquiry", text, now, peer.id);
  setThought(peer, "status", "Listening to " + asker.name, now, asker.id);
  pushAutonomousEvent(world, {
    type: "message_sent",
    title: asker.name + " asked " + peer.name + " a spontaneous question",
    summary: text,
    origin: "native-agent",
    actorIds: [asker.id, peer.id],
    entityId: asker.id,
    parentEventIds: world.events[0] ? [world.events[0].id] : [],
    importance: 64,
    createdAt: now,
  });
  return true;
}

function maybeAutonomousInteraction(world: WorldState, now: number) {
  const roll = stableNoise(world.tick, world.sequence, "autonomous-interaction");
  if (roll < 0.34 && maybeFoodTrade(world, now)) return;
  if (roll < 0.61 && maybeResourceTrade(world, now)) return;
  if (roll < 0.87 && maybeSkillExchange(world, now)) return;
  maybeEnquiry(world, now);
}

export function hasLivingAgentState(world: WorldState) {
  return world.agents.every((agent) => Number.isFinite(living(agent).energy));
}

export function advanceAutonomousSimulation(
  world: WorldState,
  ticks = 1,
  now = Date.now(),
) {
  for (const agent of world.agents.map(living)) hydrateAgent(agent, world, now);
  const boundedTicks = Math.max(0, Math.min(8, Math.floor(ticks)));
  if (boundedTicks === 0) return world;

  for (let index = 0; index < boundedTicks; index += 1) {
    const tickNow = now - (boundedTicks - index - 1) * 1200;
    metabolize(world, tickNow);
    maybeAutonomousInteraction(world, tickNow + 1);
    moveAgents(world);
  }
  return world;
}
