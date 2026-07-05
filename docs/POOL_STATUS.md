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

## VAGUE 1 — cœur (~22 cartes)

_(en cours)_

## VAGUE 2 — Éphémères, Nocturne/Diurne, reste des archétypes

_(non commencée)_

## VAGUE 3 — auras de régents

_(non commencée)_
