#!/usr/bin/env node
/**
 * test_faith.js — 500 parties IA vs IA pour valider le système de Foi (brique A).
 *
 * 25 paires ordonnées de factions × 20 parties seedées = 500.
 * CRITÈRES (consignes v1-unification) :
 *   · 0 crash JS
 *   · taux de victoires par ASCENSION ∈ [5, 40] %
 *   · durée moyenne ≤ 13 tours
 * Diagnostics affichés en plus : répartition hp/ascension/horloge/nul,
 * prières par partie, profanations, Foi finale moyenne.
 *
 * Usage : node tools/test_faith.js [gamesParPaire=20]
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
  const boot = `\n;globalThis.__API = { FACTIONS, initGame, aiTurn, seedRNG, checkVictoryBool, getVictoryState, getG: ()=>G, resetAI: ()=>{ aiThinking=false; }, FAITH_WIN, TURN_CAP };\n`;
  vm.createContext(sandbox);
  vm.runInContext(src + boot, sandbox, { filename: 'game.js' });
  return sandbox.__API;
}

async function playOne(API, f1, f2, seed) {
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
  // Prières exécutées = somme de la Foi acquise par prière ; approximation par
  // le log serait fragile — on lit directement la Foi finale des deux camps.
  return {
    turns: G.turn, error,
    winner: vs ? vs.winner : null,
    reason: vs ? vs.reason : null,
    faith1: G.players[1].faith || 0,
    faith2: G.players[2].faith || 0,
  };
}

async function main() {
  const API = loadGame();
  const F = API.FACTIONS;
  const pairs = [];
  for (const a of F) for (const b of F) pairs.push([a, b]);

  let total = 0, crashes = 0, turnsSum = 0, unfinished = 0;
  const byReason = { hp: 0, ascension: 0, clock: 0, draw: 0 };
  // Diagnostic : victoires par faction × raison (hp / ascension / clock).
  const fWins = {};
  F.forEach(f => { fWins[f] = { hp: 0, ascension: 0, clock: 0, games: 0 }; });
  let faithSum = 0, faithMax = 0;
  let seed = 1;
  const t0 = Date.now();
  for (const [f1, f2] of pairs) {
    for (let g = 0; g < GAMES_PER_PAIR; g++) {
      const r = await playOne(API, f1, f2, seed++);
      total++;
      turnsSum += r.turns;
      fWins[f1].games++; fWins[f2].games++;
      if (r.error) { crashes++; console.log(`  💥 ${f1} vs ${f2} seed=${seed-1}: ${r.error}`); }
      if (r.winner === null) unfinished++;
      else if (r.winner === 0) byReason.draw++;
      else {
        byReason[r.reason] = (byReason[r.reason] || 0) + 1;
        const wf = r.winner === 1 ? f1 : f2;
        fWins[wf][r.reason]++;
      }
      faithSum += r.faith1 + r.faith2;
      faithMax = Math.max(faithMax, r.faith1, r.faith2);
    }
  }
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  const avgTurns = turnsSum / total;
  const ascPct = 100 * byReason.ascension / total;
  const clockPct = 100 * byReason.clock / total;

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  TEST FAITH — ${total} parties (FAITH_WIN=${API.FAITH_WIN}, TURN_CAP=${API.TURN_CAP})`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Victoires par PV ........... : ${byReason.hp} (${(100*byReason.hp/total).toFixed(1)}%)`);
  console.log(`  Victoires par ASCENSION .... : ${byReason.ascension} (${ascPct.toFixed(1)}%)`);
  console.log(`  Victoires à l'horloge T${API.TURN_CAP} .. : ${byReason.clock} (${clockPct.toFixed(1)}%)`);
  console.log(`  Matchs nuls ................ : ${byReason.draw}`);
  console.log(`  Parties inachevées ......... : ${unfinished}`);
  console.log(`  Durée moyenne .............. : ${avgTurns.toFixed(2)} tours`);
  console.log(`  Foi finale moyenne (2 camps) : ${(faithSum/total/2).toFixed(2)} (max vu : ${faithMax})`);
  console.log(`  Crashs JS .................. : ${crashes}`);
  console.log(`  Durée réelle ............... : ${dt}s`);
  console.log('  ' + '─'.repeat(60));
  console.log('  VICTOIRES PAR FACTION × RAISON (winrate global, miroirs inclus)');
  for (const f of F) {
    const w = fWins[f];
    const tot = w.hp + w.ascension + w.clock;
    const wr = w.games ? (100 * tot / w.games) : 0;
    console.log(`    ${f.padEnd(10)} : ${wr.toFixed(1).padStart(5)}%  (hp ${w.hp} · asc ${w.ascension} · horloge ${w.clock})`);
  }
  console.log('  ' + '─'.repeat(60));

  const okCrash = crashes === 0 && unfinished === 0;
  const okAsc = ascPct >= 5 && ascPct <= 40;
  const okTurns = avgTurns <= 13;
  console.log(`  ${okCrash ? '✅' : '❌'} 0 crash / 0 inachevée`);
  console.log(`  ${okAsc ? '✅' : '❌'} Ascension ∈ [5, 40] % (mesuré : ${ascPct.toFixed(1)}%)`);
  console.log(`  ${okTurns ? '✅' : '❌'} durée moyenne ≤ 13 tours (mesuré : ${avgTurns.toFixed(2)})`);
  process.exit(okCrash && okAsc && okTurns ? 0 : 1);
}
main().catch(e => { console.error('HARNESS FAIL', e); process.exit(1); });
