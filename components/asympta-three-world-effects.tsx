"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Material, Mesh, Object3D, Texture } from "three";

import {
  subscribeAsymptaCompletionReceipts,
} from "@/lib/asympta-completion-receipt";
import {
  subscribeAsymptaWorkflowStarts,
  type AsymptaWorkflowStartSignal,
} from "@/lib/asympta-workflow-lifecycle";
import {
  allowsVisualEnhancement,
  scheduleIdleTask,
} from "@/lib/living-world/visual-performance";

type Locale = "en" | "zh-Hant" | "ja";

const START_CARD_MS = 1_650;
const START_EFFECT_MS = 1_450;
const COMPLETION_EFFECT_MS = 5_600;
const FRAME_INTERVAL_MS = 1_000 / 30;

const COPY: Record<Locale, { eyebrow: string; moving: string }> = {
  en: { eyebrow: "Workflow started", moving: "Agents are moving" },
  "zh-Hant": { eyebrow: "工作流已開始", moving: "代理正在行動" },
  ja: { eyebrow: "ワークフロー開始", moving: "エージェントが動いています" },
};

function localeFromDocument(): Locale {
  const value = document.documentElement.lang.toLowerCase();
  if (value.startsWith("zh")) return "zh-Hant";
  if (value.startsWith("ja")) return "ja";
  return "en";
}

function seeded(index: number, salt: number) {
  const value = Math.sin(index * 92.731 + salt * 17.113) * 43_758.5453;
  return value - Math.floor(value);
}

function disposeMaterial(material: Material) {
  const candidate = material as Material & {
    map?: Texture | null;
    alphaMap?: Texture | null;
  };
  candidate.map?.dispose();
  if (candidate.alphaMap && candidate.alphaMap !== candidate.map) candidate.alphaMap.dispose();
  material.dispose();
}

function disposeObject(root: Object3D) {
  root.traverse((object) => {
    const mesh = object as Mesh;
    mesh.geometry?.dispose();
    if (Array.isArray(mesh.material)) mesh.material.forEach(disposeMaterial);
    else if (mesh.material) disposeMaterial(mesh.material);
  });
}

