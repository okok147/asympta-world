"use client";

import { useEffect, useRef } from "react";
import type { Group, Material, Mesh, Object3D } from "three";

import {
  allowsVisualEnhancement,
  scheduleIdleTask,
} from "@/lib/living-world/visual-performance";
import {
  WORLD_ZONES,
  type AgentProfile,
  type LivingWorldState,
  type Point,
  type WorldZoneId,
} from "@/lib/living-world/types";

type ThreeWorldCanvasProps = {
  world: LivingWorldState;
  cameraFollow: boolean;
};

const ZONE_COLORS: Record<WorldZoneId, number> = {
  human: 0xc98a68,
  context: 0x86a99d,
  research: 0x8698b3,
  market: 0xd0a85f,
  communication: 0xb58ca1,
  planning: 0x88a47a,
  external: 0x758cb2,
  convergence: 0x4f7667,
};

function toScene(point: Point) {
  return {
    x: ((point.x - 50) / 50) * 5.8,
    z: ((point.y - 50) / 50) * 3.65,
  };
}

function disposeObject(root: Object3D) {
  root.traverse((object) => {
    const mesh = object as Mesh;
    mesh.geometry?.dispose();
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((material: Material) => material.dispose());
    } else {
      mesh.material?.dispose();
    }
  });
}

