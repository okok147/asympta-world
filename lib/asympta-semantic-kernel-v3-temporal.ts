import type { Candidate, EnhancedResolution } from "./asympta-semantic-kernel-v3-fact-common.ts";
import { chooseCandidates, rawValuesFromClauses } from "./asympta-semantic-kernel-v3-fact-common.ts";

function isValidCalendarDate(year: number, month: number, day: number) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

export function resolveDate(intent: string): EnhancedResolution {
  const raws = rawValuesFromClauses(intent, "date");
  const candidates: Candidate[] = [];
  let sawDateShaped = false;
  for (const entry of raws) {
    const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/u.exec(entry.raw);
    const slash = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/u.exec(entry.raw);
    const dayMonth = /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/iu.exec(entry.raw);
    const monthDay = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/iu.exec(entry.raw);
    if (iso) {
      sawDateShaped = true;
      const year = Number(iso[1]); const month = Number(iso[2]); const day = Number(iso[3]);
      candidates.push({ value: iso[0], label: iso[0], identity: iso[0], valid: isValidCalendarDate(year, month, day), corrected: entry.corrected, index: entry.index });
      continue;
    }
    if (slash) {
      sawDateShaped = true;
      const first = Number(slash[1]); const second = Number(slash[2]); const year = Number(slash[3]);
      const ambiguous = first >= 1 && first <= 12 && second >= 1 && second <= 12;
      let valid = false;
      if (!ambiguous) {
        if (first > 12) valid = isValidCalendarDate(year, second, first);
        else if (second > 12) valid = isValidCalendarDate(year, first, second);
      }
      candidates.push({ value: slash[0], label: slash[0], identity: slash[0], valid, corrected: entry.corrected, index: entry.index });
      continue;
    }
    if (dayMonth) {
      sawDateShaped = true;
      const day = Number(dayMonth[1]); const month = MONTHS[dayMonth[2].toLowerCase()]; const year = Number(dayMonth[3]);
      candidates.push({ value: dayMonth[0], label: dayMonth[0], identity: dayMonth[0].toLowerCase(), valid: isValidCalendarDate(year, month, day), corrected: entry.corrected, index: entry.index });
      continue;
    }
    if (monthDay) {
      sawDateShaped = true;
      const month = MONTHS[monthDay[1].toLowerCase()]; const day = Number(monthDay[2]); const year = Number(monthDay[3]);
      candidates.push({ value: monthDay[0], label: monthDay[0], identity: monthDay[0].toLowerCase(), valid: isValidCalendarDate(year, month, day), corrected: entry.corrected, index: entry.index });
    }
  }
  return chooseCandidates(candidates, sawDateShaped);
}

export function resolveTime(intent: string): EnhancedResolution {
  const raws = rawValuesFromClauses(intent, "time");
  const candidates: Candidate[] = [];
  for (const entry of raws) {
    const match = /(-?\d{1,3}):(\d{2})(?:\s*(am|pm))?/iu.exec(entry.raw);
    if (!match) continue;
    const hour = Number(match[1]); const minute = Number(match[2]); const period = match[3]?.toLowerCase();
    const valid = period ? hour >= 1 && hour <= 12 && minute >= 0 && minute <= 59 : hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
    const normalized = period ? `${hour}:${String(minute).padStart(2, "0")} ${period}` : `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    candidates.push({ value: normalized, label: match[0], identity: normalized, valid, corrected: entry.corrected, index: entry.index });
  }
  return chooseCandidates(candidates, raws.length > 0);
}

