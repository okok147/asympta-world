"use client";

import { useEffect, useRef } from "react";

import {
  allowsVisualEnhancement,
  scheduleIdleTask,
} from "@/lib/living-world/visual-performance";
import {
  WORLD_ZONES,
  type LivingWorldState,
  type Point,
} from "@/lib/living-world/types";

type VgpuWorldFieldProps = {
  world: LivingWorldState;
};

const WORLD_FIELD_SHADER = `
  struct Params {
    time: f32,
    activity: f32,
    aspect: f32,
    focus: vec2f,
    warmth: f32,
  }

  @group(0) @binding(0) var<uniform> params: Params;

  @fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
    var delta = uv - params.focus;
    delta.x *= params.aspect;

    let radius = length(delta);
    let pulse = 0.5 + 0.5 * sin(radius * 38.0 - params.time * 0.78);
    let halo = exp(-radius * radius * 13.0);
    let routeX = pow(max(0.0, cos((uv.x * 0.84 + uv.y) * 24.0 + params.time * 0.06)), 18.0);
    let routeY = pow(max(0.0, cos((uv.y * 0.92 - uv.x) * 19.0 - params.time * 0.05)), 20.0);
    let network = (routeX + routeY) * 0.5;
    let energy = halo * (0.48 + pulse * 0.52) + network * halo * 0.3;
    let idleBreath = halo * (0.028 + pulse * 0.012);
    let alpha = clamp(idleBreath + energy * params.activity * 0.14, 0.0, 0.19);

    let sage = vec3f(0.20, 0.43, 0.35);
    let amber = vec3f(0.76, 0.54, 0.24);
    let tint = mix(sage, amber, clamp(params.warmth * 0.72 + pulse * 0.16, 0.0, 1.0));
    return vec4f(tint * alpha, alpha);
  }
`;

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

function fieldState(world: LivingWorldState) {
  const phaseEnergy: Record<LivingWorldState["phase"], number> = {
    idle: 0,
    understanding: 0.28,
    coordinating: 0.62,
    converging: 0.86,
    reporting: 0.7,
    ready: 0.52,
    waiting_for_human: 0.36,
    completed: 1,
  };
  const focus = focusPoint(world);
  return {
    activity: phaseEnergy[world.phase],
    focus: [focus.x / 100, focus.y / 100] as [number, number],
    warmth: world.phase === "completed" ? 1 : world.phase === "ready" ? 0.72 : 0.18,
  };
}

export function VgpuWorldField({ world }: VgpuWorldFieldProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef(world);

  useEffect(() => {
    worldRef.current = world;
  }, [world]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !allowsVisualEnhancement({
      minWidth: 960,
      minHeight: 500,
      minMemory: 4,
      requireFinePointer: true,
      requireWebGpu: true,
    })) {
      host?.setAttribute("data-renderer-state", "performance-gated");
      return;
    }

    let cancelled = false;
    let disposeGpu: (() => void) | undefined;
    let surfaceCanvas: HTMLCanvasElement | undefined;

    const activate = async () => {
      try {
        const { effect, frameLoop, init, surface } = await import("vgpu");
        if (cancelled || !host.isConnected) return;

        const canvas = document.createElement("canvas");
        surfaceCanvas = canvas;
        canvas.className = "vgpu-world-field__surface";
        canvas.dataset.renderer = "vgpu";
        canvas.setAttribute("aria-hidden", "true");
        host.appendChild(canvas);

        const gpu = await init({ powerPreference: "low-power", label: "Asympta world field" });
        if (cancelled) {
          gpu.dispose();
          canvas.remove();
          return;
        }

        const canvasSurface = surface(gpu, canvas, {
          alphaMode: "premultiplied",
          clearColor: [0, 0, 0, 0],
          dpr: 1,
          label: "Asympta world field surface",
        });
        const initial = fieldState(worldRef.current);
        const worldField = effect(gpu, WORLD_FIELD_SHADER, {
          label: "Asympta coordination field",
          set: {
            params: {
              time: 0,
              activity: initial.activity,
              aspect: 1,
              focus: initial.focus,
              warmth: initial.warmth,
            },
          },
        });

        const updateSize = canvasSurface.onResize(({ width, height }) => {
          worldField.set({
            params: { aspect: Math.max(0.65, Math.min(2.4, width / Math.max(1, height))) },
          });
        });

        let loop: ReturnType<typeof frameLoop> | undefined;
        const start = () => {
          if (loop || document.hidden || cancelled) return;
          loop = frameLoop(
            gpu,
            (currentFrame) => {
              const state = fieldState(worldRef.current);
              worldField.set({
                params: {
                  time: performance.now() / 1_000,
                  activity: state.activity,
                  focus: state.focus,
                  warmth: state.warmth,
                },
              });
              currentFrame.pass(canvasSurface, worldField);
            },
            { fps: 12 },
          );
        };
        const stop = () => {
          loop?.stop();
          loop = undefined;
        };
        const onVisibilityChange = () => {
          if (document.hidden) stop();
          else start();
        };

        document.addEventListener("visibilitychange", onVisibilityChange);
        start();
        host.dataset.rendererState = "active";
        document.documentElement.dataset.vgpuWorld = "active";
        document.dispatchEvent(new CustomEvent("asympta:vgpu-state", { detail: "active" }));

        disposeGpu = () => {
          stop();
          document.removeEventListener("visibilitychange", onVisibilityChange);
          updateSize();
          canvasSurface.dispose();
          gpu.dispose();
          canvas.remove();
          delete document.documentElement.dataset.vgpuWorld;
          document.dispatchEvent(new CustomEvent("asympta:vgpu-state", { detail: "inactive" }));
        };
      } catch (error) {
        surfaceCanvas?.remove();
        host.dataset.rendererState = "unavailable";
        if (process.env.NODE_ENV === "development") {
          console.info("Optional vGPU world field unavailable; using the lightweight fallback.", error);
        }
      }
    };

    const cancelIdle = scheduleIdleTask(() => void activate(), 1_200);

    return () => {
      cancelled = true;
      cancelIdle();
      disposeGpu?.();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className="vgpu-world-field"
      data-visual-engine="vgpu"
      data-renderer-state="waiting"
      aria-hidden="true"
    />
  );
}
