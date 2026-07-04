# DECISIONS V5 — journal des décisions de design (branche fix-audit-v5)

Format : `[PHASE.TÂCHE] décision · alternatives écartées · pourquoi · ⚠️ à relire par Frank`

---

**[1.1]** Rampe de gems rendue symétrique (`maxGems = min(10, G.turn)`) au lieu de compenser
P1 par une pioche · alternatives écartées : pioche +1 P1, main 5/4 inversée ·
pourquoi : GAME_RULES.md décrit une rampe symétrique (« Both players gain +1 max gem ») —
l'asymétrie était un bug d'implémentation, pas un choix de design · ⚠️ à relire par Frank

**[1.1]** Compensation « going second » retenue : main 5/4 (existante) + Coin ÉTALÉ
(+1 gem temporaire aux tours 1 et 2 de P2) · alternatives écartées : coin simple +1 T1
(→ P1 54,4 %), coin +2 T1 (→ P1 44,5 %), pioche +1 · pourquoi : seule variante mesurée
dans [47, 53] (47,5 % sur 1000 parties) · ⚠️ à relire par Frank

**[1.1d]** Intensité du Ragnarök norse réduite +3/+3 → +2/+2 (Endurance conservée) ·
alternative écartée : nerfs de stats supplémentaires sur ~8 monstres norse · pourquoi :
norse restait à 65 % après 2 itérations de stats — le moteur Ragnarök (déclenché par
toute mort de monstre en partie norse) était le contributeur dominant, le toucher est
plus chirurgical que dénaturer les statlines · ⚠️ à relire par Frank

**[2.1]** SAND UP : aucune carte du pool actuel (171) n'utilisait `entry_sandup` /
`exit_sandup` / `god_sandup2_draw` / `spell_dmg4_sand` — le tableau de remplacement
ancien→nouveau est donc VIDE ; suppression des chemins morts (handlers entry/exit,
scoring IA, cibles, applyTargetEffect) · alternative écartée : conserver le code mort ·
pourquoi : la capacité avait déjà disparu des données au commit « 70 dieux », il ne
restait que du code orphelin · NB : le flag runtime `sanded` est CONSERVÉ (utilisé par
Xipe Totec god_freeze_attacks et le cooldown du Golem), badge renommé « Immobilisé » ·
⚠️ à relire par Frank

**[2.2]** BEWITCH : également absent des données (le flag `bewitched` n'était posé par
aucune carte) ; le vrai porteur du problème « 50 % de rater = RNG binaire » était
`coinflip_defense` (Sirènes). Conversion : Sirènes → ESQUIVE déterministe (« la première
attaque subie à chaque phase du Cycle rate », compteur reset au changement de phase,
badge 💨) ; suppression des checks bewitched 50 % dans aiCombatPhase · alternative
écartée : garder le coin-flip des Sirènes · pourquoi : même mécanique RNG binaire que
Bewitch, l'esprit de la tâche s'applique · impact mesuré : greek 51,0 % → 51,3 % (±3 ✅) ·
⚠️ à relire par Frank

**[3.2]** Dieu yokai « choisis la prochaine phase » nommé **KAGUYA** (princesse lunaire,
liée au temps céleste) · alternatives écartées : OMOIKANE_T (trop proche d'OMAIKANE
existant, risque de confusion), TSUKUYOMI (collision) · pourquoi : figure mythologique
distincte, zéro collision d'ID · ⚠️ à relire par Frank

**[3.2]** Taille de deck recalculée : 54 → **57 cartes** (42 monstres + 15 dieux) en
intégrant les 2 cartes temporelles par faction (monstre uncommon ×2, dieu ×1) ·
alternative écartée : retirer 3 cartes existantes pour rester à 54 · pourquoi : le pool
existant vient d'être équilibré, l'ajout net est plus simple et mesurable ·
⚠️ à relire par Frank

**[3.1]** Déclenchement manuel grec (Midi) : Héra déclenchée à la main pioche 3 SANS la
condition « pas de dégâts ce tour » (non traçable proprement côté humain) — le coût
d'opportunité est de révéler/consommer le piège · ⚠️ à relire par Frank

