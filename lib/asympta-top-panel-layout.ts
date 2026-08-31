export type AsymptaTopPanelName = "access" | "request";
export type AsymptaTopPanelMode = "single" | "split" | "stacked";

export type AsymptaTopPanelLayoutInput = {
  viewportWidth: number;
  viewportHeight: number;
  accessTop: number;
  accessWidth: number;
  accessHeight: number;
  requestWidth: number;
  edge?: number;
  gap?: number;
  bottomReserve?: number;
  minimumRequestHeight?: number;
  minimumAccessPanelHeight?: number;
  accessHeaderHeight?: number;
  requestChromeHeight?: number;
};

export type AsymptaTopPanelLayout = {
  mode: Exclude<AsymptaTopPanelMode, "single">;
  accessPanelMaxHeight: number | null;
  requestTop: number | null;
  requestMaxHeight: number | null;
  requestDetailsMaxHeight: number | null;
};

export const ASYMPTA_TOP_PANEL_EDGE_PX = 8;
export const ASYMPTA_TOP_PANEL_GAP_PX = 10;
export const ASYMPTA_TOP_PANEL_BOTTOM_RESERVE_PX = 92;
export const ASYMPTA_TOP_PANEL_MIN_REQUEST_HEIGHT_PX = 74;
export const ASYMPTA_TOP_PANEL_MIN_ACCESS_PANEL_HEIGHT_PX = 54;
export const ASYMPTA_TOP_PANEL_ACCESS_HEADER_HEIGHT_PX = 50;
export const ASYMPTA_TOP_PANEL_REQUEST_CHROME_HEIGHT_PX = 76;

function finite(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

function positive(value: number, fallback: number) {
  return Math.max(0, finite(value, fallback));
}

export function asymptaTopPanelsCanSplit(input: Pick<AsymptaTopPanelLayoutInput,
  "viewportWidth" | "accessWidth" | "requestWidth" | "edge" | "gap"
>) {
  const edge = positive(input.edge ?? ASYMPTA_TOP_PANEL_EDGE_PX, ASYMPTA_TOP_PANEL_EDGE_PX);
  const gap = positive(input.gap ?? ASYMPTA_TOP_PANEL_GAP_PX, ASYMPTA_TOP_PANEL_GAP_PX);
  const viewportWidth = positive(input.viewportWidth, 0);
  const accessWidth = positive(input.accessWidth, 0);
  const requestWidth = positive(input.requestWidth, 0);
  return accessWidth + requestWidth + gap + edge * 2 <= viewportWidth;
}

export function calculateAsymptaTopPanelLayout(input: AsymptaTopPanelLayoutInput): AsymptaTopPanelLayout {
  const edge = positive(input.edge ?? ASYMPTA_TOP_PANEL_EDGE_PX, ASYMPTA_TOP_PANEL_EDGE_PX);
  const gap = positive(input.gap ?? ASYMPTA_TOP_PANEL_GAP_PX, ASYMPTA_TOP_PANEL_GAP_PX);
  const bottomReserve = positive(
    input.bottomReserve ?? ASYMPTA_TOP_PANEL_BOTTOM_RESERVE_PX,
    ASYMPTA_TOP_PANEL_BOTTOM_RESERVE_PX,
  );
  const minimumRequestHeight = positive(
    input.minimumRequestHeight ?? ASYMPTA_TOP_PANEL_MIN_REQUEST_HEIGHT_PX,
    ASYMPTA_TOP_PANEL_MIN_REQUEST_HEIGHT_PX,
  );
  const minimumAccessPanelHeight = positive(
    input.minimumAccessPanelHeight ?? ASYMPTA_TOP_PANEL_MIN_ACCESS_PANEL_HEIGHT_PX,
    ASYMPTA_TOP_PANEL_MIN_ACCESS_PANEL_HEIGHT_PX,
  );
  const accessHeaderHeight = positive(
    input.accessHeaderHeight ?? ASYMPTA_TOP_PANEL_ACCESS_HEADER_HEIGHT_PX,
    ASYMPTA_TOP_PANEL_ACCESS_HEADER_HEIGHT_PX,
  );
  const requestChromeHeight = positive(
    input.requestChromeHeight ?? ASYMPTA_TOP_PANEL_REQUEST_CHROME_HEIGHT_PX,
    ASYMPTA_TOP_PANEL_REQUEST_CHROME_HEIGHT_PX,
  );
  const viewportHeight = positive(input.viewportHeight, 0);

  if (asymptaTopPanelsCanSplit(input)) {
    return {
      mode: "split",
      accessPanelMaxHeight: null,
      requestTop: null,
      requestMaxHeight: null,
      requestDetailsMaxHeight: null,
    };
  }

  const accessTop = Math.max(edge, positive(input.accessTop, edge));
  const maximumAccessCardHeight = Math.max(
    accessHeaderHeight + minimumAccessPanelHeight,
    viewportHeight - bottomReserve - minimumRequestHeight - gap - edge,
  );
  const effectiveAccessHeight = Math.min(
    positive(input.accessHeight, accessHeaderHeight),
    maximumAccessCardHeight,
  );
  const requestTop = Math.ceil(accessTop + effectiveAccessHeight + gap);
  const requestMaxHeight = Math.max(
    minimumRequestHeight,
    Math.floor(viewportHeight - requestTop - bottomReserve),
  );
  const requestDetailsMaxHeight = Math.max(
    44,
    Math.floor(requestMaxHeight - requestChromeHeight),
  );
  const accessPanelMaxHeight = Math.max(
    minimumAccessPanelHeight,
    Math.floor(maximumAccessCardHeight - accessHeaderHeight),
  );

  return {
    mode: "stacked",
    accessPanelMaxHeight,
    requestTop,
    requestMaxHeight,
    requestDetailsMaxHeight,
  };
}

export function asymptaPanelLayerOrder(front: AsymptaTopPanelName) {
  return front === "access"
    ? { access: 96, request: 88 }
    : { access: 88, request: 96 };
}

export function asymptaRectsOverlap(
  left: { top: number; right: number; bottom: number; left: number },
  right: { top: number; right: number; bottom: number; left: number },
) {
  return !(
    left.right <= right.left
    || right.right <= left.left
    || left.bottom <= right.top
    || right.bottom <= left.top
  );
}
