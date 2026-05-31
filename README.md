# ⚔ 5 Legends — Simulator

Jeu de cartes stratégique 1v1 opposant 5 factions mythologiques : Yokai, Norse, Egyptian, Greek et Aztec.

## 🎮 Jouer en ligne

👉 **[frankiy67.github.io/5legends](https://frankiy67.github.io/5legends)**

## 🗂 Structure du projet

```
5legends/
├── index.html          ← HTML (280 lignes — shell pur, sans CSS/JS inline)
├── styles/
│   └── main.css        ← Tout le CSS (thème sombre, layout, animations)
├── src/
│   └── game.js         ← Toute la logique de jeu (2700 lignes)
├── assets/
│   ├── cards/{faction}/← Artwork des cartes
│   ├── ui/             ← Backgrounds, faction art, dos de cartes
│   └── audio/          ← BGM
└── docs/
    ├── GAME_RULES.md
    ├── CARD_FORMAT.md
    └── ARCHITECTURE.md
```

## ⚖️ Équilibrage v4 — validé sur 22 500 simulations

| Faction | Winrate | Identité |
|---------|---------|----------|
| 🏛 Greek | 53.6% | Tempo · Hit · Piège |
| 🦊 Yokai | 50.8% | Sommeil · Contrôle |
| ⚡ Norse | 48.9% | Murs · Résistance |
| 🌿 Aztec | 48.9% | Aggro · Endurance |
| 🏺 Egyptian | 47.8% | Swarm · Tempo |

**Écart max : 5.8pp** (vs 60pp avant équilibrage)

## 🃏 Factions

| | Mécanique signature | Counter | Faible contre |
|--|--|--|--|
| 🦊 Yokai | Sommeil — neutralise les défenses | Norse (murs) | Aztec (aggro) |
| ⚡ Norse | Endurance + Protect | Egyptian | Yokai (sleep) |
| 🏺 Egyptian | Hit × 2 + Tokens | Aztec | Norse (murs) |
| 🏛 Greek | Hit·Heal + Pièges réactifs | Aztec | — |
| 🌿 Aztec | Endure·Heal + Bewitch | Yokai | Greek |

## 🔧 Lancer en local

```bash
# Cloner le repo
git clone https://github.com/frankiy67/5legends.git
cd 5legends

# Lancer un serveur local (les modules JS nécessitent HTTP)
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

> ⚠️ Le jeu ne fonctionne **pas** en ouvrant `index.html` directement (protocole `file://`) — il faut un serveur HTTP.

## ✨ Principales mécaniques

| Capacité | Effet |
|--|--|
| **Hurry** | Peut attaquer le tour de son invocation |
| **Protect** | Doit être détruit avant d'attaquer le joueur |
| **Endure** | Survit une fois avec 1 DEF restant |
| **Hit** | Attaque deux fois par tour |
| **Heal** | Les dégâts infligés soignent le joueur |
| **Sleep** | Monstre ciblé face-down, inactif 2 tours |
| **Curse** | Le prochain point de dégât tue le monstre |
| **Sand Up** | Monstre ciblé ne peut pas attaquer 1 tour |
| **Bewitch** | 50% de chance de rater l'attaque |

## 📜 Changelog

### v4 (équilibrage)
- Système d'actions supprimé — les gems sont la seule ressource
- 7 cartes "+Action" remplacées par de vraies capacités (Baku→Sommeil, Golem→Endurance, Efrit→3 dégâts, Kraken→Shield, Centaur→Protect, Draugr→Draw, Huay Chivo→Bewitch)
- 60 monstres rééquilibrés sur simulations
- Greek renforcé (11% → 54%) : monstres boostés + 5 dieux convertis en proactifs
- Norse nerfé (71% → 49%) : murs Endure+Protect cassés
- Egyptian renforcé (39% → 48%)

### v3
- Correction bug critique : `hand-area` et `side-panel` hors de la grille CSS
- Fix `renderPhaseBar` : `updatePhaseButton` → `updatePhaseBtn`
