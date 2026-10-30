import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destination = path.join(root, "ios/AsymptaWorld/Web");
const environment = { ...process.env, ASYMPTA_MOBILE_BUILD: "1" };
// Public web authentication is tied to the hosted origin. No web credential or
// build-machine secret is inherited by the app's bundled client.
delete environment.NEXT_PUBLIC_ASYMPTA_AGENT_API_URL;
delete environment.NEXT_PUBLIC_ASYMPTA_TURNSTILE_SITE_KEY;

const result = await new Promise((resolve, reject) => {
  const child = spawn("npm", ["run", "export:pages"], {
    cwd: root, env: environment, stdio: "inherit",
  });
  child.on("error", reject);
  child.on("exit", (code, signal) => resolve({ code, signal }));
});
if (result.code !== 0) throw new Error(`Mobile web export failed: ${result.code ?? result.signal}`);

await mkdir(path.dirname(destination), { recursive: true });
await rm(destination, { force: true, recursive: true });
await cp(path.join(root, "pages-dist"), destination, { recursive: true });

const files = [];
async function walk(directory, prefix = "") {
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) await walk(path.join(directory, entry.name), relative);
    else if (entry.isFile()) {
      const body = await readFile(path.join(directory, entry.name));
      files.push({ path: relative, bytes: body.length, sha256: createHash("sha256").update(body).digest("hex") });
    } else throw new Error(`Unsupported mobile asset: ${relative}`);
  }
}
await walk(destination);
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const manifest = {
  format: "asympta-mobile-bundle/1", sourceCommit: git("rev-parse", "HEAD"),
  sourceTree: git("rev-parse", "HEAD^{tree}"),
  trackedSourceClean: git("status", "--porcelain", "--untracked-files=no") === "",
  basePath: "/asympta-world/", publicAgentConfigured: false,
  assetsSha256: createHash("sha256").update(JSON.stringify(files)).digest("hex"), files,
};
await writeFile(path.join(destination, "build-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`Mobile bundle ready: ${files.length} assets, source ${manifest.sourceCommit}, clean=${manifest.trackedSourceClean}`);
