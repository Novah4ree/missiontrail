export type RelicdokuClock = {
  elapsedMs: number;
  runningSince: number | null;
  started: boolean;
};

export function createClock(): RelicdokuClock {
  return { elapsedMs: 0, runningSince: null, started: false };
}

export function startClock(clock: RelicdokuClock, now: number): RelicdokuClock {
  return clock.runningSince === null ? { ...clock, started: true, runningSince: now } : clock;
}

export function elapsedSeconds(clock: RelicdokuClock, now: number): number {
  const activeMs = clock.runningSince === null ? 0 : Math.max(0, now - clock.runningSince);
  return Math.floor((clock.elapsedMs + activeMs) / 1000);
}

export function pauseClock(clock: RelicdokuClock, now: number): RelicdokuClock {
  if (clock.runningSince === null) return clock;
  return {
    ...clock,
    elapsedMs: clock.elapsedMs + Math.max(0, now - clock.runningSince),
    runningSince: null,
  };
}

export function resumeClock(clock: RelicdokuClock, now: number): RelicdokuClock {
  return clock.started ? startClock(clock, now) : clock;
}

export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  return `${String(minutes).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
