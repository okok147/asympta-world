/**
 * Four tiny, hand-drawn storybook wanderers inspired by the supplied visual reference.
 * All markup is locally authored and static. No remote images or user data.
 * They are illustrations, NOT other users' real locations.
 */
export const CREATURES = ["fox", "bear", "bunny", "otter"] as const;
export type CreatureKind = (typeof CREATURES)[number];

const FOX = '<path d="M69 63c17-6 21-20 13-29-1 16-10 20-19 20" fill="#d58b51" stroke="#86725d" stroke-width="2.5"/>' +
  '<path d="M77 42c1 9-5 14-12 16l6-13Z" fill="#f2e7ce"/>' +
  '<path d="M26 54c-8-4-10-14-6-21 4-7 10-8 15-5l1 25Z" fill="#829486" stroke="#696e5d" stroke-width="2.6"/>' +
  '<path d="M24 32c1-8 8-10 12-6l2 5M21 42l9 1" fill="none" stroke="#d0c39b" stroke-width="2"/>' +
  '<path d="M39 77c-4 8-2 13 2 13l9-1 2-10M57 78c0 9 4 12 10 11l3-4-6-9" fill="#d69c5b" stroke="#86725d" stroke-width="2.4"/>' +
  '<path d="M34 57c-2 16 1 25 13 29 17 5 23-4 22-22-1-11-8-19-19-18-9 1-14 5-16 11Z" fill="#e8b36d" stroke="#95795b" stroke-width="2.5"/>' +
  '<path d="M44 63c-3 9 0 17 8 20 6-6 7-14 2-21" fill="#f6ebd9" opacity=".88"/>' +
  '<path d="M38 44 34 17l17 13 15-18 5 32" fill="#dba164" stroke="#947556" stroke-width="2.5" stroke-linejoin="round"/>' +
  '<path d="m38 28 6-7 4 8m13-2 4-7 2 8" fill="#e9b6a4" opacity=".9"/>' +
  '<path d="M32 48c3-19 12-26 23-26 13 0 21 10 20 26-1 17-11 23-23 23-12-1-21-8-20-23Z" fill="#e4ad6a" stroke="#947556" stroke-width="2.7"/>' +
  '<path d="M33 52c4 0 7 2 15 12 3 3 8 3 11 0 7-9 12-11 16-12-2 13-10 19-22 20-13 0-19-7-20-20Z" fill="#f6ebd9"/>' +
  '<path d="M41 47c2-2 4-2 6 0m14 0c2-2 4-2 6 0" fill="none" stroke="#63584b" stroke-width="2.2" stroke-linecap="round"/>' +
  '<path d="m54 54-3-2 6 0Z" fill="#765c50"/>' +
  '<path d="M56 56c-1 3-4 4-7 2" fill="none" stroke="#715e50" stroke-width="1.6" stroke-linecap="round"/>' +
  '<circle cx="38" cy="56" r="3" fill="#ce7e6d" opacity=".3"/><circle cx="69" cy="56" r="3" fill="#ce7e6d" opacity=".3"/>' +
  '<path d="M31 63c-5 4-5 11 2 12m37-10c6 1 7 9 2 11" stroke="#95795b" stroke-width="2.7" fill="none" stroke-linecap="round"/>' +
  '<path d="m35 39-4 12" stroke="#d8c59b" stroke-width="3.2" fill="none"/>';

const BEAR = '<path d="M39 42c-16-1-20 9-19 25 1 16 10 23 26 22 18-1 27-10 25-26-1-16-9-23-23-22Z" fill="#c7a17c" stroke="#8b7764" stroke-width="2.8"/>' +
  '<path d="M34 65c-5 10-4 19 3 22m23-22c7 8 6 18 1 22" fill="none" stroke="#a8866a" stroke-width="4" stroke-linecap="round"/>' +
  '<ellipse cx="48" cy="72" rx="15" ry="15" fill="#ead6b9" opacity=".8"/>' +
  '<path d="M27 44c-8-4-6-15 1-17 6-1 12 5 10 12M66 43c8-5 7-15 0-17-6-2-11 5-11 13" fill="#c5a07b" stroke="#8b7764" stroke-width="2.7"/>' +
  '<path d="M25 50c0-16 10-25 23-25 15 0 26 11 26 27 0 16-12 27-26 27-15 0-23-12-23-29Z" fill="#caa580" stroke="#8b7764" stroke-width="2.7"/>' +
  '<ellipse cx="49" cy="58" rx="12" ry="9" fill="#e8d5bc"/>' +
  '<circle cx="39" cy="49" r="2.2" fill="#64594e"/><circle cx="60" cy="49" r="2.2" fill="#64594e"/>' +
  '<path d="M47 58q2-3 5 0l-2 3z" fill="#715e52"/><path d="M49 61q-4 4-7 0m7 0q3 4 7 0" stroke="#736455" stroke-width="1.5" fill="none" stroke-linecap="round"/>' +
  '<circle cx="31" cy="58" r="4" fill="#bf8378" opacity=".22"/><circle cx="67" cy="58" r="4" fill="#bf8378" opacity=".22"/>' +
  '<path d="M30 30c11 4 22 4 36-2" stroke="#73866a" stroke-width="5.5" fill="none" stroke-linecap="round"/>' +
  '<path d="M37 28q11-20 24-4l5 5q-14 5-29-1Z" fill="#90a283" stroke="#70816c" stroke-width="2.2"/>' +
  '<path d="M34 70q9-10 26 0" stroke="#88947a" stroke-width="3" fill="none"/>' +
  '<path d="M65 73q10-1 11 8l-2 8-13 0-1-12Z" fill="#87967c" stroke="#737a6b" stroke-width="2.2"/>' +
  '<path d="M63 77q-4-6-9-5" stroke="#65705e" stroke-width="2.3" fill="none"/>' +
  '<path d="M26 65q-5 7 0 12m47-10q5 6-2 11" stroke="#8b7764" stroke-width="2.6" fill="none" stroke-linecap="round"/>';

