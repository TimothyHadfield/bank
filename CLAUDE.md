# Bank (dice game site)

Live: https://timothyhadfield.github.io/bank/ (repo TimothyHadfield/bank, Pages from main / root).
Read progress.md first. Tim's global rules and Code Projects/CLAUDE.md apply.

- Plain static site, no build step. `npm test` runs the engine tests (node --test); `node tools/pwa-check.mjs` runs the offline/update check.
- Rules engine: js/engine.mjs (pure, shared by local and online play). Computers: js/bots.mjs (+ js/net-weights.mjs, the trained PPO net from Bank_Pro_AI).
- Shared kit copies are UNCHANGED copies: js/table.js, fx.js, online.js, coach.js, profile.js, pwa.js, sw.js, css/table.css, coach.css, profile.css, tools/make-icons.mjs, tools/pwa-check.mjs. Don't edit them here; update from the kit.
- Rulebook rules are the default (bank any time). The "no banking before roll 3" rule is an option only.
- Online rooms are ON since 2026-10-27 (Tim's go; cost in docs/online.md). `ONLINE_ON = false` in js/app.mjs turns them off. `tests/ui.online.mjs` is the two-phone real-Firestore check (not in `npm test`).
- Bump `data-version` on the pwa.js script tag in index.html (and the ?v= on css) on every deploy that changes files.
