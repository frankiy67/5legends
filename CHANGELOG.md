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

### Phase 4 — Simplification & identité (anti-Hearthstone)
- **Oracle de Delphes refondu** (était 0 % joué) : `oracle_3` passe de « réordonne les 3 prochaines cartes » (inerte côté IA, sans impact board) à **DIVINATION** : révèle les 3 prochaines cartes, en met **1 en main** (l'IA prend la meilleure via `scoreCard`), **+1 Foi** (prophétie grecque → Ascension). Score IA ajouté (`+6/+8`). Modal humain réécrit en « pick-one ». Mesure : 104 résolutions / 120 miroirs grecs (vs 0). Greek stable à 50.7 %.
- `tools/check.js` : suit aussi les sorts (`Player N plays: X!`) pour mesurer l'Oracle.
- **Audit des mots-clés** (⚑ DESIGN — conclusion : ENRICHIR sans casser l'équilibre 45-55 %). Chaque mot-clé actif a été vérifié pour son lien Foi/Ascension et son éventuel clone Hearthstone :
  - **Ferveur** (10 cartes) → +1 Foi quand elle frappe une créature. Lien Ascension direct. CONSERVÉ.
  - **Égide** (2) → protège les fidèles à genoux de la profanation. Lien Foi fort. CONSERVÉ.
  - **Rapide** (11) ≈ Charge HS, MAIS twist Ascension réel : une créature Rapide peut **prier le tour où elle entre** (`canPray` L5148) → accélérateur d'Ascension, absent de HS. CONSERVÉ (pas de Foi brute ajoutée : aurait déséquilibré norse/aztec).
  - **Protection** (10) ≈ Provocation HS, mais conçue en **2 paliers** avec Égide (Protection = bouclier de corps ; Égide = bouclier de Foi anti-profanation). Identité de structure. CONSERVÉ.
  - **Malédiction** (10) → −1 ATK permanent en combat (fonctionnel depuis Phase 1). Pas un clone HS exact. CONSERVÉ.
  - **Endurance** (10) / **Double attaque** (10) → mots-clés de stats/résilience, intuitifs, sans doublon. CONSERVÉS.
  - **Décision** : aucun mot-clé n'est un clone HS « nu » ; injecter de la Foi dans Rapide/Endurance (comme suggéré) aurait re-creusé le spread durement acquis (Phase 3). Priorité au principe #7 (équilibre). Aucun doublon à fusionner.

### Phase 5 — Dieux impactants
- **Cause racine du sous-jeu des dieux trouvée** : le scoring IA (`scoreCard`, branche `god`) testait des **noms de cap périmés** (`'odin'`, `'thor'`, `'osiris'`, `'balder'`, `'create2'`) qui ne correspondaient plus aux vraies caps (`god_equalize_board_hand`, `god_sacrifice_opp_draw2`, `god_cancel_attack_heal`…). Résultat : Khonsu, Anubis, Set, Déméter, Odin, Thor, Freya, les 7 dieux « Équipez », etc. tombaient au score de base 3 → jamais joués malgré 70-93 % de victoire quand joués.
- **Scoring des dieux refondu** : ajout de règles couvrant les caps réelles — avantage de cartes (draft/scry/recherche/récup/pioches conditionnelles), jetons (Set scale légende, Déméter), copie (Anubis), **Équipements** (Ullr/Vali/Sekhmet/Artémis/Aphrodite/Hermès/Mictlantecuhtli), AoE (Tlaloc/Zeus), force/redirection (Ra/Xiuhtecuhtli), soin de masse (Susanoo), buffs offensifs (Athéna/Sarutahiko), échange (Dionysos), égalisation (Odin), défausse par légende (Hadès), Foi directe (Idunn). **Résultat : taux de jeu des dieux 10-21 % par faction** (avant : nombreux < 8 %, plusieurs 0-5 %). Liste des dieux morts quasi vidée.
- **Dial-down anti-norse** : scores des dieux de contrôle norse (Odin `equalize`, Thor `sacrifice_opp`, AoE) réduits pour limiter l'inflation norse causée par le meilleur jeu des dieux.
- **Buff dieux faibles aztèques** (aide la faction la plus basse + corrige des effets faibles) : **Ehecatl** c5→c4, **Xiuhtecuhtli** c5→c4. ⚑ DESIGN : les clauses « Bonus : … » de nombreux dieux (Ehecatl « détruisez les 2 », Anubis « au choix des terrains »…) ne sont **pas implémentées** (effet de base seul). Texte d'Ehecatl corrigé pour ne plus promettre le bonus. (Système de Bonus non recâblé : hors scope, risque d'équilibre.)
- **Mesure** (1500 parties, 0 crash) : norse 53.5 / egyptian 51.8 / greek 51.2 / yokai 48.0 / aztec 45.5 — spread 8.0 pts, toutes en 45-55 %. (Le scoring des dieux coûte ~2 pts de spread vs Phase 4 ; reste l'avantage structurel norse, traité en Phase 7.)

### Phase 7 — Fine-tuning norse (53.5 → 52.0)
- **Idunn** (c0, norse) : +2 → **+1 Foi**. C'était le principal gain de Foi INDIRECT norse (2/16 de l'Ascension gratuits en mono-légende), moteur de l'avantage structurel. Conforme au principe « réduire la Foi indirecte plutôt que les stats ».
- **Synergie de prière norse (Endurance)** : +2 → **+1 DEF** permanent au fidèle à genoux. Le +2 protégeait trop les moteurs de Foi norse de la profanation (avantage structurel indirect).
- **Mesure** (1500 parties, 0 crash) : egyptian 52.8 / norse 52.0 / greek 51.3 / yokai 47.7 / aztec 46.0 — **spread 6.8 pts**, toutes en 45-55 %. norse ramené dans sa cible 50-52. (baseline session 8.0 / brique 6B 9.1.)

### Phase 6 — Polish UI/CSS (analyse de code, rendu non visible)
- **Constat** : l'UI était déjà très animée (summon `card-summon`, mort `card-death`, dégâts `dmg-flash`+shake+float-dmg, dieu `godBurst`, cycle `cycle-transition`+`medallionFlash`, gemmes, sommeil, zénith…). Couleurs de faction définies (`--yokai/norse/egyptian/greek/aztec`). Fidèle à genoux : badge 🙏 + bordure « Foi » ; maudit : badge `.cursed` ; marché : panneau coulissant.
- **Ajouts (les manques réels) :**
  - **Halo de Foi à la prière** : `showPrayHalo()` — anneau doré + 🙏 qui s'élève au moment où un fidèle prie (gated hors simulation). Plus **aura de Foi persistante** douce sur les fidèles à genoux (`kneelAura`).
  - **Lisibilité buffs/debuffs** : stats `fc-atk`/`fc-def` colorées `up` (vert, au-dessus de la base : cycle, Kappa, sacrifice…) / `down` (gris désaturé + ▼, en-dessous : Malédiction, dégâts de combat). Avant, seul le buff de cycle (`boosted`) était signalé ; les dégâts/Malédiction étaient invisibles.
  - **Achat au marché** : `flyMarketToHand()` — la carte achetée glisse du marché vers la main (clone animé, entièrement défensif).
- CSS mort : non supprimé (rendu non vérifiable → risque de retirer des classes ajoutées dynamiquement ; conservé par prudence).
- Sim/équilibrage inchangés (toutes les additions sont cosmétiques et gated hors `mode==='sim'`).

## Bilan de session 6C
- **Run final : 1000 parties, 0 crash, 0 non-terminaison.**
- Win rates : norse 52.8 / egyptian 51.7 / greek 50.7 / yokai 47.3 / aztec 47.3 — **spread 5.5 pts** (toutes en 45-55 %).
- Progression du spread : 24 → 9.1 (fin 6B) → 8.0 (départ 6C) → **5.5** (fin 6C).
- Audit : 0 crash / 0 cap non gérée / 171 cartes illustrées (aucune retirée) / 0 PV vestigial.
- Phases 3 (synergies), 4 (Oracle + audit mots-clés), 5 (dieux jouables), 6 (UI), 7 (norse) livrées.
