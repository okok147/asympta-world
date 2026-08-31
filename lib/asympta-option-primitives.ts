import {
  createAdaptiveInteractionSchema,
  type AdaptiveInteractionField,
  type AdaptiveInteractionLocale,
  type AdaptiveInteractionOption,
  type AdaptiveInteractionSchema,
} from "./asympta-adaptive-interaction.ts";

type PrimitiveKind =
  | "delivery_destination"
  | "payment_method"
  | "dietary_preference"
  | "seat_preference"
  | "room_preference"
  | "transport_class"
  | "generic_choice";

type PrimitiveCopy = {
  label: string;
  prompt: string;
  reason: string;
  placeholder: string;
  options: AdaptiveInteractionOption[];
};

const TV_PATTERN = /(?:\btv\b|\btelevision\b|smart\s*tv|電視機?|电视机?|テレビ)/iu;
const DELIVERY_DESTINATION_PATTERN = /(?:delivery|shipping|ship|drop.?off|deliver).{0,18}(?:address|location|destination|place)|(?:address|location|destination|place).{0,18}(?:delivery|shipping|ship|drop.?off)|配送(?:地點|地点|地址|位置)|送貨(?:地點|地点|地址)|送货(?:地点|地址)|收貨(?:地點|地点|地址)|收货(?:地点|地址)|お届け先|配送先|送付先/iu;
const PAYMENT_PATTERN = /(?:payment(?:_?method)?|pay(?:ment)?_?preference|付款方式|支付方式|付款偏好|支払方法|決済方法)/iu;
const DIETARY_PATTERN = /(?:dietary|diet|food_?restriction|allerg|vegetarian|vegan|halal|飲食(?:偏好|限制)|飲食要求|食物敏感|過敏|过敏|素食|清真|食事制限|アレルギー)/iu;
const SEAT_PATTERN = /(?:seat|seating|座位|席|シート)/iu;
const ROOM_PATTERN = /(?:room_?type|room_?preference|房型|房間類型|房间类型|客室タイプ)/iu;
const TRANSPORT_CLASS_PATTERN = /(?:cabin|travel_?class|fare_?class|class_?preference|艙等|舱等|座艙|座舱|クラス)/iu;

function localeFrom(value: string | undefined): AdaptiveInteractionLocale {
  const locale = (value ?? "en").toLowerCase();
  if (locale.startsWith("zh")) return "zh-Hant";
  if (locale.startsWith("ja")) return "ja";
  return "en";
}

function option(value: string, label: string, description?: string): AdaptiveInteractionOption {
  return { value, label, ...(description ? { description } : {}) };
}

function normalizedFieldText(field: AdaptiveInteractionField) {
  return `${field.key} ${field.sourceField}`.toLowerCase().replace(/[\s./-]+/g, "_");
}

function primitiveKind(field: AdaptiveInteractionField): PrimitiveKind | null {
  const text = normalizedFieldText(field);
  if (DELIVERY_DESTINATION_PATTERN.test(text)) return "delivery_destination";
  if (PAYMENT_PATTERN.test(text)) return "payment_method";
  if (DIETARY_PATTERN.test(text)) return "dietary_preference";
  if (SEAT_PATTERN.test(text)) return "seat_preference";
  if (ROOM_PATTERN.test(text)) return "room_preference";
  if (TRANSPORT_CLASS_PATTERN.test(text)) return "transport_class";
  return null;
}

