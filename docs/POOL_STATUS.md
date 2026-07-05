# POOL_STATUS — journal d'implémentation du nouveau pool (feat-pool)

Session autonome du 2026-07-05. Design de référence : `docs/POOL_DESIGN.md`
(fourni par Frank, committé tel quel). Règle absolue appliquée : équilibrer
n'est pas redessiner — seuls coût (±2), ATK/DEF (±2) et une valeur numérique
du texte sont ajustables ; tout le reste est documenté ici et attend Frank.

## Journal

- **2026-07-05 · préparation** : `docs/POOL_DESIGN.md` committé (5644a49).
  La branche `feat-pool` existait déjà avec le portage demandé (cherry-picks,
  pas de merge) : moteur de Frise P1a/P1b (`feat-frise-moteur`) + harnais
  Ferveur/Égide H1/H2 (`feat-ascension-harnais`).
- **2026-07-05 · BASELINE PROPRE vérifiée sur feat-pool** (avant toute carte) :
  - golden 200 parties : ✓ IDENTIQUE au snapshot de la branche
  - test_all_cards : 186/186 caps, 186/186 cartes vues, 0 crash
  - test_omens : 14/14 scénarios, 0 crash, tick exact, 10,10 tours
  - test_faith : 12/12 scénarios, Ascension 11,0 % (placeholders ON), 0 crash
  - test_preview : 202/202 prédictions exactes
  - test_factions 200 (2000 parties) : yokai 53,1 · norse 44,6 · egyptian 56,3
    · greek 50,8 · aztec 45,3 — gate relatif ±4pp ✅ (baseline héritée du
    golden frise, documentée sur feat-frise-moteur)
  - test_arena 100 runs : 0 crash, 9,9 tours/duel, 27 % champions

## Décisions d'architecture (documentées, réversibles)

1. **Registre séparé `POOL_MONSTERS` / `POOL_SPELLS`** : les nouvelles cartes
   n'entrent QUE dans le pool de draft de l'Arena (`buildCardPool`), jamais
   dans `buildDeck` (Partie Libre intacte, 54 cartes, golden préservé) —
   c'est la section 4 du design (« Toutes les nouvelles cartes entrent dans
   le pool de draft de l'Arena »).
2. **Gate winrates factions** : en Libre, le pool ne change rien par
   construction (vérifié par test_factions à chaque vague) ; la mesure qui
   fait foi pour les nouvelles cartes est `tools/pool_metrics.js` (duels
   draftés des deux côtés), avec sa PROPRE baseline mesurée avant vague 1.
3. **Raretés du design** : commune→common, rare→uncommon-équivalent… — sans
   effet moteur pour le pool (le draft tire uniformément) ; conservées en
   métadonnée `rarity` fidèle au design (`common/rare/epic/legendary`).

