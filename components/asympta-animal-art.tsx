import type { StakeholderSide } from "@/lib/atlas-simulation";

export type AnimalKind =
  | "cat"
  | "rabbit"
  | "fox"
  | "bear"
  | "raccoon"
  | "panda"
  | "dog"
  | "koala"
  | "owl"
  | "bird";

const ANIMAL_BY_SIDE: Record<StakeholderSide, AnimalKind> = {
  user: "cat",
  customer: "rabbit",
  business: "fox",
  supplier: "bear",
  operations: "raccoon",
  finance: "panda",
  logistics: "dog",
  support: "koala",
  quality: "owl",
  market: "bird",
};

const ACCENT_BY_SIDE: Record<StakeholderSide, string> = {
  user: "#4B7FA6",
  customer: "#6D8EB6",
  business: "#C56F4A",
  supplier: "#698B5D",
  operations: "#9B7A45",
  finance: "#806B9C",
  logistics: "#B05E72",
  support: "#4E8E89",
  quality: "#8B7559",
  market: "#A06D93",
};

const INK = "#4A433A";
const PAPER = "#FAF6EC";
const BLUSH = "#DDA99B";

function detailsFor(kind: AnimalKind) {
  switch (kind) {
    case "cat":
      return `
        <path d="M16 21 20.5 9l8 7M48 21 43.5 9l-8 7" fill="#C99D72" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
        <ellipse cx="32" cy="33" rx="19" ry="17.5" fill="#D6AE83" stroke="${INK}" stroke-width="2.2"/>
        <path d="M21 27c3-2 5-2 8 0M43 27c-3-2-5-2-8 0" fill="none" stroke="#9B7355" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M32 16v5M26 18l2 4M38 18l-2 4" stroke="#9B7355" stroke-width="1.6" stroke-linecap="round"/>
        <path d="M27 37c2.5 2 7.5 2 10 0" fill="none" stroke="${INK}" stroke-width="1.7" stroke-linecap="round"/>
        <path d="m32 34-2-1.8h4z" fill="#8D5F54"/>
      `;
    case "rabbit":
      return `
        <ellipse cx="23" cy="14" rx="5.5" ry="13" fill="#F2E5DB" stroke="${INK}" stroke-width="2.1" transform="rotate(-8 23 14)"/>
        <ellipse cx="41" cy="14" rx="5.5" ry="13" fill="#F2E5DB" stroke="${INK}" stroke-width="2.1" transform="rotate(8 41 14)"/>
        <ellipse cx="23" cy="14" rx="2.1" ry="8.5" fill="#E6B9B2"/>
        <ellipse cx="41" cy="14" rx="2.1" ry="8.5" fill="#E6B9B2"/>
        <ellipse cx="32" cy="34" rx="18" ry="17" fill="#F5ECE5" stroke="${INK}" stroke-width="2.2"/>
        <path d="m32 34-2.2-1.5h4.4z" fill="#B97973"/>
        <path d="M32 35v3M32 38c-2 2-4 2-5.5 1M32 38c2 2 4 2 5.5 1" fill="none" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/>
      `;
    case "fox":
      return `
        <path d="M14 24 19 7l11 11M50 24 45 7 34 18" fill="#CB784B" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M19 12 22 21M45 12 42 21" stroke="#F2D4B7" stroke-width="3" stroke-linecap="round"/>
        <path d="M14 29c1-10 8-16 18-16s17 6 18 16c1 11-7 21-18 21S13 40 14 29Z" fill="#D58251" stroke="${INK}" stroke-width="2.2"/>
        <path d="M20 34c3 0 7 1 12 8 5-7 9-8 12-8-1 8-5 13-12 13s-11-5-12-13Z" fill="#F8E8D7"/>
        <path d="m32 37-2.6-2h5.2z" fill="#553E37"/>
      `;
    case "bear":
      return `
        <circle cx="18" cy="20" r="7" fill="#9B7656" stroke="${INK}" stroke-width="2.1"/>
        <circle cx="46" cy="20" r="7" fill="#9B7656" stroke="${INK}" stroke-width="2.1"/>
        <ellipse cx="32" cy="34" rx="19" ry="18" fill="#A98562" stroke="${INK}" stroke-width="2.2"/>
        <ellipse cx="32" cy="38" rx="9" ry="7" fill="#E7D2B8"/>
        <ellipse cx="32" cy="35" rx="3.2" ry="2.4" fill="#57443A"/>
        <path d="M32 37.5v3M32 40.5c-2 1.8-4 1.8-5.5.7M32 40.5c2 1.8 4 1.8 5.5.7" fill="none" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/>
      `;
    case "raccoon":
      return `
        <path d="M15 23 20 12l9 7M49 23 44 12l-9 7" fill="#77736E" stroke="${INK}" stroke-width="2.1" stroke-linejoin="round"/>
        <ellipse cx="32" cy="34" rx="19" ry="17.5" fill="#9B9790" stroke="${INK}" stroke-width="2.2"/>
        <path d="M16 31c4-7 9-9 16-5 7-4 12-2 16 5-3 6-8 8-16 5-8 3-13 1-16-5Z" fill="#55565A"/>
        <ellipse cx="25" cy="31" rx="3" ry="2.5" fill="#F8F2E8"/>
        <ellipse cx="39" cy="31" rx="3" ry="2.5" fill="#F8F2E8"/>
        <path d="m32 37-2.5-1.7h5z" fill="#3F3C39"/>
        <path d="M27 41c2.5 1.8 7.5 1.8 10 0" fill="none" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/>
      `;
    case "panda":
      return `
        <circle cx="18" cy="19" r="7" fill="#3F3F3C" stroke="${INK}" stroke-width="2"/>
        <circle cx="46" cy="19" r="7" fill="#3F3F3C" stroke="${INK}" stroke-width="2"/>
        <ellipse cx="32" cy="34" rx="19" ry="18" fill="#F4F0E7" stroke="${INK}" stroke-width="2.2"/>
        <ellipse cx="24.5" cy="31" rx="5" ry="6.5" fill="#4B4B49" transform="rotate(17 24.5 31)"/>
        <ellipse cx="39.5" cy="31" rx="5" ry="6.5" fill="#4B4B49" transform="rotate(-17 39.5 31)"/>
        <ellipse cx="32" cy="38" rx="3.2" ry="2.2" fill="#3D3B38"/>
        <path d="M28 42c2 1.5 6 1.5 8 0" fill="none" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/>
      `;
    case "dog":
      return `
        <path d="M16 22c-6-7-5-12-2-15 5 1 9 5 11 11M48 22c6-7 5-12 2-15-5 1-9 5-11 11" fill="#B98257" stroke="${INK}" stroke-width="2.1" stroke-linejoin="round"/>
        <ellipse cx="32" cy="34" rx="19" ry="17.5" fill="#C9976B" stroke="${INK}" stroke-width="2.2"/>
        <path d="M18 25c4-4 8-5 12-3M46 25c-4-4-8-5-12-3" stroke="#9B694C" stroke-width="2" stroke-linecap="round" fill="none"/>
        <ellipse cx="32" cy="38" rx="8" ry="6.5" fill="#F0DCC7"/>
        <ellipse cx="32" cy="35.5" rx="3.2" ry="2.4" fill="#55413A"/>
        <path d="M28 41c2 2 6 2 8 0" fill="none" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/>
      `;
    case "koala":
      return `
        <circle cx="16" cy="26" r="9" fill="#9A9A97" stroke="${INK}" stroke-width="2.1"/>
        <circle cx="48" cy="26" r="9" fill="#9A9A97" stroke="${INK}" stroke-width="2.1"/>
        <circle cx="16" cy="26" r="5" fill="#C9C4BB"/>
        <circle cx="48" cy="26" r="5" fill="#C9C4BB"/>
        <ellipse cx="32" cy="35" rx="18" ry="17" fill="#AFAEAA" stroke="${INK}" stroke-width="2.2"/>
        <ellipse cx="32" cy="37" rx="5" ry="6" fill="#4D4A47"/>
        <path d="M27 43c2.5 1.5 7.5 1.5 10 0" fill="none" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/>
      `;
    case "owl":
      return `
        <path d="M14 27 19 12l9 7h8l9-7 5 15" fill="#9D815F" stroke="${INK}" stroke-width="2.1" stroke-linejoin="round"/>
        <ellipse cx="32" cy="34" rx="18.5" ry="18" fill="#AB8D69" stroke="${INK}" stroke-width="2.2"/>
        <circle cx="25" cy="31" r="7.2" fill="#E9D8BB"/>
        <circle cx="39" cy="31" r="7.2" fill="#E9D8BB"/>
        <circle cx="25" cy="31" r="2.4" fill="#3D3B37"/>
        <circle cx="39" cy="31" r="2.4" fill="#3D3B37"/>
        <path d="m32 34-3 4h6z" fill="#D29A55"/>
        <path d="M26 43c3 1.5 9 1.5 12 0" fill="none" stroke="#80684F" stroke-width="1.6" stroke-linecap="round"/>
      `;
    case "bird":
      return `
        <ellipse cx="32" cy="35" rx="17" ry="18" fill="#91AFC2" stroke="${INK}" stroke-width="2.2"/>
        <path d="M19 31c-6 1-9 5-9 9 5 1 9-1 12-5M45 31c6 1 9 5 9 9-5 1-9-1-12-5" fill="#7A9CB1" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
        <path d="m32 34 7 3.5-7 3.5Z" fill="#D69B56" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>
        <path d="M24 22c4-3 12-3 16 0" fill="none" stroke="#6E91A7" stroke-width="2.3" stroke-linecap="round"/>
      `;
  }
}

