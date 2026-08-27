"use client";

import { useEffect } from "react";

type Product = { id: string; name: string; price: number; stock: number };
type Service = { id: string; name: string; price: number; slots: number };
type Business = {
  id: string;
  name: string;
  kind: string;
  x: number;
  y: number;
  reputation: number;
  actions: string[];
  products: Product[];
  services: Service[];
};
type Registry = {
  invoke: (name: string, input?: Record<string, unknown>) => Promise<unknown>;
  __spatialWrapped?: boolean;
  __comparisonWrapped?: boolean;
  __comparisonRawInvoke?: (name: string, input?: Record<string, unknown>) => Promise<unknown>;
};
type ComparisonWindow = Window & { __ASYMPTA_CITY_WEBMCP__?: Registry };
type SearchResult = { ok?: boolean; businesses?: unknown };
type InspectResult = { ok?: boolean; business?: unknown };

type Candidate = {
  business: Business;
  itemId?: string;
  itemName?: string;
  price: number;
  availability: number;
  fit: number;
  score: number;
  distance: number;
};

function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }
function delay(ms: number) { return new Promise<void>((resolve) => window.setTimeout(resolve, ms)); }
function emitProcess(label: string, detail: string, progress: number, tone: string) {
  window.dispatchEvent(new CustomEvent("asympta:user-task-process", { detail: { label, detail, progress, tone } }));
}
function currentProgress() {
  try {
    const raw = localStorage.getItem("asympta-user-live-status-v1");
    if (!raw) return 18;
    const parsed = JSON.parse(raw) as { progress?: number };
    return clamp(Number(parsed.progress ?? 18), 0, 94);
  } catch { return 18; }
}
function userPrompt() {
  return document.querySelector<HTMLInputElement>('input[aria-label="What do you need?"]')?.value?.toLowerCase() ?? "";
}
function userPosition() {
  const node = document.querySelector<HTMLElement>(".mission-user-agent");
  return { x: Number.parseFloat(node?.style.left ?? "") || node?.offsetLeft || 600, y: Number.parseFloat(node?.style.top ?? "") || node?.offsetTop || 380 };
}

/**
 * Old browser snapshots and WebMCP adapters can expose collections as arrays,
 * keyed objects, or a single object. Normalize every external collection before
 * any map/filter/some call so a stale snapshot can never crash the scenario.
 */
function collection(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  if ("id" in record || "name" in record) return [record];
  return Object.values(record);
}
function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function numberValue(value: unknown, fallback = 0) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}
function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : value == null ? fallback : String(value);
}
function normalizeProduct(value: unknown, index: number): Product | null {
  const row = objectValue(value);
  if (!row) return null;
  const id = stringValue(row.id, `product-${index + 1}`).trim();
  const name = stringValue(row.name, id).trim();
  if (!id && !name) return null;
  return {
    id: id || `product-${index + 1}`,
    name: name || id,
    price: Math.max(0, numberValue(row.price, 0)),
    stock: Math.max(0, numberValue(row.stock ?? row.available ?? row.availability, 0)),
  };
}
function normalizeService(value: unknown, index: number): Service | null {
  const row = objectValue(value);
  if (!row) return null;
  const id = stringValue(row.id, `service-${index + 1}`).trim();
  const name = stringValue(row.name, id).trim();
  if (!id && !name) return null;
  return {
    id: id || `service-${index + 1}`,
    name: name || id,
    price: Math.max(0, numberValue(row.price, 0)),
    slots: Math.max(0, numberValue(row.slots ?? row.available ?? row.availability ?? row.capacity, 0)),
  };
}
function normalizeBusiness(value: unknown, index = 0): Business | null {
  const row = objectValue(value);
  if (!row) return null;
  const id = stringValue(row.id, `business-${index + 1}`).trim();
  const name = stringValue(row.name, id).trim();
  if (!id && !name) return null;
  return {
    id: id || `business-${index + 1}`,
    name: name || id,
    kind: stringValue(row.kind, "business"),
    x: numberValue(row.x, 600),
    y: numberValue(row.y, 380),
    reputation: clamp(numberValue(row.reputation, 70), 0, 100),
    actions: collection(row.actions).map((item) => stringValue(item)).filter(Boolean),
    products: collection(row.products).map(normalizeProduct).filter((item): item is Product => Boolean(item)),
    services: collection(row.services).map(normalizeService).filter((item): item is Service => Boolean(item)),
  };
}
function normalizeBusinesses(value: unknown) {
  return collection(value).map(normalizeBusiness).filter((item): item is Business => Boolean(item));
}
function productsOf(business: Business) { return business.products; }
function servicesOf(business: Business) { return business.services; }

