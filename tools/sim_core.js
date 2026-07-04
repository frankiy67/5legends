'use strict';
/**
 * sim_core.js — Cœur de simulation partagé pour les harnais IA multi-stratégies.
 * Porté de feat-ai-multistrat et ADAPTÉ au moteur v1 (double victoire) :
 * le gagnant vient de getVictoryState (PV / Ascension / horloge T18), et
 * P2_START_FAITH n'est forcé que si demandé (défaut = valeur du jeu, 0).
 *
 * Reprend l'environnement Node DOM/audio-stubbé de tools/golden.js (qui reste,
 * lui, INTOUCHÉ pour garantir un golden byte-identique) et expose en plus
 * setAIProfile / getAIProfile et les compteurs d'observation G.aiStats.
 * Le comportement du jeu n'est JAMAIS modifié par ce harnais.
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
  sandbox.window = {
    AudioContext: AudioCtx, webkitAudioContext: AudioCtx,
    addEventListener: () => {}, removeEventListener: () => {},
    requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    getComputedStyle: () => ANY, innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1,
    localStorage, setTimeout: sandbox.setTimeout, clearTimeout: sandbox.clearTimeout,
  };
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
    initGame, aiTurn, seedRNG, doEndTurn, checkVictoryBool, getVictoryState,
    getG: function(){ return G; },
    resetAI: function(){ aiThinking = false; },
    FACTIONS,
    setAIProfile, getAIProfile,
    FAITH_WIN, TURN_CAP, DESECRATE_FAITH,
    setP2StartFaith,
  };\n`;
  const sandbox = buildSandbox();
  vm.createContext(sandbox);
  vm.runInContext(src + boot, sandbox, { filename: 'game.js' });
  return sandbox.__API;
}

// Garde-fou de terminaison du harnais (le jeu se termine de lui-même via
// PV / Ascension / horloge T18 — ceci n'est qu'une ceinture de sécurité).
const MAX_TURNS = 50;

// Joue une partie complète. profiles = { 1:'RUSH', 2:'GUARD' } (défaut CONTROL).
// p2faith : si non-null, force P2_START_FAITH pour un sweep (défaut : 0, la
// valeur retenue du jeu — décision Frank Q3).
async function playGame(API, seed, f1, f2, profiles, p2faith) {
  API.resetAI();
  API.seedRNG(seed);
  if (p2faith != null) API.setP2StartFaith(p2faith);
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

  // v1 : gagnant via getVictoryState (PV / Ascension / horloge, nul = 0).
  const vs = API.getVictoryState();
  const winner = vs ? (vs.winner === 0 ? null : vs.winner) : null;
  const stats = G.aiStats || { 1: {}, 2: {} };
  return {
    seed, f1, f2, winner, error,
    reason: vs ? vs.reason : null,
    turn: G.turn,
    faith: [G.players[1].faith || 0, G.players[2].faith || 0],
    stats: { 1: { ...(stats[1] || {}) }, 2: { ...(stats[2] || {}) } },
  };
}

module.exports = { loadGame, playGame, MAX_TURNS };
