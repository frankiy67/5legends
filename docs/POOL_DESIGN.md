# 5 LEGENDS · LE POOL : proposition de design complet

Document de propositions. Chaque carte est à VALIDER / MODIFIER / JETER par Frank. Rien ici n'est implémenté. Les coûts et statlines sont des points de départ calibrés au jugé sur la courbe existante : le harnais de simulation tranchera à l'implémentation, vague par vague. Ce document répond aussi aux décisions de design en attente dans docs/PILIERS_A_DESIGNER.md (Présages, Ferveur/Égide, contre-jeu de la Frise, auras des régents).

---

## 1. Ce que disent tes deux listes (au niveau des patterns)

Le cube MTG Arena (~540 cartes) et la tier list Arena Hearthstone ne sont pas des jeux : ce sont des pools de draft. Six leçons structurelles en ressortent, sans copier une seule carte :

1. **Les communes portent l'identité, les rares portent les payoffs, les épiques sont des bombes conditionnelles, les légendaires sont des signatures narratives.** Un archétype qu'on ne peut pas drafter en communes n'existe pas.
2. **La densité de réponses doit suivre la densité de menaces.** Le cube déborde d'interaction efficace à bas coût. Si les menaces montent et pas les réponses, le jeu devient un concours de curve.
3. **Les meilleures cartes de draft sont flexibles, pas seulement puissantes.** Le sommet de la tier list Hearthstone, ce sont des cartes souples jouables dans tout deck.
4. **Les cartes-liants font les signaux de draft.** Une carte bonne dans deux archétypes crée les ponts qui rendent un draft intéressant.
5. **La courbe est reine** : l'écrasante majorité du pool coûte 1 à 4, les 6+ sont rares et gagnent la partie.
6. **Chaque couleur a des interdits stricts.** Ce que le blanc ne fait JAMAIS définit le blanc autant que ce qu'il fait. C'est le color pie, et c'est la discipline qui crée l'identité.

## 2. L'innovation centrale : le camembert TEMPOREL

MTG distribue son identité par couleur (agression, contrôle, rampe...). Hearthstone par classe. **5 Legends distribue la sienne par relation au temps.** Chaque faction a UN verbe temporel qui lui appartient, et des interdits stricts. Aucun jeu ne fait ça, parce qu'aucun jeu n'a d'horloge partagée.

| Faction | Verbe temporel | Ce qu'elle fait au Cycle | Interdits (le pie) |
|---|---|---|---|
| **Yokai** | RETARDER | Fait durer la nuit, repousse les échéances, endort | Jamais de résurrection de masse, jamais de destruction directe de Présages |
| **Norse** | FIGER et VOIR | Gèle le temps, lit l'avenir (Prophétie), inévitabilité (Ragnarök) | Jamais de Sommeil, jamais de résurrection, presque pas d'Esquive |
| **Egyptian** | BOUCLER | L'Aube revient toujours : résurrection programmée, cycles | Jamais de gel du Cycle, jamais de Sommeil |
| **Greek** | SAVOIR et CACHER | Ne bouge pas le temps : le lit, le cache, le punit (pièges, oracles, Égide) | Ne peut NI avancer NI retarder le Cycle, jamais de résurrection |
| **Aztec** | AVANCER | Précipite le temps en payant le prix du sang, payoffs de Ténèbres | Jamais de gel, presque pas de pioche, pas d'info cachée |

Ce tableau est la loi. Toute nouvelle carte doit respecter le verbe et les interdits de sa faction. Les 10 cartes temporelles existantes s'y conforment déjà presque parfaitement (Heh fige : norse ; Urd retarde à sa mort : norse-frontière, acceptable en gardienne du destin).

## 3. Budget de mots-clés (la discipline anti-surcharge)

Le jeu a déjà ~10 mots-clés vivants. On n'introduit pas tout d'un coup. Trois vagues :

