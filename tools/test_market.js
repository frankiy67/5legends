#!/usr/bin/env node
'use strict';
/**
 * test_market.js — BRIQUE 5, ÉTAPE 5 : validation du marché.
 *
 *  - Marché initialisé à 5 cartes (du pool complet).
 *  - Achat = −2 gems + ajout en main ; carte achetée remplacée ; marché reste à 5.
 *  - Achat bloqué si gems < 2, hors de son tour, ou main pleine.
 *  - Marché partagé (une seule liste pour les deux joueurs).
 */
const { loadGameCustom } = require('./sim_core.js');

const API = loadGameCustom([
  'initGame', 'seedRNG', 'buildCardPool', 'marketRandomCard', 'newCard',
  'canBuyMarket', 'buyFromMarket', 'MARKET_SIZE', 'MARKET_COST', 'HAND_LIMIT',
]);

let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { console.log(`  ✓ ${n} ${x}`); pass++; } else { console.log(`  ✗ ${n} ${x}`); fail++; } };

function game(p = 1) {
  API.seedRNG(1);
  API.initGame('greek', 'norse', 'sim');
  const G = API.getG();
  G.cp = p;
  G.players[p].gems = 5;
  G.players[p].hand = [];
  return G;
}

console.log('[Marché]');
check('pool complet = 171 cartes', API.buildCardPool().length === 171, `(${API.buildCardPool().length})`);
check('constantes : taille 5, coût 2, main 7', API.MARKET_SIZE === 5 && API.MARKET_COST === 2 && API.HAND_LIMIT === 7);

{ const G = game();
  check('marché initialisé à 5 cartes', Array.isArray(G.market) && G.market.length === 5, `(${G.market && G.market.length})`);
  check('cartes valides (nom + type)', G.market.every(c => c && c.n && c.type)); }

{ const G = game(1);
  const bought = G.market[2];
  const gemsBefore = G.players[1].gems, handBefore = G.players[1].hand.length;
  const ok = API.buyFromMarket(1, 2);
  check('achat réussi', ok === true);
  check('  −2 gems', G.players[1].gems === gemsBefore - 2, `(${gemsBefore}→${G.players[1].gems})`);
  check('  carte ajoutée en main', G.players[1].hand.length === handBefore + 1 && G.players[1].hand.includes(bought));
  check('  marché toujours à 5', G.market.length === 5);
  check('  emplacement remplacé (nouvelle carte)', G.market[2] !== bought && !!G.market[2]); }

console.log('\n[Blocages]');
{ const G = game(1); G.players[1].gems = 1;
  check('gems < 2 → canBuyMarket faux', API.canBuyMarket(1) === false);
  const h = G.players[1].hand.length; const ok = API.buyFromMarket(1, 0);
  check('  achat refusé', ok === false && G.players[1].hand.length === h); }

{ const G = game(1); G.cp = 2;   // pas le tour de P1
  check('hors de son tour → bloqué', API.canBuyMarket(1) === false); }

{ const G = game(1);
  G.players[1].hand = Array.from({ length: 7 }, () => API.newCard({ id: 'X', n: 'X', atk: 1, def: 1, cost: 1, type: 'monster', cap: '', txt: '', rarity: 'common', faction: 'greek' }));
  check('main pleine (7) → bloqué', API.canBuyMarket(1) === false);
  const ok = API.buyFromMarket(1, 0);
  check('  achat refusé', ok === false && G.players[1].hand.length === 7); }

console.log('\n[Partagé]');
{ const G = game(1);
  const bought = G.market[0];
  API.buyFromMarket(1, 0);
  check('même liste pour les deux joueurs (G.market unique)', !G.market.includes(bought));
  // P2 voit le même marché rafraîchi
  G.cp = 2; G.players[2].gems = 5; G.players[2].hand = [];
  const c2 = G.market[0]; const ok = API.buyFromMarket(2, 0);
  check('P2 achète sur le même marché', ok === true && G.players[2].hand.includes(c2)); }

console.log(`\n${fail === 0 ? '✓ TOUS LES TESTS PASSENT' : '✗ ÉCHECS'} — ${pass} ok / ${fail} ko`);
process.exit(fail === 0 ? 0 : 1);
