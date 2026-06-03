# 5 Legends — Rapport du Grand Tournoi IA multi-stratégies

> Branche `feat-ai-multistrat`. Appareil de mesure construit sur l'IA Ascension
> existante : profil **CONTROL** = comportement historique **à l'identique**
> (golden byte-identique, cf. `tools/golden_check.js`). Les profils **RUSH /
> GUARD / RAID** sont **additifs**. Ce rapport **mesure** le triangle — il ne
> modifie **ni cartes ni factions** (décision humaine).

## Méthodologie

- Condition de victoire : **Foi ≥ 14** (Ascension), sinon **horloge céleste** au tour 18 (plus de Foi gagne ; égalité = nul).
- **5000 parties par paire de stratégies** (25 paires de factions × 100 graines × 2 sièges) → win rates **équilibrés en siège**.
- Faction × stratégie : 400 parties par cellule (vs CONTROL, 5 factions adverses × 40 graines × 2 sièges).
- Total : **42 000 parties** simulées en 351.8s (RNG seedé, déterministe).

## Verdict triangle

**Une stratégie domine : RUSH.** Elle bat les trois autres profils (siège équilibré). Aucun cycle pierre-feuille-ciseaux clair ne se referme autour d'elle.

| Stratégie | Win rate moyen (vs les 3 autres) | Profils battus |
|---|---|---|
| RUSH | 61.5% | 3/3 |
| CONTROL | 52.3% | 2/3 |
| GUARD | 45.4% | 0/3 |
| RAID | 39.8% | 0/3 |

## Matrice stratégie × stratégie

Win rate de la stratégie en **ligne** contre celle en **colonne** (siège équilibré, toutes factions). Diagonale = mirror (cf. plus bas).

| ROW \ COL | CONTROL | RUSH | GUARD | RAID |
|---|---|---|---|---|
| **CONTROL** | — | 46.1% | 54.5% | 56.3% |
| **RUSH** | 53.8% | — | 58.2% | 72.6% |
| **GUARD** | 44.8% | 41.8% | — | 49.7% |
| **RAID** | 43.1% | 27.2% | 49.2% | — |

Relations dominantes (win rates réels, hors nuls) :

- **RUSH > CONTROL** — 53.8% vs 46.1%.
- **CONTROL > GUARD** — 54.5% vs 44.8%.
- **CONTROL > RAID** — 56.3% vs 43.1%.
- **RUSH > GUARD** — 58.2% vs 41.8%.
- **RUSH > RAID** — 72.6% vs 27.2%.
- **GUARD ≈ RAID** — 49.7% vs 49.2% (quasi-nul).

## Longueur & horloge céleste par appariement

| Appariement | Parties | Tour moyen | % horloge | % nuls |
|---|---|---|---|---|
| CONTROL vs RUSH | 5000 | 6.79 | 0.0% | 0.0% |
| CONTROL vs GUARD | 5000 | 11.00 | 5.7% | 0.6% |
| CONTROL vs RAID | 5000 | 11.27 | 8.2% | 0.6% |
| RUSH vs GUARD | 5000 | 7.59 | 0.0% | 0.0% |
| RUSH vs RAID | 5000 | 9.48 | 0.9% | 0.2% |
| GUARD vs RAID | 5000 | 12.22 | 13.0% | 1.1% |
| CONTROL (mirror) | 1000 | 9.69 | 1.5% | 0.3% |
| RUSH (mirror) | 1000 | 5.75 | 0.0% | 0.0% |
| GUARD (mirror) | 1000 | 12.46 | 14.9% | 1.0% |
| RAID (mirror) | 1000 | 12.55 | 15.0% | 1.6% |

## Biais de siège (mirrors A vs A)

En mirror, toute asymétrie de win rate vient du **siège** (le 2ᵉ joueur démarre à +2 Foi).

| Stratégie | % victoire P1 | % victoire P2 | Tour moyen | % horloge |
|---|---|---|---|---|
| CONTROL | 21.4% | 78.3% | 9.69 | 1.5% |
| RUSH | 19.1% | 80.9% | 5.75 | 0.0% |
| GUARD | 25.9% | 73.1% | 12.46 | 14.9% |
| RAID | 23.0% | 75.4% | 12.55 | 15.0% |

## Faction × stratégie

Win rate de chaque (faction jouant la stratégie) **contre CONTROL** (factions adverses balayées, siège équilibré).

| Stratégie \ Faction | yokai | norse | egyptian | greek | aztec | Meilleure |
|---|---|---|---|---|---|---|
| **CONTROL** | 48.8% | 67.8% | 54.3% | 39.5% | 39.0% | norse (67.8%) |
| **RUSH** | 51.2% | 60.8% | 60.8% | 48.0% | 48.0% | norse (60.8%) |
| **GUARD** | 40.8% | 64.8% | 53.0% | 29.5% | 33.3% | norse (64.8%) |
| **RAID** | 43.5% | 64.3% | 43.5% | 33.5% | 32.0% | norse (64.3%) |

## Observations

- **Avantage du 2ᵉ joueur très marqué** : en mirror, P2 gagne **76.9%** des parties (Foi de départ +2). Les matrices stratégie×stratégie sont équilibrées en siège, donc non contaminées par ce biais — mais c'est un signal d'équilibrage (décision humaine).
- **RUSH** est la stratégie la plus forte du tournoi (win rate moyen 61.5%) — la prière directe est la source de Foi la plus rentable, et la course en exploite la cadence maximale.
- **RAID** ferme la marche (win rate moyen 39.8%) et souffre surtout face à **RUSH (27.2%)** : la profanation **ne retire pas** la Foi déjà priée (verrouillée immédiatement). RAID ne nie que la Foi *future* d'un corps — insuffisant face à un adversaire qui agenouille un nouveau corps chaque tour.
- **Aucun gagnant net** parmi GUARD / RAID (0 profil battu chacun). En particulier **GUARD ≈ RAID** (49.7% vs 49.2%, quasi-nul) : l'attrition de GUARD et le déni de RAID se neutralisent.
- **Cadence** : RUSH raccourcit drastiquement les parties (tour moyen ~5.75) ; GUARD/RAID les allongent (~12.46) et déclenchent l'horloge céleste bien plus souvent (cf. table de longueur).
- Chaque profil **joue réellement sa stratégie** (validé en Phase 2, `tools/ai_validate.js`) : RUSH prie + tôt/souvent, GUARD perd moins de fidèles et pose + de gardiennes, RAID profane/tue/déclenche la Ferveur + souvent que CONTROL.

---
*Généré par `tools/ai_report.js` depuis `tools/ai_tournament_results.json`. Aucune carte ni faction n'a été modifiée.*
