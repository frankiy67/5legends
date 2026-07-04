#!/usr/bin/env node
'use strict';
/**
 * ai_validate.js — garde-fou : validation COMPORTEMENTALE des profils IA.
 * Porté de feat-ai-multistrat (commit P2) et ADAPTÉ au moteur v1 :
 *  · monde double-victoire (PV + Ascension) — CONTROL est l'IA brique A ;
 *  · AUCUN porteur de Ferveur en v1 (décision Frank Q1) → l'axe fervor de la
 *    signature RAID est affiché mais RETIRÉ des assertions (recalibrage
 *    documenté dans DECISIONS_V5.md [B2]).
 *
 * Méthode : pour chaque profil X, X joue contre CONTROL sur graines × paires
 * de factions, sièges équilibrés. On agrège les compteurs d'OBSERVATION du
 * joueur-X et on les compare à la référence CONTROL-vs-CONTROL.
 *
 * Usage: node tools/ai_validate.js [seedsParPaire=20]
 */
const { loadGame, playGame } = require('./sim_core.js');

const API = loadGame();
const FACTIONS = ['yokai', 'norse', 'egyptian', 'greek', 'aztec'];
const SEEDS = parseInt(process.argv[2] || '20', 10);

function newAgg() {
  return {
    games: 0, wins: 0,
    prayers: 0, firstPraySum: 0, firstPrayGames: 0,
    fervorTriggers: 0, enemyKills: 0, profanations: 0,
    kneelersLost: 0, protectPlayed: 0,
  };
}
function addActor(agg, st, won) {
  agg.games++;
  if (won) agg.wins++;
  agg.prayers += st.prayers || 0;
  if (st.firstPrayTurn != null) { agg.firstPraySum += st.firstPrayTurn; agg.firstPrayGames++; }
  agg.fervorTriggers += st.fervorTriggers || 0;
  agg.enemyKills += st.enemyKills || 0;
  agg.profanations += st.profanations || 0;
  agg.kneelersLost += st.kneelersLost || 0;
  agg.protectPlayed += st.protectPlayed || 0;
}
function summary(agg) {
  const g = agg.games || 1;
  const survival = agg.prayers > 0 ? 1 - agg.kneelersLost / agg.prayers : null;
  return {
    games: agg.games,
    winRate: agg.wins / g,
    prayersPerGame: agg.prayers / g,
    firstPrayTurn: agg.firstPrayGames > 0 ? agg.firstPraySum / agg.firstPrayGames : null,
    fervorPerGame: agg.fervorTriggers / g,
    enemyKillsPerGame: agg.enemyKills / g,
    profanationsPerGame: agg.profanations / g,
    kneelersLostPerGame: agg.kneelersLost / g,
    protectPlayedPerGame: agg.protectPlayed / g,
    prayerSurvival: survival,
  };
}

// Joue le jeu de graines × paires pour {actor, opp}, sièges équilibrés.
async function runConfig(actorProfile, oppProfile) {
  const agg = newAgg();
  for (const fA of FACTIONS) {
    for (const fB of FACTIONS) {
      for (let s = 1; s <= SEEDS; s++) {
        let r = await playGame(API, s, fA, fB, { 1: actorProfile, 2: oppProfile });
        addActor(agg, r.stats[1], r.winner === 1);
        r = await playGame(API, s, fB, fA, { 1: oppProfile, 2: actorProfile });
        addActor(agg, r.stats[2], r.winner === 2);
      }
    }
  }
  return summary(agg);
}

function fmt(x, d = 2) { return x == null ? '  n/a' : x.toFixed(d); }