export function ThreeWorldCanvas({
  world,
  cameraFollow,
}: ThreeWorldCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef(world);
  const followRef = useRef(cameraFollow);

  useEffect(() => {
    worldRef.current = world;
  }, [world]);

  useEffect(() => {
    followRef.current = cameraFollow;
  }, [cameraFollow]);

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
    let stop = () => undefined;

    const cancelIdle = scheduleIdleTask(() => {
      void import("three").then((THREE) => {
        if (cancelled || !host.isConnected) return;

      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
      renderer.setClearColor(0xffffff, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.className = "three-world-canvas__surface";
      renderer.domElement.dataset.renderer = "three.js";
      host.appendChild(renderer.domElement);
      host.dataset.rendererState = "active";

      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-7, 7, 4.5, -4.5, 0.1, 60);
      camera.position.set(0, 8.4, 7.7);
      camera.lookAt(0, 0, 0);

      scene.add(new THREE.HemisphereLight(0xfffcf2, 0x9daea5, 2.25));
      const sun = new THREE.DirectionalLight(0xfff4d9, 2.4);
      sun.position.set(-4, 9, 5);
      scene.add(sun);

      const worldRoot = new THREE.Group();
      worldRoot.rotation.y = -0.035;
      scene.add(worldRoot);

      const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0xf2f1e8,
        roughness: 0.92,
        metalness: 0,
        transparent: true,
        opacity: 0.9,
      });
      const ground = new THREE.Mesh(
        new THREE.CircleGeometry(6.7, 56),
        groundMaterial,
      );
      ground.rotation.x = -Math.PI / 2;
      ground.scale.y = 0.72;
      ground.position.y = -0.08;
      worldRoot.add(ground);

      const roadMaterial = new THREE.LineBasicMaterial({
        color: 0x8ea397,
        transparent: true,
        opacity: 0.24,
      });
      const roadPairs: Array<[WorldZoneId, WorldZoneId]> = [
        ["human", "convergence"],
        ["context", "convergence"],
        ["research", "convergence"],
        ["market", "convergence"],
        ["communication", "convergence"],
        ["planning", "convergence"],
        ["external", "convergence"],
      ];
      roadPairs.forEach(([fromId, toId]) => {
        const from = toScene(WORLD_ZONES[fromId].point);
        const to = toScene(WORLD_ZONES[toId].point);
        const curve = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(from.x, 0.012, from.z),
          new THREE.Vector3(
            (from.x + to.x) / 2 + (from.z - to.z) * 0.09,
            0.012,
            (from.z + to.z) / 2,
          ),
          new THREE.Vector3(to.x, 0.012, to.z),
        );
        const road = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(curve.getPoints(28)),
          roadMaterial.clone(),
        );
        worldRoot.add(road);
      });

      const zoneGroups = new Map<WorldZoneId, Group>();
      (Object.keys(WORLD_ZONES) as WorldZoneId[]).forEach((zoneId, zoneIndex) => {
        const point = toScene(WORLD_ZONES[zoneId].point);
        const group = new THREE.Group();
        group.position.set(point.x, 0, point.z);
        group.userData.baseY = 0;

        const platform = new THREE.Mesh(
          new THREE.CylinderGeometry(0.46, 0.52, 0.09, 20),
          new THREE.MeshStandardMaterial({
            color: ZONE_COLORS[zoneId],
            transparent: true,
            opacity: zoneId === "convergence" ? 0.4 : 0.22,
            roughness: 0.88,
          }),
        );
        platform.position.y = 0.025;
        group.add(platform);

        if (zoneId === "convergence") {
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(0.34, 0.055, 8, 28),
            new THREE.MeshStandardMaterial({
              color: 0x4d7b68,
              emissive: 0x244b3d,
              emissiveIntensity: 0.22,
              roughness: 0.6,
            }),
          );
          ring.rotation.x = Math.PI / 2;
          ring.position.y = 0.18;
          ring.userData.pulse = true;
          group.add(ring);
        } else {
          for (let index = 0; index < 3; index += 1) {
            const height = 0.22 + ((zoneIndex + index) % 3) * 0.09;
            const tower = new THREE.Mesh(
              new THREE.BoxGeometry(0.16, height, 0.16),
              new THREE.MeshStandardMaterial({
                color: ZONE_COLORS[zoneId],
                transparent: true,
                opacity: 0.58,
                roughness: 0.82,
              }),
            );
            tower.position.set((index - 1) * 0.18, height / 2 + 0.08, (index % 2) * 0.06);
            tower.rotation.y = (zoneIndex * 0.17 + index * 0.12) % 0.45;
            group.add(tower);
          }
        }
        zoneGroups.set(zoneId, group);
        worldRoot.add(group);
      });

      const agentGroups = new Map<string, Group>();
      const createAnimal = (profile: AgentProfile) => {
        const group = new THREE.Group();
        const primary = new THREE.MeshStandardMaterial({
          color: profile.art.primary,
          roughness: 0.74,
        });
        const secondary = new THREE.MeshStandardMaterial({
          color: profile.art.secondary,
          roughness: 0.68,
        });
        const ink = new THREE.MeshStandardMaterial({
          color: profile.art.ink,
          roughness: 0.7,
        });

        const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), primary);
        body.scale.set(1, 1.18, 0.88);
        body.position.y = 0.25;
        group.add(body);

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), primary.clone());
        head.position.set(0, 0.49, 0.015);
        group.add(head);

        const eyeGeometry = new THREE.SphereGeometry(0.018, 8, 6);
        [-0.055, 0.055].forEach((x) => {
          const eye = new THREE.Mesh(eyeGeometry, ink.clone());
          eye.position.set(x, 0.51, 0.15);
          group.add(eye);
        });

        const longEars = ["Rabbit", "Deer", "Lynx"].includes(profile.species);
        const pointedEars = ["Fox", "Raccoon", "Red panda", "Otter"].includes(profile.species);
        const bird = ["Peacock", "Owl", "Raven", "Crane", "Hummingbird"].includes(profile.species);
        if (longEars || pointedEars) {
          [-0.105, 0.105].forEach((x) => {
            const ear = new THREE.Mesh(
              new THREE.ConeGeometry(longEars ? 0.055 : 0.075, longEars ? 0.25 : 0.16, 8),
              secondary.clone(),
            );
            ear.position.set(x, longEars ? 0.71 : 0.65, 0);
            ear.rotation.z = x < 0 ? 0.13 : -0.13;
            group.add(ear);
          });
        }
        if (bird) {
          const beak = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.17, 7), secondary.clone());
          beak.rotation.x = Math.PI / 2;
          beak.position.set(0, 0.47, 0.24);
          group.add(beak);
        }
        if (profile.species === "Elephant") {
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.25, 8), secondary.clone());
          trunk.position.set(0, 0.39, 0.17);
          trunk.rotation.x = 0.12;
          group.add(trunk);
        }
        if (profile.species === "Turtle") {
          const shell = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 9), secondary.clone());
          shell.scale.set(1.18, 0.72, 1.05);
          shell.position.set(0, 0.28, -0.08);
          group.add(shell);
        }
        group.scale.setScalar(0.9);
        group.userData.profileId = profile.id;
        return group;
      };

      const cameraTarget = new THREE.Vector3(0, 0, 0);
      let frame = 0;
      let lastFrame = 0;
      const render = (now: number) => {
        if (cancelled) return;
        frame = window.requestAnimationFrame(render);
        if (!reducedMotion && now - lastFrame < 33) return;
        lastFrame = now;

        const current = worldRef.current;
        const currentIds = new Set(current.agents.map((agent) => agent.id));
        for (const [id, group] of agentGroups) {
          if (currentIds.has(id)) continue;
          agentGroups.delete(id);
          worldRoot.remove(group);
          disposeObject(group);
        }
        current.agents.forEach((agent, index) => {
          let group = agentGroups.get(agent.id);
          if (!group) {
            group = createAnimal(agent.profile);
            const initial = toScene(agent.position);
            group.position.set(initial.x, 0.08, initial.z);
            agentGroups.set(agent.id, group);
            worldRoot.add(group);
          }
          const destination = toScene(agent.position);
          group.position.x += (destination.x - group.position.x) * (reducedMotion ? 1 : 0.14);
          group.position.z += (destination.z - group.position.z) * (reducedMotion ? 1 : 0.14);
          const active = ["moving", "working", "sharing", "returning"].includes(agent.status);
          group.position.y = 0.08 + (active && !reducedMotion ? Math.sin(now * 0.004 + index) * 0.035 : 0);
          group.rotation.y = agent.facing === "left" ? 0.18 : -0.18;
        });

        const runningZones = new Set(
          current.tasks
            .filter((task) => task.status === "working" || task.status === "moving")
            .map((task) => task.zone),
        );
        zoneGroups.forEach((group, id) => {
          const active = runningZones.has(id) || (id === "convergence" && current.phase === "converging");
          group.position.y = active && !reducedMotion ? Math.sin(now * 0.003) * 0.035 : 0;
          group.scale.setScalar(active ? 1.08 : 1);
          group.children.forEach((child) => {
            if (child.userData.pulse) child.rotation.z = reducedMotion ? 0 : now * 0.00045;
          });
        });

        const activeAgents = current.agents.filter((agent) =>
          ["moving", "working", "sharing", "returning"].includes(agent.status),
        );
        const focus = activeAgents.length
          ? {
              x: activeAgents.reduce((sum, agent) => sum + agent.position.x, 0) / activeAgents.length,
              y: activeAgents.reduce((sum, agent) => sum + agent.position.y, 0) / activeAgents.length,
            }
          : WORLD_ZONES.convergence.point;
        const focusScene = toScene(focus);
        const desired = followRef.current
          ? new THREE.Vector3(focusScene.x * 0.14, 0, focusScene.z * 0.12)
          : new THREE.Vector3(0, 0, 0);
        cameraTarget.lerp(desired, reducedMotion ? 1 : 0.055);
        camera.position.x = cameraTarget.x;
        camera.position.z = 7.7 + cameraTarget.z;
        camera.lookAt(cameraTarget.x, 0, cameraTarget.z);

        renderer.render(scene, camera);
      };

      const resize = () => {
        const width = Math.max(1, host.clientWidth);
        const height = Math.max(1, host.clientHeight);
        const aspect = width / height;
        const vertical = 4.35;
        camera.left = -vertical * aspect;
        camera.right = vertical * aspect;
        camera.top = vertical;
        camera.bottom = -vertical;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
        renderer.render(scene, camera);
      };
      const observer = new ResizeObserver(resize);
      observer.observe(host);
      resize();
      frame = window.requestAnimationFrame(render);

      stop = () => {
        window.cancelAnimationFrame(frame);
        observer.disconnect();
        disposeObject(worldRoot);
        roadMaterial.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
      }).catch(() => {
        host.dataset.rendererState = "unavailable";
      });
    }, 450);

    return () => {
      cancelled = true;
      cancelIdle();
      stop();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className="three-world-canvas"
      data-visual-engine="three.js"
      data-renderer-state="waiting"
      aria-hidden="true"
    />
  );
}