export function animalKindFor(side: StakeholderSide) {
  return ANIMAL_BY_SIDE[side];
}

export function animalSvgMarkup(id: string, side: StakeholderSide) {
  const kind = animalKindFor(side);
  const accent = ACCENT_BY_SIDE[side];
  const eyeY = kind === "owl" ? 31 : kind === "bird" ? 30 : 31.5;
  const commonEyes = kind === "owl" || kind === "panda" || kind === "raccoon"
    ? ""
    : `<circle cx="25" cy="${eyeY}" r="1.9" fill="${INK}"/><circle cx="39" cy="${eyeY}" r="1.9" fill="${INK}"/>`;
  const cheeks = `<circle cx="21" cy="37" r="2.4" fill="${BLUSH}" opacity=".34"/><circle cx="43" cy="37" r="2.4" fill="${BLUSH}" opacity=".34"/>`;
  const signature = id.split("").reduce((value, char) => (value + char.charCodeAt(0)) % 5, 0);
  const tuft = signature > 2 && kind !== "bird"
    ? `<path d="M29 16c1.5-2 3.5-3 6-2" fill="none" stroke="${INK}" stroke-width="1.4" stroke-linecap="round" opacity=".55"/>`
    : "";
  return `<svg class="asympta-animal-svg" viewBox="0 0 64 64" role="img" aria-label="${kind} agent" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="32" r="30" fill="${PAPER}" opacity=".96"/>
    ${detailsFor(kind)}
    ${commonEyes}
    ${cheeks}
    ${tuft}
    <path d="M22 50c5 4 15 4 20 0" fill="none" stroke="${accent}" stroke-width="3.2" stroke-linecap="round" opacity=".88"/>
    <circle cx="32" cy="51.5" r="2.2" fill="${accent}" opacity=".9"/>
  </svg>`;
}

export function AnimalPortrait({
  id,
  side,
  className = "",
}: {
  id: string;
  side: StakeholderSide;
  className?: string;
}) {
  return (
    <span
      className={`asympta-animal-portrait ${className}`.trim()}
      data-animal-kind={animalKindFor(side)}
      data-side={side}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: animalSvgMarkup(id, side) }}
    />
  );
}
