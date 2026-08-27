import type { GeoOpportunity, GeoPlace, GeoPlaceKind, GeoPoint } from "@/lib/earth-world";

export type DiscoveryKind = Extract<GeoPlaceKind, "service" | "facility" | "community">;
export type DiscoveryStage = "observing" | "gap" | "planning" | "evidence" | "review" | "building" | "open";
export type DiscoveryOffering = { name: string; type: "product" | "service"; price?: number; tags: string[] };
export type DiscoveryProposal = {
  id: string;
  name: string;
  kind: DiscoveryKind;
  need: string;
  reason: string;
  cellId: string;
  lat: number;
  lng: number;
  score: number;
  offerings: DiscoveryOffering[];
  createdAt: number;
};
export type DiscoveryProject = DiscoveryProposal & {
  stage: DiscoveryStage;
  progress: number;
  supporters: number;
  builtPlaceId?: string;
  updatedAt: number;
};
export type DiscoveryState = {
  version: 1;
  projects: DiscoveryProject[];
  lastAutoDiscoveryAt: number;
  openedCount: number;
};

const TEMPLATES: Array<{
  slug: string;
  name: string;
  kind: DiscoveryKind;
  need: string;
  keywords: string[];
  reason: string;
  offerings: DiscoveryOffering[];
}> = [
  {
    slug: "tool-library",
    name: "Neighbour Tool Library",
    kind: "facility",
    need: "shared tools and small repairs",
    keywords: ["repair", "tool", "fix", "maintenance", "維修", "工具"],
    reason: "Residents repeatedly need occasional tools, but buying every tool individually is wasteful.",
    offerings: [
      { name: "Borrow drill", type: "service", price: 0, tags: ["tool", "borrow"] },
      { name: "Borrow ladder", type: "service", price: 0, tags: ["tool", "borrow"] },
      { name: "Small repair bench", type: "service", price: 3, tags: ["repair"] },
      { name: "Tool safety help", type: "service", price: 0, tags: ["help", "training"] },
      { name: "Donate spare tool", type: "service", price: 0, tags: ["community", "donate"] },
      { name: "Parts shelf", type: "product", price: 2, tags: ["parts", "repair"] },
    ],
  },
  {
    slug: "care-desk",
    name: "Neighbour Care Desk",
    kind: "service",
    need: "small errands and local human help",
    keywords: ["help", "care", "errand", "elder", "pickup", "幫助", "照顧"],
    reason: "Some local tasks cannot be completed by agents alone and need a clean handoff to a nearby person.",
    offerings: [
      { name: "Local errand handoff", type: "service", price: 8, tags: ["human", "errand"] },
      { name: "Pickup help", type: "service", price: 6, tags: ["pickup"] },
      { name: "Appointment companion", type: "service", price: 12, tags: ["care"] },
      { name: "Neighbour check-in", type: "service", price: 0, tags: ["community", "care"] },
      { name: "Form filling help", type: "service", price: 4, tags: ["admin", "agent"] },
      { name: "Human task board", type: "service", price: 0, tags: ["jobs", "handoff"] },
    ],
  },
  {
    slug: "shared-kitchen",
    name: "Shared Kitchen Table",
    kind: "facility",
    need: "shared food preparation and rescued ingredients",
    keywords: ["food", "cook", "meal", "bread", "grocery", "食物", "煮", "麵包"],
    reason: "Food needs appear often; a shared kitchen can turn spare ingredients into community meals and reduce waste.",
    offerings: [
      { name: "Prep table slot", type: "service", price: 0, tags: ["kitchen"] },
      { name: "Shared cooker slot", type: "service", price: 2, tags: ["kitchen"] },
      { name: "Community dinner", type: "service", price: 5, tags: ["meal"] },
      { name: "Food rescue shelf", type: "product", price: 0, tags: ["food", "rescue"] },
      { name: "Ingredient swap", type: "service", price: 0, tags: ["swap"] },
      { name: "Cooking help", type: "service", price: 3, tags: ["skill", "help"] },
    ],
  },
  {
    slug: "quiet-room",
    name: "Quiet Study Room",
    kind: "facility",
    need: "focus, learning and quiet work",
    keywords: ["study", "learn", "work", "focus", "quiet", "學習", "工作"],
    reason: "Residents and agents can organise digital work, while humans still benefit from a calm physical place to finish focused steps.",
    offerings: [
      { name: "Quiet desk", type: "service", price: 0, tags: ["focus"] },
      { name: "Two-hour focus booth", type: "service", price: 4, tags: ["focus"] },
      { name: "Study partner match", type: "service", price: 0, tags: ["learning"] },
      { name: "Print notes", type: "service", price: 2, tags: ["print"] },
      { name: "Skill exchange hour", type: "service", price: 0, tags: ["skill"] },
      { name: "Research handoff", type: "service", price: 3, tags: ["agent", "research"] },
    ],
  },
  {
    slug: "pet-support",
    name: "Pet Support Point",
    kind: "service",
    need: "pet care and short local assistance",
    keywords: ["pet", "dog", "cat", "animal", "walk", "寵物"],
    reason: "Pet tasks mix information, scheduling and physical care, making them a natural agent-to-human coordination service.",
    offerings: [
      { name: "Pet care booking", type: "service", price: 12, tags: ["pet", "care"] },
      { name: "Dog walk handoff", type: "service", price: 8, tags: ["pet", "human"] },
      { name: "Pet supply check", type: "service", price: 0, tags: ["agent", "inventory"] },
      { name: "Vet appointment prep", type: "service", price: 3, tags: ["agent", "care"] },
      { name: "Neighbour pet help", type: "service", price: 0, tags: ["community"] },
      { name: "Emergency contact card", type: "service", price: 0, tags: ["safety"] },
    ],
  },
  {
    slug: "delivery-hub",
    name: "Local Delivery Hub",
    kind: "service",
    need: "last-mile pickup and delivery",
    keywords: ["delivery", "courier", "pickup", "send", "送貨", "配送"],
    reason: "Agents can organise routing and information, while nearby humans can complete physical pickup and delivery steps.",
    offerings: [
      { name: "Same-cell delivery", type: "service", price: 5, tags: ["delivery"] },
      { name: "Neighbour-cell delivery", type: "service", price: 9, tags: ["delivery"] },
      { name: "Pickup request", type: "service", price: 4, tags: ["pickup"] },
      { name: "Agent route plan", type: "service", price: 0, tags: ["agent", "route"] },
      { name: "Human courier handoff", type: "service", price: 7, tags: ["human", "jobs"] },
      { name: "Delivery proof upload", type: "service", price: 0, tags: ["evidence"] },
    ],
  },
  {
    slug: "skill-studio",
    name: "Skill Exchange Studio",
    kind: "community",
    need: "local skills, teaching and collaboration",
    keywords: ["skill", "teach", "lesson", "design", "repair", "技能", "教"],
    reason: "Repeated needs expose skills already present in the community; a shared exchange makes them discoverable and routable.",
    offerings: [
      { name: "Offer one skill", type: "service", price: 0, tags: ["skill"] },
      { name: "Request one skill", type: "service", price: 0, tags: ["skill"] },
      { name: "Mini lesson", type: "service", price: 5, tags: ["learning"] },
      { name: "Project collaborator match", type: "service", price: 0, tags: ["agent", "collaboration"] },
      { name: "Human mentor handoff", type: "service", price: 8, tags: ["human", "mentor"] },
      { name: "Community workshop", type: "service", price: 3, tags: ["community"] },
    ],
  },
  {
    slug: "wellbeing-corner",
    name: "Calm Wellbeing Corner",
    kind: "facility",
    need: "rest, recovery and gentle community support",
    keywords: ["rest", "stress", "calm", "wellbeing", "休息", "壓力"],
    reason: "A living community needs places for recovery, not only commerce and productivity.",
    offerings: [
      { name: "Quiet rest seat", type: "service", price: 0, tags: ["rest"] },
      { name: "Breathing session", type: "service", price: 0, tags: ["wellbeing"] },
      { name: "Peer check-in", type: "service", price: 0, tags: ["community"] },
      { name: "Tea corner", type: "product", price: 2, tags: ["drink"] },
      { name: "Walk companion match", type: "service", price: 0, tags: ["human"] },
      { name: "Local support directory", type: "service", price: 0, tags: ["information"] },
    ],
  },
];

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function countMatches(text: string, terms: string[]) {
  const lower = text.toLowerCase();
  return terms.reduce((score, term) => score + (lower.includes(term.toLowerCase()) ? 1 : 0), 0);
}

