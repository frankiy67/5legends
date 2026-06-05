#!/usr/bin/env node
'use strict';
/**
 * arena_sim.js — BRIQUE 7 Phase 3. Harnais de simulation du MODE ARENA.
 *
 * Un « joueur » IA drafte un deck de 40 cartes (heuristique partagée avec le jeu :
 * arenaAIDraft), puis enchaîne des matchs (deck custom) contre des IA faction
 * standard, avec difficulté croissante selon le nombre de victoires, jusqu'à
 * 12 victoires (CHAMPION) ou 3 défaites (ÉLIMINÉ).
 *
 * Retourne par run : résultat (champion/éliminé), nombre de matchs, score final.
 * Usage : node tools/arena_sim.js [N_RUNS] [baseSeed]
 */
const { loadGameCustom } = require('./sim_core');

const API = loadGameCustom([
  'initGame', 'aiTurn', 'seedRNG', 'checkVictoryBool', 'setAIProfile',
  'FACTIONS', 'GOD_POWERS', 'randomGodAssign', 'factionGods',
  'FAITH_WIN', 'TURN_CAP', 'rng',
  'buildCardPool', 'arenaAIDraft', 'arenaOppProfile', 'arenaCardValue',
  'ARENA_WINS_GOAL', 'ARENA_LOSSES_MAX', 'setArenaStart',
]);

// Compensation de départ Arena (cf. setArenaStart). Sweepable via env :
// ARENA_PH (main joueur), ARENA_OH (main adv), ARENA_PF (Foi joueur), ARENA_OF (Foi adv).
const _envN = (k, d) => (process.env[k] != null ? parseInt(process.env[k], 10) : d);
const ARENA_PH = _envN('ARENA_PH', null), ARENA_OH = _envN('ARENA_OH', null);
const ARENA_PF = _envN('ARENA_PF', null), ARENA_OF = _envN('ARENA_OF', null);
if (API.setArenaStart && (ARENA_PH != null || ARENA_OH != null || ARENA_PF != null || ARENA_OF != null)) {
  API.setArenaStart(ARENA_PH, ARENA_OH, ARENA_PF, ARENA_OF);
}

const WINS_GOAL = API.ARENA_WINS_GOAL || 12;
const LOSSES_MAX = API.ARENA_LOSSES_MAX || 3;
const MATCH_TURN_GUARD = 60;       // garde-fou de boucle interne d'un match
const RUN_MATCH_GUARD = 60;        // garde-fou de boucle d'une run (draws éventuels)
const MAX_TURNS = 50;

// Joue UN match : p1 = deck custom (profil CONTROL), p2 = IA faction `oppFaction`
// (profil `oppProfile`). Renvoie 'win' | 'loss' | 'draw' du point de vue de p1.
// god fixe du joueur réinjecté après initGame (conservé toute la run).
async function playMatch(seed, playerFaction, customDeck, runGod, oppFaction, oppProfile) {
  API.seedRNG(seed);
  API.initGame(playerFaction, oppFaction, 'sim', { customDeck });
  const G = API.getG();
  // god du joueur fixé pour toute la run
  G.players[1].god = runGod.godId; G.players[1].godName = runGod.godName; G.players[1].godPower = runGod.godPower;
  API.setAIProfile(1, 'CONTROL');
  API.setAIProfile(2, oppProfile);

  let guard = 0;
  while (!API.checkVictoryBool() && G.turn <= MAX_TURNS && guard < 4000) {
    guard++;
    await API.aiTurn(G.cp);
    if (API.checkVictoryBool()) break;
  }
  const f1 = G.players[1].faith || 0, f2 = G.players[2].faith || 0;
  if (f1 >= API.FAITH_WIN && f2 >= API.FAITH_WIN) return 'draw';
  if (f1 >= API.FAITH_WIN) return 'win';
  if (f2 >= API.FAITH_WIN) return 'loss';
  if (G.turn > API.TURN_CAP) { if (f1 > f2) return 'win'; if (f2 > f1) return 'loss'; return 'draw'; }
  return 'draw'; // non-conclu (ne devrait pas arriver)
}

