import {
  runUniversalTask,
  type AsymptaRequirementSemantic,
  type AsymptaUniversalLocale,
  type AsymptaUniversalProfile,
  type AsymptaUniversalRisk,
  type AsymptaUniversalTaskEnvelope,
  type AsymptaUniversalTaskInput,
} from "./asympta-universal-task-protocol.ts";

export type AsymptaUniversalBenchmarkCase = AsymptaUniversalTaskInput & {
  id: string;
  title: string;
  archetypeId: string;
  variant: number;
};

export type AsymptaUniversalBenchmarkFailure = {
  id: string;
  domain: string;
  locale: AsymptaUniversalLocale;
  status: string;
  stuckReason: string | null;
  humanInterventions: number;
  steps: number;
  unresolved: string[];
};

export type AsymptaUniversalBenchmarkSection = {
  total: number;
  completed: number;
  stuck: number;
  humanInterventions: number;
  maxSteps: number;
  averageSteps: number;
  failures: AsymptaUniversalBenchmarkFailure[];
};

export type AsymptaUniversalBenchmarkReport = {
  version: "asympta.benchmark/0.2";
  seed: number;
  core: AsymptaUniversalBenchmarkSection;
  stress: AsymptaUniversalBenchmarkSection;
  total: number;
  completed: number;
  stuck: number;
  humanInterventions: number;
  domains: string[];
  locales: AsymptaUniversalLocale[];
  resolutionSources: Record<string, number>;
  semantics: Record<string, number>;
  passed: boolean;
};

type Archetype = {
  id: string;
  domain: string;
  actionFamily: string;
  risk: AsymptaUniversalRisk;
  goal: Record<AsymptaUniversalLocale, string>;
  requiredFields: string[];
  facts?: Record<string, unknown>;
};

type Variant = {
  locale: AsymptaUniversalLocale;
  prefix: string;
  suffix: string;
  factPatch?: Record<string, unknown>;
};

export const UNIVERSAL_BENCHMARK_PROFILE: AsymptaUniversalProfile = {
  id: "benchmark-persona-v2",
  locale: "zh-Hant",
  timezone: "Asia/Hong_Kong",
  homeLocation: "profile:home",
  officeLocation: "profile:office",
  currentLocation: "profile:current-location",
  contactToken: "profile:contact",
  identityToken: "profile:identity",
  paymentToken: "profile:payment",
  accountToken: "profile:account",
  documentToken: "profile:document",
  policyToken: "profile:policy",
  evidenceToken: "profile:evidence",
  budgetPolicy: "compare_first",
  brandPreference: "no_preference",
  sizePreference: "agent_choice",
  colourPreference: "no_preference",
  fulfilmentPreference: "delivery",
  accessibilityPreference: "no_special_requirement",
  savedRecipients: {
    self: "profile:self",
    family: "profile:family",
    office: "profile:office-recipient",
  },
  preferences: {
    default: "agent_choice",
    purchaseLocation: "best_available",
    cuisine: "balanced",
    seat: "best_available",
    class: "economy",
    room: "non_smoking",
    transportMode: "fastest_reasonable",
    serviceLevel: "standard",
    amount: 500,
  },
  authorizations: {
    simulatedWrites: true,
    liveLowRiskWrites: false,
  },
};

