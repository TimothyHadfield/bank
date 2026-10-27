// Measure the computer levels (plain node). Usage: node tools/measure-levels.mjs [games] [rounds]
// The app gives every computer at a table the same level, so a level is judged by how hard its whole table is to beat:
// one outside player (Easy, a fixed-target player, the trained network) sits with n-1 computers of that level.
// Lower win share for the outsider = harder table. Plus head to head: one Hard among Mediums, one Medium among Easys.
import { POLICIES, net, rules } from "../js/bots.mjs";
import { tournament } from "./sim.mjs";
POLICIES.target = (s, me, r) => rules(s, me, r);   // a sensible fixed-target player (the tuned rule set)
POLICIES.net = (s, me) => net(s, me);              // the trained network as trained
const games = +(process.argv[2] || 400), rounds = +(process.argv[3] || 20);
const pct = (x) => (100 * x).toFixed(1) + "%";
const t0 = Date.now();
const sizes = [2, 3, 4, 5, 6, 7, 8];
const refs = ["easy", "target", "net"];
const rows = [];
for (const lv of ["easy", "medium", "hard"]) {
  rows.push(`| ${lv} table | ${sizes.map((n) => {
    const r = refs.map((ref) => tournament([ref, ...Array(n - 1).fill(lv)], games, { rounds })[0]);
    return pct(r.reduce((a, b) => a + b) / r.length);
  }).join(" | ")} |`);
}
rows.push(`| fair share | ${sizes.map((n) => pct(1 / n)).join(" | ")} |`);
const h2h = [];
for (const [a, b] of [["hard", "medium"], ["medium", "easy"]]) h2h.push(`| 1 ${a} among ${b} | ${sizes.map((n) => pct(tournament([a, ...Array(n - 1).fill(b)], games, { rounds })[0])).join(" | ")} |`);
console.log(`${games} games per cell, ${rounds} rounds, ${((Date.now() - t0) / 1000).toFixed(0)} s\n`);
console.log("Outsider's average win share against a table of one level (lower = harder table):\n");
console.log(`| | ${sizes.map((n) => n + "p").join(" | ")} |\n|---|${sizes.map(() => "---").join("|")}|\n${rows.join("\n")}`);
console.log(`\nHead to head (win share of the one, fair share as above):\n\n| | ${sizes.map((n) => n + "p").join(" | ")} |\n|---|${sizes.map(() => "---").join("|")}|\n${h2h.join("\n")}`);
