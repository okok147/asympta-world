"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Material, Mesh, Object3D } from "three";

import { subscribeAsymptaCompletionReceipts } from "@/lib/asympta-completion-receipt";
import {
  subscribeAsymptaWorkflowStarts,
  type AsymptaWorkflowStartSignal,
} from "@/lib/asympta-workflow-lifecycle";
import {
  allowsVisualEnhancement,
  scheduleIdleTask,
} from "@/lib/living-world/visual-performance";

type Locale = "en" | "zh-Hant" | "ja";

type ProjectedAgent = {
  id: string;
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  working: boolean;
  moving: boolean;
  selected: boolean;
};

type InteractionPulse = {
  x: number;
  y: number;
  startedAt: number;
};

const START_CARD_MS = 1_650;
const START_EFFECT_MS = 1_650;
const COMPLETION_EFFECT_MS = 5_600;
const INTERACTION_EFFECT_MS = 760;
const FRAME_INTERVAL_MS = 1_000 / 30;
const AGENT_PROJECTION_INTERVAL_MS = 160;
const MAX_PROJECTED_AGENTS = 8;
const TRAIL_POINTS_PER_AGENT = 3;

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

function disposeObject(root: Object3D) {
  root.traverse((object) => {
    const mesh = object as Mesh;
    mesh.geometry?.dispose();
    if (Array.isArray(mesh.material)) mesh.material.forEach((material: Material) => material.dispose());
    else mesh.material?.dispose();
  });
}