const ARCHETYPES: Archetype[] = [
  {
    id: "food-delivery",
    domain: "food",
    actionFamily: "order",
    risk: "low",
    goal: {
      en: "Order a suitable dinner and deliver it to me",
      "zh-Hant": "替我訂一份合適的晚餐並送到家",
      ja: "自分に合う夕食を注文して届けてほしい",
    },
    requiredFields: ["item", "quantity", "budget", "delivery location", "deadline", "dietary preference"],
  },
  {
    id: "grocery-purchase",
    domain: "grocery",
    actionFamily: "purchase",
    risk: "low",
    goal: {
      en: "Buy groceries for the next few days",
      "zh-Hant": "購買未來幾天需要的日常食品",
      ja: "数日分の日用品と食料品を購入してほしい",
    },
    requiredFields: ["item list", "quantity", "budget", "fulfilment", "delivery location"],
  },
  {
    id: "electronics-purchase",
    domain: "electronics",
    actionFamily: "purchase",
    risk: "medium",
    goal: {
      en: "Buy a television that fits my needs",
      "zh-Hant": "購買一台適合我的電視機",
      ja: "自分の用途に合うテレビを購入してほしい",
    },
    requiredFields: ["budget", "screen size", "brand preference", "purpose", "delivery location"],
  },
  {
    id: "clothing-purchase",
    domain: "clothing",
    actionFamily: "purchase",
    risk: "low",
    goal: {
      en: "Buy a comfortable jacket for daily use",
      "zh-Hant": "買一件適合日常穿着的舒適外套",
      ja: "普段使いの快適なジャケットを購入してほしい",
    },
    requiredFields: ["item", "size", "colour", "budget", "delivery location"],
  },
  {
    id: "event-ticket",
    domain: "events",
    actionFamily: "book",
    risk: "medium",
    goal: {
      en: "Find and book a concert ticket",
      "zh-Hant": "尋找並預訂一張演唱會門票",
      ja: "コンサートのチケットを探して予約してほしい",
    },
    requiredFields: ["event", "quantity", "date", "venue", "seat preference", "budget"],
  },
  {
    id: "restaurant-reservation",
    domain: "hospitality",
    actionFamily: "reserve",
    risk: "low",
    goal: {
      en: "Reserve a restaurant for dinner",
      "zh-Hant": "預訂一間適合晚餐的餐廳",
      ja: "夕食のレストランを予約してほしい",
    },
    requiredFields: ["cuisine preference", "participants", "date", "time", "location", "budget"],
  },
  {
    id: "hotel-booking",
    domain: "hospitality",
    actionFamily: "book",
    risk: "medium",
    goal: {
      en: "Book a hotel for a short trip",
      "zh-Hant": "為短途旅程預訂酒店",
      ja: "短い旅行のホテルを予約してほしい",
    },
    requiredFields: ["destination", "check-in date", "check-out date", "participants", "room preference", "budget"],
  },
  {
    id: "flight-booking",
    domain: "travel",
    actionFamily: "book",
    risk: "high",
    goal: {
      en: "Find and book a suitable flight",
      "zh-Hant": "尋找並預訂合適的航班",
      ja: "条件に合う航空便を探して予約してほしい",
    },
    requiredFields: ["origin", "destination", "departure date", "participants", "class preference", "identity", "budget", "approval"],
  },
  {
    id: "local-transport",
    domain: "travel",
    actionFamily: "arrange",
    risk: "low",
    goal: {
      en: "Arrange transport to my destination",
      "zh-Hant": "安排前往目的地的交通",
      ja: "目的地までの移動手段を手配してほしい",
    },
    requiredFields: ["origin", "destination", "time", "transport preference", "accessibility"],
  },
  {
    id: "parcel-shipping",
    domain: "logistics",
    actionFamily: "ship",
    risk: "medium",
    goal: {
      en: "Send a parcel to the recipient",
      "zh-Hant": "把包裹寄給收件人",
      ja: "荷物を受取人へ発送してほしい",
    },
    requiredFields: ["origin", "delivery location", "recipient", "package size", "deadline", "payment"],
  },
  {
    id: "home-repair",
    domain: "home-services",
    actionFamily: "repair",
    risk: "medium",
    goal: {
      en: "Arrange a technician to repair a problem at home",
      "zh-Hant": "安排技師上門處理家中故障",
      ja: "自宅の不具合を修理する技術者を手配してほしい",
    },
    requiredFields: ["service", "issue specification", "delivery location", "date", "time", "budget"],
  },
  {
    id: "cleaning-service",
    domain: "home-services",
    actionFamily: "clean",
    risk: "low",
    goal: {
      en: "Arrange a home cleaning service",
      "zh-Hant": "安排家居清潔服務",
      ja: "自宅の清掃サービスを手配してほしい",
    },
    requiredFields: ["service", "delivery location", "date", "duration", "scope specification", "budget"],
  },
  {
    id: "healthcare-appointment",
    domain: "healthcare",
    actionFamily: "schedule",
    risk: "high",
    goal: {
      en: "Schedule a suitable healthcare appointment",
      "zh-Hant": "安排合適的醫療預約",
      ja: "適切な医療予約を手配してほしい",
    },
    requiredFields: ["service", "symptom", "urgency", "location", "date", "time", "identity", "contact"],
  },
  {
    id: "pet-care",
    domain: "pet-care",
    actionFamily: "care",
    risk: "medium",
    goal: {
      en: "Arrange care for my pet",
      "zh-Hant": "為我的寵物安排照護服務",
      ja: "ペットの世話を手配してほしい",
    },
    requiredFields: ["service", "pet type", "date", "time", "location", "contact", "budget"],
  },
  {
    id: "tutoring",
    domain: "education",
    actionFamily: "schedule",
    risk: "low",
    goal: {
      en: "Arrange a tutoring lesson",
      "zh-Hant": "安排一堂補習課",
      ja: "個別指導の授業を手配してほしい",
    },
    requiredFields: ["subject", "level", "date", "time", "duration", "learning preference", "budget"],
  },
  {
    id: "meeting-schedule",
    domain: "calendar",
    actionFamily: "schedule",
    risk: "low",
    goal: {
      en: "Schedule a meeting with the right participants",
      "zh-Hant": "與合適的參與者安排會議",
      ja: "必要な参加者との会議を設定してほしい",
    },
    requiredFields: ["participants", "date", "time", "duration", "purpose", "location"],
  },
  {
    id: "email-send",
    domain: "communication",
    actionFamily: "send",
    risk: "medium",
    goal: {
      en: "Prepare and send an email",
      "zh-Hant": "準備並發送一封電郵",
      ja: "メールを作成して送信してほしい",
    },
    requiredFields: ["recipient", "purpose", "message specification", "contact", "approval"],
  },
  {
    id: "document-prepare",
    domain: "documents",
    actionFamily: "prepare",
    risk: "low",
    goal: {
      en: "Prepare a document for submission",
      "zh-Hant": "準備一份可提交的文件",
      ja: "提出用の書類を準備してほしい",
    },
    requiredFields: ["document", "purpose", "recipient", "deadline", "specification"],
  },
  {
    id: "job-application",
    domain: "employment",
    actionFamily: "apply",
    risk: "high",
    goal: {
      en: "Find and prepare a suitable job application",
      "zh-Hant": "尋找並準備合適的求職申請",
      ja: "適切な求人を探して応募準備をしてほしい",
    },
    requiredFields: ["role preference", "location", "budget", "document", "identity", "contact", "approval"],
  },
  {
    id: "government-form",
    domain: "government",
    actionFamily: "submit",
    risk: "high",
    goal: {
      en: "Prepare and submit a government service form",
      "zh-Hant": "準備並提交政府服務表格",
      ja: "行政サービスの申請書を準備して提出してほしい",
    },
    requiredFields: ["service", "identity", "document", "contact", "deadline", "approval"],
  },
  {
    id: "insurance-claim",
    domain: "insurance",
    actionFamily: "claim",
    risk: "high",
    goal: {
      en: "Prepare an insurance claim",
      "zh-Hant": "準備一項保險索償",
      ja: "保険請求を準備してほしい",
    },
    requiredFields: ["service", "account", "date", "evidence", "document", "contact", "approval"],
  },
  {
    id: "bank-transfer",
    domain: "finance",
    actionFamily: "transfer",
    risk: "critical",
    goal: {
      en: "Prepare a bank transfer",
      "zh-Hant": "準備一筆銀行轉帳",
      ja: "銀行振込を準備してほしい",
    },
    requiredFields: ["recipient", "amount", "currency", "account", "purpose", "approval"],
  },
  {
    id: "office-procurement",
    domain: "office",
    actionFamily: "procure",
    risk: "medium",
    goal: {
      en: "Procure supplies for the office",
      "zh-Hant": "為辦公室採購物資",
      ja: "オフィス用品を調達してほしい",
    },
    requiredFields: ["item", "quantity", "specification", "budget", "delivery location", "approval"],
  },
  {
    id: "manufacturing-order",
    domain: "manufacturing",
    actionFamily: "order",
    risk: "high",
    goal: {
      en: "Arrange a small manufacturing order",
      "zh-Hant": "安排一項小型生產訂單",
      ja: "小規模な製造注文を手配してほしい",
    },
    requiredFields: ["item", "specification", "quantity", "material", "deadline", "budget", "delivery location", "approval"],
  },
  {
    id: "subscription-cancel",
    domain: "subscription",
    actionFamily: "cancel",
    risk: "medium",
    goal: {
      en: "Cancel a subscription cleanly",
      "zh-Hant": "妥善取消一項訂閱服務",
      ja: "サブスクリプションを適切に解約してほしい",
    },
    requiredFields: ["service", "account", "date", "document", "approval"],
  },
];

