import assert from "node:assert/strict";
import test from "node:test";
import { createClock, elapsedSeconds, formatTime, pauseClock, resumeClock, startClock } from "./relicdoku-timer.ts";

test("timer waits for the first move, even after focus/background changes", () => {
  const clock = resumeClock(createClock(), 10_000);
  assert.equal(elapsedSeconds(clock, 99_000), 0);
  assert.equal(clock.started, false);
  assert.equal(elapsedSeconds(startClock(clock, 99_000), 101_500), 2);
});

test("repeated moves do not restart the clock and delayed ticks remain accurate", () => {
  const started = startClock(createClock(), 1_000);
  const stillRunning = startClock(started, 5_500);
  assert.equal(elapsedSeconds(stillRunning, 67_600), 66);
  assert.equal(formatTime(elapsedSeconds(stillRunning, 67_600)), "01:06");
});

test("background time is excluded and fractional seconds survive repeated pauses", () => {
  let clock = startClock(createClock(), 1_000);
  clock = pauseClock(clock, 2_750);
  assert.equal(elapsedSeconds(clock, 99_000), 1);
  clock = pauseClock(clock, 100_000);
  clock = resumeClock(clock, 100_000);
  clock = pauseClock(clock, 101_500);
  assert.equal(elapsedSeconds(clock, 999_999), 3);
});

test("completed clocks freeze, while restart creates a fresh zero clock", () => {
  const completed = pauseClock(startClock(createClock(), 10_000), 42_999);
  assert.equal(elapsedSeconds(completed, 999_999), 32);
  assert.equal(elapsedSeconds(createClock(), 999_999), 0);
  assert.equal(createClock().started, false);
});

test("time formatting handles minute and hour boundaries without wrapping", () => {
  assert.equal(formatTime(0), "00:00");
  assert.equal(formatTime(59), "00:59");
  assert.equal(formatTime(60), "01:00");
  assert.equal(formatTime(3601), "60:01");
  assert.equal(formatTime(-1), "00:00");
});
