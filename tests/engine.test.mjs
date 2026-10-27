import test from "node:test";
import assert from "node:assert/strict";
import { setup, apply, toAct, rollEffect, canBankNow, winners, game, normOptions } from "../js/engine.mjs";
import { decide, netInputs, POLICIES } from "../js/bots.mjs";
import { mulberry, playGame } from "../tools/sim.mjs";

const seats = (kinds) => kinds.map((k, i) => ({ kind: k, name: "P" + i, level: "hard" }));
/** rng that returns stacked dice first: values 1..6 -> (v-0.5)/6 */
function stacked(dice, seed = 3) {
  const r = mulberry(seed), q = dice.map((v) => (v - 0.5) / 6);
  return () => (q.length ? q.shift() : r());
}

test("roll effects follow the rulebook", () => {
  assert.deepEqual(rollEffect(1, 3, 4, 0), { kind: "seven70", pot: 70 });
  assert.deepEqual(rollEffect(3, 5, 2, 30), { kind: "seven70", pot: 100 });
  assert.deepEqual(rollEffect(2, 5, 5, 30), { kind: "dblface", pot: 40 });   // doubles = face value early
  assert.deepEqual(rollEffect(2, 2, 3, 30), { kind: "add", pot: 35 });
  assert.deepEqual(rollEffect(4, 6, 1, 300), { kind: "bust", pot: 0 });
  assert.deepEqual(rollEffect(4, 2, 2, 80), { kind: "double", pot: 160 });   // doubles double from roll 4
  assert.deepEqual(rollEffect(9, 6, 5, 80), { kind: "add", pot: 91 });
});

test("2 to 8 players, rounds 10/15/20, rulebook defaults", () => {
  assert.throws(() => setup(1));
  assert.throws(() => setup(9));
  for (let n = 2; n <= 8; n++) assert.equal(setup(n, {}, mulberry(n)).n, n);
  assert.deepEqual(normOptions({}), { rounds: 20, early: true });
  assert.equal(normOptions({ rounds: 15 }).rounds, 15);
  assert.equal(normOptions({ rounds: 7 }).rounds, 20);
});

test("anyone still in may bank at any time (rulebook), dice pass to the next player still in", () => {
  const s = setup(3, {}, stacked([1, 2, 2, 3]), seats(["human", "human", "human"]));
  s.roller = 0;
  apply(s, 0, { t: "roll" }, stacked([1, 2]));         // roll 1: 3
  assert.equal(s.pot, 3); assert.equal(s.roller, 1);
  assert.ok(canBankNow(s));
  apply(s, 2, { t: "bank", rid: s.rid });              // banking on roll 1 is allowed by default
  assert.equal(s.scores[2], 3); assert.ok(s.banked[2]);
  assert.deepEqual(toAct(s), [0, 1]);
  apply(s, 1, { t: "bank" });                          // the roller banks: the dice pass on
  assert.equal(s.roller, 0);
  assert.throws(() => apply(s, 1, { t: "bank" }), /already banked/);
  apply(s, 0, { t: "bank" });                          // last one banks: next round
  assert.equal(s.round, 2); assert.equal(s.pot, 0); assert.deepEqual(s.banked, [false, false, false]);
  assert.deepEqual(s.hist[0].g, [3, 3, 3]);
});

test("house rule option: no banking until 3 rolls are in", () => {
  const s = setup(2, { early: false }, mulberry(1), seats(["human", "human"]));
  s.roller = 0;
  apply(s, 0, { t: "roll" }, stacked([1, 2]));
  assert.throws(() => apply(s, 1, { t: "bank" }), /3 rolls/);
  apply(s, 1, { t: "roll" }, stacked([2, 3]));
  apply(s, 0, { t: "roll" }, stacked([4, 4]));
  apply(s, 1, { t: "bank" });
  assert.equal(s.scores[1], 3 + 5 + 8);
});

