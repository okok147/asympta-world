import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test("mobile uses native two-finger pinch to drive the canonical wheel camera engine", async () => {
  const [pinch, page, template] = await Promise.all([
    readFile(path.join(root, "components/mobile-pinch-zoom-runtime.tsx"), "utf8"),
    readFile(path.join(root, "app/page.tsx"), "utf8"),
    readFile(path.join(root, "app/template.tsx"), "utf8"),
  ]);

  assert.match(pinch, /touchstart/);
  assert.match(pinch, /touchmove/);
  assert.match(pinch, /touchend/);
  assert.match(pinch, /touchcancel/);
  assert.match(pinch, /passive: false/);
  assert.match(pinch, /event\.touches\.length < 2/);
  assert.match(pinch, /Math\.hypot/);
  assert.match(pinch, /midpoint/);
  assert.match(pinch, /new WheelEvent\("wheel"/);
  assert.match(pinch, /clientX: center\.x/);
  assert.match(pinch, /clientY: center\.y/);
  assert.match(pinch, /-Math\.log\(ratio\) \/ WHEEL_ZOOM_COEFFICIENT/);
  assert.match(page, /Math\.exp\(-event\.deltaY \* 0\.0012\)/);
  assert.match(template, /<MobilePinchZoomRuntime \/>/);
});

test("pinch suppresses stale one-finger pan and native Safari page zoom", async () => {
  const pinch = await readFile(path.join(root, "components/mobile-pinch-zoom-runtime.tsx"), "utf8");
  assert.match(pinch, /suppressPan/);
  assert.match(pinch, /pointermove/);
  assert.match(pinch, /capture: true/);
  assert.match(pinch, /event\.pointerType !== "touch"/);
  assert.match(pinch, /gesturestart/);
  assert.match(pinch, /gesturechange/);
  assert.match(pinch, /touch-action:none/);
  assert.match(pinch, /overscroll-behavior:contain/);
});

test("pinch stores the resulting camera preference and preserves existing follow preference", async () => {
  const pinch = await readFile(path.join(root, "components/mobile-pinch-zoom-runtime.tsx"), "utf8");
  assert.match(pinch, /asympta-user-preferences-v1/);
  assert.match(pinch, /cameraScale: camera\.scale/);
  assert.match(pinch, /cameraX: camera\.x/);
  assert.match(pinch, /cameraY: camera\.y/);
  assert.match(pinch, /cameraFollow: parsed\.cameraFollow \?\? true/);
  assert.match(pinch, /requestAnimationFrame/);
});
