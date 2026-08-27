import type { CityTransaction } from "@/lib/latent-city";

export type OwnershipLedgerEntry = {
  index: number;
  transactionId: string;
  at: number;
  ownerId: string;
  counterpartyId: string;
  assetId: string;
  assetName: string;
  quantityDelta: number;
  creditDelta: number;
  previousHash: string;
  hash: string;
};

export type OwnershipLedger = {
  version: 1;
  entries: OwnershipLedgerEntry[];
  root: string;
  anchoredRoot?: string;
  anchor?: {
    mode: "evm-l2";
    chainId: number;
    transactionHash: string;
    anchoredAt: number;
  };
};

export type OwnershipAnchorAdapter = {
  mode: "evm-l2";
  anchorRoot: (root: string) => Promise<{
    chainId: number;
    transactionHash: string;
  }>;
};

export const EMPTY_OWNERSHIP_ROOT = "0".repeat(64);

function toHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  return toHex(await crypto.subtle.digest("SHA-256", bytes));
}

function canonicalEntry(
  index: number,
  transaction: CityTransaction,
  previousHash: string,
) {
  const quantity = transaction.quantity ?? 1;
  const isAcquisition =
    transaction.action === "buy_product" || transaction.action === "book_service";
  const isSale = transaction.action === "sell_resource";
  const isEarn = transaction.action === "deliver";
  return {
    index,
    transactionId: transaction.id,
    at: transaction.at,
    ownerId: transaction.ownerId,
    counterpartyId: "business:" + transaction.businessId,
    assetId:
      transaction.itemId ??
      (isSale ? "resource" : isEarn ? "delivery-work" : transaction.action),
    assetName:
      transaction.itemName ??
      (isSale ? "Resource" : isEarn ? "Delivery work" : transaction.action),
    quantityDelta: isAcquisition ? quantity : isSale ? -quantity : 0,
    creditDelta:
      isAcquisition ? -transaction.credits : isSale || isEarn ? transaction.credits : 0,
    previousHash,
  };
}

export async function appendOwnershipTransaction(
  ledger: OwnershipLedger,
  transaction: CityTransaction,
): Promise<OwnershipLedger> {
  if (ledger.entries.some((entry) => entry.transactionId === transaction.id)) return ledger;
  const previousHash = ledger.root || EMPTY_OWNERSHIP_ROOT;
  const payload = canonicalEntry(ledger.entries.length, transaction, previousHash);
  const hash = await sha256(JSON.stringify(payload));
  const entry: OwnershipLedgerEntry = { ...payload, hash };
  return {
    ...ledger,
    entries: [...ledger.entries, entry].slice(-1000),
    root: hash,
  };
}

export function emptyOwnershipLedger(): OwnershipLedger {
  return { version: 1, entries: [], root: EMPTY_OWNERSHIP_ROOT };
}

export function ownershipBalances(ledger: OwnershipLedger, ownerId: string) {
  const assets: Record<string, number> = {};
  let credits = 0;
  for (const entry of ledger.entries) {
    if (entry.ownerId !== ownerId) continue;
    credits += entry.creditDelta;
    if (entry.quantityDelta !== 0) {
      assets[entry.assetId] = (assets[entry.assetId] ?? 0) + entry.quantityDelta;
    }
  }
  return { credits, assets };
}

export async function verifyOwnershipLedger(ledger: OwnershipLedger) {
  let previousHash = EMPTY_OWNERSHIP_ROOT;
  for (const entry of ledger.entries) {
    const payload = {
      index: entry.index,
      transactionId: entry.transactionId,
      at: entry.at,
      ownerId: entry.ownerId,
      counterpartyId: entry.counterpartyId,
      assetId: entry.assetId,
      assetName: entry.assetName,
      quantityDelta: entry.quantityDelta,
      creditDelta: entry.creditDelta,
      previousHash,
    };
    const expected = await sha256(JSON.stringify(payload));
    if (entry.previousHash !== previousHash || entry.hash !== expected) return false;
    previousHash = entry.hash;
  }
  return previousHash === ledger.root;
}

export async function anchorOwnershipLedger(
  ledger: OwnershipLedger,
  adapter: OwnershipAnchorAdapter,
): Promise<OwnershipLedger> {
  const result = await adapter.anchorRoot(ledger.root);
  return {
    ...ledger,
    anchoredRoot: ledger.root,
    anchor: {
      mode: adapter.mode,
      chainId: result.chainId,
      transactionHash: result.transactionHash,
      anchoredAt: Date.now(),
    },
  };
}