const VARIANTS: Variant[] = [
  {
    locale: "en",
    prefix: "Please ",
    suffix: ". Use my saved preferences and finish the simulated workflow.",
  },
  {
    locale: "zh-Hant",
    prefix: "請你",
    suffix: "，優先使用我的個人設定並在模擬世界完成。",
    factPatch: { quantity: 2 },
  },
  {
    locale: "ja",
    prefix: "",
    suffix: "。保存済みの設定を優先し、シミュレーション内で完了してください。",
    factPatch: { deadline: "flexible" },
  },
  {
    locale: "en",
    prefix: "I only know the outcome I want: ",
    suffix: ". Infer safe defaults, discover the rest, and do not ask me for non-essential database fields.",
    factPatch: { budget: "compare_first" },
  },
];

const FIELD_ALIASES: Record<string, string[]> = {
  item: ["requested item", "product", "商品", "品物"],
  quantity: ["quantity", "item count", "數量", "個数"],
  budget: ["budget", "spend limit", "預算", "予算"],
  amount: ["amount", "transfer amount", "金額", "振込額"],
  currency: ["currency", "幣別", "通貨"],
  size: ["size", "screen dimensions", "尺寸", "サイズ"],
  brand: ["brand preference", "maker", "品牌偏好", "ブランド希望"],
  colour: ["colour preference", "顏色", "色"],
  purpose: ["purpose", "use case", "用途", "目的"],
  origin: ["origin", "pickup location", "出發地", "出発地"],
  destination: ["destination", "arrival location", "目的地", "到着地"],
  delivery_location: ["delivery location", "shipping address", "配送地點", "配送先"],
  purchase_location: ["purchase location", "store preference", "購買地點", "購入先"],
  date: ["date", "available date", "日期", "日付"],
  time: ["time", "time slot", "時間", "時間帯"],
  deadline: ["deadline", "needed by", "期限", "納期"],
  duration: ["duration", "length", "時長", "所要時間"],
  participants: ["participants", "party size", "人數", "参加者"],
  recipient: ["recipient", "recipient contact", "收件人", "宛先"],
  contact: ["contact details", "contact token", "聯絡資料", "連絡先"],
  identity: ["identity", "identity token", "身份資料", "本人確認"],
  document: ["document", "required file", "文件", "書類"],
  account: ["account", "account token", "帳戶", "アカウント"],
  payment: ["payment method", "billing token", "付款方式", "支払い方法"],
  approval: ["approval", "authorization", "批准", "承認"],
  symptom: ["symptom", "medical condition", "症狀", "症状"],
  urgency: ["urgency", "priority", "緊急程度", "緊急度"],
  accessibility: ["accessibility", "mobility needs", "無障礙需要", "バリアフリー"],
  evidence: ["evidence", "proof file", "證據", "証拠"],
  specification: ["specification", "requirements", "規格", "仕様"],
  material: ["material", "component material", "材料", "素材"],
  service: ["service", "service type", "服務類型", "サービス"],
  event: ["event", "show preference", "演出", "公演"],
  preference: ["preference", "preferred option", "偏好", "希望"],
  generic: ["novel coordination field", "unseen protocol detail", "新型協調欄位", "未知の調整項目"],
};

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function makeRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function normalizedFieldSemantic(field: string): keyof typeof FIELD_ALIASES {
  const value = field.toLowerCase().replace(/[\s-]+/g, "_");
  if (/amount|金額|金额|振込額/.test(value)) return "amount";
  if (/quantity|count|數量|数量|個数|人數|人数|participant|guest|party_size/.test(value)) return /participant|guest|party|人數|人数/.test(value) ? "participants" : "quantity";
  if (/budget|spend|預算|预算|予算/.test(value)) return "budget";
  if (/currency|幣別|币种|通貨/.test(value)) return "currency";
  if (/screen|size|dimension|尺寸|尺碼|尺码|サイズ/.test(value)) return "size";
  if (/brand|maker|品牌|牌子|ブランド|メーカー/.test(value)) return "brand";
  if (/colour|color|顏色|颜色|色/.test(value)) return "colour";
  if (/purpose|use_case|usage|用途|目的/.test(value)) return "purpose";
  if (/origin|from|pickup|出發地|出发地|出発地/.test(value)) return "origin";
  if (/delivery|shipping|配送|送貨|送货/.test(value)) return "delivery_location";
  if (/purchase|store|shop|購買|购买|購入/.test(value)) return "purchase_location";
  if (/destination|arrival|目的地|到達地|到着地|location|地址|地點|地点/.test(value)) return "destination";
  if (/deadline|needed_by|lead_time|期限|交期|納期/.test(value)) return "deadline";
  if (/date|check-in|check-out|departure|incident|日期|入住|退房|日付/.test(value)) return "date";
  if (/time|slot|availability|時間|时间|時段|時間帯/.test(value)) return "time";
  if (/duration|length|hour|minute|night|時長|时长|所要時間/.test(value)) return "duration";
  if (/recipient|宛先|收件人/.test(value)) return "recipient";
  if (/contact|phone|email|聯絡|联络|連絡先/.test(value)) return "contact";
  if (/identity|passport|身份|身分|護照|护照|本人確認/.test(value)) return "identity";
  if (/document|file|resume|form|文件|檔案|档案|書類/.test(value)) return "document";
  if (/account|login|帳戶|账户|アカウント/.test(value)) return "account";
  if (/payment|billing|付款|支付|支払い/.test(value)) return "payment";
  if (/approval|authorization|批准|授權|授权|承認/.test(value)) return "approval";
  if (/symptom|condition|症狀|症状|病情/.test(value)) return "symptom";
  if (/urgency|priority|緊急|紧急/.test(value)) return "urgency";
  if (/accessibility|wheelchair|無障礙|无障碍|バリアフリー/.test(value)) return "accessibility";
  if (/evidence|proof|receipt|證據|证据|証拠/.test(value)) return "evidence";
  if (/specification|spec|requirements|model|規格|型號|型号|仕様/.test(value)) return "specification";
  if (/material|ingredient|component|材料|食材|素材/.test(value)) return "material";
  if (/service|repair|cleaning|appointment|服務|服务|維修|维修|預約|预约|サービス/.test(value)) return "service";
  if (/event|concert|show|ticket|演出|演唱會|演唱会|門票|门票|公演|チケット/.test(value)) return "event";
  if (/preference|preferred|cuisine|seat|class|room|偏好|喜好|菜式|座位|房型|希望/.test(value)) return "preference";
  if (/item|product|goods|food|meal|package|商品|產品|产品|物品|食物|包裹/.test(value)) return "item";
  return "generic";
}

