'use strict';
/**
 * sim_core.js — Cœur de simulation partagé pour les harnais IA multi-stratégies.
 *
 * Reprend l'environnement Node DOM/audio-stubbé de tools/golden.js (qui reste,
 * lui, INTOUCHÉ pour garantir un golden byte-identique) et expose en plus
 * setAIProfile / getAIProfile et les compteurs d'observation G.aiStats.
 *
 * Le comportement du jeu n'est JAMAIS modifié par ce harnais : il pilote
 * uniquement les fonctions existantes (initGame / aiTurn / setAIProfile).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const GAME_SRC = path.join(ROOT, 'src', 'game.js');

// ── Stub DOM/Audio universel (identique à golden.js) ──────────────────────
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
    return ANY;
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
  sandbox.navigator = { userAgent: 'node-sim' };
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

// Charge game.js et expose l'API interne ÉTENDUE (profils + compteurs).
function loadGame() {
  const src = fs.readFileSync(GAME_SRC, 'utf8');
  const boot = `\n;globalThis.__API = {
    initGame, aiTurn, seedRNG, doEndTurn, checkVictoryBool,
    getG: function(){ return G; },
    resetAI: function(){ aiThinking = false; },
    FACTIONS,
    setAIProfile, getAIProfile,
    FAITH_WIN, TURN_CAP,
    DESECRATE_FAITH: (typeof DESECRATE_FAITH !== 'undefined' ? DESECRATE_FAITH : 0),
  };\n`;
  const sandbox = buildSandbox();
  vm.createContext(sandbox);
  vm.runInContext(src + boot, sandbox, { filename: 'game.js' });
  return sandbox.__API;
}

// Garde-fou de terminaison du harnais. Les seuils de fin (FAITH_WIN / TURN_CAP)
// sont SOURCÉS DEPUIS LE JEU (API) à chaque partie → aucune dérive si game.js change.
const MAX_TURNS = 50;

// Joue une partie complète. profiles = { 1:'RUSH', 2:'GUARD' } (défaut CONTROL).
// Retourne un résumé + les compteurs d'observation des deux joueurs.
async function playGame(API, seed, f1, f2, profiles) {
  const FAITH_WIN = API.FAITH_WIN, TURN_CAP = API.TURN_CAP;
  API.resetAI();
  API.seedRNG(seed);
  API.initGame(f1, f2, 'sim');
  API.setAIProfile(1, (profiles && profiles[1]) || 'CONTROL');
  API.setAIProfile(2, (profiles && profiles[2]) || 'CONTROL');
  const G = API.getG();

  let error = null;
  try {
    let guard = 0;
    while (!API.checkVictoryBool() && G.turn <= MAX_TURNS && guard < 4000) {
      guard++;
      await API.aiTurn(G.cp);
      if (API.checkVictoryBool()) break;
    }
  } catch (e) {
    error = (e && e.stack ? e.stack : String(e)).split('\n').slice(0, 2).join(' | ');
  }

  const faith1 = G.players[1].faith || 0, faith2 = G.players[2].faith || 0;
  let winner = null;
  if (faith1 >= FAITH_WIN && faith2 >= FAITH_WIN) winner = 'both';
  else if (faith1 >= FAITH_WIN) winner = 1;
  else if (faith2 >= FAITH_WIN) winner = 2;
  else if (G.turn > TURN_CAP) {
    if (faith1 > faith2) winner = 1;
    else if (faith2 > faith1) winner = 2;
    else winner = null; // égalité de Foi à l'horloge = nul
  } else winner = null; // timeout pur

  const stats = G.aiStats || { 1: {}, 2: {} };
  return {
    seed, f1, f2, winner, error,
    turn: G.turn,
    clock: G.turn > TURN_CAP,        // partie conclue par l'horloge céleste
    faith: [faith1, faith2],
    stats: { 1: { ...stats[1] }, 2: { ...stats[2] } },
  };
}

// Charge game.js avec un boot SUR MESURE exposant les noms demandés (tests).
function loadGameCustom(names) {
  const src = fs.readFileSync(GAME_SRC, 'utf8');
  const list = names.map((n) => `${n}: (typeof ${n}!=='undefined'?${n}:undefined)`).join(', ');
  const boot = `\n;globalThis.__API = { getG:function(){return G;}, ${list} };\n`;
  const sandbox = buildSandbox();
  vm.createContext(sandbox);
  vm.runInContext(src + boot, sandbox, { filename: 'game.js' });
  return sandbox.__API;
}

module.exports = { loadGame, loadGameCustom, playGame, MAX_TURNS };
