import { applyAction, beginTask, cancelTask, markTaskBlocked } from "./reducer.js";
import { requestAgentPlan } from "./planner.js";
import { validateAction, validatePlan, validateWorldInvariants, verifyTransition } from "./validation.js";

const sleep = (milliseconds, signal) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Task cancelled", "AbortError"));
      },
      { once: true },
    );
  });

function ledgerFor(plan) {
  return plan.steps.map((item, index) => ({
    id: item.id,
    index,
    title: item.title,
    actionType: item.action.type,
    status: "queued",
    validation: null,
    evidence: [],
    event: null,
    startedAt: null,
    completedAt: null,
  }));
}

function updateEntry(ledger, index, patch) {
  return ledger.map((entry, entryIndex) => (entryIndex === index ? { ...entry, ...patch } : entry));
}

function publish(callback, value) {
  if (typeof callback === "function") callback(value);
}

function makeRepairContext({ failedStep, errors, completedSteps, remainingSteps }) {
  return {
    failedStep,
    errors,
    completedSteps: completedSteps.map((item) => ({
      id: item.id,
      title: item.title,
      actionType: item.action.type,
    })),
    remainingSteps,
    instruction:
      "Return a replacement plan for the unfinished portion only. Respect current world state and finish with complete_task.",
  };
}

