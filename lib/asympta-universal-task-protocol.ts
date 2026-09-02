export type AsymptaUniversalLocale = "en" | "zh-Hant" | "ja";
export type AsymptaUniversalMode = "live" | "simulated" | "benchmark";
export type AsymptaUniversalRisk = "none" | "low" | "medium" | "high" | "critical";
export type AsymptaUniversalStatus =
  | "interpreting"
  | "planning"
  | "discovering"
  | "resolving"
  | "ready"
  | "executing"
  | "verifying"
  | "completed"
  | "needs_human"
  | "blocked"
  | "failed";

export type AsymptaFactSource =
  | "explicit"
  | "profile"
  | "world"
  | "policy"
  | "connector"
  | "simulation";

export type AsymptaRequirementSemantic =
  | "item"
  | "service"
  | "event"
  | "quantity"
  | "budget"
  | "amount"
  | "currency"
  | "size"
  | "brand"
  | "colour"
  | "purpose"
  | "preference"
  | "origin"
  | "destination"
  | "delivery_location"
  | "purchase_location"
  | "date"
  | "time"
  | "deadline"
  | "duration"
  | "participants"
  | "recipient"
  | "contact"
  | "identity"
  | "document"
  | "account"
  | "payment"
  | "approval"
  | "symptom"
  | "urgency"
  | "accessibility"
  | "evidence"
  | "specification"
  | "material"
  | "generic";

export type AsymptaRequirement = {
  id: string;
  raw: string;
  key: string;
  semantic: AsymptaRequirementSemantic;
  required: true;
  sensitive: boolean;
  consequential: boolean;
  value?: unknown;
  source?: AsymptaFactSource;
  confidence?: number;
  resolution?: "explicit" | "profile" | "world" | "policy" | "simulation" | "human";
};

export type AsymptaUniversalProfile = {
  id: string;
  locale?: AsymptaUniversalLocale;
  timezone?: string;
  homeLocation?: string;
  officeLocation?: string;
  currentLocation?: string;
  contactToken?: string;
  identityToken?: string;
  paymentToken?: string;
  accountToken?: string;
  documentToken?: string;
  policyToken?: string;
  evidenceToken?: string;
  budgetPolicy?: string;
  brandPreference?: string;
  sizePreference?: string;
  colourPreference?: string;
  fulfilmentPreference?: string;
  accessibilityPreference?: string;
  savedRecipients?: Record<string, string>;
  preferences?: Record<string, unknown>;
  authorizations?: {
    simulatedWrites?: boolean;
    liveLowRiskWrites?: boolean;
    liveSpendingLimit?: number;
  };
};

export type AsymptaUniversalCapability = {
  id: string;
  title: string;
  actionFamilies: string[];
  domains: string[];
  tags: string[];
  readOnly?: boolean;
  canDiscover?: string[];
  simulated?: boolean;
};

export type AsymptaCommunicationPacketKind =
  | "intent"
  | "requirements"
  | "fact"
  | "question"
  | "proposal"
  | "decision"
  | "handoff"
  | "execution"
  | "verification"
  | "exception"
  | "result";

export type AsymptaCommunicationPacket = {
  id: string;
  taskId: string;
  sequence: number;
  kind: AsymptaCommunicationPacketKind;
  sender: string;
  recipient: string;
  summary: string;
  data?: Record<string, unknown>;
  provenance: {
    mode: AsymptaUniversalMode;
    simulated: boolean;
  };
};

export type AsymptaUniversalTaskInput = {
  id?: string;
  domain: string;
  actionFamily: string;
  intent: string;
  locale?: AsymptaUniversalLocale;
  risk?: AsymptaUniversalRisk;
  requiredFields?: string[];
  facts?: Record<string, unknown>;
  profile?: AsymptaUniversalProfile;
  capabilities?: AsymptaUniversalCapability[];
  mode?: AsymptaUniversalMode;
  preauthorized?: boolean;
  maxSteps?: number;
};

export type AsymptaUniversalTaskEnvelope = {
  version: "asympta.task/0.2";
  taskId: string;
  mode: AsymptaUniversalMode;
  status: AsymptaUniversalStatus;
  domain: string;
  actionFamily: string;
  intent: {
    raw: string;
    locale: AsymptaUniversalLocale;
  };
  risk: AsymptaUniversalRisk;
  profileId: string | null;
  requirements: AsymptaRequirement[];
  selectedCapability: AsymptaUniversalCapability | null;
  packets: AsymptaCommunicationPacket[];
  humanInterventions: number;
  steps: number;
  result: {
    completed: boolean;
    simulated: boolean;
    summary: string;
    value?: unknown;
  } | null;
  stuckReason: string | null;
};

export type UniversalMcpPreparationOptions = {
  mode?: AsymptaUniversalMode;
  locale?: AsymptaUniversalLocale;
  timezone?: string;
  profile?: AsymptaUniversalProfile;
  preauthorized?: boolean;
};

export type UniversalMcpPreparation = {
  arguments: Record<string, unknown>;
  missing: string[];
  resolutions: Array<{
    field: string;
    source: AsymptaFactSource;
    value: unknown;
  }>;
};

type JsonRecord = Record<string, unknown>;

type UniversalMcpToolLike = {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: unknown;
  annotations?: unknown;
};

