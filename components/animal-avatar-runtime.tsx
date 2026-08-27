"use client";

import { PawPrint, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { ANIMAL_CATALOG, ANIMAL_IDS, animalVisual, isAnimalId, type AnimalId } from "@/lib/animal-catalog";

const USER_ANIMAL_KEY = "asympta-user-animal-v2";

function readAnimal(): AnimalId {
  try {
    const saved = localStorage.getItem(USER_ANIMAL_KEY);
    return isAnimalId(saved) ? saved : "cat";
  } catch {
    return "cat";
  }
}

function applyVisual(node: HTMLElement, animal: AnimalId) {
  const visual = animalVisual(animal);
  node.dataset.userAnimal = animal;
  node.dataset.animalFamily = visual.family;
  node.style.setProperty("--animal-body", visual.body);
  node.style.setProperty("--animal-accent", visual.accent);
  node.style.setProperty("--animal-dark", visual.dark);
}

function applyWorldAnimal(node: HTMLElement, animal: AnimalId) {
  const visual = animalVisual(animal);
  node.dataset.animalId = animal;
  node.dataset.animalFamily = visual.family;
  node.style.setProperty("--animal-body", visual.body);
  node.style.setProperty("--animal-accent", visual.accent);
  node.style.setProperty("--animal-dark", visual.dark);
}

export function AnimalAvatarRuntime() {
  const [menuHost, setMenuHost] = useState<HTMLElement | null>(null);
  const [animal, setAnimal] = useState<AnimalId>("cat");
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
        .animal-picker { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:4px; max-height:152px; overflow:auto; padding-right:2px; }
        .animal-choice { min-height:28px; padding:0 5px; overflow:hidden; border:1px solid rgba(112,120,114,.12); border-radius:8px; background:rgba(255,255,255,.18); color:#717a74; font-family:var(--pixel-font); font-size:.27rem; text-overflow:ellipsis; white-space:nowrap; cursor:pointer; }
        .animal-choice.is-selected { border-color:rgba(118,139,181,.35); background:rgba(118,139,181,.1); color:#526b9c; }
        .animal-random { min-height:30px; border:1px solid rgba(118,139,181,.18); border-radius:9px; background:rgba(118,139,181,.06); color:#61749c; font-size:.41rem; cursor:pointer; }

        .mission-user-agent[data-user-animal] .mission-pixel-person::before {
          left:3px!important; top:3px!important; width:4px!important; height:4px!important; border-radius:1px!important;
          background:var(--animal-dark)!important;
          box-shadow:16px 0 var(--animal-dark),4px 4px var(--animal-body),8px 4px var(--animal-body),12px 4px var(--animal-body),0 8px var(--animal-body),4px 8px var(--animal-accent),8px 8px var(--animal-accent),12px 8px var(--animal-accent),16px 8px var(--animal-body),4px 12px var(--animal-body),8px 12px var(--animal-body),12px 12px var(--animal-body),4px 16px var(--animal-body),8px 16px var(--animal-body),12px 16px var(--animal-body),0 20px var(--animal-dark),4px 20px var(--animal-dark),12px 20px var(--animal-dark),16px 20px var(--animal-dark)!important;
        }
        .mission-user-agent[data-animal-family="long-ear"] .mission-pixel-person::after,
        .mission-user-agent[data-animal-family="horned"] .mission-pixel-person::after,
        .mission-user-agent[data-animal-family="bird"] .mission-pixel-person::after,
        .mission-user-agent[data-animal-family="aquatic"] .mission-pixel-person::after,
        .mission-user-agent[data-animal-family="fantasy"] .mission-pixel-person::after {
          content:""; position:absolute; left:5px; top:-2px; width:4px; height:8px; border-radius:2px; background:var(--animal-dark); box-shadow:10px 0 var(--animal-dark); opacity:.9;
        }
        .mission-user-agent[data-animal-family="bird"] .mission-pixel-person::after { left:7px; top:8px; width:8px; height:4px; border-radius:0; background:var(--animal-accent); box-shadow:8px 0 var(--animal-accent); }
        .mission-user-agent[data-animal-family="aquatic"] .mission-pixel-person::after { left:2px; top:14px; width:5px; height:4px; border-radius:50%; background:var(--animal-accent); box-shadow:16px 0 var(--animal-accent); }
        .mission-user-agent[data-animal-family="fantasy"] .mission-pixel-person::after { left:9px; top:-5px; width:4px; height:9px; transform:rotate(18deg); background:var(--animal-accent); box-shadow:none; }

        .community-agent[data-animal-id] .community-agent-body,
        .city-agent[data-animal-id] .city-agent-body { background:var(--animal-body)!important; border-color:var(--animal-dark)!important; }
        .community-agent[data-animal-id] .community-agent-body::before,
        .city-agent[data-animal-id] .city-agent-body::before { content:""; position:absolute; left:1px; top:-2px; width:2px; height:2px; border-radius:1px; background:var(--animal-dark); box-shadow:4px 0 var(--animal-dark); opacity:.92; }
        .community-agent[data-animal-family="round"] .community-agent-body::before,
        .city-agent[data-animal-family="round"] .city-agent-body::before { top:0; opacity:.45; }
        .community-agent[data-animal-family="long-ear"] .community-agent-body::before,
        .city-agent[data-animal-family="long-ear"] .city-agent-body::before { width:2px; height:4px; top:-4px; }
        .community-agent[data-animal-family="bird"] .community-agent-body::before,
        .city-agent[data-animal-family="bird"] .city-agent-body::before { left:5px; top:3px; width:3px; height:2px; box-shadow:none; background:var(--animal-accent); }
        .community-agent[data-animal-family="aquatic"] .community-agent-body::before,
        .city-agent[data-animal-family="aquatic"] .city-agent-body::before { left:-2px; top:3px; width:3px; height:3px; box-shadow:8px 0 var(--animal-accent); background:var(--animal-accent); }
      `}</style>
      {menuHost ? createPortal(
        <section className="animal-avatar-section" aria-label="Choose from 100 cute animal agents">
          <span className="animal-avatar-title"><PawPrint aria-hidden="true" />Animal identity · 100</span>
          <label className="animal-search"><Search aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search animal" aria-label="Search animal identity" /></label>
          <div className="animal-picker">
            {matches.map((item) => (
              <button key={item.id} type="button" className={"animal-choice" + (animal === item.id ? " is-selected" : "")} onClick={() => setAnimal(item.id)} title={item.label}>{item.label}</button>
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
