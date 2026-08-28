import { useId } from "react";

import type { AgentProfile } from "@/lib/living-world/types";

type AgentPortraitProps = {
  profile: AgentProfile;
  size?: "small" | "medium" | "large";
  active?: boolean;
};

function Frame({ profile, patternId }: { profile: AgentProfile; patternId: string }) {
  const { art } = profile;
  const common = { fill: art.surface, stroke: art.ink, strokeWidth: 2.5 };
  switch (art.style) {
    case "folded-paper":
      return <><path d="M48 5 90 48 48 91 6 48Z" {...common}/><path d="m48 5 12 43-12 43-12-43Z" fill={art.secondary} opacity=".38"/></>;
    case "watercolour":
      return <><path d="M19 12C32 2 48 9 59 8c15-1 29 8 29 23 0 13 6 24-3 36-9 12-19 23-35 21-14-2-31 5-39-8C3 68 9 57 7 44 5 30 8 21 19 12Z" {...common}/><path d="M14 61c18-10 38 13 67-4" fill="none" stroke={art.secondary} strokeWidth="8" opacity=".32"/></>;
    case "nocturne":
      return <><path d="M12 87V40C12 18 28 7 48 7s36 11 36 33v47Z" {...common}/><path d="M18 33c12-17 49-18 61 1" fill="none" stroke={art.secondary} strokeWidth="5" opacity=".65"/><circle cx="70" cy="19" r="3" fill={art.secondary}/></>;
    case "charcoal":
      return <><path d="M9 82 18 16l61-8 9 72-41 12Z" {...common}/><path d="m17 64 58-43M23 79l51-38M22 32l55 36" fill="none" stroke={art.secondary} strokeWidth="2.4" opacity=".42"/><path d="M13 19 82 9" stroke={art.ink} strokeWidth="4" opacity=".22"/></>;
    case "botanical":
      return <><path d="M48 5c17 9 31 11 38 12v32c0 22-16 35-38 43C26 84 10 71 10 49V17c7-1 21-3 38-12Z" {...common}/><path d="M21 70c9-22 27-37 54-44" fill="none" stroke={art.secondary} strokeWidth="3" opacity=".6"/><path d="M28 61c-8-2-11-7-11-13 8-1 14 3 15 10m14-14c-1-8 3-13 9-16 4 7 2 14-5 18" fill={art.secondary} opacity=".5"/></>;
    case "mosaic":
      return <><path d="M8 88c0-28 6-52 20-72l20 25 20-25c14 20 20 44 20 72Z" {...common}/><path d="M10 73 32 50l16 19 16-19 22 23" fill="none" stroke={art.secondary} strokeWidth="6" opacity=".55"/><circle cx="48" cy="23" r="5" fill={art.secondary}/></>;
    case "ink":
      return <><rect x="8" y="8" width="80" height="80" rx="5" {...common}/><path d="M15 18 83 12M11 79l72 6" stroke={art.secondary} strokeWidth="2" opacity=".55"/><path d="M19 12v72M77 10v75" stroke={art.ink} strokeWidth="1" opacity=".22"/></>;
    case "workshop":
      return <><path d="M12 14h72v68H12z" {...common}/><path d="M7 22h10M7 42h10M7 62h10m62-40h10m-10 20h10m-10 20h10" stroke={art.secondary} strokeWidth="4"/><path d="m16 78 64-60" stroke={art.secondary} strokeWidth="7" opacity=".22"/></>;
    case "modernist":
      return <><circle cx="48" cy="48" r="42" {...common}/><path d="M48 6a42 42 0 0 1 42 42H48Z" fill={art.secondary} opacity=".42"/><circle cx="48" cy="48" r="33" fill="none" stroke={art.ink} strokeWidth="1.5" opacity=".28"/></>;
    case "desert":
      return <><rect x="7" y="7" width="82" height="82" rx="24" {...common}/><circle cx="68" cy="26" r="12" fill={art.secondary} opacity=".72"/><path d="M9 72c18-16 30 5 45-6 14-10 20-4 34 4v17H9Z" fill={art.secondary} opacity=".34"/></>;
    case "editorial":
      return <><rect x="14" y="7" width="74" height="78" rx="3" fill={art.secondary} stroke={art.ink} strokeWidth="2.5"/><rect x="7" y="14" width="74" height="74" rx="3" fill={art.surface} stroke={art.ink} strokeWidth="2.5"/><path d="M13 21h62M13 76h62" stroke={art.primary} strokeWidth="2" opacity=".55"/></>;
    case "street-map":
      return <><path d="M25 7h46l20 41-22 41H25L5 48Z" {...common}/><path d="m13 31 29 13 17-26 24 15M13 66l28-15 18 27 25-15" fill="none" stroke={art.secondary} strokeWidth="4" opacity=".58"/><circle cx="48" cy="48" r="5" fill={art.primary}/></>;
    case "porcelain":
      return <><ellipse cx="48" cy="48" rx="34" ry="43" {...common}/><path d="M19 54c12-9 20-11 29-5 12 8 18 4 29-7" fill="none" stroke={art.secondary} strokeWidth="4"/><path d="M26 25c7 5 10 9 11 17M70 68c-7-4-10-8-12-15" fill="none" stroke={art.primary} strokeWidth="2.5" opacity=".65"/></>;
    case "glass":
      return <><circle cx="48" cy="48" r="42" fill={`url(#${patternId})`} stroke={art.ink} strokeWidth="2.5"/><path d="M48 7 77 30 65 77 22 69 18 30Z" fill="none" stroke={art.primary} strokeWidth="2" opacity=".6"/><circle cx="27" cy="27" r="8" fill="#fff" opacity=".42"/></>;
    case "quilt":
      return <><path d="M48 5c9 0 12 9 19 12 8 3 17-2 22 5 5 8-3 15-2 23 1 9 9 14 4 23-4 8-14 5-21 10-7 4-11 13-21 13-9 0-13-9-21-12-8-2-17 3-22-5-5-7 2-15 1-23C6 42-1 36 4 28c4-8 14-5 21-10C33 14 38 5 48 5Z" {...common}/><path d="M16 48h64M48 14v68M25 25l46 46M71 25 25 71" stroke={art.secondary} strokeWidth="2" opacity=".36"/></>;
    case "ocean":
      return <><circle cx="48" cy="48" r="42" {...common}/><path d="M7 57c13-14 23 10 37-2 16-14 25 8 45-4v37H7Z" fill={art.secondary} opacity=".52"/><path d="M11 68c13-12 23 8 36-3 13-10 27 7 38-3" fill="none" stroke={art.primary} strokeWidth="3" opacity=".72"/></>;
    case "sunrise":
      return <><path d="M8 87V45a40 40 0 0 1 80 0v42Z" {...common}/><circle cx="48" cy="42" r="22" fill={art.secondary} opacity=".62"/><path d="M48 7v10M18 20l8 8M78 20l-8 8M8 46h12m56 0h12" stroke={art.primary} strokeWidth="3"/></>;
  }
}

