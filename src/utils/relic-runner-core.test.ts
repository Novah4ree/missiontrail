import assert from 'node:assert/strict';
import test from 'node:test';
import {
  actRunner, createRunner, moveRunner, pauseRunner, runnerScore, startRunner, tickRunner,
  CITY_HAZARDS, TRAIL_HAZARDS, RUNNER_OBSTACLE_HINTS,
  type RunnerItem, type RunnerState,
} from './relic-runner-core.ts';

const item = (id: number, kind: RunnerItem['kind'], depth: number, lane: RunnerItem['lane'] = 1): RunnerItem =>
  ({ id, kind, depth, lane });
const game = (changes: Partial<RunnerState> = {}): RunnerState =>
  ({ ...startRunner(), spawnTime: 10, ...changes });
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-8);

test('jump still protects an impact before it expires within the same frame', () => {
  const next = tickRunner(game({ action: 'jump', actionTime: 0.03, items: [item(1, 'crate', 0.9354)] }), 0.1);
  assert.equal(next.status, 'playing');
  assert.equal(next.action, 'run');
});

test('an expired jump does not protect a later impact in the frame', () => {
  const next = tickRunner(game({ action: 'jump', actionTime: 0.005, items: [item(1, 'gap', 0.9354)] }), 0.1);
  assert.equal(next.status, 'over');
  assert.equal(next.crashKind, 'gap');
});

test('shield is evaluated at impact, not the end of the frame', () => {
  const next = tickRunner(game({ shieldTime: 0.03, items: [item(1, 'crate', 0.9354)] }), 0.1);
  assert.equal(next.status, 'playing');
  assert.equal(next.shieldTime, 0);
});

test('objects resolve by arrival time, even when the array is out of order', () => {
  const next = tickRunner(game({ items: [item(1, 'crate', 0.93), item(2, 'shield', 0.939)] }), 0.1);
  assert.equal(next.status, 'playing');
  assert.equal(next.shieldTime, 0);
});

test('a shield behind the obstacle cannot undo a collision', () => {
  const next = tickRunner(game({ items: [item(1, 'shield', 0.93), item(2, 'crate', 0.939)] }), 0.1);
  assert.equal(next.status, 'over');
  assert.equal(next.shieldTime, 0);
});

test('a crash stops distance and shard awards at the actual impact time', () => {
  const next = tickRunner(game({ items: [item(1, 'shard', 0.92), item(2, 'crate', 0.9354)] }), 0.1);
  assert.equal(next.status, 'over');
  assert.equal(next.shards, 0);
  close(next.distance, 0.09);
});

test('a magnet collected earlier in the frame attracts a later off-lane shard', () => {
  const next = tickRunner(game({ items: [item(1, 'shard', 0.93, 0), item(2, 'magnet', 0.939)] }), 0.1);
  assert.equal(next.shards, 1);
  assert.ok(next.magnetTime > 8.9);
});

test('a magnet that expires after the shard reaches the player still collects it', () => {
  const next = tickRunner(game({ magnetTime: 0.03, items: [item(1, 'shard', 0.9354, 2)] }), 0.1);
  assert.equal(next.shards, 1);
});

test('one shield absorbs one hazard', () => {
  const next = tickRunner(game({ shieldTime: 5, items: [item(1, 'crate', 0.939), item(2, 'barrier', 0.93)] }), 0.1);
  assert.equal(next.status, 'over');
  assert.equal(next.crashKind, 'barrier');
});

test('jumping evades crates and gaps; sliding evades gates', () => {
  for (const kind of ['crate', 'gap', 'barrier'] as const) {
    const action = kind === 'barrier' ? 'slide' : 'jump';
    assert.equal(tickRunner(actRunner(game({ items: [item(1, kind, 0.93)] }), action), 0.1).status, 'playing');
    assert.equal(tickRunner(actRunner(game({ items: [item(1, kind, 0.93)] }), action === 'slide' ? 'jump' : 'slide'), 0.1).status, 'over');
  }
});

test('repeated action input cannot indefinitely extend a jump', () => {
  const jumping = tickRunner(actRunner(game(), 'jump'), 0.1);
  assert.equal(actRunner(jumping, 'jump'), jumping);
  assert.equal(actRunner(jumping, 'slide').action, 'slide');
});

test('missed objects travel past the player and never collect twice', () => {
  let next = tickRunner(game({ items: [item(1, 'shard', 0.93, 0)] }), 0.1);
  assert.equal(next.items.length, 1);
  next = tickRunner(moveRunner(next, -1), 0.1);
  assert.equal(next.shards, 0);
  for (let i = 0; i < 10; i++) next = tickRunner(next, 0.1);
  assert.equal(next.items.length, 0);
});

test('pause freezes movement, timers and input; resume restores the same run', () => {
  const original = actRunner(game({ distance: 80, shieldTime: 4, shards: 3 }), 'jump');
  const paused = pauseRunner(original);
  assert.equal(tickRunner(paused, 0.1), paused);
  assert.equal(moveRunner(paused, 1), paused);
  assert.equal(actRunner(paused, 'slide'), paused);
  assert.deepEqual(pauseRunner(paused), original);
});

test('lanes stay in bounds', () => {
  let next = game();
  for (let i = 0; i < 5; i++) next = moveRunner(next, -1);
  assert.equal(next.lane, 0);
  for (let i = 0; i < 5; i++) next = moveRunner(next, 1);
  assert.equal(next.lane, 2);
});

