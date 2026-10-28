// Try Hard mixes for the 5-round quick game (plain node). Usage: node tools/try-short.mjs [games] [rounds]
// Prints the table-difficulty row (outsider's win share, lower = harder) for each candidate, plus 1 candidate among Medium.
import { POLICIES, net, rules, finalRound, HARD, unit } from "../js/bots.mjs";
import { tournament } from "./sim.mjs";
const games = +(process.argv[2] || 600), rounds = +(process.argv[3] || 5);
const easy = POLICIES.easy, medium = POLICIES.medium;
POLICIES.target = (s, me, r) => rules(s, me, r);
POLICIES.net = (s, me) => net(s, me);
const nm = (s, i) => (s.names && s.names[i]) || "seat" + i;
const withFinal = (p) => (s, me, r) => { const f = finalRound(s, me); return f !== null ? f : p(s, me, r); };
const slip = (p) => withFinal((s, me) => (unit(nm(s, me), s.round, 3) < p ? easy(s, me) : net(s, me)));
const C = {
  medium,
  medFinal: withFinal(medium),
  slip65: slip(0.65),
  slip80: slip(0.8),
  mixRules: withFinal((s, me, r) => (unit(nm(s, me), s.round, 3) < 0.5 ? rules(s, me, r, { ...HARD, jitter: 0.25 }) : net(s, me))),
};
const sizes = [2, 3, 4, 5, 6, 7, 8], refs = ["easy", "target", "net"];
const pct = (x) => (100 * x).toFixed(1);
for (const [k, p] of Object.entries(C)) {
  POLICIES.cand = p;
  const tab = sizes.map((n) => { const r = refs.map((ref) => tournament([ref, ...Array(n - 1).fill("cand")], games, { rounds })[0]); return pct(r.reduce((a, b) => a + b) / r.length); });
  const h2h = sizes.map((n) => pct(tournament(["cand", ...Array(n - 1).fill("medium")], games, { rounds })[0]));
  console.log(k.padEnd(9), "table", tab.join(" "), "| 1 among Med", h2h.join(" "));
}
