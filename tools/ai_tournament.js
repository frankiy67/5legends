#!/usr/bin/env node
'use strict';
/**
 * ai_tournament.js — PHASE 3 : le grand tournoi des profils IA.
 *
 * Mesure le TRIANGLE stratégique entre {CONTROL, RUSH, GUARD, RAID} :
 *   1. Matrice stratégie × stratégie : win rate, longueur, % horloge céleste.
 *      Sièges équilibrés (chaque appariement joué dans les deux sens) et toutes
 *      les paires de factions balayées → ≥ 5000 parties par paire de stratégies.
 *   2. Mirrors (A vs A) : met en évidence le biais de siège (P1 vs P2).
 *   3. Passe faction × stratégie : win rate de chaque (faction, stratégie) contre
 *      CONTROL (étalon), factions adverses balayées, sièges équilibrés.
 *
 * Écrit tools/ai_tournament_results.json (consommé par ai_report.js, Phase 4).
 * Ne MESURE que — ne change ni cartes ni factions.
 *
 * Usage: node tools/ai_tournament.js [seedsStrat=100] [seedsFaction=40]
 */
const fs = require('fs');
const path = require('path');
const { loadGame, playGame } = require('./sim_core.js');

const API = loadGame();
const FACTIONS = ['yokai', 'norse', 'egyptian', 'greek', 'aztec'];
const STRATS = ['CONTROL', 'RUSH', 'GUARD', 'RAID'];
const SEEDS_STRAT = parseInt(process.argv[2] || '100', 10);   // 25 paires × 2 sièges × 100 = 5000 / paire
const SEEDS_FAC = parseInt(process.argv[3] || '40', 10);

let GAMES_PLAYED = 0;
const T0 = Date.now();
function tick(n) {
  GAMES_PLAYED += n;
  if (GAMES_PLAYED % 2000 < n) {
    const s = ((Date.now() - T0) / 1000).toFixed(0);
    process.stdout.write(`  ${GAMES_PLAYED} parties (${s}s)\n`);
  }
}

// ── 1) Matrice stratégie × stratégie (off-diagonale, paires non ordonnées) ──
// Pour la paire {A,B} : A en P1/B en P2 sur la moitié, A en P2/B en P1 sur
// l'autre, toutes paires de factions balayées. On remplit M[A][B] et M[B][A].
async function runStratPair(A, B) {
  let winA = 0, winB = 0, draws = 0, games = 0, turnSum = 0, clock = 0;
  for (const fX of FACTIONS) {
    for (const fY of FACTIONS) {
      for (let s = 1; s <= SEEDS_STRAT; s++) {
        // siège 1 : A=P1 (fX), B=P2 (fY)
        let r = await playGame(API, s, fX, fY, { 1: A, 2: B });
        games++; turnSum += r.turn; if (r.clock) clock++;
        if (r.winner === 1) winA++; else if (r.winner === 2) winB++; else draws++;
        // siège 2 : A=P2 (fX), B=P1 (fY)
        r = await playGame(API, s, fY, fX, { 1: B, 2: A });
        games++; turnSum += r.turn; if (r.clock) clock++;
        if (r.winner === 2) winA++; else if (r.winner === 1) winB++; else draws++;
      }
    }
  }
  tick(games);
  return { games, winA, winB, draws, avgTurn: turnSum / games, clockPct: clock / games };
}

// ── 2) Mirror A vs A : biais de siège ──────────────────────────────────────
async function runMirror(A) {
  let p1 = 0, p2 = 0, draws = 0, games = 0, turnSum = 0, clock = 0;
  for (const fX of FACTIONS) {
    for (const fY of FACTIONS) {
      for (let s = 1; s <= SEEDS_FAC; s++) {
        const r = await playGame(API, s, fX, fY, { 1: A, 2: A });
        games++; turnSum += r.turn; if (r.clock) clock++;
        if (r.winner === 1) p1++; else if (r.winner === 2) p2++; else draws++;
      }
    }
  }
  tick(games);
  return { games, p1Wins: p1, p2Wins: p2, draws, avgTurn: turnSum / games, clockPct: clock / games };
}

