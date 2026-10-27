// Measure the computer levels against each other (plain node). Usage: node tools/measure-levels.mjs [games] [rounds]
import { tournament } from "./sim.mjs";
const games = +(process.argv[2] || 2000), rounds = +(process.argv[3] || 20);
const pct = (x) => (100 * x).toFixed(1) + "%";
const t0 = Date.now();
const rows = [];
for (const [a, b] of [["hard", "medium"], ["hard", "easy"], ["medium", "easy"]]) {
  const r = tournament([a, b], games, { rounds });
  rows.push(`| ${a} vs ${b} (2 players) | ${pct(r[0])} | ${pct(r[1])} |`);
}
for (const lv of ["hard", "medium", "easy"]) {
  const others = lv === "hard" ? "medium" : lv === "medium" ? "hard" : "medium";
  const r = tournament([lv, others, others, others], games, { rounds });
  rows.push(`| 1 ${lv} vs 3 ${others} (fair share 25%) | ${pct(r[0])} | ${pct((r[1] + r[2] + r[3]) / 3)} each |`);
}
{
  const r = tournament(["hard", "hard", "medium", "medium", "easy", "easy"], games, { rounds });
  rows.push(`| 6 players: 2 hard, 2 medium, 2 easy (fair 16.7%) | hard ${pct((r[0] + r[1]) / 2)} | medium ${pct((r[2] + r[3]) / 2)}, easy ${pct((r[4] + r[5]) / 2)} |`);
}
{
  const r = tournament(["hard", "medium", "medium", "medium", "medium", "medium", "medium", "medium"], games, { rounds });
  rows.push(`| 8 players: 1 hard vs 7 medium (fair 12.5%) | ${pct(r[0])} | ${pct(r.slice(1).reduce((a, b) => a + b) / 7)} each |`);
}
console.log(`${games} games per line, ${rounds} rounds, ${((Date.now() - t0) / 1000).toFixed(0)} s\n`);
console.log("| Match | first | other |\n|---|---|---|\n" + rows.join("\n"));
