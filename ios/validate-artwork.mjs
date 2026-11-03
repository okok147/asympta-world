import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const art = join(dirname(fileURLToPath(import.meta.url)), "AsymptaWorld", "Art");
const sourceSHA256 = "944096477b24070b5fb215371a23d0ba50a80b34e64769b947dc259c48ae49e3";
const manifest = JSON.parse(readFileSync(join(art, "manifest.json"), "utf8"));
const terrain = JSON.parse(readFileSync(join(art, "terrain-provenance.json"), "utf8"));
const assert = (value, message) => { if (!value) throw new Error(message); };
assert(manifest.source?.sha256 === sourceSHA256, "Unexpected original artwork identity");
assert(manifest.canvas?.width === 941 && manifest.canvas?.height === 1672, "Unexpected canvas");
assert(terrain.originalSHA256 === sourceSHA256 && terrain.kind === "derived-clean-terrain", "Missing terrain derivation");

function inspect(file) {
  assert(basename(file) === file, "Asset path must be a local basename");
  const bytes = readFileSync(join(art, file));
  assert(bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a", `Invalid PNG: ${file}`);
  return {
    file, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20),
    colorType: bytes[25], bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}
const outputs = [];
for (const id of ["reader", "fox", "tea", "cat", "bear"]) {
  const item = manifest.assets?.[id];
  assert(item, `Missing original resident: ${id}`);
  const image = inspect(item.file);
  const frame = item.frame;
  assert(frame && [frame.x, frame.y, frame.width, frame.height].every(Number.isFinite), `Invalid frame: ${id}`);
  assert(frame.x >= 0 && frame.y >= 0 && frame.width > 0 && frame.height > 0 &&
    frame.x + frame.width <= 941 && frame.y + frame.height <= 1672, `Frame out of bounds: ${id}`);
  assert(image.width === frame.width && image.height === frame.height, `Sprite/frame size differs: ${id}`);
  assert(image.colorType === 6 || image.colorType === 4, `Sprite has no alpha channel: ${id}`);
  if (item.sha256) assert(item.sha256 === image.sha256, `Sprite digest differs: ${id}`);
  outputs.push({ id, ...image, frame });
}
const ground = inspect("terrain.png");
assert(ground.width === 941 && ground.height === 1672, "Terrain size differs");
assert(ground.sha256 === terrain.sha256, "Terrain digest differs");
outputs.push(ground, inspect("paper.png"), inspect("brand.png"));
process.stdout.write(JSON.stringify({ ok: true, sourceSHA256, canvas: manifest.canvas, assets: outputs }, null, 2) + "\n");