// ── 3) Faction × stratégie : (Fa jouant Sa) vs CONTROL, factions adverses balayées ──
async function runFactionStrat(Sa, Fa) {
  let wins = 0, draws = 0, games = 0, turnSum = 0, clock = 0;
  for (const Fo of FACTIONS) {
    for (let s = 1; s <= SEEDS_FAC; s++) {
      // siège 1 : acteur P1
      let r = await playGame(API, s, Fa, Fo, { 1: Sa, 2: 'CONTROL' });
      games++; turnSum += r.turn; if (r.clock) clock++;
      if (r.winner === 1) wins++; else if (r.winner == null || r.winner === 'both') draws++;
      // siège 2 : acteur P2
      r = await playGame(API, s, Fo, Fa, { 1: 'CONTROL', 2: Sa });
      games++; turnSum += r.turn; if (r.clock) clock++;
      if (r.winner === 2) wins++; else if (r.winner == null || r.winner === 'both') draws++;
    }
  }
  tick(games);
  return { games, wins, draws, winRate: wins / games, avgTurn: turnSum / games, clockPct: clock / games };
}

(async () => {
  console.log(`PHASE 3 — Grand tournoi`);
  console.log(`  strat×strat : 25 paires factions × ${SEEDS_STRAT} graines × 2 sièges = ${25 * SEEDS_STRAT * 2}/paire de stratégies`);
  console.log(`  faction×strat : 5 factions adverses × ${SEEDS_FAC} graines × 2 sièges = ${5 * SEEDS_FAC * 2}/cellule\n`);

  // 1) Matrice stratégie × stratégie
  const stratMatrix = {};
  for (const A of STRATS) stratMatrix[A] = {};
  const pairMeta = {}; // longueur + % horloge par appariement (clé "A|B" non ordonnée)
  for (let i = 0; i < STRATS.length; i++) {
    for (let j = i + 1; j < STRATS.length; j++) {
      const A = STRATS[i], B = STRATS[j];
      const r = await runStratPair(A, B);
      const total = r.games;
      stratMatrix[A][B] = r.winA / total;
      stratMatrix[B][A] = r.winB / total;
      pairMeta[`${A}|${B}`] = {
        games: total, winA: r.winA, winB: r.winB, draws: r.draws,
        winRateA: r.winA / total, winRateB: r.winB / total, drawPct: r.draws / total,
        avgTurn: r.avgTurn, clockPct: r.clockPct,
      };
    }
  }

  // 2) Mirrors
  const mirror = {};
  for (const A of STRATS) mirror[A] = await runMirror(A);

  // 3) Faction × stratégie
  const factionStrat = {};
  for (const Sa of STRATS) {
    factionStrat[Sa] = {};
    for (const Fa of FACTIONS) factionStrat[Sa][Fa] = await runFactionStrat(Sa, Fa);
  }

  const seconds = Number(((Date.now() - T0) / 1000).toFixed(1));
  const out = {
    meta: {
      strategies: STRATS, factions: FACTIONS,
      seedsStrat: SEEDS_STRAT, seedsFaction: SEEDS_FAC,
      gamesPerStratPair: 25 * SEEDS_STRAT * 2,
      gamesPerFactionCell: 5 * SEEDS_FAC * 2,
      totalGames: GAMES_PLAYED, seconds,
      faithWin: API.FAITH_WIN, turnCap: API.TURN_CAP,
      desecrateFaith: API.DESECRATE_FAITH,
    },
    stratMatrix, pairMeta, mirror, factionStrat,
  };
  const OUT = path.join(__dirname, 'ai_tournament_results.json');
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log(`\n✓ ${GAMES_PLAYED} parties en ${seconds}s → ${path.relative(path.resolve(__dirname, '..'), OUT)}`);
})().catch((e) => { console.error(e); process.exit(1); });
