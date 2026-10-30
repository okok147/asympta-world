// Browser acceptance for the bundled client. This does not operate WebKit,
// native sheets, TestFlight, or a physical Apple device.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "pages-dist");
const evidenceDir = path.resolve(process.env.MOBILE_EVIDENCE_DIR ?? path.join(root, "../asympta-world-mobile-evidence"));
const profile = path.join(evidenceDir, `chrome-profile-${process.pid}`);
const basePath = "/asympta-world";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2" };
const evidence = { kind: "Chrome mobile browser verification", limitations: ["HTTP origin with injected native flag and captured bridge messages; not WKWebView custom-scheme execution", "Native sheets and hosted services are not opened", "Simulation clock advancement uses the existing demo test bridge; no external actions occur", "Not TestFlight or physical-device acceptance"], startedAt: new Date().toISOString(), ok: false, viewports: [], exceptions: [], consoleErrors: [], blockedRemoteRequests: [], localAssetFailures: [] };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

const server = createServer(async (request, response) => {
  try {
    let pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
    if (pathname === basePath || pathname === `${basePath}/`) pathname = "/index.html";
    else if (pathname.startsWith(`${basePath}/`)) pathname = pathname.slice(basePath.length);
    const candidate = path.resolve(outputDir, pathname.replace(/^\/+/, ""));
    if (!candidate.startsWith(outputDir + path.sep)) { response.writeHead(403).end(); return; }
    let file = candidate;
    try { if ((await stat(file)).isDirectory()) file = path.join(file, "index.html"); }
    catch { response.writeHead(404).end("Not found"); return; }
    const body = await readFile(file);
    response.writeHead(200, { "content-type": MIME[path.extname(file)] ?? "application/octet-stream", "cache-control": "no-store" }).end(body);
  } catch { response.writeHead(500).end("Asset read failed"); }
});

let chrome;
let socket;
let chromeStderr = "";
let currentViewport = null;
const pending = new Map();
let sequence = 0;

