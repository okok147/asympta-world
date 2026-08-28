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
type Gesture = { distance: number; zoom: number };

const WORLD_WIDTH = 2400;
const WORLD_HEIGHT = 1600;
const PIXEL_SIZE = 2.4;
const MIN_ZOOM = 0.72;
const MAX_ZOOM = 6.5;
const DEFAULT_CAMERA: Camera = { zoom: 1, x: 0, y: 0 };

const LAND_COLORS = ["#f5d34f", "#e9a746", "#d52b4b", "#2aa9bf", "#999f31", "#e8abc0", "#398fd8"];

const MAJOR_ROADS: Point[][] = [
  [{ x: -150, y: 120 }, { x: 250, y: 300 }, { x: 620, y: 265 }, { x: 910, y: 410 }, { x: 1310, y: 390 }, { x: 1740, y: 250 }, { x: 2520, y: 330 }],
  [{ x: -120, y: 520 }, { x: 290, y: 470 }, { x: 670, y: 590 }, { x: 1040, y: 530 }, { x: 1410, y: 405 }, { x: 1900, y: 520 }, { x: 2520, y: 570 }],
  [{ x: -120, y: 920 }, { x: 340, y: 810 }, { x: 730, y: 900 }, { x: 1110, y: 820 }, { x: 1520, y: 760 }, { x: 1950, y: 820 }, { x: 2520, y: 760 }],
  [{ x: -100, y: 1320 }, { x: 380, y: 1270 }, { x: 810, y: 1340 }, { x: 1210, y: 1260 }, { x: 1640, y: 1120 }, { x: 2080, y: 1190 }, { x: 2520, y: 1260 }],
  [{ x: 170, y: -130 }, { x: 230, y: 250 }, { x: 410, y: 530 }, { x: 540, y: 820 }, { x: 650, y: 1160 }, { x: 760, y: 1700 }],
  [{ x: 890, y: -120 }, { x: 850, y: 260 }, { x: 980, y: 560 }, { x: 1050, y: 890 }, { x: 1240, y: 1190 }, { x: 1390, y: 1710 }],
  [{ x: 1560, y: -110 }, { x: 1530, y: 290 }, { x: 1640, y: 590 }, { x: 1600, y: 910 }, { x: 1450, y: 1240 }, { x: 1330, y: 1710 }],
  [{ x: 2290, y: -130 }, { x: 2130, y: 270 }, { x: 2070, y: 620 }, { x: 1940, y: 940 }, { x: 1750, y: 1270 }, { x: 1640, y: 1700 }],
];

const EXPRESSWAYS: Point[][] = [
  [{ x: -160, y: 350 }, { x: 320, y: 205 }, { x: 720, y: 410 }, { x: 1120, y: 370 }, { x: 1570, y: 210 }, { x: 2520, y: 320 }],
  [{ x: -150, y: 720 }, { x: 350, y: 610 }, { x: 760, y: 740 }, { x: 1150, y: 680 }, { x: 1600, y: 550 }, { x: 2100, y: 620 }, { x: 2520, y: 600 }],
  [{ x: -150, y: 1130 }, { x: 330, y: 1020 }, { x: 770, y: 1100 }, { x: 1190, y: 1060 }, { x: 1660, y: 940 }, { x: 2130, y: 980 }, { x: 2520, y: 1040 }],
  [{ x: 430, y: -120 }, { x: 520, y: 230 }, { x: 760, y: 510 }, { x: 1080, y: 770 }, { x: 1450, y: 1030 }, { x: 1800, y: 1330 }, { x: 2030, y: 1700 }],
  [{ x: 2030, y: -130 }, { x: 1840, y: 250 }, { x: 1760, y: 580 }, { x: 1630, y: 860 }, { x: 1490, y: 1180 }, { x: 1320, y: 1710 }],
];

const PURPLE_CORRIDORS: Point[][] = [
  [{ x: -180, y: 95 }, { x: 280, y: 260 }, { x: 560, y: 150 }, { x: 820, y: 330 }, { x: 1110, y: 560 }, { x: 1440, y: 650 }, { x: 1830, y: 720 }, { x: 2520, y: 540 }],
  [{ x: -160, y: 970 }, { x: 300, y: 910 }, { x: 670, y: 1010 }, { x: 1040, y: 940 }, { x: 1390, y: 1010 }, { x: 1760, y: 1210 }, { x: 2520, y: 1340 }],
  [{ x: 360, y: -120 }, { x: 520, y: 210 }, { x: 690, y: 500 }, { x: 870, y: 760 }, { x: 1140, y: 1000 }, { x: 1500, y: 1220 }, { x: 1940, y: 1500 }],
];

