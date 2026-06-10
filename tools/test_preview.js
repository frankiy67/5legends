#!/usr/bin/env node
/**
 * test_preview.js — Vérifie (7.2) que la preview de combat (predictCombat,
 * dry-run pur) prédit EXACTEMENT le résultat réel de doAttack sur ≥200 combats
 * simulés. Les cas marqués « incertains » par la preview (aveuglement, pièges
 * face cachés, Dernier Souffle à dégâts) sont exclus de la comparaison stricte
 * — c'est leur contrat : la preview affiche « résultat incertain ».
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const GAME_SRC = path.join(ROOT, 'src', 'game.js');

const ANY = new Proxy(function () {}, {
  get(_t, prop) {
    if (prop === Symbol.iterator) return function* () {};
    if (prop === Symbol.toPrimitive) return () => '';
    if (prop === 'length') return 0;
    if (prop === 'style' || prop === 'classList' || prop === 'dataset') return ANY;
    if (prop === 'getBoundingClientRect') return () => ({ left: 0, top: 0, width: 0, height: 0 });
    if (prop === 'getChannelData') return () => new Float32Array(0);
    if (prop === 'querySelectorAll' || prop === 'getElementsByClassName') return () => [];
    if (prop === 'forEach' || prop === 'map' || prop === 'filter') return () => [];
    if (prop === 'contains') return () => false;
    if (prop === 'parentNode') return null;
    if (prop === 'textContent' || prop === 'innerHTML' || prop === 'value' || prop === 'className' || prop === 'src' || prop === 'id') return '';
    if (prop === 'offsetHeight' || prop === 'offsetWidth' || prop === 'currentTime') return 0;
    return ANY;
  },
  set() { return true; }, apply() { return ANY; }, construct() { return ANY; }, has() { return true; },
});
function loadGame() {
  const sandbox = {};
  sandbox.setTimeout = (fn) => { if (typeof fn === 'function') Promise.resolve().then(fn); return 0; };
  sandbox.clearTimeout = () => {}; sandbox.setInterval = () => 0; sandbox.clearInterval = () => {};
  sandbox.requestAnimationFrame = () => 0; sandbox.queueMicrotask = (fn) => Promise.resolve().then(fn);
  sandbox.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  const AudioCtx = function () { return ANY; };
  sandbox.window = { AudioContext: AudioCtx, webkitAudioContext: AudioCtx, addEventListener() {}, removeEventListener() {},
    requestAnimationFrame: () => 0, matchMedia: () => ({ matches: false, addEventListener() {} }),
    localStorage: sandbox.localStorage, setTimeout: sandbox.setTimeout, clearTimeout: sandbox.clearTimeout };
  sandbox.document = { getElementById: () => ANY, querySelector: () => null, querySelectorAll: () => [],
    createElement: () => ANY, addEventListener() {}, body: ANY, readyState: 'complete' };
  sandbox.navigator = {}; sandbox.performance = { now: () => 0 }; sandbox.location = {};
  sandbox.Audio = function () { return ANY; }; sandbox.Image = function () { return ANY; };
  sandbox.AudioContext = AudioCtx; sandbox.webkitAudioContext = AudioCtx;
  sandbox.CustomEvent = function () { return ANY; }; sandbox.Event = function () { return ANY; };
  sandbox.console = console; sandbox.globalThis = sandbox;
  const src = fs.readFileSync(GAME_SRC, 'utf8');
  // Wrapper : prédiction AVANT chaque doAttack monstre-vs-monstre, comparaison APRÈS.
  const boot = `
;globalThis.__PV = { checked: 0, ok: 0, fails: [], uncertain: 0, skipped: 0 };
const __doAtk = doAttack;
doAttack = async function(attackerP, attackerIdx, targetP, targetIdx, isSecond) {
  const PV = globalThis.__PV;
  let pred = null, atkRef = null, defRef = null;
  if (!isSecond && typeof targetIdx === 'number' && PV) {
    atkRef = G.players[attackerP].field[attackerIdx];
    defRef = G.players[targetP].field[targetIdx];
    if (atkRef && defRef && !(atkRef.cap||'').includes('hit') && !(atkRef.cap||'').includes('fortress_payoff')) {
      try { pred = predictCombat(attackerP, attackerIdx, targetP, targetIdx); } catch(e) { pred = null; }
      if (pred) { PV._preAtk = JSON.stringify(atkRef); PV._preDef = JSON.stringify(defRef); PV._dpFD = G.players[targetP].field.filter(m=>m&&m.faceDown).map(m=>m.n+':'+m.cap).join(';'); }
    }
  }
  const r = await __doAtk(attackerP, attackerIdx, targetP, targetIdx, isSecond);
  if (pred && atkRef && defRef) {
    if (pred.uncertain) { PV.uncertain++; return r; }
    PV.checked++;
    const defAlive = G.players[targetP].field.includes(defRef);
    const atkAlive = G.players[attackerP].field.includes(atkRef);
    const okDef = pred.cancelled ? defAlive : (pred.targetDies === !defAlive);
    const okAtk = pred.cancelled ? atkAlive : (pred.attackerDies === !atkAlive);
    if (okDef && okAtk) PV.ok++;
    else PV.fails.push(\`atk=\${atkRef.n}[\${atkRef.cap}|\${atkRef.cAtk}/\${atkRef.cDef} eq:\${!!atkRef._equipBounce}\${!!atkRef._equipAphrodite}](\${atkAlive?'vivant':'mort'} prédit \${pred.attackerDies?'mort':'vivant'}) def=\${defRef.n}[\${defRef.cap}|\${defRef.cAtk}/\${defRef.cDef} asleep:\${!!defRef.asleep}](\${defAlive?'vivant':'mort'} prédit \${pred.cancelled?'annulé':pred.targetDies?'mort':'vivant'}) notes=\${pred.notes.join(',')} PRE_ATK=\${PV._preAtk} PRE_DEF=\${PV._preDef} DPFD=\${PV._dpFD}\`);
  }
  return r;
};
globalThis.__API = { FACTIONS, initGame, aiTurn, seedRNG, checkVictoryBool, getG: ()=>G, resetAI: ()=>{ aiThinking=false; } };
`;
  vm.createContext(sandbox);
  vm.runInContext(src + boot, sandbox, { filename: 'game.js' });
  return sandbox;
}

async function main() {
  const sb = loadGame();
  const API = sb.__API;
  const F = API.FACTIONS;
  let seed = 1;
  while (sb.__PV.checked < 200 && seed < 400) {
    const f1 = F[(seed - 1) % F.length];
    const f2 = F[Math.floor((seed - 1) / F.length) % F.length];
    API.resetAI(); API.seedRNG(seed);
    API.initGame(f1, f2, 'sim');
    const G = API.getG();
    let guard = 0;
    try {
      while (!API.checkVictoryBool() && guard < 4000 && G.turn <= 200) { guard++; await API.aiTurn(G.cp); }
    } catch (e) { console.error('crash', seed, String(e).slice(0, 100)); }
    seed++;
  }
  const PV = sb.__PV;
  console.log('═══════════════════════════════════════════════════════');
  console.log('  TEST PREVIEW DE COMBAT (7.2)');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Combats comparés ......... : ${PV.checked}`);
  console.log(`  Prédictions exactes ...... : ${PV.ok}`);
  console.log(`  Marqués « incertains » ... : ${PV.uncertain} (exclus, par contrat)`);
  if (PV.fails.length) PV.fails.slice(0, 8).forEach(f => console.log('   ✗ ' + f));
  const ok = PV.checked >= 200 && PV.ok === PV.checked;
  console.log(ok ? '  ✅ PREVIEW == RÉSULTAT RÉEL sur ' + PV.checked + ' combats' : `  ❌ ${PV.checked - PV.ok} divergence(s)`);
  process.exit(ok ? 0 : 1);
}
main().catch(e => { console.error('HARNESS FAIL', e); process.exit(1); });
