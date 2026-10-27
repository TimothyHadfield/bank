// Bank — the rules engine. Pure functions on a JSON-safe state; rng is the only randomness.
// Rules: RulesPal rulebook (docs/rules-check.md). The dice pass clockwise to the next player still in.
// Rolls 1-3 of a round: a 7 adds 70, doubles add their face value. From roll 4: a 7 ends the round
// (everyone still in gets nothing), doubles double the pot. Anyone still in may bank at any time;
// banking adds the pot to your score and sits you out for the rest of the round.
import { decide } from "./bots.mjs";

export const MIN_SEATS = 2, MAX_SEATS = 8;
export const ROUND_CHOICES = [10, 15, 20];
export const DEFAULT_OPTIONS = { rounds: 20, early: true };

const clone = (o) => JSON.parse(JSON.stringify(o));
const d6 = (rng) => 1 + Math.floor(rng() * 6);

/** Classify a roll: what it does to the pot. */
export function rollEffect(rollNo, a, b, pot) {
  const sum = a + b;
  if (rollNo <= 3) {
    if (sum === 7) return { kind: "seven70", pot: pot + 70 };
    return { kind: a === b ? "dblface" : "add", pot: pot + sum };
  }
  if (sum === 7) return { kind: "bust", pot: 0 };
  if (a === b) return { kind: "double", pot: pot * 2 };
  return { kind: "add", pot: pot + sum };
}

export function normOptions(o = {}) {
  const rounds = ROUND_CHOICES.includes(+o.rounds) ? +o.rounds : DEFAULT_OPTIONS.rounds;
  return { rounds, early: o.early == null ? DEFAULT_OPTIONS.early : o.early !== false };
}

/**
 * seats: [{ kind: "human"|"computer", name, level }]
 * options: { rounds, early }  early=false is the "no banking before roll 3 is done" house rule.
 */
export function setup(n, options = {}, rng = Math.random, seats = []) {
  if (n < MIN_SEATS || n > MAX_SEATS) throw new Error("Bank needs 2 to 8 players.");
  const opts = normOptions(options);
  const kinds = [], names = [], levels = [];
  for (let i = 0; i < n; i++) {
    const s = seats[i] || {};
    kinds.push(s.kind === "computer" ? "computer" : "human");
    names.push(String(s.name || (s.kind === "computer" ? "Computer " + (i + 1) : "Player " + (i + 1))).slice(0, 18));
    levels.push(["easy", "medium", "hard"].includes(s.level) ? s.level : (options.level || "medium"));
  }
  const first = Math.floor(rng() * n);
  return {
    n, kinds, names, levels, opts,
    round: 1, roll: 0, pot: 0, roller: first, starter: first,
    scores: Array(n).fill(0), banked: Array(n).fill(false), gains: Array(n).fill(0),
    dice: null, rid: 0, ev: [], hist: [], over: false,
  };
}

export const canBankNow = (s) => !s.over && s.roll > 0 && s.pot > 0 && (s.opts.early || s.roll >= 3);
export const inRound = (s) => s.banked.map((b, i) => (b ? -1 : i)).filter((i) => i >= 0);

function nextIn(s, from) {
  for (let k = 1; k <= s.n; k++) { const i = (from + k) % s.n; if (!s.banked[i]) return i; }
  return -1;
}

function endRound(s, bust) {
  s.hist.push({ r: s.round, g: s.gains.slice(), bust: !!bust, pot: s.pot, rolls: s.roll });
  s.ev.push({ t: "end", round: s.round, bust: !!bust });
  if (s.round >= s.opts.rounds) {
    s.over = true;
    s.ev.push({ t: "over", winners: winners(s) });
    return;
  }
  s.round += 1; s.roll = 0; s.pot = 0;
  s.banked = Array(s.n).fill(false); s.gains = Array(s.n).fill(0);
  // the dice keep going round the table: the next round starts with the player after the last roller
  s.starter = (s.roller + 1) % s.n; s.roller = s.starter;
}

function bankSeat(s, seat) {
  s.scores[seat] += s.pot; s.gains[seat] = s.pot; s.banked[seat] = true;
  s.ev.push({ t: "bank", seat, pot: s.pot });
}

/** Everyone left still banked -> round over. Otherwise make sure the roller is still in. */
function afterBanks(s) {
  if (inRound(s).length === 0) { endRound(s, false); return; }
  if (s.banked[s.roller]) s.roller = nextIn(s, s.roller);
}

/** Computer seats decide after every roll (inside the same move: 1 write per roll online). */
function computersDecide(s, rng) {
  if (!canBankNow(s)) return;
  const want = [];
  for (const i of inRound(s)) if (s.kinds[i] === "computer" && decide(s, i, rng)) want.push(i);
  for (const i of want) bankSeat(s, i);   // simultaneous: all decided on the same pot
  if (want.length) afterBanks(s);
}

export function toAct(s) {
  if (s.over) return [];
  const set = new Set([s.roller]);
  for (const i of inRound(s)) if (s.kinds[i] === "human") set.add(i);
  return [...set].sort((a, b) => a - b);
}

export function apply(state, seat, action, rng = Math.random) {
  const s = state; // the caller passes a copy
  if (s.over) throw new Error("The game is over.");
  if (!action || typeof action !== "object") throw new Error("No move.");
  s.ev = [];
  if (action.t === "roll") {
    if (seat !== s.roller) throw new Error("It's not your roll.");
    const a = d6(rng), b = d6(rng);
    s.roll += 1; s.rid += 1;
    const e = rollEffect(s.roll, a, b, s.pot);
    s.dice = [a, b];
    s.ev.push({ t: "roll", seat, d: [a, b], kind: e.kind, before: s.pot, pot: e.pot, roll: s.roll });
    s.pot = e.pot;
    if (e.kind === "bust") { endRound(s, true); return s; }
    // pass the dice before the computers react, so a computer roller that banks hands them on
    s.roller = nextIn(s, s.roller);
    computersDecide(s, rng);
    return s;
  }
  if (action.t === "bank") {
    if (seat < 0 || seat >= s.n) throw new Error("No such seat.");
    if (s.banked[seat]) throw new Error("You already banked this round.");
    if (action.rid != null && action.rid !== s.rid) throw new Error("Too late: the dice already rolled.");
    if (!canBankNow(s)) throw new Error(s.roll < 3 && !s.opts.early ? "No banking until 3 rolls are in." : "Nothing to bank yet.");
    bankSeat(s, seat);
    afterBanks(s);
    return s;
  }
  throw new Error("Unknown move.");
}

export function winners(s) {
  const top = Math.max(...s.scores);
  return s.scores.map((v, i) => (v === top ? i : -1)).filter((i) => i >= 0);
}

/** Bot hook for the online kit: only ever asked when a computer holds the dice. */
export function bot(ctx, seat, rng = Math.random) {
  const s = ctx.state || ctx.pub;
  if (canBankNow(s) && !s.banked[seat] && decide(s, seat, rng)) return { t: "bank", rid: s.rid };
  return { t: "roll" };
}

export const game = {
  id: "bank",
  minSeats: MIN_SEATS, maxSeats: MAX_SEATS,
  setup, toAct, apply,
  publicView: (s) => s,            // nothing is secret in Bank
  privateView: () => null,
  bot,
  isOver: (s) => !!s.over,
};

export { clone };