- **2026-07-05 · infrastructure pool** : registres `POOL_MONSTERS`/`POOL_SPELLS`
  (Arena-only, exclus de buildDeck), `opts.customDeck2` (duels draftés 2 côtés,
  harnais seulement), sorts-pièges `fd_` posés face cachée (additif : aucun
  sort existant n'a de cap fd_), harnais `tools/pool_metrics.js`.
  Golden re-vérifié ✓ IDENTIQUE registres vides.
- **2026-07-05 · BASELINE DRAFT (pool_metrics 1000 duels, pool vide)** — la
  référence du gate relatif ±4pp en draft pour les 3 vagues :
  yokai 53,5 · norse 45,0 · egyptian 52,0 · greek 46,8 · aztec 52,8 ·
  Ascension 1,4 % (0 porteur de Ferveur au draft : attendu, la vague 1 les
  apporte — le gate [5,40] % s'évalue en fin de vague) · 9,82 tours · 0 crash.

## Décisions en attente de Frank (rien tranché ici)

- **Télégraphe** : Bouclier de Svalinn, Augure de Delphes et l'aura grecque de
  Midi n°2 sont GELÉS (non implémentés), conformément au design (« à geler si
  le mode reste off »).
- **Collision de mot-clé « Rituel »** : le jeu a déjà un Rituel aztèque
  (sacrifice activé : Chohix, Tlaltecuhtli). Le design introduit « Rituel N »
  = canalisation sur N transitions de phase. Implémenté sous le cap technique
  `chant_N` (« Canalisation ») pour ne pas percuter l'existant — le NOM affiché
  reste « Rituel N » comme dans le design. À renommer si Frank préfère.
- **Collisions de noms** (le design réutilise des noms de cartes existantes) :
  Tanuki, Nue, Völva, Ouadjet, Serpopard, Cipactli, Tlaltecuhtli, Ocelotl,
  Nagual, Chimère, Hydre, Xolotl, Ratatoskr/Ratatosk. IDs techniques distincts
  (préfixe `P_`), noms affichés conservés fidèles au design. À renommer par
  Frank (section 8.5 du design).

## VAGUE 1 — cœur (22 cartes) : TERMINÉE ✅ (2 désactivées, 6 flags pour Frank)

**Écart au protocole, assumé et documenté** : les 22 cartes partagent la même
plomberie (helpers présages datés, hooks gel/retard/sacrifice/prière, piège du
Cycle) — je les ai câblées en un bloc puis équilibrées par cycles de mesure,
au lieu de lots par faction. Chaque cycle = pool_metrics N=5000 (le N=1000
initial s'est révélé illisible : erreur-type ±9pp sur la contribution).

### Chiffres finaux (pool_metrics N=15000, config figée après 3 cycles)

Baseline draft re-mesurée à N=15000 sur l'arbre d'avant-cartes (worktree
6c2b3cc) : yokai 54,3 · norse 47,7 · egyptian 53,5 · greek 44,4 · aztec 50,0 ·
Ascension 1,9 % · 9,94 tours. (Le baseline N=1000 initial était trop bruité —
il avait fait croire à une alerte aztec −5,6pp qui n'existait pas.)

**Gates de fin de vague :**

| Gate | Mesure | État |
|---|---|---|
| Winrates factions draft, relatif ±4pp | y −1,1 · n −0,9 · e +2,4 · g +2,5 · a −2,8 | ✅ |
| Winrates factions Libre | identiques au baseline (pool Arena-only, golden byte-identique) | ✅ |
| Durée moyenne ≤ 12 tours | 10,12 (draft) · 10,10 (libre) | ✅ |
| 0 crash sur 1000 parties | 0 crash sur 15 000 duels draftés + batterie complète | ✅ |
| Ascension ∈ [5,40] % | harnais test_faith : 11,0 % ✅ · **draft : 3,0 %** (baseline 1,9) | ❌ draft, cf. décisions |
| Play rate ≥ 40 % · contrib ∈ [−8,+15]pp | 12/20 cartes actives ✅ · 8 flags analysés ci-dessous | ⚠️ partiel |

**Golden** : byte-identique au snapshot de la branche (vérifié après chaque
cycle). Aucune régénération nécessaire pour cette vague : le pool est
Arena-only, la Partie Libre n'a pas bougé d'un octet.

### Tableau final des cartes (N=15000)

| Carte | Coût (design→final) | Stats | Play rate | Contrib | Statut |
|---|---|---|---|---|---|
| Zashiki-Warashi (P_ZASHIKI) | 1 | 1/1→**1/3** | 92 % | −1,6 | ✅ |
| Kodama (P_KODAMA) | 1 | 1/3 | 93 % | −3,2 | ✅ |
| Hitodama (P_HITODAMA) | 1 | — | 76 % | −6,7 | ✅ |
| Procession des Lanternes (P_PROCESSION) | 3→**2** | — | 33 % | −5,3 | ⚠️ play rate |
| Voile du Rêve (P_VOILE_REVE) | 2→1 | — | 79 % | **−35,4** | ❌ DÉSACTIVÉE |
| Ratatoskr (P_RATATOSKR) | 1 | 1/2 | 94 % | +5,1 | ✅ |
| Godi des Runes (P_GODI) | 2 | 1/3→**1/5** | 92 % | +5,3 | ✅ |
| Fil de Verdandi (P_FIL_VERDANDI) | 2 | — | 91 % | −9,5 | ✅* borderline |
| Gjallarhorn (P_GJALLARHORN) | 3 (nerf 4 annulé) | — | 51 % | +13,2 | ✅ |
| Nidhogg (P_NIDHOGG) | 7 | 6/6, croît +2/+2→**+1/+1** | 68 % | **+21,0** | ⚠️ biais de classe |
| Ouadjet (P_OUADJET) | 2 | 2/3→**3/5** | 89 % | −4,8 | ✅ |
| Rite des Ouchebtis (P_RITE_OUCHEBTIS) | 1→**2** | jetons 0/2 | 87 % | −14,8 | ✅* borderline |
| Sceau de Râ (P_SCEAU_RA) | 2→**1** | — | 26 % | +1,4 | ⚠️ play rate |
| Hoplite du Serment (P_HOPLITE) | 2 | 2/3→**3/4** | 88 % | −4,8 | ✅ |
| Talos (P_TALOS) | 5 | 3/8 | 77 % | −7,7 | ✅ |
| Les Moires (P_MOIRES) | 6 | 2/7→**4/8** | 65 % | +1,9 | ✅ |
| Trépied de la Pythie (P_TREPIED) | 2 | — | 93 % | −7,1 | ✅ |
| Voile de Léthé (P_VOILE_LETHE) | 2→1 | — | 11-14 % | — | ❌ DÉSACTIVÉE |
| Prêtre du Cinquième Soleil (P_PRETRE_SOLEIL) | 3 | 3/3→**4/4** | 87 % | −1,0 | ✅ |
| Couteau… — vague 2 | | | | | |
| Offrande au Cinquième Soleil (P_OFFRANDE) | 2→**4** | — | 41 % | **+19,4** | ⚠️ biais de classe |
| Éclipse Totale (P_ECLIPSE) | 4→**5** | — | 54 % | +15,4 | ✅* au bord du gate |
| Briser le Calendrier (P_BRISER) | 3→**1** | — | 26 % | +3,8 | ⚠️ play rate |

\* borderline = l'écart au gate est inférieur à l'erreur-type de la mesure
(±4-6pp pour les cartes à play rate > 85 %, dont le groupe témoin « en main
non jouée » est minuscule). Valeurs multi-runs : Fil de Verdandi −6,3/−2,6/−9,5 ;
Rite des Ouchebtis −5,2/−9,7/−6,8/−14,8.

### Cartes désactivées (règle des 3 cycles appliquée)

1. **Voile du Rêve** — contribution −29,9 / −32,3 / −35,4 sur trois mesures
   indépendantes N=5000+ : signal réel, la carte FAIT PERDRE son drafteur.
   Causes identifiées : (a) endormir des monstres adverses les rend
   inattaquables hors zénith Nuit → on protège les cibles qu'on voulait tuer ;
   (b) le réveil adverse nourrit les payoffs Réveil ADVERSES (Mujnina,
   Inugami : notifyWake déclenche pour les deux camps) ; (c) l'effet arrive
   daté sur [Nuit], souvent trop tard. Ajustements épuisés (coût 2→1, cibles
   2→3). **Proposition de redesign pour Frank** : y adjoindre un corps (façon
   Baku, dont la contribution draft est +4,2) — « monstre 2/3 : Éveil —
   Présage sur [Nuit] : endormez 2 monstres adverses », OU inverser la cible
   (endort VOS monstres pour les protéger/réveiller avec Procession), OU
   déclencher les cauchemars (X dégâts aux dormeurs à l'échéance, amorce de
   Nue vague 2).
2. **Voile de Léthé** — play rate 11-14 % sur 3 cycles : STRUCTUREL. La carte
   cible « un de VOS présages », or les Grecs n'ont AUCUN générateur de
   présage en faction (leurs 2 sorts-pilier sont le Trépied — un piège — et
   Léthé lui-même) ; en draft mono-orienté greek il n'y a presque jamais de
   présage allié à voiler. Aucun levier chiffré n'existe. **Proposition** :
   autoriser aussi le ciblage d'un présage ADVERSE (voler le fil au lieu de
   cacher le sien — reste dans le verbe grec « CACHER »), ou donner aux Grecs
   un générateur commun (la Pythie existante omen_dmg1 est trop rare : 1
   exemplaire dans le pool).

### Flags « hors gate » CONSERVÉS ACTIFS — décision Frank requise

Principe appliqué (documenté, pas tranché à ta place) : je ne désactive que
les cartes qui NUISENT mesurablement à leur drafteur (Voile du Rêve). Quand le
gate échoue pour une raison de MÉTRIQUE ou d'ARCHÉTYPE, je garde la carte et
je te l'apporte :

- **Biais « win-more » de la contribution en draft** : les bombes tardives et
  payoffs de sacrifice se jouent quand on est déjà en position de force → la
  métrique les gonfle mécaniquement. Contrôle sur les cartes EXISTANTES en
  draft : Surt **+61,3** · Fenrir **+49,7** · Kraken **+41,8** · Ryuu +33,8 ·
  Typhon +22,8 · Namazu +20,5 · Huay Chivo +21,3 (et Golem **−14,0** de
  l'autre côté). Nidhogg (+21,0), Offrande (+19,4) et Éclipse (+15,4) sont
  DANS ou SOUS la norme de leur classe. Les désactiver reviendrait à
  recaler la moitié du pool existant. → à trancher : gate contribution
  recalibré par classe de coût, ou nerfs supplémentaires hors levier chiffré.
- **Cartes conditionnelles vs gate play rate ≥ 40 %** : Briser le Calendrier
  (26 %, contrib +3,8), Sceau de Râ (26 %, +1,4), Procession (33 %, −5,3)
  fonctionnent quand leur fenêtre existe — l'IA refuse les poses mortes
  (l'alternative mesurée : Procession jouée à vide = −28pp). Leur play rate
  est plafonné par la densité de présages/momies/dormeurs du pool, pas par
  leurs chiffres. → à trancher : gate play rate assoupli pour les réactives,
  ou densité d'enablers augmentée (vague 2 en apporte : Bennu, Khepri,
  Jorogumo, Kasha…). NB : la vague 2 devrait mécaniquement relever ces play
  rates ; je re-mesure en fin de vague 2 avant toute conclusion.

### Ascension en draft : 3,0 % < gate [5,40] — levier design, pas chiffré

En Libre (harnais test_faith) : 11,0 % ✅. En draft : 1,9 % → 3,0 % (+1,1pp
grâce aux porteurs vague 1), loin des 5 %. Cause : un deck drafté de 40 cartes
ne contient en moyenne que ~2-3 porteurs de Ferveur (vs 4/59 dans le harnais),
et l'IA CONTROL ne prie qu'en surplus. Leviers possibles (tous à toi) :
FAITH_WIN < 16 en Arena, plus de porteurs par draft (bonus de pick), profil IA
RUSH pour les decks à Foi, ou accepter que l'Ascension soit rare en Arena.

### Ajustements refusés / annulés (traçabilité)

- Gjallarhorn coût 3→4 (cycle 1, réponse à « norse +6,0pp ») : ANNULÉ au
  cycle 3 — l'alerte norse était du bruit N=1000 ; à N=15000 norse est à
  −0,9pp du baseline. Carte revenue au design pur.
- Trépied coût 2→1 (cycle 2) : ANNULÉ au cycle 3 (surgonflée à +17,1pp) —
  retour au design 2, contribution finale −7,1 ✅.

## VAGUE 2 — Éphémères, Nocturne/Diurne, reste des archétypes : TERMINÉE ✅ (1 désactivée, 2 gelées télégraphe)

30 cartes implémentées (7 yokai, 5 norse, 7 egyptian, 4 greek, 7 aztec dont
2 sorts) + 3 mots-clés moteur : **Éphémère (phases)** (`m.eph`, estompage/
matérialisation au tick exact, chute d'Icare à la fin de Midi), **Nocturne/
Diurne** (`m.dn`, bascule Jour=Aube+Midi / Nuit=Nuit+Ténèbres, Crépuscule
conserve la face, dégâts suivis avec plancher 1, buffs tiers perdus à la
bascule — simplification documentée), **Canalisation** (« Rituel N » du
design : Verdandi gel-tant-que-canalise consommé par la fin de ronde, Grand
Prêtre réanimation des morts de la fenêtre, interruption par mort/départ/
Sommeil). Plus : exil d'Ammit (court-circuite Endurance/Momie/Dernier
Souffle), Jorogumo sur tout endormissement adverse, Nornes = annulation de la
1ʳᵉ manipulation temporelle adverse du tour (mutualisée avec le piège du
Trépied), Kasha (kill nocturne → présage sur l'Aube), Bennu (renaissance
auto-inscrite sur la Frise, boucle visible et décalable), Hydre (survie →
présage +2/+2), Maât (rattrapage de Foi à l'Aube), Tlaltecuhtli (dévore au
Crépuscule). **Gelées (décision télégraphe, conformément au design)** :
Bouclier de Svalinn, Augure de Delphes — non implémentées.

**test_ephemeral.js créé** : 19 scénarios dirigés (matérialisation/estompage
au tick exact, fenêtre d'une phase, chute d'Icare, bascules Tanuki avec
dégâts conservés et plancher, face d'entrée du Nagual, Sommeil ⨯ fenêtre) +
batterie 300 duels draftés avec invariant vérifié à chaque itération
(estompé ⟺ hors fenêtre). **22/22 ✅, 517 états inspectés, 0 violation.**

### Gates de fin de vague (pool_metrics N=15000, config figée après 3 cycles)

| Gate | Mesure | État |
|---|---|---|
| Factions draft ±4pp (baseline 54,3/47,7/53,5/44,4/50,0) | y −1,5 · n −1,5 · e +2,6 · **g +4,6** · a −4,0 | ⚠️ greek |
| Factions Libre | identiques (golden byte-identique re-vérifié) | ✅ |
| Durée ≤ 12 tours | 10,36 | ✅ |
| 0 crash / 1000 | 0 sur 15 000 (+ 6 nulles d'horloge sans vainqueur, 0,04 %) | ✅ |
| Ascension [5,40] % | Libre 11,0 % ✅ · draft 3,7 % (progresse : 1,9→3,0→3,7) | ❌ draft |
| Gates par carte | 27/49 ✅ · le reste analysé ci-dessous | ⚠️ |

**Le flag greek +4,6pp — arbitrage Frank.** Greek était la faction la plus
FAIBLE du draft (44,4 % baseline) ; le pool de contre-jeu (sa raison d'être,
POOL_DESIGN §5) la ramène à 49,0 %, pile au centre du gate absolu [45,55].
J'ai déjà tempéré (Hoplite 3/4→2/4) ; nerfer davantage des cartes saines pour
maintenir une faction sous sa moyenne me semble contraire à l'intention — je
ne tranche pas : soit tu acceptes +4,6 comme un rééquilibrage voulu, soit
indique quelle(s) carte(s) grecque(s) je re-nerfe.

### Limite de mesure actée (importante pour lire le tableau)

Pour une carte à play rate ≥ 85 %, le groupe témoin « en main, non jouée »
tombe à ~100-150 parties très auto-sélectionnées : l'erreur-type de la
contribution est ±5-6pp et les valeurs oscillent d'un run à l'autre de ±15pp
sans changement de la carte (mesuré : Ratatoskr +13,6 → −16,2 ; Kodama +8,9 →
−26,2 ; Tanuki −1,0 → −16,6). **Les contributions de ces cartes ne sont pas
interprétables contre un gate de largeur 23pp** — colonnes marquées ≈.
La bande fiable est play rate 40-85 %.

### Tableau final vague 2 (N=15000 ; historique multi-runs pour les instables)

| Carte | Coût (design→final) | Stats (design→final) | Play rate | Contrib | Statut |
|---|---|---|---|---|---|
| Tsukumogami | 2 | 2/2→**3/4** | 91 % | ≈ | ✅ (≥85 %) |
| Nurikabe | 2 | 0/6 | 89 % | ≈ −25 | ≈ non mesurable, à surveiller |
| Yume no Seirei | 2 | 3/3 | — | — | ✅ (fenêtre Nuit/Ténèbres) |
| Jorogumo | 4 | 3/5 | 78 % | −11,1 | ⚠️ borderline bas |
| Tanuki (P_TANUKI2) | 3 | 2/4·4/2 | 88 % | ≈ | ✅ (historique −1/−3,5/−6,7) |
| Kasha | 5 | 5/4 | 92 % | −5,1 | ✅ |
| Nue, Chimère des Cauchemars | 6 | 4/6 | 65 % | −4,7 | ✅ |
| Völva (P_VOLVA2) | 2 | 1/4 | 94 % | +0,4 | ✅ |
| Einherjar | 3 | 4/3 | 86 % | −1,8 | ✅ |
| Verdandi | 4 | 3/5 | 77 % | −0,2 | ✅ |
| Skadi | 5 | 4/5 | 79 % | +8,1 | ✅ |
| Les Nornes | 7 | 2/8 | 72 % | +16,4 | ⚠️ biais de classe (bombes) |
| Serpopard (P_SERPOPARD2) | 3 | 4/2→**4/4** | 81 % | −11,8 | ⚠️ rouge (−20→−12 en 3 cycles) |
| Khepri | 3 | 2/4→3/5 | 74 % | −12,4 | ❌ DÉSACTIVÉE |
| Bennu | 4→**3** | 3/3→**4/4** | 79 % | −2,9 | ✅ |
| Grand Prêtre d'Héliopolis | 5→**4** | 2/6→**3/6** | 74 % | −8,8 | ✅* borderline |
| Ammit | 6 | 5/5→**6/6** | 71 % | −4,4 | ✅ |
| Maât | 6 | 4/6 | 64 % | −6,4 | ✅ |
| Bandelettes Sacrées | 1→**2** | — | 81 % | **+21,7** | ⚠️ win-more |
| Icare | 1 | 3/1 | 65 % | −4,2 | ✅ (IA : pose à l'Aube) |
| Cassandre | 2 | 1/5→**2/6** | 90 % | +0,2 | ✅ |
| Chimère (P_CHIMERE2) | 4 | 4/4 | 77 % | +2,6 | ✅ |
| Hydre (P_HYDRE2) | 6 | 5/5 | 66 % | −3,8 | ✅ |
| Ocelotl (P_OCELOTL2) | 2 | 3/2→**4/3** | 92 % | +6,7 | ✅ |
| Nagual (P_NAGUAL2) | 2 | 2/2·4/1→**2/3·4/2** | 85 % | −19,2 | ⚠️ rouge (−3/−16/−12/−19) |
| Xolotl (P_XOLOTL2) | 3 | 2/3→**3/4** | 81 % | −7,8 | ✅ |
| Tzitzimitl | 5→**4** | 6/4 | 92 % | −4,5 | ✅ |
| Cipactli (P_CIPACTLI2) | 6→**5** | 6/6 | 77 % | −9,6 | ✅* borderline |
| Tlaltecuhtli, la Terre Affamée | 7 | 7/7 | 69 % | +5,4 | ✅ |
| Couteau d'Obsidienne | 1 | — | 54 % | −0,9 | ✅ (IA : échange rentable exigé) |

(Vague 1 re-mesurée dans le même run : Talos coût 5→**4** → +8,8 ✅ ·
Trépied re-nerf coût 3 ANNULÉ (−12,1 à 3, ≈ −1 à 2 : retour design) ·
Éclipse +17,7 / Offrande +20,4 / Nidhogg +23,3 : flags win-more inchangés ·
Briser 24 % / Sceau de Râ 36 % / Procession 31 % : flags play rate
conditionnels inchangés — la densité d'enablers vague 2 n'a PAS suffi.)

### Carte désactivée vague 2

3. **Khepri** — contribution −12,4/−14,3/−19,0 persistante ET effet
   structurellement INERTE dans ce moteur : « la première Momie à se relever
   gagne Élan » ne change rien, car une momie relevée n'est pas dans le set
   `summoned` du tour et peut déjà attaquer normalement. La carte est un
   corps sous-staté à effet nul. Ajustements de stats épuisés (2/4→3/5→4/6→
   3/5, l'aller-retour 4/6 sur-gonflait egyptian à 59,5 %).
   **Proposition de redesign** : « À chaque Aube, votre première Momie à se
   relever gagne +2/+2 » (valeur réelle dans ce moteur), ou « … peut attaquer
   CE tour-ci » si tu ajoutes la notion d'attaque immédiate post-lever.

### Décisions supplémentaires en attente (vague 2)

- **Nagual** : tendance négative persistante malgré +1 DEF par face. Levier
  restant si tu veux : face Nocturne 4/2→5/2 (±2 respecté). Je n'y suis pas
  allé : la bascule perd les buffs tiers, c'est peut-être la vraie cause
  (choix moteur documenté, réversible).
- **Serpopard** : la lecture littérale de ta règle des 3 cycles le
  désactiverait (−11,8 final) ; je l'ai gardé actif car la trajectoire
  s'améliore (−20,4→−11,8) et il n'est pas toxique. Confirme ou coupe.
- **Nornes +16,4** : 1,4pp au-dessus du gate, bombe 7-coût (norme de classe
  +20/+60). Aucun levier propre restant (le corps 2/8 est l'identité).

## VAGUE 3 — auras de régents

_(non commencée)_
