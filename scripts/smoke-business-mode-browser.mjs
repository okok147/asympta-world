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
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
};

function findChrome() {
  for (const candidate of [process.env.CHROME_BIN, "google-chrome", "google-chrome-stable", "chromium", "chromium-browser"].filter(Boolean)) {
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
        response.writeHead(403).end("Forbidden"); return;
      }
      let file = candidate;
      try { if ((await stat(file)).isDirectory()) file = path.join(file, "index.html"); }
      catch { file = path.join(outputDir, "404.html"); }
      const body = await readFile(file);
      response.writeHead(200, { "content-type": MIME[path.extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
      response.end(body);
    } catch (error) {
      response.writeHead(500, { "content-type": "text/plain" });
      response.end(error instanceof Error ? error.message : String(error));
    }
  });
}

async function waitForJson(url, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try { const response = await fetch(url); if (response.ok) return await response.json(); }
    catch (error) { lastError = error; }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw lastError instanceof Error ? lastError : new Error(`Timed out waiting for ${url}`);
}

async function run() {
  const server = staticServer();
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  const sitePort = typeof address === "object" && address ? address.port : 0;
  const debugPort = await freePort();
  const chrome = spawn(findChrome(), [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=/tmp/asympta-business-mode-smoke-${process.pid}`,
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  let chromeStderr = "";
  chrome.stderr.on("data", (chunk) => { chromeStderr += String(chunk); });

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
        const { resolve, reject } = pending.get(message.id); pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message)); else resolve(message.result); return;
      }
      if (message.method === "Runtime.exceptionThrown") {
        const details = message.params?.exceptionDetails;
        exceptions.push(details?.exception?.description ?? details?.text ?? "Unknown browser exception");
      }
      const listeners = events.get(message.method);
      if (listeners) { events.delete(message.method); listeners.forEach((resolve) => resolve(message.params)); }
    });
    const command = (method, params = {}) => new Promise((resolve, reject) => {
      const commandId = ++id; pending.set(commandId, { resolve, reject });
      socket.send(JSON.stringify({ id: commandId, method, params }));
    });
    const once = (method) => new Promise((resolve) => {
      const listeners = events.get(method) ?? []; listeners.push(resolve); events.set(method, listeners);
    });
    const evaluate = async (expression, awaitPromise = false) => {
      const result = await command("Runtime.evaluate", { expression, awaitPromise, returnByValue: true });
      if (result?.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? "Browser evaluation failed.");
      return result?.result?.value;
    };
    const waitFor = async (expression, timeoutMs = 15_000, label = expression) => {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (await evaluate(`Boolean(${expression})`)) return;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error(`Timed out waiting for ${label}.`);
    };

    await command("Runtime.enable"); await command("Page.enable");
    const loaded = once("Page.loadEventFired");
    await command("Page.navigate", { url: `http://127.0.0.1:${sitePort}${basePath}/` });
    await Promise.race([loaded, new Promise((_, reject) => setTimeout(() => reject(new Error("Timed out waiting for page load.")), 12_000))]);
    await waitFor("document.readyState === 'complete' && Boolean(document.querySelector('nav[aria-label=\"Asympta World mode\"]')) && Boolean(document.querySelector('form.asympta-intent-composer'))", 15_000, "Users world and mode switch");

    const initial = JSON.parse(await evaluate(`JSON.stringify((() => {
      const nav = document.querySelector('nav[aria-label="Asympta World mode"]');
      const buttons = [...(nav?.querySelectorAll('button') ?? [])];
      return {
        usersPressed: buttons.find((button) => button.textContent?.trim() === 'Users')?.getAttribute('aria-pressed') ?? null,
        businessPressed: buttons.find((button) => button.textContent?.trim() === 'Business')?.getAttribute('aria-pressed') ?? null,
        businessWorld: Boolean(document.querySelector('[data-asympta-business-world="true"]')),
        userComposer: Boolean(document.querySelector('form.asympta-intent-composer')),
      };
    })())`));
    if (initial.usersPressed !== "true" || initial.businessPressed !== "false" || initial.businessWorld || !initial.userComposer) {
      throw new Error(`Business mode did not preserve Users as the initial view: ${JSON.stringify(initial)}`);
    }

    await evaluate(`(() => {
      const nav = document.querySelector('nav[aria-label="Asympta World mode"]');
      const button = [...(nav?.querySelectorAll('button') ?? [])].find((item) => item.textContent?.trim() === 'Business');
      if (!button) throw new Error('Business mode button is unavailable.');
      button.click();
      return true;
    })()`);
    await waitFor("Boolean(document.querySelector('[data-asympta-business-world=\"true\"]'))", 8_000, "Business workspace");

    const structure = JSON.parse(await evaluate(`JSON.stringify((() => {
      const world = document.querySelector('[data-asympta-business-world="true"]');
      const text = world?.textContent ?? '';
      return {
        hasBusinessInfo: text.includes('Business information'),
        hasProducts: text.includes('Products'),
        hasCommunication: text.includes('Business Agent ↔ Customer Agent'),
        importButtons: [...(world?.querySelectorAll('button') ?? [])].filter((button) => button.textContent?.includes('Import JSON / CSV')).length,
        theme: document.documentElement.dataset.asymptaAudience ?? null,
      };
    })())`));
    if (!structure.hasBusinessInfo || !structure.hasProducts || !structure.hasCommunication || structure.importButtons !== 2 || structure.theme !== "business") {
      throw new Error(`Business workspace structure is incomplete: ${JSON.stringify(structure)}`);
    }

    await evaluate(`(async () => {
      const world = document.querySelector('[data-asympta-business-world="true"]');
      const files = [...world.querySelectorAll('input[type="file"]')];
      if (files.length !== 2) throw new Error('Business import inputs are unavailable.');

      const businessTransfer = new DataTransfer();
      businessTransfer.items.add(new File([JSON.stringify({
        name: 'Harbour Bakery', category: 'Bakery', location: '12 Harbour Road', hours: 'Mon-Fri 08:00-18:00'
      })], 'business.json', { type: 'application/json' }));
      files[0].files = businessTransfer.files;
      files[0].dispatchEvent(new Event('change', { bubbles: true }));

      const productTransfer = new DataTransfer();
      productTransfer.items.add(new File([JSON.stringify([
        { id: 'bread-1', name: 'Sourdough loaf', description: 'Naturally fermented.', price: 48, currency: 'HKD', availability: 'available' }
      ])], 'products.json', { type: 'application/json' }));
      files[1].files = productTransfer.files;
      files[1].dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 120));
      return true;
    })()`, true);

    await waitFor("document.querySelector('[data-asympta-business-world=\"true\"]')?.textContent?.includes('Harbour Bakery') && document.querySelector('[data-asympta-business-world=\"true\"]')?.textContent?.includes('Sourdough loaf')", 8_000, "imported business and product data");

    await evaluate(`(async () => {
      const world = document.querySelector('[data-asympta-business-world="true"]');
      const composer = [...world.querySelectorAll('textarea')].find((textarea) => textarea.placeholder?.startsWith('Customer agent:'));
      const send = [...world.querySelectorAll('button')].find((button) => button.textContent?.includes('Run communication'));
      if (!composer || !send) throw new Error('Business agent composer is unavailable.');
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      if (setter) setter.call(composer, 'Do you have the sourdough loaf?'); else composer.value = 'Do you have the sourdough loaf?';
      composer.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 40));
      send.click();
      return true;
    })()`, true);

    await waitFor("document.querySelector('[data-asympta-business-world=\"true\"]')?.textContent?.includes('HKD 48') && document.querySelector('[data-asympta-business-world=\"true\"]')?.textContent?.includes('is available')", 8_000, "truth-constrained business agent answer");

    await evaluate(`(() => {
      const nav = document.querySelector('nav[aria-label="Asympta World mode"]');
      const button = [...(nav?.querySelectorAll('button') ?? [])].find((item) => item.textContent?.trim() === 'Users');
      if (!button) throw new Error('Users mode button is unavailable.');
      button.click();
      return true;
    })()`);
    await waitFor("!document.querySelector('[data-asympta-business-world=\"true\"]') && Boolean(document.querySelector('form.asympta-intent-composer'))", 8_000, "return to Users world");

    const finalState = JSON.parse(await evaluate(`JSON.stringify({
      mode: document.documentElement.dataset.asymptaAudience ?? null,
      userComposer: Boolean(document.querySelector('form.asympta-intent-composer')),
      profileStored: JSON.parse(localStorage.getItem('asympta:business-profile:v1') ?? 'null')?.name ?? null,
      productsStored: JSON.parse(localStorage.getItem('asympta:business-products:v1') ?? '[]').length,
    })`));
    if (finalState.mode !== "users" || !finalState.userComposer || finalState.profileStored !== "Harbour Bakery" || finalState.productsStored !== 1) {
      throw new Error(`Business/User mode persistence proof is incomplete: ${JSON.stringify(finalState)}`);
    }
    if (exceptions.length) throw new Error(`Browser exceptions during Business mode: ${exceptions.join(" | ")}`);

    console.log("Business-mode browser smoke passed: Users stays default, Business imports real facts, agent communication is evidence-backed, and switching back preserves the existing world.");
    socket.close();
  } catch (error) {
    if (chromeStderr.trim()) console.error(chromeStderr.trim());
    throw error;
  } finally {
    chrome.kill("SIGTERM"); server.close();
  }
}

await run();
