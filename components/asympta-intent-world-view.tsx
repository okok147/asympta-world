"use client";

import {
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Languages,
  LoaderCircle,
  MessageCircle,
  Pause,
  Play,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import type { ChangeEvent, CSSProperties, FormEvent, KeyboardEvent } from "react";

import { AnimalPortrait } from "@/components/asympta-animal-art";
import {
  AMBIENT_ACTORS,
  MODEL,
  taskStatus,
  type ChatMessage,
  type Copy,
  type Locale,
  type PlannerState,
} from "@/components/asympta-intent-world-support";
import { INTENT_AGENT_BY_ID, INTENT_LOCATIONS } from "@/lib/intent-world/catalog";
import type {
  AsymptaAgentId,
  IntentAgentState,
  IntentApproval,
  IntentTaskState,
  IntentWorldEvent,
  IntentWorldState,
} from "@/lib/intent-world/types";

type CurrentRef<T> = { current: T };

type IntentWorldViewProps = {
  world: IntentWorldState;
  copy: Copy;
  locale: Locale;
  autoRun: boolean;
  plannerState: PlannerState;
  plannerNote: string | null;
  questions: string[];
  conversation: ChatMessage[];
  input: string;
  selectedAgentId: AsymptaAgentId;
  providerLabel: string;
  progress: number;
  pendingApproval: IntentApproval | null;
  selectedAgent: IntentAgentState | undefined;
  selectedTask: IntentTaskState | null;
  activeTaskByAgent: ReadonlyMap<AsymptaAgentId, IntentTaskState>;
  lastMessageByAgent: ReadonlyMap<AsymptaAgentId, string>;
  latestEvents: IntentWorldEvent[];
  messagesEndRef: CurrentRef<HTMLDivElement | null>;
  onToggleAutoRun: () => void;
  onReset: () => void;
  onToggleLanguage: () => void;
  onLocaleChange: (locale: Locale) => void;
  onSelectAgent: (agentId: AsymptaAgentId) => void;
  onApproval: (approvalId: string, approved: boolean) => unknown;
  onSubmit: (event: FormEvent) => void | Promise<void>;
  onComposerKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onInput: (value: string) => void;
  languageOpen: boolean;
};

export function IntentWorldView({
  world, copy, locale, autoRun, plannerState, plannerNote, questions, conversation, input,
  selectedAgentId, providerLabel, progress, pendingApproval, selectedAgent, selectedTask,
  activeTaskByAgent, lastMessageByAgent, latestEvents, messagesEndRef, onToggleAutoRun, onReset,
  onToggleLanguage, onLocaleChange, onSelectAgent, onApproval, onSubmit, onComposerKeyDown, onInput,
  languageOpen,
}: IntentWorldViewProps) {
  return (
    <div
      className="map-app asympta-intent-world"
      data-map-app="true"
      data-map-style="paper-illustrated-animal-intention-world"
      data-render-mode="validated-state-machine-raf-60hz"
      data-phase={world.phase}
    >
      <p className="sr-only">A calm world with illustrated animal stakeholder agents, natural-language planning, deterministic execution, validation, and human approval boundaries.</p>

      <header className="intent-header">
        <div className="intent-brand">
          <AnimalPortrait id="agent-user-brand" side="user" className="intent-brand__portrait" />
          <div>
            <strong>{copy.product}</strong>
            <span>{copy.subtitle}</span>
          </div>
        </div>

        <div className="intent-header__state" aria-live="polite">
          <span className="intent-phase" data-phase={world.phase}>
            <span className="intent-phase__dot" />
            {copy.phase[world.phase]}
          </span>
          <span className="intent-model-badge" data-provider={world.provenance?.provider ?? "pending"}>
            <Sparkles size={13} aria-hidden="true" />
            {providerLabel}
          </span>
          <span className="intent-revision">
            <ShieldCheck size={13} aria-hidden="true" />
            {copy.validatedState} · r{world.revision}
          </span>
        </div>

        <div className="intent-header__controls">
          <button className="intent-icon-button" type="button" onClick={onToggleAutoRun} aria-label={autoRun ? copy.pause : copy.resume} title={autoRun ? copy.pause : copy.resume}>
            {autoRun ? <Pause size={17} /> : <Play size={17} />}
          </button>
          <button className="intent-icon-button" type="button" onClick={onReset} aria-label={copy.reset} title={copy.reset}>
            <RotateCcw size={17} />
          </button>
          <div className="intent-language">
            <button className="intent-language__button" type="button" onClick={() => onToggleLanguage()} aria-expanded={languageOpen} aria-label={copy.language}>
              <Languages size={17} />
              <span>{locale === "zh-Hant" ? "繁中" : locale === "ja" ? "日本語" : "EN"}</span>
              <ChevronDown size={14} />
            </button>
            {languageOpen ? (
              <div className="intent-language__menu" role="menu">
                <button type="button" role="menuitem" onClick={() => onLocaleChange("en")}>English {locale === "en" ? <Check size={14} /> : null}</button>
                <button type="button" role="menuitem" onClick={() => onLocaleChange("zh-Hant")}>繁體中文 {locale === "zh-Hant" ? <Check size={14} /> : null}</button>
                <button type="button" role="menuitem" onClick={() => onLocaleChange("ja")}>日本語 {locale === "ja" ? <Check size={14} /> : null}</button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main className="intent-layout">
        <section className="intent-map-shell" aria-label="Asympta simulated coordination world">
          <div className="intent-map-grid" aria-hidden="true" />
          <svg className="intent-map-roads" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path d="M4 70 C20 61 28 48 49 43 S76 45 96 30" />
            <path d="M19 8 C29 27 41 39 51 43 S72 61 95 78" />
            <path d="M5 30 C24 35 35 24 54 18 S79 20 96 45" />
            <path d="M13 92 C30 77 48 79 64 65 S80 45 90 14" />
          </svg>

          <svg className="intent-route-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {world.agents.filter((agent) => agent.status === "moving").map((agent) => (
              <line key={agent.id} x1={agent.position.x} y1={agent.position.y} x2={agent.target.x} y2={agent.target.y} data-side={agent.side} />
            ))}
          </svg>

          <div className="intent-locations" aria-hidden="true">
            {Object.values(INTENT_LOCATIONS).map((location) => (
              <span key={location.id} className="intent-location" style={{ left: `${location.point.x}%`, top: `${location.point.y}%` }}>
                <span className="intent-location__dot" />
                <span>{location.shortLabel}</span>
              </span>
            ))}
          </div>

          <div className="intent-ambient" aria-hidden="true">
            {AMBIENT_ACTORS.map((actor) => (
              <span
                key={actor.id}
                className="animal-map-marker--ambient intent-ambient-agent"
                style={{ left: `${actor.x}%`, top: `${actor.y}%`, animationDelay: `${actor.delay}s` }}
              >
                <AnimalPortrait id={actor.id} side={actor.side} />
              </span>
            ))}
          </div>

          <div className="intent-agents">
            {world.agents.map((agent) => {
              const activeTask = activeTaskByAgent.get(agent.id);
              const bubble = activeTask?.title ?? lastMessageByAgent.get(agent.id) ?? (agent.id === "agent-user" ? copy.standingBy : agent.role);
              const markerStyle = {
                left: `${agent.position.x}%`,
                top: `${agent.position.y}%`,
                "--agent-side": agent.side,
              } as CSSProperties;
              return (
                <button
                  key={agent.id}
                  type="button"
                  className={`animal-map-marker--foreground intent-agent ${selectedAgentId === agent.id ? "is-selected" : ""}`}
                  data-status={agent.status}
                  data-side={agent.side}
                  style={markerStyle}
                  onClick={() => onSelectAgent(agent.id)}
                  aria-label={`${agent.name}, ${agent.role}, ${copy.status[agent.status] ?? agent.status}`}
                >
                  <span className="intent-agent__bubble">{bubble}</span>
                  <span className="intent-agent__portrait"><AnimalPortrait id={agent.id} side={agent.side} /></span>
                  <span className="intent-agent__name">{agent.name}</span>
                  <span className="intent-agent__status">{copy.status[agent.status] ?? agent.status}{activeTask && activeTask.status === "working" ? ` · ${Math.round(activeTask.progress * 100)}%` : ""}</span>
                </button>
              );
            })}
          </div>

          <section className="intent-agent-inspector" aria-label={copy.selectedAgent}>
            {selectedAgent ? (
              <>
                <AnimalPortrait id={`${selectedAgent.id}-inspector`} side={selectedAgent.side} />
                <div>
                  <span>{copy.selectedAgent}</span>
                  <strong>{selectedAgent.name} · {selectedAgent.role}</strong>
                  <p>{selectedTask ? `${copy.currentTask}: ${selectedTask.title}` : copy.standingBy}</p>
                </div>
                <span className="intent-agent-inspector__status" data-status={selectedAgent.status}>{copy.status[selectedAgent.status] ?? selectedAgent.status}</span>
              </>
            ) : null}
          </section>

          <section className="intent-world-summary" aria-live="polite">
            <div className="intent-progress-ring" style={{ "--progress": `${Math.round(progress * 360)}deg` } as CSSProperties}>
              <span>{Math.round(progress * 100)}%</span>
            </div>
            <div>
              <span>{copy.progress}</span>
              <strong>{world.plan?.title ?? copy.noPlan}</strong>
              <p>{world.plan?.outcome ?? copy.noPlanBody}</p>
            </div>
          </section>

          {pendingApproval ? (
            <section className="intent-approval" role="dialog" aria-modal="true" aria-labelledby="intent-approval-title">
              <div className="intent-approval__icon"><ShieldCheck size={22} /></div>
              <div className="intent-approval__body">
                <span>{copy.approval}</span>
                <h2 id="intent-approval-title">{pendingApproval.title}</h2>
                <p>{copy.approvalDetail}</p>
                <strong>{pendingApproval.consequence}</strong>
                <small>{copy.simulationOnly}</small>
              </div>
              <div className="intent-approval__actions">
                <button type="button" className="intent-button intent-button--quiet" onClick={() => onApproval(pendingApproval.id, false)}><X size={15} />{copy.decline}</button>
                <button type="button" className="intent-button intent-button--primary" onClick={() => onApproval(pendingApproval.id, true)}><Check size={15} />{copy.allow}</button>
              </div>
            </section>
          ) : null}
        </section>

        <aside className="atlas-console intent-command-panel">
          <div className="intent-command-panel__header">
            <div>
              <span><MessageCircle size={14} /> Conversation</span>
              <h1>{copy.commandTitle}</h1>
            </div>
            <span className="intent-command-panel__model"><Bot size={14} />{copy.modelFree}</span>
          </div>

          <div className="intent-conversation" aria-live="polite">
            <div className="intent-message intent-message--assistant">
              <AnimalPortrait id="agent-user-welcome" side="user" />
              <div><span>Mina · Intent steward</span><p>{copy.welcome}</p></div>
            </div>
            {conversation.map((message) => (
              <div key={message.id} className={`intent-message intent-message--${message.role}`}>
                {message.role === "assistant" ? <AnimalPortrait id={`${message.id}-portrait`} side="user" /> : null}
                <div>
                  <span>{message.role === "user" ? "You" : "Mina · Intent steward"}</span>
                  <p>{message.content}</p>
                </div>
              </div>
            ))}
            {plannerState === "planning" ? (
              <div className="intent-message intent-message--assistant intent-message--planning">
                <span className="intent-planning-orb"><LoaderCircle size={18} /></span>
                <div><span>{MODEL}</span><p>{copy.planning}</p></div>
              </div>
            ) : null}
            {questions.length ? (
              <div className="intent-questions">
                <span>{copy.questions}</span>
                {questions.map((question) => <p key={question}>{question}</p>)}
              </div>
            ) : null}
            {plannerState === "fallback" && plannerNote ? (
              <div className="intent-provider-note"><ShieldCheck size={14} /><span>{copy.modelUnavailable}</span></div>
            ) : null}
            <div ref={messagesEndRef} />
          </div>

          <form className="intent-composer" onSubmit={onSubmit}>
            <textarea
              value={input}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onInput(event.target.value.slice(0, 800))}
              onKeyDown={onComposerKeyDown}
              placeholder={copy.placeholder}
              rows={4}
              aria-label={copy.commandTitle}
              disabled={plannerState === "planning"}
            />
            <div className="intent-composer__footer">
              <span>{copy.enterHint}</span>
              <button type="submit" disabled={input.trim().length < 3 || plannerState === "planning"}>
                {plannerState === "planning" ? <LoaderCircle size={16} className="is-spinning" /> : <Send size={16} />}
                {copy.send}
              </button>
            </div>
          </form>
          <p className="intent-disclosure"><ShieldCheck size={13} />{copy.simulationOnly}</p>
        </aside>
      </main>

      <section className="atlas-safe-schedule intent-runtime-panel" aria-label={copy.tasks}>
        <div className="intent-runtime-panel__plan">
          <header>
            <div>
              <span>{copy.tasks}</span>
              <h2>{world.plan?.title ?? copy.noPlan}</h2>
            </div>
            <span className="intent-runtime-panel__percent">{Math.round(progress * 100)}%</span>
          </header>
          <div className="intent-runtime-panel__bar"><span style={{ width: `${Math.round(progress * 100)}%` }} /></div>
          {world.plan ? (
            <div className="intent-task-list">
              {world.tasks.map((task, index) => {
                const agent = INTENT_AGENT_BY_ID[task.agentId];
                return (
                  <button key={task.id} type="button" className="intent-task" data-status={task.status} onClick={() => onSelectAgent(task.agentId)}>
                    <span className="intent-task__index">{task.status === "completed" ? <Check size={13} /> : index + 1}</span>
                    <span className="intent-task__content">
                      <strong>{task.title}</strong>
                      <small>{agent.name} · {task.validation}</small>
                      <span className="intent-task__progress"><i style={{ width: `${Math.round(task.progress * 100)}%` }} /></span>
                    </span>
                    <span className="intent-task__status" data-status={task.status}>{taskStatus(copy, task.status)}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="intent-empty-plan"><Sparkles size={20} /><strong>{copy.noPlan}</strong><p>{copy.noPlanBody}</p></div>
          )}
        </div>

        <div className="intent-runtime-panel__detail">
          <section className="intent-acceptance">
            <span><CheckCircle2 size={14} />{copy.acceptance}</span>
            {world.plan ? (
              <>
                <strong>{copy.outcome}</strong>
                <p>{world.plan.outcome}</p>
                <ul>{world.plan.acceptanceCriteria.map((criterion) => <li key={criterion}>{criterion}</li>)}</ul>
              </>
            ) : <p>{copy.stateSafe}</p>}
          </section>
          <section className="intent-audit">
            <span><Clock3 size={14} />{copy.activity}</span>
            {latestEvents.length ? latestEvents.map((event) => (
              <article key={event.id} data-kind={event.kind}>
                <i />
                <div><strong>{event.title}</strong><p>{event.detail}</p></div>
              </article>
            )) : <p>{copy.stateSafe}</p>}
          </section>
        </div>
      </section>
    </div>
  );
}
