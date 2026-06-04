#!/usr/bin/env node
'use strict';
/**
 * audit.js — BRIQUE 6 PHASE B : diagnostic exhaustif (sans corriger).
 * Produit un état des lieux : intégrité des cartes, couverture des illustrations,
 * couverture des capacités (caps), références aux mécaniques PV retirées, et
 * stress IA (4 profils × factions) avec invariants. Sert à rédiger BUGS.md.
 */
const fs = require('fs');
const path = require('path');
const { loadGame, loadGameCustom } = require('./sim_core.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'game.js'), 'utf8');
const DATA = loadGameCustom(['MONSTERS', 'GODS', 'getCardImage', 'GOD_POWERS']);
const API = loadGame();   // boot standard : resetAI/setAIProfile/getG/initGame/aiTurn…
const F = API.FACTIONS;

function section(t){ console.log('\n========== ' + t + ' =========='); }

// ── 1) Intégrité des cartes + illustrations ──────────────────────────────
section('1. CARTES — intégrité & illustrations');
const allCards = [];
for (const f of F) {
  for (const m of (DATA.MONSTERS[f]||[])) allCards.push({ ...m, type:'monster', faction:f });
  for (const g of (DATA.GODS[f]||[]))     allCards.push({ ...g, type:g.type||'god', faction:f });
}
console.log('Total cartes:', allCards.length);
const defIssues = [], noImg = [];
for (const c of allCards) {
  const probs = [];
  if (!c.id) probs.push('id manquant');
  if (!c.n) probs.push('nom manquant');
  if (c.cost == null) probs.push('coût manquant');
  if (c.type === 'monster') {
    if (c.atk == null) probs.push('atk manquant');
    if (c.def == null) probs.push('def manquant');
  }
  if (!('cap' in c)) probs.push('cap absent');
  if (probs.length) defIssues.push(`${c.faction}/${c.id||'?'}: ${probs.join(', ')}`);
  if (!DATA.getCardImage(c.id||'')) noImg.push(`${c.faction}/${c.id} (${c.n})`);
}
console.log('Cartes mal définies:', defIssues.length);
defIssues.slice(0,40).forEach(x=>console.log('  ✗', x));
console.log('Cartes SANS illustration:', noImg.length, '/', allCards.length);
noImg.slice(0,60).forEach(x=>console.log('  ·', x));

// ── 2) Couverture des capacités (caps) ───────────────────────────────────
section('2. CAPS — capacités non gérées (effet potentiellement absent)');
// Région "données" (def. cartes) vs "code" (handlers).
const codeStart = SRC.indexOf('const SUPREME_GODS');
const codeRegion = SRC.slice(codeStart);
// Jetons gérés : args de .includes('x'), clés GOD_EFFECTS["x"], cap==='x', startsWith('x'), registerCombat/Effect conds.
const handled = new Set();
for (const m of codeRegion.matchAll(/\.includes\(\s*['"]([a-z0-9_]+)['"]\s*\)/gi)) handled.add(m[1]);
for (const m of codeRegion.matchAll(/GOD_EFFECTS\[\s*["']([a-z0-9_]+)["']\s*\]/gi)) handled.add(m[1]);
for (const m of codeRegion.matchAll(/cap\s*===?\s*['"]([a-z0-9_]+)['"]/gi)) handled.add(m[1]);
for (const m of codeRegion.matchAll(/startsWith\(\s*['"]([a-z0-9_]+)['"]\s*\)/gi)) handled.add(m[1]);
function capHandled(cap) {
  if (!cap) return true;                       // pas de cap = vanille, OK
  if (handled.has(cap)) return true;           // géré tel quel (GOD_EFFECTS clé / cap===)
  for (const tok of cap.split('_')) if (handled.has(tok)) return true;  // sous-jeton .includes
  // certains handlers .includes(prefixe) — teste les préfixes progressifs
  for (const h of handled) if (cap.includes(h) && h.length >= 4) return true;
  return false;
}
const unhandled = [];
const seenCaps = new Set();
for (const c of allCards) {
  const cap = c.cap || '';
  if (!cap || seenCaps.has(cap)) continue;
  seenCaps.add(cap);
  if (!capHandled(cap)) unhandled.push(`${cap}  (ex: ${c.faction}/${c.id})`);
}
console.log('Caps distinctes:', seenCaps.size, '| non gérées (suspectes):', unhandled.length);
unhandled.forEach(x=>console.log('  ?', x));

// ── 3) Références aux mécaniques PV retirées (dans le code) ───────────────
section('3. PV — effets de cartes référençant encore les PV joueur (vestigial)');
const pvRefs = [];
const lines = SRC.split('\n');
lines.forEach((l, i) => {
  if (/players\[[^\]]+\]\.hp\s*[-+]?=|\.hp\s*-=|\.hp\s*\+=|hp\s*=\s*Math\.min\(\s*\d+/.test(l) && !/faith/.test(l)) {
    pvRefs.push(`L${i+1}: ${l.trim().slice(0,110)}`);
  }
});
console.log('Écritures sur player.hp restantes (vestigial — effet sans impact):', pvRefs.length);
pvRefs.forEach(x=>console.log('  ·', x));

// ── 4) Stress IA : 4 profils × factions, invariants ──────────────────────
section('4. IA — stress 4 profils × factions (crash + invariants)');
const MAX_TURNS = 50;
async function runOne(seed, f1, f2, p1, p2) {
  API.resetAI(); API.seedRNG(seed); API.initGame(f1, f2, 'sim');
  API.setAIProfile(1, p1); API.setAIProfile(2, p2);
  const G = API.getG();
  let err = null, guard = 0;
  try {
    while (!API.checkVictoryBool() && G.turn <= MAX_TURNS && guard < 4000) { guard++; await API.aiTurn(G.cp); if (API.checkVictoryBool()) break; }
  } catch (e) { err = (e && e.stack ? e.stack : String(e)).split('\n').slice(0,2).join(' | '); }
  // invariants post-partie (le cap de 6 concerne les MONSTRES non-face-cachés ;
  // les dieux face cachés / pièges occupent un slot mais ne sont pas des monstres)
  const inv = [];
  for (let p = 1; p <= 2; p++) {
    const P = G.players[p];
    const mons = P.field.filter(m => m && !m.faceDown && m.type === 'monster').length;
    if (mons > 6) inv.push(`monstres>6 (${mons})`);
    if (P.gems < 0) inv.push(`gems<0 (${P.gems})`);
    if (P.hand.length > 7) inv.push(`main>7 (${P.hand.length})`);
    P.field.forEach(m => {
      if (!m) return;
      if (Number.isNaN(m.cAtk) || Number.isNaN(m.cDef)) inv.push(`NaN stat ${m.n}`);
      if (m.cDef < 0 && !m.faceDown) inv.push(`cDef<0 vivant ${m.n} (${m.cDef})`);
    });
    if (Number.isNaN(P.faith)) inv.push('faith NaN');
    if (P.faith < 0) inv.push(`faith<0 (${P.faith})`);
    // doublon d'objet (même référence deux fois sur le terrain)
    const seen = new Set();
    P.field.forEach(m => { if (m) { if (seen.has(m)) inv.push(`doublon objet ${m.n}`); seen.add(m); } });
    if (G.market && G.market.length !== 5) inv.push(`marché!=5 (${G.market.length})`);
  }
  const nonTerm = (guard >= 4000) || ((G.turn > MAX_TURNS) && !API.checkVictoryBool());
  return { err, inv, nonTerm, turn: G.turn };
}
const profiles = ['CONTROL','RUSH','GUARD','RAID'];
let crashes = 0, invViol = 0, nonTermCount = 0, total = 0;
const crashSamples = [], invSamples = [];
(async () => {
  for (const p1 of profiles) for (const p2 of profiles) {
    for (const f1 of F) for (const f2 of F) for (let s = 1; s <= 3; s++) {
      const r = await runOne(s, f1, f2, p1, p2); total++;
      if (r.err) { crashes++; if (crashSamples.length<10) crashSamples.push(`[${p1}v${p2} ${f1}v${f2} s${s}] ${r.err}`); }
      if (r.inv.length) { invViol++; if (invSamples.length<10) invSamples.push(`[${p1}v${p2} ${f1}v${f2} s${s}] ${r.inv.join(', ')}`); }
      if (r.nonTerm) nonTermCount++;
    }
  }
  console.log(`Parties: ${total} | crashes: ${crashes} | snapshots avec violation: ${invViol} | non-terminaisons: ${nonTermCount}`);
  console.log('Répartition des types de violation:');
  const types = {};
  // re-tally en relançant léger ? non : on a déjà les échantillons ; comptons par mot-clé
  // (les compteurs détaillés sont approximés via les échantillons + un 2e passage ciblé)
  crashSamples.forEach(x=>console.log('  CRASH', x));
  invSamples.forEach(x=>console.log('  INVAR(échantillon)', x));
  console.log('\n✓ audit terminé');
})();
