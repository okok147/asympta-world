import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "pages-dist");
const basePath = "/asympta-world";
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "text/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

function chromeBinary() {
  const candidates = [process.env.CHROME_BIN, "google-chrome", "google-chrome-stable", "chromium", "chromium-browser"].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate.includes("/")) return candidate;
    const result = spawnSync("which", [candidate], { encoding: "utf8" });
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  }
  throw new Error("Chrome/Chromium is required for the universal browser benchmark.");
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

function siteServer() {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      let pathname = decodeURIComponent(url.pathname);
      if (pathname === basePath || pathname === `${basePath}/`) pathname = "/index.html";
      else if (pathname.startsWith(`${basePath}/`)) pathname = pathname.slice(basePath.length);
      if (pathname === "/") pathname = "/index.html";
      const candidate = path.resolve(outputDir, pathname.replace(/^\/+/, ""));
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
      response.writeHead(200, {
        "content-type": mime[path.extname(file)] ?? "application/octet-stream",
        "cache-control": "no-store",
      });
      response.end(await readFile(file));
    } catch (error) {
      response.writeHead(500, { "content-type": "text/plain" });
      response.end(error instanceof Error ? error.message : String(error));
    }
  });
}

async function waitForJson(url, timeout = 10_000) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw lastError instanceof Error ? lastError : new Error(`Timed out waiting for ${url}`);
}

