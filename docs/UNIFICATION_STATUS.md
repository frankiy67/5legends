# UNIFICATION STATUS — branche v1-unification

Suivi du portage des briques A→D sur le socle fix-audit-v5 (181 cartes, moteur v5).
Méthode : PORTAGE (réécriture dans le moteur v5), pas de merge — cf. DECISIONS_V5.md [4.1].

**État global : PLAN VALIDÉ PAR FRANK (2026-07-04) — brique A en cours.**

Réponses de Frank aux questions ouvertes :
- **Q1 → Moteur seul, 0 carte convertie.** Ferveur/Égide/Sanctuaire implémentés dans le
  moteur (handlers + ciblage + IA) mais portés par AUCUNE carte existante. Sources de Foi
  en v1 : Prière (+1) et Profanation (+1). Hestia/Mayahuel/Idunn/Osiris/Griffon/Offrande :
  intouchés. Conséquence : les signatures RAID/GUARD d'ai_validate qui reposaient sur
  Ferveur/Égide seront recalibrées sur prières/profanations/kills.
- **Q2 → Log de bataille EXCLU du périmètre C.** On ne traduit que écrans/boutons/modales/
  hints (hors snapshot golden). Le log restera partiellement anglais (session ultérieure).
- **Q3 → P2_START_FAITH = 0** (constante paramétrable + setter pour harnais).
- **Q4 → Ajout net : deck 57→59** (1 monstre uncommon Présage par faction, ×2 en deck).

---

## Tableau de bord

| Brique | Contenu | État | Golden | Tests |
|---|---|---|---|---|
| A — Foi / Ascension | jauge, Guerre/Prière, FAITH_WIN=16, Profanation, Ferveur, Égide, horloge T18 | ✅ TERMINÉE (4 commits A1-A4) | ✅ régénéré + round-trip vérifié | ✅ test_faith 500 : asc 5,8 %, 10,1 tours, 0 crash |
| B — IA multistrat | profils CONTROL/RUSH/GUARD/RAID, garde-fou ai_validate, boss Arena, difficulté Partie Libre | ✅ TERMINÉE (3 commits B1-B3) | ✅ byte-identique vérifié 2× | ✅ ai_validate : 3 signatures ✓ |
| C — i18n FR | UI visible en français (IDs/variables en anglais) | ⏳ non démarrée | ⚠️ conflit logs (Q2) | batterie existante |
| D — Frise du Destin | timeline 5 phases, mot-clé Présage, 5 cartes démo | ⏳ non démarrée | régénérer en fin de D | test_omens.js à créer |

## Spec extraite des branches (2026-07-04)

### origin/ascension (7 commits C1→C4, P1, P2)
- C1 : `player.faith`, jauge HUD (dieu suprême + X/FAITH_WIN), SUPREME_GODS, P2 démarre à 2 Foi.
- C2 : Guerre OU Prière (exclusif, phase Combat, mêmes conditions d'éligibilité que l'attaque).
  `doPray` = +1 Foi verrouillée immédiatement, `kneeling=true`, action consommée ; les fidèles
  se relèvent au début du tour de leur propriétaire (`doEndTurn`). Un Rempart agenouillé ne
  protège plus. Menu flottant ⚔️ Attaquer / 🙏 Prier au clic (UI). `aiPrayPhase` avant combat :
  garde `ceil(menace/2)` défenseurs (Remparts puis haute DEF), prie le reste.