test('best score updates during a run, so leaving early can preserve it', () => {
  const next = tickRunner(game({ distance: 50, shards: 4 }), 0.1);
  assert.equal(next.bestScore, runnerScore(next));
  assert.equal(startRunner(next.bestScore).bestScore, next.bestScore);
  assert.equal(startRunner(next.bestScore).shards, 0);
});

test('invalid time values never poison the simulation', () => {
  const current = game();
  for (const seconds of [NaN, Infinity, -Infinity, -1, 0]) assert.equal(tickRunner(current, seconds), current);
  assert.equal(createRunner(NaN).bestScore, 0);
  assert.equal(createRunner(-20).bestScore, 0);
});

test('large delays are capped rather than teleporting through the track', () => {
  assert.deepEqual(tickRunner(game(), 5), tickRunner(game(), 0.1));
});

test('spawn timer preserves its remainder instead of drifting with frame size', () => {
  const current = game({ spawnTime: 0.005 });
  const next = tickRunner(current, 1 / 60, () => 0.5);
  close(next.spawnTime, 0.005 - 1 / 60 + 1.18 - next.distance / 1400);
  assert.equal(next.waves, 1);
});

test('a long seeded run has unique IDs, bounded items, and safe lanes in every wave', () => {
  let seed = 321;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  let current = game({ spawnTime: 0 });
  for (let frame = 0; frame < 18000; frame++) {
    current = tickRunner({ ...current, shieldTime: 100 }, 1 / 60, random);
    assert.equal(current.status, 'playing');
    assert.equal(new Set(current.items.map((entry) => entry.id)).size, current.items.length);
    assert.ok(current.items.length < 35);
    assert.ok(current.items.every((entry) => entry.lane >= 0 && entry.lane <= 2 && Number.isFinite(entry.depth)));
    const newHazards = current.items.filter((entry) => entry.depth === 0 && ['crate', 'gap', 'barrier'].includes(entry.kind));
    assert.ok(new Set(newHazards.map((entry) => entry.lane)).size < 3);
  }
  assert.ok(current.waves > 200);
});

test('City Run and Trail Run share a single engine but retain independent biome selection', () => {
  const city = startRunner(175, 'city');
  const trail = startRunner(175, 'trail');
  assert.equal(city.biome, 'city');
  assert.equal(trail.biome, 'trail');
  assert.equal(city.bestScore, 175);
  assert.equal(trail.bestScore, 175);
  assert.equal(createRunner(175, 'trail').status, 'ready');
  assert.equal(createRunner(175, 'trail').biome, 'trail');
});

test('each biome spawns only its own obstacles', () => {
  for (const biome of ['city', 'trail'] as const) {
    const allowed = biome === 'city' ? CITY_HAZARDS : TRAIL_HAZARDS;
    let current = startRunner(0, biome);
    let seed = 83;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const hazards = new Set<string>();
    for (let frame = 0; frame < 4000; frame++) {
      current = tickRunner({ ...current, shieldTime: 100 }, 1 / 60, random);
      for (const entry of current.items) {
        if (entry.kind !== 'shield' && entry.kind !== 'magnet' && entry.kind !== 'shard') {
          hazards.add(entry.kind);
          assert.ok(allowed.includes(entry.kind), biome + ' spawned wrong obstacle: ' + entry.kind);
        }
      }
    }
    assert.ok(hazards.size >= 3, biome + ' must offer diverse obstacles');
  }
});

test('trail boulders, roots and snakes require jumping or changing lanes', () => {
  for (const kind of ['boulder', 'root', 'snake'] as const) {
    const obstacle = game({ biome: 'trail', items: [item(1, kind, 0.93)] });
    assert.equal(tickRunner(actRunner(obstacle, 'jump'), 0.1).status, 'playing');
    assert.equal(tickRunner(actRunner(obstacle, 'slide'), 0.1).status, 'over');
    assert.equal(tickRunner(moveRunner(obstacle, 1), 0.1).status, 'playing');
  }
});

test('low logs, branches and city pipes require sliding', () => {
  for (const kind of ['log', 'branch', 'pipe'] as const) {
    const obstacle = game({ biome: kind === 'pipe' ? 'city' : 'trail', items: [item(1, kind, 0.93)] });
    assert.equal(tickRunner(actRunner(obstacle, 'slide'), 0.1).status, 'playing');
    assert.equal(tickRunner(actRunner(obstacle, 'jump'), 0.1).status, 'over');
  }
});

test('vehicle blocks a full lane and must be dodged or shielded', () => {
  const vehicle = game({ biome: 'city', items: [item(1, 'vehicle', 0.93)] });
  assert.equal(tickRunner(actRunner(vehicle, 'jump'), 0.1).status, 'over');
  assert.equal(tickRunner(actRunner(vehicle, 'slide'), 0.1).status, 'over');
  assert.equal(tickRunner(moveRunner(vehicle, -1), 0.1).status, 'playing');
  assert.equal(tickRunner({ ...vehicle, shieldTime: 8 }, 0.1).status, 'playing');
});

test('every biome hazard explains how to avoid it', () => {
  for (const kind of [...CITY_HAZARDS, ...TRAIL_HAZARDS]) {
    assert.ok(RUNNER_OBSTACLE_HINTS[kind].length > 12);
  }
});
