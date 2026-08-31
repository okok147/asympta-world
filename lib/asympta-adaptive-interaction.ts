export {
  createAdaptiveInteractionSchema,
  mergeAdaptiveClarifications,
  missingFieldsFromAdaptiveActivityData,
  normalizeAdaptiveMissingFields,
  planAdaptiveMissingFields,
} from "./asympta-adaptive-interaction-impl.ts";

export type AdaptiveInteractionLocale = "en" | "zh-Hant" | "ja";
export type AdaptiveAnswerValue = string | number | boolean;

export type AdaptiveInteractionOption = {
  value: AdaptiveAnswerValue;
  label: string;
  description?: string;
};

export type AdaptiveInteractionField = {
  id: string;
  sourceField: string;
  key: string;
  label: string;
  prompt: string;
  reason: string;
  control: "single_choice" | "text" | "number" | "boolean";
  options: AdaptiveInteractionOption[];
  allowCustom: boolean;
  customPlaceholder?: string;
  required: true;
  sensitive: boolean;
};

export type AdaptiveInteractionSchema = {
  schemaVersion: "asympta.adaptive-ui.v1";
  interactionId: string;
  intent: string;
  fields: AdaptiveInteractionField[];
  nextField: AdaptiveInteractionField | null;
  provenance: {
    source: "agent_missing_fields";
    mode: "runtime_schema";
    factPolicy: "unknown_until_user_confirmation";
    createdAt: string;
  };
};

export type AdaptiveConfirmation = {
  field: string;
  label: string;
  value: AdaptiveAnswerValue;
};
