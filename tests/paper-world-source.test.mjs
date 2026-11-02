import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (name) => readFile(new URL(name, import.meta.url), "utf8");

test("the root does not mount any legacy renderer, menu, or map bootstrap", async () => {
  const [page, layout] = await Promise.all([
    read("../app/page.tsx"),
    read("../app/layout.tsx"),
  ]);
  assert.match(page, /className="paper-world"/);
  assert.match(page, /const DOTS = 6/);
  assert.doesNotMatch(page, /"use client"|AsymptaWorldLive60Hz|AsymptaIntentComposer|AsymptaTaskKernelBridge/);
  assert.match(layout, /import "\.\/paper-world\.css"/);
  assert.doesNotMatch(layout, /asympta-restoration|asympta-live-60hz|ASYMPTA_MAP_BRIDGE_BOOTSTRAP|dangerouslySetInnerHTML/);
});

test("motion uses only composited transforms, with reduced motion respected", async () => {
  const css = await read("../app/paper-world.css");
  assert.match(css, /background-color:\s*#f8f5ed/);
  assert.match(css, /@keyframes wander-a/);
  assert.match(css, /@keyframes wander-b/);
  assert.match(css, /@keyframes wander-c/);
  assert.match(css, /transform:\s*translate3d\(/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /pointer-events:\s*none/);
  assert.doesNotMatch(css, /url\(|box-shadow:|filter:|backdrop-filter:/);
});