(async () => {
  const t0 = Date.now();
  console.log(`GARDE-FOU — Validation comportementale (${SEEDS} graines × 25 paires × 2 sièges = ${SEEDS * 25 * 2} parties/profil)\n`);

  const CTRL = await runConfig('CONTROL', 'CONTROL');
  const RUSH = await runConfig('RUSH', 'CONTROL');
  const GUARD = await runConfig('GUARD', 'CONTROL');
  const RAID = await runConfig('RAID', 'CONTROL');

  const rows = [
    ['métrique (par partie)', 'CONTROL', 'RUSH', 'GUARD', 'RAID'],
    ['prières', CTRL.prayersPerGame, RUSH.prayersPerGame, GUARD.prayersPerGame, RAID.prayersPerGame],
    ['tour 1ʳᵉ prière', CTRL.firstPrayTurn, RUSH.firstPrayTurn, GUARD.firstPrayTurn, RAID.firstPrayTurn],
    ['Ferveur (0 porteur v1)', CTRL.fervorPerGame, RUSH.fervorPerGame, GUARD.fervorPerGame, RAID.fervorPerGame],
    ['kills créa. ennemie', CTRL.enemyKillsPerGame, RUSH.enemyKillsPerGame, GUARD.enemyKillsPerGame, RAID.enemyKillsPerGame],
    ['profanations (à genoux)', CTRL.profanationsPerGame, RUSH.profanationsPerGame, GUARD.profanationsPerGame, RAID.profanationsPerGame],
    ['fidèles perdus', CTRL.kneelersLostPerGame, RUSH.kneelersLostPerGame, GUARD.kneelersLostPerGame, RAID.kneelersLostPerGame],
    ['survie fidèles', CTRL.prayerSurvival, RUSH.prayerSurvival, GUARD.prayerSurvival, RAID.prayerSurvival],
    ['gardiennes jouées', CTRL.protectPlayedPerGame, RUSH.protectPlayedPerGame, GUARD.protectPlayedPerGame, RAID.protectPlayedPerGame],
    ['win% vs CONTROL', CTRL.winRate, RUSH.winRate, GUARD.winRate, RAID.winRate],
  ];
  const w = [26, 9, 9, 9, 9];
  for (const r of rows) {
    let line = '';
    r.forEach((c, i) => {
      const s = typeof c === 'number' ? fmt(c) : String(c);
      line += (i === 0 ? s.padEnd(w[i]) : s.padStart(w[i]));
    });
    console.log(line);
  }

  // ── Assertions de signature (directionnelles, plusieurs axes concordants) ──
  const checks = [];
  // RUSH : prie davantage ET plus tôt, ET délaisse le combat (course à la Foi).
  checks.push({
    profile: 'RUSH',
    pass: RUSH.prayersPerGame > CTRL.prayersPerGame * 1.15 &&
          RUSH.firstPrayTurn != null && CTRL.firstPrayTurn != null &&
          RUSH.firstPrayTurn < CTRL.firstPrayTurn &&
          RUSH.enemyKillsPerGame < CTRL.enemyKillsPerGame * 0.5,
    note: `prières ${fmt(RUSH.prayersPerGame)} vs ${fmt(CTRL.prayersPerGame)} ; 1ʳᵉ prière T${fmt(RUSH.firstPrayTurn)} vs T${fmt(CTRL.firstPrayTurn)} ; kills ${fmt(RUSH.enemyKillsPerGame)} vs ${fmt(CTRL.enemyKillsPerGame)}`,
  });
  // GUARD : perd MOINS de fidèles ET joue PLUS de gardiennes (survie ≥ CONTROL)
  // — assertion branche P2 d'origine, inchangée.
  checks.push({
    profile: 'GUARD',
    pass: GUARD.kneelersLostPerGame < CTRL.kneelersLostPerGame &&
          GUARD.protectPlayedPerGame > CTRL.protectPlayedPerGame * 1.05 &&
          GUARD.prayerSurvival != null && CTRL.prayerSurvival != null &&
          GUARD.prayerSurvival >= CTRL.prayerSurvival - 0.005,
    note: `fidèles perdus ${fmt(GUARD.kneelersLostPerGame)} vs ${fmt(CTRL.kneelersLostPerGame)} ; survie ${fmt(GUARD.prayerSurvival)} vs ${fmt(CTRL.prayerSurvival)} ; gardiennes ${fmt(GUARD.protectPlayedPerGame)} vs ${fmt(CTRL.protectPlayedPerGame)}`,
  });
  // RAID : profane nettement plus (axe Ferveur retiré — 0 porteur en v1).
  checks.push({
    profile: 'RAID',
    pass: RAID.profanationsPerGame > CTRL.profanationsPerGame * 1.1 &&
          RAID.enemyKillsPerGame > CTRL.enemyKillsPerGame * 0.95,
    note: `profan. ${fmt(RAID.profanationsPerGame)} vs ${fmt(CTRL.profanationsPerGame)} ; kills ${fmt(RAID.enemyKillsPerGame)} vs ${fmt(CTRL.enemyKillsPerGame)} (axe Ferveur hors assertion : 0 porteur v1)`,
  });

  console.log('\n── Signatures ──');
  let allPass = true;
  for (const c of checks) {
    console.log(`${c.pass ? '✓' : '✗'} ${c.profile} : ${c.note}`);
    if (!c.pass) allPass = false;
  }
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n${allPass ? '✓ TOUS LES PROFILS MONTRENT LEUR SIGNATURE' : '✗ AU MOINS UN PROFIL NE MONTRE PAS SA SIGNATURE'} — ${dt}s`);
  process.exit(allPass ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
