export type CommunityPlaceKind =
  | "library" | "community-center" | "pet-care" | "bike-workshop" | "flower-shop"
  | "art-space" | "music-room" | "shared-kitchen" | "garden" | "laundry";

export type CommunityActionId =
  | "inspect_programs" | "reserve_item" | "borrow_item" | "return_item" | "attend_event"
  | "volunteer" | "donate_resource" | "request_help" | "post_notice" | "book_service" | "purchase_item";

export type CommunityNeed =
  | "read" | "social" | "petcare" | "mobility" | "gift" | "culture"
  | "music" | "cook" | "garden" | "laundry" | "help" | "volunteer";

export type CommunityPhase = "observe" | "evaluate" | "travel" | "inquire" | "decide" | "act" | "reflect" | "rest";
export type CommunityOfferingType = "product" | "loan" | "service" | "event" | "space";

export type CommunityOffering = {
  id: string; name: string; type: CommunityOfferingType; price: number;
  capacity: number; available: number; tags: string[];
};

export type CommunityPlace = {
  id: string; name: string; kind: CommunityPlaceKind; x: number; y: number; seed: number;
  reputation: number; treasury: number; resources: number;
  offerings: CommunityOffering[]; actions: CommunityActionId[];
};

export type CommunityAgent = {
  id: string; name: string; role: string; avatar: "human" | "cat" | "fox" | "rabbit" | "bear";
  x: number; y: number; targetX: number; targetY: number; speed: number;
  wallet: number; energy: number; social: number; resources: number;
  inventory: Record<string, number>; communityScore: number; need: CommunityNeed;
  preferences: CommunityPlaceKind[]; patience: number; curiosity: number; thrift: number;
  phase: CommunityPhase; phaseUntil: number; targetPlaceId?: string; plannedAction?: CommunityActionId;
  plannedOfferingId?: string; thought?: string; lastResult?: string;
  memory: Array<{ placeId: string; visits: number; satisfaction: number }>;
};

export type CommunityTransaction = {
  id: string; at: number; agentId: string; placeId: string; action: CommunityActionId;
  offeringId?: string; offeringName?: string; credits: number; summary: string;
  actorDelta: string; placeDelta: string;
};

export type CommunityNotice = {
  id: string; at: number; authorId: string; placeId: string; type: "notice" | "help"; text: string;
};

export type CommunityState = {
  version: 2; worldTime: number; userUnlimitedCredits: boolean; userCredits: number;
  userResources: number; userCommunityScore: number; userInventory: Record<string, number>;
  userBookings: Record<string, number>; places: CommunityPlace[]; agents: CommunityAgent[];
  notices: CommunityNotice[]; transactions: CommunityTransaction[];
};

export type CommunityActionInput = {
  placeId: string; action: CommunityActionId; agentId?: string; offeringId?: string;
  quantity?: number; note?: string;
};

export type CommunityActionResult = {
  ok: boolean; state: CommunityState; summary: string; actorDelta?: string; placeDelta?: string;
};

const NAMES = ["Aki","Bea","Cleo","Dara","Emi","Finn","Gio","Hana","Iko","June","Kira","Lio","Mae","Niko","Oli","Pia","Quin","Rae","Sol","Tia","Umi","Veo","Wren","Xia","Yori","Zee"];
const ROLES = ["student","maker","designer","barista","courier","gardener","musician","volunteer","pet carer","mechanic","teacher","organizer","writer","cook","researcher","shopkeeper","artist","developer"];
const AVATARS: CommunityAgent["avatar"][] = ["human","cat","fox","rabbit","bear"];
const NEEDS: CommunityNeed[] = ["read","social","petcare","mobility","gift","culture","music","cook","garden","laundry","help","volunteer"];
const PLACE_KINDS: CommunityPlaceKind[] = ["library","community-center","pet-care","bike-workshop","flower-shop","art-space","music-room","shared-kitchen","garden","laundry"];

