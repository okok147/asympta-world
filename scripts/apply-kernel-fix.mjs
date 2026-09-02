import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";

function replaceRegex(source, regex, replacement, label) {
  if (!regex.test(source)) throw new Error(`Patch target not found: ${label}`);
  return source.replace(regex, replacement);
}

function patchFile(path, transform) {
  const before = readFileSync(path, "utf8");
  const after = transform(before);
  if (after === before) throw new Error(`No changes produced for ${path}`);
  writeFileSync(path, after);
  console.log(`patched ${path}`);
}

patchFile("lib/asympta-task-kernel-core-impl.ts", (source) => {
  source = replaceRegex(
    source,
    /function sensitiveRequirement\(key: string\) \{[\s\S]*?\n\}/,
    `function sensitiveRequirement(key: string) {
  return /(?:payment|card|account|identity|contact|document|address|medical|symptom|passport|phone|mobile|email|date[_\\s-]*of[_\\s-]*birth|\\bdob\\b|birth|tax[_\\s-]*(?:id|identifier)|social[_\\s-]*security|\\bssn\\b|biometric|driver[_\\s-]*licen[cs]e|licen[cs]e[_\\s-]*(?:id|number)|entry[_\\s-]*code|access[_\\s-]*code|security[_\\s-]*(?:answer|question)|credential|secret)/iu.test(key);
}`,
    "sensitiveRequirement",
  );

  source = replaceRegex(
    source,
    /function explicitRequirementValue\(intent: string, key: string\): \{ value: AsymptaTaskAnswerValue; label: string \} \| null \{[\s\S]*?\n\}(?=\n\nfunction event)/,
    `function explicitRequirementValue(intent: string, key: string): { value: AsymptaTaskAnswerValue; label: string } | null {
  const semantic = requirementSemantic(key);
  const cleanIntent = intent.trim();

  const currencyCode = (value: string) => {
    const upper = value.toUpperCase().replace(/\\s+/g, "");
    if (["HKD", "HK$", "港幣", "港币"].includes(upper)) return "HKD";
    if (["USD", "US$", "$", "USDOLLARS", "USDOLLAR", "USDOLLAR", "USDOLLARS"].includes(upper)) return "USD";
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
  };

  if (semantic === "budget") {
    if (/(?:premium|high[- ]?end|flagship|高階|高端|旗艦|旗舰)/iu.test(cleanIntent)) return { value: "premium", label: "高階 / Premium" };
    const money = /((?:HK|US|S|A|C|NT)\\$|CN¥|[$€£¥₩]|HKD|USD|EUR|JPY|GBP|SGD|AUD|CAD|CNY|RMB|TWD|KRW|港幣|港币|日圓|日元)\\s*(\\d{1,7}(?:,\\d{3})*)/iu.exec(cleanIntent);
    if (money) {
      const code = currencyCode(money[1]);
      const amount = Number(money[2].replace(/,/g, ""));
      return { value: amount, label: `${code} ${money[2]}` };
    }
    const budget = /(?:\\bbudget\\b|預算|预算|予算)(?:\\s+(?:of|is|=|:))?\\s*(\\d{1,7}(?:,\\d{3})*)/iu.exec(cleanIntent);
    if (budget) return { value: Number(budget[1].replace(/,/g, "")), label: budget[1] };
  }

  if (semantic === "size") {
    const match = /(\\d{2,3})\\s*(?:inch|inches|\"|吋|英寸|インチ)/iu.exec(cleanIntent);
    if (match) return { value: `${match[1]}-inch`, label: `${match[1]}″` };
  }

  if (semantic === "brand") {
    const brands = ["Samsung", "LG", "Sony", "TCL", "Hisense", "Panasonic", "Philips", "Apple", "Lenovo", "Dell", "Nike", "Adidas"];
    const brand = brands.find((candidate) => new RegExp(`\\\\b${candidate}\\\\b`, "iu").test(cleanIntent));
    if (brand) return { value: brand.toLowerCase(), label: brand };
    if (/(?:no brand preference|any brand|沒有品牌偏好|无品牌偏好|品牌不限|ブランド指定なし)/iu.test(cleanIntent)) {
      return { value: "no_preference", label: "沒有品牌偏好" };
    }
  }

  if (semantic === "purpose") {
    if (/(?:gaming|game|遊戲|游戏|ゲーム)/iu.test(cleanIntent)) return { value: "gaming", label: "Gaming" };
    if (/(?:movie|film|streaming|電影|电影|串流|映画)/iu.test(cleanIntent)) return { value: "movies_streaming", label: "電影／串流" };
    if (/(?:sport|football|sports|體育|体育|運動|スポーツ)/iu.test(cleanIntent)) return { value: "sports", label: "體育賽事" };
  }

  if (semantic === "delivery_location") {
    if (/(?:store pickup|self collect|pickup|自取|門市自取|门市自取|店舗受取)/iu.test(cleanIntent)) {
      return { value: "store_pickup", label: "門市自取" };
    }
    if (/(?:deliver|delivery|ship|home|送貨|送货|配送|屋企|家中|自宅)/iu.test(cleanIntent)) {
      return { value: "saved_home", label: "常用住址" };
    }
  }

  if (semantic === "quantity") {
    const match = /(?:^|\\s)(\\d{1,3})\\s*(?:tvs?|televisions?|items?|units?|tickets?|pieces?|台|部|個|个|件|份|張|张)(?=\\s|[.,;!?]|$)/iu.exec(cleanIntent);
    if (match) return { value: Number(match[1]), label: match[1] };
    if (/(?:\\ba\\s+television\\b|\\bone\\s+television\\b|一台電視|一台电视)/iu.test(cleanIntent)) return { value: 1, label: "1" };
  }

  if (semantic === "participants") {
    const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
    const match = /(?:\\b(\\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten)\\s+(?:participants?|people|guests?|attendees?)\\b)/iu.exec(cleanIntent);
    if (match) {
      const raw = match[1].toLowerCase();
      const value = /^\\d+$/.test(raw) ? Number(raw) : words[raw];
      return { value, label: String(value) };
    }
  }

  if (semantic === "date") {
    const match = /\\bdate\\s+(?:is|=|:)\\s*([^.;]+)/iu.exec(cleanIntent);
    if (match) return { value: match[1].trim(), label: match[1].trim() };
  }

  if (semantic === "time") {
    const match = /\\btime\\s+(?:is|=|:)\\s*([0-2]?\\d:[0-5]\\d(?:\\s*(?:am|pm))?)/iu.exec(cleanIntent);
    if (match) return { value: match[1].trim(), label: match[1].trim() };
  }

  if (semantic === "recipient") {
    const match = /\\brecipient\\s+(?:is|=|:)\\s*([^.;]+)/iu.exec(cleanIntent);
    if (match) return { value: match[1].trim(), label: match[1].trim() };
  }

  if (semantic === "origin") {
    const match = /\\borigin\\s+(?:is|=|:)\\s*([^.;]+)/iu.exec(cleanIntent);
    if (match) return { value: match[1].trim(), label: match[1].trim() };
  }

  if (semantic === "destination") {
    const match = /\\bdestination\\s+(?:is|=|:)\\s*([^.;]+)/iu.exec(cleanIntent);
    if (match) return { value: match[1].trim(), label: match[1].trim() };
  }

  if (semantic === "deadline") {
    const match = /\\bdeadline\\s+(?:is|=|:)\\s*([^.;]+)/iu.exec(cleanIntent);
    if (match) return { value: match[1].trim(), label: match[1].trim() };
  }

  if (semantic === "currency") {
    const match = /\\b(HKD|USD|EUR|JPY|GBP|SGD|AUD|CAD|CNY|RMB|TWD|KRW)\\b|\\b(US dollars?|euros?|Japanese yen|British pounds?)\\b/iu.exec(cleanIntent);
    if (match) {
      const code = currencyCode(match[1] ?? match[2]);
      return { value: code, label: code };
    }
  }

  if (semantic === "contact") {
    const email = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/iu.exec(cleanIntent);
    if (email) return { value: email[0], label: email[0] };
    const phone = /(?:\\+?\\d[\\d ()-]{6,}\\d)/u.exec(cleanIntent);
    if (phone) return { value: phone[0], label: phone[0] };
  }

  if (semantic === "service") {
    const match = /\\bservice\\s+(?:needed\\s+)?(?:is|=|:)\\s*([^.;]+)/iu.exec(cleanIntent);
    if (match) return { value: match[1].trim(), label: match[1].trim() };
  }

  return null;
}`,
    "explicitRequirementValue",
  );

  source = replaceRegex(
    source,
    /function unresolved\(task: AsymptaTaskState\) \{[\s\S]*?\n\}/,
    `function requirementIsSatisfied(requirement: AsymptaTaskRequirement) {
  return requirement.status === "resolved"
    || requirement.status === "confirmed"
    || requirement.status === "not_applicable";
}

function unresolved(task: AsymptaTaskState) {
  return task.requirements.filter((requirement) => requirement.required && !requirementIsSatisfied(requirement));
}`,
    "unresolved requirement invariant",
  );

  return source;
});

