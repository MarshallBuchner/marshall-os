/**
 * Single interruptible motion / choreography clock.
 * One generation token — new commands cancel prior phase schedules.
 */

export type ChoreographyPhase =
  | "idle"
  | "receive"
  | "understand"
  | "route"
  | "await_approval"
  | "execute"
  | "verify"
  | "speak"
  | "complete"
  | "error";

type Listener = (phase: ChoreographyPhase, generation: number) => void;

export class MotionClock {
  private generation = 0;
  private phase: ChoreographyPhase = "idle";
  private timers: ReturnType<typeof setTimeout>[] = [];
  private listeners = new Set<Listener>();
  private reducedMotion = false;

  setReducedMotion(v: boolean) {
    this.reducedMotion = v;
  }

  getPhase() {
    return this.phase;
  }

  getGeneration() {
    return this.generation;
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn(this.phase, this.generation);
  }

  private clearTimers() {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }

  /** Interrupt any in-flight choreography */
  interrupt(next: ChoreographyPhase = "idle") {
    this.generation += 1;
    this.clearTimers();
    this.phase = next;
    this.emit();
    return this.generation;
  }

  private schedule(gen: number, ms: number, phase: ChoreographyPhase) {
    const delay = this.reducedMotion ? 0 : ms;
    const id = setTimeout(() => {
      if (gen !== this.generation) return;
      this.phase = phase;
      this.emit();
    }, delay);
    this.timers.push(id);
  }

  /**
   * Run submit choreography until approval / complete.
   * Caller updates real command status separately; this only drives visuals.
   */
  beginCommandFlow(opts: { requiresApproval: boolean; onSpeak?: () => void }) {
    const gen = this.interrupt("receive");
    this.schedule(gen, 180, "understand");
    this.schedule(gen, 520, "route");
    if (opts.requiresApproval) {
      this.schedule(gen, 900, "await_approval");
    } else {
      this.schedule(gen, 900, "execute");
      this.schedule(gen, 1600, "verify");
      this.schedule(gen, 2100, "complete");
      if (opts.onSpeak) {
        this.schedule(gen, 2300, "speak");
        const speakTimer = setTimeout(() => {
          if (gen !== this.generation) return;
          opts.onSpeak?.();
        }, this.reducedMotion ? 0 : 2350);
        this.timers.push(speakTimer);
      }
    }
    return gen;
  }

  settleApproval() {
    const gen = this.interrupt("await_approval");
    return gen;
  }

  beginApprovedFlow(opts: { onSpeak?: () => void }) {
    const gen = this.interrupt("execute");
    this.schedule(gen, 400, "verify");
    this.schedule(gen, 900, "complete");
    if (opts.onSpeak) {
      this.schedule(gen, 1100, "speak");
      const speakTimer = setTimeout(() => {
        if (gen !== this.generation) return;
        opts.onSpeak?.();
      }, this.reducedMotion ? 0 : 1150);
      this.timers.push(speakTimer);
    }
    return gen;
  }

  markError() {
    this.interrupt("error");
  }

  returnIdle(delayMs = 1600) {
    const gen = this.generation;
    this.schedule(gen, delayMs, "idle");
  }
}

/** Module singleton for desktop/mobile shared choreography */
export const jarvisMotionClock = new MotionClock();
