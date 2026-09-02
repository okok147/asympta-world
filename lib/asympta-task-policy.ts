import type {
  AsymptaTaskCompletionContract,
  AsymptaTaskMode,
  AsymptaTaskRisk,
} from "./asympta-task-kernel-types.ts";

const TV_PATTERN = /(?:\btv\b|\btelevision\b|smart\s*tv|電視機?|电视机?|テレビ)/iu;
const EVENT_PATTERN = /(?:concert|show|performance|ticket|演唱會|演唱会|音樂會|音乐会|門票|门票|公演|チケット)/iu;
const CINEMA_PATTERN = /(?:\bmovies?\b|\bfilms?\b|\bcinema\b|movie\s*tickets?|電影|电影|戲院|戏院|影院|映画|映画館)/iu;
const PURCHASE_PATTERN = /(?:buy|purchase|order|procure|購買|购买|訂購|订购|購入|注文)/iu;
const BOOKING_PATTERN = /(?:buy|purchase|book|reserve|ticket|購買|购买|買票|买票|訂票|订票|預訂|预订|予約|チケット)/iu;
const WRITE_PATTERN = /(?:buy|purchase|order|procure|book|reserve|send|submit|publish|delete|cancel|pay|transfer|hire|sign|approve|apply|refund|withdraw|renew|register|enroll|schedule|dispatch|ship|accept|claim|subscribe|unsubscribe|create|update|購買|购买|訂購|订购|預訂|预订|發送|发送|提交|發布|发布|刪除|删除|取消|付款|轉帳|转账|僱用|雇用|簽署|签署|申請|申请|退款|提款|續期|续期|註冊|注册|報名|报名|安排|派送|寄送|接受|索償|索赔|購入|注文|予約|送信|提出|公開|削除|支払|振込|申請|返金|引出|更新|登録|発送|受諾)/iu;
const CONSEQUENT_ACTION_FAMILY = /(?:purchase|payment|transfer|booking|reservation|delete|cancel|publish|submit|send|hire|sign|commit|write|execute|apply|refund|withdraw|renew|register|enroll|schedule|dispatch|ship|accept|claim|subscribe|create|update)/iu;

export function inferTaskClassification(intent: string) {
  if (TV_PATTERN.test(intent)) return { domain: "commerce.consumer_electronics", actionFamily: "purchase" };
  if (CINEMA_PATTERN.test(intent)) return { domain: "events.cinema", actionFamily: BOOKING_PATTERN.test(intent) ? "booking" : "discover" };
  if (EVENT_PATTERN.test(intent)) return { domain: "events", actionFamily: PURCHASE_PATTERN.test(intent) ? "purchase" : "discover" };
  if (PURCHASE_PATTERN.test(intent)) return { domain: "commerce", actionFamily: "purchase" };
  if (/(?:weather|forecast|天氣|天气|天気)/iu.test(intent)) return { domain: "weather", actionFamily: "read" };
  if (/(?:find|search|compare|research|尋找|搜集|比較|查找|検索|比較)/iu.test(intent)) return { domain: "information", actionFamily: "research" };
  return { domain: "general", actionFamily: WRITE_PATTERN.test(intent) ? "execute" : "coordinate" };
}

export function taskRiskRank(risk: AsymptaTaskRisk) {
  switch (risk) {
    case "critical": return 4;
    case "high": return 3;
    case "medium": return 2;
    case "low": return 1;
    default: return 0;
  }
}

export function taskIsWriteIntent(input: { actionFamily: string; intent: string }) {
  return CONSEQUENT_ACTION_FAMILY.test(input.actionFamily) || WRITE_PATTERN.test(input.intent);
}

export function taskRequiresApproval(input: {
  actionFamily: string;
  intent: string;
  risk: AsymptaTaskRisk;
  confirmationRequired?: boolean;
}) {
  return input.confirmationRequired === true
    || taskRiskRank(input.risk) >= taskRiskRank("high")
    || taskIsWriteIntent(input);
}

export function createTaskCompletionContract(input: {
  actionFamily: string;
  intent: string;
  mode: AsymptaTaskMode;
  risk: AsymptaTaskRisk;
  confirmationRequired?: boolean;
}): AsymptaTaskCompletionContract {
  const write = taskIsWriteIntent(input);
  const requiresApproval = taskRequiresApproval(input);
  return {
    requiresVerifiedOutcome: true,
    requiresApproval,
    requiresReceipt: write,
    outcomeKind: write
      ? input.mode === "live" ? "external_action" : "simulated_action"
      : "information",
  };
}

export function taskApprovalCopy(input: { title: string; locale: string }) {
  if (input.locale.startsWith("zh")) {
    return {
      prompt: `確認繼續「${input.title}」？`,
      consequence: "這是具外部承諾或重大影響的行動。確認後，Asympta 會在同一任務中自動繼續執行及驗證。",
    };
  }
  if (input.locale.startsWith("ja")) {
    return {
      prompt: `「${input.title}」を続行しますか？`,
      consequence: "外部への確約または重大な影響を伴う操作です。確認後、Asympta は同じタスクを自動的に再開し、実行と検証を続けます。",
    };
  }
  return {
    prompt: `Continue with “${input.title}”?`,
    consequence: "This action can create an external commitment or material consequence. After confirmation, Asympta will automatically resume the same task, execute it and verify the outcome.",
  };
}
