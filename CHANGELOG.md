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
