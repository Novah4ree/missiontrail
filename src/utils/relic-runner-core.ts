export type RunnerLane = 0 | 1 | 2;
export type RunnerAction = 'run' | 'jump' | 'slide';
export type RunnerStatus = 'ready' | 'playing' | 'paused' | 'over';
export type RunnerItemKind = 'crate' | 'barrier' | 'gap' | 'shard' | 'shield' | 'magnet';

// The renderer and simulation use the same point at the runner's feet.
export const RUNNER_PLAYER_DEPTH = 0.94;
export const RUNNER_JUMP_SECONDS = 0.82;
export const RUNNER_SLIDE_SECONDS = 0.72;

export type RunnerItem = {
  id: number;
  lane: RunnerLane;
  depth: number;
  kind: RunnerItemKind;
};

export type RunnerState = {
  status: RunnerStatus;
  lane: RunnerLane;
  action: RunnerAction;
  actionTime: number;
  distance: number;
  shards: number;
  bestScore: number;
  shieldTime: number;
  magnetTime: number;
  spawnTime: number;
  nextId: number;
  waves: number;
  items: RunnerItem[];
  crashKind: 'crate' | 'barrier' | 'gap' | null;
};

export const runnerScore = (state: Pick<RunnerState, 'distance' | 'shards'>): number =>
  Math.floor(state.distance) + state.shards * 30;

export const createRunner = (bestScore = 0): RunnerState => ({
  status: 'ready',
  lane: 1,
  action: 'run',
  actionTime: 0,
  distance: 0,
  shards: 0,
  bestScore: Number.isFinite(bestScore) ? Math.max(0, Math.floor(bestScore)) : 0,
  shieldTime: 0,
  magnetTime: 0,
  spawnTime: 0.5,
  nextId: 1,
  waves: 0,
  items: [],
  crashKind: null,
});

export const startRunner = (bestScore = 0): RunnerState => ({
  ...createRunner(bestScore),
  status: 'playing',
});

export function moveRunner(state: RunnerState, direction: -1 | 1): RunnerState {
  if (state.status !== 'playing') return state;
  const lane = Math.max(0, Math.min(2, state.lane + direction)) as RunnerLane;
  return { ...state, lane };
}

export function actRunner(state: RunnerState, action: 'jump' | 'slide'): RunnerState {
  if (state.status !== 'playing') return state;
  // Holding a button or repeating a swipe must not keep a jump alive forever.
  if (state.action === action && state.actionTime > 0) return state;
  return { ...state, action, actionTime: action === 'jump' ? RUNNER_JUMP_SECONDS : RUNNER_SLIDE_SECONDS };
}

export function pauseRunner(state: RunnerState): RunnerState {
  if (state.status === 'playing') return { ...state, status: 'paused' };
  if (state.status === 'paused') return { ...state, status: 'playing' };
  return state;
}

const laneFrom = (random: () => number): RunnerLane =>
  Math.min(2, Math.max(0, Math.floor(random() * 3))) as RunnerLane;

function makeWave(
  state: RunnerState,
  random: () => number,
): Pick<RunnerState, 'items' | 'nextId' | 'waves'> {
  const items = [...state.items];
  let nextId = state.nextId;
  const obstacleLane = laneFrom(random);
  const kindRoll = random();
  const hazard: RunnerItemKind = kindRoll < 0.42 ? 'crate' : kindRoll < 0.76 ? 'barrier' : 'gap';

  if (state.waves > 1 && random() < 0.72) {
    items.push({ id: nextId++, lane: obstacleLane, depth: 0, kind: hazard });
  }
  const otherLane = ((obstacleLane + 1 + Math.floor(random() * 2)) % 3) as RunnerLane;
  items.push({ id: nextId++, lane: otherLane, depth: -0.07, kind: 'shard' });
  if (random() < 0.5) {
    items.push({ id: nextId++, lane: otherLane, depth: -0.28, kind: 'shard' });
  }
  if (state.waves > 0 && state.waves % 11 === 0) {
    items.push({
      id: nextId++,
      lane: otherLane,
      depth: -0.42,
      kind: random() < 0.5 ? 'shield' : 'magnet',
    });
  }
  return { items, nextId, waves: state.waves + 1 };
}

