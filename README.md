# ⚔ 5 Legends

**Le jeu de cartes où le temps est le plateau : manipulez le Cycle Céleste pour
déclencher le zénith de votre panthéon avant l'adversaire.** Cinq factions
mythologiques (Yokai, Norse, Egyptian, Greek, Aztec), chacune avec son bonus de
zénith, ses combos signature et ses cartes de manipulation du temps.

## 🎮 Jouer

👉 **[frankiy67.github.io/5legends](https://frankiy67.github.io/5legends)**

Ou en local :
```bash
python3 -m http.server 8000
# puis http://localhost:8000
```

## 🏟 ARENA (recommandé)

Draftez un deck de 40 cartes (1 carte sur 4, tous panthéons), puis traversez une
run façon Slay the Spire : 6 nœuds à embranchements (Combat · Élite · Sanctuaire)
et un **Boss à règle cassée** (Zeus accélère le Cycle, Anubis ressuscite ses
monstres, Odin commence emmuré, Quetzalcoatl rend tout Immortel, Amaterasu fige
la Nuit). 25 HP de run, −10 par duel perdu.

## 🌌 Le Cycle Céleste

Le ciel change à chaque ronde : Aube → Midi → Crépuscule → Nuit → Ténèbres.
Quand la phase de VOTRE faction arrive (son **zénith**), elle débloque son bonus
signature — et 10 cartes permettent d'avancer, retarder, geler ou prophétiser le
Cycle.

## 🗂 Technique

- **Vanilla JS single-page** — aucune dépendance, aucun framework, aucun stockage.
- `index.html` + `src/game.js` + `styles/main.css` + `assets/`.
- Docs : `docs/GAME_RULES.md` (règles), `docs/ARCHITECTURE.md`, `docs/CARD_FORMAT.md`.

### Tests (Node, sans navigateur)
```bash
node tools/golden.js          # golden master 200 parties seedées
node tools/test_all_cards.js  # 181 cartes : images, stats, handlers, couverture
node tools/test_factions.js   # winrates par faction (cible 45-55%)
node tools/test_arena.js      # 100 runs d'Arena complètes
node tools/test_preview.js    # preview de combat == résultat réel
node tools/card_metrics.js    # play rate / contribution par carte + combos
```

## Licence
Voir [LICENSE](LICENSE).
