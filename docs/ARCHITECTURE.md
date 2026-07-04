# Architecture

5 Legends is a self-contained single-page HTML application.

## File Structure

```
index.html
  ├── <style>        CSS (all styles, ~50KB)
  ├── <body>         HTML (game UI, ~18KB)
  └── <script>       JavaScript (all game logic, ~105KB)
```

## JavaScript Modules (conceptual)

The JS is structured as logical sections within a single `<script>` tag:

| Section | Responsibility |
|---------|---------------|
| `Audio5L` IIFE | Web Audio API: BGM + procedural SFX |
| `B64_IMAGES` / `getCardImage` | Maps card IDs to image file paths |
| `MONSTERS` / `GODS` / `SPELLS` | Static card data |
| `buildDeck()` / `shuffle()` | Deck construction |
| `initGame()` | Game state initialisation |
| `renderAll()` / `renderHand()` / `renderField()` / `renderPlayerBar()` | DOM rendering |
| `renderPhaseBar()` / `updatePhaseBtn()` | Phase UI |
| `playCard()` / `playMonster()` / `playGod()` / `playSpell()` | Card play logic |
| `doAttack()` | Combat resolution |
| `handleDeath()` / `applyExit()` / `applyEntry()` | Lifecycle effects |
| `applyTargetEffect()` | Ability targeting |
| `waitForPlayerAck()` / `resolveReaction()` | Reaction window (pause system) |
| `aiTurn()` / `aiMainPhase()` / `aiCombatPhase()` / `pickAITarget()` | AI logic |
| `showCardPreview()` / `showBigPreview()` | Card preview UI |
| Targeting system | Arrow overlay, click resolution |
| Event listeners | Button clicks, keyboard, setup flow |

## State Object (G)

```javascript
G = {
  mode: 'pve',           // 'pvp' | 'pve'
  turn: 1,               // Turn counter
  cp: 1,                 // Current player (1 or 2)
  activeTurn: 1,         // Whose turn it is (differs during reaction windows)
  phase: 'Main1',        // 'Main1' | 'Combat' | 'Main2' | 'End'
  actions: 1,            // Actions remaining this turn
  players: [null, P1, P2], // 1-indexed player objects
  targeting: null,       // Active targeting state
  selAtk: null,          // Selected attacker { p, i }
  inReaction: false,     // Human has reaction window open
  waitingForPlayer: false,// AI paused, waiting for SPACE
  log: [],               // Battle log entries
  stack: [],             // Spell/monster stack for counters
}
```

## Player Object

```javascript
{
  id: 1,
  faction: 'yokai',
  hp: 25,
  maxGems: 1,
  gems: 1,
  field: [],         // Cards in play (max 6)
  hand: [],          // Cards in hand
  deck: [],          // Draw pile
  graveyard: [],     // Destroyed/used cards
  attacked: Set,     // Field indices that attacked this turn
  summoned: Set,     // Field indices summoned this turn
  golems: [],        // Active Golem passive references
  balderActive: false,
}
```

## Reaction / Pause System

When the AI plays a card or attacks, the game pauses and gives the human player a chance to play ANYTIME cards in response:

1. AI calls `waitForPlayerAck(card, context)`
2. Human player sees a banner: "AI plays X — press SPACE to continue"
3. If human has ANYTIME cards, they can play them
4. Human presses SPACE → `resolveReaction()` → game resumes


## v5 additions

| Section | Responsibility |
|---------|---------------|
| `setCyclePhase()` / `G.cycleFrozen` | Central Cycle transitions (Esquive/Endure recharges, Éclipse, Momie) ; time cards |
| `ZENITH_BONUS_TXT` / `effProtect` / `canTargetSleeping` / `zenithTokenBoost` / `manualTriggerFaceDown` | Asymmetric zenith bonuses (3.1) |
| `predictCombat()` | **Pure dry-run** of doAttack's combat math — zero side effects, zero render. Powers the combat preview (7.2). Marks hidden info / RNG as « incertain ». Validated by `tools/test_preview.js` (211/211). |
| `notifyWake` / `notifyTrapReveal` / `notifyAllyDeath` / `markCombo` | Combo archetype hooks + instrumentation (6.4) |
| `ARENA` module (end of game.js) | Draft (40 picks of 1/4), StS run map (6 nodes + boss), run HP, broken-rule bosses, reward picks. `initGame(f1,f2,mode,{customDeck,difficulty,boss})`. The normal game is byte-identical when ARENA is null (golden-checked). |
| `showAIIntent` | AI intention badge (category only — no hidden info leak) |
| `TUTO` | 7 contextual tutorial popups (session memory only — R7: no localStorage) |

## v1-unification additions (brique A — Foi/Ascension)

| Section | Responsibility |
|---------|---------------|
| `FAITH_WIN` / `TURN_CAP` / `DESECRATE_FAITH` / `P2_START_FAITH` (+`setP2StartFaith`) | Constantes de Foi paramétrables en tête de fichier |
| `player.faith` / `player.supremeGod` / `card.kneeling` | État de la course à l'Ascension |
| `getVictoryState()` | Source unique de fin de partie : `{winner: 1\|2\|0, reason: 'hp'\|'ascension'\|'clock'}` ou null — consommée par checkVictory/checkVictoryBool ET tous les harnais |
| `canPray` / `doPray` / `prayWith` / `showActionMenu` | Guerre/Prière (humain : menu flottant ⚔️/🙏) |
| `aiPrayPhase` / `aiHasProductiveAttack` | IA : prie APRÈS léthal/anti-stall, jamais à la place d'une attaque productive |
| `desecrateIfKneeling` | Profanation sur les 3 sorties « vraie mort » de handleDeath |
| `hasEgide` / `protectedByEgide` / cap `fervor` / `exit_faith` / `_sanctuary` | Mots-clés moteur SANS porteur en v1 (décision Frank Q1) |

## Test harnesses (tools/)

| Tool | Checks |
|---|---|
| `golden.js` / `golden_check.js` | 200 seeded AI-vs-AI games, full action-log snapshot diff |
| `test_all_cards.js` | images, stats, cap handlers, anytime coherence, sim coverage |
| `test_factions.js [N]` | N games/matchup, sides alternated, per-faction winrates [45,55] |
| `test_arena.js [N]` | N full simulated runs (AI draft + map + bosses), 0 crash, avg duel ≤ 12 turns |
| `test_preview.js` | combat preview prediction == actual outcome (200+ combats) |
| `card_metrics.js [N] [--md out]` | per-card play rate / win contribution / avg turn + combo rates |
| `p1p2_diag.js [N]` | P1/P2 structural balance diagnostics |
| `test_faith.js [N=20]` | 25 paires × N parties : 0 crash, Ascension ∈ [5,40] %, durée ≤ 13 tours, ventilation victoires par faction × raison |

Gate factions (arbitrage Frank 2026-07-04) : `test_factions.js 200` — chaque
faction dans **[baseline ± 4pp]**, baseline fix-audit-v5 codée dans le harnais.
Le [45,55] absolu reste affiché à titre indicatif (egyptian ~59 % = dette
préexistante, nerf en phase 5).