function textSimilarity(left: string, right: string) {
  const a = new Set(left.toLowerCase().split(/[^a-z0-9\u4e00-\u9fff]+/).filter(Boolean));
  const b = new Set(right.toLowerCase().split(/[^a-z0-9\u4e00-\u9fff]+/).filter(Boolean));
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  a.forEach((token) => { if (b.has(token)) overlap += 1; });
  return overlap / Math.max(a.size, b.size);
}
function itemFor(business: Business, action: string, requestedId?: string, requestedName?: string) {
  const pool: Array<Product | Service> = action === "buy_product"
    ? productsOf(business).filter((item) => item.stock > 0)
    : ["book_service", "request_quote"].includes(action)
      ? servicesOf(business).filter((item) => item.slots > 0)
      : [];
  if (!pool.length) return undefined;
  const exact = requestedId ? pool.find((item) => item.id === requestedId) : undefined;
  if (exact) return exact;
  if (requestedName) return [...pool].sort((left, right) => textSimilarity(right.name, requestedName) - textSimilarity(left.name, requestedName) || left.price - right.price)[0];
  return [...pool].sort((left, right) => left.price - right.price)[0];
}
function supports(business: Business, action: string) {
  if (business.actions.includes(action)) return true;
  if (action === "buy_product") return productsOf(business).some((item) => item.stock > 0);
  if (["book_service", "request_quote"].includes(action)) return servicesOf(business).some((item) => item.slots > 0);
  return true;
}
function weights(prompt: string) {
  let reputation = .25, price = .20, availability = .22, distance = .18, fit = .15;
  if (/cheap|budget|便宜|平價|最平|省/.test(prompt)) { price += .17; reputation -= .05; fit -= .04; distance -= .04; availability -= .04; }
  if (/best|quality|品質|最好|reliable|可靠/.test(prompt)) { reputation += .16; price -= .06; distance -= .04; availability -= .03; fit -= .03; }
  if (/near|nearby|closest|最近|附近|快/.test(prompt)) { distance += .18; price -= .05; reputation -= .04; availability -= .04; fit -= .05; }
  if (/available|today|現貨|即日|urgent|急/.test(prompt)) { availability += .18; price -= .04; reputation -= .04; distance -= .05; fit -= .05; }
  const total = reputation + price + availability + distance + fit;
  return { reputation: reputation / total, price: price / total, availability: availability / total, distance: distance / total, fit: fit / total };
}
function candidateDetail(candidate: Candidate) {
  const price = Number.isFinite(candidate.price) && candidate.price < 99999 ? `₡${Math.round(candidate.price)}` : "no price";
  return `${candidate.business.name} · ${price} · ${candidate.availability} avail · rep ${Math.round(candidate.business.reputation)} · score ${candidate.score.toFixed(1)}`;
}

