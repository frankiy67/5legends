# 5 Legends — Calibration de la compensation J2 (P2_START_FAITH)

> Branche `feat-ai-multistrat`, après DESECRATE_FAITH=1 + FAITH_WIN=16.
> Objectif : trouver le `P2_START_FAITH` donnant ~50-54 % de victoires J2 en
> miroir. **Mesure seule** — aucune carte / faction / profil IA touché. La
> valeur shippée du jeu reste **2** (le tournoi mesure 0 via le harnais).

## Sweep miroir — P2_START_FAITH ∈ {0, 1, 2}

10 000 parties CONTROL vs CONTROL en miroir par valeur, factions équilibrées.

| P2_START_FAITH | Win rate J2 (miroir) | Win rate J1 | Tour moyen | % horloge |
|---|---|---|---|---|
| 0 ◀ retenu | 73.4% | 26.4% | 10.63 | 1.6% |
| 1 | 76.0% | 23.8% | 10.36 | 1.3% |
| 2 | 78.8% | 21.2% | 10.06 | 1.1% |

**Pente** : ~2.7 pts de win rate J2 par point de Foi de départ (monotone).

## ⚠️ La cible 50-54 % est INATTEIGNABLE avec ce levier

Même à **P2_START_FAITH=0**, J2 gagne **73.4%** en miroir — loin de la cible. Pour atteindre ~52 %, il faudrait un départ d'environ **-7.9** (négatif → impossible). Le jeton de Foi n'est **pas** la cause principale du déséquilibre.

**Causes structurelles** (hors périmètre — décision de design/équilibrage humaine) :

- **J2 démarre à 5 cartes vs 4 pour J1** (`initGame`, src/game.js:716), et **pioche avant son 1ᵉʳ tour → 6 cartes en main** quand J1 agit encore à 4. Net avantage de cartes.
- **J2 joue en second** : il agit en RÉACTION au plateau de J1, atout fort dans une course de Foi.
- Le jeton de Foi (+2) n'ajoute qu'environ 5.4 pts par-dessus ces facteurs.

**Valeur retenue pour le tournoi : P2_START_FAITH = 0** (la plus proche de la cible, conformément au protocole) — étant entendu qu'elle **réduit** mais **ne règle pas** le déséquilibre.

## Tournoi complet avec P2_START_FAITH = 0

42 000 parties (5000/paire de stratégies, sièges équilibrés). Comparaison : baseline DESECRATE (P2_START_FAITH=2).

### Avantage J2 — mirror global

| | Baseline DESECRATE (P2=2) | Retenu (P2=0) | Δ |
|---|---|---|---|
| Victoires J2 en mirror | 78.0% | 72.4% | -5.6 pts |

### Win rate moyen par stratégie

| Stratégie | Baseline (P2=2) | Retenu (P2=0) | Δ | Profils battus |
|---|---|---|---|---|
| CONTROL | 52.1% | 52.9% | +0.8 pts | 3/3 |
| RUSH | 50.9% | 50.1% | -0.8 pts | 1/3 |
| GUARD | 48.5% | 49.0% | +0.5 pts | 1/3 |
| RAID | 47.7% | 46.9% | -0.7 pts | 1/3 |

### Matrice stratégie × stratégie (P2=0)

| ROW \ COL | CONTROL | RUSH | GUARD | RAID |
|---|---|---|---|---|
| **CONTROL** | — | 55.5% | 52.3% | 51.0% |
| **RUSH** | 44.5% | — | 46.4% | 59.4% |
| **GUARD** | 46.8% | 53.6% | — | 46.6% |
| **RAID** | 48.3% | 40.5% | 52.0% | — |

Baseline DESECRATE (P2=2) pour comparaison :

| ROW \ COL | CONTROL | RUSH | GUARD | RAID |
|---|---|---|---|---|
| **CONTROL** | — | 53.3% | 52.4% | 50.7% |
| **RUSH** | 46.6% | — | 48.4% | 57.6% |
| **GUARD** | 47.1% | 51.6% | — | 47.0% |
| **RAID** | 48.6% | 42.4% | 52.1% | — |

Relations dominantes (P2=0) :

- **CONTROL > RUSH** — 55.5% vs 44.5%.
- **CONTROL > GUARD** — 52.3% vs 46.8%.
- **CONTROL > RAID** — 51.0% vs 48.3%.
- **GUARD > RUSH** — 53.6% vs 46.4%.
- **RUSH > RAID** — 59.4% vs 40.5%.
- **RAID > GUARD** — 52.0% vs 46.6%.

### Longueur & horloge

| | Baseline (P2=2) | Retenu (P2=0) | Δ |
|---|---|---|---|
| Tour moyen (paires strat.) | 10.02 | 10.66 | +0.65 |
| % horloge T18 (paires) | 4.1% | 5.6% | +1.5 pts |

### Faction × stratégie (meilleure faction par stratégie, vs CONTROL)

| Stratégie \ Faction | yokai | norse | egyptian | greek | aztec | Meilleure |
|---|---|---|---|---|---|---|
| **CONTROL** | 47.3% | 69.0% | 55.0% | 38.8% | 39.8% | norse (69.0%) |
| **RUSH** | 38.0% | 51.2% | 53.8% | 39.3% | 36.0% | egyptian (53.8%) |
| **GUARD** | 42.5% | 70.0% | 55.8% | 33.0% | 34.8% | norse (70.0%) |
| **RAID** | 48.8% | 71.0% | 50.0% | 38.8% | 38.0% | norse (71.0%) |

## Verdict

- **Déséquilibre J2 réglé ?** **NON.** P2_START_FAITH=0 fait passer le J2 miroir de 78.0% à 72.4% (-5.6 pts), encore **très au-dessus** de la cible 50-54 %. Le levier est trop faible ; la cause est structurelle (cartes + tour de jeu).
- **Triangle préservé ?** **OUI** — **CONTROL** reste au-dessus (bat les 3), et le cycle `RUSH>RAID>GUARD` entre les profils conçus subsiste. Abaisser la Foi de départ de J2 **ne casse pas** la structure stratégique.
- **Norse toujours dominant ?** non — norse reste la meilleure faction pour la plupart des stratégies.
- **CONTROL toujours au-dessus ?** **OUI** (bat les 3 profils conçus, 52.9% moyen).

**Conclusion.** Le déséquilibre J2 **n'est pas réglable** en jouant sur `P2_START_FAITH` seul (la cible est hors d'atteinte, même à 0). Mais varier ce levier **ne déstabilise pas le triangle** : CONTROL reste au sommet, le sous-cycle RPS persiste, norse reste fort. Un vrai rééquilibrage J1/J2 nécessite une **décision de design** sur les facteurs structurels (taille de main de départ 4 vs 5, pioche du 1ᵉʳ tour) — hors périmètre de mesure.

> Mesure seule — toute décision d'équilibrage (compensation J2, cartes, factions) reste humaine. La valeur shippée du jeu est inchangée (P2_START_FAITH=2).

---
*Généré par `tools/ai_report_p2.js` depuis `p2_sweep_results.json` + `ai_tournament_results_P2.json` + `..._DESECRATE.json`.*