const NEED_LABEL: Record<CommunityNeed, string> = {
  read: "尋找閱讀資源", social: "尋找社區活動", petcare: "安排寵物照顧", mobility: "處理單車需求",
  gift: "尋找小禮物", culture: "參與文化活動", music: "尋找音樂空間", cook: "安排共煮",
  garden: "參與社區園藝", laundry: "處理洗衣", help: "尋找社區協助", volunteer: "尋找義工機會",
};

const PLACE_NEEDS: Record<CommunityPlaceKind, CommunityNeed[]> = {
  library: ["read","culture","help"],
  "community-center": ["social","help","volunteer","culture"],
  "pet-care": ["petcare","help"],
  "bike-workshop": ["mobility","help","volunteer"],
  "flower-shop": ["gift","culture"],
  "art-space": ["culture","social"],
  "music-room": ["music","social","culture"],
  "shared-kitchen": ["cook","social","volunteer"],
  garden: ["garden","volunteer","social"],
  laundry: ["laundry","help"],
};

export const COMMUNITY_ACTIONS: CommunityActionId[] = [
  "inspect_programs","reserve_item","borrow_item","return_item","attend_event","volunteer",
  "donate_resource","request_help","post_notice","book_service","purchase_item",
];
export const COMMUNITY_KINDS: CommunityPlaceKind[] = [...PLACE_KINDS];

