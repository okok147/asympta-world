export const ANIMAL_IDS = [
  "cat","fox","rabbit","bear","dog","wolf","red-panda","raccoon","otter","capybara",
  "panda","koala","deer","reindeer","moose","alpaca","llama","sheep","goat","cow",
  "pig","boar","horse","donkey","zebra","giraffe","elephant","rhino","hippo","lion",
  "tiger","leopard","cheetah","lynx","snow-leopard","ferret","weasel","mink","badger","skunk",
  "squirrel","chipmunk","hamster","guinea-pig","mouse","rat","hedgehog","mole","bat","sloth",
  "monkey","gorilla","lemur","meerkat","kangaroo","wombat","quokka","possum","penguin","owl",
  "duck","goose","swan","chicken","chick","parrot","cockatiel","crow","raven","sparrow",
  "robin","flamingo","peacock","seal","walrus","dolphin","whale","orca","shark","turtle",
  "frog","axolotl","lizard","chameleon","gecko","snake","bee","ladybug","butterfly","moth",
  "snail","crab","lobster","octopus","squid","jellyfish","seahorse","dinosaur","dragon","unicorn",
] as const;

export type AnimalId = (typeof ANIMAL_IDS)[number];
export type AnimalFamily = "pointy" | "round" | "long-ear" | "horned" | "bird" | "aquatic" | "tiny" | "fantasy";

export type AnimalVisual = {
  id: AnimalId;
  label: string;
  family: AnimalFamily;
  body: string;
  accent: string;
  dark: string;
};

const POINTY = new Set<AnimalId>([
  "cat","fox","dog","wolf","red-panda","raccoon","lion","tiger","leopard","cheetah","lynx","snow-leopard",
  "ferret","weasel","mink","badger","skunk","squirrel","chipmunk","mouse","rat","bat","meerkat","possum",
]);
const LONG_EAR = new Set<AnimalId>(["rabbit","alpaca","llama","horse","donkey","giraffe","kangaroo","quokka"]);
const HORNED = new Set<AnimalId>(["deer","reindeer","moose","sheep","goat","cow","rhino"]);
const BIRDS = new Set<AnimalId>([
  "penguin","owl","duck","goose","swan","chicken","chick","parrot","cockatiel","crow","raven","sparrow","robin","flamingo","peacock",
]);
const AQUATIC = new Set<AnimalId>([
  "seal","walrus","dolphin","whale","orca","shark","turtle","frog","axolotl","crab","lobster","octopus","squid","jellyfish","seahorse",
]);
const TINY = new Set<AnimalId>(["hamster","guinea-pig","hedgehog","mole","bee","ladybug","butterfly","moth","snail","lizard","chameleon","gecko","snake"]);
const FANTASY = new Set<AnimalId>(["dinosaur","dragon","unicorn"]);

const PALETTES = [
  ["#9b9188", "#d4c3b3", "#655f5b"],
  ["#b57651", "#ead6c4", "#714f3f"],
  ["#87958a", "#d9dfd7", "#59645c"],
  ["#8095a8", "#d9e3e9", "#526574"],
  ["#a58c7e", "#e1d2c8", "#69584f"],
  ["#9184a4", "#ddd5e6", "#5f5870"],
  ["#9b9a72", "#e3dfbf", "#66664d"],
  ["#75969a", "#d4e3e1", "#4f696b"],
  ["#b08d66", "#ead8bd", "#725c48"],
  ["#8f8581", "#ded5d0", "#5f5956"],
] as const;

function labelFor(id: AnimalId) {
  return id
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function familyFor(id: AnimalId): AnimalFamily {
  if (FANTASY.has(id)) return "fantasy";
  if (BIRDS.has(id)) return "bird";
  if (AQUATIC.has(id)) return "aquatic";
  if (HORNED.has(id)) return "horned";
  if (LONG_EAR.has(id)) return "long-ear";
  if (TINY.has(id)) return "tiny";
  if (POINTY.has(id)) return "pointy";
  return "round";
}

export function isAnimalId(value: unknown): value is AnimalId {
  return typeof value === "string" && (ANIMAL_IDS as readonly string[]).includes(value);
}

export function animalVisual(id: AnimalId): AnimalVisual {
  const index = ANIMAL_IDS.indexOf(id);
  const palette = PALETTES[index % PALETTES.length];
  return {
    id,
    label: labelFor(id),
    family: familyFor(id),
    body: palette[0],
    accent: palette[1],
    dark: palette[2],
  };
}

export const ANIMAL_CATALOG: AnimalVisual[] = ANIMAL_IDS.map(animalVisual);
