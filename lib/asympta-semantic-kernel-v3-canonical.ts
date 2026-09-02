import type { AsymptaDataClass } from "./asympta-task-kernel-types.ts";
import {
  canonicalizeRequirementSemantic as canonicalizeRequirementSemanticV2,
  classifyDataClass as classifyDataClassV2,
  dataClassIsSensitive as dataClassIsSensitiveV2,
} from "./asympta-semantic-kernel-v2.ts";

function normalize(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s./-]+/g, "_")
    .replace(/[^\p{L}\p{N}_]+/gu, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

const CANONICAL_SEMANTICS = new Set([
  "budget", "participants", "delivery_location", "recipient", "origin", "destination", "contact", "time", "date", "deadline", "identity",
  "property_location", "property_type", "bedrooms", "financing", "movie_preference", "cinema_area", "showtime", "event_intent", "screen_size",
  "brand", "quantity", "acquisition_channel", "fulfilment", "purpose", "item_specification", "compliance", "service", "currency", "size", "generic",
]);

const FUZZY_SEMANTIC_VOCABULARY: Record<string, string[]> = {
  recipient: ["recipient", "payee", "beneficiary"],
  destination: ["destination", "to_location", "arrival_place", "arrival_location", "arrival_city"],
  origin: ["origin", "from_location", "departure_place", "departure_location", "departure_city"],
  budget: ["budget", "max_spend", "spending_limit", "price_ceiling", "price_range", "max_price"],
  participants: ["participants", "participant_count", "traveler_count", "traveller_count", "guest_count", "attendee_count", "number_of_participants"],
  contact: ["contact", "contact_email", "contact_phone", "contact_details", "email_address", "phone_number"],
  delivery_location: ["delivery_location", "delivery_address", "shipping_address", "drop_off_address", "dropoff_address", "ship_to"],
  deadline: ["deadline", "due_date", "needed_by", "timeframe"],
  identity: ["identity", "passport_details", "passport_number", "government_id", "driver_license", "driver_licence", "social_security", "ssn"],
  time: ["time", "start_time", "meeting_start_time", "appointment_time"],
  date: ["date", "calendar_date", "appointment_date"],
  currency: ["currency", "currency_code"],
  quantity: ["quantity", "item_count", "unit_count"],
  service: ["service", "service_type"],
};

function damerauLevenshtein(left: string, right: string) {
  const a = [...left];
  const b = [...right];
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + cost);
      }
    }
  }
  return matrix[a.length][b.length];
}

function fuzzySemantic(normalized: string) {
  if (!normalized || /[^\x00-\x7F]/u.test(normalized)) return null;
  const bySemantic = Object.entries(FUZZY_SEMANTIC_VOCABULARY).map(([semantic, aliases]) => ({
    semantic,
    distance: Math.min(...aliases.map((alias) => damerauLevenshtein(normalized, alias))),
  })).sort((left, right) => left.distance - right.distance || left.semantic.localeCompare(right.semantic));
  const best = bySemantic[0];
  const second = bySemantic[1];
  if (!best) return null;
  const maxDistance = normalized.length <= 5 ? 1 : normalized.length <= 12 ? 2 : 3;
  if (best.distance > maxDistance) return null;
  if (second && second.distance === best.distance) return null;
  return best.semantic;
}

export function canonicalizeRequirementSemantic(value: string) {
  const normalized = normalize(value);
  const v2 = canonicalizeRequirementSemanticV2(value);
  if (CANONICAL_SEMANTICS.has(v2) || v2 !== normalized) return v2;
  return fuzzySemantic(normalized) ?? v2;
}

export function classifyDataClass(semanticValue: string, raw = ""): AsymptaDataClass {
  return classifyDataClassV2(canonicalizeRequirementSemantic(semanticValue), raw);
}

export const dataClassIsSensitive = dataClassIsSensitiveV2;
