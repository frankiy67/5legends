#!/usr/bin/env node
/**
 * test_regents.js — validation du moteur DIEUX-RÉGENTS (pilier 4).
 *
 * DEUX ÉTAGES :
 *  1. SCÉNARIOS DIRIGÉS (déterministes, headless) — le mécanisme :
 *     · aura continue appliquée à l'ENTRÉE de la phase du régent, retirée à
 *       la SORTIE ;
 *     · intronisation sur une phase déjà active → aura immédiate ;
 *     · détrônement → aura retirée, dieu au cimetière, trône vide ;
 *     · trône contesté → l'occupant est détrôné, le nouveau siège ;
 *     · auras d'entrée (Foi, pioche) déclenchées à CHAQUE traversée.
 *  2. BATTERIE — 25 paires ordonnées × N parties seedées (défaut 20 → 500)
 *     avec REGENTS_DEMO=true : 3 dieux démo [PLACEHOLDER] (Kairos→midi +1 ATK,
 *     Skuld→ténèbres +1 Foi, Tonatiuh Renaissant→crépuscule pioche 1)
 *     s'intronisent au lieu de leur effet one-shot.
 *
 * CRITÈRES (consignes pilier 4) :
 *   · scénarios tous verts
 *   · 0 crash JS, 0 partie inachevée, durée moyenne ≤ 13 tours
 *   · sanity : intronisations, détrônements (miroirs) et auras exercés en partie
 *
 * Le jeu par défaut reste SANS régent (REGENTS_DEMO=false, golden intact).
 * Usage : node tools/test_regents.js [gamesParPaire=20]
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
  // Instrumentation : compte intronisations / détrônements / entrées d'aura.
  const boot = `
globalThis.__RG = { enthroned: 0, dethroned: 0, auraEnters: 0 };
const __enthrone = enthroneGod;
enthroneGod = function(p, card, phaseIdx, auraId) {
  globalThis.__RG.enthroned++;
  return __enthrone(p, card, phaseIdx, auraId);
};
const __dethrone = dethroneGod;
dethroneGod = function(phaseIdx, srcLabel) {
  const r = __dethrone(phaseIdx, srcLabel);
  if (r) globalThis.__RG.dethroned++;
  return r;
};
const __rEnter = regentPhaseEnter;
regentPhaseEnter = function(entry) {
  globalThis.__RG.auraEnters++;
  return __rEnter(entry);
};
globalThis.__API = { FACTIONS, initGame, aiTurn, seedRNG, checkVictoryBool, getVictoryState,
  getG: ()=>G, resetAI: ()=>{ aiThinking=false; },
  setRegentsDemo, enthroneGod: (...a)=>enthroneGod(...a), dethroneGod: (...a)=>dethroneGod(...a),
  getRegent, setCyclePhase, newCard };
`;
  vm.createContext(sandbox);
  vm.runInContext(src + boot, sandbox, { filename: 'game.js' });
  return sandbox;
}

// ═══════════════════════════════════════════════════════════════════════════
// ÉTAGE 1 — SCÉNARIOS DIRIGÉS
// ═══════════════════════════════════════════════════════════════════════════
const scenarioResults = [];
function check(name, cond, detail) {
  scenarioResults.push({ name, ok: !!cond });
  console.log(`  ${cond ? '✅' : '❌'} ${name}${cond ? '' : '   → ' + (detail || '')}`);
}
function fresh(sb, seed) {
  const API = sb.__API;
  API.resetAI(); API.seedRNG(seed);
  API.initGame('greek', 'norse', 'sim'); // cycle démarre à 0 (aube)
  const G = API.getG();
  G.players[1].field.length = 0; G.players[2].field.length = 0;
  return G;
}
function place(sb, p, name, atk, def) {
  const G = sb.__API.getG();
  const m = sb.__API.newCard({ id:'RG_'+name, n:name, atk, def, cost:2, type:'monster', cap:'', txt:'', rarity:'common', faction:G.players[p].faction });
  m.cAtk = atk; m.cDef = def;
  G.players[p].field.push(m);
  return m;
}
function godCard(sb, p, name) {
  const G = sb.__API.getG();
  return sb.__API.newCard({ id:'RGOD_'+name, n:name, cost:2, type:'god', cap:'', txt:'', faction:G.players[p].faction });
}

async function runScenarios(sb) {
  const API = sb.__API;
  console.log('── SCÉNARIOS DIRIGÉS — intronisation / aura / détrônement ─────');

  // R1 · AURA CONTINUE : appliquée à l'entrée de la phase du régent, retirée
  // à la sortie (le Cycle traverse midi = phase 1).
  {
    const G = fresh(sb, 301);
    const m1 = place(sb, 1, 'Soldat', 2, 3);
    const m2 = place(sb, 1, 'Archer', 1, 2);
    API.enthroneGod(1, godCard(sb, 1, 'Régent-R1'), 1, 'aura_atk1'); // midi
    check('R1 intronisé hors phase — aucune aura', m1.cAtk === 2 && m2.cAtk === 1, `atk=${m1.cAtk},${m2.cAtk}`);
    API.setCyclePhase(1, 'test'); // entrée midi
    check('R1 entrée de phase — +1 ATK aux alliés', m1.cAtk === 3 && m2.cAtk === 2, `atk=${m1.cAtk},${m2.cAtk}`);
    API.setCyclePhase(2, 'test'); // sortie midi
    check('R1 sortie de phase — aura retirée', m1.cAtk === 2 && m2.cAtk === 1, `atk=${m1.cAtk},${m2.cAtk}`);
    API.setCyclePhase(0, 'test'); API.setCyclePhase(1, 'test'); // nouvelle traversée
    check('R1 nouvelle traversée — aura re-appliquée', m1.cAtk === 3 && m2.cAtk === 2, `atk=${m1.cAtk},${m2.cAtk}`);
  }

  // R2 · PHASE DÉJÀ ACTIVE + DÉTRÔNEMENT : aura immédiate ; détrôné → aura
  // retirée, dieu au cimetière, trône vide.
  {
    const G = fresh(sb, 302);
    const m1 = place(sb, 1, 'Soldat', 2, 3);
    const god = godCard(sb, 1, 'Régent-R2');
    API.enthroneGod(1, god, 0, 'aura_atk1'); // aube = phase active
    check('R2 phase active — aura immédiate', m1.cAtk === 3, `atk=${m1.cAtk}`);
    const out = API.dethroneGod(0, 'test');
    check('R2 détrônement — aura retirée', m1.cAtk === 2, `atk=${m1.cAtk}`);
    check('R2 détrônement — dieu au cimetière, trône vide',
      out && G.players[1].graveyard.includes(god) && API.getRegent(0) === null,
      `grave=${G.players[1].graveyard.length} regent=${!!API.getRegent(0)}`);
  }

  // R3 · TRÔNE CONTESTÉ : le nouvel arrivant détrône l'occupant (phase
  // active : l'aura bascule d'un camp à l'autre).
  {
    const G = fresh(sb, 303);
    const a1 = place(sb, 1, 'SoldatP1', 2, 3);
    const a2 = place(sb, 2, 'SoldatP2', 2, 3);
    const god1 = godCard(sb, 1, 'Régent-P1');
    const god2 = godCard(sb, 2, 'Régent-P2');
    API.enthroneGod(1, god1, 0, 'aura_atk1'); // aube active → P1 +1
    check('R3 occupant en place — aura P1', a1.cAtk === 3 && a2.cAtk === 2, `atk=${a1.cAtk},${a2.cAtk}`);
    API.enthroneGod(2, god2, 0, 'aura_atk1'); // conteste le trône
    check('R3 trône contesté — occupant détrôné (cimetière P1)', G.players[1].graveyard.includes(god1), '');
    check('R3 trône contesté — aura basculée P1→P2', a1.cAtk === 2 && a2.cAtk === 3, `atk=${a1.cAtk},${a2.cAtk}`);
    check('R3 le nouveau régent siège', API.getRegent(0) && API.getRegent(0).card === god2, '');
  }

  // R4 · AURA D'ENTRÉE (Foi) : +1 Foi à CHAQUE traversée de la phase.
  {
    const G = fresh(sb, 304);
    API.enthroneGod(1, godCard(sb, 1, 'Régent-R4'), 2, 'aura_faith1'); // crépuscule
    API.setCyclePhase(1, 'test');
    check('R4 pas encore la phase — 0 Foi', (G.players[1].faith || 0) === 0, `faith=${G.players[1].faith}`);
    API.setCyclePhase(2, 'test');
    check('R4 entrée crépuscule — +1 Foi', G.players[1].faith === 1, `faith=${G.players[1].faith}`);
    API.setCyclePhase(3, 'test'); API.setCyclePhase(4, 'test');
    API.setCyclePhase(0, 'test'); API.setCyclePhase(1, 'test'); API.setCyclePhase(2, 'test');
    check('R4 seconde traversée — +1 Foi encore', G.players[1].faith === 2, `faith=${G.players[1].faith}`);
  }

  // R5 · AURA D'ENTRÉE (pioche) : pioche 1 à l'entrée de la phase.
  {
    const G = fresh(sb, 305);
    const h0 = G.players[1].hand.length;
    API.enthroneGod(1, godCard(sb, 1, 'Régent-R5'), 3, 'aura_draw1'); // nuit
    API.setCyclePhase(3, 'test');
    check('R5 entrée nuit — pioche 1', G.players[1].hand.length === h0 + 1, `hand=${G.players[1].hand.length} (h0=${h0})`);
  }

  console.log('');
  return scenarioResults.every(r => r.ok);
}

// ═══════════════════════════════════════════════════════════════════════════
// ÉTAGE 2 — BATTERIE 500 PARTIES avec REGENTS_DEMO
// ═══════════════════════════════════════════════════════════════════════════
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
  return { turns: G.turn, error, winner: vs ? vs.winner : null };
}

async function main() {
  const sb = loadGame();
  const API = sb.__API;

  const scenariosOK = await runScenarios(sb);

  // Batterie avec la démo régents active (le défaut du jeu reste flag off).
  API.setRegentsDemo(true);
  sb.__RG.enthroned = 0; sb.__RG.dethroned = 0; sb.__RG.auraEnters = 0;

  const F = API.FACTIONS;
  const pairs = [];
  for (const a of F) for (const b of F) pairs.push([a, b]);

  let total = 0, crashes = 0, turnsSum = 0, unfinished = 0;
  let seed = 1;
  const t0 = Date.now();
  for (const [f1, f2] of pairs) {
    for (let g = 0; g < GAMES_PER_PAIR; g++) {
      const r = await playOne(API, f1, f2, seed++);
      total++;
      turnsSum += r.turns;
      if (r.error) { crashes++; console.log(`  💥 ${f1} vs ${f2} seed=${seed-1}: ${r.error}`); }
      if (r.winner === null) unfinished++;
    }
  }
  API.setRegentsDemo(false);
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  const RG = sb.__RG;
  const avgTurns = turnsSum / total;

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  TEST REGENTS — ${total} parties (dieux-régents, pilier 4, démo sous flag)`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Intronisations ............. : ${RG.enthroned}`);
  console.log(`  Détrônements (contestés) ... : ${RG.dethroned}`);
  console.log(`  Entrées d'aura ............. : ${RG.auraEnters}`);
  console.log(`  Durée moyenne .............. : ${avgTurns.toFixed(2)} tours`);
  console.log(`  Parties inachevées ......... : ${unfinished}`);
  console.log(`  Crashs JS .................. : ${crashes}`);
  console.log(`  Durée réelle ............... : ${dt}s`);
  console.log('  ' + '─'.repeat(60));

  const okScen = scenariosOK;
  const okCrash = crashes === 0 && unfinished === 0;
  const okTurns = avgTurns <= 13;
  const okSanity = RG.enthroned > 0 && RG.dethroned > 0 && RG.auraEnters > 0;
  console.log(`  ${okScen ? '✅' : '❌'} scénarios moteur (${scenarioResults.filter(r=>r.ok).length}/${scenarioResults.length})`);
  console.log(`  ${okCrash ? '✅' : '❌'} 0 crash / 0 inachevée`);
  console.log(`  ${okTurns ? '✅' : '❌'} durée moyenne ≤ 13 tours (mesuré : ${avgTurns.toFixed(2)})`);
  console.log(`  ${okSanity ? '✅' : '❌'} sanity : intronisations (${RG.enthroned}), détrônements (${RG.dethroned}), auras (${RG.auraEnters}) exercés`);
  process.exit(okScen && okCrash && okTurns && okSanity ? 0 : 1);
}
main().catch(e => { console.error('HARNESS FAIL', e); process.exit(1); });
