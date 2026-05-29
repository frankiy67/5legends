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