const CYAN_CORRIDORS: Point[][] = [
  [{ x: 1460, y: -140 }, { x: 1450, y: 260 }, { x: 1370, y: 550 }, { x: 1410, y: 850 }, { x: 1570, y: 1110 }, { x: 1780, y: 1460 }, { x: 1860, y: 1710 }],
  [{ x: 2520, y: 275 }, { x: 2150, y: 360 }, { x: 1920, y: 610 }, { x: 1850, y: 900 }, { x: 2000, y: 1190 }, { x: 2270, y: 1530 }],
  [{ x: 930, y: -120 }, { x: 990, y: 260 }, { x: 970, y: 620 }, { x: 1050, y: 960 }, { x: 1160, y: 1300 }, { x: 1220, y: 1710 }],
];

const PARKS: Array<{ points: Point[]; color: string }> = [
  { color: "#e8aa4d", points: [{ x: 95, y: 590 }, { x: 485, y: 570 }, { x: 630, y: 760 }, { x: 560, y: 1120 }, { x: 175, y: 1180 }, { x: 40, y: 930 }] },
  { color: "#e8aa4d", points: [{ x: 2020, y: 1220 }, { x: 2410, y: 1160 }, { x: 2490, y: 1540 }, { x: 2130, y: 1580 }, { x: 1960, y: 1430 }] },
  { color: "#9b9f33", points: [{ x: 1970, y: 75 }, { x: 2350, y: 40 }, { x: 2450, y: 250 }, { x: 2240, y: 350 }, { x: 2010, y: 270 }] },
];

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

function drawPolyline(ctx: CanvasRenderingContext2D, points: Point[], width: number, stroke: string) {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(Math.round(points[0].x), Math.round(points[0].y));
  for (let index = 1; index < points.length; index += 1) {
    ctx.lineTo(Math.round(points[index].x), Math.round(points[index].y));
  }
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
  ctx.stroke();
}

