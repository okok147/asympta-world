import type { Candidate, EnhancedResolution } from "./asympta-semantic-kernel-v3-fact-common.ts";
import { CORRECTION_PATTERN, chooseCandidates, rawValuesFromClauses, relevantClauses, stripDiscourseSuffix } from "./asympta-semantic-kernel-v3-fact-common.ts";

function normalize(value: string) { return value.trim().toLowerCase().replace(/[\s./-]+/g, "_").replace(/[^\p{L}\p{N}_]+/gu, "").replace(/_+/g, "_").replace(/^_|_$/g, ""); }

const CURRENCY_TOKEN_SOURCE = String.raw`(?:HK|US|S|A|C|NT)\$|CN¥|[$€£¥₩]|HKD|USD|EUR|JPY|GBP|SGD|AUD|CAD|CNY|RMB|TWD|KRW|港幣|港币|日圓|日元`;

function currencyCode(value: string) {
  const upper = value.toUpperCase().replace(/\s+/g, "");
  if (["HKD", "HK$", "港幣", "港币"].includes(upper)) return "HKD";
  if (["USD", "US$"].includes(upper)) return "USD";
  if (["EUR", "€"].includes(upper)) return "EUR";
  if (["JPY", "YEN", "日圓", "日元"].includes(upper)) return "JPY";
  if (["GBP", "£"].includes(upper)) return "GBP";
  if (["SGD", "S$"].includes(upper)) return "SGD";
  if (["AUD", "A$"].includes(upper)) return "AUD";
  if (["CAD", "C$"].includes(upper)) return "CAD";
  if (["CNY", "RMB", "CN¥"].includes(upper)) return "CNY";
  if (["TWD", "NT$"].includes(upper)) return "TWD";
  if (["KRW", "₩"].includes(upper)) return "KRW";
  return upper;
}

export function resolveBudget(intent: string): EnhancedResolution {
  const clauses = relevantClauses(intent, "budget");
  if (!clauses.length) return { handled: false, result: null };
  const candidates: Candidate[] = [];
  let explicitMalformed = false;
  const strictMoney = new RegExp(`(${CURRENCY_TOKEN_SOURCE})\\s*(\\d{1,7}(?:,\\d{3})*)(?!(?:[\\dA-Za-z,]|\\.\\d))`, "giu");
  for (const entry of clauses) {
    let foundMoney = false;
    for (const match of entry.text.matchAll(strictMoney)) {
      foundMoney = true;
      const amount = Number(match[2].replace(/,/g, ""));
      const code = currencyCode(match[1]);
      candidates.push({ value: amount, label: `${code} ${match[2]}`, identity: `${code}:${amount}`, valid: amount > 0, corrected: CORRECTION_PATTERN.test(entry.text), index: entry.index });
    }
    const raw = rawValuesFromClauses(entry.text, "budget")[0]?.raw ?? "";
    if (!foundMoney && raw) {
      const cleaned = stripDiscourseSuffix(raw);
      const plain = /^(\d{1,7}(?:,\d{3})*)$/u.exec(cleaned);
      if (plain) {
        const amount = Number(plain[1].replace(/,/g, ""));
        candidates.push({ value: amount, label: plain[1], identity: `plain:${amount}`, valid: amount > 0, corrected: CORRECTION_PATTERN.test(entry.text), index: entry.index });
      } else if (new RegExp(CURRENCY_TOKEN_SOURCE, "iu").test(cleaned) || /^[+-]?\d/u.test(cleaned)) {
        explicitMalformed = true;
      }
    }
  }
  return chooseCandidates(candidates, explicitMalformed || candidates.length > 0);
}

export function resolveParticipants(intent: string): EnhancedResolution {
  const clauses = relevantClauses(intent, "participants");
  if (!clauses.length) return { handled: false, result: null };
  const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  const candidates: Candidate[] = [];
  let explicitMalformed = false;
  for (const entry of clauses) {
    const raw = rawValuesFromClauses(entry.text, "participants")[0]?.raw ?? "";
    const labelFirst = /^(\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten)(?:\s*(?:participants?|people|guests?|attendees?|人))?$/iu.exec(stripDiscourseSuffix(raw));
    const postfix = /\b(\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:participants?|people|guests?|attendees?)\b/iu.exec(entry.text);
    const match = labelFirst ?? postfix;
    if (!match) {
      if (raw) explicitMalformed = true;
      continue;
    }
    const token = match[1].toLowerCase();
    const number = /^\d+$/u.test(token) ? Number(token) : words[token];
    candidates.push({ value: number, label: String(number), identity: String(number), valid: Number.isInteger(number) && number > 0, corrected: CORRECTION_PATTERN.test(entry.text), index: entry.index });
  }
  return chooseCandidates(candidates, explicitMalformed || candidates.length > 0);
}

