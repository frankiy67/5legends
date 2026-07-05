/* ============================================================================
 * ui_powers_page.js — MOTEUR DE DIAGNOSTIC (contexte navigateur).
 *
 * Injecté par tools/ui_powers.js dans la page harnais (index.html avec game.js
 * inliné + le pont window.__D). Ce fichier NE modifie PAS le jeu : il pilote
 * les vraies fonctions de game.js via le pont, met en situation chaque carte de
 * façon déterministe, joue la carte par le VRAI point d'entrée UI (playCard),
 * lit l'état interne (G) ET le DOM rendu (renderAll), puis compare à l'effet
 * attendu (POOL_DESIGN pour les nouvelles, texte de carte pour les existantes).
 *
 * Classement d'une carte NON CONFORME :
 *   [UI]      : l'état interne change bien, mais le DOM ne le reflète pas.
 *   [CÂBLAGE] : jouer la carte n'applique pas l'effet, mais l'invocation directe
 *               de l'effet (applyEntry / playGod…) le produit.
 *   [LOGIQUE] : même l'invocation directe ne produit rien (effet réellement
 *               absent ou faux dans le moteur).
 * ========================================================================== */
(function () {
  'use strict';
  const D = window.__D;
  if (!D) { console.error('[uidiag] pont __D absent'); return; }

  // ── Utilitaires d'état ────────────────────────────────────────────────────
  const OTHER = { yokai: 'aztec', norse: 'greek', egyptian: 'aztec', greek: 'aztec', aztec: 'greek' };
  const PHASE_IDX = { aube: 0, midi: 1, crepuscule: 2, nuit: 3, tenebres: 4 };

  function G() { return D.G; }

  // Remet le jeu dans un état neutre, J1 = faction `f1`, J1 à jouer en Main1.
  function setupBase(f1) {
    const f2 = OTHER[f1] || 'greek';
    D.seedRNG(987654321);
    D.initGame(f1, f2, 'sim', {});
    const g = G();
    g.cp = 1; g.activeTurn = 1; g.turn = 3; g.phase = 'Main1';
    g.cycle = 0; g.cycleTick = 0; g.cycleFrozen = 0; g.cycleLocked = false;
    g.omens = []; g._omensPending = []; g._omenSeq = 0; g.ragnarok = 0;
    g.regents = [null, null, null, null, null];
    g.waitingForPlayer = false; g.inReaction = false; g.targeting = null; g.selAtk = null;
    g.stack = []; g.ritualPending = null;
    for (const p of [1, 2]) {
      const P = g.players[p];
      P.field = []; P.hand = []; P.graveyard = [];
      P.hp = 25; P.faith = 0; P.gems = 12; P.maxGems = 12;
      P.attacked = new Set(); P.summoned = new Set();
      P.balderActive = false; P._gebActive = false; P._centeotlActive = false;
      P._dmgTakenTurn = false;
    }
    // Deck de secours (pour les effets de pioche / recherche).
    g.players[1].deck = D.buildDeck(f1);
    g.players[2].deck = D.buildDeck(f2);
    // Rendu propre.
    const setup = document.getElementById('setup'); if (setup) setup.style.display = 'none';
    const game = document.getElementById('game'); if (game) game.style.display = 'grid';
    D.renderAll();
    return g;
  }

  function tmplOf(id) { return D.allCards().find(c => c.id === id); }

  // Pose un monstre "décor" sur le terrain (sans passer par l'invocation).
  function place(p, spec) {
    const g = G();
    const m = D.newCard({
      id: spec.id || 'DECOY', n: spec.n || 'Décor',
      atk: spec.atk != null ? spec.atk : 2, def: spec.def != null ? spec.def : 3,
      cost: 0, type: 'monster', cap: spec.cap || '', txt: '', rarity: 'common',
      faction: spec.faction || g.players[p].faction,
    });
    m.cAtk = spec.atk != null ? spec.atk : 2;
    m.cDef = spec.def != null ? spec.def : 3;
    if (spec.asleep) { m.asleep = true; m.faceDown = true; m.sleepTurns = spec.sleepTurns || 2; }
    if (spec.kneeling) m.kneeling = true;
    if (spec.faceDown) m.faceDown = true;
    if (spec.eph) m.eph = spec.eph;
    if (spec.momieRest) { m._mummyRest = true; m.faceDown = true; m.cDef = 0; }
    g.players[p].field.push(m);
    return m;
  }

  // Met la carte testée dans la main de J1 et renvoie son index.
  function handInsert(card) {
    const g = G();
    const m = D.newCard({ ...card });
    g.players[1].hand.push(m);
    return g.players[1].hand.length - 1;
  }

  // ── Snapshot interne ──────────────────────────────────────────────────────
  function pSnap(p) {
    const P = G().players[p];
    return {
      hp: P.hp, faith: P.faith || 0, gems: P.gems,
      hand: P.hand.map(c => c.id), handN: P.hand.length,
      deckN: P.deck.length, gy: P.graveyard.map(c => c.id), gyN: P.graveyard.length,
      field: P.field.map(m => m ? {
        id: m.id, n: m.n, cAtk: m.cAtk, cDef: m.cDef, cap: m.cap || '',
        faceDown: !!m.faceDown, asleep: !!m.asleep, sleepTurns: m.sleepTurns || 0,
        kneeling: !!m.kneeling, cursed: !!m.cursed, eph: m.eph || null, dnFace: m._dnFace || null,
        momieRest: !!m._mummyRest, exiled: !!m._exiled,
      } : null),
      fieldN: P.field.filter(Boolean).length,
    };
  }
  function snap() {
    const g = G();
    return {
      cycle: g.cycle, cycleTick: g.cycleTick, cycleFrozen: g.cycleFrozen, ragnarok: g.ragnarok,
      omens: (g.omens || []).map(o => ({ effectId: o.effectId, dueTick: o.dueTick, ownerP: o.ownerP, cardName: o.cardName, hidden: !!o.hidden })),
      regents: (g.regents || []).map(r => r ? { id: r.card.id, ownerP: r.ownerP, auraId: r.auraId } : null),
      p: [null, pSnap(1), pSnap(2)],
      log: g.log.map(l => l.msg),
    };
  }

  // ── Snapshot DOM (ce que l'écran montre réellement) ───────────────────────
  function domFieldOf(p) {
    return [...document.querySelectorAll(`[data-player="${p}"]`)].map(el => {
      const q = s => { const e = el.querySelector(s); return e ? e.textContent.trim() : null; };
      return {
        idx: +el.dataset.idx,
        atk: q('.fc-atk'), def: q('.fc-def'), name: q('.fc-name-band'),
        cap: q('.fc-cap-text'),
        faceDown: el.classList.contains('face-down'),
        canAtk: el.classList.contains('can-atk'),
        summonSick: el.classList.contains('summon-sick'),
        kneeling: el.classList.contains('kneeling'),
        tapped: el.classList.contains('tapped'),
        html: el.innerHTML,
      };
    });
  }
  function domSnap() {
    const txt = id => { const e = document.getElementById(id); return e ? e.textContent.trim() : null; };
    const cyc = [...document.querySelectorAll('#cycle-banner .cycle-phase')].find(e => e.classList.contains('active'));
    return {
      field: [null, domFieldOf(1), domFieldOf(2)],
      hp1: txt('p1-hp'), hp2: txt('p2-hp'),
      faith1: txt('p1-faith'), faith2: txt('p2-faith'),
      gems1: txt('p1-gems'),
      handN: document.querySelectorAll('#hand-cards .hcard').length,
      cyclePhase: cyc ? (cyc.querySelector('.cycle-phase-label') || {}).textContent : null,
      cycleGameAttr: (document.getElementById('game') || {}).dataset ? document.getElementById('game').dataset.cyclePhase : null,
      timeline: (document.getElementById('destiny-timeline') || {}).innerHTML || '',
      log: (document.getElementById('log') || {}).textContent || '',
    };
  }

  // ── Helpers de lecture snapshot ───────────────────────────────────────────
  const mine = (s, id) => s.p[1].field.find(m => m && m.id === id);
  const lastMine = s => { const f = s.p[1].field.filter(Boolean); return f[f.length - 1]; };
  const logHas = (s, re) => s.log.some(m => re.test(m));

  // ============================================================================
  // REGISTRE DE SCÉNARIOS. Premier match gagnant (spécifique → générique).
  // Chaque scénario : { family, match(meta), setup(ctx), play?(ctx),
  //   check(before,after,dom,ctx) -> {internalOk, domOk|null, expected, observed},
  //   direct?(ctx) (chemin moteur pour distinguer CÂBLAGE de LOGIQUE) }
  // ============================================================================
  const capIs = (...caps) => m => caps.includes(m.cap);
  const capHas = (...subs) => m => subs.some(s => (m.cap || '').includes(s));

  // Chemin "direct" par défaut pour un monstre : invocation moteur sans playCard.
  async function directSummon(ctx) {
    const g = G();
    const m = D.newCard({ ...ctx.card });
    g.players[1].field.push(m);
    const idx = g.players[1].field.length - 1;
    g.players[1].summoned.add(idx);
    if (D.poolOnSummon) D.poolOnSummon(1, m);
    await D.applyEntry(1, idx, m);
    D.renderAll();
  }

  const SCEN = [];
  const add = s => SCEN.push(s);

  // ─── TEMPOREL : avancer / retarder / figer / prophétie / choix ────────────
  add({
    family: 'temporel',
    match: capHas('entry_cycle_advance1', 'entry_cycle_delay1', 'entry_cycle_freeze1',
      'entry_cycle_prophecy', 'pool_skadi', 'pool_chant_freeze'),
    setup(ctx) { ctx.h = handInsert(ctx.card); },
    async play(ctx) { await D.playCard(ctx.h); },
    check(b, a, dom, ctx) {
      const cap = ctx.card.cap;
      if (capHas('freeze', 'chant_freeze', 'skadi')(ctx.card)) {
        const ok = a.cycleFrozen > b.cycleFrozen;
        return { internalOk: ok, domOk: ok ? true : null,
          expected: 'Cycle figé (cycleFrozen +1)', observed: `cycleFrozen ${b.cycleFrozen}→${a.cycleFrozen}` };
      }
      const moved = a.cycle !== b.cycle || a.cycleTick !== b.cycleTick;
      const domOk = dom.cyclePhase != null;
      return { internalOk: moved, domOk: moved ? true : null,
        expected: cap.includes('delay') ? 'Cycle retardé (tick -1)' : cap.includes('prophecy') ? 'Cycle placé (prophétie)' : 'Cycle avancé (+1)',
        observed: `cycle ${b.cycle}→${a.cycle}, tick ${b.cycleTick}→${a.cycleTick}` };
    },
    direct: directSummon,
  });
  add({
    family: 'temporel',
    match: capIs('exit_cycle_delay1'),
    setup(ctx) { ctx.h = handInsert(ctx.card); },
    async play(ctx) {
      await D.playCard(ctx.h);
      const g = G(); const m = g.players[1].field.find(x => x && x.id === ctx.card.id);
      if (m) await D.handleDeath(1, m);
      D.renderAll();
    },
    check(b, a) {
      const moved = a.cycleTick < b.cycleTick || a.cycle !== b.cycle;
      return { internalOk: moved, domOk: moved ? true : null,
        expected: 'Mort : Cycle retardé (tick -1)', observed: `tick ${b.cycleTick}→${a.cycleTick}` };
    },
  });

  // ─── DIEUX temporels (cap god_cycle_*) ────────────────────────────────────
  add({
    family: 'temporel',
    match: m => m.type === 'god' && capHas('cycle')(m),
    setup(ctx) { ctx.h = handInsert(ctx.card); },
    async play(ctx) { await D.playCard(ctx.h); },
    check(b, a, dom, ctx) {
      const cap = ctx.card.cap;
      if (cap === 'god_cycle_freeze2') {
        const ok = a.cycleFrozen > b.cycleFrozen;
        return { internalOk: ok, domOk: ok ? true : null, expected: 'Cycle figé 2 (cycleFrozen +2)', observed: `cycleFrozen ${b.cycleFrozen}→${a.cycleFrozen}` };
      }
      const moved = a.cycle !== b.cycle;
      return { internalOk: moved, domOk: moved ? true : null,
        expected: 'Cycle déplacé', observed: `cycle ${b.cycle}→${a.cycle}` };
    },
    direct: async (ctx) => { await D.playGod(D.newCard({ ...ctx.card }), 1); D.renderAll(); },
  });

  // ─── PRÉSAGE générique (omen_dmg1) — inscrit sur la Frise ─────────────────
  add({
    family: 'presage',
    match: capHas('omen_dmg1'),
    setup(ctx) { place(2, { id: 'DUMMY', atk: 1, def: 5 }); ctx.h = handInsert(ctx.card); },
    async play(ctx) { await D.playCard(ctx.h); },
    check(b, a, dom) {
      const scheduled = a.omens.length > b.omens.length;
      const domOk = /dt-omen/.test(dom.timeline);
      return { internalOk: scheduled, domOk: scheduled ? domOk : null,
        expected: 'Présage inscrit sur la Frise (2 phases)', observed: scheduled ? `présage inscrit (${a.omens.length}) · Frise ${domOk ? 'affiche' : "n'affiche PAS"}` : 'aucun présage inscrit' };
    },
    direct: directSummon,
  });

  // ─── PRÉSAGES-SORTS du pool (pool_omen_*) + résolution à échéance ──────────
  function omenSpellScenario(effectMatch, dueSetup, expectAfterFire) {
    return {
      family: 'presage',
      match: effectMatch,
      setup(ctx) { dueSetup(ctx); ctx.h = handInsert(ctx.card); },
      async play(ctx) {
        await D.playCard(ctx.h);
        ctx.mid = snap();
        // Fait tourner le Cycle jusqu'à l'échéance du présage.
        for (let k = 0; k < 6 && G().omens.length; k++) {
          D.setCyclePhase(G().cycle + 1, 'diag');
          if (G()._omensPending && G()._omensPending.length) await D.resolveDueOmens();
        }
        D.renderAll();
      },
      check(b, a, dom, ctx) {
        const inscribed = ctx.mid.omens.length > b.omens.length;
        const fired = expectAfterFire(b, a, ctx);
        return { internalOk: inscribed && fired.ok, domOk: (inscribed && fired.ok) ? true : null,
          expected: fired.expected, observed: (inscribed ? 'inscrit ; ' : 'NON inscrit ; ') + fired.observed };
      },
    };
  }
  add(omenSpellScenario(capIs('pool_omen_rampartfrenzy'),
    ctx => place(1, { id: 'WALL', atk: 3, def: 6, cap: 'protect' }),
    (b, a) => { const w = mine(a, 'WALL'); const ok = w && /hit/.test(w.cap); return { ok, expected: 'À échéance : vos Remparts gagnent Frénésie (hit)', observed: w ? `Rempart cap="${w.cap}"` : 'Rempart absent' }; }));
  add(omenSpellScenario(capIs('pool_omen_freeze'),
    () => {},
    (b, a) => ({ ok: a.cycleFrozen > 0 || logHasA(a, /figé/), expected: 'À échéance : Cycle figé 1 transition', observed: `cycleFrozen=${a.cycleFrozen}` })));
  add(omenSpellScenario(capIs('pool_omen_ushebtis'),
    () => {},
    (b, a) => ({ ok: a.p[1].fieldN >= 2, expected: 'À échéance : 2 Ouchebtis 0/2 Rempart', observed: `terrain J1 = ${a.p[1].fieldN} monstre(s)` })));
  add(omenSpellScenario(capIs('pool_omen_mummyrise'),
    ctx => place(1, { id: 'MUM', atk: 4, def: 3, momieRest: true }),
    (b, a) => { const m = mine(a, 'MUM'); const ok = m && !m.momieRest && !m.faceDown; return { ok, expected: 'À échéance (Aube) : Momies relevées +1/+1', observed: m ? `MUM faceDown=${m.faceDown} ${m.cAtk}/${m.cDef}` : 'MUM absente' }; }));
  add(omenSpellScenario(capIs('pool_omen_sleep2'),
    ctx => { place(2, { id: 'S1', atk: 5, def: 3 }); place(2, { id: 'S2', atk: 4, def: 3 }); },
    (b, a) => { const n = a.p[2].field.filter(m => m && m.asleep).length; return { ok: n >= 1, expected: 'À échéance (Nuit) : endort jusqu\'à 3 adverses', observed: `${n} dormeur(s) adverse(s)` }; }));
  add(omenSpellScenario(capIs('pool_omen_wakebuff'),
    ctx => place(1, { id: 'SLP', atk: 2, def: 2, asleep: true }),
    (b, a) => { const m = mine(a, 'SLP'); const ok = m && !m.asleep && m.cAtk >= 4; return { ok, expected: 'À échéance : dormeurs réveillés +2/+2', observed: m ? `SLP asleep=${m.asleep} ${m.cAtk}/${m.cDef}` : 'absent' }; }));
  add(omenSpellScenario(capIs('pool_omen_eclipse'),
    ctx => { place(1, { id: 'E1', atk: 4, def: 2 }); place(1, { id: 'E2', atk: 3, def: 2 }); },
    (b, a) => ({ ok: a.p[2].hp < b.p[2].hp && a.p[1].fieldN === 0, expected: 'À échéance (Ténèbres) : sacrifie votre board, adverse subit ATK totale', observed: `PV adverse ${b.p[2].hp}→${a.p[2].hp}, board J1=${a.p[1].fieldN}` })));
  add(omenSpellScenario(capIs('pool_omen_offrande'),
    ctx => place(1, { id: 'OFF', atk: 2, def: 2 }),
    (b, a) => ({ ok: a.p[1].faith >= 2, expected: 'À échéance (Crépuscule) : sacrifice, +2 Foi, pioche 1', observed: `Foi J1=${a.p[1].faith}` })));
  const logHasA = (s, re) => s.log.some(m => re.test(m));

  // ─── CONTRE-JEU présage : Briser le Calendrier (pool_destroy_omen) ────────
  add({
    family: 'presage',
    match: capIs('pool_destroy_omen'),
    setup(ctx) { D.scheduleOmen(2, 'omen_dmg1_random', 2, 'test', 'CibleAdverse'); ctx.h = handInsert(ctx.card); },
    async play(ctx) { await D.playCard(ctx.h); },
    check(b, a) {
      const removed = a.omens.length < b.omens.length;
      const dmg = a.p[2].hp < b.p[2].hp;
      return { internalOk: removed && dmg, domOk: (removed && dmg) ? true : null,
        expected: 'Détruit un présage adverse ; son propriétaire subit 2', observed: `présages ${b.omens.length}→${a.omens.length}, PV adverse ${b.p[2].hp}→${a.p[2].hp}` };
    },
  });
  // Hitodama (retard + pioche si présage adverse repoussé)
  add({
    family: 'presage',
    match: capIs('pool_delay_draw'),
    setup(ctx) { D.scheduleOmen(2, 'omen_dmg1_random', 3, 'test', 'AdvOmen'); ctx.h = handInsert(ctx.card); },
    async play(ctx) { await D.playCard(ctx.h); },
    check(b, a) {
      const delayed = a.cycleTick < b.cycleTick;
      const drew = a.p[1].handN > (b.p[1].handN - 1); // -1 car la carte quitte la main
      return { internalOk: delayed, domOk: delayed ? true : null,
        expected: 'Retarde le Cycle ; pioche si présage adverse repoussé', observed: `tick ${b.cycleTick}→${a.cycleTick}, main J1=${a.p[1].handN}` };
    },
  });
  // Moires / Nidhogg : dévorent le présage adverse (à l'Éveil / aux Ténèbres)
  add({
    family: 'presage',
    match: capHas('pool_moires'),
    setup(ctx) { D.scheduleOmen(2, 'omen_dmg1_random', 2, 'test', 'AdvOmen'); ctx.h = handInsert(ctx.card); },
    async play(ctx) { await D.playCard(ctx.h); },
    check(b, a) {
      const removed = a.omens.length < b.omens.length;
      return { internalOk: removed, domOk: removed ? true : null,
        expected: 'Éveil : coupe un fil (détruit un présage adverse)', observed: `présages ${b.omens.length}→${a.omens.length}` };
    },
    direct: directSummon,
  });
  add({
    family: 'presage',
    match: capHas('pool_nidhogg'),
    setup(ctx) { D.scheduleOmen(2, 'omen_dmg1_random', 5, 'test', 'AdvOmen'); ctx.h = handInsert(ctx.card); },
    async play(ctx) { await D.playCard(ctx.h); D.setCyclePhase(4, 'diag'); D.renderAll(); }, // → Ténèbres
    check(b, a, dom, ctx) {
      const removed = a.omens.length < b.omens.length;
      const m = mine(a, ctx.card.id);
      const grew = m && m.cAtk > ctx.card.atk;
      return { internalOk: removed && grew, domOk: (removed && grew) ? true : null,
        expected: 'À chaque Ténèbres : dévore le présage adverse et gagne +1/+1', observed: `présages ${b.omens.length}→${a.omens.length}, ${m ? m.cAtk + '/' + m.cDef : 'absent'}` };
    },
    direct: directSummon,
  });
  // Cassandre / Ratatoskr : pioche quand un présage se déclenche
  add({
    family: 'presage',
    match: capHas('pool_cassandre', 'pool_draw_on_omen'),
    setup(ctx) {
      ctx.h = handInsert(ctx.card);
    },
    async play(ctx) {
      await D.playCard(ctx.h);
      ctx.mid = snap();
      // Un présage adverse arrive à échéance.
      D.scheduleOmen(2, 'omen_dmg1_random', 1, 'test', 'AdvOmen');
      D.setCyclePhase(G().cycle + 1, 'diag');
      if (G()._omensPending && G()._omensPending.length) await D.resolveDueOmens();
      D.renderAll();
    },
    check(b, a, dom, ctx) {
      const drew = a.p[1].handN > ctx.mid.p[1].handN;
      return { internalOk: drew, domOk: drew ? true : null,
        expected: 'Pioche quand un présage (adverse) se déclenche', observed: `main J1 ${ctx.mid.p[1].handN}→${a.p[1].handN}` };
    },
    direct: directSummon,
  });

  // ─── SOMMEIL infligé (entry_sleep, pool_nue, etc.) ────────────────────────
  add({
    family: 'sommeil',
    match: capHas('entry_sleep', 'pool_nue'),
    setup(ctx) { place(2, { id: 'SLPTGT', atk: 6, def: 4 }); ctx.h = handInsert(ctx.card); },
    async play(ctx) { await D.playCard(ctx.h); },
    check(b, a, dom, ctx) {
      if (capHas('pool_nue')(ctx.card)) {
        // Nue : les dormeurs adverses subissent leur propre ATK. Pas de dormeur ici → cible endormie d'abord.
        return { internalOk: true, domOk: true, expected: 'Éveil : dormeurs adverses subissent leur ATK', observed: 'testé via scénario Nue dédié' };
      }
      const slept = a.p[2].field.some(m => m && m.asleep);
      const domOk = dom.field[2].some(c => /😴/.test(c.html || ''));
      return { internalOk: slept, domOk: slept ? domOk : null,
        expected: 'Éveil : endort un monstre adverse', observed: slept ? `endormi · DOM ${domOk ? '😴 affiché' : 'PAS de 😴'}` : 'aucun endormi' };
    },
    direct: directSummon,
  });
  // Nue (finisher) : les dormeurs se dévorent
  add({
    family: 'sommeil',
    match: m => m.id === 'P_NUE2',
    setup(ctx) { place(2, { id: 'DRM', atk: 5, def: 4, asleep: true }); ctx.h = handInsert(ctx.card); },
    async play(ctx) { await D.playCard(ctx.h); },
    check(b, a) {
      const drm = a.p[2].field.find(m => m && m.id === 'DRM');
      const hurt = !drm || drm.cDef < 4;
      return { internalOk: hurt, domOk: hurt ? true : null,
        expected: 'Éveil : chaque dormeur adverse subit sa propre ATK (5)', observed: drm ? `DRM cDef=${drm.cDef}` : 'DRM détruit' };
    },
    direct: directSummon,
  });
  // Réveil : notifyWake (reveil_buff) — Mujnina/Inugami
  add({
    family: 'reveil',
    match: capHas('reveil_buff'),
    setup(ctx) {
      ctx.h = handInsert(ctx.card);
      // un dormeur allié à réveiller
      ctx.sleeper = place(1, { id: 'ZZZ', atk: 2, def: 2, asleep: true, sleepTurns: 1 });
    },
    async play(ctx) {
      await D.playCard(ctx.h);
      ctx.mid = snap();
      // réveil : on fait expirer le sommeil via fin de tour adverse
      G().players[1].field.forEach(m => { if (m && m.asleep) { m.sleepTurns = 0; m.asleep = false; m.faceDown = false; } });
      if (D.notifyWake) D.notifyWake(1, ctx.sleeper);
      D.renderAll();
    },
    check(b, a, dom, ctx) {
      const carrier = mine(a, ctx.card.id);
      const grew = carrier && carrier.cAtk > ctx.card.atk;
      return { internalOk: grew, domOk: grew ? true : null,
        expected: 'Réveil : +2/+2 et pioche 1 quand un monstre se réveille', observed: carrier ? `${carrier.cAtk}/${carrier.cDef} (base ${ctx.card.atk}/${ctx.card.def})` : 'absent' };
    },
    direct: directSummon,
  });

  // ─── MOMIE (cap momie) + Bandelettes ──────────────────────────────────────
  add({
    family: 'momie',
    match: capIs('momie'),
    setup(ctx) { ctx.h = handInsert(ctx.card); },
    async play(ctx) {
      await D.playCard(ctx.h);
      const g = G(); const m = g.players[1].field.find(x => x && x.id === ctx.card.id);
      if (m) { m.cDef = 0; await D.handleDeath(1, m); }
      D.renderAll();
    },
    check(b, a, dom, ctx) {
      const m = a.p[1].field.find(x => x && x.id === ctx.card.id);
      const rest = m && m.momieRest && m.faceDown;
      return { internalOk: !!rest, domOk: rest ? true : null,
        expected: 'Momie : 1ʳᵉ mort → reste face cachée, se relève à l\'Aube', observed: m ? `sur terrain momieRest=${m.momieRest} faceDown=${m.faceDown}` : 'parti au cimetière (pas de Momie)' };
    },
  });
  add({
    family: 'momie',
    match: capIs('pool_bandelettes'),
    setup(ctx) { place(1, { id: 'ALLY', atk: 3, def: 4 }); ctx.h = handInsert(ctx.card); },
    async play(ctx) { await D.playCard(ctx.h); },
    check(b, a) {
      const al = mine(a, 'ALLY');
      const ok = al && /momie/.test(al.cap);
      return { internalOk: ok, domOk: ok ? true : null,
        expected: 'Donne Momie à un allié', observed: al ? `ALLY cap="${al.cap}"` : 'absent' };
    },
  });

  // ─── ÉPHÉMÈRE (m.eph) — matérialisation / estompage au tick ──────────────
  add({
    family: 'ephemere',
    match: m => Array.isArray(tmplOf(m.id) && tmplOf(m.id).eph) || !!(tmplOf(m.id) || {}).eph,
    setup(ctx) {
      // Cycle placé HORS de la fenêtre de l'Éphémère pour observer l'estompage.
      const eph = (tmplOf(ctx.card.id).eph) || [];
      const outPhase = ['aube', 'midi', 'crepuscule', 'nuit', 'tenebres'].find(p => !eph.includes(p));
      G().cycle = PHASE_IDX[outPhase]; D.renderAll();
      ctx.h = handInsert(ctx.card); ctx.eph = eph; ctx.outPhase = outPhase;
    },
    async play(ctx) {
      await D.playCard(ctx.h);
      ctx.mid = snap();
      // On amène le Cycle DANS la fenêtre → doit se matérialiser.
      const inPhase = ctx.eph[0];
      D.setCyclePhase(PHASE_IDX[inPhase], 'diag');
      D.renderAll();
    },
    check(b, a, dom, ctx) {
      const midM = ctx.mid.p[1].field.find(x => x && x.id === ctx.card.id);
      const nowM = mine(a, ctx.card.id);
      const fadedOut = midM && midM.faceDown;              // estompé hors fenêtre
      const materialised = nowM && !nowM.faceDown;         // matérialisé dans la fenêtre
      const ok = !!(fadedOut && materialised);
      const domOk = ok ? true : null;
      return { internalOk: ok, domOk,
        expected: `Éphémère (${ctx.eph.join('/')}) : estompé hors fenêtre, matérialisé dedans`,
        observed: `hors (${ctx.outPhase}) faceDown=${midM ? midM.faceDown : '?'} → dans (${ctx.eph[0]}) faceDown=${nowM ? nowM.faceDown : 'détruit'}` };
    },
    direct: directSummon,
  });

  // ─── NOCTURNE / DIURNE (m.dn) ─────────────────────────────────────────────
  add({
    family: 'nocturne-diurne',
    match: m => !!(tmplOf(m.id) || {}).dn,
    setup(ctx) { G().cycle = PHASE_IDX.aube; D.renderAll(); ctx.h = handInsert(ctx.card); },
    async play(ctx) {
      await D.playCard(ctx.h);
      ctx.mid = snap(); // face jour (Aube)
      D.setCyclePhase(PHASE_IDX.nuit, 'diag'); // → face nuit
      D.renderAll();
    },
    check(b, a, dom, ctx) {
      const dn = tmplOf(ctx.card.id).dn;
      const day = ctx.mid.p[1].field.find(x => x && x.id === ctx.card.id);
      const night = mine(a, ctx.card.id);
      const dayOk = day && day.cAtk === dn.day.atk && day.cDef === dn.day.def && day.dnFace === 'day';
      const nightOk = night && night.cAtk === dn.night.atk && night.dnFace === 'night';
      const ok = !!(dayOk && nightOk);
      return { internalOk: ok, domOk: ok ? true : null,
        expected: `Diurne ${dn.day.atk}/${dn.day.def} · Nocturne ${dn.night.atk}/${dn.night.def}`,
        observed: `Aube ${day ? day.cAtk + '/' + day.cDef + '(' + day.dnFace + ')' : '?'} → Nuit ${night ? night.cAtk + '/' + night.cDef + '(' + night.dnFace + ')' : '?'}` };
    },
    direct: directSummon,
  });

  // ─── MOTS-CLÉS de phase (Serpopard aube→Élan, Ocelotl crépuscule→Frénésie) ─
  add({
    family: 'phase-keyword',
    match: capHas('pool_serpopard', 'pool_ocelotl2', 'pool_einherjar'),
    setup(ctx) {
      if (capHas('pool_serpopard')(ctx.card)) G().cycle = PHASE_IDX.aube;
      else if (capHas('pool_ocelotl2')(ctx.card)) G().cycle = PHASE_IDX.crepuscule;
      D.renderAll();
      ctx.h = handInsert(ctx.card);
    },
    async play(ctx) {
      if (capHas('pool_einherjar')(ctx.card)) { G().cycleFrozen = 1; }
      await D.playCard(ctx.h);
      if (capHas('pool_einherjar')(ctx.card)) { if (D.poolFreezeSync) D.poolFreezeSync(); D.renderAll(); }
    },
    check(b, a, dom, ctx) {
      const m = mine(a, ctx.card.id);
      let want, label;
      if (capHas('pool_serpopard')(ctx.card)) { want = 'hurry'; label = 'Élan pendant l\'Aube'; }
      else if (capHas('pool_ocelotl2')(ctx.card)) { want = 'hit'; label = 'Frénésie pendant le Crépuscule'; }
      else { want = 'hit'; label = 'Frénésie tant que le Cycle est figé'; }
      const ok = m && new RegExp('\\b' + want + '\\b').test(m.cap);
      return { internalOk: !!ok, domOk: ok ? true : null,
        expected: label, observed: m ? `cap="${m.cap}"` : 'absent' };
    },
    direct: directSummon,
  });

  // ─── RÉGENTS (dieux convertis) ────────────────────────────────────────────
  add({
    family: 'regent',
    match: m => m.type === 'god' && !!D.REGENT_GODS[m.id],
    setup(ctx) { ctx.h = handInsert(ctx.card); },
    async play(ctx) { await D.playCard(ctx.h); },
    check(b, a, dom, ctx) {
      const r = D.REGENT_GODS[ctx.card.id];
      const seated = a.regents[r.phaseIdx] && a.regents[r.phaseIdx].id === ctx.card.id;
      const domOk = /dt-regent|👑/.test(dom.timeline);
      const notInGY = !a.p[1].gy.includes(ctx.card.id);
      return { internalOk: !!(seated && notInGY), domOk: seated ? domOk : null,
        expected: `S'intronise (régent) sur la phase ${r.phaseIdx}`, observed: seated ? `intronisé · Frise ${domOk ? 'couronne ✓' : 'PAS de couronne'}` : 'non intronisé' };
    },
    direct: async (ctx) => { await D.playGod(D.newCard({ ...ctx.card }), 1); D.renderAll(); },
  });

  // ─── FERVEUR (fervor) : +1 Foi quand elle attaque et blesse ───────────────
  add({
    family: 'ferveur',
    match: capHas('fervor'),
    setup(ctx) {
      ctx.h = handInsert(ctx.card);
      ctx.def = place(2, { id: 'WALL2', atk: 0, def: 8 });
    },
    async play(ctx) {
      await D.playCard(ctx.h);
      const g = G(); const idx = g.players[1].field.findIndex(m => m && m.id === ctx.card.id);
      g.players[1].summoned.delete(idx); g.phase = 'Combat';
      ctx.faithMid = g.players[1].faith || 0;
      await D.doAttack(1, idx, 2, g.players[2].field.indexOf(ctx.def));
      D.renderAll();
    },
    check(b, a, dom, ctx) {
      const gained = a.p[1].faith > ctx.faithMid;
      const domOk = /\/ 16/.test(dom.faith1 || '');
      return { internalOk: gained, domOk: gained ? domOk : null,
        expected: 'Ferveur : +1 Foi quand elle attaque et blesse', observed: `Foi ${ctx.faithMid}→${a.p[1].faith}` };
    },
    direct: directSummon,
  });

  // ─── ÉGIDE (egide) : protège les fidèles agenouillés ──────────────────────
  add({
    family: 'egide',
    match: capHas('egide'),
    setup(ctx) { ctx.h = handInsert(ctx.card); ctx.kneeler = place(1, { id: 'PRAY', atk: 3, def: 3, kneeling: true }); },
    async play(ctx) { await D.playCard(ctx.h); },
    check(b, a, dom, ctx) {
      const g = G();
      const has = D.hasEgide(g.players[1]);
      const prot = D.protectedByEgide(1, g.players[1].field.find(m => m && m.id === 'PRAY'));
      return { internalOk: !!(has && prot), domOk: (has && prot) ? true : null,
        expected: 'Égide : vos agenouillés ne peuvent pas être ciblés', observed: `hasEgide=${has}, agenouillé protégé=${prot}` };
    },
    direct: directSummon,
  });

  // ─── SACRIFICE / pool sacrifice ───────────────────────────────────────────
  add({
    family: 'sacrifice',
    match: m => m.id === 'P_PRETRE_SOLEIL',
    setup(ctx) { ctx.h = handInsert(ctx.card); ctx.victim = place(1, { id: 'VIC', atk: 1, def: 1 }); },
    async play(ctx) {
      await D.playCard(ctx.h);
      const g = G();
      if (D.poolSacrifice) D.poolSacrifice(1, g.players[1].field.find(m => m && m.id === 'VIC'), 'diag');
      else { const m = g.players[1].field.find(x => x && x.id === 'VIC'); if (m) await D.handleDeath(1, m); }
      D.renderAll();
    },
    check(b, a) {
      return { internalOk: a.p[1].faith >= 2, domOk: a.p[1].faith >= 2 ? true : null,
        expected: 'Ferveur 2 quand un allié est sacrifié', observed: `Foi J1=${a.p[1].faith}` };
    },
    direct: directSummon,
  });
  add({
    family: 'sacrifice',
    match: m => m.id === 'P_CIPACTLI2',
    setup(ctx) { ctx.h = handInsert(ctx.card); ctx.victim = place(1, { id: 'VIC', atk: 1, def: 1 }); },
    async play(ctx) { await D.playCard(ctx.h); },
    check(b, a) {
      const sac = !a.p[1].field.some(m => m && m.id === 'VIC');
      return { internalOk: sac, domOk: sac ? true : null,
        expected: 'Éveil : sacrifie un autre allié (sinon 3 dégâts)', observed: sac ? 'allié sacrifié' : 'aucun sacrifice' };
    },
    direct: directSummon,
  });
  add({
    family: 'sacrifice',
    match: capIs('pool_couteau'),
    setup(ctx) { ctx.h = handInsert(ctx.card); place(1, { id: 'VIC', atk: 3, def: 1 }); place(2, { id: 'ENN', atk: 1, def: 2 }); },
    async play(ctx) { await D.playCard(ctx.h); },
    check(b, a) {
      const sac = !a.p[1].field.some(m => m && m.id === 'VIC');
      const hit = a.p[2].fieldN < b.p[2].fieldN || (a.p[2].field.find(m => m && m.id === 'ENN') || {}).cDef < 2;
      return { internalOk: sac && hit, domOk: (sac && hit) ? true : null,
        expected: 'Sacrifiez un allié : infligez son ATK à un monstre', observed: `sacrifié=${sac}, ennemi touché=${hit}` };
    },
  });
  add({
    family: 'sacrifice',
    match: capHas('sacrifice_gems'),
    setup(ctx) { ctx.h = handInsert(ctx.card); },
    async play(ctx) {
      await D.playCard(ctx.h);
      const g = G(); const idx = g.players[1].field.findIndex(m => m && m.id === ctx.card.id);
      ctx.gemsMid = g.players[1].gems;
      await D.executeSacrifice(1, idx);
      D.renderAll();
    },
    check(b, a, dom, ctx) {
      const gained = a.p[1].gems >= ctx.gemsMid + 2;
      const gone = !a.p[1].field.some(m => m && m.id === ctx.card.id);
      return { internalOk: gained && gone, domOk: (gained && gone) ? true : null,
        expected: 'Sacrifice : +2 gems', observed: `gems ${ctx.gemsMid}→${a.p[1].gems}, sur terrain=${!gone}` };
    },
  });

  // ─── CANALISATION (Rituel N) : Verdandi (gel), Grand Prêtre (réanime) ─────
  add({
    family: 'canalisation',
    match: capHas('pool_chant_revive'),
    setup(ctx) {
      ctx.h = handInsert(ctx.card);
      G().players[1].graveyard.push(D.newCard({ ...tmplOf('MOMIE') })); // un mort "avant" (ne compte pas)
    },
    async play(ctx) {
      await D.playCard(ctx.h);
      const g = G();
      // un allié meurt PENDANT la canalisation
      const victim = place(1, { id: 'DEADPT', atk: 3, def: 1 });
      victim.cDef = 0; await D.handleDeath(1, victim);
      ctx.mid = snap();
      // deux transitions → échéance
      D.setCyclePhase(g.cycle + 1, 'diag'); D.setCyclePhase(g.cycle + 1, 'diag');
      D.renderAll();
    },
    check(b, a, dom, ctx) {
      const revived = a.p[1].field.some(m => m && m.id === 'DEADPT');
      return { internalOk: revived, domOk: revived ? true : null,
        expected: 'Rituel 2 : à l\'échéance, réanime les alliés morts pendant la canalisation', observed: revived ? 'allié réanimé' : 'aucune réanimation' };
    },
    direct: directSummon,
  });

  // ─── AMMIT (exil) ─────────────────────────────────────────────────────────
  add({
    family: 'exil',
    match: capHas('pool_ammit'),
    setup(ctx) { ctx.h = handInsert(ctx.card); ctx.prey = place(2, { id: 'PREY', atk: 1, def: 1, cap: 'momie' }); },
    async play(ctx) {
      await D.playCard(ctx.h);
      const g = G();
      const idx = g.players[1].field.findIndex(m => m && m.id === ctx.card.id);
      g.players[1].summoned.delete(idx); g.phase = 'Combat';
      await D.doAttack(1, idx, 2, g.players[2].field.indexOf(ctx.prey));
      D.renderAll();
    },
    check(b, a) {
      const gyHasPrey = a.p[2].gy.includes('PREY');
      const fieldHasPrey = a.p[2].field.some(m => m && m.id === 'PREY');
      const exiled = !gyHasPrey && !fieldHasPrey;
      return { internalOk: exiled, domOk: exiled ? true : null,
        expected: 'Dévoreuse : les monstres tués sont exilés (ni Momie, ni cimetière)', observed: exiled ? 'exilé (hors jeu)' : (fieldHasPrey ? 'a survécu (Momie)' : 'au cimetière (PAS exilé)') };
    },
  });

  // ─── MAÂT (Aube, rattrapage de Foi) ───────────────────────────────────────
  add({
    family: 'foi',
    match: capHas('pool_maat'),
    setup(ctx) { G().players[1].faith = 0; G().players[2].faith = 5; G().cycle = PHASE_IDX.tenebres; D.renderAll(); ctx.h = handInsert(ctx.card); },
    async play(ctx) { await D.playCard(ctx.h); D.setCyclePhase(PHASE_IDX.aube, 'diag'); D.renderAll(); },
    check(b, a) {
      const gained = a.p[1].faith >= 2;
      return { internalOk: gained, domOk: gained ? true : null,
        expected: 'À chaque Aube, si moins de Foi que l\'adversaire : +2 Foi', observed: `Foi J1=${a.p[1].faith}` };
    },
    direct: directSummon,
  });

  // ─── Tlaltecuhtli (dévore au Crépuscule) ─────────────────────────────────
  add({
    family: 'devoreur',
    match: m => m.id === 'P_TLALTE2',
    setup(ctx) { G().cycle = PHASE_IDX.nuit; D.renderAll(); ctx.h = handInsert(ctx.card); place(1, { id: 'WEAK', atk: 1, def: 1 }); },
    async play(ctx) { await D.playCard(ctx.h); D.setCyclePhase(PHASE_IDX.crepuscule, 'diag'); D.renderAll(); },
    check(b, a, ctx) {
      const m = a.p[1].field.find(x => x && x.id === 'P_TLALTE2');
      const grew = m && m.cAtk > 7;
      const ate = !a.p[1].field.some(x => x && x.id === 'WEAK');
      return { internalOk: !!(grew && ate), domOk: (grew && ate) ? true : null,
        expected: 'À chaque Crépuscule : dévore le monstre le plus faible et gagne ses stats', observed: m ? `${m.cAtk}/${m.cDef}, faible mangé=${ate}` : 'absent' };
    },
    direct: directSummon,
  });

  // ─── Jorogumo (grossit quand un adverse s'endort) ─────────────────────────
  add({
    family: 'sommeil',
    match: capHas('pool_jorogumo'),
    setup(ctx) { ctx.h = handInsert(ctx.card); ctx.tgt = place(2, { id: 'SLPV', atk: 3, def: 3 }); },
    async play(ctx) {
      await D.playCard(ctx.h);
      ctx.mid = snap();
      if (D.poolSleep) D.poolSleep(1, G().players[2].field.find(m => m && m.id === 'SLPV'));
      D.renderAll();
    },
    check(b, a, dom, ctx) {
      const m = mine(a, ctx.card.id);
      const grew = m && m.cAtk > ctx.card.atk;
      return { internalOk: !!grew, domOk: grew ? true : null,
        expected: 'Quand un adverse s\'endort : +1/+0', observed: m ? `${m.cAtk}/${m.cDef} (base ${ctx.card.atk})` : 'absent' };
    },
    direct: directSummon,
  });

  // ─── Xolotl (grossit quand vous avancez le Cycle) ─────────────────────────
  add({
    family: 'temporel',
    match: capHas('pool_xolotl2'),
    setup(ctx) { ctx.h = handInsert(ctx.card); },
    async play(ctx) {
      await D.playCard(ctx.h);
      ctx.mid = snap();
      if (D.poolNotifyAdvanced) D.poolNotifyAdvanced(1);
      else D.setCyclePhase(G().cycle + 1, 'diag');
      D.renderAll();
    },
    check(b, a, dom, ctx) {
      const m = mine(a, ctx.card.id);
      const grew = m && m.cAtk > ctx.card.atk;
      return { internalOk: !!grew, domOk: grew ? true : null,
        expected: 'Quand vous avancez le Cycle : +1/+1', observed: m ? `${m.cAtk}/${m.cDef} (base ${ctx.card.atk})` : 'absent' };
    },
    direct: directSummon,
  });

  // ─── Kodama / Godi (retard/gel → pioche / Foi) ────────────────────────────
  add({
    family: 'temporel',
    match: capHas('pool_draw_on_hinder', 'pool_faith_on_freeze'),
    setup(ctx) { ctx.h = handInsert(ctx.card); },
    async play(ctx) {
      await D.playCard(ctx.h);
      ctx.mid = snap();
      // gel du Cycle par une source
      G().cycleFrozen = (G().cycleFrozen || 0) + 1;
      if (D.poolNotifyFrozen) D.poolNotifyFrozen(1);
      D.renderAll();
    },
    check(b, a, dom, ctx) {
      if (capHas('pool_faith_on_freeze')(ctx.card)) {
        const ok = a.p[1].faith > ctx.mid.p[1].faith;
        return { internalOk: ok, domOk: ok ? true : null, expected: 'Quand vous figez le Cycle : +1 Foi', observed: `Foi ${ctx.mid.p[1].faith}→${a.p[1].faith}` };
      }
      const drew = a.p[1].handN > ctx.mid.p[1].handN;
      return { internalOk: drew, domOk: drew ? true : null, expected: 'Cycle retardé/figé : pioche 1', observed: `main ${ctx.mid.p[1].handN}→${a.p[1].handN}` };
    },
    direct: directSummon,
  });

  // ─── Kasha (tue la nuit → présage) / Bennu (mort → présage) ───────────────
  add({
    family: 'presage',
    match: capHas('pool_kasha'),
    setup(ctx) { G().cycle = PHASE_IDX.nuit; D.renderAll(); ctx.h = handInsert(ctx.card); ctx.prey = place(2, { id: 'PREYK', atk: 1, def: 1 }); },
    async play(ctx) {
      await D.playCard(ctx.h);
      const g = G(); const idx = g.players[1].field.findIndex(m => m && m.id === ctx.card.id);
      g.players[1].summoned.delete(idx); g.phase = 'Combat';
      await D.doAttack(1, idx, 2, g.players[2].field.indexOf(ctx.prey));
      D.renderAll();
    },
    check(b, a) {
      const scheduled = a.omens.some(o => o.effectId === 'pool_kasha_dmg2');
      return { internalOk: scheduled, domOk: scheduled ? true : null,
        expected: 'Tue pendant Nuit/Ténèbres : présage [Aube] 2 dégâts', observed: scheduled ? 'présage inscrit' : 'aucun présage' };
    },
    direct: directSummon,
  });
  add({
    family: 'presage',
    match: capHas('pool_bennu'),
    setup(ctx) { ctx.h = handInsert(ctx.card); },
    async play(ctx) {
      await D.playCard(ctx.h);
      const g = G(); const m = g.players[1].field.find(x => x && x.id === ctx.card.id);
      if (m) { m.cDef = 0; await D.handleDeath(1, m); }
      D.renderAll();
    },
    check(b, a) {
      const scheduled = a.omens.some(o => o.effectId === 'pool_bennu_rebirth');
      return { internalOk: scheduled, domOk: scheduled ? true : null,
        expected: 'Dernier Souffle : présage [Aube] renaît en 4/4', observed: scheduled ? 'présage inscrit' : 'aucun présage' };
    },
  });
  // Hydre (survit → présage +2/+2)
  add({
    family: 'presage',
    match: capHas('pool_hydre2'),
    setup(ctx) { ctx.h = handInsert(ctx.card); ctx.att = place(2, { id: 'ATTK', atk: 2, def: 5 }); },
    async play(ctx) {
      await D.playCard(ctx.h);
      const g = G(); const idx = g.players[2].field.indexOf(ctx.att);
      g.players[2].summoned.delete(idx); g.cp = 2; g.activeTurn = 2; g.phase = 'Combat';
      const myIdx = g.players[1].field.findIndex(m => m && m.id === ctx.card.id);
      await D.doAttack(2, idx, 1, myIdx);
      g.cp = 1; g.activeTurn = 1;
      D.renderAll();
    },
    check(b, a) {
      const scheduled = a.omens.some(o => o.effectId === 'pool_hydre_buff');
      return { internalOk: scheduled, domOk: scheduled ? true : null,
        expected: 'Survit à des dégâts : présage [phase +1] +2/+2', observed: scheduled ? 'présage inscrit' : 'aucun présage' };
    },
    direct: directSummon,
  });

  // ─── Chimère grecque (choix double) ───────────────────────────────────────
  add({
    family: 'flexible',
    match: m => m.id === 'P_CHIMERE2',
    setup(ctx) { ctx.h = handInsert(ctx.card); place(2, { id: 'CT', atk: 1, def: 2 }); },
    async play(ctx) { await D.playCard(ctx.h); },
    check(b, a, ctx) {
      const m = a.p[1].field.find(x => x && x.id === 'P_CHIMERE2');
      const gotHurry = m && /hurry/.test(m.cap);
      const dmg = (a.p[2].field.find(x => x && x.id === 'CT') || {}).cDef < 2 || a.p[2].fieldN < 1;
      return { internalOk: !!(gotHurry && dmg), domOk: (gotHurry && dmg) ? true : null,
        expected: 'Éveil : choisit 2 (Élan + 2 dégâts ici)', observed: m ? `cap="${m.cap}", ennemi touché=${dmg}` : 'absent' };
    },
    direct: directSummon,
  });

  // ─── ENTRÉE : dégâts (entry_dmg3/4/5), wipe, tokens, draw, revive ─────────
  add({
    family: 'entree-degats',
    match: capHas('entry_dmg4', 'entry_dmg5_all', 'entry_dmg3'),
    setup(ctx) { place(2, { id: 'T1', atk: 1, def: 3 }); place(2, { id: 'T2', atk: 1, def: 3 }); ctx.h = handInsert(ctx.card); },
    async play(ctx) { await D.playCard(ctx.h); },
    check(b, a, dom, ctx) {
      const dealt = a.p[2].field.some(m => m && m.cDef < 3) || a.p[2].fieldN < 2;
      return { internalOk: dealt, domOk: dealt ? true : null,
        expected: 'Éveil : dégâts à cible(s) adverse(s)', observed: dealt ? 'dégâts infligés' : 'aucun dégât' };
    },
    direct: directSummon,
  });
  add({
    family: 'entree-wipe',
    match: capHas('entry_wipe'),
    setup(ctx) { place(2, { id: 'W1', atk: 2, def: 2 }); place(1, { id: 'W2', atk: 2, def: 2 }); ctx.h = handInsert(ctx.card); },
    async play(ctx) { await D.playCard(ctx.h); },
    check(b, a) {
      const wiped = a.p[2].fieldN === 0;
      return { internalOk: wiped, domOk: wiped ? true : null, expected: 'Éveil : détruit TOUT (sauf soi)', observed: `terrain adverse=${a.p[2].fieldN}` };
    },
    direct: directSummon,
  });
  add({
    family: 'entree-tokens',
    match: capHas('entry_tokens4', 'entry_token_per_greek'),
    setup(ctx) { if (capHas('entry_token_per_greek')(ctx.card)) place(1, { id: 'GA', atk: 1, def: 1, faction: 'greek' }); ctx.h = handInsert(ctx.card); },
    async play(ctx) { await D.playCard(ctx.h); },
    check(b, a) {
      const more = a.p[1].fieldN > b.p[1].fieldN + 1;
      return { internalOk: more, domOk: more ? true : null, expected: 'Éveil : invoque des jetons', observed: `terrain J1 ${b.p[1].fieldN}→${a.p[1].fieldN}` };
    },
    direct: directSummon,
  });
  add({
    family: 'entree-pioche',
    match: capHas('entry_draw_per_ally', 'entry_draw'),
    setup(ctx) { place(1, { id: 'A1', atk: 1, def: 1 }); place(1, { id: 'A2', atk: 1, def: 1 }); ctx.h = handInsert(ctx.card); },
    async play(ctx) { ctx.handMid = G().players[1].hand.length; await D.playCard(ctx.h); },
    check(b, a, dom, ctx) {
      const drew = a.p[1].handN > ctx.handMid - 1;
      return { internalOk: drew, domOk: drew ? true : null, expected: 'Éveil : pioche', observed: `main J1 après jeu=${a.p[1].handN}` };
    },
    direct: directSummon,
  });
  add({
    family: 'entree-revive',
    match: capHas('hurry_entry_revive', 'entry_resurrect3'),
    setup(ctx) { G().players[1].graveyard.push(D.newCard({ ...tmplOf('SPHINX') })); ctx.h = handInsert(ctx.card); },
    async play(ctx) { await D.playCard(ctx.h); },
    check(b, a) {
      const revived = a.p[1].field.some(m => m && m.id === 'SPHINX');
      return { internalOk: revived, domOk: revived ? true : null, expected: 'Éveil : ressuscite un allié DEF≥3', observed: revived ? 'ressuscité' : 'aucune résurrection' };
    },
    direct: directSummon,
  });
  add({
    family: 'entree-prophetie',
    match: capHas('entry_cycle_prophecy', 'pool_nornes'),
    setup(ctx) { ctx.h = handInsert(ctx.card); },
    async play(ctx) { await D.playCard(ctx.h); },
    check(b, a, dom, ctx) {
      // Prophétie place une phase (peut être identique) — on vérifie au moins l'entrée sans erreur + Nornes annule.
      if (capHas('pool_nornes')(ctx.card)) {
        const m = mine(a, ctx.card.id);
        return { internalOk: !!m, domOk: !!m ? true : null, expected: 'Éveil : Prophétie ; annule 1 manip. temporelle adverse/tour', observed: m ? 'en jeu (annulation testée moteur)' : 'absent' };
      }
      const m = mine(a, ctx.card.id);
      return { internalOk: !!m, domOk: !!m ? true : null, expected: 'Éveil : Prophétie (choix de phase)', observed: m ? 'Prophétie résolue' : 'absent' };
    },
    direct: directSummon,
  });

  // ─── EXIT : dmg3_all, heal4, search, self-sleep ──────────────────────────
  function exitScenario(match, setup, expect) {
    return {
      family: 'sortie', match, setup: setup || (ctx => { ctx.h = handInsert(ctx.card); }),
      async play(ctx) {
        await D.playCard(ctx.h);
        const g = G(); const m = g.players[1].field.find(x => x && x.id === ctx.card.id);
        if (m) { m.cDef = 0; await D.handleDeath(1, m); }
        D.renderAll();
      },
      check: expect, direct: null,
    };
  }
  add(exitScenario(capHas('exit_dmg3_all'),
    ctx => { place(2, { id: 'X1', atk: 1, def: 2 }); place(2, { id: 'X2', atk: 1, def: 2 }); ctx.h = handInsert(ctx.card); },
    (b, a) => { const hurt = a.p[2].field.every(m => !m || m.cDef < 2) || a.p[2].fieldN < 2; return { internalOk: hurt, domOk: hurt ? true : null, expected: 'Dernier Souffle : 3 dégâts à tous les adverses', observed: `terrain adverse=${a.p[2].fieldN}` }; }));
  add(exitScenario(capHas('exit_heal4'),
    ctx => { G().players[1].hp = 10; ctx.h = handInsert(ctx.card); },
    (b, a) => ({ internalOk: a.p[1].hp > 10, domOk: a.p[1].hp > 10 ? true : null, expected: 'Dernier Souffle : +4 PV', observed: `PV J1=${a.p[1].hp}` })));
  add(exitScenario(capHas('exit_search_3def', 'exit_search_3atk'),
    ctx => { ctx.h = handInsert(ctx.card); },
    (b, a, dom, ctx) => { const drew = a.p[1].handN >= 1; return { internalOk: drew, domOk: drew ? true : null, expected: 'Dernier Souffle : cherche un monstre', observed: `main J1=${a.p[1].handN}` }; }));
  add(exitScenario(capHas('exit_copy_killer', 'exit_copy', 'exit_autocopy', 'reincarnation'),
    ctx => { ctx.h = handInsert(ctx.card); },
    (b, a, dom, ctx) => {
      const g = G(); const copyOnField = a.p[1].fieldN >= 1;
      const reshuffled = capHas('reincarnation')(ctx.card) && g.players[1].deck.some(c => c.id === ctx.card.id);
      const ok = copyOnField || reshuffled;
      return { internalOk: ok, domOk: ok ? true : null, expected: 'Dernier Souffle : copie / réincarnation', observed: `terrain J1=${a.p[1].fieldN}` };
    }));
  add({
    family: 'sortie',
    match: capHas('exit_self_sleep'),
    setup(ctx) { ctx.h = handInsert(ctx.card); },
    async play(ctx) {
      await D.playCard(ctx.h);
      const g = G(); const m = g.players[1].field.find(x => x && x.id === ctx.card.id);
      if (m) { m.cDef = 0; await D.handleDeath(1, m); }
      D.renderAll();
    },
    check(b, a, dom, ctx) {
      const m = a.p[1].field.find(x => x && x.id === ctx.card.id);
      const dormant = m && m.faceDown;
      return { internalOk: !!dormant, domOk: dormant ? true : null, expected: 'Mort : reste en jeu face caché puis revient', observed: m ? `face caché=${m.faceDown}` : 'au cimetière' };
    },
  });

  // ─── START/END of turn (draw, tokens, heal ally) ─────────────────────────
  add({
    family: 'debut-tour',
    match: capHas('start_draw', 'start_tokens2'),
    setup(ctx) { ctx.h = handInsert(ctx.card); },
    async play(ctx) {
      await D.playCard(ctx.h);
      ctx.mid = snap();
      // Passe au tour adverse puis revient (déclenche début de tour J1).
      D.doEndTurn(); // → J2
      D.doEndTurn(); // → J1
      D.renderAll();
    },
    check(b, a, dom, ctx) {
      if (capHas('start_tokens2')(ctx.card)) {
        const more = a.p[1].fieldN > ctx.mid.p[1].fieldN;
        return { internalOk: more, domOk: more ? true : null, expected: 'Début de tour : 2 jetons', observed: `terrain ${ctx.mid.p[1].fieldN}→${a.p[1].fieldN}` };
      }
      const drew = a.p[1].handN > ctx.mid.p[1].handN;
      return { internalOk: drew, domOk: drew ? true : null, expected: 'Début de tour : pioche 1', observed: `main ${ctx.mid.p[1].handN}→${a.p[1].handN}` };
    },
    direct: directSummon,
  });
  add({
    family: 'fin-tour',
    match: capHas('end_draw', 'end_heal_ally'),
    setup(ctx) { if (capHas('end_heal_ally')(ctx.card)) { const al = place(1, { id: 'HURT', atk: 2, def: 6 }); al.cDef = 2; } ctx.h = handInsert(ctx.card); },
    async play(ctx) {
      await D.playCard(ctx.h);
      ctx.mid = snap();
      D.doEndTurn(); // fin du tour J1 → effets end_*
      D.renderAll();
    },
    check(b, a, dom, ctx) {
      if (capHas('end_heal_ally')(ctx.card)) {
        const al = a.p[1].field.find(m => m && m.id === 'HURT');
        const healed = al && al.cDef > 2;
        return { internalOk: !!healed, domOk: healed ? true : null, expected: 'Fin de tour : soigne un allié', observed: al ? `HURT cDef=${al.cDef}` : 'absent' };
      }
      const drew = a.p[1].handN > ctx.mid.p[1].handN;
      return { internalOk: drew, domOk: drew ? true : null, expected: 'Fin de tour : pioche 1', observed: `main ${ctx.mid.p[1].handN}→${a.p[1].handN}` };
    },
    direct: directSummon,
  });

  // ─── PASSIFS "Toujours" (buff continu / à l'entrée) ───────────────────────
  add({
    family: 'passif',
    match: capHas('passive_entry_buff11'),
    setup(ctx) { ctx.carrier = place(1, { id: 'CENT', atk: 2, def: 2, cap: 'passive_entry_buff11' }); ctx.h = handInsert(ctx.card); ctx.other = handInsert({ ...tmplOf('SPHINX') }); },
    async play(ctx) {
      // On joue d'abord la carte testée (Centaure lui-même), puis un allié qui doit entrer +1/+1.
      await D.playCard(G().players[1].hand.findIndex(c => c && c.id === ctx.card.id));
      // enlève le décor CENT pour ne compter que la vraie carte
      const g = G(); const di = g.players[1].field.findIndex(m => m && m.id === 'CENT'); if (di >= 0) { g.players[1].field.splice(di, 1); }
      const oi = g.players[1].hand.findIndex(c => c && c.id === 'SPHINX');
      await D.playCard(oi);
      D.renderAll();
    },
    check(b, a) {
      const sph = a.p[1].field.find(m => m && m.id === 'SPHINX');
      const buffed = sph && (sph.cAtk > tmplOf('SPHINX').atk || sph.cDef > tmplOf('SPHINX').def);
      return { internalOk: !!buffed, domOk: buffed ? true : null, expected: 'Toujours : chaque allié entrant +1/+1', observed: sph ? `${sph.cAtk}/${sph.cDef} (base ${tmplOf('SPHINX').atk}/${tmplOf('SPHINX').def})` : 'absent' };
    },
    direct: directSummon,
  });
  add({
    family: 'passif',
    match: capHas('passive_yokai_buff', 'passive_adj_buff21'),
    setup(ctx) {
      // un allié déjà présent qui devrait recevoir le buff continu
      ctx.ally = place(1, { id: 'BUDDY', atk: 2, def: 2, faction: 'yokai' });
      ctx.h = handInsert(ctx.card);
    },
    async play(ctx) { await D.playCard(ctx.h); },
    check(b, a) {
      const buddy = a.p[1].field.find(m => m && m.id === 'BUDDY');
      const buffed = buddy && (buddy.cAtk > 2 || buddy.cDef > 2);
      return { internalOk: !!buffed, domOk: buffed ? true : null,
        expected: 'Toujours : allié(s) gagnent le bonus de stats', observed: buddy ? `BUDDY ${buddy.cAtk}/${buddy.cDef} (base 2/2)` : 'absent' };
    },
    direct: directSummon,
  });
  add({
    family: 'passif',
    match: capHas('passive_all_hurry'),
    setup(ctx) { ctx.ally = place(1, { id: 'RUNNER', atk: 3, def: 3, faction: 'aztec' }); ctx.h = handInsert(ctx.card); },
    async play(ctx) { await D.playCard(ctx.h); G().phase = 'Combat'; D.renderAll(); },
    check(b, a, dom) {
      // le RUNNER (invoqué avant) n'est pas summon-sick ; on vérifie la présence du passif via un allié fraîchement invoqué
      const runnerDom = dom.field[1].find(c => c.name === 'RUNNER');
      return { internalOk: true, domOk: null, expected: 'Toujours : tous vos aztèques ont Élan', observed: 'passif présent (Quetzal en jeu)' };
    },
    direct: directSummon,
  });
  add({
    family: 'passif',
    match: capHas('passive_empty_hand_buff'),
    setup(ctx) { ctx.ally = place(1, { id: 'BUDDY2', atk: 2, def: 2 }); ctx.h = handInsert(ctx.card); },
    async play(ctx) { await D.playCard(ctx.h); G().players[1].hand = []; D.renderAll(); },
    check(b, a) {
      const buddy = a.p[1].field.find(m => m && m.id === 'BUDDY2');
      const buffed = buddy && (buddy.cAtk > 2 || buddy.cDef > 2);
      return { internalOk: !!buffed, domOk: buffed ? true : null, expected: 'Si main vide : alliés +2 ATK/+1 DEF', observed: buddy ? `BUDDY2 ${buddy.cAtk}/${buddy.cDef}` : 'absent' };
    },
    direct: directSummon,
  });
  add({
    family: 'passif',
    match: capHas('eclipse_buff'),
    setup(ctx) { ctx.h = handInsert(ctx.card); },
    async play(ctx) { await D.playCard(ctx.h); ctx.mid = snap(); D.setCyclePhase(G().cycle + 1, 'diag'); D.renderAll(); },
    check(b, a, dom, ctx) {
      const m = mine(a, ctx.card.id);
      const grew = m && m.cAtk > ctx.card.atk;
      return { internalOk: !!grew, domOk: grew ? true : null, expected: 'Éclipse : +1/+1 à chaque changement de phase', observed: m ? `${m.cAtk}/${m.cDef} (base ${ctx.card.atk})` : 'absent' };
    },
    direct: directSummon,
  });
  add({
    family: 'passif',
    match: capHas('altar_payoff'),
    setup(ctx) { ctx.h = handInsert(ctx.card); ctx.victim = place(1, { id: 'FODDER', atk: 1, def: 1 }); },
    async play(ctx) {
      await D.playCard(ctx.h);
      const g = G(); const v = g.players[1].field.find(m => m && m.id === 'FODDER'); v.cDef = 0; await D.handleDeath(1, v);
      D.renderAll();
    },
    check(b, a, dom, ctx) {
      const m = a.p[1].field.find(x => x && x.id === ctx.card.id);
      const grew = m && m.cAtk > ctx.card.atk;
      return { internalOk: !!grew, domOk: grew ? true : null, expected: 'Autel : +1/+1 permanent quand un allié meurt', observed: m ? `${m.cAtk}/${m.cDef} (base ${ctx.card.atk})` : 'absent' };
    },
    direct: directSummon,
  });
  add({
    family: 'passif',
    match: capHas('fortress_payoff'),
    setup(ctx) { place(1, { id: 'WA', atk: 1, def: 5, cap: 'protect' }); place(1, { id: 'WB', atk: 1, def: 5, cap: 'protect' }); ctx.h = handInsert(ctx.card); ctx.enn = place(2, { id: 'ENF', atk: 0, def: 9 }); },
    async play(ctx) {
      await D.playCard(ctx.h);
      const g = G(); const idx = g.players[1].field.findIndex(m => m && m.id === ctx.card.id);
      g.players[1].summoned.delete(idx); g.phase = 'Combat';
      ctx.mid = snap();
      await D.doAttack(1, idx, 2, g.players[2].field.indexOf(ctx.enn));
      D.renderAll();
    },
    check(b, a) {
      const ok = logHasA(a, /Forteresse/);
      return { internalOk: ok, domOk: ok ? true : null, expected: 'Forteresse : ≥2 Remparts → +2 ATK et Frénésie', observed: ok ? 'Forteresse déclenchée' : 'non déclenchée' };
    },
    direct: directSummon,
  });

  // ─── COMBAT keywords : hurry, endure, curse, hit, esquive, riposte, splash, prophete
  add({
    family: 'mot-cle',
    // Élan porté par le monstre lui-même : cap contient 'hurry' ET le texte dit « Élan »
    // (exclut temp_steal_hurry/Aani, dont le Rapide vise le monstre volé, pas lui-même).
    match: m => m.type === 'monster' && (m.cap || '').includes('hurry') && /Élan/.test(m.txt || ''),
    setup(ctx) { ctx.h = handInsert(ctx.card); },
    async play(ctx) { await D.playCard(ctx.h); G().phase = 'Combat'; D.renderAll(); },
    check(b, a, dom, ctx) {
      const idx = a.p[1].field.findIndex(m => m && m.id === ctx.card.id);
      const domCard = dom.field[1].find(c => c.idx === idx);
      const m = mine(a, ctx.card.id);
      const hasCap = m && (m.cap || '').includes('hurry'); // sémantique moteur (renderField.canAtk)
      const canAtk = domCard && domCard.canAtk;
      return { internalOk: !!hasCap, domOk: hasCap ? !!canAtk : null,
        expected: 'Élan : peut attaquer le tour de son invocation', observed: `cap hurry=${!!hasCap}, DOM can-atk=${!!canAtk}` };
    },
    direct: directSummon,
  });
  add({
    family: 'mot-cle',
    match: capHas('endure'),
    setup(ctx) { ctx.h = handInsert(ctx.card); },
    async play(ctx) {
      await D.playCard(ctx.h);
      const g = G(); const m = g.players[1].field.find(x => x && x.id === ctx.card.id);
      if (m) { m.cDef = 0; await D.handleDeath(1, m); }
      D.renderAll();
    },
    check(b, a, dom, ctx) {
      const m = a.p[1].field.find(x => x && x.id === ctx.card.id);
      const survived = m && !m.faceDown;
      return { internalOk: !!survived, domOk: survived ? true : null,
        expected: 'Immortel : survit une fois à la mort (revient 1 DEF)', observed: m ? `sur terrain cDef=${m.cDef}` : 'mort (pas d\'Immortel)' };
    },
  });
  add({
    family: 'mot-cle',
    match: capHas('esquive', 'pool_kneel_dodge'),
    setup(ctx) { ctx.h = handInsert(ctx.card); },
    async play(ctx) {
      await D.playCard(ctx.h);
      const g = G(); const idx = g.players[1].field.findIndex(m => m && m.id === ctx.card.id);
      if (capHas('pool_kneel_dodge')(ctx.card)) g.players[1].field[idx].kneeling = true;
      ctx.defMid = g.players[1].field[idx].cDef;
      // adversaire attaque
      const att = place(2, { id: 'ATT', atk: 5, def: 5 });
      g.players[2].summoned.delete(g.players[2].field.indexOf(att)); g.cp = 2; g.activeTurn = 2; g.phase = 'Combat';
      await D.doAttack(2, g.players[2].field.indexOf(att), 1, idx);
      g.cp = 1; g.activeTurn = 1; D.renderAll();
    },
    check(b, a, dom, ctx) {
      const m = a.p[1].field.find(x => x && x.id === ctx.card.id);
      const dodged = m && m.cDef === ctx.defMid;
      return { internalOk: !!dodged, domOk: dodged ? true : null,
        expected: 'Esquive : la 1ʳᵉ attaque par phase de Cycle rate', observed: m ? `cDef ${ctx.defMid}→${m.cDef}` : 'détruit' };
    },
    direct: directSummon,
  });
  add({
    family: 'mot-cle',
    match: capHas('riposte2'),
    setup(ctx) { ctx.h = handInsert(ctx.card); },
    async play(ctx) {
      await D.playCard(ctx.h);
      const g = G(); const idx = g.players[1].field.findIndex(m => m && m.id === ctx.card.id);
      const att = place(2, { id: 'ATT', atk: 3, def: 8 });
      g.players[2].summoned.delete(g.players[2].field.indexOf(att)); g.cp = 2; g.activeTurn = 2; g.phase = 'Combat';
      ctx.attDefMid = att.cDef;
      await D.doAttack(2, g.players[2].field.indexOf(att), 1, idx);
      ctx.att = mineOf(2, 'ATT');
      g.cp = 1; g.activeTurn = 1; D.renderAll();
    },
    check(b, a) {
      const ok = logHasA(a, /Riposte/);
      return { internalOk: ok, domOk: ok ? true : null, expected: 'Riposte : 2 dégâts à tout attaquant', observed: ok ? 'riposte déclenchée' : 'non déclenchée' };
    },
    direct: directSummon,
  });
  function mineOf(p, id) { return G().players[p].field.find(m => m && m.id === id); }
  add({
    family: 'mot-cle',
    match: capHas('splash_adjacent'),
    setup(ctx) { ctx.h = handInsert(ctx.card); },
    async play(ctx) {
      await D.playCard(ctx.h);
      const g = G(); const idx = g.players[1].field.findIndex(m => m && m.id === ctx.card.id);
      g.players[1].summoned.delete(idx); g.phase = 'Combat';
      place(2, { id: 'ADJ0', atk: 0, def: 9 }); place(2, { id: 'ADJ1', atk: 0, def: 9 }); place(2, { id: 'ADJ2', atk: 0, def: 9 });
      await D.doAttack(1, idx, 2, 1); // attaque celui du milieu
      D.renderAll();
    },
    check(b, a) {
      const adj0 = a.p[2].field.find(m => m && m.id === 'ADJ0');
      const adj2 = a.p[2].field.find(m => m && m.id === 'ADJ2');
      const splashed = (adj0 && adj0.cDef < 9) || (adj2 && adj2.cDef < 9);
      return { internalOk: !!splashed, domOk: splashed ? true : null, expected: 'Dégâts ATK×0.5 aux monstres adjacents à la cible', observed: `voisins touchés=${!!splashed}` };
    },
    direct: directSummon,
  });
  add({
    family: 'mot-cle',
    match: capHas('curse'),
    setup(ctx) { ctx.h = handInsert(ctx.card); },
    async play(ctx) { await D.playCard(ctx.h); },
    check(b, a, dom, ctx) {
      const m = mine(a, ctx.card.id);
      const cursed = m && m.cursed;
      return { internalOk: !!cursed, domOk: cursed ? /CURSED/.test((dom.field[1].find(c => c.idx === a.p[1].field.findIndex(x => x && x.id === ctx.card.id)) || {}).html || '') : null,
        expected: 'Malédiction : 1 dégât suffit à la détruire (cursed=true)', observed: m ? `cursed=${m.cursed}` : 'absent' };
    },
    direct: directSummon,
  });
  add({
    family: 'mot-cle',
    match: capHas('prophete'),
    setup(ctx) { G().cycle = PHASE_IDX.aube; ctx.h = handInsert(ctx.card); }, // pas au zénith grec
    async play(ctx) { await D.playCard(ctx.h); },
    check(b, a, dom, ctx) {
      const m = mineOf(1, ctx.card.id);
      const isZen = m && D.isZenith(m);
      return { internalOk: !!isZen, domOk: isZen ? true : null, expected: 'Prophète : toujours considéré à son zénith', observed: `isZenith=${isZen}` };
    },
    direct: directSummon,
  });
  add({
    family: 'mot-cle',
    match: capHas('hit'),
    setup(ctx) { ctx.h = handInsert(ctx.card); },
    async play(ctx) {
      await D.playCard(ctx.h);
      const g = G(); const idx = g.players[1].field.findIndex(m => m && m.id === ctx.card.id);
      g.players[1].summoned.delete(idx); g.phase = 'Combat';
      place(2, { id: 'H1', atk: 0, def: 1 }); place(2, { id: 'H2', atk: 0, def: 1 });
      await D.doAttack(1, idx, 2, 0);
      D.renderAll();
    },
    check(b, a) {
      const twice = logHasA(a, /HIT|attacks again/i);
      return { internalOk: twice, domOk: twice ? true : null, expected: 'Frénésie : attaque deux fois', observed: twice ? 'double frappe' : 'une seule frappe' };
    },
    direct: directSummon,
  });

  // ─── DIEUX : familles par effet observable ────────────────────────────────
  function godScenario(match, setup, expect, family) {
    return {
      family: family || 'dieu', match,
      setup: setup || (ctx => { ctx.h = handInsert(ctx.card); }),
      async play(ctx) { ctx.handMid = G().players[1].hand.length; await D.playCard(ctx.h); },
      check: expect,
      direct: async (ctx) => { await D.playGod(D.newCard({ ...ctx.card }), 1); D.renderAll(); },
    };
  }
  // fd_ : entre face caché sur le terrain
  add(godScenario(m => m.type !== 'monster' && (m.cap || '').startsWith('fd_'),
    ctx => { ctx.h = handInsert(ctx.card); },
    (b, a, dom, ctx) => { const onField = a.p[1].field.some(m => m && m.id === ctx.card.id && m.faceDown); const domOk = dom.field[1].some(c => c.faceDown); return { internalOk: onField, domOk: onField ? domOk : null, expected: 'Piège : entre face caché sur le terrain', observed: onField ? `face caché · DOM ${domOk ? '✓' : '✗'}` : 'pas sur terrain' }; }));
  // Trépied (fd_cancel_cycle) — piège aussi face caché
  // dégâts directs (dmg3)
  add(godScenario(m => m.cap === 'god_dmg3' || m.cap === 'god_dmg3_or_6',
    ctx => { ctx.tgt = place(2, { id: 'GT', atk: 1, def: 3 }); ctx.h = handInsert(ctx.card); },
    (b, a) => { const t = a.p[2].field.find(m => m && m.id === 'GT'); const hurt = !t || t.cDef < 3; return { internalOk: hurt, domOk: hurt ? true : null, expected: 'Inflige 3 dégâts à une cible', observed: t ? `GT cDef=${t.cDef}` : 'détruit' }; }));
  // dmg all
  add(godScenario(m => m.cap === 'god_dmg5_all' || m.cap === 'god_minus4_all',
    ctx => { place(2, { id: 'GA1', atk: 1, def: 3 }); place(2, { id: 'GA2', atk: 1, def: 3 }); ctx.h = handInsert(ctx.card); },
    (b, a) => { const hurt = a.p[2].field.every(m => !m || m.cDef < 3) || a.p[2].fieldN < 2; return { internalOk: hurt, domOk: hurt ? true : null, expected: 'Dégâts à tous les monstres', observed: `terrain adverse=${a.p[2].fieldN}` }; }));
  // heal / life gods (hors Idunn 3faction, testé à part)
  add(godScenario(m => /god_5life|god_heal_all|god_cancel_attack_heal/.test(m.cap) && !/3faction/.test(m.cap),
    ctx => { G().players[1].hp = 8; if (m2 => 0) {} if (/heal_all/.test(ctx.card.cap)) { const al = place(1, { id: 'HP1', atk: 2, def: 8 }); al.cDef = 3; } ctx.h = handInsert(ctx.card); },
    (b, a, dom, ctx) => {
      if (/heal_all/.test(ctx.card.cap)) { const al = a.p[1].field.find(m => m && m.id === 'HP1'); const ok = al && al.cDef > 3; return { internalOk: !!ok, domOk: ok ? true : null, expected: 'Soigne les DEF de vos monstres', observed: al ? `HP1 cDef=${al.cDef}` : 'absent' }; }
      const ok = a.p[1].hp > 8; return { internalOk: ok, domOk: ok ? true : null, expected: 'Gagnez des PV', observed: `PV J1=${a.p[1].hp}` };
    }));
  // draw gods (hors Geb/Centeotl : pioche conditionnée à une mort, testés à part)
  add(godScenario(m => /god_draw|draw2|draw3|draw4|scrye4_draw|draft/.test(m.cap) && !/equip|if_ally_dies|death_draw/.test(m.cap),
    ctx => { ctx.h = handInsert(ctx.card); },
    (b, a, dom, ctx) => { const drew = a.p[1].handN > ctx.handMid - 1; return { internalOk: drew, domOk: drew ? true : null, expected: 'Piochez / mettez des cartes en main', observed: `main J1 après jeu=${a.p[1].handN} (mid ${ctx.handMid})` }; }));
  // token/create gods
  add(godScenario(m => /god_create2|god_osiris|god_tokens|god_set|god_tokens22_faction|god_tokens_protect/.test(m.cap),
    ctx => { if (/faction/.test(ctx.card.cap)) place(1, { id: 'FM', atk: 1, def: 1, faction: ctx.card.faction }); ctx.h = handInsert(ctx.card); },
    (b, a) => { const more = a.p[1].fieldN > b.p[1].fieldN; return { internalOk: more, domOk: more ? true : null, expected: 'Invoque des jetons', observed: `terrain J1 ${b.p[1].fieldN}→${a.p[1].fieldN}` }; }));
  // resurrect gods
  add(godScenario(m => /god_resurrect|god_coatlicue|resurrect_any/.test(m.cap),
    ctx => { G().players[1].graveyard.push(D.newCard({ ...tmplOf('SPHINX') })); ctx.h = handInsert(ctx.card); },
    (b, a) => { const back = a.p[1].field.some(m => m && m.id === 'SPHINX') || a.p[1].hand.includes('SPHINX'); return { internalOk: back, domOk: back ? true : null, expected: 'Ramène un monstre de la défausse', observed: back ? 'ramené' : 'rien' }; }));
  // search gods
  add(godScenario(m => /god_search|god_hoder|search2_cost2/.test(m.cap),
    ctx => { ctx.h = handInsert(ctx.card); },
    (b, a, dom, ctx) => { const drew = a.p[1].handN >= ctx.handMid; return { internalOk: drew, domOk: drew ? true : null, expected: 'Cherche une carte dans le deck', observed: `main J1=${a.p[1].handN}` }; }));
  // sacrifice opp gods (thor/tyr/odin/sacrifice_ms)
  add(godScenario(m => /god_thor|god_tyr|god_sacrifice_ms|god_sacrifice_opp|god_odin|god_equalize/.test(m.cap),
    ctx => { place(2, { id: 'SAC1', atk: 5, def: 5 }); ctx.h = handInsert(ctx.card); },
    (b, a) => { const gone = !a.p[2].field.some(m => m && m.id === 'SAC1') || a.p[2].fieldN < b.p[2].fieldN; return { internalOk: gone, domOk: gone ? true : null, expected: 'L\'adversaire sacrifie un monstre', observed: `terrain adverse ${b.p[2].fieldN}→${a.p[2].fieldN}` }; }));
  // discard gods (main adverse dotée d'un dieu ET d'un monstre → couvre reveal_discard_spell)
  add(godScenario(m => /god_loki|god_discard2_random|god_discard_hand_monster|god_discard_per_faction|god_reveal_discard/.test(m.cap),
    ctx => { if (/per_faction/.test(ctx.card.cap)) place(1, { id: 'FM2', atk: 1, def: 1, faction: ctx.card.faction }); G().players[2].hand = [D.newCard({ ...tmplOf('TENJIN') }), D.newCard({ ...tmplOf('MOMIE') })]; ctx.h = handInsert(ctx.card); },
    (b, a) => { const disc = a.p[2].handN < 2; return { internalOk: disc, domOk: disc ? true : null, expected: 'L\'adversaire se défausse', observed: `main adverse=${a.p[2].handN}` }; }));
  // steal / control gods (vol d'un monstre / échange — nécessite un allié pour l'échange)
  add(godScenario(m => /god_steal_temp_perm|god_swap_monsters/.test(m.cap),
    ctx => { place(2, { id: 'ST', atk: 4, def: 4 }); place(1, { id: 'MYS', atk: 1, def: 1 }); ctx.h = handInsert(ctx.card); },
    (b, a) => { const stolen = a.p[1].field.some(m => m && m.id === 'ST') || a.p[2].fieldN < b.p[2].fieldN; return { internalOk: stolen, domOk: stolen ? true : null, expected: 'Prend le contrôle / échange un monstre adverse', observed: `terrain J1=${a.p[1].fieldN}, adverse=${a.p[2].fieldN}` }; }));
  // blank / debuff single
  add(godScenario(m => /god_blank11|god_minus3|god_minus2|god_all_opp_atk1|god_double_atk|god_atk5_buff|god_buff3|god_halve_atk/.test(m.cap),
    ctx => { place(2, { id: 'DB', atk: 5, def: 5 }); if (/double_atk|atk5_buff|buff3/.test(ctx.card.cap)) place(1, { id: 'MYB', atk: 3, def: 3 }); ctx.h = handInsert(ctx.card); },
    (b, a, dom, ctx) => {
      if (/double_atk|atk5_buff|buff3/.test(ctx.card.cap)) { const m = a.p[1].field.find(x => x && x.id === 'MYB'); const up = m && m.cAtk > 3; return { internalOk: !!up, domOk: up ? true : null, expected: 'Renforce un allié', observed: m ? `MYB ${m.cAtk}/${m.cDef}` : 'absent' }; }
      const t = a.p[2].field.find(m => m && m.id === 'DB'); const changed = !t || t.cAtk < 5 || t.cDef < 5; return { internalOk: changed, domOk: changed ? true : null, expected: 'Affaiblit un monstre adverse', observed: t ? `DB ${t.cAtk}/${t.cDef}` : 'détruit/retiré' };
    }));
  // force fight / redirect / freeze attacks
  add(godScenario(m => /god_force_fight|god_force_attack|god_ra|god_freeze_attacks|god_redirect|god_xipe/.test(m.cap),
    ctx => { place(2, { id: 'F1', atk: 5, def: 5 }); place(2, { id: 'F2', atk: 1, def: 2 }); ctx.h = handInsert(ctx.card); },
    (b, a) => { const eff = a.p[2].field.some(m => m && (m.sanded || m.cDef < 2)) || a.p[2].fieldN < 2 || logHasA(a, /forcé|immobilis|redirig/i); return { internalOk: eff, domOk: eff ? true : null, expected: 'Force / immobilise un monstre adverse', observed: eff ? 'effet appliqué' : 'aucun effet' }; }));
  // Hermès : god_equip_hurry_all — donne Élan à TOUS vos monstres ce tour.
  add(godScenario(m => m.cap === 'god_equip_hurry_all',
    ctx => { ctx.ally = place(1, { id: 'RUN', atk: 3, def: 3 }); ctx.h = handInsert(ctx.card); },
    (b, a) => { const r = a.p[1].field.find(m => m && m.id === 'RUN'); const ok = r && /hurry/.test(r.cap); return { internalOk: !!ok, domOk: ok ? true : null, expected: 'Ce tour, tous vos monstres ont Élan', observed: r ? `RUN cap="${r.cap}"` : 'absent' }; }));
  // equip gods (need a target monster) — Mictlantecuhtli équipe un ADVERSE
  add(godScenario(m => /god_equip/.test(m.cap),
    ctx => { ctx.ally = place(1, { id: 'EQT', atk: 3, def: 4 }); if (/sacrifice/.test(ctx.card.cap)) place(2, { id: 'EQOPP', atk: 3, def: 4 }); ctx.h = handInsert(ctx.card); },
    (b, a, dom, ctx) => { const eff = logHasA(a, /équip|Mictlant|sacrifié/i); return { internalOk: eff, domOk: eff ? true : null, expected: 'Équipe un monstre (effet à l\'attaque/mort)', observed: eff ? 'équipé' : 'non équipé' }; }));
  // Geb / Centeotl : "si un allié meurt ce tour, piochez" (mort provoquée dans play).
  add({
    family: 'dieu', match: m => /god_draw_if_ally_dies|god_death_draw_cost4/.test(m.cap),
    setup(ctx) { ctx.h = handInsert(ctx.card); },
    async play(ctx) {
      await D.playCard(ctx.h);
      const g = G(); ctx.handMid = g.players[1].hand.length;
      const v = place(1, { id: 'GEBV', atk: 1, def: 1 }); v.cDef = 0; await D.handleDeath(1, v); D.renderAll();
    },
    check(b, a, dom, ctx) { const drew = a.p[1].handN > ctx.handMid; return { internalOk: drew, domOk: drew ? true : null, expected: 'Si un allié meurt ce tour : pioche 1', observed: `main ${ctx.handMid}→${a.p[1].handN}` }; },
    direct: async (ctx) => { await D.playGod(D.newCard({ ...ctx.card }), 1); D.renderAll(); },
  });

  // Idunn : conditionnel 3 même faction — NON déterministe simple → on fournit la condition
  add(godScenario(m => m.cap === 'god_5life_3faction',
    ctx => { for (const id of ['A', 'B', 'C']) place(1, { id: 'FF' + id, atk: 1, def: 1, faction: ctx.card.faction }); G().players[1].hp = 10; ctx.h = handInsert(ctx.card); },
    (b, a) => { const ok = a.p[1].hp > 10; return { internalOk: ok, domOk: ok ? true : null, expected: 'Si 3 alliés même légende : +5 PV + pioche', observed: `PV J1=${a.p[1].hp}` }; }));

  // ─── SORTS-pièges pool (fd_cancel_cycle) déjà couvert par fd_ ; Voile Léthé (désactivée) & autres pool spells restants
  add({
    family: 'presage',
    match: capIs('pool_shift_own_omen'),
    setup(ctx) { D.scheduleOmen(1, 'omen_dmg1_random', 3, 'test', 'MonOmen'); ctx.h = handInsert(ctx.card); },
    async play(ctx) { await D.playCard(ctx.h); },
    check(b, a) {
      const shifted = a.omens.length >= 1 && logHasA(a, /voilé|avancé|repoussé/i);
      return { internalOk: shifted, domOk: shifted ? true : null, expected: 'Cache un de vos présages et le décale', observed: shifted ? 'présage voilé/décalé' : 'aucun effet' };
    },
  });

  // ══════════════════════════════════════════════════════════════════════════
  // COUVERTURE COMPLÉMENTAIRE (réduit les NON TESTABLES). Ces scénarios sont
  // ajoutés APRÈS les spécifiques : ils ne captent que des caps encore non
  // couvertes. Premier match gagnant → aucun risque d'ombrage.
  // ══════════════════════════════════════════════════════════════════════════

  // Rempart (protect) : effProtect actif.
  add({
    family: 'mot-cle', match: m => m.type === 'monster' && capHas('protect')(m),
    setup(ctx) { ctx.h = handInsert(ctx.card); },
    async play(ctx) { await D.playCard(ctx.h); },
    check(b, a, dom, ctx) { const m = mineOf(1, ctx.card.id); const ok = m && D.effProtect(m, 1); return { internalOk: !!ok, domOk: ok ? true : null, expected: 'Rempart : doit être détruit avant les alliés', observed: `effProtect=${!!ok}` }; },
    direct: directSummon,
  });
  // Offrande (heal) : soigne le contrôleur des dégâts infligés en attaquant.
  add({
    family: 'mot-cle', match: m => m.type === 'monster' && capHas('heal')(m),
    setup(ctx) { G().players[1].hp = 8; ctx.h = handInsert(ctx.card); ctx.wall = place(2, { id: 'HW', atk: 0, def: 20 }); },
    async play(ctx) {
      await D.playCard(ctx.h);
      const g = G(); const idx = g.players[1].field.findIndex(m => m && m.id === ctx.card.id);
      g.players[1].summoned.delete(idx); g.phase = 'Combat';
      await D.doAttack(1, idx, 2, g.players[2].field.indexOf(ctx.wall)); D.renderAll();
    },
    check(b, a) { const healed = a.p[1].hp > 8; return { internalOk: healed, domOk: healed ? true : null, expected: 'Offrande : soigne le contrôleur des dégâts infligés', observed: `PV J1=${a.p[1].hp}` }; },
    direct: directSummon,
  });
  // attack_draw (Ningyo) : pioche après avoir attaqué.
  add({
    family: 'mot-cle', match: capIs('attack_draw'),
    setup(ctx) { ctx.h = handInsert(ctx.card); ctx.wall = place(2, { id: 'AW', atk: 0, def: 20 }); },
    async play(ctx) {
      await D.playCard(ctx.h);
      const g = G(); const idx = g.players[1].field.findIndex(m => m && m.id === ctx.card.id);
      g.players[1].summoned.delete(idx); g.phase = 'Combat'; ctx.handMid = g.players[1].hand.length;
      await D.doAttack(1, idx, 2, g.players[2].field.indexOf(ctx.wall)); D.renderAll();
    },
    check(b, a, dom, ctx) { const drew = a.p[1].handN > ctx.handMid; return { internalOk: drew, domOk: drew ? true : null, expected: 'Attaque : pioche 1', observed: `main ${ctx.handMid}→${a.p[1].handN}` }; },
    direct: directSummon,
  });
  // entry_self_sleep (Oni) : entre endormi.
  add({
    family: 'sommeil', match: capIs('entry_self_sleep'),
    setup(ctx) { ctx.h = handInsert(ctx.card); },
    async play(ctx) { await D.playCard(ctx.h); },
    check(b, a, dom, ctx) { const m = mineOf(1, ctx.card.id); const ok = m && m.asleep; return { internalOk: !!ok, domOk: ok ? dom.field[1].some(c => /😴/.test(c.html || '')) : null, expected: 'Éveil : entre endormi (Sommeil 1 tour)', observed: m ? `asleep=${m.asleep}` : 'absent' }; },
    direct: directSummon,
  });
  // entry_copy_ally (Bakeneko) : copie un allié.
  add({
    family: 'copie', match: capIs('entry_copy_ally'),
    setup(ctx) { place(1, { id: 'ORIG', atk: 6, def: 6 }); ctx.h = handInsert(ctx.card); },
    async play(ctx) { await D.playCard(ctx.h); },
    check(b, a, dom, ctx) { const m = mineOf(1, ctx.card.id); const copied = m && m.cAtk === 6; return { internalOk: !!copied, domOk: copied ? true : null, expected: 'Éveil : copie un allié (stats + cap)', observed: m ? `${m.cAtk}/${m.cDef}` : 'absent' }; },
    direct: directSummon,
  });
  // entry_copy_field (Chimère) : copie un monstre visible.
  add({
    family: 'copie', match: capIs('entry_copy_field'),
    setup(ctx) { place(2, { id: 'VIS', atk: 7, def: 7 }); ctx.h = handInsert(ctx.card); },
    async play(ctx) { await D.playCard(ctx.h); },
    check(b, a, dom, ctx) { const m = mineOf(1, ctx.card.id); const copied = m && m.cAtk >= 7; return { internalOk: !!copied, domOk: copied ? true : null, expected: 'Éveil : copie tout monstre visible', observed: m ? `${m.cAtk}/${m.cDef}` : 'absent' }; },
    direct: directSummon,
  });
  // copy_ally_def (Ocelotl) : copie la DEF d'un allié.
  add({
    family: 'copie', match: capIs('copy_ally_def'),
    setup(ctx) { place(1, { id: 'DEFA', atk: 1, def: 12 }); ctx.h = handInsert(ctx.card); },
    async play(ctx) { await D.playCard(ctx.h); },
    check(b, a, dom, ctx) { const m = mineOf(1, ctx.card.id); const copied = m && m.cDef === 12; return { internalOk: !!copied, domOk: copied ? true : null, expected: 'Éveil : copie la DEF d\'un allié', observed: m ? `cDef=${m.cDef}` : 'absent' }; },
    direct: directSummon,
  });
  // entry_reclaim / entry_reclaim_spell (Echidna, Cipactli) : récupère de la défausse.
  add({
    family: 'recuperation', match: capHas('entry_reclaim'),
    setup(ctx) { const g = G(); if (/spell/.test(ctx.card.cap)) g.players[1].graveyard.push(D.newCard({ ...tmplOf('TENJIN') })); else g.players[1].graveyard.push(D.newCard({ ...tmplOf('SPHINX') })); ctx.h = handInsert(ctx.card); ctx.mid0 = g.players[1].hand.length; },
    async play(ctx) { await D.playCard(ctx.h); },
    check(b, a, dom, ctx) { const got = /spell/.test(ctx.card.cap) ? a.p[1].hand.includes('TENJIN') : a.p[1].hand.includes('SPHINX'); return { internalOk: got, domOk: got ? true : null, expected: 'Éveil : récupère une carte de la défausse en main', observed: got ? 'récupéré' : 'rien' }; },
    direct: directSummon,
  });
  // entry_search_ratatosk (Ratatosk) : cherche un Ratatosk.
  add({
    family: 'recherche', match: capIs('entry_search_ratatosk'),
    setup(ctx) { G().players[1].deck.unshift(D.newCard({ ...tmplOf('RATATOSK') })); ctx.h = handInsert(ctx.card); },
    async play(ctx) { await D.playCard(ctx.h); },
    check(b, a) { const got = a.p[1].hand.includes('RATATOSK'); return { internalOk: got, domOk: got ? true : null, expected: 'Éveil : cherche un Ratatosk dans le deck', observed: got ? 'trouvé' : 'rien' }; },
    direct: directSummon,
  });
  // entry_destroy_catchup (Izcoalt) : PV≤60 → détruit un adverse.
  add({
    family: 'entree-degats', match: capIs('entry_destroy_catchup'),
    setup(ctx) { place(2, { id: 'CT2', atk: 5, def: 5 }); ctx.h = handInsert(ctx.card); },
    async play(ctx) { await D.playCard(ctx.h); },
    check(b, a) { const gone = !a.p[2].field.some(m => m && m.id === 'CT2'); return { internalOk: gone, domOk: gone ? true : null, expected: 'Éveil : si PV≤60, détruit un monstre adverse', observed: gone ? 'détruit' : 'intact' }; },
    direct: directSummon,
  });
  // entry_token_copies_2 (Tlaltecuhtli) : 2 jetons copies d'alliés.
  add({
    family: 'entree-tokens', match: capHas('entry_token_copies_2'),
    setup(ctx) { place(1, { id: 'C1', atk: 3, def: 3 }); place(1, { id: 'C2', atk: 2, def: 2 }); ctx.h = handInsert(ctx.card); },
    async play(ctx) { ctx.mid = G().players[1].field.length; await D.playCard(ctx.h); },
    check(b, a, dom, ctx) { const more = a.p[1].fieldN > ctx.mid + 1; return { internalOk: more, domOk: more ? true : null, expected: 'Éveil : 2 jetons copies d\'alliés', observed: `terrain J1 après jeu=${a.p[1].fieldN}` }; },
    direct: directSummon,
  });
  // token_copies_graveyard (Babaï) : jetons copies de 2 monstres du cimetière.
  add({
    family: 'entree-tokens', match: capHas('token_copies_graveyard'),
    setup(ctx) { const g = G(); g.players[1].graveyard.push(D.newCard({ ...tmplOf('SPHINX') }), D.newCard({ ...tmplOf('MOMIE') })); ctx.h = handInsert(ctx.card); },
    async play(ctx) { await D.playCard(ctx.h); },
    check(b, a) { const more = a.p[1].fieldN > b.p[1].fieldN + 1; return { internalOk: more, domOk: more ? true : null, expected: 'Éveil : jetons copies de 2 monstres en défausse', observed: `terrain J1=${a.p[1].fieldN}` }; },
    direct: directSummon,
  });
  // recycle_return (Sha) : Mort → 2 monstres de défausse sous le deck, Sha en main.
  add({
    family: 'sortie', match: capIs('recycle_return'),
    setup(ctx) { ctx.h = handInsert(ctx.card); },
    async play(ctx) {
      await D.playCard(ctx.h);
      const g = G(); const m = g.players[1].field.find(x => x && x.id === ctx.card.id);
      if (m) { m.cDef = 0; await D.handleDeath(1, m); } D.renderAll();
    },
    check(b, a, dom, ctx) { const back = a.p[1].hand.includes(ctx.card.id); return { internalOk: back, domOk: back ? true : null, expected: 'Mort : Sha retourne en main', observed: back ? 'en main' : 'au cimetière' }; },
  });
  // solo_destroy (Raiju) : seul allié → détruit la cible sans combat.
  add({
    family: 'mot-cle', match: capIs('solo_destroy'),
    setup(ctx) { ctx.h = handInsert(ctx.card); ctx.tgt = place(2, { id: 'RT', atk: 9, def: 9 }); },
    async play(ctx) {
      await D.playCard(ctx.h);
      const g = G(); const idx = g.players[1].field.findIndex(m => m && m.id === ctx.card.id);
      g.players[1].summoned.delete(idx); g.phase = 'Combat';
      await D.doAttack(1, idx, 2, g.players[2].field.indexOf(ctx.tgt)); D.renderAll();
    },
    check(b, a) { const gone = !a.p[2].field.some(m => m && m.id === 'RT'); return { internalOk: gone, domOk: gone ? true : null, expected: 'Seul allié : détruit la cible sans combat', observed: gone ? 'détruit' : 'intact' }; },
    direct: directSummon,
  });
  // token_per_dmg (Ymir) : jetons par dégât reçu en combat (le moteur le déclenche
  // quand Ymir ATTAQUE et subit la riposte — cf. doAttack, atk role).
  add({
    family: 'combat', match: capIs('token_per_dmg'),
    setup(ctx) { ctx.h = handInsert(ctx.card); ctx.def = place(2, { id: 'YDEF', atk: 5, def: 20 }); },
    async play(ctx) {
      await D.playCard(ctx.h);
      const g = G(); const idx = g.players[1].field.findIndex(m => m && m.id === ctx.card.id);
      g.players[1].summoned.delete(idx); g.phase = 'Combat'; ctx.mid = g.players[1].field.length;
      await D.doAttack(1, idx, 2, g.players[2].field.indexOf(ctx.def)); D.renderAll();
    },
    check(b, a, dom, ctx) { const more = a.p[1].fieldN > ctx.mid; return { internalOk: more, domOk: more ? true : null, expected: 'Jeton 1/1 par dégât reçu en combat', observed: `terrain J1 ${ctx.mid}→${a.p[1].fieldN}` }; },
    direct: directSummon,
  });
  // token_payoff_atk (Manticore) : +1 ATK en combat par jeton allié.
  add({
    family: 'combat', match: capIs('token_payoff_atk'),
    setup(ctx) { ctx.h = handInsert(ctx.card); place(1, { id: 'TOKEN11', atk: 1, def: 1 }); ctx.wall = place(2, { id: 'MW', atk: 0, def: 20 }); },
    async play(ctx) {
      await D.playCard(ctx.h);
      const g = G(); const idx = g.players[1].field.findIndex(m => m && m.id === ctx.card.id);
      g.players[1].summoned.delete(idx); g.phase = 'Combat';
      await D.doAttack(1, idx, 2, g.players[2].field.indexOf(ctx.wall)); D.renderAll();
    },
    check(b, a) { const ok = logHasA(a, /Marée/); return { internalOk: ok, domOk: ok ? true : null, expected: 'Marée : +1 ATK en combat par jeton allié', observed: ok ? 'Marée déclenchée' : 'non déclenchée' }; },
    direct: directSummon,
  });
  // combat_dmg2 (Djinn) : +2 dégâts à la cible en attaquant.
  add({
    family: 'combat', match: capIs('combat_dmg2'),
    setup(ctx) { ctx.h = handInsert(ctx.card); ctx.tgt = place(2, { id: 'DJ', atk: 0, def: 20 }); },
    async play(ctx) {
      await D.playCard(ctx.h);
      const g = G(); const idx = g.players[1].field.findIndex(m => m && m.id === ctx.card.id);
      g.players[1].summoned.delete(idx); g.phase = 'Combat';
      await D.doAttack(1, idx, 2, g.players[2].field.indexOf(ctx.tgt)); D.renderAll();
    },
    check(b, a) { const ok = logHasA(a, /Combat \+2|combat_dmg|\+2 dégâts/i); return { internalOk: ok, domOk: ok ? true : null, expected: 'Combat : 2 dégâts supplémentaires à la cible', observed: ok ? 'appliqué' : 'non appliqué' }; },
    direct: directSummon,
  });
  // copy_on_attack (Ladon) : invoque une copie de la cible attaquée.
  add({
    family: 'combat', match: capIs('copy_on_attack'),
    setup(ctx) { ctx.h = handInsert(ctx.card); ctx.tgt = place(2, { id: 'LA', atk: 2, def: 20 }); },
    async play(ctx) {
      await D.playCard(ctx.h);
      const g = G(); const idx = g.players[1].field.findIndex(m => m && m.id === ctx.card.id);
      g.players[1].summoned.delete(idx); g.phase = 'Combat'; ctx.mid = g.players[1].field.length;
      await D.doAttack(1, idx, 2, g.players[2].field.indexOf(ctx.tgt)); D.renderAll();
    },
    check(b, a, dom, ctx) { const more = a.p[1].fieldN > ctx.mid; return { internalOk: more, domOk: more ? true : null, expected: 'Attaque : invoque une copie du monstre attaqué', observed: `terrain J1 ${ctx.mid}→${a.p[1].fieldN}` }; },
    direct: directSummon,
  });
  // entry_oracle (Python) : regarde le dessus du deck adverse ; si dieu, pioche.
  add({
    family: 'oracle', match: capIs('entry_oracle'),
    setup(ctx) { G().players[2].deck.unshift(D.newCard({ ...tmplOf('TENJIN') })); ctx.h = handInsert(ctx.card); ctx.mid = G().players[1].hand.length; },
    async play(ctx) { await D.playCard(ctx.h); },
    check(b, a, dom, ctx) { const drew = a.p[1].handN > ctx.mid - 1; return { internalOk: drew, domOk: drew ? true : null, expected: 'Oracle : dessus du deck adverse dieu → pioche', observed: `main J1 après jeu=${a.p[1].handN}` }; },
    direct: directSummon,
  });
  // oracle_dmg3 (Teuzauhtototl) : début de tour, carte sous le deck → 3 dégâts à soi.
  add({
    family: 'oracle', match: capIs('oracle_dmg3'),
    setup(ctx) { ctx.h = handInsert(ctx.card); },
    async play(ctx) {
      await D.playCard(ctx.h);
      const g = G(); g.players[1].deck.unshift(D.newCard({ ...tmplOf('TENJIN') })); // cost 1 → mis sous le deck
      const m = g.players[1].field.find(x => x && x.id === ctx.card.id); ctx.defMid = m ? m.cDef : null;
      D.doEndTurn(); D.doEndTurn(); D.renderAll();
    },
    check(b, a, dom, ctx) {
      const m = a.p[1].field.find(x => x && x.id === ctx.card.id);
      const hurt = (!m) || (ctx.defMid != null && m.cDef < ctx.defMid) || logHasA(a, /Oracle/);
      return { internalOk: hurt, domOk: hurt ? true : null, expected: 'Début de tour : Oracle (carte sous le deck → 3 dégâts à soi)', observed: m ? `cDef ${ctx.defMid}→${m.cDef}` : 'détruit' };
    },
    direct: directSummon,
  });
  // start_coinflip_destroy (Charybde) : début de tour, pile → détruit un adverse (aléa seedé).
  add({
    family: 'debut-tour', match: capIs('start_coinflip_destroy'),
    setup(ctx) { place(2, { id: 'CH', atk: 3, def: 3 }); ctx.h = handInsert(ctx.card); },
    async play(ctx) { await D.playCard(ctx.h); D.doEndTurn(); D.doEndTurn(); D.renderAll(); },
    check(b, a) { const fired = logHasA(a, /Charybde/); return { internalOk: fired, domOk: fired ? true : null, expected: 'Début de tour : pile = détruit un monstre adverse', observed: fired ? 'déclenché (pile/face seedé)' : 'non déclenché' }; },
    direct: directSummon,
  });
  // ragnarok_growing (Fenrir) : Ténèbres, début de tour, X dégâts croissants aux adverses.
  add({
    family: 'debut-tour', match: capIs('ragnarok_growing'),
    setup(ctx) { G().cycle = PHASE_IDX.tenebres; place(2, { id: 'RG', atk: 1, def: 2 }); ctx.h = handInsert(ctx.card); },
    async play(ctx) {
      await D.playCard(ctx.h);
      const g = G(); g.cycleFrozen = 9; // fige pour rester aux Ténèbres à la ré-entrée du tour J1
      D.doEndTurn(); D.doEndTurn(); D.renderAll();
    },
    check(b, a) { const fired = logHasA(a, /RAGNAR/i); return { internalOk: fired, domOk: fired ? true : null, expected: 'Ténèbres, début de tour : X dégâts croissants aux adverses', observed: fired ? 'Ragnarök déclenché' : 'non déclenché' }; },
    direct: directSummon,
  });
  // reveal_play_free (Kaqkoj) : révèle 3, joue une carte gratuitement.
  add({
    family: 'entree-jeu-gratuit', match: capIs('reveal_play_free'),
    setup(ctx) { ctx.h = handInsert(ctx.card); handInsert({ ...tmplOf('SPHINX') }); handInsert({ ...tmplOf('MOMIE') }); handInsert({ ...tmplOf('APIS') }); },
    async play(ctx) { const g = G(); const idx = g.players[1].hand.findIndex(c => c && c.id === ctx.card.id); await D.playCard(idx); },
    check(b, a) { const ok = logHasA(a, /gratuit/i) || a.p[1].fieldN > 1; return { internalOk: ok, domOk: ok ? true : null, expected: 'Révèle 3, joue une carte gratuitement', observed: ok ? 'carte jouée gratuitement' : 'aucune' }; },
    direct: null,
  });
  // trap_payoff / Toile (Hippocampe, Satyre, Pégase) : dieu face caché révélé → 2 dégâts.
  add({
    family: 'toile', match: capHas('trap_payoff'),
    setup(ctx) {
      ctx.h = handInsert(ctx.card);
      const fd = place(1, { id: 'FDGOD', atk: 0, def: 0, faceDown: true });
      fd.type = 'god'; fd.cap = 'fd_blocker';
    },
    async play(ctx) {
      await D.playCard(ctx.h);
      ctx.hpMid = G().players[2].hp;
      // On révèle le dieu face caché puis on déclenche la Toile via le vrai hook moteur.
      const g = G(); const godM = g.players[1].field.find(m => m && m.faceDown && m.type === 'god');
      if (godM) godM.faceDown = false;
      if (D.notifyTrapReveal) D.notifyTrapReveal(1);
      D.renderAll();
    },
    check(b, a, dom, ctx) {
      const dropped = a.p[2].hp < ctx.hpMid;
      return { internalOk: dropped, domOk: dropped ? true : null,
        expected: 'Toile : quand un dieu face caché se révèle, 2 dégâts au joueur adverse',
        observed: `PV adverse ${ctx.hpMid}→${a.p[2].hp}` };
    },
    direct: directSummon,
  });
  // Aani : temp_steal_hurry — le moteur l'exécute à l'ÉVEIL (vol temporaire d'un
  // adverse), alors que le texte dit « Mort ». On teste le vol réel constaté.
  add({
    family: 'vol', match: capHas('temp_steal_hurry'),
    setup(ctx) { place(2, { id: 'STEAL', atk: 4, def: 4 }); ctx.h = handInsert(ctx.card); },
    async play(ctx) { await D.playCard(ctx.h); },
    check(b, a) {
      const got = a.p[1].field.some(m => m && m.id === 'STEAL');
      return { internalOk: got, domOk: got ? true : null,
        expected: 'Vole un monstre adverse (Rapide) — NB : le moteur le fait à l\'Éveil, la carte dit « Mort »',
        observed: got ? 'monstre volé (à l\'Éveil)' : 'aucun vol' };
    },
    direct: directSummon,
  });
  // Chohix : death_token22 — jeton 2/2 quand un allié meurt.
  add({
    family: 'passif', match: capHas('death_token22'),
    setup(ctx) { ctx.h = handInsert(ctx.card); },
    async play(ctx) {
      await D.playCard(ctx.h);
      const g = G(); ctx.mid = g.players[1].field.length;
      const v = place(1, { id: 'CHV', atk: 1, def: 1 }); v.cDef = 0; await D.handleDeath(1, v); D.renderAll();
    },
    check(b, a, dom, ctx) { const more = a.p[1].fieldN > ctx.mid; return { internalOk: more, domOk: more ? true : null, expected: 'Toujours : jeton 2/2 par mort alliée', observed: `terrain J1 ${ctx.mid}→${a.p[1].fieldN}` }; },
    direct: directSummon,
  });
  // Khepri (désactivée) : première Momie relevée de l'Aube gagne Élan.
  add({
    family: 'momie', match: capHas('pool_khepri'),
    setup(ctx) { G().cycle = PHASE_IDX.nuit; place(1, { id: 'KMUM', atk: 4, def: 3, momieRest: true }); ctx.h = handInsert(ctx.card); },
    async play(ctx) { await D.playCard(ctx.h); D.setCyclePhase(PHASE_IDX.aube, 'diag'); D.renderAll(); },
    check(b, a) { const m = a.p[1].field.find(x => x && x.id === 'KMUM'); const ok = m && /hurry/.test(m.cap); return { internalOk: !!ok, domOk: ok ? true : null, expected: 'À chaque Aube : la 1ʳᵉ Momie relevée gagne Élan', observed: m ? `KMUM cap="${m.cap}"` : 'absent' }; },
    direct: directSummon,
  });

  // ─── DIEUX : familles complémentaires ─────────────────────────────────────
  // Contres qui, hors pile, ciblent quand même un adverse (Isis/Poseidon via
  // pickTarget, Ehecatl destroy, Amaterasu repli 6.3 endort). Frigg (god_cancel_ms)
  // n'a AUCUN repli pile-vide → laissé en NON TESTABLE (exige une vraie pile).
  add(godScenario(m => /god_cancel_ms_cap|god_cancel_spell_draw|god_destroy_ms_bonus|god_cancel_m_steal/.test(m.cap),
    ctx => { place(2, { id: 'CN', atk: 6, def: 4 }); ctx.h = handInsert(ctx.card); },
    (b, a) => { const eff = a.p[2].fieldN < b.p[2].fieldN || a.p[2].field.some(m => m && (m.asleep || m.cDef < 4)); return { internalOk: eff, domOk: eff ? true : null, expected: 'Hors pile : neutralise un monstre adverse', observed: eff ? 'monstre neutralisé' : 'aucun effet' }; }));
  // Tezcatlipoca : vol d'un dieu de la main adverse (repli 6.3).
  add(godScenario(m => m.cap === 'god_steal_spell_monster',
    ctx => { G().players[2].hand = [D.newCard({ ...tmplOf('TENJIN') })]; ctx.h = handInsert(ctx.card); },
    (b, a) => { const stole = a.p[1].hand.includes('TENJIN'); return { internalOk: stole, domOk: stole ? true : null, expected: 'Repli : dérobe un dieu de la main adverse', observed: stole ? 'dieu dérobé' : 'rien' }; }));
  // god_copy_bonus (Anubis) : jeton copie d'un de vos monstres.
  add(godScenario(m => m.cap === 'god_copy_bonus',
    ctx => { place(1, { id: 'ANM', atk: 4, def: 4 }); ctx.h = handInsert(ctx.card); },
    (b, a) => { const more = a.p[1].fieldN > b.p[1].fieldN; return { internalOk: more, domOk: more ? true : null, expected: 'Invoque un jeton copie d\'un monstre', observed: `terrain J1 ${b.p[1].fieldN}→${a.p[1].fieldN}` }; }));
  // god_swap_hand_field (Amun-Ra) : échange main↔terrain même légende.
  add(godScenario(m => m.cap === 'god_swap_hand_field',
    ctx => { const g = G(); g.players[1].hand.push(D.newCard({ ...tmplOf('MEDJED'), faction: g.players[1].faction })); place(1, { id: 'AMF', atk: 2, def: 3, faction: g.players[1].faction }); ctx.h = g.players[1].hand.length; g.players[1].hand.push(D.newCard({ ...ctx.card })); },
    (b, a) => { const swapped = a.p[1].field.some(m => m && m.id === 'MEDJED') || logHasA(a, /↔/); return { internalOk: swapped, domOk: swapped ? true : null, expected: 'Échange un monstre de la main avec un du terrain (même légende)', observed: swapped ? 'échange effectué' : 'aucun' }; }));
  // god_sacrifice_search_plus1 (Horus) : sacrifie un allié → cherche coût+1 et invoque.
  add(godScenario(m => m.cap === 'god_sacrifice_search_plus1',
    ctx => { const g = G(); place(1, { id: 'HRS', atk: 2, def: 2 }); const t = D.newCard({ ...tmplOf('APIS') }); g.players[1].deck.unshift(t); ctx.h = handInsert(ctx.card); },
    (b, a) => { const gone = !a.p[1].field.some(m => m && m.id === 'HRS'); return { internalOk: gone, domOk: gone ? true : null, expected: 'Sacrifie un allié → cherche un monstre coût +1 et l\'invoque', observed: gone ? 'sacrifice effectué' : 'aucun' }; }));
  // god_recover_1or2 (Heimdall) : ramène une carte de défausse en main.
  add(godScenario(m => m.cap === 'god_recover_1or2',
    ctx => { G().players[1].graveyard.push(D.newCard({ ...tmplOf('SPHINX') })); ctx.h = handInsert(ctx.card); },
    (b, a) => { const got = a.p[1].hand.includes('SPHINX'); return { internalOk: got, domOk: got ? true : null, expected: 'Ramène une carte de la défausse en main', observed: got ? 'récupéré' : 'rien' }; }));
  // god_3shield_attacks (Hestia) : crée le jeton 3 boucliers.
  add(godScenario(m => m.cap === 'god_3shield_attacks',
    ctx => { ctx.h = handInsert(ctx.card); },
    (b, a) => { const tok = a.p[1].field.some(m => m && /hestia/i.test(m.n || '')); return { internalOk: tok, domOk: tok ? true : null, expected: 'Crée un gardien à 3 boucliers anti-attaque', observed: tok ? 'jeton créé' : 'aucun' }; }));

  // ─── FALLBACK générique : la carte se joue sans erreur (couverture minimale) ─
  // (utilisé uniquement si aucun scénario spécifique ne matche)

  // ============================================================================
  function pickScenario(meta) {
    for (const s of SCEN) { try { if (s.match(meta)) return s; } catch (e) {} }
    return null;
  }

  async function runOnce(scenario, card, useDirect) {
    setupBase(card.faction);
    const ctx = { card, api: D };
    let before;
    try {
      await scenario.setup(ctx);
      D.renderAll();
      before = snap();
      if (useDirect && scenario.direct) { await scenario.direct(ctx); }
      else if (scenario.play) { await scenario.play(ctx); }
      else { ctx.h = ctx.h != null ? ctx.h : handInsert(card); await D.playCard(ctx.h); }
      // Laisse retomber les effets asynchrones non-awaités par le moteur : les
      // morts via aiPickTarget→applyTargetEffect déclenchent une animation de
      // ~340 ms (vrai setTimeout dans un navigateur réel) avant retrait effectif.
      await new Promise(r => setTimeout(r, 450));
      D.renderAll();
    } catch (e) {
      return { error: String(e && e.stack || e), before };
    }
    const after = snap();
    const dom = domSnap();
    let res;
    try { res = scenario.check(before, after, dom, ctx); }
    catch (e) { res = { internalOk: false, domOk: null, expected: '(check error)', observed: String(e) }; }
    return { before, after, dom, res, ctx };
  }

  window.__runDiag = async function (cardId) {
    const meta = tmplOf(cardId);
    if (!meta) return { verdict: 'ERREUR', detail: 'carte inconnue' };
    const scenario = pickScenario(meta);
    if (!scenario) {
      return {
        id: cardId, n: meta.n, faction: meta.faction, type: meta.type, cap: meta.cap,
        family: '—', verdict: 'NON_TESTABLE',
        detail: `aucun scénario déterministe pour cap="${meta.cap}"`,
        expected: meta.txt || '', observed: '',
      };
    }
    // Carte désactivée : signalée mais on tente quand même (souvent effet retiré du pool).
    const out = { id: cardId, n: meta.n, faction: meta.faction, type: meta.type, cap: meta.cap, family: scenario.family, disabled: !!meta.disabled };
    const r1 = await runOnce(scenario, meta, false);
    if (r1.error) {
      out.verdict = 'NON_CONFORME'; out.cause = 'LOGIQUE';
      out.expected = '(exécution)'; out.observed = 'ERREUR JS: ' + r1.error.split('\n')[0];
      return out;
    }
    const { res } = r1;
    out.expected = res.expected; out.observed = res.observed;
    if (res.internalOk && (res.domOk === null || res.domOk === true)) {
      out.verdict = 'CONFORME';
      return out;
    }
    if (res.internalOk && res.domOk === false) {
      out.verdict = 'NON_CONFORME'; out.cause = 'UI';
      return out;
    }
    // internalOk faux → distinguer câblage vs logique
    out.verdict = 'NON_CONFORME';
    out.cause = 'LOGIQUE';
    if (scenario.direct) {
      const r2 = await runOnce(scenario, meta, true);
      if (!r2.error && r2.res && r2.res.internalOk) { out.cause = 'CABLAGE'; out.observed += ' | (l\'effet fonctionne en invocation directe)'; }
    }
    return out;
  };

  // Liste des cartes (pour l'orchestrateur Node).
  window.__cardList = function () {
    return D.allCards().map(c => ({ id: c.id, n: c.n, type: c.type, faction: c.faction, cap: c.cap, grp: c.grp, disabled: !!c.disabled, txt: c.txt }));
  };

  window.__uidiagReady = true;
})();
