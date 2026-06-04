#!/usr/bin/env node
'use strict';
/**
 * test_desecrate.js — ÉTAPE 3 : valide l'expérience DESECRATE_FAITH + FAITH_WIN=16.
 *
 * Assertions :
 *  1. Créature AGENOUILLÉE tuée → l'adversaire (le tueur) gagne +1 Foi.
 *  2. Créature NON agenouillée tuée → aucune Foi gagnée.
 *  3. Atteindre 16 (et pas 14) déclenche la victoire (checkVictoryBool).
 *  4. Une créature agenouillée SANCTUARISÉE (improfanable) → aucune Foi.
 */
const { loadGameCustom } = require('./sim_core.js');

const API = loadGameCustom([
  'initGame', 'seedRNG', 'handleDeath', 'doPray', 'newCard',
  'checkVictoryBool', 'FAITH_WIN', 'DESECRATE_FAITH', 'TURN_CAP',
]);

let pass = 0, fail = 0;
function check(name, cond, extra = '') {
  if (cond) { console.log(`  ✓ ${name} ${extra}`); pass++; }
  else { console.log(`  ✗ ${name} ${extra}`); fail++; }
}

function freshBoard() {
  API.seedRNG(1);
  API.initGame('yokai', 'norse', 'sim');
  const G = API.getG();
  // Repart d'un plateau propre et de Foi 0/0 (initGame met P2 à +2).
  for (let p = 1; p <= 2; p++) { G.players[p].field = []; G.players[p].faith = 0; G.players[p].attacked = new Set(); }
  return G;
}
function putMonster(G, p, { atk = 3, def = 3, kneeling = false } = {}) {
  const m = API.newCard({ id: 'TEST', n: 'Cible', atk, def, cost: 1, type: 'monster', cap: '', txt: '', rarity: 'common', faction: G.players[p].faction });
  m.cAtk = atk; m.cDef = def; m.kneeling = kneeling;
  G.players[p].field.push(m);
  return m;
}

(async () => {
console.log(`Constantes du jeu : FAITH_WIN=${API.FAITH_WIN}, TURN_CAP=${API.TURN_CAP}, DESECRATE_FAITH=${API.DESECRATE_FAITH}`);
check('FAITH_WIN vaut 16', API.FAITH_WIN === 16, `(=${API.FAITH_WIN})`);
check('DESECRATE_FAITH vaut 1', API.DESECRATE_FAITH === 1, `(=${API.DESECRATE_FAITH})`);

console.log('\n[1] Créature AGENOUILLÉE de P1 tuée → +1 Foi pour P2 (le tueur) :');
{
  const G = freshBoard();
  const m = putMonster(G, 1, { kneeling: true });
  m.cDef = -1; // tuée
  const before = G.players[2].faith;
  await API.handleDeath(1, m);
  check('P2 gagne +1 Foi', G.players[2].faith === before + 1, `(${before} → ${G.players[2].faith})`);
  check('P1 (propriétaire) ne gagne rien', G.players[1].faith === 0, `(=${G.players[1].faith})`);
  check('la créature est bien retirée du plateau', G.players[1].field.length === 0);
}

console.log('\n[2] Créature NON agenouillée de P1 tuée → aucune Foi :');
{
  const G = freshBoard();
  const m = putMonster(G, 1, { kneeling: false });
  m.cDef = -1;
  const before = G.players[2].faith;
  await API.handleDeath(1, m);
  check('P2 ne gagne aucune Foi', G.players[2].faith === before, `(=${G.players[2].faith})`);
}

console.log('\n[3] Symétrie : créature agenouillée de P2 tuée → +1 Foi pour P1 :');
{
  const G = freshBoard();
  const m = putMonster(G, 2, { kneeling: true });
  m.cDef = -1;
  await API.handleDeath(2, m);
  check('P1 gagne +1 Foi', G.players[1].faith === 1, `(=${G.players[1].faith})`);
}

console.log('\n[4] Sanctuaire (agenouillé improfanable) → aucune Foi, survit :');
{
  const G = freshBoard();
  const m = putMonster(G, 1, { kneeling: true });
  m._sanctuary = true; m.cDef = -1;
  const before = G.players[2].faith;
  await API.handleDeath(1, m);
  check('P2 ne gagne aucune Foi', G.players[2].faith === before, `(=${G.players[2].faith})`);
  check('la créature survit (improfanable)', G.players[1].field.length === 1);
}

console.log('\n[5] Seuil de victoire = 16 (pas 14) :');
{
  const G = freshBoard();
  G.players[1].faith = 14;
  check('Foi=14 → PAS de victoire', API.checkVictoryBool() === false);
  G.players[1].faith = 15;
  check('Foi=15 → PAS de victoire', API.checkVictoryBool() === false);
  G.players[1].faith = 16;
  check('Foi=16 → victoire', API.checkVictoryBool() === true);
}

console.log('\n[6] Profanation peut FAIRE atteindre 16 (Foi-des-kills) :');
{
  const G = freshBoard();
  G.players[2].faith = 15; // à un cran de la victoire
  const m = putMonster(G, 1, { kneeling: true });
  m.cDef = -1;
  check('avant le kill : pas de victoire', API.checkVictoryBool() === false);
  await API.handleDeath(1, m); // P2 profane → +1 → 16
  check('après profanation : P2=16 et victoire', G.players[2].faith === 16 && API.checkVictoryBool() === true, `(P2=${G.players[2].faith})`);
}

console.log(`\n${fail === 0 ? '✓ TOUS LES TESTS PASSENT' : '✗ ÉCHECS'} — ${pass} ok / ${fail} ko`);
process.exit(fail === 0 ? 0 : 1);
})();
