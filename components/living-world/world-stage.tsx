"use client";

import { Check, MapPin, Radio, ShieldCheck, Sparkles } from "lucide-react";
import { useMemo } from "react";

import { AgentPortrait } from "@/components/living-world/agent-portrait";
import { P5AtmosphereCanvas } from "@/components/living-world/p5-atmosphere-canvas";
import { ThreeWorldCanvas } from "@/components/living-world/three-world-canvas";
import { VgpuWorldField } from "@/components/living-world/vgpu-world-field";
import { scenarioFor } from "@/lib/living-world/scenarios";
import {
  WORLD_ZONES,
  type LivingAgent,
  type LivingWorldState,
  type Locale,
  type Point,
  type WorldZoneId,
} from "@/lib/living-world/types";

type WorldStageProps = {
  world: LivingWorldState;
  locale: Locale;
  cameraFollow: boolean;
  selectedAgentId?: string;
  onSelectAgent: (agentId?: string) => void;
};

const ZONE_ORDER: WorldZoneId[] = [
  "human",
  "context",
  "research",
  "market",
  "communication",
  "planning",
  "external",
  "convergence",
];

function participantPoint(world: LivingWorldState, id: string): Point {
  if (id === "human") return WORLD_ZONES.human.point;
  if (id === "team" || id === "coordinator") return WORLD_ZONES.convergence.point;
  return (
    world.agents.find((agent) => agent.id === id)?.position ??
    WORLD_ZONES.convergence.point
  );
}

function phaseCopy(world: LivingWorldState, locale: Locale) {
  const values = {
    idle: { en: "Waiting for what you need", "zh-Hant": "等待你的需要" },
    understanding: { en: "Understanding your need", "zh-Hant": "理解你的需要" },
    coordinating: { en: "Agents coordinating", "zh-Hant": "Agent 正在協調" },
    converging: { en: "Evidence converging", "zh-Hant": "證據正在匯合" },
    reporting: { en: "Bringing the answer back", "zh-Hant": "正在帶回答案" },
    ready: { en: "One useful outcome is ready", "zh-Hant": "一個有用結果已準備" },
    waiting_for_human: { en: "Waiting for your judgment", "zh-Hant": "等待你的判斷" },
    completed: { en: "Need completed", "zh-Hant": "需要已完成" },
  } as const;
  return values[world.phase][locale];
}

function focusPoint(world: LivingWorldState): Point {
  const active = world.agents.filter((agent) =>
    ["moving", "working", "sharing", "returning"].includes(agent.status),
  );
  if (!active.length) return WORLD_ZONES.convergence.point;
  return {
    x: active.reduce((sum, agent) => sum + agent.position.x, 0) / active.length,
    y: active.reduce((sum, agent) => sum + agent.position.y, 0) / active.length,
  };
}

function zoneKind(zone: WorldZoneId) {
  if (zone === "human") return "home";
  if (zone === "convergence") return "hub";
  if (zone === "external") return "portal";
  return "workspace";
}

function HumanMarker({ active }: { active: boolean }) {
  return (
    <div className={`human-marker${active ? " is-active" : ""}`} aria-label="Human">
      <span className="human-marker__halo" />
      <span className="human-marker__head" />
      <span className="human-marker__body" />
      <span className="human-marker__base" />
    </div>
  );
}

function AgentNode({
  agent,
  locale,
  selected,
  onSelect,
}: {
  agent: LivingAgent;
  locale: Locale;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`world-agent world-agent--${agent.status}${selected ? " is-selected" : ""}`}
      style={{
        left: `${agent.position.x}%`,
        top: `${agent.position.y}%`,
      }}
      aria-label={`${agent.profile.name}, ${agent.profile.role[locale]}, ${agent.thought[locale]}`}
      aria-pressed={selected}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      <span className="agent-thought" role="status">
        <span className="agent-thought__state">
          {agent.status === "done" ? <Check size={11} /> : <Radio size={10} />}
          {agent.thought[locale]}
        </span>
      </span>
      <span className={`agent-body agent-body--${agent.facing}`}>
        <AgentPortrait profile={agent.profile} size="medium" active={agent.status === "working"}/>
      </span>
      <span className="agent-nameplate">
        <strong>{agent.profile.name}</strong>
        <small>{agent.profile.role[locale]}</small>
      </span>
    </button>
  );
}

