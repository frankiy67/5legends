#!/usr/bin/env node
/**
 * test_all_cards.js — Vérification fonctionnelle de TOUTES les cartes.
 *
 * Pour chaque carte (monstres + dieux des 5 factions) :
 *   1. IMAGE      — getCardImage(id) résout un fichier réel sur le disque
 *                   (ou est un placeholder connu, listé explicitement).
 *   2. STATS      — atk/def/cost numériques valides ; type cohérent.
 *   3. CAP        — la capacité référencée existe dans un handler
 *                   (GOD_EFFECTS composable, préfixe fd_, ou cap de monstre).
 *   4. ANYTIME    — tout dieu au texte « N'importe quand » répond bien au
 *                   trigger anytime (isAnytime === true) et inversement.
 *
 * Puis une passe « la capacité se déclenche sans erreur JS » : N parties
 * IA vs IA seedées sont jouées ; on vérifie 0 crash et on mesure la
 * couverture (combien de cartes distinctes sont réellement entrées en jeu).
 *
 * Usage : node tools/test_all_cards.js
 * Sortie : 0 si tout passe, 1 sinon.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const GAME_SRC = path.join(ROOT, 'src', 'game.js');

// Cartes sans fichier d'illustration (placeholder volontaire, pas un échec).
const PLACEHOLDER_OK = new Set(['HESTIA', 'SOBEK', 'ORACLE_DELPHES']);

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
  const boot = `\n;globalThis.__API = { MONSTERS, GODS, getCardImage, isAnytime, ANYTIME_CAPS_SET, GOD_EFFECTS, FACTIONS, buildDeck, initGame, aiTurn, seedRNG, doEndTurn, checkVictoryBool, getG: ()=>G, resetAI: ()=>{ aiThinking=false; } };\n`;
  vm.createContext(sandbox);
  vm.runInContext(src + boot, sandbox, { filename: 'game.js' });
  return sandbox.__API;
}

// ── Tests ────────────────────────────────────────────────────────────────
function allCards(API) {
  const out = [];
  for (const f of API.FACTIONS) {
    for (const m of API.MONSTERS[f]) out.push({ ...m, faction: f, type: 'monster' });
    for (const g of API.GODS[f])     out.push({ ...g, faction: f, type: g.type || 'god' });
  }
  return out;
}

async function main() {
  const API = loadGame();
  const cards = allCards(API);
  const fails = [];
  let imgOK = 0, imgPlaceholder = 0, statsOK = 0, capOK = 0, anyOK = 0;
  const godCaps = new Set(Object.keys(API.GOD_EFFECTS));

  for (const c of cards) {
    const tag = `${c.id} [${c.faction}]`;

    // 1. IMAGE
    const src = API.getCardImage(c.id || '');
    if (src) {
      const real = path.join(ROOT, src.replace(/^\.\//, ''));
      if (fs.existsSync(real)) imgOK++;
      else fails.push(`IMG  ${tag} → fichier introuvable: ${src}`);
    } else if (PLACEHOLDER_OK.has(c.id)) {
      imgPlaceholder++;
    } else {
      fails.push(`IMG  ${tag} → aucune illustration (et pas un placeholder connu)`);
    }

    // 2. STATS
    const numOK = Number.isFinite(c.cost) && c.cost >= 0;
    const monOK = c.type === 'monster' ? (Number.isFinite(c.atk) && Number.isFinite(c.def) && c.atk >= 0 && c.def >= 0) : true;
    if (numOK && monOK) statsOK++;
    else fails.push(`STAT ${tag} → cost/atk/def invalide (cost=${c.cost} atk=${c.atk} def=${c.def})`);

    // 3. CAP
    const cap = c.cap || '';
    if (c.type === 'god') {
      if (godCaps.has(cap) || cap.startsWith('fd_')) capOK++;
      else fails.push(`CAP  ${tag} → cap dieu '${cap}' absente de GOD_EFFECTS`);
    } else if (c.type === 'spell') {
      capOK++; // sorts (Oracle) : cap gérée à part
    } else {
      if (cap) capOK++;
      else fails.push(`CAP  ${tag} → monstre sans capacité`);
    }

    // 4. ANYTIME — un dieu est jouable « N'importe quand » si son texte le dit
    // OU si c'est un piège face-cachée (cap fd_, posable à tout moment). On
    // vérifie que isAnytime() (donc ANYTIME_CAPS_SET) reflète exactement ça.
    if (c.type === 'god') {
      const expected = /N'importe quand/i.test(c.txt || '') || (c.cap || '').startsWith('fd_');
      const fnAnytime = API.isAnytime(c);
      if (expected === fnAnytime) anyOK++;
      else fails.push(`ANY  ${tag} → attendu anytime=${expected} mais isAnytime=${fnAnytime} (cap=${c.cap})`);
    }
  }

  // ── Passe « la capacité se déclenche sans erreur JS » + couverture ──
  const N = 60;
  const seen = new Set();
  let crashes = 0;
  for (let seed = 1; seed <= N; seed++) {
    API.resetAI(); API.seedRNG(seed);
    const F = API.FACTIONS;
    API.initGame(F[(seed - 1) % F.length], F[Math.floor((seed - 1) / F.length) % F.length], 'sim');
    const G = API.getG();
    let guard = 0;
    try {
      while (!API.checkVictoryBool() && G.turn <= 200 && guard < 4000) { guard++; await API.aiTurn(G.cp); }
    } catch (e) { crashes++; }
    // Couverture : toute carte vue sur un terrain / défausse / main au fil de la partie
    for (const p of [1, 2]) {
      const P = G.players[p];
      for (const z of [P.field, P.graveyard, P.hand]) for (const c of z) if (c && c.id) seen.add(c.id);
    }
  }
  const playable = cards.filter(c => c.id && !String(c.id).startsWith('RITUAL'));
  const coverage = playable.filter(c => seen.has(c.id)).length;

  // ── Rapport ──
  console.log('═══════════════════════════════════════════════════════');
  console.log('  TEST DE TOUTES LES CARTES — 5 LEGENDS');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Cartes uniques analysées : ${cards.length}`);
  console.log(`  Images OK ............... : ${imgOK}  (+${imgPlaceholder} placeholders volontaires)`);
  console.log(`  Stats valides ........... : ${statsOK}/${cards.length}`);
  console.log(`  Caps avec handler ....... : ${capOK}/${cards.length}`);
  console.log(`  Cohérence anytime ....... : ${anyOK} dieux`);
  console.log(`  Couverture en simulation  : ${coverage}/${playable.length} cartes vues en jeu (${N} parties)`);
  console.log(`  Crashs en simulation .... : ${crashes}/${N}`);
  console.log('───────────────────────────────────────────────────────');
  if (fails.length === 0 && crashes === 0) {
    console.log('  ✅ TOUT PASSE');
    process.exit(0);
  } else {
    console.log(`  ❌ ${fails.length} échec(s) structurel(s) + ${crashes} crash(s) :`);
    for (const f of fails) console.log('   · ' + f);
    process.exit(1);
  }
}
main().catch(e => { console.error('HARNESS FAIL', e); process.exit(1); });
