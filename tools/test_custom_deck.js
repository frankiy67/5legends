#!/usr/bin/env node
'use strict';
/**
 * test_custom_deck.js — BRIQUE 7 Phase 2.
 * Vérifie que initGame accepte un customDeck multi-faction de 40 cartes et qu'un
 * match se joue sans crash. L'IA garde son deck faction standard.
 * Usage : node tools/test_custom_deck.js [N]
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const { loadGameCustom } = require('./sim_core');

// Expose les internes nécessaires au test.
const API = loadGameCustom([
  'initGame', 'aiTurn', 'seedRNG', 'checkVictoryBool', 'buildCardPool',
  'newCard', 'FACTIONS', 'FAITH_WIN', 'TURN_CAP', 'rng', 'shuffle',
]);

const N = parseInt(process.argv[2] || '50', 10);

// Tire un deck custom de 40 cartes aléatoires dans le pool complet (toutes
// factions, dieux inclus). Doublons autorisés (comme le draft réel).
function randomCustomDeck(pool) {
  const deck = [];
  for (let i = 0; i < 40; i++) deck.push({ ...pool[Math.floor(API.rng() * pool.length)] });
  return deck;
}

(async () => {
  const pool = API.buildCardPool();
  let crashes = 0, p1wins = 0, p2wins = 0, nulls = 0;
  const factionsSeen = new Set();
  const errs = [];
  for (let i = 0; i < N; i++) {
    API.seedRNG(4242 + i);
    const f2 = API.FACTIONS[Math.floor(API.rng() * API.FACTIONS.length)];
    const f1 = API.FACTIONS[Math.floor(API.rng() * API.FACTIONS.length)]; // identité visuelle p1
    const customDeck = randomCustomDeck(pool);
    customDeck.forEach(c => factionsSeen.add(c.faction));
    if (customDeck.length !== 40) { errs.push(`deck size ${customDeck.length}`); crashes++; continue; }
    const G = API.getG ? null : null;
    let error = null;
    try {
      API.initGame(f1, f2, 'sim', { customDeck });
      // joue jusqu'à fin
      let guard = 0;
      const Gnow = API.getG();
      while (!API.checkVictoryBool() && Gnow.turn <= 50 && guard < 4000) {
        guard++;
        await API.aiTurn(Gnow.cp);
        if (API.checkVictoryBool()) break;
      }
      // sanity : p1 a bien démarré avec un deck non vide multi-faction
      const totalP1 = Gnow.players[1].deck.length + Gnow.players[1].hand.length +
        Gnow.players[1].field.length + Gnow.players[1].graveyard.length;
      if (totalP1 < 40 - 10) errs.push(`seed ${4242 + i}: p1 cartes totales suspectes ${totalP1}`);
      const fa1 = Gnow.players[1].faith || 0, fa2 = Gnow.players[2].faith || 0;
      if (fa1 >= API.FAITH_WIN && fa2 >= API.FAITH_WIN) nulls++;
      else if (fa1 >= API.FAITH_WIN) p1wins++;
      else if (fa2 >= API.FAITH_WIN) p2wins++;
      else if (Gnow.turn > API.TURN_CAP) { if (fa1 > fa2) p1wins++; else if (fa2 > fa1) p2wins++; else nulls++; }
      else { errs.push(`seed ${4242 + i}: NON-TERMINÉ turn=${Gnow.turn}`); crashes++; }
    } catch (e) {
      error = (e && e.stack ? e.stack : String(e)).split('\n').slice(0, 3).join(' | ');
      errs.push(`seed ${4242 + i} (${f1} deck vs ${f2}): ${error}`);
      crashes++;
    }
  }
  console.log(`\n[test_custom_deck] ${N} matchs deck custom (40 multi-faction) vs IA faction`);
  console.log(`  factions présentes dans les decks : ${[...factionsSeen].sort().join(', ')}`);
  console.log(`  crashs/non-term: ${crashes} | P1(custom):${p1wins} P2(IA):${p2wins} nuls:${nulls}`);
  if (errs.length) { console.log('  Problèmes:'); errs.slice(0, 10).forEach(e => console.log('   - ' + e)); }
  process.exit(crashes > 0 ? 1 : 0);
})();
