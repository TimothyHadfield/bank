# Bank rules check

Source: the RulesPal Bank rulebook, https://rulespal.com/bank/rulebook (read 2026-10-27).

| Rule | Rulebook | This site |
|---|---|---|
| Players | 2 or more | 2 to 8 |
| Rounds | 10, 15 or 20 (most play 20) | 10 / 15 / 20, default 20 |
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

Tests: `tests/engine.test.mjs` "anyone still in may bank at any time" and "rulebook defaults" fail on the old rule
(measured 2026-10-27: 2 failures with the old default, 1 with the old `canBankNow`), pass on this code.
