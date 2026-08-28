"use client";

import { Layers3, LocateFixed, Minus, Plus } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";

type Point = { x: number; y: number };
type Size = { width: number; height: number };
type Camera = { zoom: number; cx: number; cy: number };
type Gesture = { distance: number; camera: Camera; anchor: Point };

const WORLD_WIDTH = 2400;
const WORLD_HEIGHT = 1600;
const MIN_ZOOM = 0.78;
const MAX_ZOOM = 7;
const DEFAULT_CAMERA: Camera = { zoom: 1, cx: WORLD_WIDTH / 2, cy: WORLD_HEIGHT / 2 };
const DEFAULT_VIEWPORT: Size = { width: 1440, height: 960 };

const DISTRICTS = [
  { id: "shinjuku", color: "#f2cf59", d: "M130 470 C250 350 470 330 620 420 L690 650 560 810 310 790 120 650Z" },
  { id: "ikebukuro", color: "#e7a8c7", d: "M420 80 C610 35 820 75 930 190 L855 350 650 420 455 335Z" },
  { id: "ueno", color: "#65bdd0", d: "M1310 190 C1460 95 1660 105 1775 225 L1725 420 1510 470 1320 355Z" },
  { id: "asakusa", color: "#89c9c2", d: "M1710 275 C1875 210 2055 250 2180 390 L2115 610 1900 660 1720 535Z" },
  { id: "marunouchi", color: "#e9b959", d: "M1110 620 C1230 535 1410 540 1515 635 L1490 815 1335 905 1155 835Z" },
  { id: "shibuya", color: "#d94d63", d: "M470 900 C650 805 870 840 985 985 L900 1215 660 1260 470 1125Z" },
  { id: "shinagawa", color: "#8ca54a", d: "M900 1120 C1090 1045 1320 1105 1425 1260 L1330 1505 1080 1510 900 1360Z" },
  { id: "sumida", color: "#77a9df", d: "M1730 690 C1895 620 2140 700 2255 860 L2200 1110 1980 1185 1770 1040Z" },
  { id: "odaiba", color: "#ef9f73", d: "M1550 1230 C1710 1150 1940 1200 2060 1345 L1990 1530 1730 1570 1570 1460Z" },
] as const;

const PARKS = [
  "M985 535 C1050 455 1175 430 1265 490 L1275 595 1195 665 1070 650 985 595Z",
  "M1260 285 C1340 215 1460 215 1515 285 L1495 380 1390 420 1280 370Z",
  "M300 820 C390 770 520 800 575 880 L535 980 405 1000 305 930Z",
  "M720 195 C785 145 870 150 920 205 L895 285 810 315 735 270Z",
] as const;

