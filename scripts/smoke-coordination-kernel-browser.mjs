import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "pages-dist");
const basePath = "/asympta-world";
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

function findChrome() {
  for (const candidate of [
    process.env.CHROME_BIN,
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
  ].filter(Boolean)) {
    if (candidate.includes("/")) return candidate;
    const result = spawnSync("which", [candidate], { encoding: "utf8" });
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  }
  throw new Error("Business-mode browser smoke requires Chrome/Chromium on the CI runner.");
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function staticServer() {
  return createServer(async (request, response) => {
    try {
      const rawUrl = new URL(request.url ?? "/", "http://localhost");
      let pathname = decodeURIComponent(rawUrl.pathname);
      if (pathname === basePath || pathname === `${basePath}/`) pathname = "/index.html";
      else if (pathname.startsWith(`${basePath}/`)) pathname = pathname.slice(basePath.length);
      if (pathname === "/") pathname = "/index.html";

      const relative = pathname.replace(/^\/+/, "");
      const candidate = path.resolve(outputDir, relative);
      if (!candidate.startsWith(outputDir + path.sep) && candidate !== path.join(outputDir, "index.html")) {
        response.writeHead(403).end("Forbidden");
        return;
      }

      let file = candidate;
      try {
        if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
      } catch {
        file = path.join(outputDir, "404.html");
      }

      const body = await readFile(file);
      response.writeHead(200, {
        "content-type": MIME[path.extname(file)] ?? "application/octet-stream",
        "cache-control": "no-store",
      });
      response.end(body);
    } catch (error) {
      response.writeHead(500, { "content-type": "text/plain" });
      response.end(error instanceof Error ? error.message : String(error));
    }
  });
}

async function waitForJson(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
    } catch (error) {
      lastError = error;
    }
    await sleep(120);
  }
  throw lastError instanceof Error ? lastError : new Error(`Timed out waiting for ${url}`);
}

