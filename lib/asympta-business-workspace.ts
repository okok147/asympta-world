export type AsymptaBusinessProfile = {
  name: string;
  category: string;
  description: string;
  location: string;
  contact: string;
  hours: string;
};

export type AsymptaBusinessProduct = {
  id: string;
  name: string;
  description: string;
  price: number | null;
  currency: string;
  availability: "available" | "unavailable" | "unknown";
};

export type AsymptaBusinessAgentReply = {
  status: "answered" | "needs_business_confirmation";
  text: string;
  evidence: string[];
  matchedProductId: string | null;
};

export const EMPTY_ASYMPTA_BUSINESS_PROFILE: AsymptaBusinessProfile = {
  name: "",
  category: "",
  description: "",
  location: "",
  contact: "",
  hours: "",
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function normalizeAvailability(value: unknown): AsymptaBusinessProduct["availability"] {
  const normalized = clean(value).toLowerCase();
  if (["available", "in stock", "instock", "yes", "true", "1"].includes(normalized)) return "available";
  if (["unavailable", "out of stock", "outofstock", "no", "false", "0"].includes(normalized)) return "unavailable";
  return "unknown";
}

function stableId(value: string, index: number) {
  let hash = 2166136261;
  for (let cursor = 0; cursor < value.length; cursor += 1) {
    hash ^= value.charCodeAt(cursor);
    hash = Math.imul(hash, 16777619);
  }
  return `product-${(hash >>> 0).toString(36)}-${index + 1}`;
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === "," && !quoted) {
      cells.push(cell.trim());
      cell = "";
      continue;
    }
    cell += char;
  }
  cells.push(cell.trim());
  return cells;
}

function csvRows(text: string) {
  return text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseCsvLine);
}

function normalizeProfileObject(input: Record<string, unknown>): AsymptaBusinessProfile {
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      if (input[key] !== undefined && clean(input[key])) return clean(input[key]);
    }
    return "";
  };
  return {
    name: pick("name", "business_name", "businessName", "company"),
    category: pick("category", "type", "industry"),
    description: pick("description", "about", "summary"),
    location: pick("location", "address"),
    contact: pick("contact", "phone", "email"),
    hours: pick("hours", "opening_hours", "openingHours"),
  };
}

export function parseAsymptaBusinessProfile(text: string): AsymptaBusinessProfile {
  const source = text.trim();
  if (!source) return { ...EMPTY_ASYMPTA_BUSINESS_PROFILE };

  if (source.startsWith("{") || source.startsWith("[")) {
    const parsed = JSON.parse(source) as unknown;
    const object = Array.isArray(parsed) ? parsed[0] : parsed;
    if (!object || typeof object !== "object") throw new Error("Business information must be a JSON object.");
    return normalizeProfileObject(object as Record<string, unknown>);
  }

  const rows = csvRows(source);
  if (rows.length === 0) return { ...EMPTY_ASYMPTA_BUSINESS_PROFILE };
  const normalized: Record<string, unknown> = {};

  if (rows[0].length >= 2 && rows.length === 2) {
    rows[0].forEach((key, index) => { normalized[key.trim()] = rows[1][index] ?? ""; });
  } else {
    for (const row of rows) {
      if (row.length >= 2) normalized[row[0].trim()] = row.slice(1).join(", ").trim();
    }
  }
  return normalizeProfileObject(normalized);
}

function normalizeProduct(input: Record<string, unknown>, index: number): AsymptaBusinessProduct | null {
  const name = clean(input.name ?? input.product ?? input.title);
  if (!name) return null;
  const rawPrice = input.price ?? input.amount;
  const numericPrice = rawPrice === null || rawPrice === undefined || clean(rawPrice) === ""
    ? null
    : Number(String(rawPrice).replace(/[^0-9.+-]/g, ""));
  const price = numericPrice !== null && Number.isFinite(numericPrice) ? numericPrice : null;
  const currency = clean(input.currency) || "";
  return {
    id: clean(input.id ?? input.sku) || stableId(name, index),
    name,
    description: clean(input.description ?? input.details),
    price,
    currency,
    availability: normalizeAvailability(input.availability ?? input.stock ?? input.status),
  };
}

