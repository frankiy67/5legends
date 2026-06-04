#!/usr/bin/env node
'use strict';
/**
 * test_player_hp.js — BRIQUE 2, ÉTAPE 3 : validation PV joueur + visage + victoire.
 *
 *  1. Attaque au visage retire bien les PV (= attaque de la créature).
 *  2. Taunt (Protect) bloque le visage (IA cible la gardienne, pas le joueur).
 *  3. PV <= 0 → victoire de l'adversaire (checkVictoryBool + decideWinner).
 *  4. Priorité Foi sur PV ; horloge départage Foi puis PV.
 */
const { loadGameCustom, decideWinner } = require('./sim_core.js');

const API = loadGameCustom([
  'initGame', 'seedRNG', 'doAttack', 'newCard', 'pickAITarget',
  'checkVictoryBool', 'PLAYER_HP', 'FAITH_WIN', 'TURN_CAP',
]);
const FW = API.FAITH_WIN, TC = API.TURN_CAP;

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { console.log(`  ✓ ${name} ${extra}`); pass++; }
  else { console.log(`  ✗ ${name} ${extra}`); fail++; }
};

function board() {
  API.seedRNG(1);
  API.initGame('yokai', 'norse', 'sim');
  const G = API.getG();
  for (let p = 1; p <= 2; p++) { G.players[p].field = []; G.players[p].faith = 0; G.players[p].hp = PLAYER_HP; G.players[p].attacked = new Set(); G.players[p].summoned = new Set(); }
  return G;
}
const PLAYER_HP = API.PLAYER_HP;
function put(G, p, { atk = 3, def = 3, cap = '' } = {}) {
  const m = API.newCard({ id: 'T', n: 'Créature', atk, def, cost: 1, type: 'monster', cap, txt: '', rarity: 'common', faction: G.players[p].faction });
  m.cAtk = atk; m.cDef = def;
  G.players[p].field.push(m);
  return m;
}

console.log(`Constantes : PLAYER_HP=${PLAYER_HP}, FAITH_WIN=${FW}, TURN_CAP=${TC}`);
check('PLAYER_HP vaut 25', PLAYER_HP === 25);

(async () => {
  console.log('\n[1] Attaque au visage retire les PV (= ATK de la créature) :');
  {
    const G = board();
    const atk = put(G, 2, { atk: 7 });          // P2 attaque P1
    const before = G.players[1].hp;
    await API.doAttack(2, 0, 1, 'player');
    check('PV de P1 retirés du montant d\'ATK', G.players[1].hp === before - 7, `(${before} → ${G.players[1].hp})`);
    check('la créature attaquante survit', G.players[2].field.length === 1);
  }

  console.log('\n[2] Taunt (Protect) bloque le visage :');
  {
    const G = board();
    put(G, 2, { atk: 30 });                      // attaquant létal de P2
    G.players[1].hp = 5;                          // P1 à portée de létal
    put(G, 1, { atk: 1, def: 4, cap: 'protect' });// gardienne Taunt chez P1
    const tgt = API.pickAITarget(1, 2);          // P2 choisit sa cible contre P1
    check('IA cible la gardienne (indice 0), PAS le visage', tgt === 0, `(cible=${JSON.stringify(tgt)})`);
  }
  console.log('\n[2b] Sans Taunt + létal → IA va au visage :');
  {
    const G = board();
    put(G, 2, { atk: 30 });
    G.players[1].hp = 5;                          // pas de gardienne
    const tgt = API.pickAITarget(1, 2);
    check('IA cible le visage (\'player\')', tgt === 'player', `(cible=${JSON.stringify(tgt)})`);
  }
  console.log('\n[2c] Sans Taunt mais NON létal + aucune créature → pas de cible (comportement inchangé) :');
  {
    const G = board();
    put(G, 2, { atk: 3 });
    G.players[1].hp = 25;                         // 3 < 25 : non létal, P1 sans créature
    const tgt = API.pickAITarget(1, 2);
    check('IA ne va PAS au visage (null)', tgt === null, `(cible=${JSON.stringify(tgt)})`);
  }

  console.log('\n[3] PV <= 0 → fin de partie (checkVictoryBool) :');
  {
    const G = board();
    check('PV pleins → pas de fin', API.checkVictoryBool() === false);
    G.players[1].hp = 0;
    check('P1 à 0 PV → fin', API.checkVictoryBool() === true);
  }

  console.log('\n[4] Priorité Foi/PV + départage horloge (decideWinner) :');
  // Foi : priorité absolue (même si le gagnant est à 0 PV)
  check('Foi>=WIN gagne malgré 0 PV', decideWinner(FW, 0, 0, 25, 5, FW, TC).winner === 1);
  check('double Foi = both', decideWinner(FW, FW, 25, 25, 5, FW, TC).winner === 'both');
  // PV : l'adversaire du joueur à 0 PV gagne
  check('P1 à 0 PV → P2 gagne (raison hp)', (() => { const r = decideWinner(2, 2, 0, 25, 5, FW, TC); return r.winner === 2 && r.endReason === 'hp'; })());
  check('P2 à 0 PV → P1 gagne', decideWinner(2, 2, 25, 0, 5, FW, TC).winner === 1);
  // Horloge : Foi d'abord
  check('horloge : plus de Foi gagne', (() => { const r = decideWinner(5, 3, 10, 20, TC + 1, FW, TC); return r.winner === 1 && r.endReason === 'clock'; })());
  // Horloge : Foi égale → PV départage
  check('horloge : Foi égale → plus de PV gagne', decideWinner(5, 5, 20, 10, TC + 1, FW, TC).winner === 1);
  // Horloge : Foi ET PV égaux → nul
  check('horloge : Foi+PV égaux → nul', decideWinner(5, 5, 15, 15, TC + 1, FW, TC).winner === null);

  console.log(`\n${fail === 0 ? '✓ TOUS LES TESTS PASSENT' : '✗ ÉCHECS'} — ${pass} ok / ${fail} ko`);
  process.exit(fail === 0 ? 0 : 1);
})();