async function run() {
  await mkdir(evidenceDir, { recursive: true });
  const index = await readFile(path.join(outputDir, "index.html"));
  evidence.indexSha256 = createHash("sha256").update(index).digest("hex");
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const debugPort = await freePort();
  chrome = spawn(process.env.CHROME_BIN ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
    "--headless=new", "--disable-dev-shm-usage", "--no-first-run", "--no-default-browser-check",
    "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
    `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  chrome.stderr.on("data", (chunk) => { chromeStderr += String(chunk); });
  let targets;
  const startup = Date.now() + 15_000;
  while (Date.now() < startup) {
    try { const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`); if (response.ok) { targets = await response.json(); break; } } catch {}
    await sleep(100);
  }
  const target = targets?.find((item) => item.type === "page");
  assert.ok(target?.webSocketDebuggerUrl, "Chrome debugging target");
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.id && pending.has(message.id)) {
      const callback = pending.get(message.id);
      pending.delete(message.id);
      clearTimeout(callback.timer);
      if (message.error) callback.reject(new Error(message.error.message)); else callback.resolve(message.result);
      return;
    }
    if (message.method === "Runtime.exceptionThrown") evidence.exceptions.push({ viewport: currentViewport, details: message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text });
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") evidence.consoleErrors.push({ viewport: currentViewport, text: message.params.args.map((arg) => arg.value ?? arg.description ?? "").join(" ") });
    if (message.method === "Network.requestWillBeSent" && /^https:\/\//.test(message.params.request.url)) evidence.blockedRemoteRequests.push({ viewport: currentViewport, url: message.params.request.url });
    if (message.method === "Network.responseReceived" && message.params.response.url.startsWith(origin) && message.params.response.status >= 400 && !message.params.response.url.endsWith("/favicon.ico")) evidence.localAssetFailures.push({ viewport: currentViewport, url: message.params.response.url, status: message.params.response.status });
  });
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timed out: ${method}`)); }, 20_000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const value = await command("Runtime.evaluate", { expression, returnByValue: true });
    if (value.exceptionDetails) throw new Error(value.exceptionDetails.exception?.description ?? value.exceptionDetails.text);
    return value.result?.value;
  };
  const waitFor = async (expression, label, timeout = 15_000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) { if (await evaluate(`Boolean(${expression})`)) return; await sleep(100); }
    throw new Error(`Timed out: ${label}`);
  };
  const tap = async (nodeExpression) => {
    const point = await evaluate(`(() => {
      const node = ${nodeExpression};
      if (!node || node.disabled) throw new Error('Tap target missing or disabled');
      node.scrollIntoView({block:'center', inline:'nearest', behavior:'instant'});
      const r = node.getBoundingClientRect();
      const x = Math.max(1, Math.min(innerWidth-1, r.left + r.width/2));
      const y = Math.max(1, Math.min(innerHeight-1, r.top + r.height/2));
      const hit = document.elementFromPoint(x, y);
      if (!hit || !(hit === node || node.contains(hit))) throw new Error('Tap target is covered: '+node.className+' by '+hit?.className);
      return {x,y};
    })()`);
    await command("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...point, radiusX: 1, radiusY: 1 }] });
    await command("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await sleep(70);
  };
  const tapSelector = (selector) => tap(`document.querySelector(${JSON.stringify(selector)})`);
  const screenshot = async (name) => {
    const result = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    const filename = `${currentViewport}-${name}.png`;
    await writeFile(path.join(evidenceDir, filename), Buffer.from(result.data, "base64"));
    return filename;
  };
  const measureTargets = () => evaluate(`(() => {
    const selectors=['.asympta-mobile-options__toggle','.atlas-menu-identity','.atlas-menu-bar > .atlas-quick-icon[aria-expanded]','[data-asympta-mode-switch] button','.simulation-studio__toggle','.simulation-studio button','.asympta-mobile-options__panel button','.map-zoom button'];
    return selectors.flatMap(selector=>[...document.querySelectorAll(selector)].filter(node=>{const r=node.getBoundingClientRect();const s=getComputedStyle(node);return r.width&&r.height&&r.right>0&&r.bottom>0&&r.left<innerWidth&&r.top<innerHeight&&s.display!=='none'&&s.visibility!=='hidden';}).map(node=>{const r=node.getBoundingClientRect();return {selector,label:node.getAttribute('aria-label')||node.textContent.trim().slice(0,60),width:r.width,height:r.height};}));
  })()`);
  const advanceToPause = async () => {
    for (let batch = 0; batch < 100; batch++) {
      const phase = await evaluate(`(() => { const demo=window.__ASYMPTA_DEMO__;for(let step=0;step<20;step++){if(demo.snapshot().foreground.phase!=='running')break;demo.advance(140);}window.dispatchEvent(new Event('asympta:world-tick'));return demo.snapshot().foreground.phase; })()`);
      if (phase !== "running") return phase;
      await sleep(20);
    }
    throw new Error("Simulation did not reach a bounded checkpoint");
  };

  await command("Runtime.enable");
  await command("Page.enable");
  await command("Network.enable");
  await command("Network.setBlockedURLs", { urls: ["https://*"] });
  await command("Page.addScriptToEvaluateOnNewDocument", { source: `window.__ASYMPTA_NATIVE__=true;window.__ASYMPTA_NATIVE_LOCALE__='en';window.__ASYMPTA_NATIVE_MESSAGES__=[];window.webkit={messageHandlers:{asympta:{postMessage(message){window.__ASYMPTA_NATIVE_MESSAGES__.push(JSON.parse(JSON.stringify(message)));}}}};` });

  for (const device of [{ name: "iphone", width: 390, height: 844 }, { name: "ipad", width: 1024, height: 768 }]) {
    currentViewport = device.name;
    const result = { ...device, ok: false, screenshots: [], touchTargets: [], languages: [], bridge: [], simulation: null };
    evidence.viewports.push(result);
    await command("Storage.clearDataForOrigin", { origin, storageTypes: "all" });
    await command("Emulation.setDeviceMetricsOverride", { width: device.width, height: device.height, deviceScaleFactor: 1, mobile: true });
    await command("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await command("Page.navigate", { url: `${origin}${basePath}/` });
    await waitFor("document.readyState==='complete' && Boolean(window.__ASYMPTA_DEMO__) && Boolean(document.querySelector('.simulation-studio textarea')) && Boolean(document.querySelector('.asympta-mobile-options'))", "bundled app hydration");
    await waitFor("document.querySelectorAll('.animal-map-marker--foreground').length>0 && document.documentElement.dataset.asymptaMobileMap==='local'", "offline map and agents", 20_000);
    result.screenshots.push(await screenshot("cold-editor"));
    result.touchTargets.push(...await measureTargets());
    await tapSelector(".simulation-studio__toggle");
    await waitFor("document.querySelector('.simulation-studio__toggle')?.getAttribute('aria-expanded')==='false'", "collapse editor");
    // Camera transitions and marker placement finish on compositor frames.
    // Test the visible result after that transition, rather than measuring the
    // frame in which the editor was collapsed.
    let mapState;
    const mapDeadline = Date.now() + 15_000;
    do {
      mapState = await evaluate(`(() => { const visible=[...document.querySelectorAll('.animal-map-marker--foreground')].filter(node=>{const r=node.getBoundingClientRect();return r.width>0&&r.height>0&&r.right>0&&r.bottom>0&&r.left<innerWidth&&r.top<innerHeight;});return {agents:document.querySelectorAll('.animal-map-marker--foreground').length,visibleAgents:visible.length,localSource:Boolean(window.__ASYMPTA_MAP__?.getSource('asympta-local-geography')),canvasWidth:document.querySelector('.maplibregl-canvas')?.width}; })()`);
      if (mapState.visibleAgents > 0 && mapState.localSource && mapState.canvasWidth > 0) break;
      await sleep(100);
    } while (Date.now() < mapDeadline);
    result.map = mapState;
    assert.ok(mapState.visibleAgents > 0 && mapState.localSource && mapState.canvasWidth > 0, `${device.name}: bundled map rendered visible agents`);
    result.screenshots.push(await screenshot("offline-world"));

    for (const [locale, option, shareLabel, connectLabel] of [["zh-Hant", "繁體中文", "分享摘要", "線上服務"], ["ja", "日本語", "概要を共有", "オンラインサービス"], ["en", "English", "Share a summary", "Online services"]]) {
      await tapSelector(".atlas-menu-bar > .atlas-quick-icon[aria-expanded]");
      await waitFor("Boolean(document.querySelector('.atlas-language-menu.is-open'))", "global language menu");
      await tap(`[...document.querySelectorAll('.atlas-language-menu button')].find(node=>node.textContent.trim()===${JSON.stringify(option)})`);
      await waitFor(`document.documentElement.lang===${JSON.stringify(locale)}`, `${locale} global language`);
      await tapSelector(".asympta-mobile-options__toggle");
      await waitFor(`document.querySelector('#asympta-mobile-menu')?.textContent.includes(${JSON.stringify(shareLabel)}) && document.querySelector('#asympta-mobile-menu')?.textContent.includes(${JSON.stringify(connectLabel)})`, `${locale} app options`);
      const observed = await evaluate("({lang:document.documentElement.lang,text:document.querySelector('#asympta-mobile-menu').innerText,localeMessages:window.__ASYMPTA_NATIVE_MESSAGES__.filter(message=>message.type==='locale')})");
      assert.ok(observed.localeMessages.some((message) => message.locale === locale), "native locale bridge follows global language");
      result.languages.push(observed);
      if (locale === "zh-Hant") result.screenshots.push(await screenshot("zh-options"));
      result.touchTargets.push(...await measureTargets());
      await tapSelector(".asympta-mobile-options__toggle");
    }
    assert.ok(result.touchTargets.length >= 6, "touch targets measured");
    const undersized = result.touchTargets.filter((item) => item.width < 43.9 || item.height < 43.9);
    assert.deepEqual(undersized, [], `${device.name}: at least 44px touch targets`);

    for (const [index, type] of ["share", "export", "connect"].entries()) {
      await tapSelector(".asympta-mobile-options__toggle");
      await tap(`document.querySelectorAll('.asympta-mobile-options__panel button')[${index}]`);
      await waitFor(`window.__ASYMPTA_NATIVE_MESSAGES__.some(message=>message.type===${JSON.stringify(type)})`, `${type} native bridge`);
    }
    const bridge = await evaluate("window.__ASYMPTA_NATIVE_MESSAGES__.filter(message=>['share','export','connect'].includes(message.type))");
    assert.equal(bridge.find((message) => message.type === "connect").text, undefined, "connect passes no arbitrary URL");
    assert.match(bridge.find((message) => message.type === "share").text, /Asympta World/);
    const exported = JSON.parse(bridge.find((message) => message.type === "export").text);
    assert.equal(exported.schema, "asympta.mobile-export/1");
    assert.equal(exported.simulated, true);
    assert.ok(exported.world?.foreground, "export contains real current snapshot");
    result.bridge = bridge.map((message) => ({ type: message.type, bytes: message.text?.length ?? 0 }));

    await tapSelector(".simulation-studio__toggle");
    const draft = `Restock notebooks\nQuantity: 50\nStock: 20\nLocation: MOBILE_DRAFT_${device.name}`;
    await tapSelector(".simulation-studio textarea");
    await command("Input.insertText", { text: draft });
    await waitFor(`document.querySelector('.simulation-studio textarea')?.value===${JSON.stringify(draft)}`, "draft input");
    await waitFor(`localStorage.getItem('asympta:simulation-drafts:v1')?.includes(${JSON.stringify(`MOBILE_DRAFT_${device.name}`)})`, "native draft persisted");
    await command("Page.reload", { ignoreCache: true });
    await waitFor(`document.querySelector('.simulation-studio textarea')?.value===${JSON.stringify(draft)} && Boolean(window.__ASYMPTA_DEMO__)`, "draft restored after page reload");
    result.draftRestored = true;
    await tapSelector(".simulation-studio__compose-footer button");
    await waitFor("Boolean(document.querySelector('.simulation-studio__start:not(:disabled)'))", "compiled simulation");
    await tapSelector(".simulation-studio__start");
    await waitFor("Boolean(window.__ASYMPTA_DEMO__.snapshot().foreground.coordination)", "simulation kernel started");
    assert.equal(await advanceToPause(), "waiting_approval", "simulation requires human approval");
    const before = await evaluate("window.__ASYMPTA_DEMO__.snapshot().foreground");
    assert.equal(before.tasks.find((task) => task.id.endsWith(":execute")).status, "queued", "execution stays queued before approval");
    assert.ok(!JSON.stringify(before).includes(`MOBILE_DRAFT_${device.name}`), "private location excluded from public snapshot");
    await waitFor("Boolean(document.querySelector('.simulation-studio__approval button.simulation-studio__primary'))", "visible approval control");
    await tapSelector(".simulation-studio__approval button.simulation-studio__primary");
    await waitFor("window.__ASYMPTA_DEMO__.snapshot().foreground.phase==='running'", "approval resumes simulation");
    assert.equal(await advanceToPause(), "completed", "approved simulation completes");
    const after = await evaluate("window.__ASYMPTA_DEMO__.snapshot().foreground.coordination");
    assert.equal(after.status, "verified_simulation");
    assert.equal(after.verifiedActions, 9);
    assert.equal(after.evidenceCount, 9);
    result.simulation = { beforeApproval: "execution queued", afterApproval: after.status, verifiedActions: after.verifiedActions, evidenceCount: after.evidenceCount, clock: "existing demo advance bridge" };
    await waitFor("document.querySelector('.simulation-studio__journey')?.textContent.includes('executable simulation contract')", "honest completion description");
    result.screenshots.push(await screenshot("completed-simulation"));
    result.ok = true;
  }
  assert.deepEqual(evidence.exceptions, [], "no uncaught browser exceptions");
  const hydrationErrors = evidence.consoleErrors.filter((entry) => /hydrat|Minified React error|did not match|#418|#423/i.test(entry.text));
  assert.deepEqual(hydrationErrors, [], "no React hydration errors");
  assert.deepEqual(evidence.localAssetFailures, [], "all required local assets available");
  evidence.ok = true;
}

try { await run(); }
catch (error) { evidence.error = error instanceof Error ? error.stack : String(error); process.exitCode = 1; }
finally {
  evidence.finishedAt = new Date().toISOString();
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(path.join(evidenceDir, "mobile-browser-evidence.json"), JSON.stringify(evidence, null, 2) + "\n");
  if (chromeStderr) await writeFile(path.join(evidenceDir, "chrome-stderr.log"), chromeStderr);
  socket?.close();
  for (const callback of pending.values()) { clearTimeout(callback.timer); callback.reject(new Error("Browser closed")); }
  pending.clear();
  chrome?.kill("SIGTERM");
  server.close();
  if (chrome) { await sleep(250); await rm(profile, { recursive: true, force: true }).catch(() => {}); }
  console.log(JSON.stringify({ ok: evidence.ok, evidence: path.join(evidenceDir, "mobile-browser-evidence.json"), viewports: evidence.viewports.map(({ name, ok }) => ({ name, ok })), error: evidence.error?.split("\n")[0] }));
}
