"use client";

import { PawPrint, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { ANIMAL_CATALOG, ANIMAL_IDS, animalVisual, isAnimalId, type AnimalId } from "@/lib/animal-catalog";
import { animalBadgeDataUri } from "@/lib/kawaii-animal-badge";

const USER_ANIMAL_KEY = "asympta-user-animal-v2";

function readAnimal(): AnimalId {
  try {
    const saved = localStorage.getItem(USER_ANIMAL_KEY);
    return isAnimalId(saved) ? saved : "fox";
  } catch {
    return "fox";
  }
}

function applyVisual(node: HTMLElement, animal: AnimalId) {
  const visual = animalVisual(animal);
  node.dataset.userAnimal = animal;
  node.dataset.animalId = animal;
  node.dataset.animalFamily = visual.family;
  node.style.setProperty("--animal-body", visual.body);
  node.style.setProperty("--animal-accent", visual.accent);
  node.style.setProperty("--animal-dark", visual.dark);
  node.style.setProperty("--animal-badge-image", `url("${animalBadgeDataUri(animal)}")`);
}

function applyWorldAnimal(node: HTMLElement, animal: AnimalId) {
  const visual = animalVisual(animal);
  node.dataset.animalId = animal;
  node.dataset.animalFamily = visual.family;
  node.style.setProperty("--animal-body", visual.body);
  node.style.setProperty("--animal-accent", visual.accent);
  node.style.setProperty("--animal-dark", visual.dark);
  node.style.setProperty("--animal-badge-image", `url("${animalBadgeDataUri(animal)}")`);
}

export function AnimalAvatarRuntime() {
  const [menuHost, setMenuHost] = useState<HTMLElement | null>(null);
  const [animal, setAnimal] = useState<AnimalId>("fox");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const initial = window.setTimeout(() => setAnimal(readAnimal()), 0);
    const scan = window.setInterval(() => {
      const nextMenu = document.querySelector<HTMLElement>(".agent-task-panel");
      setMenuHost((current) => current === nextMenu ? current : nextMenu);
      document.querySelectorAll<HTMLElement>(".mission-user-agent").forEach((node) => applyVisual(node, animal));
      document.querySelectorAll<HTMLElement>(".community-agent").forEach((node, index) => applyWorldAnimal(node, ANIMAL_IDS[index % ANIMAL_IDS.length]));
      document.querySelectorAll<HTMLElement>(".city-agent").forEach((node, index) => applyWorldAnimal(node, ANIMAL_IDS[(index + 37) % ANIMAL_IDS.length]));
    }, 420);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(scan);
    };
  }, [animal]);

  useEffect(() => {
    try { localStorage.setItem(USER_ANIMAL_KEY, animal); } catch { /* memory fallback */ }
    document.querySelectorAll<HTMLElement>(".mission-user-agent").forEach((node) => applyVisual(node, animal));
  }, [animal]);

  const matches = useMemo(() => {
    const clean = query.trim().toLowerCase();
    return ANIMAL_CATALOG.filter((item) => !clean || item.id.includes(clean) || item.label.toLowerCase().includes(clean));
  }, [query]);

  return (
    <>
      <style>{`
        .agent-task-panel .agent-avatar-row { display:none!important; }
        .animal-avatar-section { display:grid; gap:7px; margin-top:10px; padding-top:9px; border-top:1px solid rgba(112,120,114,.11); }
        .animal-avatar-title { display:flex; align-items:center; gap:5px; color:#858b86; font-family:var(--pixel-font); font-size:.34rem; letter-spacing:.06em; text-transform:uppercase; }
        .animal-avatar-title svg { width:11px; height:11px; }
        .animal-search { display:flex; align-items:center; gap:5px; min-height:30px; padding:0 8px; border:1px solid rgba(112,121,114,.13); border-radius:9px; background:rgba(255,255,255,.22); }
        .animal-search svg { width:11px; height:11px; color:#89918b; }
        .animal-search input { width:100%; min-width:0; border:0; outline:0; background:transparent; color:#5f6962; font-size:.43rem; }
        .animal-picker { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:5px; max-height:224px; overflow:auto; padding-right:2px; }
        .animal-choice { display:grid; justify-items:center; align-content:center; gap:2px; min-height:58px; padding:3px; overflow:hidden; border:1px solid rgba(112,120,114,.12); border-radius:10px; background:rgba(255,255,255,.18); color:#717a74; cursor:pointer; }
        .animal-choice img { width:36px; height:36px; display:block; object-fit:contain; image-rendering:auto; }
        .animal-choice span { max-width:100%; overflow:hidden; font-family:var(--pixel-font); font-size:.24rem; text-overflow:ellipsis; white-space:nowrap; }
        .animal-choice.is-selected { border-color:rgba(118,139,181,.38); background:rgba(118,139,181,.1); color:#526b9c; box-shadow:0 0 0 2px rgba(118,139,181,.04); }
        .animal-random { min-height:32px; border:1px solid rgba(118,139,181,.18); border-radius:9px; background:rgba(118,139,181,.06); color:#61749c; font-size:.41rem; cursor:pointer; }

        /* Every selectable identity now uses the same full kawaii badge language. */
        .mission-user-agent .mission-pixel-person { display:none!important; }
        .shared-agent-animal-body,
        .community-agent[data-animal-id] .community-agent-body,
        .city-agent[data-animal-id] .city-agent-body {
          background-color:transparent!important;
          background-image:var(--animal-badge-image)!important;
          background-repeat:no-repeat!important;
          background-position:center!important;
          background-size:contain!important;
          border:0!important;
          border-radius:50%!important;
          box-shadow:none!important;
          image-rendering:auto;
        }
        .shared-agent-animal-body::before,.shared-agent-animal-body::after,
        .community-agent[data-animal-id] .community-agent-body::before,
        .community-agent[data-animal-id] .community-agent-body::after,
        .city-agent[data-animal-id] .city-agent-body::before,
        .city-agent[data-animal-id] .city-agent-body::after {
          display:none!important;
          content:none!important;
          box-shadow:none!important;
        }
      `}</style>
      {menuHost ? createPortal(
        <section className="animal-avatar-section" aria-label="Choose from 100 kawaii badge animal agents">
          <span className="animal-avatar-title"><PawPrint aria-hidden="true" />Animal identity · 100</span>
          <label className="animal-search"><Search aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search animal" aria-label="Search animal identity" /></label>
          <div className="animal-picker">
            {matches.map((item) => (
              <button key={item.id} type="button" className={"animal-choice" + (animal === item.id ? " is-selected" : "")} onClick={() => setAnimal(item.id)} title={item.label}>
                <img src={animalBadgeDataUri(item.id)} alt="" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
          <button type="button" className="animal-random" onClick={() => setAnimal(ANIMAL_IDS[Math.floor(Math.random() * ANIMAL_IDS.length)])}>CUTE · random from 100</button>
        </section>,
        menuHost,
        "animal-avatar-picker",
      ) : null}
    </>
  );
}