function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }
function hash(value: string) { let h = 2166136261; for (let i = 0; i < value.length; i += 1) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function random01(seed: string) { const value = hash(seed); return ((value ^ (value >>> 15)) >>> 0) / 4294967295; }
function offering(id: string, name: string, type: CommunityOfferingType, price: number, capacity: number, tags: string[]): CommunityOffering { return { id, name, type, price, capacity, available: capacity, tags }; }
function place(id: string, name: string, kind: CommunityPlaceKind, x: number, y: number, seed: number, reputation: number, treasury: number, resources: number, offerings: CommunityOffering[], actions: CommunityActionId[]): CommunityPlace { return { id, name, kind, x, y, seed, reputation, treasury, resources, offerings, actions }; }

export function seedCommunityPlaces(): CommunityPlace[] {
  return [
    place("riverside-library","Riverside Library","library",115,520,131,91,240,18,[offering("design-book","Design book","loan",0,12,["read","design"]),offering("quiet-reading-seat","Quiet reading seat","space",0,10,["read","focus"]),offering("local-history-night","Local history night","event",0,16,["culture","social"])],["inspect_programs","reserve_item","borrow_item","return_item","attend_event","request_help","post_notice"]),
    place("cedar-community","Cedar Community Center","community-center",605,82,149,88,320,24,[offering("community-hall","Community hall","space",12,5,["social","event"]),offering("repair-clinic-seat","Repair clinic seat","event",0,12,["help","repair"]),offering("neighbour-dinner","Neighbour dinner","event",4,18,["social","food"])],["inspect_programs","reserve_item","attend_event","volunteer","donate_resource","request_help","post_notice"]),
    place("paws-pet-care","Paws & Whiskers","pet-care",1100,110,167,86,460,12,[offering("pet-wash","Pet wash","service",18,7,["petcare"]),offering("pet-walk","Neighbourhood pet walk","service",12,10,["petcare","social"]),offering("pet-care-hour","Pet care hour","service",22,6,["petcare","help"])],["inspect_programs","book_service","reserve_item","request_help","post_notice"]),
    place("spoke-workshop","Spoke Bike Workshop","bike-workshop",1090,650,181,90,540,22,[offering("repair-stand","Repair stand","space",4,8,["mobility","repair"]),offering("bike-tune","Bike tune-up","service",24,7,["mobility","repair"]),offering("repair-class","Repair class","event",5,12,["mobility","learning"])],["inspect_programs","reserve_item","book_service","attend_event","volunteer","donate_resource","request_help"]),
    place("bloom-flower","Bloom Flower Shop","flower-shop",585,700,193,84,390,10,[offering("small-bouquet","Small bouquet","product",14,14,["gift","flower"]),offering("seasonal-bundle","Seasonal bundle","product",22,10,["gift","flower"]),offering("flower-workshop","Flower workshop","event",18,8,["culture","learning"])],["inspect_programs","purchase_item","reserve_item","attend_event","post_notice"]),
    place("quiet-art-space","Quiet Art Space","art-space",875,590,211,93,280,16,[offering("open-studio","Open studio","space",6,10,["culture","art"]),offering("printmaking-night","Printmaking night","event",12,10,["culture","print"]),offering("gallery-talk","Gallery talk","event",0,18,["culture","social"])],["inspect_programs","reserve_item","attend_event","volunteer","post_notice"]),
    place("little-music-room","Little Music Room","music-room",900,92,227,87,350,14,[offering("practice-room","Practice room","space",8,8,["music","focus"]),offering("open-jam","Open jam","event",4,12,["music","social"]),offering("piano-hour","Piano hour","service",16,6,["music","learning"])],["inspect_programs","reserve_item","attend_event","book_service","post_notice"]),
    place("common-table","Common Table Kitchen","shared-kitchen",170,700,239,89,410,28,[offering("kitchen-station","Kitchen station","space",7,8,["cook","food"]),offering("community-cook","Community cook night","event",6,16,["cook","social"]),offering("meal-prep-help","Meal prep help","service",10,8,["cook","help"])],["inspect_programs","reserve_item","attend_event","book_service","volunteer","donate_resource","request_help"]),
    place("green-patch","Green Patch Garden","garden",65,260,251,92,180,36,[offering("garden-bed","Shared garden bed","space",0,10,["garden","nature"]),offering("seed-share","Seed share","loan",0,20,["garden","resource"]),offering("garden-morning","Garden morning","event",0,18,["garden","volunteer"])],["inspect_programs","reserve_item","borrow_item","return_item","attend_event","volunteer","donate_resource","post_notice"]),
    place("sun-laundry","Sun Laundry","laundry",1110,410,269,80,470,8,[offering("washer-slot","Washer slot","service",7,12,["laundry"]),offering("dryer-slot","Dryer slot","service",6,12,["laundry"]),offering("folding-help","Folding help","service",5,6,["laundry","help"])],["inspect_programs","book_service","reserve_item","request_help","post_notice"]),
  ];
}

function preferredKinds(index: number): CommunityPlaceKind[] { return [PLACE_KINDS[index % PLACE_KINDS.length], PLACE_KINDS[(index * 3 + 2) % PLACE_KINDS.length]]; }

export function seedCommunityAgents(now = Date.now(), count = 60): CommunityAgent[] {
  return Array.from({ length: count }, (_, index) => {
    const id = "community-agent-" + String(index + 1).padStart(3, "0");
    const x = 55 + random01(id + ":x") * 1090;
    const y = 55 + random01(id + ":y") * 650;
    const patience = random01(id + ":patience");
    return {
      id, name: NAMES[index % NAMES.length] + " C" + String(Math.floor(index / NAMES.length) + 1), role: ROLES[index % ROLES.length],
      avatar: AVATARS[index % AVATARS.length], x, y, targetX: x, targetY: y, speed: 8 + random01(id + ":speed") * 8,
      wallet: Math.round(70 + random01(id + ":wallet") * 210), energy: Math.round(48 + random01(id + ":energy") * 48),
      social: Math.round(30 + random01(id + ":social") * 66), resources: 1 + Math.floor(random01(id + ":resources") * 5),
      inventory: {}, communityScore: Math.round(10 + random01(id + ":score") * 45), need: NEEDS[index % NEEDS.length],
      preferences: preferredKinds(index), patience, curiosity: random01(id + ":curiosity"), thrift: random01(id + ":thrift"),
      phase: "rest", phaseUntil: now + 3500 + random01(id + ":initial") * 9000, thought: "生活中", memory: [],
    } satisfies CommunityAgent;
  });
}

export function seedCommunityState(now = Date.now(), agentCount = 60): CommunityState {
  return { version: 2, worldTime: now, userUnlimitedCredits: true, userCredits: 500, userResources: 5, userCommunityScore: 0, userInventory: {}, userBookings: {}, places: seedCommunityPlaces(), agents: seedCommunityAgents(now, agentCount), notices: [], transactions: [] };
}

export function communityNeedLabel(need: CommunityNeed) { return NEED_LABEL[need]; }

export function communityPhaseDuration(agent: CommunityAgent, phase: CommunityPhase) {
  const patience = agent.patience;
  if (phase === "observe") return 4000 + patience * 3000;
  if (phase === "evaluate") return 5000 + patience * 4000;
  if (phase === "inquire") return 5000 + agent.curiosity * 3000;
  if (phase === "decide") return 4000 + patience * 3000;
  if (phase === "act") return 3000 + patience * 2500;
  if (phase === "reflect") return 5000 + patience * 5000;
  if (phase === "rest") return 8000 + (1 - agent.curiosity) * 12000;
  return 0;
}

export function chooseCommunityPlace(places: CommunityPlace[], agent: CommunityAgent, need: CommunityNeed) {
  const matching = places.filter((candidate) => PLACE_NEEDS[candidate.kind].includes(need));
  const pool = matching.length ? matching : places;
  return pool.map((candidate) => {
    const distance = Math.hypot(candidate.x - agent.x, candidate.y - agent.y);
    const memory = agent.memory.find((entry) => entry.placeId === candidate.id);
    const familiar = memory ? Math.min(16, memory.visits * 2) + memory.satisfaction * 0.12 : 0;
    const preference = agent.preferences.includes(candidate.kind) ? 16 : 0;
    const curiosity = memory ? 0 : agent.curiosity * 12;
    const priceAverage = candidate.offerings.length ? candidate.offerings.reduce((sum, item) => sum + item.price, 0) / candidate.offerings.length : 0;
    return { candidate, score: candidate.reputation * 0.5 + preference + familiar + curiosity - distance * (0.013 + (1 - agent.patience) * 0.01) - priceAverage * agent.thrift * 0.35 };
  }).sort((left, right) => right.score - left.score)[0]?.candidate;
}

function chooseOffering(placeItem: CommunityPlace, action: CommunityActionId, agent?: CommunityAgent) {
  const available = placeItem.offerings.filter((item) => item.available > 0);
  const filtered = available.filter((item) => {
    if (action === "purchase_item") return item.type === "product";
    if (action === "borrow_item" || action === "return_item") return item.type === "loan";
    if (action === "attend_event") return item.type === "event";
    if (action === "book_service") return item.type === "service";
    if (action === "reserve_item") return item.type === "space" || item.type === "loan" || item.type === "event";
    return true;
  });
  const pool = filtered.length ? filtered : available;
  return [...pool].sort((a, b) => (agent?.thrift ?? 0.5) >= 0.5 ? a.price - b.price : b.price - a.price)[0];
}

export function chooseCommunityAction(agent: CommunityAgent, placeItem: CommunityPlace): CommunityActionId {
  if (agent.need === "volunteer" && placeItem.actions.includes("volunteer")) return "volunteer";
  if (agent.need === "help" && placeItem.actions.includes("request_help")) return "request_help";
  if (agent.resources >= 4 && agent.communityScore > 22 && placeItem.actions.includes("donate_resource") && agent.curiosity > 0.5) return "donate_resource";
  if (agent.need === "read" && placeItem.actions.includes("borrow_item")) return "borrow_item";
  if (["social","culture","music","garden"].includes(agent.need) && placeItem.actions.includes("attend_event")) return "attend_event";
  if (["petcare","laundry"].includes(agent.need) && placeItem.actions.includes("book_service")) return "book_service";
  if (agent.need === "gift" && placeItem.actions.includes("purchase_item")) return "purchase_item";
  if (placeItem.actions.includes("reserve_item")) return "reserve_item";
  if (placeItem.actions.includes("book_service")) return "book_service";
  return placeItem.actions.includes("request_help") ? "request_help" : "inspect_programs";
}

export function listCommunityActions(placeItem: CommunityPlace) {
  const labels: Record<CommunityActionId, string> = { inspect_programs: "查看活動", reserve_item: "預留資源", borrow_item: "借用", return_item: "歸還", attend_event: "參加活動", volunteer: "參與義工", donate_resource: "捐出資源", request_help: "尋求協助", post_notice: "張貼公告", book_service: "預約服務", purchase_item: "購買物品" };
  return placeItem.actions.map((action) => ({ action, label: labels[action] }));
}

export function searchCommunityPlaces(state: CommunityState, query = "", kind?: CommunityPlaceKind) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return state.places.filter((candidate) => !kind || candidate.kind === kind).filter((candidate) => {
    if (!terms.length) return true;
    const text = [candidate.name,candidate.kind,...candidate.offerings.flatMap((item) => [item.name,...item.tags]),...candidate.actions].join(" ").toLowerCase();
    return terms.every((term) => text.includes(term));
  }).map((candidate) => ({ id: candidate.id, name: candidate.name, kind: candidate.kind, reputation: candidate.reputation, x: candidate.x, y: candidate.y, offerings: candidate.offerings.length, actions: candidate.actions }));
}

