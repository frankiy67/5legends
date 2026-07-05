#!/usr/bin/env node
/**
 * pool_metrics.js — Harnais de mesure du NOUVEAU POOL (feat-pool).
 *
 * Les nouvelles cartes n'existent QUE dans le pool de draft de l'Arena
 * (POOL_MONSTERS / POOL_SPELLS) : card_metrics.js (Partie Libre) ne peut pas
 * les voir. Ce harnais joue N duels IA vs IA où LES DEUX camps jouent un
 * deck drafté (arenaAIDraft 40 picks, matchups factions cyclés, RNG seedé),
 * puis mesure :
 *   · par carte du pool : play rate (jouée / en main) et win contribution
 *     (winrate jouée − winrate en main non jouée), tour moyen de jeu
 *   · winrate par faction draftée (gate absolu [45,55] + relatif ±4pp à la
 *     baseline draft mesurée AVANT vague 1, cf. docs/POOL_STATUS.md)
 *   · taux d'Ascension [5,40] %, durée moyenne ≤ 12 tours, 0 crash
 *
 * GATES par nouvelle carte (prompt Frank) : play rate ≥ 40 %,
 * contribution ∈ [−8, +15] pp.
 *
 * Usage : node tools/pool_metrics.js [nGames=1000] [--all] [--md fichier.md]
 *   --all : liste aussi les cartes existantes (par défaut : pool seul)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const GAME_SRC = path.join(ROOT, 'src', 'game.js');
const N_GAMES = parseInt(process.argv[2] || '1000', 10);
const SHOW_ALL = process.argv.includes('--all');
const MD_OUT = process.argv.includes('--md') ? process.argv[process.argv.indexOf('--md') + 1] : null;

// ── Stub DOM/Audio (identique à golden.js / card_metrics.js) ─────────────
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
  sandbox.document = makeDocument(); sandbox.navigator = { userAgent: 'node-pool' };
  sandbox.performance = { now: () => 0 }; sandbox.location = { href:'', search:'', hash:'', reload(){} };
  sandbox.Audio = function(){return ANY;}; sandbox.Image = function(){return ANY;};
  sandbox.AudioContext = AudioCtx; sandbox.webkitAudioContext = AudioCtx;
  sandbox.CustomEvent = function(){return ANY;}; sandbox.Event = function(){return ANY;};
  sandbox.console = console; sandbox.globalThis = sandbox;
  const src = fs.readFileSync(GAME_SRC, 'utf8');
  const boot = `
;globalThis.__M = null;
const __pm = playMonster, __pg = playGod, __ps = playSpell;
playMonster = function(c, p) { if (globalThis.__M && c && c.id && c.cost !== 0) globalThis.__M.played[p].set(c.id, G.turn); return __pm(c, p); };
playGod = function(c, p) { if (globalThis.__M && c && c.id) globalThis.__M.played[p].set(c.id, G.turn); return __pg(c, p); };
playSpell = function(c, p) { if (globalThis.__M && c && c.id) globalThis.__M.played[p].set(c.id, G.turn); return __ps(c, p); };
globalThis.__sampleHands = function() {
  if (!globalThis.__M) return;
  for (const p of [1,2]) for (const c of G.players[p].hand) if (c && c.id) globalThis.__M.inHand[p].add(c.id);
};
globalThis.__API = { FACTIONS, MONSTERS, GODS, POOL_MONSTERS, POOL_SPELLS, initGame, aiTurn,
  seedRNG, checkVictoryBool, getVictoryState, arenaAIDraft,
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

  const cardMeta = {}; const poolIds = new Set();
  for (const f of F) {
    for (const m of API.MONSTERS[f]) cardMeta[m.id] = { faction: f, type: 'monster', cost: m.cost, n: m.n };
    for (const g of API.GODS[f]) cardMeta[g.id] = { faction: f, type: g.type || 'god', cost: g.cost, n: g.n };
    for (const m of API.POOL_MONSTERS[f]) { if(!m.disabled){ cardMeta[m.id] = { faction: f, type: 'monster', cost: m.cost, n: m.n }; poolIds.add(m.id); } }
    for (const s of API.POOL_SPELLS[f])   { if(!s.disabled){ cardMeta[s.id] = { faction: f, type: 'spell',   cost: s.cost, n: s.n }; poolIds.add(s.id); } }
  }
  const S = {};
  for (const id in cardMeta) S[id] = { inHand: 0, played: 0, winPlayed: 0, winNot: 0, notPlayed: 0, turnSum: 0 };

  const facW = {}, facG = {};
  F.forEach(f => { facW[f] = 0; facG[f] = 0; });
  let crashes = 0, ascWins = 0, decided = 0, turnSum = 0, unfinished = 0, maxTurns = 0;
  const errors = [];
  const t0 = Date.now();

  for (let seed = 1; seed <= N_GAMES; seed++) {
    const f1 = F[(seed - 1) % F.length];
    const f2 = F[Math.floor((seed - 1) / F.length) % F.length];
    API.resetAI(); API.seedRNG(seed);
    const d1 = API.arenaAIDraft(f1, 40);
    const d2 = API.arenaAIDraft(f2, 40);
    sb.__M = { played: { 1: new Map(), 2: new Map() }, inHand: { 1: new Set(), 2: new Set() } };
    API.initGame(f1, f2, 'sim', { customDeck: d1, customDeck2: d2 });
    const G = API.getG();
    let guard = 0, crashed = false;
    try {
      while (!API.checkVictoryBool() && guard < 4000 && G.turn <= 200) {
        guard++;
        sb.__sampleHands();
        await API.aiTurn(G.cp);
      }
    } catch (e) {
      crashes++; crashed = true;
      if (errors.length < 5) errors.push(`seed ${seed} (${f1} vs ${f2}): ${String(e && e.stack ? e.stack.split('\n')[0] : e).slice(0, 140)}`);
    }
    if (crashed) continue;
    const vs = API.getVictoryState();
    const winner = vs ? vs.winner : null;
    if (!winner) { unfinished++; continue; }
    decided++;
    turnSum += G.turn; maxTurns = Math.max(maxTurns, G.turn);
    if (vs.reason === 'ascension') ascWins++;
    // Miroir : 2 sièges comptés, 1 victoire → contribue exactement 50 %.
    if (f1 === f2) { facG[f1] += 2; facW[f1]++; }
    else { facG[f1]++; facG[f2]++; facW[winner === 1 ? f1 : f2]++; }
    const M = sb.__M;
    for (const p of [1, 2]) {
      const won = winner === p;
      for (const id of M.inHand[p]) {
        if (!S[id]) continue;
        S[id].inHand++;
        if (M.played[p].has(id)) {
          S[id].played++; S[id].turnSum += M.played[p].get(id);
          if (won) S[id].winPlayed++;
        } else {
          S[id].notPlayed++;
          if (won) S[id].winNot++;
        }
      }
    }
  }
  const dt = ((Date.now() - t0) / 1000).toFixed(1);

  const rows = [];
  for (const id in S) {
    const st = S[id]; if (st.inHand === 0) continue;
    const meta = cardMeta[id];
    const playRate = 100 * st.played / st.inHand;
    const wrPlayed = st.played ? 100 * st.winPlayed / st.played : 0;
    const wrNot = st.notPlayed ? 100 * st.winNot / st.notPlayed : 0;
    const contrib = st.played && st.notPlayed ? wrPlayed - wrNot : 0;
    rows.push({ id, ...meta, inHand: st.inHand, played: st.played, playRate, contrib,
      avgTurn: st.played ? st.turnSum / st.played : 0, isPool: poolIds.has(id) });
  }
  rows.sort((a, b) => (a.faction < b.faction ? -1 : a.faction > b.faction ? 1 : a.playRate - b.playRate));

  const avgTurns = decided ? turnSum / decided : 0;
  const ascPct = decided ? 100 * ascWins / decided : 0;

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  POOL METRICS — ${N_GAMES} duels draftés (2 côtés), ${dt}s`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Décidées ${decided} · inachevées ${unfinished} · crashs ${crashes}`);
  console.log(`  Durée moyenne : ${avgTurns.toFixed(2)} tours (max ${maxTurns}) · Ascension : ${ascPct.toFixed(1)} %`);
  errors.forEach(e => console.log('   · ' + e));
  console.log('\n  WINRATE PAR FACTION DRAFTÉE (indicatif [45,55])');
  for (const f of F) {
    const wr = facG[f] ? 100 * facW[f] / facG[f] : 0;
    console.log(`    ${f.padEnd(10)} : ${wr.toFixed(1)}%  (${facW[f]}/${facG[f]})`);
  }

  const pool = rows.filter(r => r.isPool);
  if (pool.length) {
    console.log(`\n  NOUVELLES CARTES (${pool.length}) — gates : play rate ≥ 40 % · contrib ∈ [−8,+15] pp`);
    console.log('     ' + 'ID'.padEnd(22) + 'fact'.padEnd(10) + 'cost  playRate  contrib   avgTurn  inHand');
    for (const r of pool) {
      const ok = r.playRate >= 40 && r.contrib >= -8 && r.contrib <= 15;
      console.log(`  ${ok ? '✅' : '❌'} ${r.id.padEnd(22)}${r.faction.padEnd(10)}${String(r.cost).padEnd(6)}${r.playRate.toFixed(0).padStart(5)}%   ${(r.contrib >= 0 ? '+' : '') + r.contrib.toFixed(1).padStart(5)}pp  ${r.avgTurn.toFixed(1).padStart(6)}  ${String(r.inHand).padStart(6)}`);
    }
    const bad = pool.filter(r => !(r.playRate >= 40 && r.contrib >= -8 && r.contrib <= 15));
    console.log(`\n  Cartes du pool hors gates : ${bad.length}/${pool.length}`);
  }
  if (SHOW_ALL) {
    console.log('\n  CARTES EXISTANTES (draft) —');
    for (const r of rows.filter(r => !r.isPool)) {
      console.log(`     ${r.id.padEnd(22)}${r.faction.padEnd(10)}${String(r.cost).padEnd(6)}${r.playRate.toFixed(0).padStart(5)}%   ${(r.contrib >= 0 ? '+' : '') + r.contrib.toFixed(1).padStart(5)}pp`);
    }
  }

  if (MD_OUT) {
    let md = `# POOL METRICS — ${N_GAMES} duels draftés\n\nDate : ${new Date().toISOString().slice(0, 10)} · décidées ${decided} · crashs ${crashes} · ${avgTurns.toFixed(2)} tours · Ascension ${ascPct.toFixed(1)} %\n\n`;
    md += `## Winrates factions (draft)\n\n| Faction | Winrate |\n|---|---|\n`;
    for (const f of F) md += `| ${f} | ${(facG[f] ? 100 * facW[f] / facG[f] : 0).toFixed(1)}% |\n`;
    md += `\n## Nouvelles cartes\n\n| Carte | Faction | Coût | Play rate | Contrib | Tour moyen | OK |\n|---|---|---|---|---|---|---|\n`;
    for (const r of pool) {
      const ok = r.playRate >= 40 && r.contrib >= -8 && r.contrib <= 15;
      md += `| ${r.n} (${r.id}) | ${r.faction} | ${r.cost} | ${r.playRate.toFixed(0)}% | ${(r.contrib >= 0 ? '+' : '') + r.contrib.toFixed(1)}pp | ${r.avgTurn.toFixed(1)} | ${ok ? '✅' : '❌'} |\n`;
    }
    fs.writeFileSync(path.join(ROOT, MD_OUT), md);
    console.log(`\n→ ${MD_OUT} écrit`);
  }

  const gateOk = crashes === 0 && avgTurns <= 12;
  console.log('\n' + (gateOk ? '  ✅ 0 crash · durée ≤ 12 tours' : '  ❌ gates globaux non tenus (crash ou durée)'));
  process.exit(gateOk ? 0 : 1);
}
main().catch(e => { console.error('HARNESS FAIL', e); process.exit(1); });
