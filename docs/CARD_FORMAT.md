# Card Format Reference

Cards are defined as plain JavaScript objects in `index.html` (MONSTERS, GODS, SPELLS sections).

## Monster

```javascript
{
  id: 'KAPPA',          // Unique uppercase ID
  n: 'Kappa',           // Display name
  atk: 2,               // Attack value
  def: 3,               // Defense / Shield value
  cost: 2,              // Gem cost to play
  type: 'monster',      // 'monster' | 'god' | 'spell'
  faction: 'yokai',     // Set at runtime by buildDeck()
  cap: 'entry_sleep',   // Ability keyword (see Abilities below)
  txt: 'Entry: Put to sleep 1 Monster'  // Human-readable description
}
```

## God

```javascript
{
  id: 'TSUKUYOMI',
  n: 'Tsukuyomi',
  cost: 1,
  type: 'god',
  cap: 'god_sleep',
  txt: 'Put to sleep 1 Monster'
}
```

## Spell

```javascript
{
  id: 'SPELL_Y',
  n: 'Lancez de Vie',
  cost: 2,
  type: 'spell',
  cap: 'spell_dmg4',
  txt: 'Inflict 4 damage to target'
}
```

## Ability Keywords (cap values)

| Keyword | Effect |
|---------|--------|
| `hurry` | Can attack the turn it enters |
| `protect` | Must die before player is attackable |
| `endure` | Survives death once with 1 Shield |
| `hit` | Attacks twice |
| `heal` | Damage dealt = HP restored |
| `entry_action` | +1 Action on entry |
| `entry_sleep` | Puts 1 monster to sleep on entry |
| `entry_draw` | Draw 1 on entry |
| `exit_action` | +1 Action on death |
| `exit_destroy` | Destroys 1 monster/spell on death |
| `exit_curse` | Curses 1 monster on death |
| `god_sleep` | Anytime: put 1 monster to sleep |
| `god_cancel_ms` | Anytime: cancel 1 monster or spell |
| `fd_cancel_spell` | Face Down: cancel next opponent spell |
| `fd_cancel_monster` | Face Down: cancel next opponent monster |
| `fd_destroy_attacker` | Face Down: destroy next attacker |
| `fd_resurrect` | Face Down: resurrect on ally death |
| `esquive` | First attack received each Cycle phase misses (recharges on phase change) |
| `eclipse_buff` | +1/+1 each Cycle phase change |
| `prophete` | Always considered at zenith |
| `sacrifice_gems` | Sacrifice this monster: +2 gems |
| `reveil_buff` | When a monster wakes from Sleep: +2/+2, draw 1 |
| `entry_self_sleep` | Enters asleep (1 turn) |
| `momie` | First death: face down, rises at next Aube |
| `ragnarok_growing` | During Ténèbres: growing AoE each turn |
| `entry_oracle` | Look at top of opponent's deck; draw 1 if god |
| `trap_payoff` | Your face-down god revealed → 2 dmg to enemy player |
| `token_payoff_atk` | +1 ATK per allied token (combat) |
| `altar_payoff` | +1/+1 when an ally dies |
| `fortress_payoff` | ≥2 Remparts → +2 ATK and Frénésie |
| `riposte2` | Deals 2 damage to any attacker |
| `entry_cycle_advance1` / `entry_cycle_delay1` | Entry: advance / delay the Celestial Cycle by 1 phase |
| `entry_cycle_freeze1` | Entry: freeze the Cycle for 1 turn |
| `entry_cycle_prophecy` | Entry: look at the next 3 phases, choose the next one |
| `exit_cycle_delay1` | Death: delay the Cycle by 1 phase |
| `god_cycle_advance1` / `god_cycle_freeze2` / `god_cycle_random` | God: advance 1 / freeze 2 turns / reroll randomly |
| `god_cycle_prophecy` / `god_cycle_choose` | God: choose the next phase (among next 3 / among all) |
