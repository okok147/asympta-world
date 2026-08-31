import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  asymptaPanelLayerOrder,
  asymptaRectsOverlap,
  calculateAsymptaTopPanelLayout,
} from "../lib/asympta-top-panel-layout.ts";

test("narrow top panels stack below one another without geometric overlap", () => {
  const layout = calculateAsymptaTopPanelLayout({
    viewportWidth: 390,
    viewportHeight: 844,
    accessTop: 8,
    accessWidth: 286,
    accessHeight: 248,
    requestWidth: 244,
  });

  assert.equal(layout.mode, "stacked");
  assert.ok(layout.requestTop >= 8 + 248 + 10);
  assert.ok(layout.requestMaxHeight >= 74);
  assert.ok(layout.requestDetailsMaxHeight >= 44);

  const access = { top: 8, left: 8, right: 294, bottom: 256 };
  const request = {
    top: layout.requestTop,
    left: 138,
    right: 382,
    bottom: layout.requestTop + Math.min(120, layout.requestMaxHeight),
  };
  assert.equal(asymptaRectsOverlap(access, request), false);
});

test("short viewports cap expanded access content and preserve a usable request card", () => {
  const layout = calculateAsymptaTopPanelLayout({
    viewportWidth: 390,
    viewportHeight: 320,
    accessTop: 8,
    accessWidth: 286,
    accessHeight: 480,
    requestWidth: 244,
  });

  assert.equal(layout.mode, "stacked");
  assert.ok(layout.accessPanelMaxHeight >= 54);
  assert.equal(layout.requestMaxHeight, 74);
  assert.ok(layout.requestTop + layout.requestMaxHeight + 92 <= 320);
});

test("wide viewports keep the two top panels split", () => {
  const layout = calculateAsymptaTopPanelLayout({
    viewportWidth: 1024,
    viewportHeight: 768,
    accessTop: 10,
    accessWidth: 352,
    accessHeight: 220,
    requestWidth: 326,
  });

  assert.deepEqual(layout, {
    mode: "split",
    accessPanelMaxHeight: null,
    requestTop: null,
    requestMaxHeight: null,
    requestDetailsMaxHeight: null,
  });
});

test("the clicked panel receives the front layer deterministically", () => {
  assert.deepEqual(asymptaPanelLayerOrder("access"), { access: 96, request: 88 });
  assert.deepEqual(asymptaPanelLayerOrder("request"), { access: 88, request: 96 });
});

test("browser manager mounts, measures both cards and promotes pointer or keyboard focus", async () => {
  const [page, manager, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/asympta-top-panel-manager.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/asympta-top-panel-manager.module.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /AsymptaTopPanelManager/);
  assert.match(manager, /\.asympta-access-card/);
  assert.match(manager, /\.asympta-request-card/);
  assert.match(manager, /ResizeObserver/);
  assert.match(manager, /MutationObserver/);
  assert.match(manager, /visualViewport/);
  assert.match(manager, /document\.addEventListener\("pointerdown", onPointerDown, true\)/);
  assert.match(manager, /document\.addEventListener\("focusin", onFocusIn, true\)/);
  assert.match(manager, /bringToFront\("request"\)/);
  assert.match(manager, /data-asympta-top-panel-manager/);
  assert.doesNotMatch(manager, /setInterval|advanceAtlasWorld|startAtlasWorkflow/);

  assert.match(css, /data-asympta-top-panel-front="access"/);
  assert.match(css, /data-asympta-top-panel-front="request"/);
  assert.match(css, /data-asympta-top-panels="stacked"/);
  assert.match(css, /--asympta-top-panel-request-top/);
  assert.match(css, /--asympta-top-panel-request-max-height/);
  assert.match(css, /--asympta-top-panel-access-panel-max-height/);
  assert.match(css, /z-index: 96 !important/);
  assert.match(css, /display: grid/);
});
