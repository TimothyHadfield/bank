// Plain-node self-play: computers only, no UI. Used by measure-levels.mjs, tune-hard.mjs and the tests.
import { setup, apply } from "../js/engine.mjs";

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Play one game. levels: ["hard","medium",...]. Returns the final state. */
export function playGame(levels, { rounds = 20, early = true, seed = 1 } = {}) {
  const rng = mulberry(seed);
  const seats = levels.map((level, i) => ({ kind: "computer", name: "C" + i, level }));
  const s = setup(levels.length, { rounds, early }, rng, seats);
  s.levels = levels.slice();          // lets tools try policies that are not in the game
  let guard = 0;
  while (!s.over) {
    apply(s, s.roller, { t: "roll" }, rng);
    if (++guard > 100000) throw new Error("game never ended");
  }
  return s;
}

/**
 * Win share per seat over many games, rotating who sits where so seat order doesn't matter.
 * Ties split the win. Returns { share: {level: fraction}, games }.
 */
export function tournament(levels, games, opts = {}) {
  const n = levels.length, won = Array(n).fill(0);
  for (let g = 0; g < games; g++) {
    const rot = g % n;
    const order = levels.map((_, i) => (i + rot) % n);          // seat k plays levels[order[k]]
    const s = playGame(order.map((i) => levels[i]), { ...opts, seed: (opts.seed || 7) * 100003 + g });
    const top = Math.max(...s.scores);
    const w = s.scores.filter((v) => v === top).length;
    s.scores.forEach((v, k) => { if (v === top) won[order[k]] += 1 / w; });
  }
  return won.map((v) => v / games);
}
