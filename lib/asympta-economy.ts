export type EconomyCategory =
  | "agent"
  | "compute"
  | "travel"
  | "materials"
  | "logistics"
  | "platform"
  | "holding"
  | "rework";

export type EconomyBreakdown = Record<EconomyCategory, number>;

export type EconomyPlan = {
  total: number;
  breakdown: EconomyBreakdown;
};

export type WorkflowCostTask = {
  id: string;
  title?: string;
  status: string;
  progress: number;
  travelProgress?: number | null;
  agentSide?: string;
};

export type JobCostStage = {
  id: string;
  side: string;
  durationMs: number;
  humanRequired?: boolean;
};

export type JobCostOpportunity = {
  negotiatedReward: number;
  difficulty: number;
};

const EMPTY: EconomyBreakdown = {
  agent: 0,
  compute: 0,
  travel: 0,
  materials: 0,
  logistics: 0,
  platform: 0,
  holding: 0,
  rework: 0,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function rounded(value: number) {
  return Math.round(value);
}

function plan(parts: Partial<EconomyBreakdown>): EconomyPlan {
  const breakdown: EconomyBreakdown = { ...EMPTY };
  for (const key of Object.keys(breakdown) as EconomyCategory[]) breakdown[key] = Math.max(0, rounded(parts[key] ?? 0));
  return { total: Object.values(breakdown).reduce((sum, value) => sum + value, 0), breakdown };
}

const SIDE_AGENT_COST: Record<string, number> = {
  user: 35,
  customer: 32,
  business: 58,
  supplier: 52,
  operations: 56,
  finance: 62,
  logistics: 48,
  support: 38,
  quality: 54,
  market: 48,
};

function keywordAmount(text: string, pattern: RegExp, amount: number) {
  return pattern.test(text) ? amount : 0;
}

export function workflowTaskCostPlan(task: Pick<WorkflowCostTask, "id" | "title" | "agentSide">): EconomyPlan {
  const text = `${task.id} ${task.title ?? ""}`.toLowerCase();
  const side = task.agentSide ?? "operations";
  const agent = SIDE_AGENT_COST[side] ?? 45;

  // Synthetic JPY-scale costs model distinct real-world cost drivers instead of
  // charging one arbitrary flat amount to every agent action.
  const compute = agent + keywordAmount(text, /(model|estimate|verify|quality|screen|review|plan|triage|analyse|analy)/, 38);
  const travel = 22 + (side === "logistics" ? 65 : side === "supplier" || side === "business" ? 34 : 18);
  const materials =
    keywordAmount(text, /(ingredient|dinner|prepare dinner)/, 680) +
    keywordAmount(text, /(material|supplier capacity|production|pack|stock|inventory|replacement)/, 520) +
    keywordAmount(text, /(launch inventory|launch stock)/, 760);
  const logistics =
    keywordAmount(text, /(dispatch|deliver|delivery|courier|shipment|handoff)/, 280) +
    keywordAmount(text, /(priority replacement|last-mile)/, 180);
  const platform =
    keywordAmount(text, /(payment|authorise|authorize|budget|credit|commercial terms|offer)/, 42) +
    keywordAmount(text, /(customer update|completion update|feedback)/, 12);
  const holding = keywordAmount(text, /(reserve|capacity|stock|inventory)/, 54);
  const rework = keywordAmount(text, /(recovery|replacement|failure|substitution|aftercare)/, 46);

  return plan({ agent, compute, travel, materials, logistics, platform, holding, rework });
}

export function workflowTaskAccruedEconomy(task: WorkflowCostTask) {
  const full = workflowTaskCostPlan(task);
  const work = clamp(Number.isFinite(task.progress) ? task.progress : 0, 0, 1);
  const travelProgress = clamp(Number.isFinite(task.travelProgress) ? Number(task.travelProgress) : 0, 0, 1);
  const factors: EconomyBreakdown = { ...EMPTY };

  if (task.status === "done") {
    for (const key of Object.keys(factors) as EconomyCategory[]) factors[key] = 1;
  } else if (task.status === "moving") {
    // Routing/travel burns while movement happens. Materials and transaction fees
    // wait until the actual work stage instead of being charged prematurely.
    factors.travel = travelProgress;
    factors.agent = travelProgress * 0.18;
    factors.compute = travelProgress * 0.08;
  } else if (task.status === "waiting_approval") {
    factors.travel = 1;
    factors.agent = 0.22;
    factors.compute = 0.12;
    factors.holding = 0.18;
  } else if (task.status === "working") {
    factors.travel = 1;
    factors.agent = 0.18 + work * 0.82;
    factors.compute = 0.08 + work * 0.92;
    factors.materials = work;
    factors.logistics = work;
    factors.platform = work;
    factors.holding = 0.18 + work * 0.82;
    factors.rework = work;
  }

  const breakdown: EconomyBreakdown = { ...EMPTY };
  for (const key of Object.keys(breakdown) as EconomyCategory[]) {
    breakdown[key] = Math.max(0, rounded(full.breakdown[key] * factors[key]));
  }
  return {
    accrued: Object.values(breakdown).reduce((sum, value) => sum + value, 0),
    projected: full.total,
    breakdown,
  };
}

export function workflowAccruedEconomy(tasks: WorkflowCostTask[]) {
  const breakdown: EconomyBreakdown = { ...EMPTY };
  let projected = 0;
  let accrued = 0;

  for (const task of tasks) {
    const taskEconomy = workflowTaskAccruedEconomy(task);
    projected += taskEconomy.projected;
    accrued += taskEconomy.accrued;
    for (const key of Object.keys(breakdown) as EconomyCategory[]) {
      breakdown[key] += taskEconomy.breakdown[key];
    }
  }

  return { accrued, projected, breakdown };
}

export function jobStageCostPlan(stage: JobCostStage, opportunity: JobCostOpportunity): EconomyPlan {
  const reward = Math.max(0, opportunity.negotiatedReward);
  const difficulty = clamp(opportunity.difficulty, 1, 5);
  const agent = stage.humanRequired ? 0 : (SIDE_AGENT_COST[stage.side] ?? 45);
  const travel = stage.id === "profile" || stage.humanRequired ? 0 : 18 + difficulty * 6;

  let compute = 0;
  let platform = 0;
  let materials = 0;
  let logistics = 0;
  let holding = 0;
  let rework = 0;

  if (["scout", "screen", "terms", "review"].includes(stage.id)) compute = 32 + difficulty * 14;
  if (["enquiry", "negotiate", "offer", "handoff"].includes(stage.id)) platform = 18 + difficulty * 4;
  if (stage.id === "prepare") {
    compute = 36 + difficulty * 12;
    materials = 45 + difficulty * 24;
  }
  if (stage.id === "human") {
    // Out-of-pocket execution costs: tools, commute, consumables, connectivity.
    // Human time is deliberately not treated as a cash payment to oneself.
    materials = Math.round(reward * (0.018 + difficulty * 0.004));
    logistics = 35 + difficulty * 18;
    rework = Math.round(reward * difficulty * 0.0025);
  }
  if (stage.id === "settle") platform = Math.round(reward * 0.045);
  if (stage.id === "offer") holding = Math.round(reward * 0.006);

  return plan({ agent, compute, travel, materials, logistics, platform, holding, rework });
}

export function jobProjectedEconomy(stages: JobCostStage[], opportunity: JobCostOpportunity) {
  const breakdown: EconomyBreakdown = { ...EMPTY };
  let total = 0;
  for (const stage of stages) {
    const stagePlan = jobStageCostPlan(stage, opportunity);
    total += stagePlan.total;
    for (const key of Object.keys(breakdown) as EconomyCategory[]) breakdown[key] += stagePlan.breakdown[key];
  }
  return { total, breakdown };
}

export function jobAccruedExpense(
  stages: JobCostStage[],
  opportunity: JobCostOpportunity,
  stageIndex: number,
  stageProgress: number,
) {
  let total = 0;
  const breakdown: EconomyBreakdown = { ...EMPTY };
  stages.forEach((stage, index) => {
    const fraction = index < stageIndex ? 1 : index === stageIndex ? clamp(stageProgress, 0, 1) : 0;
    if (fraction <= 0) return;
    const stagePlan = jobStageCostPlan(stage, opportunity);
    total += stagePlan.total * fraction;
    for (const key of Object.keys(breakdown) as EconomyCategory[]) breakdown[key] += stagePlan.breakdown[key] * fraction;
  });
  for (const key of Object.keys(breakdown) as EconomyCategory[]) breakdown[key] = Math.max(0, rounded(breakdown[key]));
  return { total: Math.max(0, rounded(total)), breakdown };
}

export function dominantEconomyCost(breakdown: EconomyBreakdown) {
  return (Object.entries(breakdown) as Array<[EconomyCategory, number]>)
    .sort((a, b) => b[1] - a[1])[0] ?? ["agent", 0];
}
