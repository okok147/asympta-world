"use client";

import { useLayoutEffect } from "react";

const CITY_KEY = "asympta-latent-city-v1";

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}

function collection(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const row = record(value);
  if (!row) return [];
  if ("id" in row || "name" in row) return [row];
  return Object.values(row);
}

function numberValue(value: unknown, fallback = 0) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : value == null ? fallback : String(value);
}

function normalizeTags(value: unknown) {
  return collection(value).map((item) => stringValue(item)).filter(Boolean).slice(0, 12);
}

function normalizeProducts(value: unknown) {
  return collection(value).map((entry, index) => {
    const row = record(entry);
    if (!row) return null;
    const id = stringValue(row.id, `product-${index + 1}`).trim();
    const name = stringValue(row.name, id).trim();
    if (!id && !name) return null;
    const stock = Math.max(0, numberValue(row.stock ?? row.available ?? row.availability, 0));
    return {
      ...row,
      id: id || `product-${index + 1}`,
      name: name || id,
      price: Math.max(0, numberValue(row.price, 0)),
      stock,
      maxStock: Math.max(stock, numberValue(row.maxStock ?? row.capacity, stock)),
      tags: normalizeTags(row.tags),
    };
  }).filter(Boolean);
}

function normalizeServices(value: unknown) {
  return collection(value).map((entry, index) => {
    const row = record(entry);
    if (!row) return null;
    const id = stringValue(row.id, `service-${index + 1}`).trim();
    const name = stringValue(row.name, id).trim();
    if (!id && !name) return null;
    const slots = Math.max(0, numberValue(row.slots ?? row.available ?? row.availability, 0));
    return {
      ...row,
      id: id || `service-${index + 1}`,
      name: name || id,
      price: Math.max(0, numberValue(row.price, 0)),
      minutes: Math.max(0, numberValue(row.minutes ?? row.duration, 0)),
      slots,
      maxSlots: Math.max(slots, numberValue(row.maxSlots ?? row.capacity, slots)),
      tags: normalizeTags(row.tags),
    };
  }).filter(Boolean);
}

function repairCitySnapshot() {
  try {
    const raw = localStorage.getItem(CITY_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as unknown;
    const state = record(parsed);
    if (!state) return;

    const rawBusinesses = Array.isArray(state.businesses) ? state.businesses : collection(state.businesses);
    const businesses = rawBusinesses.map((entry) => {
      const business = record(entry);
      if (!business) return entry;
      const productsSource = business.products ?? business.product ?? business.items;
      const servicesSource = business.services ?? business.service;
      const actionsSource = business.actions ?? business.action;
      return {
        ...business,
        products: normalizeProducts(productsSource),
        services: normalizeServices(servicesSource),
        actions: collection(actionsSource).map((item) => stringValue(item)).filter(Boolean),
      };
    });

    const next = {
      ...state,
      businesses,
      agents: Array.isArray(state.agents) ? state.agents : collection(state.agents),
      transactions: Array.isArray(state.transactions) ? state.transactions : collection(state.transactions),
    };
    const encoded = JSON.stringify(next);
    if (encoded !== raw) localStorage.setItem(CITY_KEY, encoded);
  } catch {
    // LatentCityRuntime still has its deterministic seed fallback for unrecoverable data.
  }
}

export function CitySchemaGuardRuntime() {
  useLayoutEffect(() => {
    repairCitySnapshot();
    const onStorage = (event: StorageEvent) => {
      if (event.key === CITY_KEY) repairCitySnapshot();
    };
    window.addEventListener("storage", onStorage);
    const timer = window.setInterval(repairCitySnapshot, 2400);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
