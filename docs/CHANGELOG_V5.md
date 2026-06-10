# CHANGELOG V5 — branche fix-audit-v5

Tous les changements de gameplay, cartes et équilibrage, avec chiffres de validation.

---

## 1.1 — Équilibre P1/P2 + ré-équilibrage des factions

### Moteur
- **Fix bug IA** : `aiCombatPhase` vérifiait `G.players[2].field[i]` (codé en dur) au lieu de
  `G.players[p].field[i]` → P1 n'exécutait que 48 % du volume d'attaques de P2 en simulation.
- **Rampe de gems symétrique** : `maxGems = min(10, G.turn)` pour les deux joueurs
  (avant : P2 jouait chaque ronde avec +1 gem).
- **Coin étalé** : P2 reçoit +1 gem temporaire à ses 2 premiers tours (compense le tempo du 1ᵉʳ joueur).
- **Ragnarök** : bonus d'entrée norse réduit de +3/+3 à **+2/+2** (Endurance conservée).

### Validation : winrate P1 **47,5 %** sur 1000 parties seedées (baseline : 19,6 %) ✅

### Ajustements de cartes (±1 par itération, 3 itérations)
| Carte | Avant | Après |
|---|---|---|
| **Norse (nerfs)** | | |
| Eikthyrnir | cost 1 | cost 2 |
| Sleipnir | 7 ATK | 6 ATK |
| Kraken | cost 6 | cost 7 |
| Tanngrisnir | 5 ATK | 4 ATK |
| Surt | 10 DEF | 9 DEF |
| Ymir | 9 DEF | 8 DEF |
| Hildisvini | 8 DEF | 7 DEF |
| Idi | 10 DEF | 9 DEF |
| Fenrir | 10 DEF | 9 DEF |
| Niddhog | 5 DEF | 4 DEF |
| Garm | 6 ATK | 5 ATK |
| Huginn | cost 2 | cost 3 |
| Dokkalfar | 7 DEF | 6 DEF |
| Jörmungandr | 8 DEF | 7 DEF |
| Eitri | 4 ATK | 3 ATK |
| Draugr | 4 ATK | 3 ATK |
| **Greek (buffs)** | | |
| Satyre | 3 DEF | 4 DEF |
| Hippocampe | 4 ATK | 5 ATK |
| Centaure | 3 DEF | 4 DEF |
| Ladon | 4 DEF | 5 DEF |
| Sirènes | 2 ATK | 3 ATK |
| Python | 2 ATK | 3 ATK |
| Lion de Némée | 3 ATK | 4 ATK |
| Ophiotaurus | 4 DEF | 5 DEF |
| Scylla | 4 ATK | 5 ATK |
| Cyclope | 6 ATK | 7 ATK |
| Echidna | cost 8 | cost 7 |
| Cerbère | 5 DEF | 6 DEF |
| Harpie | 5 ATK | 6 ATK |
| Minotaure | 4 ATK | 5 ATK |
| Gorgone | 6 DEF | 7 DEF |
| Hydre | cost 6 | cost 5 |
| Charybde | 5 DEF | 6 DEF |
| Pégase | 3 ATK | 4 ATK |
| **Aztec (buffs)** | | |
| Ahuizotl | 1 ATK | 2 ATK |
| Ocelotl | 1 DEF | 2 DEF |
| Kaqkoj | 2 ATK | 3 ATK |
| Nagual | 3 ATK | 4 ATK |
| Chaneque | 2 ATK | 3 ATK |
| Camazotz | 1 ATK | 2 ATK |
| Ceuyatl | 3 DEF | 4 DEF |
| Tzi | 3 ATK | 4 ATK |
| Cipactli | 3 ATK | 4 ATK |
| Quetzal | 2 DEF | 3 DEF |
| Tlaltecuhtli | cost 7 | cost 6 |
| Otomitl | 6 ATK | 7 ATK |
| Xiuhcoatl | 8 ATK | 9 ATK |

### Validation factions : 500 parties (50 × 10 matchups, côtés alternés)
yokai **48,0 %** · norse **51,5 %** · egyptian **50,0 %** · greek **50,5 %** · aztec **50,0 %**
— toutes dans [45, 55] ✅ · 0 crash · 0 timeout


## 1.2 — buildDeck déterministe
- Suppression du `shuffle().slice(0,45)` qui coupait 9 cartes au hasard à chaque partie.
- Deck complet et fixe de **54 cartes** (40 monstres + 14 dieux). GAME_RULES.md mis à jour.
- Validation : factions 47,5–51,5 %, P1 47,9 % sur 1000, golden régénéré (P1 95/P2 105, 0 crash).

## 1.3 — Mulligan (flow Legends of Runeterra)
- L'overlay joueur existait (commit 6f2e2dd) ; ajouts v5 :
  - **Heuristique IA conforme spec** : garde les coûts ≤3 (objectif 3), remplace les coûts ≥5
    sauf s'il n'y en a qu'1, creuse en remplaçant les coûts 4 si <3 cartes cheap.
  - **Mulligan en mode 'sim'** : le golden master couvre désormais le vrai flow.
