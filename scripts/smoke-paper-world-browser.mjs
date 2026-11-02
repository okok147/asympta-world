import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "pages-dist");
const base = "/asympta-world";
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

function findChrome() {
  for (const name of [process.env.CHROME_BIN, "google-chrome", "google-chrome-stable", "chromium", "chromium-browser"].filter(Boolean)) {
    if (name.includes("/")) return name;
    const result = spawnSync("which", [name], { encoding: "utf8" });
    if (result.status === 0) return result.stdout.trim();
  }
  throw new Error("Chrome/Chromium is required for the paper-world browser check.");
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function serveExport() {
  return createServer(async (req, res) => {
    try {
      let urlPath = new URL(req.url ?? "/", "http://localhost").pathname;
      if (urlPath === base || urlPath === base + "/") urlPath = "/index.html";
      else if (urlPath.startsWith(base + "/")) urlPath = urlPath.slice(base.length);
      else return res.writeHead(404).end("Not found");

      const target = path.resolve(dist, urlPath.slice(1));
      if (!target.startsWith(dist + path.sep)) return res.writeHead(403).end("Forbidden");
      if ((await stat(target)).isDirectory()) return res.writeHead(404).end("Not found");
      const bytes = await readFile(target);
      res.writeHead(200, { "content-type": mime[path.extname(target)] ?? "application/octet-stream" });
      res.end(bytes);
    } catch (error) {
      res.writeHead(404).end(error instanceof Error ? error.message : String(error));
    }
  });
}

async function availablePort() {
  const probe = net.createServer();
  await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const address = probe.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

async function waitForDebugger(port) {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (res.ok) {
        const targets = await res.json();
        const page = targets.find((item) => item.type === "page");
        if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
      }
    } catch {}
    await sleep(100);
  }
  throw new Error("Chrome debugging endpoint unavailable.");
}

async function run() {
  const site = serveExport();
  await new Promise((resolve) => site.listen(0, "127.0.0.1", resolve));
  const address = site.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const debugPort = await availablePort();
  const chrome = spawn(findChrome(), [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=/tmp/asympta-paper-world-${process.pid}`,
    "about:blank",
  ], { stdio: "ignore" });

  let socket;
  try {
    socket = new WebSocket(await waitForDebugger(debugPort));
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });

    let nextId = 0;
    const pending = new Map();
    const exceptions = [];
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id && pending.has(message.id)) {
        const { resolve, reject } = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      }
      if (message.method === "Runtime.exceptionThrown") {
        exceptions.push(message.params?.exceptionDetails?.text ?? "Browser runtime error");
      }
    });

    const command = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async () => {
      const expression = `JSON.stringify((() => {
        const main = document.querySelector("main.paper-world");
        const dots = [...document.querySelectorAll(".paper-world__dot")];
        const rect = main?.getBoundingClientRect();
        return {
          ready: document.readyState,
          mainCount: document.querySelectorAll("main").length,
          dotCount: dots.length,
          dotsVisible: dots.every(dot => {
            const r = dot.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && r.left > 0 && r.right < innerWidth && r.top > 0 && r.bottom < innerHeight;
          }),
          animationNames: dots.map(dot => getComputedStyle(dot).animationName),
          positions: dots.map(dot => {
            const r = dot.getBoundingClientRect();
            return [r.left, r.top];
          }),
          paperVisible: !!rect && Math.abs(rect.width - innerWidth) < 1 && Math.abs(rect.height - innerHeight) < 1,
          background: main ? getComputedStyle(main).backgroundColor : "",
          hasOtherUI: !!document.querySelector("button, nav, header, footer, form, canvas, .map-app, .atlas-console"),
          bodyText: document.body.innerText.trim(),
          reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches
        };
      })())`;
      const value = await command("Runtime.evaluate", { expression, returnByValue: true });
      if (value.exceptionDetails) throw new Error(value.exceptionDetails.text ?? "Failed to inspect page");
      return JSON.parse(value.result.value ?? "{}");
    };

    await command("Runtime.enable");
    await command("Page.enable");
    await command("Page.navigate", { url: `http://127.0.0.1:${port}${base}/` });
    await sleep(1300);
    const first = await evaluate();
    await sleep(1400);
    const second = await evaluate();

    if (second.ready !== "complete" || second.mainCount !== 1 || second.dotCount !== 6 ||
        !second.dotsVisible || !second.paperVisible || second.hasOtherUI || second.bodyText) {
      throw new Error(`Paper-only canvas failed: ${JSON.stringify(second)}`);
    }
    if (!/^rgb\\(248, 245, 237\\)$/.test(second.background)) {
      throw new Error(`Wrong paper background: ${second.background}`);
    }
    if (!second.reducedMotion) {
      if (second.animationNames.some((name) => !name.startsWith("wander-"))) {
        throw new Error(`Missing dot animation: ${JSON.stringify(second.animationNames)}`);
      }
      const maxDelta = Math.max(...first.positions.map(([x, y], index) =>
        Math.hypot(x - second.positions[index][0], y - second.positions[index][1])));
      if (maxDelta < 0.02) throw new Error(`User dots did not move: ${maxDelta}px`);
    }
    if (exceptions.length) throw new Error(`Browser exceptions: ${exceptions.join("; ")}`);
    console.log("Paper-world browser smoke passed: blank viewport, six drifting dots, no other UI or runtime errors.");
  } finally {
    socket?.close();
    chrome.kill("SIGTERM");
    site.close();
  }
}

await run();
