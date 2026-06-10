# 5 Legends — Game Rules

## Setup
- Each player selects a faction
- Each player's deck is a fixed **57 cards**: 42 monsters (commons ×3, uncommons ×2, rares ×1) + 15 gods
- Each player starts with **25 HP** and **1 Gem**
- Player 1 goes first with **4 cards** in hand; Player 2 gets **5 cards** plus **+1 temporary Gem on each of their first two turns** (going-second compensation)
- Both players then **mulligan**: starting hand face up, check any cards to replace (one pass), confirm — replaced cards are reshuffled into the deck

## Turn Structure

### Main 1
Play monsters, gods, or spells using your gems. You can play multiple cards per turn as long as you have gems.

### Combat
Attack with your monsters. Select a monster to attack, then choose a target (opponent monster or opponent directly).

### Main 2
Play more cards after combat.

### End
Turn passes to the opponent. The gem cap is the **round number** (capped at 10) — identical for both players.

## Playing Cards

**Cost**: Each card has a gem cost shown in the top-left. Spend that many gems to play it.

**Monsters**: Enter your field (max 6 monsters). Can attack next turn (unless they have **Hurry**).

**Gods**: Powerful effects. Most are played immediately and go to the graveyard. Greek Gods enter **Face Down** and trigger automatically.

**Spells**: Instant effects, go to graveyard after use.

## Combat

1. Click a monster to select it as attacker (must be in Combat phase)
2. Choose a target: an opponent's monster, or attack the player directly
3. **Protect** monsters must be destroyed before you can attack the player directly
4. Both monsters deal damage to each other simultaneously
5. A monster with 0 or less Shield is destroyed

## Losing

A player loses when their HP reaches 0.

## Special Rules

### Anytime Cards
Cards with an orange **ANYTIME** border can be played during the opponent's turn, before they resolve their action. Press **SPACE** or click OK when it's your reaction window.

### Face Down (Greek Gods)
Greek Gods enter the field face down (hidden). They automatically flip and trigger when their condition is met (e.g., Apollo flips when the opponent plays a Spell).

### Sleep
A sleeping monster turns face down and cannot be targeted or attack. It wakes up after 2 of the opponent's turns.

### Endure
When an Endure monster would die, it instead returns to the field with 1 Shield and loses all abilities. It can only Endure once.

### Cursed
A cursed monster dies from any single point of damage.

### The Celestial Cycle & Asymmetric Zeniths
The Cycle advances one phase at the end of each round: 🌅 Aube → ☀️ Midi → 🌆 Crépuscule → 🌙 Nuit → 🌑 Ténèbres → (repeat).
Each faction unlocks its **signature bonus** while its phase is active (its *zenith*):
- **Egyptian — Aube**: your summoned tokens get **+1/+1 and Hurry**
- **Greek — Midi**: your face-down gods can be **triggered manually** (click) in addition to their auto trigger
- **Aztec — Crépuscule**: your monsters' **Endure recharges** (they can endure again)
- **Yokai — Nuit**: your Sleep lasts **1 extra turn**, and **sleeping enemy monsters become targetable** (they don't strike back)
- **Norse — Ténèbres**: all your monsters gain **Protect**

### Time Manipulation Cards
Each faction has 2 cards that manipulate the Cycle: advance it, delay it, freeze it
(the Cycle does not advance while frozen), reroll it randomly, or **Prophétie**
(look at the next 3 phases and choose which comes next).

### Keywords (proprietary vocabulary)
**Élan** (attack the turn it enters) · **Rempart** (must be destroyed before the player
can be attacked) · **Frénésie** (attacks twice) · **Offrande** (damage dealt heals you) ·
**Immortel** (survives its first death with 1 shield) · **Éveil** (on entry) ·
**Dernier Souffle** (on death) · **Malédiction** (1 damage kills).

### Unique abilities (6.2)
- **Éclipse** : +1/+1 each time the Cycle changes phase.
- **Prophète** : always considered at its zenith.
- **Sacrifice** (aztec) : sacrifice this monster for +2 gems (button in Main phases).
- **Réveil** (yokai) : when a monster wakes from Sleep, +2/+2 and draw 1.
- **Momie** (egyptian) : first death → returns face down, rises at the next Aube.
- **Ragnarök** (norse, Fenrir) : during Ténèbres, growing damage to all enemies each turn.
- **Oracle** (greek) : on entry, look at the top of the opponent's deck; draw 1 if it's a god.
- **Toile** (greek) : when one of your face-down gods is revealed, 2 damage to the enemy player.
- **Marée** (egyptian) : +1 ATK per allied token in combat.
- **Autel** (aztec) : permanent +1/+1 whenever an ally dies.
- **Forteresse** (norse) : while you control ≥2 Remparts, +2 ATK and Frénésie.
- **Riposte** (norse, Garm) : deals 2 damage to any attacker.

### Esquive (Dodge)
The first attack this monster receives during each Celestial Cycle phase **misses**.
The dodge recharges every time the Cycle changes phase. A 💨 badge shows while the
dodge is available. (Deterministic replacement of the old 50% coin-flip defense.)


## ARENA Mode (recommended)

1. **Draft** : pick 1 card out of 4, 40 times — full multi-faction pool (each pick
   guarantees at least 1 card of your chosen pantheon).
2. **The Run** (Slay the Spire style) : 6 nodes with 2-3 branching options + 1 Boss.
   - **Combat** : normal opponent — reward: 1 card pick (1 of 4)
   - **Élite** : AI +1 difficulty — reward: 2 picks
   - **Sanctuaire** : heal 5 run HP **or** remove 1 card from your deck
3. **Run HP** : start at 25 ; a lost duel = −10 run HP ; 0 = the run ends.
   A lost boss duel costs 10 HP but you may retry it.
4. **Bosses with broken rules** (announced on screen, final boss drawn outside your faction):
   - **Zeus** : the Celestial Cycle advances every turn
   - **Anubis** : the boss's first destroyed monster each turn returns to play
   - **Odin** : starts with two 0/4 Rempart walls
   - **Quetzalcoatl** : all the boss's monsters have Immortel
   - **Amaterasu** : the Cycle is locked on Nuit for the whole duel