function primitiveCopy(kind: PrimitiveKind, locale: AdaptiveInteractionLocale): PrimitiveCopy {
  if (kind === "delivery_destination") {
    if (locale === "zh-Hant") return {
      label: "配送地點",
      prompt: "希望送到哪裏？",
      reason: "先選擇地址來源；只有需要時才要求你輸入完整地址。",
      placeholder: "輸入其他配送地址…",
      options: [
        option("saved_delivery_address", "使用已儲存配送地址", "如個人設定已有地址，直接使用"),
        option("current_location", "目前位置", "以目前位置作為配送目的地"),
      ],
    };
    if (locale === "ja") return {
      label: "配送先",
      prompt: "どこへ届けますか？",
      reason: "まず住所の取得方法を選び、必要な場合だけ完全な住所を入力します。",
      placeholder: "別の配送先を入力…",
      options: [
        option("saved_delivery_address", "保存済みの配送先", "プロフィールに保存済みなら使用"),
        option("current_location", "現在地", "現在地を配送先として使用"),
      ],
    };
    return {
      label: "Delivery destination",
      prompt: "Where should it be delivered?",
      reason: "Choose the address source first; type a full address only when it is actually needed.",
      placeholder: "Enter another delivery address…",
      options: [
        option("saved_delivery_address", "Use saved delivery address", "Use the profile address when available"),
        option("current_location", "Current location", "Use the current location as the destination"),
      ],
    };
  }

  if (kind === "payment_method") {
    if (locale === "zh-Hant") return {
      label: "付款方式",
      prompt: "付款時希望使用哪種方式？",
      reason: "只選擇付款偏好；真正扣款仍需遵守付款授權界線。",
      placeholder: "輸入其他付款方式…",
      options: [
        option("saved_payment", "使用已儲存付款方式"),
        option("pay_on_pickup", "取貨／到店付款"),
        option("confirm_at_payment", "付款前再問我"),
      ],
    };
    if (locale === "ja") return {
      label: "支払方法",
      prompt: "支払い時にどの方法を使いますか？",
      reason: "支払いの希望だけを選びます。実際の決済は承認境界を維持します。",
      placeholder: "別の支払方法を入力…",
      options: [
        option("saved_payment", "保存済みの支払方法"),
        option("pay_on_pickup", "受取時に支払う"),
        option("confirm_at_payment", "支払う前に確認"),
      ],
    };
    return {
      label: "Payment",
      prompt: "How should payment be handled?",
      reason: "This selects a payment preference only; the real charge still stays behind the payment authorization boundary.",
      placeholder: "Enter another payment method…",
      options: [
        option("saved_payment", "Use saved payment method"),
        option("pay_on_pickup", "Pay on pickup"),
        option("confirm_at_payment", "Ask me before payment"),
      ],
    };
  }

  if (kind === "dietary_preference") {
    if (locale === "zh-Hant") return {
      label: "飲食需要",
      prompt: "有甚麼飲食要求？",
      reason: "把常見飲食限制變成快速選項；特殊要求仍可直接輸入。",
      placeholder: "輸入其他飲食要求…",
      options: [
        option("none", "沒有特別限制"),
        option("vegetarian", "素食"),
        option("vegan", "純素"),
        option("halal", "清真"),
      ],
    };
    if (locale === "ja") return {
      label: "食事条件",
      prompt: "食事の希望や制限はありますか？",
      reason: "一般的な条件はすぐ選べ、特殊な条件だけ入力できます。",
      placeholder: "その他の食事条件を入力…",
      options: [option("none", "制限なし"), option("vegetarian", "ベジタリアン"), option("vegan", "ヴィーガン"), option("halal", "ハラール")],
    };
    return {
      label: "Dietary needs",
      prompt: "Any dietary requirements?",
      reason: "Common restrictions become quick choices; unusual requirements can still be typed.",
      placeholder: "Enter another dietary requirement…",
      options: [option("none", "No restrictions"), option("vegetarian", "Vegetarian"), option("vegan", "Vegan"), option("halal", "Halal")],
    };
  }

  if (kind === "seat_preference") {
    if (locale === "zh-Hant") return {
      label: "座位偏好",
      prompt: "座位希望怎樣選？",
      reason: "先選策略，再由可用座位結果決定實際位置。",
      placeholder: "輸入其他座位要求…",
      options: [option("best_available", "最佳可用"), option("balanced", "價錢與位置平衡"), option("cheapest", "最便宜可買")],
    };
    if (locale === "ja") return {
      label: "座席の希望",
      prompt: "座席はどう選びますか？",
      reason: "まず方針を選び、実際の位置は空席候補から決めます。",
      placeholder: "その他の座席条件を入力…",
      options: [option("best_available", "最良の空席"), option("balanced", "価格と位置のバランス"), option("cheapest", "最安の空席")],
    };
    return {
      label: "Seat preference",
      prompt: "How should seats be chosen?",
      reason: "Choose a strategy first; the exact seat comes from the available inventory.",
      placeholder: "Enter another seating requirement…",
      options: [option("best_available", "Best available"), option("balanced", "Balance price and position"), option("cheapest", "Cheapest available")],
    };
  }

  if (kind === "room_preference") {
    if (locale === "zh-Hant") return {
      label: "房型",
      prompt: "你偏好哪種房型？",
      reason: "先選房型方向，再從實際可訂房間中選擇。",
      placeholder: "輸入其他房型要求…",
      options: [option("standard", "標準房"), option("larger", "較大房間"), option("best_value", "性價比優先"), option("agent_choice", "讓 Asympta 判斷")],
    };
    if (locale === "ja") return {
      label: "客室タイプ",
      prompt: "どの客室タイプがよいですか？",
      reason: "希望を選び、実際に予約可能な部屋から決めます。",
      placeholder: "その他の客室条件を入力…",
      options: [option("standard", "スタンダード"), option("larger", "広めの部屋"), option("best_value", "コスパ優先"), option("agent_choice", "Asympta に任せる")],
    };
    return {
      label: "Room type",
      prompt: "What kind of room do you prefer?",
      reason: "Choose a room strategy first, then select from actual available inventory.",
      placeholder: "Enter another room requirement…",
      options: [option("standard", "Standard room"), option("larger", "Larger room"), option("best_value", "Best value"), option("agent_choice", "Let Asympta choose")],
    };
  }

  if (kind === "transport_class") {
    if (locale === "zh-Hant") return {
      label: "艙等",
      prompt: "希望使用哪種艙等？",
      reason: "選擇艙等策略，再由實際班次與價格提供可選方案。",
      placeholder: "輸入其他艙等要求…",
      options: [option("economy", "經濟艙"), option("premium_economy", "特選經濟艙"), option("business", "商務艙"), option("best_value", "性價比優先")],
    };
    if (locale === "ja") return {
      label: "クラス",
      prompt: "どのクラスを希望しますか？",
      reason: "クラス方針を選び、実際の便と価格から候補を出します。",
      placeholder: "その他のクラス条件を入力…",
      options: [option("economy", "エコノミー"), option("premium_economy", "プレミアムエコノミー"), option("business", "ビジネス"), option("best_value", "コスパ優先")],
    };
    return {
      label: "Travel class",
      prompt: "Which travel class should I use?",
      reason: "Choose the class strategy first; actual choices come from available services and prices.",
      placeholder: "Enter another class requirement…",
      options: [option("economy", "Economy"), option("premium_economy", "Premium economy"), option("business", "Business"), option("best_value", "Best value")],
    };
  }

  throw new Error(`Unsupported primitive kind: ${kind}`);
}

