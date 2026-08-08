# Fault-class coverage — protocol v1, engine 0bc6537

A class answers YES iff at least one card with overall verdict USE has that class COVERED (lib/score.mjs coverageFor). Tier on a YES row is the min tier of the supporting canonical cells. Every row is detailed below the table: a NO row with the best status found across every card, a YES row with any card that also measured the class COVERED but is barred from carrying it by its own non-USE verdict.

| class | answer | detector(s) | tier | canonical rate |
|---|---|---|---|---|
| K1 | YES | safe_t_e_value, universal_inference_e_value | T1 | 1, 0.9875 |
| K2 | YES | safe_t_e_value | T1 | 0.6105 |
| K3 | YES | spectral_bet_e_process | T1 | 0.654 |
| K4 | YES | point_tail_bet_e_value | T1 | 0.978 |
| K5 | YES | safe_t_e_value | T1 | 0.9995 |
| K6 | NO | — | — | — |

## Detail

- K2: also COVERED by group_average_e_value 0.9985 (verdict REFUSE — see card)
- K6: NO — best: safe_t_e_value, universal_inference_e_value (2-way tie) NOT_POWERED 0.0005 (verdict USE)
