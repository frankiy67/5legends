# PILIERS À DESIGNER — synthèse pour Frank

Ce fichier est LE point d'entrée au retour de Frank. Session autonome du
2026-07-04 : construction de l'ossature technique testée des 4 piliers,
**zéro décision de design créatif prise**. Chaque pilier vit sur SA branche
depuis `v1-unification` (aucun merge entre elles) :

| Pilier | Branche | État | Test |
|---|---|---|---|
| 1 — Frise du Destin, moteur complet | `feat-frise-moteur` | ✅ terminé | `node tools/test_omens.js` → 14/14 scénarios + 500 parties vertes |
| 2 — Combat télégraphié (flag) | `feat-telegraph` | ✅ terminé | `node tools/test_telegraph.js` → A/B 1000+1000, 4/4 gates ✅ |
| 3 — Harnais Ferveur/Égide | `feat-ascension-harnais` | ✅ terminé | `node tools/test_faith.js` → 12/12 scénarios + 500 parties vertes |
| 4 — Dieux-régents (moteur) | `feat-regents` | ✅ terminé | `node tools/test_regents.js` → 15/15 scénarios + 500 parties vertes |

## Journal d'avancement

- **2026-07-04 (session autonome, début)** : lecture moteur v5 + briques A→D, plan 4 branches posé.
- **2026-07-04** : PILIER 1 TERMINÉ sur `feat-frise-moteur` (2 commits P1a/P1b).
  test_omens : 14/14 scénarios contre-jeu ✅, 500 parties, 0 crash, tick exact,
  10,10 tours (≤ 12). Batterie complète verte (faith 6,2 % asc · all_cards ·
  preview 202 · arena · factions gate ±4pp ✅). Golden dédié régénéré (4/200
  parties divergent — effet documenté du « retard directionnel », round-trip ✅).
- **2026-07-04** : PILIER 2 TERMINÉ sur `feat-telegraph` (2 commits T1/T2).
  Flag TELEGRAPH=false défaut, golden byte-identique vérifié. A/B 1000+1000 :
  mode ON 0 crash, 10,26 tours, 20 123 frappes déclarées ; rapport complet dans
  la section pilier 2. Batterie standard verte flag off.
- **2026-07-04** : PILIER 3 TERMINÉ sur `feat-ascension-harnais` (2 commits
  H1/H2). Flag FAITH_PLACEHOLDERS=false défaut (0 porteur, décision Q1
  respectée), golden byte-identique vérifié. 12/12 scénarios Ferveur/Égide ✅,
  batterie 500 parties placeholders ON : Ascension 11,0 %, 10,70 tours,
  0 crash, Ferveur ×88, Égide ×501. Batterie standard verte flag off.
- **2026-07-04** : PILIER 4 TERMINÉ sur `feat-regents` (2 commits R1/R2).
  Moteur intronisation/détrônement + démo 3 dieux sous REGENTS_DEMO=false,
  golden byte-identique vérifié. 15/15 scénarios ✅, 500 parties démo ON :
  143 intronisations, 3 détrônements contestés, 180 auras, 0 crash, 10,25
  tours. Batterie standard verte flag off.
- **2026-07-04 — FIN DE SESSION : LES 4 PILIERS SONT LIVRÉS.** Comment
  vérifier : sur chaque branche, `node tools/test_<pilier>.js` (vert, code
  sortie 0) ; le golden de chaque branche est vérifié (byte-identique partout
  sauf `feat-frise-moteur`, régénéré et documenté). Aucun merge entre les
  branches ; `v1-unification` ne porte que ce fichier de synthèse.

---

# PILIER 1 — Frise du Destin, moteur complet (`feat-frise-moteur`)

## Ce qui est construit (plomberie, sans design)

