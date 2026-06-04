#!/usr/bin/env node
'use strict';
/**
 * test_god_powers.js — BRIQUE 4, ÉTAPE 6 : validation des 10 pouvoirs de dieu.
 *
 * Chaque pouvoir applique son effet ; coût 2 gems déduit ; 1×/tour respecté ;
 * buffs temporaires retirés ; résurrection ; zèle ; prière exaltée +1 Foi.
 */
const { loadGameCustom } = require('./sim_core.js');

const API = loadGameCustom([
  'initGame', 'seedRNG', 'newCard', 'activateGodPower', 'canActivateGod',
  'godPowerUsable', 'clearCycleBuffs', 'doPray', 'handleDeath',
  'GOD_POWER_COST', 'PLAYER_HP',
]);

let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { console.log(`  ✓ ${n} ${x}`); pass++; } else { console.log(`  ✗ ${n} ${x}`); fail++; } };

function setup(power, p = 1) {
  API.seedRNG(1);
  API.initGame('greek', 'norse', 'sim');
  const G = API.getG();
  for (let q = 1; q <= 2; q++) { G.players[q].field = []; G.players[q].faith = 0; G.players[q].hp = 25; G.players[q].gems = 5; G.players[q].godUsedThisTurn = false; G.players[q].summoned = new Set(); G.players[q]._lastDead = null; G.players[q]._exaltedPrayer = false; }
  G.cp = p;
  G.players[p].godPower = power; G.players[p].godName = 'Zeus'; G.players[p].god = 'ZEUS';
  return G;
}
function put(G, p, { atk = 3, def = 3 } = {}) {
  const m = API.newCard({ id: 'T', n: 'C', atk, def, cost: 1, type: 'monster', cap: '', txt: '', rarity: 'common', faction: G.players[p].faction });
  m.cAtk = atk; m.cDef = def; G.players[p].field.push(m); return m;
}

(async () => {
  console.log('[Effets des 10 pouvoirs]');
  // 1 frappe_divine
  { const G = setup('frappe_divine'); const e = put(G, 2, { def: 5 }); await API.activateGodPower(1, 2, 0);
    check('frappe_divine : -2 DEF ennemie', e.cDef === 3, `(${e.cDef})`);
    check('  coût 2 gems déduit', G.players[1].gems === 3, `(${G.players[1].gems})`); }
  // 2 benediction (+1/+1 permanent : base AUSSI augmentée)
  { const G = setup('benediction'); const m = put(G, 1, { atk: 3, def: 4 }); await API.activateGodPower(1, 1, 0);
    check('benediction : +1/+1', m.cAtk === 4 && m.cDef === 5, `(${m.cAtk}/${m.cDef})`);
    check('  permanent (base modifiée)', m.atk === 4 && m.def === 5); }
  // 3 vision
  { const G = setup('vision'); const before = G.players[1].hand.length; await API.activateGodPower(1); check('vision : +1 carte', G.players[1].hand.length === before + 1); }
  // 4 guerison
  { const G = setup('guerison'); G.players[1].hp = 18; await API.activateGodPower(1); check('guerison : +3 PV', G.players[1].hp === 21, `(${G.players[1].hp})`);
    G.players[1].godUsedThisTurn = false; G.players[1].hp = 24; await API.activateGodPower(1); check('guerison : plafonné à PLAYER_HP', G.players[1].hp === 25); }
  // 5 inspiration (temp)
  { const G = setup('inspiration'); const m = put(G, 1, { atk: 3, def: 4 }); await API.activateGodPower(1, 1, 0);
    check('inspiration : +2 ATK', m.cAtk === 5, `(${m.cAtk})`);
    API.clearCycleBuffs(G.players[1]); check('  retiré en fin de tour', m.cAtk === 3 && m.atk === 3); }
  // 6 bouclier (temp)
  { const G = setup('bouclier'); const m = put(G, 1, { atk: 3, def: 4 }); await API.activateGodPower(1, 1, 0);
    check('bouclier : +2 DEF', m.cDef === 6, `(${m.cDef})`);
    API.clearCycleBuffs(G.players[1]); check('  retiré en fin de tour', m.cDef === 4 && m.def === 4); }
  // 7 zele
  { const G = setup('zele'); const m = put(G, 1, { atk: 4, def: 3 }); G.players[1].summoned = new Set([0]); put(G, 2, { def: 2 });
    check('  zèle utilisable (mal d\'invocation présent)', API.godPowerUsable(1) === true);
    await API.activateGodPower(1, 1, 0);
    check('zele : mal d\'invocation retiré', !G.players[1].summoned.has(0)); }
  { const G = setup('zele'); put(G, 1, { atk: 4, def: 3 }); G.players[1].summoned = new Set(); // pas de mal d'invocation
    check('  zèle grisé sans mal d\'invocation', API.godPowerUsable(1) === false); }
  // 8 priere_exaltee
  { const G = setup('priere_exaltee'); const m = put(G, 1, { atk: 2, def: 2 }); await API.activateGodPower(1);
    check('priere_exaltee : flag posé', G.players[1]._exaltedPrayer === true);
    const f0 = G.players[1].faith; API.doPray(1, 0);
    check('  prochaine prière : +2 Foi (1 + bonus)', G.players[1].faith === f0 + 2, `(${f0}→${G.players[1].faith})`);
    check('  flag consommé', G.players[1]._exaltedPrayer === false); }
  // 9 foudre
  { const G = setup('foudre'); const a = put(G, 2, { def: 1 }), b = put(G, 2, { def: 3 }); await API.activateGodPower(1);
    check('foudre : tue les créatures à 1 PV', !G.players[2].field.includes(a));
    check('  -1 DEF aux autres', b.cDef === 2, `(${b.cDef})`); }
  // 10 resurrection
  { const G = setup('resurrection'); const m = put(G, 1, { atk: 5, def: 4 }); m.cDef = -1; await API.handleDeath(1, m);
    check('  résurrection utilisable (créature morte)', API.godPowerUsable(1) === true);
    const n0 = G.players[1].field.length; await API.activateGodPower(1);
    check('resurrection : créature ramenée', G.players[1].field.length === n0 + 1);
    const rev = G.players[1].field[G.players[1].field.length - 1];
    check('  cDef=1, stats d\'origine, mal d\'invocation', rev.cDef === 1 && rev.cAtk === 5 && G.players[1].summoned.has(G.players[1].field.length - 1)); }
  { const G = setup('resurrection'); check('  résurrection grisée sans mort', API.godPowerUsable(1) === false); }

  console.log('\n[Contraintes]');
  // 1×/tour
  { const G = setup('vision'); await API.activateGodPower(1);
    check('1×/tour : godUsedThisTurn posé', G.players[1].godUsedThisTurn === true);
    check('  2e activation refusée (canActivateGod faux)', API.canActivateGod(1) === false);
    const h = G.players[1].hand.length; await API.activateGodPower(1); check('  2e activation sans effet', G.players[1].hand.length === h); }
  // gems insuffisants
  { const G = setup('vision'); G.players[1].gems = 1; check('grisé si gems<2', API.canActivateGod(1) === false); }
  // hors de son tour
  { const G = setup('vision', 1); G.cp = 2; check('grisé hors de son tour', API.canActivateGod(1) === false); }

  console.log(`\n${fail === 0 ? '✓ TOUS LES TESTS PASSENT' : '✗ ÉCHECS'} — ${pass} ok / ${fail} ko`);
  process.exit(fail === 0 ? 0 : 1);
})();
