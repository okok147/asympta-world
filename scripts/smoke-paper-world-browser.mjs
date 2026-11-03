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
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function findChrome() {
  for (const name of [process.env.CHROME_BIN, "google-chrome", "google-chrome-stable", "chromium", "chromium-browser"].filter(Boolean)) {
    if (name.includes("/")) return name;
    const result = spawnSync("which", [name], { encoding: "utf8" });
    if (result.status === 0) return result.stdout.trim();
  }
  throw new Error("Chrome/Chromium is required to test the real-world map.");
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function staticServer() {
  return createServer(async (req, res) => {
    try {
      let pathname = new URL(req.url ?? "/", "http://localhost").pathname;
      if (pathname === base || pathname === base + "/") pathname = "/index.html";
      else if (pathname.startsWith(base + "/")) pathname = pathname.slice(base.length);
      else return res.writeHead(404).end("Not found");

      const candidate = path.resolve(dist, pathname.slice(1));
      if (!candidate.startsWith(dist + path.sep)) return res.writeHead(403).end("Forbidden");
      if ((await stat(candidate)).isDirectory()) return res.writeHead(404).end("Not found");
      const body = await readFile(candidate);
      res.writeHead(200, { "content-type": mime[path.extname(candidate)] ?? "application/octet-stream" });
      res.end(body);
    } catch (error) {
      res.writeHead(404).end(error instanceof Error ? error.message : String(error));
    }
  });
}

async function waitForBrowser(port) {
  for (let attempts = 0; attempts < 120; attempts++) {
    try {
      const res = await fetch("http://127.0.0.1:" + port + "/json/list");
      if (res.ok) {
        const pages = await res.json();
        const page = pages.find((entry) => entry.type === "page");
        if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
      }
    } catch {}
    await sleep(100);
  }
  throw new Error("Cannot connect to Chrome DevTools.");
}

async function run() {
  const server = staticServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const sitePort = typeof address === "object" && address ? address.port : 0;
  const debugPort = await freePort();
  const browser = spawn(findChrome(), [
    "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
    "--enable-unsafe-swiftshader",
    "--use-angle=swiftshader",
    "--remote-debugging-port=" + debugPort,
    "--user-data-dir=/tmp/asympta-map-smoke-" + process.pid,
    "about:blank",
  ], { stdio: "ignore" });

  let ws;
  try {
    ws = new WebSocket(await waitForBrowser(debugPort));
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", reject, { once: true });
    });

    let id = 0;
    const pending = new Map();
    const exceptions = [];
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id && pending.has(message.id)) {
        const { resolve, reject } = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      }
      if (message.method === "Runtime.exceptionThrown") {
        exceptions.push(message.params?.exceptionDetails?.text ?? "Unknown runtime exception");
      }
    });

    const command = (method, params = {}) => new Promise((resolve, reject) => {
      const commandId = ++id;
      pending.set(commandId, { resolve, reject });
      ws.send(JSON.stringify({ id: commandId, method, params }));
    });
    const evalJs = async (expression) => {
      const result = await command("Runtime.evaluate", { expression, returnByValue: true });
      if (result?.exceptionDetails) throw new Error(result.exceptionDetails.text ?? "Browser evaluation failed");
      return result?.result?.value;
    };
    const capture = () => evalJs("JSON.stringify((() => {" +
      "const main=document.querySelector('.asympta-map-world');" +
      "const canvas=document.querySelector('#asympta-real-map canvas');" +
      "const animals=[...document.querySelectorAll('.asympta-creature-marker')];" +
      "return {ready:document.readyState,mapStatus:main?.dataset.mapStatus,locationStatus:main?.dataset.locationStatus," +
      "canvasVisible:!!canvas&&canvas.width>0&&canvas.height>0,animals:animals.length," +
      "svgCount:animals.filter(a=>a.querySelector('svg')).length," +
      "yourMarker:document.querySelectorAll('.asympta-you-marker').length," +
      "oldUI:!!document.querySelector('.map-app,.atlas-console,.paper-world__people')," +
      "locateButton:!!document.querySelector('button.asympta-locate-button')," +
      "disclosure:document.querySelector('.asympta-map-disclosure')?.textContent," +
      "geoCalls:window.__asymptaGeolocationCalls||0};" +
      "})())").then((value) => JSON.parse(value ?? "{}"));

    await command("Runtime.enable");
    await command("Page.enable");
    await command("Page.navigate", {
      url: "http://127.0.0.1:" + sitePort + base + "/",
    });

    let initial;
    for (let attempt = 0; attempt < 90; attempt++) {
      await sleep(300);
      initial = await capture();
      if (initial.mapStatus === "ready" || initial.mapStatus === "error") break;
    }
    if (initial?.mapStatus !== "ready" || initial.ready !== "complete" ||
        !initial.canvasVisible || initial.animals !== 4 || initial.svgCount !== 4 ||
        initial.yourMarker !== 0 || initial.oldUI || !initial.locateButton ||
        !initial.disclosure?.includes("not live users")) {
      throw new Error("Map boot / isolated animal illustrations failed: " + JSON.stringify(initial));
    }

    // Provide synthetic position only AFTER page load, to prove actual location is user-initiated.
    await evalJs("window.__asymptaGeolocationCalls=0;" +
      "Object.defineProperty(navigator.geolocation,'getCurrentPosition',{configurable:true,value:(success)=>{" +
      "window.__asymptaGeolocationCalls++;" +
      "success({coords:{latitude:22.31,longitude:114.17,accuracy:40},timestamp:Date.now()});" +
      "}});" +
      "document.querySelector('.asympta-locate-button').click();");

    let located;
    for (let attempt = 0; attempt < 30; attempt++) {
      await sleep(100);
      located = await capture();
      if (located.locationStatus === "located" && located.yourMarker === 1) break;
    }
    if (located?.locationStatus !== "located" || located.yourMarker !== 1 ||
        located.geoCalls !== 1 || located.animals !== 4 || exceptions.length) {
      throw new Error("Opt-in geolocation failed: " + JSON.stringify({ located, exceptions }));
    }
    console.log("Live map browser smoke passed: map tiles, 4 artwork markers, user-clicked location and no legacy decorations.");
  } finally {
    ws?.close();
    browser.kill("SIGTERM");
    server.close();
  }
}

await run();
