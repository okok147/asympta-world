import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientDir = path.join(root, "dist", "client");
const outputDir = path.join(root, "pages-dist");

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
await cp(clientDir, outputDir, { recursive: true });

for (const relativePath of [
  ".assetsignore",
  "_headers",
  ".vite",
  "assets/exchange-tokens.png",
  "assets/neighborhood-map.png",
  "file.svg",
  "globe.svg",
  "window.svg",
]) {
  await rm(path.join(outputDir, relativePath), {
    recursive: true,
    force: true,
  });
}

const workerModule = await import(
  new URL("../dist/server/index.js", import.meta.url).href
);
const response = await workerModule.default.fetch(
  new Request("http://localhost/", {
    headers: { accept: "text/html" },
  }),
  {
    ASSETS: {
      fetch: async () => new Response("Not found", { status: 404 }),
    },
  },
  {
    waitUntil() {},
    passThroughOnException() {},
  },
);

if (!response.ok) {
  throw new Error(
    "Static render failed with status " + String(response.status),
  );
}

let html = await response.text();
html = html
  .replaceAll('"/assets/', '"./assets/')
  .replaceAll('\\"/assets/', '\\"./assets/')
  .replaceAll("'/assets/", "'./assets/")
  .replaceAll('href="/favicon.svg', 'href="./favicon.svg')
  .replaceAll('src="/favicon.svg', 'src="./favicon.svg');

await writeFile(path.join(outputDir, "index.html"), html);
await writeFile(path.join(outputDir, "404.html"), html);
await writeFile(path.join(outputDir, ".nojekyll"), "");

const exported = await readFile(path.join(outputDir, "index.html"), "utf8");
if (
  exported.includes('"/assets/') ||
  exported.includes('\\"/assets/') ||
  exported.includes("'/assets/")
) {
  throw new Error(
    "Static export still contains a root-relative client asset reference.",
  );
}

console.log("GitHub Pages export ready at pages-dist/");
