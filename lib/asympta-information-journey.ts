export type InformationJourneyPhase =
  | "idle"
  | "departing"
  | "gathering"
  | "returning"
  | "delivered"
  | "waiting"
  | "failed";

export type InformationJourneyDestination =
  | "external"
  | "weather"
  | "public-web"
  | "planning"
  | "clarification";

export type InformationJourneyState = {
  tripId: string | null;
  phase: InformationJourneyPhase;
  destination: InformationJourneyDestination;
  sourceCount: number;
  alreadyAtDestination: boolean;
};

export const EMPTY_INFORMATION_JOURNEY: InformationJourneyState = {
  tripId: null,
  phase: "idle",
  destination: "external",
  sourceCount: 0,
  alreadyAtDestination: false,
};

export function beginInformationJourney(
  previous: InformationJourneyState,
  tripId: string,
): InformationJourneyState {
  const alreadyAtDestination = previous.phase === "gathering";
  return {
    tripId,
    phase: alreadyAtDestination ? "gathering" : "departing",
    destination: "external",
    sourceCount: 0,
    alreadyAtDestination,
  };
}

export function gatherInformationJourney(
  current: InformationJourneyState,
  tripId: string,
): InformationJourneyState {
  if (current.tripId !== tripId || current.phase !== "departing") return current;
  return { ...current, phase: "gathering" };
}

export function returnInformationJourney(
  current: InformationJourneyState,
  tripId: string,
  input: { destination: InformationJourneyDestination; sourceCount: number },
): InformationJourneyState {
  if (current.tripId !== tripId || current.phase !== "gathering") return current;
  return {
    ...current,
    phase: "returning",
    destination: input.destination,
    sourceCount: Math.max(0, Math.trunc(input.sourceCount)),
  };
}

export function finishInformationJourney(
  current: InformationJourneyState,
  tripId: string,
  phase: Extract<InformationJourneyPhase, "delivered" | "waiting">,
): InformationJourneyState {
  if (current.tripId !== tripId || current.phase !== "returning") return current;
  return { ...current, phase };
}

export function failInformationJourney(
  current: InformationJourneyState,
  tripId: string,
): InformationJourneyState {
  if (current.tripId !== tripId) return current;
  if (!(["departing", "gathering", "returning"] as InformationJourneyPhase[]).includes(current.phase)) {
    return current;
  }
  return { ...current, phase: "failed" };
}
