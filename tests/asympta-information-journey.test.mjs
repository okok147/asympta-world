import assert from "node:assert/strict";
import test from "node:test";

import {
  beginInformationJourney,
  EMPTY_INFORMATION_JOURNEY,
  failInformationJourney,
  finishInformationJourney,
  gatherInformationJourney,
  returnInformationJourney,
} from "../lib/asympta-information-journey.ts";

test("an external information trip leaves, gathers, returns, then delivers sources", () => {
  const departing = beginInformationJourney(EMPTY_INFORMATION_JOURNEY, "trip-1");
  assert.equal(departing.phase, "departing");
  assert.equal(departing.alreadyAtDestination, false);

  const gathering = gatherInformationJourney(departing, "trip-1");
  const returning = returnInformationJourney(gathering, "trip-1", {
    destination: "weather",
    sourceCount: 2,
  });
  const delivered = finishInformationJourney(returning, "trip-1", "delivered");

  assert.equal(gathering.phase, "gathering");
  assert.equal(returning.phase, "returning");
  assert.equal(delivered.phase, "delivered");
  assert.equal(delivered.destination, "weather");
  assert.equal(delivered.sourceCount, 2);
});

test("an agent already at the information place still collects and returns", () => {
  const first = gatherInformationJourney(
    beginInformationJourney(EMPTY_INFORMATION_JOURNEY, "trip-old"),
    "trip-old",
  );
  const alreadyThere = beginInformationJourney(first, "trip-new");

  assert.equal(alreadyThere.phase, "gathering");
  assert.equal(alreadyThere.alreadyAtDestination, true);

  const returning = returnInformationJourney(alreadyThere, "trip-new", {
    destination: "public-web",
    sourceCount: 1,
  });
  const delivered = finishInformationJourney(returning, "trip-new", "delivered");
  assert.equal(returning.phase, "returning");
  assert.equal(delivered.phase, "delivered");
});

test("stale trips cannot move the current agent or overwrite its result", () => {
  const current = gatherInformationJourney(
    beginInformationJourney(EMPTY_INFORMATION_JOURNEY, "trip-current"),
    "trip-current",
  );
  assert.equal(returnInformationJourney(current, "trip-old", {
    destination: "public-web",
    sourceCount: 4,
  }), current);
  assert.equal(failInformationJourney(current, "trip-old"), current);
});

test("a returned proposal waits at home instead of crossing the action boundary", () => {
  const gathering = gatherInformationJourney(
    beginInformationJourney(EMPTY_INFORMATION_JOURNEY, "trip-action"),
    "trip-action",
  );
  const returning = returnInformationJourney(gathering, "trip-action", {
    destination: "planning",
    sourceCount: 0,
  });
  const waiting = finishInformationJourney(returning, "trip-action", "waiting");
  assert.equal(waiting.phase, "waiting");
  assert.equal(waiting.sourceCount, 0);
});
