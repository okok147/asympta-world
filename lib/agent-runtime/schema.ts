import type { AgentRuntimeContext } from "./types";

export function decisionSchemaForContext(context: AgentRuntimeContext): Record<string, unknown> {
  const participantIds = context.participants.map((participant) => participant.id).filter((id) => id !== context.agent.id);
  const branches: Record<string, unknown>[] = [];

  if (context.allowedActions.includes("send_message")) {
    branches.push({
      type: "object",
      properties: {
        action: { const: "send_message" },
        targetAgentId: { type: "string", enum: participantIds },
        message: { type: "string", minLength: 1, maxLength: 600 },
      },
      required: ["action", "targetAgentId", "message"],
      additionalProperties: false,
    });
  }

  if (context.allowedActions.includes("request_tool") && context.allowedTools.length > 0) {
    branches.push({
      type: "object",
      properties: {
        action: { const: "request_tool" },
        tool: { type: "string", enum: [...context.allowedTools] },
        arguments: { type: "object" },
        reason: { type: "string", minLength: 3, maxLength: 300 },
      },
      required: ["action", "tool", "arguments", "reason"],
      additionalProperties: false,
    });
  }

  if (context.allowedActions.includes("complete_task") && context.activeTask) {
    branches.push({
      type: "object",
      properties: {
        action: { const: "complete_task" },
        summary: { type: "string", minLength: 3, maxLength: 600 },
      },
      required: ["action", "summary"],
      additionalProperties: false,
    });
  }

  if (context.allowedActions.includes("wait")) {
    branches.push({
      type: "object",
      properties: {
        action: { const: "wait" },
        reason: { type: "string", minLength: 1, maxLength: 400 },
      },
      required: ["action", "reason"],
      additionalProperties: false,
    });
  }

  if (context.allowedActions.includes("delegate")) {
    branches.push({
      type: "object",
      properties: {
        action: { const: "delegate" },
        targetAgentId: { type: "string", enum: participantIds },
        objective: { type: "string", minLength: 3, maxLength: 500 },
      },
      required: ["action", "targetAgentId", "objective"],
      additionalProperties: false,
    });
  }

  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "AsymptaAgentDecision",
    description: "One bounded proposal from an Asympta agent. The decision never mutates world state by itself.",
    oneOf: branches,
  };
}
