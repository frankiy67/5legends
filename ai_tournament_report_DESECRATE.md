# 5 Legends — Expérience DESECRATE_FAITH=1 + FAITH_WIN=16

> Branche `feat-ai-multistrat`. **Expérience ciblée** : deux changements de
> règles (une variable à la fois) pour tester si le **triangle RPS se ferme**.
> Rapport original (FAITH_WIN=14, sans desecrate) conservé dans
> `ai_tournament_report.md`. Aucune carte / faction / profil IA n'a été modifié.

## Changements testés

1. **FAITH_WIN : 14 → 16** (Ascension plus lointaine).
2. **DESECRATE_FAITH = 1** : profaner (tuer) une créature **agenouillée** donne +1 Foi à l'adversaire (le tueur). Tous chemins de mort ; Sanctuaire reste immunisé.

**Hypothèse** : RAID>RUSH (Foi-des-kills), GUARD>RAID (Égide), RUSH>GUARD (vitesse) → cycle qui se referme.

## Méthodologie

- 5000 parties / paire de stratégies (25 paires de factions × 100 graines × 2 sièges), sièges équilibrés.
- Faction × stratégie : 400 parties / cellule (vs CONTROL).
- Total : **42 000 parties** (378.7s, RNG seedé). Baseline : 42 000 parties.

## Verdict

**Résultat nuancé.** **CONTROL** bat encore **les trois profils conçus** (dominante globale), mais un **cycle RPS émerge bel et bien entre RUSH/GUARD/RAID** : `RUSH>RAID>GUARD`. ⚠️ Ce cycle tourne **dans le sens INVERSE** de l'hypothèse (qui prédisait `RAID>RUSH>GUARD>RAID`) : ici **RUSH>RAID**, pas l'inverse.

- **RAID > RUSH ?** **NON** — RAID vs RUSH = **42.4%** (baseline : 27.2%).
- **Cycle RPS complet ?** **OUI** (RUSH>RAID>GUARD).
- **Hypothèse (RAID>RUSH>GUARD>RAID)** : **INFIRMÉE** (RAID>RUSH 42.4%, RUSH>GUARD 48.4%, GUARD>RAID 47.0%).

## Win rate moyen par stratégie — expérience vs baseline

| Stratégie | Baseline (14, sans desecrate) | Expérience (16 + desecrate) | Δ | Profils battus |
|---|---|---|---|---|
| CONTROL | 52.3% | 52.1% | -0.2 pts | 3/3 |
| RUSH | 61.5% | 50.9% | -10.7 pts | 1/3 |
| GUARD | 45.4% | 48.5% | +3.1 pts | 1/3 |
| RAID | 39.8% | 47.7% | +7.8 pts | 1/3 |

## Matrice stratégie × stratégie (expérience)

Win rate de la **ligne** vs la **colonne** (siège équilibré, toutes factions).

| ROW \ COL | CONTROL | RUSH | GUARD | RAID |
|---|---|---|---|---|
| **CONTROL** | — | 53.3% | 52.4% | 50.7% |
| **RUSH** | 46.6% | — | 48.4% | 57.6% |
| **GUARD** | 47.1% | 51.6% | — | 47.0% |
| **RAID** | 48.6% | 42.4% | 52.1% | — |

Pour comparaison, la matrice **baseline** :

| ROW \ COL | CONTROL | RUSH | GUARD | RAID |
|---|---|---|---|---|
| **CONTROL** | — | 46.1% | 54.5% | 56.3% |
| **RUSH** | 53.8% | — | 58.2% | 72.6% |
| **GUARD** | 44.8% | 41.8% | — | 49.7% |
| **RAID** | 43.1% | 27.2% | 49.2% | — |

Relations dominantes (expérience, win rates réels hors nuls) :

- **CONTROL > RUSH** — 53.3% vs 46.6% _(baseline : 46.1% vs 53.8%)_.
- **CONTROL > GUARD** — 52.4% vs 47.1% _(baseline : 54.5% vs 44.8%)_.
- **CONTROL > RAID** — 50.7% vs 48.6% _(baseline : 56.3% vs 43.1%)_.
- **GUARD > RUSH** — 51.6% vs 48.4% _(baseline : 41.8% vs 58.2%)_.
- **RUSH > RAID** — 57.6% vs 42.4% _(baseline : 72.6% vs 27.2%)_.
- **RAID > GUARD** — 52.1% vs 47.0% _(baseline : 49.2% vs 49.7%)_.

## Avantage du 2ᵉ joueur (mirror) — dilué par FAITH_WIN=16 ?