**[3.3]** Compensation P2 réduite après Phase 3 : la pioche bonus T2 est SUPPRIMÉE
(les cartes temporelles + zéniths ont avantagé P2 : P1 était tombé à 45,1 %) ;
reste main 5/4 + coin +1 gem T1 → P1 51,7 % sur 1000 · ⚠️ à relire par Frank

**[4.1]** Arena PORTÉE (réécriture adaptée) plutôt que cherry-pickée commit par commit ·
alternative écartée : `git cherry-pick` des 9 commits Arena de feat-gameplay-v2 ·
pourquoi : leur game.js intègre le système de Foi/marché/pouvoirs divins (hors périmètre)
dans chaque fonction touchée — les conflits auraient réintroduit du code hors périmètre ;
le draft (40 picks 1/4, garantie ≥1 carte de faction, valeur IA), les écrans et le HUD
sont repris de la branche et adaptés aux phases 1-3 (mulligan, zéniths, cartes
temporelles fonctionnent en Arena) · ⚠️ à relire par Frank

**[4.2]** Difficulté IA progressive modélisée par les ressources de départ de l'IA
(d0 : main 4 sans coin · d1 : main 5 + coin = équilibre standard · d2 : main 6 + coin) ·
alternative écartée : profils IA multi-stratégies de feat-ai-multistrat · pourquoi :
hors périmètre du cherry-pick Arena, et l'équilibre v5 est calibré sur l'IA actuelle ·
⚠️ à relire par Frank

**[4.2]** Boss perdu = −10 HP de run et on RETENTE le boss (la carte ne progresse pas) ;
duel normal perdu = −10 HP et on avance au nœud suivant · pourquoi : éviter le
soft-lock d'une run qui ne peut ni avancer ni finir · ⚠️ à relire par Frank

**[6.1]** Renommage des fondamentales : affichage uniquement (txt, glossaire, badges,
GAME_RULES) — les clés internes de caps (`hurry`, `protect`…) sont conservées ·
alternative écartée : renommer aussi les clés de code · pourquoi : zéro risque de
régression moteur pour un résultat joueur identique · ⚠️ à relire par Frank

**[6.3]** Critère « win contribution ∈ [−2pp, +4pp] pour 100 % des dieux » : non
vérifiable statistiquement (endogénéité + bruit ±5pp à n≈400/dieu). Réinterprété en :
0 dieu à effet mort (9 réparés : Hestia, Geb, Centeotl, Fujin, Osiris, Amaterasu,
Raijin, Tezcatlipoca, Râ + 18 types de cibles implémentés), play rate ∈ [40, 90] pour
65/75 dieux (10 restants entre 31 et 39 % ou 91-96 %), plus aucune contribution < −15pp
hors Amaterasu (−11,6pp résiduel) · ⚠️ à relire par Frank

**[6.4]** Définition d'« exécution de combo » : Berceuse = Réveil déclenché OU réveil
d'un colosse auto-endormi · Forteresse = bonus Forteresse à l'attaque OU riposte avec
≥2 Remparts · Toile = payoff Toile déclenché par une révélation · Marée = +2 ATK ou plus
de jetons en combat · Autel = payoff Autel/Sacrifice déclenché · ⚠️ à relire par Frank

**[6.4]** ZEUS converti en piège foudre (fd_minus4_all), ARÈS en piège anti-dieu
(fd_cancel_spell étendu aux dieux), HÉPHAÏSTOS en piège forgeron (fd_blocker) —
nécessaires à l'archétype grec « Toile de pièges » (4 pièges + 9 corps payoff) ·
alternative écartée : créer 3 nouveaux dieux fd (gonflement du pool) ·
⚠️ à relire par Frank

---
# v1-unification (briques A→D)

**[A1]** C3 d'ascension NON porté : la victoire par PV=0 reste, la Foi S'AJOUTE
(consigne Frank explicite) — toutes les conséquences de C3 dans la branche
(attaques au visage retirées, effets PV neutralisés, orbe PV supprimée) sont
ignorées · FAITH_WIN=16 et DESECRATE_FAITH=1 repris des expériences
feat-ai-multistrat · P2_START_FAITH=0 (décision Frank Q3 : « valeur retenue »
du rapport de calibration J2, contexte v1 déjà équilibré P1/P2) · horloge T18 :
égalité de Foi → tie-breaker aux PV (consigne v1 ; la branche faisait match
nul), double égalité → nul (Arena : nul = défaite du joueur) · validé par Frank

