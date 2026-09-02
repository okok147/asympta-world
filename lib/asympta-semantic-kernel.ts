import type {
  AsymptaCanonicalFact,
  AsymptaDataClass,
  AsymptaEffectClass,
  AsymptaTaskAnswerValue,
  AsymptaTaskEffect,
  AsymptaTaskRequirement,
} from "./asympta-task-kernel-types.ts";

function normalize(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s./-]+/g, "_")
    .replace(/[^\p{L}\p{N}_]+/gu, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

export function canonicalizeRequirementSemantic(value: string) {
  const normalized = normalize(value);
  if (/(?:max_?spend|spending_?limit|price_?ceiling)/u.test(normalized)) return "budget";
  if (/(?:travell?er_?count|guest_?count|attendee_?count|participant_?count|number_?of_?(?:travell?ers|guests|participants|attendees))/u.test(normalized)) return "participants";
  if (/(?:drop_?off_?address|dropoff_?address|ship_?to|shipping_?address|delivery_?(?:location|address)|收貨地址|收货地址|送貨地址|送货地址|配送先|配達先)/u.test(normalized)) return "delivery_location";
  if (/(?:payee|beneficiary|recipient|收件人|受取人)/u.test(normalized)) return "recipient";
  if (/(?:from_?location|departure_?(?:place|location|city)|origin|出發地|出发地|出発地)/u.test(normalized)) return "origin";
  if (/(?:to_?location|arrival_?(?:place|location|city)|destination|目的地)/u.test(normalized)) return "destination";
  if (/(?:contact_?(?:email|phone|details?)|email_?address|phone_?number|聯絡電郵|联络电邮|連絡先|contact)/u.test(normalized)) return "contact";
  if (/(?:meeting_?start_?time|start_?time|appointment_?time|^time$|時間|时間|時刻)/u.test(normalized)) return "time";
  if (/(?:due_?date|deadline|timeframe|needed_?by|期限|截止時間|截止时间|締切|納期)/u.test(normalized)) return "deadline";
  if (/(?:passport_?(?:details?|number)?|identity|government_?id|driver_?licen[cs]e|ssn|social_?security)/u.test(normalized)) return "identity";
  if (/(?:property_?(?:location|area|district)|preferred_?(?:area|district|neighbou?rhood)|house_?location|home_?location|樓盤地區|楼盘地区|物業地區|物业地区|房屋地區|房屋地区|住宅地區|住宅地区|希望地域|希望エリア|物件エリア)/u.test(normalized)) return "property_location";
  if (/(?:property_?type|home_?type|housing_?type|house_?type|房屋類型|房屋类型|物業類型|物业类型|住宅類型|住宅类型|房型|物件種別|住宅タイプ)/u.test(normalized)) return "property_type";
  if (/(?:bedrooms?|bed_?rooms?|number_?of_?bedrooms?|sleeping_?rooms?|睡房|睡房數|睡房数|房間數|房间数|寝室|寝室数|部屋数)/u.test(normalized)) return "bedrooms";
  if (/(?:financ(?:e|ing)|mortgage|loan|cash_?purchase|payment_?plan|按揭|貸款|贷款|現金購買|现金购买|付款方式|住宅ローン|融資|現金購入)/u.test(normalized)) return "financing";
  if (/(?:^|_)(?:movie|film)(?:_?(?:preference|title|name))?(?:_|$)|(?:電影|电影|影片|片名|観たい映画|映画名)/u.test(normalized)) return "movie_preference";
  if (/(?:cinema_?(?:area|location)?|theat(?:er|re)_?(?:area|location)?|戲院地區|戏院地区|影院地區|影院地区|映画館_?(?:の)?エリア)/u.test(normalized)) return "cinema_area";
  if (/(?:showtime|screening_?(?:time|session)?|session_?time|上映時間|上映时间|場次時間|场次时间|場次|场次|上映時刻)/u.test(normalized)) return "showtime";
  if (/(?:event_?(?:intent|name)|show|concert|artist|singer|band|演出|演唱會|演唱会|歌手|樂隊|乐队|公演|アーティスト|バンド)/u.test(normalized)) return "event_intent";
  if (/(?:screen_?size|display_?size|inch|螢幕尺寸|屏幕尺寸|画面サイズ|インチ)/u.test(normalized)) return "screen_size";
  if (/(?:budget|price_?range|max_?price|spend|預算|预算|予算|価格)/u.test(normalized)) return "budget";
  if (/(?:brand|maker|manufacturer|品牌|牌子|メーカー|ブランド)/u.test(normalized)) return "brand";
  if (/(?:participants?|people|guests?|attendees?|參與人數|参与人数|参加者)/u.test(normalized)) return "participants";
  if (/(?:quantity|count|number|數量|数量|張數|张数|個數|个数|枚数)/u.test(normalized)) return "quantity";
  if (/(?:purchase_?location|buy_?where|store_?preference|supplier|vendor|shop|store|acquisition_?channel|購買地點|购买地点|購買方式|供應商|供应商|商店|購入先|業者|店舗)/u.test(normalized)) return "acquisition_channel";
  if (/(?:fulfil|fulfill|delivery|pickup|shipping|receive|handover|配送|送貨|送货|取貨|取货|交付|受取|引渡)/u.test(normalized)) return "fulfilment";
  if (/(?:purpose|use_?case|usage|intended_?use|用途|目的|使用目的)/u.test(normalized)) return "purpose";
  if (/(?:model|type|specification|specs|requirements|capacity|range|型號|型号|類型|类型|規格|规格|容量|航程|モデル|種類|仕様|容量|航続)/u.test(normalized)) return "item_specification";
  if (/(?:compliance|regulatory|licen[cs]e|registration|permit|approval|合規|合规|監管|监管|牌照|執照|执照|登記|登记|許可|许可|規制|免許|登録|承認)/u.test(normalized)) return "compliance";
  if (normalized === "fulfilment") return "delivery_location";
  if (normalized === "event") return "event_intent";
  return normalized || "generic";
}

export function classifyDataClass(semanticValue: string, raw = ""): AsymptaDataClass {
  const semantic = canonicalizeRequirementSemantic(semanticValue);
  const value = normalize(semantic + "_" + raw);
  if (/(?:one_?time_?passcode|otp|passcode|password|api_?token|private_?key|access_?token|credential|secret|security_?(?:answer|question)|entry_?code|access_?code)/u.test(value)) return "credential";
  if (/(?:medical|health|symptom|diagnosis|genetic|biometric)/u.test(value)) return "health";
  if (/(?:passport|identity|government_?id|driver_?licen[cs]e|social_?security|ssn|date_?of_?birth|dob|birth)/u.test(value)) return "identity";
  if (/(?:bank|routing|account|payment|card|salary|financial|finance|tax_?(?:id|identifier)|amount)/u.test(value)) return "financial";
  if (/(?:insurance_?policy|precise_?gps|gps_?location|exact_?location|delivery_?location|address|contact|email|phone|mobile)/u.test(value)) return "sensitive_personal";
  if (/(?:recipient|preference|participants?)/u.test(value)) return "personal";
  return "public";
}

export function dataClassIsSensitive(dataClass: AsymptaDataClass) {
  return !["public", "personal"].includes(dataClass);
}

function stripNegatedEffects(intent: string) {
  return intent
    .replace(/\b(?:do\s+not|don't|never)\b[^.;!?。！？]*/giu, " ")
    .replace(/(?:不要|請勿|请勿|しないで|しない)\s*[^。！？;]*/gu, " ");
}

export function classifyTaskEffect(input: { intent: string; actionFamily?: string }): AsymptaTaskEffect {
  const intent = stripNegatedEffects(input.intent);
  const family = (input.actionFamily ?? "").toLowerCase();
  const combined = family + " " + intent;
  let effectClass: AsymptaEffectClass = "read";
  let matchedAction: string | undefined;

  const rules: Array<[AsymptaEffectClass, RegExp]> = [
    ["money_movement", /\b(?:wire|debit|pay|withdraw|remit|charge)\b|\btransfer\b(?!\s+(?:details?|instructions?|options?|information|plan)\b)|\brefund\b(?!\s+(?:amount|estimate|quote|details?|policy)\b)|\b(?:make|send|issue|authorize)\s+(?:a\s+)?payment\b|轉帳|转账|付款|退款|提款|振込|支払/iu],
    ["deletion", /\b(?:delete|remove|cancel|terminate)\b|刪除|删除|取消|削除/iu],
    ["publication", /\b(?:publish|announce|broadcast)\b|\bpost\b(?=\s+(?:the|this|that|an?|my|your|our|update|announcement|message)\b)|發布|发布|公開/iu],
    ["shipment", /\b(?:ship|dispatch|courier)\b|\brelease\b[^.;]{0,40}\b(?:parcel|shipment|package)\b|派送|寄送|発送/iu],
    ["application", /\b(?:apply|enroll)\b|\b(?:file|submit)\b[^.;]{0,35}\bapplication\b|申請|申请|報名|报名/iu],
    ["scheduling", /\b(?:schedule|reschedule|appointment)\b|安排|排期/iu],
    ["account_mutation", /\b(?:renew|register|subscribe|unsubscribe)\b|\b(?:open|update|change)\b[^.;]{0,40}\b(?:account|subscription|membership)\b|續期|续期|註冊|注册|更新|登録/iu],
    ["communicate", /\b(?:send|notify|forward)\b|\bemail\b(?=\s+(?!(?:only|draft|template)\b)(?:to\s+)?[\p{L}\w@])|發送|发送|送信/iu],
    ["external_commitment", /\b(?:buy|purchase|order|book|reserve|commit|authorize|accept|sign|hire|bid|procure|submit)\b|\bbinding\b[^.;]{0,35}\b(?:order|agreement|quote)\b|\block\s+in\b|購買|购买|訂購|订购|預訂|预订|購入|注文|予約|接受|簽署|签署/iu],
  ];

  for (const [candidate, pattern] of rules) {
    const match = pattern.exec(combined);
    if (!match) continue;
    effectClass = candidate;
    matchedAction = match[0];
    break;
  }
  const externalWrite = effectClass !== "read";
  return {
    effectClass,
    requiresApproval: externalWrite,
    externalWrite,
    ...(matchedAction ? { matchedAction } : {}),
  };
}

function currencyCode(value: string) {
  const upper = value.toUpperCase().replace(/\s+/g, "");
  if (["HKD", "HK$", "港幣", "港币"].includes(upper)) return "HKD";
  if (["USD", "US$", "$", "USDOLLARS", "USDOLLAR"].includes(upper)) return "USD";
  if (["EUR", "€", "EURO", "EUROS"].includes(upper)) return "EUR";
  if (["JPY", "¥", "YEN", "JAPANESEYEN", "日圓", "日元"].includes(upper)) return "JPY";
  if (["GBP", "£", "POUND", "POUNDS", "BRITISHPOUNDS"].includes(upper)) return "GBP";
  if (["SGD", "S$"].includes(upper)) return "SGD";
  if (["AUD", "A$"].includes(upper)) return "AUD";
  if (["CAD", "C$"].includes(upper)) return "CAD";
  if (["CNY", "RMB", "CN¥"].includes(upper)) return "CNY";
  if (["TWD", "NT$"].includes(upper)) return "TWD";
  if (["KRW", "₩"].includes(upper)) return "KRW";
  return upper;
}

function lastCapture(input: string, patterns: RegExp[]) {
  let latest: { index: number; value: string } | null = null;
  for (const pattern of patterns) {
    for (const match of input.matchAll(pattern)) {
      const value = (match[1] ?? "").trim();
      if (!value) continue;
      const index = match.index ?? 0;
      if (!latest || index >= latest.index) latest = { index, value };
    }
  }
  return latest?.value ?? null;
}

function isExplicitlyMissing(intent: string, semantic: string) {
  const labels: Record<string, string> = {
    quantity: "quantity|count",
    budget: "budget",
    participants: "participants?|participant count|travell?er count",
    time: "time",
    recipient: "recipient|payee",
    destination: "destination|to location",
    origin: "origin|from location",
    currency: "currency",
    deadline: "deadline|due date",
    service: "service",
    contact: "contact",
  };
  const label = labels[semantic];
  if (!label) return false;
  return new RegExp("\\b(?:" + label + ")\\b\\s+(?:is\\s+)?(?:not\\s+provided|not\\s+specified|unknown|missing)", "iu").test(intent);
}

export function resolveExplicitRequirementValue(intent: string, key: string): { value: AsymptaTaskAnswerValue; label: string } | null {
  const semantic = canonicalizeRequirementSemantic(key);
  const cleanIntent = intent.trim();
  if (isExplicitlyMissing(cleanIntent, semantic)) return null;

  if (semantic === "budget") {
    if (/(?:premium|high[- ]?end|flagship|高階|高端|旗艦|旗舰)/iu.test(cleanIntent)) return { value: "premium", label: "高階 / Premium" };
    const moneyPattern = /((?:HK|US|S|A|C|NT)\$|CN¥|[$€£¥₩]|HKD|USD|EUR|JPY|GBP|SGD|AUD|CAD|CNY|RMB|TWD|KRW|港幣|港币|日圓|日元)\s*(\d{1,7}(?:,\d{3})*)/giu;
    let latest: RegExpMatchArray | null = null;
    for (const match of cleanIntent.matchAll(moneyPattern)) latest = match;
    if (latest && /(?:budget|預算|预算|予算)/iu.test(cleanIntent)) {
      const amount = Number(latest[2].replace(/,/g, ""));
      const code = currencyCode(latest[1]);
      return { value: amount, label: code + " " + latest[2] };
    }
    const budget = lastCapture(cleanIntent, [/(?:\bbudget\b|預算|预算|予算)(?:\s+(?:of|is)|\s*[:=])?\s*(\d{1,7}(?:,\d{3})*)/giu]);
    if (budget) return { value: Number(budget.replace(/,/g, "")), label: budget };
  }

  if (semantic === "screen_size" || semantic === "size") {
    const size = lastCapture(cleanIntent, [/(\d{2,3})\s*(?:inch|inches|"|吋|英寸|インチ)/giu]);
    if (size) return { value: size + "-inch", label: size + "″" };
  }

  if (semantic === "brand") {
    const brands = ["Samsung", "LG", "Sony", "TCL", "Hisense", "Panasonic", "Philips", "Apple", "Lenovo", "Dell", "Nike", "Adidas"];
    const brand = [...brands].reverse().find((candidate) => cleanIntent.toLowerCase().split(/[^a-z0-9]+/u).includes(candidate.toLowerCase()));
    if (brand) return { value: brand.toLowerCase(), label: brand };
    if (/(?:no brand preference|any brand|沒有品牌偏好|无品牌偏好|品牌不限|ブランド指定なし)/iu.test(cleanIntent)) return { value: "no_preference", label: "沒有品牌偏好" };
  }

  if (semantic === "purpose") {
    if (/(?:gaming|game|遊戲|游戏|ゲーム)/iu.test(cleanIntent)) return { value: "gaming", label: "Gaming" };
    if (/(?:movie|film|streaming|電影|电影|串流|映画)/iu.test(cleanIntent)) return { value: "movies_streaming", label: "電影／串流" };
    if (/(?:sport|football|sports|體育|体育|運動|スポーツ)/iu.test(cleanIntent)) return { value: "sports", label: "體育賽事" };
  }

  if (semantic === "delivery_location" || semantic === "fulfilment") {
    if (/(?:store pickup|self collect|pickup|自取|門市自取|门市自取|店舗受取)/iu.test(cleanIntent)) return { value: "store_pickup", label: "門市自取" };
    if (/(?:deliver|delivery|ship|home|送貨|送货|配送|屋企|家中|自宅)/iu.test(cleanIntent)) return { value: "saved_home", label: "常用住址" };
  }

  if (semantic === "quantity") {
    const quantity = lastCapture(cleanIntent, [/(?:^|\s)(\d{1,3})\s*(?:tvs?|televisions?|items?|units?|tickets?|pieces?|台|部|個|个|件|份|張|张)(?=\s|[.,;!?。]|$)/giu]);
    if (quantity) return { value: Number(quantity), label: quantity };
    if (/(?:\ba\s+television\b|\bone\s+television\b|一台電視|一台电视)/iu.test(cleanIntent)) return { value: 1, label: "1" };
  }

  if (semantic === "participants") {
    const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
    const value = lastCapture(cleanIntent, [
      /\b(\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:participants?|people|guests?|attendees?)\b/giu,
      /(?:參與人數|参与人数)\s*(?:是|[:=])?\s*(\d{1,3})\s*人/gu,
      /参加者\s*(?:は|[:=])?\s*(\d{1,3})\s*人?/gu,
    ]);
    if (value) {
      const lower = value.toLowerCase();
      const number = /^\d+$/.test(lower) ? Number(lower) : words[lower];
      return { value: number, label: String(number) };
    }
  }

  if (semantic === "date") {
    const value = lastCapture(cleanIntent, [/\bdate\s*(?:is\b|[:=])\s*([^.;。]+)/giu, /日期\s*(?:是|[:=])\s*([^。；;]+)/gu, /日付\s*(?:は|[:=])\s*([^。；;]+)/gu]);
    if (value) return { value, label: value };
  }

  if (semantic === "time") {
    const value = lastCapture(cleanIntent, [/\btime\s*(?:is\b|[:=])\s*([0-2]?\d:[0-5]\d(?:\s*(?:am|pm))?)/giu, /時間\s*(?:是|[:=])\s*([0-2]?\d:[0-5]\d)/gu, /時間\s*(?:は|[:=])\s*([0-2]?\d:[0-5]\d)/gu]);
    if (value) return { value, label: value };
  }

  const textPatterns: Partial<Record<string, RegExp[]>> = {
    recipient: [/\brecipient\s*(?:is\b|[:=])\s*([^.;。]+)/giu, /\brecipient\s+(?!is\b|requirement\b)([^.;。]+)/giu, /收件人\s*(?:是|[:=])\s*([^。；;]+)/gu, /受取人\s*(?:は|[:=])\s*([^。；;]+)/gu],
    origin: [/\borigin\s*(?:is\b|[:=])\s*([^.;。]+)/giu, /出發地\s*(?:是|[:=])\s*([^。；;]+)/gu, /出发地\s*(?:是|[:=])\s*([^。；;]+)/gu, /出発地\s*(?:は|[:=])\s*([^。；;]+)/gu],
    destination: [/\bdestination\s*(?:is\b|[:=])\s*([^.;。]+)/giu, /目的地\s*(?:是|[:=])\s*([^。；;]+)/gu, /目的地\s*(?:は|[:=])\s*([^。；;]+)/gu],
    deadline: [/\bdeadline\s*(?:is\b|[:=])\s*([^.;。]+)/giu, /截止時間\s*(?:是|[:=])\s*([^。；;]+)/gu, /截止时间\s*(?:是|[:=])\s*([^。；;]+)/gu, /締切\s*(?:は|[:=])\s*([^。；;]+)/gu],
    service: [/\bservice\s+(?:needed\s+)?(?:is\b|[:=])\s*([^.;。]+)/giu],
  };
  if (textPatterns[semantic]) {
    const value = lastCapture(cleanIntent, textPatterns[semantic] ?? []);
    if (value) return { value, label: value };
  }

  if (semantic === "currency") {
    if (/\b(?:US|U\.S\.)\s+dollars?\b/iu.test(cleanIntent)) return { value: "USD", label: "USD" };
    if (/\b(?:Hong Kong|HK)\s+dollars?\b/iu.test(cleanIntent)) return { value: "HKD", label: "HKD" };
    if (/\beuros?\b/iu.test(cleanIntent)) return { value: "EUR", label: "EUR" };
    if (/\b(?:Japanese\s+)?yen\b/iu.test(cleanIntent)) return { value: "JPY", label: "JPY" };
    const explicit = lastCapture(cleanIntent, [/\bcurrency\s*(?:is\b|[:=])\s*(HKD|USD|EUR|JPY|GBP|SGD|AUD|CAD|CNY|RMB|TWD|KRW)\b/giu]);
    if (explicit) {
      const code = currencyCode(explicit);
      return { value: code, label: code };
    }
    let latest: RegExpMatchArray | null = null;
    for (const match of cleanIntent.matchAll(/\b(HKD|USD|EUR|JPY|GBP|SGD|AUD|CAD|CNY|RMB|TWD|KRW)\b/giu)) latest = match;
    if (latest) {
      const code = currencyCode(latest[1]);
      return { value: code, label: code };
    }
  }

  if (semantic === "contact") {
    const email = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu;
    let latest: RegExpMatchArray | null = null;
    for (const match of cleanIntent.matchAll(email)) latest = match;
    if (latest) return { value: latest[0], label: latest[0] };
    const phone = /(?:\+?\d[\d ()-]{6,}\d)/gu.exec(cleanIntent);
    if (phone) return { value: phone[0], label: phone[0] };
  }

  return null;
}

export function canonicalFactsFromRequirements(requirements: AsymptaTaskRequirement[], at: string): AsymptaCanonicalFact[] {
  return requirements.flatMap((requirement) => {
    if (!["resolved", "confirmed"].includes(requirement.status) || requirement.value === undefined) return [];
    const dataClass = requirement.dataClass ?? classifyDataClass(requirement.semantic, requirement.raw);
    return [{
      id: requirement.id + ":fact",
      semantic: canonicalizeRequirementSemantic(requirement.semantic),
      value: requirement.value,
      displayValue: requirement.displayValue ?? String(requirement.value),
      valueType: typeof requirement.value as "string" | "number" | "boolean",
      source: requirement.provenance?.source ?? "agent_inference",
      ...(requirement.provenance?.actorId ? { actorId: requirement.provenance.actorId } : {}),
      confidence: requirement.provenance?.confidence ?? 0,
      dataClass,
      sensitive: dataClassIsSensitive(dataClass),
      status: "asserted" as const,
      at: requirement.provenance?.at ?? at,
    }];
  });
}

export function upsertCanonicalFact(facts: AsymptaCanonicalFact[], requirement: AsymptaTaskRequirement, at: string) {
  if (requirement.value === undefined || !["resolved", "confirmed"].includes(requirement.status)) return facts;
  const semantic = canonicalizeRequirementSemantic(requirement.semantic);
  const existing = facts.find((fact) => fact.semantic === semantic);
  if (existing?.source === "human_confirmation" && requirement.provenance?.source !== "human_confirmation") return facts;
  const dataClass = requirement.dataClass ?? classifyDataClass(semantic, requirement.raw);
  const next: AsymptaCanonicalFact = {
    id: requirement.id + ":fact",
    semantic,
    value: requirement.value,
    displayValue: requirement.displayValue ?? String(requirement.value),
    valueType: typeof requirement.value as "string" | "number" | "boolean",
    source: requirement.provenance?.source ?? "agent_inference",
    ...(requirement.provenance?.actorId ? { actorId: requirement.provenance.actorId } : {}),
    confidence: requirement.provenance?.confidence ?? 0,
    dataClass,
    sensitive: dataClassIsSensitive(dataClass),
    status: "asserted",
    at: requirement.provenance?.at ?? at,
  };
  return [...facts.filter((fact) => fact.semantic !== semantic), next];
}