function localizedField(field: string, locale: AsymptaUniversalLocale, variant: number) {
  const semantic = normalizedFieldSemantic(field);
  const aliases = FIELD_ALIASES[semantic];
  if (locale === "zh-Hant") return aliases.find((alias) => /[\u3400-\u9fff]/u.test(alias)) ?? field;
  if (locale === "ja") return [...aliases].reverse().find((alias) => /[\u3040-\u30ff\u3400-\u9fff]/u.test(alias)) ?? field;
  return aliases[variant % Math.max(1, aliases.length)] ?? field;
}

function caseIntent(archetype: Archetype, variant: Variant) {
  const goal = archetype.goal[variant.locale];
  if (variant.locale === "zh-Hant") return `${variant.prefix}${goal}${variant.suffix}`;
  return `${variant.prefix}${goal.charAt(0).toLowerCase()}${goal.slice(1)}${variant.suffix}`;
}

function caseFacts(archetype: Archetype, variant: Variant) {
  return {
    ...(archetype.facts ?? {}),
    ...(variant.factPatch ?? {}),
  };
}

export function generateUniversalUseCases(count = 100): AsymptaUniversalBenchmarkCase[] {
  const safeCount = Math.max(0, Math.floor(count));
  const cases: AsymptaUniversalBenchmarkCase[] = [];

  for (let index = 0; index < safeCount; index += 1) {
    const archetype = ARCHETYPES[index % ARCHETYPES.length];
    const variantIndex = Math.floor(index / ARCHETYPES.length) % VARIANTS.length;
    const cycle = Math.floor(index / (ARCHETYPES.length * VARIANTS.length));
    const variant = VARIANTS[variantIndex];
    const requiredFields = archetype.requiredFields.map((field) => localizedField(field, variant.locale, variantIndex + cycle));
    if (cycle > 0) requiredFields.push(localizedField("novel coordination field", variant.locale, cycle));

    cases.push({
      id: `universal-${String(index + 1).padStart(3, "0")}`,
      title: `${archetype.id} · variant ${variantIndex + 1}`,
      archetypeId: archetype.id,
      variant: variantIndex,
      domain: archetype.domain,
      actionFamily: archetype.actionFamily,
      intent: caseIntent(archetype, variant),
      locale: variant.locale,
      risk: archetype.risk,
      requiredFields,
      facts: caseFacts(archetype, variant),
      profile: UNIVERSAL_BENCHMARK_PROFILE,
      mode: "benchmark",
      preauthorized: true,
    });
  }

  return cases;
}

