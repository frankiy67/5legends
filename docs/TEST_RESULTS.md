# 5 LEGENDS — Résultats des tests automatisés

Date : 2026-06-03 · Node v25 · Chrome (Playwright headless)

## Golden master (régression moteur)
`node tools/golden.js` — 200 parties IA vs IA seedées.
- P1 : 35 · P2 : 165 · nuls : 0 · double-KO : 0 · **crashs : 0**
- Snapshot régénéré après les fixes gameplay (gems 10, crash Thor).

## Toutes les cartes — `node tools/test_all_cards.js`
- Cartes uniques analysées : **171**
- Images résolues vers un fichier réel : **168** (+3 placeholders volontaires : HESTIA, SOBEK, ORACLE_DELPHES)
- Stats valides : **171/171**
- Caps avec handler (GOD_EFFECTS / fd_ / monstre) : **171/171**
- Cohérence trigger « N'importe quand » / fd_ ↔ isAnytime : **70 dieux**
- Couverture en simulation (60 parties) : **170/171** cartes vues en jeu
- Crashs : **0/60**
- **✅ TOUT PASSE**

## 100 parties tous matchups — `node tools/test_factions.js`
10 paires distinctes × 10 parties.

| Matchup | W1 | W2 | max tours |
|---|---|---|---|
| yokai vs norse | 0 | 10 | 11 |
| yokai vs egyptian | 1 | 9 | 14 |
| yokai vs greek | 4 | 6 | 16 |
| yokai vs aztec | 2 | 8 | 24 |
| norse vs egyptian | 7 | 3 | 17 |
| norse vs greek | 4 | 6 | 11 |
| norse vs aztec | 6 | 4 | 15 |
| egyptian vs greek | 2 | 8 | 19 |
| egyptian vs aztec | 2 | 8 | 22 |
| greek vs aztec | 2 | 8 | 9 |

- Total : **100 parties** · Crashs : **0** · Timeouts (>60 tours) : **0** · Inachevées : **0**
- **✅ 100/100 terminées proprement**
- Note d'équilibrage (hors périmètre audit) : net avantage au 2ᵉ joueur.

## Responsive / plein écran (Playwright, board 6v6 rempli)
| Viewport | scrollWidth×scrollHeight | overflow X | overflow Y |
|---|---|---|---|
| 1920×1080 | 1920×1080 | non | non |
| 1280×720  | 1280×720  | non | non |

Aucune scrollbar, aucun débordement, même terrains pleins (6 monstres par camp).
Écrans vérifiés visuellement : titre, sélection de faction, board, survol (popup),
tiroir de log, 10 gems/joueur.
