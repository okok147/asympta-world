export const ASYMPTA_CAMERA_FOLLOW_COMMAND_EVENT = "asympta:camera-follow-command" as const;
export const ASYMPTA_CAMERA_FOLLOW_STATE_EVENT = "asympta:camera-follow-state" as const;

export type AsymptaCameraFollowCommand = {
  enabled: boolean;
  source: "user" | "workflow";
};

export type AsymptaCameraFollowState = {
  following: boolean;
  manualLock: boolean;
  activeAgentId: string | null;
};

export function requestAsymptaCameraFollow(command: AsymptaCameraFollowCommand) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<AsymptaCameraFollowCommand>(ASYMPTA_CAMERA_FOLLOW_COMMAND_EVENT, {
    detail: command,
  }));
}

export function publishAsymptaCameraFollowState(state: AsymptaCameraFollowState) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<AsymptaCameraFollowState>(ASYMPTA_CAMERA_FOLLOW_STATE_EVENT, {
    detail: state,
  }));
}

export function subscribeAsymptaCameraFollowState(listener: (state: AsymptaCameraFollowState) => void) {
  if (typeof window === "undefined") return () => undefined;
  const onState = (event: Event) => {
    const detail = (event as CustomEvent<AsymptaCameraFollowState>).detail;
    if (detail && typeof detail.following === "boolean") listener(detail);
  };
  window.addEventListener(ASYMPTA_CAMERA_FOLLOW_STATE_EVENT, onState);
  return () => window.removeEventListener(ASYMPTA_CAMERA_FOLLOW_STATE_EVENT, onState);
}
