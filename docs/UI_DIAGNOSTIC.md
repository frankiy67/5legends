# Diagnostic UI des pouvoirs — 5 Legends (branche feat-pool)

> Généré par `tools/ui_powers.js` (Playwright / Chromium réel). Session **read-only** côté gameplay : `src/game.js` et `index.html` sont byte-identiques. Le harnais inline les octets exacts de game.js dans une page jetable + un pont `window.__D`, met chaque carte en situation de façon déterministe, la joue par `playCard` (le point d'entrée réel de l'UI), puis lit **l'état interne ET le DOM rendu**.

## Le compte

**227 conformes · 8 non conformes · 3 non testables** sur **238** cartes.

| Verdict | Nombre |
|---|---|
| ✅ CONFORME | 227 |
| ❌ NON CONFORME | 8 |
| &nbsp;&nbsp;└ dont [LOGIQUE] | 8 |
| &nbsp;&nbsp;└ dont [CÂBLAGE] | 0 |
| &nbsp;&nbsp;└ dont [UI] | 0 |
| ⚠️ NON TESTABLE | 3 |

## Les causes communes (le plus important)

> **Le motif de fond (1 cause = les 8 non-conformités).** Toutes les cartes non conformes partagent la même racine : **la capacité figure sur la carte (texte, souvent l'indicateur HUD et le score de draft de l'IA) mais aucun code du moteur ne l'applique — l'effet est inerte.** Aucune n'est un problème d'affichage ([UI]) ni de câblage UI→moteur ([CÂBLAGE]) : le moteur lui-même ne fait rien. Cela recoupe le rapport de nuit (Khepri/Sekhmet/Élan post-résurrection). Trois sous-familles :

| Cause racine | Cartes touchées | Détail |
|---|---|---|
| Passif « Toujours » jamais appliqué aux stats (cap présente seulement dans le HUD et le score de draft IA) | **3** — Kappa, Eikthyrnir, Otomitl | `passive_yokai_buff`, `passive_adj_buff21`, `passive_empty_hand_buff` |
| Capacité sans handler moteur (déclarée sur la carte, référencée uniquement par le score de draft IA) | **3** — Sha, Rokh, Hydre | `recycle_return`, `exit_self_sleep`, `entry_token_per_greek` |
| Mot-clé Malédiction cosmétique : le drapeau `cursed` n'est jamais posé sur le porteur | **2** — Serpopard, Uraeus | `curse`, `curse_protect` |

## Tableau des NON CONFORMES

| Carte | Faction | Cap | Effet attendu | Effet observé | Cause |
|---|---|---|---|---|---|
| Serpopard | egyptian | `curse` | Malédiction : 1 dégât suffit à la détruire (cursed=true) | cursed=false | **[LOGIQUE]** |
| Uraeus | egyptian | `curse_protect` | Malédiction : 1 dégât suffit à la détruire (cursed=true) | cursed=false | **[LOGIQUE]** |
| Hydre | greek | `entry_token_per_greek` | Éveil : invoque des jetons | terrain J1 1→2 | **[LOGIQUE]** |
| Rokh | egyptian | `exit_self_sleep` | Mort : reste en jeu face caché puis revient | au cimetière | **[LOGIQUE]** |
| Eikthyrnir | norse | `passive_adj_buff21` | Toujours : allié(s) gagnent le bonus de stats | BUDDY 2/2 (base 2/2) | **[LOGIQUE]** |
| Otomitl | aztec | `passive_empty_hand_buff` | Si main vide : alliés +2 ATK/+1 DEF | BUDDY2 2/2 | **[LOGIQUE]** |
| Kappa | yokai | `passive_yokai_buff` | Toujours : allié(s) gagnent le bonus de stats | BUDDY 2/2 (base 2/2) | **[LOGIQUE]** |
| Sha | egyptian | `recycle_return` | Mort : Sha retourne en main | au cimetière | **[LOGIQUE]** |

## Non testables (condition impossible à mettre en place déterministe)

| Carte | Faction | Cap | Pourquoi non testable |
|---|---|---|---|
| Bragi | norse | `god_copy_spell` | aucun scénario déterministe pour cap="god_copy_spell" |
| Frigg | norse | `god_cancel_ms` | aucun scénario déterministe pour cap="god_cancel_ms" |
| Oracle de Delphes | greek | `oracle_3` | aucun scénario déterministe pour cap="oracle_3" |

## Conformes (227)

<details><summary>Liste des cartes conformes</summary>