function fillPolygon(ctx: CanvasRenderingContext2D, points: Point[], fill: string) {
  if (!points.length) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) ctx.lineTo(points[index].x, points[index].y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawReferenceMap(canvas: HTMLCanvasElement, camera: Camera, showColor: boolean) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  const viewWidth = Math.max(1, Math.round(rect.width / PIXEL_SIZE));
  const viewHeight = Math.max(1, Math.round(rect.height / PIXEL_SIZE));
  if (canvas.width !== viewWidth || canvas.height !== viewHeight) {
    canvas.width = viewWidth;
    canvas.height = viewHeight;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, viewWidth, viewHeight);
  ctx.fillStyle = "#f7f7f5";
  ctx.fillRect(0, 0, viewWidth, viewHeight);

  const fitScale = Math.min(viewWidth / WORLD_WIDTH, viewHeight / WORLD_HEIGHT) * 1.14;
  const scale = fitScale * camera.zoom;
  const tx = viewWidth / 2 + camera.x / PIXEL_SIZE - (WORLD_WIDTH / 2) * scale;
  const ty = viewHeight / 2 + camera.y / PIXEL_SIZE - (WORLD_HEIGHT / 2) * scale;
  ctx.setTransform(scale, 0, 0, scale, tx, ty);

  const paper = seededRandom(20260828);
  ctx.globalAlpha = 0.48;
  for (let index = 0; index < 1800; index += 1) {
    const x = paper() * WORLD_WIDTH;
    const y = paper() * WORLD_HEIGHT;
    ctx.fillStyle = index % 4 === 0 ? "#ecebea" : "#f1f0ee";
    ctx.fillRect(Math.round(x), Math.round(y), 2.5, 2.5);
  }
  ctx.globalAlpha = 1;

  if (showColor) {
    PARKS.forEach((park) => fillPolygon(ctx, park.points, park.color));
    const parcels = seededRandom(147789);
    for (let index = 0; index < 185; index += 1) {
      const x = 28 + parcels() * (WORLD_WIDTH - 120);
      const y = 25 + parcels() * (WORLD_HEIGHT - 95);
      const width = 16 + parcels() * 90;
      const height = 12 + parcels() * 72;
      if (parcels() < 0.35) continue;
      const notch = parcels() * 18;
      const skew = (parcels() - 0.5) * 24;
      fillPolygon(ctx, [
        { x, y: y + notch * 0.2 },
        { x: x + width, y: y + skew * 0.16 },
        { x: x + width - notch, y: y + height },
        { x: x + notch * 0.25, y: y + height + skew * 0.12 },
      ], LAND_COLORS[Math.floor(parcels() * LAND_COLORS.length)]);
    }
  }

  const streets = seededRandom(420319);
  ctx.strokeStyle = "rgba(77,76,79,0.24)";
  ctx.lineWidth = 1.35;
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";

  for (let column = -5; column < 76; column += 1) {
    const baseX = column * 34 + 8 + streets() * 16;
    ctx.beginPath();
    ctx.moveTo(baseX + (streets() - 0.5) * 30, -120);
    for (let row = 0; row <= 12; row += 1) {
      const y = row * 145 + 20;
      const x = baseX + Math.sin(column * 0.72 + row * 0.81) * (18 + streets() * 25) + (streets() - 0.5) * 22;
      ctx.lineTo(Math.round(x), Math.round(y));
    }
    ctx.stroke();
  }

  for (let row = -4; row < 58; row += 1) {
    const baseY = row * 31 + 7 + streets() * 15;
    ctx.beginPath();
    ctx.moveTo(-120, baseY + (streets() - 0.5) * 24);
    for (let column = 0; column <= 13; column += 1) {
      const x = column * 205 + 10;
      const y = baseY + Math.sin(row * 0.57 + column * 0.69) * (14 + streets() * 20) + (streets() - 0.5) * 18;
      ctx.lineTo(Math.round(x), Math.round(y));
    }
    ctx.stroke();
  }

  ctx.globalAlpha = 0.8;
  for (let index = 0; index < 52; index += 1) {
    const y = -360 + index * 54;
    ctx.beginPath();
    ctx.moveTo(-200, y);
    ctx.lineTo(420, y + 235 + (index % 4) * 20);
    ctx.lineTo(1050, y + 390 - (index % 5) * 17);
    ctx.lineTo(2550, y + 730 + (index % 3) * 30);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  PURPLE_CORRIDORS.forEach((route) => {
    drawPolyline(ctx, route, 34, "#1c111d");
    drawPolyline(ctx, route, 23, "#7255a3");
    drawPolyline(ctx, route, 8, "#8e76bc");
  });

  CYAN_CORRIDORS.forEach((route) => {
    drawPolyline(ctx, route, 23, "#1c171f");
    drawPolyline(ctx, route, 15, "#1aa8bf");
  });

  EXPRESSWAYS.forEach((route) => drawPolyline(ctx, route, 21, "#190e18"));
  MAJOR_ROADS.forEach((route) => drawPolyline(ctx, route, 10, "#190e18"));

  ctx.strokeStyle = "#190e18";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(610, 690, 32, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(610, 690, 18, 0, Math.PI * 2);
  ctx.strokeStyle = "#f7f7f5";
  ctx.lineWidth = 4;
  ctx.stroke();
}

export function AsymptaWorldExperience() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointersRef = useRef(new Map<number, Point>());
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const [camera, setCamera] = useState<Camera>(DEFAULT_CAMERA);
  const [showColor, setShowColor] = useState(true);
  const [panning, setPanning] = useState(false);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) drawReferenceMap(canvas, camera, showColor);
  }, [camera, showColor]);

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
      const fitScale = Math.min(rect.width / WORLD_WIDTH, rect.height / WORLD_HEIGHT) * 1.14;
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
    zoomAt(camera.zoom * (event.deltaY < 0 ? 1.14 : 0.88), event.clientX, event.clientY);
  };

  const beginPinch = () => {
    if (pointersRef.current.size !== 2) {
      gestureRef.current = null;
      return;
    }
    const [a, b] = Array.from(pointersRef.current.values());
    gestureRef.current = {
      distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      zoom: camera.zoom,
    };
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size === 1) {
      dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
      setPanning(true);
    } else if (pointersRef.current.size === 2) {
      dragRef.current = null;
      beginPinch();
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointersRef.current.size === 2) {
      const [a, b] = Array.from(pointersRef.current.values());
      const gesture = gestureRef.current;
      if (!gesture) return beginPinch();
      const distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      const centerX = (a.x + b.x) / 2;
      const centerY = (a.y + b.y) / 2;
      zoomAt(gesture.zoom * (distance / gesture.distance), centerX, centerY);
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
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
    gestureRef.current = null;
    if (pointersRef.current.size === 1) {
      const [pointerId, point] = Array.from(pointersRef.current.entries())[0];
      dragRef.current = { pointerId, x: point.x, y: point.y };
    } else if (pointersRef.current.size === 2) {
      beginPinch();
    }
    if (pointersRef.current.size === 0) setPanning(false);
  };

  return (
    <main className="map-app" data-map-app="true" data-map-style="pixel-reference">
      <canvas
        ref={canvasRef}
        className={`map-canvas${panning ? " is-panning" : ""}`}
        aria-label="Interactive pixel city map"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      />

      <button
        type="button"
        className={`map-control map-control--layers${showColor ? " is-active" : ""}`}
        aria-label="Toggle map color layer"
        aria-pressed={showColor}
        onClick={() => setShowColor((value) => !value)}
      >
        <Layers3 size={18} strokeWidth={1.8} />
      </button>

      <div className="map-zoom" aria-label="Map zoom controls">
        <button type="button" aria-label="Zoom in" onClick={() => zoomAt(camera.zoom * 1.25)}><Plus size={18} /></button>
        <button type="button" aria-label="Zoom out" onClick={() => zoomAt(camera.zoom / 1.25)}><Minus size={18} /></button>
      </div>

      <button
        type="button"
        className="map-control map-control--locate"
        aria-label="Recenter map"
        onClick={() => setCamera(DEFAULT_CAMERA)}
      >
        <LocateFixed size={18} strokeWidth={1.8} />
      </button>
    </main>
  );
}
