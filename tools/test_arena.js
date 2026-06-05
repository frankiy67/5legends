#!/usr/bin/env node
'use strict';
/**
 * test_arena.js — BRIQUE 7 Phase 9. Tests scriptés du mode Arena (assertions).
 *  1. Draft IA = 40 cartes valides (id/faction/type).
 *  2. arenaDraw4 : 4 cartes distinctes + ≥1 de la faction choisie.
 *  3. arenaOppProfile : bons ensembles par palier de victoires.
 *  4. Une run (sim) s'arrête exactement à 12V ou 3D, compteur cohérent.
 *  5. Le draft humain (pool complet) reste multi-faction disponible.
 * Sortie non-zéro si un test échoue.
 */
const { loadGameCustom } = require('./sim_core');
const API = loadGameCustom([
  'initGame', 'aiTurn', 'seedRNG', 'checkVictoryBool', 'setAIProfile',
  'FACTIONS', 'randomGodAssign', 'FAITH_WIN', 'TURN_CAP', 'rng',
  'buildCardPool', 'arenaAIDraft', 'arenaDraw4', 'arenaOppProfile',
  'ARENA_WINS_GOAL', 'ARENA_LOSSES_MAX',
]);

let fails = 0;
function ok(cond, msg) { if (cond) console.log('  ✓ ' + msg); else { console.log('  ✗ ' + msg); fails++; } }

(async () => {
  // 1. Draft IA = 40 cartes valides
  console.log('1. Draft IA — 40 cartes valides');
  for (const f of API.FACTIONS) {
    API.seedRNG(100 + f.length);
    const d = API.arenaAIDraft(f);
    ok(d.length === 40, `${f}: 40 cartes (${d.length})`);
    ok(d.every(c => c.id && c.faction && (c.type === 'monster' || c.type === 'god')), `${f}: toutes valides`);
  }

  // 2. arenaDraw4 — 4 distinctes + ≥1 faction choisie
  console.log('2. arenaDraw4 — 4 distinctes, ≥1 faction choisie');
  const pool = API.buildCardPool();
  let dup = 0, missingFac = 0, badSize = 0;
  for (let i = 0; i < 500; i++) {
    API.seedRNG(2000 + i);
    const f = API.FACTIONS[i % 5];
    const p = API.arenaDraw4(pool, f);
    if (p.length !== 4) badSize++;
    if (new Set(p.map(c => c.id)).size !== p.length) dup++;
    if (!p.some(c => c.faction === f)) missingFac++;
  }
  ok(badSize === 0, `taille 4 (échecs:${badSize})`);
  ok(dup === 0, `aucun doublon intra-pick (échecs:${dup})`);
  ok(missingFac === 0, `≥1 carte faction choisie (échecs:${missingFac})`);

  // 3. arenaOppProfile — paliers
  console.log('3. arenaOppProfile — paliers de difficulté');
  const seen = { low: new Set(), mid: new Set(), high: new Set() };
  for (let i = 0; i < 400; i++) {
    API.seedRNG(3000 + i);
    seen.low.add(API.arenaOppProfile(1));
    seen.mid.add(API.arenaOppProfile(5));
    seen.high.add(API.arenaOppProfile(10));
  }
  ok([...seen.low].every(p => p === 'CONTROL'), `0-3V : CONTROL seul (${[...seen.low].join(',')})`);
  ok([...seen.mid].sort().join(',') === 'CONTROL,GUARD,RUSH', `4-7V : {CONTROL,RUSH,GUARD} (${[...seen.mid].sort().join(',')})`);
  ok([...seen.high].sort().join(',') === 'CONTROL,GUARD,RAID,RUSH', `8-11V : {RUSH,GUARD,RAID,CONTROL} (${[...seen.high].sort().join(',')})`);

  // 4. Une run s'arrête à 12V ou 3D, compteur cohérent
  console.log('4. Run — arrêt à 12V/3D, compteur cohérent');
  let badStop = 0, counterBad = 0;
  for (let r = 0; r < 20; r++) {
    API.seedRNG(5000 + r);
    const pfac = API.FACTIONS[r % 5];
    const deck = API.arenaAIDraft(pfac);
    const god = API.randomGodAssign(pfac);
    let wins = 0, losses = 0, m = 0;
    while (wins < API.ARENA_WINS_GOAL && losses < API.ARENA_LOSSES_MAX && m < 60) {
      const ofac = API.FACTIONS[(r * 7 + m) % 5];
      API.seedRNG(5000 + r * 131 + m * 7);
      API.initGame(pfac, ofac, 'sim', { customDeck: deck });
      const G = API.getG();
      G.players[1].god = god.godId; G.players[1].godName = god.godName; G.players[1].godPower = god.godPower;
      API.setAIProfile(1, 'CONTROL'); API.setAIProfile(2, API.arenaOppProfile(wins));
      let g = 0;
      while (!API.checkVictoryBool() && G.turn <= 50 && g < 4000) { g++; await API.aiTurn(G.cp); if (API.checkVictoryBool()) break; }
      const f1 = G.players[1].faith || 0, f2 = G.players[2].faith || 0;
      let res;
      if (f1 >= API.FAITH_WIN && f2 < API.FAITH_WIN) res = 'win';
      else if (f2 >= API.FAITH_WIN && f1 < API.FAITH_WIN) res = 'loss';
      else if (G.turn > API.TURN_CAP) res = f1 > f2 ? 'win' : 'loss';
      else res = 'loss';
      if (res === 'win') wins++; else losses++;
      m++;
    }
    const stoppedRight = (wins === API.ARENA_WINS_GOAL) || (losses === API.ARENA_LOSSES_MAX);
    if (!stoppedRight) badStop++;
    if (wins > API.ARENA_WINS_GOAL || losses > API.ARENA_LOSSES_MAX) counterBad++;
  }
  ok(badStop === 0, `20 runs s'arrêtent à 12V ou 3D (échecs:${badStop})`);
  ok(counterBad === 0, `compteur jamais dépassé (échecs:${counterBad})`);

  // 5. Pool complet multi-faction disponible pour le draft humain
  console.log('5. Pool complet multi-faction');
  const facs = new Set(pool.map(c => c.faction));
  ok(facs.size === 5, `5 factions dans le pool (${[...facs].sort().join(',')})`);
  ok(pool.some(c => c.type === 'god'), 'cartes dieu incluses dans le pool');
  ok(pool.length > 150, `pool conséquent (${pool.length} cartes)`);

  console.log(fails === 0 ? '\n✅ TOUS LES TESTS ARENA PASSENT' : `\n❌ ${fails} test(s) en échec`);
  process.exit(fails === 0 ? 0 : 1);
})();
