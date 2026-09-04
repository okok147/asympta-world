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
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".woff2": "font/woff2",
};

function findChrome() {
  for (const candidate of [process.env.CHROME_BIN, "google-chrome", "google-chrome-stable", "chromium", "chromium-browser"].filter(Boolean)) {
    if (candidate.includes("/")) return candidate;
    const result = spawnSync("which", [candidate], { encoding: "utf8" });
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  }
  throw new Error("Buy-car browser smoke requires Chrome/Chromium on the CI runner.");
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
    `--user-data-dir=/tmp/asympta-buy-car-smoke-${process.pid}`,
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
    await waitFor("document.readyState === 'complete' && Boolean(window.__ASYMPTA_DEMO__) && Boolean(window.__ASYMPTA_MARKETPLACE__) && Boolean(document.querySelector('form.asympta-intent-composer'))", 15_000, "Asympta app bridges");

    await evaluate(`(() => {
      window.__ASYMPTA_CAR_COMPLETIONS__ = [];
      window.addEventListener('asympta:completion-receipt', (event) => {
        const execution = window.__ASYMPTA_MARKETPLACE__?.snapshot?.() ?? null;
        window.__ASYMPTA_CAR_COMPLETIONS__.push(JSON.parse(JSON.stringify({ receipt: event.detail ?? null, execution })));
      });
      return true;
    })()`);

    await evaluate(`(async () => {
      const form = document.querySelector('form.asympta-intent-composer');
      const textarea = form?.querySelector('textarea');
      if (!form || !textarea) throw new Error('Intent composer is unavailable.');
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      if (setter) setter.call(textarea, 'Buy a car'); else textarea.value = 'Buy a car';
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 50));
      form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
      return true;
    })()`, true);

    await waitFor("Boolean(document.querySelector('.asympta-marketplace-selection-gate'))", 10_000, "vehicle concrete-selection gate");
    const preSelection = JSON.parse(await evaluate(`JSON.stringify((() => {
      const gate = document.querySelector('.asympta-marketplace-selection-gate');
      const options = [...(gate?.querySelectorAll('[role="radio"]') ?? [])].map((button) => button.textContent?.replace(/\\s+/g, ' ').trim() ?? '');
      const confirm = gate?.querySelector('.asympta-marketplace-selection-gate__confirm');
      return {
        executionStarted: Boolean(window.__ASYMPTA_MARKETPLACE__?.snapshot?.()?.executionId),
        selectionState: document.documentElement.dataset.asymptaMarketplaceSelection ?? null,
        options,
        confirmDisabled: Boolean(confirm?.disabled),
        profileQuestionShown: Boolean(document.querySelector('.asympta-marketplace-progressive-question')) || Boolean(document.documentElement.dataset.asymptaMarketplaceNextField),
      };
    })())`));
    if (preSelection.executionStarted) throw new Error("Buy a car started agents before the user selected a concrete vehicle.");
    if (preSelection.selectionState !== "required") throw new Error(`Vehicle selection gate did not expose required state: ${preSelection.selectionState}`);
    if (preSelection.profileQuestionShown) throw new Error("Buy a car incorrectly opened the generic marketplace profile question before selection.");
    if (preSelection.options.length < 3 || !preSelection.options.some((label) => /Tesla Model 3/i.test(label))) {
      throw new Error(`Vehicle selection gate did not provide the expected concrete options: ${JSON.stringify(preSelection.options)}`);
    }
    if (!preSelection.confirmDisabled) throw new Error("Vehicle confirmation was enabled before an option was selected.");

    await evaluate(`(() => {
      const gate = document.querySelector('.asympta-marketplace-selection-gate');
      const option = [...(gate?.querySelectorAll('[role="radio"]') ?? [])]
        .find((button) => /Tesla Model 3/i.test(button.textContent ?? ''));
      if (!option) throw new Error('Tesla Model 3 selection option is unavailable.');
      option.click();
      return true;
    })()`);
    await waitFor("Boolean(document.querySelector('.asympta-marketplace-selection-gate [role=\"radio\"][aria-checked=\"true\"]'))", 4_000, "vehicle option selection state");
    await waitFor("document.querySelector('.asympta-marketplace-selection-gate__confirm')?.disabled === false", 4_000, "vehicle confirmation enablement");
    const executionAfterOptionClick = await evaluate("Boolean(window.__ASYMPTA_MARKETPLACE__?.snapshot?.()?.executionId)");
    if (executionAfterOptionClick) throw new Error("Selecting a vehicle option started agents before the separate confirmation action.");

    await evaluate(`(() => {
      const confirm = document.querySelector('.asympta-marketplace-selection-gate__confirm');
      if (!confirm || confirm.disabled) throw new Error('Vehicle selection confirmation button is unavailable.');
      confirm.click();
      return true;
    })()`);

    await waitFor("Boolean(window.__ASYMPTA_MARKETPLACE__?.snapshot?.()?.executionId)", 15_000, "vehicle marketplace execution after confirmation");
    await waitFor("!Boolean(document.querySelector('.asympta-marketplace-selection-gate'))", 8_000, "selection gate dismissal after execution starts");
    const profileQuestionShown = await evaluate("Boolean(document.querySelector('.asympta-marketplace-progressive-question')) || Boolean(document.documentElement.dataset.asymptaMarketplaceNextField)");
    if (profileQuestionShown) throw new Error("Buy a car incorrectly opened the generic marketplace profile question after confirmation.");
    const initial = JSON.parse(await evaluate("JSON.stringify(window.__ASYMPTA_MARKETPLACE__?.snapshot?.() ?? null)"));
    const goal = initial?.envelope?.goals?.[0];
    const facts = new Map((goal?.facts ?? []).map((fact) => [fact.key, fact]));
    if (facts.get("product_class")?.value !== "vehicle") throw new Error("Buy a car did not compile as a vehicle.");
    if (facts.get("handling_class")?.value !== "vehicle_transport") throw new Error("Vehicle transport handling was not preserved.");
    if (facts.get("selected_offer_id")?.value !== "vehicle:tesla-model-3") throw new Error(`Confirmed vehicle selection was not bound: ${facts.get("selected_offer_id")?.value ?? "missing"}`);
    if (facts.get("requested_item")?.value !== "Tesla Model 3") throw new Error(`Confirmed concrete vehicle was not preserved: ${facts.get("requested_item")?.value ?? "missing"}`);
    if (facts.get("offer_provenance")?.value !== "simulated") throw new Error("Vehicle offer provenance was not marked simulated.");

    await evaluate(`(async () => {
      const demo = window.__ASYMPTA_DEMO__;
      for (let index = 0; index < 9000; index += 1) {
        const value = demo.snapshot?.(); const snapshot = value?.foreground ?? value;
        if (snapshot?.phase === 'blocked') throw new Error('Buy a car blocked before the human approval checkpoint.');
        if ((snapshot?.pendingApprovals ?? []).some((approval) => approval.actionType === 'authorize_payment')) return true;
        demo.advance(140);
        if (index % 20 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
      }
      throw new Error('Buy a car never reached the simulated purchase approval checkpoint.');
    })()`, true);

    await waitFor("Boolean(document.querySelector('.asympta-marketplace-payment-approval__actions button'))", 8_000, "vehicle purchase approval card");
    await evaluate(`(() => {
      const confirm = document.querySelector('.asympta-marketplace-payment-approval__actions button');
      if (!confirm) throw new Error('Vehicle purchase approval button is unavailable.');
      confirm.click(); return true;
    })()`);

    await evaluate(`(async () => {
      const demo = window.__ASYMPTA_DEMO__;
      for (let index = 0; index < 9000; index += 1) {
        const value = demo.snapshot?.(); const snapshot = value?.foreground ?? value;
        if (snapshot?.phase === 'completed') return true;
        if (snapshot?.phase === 'blocked') throw new Error('Buy a car blocked after approval.');
        const pending = snapshot?.pendingApprovals ?? [];
        if (pending.length) throw new Error('An unexpected second approval stopped Buy a car.');
        demo.advance(140);
        if (index % 20 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
      }
      throw new Error('Buy a car never reached workflow completion.');
    })()`, true);
    await waitFor("(window.__ASYMPTA_CAR_COMPLETIONS__?.length ?? 0) >= 1", 8_000, "vehicle completion receipt");

    const proof = JSON.parse(await evaluate(`JSON.stringify((() => {
      const completed = window.__ASYMPTA_CAR_COMPLETIONS__?.[0] ?? null;
      const execution = completed?.execution ?? null;
      return {
        receipt: completed?.receipt ?? null,
        executionStatus: execution?.status ?? null,
        packetKinds: execution?.packets?.map((packet) => packet.kind) ?? [],
        transactionStates: execution?.transactions?.map((transaction) => ({ status: transaction.status, payment: transaction.payment })) ?? [],
        inventory: execution?.ledger?.map((line) => ({ userInventory: line.userInventory, quantity: line.quantity, reserved: line.marketReserved, cargo: line.carrierCargo })) ?? [],
        profileQuestionShown: Boolean(document.querySelector('.asympta-marketplace-progressive-question')),
        selectionGateShown: Boolean(document.querySelector('.asympta-marketplace-selection-gate')),
      };
    })())`));
    if (proof.receipt?.verification !== "verified" || proof.receipt?.provenance !== "marketplace_execution") {
      throw new Error(`Vehicle workflow completion receipt is not canonical marketplace verification: ${JSON.stringify(proof.receipt)}`);
    }
    if (proof.executionStatus !== "completed") throw new Error(`Vehicle execution did not complete: ${proof.executionStatus}`);
    if (!proof.transactionStates.length || proof.transactionStates.some((transaction) => transaction.status !== "completed" || transaction.payment !== "authorized")) {
      throw new Error(`Vehicle transaction proof is incomplete: ${JSON.stringify(proof.transactionStates)}`);
    }
    if (!proof.inventory.length || proof.inventory.some((line) => line.userInventory < line.quantity || line.reserved !== 0 || line.cargo !== 0)) {
      throw new Error(`Vehicle inventory proof is incomplete: ${JSON.stringify(proof.inventory)}`);
    }
    if (!proof.packetKinds.includes("goods_handoff") || !proof.packetKinds.includes("delivery_receipt") || !proof.packetKinds.includes("verification")) {
      throw new Error(`Vehicle workflow lacks handoff/delivery/verification evidence: ${proof.packetKinds.join(", ")}`);
    }
    if (proof.profileQuestionShown) throw new Error("Generic marketplace profile question appeared during vehicle workflow.");
    if (proof.selectionGateShown) throw new Error("Vehicle selection gate remained visible after confirmed execution.");
    if (exceptions.length) throw new Error(`Browser exceptions during Buy a car: ${exceptions.join(" | ")}`);

    console.log("Buy-car browser smoke passed: selection blocked pre-confirm execution, confirmation started agents, payment stayed separately approval-gated, and receipt-backed delivery completed.");
    socket.close();
  } catch (error) {
    if (chromeStderr.trim()) console.error(chromeStderr.trim());
    throw error;
  } finally {
    chrome.kill("SIGTERM"); server.close();
  }
}

await run();
