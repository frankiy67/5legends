# Rapport de stabilisation — Brique 6 (`feat-gameplay-v2`)

Objectif : rendre le jeu **jouable et stable**. Retrait des PV joueurs, puis
boucle audit → fix → retest jusqu'à **0 crash sur 1000 parties**. Aucun
équilibrage : on corrige les bugs, pas le gameplay.

**Verdict : objectif atteint.** 1000 parties consécutives → **0 crash, 0
non-terminaison, 0 erreur logique dure**. Toutes les parties concluent.

---

## Phase A — Retrait des PV joueurs (revert brique 2)

Commit : `7f49be4` *revert: retrait PV joueurs + invocation mineure (PHASE A)*

- Constante `PLAYER_HP` retirée ; `player.hp` reste **vestigial** (init 25, écrit
  par des effets de cartes — vol de vie/soin/dégâts directs — mais sans rôle de
  victoire/visage/affichage, comme l'état post-C3).
- Attaque au visage → no-op (`doAttack 'player'`). Barre joueur plus ciblable
  (`resolvePlayerTarget` / `startAttackTargeting` / `renderAll`).
- Victoire = **Foi ≥ 16** uniquement, sinon **horloge T18** (plus haute Foi,
  sinon nul). Plus de 2e condition PV ni de départage PV (`checkVictory` /
  `checkVictoryBool`).
- IA : létal-visage (`pickAITarget`) + garde anti-prière (`aiPrayPhase`) retirés.
- Orbe PV retirée du HTML et de `renderPlayerBar`.
- Rubber-band des cycles : `isBehind` = **Foi seule** (plus de fallback PV).
- Pouvoir de dieu `guerison` → **`invocation_mineure`** (jeton 1/1 mal
  d'invocation, instant ; IA si ≤ 2 créatures ; grisé si terrain plein).
- Harnais (`sim_core.decideWinner`, `golden.js`) : PV retiré.
  `test_player_hp.js` supprimé ; `test_god_powers` adapté.
- Vérif : 200 (golden) + 1000 (sim), **0 crash, 0 victoire par PV** (994 Foi /
  6 horloge).

## Phase B — Audit (commit `52270b9`, `BUGS.md` + `tools/audit.js`)

Diagnostic sur **1200 parties** (16 combos de profils × 25 paires de factions) +
scan de logs + tally d'invariants. **0 crash, 0 violation dure** ; 171/171 cartes
définies + illustrées ; 1 cap non gérée.

## Phase C — Boucle de fix

Un seul bug **corrigeable sans décision de design** a été trouvé :

| Bug | Commit | Description |
|---|---|---|
| **L-1** | `8d79aff` | `aiMainPhase` bouclait sur un monstre impossible à invoquer (terrain plein) — `played=true` inconditionnel → l'IA gaspillait sa main phase et **ne jouait pas ses dieux/sorts**. Fix : exclure les monstres de `playable` quand `field.length>=6`. Symptôme `Field full — cannot summon!` : **6/partie → 0/partie**. Correction IA pure. |

Après fix : 1200 parties profil×profil → 0 crash, 0 violation dure.

---

## Run final de stabilité (commit `bd0ea85`)

```
1000 parties CONTROL vs CONTROL — 25 paires de factions × 40 graines
cycles + marché + pouvoirs de dieu actifs
CRASHES: 0 | NON-TERMINAISONS: 0 | VIOLATIONS DURES: 0
Fins : Foi 994 | horloge 6 | timeout 0
✓✓✓ STABLE
```

Invariants durs vérifiés (tous à 0) : `monstres>6`, `gems<0`, `NaN` stat,
`cDef<0` sur créature vivante, `faith` invalide/négatif, doublon d'objet,
`marché ≠ 5`.

Tests scriptés (tous verts) : `test_cycles` 16/16, `test_desecrate` 14/14,
`test_god_powers` 28/28, `test_market` 16/16.

---

## Problèmes RESTANTS — décisions humaines / validation visuelle

Conformément à la consigne, ces points **ne sont pas tranchés** (ils exigent une
décision de design ou une validation visuelle que je ne peux pas faire).

### Décisions de design (cf. `BUGS.md` D-1…D-4)

1. **Mot-clé « Malédiction » (`cap:'curse'`) inerte** — 8 cartes (`DOKKALFAR`,
   `FENRIR`, `SERPOPARD`, `SATYRE`, `PYTHON`, `CAMAZOTZ`, `AHUIZOTL`…) n'ont
   **aucun effet**. Intent ambigu : la créature est-elle *maudite* (meurt à 1
   dégât, gros malus sur des stats premium) ou *maudit-elle l'ennemi* ? À trancher
   avant d'implémenter (impact équilibrage fort).
2. **Effets vestigiaux PV** — vol de vie (`hasHeal`), soins de dieux (+3/+4 PV),
   sort « -4 dégâts au joueur » écrivent sur `player.hp` **sans impact** depuis
   le retrait des PV. À reconvertir (p. ex. vol de vie → +Foi) ou retirer.
3. **Karura (`entry_dmg4`)** partiellement inerte quand le terrain adverse est
   vide (visait le visage avant).
4. **Pièges (dieux face cachés) hors du cap de 6** — le cap de **6 monstres est
   respecté**, mais les dieux face cachés occupent des slots supplémentaires (le
   tableau `field` peut atteindre 7+). Incohérence : `playMonster` compte les
   pièges dans le cap, `playGod` non. Décider si les pièges comptent.

### Validation visuelle (UI/UX — non vérifiable en simulation)

- **Briques 1–5** : barre d'action fixe (choix Attaquer/Prier), dock des cycles à
  droite + invites Nuit/Tempête, bouton de pouvoir de dieu + écran de choix,
  panneau du marché à gauche (repli/glissement). Le golden ne teste que la logique
  IA ; **le rendu doit être validé en jouant**.
- Suppression de l'orbe PV : vérifier qu'aucun vide visuel ne subsiste dans les
  barres joueur.

---

## Observations — systèmes fragiles / interactions suspectes / suggestions

- **`aiMainPhase` reste fragile** : `played=true` est posé après *toute* tentative
  de jeu. Le fix L-1 couvre le cas « terrain plein », mais d'autres refus
  silencieux (carte contrée pendant la fenêtre de réaction, dieu sans cible)
  pourraient en théorie reproduire un gaspillage d'itérations. Garde-fou actuel :
  `safety < 12`. Suggestion : faire dépendre `played` du **succès réel** du jeu.
- **Cap souple de la main (S-1)** : la main peut monter à 8–9 en milieu de tour
  (Aube/Vision/`*_draw`) puis est rognée à 7 en fin de tour. Marché et pouvoir de
  dieu bloquent correctement à 7, mais les **effets de pioche ne plafonnent pas**.
  Cohérent à la Hearthstone, mais à clarifier (burn immédiat ? blocage ?).
- **Champ `player.hp` vestigial** : conservé pour compatibilité des effets de
  cartes. Tant que des cartes l'écrivent, il vaut mieux le garder (le retirer
  casserait ces effets → `NaN`). Le nettoyer proprement = décision de design
  (cf. point 2 ci-dessus).
- **Interactions croisées testées sans incident** : cycle + pouvoir de dieu au
  même tour, marché + gems + pouvoir + cartes, Ferveur + Zénith (+1 ATK), buffs
  temporaires (cycle/dieu) partageant `clearCycleBuffs` (retirés en fin de tour),
  Résurrection/Tempête + créatures à genoux. Aucun crash ni état incohérent sur
  1200+ parties.
- **Robustesse globale** : le moteur d'effets composable + les garde-fous
  (`checkVictoryBool` borné, `safety`, `field.length<6` dans la plupart des
  générateurs de jetons) rendent le jeu solide. Aucun crash sur ~3500 parties
  cumulées pendant l'audit.

---

*Branche `feat-gameplay-v2`. Outils : `tools/audit.js` (diagnostic), tests
`tools/test_*.js`, harnais `tools/golden.js` / `sim_core.js`. Golden recapturé
après chaque phase.*

---

# Brique 6B — Amélioration continue (bilan de session)

Boucle d'amélioration (corriger / équilibrer / enrichir). Détail commit-par-commit
dans `CHANGELOG.md`. Outil de mesure : `tools/balance.js`.

## Phase 1 — Corrections des 4 problèmes flaggés ✅
- **Malédiction** (`cap:'curse'*`, 10 cartes) implémentée : −1 ATK permanent à la
  créature touchée en combat.
- **Effets PV vestigiaux convertis** (plus aucune écriture active sur `player.hp`) :
  vol de vie → +1 DEF auto ; soin joueur → +2 DEF allié ; dégâts directs joueur →
  créature ennemie uniquement.
- **Karura** : plus de cas inerte (+1/+1 sans cible).
- **Pièges hors du cap de 6** (`monsterCount()` ; monstres endormis comptés, dieux
  face cachés exclus).

## Phase 2 — Équilibrage par les données ✅
Mesure CONTROL vs CONTROL, 2500 parties, sièges équilibrés.

| Faction | Avant | Après | Cible 45-55% |
|---|---|---|---|
| norse | 64.1% | **55.5%** | ~ (légèrement chaud) |
| egyptian | 56.4% | **54.0%** | ✅ |
| yokai | 45.6% | **47.2%** | ✅ |
| aztec | 43.6% | **46.9%** | ✅ |
| greek | 40.1% | **46.4%** | ✅ |

**Spread 24 pts → 9.1 pts.** 31 cartes ajustées (nerfs durabilité norse, buffs
greek/aztec). Aucune illustration retirée. norse reste structurellement un peu fort
(rendements décroissants sur les stats — piste future : ajuster son économie de Foi
plutôt que les stats).

## Run final de stabilité
```
1000 parties CONTROL vs CONTROL — CRASHES 0 | NON-TERM 0 | VIOLATIONS DURES 0
Fins : Foi 994 | horloge 6 | timeout 0   ✓✓✓ STABLE
```
Tests scriptés tous verts (cycles 16, desecrate 14, god_powers 28, market 16).

## Restant pour de futures passes (non traité cette session)
- **Pégase** : carte la plus efficace (eff 3.5, hurry+fervor) mais dans une faction
  désormais équilibrée (greek 46%). Pas OP au niveau faction ; à surveiller si greek
  remonte. Nerf possible (retirer `hurry` ou 3/4→2/4) si besoin.
- **Carte morte** : `Oracle de Delphes` (greek, spell) jouée 0% par l'IA (effet de
  réorganisation à faible valeur immédiate). Candidate à une refonte (twist Foi/grec).
- **Phase 3 (synergies intra-faction)**, **Phase 4 (simplification mots-clés /
  différenciation Hearthstone)**, **Phase 5 (amélioration des dieux — « Équipez »
  sous-joués)**, **Phase 6 (polish UI/CSS)** : non entamées. Nécessitent l'ajout de
  nouveaux handlers (Phase 3/5) — à faire par passes prudentes + re-mesure.
- norse 55.5% : un cran au-dessus de la cible ; envisager un ajustement de son
  économie de Foi (plutôt que d'autres nerfs de stats à rendement décroissant).
