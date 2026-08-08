# Fault-class coverage — protocol v1, engine 597a97c

A class answers YES iff at least one card with overall verdict USE has that class COVERED (lib/score.mjs coverageFor). Tier on a YES row is the min tier of the supporting canonical cells. Every row is detailed below the table: a NO row with the best status found across every card, a YES row with any card that also measured the class COVERED but is barred from carrying it by its own non-USE verdict.

| class | answer | detector(s) | tier | canonical rate |
|---|---|---|---|---|
| K1 | YES | safe_t_e_value, universal_inference_e_value | T1 | 1, 0.9875 |
| K2 | YES | safe_t_e_value | T1 | 0.6105 |
| K3 | NO | — | — | — |
| K4 | NO | — | — | — |
| K5 | NO | — | — | — |
| K6 | NO | — | — | — |

## Detail

- K2: also COVERED by group_average_e_value 0.9985 (verdict REFUSE — see card)
- K3: NO — best: family_D_spectral_e_detector NOT_POWERED 0 (verdict REFUSE)
- K4: NO — best: family_E_conformal_heldout NOT_POWERED 0.043 (verdict REFUSE)
- K5: NO — best: safe_t_e_value NOT_POWERED 0 (verdict USE)
- K6: NO — best: safe_t_e_value NOT_POWERED 0.0005 (verdict USE)
