"use client";

import { useEffect, useSyncExternalStore } from "react";

type Locale = "en" | "zh-Hant" | "ja";
type LocaleRow = [string, string, string];

const STATIC_ROWS: LocaleRow[] = [
  ["Asympta World mode", "Asympta World 模式", "Asympta World モード"],
  ["Users", "使用者", "ユーザー"],
  ["Business", "商業", "ビジネス"],
  ["Business agent workspace", "商業代理工作區", "ビジネスエージェント・ワークスペース"],
  ["Business workspace sections", "商業工作區分頁", "ビジネス・ワークスペースのセクション"],
  ["Expand business workspace", "展開商業工作區", "ビジネス・ワークスペースを開く"],
  ["Collapse business workspace", "收起商業工作區", "ビジネス・ワークスペースを閉じる"],
  ["Business agent", "商業代理", "ビジネスエージェント"],
  ["Agent", "代理", "エージェント"],
  ["Products", "產品", "商品"],
  ["LIVE", "即時", "ライブ"],
  ["BUSINESS", "商業", "ビジネス"],
  ["CATALOG", "目錄", "カタログ"],
  ["Business Agent ↔ Customer Agent", "商業代理 ↔ 客戶代理", "ビジネスエージェント ↔ 顧客エージェント"],
  ["Local simulation", "本機模擬", "ローカル・シミュレーション"],
  ["Customer agent", "客戶代理", "顧客エージェント"],
  ["Needs business confirmation", "需要商家確認", "事業者の確認が必要"],
  ["Business information", "商家資訊", "事業者情報"],
  ["Import JSON / CSV", "匯入 JSON / CSV", "JSON / CSV を読み込む"],
  ["Business name", "商家名稱", "事業者名"],
  ["Category", "類別", "カテゴリー"],
  ["Description", "說明", "説明"],
  ["Location", "位置", "所在地"],
  ["Contact", "聯絡方式", "連絡先"],
  ["Opening hours", "營業時間", "営業時間"],
  ["No catalog imported yet", "尚未匯入產品目錄", "商品カタログはまだ読み込まれていません"],
  ["No description imported", "未匯入說明", "説明は読み込まれていません"],
  ["Price unknown", "價格未確認", "価格未確認"],
  ["Use JSON or CSV with name, description, price, currency and availability fields.", "請使用包含名稱、說明、價格、貨幣與供應狀態欄位的 JSON 或 CSV。", "名称・説明・価格・通貨・在庫状況の項目を含む JSON または CSV を使用してください。"],
  ["The map stays alive while this business agent answers customer agents from imported facts only.", "地圖會持續運作；商業代理只會根據已匯入的事實回覆客戶代理。", "マップは動き続け、ビジネスエージェントは読み込まれた事実だけを根拠に顧客エージェントへ回答します。"],
  ["Run communication", "執行通訊", "通信を実行"],
  ["Customer agent: Do you have the sourdough loaf in stock?", "客戶代理：酸種麵包目前有現貨嗎？", "顧客エージェント：サワードウブレッドの在庫はありますか？"],
  ["Example: Harbour Bakery", "例如：Harbour Bakery", "例：Harbour Bakery"],
  ["Bakery, retail, services…", "烘焙、零售、服務……", "ベーカリー、小売、サービス…"],
  ["What the business does and what customers should know.", "商家提供甚麼，以及客戶需要知道的資訊。", "事業内容と、顧客が知っておくべき情報。"],
  ["Shop / service location", "店舖／服務地點", "店舗／サービス所在地"],
  ["Phone or public contact", "電話或公開聯絡方式", "電話番号または公開連絡先"],
  ["Mon–Fri 09:00–18:00", "星期一至五 09:00–18:00", "月〜金 09:00–18:00"],
  ["Business information could not be imported.", "無法匯入商家資訊。", "事業者情報を読み込めませんでした。"],
  ["Product information could not be imported.", "無法匯入產品資訊。", "商品情報を読み込めませんでした。"],
  ["Business information must be a JSON object.", "商家資訊必須是 JSON 物件。", "事業者情報は JSON オブジェクトである必要があります。"],
];

const KNOWN = new Map<string, LocaleRow>();
for (const row of STATIC_ROWS) for (const value of row) KNOWN.set(value, row);
const SOURCE_BY_NODE = new WeakMap<Text, string>();
const SOURCE_BY_ATTRIBUTE = new WeakMap<Element, Map<string, string>>();
const ROOT_SELECTORS = [
  'nav[aria-label="Asympta World mode"], nav[aria-label="Asympta World 模式"], nav[aria-label="Asympta World モード"]',
  '[data-asympta-business-world="true"]',
];
const TRANSLATABLE_ATTRIBUTE_SELECTOR = "[aria-label], [title], [placeholder]";
const TRANSLATABLE_ATTRIBUTES = ["aria-label", "title", "placeholder"] as const;