test("a 7 from roll 4 ends the round: everyone still in gets nothing", () => {
  const s = setup(3, {}, mulberry(1), seats(["human", "human", "human"]));
  s.roller = 0;
  const r = stacked([1, 2, 3, 3, 6, 1, 2, 2, 3, 4]);
  apply(s, 0, { t: "roll" }, r); apply(s, 1, { t: "roll" }, r); apply(s, 2, { t: "roll" }, r);   // 3, +6 = 9, 7 -> +70 = 79
  assert.equal(s.pot, 79);
  apply(s, 0, { t: "bank" });
  apply(s, 1, { t: "roll" }, r);                       // 2+2 on roll 4: doubled
  assert.equal(s.pot, 158);
  apply(s, 2, { t: "roll" }, r);                       // 3+4 = 7: bust
  assert.equal(s.round, 2);
  assert.deepEqual(s.scores, [79, 0, 0]);
  assert.ok(s.hist[0].bust);
  assert.equal(s.roller, 0, "next round starts with the player after the one who rolled the 7");
});

test("a bank that arrives after the dice moved on is refused", () => {
  const s = setup(2, {}, mulberry(1), seats(["human", "human"]));
  s.roller = 0;
  apply(s, 0, { t: "roll" }, stacked([1, 2]));
  const old = s.rid;
  apply(s, 1, { t: "roll" }, stacked([2, 3]));
  assert.throws(() => apply(s, 0, { t: "bank", rid: old }), /Too late/);
});

test("computers decide inside the roll (one state change per roll)", () => {
  const s = setup(4, {}, mulberry(2), [{ kind: "human" }, { kind: "computer", level: "easy" }, { kind: "computer", level: "easy" }, { kind: "computer", level: "easy" }]);
  const rng = mulberry(9);
  let rolls = 0;
  while (!s.over) {
    const who = toAct(s);
    assert.ok(who.length > 0);
    assert.ok(who.includes(s.roller));
    for (const i of who) if (i !== s.roller) assert.equal(s.kinds[i], "human", "only people wait to bank");
    apply(s, s.roller, { t: "roll" }, rng); rolls++;
  }
  assert.ok(s.scores.slice(1).some((v) => v > 0), "computers banked");
  assert.ok(rolls > 40);
});

test("800 random games: never throws, JSON-safe, ends after the set rounds", () => {
  for (let g = 0; g < 800; g++) {
    const rng = mulberry(g + 1);
    const n = 2 + (g % 7);
    const kinds = Array.from({ length: n }, (_, i) => (rng() < 0.5 ? "human" : "computer"));
    const levels = ["easy", "medium", "hard"];
    const s = setup(n, { rounds: [10, 15, 20][g % 3], early: g % 4 !== 0 }, rng, kinds.map((k, i) => ({ kind: k, level: levels[(g + i) % 3] })));
    let st = s, steps = 0;
    while (!game.isOver(st)) {
      const who = game.toAct(st);
      assert.ok(who.length, "toAct empty before the end");
      const seat = who[Math.floor(rng() * who.length)];
      let a = st.kinds[seat] === "computer" ? game.bot({ state: st }, seat, rng) : (rng() < 0.15 && canBankNow(st) ? { t: "bank", rid: st.rid } : { t: "roll" });
      if (a.t === "roll" && seat !== st.roller) a = { t: "bank", rid: st.rid };
      if (a.t === "bank" && !canBankNow(st)) continue;
      st = game.apply(JSON.parse(JSON.stringify(st)), seat, a, rng);
      if (++steps > 20000) assert.fail("never ends");
    }
    assert.equal(st.hist.length, st.opts.rounds);
    assert.deepEqual(JSON.parse(JSON.stringify(st)), st);
    for (let i = 0; i < n; i++) assert.equal(st.scores[i], st.hist.reduce((t, h) => t + h.g[i], 0));
  }
});

test("ties share the win", () => {
  const s = setup(3, {}, mulberry(1));
  s.scores = [100, 250, 250];
  assert.deepEqual(winners(s), [1, 2]);
});

