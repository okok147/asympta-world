import { animalVisual, type AnimalId } from "@/lib/animal-catalog";

type Palette = { body: string; accent: string; dark: string; blush: string; bandana: string; bandanaDark: string };

const PALETTE_OVERRIDES: Partial<Record<AnimalId, [string, string, string]>> = {
  fox: ["#f39a38", "#fff0c9", "#4a3426"],
  cat: ["#d49b68", "#fff1da", "#5a4031"],
  dog: ["#c58a55", "#f6dfbe", "#5b4332"],
  wolf: ["#7f8b93", "#e4e7e6", "#45505a"],
  "red-panda": ["#c86c3f", "#f0d1ad", "#4c352e"],
  raccoon: ["#8d8f8c", "#e2e0d8", "#444846"],
  panda: ["#f0eee5", "#ffffff", "#343735"],
  koala: ["#9da6a3", "#eef0ec", "#505856"],
  rabbit: ["#d7c7bb", "#fff3ea", "#665a54"],
  bear: ["#9f7455", "#e7c9aa", "#5b4335"],
  tiger: ["#e89a38", "#ffe8be", "#49382b"],
  leopard: ["#d4aa55", "#f5e0ae", "#503d2d"],
  cheetah: ["#d9b56b", "#f8e7bc", "#4d4235"],
  "snow-leopard": ["#c5c7c4", "#f1f2ef", "#5f6562"],
  zebra: ["#f4f2e8", "#ffffff", "#303433"],
  giraffe: ["#e2b75f", "#f8e3aa", "#74513d"],
  elephant: ["#9aa4aa", "#dce1e3", "#536067"],
  deer: ["#b48155", "#efd5b5", "#5f4636"],
  reindeer: ["#a47657", "#ead1b9", "#574137"],
  moose: ["#80624f", "#d6bca6", "#463832"],
  sheep: ["#eee5d7", "#fff8ed", "#75675d"],
  goat: ["#c9b7a1", "#efe4d1", "#6a5a4f"],
  cow: ["#f2ece1", "#ffffff", "#51443d"],
  pig: ["#e8a9aa", "#ffd7d6", "#8e5e60"],
  horse: ["#b57a4f", "#e9c59f", "#5e4235"],
  lion: ["#d8a154", "#f2d49b", "#68442e"],
  penguin: ["#596268", "#f8f5e9", "#31383c"],
  owl: ["#9a795d", "#e9d6b6", "#57463a"],
  duck: ["#e1c858", "#f7efa8", "#5e5940"],
  chick: ["#e8cf5a", "#fff3a7", "#6a5d34"],
  parrot: ["#69a95f", "#d5efad", "#385b3d"],
  flamingo: ["#e79ba9", "#ffd4d9", "#78535b"],
  peacock: ["#4b988b", "#b8e1cc", "#2e5f58"],
  seal: ["#9ba5a8", "#e5ebea", "#556065"],
  dolphin: ["#78a6ba", "#d9edf2", "#466878"],
  whale: ["#6f8ea5", "#d8e6ed", "#455a68"],
  orca: ["#4b555a", "#f4f2e9", "#283033"],
  shark: ["#78909d", "#d9e2e5", "#43535d"],
  turtle: ["#79955d", "#dce4b8", "#4c603f"],
  frog: ["#7eab54", "#d9e99a", "#4d6a36"],
  axolotl: ["#e8a4b4", "#ffd9e2", "#845568"],
  bee: ["#e6bd49", "#fff0a7", "#493e2c"],
  ladybug: ["#cf5c4d", "#f2aaa0", "#4a3430"],
  butterfly: ["#8f7cc5", "#d9d0f0", "#584d7c"],
  octopus: ["#bd758d", "#efc7d2", "#754b59"],
  jellyfish: ["#9b90ca", "#dcd6f4", "#5f5a85"],
  dinosaur: ["#79a76b", "#d4e7b8", "#46643d"],
  dragon: ["#6b9b82", "#c9e2ce", "#3e5d50"],
  unicorn: ["#d7b8dd", "#f7e8fa", "#785f80"],
};