function localeFromDocument(): Locale {
  const value = document.documentElement.lang.toLowerCase();
  if (value.startsWith("zh")) return "zh-Hant";
  if (value.startsWith("ja")) return "ja";
  return "en";
}

function localeIndex(locale: Locale) {
  return locale === "en" ? 0 : locale === "zh-Hant" ? 1 : 2;
}

function rememberAttributeSource(node: Element, name: string, raw: string, row: LocaleRow) {
  const knownSource = KNOWN.get(raw)?.[0] ?? row[0];
  const sources = SOURCE_BY_ATTRIBUTE.get(node) ?? new Map<string, string>();
  sources.set(name, knownSource);
  SOURCE_BY_ATTRIBUTE.set(node, sources);
  return knownSource;
}

function translateAttributes(root: Element, index: number) {
  const nodes: Element[] = [];
  if (root.matches(TRANSLATABLE_ATTRIBUTE_SELECTOR)) nodes.push(root);
  root.querySelectorAll<HTMLElement>(TRANSLATABLE_ATTRIBUTE_SELECTOR).forEach((node) => nodes.push(node));

  nodes.forEach((node) => {
    for (const name of TRANSLATABLE_ATTRIBUTES) {
      const raw = node.getAttribute(name)?.trim();
      const remembered = SOURCE_BY_ATTRIBUTE.get(node)?.get(name);
      const row = raw ? KNOWN.get(raw) : undefined;
      const sourceRow = remembered ? KNOWN.get(remembered) : undefined;
      const translation = row ?? sourceRow;
      if (!translation) continue;
      rememberAttributeSource(node, name, raw ?? translation[0], translation);
      if (node.getAttribute(name) !== translation[index]) node.setAttribute(name, translation[index]);
    }
  });
}

function translateStatic(locale: Locale) {
  const index = localeIndex(locale);
  for (const selector of ROOT_SELECTORS) {
    document.querySelectorAll(selector).forEach((root) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let current = walker.nextNode(); current; current = walker.nextNode()) {
        const node = current as Text;
        const raw = node.nodeValue ?? "";
        const trimmed = raw.trim();
        if (!trimmed) continue;
        const source = SOURCE_BY_NODE.get(node);
        const row = KNOWN.get(trimmed) ?? (source ? KNOWN.get(source) : undefined);
        if (!row) continue;
        SOURCE_BY_NODE.set(node, row[0]);
        const start = raw.indexOf(trimmed);
        const next = `${raw.slice(0, start)}${row[index]}${raw.slice(start + trimmed.length)}`;
        if (node.nodeValue !== next) node.nodeValue = next;
      }

      translateAttributes(root, index);
    });
  }
}

