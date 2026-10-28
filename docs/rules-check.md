# Bank rules check

Source: the RulesPal Bank rulebook, https://rulespal.com/bank/rulebook (read 2026-10-27).

| Rule | Rulebook | This site |
|---|---|---|
| Players | 2 or more | 2 to 8 |
| Rounds | 10, 15 or 20 (most play 20) | 5 / 10 / 15 / 20, default 20 (5 = quick game, see below) |
| Rolls 1-3 | a 7 adds 70; doubles add their face value; else add the dice | same (`rollEffect` in js/engine.mjs) |
| Roll 4 on | a 7 ends the round, the pot is lost for everyone still in; doubles double the pot | same |
| Who rolls | dice pass to the next player still in | same |
| Banking | anyone still in may bank at any time, then sits out the round | same (default) |
| Round end | a 7 from roll 4, or everyone has banked | same |
| Ties | not covered | shared win |

## The house rule
The old trainer sites (bank-ai-trainer, bank-evolution) and the Bank_Pro_AI training environment do not let anyone
bank until 3 rolls are in. The rulebook has no such limit. This site follows the rulebook by default and offers the
old rule as the Settings switch "No banking before roll 3" (`opts.early = false`). **Tim's call** which is the default.

## Variants looked for (2026-10-28, wave 3)
Searched for real, documented Bank house rules. Sources: RulesPal rulebook, Thunderhive Games (the BANK app's site, FAQ),
Family Game Shelf (2024-08-06), nbird.dev/bank, the App Store pages of "Bank – A Dice Game" (id6473710589),
"Bank: Family Dice Game" (id6670350700) and "BANK! Dice Game" (id1596535693). All agree on the base rules above.
The only real variations found:
- **5 rounds** (quick game): offered by "Bank – A Dice Game" (5 / 10 / 15 / 20). Added to the Rounds choice; 20 stays the default.
- **No banking before roll 3**: the old trainer rule, already a Settings switch.
- Table habits that don't change the game in an app: two dice each vs two shared dice, a Banker who only keeps score,
  "say BANK by accident and you must bank" (Thunderhive FAQ). Real-dice mode covers the first two.
- Not found anywhere: a different bust number, different safe-roll counts, doubles doubling early. Not added (not real variants).

Tests: `tests/engine.test.mjs` "anyone still in may bank at any time" and "rulebook defaults" fail on the old rule
(measured 2026-10-27: 2 failures with the old default, 1 with the old `canBankNow`), pass on this code.
