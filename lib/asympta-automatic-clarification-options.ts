import {
  createAdaptiveInteractionSchema as createBaseAdaptiveInteractionSchema,
  type AdaptiveInteractionField,
  type AdaptiveInteractionLocale,
  type AdaptiveInteractionOption,
  type AdaptiveInteractionSchema,
} from "./asympta-adaptive-interaction.ts";

export * from "./asympta-adaptive-interaction.ts";

type AdaptiveSchemaInput = Parameters<typeof createBaseAdaptiveInteractionSchema>[0];

type AutomaticOptionCopy = {
  budgetPrompt: string;
  budgetPlaceholder: string;
  screenPrompt: string;
  brandPrompt: string;
  deliveryLabel: string;
  deliveryPrompt: string;
  deliveryReason: string;
  deliveryPlaceholder: string;
  notSure: string;
  decide: string;
  noBrandPreference: string;
};

const COPY: Record<AdaptiveInteractionLocale, AutomaticOptionCopy> = {
  en: {
    budgetPrompt: "What budget range should I use?",
    budgetPlaceholder: "Enter a maximum budget…",
    screenPrompt: "Which screen size do you prefer?",
    brandPrompt: "Do you have a brand preference?",
    deliveryLabel: "Delivery location",
    deliveryPrompt: "Where should it be delivered?",
    deliveryReason: "Choose a usual or discoverable destination. If an exact address is still missing, Asympta will ask only for that next.",
    deliveryPlaceholder: "Enter a delivery address or area…",
    notSure: "Not sure yet",
    decide: "Let Asympta choose",
    noBrandPreference: "No brand preference",
  },
  "zh-Hant": {
    budgetPrompt: "你的預算範圍是？",
    budgetPlaceholder: "輸入最高預算，例如 HK$8,000…",
    screenPrompt: "你想要哪個螢幕尺寸？",
    brandPrompt: "你偏好哪個品牌？",
    deliveryLabel: "配送地點",
    deliveryPrompt: "電視要送到哪裏？",
    deliveryReason: "先選擇可使用的送達來源；如仍欠完整地址，Asympta 只會再詢問那一項。",
    deliveryPlaceholder: "輸入送貨地址或地區…",
    notSure: "暫時不確定",
    decide: "讓 Asympta 判斷",
    noBrandPreference: "沒有品牌偏好",
  },
  ja: {
    budgetPrompt: "どの予算範囲で探しますか？",
    budgetPlaceholder: "上限予算を入力…",
    screenPrompt: "どの画面サイズがよいですか？",
    brandPrompt: "希望するブランドはありますか？",
    deliveryLabel: "配送先",
    deliveryPrompt: "どこへ配送しますか？",
    deliveryReason: "通常または取得可能な配送先を選びます。正確な住所が不足している場合だけ、次にその一点を確認します。",
    deliveryPlaceholder: "配送先の住所または地域を入力…",
    notSure: "まだ決めていない",
    decide: "Asympta に任せる",
    noBrandPreference: "ブランド指定なし",
  },
};

const TV_INTENT_PATTERN = /(?:\btv\b|\btelevision\b|smart\s*tv|電視機?|电视机?|テレビ)/iu;
const DELIVERY_LOCATION_PATTERN = /(?:delivery\s*(?:location|address)|shipping\s*address|ship\s*to|drop[- ]?off|配送地點|配送地点|配送地址|送貨地點|送货地点|送貨地址|送货地址|收貨地點|收货地点|收貨地址|收货地址|配達先|配送先|届け先)/iu;
const FIELD_LIST_MARKER_PATTERN = /(?:需(?:要|先)?(?:釐清|厘清|確認|确认|提供)|還需要(?:你)?提供|尚欠|缺少|need(?:s)?\s+(?:to\s+)?(?:clarify|confirm|provide)|require(?:s|d)?|missing(?:\s+fields?)?|確認が必要|不足している)/iu;
const FIELD_LIST_SUFFIX_PATTERN = /(?:等)?(?:必要)?(?:資訊|信息|資料|资料|內容|内容|details?|information|fields?)[。.!！．]*$/iu;
const FIELD_SEPARATOR_PATTERN = /[,，、;；]|\s+(?:and|plus)\s+|(?:以及|與|和|及)|(?:および|及び)/iu;
const KNOWN_FIELD_PATTERN = /(?:budget|price|screen|size|brand|maker|purchase|store|shop|delivery|shipping|address|location|purpose|use|quantity|count|deadline|timeframe|colour|color|confirm|event|artist|venue|預算|预算|尺寸|大小|品牌|牌子|購買|购买|商店|配送|送貨|送货|收貨|收货|地址|地點|地点|用途|數量|数量|期限|時間|时间|顏色|颜色|確認|确认|演出|歌手|場館|场馆|予算|サイズ|ブランド|購入|配送先|住所|用途|数量|期限|色|確認|公演|会場)/iu;
const BROAD_SPEC_PATTERN = /(?:other\s+(?:necessary|required)?\s*(?:specifications?|specs?|details?)|remaining\s+(?:necessary|required)?\s*(?:specifications?|specs?|details?)|necessary\s+(?:specifications?|specs?)|其他必要規格|其他規格|其餘必要規格|其余必要规格|必要規格|その他(?:の)?必要(?:な)?仕様|残り(?:の)?必要(?:な)?仕様)/iu;

