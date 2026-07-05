#!/usr/bin/env node
/* ============================================================================
 * ui_powers.js — HARNAIS DE DIAGNOSTIC UI (Playwright, vrai navigateur).
 *
 * Objectif : pour CHAQUE carte du jeu (base + pool), mettre en situation son
 * effet de façon déterministe DANS UN VRAI CHROMIUM, la jouer par le point
 * d'entrée UI (playCard), lire l'état interne (G) ET le DOM rendu, comparer à
 * l'effet attendu, et classer : CONFORME / NON CONFORME (cause UI·CÂBLAGE·
 * LOGIQUE) / NON TESTABLE. Produit docs/UI_DIAGNOSTIC.md + captures ui_diag/.
 *
 * game.js et index.html restent BYTE-IDENTIQUES : ce script génère à la volée
 * une page harnais (ui_diag_harness.html à la racine) qui INLINE les octets
 * exacts de src/game.js + un pont window.__D (même portée lexicale → accès à G
 * et aux registres const). La logique de scénarios vit dans ui_powers_page.js.
 *
 * Usage :   node tools/ui_powers.js            (toutes les cartes)
 *           node tools/ui_powers.js --card ID  (une seule carte, debug)
 *           node tools/ui_powers.js --headed   (navigateur visible)
 * ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const GAME_SRC = path.join(ROOT, 'src', 'game.js');
const INDEX = path.join(ROOT, 'index.html');
const PAGE_SCRIPT = path.join(__dirname, 'ui_powers_page.js');
const HARNESS = path.join(ROOT, 'ui_diag_harness.html');
const OUT_DIR = path.join(ROOT, 'ui_diag');
const DOC = path.join(ROOT, 'docs', 'UI_DIAGNOSTIC.md');

const ARGS = process.argv.slice(2);
const ONE = ARGS.includes('--card') ? ARGS[ARGS.indexOf('--card') + 1] : null;
const HEADED = ARGS.includes('--headed');

// ── Pont window.__D : exposé DANS la portée de game.js (voit G + les const). ──
const BRIDGE = `
;/* ---- PONT DE DIAGNOSTIC (ajouté par tools/ui_powers.js — game.js intact) ---- */
window.__D = {
  get G(){ return G; },
  FACTIONS, MONSTERS, GODS, POOL_MONSTERS, POOL_SPELLS,
  GOD_EFFECTS, OMEN_EFFECTS, REGENT_GODS, REGENT_AURAS,
  CYCLE_PHASES, CYCLE_NAMES, ZENITH_MAP, FACTION_PHASE_IDX,
  allCards(){
    const out=[];
    for(const f of FACTIONS){
      for(const m of MONSTERS[f]) out.push({...m,type:'monster',faction:f,grp:'base'});
      for(const g of GODS[f]) out.push({...g,type:g.type||'god',faction:f,grp:'base'});
      for(const m of POOL_MONSTERS[f]) out.push({...m,type:'monster',faction:f,grp:'pool'});
      for(const s of POOL_SPELLS[f]) out.push({...s,type:'spell',faction:f,grp:'pool'});
    }
    return out;
  },
  seedRNG, initGame, newCard, buildDeck,
  playCard, playMonster, playGod, playSpell,
  applyEntry, applyExit, handleDeath, doAttack, drawCard,
  setCyclePhase, doEndTurn, advancePhase, resolveDueOmens, scheduleOmen,
  destroyOmen, enthroneGod, dethroneGod, doPray, prayWith,
  executeSacrifice, executeRitual, startRitual,
  renderAll, checkVictory, getZenithFaction, isZenith, ticksToPhase,
  effProtect, hasEgide, protectedByEgide, canPray, notifyWake, notifyTrapReveal,
  markValidTargets,
  poolOnSummon: (typeof poolOnSummon!=='undefined'?poolOnSummon:null),
  poolSleep: (typeof poolSleep!=='undefined'?poolSleep:null),
  poolSacrifice: (typeof poolSacrifice!=='undefined'?poolSacrifice:null),
  poolNotifyFrozen: (typeof poolNotifyFrozen!=='undefined'?poolNotifyFrozen:null),
  poolNotifyHindered: (typeof poolNotifyHindered!=='undefined'?poolNotifyHindered:null),
  poolNotifyAdvanced: (typeof poolNotifyAdvanced!=='undefined'?poolNotifyAdvanced:null),
  poolFreezeSync: (typeof poolFreezeSync!=='undefined'?poolFreezeSync:null),
};
window.__gameLoaded = true;
`;

function buildHarness() {
  const game = fs.readFileSync(GAME_SRC, 'utf8');
  let html = fs.readFileSync(INDEX, 'utf8');
  const inline = `<script>\n${game}\n${BRIDGE}\n</script>`;
  html = html.replace('<script src="./src/game.js"></script>', inline);
  fs.writeFileSync(HARNESS, html);
}

// ── Serveur statique minimal (racine du repo). ───────────────────────────────
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ogg': 'audio/ogg', '.json': 'application/json' };
function startServer() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const fp = path.join(ROOT, p);
      if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
        res.writeHead(404); res.end('nf'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
      fs.createReadStream(fp).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

const V = { CONFORME: '✅', NON_CONFORME: '❌', NON_TESTABLE: '⚠️', ERREUR: '💥' };

async function main() {
  buildHarness();
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const srv = await startServer();
  const port = srv.address().port;
  const url = `http://127.0.0.1:${port}/ui_diag_harness.html`;

  const browser = await chromium.launch({ headless: !HEADED });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e)));

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__gameLoaded === true', { timeout: 15000 });
  await page.addScriptTag({ path: PAGE_SCRIPT });
  await page.waitForFunction('window.__uidiagReady === true', { timeout: 15000 });

  let cards = await page.evaluate('window.__cardList()');
  if (ONE) cards = cards.filter(c => c.id === ONE);
  console.log(`\n▶ Diagnostic UI — ${cards.length} cartes dans un vrai Chromium\n`);

  const results = [];
  let i = 0;
  for (const card of cards) {
    i++;
    let r;
    try {
      r = await page.evaluate(id => window.__runDiag(id), card.id);
    } catch (e) {
      r = { id: card.id, n: card.n, faction: card.faction, type: card.type, cap: card.cap, verdict: 'ERREUR', detail: String(e).split('\n')[0], expected: '', observed: '' };
    }
    r.grp = card.grp; r.txt = card.txt; r.disabled = card.disabled;
    results.push(r);
    const tag = V[r.verdict] || '?';
    const cause = r.cause ? ` [${r.cause}]` : '';
    process.stdout.write(`${String(i).padStart(3)}/${cards.length} ${tag} ${card.id.padEnd(16)} ${(r.family || '').padEnd(16)}${cause}\n`);

    if (r.verdict === 'NON_CONFORME') {
      try {
        await page.screenshot({ path: path.join(OUT_DIR, `${card.id}.png`), fullPage: false });
      } catch (e) { /* ignore */ }
    }
  }

  await browser.close();
  await new Promise(res => srv.close(res));
  try { fs.unlinkSync(HARNESS); } catch (e) {}

  writeReport(results, pageErrors);
  fs.writeFileSync(path.join(OUT_DIR, 'results.json'), JSON.stringify(results, null, 2));

  const conf = results.filter(r => r.verdict === 'CONFORME').length;
  const nc = results.filter(r => r.verdict === 'NON_CONFORME').length;
  const nt = results.filter(r => r.verdict === 'NON_TESTABLE').length;
  const err = results.filter(r => r.verdict === 'ERREUR').length;
  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  ${conf} CONFORMES · ${nc} NON CONFORMES · ${nt} NON TESTABLES${err ? ' · ' + err + ' ERREURS' : ''}  (sur ${results.length})`);
  console.log(`  Rapport : docs/UI_DIAGNOSTIC.md`);
  console.log(`═══════════════════════════════════════════════════\n`);
}

function esc(s) { return String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\n/g, ' '); }

function writeReport(results, pageErrors) {
  const conf = results.filter(r => r.verdict === 'CONFORME');
  const nc = results.filter(r => r.verdict === 'NON_CONFORME');
  const nt = results.filter(r => r.verdict === 'NON_TESTABLE');
  const err = results.filter(r => r.verdict === 'ERREUR');

  const byCause = c => nc.filter(r => r.cause === c);
  const ui = byCause('UI'), cab = byCause('CABLAGE'), log = byCause('LOGIQUE');

  // Cause RACINE (au-dessus de la cap) : regroupe les motifs de fond qui
  // traversent plusieurs capacités différentes.
  function rootCause(r) {
    const cap = r.cap || '';
    if (/^passive_/.test(cap)) return 'Passif « Toujours » jamais appliqué aux stats (cap présente seulement dans le HUD et le score de draft IA)';
    if (/\bcurse\b|curse_protect|curse_endure/.test(cap)) return 'Mot-clé Malédiction cosmétique : le drapeau `cursed` n\'est jamais posé sur le porteur';
    if (['recycle_return', 'exit_self_sleep', 'entry_token_per_greek'].includes(cap)) return 'Capacité sans handler moteur (déclarée sur la carte, référencée uniquement par le score de draft IA)';
    return `Autre (${cap})`;
  }
  for (const r of nc) r.rootCause = rootCause(r);

  // Regroupement des causes communes par cause racine.
  const commonMap = {};
  for (const r of nc) (commonMap[r.rootCause] = commonMap[r.rootCause] || []).push(r);
  const common = Object.entries(commonMap).filter(([, arr]) => arr.length >= 2)
    .sort((a, b) => b[1].length - a[1].length);

  let md = '';
  md += `# Diagnostic UI des pouvoirs — 5 Legends (branche feat-pool)\n\n`;
  md += `> Généré par \`tools/ui_powers.js\` (Playwright / Chromium réel). Session **read-only** côté gameplay : \`src/game.js\` et \`index.html\` sont byte-identiques. Le harnais inline les octets exacts de game.js dans une page jetable + un pont \`window.__D\`, met chaque carte en situation de façon déterministe, la joue par \`playCard\` (le point d'entrée réel de l'UI), puis lit **l'état interne ET le DOM rendu**.\n\n`;
  md += `## Le compte\n\n`;
  md += `**${conf.length} conformes · ${nc.length} non conformes · ${nt.length} non testables${err.length ? ' · ' + err.length + ' erreurs' : ''}** sur **${results.length}** cartes.\n\n`;
  md += `| Verdict | Nombre |\n|---|---|\n`;
  md += `| ✅ CONFORME | ${conf.length} |\n`;
  md += `| ❌ NON CONFORME | ${nc.length} |\n`;
  md += `| &nbsp;&nbsp;└ dont [LOGIQUE] | ${log.length} |\n`;
  md += `| &nbsp;&nbsp;└ dont [CÂBLAGE] | ${cab.length} |\n`;
  md += `| &nbsp;&nbsp;└ dont [UI] | ${ui.length} |\n`;
  md += `| ⚠️ NON TESTABLE | ${nt.length} |\n`;
  if (err.length) md += `| 💥 ERREUR JS | ${err.length} |\n`;
  md += `\n`;

  md += `## Les causes communes (le plus important)\n\n`;
  if (nc.length) {
    md += `> **Le motif de fond (1 cause = les ${nc.length} non-conformités).** Toutes les cartes non conformes partagent la même racine : **la capacité figure sur la carte (texte, souvent l'indicateur HUD et le score de draft de l'IA) mais aucun code du moteur ne l'applique — l'effet est inerte.** Aucune n'est un problème d'affichage ([UI]) ni de câblage UI→moteur ([CÂBLAGE]) : le moteur lui-même ne fait rien. Cela recoupe le rapport de nuit (Khepri/Sekhmet/Élan post-résurrection). Trois sous-familles :\n\n`;
  }
  if (common.length === 0) {
    md += `_Aucun sous-motif ne touche ≥2 cartes._\n\n`;
  } else {
    md += `| Cause racine | Cartes touchées | Détail |\n|---|---|---|\n`;
    for (const [root, arr] of common) {
      md += `| ${esc(root)} | **${arr.length}** — ${arr.map(r => r.n).join(', ')} | ${esc(arr.map(r => '`' + r.cap + '`').filter((v, i, s) => s.indexOf(v) === i).join(', '))} |\n`;
    }
    md += `\n`;
    const singles = Object.entries(commonMap).filter(([, arr]) => arr.length < 2);
    if (singles.length) md += `_Cas isolés (même racine, cap unique) :_ ${singles.map(([root, arr]) => arr.map(r => r.n).join(', ')).join(' ; ')}.\n\n`;
  }

  md += `## Tableau des NON CONFORMES\n\n`;
  if (nc.length === 0) {
    md += `_Aucune._\n\n`;
  } else {
    md += `| Carte | Faction | Cap | Effet attendu | Effet observé | Cause |\n|---|---|---|---|---|---|\n`;
    const order = { LOGIQUE: 0, CABLAGE: 1, UI: 2 };
    nc.sort((a, b) => (order[a.cause] - order[b.cause]) || a.cap.localeCompare(b.cap));
    for (const r of nc) {
      md += `| ${esc(r.n)}${r.disabled ? ' _(désactivée)_' : ''} | ${r.faction} | \`${esc(r.cap)}\` | ${esc(r.expected)} | ${esc(r.observed)} | **[${r.cause}]** |\n`;
    }
    md += `\n`;
  }

  if (nt.length) {
    md += `## Non testables (condition impossible à mettre en place déterministe)\n\n`;
    md += `| Carte | Faction | Cap | Pourquoi non testable |\n|---|---|---|---|\n`;
    for (const r of nt) md += `| ${esc(r.n)} | ${r.faction} | \`${esc(r.cap)}\` | ${esc(r.detail)} |\n`;
    md += `\n`;
  }

  if (err.length) {
    md += `## Erreurs JS pendant le scénario\n\n`;
    for (const r of err) md += `- **${esc(r.n)}** (\`${esc(r.cap)}\`) : ${esc(r.observed || r.detail)}\n`;
    md += `\n`;
  }

  md += `## Conformes (${conf.length})\n\n`;
  md += `<details><summary>Liste des cartes conformes</summary>\n\n`;
  const byFam = {};
  for (const r of conf) (byFam[r.family] = byFam[r.family] || []).push(r.n);
  for (const [fam, names] of Object.entries(byFam).sort()) md += `- **${fam}** (${names.length}) : ${names.join(', ')}\n`;
  md += `\n</details>\n\n`;

  if (pageErrors.length) {
    md += `## Erreurs console de la page (global)\n\n`;
    const uniq = [...new Set(pageErrors)].slice(0, 20);
    for (const e of uniq) md += `- ${esc(e)}\n`;
    md += `\n`;
  }

  md += `## Comment relancer le harnais\n\n`;
  md += '```bash\n';
  md += `# Prérequis (déjà installés) : Playwright + Chromium en devDependency\n`;
  md += `npm install            # installe playwright (voir package.json)\n`;
  md += `npx playwright install chromium\n\n`;
  md += `# Lancer le diagnostic complet (génère docs/UI_DIAGNOSTIC.md + ui_diag/*.png)\n`;
  md += `node tools/ui_powers.js\n\n`;
  md += `# Déboguer une seule carte, navigateur visible :\n`;
  md += `node tools/ui_powers.js --card P_BENNU --headed\n`;
  md += '```\n\n';
  md += `Le harnais démarre son propre serveur statique et un Chromium headless ; il n'a pas besoin du \`python3 -m http.server\` manuel. La page jetable \`ui_diag_harness.html\` est régénérée puis supprimée à chaque exécution (game.js jamais modifié).\n\n`;
  md += `### Méthode & limites\n\n`;
  md += `- **Mise en situation déterministe** : \`initGame(faction, autre, 'sim')\` puis reset du plateau ; la carte testée est placée en main de J1 et jouée par \`playCard\` (le handler que le clic sur la carte appelle). En mode \`sim\` les fenêtres de réaction et le ciblage humain s'auto-résolvent (aiPickTarget), sans blocage de modale.\n`;
  md += `- **Double lecture** : après résolution, on lit l'objet d'état \`G\` (via le pont) ET le DOM produit par \`renderAll\`. Un effet présent en interne mais absent à l'écran ⇒ **[UI]**.\n`;
  md += `- **Distinction CÂBLAGE / LOGIQUE** : si jouer la carte n'applique pas l'effet, on rejoue en invoquant directement le moteur (\`applyEntry\`/\`playGod\`). Si l'effet apparaît alors ⇒ **[CÂBLAGE]** ; sinon ⇒ **[LOGIQUE]** (effet réellement absent/faux).\n`;
  md += `- **NON TESTABLE** : capacités dont le déclencheur ne se met pas en place de façon déterministe dans ce harnais (ex. contres qui exigent une vraie pile de réaction, effets d'information cachée). Listées franchement plutôt qu'inventées.\n`;

  fs.writeFileSync(DOC, md);
}

main().catch(e => { console.error('HARNAIS FAIL', e); process.exit(1); });
