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
  ".woff2": "font/woff2",
};

function findChrome() {
  const candidates = [process.env.CHROME_BIN, "google-chrome", "google-chrome-stable", "chromium", "chromium-browser"].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate.includes("/")) return candidate;
    const result = spawnSync("which", [candidate], { encoding: "utf8" });
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  }
  throw new Error("Buy-food browser smoke requires Chrome/Chromium on the CI runner.");
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
        response.writeHead(403).end("Forbidden");
        return;
      }
      let file = candidate;
      try {
        const info = await stat(file);
        if (info.isDirectory()) file = path.join(file, "index.html");
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

async function waitForJson(url, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
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
  const chromeBin = findChrome();
  const chrome = spawn(chromeBin, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=/tmp/asympta-buy-food-smoke-${process.pid}`,
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
    const consoleErrors = [];

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
      if (message.method === "Runtime.consoleAPICalled" && message.params?.type === "error") {
        consoleErrors.push((message.params.args ?? []).map((arg) => arg.value ?? arg.description ?? "").join(" "));
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
    const evaluate = async (expression, awaitPromise = false) => {
      const result = await command("Runtime.evaluate", {
        expression,
        awaitPromise,
        returnByValue: true,
      });
      if (result?.exceptionDetails) {
        throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? "Browser evaluation failed.");
      }
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

    await command("Runtime.enable");
    await command("Page.enable");
    const loaded = once("Page.loadEventFired");
    await command("Page.navigate", { url: `http://127.0.0.1:${sitePort}${basePath}/` });
    await Promise.race([
      loaded,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timed out waiting for page load.")), 12_000)),
    ]);
    await waitFor("document.readyState === 'complete' && Boolean(window.__ASYMPTA_DEMO__) && Boolean(document.querySelector('form.asympta-intent-composer'))", 15_000, "Asympta app bridges");

    // Capture proof synchronously at the canonical completion receipt. The app
    // intentionally remounts its live workflow runtime in the next microtask,
    // so evidence belongs to the receipt while the visible runtime becomes idle.
    await evaluate(`(() => {
      window.__ASYMPTA_SMOKE_COMPLETIONS__ = [];
      window.__ASYMPTA_SMOKE_RESETS__ = [];
      window.addEventListener('asympta:completion-receipt', (event) => {
        const worldValue = window.__ASYMPTA_DEMO__?.snapshot?.();
        const world = worldValue?.foreground ?? worldValue ?? null;
        const execution = window.__ASYMPTA_MARKETPLACE__?.snapshot?.() ?? null;
        window.__ASYMPTA_SMOKE_COMPLETIONS__.push(JSON.parse(JSON.stringify({
          receipt: event.detail ?? null,
          world,
          execution,
          requestCardVisible: Boolean(document.querySelector('.asympta-request-card')),
          bodyText: document.body?.innerText ?? ''
        })));
      });
      window.addEventListener('asympta:workflow-runtime-reset', (event) => {
        window.__ASYMPTA_SMOKE_RESETS__.push(JSON.parse(JSON.stringify(event.detail ?? null)));
      });
      return true;
    })()`);

    await evaluate(`(async () => {
      const form = document.querySelector('form.asympta-intent-composer');
      const textarea = form?.querySelector('textarea');
      if (!form || !textarea) throw new Error('Intent composer is unavailable.');
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      if (setter) setter.call(textarea, 'Buy some food');
      else textarea.value = 'Buy some food';
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 50));
      form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
      return true;
    })()`, true);

    await waitFor(
      "Boolean(document.querySelector('.asympta-marketplace-profile__presets button')) || Boolean(window.__ASYMPTA_MARKETPLACE__?.snapshot?.())",
      15_000,
      "marketplace profile or execution",
    );

    const hasExecution = await evaluate("Boolean(window.__ASYMPTA_MARKETPLACE__?.snapshot?.())");
    if (!hasExecution) {
      await evaluate(`(() => {
        const buttons = [...document.querySelectorAll('.asympta-marketplace-profile__presets button')];
        const localDelivery = buttons[1] ?? buttons[0];
        if (!localDelivery) throw new Error('Marketplace preset choices are unavailable.');
        localDelivery.click();
        return localDelivery.textContent;
      })()`);
    }

    await waitFor("Boolean(window.__ASYMPTA_MARKETPLACE__?.snapshot?.()?.executionId)", 15_000, "marketplace execution start");

    await evaluate(`(async () => {
      const demo = window.__ASYMPTA_DEMO__;
      if (!demo) throw new Error('Demo bridge unavailable.');
      for (let index = 0; index < 8000; index += 1) {
        const value = demo.snapshot?.();
        const snapshot = value?.foreground ?? value;
        if (snapshot?.phase === 'blocked') throw new Error('Buy some food entered a blocked state before approval.');
        if ((snapshot?.pendingApprovals ?? []).some((approval) => approval.actionType === 'authorize_payment')) return true;
        demo.advance(140);
        if (index % 20 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
      }
      throw new Error('Buy some food never reached payment confirmation.');
    })()`, true);

    await waitFor("Boolean(document.querySelector('.asympta-marketplace-payment-approval__actions button'))", 8_000, "payment confirmation card");
    await evaluate(`(() => {
      const confirm = document.querySelector('.asympta-marketplace-payment-approval__actions button');
      if (!confirm) throw new Error('Payment confirmation button is unavailable.');
      confirm.click();
      return true;
    })()`);

    await evaluate(`(async () => {
      const demo = window.__ASYMPTA_DEMO__;
      if (!demo) throw new Error('Demo bridge unavailable after approval.');
      for (let index = 0; index < 8000; index += 1) {
        const value = demo.snapshot?.();
        const snapshot = value?.foreground ?? value;
        if (snapshot?.phase === 'completed') return true;
        if (snapshot?.phase === 'blocked') throw new Error('Buy some food blocked after payment was confirmed.');
        const pending = snapshot?.pendingApprovals ?? [];
        if (pending.length) throw new Error('An unexpected second approval stopped Buy some food.');
        demo.advance(140);
        if (index % 20 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
      }
      throw new Error('Buy some food never reached workflow completion.');
    })()`, true);

    await waitFor("(window.__ASYMPTA_SMOKE_COMPLETIONS__?.length ?? 0) >= 1", 8_000, "food completion receipt capture");
    await waitFor("(window.__ASYMPTA_SMOKE_RESETS__?.length ?? 0) >= 1", 8_000, "food runtime reset");
    await waitFor("Boolean(document.querySelector('.asympta-screen-celebration__content'))", 8_000, "full-screen completion celebration");
    await waitFor(`(() => {
      const value = window.__ASYMPTA_DEMO__?.snapshot?.();
      const world = value?.foreground ?? value;
      return world?.phase === 'idle'
        && (world?.tasks?.length ?? 0) === 0
        && (world?.pendingApprovals?.length ?? 0) === 0;
    })()`, 8_000, "clean idle world after food completion");
    await waitFor(`(() => {
      const overlay = document.querySelector('.asympta-screen-celebration');
      const content = document.querySelector('.asympta-screen-celebration__content');
      if (!overlay || !content || content.getBoundingClientRect().width <= 0) return false;
      const overlayStyle = getComputedStyle(overlay);
      const contentStyle = getComputedStyle(content);
      return overlayStyle.display !== 'none'
        && overlayStyle.visibility !== 'hidden'
        && contentStyle.display !== 'none'
        && contentStyle.visibility !== 'hidden'
        && Number(overlayStyle.opacity || 1) > .2
        && Number(contentStyle.opacity || 1) > .2;
    })()`, 4_000, "visible completion celebration entrance");

    const foodState = JSON.parse(await evaluate(`JSON.stringify((() => {
      const completed = window.__ASYMPTA_SMOKE_COMPLETIONS__?.[0] ?? null;
      const reset = window.__ASYMPTA_SMOKE_RESETS__?.[0] ?? null;
      const worldValue = window.__ASYMPTA_DEMO__?.snapshot?.();
      const liveWorld = worldValue?.foreground ?? worldValue ?? null;
      const liveExecution = window.__ASYMPTA_MARKETPLACE__?.snapshot?.() ?? null;
      const execution = completed?.execution ?? null;
      const world = completed?.world ?? null;
      const celebration = document.querySelector('.asympta-screen-celebration');
      const content = document.querySelector('.asympta-screen-celebration__content');
      const style = content ? getComputedStyle(content) : null;
      const overlayStyle = celebration ? getComputedStyle(celebration) : null;
      return {
        receiptId: completed?.receipt?.id ?? null,
        receiptRequestId: completed?.receipt?.requestId ?? null,
        resetCompletionId: reset?.completionId ?? null,
        completedWorldPhase: world?.phase ?? null,
        completedWorkflowId: world?.workflowId ?? null,
        completedUnfinishedTasks: (world?.tasks ?? []).filter((task) => task.status !== 'done').map((task) => [task.id, task.status]),
        completedPendingApprovals: world?.pendingApprovals ?? [],
        executionStatus: execution?.status ?? null,
        requestId: execution?.envelope?.requestId ?? null,
        requestText: execution?.envelope?.rawMessage?.text ?? null,
        userInventory: (execution?.ledger ?? []).reduce((sum, line) => sum + Number(line.userInventory ?? 0), 0),
        reserved: (execution?.ledger ?? []).reduce((sum, line) => sum + Number(line.marketReserved ?? 0), 0),
        cargo: (execution?.ledger ?? []).reduce((sum, line) => sum + Number(line.carrierCargo ?? 0), 0),
        transactionStatuses: (execution?.transactions ?? []).map((transaction) => [transaction.status, transaction.payment]),
        packetKinds: (execution?.packets ?? []).map((packet) => packet.kind),
        requestWasInspectableAtReceipt: completed?.requestCardVisible === true && String(completed?.bodyText ?? '').includes('Buy some food'),
        liveWorldPhase: liveWorld?.phase ?? null,
        liveTaskCount: liveWorld?.tasks?.length ?? null,
        livePendingApprovalCount: liveWorld?.pendingApprovals?.length ?? null,
        liveExecutionStatus: liveExecution?.status ?? null,
        celebrationId: celebration?.dataset?.completionId ?? null,
        celebrationVerification: celebration?.dataset?.verification ?? null,
        celebrationTitle: document.querySelector('.asympta-screen-celebration__title')?.textContent?.trim() ?? null,
        celebrationSummary: document.querySelector('.asympta-screen-celebration__summary')?.textContent?.trim() ?? null,
        celebrationVisible: Boolean(content && style && overlayStyle && style.display !== 'none' && style.visibility !== 'hidden' && overlayStyle.display !== 'none' && overlayStyle.visibility !== 'hidden' && Number(style.opacity || 1) > .2 && Number(overlayStyle.opacity || 1) > .2 && content.getBoundingClientRect().width > 0),
        liveRequestCardVisible: Boolean(document.querySelector('.asympta-request-card'))
      };
    })())`));

    if (foodState.completedWorldPhase !== "completed" || foodState.completedWorkflowId !== "marketplace-intent" || foodState.completedUnfinishedTasks.length || foodState.completedPendingApprovals.length) {
      throw new Error(`Buy-food completion receipt lacked settled world proof: ${JSON.stringify(foodState)}`);
    }
    if (foodState.executionStatus !== "completed" || foodState.userInventory < 1 || foodState.reserved !== 0 || foodState.cargo !== 0) {
      throw new Error(`Buy-food completion receipt lacked delivery proof: ${JSON.stringify(foodState)}`);
    }
    if (!foodState.transactionStatuses.every(([status, payment]) => status === "completed" && payment === "authorized")) {
      throw new Error(`Buy-food transaction is incomplete: ${JSON.stringify(foodState.transactionStatuses)}`);
    }
    for (const kind of ["approval_request", "payment_authorized", "goods_handoff", "delivery_receipt"]) {
      if (!foodState.packetKinds.includes(kind)) throw new Error(`Buy-food packet ${kind} is missing: ${JSON.stringify(foodState.packetKinds)}`);
    }
    if (!foodState.requestWasInspectableAtReceipt) {
      throw new Error(`Buy-food request was not inspectable at verified completion: ${JSON.stringify(foodState)}`);
    }
    if (foodState.liveWorldPhase !== "idle" || foodState.liveTaskCount !== 0 || foodState.livePendingApprovalCount !== 0 || foodState.liveExecutionStatus !== null || foodState.liveRequestCardVisible) {
      throw new Error(`Buy-food live workflow state did not reset cleanly: ${JSON.stringify(foodState)}`);
    }
    if (!foodState.receiptId || foodState.resetCompletionId !== foodState.receiptId || foodState.receiptRequestId !== foodState.requestId) {
      throw new Error(`Buy-food reset was not tied to the verified receipt: ${JSON.stringify(foodState)}`);
    }
    if (!foodState.celebrationVisible || foodState.celebrationVerification !== "verified" || foodState.celebrationId !== foodState.receiptId) {
      throw new Error(`Verified full-screen celebration did not survive runtime reset: ${JSON.stringify(foodState)}`);
    }
    if (!foodState.celebrationTitle || !foodState.celebrationSummary) {
      throw new Error(`Celebration content is incomplete: ${JSON.stringify(foodState)}`);
    }

    // Regression: a generic physical product must start from the clean post-food
    // runtime, clear the old celebration, collect missing preferences, and then
    // run a completely new merchant/supplier/delivery workflow.
    await evaluate(`(() => {
      localStorage.removeItem('asympta-world.user-preferences.v1');
      const form = document.querySelector('form.asympta-intent-composer');
      const textarea = form?.querySelector('textarea');
      if (!form || !textarea) throw new Error('Intent composer is unavailable for Buy a guitar.');
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      if (setter) setter.call(textarea, 'Buy a guitar');
      else textarea.value = 'Buy a guitar';
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
      return true;
    })()`);

    await waitFor(
      "document.documentElement.dataset.asymptaMarketplaceNextField === 'fulfilmentMethod'",
      12_000,
      "guitar fulfilment preference",
    );
    await evaluate(`(() => {
      const button = document.querySelector('.asympta-marketplace-profile fieldset:nth-of-type(2) button');
      if (!button) throw new Error('Guitar fulfilment choice is unavailable.');
      button.click();
      return true;
    })()`);

    await waitFor(
      "document.documentElement.dataset.asymptaMarketplaceNextField === 'paymentMethod'",
      12_000,
      "guitar payment preference",
    );
    await evaluate(`(() => {
      const button = document.querySelector('.asympta-marketplace-profile fieldset:nth-of-type(3) button');
      if (!button) throw new Error('Guitar payment choice is unavailable.');
      button.click();
      return true;
    })()`);

    await waitFor(
      "window.__ASYMPTA_MARKETPLACE__?.snapshot?.()?.envelope?.rawMessage?.text === 'Buy a guitar'",
      12_000,
      "guitar marketplace execution start",
    );
    await waitFor(
      "Boolean(document.querySelector('.asympta-request-card.is-expanded')) && !document.querySelector('.asympta-screen-celebration')",
      8_000,
      "guitar request card preserves expansion",
    );

    const guitarStart = JSON.parse(await evaluate(`JSON.stringify((() => {
      const worldValue = window.__ASYMPTA_DEMO__?.snapshot?.();
      const world = worldValue?.foreground ?? worldValue ?? null;
      const execution = window.__ASYMPTA_MARKETPLACE__?.snapshot?.() ?? null;
      return {
        worldPhase: world?.phase ?? null,
        workflowId: world?.workflowId ?? null,
        executionStatus: execution?.status ?? null,
        domain: execution?.envelope?.goals?.[0]?.domain ?? null,
        item: execution?.ledger?.[0]?.itemLabel ?? null,
        taskIds: (world?.tasks ?? []).map((task) => task.id),
        userInventory: execution?.ledger?.[0]?.userInventory ?? null,
        packetKinds: (execution?.packets ?? []).map((packet) => packet.kind)
      };
    })())`));
    if (guitarStart.workflowId !== "marketplace-intent" || guitarStart.executionStatus === "completed") {
      throw new Error(`Buy a guitar claimed completion before a workflow ran: ${JSON.stringify(guitarStart)}`);
    }
    if (guitarStart.domain !== "retail" || guitarStart.item !== "guitar" || guitarStart.userInventory !== 0) {
      throw new Error(`Buy a guitar was not compiled as pending retail delivery: ${JSON.stringify(guitarStart)}`);
    }
    for (const id of ["mp-1-retail-store", "mp-1-retail-stock", "mp-1-retail-offer", "mp-1-retail-handoff", "mp-1-retail-deliver", "mp-1-retail-verify"]) {
      if (!guitarStart.taskIds.includes(id)) throw new Error(`Buy a guitar workflow task ${id} is missing: ${JSON.stringify(guitarStart.taskIds)}`);
    }
    if (guitarStart.packetKinds.includes("delivery_receipt")) {
      throw new Error(`Buy a guitar had a delivery receipt before execution: ${JSON.stringify(guitarStart.packetKinds)}`);
    }

    await evaluate(`(async () => {
      const demo = window.__ASYMPTA_DEMO__;
      if (!demo) throw new Error('Demo bridge unavailable for Buy a guitar.');
      for (let index = 0; index < 8000; index += 1) {
        const value = demo.snapshot?.();
        const snapshot = value?.foreground ?? value;
        if (snapshot?.phase === 'blocked') throw new Error('Buy a guitar blocked before approval.');
        if ((snapshot?.pendingApprovals ?? []).some((approval) => approval.actionType === 'authorize_payment')) return true;
        demo.advance(140);
        if (index % 20 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
      }
      throw new Error('Buy a guitar never reached payment confirmation.');
    })()`, true);

    await waitFor("Boolean(document.querySelector('.asympta-marketplace-payment-approval__actions button'))", 8_000, "guitar payment confirmation card");
    await evaluate(`(() => {
      const confirm = document.querySelector('.asympta-marketplace-payment-approval__actions button');
      if (!confirm) throw new Error('Guitar payment confirmation button is unavailable.');
      confirm.click();
      return true;
    })()`);

    await evaluate(`(async () => {
      const demo = window.__ASYMPTA_DEMO__;
      if (!demo) throw new Error('Demo bridge unavailable after guitar approval.');
      for (let index = 0; index < 8000; index += 1) {
        const value = demo.snapshot?.();
        const snapshot = value?.foreground ?? value;
        if (snapshot?.phase === 'completed') return true;
        if (snapshot?.phase === 'blocked') throw new Error('Buy a guitar blocked after payment approval.');
        demo.advance(140);
        if (index % 20 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
      }
      throw new Error('Buy a guitar never reached workflow completion.');
    })()`, true);

    await waitFor("(window.__ASYMPTA_SMOKE_COMPLETIONS__?.length ?? 0) >= 2", 8_000, "guitar completion receipt capture");
    await waitFor("(window.__ASYMPTA_SMOKE_RESETS__?.length ?? 0) >= 2", 8_000, "guitar runtime reset");
    await waitFor(`(() => {
      const value = window.__ASYMPTA_DEMO__?.snapshot?.();
      const world = value?.foreground ?? value;
      return world?.phase === 'idle' && (world?.tasks?.length ?? 0) === 0;
    })()`, 8_000, "clean idle world after guitar completion");

    const guitarEnd = JSON.parse(await evaluate(`JSON.stringify((() => {
      const completed = window.__ASYMPTA_SMOKE_COMPLETIONS__?.[1] ?? null;
      const reset = window.__ASYMPTA_SMOKE_RESETS__?.[1] ?? null;
      const execution = completed?.execution ?? null;
      const worldValue = window.__ASYMPTA_DEMO__?.snapshot?.();
      const liveWorld = worldValue?.foreground ?? worldValue ?? null;
      return {
        receiptId: completed?.receipt?.id ?? null,
        resetCompletionId: reset?.completionId ?? null,
        status: execution?.status ?? null,
        requestText: execution?.envelope?.rawMessage?.text ?? null,
        userInventory: execution?.ledger?.[0]?.userInventory ?? null,
        reserved: execution?.ledger?.[0]?.marketReserved ?? null,
        cargo: execution?.ledger?.[0]?.carrierCargo ?? null,
        transaction: execution?.transactions?.[0] ?? null,
        packetKinds: (execution?.packets ?? []).map((packet) => packet.kind),
        liveWorldPhase: liveWorld?.phase ?? null,
        liveTaskCount: liveWorld?.tasks?.length ?? null,
        liveExecution: window.__ASYMPTA_MARKETPLACE__?.snapshot?.() ?? null,
        celebrationId: document.querySelector('.asympta-screen-celebration')?.dataset?.completionId ?? null,
        celebrationVerification: document.querySelector('.asympta-screen-celebration')?.dataset?.verification ?? null
      };
    })())`));
    if (guitarEnd.status !== "completed" || guitarEnd.requestText !== "Buy a guitar" || guitarEnd.userInventory !== 1 || guitarEnd.reserved !== 0 || guitarEnd.cargo !== 0) {
      throw new Error(`Buy a guitar completion receipt lacked delivery proof: ${JSON.stringify(guitarEnd)}`);
    }
    if (guitarEnd.transaction?.status !== "completed" || guitarEnd.transaction?.payment !== "authorized") {
      throw new Error(`Buy a guitar transaction is incomplete: ${JSON.stringify(guitarEnd.transaction)}`);
    }
    for (const kind of ["enquiry", "availability", "offer", "approval_request", "payment_authorized", "goods_handoff", "delivery_receipt", "verification"]) {
      if (!guitarEnd.packetKinds.includes(kind)) throw new Error(`Buy a guitar packet ${kind} is missing: ${JSON.stringify(guitarEnd.packetKinds)}`);
    }
    if (!guitarEnd.receiptId || guitarEnd.resetCompletionId !== guitarEnd.receiptId || guitarEnd.liveWorldPhase !== "idle" || guitarEnd.liveTaskCount !== 0 || guitarEnd.liveExecution !== null) {
      throw new Error(`Buy a guitar did not reset to a clean live runtime: ${JSON.stringify(guitarEnd)}`);
    }
    if (guitarEnd.celebrationId !== guitarEnd.receiptId || guitarEnd.celebrationVerification !== "verified") {
      throw new Error(`Buy a guitar celebration did not survive runtime reset: ${JSON.stringify(guitarEnd)}`);
    }
    if (exceptions.length) {
      throw new Error(`Browser runtime exception(s):\n${exceptions.join("\n---\n")}`);
    }
    if (consoleErrors.some((entry) => /react|hydration|uncaught|typeerror|referenceerror|invariant/i.test(entry))) {
      throw new Error(`Browser console error(s):\n${consoleErrors.join("\n")}`);
    }

    console.log("Marketplace browser smoke passed: verified completion receipts preserve celebration proof while each finished workflow resets to a clean idle runtime before the next request.");
    socket.close();
  } finally {
    chrome.kill("SIGTERM");
    server.close();
    if (chrome.exitCode && chrome.exitCode !== 0) console.error(chromeStderr.slice(-4000));
  }
}

await run();