function normalizedLocale(locale: string | undefined): AdaptiveInteractionLocale {
  const value = (locale ?? "en").toLowerCase();
  if (value.startsWith("zh")) return "zh-Hant";
  if (value.startsWith("ja")) return "ja";
  return "en";
}

function option(value: string, label: string, description?: string): AdaptiveInteractionOption {
  return { value, label, ...(description ? { description } : {}) };
}

function cleanFragment(value: string) {
  return value
    .trim()
    .replace(/^(?:先)?(?:釐清|厘清|確認|确认|提供)\s*/u, "")
    .replace(/^(?:the\s+)?(?:user\s+)?(?:needs?|requires?)\s*/iu, "")
    .replace(FIELD_LIST_SUFFIX_PATTERN, "")
    .replace(/^[：:\-\s]+|[：:\-\s。.!！．]+$/gu, "")
    .trim();
}

export function expandAutomaticClarificationFields(missingFields: string[]) {
  const expanded: string[] = [];

  for (const rawField of missingFields) {
    const compact = rawField.replace(/\s+/g, " ").trim();
    const marker = FIELD_LIST_MARKER_PATTERN.exec(compact);
    const narrative = Boolean(marker);
    const candidate = marker
      ? compact.slice((marker.index ?? 0) + marker[0].length).trim() || compact
      : compact;

    const fragments = candidate
      .split(FIELD_SEPARATOR_PATTERN)
      .map(cleanFragment)
      .filter(Boolean);

    for (const fragment of fragments) {
      if (narrative && !KNOWN_FIELD_PATTERN.test(fragment) && !BROAD_SPEC_PATTERN.test(fragment)) continue;
      expanded.push(fragment);
    }
  }

  return expanded.length ? expanded : missingFields;
}

function repairBroadTvFields(intent: string, fields: string[]) {
  if (!TV_INTENT_PATTERN.test(intent)) return fields;
  const repaired: string[] = [];
  let broadGap = false;
  for (const field of fields) {
    if (BROAD_SPEC_PATTERN.test(field)) {
      broadGap = true;
      continue;
    }
    repaired.push(field);
  }
  if (!broadGap) return fields;

  const joined = repaired.join(" ");
  if (!/(?:screen|display|inch|尺寸|大小|画面|インチ|サイズ)/iu.test(joined)) repaired.push("screen size");
  if (!/(?:brand|maker|manufacturer|品牌|牌子|メーカー|ブランド)/iu.test(joined)) repaired.push("brand preference");
  if (!DELIVERY_LOCATION_PATTERN.test(joined)) repaired.push("delivery location");
  return repaired;
}

function isBudgetField(field: AdaptiveInteractionField) {
  return /(?:budget|price|預算|预算|予算)/iu.test(`${field.key} ${field.sourceField}`);
}

function isScreenSizeField(field: AdaptiveInteractionField) {
  return /(?:screen|display|inch|size|尺寸|大小|画面|インチ|サイズ)/iu.test(`${field.key} ${field.sourceField}`);
}

function isBrandField(field: AdaptiveInteractionField) {
  return /(?:brand|maker|manufacturer|品牌|牌子|メーカー|ブランド)/iu.test(`${field.key} ${field.sourceField}`);
}

function isDeliveryLocationField(field: AdaptiveInteractionField) {
  return DELIVERY_LOCATION_PATTERN.test(`${field.key} ${field.sourceField}`);
}

