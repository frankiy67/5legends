#!/usr/bin/env node
/**
 * test_factions.js — 100 parties IA vs IA sur tous les matchups de factions.
 *
 * 10 matchups (les 10 paires distinctes de 5 factions) × 10 parties = 100.
 * Pour chaque partie on vérifie :
 *   · Aucun crash JS (capturé par try/catch autour de la boucle de jeu).
 *   · Aucun timeout anormal (> 60 tours).
 *   · La partie se termine proprement (un vainqueur est désigné).
 *
 * Usage : node tools/test_factions.js
 * Sortie : 0 si tout passe, 1 sinon.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const GAME_SRC = path.join(ROOT, 'src', 'game.js');
const GAMES_PER_MATCHUP = parseInt(process.argv[2] || '10', 10);
const TURN_LIMIT = 60;     // au-delà → timeout anormal
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
  const boot = `\n;globalThis.__API = { FACTIONS, initGame, aiTurn, seedRNG, checkVictoryBool, getVictoryState, getG: ()=>G, resetAI: ()=>{ aiThinking=false; } };\n`;
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
  // ASCENSION (brique A) : le gagnant vient de getVictoryState (PV, Ascension
  // ou horloge T18). Double-KO ('both') conservé ; match nul horloge → 'both'
  // aussi (fin propre sans vainqueur, exclue du winrate comme avant).
  let winner = null;
  const vs = API.getVictoryState();
  if (G.players[1].hp <= 0 && G.players[2].hp <= 0) winner = 'both';
  else if (vs && vs.winner === 0) winner = 'both';
  else if (vs) winner = vs.winner;
  return { turns: G.turn, winner, error };
}

async function main() {
  const API = loadGame();
  const F = API.FACTIONS;
  // 10 paires distinctes (sans miroir)
  const matchups = [];
  for (let i = 0; i < F.length; i++) for (let j = i + 1; j < F.length; j++) matchups.push([F[i], F[j]]);

  let total = 0, crashes = 0, timeouts = 0, unfinished = 0;
  const rows = [];
  let seed = 1;
  const t0 = Date.now();
  // Agrégat par faction (winrate toutes positions confondues).
  const fWins = {}, fGames = {};
  F.forEach(f => { fWins[f] = 0; fGames[f] = 0; });
  for (const [fa, fb] of matchups) {
    let w1 = 0, w2 = 0, maxTurn = 0, crash = 0, to = 0, unf = 0;
    for (let g = 0; g < GAMES_PER_MATCHUP; g++) {
      // Alternance des côtés pour neutraliser tout biais P1/P2 résiduel.
      const swap = g % 2 === 1;
      const [f1, f2] = swap ? [fb, fa] : [fa, fb];
      const r = await playOne(API, f1, f2, seed++);
      total++;
      maxTurn = Math.max(maxTurn, r.turns);
      if (r.error) { crash++; crashes++; }
      if (r.turns > TURN_LIMIT) { to++; timeouts++; }
      // Un double-KO ('both') est une fin PROPRE (morts simultanées sur AoE) —
      // seul un null (vrai timeout sans vainqueur) compte comme inachevé.
      if (r.winner === null) { unf++; unfinished++; }
      if (r.winner === 1 || r.winner === 2) {
        const winF = r.winner === 1 ? f1 : f2;
        if (winF === fa) w1++; else w2++;
        fWins[winF]++; fGames[fa]++; fGames[fb]++;
      }
    }
    rows.push({ m: `${fa} vs ${fb}`, w1, w2, maxTurn, crash, to, unf });
  }
  const dt = ((Date.now() - t0) / 1000).toFixed(1);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  100 PARTIES — TOUS LES MATCHUPS DE FACTIONS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Matchup'.padEnd(26) + 'W1  W2  maxT  crash  >60t  inachevé');
  console.log('  ' + '─'.repeat(60));
  for (const r of rows) {
    console.log('  ' + r.m.padEnd(24) +
      String(r.w1).padStart(2) + '  ' + String(r.w2).padStart(2) + '   ' +
      String(r.maxTurn).padStart(3) + '   ' + String(r.crash).padStart(3) + '   ' +
      String(r.to).padStart(3) + '     ' + String(r.unf).padStart(3));
  }
  console.log('  ' + '─'.repeat(60));
  console.log(`  Total parties ........ : ${total}`);
  console.log(`  Crashs JS ............ : ${crashes}`);
  console.log(`  Timeouts (>${TURN_LIMIT} tours) : ${timeouts}`);
  console.log(`  Parties inachevées ... : ${unfinished}`);
  console.log(`  Durée ................ : ${dt}s`);
  console.log('  ' + '─'.repeat(60));
  // ── GATE FACTIONS v1-unification (arbitrage Frank 2026-07-04, P4) ────────
  // Gate RELATIF : chaque faction dans [baseline ± 4pp], baseline mesurée sur
  // fix-audit-v5 (9c7be21) à N=200. Le [45,55] absolu reste affiché à titre
  // indicatif (egyptian ~59 % = dette préexistante, nerf reporté phase 5).
  // Le verdict relatif n'est significatif qu'à N ≥ 200 (SE ≈ 1,8pp).
  const BASELINE = { yokai: 51.1, norse: 46.5, egyptian: 59.3, greek: 47.1, aztec: 46.0 };
  const GATE_PP = 4;
  const relGate = GAMES_PER_MATCHUP >= 200;
  let relFails = 0;
  console.log(`  WINRATE PAR FACTION (indicatif [45,55] · gate = baseline ±${GATE_PP}pp${relGate ? '' : ' — N<200, non contractuel'})`);
  for (const f of F) {
    const wr = fGames[f] ? (100 * fWins[f] / fGames[f]) : 0;
    const abs = wr >= 45 && wr <= 55 ? '✅' : '❌';
    const d = wr - BASELINE[f];
    const rel = Math.abs(d) <= GATE_PP ? '✅' : '❌';
    if (relGate && Math.abs(d) > GATE_PP) relFails++;
    console.log(`    ${f.padEnd(10)} : ${wr.toFixed(1)}%  (${fWins[f]}/${fGames[f]})  [45,55]:${abs}  Δbaseline ${d >= 0 ? '+' : ''}${d.toFixed(1)}pp:${rel}`);
  }
  console.log('───────────────────────────────────────────────────────────────');
  const clean = crashes === 0 && timeouts === 0 && unfinished === 0;
  if (clean && (!relGate || relFails === 0)) {
    console.log(`  ✅ ${total}/${total} parties propres` + (relGate ? ` · gate relatif ±${GATE_PP}pp OK` : ''));
    process.exit(0);
  } else {
    console.log(`  ❌ ${!clean ? 'Anomalies détectées' : `Gate relatif ±${GATE_PP}pp en échec (${relFails} faction(s))`}`);
    process.exit(1);
  }
}
main().catch(e => { console.error('HARNESS FAIL', e); process.exit(1); });
