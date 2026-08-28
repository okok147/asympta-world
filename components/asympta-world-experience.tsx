"use client";

import { Layers3, LocateFixed, Minus, Plus } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";

type Point = { x: number; y: number };
type Camera = { zoom: number; x: number; y: number };
type Gesture = {
  distance: number;
  zoom: number;
  worldX: number;
  worldY: number;
};

const WORLD_WIDTH = 1800;
const WORLD_HEIGHT = 1200;
const MIN_ZOOM = 0.72;
const MAX_ZOOM = 5.5;
const DEFAULT_CAMERA: Camera = { zoom: 1, x: 0, y: 0 };

const MAJOR_ROADS: Point[][] = [
  [{ x: -80, y: 190 }, { x: 240, y: 310 }, { x: 480, y: 255 }, { x: 790, y: 390 }, { x: 1110, y: 335 }, { x: 1510, y: 240 }, { x: 1880, y: 290 }],
  [{ x: -70, y: 660 }, { x: 260, y: 575 }, { x: 520, y: 670 }, { x: 820, y: 610 }, { x: 1110, y: 490 }, { x: 1430, y: 520 }, { x: 1870, y: 595 }],
  [{ x: 160, y: -80 }, { x: 235, y: 210 }, { x: 390, y: 415 }, { x: 500, y: 650 }, { x: 570, y: 900 }, { x: 680, y: 1280 }],
  [{ x: 945, y: -80 }, { x: 900, y: 205 }, { x: 975, y: 390 }, { x: 1050, y: 570 }, { x: 1170, y: 760 }, { x: 1335, y: 1260 }],
  [{ x: 1725, y: -90 }, { x: 1570, y: 230 }, { x: 1510, y: 470 }, { x: 1390, y: 680 }, { x: 1240, y: 910 }, { x: 1110, y: 1270 }],
  [{ x: -80, y: 1000 }, { x: 280, y: 955 }, { x: 620, y: 1010 }, { x: 930, y: 945 }, { x: 1260, y: 820 }, { x: 1880, y: 910 }],
];

const EXPRESSWAYS: Point[][] = [
  [{ x: -110, y: 400 }, { x: 240, y: 255 }, { x: 530, y: 410 }, { x: 850, y: 385 }, { x: 1240, y: 255 }, { x: 1880, y: 350 }],
  [{ x: 280, y: -80 }, { x: 360, y: 190 }, { x: 540, y: 430 }, { x: 790, y: 650 }, { x: 1080, y: 940 }, { x: 1290, y: 1270 }],
  [{ x: -90, y: 875 }, { x: 250, y: 760 }, { x: 600, y: 835 }, { x: 920, y: 815 }, { x: 1320, y: 720 }, { x: 1880, y: 810 }],
];

const PURPLE_CORRIDORS: Point[][] = [
  [{ x: -100, y: 135 }, { x: 190, y: 245 }, { x: 390, y: 175 }, { x: 560, y: 300 }, { x: 740, y: 485 }, { x: 980, y: 585 }, { x: 1300, y: 690 }, { x: 1880, y: 520 }],
  [{ x: -90, y: 770 }, { x: 235, y: 720 }, { x: 510, y: 825 }, { x: 830, y: 760 }, { x: 1120, y: 830 }, { x: 1450, y: 1010 }, { x: 1890, y: 1090 }],
];

const CYAN_CORRIDORS: Point[][] = [
  [{ x: 1020, y: -100 }, { x: 1015, y: 210 }, { x: 960, y: 420 }, { x: 990, y: 610 }, { x: 1110, y: 810 }, { x: 1280, y: 1110 }, { x: 1350, y: 1290 }],
  [{ x: 1900, y: 300 }, { x: 1600, y: 390 }, { x: 1430, y: 555 }, { x: 1380, y: 760 }, { x: 1510, y: 950 }, { x: 1710, y: 1160 }],
];

const LAND_COLORS = ["#efcb50", "#dfa04f", "#c94158", "#45a9b8", "#9aa043", "#efbcb9"];

function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function drawSmoothRoute(ctx: CanvasRenderingContext2D, points: Point[], width: number, stroke: string) {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    ctx.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.lineWidth = width;
  ctx.strokeStyle = stroke;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
}

