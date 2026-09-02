import type { AsymptaEffectClass, AsymptaTaskEffect } from "./asympta-task-kernel-types.ts";
import { classifyTaskEffect as classifyTaskEffectV2 } from "./asympta-semantic-kernel-v2.ts";

const EFFECT_MENTION_RULES: Array<{ effectClass: AsymptaEffectClass; source: string }> = [
  { effectClass: "money_movement", source: String.raw`\b(?:wire|debit|pay|withdraw|remit|charge|transfer|refund)\b|\b(?:make|send|issue)\s+(?:a\s+)?payment\b|\bauthorize\s+(?:the\s+)?(?:debit|payment|transfer|charge)\b|轉帳|转账|付款|退款|提款|振込|支払` },
  { effectClass: "deletion", source: String.raw`\b(?:delete|remove|cancel|terminate)\b|刪除|删除|取消|削除` },
  { effectClass: "publication", source: String.raw`\b(?:publish|announce|broadcast)\b|\bpost\b(?=\s+(?:the|this|that|an?|my|your|our|update|announcement|message)\b)|發布|发布|公開` },
  { effectClass: "shipment", source: String.raw`\b(?:ship|dispatch|courier)\b|\brelease\b[^.;]{0,40}\b(?:parcel|shipment|package)\b|派送|寄送|発送` },
  { effectClass: "application", source: String.raw`\b(?:apply|enroll|submit)\b|\bfile\b(?=[^.;]{0,35}\bapplication\b)|申請|申请|報名|报名` },
  { effectClass: "scheduling", source: String.raw`\b(?:schedule|reschedule)\b|安排|排期` },
  { effectClass: "account_mutation", source: String.raw`\b(?:renew|register|subscribe|unsubscribe)\b|\b(?:open|update|change)\b(?=[^.;]{0,40}\b(?:account|subscription|membership)\b)|續期|续期|註冊|注册|更新|登録` },
  { effectClass: "communicate", source: String.raw`\b(?:send|notify|forward)\b|\bemail\b(?=\s+(?!(?:only|draft|template)\b)(?:to\s+)?[\p{L}\w@])|發送|发送|送信` },
  { effectClass: "external_commitment", source: String.raw`\b(?:buy|purchase|order|book|reserve|commit|accept|sign|hire|bid|procure|submit)\b|\bauthorize\b(?!\s+(?:the\s+)?(?:debit|payment|transfer|charge)\b)|\bbinding\b[^.;]{0,35}\b(?:order|agreement|quote)\b|\block\s+in\b|購買|购买|訂購|订购|預訂|预订|購入|注文|予約|接受|簽署|签署` },
];

function mentionIsNegated(intent: string, index: number) {
  const window = intent.slice(Math.max(0, index - 100), index);
  return /\b(?:do\s+not|don't|never)\b[^.;!?。！？；;\n]{0,90}$/iu.test(window)
    || /(?:不要|請勿|请勿|しないで|しない)[^。！？；;\n]{0,70}$/u.test(window);
}

function deletionIsMetaRevocation(intent: string, index: number, matched: string) {
  if (!/^cancel$/iu.test(matched)) return false;
  const tail = intent.slice(index, index + 48);
  return /^cancel\s+(?:that|this)(?:\s+request)?\s*(?:[;,.!?—]|$)/iu.test(tail);
}

export function classifyTaskEffect(input: { intent: string; actionFamily?: string }): AsymptaTaskEffect {
  const active = new Map<AsymptaEffectClass, { match: string; index: number }>();
  let sawExplicitNegatedEffect = false;

  for (const rule of EFFECT_MENTION_RULES) {
    const pattern = new RegExp(rule.source, "giu");
    const mentions: Array<{ match: string; index: number; negated: boolean }> = [];
    for (const match of input.intent.matchAll(pattern)) {
      const index = match.index ?? 0;
      if (rule.effectClass === "deletion" && deletionIsMetaRevocation(input.intent, index, match[0])) continue;
      mentions.push({ match: match[0], index, negated: mentionIsNegated(input.intent, index) });
    }
    const last = mentions.at(-1);
    if (!last) continue;
    if (last.negated) {
      sawExplicitNegatedEffect = true;
      continue;
    }
    active.set(rule.effectClass, { match: last.match, index: last.index });
  }

  for (const rule of EFFECT_MENTION_RULES) {
    const mention = active.get(rule.effectClass);
    if (!mention) continue;
    return {
      effectClass: rule.effectClass,
      requiresApproval: true,
      externalWrite: true,
      matchedAction: mention.match,
    };
  }

  if (sawExplicitNegatedEffect) {
    return { effectClass: "read", requiresApproval: false, externalWrite: false };
  }
  return classifyTaskEffectV2(input);
}
