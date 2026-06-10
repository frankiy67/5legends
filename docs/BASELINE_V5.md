# BASELINE V5 — état de main avant la mission fix-audit-v5

Date : 2026-06-10 · Commit de base : 30bbd64 (origin/main)
Référence avant/après pour tout le travail de la branche `fix-audit-v5`.

## Golden master — `node tools/golden.js` (200 parties IA vs IA seedées)

```
✓ 200 parties en 1.3s
  P1: 35  P2: 165  nuls: 0  double-KO: 0  crashs: 0
```

→ **Winrate P1 : 17,5 % — déséquilibre majeur en faveur du joueur 2 (82,5 %).**

## Toutes les cartes — `node tools/test_all_cards.js`

```
  Cartes uniques analysées : 171
  Images OK ............... : 171  (+0 placeholders volontaires)
  Stats valides ........... : 171/171
  Caps avec handler ....... : 171/171
  Cohérence anytime ....... : 70 dieux
  Couverture en simulation  : 170/171 cartes vues en jeu (60 parties)
  Crashs en simulation .... : 0/60
  ✅ TOUT PASSE
```

## Matchups factions — `node tools/test_factions.js` (100 parties)

```
  Matchup                 W1  W2  maxT  crash  >60t  inachevé
  yokai vs norse           0  10    11     0     0       0
  yokai vs egyptian        1   9    14     0     0       0
  yokai vs greek           4   6    16     0     0       0
  yokai vs aztec           2   8    24     0     0       0
  norse vs egyptian        7   3    17     0     0       0
  norse vs greek           4   6    11     0     0       0
  norse vs aztec           6   4    15     0     0       0
  egyptian vs greek        2   8    19     0     0       0
  egyptian vs aztec        2   8    22     0     0       0
  greek vs aztec           2   8     9     0     0       0
  Total : 100 · Crashs : 0 · Timeouts : 0 · Inachevées : 0
```

⚠️ Ces winrates par faction sont **inexploitables tels quels** : ils sont dominés
par le biais P1/P2 (le 2ᵉ joueur gagne ~80 % des parties quel que soit le
matchup). Toute mesure de faction doit attendre le fix 1.1.

## Résumé chiffré de référence

| Métrique | Valeur baseline |
|---|---|
| Winrate P1 (golden 200) | 17,5 % |
| Crashs (golden 200) | 0 |
| Cartes uniques | 171 |
| Cartes avec handler | 171/171 |
| Couverture simulation | 170/171 |
| Crashs matchups (100) | 0 |
| Durée max d'une partie | 24 tours |
