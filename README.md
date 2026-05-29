# 5 Legends — Tactical Card Battle

A browser-based tactical card game featuring 5 mythological factions: Yokai, Norse, Egyptian, Greek, and Aztec.

## Factions

| Faction | Strengths | Key Mechanics |
|---------|-----------|---------------|
| 🦊 Yokai | Sleep, Protect | Control & disruption |
| ⚡ Norse | Endure, Wall | Resilience & recursion |
| 🏺 Egyptian | Hit, Actions | Tempo & aggression |
| 🏛️ Greek | Heal, FaceDown | Traps & lifegain |
| 🌿 Aztec | Endure, Heal | Sustain & synergies |

## Gameplay

- **2 Players** (PvP or vs AI)
- **25 HP** each
- **4 phases per turn**: Main 1 → Combat → Main 2 → End
- **Gems** ramp up by 1 each turn (max 10) — spend them to play cards
- **Play multiple cards** per turn as long as you have gems
- **Anytime cards** (orange border) can be played on the opponent's turn

## How to Play

1. Open `index.html` in a browser (requires a local server for ES modules — see below)
2. Each player selects their faction
3. Play monsters, gods, and spells using your gem resources
4. Attack opponent monsters or their HP directly
5. First player to reduce opponent to 0 HP wins!

## Card Types

- **Monsters** — ATK/Shield stats, enter the field, attack in Combat phase
- **Gods** — powerful one-time effects, often with ANYTIME triggers
- **Spells** — instant effects

## Key Abilities

| Ability | Effect |
|---------|--------|
| Hurry | Can attack the turn it enters |
| Protect | Must be destroyed before player can be attacked |
| Endure | Survives lethal damage once, returns with 1 Shield |
| Hit | Attacks twice per combat |
| Heal | Damage dealt restores your HP |
| Entry/Exit | Triggers when entering/leaving the field |
| Face Down | Enters hidden, triggers on specific conditions |
| Anytime | Playable during opponent's turn |

## Running Locally

```bash
# Option 1: Python
python3 -m http.server 8000
# Then open http://localhost:8000

# Option 2: Node.js
npx serve .

# Option 3: VS Code Live Server extension
```

> **Note:** `index.html` must be served over HTTP (not opened directly as a file) because it loads assets from relative paths.

## Project Structure

```
5legends/
├── index.html              ← Game entry point
├── styles/
│   └── main.css            ← All styles (variables, layout, cards, animations)
├── assets/
│   ├── cards/              ← Card artwork (JPEG, ~35-50KB each)
│   │   ├── yokai/
│   │   ├── norse/
│   │   ├── egyptian/
│   │   ├── greek/
│   │   └── aztec/
│   ├── audio/
│   │   └── bgm.ogg         ← Background music (Battle of Gods)
│   └── ui/
│       ├── faction/        ← Faction selection portraits
│       ├── backgrounds/    ← Battlefield landscapes
│       └── cards/          ← Spell card backs
└── docs/
    ├── GAME_RULES.md
    ├── CARD_FORMAT.md
    └── ARCHITECTURE.md
```

## GitHub Pages

This project works on GitHub Pages. After pushing:
1. Go to **Settings → Pages**
2. Set source to **main branch**, root folder
3. Your game will be live at `https://yourusername.github.io/5legends/`

## Credits

Built with vanilla HTML/CSS/JS. Card artwork generated with AI tools. Music: "Battle of Gods" by Cézame Trailers.