const CONVERSATIONAL_STRING_FIELDS = new Set([
  "q",
  "query",
  "text",
  "message",
  "input",
  "intent",
  "request",
  "prompt",
  "description",
  "instructions",
  "notes",
  "search",
]);

const WRITE_ACTION_PATTERN = /(?:buy|purchase|book|reserve|order|send|submit|publish|delete|cancel|pay|transfer|refund|dispatch|ship|apply|accept|sign|renew|claim|hire|schedule|購買|购买|預訂|预订|訂購|订购|發送|发送|提交|付款|轉帳|转账|取消|申請|申请|簽署|签署|予約|購入|注文|送信|提出|支払|振込|キャンセル|申請)/iu;
const MONEY_FIELD_PATTERN = /(?:\b(?:amount|price|budget|cost|spend|total|fare|fee|money)\b|金額|金额|價格|价格|預算|预算|費用|费用|予算|料金)/iu;
const AMOUNT_FIELD_PATTERN = /(?:\b(?:amount|total_due|transfer_amount|charge_amount|payment_amount|fare|fee)\b|金額|金额|付款金額|付款金额|轉帳金額|转账金额|支払額|振込額|料金)/iu;
const PAYMENT_FIELD_PATTERN = /(?:\b(?:payment|card|bank|wallet|billing|charge)\b|付款|支付|信用卡|銀行|银行|錢包|钱包|支払い|カード|銀行)/iu;
const IDENTITY_FIELD_PATTERN = /(?:\b(?:identity|passport|id(?:_?number)?|license|licence|hkid)\b|身分|身份|護照|护照|證件|证件|本人確認|身分証|パスポート)/iu;
const ACCOUNT_FIELD_PATTERN = /(?:\b(?:account|login|username|membership|subscription)\b|帳戶|账户|登入|會員|会员|アカウント|ログイン|会員)/iu;
const DOCUMENT_FIELD_PATTERN = /(?:\b(?:document|attachment|file|resume|cv|certificate|form)\b|文件|附件|檔案|档案|履歷|履历|證明|证明|表格|書類|添付|履歴書|証明書)/iu;
const CONTACT_FIELD_PATTERN = /(?:\b(?:contact|phone|email|mobile|recipient|attendee|participant)\b|聯絡|联络|電話|电话|電郵|电邮|收件人|參與者|参与者|連絡先|メール|宛先|参加者)/iu;
const LOCATION_FIELD_PATTERN = /(?:\b(?:location|address|destination|origin|city|area|venue|pickup|dropoff|delivery|shipping)\b|地點|地点|地址|目的地|出發地|出发地|城市|場館|场馆|取貨|取货|送貨|送货|配送|場所|住所|出発地|会場|受取|配送先)/iu;
const DATE_FIELD_PATTERN = /(?:\b(?:date|day|checkin|checkout|departure|arrival|incident_date|start_date|end_date)\b|日期|日子|入住|退房|出發日期|出发日期|事故日期|日付|チェックイン|チェックアウト|出発日|到着日)/iu;
const TIME_FIELD_PATTERN = /(?:\b(?:time|hour|slot|availability|schedule|departure_time|arrival_time)\b|時間|时间|時段|空閒|空闲|行程|時刻|時間帯|空き|予定)/iu;
const DEADLINE_FIELD_PATTERN = /(?:\b(?:deadline|due|needed_by|timeframe|lead_time)\b|期限|截止|需要時間|需要时间|交期|納期)/iu;
const QUANTITY_FIELD_PATTERN = /(?:\b(?:quantity|count|number|guests|passengers|party_size|units|items|people|tickets)\b|數量|数量|人數|人数|乘客|張數|张数|件數|件数|個数|枚数)/iu;
const BUDGET_FIELD_PATTERN = /(?:\b(?:budget|max_price|price_range|spend_limit)\b|預算|预算|價格範圍|价格范围|上限|予算|価格帯)/iu;
const CURRENCY_FIELD_PATTERN = /(?:\b(?:currency)\b|幣別|币种|貨幣|货币|通貨)/iu;
const SIZE_FIELD_PATTERN = /(?:\b(?:size|screen|inch|dimensions|measurements)\b|尺碼|尺码|尺寸|螢幕|屏幕|吋|サイズ|画面|インチ|寸法)/iu;
const BRAND_FIELD_PATTERN = /(?:\b(?:brand|maker|manufacturer)\b|品牌|牌子|製造商|制造商|ブランド|メーカー)/iu;
const COLOUR_FIELD_PATTERN = /(?:\b(?:colour|color)\b|顏色|颜色|色)/iu;
const PURPOSE_FIELD_PATTERN = /(?:\b(?:purpose|use_case|usage|reason)\b|用途|目的|使用情境|使用场景)/iu;
const ORIGIN_FIELD_PATTERN = /(?:\b(?:origin|from|pickup_location|departure_city)\b|出發地|出发地|起點|起点|取件地點|取件地点|出発地)/iu;
const DESTINATION_FIELD_PATTERN = /(?:\b(?:destination|to|delivery_location|shipping_address|dropoff|arrival_city)\b|目的地|配送地點|配送地点|送貨地址|送货地址|到達地|到达地|配送先|到着地)/iu;
const PARTICIPANT_FIELD_PATTERN = /(?:\b(?:participant|attendee|guest|party_size|people|participants)\b|參與者|参与者|出席者|人數|人数|参加者|人数)/iu;
const DURATION_FIELD_PATTERN = /(?:\b(?:duration|length|hours|minutes|nights|days)\b|時長|时长|分鐘|分钟|晚數|晚数|日數|日数|所要時間|泊)/iu;
const APPROVAL_FIELD_PATTERN = /(?:\b(?:approval|consent|confirm|authorization|authorisation)\b|批准|同意|確認|确认|授權|授权|承認|認可)/iu;
const URGENCY_FIELD_PATTERN = /(?:\b(?:urgency|priority|severity|emergency)\b|緊急|紧急|優先|优先|嚴重|严重|緊急度|優先度|重症)/iu;
const SYMPTOM_FIELD_PATTERN = /(?:\b(?:symptom|condition|medical_issue)\b|症狀|症状|病情|徵狀|病況|体調|病状)/iu;
const ACCESSIBILITY_FIELD_PATTERN = /(?:\b(?:accessibility|wheelchair|mobility|hearing|vision)\b|無障礙|无障碍|輪椅|轮椅|行動不便|行动不便|バリアフリー|車いす|聴覚|視覚)/iu;
const EVIDENCE_FIELD_PATTERN = /(?:\b(?:evidence|proof|photo|receipt|record)\b|證據|证据|證明|证明|照片|收據|收据|証拠|証明|写真|領収書)/iu;
const SPECIFICATION_FIELD_PATTERN = /(?:\b(?:specification|spec|requirements|configuration|model)\b|規格|要求|配置|型號|型号|仕様|要件|構成|型番)/iu;
const MATERIAL_FIELD_PATTERN = /(?:\b(?:material|ingredient|part|component)\b|材料|食材|零件|部件|素材|部品|原料)/iu;
const ITEM_FIELD_PATTERN = /(?:\b(?:item|product|goods|food|meal|medicine|device|clothing|parcel|package)\b|商品|產品|产品|物品|食物|餐點|餐点|藥品|药品|設備|设备|衣物|包裹|品物|食事|薬|機器|衣類|荷物)/iu;
const SERVICE_FIELD_PATTERN = /(?:\b(?:service|repair|cleaning|appointment|consultation|lesson|care|maintenance)\b|服務|服务|維修|维修|清潔|清洁|預約|预约|諮詢|咨询|課堂|课堂|照護|照护|サービス|修理|清掃|予約|相談|レッスン|ケア)/iu;
const EVENT_FIELD_PATTERN = /(?:\b(?:event|concert|show|match|performance|ticket)\b|演出|演唱會|演唱会|音樂會|音乐会|比賽|比赛|場次|场次|門票|门票|イベント|コンサート|公演|試合|チケット)/iu;
const PREFERENCE_FIELD_PATTERN = /(?:\b(?:preference|preferred|option|style|type|cuisine|seat|class|room)\b|偏好|喜好|選項|选项|風格|风格|類型|类型|菜式|座位|艙等|舱等|房型|好み|希望|選択肢|スタイル|種類|料理|座席|クラス|部屋タイプ)/iu;

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function normalizeLocale(value: string | undefined): AsymptaUniversalLocale {
  const locale = (value ?? "en").toLowerCase();
  if (locale.startsWith("zh")) return "zh-Hant";
  if (locale.startsWith("ja")) return "ja";
  return "en";
}

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s./-]+/g, "_")
    .replace(/[^\p{L}\p{N}_]+/gu, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function tokenize(value: string) {
  return new Set(value.toLowerCase().split(/[^\p{L}\p{N}]+/gu).filter((token) => token.length > 1));
}

function semanticFromField(raw: string): AsymptaRequirementSemantic {
  const value = `${normalizeKey(raw)} ${raw}`;
  if (APPROVAL_FIELD_PATTERN.test(value)) return "approval";
  if (PAYMENT_FIELD_PATTERN.test(value)) return "payment";
  if (IDENTITY_FIELD_PATTERN.test(value)) return "identity";
  if (ACCOUNT_FIELD_PATTERN.test(value)) return "account";
  if (DOCUMENT_FIELD_PATTERN.test(value)) return "document";
  if (EVIDENCE_FIELD_PATTERN.test(value)) return "evidence";
  if (CONTACT_FIELD_PATTERN.test(value)) return "contact";
  if (URGENCY_FIELD_PATTERN.test(value)) return "urgency";
  if (SYMPTOM_FIELD_PATTERN.test(value)) return "symptom";
  if (ACCESSIBILITY_FIELD_PATTERN.test(value)) return "accessibility";
  if (ORIGIN_FIELD_PATTERN.test(value)) return "origin";
  if (DESTINATION_FIELD_PATTERN.test(value)) return "destination";
  if (/delivery|shipping|配送|送貨|送货|配送先/iu.test(value) && LOCATION_FIELD_PATTERN.test(value)) return "delivery_location";
  if (/purchase|store|shop|購買|购买|商店|購入|店舗/iu.test(value) && LOCATION_FIELD_PATTERN.test(value)) return "purchase_location";
  if (QUANTITY_FIELD_PATTERN.test(value)) return "quantity";
  if (AMOUNT_FIELD_PATTERN.test(value)) return "amount";
  if (BUDGET_FIELD_PATTERN.test(value)) return "budget";
  if (CURRENCY_FIELD_PATTERN.test(value)) return "currency";
  if (SIZE_FIELD_PATTERN.test(value)) return "size";
  if (BRAND_FIELD_PATTERN.test(value)) return "brand";
  if (COLOUR_FIELD_PATTERN.test(value)) return "colour";
  if (PURPOSE_FIELD_PATTERN.test(value)) return "purpose";
  if (DATE_FIELD_PATTERN.test(value)) return "date";
  if (DEADLINE_FIELD_PATTERN.test(value)) return "deadline";
  if (TIME_FIELD_PATTERN.test(value)) return "time";
  if (DURATION_FIELD_PATTERN.test(value)) return "duration";
  if (PARTICIPANT_FIELD_PATTERN.test(value)) return "participants";
  if (SPECIFICATION_FIELD_PATTERN.test(value)) return "specification";
  if (MATERIAL_FIELD_PATTERN.test(value)) return "material";
  if (EVENT_FIELD_PATTERN.test(value)) return "event";
  if (SERVICE_FIELD_PATTERN.test(value)) return "service";
  if (ITEM_FIELD_PATTERN.test(value)) return "item";
  if (PREFERENCE_FIELD_PATTERN.test(value)) return "preference";
  if (LOCATION_FIELD_PATTERN.test(value)) return "destination";
  return "generic";
}

function sensitiveSemantic(semantic: AsymptaRequirementSemantic) {
  return ["identity", "account", "payment", "symptom", "document", "evidence", "contact"].includes(semantic);
}

function consequentialSemantic(semantic: AsymptaRequirementSemantic) {
  return ["payment", "approval", "identity", "account", "amount"].includes(semantic);
}

function requirementFromField(field: string, index: number): AsymptaRequirement {
  const semantic = semanticFromField(field);
  const key = normalizeKey(field) || `field_${index + 1}`;
  return {
    id: `requirement:${key}:${index}`,
    raw: field.trim(),
    key,
    semantic,
    required: true,
    sensitive: sensitiveSemantic(semantic),
    consequential: consequentialSemantic(semantic),
  };
}

function explicitNumber(intent: string, semantic: AsymptaRequirementSemantic) {
  if (semantic === "quantity" || semantic === "participants" || semantic === "duration") {
    const latin = /(?:^|\s)(\d{1,4})(?:\s*(?:items?|people|guests?|passengers?|tickets?|units?|hours?|minutes?|days?|nights?))?/iu.exec(intent);
    if (latin) return Number(latin[1]);
    const cjk = /([一二兩两三四五六七八九十百\d]{1,4})\s*(?:個|个|件|份|人|位|張|张|枚|小時|小时|分鐘|分钟|日|天|晚|泊)/u.exec(intent);
    if (cjk && /^\d+$/.test(cjk[1])) return Number(cjk[1]);
  }
  if (semantic === "budget" || semantic === "amount") {
    const money = /(?:HK\$|HKD|\$|£|€|¥|港幣|港币|日圓|日元)?\s*(\d{2,7}(?:,\d{3})?)/iu.exec(intent);
    if (money) return Number(money[1].replace(/,/g, ""));
  }
  return null;
}

function explicitString(intent: string, semantic: AsymptaRequirementSemantic) {
  if (semantic === "size") {
    const match = /(\d{2,3})\s*(?:inch|inches|"|吋|英寸|インチ)/iu.exec(intent);
    if (match) return `${match[1]}-inch`;
  }
  if (semantic === "delivery_location" || semantic === "destination") {
    if (/\bhome\b|屋企|家中|自宅/iu.test(intent)) return "saved_home";
    if (/\boffice\b|公司|辦公室|办公室|職場/iu.test(intent)) return "saved_office";
    if (/pickup|self[- ]?collect|自取|取貨|取货|受け取り/iu.test(intent)) return "store_pickup";
  }
  if (semantic === "brand") {
    const brands = ["Samsung", "LG", "Sony", "TCL", "Hisense", "Apple", "Lenovo", "Dell", "Nike", "Adidas"];
    return brands.find((brand) => new RegExp(`\\b${brand}\\b`, "iu").test(intent)) ?? null;
  }
  if (semantic === "currency") {
    if (/HK\$|HKD|港幣|港币/iu.test(intent)) return "HKD";
    if (/US\$|USD/iu.test(intent)) return "USD";
    if (/JPY|日圓|日元|円/u.test(intent)) return "JPY";
  }
  return null;
}

function profileValue(profile: AsymptaUniversalProfile | undefined, requirement: AsymptaRequirement) {
  if (!profile) return undefined;
  const preference = profile.preferences?.[requirement.key];
  if (preference !== undefined) return preference;

  switch (requirement.semantic) {
    case "budget": return profile.budgetPolicy;
    case "amount": return profile.preferences?.amount;
    case "brand": return profile.brandPreference;
    case "size": return profile.sizePreference;
    case "colour": return profile.colourPreference;
    case "preference": return profile.preferences?.default;
    case "delivery_location": return profile.homeLocation ?? profile.currentLocation;
    case "destination": return profile.currentLocation ?? profile.homeLocation;
    case "origin": return profile.currentLocation ?? profile.homeLocation;
    case "purchase_location": return profile.preferences?.purchaseLocation;
    case "contact": return profile.contactToken;
    case "identity": return profile.identityToken;
    case "payment": return profile.paymentToken;
    case "account": return profile.accountToken;
    case "document": return profile.documentToken;
    case "evidence": return profile.evidenceToken;
    case "accessibility": return profile.accessibilityPreference;
    case "recipient": return profile.savedRecipients?.self ?? profile.contactToken;
    case "generic": return profile.preferences?.default;
    default: return profile.preferences?.[requirement.semantic];
  }
}

function safePolicyValue(requirement: AsymptaRequirement, locale: AsymptaUniversalLocale) {
  switch (requirement.semantic) {
    case "quantity": return 1;
    case "budget": return "compare_first";
    case "currency": return locale === "ja" ? "JPY" : "HKD";
    case "size": return "agent_choice";
    case "brand": return "no_preference";
    case "colour": return "no_preference";
    case "purpose": return "general_use";
    case "preference": return "agent_choice";
    case "purchase_location": return "best_available";
    case "delivery_location": return "saved_home";
    case "origin": return "current_location";
    case "destination": return "best_matching_location";
    case "date": return "earliest_available";
    case "time": return "best_available_time";
    case "deadline": return "flexible";
    case "duration": return "standard_duration";
    case "participants": return 1;
    case "recipient": return "self";
    case "service": return "best_matching_service";
    case "event": return "best_matching_event";
    case "item": return "best_matching_item";
    case "specification": return "agent_recommended_specification";
    case "material": return "best_available_material";
    case "urgency": return "normal";
    case "accessibility": return "no_special_requirement";
    case "symptom": return "routine_request";
    case "generic": return `discover:${requirement.key}`;
    default: return undefined;
  }
}

function capabilityCanDiscover(capability: AsymptaUniversalCapability | null, requirement: AsymptaRequirement) {
  if (!capability) return false;
  const fields = capability.canDiscover ?? [];
  return fields.includes("*")
    || fields.includes(requirement.key)
    || fields.includes(requirement.semantic);
}

function packet(
  envelope: AsymptaUniversalTaskEnvelope,
  kind: AsymptaCommunicationPacketKind,
  sender: string,
  recipient: string,
  summary: string,
  data?: Record<string, unknown>,
) {
  const next: AsymptaCommunicationPacket = {
    id: `${envelope.taskId}:packet:${envelope.packets.length + 1}`,
    taskId: envelope.taskId,
    sequence: envelope.packets.length + 1,
    kind,
    sender,
    recipient,
    summary,
    ...(data ? { data } : {}),
    provenance: {
      mode: envelope.mode,
      simulated: envelope.mode !== "live",
    },
  };
  envelope.packets.push(next);
  envelope.steps += 1;
  return next;
}

function capabilityScore(input: AsymptaUniversalTaskInput, capability: AsymptaUniversalCapability) {
  let score = 0;
  if (capability.domains.includes("*") || capability.domains.includes(input.domain)) score += 8;
  if (capability.actionFamilies.includes("*") || capability.actionFamilies.includes(input.actionFamily)) score += 7;
  const intentTokens = tokenize(input.intent);
  for (const token of tokenize([capability.title, ...capability.tags].join(" "))) {
    if (intentTokens.has(token)) score += token.length >= 6 ? 2 : 1;
  }
  if (capability.simulated && (input.mode ?? "benchmark") !== "live") score += 1;
  return score;
}

function selectCapability(input: AsymptaUniversalTaskInput) {
  const candidates = input.capabilities ?? DEFAULT_UNIVERSAL_CAPABILITIES;
  const ranked = candidates
    .map((capability) => ({ capability, score: capabilityScore(input, capability) }))
    .sort((left, right) => right.score - left.score || left.capability.id.localeCompare(right.capability.id));
  const best = ranked[0];
  if (best && best.score > 0) return best.capability;
  if ((input.mode ?? "benchmark") !== "live") {
    return DEFAULT_UNIVERSAL_CAPABILITIES.find((capability) => capability.id === "simulated-universal-coordinator") ?? null;
  }
  return null;
}

function writeAction(input: AsymptaUniversalTaskInput) {
  return WRITE_ACTION_PATTERN.test(`${input.actionFamily} ${input.intent}`);
}

function canAutoApprove(input: AsymptaUniversalTaskInput) {
  const mode = input.mode ?? "benchmark";
  if (!writeAction(input)) return true;
  if (mode === "benchmark" || mode === "simulated") {
    return input.preauthorized === true || input.profile?.authorizations?.simulatedWrites === true;
  }
  const risk = input.risk ?? "low";
  if (risk === "none" || risk === "low") {
    return input.profile?.authorizations?.liveLowRiskWrites === true && input.preauthorized === true;
  }
  return false;
}

function resolveRequirement(
  input: AsymptaUniversalTaskInput,
  requirement: AsymptaRequirement,
  capability: AsymptaUniversalCapability | null,
) {
  const locale = normalizeLocale(input.locale ?? input.profile?.locale);
  const supplied = input.facts?.[requirement.key] ?? input.facts?.[requirement.raw];
  if (supplied !== undefined && supplied !== null && supplied !== "") {
    return { value: supplied, source: "explicit" as const, resolution: "explicit" as const, confidence: 1 };
  }

  const explicit = explicitNumber(input.intent, requirement.semantic) ?? explicitString(input.intent, requirement.semantic);
  if (explicit !== null && explicit !== undefined) {
    return { value: explicit, source: "explicit" as const, resolution: "explicit" as const, confidence: 0.94 };
  }

  const fromProfile = profileValue(input.profile, requirement);
  if (fromProfile !== undefined && fromProfile !== null && fromProfile !== "") {
    return { value: fromProfile, source: "profile" as const, resolution: "profile" as const, confidence: 0.9 };
  }

  if ((input.mode ?? "benchmark") === "benchmark" && requirement.semantic === "generic" && !input.profile) {
    return null;
  }

  if (requirement.semantic === "approval") {
    return {
      value: (input.mode ?? "benchmark") === "live" ? "pending_policy_gate" : "preauthorized_simulation",
      source: "policy" as const,
      resolution: "policy" as const,
      confidence: 1,
    };
  }

  if (capabilityCanDiscover(capability, requirement)) {
    return {
      value: `discover:${requirement.semantic}:${requirement.key}`,
      source: "world" as const,
      resolution: "world" as const,
      confidence: 0.8,
    };
  }

  const policyValue = safePolicyValue(requirement, locale);
  if (policyValue !== undefined && !requirement.consequential) {
    return {
      value: policyValue,
      source: "policy" as const,
      resolution: "policy" as const,
      confidence: requirement.semantic === "generic" ? 0.62 : 0.76,
    };
  }

  if ((input.mode ?? "benchmark") !== "live") {
    return {
      value: `simulated:${requirement.semantic}:${requirement.key}`,
      source: "simulation" as const,
      resolution: "simulation" as const,
      confidence: 0.7,
    };
  }

  return null;
}

export function createUniversalTaskEnvelope(input: AsymptaUniversalTaskInput): AsymptaUniversalTaskEnvelope {
  const mode = input.mode ?? "benchmark";
  const locale = normalizeLocale(input.locale ?? input.profile?.locale);
  const taskId = input.id?.trim() || `task-${stableHash(`${input.domain}:${input.intent}`)}`;
  const requirements = (input.requiredFields ?? [])
    .map((field, index) => requirementFromField(field, index));

  return {
    version: "asympta.task/0.2",
    taskId,
    mode,
    status: "interpreting",
    domain: input.domain,
    actionFamily: input.actionFamily,
    intent: { raw: input.intent.trim(), locale },
    risk: input.risk ?? "low",
    profileId: input.profile?.id ?? null,
    requirements,
    selectedCapability: null,
    packets: [],
    humanInterventions: 0,
    steps: 0,
    result: null,
    stuckReason: null,
  };
}

export function runUniversalTask(input: AsymptaUniversalTaskInput): AsymptaUniversalTaskEnvelope {
  const envelope = createUniversalTaskEnvelope(input);
  const maxSteps = Math.max(12, Math.min(96, input.maxSteps ?? (12 + envelope.requirements.length * 2)));
  const signatures = new Set<string>();

  const checkLoop = () => {
    const signature = JSON.stringify({
      status: envelope.status,
      requirements: envelope.requirements.map((requirement) => [requirement.key, requirement.resolution ?? null]),
      capability: envelope.selectedCapability?.id ?? null,
    });
    if (signatures.has(signature)) {
      envelope.status = "failed";
      envelope.stuckReason = "state_loop_detected";
      packet(envelope, "exception", "verifier", "support", "A repeated state was detected and stopped.", { signature });
      return false;
    }
    signatures.add(signature);
    return true;
  };

  packet(envelope, "intent", "human", "personal-agent", input.intent, {
    domain: input.domain,
    actionFamily: input.actionFamily,
  });

  envelope.status = "planning";
  packet(envelope, "requirements", "personal-agent", "task-planner", "Compiled the request into atomic requirements.", {
    requirements: envelope.requirements.map((requirement) => ({
      key: requirement.key,
      semantic: requirement.semantic,
      sensitive: requirement.sensitive,
      consequential: requirement.consequential,
    })),
  });
  if (!checkLoop()) return envelope;

  envelope.status = "discovering";
  envelope.selectedCapability = selectCapability(input);
  if (!envelope.selectedCapability) {
    envelope.status = "blocked";
    envelope.stuckReason = "no_capability";
    packet(envelope, "exception", "capability-router", "personal-agent", "No compatible capability is available.");
    return envelope;
  }
  packet(envelope, "handoff", "capability-router", envelope.selectedCapability.id, "Selected the best available capability.", {
    capability: envelope.selectedCapability.id,
  });
  if (!checkLoop()) return envelope;

  envelope.status = "resolving";
  for (const requirement of envelope.requirements) {
    const resolved = resolveRequirement(input, requirement, envelope.selectedCapability);
    if (!resolved) {
      envelope.status = "needs_human";
      envelope.humanInterventions += 1;
      envelope.stuckReason = `unresolved:${requirement.key}`;
      requirement.resolution = "human";
      packet(envelope, "question", "personal-agent", "human", `A required detail could not be resolved safely: ${requirement.raw}.`, {
        requirement: requirement.key,
        semantic: requirement.semantic,
      });
      return envelope;
    }
    requirement.value = resolved.value;
    requirement.source = resolved.source;
    requirement.resolution = resolved.resolution;
    requirement.confidence = resolved.confidence;
    packet(envelope, "fact", resolved.source === "profile" ? "profile" : resolved.source === "world" ? "world" : "resolver", "task-planner", `Resolved ${requirement.raw}.`, {
      key: requirement.key,
      semantic: requirement.semantic,
      source: resolved.source,
      value: requirement.sensitive ? "[protected]" : resolved.value,
    });
    if (envelope.steps > maxSteps) {
      envelope.status = "failed";
      envelope.stuckReason = "step_limit_exceeded";
      packet(envelope, "exception", "verifier", "support", "The task exceeded its bounded step limit.");
      return envelope;
    }
  }
  if (!checkLoop()) return envelope;

  envelope.status = "ready";
  packet(envelope, "proposal", "task-planner", "policy-gate", "Prepared a bounded execution proposal.", {
    writeAction: writeAction(input),
    risk: envelope.risk,
    simulated: envelope.mode !== "live",
  });

  if (!canAutoApprove(input)) {
    envelope.status = "needs_human";
    envelope.humanInterventions += 1;
    envelope.stuckReason = "approval_required";
    packet(envelope, "question", "policy-gate", "human", "A consequential live action requires explicit approval.", {
      risk: envelope.risk,
      mode: envelope.mode,
    });
    return envelope;
  }

  packet(envelope, "decision", "policy-gate", envelope.selectedCapability.id, envelope.mode === "live"
    ? "The request is pre-authorized within the configured low-risk policy."
    : "The simulated request is pre-authorized for benchmark execution.", {
    preauthorized: true,
    mode: envelope.mode,
  });

  envelope.status = "executing";
  packet(envelope, "execution", envelope.selectedCapability.id, "world", "Executed the capability against the canonical task envelope.", {
    capability: envelope.selectedCapability.id,
    simulated: envelope.mode !== "live",
  });

  envelope.status = "verifying";
  const unresolved = envelope.requirements.filter((requirement) => requirement.value === undefined);
  const sequenceValid = envelope.packets.every((entry, index) => entry.sequence === index + 1);
  const verified = unresolved.length === 0 && sequenceValid && envelope.steps <= maxSteps;
  packet(envelope, "verification", "verifier", "personal-agent", verified
    ? "Verified terminal state, resolved requirements and packet ordering."
    : "Verification found an incomplete or inconsistent task.", {
    unresolved: unresolved.map((requirement) => requirement.key),
    sequenceValid,
    steps: envelope.steps,
    maxSteps,
  });

  if (!verified) {
    envelope.status = "failed";
    envelope.stuckReason = unresolved.length ? "unresolved_requirements" : "packet_sequence_invalid";
    return envelope;
  }

  envelope.status = "completed";
  envelope.result = {
    completed: true,
    simulated: envelope.mode !== "live",
    summary: envelope.mode === "live"
      ? "The connected capability completed and verified the task."
      : "The task completed and was verified inside the simulated Asympta world.",
    value: {
      capability: envelope.selectedCapability.id,
      requirementCount: envelope.requirements.length,
      packetCount: envelope.packets.length + 1,
    },
  };
  packet(envelope, "result", "personal-agent", "human", envelope.result.summary, {
    simulated: envelope.result.simulated,
    taskId: envelope.taskId,
  });
  return envelope;
}

function schemaType(schema: JsonRecord | null) {
  return typeof schema?.type === "string" ? schema.type : null;
}

function enumValues(schema: JsonRecord | null) {
  return Array.isArray(schema?.enum) ? schema.enum : [];
}

function schemaDefault(schema: JsonRecord | null) {
  if (!schema) return undefined;
  if ("const" in schema) return schema.const;
  if ("default" in schema) return schema.default;
  const values = enumValues(schema);
  return values.length === 1 ? values[0] : undefined;
}

function fieldDescription(field: string, schema: JsonRecord | null) {
  return [field, schema?.title, schema?.description].filter((value): value is string => typeof value === "string").join(" ");
}

function inferMcpValue(
  intent: string,
  field: string,
  fieldSchema: JsonRecord | null,
  options: UniversalMcpPreparationOptions,
) {
  const mode = options.mode ?? "live";
  const semantic = semanticFromField(fieldDescription(field, fieldSchema));
  const requirement = requirementFromField(field, 0);
  requirement.semantic = semantic;
  requirement.sensitive = sensitiveSemantic(semantic);
  requirement.consequential = consequentialSemantic(semantic) || MONEY_FIELD_PATTERN.test(fieldDescription(field, fieldSchema));

  const defaultValue = schemaDefault(fieldSchema);
  if (defaultValue !== undefined) return { value: defaultValue, source: "connector" as const };

  const type = schemaType(fieldSchema);
  const values = enumValues(fieldSchema);
  const lowerField = field.toLowerCase();
  if (type === "string" && (CONVERSATIONAL_STRING_FIELDS.has(lowerField) || lowerField.endsWith("_query"))) {
    return { value: intent, source: "explicit" as const };
  }
  if (lowerField === "locale" || lowerField === "language") {
    return { value: normalizeLocale(options.locale ?? options.profile?.locale), source: "profile" as const };
  }
  if (lowerField === "timezone" || lowerField === "time_zone") {
    return { value: options.timezone ?? options.profile?.timezone ?? "UTC", source: "profile" as const };
  }

  const explicit = explicitNumber(intent, semantic) ?? explicitString(intent, semantic);
  if (explicit !== null && explicit !== undefined) return { value: explicit, source: "explicit" as const };

  const fromProfile = profileValue(options.profile, requirement);
  if (fromProfile !== undefined && fromProfile !== null && fromProfile !== "") {
    return { value: fromProfile, source: "profile" as const };
  }

  if (values.length > 0 && mode !== "live") {
    return { value: values[0], source: "simulation" as const };
  }

  const policyValue = safePolicyValue(requirement, normalizeLocale(options.locale ?? options.profile?.locale));
  if (policyValue !== undefined && !requirement.consequential) {
    if (type === "number" || type === "integer") {
      if (typeof policyValue === "number") return { value: policyValue, source: "policy" as const };
      const minimum = typeof fieldSchema?.minimum === "number" ? fieldSchema.minimum : undefined;
      if (minimum !== undefined) return { value: minimum, source: "connector" as const };
      return null;
    }
    if (type === "boolean") return { value: false, source: "policy" as const };
    if (type === "string" || type === null) return { value: policyValue, source: "policy" as const };
  }

  if (mode !== "live" && (options.preauthorized || options.profile?.authorizations?.simulatedWrites)) {
    if (type === "number" || type === "integer") {
      const minimum = typeof fieldSchema?.minimum === "number" ? fieldSchema.minimum : 1;
      return { value: minimum, source: "simulation" as const };
    }
    if (type === "boolean") return { value: true, source: "simulation" as const };
    return { value: `simulated:${normalizeKey(field)}`, source: "simulation" as const };
  }

  return null;
}

export function prepareUniversalMcpArguments(
  intent: string,
  tool: UniversalMcpToolLike,
  options: UniversalMcpPreparationOptions = {},
): UniversalMcpPreparation {
  const schema = record(tool.inputSchema);
  if (!schema) return { arguments: {}, missing: [], resolutions: [] };
  const properties = record(schema.properties) ?? {};
  const required = Array.isArray(schema.required) ? schema.required.map(String) : [];
  const result: Record<string, unknown> = {};
  const missing: string[] = [];
  const resolutions: UniversalMcpPreparation["resolutions"] = [];

  for (const field of required) {
    const fieldSchema = record(properties[field]);
    const inferred = inferMcpValue(intent, field, fieldSchema, options);
    if (!inferred) {
      missing.push(field);
      continue;
    }
    result[field] = inferred.value;
    resolutions.push({ field, source: inferred.source, value: inferred.value });
  }

  return { arguments: result, missing, resolutions };
}

export const DEFAULT_UNIVERSAL_CAPABILITIES: AsymptaUniversalCapability[] = [
  {
    id: "information-discovery",
    title: "Information discovery and comparison",
    actionFamilies: ["search", "compare", "research", "find"],
    domains: ["*"],
    tags: ["search", "find", "compare", "research", "information"],
    readOnly: true,
    canDiscover: ["*"],
  },
  {
    id: "schedule-and-reserve",
    title: "Scheduling and reservation coordination",
    actionFamilies: ["schedule", "book", "reserve", "arrange"],
    domains: ["travel", "hospitality", "healthcare", "services", "education", "calendar", "events", "pet-care"],
    tags: ["schedule", "book", "reserve", "appointment", "meeting"],
    canDiscover: ["date", "time", "deadline", "destination", "participants", "service", "event", "preference"],
    simulated: true,
  },
  {
    id: "purchase-and-fulfil",
    title: "Purchase, fulfilment and delivery coordination",
    actionFamilies: ["buy", "purchase", "order", "procure", "deliver"],
    domains: ["food", "grocery", "retail", "electronics", "clothing", "office", "manufacturing", "pharmacy"],
    tags: ["buy", "purchase", "order", "procure", "delivery", "fulfilment"],
    canDiscover: ["item", "brand", "size", "colour", "budget", "purchase_location", "delivery_location", "material", "specification"],
    simulated: true,
  },
  {
    id: "communication-and-documents",
    title: "Communication and document coordination",
    actionFamilies: ["send", "write", "prepare", "submit", "apply", "publish"],
    domains: ["communication", "documents", "employment", "government", "insurance", "legal", "office"],
    tags: ["email", "message", "document", "form", "application", "submit"],
    canDiscover: ["contact", "recipient", "document", "evidence", "deadline", "preference"],
    simulated: true,
  },
  {
    id: "service-operations",
    title: "Service operations and field work",
    actionFamilies: ["repair", "clean", "maintain", "care", "inspect", "install"],
    domains: ["home-services", "vehicle", "pet-care", "childcare", "eldercare", "healthcare"],
    tags: ["repair", "maintenance", "cleaning", "care", "inspection", "installation"],
    canDiscover: ["service", "date", "time", "destination", "budget", "specification", "material"],
    simulated: true,
  },
  {
    id: "account-and-finance-administration",
    title: "Account, billing and finance administration",
    actionFamilies: ["pay", "transfer", "cancel", "renew", "claim", "refund", "manage"],
    domains: ["finance", "insurance", "subscription", "government", "utilities"],
    tags: ["payment", "transfer", "billing", "subscription", "insurance", "account"],
    canDiscover: ["account", "document", "evidence", "deadline", "currency"],
    simulated: true,
  },
  {
    id: "simulated-universal-coordinator",
    title: "Simulated universal coordination fallback",
    actionFamilies: ["*"],
    domains: ["*"],
    tags: ["coordinate", "simulate", "fallback"],
    canDiscover: ["*"],
    simulated: true,
  },
];
