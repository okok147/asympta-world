import { classifyTaskEffect } from "./asympta-semantic-kernel.ts";
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

export function inferTaskClassification(intent: string) {
  if (TV_PATTERN.test(intent)) return { domain: "commerce.consumer_electronics", actionFamily: "purchase" };
  if (CINEMA_PATTERN.test(intent)) return { domain: "events.cinema", actionFamily: BOOKING_PATTERN.test(intent) ? "booking" : "discover" };
  if (EVENT_PATTERN.test(intent)) return { domain: "events", actionFamily: PURCHASE_PATTERN.test(intent) ? "purchase" : "discover" };
  if (PURCHASE_PATTERN.test(intent)) return { domain: "commerce", actionFamily: "purchase" };
  if (/(?:weather|forecast|天氣|天气|天気)/iu.test(intent)) return { domain: "weather", actionFamily: "read" };
  if (/(?:find|search|compare|research|尋找|搜集|比較|查找|検索|比較)/iu.test(intent)) return { domain: "information", actionFamily: "research" };
  const effect = classifyTaskEffect({ intent, actionFamily: "coordinate" });
  return { domain: "general", actionFamily: effect.externalWrite ? "execute" : "coordinate" };
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
  return classifyTaskEffect(input).externalWrite;
}

export function taskRequiresApproval(input: {
  actionFamily: string;
  intent: string;
  risk: AsymptaTaskRisk;
  confirmationRequired?: boolean;
}) {
  return input.confirmationRequired === true
    || taskRiskRank(input.risk) >= taskRiskRank("high")
    || classifyTaskEffect(input).requiresApproval;
}

export function createTaskCompletionContract(input: {
  actionFamily: string;
  intent: string;
  mode: AsymptaTaskMode;
  risk: AsymptaTaskRisk;
  confirmationRequired?: boolean;
}): AsymptaTaskCompletionContract {
  const effect = classifyTaskEffect(input);
  const write = effect.externalWrite;
  const requiresApproval = input.confirmationRequired === true
    || taskRiskRank(input.risk) >= taskRiskRank("high")
    || effect.requiresApproval;
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