**[A1]** Mots-clés Ferveur/Égide/Sanctuaire implémentés MOTEUR SEUL, zéro carte
convertie (décision Frank Q1) · alternatives écartées : liste branche adaptée
v5, ajout sans retrait · pourquoi : les porteurs branche ont divergé en v5
(Mujnina→Réveil, Pégase→Toile, Hestia réparée en 6.3) et toute conversion
touche l'équilibrage gelé en phase 0 · sources de Foi v1 : Prière et
Profanation uniquement · validé par Frank

**[A2]** Les JETONS (cost 0) ne peuvent pas prier · alternative écartée :
prière universelle (spec branche implicite) · pourquoi : les hordes de jetons
(Medjed) transformaient la course en spam — egyptian +4pp mesurés ·
⚠️ à relire par Frank

**[A2]** aiPrayPhase adaptée au monde double-victoire : exécutée APRÈS les
checks léthal/anti-stall, une créature ne prie que si elle n'a AUCUNE attaque
productive (kill propre, trade-up, percée de mur, chip au visage) et n'est pas
un Rempart debout · alternative écartée : formule branche « garde ceil(menace/2)
défenseurs, prie le reste » (réglée pour un monde SANS PV — mesurée ici :
Ascension 0-3,8 %, hors cible) · ⚠️ à relire par Frank

**[A2]** CONTROL profane en priorité : un fidèle à genoux tuable PROPREMENT
passe devant les autres kills dans pickAITarget · pourquoi : sans contre, prier
était gratuit (les factions tortue montaient) ; c'est l'usage prévu de
DESECRATE_FAITH · RAID (brique B) ira plus loin (profanation même sale) ·
⚠️ à relire par Frank

**[A2/GATE]** Arbitrage Frank (P4 seul) : gate factions RELATIF à la baseline
fix-audit-v5, **±4pp à N=200** (baseline : yokai 51,1 · norse 46,5 · egyptian
59,3 · greek 47,1 · aztec 46,0) · egyptian ~59 % = dette PRÉEXISTANTE (le
54,5 % de la batterie v5 était un artefact d'échantillon N=100) · norse −3,9pp
absorbé par le gate · P1/P2/P3/P5 refusés : aucune modif d'IA, de règle ou de
carte en phase 0 ; rééquilibrage norse + nerf egyptian reportés à la session
d'équilibrage dédiée (phase 5) · décision Frank 2026-07-04

**[A3]** predictCombat étendu : renvoi en main Artémis/Izanami d'une cible
survivante (`targetBounced`) — trou de prédiction PRÉEXISTANT débusqué par
test_preview via les nouveaux chemins de jeu de la brique A ·
⚠️ à relire par Frank

**[B1]** CONTROL = IA brique A à l'identique (no-op strict, golden
byte-identique vérifié) ; les branches GUARD/RAID d'aiPrayPhase suivent la
spec branche (P1/P3) et non l'heuristique CONTROL v1 — GUARD prie DERRIÈRE
ses gardiennes même sans « attaque improductive », RAID prie sans « bonne
attaque » (kill franc / profanation / Ferveur) · ⚠️ à relire par Frank

**[B2]** Signature RAID recalibrée : l'axe « Ferveur > CONTROL×1.1 » de la
branche est affiché mais RETIRÉ des assertions (0 porteur de Ferveur en v1,
décision Q1) ; remplacé par profanations > ×1.1 ET kills ≥ ×0.95 · signatures
RUSH et GUARD de la branche conservées telles quelles ·
⚠️ à relire par Frank