function cloneState(state: CommunityState): CommunityState {
  return { ...state, userInventory: { ...state.userInventory }, userBookings: { ...state.userBookings }, places: state.places.map((placeItem) => ({ ...placeItem, offerings: placeItem.offerings.map((item) => ({ ...item })) })), agents: state.agents.map((agent) => ({ ...agent, inventory: { ...agent.inventory }, preferences: [...agent.preferences], memory: agent.memory.map((entry) => ({ ...entry })) })), notices: state.notices.map((notice) => ({ ...notice })), transactions: state.transactions.map((transaction) => ({ ...transaction })) };
}

function transactionId(now: number, actorId: string, placeId: string) { return "community-tx-" + now.toString(36) + "-" + hash(actorId + placeId + String(now)).toString(36); }
function remember(agent: CommunityAgent, placeItem: CommunityPlace, satisfaction: number) {
  const existing = agent.memory.find((entry) => entry.placeId === placeItem.id);
  if (existing) { existing.visits += 1; existing.satisfaction = clamp(existing.satisfaction * 0.72 + satisfaction * 0.28, 0, 100); }
  else agent.memory.push({ placeId: placeItem.id, visits: 1, satisfaction });
  agent.memory = agent.memory.slice(-10);
}
function pushTransaction(next: CommunityState, transaction: CommunityTransaction) { next.transactions = [transaction, ...next.transactions].slice(0, 160); }

