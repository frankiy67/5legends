#!/usr/bin/env node
'use strict';
/**
 * ai_report_desecrate.js — ÉTAPE 5 : rapport de l'expérience
 * DESECRATE_FAITH=1 + FAITH_WIN=16, AVEC comparaison directe au baseline.
 *
 * Lit  tools/ai_tournament_results_DESECRATE.json  (expérience)
 *  et  tools/ai_tournament_results_baseline.json   (baseline : FAITH_WIN=14,
 *      sans desecrate — RUSH 61.5 / CONTROL 52.3 / GUARD 45.4 / RAID 39.8).
 * Écrit ./ai_tournament_report_DESECRATE.md (l'original ai_tournament_report.md
 * est conservé). Pur rendu : aucune partie jouée, aucun réglage.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EXP = JSON.parse(fs.readFileSync(path.join(__dirname, 'ai_tournament_results_DESECRATE.json'), 'utf8'));
const BASE = JSON.parse(fs.readFileSync(path.join(__dirname, 'ai_tournament_results_baseline.json'), 'utf8'));
const OUT = path.join(ROOT, 'ai_tournament_report_DESECRATE.md');

const pct = (x) => x == null ? 'n/a' : (x * 100).toFixed(1) + '%';
const f2 = (x) => x == null ? 'n/a' : x.toFixed(2);
const signed = (x) => (x >= 0 ? '+' : '') + (x * 100).toFixed(1) + ' pts';

// ── Métriques dérivées d'un jeu de résultats ─────────────────────────────
function derive(r) {
  const S = r.meta.strategies, M = r.stratMatrix;
  const beats = (a, b) => M[a][b] > 0.5;
  const winsAgainst = {}, avgWR = {};
  for (const a of S) {
    const others = S.filter(b => b !== a);
    winsAgainst[a] = others.filter(b => beats(a, b)).length;
    avgWR[a] = others.reduce((acc, b) => acc + M[a][b], 0) / others.length;
  }
  const dominant = S.find(a => winsAgainst[a] === S.length - 1);
  // cycles à 3 (RPS)
  const cycles = [];
  for (const a of S) for (const b of S) for (const c of S) {
    if (a === b || b === c || a === c) continue;
    if (beats(a, b) && beats(b, c) && beats(c, a)) {
      const norm = [a, b, c];
      const min = Math.min(...norm.map(x => S.indexOf(x)));
      const start = norm.findIndex(x => S.indexOf(x) === min);
      const key = [norm[start], norm[(start + 1) % 3], norm[(start + 2) % 3]].join('>');
      if (!cycles.includes(key)) cycles.push(key);
    }
  }
  // mirror : avantage J2 global
  let p2 = 0, mg = 0, mClock = 0;
  for (const a of S) { p2 += r.mirror[a].p2Wins; mg += r.mirror[a].games; mClock += r.mirror[a].clockPct * r.mirror[a].games; }
  // strat-pairs : longueur + horloge agrégées
  let pg = 0, pturn = 0, pclock = 0;
  for (const k of Object.keys(r.pairMeta)) {
    const p = r.pairMeta[k]; pg += p.games; pturn += p.avgTurn * p.games; pclock += p.clockPct * p.games;
  }
  return {
    S, M, beats, winsAgainst, avgWR, dominant, cycles,
    mirrorP2: p2 / mg, mirrorClock: mClock / mg,
    pairAvgTurn: pturn / pg, pairClock: pclock / pg,
  };
}

const E = derive(EXP);
const B = derive(BASE);
const S = E.S;

// ── Verdict triangle (expérience) ────────────────────────────────────────
let triangleVerdict;
const raidBeatsRush = E.M['RAID']['RUSH'] > 0.5;
const subCycle = E.cycles.length > 0;
if (E.dominant && subCycle) {
  triangleVerdict = `**Résultat nuancé.** **${E.dominant}** bat encore **les trois profils conçus** (dominante globale), `
    + `mais un **cycle RPS émerge bel et bien entre RUSH/GUARD/RAID** : ${E.cycles.map(c => '`' + c + '`').join(', ')}. `
    + `⚠️ Ce cycle tourne **dans le sens INVERSE** de l'hypothèse (qui prédisait \`RAID>RUSH>GUARD>RAID\`) : ici **RUSH>RAID**, pas l'inverse.`;
} else if (E.dominant) {
  triangleVerdict = `**${E.dominant} domine** (bat les 3 autres) et aucun cycle RPS à 3 ne se referme.`;
} else if (subCycle) {
  triangleVerdict = `**Un cycle RPS émerge** : ${E.cycles.map(c => '`' + c + '`').join(', ')}. Aucune stratégie ne bat toutes les autres.`;
} else {
  triangleVerdict = `**Ni dominante stricte, ni cycle RPS à 3 complet.** Hiérarchie partielle (cf. matrice).`;
}

// ════════════════════════════════════════════════════════════════════════
let out = '';
const W = (s) => { out += s + '\n'; };

W(`# 5 Legends — Expérience DESECRATE_FAITH=1 + FAITH_WIN=16`);
W('');
W(`> Branche \`feat-ai-multistrat\`. **Expérience ciblée** : deux changements de`);
W(`> règles (une variable à la fois) pour tester si le **triangle RPS se ferme**.`);
W(`> Rapport original (FAITH_WIN=14, sans desecrate) conservé dans`);
W(`> \`ai_tournament_report.md\`. Aucune carte / faction / profil IA n'a été modifié.`);
W('');
W(`## Changements testés`);
W('');
W(`1. **FAITH_WIN : 14 → ${EXP.meta.faithWin}** (Ascension plus lointaine).`);
W(`2. **DESECRATE_FAITH = ${EXP.meta.desecrateFaith}** : profaner (tuer) une créature **agenouillée** donne +${EXP.meta.desecrateFaith} Foi à l'adversaire (le tueur). Tous chemins de mort ; Sanctuaire reste immunisé.`);
W('');
W(`**Hypothèse** : RAID>RUSH (Foi-des-kills), GUARD>RAID (Égide), RUSH>GUARD (vitesse) → cycle qui se referme.`);
W('');
W(`## Méthodologie`);
W('');
W(`- ${EXP.meta.gamesPerStratPair} parties / paire de stratégies (25 paires de factions × ${EXP.meta.seedsStrat} graines × 2 sièges), sièges équilibrés.`);
W(`- Faction × stratégie : ${EXP.meta.gamesPerFactionCell} parties / cellule (vs CONTROL).`);
W(`- Total : **${EXP.meta.totalGames.toLocaleString('fr-FR')} parties** (${EXP.meta.seconds}s, RNG seedé). Baseline : ${BASE.meta.totalGames.toLocaleString('fr-FR')} parties.`);
W('');

W(`## Verdict`);
W('');
W(triangleVerdict);
W('');
W(`- **RAID > RUSH ?** ${raidBeatsRush ? '**OUI**' : '**NON**'} — RAID vs RUSH = **${pct(E.M['RAID']['RUSH'])}** (baseline : ${pct(B.M['RAID']['RUSH'])}).`);
W(`- **Cycle RPS complet ?** ${E.cycles.length ? '**OUI** (' + E.cycles.join(', ') + ')' : '**NON**'}.`);
const hypoConfirmed = raidBeatsRush && E.M['GUARD']['RAID'] > 0.5 && E.M['RUSH']['GUARD'] > 0.5;
W(`- **Hypothèse (RAID>RUSH>GUARD>RAID)** : ${hypoConfirmed ? '**CONFIRMÉE**' : '**INFIRMÉE**'} ` +
  `(RAID>RUSH ${pct(E.M['RAID']['RUSH'])}, RUSH>GUARD ${pct(E.M['RUSH']['GUARD'])}, GUARD>RAID ${pct(E.M['GUARD']['RAID'])}).`);
W('');

// Win rate moyen + comparaison baseline
W(`## Win rate moyen par stratégie — expérience vs baseline`);
W('');
W(`| Stratégie | Baseline (14, sans desecrate) | Expérience (16 + desecrate) | Δ | Profils battus |`);
W(`|---|---|---|---|---|`);
for (const a of S.slice().sort((x, y) => E.avgWR[y] - E.avgWR[x])) {
  W(`| ${a} | ${pct(B.avgWR[a])} | ${pct(E.avgWR[a])} | ${signed(E.avgWR[a] - B.avgWR[a])} | ${E.winsAgainst[a]}/3 |`);
}
W('');

W(`## Matrice stratégie × stratégie (expérience)`);
W('');
W(`Win rate de la **ligne** vs la **colonne** (siège équilibré, toutes factions).`);
W('');
W(`| ROW \\ COL | ${S.join(' | ')} |`);
W(`|---|${S.map(() => '---').join('|')}|`);
for (const a of S) {
  W(`| **${a}** | ${S.map(b => a === b ? '—' : pct(E.M[a][b])).join(' | ')} |`);
}
W('');
W(`Pour comparaison, la matrice **baseline** :`);
W('');
W(`| ROW \\ COL | ${S.join(' | ')} |`);
W(`|---|${S.map(() => '---').join('|')}|`);
for (const a of S) {
  W(`| **${a}** | ${S.map(b => a === b ? '—' : pct(B.M[a][b])).join(' | ')} |`);
}
W('');
W(`Relations dominantes (expérience, win rates réels hors nuls) :`);
W('');
for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) {
  const a = S[i], b = S[j], wa = E.M[a][b], wb = E.M[b][a];
  if (wa >= 0.5 && wa - wb >= 0.02) W(`- **${a} > ${b}** — ${pct(wa)} vs ${pct(wb)} _(baseline : ${pct(B.M[a][b])} vs ${pct(B.M[b][a])})_.`);
  else if (wb >= 0.5 && wb - wa >= 0.02) W(`- **${b} > ${a}** — ${pct(wb)} vs ${pct(wa)} _(baseline : ${pct(B.M[b][a])} vs ${pct(B.M[a][b])})_.`);
  else W(`- **${a} ≈ ${b}** — ${pct(wa)} vs ${pct(wb)} (quasi-nul) _(baseline : ${pct(B.M[a][b])} vs ${pct(B.M[b][a])})_.`);
}
W('');

W(`## Avantage du 2ᵉ joueur (mirror) — dilué par FAITH_WIN=16 ?`);
W('');
W(`| | Baseline (14) | Expérience (16) | Δ |`);
W(`|---|---|---|---|`);
W(`| Victoires P2 en mirror | ${pct(B.mirrorP2)} | ${pct(E.mirrorP2)} | ${signed(E.mirrorP2 - B.mirrorP2)} |`);
W('');
W(`Détail mirror par stratégie (expérience) :`);
W('');
W(`| Stratégie | % P1 | % P2 | Tour moyen | % horloge |`);
W(`|---|---|---|---|---|`);
for (const a of S) {
  const m = EXP.mirror[a];
  W(`| ${a} | ${pct(m.p1Wins / m.games)} | ${pct(m.p2Wins / m.games)} | ${f2(m.avgTurn)} | ${pct(m.clockPct)} |`);
}
W('');

W(`## Longueur & horloge céleste`);
W('');
W(`| | Baseline (14) | Expérience (16) | Δ |`);
W(`|---|---|---|---|`);
W(`| Tour moyen (paires strat.) | ${f2(B.pairAvgTurn)} | ${f2(E.pairAvgTurn)} | ${(E.pairAvgTurn - B.pairAvgTurn >= 0 ? '+' : '') + f2(E.pairAvgTurn - B.pairAvgTurn)} |`);
W(`| % parties à l'horloge T${EXP.meta.turnCap} (paires) | ${pct(B.pairClock)} | ${pct(E.pairClock)} | ${signed(E.pairClock - B.pairClock)} |`);
W('');
W(`Par appariement (expérience) :`);
W('');
W(`| Appariement | Parties | Tour moyen | % horloge | % nuls |`);
W(`|---|---|---|---|---|`);
for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) {
  const a = S[i], b = S[j], p = EXP.pairMeta[`${a}|${b}`] || EXP.pairMeta[`${b}|${a}`];
  W(`| ${a} vs ${b} | ${p.games} | ${f2(p.avgTurn)} | ${pct(p.clockPct)} | ${pct(p.drawPct)} |`);
}
for (const a of S) {
  const m = EXP.mirror[a];
  W(`| ${a} (mirror) | ${m.games} | ${f2(m.avgTurn)} | ${pct(m.clockPct)} | ${pct(m.draws / m.games)} |`);
}
W('');

W(`## Faction × stratégie (expérience, vs CONTROL)`);
W('');
W(`| Stratégie \\ Faction | ${EXP.meta.factions.join(' | ')} | Meilleure |`);
W(`|---|${EXP.meta.factions.map(() => '---').join('|')}|---|`);
for (const s of S) {
  let best = null;
  for (const fa of EXP.meta.factions) { const wr = EXP.factionStrat[s][fa].winRate; if (!best || wr > best.wr) best = { fa, wr }; }
  W(`| **${s}** | ${EXP.meta.factions.map(fa => pct(EXP.factionStrat[s][fa].winRate)).join(' | ')} | ${best.fa} (${pct(best.wr)}) |`);
}
W('');

// ── Observations / conclusion ────────────────────────────────────────────
W(`## Observations & conclusion`);
W('');
const raidDelta = E.avgWR['RAID'] - B.avgWR['RAID'];
const rushDelta = E.avgWR['RUSH'] - B.avgWR['RUSH'];
W(`- **RAID** : win rate moyen ${pct(B.avgWR['RAID'])} → ${pct(E.avgWR['RAID'])} (${signed(raidDelta)}). Face à RUSH : ${pct(B.M['RAID']['RUSH'])} → ${pct(E.M['RAID']['RUSH'])}.`);
W(`- **RUSH** : ${pct(B.avgWR['RUSH'])} → ${pct(E.avgWR['RUSH'])} (${signed(rushDelta)}).`);
W(`- **Avantage J2 en mirror** : ${pct(B.mirrorP2)} → ${pct(E.mirrorP2)} (${signed(E.mirrorP2 - B.mirrorP2)}).`);
W(`- **Horloge T${EXP.meta.turnCap}** : ${pct(B.pairClock)} → ${pct(E.pairClock)} des parties (FAITH_WIN=16 retarde l'Ascension).`);
W(`- **Triangle** : ${subCycle ? 'un cycle RPS **apparaît** entre les profils conçus — `' + E.cycles.join(', ') + '` — mais ' + (E.dominant ? '**' + E.dominant + '** le surplombe (bat les 3).' : 'aucune dominante.') : (E.dominant ? E.dominant + ' reste dominante — pas de cycle.' : 'pas de cycle RPS à 3 complet ; hiérarchie partielle.')}`);
W(`- **Effet de la Foi-des-kills** : RAID (+${(raidDelta * 100).toFixed(1)} pts) et GUARD (+${((E.avgWR['GUARD'] - B.avgWR['GUARD']) * 100).toFixed(1)} pts) montent, RUSH s'effondre (${signed(rushDelta)}) — profaner ses propres fidèles agenouillés en masse **nourrit l'adversaire**, ce qui pénalise la course. Mais CONTROL (qui prie ET combat de façon équilibrée) **capitalise le mieux** sur la nouvelle source de Foi.`);
W('');
W(`**Hypothèse ${hypoConfirmed ? 'CONFIRMÉE' : 'INFIRMÉE'}.** ` +
  (hypoConfirmed
    ? `Avec DESECRATE_FAITH=1 + FAITH_WIN=16, RAID>RUSH émerge et le cycle pierre-feuille-ciseaux prédit se referme.`
    : `Le cycle **précis** prédit (\`RAID>RUSH>GUARD>RAID\`) **ne se forme pas** : RAID ne bat pas RUSH (${pct(E.M['RAID']['RUSH'])}, contre ${pct(B.M['RAID']['RUSH'])} au baseline — nette amélioration mais insuffisante). ` +
      `${subCycle ? 'Fait notable : un cycle RPS émerge tout de même entre les trois profils conçus, mais dans le **sens inverse** (`' + E.cycles.join(', ') + '`), et **CONTROL le surplombe** en battant les trois. ' : ''}` +
      `La Foi-des-kills rééquilibre fortement RAID/GUARD vs RUSH (RUSH ${pct(B.avgWR['RUSH'])}→${pct(E.avgWR['RUSH'])}) sans installer la hiérarchie cyclique espérée.`));
W('');
W(`> Mesure seule — toute décision d'équilibrage (cartes, factions, valeur de DESECRATE_FAITH, seuil de Foi) reste humaine.`);
W('');
W(`---`);
W(`*Généré par \`tools/ai_report_desecrate.js\` depuis \`tools/ai_tournament_results_DESECRATE.json\` + \`..._baseline.json\`.*`);

fs.writeFileSync(OUT, out);
console.log(`✓ Rapport écrit → ${path.relative(ROOT, OUT)} (${out.length} octets)`);
console.log(`\nTriangle : ${triangleVerdict.replace(/\*\*/g, '')}`);
console.log(`RAID>RUSH : ${raidBeatsRush ? 'OUI' : 'NON'} (${pct(E.M['RAID']['RUSH'])}) ; hypothèse ${hypoConfirmed ? 'CONFIRMÉE' : 'INFIRMÉE'}`);