async function run() {
  const server = siteServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const sitePort = typeof address === "object" && address ? address.port : 0;
  const debugPort = await freePort();
  const chrome = spawn(chromeBinary(), [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=/tmp/asympta-universal-verify-${process.pid}`,
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  let chromeError = "";
  chrome.stderr.on("data", (chunk) => { chromeError += String(chunk); });

  try {
    const targets = await waitForJson(`http://127.0.0.1:${debugPort}/json/list`);
    const target = targets.find((entry) => entry.type === "page") ?? targets[0];
    if (!target?.webSocketDebuggerUrl) throw new Error("Chrome did not expose a page target.");
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });

    let commandId = 0;
    const pending = new Map();
    const events = new Map();
    const exceptions = [];
    const consoleErrors = [];
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id && pending.has(message.id)) {
        const handlers = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) handlers.reject(new Error(message.error.message));
        else handlers.resolve(message.result);
        return;
      }
      if (message.method === "Runtime.exceptionThrown") {
        const details = message.params?.exceptionDetails;
        exceptions.push(details?.exception?.description ?? details?.text ?? "Unknown browser exception");
      }
      if (message.method === "Runtime.consoleAPICalled" && message.params?.type === "error") {
        consoleErrors.push((message.params.args ?? []).map((argument) => argument.value ?? argument.description ?? "").join(" "));
      }
      const listeners = events.get(message.method);
      if (listeners) {
        events.delete(message.method);
        listeners.forEach((resolve) => resolve(message.params));
      }
    });
    const command = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++commandId;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
    const once = (method) => new Promise((resolve) => {
      const listeners = events.get(method) ?? [];
      listeners.push(resolve);
      events.set(method, listeners);
    });
    const evaluate = async (expression, awaitPromise = false) => {
      const response = await command("Runtime.evaluate", { expression, awaitPromise, returnByValue: true });
      if (response?.exceptionDetails) throw new Error(response.exceptionDetails.text ?? "Browser evaluation failed.");
      return response?.result?.value;
    };

    await command("Runtime.enable");
    await command("Page.enable");
    const loaded = once("Page.loadEventFired");
    await command("Page.navigate", { url: `http://127.0.0.1:${sitePort}${basePath}/?asympta-benchmark=1` });
    await Promise.race([
      loaded,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timed out waiting for page load.")), 12_000)),
    ]);

    const ready = await evaluate(`new Promise((resolve) => {
      const deadline = Date.now() + 15000;
      const check = () => {
        if (window.__ASYMPTA_BENCHMARK__ && window.__ASYMPTA_TASK_KERNEL__) return resolve(true);
        if (document.documentElement.dataset.asymptaBenchmark === 'failed' || Date.now() >= deadline) return resolve(false);
        setTimeout(check, 80);
      };
      check();
    })`, true);
    if (!ready) throw new Error("Universal benchmark or Task Kernel bridge did not become ready.");

    const report = JSON.parse(await evaluate(`JSON.stringify(window.__ASYMPTA_BENCHMARK__.run({ coreCount: 100, stressCount: 500, seed: 20260831 }))`));
    if (!report.passed || report.total !== 600 || report.completed !== 600 || report.stuck !== 0 || report.humanInterventions !== 0) {
      throw new Error(`Universal benchmark failed: ${JSON.stringify(report, null, 2)}`);
    }

    const schema = JSON.parse(await evaluate(`JSON.stringify(window.__ASYMPTA_BENCHMARK__.compileClarification({
      intent: '使用者想購買一台電視機',
      missingFields: ['使用者想購買一台電視機，需先釐清預算、尺寸、品牌偏好與配送地點等資訊。'],
      locale: 'zh-Hant'
    }))`));
    if (schema.fields.length !== 4 || schema.fields.some((field) => field.control !== 'single_choice')) {
      throw new Error(`TV fields did not compile into choices: ${JSON.stringify(schema)}`);
    }
    for (const expected of ["HK$3,000–6,000", "75″", "Sony", "常用住址"]) {
      if (!schema.fields.some((field) => field.options.some((candidate) => candidate.label === expected))) {
        throw new Error(`Missing generated option ${expected}.`);
      }
    }

    const uiProbe = JSON.parse(await evaluate(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
      const languageButtons = document.querySelectorAll('.atlas-language-menu button');
      languageButtons[1]?.click();
      document.documentElement.lang = 'zh-Hant';
      await wait(180);
      const activityId = 'universal-tv-task-kernel-probe';
      const intent = '使用者想購買一台電視機 — typed Task Kernel browser probe';
      const emit = (status, data) => window.dispatchEvent(new CustomEvent('asympta:activity', { detail: {
        activity: { id: activityId, intent: { raw: intent, locale: 'zh-Hant' }, status },
        event: { status, summary: status, data }
      } }));
      const card = () => document.querySelector('[data-asympta-adaptive-schema]');
      const text = (node) => node?.textContent?.replace(/\\s+/g, ' ').trim() ?? '';
      const buttons = () => [...(card()?.querySelectorAll('button') ?? [])];
      const snapshot = () => {
        const node = card();
        return {
          field: node?.getAttribute('data-field') ?? null,
          taskId: node?.getAttribute('data-task-id') ?? null,
          revision: Number(node?.getAttribute('data-task-revision') ?? 0),
          options: buttons().map(text),
          visible: Boolean(node && node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().height > 0),
          placeholder: node?.querySelector('input')?.getAttribute('placeholder') ?? null
        };
      };
      const diagnostic = () => {
        const state = snapshot();
        const task = state.taskId ? window.__ASYMPTA_TASK_KERNEL__.getTask(state.taskId) : window.__ASYMPTA_TASK_KERNEL__.activeTask();
        return {
          state,
          task: task ? {
            taskId: task.taskId,
            revision: task.revision,
            phase: task.phase,
            liveness: task.liveness?.state ?? null,
            outcomeStatus: task.outcome?.status ?? null,
            requirements: task.requirements.map((requirement) => ({
              id: requirement.id,
              key: requirement.key,
              status: requirement.status,
              displayValue: requirement.displayValue ?? null
            }))
          } : null
        };
      };
      const waitFor = async (predicate, description, timeout = 2500) => {
        const deadline = Date.now() + timeout;
        while (Date.now() < deadline) {
          const value = predicate();
          if (value) return value;
          await wait(40);
        }
        throw new Error(description + ': ' + JSON.stringify(diagnostic()));
      };
      const waitForField = (field) => waitFor(() => {
        const state = snapshot();
        return state.field === field && state.visible ? state : null;
      }, 'Timed out waiting for field ' + field);
      const waitForButton = (label) => waitFor(() => {
        const button = buttons().find((node) => text(node) === label);
        return button && !button.disabled ? button : null;
      }, 'Timed out waiting for adaptive button ' + label);
      const clickButton = async (label) => {
        const button = await waitForButton(label);
        button.click();
        await wait(80);
      };
      const chooseAndContinue = async (label, nextField) => {
        await clickButton(label);
        await clickButton('繼續');
        return waitForField(nextField);
      };

      emit('interpreting');
      emit('waiting_input', { missingFields: ['使用者想購買一台電視機，需先釐清預算、尺寸、品牌偏好與配送地點等資訊。'] });
      const budget = await waitForField('budget');
      const screen = await chooseAndContinue('HK$10,000 以上', 'screen_size');
      const brand = await chooseAndContinue('55″', 'brand');
      const deliveryBeforeCustom = await chooseAndContinue('Sony', 'delivery_location');
      await clickButton('其他');
      const delivery = await waitFor(() => {
        const state = snapshot();
        return state.field === 'delivery_location' && state.placeholder === '輸入送貨地址或地區…' ? state : null;
      }, 'Timed out waiting for custom delivery input');
      await clickButton('常用住址');
      await clickButton('繼續');
      const approval = await waitForField('high_risk_confirmation');
      await clickButton('確認並繼續');
      const task = await waitFor(() => {
        const candidate = window.__ASYMPTA_TASK_KERNEL__.getTask(budget.taskId);
        return candidate?.phase === 'completed' ? candidate : null;
      }, 'Timed out waiting for verified completed Task Kernel outcome after confirmation', 7000);
      await waitFor(() => !card(), 'Adaptive card remained visible after task completion');

      return JSON.stringify({
        lang: document.documentElement.lang,
        budget,
        screen,
        brand,
        deliveryBeforeCustom,
        delivery,
        approval,
        completed: {
          cardGone: !card(),
          taskPhase: task.phase,
          taskRevision: task.revision,
          resultCompleted: task.result?.completed ?? null,
          outcomeStatus: task.outcome?.status ?? null,
          receiptVerified: task.evidence?.some((evidence) => evidence.kind === 'receipt' && evidence.verified) ?? false,
          rootIntent: task.rootIntent?.raw ?? null,
          assignmentAgents: task.assignments?.map((assignment) => assignment.agentId) ?? [],
          unknownRequirements: task.requirements?.filter((requirement) => requirement.status === 'unknown').length ?? null
        }
      });
    })()`, true));

    if (uiProbe.lang !== "zh-Hant" || !uiProbe.budget.visible || uiProbe.budget.field !== "budget") {
      throw new Error(`Adaptive option card was not rendered correctly: ${JSON.stringify(uiProbe)}`);
    }
    if (!uiProbe.budget.options.some((label) => label.includes("HK$3,000–6,000"))) {
      throw new Error(`Rendered budget options are incomplete: ${JSON.stringify(uiProbe.budget)}`);
    }
    if (uiProbe.screen.field !== "screen_size" || !uiProbe.screen.options.some((label) => label.includes("55″"))) {
      throw new Error(`Typed Task Kernel did not advance from budget to screen size: ${JSON.stringify(uiProbe.screen)}`);
    }
    if (uiProbe.brand.field !== "brand" || !uiProbe.brand.options.some((label) => label.includes("Sony"))) {
      throw new Error(`Typed Task Kernel did not advance from screen size to brand: ${JSON.stringify(uiProbe.brand)}`);
    }
    if (uiProbe.delivery.field !== "delivery_location" || uiProbe.deliveryBeforeCustom.field !== "delivery_location") {
      throw new Error(`Delivery location was confused with purchase location: ${JSON.stringify(uiProbe.delivery)}`);
    }
    for (const expected of ["常用住址", "目前位置", "門市自取"]) {
      if (!uiProbe.delivery.options.some((label) => label.includes(expected))) {
        throw new Error(`Rendered delivery options are missing ${expected}: ${JSON.stringify(uiProbe.delivery)}`);
      }
    }
    if (uiProbe.delivery.placeholder !== "輸入送貨地址或地區…") {
      throw new Error(`Custom delivery input was not generated: ${JSON.stringify(uiProbe.delivery)}`);
    }
    if (uiProbe.approval.field !== "high_risk_confirmation"
      || !uiProbe.approval.visible
      || !uiProbe.approval.options.some((label) => label.includes("確認並繼續"))) {
      throw new Error(`High-risk confirmation was not exposed as the only policy pause: ${JSON.stringify(uiProbe.approval)}`);
    }
    if (!(uiProbe.budget.revision < uiProbe.screen.revision
      && uiProbe.screen.revision < uiProbe.brand.revision
      && uiProbe.brand.revision < uiProbe.delivery.revision
      && uiProbe.delivery.revision < uiProbe.approval.revision)) {
      throw new Error(`Task revisions did not advance monotonically: ${JSON.stringify(uiProbe)}`);
    }
    if (!uiProbe.completed.cardGone
      || uiProbe.completed.taskPhase !== "completed"
      || uiProbe.completed.resultCompleted !== true
      || uiProbe.completed.outcomeStatus !== "completed"
      || uiProbe.completed.receiptVerified !== true
      || uiProbe.completed.unknownRequirements !== 0) {
      throw new Error(`Typed Task Kernel confirmation did not resume to a verified outcome: ${JSON.stringify(uiProbe.completed)}`);
    }
    if (uiProbe.completed.rootIntent !== "使用者想購買一台電視機 — typed Task Kernel browser probe") {
      throw new Error(`The immutable root intent changed during typed answers: ${JSON.stringify(uiProbe.completed)}`);
    }
    for (const expectedAgent of [
      "intent-interpreter",
      "commerce-electronics-specialist",
      "retailer-search-agent",
      "logistics-agent",
      "transaction-coordinator",
      "independent-verifier",
    ]) {
      if (!uiProbe.completed.assignmentAgents.includes(expectedAgent)) {
        throw new Error(`Agent mesh did not include ${expectedAgent}: ${JSON.stringify(uiProbe.completed)}`);
      }
    }

    if (exceptions.length) throw new Error(`Browser runtime exception(s):\n${exceptions.join("\n---\n")}`);
    if (consoleErrors.some((entry) => /react|hydration|uncaught|typeerror|referenceerror|benchmark bridge failed/i.test(entry))) {
      throw new Error(`Browser console error(s):\n${consoleErrors.join("\n---\n")}`);
    }

    console.log(`Universal browser benchmark passed: ${report.completed}/${report.total} cases, typed Task Kernel option chain, high-risk confirmation, execution receipt and bounded verification completed without replay.`);
    socket.close();
  } finally {
    chrome.kill("SIGTERM");
    server.close();
    if (chrome.exitCode && chrome.exitCode !== 0) console.error(chromeError.slice(-4000));
  }
}

await run();