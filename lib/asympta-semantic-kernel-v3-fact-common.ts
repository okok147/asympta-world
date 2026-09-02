import type { AsymptaTaskAnswerValue } from "./asympta-task-kernel-types.ts";

export const FACT_LABELS: Record<string, string> = {
  recipient: String.raw`\b(?:recipient|payee|beneficiary)\b|收件人|受取人`,
  origin: String.raw`\b(?:origin|from\s+location|departure\s+(?:place|location|city))\b|出發地|出发地|出発地`,
  destination: String.raw`\b(?:destination|to\s+location|arrival\s+(?:place|location|city))\b|目的地`,
  participants: String.raw`\b(?:participants?|participant\s+count|travell?er\s+count|guests?|attendees?)\b|參與人數|参与人数|参加者`,
  time: String.raw`\b(?:time|start\s+time|appointment\s+time)\b|時間|时間|時刻`,
  date: String.raw`\bdate\b|日期|日付`,
  budget: String.raw`\b(?:budget|max\s+spend|spending\s+limit|price\s+ceiling|price\s+range|max\s+price)\b|預算|预算|予算`,
  currency: String.raw`\bcurrency\b|幣別|币别|通貨`,
  contact: String.raw`\b(?:contact|contact\s+email|contact\s+phone|email\s+address|phone\s+number)\b|聯絡電郵|联络电邮|連絡先`,
  deadline: String.raw`\b(?:deadline|due\s+date|needed\s+by)\b|截止時間|截止时间|締切|期限`,
  service: String.raw`\bservice(?:\s+needed)?\b|服務|服务|サービス`,
  quantity: String.raw`\b(?:quantity|count)\b|數量|数量`,
};

const FACT_LABEL_START_SOURCE = Object.values(FACT_LABELS).map((source) => `(?:${source})`).join("|");
export const UNCERTAINTY_PATTERN = /\b(?:might|maybe|perhaps|probably|possibly|could\s+be|not\s+sure|not\s+confirmed|not\s+decided|unsure|i\s+(?:do\s+not|don't)\s+remember|i\s+think|around)\b|可能|也許|也许|大概|未確認|未确认|不確定|不确定|かもしれ|たぶん|未確認/iu;
export const CORRECTION_PATTERN = /\b(?:correction|corrected?)\b|更正|訂正/iu;
export const FACT_NEGATION_PATTERN = /\b(?:is|are|was|were)\s+not\b|(?:不是|並非|并非|ではない|じゃない)/iu;

export function segmentFactClauses(intent: string) {
  let prepared = intent
    .replace(/\s+(?:\/|\||—)\s+/gu, "\n")
    .replace(/[；;]+/gu, "\n")
    .replace(/\s*\.\.\.\s*/gu, "\n")
    .replace(/(?<=[.!?。！？])\s+/gu, "\n");
  prepared = prepared.replace(new RegExp(`,\\s+(?=${FACT_LABEL_START_SOURCE})`, "giu"), "\n");
  prepared = prepared.replace(new RegExp(`\\s{2,}(?=${FACT_LABEL_START_SOURCE})`, "giu"), "\n");
  return prepared.split(/\n+/u).map((clause) => clause.trim()).filter(Boolean);
}

export function relevantClauses(intent: string, semantic: string) {
  const source = FACT_LABELS[semantic];
  if (!source) return [];
  const pattern = new RegExp(source, "iu");
  return segmentFactClauses(intent).map((text, index) => ({ text, index })).filter(({ text }) => pattern.test(text));
}

export function stripDiscourseSuffix(value: string) {
  return value
    .trim()
    .replace(/[).,!?。！？]+$/gu, "")
    .replace(/\s+(?:thanks|thank\s+you|pls|please|cheers|thx|ok|asap-ish|\/\s*mobile|\(voice\s+input\))\s*$/iu, "")
    .trim();
}

export function rawValuesFromClauses(intent: string, semantic: string) {
  const source = FACT_LABELS[semantic];
  if (!source) return [] as Array<{ raw: string; clause: string; index: number; corrected: boolean }>;
  const pattern = new RegExp(`(?:${source})\\s*(?:(?:is|are|was|were|of|=|:|是|為|为|は)\\s*)?(.+)$`, "iu");
  return relevantClauses(intent, semantic).flatMap(({ text, index }) => {
    const match = pattern.exec(text);
    const raw = stripDiscourseSuffix(match?.[1] ?? "");
    if (!raw) return [];
    return [{ raw, clause: text, index, corrected: CORRECTION_PATTERN.test(text) }];
  });
}

export type Candidate = {
  value: AsymptaTaskAnswerValue;
  label: string;
  identity: string;
  valid: boolean;
  corrected: boolean;
  index: number;
};

export type EnhancedResolution = { handled: boolean; result: { value: AsymptaTaskAnswerValue; label: string } | null };

export function chooseCandidates(candidates: Candidate[], explicit: boolean): EnhancedResolution {
  if (!explicit && !candidates.length) return { handled: false, result: null };
  const corrected = candidates.filter((candidate) => candidate.valid && candidate.corrected).at(-1);
  if (corrected) return { handled: true, result: { value: corrected.value, label: corrected.label } };
  if (!candidates.length || candidates.some((candidate) => !candidate.valid)) return { handled: true, result: null };
  const valid = candidates.filter((candidate) => candidate.valid);
  if (new Set(valid.map((candidate) => candidate.identity)).size > 1) return { handled: true, result: null };
  const latest = valid.at(-1);
  return latest
    ? { handled: true, result: { value: latest.value, label: latest.label } }
    : { handled: true, result: null };
}