- Compensation P2 re-calibrée après mulligan (le mulligan changeait l'équilibre) :
  Coin +1 gem T1 + **pioche bonus au 2ᵉ tour de P2** (variantes mesurées : coin 1T → 53,9 %,
  coin 2T → 44,9 %, main 6 → 45,3 %, retenue → 49,2 %).
- Ajustements post-mulligan (itérations 4-5) : buffs yokai (Ningyo, Mujnina, Tanuki, Keukegen,
  Tsuchinoko, Ushi-Oni +1), aztec (Chullachaki, Teuzauhtototl, Huay Chivo, Izcoalt +1),
  egyptian (Abtu, Sphinx, Criosphinx, Hieracosphinx, Momie, Djinn +1) ; retours partiels
  greek (Hippocampe, Cyclope −1).
- **Validation finale Phase 1 (1000 parties)** : P1 **48,4 %** · yokai **50,8** · norse **47,5** ·
  egyptian **49,3** · greek **51,0** · aztec **51,5** — tous critères ✅ · 0 crash.

## 2.1 / 2.2 — Suppression Sand Up · Esquive remplace le RNG binaire
- Sand Up : 0 carte concernée (code mort supprimé). Flag `sanded` conservé pour
  Xipe Totec (immobilisation de masse) et Golem (cooldown) — badge « Immobilisé ».
- Bewitch : 0 carte concernée ; checks 50 % supprimés de l'IA.
- **ESQUIVE** (nouvelle cap déterministe) : première attaque subie par phase du Cycle
  rate ; recharge à chaque changement de phase ; badge 💨 ; portée par Sirènes
  (ex-coinflip_defense 50 %).
- Validation (2.3) : 171/171 caps avec handler, couverture 171/171, factions
  yokai 50,8 / norse 47,3 / egyptian 49,3 / greek 51,3 / aztec 51,5, P1 48,0 % (1000),
  0 crash. Impact carte convertie (Sirènes/greek) : +0,3 pt ∈ ±3 ✅.

## 3.1 — Zéniths asymétriques
- Suppression du +1/+1 universel au zénith.
- Bonus signature par faction (voir GAME_RULES.md) : jetons égyptiens +1/+1+Élan à l'Aube,
  déclenchement manuel des dieux face cachée grecs à Midi, recharge d'Endurance aztèque au
  Crépuscule, Sommeil yokai +1 tour + dormeurs adverses ciblables (sans riposte) la Nuit,
  Protection norse globale aux Ténèbres.
- Helpers : `effProtect`, `canTargetSleeping`, `zenithTokenBoost`, `manualTriggerFaceDown`.
- Validation : factions 47,3–52,5 %, P1 47,9 %, 0 crash.

## 3.2 — Cartes de manipulation du temps (10 nouvelles cartes, deck → 57)
| Carte | Faction | Type | Effet |
|---|---|---|---|
| Kairos (c2) | Greek | dieu | avance le Cycle d'1 phase |
| Horae 2/3 c3 | Greek | monstre unc. | Entrée : fige 1 tour |
| Heh (c3) | Egyptian | dieu | fige 2 tours |
| Seshat 2/2 c3 | Egyptian | monstre unc. | Entrée : Prophétie (3 prochaines phases) |
| Skuld (c2) | Norse | dieu | Prophétie |
| Urd 3/4 c4 | Norse | monstre unc. | Mort : retarde d'1 phase |
| Tonatiuh Renaissant (c2) | Aztec | dieu | relance aléatoirement |
| Xolotl 4/3 c3 | Aztec | monstre unc. | Entrée : avance d'1 phase |
| Toki-Onna 2/2 c2 | Yokai | monstre unc. | Entrée : retarde d'1 phase |
| Kaguya (c3) | Yokai | dieu | choisit la prochaine phase |
- Moteur : `setCyclePhase()` centralise les changements de phase (anim + recharges),
  `G.cycleFrozen` (gel), `pickCyclePhase()` (IA : vise son zénith ; humain : modal).
- IA : scoring des cartes temporelles selon la distance au zénith de sa faction.
- Itération d'équilibre : Seshat cost 2→3, Xolotl def 2→3 (egyptian/aztec recentrés).

## 3.3 — Re-simulation complète
- P1 **51,7 %** sur 1000 (pioche bonus T2 de P2 retirée — voir DECISIONS).
- Factions : yokai 50,5 / norse 52,5 / egyptian 52,8 / greek 48,3 / aztec 46,0 — toutes ∈ [45, 55] ✅.
- 181 cartes, 181/181 caps avec handler, couverture sim 181/181, 0 crash. Golden régénéré (P1 107/P2 93).

## 4 — MODE ARENA (draft + run Slay the Spire + boss)
- **4.1** Draft porté de feat-gameplay-v2 : 40 picks de 1 carte sur 4, pool complet
  multi-factions, garantie ≥1 carte de la faction choisie par pick ; deck custom côté
  joueur via `initGame(..., {customDeck})`. PAS de marché, PAS de pouvoirs divins.
- **4.2** Carte de run : 6 nœuds à 2-3 options (Combat = 1 pick · Élite = IA +1
  difficulté, 2 picks · Sanctuaire = +5 HP de run OU retrait d'1 carte) + Boss.
  HP de run 25, duel perdu = −10, 0 = ÉLIMINÉ.
- **4.3** 5 boss à règles cassées annoncées à l'écran : Zeus (Cycle +1 chaque tour),
  Anubis (1ᵉʳ monstre IA détruit par tour revient), Odin (2 murs Protect 0/4),
  Quetzalcoatl (tout a Endurance), Amaterasu (Cycle figé sur Nuit). Boss final tiré
  hors faction du joueur.
- **4.4** Écran-titre : « ⚔ ARENA (recommandé) » / « 🎴 PARTIE LIBRE ».
- **4.5** `tools/test_arena.js` — 100 runs simulées : **505 duels, 0 crash,
  durée moyenne 9,3 tours ≤ 12 ✅**, 25 % de runs championnes (IA pilote).
- Golden master STRICTEMENT IDENTIQUE après l'Arena (vérifié par golden_check) :
  zéro impact sur le jeu normal.