function stressField(field: string, random: () => number, index: number) {
  const semantic = normalizedFieldSemantic(field);
  const aliases = FIELD_ALIASES[semantic];
  const alias = aliases[Math.floor(random() * aliases.length)] ?? field;
  const transforms = [
    (value: string) => value,
    (value: string) => value.replace(/\s+/g, "_"),
    (value: string) => ` ${value} `,
    (value: string) => `${value} / required`,
    (value: string) => `${value}（自動判斷）`,
    (value: string) => index % 2 ? value.toUpperCase() : value.toLowerCase(),
  ];
  return transforms[Math.floor(random() * transforms.length)](alias);
}

export function generateUniversalStressCases(input: {
  count?: number;
  seed?: number;
  baseCases?: AsymptaUniversalBenchmarkCase[];
} = {}): AsymptaUniversalBenchmarkCase[] {
  const count = Math.max(0, Math.floor(input.count ?? 400));
  const seed = input.seed ?? 20260831;
  const random = makeRandom(seed);
  const base = input.baseCases?.length ? input.baseCases : generateUniversalUseCases(100);
  const cases: AsymptaUniversalBenchmarkCase[] = [];

  for (let index = 0; index < count; index += 1) {
    const source = base[Math.floor(random() * base.length)];
    const fields = (source.requiredFields ?? []).map((field) => stressField(field, random, index));
    if (index % 5 === 0) fields.push(stressField("novel coordination field", random, index));
    if (index % 7 === 0) fields.reverse();
    const noise = index % 3 === 0
      ? " Context may be incomplete; resolve safe details from profile and world state."
      : index % 3 === 1
        ? " — please avoid repeating questions already answered."
        : "";

    cases.push({
      ...source,
      id: `stress-${String(index + 1).padStart(4, "0")}-${stableHash(`${seed}:${source.id}:${index}`).toString(36)}`,
      title: `${source.title} · stress ${index + 1}`,
      requiredFields: fields,
      intent: `${source.intent}${noise}`,
      facts: {
        ...(source.facts ?? {}),
        ...(index % 11 === 0 ? { "novel coordination field": `seed-${seed}-${index}` } : {}),
      },
    });
  }

  return cases;
}

