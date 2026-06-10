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
