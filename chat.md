# Bank: session log

## 2026-10-27: site built from nothing (builder for the portfolio manager, "improve" wave)
- **Asked:** a real Bank game site (Tim: "start building every single improvement you can think of after your competitor analysis"; online only on the existing Firebase within the free-plan guard).
- **Built:** new repo TimothyHadfield/bank on Pages. Rules engine (rulebook default, the old "no bank before roll 3" as an option); 2-8 players, vs computers or pass-and-play; Easy / Medium (the Bank_Pro_AI PPO net ported to JS) / Hard; table look (_table), sounds (_fx), rules sheet + 10-step guided game (_coach), My stats + Elo + awards + Daily game (_profile), install + offline (_pwa); real-dice mode for a real table; online rooms built on _online but OFF (guard: docs/online.md).
- **Also:** Hub card (Hub `8f98da5`), link from the AI trainer (`7af2661`), PORTFOLIO row.
- **Verified:** `npm test` (engine, 13 tests; the rule tests fail on the old rule), `node tools/pwa-check.mjs` 18/18 WebKit, WebKit shots at 320 / 393 / landscape 659x393 / 1280 / 1440 with no overflow or console errors, live check of `7284b58`.
- **Open:** Tim's calls (progress.md); online design.
- **Piece 2 (same day):** levels re-tuned after measuring that Hard was no harder than Medium with 3+ players and two Hards tied 71% (docs/levels.md, 400 games per cell); real-dice picker; guided game fixed (computers had banked the 176 before the 7); reviewer fixes (320px seats, stepper, Start above the tab bar, game-over "won"). `npm test` 15/15, pwa-check 18/18.