function tvBudgetOptions(locale: AdaptiveInteractionLocale) {
  if (locale === "zh-Hant") {
    return [
      option("under_3000_hkd", "HK$3,000 以下"),
      option("3000_6000_hkd", "HK$3,000–6,000"),
      option("6000_10000_hkd", "HK$6,000–10,000"),
      option("over_10000_hkd", "HK$10,000 以上"),
      option("compare_first", "先比較再決定"),
    ];
  }
  if (locale === "ja") {
    return [
      option("under_3000_hkd", "HK$3,000 未満"),
      option("3000_6000_hkd", "HK$3,000–6,000"),
      option("6000_10000_hkd", "HK$6,000–10,000"),
      option("over_10000_hkd", "HK$10,000 以上"),
      option("compare_first", "まず比較して決める"),
    ];
  }
  return [
    option("under_3000_hkd", "Under HK$3,000"),
    option("3000_6000_hkd", "HK$3,000–6,000"),
    option("6000_10000_hkd", "HK$6,000–10,000"),
    option("over_10000_hkd", "Over HK$10,000"),
    option("compare_first", "Compare first"),
  ];
}

function tvScreenOptions(locale: AdaptiveInteractionLocale) {
  return [
    option("43-inch", "43″"),
    option("50-inch", "50″"),
    option("55-inch", "55″"),
    option("65-inch", "65″"),
    option("75-inch", "75″"),
    option("unsure", COPY[locale].notSure),
  ];
}

function tvBrandOptions(locale: AdaptiveInteractionLocale) {
  return [
    option("samsung", "Samsung"),
    option("lg", "LG"),
    option("sony", "Sony"),
    option("tcl_or_hisense", "TCL / Hisense"),
    option("no_preference", COPY[locale].noBrandPreference),
    option("agent_choice", COPY[locale].decide),
  ];
}

function deliveryLocationOptions(locale: AdaptiveInteractionLocale) {
  if (locale === "zh-Hant") {
    return [
      option("saved_home", "常用住址", "如個人設定已有地址便直接使用"),
      option("current_location", "目前位置", "需要瀏覽器定位或再確認附近地址"),
      option("store_pickup", "門市自取", "改為從可取貨門市選擇"),
    ];
  }
  if (locale === "ja") {
    return [
      option("saved_home", "通常の住所", "プロフィールに住所があればその配送先を使用"),
      option("current_location", "現在地", "位置情報または近隣住所の確認が必要"),
      option("store_pickup", "店舗受け取り", "受け取り可能な店舗から選択"),
    ];
  }
  return [
    option("saved_home", "Usual address", "Use the profile address when one is available"),
    option("current_location", "Current location", "Requires location access or a nearby-address confirmation"),
    option("store_pickup", "Store pickup", "Choose from stores that support collection"),
  ];
}

function decorateField(
  field: AdaptiveInteractionField,
  intent: string,
  locale: AdaptiveInteractionLocale,
): AdaptiveInteractionField {
  const copy = COPY[locale];

  if (isDeliveryLocationField(field)) {
    return {
      ...field,
      key: "delivery_location",
      label: copy.deliveryLabel,
      prompt: copy.deliveryPrompt,
      reason: copy.deliveryReason,
      control: "single_choice",
      options: deliveryLocationOptions(locale),
      allowCustom: true,
      customPlaceholder: copy.deliveryPlaceholder,
    };
  }

  if (!TV_INTENT_PATTERN.test(intent)) return field;

  if (isBudgetField(field)) {
    return {
      ...field,
      key: "budget",
      prompt: copy.budgetPrompt,
      control: "single_choice",
      options: tvBudgetOptions(locale),
      allowCustom: true,
      customPlaceholder: copy.budgetPlaceholder,
    };
  }

  if (isScreenSizeField(field)) {
    return {
      ...field,
      key: "screen_size",
      prompt: copy.screenPrompt,
      control: "single_choice",
      options: tvScreenOptions(locale),
      allowCustom: true,
    };
  }

  if (isBrandField(field)) {
    return {
      ...field,
      key: "brand",
      prompt: copy.brandPrompt,
      control: "single_choice",
      options: tvBrandOptions(locale),
      allowCustom: true,
    };
  }

  return field;
}

export function createAdaptiveInteractionSchema(input: AdaptiveSchemaInput): AdaptiveInteractionSchema {
  const locale = normalizedLocale(input.locale);
  const expanded = expandAutomaticClarificationFields(input.missingFields);
  const repaired = repairBroadTvFields(input.intent, expanded);
  const base = createBaseAdaptiveInteractionSchema({
    ...input,
    missingFields: repaired,
  });
  const fields = base.fields.map((field) => decorateField(field, input.intent, locale));

  return {
    ...base,
    fields,
    nextField: fields[0] ?? null,
  };
}