export function WebMcpComparisonRouterRuntime() {
  useEffect(() => {
    const timer = window.setInterval(() => {
      const registry = (window as ComparisonWindow).__ASYMPTA_CITY_WEBMCP__;
      if (!registry || !registry.__spatialWrapped || registry.__comparisonWrapped) return;
      const rawInvoke = registry.invoke.bind(registry);
      registry.__comparisonWrapped = true;
      registry.__comparisonRawInvoke = rawInvoke;
      registry.invoke = async (name, input = {}) => {
        const isUserExecution = name === "city_execute_action" && (!input.agentId || input.agentId === "your-agent");
        if (!isUserExecution) return rawInvoke(name, input);

        try {
          const action = String(input.action ?? "inquire");
          const requestedBusinessId = String(input.businessId ?? "");
          const inspected = await rawInvoke("city_inspect_business", { businessId: requestedBusinessId }) as InspectResult;
          const target = normalizeBusiness(inspected.business);
          if (!target) return rawInvoke(name, input);
          const requestedItem = [...productsOf(target), ...servicesOf(target)].find((item) => item.id === String(input.itemId ?? ""));

          const broad = await rawInvoke("city_search_businesses", { query: "" }) as SearchResult;
          const candidatesRaw = [target, ...normalizeBusinesses(broad.businesses)]
            .filter((business, index, all) => all.findIndex((candidate) => candidate.id === business.id) === index)
            .filter((business) => supports(business, action));
          if (candidatesRaw.length < 2) return rawInvoke(name, input);

          const user = userPosition();
          const prompt = userPrompt();
          const scoredBase = candidatesRaw.map((business) => {
            const item = itemFor(business, action, typeof input.itemId === "string" ? input.itemId : undefined, requestedItem?.name);
            const availability = action === "buy_product"
              ? item && "stock" in item ? item.stock : 0
              : ["book_service", "request_quote"].includes(action)
                ? item && "slots" in item ? item.slots : 0
                : 1;
            const price = item?.price ?? 0;
            const sameKind = business.kind === target.kind;
            const itemFit = requestedItem && item ? textSimilarity(item.name, requestedItem.name) : 0;
            const fit = clamp((sameKind ? 70 : 38) + itemFit * 30, 0, 100);
            return { business, itemId: item?.id, itemName: item?.name, price, availability, fit, score: 0, distance: Math.hypot(business.x - user.x, business.y - user.y) } satisfies Candidate;
          });

          const maxDistance = Math.max(1, ...scoredBase.map((candidate) => candidate.distance));
          const priced = scoredBase.filter((candidate) => candidate.price > 0).map((candidate) => candidate.price);
          const minPrice = priced.length ? Math.min(...priced) : 0;
          const maxPrice = priced.length ? Math.max(...priced) : 1;
          const w = weights(prompt);
          const candidates = scoredBase.map((candidate) => {
            const priceScore = candidate.price <= 0 ? 70 : maxPrice === minPrice ? 100 : 100 - ((candidate.price - minPrice) / (maxPrice - minPrice)) * 100;
            const availabilityScore = clamp(candidate.availability * 10, 0, 100);
            const distanceScore = clamp(100 - (candidate.distance / maxDistance) * 82, 10, 100);
            const score = candidate.business.reputation * w.reputation + priceScore * w.price + availabilityScore * w.availability + distanceScore * w.distance + candidate.fit * w.fit;
            return { ...candidate, score };
          }).sort((left, right) => right.score - left.score).slice(0, 4);

          const baseProgress = currentProgress();
          emitProcess("比較多個選項", `${action} · 搜尋 ${candidates.length} 個可行候選`, Math.min(95, baseProgress + 1), "planning");
          for (let index = 0; index < candidates.length; index += 1) {
            const candidate = candidates[index];
            await rawInvoke("city_inspect_business", { businessId: candidate.business.id });
            emitProcess(`比較候選 ${index + 1}/${candidates.length}`, candidateDetail(candidate), Math.min(96, baseProgress + 2 + index), "talking");
            await delay(420);
          }

          const winner = candidates[0];
          if (!winner) return rawInvoke(name, input);
          emitProcess("選出最佳方案", `${winner.business.name} · ${winner.itemName ?? action} · ${winner.score.toFixed(1)} / 100`, Math.min(97, baseProgress + 6), "planning");
          window.dispatchEvent(new CustomEvent("asympta:webmcp-comparison", { detail: { action, requestedBusinessId, selectedBusinessId: winner.business.id, candidates: candidates.map((candidate) => ({ businessId: candidate.business.id, name: candidate.business.name, itemId: candidate.itemId, itemName: candidate.itemName, price: candidate.price, availability: candidate.availability, score: candidate.score })) } }));

          const result = await rawInvoke(name, { ...input, businessId: winner.business.id, ...(winner.itemId ? { itemId: winner.itemId } : {}) });
          if (result && typeof result === "object") return { ...(result as Record<string, unknown>), comparison: { selected: winner.business.name, score: winner.score, candidates: candidates.map((candidate) => ({ name: candidate.business.name, score: candidate.score, price: candidate.price, availability: candidate.availability })) } };
          return result;
        } catch (error) {
          // Comparison is an enhancement, never a single point of failure. If an
          // old snapshot is stranger than expected, execute the requested action
          // through the canonical spatial/economy path instead of pausing the scenario.
          const message = error instanceof Error ? error.message : "comparison normalization failed";
          console.warn("Asympta comparison fallback:", message);
          emitProcess("比較資料已復原", "舊資料格式已跳過比較，繼續原本任務", currentProgress(), "planning");
          return rawInvoke(name, input);
        }
      };
    }, 520);
    return () => window.clearInterval(timer);
  }, []);

  return null;
}