- **Vague 1** : Présage (déjà en moteur), **Rituel N** (canalisation sur N transitions de phase, interruptible si le monstre quitte le jeu ou s'endort), **Ferveur** et **Égide** (déjà en moteur, enfin portés par des cartes).
- **Vague 2** : **Éphémère (phases)** : le monstre n'existe physiquement que pendant les phases listées, il s'estompe hors fenêtre et revient à la suivante. **Nocturne / Diurne** : deux statlines. Jour = Aube + Midi, Nuit = Nuit + Ténèbres, le Crépuscule conserve la face courante.
- **Vague 3 (module optionnel, décision Frank)** : **Sablier** : ressource Sable gagnée en subissant ou contrant une manipulation temporelle, dépensée pour déplacer le Cycle d'un cran. Puissant mais c'est une 2e ressource : à ne valider que si les vagues 1 et 2 laissent de l'appétit pour plus de complexité.

## 4. Où vont les nouvelles cartes (la réponse au problème du deck fixe)

Les decks de Partie Libre restent à 59 cartes : on n'y touche pas avant le deckbuilder. **Toutes les nouvelles cartes entrent dans le pool de draft de l'Arena**, ton mode phare, où un grand pool diversifié est un pur gain (c'est exactement ce que sont tes deux listes de référence). Cible : passer le pool de 186 à ~250 cartes en 3 vagues mesurées. Une poignée de cartes validées par la data pourront ensuite intégrer les decks fixes, en ajout net documenté, comme la brique D l'a fait.

---

## 5. Le pool, faction par faction

Format : Nom · coût · ATK/DEF · rareté : texte. (rôle)
Les 2 Présages par faction répondent au pilier 1, les porteurs Ferveur/Égide au pilier 3, les auras de régents au pilier 4. Tout est proposition.

### YOKAI · le peuple du Rêve (archétypes : Sommeil/Réveil · Éphémères nocturnes · Tempo d'illusion)

**Présages (pilier 1)**
- Voile du Rêve · 2 · sort · rare : Présage sur [Nuit] : endormez jusqu'à 2 monstres adverses.
- Procession des Lanternes · 3 · sort · rare : Présage sur [phase +2] : vos dormeurs se réveillent avec +2/+2. (le payoff Réveil devient une échéance visible que l'adversaire peut décaler)

**Monstres**
- Kodama · 1 · 1/3 · commune : quand le Cycle est retardé ou figé, piochez 1 (une fois par tour). (le liant temporel yokai)
- Tsukumogami · 2 · 2/2 · commune : Dernier Souffle : retardez le Cycle d'un cran. (le verbe de la faction sur une commune)
- Nurikabe · 2 · 0/6 · commune : Rempart. Éphémère (Crépuscule, Nuit, Ténèbres). (le mur qui n'existe que la nuit, vague 2)
- Zashiki-Warashi · 1 · 1/1 · commune : Ferveur. Tant qu'elle prie, elle a Esquive. (porteur pilier 3)
- Yume no Seirei · 2 · 3/3 · rare : Éphémère (Nuit, Ténèbres). Éveil : endormez un adverse. (vague 2)
- Jorogumo · 4 · 3/5 · rare : quand un monstre adverse s'endort, Jorogumo gagne +1/+0. (payoff Sommeil qui grossit)
- Tanuki · 3 · rare : Diurne 2/4 Rempart · Nocturne 4/2 Élan. (l'affiche du mot-clé Nocturne/Diurne, vague 2)
- Kasha · 5 · 5/4 · épique : Élan. Quand elle tue un monstre pendant la Nuit ou les Ténèbres, inscrivez un Présage sur [Aube] : 2 dégâts au joueur adverse. (le chariot qui emporte les âmes : convertit le tempo nocturne en menace datée)
- Nue, Chimère des Cauchemars · 6 · 4/6 · légendaire : Éveil : chaque monstre adverse endormi subit des dégâts égaux à sa propre ATK. (le finisher du plan Sommeil : leurs cauchemars les dévorent)

**Sort de contre-jeu Frise**
- Hitodama · 1 · sort · commune : retardez le Cycle d'un cran. Si un Présage adverse a été repoussé, piochez 1. (le contre-jeu yokai passe par son verbe : on ne détruit pas le destin, on le fuit)

**Auras de régents (à mapper sur les dieux yokai < 40 % de play rate)**
- Régent de Nuit : le Sommeil dure 1 tour de plus.
- Régent de Nuit : à l'entrée en Nuit, endormez le monstre adverse le plus fort.
- Régent de Crépuscule : vos Éphémères ne s'estompent pas à la phase suivante.

### NORSE · les Tisseuses du Destin (archétypes : Forteresse à échéances · Prophétie/contrôle · Ragnarök)

**Présages (pilier 1)**
- Gjallarhorn · 3 · sort · rare : Présage sur [phase +1] : vos Remparts gagnent Frénésie jusqu'à votre prochain tour. (le mur devient une menace datée : le fix du taux de combo à 27,7 %)
- Fil de Verdandi · 2 · sort · rare : Présage sur [phase +2] : figez le Cycle pendant 1 transition. (programmer le gel)

**Monstres**
- Ratatoskr · 1 · 1/2 · commune : quand un Présage se déclenche (n'importe quel camp), piochez 1 (une fois par tour). (le messager qui court sur la Frise : liant universel)
- Völva · 2 · 1/4 · commune : Éveil : Prophétie. (l'accès commun au verbe VOIR)
- Godi des Runes · 2 · 1/3 · commune : Ferveur. Quand vous figez le Cycle, +1 Foi. (porteur pilier 3, marie le gel et l'Ascension)
- Einherjar · 3 · 4/3 · commune : Frénésie tant que le Cycle est figé. (payoff gel agressif)
- Verdandi · 4 · 3/5 · rare : Rituel 1 : le Cycle est figé tant qu'elle canalise. (l'audit la voulait, la voici)
- Skadi · 5 · 4/5 · rare : Éveil : figez le Cycle 1 transition. +2 ATK tant que le Cycle est figé.
- Nidhogg · 7 · 6/6 · épique : à chaque Ténèbres, dévore le Présage adverse le plus proche et gagne +2/+2. (destruction de Présage à la norse : inévitable, programmée)
- Les Nornes · 7 · 2/8 · légendaire : Éveil : Prophétie. La première manipulation temporelle adverse de chaque tour est annulée. (le trio de l'audit condensé en une signature lisible : le contrôle total du destin)

**Sort de contre-jeu télégraphe**
- Bouclier de Svalinn · 2 · sort · rare : annulez une frappe télégraphiée visant un allié, puis piochez 1. (dépend de la décision télégraphe : à geler si le mode reste off)

**Auras de régents**
- Régent de Ténèbres : vos effets de Ténèbres (Ragnarök inclus) infligent +1.
- Régent de Ténèbres : le Cycle ne peut pas être avancé.
- Régent de Midi : les Prophéties révèlent aussi le Présage adverse le plus proche.

### EGYPTIAN · les Éternels Retours (archétypes : Momie/Aube · Rituel funéraire · Jugement)

**Présages (pilier 1)**
- Sceau de Râ · 2 · sort · rare : Présage sur [Aube] : vos Momies se relèvent immédiatement avec +1/+1.
- Rite des Ouchebtis · 1 · sort · commune : Présage sur [phase +2] : invoquez deux Ouchebtis 0/2 Rempart. (du corps à retardement, fourrage à sacrifier pour rien... sauf que non, le Sacrifice c'est aztec : fourrage à Rituel)

**Monstres**
- Ouadjet · 2 · 2/3 · commune : Ferveur. Tant qu'elle prie, vos autres monstres en prière ont +0/+1. (porteur pilier 3)
- Serpopard · 3 · 4/2 · commune : Élan pendant l'Aube. (l'agression synchronisée au zénith)
- Khepri · 3 · 2/4 · rare : à chaque Aube, votre première Momie à se relever gagne Élan. (le scarabée qui pousse le soleil)
- Bennu · 4 · 3/3 · rare : Dernier Souffle : inscrivez un Présage sur [Aube] : Bennu renaît en 4/4. (le phénix qui s'auto-inscrit sur la Frise : l'adversaire VOIT la renaissance arriver et peut la décaler. Ma carte préférée du document.)
- Grand Prêtre d'Héliopolis · 5 · 2/6 · épique : Rituel 2 : à l'échéance, réanimez tous les alliés morts pendant le Rituel. (la fenêtre de contre-jeu est énorme et visible : tue le prêtre ou vide son cimetière)
- Ammit · 6 · 5/5 · épique : Dévoreuse : les monstres qu'elle tue sont exilés (ni Dernier Souffle, ni Momie, ni réanimation). (la Pesée des cœurs : l'anti-récursion du format, y compris en miroir)
- Maât · 6 · 4/6 · légendaire : à chaque Aube, si vous avez moins de Foi que l'adversaire, gagnez 2 Foi. (la balance qui rattrape : rend la course à l'Ascension disputable)

**Sort outil**
- Bandelettes Sacrées · 1 · sort · commune : donnez Momie à un allié. (la réponse égyptienne au télégraphe : on ne pare pas, on revient)

**Auras de régents**
- Régent d'Aube : les Momies se relèvent avec +1/+1.
- Régent d'Aube : la première Momie de chaque Aube gagne Élan.
- Régent de Nuit : vos monstres morts pendant la Nuit reviennent face cachée à l'Aube (Momie temporaire 1 fois).

### GREEK · les Voyants et les Voiles (archétypes : Pièges/information · Égide/Ascension protégée · Éphémères solaires)

**Présages (pilier 1)**
- Voile de Léthé · 2 · sort · rare : cachez un de vos Présages (face cachée) et décalez-le d'une case au choix. (le seul déplacement de Présage du jeu : les Grecs ne bougent pas le temps, ils bougent ce qui est écrit dedans)
- Trépied de la Pythie · 2 · sort · rare : Piège (face caché) : quand l'adversaire manipule le Cycle, annulez cette manipulation et piochez 2. (la punition grecque du temps : tu ne le bouges pas, tu taxes ceux qui le font)

**Monstres**
- Icare · 1 · 3/1 · commune : Éphémère (Aube, Midi). Quand Midi se termine, Icare chute (détruit). (le glass cannon sur minuterie : agressif, tragique, lisible. Vague 2)
- Hoplite du Serment · 2 · 2/3 · commune : Ferveur. (le corps simple de l'Ascension)
- Cassandre · 2 · 1/5 · rare : les Présages adverses sont révélés. Quand un Présage adverse se déclenche, piochez 1. (l'information pure)
- Augure de Delphes · 3 · 2/4 · rare : vos frappes télégraphiées sont cachées : la cible n'est révélée qu'à la résolution. (dépend de la décision télégraphe)
- Chimère · 4 · 4/4 · épique : Éveil : choisissez deux : Élan · 2 dégâts à un monstre · Égide jusqu'à votre prochain tour. (la flexibilité que le draft adore)
- Talos · 5 · 3/8 · rare : Rempart. Égide : vos monstres en prière ne peuvent pas être ciblés tant que Talos est éveillé. (le gardien de bronze du plan Prière, porteur pilier 3)
- Hydre · 6 · 5/5 · épique : quand elle survit à des dégâts, inscrivez un Présage sur [phase +1] : Hydre gagne +2/+2. (les têtes repoussent avec un temps de retard, visibles sur la Frise)
- Les Moires · 6 · 2/7 · légendaire : Éveil, puis à chaque Midi : coupez un fil : détruisez un Présage OU annulez une frappe télégraphiée. (les ciseaux du destin : le contre-jeu premium du pilier 1, la signature grecque absolue)

**Auras de régents**
- Régent de Midi : vos pièges sont déclenchables à volonté (le zénith devient un trône à défendre).
- Régent de Midi : les frappes télégraphiées adverses sont révélées un tour plus tôt.
- Régent d'Aube : vos monstres en prière ont Égide.

### AZTEC · les Dévoreurs de Soleils (archétypes : Sacrifice/Autel · Course au Crépuscule · Éclipse/Ténèbres)

**Présages (pilier 1)**
- Éclipse Totale · 4 · sort · épique : Présage sur [Ténèbres] : sacrifiez tous vos monstres ; le joueur adverse subit leur ATK totale. (la bombe à retardement du format : toute la table joue autour de cette case de la Frise)
- Offrande au Cinquième Soleil · 2 · sort · commune : Présage sur [Crépuscule] : sacrifiez un allié, gagnez 2 Foi et piochez 1. (le pont Sacrifice vers Ascension, programmé)

**Monstres**
- Ocelotl · 2 · 3/2 · commune : Frénésie pendant votre zénith (Crépuscule). (l'aggro qui court vers son heure)
- Nagual · 2 · commune : Diurne 2/2 · Nocturne 4/1. (le change-forme, vague 2)
- Xolotl · 3 · 2/3 · commune : quand vous avancez le Cycle, Xolotl gagne +1/+1. (le chien du crépuscule qui grossit à chaque pas vers la nuit)
- Prêtre du Cinquième Soleil · 3 · 3/3 · rare : Ferveur 2 quand un allié est sacrifié. (porteur pilier 3, le cœur de l'archétype "je brûle tout pour monter")
- Tzitzimitl · 5 · 6/4 · épique : Éphémère (Ténèbres). Élan. (le démon des étoiles : le plan de jeu aztec devient "précipiter le monde dans le noir pour libérer le monstre". Vague 2)
- Cipactli · 6 · 6/6 · rare : Éveil : sacrifiez un autre allié, sinon Cipactli vous inflige 3. (la gueule primordiale exige d'être nourrie)
- Tlaltecuhtli, la Terre Affamée · 7 · 7/7 · légendaire : à chaque Crépuscule, dévore votre monstre le plus faible et gagne ses stats. (la win condition qui te dévore toi-même si tu ne gagnes pas vite)

**Sorts**
- Couteau d'Obsidienne · 1 · sort · commune : sacrifiez un allié : infligez son ATK à un monstre. (le removal au prix du sang)
- Briser le Calendrier · 3 · sort · rare : détruisez un Présage ; son propriétaire subit 2 dégâts. (le contre-jeu Frise version violente)

**Auras de régents**
- Régent de Crépuscule : vos sacrifices donnent +1 Foi.
- Régent de Crépuscule : quand le Cycle avance, 1 dégât au joueur adverse.
- Régent de Ténèbres : vos Éphémères de Ténèbres entrent avec +1/+1.

---

## 6. Combos signature (à mettre en vitrine, à récompenser en Arena)

- **Yokai** : Baku endort + zénith Nuit (dormeurs ciblables) + Nue : les cauchemars exécutent le board. Ou Tsukumogami + Kodama : chaque mort ralentit le temps et pioche.
- **Norse** : Heh fige pendant Ténèbres + Fenrir : le Ragnarök en boucle (existe déjà, à filmer). Nouveau : Gjallarhorn + Forteresse : le mur annonce l'heure de la sortie.
- **Egyptian** : Bennu meurt + accélération vers l'Aube : le phénix renaît un tour plus tôt que prévu. Ammit en miroir contre les Momies adverses.
- **Greek** : Cassandre + Trépied de la Pythie : l'adversaire joue à découvert et paie chaque geste temporel. Moires qui coupent l'Éclipse Totale aztec à une case de l'échéance : LE moment de clip du jeu.
- **Aztec** : Xolotl + Danse temporelle existante + Tzitzimitl : on précipite les Ténèbres pour libérer le démon. Éclipse Totale + Offrande : la Frise devient un compte à rebours que tout le monde regarde.
- **Inter-factions (Arena)** : Ratatoskr (norse) dans tout deck à Présages. Kodama (yokai) + gel norse. Prêtre du Cinquième Soleil (aztec) + Talos (greek) : on sacrifie ET on prie sous protection.

## 7. Plan de test et d'équilibrage (le vrai, pas du papier)

Je ne peux pas tester des cartes sur papier, et personne ne le peut : les chiffres ci-dessus sont des points de départ. La validation, c'est ton harnais, par vagues :

- **Vague 1 (~30 cartes)** : les 10 Présages + le contre-jeu (Moires, Briser le Calendrier, Voile de Léthé, Hitodama, Nidhogg) + les porteurs Ferveur/Égide + les liants (Ratatoskr, Kodama). Gates : winrates factions [45,55] en Arena ET en Libre, Ascension [5,40] %, durée ≤ 12 tours, 0 crash sur 1 000, play rate de chaque nouvelle carte ≥ 40 %, contribution ∈ [-8, +15]pp.
- **Vague 2 (~25 cartes)** : Éphémère + Nocturne/Diurne + le reste des archétypes. Mêmes gates, plus un test dédié test_ephemeral (matérialisation/estompage au tick exact).
- **Vague 3 (si validée par toi)** : module Sablier + conversions de régents restantes.
- Chaque vague passe par : implémentation Claude Code sur une branche dédiée → batterie complète + card_metrics → rapport → TES ajustements → merge. La méthode de la phase 0, appliquée au contenu.

## 8. Ce qui reste à trancher par toi (les vraies décisions)

1. **Télégraphe on/off** : la décision n°1 de PILIERS_A_DESIGNER.md. Elle conditionne 3 cartes du pool (Svalinn, Augure de Delphes, l'aura de Midi grecque). Va jouer le mode, puis tranche.
2. **Le camembert temporel (section 2)** : c'est la proposition la plus structurante du document. Si tu le valides, il devient la loi de toute carte future.
3. **Chaque carte** : coche valide / modifie / jette. Tes rejets m'intéressent autant que tes validations, ils dessinent ton goût.
4. **Sablier** : module optionnel, à décider après la vague 2.
5. **Les noms** : j'ai puisé dans les mythologies réelles en évitant tes cartes existantes, mais c'est ton univers : renomme librement.
