#!/usr/bin/env node
/**
 * p1p2_diag.js — Diagnostic instrumenté du déséquilibre P1/P2 (tâche 1.1a).
 *
 * Joue N parties IA vs IA seedées et mesure par partie :
 *   · le gagnant
 *   · qui attaque en premier sur board développé (les 2 camps ont ≥1 monstre)
 *   · delta de maxGems au tour 5 (P1 - P2, mesuré au début du tour 5 de P1)
 *   · delta de cartes jouées au tour 5 et en fin de partie
 *   · HP au tour 5
 *   · nb d'attaques exécutées par joueur (détection biais IA)
 *   · nb d'attaques SAUTÉES par le chemin "combat normal" par joueur
 *
 * Usage : node tools/p1p2_diag.js [nGames=500]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const GAME_SRC = path.join(ROOT, 'src', 'game.js');
const N_GAMES = parseInt(process.argv[2] || '500', 10);

// ── Stub DOM/Audio (identique à golden.js) ───────────────────────────────
const ANY = new Proxy(function () {}, {
  get(_t, prop) {
    if (prop === Symbol.iterator) return function* () {};
    if (prop === Symbol.toPrimitive) return () => '';
    if (prop === 'length') return 0;
    if (prop === 'style' || prop === 'classList' || prop === 'dataset') return ANY;
    if (prop === 'getBoundingClientRect') return () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 });
    if (prop === 'getChannelData') return () => new Float32Array(0);
    if (prop === 'querySelectorAll' || prop === 'getElementsByClassName') return () => [];
    if (prop === 'forEach' || prop === 'map' || prop === 'filter') return () => [];
    if (prop === 'contains') return () => false;
    if (prop === 'parentNode') return null;
    if (prop === 'nodeType') return 1;
    if (prop === 'textContent' || prop === 'innerHTML' || prop === 'value' || prop === 'className' || prop === 'src' || prop === 'id') return '';
    if (prop === 'offsetHeight' || prop === 'offsetWidth' || prop === 'currentTime' || prop === 'sampleRate') return 0;
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
  sandbox.requestAnimationFrame = () => 0; sandbox.cancelAnimationFrame = () => {};
  sandbox.queueMicrotask = (fn) => Promise.resolve().then(fn);
  const localStorage = { _d: {}, getItem(k){return this._d[k] ?? null;}, setItem(k,v){this._d[k]=String(v);}, removeItem(k){delete this._d[k];} };
  sandbox.localStorage = localStorage;
  const AudioCtx = function () { return ANY; };
  sandbox.window = { AudioContext: AudioCtx, webkitAudioContext: AudioCtx, addEventListener(){}, removeEventListener(){},
    requestAnimationFrame:()=>0, matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),
    getComputedStyle:()=>ANY, innerWidth:1280, innerHeight:800, devicePixelRatio:1, localStorage,
    setTimeout: sandbox.setTimeout, clearTimeout: sandbox.clearTimeout };
  sandbox.document = makeDocument(); sandbox.navigator = { userAgent: 'node-diag' };
  sandbox.performance = { now: () => 0 }; sandbox.location = { href:'', search:'', hash:'' };
  sandbox.Audio = function(){return ANY;}; sandbox.Image = function(){return ANY;};
  sandbox.AudioContext = AudioCtx; sandbox.webkitAudioContext = AudioCtx;
  sandbox.CustomEvent = function(){return ANY;}; sandbox.Event = function(){return ANY;};
  sandbox.console = console; sandbox.globalThis = sandbox;

  const src = fs.readFileSync(GAME_SRC, 'utf8');
  // Instrumentation : on enveloppe doAttack / playMonster / playGod / playSpell
  // pour compter attaques et cartes jouées par joueur, SANS toucher game.js.
  const boot = `
;globalThis.__STATS = null;
const __doAttack = doAttack;
doAttack = function(attackerP, attackerIdx, targetP, targetIdx, isSecond) {
  if (globalThis.__STATS) {
    const S = globalThis.__STATS;
    S.attacks[attackerP]++;
    const bothDeveloped = G.players[1].field.some(m=>m&&!m.faceDown) && G.players[2].field.some(m=>m&&!m.faceDown);
    if (S.firstDevAttacker === null && bothDeveloped) S.firstDevAttacker = attackerP;
  }
  return __doAttack(attackerP, attackerIdx, targetP, targetIdx, isSecond);
};
const __playMonster = playMonster;
playMonster = function(c, p) { if (globalThis.__STATS) globalThis.__STATS.played[p]++; return __playMonster(c, p); };
const __playGod = playGod;
playGod = function(c, p) { if (globalThis.__STATS) globalThis.__STATS.played[p]++; return __playGod(c, p); };
globalThis.__API = { FACTIONS, initGame, aiTurn, seedRNG, checkVictoryBool, getG: ()=>G, resetAI: ()=>{ aiThinking=false; } };
`;
  vm.createContext(sandbox);
  vm.runInContext(src + boot, sandbox, { filename: 'game.js' });
  return sandbox;
}

async function playOne(sandbox, f1, f2, seed) {
  const API = sandbox.__API;
  API.resetAI(); API.seedRNG(seed);
  const S = { attacks: {1:0, 2:0}, played: {1:0, 2:0}, firstDevAttacker: null,
              t5: null };
  sandbox.__STATS = S;
  API.initGame(f1, f2, 'sim');
  const G = API.getG();
  let guard = 0, error = null;
  try {
    while (!API.checkVictoryBool() && guard < 4000 && G.turn <= 200) {
      guard++;
      // Snapshot au début du tour 5 de P1
      if (G.turn === 5 && G.cp === 1 && S.t5 === null) {
        S.t5 = {
          maxGems: [G.players[1].maxGems, G.players[2].maxGems],
          hp: [G.players[1].hp, G.players[2].hp],
          played: { ...S.played },
          field: [G.players[1].field.filter(m=>m).length, G.players[2].field.filter(m=>m).length],
        };
      }
      await API.aiTurn(G.cp);
    }
  } catch (e) { error = String(e && e.message || e); }
  let winner = null;
  if (G.players[1].hp <= 0 && G.players[2].hp <= 0) winner = 'both';
  else if (G.players[1].hp <= 0) winner = 2;
  else if (G.players[2].hp <= 0) winner = 1;
  return { winner, error, turns: G.turn, S };
}

async function main() {
  const sandbox = loadGame();
  const F = sandbox.__API.FACTIONS;
  const agg = {
    n: 0, w1: 0, w2: 0, other: 0, errors: 0,
    firstDev: {1: 0, 2: 0, none: 0},
    firstDevWins: 0, firstDevGames: 0,
    gemDelta5: [], hpDelta5: [], playedDelta5: [], fieldDelta5: [],
    atk1: 0, atk2: 0, playedEnd1: 0, playedEnd2: 0, turns: [],
  };
  for (let seed = 1; seed <= N_GAMES; seed++) {
    const f1 = F[(seed - 1) % F.length];
    const f2 = F[Math.floor((seed - 1) / F.length) % F.length];
    const r = await playOne(sandbox, f1, f2, seed);
    agg.n++;
    if (r.error) { agg.errors++; continue; }
    if (r.winner === 1) agg.w1++; else if (r.winner === 2) agg.w2++; else agg.other++;
    const S = r.S;
    if (S.firstDevAttacker) {
      agg.firstDev[S.firstDevAttacker]++;
      agg.firstDevGames++;
      if (r.winner === S.firstDevAttacker) agg.firstDevWins++;
    } else agg.firstDev.none++;
    if (S.t5) {
      agg.gemDelta5.push(S.t5.maxGems[0] - S.t5.maxGems[1]);
      agg.hpDelta5.push(S.t5.hp[0] - S.t5.hp[1]);
      agg.playedDelta5.push(S.t5.played[1] - S.t5.played[2]);
      agg.fieldDelta5.push(S.t5.field[0] - S.t5.field[1]);
    }
    agg.atk1 += S.attacks[1]; agg.atk2 += S.attacks[2];
    agg.playedEnd1 += S.played[1]; agg.playedEnd2 += S.played[2];
    agg.turns.push(r.turns);
  }
  const avg = (a) => a.length ? (a.reduce((x,y)=>x+y,0)/a.length).toFixed(2) : 'n/a';
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  DIAGNOSTIC P1/P2 — ${agg.n} parties seedées`);
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Winrate P1 ............................ : ${(100*agg.w1/(agg.w1+agg.w2)).toFixed(1)}% (${agg.w1}/${agg.w1+agg.w2})`);
  console.log(`  Erreurs ............................... : ${agg.errors}`);
  console.log(`  1ʳᵉ attaque sur board développé ....... : P1 ${agg.firstDev[1]} · P2 ${agg.firstDev[2]} · aucune ${agg.firstDev.none}`);
  console.log(`  Winrate du 1ᵉʳ attaquant (dev board) .. : ${(100*agg.firstDevWins/Math.max(1,agg.firstDevGames)).toFixed(1)}%`);
  console.log(`  Δ maxGems au tour 5 (P1-P2) ........... : ${avg(agg.gemDelta5)}`);
  console.log(`  Δ HP au tour 5 (P1-P2) ................ : ${avg(agg.hpDelta5)}`);
  console.log(`  Δ cartes jouées au tour 5 (P1-P2) ..... : ${avg(agg.playedDelta5)}`);
  console.log(`  Δ taille board au tour 5 (P1-P2) ...... : ${avg(agg.fieldDelta5)}`);
  console.log(`  Attaques exécutées totales ............ : P1 ${agg.atk1} · P2 ${agg.atk2} (ratio P1/P2 = ${(agg.atk1/Math.max(1,agg.atk2)).toFixed(2)})`);
  console.log(`  Cartes jouées totales ................. : P1 ${agg.playedEnd1} · P2 ${agg.playedEnd2}`);
  console.log(`  Durée moyenne ......................... : ${avg(agg.turns)} tours`);
}
main().catch(e => { console.error(e); process.exit(1); });
