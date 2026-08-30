"use client";

import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useIntentWorldBridge } from "@/components/asympta-intent-world-bridge";
import { IntentWorldView } from "@/components/asympta-intent-world-view";
import {
  API_TIMEOUT_MS,
  COPY,
  TICK_MS,
  combinedIntent,
  fallbackPlannerResponse,
  parsePlannerResponse,
  plannerEndpoint,
  record,
  type ChatMessage,
  type Locale,
  type PlannerState,
} from "@/components/asympta-intent-world-support";
import {
  advanceIntentWorld,
  createIntentWorld,
  intentWorldProgress,
  intentWorldSnapshot,
  resolveIntentApproval,
  startIntentWorld,
} from "@/lib/intent-world/engine";
import type {
  AsymptaAgentId,
  IntentPlannerResponse,
  IntentTaskState,
  IntentWorldSnapshot,
  IntentWorldState,
} from "@/lib/intent-world/types";
import {
  readAsymptaUserPreferences,
  subscribeAsymptaUserPreferences,
  writeAsymptaUserPreferences,
} from "@/lib/asympta-user-preferences";

export function AsymptaIntentWorld() {
  const [world, setWorld] = useState<IntentWorldState>(() => createIntentWorld());
  const worldRef = useRef(world);
  const [locale, setLocale] = useState<Locale>("en");
  const [autoRun, setAutoRun] = useState(true);
  const autoRunRef = useRef(autoRun);
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const conversationRef = useRef(conversation);
  const [input, setInput] = useState("");
  const [plannerState, setPlannerState] = useState<PlannerState>("idle");
  const [plannerNote, setPlannerNote] = useState<string | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<AsymptaAgentId>("agent-user");
  const [languageOpen, setLanguageOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const submitIntentRef = useRef<(body: string) => Promise<IntentWorldSnapshot>>(async () => intentWorldSnapshot(worldRef.current));
  const copy = COPY[locale];

  useEffect(() => {
    worldRef.current = world;
  }, [world]);
  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);
  useEffect(() => {
    autoRunRef.current = autoRun;
  }, [autoRun]);

  useEffect(() => {
    const preferences = readAsymptaUserPreferences();
    setLocale(preferences.locale);
    setAutoRun(preferences.autoExplore);
    document.documentElement.lang = preferences.locale;
    document.documentElement.dataset.asymptaScale = "city";
    const unsubscribe = subscribeAsymptaUserPreferences((next) => {
      setLocale(next.locale);
      setAutoRun(next.autoExplore);
      document.documentElement.lang = next.locale;
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!autoRunRef.current || document.hidden) return;
      const previous = worldRef.current;
      const next = advanceIntentWorld(previous, TICK_MS);
      if (next === previous) return;
      worldRef.current = next;
      setWorld(next);
      const active = next.agents.find((agent) => agent.status === "moving" || agent.status === "working" || agent.status === "waiting");
      if (active) setSelectedAgentId(active.id);
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [conversation, plannerState]);

  const setWorldImmediate = useCallback((next: IntentWorldState) => {
    worldRef.current = next;
    setWorld(next);
    return next;
  }, []);

  const resolveApproval = useCallback((approvalId: string, approved: boolean) => {
    const next = setWorldImmediate(resolveIntentApproval(worldRef.current, approvalId, approved));
    return intentWorldSnapshot(next);
  }, [setWorldImmediate]);

  const submitIntent = useCallback(async (rawBody: string) => {
    const body = rawBody.replace(/\s+/g, " ").trim();
    if (body.length < 3) return intentWorldSnapshot(worldRef.current);

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}-${conversationRef.current.length}`,
      role: "user",
      content: body.slice(0, 800),
    };
    const nextConversation = [...conversationRef.current, userMessage].slice(-16);
    conversationRef.current = nextConversation;
    setConversation(nextConversation);
    const intent = combinedIntent(nextConversation);
    setPlannerState("planning");
    setPlannerNote(null);
    setQuestions([]);

    let plannerResponse: IntentPlannerResponse;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    try {
      const response = await fetch(plannerEndpoint(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent,
          conversation: nextConversation.map(({ role, content }) => ({ role, content })),
        }),
        signal: controller.signal,
      });
      const payload = await response.json() as unknown;
      const parsed = response.ok ? parsePlannerResponse(payload, intent) : null;
      if (!parsed) {
        const errorRecord = record(payload);
        const reason = typeof errorRecord?.error === "string" ? errorRecord.error : `Planner endpoint returned ${response.status}.`;
        plannerResponse = fallbackPlannerResponse(intent, reason);
      } else {
        plannerResponse = parsed;
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Planner request failed.";
      plannerResponse = fallbackPlannerResponse(intent, reason);
    } finally {
      window.clearTimeout(timeout);
    }

    const assistantMessage: ChatMessage = {
      id: `assistant-${Date.now()}-${nextConversation.length}`,
      role: "assistant",
      content: plannerResponse.result.assistantMessage,
    };
    const completedConversation = [...nextConversation, assistantMessage].slice(-16);
    conversationRef.current = completedConversation;
    setConversation(completedConversation);
    setPlannerNote(plannerResponse.provenance.fallbackReason);

    if (!plannerResponse.result.ready) {
      setQuestions(plannerResponse.result.questions);
      setPlannerState(plannerResponse.provenance.provider === "openrouter" ? "ready" : "fallback");
      return intentWorldSnapshot(worldRef.current);
    }

    const nextWorld = startIntentWorld(
      worldRef.current,
      intent,
      plannerResponse.result.plan,
      plannerResponse.provenance,
      worldRef.current.now,
    );
    setWorldImmediate(nextWorld);
    setSelectedAgentId("agent-user");
    setPlannerState(plannerResponse.provenance.provider === "openrouter" ? "ready" : "fallback");
    return intentWorldSnapshot(nextWorld);
  }, [setWorldImmediate]);

  useEffect(() => {
    submitIntentRef.current = submitIntent;
  }, [submitIntent]);

  useIntentWorldBridge({ worldRef, submitIntentRef, resolveApproval, setWorldImmediate });

  const onSubmit = useCallback(async (event: FormEvent) => {
    event.preventDefault();
    const body = input;
    if (body.trim().length < 3 || plannerState === "planning") return;
    setInput("");
    await submitIntent(body);
  }, [input, plannerState, submitIntent]);

  const onComposerKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }, []);

  const resetWorld = useCallback(() => {
    const next = createIntentWorld(worldRef.current.now);
    setWorldImmediate(next);
    conversationRef.current = [];
    setConversation([]);
    setQuestions([]);
    setInput("");
    setPlannerState("idle");
    setPlannerNote(null);
    setSelectedAgentId("agent-user");
  }, [setWorldImmediate]);

  const toggleAutoRun = useCallback(() => {
    const next = !autoRunRef.current;
    autoRunRef.current = next;
    setAutoRun(next);
    writeAsymptaUserPreferences({ autoExplore: next });
  }, []);

  const changeLocale = useCallback((next: Locale) => {
    setLocale(next);
    document.documentElement.lang = next;
    writeAsymptaUserPreferences({ locale: next });
    setLanguageOpen(false);
  }, []);

  const progress = intentWorldProgress(world);
  const pendingApproval = world.approvals.find((approval) => approval.status === "pending") ?? null;
  const selectedAgent = world.agents.find((agent) => agent.id === selectedAgentId) ?? world.agents[0];
  const selectedTask = selectedAgent?.taskId ? world.tasks.find((task) => task.id === selectedAgent.taskId) ?? null : null;
  const activeTaskByAgent = useMemo(() => new Map<AsymptaAgentId, IntentTaskState>(world.tasks
    .filter((task) => ["moving", "working", "awaiting_approval"].includes(task.status))
    .map((task) => [task.agentId, task] as const)), [world.tasks]);
  const latestEvents = world.events.slice(-6).reverse();
  const lastMessageByAgent = useMemo(() => {
    const result = new Map<AsymptaAgentId, string>();
    for (const message of world.messages) {
      result.set(message.fromAgentId, message.text);
      result.set(message.toAgentId, message.text);
    }
    return result;
  }, [world.messages]);

  const providerLabel = world.provenance?.provider === "openrouter"
    ? copy.providerOpenRouter
    : world.provenance?.provider === "deterministic-fallback"
      ? copy.providerFallback
      : copy.modelFree;

  return (
    <IntentWorldView
      world={world}
      copy={copy}
      locale={locale}
      autoRun={autoRun}
      plannerState={plannerState}
      plannerNote={plannerNote}
      questions={questions}
      conversation={conversation}
      input={input}
      selectedAgentId={selectedAgentId}
      providerLabel={providerLabel}
      progress={progress}
      pendingApproval={pendingApproval}
      selectedAgent={selectedAgent}
      selectedTask={selectedTask}
      activeTaskByAgent={activeTaskByAgent}
      lastMessageByAgent={lastMessageByAgent}
      latestEvents={latestEvents}
      messagesEndRef={messagesEndRef}
      onToggleAutoRun={toggleAutoRun}
      onReset={resetWorld}
      onToggleLanguage={() => setLanguageOpen((open) => !open)}
      onLocaleChange={changeLocale}
      onSelectAgent={setSelectedAgentId}
      onApproval={resolveApproval}
      onSubmit={onSubmit}
      onComposerKeyDown={onComposerKeyDown}
      onInput={setInput}
      languageOpen={languageOpen}
    />
  );
}