function drawMap(canvas: HTMLCanvasElement, camera: Camera, showLandUse: boolean) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.max(1, Math.round(rect.width * dpr));
  const pixelHeight = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.fillStyle = "#fbfaf7";
  ctx.fillRect(0, 0, rect.width, rect.height);

  const fitScale = Math.min(rect.width / WORLD_WIDTH, rect.height / WORLD_HEIGHT) * 1.08;
  const scale = fitScale * camera.zoom;
  const tx = rect.width / 2 + camera.x - (WORLD_WIDTH / 2) * scale;
  const ty = rect.height / 2 + camera.y - (WORLD_HEIGHT / 2) * scale;
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * tx, dpr * ty);

  if (showLandUse) {
    const random = seededRandom(147789);
    for (let index = 0; index < 94; index += 1) {
      const x = 35 + random() * (WORLD_WIDTH - 110);
      const y = 28 + random() * (WORLD_HEIGHT - 90);
      const width = 14 + random() * 72;
      const height = 12 + random() * 58;
      if (random() < 0.38) continue;
      const skew = (random() - 0.5) * 18;
      ctx.fillStyle = LAND_COLORS[Math.floor(random() * LAND_COLORS.length)];
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(x, y + random() * 8);
      ctx.lineTo(x + width, y + skew * 0.18);
      ctx.lineTo(x + width - random() * 12, y + height);
      ctx.lineTo(x + random() * 9, y + height + skew * 0.12);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  const streets = seededRandom(420319);
  ctx.strokeStyle = "rgba(76, 75, 78, 0.18)";
  ctx.lineWidth = 1.05;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (let column = -4; column < 53; column += 1) {
    const baseX = column * 38 + 10 + streets() * 14;
    ctx.beginPath();
    ctx.moveTo(baseX + (streets() - 0.5) * 22, -80);
    for (let row = 0; row <= 9; row += 1) {
      const y = row * 150 + 20;
      const x = baseX + Math.sin(column * 0.7 + row * 0.8) * (16 + streets() * 22) + (streets() - 0.5) * 18;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  for (let row = -3; row < 40; row += 1) {
    const baseY = row * 34 + 8 + streets() * 15;
    ctx.beginPath();
    ctx.moveTo(-80, baseY + (streets() - 0.5) * 20);
    for (let column = 0; column <= 10; column += 1) {
      const x = column * 190 + 10;
      const y = baseY + Math.sin(row * 0.55 + column * 0.7) * (12 + streets() * 18) + (streets() - 0.5) * 15;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  ctx.globalAlpha = 0.72;
  for (let index = 0; index < 34; index += 1) {
    const y = -250 + index * 67;
    ctx.beginPath();
    ctx.moveTo(-150, y);
    ctx.lineTo(360, y + 190 + (index % 4) * 18);
    ctx.lineTo(880, y + 320 - (index % 5) * 12);
    ctx.lineTo(1900, y + 570 + (index % 3) * 30);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  PURPLE_CORRIDORS.forEach((route) => {
    drawSmoothRoute(ctx, route, 24, "rgba(38, 34, 43, 0.72)");
    drawSmoothRoute(ctx, route, 16, "#75629b");
    drawSmoothRoute(ctx, route, 7, "rgba(255,255,255,0.34)");
  });

  CYAN_CORRIDORS.forEach((route) => {
    drawSmoothRoute(ctx, route, 19, "rgba(36, 39, 43, 0.78)");
    drawSmoothRoute(ctx, route, 12, "#36a8b8");
  });

  EXPRESSWAYS.forEach((route) => {
    drawSmoothRoute(ctx, route, 15, "#29272d");
    drawSmoothRoute(ctx, route, 5.2, "#fbfaf7");
  });

  MAJOR_ROADS.forEach((route) => drawSmoothRoute(ctx, route, 7.5, "#29272d"));

  ctx.beginPath();
  ctx.ellipse(450, 690, 28, 24, 0, 0, Math.PI * 2);
  ctx.lineWidth = 7;
  ctx.strokeStyle = "#29272d";
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(450, 690, 16, 13, 0, 0, Math.PI * 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#fbfaf7";
  ctx.stroke();
}

export function AsymptaWorldExperience() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointersRef = useRef(new Map<number, Point>());
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const [camera, setCamera] = useState<Camera>(DEFAULT_CAMERA);
  const [showLandUse, setShowLandUse] = useState(true);
  const [panning, setPanning] = useState(false);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) drawMap(canvas, camera, showLandUse);
  }, [camera, showLandUse]);

  useEffect(() => {
    redraw();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(redraw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [redraw]);

  const zoomAt = useCallback((nextZoom: number, clientX?: number, clientY?: number) => {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    setCamera((previous) => {
      const zoom = clampZoom(nextZoom);
      if (!rect || clientX === undefined || clientY === undefined) return { ...previous, zoom };
      const fitScale = Math.min(rect.width / WORLD_WIDTH, rect.height / WORLD_HEIGHT) * 1.08;
      const oldScale = fitScale * previous.zoom;
      const newScale = fitScale * zoom;
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      const worldX = (px - rect.width / 2 - previous.x) / oldScale + WORLD_WIDTH / 2;
      const worldY = (py - rect.height / 2 - previous.y) / oldScale + WORLD_HEIGHT / 2;
      return {
        zoom,
        x: px - rect.width / 2 - (worldX - WORLD_WIDTH / 2) * newScale,
        y: py - rect.height / 2 - (worldY - WORLD_HEIGHT / 2) * newScale,
      };
    });
  }, []);

  const handleWheel = (event: ReactWheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    zoomAt(camera.zoom * (event.deltaY < 0 ? 1.13 : 0.885), event.clientX, event.clientY);
  };

  const beginPinch = () => {
    if (pointersRef.current.size !== 2 || !canvasRef.current) {
      gestureRef.current = null;
      return;
    }
    const [a, b] = Array.from(pointersRef.current.values());
    const rect = canvasRef.current.getBoundingClientRect();
    const centerX = (a.x + b.x) / 2 - rect.left;
    const centerY = (a.y + b.y) / 2 - rect.top;
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    const fitScale = Math.min(rect.width / WORLD_WIDTH, rect.height / WORLD_HEIGHT) * 1.08;
    const scale = fitScale * camera.zoom;
    gestureRef.current = {
      distance,
      zoom: camera.zoom,
      worldX: (centerX - rect.width / 2 - camera.x) / scale + WORLD_WIDTH / 2,
      worldY: (centerY - rect.height / 2 - camera.y) / scale + WORLD_HEIGHT / 2,
    };
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size === 1) {
      dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
      setPanning(true);
    } else {
      dragRef.current = null;
      beginPinch();
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointersRef.current.size === 2 && gestureRef.current && canvasRef.current) {
      const [a, b] = Array.from(pointersRef.current.values());
      const rect = canvasRef.current.getBoundingClientRect();
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const zoom = clampZoom(gestureRef.current.zoom * (distance / Math.max(1, gestureRef.current.distance)));
      const centerX = (a.x + b.x) / 2 - rect.left;
      const centerY = (a.y + b.y) / 2 - rect.top;
      const fitScale = Math.min(rect.width / WORLD_WIDTH, rect.height / WORLD_HEIGHT) * 1.08;
      const scale = fitScale * zoom;
      setCamera({
        zoom,
        x: centerX - rect.width / 2 - (gestureRef.current.worldX - WORLD_WIDTH / 2) * scale,
        y: centerY - rect.height / 2 - (gestureRef.current.worldY - WORLD_HEIGHT / 2) * scale,
      });
      return;
    }

    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    setCamera((previous) => ({ ...previous, x: previous.x + dx, y: previous.y + dy }));
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size === 1) {
      const [pointerId, point] = Array.from(pointersRef.current.entries())[0];
      dragRef.current = { pointerId, x: point.x, y: point.y };
      gestureRef.current = null;
    } else {
      dragRef.current = null;
      gestureRef.current = null;
      setPanning(false);
    }
  };

  return (
    <main className="map-app" data-map-app="true" aria-label="Asympta World map">
      <canvas
        ref={canvasRef}
        className={`map-canvas${panning ? " is-panning" : ""}`}
        aria-label="Interactive city map"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      />

      <button
        type="button"
        className={`map-control map-control--layers${showLandUse ? " is-active" : ""}`}
        aria-label="Toggle map color layer"
        aria-pressed={showLandUse}
        onClick={() => setShowLandUse((visible) => !visible)}
      >
        <Layers3 size={18} strokeWidth={1.65} />
      </button>

      <div className="map-zoom" aria-label="Map zoom controls">
        <button type="button" aria-label="Zoom in" onClick={() => zoomAt(camera.zoom * 1.25)}>
          <Plus size={20} strokeWidth={1.6} />
        </button>
        <button type="button" aria-label="Zoom out" onClick={() => zoomAt(camera.zoom / 1.25)}>
          <Minus size={20} strokeWidth={1.6} />
        </button>
      </div>

      <button
        type="button"
        className="map-control map-control--locate"
        aria-label="Recenter map"
        onClick={() => setCamera(DEFAULT_CAMERA)}
      >
        <LocateFixed size={18} strokeWidth={1.6} />
      </button>
    </main>
  );
}
