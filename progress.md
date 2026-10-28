# Bank: progress

## START HERE
Last updated 2026-10-28 (wave 3). Read this file, then CLAUDE.md, then docs/levels.md, docs/online.md and docs/rules-check.md. chat.md has the session log.
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
| Wave 3 (2026-10-28) | Done: Videos tab in Rules (2 checked videos), 5-round quick game (+ short-game Hard), Undo in real-dice mode, "Keep screen on" switch, landscape setup in two halves, iPhone SE setup fits, first-visit offer above the tab bar |

## Authorized next steps
- (2026-10-27) Online switched on (Tim's go). Nothing else beyond upkeep.

## Standing instructions (Tim's words)
- "start building every single improvement you can think of after your competitor analysis."
- "For Online play, talk to me before you're going to set something up that requires anything more than the firebase system we already have set up or takes up a large portion of our free plan that we have."
- "I want to make our boardgames the best in every single metric we can."

## Traps
- **Kits re-copied 2026-10-28 (w3-sweep): game-coach 1.2.0 + game-pwa 1.4.0.** The first-visit offer uses `place:'auto', avoid:['[data-act="start"]']`; the old `--coach-offer-bottom` override is gone (measured: covers neither tab bar nor Start at 393×659, 320×568, 659×393; pwa-check 18/18).
- **Kits re-copied 2026-10-27 (kitfix):** game-coach 1.1.0 (rules tabs wrap instead of scrolling sideways; a note beside a tall target keeps title + 2 lines + buttons) and game-pwa 1.3.0 (`data-extra` on the pwa.js tag caches files loaded later by script). Copies stay byte-identical to `../_coach` / `../_pwa`.
- **`online` in js/app.mjs is the room controller, made on every load** (to resume a room), so it is never a sign of "in a room". `PWA.safeToReload` tests `snap` (the room snapshot) instead. The old `!online` test kept pwa-check at 16/18 (no auto-move to a new build ever); fixed 2026-10-27 kitsweep, 18/18 WebKit.
- **online.js cache stamp (2026-10-27):** every import of `js/online.js` uses `?v=a3d0418b`, the `_online` content stamp. After a re-copy: put the new stamp from `node ../_online/tools/stamp.mjs` there, bump the importing file's `?v=` (and pwa.js `data-version`), then `node ../_online/tools/stamp.mjs --check .` must say OK.
- Shared kit files are unchanged copies (list in CLAUDE.md). Fix them in the kit, not here.
- Bots must never use the game's rng (the Daily game gives everyone the same dice). Personal habits come from `unit(name, ...)` in js/bots.mjs.
- The engine's `normOptions` reads `DEFAULT_OPTIONS`; change the default there only.
- `node --test tests/` (a folder) fails on Windows here; use `npm test`.
- Bump `data-version` on js/pwa.js and the `?v=` numbers in index.html on each deploy.
- **Hard has its own mix for 5-round games** (`hardShort` in js/bots.mjs, `rounds <= 5`). Any change to Hard: measure both `node tools/measure-levels.mjs 400 20` and `... 1500 5`.
- Real-dice Undo keeps up to 30 earlier states in `G.undo` (saved with the game). Only local real-dice games have it.
- Video links: only 2 real Bank-dice-game videos exist (searched 2026-10-28; "Bank or Bust", "BANX", "Bang!" are other games).

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
- "Keep screen on" on a real iPhone (WebKit headless grants the wake lock; iOS home-screen apps only support it from iOS 18.4).
- A 5-round online room (no online test run with rounds 5; the engine path is the same as local).

## Reviewer gaps left (Tim's calls or later)
- BANK is disabled during the ~1 s roll animation; no shared leaderboard; phase line during the bust animation. (Undo in real-dice mode, 5 rounds and the offer over the tab bar were done 2026-10-28.)
- Tim's calls from wave 3: "Keep screen on" off by default; Undo is a word button in the top bar (the phase text shifts left once when it first appears); video list wording; 5 rounds offered though the rulebook says 10/15/20.

## Rejected / parked
- ~~Rollout search for Hard~~: measured no better than the rule set (2p 47.3% vs 47.3%, 4p 52.0% vs 54.7%), and slow.
- ~~Sharpened net, pot nerve, rules-only Hard at 3p+~~: measured weaker or more exploitable (docs/levels.md).
- ~~Made-up variants (other bust numbers, more safe rolls)~~: not documented anywhere (docs/rules-check.md), so not added.
- ~~Porting the v2 MCTS net~~: needs search at play time; the v1 net plus tuned rules were enough.
