#!/usr/bin/env node
/**
 * test_omens.js — validation de la Frise du Destin (brique D + pilier 1 « frise moteur »).
 *
 * DEUX ÉTAGES :
 *  1. SCÉNARIOS DIRIGÉS (déterministes, headless) — le contre-jeu moteur :
 *     · détruire un présage → il ne se déclenche jamais ;
 *     · voler un présage → il se résout du point de vue du voleur ;
 *     · décaler un présage (+N/−N) → il se déclenche exactement au nouveau tick ;
 *     · décaler à échéance immédiate → résolu au prochain point de résolution, tick exact ;
 *     · interaction cartes temporelles : retarder le Cycle (backward) repousse
 *       le présage d'un tick, avancer le rapproche, figer ne tick pas.
 *  2. BATTERIE — 25 paires ordonnées × N parties seedées (défaut 20 → 500),
 *     avec FUZZ de contre-jeu (LCG seedé, indépendant du RNG du jeu) qui
 *     détruit/vole/décale des présages en pleine partie.
 *
 * CRITÈRES (consignes pilier 1) :
 *   · scénarios de contre-jeu tous verts
 *   · 0 crash JS, 0 partie inachevée
 *   · présages déclenchés au tick exact, jamais un présage détruit
 *   · durée moyenne ≤ 12 tours
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
  // Instrumentation : chaque déclenchement de présage est journalisé
  // (id, tick d'échéance, tick réel, propriétaire au moment du feu).
  const boot = `
globalThis.__OM = { scheduled: 0, fired: 0, offTick: [], firedIds: [], events: [] };
const __schedOmen = scheduleOmen;
scheduleOmen = function(ownerP, effectId, delta, label, cardName) {
  globalThis.__OM.scheduled++;
  return __schedOmen(ownerP, effectId, delta, label, cardName);
};
const __fireOmen = fireOmen;
fireOmen = async function(o) {
  globalThis.__OM.fired++;
  globalThis.__OM.firedIds.push(o.id);
  globalThis.__OM.events.push({ id: o.id, due: o.dueTick, at: G.cycleTick, ownerP: o.ownerP });
  if (G.cycleTick !== o.dueTick) globalThis.__OM.offTick.push({ due: o.dueTick, at: G.cycleTick, card: o.cardName });
  return __fireOmen(o);
};
globalThis.__API = { FACTIONS, initGame, aiTurn, seedRNG, checkVictoryBool, getVictoryState,
  getG: ()=>G, resetAI: ()=>{ aiThinking=false; },
  scheduleOmen: (...a)=>scheduleOmen(...a), destroyOmen, stealOmen, shiftOmen, findOmen,
  setCyclePhase, resolveDueOmens, doEndTurn, newCard };
`;
  vm.createContext(sandbox);
  vm.runInContext(src + boot, sandbox, { filename: 'game.js' });
  return sandbox;
}

// ═══════════════════════════════════════════════════════════════════════════
// ÉTAGE 1 — SCÉNARIOS DIRIGÉS DE CONTRE-JEU
// Chaque scénario repart d'une partie fraîche seedée et pilote le Cycle à la
// main (setCyclePhase + resolveDueOmens), sans tour d'IA : totalement
// déterministe et indépendant du contenu des decks.
// ═══════════════════════════════════════════════════════════════════════════
const scenarioResults = [];
function check(name, cond, detail) {
  scenarioResults.push({ name, ok: !!cond, detail: detail || '' });
  console.log(`  ${cond ? '✅' : '❌'} ${name}${cond ? '' : '   → ' + (detail || '')}`);
}

function freshGame(sb, seed) {
  const API = sb.__API;
  API.resetAI(); API.seedRNG(seed);
  API.initGame('greek', 'norse', 'sim');
  sb.__OM.fired = 0; sb.__OM.firedIds.length = 0; sb.__OM.events.length = 0; sb.__OM.offTick.length = 0;
  return API.getG();
}
// Pose un monstre nu contrôlable sur le terrain de p (via newCard du moteur).
function placeDummy(sb, p, name, def) {
  const G = sb.__API.getG();
  const m = sb.__API.newCard({ id:'DUMMY_'+name, n:name, atk:1, def:def, cost:2, type:'monster', cap:'', txt:'', rarity:'common', faction:G.players[p].faction });
  m.cAtk = 1; m.cDef = def;
  G.players[p].field.push(m);
  return m;
}
async function advance(sb, n) {
  const API = sb.__API; const G = API.getG();
  for (let k = 0; k < n; k++) { API.setCyclePhase(G.cycle + 1, 'test'); await API.resolveDueOmens(); }
}

async function runScenarios(sb) {
  const API = sb.__API;
  console.log('── SCÉNARIOS DIRIGÉS — contre-jeu de la Frise ─────────────────');

  // S1 · DÉTRUIRE : le présage détruit ne se déclenche jamais.
  {
    const G = freshGame(sb, 101);
    placeDummy(sb, 2, 'CibleS1', 5);
    const o = API.scheduleOmen(1, 'omen_dmg1_random', 2, 'test destroy', 'S1');
    const gone = API.destroyOmen(o.id, 'harnais');
    await advance(sb, 4);
    check('S1 détruire — retiré de la Frise', gone && G.omens.length === 0, `omens restants=${G.omens.length}`);
    check('S1 détruire — jamais déclenché', sb.__OM.fired === 0, `fired=${sb.__OM.fired}`);
  }

  // S2 · VOLER : le présage volé se résout du point de vue du voleur
  // (omen_dmg1_random frappe le board de l'ADVERSAIRE du propriétaire).
  {
    const G = freshGame(sb, 102);
    G.players[1].field.length = 0; G.players[2].field.length = 0;
    const m1 = placeDummy(sb, 1, 'BoardP1', 5);
    const m2 = placeDummy(sb, 2, 'BoardP2', 5);
    const o = API.scheduleOmen(1, 'omen_dmg1_random', 2, 'test steal', 'S2');
    API.stealOmen(o.id, 2, 'harnais');   // volé par P2 → frappera le board de P1
    await advance(sb, 2);
    check('S2 voler — déclenché au tick exact', sb.__OM.fired === 1 && sb.__OM.offTick.length === 0, `fired=${sb.__OM.fired} offTick=${sb.__OM.offTick.length}`);
    check('S2 voler — résolu pour le voleur (board P1 touché)', m1.cDef === 4 && m2.cDef === 5, `P1.def=${m1.cDef} P2.def=${m2.cDef}`);
    check('S2 voler — propriétaire au feu = voleur', sb.__OM.events.length === 1 && sb.__OM.events[0].ownerP === 2, JSON.stringify(sb.__OM.events));
  }

  // S3 · DÉCALER +2 : déclenché exactement au tick reprogrammé.
  {
    const G = freshGame(sb, 103);
    placeDummy(sb, 2, 'CibleS3', 5);
    const t0 = G.cycleTick;
    const o = API.scheduleOmen(1, 'omen_dmg1_random', 1, 'test shift+2', 'S3');
    API.shiftOmen(o.id, +2, 'harnais');  // échéance t0+3
    await advance(sb, 2);
    check('S3 décaler +2 — pas déclenché avant', sb.__OM.fired === 0, `fired=${sb.__OM.fired}`);
    await advance(sb, 1);
    check('S3 décaler +2 — déclenché à t0+3 exactement',
      sb.__OM.fired === 1 && sb.__OM.events[0].at === t0 + 3 && sb.__OM.offTick.length === 0,
      JSON.stringify(sb.__OM.events));
  }

  // S4 · DÉCALER à échéance immédiate : re-daté au tick courant, résolu au
  // prochain point de résolution, tick exact préservé.
  {
    const G = freshGame(sb, 104);
    placeDummy(sb, 2, 'CibleS4', 5);
    const o = API.scheduleOmen(1, 'omen_dmg1_random', 3, 'test shift-5', 'S4');
    API.shiftOmen(o.id, -5, 'harnais');
    check('S4 échéance immédiate — passé en file', G.omens.length === 0 && G._omensPending.length === 1, `omens=${G.omens.length} pending=${G._omensPending.length}`);
    await API.resolveDueOmens();
    check('S4 échéance immédiate — résolu au tick courant', sb.__OM.fired === 1 && sb.__OM.offTick.length === 0, `fired=${sb.__OM.fired} offTick=${sb.__OM.offTick.length}`);
  }

  // S5 · CARTES TEMPORELLES : retarder (backward) repousse d'un tick,
  // avancer rapproche, l'échéance reste exacte.
  {
    const G = freshGame(sb, 105);
    placeDummy(sb, 2, 'CibleS5', 5);
    const t0 = G.cycleTick;
    API.scheduleOmen(1, 'omen_dmg1_random', 2, 'test temporal', 'S5');   // échéance t0+2
    API.setCyclePhase(G.cycle - 1, 'Toki-Onna (test)', { backward: true }); // tick t0-1
    await API.resolveDueOmens();
    check('S5 retarder — le tick recule', G.cycleTick === t0 - 1, `tick=${G.cycleTick} attendu=${t0 - 1}`);
    await advance(sb, 2);                                                 // tick t0+1
    check('S5 retarder — repoussé (pas déclenché à l\'ancienne échéance)', sb.__OM.fired === 0, `fired=${sb.__OM.fired}`);
    await advance(sb, 1);                                                 // tick t0+2
    check('S5 retarder — déclenché à l\'échéance intacte t0+2', sb.__OM.fired === 1 && sb.__OM.offTick.length === 0, JSON.stringify(sb.__OM.events));
  }

  // S6 · FIGER : un Cycle gelé ne tick pas au passage de ronde → le présage
  // est protégé (son échéance ne se rapproche pas).
  {
    const G = freshGame(sb, 106);
    placeDummy(sb, 2, 'CibleS6', 5);
    API.scheduleOmen(1, 'omen_dmg1_random', 1, 'test freeze', 'S6');
    G.cycleFrozen = 1;
    const t0 = G.cycleTick;
    API.doEndTurn();               // P1 → P2 : pas de transition de Cycle
    API.doEndTurn();               // P2 → P1 : ronde complète, gel consommé
    check('S6 figer — aucune transition pendant le gel', G.cycleTick === t0 && sb.__OM.fired === 0, `tick=${G.cycleTick} (t0=${t0}) fired=${sb.__OM.fired}`);
    API.doEndTurn(); API.doEndTurn(); // ronde suivante : le Cycle repart
    await API.resolveDueOmens();
    check('S6 figer — le présage repart après le gel (tick exact)', sb.__OM.fired === 1 && sb.__OM.offTick.length === 0, `fired=${sb.__OM.fired} offTick=${sb.__OM.offTick.length}`);
  }

  console.log('');
  return scenarioResults.every(r => r.ok);
}

// ═══════════════════════════════════════════════════════════════════════════
// ÉTAGE 2 — BATTERIE 500 PARTIES avec fuzz de contre-jeu
// ═══════════════════════════════════════════════════════════════════════════
// LCG déterministe indépendant du RNG du jeu (le fuzz ne consomme JAMAIS le
// mulberry32 du moteur : les décisions de jeu restent celles des seeds).
function makeLCG(seed) {
  let s = (seed * 747796405 + 2891336453) >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s; };
}

async function playOne(sb, f1, f2, seed, fuzzStats) {
  const API = sb.__API;
  API.resetAI(); API.seedRNG(seed);
  API.initGame(f1, f2, 'sim');
  const G = API.getG();
  const lcg = makeLCG(seed);
  const destroyed = new Set();
  let guard = 0, error = null;
  try {
    while (!API.checkVictoryBool() && guard < HARD_GUARD) {
      guard++;
      await API.aiTurn(G.cp);
      // FUZZ contre-jeu : ~1 action sur 4 tours quand un présage est inscrit.
      if (G.omens.length > 0 && lcg() % 4 === 0) {
        const o = G.omens[lcg() % G.omens.length];
        const act = lcg() % 3;
        if (act === 0) { API.destroyOmen(o.id, 'fuzz'); destroyed.add(o.id); fuzzStats.destroy++; }
        else if (act === 1) { API.stealOmen(o.id, o.ownerP === 1 ? 2 : 1, 'fuzz'); fuzzStats.steal++; }
        else { API.shiftOmen(o.id, (lcg() % 2 === 0) ? +1 : -2, 'fuzz'); fuzzStats.shift++; }
      }
    }
  } catch (e) {
    error = (e && e.stack ? e.stack.split('\n')[0] : String(e));
  }
  // Invariant : un présage détruit ne se déclenche JAMAIS.
  const zombie = sb.__OM.firedIds.filter(id => destroyed.has(id)).length;
  const vs = API.getVictoryState();
  return { turns: G.turn, error, winner: vs ? vs.winner : null, pendingLeft: (G._omensPending||[]).length, zombie };
}

async function main() {
  const sb = loadGame();
  const API = sb.__API;

  const scenariosOK = await runScenarios(sb);

  const F = API.FACTIONS;
  const pairs = [];
  for (const a of F) for (const b of F) pairs.push([a, b]);

  // Reset des compteurs globaux après les scénarios (la batterie repart de 0).
  sb.__OM.scheduled = 0; sb.__OM.fired = 0; sb.__OM.offTick.length = 0;
  sb.__OM.firedIds.length = 0; sb.__OM.events.length = 0;

  let total = 0, crashes = 0, turnsSum = 0, unfinished = 0, pendingLeak = 0, zombies = 0;
  const fuzzStats = { destroy: 0, steal: 0, shift: 0 };
  let seed = 1;
  const t0 = Date.now();
  for (const [f1, f2] of pairs) {
    for (let g = 0; g < GAMES_PER_PAIR; g++) {
      sb.__OM.firedIds.length = 0; // suivi zombie par partie
      const r = await playOne(sb, f1, f2, seed++, fuzzStats);
      total++;
      turnsSum += r.turns;
      zombies += r.zombie;
      if (r.error) { crashes++; console.log(`  💥 ${f1} vs ${f2} seed=${seed-1}: ${r.error}`); }
      if (r.winner === null) unfinished++;
      if (r.pendingLeft > 0) pendingLeak++; // présage échu jamais résolu en fin de partie ≠ bug (fin de partie), informatif
    }
  }
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  const OM = sb.__OM;
  const avgTurns = turnsSum / total;

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  TEST OMENS — ${total} parties (Frise du Destin, pilier 1 : moteur + contre-jeu)`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Présages inscrits .......... : ${OM.scheduled}`);
  console.log(`  Présages déclenchés ........ : ${OM.fired} (les non-déclenchés = partie finie avant l'échéance, ou détruits)`);
  console.log(`  Déclenchés HORS tick ....... : ${OM.offTick.length}`);
  if (OM.offTick.length) OM.offTick.slice(0, 5).forEach(o => console.log(`     ✗ ${o.card} : dû au tick ${o.due}, déclenché au tick ${o.at}`));
  console.log(`  Contre-jeu (fuzz) .......... : ${fuzzStats.destroy} détruits · ${fuzzStats.steal} volés · ${fuzzStats.shift} décalés`);
  console.log(`  Présages détruits déclenchés : ${zombies} (doit être 0)`);
  console.log(`  Parties avec file résiduelle : ${pendingLeak}`);
  console.log(`  Durée moyenne .............. : ${avgTurns.toFixed(2)} tours`);
  console.log(`  Parties inachevées ......... : ${unfinished}`);
  console.log(`  Crashs JS .................. : ${crashes}`);
  console.log(`  Durée réelle ............... : ${dt}s`);
  console.log('  ' + '─'.repeat(60));

  const okScen = scenariosOK;
  const okCrash = crashes === 0 && unfinished === 0;
  const okTick = OM.offTick.length === 0 && OM.scheduled > 0 && OM.fired > 0 && zombies === 0;
  const okTurns = avgTurns <= 12;
  console.log(`  ${okScen ? '✅' : '❌'} scénarios de contre-jeu (${scenarioResults.filter(r=>r.ok).length}/${scenarioResults.length})`);
  console.log(`  ${okCrash ? '✅' : '❌'} 0 crash / 0 inachevée`);
  console.log(`  ${okTick ? '✅' : '❌'} tick exact + 0 présage détruit déclenché, ${OM.fired}/${OM.scheduled} déclenchés`);
  console.log(`  ${okTurns ? '✅' : '❌'} durée moyenne ≤ 12 tours (mesuré : ${avgTurns.toFixed(2)})`);
  process.exit(okScen && okCrash && okTick && okTurns ? 0 : 1);
}
main().catch(e => { console.error('HARNESS FAIL', e); process.exit(1); });