**[B3]** Mapping profil par boss : Zeus RUSH (le Cycle s'emballe) · Anubis
RAID (dieu des morts, profanateur) · Odin GUARD (prie derrière ses 2 murs) ·
Quetzalcoatl RAID (échange sans peur grâce à l'Endurance) · Amaterasu CONTROL
(généraliste) · sélecteur de difficulté Partie Libre = ressources d0/d1/d2 de
l'Arena (défaut Normal d1 = comportement historique), pas de profil exposé au
joueur (les profils restent réservés aux boss/harnais en v1) ·
⚠️ à relire par Frank

**[C]** i18n : écrans setup, boutons, modales de ciblage, écran de victoire,
labels face cachée/endormi/piège et descripteurs de factions (vocabulaire v5 :
Sommeil·Rempart / Immortel·Rempart / Frénésie·Jetons / Offrande·Pièges /
Immortel·Offrande) traduits · le LOG DE BATAILLE reste hors périmètre
(décision Frank Q2 : golden byte-identique — les textes de log sont
sérialisés) · les NOMS DE FACTIONS (Yokai/Norse/Egyptian/Greek/Aztec) sont
traités comme noms propres et conservés (identifiants transverses code/tests/
HUD) · le badge de cadre « ANYTIME » est conservé comme marqueur visuel ·
⚠️ à relire par Frank

**[D1]** Présages datés en TICKS (compteur absolu de transitions du Cycle,
`G.cycleTick`) et non en noms de phase · alternative écartée : échéance par
nom de phase (ambiguë avec gel/reroll/retard) · conséquences : geler le Cycle
RETARDE les présages, l'accélérer les RAPPROCHE ; un retard du Cycle (marche
arrière) compte aussi comme une transition · ⚠️ à relire par Frank

**[D1]** doEndTurn reste SYNC : le rendre async décalait d'une microtask les
morts différées flottantes en sim (golden_check l'a détecté, seed 69 —
inversion de 2 lignes de log). Résolution des présages : awaitée aux points
sûrs (début de tour IA, mi-tour IA après une carte, fin de doAttack, playCard),
fire-and-forget quand le tour qui commence est humain ; TOUS les awaits sont
CONDITIONNELS (file non vide) pour ne pas ajouter de cession de microtask ·
⚠️ à relire par Frank

**[D2]** Effet placeholder ramené de « 2 dégâts » (exemple de la consigne) à
« 1 dégât à une créature adverse aléatoire » · pourquoi : à 2 dégâts, les
présages décimaient les boards larges de petits corps — egyptian sortait du
gate ±4pp (−4,3pp) ; à 1 dégât le gate passe (egyptian −3,0) · les 5 cartes
sont volontairement IDENTIQUES (2/3 c2 uncommon) : placeholders, pas le design
final · noms : Onmyōji / Völva / Ouadjet / Pythie / Tonalpouhqui (devins de
chaque panthéon, zéro collision d'ID) · ⚠️ à relire par Frank

**[SKY]** Ciel Vivant branché dans renderCycleBanner (chemin de rendu pur)
et NON dans setCyclePhase (option de la consigne) · pourquoi : setCyclePhase
tourne aussi en simulation (golden) alors que renderCycleBanner est déjà
appelé à chaque renderAll et reste inerte sous les stubs Node · conséquence :
le moteur n'est pas touché du tout, golden byte-identique par construction
(vérifié : 200/200 parties strictement identiques) · ⚠️ à relire par Frank

**[SKY]** Deux couches #sky (z-index:-1, cross-fade opacité 1,8 s) plutôt
qu'une factorisation avec le ciel du titre · le titre anime AU TEMPS
(hue-rotate en boucle 30 s), le plateau à la PHASE réelle du Cycle —
factoriser aurait forcé la réécriture du titre pour un bénéfice nul ·
fix au passage : sélecteur `.bf-cycle-tint` du crépuscule (espace manquante,
la teinte ne s'appliquait jamais) · teintes de terrain réaccordées sur les
5 palettes du ciel · ⚠️ à relire par Frank

**[SKY]** Midi assombri (horizon #5e94cf → #4a7cb4) après vérif contraste
CALCULÉE (WCAG, composition ciel × overlays de terrain) : or du HUD à
6,4–9,4:1 sur les terrains, bande d'horizon brute à 2,8:1 mais purement
décorative (Frise, médaillon, bonus ont leur fond sombre opaque) · vérif
navigateur impossible en session (extension Chrome non connectée) → à
valider À L'ŒIL par Frank, Midi en particulier · ambiance : étoiles Nuit /
poussière Aube / braise Ténèbres en transform+opacité seuls (composité GPU,
zéro rAF), pause sur la couche cachée, animation:none en reduced-motion
(toggle in-game ET pref OS) · ⚠️ à relire par Frank