- **canalisation** (1) : Grand Prêtre d'Héliopolis
- **combat** (4) : Ymir, Manticore, Djinn, Ladon
- **copie** (3) : Bakeneko, Chimère, Ocelotl
- **debut-tour** (4) : Huginn, Fenrir, Medjed, Charybde
- **devoreur** (1) : Tlaltecuhtli, la Terre Affamée
- **dieu** (55) : Amaterasu, Ebisu, Fujin, Hachiman, Izanagi, Kagutsuchi, Raijin, Ryujin, Susanoo, Tenjin, Tsukuyomi, Balder, Heimdall, Hoder, Idunn, Loki, Odin, Thor, Ullr, Vali, Amun-Ra, Anubis, Bastet, Geb, Horus, Isis, Osiris, Ptah, Ra, Set, Thoth, Aphrodite, Apollon, Arès, Artémis, Athéna, Dionysos, Héphaïstos, Héra, Hermès, Hestia, Poséidon, Zeus, Trépied de la Pythie, Chalchiuhtlicue, Coatlicue, Ehecatl, Huitzilopochtli, Mayahuel, Mictlantecuhtli, Tezcatlipoca, Tlaloc, Tlaltecuhtli, Tonatiuh, Xipe Totec
- **egide** (1) : Talos
- **entree-degats** (3) : Karura, Typhon, Izcoalt
- **entree-jeu-gratuit** (1) : Kaqkoj
- **entree-pioche** (2) : Léviathan, Scylla
- **entree-revive** (1) : Benou
- **entree-tokens** (3) : Kraken, Babaï, Tlaltecuhtli
- **entree-wipe** (1) : Surt
- **ephemere** (3) : Nurikabe, Icare, Tzitzimitl
- **exil** (1) : Ammit
- **ferveur** (4) : Zashiki-Warashi, Godi des Runes, Ouadjet, Hoplite du Serment
- **fin-tour** (2) : Abtu, Efrit
- **flexible** (1) : Chimère
- **foi** (1) : Maât
- **momie** (3) : Momie, Khepri, Bandelettes Sacrées
- **mot-cle** (38) : Ningyo, Kitsune, Onikuma, Nue, Raiju, Tsuchinoko, Tsuchigumo, Namazu, Draugr, Eitri, Ljosalfar, Landvaettir, Tanngrisnir, Sleipnir, Jotunn, Garm, Jörmungandr, Apis, Sphinx, Criosphinx, Golem, Sirènes, Pégase, Harpie, Lion de Némée, Ophiotaurus, Gorgone, Cyclope, Cerbère, Minotaure, Chaneque, Cuetzpalin, Chullachaki, Tzi, Nagual, Xiuhcoatl, Izcaqlli, Huay Chivo
- **nocturne-diurne** (2) : Tanuki, Nagual
- **oracle** (2) : Python, Teuzauhtototl
- **passif** (8) : Dokkalfar, Hildisvini, Niddhog, Hieracosphinx, Centaure, Camazotz, Chohix, Quetzal
- **phase-keyword** (3) : Einherjar, Serpopard, Ocelotl
- **presage** (23) : Onmyōji, Kasha, Voile du Rêve, Procession des Lanternes, Hitodama, Völva, Ratatoskr, Nidhogg, Gjallarhorn, Fil de Verdandi, Ouadjet, Bennu, Sceau de Râ, Rite des Ouchebtis, Pythie, Les Moires, Cassandre, Hydre, Voile de Léthé, Tonalpouhqui, Éclipse Totale, Offrande au Cinquième Soleil, Briser le Calendrier
- **recherche** (1) : Ratatosk
- **recuperation** (2) : Echidna, Cipactli
- **regent** (14) : Izanami, Omaikane, Sarutahiko, Freya, Tyr, Vidar, Khonsu, Sekhmet, Sobek, Déméter, Hadès, Centeotl, Coyolxauhqui, Xiuhtecuhtli
- **reveil** (2) : Mujnina, Inugami
- **sacrifice** (4) : Ahuizotl, Prêtre du Cinquième Soleil, Cipactli, Couteau d'Obsidienne
- **sommeil** (6) : Baku, Oni, Ryuu, Yume no Seirei, Jorogumo, Nue, Chimère des Cauchemars
- **sortie** (7) : Tanuki, Keukegen, Ushi-Oni, Akkorokamui, Idi, Griffon, Ceuyatl
- **temporel** (17) : Toki-Onna, Kaguya, Kodama, Tsukumogami, Urd, Skuld, Völva, Verdandi, Skadi, Les Nornes, Seshat, Heh, Horae, Kairos, Xolotl, Tonatiuh Renaissant, Xolotl
- **toile** (2) : Hippocampe, Satyre
- **vol** (1) : Aani

</details>

## Comment relancer le harnais

```bash
# Prérequis (déjà installés) : Playwright + Chromium en devDependency
npm install            # installe playwright (voir package.json)
npx playwright install chromium

# Lancer le diagnostic complet (génère docs/UI_DIAGNOSTIC.md + ui_diag/*.png)
node tools/ui_powers.js

# Déboguer une seule carte, navigateur visible :
node tools/ui_powers.js --card P_BENNU --headed
```

Le harnais démarre son propre serveur statique et un Chromium headless ; il n'a pas besoin du `python3 -m http.server` manuel. La page jetable `ui_diag_harness.html` est régénérée puis supprimée à chaque exécution (game.js jamais modifié).

### Méthode & limites

- **Mise en situation déterministe** : `initGame(faction, autre, 'sim')` puis reset du plateau ; la carte testée est placée en main de J1 et jouée par `playCard` (le handler que le clic sur la carte appelle). En mode `sim` les fenêtres de réaction et le ciblage humain s'auto-résolvent (aiPickTarget), sans blocage de modale.
- **Double lecture** : après résolution, on lit l'objet d'état `G` (via le pont) ET le DOM produit par `renderAll`. Un effet présent en interne mais absent à l'écran ⇒ **[UI]**.
- **Distinction CÂBLAGE / LOGIQUE** : si jouer la carte n'applique pas l'effet, on rejoue en invoquant directement le moteur (`applyEntry`/`playGod`). Si l'effet apparaît alors ⇒ **[CÂBLAGE]** ; sinon ⇒ **[LOGIQUE]** (effet réellement absent/faux).
- **NON TESTABLE** : capacités dont le déclencheur ne se met pas en place de façon déterministe dans ce harnais (ex. contres qui exigent une vraie pile de réaction, effets d'information cachée). Listées franchement plutôt qu'inventées.
