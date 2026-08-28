type BrowserCapabilities = Navigator & {
  deviceMemory?: number;
  connection?: {
    saveData?: boolean;
  };
  gpu?: unknown;
};

type IdleWindow = Window &
  typeof globalThis & {
    requestIdleCallback?: (
      callback: () => void,
      options?: { timeout: number },
    ) => number;
    cancelIdleCallback?: (id: number) => void;
  };

type VisualEnhancementOptions = {
  minWidth: number;
  minHeight: number;
  minMemory: number;
  requireFinePointer?: boolean;
  requireWebGpu?: boolean;
};

export function allowsVisualEnhancement({
  minWidth,
  minHeight,
  minMemory,
  requireFinePointer = false,
  requireWebGpu = false,
}: VisualEnhancementOptions) {
  if (typeof window === "undefined") return false;
  const capabilities = navigator as BrowserCapabilities;
  const media = [
    `(min-width: ${minWidth}px)`,
    `(min-height: ${minHeight}px)`,
    requireFinePointer ? "(pointer: fine)" : "",
  ].filter(Boolean).join(" and ");
  return Boolean(
    window.matchMedia(media).matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
      !capabilities.connection?.saveData &&
      (capabilities.deviceMemory === undefined || capabilities.deviceMemory >= minMemory) &&
      (!requireWebGpu || capabilities.gpu),
  );
}

export function scheduleIdleTask(callback: () => void, timeout: number) {
  const idleWindow = window as IdleWindow;
  if (idleWindow.requestIdleCallback) {
    const idleId = idleWindow.requestIdleCallback(callback, { timeout });
    return () => idleWindow.cancelIdleCallback?.(idleId);
  }
  const timeoutId = window.setTimeout(callback, Math.min(700, timeout));
  return () => window.clearTimeout(timeoutId);
}
