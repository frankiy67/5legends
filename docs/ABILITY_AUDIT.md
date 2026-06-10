# ABILITY AUDIT — audit d'originalité de chaque capacité (tâche 6.1)

Date : 2026-06-11 · Périmètre : toutes les caps du pool (mots-clés, entry_/exit_/combat_,
GOD_EFFECTS, fd_). Classification : **FONDAMENTALE** (nécessaire au genre — renommée avec
un vocabulaire mythologique propriétaire), **GÉNÉRIQUE→RETRAVAILLÉE** (copie d'ailleurs —
une dimension 5 Legends ajoutée : Cycle, zénith, face-down, défausse), **INÉDITE**
(n'existe nulle part — conservée et amplifiée).

## 1. FONDAMENTALES — renommées (même mécanique, identité verbale à nous)

| Cap (interne) | Équivalent le plus proche | Nouveau nom affiché |
|---|---|---|
| `hurry` | Charge (Hearthstone) / Haste (MTG) | **Élan** |
| `protect` | Taunt (HS) / Defender (MTG) | **Rempart** |
| `hit` | Windfury (HS) / Double Strike (MTG) | **Frénésie** |
| `heal` | Lifesteal (HS) / Lifelink (MTG) | **Offrande** |
| `endure` | Divine Shield-ish (HS) / Undying (MTG) | **Immortel** |
| `entry_*` | Battlecry (HS) / ETB (MTG) | **Éveil** |
| `exit_*` | Deathrattle (HS) / Dies trigger (MTG) | **Dernier Souffle** |
| `curse` | Deathtouch-marqué (MTG) | **Malédiction** (conservé) |
| `blind` | scramble ciblage | **Aveuglé** |
| `fd_*` | Trap/Set card (Yu-Gi-Oh) | **Face cachée** (système inédit par son tempo, cf. §3) |

Textes de cartes, glossaire (badges), mots-clés du draft Arena et GAME_RULES.md mis à jour.

## 2. GÉNÉRIQUES → RETRAVAILLÉES (intention gardée + dimension 5 Legends)

| Cap | Équivalent | Retravail v5 |
|---|---|---|
| `god_dmg3` (Tenjin) | Frostbolt-like (HS) | 3 dégâts, **5 pendant la Nuit** (zénith yokai) |
| `god_dmg3_or_6` (Kagutsuchi) | Fireball à bonus | 3 dégâts, **6 la Nuit** (déterministe, plus de « bonus » flou) |
| `entry_dmg4` (Karura) / `entry_dmg3` | Battlecry dmg (HS) | **+2 dégâts au zénith de sa faction** |
| `entry_dmg5_all` (Typhon) | Flamestrike symétrique | À **Midi**, épargne vos monstres |
| `exit_dmg3_all` (Ushi-Oni) | Abomination (HS) | **4 dégâts la Nuit** |
| `god_dmg5_all` (Tlaloc) | Flamestrike (HS) | Au **Crépuscule**, épargne vos monstres |
| `god_draw2_free_if_solo` (Bastet) | Arcane Intellect | Pioche 2, **+1 à l'Aube** |
| `god_draw4_cheaper` (Huitzilopochtli) | Sprint (HS) | Pioche 3, **5 au Crépuscule** |
| `god_draw3_discard2` (Apollon) | Looting (MTG) | À **Midi**, ne défausse qu'1 |
| `god_atk5_buff` (Sarutahiko) | buff plat | La **Nuit**, +5 ATK **et +2 DEF** |
| `god_double_atk` (Athéna) | buff plat | À **Midi**, +2 DEF en plus |
| `god_discard2_random` (Loki) | Coup de poignard mental | **3 défausses aux Ténèbres** |
| `god_5life_draw` (Mayahuel) | Holy Light | **+8 PV au Crépuscule** |
| `god_heal_all` (Susanoo) | Circle of Healing | La Nuit, **+2 PV joueur** en plus |
| `god_cancel_m_steal` (Amaterasu) | counterspell+steal | Hors pile : **endort** le plus gros adverse (Sommeil yokai) |
| `god_cancel_attack_heal` (Osiris) | fog effect | Hors réaction : **+3 PV** (plus jamais un no-op) |
| `god_steal_spell_monster` (Tezcatlipoca) | Thoughtseize-like | Hors pile : **dérobe un dieu de la main adverse** |
| `god_redirect_to_monster` (Raijin) | redirect | Hors réaction : **immobilise** le plus gros adverse |
| `god_force_fight` (Râ) | forced combat (MTG) | Cible unique : **brûlure 4 dégâts** (soleil de Râ) |
| `fd_cancel_spell` (Arès, Tlaltecuhtli) | Counter Trap (YGO) | Intercepte désormais **les dieux** (les « sorts » de 5L) |

Dieux autrefois **morts** (effet jamais appliqué), réparés en 6.3 : Hestia (boucliers jamais
consommés), Geb & Centeotl (déclencheur de mort jamais branché), Fujin (cap `fd_blocker_23`
jamais matchée), + 18 types de cibles (`dmg3`, `halve_atk`, `bounce`, `buff_atk5`,
`equip_*`, `steal_hurry`, `copy_ally`, `swap`…) implémentés dans `applyTargetEffect`
**et** `aiPickTarget`.

## 3. INÉDITES — conservées et AMPLIFIÉES

| Cap | Pourquoi inédite | Amplification v5 |
|---|---|---|
| Sommeil (face-down 2 tours) | Mécanique tempo unique | +1 tour au zénith Nuit · dormeurs adverses ciblables · payoffs **Réveil** |
| Dieux grecs à trigger auto | Pièges à conditions de jeu | Déclenchement **manuel à Midi** · payoffs **Toile** |
| **Esquive** (2.2) | Défense cyclique déterministe | Recharge au changement de phase |
| Manipulation du Cycle (3.2) | Le temps comme ressource | 10 cartes, gel, Prophétie |
| Rituel aztèque | Économie de sacrifice | Étendue par **Sacrifice** (gems) |
| Réincarnation (Akkorokamui) | Re-shuffle boosté | conservée |
| Kaqkoj (l'adversaire choisit) | Fait choisir l'ennemi | conservée |

### Nouvelles caps inédites créées en 6.2 (≥8 demandées — 13 livrées)

| Cap | Carte(s) | Effet |
|---|---|---|
| `eclipse_buff` | Hieracosphinx | **Éclipse** : +1/+1 à chaque changement de phase du Cycle |
| `prophete` | Lion de Némée | **Prophète** : toujours considéré au zénith |
| `sacrifice_gems` | Ahuizotl | **Sacrifice** : sacrifiez ce monstre → +2 gems (bouton dédié, IA l'utilise) |
| `reveil_buff` | Inugami, Mujnina | **Réveil** : un monstre se réveille → +2/+2 et pioche 1 |
| `entry_self_sleep` | Oni | Colosse sur-staté qui **entre endormi 1 tour** |
| `momie` | Momie | **Momie** : 1ʳᵉ mort → face cachée, se relève à l'**Aube** |
| `ragnarok_growing` | Fenrir | **Ragnarök** : X dégâts à tous les adverses chaque tour pendant les **Ténèbres**, X croissant |
| `entry_oracle` | Python | **Oracle** : regarde le dessus du deck adverse, pioche si dieu |
| `trap_payoff` | Satyre, Hippocampe, Pégase | **Toile** : un dieu face cachée se révèle → 2 dégâts au joueur adverse |
| `token_payoff_atk` | Manticore | **Marée** : +1 ATK par jeton allié |
| `altar_payoff` | Camazotz | **Autel** : +1/+1 permanent par mort alliée |
| `fortress_payoff` | Hildisvini, Dokkalfar, Niddhog | **Forteresse** : ≥2 Remparts → +2 ATK et Frénésie |
| `riposte2` | Garm | **Riposte** : inflige 2 dégâts à tout attaquant |

## 4. Archétypes de combo (6.4) — 2 par faction

| Faction | Archétype 1 | Archétype 2 | Taux d'exécution mesuré |
|---|---|---|---|
| Yokai | **Berceuse** (sommeil + Réveil + Oni) | Sommeil offensif (Baku/Amaterasu + zénith Nuit) | **51,7 %** ✅ |
| Norse | **Forteresse** (murs + payoffs + Riposte) | **Ragnarök** (Fenrir + gel du Cycle aux Ténèbres) | **27,1 %** ✅ |
| Egyptian | **Marée de jetons** (Medjed/Set/Babaï + Manticore + Aube) | **Momie** (cycle de résurrections à l'Aube) | **48,5 %** ✅ |
| Greek | **Toile de pièges** (4 dieux fd + 9 corps Toile + Midi manuel) | Prophète/Oracle (zénith permanent + info) | **26,7 %** ✅ |
| Aztec | **Autel** (Sacrifice + Camazotz + Chohix + Centeotl) | Immortels rechargés (Crépuscule + morts répétées) | **47,6 %** ✅ |

CRITÈRE 6.1 ATTEINT : plus aucune cap classée « GÉNÉRIQUE » non retravaillée.
