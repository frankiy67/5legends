# DECISIONS V5 — journal des décisions de design (branche fix-audit-v5)

Format : `[PHASE.TÂCHE] décision · alternatives écartées · pourquoi · ⚠️ à relire par Frank`

---

**[1.1]** Rampe de gems rendue symétrique (`maxGems = min(10, G.turn)`) au lieu de compenser
P1 par une pioche · alternatives écartées : pioche +1 P1, main 5/4 inversée ·
pourquoi : GAME_RULES.md décrit une rampe symétrique (« Both players gain +1 max gem ») —
l'asymétrie était un bug d'implémentation, pas un choix de design · ⚠️ à relire par Frank

**[1.1]** Compensation « going second » retenue : main 5/4 (existante) + Coin ÉTALÉ
(+1 gem temporaire aux tours 1 et 2 de P2) · alternatives écartées : coin simple +1 T1
(→ P1 54,4 %), coin +2 T1 (→ P1 44,5 %), pioche +1 · pourquoi : seule variante mesurée
dans [47, 53] (47,5 % sur 1000 parties) · ⚠️ à relire par Frank

**[1.1d]** Intensité du Ragnarök norse réduite +3/+3 → +2/+2 (Endurance conservée) ·
alternative écartée : nerfs de stats supplémentaires sur ~8 monstres norse · pourquoi :
norse restait à 65 % après 2 itérations de stats — le moteur Ragnarök (déclenché par
toute mort de monstre en partie norse) était le contributeur dominant, le toucher est
plus chirurgical que dénaturer les statlines · ⚠️ à relire par Frank
