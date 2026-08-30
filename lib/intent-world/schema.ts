import { INTENT_AGENT_BY_ID, INTENT_LOCATIONS } from "./catalog.ts";
import {
  ASYMPTA_ACTION_TYPES,
  ASYMPTA_AGENT_IDS,
  ASYMPTA_LOCATION_IDS,
  CONSEQUENTIAL_ACTIONS,
} from "./types.ts";

export const PLANNER_RESPONSE_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    ready: { type: "boolean" },
    assistantMessage: { type: "string", minLength: 1, maxLength: 1000 },
    questions: {
      type: "array",
      maxItems: 4,
      items: { type: "string", minLength: 1, maxLength: 300 },
    },
    plan: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          properties: {
            id: { type: "string", minLength: 1, maxLength: 80 },
            title: { type: "string", minLength: 3, maxLength: 100 },
            summary: { type: "string", minLength: 3, maxLength: 500 },
            outcome: { type: "string", minLength: 3, maxLength: 500 },
            acceptanceCriteria: {
              type: "array",
              minItems: 1,
              maxItems: 8,
              items: { type: "string", minLength: 1, maxLength: 240 },
            },
            tasks: {
              type: "array",
              minItems: 3,
              maxItems: 14,
              items: {
                type: "object",
                properties: {
                  id: { type: "string", minLength: 1, maxLength: 50 },
                  title: { type: "string", minLength: 3, maxLength: 120 },
                  detail: { type: "string", minLength: 3, maxLength: 700 },
                  agentId: { type: "string", enum: [...ASYMPTA_AGENT_IDS] },
                  locationId: { type: "string", enum: [...ASYMPTA_LOCATION_IDS] },
                  dependsOn: {
                    type: "array",
                    maxItems: 8,
                    items: { type: "string", minLength: 1, maxLength: 50 },
                  },
                  workMs: { type: "integer", minimum: 900, maximum: 12000 },
                  actionType: { type: "string", enum: [...ASYMPTA_ACTION_TYPES] },
                  requiresApproval: { type: "boolean" },
                  consequence: { type: "string", maxLength: 400 },
                  validation: { type: "string", minLength: 3, maxLength: 300 },
                },
                required: [
                  "id",
                  "title",
                  "detail",
                  "agentId",
                  "locationId",
                  "dependsOn",
                  "workMs",
                  "actionType",
                  "requiresApproval",
                  "consequence",
                  "validation",
                ],
                additionalProperties: false,
              },
            },
          },
          required: ["id", "title", "summary", "outcome", "acceptanceCriteria", "tasks"],
          additionalProperties: false,
        },
      ],
    },
  },
  required: ["ready", "assistantMessage", "questions", "plan"],
  additionalProperties: false,
};

export function describePlannerCapabilities() {
  return {
    agents: ASYMPTA_AGENT_IDS.map((id) => ({ ...INTENT_AGENT_BY_ID[id] })),
    locations: ASYMPTA_LOCATION_IDS.map((id) => INTENT_LOCATIONS[id]),
    actionTypes: [...ASYMPTA_ACTION_TYPES],
    consequentialActions: [...CONSEQUENTIAL_ACTIONS],
  };
}
