import { readFile, writeFile } from "node:fs/promises";

const path = "components/asympta-world-experience.tsx";
let source = await readFile(path, "utf8");

const replacements = [
  ["PIXEL CITY · LIVING WORLD", "PIXEL CITY · CITY-SCALE LIVING WORLD"],
  ["Ask once. Watch the pixel city coordinate.", "Ask once. Watch the city coordinate."],
  [
    "Every road, district, place and moving agent now lives on the same literal pixel grid. Scroll or use + / − to zoom; drag the map to explore.",
    "Business-side agents receive, clarify, source, make, inspect and deliver through the same map. Every road, district, place and moving agent lives on the same literal pixel grid. Scroll or use + / − to zoom; drag the map to explore.",
  ],
];

for (const [from, to] of replacements) {
  if (!source.includes(from)) throw new Error(`pixel product marker missing: ${from}`);
  source = source.replace(from, to);
}

await writeFile(path, source);