function tvBrandField(field: AdaptiveInteractionField, locale: AdaptiveInteractionLocale): AdaptiveInteractionField {
  const options = locale === "zh-Hant"
    ? [option("no_preference", "沒有品牌偏好"), option("samsung", "Samsung"), option("lg", "LG"), option("sony", "Sony"), option("tcl", "TCL"), option("best_value", "品牌不限，性價比優先")]
    : locale === "ja"
      ? [option("no_preference", "ブランド指定なし"), option("samsung", "Samsung"), option("lg", "LG"), option("sony", "Sony"), option("tcl", "TCL"), option("best_value", "ブランド不問・コスパ優先")]
      : [option("no_preference", "No brand preference"), option("samsung", "Samsung"), option("lg", "LG"), option("sony", "Sony"), option("tcl", "TCL"), option("best_value", "Any brand — best value first")];
  return { ...field, control: "single_choice", options, allowCustom: true };
}

function upgradeField(field: AdaptiveInteractionField, intent: string, locale: AdaptiveInteractionLocale): AdaptiveInteractionField {
  if (TV_PATTERN.test(intent) && /(?:brand|品牌|牌子|ブランド|メーカー)/iu.test(normalizedFieldText(field))) {
    return tvBrandField(field, locale);
  }

  const kind = primitiveKind(field);
  if (!kind) return field;
  const copy = primitiveCopy(kind, locale);
  return {
    ...field,
    key: kind,
    label: copy.label,
    prompt: copy.prompt,
    reason: copy.reason,
    control: "single_choice",
    options: copy.options,
    allowCustom: true,
    customPlaceholder: copy.placeholder,
  };
}

export function createAdaptiveOptionPrimitiveSchema(input: {
  intent: string;
  missingFields: string[];
  locale?: string;
  interactionId?: string;
  now?: number | string | Date;
}): AdaptiveInteractionSchema {
  const locale = localeFrom(input.locale);
  const base = createAdaptiveInteractionSchema(input);
  const fields = base.fields.map((field) => upgradeField(field, input.intent, locale));
  return {
    ...base,
    fields,
    nextField: fields[0] ?? null,
  };
}

export function fieldsUsingChoicePrimitives(schema: AdaptiveInteractionSchema) {
  return schema.fields.filter((field) => field.control === "single_choice" || field.control === "boolean");
}