- C3 : **PV RETIRÉS (Foi seule victoire) — NON PORTÉ** (consigne : la victoire PV=0 reste, la Foi s'ajoute).
- C4 : horloge TURN_CAP=18 — annonce au tour 18, résolution après : plus de Foi gagne
  (branche : égalité = nul ; consigne v1 : **tie-breaker aux PV**).
- P1 : mot-clé **Ferveur** (+1 Foi quand la créature inflige des dégâts à une créature en
  ATTAQUANT, 1×/tour, flag `_fervor` reset en début de tour) sur ex-cartes 'heal' ;
  Griffon → `hurry_exit_faith` (+1 Foi à la mort) ; Idunn → +2 Foi si 3 même légende ;
  Osiris → annule + 1 Foi ; Mayahuel → +1 Foi + **Sanctuaire** (un fidèle à genoux
  improfanable jusqu'au prochain tour, `_sanctuary`).
- P2 : **Égide** (grec) — une créature Égide vivante/debout rend les fidèles agenouillés
  alliés inciblables/improfanables (`hasEgide`/`attackTargetable`). Porteurs branche :
  Cerbère `protect_egide`, Minotaure `protect_egide_hit`, Hestia → refonte « Foyer Sacré »
  0/5 Égide, jetons Déméter → Égide.

### origin/feat-ai-multistrat (commits P1→P4 + expériences)
- P1 : `AI_PROFILES`/`getAIProfile`/`setAIProfile` (défaut CONTROL = comportement historique
  strict, no-op golden). `profileCardBonus(c,p)` additif dans scoreCard (RUSH : corps pas
  chers/hurry ; GUARD : égide/protect/DEF ; RAID : fervor/ATK/retrait). `keepN` par profil
  dans aiPrayPhase (RUSH prie tout, GUARD proportionnel aux gardiennes, RAID prédicat
  « bonne attaque » par créature). Ciblage RAID dans pickAITarget (profaner > tuer source
  Ferveur > profaner le plus tendre). Compteurs d'observation `bumpStat` (jamais sérialisés).
- P2 : `tools/ai_validate.js` — garde-fou comportemental : chaque profil vs CONTROL,
  signatures mesurées (prières/partie, tour 1ʳᵉ prière, Ferveur, kills, profanations…)
  comparées à la référence CONTROL-vs-CONTROL.
- P3/P4 : harnais tournoi (`sim_core.js`, `ai_tournament.js`) — verdict : CONTROL bat les 3,
  cycle RPS RUSH>RAID>GUARD (sens inverse de l'hypothèse).
- Expériences retenues : **FAITH_WIN 14→16**, **DESECRATE_FAITH=1** (profaner un agenouillé
  = +1 Foi au tueur, dans handleDeath, tous chemins de mort ; Sanctuaire immunise).
- Calibration J2 : rapport `ai_tournament_report_P2.md` — « valeur retenue » pour le
  tournoi = **0** (la cible 50-54 % est inatteignable : J2 gagne 73 % en miroir même à 0,
  causes structurelles main 5/6 vs 4), mais « valeur shippée » de la branche = 2.
  ⚠️ Mesuré dans le monde C3 (Foi seule victoire) — non transposable tel quel à v1
  (double victoire, P1/P2 déjà calibré à 51,2 % en v5). → Question Q3.

## Divergences branche ↔ moteur v5 identifiées

1. **C3 non porté** (PV conservés) → tout ce qui en découle dans la branche est réadapté :
   attaques au visage conservées, blocs léthal/anti-stall/chip-damage de l'IA conservés,
   effets « dégâts au joueur »/soins PV NON neutralisés, orbe PV conservée au HUD.
2. **Porteurs de Ferveur** : Mujnina (→ `reveil_buff`) et Pégase (→ `hurry trap_payoff`)
   ont changé de rôle en v5 (archétypes 6.4) — la liste branche est partiellement
   inapplicable. → Question Q1.
3. **Hestia** réparée en v5 (6.3, « 3 marqueurs anti-attaque » fonctionnelle) ; la refonte
   Foyer Sacré de la branche l'écraserait. → inclus dans Q1.
4. **Golden sérialise les textes de log** (`golden.js` : `G.log.map(e=>e.msg)`) → la
   traduction FR des logs (brique C) casse le byte-identique. → Question Q2.
5. **aiPrayPhase** de la branche était réglée pour un monde sans PV ; en double victoire,
   prier avant de vérifier le léthal ferait rater des parties gagnées → adaptation :
   la phase de prière s'exécute APRÈS le check léthal (ne prie jamais si léthal dispo).
   ⚠️ à relire par Frank (sera consigné dans DECISIONS_V5.md).

## Questions ouvertes (bloquantes avant code)

- **Q1 — Porteurs de Ferveur/Égide** : quelle liste ? (option recommandée : les 6 cartes
  encore « Offrande pure » en v5 — Ljosalfar, Landvaettir, Apis, Criosphinx, Chaneque,
  Xiuhcoatl — + Griffon exit_faith + dieux Idunn/Osiris/Mayahuel versions Foi + Égide sur
  Cerbère/Minotaure/jetons Déméter, en préservant Hestia v5 ; Offrande survit sur
  Ryuu/Lion de Némée ; Mujnina/Pégase intouchées).
- **Q2 — Golden vs brique C** : traduire les logs et régénérer le golden en fin de C avec
  preuve structurelle (états finaux/gagnants identiques), OU exclure le log de bataille du
  périmètre C ?
- **Q3 — P2_START_FAITH** : 0 (« valeur retenue » du rapport, contexte v1 déjà équilibré)
  ou 2 (« valeur shippée » de la branche) ?
- **Q4 — Cartes Présage (D)** : 5 monstres uncommon ajoutés net (deck 57→59, précédent
  [3.2]) ou remplacement de cartes existantes ?

## Idées créatives NON codées (parking — consigne brique D)

*(vide — à remplir si des idées émergent pendant D)*

## ✅ ARBITRAGE FRANK (2026-07-04) — gate factions redéfini (P4 seul)

**Décision Frank** : gate RELATIF à la baseline, **±4pp, mesuré à N=200**
(`node tools/test_factions.js 200`), en remplacement du [45,55] absolu à N=100.
- **Refusés explicitement** : P1/P2 (modifs d'heuristique IA), P3 (nouvelle
  règle « prière au zénith »), P5 (micro-nerfs de cartes). **Aucune modif
  d'IA, de règle ou de carte en phase 0.**
- **egyptian ~59 %** : documenté comme DETTE PRÉEXISTANTE non causée par la
  brique (baseline réelle 59,3 % à N=200 ; le 54,5 % de la batterie v5 était
  un artefact d'échantillon N=100). Nerf reporté à la **session d'équilibrage
  dédiée (phase 5)**, avec le rééquilibrage de norse.
- **norse 42,6 %** (−3,9pp, dans le ±4pp) : absorbé par le gate relatif,
  rééquilibrage en phase 5.

**Référence baseline (fix-audit-v5 @ 9c7be21, N=200)** — à utiliser pour tous
les gates des briques A→D :
| faction | baseline | brique A (état retenu) | Δ | gate ±4pp |
|---|---|---|---|---|
| yokai | 51,1 % | 48,4 % | −2,7 | ✅ |
| norse | 46,5 % | 42,6 % | −3,9 | ✅ |
| egyptian | 59,3 % | 60,3 % | +1,0 | ✅ (dette préexistante) |
| greek | 47,1 % | 50,7 % | +3,6 | ✅ |
| aztec | 46,0 % | 48,1 % | +2,1 | ✅ |

→ **GATE FACTIONS BRIQUE A : VERT** avec l'état A2 committé (420bbbf), sans
aucune itération supplémentaire.

## Mesures d'origine du blocage (conservées pour référence)

Le critère « les 5 factions ∈ [45,55] à `test_factions 100` » est en échec, mais
l'analyse montre que le problème est LARGEMENT préexistant à la brique A :

| Mesure (N=200, 2000 parties, SE≈1,8pp) | norse | egyptian | autres |
|---|---|---|---|
| **Baseline fix-audit-v5 (9c7be21)** | 46,5 % | **59,3 %** | 46-51 ✅ |
| Brique A, prière IA désactivée (A/B) | 46,2 % | 59,1 % | ✅ |
| Brique A, état retenu (prière v1 + profanation-prio) | **42,6 %** | 60,3 % | ✅ |

- **egyptian ~59 % est un état de la BASELINE** : le « 54,5 % ✅ » de la batterie
  v5 était un artefact d'échantillon à N=100 (SE≈2,5pp, seeds favorables).
  La brique A n'ajoute que ~+1pp. Les nerfs egyptian sont déjà prévus « plus
  tard » par Frank (hors périmètre v1 : « ne touche à AUCUN équilibrage »).
- **norse : −3,9pp**, seul VRAI effet de la brique A (46,5 → 42,6). Cause : les
  corps adverses qui suicidaient leurs attaques en v5 prient désormais et
  restent sur le board, absorbant les attaques norse au lieu du visage.
  Sonde Ragnarök : 2,32 → 2,05 (effet mineur, pas la cause principale).
- 3 variantes d'heuristique de prière testées (filtre productif seul · noyau
  défensif ceil(menace/2) · règle « board à genoux → visage ») : les winrates
  oscillent de ±5pp entre variantes (norse 38,8-46,3, aztec 44,3-51,4) — on
  règle dans le bruit structurel des matchups. Règle d'arrêt appliquée.
- Critères test_faith TOUS verts sur l'état retenu : Ascension 5,8 % ∈ [5,40],
  10,1 tours ≤ 13, 0 crash. test_all_cards/test_arena/test_preview verts.

## Journal de session

- **2026-07-04** : lecture docs v5, extraction complète des specs ascension +
  feat-ai-multistrat, création branche `v1-unification`, plan présenté à Frank —
  en attente de validation et des réponses Q1-Q4.