// Joue UNE run Arena complète. Retourne { result, matches, wins, losses, error }.
async function playRun(baseSeed) {
  // Choix du panthéon + dieu du joueur (fixés toute la run).
  API.seedRNG(baseSeed);
  const playerFaction = API.FACTIONS[Math.floor(API.rng() * API.FACTIONS.length)];
  const runGod = API.randomGodAssign(playerFaction);
  const customDeck = API.arenaAIDraft(playerFaction);

  let wins = 0, losses = 0, matches = 0, error = null;
  try {
    if (customDeck.length !== 40) throw new Error('draft != 40 (' + customDeck.length + ')');
    while (wins < WINS_GOAL && losses < LOSSES_MAX && matches < RUN_MATCH_GUARD) {
      const oppFaction = API.FACTIONS[Math.floor(API.rng() * API.FACTIONS.length)];
      const oppProfile = API.arenaOppProfile(wins);
      const res = await playMatch(baseSeed * 131 + matches * 7 + 1, playerFaction, customDeck, runGod, oppFaction, oppProfile);
      matches++;
      if (res === 'win') wins++;
      else if (res === 'loss') losses++;
      // 'draw' : ne compte pas (rare) ; le garde-fou RUN_MATCH_GUARD borne la run.
    }
  } catch (e) {
    error = (e && e.stack ? e.stack : String(e)).split('\n').slice(0, 3).join(' | ');
  }
  const result = wins >= WINS_GOAL ? 'champion' : (losses >= LOSSES_MAX ? 'eliminated' : 'incomplete');
  return { result, matches, wins, losses, playerFaction, error };
}

async function main() {
  const N = parseInt(process.argv[2] || '50', 10);
  const baseSeed = parseInt(process.argv[3] || '1', 10);
  let champions = 0, eliminated = 0, incomplete = 0, crashes = 0;
  let totalMatches = 0;
  const errs = [];
  const factionTally = {};
  for (let i = 0; i < N; i++) {
    const r = await playRun(baseSeed + i * 1000);
    if (r.error) { crashes++; if (errs.length < 10) errs.push(`run ${i} (${r.playerFaction}): ${r.error}`); continue; }
    totalMatches += r.matches;
    if (r.result === 'champion') champions++;
    else if (r.result === 'eliminated') eliminated++;
    else { incomplete++; errs.push(`run ${i}: INCOMPLET ${r.wins}W/${r.losses}L en ${r.matches} matchs`); }
    factionTally[r.playerFaction] = factionTally[r.playerFaction] || { runs: 0, champ: 0 };
    factionTally[r.playerFaction].runs++;
    if (r.result === 'champion') factionTally[r.playerFaction].champ++;
  }
  const terminated = N - crashes - incomplete;
  console.log(`\n══ ARENA SIM — ${N} runs (seed base ${baseSeed}) ══`);
  console.log(`  crashs           : ${crashes}`);
  console.log(`  non-terminées    : ${incomplete}`);
  console.log(`  CHAMPION (12V)   : ${champions}  (${(100 * champions / N).toFixed(1)}%)`);
  console.log(`  ÉLIMINÉ (3D)     : ${eliminated}  (${(100 * eliminated / N).toFixed(1)}%)`);
  console.log(`  matchs/run moyen : ${terminated ? (totalMatches / terminated).toFixed(1) : 'n/a'}`);
  console.log(`  taux champion    : ${terminated ? (100 * champions / terminated).toFixed(1) : 'n/a'}%`);
  console.log(`  par faction      :`);
  for (const f of API.FACTIONS) {
    const t = factionTally[f]; if (!t) continue;
    console.log(`     ${f.padEnd(9)} runs:${t.runs} champ:${t.champ} (${(100 * t.champ / t.runs).toFixed(0)}%)`);
  }
  if (errs.length) { console.log('  Problèmes:'); errs.slice(0, 10).forEach(e => console.log('   - ' + e)); }
  process.exit(crashes > 0 || incomplete > 0 ? 1 : 0);
}

main();
