"use client";

import { Download, Globe2, MoreHorizontal, Share2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAsymptaGlobalLocale } from "./asympta-feature-locale";

type NativeMessage = { type: "share" | "export"; text: string } | { type: "locale"; locale: string } | { type: "connect" };

declare global {
  interface Window {
    __ASYMPTA_NATIVE__?: boolean;
    __ASYMPTA_NATIVE_LOCALE__?: string;
    webkit?: { messageHandlers?: { asympta?: { postMessage(message: NativeMessage): void } } };
  }
}

const COPY = {
  en: { menu: "App options", close: "Close options", local: "Schematic map · simulation", online: "Online map · simulated activity", share: "Share a summary", save: "Save activity", connect: "Online services", detail: "The world and simulations run on this device. Online services open separately and need an internet connection.", disclosure: "Simulated activity. No real purchases or deliveries.", empty: "Explore how people and agents coordinate in Asympta World.", failed: "Could not open this action. Please try again." },
  "zh-Hant": { menu: "App 選項", close: "關閉選項", local: "示意地圖・模擬世界", online: "線上地圖・模擬活動", share: "分享摘要", save: "儲存活動", connect: "線上服務", detail: "世界與模擬在此裝置執行。線上服務會另外開啟，需要網路連線。", disclosure: "此為模擬活動，沒有真實購買或配送。", empty: "在 Asympta World 探索人與代理如何協作。", failed: "無法開啟此操作，請再試一次。" },
  ja: { menu: "App オプション", close: "オプションを閉じる", local: "概略地図・シミュレーション", online: "オンライン地図・模擬アクティビティ", share: "概要を共有", save: "アクティビティを保存", connect: "オンラインサービス", detail: "世界とシミュレーションはこの端末で動作します。オンラインサービスは別に開き、インターネット接続が必要です。", disclosure: "模擬アクティビティです。実際の購入や配送は行いません。", empty: "Asympta World で人とエージェントの協力を体験。", failed: "操作を開けませんでした。もう一度お試しください。" },
};

export function AsymptaMobile() {
  const locale = useAsymptaGlobalLocale();
  const copy = COPY[locale];
  const [native, setNative] = useState(false);
  const [open, setOpen] = useState(false);
  const [map, setMap] = useState("local");
  const [error, setError] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.__ASYMPTA_NATIVE__) return;
    document.documentElement.dataset.asymptaNative = "true";
    queueMicrotask(() => setNative(true));
    const syncMap = () => setMap(document.documentElement.dataset.asymptaMobileMap ?? "local");
    const resize = () => {
      const viewport = window.visualViewport;
      const keyboard = Math.max(0, window.innerHeight - (viewport?.height ?? window.innerHeight) - (viewport?.offsetTop ?? 0));
      document.documentElement.style.setProperty("--asympta-native-keyboard", `${keyboard > 80 ? keyboard : 0}px`);
      document.documentElement.dataset.asymptaKeyboard = String(keyboard > 80);
    };
    queueMicrotask(syncMap);
    resize();
    window.addEventListener("asympta:mobile-map", syncMap);
    window.visualViewport?.addEventListener("resize", resize, { passive: true });
    window.visualViewport?.addEventListener("scroll", resize, { passive: true });
    window.addEventListener("resize", resize, { passive: true });
    return () => {
      window.removeEventListener("asympta:mobile-map", syncMap);
      window.visualViewport?.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("scroll", resize);
      window.removeEventListener("resize", resize);
    };
  }, []);

  useEffect(() => {
    if (native) window.webkit?.messageHandlers?.asympta?.postMessage({ type: "locale", locale });
  }, [locale, native]);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => { if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); root.current?.querySelector<HTMLButtonElement>("button")?.focus(); } };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", escape); };
  }, [open]);

  const send = (type: "share" | "export" | "connect") => {
    setError(false);
    const handler = window.webkit?.messageHandlers?.asympta;
    if (!handler) { setError(true); return; }
    try {
      if (type === "connect") handler.postMessage({ type });
      else {
        const activity = window.__ASYMPTA_TASK_KERNEL__?.activeTask();
        const text = type === "share"
          ? ["Asympta World", activity?.result?.summary || activity?.summary || copy.empty, copy.disclosure].join("\n\n").slice(0, 12_000)
          : JSON.stringify({ schema: "asympta.mobile-export/1", exportedAt: new Date().toISOString(), locale, simulated: true, activity: activity ?? null, world: window.__ASYMPTA_DEMO__?.snapshot() ?? null }, null, 2);
        if (text.length > 250_000) { setError(true); return; }
        handler.postMessage({ type, text });
      }
      setOpen(false);
    } catch { setError(true); }
  };

  if (!native) return null;
  return (
    <div className="asympta-mobile-options" ref={root}>
      <button className="asympta-mobile-options__toggle" type="button" aria-label={open ? copy.close : copy.menu} aria-expanded={open} aria-controls="asympta-mobile-menu" onClick={() => { setOpen((value) => !value); setError(false); }}>
        {open ? <X size={20} aria-hidden="true" /> : <MoreHorizontal size={22} aria-hidden="true" />}
      </button>
      {open ? <section id="asympta-mobile-menu" className="asympta-mobile-options__panel" aria-label={copy.menu}>
        <p className="asympta-mobile-options__status"><span aria-hidden="true" />{map === "online" ? copy.online : copy.local}</p>
        <button type="button" onClick={() => send("share")}><Share2 size={18} aria-hidden="true" />{copy.share}</button>
        <button type="button" onClick={() => send("export")}><Download size={18} aria-hidden="true" />{copy.save}</button>
        <button type="button" onClick={() => send("connect")}><Globe2 size={18} aria-hidden="true" />{copy.connect}</button>
        <p className="asympta-mobile-options__detail">{copy.detail}</p>
        {error ? <p role="alert" className="asympta-mobile-options__error">{copy.failed}</p> : null}
      </section> : null}
      {map !== "online" && !open ? <span className="asympta-mobile-map-note">{copy.local}</span> : null}
    </div>
  );
}