| | Baseline (14) | Expérience (16) | Δ |
|---|---|---|---|
| Victoires P2 en mirror | 76.9% | 78.0% | +1.0 pts |

Détail mirror par stratégie (expérience) :

| Stratégie | % P1 | % P2 | Tour moyen | % horloge |
|---|---|---|---|---|
| CONTROL | 20.9% | 79.1% | 10.09 | 1.3% |
| RUSH | 17.8% | 82.2% | 6.11 | 0.0% |
| GUARD | 23.5% | 75.4% | 13.01 | 15.3% |
| RAID | 23.7% | 75.1% | 12.98 | 13.6% |

## Longueur & horloge céleste

| | Baseline (14) | Expérience (16) | Δ |
|---|---|---|---|
| Tour moyen (paires strat.) | 9.72 | 10.02 | +0.29 |
| % parties à l'horloge T18 (paires) | 4.6% | 4.1% | -0.6 pts |

Par appariement (expérience) :

| Appariement | Parties | Tour moyen | % horloge | % nuls |
|---|---|---|---|---|
| CONTROL vs RUSH | 5000 | 7.12 | 0.0% | 0.1% |
| CONTROL vs GUARD | 5000 | 11.43 | 5.5% | 0.6% |
| CONTROL vs RAID | 5000 | 11.63 | 6.5% | 0.7% |
| RUSH vs GUARD | 5000 | 7.81 | 0.0% | 0.1% |
| RUSH vs RAID | 5000 | 9.46 | 0.1% | 0.0% |
| GUARD vs RAID | 5000 | 12.67 | 12.3% | 1.0% |
| CONTROL (mirror) | 1000 | 10.09 | 1.3% | 0.0% |
| RUSH (mirror) | 1000 | 6.11 | 0.0% | 0.0% |
| GUARD (mirror) | 1000 | 13.01 | 15.3% | 1.1% |
| RAID (mirror) | 1000 | 12.98 | 13.6% | 1.2% |

## Faction × stratégie (expérience, vs CONTROL)

| Stratégie \ Faction | yokai | norse | egyptian | greek | aztec | Meilleure |
|---|---|---|---|---|---|---|
| **CONTROL** | 48.5% | 66.0% | 54.3% | 40.5% | 40.8% | norse (66.0%) |
| **RUSH** | 42.8% | 52.3% | 55.0% | 42.3% | 39.5% | egyptian (55.0%) |
| **GUARD** | 41.5% | 65.0% | 55.8% | 36.3% | 35.5% | norse (65.0%) |
| **RAID** | 48.8% | 69.5% | 50.0% | 40.0% | 40.0% | norse (69.5%) |

## Observations & conclusion

- **RAID** : win rate moyen 39.8% → 47.7% (+7.8 pts). Face à RUSH : 27.2% → 42.4%.
- **RUSH** : 61.5% → 50.9% (-10.7 pts).
- **Avantage J2 en mirror** : 76.9% → 78.0% (+1.0 pts).
- **Horloge T18** : 4.6% → 4.1% des parties (FAITH_WIN=16 retarde l'Ascension).
- **Triangle** : un cycle RPS **apparaît** entre les profils conçus — `RUSH>RAID>GUARD` — mais **CONTROL** le surplombe (bat les 3).
- **Effet de la Foi-des-kills** : RAID (+7.8 pts) et GUARD (+3.1 pts) montent, RUSH s'effondre (-10.7 pts) — profaner ses propres fidèles agenouillés en masse **nourrit l'adversaire**, ce qui pénalise la course. Mais CONTROL (qui prie ET combat de façon équilibrée) **capitalise le mieux** sur la nouvelle source de Foi.

**Hypothèse INFIRMÉE.** Le cycle **précis** prédit (`RAID>RUSH>GUARD>RAID`) **ne se forme pas** : RAID ne bat pas RUSH (42.4%, contre 27.2% au baseline — nette amélioration mais insuffisante). Fait notable : un cycle RPS émerge tout de même entre les trois profils conçus, mais dans le **sens inverse** (`RUSH>RAID>GUARD`), et **CONTROL le surplombe** en battant les trois. La Foi-des-kills rééquilibre fortement RAID/GUARD vs RUSH (RUSH 61.5%→50.9%) sans installer la hiérarchie cyclique espérée.

> Mesure seule — toute décision d'équilibrage (cartes, factions, valeur de DESECRATE_FAITH, seuil de Foi) reste humaine.

---
*Généré par `tools/ai_report_desecrate.js` depuis `tools/ai_tournament_results_DESECRATE.json` + `..._baseline.json`.*
