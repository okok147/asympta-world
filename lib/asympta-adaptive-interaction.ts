export type AdaptiveInteractionLocale = "en" | "zh-Hant" | "ja";

export type AdaptiveAnswerValue = string | number | boolean;

export type AdaptiveInteractionOption = {
  value: AdaptiveAnswerValue;
  label: string;
  description?: string;
};

export type AdaptiveInteractionField = {
  id: string;
  sourceField: string;
  key: string;
  label: string;
  prompt: string;
  reason: string;
  control: "single_choice" | "text" | "number" | "boolean";
  options: AdaptiveInteractionOption[];
  allowCustom: boolean;
  customPlaceholder?: string;
  required: true;
  sensitive: false;
};

export type AdaptiveInteractionSchema = {
  schemaVersion: "asympta.adaptive-ui.v1";
  interactionId: string;
  intent: string;
  fields: AdaptiveInteractionField[];
  nextField: AdaptiveInteractionField | null;
  provenance: {
    source: "agent_missing_fields";
    mode: "runtime_schema";
    factPolicy: "unknown_until_user_confirmation";
    createdAt: string;
  };
};

export type AdaptiveConfirmation = {
  field: string;
  label: string;
  value: AdaptiveAnswerValue;
};

type FieldKind =
  | "event_intent"
  | "budget"
  | "screen_size"
  | "size"
  | "brand"
  | "purchase_location"
  | "purpose"
  | "fulfilment"
  | "quantity"
  | "deadline"
  | "colour"
  | "boolean"
  | "generic";

type PreparedField = {
  raw: string;
  normalized: string;
};

type LocaleCopy = {
  decide: string;
  custom: string;
  notSure: string;
  customPlaceholder: string;
  reason: string;
  continueRule: string;
  eventReason: string;
  eventPlaceholder: string;
  eventContinueRule: string;
  labels: Record<FieldKind, string>;
  prompts: Record<FieldKind, string>;
};

