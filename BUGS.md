# BUGS.md — Audit de stabilisation (Brique 6, Phase B)

Diagnostic exhaustif via `tools/audit.js` (intégrité cartes, illustrations,
couverture des capacités, références PV, stress IA) + scan de logs + tally
d'invariants sur **1200 parties** (16 combos de profils × 25 paires de factions)
et 200 parties golden.

## Résultat global

- **CRASH : 0** (1200 parties profil×profil + 1000 CONTROL + 200 golden).
- **Non-terminaisons : 0.**
- **Violations d'invariant DURES : 0** — `gems<0`, `NaN` stat, `cDef<0` sur
  créature vivante, `faith` invalide, doublon d'objet, `marché ≠ 5`,
  **`monstres (non-face-cachés) > 6` : 0** (le cap de 6 monstres est respecté).
- 171/171 cartes bien définies (id, nom, coût, stats, cap) ; 171/171 illustrées.
- 134 capacités distinctes ; **1** non gérée (`curse`, cf. L-2).

Le jeu est **stable** : aucun crash, aucune erreur logique dure. Les éléments
ci-dessous sont soit corrigeables côté IA (C-1), soit des **décisions de design**
(je ne les tranche pas, conformément à la consigne).

---

## CRASH
_(aucun)_

---

## LOGIQUE

### L-1 — [HIGH · CORRIGEABLE] IA : boucle de pose sur terrain plein
`aiMainPhase` (src/game.js) sélectionne la carte au meilleur score puis pose
`played=true` **inconditionnellement**. Si la meilleure carte est un **monstre**
et le terrain est **plein (6)**, `playMonster` rembourse (carte rendue à la main,
gems restitués) mais `played=true` relance la boucle, qui re-sélectionne le même
monstre… jusqu'à `safety=12`. Conséquence : l'IA **gaspille sa main phase** et
**ne joue pas ses dieux/sorts** quand le terrain est plein.
- Symptôme : ~6 × `Field full — cannot summon!` par partie (1189/200).
- Cause : pas de crash (gems/cartes conservés), mais jeu IA dégradé.
- **Fix (Phase C)** : exclure les monstres de `playable` quand `field.length>=6`.
  Correction IA pure — n'altère ni stats, ni coûts, ni équilibrage.

---

## DESIGN — à trancher par un humain (NON corrigés)

### D-1 — Mot-clé « Malédiction » (`cap:'curse'`) inerte
8 cartes (`DOKKALFAR, FENRIR, SERPOPARD, SATYRE, PYTHON, CAMAZOTZ, AHUIZOTL`…)
ont `cap:'curse'` / txt « Malédiction. » mais **aucun handler** ne pose
`m.cursed`. Le mot-clé ne fait **rien**.
- Intent ambigu : la créature est-elle **maudite** (meurt à 1 dégât, cf.
  GAME_RULES.md « Cursed ») — un gros désavantage sur des stats premium — ou
  **maudit-elle l'ennemi** (comme `entry_curse2`) ? Les deux lectures changent
  radicalement l'équilibre → **décision de design**.

### D-2 — Effets vestigiaux référençant les PV joueur (retirés en Phase A)
Le champ `player.hp` reste vestigial ; 4 effets l'écrivent encore **sans aucun
impact** depuis le retrait des PV :
- Vol de vie `hasHeal` (combat créature) — `AP.hp += dégâts` (game.js ~L3044).
- Soins de dieux : `god_cancel_attack` (+3 PV), un autre (+4 PV) (~L2429, ~L2091).
- Dégâts directs au joueur : sort `-4` (~L3860).
Ces cartes/effets sont donc **partiellement inertes**. Les reconvertir (p. ex.
vol de vie → +Foi) ou les retirer est une **décision de design/équilibrage**.

### D-3 — Karura (`entry_dmg4`) partiellement inerte
Quand le terrain adverse est vide, l'effet « 4 dégâts » (qui visait le visage
avant le retrait des PV) est **neutralisé** (`Karura — aucune créature adverse à
viser`, 3/200 parties). À repenser → **décision de design**.

### D-4 — Pièges (dieux face cachés) hors du cap de 6
Le tableau `field` peut atteindre **7+** : `playMonster` compte les dieux face
cachés dans le cap de 6, mais `playGod` (pose face cachée) **ne vérifie pas** le
cap. Le **cap de 6 monstres est respecté** (0 violation), mais les pièges
occupent des slots supplémentaires (15/1200 snapshots). Pas de crash.
- Question : les pièges doivent-ils compter dans la limite ? → **décision de
  design** (zone séparée vs slots partagés).

---

## SOFT / COSMÉTIQUE

### S-1 — Main > 7 en milieu de tour
Les effets de pioche (cycle Aube, pouvoir Vision, `*_draw`, `end_draw`) ne
plafonnent pas la main ; elle peut atteindre 8–9 en cours de tour, puis est
**rognée à 7 en fin de tour** (`doEndTurn`). Comportement **par design** (cap
souple, à la Hearthstone). 113/1200 snapshots (parties finies en milieu de tour).
Le marché et le pouvoir de dieu, eux, **bloquent** correctement l'achat à 7.

---

## Plan Phase C
Un seul bug corrigeable sans décision de design : **L-1**. Les autres (D-1…D-4,
S-1) sont notés ici pour décision humaine. Critère de sortie : 1000 parties
0 crash (déjà atteint ; à reconfirmer après le fix L-1).