test("the trained network sees the same 22 inputs it was trained on", () => {
  const s = setup(4, {}, mulberry(1), seats(["computer", "computer", "computer", "computer"]));
  s.round = 3; s.roll = 5; s.pot = 120; s.scores = [100, 300, 50, 0]; s.banked = [false, true, false, false];
  s.opts.rounds = 10;
  const v = netInputs(s, 0);
  assert.equal(v.length, 22);
  assert.deepEqual(v.slice(0, 12).map((x) => +x.toFixed(4)), [0.12, 0.5, 0.3, 0.1, 0.5, 0.7, 0, 0.2, 0.5, -0.2, 0.1, 0]);
  assert.deepEqual(v.slice(12), [0.3, 0.05, 0, 0, 0, 0, 1, 1, 0, 0]);
  // 8 players: still 22 inputs
  const s8 = setup(8, {}, mulberry(1)); s8.roll = 4; s8.pot = 50;
  assert.equal(netInputs(s8, 3).length, 22);
});

test("hard bot: exact last round", () => {
  const s = setup(3, { rounds: 10 }, mulberry(1), seats(["computer", "computer", "computer"]));
  s.round = 10; s.roll = 6;
  s.scores = [500, 600, 100]; s.banked = [false, true, true]; s.pot = 90;
  assert.equal(POLICIES.hard(s, 0), false, "banking 590 can't beat 600: keep rolling");
  s.pot = 110;
  assert.equal(POLICIES.hard(s, 0), true, "last one in and 610 wins: bank");
  assert.equal(decide(s, 0, mulberry(1)), true);
});

test("full computer games at every table size finish", () => {
  for (let n = 2; n <= 8; n++) {
    const s = playGame(Array.from({ length: n }, (_, i) => ["easy", "medium", "hard"][i % 3]), { rounds: 10, seed: n });
    assert.ok(s.over); assert.equal(s.hist.length, 10);
  }
});

test("plays through the shared _online kit's local room (same game contract as online rooms)", async () => {
  const { createLocal } = await import("../js/online.js");
  const room = createLocal({ game, seats: ["human", "computer", "computer"], options: { rounds: 10, level: "hard" }, botDelayMs: 0, rng: mulberry(4), names: ["You", "Ava", "Ben"] });
  const errors = [];
  room.on("error", (e) => errors.push(e.message));
  room.start();
  const rng = mulberry(8);
  for (let i = 0; i < 4000 && !game.isOver(room.state); i++) {
    const s = room.state, who = game.toAct(s);
    let a = null;
    if (who.includes(0) && s.roller === 0) a = canBankNow(s) && rng() < 0.15 ? { t: "bank", rid: s.rid } : { t: "roll" };
    else if (who.includes(0) && canBankNow(s) && rng() < 0.2) a = { t: "bank", rid: s.rid };
    if (a) room.act(a, 0);
    else await new Promise((r) => setTimeout(r, 1));
  }
  room.close();
  assert.deepEqual(errors, []);
  assert.ok(game.isOver(room.state), "game finished");
  assert.equal(room.state.hist.length, 10);
  assert.equal(room.view(0).status, "finished");
});

test("Hard computers play their own games (they rarely end on the same score)", () => {
  let same = 0;
  const G = 120;
  for (let g = 0; g < G; g++) {
    const levels = ["medium", "hard", "hard", "hard"];        // like you + 3 Hard (the Daily game)
    const s = playGame(levels, { seed: 5000 + g });
    const h = s.scores.slice(1);
    if (new Set(h).size < h.length) same++;
  }
  assert.ok(same / G < 0.5, `Hard seats tied in ${(100 * same / G).toFixed(0)}% of games`);
});

test("guided game: the computers stay in during round 1", () => {
  const s = setup(3, { rounds: 10 }, mulberry(1), seats(["human", "computer", "computer"]));
  s.levels = ["hard", "tutor", "tutor"];
  s.roller = 0;
  const r = stacked([3, 4, 5, 5, 6, 2, 3, 3, 4, 5, 2, 5]);
  for (let k = 0; k < 4; k++) apply(s, s.roller, { t: "roll" }, r);
  assert.equal(s.pot, 176);
  assert.deepEqual(s.banked, [false, false, false], "nobody banked yet");
  apply(s, 0, { t: "bank", rid: s.rid });
  while (s.round === 1) apply(s, s.roller, { t: "roll" }, r);
  assert.deepEqual(s.hist[0].g, [176, 0, 0]);
  assert.ok(s.hist[0].bust);
});
