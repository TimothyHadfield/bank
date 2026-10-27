// Random search + local refinement for the hard bot's parameters (plain node).
// Usage: node tools/tune-hard.mjs [candidates] [games]
// Fitness = mean win share of one hard seat in: 2p vs medium, 2p vs easy, 4p vs medium+easy+medium, 6p vs mixed.
import { HARD } from "../js/bots.mjs";
import { tournament, mulberry } from "./sim.mjs";

const cands = +(process.argv[2] || 60), games = +(process.argv[3] || 300);
const tables = [["rules", "medium"], ["rules", "easy"], ["rules", "medium", "easy", "medium"], ["rules", "medium", "easy", "medium", "easy", "medium"]];
const fair = tables.map((t) => 1 / t.length);
function fitness(P) {
  Object.assign(HARD, P);  // tunes the rule set ("rules"), which Hard searches on top of
  let f = 0;
  tables.forEach((t, i) => { f += tournament(t, games, { rounds: 20, seed: 11 + i })[0] / fair[i]; });
  return f / tables.length;      // 1.0 = fair share
}
const R = mulberry(2026);
const rnd = (a, b) => a + (b - a) * R();
const ranges = { base: [60, 320], perIn: [-15, 30], behind: [0, 1.5], ahead: [0, 1], late: [0, 4], maxRolls: [1, 16], spread: [0, 0.4] };
const pick = () => Object.fromEntries(Object.entries(ranges).map(([k, [a, b]]) => [k, k === "maxRolls" ? Math.round(rnd(a, b)) : +rnd(a, b).toFixed(2)]));
let best = { ...HARD }, bestF = fitness(best);
console.log("start", bestF.toFixed(3), JSON.stringify(best));
for (let c = 0; c < cands; c++) {
  const P = c < cands / 2 ? pick() : Object.fromEntries(Object.entries(best).map(([k, v]) => {
    const [a, b] = ranges[k]; let x = v + (b - a) * 0.12 * (R() * 2 - 1); x = Math.min(b, Math.max(a, x));
    return [k, k === "maxRolls" ? Math.round(x) : +x.toFixed(2)];
  }));
  const f = fitness(P);
  if (f > bestF) { best = P; bestF = f; console.log(c, f.toFixed(3), JSON.stringify(P)); }
}
console.log("BEST", bestF.toFixed(3), JSON.stringify(best));
