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
  throw new Error("Headless browser smoke test requires Chrome/Chromium on the CI runner.");
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
    `--user-data-dir=/tmp/asympta-browser-smoke-${process.pid}`,
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
    const exceptions = [];
    const consoleErrors = [];
    const events = new Map();

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

    await command("Runtime.enable");
    await command("Page.enable");
    const loaded = once("Page.loadEventFired");
    await command("Page.navigate", { url: `http://127.0.0.1:${sitePort}${basePath}/` });
    await Promise.race([
      loaded,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timed out waiting for page load.")), 12_000)),
    ]);
    await new Promise((resolve) => setTimeout(resolve, 4_500));

    const capture = async () => {
      const result = await command("Runtime.evaluate", {
        expression: `JSON.stringify((() => {
          const visible = (selector) => [...document.querySelectorAll(selector)].filter((node) => {
            const rect = node.getBoundingClientRect();
            const style = getComputedStyle(node);
            return !node.hidden && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0 && rect.right >= 0 && rect.bottom >= 0 && rect.left <= innerWidth && rect.top <= innerHeight;
          }).length;
          const alpha = (selector) => {
            const node = document.querySelector(selector);
            if (!node) return 0;
            const color = getComputedStyle(node).backgroundColor;
            const match = color.match(/rgba?\\([^)]*?(?:,|\\s\\/)\\s*([0-9.]+)\\s*\\)$/);
            return match ? Number(match[1]) : 1;
          };
          const snapshot = window.__ASYMPTA_DEMO__?.snapshot?.()?.foreground ?? null;
          const signature = snapshot ? JSON.stringify({
            phase: snapshot.phase,
            tasks: (snapshot.tasks ?? []).map((task) => [task.id, task.status, Number(task.progress ?? 0).toFixed(3)]),
            agents: (snapshot.agents ?? []).map((agent) => [agent.id, agent.status, Number(agent.lon ?? 0).toFixed(5), Number(agent.lat ?? 0).toFixed(5), agent.taskId ?? ''])
          }) : '';
          return {
            mapApp: Boolean(document.querySelector('.map-app')),
            accessCard: Boolean(document.querySelector('.asympta-access-card')),
            intentComposer: Boolean(document.querySelector('.asympta-intent-composer')),
            requestCard: Boolean(document.querySelector('.asympta-request-card')),
            foregroundAnimals: document.querySelectorAll('.animal-map-marker--foreground').length,
            ambientAnimals: document.querySelectorAll('.animal-map-marker--ambient').length,
            visibleForegroundAnimals: visible('.animal-map-marker--foreground'),
            visibleAmbientAnimals: visible('.animal-map-marker--ambient'),
            menuBackgroundAlpha: alpha('.atlas-console'),
            requestBackgroundAlpha: alpha('.asympta-request-card'),
            scale: document.documentElement.dataset.asymptaScale ?? null,
            phase: snapshot?.phase ?? null,
            revision: snapshot?.revision ?? null,
            workflowId: snapshot?.workflowId ?? null,
            pendingApprovalCount: snapshot?.pendingApprovals?.length ?? 0,
            lastCityPlan: snapshot?.lastCityPlan ?? null,
            selectedAgentId: document.querySelector('.animal-map-marker--foreground.is-selected')?.dataset?.agentId ?? null,
            jsonOutput: document.querySelector('[data-webmcp-json-output="true"]')?.textContent ?? null,
            signature,
            bodyText: document.body?.innerText?.slice(0, 1000) ?? '',
            readyState: document.readyState
          };
        })())`,
        returnByValue: true,
      });
      return JSON.parse(result?.result?.value ?? "{}");
    };

    const before = await capture();
    await command("Runtime.evaluate", {
      expression: `window.dispatchEvent(new CustomEvent('asympta:current-request', { detail: {
        requestId: 'request-hydration-smoke-1234',
        source: 'human',
        intent: 'Check current information',
        goal: 'Check current information',
        kind: 'research',
        permission: 'READ',
        status: 'completed',
        actor: 'Cross-check agent',
        step: 'Cross-check complete.',
        destination: 'External information',
        sourceCount: 0,
        verification: 'not_verified',
        events: ['Goal validated', 'Cross-check complete'],
        updatedAt: new Date().toISOString()
      } }))`,
      returnByValue: true,
    });
    await new Promise((resolve) => setTimeout(resolve, 1_800));
    const state = await capture();

    const readEvaluation = await command("Runtime.evaluate", {
      expression: `JSON.stringify((() => {
        const before = window.__ASYMPTA_DEMO__?.snapshot?.()?.foreground ?? null;
        window.dispatchEvent(new CustomEvent('asympta:city-plan', { detail: {
          requestId: 'request-browser-read-1234',
          plan: {
            access: 'READ',
            operation: 'inspect_agent',
            targetAgentId: 'agent-business',
            workflowId: null,
            actionType: null,
            message: null,
            reason: 'Inspect the selected business agent in the local simulation.'
          }
        } }));
        const after = window.__ASYMPTA_DEMO__?.snapshot?.()?.foreground ?? null;
        return {
          beforeRevision: before?.revision ?? null,
          afterRevision: after?.revision ?? null,
          pendingBefore: before?.pendingApprovals?.length ?? 0,
          pendingAfter: after?.pendingApprovals?.length ?? 0,
          evidence: after?.lastCityPlan ?? null
        };
      })())`,
      returnByValue: true,
    });
    const readTransition = JSON.parse(readEvaluation?.result?.value ?? "{}");
    await new Promise((resolve) => setTimeout(resolve, 650));
    const readCardState = await capture();

    const writeEvaluation = await command("Runtime.evaluate", {
      expression: `JSON.stringify((() => {
        const before = window.__ASYMPTA_DEMO__?.snapshot?.()?.foreground ?? null;
        window.dispatchEvent(new CustomEvent('asympta:city-plan', { detail: {
          requestId: 'request-browser-write-5678',
          plan: {
            access: 'WRITE_REQUEST',
            operation: 'start_simulated_workflow',
            targetAgentId: 'agent-support',
            workflowId: 'service-recovery',
            actionType: null,
            message: null,
            reason: 'Start the simulated recovery network only after the person approves.'
          }
        } }));
        const after = window.__ASYMPTA_DEMO__?.snapshot?.()?.foreground ?? null;
        const approval = (after?.pendingApprovals ?? []).find((item) => item.requestId === 'request-browser-write-5678') ?? null;
        return {
          beforeWorkflowId: before?.workflowId ?? null,
          queuedWorkflowId: after?.workflowId ?? null,
          approval,
          evidence: after?.lastCityPlan ?? null
        };
      })())`,
      returnByValue: true,
    });
    const writeTransition = JSON.parse(writeEvaluation?.result?.value ?? "{}");
    await new Promise((resolve) => setTimeout(resolve, 650));
    const writeCardState = await capture();

    const approvalId = writeTransition.approval?.id;
    if (!approvalId) throw new Error(`City-plan write did not create an exact pending approval: ${JSON.stringify(writeTransition)}`);
    const approvedEvaluation = await command("Runtime.evaluate", {
      expression: `JSON.stringify(window.__ASYMPTA_DEMO__?.approve?.(${JSON.stringify(approvalId)}, true) ?? null)`,
      returnByValue: true,
    });
    const approvedSnapshot = JSON.parse(approvedEvaluation?.result?.value ?? "null");
    await new Promise((resolve) => setTimeout(resolve, 650));
    const approvedCardState = await capture();

    socket.close();

    if (!state.mapApp || !state.accessCard || !state.intentComposer || state.readyState !== "complete") {
      throw new Error(`Hydration smoke failed: ${JSON.stringify(state)}`);
    }
    if (before.requestCard || !state.requestCard || !state.bodyText.includes("Check current information")) {
      throw new Error(`Current-request card smoke failed: ${JSON.stringify({ before, state })}`);
    }
    if (state.scale !== "city" || state.foregroundAnimals < 1 || state.visibleForegroundAnimals < 1 || state.ambientAnimals < 1 || state.visibleAmbientAnimals < 1) {
      throw new Error(`Cute-agent visibility smoke failed: ${JSON.stringify(state)}`);
    }
    if (state.menuBackgroundAlpha < 0.8 || state.requestBackgroundAlpha < 0.8) {
      throw new Error(`Primary canvas opacity smoke failed: ${JSON.stringify({ menuBackgroundAlpha: state.menuBackgroundAlpha, requestBackgroundAlpha: state.requestBackgroundAlpha })}`);
    }
    if (before.phase === "running" && state.phase === "running" && before.signature === state.signature) {
      throw new Error(`Living-world browser stall detected: ${state.signature}`);
    }
    if (readTransition.beforeRevision !== readTransition.afterRevision
      || readTransition.pendingBefore !== readTransition.pendingAfter
      || readTransition.evidence?.status !== "observed"
      || readTransition.evidence?.requestId !== "request-browser-read-1234") {
      throw new Error(`City READ mutated state or lost evidence: ${JSON.stringify(readTransition)}`);
    }
    const readJson = JSON.parse(readCardState.jsonOutput ?? "null");
    if (readCardState.selectedAgentId !== "agent-business"
      || readJson?.access !== "READ"
      || readJson?.evidence?.requestId !== "request-browser-read-1234") {
      throw new Error(`City READ JSON card or selected agent failed: ${JSON.stringify(readCardState)}`);
    }
    if (writeTransition.queuedWorkflowId !== writeTransition.beforeWorkflowId
      || writeTransition.evidence?.status !== "pending_approval"
      || writeTransition.evidence?.approvalId !== writeTransition.approval?.id) {
      throw new Error(`City WRITE REQUEST crossed approval boundary: ${JSON.stringify(writeTransition)}`);
    }
    const writeJson = JSON.parse(writeCardState.jsonOutput ?? "null");
    if (writeCardState.selectedAgentId !== "agent-support"
      || writeJson?.access !== "WRITE_REQUEST"
      || writeJson?.queuedForHumanApproval !== true
      || writeJson?.evidence?.requestId !== "request-browser-write-5678") {
      throw new Error(`City WRITE JSON card failed: ${JSON.stringify(writeCardState)}`);
    }
    const approvedJson = JSON.parse(approvedCardState.jsonOutput ?? "null");
    if (approvedSnapshot?.workflowId !== "service-recovery"
      || approvedSnapshot?.lastCityPlan?.status !== "approved"
      || approvedSnapshot?.lastCityPlan?.requestId !== "request-browser-write-5678"
      || approvedCardState.workflowId !== "service-recovery"
      || approvedJson?.approvalStatus !== "approved"
      || approvedJson?.evidence?.requestId !== "request-browser-write-5678") {
      throw new Error(`Approved simulated write did not read back exactly: ${JSON.stringify({ approvedSnapshot, approvedCardState })}`);
    }
    if (exceptions.length) {
      throw new Error(`Browser runtime exception(s):\n${exceptions.join("\n---\n")}`);
    }
    if (consoleErrors.some((entry) => /react|notfounderror|hydration|uncaught|typeerror|referenceerror/i.test(entry))) {
      throw new Error(`Browser console error(s):\n${consoleErrors.join("\n")}`);
    }

    console.log(`Browser smoke passed: city scale, live world progression, JSON READ/WRITE cards, model-plan agent selection, pending approval boundary and exact approved simulation read-back; ${state.visibleForegroundAnimals} foreground + ${state.visibleAmbientAnimals} ambient cute agents.`);
  } finally {
    chrome.kill("SIGTERM");
    server.close();
    if (chrome.exitCode && chrome.exitCode !== 0) {
      console.error(chromeStderr.slice(-4000));
    }
  }
}

await run();
