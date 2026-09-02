import fs from "node:fs";

const path = "lib/asympta-semantic-kernel.ts";
let source = fs.readFileSync(path, "utf8");

function replaceOrThrow(needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`Missing semantic refinement anchor: ${label}`);
  source = source.replace(needle, replacement);
}

replaceOrThrow(
  '    ["money_movement", /\\b(?:wire|transfer|debit|refund|pay|payment|withdraw|remit|charge)\\b|轉帳|转账|付款|退款|提款|振込|支払/iu],',
  '    ["money_movement", /\\b(?:wire|debit|pay|withdraw|remit|charge)\\b|\\btransfer\\b(?!\\s+(?:details?|instructions?|options?|information|plan)\\b)|\\brefund\\b(?!\\s+(?:amount|estimate|quote|details?|policy)\\b)|\\b(?:make|send|issue|authorize)\\s+(?:a\\s+)?payment\\b|轉帳|转账|付款|退款|提款|振込|支払/iu],',
  "money movement must classify actions, not financial nouns",
);
replaceOrThrow(
  '    ["publication", /\\b(?:publish|post|announce|broadcast)\\b|發布|发布|公開/iu],',
  '    ["publication", /\\b(?:publish|announce|broadcast)\\b|\\bpost\\b(?=\\s+(?:the|this|that|an?|my|your|our|update|announcement|message)\\b)|發布|发布|公開/iu],',
  "publication must classify an active post action",
);
replaceOrThrow(
  '    ["application", /\\b(?:apply|application|enroll)\\b|\\bfile\\b[^.;]{0,35}\\bapplication\\b|申請|申请|報名|报名/iu],',
  '    ["application", /\\b(?:apply|enroll)\\b|\\b(?:file|submit)\\b[^.;]{0,35}\\bapplication\\b|申請|申请|報名|报名/iu],',
  "application noun must not imply execution",
);
replaceOrThrow(
  '    ["communicate", /\\b(?:send|email|message|notify|forward)\\b|發送|发送|送信/iu],',
  '    ["communicate", /\\b(?:send|notify|forward)\\b|\\bemail\\b(?=\\s+(?!(?:only|draft|template)\\b)(?:to\\s+)?[\\p{L}\\w@])|發送|发送|送信/iu],',
  "communication must classify an active send action",
);
replaceOrThrow(
  '    ["external_commitment", /\\b(?:buy|purchase|order|book|reserve|commit|authorize|accept|sign|hire|bid|procure)\\b|\\bbinding\\b[^.;]{0,35}\\b(?:order|agreement|quote)\\b|\\block\\s+in\\b|購買|购买|訂購|订购|預訂|预订|購入|注文|予約|接受|簽署|签署/iu],',
  '    ["external_commitment", /\\b(?:buy|purchase|order|book|reserve|commit|authorize|accept|sign|hire|bid|procure|submit)\\b|\\bbinding\\b[^.;]{0,35}\\b(?:order|agreement|quote)\\b|\\block\\s+in\\b|購買|购买|訂購|订购|預訂|预订|購入|注文|予約|接受|簽署|签署/iu],',
  "submit remains a consequential commitment",
);