async function run() {
  const server = staticServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const sitePort = typeof address === "object" && address ? address.port : 0;
  const debugPort = await freePort();
  const chrome = spawn(findChrome(), [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=/tmp/asympta-coordination-smoke-${process.pid}`,
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });

  let chromeStderr = "";
  chrome.stderr.on("data", (chunk) => {
    chromeStderr += String(chunk);
  });

  try {
    const targets = await waitForJson(`http://127.0.0.1:${debugPort}/json/list`);
    const target = targets.find((item) => item.type === "page") ?? targets[0];
    if (!target?.webSocketDebuggerUrl) throw new Error("Chrome did not expose a page debugging target.");

    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });

    let id = 0;
    const pending = new Map();
    const events = new Map();
    const exceptions = [];

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id && pending.has(message.id)) {
        const { resolve, reject } = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
        return;
      }
      if (message.method === "Runtime.exceptionThrown") {
        const details = message.params?.exceptionDetails;
        exceptions.push(details?.exception?.description ?? details?.text ?? "Unknown browser exception");
      }
      const listeners = events.get(message.method);
      if (listeners) {
        events.delete(message.method);
        listeners.forEach((resolve) => resolve(message.params));
      }
    });

    const command = (method, params = {}) => new Promise((resolve, reject) => {
      const commandId = ++id;
      pending.set(commandId, { resolve, reject });
      socket.send(JSON.stringify({ id: commandId, method, params }));
    });

    const once = (method) => new Promise((resolve) => {
      const listeners = events.get(method) ?? [];
      listeners.push(resolve);
      events.set(method, listeners);
    });

    // Deliberately never await a Promise created inside the page. React settling is
    // observed from Node by deterministic polling, avoiding CDP "Promise was collected".
    const evaluate = async (expression) => {
      const result = await command("Runtime.evaluate", {
        expression,
        returnByValue: true,
      });
      if (result?.exceptionDetails) {
        throw new Error(
          result.exceptionDetails.exception?.description
          ?? result.exceptionDetails.text
          ?? "Browser evaluation failed.",
        );
      }
      return result?.result?.value;
    };

    const waitFor = async (expression, timeoutMs = 15_000, label = expression) => {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (await evaluate(`Boolean(${expression})`)) return;
        await sleep(100);
      }
      console.error("Browser checkpoint diagnostic:", await evaluate(`JSON.stringify({ lang: document.documentElement.lang, side: document.querySelector('.simulation-studio')?.dataset.side, receipts: [...document.querySelectorAll('[data-coordination-kernel]')].map(node => node.textContent), languageMenu: document.querySelector('.atlas-language-menu')?.textContent, phase: window.__ASYMPTA_DEMO__?.snapshot().foreground.phase })`));
      throw new Error(`Timed out waiting for ${label}.`);
    };

    await command("Runtime.enable");
    await command("Page.enable");
    const loaded = once("Page.loadEventFired");
    await command("Page.navigate", { url: `http://127.0.0.1:${sitePort}${basePath}/` });
    await Promise.race([
      loaded,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timed out waiting for page load.")), 12_000)),
    ]);

    await waitFor("document.readyState === 'complete' && Boolean(window.__ASYMPTA_DEMO__) && Boolean(document.querySelector('.simulation-studio textarea'))", 15000, "simulation editor hydration");
    const setSide = async side => {
      await evaluate(`document.querySelectorAll('[data-asympta-mode-switch] button')[${side === "business" ? 1 : 0}].click()`);
      await waitFor(`document.querySelector('.simulation-studio')?.dataset.side === '${side}'`, 5000, side);
    };
    const submit = async text => {
      await evaluate(`(() => {
        const input = document.querySelector('.simulation-studio textarea');
        if (!input) throw new Error('Missing simulation textarea');
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, ${JSON.stringify(text)});
        input.dispatchEvent(new Event('input', { bubbles: true }));
      })()`);
      await sleep(100);
      await evaluate("document.querySelector('.simulation-studio form').requestSubmit()");
      await waitFor("Boolean(document.querySelector('.simulation-studio__start:not(:disabled)'))", 5000, "compiled contract");
      await evaluate("document.querySelector('.simulation-studio__start').click()");
      await waitFor("Boolean(window.__ASYMPTA_DEMO__.snapshot().foreground.coordination)", 5000, "kernel activation");
    };
    const advanceToPause = async () => {
      for (let batch = 0; batch < 100; batch++) {
        const phase = await evaluate(`(() => {
          const demo = window.__ASYMPTA_DEMO__;
          for (let step = 0; step < 20; step++) {
            if (demo.snapshot().foreground.phase !== 'running') break;
            demo.advance(140);
          }
          window.dispatchEvent(new Event('asympta:world-tick'));
          return demo.snapshot().foreground.phase;
        })()`);
        if (phase !== "running") return phase;
        await sleep(20);
      }
      throw new Error("Kernel did not reach a bounded checkpoint");
    };
    for (const side of ["users", "business"]) {
      await setSide(side);
      await submit("Restock notebooks\nQuantity: 50\nStock: 20\nLocation: PRIVATE_BROWSER_739");
      if (await advanceToPause() !== "waiting_approval") throw new Error(`${side}: explicit approval was not reached`);
      const before = JSON.parse(await evaluate("JSON.stringify(window.__ASYMPTA_DEMO__.snapshot().foreground)"));
      if (before.coordination.side !== side || before.tasks.find(task => task.id.endsWith(":execute")).status !== "queued" || JSON.stringify(before).includes("PRIVATE_BROWSER_739")) throw new Error(`${side}: invalid authority or privacy projection`);
      await waitFor("Boolean(document.querySelector('[data-coordination-kernel]'))", 5000, "visible receipt progress");
      for (const [lang, copy, label, option] of [["zh-Hant", "已驗證的行動回執", "Language", "繁體中文"], ["ja", "検証済みの行動記録", "語言", "日本語"], ["en", "Verified action receipts", "言語", "English"]]) {
        await evaluate(`document.querySelector('button[aria-label="${label}"]').click()`);
        await waitFor("Boolean(document.querySelector('.atlas-language-menu.is-open'))", 5000, "open global language menu");
        await evaluate(`[...document.querySelectorAll('.atlas-language-menu button')].find(button => button.textContent.trim() === ${JSON.stringify(option)}).click()`);
        await waitFor(`document.documentElement.lang === '${lang}' && document.querySelector('[data-coordination-kernel]')?.textContent.includes(${JSON.stringify(copy)})`, 5000, `live ${lang} kernel copy`);
      }
      await waitFor("Boolean(document.querySelector('.simulation-studio__approval button.simulation-studio__primary'))", 5000, "approval button");
      await evaluate("document.querySelector('.simulation-studio__approval button.simulation-studio__primary').click()");
      await waitFor("window.__ASYMPTA_DEMO__.snapshot().foreground.phase === 'running'", 5000, "approval resumes contract");
      if (await advanceToPause() !== "completed") throw new Error(`${side}: contract did not complete`);
      const after = JSON.parse(await evaluate("JSON.stringify(window.__ASYMPTA_DEMO__.snapshot().foreground.coordination)"));
      if (after.status !== "verified_simulation" || after.evidenceCount !== 9 || after.verifiedActions !== 9) throw new Error(`${side}: missing checked receipts ${JSON.stringify(after)}`);
      await waitFor("document.querySelector('.simulation-studio__journey')?.textContent.includes('executable simulation contract')", 5000, "honest completion description");
      await evaluate("document.querySelector('.simulation-studio__journey > button').click()");
      await waitFor("Boolean(document.querySelector('.simulation-studio textarea'))", 5000, "new scenario");
    }
    await submit("Book appointments\nQuantity: 5\nCapacity: 0");
    if (await advanceToPause() !== "blocked") throw new Error("Zero-capacity booking incorrectly completed");
    await waitFor("document.querySelector('[data-coordination-kernel]')?.textContent.includes('numeric resource condition')", 5000, "localized resource blocker");
    const blocker = await evaluate("window.__ASYMPTA_DEMO__.snapshot().foreground.coordination.blocker");
    if (blocker !== "precondition_failed") throw new Error(`Wrong blocker: ${blocker}`);
    if (exceptions.length) throw new Error(`Kernel browser exceptions: ${exceptions.join(" | ")}`);
    console.log("Coordination browser smoke passed: both sides, real UI approval, 9 checked receipts, private snapshot, live en/zh-Hant/ja switching and zero-capacity rejection.");
    socket.close();
  } catch (error) {
    if (chromeStderr.trim()) console.error(chromeStderr.trim());
    throw error;
  } finally {
    chrome.kill("SIGTERM");
    server.close();
  }
}

await run();
