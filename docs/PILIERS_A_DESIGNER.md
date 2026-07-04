# PILIERS À DESIGNER — synthèse pour Frank

Ce fichier est LE point d'entrée au retour de Frank. Session autonome du
2026-07-04 : construction de l'ossature technique testée des 4 piliers,
**zéro décision de design créatif prise**. Chaque pilier vit sur SA branche
depuis `v1-unification` (aucun merge entre elles) :

| Pilier | Branche | État | Test |
|---|---|---|---|
| 1 — Frise du Destin, moteur complet | `feat-frise-moteur` | ✅ terminé | `node tools/test_omens.js` → 14/14 scénarios + 500 parties vertes |
| 2 — Combat télégraphié (flag) | `feat-telegraph` | ✅ terminé | `node tools/test_telegraph.js` → A/B 1000+1000, 4/4 gates ✅ |
| 3 — Harnais Ferveur/Égide | `feat-ascension-harnais` | ⏳ à faire | `node tools/test_faith.js` étendu |
| 4 — Dieux-régents (moteur) | `feat-regents` | ⏳ à faire | `node tools/test_regents.js` |

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

# PILIER 3 — Harnais Ferveur/Égide (`feat-ascension-harnais`) — À FAIRE

*(sera rempli quand le pilier sera terminé)*

---

# PILIER 4 — Dieux-régents (`feat-regents`) — À FAIRE

*(sera rempli quand le pilier sera terminé)*