export function parseAsymptaBusinessProducts(text: string): AsymptaBusinessProduct[] {
  const source = text.trim();
  if (!source) return [];

  let records: Record<string, unknown>[] = [];
  if (source.startsWith("{") || source.startsWith("[")) {
    const parsed = JSON.parse(source) as unknown;
    const list = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && Array.isArray((parsed as { products?: unknown[] }).products)
        ? (parsed as { products: unknown[] }).products
        : [parsed];
    records = list.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry));
  } else {
    const rows = csvRows(source);
    if (rows.length < 2) return [];
    const headers = rows[0].map((header) => header.trim());
    records = rows.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
  }

  return records
    .map(normalizeProduct)
    .filter((product): product is AsymptaBusinessProduct => product !== null);
}

function tokens(value: string) {
  return new Set(value.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 2));
}

function productScore(product: AsymptaBusinessProduct, query: string) {
  const normalizedQuery = query.toLowerCase();
  const normalizedName = product.name.toLowerCase();
  if (normalizedQuery.includes(normalizedName)) return 100;
  const queryTokens = tokens(query);
  let score = 0;
  for (const token of tokens(`${product.name} ${product.description}`)) {
    if (queryTokens.has(token)) score += token.length >= 5 ? 3 : 1;
  }
  return score;
}

function money(product: AsymptaBusinessProduct) {
  if (product.price === null) return "";
  return `${product.currency ? `${product.currency} ` : ""}${product.price}`;
}

export function buildAsymptaBusinessAgentReply(
  profile: AsymptaBusinessProfile,
  products: AsymptaBusinessProduct[],
  customerMessage: string,
): AsymptaBusinessAgentReply {
  const message = customerMessage.trim();
  if (!profile.name) {
    return {
      status: "needs_business_confirmation",
      text: "I need the business profile before I can answer customers accurately.",
      evidence: [],
      matchedProductId: null,
    };
  }

  const lower = message.toLowerCase();
  if (/\b(hours?|open|closing|close|when are you)\b/.test(lower)) {
    if (!profile.hours) return {
      status: "needs_business_confirmation",
      text: `${profile.name} has not imported opening hours yet. A business operator should confirm before the agent answers.`,
      evidence: ["business.name"],
      matchedProductId: null,
    };
    return {
      status: "answered",
      text: `${profile.name}: ${profile.hours}`,
      evidence: ["business.name", "business.hours"],
      matchedProductId: null,
    };
  }

  if (/\b(where|address|location|located)\b/.test(lower)) {
    if (!profile.location) return {
      status: "needs_business_confirmation",
      text: `${profile.name} has not imported a location yet. A business operator should confirm before the agent answers.`,
      evidence: ["business.name"],
      matchedProductId: null,
    };
    return {
      status: "answered",
      text: `${profile.name} is at ${profile.location}.`,
      evidence: ["business.name", "business.location"],
      matchedProductId: null,
    };
  }

  const ranked = products
    .map((product) => ({ product, score: productScore(product, message) }))
    .sort((left, right) => right.score - left.score || left.product.name.localeCompare(right.product.name));
  const best = ranked[0];

  if (!best || best.score <= 0) {
    return {
      status: "needs_business_confirmation",
      text: `${profile.name}'s imported catalog does not contain enough information to answer that reliably. The business should confirm before the agent makes a promise.`,
      evidence: ["business.name", "catalog.no_match"],
      matchedProductId: null,
    };
  }

  const product = best.product;
  const evidence = ["business.name", `product:${product.id}:name`, `product:${product.id}:availability`];
  const price = money(product);
  if (price) evidence.push(`product:${product.id}:price`);
  const availability = product.availability === "available"
    ? "is available"
    : product.availability === "unavailable"
      ? "is currently unavailable"
      : "has no confirmed availability status";
  const priceText = price ? ` Price: ${price}.` : " Price has not been imported.";
  const descriptionText = product.description ? ` ${product.description}` : "";

  return {
    status: product.availability === "unknown" ? "needs_business_confirmation" : "answered",
    text: `${profile.name}: ${product.name} ${availability}.${priceText}${descriptionText}`,
    evidence,
    matchedProductId: product.id,
  };
}