patchFile("lib/asympta-task-policy.ts", (source) => {
  source = replaceRegex(
    source,
    /const WRITE_PATTERN = \/[\s\S]*?\/iu;/,
    `const WRITE_PATTERN = /(?:buy|purchase|order|procure|book|reserve|send|submit|publish|delete|cancel|pay|transfer|hire|sign|approve|apply|refund|withdraw|renew|register|enroll|schedule|dispatch|ship|accept|claim|subscribe|unsubscribe|create|update|購買|购买|訂購|订购|預訂|预订|發送|发送|提交|發布|发布|刪除|删除|取消|付款|轉帳|转账|僱用|雇用|簽署|签署|申請|申请|退款|提款|續期|续期|註冊|注册|報名|报名|安排|派送|寄送|接受|索償|索赔|購入|注文|予約|送信|提出|公開|削除|支払|振込|申請|返金|引出|更新|登録|発送|受諾)/iu;`,
    "WRITE_PATTERN",
  );
  source = replaceRegex(
    source,
    /const CONSEQUENT_ACTION_FAMILY = \/[\s\S]*?\/iu;/,
    `const CONSEQUENT_ACTION_FAMILY = /(?:purchase|payment|transfer|booking|reservation|delete|cancel|publish|submit|send|hire|sign|commit|write|execute|apply|refund|withdraw|renew|register|enroll|schedule|dispatch|ship|accept|claim|subscribe|create|update)/iu;`,
    "CONSEQUENT_ACTION_FAMILY",
  );
  return source;
});

