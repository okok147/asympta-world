import { readFile, writeFile } from "node:fs/promises";
const path = "components/asympta-world-experience.tsx";
let source = await readFile(path, "utf8");
const from = 'PIXEL CITY · LIVING WORLD';
const to = 'PIXEL CITY · CITY-SCALE LIVING WORLD';
if (!source.includes(from)) throw new Error("pixel title marker missing");
source = source.replace(from, to);
await writeFile(path, source);