function failureFrom(caseInput: AsymptaUniversalBenchmarkCase, result: AsymptaUniversalTaskEnvelope): AsymptaUniversalBenchmarkFailure {
  return {
    id: caseInput.id,
    domain: caseInput.domain,
    locale: caseInput.locale ?? "en",
    status: result.status,
    stuckReason: result.stuckReason,
    humanInterventions: result.humanInterventions,
    steps: result.steps,
    unresolved: result.requirements.filter((requirement) => requirement.value === undefined).map((requirement) => requirement.key),
  };
}

function section(cases: AsymptaUniversalBenchmarkCase[]) {
  const results = cases.map((caseInput) => ({ caseInput, result: runUniversalTask(caseInput) }));
  const failures = results
    .filter(({ result }) => result.status !== "completed" || result.humanInterventions !== 0 || result.result?.completed !== true)
    .map(({ caseInput, result }) => failureFrom(caseInput, result));
  const totalSteps = results.reduce((sum, entry) => sum + entry.result.steps, 0);
  return {
    section: {
      total: results.length,
      completed: results.filter(({ result }) => result.status === "completed").length,
      stuck: failures.length,
      humanInterventions: results.reduce((sum, entry) => sum + entry.result.humanInterventions, 0),
      maxSteps: results.reduce((maximum, entry) => Math.max(maximum, entry.result.steps), 0),
      averageSteps: results.length ? Number((totalSteps / results.length).toFixed(2)) : 0,
      failures,
    } satisfies AsymptaUniversalBenchmarkSection,
    results,
  };
}

