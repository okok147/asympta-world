"use client";

import { LogOut, UserRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  ASYMPTA_AUTH_EVENT,
  readGoogleCredentialIdentity,
  readStoredGoogleSession,
  writeStoredGoogleSession,
  type AsymptaGoogleIdentity,
  type AsymptaGoogleSession,
} from "@/lib/asympta-auth";

type Locale = "en" | "zh-Hant" | "ja";
type GoogleCredentialResponse = { credential?: string };
type GoogleIdentityApi = {
  initialize(config: {
    client_id: string;
    callback(response: GoogleCredentialResponse): void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    context?: "signin" | "signup" | "use";
    ux_mode?: "popup" | "redirect";
  }): void;
  renderButton(parent: HTMLElement, options: {
    theme: "outline" | "filled_blue" | "filled_black";
    size: "large" | "medium" | "small";
    type?: "standard" | "icon";
    shape?: "rectangular" | "pill" | "circle" | "square";
    text?: "signin_with" | "signup_with" | "continue_with" | "signin";
    logo_alignment?: "left" | "center";
    width?: number;
  }): void;
  disableAutoSelect(): void;
};
type GoogleGlobal = { accounts: { id: GoogleIdentityApi } };
type AsymptaAuthBridge = {
  snapshot(): AsymptaGoogleIdentity | null;
  getIdToken(): string | null;
  getUserKey(): string | null;
  signOut(): void;
};
type AuthWindow = Window & {
  google?: GoogleGlobal;
  __ASYMPTA_AUTH__?: AsymptaAuthBridge;
};

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? "";
const GIS_SCRIPT = "https://accounts.google.com/gsi/client";
const MENU_BAR_SELECTOR = ".atlas-menu-bar";
const AUTH_HOST_ATTRIBUTE = "data-asympta-auth-host";

const COPY: Record<Locale, {
  account: string;
  signedIn: string;
  signOut: string;
  loading: string;
  missing: string;
  failed: string;
  description: string;
}> = {
  en: {
    account: "Account",
    signedIn: "Signed in",
    signOut: "Sign out",
    loading: "Loading Google…",
    missing: "Google login is not configured on this deployment.",
    failed: "Google sign-in could not be validated.",
    description: "One identity for your agents and model access.",
  },
  "zh-Hant": {
    account: "帳戶",
    signedIn: "已登入",
    signOut: "登出",
    loading: "正在載入 Google…",
    missing: "此部署尚未設定 Google 登入。",
    failed: "無法驗證 Google 登入。",
    description: "讓你的代理與模型存取共用同一身份。",
  },
  ja: {
    account: "アカウント",
    signedIn: "ログイン済み",
    signOut: "ログアウト",
    loading: "Google を読み込み中…",
    missing: "この環境では Google ログインが未設定です。",
    failed: "Google ログインを検証できませんでした。",
    description: "エージェントとモデルアクセスに一つのIDを使用します。",
  },
};

function localeFromDocument(): Locale {
  const value = document.documentElement.lang.toLowerCase();
  if (value.startsWith("zh")) return "zh-Hant";
  if (value.startsWith("ja")) return "ja";
  return "en";
}

function initials(identity: AsymptaGoogleIdentity) {
  const parts = identity.name.split(/\s+/).filter(Boolean);
  const value = parts.length > 1 ? `${parts[0][0] ?? ""}${parts.at(-1)?.[0] ?? ""}` : identity.name.slice(0, 2);
  return value.toUpperCase() || "A";
}

function authWindow() {
  return window as AuthWindow;
}

