# BALANCE P1/P2 — diagnostic & fix (tâche 1.1)

Date : 2026-06-10 · Outil : `tools/p1p2_diag.js` (500/1000 parties IA vs IA seedées,
25 matchups de factions cyclés). Baseline : P1 17,5 % (golden 200) / 19,6 % (diag 500).

## 1. Diagnostic instrumenté (AVANT tout fix) — 500 parties

| Mesure | Valeur |
|---|---|
| Winrate P1 | **19,6 %** |
| 1ʳᵉ attaque sur board développé | P1 200 · P2 293 |
| Winrate du 1ᵉʳ attaquant (board dev.) | 59,6 % |
| Δ HP au tour 5 (P1−P2) | **−4,34** |
| Δ cartes jouées au tour 5 (P1−P2) | **−1,60** |
| Δ taille de board au tour 5 (P1−P2) | −1,47 |
| Attaques exécutées (total) | P1 2672 · P2 5585 → **ratio 0,48** |

## 2. Mécanismes causaux identifiés (2 bugs structurels + 1 fait de design)

### Cause n°1 — BUG IA : attaques de P1 sautées (le plus gros contributeur)
`aiCombatPhase`, chemin « combat normal » :
```js
await waitForPlayerAck(m, 'attack');
if(!G.players[2].field[i]) continue;   // ← joueur 2 CODÉ EN DUR
```
Quand P1 (IA en sim) attaque, la garde vérifie le board de **P2** à l'index de
l'attaquant : l'attaque de P1 n'était exécutée que si P2 avait par hasard un
monstre au même index. Résultat mesuré : P1 n'exécutait que **48 %** du volume
d'attaques de P2. C'est le « biais de l'IA elle-même » : l'IA ne favorisait pas
P2 par sa stratégie mais par ce bug d'index.
**Fix** : `G.players[p].field[i]`.
**Effet mesuré (seul)** : winrate P1 19,6 % → **24,8 %**, ratio d'attaques 0,48 → 0,62.

### Cause n°2 — Rampe de gems asymétrique
`doEndTurn` incrémentait `maxGems` du **joueur entrant** à chaque changement de
tour. P2 recevait son +1 avant son 1ᵉʳ tour → courbe P2 = 2,3,4,5… contre
P1 = 1,2,3,4… : **+1 gem à chaque ronde pendant toute la partie** (≈5 gems
cumulés au tour 5 — d'où le Δ cartes jouées de −1,6). Contredit GAME_RULES.md
(« Both players gain +1 max gem for next turn » = symétrique).
**Fix** : `NP.maxGems = Math.min(10, G.turn)` — le plafond de gems = numéro de
ronde, identique pour les deux joueurs.
**Effet mesuré (cumulé fix 1+2)** : winrate P1 → **56,6 %** (surcompensation :
l'avantage naturel du 1ᵉʳ joueur réapparaît, P2 n'ayant plus que sa 5ᵉ carte).

### Cause n°3 — Avantage tempo du 1ᵉʳ joueur (fait de design, pas un bug)
Une fois les 2 bugs corrigés, le 1ᵉʳ attaquant sur board développé gagne ~56 %
des parties : il faut une compensation « going second » classique.

## 3. Compensations testées (500 parties chacune, sens : compenser P2)

| Compensation | Winrate P1 | Verdict |
|---|---|---|
| (aucune — bugs seuls corrigés) | 56,6 % | hors fourchette |
| Main 5/4 pour P2 (déjà en place dans initGame) | incluse ci-dessus | insuffisante seule |
| **+1 gem temporaire au 1ᵉʳ tour de P2 (Coin)** | **52,0 %** | ✅ retenue |

La pioche +1 supplémentaire n'a pas été nécessaire : Coin + main 5/4 suffisent.
C'est la compensation la plus simple atteignant le critère (option b.2 de la
mission, dans le sens indiqué par le diagnostic).

## 4. Validation finale — 1000 parties seedées

| Mesure | Avant | Après |
|---|---|---|
| **Winrate P1** | 17,5–19,6 % | **52,3 %** ∈ [47, 53] ✅ |
| Ratio d'attaques P1/P2 | 0,48 | **1,00** |
| Δ HP au tour 5 (P1−P2) | −4,34 | −0,60 |
| Δ board au tour 5 | −1,47 | −0,37 |
| Crashs | 0 | 0 |
| Durée moyenne | 9,0 tours | 9,2 tours |

Implémentation du Coin : `P2._coinGem = 1` à l'init, consommé par `doEndTurn`
(`NP.gems = NP.maxGems + NP._coinGem`) au 1ᵉʳ tour de P2 uniquement.