export function AsymptaThreeWorldEffects() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [startCard, setStartCard] = useState<AsymptaWorkflowStartSignal | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const startTimerRef = useRef(0);
  const startPulseAtRef = useRef(Number.NEGATIVE_INFINITY);
  const completionPulseAtRef = useRef(Number.NEGATIVE_INFINITY);

  useEffect(() => {
    const syncHost = () => {
      const next = document.querySelector<HTMLElement>(".map-app");
      setHost((current) => current === next ? current : next);
    };
    syncHost();
    const observer = new MutationObserver(syncHost);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const unsubscribeStart = subscribeAsymptaWorkflowStarts((signal) => {
      // Starting a new run supersedes every visual from the previous finish.
      // Only the compact start card and green pulse may remain on screen.
      completionPulseAtRef.current = Number.NEGATIVE_INFINITY;
      startPulseAtRef.current = performance.now();
      setStartCard(signal);
      window.clearTimeout(startTimerRef.current);
      startTimerRef.current = window.setTimeout(() => setStartCard((current) => (
        current?.id === signal.id ? null : current
      )), START_CARD_MS);
    });
    const unsubscribeCompletion = subscribeAsymptaCompletionReceipts(() => {
      // Completion is the inverse phase: remove a still-running start cue so
      // the verified finish celebration is the sole celebration on screen.
      startPulseAtRef.current = Number.NEGATIVE_INFINITY;
      window.clearTimeout(startTimerRef.current);
      setStartCard(null);
      completionPulseAtRef.current = performance.now();
    });
    return () => {
      window.clearTimeout(startTimerRef.current);
      unsubscribeStart();
      unsubscribeCompletion();
    };
  }, []);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    if (!allowsVisualEnhancement({ minWidth: 360, minHeight: 420, minMemory: 3 })) {
      overlay.dataset.rendererState = "performance-gated";
      return;
    }

    let cancelled = false;
    let stop = () => undefined;
    const cancelIdle = scheduleIdleTask(() => {
      void import("three").then((THREE) => {
        if (cancelled || !overlay.isConnected) return;

        const renderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: false,
          powerPreference: "low-power",
          premultipliedAlpha: true,
        });
        renderer.setClearColor(0xffffff, 0);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.domElement.className = "asympta-three-world-effects__surface";
        renderer.domElement.dataset.renderer = "three.js";
        renderer.domElement.setAttribute("aria-hidden", "true");
        overlay.prepend(renderer.domElement);
        overlay.dataset.rendererState = "active";

        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
        camera.position.z = 5;

        const radialCanvas = document.createElement("canvas");
        radialCanvas.width = 128;
        radialCanvas.height = 128;
        const radialContext = radialCanvas.getContext("2d");
        if (radialContext) {
          const gradient = radialContext.createRadialGradient(64, 64, 0, 64, 64, 64);
          gradient.addColorStop(0, "rgba(255,244,193,.9)");
          gradient.addColorStop(0.42, "rgba(255,226,151,.35)");
          gradient.addColorStop(1, "rgba(255,226,151,0)");
          radialContext.fillStyle = gradient;
          radialContext.fillRect(0, 0, 128, 128);
        }
        const radialTexture = new THREE.CanvasTexture(radialCanvas);
        radialTexture.colorSpace = THREE.SRGBColorSpace;

        const leafCanvas = document.createElement("canvas");
        leafCanvas.width = 48;
        leafCanvas.height = 48;
        const leafContext = leafCanvas.getContext("2d");
        if (leafContext) {
          leafContext.translate(24, 24);
          leafContext.rotate(-0.55);
          leafContext.fillStyle = "rgba(75,105,83,.72)";
          leafContext.beginPath();
          leafContext.ellipse(0, 0, 6.5, 15, 0, 0, Math.PI * 2);
          leafContext.fill();
          leafContext.strokeStyle = "rgba(49,78,60,.56)";
          leafContext.lineWidth = 1.3;
          leafContext.beginPath();
          leafContext.moveTo(0, -12);
          leafContext.lineTo(0, 12);
          leafContext.stroke();
        }
        const leafTexture = new THREE.CanvasTexture(leafCanvas);
        leafTexture.colorSpace = THREE.SRGBColorSpace;

        const sun = new THREE.Sprite(new THREE.SpriteMaterial({
          map: radialTexture,
          transparent: true,
          opacity: 0.2,
          depthTest: false,
          depthWrite: false,
        }));
        sun.scale.set(1.9, 1.9, 1);
        scene.add(sun);

        const leafCount = overlay.clientWidth < 700 ? 18 : 30;
        const leafPositions = new Float32Array(leafCount * 3);
        const leafSpeeds = new Float32Array(leafCount);
        const leafDrift = new Float32Array(leafCount);
        for (let index = 0; index < leafCount; index += 1) {
          leafPositions[index * 3] = seeded(index, 1) * 2 - 1;
          leafPositions[index * 3 + 1] = seeded(index, 2) * 2 - 1;
          leafPositions[index * 3 + 2] = 0.1;
          leafSpeeds[index] = 0.025 + seeded(index, 3) * 0.045;
          leafDrift[index] = seeded(index, 4) * Math.PI * 2;
        }
        const leafGeometry = new THREE.BufferGeometry();
        const leafPositionAttribute = new THREE.BufferAttribute(leafPositions, 3);
        leafGeometry.setAttribute("position", leafPositionAttribute);
        const leaves = new THREE.Points(leafGeometry, new THREE.PointsMaterial({
          map: leafTexture,
          size: overlay.clientWidth < 700 ? 0.055 : 0.065,
          transparent: true,
          opacity: 0.16,
          alphaTest: 0.02,
          depthTest: false,
          depthWrite: false,
          color: 0x587361,
          sizeAttenuation: false,
        }));
        scene.add(leaves);

        const windCount = overlay.clientWidth < 700 ? 5 : 9;
        const windPositions = new Float32Array(windCount * 6);
        const windSeeds = Array.from({ length: windCount }, (_, index) => ({
          x: seeded(index, 5) * 2 - 1,
          y: seeded(index, 6) * 1.6 - 0.8,
          speed: 0.055 + seeded(index, 7) * 0.05,
          length: 0.12 + seeded(index, 8) * 0.18,
        }));
        const windGeometry = new THREE.BufferGeometry();
        const windAttribute = new THREE.BufferAttribute(windPositions, 3);
        windGeometry.setAttribute("position", windAttribute);
        const winds = new THREE.LineSegments(windGeometry, new THREE.LineBasicMaterial({
          color: 0x7896a8,
          transparent: true,
          opacity: 0.12,
          depthTest: false,
          depthWrite: false,
        }));
        scene.add(winds);

        const startRingMaterial = new THREE.MeshBasicMaterial({
          color: 0x6e9d84,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthTest: false,
          depthWrite: false,
        });
        const startRing = new THREE.Mesh(new THREE.RingGeometry(0.17, 0.19, 56), startRingMaterial);
        startRing.visible = false;
        scene.add(startRing);

        const completionRingMaterial = new THREE.MeshBasicMaterial({
          color: 0xd2ab58,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthTest: false,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        const completionRing = new THREE.Mesh(new THREE.RingGeometry(0.24, 0.28, 64), completionRingMaterial);
        completionRing.visible = false;
        scene.add(completionRing);

        const completionGlowMaterial = new THREE.SpriteMaterial({
          map: radialTexture.clone(),
          color: 0xffe8a6,
          transparent: true,
          opacity: 0,
          depthTest: false,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        const completionGlow = new THREE.Sprite(completionGlowMaterial);
        completionGlow.visible = false;
        scene.add(completionGlow);

        const makeBurst = (count: number, color: number) => {
          const positions = new Float32Array(count * 3);
          const directions = Array.from({ length: count }, (_, index) => {
            const angle = (index / count) * Math.PI * 2 + seeded(index, 9) * 0.18;
            return {
              x: Math.cos(angle),
              y: Math.sin(angle),
              distance: 0.45 + seeded(index, 10) * 0.7,
            };
          });
          const geometry = new THREE.BufferGeometry();
          const attribute = new THREE.BufferAttribute(positions, 3);
          geometry.setAttribute("position", attribute);
          const material = new THREE.PointsMaterial({
            map: leafTexture.clone(),
            color,
            size: 0.055,
            transparent: true,
            opacity: 0,
            alphaTest: 0.02,
            depthTest: false,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: false,
          });
          const points = new THREE.Points(geometry, material);
          points.visible = false;
          scene.add(points);
          return { positions, directions, attribute, material, points };
        };

        const startBurst = makeBurst(22, 0x83b69b);
        const completionBurst = makeBurst(44, 0xf1c86f);
        let aspect = 1;
        let frame = 0;
        let lastFrameAt = 0;
        let lastAnimationAt = performance.now();

        const resize = () => {
          const width = Math.max(1, overlay.clientWidth);
          const height = Math.max(1, overlay.clientHeight);
          aspect = width / height;
          camera.left = -aspect;
          camera.right = aspect;
          camera.top = 1;
          camera.bottom = -1;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height, false);
          sun.position.set(-aspect * 0.72, 0.62, 0);
          renderer.render(scene, camera);
        };
        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(overlay);
        resize();

        const animateBurst = (
          burst: typeof startBurst,
          progress: number,
          opacity: number,
          distanceScale: number,
        ) => {
          for (let index = 0; index < burst.directions.length; index += 1) {
            const direction = burst.directions[index];
            const distance = direction.distance * progress * distanceScale;
            burst.positions[index * 3] = direction.x * distance;
            burst.positions[index * 3 + 1] = direction.y * distance;
            burst.positions[index * 3 + 2] = 0.3;
          }
          burst.attribute.needsUpdate = true;
          burst.material.opacity = opacity;
          burst.points.visible = opacity > 0.01;
        };

        const render = (now: number) => {
          if (cancelled) return;
          frame = window.requestAnimationFrame(render);
          if (document.hidden || now - lastFrameAt < FRAME_INTERVAL_MS) return;
          const deltaSeconds = Math.min(0.08, Math.max(0.001, (now - lastAnimationAt) / 1_000));
          lastAnimationAt = now;
          lastFrameAt = now;

          const sunWave = Math.sin(now * 0.00018);
          sun.position.y = 0.61 + sunWave * 0.025;
          (sun.material as InstanceType<typeof THREE.SpriteMaterial>).opacity = 0.18 + sunWave * 0.025;

          for (let index = 0; index < leafCount; index += 1) {
            const offset = index * 3;
            leafPositions[offset] += leafSpeeds[index] * deltaSeconds;
            leafPositions[offset + 1] += Math.sin(now * 0.00035 + leafDrift[index]) * 0.0007;
            if (leafPositions[offset] > aspect + 0.18) {
              leafPositions[offset] = -aspect - 0.18;
              leafPositions[offset + 1] = seeded(index + Math.floor(now / 5_000), 11) * 2 - 1;
            }
          }
          leafPositionAttribute.needsUpdate = true;
          leaves.rotation.z = Math.sin(now * 0.00011) * 0.018;

          windSeeds.forEach((wind, index) => {
            const cycle = ((wind.x + now * 0.00004 * wind.speed * 20 + aspect + 0.4) % (aspect * 2 + 0.8)) - aspect - 0.4;
            const offset = index * 6;
            windPositions[offset] = cycle;
            windPositions[offset + 1] = wind.y + Math.sin(now * 0.0005 + index) * 0.018;
            windPositions[offset + 2] = 0.2;
            windPositions[offset + 3] = cycle + wind.length;
            windPositions[offset + 4] = windPositions[offset + 1] + 0.018;
            windPositions[offset + 5] = 0.2;
          });
          windAttribute.needsUpdate = true;

          const startElapsed = now - startPulseAtRef.current;
          if (startElapsed >= 0 && startElapsed < START_EFFECT_MS) {
            const progress = Math.min(1, startElapsed / START_EFFECT_MS);
            const ease = 1 - Math.pow(1 - progress, 3);
            startRing.visible = true;
            startRing.scale.setScalar(0.65 + ease * 3.2);
            startRingMaterial.opacity = Math.sin(progress * Math.PI) * 0.46;
            animateBurst(startBurst, ease, Math.sin(progress * Math.PI) * 0.48, 0.9);
          } else {
            startRing.visible = false;
            startBurst.points.visible = false;
          }

          const completionElapsed = now - completionPulseAtRef.current;
          if (completionElapsed >= 0 && completionElapsed < COMPLETION_EFFECT_MS) {
            const progress = Math.min(1, completionElapsed / COMPLETION_EFFECT_MS);
            const opening = Math.min(1, progress / 0.22);
            completionRing.visible = true;
            completionRing.scale.setScalar(0.8 + opening * (2.8 + aspect));
            completionRingMaterial.opacity = Math.sin(Math.min(1, progress * 1.45) * Math.PI) * 0.34;
            completionGlow.visible = true;
            completionGlow.scale.set(1.3 + opening * (1.5 + aspect), 1.3 + opening * 1.8, 1);
            completionGlowMaterial.opacity = Math.sin(Math.min(1, progress * 1.2) * Math.PI) * 0.22;
            animateBurst(
              completionBurst,
              Math.min(1, progress * 1.8),
              Math.sin(Math.min(1, progress * 1.3) * Math.PI) * 0.52,
              1.35 + aspect * 0.3,
            );
          } else {
            completionRing.visible = false;
            completionGlow.visible = false;
            completionBurst.points.visible = false;
          }

          renderer.render(scene, camera);
        };
        frame = window.requestAnimationFrame(render);

        const onContextLost = (event: Event) => {
          event.preventDefault();
          overlay.dataset.rendererState = "context-lost";
          window.cancelAnimationFrame(frame);
        };
        renderer.domElement.addEventListener("webglcontextlost", onContextLost, false);

        stop = () => {
          window.cancelAnimationFrame(frame);
          resizeObserver.disconnect();
          renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
          disposeObject(scene);
          renderer.dispose();
          renderer.forceContextLoss();
          renderer.domElement.remove();
          overlay.dataset.rendererState = "stopped";
        };
      }).catch(() => {
        if (!cancelled) overlay.dataset.rendererState = "unavailable";
      });
    }, 900);

    return () => {
      cancelled = true;
      cancelIdle();
      stop();
    };
  }, [host]);

  if (!host) return null;
  const copy = COPY[localeFromDocument()];

  return createPortal(
    <div ref={overlayRef} className="asympta-three-world-effects" data-renderer-state="waiting">
      {startCard ? (
        <section
          key={startCard.id}
          className="asympta-workflow-start-celebration"
          data-workflow-id={startCard.workflowId}
          data-start-id={startCard.id}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="asympta-workflow-start-celebration__mark" aria-hidden="true"><i /><i /><i /></span>
          <span>
            <small>{copy.eyebrow}</small>
            <strong>{startCard.title}</strong>
            <em>{copy.moving}</em>
          </span>
        </section>
      ) : null}
    </div>,
    host,
  );
}
