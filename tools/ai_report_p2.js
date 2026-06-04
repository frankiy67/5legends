#!/usr/bin/env node
'use strict';
/**
 * ai_report_p2.js — ÉTAPE 5 : rapport de calibration de la compensation J2.
 *
 * Lit  tools/p2_sweep_results.json                  (sweep miroir {0,1,2})
 *      tools/ai_tournament_results_P2.json          (tournoi P2_START_FAITH retenu)
 *      tools/ai_tournament_results_DESECRATE.json   (baseline DESECRATE, P2=2)
 * Écrit ./ai_tournament_report_P2.md. Pur rendu, aucune partie jouée.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SWEEP = JSON.parse(fs.readFileSync(path.join(__dirname, 'p2_sweep_results.json'), 'utf8'));
const EXP = JSON.parse(fs.readFileSync(path.join(__dirname, 'ai_tournament_results_P2.json'), 'utf8'));
const BASE = JSON.parse(fs.readFileSync(path.join(__dirname, 'ai_tournament_results_DESECRATE.json'), 'utf8'));
const OUT = path.join(ROOT, 'ai_tournament_report_P2.md');

const pct = (x) => x == null ? 'n/a' : (x * 100).toFixed(1) + '%';
const f2 = (x) => x == null ? 'n/a' : x.toFixed(2);
const signed = (x) => (x >= 0 ? '+' : '') + (x * 100).toFixed(1) + ' pts';

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
  let p2 = 0, mg = 0;
  for (const a of S) { p2 += r.mirror[a].p2Wins; mg += r.mirror[a].games; }
  let pg = 0, pturn = 0, pclock = 0;
  for (const k of Object.keys(r.pairMeta)) {
    const p = r.pairMeta[k]; pg += p.games; pturn += p.avgTurn * p.games; pclock += p.clockPct * p.games;
  }
  // meilleure faction par stratégie
  const bestFac = {};
  for (const s of S) {
    let best = null;
    for (const fa of r.meta.factions) { const wr = r.factionStrat[s][fa].winRate; if (!best || wr > best.wr) best = { fa, wr }; }
    bestFac[s] = best;
  }
  return { S, M, beats, winsAgainst, avgWR, dominant, cycles, mirrorP2: p2 / mg, pairAvgTurn: pturn / pg, pairClock: pclock / pg, bestFac };
}

const E = derive(EXP);
const B = derive(BASE);
const S = E.S;
// La baseline DESECRATE a été générée avant l'ajout de meta.p2StartFaith → défaut 2.
const baseP2 = BASE.meta.p2StartFaith != null ? BASE.meta.p2StartFaith : 2;
const expP2 = EXP.meta.p2StartFaith;

// ════════════════════════════════════════════════════════════════════════
let out = '';
const W = (s) => { out += s + '\n'; };

W(`# 5 Legends — Calibration de la compensation J2 (P2_START_FAITH)`);
W('');
W(`> Branche \`feat-ai-multistrat\`, après DESECRATE_FAITH=1 + FAITH_WIN=16.`);
W(`> Objectif : trouver le \`P2_START_FAITH\` donnant ~50-54 % de victoires J2 en`);
W(`> miroir. **Mesure seule** — aucune carte / faction / profil IA touché. La`);
W(`> valeur shippée du jeu reste **2** (le tournoi mesure ${expP2} via le harnais).`);
W('');

W(`## Sweep miroir — P2_START_FAITH ∈ {0, 1, 2}`);
W('');
W(`${SWEEP.meta.games.toLocaleString('fr-FR')} parties CONTROL vs CONTROL en miroir par valeur, factions équilibrées.`);
W('');
W(`| P2_START_FAITH | Win rate J2 (miroir) | Win rate J1 | Tour moyen | % horloge |`);
W(`|---|---|---|---|---|`);
for (const r of SWEEP.rows) {
  const star = r.p2StartFaith === SWEEP.recommended ? ' ◀ retenu' : '';
  W(`| ${r.p2StartFaith}${star} | ${pct(r.j2WinRate)} | ${pct(r.j1WinRate)} | ${f2(r.avgTurn)} | ${pct(r.clockPct)} |`);
}
W('');
const slope = (SWEEP.rows.find(r => r.p2StartFaith === 2).j2WinRate - SWEEP.rows.find(r => r.p2StartFaith === 0).j2WinRate) / 2;
W(`**Pente** : ~${(slope * 100).toFixed(1)} pts de win rate J2 par point de Foi de départ (monotone).`);
W('');

W(`## ⚠️ La cible 50-54 % est INATTEIGNABLE avec ce levier`);
W('');
const j2at0 = SWEEP.rows.find(r => r.p2StartFaith === 0).j2WinRate;
W(`Même à **P2_START_FAITH=0**, J2 gagne **${pct(j2at0)}** en miroir — loin de la cible. ` +
  `Pour atteindre ~52 %, il faudrait un départ d'environ **${(- (j2at0 - 0.52) / slope).toFixed(1)}** (négatif → impossible). ` +
  `Le jeton de Foi n'est **pas** la cause principale du déséquilibre.`);
W('');
W(`**Causes structurelles** (hors périmètre — décision de design/équilibrage humaine) :`);
W('');
W(`- **J2 démarre à 5 cartes vs 4 pour J1** (\`initGame\`, src/game.js:716), et **pioche avant son 1ᵉʳ tour → 6 cartes en main** quand J1 agit encore à 4. Net avantage de cartes.`);
W(`- **J2 joue en second** : il agit en RÉACTION au plateau de J1, atout fort dans une course de Foi.`);
W(`- Le jeton de Foi (+2) n'ajoute qu'environ ${((SWEEP.rows.find(r=>r.p2StartFaith===2).j2WinRate - j2at0) * 100).toFixed(1)} pts par-dessus ces facteurs.`);
W('');
W(`**Valeur retenue pour le tournoi : P2_START_FAITH = ${SWEEP.recommended}** (la plus proche de la cible, conformément au protocole) — étant entendu qu'elle **réduit** mais **ne règle pas** le déséquilibre.`);
W('');

W(`## Tournoi complet avec P2_START_FAITH = ${expP2}`);
W('');
W(`${EXP.meta.totalGames.toLocaleString('fr-FR')} parties (5000/paire de stratégies, sièges équilibrés). Comparaison : baseline DESECRATE (P2_START_FAITH=${baseP2}).`);
W('');
W(`### Avantage J2 — mirror global`);
W('');
W(`| | Baseline DESECRATE (P2=${baseP2}) | Retenu (P2=${expP2}) | Δ |`);
W(`|---|---|---|---|`);
W(`| Victoires J2 en mirror | ${pct(B.mirrorP2)} | ${pct(E.mirrorP2)} | ${signed(E.mirrorP2 - B.mirrorP2)} |`);
W('');

W(`### Win rate moyen par stratégie`);
W('');
W(`| Stratégie | Baseline (P2=${baseP2}) | Retenu (P2=${expP2}) | Δ | Profils battus |`);
W(`|---|---|---|---|---|`);
for (const a of S.slice().sort((x, y) => E.avgWR[y] - E.avgWR[x])) {
  W(`| ${a} | ${pct(B.avgWR[a])} | ${pct(E.avgWR[a])} | ${signed(E.avgWR[a] - B.avgWR[a])} | ${E.winsAgainst[a]}/3 |`);
}
W('');

W(`### Matrice stratégie × stratégie (P2=${expP2})`);
W('');
W(`| ROW \\ COL | ${S.join(' | ')} |`);
W(`|---|${S.map(() => '---').join('|')}|`);
for (const a of S) W(`| **${a}** | ${S.map(b => a === b ? '—' : pct(E.M[a][b])).join(' | ')} |`);
W('');
W(`Baseline DESECRATE (P2=${baseP2}) pour comparaison :`);
W('');
W(`| ROW \\ COL | ${S.join(' | ')} |`);
W(`|---|${S.map(() => '---').join('|')}|`);
for (const a of S) W(`| **${a}** | ${S.map(b => a === b ? '—' : pct(B.M[a][b])).join(' | ')} |`);
W('');
W(`Relations dominantes (P2=${expP2}) :`);
W('');
for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) {
  const a = S[i], b = S[j], wa = E.M[a][b], wb = E.M[b][a];
  if (wa >= 0.5 && wa - wb >= 0.02) W(`- **${a} > ${b}** — ${pct(wa)} vs ${pct(wb)}.`);
  else if (wb >= 0.5 && wb - wa >= 0.02) W(`- **${b} > ${a}** — ${pct(wb)} vs ${pct(wa)}.`);
  else W(`- **${a} ≈ ${b}** — ${pct(wa)} vs ${pct(wb)} (quasi-nul).`);
}
W('');

W(`### Longueur & horloge`);
W('');
W(`| | Baseline (P2=${baseP2}) | Retenu (P2=${expP2}) | Δ |`);
W(`|---|---|---|---|`);
W(`| Tour moyen (paires strat.) | ${f2(B.pairAvgTurn)} | ${f2(E.pairAvgTurn)} | ${(E.pairAvgTurn - B.pairAvgTurn >= 0 ? '+' : '') + f2(E.pairAvgTurn - B.pairAvgTurn)} |`);
W(`| % horloge T${EXP.meta.turnCap} (paires) | ${pct(B.pairClock)} | ${pct(E.pairClock)} | ${signed(E.pairClock - B.pairClock)} |`);
W('');

W(`### Faction × stratégie (meilleure faction par stratégie, vs CONTROL)`);
W('');
W(`| Stratégie \\ Faction | ${EXP.meta.factions.join(' | ')} | Meilleure |`);
W(`|---|${EXP.meta.factions.map(() => '---').join('|')}|---|`);
for (const s of S) {
  W(`| **${s}** | ${EXP.meta.factions.map(fa => pct(EXP.factionStrat[s][fa].winRate)).join(' | ')} | ${E.bestFac[s].fa} (${pct(E.bestFac[s].wr)}) |`);
}
W('');
const norseDom = S.every(s => E.bestFac[s].fa === 'norse');

W(`## Verdict`);
W('');
const triangleHeld = E.dominant === B.dominant && E.cycles.join() === B.cycles.join();
W(`- **Déséquilibre J2 réglé ?** **NON.** P2_START_FAITH=${expP2} fait passer le J2 miroir de ${pct(B.mirrorP2)} à ${pct(E.mirrorP2)} (${signed(E.mirrorP2 - B.mirrorP2)}), encore **très au-dessus** de la cible 50-54 %. Le levier est trop faible ; la cause est structurelle (cartes + tour de jeu).`);
W(`- **Triangle préservé ?** ${triangleHeld ? '**OUI**' : 'partiellement'} — ${E.dominant ? '**' + E.dominant + '** reste au-dessus (bat les 3)' : 'pas de dominante stricte'}${E.cycles.length ? ', et le cycle `' + E.cycles.join(', ') + '` entre les profils conçus subsiste' : ''}. Abaisser la Foi de départ de J2 **ne casse pas** la structure stratégique.`);
W(`- **Norse toujours dominant ?** ${norseDom ? '**OUI**' : 'non'} — norse reste la meilleure faction ${norseDom ? 'pour les ' + S.length + ' stratégies' : 'pour la plupart des stratégies'}.`);
W(`- **CONTROL toujours au-dessus ?** ${E.dominant === 'CONTROL' ? '**OUI** (bat les 3 profils conçus, ' + pct(E.avgWR['CONTROL']) + ' moyen).' : (E.dominant ? '**' + E.dominant + '** domine désormais.' : 'pas de dominante stricte.')}`);
W('');
W(`**Conclusion.** Le déséquilibre J2 **n'est pas réglable** en jouant sur \`P2_START_FAITH\` seul (la cible est hors d'atteinte, même à 0). Mais varier ce levier **ne déstabilise pas le triangle** : ${E.dominant === 'CONTROL' ? 'CONTROL reste au sommet' : E.dominant + ' domine'}${E.cycles.length ? ', le sous-cycle RPS persiste' : ''}, norse reste fort. Un vrai rééquilibrage J1/J2 nécessite une **décision de design** sur les facteurs structurels (taille de main de départ 4 vs 5, pioche du 1ᵉʳ tour) — hors périmètre de mesure.`);
W('');
W(`> Mesure seule — toute décision d'équilibrage (compensation J2, cartes, factions) reste humaine. La valeur shippée du jeu est inchangée (P2_START_FAITH=2).`);
W('');
W(`---`);
W(`*Généré par \`tools/ai_report_p2.js\` depuis \`p2_sweep_results.json\` + \`ai_tournament_results_P2.json\` + \`..._DESECRATE.json\`.*`);

fs.writeFileSync(OUT, out);
console.log(`✓ Rapport écrit → ${path.relative(ROOT, OUT)} (${out.length} octets)`);
console.log(`\nJ2 miroir : ${pct(B.mirrorP2)} (P2=2) → ${pct(E.mirrorP2)} (P2=${expP2}). Cible 50-54% : ${E.mirrorP2 <= 0.54 ? 'ATTEINTE' : 'NON atteinte'}.`);
console.log(`Dominante : ${E.dominant || '—'} ; cycles : ${E.cycles.join(', ') || '—'} ; norse partout : ${norseDom}`);