/** One simulation update. Keep it independent of React Native so it can be tested. */
export function tickRunner(
  state: RunnerState,
  seconds: number,
  random: () => number = Math.random,
): RunnerState {
  if (state.status !== 'playing' || !Number.isFinite(seconds)) return state;
  const dt = Math.max(0, Math.min(0.1, seconds));
  if (dt === 0) return state;

  const speed = Math.min(0.95, 0.46 + state.distance / 1200);
  let elapsed = dt;
  let eventTime = 0;
  let shieldTime = state.shieldTime;
  let magnetTime = state.magnetTime;
  let shards = state.shards;
  let status: RunnerStatus = 'playing';
  let crashKind: RunnerState['crashKind'] = null;
  const collected = new Set<number>();

  // Resolve in arrival order, not insertion order. Check timers at the moment of
  // impact, so a jump/shield expiring later in this frame still protects you.
  const crossing = state.items
    .filter((item) => item.depth < RUNNER_PLAYER_DEPTH && item.depth + speed * dt >= RUNNER_PLAYER_DEPTH)
    .sort((a, b) => b.depth - a.depth || a.id - b.id);
  for (const item of crossing) {
    const at = Math.max(0, (RUNNER_PLAYER_DEPTH - item.depth) / speed);
    shieldTime = Math.max(0, shieldTime - (at - eventTime));
    magnetTime = Math.max(0, magnetTime - (at - eventTime));
    eventTime = at;
    const sameLane = item.lane === state.lane;
    const isShard = item.kind === 'shard';
    if (isShard && (sameLane || magnetTime > 0)) {
      shards += 1;
      collected.add(item.id);
      continue;
    }
    if ((item.kind === 'shield' || item.kind === 'magnet') && sameLane) {
      if (item.kind === 'shield') shieldTime = 9;
      else magnetTime = 9;
      collected.add(item.id);
      continue;
    }
    if (!sameLane || item.kind === 'shard' || item.kind === 'shield' || item.kind === 'magnet') {
      continue;
    }

    const action = state.actionTime > at ? state.action : 'run';
    const evaded = (item.kind === 'crate' || item.kind === 'gap')
      ? action === 'jump'
      : action === 'slide';
    if (evaded) continue;
    if (shieldTime > 0) {
      shieldTime = 0;
      collected.add(item.id);
      continue;
    }
    status = 'over';
    crashKind = item.kind;
    elapsed = at;
    break;
  }

  shieldTime = Math.max(0, shieldTime - (elapsed - eventTime));
  magnetTime = Math.max(0, magnetTime - (elapsed - eventTime));
  const actionTime = Math.max(0, state.actionTime - elapsed);
  const action: RunnerAction = actionTime > 0 ? state.action : 'run';
  const distance = state.distance + elapsed * (9 + Math.min(13, state.distance / 115));
  // Missed objects continue past the player instead of disappearing on contact.
  const items = state.items
    .filter((item) => !collected.has(item.id))
    .map((item) => ({ ...item, depth: item.depth + speed * elapsed }))
    .filter((item) => item.depth <= 1.18);
  const score = runnerScore({ distance, shards });
  let next: RunnerState = {
    ...state,
    status,
    crashKind,
    action,
    actionTime,
    distance,
    shards,
    shieldTime,
    magnetTime,
    items,
    spawnTime: state.spawnTime - elapsed,
    bestScore: Math.max(state.bestScore, score),
  };

  if (status === 'playing' && next.spawnTime <= 0) {
    const wave = makeWave(next, random);
    next = {
      ...next,
      ...wave,
      spawnTime: next.spawnTime + Math.max(0.58, 1.18 - distance / 1400),
    };
  }
  return next;
}