const COPY: Record<AdaptiveInteractionLocale, LocaleCopy> = {
  en: {
    decide: "Let Asympta choose",
    custom: "Something else",
    notSure: "Not sure yet",
    customPlaceholder: "Type your preference…",
    reason: "This is the next detail needed before the task can continue safely.",
    continueRule: "Continue the same task using these user-confirmed details. Keep every other required fact unknown until it is confirmed, and ask only for the next necessary detail.",
    eventReason: "Start with the show preference. Date, time and venue should come from the available performances instead of being typed one by one.",
    eventPlaceholder: "Enter an artist, band, or concert…",
    eventContinueRule: "Search the available performances for this show preference before asking anything else. Treat date, time, venue and city as properties of the returned performance choices; present those choices to the user instead of asking them to type each field. Keep payment and any explicit spending limit unresolved until a purchase is ready.",
    labels: {
      event_intent: "Show preference",
      budget: "Budget",
      screen_size: "Screen size",
      size: "Size",
      brand: "Brand",
      purchase_location: "Where to buy",
      purpose: "Main use",
      fulfilment: "Delivery",
      quantity: "Quantity",
      deadline: "When you need it",
      colour: "Colour",
      boolean: "Confirmation",
      generic: "One more detail",
    },
    prompts: {
      event_intent: "Which artist or concert would you like to see?",
      budget: "What kind of budget should I work with?",
      screen_size: "What screen size feels right?",
      size: "What size do you need?",
      brand: "Do you have a brand preference?",
      purchase_location: "Where should I look first?",
      purpose: "What will you mainly use it for?",
      fulfilment: "How should it reach you?",
      quantity: "How many do you need?",
      deadline: "How soon do you need it?",
      colour: "Which colour do you prefer?",
      boolean: "Which option should I use?",
      generic: "What should I know about this detail?",
    },
  },
  "zh-Hant": {
    decide: "讓 Asympta 判斷",
    custom: "其他",
    notSure: "暫時不確定",
    customPlaceholder: "輸入你的偏好…",
    reason: "這是目前繼續任務前下一項真正需要的資料。",
    continueRule: "請使用以上由使用者確認的資料繼續同一任務；其他必要但未確認的事實必須保持未知，只詢問下一項必要資料。",
    eventReason: "先確認演出意向；日期、時間和地點應由找到的實際場次提供，不需要逐項手動填寫。",
    eventPlaceholder: "輸入歌手、樂隊或演唱會名稱…",
    eventContinueRule: "請先按這個演出意向搜尋可用場次，再詢問其他資料。日期、時間、場館與城市應視為場次結果的屬性，請把實際場次列成選項讓使用者選擇，不要要求使用者逐項輸入。付款授權及明確消費上限應保持未確認，直至準備購買時才處理。",
    labels: {
      event_intent: "想看的演出",
      budget: "預算",
      screen_size: "螢幕尺寸",
      size: "尺寸",
      brand: "品牌",
      purchase_location: "購買方式",
      purpose: "主要用途",
      fulfilment: "送達方式",
      quantity: "數量",
      deadline: "需要時間",
      colour: "顏色",
      boolean: "確認",
      generic: "再補充一項資料",
    },
    prompts: {
      event_intent: "你想看哪位歌手或哪個演唱會？",
      budget: "希望我以哪種預算方向尋找？",
      screen_size: "你比較想要哪個螢幕尺寸？",
      size: "你需要哪個尺寸？",
      brand: "你有品牌偏好嗎？",
      purchase_location: "希望我先從哪裏尋找？",
      purpose: "主要會用來做甚麼？",
      fulfilment: "希望怎樣送到你手上？",
      quantity: "你需要多少？",
      deadline: "你幾時需要？",
      colour: "你偏好甚麼顏色？",
      boolean: "你希望使用哪個選項？",
      generic: "這項資料你希望怎樣設定？",
    },
  },
  ja: {
    decide: "Asympta に任せる",
    custom: "その他",
    notSure: "まだ決めていない",
    customPlaceholder: "希望を入力…",
    reason: "安全にタスクを続けるために、次に必要な情報です。",
    continueRule: "ユーザーが確認した情報だけを使って同じタスクを続けてください。ほかの必須情報は確認されるまで不明のままにし、次に必要な一項目だけを尋ねてください。",
    eventReason: "まず公演の希望を確認します。日付、時刻、会場は利用可能な公演候補から選び、個別入力させないでください。",
    eventPlaceholder: "アーティスト、バンド、公演名を入力…",
    eventContinueRule: "この公演希望に合う利用可能な公演を先に検索してください。日付、時刻、会場、都市は公演候補の属性として扱い、ユーザーに個別入力を求めず、実際の候補から選べるようにしてください。支払い承認と明確な上限金額は購入準備が整うまで未確認のままにしてください。",
    labels: {
      event_intent: "見たい公演",
      budget: "予算",
      screen_size: "画面サイズ",
      size: "サイズ",
      brand: "ブランド",
      purchase_location: "購入先",
      purpose: "主な用途",
      fulfilment: "受取方法",
      quantity: "数量",
      deadline: "必要な時期",
      colour: "色",
      boolean: "確認",
      generic: "もう一つの情報",
    },
    prompts: {
      event_intent: "どのアーティスト、または公演を見たいですか？",
      budget: "どの予算感で探しますか？",
      screen_size: "どの画面サイズがよいですか？",
      size: "どのサイズが必要ですか？",
      brand: "ブランドの希望はありますか？",
      purchase_location: "どこから探しますか？",
      purpose: "主な用途は何ですか？",
      fulfilment: "どのように受け取りますか？",
      quantity: "いくつ必要ですか？",
      deadline: "いつまでに必要ですか？",
      colour: "希望の色はありますか？",
      boolean: "どちらにしますか？",
      generic: "この項目をどう設定しますか？",
    },
  },
};

