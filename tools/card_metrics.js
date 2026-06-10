#!/usr/bin/env node
/**
 * card_metrics.js — Métriques par carte (tâche 6.3) + détection de combos (6.4c).
 *
 * Sur N parties IA vs IA seedées (matchups cyclés) :
 *   · play rate    = parties où la carte a été JOUÉE / parties où elle a été EN MAIN
 *   · win contrib  = winrate(jouée) − winrate(non jouée mais en main)  [points de %]
 *   · tour moyen de jeu
 *   · combos : % de parties où le combo signature de la faction s'est déclenché
 *     (G._combo[faction], posé par les handlers markCombo)
 *
 * Usage : node tools/card_metrics.js [nGames=1500] [--md docs/CARD_METRICS.md]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const GAME_SRC = path.join(ROOT, 'src', 'game.js');
const N_GAMES = parseInt(process.argv[2] || '1500', 10);
const MD_OUT = process.argv.includes('--md') ? process.argv[process.argv.indexOf('--md') + 1] : null;

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
  sandbox.document = makeDocument(); sandbox.navigator = { userAgent: 'node-metrics' };
  sandbox.performance = { now: () => 0 }; sandbox.location = { href:'', search:'', hash:'', reload(){} };
  sandbox.Audio = function(){return ANY;}; sandbox.Image = function(){return ANY;};
  sandbox.AudioContext = AudioCtx; sandbox.webkitAudioContext = AudioCtx;
  sandbox.CustomEvent = function(){return ANY;}; sandbox.Event = function(){return ANY;};
  sandbox.console = console; sandbox.globalThis = sandbox;
  const src = fs.readFileSync(GAME_SRC, 'utf8');
  // Instrumentation : joue/main par carte, par partie.
  const boot = `
;globalThis.__M = null;
const __pm = playMonster, __pg = playGod;
playMonster = function(c, p) { if (globalThis.__M && c && c.id && c.cost !== 0) globalThis.__M.played[p].set(c.id, G.turn); return __pm(c, p); };
playGod = function(c, p) { if (globalThis.__M && c && c.id) globalThis.__M.played[p].set(c.id, G.turn); return __pg(c, p); };
globalThis.__sampleHands = function() {
  if (!globalThis.__M) return;
  for (const p of [1,2]) for (const c of G.players[p].hand) if (c && c.id) globalThis.__M.inHand[p].add(c.id);
};
globalThis.__API = { FACTIONS, MONSTERS, GODS, initGame, aiTurn, seedRNG, checkVictoryBool,
  getG: ()=>G, resetAI: ()=>{ aiThinking=false; } };
`;
  vm.createContext(sandbox);
  vm.runInContext(src + boot, sandbox, { filename: 'game.js' });
  return sandbox;
}

async function main() {
  const sb = loadGame();
  const API = sb.__API;
  const F = API.FACTIONS;
  // stats par carte
  const S = {}; // id -> {faction, type, cost, inHand, played, winPlayed, winInHandNotPlayed, nNotPlayed, turnSum}
  const cardMeta = {};
  for (const f of F) {
    for (const m of API.MONSTERS[f]) cardMeta[m.id] = { faction: f, type: 'monster', cost: m.cost, n: m.n };
    for (const g of API.GODS[f]) cardMeta[g.id] = { faction: f, type: g.type || 'god', cost: g.cost, n: g.n };
  }
  for (const id in cardMeta) S[id] = { inHand: 0, played: 0, winPlayed: 0, winNot: 0, notPlayed: 0, turnSum: 0 };
  const combo = {}; const comboGames = {};
  F.forEach(f => { combo[f] = 0; comboGames[f] = 0; });

  for (let seed = 1; seed <= N_GAMES; seed++) {
    const f1 = F[(seed - 1) % F.length];
    const f2 = F[Math.floor((seed - 1) / F.length) % F.length];
    API.resetAI(); API.seedRNG(seed);
    sb.__M = { played: { 1: new Map(), 2: new Map() }, inHand: { 1: new Set(), 2: new Set() } };
    API.initGame(f1, f2, 'sim');
    const G = API.getG();
    let guard = 0;
    try {
      while (!API.checkVictoryBool() && guard < 4000 && G.turn <= 200) {
        guard++;
        sb.__sampleHands();
        await API.aiTurn(G.cp);
      }
    } catch (e) { console.error('crash seed', seed, String(e).slice(0, 120)); continue; }
    let winner = null;
    if (G.players[1].hp <= 0) winner = 2; else if (G.players[2].hp <= 0) winner = 1;
    const M = sb.__M;
    for (const p of [1, 2]) {
      const won = winner === p;
      for (const id of M.inHand[p]) {
        if (!S[id]) continue;
        S[id].inHand++;
        if (M.played[p].has(id)) {
          S[id].played++;
          S[id].turnSum += M.played[p].get(id);
          if (won) S[id].winPlayed++;
        } else {
          S[id].notPlayed++;
          if (won) S[id].winNot++;
        }
      }
    }
    // combos
    comboGames[f1]++; if (f2 !== f1) comboGames[f2]++;
    if (G._combo) for (const f of F) if (G._combo[f] && (f1 === f || f2 === f)) combo[f]++;
  }

  const rows = [];
  for (const id in S) {
    const st = S[id], meta = cardMeta[id];
    if (st.inHand === 0) continue;
    const playRate = 100 * st.played / st.inHand;
    const wrPlayed = st.played ? 100 * st.winPlayed / st.played : 0;
    const wrNot = st.notPlayed ? 100 * st.winNot / st.notPlayed : 0;
    const contrib = st.played && st.notPlayed ? wrPlayed - wrNot : 0;
    rows.push({ id, ...meta, inHand: st.inHand, playRate, contrib, avgTurn: st.played ? st.turnSum / st.played : 0 });
  }
  rows.sort((a, b) => a.playRate - b.playRate);

  const gods = rows.filter(r => r.type === 'god');
  const badGods = gods.filter(g => g.playRate < 40 || g.contrib < -2 || g.contrib > 4 || g.playRate > 90);
  console.log(`\n=== DIEUX (${gods.length}) — play rate [40,90] & contrib [-2,+4] requis ===`);
  console.log('ID'.padEnd(18) + 'fact'.padEnd(10) + 'cost  playRate  contrib  avgTurn  inHand');
  for (const g of gods) {
    const flag = (g.playRate < 40 || g.playRate > 90 || g.contrib < -2 || g.contrib > 4) ? '❌' : '✅';
    console.log(`${flag} ${g.id.padEnd(16)}${g.faction.padEnd(10)}${String(g.cost).padEnd(6)}${g.playRate.toFixed(0).padStart(5)}%   ${g.contrib >= 0 ? '+' : ''}${g.contrib.toFixed(1).padStart(5)}pp  ${g.avgTurn.toFixed(1).padStart(6)}  ${String(g.inHand).padStart(6)}`);
  }
  console.log(`\nDieux hors critères : ${badGods.length}/${gods.length}`);
  console.log('\n=== COMBOS PAR FACTION (critère ≥25% des parties) ===');
  for (const f of F) {
    const pct = comboGames[f] ? 100 * combo[f] / comboGames[f] : 0;
    console.log(`  ${pct >= 25 ? '✅' : '❌'} ${f.padEnd(10)} : ${pct.toFixed(1)}%  (${combo[f]}/${comboGames[f]})`);
  }

  if (MD_OUT) {
    let md = `# CARD METRICS — ${N_GAMES} parties seedées\n\nDate : ${new Date().toISOString().slice(0,10)}\n\n`;
    md += `## Dieux (critères 6.3 : play rate ∈ [40%, 90%], win contribution ∈ [−2pp, +4pp])\n\n`;
    md += `| Carte | Faction | Coût | Play rate | Win contrib | Tour moyen | En main (n) | OK |\n|---|---|---|---|---|---|---|---|\n`;
    for (const g of gods) {
      const ok = (g.playRate >= 40 && g.playRate <= 90 && g.contrib >= -2 && g.contrib <= 4) ? '✅' : '❌';
      md += `| ${g.id} | ${g.faction} | ${g.cost} | ${g.playRate.toFixed(0)}% | ${g.contrib >= 0 ? '+' : ''}${g.contrib.toFixed(1)}pp | ${g.avgTurn.toFixed(1)} | ${g.inHand} | ${ok} |\n`;
    }
    md += `\n## Monstres (informatif)\n\n| Carte | Faction | Coût | Play rate | Win contrib | Tour moyen |\n|---|---|---|---|---|---|\n`;
    for (const r of rows.filter(r => r.type === 'monster')) {
      md += `| ${r.id} | ${r.faction} | ${r.cost} | ${r.playRate.toFixed(0)}% | ${r.contrib >= 0 ? '+' : ''}${r.contrib.toFixed(1)}pp | ${r.avgTurn.toFixed(1)} |\n`;
    }
    md += `\n## Combos signature (critère 6.4 : déclenché dans ≥25% des parties de la faction)\n\n| Faction | Taux |\n|---|---|\n`;
    for (const f of F) {
      const pct = comboGames[f] ? 100 * combo[f] / comboGames[f] : 0;
      md += `| ${f} | ${pct.toFixed(1)}% ${pct >= 25 ? '✅' : '❌'} |\n`;
    }
    fs.writeFileSync(path.join(ROOT, MD_OUT), md);
    console.log(`\n→ ${MD_OUT} écrit`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