function nearbyOffset(origin: GeoPoint, seed: number) {
  const angle = (seed % 360) * Math.PI / 180;
  const meters = 28 + (seed % 33);
  const latDelta = Math.cos(angle) * meters / 111_320;
  const lngScale = Math.max(.2, Math.cos(origin.lat * Math.PI / 180));
  const lngDelta = Math.sin(angle) * meters / (111_320 * lngScale);
  return { lat: origin.lat + latDelta, lng: origin.lng + lngDelta };
}

export function discoverCommunityGap(
  places: GeoPlace[],
  opportunities: GeoOpportunity[],
  origin: GeoPoint,
  cellId: string,
  now = Date.now(),
): DiscoveryProposal {
  const corpus = [
    ...places.flatMap((place) => [place.name, place.summary, ...place.catalog.map((item) => `${item.name} ${item.tags.join(" ")}`)]),
    ...opportunities.filter((item) => item.status !== "completed").flatMap((item) => [item.title, item.summary, ...item.agentTasks, ...item.humanTasks]),
  ].join(" ");
  const kindCounts = places.reduce<Record<string, number>>((counts, place) => ({ ...counts, [place.kind]: (counts[place.kind] ?? 0) + 1 }), {});
  const ranked = TEMPLATES.map((template, index) => {
    const demand = countMatches(corpus, template.keywords);
    const duplicate = places.some((place) => `${place.name} ${place.summary}`.toLowerCase().includes(template.slug.split("-")[0]));
    const scarcity = template.kind === "facility"
      ? Math.max(0, 3 - (kindCounts.facility ?? 0))
      : template.kind === "service"
        ? Math.max(0, 4 - (kindCounts.service ?? 0))
        : Math.max(0, 2 - (kindCounts.community ?? 0));
    const deterministic = (hash(`${cellId}:${template.slug}`) % 17) / 10;
    return { template, score: demand * 5 + scarcity * 4 + deterministic - (duplicate ? 12 : 0) + index * .001 };
  }).sort((left, right) => right.score - left.score);
  const winner = ranked[0] ?? { template: TEMPLATES[0], score: 1 };
  const seed = hash(`${cellId}:${winner.template.slug}:${Math.floor(now / 86_400_000)}`);
  const point = nearbyOffset(origin, seed);
  return {
    id: `discovery-${winner.template.slug}-${cellId}-${(now >>> 0).toString(36)}`,
    name: winner.template.name,
    kind: winner.template.kind,
    need: winner.template.need,
    reason: winner.template.reason,
    cellId,
    lat: point.lat,
    lng: point.lng,
    score: Math.max(1, Math.round(winner.score * 10) / 10),
    offerings: winner.template.offerings,
    createdAt: now,
  };
}

