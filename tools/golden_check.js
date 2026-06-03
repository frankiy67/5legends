#!/usr/bin/env node
/**
 * golden_check.js — compare deux snapshots golden-master.
 *
 * Compare UNIQUEMENT le tableau `games` (ignore meta.generatedSeconds qui
 * dépend du temps d'exécution). Sortie 0 si IDENTIQUE, 1 si DIFFÉRENT.
 *
 * Usage: node tools/golden_check.js <reference.json> <candidate.json>
 */
'use strict';
const fs = require('fs');

const [refPath, candPath] = process.argv.slice(2);
if (!refPath || !candPath) {
  console.error('Usage: node tools/golden_check.js <reference.json> <candidate.json>');
  process.exit(2);
}

const ref = JSON.parse(fs.readFileSync(refPath, 'utf8'));
const cand = JSON.parse(fs.readFileSync(candPath, 'utf8'));

const rg = ref.games, cg = cand.games;
let diffs = [];

if (rg.length !== cg.length) {
  console.log(`✗ Nombre de parties différent: ref=${rg.length} cand=${cg.length}`);
  process.exit(1);
}

for (let i = 0; i < rg.length; i++) {
  const a = JSON.stringify(rg[i]);
  const b = JSON.stringify(cg[i]);
  if (a !== b) {
    // Trouver le premier champ qui diffère pour un message utile
    const ra = rg[i], ca = cg[i];
    const fields = ['winner', 'error', 'turn', 'hp', 'actionCount'];
    let detail = '';
    for (const f of fields) {
      if (JSON.stringify(ra[f]) !== JSON.stringify(ca[f])) {
        detail += ` ${f}: ${JSON.stringify(ra[f])} → ${JSON.stringify(ca[f])};`;
      }
    }
    if (!detail) detail = ' (board/log/players diffèrent)';
    diffs.push({ seed: rg[i].seed, matchup: `${rg[i].f1} vs ${rg[i].f2}`, detail });
  }
}

if (diffs.length === 0) {
  console.log(`✓ IDENTIQUE — ${rg.length} parties strictement identiques.`);
  process.exit(0);
} else {
  console.log(`✗ DIFFÉRENT — ${diffs.length}/${rg.length} parties divergent:`);
  for (const d of diffs.slice(0, 25)) {
    console.log(`  seed ${d.seed} (${d.matchup}):${d.detail}`);
  }
  if (diffs.length > 25) console.log(`  … et ${diffs.length - 25} autres.`);
  process.exit(1);
}
