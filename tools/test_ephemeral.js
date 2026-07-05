#!/usr/bin/env node
/**
 * test_ephemeral.js — validation VAGUE 2 du pool : Éphémère (phases) et
 * Nocturne/Diurne (POOL_DESIGN §3, consigne Frank : « vérifie
 * matérialisation/estompage au tick exact »).
 *
 * DEUX ÉTAGES :
 *  1. SCÉNARIOS DIRIGÉS (déterministes, headless, Cycle piloté à la main) :
 *     · Nurikabe (Crépuscule/Nuit/Ténèbres) : estompé à l'invocation hors
 *       fenêtre, matérialisé EXACTEMENT à l'entrée en Crépuscule, estompé
 *       EXACTEMENT à la sortie des Ténèbres ;
 *     · Tzitzimitl (Ténèbres seul) : fenêtre d'une seule phase ;
 *     · Icare (Aube/Midi) : présent dans sa fenêtre, DÉTRUIT (pas estompé)
 *       quand Midi se termine — au cimetière au tick exact ;
 *     · Tanuki Nocturne/Diurne : bascule 2/4 Rempart ↔ 4/2 Élan aux
 *       transitions Jour/Nuit exactes, le Crépuscule CONSERVE la face,
 *       les dégâts subis suivent la bascule (plancher 1) ;
 *     · Nagual : entre en jeu sur la face de la phase courante ;
 *     · Éphémère endormi : la fenêtre s'ouvre mais il reste face cachée (Sommeil).
 *  2. BATTERIE — duels draftés seedés (défaut 300) où l'invariant est vérifié
 *     à CHAQUE itération : un Éphémère est estompé si et seulement si la
 *     phase courante est hors de sa fenêtre. 0 crash exigé.
 *
 * Usage : node tools/test_ephemeral.js [nGames=300]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const GAME_SRC = path.join(ROOT, 'src', 'game.js');
const N_GAMES = parseInt(process.argv[2] || '300', 10);

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
  const boot = `
globalThis.__API = { FACTIONS, CYCLE_PHASES, POOL_MONSTERS, initGame, aiTurn, seedRNG,
  checkVictoryBool, getVictoryState, setCyclePhase, newCard, poolOnSummon, arenaAIDraft,
  getG: ()=>G, resetAI: ()=>{ aiThinking=false; } };
`;
  vm.createContext(sandbox);
  vm.runInContext(src + boot, sandbox, { filename: 'game.js' });
  return sandbox;
}

const results = [];
function check(name, cond, detail) {
  results.push({ name, ok: !!cond });
  console.log(`  ${cond ? '✅' : '❌'} ${name}${cond ? '' : '   → ' + (detail || '')}`);
}

// Invoque une carte du pool sur le terrain de p (chemin réel : newCard + push
// + poolOnSummon, comme playMonster).
function summon(API, p, faction, id) {
  const G = API.getG();
  const tmpl = API.POOL_MONSTERS[faction].find(c => c.id === id);
  const m = API.newCard({ ...tmpl, type: 'monster', faction });
  G.players[p].field.push(m);
  API.poolOnSummon(p, m);
  return m;
}
// Amène le Cycle sur une phase nommée (transitions forward une à une).
function driveTo(API, phase) {
  const G = API.getG();
  let guard = 0;
  while (API.CYCLE_PHASES[G.cycle % 5] !== phase && guard++ < 10) {
    API.setCyclePhase(G.cycle + 1, 'test');
  }
}

async function directedScenarios(API) {
  console.log('─── SCÉNARIOS DIRIGÉS ───────────────────────────────────────');

  // 1) NURIKABE — fenêtre Crépuscule/Nuit/Ténèbres
  API.resetAI(); API.seedRNG(101); API.initGame('yokai', 'norse', 'sim');
  let G = API.getG(); // cycle = 0 (aube)
  const nuri = summon(API, 1, 'yokai', 'P_NURIKABE');
  check('Nurikabe invoqué à l\'Aube → estompé immédiatement',
    nuri._ephFaded === true && nuri.faceDown === true, JSON.stringify({f:nuri._ephFaded,fd:nuri.faceDown}));
  API.setCyclePhase(G.cycle + 1, 'test'); // midi
  check('Nurikabe à Midi → toujours estompé', nuri._ephFaded === true);
  API.setCyclePhase(G.cycle + 1, 'test'); // crepuscule
  check('Nurikabe : matérialisé EXACTEMENT à l\'entrée en Crépuscule',
    nuri._ephFaded === false && nuri.faceDown === false);
  API.setCyclePhase(G.cycle + 1, 'test'); // nuit
  API.setCyclePhase(G.cycle + 1, 'test'); // tenebres
  check('Nurikabe : présent pendant Nuit et Ténèbres', nuri._ephFaded === false);
  API.setCyclePhase(G.cycle + 1, 'test'); // aube
  check('Nurikabe : estompé EXACTEMENT à la sortie des Ténèbres',
    nuri._ephFaded === true && nuri.faceDown === true);

  // 2) TZITZIMITL — fenêtre d'une seule phase (Ténèbres)
  API.resetAI(); API.seedRNG(102); API.initGame('aztec', 'greek', 'sim');
  G = API.getG();
  driveTo(API, 'crepuscule');
  const tzi = summon(API, 1, 'aztec', 'P_TZITZIMITL');
  check('Tzitzimitl invoqué au Crépuscule → estompé (fenêtre = Ténèbres seul)', tzi._ephFaded === true);
  driveTo(API, 'tenebres');
  check('Tzitzimitl : matérialisé à l\'entrée en Ténèbres', tzi._ephFaded === false);
  API.setCyclePhase(G.cycle + 1, 'test'); // aube
  check('Tzitzimitl : ré-estompé à la sortie des Ténèbres', tzi._ephFaded === true);

  // 3) ICARE — présent Aube/Midi, DÉTRUIT quand Midi se termine
  API.resetAI(); API.seedRNG(103); API.initGame('greek', 'aztec', 'sim');
  G = API.getG(); // aube
  const icare = summon(API, 1, 'greek', 'P_ICARE');
  check('Icare invoqué à l\'Aube → présent (dans sa fenêtre)', !icare._ephFaded && !icare.faceDown);
  API.setCyclePhase(G.cycle + 1, 'test'); // midi
  check('Icare à Midi → toujours présent', !icare._ephFaded);
  API.setCyclePhase(G.cycle + 1, 'test'); // crepuscule — Midi se termine
  check('Icare CHUTE quand Midi se termine : hors terrain, au cimetière',
    !G.players[1].field.includes(icare) && G.players[1].graveyard.includes(icare));

  // 3b) Icare invoqué la Nuit → estompé, matérialisé à l'Aube (pas détruit)
  API.resetAI(); API.seedRNG(104); API.initGame('greek', 'aztec', 'sim');
  G = API.getG();
  driveTo(API, 'nuit');
  const icare2 = summon(API, 1, 'greek', 'P_ICARE');
  check('Icare invoqué la Nuit → estompé (il attend l\'Aube)', icare2._ephFaded === true);
  driveTo(API, 'aube');
  check('Icare : matérialisé à l\'Aube suivante, vivant',
    icare2._ephFaded === false && G.players[1].field.includes(icare2));

  // 4) TANUKI — Nocturne/Diurne, dégâts conservés, Crépuscule = face conservée
  API.resetAI(); API.seedRNG(105); API.initGame('yokai', 'norse', 'sim');
  G = API.getG();
  driveTo(API, 'midi');
  const tanu = summon(API, 1, 'yokai', 'P_TANUKI2');
  check('Tanuki invoqué à Midi → face Diurne 2/4 Rempart',
    tanu.cAtk === 2 && tanu.cDef === 4 && /\bprotect\b/.test(tanu.cap) && !/\bhurry\b/.test(tanu.cap),
    `${tanu.cAtk}/${tanu.cDef} cap=${tanu.cap}`);
  tanu.cDef -= 1; // 1 dégât subi en face Diurne (2/4 → 2/3)
  API.setCyclePhase(G.cycle + 1, 'test'); // crepuscule
  check('Tanuki au Crépuscule → CONSERVE la face Diurne (2/3 blessé)',
    tanu.cAtk === 2 && tanu.cDef === 3 && tanu._dnFace === 'day');
  API.setCyclePhase(G.cycle + 1, 'test'); // nuit
  check('Tanuki à la Nuit → bascule Nocturne 4/2 Élan, dégâts suivis (cDef 1)',
    tanu.cAtk === 4 && tanu.cDef === 1 && /\bhurry\b/.test(tanu.cap) && !/\bprotect\b/.test(tanu.cap),
    `${tanu.cAtk}/${tanu.cDef} cap=${tanu.cap}`);
  API.setCyclePhase(G.cycle + 1, 'test'); // tenebres
  API.setCyclePhase(G.cycle + 1, 'test'); // aube
  check('Tanuki à l\'Aube → re-bascule Diurne, plancher des dégâts respecté (2/3)',
    tanu.cAtk === 2 && tanu.cDef === 3 && /\bprotect\b/.test(tanu.cap));

  // 5) NAGUAL — entre en jeu sur la face de la phase courante
  API.resetAI(); API.seedRNG(106); API.initGame('aztec', 'yokai', 'sim');
  G = API.getG();
  driveTo(API, 'nuit');
  const nag = summon(API, 1, 'aztec', 'P_NAGUAL2');
  // Faces post-équilibrage vague 2 : Diurne 2/3 · Nocturne 4/2 (design 2/2 · 4/1,
  // ajusté +1 DEF chaque face — cf. POOL_STATUS).
  check('Nagual invoqué la Nuit → entre en face Nocturne 4/2',
    nag.cAtk === 4 && nag.cDef === 2 && nag._dnFace === 'night',
    `${nag.cAtk}/${nag.cDef} face=${nag._dnFace}`);

  // 6) Éphémère endormi : la fenêtre s'ouvre mais le Sommeil prime (face cachée)
  API.resetAI(); API.seedRNG(107); API.initGame('yokai', 'norse', 'sim');
  G = API.getG();
  driveTo(API, 'crepuscule');
  const nuri2 = summon(API, 1, 'yokai', 'P_NURIKABE'); // matérialisé
  API.setCyclePhase(G.cycle + 1, 'test'); // nuit — toujours dans la fenêtre
  nuri2.asleep = true; nuri2.faceDown = true; nuri2.sleepTurns = 2; // endormi de force
  API.setCyclePhase(G.cycle + 1, 'test'); // tenebres — fenêtre ouverte
  check('Éphémère endormi : reste face cachée tant que le Sommeil dure',
    !nuri2._ephFaded && nuri2.faceDown === true && nuri2.asleep === true,
    JSON.stringify({f:nuri2._ephFaded, fd:nuri2.faceDown, sl:nuri2.asleep}));
}

async function fuzzBattery(API) {
  console.log(`─── BATTERIE ${N_GAMES} duels draftés (invariant par itération) ───`);
  const F = API.FACTIONS;
  let crashes = 0, violations = 0, turnSum = 0, decided = 0, ephSeen = 0;
  for (let seed = 1; seed <= N_GAMES; seed++) {
    const f1 = F[(seed - 1) % F.length];
    const f2 = F[Math.floor((seed - 1) / F.length) % F.length];
    API.resetAI(); API.seedRNG(seed);
    const d1 = API.arenaAIDraft(f1, 40);
    const d2 = API.arenaAIDraft(f2, 40);
    API.initGame(f1, f2, 'sim', { customDeck: d1, customDeck2: d2 });
    const G = API.getG();
    let guard = 0;
    try {
      while (!API.checkVictoryBool() && guard < 4000 && G.turn <= 200) {
        guard++;
        // INVARIANT : un Éphémère est estompé ⟺ la phase courante est hors fenêtre.
        const ph = API.CYCLE_PHASES[G.cycle % 5];
        for (const pl of [1, 2]) for (const m of G.players[pl].field) {
          if (!m || !m.eph) continue;
          ephSeen++;
          const inWin = m.eph.includes(ph);
          if (inWin === !!m._ephFaded) {
            violations++;
            if (violations <= 3) console.log(`   ⚠ seed ${seed} t${G.turn} : ${m.n} inWin=${inWin} faded=${m._ephFaded} ph=${ph}`);
          }
        }
        await API.aiTurn(G.cp);
      }
      decided++; turnSum += G.turn;
    } catch (e) {
      crashes++;
      if (crashes <= 3) console.log(`   💥 seed ${seed}: ${String(e && e.stack ? e.stack.split('\n')[0] : e).slice(0, 130)}`);
    }
  }
  const avg = decided ? (turnSum / decided) : 0;
  console.log(`  Parties : ${decided}/${N_GAMES} · états Éphémère inspectés : ${ephSeen}`);
  check('Batterie : 0 crash', crashes === 0, `${crashes} crash(s)`);
  check('Batterie : 0 violation de fenêtre Éphémère (tick exact)', violations === 0, `${violations} violation(s)`);
  check('Batterie : durée moyenne ≤ 12 tours', avg <= 12, avg.toFixed(2));
  console.log(`  Durée moyenne : ${avg.toFixed(2)} tours`);
}

async function main() {
  const sb = loadGame();
  const API = sb.__API;
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  TEST ÉPHÉMÈRE / NOCTURNE-DIURNE (pool vague 2)');
  console.log('═══════════════════════════════════════════════════════════');
  await directedScenarios(API);
  await fuzzBattery(API);
  const bad = results.filter(r => !r.ok);
  console.log('─────────────────────────────────────────────────────────────');
  console.log(bad.length === 0
    ? `  ✅ TOUT PASSE (${results.length}/${results.length})`
    : `  ❌ ${bad.length}/${results.length} échec(s)`);
  process.exit(bad.length === 0 ? 0 : 1);
}
main().catch(e => { console.error('HARNESS FAIL', e); process.exit(1); });