export function proposalDescription(proposal: DiscoveryProposal) {
  return [
    `Community-created ${proposal.kind} · pending local verification.`,
    `Need: ${proposal.need}.`,
    `Reason: ${proposal.reason}`,
    ...proposal.offerings.map((offering) => `${offering.name}${offering.price !== undefined ? ` $${offering.price}` : ""}`),
  ].join("\n");
}

export function emptyDiscoveryState(): DiscoveryState {
  return { version: 1, projects: [], lastAutoDiscoveryAt: 0, openedCount: 0 };
}

export function startDiscoveryProject(proposal: DiscoveryProposal, state: DiscoveryState, now = Date.now()) {
  const project: DiscoveryProject = { ...proposal, stage: "observing", progress: 8, supporters: 1, updatedAt: now };
  return { ...state, projects: [project, ...state.projects.filter((item) => item.id !== project.id)].slice(0, 16) };
}

export function updateDiscoveryProject(
  state: DiscoveryState,
  id: string,
  patch: Partial<Pick<DiscoveryProject, "stage" | "progress" | "supporters" | "builtPlaceId">>,
  now = Date.now(),
) {
  return {
    ...state,
    projects: state.projects.map((project) => project.id === id ? { ...project, ...patch, updatedAt: now } : project),
    openedCount: patch.stage === "open" ? state.openedCount + 1 : state.openedCount,
  };
}