replaceOrThrow(
  '    const value = lastCapture(cleanIntent, [/\\bdate\\s+(?:is|=|:)\\s*([^.;。]+)/giu, /日期\\s*(?:是|[:=])\\s*([^。；;]+)/gu, /日付\\s*(?:は|[:=])\\s*([^。；;]+)/gu]);',
  '    const value = lastCapture(cleanIntent, [/\\bdate\\s*(?:is\\b|[:=])\\s*([^.;。]+)/giu, /日期\\s*(?:是|[:=])\\s*([^。；;]+)/gu, /日付\\s*(?:は|[:=])\\s*([^。；;]+)/gu]);',
  "date colon/is binding",
);
replaceOrThrow(
  '    const value = lastCapture(cleanIntent, [/\\btime\\s+(?:is|=|:)\\s*([0-2]?\\d:[0-5]\\d(?:\\s*(?:am|pm))?)/giu, /時間\\s*(?:是|[:=])\\s*([0-2]?\\d:[0-5]\\d)/gu, /時間\\s*(?:は|[:=])\\s*([0-2]?\\d:[0-5]\\d)/gu]);',
  '    const value = lastCapture(cleanIntent, [/\\btime\\s*(?:is\\b|[:=])\\s*([0-2]?\\d:[0-5]\\d(?:\\s*(?:am|pm))?)/giu, /時間\\s*(?:是|[:=])\\s*([0-2]?\\d:[0-5]\\d)/gu, /時間\\s*(?:は|[:=])\\s*([0-2]?\\d:[0-5]\\d)/gu]);',
  "time colon/is binding",
);
replaceOrThrow(
  '    recipient: [/\\brecipient(?:\\s+is\\b|\\s*[:=]|\\s+)\\s*([^.;。]+)/giu, /收件人\\s*(?:是|[:=])\\s*([^。；;]+)/gu, /受取人\\s*(?:は|[:=])\\s*([^。；;]+)/gu],',
  '    recipient: [/\\brecipient\\s*(?:is\\b|[:=])\\s*([^.;。]+)/giu, /\\brecipient\\s+(?!is\\b|requirement\\b)([^.;。]+)/giu, /收件人\\s*(?:是|[:=])\\s*([^。；;]+)/gu, /受取人\\s*(?:は|[:=])\\s*([^。；;]+)/gu],',
  "recipient binding without meta-requirement false positives",
);
replaceOrThrow(
  '    origin: [/\\borigin\\s+(?:is|=|:)\\s*([^.;。]+)/giu, /出發地\\s*(?:是|[:=])\\s*([^。；;]+)/gu, /出发地\\s*(?:是|[:=])\\s*([^。；;]+)/gu, /出発地\\s*(?:は|[:=])\\s*([^。；;]+)/gu],',
  '    origin: [/\\borigin\\s*(?:is\\b|[:=])\\s*([^.;。]+)/giu, /出發地\\s*(?:是|[:=])\\s*([^。；;]+)/gu, /出发地\\s*(?:是|[:=])\\s*([^。；;]+)/gu, /出発地\\s*(?:は|[:=])\\s*([^。；;]+)/gu],',
  "origin colon/is binding",
);
replaceOrThrow(
  '    destination: [/\\bdestination\\s+(?:is|=|:)\\s*([^.;。]+)/giu, /目的地\\s*(?:是|[:=])\\s*([^。；;]+)/gu, /目的地\\s*(?:は|[:=])\\s*([^。；;]+)/gu],',
  '    destination: [/\\bdestination\\s*(?:is\\b|[:=])\\s*([^.;。]+)/giu, /目的地\\s*(?:是|[:=])\\s*([^。；;]+)/gu, /目的地\\s*(?:は|[:=])\\s*([^。；;]+)/gu],',
  "destination colon/is binding",
);
replaceOrThrow(
  '    deadline: [/\\bdeadline\\s+(?:is|=|:)\\s*([^.;。]+)/giu, /截止時間\\s*(?:是|[:=])\\s*([^。；;]+)/gu, /截止时间\\s*(?:是|[:=])\\s*([^。；;]+)/gu, /締切\\s*(?:は|[:=])\\s*([^。；;]+)/gu],',
  '    deadline: [/\\bdeadline\\s*(?:is\\b|[:=])\\s*([^.;。]+)/giu, /截止時間\\s*(?:是|[:=])\\s*([^。；;]+)/gu, /截止时间\\s*(?:是|[:=])\\s*([^。；;]+)/gu, /締切\\s*(?:は|[:=])\\s*([^。；;]+)/gu],',
  "deadline colon/is binding",
);
replaceOrThrow(
  '    service: [/\\bservice\\s+(?:needed\\s+)?(?:is|=|:)\\s*([^.;。]+)/giu],',
  '    service: [/\\bservice\\s+(?:needed\\s+)?(?:is\\b|[:=])\\s*([^.;。]+)/giu],',
  "service binding",
);

replaceOrThrow(
  '  if (semantic === "currency") {\n    const explicit = lastCapture(cleanIntent, [/\\bcurrency\\s+(?:is|=|:)\\s*(HKD|USD|EUR|JPY|GBP|SGD|AUD|CAD|CNY|RMB|TWD|KRW)\\b/giu]);',
  '  if (semantic === "currency") {\n    if (/\\b(?:US|U\\.S\\.)\\s+dollars?\\b/iu.test(cleanIntent)) return { value: "USD", label: "USD" };\n    if (/\\b(?:Hong Kong|HK)\\s+dollars?\\b/iu.test(cleanIntent)) return { value: "HKD", label: "HKD" };\n    if (/\\beuros?\\b/iu.test(cleanIntent)) return { value: "EUR", label: "EUR" };\n    if (/\\b(?:Japanese\\s+)?yen\\b/iu.test(cleanIntent)) return { value: "JPY", label: "JPY" };\n    const explicit = lastCapture(cleanIntent, [/\\bcurrency\\s*(?:is\\b|[:=])\\s*(HKD|USD|EUR|JPY|GBP|SGD|AUD|CAD|CNY|RMB|TWD|KRW)\\b/giu]);',
  "named currency binding",
);

fs.writeFileSync(path, source);
