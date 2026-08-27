import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const popupSource = await readFile(
  new URL("../components/popup-dismiss-runtime.tsx", import.meta.url),
  "utf8",
);
const celebrationSource = await readFile(
  new URL("../components/task-celebration-runtime.tsx", import.meta.url),
  "utf8",
);
const templateSource = await readFile(
  new URL("../app/template.tsx", import.meta.url),
  "utf8",
);

test("interactive popup surfaces always expose an explicit close affordance", () => {
  assert.match(popupSource, /\.places-directory-panel/);
  assert.match(popupSource, /\.route-visit-card/);
  assert.match(popupSource, /\.webmcp-scenario-picker/);
  assert.match(popupSource, /data-asympta-runtime-close="true"/);
  assert.match(popupSource, /Close places directory/);
  assert.match(popupSource, /Close comparison card/);
  assert.match(popupSource, /Close scenario picker/);
});

test("popup dismissal also supports Escape and preserves native close controls", () => {
  assert.match(popupSource, /event\.key !== "Escape"/);
  assert.match(popupSource, /\[data-slot="sheet-close"\]/);
  assert.match(popupSource, /button\[aria-label\^="Close"\]/);
  assert.match(popupSource, /ancestorZIndex/);
});

test("completed tasks produce a lightweight non-blocking celebration", () => {
  assert.match(celebrationSource, /asympta:task-process/);
  assert.match(celebrationSource, /asympta:user-task-process/);
  assert.match(celebrationSource, /status === "completed"/);
  assert.match(celebrationSource, /progress < 100/);
  assert.match(celebrationSource, /task-celebration-particle/);
  assert.match(celebrationSource, /pointer-events: none/);
  assert.match(celebrationSource, /prefers-reduced-motion/);
});

test("historical completed missions are baselined instead of replayed on load", () => {
  assert.match(celebrationSource, /missionsReadyRef\.current/);
  assert.match(celebrationSource, /seenMissionsRef\.current\.add/);
  assert.match(celebrationSource, /scenarioReadyRef\.current/);
});

test("world template mounts both safety runtimes", () => {
  assert.match(templateSource, /PopupDismissRuntime/);
  assert.match(templateSource, /TaskCelebrationRuntime/);
  assert.match(templateSource, /<PopupDismissRuntime \/>/);
  assert.match(templateSource, /<TaskCelebrationRuntime \/>/);
});