function translateBusinessReply(source: string, locale: Locale) {
  if (locale === "en") return source;
  if (source === "I need the business profile before I can answer customers accurately.") {
    return locale === "zh-Hant"
      ? "我需要先取得商家資料，才能準確回覆客戶。"
      : "顧客へ正確に回答するには、まず事業者プロフィールが必要です。";
  }

  let match = source.match(/^(.+) has not imported opening hours yet\. A business operator should confirm before the agent answers\.$/);
  if (match) return locale === "zh-Hant"
    ? `${match[1]} 尚未匯入營業時間。商家人員確認後，代理才應作答。`
    : `${match[1]} は営業時間をまだ登録していません。エージェントが回答する前に事業者の確認が必要です。`;

  match = source.match(/^(.+) has not imported a location yet\. A business operator should confirm before the agent answers\.$/);
  if (match) return locale === "zh-Hant"
    ? `${match[1]} 尚未匯入位置。商家人員確認後，代理才應作答。`
    : `${match[1]} は所在地をまだ登録していません。エージェントが回答する前に事業者の確認が必要です。`;

  match = source.match(/^(.+) is at (.+)\.$/);
  if (match) return locale === "zh-Hant"
    ? `${match[1]} 位於 ${match[2]}。`
    : `${match[1]} の所在地は ${match[2]} です。`;

  match = source.match(/^(.+)'s imported catalog does not contain enough information to answer that reliably\. The business should confirm before the agent makes a promise\.$/);
  if (match) return locale === "zh-Hant"
    ? `${match[1]} 已匯入的產品目錄沒有足夠資料作可靠回覆。代理作出承諾前應由商家確認。`
    : `${match[1]} の読み込み済みカタログには、確実に回答できるだけの情報がありません。エージェントが約束する前に事業者の確認が必要です。`;

  match = source.match(/^(.+?): (.+?) (is available|is currently unavailable|has no confirmed availability status)\. (Price: (.+?)\.|Price has not been imported\.)(.*)$/);
  if (match) {
    const [, business, product, availability, priceSentence, price, tail] = match;
    const availabilityText = locale === "zh-Hant"
      ? availability === "is available" ? "現有供應" : availability === "is currently unavailable" ? "目前缺貨" : "尚未確認供應狀態"
      : availability === "is available" ? "在庫あり" : availability === "is currently unavailable" ? "現在在庫なし" : "在庫状況未確認";
    const priceText = priceSentence.startsWith("Price:")
      ? locale === "zh-Hant" ? `價格：${price}。` : `価格：${price}。`
      : locale === "zh-Hant" ? "價格尚未匯入。" : "価格はまだ登録されていません。";
    return locale === "zh-Hant"
      ? `${business}：${product}${availabilityText}。${priceText}${tail}`
      : `${business}：${product}は${availabilityText}。${priceText}${tail}`;
  }

  match = source.match(/^(.+?): (.+)$/);
  if (match) return `${match[1]}：${match[2]}`;
  return source;
}

function translateDynamicBusiness(locale: Locale) {
  const root = document.querySelector<HTMLElement>('[data-asympta-business-world="true"]');
  if (!root) return;

  const subtitle = root.querySelector<HTMLElement>(".atlas-agent-card__top small");
  if (subtitle) {
    const raw = subtitle.textContent?.trim() ?? "";
    if (raw.startsWith("Business lens · same living world ·")) subtitle.dataset.asymptaBusinessSource = raw;
    const source = subtitle.dataset.asymptaBusinessSource ?? raw;
    const countMatch = raw.match(/(\d+)/);
    const sourceMatch = source.match(/^Business lens · same living world · (\d+) available$/);
    const count = countMatch?.[1] ?? sourceMatch?.[1];
    if (count) {
      subtitle.dataset.asymptaBusinessSource = `Business lens · same living world · ${count} available`;
      const translated = locale === "zh-Hant"
        ? `商業視角 · 同一個協作世界 · ${count} 項可供應`
        : locale === "ja"
          ? `ビジネス視点 · 同じ協調世界 · ${count} 件利用可能`
          : `Business lens · same living world · ${count} available`;
      if (subtitle.textContent !== translated) subtitle.textContent = translated;
      if (subtitle.lang !== locale) subtitle.lang = locale;
    }
  }

  root.querySelectorAll<HTMLElement>('[data-availability]').forEach((node) => {
    const availability = node.dataset.availability;
    const translated = locale === "zh-Hant"
      ? availability === "available" ? "有供應" : availability === "unavailable" ? "缺貨" : "未確認"
      : locale === "ja"
        ? availability === "available" ? "在庫あり" : availability === "unavailable" ? "在庫なし" : "未確認"
        : availability ?? "unknown";
    if (node.textContent !== translated) node.textContent = translated;
    if (node.lang !== locale) node.lang = locale;
  });

  root.querySelectorAll<HTMLElement>('article[class*="businessMessage"] p').forEach((node) => {
    const raw = node.textContent?.trim() ?? "";
    if (!node.dataset.asymptaBusinessSource || /\b(is available|is currently unavailable|has no confirmed availability status|has not imported|imported catalog|I need the business profile| is at )\b/.test(raw)) {
      if (locale === "en" || !node.dataset.asymptaBusinessSource) node.dataset.asymptaBusinessSource = raw;
    }
    const source = node.dataset.asymptaBusinessSource ?? raw;
    const translated = translateBusinessReply(source, locale);
    if (node.textContent !== translated) node.textContent = translated;
    if (node.lang !== locale) node.lang = locale;
  });
}

export function AsymptaFeatureLocale() {
  useEffect(() => {
    let frame = 0;
    let hasAppliedNonEnglish = false;

    const sync = () => {
      frame = 0;
      if (document.hidden) return;
      const locale = localeFromDocument();

      // English is the React source language. Stay completely inert in the default
      // English state so localization never competes with ordinary feature renders.
      // After another locale has been applied, English runs exactly once to restore
      // translated nodes and then becomes inert again.
      if (locale === "en" && !hasAppliedNonEnglish) return;

      translateStatic(locale);
      translateDynamicBusiness(locale);
      hasAppliedNonEnglish = locale !== "en";
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(sync);
    };

    queueMicrotask(sync);
    const timer = window.setInterval(sync, 500);
    const observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

    const events = [
      "asympta:audience-mode",
      "asympta:business-profile-updated",
      "asympta:business-catalog-updated",
      "asympta:business-agent-message",
    ] as const;
    events.forEach((name) => window.addEventListener(name, schedule));

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.clearInterval(timer);
      observer.disconnect();
      events.forEach((name) => window.removeEventListener(name, schedule));
    };
  }, []);

  return null;
}

// Shared React access to the same document language used by every existing feature.
function subscribeLocale(listener: () => void) {
  const observer = new MutationObserver(listener);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  return () => observer.disconnect();
}
export function useAsymptaGlobalLocale() {
  return useSyncExternalStore(subscribeLocale, localeFromDocument, (): Locale => "en");
}