export function AsymptaGoogleLogin() {
  const [locale, setLocale] = useState<Locale>("en");
  const [open, setOpen] = useState(false);
  const [gisReady, setGisReady] = useState(false);
  const [gisFailed, setGisFailed] = useState(false);
  const [session, setSession] = useState<AsymptaGoogleSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const buttonHostRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<AsymptaGoogleSession | null>(null);
  const copy = COPY[locale];

  const publishSession = useCallback((next: AsymptaGoogleSession | null) => {
    sessionRef.current = next;
    setSession(next);
    try { writeStoredGoogleSession(window.sessionStorage, next); } catch {}
    window.dispatchEvent(new CustomEvent(ASYMPTA_AUTH_EVENT, { detail: next?.identity ?? null }));
  }, []);

  const signOut = useCallback(() => {
    try { authWindow().google?.accounts.id.disableAutoSelect(); } catch {}
    publishSession(null);
    setOpen(false);
    setError(null);
  }, [publishSession]);

  const handleCredential = useCallback((response: GoogleCredentialResponse) => {
    const credential = response.credential ?? "";
    const identity = readGoogleCredentialIdentity(credential, GOOGLE_CLIENT_ID);
    if (!identity) {
      setError(COPY[localeFromDocument()].failed);
      return;
    }
    setError(null);
    publishSession({ credential, identity });
    setOpen(false);
  }, [publishSession]);

  useEffect(() => {
    let frame = 0;
    let attempts = 0;
    let ownedHost: HTMLElement | null = null;

    const attach = () => {
      const menuBar = document.querySelector<HTMLElement>(MENU_BAR_SELECTOR);
      if (!menuBar) {
        if (attempts++ < 60) frame = window.requestAnimationFrame(attach);
        return;
      }

      const existing = menuBar.querySelector<HTMLElement>(`[${AUTH_HOST_ATTRIBUTE}]`);
      const host = existing ?? document.createElement("div");
      if (!existing) {
        host.className = "asympta-auth-anchor";
        host.setAttribute(AUTH_HOST_ATTRIBUTE, "true");
        const collapseButton = menuBar.lastElementChild;
        if (collapseButton) menuBar.insertBefore(host, collapseButton);
        else menuBar.appendChild(host);
        ownedHost = host;
      }
      setPortalHost(host);
    };

    attach();
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      ownedHost?.remove();
    };
  }, []);

  useEffect(() => {
    setLocale(localeFromDocument());
    const observer = new MutationObserver(() => setLocale(localeFromDocument()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const restored = readStoredGoogleSession(window.sessionStorage, GOOGLE_CLIENT_ID);
    if (restored) publishSession(restored);
  }, [publishSession]);

  useEffect(() => {
    const api = authWindow();
    api.__ASYMPTA_AUTH__ = {
      snapshot: () => sessionRef.current?.identity ?? null,
      getIdToken: () => sessionRef.current?.credential ?? null,
      getUserKey: () => sessionRef.current?.identity.userId ?? null,
      signOut,
    };
    return () => { delete api.__ASYMPTA_AUTH__; };
  }, [signOut]);

  useEffect(() => {
    if (!session) return;
    const remaining = session.identity.expiresAt - Date.now();
    if (remaining <= 0) {
      signOut();
      return;
    }
    const timer = window.setTimeout(signOut, remaining);
    return () => window.clearTimeout(timer);
  }, [session, signOut]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const existingApi = authWindow().google?.accounts.id;
    if (existingApi) {
      setGisReady(true);
      return;
    }

    let script = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SCRIPT}"]`);
    const ready = () => {
      const available = Boolean(authWindow().google?.accounts.id);
      setGisReady(available);
      setGisFailed(!available);
    };
    const failed = () => {
      setGisReady(false);
      setGisFailed(true);
    };
    if (!script) {
      script = document.createElement("script");
      script.src = GIS_SCRIPT;
      script.async = true;
      script.defer = true;
      script.dataset.asymptaGoogleIdentity = "true";
      document.head.appendChild(script);
    }
    script.addEventListener("load", ready);
    script.addEventListener("error", failed);
    return () => {
      script?.removeEventListener("load", ready);
      script?.removeEventListener("error", failed);
    };
  }, []);

  useEffect(() => {
    const google = authWindow().google?.accounts.id;
    const host = buttonHostRef.current;
    if (!open || !gisReady || !google || !host || !GOOGLE_CLIENT_ID || session) return;

    host.replaceChildren();
    google.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleCredential,
      auto_select: false,
      cancel_on_tap_outside: true,
      context: "signin",
      ux_mode: "popup",
    });
    google.renderButton(host, {
      theme: "outline",
      size: "large",
      type: "standard",
      shape: "pill",
      text: "continue_with",
      logo_alignment: "left",
      width: 248,
    });
  }, [gisReady, handleCredential, open, session]);

  useEffect(() => {
    if (!open || !portalHost) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!portalHost.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, portalHost]);

  const identity = session?.identity ?? null;
  const label = identity ? identity.name : copy.account;
  const status = useMemo(() => identity ? `${copy.signedIn} · ${identity.email}` : copy.description, [copy, identity]);

  if (!portalHost) return null;

  return createPortal(
    <>
      <button
        type="button"
        className={`atlas-quick-icon asympta-auth-trigger${identity ? " is-authenticated" : ""}`}
        aria-label={label}
        aria-expanded={open}
        title={label}
        onClick={() => setOpen((value) => !value)}
      >
        {identity ? <span className="asympta-auth-initials" aria-hidden="true">{initials(identity)}</span> : <UserRound size={17} strokeWidth={1.7} />}
      </button>

      {open ? (
        <div className="asympta-auth-popover" role="dialog" aria-label={copy.account}>
          <div className="asympta-auth-copy">
            <small>{copy.account}</small>
            <strong>{identity?.name ?? "Asympta"}</strong>
            <span>{status}</span>
          </div>

          {identity ? (
            <button type="button" className="asympta-auth-signout" onClick={signOut}>
              <LogOut size={14} strokeWidth={1.7} />
              <span>{copy.signOut}</span>
            </button>
          ) : GOOGLE_CLIENT_ID ? (
            <>
              <div ref={buttonHostRef} className="asympta-google-button" />
              {!gisReady && !gisFailed ? <p className="asympta-auth-note">{copy.loading}</p> : null}
              {gisFailed || error ? <p className="asympta-auth-note is-error">{error ?? copy.failed}</p> : null}
            </>
          ) : (
            <p className="asympta-auth-note">{copy.missing}</p>
          )}
        </div>
      ) : null}
    </>,
    portalHost,
  );
}
