import type { AsymptaProtocolConfig } from "./asympta-protocol-runtime.ts";

const STORAGE_KEY = "asympta.protocol-peers.v1";

function cleanUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function safeConfig(value: unknown): AsymptaProtocolConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { mcp: [], a2a: [] };
  const record = value as Record<string, unknown>;
  const parsePeers = (peers: unknown) => Array.isArray(peers)
    ? peers.flatMap((peer) => {
      if (!peer || typeof peer !== "object" || Array.isArray(peer)) return [];
      const item = peer as Record<string, unknown>;
      const url = typeof item.url === "string" ? cleanUrl(item.url) : null;
      if (!url) return [];
      return [{ url, name: typeof item.name === "string" ? item.name : undefined }];
    })
    : [];
  return { mcp: parsePeers(record.mcp), a2a: parsePeers(record.a2a) };
}

export function readBrowserProtocolConfig(): AsymptaProtocolConfig {
  let stored: AsymptaProtocolConfig = { mcp: [], a2a: [] };
  try {
    stored = safeConfig(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null"));
  } catch {}

  const params = new URLSearchParams(window.location.search);
  const queryMcp = params.getAll("mcp").flatMap((value) => {
    const url = cleanUrl(value);
    return url ? [{ url }] : [];
  });
  const queryA2A = params.getAll("a2a").flatMap((value) => {
    const url = cleanUrl(value);
    return url ? [{ url }] : [];
  });

  return {
    mcp: queryMcp.length ? queryMcp : stored.mcp,
    a2a: queryA2A.length ? queryA2A : stored.a2a,
  };
}

export function storeBrowserProtocolConfig(config: AsymptaProtocolConfig) {
  const safe = safeConfig(config);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
  return safe;
}

export function clearBrowserProtocolConfig() {
  window.localStorage.removeItem(STORAGE_KEY);
}
