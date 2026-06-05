# CHANGELOG — Brique 6B (amélioration continue) · `feat-gameplay-v2`

Format : `[hash]` description. Frank lit ce fichier pour comprendre chaque
changement et pouvoir revert. Les **décisions de design majeures** sont marquées
`⚑ DESIGN`.

## Phase 1 — Corrections des 4 problèmes flaggés

- `[a233619]` **Phase 1** — 4 fixes flaggés :
  - **Malédiction** (`cap:'curse'*`, 10 cartes) : inflige −1 ATK permanent (min 0) à la créature touchée en combat.
  - **Effets PV vestigiaux convertis** : vol de vie → +1 DEF auto (créature) ; soin joueur → +2 DEF à un allié ; dégâts directs joueur → créature ennemie uniquement. Plus aucune écriture active sur `player.hp`.
  - **Karura** : sans cible, +1/+1 permanent (au lieu d'effet inerte).
  - **Pièges hors cap** : `monsterCount()` (monstres, dont endormis ; exclut dieux face cachés). Les pièges ne comptent plus dans le cap de 6.

## Phase 2 — Équilibrage par les données
- `[cd9def9]` **Rééquilibrage factions** (mesure `tools/balance.js`). Départ : norse 64% / greek 40% (spread 24 pts). 17 nerfs norse (durabilité), 9 buffs greek, 4 buffs aztec, 1 nerf egyptian (Griffon). **Résultat : norse 55.5 / egyptian 54.0 / yokai 47.2 / aztec 46.9 / greek 46.4** (spread 9.1 pts). Détail des stats dans le message de commit. norse reste légèrement chaud (avantage structurel, rendements décroissants sur les stats).

## Bilan de session
- Run final : **1000 parties, 0 crash, 0 erreur logique dure** (994 Foi / 6 horloge).
- Win rates factions : norse 55.5 / egyptian 54.0 / yokai 47.2 / aztec 46.9 / greek 46.4 (spread 9.1 pts).
- Phases 3–6 (synergies, simplification, dieux, UI) : documentées comme passes futures dans STABILISATION_REPORT.md.

## Brique 6C — Phases 3-6 (synergies, identité, dieux, UI)

### Phase 3 — Synergies intra-faction
- `[08e24a0]` **Synergies de prière + tribales/sacrifice** (`tools/check.js`). Chaque faction gagne ≥2 synergies claires ancrées dans son identité. Toutes touchent le système de Foi/Ascension.
  - **Synergies de prière** (`applyPrayerSynergy` dans `doPray`) : déclenchées quand une créature s'agenouille.
    - **Greek — Phalange sacrée** : prière en formation (≥2 autres grecs) → +1 Foi ; +1 Foi SUPPLÉMENTAIRE si un gardien Égide veille (structure + Égide).
    - **Norse — Endurance** : le fidèle norse à genoux gagne +2 DEF permanent (mur dur à profaner ; résilience).
    - **Egyptian — Connaissance** : prière avec ≥3 autres égyptiens → pioche 1 (1×/tour ; savoir/cycles).
    - **Yokai — Ruse** : la prière galvanise un autre yokai non agenouillé (+2 ATK ce tour ; manipulation).
  - **Yokai tribal — Kappa** : aura `passive_yokai_buff` rendue FONCTIONNELLE (était inerte : seulement scorée par l'IA, jamais appliquée). À l'entrée, tes Yokai présents +1/+1 ; chaque Yokai entrant ensuite +1/+1 tant que Kappa vit.
  - **Aztec sacrifice** (`handleDeath` + `executeRitual`) : quand un vrai aztèque allié meurt (combat, Nuit, rituel, AoE), tes autres aztèques gagnent +1 ATK permanent. Le rituel déclenche désormais aussi ce bonus. Risque/récompense, all-in.
  - **Mesure** (1500 parties, 0 crash) : norse 53.2 / egyptian 51.2 / greek 49.8 / yokai 48.7 / aztec 47.2 — **spread 6.0 pts** (baseline 8.0, toutes en 45-55%). 1ʳᵉ itération (greek prière Égide seule, + prière aztèque) avait creusé greek à 42% → phalange ≥2 grecs + retrait prière aztèque = correction.
