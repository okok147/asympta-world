"use client";

import { Cloud, HardDrive } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { EarthScaleWorldRuntime } from "@/components/earth-scale-world-runtime";
import type { EarthWorldState, GeoEvidence, GeoOpportunity, GeoPlace } from "@/lib/earth-world";

type SharedEarth = {
  version: 1;
  places: GeoPlace[];
  evidence: GeoEvidence[];
  opportunities: GeoOpportunity[];
  updatedAt: number;
};
type Persistence = "checking" | "d1-shared" | "local-mirror";

const EARTH_KEY = "asympta-earth-world-v1";

function readLocal() {
  try {
    const raw = localStorage.getItem(EARTH_KEY);
    return raw ? (JSON.parse(raw) as EarthWorldState) : null;
  } catch { return null; }
}
function writeLocal(state: EarthWorldState) {
  try { localStorage.setItem(EARTH_KEY, JSON.stringify(state)); } catch { /* memory fallback */ }
}
function sharedSlice(state: EarthWorldState): SharedEarth {
  return {
    version: 1,
    places: state.places,
    evidence: state.evidence.map((item) => ({ ...item, imageDataUrl: item.imageDataUrl && item.imageDataUrl.length <= 140_000 ? item.imageDataUrl : undefined })),
    opportunities: state.opportunities,
    updatedAt: Math.max(0, ...state.places.map((item) => item.updatedAt), ...state.evidence.map((item) => item.updatedAt), ...state.opportunities.map((item) => item.updatedAt)),
  };
}
function revision(shared: SharedEarth) { return shared.updatedAt; }
function mergeByUpdatedAt<T extends { id: string; updatedAt: number }>(local: T[], remote: T[]) {
  const map = new Map<string, T>();
  for (const item of [...local, ...remote]) {
    const current = map.get(item.id);
    if (!current || item.updatedAt >= current.updatedAt) map.set(item.id, item);
  }
  return [...map.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}
function mergeRemote(local: EarthWorldState, remote: SharedEarth): EarthWorldState {
  return {
    ...local,
    places: mergeByUpdatedAt(local.places, remote.places).slice(0, 5000),
    evidence: mergeByUpdatedAt(local.evidence, remote.evidence).slice(0, 6000),
    opportunities: mergeByUpdatedAt(local.opportunities, remote.opportunities).slice(0, 5000),
    updatedAt: Math.max(local.updatedAt, remote.updatedAt),
  };
}
async function getShared(): Promise<SharedEarth | null> {
  try {
    const response = await fetch("/api/earth", { cache: "no-store", headers: { accept: "application/json" } });
    if (!response.ok) return null;
    const payload = await response.json() as { earth?: SharedEarth; persistence?: string };
    return payload.persistence === "d1-shared" && payload.earth?.version === 1 ? payload.earth : null;
  } catch { return null; }
}
async function pushShared(shared: SharedEarth): Promise<SharedEarth | null> {
  try {
    const response = await fetch("/api/earth", { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(shared) });
    if (!response.ok) return null;
    const payload = await response.json() as { earth?: SharedEarth; persistence?: string };
    return payload.persistence === "d1-shared" && payload.earth?.version === 1 ? payload.earth : null;
  } catch { return null; }
}

export function ClientEarthSharedWorld() {
  const [ready, setReady] = useState(false);
  const [runtimeKey, setRuntimeKey] = useState(0);
  const [persistence, setPersistence] = useState<Persistence>("checking");
  const [barHost, setBarHost] = useState<HTMLElement | null>(null);
  const lastPushedRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let pullTimer = 0;
    let pushTimer = 0;
    const bootstrap = async () => {
      const local = readLocal();
      const remote = await getShared();
      if (cancelled) return;
      if (!remote) {
        setPersistence("local-mirror");
        setReady(true);
        return;
      }
      setPersistence("d1-shared");
      if (local) {
        const merged = mergeRemote(local, remote);
        writeLocal(merged);
        const localShared = sharedSlice(merged);
        const pushed = revision(localShared) > revision(remote) ? await pushShared(localShared) : remote;
        if (pushed) lastPushedRef.current = revision(pushed);
      } else lastPushedRef.current = revision(remote);
      setReady(true);
      setRuntimeKey((value) => value + 1);

      pullTimer = window.setInterval(async () => {
        const fresh = await getShared();
        const current = readLocal();
        if (!fresh || !current || cancelled) return;
        const currentRevision = revision(sharedSlice(current));
        if (revision(fresh) > currentRevision) {
          writeLocal(mergeRemote(current, fresh));
          lastPushedRef.current = revision(fresh);
          setRuntimeKey((value) => value + 1);
        }
      }, 12000);
      pushTimer = window.setInterval(async () => {
        const current = readLocal();
        if (!current || cancelled) return;
        const shared = sharedSlice(current);
        if (revision(shared) <= lastPushedRef.current) return;
        const merged = await pushShared(shared);
        if (!merged || cancelled) return;
        lastPushedRef.current = revision(merged);
        const latest = readLocal();
        if (latest) writeLocal(mergeRemote(latest, merged));
      }, 2400);
    };
    void bootstrap();
    return () => { cancelled = true; if (pullTimer) window.clearInterval(pullTimer); if (pushTimer) window.clearInterval(pushTimer); };
  }, []);

  useEffect(() => {
    const scan = window.setInterval(() => {
      const host = document.querySelector<HTMLElement>(".earth-bar");
      setBarHost((current) => current === host ? current : host);
    }, 500);
    return () => window.clearInterval(scan);
  }, []);

  return <>
    {ready ? <EarthScaleWorldRuntime key={runtimeKey} /> : null}
    {barHost ? createPortal(
      <span className="earth-pill" title={persistence === "d1-shared" ? "Shared Earth community state via D1" : "This host has no Earth API; changes are kept in this browser"}>
        {persistence === "d1-shared" ? <Cloud aria-hidden="true" /> : <HardDrive aria-hidden="true" />}
        {persistence === "d1-shared" ? "SHARED" : "LOCAL"}
      </span>,
      barHost,
      "earth-persistence",
    ) : null}
  </>;
}
