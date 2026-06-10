#!/usr/bin/env node
/**
 * test_arena.js — 100 runs d'Arena simulées de bout en bout (tâche 4.5).
 *
 * Pour chaque run : draft IA (40 picks de 1 sur 4), traversée de la carte
 * (6 nœuds Combat/Élite/Sanctuaire + Boss à règle cassée), duels joués
 * IA vs IA en mode 'sim' avec le deck custom drafté côté joueur.
 *
 * CRITÈRES : 0 crash · durée moyenne d'un duel ≤ 12 tours.
 *
 * Usage : node tools/test_arena.js [nRuns=100]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const GAME_SRC = path.join(ROOT, 'src', 'game.js');
const N_RUNS = parseInt(process.argv[2] || '100', 10);

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
  sandbox.document = makeDocument(); sandbox.navigator = { userAgent: 'node-arena' };
  sandbox.performance = { now: () => 0 }; sandbox.location = { href:'', search:'', hash:'', reload(){} };
  sandbox.Audio = function(){return ANY;}; sandbox.Image = function(){return ANY;};
  sandbox.AudioContext = AudioCtx; sandbox.webkitAudioContext = AudioCtx;
  sandbox.CustomEvent = function(){return ANY;}; sandbox.Event = function(){return ANY;};
  sandbox.console = console; sandbox.globalThis = sandbox;
  const src = fs.readFileSync(GAME_SRC, 'utf8');
  const boot = `\n;globalThis.__API = { FACTIONS, initGame, aiTurn, seedRNG, checkVictoryBool,
    arenaAIDraft, arenaGenMap, arenaNodeDifficulty, ARENA_BOSS_DEFS,
    getG: ()=>G, resetAI: ()=>{ aiThinking=false; } };\n`;
  vm.createContext(sandbox);
  vm.runInContext(src + boot, sandbox, { filename: 'game.js' });
  return sandbox.__API;
}

// Joue UN duel IA vs IA (deck custom côté p1). Renvoie {winner, turns, error}.
async function playDuel(API, faction, deck, oppFaction, difficulty, boss) {
  API.resetAI();
  API.initGame(faction, oppFaction, 'sim', { customDeck: deck, difficulty, boss });
  const G = API.getG();
  let guard = 0, error = null;
  try {
    while (!API.checkVictoryBool() && guard < 4000 && G.turn <= 200) { guard++; await API.aiTurn(G.cp); }
  } catch (e) { error = (e && e.stack ? e.stack.split('\n').slice(0,2).join(' | ') : String(e)); }
  let winner = null;
  if (G.players[1].hp <= 0) winner = 2;
  else if (G.players[2].hp <= 0) winner = 1;
  return { winner, turns: G.turn, error };
}

// Politique IA de la carte de run : Sanctuaire (soin) si HP ≤ 15, sinon
// Élite 1 fois sur 2 quand dispo, sinon Combat.
function pickNodeOption(opts, runHP, rngBit) {
  if (opts[0].startsWith('boss:')) return opts[0];
  if (runHP <= 15 && opts.includes('sanctuaire')) return 'sanctuaire';
  if (opts.includes('elite') && rngBit) return 'elite';
  return 'combat';
}

async function playRun(API, seed) {
  const F = API.FACTIONS;
  API.seedRNG(seed);
  const faction = F[(seed - 1) % F.length];
  const deck = API.arenaAIDraft(faction, 40);
  const map = API.arenaGenMap(faction);
  let runHP = 25, wins = 0, losses = 0, node = 0;
  const duels = [];
  let error = null, champion = false;

  while (node < map.length && runHP > 0) {
    const opts = map[node];
    const choice = pickNodeOption(opts, runHP, (seed + node) % 2 === 0);
    if (choice === 'sanctuaire') {
      // soin (la variante "retrait de carte" est testée côté politique humaine)
      runHP = Math.min(25, runHP + 5);
      node++;
      continue;
    }
    const isBoss = choice.startsWith('boss:');
    const bossId = isBoss ? choice.slice(5) : null;
    const kind = isBoss ? 'boss' : choice;
    const difficulty = API.arenaNodeDifficulty(node + 1, kind);
    const oppFaction = isBoss ? API.ARENA_BOSS_DEFS[bossId].faction
      : F[Math.floor(Math.abs(Math.sin(seed * 97 + node)) * F.length) % F.length];
    const r = await playDuel(API, faction, deck, oppFaction, difficulty, bossId);
    duels.push(r);
    if (r.error) { error = r.error; break; }
    const won = r.winner === 1;
    if (won) {
      wins++;
      if (isBoss) { champion = true; node++; break; }
      // récompense : l'IA ajoute 1 (combat) ou 2 (élite) cartes draftées
      const extra = API.arenaAIDraft(faction, kind === 'elite' ? 2 : 1);
      deck.push(...extra);
      node++;
    } else {
      losses++;
      runHP -= 10;
      if (!isBoss) node++; // boss perdu : on retente (HP de run en moins)
    }
  }
  return { seed, faction, champion, eliminated: runHP <= 0, wins, losses, runHP, duels, error };
}

async function main() {
  const API = loadGame();
  let crashes = 0, champions = 0, eliminated = 0, totalDuels = 0, totalTurns = 0;
  let bossDuels = 0, bossWins = 0, maxTurns = 0;
  const errors = [];
  const t0 = Date.now();
  for (let seed = 1; seed <= N_RUNS; seed++) {
    const r = await playRun(API, seed);
    if (r.error) { crashes++; errors.push(`run ${seed}: ${r.error}`); }
    if (r.champion) champions++;
    if (r.eliminated) eliminated++;
    for (const d of r.duels) {
      totalDuels++; totalTurns += d.turns; maxTurns = Math.max(maxTurns, d.turns);
    }
    bossDuels += r.duels.filter((d, i) => r.champion && i === r.duels.length - 1).length;
    if (r.champion) bossWins++;
  }
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  const avgTurns = totalDuels ? (totalTurns / totalDuels) : 0;
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  TEST ARENA — ${N_RUNS} runs simulées complètes`);
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Duels joués .............. : ${totalDuels}`);
  console.log(`  Durée moyenne d'un duel .. : ${avgTurns.toFixed(1)} tours (max ${maxTurns})`);
  console.log(`  Champions (boss vaincu) .. : ${champions}/${N_RUNS}`);
  console.log(`  Éliminés (HP de run = 0) . : ${eliminated}/${N_RUNS}`);
  console.log(`  Crashs ................... : ${crashes}`);
  console.log(`  Durée .................... : ${dt}s`);
  if (errors.length) errors.slice(0, 5).forEach(e => console.log('   · ' + e));
  console.log('───────────────────────────────────────────────────────');
  const ok = crashes === 0 && avgTurns <= 12;
  console.log(ok ? '  ✅ CRITÈRES ATTEINTS (0 crash, durée ≤ 12 tours)' : '  ❌ CRITÈRES NON ATTEINTS');
  process.exit(ok ? 0 : 1);
}
main().catch(e => { console.error('HARNESS FAIL', e); process.exit(1); });
