export type JobProfile = {
  skills: string[];
  summary: string;
  availability: "flexible" | "evenings" | "weekends" | "full-time";
  minReward: number;
};

export type JobOpportunity = {
  id: string;
  title: string;
  client: string;
  requiredSkills: string[];
  reward: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  locationId: "shibuya" | "shinjuku" | "marunouchi" | "otemachi" | "nihonbashi" | "shinagawa" | "roppongi" | "ueno";
  brief: string;
};

export type RankedJobOpportunity = JobOpportunity & {
  match: number;
  utility: number;
  negotiatedReward: number;
  completionLikelihood: number;
  humanWorkMs: number;
};

export type JobStageId =
  | "profile"
  | "scout"
  | "screen"
  | "enquiry"
  | "terms"
  | "negotiate"
  | "offer"
  | "prepare"
  | "human"
  | "review"
  | "handoff"
  | "settle";

export type JobStage = {
  id: JobStageId;
  agentId: "agent-user" | "agent-market" | "agent-quality" | "agent-business" | "agent-finance" | "agent-operations" | "agent-support";
  side: "user" | "market" | "quality" | "business" | "finance" | "operations" | "support";
  title: string;
  detail: string;
  locationId: JobOpportunity["locationId"];
  durationMs: number;
  humanRequired?: boolean;
};

export const DEFAULT_JOB_PROFILE: JobProfile = {
  skills: [],
  summary: "",
  availability: "flexible",
  minReward: 3000,
};

