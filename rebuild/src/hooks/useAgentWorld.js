import { useCallback, useEffect, useRef, useState } from "react";
import { createInitialWorld } from "../engine/catalog.js";
import { executeIntent } from "../engine/orchestrator.js";

const welcome = {
  id: "welcome",
  role: "assistant",
  text: "Describe what you want. I will form a plan, coordinate agents inside the simulation, validate every action, and show the resulting world state.",
  textZh: "說出你想完成的事。我會建立計畫，在模擬世界內協調代理，驗證每一步動作，並展示最終世界狀態。",
  at: new Date().toISOString(),
};

export function useAgentWorld(language = "en") {
  const [world, setWorld] = useState(() => createInitialWorld());
  const [messages, setMessages] = useState([welcome]);
  const [plan, setPlan] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState({ completed: 0, total: 0, percent: 0, remainingSeconds: null });
  const [model, setModel] = useState({ source: "not-used", model: "—", note: "" });
  const [error, setError] = useState("");
  const worldRef = useRef(world);
  const controllerRef = useRef(null);

  useEffect(() => {
    worldRef.current = world;
  }, [world]);

  const appendMessage = useCallback((message) => {
    setMessages((current) => [
      ...current,
      {
        id: `${message.role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        at: new Date().toISOString(),
        ...message,
      },
    ]);
  }, []);

  const runIntent = useCallback(
    async (rawIntent) => {
      const intent = String(rawIntent).trim();
      if (!intent || ["planning", "validating", "executing", "repairing"].includes(status)) return;

      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setError("");
      setPlan(null);
      setLedger([]);
      setProgress({ completed: 0, total: 0, percent: 0, remainingSeconds: null });
      appendMessage({ role: "user", text: intent, textZh: intent });

      try {
        const result = await executeIntent({
          initialWorld: worldRef.current,
          intent,
          language,
          signal: controller.signal,
          onWorld: (next) => {
            worldRef.current = next;
            setWorld(next);
          },
          onPlan: setPlan,
          onLedger: setLedger,
          onStatus: setStatus,
          onProgress: setProgress,
          onModel: setModel,
        });

        if (result.cancelled) {
          appendMessage({
            role: "assistant",
            text: "The task was cancelled. No unvalidated candidate state was committed.",
            textZh: "任務已取消；任何未通過驗證的候選狀態都沒有寫入世界。",
          });
          return;
        }

        const task = Object.values(result.world.tasks)
          .filter((item) => item.intent === intent)
          .sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)))[0];
        appendMessage({
          role: "assistant",
          text: task?.summary || result.plan?.summary || "Task completed and verified in the simulation.",
          textZh: task?.summary || result.plan?.summary || "任務已在模擬世界內完成並通過驗證。",
          meta: {
            revision: result.world.revision,
            verifiedActions: result.ledger.filter((item) => item.status === "verified").length,
          },
        });
      } catch (caught) {
        if (caught?.name === "AbortError") return;
        const message = caught instanceof Error ? caught.message : String(caught);
        setError(message);
        appendMessage({
          role: "assistant",
          text: `I stopped safely because validation could not prove the next state: ${message}`,
          textZh: `由於驗證無法證明下一個狀態正確，我已安全停止：${message}`,
        });
      } finally {
        if (controllerRef.current === controller) controllerRef.current = null;
      }
    },
    [appendMessage, language, status],
  );

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    const fresh = createInitialWorld();
    worldRef.current = fresh;
    setWorld(fresh);
    setMessages([welcome]);
    setPlan(null);
    setLedger([]);
    setStatus("idle");
    setProgress({ completed: 0, total: 0, percent: 0, remainingSeconds: null });
    setModel({ source: "not-used", model: "—", note: "" });
    setError("");
  }, []);

  return {
    world,
    messages,
    plan,
    ledger,
    status,
    progress,
    model,
    error,
    runIntent,
    cancel,
    reset,
  };
}
