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
  throw new Error("Business localization browser smoke requires Chrome/Chromium on the CI runner.");
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
    `--user-data-dir=/tmp/asympta-business-locale-smoke-${process.pid}`,
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

    const evaluate = async (expression) => {
      const result = await command("Runtime.evaluate", { expression, returnByValue: true });
      if (result?.exceptionDetails) {
        throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? "Browser evaluation failed.");
      }
      return result?.result?.value;
    };

    const waitFor = async (expression, timeoutMs = 12_000, label = expression) => {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (await evaluate(`Boolean(${expression})`)) return;
        await sleep(100);
      }
      throw new Error(`Timed out waiting for ${label}.`);
    };

    const clickByText = async (text) => evaluate(`(() => {
      const button = [...document.querySelectorAll('button')].find((item) => item.textContent?.trim() === ${JSON.stringify(text)});
      if (!button) throw new Error(${JSON.stringify(`Button not found: ${text}`)});
      button.click();
      return true;
    })()`);

    const selectLocale = async (ariaLabel, optionText, expectedLang) => {
      await evaluate(`(() => {
        const button = document.querySelector('button[aria-label=${JSON.stringify(ariaLabel)}]');
        if (!button) throw new Error(${JSON.stringify(`Language button not found: ${ariaLabel}`)});
        button.click();
        return true;
      })()`);
      await waitFor(
        `[...document.querySelectorAll('button')].some((button) => button.textContent?.trim() === ${JSON.stringify(optionText)})`,
        5_000,
        `${optionText} language option`,
      );
      await clickByText(optionText);
      await waitFor(`document.documentElement.lang === ${JSON.stringify(expectedLang)}`, 5_000, `${expectedLang} document language`);
    };

    await command("Runtime.enable");
    await command("Page.enable");
    const loaded = once("Page.loadEventFired");
    await command("Page.navigate", { url: `http://127.0.0.1:${sitePort}${basePath}/` });
    await Promise.race([
      loaded,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timed out waiting for page load.")), 12_000)),
    ]);

    await waitFor(
      `(() => {
        const nav = document.querySelector('nav[aria-label="Asympta World mode"]');
        const business = [...(nav?.querySelectorAll('button') ?? [])]
          .find((item) => item.textContent?.trim() === 'Business');
        return document.readyState === 'complete'
          && Boolean(document.querySelector('form.asympta-intent-composer'))
          && Boolean(document.querySelector('button[aria-label="Language"]'))
          && business?.getAttribute('aria-pressed') === 'false';
      })()`,
      15_000,
      "hydrated English global controls",
    );

    // A click issued at the hydration boundary may be ignored before React has attached
    // the handler. Retry the native user action only while the app is still in Users.
    // Success still requires the real React state + Business workspace to appear.
    await waitFor(
      `(() => {
        const ready = document.documentElement.dataset.asymptaAudience === 'business'
          && Boolean(document.querySelector('[data-asympta-business-world="true"]'));
        if (ready) return true;
        const nav = document.querySelector('nav[aria-label="Asympta World mode"]');
        const button = [...(nav?.querySelectorAll('button') ?? [])]
          .find((item) => item.textContent?.trim() === 'Business');
        if (button?.getAttribute('aria-pressed') === 'false') button.click();
        return false;
      })()`,
      8_000,
      "Business workspace",
    );

    await evaluate(`(() => {
      const root = document.querySelector('[data-asympta-business-world="true"]');
      const expand = root?.querySelector('button[aria-expanded="false"]');
      if (!expand) throw new Error('Collapsed Business workspace did not expose its expand control.');
      expand.click();
      return true;
    })()`);
    await waitFor(`document.querySelector('[data-asympta-business-world="true"]')?.getAttribute('data-business-workspace-open') === 'true'`, 5_000, "expanded Business workspace");

    await evaluate(`(() => {
      const world = document.querySelector('[data-asympta-business-world="true"]');
      const files = [...world.querySelectorAll('input[type="file"]')];
      if (files.length !== 2) throw new Error('Business import inputs are unavailable.');

      const businessTransfer = new DataTransfer();
      businessTransfer.items.add(new File([JSON.stringify({
        name: 'Harbour Bakery',
        category: 'Bakery',
        location: '12 Harbour Road',
        hours: 'Mon-Fri 08:00-18:00'
      })], 'business.json', { type: 'application/json' }));
      files[0].files = businessTransfer.files;
      files[0].dispatchEvent(new Event('change', { bubbles: true }));

      const productTransfer = new DataTransfer();
      productTransfer.items.add(new File([JSON.stringify([{
        id: 'bread-1',
        name: 'Sourdough loaf',
        description: 'Naturally fermented.',
        price: 48,
        currency: 'HKD',
        availability: 'available'
      }])], 'products.json', { type: 'application/json' }));
      files[1].files = productTransfer.files;
      files[1].dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);

    await waitFor(
      `JSON.parse(localStorage.getItem('asympta:business-profile:v1') ?? 'null')?.name === 'Harbour Bakery' && JSON.parse(localStorage.getItem('asympta:business-products:v1') ?? '[]')[0]?.name === 'Sourdough loaf'`,
      8_000,
      "imported Business data",
    );

    await selectLocale("Language", "繁體中文", "zh-Hant");
    await waitFor(`(() => {
      const world = document.querySelector('[data-asympta-business-world="true"]');
      const nav = document.querySelector('nav[aria-label="Asympta World 模式"]');
      const text = world?.textContent ?? '';
      const placeholder = [...(world?.querySelectorAll('textarea') ?? [])].find((node) => node.placeholder?.includes('客戶代理'))?.placeholder ?? '';
      return Boolean(nav && text.includes('商業代理 ↔ 客戶代理') && text.includes('商家資訊') && text.includes('產品') && text.includes('有供應') && placeholder.includes('酸種麵包'));
    })()`, 8_000, "Traditional Chinese Business UI");

    await evaluate(`(() => {
      const world = document.querySelector('[data-asympta-business-world="true"]');
      const composer = [...world.querySelectorAll('textarea')].find((node) => node.placeholder?.includes('客戶代理'));
      if (!composer) throw new Error('Localized customer-agent composer is unavailable.');
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      if (setter) setter.call(composer, 'Do you have the sourdough loaf?');
      else composer.value = 'Do you have the sourdough loaf?';
      composer.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);
    await waitFor(`(() => {
      const world = document.querySelector('[data-asympta-business-world="true"]');
      const send = [...world.querySelectorAll('button')].find((button) => button.textContent?.includes('執行通訊'));
      return Boolean(send && !send.disabled);
    })()`, 5_000, "localized Business send action");
    await evaluate(`(() => {
      const world = document.querySelector('[data-asympta-business-world="true"]');
      const send = [...world.querySelectorAll('button')].find((button) => button.textContent?.includes('執行通訊'));
      if (!send || send.disabled) throw new Error('Localized Business send action is unavailable.');
      send.click();
      return true;
    })()`);
    await waitFor(`document.querySelector('[data-asympta-business-world="true"]')?.textContent?.includes('現有供應') && document.querySelector('[data-asympta-business-world="true"]')?.textContent?.includes('價格：HKD 48')`, 8_000, "Traditional Chinese Business agent reply");

    await selectLocale("語言", "日本語", "ja");
    await waitFor(`(() => {
      const world = document.querySelector('[data-asympta-business-world="true"]');
      const nav = document.querySelector('nav[aria-label="Asympta World モード"]');
      const text = world?.textContent ?? '';
      return Boolean(nav && text.includes('ビジネスエージェント ↔ 顧客エージェント') && text.includes('事業者情報') && text.includes('商品') && text.includes('在庫あり') && text.includes('価格：HKD 48'));
    })()`, 8_000, "Japanese Business UI and reply");

    await selectLocale("言語", "English", "en");
    await waitFor(`(() => {
      const world = document.querySelector('[data-asympta-business-world="true"]');
      const nav = document.querySelector('nav[aria-label="Asympta World mode"]');
      const text = world?.textContent ?? '';
      const placeholder = [...(world?.querySelectorAll('textarea') ?? [])].find((node) => node.placeholder?.startsWith('Customer agent:'))?.placeholder ?? '';
      return Boolean(nav && text.includes('Business Agent ↔ Customer Agent') && text.includes('Business information') && text.includes('Products') && text.includes('is available') && text.includes('Price: HKD 48') && placeholder.includes('sourdough loaf'));
    })()`, 8_000, "reversible English Business UI and reply");

    if (exceptions.length) throw new Error(`Browser exceptions during Business localization smoke: ${exceptions.join(" | ")}`);

    console.log("Business localization smoke passed: the global language selector drives Business static UI, ARIA, placeholders, availability and dynamic agent replies across zh-Hant, ja and en without reload.");
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
