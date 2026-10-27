# Online rooms: guard check (2026-10-27)

Online rooms use the shared `_online` kit on the existing Firestore project `th-board-games` (no new services).
They ship **switched OFF**. The code is in place; open the site with `?online=1` to try it.

## Why off: the Online guard
Guard: a busy day (10x normal) must stay under 10% of the free quota (50K reads, 20K writes per day).

How the game keeps writes low (in js/engine.mjs): the computers decide inside each roll, so one roll is one state
change; a bank carries the roll id, and a late bank is refused instead of retried.

Writes per action with the current `_online` kit: about 2 for a host action (room + host doc), about 4 for a guest
action (its move doc, its delete, then the host's 2). So it is not 1 write per roll.

| | Normal day | Busy day (10x) |
|---|---|---|
| Players / games | 30 players, ~7.5 games of 4, 20 rounds | 300 players, ~75 games |
| Actions per game | ~200 rolls + ~60 banks = ~260 | same |
| Writes | ~700 per game, so ~5,300 (26% of 20K) | ~53,000 (**265%**) |
| Reads | ~4 listeners per write, so ~21,000 (42% of 50K) | ~210,000 (**420%**) |

These numbers are reasoned from the kit's code, NOT measured. Even at exactly 1 write per roll, a busy day would be about
75 x 200 = 15,000 writes (75%), still far over the 10% guard. Bank is a fast game with many rolls, so the guard can only
be met with a different design (for example, one write per round with the dice drawn from a shared seed). That is Tim's call.

Turn on: change `ONLINE_ON` in js/app.mjs, or `localStorage['bank:online'] = '1'` on one device for testing.
