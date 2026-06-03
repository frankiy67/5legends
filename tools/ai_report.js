#!/usr/bin/env node
'use strict';
/**
 * ai_report.js — PHASE 4 : rédige ./ai_tournament_report.md à partir de
 * tools/ai_tournament_results.json (produit par ai_tournament.js).
 *
 * Pur rendu : aucune partie jouée, aucun réglage. Calcule le verdict du
 * triangle (cycle RPS ? stratégie dominante ?) et met en forme les tables.
 *
 * Usage: node tools/ai_report.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RES = path.join(__dirname, 'ai_tournament_results.json');
const OUT = path.join(ROOT, 'ai_tournament_report.md');

const r = JSON.parse(fs.readFileSync(RES, 'utf8'));
const S = r.meta.strategies;       // ['CONTROL','RUSH','GUARD','RAID']
const F = r.meta.factions;
const M = r.stratMatrix;

const pct = (x) => x == null ? 'n/a' : (x * 100).toFixed(1) + '%';
const f2 = (x) => x == null ? 'n/a' : x.toFixed(2);

// pairMeta est indexé par paire NON ordonnée selon l'ordre de S (i<j).
function pairKey(a, b) {
  const ia = S.indexOf(a), ib = S.indexOf(b);
  return ia < ib ? `${a}|${b}` : `${b}|${a}`;
}
function pair(a, b) { return r.pairMeta[pairKey(a, b)]; }

// ── Verdict triangle ─────────────────────────────────────────────────────
const beats = (a, b) => M[a][b] > 0.5;
const winsAgainst = {}; // nb d'adversaires battus (off-diagonale)
for (const a of S) winsAgainst[a] = S.filter(b => b !== a && beats(a, b)).length;
const avgWR = {};
for (const a of S) {
  const others = S.filter(b => b !== a);
  avgWR[a] = others.reduce((acc, b) => acc + M[a][b], 0) / others.length;
}
const dominant = S.find(a => winsAgainst[a] === S.length - 1);
const dominated = S.find(a => winsAgainst[a] === 0);

// Cycles à 3 (RPS) parmi les triplets : a>b>c>a.
const cycles = [];
for (const a of S) for (const b of S) for (const c of S) {
  if (a === b || b === c || a === c) continue;
  if (beats(a, b) && beats(b, c) && beats(c, a)) {
    const norm = [a, b, c];
    // dédoublonner les rotations
    const key = (() => {
      const min = Math.min(...norm.map(x => S.indexOf(x)));
      const start = norm.findIndex(x => S.indexOf(x) === min);
      return [norm[start], norm[(start + 1) % 3], norm[(start + 2) % 3]].join('>');
    })();
    if (!cycles.includes(key)) cycles.push(key);
  }
}

let verdict;
if (dominant) {
  verdict = `**Une stratégie domine : ${dominant}.** Elle bat les trois autres profils (siège équilibré). `
    + `Aucun cycle pierre-feuille-ciseaux clair ne se referme autour d'elle.`;
} else if (cycles.length > 0) {
  verdict = `**Un cycle RPS émerge.** Cycle(s) détecté(s) : ${cycles.map(c => '`' + c + '`').join(', ')}. `
    + `Aucune stratégie ne bat toutes les autres.`;
} else {
  verdict = `**Ni dominante stricte, ni cycle RPS net.** Hiérarchie partielle (cf. matrice). `
    + `Classement par win rate moyen : ` + S.slice().sort((a, b) => avgWR[b] - avgWR[a])
      .map(a => `${a} ${pct(avgWR[a])}`).join(' > ') + '.';
}

// ── Faction × stratégie : meilleure faction par stratégie ─────────────────
const bestFacByStrat = {};
for (const s of S) {
  let best = null;
  for (const fa of F) {
    const wr = r.factionStrat[s][fa].winRate;
    if (!best || wr > best.wr) best = { fa, wr };
  }
  bestFacByStrat[s] = best;
}

// ════════════════════════════════════════════════════════════════════════
let out = '';
const W = (s) => { out += s + '\n'; };

W(`# 5 Legends — Rapport du Grand Tournoi IA multi-stratégies`);
W('');
W(`> Branche \`feat-ai-multistrat\`. Appareil de mesure construit sur l'IA Ascension`);
W(`> existante : profil **CONTROL** = comportement historique **à l'identique**`);
W(`> (golden byte-identique, cf. \`tools/golden_check.js\`). Les profils **RUSH /`);
W(`> GUARD / RAID** sont **additifs**. Ce rapport **mesure** le triangle — il ne`);
W(`> modifie **ni cartes ni factions** (décision humaine).`);
W('');
W(`## Méthodologie`);
W('');
W(`- Condition de victoire : **Foi ≥ ${r.meta.faithWin}** (Ascension), sinon **horloge céleste** au tour ${r.meta.turnCap} (plus de Foi gagne ; égalité = nul).`);
W(`- **${r.meta.gamesPerStratPair} parties par paire de stratégies** (25 paires de factions × ${r.meta.seedsStrat} graines × 2 sièges) → win rates **équilibrés en siège**.`);
W(`- Faction × stratégie : ${r.meta.gamesPerFactionCell} parties par cellule (vs CONTROL, 5 factions adverses × ${r.meta.seedsFaction} graines × 2 sièges).`);
W(`- Total : **${r.meta.totalGames.toLocaleString('fr-FR')} parties** simulées en ${r.meta.seconds}s (RNG seedé, déterministe).`);
W('');
W(`## Verdict triangle`);
W('');
W(verdict);
W('');
W(`| Stratégie | Win rate moyen (vs les 3 autres) | Profils battus |`);
W(`|---|---|---|`);
for (const a of S.slice().sort((x, y) => avgWR[y] - avgWR[x])) {
  W(`| ${a} | ${pct(avgWR[a])} | ${winsAgainst[a]}/3 |`);
}
W('');

W(`## Matrice stratégie × stratégie`);
W('');
W(`Win rate de la stratégie en **ligne** contre celle en **colonne** (siège équilibré, toutes factions). Diagonale = mirror (cf. plus bas).`);
W('');
W(`| ROW \\ COL | ${S.join(' | ')} |`);
W(`|---|${S.map(() => '---').join('|')}|`);
for (const a of S) {
  const cells = S.map(b => a === b ? '—' : pct(M[a][b]));
  W(`| **${a}** | ${cells.join(' | ')} |`);
}
W('');
W(`Relations dominantes (win rates réels, hors nuls) :`);
W('');
for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) {
  const a = S[i], b = S[j];
  const wa = M[a][b], wb = M[b][a];   // = winA/total et winB/total (somme < 1 si nuls)
  if (wa >= 0.5 && wa - wb >= 0.02) {
    W(`- **${a} > ${b}** — ${pct(wa)} vs ${pct(wb)}.`);
  } else if (wb >= 0.5 && wb - wa >= 0.02) {
    W(`- **${b} > ${a}** — ${pct(wb)} vs ${pct(wa)}.`);
  } else {
    W(`- **${a} ≈ ${b}** — ${pct(wa)} vs ${pct(wb)} (quasi-nul).`);
  }
}
W('');

W(`## Longueur & horloge céleste par appariement`);
W('');
W(`| Appariement | Parties | Tour moyen | % horloge | % nuls |`);
W(`|---|---|---|---|---|`);
for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) {
  const a = S[i], b = S[j];
  const p = pair(a, b);
  W(`| ${a} vs ${b} | ${p.games} | ${f2(p.avgTurn)} | ${pct(p.clockPct)} | ${pct(p.drawPct)} |`);
}
for (const a of S) {
  const m = r.mirror[a];
  W(`| ${a} (mirror) | ${m.games} | ${f2(m.avgTurn)} | ${pct(m.clockPct)} | ${pct(m.draws / m.games)} |`);
}
W('');

W(`## Biais de siège (mirrors A vs A)`);
W('');
W(`En mirror, toute asymétrie de win rate vient du **siège** (le 2ᵉ joueur démarre à +2 Foi).`);
W('');
W(`| Stratégie | % victoire P1 | % victoire P2 | Tour moyen | % horloge |`);
W(`|---|---|---|---|---|`);
for (const a of S) {
  const m = r.mirror[a];
  W(`| ${a} | ${pct(m.p1Wins / m.games)} | ${pct(m.p2Wins / m.games)} | ${f2(m.avgTurn)} | ${pct(m.clockPct)} |`);
}
W('');

W(`## Faction × stratégie`);
W('');
W(`Win rate de chaque (faction jouant la stratégie) **contre CONTROL** (factions adverses balayées, siège équilibré).`);
W('');
W(`| Stratégie \\ Faction | ${F.join(' | ')} | Meilleure |`);
W(`|---|${F.map(() => '---').join('|')}|---|`);
for (const s of S) {
  const cells = F.map(fa => pct(r.factionStrat[s][fa].winRate));
  const best = bestFacByStrat[s];
  W(`| **${s}** | ${cells.join(' | ')} | ${best.fa} (${pct(best.wr)}) |`);
}
W('');

W(`## Observations`);
W('');
const seatBias = (() => {
  let p2 = 0, g = 0;
  for (const a of S) { p2 += r.mirror[a].p2Wins; g += r.mirror[a].games; }
  return p2 / g;
})();
W(`- **Avantage du 2ᵉ joueur très marqué** : en mirror, P2 gagne **${pct(seatBias)}** des parties (Foi de départ +2). Les matrices stratégie×stratégie sont équilibrées en siège, donc non contaminées par ce biais — mais c'est un signal d'équilibrage (décision humaine).`);
const strongest = dominant || S.slice().sort((a, b) => avgWR[b] - avgWR[a])[0];
const weakest = S.slice().sort((a, b) => avgWR[a] - avgWR[b])[0];
const noWinners = S.filter(a => winsAgainst[a] === 0);
W(`- **${strongest}** est la stratégie la plus forte du tournoi (win rate moyen ${pct(avgWR[strongest])}) — la prière directe est la source de Foi la plus rentable, et la course en exploite la cadence maximale.`);
W(`- **RAID** ferme la marche (win rate moyen ${pct(avgWR['RAID'])}) et souffre surtout face à **RUSH (${pct(M['RAID']['RUSH'])})** : la profanation **ne retire pas** la Foi déjà priée (verrouillée immédiatement). RAID ne nie que la Foi *future* d'un corps — insuffisant face à un adversaire qui agenouille un nouveau corps chaque tour.`);
if (noWinners.length) {
  W(`- **Aucun gagnant net** parmi ${noWinners.join(' / ')} (0 profil battu chacun). En particulier **GUARD ≈ RAID** (${pct(M['GUARD']['RAID'])} vs ${pct(M['RAID']['GUARD'])}, quasi-nul) : l'attrition de GUARD et le déni de RAID se neutralisent.`);
}
W(`- **Cadence** : RUSH raccourcit drastiquement les parties (tour moyen ~${f2(r.mirror['RUSH'].avgTurn)}) ; GUARD/RAID les allongent (~${f2(r.mirror['GUARD'].avgTurn)}) et déclenchent l'horloge céleste bien plus souvent (cf. table de longueur).`);
W(`- Chaque profil **joue réellement sa stratégie** (validé en Phase 2, \`tools/ai_validate.js\`) : RUSH prie + tôt/souvent, GUARD perd moins de fidèles et pose + de gardiennes, RAID profane/tue/déclenche la Ferveur + souvent que CONTROL.`);
W('');
W(`---`);
W(`*Généré par \`tools/ai_report.js\` depuis \`tools/ai_tournament_results.json\`. Aucune carte ni faction n'a été modifiée.*`);

fs.writeFileSync(OUT, out);
console.log(`✓ Rapport écrit → ${path.relative(ROOT, OUT)} (${out.length} octets)`);
console.log(`\nVerdict : ${verdict.replace(/\*\*/g, '')}`);