1. **Ticks directionnels** (`setCyclePhase(newCycle, srcLabel, {backward})`) :
   - *avancer* le Cycle (Xolotl, Kairos, Zeus-boss, fin de ronde…) rapproche
     les présages d'un tick (comportement brique D inchangé) ;
   - *retarder* le Cycle (Toki-Onna `entry_cycle_delay1`, Urd
     `exit_cycle_delay1`) fait désormais **reculer** l'horloge d'un tick → les
     présages sont **repoussés** (avant : un retard les RAPPROCHAIT, à
     contre-sens de l'intuition) ;
   - *figer* (Horae, Heh, Amaterasu-boss) = aucune transition → protège (déjà le cas).
   - Seule la datation des présages est signée ; les autres effets de
     changement de phase (Esquive, Endurance, Éclipse, Momie) sont identiques
     dans les deux directions.
2. **Contre-jeu moteur** — trois verbes appelables par de futures cartes
   (`src/game.js`, section « FRISE MOTEUR (P1) ») :
   - `destroyOmen(ref, srcLabel)` — efface un présage de la Frise ;
   - `stealOmen(ref, newOwnerP, srcLabel)` — change le propriétaire (l'effet
     se résout du point de vue du voleur) ;
   - `shiftOmen(ref, delta, srcLabel)` — décale de ±N transitions ; ramené à
     échéance → re-daté au tick courant et résolu au prochain point de
     résolution awaité (invariant « tick exact » préservé).
   - Chaque présage porte un `id` interne (jamais sérialisé par le golden).
   - **Aucune carte ne porte ces verbes** : plomberie pure + logs + rendu
     (la Frise HUD reflète vol/décalage/destruction automatiquement).
3. **Golden dédié branche** : le retard directionnel change le jeu par défaut
   (4/200 parties, toutes norse/yokai = porteurs de retard). Golden régénéré
   1×, round-trip vérifié, gate factions ±4pp ✅ (yokai +2,0 · norse −1,9 ·
   egyptian −3,0 · greek +3,6 · aztec −0,8).

## Ce qui est testé (chiffres)

`node tools/test_omens.js` — 2 étages :
- 6 scénarios dirigés déterministes (14 assertions) : détruire jamais déclenché,
  voler résolu pour le voleur, décaler +2 déclenché à t0+3 exactement, échéance
  immédiate au tick courant, retarder repousse d'un tick (échéance intacte),
  figer ne tick pas. **14/14 ✅**
- Batterie 500 parties avec **fuzz de contre-jeu** (LCG seedé indépendant du
  RNG du jeu) : 112 détruits · 91 volés · 112 décalés en pleine partie.
  **0 crash, 0 hors-tick, 0 présage détruit déclenché, 10,10 tours ≤ 12.**

## DÉCISIONS DE DESIGN QUI T'ATTENDENT (pilier 1)

1. **Les 10 vrais présages** : les 5 cartes placeholder (`omen_dmg1`, 1 dégât
   aléatoire) restent le seul contenu. Quels effets, coûts, raretés, noms ?
   (Parking d'idées de la brique D toujours valable : présages par faction,
   présages cachés 🔮, présage conditionné au zénith…)
2. **Qui porte le contre-jeu ?** Les trois verbes existent, aucun porteur.
   Propositions à trancher :
   - détruire = plutôt anti-tempo cher ou réponse commune pas chère ?
   - voler = signature d'une faction (yokai « illusion » ? egyptian « destin » ?) ;
   - décaler = naturel chez les temporels existants (Seshat, Skuld, Kairos ont
     déjà l'identité « temps ») — en faire des double-usages ou des cartes neuves ?
3. **Coût du décalage** : `shiftOmen` accepte n'importe quel ±N — quelle
   amplitude autoriser sur carte (±1 ? ±2 ?) ?
4. **Visibilité** : un présage volé change de couleur sur la Frise (badge p1/p2).
   Veux-tu un état « caché » (badge anonyme) ? Le moteur ne le gère pas encore —
   à demander si le design le retient.
5. **Frise à 5 cases** : après un retard, un présage peut sortir de l'horizon
   affiché (distance > 5) ; il revient quand il se rapproche. OK visuellement,
   ou veux-tu un indicateur « au-delà de l'horizon » ?

---

# PILIER 2 — Combat télégraphié (`feat-telegraph`)

## Ce qui est construit (derrière flag, jeu par défaut INCHANGÉ)

- `TELEGRAPH = false` + `setTelegraph(v)` (`src/game.js`). **Golden vérifié
  byte-identique flag off** ; le harnais prouve en plus que OFF ne déclare
  JAMAIS une frappe (compteur = 0 sur 1000 parties).
- Flag ON : `doAttack` devient une **déclaration** (`declareStrike`) — l'action
  de la créature est consommée, la frappe est posée dans `G.strikes` (références
  de cartes, pas d'index) et se résout à la **sortie de la phase Combat**
  (`resolveStrikes`, awaitée côté IA pour le déterminisme, fire-and-forget côté
  humain comme les présages D1).
- **Élan (`hurry`) = frappe instantanée** (ancien comportement conservé), la 2e
  frappe de HIT reste instantanée (partie de la résolution).
- **Fenêtre de réaction** : en PvE, pause Anytime/ESPACE existante avant la
  première résolution (le défenseur humain peut répondre).
- **Fizzle propre** : attaquant mort/endormi/ensablé/parti → la frappe se
  dissipe ; cible-créature disparue → se dissipe ; frappe déclarée sur le
  visage → reste sur le visage.

## Ce qui est testé — LE RAPPORT A/B POUR TON ARBITRAGE

`node tools/test_telegraph.js` — mêmes 1000 parties seedées dans chaque mode :

| Mesure | OFF (instantané) | ON (télégraphié) |
|---|---|---|
| Durée moyenne | 10,45 tours | 10,26 tours |
| Victoires P1 | 481 (48,1 %) | 485 (48,5 %) |
| Victoires P2 | 517 (51,7 %) | 512 (51,2 %) |
| · par PV | 91,0 % | 87,8 % |
| · par Ascension | 7,0 % | 9,8 % |
| · à l'horloge | 1,8 % | 2,1 % |
| Frappes déclarées | 0 | 20 123 |
| Crashs / inachevées | 0 / 0 | 0 / 0 |

Winrates factions : yokai 50,8→49,8 · norse 48,5→51,3 (+2,8pp) · egyptian
53,0→52,3 · greek 48,5→48,0 · aztec 48,8→48,0. Aucun basculement majeur ;
l'Ascension monte un peu (+2,8pp) car des frappes fizzlent (cibles déjà mortes)
→ un poil moins de dégâts convertis.

## DÉCISIONS DE DESIGN QUI T'ATTENDENT (pilier 2)

1. **LE choix : garder instantané ou passer télégraphié ?** Les chiffres
   ci-dessus sont là pour ça. Techniquement les deux modes sont stables.
2. **Redirection des frappes au visage** : sémantique v1 = une frappe déclarée
   sur le visage reste sur le visage même si un Rempart arrive en réaction.
   Alternative à trancher : le Rempart intercepte (plus « défensif », plus
   complexe à lire).
3. **IA télégraphe-consciente** : l'IA actuelle déclare comme elle attaquait
   (elle peut empiler 2 frappes sur une cible qui n'en demandait qu'une). Si tu
   retiens le mode, il faudra une passe IA (prévoir un profil ou une correction
   de `pickAITarget` en mode déclaratif).
4. **UI de la frappe posée** : aujourd'hui, log seulement (🏹). Design à faire :
   marqueur visuel sur l'attaquant/cible, flèche fantôme, possibilité d'annuler
   sa propre déclaration ?
5. **Réaction de l'IA** : le défenseur IA ne réagit pas aux frappes du joueur
   (quelles cartes jouerait-elle en réaction ? → design).

---

# PILIER 3 — Harnais Ferveur/Égide (`feat-ascension-harnais`)

## Ce qui est construit (harnais, PAS de cartes shippées)

- Le moteur Ferveur/Égide de la brique A (A3) était là mais orphelin (0
  porteur, décision Q1). Ce pilier le PROUVE sans le shipper :
- `FAITH_PLACEHOLDERS = false` + `setFaithPlaceholders(v)` : quand un harnais
  l'active, `buildDeck` injecte 2 cartes [PLACEHOLDER] ×2 copies dans chaque
  deck (59 → 63 cartes, harnais uniquement) :
  - **Zélote [PLACEHOLDER]** 2/2 coût 2 — `fervor` ;
  - **Gardien votif [PLACEHOLDER]** 1/4 coût 2 — `egide`.
- **Le jeu par défaut est inchangé** : flag off = deck 59, zéro porteur,
  golden vérifié byte-identique.

## Ce qui est testé (chiffres)

`node tools/test_faith.js` — 2 étages :
- 12 scénarios dirigés **12/12 ✅** : Ferveur +1 Foi en attaquant une créature,
  1×/tour, re-déclenche après reset de tour, RIEN au visage ; Égide protège
  l'agenouillé (l'IA ne le cible jamais), ne protège plus agenouillée/endormie,
  protection rétablie debout ; boucle prière → +1 Foi → improfanable.
- Batterie 500 parties placeholders ON : **Ascension 11,0 % ∈ [5,40]**,
  10,70 tours ≤ 13, 0 crash, Ferveur déclenchée 88× (0,18/partie), Égide a
  bloqué un ciblage 501×. Winrates : yokai 43,5 · norse 50,5 · egyptian 51,5 ·
  greek 52,0 · aztec 52,0 (l'écart yokai est un artefact de l'échantillon deck
  +4 cartes — ce n'est PAS l'état shippé, aucun gate factions n'est requis ici).

## DÉCISIONS DE DESIGN QUI T'ATTENDENT (pilier 3)

1. **Les vraies cartes Ferveur/Égide** — LE design que tu voulais garder :
   quels porteurs, combien par faction, quels coûts ? (Rappel de ta propre
   option pré-notée en Q1, toujours dispo dans UNIFICATION_STATUS.md : les 6
   « Offrande pure » v5 + Griffon + dieux Idunn/Osiris/Mayahuel versions Foi +
   Égide sur Cerbère/Minotaure/jetons Déméter, Hestia v5 préservée.)
2. **Ferveur sur la riposte ?** Le moteur actuel : attaque seulement (pas de
   Foi en défendant). À confirmer ou élargir.
3. **Sanctuaire** (`_sanctuary`, Mayahuel branche) : le flag moteur existe
   (immunise 1 fidèle de la Profanation) mais n'a pas de harnais dédié — il
   n'a de sens qu'avec la carte qui le pose. À designer avec les porteurs.
4. **Équilibre des jauges** : avec seulement 4 cartes placeholder/deck,
   l'Ascension passe de 6,2 % → 11,0 %. Les vrais porteurs bougeront ce taux :
   la cible [5,40] % te laisse de la marge, mais garde un œil sur FAITH_WIN=16
   (constante paramétrable si tu veux ralentir/accélérer la course).

---

# PILIER 4 — Dieux-régents (`feat-regents`)

## Ce qui est construit (moteur seul + démo sous flag)

- **Moteur** (`src/game.js`, section « DIEUX-RÉGENTS (pilier 4) ») — inerte
  par défaut (aucun régent n'existe hors harnais) :
  - `G.regents` : un TRÔNE par phase du Cycle (0..4) ;
  - `enthroneGod(p, card, phaseIdx, auraId)` — intronise un dieu sur une
    phase ; trône occupé = CONTESTÉ (l'occupant est détrôné d'abord) ; phase
    déjà active = aura immédiate ;
  - `dethroneGod(phaseIdx, srcLabel)` — retire l'aura si active, envoie le
    dieu au cimetière de son propriétaire ;
  - hook `regentsOnTransition` dans `setCyclePhase` : aura continue appliquée
    à l'ENTRÉE de la phase du régent, retirée à la SORTIE ; auras « d'entrée »
    déclenchées à chaque traversée ;
  - rendu : couronne 👑 (couleur du propriétaire) sur la Frise HUD.
- **Démo technique** sous `REGENTS_DEMO=false` (activée par le harnais
  seulement) : 3 dieux coût 2 — choix ARBITRAIRE, pas un choix de design —
  s'intronisent sur le zénith de leur faction au lieu de leur one-shot :
  Kairos→midi `aura_atk1` (+1 ATK alliés pendant la phase), Skuld→ténèbres
  `aura_faith1` (+1 Foi par traversée), Tonatiuh Renaissant→crépuscule
  `aura_draw1` (pioche 1 par traversée). Marqués [PLACEHOLDER].
- **Aucun des 15 dieux faibles n'a été converti** (consigne respectée).

## Ce qui est testé (chiffres)

`node tools/test_regents.js` :
- 15 scénarios dirigés **15/15 ✅** : aura appliquée à l'entrée/retirée à la
  sortie/re-appliquée à la traversée suivante ; intronisation sur phase active
  = aura immédiate ; détrônement = aura retirée + cimetière + trône vide ;
  trône contesté = bascule d'aura P1→P2 ; auras d'entrée (Foi, pioche)
  déclenchées à chaque traversée.
- Batterie 500 parties démo ON : **0 crash**, 10,25 tours ≤ 13,
  143 intronisations, 3 détrônements (miroirs contestés), 180 entrées d'aura.

## DÉCISIONS DE DESIGN QUI T'ATTENDENT (pilier 4)

1. **Quels dieux deviennent régents ?** La liste des 15 dieux faibles à
   convertir (ou pas) t'appartient. Le moteur accepte n'importe quel dieu +
   n'importe quelle phase + n'importe quelle aura enregistrée.
2. **Design des vraies auras** : le registre `REGENT_AURAS` accepte deux
   formes — continue (`apply`/`remove`) et à l'entrée (`enter`). Les 3 démos
   sont volontairement plates (+1 ATK, +1 Foi, pioche 1).
3. **Comment détrône-t-on ?** Aujourd'hui : seule la contestation (introniser
   sur un trône occupé) détrône, + `dethroneGod` appelable par de futures
   cartes. À designer : cartes de détrônement dédiées ? coût ? le détrôneur
   gagne-t-il quelque chose (Foi de Profanation divine ?) ?
4. **Choix de la phase** : la démo intronise d'office sur le zénith de la
   faction. Alternative : le joueur choisit la phase (le modal
   `pickCyclePhase` existe déjà et serait réutilisable tel quel).
5. **Sémantique fine** (constantes techniques actuelles, à confirmer) :
   l'aura continue ne s'applique qu'aux créatures PRÉSENTES à l'entrée de
   phase (un monstre posé en cours de phase n'en profite pas) ; le dieu qui
   règne n'est ni ciblable ni récupérable (hors du jeu jusqu'au détrônement).