const TV_INTENT_PATTERN = /(?:\btv\b|\btelevision\b|smart\s*tv|電視機?|电视机?|テレビ)/iu;
const LIVE_EVENT_INTENT_PATTERN = /(?:concert|live\s*(?:show|music)|gig|music\s*festival|演唱會|演唱会|音樂會|音乐会|コンサート|音楽ライブ)/iu;
const EVENT_IDENTITY_FIELD_PATTERN = /(?:event(?:_?(?:name|intent))?|show|concert|artist|singer|band|act|演出|演唱會|演唱会|音樂會|音乐会|歌手|樂隊|乐队|藝人|艺人|公演名|アーティスト|バンド|ライブ名|コンサート名)/u;
const EVENT_SCHEDULE_FIELD_PATTERN = /(?:performance|date|time|datetime|schedule|session|performance_?date|venue|location|city|場次|场次|日期|時間|时间|地點|地点|場地|场地|場館|场馆|城市|日時|日付|時刻|会場|場所|開催地)/u;
const TICKET_QUANTITY_FIELD_PATTERN = /(?:quantity|ticket_?count|number_?of_?tickets|tickets?|張數|张数|票數|票数|數量|数量|枚数)/u;
const EVENT_INTENT_KEY = "event_intent";
const EVENT_INTENT_SOURCE_FIELD = "event intent";

function normalizedLocale(locale: string | undefined): AdaptiveInteractionLocale {
  const value = (locale ?? "en").toLowerCase();
  if (value.startsWith("zh")) return "zh-Hant";
  if (value.startsWith("ja")) return "ja";
  return "en";
}

