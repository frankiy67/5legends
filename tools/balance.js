#!/usr/bin/env node
'use strict';
/**
 * balance.js — mesure d'équilibrage (Brique 6B Phase 2).
 * CONTROL vs CONTROL, 25 paires de factions × N graines, SIÈGES ÉQUILIBRÉS.
 * Sort : win rate par faction (cible 45-55%), taux de jeu de chaque carte,
 * corrélation jeu↔victoire (cartes fortes / mortes).
 *
 * Usage : node tools/balance.js [graines=80]
 */
const { loadGame, loadGameCustom } = require('./sim_core.js');
const API = loadGame();
const DATA = loadGameCustom(['MONSTERS', 'GODS']);
const F = API.FACTIONS;
const SEEDS = parseInt(process.argv[2] || '80', 10);

// catalogue nom → {id, faction, type, cost, atk, def, cap}
const byName = {};
for (const f of F) {
  for (const m of (DATA.MONSTERS[f] || [])) byName[m.n] = { ...m, faction: f, type: 'monster' };
  for (const g of (DATA.GODS[f] || []))     byName[g.n] = { ...g, faction: f, type: g.type || 'god' };
}

const facGames = {}, facWins = {};
F.forEach(f => { facGames[f] = 0; facWins[f] = 0; });
// par carte : parties où jouée, parties où jouée par le vainqueur
const card = {};
function bumpCard(n, won) { (card[n] || (card[n] = { played: 0, wonWith: 0 })); card[n].played++; if (won) card[n].wonWith++; }

function reFac(seed, f1, f2) {
  API.resetAI(); API.seedRNG(seed); API.initGame(f1, f2, 'sim');
  API.setAIProfile(1, 'CONTROL'); API.setAIProfile(2, 'CONTROL');
  const G = API.getG(); let guard = 0;
  try { while (!API.checkVictoryBool() && G.turn <= 50 && guard < 4000) { guard++; API.aiTurn(G.cp); if (API.checkVictoryBool()) break; } } catch (e) {}
  return G;
}

(async () => {
  // version async correcte (aiTurn est async)
  async function run(seed, f1, f2) {
    API.resetAI(); API.seedRNG(seed); API.initGame(f1, f2, 'sim');
    API.setAIProfile(1, 'CONTROL'); API.setAIProfile(2, 'CONTROL');
    const G = API.getG(); let guard = 0;
    try { while (!API.checkVictoryBool() && G.turn <= 50 && guard < 4000) { guard++; await API.aiTurn(G.cp); if (API.checkVictoryBool()) break; } } catch (e) {}
    const f1f = G.players[1].faith || 0, f2f = G.players[2].faith || 0;
    let w = null;
    if (f1f >= 16 && f2f >= 16) w = 0; else if (f1f >= 16) w = 1; else if (f2f >= 16) w = 2;
    else if (G.turn > 18) w = f1f > f2f ? 1 : (f2f > f1f ? 2 : 0);
    return { G, w };
  }

  let games = 0;
  for (const fa of F) for (const fb of F) for (let s = 1; s <= SEEDS; s++) {
    const { G, w } = await run(s, fa, fb);
    games++;
    facGames[fa]++; facGames[fb]++;
    if (w === 1) facWins[fa]++; else if (w === 2) facWins[fb]++;
    // parse log : "Player N summons X (" et "Player N plays God: X!"
    const plays = { 1: new Set(), 2: new Set() };
    for (const e of G.log) {
      let mm = e.msg.match(/Player (\d) summons (.+?) \(/);
      if (mm) { plays[+mm[1]].add(mm[2]); continue; }
      mm = e.msg.match(/Player (\d) plays God: (.+?)!/);
      if (mm) plays[+mm[1]].add(mm[2]);
    }
    for (const p of [1, 2]) for (const n of plays[p]) bumpCard(n, w === p);
  }

  console.log(`Mesure : ${games} parties (${SEEDS} graines × 25 paires), sièges équilibrés.\n`);
  console.log('── WIN RATE PAR FACTION (cible 45-55%) ──');
  F.slice().sort((a, b) => (facWins[b] / facGames[b]) - (facWins[a] / facGames[a])).forEach(f => {
    const wr = facWins[f] / facGames[f];
    const flag = wr < 0.45 ? ' ⬇ FAIBLE' : wr > 0.55 ? ' ⬆ FORTE' : '';
    console.log(`  ${f.padEnd(9)} ${(wr * 100).toFixed(1)}%  (${facWins[f]}/${facGames[f]})${flag}`);
  });

  // taux de jeu : parmi les cartes connues, fraction de parties (où sa faction joue) où elle est posée
  console.log('\n── CARTES JAMAIS / RAREMENT JOUÉES (taux de pose) ──');
  const rows = [];
  for (const n in byName) {
    const c = byName[n];
    const avail = facGames[c.faction];                 // parties où sa faction est présente
    const pl = (card[n] && card[n].played) || 0;
    rows.push({ n, fac: c.faction, type: c.type, cost: c.cost, rate: avail ? pl / avail : 0, played: pl, won: (card[n] && card[n].wonWith) || 0 });
  }
  rows.sort((a, b) => a.rate - b.rate);
  rows.filter(r => r.rate < 0.08).forEach(r => console.log(`  ${(r.rate * 100).toFixed(1).padStart(4)}%  ${r.fac.padEnd(9)} ${r.type.padEnd(7)} c${r.cost}  ${r.n}`));

  console.log('\n── CARTES DOMINANTES (jouées ≥30% ET win-avec ≥58%) ──');
  rows.filter(r => r.rate >= 0.30 && r.played >= 50 && (r.won / r.played) >= 0.58)
    .sort((a, b) => (b.won / b.played) - (a.won / a.played))
    .forEach(r => console.log(`  win-avec ${((r.won / r.played) * 100).toFixed(1)}%  pose ${(r.rate * 100).toFixed(0)}%  ${r.fac.padEnd(9)} ${r.n}`));
})();
