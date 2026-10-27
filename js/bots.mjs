// Bank — computer players. Each policy answers one question after every roll: bank now?
//   easy   : banks at a round target between 60 and 180, ignores the scores.
//   medium : the trained neural network from Bank_Pro_AI (v1, PPO self-play), ported to JS.
//   hard   : a rule set tuned by self-play against the network and Easy (tools/tune-hard.mjs), exact last round.
// Win rates: docs/levels.md (tools/measure-levels.mjs, plain node self-play).
import { NET } from "./net-weights.mjs";

const relu = (x) => (x > 0 ? x : 0);
/** A stable number in [0,1) from a name and a few integers: gives each computer its own habits
 *  without touching the game's dice (so a Daily game rolls the same dice for everyone). */
export function unit(str, a = 0, b = 0) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  h = Math.imul(h ^ a, 16777619); h = Math.imul(h ^ b, 2246822519); h ^= h >>> 13; h = Math.imul(h, 3266489917); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const nameOf = (s, i) => (s.names && s.names[i]) || "seat" + i;

/** The 22 inputs the v1 network was trained on (Bank_Pro_AI/bank-ai-v1-ppo/game/environment.py). */
export function netInputs(s, me) {
  const n = s.n, my = s.scores[me];
  const others = [];
  for (let i = 0; i < n; i++) if (i !== me) others.push(i);
  // the network has 5 opponent slots: with 7-8 players keep the 5 highest scores, in seat order
  let slots = others;
  if (others.length > 5) {
    const top = new Set([...others].sort((a, b) => s.scores[b] - s.scores[a]).slice(0, 5));
    slots = others.filter((i) => top.has(i));
  }
  const all = s.scores;
  const hi = Math.max(...all), lo = Math.min(...all);
  const hiOpp = Math.max(...others.map((i) => all[i]));
  const rank = 1 + all.filter((v) => v > my).length;
  const inCount = s.banked.filter((b) => !b).length;
  // trained on 10 rounds: map longer games onto the last 10 ("rounds left" is what matters)
  const left = s.opts.rounds - s.round;
  const roundEff = Math.max(1, 10 - Math.min(9, left));
  const v = [
    s.pot / 1000, s.roll / 10, roundEff / 10, my / 1000, Math.min(inCount, 6) / 6,
    Math.min(left, 9) / 10, left === 0 ? 1 : 0, Math.max(0, s.roll - 3) / 10,
    rank / n, (my - hi) / 1000, (my - lo) / 1000, my + s.pot >= hiOpp ? 1 : 0,
  ];
  for (let k = 0; k < 5; k++) v.push(k < slots.length ? all[slots[k]] / 1000 : 0);
  for (let k = 0; k < 5; k++) v.push(k < slots.length && !s.banked[slots[k]] ? 1 : 0);
  return v;
}

/** Network output: [bank logit, continue logit]. Deterministic (argmax). */
const layer = (w, b) => ({ rows: w.length, cols: w[0].length, w: Float64Array.from(w.flat()), b: Float64Array.from(b) });
const L = [layer(NET.w0, NET.b0), layer(NET.w1, NET.b1), layer(NET.w2, NET.b2)];
function dense(l, x, act) {
  const out = new Float64Array(l.rows);
  for (let j = 0, o = 0; j < l.rows; j++, o += l.cols) {
    let t = l.b[j];
    for (let k = 0; k < l.cols; k++) t += l.w[o + k] * x[k];
    out[j] = act ? relu(t) : t;
  }
  return out;
}
export function netLogits(x) {
  return Array.from(dense(L[2], dense(L[1], dense(L[0], x, true), true), false));
}

function medium(s, me) {
  // the trained policy is a probability: sample it, like it was trained (a fixed draw per roll and player)
  const [bank, cont] = netLogits(netInputs(s, me));
  const pBank = 1 / (1 + Math.exp(cont - bank));
  return unit(nameOf(s, me), s.rid, s.round) < pBank;
}

function easy(s, me) {
  const target = 60 + ((me * 37 + s.round * 53) % 9) * 15;
  return s.pot >= target;
}

// Tuned by tools/tune-hard.mjs (see docs/levels.md). Thresholds are pot sizes.
export const HARD = { base: 210.86, perIn: 23.67, behind: 0.22, ahead: 0.22, late: 2.68, maxRolls: 16, spread: 0.15 };

/** Exact final-round logic, shared by hard: returns true/false, or null when it doesn't decide. */
function finalRound(s, me) {
  if (s.round !== s.opts.rounds) return null;
  const my = s.scores[me], tot = my + s.pot;
  let bestBanked = 0, bestIn = -1;
  for (let i = 0; i < s.n; i++) {
    if (i === me) continue;
    if (s.banked[i]) bestBanked = Math.max(bestBanked, s.scores[i]);
    else bestIn = Math.max(bestIn, s.scores[i]);
  }
  if (tot <= bestBanked) return false;              // banking can't win: keep rolling
  if (bestIn < 0) return true;                      // I'm the last one in and banking wins
  if (tot <= bestIn) return false;                  // a rival still in is already ahead of my bank
  // banking puts me ahead of everyone who stopped; rivals still in need the pot to grow past me
  if (bestIn + s.pot <= tot - 1 && my >= bestIn) return true;   // even if they bank now they trail
  return null;
}

/** The distilled rule set: bank once the pot reaches a target that moves with the scores. */
export function rules(s, me, _rng, P = HARD) {
  if (s.roll < 3) return false;                     // rolls 1-3 can't bust: never worth banking yet
  const f = finalRound(s, me);
  if (f !== null) return f;
  const my = s.scores[me];
  let lead = 0, inCount = 0;
  for (let i = 0; i < s.n; i++) { if (i !== me && s.scores[i] > lead) lead = s.scores[i]; if (!s.banked[i]) inCount++; }
  const left = s.opts.rounds - s.round;             // rounds after this one
  let T = P.base * (1 + P.spread * (unit(nameOf(s, me)) * 2 - 1)) + P.perIn * (inCount - 2);
  const gap = lead - my;                            // >0 = behind
  const per = gap / (left + 1);                     // how much I must make up per round
  if (gap > 0) T += P.behind * per * (1 + P.late / (left + 1));
  else T -= P.ahead * -per;
  T = Math.max(30, T);
  return s.pot >= T || s.roll - 3 >= P.maxRolls;
}

// Hard = the rule set. A one-step simulation search on top of it (160 play-outs per decision) was tried and
// measured no better (2p 47.3% vs 47.3%, 4p 52.0% vs 54.7% against Medium, 150 games), so it was dropped.
export const hard = rules;

export const POLICIES = { easy, medium, hard, rules };

/** Should seat `me` bank on the current pot? */
export function decide(s, me, rng) {
  const lvl = s.levels[me] || "medium";
  if (s.roll < 3 && lvl !== "easy") return false;
  return !!POLICIES[lvl](s, me, rng);
}