const LOCAL_STREETS = [
  "M45 210 C330 260 540 250 770 185 S1150 120 1430 205 1910 280 2360 190",
  "M10 310 C260 345 520 370 780 330 S1220 270 1510 345 1980 430 2390 360",
  "M40 430 C320 400 560 455 820 455 S1290 390 1570 470 2050 560 2390 485",
  "M20 555 C330 520 560 590 850 560 S1250 520 1600 600 2100 685 2380 610",
  "M40 695 C350 650 590 735 850 700 S1280 650 1600 735 2070 820 2380 755",
  "M25 835 C270 810 560 885 845 850 S1290 815 1580 885 2040 970 2380 915",
  "M30 990 C330 945 560 1015 820 1000 S1270 970 1580 1035 2040 1120 2380 1075",
  "M15 1140 C320 1110 575 1175 850 1160 S1280 1125 1590 1200 2040 1270 2380 1245",
  "M15 1295 C315 1260 600 1330 890 1310 S1310 1280 1620 1340 2050 1410 2370 1400",
  "M135 35 C170 330 150 560 230 820 S300 1220 275 1575",
  "M305 20 C350 300 330 555 410 795 S480 1225 465 1580",
  "M500 15 C535 300 500 560 590 820 S655 1220 660 1585",
  "M705 10 C740 270 695 560 795 820 S850 1240 875 1585",
  "M910 5 C930 285 900 560 995 805 S1060 1220 1090 1590",
  "M1125 10 C1145 280 1105 555 1190 825 S1255 1225 1285 1585",
  "M1345 10 C1370 285 1325 560 1425 820 S1480 1215 1515 1585",
  "M1565 15 C1600 300 1555 560 1645 820 S1710 1210 1735 1590",
  "M1785 10 C1820 285 1770 545 1865 805 S1920 1220 1955 1585",
  "M2005 5 C2040 280 1995 555 2080 820 S2145 1210 2180 1590",
  "M2205 20 C2245 300 2200 570 2280 825 S2330 1210 2360 1565",
  "M180 740 C430 690 650 650 905 680 1110 705 1280 760 1485 735",
  "M560 360 C670 520 780 650 980 760 S1310 970 1535 1130",
  "M820 220 C900 430 1045 570 1220 675 S1520 855 1735 985",
  "M1240 120 C1265 345 1390 510 1575 610 S1890 765 2130 910",
  "M1540 150 C1505 365 1580 530 1740 675 S2010 1000 2270 1140",
  "M340 1200 C620 1110 820 1050 1040 1090 S1420 1250 1690 1205",
  "M1020 1370 C1250 1310 1480 1290 1670 1355 S1960 1510 2220 1480",
] as const;

const MAJOR_ROADS = [
  "M-60 470 C260 440 520 500 790 590 S1260 720 1600 700 2020 620 2460 690",
  "M-40 1040 C270 990 585 1020 845 985 S1280 875 1600 900 2020 1020 2440 1010",
  "M250 -70 C290 250 355 500 520 720 S760 1010 905 1280 1020 1510 1100 1680",
  "M820 -60 C815 250 900 480 1070 650 S1390 850 1555 1060 1750 1350 1830 1650",
  "M1520 -50 C1490 250 1540 470 1670 640 S1880 870 1985 1090 2090 1360 2180 1660",
  "M110 1250 C420 1190 690 1140 940 1160 S1390 1260 1700 1235 2090 1160 2460 1210",
] as const;

const EXPRESSWAYS = [
  "M-80 265 C300 300 640 245 910 350 S1330 505 1620 440 2050 300 2470 390",
  "M80 760 C410 700 730 720 1010 790 S1490 905 1780 850 2140 750 2440 820",
  "M445 -100 C485 270 650 500 860 700 S1260 1040 1510 1250 1780 1450 2050 1690",
  "M2050 -100 C1910 210 1840 480 1845 730 S1930 1150 2080 1470 2140 1580 2200 1680",
] as const;

const RAILS = [
  "M690 445 C780 315 985 265 1210 325 S1580 500 1630 720 1560 1075 1360 1260 1065 1280 785 1180 655 935 585 690 690 445Z",
  "M990 350 C1010 620 1050 870 1095 1245",
  "M590 900 C900 850 1215 825 1540 850 S1970 930 2310 1010",
] as const;

const WATERWAYS = [
  "M1770 -80 C1710 155 1745 360 1810 515 S1920 805 1890 1030 1810 1290 1865 1460 1940 1660",
  "M1555 655 C1700 690 1815 730 1900 800 S2060 960 2240 990",
] as const;

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function getViewBox(camera: Camera, viewport: Size) {
  const aspect = Math.max(0.1, viewport.width / Math.max(1, viewport.height));
  const worldAspect = WORLD_WIDTH / WORLD_HEIGHT;
  let width: number;
  let height: number;

  if (aspect >= worldAspect) {
    height = WORLD_HEIGHT / camera.zoom;
    width = height * aspect;
  } else {
    width = WORLD_WIDTH / camera.zoom;
    height = width / aspect;
  }

  return { x: camera.cx - width / 2, y: camera.cy - height / 2, width, height };
}