export function runUniversalBenchmark(input: {
  coreCount?: number;
  stressCount?: number;
  seed?: number;
} = {}): AsymptaUniversalBenchmarkReport {
  const seed = input.seed ?? 20260831;
  const coreCases = generateUniversalUseCases(input.coreCount ?? 100);
  const stressCases = generateUniversalStressCases({
    count: input.stressCount ?? 400,
    seed,
    baseCases: coreCases,
  });
  const core = section(coreCases);
  const stress = section(stressCases);
  const all = [...core.results, ...stress.results];
  const resolutionSources: Record<string, number> = {};
  const semantics: Record<string, number> = {};

  for (const { result } of all) {
    for (const requirement of result.requirements) {
      const source = requirement.source ?? "unresolved";
      resolutionSources[source] = (resolutionSources[source] ?? 0) + 1;
      semantics[requirement.semantic] = (semantics[requirement.semantic] ?? 0) + 1;
    }
  }

  const domains = [...new Set(coreCases.map((caseInput) => caseInput.domain))].sort();
  const locales = [...new Set(coreCases.map((caseInput) => caseInput.locale ?? "en"))].sort() as AsymptaUniversalLocale[];
  const total = core.section.total + stress.section.total;
  const completed = core.section.completed + stress.section.completed;
  const stuck = core.section.stuck + stress.section.stuck;
  const humanInterventions = core.section.humanInterventions + stress.section.humanInterventions;

  return {
    version: "asympta.benchmark/0.2",
    seed,
    core: core.section,
    stress: stress.section,
    total,
    completed,
    stuck,
    humanInterventions,
    domains,
    locales,
    resolutionSources,
    semantics,
    passed: total > 0 && completed === total && stuck === 0 && humanInterventions === 0,
  };
}

export function benchmarkSemantics(): AsymptaRequirementSemantic[] {
  return Object.keys(FIELD_ALIASES) as AsymptaRequirementSemantic[];
}
