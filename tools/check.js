#!/usr/bin/env node
'use strict';
/**
 * check.js — harnais de vérification consolidé (Brique 6C).
 * En un seul passage : CRASHS, win rate par faction (cible 45-55%),
 * cartes jamais/rarement jouées (taux de pose). CONTROL vs CONTROL,
 * 25 paires de factions × N graines, sièges équilibrés.
 *
 * Contrairement à balance.js, check.js REMONTE les crashs (playGame capte
 * l'erreur) → sert de garde-fou « 500 parties 0 crash » après chaque passe.
 *
 * Usage : node tools/check.js [graines=20]   (20 → 500 parties)
 */
const { loadGame, loadGameCustom, playGame } = require('./sim_core.js');
const API = loadGame();
const DATA = loadGameCustom(['MONSTERS', 'GODS']);
const F = API.FACTIONS;
const SEEDS = parseInt(process.argv[2] || '20', 10);

const byName = {};
for (const f of F) {
  for (const m of (DATA.MONSTERS[f] || [])) byName[m.n] = { ...m, faction: f, type: 'monster' };
  for (const g of (DATA.GODS[f] || []))     byName[g.n] = { ...g, faction: f, type: g.type || 'god' };
}

const facGames = {}, facWins = {};
F.forEach(f => { facGames[f] = 0; facWins[f] = 0; });
const card = {};
function bumpCard(n, won) { (card[n] || (card[n] = { played: 0, wonWith: 0 })); card[n].played++; if (won) card[n].wonWith++; }

(async () => {
  let games = 0, crashes = 0;
  const crashSamples = [];
  for (const fa of F) for (const fb of F) for (let s = 1; s <= SEEDS; s++) {
    const r = await playGame(API, s, fa, fb, { 1: 'CONTROL', 2: 'CONTROL' });
    games++;
    if (r.error) { crashes++; if (crashSamples.length < 8) crashSamples.push(`${fa}v${fb} s${s}: ${r.error}`); }
    facGames[fa]++; facGames[fb]++;
    if (r.winner === 1) facWins[fa]++; else if (r.winner === 2) facWins[fb]++;
    const G = API.getG();
    const plays = { 1: new Set(), 2: new Set() };
    for (const e of G.log) {
      let mm = e.msg.match(/Player (\d) summons (.+?) \(/);
      if (mm) { plays[+mm[1]].add(mm[2]); continue; }
      mm = e.msg.match(/Player (\d) plays God: (.+?)!/);
      if (mm) plays[+mm[1]].add(mm[2]);
    }
    for (const p of [1, 2]) for (const n of plays[p]) bumpCard(n, r.winner === p);
  }

  console.log(`\n=== CHECK : ${games} parties (${SEEDS} graines × 25 paires), sièges équilibrés ===`);
  console.log(crashes === 0 ? `✓ CRASHS : 0` : `✗ CRASHS : ${crashes}\n   ${crashSamples.join('\n   ')}`);

  console.log('\n── WIN RATE PAR FACTION (cible 45-55%) ──');
  const wrs = [];
  F.slice().sort((a, b) => (facWins[b] / facGames[b]) - (facWins[a] / facGames[a])).forEach(f => {
    const wr = facWins[f] / facGames[f]; wrs.push(wr * 100);
    const flag = wr < 0.45 ? ' ⬇ FAIBLE' : wr > 0.55 ? ' ⬆ FORTE' : '';
    console.log(`  ${f.padEnd(9)} ${(wr * 100).toFixed(1)}%  (${facWins[f]}/${facGames[f]})${flag}`);
  });
  console.log(`  spread = ${(Math.max(...wrs) - Math.min(...wrs)).toFixed(1)} pts`);

  console.log('\n── CARTES JAMAIS / RAREMENT JOUÉES (< 8% pose) ──');
  const rows = [];
  for (const n in byName) {
    const c = byName[n];
    const avail = facGames[c.faction];
    const pl = (card[n] && card[n].played) || 0;
    rows.push({ n, fac: c.faction, type: c.type, cost: c.cost, rate: avail ? pl / avail : 0, played: pl, won: (card[n] && card[n].wonWith) || 0 });
  }
  rows.sort((a, b) => a.rate - b.rate);
  rows.filter(r => r.rate < 0.08).forEach(r => console.log(`  ${(r.rate * 100).toFixed(1).padStart(4)}%  ${r.fac.padEnd(9)} ${r.type.padEnd(7)} c${r.cost}  ${r.n}`));

  console.log('\n── CARTES DOMINANTES (pose ≥30% ET win-avec ≥58%) ──');
  rows.filter(r => r.rate >= 0.30 && r.played >= 50 && (r.won / r.played) >= 0.58)
    .sort((a, b) => (b.won / b.played) - (a.won / a.played))
    .forEach(r => console.log(`  win ${((r.won / r.played) * 100).toFixed(1)}%  pose ${(r.rate * 100).toFixed(0)}%  ${r.fac.padEnd(9)} ${r.n}`));

  process.exit(crashes === 0 ? 0 : 1);
})();
