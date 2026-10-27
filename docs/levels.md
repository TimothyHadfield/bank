# Computer levels: how they were measured

Measured 2026-10-27 with `node tools/measure-levels.mjs 400 20` (400 games per cell, 20 rounds, plain node, 394 s).

## The levels (js/bots.mjs)
- **Easy**: simple habits (banks at a personal pot size from the name hash).
- **Medium**: the trained network, but half its rounds (`MEDIUM_SLIP = 0.5`) it plays like Easy ("the odd careless round").
- **Hard**: 2 players = tuned rule set (`HARD`) with 25% per-round jitter so two Hards don't tie; 3–4 players = the network plus an exact last round; 5+ players = same, with an Easy-style round 35% of the time (a table of identical sharp players is exploitable: the last one still in gets free rolls).
- **tutor**: guided first game only. Never banks in round 1, so the teaching 7 shows up, then plays as Hard.
- Bots never use the game's dice rng (habits come from a name hash), so the Daily game's dice are the same for everyone.

## Method
Table difficulty: one outsider (Easy, the rule set, or the network, averaged) plays alone against n−1 computers of one level. A lower outsider win share means a harder table. Plus head to head: one higher level among the lower level.

## Final numbers
Outsider's average win share vs a table of one level (lower = harder):

| | 2p | 3p | 4p | 5p | 6p | 7p | 8p |
|---|---|---|---|---|---|---|---|
| Easy table | 59.9% | 52.9% | 49.4% | 44.3% | 41.6% | 40.5% | 38.6% |
| Medium table | 48.5% | 32.5% | 23.3% | 16.9% | 15.8% | 13.0% | 12.2% |
| Hard table | 45.2% | 26.4% | 18.0% | 17.5% | 14.7% | 13.3% | 12.2% |
| fair share | 50.0% | 33.3% | 25.0% | 20.0% | 16.7% | 14.3% | 12.5% |

Head to head (win share of the one):

| | 2p | 3p | 4p | 5p | 6p | 7p | 8p |
|---|---|---|---|---|---|---|---|
| 1 Hard among Medium | 55.0% | 43.8% | 33.5% | 22.6% | 21.8% | 16.0% | 11.3% |
| 1 Medium among Easy | 61.3% | 60.6% | 46.4% | 49.4% | 48.1% | 45.0% | 47.8% |

Reading: Medium beats Easy everywhere (by a lot from 3 players). Hard beats Medium clearly at 2–6 players; at 5p the Hard table is about as hard as the Medium table (17.5 vs 16.9), and at 8p one Hard is just under fair share (11.3 vs 12.5). That is why the help text says "narrowly with more".

## Ties
Before: two Hards at a 2-player table tied about 71–74% of games (same deterministic policy). The test `Hard ties` requires under 50%; the rules jitter of 0.25 cut 2-Hard ties to about 2–7%.

## Tried and rejected
- **Rollout search** for Hard: slow on a phone and no measurable gain over the network.
- **Sharpened network** (higher softmax k / offset): made identical Hard tables more exploitable, not harder.
- **Pot nerve** (bank earlier when far ahead): no gain.
- **Rules-only Hard at 3+ players**: weaker than the network at 3–4p.
- **Medium slip 0.35**: Medium table harder than the old Hard table at 5–8p; raised to 0.5.
