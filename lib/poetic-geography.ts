import { cellFromId } from "./living-world/geography.ts";

export type PoeticLocale = "en" | "zh-Hant";

export type PoeticArea = {
  id: string;
  name: Record<PoeticLocale, string>;
  cellName: Record<PoeticLocale, string>;
  groupRow: number;
  groupCol: number;
  groupSide: number;
};

/** Around 5.5 km north/south per group near Hong Kong's latitude. */
export const LOCAL_AREA_GROUP_SIDE = 5;

const OPENINGS = [
  { en: "Lantern", "zh-Hant": "燈影" },
  { en: "Willow", "zh-Hant": "柳風" },
  { en: "Moonlit", "zh-Hant": "月照" },
  { en: "Cedar", "zh-Hant": "杉木" },
  { en: "Quiet", "zh-Hant": "靜謐" },
  { en: "Dawn", "zh-Hant": "晨曦" },
  { en: "Silver", "zh-Hant": "銀光" },
  { en: "Moss", "zh-Hant": "青苔" },
  { en: "Cloud", "zh-Hant": "雲影" },
  { en: "Amber", "zh-Hant": "琥珀" },
  { en: "Wildflower", "zh-Hant": "野花" },
  { en: "Starlit", "zh-Hant": "星照" },
] as const;

const LANDSCAPES = [
  { en: "Harbor", "zh-Hant": "港灣" },
  { en: "Garden", "zh-Hant": "花園" },
  { en: "Meadow", "zh-Hant": "草原" },
  { en: "Grove", "zh-Hant": "樹林" },
  { en: "Creek", "zh-Hant": "溪畔" },
  { en: "Hollow", "zh-Hant": "幽谷" },
  { en: "Terrace", "zh-Hant": "台地" },
  { en: "Shore", "zh-Hant": "岸邊" },
  { en: "Ridge", "zh-Hant": "山脊" },
  { en: "Commons", "zh-Hant": "共園" },
  { en: "Vale", "zh-Hant": "谷地" },
  { en: "Crossing", "zh-Hant": "渡口" },
] as const;

const MICRO_AREAS = [
  { en: "Southwest Gate", "zh-Hant": "西南門" },
  { en: "Moss Path", "zh-Hant": "苔徑" },
  { en: "South Lantern", "zh-Hant": "南燈" },
  { en: "Willow Steps", "zh-Hant": "柳階" },
  { en: "Southeast Gate", "zh-Hant": "東南門" },
  { en: "Dusk Walk", "zh-Hant": "暮徑" },
  { en: "Amber Court", "zh-Hant": "琥珀庭" },
  { en: "Lower Garden", "zh-Hant": "下園" },
  { en: "Rain Court", "zh-Hant": "雨庭" },
  { en: "Dawn Walk", "zh-Hant": "晨徑" },
  { en: "West Garden", "zh-Hant": "西園" },
  { en: "Cedar Lane", "zh-Hant": "杉巷" },
  { en: "Quiet Heart", "zh-Hant": "靜心" },
  { en: "Cloud Lane", "zh-Hant": "雲巷" },
  { en: "East Garden", "zh-Hant": "東園" },
  { en: "Moon Walk", "zh-Hant": "月徑" },
  { en: "Silver Court", "zh-Hant": "銀光庭" },
  { en: "Upper Garden", "zh-Hant": "上園" },
  { en: "Star Court", "zh-Hant": "星庭" },
  { en: "Sun Walk", "zh-Hant": "日徑" },
  { en: "Northwest Gate", "zh-Hant": "西北門" },
  { en: "Wildflower Steps", "zh-Hant": "野花階" },
  { en: "North Lantern", "zh-Hant": "北燈" },
  { en: "Brook Path", "zh-Hant": "溪徑" },
  { en: "Northeast Gate", "zh-Hant": "東北門" },
] as const;

function hashNumbers(...values: number[]) {
  let value = 2166136261;
  values.forEach((entry, index) => {
    value ^= entry + index * 374761393;
    value = Math.imul(value, 16777619);
    value ^= value >>> 13;
  });
  return value >>> 0;
}

function microAreaIndex(row: number, col: number, groupRow: number, groupCol: number) {
  const localRow = row - groupRow * LOCAL_AREA_GROUP_SIDE;
  const localCol = col - groupCol * LOCAL_AREA_GROUP_SIDE;
  return localRow * LOCAL_AREA_GROUP_SIDE + localCol;
}

export function poeticAreaForCell(cellId: string): PoeticArea {
  const cell = cellFromId(cellId);
  if (!cell) {
    return {
      id: "local-world",
      name: { en: "Nearby Commons", "zh-Hant": "鄰里共園" },
      cellName: { en: "Quiet Heart", "zh-Hant": "靜心" },
      groupRow: 0,
      groupCol: 0,
      groupSide: LOCAL_AREA_GROUP_SIDE,
    };
  }
  const groupRow = Math.floor(cell.row / LOCAL_AREA_GROUP_SIDE);
  const groupCol = Math.floor(cell.col / LOCAL_AREA_GROUP_SIDE);
  const seed = hashNumbers(groupRow, groupCol);
  const opening = OPENINGS[seed % OPENINGS.length];
  const landscape = LANDSCAPES[Math.floor(seed / OPENINGS.length) % LANDSCAPES.length];
  const quarter = MICRO_AREAS[
    microAreaIndex(cell.row, cell.col, groupRow, groupCol)
  ];
  return {
    id: `area-${groupRow}-${groupCol}`,
    name: {
      en: `${opening.en} ${landscape.en}`,
      "zh-Hant": `${opening["zh-Hant"]}${landscape["zh-Hant"]}`,
    },
    cellName: quarter,
    groupRow,
    groupCol,
    groupSide: LOCAL_AREA_GROUP_SIDE,
  };
}

export function poeticTerritoryLabel(cellId: string, isHome = false) {
  const area = poeticAreaForCell(cellId);
  return {
    en: `${area.name.en} · ${isHome ? "Home" : area.cellName.en}`,
    "zh-Hant": `${area.name["zh-Hant"]} · ${isHome ? "家園" : area.cellName["zh-Hant"]}`,
  } satisfies Record<PoeticLocale, string>;
}

export function localWorldSummary(cellId: string, locale: PoeticLocale) {
  const area = poeticAreaForCell(cellId);
  return locale === "en"
    ? `${area.name.en} · a location-anchored community of ${area.groupSide}×${area.groupSide} nearby areas`
    : `${area.name["zh-Hant"]} · 由 ${area.groupSide}×${area.groupSide} 個鄰近區域組成的定位社區`;
}