function shouldIgnoreMapPulse(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(
    "button, input, textarea, select, a, [role='button'], .atlas-console, .atlas-safe-schedule, .asympta-intent-shell, .asympta-screen-celebration",
  ));
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
      startPulseAtRef.current = performance.now();
      setStartCard(signal);
      window.clearTimeout(startTimerRef.current);
      startTimerRef.current = window.setTimeout(() => setStartCard((current) => (
        current?.id === signal.id ? null : current
      )), START_CARD_MS);
    });
    const unsubscribeCompletion = subscribeAsymptaCompletionReceipts(() => {
      completionPulseAtRef.current = performance.now();
    });
    return () => {
      window.clearTimeout(startTimerRef.current);
      unsubscribeStart();
      unsubscribeCompletion();
    };
  }, []);

  useEffect(() => {
    const onCelebrationState = () => {
      if (document.body.dataset.asymptaCelebrating === "true") {
        completionPulseAtRef.current = performance.now();
      }
    };
    if (document.body.dataset.asymptaCelebrating === "true") onCelebrationState();
    const observer = new MutationObserver(onCelebrationState);
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-asympta-celebrating"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!host || !overlay) return;
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
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.domElement.className = "asympta-three-world-effects__surface";
        renderer.domElement.dataset.renderer = "three.js";
        renderer.domElement.setAttribute("aria-hidden", "true");
        overlay.prepend(renderer.domElement);
        overlay.dataset.rendererState = "active";
        document.documentElement.dataset.asymptaVisualEngine = "three";

        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
        camera.position.z = 5;

        const radialCanvas = document.createElement("canvas");
        radialCanvas.width = 128;
        radialCanvas.height = 128;
        const radialContext = radialCanvas.getContext("2d");
        if (radialContext) {
          const gradient = radialContext.createRadialGradient(64, 64, 0, 64, 64, 64);
          gradient.addColorStop(0, "rgba(255,248,216,.96)");
          gradient.addColorStop(0.28, "rgba(255,229,156,.48)");
          gradient.addColorStop(0.68, "rgba(255,222,145,.12)");
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
          leafContext.fillStyle = "rgba(75,105,83,.74)";
          leafContext.beginPath();
          leafContext.ellipse(0, 0, 6.5, 15, 0, 0, Math.PI * 2);
          leafContext.fill();
          leafContext.strokeStyle = "rgba(49,78,60,.5)";
          leafContext.lineWidth = 1.2;
          leafContext.beginPath();
          leafContext.moveTo(0, -12);
          leafContext.lineTo(0, 12);
          leafContext.stroke();
        }
        const leafTexture = new THREE.CanvasTexture(leafCanvas);
        leafTexture.colorSpace = THREE.SRGBColorSpace;

        const starCanvas = document.createElement("canvas");
        starCanvas.width = 64;
        starCanvas.height = 64;
        const starContext = starCanvas.getContext("2d");
        if (starContext) {
          starContext.translate(32, 32);
          starContext.fillStyle = "rgba(255,248,214,.96)";
          starContext.beginPath();
          for (let index = 0; index < 8; index += 1) {
            const radius = index % 2 === 0 ? 25 : 7;
            const angle = -Math.PI / 2 + (index * Math.PI) / 4;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            if (index === 0) starContext.moveTo(x, y);
            else starContext.lineTo(x, y);
          }
          starContext.closePath();
          starContext.fill();
        }
        const starTexture = new THREE.CanvasTexture(starCanvas);
        starTexture.colorSpace = THREE.SRGBColorSpace;

        const sunMaterial = new THREE.SpriteMaterial({
          map: radialTexture,
          transparent: true,
          opacity: 0.18,
          depthTest: false,
          depthWrite: false,
        });
        const sun = new THREE.Sprite(sunMaterial);
        sun.scale.set(1.9, 1.9, 1);
        scene.add(sun);

        const leafCount = overlay.clientWidth < 700 ? 16 : 28;
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
        const leafMaterial = new THREE.PointsMaterial({
          map: leafTexture,
          size: overlay.clientWidth < 700 ? 0.052 : 0.062,
          transparent: true,
          opacity: 0.13,
          alphaTest: 0.02,
          depthTest: false,
          depthWrite: false,
          color: 0x587361,
          sizeAttenuation: false,
        });
        const leaves = new THREE.Points(leafGeometry, leafMaterial);
        scene.add(leaves);

        const moteCount = overlay.clientWidth < 700 ? 14 : 24;
        const motePositions = new Float32Array(moteCount * 3);
        for (let index = 0; index < moteCount; index += 1) {
          motePositions[index * 3] = seeded(index, 12) * 2 - 1;
          motePositions[index * 3 + 1] = seeded(index, 13) * 2 - 1;
          motePositions[index * 3 + 2] = 0.16;
        }
        const moteGeometry = new THREE.BufferGeometry();
        const moteAttribute = new THREE.BufferAttribute(motePositions, 3);
        moteGeometry.setAttribute("position", moteAttribute);
        const moteMaterial = new THREE.PointsMaterial({
          map: radialTexture,
          size: 0.03,
          transparent: true,
          opacity: 0.11,
          depthTest: false,
          depthWrite: false,
          color: 0xf3d895,
          sizeAttenuation: false,
        });
        const motes = new THREE.Points(moteGeometry, moteMaterial);
        scene.add(motes);

        const windCount = overlay.clientWidth < 700 ? 4 : 8;
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
        const windMaterial = new THREE.LineBasicMaterial({
          color: 0x7896a8,
          transparent: true,
          opacity: 0.085,
          depthTest: false,
          depthWrite: false,
        });
        const winds = new THREE.LineSegments(windGeometry, windMaterial);
        scene.add(winds);

        const haloPositions = new Float32Array(MAX_PROJECTED_AGENTS * 3);
        const haloGeometry = new THREE.BufferGeometry();
        const haloAttribute = new THREE.BufferAttribute(haloPositions, 3);
        haloGeometry.setAttribute("position", haloAttribute);
        const haloMaterial = new THREE.PointsMaterial({
          map: radialTexture,
          color: 0x73a88e,
          size: overlay.clientWidth < 700 ? 0.095 : 0.115,
          transparent: true,
          opacity: 0.25,
          depthTest: false,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          sizeAttenuation: false,
        });
        const agentHalos = new THREE.Points(haloGeometry, haloMaterial);
        scene.add(agentHalos);

        const trailPositions = new Float32Array(MAX_PROJECTED_AGENTS * TRAIL_POINTS_PER_AGENT * 3);
        const trailGeometry = new THREE.BufferGeometry();
        const trailAttribute = new THREE.BufferAttribute(trailPositions, 3);
        trailGeometry.setAttribute("position", trailAttribute);
        const trailMaterial = new THREE.PointsMaterial({
          map: radialTexture,
          color: 0x6e9f8c,
          size: 0.046,
          transparent: true,
          opacity: 0.14,
          depthTest: false,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          sizeAttenuation: false,
        });
        const agentTrails = new THREE.Points(trailGeometry, trailMaterial);
        scene.add(agentTrails);

        const connectionPositions = new Float32Array((MAX_PROJECTED_AGENTS - 1) * 6);
        const connectionGeometry = new THREE.BufferGeometry();
        const connectionAttribute = new THREE.BufferAttribute(connectionPositions, 3);
        connectionGeometry.setAttribute("position", connectionAttribute);
        const connectionMaterial = new THREE.LineBasicMaterial({
          color: 0x719c89,
          transparent: true,
          opacity: 0.12,
          depthTest: false,
          depthWrite: false,
        });
        const agentConnections = new THREE.LineSegments(connectionGeometry, connectionMaterial);
        scene.add(agentConnections);

        const selectedRingMaterial = new THREE.MeshBasicMaterial({
          color: 0x6f9f88,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthTest: false,
          depthWrite: false,
        });
        const selectedRing = new THREE.Mesh(new THREE.RingGeometry(0.075, 0.085, 48), selectedRingMaterial);
        selectedRing.visible = false;
        scene.add(selectedRing);

        const startRingMaterial = new THREE.MeshBasicMaterial({
          color: 0x6e9d84,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthTest: false,
          depthWrite: false,
        });
        const startRing = new THREE.Mesh(new THREE.RingGeometry(0.11, 0.122, 56), startRingMaterial);
        startRing.visible = false;
        scene.add(startRing);

        const startRingOuterMaterial = startRingMaterial.clone();
        const startRingOuter = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.157, 56), startRingOuterMaterial);
        startRingOuter.visible = false;
        scene.add(startRingOuter);

        const completionRingMaterial = new THREE.MeshBasicMaterial({
          color: 0xd2ab58,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthTest: false,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        const completionRing = new THREE.Mesh(new THREE.RingGeometry(0.24, 0.27, 72), completionRingMaterial);
        completionRing.visible = false;
        scene.add(completionRing);

        const completionRingOuterMaterial = completionRingMaterial.clone();
        const completionRingOuter = new THREE.Mesh(new THREE.RingGeometry(0.33, 0.344, 80), completionRingOuterMaterial);
        completionRingOuter.visible = false;
        scene.add(completionRingOuter);

        const completionGlowMaterial = new THREE.SpriteMaterial({
          map: radialTexture,
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

        const interactionMaterialA = new THREE.MeshBasicMaterial({
          color: 0x668f7e,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthTest: false,
          depthWrite: false,
        });
        const interactionMaterialB = interactionMaterialA.clone();
        const interactionRingA = new THREE.Mesh(new THREE.RingGeometry(0.035, 0.042, 40), interactionMaterialA);
        const interactionRingB = new THREE.Mesh(new THREE.RingGeometry(0.035, 0.04, 40), interactionMaterialB);
        interactionRingA.visible = false;
        interactionRingB.visible = false;
        scene.add(interactionRingA, interactionRingB);

        const makeBurst = (count: number, color: number, texture: typeof radialTexture) => {
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
            map: texture,
            color,
            size: 0.052,
            transparent: true,
            opacity: 0,
            alphaTest: 0.01,
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

        const startBurst = makeBurst(24, 0x83b69b, radialTexture);
        const completionBurst = makeBurst(58, 0xf1c86f, starTexture);

        let aspect = 1;
        let frame = 0;
        let lastFrameAt = 0;
        let lastAnimationAt = performance.now();
        let lastAgentProjectionAt = Number.NEGATIVE_INFINITY;
        let projectedAgents: ProjectedAgent[] = [];
        let interactionPulse: InteractionPulse | null = null;
        const agentHistory = new Map<string, { x: number; y: number }>();

        const scenePoint = (clientX: number, clientY: number) => {
          const rect = overlay.getBoundingClientRect();
          const width = Math.max(1, rect.width);
          const height = Math.max(1, rect.height);
          return {
            x: (((clientX - rect.left) / width) * 2 - 1) * aspect,
            y: 1 - ((clientY - rect.top) / height) * 2,
          };
        };

        const projectAgents = (now: number) => {
          if (now - lastAgentProjectionAt < AGENT_PROJECTION_INTERVAL_MS) return;
          lastAgentProjectionAt = now;
          const overlayRect = overlay.getBoundingClientRect();
          const nodes = Array.from(document.querySelectorAll<HTMLElement>(".animal-map-marker--foreground"));
          const next: ProjectedAgent[] = [];
          for (const node of nodes) {
            if (next.length >= MAX_PROJECTED_AGENTS) break;
            const rect = node.getBoundingClientRect();
            if (!rect.width || !rect.height || rect.right < overlayRect.left || rect.left > overlayRect.right || rect.bottom < overlayRect.top || rect.top > overlayRect.bottom) continue;
            const point = scenePoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
            const id = node.dataset.agentId || `visual-agent-${next.length}`;
            const previous = agentHistory.get(id) ?? point;
            next.push({
              id,
              x: point.x,
              y: point.y,
              previousX: previous.x,
              previousY: previous.y,
              working: node.classList.contains("is-working"),
              moving: node.classList.contains("is-moving"),
              selected: node.classList.contains("is-selected"),
            });
            agentHistory.set(id, point);
          }
          projectedAgents = next;
        };

        const updateAgentEffects = (now: number) => {
          projectAgents(now);
          for (let index = 0; index < MAX_PROJECTED_AGENTS; index += 1) {
            const agent = projectedAgents[index];
            const offset = index * 3;
            if (!agent) {
              haloPositions[offset] = 99;
              haloPositions[offset + 1] = 99;
              haloPositions[offset + 2] = 0.3;
              for (let trailIndex = 0; trailIndex < TRAIL_POINTS_PER_AGENT; trailIndex += 1) {
                const trailOffset = (index * TRAIL_POINTS_PER_AGENT + trailIndex) * 3;
                trailPositions[trailOffset] = 99;
                trailPositions[trailOffset + 1] = 99;
                trailPositions[trailOffset + 2] = 0.28;
              }
              continue;
            }
            haloPositions[offset] = agent.x;
            haloPositions[offset + 1] = agent.y;
            haloPositions[offset + 2] = 0.28;
            const dx = agent.x - agent.previousX;
            const dy = agent.y - agent.previousY;
            for (let trailIndex = 0; trailIndex < TRAIL_POINTS_PER_AGENT; trailIndex += 1) {
              const trailOffset = (index * TRAIL_POINTS_PER_AGENT + trailIndex) * 3;
              const fraction = (trailIndex + 1) / (TRAIL_POINTS_PER_AGENT + 1);
              trailPositions[trailOffset] = agent.moving ? agent.x - dx * fraction * 1.65 : 99;
              trailPositions[trailOffset + 1] = agent.moving ? agent.y - dy * fraction * 1.65 : 99;
              trailPositions[trailOffset + 2] = 0.27;
            }
          }
          haloAttribute.needsUpdate = true;
          trailAttribute.needsUpdate = true;
          const active = projectedAgents.filter((agent) => agent.working || agent.selected);
          const anchor = active.find((agent) => agent.selected) ?? active[0] ?? projectedAgents.find((agent) => agent.selected);
          let connectionIndex = 0;
          for (const agent of active) {
            if (!anchor || agent.id === anchor.id || connectionIndex >= MAX_PROJECTED_AGENTS - 1) continue;
            const offset = connectionIndex * 6;
            connectionPositions[offset] = anchor.x;
            connectionPositions[offset + 1] = anchor.y;
            connectionPositions[offset + 2] = 0.22;
            connectionPositions[offset + 3] = agent.x;
            connectionPositions[offset + 4] = agent.y;
            connectionPositions[offset + 5] = 0.22;
            connectionIndex += 1;
          }
          for (; connectionIndex < MAX_PROJECTED_AGENTS - 1; connectionIndex += 1) {
            const offset = connectionIndex * 6;
            connectionPositions[offset] = 99;
            connectionPositions[offset + 1] = 99;
            connectionPositions[offset + 2] = 0.22;
            connectionPositions[offset + 3] = 99;
            connectionPositions[offset + 4] = 99;
            connectionPositions[offset + 5] = 0.22;
          }
          connectionAttribute.needsUpdate = true;
          connectionMaterial.opacity = active.length > 1 ? 0.095 + Math.sin(now * 0.002) * 0.025 : 0;
          const selected = projectedAgents.find((agent) => agent.selected) ?? projectedAgents.find((agent) => agent.working);
          if (selected) {
            selectedRing.visible = true;
            selectedRing.position.set(selected.x, selected.y, 0.31);
            const breathe = 1 + Math.sin(now * 0.004) * 0.09;
            selectedRing.scale.setScalar(breathe);
            selectedRingMaterial.opacity = selected.working ? 0.2 : 0.11;
          } else {
            selectedRing.visible = false;
          }
          const movingCount = projectedAgents.filter((agent) => agent.moving).length;
          haloMaterial.opacity = projectedAgents.length ? 0.18 + Math.min(0.12, movingCount * 0.025) : 0;
          trailMaterial.opacity = movingCount ? 0.12 : 0;
        };

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

        const onPointerDown = (event: PointerEvent) => {
          if (shouldIgnoreMapPulse(event.target)) return;
          const point = scenePoint(event.clientX, event.clientY);
          interactionPulse = { ...point, startedAt: performance.now() };
        };
        host.addEventListener("pointerdown", onPointerDown, { passive: true, capture: true });

        const animateBurst = (
          burst: typeof startBurst,
          progress: number,
          opacity: number,
          distanceScale: number,
          centerX: number,
          centerY: number,
        ) => {
          for (let index = 0; index < burst.directions.length; index += 1) {
            const direction = burst.directions[index];
            const distance = direction.distance * progress * distanceScale;
            burst.positions[index * 3] = centerX + direction.x * distance;
            burst.positions[index * 3 + 1] = centerY + direction.y * distance;
            burst.positions[index * 3 + 2] = 0.34;
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
          sunMaterial.opacity = 0.16 + sunWave * 0.02;

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

          for (let index = 0; index < moteCount; index += 1) {
            const offset = index * 3;
            motePositions[offset + 1] += (0.008 + seeded(index, 14) * 0.012) * deltaSeconds;
            motePositions[offset] += Math.sin(now * 0.00022 + index) * 0.0002;
            if (motePositions[offset + 1] > 1.08) {
              motePositions[offset + 1] = -1.08;
              motePositions[offset] = seeded(index + Math.floor(now / 7_000), 15) * aspect * 2 - aspect;
            }
          }
          moteAttribute.needsUpdate = true;

          windSeeds.forEach((wind, index) => {
            const cycle = ((wind.x + now * 0.00004 * wind.speed * 20 + aspect + 0.4) % (aspect * 2 + 0.8)) - aspect - 0.4;
            const offset = index * 6;
            const y = wind.y + Math.sin(now * 0.0005 + index) * 0.018;
            windPositions[offset] = cycle;
            windPositions[offset + 1] = y;
            windPositions[offset + 2] = 0.2;
            windPositions[offset + 3] = cycle + wind.length;
            windPositions[offset + 4] = y + Math.sin(now * 0.0007 + index) * 0.012;
            windPositions[offset + 5] = 0.2;
          });
          windAttribute.needsUpdate = true;

          updateAgentEffects(now);
          const pulseAnchor = projectedAgents.find((agent) => agent.selected)
            ?? projectedAgents.find((agent) => agent.working)
            ?? projectedAgents[0];
          const pulseX = pulseAnchor?.x ?? 0;
          const pulseY = pulseAnchor?.y ?? 0;

          const startElapsed = now - startPulseAtRef.current;
          if (startElapsed >= 0 && startElapsed < START_EFFECT_MS) {
            const progress = startElapsed / START_EFFECT_MS;
            const opening = Math.min(1, progress * 1.8);
            startRing.visible = true;
            startRingOuter.visible = true;
            startRing.position.set(pulseX, pulseY, 0.35);
            startRingOuter.position.copy(startRing.position);
            startRing.scale.setScalar(0.68 + opening * 2.25);
            startRingOuter.scale.setScalar(0.6 + opening * 3.05);
            startRingMaterial.opacity = Math.sin(progress * Math.PI) * 0.28;
            startRingOuterMaterial.opacity = Math.sin(Math.min(1, progress * 1.15) * Math.PI) * 0.14;
            animateBurst(startBurst, Math.min(1, progress * 1.8), Math.sin(Math.min(1, progress * 1.25) * Math.PI) * 0.32, 0.6, pulseX, pulseY);
          } else {
            startRing.visible = false;
            startRingOuter.visible = false;
            startBurst.points.visible = false;
          }

          const completionElapsed = now - completionPulseAtRef.current;
          if (completionElapsed >= 0 && completionElapsed < COMPLETION_EFFECT_MS) {
            const progress = completionElapsed / COMPLETION_EFFECT_MS;
            const opening = Math.min(1, progress * 2.5);
            const pulse = 1 + Math.sin(progress * Math.PI * 5) * 0.035 * (1 - progress);
            completionRing.visible = true;
            completionRingOuter.visible = true;
            completionGlow.visible = true;
            completionRing.scale.setScalar((0.75 + opening * (2.8 + aspect * 0.28)) * pulse);
            completionRingOuter.scale.setScalar(0.65 + opening * (4.1 + aspect * 0.38));
            completionRingMaterial.opacity = Math.sin(Math.min(1, progress * 1.5) * Math.PI) * 0.32;
            completionRingOuterMaterial.opacity = Math.sin(Math.min(1, progress * 1.25) * Math.PI) * 0.18;
            completionGlow.scale.set(1.25 + opening * (1.8 + aspect), 1.25 + opening * 2.1, 1);
            completionGlowMaterial.opacity = Math.sin(Math.min(1, progress * 1.18) * Math.PI) * 0.22;
            animateBurst(completionBurst, Math.min(1, progress * 1.85), Math.sin(Math.min(1, progress * 1.32) * Math.PI) * 0.58, 1.35 + aspect * 0.34, 0, 0);
          } else {
            completionRing.visible = false;
            completionRingOuter.visible = false;
            completionGlow.visible = false;
            completionBurst.points.visible = false;
          }

          if (interactionPulse) {
            const elapsed = now - interactionPulse.startedAt;
            if (elapsed >= 0 && elapsed < INTERACTION_EFFECT_MS) {
              const progress = elapsed / INTERACTION_EFFECT_MS;
              interactionRingA.visible = true;
              interactionRingB.visible = true;
              interactionRingA.position.set(interactionPulse.x, interactionPulse.y, 0.36);
              interactionRingB.position.copy(interactionRingA.position);
              interactionRingA.scale.setScalar(0.8 + progress * 4.5);
              interactionRingB.scale.setScalar(0.6 + Math.max(0, progress - 0.12) * 6.2);
              interactionMaterialA.opacity = (1 - progress) * 0.24;
              interactionMaterialB.opacity = Math.max(0, 1 - progress * 1.15) * 0.12;
            } else {
              interactionRingA.visible = false;
              interactionRingB.visible = false;
              interactionPulse = null;
            }
          } else {
            interactionRingA.visible = false;
            interactionRingB.visible = false;
          }

          renderer.render(scene, camera);
        };

        frame = window.requestAnimationFrame(render);
        stop = () => {
          cancelled = true;
          window.cancelAnimationFrame(frame);
          resizeObserver.disconnect();
          host.removeEventListener("pointerdown", onPointerDown, true);
          disposeObject(scene);
          radialTexture.dispose();
          leafTexture.dispose();
          starTexture.dispose();
          renderer.dispose();
          renderer.domElement.remove();
          if (document.documentElement.dataset.asymptaVisualEngine === "three") {
            delete document.documentElement.dataset.asymptaVisualEngine;
          }
        };
      }).catch(() => {
        overlay.dataset.rendererState = "unavailable";
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
    <div
      ref={overlayRef}
      className="asympta-three-world-effects"
      data-visual-layer="three-world"
      aria-hidden="true"
    >
      {startCard ? (
        <div className="asympta-workflow-start-celebration" data-workflow-id={startCard.workflowId}>
          <span className="asympta-workflow-start-celebration__mark"><i /><i /><i /></span>
          <span>
            <small>{copy.eyebrow}</small>
            <strong>{startCard.title}</strong>
            <em>{copy.moving}</em>
          </span>
        </div>
      ) : null}
    </div>,
    host,
  );
}