export const JOB_OPPORTUNITIES: JobOpportunity[] = [
  {
    id: "ai-evaluation-sprint",
    title: "AI Evaluation Sprint",
    client: "Synthetic AI Lab",
    requiredSkills: ["ai", "llm", "evaluation", "research"],
    reward: 7200,
    difficulty: 4,
    locationId: "roppongi",
    brief: "Evaluate model outputs, classify failure modes, and produce a concise evidence-backed quality report.",
  },
  {
    id: "web-automation-qa",
    title: "Web Automation QA",
    client: "Synthetic Commerce Studio",
    requiredSkills: ["javascript", "web", "qa", "automation"],
    reward: 5200,
    difficulty: 3,
    locationId: "marunouchi",
    brief: "Verify a browser workflow, reproduce failures, and deliver a compact regression checklist.",
  },
  {
    id: "it-support-triage",
    title: "IT Support Triage",
    client: "Synthetic Operations Desk",
    requiredSkills: ["it", "support", "troubleshooting", "macos"],
    reward: 3800,
    difficulty: 2,
    locationId: "shinjuku",
    brief: "Diagnose a simulated workstation incident, document the fix path, and prepare the user handoff.",
  },
  {
    id: "agent-workflow-review",
    title: "Agent Workflow Review",
    client: "Synthetic Agent Studio",
    requiredSkills: ["agent", "ai", "workflow", "prompt"],
    reward: 6400,
    difficulty: 4,
    locationId: "nihonbashi",
    brief: "Review an agent workflow for tool-use gaps, escalation failures, and verifier coverage.",
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizedTokens(values: string[]) {
  return values
    .flatMap((value) => value.toLowerCase().split(/[^a-z0-9+#.-]+/g))
    .map((value) => value.trim())
    .filter(Boolean);
}

export function normalizeJobProfile(input: Partial<JobProfile>): JobProfile {
  const availability = input.availability === "evenings" || input.availability === "weekends" || input.availability === "full-time"
    ? input.availability
    : "flexible";
  const skills = Array.isArray(input.skills)
    ? input.skills.map((skill) => String(skill).trim()).filter(Boolean).slice(0, 24)
    : [];
  const minReward = clamp(Math.round(Number.isFinite(input.minReward) ? Number(input.minReward) : DEFAULT_JOB_PROFILE.minReward), 0, 100_000);
  return {
    skills,
    summary: String(input.summary ?? "").trim().slice(0, 600),
    availability,
    minReward,
  };
}

export function skillMatch(profile: JobProfile, opportunity: JobOpportunity) {
  const tokens = new Set(normalizedTokens([...profile.skills, profile.summary]));
  if (tokens.size === 0) return 0.25;
  const matched = opportunity.requiredSkills.filter((required) => {
    const target = required.toLowerCase();
    return [...tokens].some((token) => token === target || token.includes(target) || target.includes(token));
  }).length;
  return clamp(matched / Math.max(1, opportunity.requiredSkills.length), 0, 1);
}

export function negotiatedReward(profile: JobProfile, opportunity: JobOpportunity, match: number) {
  const floor = profile.minReward;
  const leverage = 1 + Math.max(0, match - 0.5) * 0.16;
  const negotiated = Math.round(opportunity.reward * leverage / 100) * 100;
  if (negotiated >= floor) return negotiated;
  const stretchLimit = Math.round(opportunity.reward * 1.15 / 100) * 100;
  return Math.min(Math.max(negotiated, floor), stretchLimit);
}

export function completionLikelihood(profile: JobProfile, opportunity: JobOpportunity, match = skillMatch(profile, opportunity), reward = negotiatedReward(profile, opportunity, match)) {
  const rewardSignal = clamp(reward / 10_000, 0, 1);
  const availabilityBonus = profile.availability === "full-time" ? 0.08 : profile.availability === "flexible" ? 0.05 : 0.02;
  return clamp(0.48 + match * 0.34 + rewardSignal * 0.18 + availabilityBonus - opportunity.difficulty * 0.055, 0.28, 0.98);
}

export function humanWorkDurationMs(profile: JobProfile, opportunity: JobOpportunity, match = skillMatch(profile, opportunity), reward = negotiatedReward(profile, opportunity, match)) {
  const likelihood = completionLikelihood(profile, opportunity, match, reward);
  const difficultyLoad = 0.76 + opportunity.difficulty * 0.31;
  const motivation = 0.68 + likelihood * 0.52;
  const skillEfficiency = 0.82 + match * 0.36;
  return Math.round(clamp((4_800 * difficultyLoad) / (motivation * skillEfficiency), 3_800, 12_500));
}

export function rankJobOpportunities(profileInput: Partial<JobProfile>): RankedJobOpportunity[] {
  const profile = normalizeJobProfile(profileInput);
  return JOB_OPPORTUNITIES.map((opportunity) => {
    const match = skillMatch(profile, opportunity);
    const reward = negotiatedReward(profile, opportunity, match);
    const likelihood = completionLikelihood(profile, opportunity, match, reward);
    const rewardFit = profile.minReward <= 0 ? 1 : clamp(reward / Math.max(1, profile.minReward), 0, 1.2) / 1.2;
    const utility = match * 0.5 + rewardFit * 0.23 + likelihood * 0.2 + (1 - opportunity.difficulty / 5) * 0.07;
    return {
      ...opportunity,
      match,
      utility,
      negotiatedReward: reward,
      completionLikelihood: likelihood,
      humanWorkMs: humanWorkDurationMs(profile, opportunity, match, reward),
    };
  }).sort((a, b) => b.utility - a.utility || b.negotiatedReward - a.negotiatedReward);
}

export function buildJobStages(profileInput: Partial<JobProfile>, opportunityInput?: RankedJobOpportunity) {
  const profile = normalizeJobProfile(profileInput);
  const opportunity = opportunityInput ?? rankJobOpportunities(profile)[0];
  const reward = opportunity.negotiatedReward;
  const title = opportunity.title;
  const stages: JobStage[] = [
    { id: "profile", agentId: "agent-user", side: "user", title: "Build work profile", detail: `Structure skills, availability and constraints for ${profile.skills.length || "general"} skill signals.`, locationId: "shibuya", durationMs: 1_700 },
    { id: "scout", agentId: "agent-market", side: "market", title: "Find opportunities", detail: `Search the synthetic opportunity market and rank work by skill fit, difficulty and reward.`, locationId: "ueno", durationMs: 2_400 },
    { id: "screen", agentId: "agent-quality", side: "quality", title: "Screen fit and risk", detail: `Verify that ${title} is feasible for the user's stated profile.`, locationId: "nihonbashi", durationMs: 2_100 },
    { id: "enquiry", agentId: "agent-business", side: "business", title: "Handle enquiries", detail: "Ask the synthetic client about scope, deadline, acceptance criteria and missing information.", locationId: opportunity.locationId, durationMs: 2_500 },
    { id: "terms", agentId: "agent-finance", side: "finance", title: "Evaluate terms", detail: `Compare effort, difficulty ${opportunity.difficulty}/5 and the proposed reward.`, locationId: "otemachi", durationMs: 2_000 },
    { id: "negotiate", agentId: "agent-business", side: "business", title: "Negotiate the deal", detail: `Converge the simulated deal to ¥${reward.toLocaleString("en-US")} with a clear completion definition.`, locationId: opportunity.locationId, durationMs: 2_400 },
    { id: "offer", agentId: "agent-user", side: "user", title: "Take the best offer", detail: `The personal agent accepts the synthetic ${title} offer because it is the highest-utility available deal.`, locationId: "shibuya", durationMs: 1_600 },
    { id: "prepare", agentId: "agent-operations", side: "operations", title: "Prepare everything agents can", detail: "Gather context, make a checklist, prepare templates, and leave only the irreducible human work.", locationId: "shinagawa", durationMs: 2_500 },
    { id: "human", agentId: "agent-user", side: "user", title: "Human completes necessary work", detail: `Human execution is simulated from difficulty, skill match and reward. Earnings accrue live while the work is completed.`, locationId: "shibuya", durationMs: opportunity.humanWorkMs, humanRequired: true },
    { id: "review", agentId: "agent-quality", side: "quality", title: "Verify deliverable", detail: "Check the human result against the negotiated acceptance criteria and catch missing work.", locationId: "nihonbashi", durationMs: 2_200 },
    { id: "handoff", agentId: "agent-support", side: "support", title: "Finish client communication", detail: "Package the result, answer the final simulated enquiry, and close the delivery loop.", locationId: opportunity.locationId, durationMs: 2_000 },
    { id: "settle", agentId: "agent-finance", side: "finance", title: "Close deal and settle", detail: "Confirm the simulated deal is complete and reconcile the live-earned balance.", locationId: "otemachi", durationMs: 1_700 },
  ];
  return { profile, opportunity, stages };
}
