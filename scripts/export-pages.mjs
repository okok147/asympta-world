import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const outputDir = path.join(root, "pages-dist");
const buildDir = path.join(root, "build");
const clientDir = path.join(buildDir, "client");
const publicDir = path.join(root, "public");
const pagesBasePath = "/asympta-world";
const faviconName = "favicon-asympta-cat-20260829.svg";

await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(outputDir, { recursive: true });

async function copyDirectory(source, destination) {
  try {
    await fs.cp(source, destination, { recursive: true, force: true });
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

await copyDirectory(clientDir, outputDir);
await copyDirectory(publicDir, outputDir);

const workerModule = path.join(buildDir, "worker", "index.js");
const worker = await import(`${pathToFileURL(workerModule).href}?pages=${Date.now()}`);

const response = await worker.default.fetch(new Request("http://asympta.local/"), {
  ASSETS: {
    fetch(request) {
      return new Response(`Missing generated asset: ${new URL(request.url).pathname}`, { status: 404 });
    },
  },
});

if (!response.ok) {
  throw new Error(`Static render failed with ${response.status}: ${await response.text()}`);
}

let html = await response.text();

const rootRelativePrefixes = ["/_next/", "/assets/"];
for (const prefix of rootRelativePrefixes) {
  html = html.replaceAll(`\"${prefix}`, `\"${pagesBasePath}${prefix}`);
  html = html.replaceAll(`'${prefix}`, `'${pagesBasePath}${prefix}`);
  html = html.replaceAll(`"${prefix}`, `"${pagesBasePath}${prefix}`);
}

html = html.replaceAll(`href="/${faviconName}`, `href="${pagesBasePath}/${faviconName}`);
html = html.replaceAll(`href=\"/${faviconName}`, `href=\"${pagesBasePath}/${faviconName}`);
html = html.replaceAll(`href='/${faviconName}`, `href='${pagesBasePath}/${faviconName}`);

await fs.writeFile(path.join(outputDir, "index.html"), html);
await fs.writeFile(path.join(outputDir, ".nojekyll"), "");

const exported = await fs.readFile(path.join(outputDir, "index.html"), "utf8");

if (
  exported.includes('"/assets/') ||
  exported.includes('\\"/assets/') ||
  exported.includes("'/assets/") ||
  exported.includes('"/_next/') ||
  exported.includes('\\"/_next/') ||
  exported.includes("'/_next/") ||
  exported.includes(`href="/${faviconName}`) ||
  exported.includes(`href=\\"/${faviconName}`)
) {
  throw new Error(
    "Static export still contains a root-relative client reference.",
  );
}

if (
  !exported.includes(`${pagesBasePath}/_next/`) ||
  !exported.includes(`${pagesBasePath}/${faviconName}`)
) {
  throw new Error(
    "Static export is missing its GitHub Pages base-path references.",
  );
}

console.log("GitHub Pages export ready at pages-dist/");