export function WorldStage({
  world,
  locale,
  cameraFollow,
  selectedAgentId,
  onSelectAgent,
}: WorldStageProps) {
  const scenario = world.scenarioId ? scenarioFor(world.scenarioId) : undefined;
  const focus = useMemo(() => focusPoint(world), [world]);
  const activeToolIds = new Set(
    world.toolRuns.filter((run) => run.status === "running").map((run) => run.toolId),
  );
  const displayedZones = useMemo(() => {
    if (!scenario) return ZONE_ORDER;
    const relevant = new Set<WorldZoneId>([
      "human",
      "convergence",
      ...scenario.tasks.map((task) => task.zone),
      ...scenario.services.map((service) => service.zone),
    ]);
    return ZONE_ORDER.filter((zone) => relevant.has(zone));
  }, [scenario]);
  const celebration = Boolean(
    world.celebrationUntil && world.celebrationUntil > world.now,
  );

  return (
    <section
      className="world-stage"
      aria-label="Asympta coordination world"
      data-phase={world.phase}
      data-camera-follow={cameraFollow}
      onClick={() => onSelectAgent(undefined)}
    >
      <div className="world-stage__topline">
        <span className="local-world-label">
          <MapPin size={13}/>
          <span>
            <strong>{world.location.worldName[locale]}</strong>
            <small>
              {world.location.areaName[locale]} · {world.location.source === "device"
                ? locale === "en" ? "device area" : "裝置所在區域"
                : locale === "en" ? "demo area" : "示範區域"}
            </small>
          </span>
        </span>
        <span className="world-phase" aria-live="polite">
          <i data-active={world.phase !== "idle"}/>
          {phaseCopy(world, locale)}
        </span>
      </div>

      <div
        className="world-camera"
        style={{
          "--focus-x": `${focus.x}%`,
          "--focus-y": `${focus.y}%`,
        } as React.CSSProperties}
      >
        <VgpuWorldField world={world}/>
        <ThreeWorldCanvas world={world} cameraFollow={cameraFollow}/>
        <div className="world-paper-grid" aria-hidden="true" />
        <svg className="world-roads" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="M15 67 C24 56 38 52 53 49 S73 47 89 45" />
          <path d="M23 25 C37 37 43 42 53 49 S68 60 80 67" />
          <path d="M48 21 C48 32 50 41 53 49 S53 64 52 76" />
          <path d="M78 25 C72 35 64 43 53 49" />
        </svg>
        <P5AtmosphereCanvas world={world}/>

        {displayedZones.map((zone) => {
          const config = WORLD_ZONES[zone];
          return (
            <div
              className={`world-zone world-zone--${zone} world-zone--${zoneKind(zone)}`}
              key={zone}
              style={{ left: `${config.point.x}%`, top: `${config.point.y}%` }}
              aria-label={config.label[locale]}
            >
              <span className="world-zone__structure" aria-hidden="true">
                <i/><i/><i/><i/>
              </span>
              <span className="world-zone__label">{config.shortLabel[locale]}</span>
            </div>
          );
        })}

        <div
          className="human-area"
          style={{ left: `${WORLD_ZONES.human.point.x}%`, top: `${WORLD_ZONES.human.point.y}%` }}
        >
          <HumanMarker active={Boolean(world.need)}/>
          <span className="human-label">
            <strong>{locale === "en" ? "You" : "你"}</strong>
            <small>{locale === "en" ? "Human intention" : "人的意圖"}</small>
          </span>
          {world.need ? (
            <span className="human-need-bubble">
              <b>{locale === "en" ? "Your need" : "你的需要"}</b>
              {world.need.text}
            </span>
          ) : null}
        </div>

        {scenario?.services.map((service, index) => {
          const point = WORLD_ZONES[service.zone].point;
          const running = activeToolIds.has(service.id);
          return (
            <div
              className={`service-portal${running ? " is-running" : ""}`}
              key={service.id}
              style={{
                left: `${Math.min(93, point.x + 7 + (index % 2) * 2)}%`,
                top: `${Math.max(8, point.y - 4 + (index % 3) * 4)}%`,
              }}
              title={service.description[locale]}
            >
              <span className="service-portal__signal"><i/><i/><i/></span>
              <span>
                <strong>{service.name[locale]}</strong>
                <small>{service.mode.toUpperCase()}</small>
              </span>
            </div>
          );
        })}

        <svg className="agent-connections" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <marker id="message-arrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
              <path d="M0 0 5 2.5 0 5Z" />
            </marker>
          </defs>
          {world.messages.map((message) => {
            const from = participantPoint(world, message.fromId);
            const to = participantPoint(world, message.toId);
            return (
              <line
                key={message.id}
                className={`agent-message-line agent-message-line--${message.type}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                markerEnd="url(#message-arrow)"
              />
            );
          })}
        </svg>

        {world.messages.map((message, index) => {
          const from = participantPoint(world, message.fromId);
          const to = participantPoint(world, message.toId);
          const verticalOffset = (index - (world.messages.length - 1) / 2) * 5.2;
          return (
            <span
              className={`agent-message-label agent-message-label--${message.type}`}
              key={`${message.id}-label`}
              style={{ left: `${(from.x + to.x) / 2}%`, top: `${(from.y + to.y) / 2 + verticalOffset}%` }}
            >
              {message.text[locale]}
            </span>
          );
        })}

        {world.agents.map((agent) => (
          <AgentNode
            key={agent.id}
            agent={agent}
            locale={locale}
            selected={selectedAgentId === agent.id}
            onSelect={() => onSelectAgent(selectedAgentId === agent.id ? undefined : agent.id)}
          />
        ))}

        {!world.need ? (
          <div className="world-idle-message">
            <Sparkles size={17}/>
            <strong>{locale === "en" ? "Your life is the starting point." : "你的生活就是起點。"}</strong>
            <span>{locale === "en" ? "Say what you need below." : "在下方說出你的需要。"}</span>
          </div>
        ) : null}

        {world.phase === "converging" ? (
          <div className="convergence-moment" style={{ left: "53%", top: "33%" }}>
            <span><Check size={12}/> {locale === "en" ? "Research" : "研究"}</span>
            <span><Check size={12}/> {locale === "en" ? "Context" : "情境"}</span>
            <span><Check size={12}/> {locale === "en" ? "Practicality" : "可行性"}</span>
            <strong>{locale === "en" ? "Converging" : "正在匯合"}</strong>
          </div>
        ) : null}

        {celebration ? (
          <div className="need-celebration" style={{ left: "15%", top: "67%" }} aria-label={locale === "en" ? "Completed" : "已完成"}>
            {Array.from({ length: 12 }, (_, index) => (
              <i key={index} style={{ "--celebration-index": index } as React.CSSProperties}/>
            ))}
            <span><ShieldCheck size={15}/>{locale === "en" ? "Done" : "完成"}</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
