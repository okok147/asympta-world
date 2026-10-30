/** App-only persistence. Browser tabs retain their established session semantics. */
export function asymptaTaskStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    if ((window as Window & { __ASYMPTA_NATIVE__?: boolean }).__ASYMPTA_NATIVE__) {
      return window.localStorage;
    }
    return window.sessionStorage;
  } catch {
    return null;
  }
}