export function executeCommunityAction(state: CommunityState, input: CommunityActionInput, now = Date.now()): CommunityActionResult {
  const next = cloneState(state); next.worldTime = now;
  const placeItem = next.places.find((candidate) => candidate.id === input.placeId);
  if (!placeItem) return { ok: false, state, summary: "Community place not found." };
  if (!placeItem.actions.includes(input.action)) return { ok: false, state, summary: "Action is not available here." };
  const isUser = !input.agentId || input.agentId === "your-agent";
  const agent = !isUser ? next.agents.find((candidate) => candidate.id === input.agentId) : undefined;
  const quantity = clamp(Math.floor(input.quantity ?? 1), 1, 4);
  let offeringItem = input.offeringId ? placeItem.offerings.find((candidate) => candidate.id === input.offeringId) : chooseOffering(placeItem, input.action, agent);

  if (input.action === "inspect_programs") return { ok: true, state: next, summary: placeItem.name + " has " + placeItem.offerings.length + " current offerings.", actorDelta: "+community info", placeDelta: "+visitor" };

  if (input.action === "request_help" || input.action === "post_notice") {
    const text = (input.note?.trim() || (input.action === "request_help" ? "Need a little help here." : "Community notice")).slice(0, 180);
    const noticeType: CommunityNotice["type"] = input.action === "request_help" ? "help" : "notice";
    const notice: CommunityNotice = { id: "community-notice-" + now.toString(36) + "-" + hash(text).toString(36), at: now, authorId: agent?.id ?? "your-agent", placeId: placeItem.id, type: noticeType, text };
    next.notices = [notice, ...next.notices].slice(0, 36);
    const actorDelta = input.action === "request_help" ? "+help request" : "+notice";
    const placeDelta = actorDelta;
    const summary = (input.action === "request_help" ? "Requested help at " : "Posted a notice at ") + placeItem.name + ".";
    const transaction: CommunityTransaction = { id: transactionId(now, agent?.id ?? "your-agent", placeItem.id), at: now, agentId: agent?.id ?? "your-agent", placeId: placeItem.id, action: input.action, credits: 0, summary, actorDelta, placeDelta };
    next.transactions = [transaction, ...next.transactions].slice(0, 160);
    return { ok: true, state: next, summary, actorDelta, placeDelta };
  }

  if (input.action === "volunteer") {
    placeItem.resources += quantity;
    if (agent) { agent.communityScore += 3 * quantity; agent.energy = clamp(agent.energy - 4 * quantity, 0, 100); }
    else next.userCommunityScore += 3 * quantity;
    const summary = "Volunteered at " + placeItem.name + ".";
    const actorDelta = "+community " + String(3 * quantity); const placeDelta = "+" + String(quantity) + " help";
    const transaction: CommunityTransaction = { id: transactionId(now, agent?.id ?? "your-agent", placeItem.id), at: now, agentId: agent?.id ?? "your-agent", placeId: placeItem.id, action: input.action, credits: 0, summary, actorDelta, placeDelta };
    pushTransaction(next, transaction);
    return { ok: true, state: next, summary, actorDelta, placeDelta };
  }

  if (input.action === "donate_resource") {
    const available = agent?.resources ?? next.userResources;
    if (available < quantity) return { ok: false, state, summary: "Not enough resources to donate." };
    if (agent) { agent.resources -= quantity; agent.communityScore += quantity * 2; }
    else { next.userResources -= quantity; next.userCommunityScore += quantity * 2; }
    placeItem.resources += quantity;
    const summary = "Donated " + quantity + " resource units to " + placeItem.name + ".";
    const actorDelta = "−" + String(quantity) + " resource +community"; const placeDelta = "+" + String(quantity) + " resource";
    const transaction: CommunityTransaction = { id: transactionId(now, agent?.id ?? "your-agent", placeItem.id), at: now, agentId: agent?.id ?? "your-agent", placeId: placeItem.id, action: input.action, credits: 0, summary, actorDelta, placeDelta };
    pushTransaction(next, transaction);
    return { ok: true, state: next, summary, actorDelta, placeDelta };
  }

  if (input.action === "return_item") {
    offeringItem = offeringItem ?? placeItem.offerings.find((candidate) => candidate.type === "loan");
    if (!offeringItem) return { ok: false, state, summary: "No returnable item is available." };
    const inventory = agent?.inventory ?? next.userInventory;
    if ((inventory[offeringItem.id] ?? 0) < quantity) return { ok: false, state, summary: "The actor does not hold that item." };
    inventory[offeringItem.id] -= quantity; offeringItem.available = Math.min(offeringItem.capacity, offeringItem.available + quantity);
    const summary = "Returned " + offeringItem.name + " to " + placeItem.name + "."; const actorDelta = "−" + offeringItem.name; const placeDelta = "+" + offeringItem.name;
    const transaction: CommunityTransaction = { id: transactionId(now, agent?.id ?? "your-agent", placeItem.id), at: now, agentId: agent?.id ?? "your-agent", placeId: placeItem.id, action: input.action, offeringId: offeringItem.id, offeringName: offeringItem.name, credits: 0, summary, actorDelta, placeDelta };
    pushTransaction(next, transaction);
    return { ok: true, state: next, summary, actorDelta, placeDelta };
  }

  if (!offeringItem) return { ok: false, state, summary: "No suitable offering is available." };
  if (offeringItem.available < quantity) return { ok: false, state, summary: "Not enough capacity is available." };
  const credits = offeringItem.price * quantity;
  const payer = agent?.wallet ?? (next.userUnlimitedCredits ? Number.POSITIVE_INFINITY : next.userCredits);
  if (payer < credits) return { ok: false, state, summary: "Not enough credits." };
  offeringItem.available -= quantity;
  placeItem.treasury += credits;
  if (agent) agent.wallet -= credits; else if (!next.userUnlimitedCredits) next.userCredits -= credits;

  let actorDelta = credits > 0 ? "−₡" + String(credits) : "+access";
  let placeDelta = credits > 0 ? "+₡" + String(credits) : "+participant";
  let summary = "";
  if (input.action === "borrow_item" || input.action === "purchase_item") {
    const inventory = agent?.inventory ?? next.userInventory;
    inventory[offeringItem.id] = (inventory[offeringItem.id] ?? 0) + quantity;
    actorDelta += " +" + offeringItem.name; placeDelta += " −" + offeringItem.name;
    summary = (input.action === "borrow_item" ? "Borrowed " : "Purchased ") + offeringItem.name + " at " + placeItem.name + ".";
  } else {
    const bookings = agent?.inventory ?? next.userBookings;
    bookings[offeringItem.id] = (bookings[offeringItem.id] ?? 0) + quantity;
    actorDelta += " +" + offeringItem.name;
    placeDelta += input.action === "attend_event" ? " +attendee" : " −slot";
    summary = input.action === "attend_event" ? "Joined " + offeringItem.name + " at " + placeItem.name + "." : input.action === "book_service" ? "Booked " + offeringItem.name + " at " + placeItem.name + "." : "Reserved " + offeringItem.name + " at " + placeItem.name + ".";
  }
  if (agent) {
    remember(agent, placeItem, clamp(placeItem.reputation * 0.75 + agent.curiosity * 14 - credits * 0.03, 40, 100));
    if (input.action === "attend_event") agent.social = clamp(agent.social + 8, 0, 100);
    if (input.action === "book_service") agent.energy = clamp(agent.energy + 3, 0, 100);
  }
  const transaction: CommunityTransaction = { id: transactionId(now, agent?.id ?? "your-agent", placeItem.id), at: now, agentId: agent?.id ?? "your-agent", placeId: placeItem.id, action: input.action, offeringId: offeringItem.id, offeringName: offeringItem.name, credits, summary, actorDelta, placeDelta };
  pushTransaction(next, transaction);
  return { ok: true, state: next, summary, actorDelta, placeDelta };
}

export function nextCommunityNeed(agent: CommunityAgent, salt: number): CommunityNeed { const index = NEEDS.indexOf(agent.need); return NEEDS[(index + 1 + salt % 4) % NEEDS.length]; }
export function restoreCommunityCapacity(state: CommunityState, now = Date.now()) {
  const next = cloneState(state); next.worldTime = now;
  for (const placeItem of next.places) for (const item of placeItem.offerings) if (item.available < item.capacity) item.available = Math.min(item.capacity, item.available + 1);
  return next;
}
