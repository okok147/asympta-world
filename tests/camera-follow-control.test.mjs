import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [page, control, controlCss, processFollow, contract, world] = await Promise.all([
  readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/asympta-camera-follow-control.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/asympta-camera-follow-control.module.css", import.meta.url), "utf8"),
  readFile(new URL("../components/asympta-process-camera-follow.tsx", import.meta.url), "utf8"),
  readFile(new URL("../lib/asympta-camera-follow.ts", import.meta.url), "utf8"),
  readFile(new URL("../components/asympta-world-live-60hz.tsx", import.meta.url), "utf8"),
]);

test("camera follow is a persistent top-menu control rather than being hidden in the agent card", () => {
  assert.match(page, /AsymptaCameraFollowControl/);
  assert.ok(page.indexOf("<AsymptaWorldLive60Hz") < page.indexOf("<AsymptaCameraFollowControl"));
  assert.match(control, /querySelector<HTMLElement>\("\.atlas-menu-bar"\)/);
  assert.match(control, /createPortal/);
  assert.match(control, /asympta-camera-follow-toggle/);
  assert.match(control, /aria-pressed=\{following\}/);
  assert.match(control, /Turn camera follow on/);
  assert.match(control, /開啟鏡頭跟隨/);
  assert.match(control, /カメラ追従をオンにする/);
  assert.match(controlCss, /grid-column: 2/);
  assert.match(controlCss, /grid-template-columns: minmax\(0, 1fr\) 40px 40px 40px/);
  assert.match(controlCss, /asympta-camera-follow-toggle\.is-active/);
});

test("user on and off commands are explicit and the process controller owns the actual map state", () => {
  assert.match(contract, /asympta:camera-follow-command/);
  assert.match(contract, /source: "user" \| "workflow"/);
  assert.match(control, /requestAsymptaCameraFollow\(\{ enabled: !following, source: "user" \}\)/);
  assert.match(processFollow, /ASYMPTA_CAMERA_FOLLOW_COMMAND_EVENT/);
  assert.match(processFollow, /handleFollowCommand/);
  assert.match(processFollow, /disableProcessLock\(command\.source === "user"\)/);
  assert.match(processFollow, /clearManualFollowLock\(\)/);
  assert.match(processFollow, /enableProcessLock\(\)/);
  assert.match(processFollow, /disableVisibleCameraFollow\(\)/);
  assert.match(processFollow, /__ASYMPTA_MAP__\?\.fire\?\.\("dragstart"/);
  assert.match(processFollow, /asymptaCameraFollowManualLock/);
  assert.match(processFollow, /asymptaCameraFollow = following \? "on" : "off"/);
});

test("marketplace execution auto-arms follow once but never overrides a manual off", () => {
  assert.match(control, /MARKETPLACE_EXECUTION_EVENT/);
  assert.match(control, /activeExecutionRef\.current === execution\.executionId/);
  assert.match(control, /source: "workflow"/);
  assert.match(control, /asymptaCameraFollowManualLock === "on"/);
  assert.match(control, /WORKFLOW_RETRY_MS = 180/);
  assert.match(processFollow, /command\.source === "workflow" && manualFollowLock/);
  assert.match(processFollow, /A manual off\/drag is authoritative/);
  assert.doesNotMatch(control, /advanceAtlasWorld|startAtlasDemoWorkflow|setCenter\(/);
});

test("the original selected-agent follow button remains synchronized as a secondary control", () => {
  assert.match(world, /className=\{`atlas-follow\$\{cameraFollow \? " is-active" : ""\}`\}/);
  assert.match(world, /onClick=\{toggleCameraFollow\}/);
  assert.match(processFollow, /closest\("\.atlas-follow"\)/);
  assert.match(processFollow, /cameraFollowIsActive\(\)/);
});
