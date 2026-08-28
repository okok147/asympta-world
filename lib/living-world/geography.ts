export const GEO_CELL_DEGREES = 0.01;

export type GeoCell = {
  id: string;
  row: number;
  col: number;
  south: number;
  north: number;
  west: number;
  east: number;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function cellFor(latitude: number, longitude: number): GeoCell {
  const safeLatitude = clamp(latitude, -89.999999, 89.999999);
  const safeLongitude = clamp(longitude, -179.999999, 179.999999);
  const row = Math.floor((safeLatitude + 90) / GEO_CELL_DEGREES);
  const col = Math.floor((safeLongitude + 180) / GEO_CELL_DEGREES);
  const south = row * GEO_CELL_DEGREES - 90;
  const west = col * GEO_CELL_DEGREES - 180;
  return {
    id: `geo-${row}-${col}`,
    row,
    col,
    south,
    north: south + GEO_CELL_DEGREES,
    west,
    east: west + GEO_CELL_DEGREES,
  };
}

export function cellFromId(id: string): GeoCell | null {
  const match = /^geo-(\d+)-(\d+)$/.exec(id);
  if (!match) return null;
  const row = Number(match[1]);
  const col = Number(match[2]);
  if (!Number.isFinite(row) || !Number.isFinite(col)) return null;
  const south = row * GEO_CELL_DEGREES - 90;
  const west = col * GEO_CELL_DEGREES - 180;
  return {
    id,
    row,
    col,
    south,
    north: south + GEO_CELL_DEGREES,
    west,
    east: west + GEO_CELL_DEGREES,
  };
}
