/** Wall time drives the kernel. Rendering and visibility never own progress. */
export class WorkflowClock {
  private observedAt: number;
  private pendingMs = 0;
  constructor(now: number) { this.observedAt = now; }
  reset(now: number) { this.observedAt = now; this.pendingMs = 0; }
  sample(now: number, running: boolean) {
    if (!Number.isFinite(now)) return;
    if (!running) { this.reset(now); return; }
    // A backward system-clock adjustment cannot accrue the same interval twice.
    this.pendingMs += Math.max(0, now - this.observedAt);
    this.observedAt = Math.max(now, this.observedAt);
  }
  take(maxMs = 560) {
    const elapsed = Math.min(this.pendingMs, Math.max(0, maxMs));
    this.pendingMs -= elapsed;
    return elapsed;
  }
  get pending() { return this.pendingMs; }
}
