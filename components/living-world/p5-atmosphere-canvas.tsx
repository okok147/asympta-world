"use client";

import { useEffect, useRef } from "react";
import type P5 from "p5";

import {
  allowsVisualEnhancement,
  scheduleIdleTask,
} from "@/lib/living-world/visual-performance";
import {
  WORLD_ZONES,
  type LivingWorldState,
  type Point,
} from "@/lib/living-world/types";

type P5AtmosphereCanvasProps = {
  world: LivingWorldState;
};

function participantPoint(world: LivingWorldState, id: string): Point {
  if (id === "human") return WORLD_ZONES.human.point;
  if (id === "team" || id === "coordinator") return WORLD_ZONES.convergence.point;
  return world.agents.find((agent) => agent.id === id)?.position ?? WORLD_ZONES.convergence.point;
}

export function P5AtmosphereCanvas({ world }: P5AtmosphereCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef(world);
  const sketchRef = useRef<P5 | null>(null);

  useEffect(() => {
    worldRef.current = world;
  }, [world]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !allowsVisualEnhancement({
      minWidth: 720,
      minHeight: 500,
      minMemory: 3,
    })) {
      host?.setAttribute("data-renderer-state", "performance-gated");
      return;
    }

    let cancelled = false;
    let observer: ResizeObserver | undefined;

    const cancelIdle = scheduleIdleTask(() => {
      void import("p5").then(({ default: P5Constructor }) => {
      if (cancelled || !host.isConnected) return;
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      const sketch = new P5Constructor((p: P5) => {
        const resize = () => {
          const width = Math.max(1, host.clientWidth);
          const height = Math.max(1, host.clientHeight);
          p.resizeCanvas(width, height, true);
        };

        p.setup = () => {
          const canvas = p.createCanvas(
            Math.max(1, host.clientWidth),
            Math.max(1, host.clientHeight),
          );
          canvas.addClass("p5-atmosphere-canvas__surface");
          canvas.attribute("data-renderer", "p5.js");
          host.dataset.rendererState = "active";
          p.pixelDensity(Math.min(window.devicePixelRatio || 1, 1.35));
          p.frameRate(reducedMotion ? 1 : 24);
          p.noFill();
          observer = new ResizeObserver(resize);
          observer.observe(host);
        };

        p.draw = () => {
          p.clear();
          const current = worldRef.current;
          const time = reducedMotion ? 0 : p.millis() / 1_000;
          const x = (value: number) => (value / 100) * p.width;
          const y = (value: number) => (value / 100) * p.height;

          // vGPU owns the ambient field on capable desktops. p5 keeps the
          // semantic work: tool pulses, information packets and celebration.
          if (document.documentElement.dataset.vgpuWorld !== "active") {
            p.noStroke();
            for (let index = 0; index < 22; index += 1) {
              const px = ((index * 37 + 11) % 97) / 100 * p.width;
              const py = ((index * 61 + 17) % 93) / 100 * p.height;
              const pulse = 0.5 + 0.5 * Math.sin(time * 0.75 + index * 0.81);
              p.fill(91, 125, 109, 12 + pulse * 17);
              p.circle(px, py, 1.5 + pulse * 2.2);
            }
          }

          current.toolRuns
            .filter((run) => run.status === "running")
            .forEach((run, index) => {
              const task = current.tasks.find((candidate) => candidate.id === run.taskId);
              if (!task) return;
              const point = WORLD_ZONES[task.zone].point;
              p.noFill();
              p.stroke(77, 119, 101, 70);
              p.strokeWeight(1.2);
              const diameter = 17 + ((time * 16 + index * 8) % 20);
              p.circle(x(point.x), y(point.y), diameter);
            });

          current.messages.slice(-5).forEach((message, index) => {
            const from = participantPoint(current, message.fromId);
            const to = participantPoint(current, message.toId);
            const fromX = x(from.x);
            const fromY = y(from.y);
            const toX = x(to.x);
            const toY = y(to.y);
            const direction = index % 2 === 0 ? 1 : -1;
            const bend = Math.min(30, Math.abs(toX - fromX) * 0.12 + 8) * direction;
            p.noFill();
            p.stroke(
              message.type === "approval" ? 174 : 79,
              message.type === "approval" ? 113 : 122,
              message.type === "approval" ? 86 : 106,
              76,
            );
            p.strokeWeight(1.1);
            p.bezier(
              fromX,
              fromY,
              fromX + (toX - fromX) * 0.34,
              fromY + bend,
              fromX + (toX - fromX) * 0.68,
              toY + bend,
              toX,
              toY,
            );
            const progress = reducedMotion ? 0.72 : (time * 0.36 + index * 0.17) % 1;
            const packetX = p.bezierPoint(fromX, fromX + (toX - fromX) * 0.34, fromX + (toX - fromX) * 0.68, toX, progress);
            const packetY = p.bezierPoint(fromY, fromY + bend, toY + bend, toY, progress);
            p.noStroke();
            p.fill(250, 244, 210, 220);
            p.circle(packetX, packetY, 6);
            p.fill(68, 101, 87, 220);
            p.circle(packetX, packetY, 2.6);
          });

          if (current.celebrationUntil && current.celebrationUntil > current.now) {
            const origin = WORLD_ZONES.human.point;
            for (let index = 0; index < 18; index += 1) {
              const angle = (Math.PI * 2 * index) / 18;
              const distance = 12 + ((time * 28 + index * 3) % 28);
              const px = x(origin.x) + Math.cos(angle) * distance;
              const py = y(origin.y) + Math.sin(angle) * distance * 0.72;
              const palette = index % 3;
              p.noStroke();
              p.fill(
                palette === 0 ? 203 : palette === 1 ? 87 : 215,
                palette === 0 ? 126 : palette === 1 ? 132 : 172,
                palette === 0 ? 103 : palette === 1 ? 111 : 87,
                210,
              );
              if (index % 2 === 0) p.circle(px, py, 5);
              else p.rect(px - 2, py - 2, 4, 4, 1);
            }
          }
        };
      }, host);
      sketchRef.current = sketch;
      }).catch(() => {
        host.dataset.rendererState = "unavailable";
      });
    }, 850);

    return () => {
      cancelled = true;
      cancelIdle();
      observer?.disconnect();
      sketchRef.current?.remove();
      sketchRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      sketchRef.current?.redraw();
    }
  }, [world]);

  return (
    <div
      ref={hostRef}
      className="p5-atmosphere-canvas"
      data-visual-engine="p5.js"
      data-renderer-state="waiting"
      aria-hidden="true"
    />
  );
}