function isStrictEmail(value: string) {
  const trimmed = value.trim().replace(/[),.;!?]+$/u, "");
  const parts = trimmed.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || !domain || local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false;
  if (!/^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/iu.test(local)) return false;
  const labels = domain.split(".");
  if (labels.length < 2 || labels.some((label) => !label || label.startsWith("-") || label.endsWith("-") || !/^[A-Z0-9-]+$/iu.test(label))) return false;
  return /^[A-Z]{2,}$/iu.test(labels.at(-1) ?? "");
}

export function resolveContact(intent: string): EnhancedResolution {
  const clauses = relevantClauses(intent, "contact");
  if (!clauses.length) return { handled: false, result: null };
  const candidates: Candidate[] = [];
  for (const entry of clauses) {
    const raw = (rawValuesFromClauses(entry.text, "contact")[0]?.raw ?? "").replace(/^me\s+at\s+/iu, "");
    const emailLike = /[^\s,;]+@[^\s,;]+/u.exec(raw)?.[0]?.replace(/[),.;!?]+$/u, "") ?? null;
    if (emailLike) {
      candidates.push({ value: emailLike, label: emailLike, identity: emailLike.toLowerCase(), valid: isStrictEmail(emailLike), corrected: CORRECTION_PATTERN.test(entry.text), index: entry.index });
      continue;
    }
    const phone = /\+?\d[\d ()-]{6,}\d/u.exec(raw)?.[0] ?? null;
    if (phone) {
      const digits = phone.replace(/\D/gu, "");
      candidates.push({ value: phone, label: phone, identity: digits, valid: digits.length >= 8 && digits.length <= 15, corrected: CORRECTION_PATTERN.test(entry.text), index: entry.index });
      continue;
    }
    candidates.push({ value: raw || "", label: raw || "", identity: raw.toLowerCase(), valid: false, corrected: CORRECTION_PATTERN.test(entry.text), index: entry.index });
  }
  return chooseCandidates(candidates, true);
}

const INCOMPATIBLE_TEXT_VALUE = /^(?:[-+]?\d+(?:\.\d+)?\s*(?:kg|kilograms?|g|grams?|liters?|litres?|ml|meters?|metres?|cm|mm|participants?|people|guests?|items?|units?)|(?:HKD|USD|EUR|JPY|GBP|SGD|AUD|CAD|CNY|RMB|TWD|KRW|[$€£¥₩])\s*[-+]?\d+(?:\.\d+)?|[-+]?\d{1,3}:\d{2})\b/iu;

export function resolveTextSemantic(intent: string, semantic: string): EnhancedResolution {
  const raws = rawValuesFromClauses(intent, semantic);
  if (!raws.length) return { handled: false, result: null };
  const candidates = raws.map((entry) => {
    const value = stripDiscourseSuffix(entry.raw);
    const placeholder = /^(?:unknown|none|n\/?a|not\s+sure|not\s+provided|not\s+specified|missing|\?+|x{3,})$/iu.test(value);
    const valid = Boolean(value) && !placeholder && !INCOMPATIBLE_TEXT_VALUE.test(value);
    return { value, label: value, identity: normalize(value), valid, corrected: entry.corrected, index: entry.index } satisfies Candidate;
  });
  return chooseCandidates(candidates, true);
}

export function resolveCurrency(intent: string): EnhancedResolution {
  const clauses = relevantClauses(intent, "currency");
  const codes: Candidate[] = [];
  const codePattern = /\b(HKD|USD|EUR|JPY|GBP|SGD|AUD|CAD|CNY|RMB|TWD|KRW)\b/giu;
  for (const entry of clauses) {
    for (const match of entry.text.matchAll(codePattern)) {
      const code = currencyCode(match[1]);
      codes.push({ value: code, label: code, identity: code, valid: true, corrected: CORRECTION_PATTERN.test(entry.text), index: entry.index });
    }
  }
  if (clauses.length) return chooseCandidates(codes, true);
  const globalCodes = [...intent.matchAll(codePattern)].map((match, index) => {
    const code = currencyCode(match[1]);
    return { value: code, label: code, identity: code, valid: true, corrected: false, index } satisfies Candidate;
  });
  return chooseCandidates(globalCodes, false);
}

