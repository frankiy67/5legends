#!/usr/bin/env node
'use strict';
/**
 * p2_sweep.js — ÉTAPE 3 : calibration de la compensation J2 (P2_START_FAITH).
 *
 * Pour chaque valeur de P2_START_FAITH ∈ {0,1,2}, joue 10 000 parties
 * CONTROL vs CONTROL en MIROIR, factions équilibrées (25 paires ordonnées →
 * chaque faction apparaît autant en P1 qu'en P2). Mesure : win rate J2,
 * longueur moyenne, % horloge céleste.
 *
 * Écrit tools/p2_sweep_results.json + imprime un tableau.
 * Usage: node tools/p2_sweep.js [valeurs="0,1,2"] [parties=10000]
 */
const fs = require('fs');
const path = require('path');
const { loadGame, playGame } = require('./sim_core.js');

const API = loadGame();
const FACTIONS = ['yokai', 'norse', 'egyptian', 'greek', 'aztec'];
const VALUES = (process.argv[2] || '0,1,2').split(',').map(s => parseInt(s, 10));
const N = parseInt(process.argv[3] || '10000', 10);
// 25 paires de factions ordonnées (équilibre des sièges) × seedsPerPair = N.
const seedsPerPair = Math.ceil(N / (FACTIONS.length * FACTIONS.length));

async function sweepValue(v) {
  let p1 = 0, p2 = 0, draws = 0, games = 0, turnSum = 0, clock = 0;
  for (const fX of FACTIONS) {
    for (const fY of FACTIONS) {
      for (let s = 1; s <= seedsPerPair; s++) {
        const r = await playGame(API, s, fX, fY, { 1: 'CONTROL', 2: 'CONTROL' }, v);
        games++; turnSum += r.turn; if (r.clock) clock++;
        if (r.winner === 1) p1++; else if (r.winner === 2) p2++; else draws++;
      }
    }
  }
  return {
    p2StartFaith: v, games,
    j2WinRate: p2 / games, j1WinRate: p1 / games, drawRate: draws / games,
    avgTurn: turnSum / games, clockPct: clock / games,
  };
}

(async () => {
  const t0 = Date.now();
  console.log(`SWEEP compensation J2 — ${N} parties CONTROL vs CONTROL miroir / valeur (${seedsPerPair} graines × 25 paires de factions)\n`);
  const rows = [];
  for (const v of VALUES) {
    const r = await sweepValue(v);
    rows.push(r);
    console.log(`  P2_START_FAITH=${v} : J2 ${(r.j2WinRate * 100).toFixed(1)}%  J1 ${(r.j1WinRate * 100).toFixed(1)}%  nuls ${(r.drawRate * 100).toFixed(1)}%  tour~${r.avgTurn.toFixed(2)}  horloge ${(r.clockPct * 100).toFixed(1)}%`);
  }
  const seconds = Number(((Date.now() - t0) / 1000).toFixed(1));

  // Valeur recommandée : J2 dans [0.50, 0.54] idéalement ; sinon la plus proche
  // de 0.52 (centre de la cible) tout en restant >= 0.50 si possible.
  const target = 0.52;
  const inBand = rows.filter(r => r.j2WinRate >= 0.50 && r.j2WinRate <= 0.54);
  let recommended;
  if (inBand.length) {
    recommended = inBand.sort((a, b) => Math.abs(a.j2WinRate - target) - Math.abs(b.j2WinRate - target))[0];
  } else {
    recommended = rows.slice().sort((a, b) => Math.abs(a.j2WinRate - target) - Math.abs(b.j2WinRate - target))[0];
  }
  console.log(`\n→ Recommandé : P2_START_FAITH=${recommended.p2StartFaith} (J2 ${(recommended.j2WinRate * 100).toFixed(1)}%)  [${seconds}s]`);

  const out = {
    meta: { games: N, seedsPerPair, factions: FACTIONS, faithWin: API.FAITH_WIN, turnCap: API.TURN_CAP, desecrateFaith: API.DESECRATE_FAITH, seconds },
    target: { j2Low: 0.50, j2High: 0.54 },
    recommended: recommended.p2StartFaith,
    rows,
  };
  fs.writeFileSync(path.join(__dirname, 'p2_sweep_results.json'), JSON.stringify(out, null, 1));
  console.log(`✓ → tools/p2_sweep_results.json`);
})().catch((e) => { console.error(e); process.exit(1); });
