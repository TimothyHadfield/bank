# Bank: progress

## START HERE
Last updated 2026-10-27. Read this file, then CLAUDE.md, then docs/levels.md, docs/online.md and docs/rules-check.md. chat.md has the session log.
Live: https://timothyhadfield.github.io/bank/ · repo TimothyHadfield/bank (Pages, main / root).

## Goal right now
A real Bank dice game that beats the paid iOS app ("Bank – A Dice Game", Micah Wilson, $1.99): 2-8 players, good computers, pass-and-play, real-dice mode, rules + guided game, stats, install. Online rooms ON since 2026-10-27 (Tim: "enable it to all games for now and we can disable it later if it becomes too much").

## Status
| Part | State |
|---|---|
| Rules engine + bots tests | Done, 15 tests (`npm test`) |
| Computers Easy / Medium / Hard | Done, measured: docs/levels.md |
| Table look, sounds, animations | Done (_table 1.0.2, _fx) |
| Rules sheet + guided game | Done (_coach, 10 steps, stacked dice) |
| My stats, Elo, awards, Daily game | Done (_profile) |
| Install + offline | Done, pwa-check 18/18 |
| Real dice (pass-and-play) | Done: Roll opens a picker, tap the two faces |
| Online rooms | ON (kit v2), ~440 writes / ~1,007 reads per game; two-phone real-Firestore test passed (docs/online.md) |
| Hub card, trainer link, PORTFOLIO row | Done |

## Authorized next steps
- (2026-10-27) Online switched on (Tim's go). Nothing else beyond upkeep.

## Standing instructions (Tim's words)
- "start building every single improvement you can think of after your competitor analysis."
- "For Online play, talk to me before you're going to set something up that requires anything more than the firebase system we already have set up or takes up a large portion of our free plan that we have."
- "I want to make our boardgames the best in every single metric we can."

## Traps
- Shared kit files are unchanged copies (list in CLAUDE.md). Fix them in the kit, not here.
- Bots must never use the game's rng (the Daily game gives everyone the same dice). Personal habits come from `unit(name, ...)` in js/bots.mjs.
- The engine's `normOptions` reads `DEFAULT_OPTIONS`; change the default there only.
- `node --test tests/` (a folder) fails on Windows here; use `npm test`.
- Bump `data-version` on js/pwa.js and the `?v=` numbers in index.html on each deploy.

## Decisions
- Rulebook (RulesPal) rules by default: anyone still in may bank at any time. The old trainer rule is the Settings switch "No banking before roll 3".
- 20 rounds by default (rulebook: "most play 20"); ties share the win.
- Computers decide inside each roll (one state change per roll), so online needs no extra writes for them.
- Medium = the Bank_Pro_AI v1 PPO net (checkpoint 4900) with an Easy-style round half the time. Hard = tuned rules (2p, jittered so two Hards don't tie), net + exact last round (3p+), a loose round 35% of the time from 5p. Numbers: docs/levels.md.
- Guided game: computers are level "tutor" (never bank round 1, so the 7 lesson shows).
- "Wait for me" is the default pace: the computers' rolls wait for your Roll tap.
- Real-dice mode only in pass-and-play; computers' rolls are typed in too and Skip is hidden.

## NOT verified
- A real iPhone (only WebKit at iPhone size), sound on a device, home-screen install on a device.
- Online rooms on two real iPhones (two headless WebKit phones on real Firestore only, 2026-10-27).

## Reviewer gaps left (Tim's calls or later)
- No undo in real-dice mode; BANK is disabled during the ~1 s roll animation; no 5-round option; no shared leaderboard; the first-time offer covers the tab bar; phase line during the bust animation.

## Rejected / parked
- ~~Rollout search for Hard~~: measured no better than the rule set (2p 47.3% vs 47.3%, 4p 52.0% vs 54.7%), and slow.
- ~~Sharpened net, pot nerve, rules-only Hard at 3p+~~: measured weaker or more exploitable (docs/levels.md).
- ~~Porting the v2 MCTS net~~: needs search at play time; the v1 net plus tuned rules were enough.
