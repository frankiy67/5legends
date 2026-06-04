#!/usr/bin/env node
'use strict';
/**
 * test_cycles.js — BRIQUE 3, ÉTAPE 5 : validation des 5 cycles + rubber-band.
 *
 *  1. Chaque cycle applique son effet (Aube pioche, Zénith +1 ATK, Crépuscule
 *     +1 DEF, Nuit sacrifice→+1 Foi, Tempête 1 dégât).
 *  2. Buffs temporaires (Zénith/Crépuscule) retirés en fin de tour, stats de base intactes.
 *  3. Rubber-band : le joueur EN RETARD tire ~75% de cycles comeback.
 *  4. Tempête sans cible ennemie = pas d'erreur, effet perdu.
 */
const { loadGameCustom } = require('./sim_core.js');

const API = loadGameCustom([
  'initGame', 'seedRNG', 'newCard', 'applyCycleEffect', 'clearCycleBuffs',
  'drawCycleKey', 'isBehind', 'CYCLES', 'CYCLE_KEYS', 'aiControls', 'FAITH_WIN',
]);

let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { console.log(`  ✓ ${n} ${x}`); pass++; } else { console.log(`  ✗ ${n} ${x}`); fail++; } };

function board() {
  API.seedRNG(1);
  API.initGame('greek', 'norse', 'sim');
  const G = API.getG();
  for (let p = 1; p <= 2; p++) { G.players[p].field = []; G.players[p].faith = 0; G.players[p].hp = 25; }
  return G;
}
function put(G, p, { atk = 3, def = 3 } = {}) {
  const m = API.newCard({ id: 'T', n: 'C', atk, def, cost: 1, type: 'monster', cap: '', txt: '', rarity: 'common', faction: G.players[p].faction });
  m.cAtk = atk; m.cDef = def; G.players[p].field.push(m); return m;
}

(async () => {
  console.log('[1] Effets des 5 cycles :');
  // Aube : pioche +1
  { const G = board(); const before = G.players[1].hand.length; await API.applyCycleEffect(1, 'aube'); check('Aube : +1 carte', G.players[1].hand.length === before + 1, `(${before}→${G.players[1].hand.length})`); }
  // Zénith : +1 ATK aux créatures en jeu
  { const G = board(); const m = put(G, 1, { atk: 3, def: 4 }); await API.applyCycleEffect(1, 'zenith'); check('Zénith : +1 ATK', m.cAtk === 4 && m.atk === 3, `(cAtk=${m.cAtk}, base=${m.atk})`); }
  // Crépuscule : +1 DEF
  { const G = board(); const m = put(G, 1, { atk: 3, def: 4 }); await API.applyCycleEffect(1, 'crepuscule'); check('Crépuscule : +1 DEF', m.cDef === 5 && m.def === 4, `(cDef=${m.cDef}, base=${m.def})`); }
  // Nuit (IA en retard) : sacrifie la plus faible → +1 Foi
  { const G = board(); G.players[1].faith = 0; G.players[2].faith = 5; const weak = put(G, 1, { atk: 1, def: 1 }); put(G, 1, { atk: 5, def: 5 });
    await API.applyCycleEffect(1, 'nuit');
    check('Nuit (IA en retard) : +1 Foi', G.players[1].faith === 1, `(foi=${G.players[1].faith})`);
    check('Nuit : la plus faible sacrifiée', !G.players[1].field.includes(weak)); }
  // Nuit (IA en avance) : passe
  { const G = board(); G.players[1].faith = 5; G.players[2].faith = 0; put(G, 1, { atk: 1, def: 1 });
    await API.applyCycleEffect(1, 'nuit'); check('Nuit (IA en avance) : passe (Foi inchangée)', G.players[1].faith === 5); }
  // Tempête (IA) : 1 dégât à une créature à 1 PV → la tue
  { const G = board(); const lowHp = put(G, 2, { atk: 9, def: 1 }); put(G, 2, { atk: 2, def: 5 });
    await API.applyCycleEffect(1, 'tempete'); check('Tempête : tue la créature à 1 PV', !G.players[2].field.includes(lowHp)); }

  console.log('\n[2] Buffs temporaires retirés en fin de tour (stats de base intactes) :');
  { const G = board(); const m = put(G, 1, { atk: 3, def: 4 });
    await API.applyCycleEffect(1, 'zenith'); await API.applyCycleEffect(1, 'crepuscule');
    check('pendant le tour : +1/+1', m.cAtk === 4 && m.cDef === 5);
    API.clearCycleBuffs(G.players[1]);
    check('fin de tour : buffs retirés', m.cAtk === 3 && m.cDef === 4, `(cAtk=${m.cAtk}, cDef=${m.cDef})`);
    check('stats de base jamais modifiées', m.atk === 3 && m.def === 4); }

  console.log('\n[3] Rubber-band : joueur en retard → ~75% comeback :');
  { const G = board(); G.players[1].faith = 0; G.players[2].faith = 8;   // P1 en retard
    check('isBehind(P1) vrai', API.isBehind(1) === true);
    check('isBehind(P2) faux', API.isBehind(2) === false);
    let comeback = 0; const N = 40000;
    for (let k = 0; k < N; k++) { const key = API.drawCycleKey(1); if (API.CYCLES[key].type === 'comeback') comeback++; }
    const ratio = comeback / N;
    check('P1 en retard : comeback ≈ 75%', ratio > 0.70 && ratio < 0.80, `(${(ratio * 100).toFixed(1)}%)`);
    // joueur à égalité : 3 comeback / 5 = 60%
    G.players[1].faith = 5; G.players[2].faith = 5; G.players[1].hp = 25; G.players[2].hp = 25;
    check('isBehind(P1) faux à égalité', API.isBehind(1) === false);
    let cb2 = 0; for (let k = 0; k < N; k++) { if (API.CYCLES[API.drawCycleKey(1)].type === 'comeback') cb2++; }
    const r2 = cb2 / N;
    check('égalité : comeback ≈ 60% (poids égaux, 3/5)', r2 > 0.55 && r2 < 0.65, `(${(r2 * 100).toFixed(1)}%)`); }

  console.log('\n[4] Tempête sans cible ennemie = pas d\'erreur, effet perdu :');
  { const G = board(); put(G, 1, { atk: 3, def: 3 }); /* P2 vide */
    let threw = false; try { await API.applyCycleEffect(1, 'tempete'); } catch (e) { threw = true; }
    check('aucune exception', threw === false); }

  console.log(`\n${fail === 0 ? '✓ TOUS LES TESTS PASSENT' : '✗ ÉCHECS'} — ${pass} ok / ${fail} ko`);
  process.exit(fail === 0 ? 0 : 1);
})();
