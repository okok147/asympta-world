import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildAsymptaBusinessAgentReply,
  parseAsymptaBusinessProducts,
  parseAsymptaBusinessProfile,
} from "../lib/asympta-business-workspace.ts";

test("business profile import accepts JSON and CSV without inventing missing fields", () => {
  const json = parseAsymptaBusinessProfile(JSON.stringify({
    name: "Harbour Bakery",
    category: "Bakery",
    location: "12 Harbour Road",
    hours: "Mon-Fri 08:00-18:00",
  }));
  assert.equal(json.name, "Harbour Bakery");
  assert.equal(json.category, "Bakery");
  assert.equal(json.contact, "");

  const csv = parseAsymptaBusinessProfile("name,category,location\nNorth Star Books,Bookshop,Central");
  assert.equal(csv.name, "North Star Books");
  assert.equal(csv.category, "Bookshop");
  assert.equal(csv.location, "Central");
});

test("product import accepts JSON and CSV and preserves unknown availability", () => {
  const products = parseAsymptaBusinessProducts(JSON.stringify([
    { sku: "bread-1", name: "Sourdough loaf", price: 48, currency: "HKD", availability: "available" },
    { name: "Rye loaf", price: 52, currency: "HKD" },
  ]));
  assert.equal(products.length, 2);
  assert.equal(products[0].id, "bread-1");
  assert.equal(products[0].availability, "available");
  assert.equal(products[1].availability, "unknown");

  const csv = parseAsymptaBusinessProducts("name,price,currency,availability\nCoffee,32,HKD,in stock");
  assert.equal(csv.length, 1);
  assert.equal(csv[0].name, "Coffee");
  assert.equal(csv[0].price, 32);
  assert.equal(csv[0].availability, "available");
});

test("business agent answers only from imported business and product evidence", () => {
  const profile = parseAsymptaBusinessProfile(JSON.stringify({
    name: "Harbour Bakery",
    location: "12 Harbour Road",
    hours: "Mon-Fri 08:00-18:00",
  }));
  const products = parseAsymptaBusinessProducts(JSON.stringify([
    { id: "bread-1", name: "Sourdough loaf", price: 48, currency: "HKD", availability: "available" },
  ]));

  const productReply = buildAsymptaBusinessAgentReply(profile, products, "Do you have a sourdough loaf?");
  assert.equal(productReply.status, "answered");
  assert.equal(productReply.matchedProductId, "bread-1");
  assert.match(productReply.text, /HKD 48/);
  assert.match(productReply.text, /available/);

  const unknownReply = buildAsymptaBusinessAgentReply(profile, products, "Do you sell wedding cakes?");
  assert.equal(unknownReply.status, "needs_business_confirmation");
  assert.equal(unknownReply.matchedProductId, null);
  assert.match(unknownReply.text, /does not contain enough information/i);
});

test("unknown price or availability stays unresolved instead of becoming a fake promise", () => {
  const profile = parseAsymptaBusinessProfile('{"name":"Harbour Bakery"}');
  const products = parseAsymptaBusinessProducts('[{"id":"bread-2","name":"Rye loaf"}]');
  const reply = buildAsymptaBusinessAgentReply(profile, products, "Is the rye loaf available and how much?");
  assert.equal(reply.status, "needs_business_confirmation");
  assert.match(reply.text, /no confirmed availability/i);
  assert.match(reply.text, /Price has not been imported/i);
});

test("home keeps the existing user world and mounts the business mode as an additive shell", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const component = await readFile(new URL("../components/asympta-business-mode.tsx", import.meta.url), "utf8");

  assert.match(page, /<AsymptaWorldLive60Hz \/>/);
  assert.match(page, /<AsymptaIntentComposer \/>/);
  assert.match(page, /<AsymptaBusinessMode \/>/);
  assert.match(component, /useState<AudienceMode>\("users"\)/);
  assert.match(component, /data-asympta-business-world="true"/);
  assert.match(component, /Business Agent ↔ Customer Agent/);
  assert.match(component, /Import JSON \/ CSV/);
  assert.match(component, /asympta:business-profile-updated/);
  assert.match(component, /asympta:business-catalog-updated/);
  assert.match(component, /asympta:business-agent-message/);
});

test("business workspace stays compact, collapsed by default, and away from top menus", async () => {
  const component = await readFile(new URL("../components/asympta-business-mode.tsx", import.meta.url), "utf8");

  assert.match(component, /const \[workspaceOpen, setWorkspaceOpen\] = useState\(false\)/);
  assert.match(component, /data-business-workspace-open=\{workspaceOpen \? "true" : "false"\}/);
  assert.match(component, /top: "auto"/);
  assert.match(component, /bottom: "max\(18px, env\(safe-area-inset-bottom\)\)"/);
  assert.match(component, /width: workspaceOpen \? "min\(356px, calc\(100vw - 24px\)\)" : "min\(206px, calc\(100vw - 24px\)\)"/);
  assert.match(component, /maxHeight: workspaceOpen \? "min\(58dvh, 520px\)" : "56px"/);
  assert.match(component, /<div hidden=\{!workspaceOpen\}>/);
});