function screenToWorld(camera: Camera, viewport: Size, rect: DOMRect, clientX: number, clientY: number): Point {
  const view = getViewBox(camera, viewport);
  return {
    x: view.x + ((clientX - rect.left) / Math.max(1, rect.width)) * view.width,
    y: view.y + ((clientY - rect.top) / Math.max(1, rect.height)) * view.height,
  };
}

function cameraFromAnchor(camera: Camera, viewport: Size, rect: DOMRect, nextZoom: number, clientX: number, clientY: number) {
  const anchor = screenToWorld(camera, viewport, rect, clientX, clientY);
  const zoom = clampZoom(nextZoom);
  const nextView = getViewBox({ ...camera, zoom }, viewport);
  const rx = (clientX - rect.left) / Math.max(1, rect.width) - 0.5;
  const ry = (clientY - rect.top) / Math.max(1, rect.height) - 0.5;
  return {
    zoom,
    cx: anchor.x - rx * nextView.width,
    cy: anchor.y - ry * nextView.height,
  };
}

export function AsymptaWorldExperience() {
  const svgRef = useRef<SVGSVGElement>(null);
  const pointersRef = useRef(new Map<number, Point>());
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const [viewport, setViewport] = useState<Size>(DEFAULT_VIEWPORT);
  const [camera, setCamera] = useState<Camera>(DEFAULT_CAMERA);
  const [showColor, setShowColor] = useState(true);
  const [panning, setPanning] = useState(false);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const updateSize = () => {
      const rect = svg.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) setViewport({ width: rect.width, height: rect.height });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  const viewBox = useMemo(() => getViewBox(camera, viewport), [camera, viewport]);

  const zoomAt = useCallback((nextZoom: number, clientX?: number, clientY?: number) => {
    const svg = svgRef.current;
    const rect = svg?.getBoundingClientRect();
    setCamera((previous) => {
      const zoom = clampZoom(nextZoom);
      if (!rect || clientX === undefined || clientY === undefined) return { ...previous, zoom };
      return cameraFromAnchor(previous, viewport, rect, zoom, clientX, clientY);
    });
  }, [viewport]);

  const beginPinch = useCallback(() => {
    const svg = svgRef.current;
    if (!svg || pointersRef.current.size !== 2) {
      gestureRef.current = null;
      return;
    }
    const [a, b] = Array.from(pointersRef.current.values());
    const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const rect = svg.getBoundingClientRect();
    gestureRef.current = {
      distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      camera,
      anchor: screenToWorld(camera, viewport, rect, center.x, center.y),
    };
  }, [camera, viewport]);

  const handleWheel = (event: ReactWheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    zoomAt(camera.zoom * (event.deltaY < 0 ? 1.14 : 0.88), event.clientX, event.clientY);
  };

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
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

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointersRef.current.size === 2) {
      const svg = svgRef.current;
      const gesture = gestureRef.current;
      if (!svg || !gesture) return beginPinch();
      const [a, b] = Array.from(pointersRef.current.values());
      const distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      const centerX = (a.x + b.x) / 2;
      const centerY = (a.y + b.y) / 2;
      const rect = svg.getBoundingClientRect();
      const zoom = clampZoom(gesture.camera.zoom * (distance / gesture.distance));
      const nextView = getViewBox({ ...gesture.camera, zoom }, viewport);
      const rx = (centerX - rect.left) / Math.max(1, rect.width) - 0.5;
      const ry = (centerY - rect.top) / Math.max(1, rect.height) - 0.5;
      setCamera({
        zoom,
        cx: gesture.anchor.x - rx * nextView.width,
        cy: gesture.anchor.y - ry * nextView.height,
      });
      return;
    }

    const drag = dragRef.current;
    const svg = svgRef.current;
    if (!drag || !svg || drag.pointerId !== event.pointerId) return;
    const rect = svg.getBoundingClientRect();
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    setCamera((previous) => {
      const view = getViewBox(previous, viewport);
      return {
        ...previous,
        cx: previous.cx - (dx / Math.max(1, rect.width)) * view.width,
        cy: previous.cy - (dy / Math.max(1, rect.height)) * view.height,
      };
    });
  };

  const handlePointerEnd = (event: ReactPointerEvent<SVGSVGElement>) => {
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
    <main className="map-app" data-map-app="true" data-map-style="tokyo-vector">
      <svg
        ref={svgRef}
        className={`map-canvas${panning ? " is-panning" : ""}`}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Interactive Tokyo-inspired vector city map"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        <rect x="-1200" y="-900" width="4800" height="3400" fill="#f7f7f5" />

        <g aria-hidden="true">
          <path d="M1845 1140 C2020 1080 2230 1100 2480 1190 L2520 1700 1500 1700 C1540 1510 1650 1340 1845 1140Z" fill="#d9edf2" />
          <path d="M1980 1270 C2140 1240 2320 1290 2470 1390 L2470 1590 2070 1590 1980 1470Z" fill="#c9e3ea" />

          <g opacity={showColor ? 0.72 : 0.18}>
            {DISTRICTS.map((district) => <path key={district.id} d={district.d} fill={showColor ? district.color : "#d9d8d3"} />)}
          </g>

          <g fill="#b8cf8f" opacity="0.9">
            {PARKS.map((d) => <path key={d} d={d} />)}
          </g>

          <g fill="none" stroke="#d2d1cc" strokeWidth="1.25" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round">
            {LOCAL_STREETS.map((d) => <path key={d} d={d} />)}
          </g>

          <g fill="none" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke">
            {WATERWAYS.map((d) => (
              <g key={d}>
                <path d={d} stroke="#b7dce7" strokeWidth="13" />
                <path d={d} stroke="#7bbdcc" strokeWidth="5" />
              </g>
            ))}
          </g>

          <path d="M985 535 C1050 455 1175 430 1265 490 L1275 595 1195 665 1070 650 985 595Z" fill="#dce5bf" stroke="#a6a99b" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          <path d="M1022 558 C1070 510 1165 492 1235 525 L1238 582 1178 620 1090 615 1030 588Z" fill="#d6e8ec" stroke="#99b9c0" strokeWidth="2" vectorEffect="non-scaling-stroke" />

          <g fill="none" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke">
            {RAILS.map((d, index) => (
              <g key={d}>
                <path d={d} stroke="#ffffff" strokeWidth={index === 0 ? 8 : 6} />
                <path d={d} stroke="#7255a3" strokeWidth={index === 0 ? 4.5 : 3.2} strokeDasharray={index === 0 ? "0" : "8 5"} />
              </g>
            ))}
          </g>

          <g fill="none" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke">
            {MAJOR_ROADS.map((d) => (
              <g key={d}>
                <path d={d} stroke="#f7f7f5" strokeWidth="10" />
                <path d={d} stroke="#242127" strokeWidth="5.5" />
              </g>
            ))}
          </g>

          <g fill="none" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke">
            {EXPRESSWAYS.map((d) => (
              <g key={d}>
                <path d={d} stroke="#1d1720" strokeWidth="9" />
                <path d={d} stroke="#8b72b2" strokeWidth="4.2" />
              </g>
            ))}
          </g>

          <g fill="#faf9f5" stroke="#242127" strokeWidth="2" vectorEffect="non-scaling-stroke">
            <circle cx="690" cy="445" r="14" />
            <circle cx="585" cy="690" r="14" />
            <circle cx="655" cy="935" r="14" />
            <circle cx="785" cy="1180" r="14" />
            <circle cx="1065" cy="1280" r="14" />
            <circle cx="1360" cy="1260" r="14" />
            <circle cx="1560" cy="1075" r="14" />
            <circle cx="1630" cy="720" r="14" />
            <circle cx="1210" cy="325" r="14" />
          </g>
        </g>
      </svg>

      <button
        type="button"
        className={`map-control map-control--layers${showColor ? " is-active" : ""}`}
        aria-label="Toggle district color layer"
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
