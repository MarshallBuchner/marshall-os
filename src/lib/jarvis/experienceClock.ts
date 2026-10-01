/**
 * Master experience clock — interruptible cinematic choreography.
 * Owns transform / return timelines so UI systems stay coherent.
 */

export type ExperiencePhase =
  | "idle"
  | "awake"
  | "listen"
  | "understand"
  | "route"
  | "await_approval"
  | "execute"
  | "speak"
  | "transform"
  | "humanoid"
  | "return"
  | "complete"
  | "error";

type Listener = (phase: ExperiencePhase, progress: number, generation: number) => void;

export class ExperienceClock {
  private generation = 0;
  private phase: ExperiencePhase = "idle";
  private progress = 0;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private raf: number | null = null;
  private listeners = new Set<Listener>();
  private reducedMotion = false;
  /** Prevents double-fire from rAF completion + timeout backup */
  private settleToken = 0;

  setReducedMotion(v: boolean) {
    this.reducedMotion = v;
  }

  getPhase() {
    return this.phase;
  }

  getProgress() {
    return this.progress;
  }

  getGeneration() {
    return this.generation;
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn(this.phase, this.progress, this.generation);
  }

  private clear() {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    if (this.raf != null) cancelAnimationFrame(this.raf);
    this.raf = null;
  }

  interrupt(phase: ExperiencePhase = "idle") {
    this.generation += 1;
    this.settleToken += 1;
    this.clear();
    this.phase = phase;
    this.progress = phase === "idle" ? 0 : this.progress;
    this.emit();
    return this.generation;
  }

  private after(gen: number, ms: number, fn: () => void) {
    const delay = this.reducedMotion ? Math.min(ms, 80) : ms;
    const id = setTimeout(() => {
      if (gen !== this.generation) return;
      fn();
    }, delay);
    this.timers.push(id);
  }

  /**
   * Animate progress 0→1 over durationMs while in phase.
   * Invokes onComplete exactly once when progress reaches 1 (rAF path).
   */
  private animateProgress(
    gen: number,
    durationMs: number,
    phase: ExperiencePhase,
    onComplete?: () => void,
  ) {
    this.phase = phase;
    this.progress = 0;
    this.emit();
    const start = performance.now();
    const dur = this.reducedMotion ? Math.min(durationMs, 200) : durationMs;

    const tick = (now: number) => {
      if (gen !== this.generation) return;
      const p = Math.min(1, (now - start) / dur);
      this.progress = p;
      this.phase = phase;
      this.emit();
      if (p < 1) {
        this.raf = requestAnimationFrame(tick);
      } else {
        this.raf = null;
        onComplete?.();
      }
    };
    this.raf = requestAnimationFrame(tick);
  }

  private settleOnce(
    gen: number,
    token: number,
    next: ExperiencePhase,
    progress: number,
    onDone?: () => void,
  ) {
    if (gen !== this.generation || token !== this.settleToken) return;
    this.settleToken += 1;
    this.clear();
    this.phase = next;
    this.progress = progress;
    this.emit();
    onDone?.();
  }

  beginTransform(onDone?: () => void) {
    const gen = this.interrupt("transform");
    const token = this.settleToken;
    const dur = this.reducedMotion ? 400 : 3200;
    const finish = () => this.settleOnce(gen, token, "humanoid", 1, onDone);

    this.animateProgress(gen, dur, "transform", finish);
    // Timeout backup — iOS Safari can stall rAF under thermal/visibility pressure
    this.after(gen, dur + 80, finish);
    // Hard ceiling so TRANSFORMING can never persist indefinitely
    this.after(gen, Math.max(dur + 1800, 5200), finish);
    return gen;
  }

  beginReturn(onDone?: () => void) {
    const gen = this.interrupt("return");
    const token = this.settleToken;
    const dur = this.reducedMotion ? 350 : 2800;
    const finish = () => this.settleOnce(gen, token, "idle", 0, onDone);

    this.animateProgress(gen, dur, "return", finish);
    this.after(gen, dur + 80, finish);
    this.after(gen, Math.max(dur + 1800, 4800), finish);
    return gen;
  }

  settleApproval() {
    return this.interrupt("await_approval");
  }
}

export const jarvisExperienceClock = new ExperienceClock();
