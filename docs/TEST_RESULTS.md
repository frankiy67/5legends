# 5 LEGENDS — Résultats des tests automatisés (v5)

Date : 2026-06-11 · Branche : `fix-audit-v5` · Node v25

## Golden master — `node tools/golden.js` (200 parties IA vs IA seedées)
- P1 : **114** · P2 : **86** · nuls : 0 · double-KO : 0 · **crashs : 0**
- `golden_check` : ✓ IDENTIQUE au snapshot committé.
- Mesure fine (p1p2_diag, 1000 parties) : **winrate P1 51,2 %** ∈ [47, 53] ✅
  (baseline avant v5 : 17,5–19,6 %).

## Toutes les cartes — `node tools/test_all_cards.js`
- Cartes uniques : **181** (171 + 10 cartes temporelles v5)
- Images : 171 fichiers + 10 placeholders volontaires (« illustration à venir »)
- Stats valides : **181/181** · Caps avec handler : **181/181**
- Cohérence anytime : 75 dieux · Couverture simulation : **181/181**
- Crashs : **0/60** — ✅ TOUT PASSE

## Factions — `node tools/test_factions.js 100` (1000 parties, côtés alternés)
| Faction | Winrate |
|---|---|
| yokai | 55,0 % ✅ |
| norse | 46,8 % ✅ |
| egyptian | 54,5 % ✅ |
| greek | 46,9 % ✅ |
| aztec | 46,9 % ✅ |
- 0 crash · 0 timeout · 0 inachevée · toutes ∈ [45, 55] ✅

## Arena — `node tools/test_arena.js 100` (100 runs complètes : draft IA + carte + boss)
- 488 duels · **durée moyenne 9,2 tours ≤ 12** ✅ · 24 % de runs championnes · **0 crash** ✅

## Preview de combat — `node tools/test_preview.js`
- **211/211 prédictions exactes** (1 cas « incertain » exclu par contrat) ✅

## Combos (card_metrics, 4000 parties) — critère ≥ 25 %
yokai **50,8 %** · norse **27,7 %** · egyptian **48,3 %** · greek **26,0 %** · aztec **47,7 %** — tous ✅

## Dieux (card_metrics, 4000 parties)
- 0 dieu à effet mort (9 réparés en 6.3) · play rate ∈ [40, 90] : 65/75
- Win contribution : voir la note méthodologique de CARD_METRICS.md
- Durée moyenne d'une partie : 9,5 tours
