import assert from "node:assert/strict";
import test from "node:test";
import { asymptaTaskStorage } from "../lib/asympta-mobile-storage.ts";
import { getPublicAgentConfig } from "../lib/asympta-public-agent-client.ts";
import { BrowserAsymptaTaskKernel } from "../lib/asympta-browser-task-kernel.ts";

test("app data survives a new session while web tabs retain session isolation", () => {
  const original = globalThis.window;
  const persistent = new Map();
  const store = (map) => ({ getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) });
  try {
    globalThis.window = { __ASYMPTA_NATIVE__: true, localStorage: store(persistent), sessionStorage: store(new Map()) };
    asymptaTaskStorage().setItem("activity", "awaiting human approval");
    globalThis.window = { __ASYMPTA_NATIVE__: true, localStorage: store(persistent), sessionStorage: store(new Map()) };
    assert.equal(asymptaTaskStorage().getItem("activity"), "awaiting human approval");
    globalThis.window.__ASYMPTA_NATIVE__ = false;
    assert.equal(asymptaTaskStorage().getItem("activity"), null);
  } finally {
    if (original === undefined) delete globalThis.window; else globalThis.window = original;
  }
});

test("unavailable WebKit storage does not crash app startup", () => {
  const original = globalThis.window;
  try {
    globalThis.window = { __ASYMPTA_NATIVE__: true, get localStorage() { throw new Error("storage unavailable"); } };
    assert.equal(asymptaTaskStorage(), null);
    delete globalThis.window;
    assert.equal(asymptaTaskStorage(), null);
  } finally {
    if (original === undefined) delete globalThis.window; else globalThis.window = original;
  }
});

test("the native origin cannot silently reuse hosted public-service authentication", () => {
  const originalWindow = globalThis.window;
  const originalApi = process.env.NEXT_PUBLIC_ASYMPTA_AGENT_API_URL;
  const originalSiteKey = process.env.NEXT_PUBLIC_ASYMPTA_TURNSTILE_SITE_KEY;
  try {
    process.env.NEXT_PUBLIC_ASYMPTA_AGENT_API_URL = "https://service.example.test";
    process.env.NEXT_PUBLIC_ASYMPTA_TURNSTILE_SITE_KEY = "public-site-key";
    globalThis.window = { __ASYMPTA_NATIVE__: true };
    assert.equal(getPublicAgentConfig(), null);
    globalThis.window.__ASYMPTA_NATIVE__ = false;
    assert.equal(new URL(getPublicAgentConfig().endpoint).origin, "https://service.example.test");
  } finally {
    if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
    if (originalApi === undefined) delete process.env.NEXT_PUBLIC_ASYMPTA_AGENT_API_URL;
    else process.env.NEXT_PUBLIC_ASYMPTA_AGENT_API_URL = originalApi;
    if (originalSiteKey === undefined) delete process.env.NEXT_PUBLIC_ASYMPTA_TURNSTILE_SITE_KEY;
    else process.env.NEXT_PUBLIC_ASYMPTA_TURNSTILE_SITE_KEY = originalSiteKey;
  }
});

test("an actual app task restores after a new session without granting its missing human decision", () => {
  const original = globalThis.window;
  const persistent = new Map();
  const storage = map => ({ getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) });
  const session = () => ({ __ASYMPTA_NATIVE__: true, localStorage: storage(persistent), sessionStorage: storage(new Map()), dispatchEvent() {}, setTimeout, clearTimeout });
  try {
    globalThis.window = session();
    const first = new BrowserAsymptaTaskKernel();
    const task = first.createFromClarification({
      activityId: "native-reopen-test", rootIntent: "Buy a television", locale: "zh-Hant",
      missingFields: ["screen size"], mode: "simulated", confirmationRequired: true,
    });
    assert.equal(task.phase, "awaiting_human");
    globalThis.window = session();
    const reopened = new BrowserAsymptaTaskKernel().getTask(task.taskId);
    assert.deepEqual(reopened.rootIntent, task.rootIntent);
    assert.equal(reopened.phase, "awaiting_human");
    assert.equal(reopened.result, null);
    assert.deepEqual(reopened.requirements, task.requirements);
    assert.equal(reopened.approvals.some(approval => approval.status === "approved"), false);
  } finally {
    if (original === undefined) delete globalThis.window; else globalThis.window = original;
  }
});
