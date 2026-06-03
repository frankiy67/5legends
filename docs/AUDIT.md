# 5 LEGENDS — Rapport d'audit diagnostic

Date : 2026-06-03 · Périmètre : `src/game.js` (4404 l.), `index.html`, `styles/main.css`, `assets/cards/`
Contrainte : ne pas modifier le moteur composable (`GOD_EFFECTS`, dispatch — PARTIE C). Corriger les bugs **autour**.

---

## 1A — IMAGES

Résolution réelle : `getCardImage(id)` normalise (`toUpperCase`, retire `-` et `_`) puis cherche
dans `B64_IMAGES`, construit depuis `FACTION_MAP`. Chemin attendu :
`./assets/cards/{faction}/{id.toLowerCase sans -_}.jpeg`.

**Cause racine** : le commit « tous les 70 dieux » a ajouté ~14 dieux/faction dans `GODS`,
mais `FACTION_MAP` n'a jamais reçu les nouveaux IDs → `getCardImage` renvoie `''` → emoji de
secours. **43 cartes** sans illustration fonctionnelle sur 170.

### Catégorie A — fichier exact présent, simplement absent de FACTION_MAP (28)
APHRODITE, BASTET, BRAGI, CENTEOTL, COATLICUE, COYOLXAUHQUI, DEMETER, EHECATL, FRIGG, GEB,
HACHIMAN, HERA, HERMES, HODER, IDUNN, KAGUTSUCHI, OMAIKANE, PTAH, RYUJIN, SARUTAHIKO, SEKHMET,
ULLR, VALI + (monstres grecs noms FR) CENTAURE→centaur, CERBERE→cerberus, CHIMERE→chimera,
CYCLOPE→cyclop, GORGONE→gorgon, HYDRE→hydra, MINOTAURE→minotaur, SATYRE→satyr, SIRENES→siren.
→ **Fix : ajouter le mapping.**

### Catégorie B — fichier sous nom différent (alias requis) (8)
| Carte (id) | Fichier réel |
|---|---|
| APOLLON | greek/apollo.jpeg |
| DIONYSOS | greek/dionysus.jpeg |
| THOTH | egyptian/toth.jpeg |
| SET | egyptian/seth.jpeg |
| KHONSU | egyptian/khnum.jpeg (art égyptien le plus proche) |
| TENJIN | yokai/tengin.jpeg (typo fichier source) |
| XIPE_TOTEC | aztec/xipetotec.jpeg |
| TLALTECUHTLI_S | aztec/tlaltecuhtli.jpeg |
→ **Fix : alias dans le mapping.**

### Catégorie C — aucun fichier (placeholder requis) (3)
HESTIA (greek), SOBEK (egyptian), ORACLE_DELPHES (greek, sort).
→ **Fix : placeholder visuel « cadre + nom + illustration à venir ».**

Tokens ignorés (pas de carte jouable) : RITUAL_TOK, BALDER_TOKEN, DEMETER_TOK, ICE_TOKEN,
HESTIA_TOKEN.

---

## 1B — STATS & CAPS
- `atk`/`def`/`cost` : tous numériques et valides sur les 170 cartes (vérifié).
- Caps : chaque `cap` de dieu est présent dans `GOD_EFFECTS` (map composable) ; caps de monstres
  gérés dans les handlers legacy. Pas de cap orpheline détectée au chargement.
- `ANYTIME_CAPS_SET` est reconstruit dynamiquement (C5) à partir des effets marqués « N'importe
  quand » + préfixe `fd_`. Cohérent. `isAnytime()` couvre `fd_*`. OK.

---

## 1C — LOGIQUE DE JEU
- **GEMS bloqués à 6** : `doEndTurn()` ligne 786 → `NP.maxGems = Math.min(6, …+1)`. Plafond
  codé en dur à **6**. Cause exacte du bug rapporté. → corriger en **10**.
- **Cartes adverses visibles** : `renderHand()` affiche la main de `G.cp` face visible. En PvE,
  `doEndTurn()` met `G.cp=2` pendant le tour de l'IA → la main de l'IA s'affiche **face visible**
  au joueur humain. La main adverse face cachée (`hcard-back`) n'est rendue que pour l'autre
  joueur. → en PvE, le « viewer » doit toujours être le joueur 1.
- **Clic main qui « saute »** : `.hcard:hover.playable` applique
  `transform: translateY(-130px) scale(2) !important` **instantané** (transition .1s). Dès le
  survol la carte bondit de 130px et double de taille → elle quitte le pointeur, le clic rate ou
  atterrit sur la carte voisine. Aggravé par le re-render complet de la main à chaque clic
  (l'arc se recalcule). → réduire le lift de survol, garder la carte sous le curseur, déléguer le
  gros zoom au popup de preview existant.

### Crash moteur (3 parties sur 200 en simulation golden)
`TypeError: null.cAtk` dans `GOD_EFFECTS["god_sacrifice_opp_draw2"]` (Thor), ligne 1798 :
`.reduce((a,b)=>a.cAtk>b.cAtk?a:b, null)` — le seed `null` plante dès la 1ʳᵉ itération.
→ fix null-safe (calcul du plus gros monstre adverse), sans toucher la logique de Thor.

---

## 1D — UI
- **Panneau droit** (`grid-column:2`, 286px) : actions + preview + battle log. À supprimer
  (Phase 3) → board plein écran, actions en overlay, log rétractable.
- **Viewport figé** : `<meta viewport width=1400>` → pas de plein écran réel. À passer 100vw/vh.
- **Logo** : affiche « V LEGENDS » au lieu de « 5 LEGENDS ». Pas d'écran-titre avec bouton JOUER
  (on tombe direct sur la sélection de faction).
- **ai-overlay** ancrée `right:310px;bottom:220px` (suppose le panneau) → à recaler après suppression.
- z-index : globalement cohérent (preview 500, modals 100, hand hover 300). RAS bloquant hormis
  le saut de survol ci-dessus.
- `testImages()` (fin de fichier) teste `src.startsWith('data:')` — obsolète (images = fichiers,
  plus de base64) → log console trompeur. À corriger en Phase 4.

---

## Plan de correction
2A gems 10 · 2B mappings+placeholder images · 2C main adverse face cachée (viewer PvE) ·
2D survol/clic main · (+ crash Thor null-safe) · 3A suppression panneau · 3B plein écran ·
3C écran-titre · 4A/4B tests auto · 5 polish/responsive. Golden régénéré après 2A (gems
change légitimement la simulation).