function Eyes({ x1 = 38, x2 = 58, y = 45, ink = "#222", size = 3.8 }: { x1?: number; x2?: number; y?: number; ink?: string; size?: number }) {
  return <><circle cx={x1} cy={y} r={size} fill={ink}/><circle cx={x2} cy={y} r={size} fill={ink}/><circle cx={x1 - 1.1} cy={y - 1.2} r={size * .27} fill="#fff"/><circle cx={x2 - 1.1} cy={y - 1.2} r={size * .27} fill="#fff"/></>;
}

function AnimalGlyph({ profile }: { profile: AgentProfile }) {
  const p = profile.art.primary;
  const s = profile.art.secondary;
  const ink = profile.art.ink;
  switch (profile.species) {
    case "Fox":
      return <g><path d="m26 38-5-20 19 11m30 9 5-20-19 11" fill={p} stroke={ink} strokeWidth="2.4"/><path d="M25 40c0-16 11-25 23-25s23 9 23 25v15c0 16-10 26-23 26S25 71 25 55Z" fill={p} stroke={ink} strokeWidth="2.4"/><path d="M48 77 29 48l19 9 19-9Z" fill={s}/><Eyes ink={ink}/><path d="m43 58 5 4 5-4M48 62v5" fill="none" stroke={ink} strokeWidth="2.3" strokeLinecap="round"/></g>;
    case "Otter":
      return <g><ellipse cx="48" cy="51" rx="24" ry="31" fill={p} stroke={ink} strokeWidth="2.4"/><circle cx="28" cy="30" r="8" fill={p} stroke={ink} strokeWidth="2.4"/><circle cx="68" cy="30" r="8" fill={p} stroke={ink} strokeWidth="2.4"/><ellipse cx="48" cy="59" rx="16" ry="13" fill={s}/><Eyes y={45} ink={ink}/><path d="m44 55 4 3 4-3m-25 2-12-3m13 9-12 3m53-9 12-3m-13 9 12 3" fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round"/></g>;
    case "Owl":
      return <g><path d="m27 31 4-17 12 12m26 5-4-17-12 12" fill={p} stroke={ink} strokeWidth="2.4"/><path d="M24 46c0-18 10-27 24-27s24 9 24 27v14c0 13-10 21-24 21S24 73 24 60Z" fill={p} stroke={ink} strokeWidth="2.4"/><circle cx="38" cy="46" r="12" fill={s}/><circle cx="58" cy="46" r="12" fill={s}/><Eyes x1={38} x2={58} y={46} ink={ink} size={4.5}/><path d="m43 56 5 7 5-7M29 63l9 10m29-10-9 10" fill="none" stroke={ink} strokeWidth="2.4"/></g>;
    case "Turtle":
      return <g><ellipse cx="48" cy="53" rx="28" ry="23" fill={p} stroke={ink} strokeWidth="2.4"/><path d="M28 52 38 37l20 1 11 15-10 15H37Z" fill={s} stroke={ink} strokeWidth="2"/><path d="m38 38 10 15 10-15M28 52h40M37 68l11-15 11 15" fill="none" stroke={ink} strokeWidth="1.6" opacity=".7"/><circle cx="48" cy="27" r="12" fill={p} stroke={ink} strokeWidth="2.4"/><Eyes x1={43} x2={53} y={26} ink={ink} size={2.3}/><path d="M25 67 16 74m55-7 9 7" stroke={ink} strokeWidth="5" strokeLinecap="round"/></g>;
    case "Peacock":
      return <g><path d="M48 48C28 40 17 29 18 14c14 0 25 8 30 23 5-15 16-23 30-23 1 15-10 26-30 34Z" fill={s} stroke={ink} strokeWidth="2.2"/><path d="M48 46C32 32 30 18 35 9c9 5 13 14 13 27 0-13 4-22 13-27 5 9 3 23-13 37Z" fill={p} stroke={ink} strokeWidth="2.2"/><circle cx="26" cy="22" r="4" fill={p}/><circle cx="70" cy="22" r="4" fill={p}/><circle cx="48" cy="17" r="4" fill={s}/><path d="M39 42c0-10 4-16 9-16s9 6 9 16v29c0 8-4 12-9 12s-9-4-9-12Z" fill={p} stroke={ink} strokeWidth="2.4"/><Eyes x1={44} x2={52} y={42} ink={ink} size={2}/><path d="m48 46 5 4-5 2" fill={s} stroke={ink} strokeWidth="1.5"/></g>;
    case "Elephant":
      return <g><circle cx="29" cy="47" r="19" fill={s} stroke={ink} strokeWidth="2.5"/><circle cx="67" cy="47" r="19" fill={s} stroke={ink} strokeWidth="2.5"/><path d="M29 42c0-17 8-25 19-25s19 8 19 25v21c0 11-7 18-19 18S29 74 29 63Z" fill={p} stroke={ink} strokeWidth="2.5"/><Eyes x1={40} x2={56} y={43} ink={ink}/><path d="M48 53v23c0 8 8 8 11 2" fill="none" stroke={ink} strokeWidth="7" strokeLinecap="round"/><path d="M33 60c4 5 8 7 12 7" fill="none" stroke={ink} strokeWidth="2"/></g>;
    case "Deer":
      return <g><path d="M35 29 28 15m7 9-9-2m10-2 3-8m22 17 7-14m-7 9 9-2m-10-2-3-8" fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round"/><path d="m32 35-13-12 3 19m42-7 13-12-3 19" fill={p} stroke={ink} strokeWidth="2.4"/><path d="M29 40c0-16 8-24 19-24s19 8 19 24v18c0 15-8 24-19 24s-19-9-19-24Z" fill={p} stroke={ink} strokeWidth="2.4"/><path d="M37 57c4 9 18 9 22 0" fill={s}/><Eyes y={44} ink={ink}/><path d="m44 57 4 3 4-3" fill="none" stroke={ink} strokeWidth="2"/></g>;
    case "Raven":
      return <g><path d="M29 69c-4-28 8-46 27-46 10 0 18 5 23 13l-20 6 18 10-18 5c-1 14-8 23-20 23Z" fill={p} stroke={ink} strokeWidth="2.5"/><path d="m59 42 26-5-22 13" fill={s} stroke={ink} strokeWidth="2"/><circle cx="57" cy="34" r="4" fill={s}/><circle cx="57" cy="34" r="2" fill={ink}/><path d="M34 50c12 4 18 13 20 26M30 69 19 82m28-5 8 7" fill="none" stroke={s} strokeWidth="3"/></g>;
    case "Beaver":
      return <g><ellipse cx="76" cy="65" rx="10" ry="19" transform="rotate(35 76 65)" fill={s} stroke={ink} strokeWidth="2.2"/><circle cx="48" cy="49" r="29" fill={p} stroke={ink} strokeWidth="2.5"/><circle cx="28" cy="27" r="8" fill={p} stroke={ink} strokeWidth="2.5"/><circle cx="68" cy="27" r="8" fill={p} stroke={ink} strokeWidth="2.5"/><Eyes y={45} ink={ink}/><ellipse cx="48" cy="59" rx="14" ry="10" fill={s}/><path d="M42 65h6v11h-7Zm6 0h7l1 11h-8Z" fill="#fff" stroke={ink} strokeWidth="1.5"/><path d="m44 56 4 3 4-3" fill="none" stroke={ink} strokeWidth="2"/></g>;
    case "Crane":
      return <g><path d="M43 82c-11-15-12-35-1-46 6-6 13-5 17 0 6 7 2 19-8 20-4 0-5-1-8-3" fill="none" stroke={p} strokeWidth="10" strokeLinecap="round"/><circle cx="50" cy="29" r="13" fill="#f7f5ed" stroke={ink} strokeWidth="2.3"/><path d="m61 27 25 5-25 4Z" fill={s} stroke={ink} strokeWidth="1.8"/><circle cx="54" cy="26" r="2.5" fill={ink}/><path d="M43 81v10m12-18 8 17M32 54c6 8 16 11 27 9" fill="none" stroke={ink} strokeWidth="2.5"/><path d="M43 17c4-7 10-8 15-7" stroke={s} strokeWidth="4"/></g>;
    case "Meerkat":
      return <g><path d="M35 83c-5-25-2-42 5-51 4-5 12-5 16 0 8 9 10 26 5 51Z" fill={p} stroke={ink} strokeWidth="2.5"/><ellipse cx="48" cy="29" rx="16" ry="14" fill={p} stroke={ink} strokeWidth="2.4"/><ellipse cx="35" cy="29" rx="9" ry="7" fill={ink} opacity=".7"/><ellipse cx="61" cy="29" rx="9" ry="7" fill={ink} opacity=".7"/><Eyes x1={39} x2={57} y={29} ink="#111" size={2.7}/><path d="M35 58c7 5 19 5 26 0m-3 25 14 7" fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round"/></g>;
    case "Lynx":
      return <g><path d="m26 39-5-24 12 6 3-12 5 20m29 10 5-24-12 6-3-12-5 20" fill={p} stroke={ink} strokeWidth="2.4"/><path d="M25 42c0-16 10-24 23-24s23 8 23 24v15c0 15-10 24-23 24S25 72 25 57Z" fill={p} stroke={ink} strokeWidth="2.4"/><path d="m26 58-9 12 18-3m35-9 9 12-18-3" fill={s} stroke={ink} strokeWidth="1.8"/><Eyes y={45} ink={ink}/><path d="m43 57 5 4 5-4m-5 4v6" fill="none" stroke={ink} strokeWidth="2.2"/><circle cx="33" cy="55" r="1.6" fill={ink}/><circle cx="63" cy="55" r="1.6" fill={ink}/></g>;
    case "Raccoon":
      return <g><path d="m29 38-7-19 18 10m27 9 7-19-18 10" fill={p} stroke={ink} strokeWidth="2.4"/><path d="M25 42c0-16 10-24 23-24s23 8 23 24v16c0 15-10 23-23 23S25 73 25 58Z" fill={p} stroke={ink} strokeWidth="2.4"/><path d="M28 43c6-9 13-10 20-2 7-8 14-7 20 2-5 14-12 16-20 8-8 8-15 6-20-8Z" fill={ink} opacity=".78"/><Eyes y={45} ink="#151817"/><ellipse cx="48" cy="60" rx="10" ry="8" fill={s}/><path d="m44 57 4 4 4-4" fill="none" stroke={ink} strokeWidth="2"/></g>;
    case "Orca":
      return <g><path d="M17 57c7-26 26-39 50-32 10 3 17 10 20 20-10-4-19-2-25 5 7 2 12 9 14 19-11-5-21-5-29 2-10 8-21 5-30-14Z" fill={p} stroke={ink} strokeWidth="2.5"/><path d="M44 29c-2 11 3 20 15 27-10 1-18 6-23 14-12-8-16-22-8-33Z" fill="#f9f8f2"/><path d="M58 34c5-5 11-6 17-2" fill="none" stroke={s} strokeWidth="4"/><circle cx="70" cy="42" r="2.6" fill="#fff"/><path d="M28 35 20 13c12 4 19 11 20 21" fill={p} stroke={ink} strokeWidth="2.4"/></g>;
    case "Hummingbird":
      return <g><path d="M43 46C25 40 15 29 16 15c17 2 27 11 31 26M46 47C58 30 72 24 85 30 77 46 64 53 47 52" fill={s} stroke={ink} strokeWidth="2.2"/><ellipse cx="49" cy="56" rx="12" ry="19" transform="rotate(-18 49 56)" fill={p} stroke={ink} strokeWidth="2.4"/><circle cx="54" cy="37" r="10" fill={p} stroke={ink} strokeWidth="2.3"/><path d="m63 35 26-8-25 14Z" fill={s} stroke={ink} strokeWidth="1.8"/><circle cx="57" cy="34" r="2.4" fill={ink}/><path d="m44 72-10 13m19-12 2 16" stroke={ink} strokeWidth="2.3"/></g>;
    case "Rabbit":
      return <g><ellipse cx="37" cy="26" rx="9" ry="24" transform="rotate(-8 37 26)" fill={p} stroke={ink} strokeWidth="2.4"/><ellipse cx="59" cy="26" rx="9" ry="24" transform="rotate(8 59 26)" fill={p} stroke={ink} strokeWidth="2.4"/><path d="M27 48c0-18 9-28 21-28s21 10 21 28v12c0 14-9 22-21 22s-21-8-21-22Z" fill={p} stroke={ink} strokeWidth="2.4"/><path d="M36 17v18m24-18v18" stroke={s} strokeWidth="5" strokeLinecap="round"/><Eyes y={48} ink={ink}/><ellipse cx="48" cy="62" rx="12" ry="10" fill={s}/><path d="m43 59 5 4 5-4m-5 4v6m0 0-5 3m5-3 5 3" fill="none" stroke={ink} strokeWidth="2"/></g>;
    case "Red panda":
      return <g><path d="m28 39-6-19 18 9m28 10 6-19-18 9" fill={p} stroke={ink} strokeWidth="2.4"/><path d="M25 42c0-16 10-24 23-24s23 8 23 24v16c0 15-10 23-23 23S25 73 25 58Z" fill={p} stroke={ink} strokeWidth="2.4"/><path d="m28 41 12-8 8 11 8-11 12 8-8 22H36Z" fill={s}/><Eyes y={46} ink={ink}/><path d="m43 58 5 4 5-4m-5 4v6" fill="none" stroke={ink} strokeWidth="2"/><path d="M68 72c13 0 18 7 12 15M72 76l9 5m-12 0 9 5" fill="none" stroke={p} strokeWidth="7" strokeLinecap="round"/></g>;
    default:
      return <g><circle cx="48" cy="49" r="28" fill={p} stroke={ink} strokeWidth="2.5"/><Eyes ink={ink}/><path d="m43 59 5 4 5-4" fill="none" stroke={ink} strokeWidth="2"/></g>;
  }
}

export function AgentPortrait({ profile, size = "medium", active = false }: AgentPortraitProps) {
  const patternId = useId().replaceAll(":", "");
  return (
    <span
      className={`agent-portrait agent-portrait--${size} agent-portrait--${profile.art.style}${active ? " is-active" : ""}`}
      role="img"
      aria-label={`${profile.name}, ${profile.species}, ${profile.role.en}`}
      style={{
        "--portrait-primary": profile.art.primary,
        "--portrait-secondary": profile.art.secondary,
      } as React.CSSProperties}
    >
      <svg viewBox="0 0 96 96" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={patternId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={profile.art.surface}/>
            <stop offset=".48" stopColor={profile.art.secondary} stopOpacity=".52"/>
            <stop offset="1" stopColor={profile.art.primary} stopOpacity=".34"/>
          </linearGradient>
        </defs>
        <Frame profile={profile} patternId={patternId}/>
        <AnimalGlyph profile={profile}/>
      </svg>
    </span>
  );
}
