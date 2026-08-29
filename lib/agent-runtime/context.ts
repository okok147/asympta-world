import type { AtlasTaskState, AtlasWorldState } from "../atlas-simulation";
import { profileForAgent } from "./profiles";
import type { AgentContextTask, AgentRuntimeContext } from "./types";

const ACTIVE_STATUS_ORDER: Record<AtlasTaskState["status"], number> = {
  waiting_approval: 0,
  working: 1,
  moving: 2,
  queued: 3,
  blocked: 4,
  done: 5,
};

function contextTask(task: AtlasTaskState): AgentContextTask {
  return {
    id: task.id,
    title: task.title,
    objective: task.detail,
    status: task.status,
    progress: Number(task.progress.toFixed(3)),
    agentId: task.agentId,
    dependsOn: task.dependsOn,
    requiresApproval: Boolean(task.requiresApproval),
    approvalStatus: task.approvalStatus ?? "none",
    actionType: task.actionType ?? null,
  };
}

export function buildAgentContext(world: AtlasWorldState, agentId: string): AgentRuntimeContext {
  const profile = profileForAgent(agentId);
  const agent = world.agents.find((candidate) => candidate.id === agentId);
  if (!agent) throw new Error(`Agent is not present in world: ${agentId}`);

  const ownedTasks = world.tasks
    .filter((task) => task.agentId === agentId && task.status !== "done")
    .sort((a, b) => ACTIVE_STATUS_ORDER[a.status] - ACTIVE_STATUS_ORDER[b.status]);
  const activeTaskState = ownedTasks[0] ?? null;
  const activeTask = activeTaskState ? contextTask(activeTaskState) : null;
  const dependencies = activeTaskState
    ? activeTaskState.dependsOn
      .map((dependencyId) => world.tasks.find((task) => task.id === dependencyId))
      .filter((task): task is AtlasTaskState => Boolean(task))
      .map(contextTask)
    : [];

  const recentMessages = world.messages
    .filter((message) => message.fromAgentId === agentId || message.toAgentId === agentId)
    .slice(-profile.context.maxMessages)
    .map(({ id, fromAgentId, toAgentId, text, createdAt }) => ({ id, fromAgentId, toAgentId, text, createdAt }));

  const pendingApprovals = world.approvals
    .filter((approval) => approval.status === "pending")
    .filter((approval) => approval.agentId === agentId || (activeTask && approval.taskId === activeTask.id))
    .map(({ id, source, kind, status, title, detail, consequence, taskId, agentId: approvalAgentId, actionType }) => ({
      id,
      source,
      kind,
      status,
      title,
      detail,
      consequence,
      taskId,
      agentId: approvalAgentId,
      actionType,
    }));

  return {
    version: 1,
    worldRevision: world.revision,
    worldPhase: world.phase,
    workflowId: world.workflowId ?? null,
    simulationMode: true,
    agent: {
      id: profile.id,
      displayName: profile.displayName,
      role: profile.role,
      organisation: profile.organisation,
      side: profile.side,
      status: agent.status,
      goals: profile.goals,
      instructions: profile.instructions,
    },
    activeTask,
    dependencies,
    recentMessages,
    pendingApprovals,
    participants: world.agents.map((participant) => ({
      id: participant.id,
      displayName: participant.name,
      role: participant.role,
      side: participant.side,
    })),
    allowedActions: profile.allowedActions,
    allowedTools: profile.allowedTools,
    worldSummary: {
      completedTasks: world.tasks.filter((task) => task.status === "done").length,
      totalTasks: world.tasks.length,
      pendingApprovals: world.approvals.filter((approval) => approval.status === "pending").length,
    },
  };
}
