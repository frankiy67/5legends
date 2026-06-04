#!/usr/bin/env node
/**
 * golden.js — Harnais Golden-Master pour 5 Legends.
 *
 * Joue N parties IA vs IA déterministes (RNG seedé 1..N) en chargeant
 * src/game.js dans un environnement Node avec DOM/audio stubbés, puis
 * dumpe pour chaque partie le log complet d'actions + l'état final
 * (PV, board, gagnant) dans tools/golden_snapshot.json.
 *
 * Usage:
 *   node tools/golden.js                 → écrit golden_snapshot.json
 *   node tools/golden.js out.json        → écrit dans out.json
 *   node tools/golden.js out.json 50     → 50 parties
 *
 * Le comportement du jeu n'est JAMAIS modifié par ce harnais : il pilote
 * uniquement les fonctions existantes (initGame / aiTurn) en mode 'sim'.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const GAME_SRC = path.join(ROOT, 'src', 'game.js');

const OUT = process.argv[2] || path.join(__dirname, 'golden_snapshot.json');
const N_GAMES = parseInt(process.argv[3] || '200', 10);
// ASCENSION (C3) : plus de fin par PV → la Foi (>=14) est la seule conclusion.
// Garde-fou de terminaison : abandon à 50 tours = partie "non conclue" (winner=null).
// Sert à DÉTECTER d'éventuelles parties qui ne se terminent pas (pré-horloge C4).
const MAX_TURNS = 50;

// ── Stub DOM/Audio universel ────────────────────────────────────────────
// Proxy "ANY" : tout accès de propriété renvoie un objet chaînable/appelable,
// toute affectation est absorbée. Couvre éléments DOM, classList, style,
// nœuds audio, etc. Aucun de ces objets n'influence la logique de jeu.
const ANY = new Proxy(function () {}, {
  get(_t, prop) {
    if (prop === Symbol.iterator) return function* () {};
    if (prop === Symbol.toPrimitive) return () => '';
    if (prop === 'length') return 0;
    if (prop === 'style' || prop === 'classList' || prop === 'dataset' || prop === 'gain' || prop === 'frequency') return ANY;
    if (prop === 'getBoundingClientRect') return () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 });
    if (prop === 'getChannelData') return () => new Float32Array(0);
    if (prop === 'querySelectorAll' || prop === 'getElementsByClassName' || prop === 'getElementsByTagName') return () => [];
    if (prop === 'forEach' || prop === 'map' || prop === 'filter') return () => [];
    if (prop === 'contains') return () => false;
    if (prop === 'parentNode') return null;
    if (prop === 'nodeType') return 1;
    if (prop === 'textContent' || prop === 'innerHTML' || prop === 'value' || prop === 'className' || prop === 'src' || prop === 'id') return '';
    if (prop === 'offsetHeight' || prop === 'offsetWidth' || prop === 'clientWidth' || prop === 'clientHeight' || prop === 'currentTime' || prop === 'sampleRate') return 0;
    return ANY; // défaut : chaînable et appelable
  },
  set() { return true; },
  apply() { return ANY; },
  construct() { return ANY; },
  has() { return true; },
});

function makeDocument() {
  return {
    getElementById: () => ANY,
    querySelector: () => ANY,
    querySelectorAll: () => [],
    getElementsByClassName: () => [],
    getElementsByTagName: () => [],
    createElement: () => ANY,
    createElementNS: () => ANY,
    createTextNode: () => ANY,
    addEventListener: () => {},
    removeEventListener: () => {},
    body: ANY,
    head: ANY,
    documentElement: ANY,
    readyState: 'complete',
    fonts: { ready: Promise.resolve(), load: () => Promise.resolve(), add: () => {} },
  };
}

function buildSandbox() {
  const sandbox = {};
  // setTimeout → microtask : neutralise tous les délais sans toucher game.js
  sandbox.setTimeout = (fn) => { if (typeof fn === 'function') Promise.resolve().then(fn); return 0; };
  sandbox.clearTimeout = () => {};
  sandbox.setInterval = () => 0;
  sandbox.clearInterval = () => {};
  sandbox.requestAnimationFrame = () => 0;
  sandbox.cancelAnimationFrame = () => {};
  sandbox.queueMicrotask = (fn) => Promise.resolve().then(fn);

  const localStorage = {
    _d: {},
    getItem(k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
    setItem(k, v) { this._d[k] = String(v); },
    removeItem(k) { delete this._d[k]; },
  };
  sandbox.localStorage = localStorage;

  const AudioCtx = function () { return ANY; };
  const win = {
    AudioContext: AudioCtx,
    webkitAudioContext: AudioCtx,
    addEventListener: () => {},
    removeEventListener: () => {},
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    getComputedStyle: () => ANY,
    innerWidth: 1280,
    innerHeight: 800,
    devicePixelRatio: 1,
    localStorage,
    setTimeout: sandbox.setTimeout,
    clearTimeout: sandbox.clearTimeout,
  };
  sandbox.window = win;
  sandbox.document = makeDocument();
  sandbox.navigator = { userAgent: 'node-golden' };
  sandbox.performance = { now: () => 0 };
  sandbox.location = { href: '', search: '', hash: '' };
  sandbox.Audio = function () { return ANY; };
  sandbox.Image = function () { return ANY; };
  sandbox.AudioContext = AudioCtx;
  sandbox.webkitAudioContext = AudioCtx;
  sandbox.CustomEvent = function () { return ANY; };
  sandbox.Event = function () { return ANY; };
  sandbox.console = console;
  sandbox.globalThis = sandbox;
  return sandbox;
}

function loadGame() {
  const src = fs.readFileSync(GAME_SRC, 'utf8');
  // Bootstrap : expose l'API interne (ferme sur le scope du script).
  const boot = `\n;globalThis.__API = { initGame, aiTurn, seedRNG, doEndTurn, checkVictoryBool, getG: function(){ return G; }, resetAI: function(){ aiThinking = false; }, FACTIONS, FAITH_WIN, TURN_CAP };\n`;
  const sandbox = buildSandbox();
  vm.createContext(sandbox);
  vm.runInContext(src + boot, sandbox, { filename: 'game.js' });
  return sandbox.__API;
}

// ── Sérialisation d'un état de jeu (fingerprint stable) ─────────────────
function serCard(c) {
  if (!c) return null;
  return {
    n: c.n, id: c.id || '', type: c.type,
    cAtk: c.cAtk, cDef: c.cDef, cost: c.cost,
    cap: c.cap || '',
    faceDown: !!c.faceDown, asleep: !!c.asleep, sanded: !!c.sanded,
    cursed: !!c.cursed, bewitched: !!c.bewitched, blinded: !!c.blinded,
    buff3turn: !!c.buff3turn,
  };
}
function serPlayer(P) {
  return {
    faction: P.faction,
    hp: P.hp,
    gems: P.gems,
    maxGems: P.maxGems,
    field: P.field.map(serCard),
    hand: P.hand.map((c) => c && c.n),
    graveyard: P.graveyard.map((c) => c && c.n),
    deckCount: P.deck.length,
    attacked: [...(P.attacked || [])].sort((a, b) => a - b),
    summoned: [...(P.summoned || [])].sort((a, b) => a - b),
  };
}

async function playGame(API, seed) {
  const F = API.FACTIONS;
  // Seuils de fin SOURCÉS DEPUIS LE JEU (évite la dérive si FAITH_WIN/TURN_CAP changent).
  const FAITH_WIN = API.FAITH_WIN, TURN_CAP = API.TURN_CAP;
  const f1 = F[(seed - 1) % F.length];
  const f2 = F[Math.floor((seed - 1) / F.length) % F.length];

  API.resetAI(); // un crash de partie précédente laisse aiThinking=true sinon
  API.seedRNG(seed);
  API.initGame(f1, f2, 'sim');
  const G = API.getG();

  const hpTrace = [];
  let guard = 0;
  let error = null;
  try {
    while (!API.checkVictoryBool() && G.turn <= MAX_TURNS && guard < 4000) {
      guard++;
      const cur = G.cp;
      await API.aiTurn(cur);
      hpTrace.push([G.turn, G.players[1].hp, G.players[2].hp]);
      if (API.checkVictoryBool()) break;
    }
  } catch (e) {
    // Un crash est un comportement DÉTERMINISTE du jeu actuel → on le capture
    // tel quel dans le golden (un refactor qui le modifie sera détecté par le diff).
    // On NEUTRALISE les numéros de ligne/colonne : un refactor pur décale les
    // lignes ssource sans changer le comportement. Le type/message d'erreur et
    // les noms de fonctions de la stack restent, eux, significatifs.
    const m = (e && e.stack ? e.stack : String(e)).split('\n').slice(0, 3).join(' | ');
    error = m.replace(/:\d+:\d+/g, ':L:C');
  }

  // BRIQUE 2 : vainqueur = Ascension (Foi>=FAITH_WIN, priorité) OU adversaire d'un
  // joueur à 0 PV OU, à l'horloge céleste, plus de Foi puis plus de PV (sinon nul).
  // Reproduit l'ordre de checkVictory (Foi → PV → horloge).
  let winner = null;
  const faith1 = G.players[1].faith || 0, faith2 = G.players[2].faith || 0;
  const hp1 = G.players[1].hp, hp2 = G.players[2].hp;
  if (faith1 >= FAITH_WIN && faith2 >= FAITH_WIN) winner = 'both';
  else if (faith1 >= FAITH_WIN) winner = 1;
  else if (faith2 >= FAITH_WIN) winner = 2;
  else if (hp1 <= 0) winner = 2;   // checkVictory teste p=1 d'abord → adversaire 2 gagne
  else if (hp2 <= 0) winner = 1;
  else if (G.turn > TURN_CAP) { // horloge : plus de Foi, puis plus de PV, sinon nul
    if (faith1 !== faith2) winner = faith1 > faith2 ? 1 : 2;
    else if (hp1 !== hp2) winner = hp1 > hp2 ? 1 : 2;
    else winner = null; // Foi ET PV égaux = nul
  }
  else winner = null; // timeout pur (cap MAX_TURNS)

  // Le log est stocké en unshift (plus récent en tête) → on remet en ordre chrono.
  const actionLog = G.log.map((e) => e.msg).reverse();

  return {
    seed, f1, f2,
    winner,
    error,
    turn: G.turn,
    cp: G.cp,
    cycle: G.cycle,
    ragnarok: G.ragnarok,
    hp: [G.players[1].hp, G.players[2].hp],
    hpTrace,
    players: { 1: serPlayer(G.players[1]), 2: serPlayer(G.players[2]) },
    actionCount: actionLog.length,
    actionLog,
  };
}

async function main() {
  const API = loadGame();
  const results = [];
  const t0 = Date.now();
  for (let seed = 1; seed <= N_GAMES; seed++) {
    const r = await playGame(API, seed);
    results.push(r);
    if (seed % 25 === 0 || seed === N_GAMES) {
      process.stdout.write(`  ${seed}/${N_GAMES} parties jouées\n`);
    }
  }
  const dt = ((Date.now() - t0) / 1000).toFixed(1);

  // Résumé winrates pour sanity check
  const wins = { 1: 0, 2: 0, null: 0, both: 0 };
  let errored = 0;
  for (const r of results) { wins[r.winner === null ? 'null' : r.winner]++; if (r.error) errored++; }

  const snapshot = {
    meta: {
      nGames: N_GAMES,
      maxTurns: MAX_TURNS,
      generatedSeconds: Number(dt),
      summary: { p1Wins: wins[1], p2Wins: wins[2], draws: wins['null'], both: wins.both, errored },
    },
    games: results,
  };
  fs.writeFileSync(OUT, JSON.stringify(snapshot, null, 1));
  console.log(`\n✓ ${N_GAMES} parties en ${dt}s → ${path.relative(ROOT, OUT)}`);
  console.log(`  P1: ${wins[1]}  P2: ${wins[2]}  nuls: ${wins['null']}  double-KO: ${wins.both}  crashs: ${errored}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
