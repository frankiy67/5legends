#!/usr/bin/env node
/**
 * test_omens.js — 500 parties IA vs IA pour valider la Frise du Destin (brique D).
 *
 * 25 paires ordonnées de factions × 20 parties seedées = 500.
 * CRITÈRES (consignes v1-unification) :
 *   · 0 crash JS
 *   · les présages se déclenchent À LA BONNE PHASE : chaque fireOmen a lieu
 *     exactement au tick d'échéance (G.cycleTick === dueTick) — vérifié par
 *     instrumentation (réassignation de scheduleOmen/fireOmen dans le boot,
 *     même technique que test_preview avec doAttack)
 *   · durée moyenne ≤ 13 tours
 * Sanity : au moins un présage inscrit ET déclenché sur la batterie.
 *
 * Usage : node tools/test_omens.js [gamesParPaire=20]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const GAME_SRC = path.join(ROOT, 'src', 'game.js');
const GAMES_PER_PAIR = parseInt(process.argv[2] || '20', 10);
const HARD_GUARD = 4000;

// ── Stub DOM/Audio (identique à golden.js) ───────────────────────────────
const ANY = new Proxy(function () {}, {
  get(_t, prop) {
    if (prop === Symbol.iterator) return function* () {};
    if (prop === Symbol.toPrimitive) return () => '';
    if (prop === 'length') return 0;
    if (prop === 'style' || prop === 'classList' || prop === 'dataset') return ANY;
    if (prop === 'getBoundingClientRect') return () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 });
    if (prop === 'querySelectorAll' || prop === 'getElementsByClassName') return () => [];
    if (prop === 'forEach' || prop === 'map' || prop === 'filter') return () => [];
    if (prop === 'contains') return () => false;
    if (prop === 'parentNode') return null;
    if (prop === 'nodeType') return 1;
    if (prop === 'textContent' || prop === 'innerHTML' || prop === 'value' || prop === 'className' || prop === 'src' || prop === 'id') return '';
    if (prop === 'offsetHeight' || prop === 'offsetWidth' || prop === 'currentTime') return 0;
    return ANY;
  },
  set() { return true; }, apply() { return ANY; }, construct() { return ANY; }, has() { return true; },
});
function makeDocument() {
  return {
    getElementById: () => ANY, querySelector: () => ANY, querySelectorAll: () => [],
    getElementsByClassName: () => [], createElement: () => ANY, createTextNode: () => ANY,
    addEventListener: () => {}, removeEventListener: () => {}, body: ANY, head: ANY,
    documentElement: ANY, readyState: 'complete',
    fonts: { ready: Promise.resolve(), load: () => Promise.resolve(), add: () => {} },
  };
}
function loadGame() {
  const sandbox = {};
  sandbox.setTimeout = (fn) => { if (typeof fn === 'function') Promise.resolve().then(fn); return 0; };
  sandbox.clearTimeout = () => {}; sandbox.setInterval = () => 0; sandbox.clearInterval = () => {};
  sandbox.requestAnimationFrame = () => 0; sandbox.queueMicrotask = (fn) => Promise.resolve().then(fn);
  const localStorage = { _d: {}, getItem(k){return this._d[k] ?? null;}, setItem(k,v){this._d[k]=String(v);}, removeItem(k){delete this._d[k];} };
  sandbox.localStorage = localStorage;
  const AudioCtx = function () { return ANY; };
  sandbox.window = { AudioContext: AudioCtx, webkitAudioContext: AudioCtx, addEventListener(){}, removeEventListener(){},
    requestAnimationFrame:()=>0, matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),
    getComputedStyle:()=>ANY, innerWidth:1280, innerHeight:800, devicePixelRatio:1, localStorage,
    setTimeout: sandbox.setTimeout, clearTimeout: sandbox.clearTimeout };
  sandbox.document = makeDocument(); sandbox.navigator = { userAgent: 'node-test' };
  sandbox.performance = { now: () => 0 }; sandbox.location = { href:'', search:'', hash:'' };
  sandbox.Audio = function(){return ANY;}; sandbox.Image = function(){return ANY;};
  sandbox.AudioContext = AudioCtx; sandbox.webkitAudioContext = AudioCtx;
  sandbox.CustomEvent = function(){return ANY;}; sandbox.Event = function(){return ANY;};
  sandbox.console = console; sandbox.globalThis = sandbox;
  const src = fs.readFileSync(GAME_SRC, 'utf8');
  // Instrumentation : compte les inscriptions et vérifie que chaque présage
  // se déclenche EXACTEMENT à son tick d'échéance.
  const boot = `
globalThis.__OM = { scheduled: 0, fired: 0, offTick: [] };
const __schedOmen = scheduleOmen;
scheduleOmen = function(ownerP, effectId, delta, label, cardName) {
  globalThis.__OM.scheduled++;
  return __schedOmen(ownerP, effectId, delta, label, cardName);
};
const __fireOmen = fireOmen;
fireOmen = async function(o) {
  globalThis.__OM.fired++;
  if (G.cycleTick !== o.dueTick) globalThis.__OM.offTick.push({ due: o.dueTick, at: G.cycleTick, card: o.cardName });
  return __fireOmen(o);
};
globalThis.__API = { FACTIONS, initGame, aiTurn, seedRNG, checkVictoryBool, getVictoryState, getG: ()=>G, resetAI: ()=>{ aiThinking=false; } };
`;
  vm.createContext(sandbox);
  vm.runInContext(src + boot, sandbox, { filename: 'game.js' });
  return sandbox;
}

async function playOne(sb, f1, f2, seed) {
  const API = sb.__API;
  API.resetAI(); API.seedRNG(seed);
  API.initGame(f1, f2, 'sim');
  const G = API.getG();
  let guard = 0, error = null;
  try {
    while (!API.checkVictoryBool() && guard < HARD_GUARD) { guard++; await API.aiTurn(G.cp); }
  } catch (e) {
    error = (e && e.stack ? e.stack.split('\n')[0] : String(e));
  }
  const vs = API.getVictoryState();
  return { turns: G.turn, error, winner: vs ? vs.winner : null, pendingLeft: (G._omensPending||[]).length };
}

async function main() {
  const sb = loadGame();
  const API = sb.__API;
  const F = API.FACTIONS;
  const pairs = [];
  for (const a of F) for (const b of F) pairs.push([a, b]);

  let total = 0, crashes = 0, turnsSum = 0, unfinished = 0, pendingLeak = 0;
  let seed = 1;
  const t0 = Date.now();
  for (const [f1, f2] of pairs) {
    for (let g = 0; g < GAMES_PER_PAIR; g++) {
      const r = await playOne(sb, f1, f2, seed++);
      total++;
      turnsSum += r.turns;
      if (r.error) { crashes++; console.log(`  💥 ${f1} vs ${f2} seed=${seed-1}: ${r.error}`); }
      if (r.winner === null) unfinished++;
      if (r.pendingLeft > 0) pendingLeak++; // présage échu jamais résolu en fin de partie ≠ bug (fin de partie), informatif
    }
  }
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  const OM = sb.__OM;
  const avgTurns = turnsSum / total;

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  TEST OMENS — ${total} parties (Frise du Destin, brique D)`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Présages inscrits .......... : ${OM.scheduled}`);
  console.log(`  Présages déclenchés ........ : ${OM.fired} (les non-déclenchés = partie finie avant l'échéance)`);
  console.log(`  Déclenchés HORS tick ....... : ${OM.offTick.length}`);
  if (OM.offTick.length) OM.offTick.slice(0, 5).forEach(o => console.log(`     ✗ ${o.card} : dû au tick ${o.due}, déclenché au tick ${o.at}`));
  console.log(`  Parties avec file résiduelle : ${pendingLeak}`);
  console.log(`  Durée moyenne .............. : ${avgTurns.toFixed(2)} tours`);
  console.log(`  Parties inachevées ......... : ${unfinished}`);
  console.log(`  Crashs JS .................. : ${crashes}`);
  console.log(`  Durée réelle ............... : ${dt}s`);
  console.log('  ' + '─'.repeat(60));

  const okCrash = crashes === 0 && unfinished === 0;
  const okTick = OM.offTick.length === 0 && OM.scheduled > 0 && OM.fired > 0;
  const okTurns = avgTurns <= 13;
  console.log(`  ${okCrash ? '✅' : '❌'} 0 crash / 0 inachevée`);
  console.log(`  ${okTick ? '✅' : '❌'} présages déclenchés à la bonne phase (tick exact), ${OM.fired}/${OM.scheduled} déclenchés`);
  console.log(`  ${okTurns ? '✅' : '❌'} durée moyenne ≤ 13 tours (mesuré : ${avgTurns.toFixed(2)})`);
  process.exit(okCrash && okTick && okTurns ? 0 : 1);
}
main().catch(e => { console.error('HARNESS FAIL', e); process.exit(1); });