patchFile("lib/asympta-requirement-contracts.ts", (source) => {
  const marker = `  {\n    id: "commerce.consumer-electronics.purchase.v1",`;
  if (!source.includes(marker)) throw new Error("Contract insertion marker not found");
  const contracts = `  {
    id: "travel.flight.booking.v1",
    priority: 119,
    augmentation: "always",
    completionMode: "simulated_execution",
    proposalKind: "coordination",
    match: (context) => context.domain === "travel.flight" || (context.domain === "travel" && /book|booking/iu.test(context.actionFamily)),
    requirements: [
      { semantic: "origin", field: "origin" },
      { semantic: "destination", field: "destination" },
      { semantic: "departure_date", field: "departure date" },
      { semantic: "identity", field: "identity" },
      { semantic: "budget", field: "budget" },
    ],
  },
  {
    id: "hospitality.hotel.booking.v1",
    priority: 118,
    augmentation: "always",
    completionMode: "simulated_execution",
    proposalKind: "coordination",
    match: (context) => context.domain === "hospitality.hotel",
    requirements: [
      { semantic: "destination", field: "destination" },
      { semantic: "check_in_date", field: "check-in date" },
      { semantic: "check_out_date", field: "check-out date" },
      { semantic: "participants", field: "participants" },
      { semantic: "budget", field: "budget" },
    ],
  },
  {
    id: "hospitality.restaurant.reservation.v1",
    priority: 117,
    augmentation: "always",
    completionMode: "simulated_execution",
    proposalKind: "coordination",
    match: (context) => context.domain === "hospitality.restaurant" || (context.domain === "hospitality" && /reserve|reservation/iu.test(context.actionFamily)),
    requirements: [
      { semantic: "cuisine", field: "cuisine" },
      { semantic: "participants", field: "participants" },
      { semantic: "date", field: "date" },
      { semantic: "time", field: "time" },
      { semantic: "location", field: "location" },
    ],
  },
  {
    id: "healthcare.appointment.v1",
    priority: 116,
    augmentation: "always",
    completionMode: "simulated_execution",
    proposalKind: "coordination",
    match: (context) => context.domain === "healthcare",
    requirements: [
      { semantic: "service", field: "service" },
      { semantic: "symptom", field: "symptom" },
      { semantic: "urgency", field: "urgency" },
      { semantic: "identity", field: "identity" },
    ],
  },
  {
    id: "employment.application.v1",
    priority: 115,
    augmentation: "always",
    completionMode: "simulated_execution",
    proposalKind: "coordination",
    match: (context) => context.domain === "employment" || context.actionFamily === "apply",
    requirements: [
      { semantic: "role_preference", field: "role preference" },
      { semantic: "document", field: "document" },
      { semantic: "identity", field: "identity" },
      { semantic: "contact", field: "contact" },
      { semantic: "approval", field: "approval" },
    ],
  },
  {
    id: "government.submission.v1",
    priority: 114,
    augmentation: "always",
    completionMode: "simulated_execution",
    proposalKind: "coordination",
    match: (context) => context.domain === "government",
    requirements: [
      { semantic: "service", field: "service" },
      { semantic: "identity", field: "identity" },
      { semantic: "document", field: "document" },
      { semantic: "deadline", field: "deadline" },
      { semantic: "approval", field: "approval" },
    ],
  },
  {
    id: "finance.transfer.v1",
    priority: 113,
    augmentation: "always",
    completionMode: "simulated_execution",
    proposalKind: "coordination",
    match: (context) => context.domain === "finance" || context.actionFamily === "transfer",
    requirements: [
      { semantic: "recipient", field: "recipient" },
      { semantic: "amount", field: "amount" },
      { semantic: "currency", field: "currency" },
      { semantic: "account", field: "account" },
      { semantic: "approval", field: "approval" },
    ],
  },
  {
    id: "logistics.shipment.v1",
    priority: 112,
    augmentation: "always",
    completionMode: "simulated_execution",
    proposalKind: "coordination",
    match: (context) => context.domain === "logistics" || context.actionFamily === "ship",
    requirements: [
      { semantic: "origin", field: "origin" },
      { semantic: "delivery_location", field: "delivery location" },
      { semantic: "recipient", field: "recipient" },
      { semantic: "package_size", field: "package size" },
      { semantic: "payment", field: "payment" },
    ],
  },
  {
    id: "home-services.repair.v1",
    priority: 111,
    augmentation: "always",
    completionMode: "simulated_execution",
    proposalKind: "coordination",
    match: (context) => ["home_services", "home-services"].includes(context.domain) && context.actionFamily === "repair",
    requirements: [
      { semantic: "service", field: "service" },
      { semantic: "issue_specification", field: "issue specification" },
      { semantic: "delivery_location", field: "delivery location" },
      { semantic: "date", field: "date" },
      { semantic: "budget", field: "budget" },
    ],
  },
  {
    id: "calendar.meeting.v1",
    priority: 110,
    augmentation: "always",
    completionMode: "simulated_execution",
    proposalKind: "coordination",
    match: (context) => context.domain === "calendar",
    requirements: [
      { semantic: "participants", field: "participants" },
      { semantic: "date", field: "date" },
      { semantic: "time", field: "time" },
      { semantic: "duration", field: "duration" },
      { semantic: "purpose", field: "purpose" },
    ],
  },
`;
  return source.replace(marker, `${contracts}${marker}`);
});

patchFile("lib/asympta-universal-task-protocol.ts", (source) => {
  source = replaceRegex(
    source,
    /    case "accessibility": return profile\.accessibilityPreference;\n    case "recipient": return profile\.savedRecipients\?\.self \?\? profile\.contactToken;\n    default: return profile\.preferences\?\.\[requirement\.semantic\];/,
    `    case "accessibility": return profile.accessibilityPreference;
    case "recipient": return profile.savedRecipients?.self ?? profile.contactToken;
    case "generic": return profile.preferences?.default;
    default: return profile.preferences?.[requirement.semantic];`,
    "generic profile fallback",
  );

  source = replaceRegex(
    source,
    /  if \(requirement\.semantic === "approval"\) \{/,
    `  if ((input.mode ?? "benchmark") === "benchmark" && requirement.semantic === "generic") {
    return null;
  }

  if (requirement.semantic === "approval") {`,
    "benchmark generic truthfulness gate",
  );
  return source;
});

for (const path of ["scripts/apply-kernel-fix.mjs", ".github/workflows/kernel-fix-apply.yml"]) {
  if (existsSync(path)) rmSync(path);
}

console.log("Structural Task Kernel patch applied; temporary patch files removed from working tree.");