const BUNNY = '<path d="M28 68c-7 15-3 22 10 22h20c12 0 17-10 10-23-6-10-13-15-23-13-9 1-13 5-17 14Z" fill="#f1e8de" stroke="#9b8e82" stroke-width="2.6"/>' +
  '<path d="M31 36c-7-18-10-32-4-37 8-5 15 12 17 30m8-3C53 12 61-3 68 2c8 6-3 26-10 36" fill="#f2e9e0" stroke="#96877d" stroke-width="2.7" stroke-linejoin="round"/>' +
  '<path d="M34 28c-2-11-5-18-6-20m30 20c4-12 8-19 9-20" stroke="#e3b5af" stroke-width="4" fill="none" stroke-linecap="round" opacity=".83"/>' +
  '<path d="M23 49c0-17 12-27 27-27s27 12 27 29c0 16-12 28-27 28-18 0-27-12-27-30Z" fill="#f5ece2" stroke="#9b8e82" stroke-width="2.7"/>' +
  '<path d="M35 48q3-2 6 0m18 0q3-2 6 0" fill="none" stroke="#70665e" stroke-width="2.2" stroke-linecap="round"/>' +
  '<path d="m48 56-3-1.7 6 0Z" fill="#c08c83"/><path d="M48 57v4m0 0q-3 3-6 0m6 0q4 3 6 0" stroke="#8c776e" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
  '<circle cx="32" cy="59" r="4" fill="#dca69f" opacity=".35"/><circle cx="68" cy="59" r="4" fill="#dca69f" opacity=".35"/>' +
  '<path d="M30 75q-9 1-9 8m52-9q9 2 7 10" fill="none" stroke="#9b8e82" stroke-width="2.8" stroke-linecap="round"/>' +
  '<path d="M38 76h22l-4 15H42Z" fill="#e1bd9c" stroke="#957f6d" stroke-width="2.3"/>' +
  '<path d="M59 79q12-3 10 5t-12 4" fill="none" stroke="#957f6d" stroke-width="2.2"/>' +
  '<path d="M43 72c-3-4 3-6 1-9m8 10c-3-5 3-7 2-10" fill="none" stroke="#c9b9a8" stroke-width="1.5" stroke-linecap="round" opacity=".65"/>';

const OTTER = '<path d="M25 59c-8 14-5 26 9 30 11 4 24 2 33-2 10-5 11-21 5-31-6-11-17-15-29-13-8 2-15 6-18 16Z" fill="#a9a69c" stroke="#7b796e" stroke-width="2.7"/>' +
  '<path d="M36 64c-6 12-3 21 11 23 14 0 18-10 13-22" fill="#e9e6db" opacity=".8"/>' +
  '<path d="M27 54c-7-6-9-14-3-19 6-5 12 0 15 6m25-1c5-9 11-11 16-6 6 6 2 14-3 19" fill="#a7a69c" stroke="#78776c" stroke-width="2.6"/>' +
  '<ellipse cx="50" cy="53" rx="29" ry="29" fill="#b4b2a5" stroke="#79786e" stroke-width="2.7"/>' +
  '<ellipse cx="50" cy="65" rx="17" ry="10" fill="#e9e8df"/>' +
  '<path d="M36 54q3-3 6 0m17 0q3-3 6 0" fill="none" stroke="#65635a" stroke-width="2.3" stroke-linecap="round"/>' +
  '<path d="M50 59q-4-2-6 0l5 4 5-4Z" fill="#7e726b"/>' +
  '<path d="M49 63q-4 3-8 1m8-1q3 3 7 1" fill="none" stroke="#696158" stroke-width="1.5" stroke-linecap="round"/>' +
  '<circle cx="30" cy="63" r="4.5" fill="#c6968b" opacity=".3"/><circle cx="69" cy="63" r="4.5" fill="#c6968b" opacity=".3"/>' +
  '<path d="M24 37c2-16 10-23 24-24 17-2 25 8 28 24" fill="#7593a7" stroke="#5c7889" stroke-width="2.5"/>' +
  '<path d="M23 38q27 7 54-1" fill="none" stroke="#66869a" stroke-width="7" stroke-linecap="round"/>' +
  '<path d="M46 10q6-6 11 0" fill="none" stroke="#66869a" stroke-width="5" stroke-linecap="round"/>' +
  '<path d="M35 19v12m9-15v15m10-14v14m10-9v10" stroke="#a5bfca" stroke-width="2" opacity=".7"/>' +
  '<path d="M29 73q-7 4-3 12m45-13q8 5 4 12" fill="none" stroke="#77776e" stroke-width="3" stroke-linecap="round"/>' +
  '<path d="M37 78h24l-4 14H41Z" fill="#f5f1e7" stroke="#868378" stroke-width="2.2"/>' +
  '<path d="M61 80q9-1 8 6-1 6-9 4" fill="none" stroke="#868378" stroke-width="2.2"/>';

const DRAWINGS: Record<CreatureKind, string> = {
  fox: FOX,
  bear: BEAR,
  bunny: BUNNY,
  otter: OTTER,
};

export function creatureSvg(kind: CreatureKind): string {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 106" focusable="false" aria-hidden="true">' +
    '<g fill="none" stroke-linecap="round" stroke-linejoin="round">' +
    '<ellipse cx="50" cy="96" rx="27" ry="5" fill="#c9b99c" stroke="none" opacity=".2"/>' +
    '<g opacity=".96">' + DRAWINGS[kind] + '</g>' +
    '</g></svg>';
}
