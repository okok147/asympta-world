export const ASYMPTA_AUTH_EVENT = "asympta:auth-changed";
export const ASYMPTA_AUTH_SESSION_KEY = "asympta-world.auth.google.v1";

export type AsymptaGoogleIdentity = {
  provider: "google";
  userId: string;
  subject: string;
  email: string;
  name: string;
  picture: string | null;
  expiresAt: number;
};

export type AsymptaGoogleSession = {
  credential: string;
  identity: AsymptaGoogleIdentity;
};

type GoogleCredentialClaims = {
  aud?: string | string[];
  email?: string;
  email_verified?: boolean;
  exp?: number;
  iss?: string;
  name?: string;
  picture?: string;
  sub?: string;
};

function decodeBase64UrlJson(value: string): unknown {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = globalThis.atob(`${normalized}${padding}`);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

/**
 * Reads the public claims used to establish client UI identity.
 *
 * This is deliberately NOT a server authorization check: the browser cannot
 * establish trust in an ID token by decoding it. Any OpenRouter gateway or
 * other real-world action backend must cryptographically verify the original
 * Google ID token before accepting identity, budget, permissions, or actions.
 */
export function readGoogleCredentialIdentity(
  credential: string,
  clientId: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): AsymptaGoogleIdentity | null {
  if (!credential || !clientId) return null;
  const parts = credential.split(".");
  if (parts.length !== 3) return null;

  try {
    const claims = decodeBase64UrlJson(parts[1]) as GoogleCredentialClaims;
    const audience = Array.isArray(claims.aud) ? claims.aud : claims.aud ? [claims.aud] : [];
    const issuerOk = claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com";
    const expiryOk = typeof claims.exp === "number" && claims.exp > nowSeconds;
    const email = typeof claims.email === "string" ? claims.email.trim() : "";
    const name = typeof claims.name === "string" ? claims.name.trim() : "";
    const subject = typeof claims.sub === "string" ? claims.sub.trim() : "";

    if (!issuerOk || !expiryOk || !audience.includes(clientId) || !subject || !email || claims.email_verified === false) {
      return null;
    }

    return {
      provider: "google",
      userId: `google:${subject}`,
      subject,
      email,
      name: name || email.split("@")[0] || "Asympta user",
      picture: typeof claims.picture === "string" && claims.picture ? claims.picture : null,
      expiresAt: claims.exp * 1000,
    };
  } catch {
    return null;
  }
}

export function readStoredGoogleSession(storage: Storage, clientId: string): AsymptaGoogleSession | null {
  try {
    const raw = storage.getItem(ASYMPTA_AUTH_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { credential?: unknown };
    if (typeof parsed.credential !== "string") return null;
    const identity = readGoogleCredentialIdentity(parsed.credential, clientId);
    if (!identity) {
      storage.removeItem(ASYMPTA_AUTH_SESSION_KEY);
      return null;
    }
    return { credential: parsed.credential, identity };
  } catch {
    return null;
  }
}

export function writeStoredGoogleSession(storage: Storage, session: AsymptaGoogleSession | null) {
  try {
    if (!session) {
      storage.removeItem(ASYMPTA_AUTH_SESSION_KEY);
      return;
    }
    storage.setItem(ASYMPTA_AUTH_SESSION_KEY, JSON.stringify({ credential: session.credential }));
  } catch {}
}
