import { cp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientDir = path.join(root, "dist", "client");
const outputDir = path.join(root, "pages-dist");
const pagesBasePath = "/asympta-world";

if (process.env.ASYMPTA_PAGES_BUILD !== "1") {
  throw new Error(
    "Run the GitHub Pages export through npm run export:pages so its base path is built correctly.",
  );
}

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
await cp(clientDir, outputDir, { recursive: true });

// Vinext mirrors a path-style asset prefix into its on-disk client tree. A
// GitHub Pages artifact is already mounted at /asympta-world, so flatten that
// one deployment directory while keeping the public URLs base-prefixed.
const nestedDeploymentDir = path.join(
  outputDir,
  pagesBasePath.slice(1),
);
await rename(
  path.join(nestedDeploymentDir, "_next"),
  path.join(outputDir, "_next"),
);
await rm(nestedDeploymentDir, { recursive: true, force: true });

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
  new Request(`http://localhost${pagesBasePath}/`, {
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
  .replaceAll('"/_next/', '"./_next/')
  .replaceAll('\\"/_next/', '\\"./_next/')
  .replaceAll("'/_next/", "'./_next/")
  .replaceAll('"/favicon.svg', `"${pagesBasePath}/favicon.svg`)
  .replaceAll('\\"/favicon.svg', `\\"${pagesBasePath}/favicon.svg`)
  .replaceAll("'/favicon.svg", `'${pagesBasePath}/favicon.svg`);

await writeFile(path.join(outputDir, "index.html"), html);
await writeFile(path.join(outputDir, "404.html"), html);
await writeFile(path.join(outputDir, ".nojekyll"), "");

const exported = await readFile(path.join(outputDir, "index.html"), "utf8");
if (
  exported.includes('"/assets/') ||
  exported.includes('\\"/assets/') ||
  exported.includes("'/assets/") ||
  exported.includes('"/_next/') ||
  exported.includes('\\"/_next/') ||
  exported.includes("'/_next/") ||
  exported.includes('href="/favicon.svg') ||
  exported.includes('href=\\"/favicon.svg')
) {
  throw new Error(
    "Static export still contains a root-relative client reference.",
  );
}

if (
  !exported.includes(`${pagesBasePath}/_next/`) ||
  !exported.includes(`${pagesBasePath}/favicon.svg`)
) {
  throw new Error(
    "Static export is missing its GitHub Pages base-path references.",
  );
}

console.log("GitHub Pages export ready at pages-dist/");
