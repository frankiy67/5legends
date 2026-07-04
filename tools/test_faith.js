#!/usr/bin/env node
/**
 * test_faith.js — validation du système de Foi (brique A) + HARNAIS
 * FERVEUR/ÉGIDE (pilier 3 : le moteur fonctionne quand une carte le porte).
 *
 * DEUX ÉTAGES :
 *  1. SCÉNARIOS DIRIGÉS (déterministes, headless) via les 2 cartes
 *     placeholder ([PLACEHOLDER], injectées sous flag FAITH_PLACEHOLDERS) :
 *     · Ferveur : +1 Foi quand le porteur inflige des dégâts en ATTAQUANT une
 *       créature ; 1×/tour ; rien sur une attaque au visage ;
 *     · Égide : un fidèle agenouillé derrière une Égide debout est inciblable ;
 *       Égide agenouillée ou endormie ne protège plus.
 *  2. BATTERIE — 25 paires ordonnées × N parties seedées (défaut 20 → 500)
 *     AVEC les placeholders dans les decks (FAITH_PLACEHOLDERS=true).
 *
 * CRITÈRES (consignes pilier 3) :
 *   · scénarios tous verts
 *   · 0 crash JS, 0 partie inachevée
 *   · taux de victoires par ASCENSION ∈ [5, 40] %
 *   · durée moyenne ≤ 13 tours
 *   · sanity : Ferveur déclenchée et Égide consultée-vraie au moins une fois
 *
 * Le jeu par défaut reste à ZÉRO porteur (décision Frank Q1) : le flag n'est
 * activé QUE par ce harnais. Usage : node tools/test_faith.js [gamesParPaire=20]
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
  // Instrumentation : compte les consultations d'Égide qui ont réellement
  // protégé (renvoyé true) — preuve que la protection est exercée en partie.
  const boot = `
globalThis.__FA = { egideBlocks: 0 };
const __pbe = protectedByEgide;
protectedByEgide = function(targetP, m) {
  const r = __pbe(targetP, m);
  if (r) globalThis.__FA.egideBlocks++;
  return r;
};
globalThis.__API = { FACTIONS, initGame, aiTurn, seedRNG, checkVictoryBool, getVictoryState,
  getG: ()=>G, resetAI: ()=>{ aiThinking=false; }, FAITH_WIN, TURN_CAP,
  setFaithPlaceholders, FAITH_PLACEHOLDER_CARDS, newCard, doAttack,
  hasEgide: (P)=>hasEgide(P), pickAITarget, canPray, doPray };
`;
  vm.createContext(sandbox);
  vm.runInContext(src + boot, sandbox, { filename: 'game.js' });
  return sandbox;
}

// ═══════════════════════════════════════════════════════════════════════════
// ÉTAGE 1 — SCÉNARIOS DIRIGÉS FERVEUR / ÉGIDE (via les placeholders)
// ═══════════════════════════════════════════════════════════════════════════
const scenarioResults = [];
function check(name, cond, detail) {
  scenarioResults.push({ name, ok: !!cond });
  console.log(`  ${cond ? '✅' : '❌'} ${name}${cond ? '' : '   → ' + (detail || '')}`);
}
function fresh(sb, seed) {
  const API = sb.__API;
  API.resetAI(); API.seedRNG(seed);
  API.initGame('greek', 'norse', 'sim');
  const G = API.getG();
  G.players[1].field.length = 0; G.players[2].field.length = 0;
  G.players[1].attacked = new Set(); G.players[2].attacked = new Set();
  G.players[1].summoned = new Set(); G.players[2].summoned = new Set();
  G.phase = 'Combat';
  return G;
}
function place(sb, p, tpl) {
  const G = sb.__API.getG();
  const m = sb.__API.newCard({ type:'monster', faction: G.players[p].faction, ...tpl });
  m.cAtk = tpl.atk; m.cDef = tpl.def;
  G.players[p].field.push(m);
  return m;
}
const FERVOR_TPL = { id:'PH_FERVOR', n:'Zélote [PLACEHOLDER]', atk:2, def:2, cost:2, rarity:'uncommon', cap:'fervor', txt:'' };
const EGIDE_TPL  = { id:'PH_EGIDE',  n:'Gardien votif [PLACEHOLDER]', atk:1, def:4, cost:2, rarity:'uncommon', cap:'egide', txt:'' };

async function runScenarios(sb) {
  const API = sb.__API;
  console.log('── SCÉNARIOS DIRIGÉS — moteur Ferveur / Égide ─────────────────');

  // F1 · FERVEUR : +1 Foi en attaquant une créature, 1×/tour, re-déclenchable
  // après reset du flag (début de tour du contrôleur).
  {
    const G = fresh(sb, 201);
    const z = place(sb, 1, FERVOR_TPL);
    place(sb, 2, { id:'DUMMY', n:'Cible', atk:0, def:9, cost:2, rarity:'common', cap:'', txt:'' });
    await API.doAttack(1, 0, 2, 0);
    check('F1 Ferveur — +1 Foi sur dégâts en attaquant une créature', G.players[1].faith === 1 && z._fervor === true, `faith=${G.players[1].faith} _fervor=${z._fervor}`);
    G.players[1].attacked = new Set();
    await API.doAttack(1, 0, 2, 0);
    check('F1 Ferveur — 1×/tour (2e attaque du tour : pas de Foi)', G.players[1].faith === 1, `faith=${G.players[1].faith}`);
    z._fervor = false; // reset de début de tour (doEndTurn le fait en jeu réel)
    G.players[1].attacked = new Set();
    await API.doAttack(1, 0, 2, 0);
    check('F1 Ferveur — re-déclenche après reset du tour', G.players[1].faith === 2, `faith=${G.players[1].faith}`);
  }

  // F2 · FERVEUR : PAS de Foi sur une attaque au visage.
  {
    const G = fresh(sb, 202);
    place(sb, 1, FERVOR_TPL);
    await API.doAttack(1, 0, 2, 'player');
    check('F2 Ferveur — attaque au visage : aucune Foi', G.players[1].faith === 0 && G.players[2].hp === 23, `faith=${G.players[1].faith} hp=${G.players[2].hp}`);
  }

  // F3 · ÉGIDE : un agenouillé derrière une Égide debout est inciblable ;
  // l'IA ne le cible jamais ; Égide à genoux ou endormie ne protège plus.
  {
    const G = fresh(sb, 203);
    const kneeler = place(sb, 1, { id:'DUMMY2', n:'Fidèle', atk:1, def:3, cost:2, rarity:'common', cap:'', txt:'' });
    const gard = place(sb, 1, EGIDE_TPL);
    kneeler.kneeling = true;
    place(sb, 2, { id:'ATTQ', n:'Attaquant', atk:3, def:3, cost:3, rarity:'common', cap:'', txt:'' });
    check('F3 Égide — l\'agenouillé est protégé (Égide debout)', APIprotected(sb, 1, kneeler) === true, '');
    const tgt = API.pickAITarget(1, 2);
    check('F3 Égide — l\'IA ne cible jamais l\'agenouillé protégé', tgt !== 0, `pickAITarget=${tgt}`);
    gard.kneeling = true;
    check('F3 Égide — Égide agenouillée ne protège plus', APIprotected(sb, 1, kneeler) === false, '');
    gard.kneeling = false; gard.asleep = true;
    check('F3 Égide — Égide endormie ne protège plus', APIprotected(sb, 1, kneeler) === false, '');
    gard.asleep = false;
    check('F3 Égide — protection rétablie Égide debout', APIprotected(sb, 1, kneeler) === true, '');
  }

  // F4 · ÉGIDE + PRIÈRE : le fidèle prie (+1 Foi, s'agenouille) et reste
  // improfanable derrière l'Égide — la boucle « prier en sécurité » du moteur.
  {
    const G = fresh(sb, 204);
    const fidele = place(sb, 1, { id:'DUMMY3', n:'Fidèle', atk:1, def:3, cost:2, rarity:'common', cap:'', txt:'' });
    place(sb, 1, EGIDE_TPL);
    check('F4 prière — éligible en phase Combat', API.canPray(1, 0) === true, '');
    API.doPray(1, 0);
    check('F4 prière — +1 Foi et fidèle agenouillé', G.players[1].faith === 1 && fidele.kneeling === true, `faith=${G.players[1].faith}`);
    check('F4 prière — improfanable derrière l\'Égide', APIprotected(sb, 1, fidele) === true, '');
  }

  console.log('');
  return scenarioResults.every(r => r.ok);
}
// protectedByEgide est réassignée dans le sandbox (instrumentation) : on la
// rappelle à travers une évaluation directe pour lire la version live.
function APIprotected(sb, targetP, m) {
  sb.__probeM = m; sb.__probeP = targetP;
  return vm.runInContext('protectedByEgide(globalThis.__probeP, globalThis.__probeM)', sb);
}

// ═══════════════════════════════════════════════════════════════════════════
// ÉTAGE 2 — BATTERIE 500 PARTIES avec placeholders dans les decks
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
  const st = G.aiStats || { 1: {}, 2: {} };
  return {
    turns: G.turn, error,
    winner: vs ? vs.winner : null,
    reason: vs ? vs.reason : null,
    faith1: G.players[1].faith || 0,
    faith2: G.players[2].faith || 0,
    fervor: ((st[1] && st[1].fervorTriggers) || 0) + ((st[2] && st[2].fervorTriggers) || 0),
  };
}

async function main() {
  const sb = loadGame();
  const API = sb.__API;

  const scenariosOK = await runScenarios(sb);

  // Batterie AVEC les porteurs placeholder (pilier 3). Le jeu par défaut
  // (flag off) reste à zéro porteur — vérifié par le golden de la branche.
  API.setFaithPlaceholders(true);
  sb.__FA.egideBlocks = 0;

  const F = API.FACTIONS;
  const pairs = [];
  for (const a of F) for (const b of F) pairs.push([a, b]);

  let total = 0, crashes = 0, turnsSum = 0, unfinished = 0, fervorTotal = 0;
  const byReason = { hp: 0, ascension: 0, clock: 0, draw: 0 };
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
      fervorTotal += r.fervor;
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
  API.setFaithPlaceholders(false);
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  const avgTurns = turnsSum / total;
  const ascPct = 100 * byReason.ascension / total;
  const clockPct = 100 * byReason.clock / total;

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  TEST FAITH — ${total} parties AVEC placeholders Ferveur/Égide (pilier 3)`);
  console.log(`  (FAITH_WIN=${API.FAITH_WIN}, TURN_CAP=${API.TURN_CAP}, decks +2 Zélote +2 Gardien votif)`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Victoires par PV ........... : ${byReason.hp} (${(100*byReason.hp/total).toFixed(1)}%)`);
  console.log(`  Victoires par ASCENSION .... : ${byReason.ascension} (${ascPct.toFixed(1)}%)`);
  console.log(`  Victoires à l'horloge T${API.TURN_CAP} .. : ${byReason.clock} (${clockPct.toFixed(1)}%)`);
  console.log(`  Matchs nuls ................ : ${byReason.draw}`);
  console.log(`  Parties inachevées ......... : ${unfinished}`);
  console.log(`  Durée moyenne .............. : ${avgTurns.toFixed(2)} tours`);
  console.log(`  Foi finale moyenne (2 camps) : ${(faithSum/total/2).toFixed(2)} (max vu : ${faithMax})`);
  console.log(`  Ferveur déclenchée ......... : ${fervorTotal} fois (${(fervorTotal/total).toFixed(2)}/partie)`);
  console.log(`  Égide a protégé ............ : ${sb.__FA.egideBlocks} consultations-vraies`);
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

  const okScen = scenariosOK;
  const okCrash = crashes === 0 && unfinished === 0;
  const okAsc = ascPct >= 5 && ascPct <= 40;
  const okTurns = avgTurns <= 13;
  const okSanity = fervorTotal > 0 && sb.__FA.egideBlocks > 0;
  console.log(`  ${okScen ? '✅' : '❌'} scénarios Ferveur/Égide (${scenarioResults.filter(r=>r.ok).length}/${scenarioResults.length})`);
  console.log(`  ${okCrash ? '✅' : '❌'} 0 crash / 0 inachevée`);
  console.log(`  ${okAsc ? '✅' : '❌'} Ascension ∈ [5, 40] % (mesuré : ${ascPct.toFixed(1)}%)`);
  console.log(`  ${okTurns ? '✅' : '❌'} durée moyenne ≤ 13 tours (mesuré : ${avgTurns.toFixed(2)})`);
  console.log(`  ${okSanity ? '✅' : '❌'} sanity : Ferveur (${fervorTotal}) et Égide (${sb.__FA.egideBlocks}) exercées en partie`);
  process.exit(okScen && okCrash && okAsc && okTurns && okSanity ? 0 : 1);
}
main().catch(e => { console.error('HARNESS FAIL', e); process.exit(1); });
