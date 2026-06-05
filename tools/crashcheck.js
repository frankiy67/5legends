#!/usr/bin/env node
'use strict';
/**
 * crashcheck.js — régression mode NORMAL (Combat rapide).
 * Joue N parties faction-vs-faction avec profils aléatoires, compte les crashs.
 * Usage : node tools/crashcheck.js [N]
 */
const { loadGame, playGame } = require('./sim_core');

const N = parseInt(process.argv[2] || '500', 10);
const PROFILES = ['CONTROL', 'RUSH', 'GUARD', 'RAID'];

// PRNG local (mulberry32) pour le choix des factions, indépendant du RNG du jeu.
let _s = 12345;
function API_rng() { _s |= 0; _s = (_s + 0x6D2B79F5) | 0; let t = Math.imul(_s ^ (_s >>> 15), 1 | _s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }

(async () => {
  const API = loadGame();
  const F = API.FACTIONS;
  let crashes = 0, p1 = 0, p2 = 0, nulls = 0, noterm = 0;
  const errs = [];
  for (let i = 0; i < N; i++) {
    API.seedRNG(1000 + i);
    const f1 = F[Math.floor(API_rng() * F.length)];
    const f2 = F[Math.floor(API_rng() * F.length)];
    const prof = { 1: PROFILES[i % 4], 2: PROFILES[(i + 1) % 4] };
    const r = await playGame(API, 7000 + i, f1, f2, prof, 2);
    if (r.error) { crashes++; if (errs.length < 10) errs.push(`seed ${r.seed} ${f1}v${f2}: ${r.error}`); }
    else if (r.winner === 1) p1++;
    else if (r.winner === 2) p2++;
    else nulls++;
    if (r.endReason === 'timeout') noterm++;
  }
  // petit PRNG local indépendant du jeu pour tirer les factions
  console.log(`\n[crashcheck] ${N} parties — crashs:${crashes} non-term:${noterm} | P1:${p1} P2:${p2} nuls:${nulls}`);
  if (errs.length) { console.log('Erreurs:'); errs.forEach(e => console.log('  ' + e)); }
  process.exit(crashes > 0 || noterm > 0 ? 1 : 0);
})();
