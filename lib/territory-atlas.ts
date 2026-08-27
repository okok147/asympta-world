import { GEO_CELL_DEGREES, cellFromId, type GeoPoint } from "@/lib/earth-world";

export type AtlasTerritory = {
  id: string;
  index: number;
  label: string;
  cellId: string;
  center: GeoPoint;
  offsetX: number;
  offsetY: number;
  simulatedResidents: number;
  activity: number;
};

export const TERRITORY_ATLAS_SIDE = 25;
export const TERRITORY_ATLAS_COUNT = TERRITORY_ATLAS_SIDE * TERRITORY_ATLAS_SIDE;
const RADIUS = Math.floor(TERRITORY_ATLAS_SIDE / 2);

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function hash(row: number, col: number, salt: number) {
  let value = (Math.imul(row + 17, 73856093) ^ Math.imul(col + 29, 19349663) ^ Math.imul(salt + 11, 83492791)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  return (value >>> 0) / 4294967295;
}

function labelFor(dx: number, dy: number, index: number) {
  if (dx === 0 && dy === 0) return "Home Territory";
  const northSouth = dy > 0 ? `N${dy}` : dy < 0 ? `S${Math.abs(dy)}` : "";
  const eastWest = dx > 0 ? `E${dx}` : dx < 0 ? `W${Math.abs(dx)}` : "";
  return `Territory ${northSouth}${northSouth && eastWest ? " · " : ""}${eastWest || "0"} · ${String(index + 1).padStart(3, "0")}`;
}

export function buildTerritoryAtlas(homeCellId: string): AtlasTerritory[] {
  const home = cellFromId(homeCellId);
  if (!home) return [];
  const maxRow = Math.floor(180 / GEO_CELL_DEGREES) - 1;
  const maxCol = Math.floor(360 / GEO_CELL_DEGREES) - 1;
  const result: AtlasTerritory[] = [];
  let index = 0;

  for (let dy = RADIUS; dy >= -RADIUS; dy -= 1) {
    for (let dx = -RADIUS; dx <= RADIUS; dx += 1) {
      const row = clamp(home.row + dy, 0, maxRow);
      const col = clamp(home.col + dx, 0, maxCol);
      const cellId = `geo-${row}-${col}`;
      const cell = cellFromId(cellId);
      if (!cell) continue;
      result.push({
        id: `territory-${row}-${col}`,
        index,
        label: labelFor(dx, dy, index),
        cellId,
        center: {
          lat: (cell.south + cell.north) / 2,
          lng: (cell.west + cell.east) / 2,
        },
        offsetX: dx,
        offsetY: dy,
        simulatedResidents: 24 + Math.floor(hash(row, col, 1) * 177),
        activity: Math.round((0.22 + hash(row, col, 2) * 0.76) * 100),
      });
      index += 1;
    }
  }
  return result.slice(0, TERRITORY_ATLAS_COUNT);
}

export function nearbyAtlasTerritories(
  atlas: AtlasTerritory[],
  activeCellId: string,
  radius = 1,
) {
  const active = cellFromId(activeCellId);
  if (!active) return [];
  return atlas.filter((territory) => {
    const cell = cellFromId(territory.cellId);
    return cell && Math.abs(cell.col - active.col) <= radius && Math.abs(cell.row - active.row) <= radius;
  });
}
