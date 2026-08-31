export type UnsafeProposalRecoveryLocale = "en" | "zh-Hant" | "ja";

const UNSAFE_PROPOSAL_PATTERNS = [
  /the action proposal was unsafe/i,
  /the action proposal contained invalid fields/i,
  /the agent returned an invalid goal/i,
];

const PURCHASE_PATTERN = /\b(?:buy|purchase|order|get|shop for)\b|購買|购买|買|买|訂購|订购|購入|注文/iu;
const BOOKING_PATTERN = /\b(?:book|reserve|reservation|schedule|appointment)\b|預約|预约|訂位|订位|予約/iu;
const MESSAGE_PATTERN = /\b(?:send|email|message|contact|notify)\b|傳送|发送|寄電郵|寄邮件|聯絡|联系|通知|送信|メール/iu;
const PUBLISH_PATTERN = /\b(?:publish|post|submit|upload|share)\b|發布|发布|提交|上傳|上传|分享|公開|投稿/iu;
const MUTATION_PATTERN = /\b(?:delete|remove|cancel|change|update|edit|move|rename)\b|刪除|删除|取消|修改|更新|移動|移动|改名|削除|変更/iu;
const SERVICE_PATTERN = /\b(?:repair|fix|hire|service|install|maintenance)\b|維修|维修|修理|安裝|安装|保養|保养|服務|服务/iu;
const TV_PATTERN = /\b(?:tv|television|smart tv)\b|電視機?|电视机?|テレビ/iu;

function normalizeField(field: string) {
  return field.trim().toLowerCase().replace(/[\s_-]+/g, " ");
}

function alreadyConfirmed(intent: string, field: string) {
  const normalizedIntent = intent.toLowerCase();
  const normalizedField = normalizeField(field);
  return normalizedIntent.includes(`${normalizedField}:`)
    || normalizedIntent.includes(`${normalizedField}：`);
}

export function isRecoverableUnsafeProposal(message: string | null | undefined) {
  const text = message?.trim() ?? "";
  return Boolean(text && UNSAFE_PROPOSAL_PATTERNS.some((pattern) => pattern.test(text)));
}

export function inferUnsafeProposalMissingFields(intent: string) {
  const clean = intent.trim();
  let fields: string[];

  if (PURCHASE_PATTERN.test(clean)) {
    fields = TV_PATTERN.test(clean)
      ? ["screen size", "budget", "brand preference", "purchase location", "fulfilment"]
      : ["budget", "quantity", "fulfilment", "purchase location", "deadline"];
  } else if (BOOKING_PATTERN.test(clean)) {
    fields = ["deadline", "quantity", "location", "confirmation"];
  } else if (MESSAGE_PATTERN.test(clean)) {
    fields = ["recipient", "purpose", "deadline", "confirmation"];
  } else if (PUBLISH_PATTERN.test(clean)) {
    fields = ["purpose", "deadline", "confirmation"];
  } else if (MUTATION_PATTERN.test(clean)) {
    fields = ["confirmation"];
  } else if (SERVICE_PATTERN.test(clean)) {
    fields = ["budget", "deadline", "location", "confirmation"];
  } else {
    fields = ["purpose", "deadline", "confirmation"];
  }

  return fields.filter((field) => !alreadyConfirmed(clean, field));
}

export function unsafeProposalRecoveryPrompt(locale: UnsafeProposalRecoveryLocale) {
  if (locale === "zh-Hant") return "這個行動還需要先確認一項資料。選好後，Asympta 會用同一任務繼續。";
  if (locale === "ja") return "この操作には、先にもう一つ確認が必要です。選択後、同じタスクを続けます。";
  return "This action needs one more confirmed detail first. Choose it and Asympta will continue the same task.";
}