function cleanField(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s./-]+/g, "_")
    .replace(/[^\p{L}\p{N}_]+/gu, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function fieldParts(missingFields: string[]) {
  return missingFields
    .flatMap((field) => field.split(/[,，、;；]+/u))
    .map((field) => field.trim())
    .filter(Boolean);
}

export function normalizeAdaptiveMissingFields(missingFields: string[]) {
  const seen = new Set<string>();
  const result: PreparedField[] = [];
  for (const raw of fieldParts(missingFields)) {
    const normalized = cleanField(raw);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push({ raw, normalized });
  }
  return result;
}

function fieldMatches(field: PreparedField, pattern: RegExp) {
  pattern.lastIndex = 0;
  const normalizedMatch = pattern.test(field.normalized);
  pattern.lastIndex = 0;
  return normalizedMatch || pattern.test(field.raw.toLowerCase());
}

function hasExplicitSingleTicketQuantity(intent: string) {
  return /(?:\b(?:a|an|one|1)\s+(?:concert\s+|event\s+|show\s+)?ticket\b|(?:一|1)\s*(?:張|张|枚)\s*(?:演唱會|演唱会|音樂會|音乐会|門票|门票|票|チケット)?)/iu.test(intent);
}

export function planAdaptiveMissingFields(input: {
  intent: string;
  missingFields: string[];
}) {
  const normalized = normalizeAdaptiveMissingFields(input.missingFields);
  if (!LIVE_EVENT_INTENT_PATTERN.test(input.intent)) return normalized;

  const eventIdentityMissing = normalized.some((field) => fieldMatches(field, EVENT_IDENTITY_FIELD_PATTERN));
  if (!eventIdentityMissing) return normalized;

  const explicitSingleQuantity = hasExplicitSingleTicketQuantity(input.intent);
  const remaining = normalized.filter((field) => {
    if (fieldMatches(field, EVENT_IDENTITY_FIELD_PATTERN)) return false;
    if (fieldMatches(field, EVENT_SCHEDULE_FIELD_PATTERN)) return false;
    if (explicitSingleQuantity && fieldMatches(field, TICKET_QUANTITY_FIELD_PATTERN)) return false;
    return true;
  });

  return [
    { raw: EVENT_INTENT_SOURCE_FIELD, normalized: EVENT_INTENT_KEY },
    ...remaining,
  ];
}

function classifyField(field: string, intent: string): FieldKind {
  const normalized = cleanField(field);
  const television = TV_INTENT_PATTERN.test(intent);

  if (normalized === EVENT_INTENT_KEY) return "event_intent";
  if (/(?:budget|price_range|max_price|spend|預算|预算|価格|予算)/u.test(normalized)) return "budget";
  if (television && /(?:screen_?size|display_?size|inch|尺寸|大小|画面|インチ|size)/u.test(normalized)) return "screen_size";
  if (/(?:brand|maker|manufacturer|品牌|牌子|メーカー|ブランド)/u.test(normalized)) return "brand";
  if (/(?:purchase_?location|buy_?where|store_?preference|shop|location|購買地點|购买地点|購買方式|購入先|店舗)/u.test(normalized)) return "purchase_location";
  if (/(?:use_?case|purpose|usage|用途|使用目的)/u.test(normalized)) return "purpose";
  if (/(?:fulfil|fulfill|delivery|pickup|shipping|receive|配送|送貨|送货|取貨|取货|受取)/u.test(normalized)) return "fulfilment";
  if (/(?:quantity|count|amount|張數|张数|票數|票数|數量|数量|個数|枚数)/u.test(normalized)) return "quantity";
  if (/(?:deadline|timeframe|when|due|needed_?by|幾時|时间|時間|期限|いつ)/u.test(normalized)) return "deadline";
  if (/(?:colour|color|顏色|颜色|色)/u.test(normalized)) return "colour";
  if (/(?:yes_?no|boolean|confirm|confirmation|是否|確認|确认)/u.test(normalized)) return "boolean";
  if (/(?:size|尺寸|尺碼|尺码|サイズ)/u.test(normalized)) return "size";
  return "generic";
}

function genericLabel(raw: string, locale: AdaptiveInteractionLocale) {
  const cleaned = raw.trim().replace(/[_-]+/g, " ");
  if (!cleaned) return COPY[locale].labels.generic;
  if (locale !== "en") return cleaned;
  return cleaned.replace(/\b\w/g, (character) => character.toUpperCase());
}

function option(value: AdaptiveAnswerValue, label: string, description?: string): AdaptiveInteractionOption {
  return {
    value,
    label,
    ...(description ? { description } : {}),
  };
}

function fieldOptions(kind: FieldKind, locale: AdaptiveInteractionLocale, intent: string): AdaptiveInteractionOption[] {
  const copy = COPY[locale];
  const television = TV_INTENT_PATTERN.test(intent);

  if (kind === "event_intent") {
    if (locale === "zh-Hant") {
      return [
        option("personalized_recommendation", "按我的喜好推薦", "由 Asympta 先找最適合你的演出"),
        option("hong_kong_popular", "香港近期熱門", "先看香港近期較熱門而且有票的場次"),
        option("any_available", "不限歌手，只看有票", "只篩選目前仍有可購門票的演出"),
      ];
    }
    if (locale === "ja") {
      return [
        option("personalized_recommendation", "好みに合わせて提案", "Asympta が希望に合う公演を先に探します"),
        option("hong_kong_popular", "香港で近日人気", "香港で近日開催され、購入可能な人気公演を優先します"),
        option("any_available", "出演者不問・購入可能のみ", "現在チケットを購入できる公演だけを表示します"),
      ];
    }
    return [
      option("personalized_recommendation", "Recommend from my preferences", "Let Asympta find the best-fitting shows first"),
      option("hong_kong_popular", "Popular soon in Hong Kong", "Prioritize popular Hong Kong performances with tickets"),
      option("any_available", "Any artist — only shows with tickets", "Show only performances that still have purchasable tickets"),
    ];
  }

  if (kind === "screen_size" && television) {
    return [
      option("43-inch", "43″"),
      option("50-inch", "50″"),
      option("55-inch", "55″"),
      option("65-inch", "65″"),
      option("unsure", copy.notSure),
    ];
  }

  if (kind === "budget") {
    if (locale === "zh-Hant") {
      return [
        option("economical", "較實惠"),
        option("balanced_value", "平衡價位／性價比"),
        option("premium_ok", "高階也可以"),
        option("compare_first", "沒有固定預算，先比較"),
      ];
    }
    if (locale === "ja") {
      return [
        option("economical", "価格を抑える"),
        option("balanced_value", "価格と品質のバランス"),
        option("premium_ok", "高価格帯も可"),
        option("compare_first", "予算未定・まず比較"),
      ];
    }
    return [
      option("economical", "Keep it economical"),
      option("balanced_value", "Best value / balanced"),
      option("premium_ok", "Premium is fine"),
      option("compare_first", "No fixed budget — compare first"),
    ];
  }

  if (kind === "brand") {
    if (locale === "zh-Hant") {
      return [
        option("no_preference", "沒有品牌偏好"),
        option("best_value", "品牌不限，性價比優先"),
        option("established_brand", "較成熟品牌優先"),
        option("agent_choice", copy.decide),
      ];
    }
    if (locale === "ja") {
      return [
        option("no_preference", "ブランド指定なし"),
        option("best_value", "ブランド不問・コスパ優先"),
        option("established_brand", "定評のあるブランド優先"),
        option("agent_choice", copy.decide),
      ];
    }
    return [
      option("no_preference", "No brand preference"),
      option("best_value", "Any brand — best value first"),
      option("established_brand", "Established brands first"),
      option("agent_choice", copy.decide),
    ];
  }

  if (kind === "purchase_location") {
    if (locale === "zh-Hant") {
      return [
        option("nearby", "附近實體店"),
        option("online", "網上商店"),
        option("either", "兩者都可以"),
        option("agent_choice", copy.decide),
      ];
    }
    if (locale === "ja") {
      return [
        option("nearby", "近くの店舗"),
        option("online", "オンライン"),
        option("either", "どちらでもよい"),
        option("agent_choice", copy.decide),
      ];
    }
    return [
      option("nearby", "Nearby stores"),
      option("online", "Online stores"),
      option("either", "Either is fine"),
      option("agent_choice", copy.decide),
    ];
  }

  if (kind === "purpose" && television) {
    if (locale === "zh-Hant") {
      return [
        option("everyday", "一般電視／日常使用"),
        option("movies", "電影／串流"),
        option("gaming", "遊戲"),
        option("mixed", "混合使用"),
      ];
    }
    if (locale === "ja") {
      return [
        option("everyday", "普段使い"),
        option("movies", "映画・配信"),
        option("gaming", "ゲーム"),
        option("mixed", "幅広く使う"),
      ];
    }
    return [
      option("everyday", "Everyday TV"),
      option("movies", "Movies / streaming"),
      option("gaming", "Gaming"),
      option("mixed", "Mixed use"),
    ];
  }

  if (kind === "fulfilment") {
    if (locale === "zh-Hant") {
      return [
        option("delivery", "送貨"),
        option("pickup", "自取"),
        option("fastest", "最快方式"),
        option("agent_choice", copy.decide),
      ];
    }
    if (locale === "ja") {
      return [
        option("delivery", "配送"),
        option("pickup", "受け取り"),
        option("fastest", "最短の方法"),
        option("agent_choice", copy.decide),
      ];
    }
    return [
      option("delivery", "Delivery"),
      option("pickup", "Pickup"),
      option("fastest", "Fastest option"),
      option("agent_choice", copy.decide),
    ];
  }

  if (kind === "deadline") {
    if (locale === "zh-Hant") {
      return [
        option("today", "今天"),
        option("within_3_days", "3 天內"),
        option("this_week", "本週內"),
        option("flexible", "時間彈性"),
      ];
    }
    if (locale === "ja") {
      return [
        option("today", "今日"),
        option("within_3_days", "3日以内"),
        option("this_week", "今週中"),
        option("flexible", "急がない"),
      ];
    }
    return [
      option("today", "Today"),
      option("within_3_days", "Within 3 days"),
      option("this_week", "This week"),
      option("flexible", "Flexible"),
    ];
  }

  if (kind === "colour") {
    if (locale === "zh-Hant") {
      return [
        option("no_preference", "沒有偏好"),
        option("dark", "深色"),
        option("light", "淺色"),
        option("agent_choice", copy.decide),
      ];
    }
    if (locale === "ja") {
      return [
        option("no_preference", "指定なし"),
        option("dark", "ダーク系"),
        option("light", "ライト系"),
        option("agent_choice", copy.decide),
      ];
    }
    return [
      option("no_preference", "No preference"),
      option("dark", "Dark"),
      option("light", "Light"),
      option("agent_choice", copy.decide),
    ];
  }

  if (kind === "boolean") {
    if (locale === "zh-Hant") return [option(true, "是"), option(false, "否")];
    if (locale === "ja") return [option(true, "はい"), option(false, "いいえ")];
    return [option(true, "Yes"), option(false, "No")];
  }

  return [];
}

function fieldControl(kind: FieldKind, options: AdaptiveInteractionOption[]) {
  if (kind === "quantity") return "number" as const;
  if (kind === "boolean") return "boolean" as const;
  if (options.length) return "single_choice" as const;
  return "text" as const;
}

function fieldReason(kind: FieldKind, locale: AdaptiveInteractionLocale) {
  return kind === "event_intent" ? COPY[locale].eventReason : COPY[locale].reason;
}

function fieldPlaceholder(kind: FieldKind, locale: AdaptiveInteractionLocale) {
  return kind === "event_intent" ? COPY[locale].eventPlaceholder : COPY[locale].customPlaceholder;
}

function compileField(raw: string, intent: string, locale: AdaptiveInteractionLocale, index: number): AdaptiveInteractionField {
  const copy = COPY[locale];
  const kind = classifyField(raw, intent);
  const options = fieldOptions(kind, locale, intent);
  const normalized = cleanField(raw) || `field_${index + 1}`;
  const known = kind !== "generic";

  return {
    id: `adaptive:${normalized}:${index}`,
    sourceField: raw.trim(),
    key: normalized,
    label: known ? copy.labels[kind] : genericLabel(raw, locale),
    prompt: known ? copy.prompts[kind] : `${copy.prompts.generic} (${genericLabel(raw, locale)})`,
    reason: fieldReason(kind, locale),
    control: fieldControl(kind, options),
    options,
    allowCustom: kind !== "boolean" && kind !== "quantity",
    ...(kind !== "boolean" && kind !== "quantity" ? { customPlaceholder: fieldPlaceholder(kind, locale) } : {}),
    required: true,
    sensitive: false,
  };
}

export function createAdaptiveInteractionSchema(input: {
  intent: string;
  missingFields: string[];
  locale?: string;
  interactionId?: string;
  now?: number | string | Date;
}): AdaptiveInteractionSchema {
  const locale = normalizedLocale(input.locale);
  const createdAt = new Date(input.now ?? Date.now()).toISOString();
  const plannedFields = planAdaptiveMissingFields({
    intent: input.intent,
    missingFields: input.missingFields,
  });
  const fields = plannedFields.map((field, index) => compileField(field.raw, input.intent, locale, index));

  return {
    schemaVersion: "asympta.adaptive-ui.v1",
    interactionId: input.interactionId ?? `adaptive-${createdAt}`,
    intent: input.intent.trim(),
    fields,
    nextField: fields[0] ?? null,
    provenance: {
      source: "agent_missing_fields",
      mode: "runtime_schema",
      factPolicy: "unknown_until_user_confirmation",
      createdAt,
    },
  };
}

function containsEventIntentConfirmation(confirmations: AdaptiveConfirmation[]) {
  return confirmations.some((confirmation) => cleanField(confirmation.field) === EVENT_INTENT_KEY);
}

export function mergeAdaptiveClarifications(input: {
  intent: string;
  confirmations: AdaptiveConfirmation[];
  locale?: string;
}) {
  const locale = normalizedLocale(input.locale);
  const baseIntent = input.intent.trim();
  const byField = new Map<string, AdaptiveConfirmation>();
  for (const confirmation of input.confirmations) {
    const key = cleanField(confirmation.field);
    if (!key) continue;
    byField.set(key, confirmation);
  }
  const confirmations = [...byField.values()];
  if (!confirmations.length) return baseIntent;

  const heading = locale === "zh-Hant"
    ? "已由使用者確認的資料"
    : locale === "ja"
      ? "ユーザー確認済みの情報"
      : "User-confirmed details";
  const details = confirmations
    .map((confirmation) => `${confirmation.field}: ${confirmation.label}`)
    .join("; ");
  const continuationRules = [COPY[locale].continueRule];
  if (containsEventIntentConfirmation(confirmations)) continuationRules.push(COPY[locale].eventContinueRule);

  return `${baseIntent}\n\n${heading}: ${details}.\n${continuationRules.join(" ")}`;
}

export function missingFieldsFromAdaptiveActivityData(data: unknown) {
  if (!data || typeof data !== "object") return [];
  const missingFields = Reflect.get(data, "missingFields");
  if (!Array.isArray(missingFields)) return [];
  return missingFields.filter((field): field is string => typeof field === "string" && field.trim().length > 0);
}
