# Online rooms (on since 2026-10-27)

Online rooms use the shared `_online` kit (v2, `js/online.js`, byte-identical copy) on the existing Firestore project
`th-board-games` (no new services). Friend rooms by 5-letter code only; empty seats at start become computers.

Tim, 2026-10-27: "I don't think my games are going to have many users for a long time. I think it'll be okay to enable
it to all games for now and we can disable it later if it becomes too much".

## Cost (measured)
Kit cost harness (`_online/test/cost.mjs`, v2 batching), one game: **~440 writes, ~1,007 reads**.
Free plan: 20K writes / 50K reads a day, so roughly 45 games a day before writes run out.

How the game keeps writes low (in js/engine.mjs): the computers decide inside each roll, so one roll is one state
change; a bank carries the roll id, and a late bank is refused instead of retried.

## Checked
`node tests/ui.online.mjs <url> [outDir]`: two headless iPhone-size WebKit phones make and join a room (host, friend,
one computer, 10 rounds) and tap the real Roll / Bank buttons to the end on real Firestore. 2026-10-27: passed in
3.2 min, same final scores on both phones, no console errors.

## Turn off
Set `ONLINE_ON = false` in js/app.mjs (or `localStorage['bank:online'] = '1'` still forces it on one device for testing).