export async function executeIntent({
  initialWorld,
  intent,
  language = "en",
  signal,
  onWorld,
  onPlan,
  onLedger,
  onStatus,
  onProgress,
  onModel,
  transitionDelay = 620,
}) {
  if (!String(intent).trim()) throw new Error("Intent is required");

  let world = beginTask(initialWorld, intent).state;
  publish(onWorld, world);
  publish(onStatus, "planning");
  publish(onProgress, { completed: 0, total: 0, percent: 0, remainingSeconds: null });

  let planResult = await requestAgentPlan({ intent, world, language, signal });
  let plan = planResult.plan;
  let planValidation = validatePlan(plan);
  if (!planValidation.ok) throw new Error(planValidation.errors.join("; "));

  publish(onModel, {
    source: planResult.source,
    model: planResult.model,
    note: planResult.note,
  });
  publish(onPlan, plan);

  let queue = [...plan.steps];
  let ledger = ledgerFor(plan);
  publish(onLedger, ledger);

  let completedSteps = [];
  let cursor = 0;
  let repairCount = 0;
  let transitions = 0;
  const maxTransitions = 18;

  try {
    while (cursor < queue.length) {
      if (signal?.aborted) throw new DOMException("Task cancelled", "AbortError");
      if (transitions >= maxTransitions) throw new Error("Safety limit reached: too many world transitions");

      const step = queue[cursor];
      ledger = updateEntry(ledger, cursor, {
        status: "validating",
        startedAt: new Date().toISOString(),
      });
      publish(onLedger, ledger);
      publish(onStatus, "validating");

      const validation = validateAction(step.action, world);
      ledger = updateEntry(ledger, cursor, { validation });
      publish(onLedger, ledger);

      if (!validation.ok) {
        ledger = updateEntry(ledger, cursor, {
          status: "rejected",
          completedAt: new Date().toISOString(),
        });
        publish(onLedger, ledger);

        if (repairCount >= 1) {
          throw new Error(`Action rejected after repair: ${validation.errors.join("; ")}`);
        }

        repairCount += 1;
        publish(onStatus, "repairing");
        const repair = makeRepairContext({
          failedStep: step,
          errors: validation.errors,
          completedSteps,
          remainingSteps: queue.slice(cursor + 1),
        });
        planResult = await requestAgentPlan({ intent, world, language, signal, repair });
        const replacement = planResult.plan;
        planValidation = validatePlan(replacement);
        if (!planValidation.ok) throw new Error(`Repair plan invalid: ${planValidation.errors.join("; ")}`);

        const completedLedger = ledger.slice(0, cursor);
        queue = [...completedSteps, ...replacement.steps];
        ledger = [
          ...completedLedger,
          ...replacement.steps.map((item, index) => ({
            id: item.id,
            index: cursor + index,
            title: item.title,
            actionType: item.action.type,
            status: "queued",
            validation: null,
            evidence: [],
            event: null,
            startedAt: null,
            completedAt: null,
            repaired: true,
          })),
        ];
        cursor = completedSteps.length;
        plan = {
          ...replacement,
          objective: intent,
          steps: queue,
          repaired: true,
        };
        publish(onPlan, plan);
        publish(onLedger, ledger);
        publish(onModel, {
          source: planResult.source,
          model: planResult.model,
          note: `Repair attempt ${repairCount}: ${planResult.note || "plan regenerated"}`,
        });
        continue;
      }

      ledger = updateEntry(ledger, cursor, { status: "executing" });
      publish(onLedger, ledger);
      publish(onStatus, "executing");
      await sleep(transitionDelay, signal);

      const before = world;
      const candidate = applyAction(before, step.action);
      const transitionEvidence = verifyTransition(step.action, before, candidate.state, candidate.event);
      const invariantEvidence = validateWorldInvariants(candidate.state);
      const accepted = transitionEvidence.ok && invariantEvidence.ok;

      if (!accepted) {
        ledger = updateEntry(ledger, cursor, {
          status: "failed_validation",
          event: candidate.event,
          evidence: [
            ...transitionEvidence.evidence,
            ...invariantEvidence.errors.map((error) => ({ name: "world_invariant", passed: false, actual: error })),
          ],
          completedAt: new Date().toISOString(),
        });
        publish(onLedger, ledger);
        throw new Error(
          `Candidate state rejected: ${[
            ...transitionEvidence.evidence.filter((item) => !item.passed).map((item) => item.name),
            ...invariantEvidence.errors,
          ].join("; ")}`,
        );
      }

      world = candidate.state;
      transitions += 1;
      completedSteps.push(step);
      ledger = updateEntry(ledger, cursor, {
        status: "verified",
        event: candidate.event,
        evidence: transitionEvidence.evidence,
        completedAt: new Date().toISOString(),
      });
      publish(onWorld, world);
      publish(onLedger, ledger);

      cursor += 1;
      const total = queue.length;
      const percent = Math.round((cursor / total) * 100);
      publish(onProgress, {
        completed: cursor,
        total,
        percent,
        remainingSeconds: Math.max(0, Math.ceil(((total - cursor) * transitionDelay) / 1000)),
      });
    }

    const task = Object.values(world.tasks).find((item) => item.intent === intent && item.status === "running");
    if (task) {
      const synthetic = {
        type: "complete_task",
        params: { summary: plan.summary || "Task completed with validated state transitions." },
      };
      const validation = validateAction(synthetic, world);
      if (!validation.ok) throw new Error(validation.errors.join("; "));
      const candidate = applyAction(world, synthetic);
      const post = verifyTransition(synthetic, world, candidate.state, candidate.event);
      const invariants = validateWorldInvariants(candidate.state);
      if (!post.ok || !invariants.ok) throw new Error("Final task closure failed validation");
      world = candidate.state;
      publish(onWorld, world);
    }

    publish(onStatus, "completed");
    publish(onProgress, { completed: queue.length, total: queue.length, percent: 100, remainingSeconds: 0 });
    return { world, plan, ledger, model: planResult };
  } catch (error) {
    if (error?.name === "AbortError" || signal?.aborted) {
      world = cancelTask(world);
      publish(onWorld, world);
      publish(onStatus, "cancelled");
      return { world, plan, ledger, cancelled: true, model: planResult };
    }
    world = markTaskBlocked(world, error instanceof Error ? error.message : String(error));
    publish(onWorld, world);
    publish(onStatus, "blocked");
    throw error;
  }
}