const MASKED = new Set<AnimalId>(["raccoon", "red-panda", "badger", "skunk", "panda"]);
const STRIPED = new Set<AnimalId>(["tiger", "zebra", "bee", "chipmunk"]);
const SPOTTED = new Set<AnimalId>(["leopard", "cheetah", "giraffe", "ladybug", "snow-leopard"]);
const ANTLERED = new Set<AnimalId>(["deer", "reindeer", "moose"]);
const WHISKERED = new Set<AnimalId>(["cat", "lynx", "mouse", "rat", "hamster", "guinea-pig", "otter", "seal"]);
const LONG_MUZZLE = new Set<AnimalId>(["dog", "wolf", "fox", "horse", "donkey", "zebra", "deer", "reindeer", "moose", "cow", "goat", "sheep"]);
const WINGED = new Set<AnimalId>(["bee", "butterfly", "moth", "dragon"]);
const SHELLED = new Set<AnimalId>(["turtle", "snail", "crab", "lobster"]);
const TENTACLED = new Set<AnimalId>(["octopus", "squid", "jellyfish"]);

function hash(text: string) {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function paletteFor(id: AnimalId): Palette {
  const visual = animalVisual(id);
  const override = PALETTE_OVERRIDES[id];
  return {
    body: override?.[0] ?? visual.body,
    accent: override?.[1] ?? visual.accent,
    dark: override?.[2] ?? visual.dark,
    blush: "#f29b9f",
    bandana: "#79a64a",
    bandanaDark: "#4f7832",
  };
}

function ears(id: AnimalId, family: ReturnType<typeof animalVisual>["family"], palette: Palette) {
  if (family === "bird") return `<path d="M19 23 12 18 16 30Z" fill="${palette.body}" stroke="${palette.dark}"/><path d="M45 23 52 18 48 30Z" fill="${palette.body}" stroke="${palette.dark}"/>`;
  if (family === "aquatic") return `<path d="M17 29 10 24 12 35Z" fill="${palette.accent}" stroke="${palette.dark}"/><path d="M47 29 54 24 52 35Z" fill="${palette.accent}" stroke="${palette.dark}"/>`;
  if (family === "long-ear") return `<path d="M20 22C15 15 15 7 20 5c5 2 6 10 4 18Z" fill="${palette.body}" stroke="${palette.dark}"/><path d="M44 22C49 15 49 7 44 5c-5 2-6 10-4 18Z" fill="${palette.body}" stroke="${palette.dark}"/><path d="M20 18c-2-5-2-8 0-10 2 2 3 5 2 10Z" fill="${palette.accent}"/><path d="M44 18c2-5 2-8 0-10-2 2-3 5-2 10Z" fill="${palette.accent}"/>`;
  if (family === "horned") return `<circle cx="20" cy="20" r="7" fill="${palette.body}" stroke="${palette.dark}"/><circle cx="44" cy="20" r="7" fill="${palette.body}" stroke="${palette.dark}"/><path d="M20 15c-4-5-5-8-3-10m3 8-5-2M44 15c4-5 5-8 3-10m-3 8 5-2" fill="none" stroke="${palette.dark}" stroke-width="2" stroke-linecap="round"/>`;
  if (family === "round" || family === "tiny") return `<circle cx="20" cy="21" r="7" fill="${palette.body}" stroke="${palette.dark}"/><circle cx="44" cy="21" r="7" fill="${palette.body}" stroke="${palette.dark}"/>`;
  if (family === "fantasy" && id === "unicorn") return `<path d="M32 20 35 5 28 18Z" fill="#f1d169" stroke="${palette.dark}"/><path d="M19 25 13 14 25 19Z" fill="${palette.body}" stroke="${palette.dark}"/><path d="M45 25 51 14 39 19Z" fill="${palette.body}" stroke="${palette.dark}"/>`;
  if (family === "fantasy" && id === "dragon") return `<path d="M19 25 12 12 26 20Z" fill="${palette.body}" stroke="${palette.dark}"/><path d="M45 25 52 12 38 20Z" fill="${palette.body}" stroke="${palette.dark}"/><path d="M25 13 28 6 31 13m2 0 3-7 3 8" fill="${palette.accent}" stroke="${palette.dark}"/>`;
  return `<path d="M21 24 13 10 27 17Z" fill="${palette.body}" stroke="${palette.dark}"/><path d="M43 24 51 10 37 17Z" fill="${palette.body}" stroke="${palette.dark}"/><path d="M21 20 17 14 24 17Z" fill="${palette.accent}"/><path d="M43 20 47 14 40 17Z" fill="${palette.accent}"/>`;
}

function markings(id: AnimalId, palette: Palette) {
  if (MASKED.has(id)) return `<path d="M18 29c3-5 7-6 12-2l-3 9c-4 1-7-1-9-7Zm28 0c-3-5-7-6-12-2l3 9c4 1 7-1 9-7Z" fill="${palette.dark}" opacity=".72"/>`;
  if (STRIPED.has(id)) return `<path d="M25 21 23 27m9-7v7m7-5 2 6M22 42l-3 6m10-5-1 7m11-7 2 6" stroke="${palette.dark}" stroke-width="2" stroke-linecap="round" opacity=".65"/>`;
  if (SPOTTED.has(id)) return `<circle cx="24" cy="24" r="2" fill="${palette.dark}" opacity=".55"/><circle cx="40" cy="25" r="1.8" fill="${palette.dark}" opacity=".55"/><circle cx="19" cy="40" r="1.5" fill="${palette.dark}" opacity=".5"/><circle cx="46" cy="41" r="1.4" fill="${palette.dark}" opacity=".5"/>`;
  if (id === "cow") return `<path d="M18 27c3-5 9-6 12-1-5 1-4 7-9 7Z" fill="${palette.dark}" opacity=".55"/><path d="M39 39c4-3 8-1 9 3-5 1-6 4-10 2Z" fill="${palette.dark}" opacity=".5"/>`;
  if (id === "skunk") return `<path d="M29 19c3 4 3 12 1 19l4 7" fill="none" stroke="${palette.accent}" stroke-width="4" stroke-linecap="round"/>`;
  if (id === "peacock") return `<circle cx="24" cy="14" r="2" fill="#5a80b9"/><circle cx="32" cy="11" r="2" fill="#5a80b9"/><circle cx="40" cy="14" r="2" fill="#5a80b9"/>`;
  return "";
}

function speciesExtras(id: AnimalId, palette: Palette) {
  if (ANTLERED.has(id)) return `<path d="M19 17c-4-6-5-10-3-13m2 8-6-2m33 7c4-6 5-10 3-13m-2 8 6-2" stroke="${palette.dark}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  if (id === "rhino") return `<path d="M32 23 38 15 36 26Z" fill="${palette.accent}" stroke="${palette.dark}"/>`;
  if (id === "elephant") return `<path d="M32 36c6 5 4 13 0 14-3 0-4-3-2-5 2-2 2-5 0-7Z" fill="${palette.accent}" stroke="${palette.dark}"/>`;
  if (id === "frog") return `<circle cx="22" cy="22" r="6" fill="${palette.body}" stroke="${palette.dark}"/><circle cx="42" cy="22" r="6" fill="${palette.body}" stroke="${palette.dark}"/>`;
  if (id === "axolotl") return `<path d="M17 30 10 25m7 8-8 0m38-3 7-5m-7 8h8" stroke="#d26988" stroke-width="3" stroke-linecap="round"/>`;
  if (id === "snake") return `<path d="M20 45c6 5 18 5 24 0 5-5-2-8-7-5" fill="none" stroke="${palette.body}" stroke-width="7" stroke-linecap="round"/>`;
  if (WINGED.has(id)) return `<path d="M18 41c-7-6-11-3-9 4 2 5 7 6 12 3m25-7c7-6 11-3 9 4-2 5-7 6-12 3" fill="${palette.accent}" stroke="${palette.dark}" opacity=".82"/>`;
  if (SHELLED.has(id)) return `<path d="M18 47c4-8 24-9 29 0-5 6-23 7-29 0Z" fill="${palette.dark}" opacity=".32"/>`;
  if (TENTACLED.has(id)) return `<path d="M22 49c-2 5 1 7 4 3m3-3c-1 6 2 7 4 2m4-2c1 5 4 6 6 2" fill="none" stroke="${palette.body}" stroke-width="4" stroke-linecap="round"/>`;
  if (id === "dinosaur") return `<path d="M18 24 14 19 20 18m3-4 3-5 3 5m8 0 3-5 3 6" fill="${palette.accent}" stroke="${palette.dark}"/>`;
  return "";
}

function muzzle(id: AnimalId, palette: Palette) {
  const width = LONG_MUZZLE.has(id) ? 22 : 18;
  return `<ellipse cx="32" cy="38" rx="${width / 2}" ry="8" fill="${palette.accent}" opacity=".98"/>`;
}

export function animalBadgeSvg(id: AnimalId) {
  const visual = animalVisual(id);
  const palette = paletteFor(id);
  const seed = hash(id);
  const eyeOffset = seed % 2;
  const sparkleX = 24 + (seed % 4);
  const sparkleY = 24 + ((seed >>> 3) % 3);
  const family = visual.family;
  const beak = family === "bird" ? `<path d="M30 38 37 40 30 43Z" fill="#e5a24d" stroke="${palette.dark}"/>` : "";
  const nose = family === "bird" ? "" : `<path d="M29 37h6l-3 4Z" fill="${palette.dark}"/>`;
  const mouth = family === "bird" ? "" : `<path d="M32 41c0 4-5 6-7 2m7-2c0 4 5 6 7 2" fill="none" stroke="${palette.dark}" stroke-width="1.7" stroke-linecap="round"/>`;
  const whiskers = WHISKERED.has(id) ? `<path d="M20 39 11 37m10 5-9 2m32-5 9-2m-10 5 9 2" stroke="${palette.dark}" stroke-width="1" stroke-linecap="round" opacity=".55"/>` : "";
  const bandana = `<path d="M21 48c6 3 16 3 22 0l-4 10-7-5-7 5Z" fill="${palette.bandana}" stroke="${palette.bandanaDark}" stroke-width="1.5"/><path d="M31 51c2-2 4-1 4 1-2 0-3 1-4 3-1-2-1-3 0-4Z" fill="#dceec8"/>`;
  const sprout = `<path d="M31 17c-1-6 4-8 7-5-1 4-4 6-7 5Zm0 0c4-3 8-2 9 2-4 2-7 1-9-2Z" fill="${palette.bandana}" stroke="${palette.bandanaDark}" stroke-width="1"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" shape-rendering="geometricPrecision">
  <circle cx="32" cy="32" r="30" fill="#f8f6ef" stroke="#9ea19b" stroke-width="2"/>
  <circle cx="32" cy="32" r="27" fill="#efeee8"/>
  <g stroke-linejoin="round" stroke-linecap="round" stroke-width="2">
    ${ears(id, family, palette)}
    ${speciesExtras(id, palette)}
    <ellipse cx="32" cy="38" rx="21" ry="20" fill="${palette.body}" stroke="${palette.dark}"/>
    ${markings(id, palette)}
    ${muzzle(id, palette)}
    <ellipse cx="23" cy="34" rx="5" ry="6" fill="#2d2b29" stroke="${palette.dark}"/>
    <ellipse cx="41" cy="34" rx="5" ry="6" fill="#2d2b29" stroke="${palette.dark}"/>
    <circle cx="${21 + eyeOffset}" cy="31" r="2" fill="#fff"/><circle cx="${39 + eyeOffset}" cy="31" r="2" fill="#fff"/>
    <circle cx="${sparkleX}" cy="${sparkleY}" r="1.2" fill="#fff" opacity=".9"/>
    <circle cx="18" cy="41" r="3" fill="${palette.blush}" opacity=".88"/><circle cx="46" cy="41" r="3" fill="${palette.blush}" opacity=".88"/>
    ${nose}${mouth}${beak}${whiskers}
    ${bandana}${sprout}
  </g>
  </svg>`;
}

const dataUriCache = new Map<AnimalId, string>();

export function animalBadgeDataUri(id: AnimalId) {
  const cached = dataUriCache.get(id);
  if (cached) return cached;
  const uri = `data:image/svg+xml,${encodeURIComponent(animalBadgeSvg(id))}`;
  dataUriCache.set(id, uri);
  return uri;
}
