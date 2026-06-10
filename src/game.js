/**
 * game.js — 5 Legends Game Engine
 *
 * All game logic: card data, rendering, combat, AI, UI.
 * Loaded as a classic script by index.html.
 *
 * Équilibrage v4 — validé sur 22 500 simulations
 * Winrates : Yokai 50.8% · Norse 48.9% · Egyptian 47.8% · Greek 53.6% · Aztec 48.9%
 * Écart max : 5.8pp
 */



// ══════════════════════════════════════════════════
// SYSTÈME AUDIO — BGM + SFX Web Audio
// ══════════════════════════════════════════════════
// ══════════════════════════════════════════════════
// SYSTÈME AUDIO — BGM + SFX + Préférences
// ══════════════════════════════════════════════════
const Audio5L = (() => {
  let ctx = null;
  let bgmEl = null;
  let bgmGain = null;
  let sfxGain = null;
  let musicStarted = false;

  // Prefs with localStorage persistence
  const prefs = {
    musicOn:  JSON.parse(localStorage.getItem('5L_musicOn')  ?? 'true'),
    sfxOn:    JSON.parse(localStorage.getItem('5L_sfxOn')    ?? 'true'),
    musicVol: parseFloat(localStorage.getItem('5L_musicVol') ?? '0.35'),
    sfxVol:   parseFloat(localStorage.getItem('5L_sfxVol')   ?? '0.7'),
    save() {
      localStorage.setItem('5L_musicOn',  JSON.stringify(this.musicOn));
      localStorage.setItem('5L_sfxOn',    JSON.stringify(this.sfxOn));
      localStorage.setItem('5L_musicVol', this.musicVol);
      localStorage.setItem('5L_sfxVol',   this.sfxVol);
    }
  };

  function initCtx() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    bgmGain = ctx.createGain(); bgmGain.gain.value = prefs.musicOn ? prefs.musicVol : 0;
    sfxGain = ctx.createGain(); sfxGain.gain.value = prefs.sfxOn   ? prefs.sfxVol   : 0;
    bgmGain.connect(ctx.destination);
    sfxGain.connect(ctx.destination);
  }

  function startMusic() {
    if (musicStarted) return;
    initCtx();
    bgmEl = document.getElementById('bgm');
    if (!bgmEl) return;
    try { const src = ctx.createMediaElementSource(bgmEl); src.connect(bgmGain); } catch(e) {}
    bgmEl.volume = 1;
    bgmEl.play().catch(() => {});
    musicStarted = true;
    updatePrefUI();
  }

  // Try autoplay immediately, retry on first interaction
  function tryAutoplay() {
    const el = document.getElementById('bgm');
    if (!el) return;
    el.play().then(() => {
      // Browser allowed direct autoplay — now wire Web Audio
      startMusic();
    }).catch(() => {
      // Blocked — wait for first interaction
      const resume = () => { startMusic(); document.removeEventListener('click', resume); document.removeEventListener('keydown', resume); };
      document.addEventListener('click',   resume);
      document.addEventListener('keydown', resume);
    });
  }

  function fadeTo(targetVol, duration = 1.5) {
    if (!bgmGain || !ctx || !prefs.musicOn) return;
    bgmGain.gain.linearRampToValueAtTime(targetVol * prefs.musicVol / 0.35, ctx.currentTime + duration);
  }

  function combatMode() { fadeTo(0.18, 1.2); }
  function menuMode()   { fadeTo(0.35, 1.5); }

  function setMusicOn(on) {
    prefs.musicOn = on;
    prefs.save();
    if (bgmGain && ctx) bgmGain.gain.cancelScheduledValues(ctx.currentTime);
    if (on) {
      if (!musicStarted) startMusic();
      else { if (bgmGain && ctx) bgmGain.gain.setValueAtTime(prefs.musicVol, ctx.currentTime); if (bgmEl) bgmEl.play().catch(()=>{}); }
    } else {
      if (bgmGain && ctx) bgmGain.gain.setValueAtTime(0, ctx.currentTime);
      if (bgmEl) bgmEl.pause();
    }
    updatePrefUI();
  }

  function setSfxOn(on) {
    prefs.sfxOn = on;
    prefs.save();
    if (sfxGain && ctx) sfxGain.gain.setValueAtTime(on ? prefs.sfxVol : 0, ctx.currentTime);
    updatePrefUI();
  }

  function setMusicVol(v) {
    prefs.musicVol = v;
    prefs.save();
    if (bgmGain && ctx && prefs.musicOn) bgmGain.gain.setValueAtTime(v, ctx.currentTime);
    updatePrefUI();
  }

  function setSfxVol(v) {
    prefs.sfxVol = v;
    prefs.save();
    if (sfxGain && ctx && prefs.sfxOn) sfxGain.gain.setValueAtTime(v, ctx.currentTime);
    updatePrefUI();
  }

  function tone(freq, type, dur, vol, delay=0) {
    if (!ctx || !prefs.sfxOn) return;
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.connect(g); g.connect(sfxGain);
    osc.type = type; osc.frequency.value = freq;
    const t = ctx.currentTime + delay;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t); osc.stop(t + dur + 0.01);
  }

  function noise(dur, vol, delay=0) {
    if (!ctx || !prefs.sfxOn) return;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; // audio noise: never from game RNG stream
    const src2 = ctx.createBufferSource();
    const g = ctx.createGain();
    const flt = ctx.createBiquadFilter();
    src2.buffer = buf; flt.type = 'bandpass'; flt.frequency.value = 800;
    src2.connect(flt); flt.connect(g); g.connect(sfxGain);
    const t = ctx.currentTime + delay;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src2.start(t); src2.stop(t + dur + 0.01);
  }

  const sfx = {
    playCard:  () => { initCtx(); tone(180,'sine',0.18,0.5); tone(320,'square',0.12,0.3,0.04); tone(520,'sine',0.08,0.2,0.10); },
    playGod:   () => { initCtx(); tone(220,'sine',0.5,0.35); tone(330,'sine',0.4,0.25,0.1); tone(440,'sine',0.35,0.2,0.2); tone(660,'sine',0.25,0.15,0.35); },
    playSpell: () => { initCtx(); tone(600,'sawtooth',0.08,0.25); tone(800,'sine',0.06,0.2,0.05); tone(1200,'sine',0.04,0.15,0.12); },
    attack:    () => { initCtx(); noise(0.06,0.6); tone(120,'sawtooth',0.15,0.4,0.05); },
    damage:    () => { initCtx(); tone(80,'square',0.22,0.55); tone(55,'sine',0.18,0.4,0.08); noise(0.1,0.35,0.02); },
    death:     () => { initCtx(); tone(200,'sine',0.35,0.4); tone(150,'sine',0.3,0.35,0.1); tone(90,'square',0.25,0.25,0.22); noise(0.15,0.3,0.05); },
    victory:   () => { initCtx(); [0,0.15,0.3,0.5].forEach((d,i) => tone([523,659,784,1047][i],'sine',0.5,0.4,d)); },
    defeat:    () => { initCtx(); tone(300,'sine',0.6,0.4); tone(220,'sine',0.7,0.4,0.3); tone(150,'sine',0.9,0.4,0.7); },
    endTurn:   () => { initCtx(); tone(440,'sine',0.12,0.3); tone(330,'sine',0.1,0.2,0.1); },
    draw:      () => { initCtx(); tone(900,'sine',0.07,0.25); tone(1200,'sine',0.05,0.2,0.06); },
    select:    () => { initCtx(); tone(660,'sine',0.05,0.15); },
    error:     () => { initCtx(); tone(180,'square',0.12,0.3); tone(160,'square',0.1,0.25,0.08); },
    mana:      () => { initCtx(); tone(800,'sine',0.08,0.2); tone(1000,'sine',0.06,0.18,0.07); },
    heal:      () => { initCtx(); tone(523,'sine',0.15,0.3); tone(659,'sine',0.12,0.25,0.1); tone(784,'sine',0.1,0.2,0.2); },
    cancel:    () => { initCtx(); tone(400,'sawtooth',0.1,0.35); tone(250,'sawtooth',0.12,0.3,0.07); tone(150,'square',0.1,0.25,0.15); },
  };

  function updatePrefUI() {
    const btnMusic = document.getElementById('pref-music-toggle');
    const btnSfx   = document.getElementById('pref-sfx-toggle');
    const slMusic  = document.getElementById('pref-music-vol');
    const slSfx    = document.getElementById('pref-sfx-vol');
    const fab      = document.getElementById('audio-fab');
    if (btnMusic) btnMusic.classList.toggle('pref-on', prefs.musicOn);
    if (btnSfx)   btnSfx.classList.toggle('pref-on', prefs.sfxOn);
    if (slMusic)  slMusic.value = Math.round(prefs.musicVol * 100);
    if (slSfx)    slSfx.value   = Math.round(prefs.sfxVol * 100);
    if (fab) fab.textContent = (prefs.musicOn || prefs.sfxOn) ? '🔊' : '🔇';
  }

  return { startMusic, tryAutoplay, combatMode, menuMode, sfx, initCtx,
           setMusicOn, setSfxOn, setMusicVol, setSfxVol, prefs, updatePrefUI };
})();

document.addEventListener('DOMContentLoaded', () => {
  // Force music on by default (clear stale localStorage)
  if (localStorage.getItem('5L_musicOn') === 'false') {
    localStorage.removeItem('5L_musicOn');
  }
  Audio5L.tryAutoplay();
  Audio5L.updatePrefUI();
  initFactionArt();
  // Also trigger on faction hover/click to reload art
  document.querySelectorAll('.fp').forEach(fp => {
    const f = fp.dataset.f;
    const img = fp.querySelector('.fp-bg');
    if (img && FACTION_ART[f]) img.src = FACTION_ART[f];
  });
});


const FACTION_ART = {
  yokai:    './assets/ui/faction/yokai.jpeg',
  norse:    './assets/ui/faction/norse.jpeg',
  egyptian: './assets/ui/faction/egyptian.jpg',
  greek:    './assets/ui/faction/greek.jpeg',
  aztec:    './assets/ui/faction/aztec.jpeg',
};

const LANDSCAPE_ART = {
  yokai:    './assets/ui/backgrounds/yokai.jpeg',
  norse:    './assets/ui/backgrounds/norse.jpeg',
  egyptian: './assets/ui/backgrounds/egyptian.jpeg',
  greek:    './assets/ui/backgrounds/greek.jpeg',
  aztec:    './assets/ui/backgrounds/aztec.jpeg',
};
const B64_IMAGES = {};
// Map all card IDs to their file paths
(function() {
  const FACTION_MAP = {
    BAKENEKO:'yokai',BAKU:'yokai',KAPPA:'yokai',KEUKEGEN:'yokai',
    KITSUNE:'yokai',MUJINA:'yokai',NAMAZU:'yokai',ONIKUMA:'yokai',
    RAIJU:'yokai',RYUU:'yokai',TANUKI:'yokai',USHIIONI:'yokai',
    EBISU:'yokai',FUJIN:'yokai',IZANAGI:'yokai',IZANAMI:'yokai',
    RAIJIN:'yokai',SUSANOO:'yokai',TSUKUYOMI:'yokai',AMATERASU:'yokai',
    DOKKALFAR:'norse',DRAUGR:'norse',EITRI:'norse',FENRIR:'norse',
    HILDISVINI:'norse',IDI:'norse',JORMUNGANDR:'norse',KRAKEN:'norse',
    LJOSALFAR:'norse',RATATOSK:'norse',SLEIPNIR:'norse',TANNGRISNIR:'norse',
    BALDER:'norse',FREYA:'norse',HEIMDALL:'norse',LOKI:'norse',
    ODIN:'norse',THOR:'norse',TYR:'norse',VIDAR:'norse',
    AANI:'egyptian',BABAI:'egyptian',BENOU:'egyptian',CRIOSPHINX:'egyptian',
    EFRIT:'egyptian',GOLEM:'egyptian',LEVIATHAN:'egyptian',MANTICORE:'egyptian',
    ROKH:'egyptian',SERPOPARD:'egyptian',SPHINX:'egyptian',URAEUS:'egyptian',
    AMUNRA:'egyptian',ANUBIS:'egyptian',HORUS:'egyptian',ISIS:'egyptian',
    OSIRIS:'egyptian',RA:'egyptian',SETH:'egyptian',TOTH:'egyptian',
    CENTAUR:'greek',CERBERUS:'greek',CHARYBDE:'greek',CHIMERA:'greek',
    CYCLOP:'greek',GORGON:'greek',HYDRA:'greek',MINOTAUR:'greek',
    SATYR:'greek',SCYLIA:'greek',SIREN:'greek',TYPHON:'greek',
    APOLLO:'greek',ARES:'greek',ARTHEMIS:'greek',ATHENA:'greek',
    HADES:'greek',HEPHAISTOS:'greek',POSEIDON:'greek',ZEUS:'greek',
    AHUIZOTL:'aztec',CEUYATL:'aztec',CIPACTLI:'aztec',HUAYCHIVO:'aztec',
    IZCAQLLI:'aztec',IZCOALT:'aztec',KAQKOJ:'aztec',OCELOTL:'aztec',
    QUETZAL:'aztec',TEUZAUHTOTOTL:'aztec',TZI:'aztec',XIUHCOATL:'aztec',
    CHALCHIUHTLICUE:'aztec',HUITZILOPOCHTLI:'aztec',MAYAHUEL:'aztec',
    MICTLANTECUHTLI:'aztec',TEZCATLIPOCA:'aztec',TLALOC:'aztec',
    TONATIUH:'aztec',XIUHTECUHTLI:'aztec',
    // New monsters from xlsx
    NINGYO:'yokai',MUJNINA:'yokai',TANUKI:'yokai',KAPPA:'yokai',KEUKEGEN:'yokai',BAKU:'yokai',
    KITSUNE:'yokai',ONIKUMA:'yokai',BAKENEKO:'yokai',NUE:'yokai',KARURA:'yokai',INUGAMI:'yokai',
    ONI:'yokai',RAIJU:'yokai',TSUCHINOKO:'yokai',TSUCHIGUMO:'yokai',USHIONI:'yokai',
    AKKOROKAMUI:'yokai',RYUU:'yokai',NAMAZU:'yokai',
    RATATOSK:'norse',HUGINN:'norse',DRAUGR:'norse',EITRI:'norse',LJOSALFAR:'norse',DOKKALFAR:'norse',
    EIKTHYRNIR:'norse',LANDVAETTIR:'norse',TANNGRISNIR:'norse',SLEIPNIR:'norse',HILDISVINI:'norse',
    JOTUNN:'norse',IDI:'norse',FENRIR:'norse',NIDDHOG:'norse',GARM:'norse',JORMUNGANDR:'norse',
    KRAKEN:'norse',YMIR:'norse',SURT:'norse',
    ABTU:'egyptian',MEDJED:'egyptian',MOMIE:'egyptian',SHA:'egyptian',APIS:'egyptian',BENOU:'egyptian',
    SPHINX:'egyptian',CRIOSPHINX:'egyptian',HIERACOSPHINX:'egyptian',AANI:'egyptian',BABAI:'egyptian',
    MANTICORE:'egyptian',GRIFFON:'egyptian',SERPOPARD:'egyptian',EFRIT:'egyptian',DJINN:'egyptian',
    URAEUS:'egyptian',ROKH:'egyptian',GOLEM:'egyptian',LEVIATHAN:'egyptian',
    SIRENES:'greek',PEGASE:'greek',HIPPOCAMPE:'greek',SATYRE:'greek',HARPIE:'greek',CENTAURE:'greek',
    CHIMERE:'greek',PYTHON:'greek',LIONDENEMEE:'greek',OPHIOTAURUS:'greek',SCYLLA:'greek',
    GORGONE:'greek',CYCLOPE:'greek',ECHIDNA:'greek',CERBERE:'greek',MINOTAURE:'greek',LADON:'greek',
    HYDRE:'greek',CHARYBDE:'greek',TYPHON:'greek',
    CAMAZOTZ:'aztec',CHANEQUE:'aztec',CEUYATL:'aztec',CUETZPALIN:'aztec',TEUZAUHTOTOTL:'aztec',
    CHULLACHAKI:'aztec',AHUIZOTL:'aztec',KAQKOJ:'aztec',OCELOTL:'aztec',TZI:'aztec',CHOHIX:'aztec',
    NAGUAL:'aztec',OTOMITL:'aztec',XIUHCOATL:'aztec',QUETZAL:'aztec',CIPACTLI:'aztec',
    IZCAQLLI:'aztec',IZCOALT:'aztec',HUAYCHIVO:'aztec',TLALTECUHTLI:'aztec',
  };
  for (const [id, faction] of Object.entries(FACTION_MAP)) {
    const filename = id.toLowerCase().replace(/-/g,'').replace(/_/g,'');
    B64_IMAGES[id] = `./assets/cards/${faction}/${filename}.jpeg`;
    B64_IMAGES[id.charAt(0) + id.slice(1).toLowerCase()] = `./assets/cards/${faction}/${filename}.jpeg`;
  }

  // ── Dieux/cartes ajoutés après coup (commit « 70 dieux ») : leurs IDs
  // n'étaient jamais entrés dans FACTION_MAP → illustration cassée. On mappe
  // explicitement vers le fichier réel (alias quand le nom diffère). ──────
  const EXTRA = {
    // Fichier exact présent, simplement absent de FACTION_MAP
    APHRODITE:'greek/aphrodite', BASTET:'egyptian/bastet', BRAGI:'norse/bragi',
    CENTEOTL:'aztec/centeotl', COATLICUE:'aztec/coatlicue', COYOLXAUHQUI:'aztec/coyolxauhqui',
    DEMETER:'greek/demeter', EHECATL:'aztec/ehecatl', FRIGG:'norse/frigg', GEB:'egyptian/geb',
    HACHIMAN:'yokai/hachiman', HERA:'greek/hera', HERMES:'greek/hermes', HODER:'norse/hoder',
    IDUNN:'norse/idunn', KAGUTSUCHI:'yokai/kagutsuchi', OMAIKANE:'yokai/omaikane',
    PTAH:'egyptian/ptah', RYUJIN:'yokai/ryujin', SARUTAHIKO:'yokai/sarutahiko',
    SEKHMET:'egyptian/sekhmet', ULLR:'norse/ullr', VALI:'norse/vali',
    // Monstres grecs nommés en français → fichiers en anglais
    CENTAURE:'greek/centaur', CERBERE:'greek/cerberus', CHIMERE:'greek/chimera',
    CYCLOPE:'greek/cyclop', GORGONE:'greek/gorgon', HYDRE:'greek/hydra',
    MINOTAURE:'greek/minotaur', SATYRE:'greek/satyr', SIRENES:'greek/siren',
    // Alias (nom de fichier différent du nom de carte)
    APOLLON:'greek/apollo', DIONYSOS:'greek/dionysus', THOTH:'egyptian/toth',
    SET:'egyptian/seth', KHONSU:'egyptian/khnum', TENJIN:'yokai/tengin',
    XIPE_TOTEC:'aztec/xipetotec', TLALTECUHTLI_S:'aztec/tlaltecuhtli',
    LION_NEMEE:'greek/liondenemee',
    // Illustrations ajoutées (remplacent les anciens placeholders)
    HESTIA:'greek/hestia', SOBEK:'egyptian/sobek', ORACLE_DELPHES:'greek/oracledelphes',
  };
  for (const [id, rel] of Object.entries(EXTRA)) {
    const p = `./assets/cards/${rel}.jpeg`;
    B64_IMAGES[id] = p;
    B64_IMAGES[id.toUpperCase().replace(/-/g,'').replace(/_/g,'')] = p;
    B64_IMAGES[id.charAt(0) + id.slice(1).toLowerCase()] = p;
  }
})();

// ÉTAPE 2 : lookup function pour les images base64
function getCardImage(cardId) {
  if (!cardId) return '';
  const key = String(cardId).toUpperCase().replace(/-/g,'').replace(/_/g,'');
  return B64_IMAGES[cardId] || B64_IMAGES[key] || B64_IMAGES[cardId.charAt(0).toUpperCase() + cardId.slice(1).toLowerCase()] || '';
}

// Proxy IMGS compatible avec le reste du code
const IMGS = new Proxy({}, {
  get: (_, key) => getCardImage(String(key))
});


const FACTIONS = ['yokai','norse','egyptian','greek','aztec'];

const MONSTERS = {
yokai:[
  // NON-RARES x3
  {id:'NINGYO',     n:'Ningyo',     atk:2,def:2,cost:1,rarity:'common',  cap:'attack_draw',             txt:'Attaque : piochez 1 carte.'},
  {id:'MUJNINA',    n:'Mujnina',    atk:3,def:3,cost:2,rarity:'common',  cap:'heal',                    txt:'Vie : les dégâts soignent votre joueur.'},
  {id:'TANUKI',     n:'Tanuki',     atk:4,def:3,cost:2,rarity:'common',  cap:'exit_search_3def',        txt:'Sortie : Cherchez un monstre DEF ≤3 dans votre deck.'},
  {id:'KAPPA',      n:'Kappa',      atk:5,def:5,cost:4,rarity:'common',  cap:'passive_yokai_buff',      txt:'Toujours : vos autres monstres Yokai gagnent +1/+1.'},
  {id:'KEUKEGEN',   n:'Keukegen',   atk:5,def:6,cost:5,rarity:'common',  cap:'exit_copy_killer',        txt:'Sortie : Invoquez une copie du monstre qui vous a détruit.'},
  {id:'BAKU',       n:'Baku',       atk:6,def:6,cost:6,rarity:'common',  cap:'entry_sleep',             txt:'Entrée : Placez un monstre adverse face caché (Sommeil 2 tours).'},
  // SEMI-RARES x2
  {id:'KITSUNE',    n:'Kitsune',    atk:2,def:1,cost:1,rarity:'uncommon',cap:'hurry',                   txt:'Rapide.'},
  {id:'ONIKUMA',    n:'Onikuma',    atk:2,def:4,cost:2,rarity:'uncommon',cap:'protect',                 txt:'Protection.'},
  {id:'BAKENEKO',   n:'Bakeneko',   atk:2,def:2,cost:2,rarity:'uncommon',cap:'entry_copy_ally',         txt:'Entrée : Bakeneko copie un allié.'},
  {id:'NUE',        n:'Nue',        atk:3,def:6,cost:4,rarity:'uncommon',cap:'curse_endure',            txt:'Malédiction + Endurance.'},
  {id:'KARURA',     n:'Karura',     atk:6,def:5,cost:5,rarity:'uncommon',cap:'entry_dmg4',              txt:'Entrée : 4 dégâts à une cible.'},
  {id:'INUGAMI',    n:'Inugami',    atk:3,def:9,cost:6,rarity:'uncommon',cap:'hit',                     txt:'Double attaque.'},
  {id:'ONI',        n:'Oni',        atk:5,def:9,cost:7,rarity:'uncommon',cap:'hit',                     txt:'Double attaque.'},
  {id:'RAIJU',      n:'Raiju',      atk:8,def:8,cost:8,rarity:'uncommon',cap:'solo_destroy',            txt:'Seul allié : détruit la cible sans combat.'},
  // RARES x1
  {id:'TOKI_ONNA',  n:'Toki-Onna',  atk:2,def:2,cost:2,rarity:'uncommon',cap:'entry_cycle_delay1',      txt:"Entrée : retarde le Cycle Céleste d'une phase."},
  {id:'TSUCHINOKO', n:'Tsuchinoko', atk:5,def:4,cost:3,rarity:'rare',    cap:'curse_endure',            txt:'Malédiction + Endurance.'},
  {id:'TSUCHIGUMO', n:'Tsuchigumo', atk:6,def:7,cost:4,rarity:'rare',    cap:'protect',                 txt:'Protection.'},
  {id:'USHI-ONI',   n:'Ushi-Oni',   atk:6,def:7,cost:5,rarity:'rare',    cap:'exit_dmg3_all',           txt:'Sortie : 3 dégâts à tous les monstres adverses.'},
  {id:'AKKOROKAMUI',n:'Akkorokamui',atk:8,def:8,cost:6,rarity:'rare',    cap:'reincarnation',           txt:'1ère mort : mélangé dans le deck avec +3/+3 permanents.'},
  {id:'RYUU',       n:'Ryuu',       atk:7,def:9,cost:7,rarity:'rare',    cap:'heal',                    txt:'Vie.'},
  {id:'NAMAZU',     n:'Namazu',     atk:7,def:10,cost:8,rarity:'rare',   cap:'hurry',                   txt:'Rapide.'},
],
norse:[
  // NON-RARES x3
  {id:'RATATOSK',   n:'Ratatosk',   atk:1,def:2,cost:1,rarity:'common',  cap:'entry_search_ratatosk',   txt:'Entrée : Cherchez un Ratatosk dans votre deck.'},
  {id:'HUGINN',     n:'Huginn',     atk:2,def:1,cost:3,rarity:'common',  cap:'start_draw',              txt:'Début de tour : Piochez 1 carte.'},
  {id:'DRAUGR',     n:'Draugr',     atk:3,def:2,cost:3,rarity:'common',  cap:'endure',                  txt:'Endurance.'},
  {id:'EITRI',      n:'Eitri',      atk:3,def:5,cost:4,rarity:'common',  cap:'combat_recycle_dmg2',     txt:'Combat : replacez 2 monstres de défausse sous le deck, puis 2 dégâts.'},
  {id:'LJOSALFAR',  n:'Ljosalfar',  atk:6,def:4,cost:5,rarity:'common',  cap:'heal',                    txt:'Vie.'},
  {id:'DOKKALFAR',  n:'Dokkalfar',  atk:6,def:6,cost:6,rarity:'common',  cap:'curse',                   txt:'Malédiction.'},
  // SEMI-RARES x2
  {id:'EIKTHYRNIR', n:'Eikthyrnir', atk:1,def:2,cost:2,rarity:'uncommon',cap:'passive_adj_buff21',      txt:'Toujours : adjacents gagnent +2 ATK / +1 DEF.'},
  {id:'LANDVAETTIR',n:'Landvaettir',atk:4,def:2,cost:2,rarity:'uncommon',cap:'heal',                    txt:'Vie.'},
  {id:'TANNGRISNIR',n:'Tanngrisnir',atk:4,def:2,cost:3,rarity:'uncommon',cap:'endure_hurry',            txt:'Endurance + Rapide.'},
  {id:'SLEIPNIR',   n:'Sleipnir',   atk:6,def:2,cost:4,rarity:'uncommon',cap:'hurry',                   txt:'Rapide.'},
  {id:'HILDISVINI', n:'Hildisvini', atk:3,def:7,cost:5,rarity:'uncommon',cap:'hit',                     txt:'Double attaque.'},
  {id:'JOTUNN',     n:'Jotunn',     atk:6,def:6,cost:6,rarity:'uncommon',cap:'protect',                 txt:'Protection.'},
  {id:'IDI',        n:'Idi',        atk:7,def:9,cost:7,rarity:'uncommon',cap:'exit_search_3def',       txt:'Sortie : Cherchez un monstre DEF ≤3 dans votre deck.'},
  {id:'FENRIR',     n:'Fenrir',     atk:6,def:9,cost:8,rarity:'uncommon',cap:'curse',                  txt:'Malédiction.'},
  // RARES x1
  {id:'URD',        n:'Urd',        atk:3,def:4,cost:4,rarity:'uncommon',cap:'exit_cycle_delay1',       txt:"Mort : retarde le Cycle Céleste d'une phase."},
  {id:'NIDDHOG',    n:'Niddhog',    atk:3,def:4,cost:3,rarity:'rare',    cap:'hit',                     txt:'Double attaque.'},
  {id:'GARM',       n:'Garm',       atk:5,def:4,cost:4,rarity:'rare',    cap:'protect',                 txt:'Protection.'},
  {id:'JORMUNGANDR',n:'Jörmungandr',atk:4,def:7,cost:5,rarity:'rare',   cap:'splash_adjacent',         txt:'Inflige ATK×0.5 dégâts aux monstres adjacents à la cible.'},
  {id:'KRAKEN',     n:'Kraken',     atk:11,def:2,cost:7,rarity:'rare',   cap:'entry_tokens4',           txt:'Entrée : Invoquez 4 jetons 1/1.'},
  {id:'YMIR',       n:'Ymir',       atk:8,def:8,cost:7,rarity:'rare',    cap:'token_per_dmg',           txt:'Toujours : jeton 1/1 par dégât reçu en combat.'},
  {id:'SURT',       n:'Surt',       atk:8,def:9,cost:8,rarity:'rare',   cap:'entry_wipe',              txt:'Entrée : Détruit TOUT (sauf Surt). Déclenche les effets Sortie.'},
],
egyptian:[
  // NON-RARES x3
  {id:'ABTU',       n:'Abtu',       atk:2,def:2,cost:1,rarity:'common',  cap:'end_draw',                txt:'Fin de tour : Piochez 1 carte.'},
  {id:'MEDJED',     n:'Medjed',     atk:2,def:3,cost:2,rarity:'common',  cap:'start_tokens2',           txt:'Début de tour : Invoquez 2 jetons 1/1 (max 6 sur terrain).'},
  {id:'MOMIE',      n:'Momie',      atk:4,def:3,cost:3,rarity:'common',  cap:'endure',                  txt:'Endurance.'},
  {id:'SHA',        n:'Sha',        atk:4,def:3,cost:4,rarity:'common',  cap:'recycle_return',          txt:'Mort : placez 2 monstres de défausse sous le deck, Sha retourne en main.'},
  {id:'APIS',       n:'Apis',       atk:5,def:4,cost:5,rarity:'common',  cap:'heal',                    txt:'Vie.'},
  {id:'BENOU',      n:'Benou',      atk:7,def:6,cost:7,rarity:'common',  cap:'hurry_entry_revive',      txt:'Rapide. Entrée : Ressuscite un allié DEF ≥3 depuis la défausse.'},
  // SEMI-RARES x2
  {id:'SPHINX',     n:'Sphinx',     atk:3,def:4,cost:2,rarity:'uncommon',cap:'protect',                 txt:'Protection.'},
  {id:'CRIOSPHINX', n:'Criosphinx', atk:4,def:2,cost:2,rarity:'uncommon',cap:'heal',                   txt:'Vie.'},
  {id:'HIERACOSPHINX',n:'Hieracosphinx',atk:3,def:5,cost:3,rarity:'uncommon',cap:'hit',                txt:'Double attaque.'},
  {id:'AANI',       n:'Aani',       atk:4,def:5,cost:4,rarity:'uncommon',cap:'temp_steal_hurry',        txt:'Mort : volez un monstre adverse (Rapide) jusquà fin de tour.'},
  {id:'BABAI',      n:'Babaï',      atk:7,def:4,cost:5,rarity:'uncommon',cap:'token_copies_graveyard',  txt:'Entrée : jetons 1/1 copies de 2 monstres en défausse (sans ETB/sortie).'},
  {id:'MANTICORE',  n:'Manticore',  atk:4,def:8,cost:6,rarity:'uncommon',cap:'hit',                    txt:'Double attaque.'},
  {id:'GRIFFON',    n:'Griffon',    atk:8,def:7,cost:7,rarity:'uncommon',cap:'hurry_exit_heal4',        txt:'Rapide. Sortie : +4 PV.'},
  {id:'SERPOPARD',  n:'Serpopard',  atk:4,def:12,cost:8,rarity:'uncommon',cap:'curse',                  txt:'Malédiction.'},
  // RARES x1
  {id:'SESHAT',     n:'Seshat',     atk:2,def:2,cost:3,rarity:'uncommon',cap:'entry_cycle_prophecy',    txt:'Entrée : Prophétie — regardez les 3 prochaines phases du Cycle et choisissez la suivante.'},
  {id:'EFRIT',      n:'Efrit',      atk:4,def:5,cost:3,rarity:'rare',    cap:'end_heal_ally',           txt:'Fin de tour : Soignez totalement un monstre allié ciblé.'},
  {id:'DJINN',      n:'Djinn',      atk:6,def:6,cost:4,rarity:'rare',    cap:'combat_dmg2',             txt:'Combat : 2 dégâts supplémentaires à la cible.'},
  {id:'URAEUS',     n:'Uraeus',     atk:7,def:5,cost:5,rarity:'rare',    cap:'curse_protect',           txt:'Malédiction + Protection.'},
  {id:'ROKH',       n:'Rokh',       atk:5,def:9,cost:6,rarity:'rare',    cap:'exit_self_sleep',         txt:'Mort : Rokh reste en jeu face caché 2 tours puis revient.'},
  {id:'GOLEM',      n:'Golem',      atk:11,def:7,cost:8,rarity:'rare',   cap:'endure_cooldown',         txt:'Endurance. Après avoir attaqué, ne peut plus attaquer le tour suivant.'},
  {id:'LEVIATHAN',  n:'Léviathan',  atk:9,def:10,cost:8,rarity:'rare',  cap:'entry_draw_per_ally',     txt:'Entrée : Piochez 1 carte par allié (max 3).'},
],
greek:[
  // NON-RARES x3
  {id:'SIRENES',    n:'Sirènes',    atk:3,def:1,cost:1,rarity:'common',  cap:'esquive',                 txt:'Esquive : la première attaque subie à chaque phase du Cycle rate.'},
  {id:'PEGASE',     n:'Pégase',     atk:4,def:4,cost:2,rarity:'common',  cap:'hurry_heal',              txt:'Rapide + Vie.'},
  {id:'HIPPOCAMPE', n:'Hippocampe', atk:4,def:3,cost:3,rarity:'common',  cap:'start_filter',            txt:'Début de tour : Défaussez 1 carte pour en piocher 1.'},
  {id:'SATYRE',     n:'Satyre',     atk:5,def:4,cost:4,rarity:'common',  cap:'curse',                   txt:'Malédiction.'},
  {id:'HARPIE',     n:'Harpie',     atk:6,def:5,cost:5,rarity:'common',  cap:'hurry_exit_dmg3',         txt:'Rapide. Sortie : 3 dégâts à une cible.'},
  {id:'CENTAURE',   n:'Centaure',   atk:8,def:4,cost:6,rarity:'common',  cap:'passive_entry_buff11',    txt:'Toujours : chaque allié entrant gagne +1/+1.'},
  // SEMI-RARES x2
  {id:'CHIMERE',    n:'Chimère',    atk:2,def:2,cost:2,rarity:'uncommon',cap:'entry_copy_field',        txt:'Entrée : copie tout monstre visible.'},
  {id:'PYTHON',     n:'Python',     atk:3,def:3,cost:2,rarity:'uncommon',cap:'curse',                   txt:'Malédiction.'},
  {id:'LION_NEMEE', n:'Lion de Némée',atk:4,def:4,cost:3,rarity:'uncommon',cap:'heal',                  txt:'Vie.'},
  {id:'OPHIOTAURUS',n:'Ophiotaurus',atk:6,def:5,cost:4,rarity:'uncommon',cap:'endure',                  txt:'Endurance.'},
  {id:'SCYLLA',     n:'Scylla',     atk:5,def:7,cost:5,rarity:'uncommon',cap:'entry_draw_per_greek',    txt:'Ce tour : chaque grec joué DEF ≤5 fait piocher 1 carte.'},
  {id:'GORGONE',    n:'Gorgone',    atk:8,def:7,cost:6,rarity:'uncommon',cap:'endure',                  txt:'Endurance.'},
  {id:'CYCLOPE',    n:'Cyclope',    atk:6,def:9,cost:7,rarity:'uncommon',cap:'hit',                     txt:'Double attaque.'},
  {id:'ECHIDNA',    n:'Echidna',    atk:10,def:6,cost:7,rarity:'uncommon',cap:'entry_reclaim',          txt:'Entrée : Récupérez 1 monstre de votre défausse en main.'},
  // RARES x1
  {id:'HORAE',      n:'Horae',      atk:2,def:3,cost:3,rarity:'uncommon',cap:'entry_cycle_freeze1',     txt:'Entrée : fige le Cycle Céleste pendant 1 tour.'},
  {id:'CERBERE',    n:'Cerbère',    atk:3,def:6,cost:3,rarity:'rare',    cap:'protect',                 txt:'Protection.'},
  {id:'MINOTAURE',  n:'Minotaure',  atk:5,def:6,cost:4,rarity:'rare',   cap:'protect_hit',             txt:'Protection + Double attaque.'},
  {id:'LADON',      n:'Ladon',      atk:8,def:5,cost:5,rarity:'rare',    cap:'copy_on_attack',          txt:'Attaque : invoquez une copie (sans cap) du monstre attaqué.'},
  {id:'HYDRE',      n:'Hydre',      atk:3,def:5,cost:5,rarity:'rare',    cap:'entry_token_per_greek',   txt:'Entrée : jeton Hydre 3/5 par monstre grec allié en jeu.'},
  {id:'CHARYBDE',   n:'Charybde',   atk:11,def:6,cost:7,rarity:'rare',  cap:'start_coinflip_destroy',  txt:'Début de tour : pile = détruisez un monstre adverse.'},
  {id:'TYPHON',     n:'Typhon',     atk:10,def:8,cost:8,rarity:'rare',  cap:'entry_dmg5_all',          txt:'Entrée : 5 dégâts à tous les autres monstres en jeu.'},
],
aztec:[
  // NON-RARES x3
  {id:'CAMAZOTZ',   n:'Camazotz',   atk:2,def:2,cost:1,rarity:'common',  cap:'curse',                   txt:'Malédiction.'},
  {id:'CHANEQUE',   n:'Chaneque',   atk:3,def:3,cost:2,rarity:'common',  cap:'heal',                    txt:'Vie.'},
  {id:'CEUYATL',    n:'Ceuyatl',    atk:4,def:4,cost:3,rarity:'common',  cap:'exit_search_3atk',        txt:'Sortie : Cherchez un monstre ATK ≤3 dans votre deck.'},
  {id:'CUETZPALIN', n:'Cuetzpalin', atk:4,def:5,cost:4,rarity:'common',  cap:'protect',                 txt:'Protection.'},
  {id:'TEUZAUHTOTOTL',n:'Teuzauhtototl',atk:7,def:6,cost:5,rarity:'common',cap:'oracle_dmg3',           txt:'Début de tour : regardez le dessus du deck. Sous le deck → 3 dmg à soi-même.'},
  {id:'CHULLACHAKI',n:'Chullachaki',atk:8,def:5,cost:6,rarity:'common',  cap:'hurry',                   txt:'Rapide.'},
  // SEMI-RARES x2
  {id:'AHUIZOTL',   n:'Ahuizotl',   atk:2,def:4,cost:2,rarity:'uncommon',cap:'curse',                   txt:'Malédiction.'},
  {id:'KAQKOJ',     n:'Kaqkoj',     atk:3,def:1,cost:2,rarity:'uncommon',cap:'reveal_play_free',        txt:'Révèle 3 cartes, adversaire choisit: vous jouez gratuitement.'},
  {id:'OCELOTL',    n:'Ocelotl',    atk:5,def:2,cost:3,rarity:'uncommon',cap:'copy_ally_def',           txt:'Entrée : Ocelotl copie la DEF dun allié.'},
  {id:'TZI',        n:'Tzi',        atk:4,def:7,cost:4,rarity:'uncommon',cap:'endure',                  txt:'Endurance.'},
  {id:'CHOHIX',     n:'Chohix',     atk:8,def:5,cost:5,rarity:'uncommon',cap:'death_token22 ritual_tokens3', txt:'Toujours : jeton 2/2 par mort alliée. Rituel : 3 jetons 2/2 Rapide.'},
  {id:'NAGUAL',     n:'Nagual',     atk:4,def:8,cost:6,rarity:'uncommon',cap:'hit',                     txt:'Double attaque.'},
  {id:'OTOMITL',    n:'Otomitl',    atk:7,def:9,cost:7,rarity:'uncommon',cap:'passive_empty_hand_buff', txt:'Toujours : si main vide, alliés +2 ATK /+1 DEF.'},
  {id:'XIUHCOATL',  n:'Xiuhcoatl',  atk:9,def:9,cost:8,rarity:'uncommon',cap:'heal',                   txt:'Vie.'},
  // RARES x1
  {id:'XOLOTL',     n:'Xolotl',     atk:4,def:3,cost:3,rarity:'uncommon',cap:'entry_cycle_advance1',    txt:"Entrée : avance le Cycle Céleste d'une phase."},
  {id:'QUETZAL',    n:'Quetzal',    atk:4,def:3,cost:4,rarity:'rare',    cap:'passive_all_hurry',       txt:'Toujours : tous vos monstres aztèques ont Rapide.'},
  {id:'CIPACTLI',   n:'Cipactli',   atk:4,def:7,cost:4,rarity:'rare',    cap:'entry_reclaim_spell',     txt:'Entrée : Récupérez un sort/dieu de votre défausse en main.'},
  {id:'IZCAQLLI',   n:'Izcaqlli',   atk:6,def:8,cost:5,rarity:'rare',    cap:'protect_endure',          txt:'Protection + Endurance.'},
  {id:'IZCOALT',    n:'Izcoalt',    atk:6,def:6,cost:6,rarity:'rare',    cap:'entry_destroy_catchup',   txt:'Entrée : Si vos PV ≤60, détruisez un monstre adverse.'},
  {id:'HUAY_CHIVO', n:'Huay Chivo', atk:5,def:12,cost:8,rarity:'rare',  cap:'hit',                     txt:'Double attaque.'},
  {id:'TLALTECUHTLI',n:'Tlaltecuhtli',atk:8,def:6,cost:6,rarity:'rare', cap:'entry_token_copies_2 ritual_wipe5', txt:'Entrée : jetons 1/1 copies de 2 alliés. Rituel : 5 dégâts à tous les monstres adverses.'},
]};

const GODS = {
yokai:[
  {id:'AMATERASU',  n:'Amaterasu',  cost:4, cap:'god_cancel_m_steal',      txt:"N'importe quand : Annulez un monstre adverse et invoquez-le sur votre terrain."},
  {id:'EBISU',      n:'Ebisu',      cost:3, cap:'god_scrye4_draw',          txt:'Regardez les 4 premières cartes de votre deck, réorganisez-les, piochez 1.'},
  {id:'FUJIN',      n:'Fujin',      cost:3, cap:'fd_blocker_23',            txt:'Face caché permanent : Le prochain monstre adverse attaquant un allié attaque à la place un jeton 2/3.'},
  {id:'HACHIMAN',   n:'Hachiman',   cost:3, cap:'fd_destroy_attacker',      txt:'Face caché permanent : Quand un monstre adverse attaque, détruisez-le.'},
  {id:'IZANAGI',    n:'Izanagi',    cost:4, cap:'god_steal_temp_perm',      txt:"Prenez le contrôle d'un monstre adverse jusqu'à la fin du tour. Option +3 gems : permanent."},
  {id:'IZANAMI',    n:'Izanami',    cost:3, cap:'god_discard_hand_monster', txt:"L'adversaire révèle sa main. Choisissez un monstre : il le défausse."},
  {id:'KAGUTSUCHI', n:'Kagutsuchi', cost:3, cap:'god_dmg3_or_6',           txt:"N'importe quand : Infligez 3 dégâts. Bonus : 6 dégâts."},
  {id:'OMAIKANE',   n:'Omaikane',   cost:4, cap:'god_swap_hands',           txt:'Chacun défausse sa main et pioche le même nombre. Bonus : pioche autant que la plus grande main.'},
  {id:'RAIJIN',     n:'Raijin',     cost:4, cap:'god_redirect_to_monster',  txt:"N'importe quand : Annulez l'attaque d'un monstre qui attaquait votre joueur. Il attaque un monstre adverse."},
  {id:'RYUJIN',     n:'Ryujin',     cost:3, cap:'god_draft4',               txt:"Choisissez 4 cartes de votre deck. L'adversaire en choisit une pour votre main. Le reste en défausse."},
  {id:'SARUTAHIKO', n:'Sarutahiko', cost:3, cap:'god_atk5_buff',            txt:"N'importe quand : Un monstre allié gagne +5 ATK jusqu'à la fin du tour."},
  {id:'SUSANOO',    n:'Susanoo',    cost:3, cap:'god_heal_all',             txt:'Soignez les DEF originales de tous vos monstres.'},
  {id:'TENJIN',     n:'Tenjin',     cost:1, cap:'god_dmg3',                 txt:'Infligez 3 dégâts à une cible.'},
  {id:'TSUKUYOMI',  n:'Tsukuyomi',  cost:4, cap:'god_resurrect2',           txt:'Retournez jusqu\'à 2 monstres de coût ≤5 de votre défausse dans votre main.'},
  {id:'KAGUYA',     n:'Kaguya',     cost:3, cap:'god_cycle_choose',         txt:'Choisissez la prochaine phase du Cycle Céleste.'},
],
norse:[
  {id:'BALDER',     n:'Balder',     cost:3, cap:'fd_cancel_monster',        txt:'Face caché permanent : Quand un monstre adverse est invoqué, annulez-le.'},
  {id:'BRAGI',      n:'Bragi',      cost:3, cap:'god_copy_spell',           txt:"N'importe quand : Copiez l'effet d'un sort adverse en cours de résolution."},
  {id:'FREYA',      n:'Freya',      cost:4, cap:'god_draw_per_faction',     txt:"N'importe quand : Piochez 1 carte par monstre de la légende choisie sur votre terrain. Bonus : sur les 2 terrains."},
  {id:'FRIGG',      n:'Frigg',      cost:3, cap:'god_cancel_ms',            txt:"N'importe quand : Annulez un monstre ou sort adverse. Bonus : Annulez aussi une capacité."},
  {id:'HEIMDALL',   n:'Heimdall',   cost:4, cap:'god_recover_1or2',         txt:'Retournez 1 carte de défausse en main. Bonus : Choisissez monstre + sort.'},
  {id:'HODER',      n:'Hoder',      cost:2, cap:'god_search2_cost2',        txt:'Cherchez jusqu\'à 2 monstres de coût ≤2 dans votre deck.'},
  {id:'IDUNN',      n:'Idunn',      cost:0, cap:'god_5life_3faction',       txt:"N'importe quand : Si 3 monstres de même légende alliés, gagnez 5 PV et piochez 1."},
  {id:'LOKI',       n:'Loki',       cost:3, cap:'god_discard2_random',      txt:"L'adversaire défausse 2 cartes au hasard."},
  {id:'ODIN',       n:'Odin',       cost:5, cap:'god_equalize_board_hand',  txt:'Le joueur avec le plus de monstres sacrifie jusqu\'à égalité. Bonus : pareil pour la main.'},
  {id:'THOR',       n:'Thor',       cost:5, cap:'god_sacrifice_opp_draw2',  txt:'L\'adversaire sacrifie son monstre le plus fort. Vous piochez 2 cartes.'},
  {id:'TYR',        n:'Tyr',        cost:4, cap:'god_sacrifice_ms',         txt:"L'adversaire sacrifie un monstre. Bonus : Et sacrifie un sort en jeu."},
  {id:'ULLR',       n:'Ullr',       cost:5, cap:'god_equip_draw_attack',    txt:'Équipez à un monstre. Chaque fois qu\'il attaque, piochez une carte.'},
  {id:'VALI',       n:'Vali',       cost:2, cap:'god_equip_2shield',        txt:'Équipez à un monstre. 2 marqueurs : il ne peut pas être attaqué. Chaque attaque retire 1 marqueur.'},
  {id:'VIDAR',      n:'Vidar',      cost:4, cap:'god_blank11',              txt:"N'importe quand : Un monstre adverse devient jeton 1/1 sans capacité."},
  {id:'SKULD',      n:'Skuld',      cost:2, cap:'god_cycle_prophecy',       txt:'Prophétie — regardez les 3 prochaines phases du Cycle et choisissez la suivante.'},
],
egyptian:[
  {id:'AMUNRA',     n:'Amun-Ra',    cost:2, cap:'god_swap_hand_field',      txt:'Échangez un monstre de votre main avec un monstre en jeu de même légende.'},
  {id:'ANUBIS',     n:'Anubis',     cost:4, cap:'god_copy_bonus',           txt:'Invoquez un jeton copie d\'un monstre sur votre terrain. Bonus : au choix des terrains.'},
  {id:'BASTET',     n:'Bastet',     cost:2, cap:'god_draw2_free_if_solo',   txt:'Piochez 2 cartes. Bonus : Sort gratuit si vous ne contrôlez qu\'un seul monstre.'},
  {id:'GEB',        n:'Geb',        cost:2, cap:'god_draw_if_ally_dies',    txt:'Ce tour, si un monstre allié est détruit, piochez une carte.'},
  {id:'HORUS',      n:'Horus',      cost:3, cap:'god_sacrifice_search_plus1',txt:'Sacrifiez un monstre pour chercher un monstre de coût +1 et l\'invoquer gratuitement.'},
  {id:'ISIS',       n:'Isis',       cost:3, cap:'god_cancel_ms_cap',        txt:"N'importe quand : Annulez un monstre, une capacité ou un sort adverse."},
  {id:'KHONSU',     n:'Khonsu',     cost:4, cap:'god_draft6',               txt:"Révélez 6 cartes du deck. L'adversaire les sépare en 2 tas. Vous choisissez un tas pour la main."},
  {id:'OSIRIS',     n:'Osiris',     cost:3, cap:'god_cancel_attack_heal',   txt:"N'importe quand : Annulez une attaque. Gagnez des PV égaux à l'ATK du monstre."},
  {id:'PTAH',       n:'Ptah',       cost:3, cap:'fd_cancel_monster',        txt:'Face caché permanent : Le prochain monstre invoqué est annulé.'},
  {id:'RA',         n:'Ra',         cost:5, cap:'god_force_fight',          txt:'Forcez 1 monstre adverse à attaquer un autre monstre adverse.'},
  {id:'SEKHMET',    n:'Sekhmet',    cost:4, cap:'god_equip_discard_attack', txt:'Équipez à un monstre. Chaque fois qu\'il attaque, l\'adversaire se défausse d\'une carte.'},
  {id:'SET',        n:'Set',        cost:5, cap:'god_tokens22_faction',     txt:'Invoquez un jeton 2/2 par monstre de la légende choisie. Bonus : sur les 2 terrains.'},
  {id:'SOBEK',      n:'Sobek',      cost:3, cap:'god_search_monster',       txt:'Cherchez un monstre dans votre deck et mettez-le en main.'},
  {id:'THOTH',      n:'Thoth',      cost:3, cap:'fd_copy_monster',          txt:'Face caché permanent : Quand l\'adversaire invoque un monstre, copiez-le.'},
  {id:'HEH',        n:'Heh',        cost:3, cap:'god_cycle_freeze2',        txt:'Fige le Cycle Céleste pendant 2 tours.'},
],
greek:[
  {id:'APHRODITE',  n:'Aphrodite',  cost:3, cap:'god_equip_resurrect',      txt:'Équipez à un monstre. Quand il meurt, remettez-le en jeu avec ses DEF d\'origine.'},
  {id:'APOLLON',    n:'Apollon',    cost:3, cap:'god_draw3_discard2',       txt:"N'importe quand : Piochez 3 cartes et défaussez-en 2. Bonus : défaussez-en 1 seule."},
  {id:'ARES',       n:'Arès',       cost:2, cap:'god_halve_atk',            txt:"N'importe quand : Divisez par 2 l'ATK d'un monstre ciblé jusqu'à la fin du tour."},
  {id:'ARTHEMIS',   n:'Artémis',    cost:4, cap:'god_equip_bounce_attack',  txt:'Équipez à un monstre. Chaque fois qu\'il attaque, renvoyez un monstre adverse en main.'},
  {id:'ATHENA',     n:'Athéna',     cost:2, cap:'god_double_atk',           txt:"N'importe quand : Doublez l'ATK d'un monstre allié jusqu'à la fin du tour."},
  {id:'DEMETER',    n:'Déméter',    cost:5, cap:'god_tokens_protect',       txt:'Créez 4 jetons 0/2 Protection. Bonus : 2 jetons 2/2 Protection si seul monstre allié.'},
  {id:'DIONYSOS',   n:'Dionysos',   cost:4, cap:'god_swap_monsters',        txt:'Échangez un monstre allié contre un monstre adverse de votre choix.'},
  {id:'HADES',      n:'Hadès',      cost:4, cap:'god_discard_per_faction',  txt:"Choisissez une légende. L'adversaire se défausse d'1 carte par monstre de cette légende sur votre terrain."},
  {id:'HEPHAISTOS', n:'Héphaïstos', cost:3, cap:'god_bounce_1or2',         txt:"N'importe quand : Renvoyez 1 monstre adverse en main. Bonus : Renvoyez-en 2."},
  {id:'HERA',       n:'Héra',       cost:4, cap:'fd_draw3_no_dmg',          txt:'Face caché permanent : Si votre joueur n\'a pas subi de dégâts ce tour, piochez 3 cartes.'},
  {id:'HERMES',     n:'Hermès',     cost:2, cap:'god_equip_hurry_all',      txt:'Équipez à un monstre. Ce tour, tous vos monstres ont Rapide.'},
  {id:'HESTIA',     n:'Hestia',     cost:4, cap:'god_3shield_attacks',      txt:'Permanent : 3 marqueurs. Chaque attaque adverse est annulée et retire 1 marqueur.'},
  {id:'POSEIDON',   n:'Poséidon',   cost:4, cap:'god_cancel_spell_draw',    txt:"N'importe quand : Annulez un sort et piochez. Bonus : Annulez aussi un monstre."},
  {id:'ZEUS',       n:'Zeus',       cost:6, cap:'god_destroy_low_all',      txt:'Détruisez tous les monstres de DEF ≤5. Bonus : Détruisez tous les monstres.'},
  {id:'KAIROS',     n:'Kairos',     cost:2, cap:'god_cycle_advance1',       txt:"Avance le Cycle Céleste d'une phase."},
  {id:'ORACLE_DELPHES', n:'Oracle de Delphes', cost:2, type:'spell', cap:'oracle_3', txt:'Regardez les 3 prochaines cartes de votre deck. Réordonnez-les.'},
],
aztec:[
  {id:'CENTEOTL',       n:'Centeotl',       cost:3, cap:'god_death_draw_cost4',    txt:'Permanent (1×/tour) : Si un allié meurt, piochez 1 carte en payant 4 PV.'},
  {id:'CHALCHIUHTLICUE',n:'Chalchiuhtlicue',cost:2, cap:'god_search_spell',        txt:'Cherchez un sort dans votre deck et mettez-le en main.'},
  {id:'COATLICUE',      n:'Coatlicue',      cost:4, cap:'god_resurrect_any_grave', txt:"Invoquez un monstre depuis votre défausse. Bonus : Depuis n'importe quelle défausse."},
  {id:'COYOLXAUHQUI',   n:'Coyolxauhqui',  cost:3, cap:'god_all_opp_atk1',        txt:"N'importe quand : L'ATK de tous les monstres adverses passe à 1 jusqu'à votre prochain tour."},
  {id:'EHECATL',        n:'Ehecatl',        cost:5, cap:'god_destroy_ms_bonus',    txt:"N'importe quand : Détruisez un monstre ou sort adverse. Bonus : Détruisez les 2."},
  {id:'HUITZILOPOCHTLI',n:'Huitzilopochtli',cost:5, cap:'god_draw4_cheaper',       txt:"N'importe quand : Piochez 4 cartes. Coût réduit de 1 par monstre Maya en jeu."},
  {id:'MAYAHUEL',       n:'Mayahuel',       cost:1, cap:'god_5life_draw',           txt:'Gagnez 5 points de vie. Bonus : Piochez une carte.'},
  {id:'MICTLANTECUHTLI',n:'Mictlantecuhtli',cost:2,cap:'god_equip_sacrifice_next', txt:"Équipez à un monstre adverse : il est sacrifié au début du prochain tour de son propriétaire."},
  {id:'TEZCATLIPOCA',   n:'Tezcatlipoca',   cost:5, cap:'god_steal_spell_monster', txt:"N'importe quand : Annulez un sort adverse et mettez-le dans votre main. Bonus : Annulez un monstre."},
  {id:'TLALOC',         n:'Tlaloc',         cost:5, cap:'god_dmg5_all',            txt:'Infligez 5 dégâts à tous les monstres en jeu.'},
  {id:'TLALTECUHTLI_S', n:'Tlaltecuhtli',   cost:2, cap:'fd_cancel_spell',         txt:'Face caché permanent : Le prochain sort lancé est annulé.'},
  {id:'TONATIUH',       n:'Tonatiuh',       cost:2, cap:'god_reveal_discard_spell', txt:"L'adversaire révèle sa main. Choisissez un sort : il le défausse. Sinon, piochez 1."},
  {id:'XIPE_TOTEC',     n:'Xipe Totec',     cost:3, cap:'god_freeze_attacks',      txt:"Les monstres adverses ne peuvent pas attaquer lors du prochain tour adverse."},
  {id:'XIUHTECUHTLI',   n:'Xiuhtecuhtli',   cost:5, cap:'god_redirect_attack',     txt:"Annulez l'attaque d'un monstre adverse ciblant un allié. Il attaque un autre monstre adverse."},
  {id:'TONATIUH_R',     n:'Tonatiuh Renaissant', cost:2, cap:'god_cycle_random',   txt:'Relance le Cycle Céleste sur une phase aléatoire.'},
]};;



const SPELLS = {};  // Sorts retirés — deck 54 cartes (40 monstres + 14 dieux)

// =====================================================
// GAME STATE
// =====================================================

// ══════════════════════════════════════════════════
// RNG SEEDABLE (mulberry32) — déterminisme reproductible (golden-master).
// En prod (browser) le seed par défaut est aléatoire → comportement neutre.
// Le harness Node appelle seedRNG(seed) avant chaque partie.
// ══════════════════════════════════════════════════
let _rng = (function(){ let a = (Date.now() >>> 0) ^ 0x9e3779b9; return mulberry32(a); })();
function mulberry32(a){
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seedRNG(seed){ _rng = mulberry32(seed >>> 0); }
function rng(){ return _rng(); }

// Harness: en mode 'sim' (IA vs IA), les deux joueurs sont pilotés par l'IA.
// En 'pve' seul le joueur 2 est IA ; en 'pvp' aucun. Comportement prod inchangé.
function aiControls(p){
  if(typeof G==='undefined' || !G) return false;
  return G.mode==='sim' || (G.mode==='pve' && p===2);
}

let G = null;
let pendingAction = null; // {type, data, resolve}
let aiThinking = false;

function newCard(template) {
  return {
    ...template,
    type: template.type || (template.atk !== undefined ? 'monster' : 'god'),
    cAtk: template.atk || 0,
    cDef: template.def || 0,
    endureUsed: false,
    esquiveUsed: false,
    cursed: false,
    asleep: false,
    sanded: false,
    bewitched: false,
    blinded: false,
    equipped: null, // equip card
    balder: false,
    sethEquipped: false,
    izanamiEquipped: false,
    buff3turn: false,
  };
}

function buildDeck(faction) {
  // DECK 54 CARTES — composition DÉTERMINISTE (fix 1.2 : l'ancien
  // shuffle().slice(0,45) coupait 9 cartes AU HASARD à chaque partie).
  // Monstres par rareté du xlsx :
  //   non rare  × 3  (6 cartes uniques = 18 cartes)
  //   Semi rare × 2  (8 cartes uniques = 16 cartes)
  //   Rare      × 1  (6 cartes uniques =  6 cartes)
  //   Total monstres = 40 cartes
  // Dieux : 14 × 1 = 14 cartes
  // TOTAL = 54 cartes (toutes présentes, seul l'ordre est mélangé)
  const rarityCopies = { common: 3, uncommon: 2, rare: 1 };
  const ms = MONSTERS[faction].flatMap(m => {
    const copies = rarityCopies[m.rarity] || 1;
    return Array.from({length: copies}, () => newCard({...m, type:'monster', faction}));
  });
  const gs = GODS[faction].map(g => newCard({...g, type: g.type || 'god', faction}));
  return shuffle([...ms, ...gs]);
}

// Debug helper (accessible depuis la console)
function getDeckStats(faction) {
  const deck = buildDeck(faction);
  const byType = {monster:0, god:0, spell:0};
  deck.forEach(c => byType[c.type]++);
  console.log(`Deck ${faction}: ${deck.length} cartes total`, byType);
  return deck.length;
}

function shuffle(a) {
  const r=[...a];
  for(let i=r.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[r[i],r[j]]=[r[j],r[i]];}
  return r;
}

// ARENA (4.x) : construit un deck joueur depuis des templates draftés
// (cartes multi-factions). Chaque template porte déjà sa faction.
function buildCustomDeck(templates) {
  const cards = (templates || []).map(t => newCard({
    ...t,
    type: t.type || (t.atk !== undefined ? 'monster' : 'god'),
  }));
  return shuffle(cards);
}

// opts (ARENA 4.x) :
//   customDeck : le joueur 1 joue ce deck drafté (l'IA garde son deck faction)
//   difficulty : 0 facile (IA main 4, pas de coin) · 1 normal · 2 élite/boss (main 6)
//   boss       : id de règle cassée ('zeus'|'anubis'|'odin'|'quetzalcoatl'|'amaterasu')
function initGame(f1, f2, mode, opts) {
  const customDeck = opts && opts.customDeck;
  const difficulty = (opts && opts.difficulty != null) ? opts.difficulty : 1;
  const boss = opts && opts.boss;
  G = {
    mode, // 'pvp' or 'pve' (p2 is AI)
    turn: 1,
    cp: 1,
    phase: 'Main1',
    selAtk: null,
    targeting: null,
    inReaction: false,
    reactionDone: false,
    actions: 1,
    log: [],
    players: [null, null, null], // 1-indexed
    stack: [],           // timing stack for counter/cancel
    lastPlayedByOpp: null,
    lastPlayedSpell: null,
    waitingForPlayer: false,  // true quand IA pause et attend ESPACE
    reactionUsed: false,
    ragnarok: 0,  // Counter: Norse bonus at 5
    cycle: 0,     // Cycle Céleste — 0=aube … 4=ténèbres
    cycleFrozen: 0, // tours de gel du Cycle restants (3.2)
    bossRule: boss || null,  // règle cassée du boss d'Arena (4.3)
    cycleLocked: false,      // Amaterasu : Cycle figé tout le duel
  };
  for(let p=1;p<=2;p++){
    const f = p===1?f1:f2;
    const deck = (p===1 && customDeck) ? buildCustomDeck(customDeck) : buildDeck(f);
    // Taille de main de l'IA selon la difficulté d'Arena (1 = équilibre standard).
    const oppHand = difficulty <= 0 ? 4 : (difficulty >= 2 ? 6 : 5);
    G.players[p] = {
      id: p,
      faction: f,
      hp: 25,
      maxGems: 1,
      gems: 1,
      field: [],
      hand: deck.splice(0, p===1?4:oppHand),
      deck,
      graveyard: [],
      attacked: new Set(),
      summoned: new Set(),
      golems: [],
      balderActive: false,
      // FIX 1.1 : compensation « Coin » — P2 (qui subit le tempo du 1ᵉʳ
      // joueur) reçoit 1 gem TEMPORAIRE à son 1ᵉʳ tour (consommé par doEndTurn).
      _coinGem: (p === 2 && difficulty >= 1) ? 1 : 0, _coinTurns: (p === 2 && difficulty >= 1) ? 1 : 0, _bonusDrawTurn: 0,
    };
  }
  G.activeTurn = 1; // Player 1 starts
  addLog('⚔ Battle begins!', 'event');
  // ── BOSS D'ARENA (4.3) : règles cassées, annoncées à l'écran ──
  if(G.bossRule) {
    const B = ARENA_BOSS_DEFS[G.bossRule];
    if(B) {
      addLog(`👑 BOSS — ${B.name} : ${B.ruleTxt}`, 'special');
      if(G.bossRule === 'odin') {
        for(let k=0;k<2;k++) {
          const w = newCard({id:'ODIN_WALL', n:'Mur d\'Odin', atk:0, def:4, cost:0, type:'monster', cap:'protect', txt:'Protection', rarity:'common', faction:'norse'});
          w.cAtk=0; w.cDef=4; G.players[2].field.push(w);
        }
      }
      if(G.bossRule === 'amaterasu') { G.cycle = 3; G.cycleLocked = true; } // figé sur Nuit
      if(mode !== 'sim') showBossAnnounce(B);
    }
  }
  applyBattlefieldArt(f1, f2);
  // MULLIGAN (1.3) : aussi en mode 'sim' pour que le golden master reste
  // représentatif du vrai flow de jeu (l'IA mulligane les deux camps).
  if (mode === 'sim') {
    for (let p = 1; p <= 2; p++) if (aiControls(p)) aiMulligan(p);
    renderAll();
  } else {
    startMulliganFlow();
  }
}

// Démarre la partie pour de bon (après le mulligan éventuel).
function beginPlay() {
  renderAll();
  // TUTO 1 : gems & jouer une carte (première partie PvE uniquement)
  setTimeout(() => showTuto('gems'), 600);
}

// ── MULLIGAN ─────────────────────────────────────────────────────────────
let _mulliganQueue = [];
let _mulliganMarks = new Set();

// Échange déterministe (règle Hearthstone) : on retire les cartes marquées de
// la main, on pioche autant de cartes en tête du deck, PUIS on remet les
// cartes jetées dans le deck et on remélange (impossible de repiocher tout de
// suite une carte qu'on vient de jeter). Réutilise drawCard/shuffle existants.
function mulliganReplace(p, indices) {
  const P = G.players[p];
  const idxSet = new Set((indices || []).filter(i => i >= 0 && i < P.hand.length));
  if (idxSet.size === 0) return;
  const setAside = [], keep = [];
  P.hand.forEach((c, i) => (idxSet.has(i) ? setAside : keep).push(c));
  P.hand = keep;
  for (let k = 0; k < setAside.length; k++) drawCard(p);   // pioche en tête
  P.deck.push(...setAside);                                // jetées remises au deck
  P.deck = shuffle(P.deck);                                // remélange (RNG seedé)
}

// IA (1.3) : garde les cartes coût ≤3 jusqu'à en avoir 3 ; remplace les
// coûts ≥5 sauf si elle en a déjà ≤1 (un seul gros finisher se garde).
function aiMulligan(p) {
  const P = G.players[p];
  const idx = [];
  const cheap = P.hand.filter(c => (c.cost || 0) <= 3).length;
  const bigs = [];
  P.hand.forEach((c, i) => { if ((c.cost || 0) >= 5) bigs.push(i); });
  if (bigs.length >= 2) bigs.forEach(i => idx.push(i));
  // Pas assez de jeu early : creuse aussi en remplaçant les coûts 4.
  if (cheap < 3) P.hand.forEach((c, i) => {
    if ((c.cost || 0) === 4 && !idx.includes(i)) idx.push(i);
  });
  if (idx.length) mulliganReplace(p, idx);
}

function startMulliganFlow() {
  // Les joueurs contrôlés par l'IA mulliganent instantanément, sans écran.
  for (let p = 1; p <= 2; p++) if (aiControls(p)) aiMulligan(p);
  // Les humains passent par l'écran de mulligan, dans l'ordre.
  _mulliganQueue = [];
  for (let p = 1; p <= 2; p++) if (!aiControls(p)) _mulliganQueue.push(p);
  showNextMulligan();
}

function showNextMulligan() {
  if (_mulliganQueue.length === 0) { closeMulligan(); beginPlay(); return; }
  _mulliganMarks = new Set();
  renderMulligan(_mulliganQueue[0]);
}

function confirmMulligan() {
  const p = _mulliganQueue.shift();
  if (p != null) mulliganReplace(p, [..._mulliganMarks]);
  _mulliganMarks = new Set();
  showNextMulligan();
}

function closeMulligan() {
  const el = document.getElementById('mulligan');
  if (el) el.style.display = 'none';
}

function renderMulligan(p) {
  const P = G.players[p];
  const overlay = document.getElementById('mulligan');
  const cont = document.getElementById('mull-cards');
  if (!overlay || !cont) { closeMulligan(); beginPlay(); return; }
  // Titre adapté en hot-seat (2 humains)
  const titleEl = document.getElementById('mull-title');
  if (titleEl) titleEl.textContent = (G.mode === 'pvp')
    ? `JOUEUR ${p} — CHOISIS TA MAIN DE DÉPART`
    : 'CHOISIS TA MAIN DE DÉPART';
  cont.innerHTML = '';
  P.hand.forEach((c, i) => {
    const imgSrc = getCardImage(c.id || '');
    const isAnytimeC = isAnytime(c);
    const typeLabel = isAnytimeC ? '⚡ ANYTIME'
      : c.type === 'god' ? '⚡ Dieu' : c.type === 'spell' ? '✨ Sort' : '🐉 Monstre';
    const div = document.createElement('div');
    div.className = 'mull-card' + (_mulliganMarks.has(i) ? ' marked' : '');
    div.dataset.i = i;
    div.dataset.faction = c.faction || P.faction;
    div.dataset.rarity = c.rarity || (c.type === 'god' ? 'god' : 'common');
    div.innerHTML = `
      <div class="mull-frame">
        <div class="mull-art">
          ${imgSrc
            ? `<img src="${imgSrc}" alt="${c.n}" loading="lazy">`
            : `<div class="art-placeholder"><span class="ap-icon">${c.type === 'spell' ? '✨' : c.type === 'god' ? '⚡' : FE[c.faction || P.faction]}</span><span class="ap-name">${c.n}</span><span class="ap-soon">illustration à venir</span></div>`}
        </div>
        <div class="mull-band">${c.n}</div>
        <div class="mull-info">
          <div class="mull-type">${typeLabel}</div>
          <div class="mull-txt">${c.txt || ''}</div>
        </div>
        <div class="mull-cost">${c.cost}</div>
        ${c.type === 'monster' ? `<div class="mull-atk">${c.atk}</div><div class="mull-def">${c.def}</div>` : ''}
      </div>
      <div class="mull-mark">↻</div>`;
    div.onclick = () => {
      if (_mulliganMarks.has(i)) _mulliganMarks.delete(i); else _mulliganMarks.add(i);
      div.classList.toggle('marked');
    };
    cont.appendChild(div);
  });
  overlay.style.display = 'flex';
}


// ── Tapis de jeu : fonds de faction ─────────────────────────────────────────
function applyBattlefieldArt(f1, f2) {
  if (typeof LANDSCAPE_ART === 'undefined') return;
  [
    { id: 'bf-landscape-1', faction: f1 },
    { id: 'bf-landscape-2', faction: f2 },
  ].forEach(({ id, faction }) => {
    const img = document.getElementById(id);
    if (!img || !LANDSCAPE_ART[faction]) return;
    img.src = LANDSCAPE_ART[faction];
    img.onload  = () => img.classList.add('loaded');
    img.onerror = () => img.style.display = 'none';
  });
}
// =====================================================
// LOGGING
// =====================================================
function addLog(msg, cls='') {
  G.log.unshift({msg, cls});
  // En 'sim' (golden-master) on garde le log complet ; en prod on plafonne à 80
  // (le log ne sert qu'au rendu, jamais à la logique → neutre).
  if(G.log.length>80 && G.mode!=='sim') G.log.pop();
}

// =====================================================
// GAME FLOW
// =====================================================
const PHASES = ['Main1','Combat','Main2','End'];
const PHASE_LABELS = {Main1:'MAIN 1',Combat:'COMBAT',Main2:'MAIN 2',End:'END'};
const PHASE_NAMES = PHASE_LABELS; // backwards compat

// ── Cycle Céleste ─────────────────────────────────────────────────
const CYCLE_PHASES = ['aube','midi','crepuscule','nuit','tenebres'];
const ZENITH_MAP   = {aube:'egyptian',midi:'greek',crepuscule:'aztec',nuit:'yokai',tenebres:'norse'};
const CYCLE_ICONS  = {aube:'🌅',midi:'☀️',crepuscule:'🌆',nuit:'🌙',tenebres:'🌑'};
const CYCLE_NAMES  = {aube:'AUBE',midi:'MIDI',crepuscule:'CRÉPUSCULE',nuit:'NUIT',tenebres:'TÉNÈBRES'};
const ZENITH_LABEL = {egyptian:'Égyptien 🏺',greek:'Grec 🏛',aztec:'Aztèque 🌞',yokai:'Yokai 🦊',norse:'Norse ⚡'};

// ── MANIPULATION DU CYCLE (3.2) ───────────────────────────────────
// Index de phase du zénith de chaque faction (cf. ZENITH_MAP).
const FACTION_PHASE_IDX = {egyptian:0, greek:1, aztec:2, yokai:3, norse:4};

// Change la phase du Cycle (cartes temporelles + fin de ronde) et applique
// tous les effets « au changement de phase » (anim, recharge Esquive,
// recharge Endurance aztèque au Crépuscule).
function setCyclePhase(newCycle, srcLabel) {
  if(G.cycleLocked) { addLog('🌙 Le Cycle est verrouillé sur la Nuit (Amaterasu).','special'); return; }
  const prev = G.cycle % 5;
  G.cycle = ((newCycle % 5) + 5) % 5;
  if((G.cycle % 5) === prev) return;
  scheduleCycleAnim();
  if(G.mode === 'pve') showTuto('cycle'); // TUTO 5 : premier changement de Cycle
  // ESQUIVE (2.2) : recharge à chaque changement de phase du Cycle.
  [1,2].forEach(pl => G.players[pl].field.forEach(m => { if(m) m.esquiveUsed = false; }));
  // ZÉNITH AZTEC (3.1) — Crépuscule : l'Endurance se recharge.
  if(CYCLE_PHASES[G.cycle % 5] === 'crepuscule') {
    [1,2].forEach(pl => {
      if(G.players[pl].faction !== 'aztec') return;
      G.players[pl].field.forEach(m => {
        if(m && m.endureUsed) {
          m.endureUsed = false;
          if(!(m.cap||'').includes('endure')) m.cap = ((m.cap||'') + ' endure').trim();
          addLog(`🌆 Zénith — ${m.n} peut endurer à nouveau !`,'buff');
        }
      });
    });
  }
  if(srcLabel) addLog(`🌌 ${srcLabel} — le Cycle passe à ${CYCLE_NAMES[CYCLE_PHASES[G.cycle % 5]]} !`,'special');
}

// Choix de phase par un joueur (Prophétie / Kaguya). options = indices de
// phase proposés. L'IA choisit la phase la plus proche de son zénith ;
// l'humain passe par un petit modal.
async function pickCyclePhase(p, options, title) {
  const myIdx = FACTION_PHASE_IDX[G.players[p].faction];
  if(aiControls(p)) {
    // priorité : son propre zénith, sinon la phase qui en rapproche le plus
    let best = options[0], bestD = 99;
    for(const o of options) {
      const d = ((myIdx - o) % 5 + 5) % 5; // distance o → zénith
      if(o === myIdx) { best = o; bestD = -1; break; }
      if(d < bestD) { bestD = d; best = o; }
    }
    return best;
  }
  return showCyclePickModal(options, title);
}

function showCyclePickModal(options, title) {
  return new Promise(resolve => {
    let modal = document.getElementById('cycle-pick-modal');
    if(!modal) {
      modal = document.createElement('div');
      modal.id = 'cycle-pick-modal';
      modal.className = 'oracle-modal';
      document.body.appendChild(modal);
    }
    modal.innerHTML = `
      <h3 style="color:#ffd700;margin:0 0 8px">🌌 ${title || 'Choisissez la prochaine phase'}</h3>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        ${options.map(o => `
          <div class="cycle-pick-opt" data-c="${o}" style="background:rgba(255,255,255,0.07);border:1px solid rgba(200,164,74,0.4);border-radius:8px;padding:10px 14px;cursor:pointer;text-align:center;color:#fff">
            <div style="font-size:24px">${CYCLE_ICONS[CYCLE_PHASES[o]]}</div>
            <div style="font-size:11px;margin-top:4px">${CYCLE_NAMES[CYCLE_PHASES[o]]}</div>
            <div style="font-size:9px;color:#aaa;margin-top:2px">Zénith ${ZENITH_LABEL[ZENITH_MAP[CYCLE_PHASES[o]]]}</div>
          </div>`).join('')}
      </div>`;
    modal.querySelectorAll('.cycle-pick-opt').forEach(el => {
      el.addEventListener('click', () => { modal.style.display='none'; resolve(parseInt(el.dataset.c)); });
    });
    modal.style.display = 'flex';
  });
}

function getZenithFaction() {
  if(!G) return null;
  return ZENITH_MAP[CYCLE_PHASES[G.cycle % 5]];
}
function isZenith(m) {
  if(!G || !m || !m.faction || m.faceDown) return false;
  return m.faction === getZenithFaction();
}

// ── ZÉNITHS ASYMÉTRIQUES (3.1) — bonus signature par faction ──────
const ZENITH_BONUS_TXT = {
  egyptian: 'Aube : vos jetons entrent avec +1/+1 et Élan',
  greek:    'Midi : vos dieux face cachée sont déclenchables (clic)',
  aztec:    "Crépuscule : l'Endurance de vos monstres se recharge",
  yokai:    'Nuit : Sommeil +1 tour · dormeurs adverses ciblables',
  norse:    'Ténèbres : tous vos monstres gagnent Protection',
};
// Protection effective : cap protect OU zénith norse (Ténèbres) pour les monstres norse.
function effProtect(m, ownerP) {
  if(!m || m.faceDown) return false;
  if((m.cap||'').includes('protect')) return true;
  return getZenithFaction() === 'norse' && G.players[ownerP] && G.players[ownerP].faction === 'norse';
}
// Zénith yokai (Nuit) : les monstres endormis ADVERSES deviennent ciblables.
function canTargetSleeping(attackerP) {
  return getZenithFaction() === 'yokai' && G.players[attackerP] && G.players[attackerP].faction === 'yokai';
}
// Zénith égyptien (Aube) : les jetons invoqués gagnent +1/+1 et Élan (hurry).
function zenithTokenBoost(p, tok) {
  if(getZenithFaction() === 'egyptian' && G.players[p] && G.players[p].faction === 'egyptian') {
    tok.cAtk++; tok.cDef++; tok.atk = (tok.atk||0)+1; tok.def = (tok.def||0)+1;
    if(!(tok.cap||'').includes('hurry')) tok.cap = ((tok.cap||'') + ' hurry').trim();
    addLog(`🌅 Zénith — ${tok.n} entre avec +1/+1 et Élan !`,'buff');
  }
  return tok;
}
// Zénith grec (Midi) : déclenchement manuel des dieux face cachée.
function canManualTriggerFD(p) {
  return getZenithFaction() === 'greek' && G.players[p] && G.players[p].faction === 'greek';
}
async function manualTriggerFaceDown(p, i) {
  const P = G.players[p];
  const m = P.field[i];
  if(!m || !m.faceDown || m.type !== 'god') return;
  m.faceDown = false;
  addLog(`☀️ Zénith grec — ${m.n} déclenché manuellement !`, 'special');
  const cap = m.cap || '';
  if(cap === 'fd_draw3_no_dmg') { drawCard(p); drawCard(p); drawCard(p); addLog(`${m.n} — Pioche 3 !`, 'buff'); }
  else if(cap === 'fd_destroy_attacker' || cap === 'fd_cancel_monster') { await pickTarget('destroy', p, false); }
  else if(cap === 'fd_copy_monster') { await pickTarget('copy', p, false); }
  else if(cap === 'fd_resurrect') {
    const grave = P.graveyard.filter(c => c.type === 'monster');
    if(grave.length > 0 && P.field.length < 6) {
      const res = grave[grave.length - 1];
      P.graveyard.splice(P.graveyard.lastIndexOf(res), 1);
      res.cAtk = res.atk; res.cDef = res.def; res.endureUsed = false; res.cursed = false;
      P.field.push(res);
      addLog(`${m.n} — ${res.n} ressuscité !`, 'special');
    }
  }
  else if(cap === 'fd_blocker' || cap === 'fd_blocker_23') {
    if(P.field.length < 6) {
      const t = newCard({id:'BLK', n:'Blocker', atk:2, def:3, cost:0, type:'monster', cap:'protect', txt:'Protect', faction:P.faction});
      t.cAtk = 2; t.cDef = 3; P.field.push(t);
    }
  }
  const idx = P.field.indexOf(m);
  if(idx >= 0) { P.field.splice(idx, 1); reindexSets(P, idx, true); }
  P.graveyard.push(m);
  renderAll();
}

function nextPhase() { advancePhase(); }

function advancePhase() {
  if (typeof Audio5L !== 'undefined') Audio5L.sfx.endTurn();
  const order = ['Main1','Combat','Main2','End'];
  const idx = order.indexOf(G.phase);
  if (idx < 0) return;
  if (G.phase === 'End') { endCurrentTurn(); return; }
  G.phase = order[idx + 1];
  updatePhaseBtn();
  renderPhaseBar();
  addLog('Phase → ' + PHASE_LABELS[G.phase]);
  // TUTO 2/3 : phases puis attaque (au premier passage humain en Combat)
  if(G.cp === 1 && G.phase === 'Combat') { showTuto('phases'); setTimeout(() => showTuto('attack'), 350); }
  if (G.phase === 'Combat' && typeof Audio5L !== 'undefined') Audio5L.combatMode();
  if (G.phase === 'Main2' && typeof Audio5L !== 'undefined') Audio5L.menuMode();
  if (G.phase === 'End') setTimeout(() => endCurrentTurn(), 400);
  renderAll();
}

function updatePhaseBtn() {
  const btn = document.getElementById('btn-next');
  if (!btn) return;
  const labels = { Main1:'MAIN 1 → COMBAT', Combat:'COMBAT → MAIN 2', Main2:'MAIN 2 → END', End:'END TURN' };
  btn.textContent = labels[G.phase] || 'NEXT';
}

function renderPhaseBar() {
  const phases = ['Main1','Combat','Main2','End'];
  document.querySelectorAll('#phase-bar .ph').forEach((el,i) => {
    const cur = phases.indexOf(G.phase);
    el.textContent = PHASE_LABELS[phases[i]];
    el.className = 'ph' + (i === cur ? ' active' : i < cur ? ' done' : '');
  });
  updatePhaseBtn();
}



function handlePhaseStart(p) {
  const P = G.players[p];
  addLog(`Phase: ${PHASE_LABELS[G.phase] || G.phase}`, 'phase');
  if(G.phase==='Main1' || G.phase==='Main2') {
    // (Golem passive removed — gems-only economy)
  }
}

function endCurrentTurn() { endTurn(); }

function endTurn() {
  if(G.mode==='pve' && G.cp===2) return;
  doEndTurn();
}

function doEndTurn() {
  const P = G.players[G.cp];
  const oppP = G.cp===1?2:1;

  // ── End-of-turn caps for current player (before switching) ────
  P.field.forEach(m => {
    if(!m||m.faceDown) return;
    const c = m.cap||'';
    if(c.includes('end_draw')) { drawCard(G.cp); addLog(`${m.n} — Fin de tour: Pioche 1!`,'buff'); }
    if(c.includes('end_heal_ally') && P.field.filter(x=>x&&!x.faceDown).length>1) {
      const healTarget = P.field.filter(x=>x&&!x.faceDown&&x!==m).reduce((a,b)=>a.cDef<b.cDef?a:b);
      healTarget.cDef = healTarget.def;
      addLog(`${m.n} — Fin de tour: ${healTarget.n} soigné (${healTarget.cDef} DEF)!`,'heal');
    }
  });

  // Trim hand to 7
  while(P.hand.length > 7) {
    const disc = P.hand.pop();
    P.graveyard.push(disc);
  }
  // End status cleanup on current player's field (sand + buff expire at end of own turn)
  P.field.forEach(m => {
    if(!m) return;
    if(m.sanded) m.sanded=false;
    if(m.buff3turn) { m.cAtk = Math.max(0,m.cAtk-3); m.cDef = Math.max(0,m.cDef-3); m.buff3turn=false; }
  });
  // Bug #5 fix: sleep counts down on OPPONENT's field at end of current player's turn
  // "wakes up 2 opponent's turns later" = after 2 turns of the player who put it to sleep
  G.players[oppP].field.forEach(m => {
    if(!m) return;
    if(m.asleep && m.sleepTurns>0) {
      m.sleepTurns--;
      if(m.sleepTurns<=0) { m.asleep=false; m.faceDown=false; addLog(`${m.n} wakes up!`,'event'); }
    }
  });

  const prev = G.cp;
  G.cp = G.cp===1?2:1;
  G.activeTurn = G.cp; // track whose actual turn it is
  G._anubisUsedTurn = false; // BOSS Anubis (4.3) : 1 retour par tour
  if(G.bossRule === 'zeus') {
    // BOSS Zeus : le Cycle avance d'1 phase à CHAQUE tour (pas chaque ronde).
    setCyclePhase(G.cycle + 1, 'Zeus');
    if(G.cp===1) G.turn++;
  } else if(G.cp===1) {
    G.turn++;
    // CYCLE (3.2) : gel éventuel (Heh, Horae), sinon avance d'une phase.
    if(G.cycleLocked) {
      // Amaterasu : le Cycle reste figé sur la Nuit tout le duel.
    } else if((G.cycleFrozen||0) > 0) {
      G.cycleFrozen--;
      addLog(`🧊 Le Cycle Céleste est figé (${G.cycleFrozen+1>1?G.cycleFrozen+' tour(s) restant(s)':'dernier tour'}).`,'special');
    } else {
      setCyclePhase(G.cycle + 1);
    }
  }
  G.phase='Main1';
  G.selAtk=null;

  const NP = G.players[G.cp];
  // FIX 1.1 : courbe de gems SYMÉTRIQUE. L'ancien code incrémentait le joueur
  // entrant à chaque changement de tour → P2 jouait toutes ses rondes avec
  // +1 gem par rapport à P1 (courbe 2,3,4… contre 1,2,3…). Désormais le
  // plafond de gems = numéro de ronde (G.turn) pour les deux joueurs.
  NP.maxGems = Math.min(10, G.turn);
  // Coin étalé : P2 reçoit +1 gem temporaire à ses 2 premiers tours.
  NP.gems = NP.maxGems + ((NP._coinTurns || 0) > 0 ? (NP._coinGem || 0) : 0);
  if (NP._coinTurns > 0) NP._coinTurns--;
  Audio5L.sfx.mana();
  NP.attacked = new Set();
  NP.summoned = new Set();
  G.actions = 1;
  // Auto-draw
  if(NP.deck.length > 0) { NP.hand.push(NP.deck.shift()); Audio5L.sfx.draw(); }
  // Compensation going-second (1.1) : pioche bonus unique au 2e tour de P2.
  if(NP._bonusDrawTurn > 0 && G.turn >= NP._bonusDrawTurn) { drawCard(G.cp); NP._bonusDrawTurn = 0; }
  G.phase = 'Main1';

  addLog(`── Turn ${G.turn} — Player ${G.cp} (${NP.faction}) ──`,'turn');
  renderAll();
  checkVictory();

  // UX #6: Show turn announcement
  const ann = document.getElementById('turn-announce');
  if(ann) {
    ann.textContent = G.cp===1 ? '⚔ TON TOUR' : '🤖 TOUR ADVERSE';
    ann.style.color = G.cp===1 ? 'var(--gold2)' : '#e74c3c';
    ann.style.display = 'block';
    ann.style.animation = 'none';
    ann.offsetHeight; // reflow
    ann.style.animation = 'turnFlash 1.4s ease-out forwards';
    setTimeout(() => { ann.style.display='none'; }, 1400);
  }


  // ── Start-of-turn caps for new player ─────────────────────────
  const newP = G.players[G.cp];
  newP.field.forEach(m => {
    if(!m||m.faceDown) return;
    const c = m.cap||'';
    // start_draw (HUGINN)
    if(c.includes('start_draw')) { drawCard(G.cp); addLog(`${m.n} — Start: Pioche 1!`,'buff'); }
    // start_tokens2 (MEDJED): 2 tokens per turn, max 6 on field total
    if(c.includes('start_tokens2') || c.includes('start_token_capped')) {
      const tokenCount = newP.field.filter(x=>x&&x.id&&x.id.startsWith('TOKEN')).length;
      const toSpawn = Math.min(2, 6 - tokenCount);
      for(let t=0;t<toSpawn&&newP.field.length<6;t++) {
        const tk=newCard({id:'TOKEN11',n:'Jeton 1/1',atk:1,def:1,cost:0,type:'monster',cap:'',txt:'',rarity:'common',faction:newP.faction});
        tk.cAtk=1;tk.cDef=1; zenithTokenBoost(G.cp, tk); newP.field.push(tk);
      }
      if(toSpawn>0) addLog(`${m.n} — ${toSpawn} jeton(s) 1/1!`,'event');
    }
    // start_filter (HIPPOCAMPE): discard 1 draw 1 (AI auto-discards worst)
    if(c.includes('start_filter') && newP.hand.length>0) {
      const worst = newP.hand.reduce((a,b)=>a.cost<=b.cost?a:b);
      newP.graveyard.push(worst);
      newP.hand.splice(newP.hand.indexOf(worst),1);
      drawCard(G.cp);
      addLog(`${m.n} — Filtre: défausse + pioche!`,'event');
    }
    // oracle_dmg3 (TEUZAUHTOTOTL): look top card, put under → 3 dmg to self
    if(c.includes('oracle_dmg3') || c.includes('scrye_dmg3_cond')) {
      if(!m._oracleDoneThisTurn && newP.deck.length>0) {
        const top = newP.deck[0];
        addLog(`${m.n} — Oracle: ${top.n} est au sommet du deck.`,'event');
        // AI: always put it under if it's a bad card
        if(aiControls(G.cp) && top.cost<=2) {
          newP.deck.splice(0,1); newP.deck.push(top);
          m.cDef=Math.max(0,m.cDef-3);
          addLog(`${m.n} — Oracle: carte mise sous le deck, -3 DEF à soi-même!`,'dmg');
          if(m.cDef<=0) handleDeath(G.cp, m);
        }
        m._oracleDoneThisTurn = true;
      }
    }
    // start_coinflip_destroy (CHARYBDE): flip → destroy opp monster
    if((c.includes('start_coinflip_destroy') || c.includes('coinflip_atk5')) && !m._charybdeDoneThisTurn) {
      m._charybdeDoneThisTurn = true;
      const opp2 = G.cp===1?2:1;
      const oppAlive = G.players[opp2].field.filter(x=>x&&!x.faceDown);
      if(oppAlive.length>0) {
        if(rng()<0.5) {
          const target3 = oppAlive[Math.floor(rng()*oppAlive.length)];
          handleDeath(opp2, target3);
          addLog(`${m.n} — Charybde: PILE! ${target3.n} détruit!`,'special');
        } else {
          addLog(`${m.n} — Charybde: FACE. Rien.`,'event');
        }
      }
    }
  });
  // Reset per-turn flags
  newP.field.forEach(m => { if(m) { m._oracleDoneThisTurn=false; m._charybdeDoneThisTurn=false; } });

  if(G.mode==='pve' && G.cp===2) {
    setTimeout(aiTurn, 600);
  }
}

// =====================================================
// DRAW
// =====================================================
function drawCard(p) {
  const P = G.players[p];
  if(P.deck.length===0) { addLog(`Player ${p} deck empty`); return; }
  const c = P.deck.shift();
  P.hand.push(c);
  Audio5L.sfx.draw();
}

// =====================================================
// PLAY CARD
// =====================================================
// Check if a card can be played anytime (not just main phase)
// FIX (C5) : ANYTIME_CAPS_SET est désormais RECONSTRUIT dynamiquement à partir
// des cartes dont le texte contient "N'importe quand" + toutes les caps "fd_".
// L'ancien Set codé en dur omettait ~18 dieux anytime (donc injouables en
// réaction). Construit après la définition de GODS/MONSTERS.
const ANYTIME_CAPS_SET = (() => {
  const s = new Set();
  const pools = [];
  if (typeof GODS !== 'undefined')     for (const f in GODS)     pools.push(GODS[f]);
  if (typeof MONSTERS !== 'undefined') for (const f in MONSTERS) pools.push(MONSTERS[f]);
  for (const pool of pools) for (const card of pool) {
    const cap = card.cap || '';
    if ((card.txt || '').includes("N'importe quand")) s.add(cap);
    if (cap.startsWith('fd_')) s.add(cap);
  }
  return s;
})();

function isAnytime(c) {
  return ANYTIME_CAPS_SET.has(c.cap||'') || (c.cap||'').startsWith('fd_');
}

async function playCard(handIdx) {
  const P = G.players[G.cp];
  const c = P.hand[handIdx];
  if (!c) return;
  const anytime = isAnytime(c);

  // Pendant la pause IA (waitingForPlayer) : seules les cartes anytime sont jouables
  if (G.waitingForPlayer && !anytime) return;

  // Pendant son propre tour en phases Main1 ou Main2
  const inMain = G.phase === 'Main1' || G.phase === 'Main2';
  if (!G.waitingForPlayer && G.cp === G.activeTurn && !inMain && !anytime) return;

  // Pendant le tour adverse sans pause : anytime seulement
  if (!G.waitingForPlayer && G.cp !== G.activeTurn && !anytime) return;

  if (P.gems < c.cost) { Audio5L.sfx.error(); return; }
  // No actions counter — gems are the only resource

  P.gems -= c.cost;
  // actions not decremented — gems only
  P.hand.splice(handIdx, 1);

  if (c.type === 'monster')      { Audio5L.sfx.playCard(); await playMonster(c, G.cp); }
  else if (c.type === 'god')     { Audio5L.sfx.playGod(); await playGod(c, G.cp); }
  else                           { Audio5L.sfx.playSpell(); await playSpell(c, G.cp); }

  // Après avoir joué une carte anytime pendant la pause IA
  if (G.waitingForPlayer && window._resolveReaction) {
    const hasMore = G.players[1].hand.some(cx => isAnytime(cx) && G.players[1].gems >= cx.cost);
    if (!hasMore) {
      // Plus rien à jouer → résoudre automatiquement après un délai
      setTimeout(resolveReaction, 300);
    }
    // Sinon : bannière reste ouverte, joueur peut jouer une autre carte
  } else if (anytime && G.inReaction && !G.targeting) {
    // Ancienne logique de réaction (hors pause IA)
    if (window._resolveReaction) window._resolveReaction();
  }

  renderAll();
  checkVictory();
}

async function playMonster(c, p) {
  const P = G.players[p];
  if(P.field.length>=6) {
    addLog('Field full — cannot summon!','warn');
    P.hand.push(c); P.gems+=c.cost;
    return;
  }

  // Bug #2 fix: timing stack — give human a counter window BEFORE card enters play
  if(p===2 && G.mode==='pve') {
    G.lastPlayedByOpp = c;
    G.stack = [{ type:'monster', card:c, player:p }];
    await reactionWindow(1, c);
    G.lastPlayedByOpp = null;
    if(G.stack.length === 0) {
      // Card was countered during reaction
      addLog(`${c.n} was countered!`,'special');
      G.players[p].graveyard.push(c);
      G.stack = [];
      return;
    }
    G.stack = [];
  }

  // Check Ares face-down (cancel incoming monster)
  const opp = p===1?2:1;
  const aresIdx = G.players[opp].field.findIndex(m=>m&&m.faceDown&&m.cap==='fd_cancel_monster');
  if(aresIdx>=0) {
    const ares = G.players[opp].field[aresIdx];
    ares.faceDown=false;
    G.players[opp].field.splice(aresIdx,1);
    G.players[opp].graveyard.push(ares);
    reindexSets(G.players[opp],aresIdx,true);
    addLog(`Ares activates — ${c.n} cancelled!`,'special');
    P.graveyard.push(c);
    return;
  }
  const m = newCard({...c});
  m.cAtk=c.atk; m.cDef=c.def;
  m._newCard=true;
  // BOSS Quetzalcoatl (4.3) : tous les monstres du boss ont Endurance.
  if(G.bossRule === 'quetzalcoatl' && p === 2 && !(m.cap||'').includes('endure')) {
    m.cap = ((m.cap||'') + ' endure').trim();
  }
  P.field.push(m);
  const idx = P.field.length-1;
  P.summoned.add(idx);
  // Passifs/auras du plateau s'appliquant au monstre entrant (cf. moteur d'effets,
  // Event 'passive'). Conditions = état du plateau/faction ; ordre préservé.
  await runEffects('passive', { p, idx, m, opp, cap: m.cap||'' });
  addLog(`Player ${p} summons ${m.n} (${m.cAtk}⚔/${m.cDef}🛡)`,'summon');

  // Check face-down Greek gods triggered by monster entry
  checkFaceDownTrigger(opp, 'monster_entry', m, p);

  await applyEntry(p, idx, m);
}

// ════════════════════════════════════════════════════════════════════
// MOTEUR D'EFFETS COMPOSABLE — Action + Selector + Condition + Event.
// Remplace les chaînes if(cap.includes(...)). Chaque effet est un
// descripteur {cond, run} enregistré sous un Event. cond = la Condition
// (prédicat sur la cap), run(ctx) = l'Action qui compose des Selectors
// (cibles) et mute l'état. L'ordre du registre reproduit EXACTEMENT
// l'ordre de l'ancienne chaîne (effets indépendants, cumulables).
// ════════════════════════════════════════════════════════════════════
const EFFECTS = { entry: [], exit: [], passive: [], combat: [], anytime: [], spell: [] };
function registerEffect(event, cond, run) { EFFECTS[event].push({ cond, run }); }
async function runEffects(event, ctx) {
  for (const eff of EFFECTS[event]) {
    if (eff.cond(ctx.cap, ctx)) {
      // On n'attend QUE les effets réellement asynchrones (thenable). Les
      // effets synchrones (déclarés non-async) s'exécutent sans introduire de
      // frontière de micro-tâche → on reproduit exactement la séquence d'await
      // de l'ancienne chaîne (où seuls les `await pickTarget(...)` suspendaient).
      const r = eff.run(ctx);
      if (r && typeof r.then === 'function') await r;
    }
  }
}
// Effets de COMBAT (phase 'preStrike') : peuvent renvoyer 'abort' pour annuler
// l'attaque en cours. On n'attend que les effets thenable (timing préservé).
function registerCombat(phase, cond, run) { EFFECTS.combat.push({ phase, cond, run }); }
async function runCombatEffects(phase, ctx) {
  for (const eff of EFFECTS.combat) {
    if (eff.phase !== phase) continue;
    if (!eff.cond(ctx.cap, ctx)) continue;
    const r = eff.run(ctx);
    const res = (r && typeof r.then === 'function') ? await r : r;
    if (res === 'abort') return 'abort';
  }
  return 'continue';
}
// Selectors — fabriquent des ensembles de cibles à partir du contexte.
const Sel = {
  oppMonsters: ctx => G.players[ctx.opp].field.filter(x => x && !x.faceDown),
  allMonsters: () => [...G.players[1].field, ...G.players[2].field].filter(x => x && !x.faceDown),
  ownGraveMonsters: ctx => G.players[ctx.p].graveyard.filter(c => c.type === 'monster'),
};
// Action utilitaire : appliquer fn à chaque allié SAUF soi (sans filtre faceDown,
// comme les boucles de buff d'origine).
function eachAllyExclSelf(ctx, fn) {
  G.players[ctx.p].field.forEach((x, i) => { if (x && i !== ctx.idx) fn(x, i); });
}

// ── Passifs / auras du plateau appliqués au monstre entrant (Event 'passive') ──
// Conditions = état du plateau / faction (pas la cap du monstre entrant).
// Effets synchrones → exécutés inline (timing identique aux anciens `if`).
registerEffect('passive', (cap, ctx) => G.players[ctx.p].field.some((x,j)=>x&&j!==ctx.idx&&(x.cap||'').includes('passive_entry_buff11')), ctx => {
  // passive_entry_buff11 (CENTAURE): new ally enters with +1/+1
  const { m } = ctx;
  m.cAtk++; m.cDef++;
  addLog(`Centaure — ${m.n} entre avec +1/+1!`,'buff');
});
registerEffect('passive', (cap, ctx) => G.players[ctx.p].faction==='norse' && (G.ragnarok||0)>=5, ctx => {
  // Ragnarök: if Norse player and counter >= 5, entering monster gets +3/+3 + endure
  const { m } = ctx;
  m.cAtk+=2; m.cDef+=2;
  if(!(m.cap||'').includes('endure')) m.cap=(m.cap||'')+' endure'; m.endureUsed=false;
  G.ragnarok=0;
  addLog(`⚡ RAGNARÖK! ${m.n} entre avec +2/+2 et Endurance!`,'special');
});

// ── Capacités de COMBAT pré-frappe (Event combat/'preStrike') ──────────
// Chaque effet = Condition (sur l'attaquant ou le défenseur) + Action.
// Les chemins synchrones ne renvoient PAS de promesse (pas de tick ajouté) ;
// les chemins async renvoient une IIFE → reproduit la séquence d'await d'origine.
// solo_destroy (RAIJU): si seul allié, détruit la cible sans combat → abort.
registerCombat('preStrike', (cap, ctx) => (ctx.atk.cap||'').includes('solo_destroy') && typeof ctx.targetIdx==='number', ctx => {
  const { AP, DP, atk, attackerIdx, targetP, targetIdx } = ctx;
  const myLive = AP.field.filter((x,i2)=>x&&!x.faceDown&&i2!==attackerIdx);
  if(myLive.length===0) {
    const tgt2 = DP.field[targetIdx];
    if(tgt2) {
      return (async () => {
        addLog(`${atk.n} — Solo Destroy!`,'special');
        await handleDeath(targetP, tgt2);
        AP.attacked.add(attackerIdx);
        renderAll(); checkVictory();
        return 'abort';
      })();
    }
  }
});
// ESQUIVE (2.2, remplace l'ex-coinflip_defense 50%) : DÉTERMINISTE — la
// première attaque subie par ce monstre à chaque phase du Cycle Céleste rate.
// Le compteur (esquiveUsed) est réinitialisé à chaque changement de phase du
// Cycle (cf. doEndTurn). Badge 💨 tant que l'esquive est disponible.
registerCombat('preStrike', (cap, ctx) => {
  if(typeof ctx.targetIdx!=='number') return false;
  const def0 = ctx.DP.field[ctx.targetIdx];
  return !!(def0 && (def0.cap||'').includes('esquive') && !def0.esquiveUsed);
}, ctx => {
  const { AP, DP, attackerIdx, targetIdx } = ctx;
  const def0 = DP.field[targetIdx];
  def0.esquiveUsed = true;
  addLog(`💨 ${def0.n} — ESQUIVE ! L'attaque rate (recharge au prochain changement de Cycle).`,'special');
  AP.attacked.add(attackerIdx); renderAll(); return 'abort';
});
// splash_adjacent (JÖRMUNGANDR): demi-ATK aux monstres adjacents (jamais d'abort).
registerCombat('preStrike', (cap, ctx) => (ctx.atk.cap||'').includes('splash_adjacent') && typeof ctx.targetIdx==='number', ctx => {
  const { DP, atk, targetP, targetIdx } = ctx;
  const adj = [targetIdx-1, targetIdx+1];
  // Détermine si un soin/mort nécessitera un await ; sinon reste synchrone.
  let needsAsync = false;
  for(const ai of adj) { const am=DP.field[ai]; if(am&&!am.faceDown && Math.max(0,am.cDef-Math.ceil(atk.cAtk/2))<=0) needsAsync=true; }
  if(!needsAsync) {
    for(const ai of adj) {
      const am = DP.field[ai];
      if(am&&!am.faceDown) {
        const splashDmg = Math.ceil(atk.cAtk/2);
        am.cDef = Math.max(0, am.cDef - splashDmg);
        addLog(`${atk.n} — Splash ${splashDmg} dmg to ${am.n}!`,'dmg');
      }
    }
    return;
  }
  return (async () => {
    for(const ai of adj) {
      const am = DP.field[ai];
      if(am&&!am.faceDown) {
        const splashDmg = Math.ceil(atk.cAtk/2);
        am.cDef = Math.max(0, am.cDef - splashDmg);
        addLog(`${atk.n} — Splash ${splashDmg} dmg to ${am.n}!`,'dmg');
        if(am.cDef<=0) await handleDeath(targetP, am);
      }
    }
  })();
});

// ── Registre des effets d'ENTRÉE ([Entrée] / battlecry) ────────────────
registerEffect('entry', cap => cap.includes('entry_dmg5_all'), async ctx => {
  const { p, opp, idx, m, cap } = ctx;
  // Typhon: 5 dmg to ALL other monsters in play
  const allTargets5 = [];
  for(let pl=1;pl<=2;pl++) G.players[pl].field.filter((x,j)=>x&&!x.faceDown&&!(pl===p&&j===idx)).forEach(x=>allTargets5.push({pl,x}));
  for(const {pl,x} of allTargets5) { x.cDef=Math.max(0,x.cDef-5); if(x.cDef<=0) await handleDeath(pl,x); }
  addLog(`${m.n} — 5 dégâts à tous!`,'dmg');
});
registerEffect('entry', cap => cap.includes('entry_dmg4') || cap.includes('entry_dmg3') && !cap.includes('entry_dmg5'), async ctx => {
  const { p, opp, idx, m, cap } = ctx;
  const dmgAmt = cap.includes('entry_dmg4') ? 4 : 3;
  const oppField = G.players[opp].field.filter(x=>x&&!x.faceDown);
  if(oppField.length>0) {
    const tgt = oppField.reduce((a,b)=> (a.cDef<=b.cDef?a:b));
    tgt.cDef -= dmgAmt;
    addLog(`${m.n} — ${dmgAmt} damage to ${tgt.n}`,'dmg');
    if(tgt.cDef<=0) await handleDeath(opp, tgt);
  } else {
    G.players[opp].hp -= dmgAmt;
    addLog(`${m.n} — ${dmgAmt} damage to Player ${opp}`,'dmg');
  }
});
registerEffect('entry', cap => cap.includes('entry_sleep'), async ctx => { await pickTarget('sleep', ctx.p, true); });
// ── Cartes temporelles (3.2) ──
registerEffect('entry', cap => cap.includes('entry_cycle_advance1'), ctx => {
  setCyclePhase(G.cycle + 1, ctx.m.n);
});
registerEffect('entry', cap => cap.includes('entry_cycle_delay1'), ctx => {
  setCyclePhase(G.cycle - 1, ctx.m.n);
});
registerEffect('entry', cap => cap.includes('entry_cycle_freeze1'), ctx => {
  G.cycleFrozen = (G.cycleFrozen||0) + 1;
  addLog(`🧊 ${ctx.m.n} — le Cycle est figé 1 tour !`,'special');
});
registerEffect('entry', cap => cap.includes('entry_cycle_prophecy'), async ctx => {
  const cur = G.cycle % 5;
  const opts = [(cur+1)%5, (cur+2)%5, (cur+3)%5];
  const chosen = await pickCyclePhase(ctx.p, opts, 'Prophétie — choisissez la prochaine phase');
  setCyclePhase(chosen, ctx.m.n);
});
registerEffect('exit', cap => cap.includes('exit_cycle_delay1'), ctx => {
  setCyclePhase(G.cycle - 1, ctx.m.n + ' (Mort)');
});
registerEffect('entry', cap => cap.includes('entry_blind'), async ctx => { await pickTarget('blind', ctx.p, true); });
registerEffect('entry', cap => cap.includes('entry_draw_per_ally'), async ctx => {
  const { p, idx, m } = ctx;
  const allyCnt = Math.min(3, G.players[p].field.filter((x,j)=>x&&j!==idx&&!x.faceDown).length);
  for(let d=0;d<allyCnt;d++) drawCard(p);
  if(allyCnt>0) addLog(`${m.n} — Pioche ${allyCnt}!`,'buff');
});
// (else-if d'origine) : entry_draw ne déclenche QUE si entry_draw_per_ally n'a pas matché
registerEffect('entry', cap => cap.includes('entry_draw') && !cap.includes('exit') && !cap.includes('entry_draw_per_ally'), async ctx => {
  drawCard(ctx.p); addLog(`${ctx.m.n} — Draw 1`,'buff');
});
registerEffect('entry', cap => cap.includes('entry_curse2'), async ctx => {
  const { opp } = ctx;
  const oppField = G.players[opp].field.filter(x=>x&&!x.faceDown);
  let cnt=0;
  for(const x of oppField) { if(cnt<2){ x.cursed=true; cnt++; addLog(`${x.n} CURSED!`,'debuff'); } }
});
registerEffect('entry', cap => cap.includes('entry_shield_all'), async ctx => {
  eachAllyExclSelf(ctx, x => { x.cDef++; });
  addLog(`${ctx.m.n} — +1 shield all allies`,'buff');
});
registerEffect('entry', cap => cap.includes('entry_buff11'), async ctx => {
  eachAllyExclSelf(ctx, x => { x.cAtk++; x.cDef++; });
  addLog(`${ctx.m.n} — +1/+1 all allies`,'buff');
});
registerEffect('entry', cap => cap.includes('entry_buff_atk'), async ctx => {
  eachAllyExclSelf(ctx, x => { x.cAtk++; });
  addLog(`${ctx.m.n} — +1 ATK all allies`,'buff');
});
registerEffect('entry', cap => cap.includes('entry_freeplay2'), async ctx => {
  const { p, m } = ctx;
  const pi = G.players[p].hand.findIndex(c=>c.type==='monster'&&c.cost<=2);
  if(pi>=0) {
    const free = G.players[p].hand.splice(pi,1)[0];
    addLog(`${m.n} — Plays ${free.n} for free!`,'event');
    await playMonster(free, p);
  }
});
registerEffect('entry', cap => cap.includes('entry_freespell2'), async ctx => {
  const { p, m } = ctx;
  const pi = G.players[p].hand.findIndex(c=>c.type==='spell'&&c.cost<=2);
  if(pi>=0) {
    const free = G.players[p].hand.splice(pi,1)[0];
    addLog(`${m.n} — Plays ${free.n} for free!`,'event');
    await applySpellEffect(free, p);
    G.players[p].graveyard.push(free);
  }
});
registerEffect('entry', cap => cap.includes('entry_draw_exit_draw'), ctx => { drawCard(ctx.p); addLog(`${ctx.m.n} — Draw 1`,'buff'); });
registerEffect('entry', cap => cap.includes('entry_cancel'), async ctx => { await pickTarget('cancel_ms', ctx.p, true); });
registerEffect('entry', cap => cap.includes('entry_copy_ally'), async ctx => {
  const { p, idx } = ctx;
  // Bakeneko: copy an allied monster
  const allies = G.players[p].field.filter((x,j) => x && j !== idx && !x.faceDown);
  if(allies.length > 0) {
    await pickTarget('copy_ally', p, true);
  }
});
registerEffect('entry', cap => cap.includes('entry_search_ratatosk') || cap.includes('entry_search_self'), async ctx => {
  const { p, m } = ctx;
  const deck3 = G.players[p].deck;
  const found3 = deck3.findIndex(c=>c.id==='RATATOSK');
  if(found3>=0) {
    const r3 = deck3.splice(found3,1)[0];
    G.players[p].hand.push(r3);
    addLog(`${m.n} — Ratatosk trouvé!`,'event');
  }
  deck3.sort(()=>rng()-0.5);
});
registerEffect('entry', cap => cap.includes('entry_tokens4'), async ctx => {
  const { p, m } = ctx;
  const P2 = G.players[p];
  for(let t=0; t<4 && P2.field.length<6; t++) {
    const tok = newCard({id:'TOKEN11',n:'Jeton 1/1',atk:1,def:1,cost:0,type:'monster',cap:'',txt:'',rarity:'common',faction:G.players[p].faction});
    tok.cAtk=1; tok.cDef=1; P2.field.push(tok);
  }
  addLog(`${m.n} — 4 jetons 1/1!`,'event');
});
registerEffect('entry', cap => cap.includes('entry_wipe'), async ctx => {
  const { p, idx, m } = ctx;
  const allToKill2 = [];
  for(let pl=1;pl<=2;pl++) {
    G.players[pl].field.filter((x,j)=>x&&!(pl===p&&j===idx)&&!x.faceDown).forEach(x=>allToKill2.push({pl,x}));
  }
  for(const {pl,x} of allToKill2) await handleDeath(pl,x);
  addLog(`${m.n} — BOARD WIPE!`,'dmg');
});
registerEffect('entry', cap => cap.includes('hurry_entry_revive') || cap.includes('entry_resurrect3'), async ctx => {
  const { p, m } = ctx;
  const grave = G.players[p].graveyard.filter(c=>c.type==='monster' && c.def>=3);
  if(grave.length>0 && G.players[p].field.length<6) {
    const res = grave[grave.length-1];
    G.players[p].graveyard.splice(G.players[p].graveyard.lastIndexOf(res),1);
    res.cAtk=res.atk; res.cDef=res.def; res.endureUsed=false; res.cursed=false;
    G.players[p].field.push(res);
    addLog(`${m.n} — ${res.n} ressuscité!`,'event');
  }
});
registerEffect('entry', cap => cap.includes('temp_steal_hurry') || cap.includes('temp_steal_hurry')||cap.includes('steal_hurry'), async ctx => {
  await pickTarget('steal_hurry', ctx.p, true);
});
registerEffect('entry', cap => cap.includes('token_copies_graveyard') || cap.includes('token_copies_graveyard')||cap.includes('entry_tokens_graveyard'), async ctx => {
  const { p, m } = ctx;
  // Babaï: pick up to 2 monsters from graveyard, create 1/1 copies
  const grave = G.players[p].graveyard.filter(c=>c.type==='monster');
  const picked = grave.slice(-2);
  for(const gm of picked) {
    if(G.players[p].field.length<6) {
      const tok = newCard({...gm, atk:1, def:1, cost:0, cap:'', txt:'(jeton copie 1/1)'});
      tok.cAtk=1; tok.cDef=1; zenithTokenBoost(p, tok);
      G.players[p].field.push(tok);
    }
  }
  if(picked.length) addLog(`${m.n} — ${picked.length} jeton(s) copie 1/1!`,'event');
});
registerEffect('entry', cap => cap.includes('entry_reclaim') || cap.includes('entry_reclaim_spell') || cap.includes('entry_reclaim')||cap.includes('entry_recover_grave') || cap.includes('entry_recover_spell'), async ctx => {
  const { p, m, cap } = ctx;
  if(cap.includes('entry_reclaim_spell') || cap.includes('entry_recover_spell')) {
    const spells = G.players[p].graveyard.filter(c=>c.type==='spell'||c.type==='god');
    if(spells.length>0) {
      const sp2 = spells[spells.length-1];
      G.players[p].graveyard.splice(G.players[p].graveyard.lastIndexOf(sp2),1);
      G.players[p].hand.push(sp2);
      addLog(`${m.n} — ${sp2.n} retourné en main!`,'event');
    }
  } else {
    const monsters2 = G.players[p].graveyard.filter(c=>c.type==='monster');
    if(monsters2.length>0) {
      const gm2 = monsters2[monsters2.length-1];
      G.players[p].graveyard.splice(G.players[p].graveyard.lastIndexOf(gm2),1);
      G.players[p].hand.push(gm2);
      addLog(`${m.n} — ${gm2.n} retourné en main!`,'event');
    }
  }
});
registerEffect('entry', cap => cap.includes('entry_copy_field'), async ctx => {
  const { m } = ctx;
  // Chimere: copy any visible monster
  const all = [...G.players[1].field, ...G.players[2].field].filter(x=>x&&!x.faceDown);
  if(all.length > 0) {
    const best = all.reduce((a,b)=>(a.cAtk+a.cDef)>(b.cAtk+b.cDef)?a:b);
    Object.assign(m, {atk:best.atk,def:best.def,cAtk:best.cAtk,cDef:best.cDef,cap:best.cap,txt:best.txt,n:`${m.n}(${best.n})`});
    addLog(`${m.n} copie ${best.n}!`,'event');
  }
});
registerEffect('entry', cap => cap.includes('entry_draw_per_greek') || cap.includes('entry_draw_per_greek')||cap.includes('entry_pioche_grec'), async ctx => {
  ctx.m._scyllaActive = true;
  addLog(`${ctx.m.n} — Moteur de pioche activé!`,'event');
});
registerEffect('entry', cap => cap.includes('entry_destroy_catchup'), async ctx => {
  const { p } = ctx;
  if(G.players[p].hp <= 60) {
    await pickTarget('destroy', p, true);
  }
});
registerEffect('entry', cap => cap.includes('entry_token_copies_2') || cap.includes('entry_token_copies_2')||cap.includes('entry_2copy_tokens'), async ctx => {
  const { p, idx, m } = ctx;
  const myField2 = G.players[p].field.filter((x,j)=>x&&j!==idx&&!x.faceDown);
  const picked2 = myField2.slice(0,2);
  for(const gm3 of picked2) {
    if(G.players[p].field.length<6) {
      const tok2 = newCard({...gm3, atk:1,def:1,cost:0,cap:'',txt:'(jeton copie 1/1)'});
      tok2.cAtk=1; tok2.cDef=1;
      G.players[p].field.push(tok2);
    }
  }
  if(picked2.length) addLog(`${m.n} — ${picked2.length} jeton(s) copie 1/1!`,'event');
});
registerEffect('entry', cap => cap.includes('copy_ally_def') || cap.includes('copy_ally_def')||cap.includes('entry_copy_def'), async ctx => {
  const { p, idx, m } = ctx;
  const allies4 = G.players[p].field.filter((x,j)=>x&&j!==idx&&!x.faceDown);
  if(allies4.length>0) {
    const best4 = allies4.reduce((a,b)=>a.cDef>b.cDef?a:b);
    m.cDef = best4.cDef; m.def = best4.cDef;
    addLog(`${m.n} — copie DEF ${best4.cDef} de ${best4.n}!`,'event');
  }
});
registerEffect('entry', cap => cap.includes('reveal_play_free') || cap.includes('reveal_play_free')||cap.includes('challenge_free'), async ctx => {
  const { p, m } = ctx;
  // KAQKOJ: reveal 3 cards, opponent picks one, play it free
  const hand5 = G.players[p].hand;
  if(hand5.length>=3) {
    const chosen = hand5[0]; // AI: pick first; human would pick via UI
    addLog(`${m.n} — Joue ${chosen.n} gratuitement!`,'event');
    G.players[p].hand.splice(0,1);
    chosen._freePlay = true;
    if(chosen.type==='monster') await playMonster(chosen, p);
    else if(chosen.type==='god'||chosen.type==='spell') { await applySpellEffect(chosen, p); G.players[p].graveyard.push(chosen); }
  }
});

async function applyEntry(p, idx, m) {
  // Dispatch composable : la cap d'origine est figée une fois (comme l'ancien
  // `const cap`), puis chaque effet d'entrée enregistré s'applique dans l'ordre.
  await runEffects('entry', { p, idx, m, opp: p===1?2:1, cap: m.cap||'' });
}

// ── Registre des effets de SORTIE ([Sortie] / deathrattle) ─────────────
registerEffect('exit', cap => cap.includes('exit_sleep'), async ctx => { await pickTarget('sleep', ctx.p, false); });
registerEffect('exit', cap => cap.includes('exit_destroy'), async ctx => { await pickTarget('destroy', ctx.p, false); });
registerEffect('exit', cap => cap.includes('exit_blind'), async ctx => { await pickTarget('blind', ctx.p, false); });
registerEffect('exit', cap => cap.includes('exit_curse'), async ctx => { await pickTarget('curse', ctx.p, false); });
registerEffect('exit', cap => cap.includes('exit_draw'), ctx => { drawCard(ctx.p); addLog(`${ctx.m.n} Exit — Draw 1`,'buff'); });
registerEffect('exit', cap => cap.includes('exit_copy'), ctx => {
  const { p, m } = ctx;
  const P = G.players[p];
  if(P.field.length<6) {
    const copy = newCard({...m, cap:'', txt:'(copy, no capacity)'});
    copy.cAtk=m.atk; copy.cDef=m.def;
    P.field.push(copy);
    addLog(`${m.n} Exit — Creates a copy!`,'event');
  }
});
registerEffect('exit', cap => cap.includes('exit_freeplay'), async ctx => {
  const { p, m } = ctx;
  const P = G.players[p];
  if(P.hand.length>0) {
    const ri = Math.floor(rng()*P.hand.length);
    const free = P.hand.splice(ri,1)[0];
    addLog(`${m.n} Exit — Plays ${free.n} for free!`,'event');
    if(free.type==='monster') await playMonster(free, p);
    else { await applySpellEffect(free, p); P.graveyard.push(free); }
  }
});
registerEffect('exit', cap => cap.includes('entry_draw_exit_draw'), ctx => { drawCard(ctx.p); addLog(`${ctx.m.n} Exit — Draw 1`,'buff'); });
registerEffect('exit', cap => cap.includes('exit_search_3def')||cap.includes('exit_search_3atk')||cap.includes('exit_search3')||cap.includes('exit_search_atk3')||cap.includes('exit_search_faction'), ctx => {
  const { p, m, cap } = ctx;
  const P3 = G.players[p];
  let candidates;
  if(cap.includes('exit_search_3atk')||cap.includes('exit_search_atk3')) {
    candidates = P3.deck.filter(c=>c.type==='monster' && c.atk<=3);
  } else {
    candidates = P3.deck.filter(c=>c.type==='monster' && c.def<=3);
  }
  if(candidates.length>0) {
    // Pick best candidate
    const found = candidates[0];
    P3.deck.splice(P3.deck.indexOf(found),1);
    P3.hand.push(found);
    addLog(`${m.n} Exit — ${found.n} trouvé!`,'event');
  }
});
registerEffect('exit', cap => cap.includes('exit_copy_killer') || cap.includes('exit_copy_killer')||cap.includes('exit_copy_token'), ctx => {
  const { p, m } = ctx;
  if(m._killedBy && G.players[p].field.length<6) {
    const tok = newCard({...m._killedBy, atk:m._killedBy.atk, def:m._killedBy.def, cost:0, cap:'', txt:'(copie sans cap)'});
    tok.cAtk=m._killedBy.atk; tok.cDef=m._killedBy.def;
    G.players[p].field.push(tok);
    addLog(`${m.n} Exit — Copie de ${m._killedBy.n}!`,'event');
  }
});
registerEffect('exit', cap => cap.includes('exit_autocopy'), ctx => {
  const { p, m } = ctx;
  // Akkorokamui
  if(G.players[p].field.length<6) {
    const copy = newCard({...m, cap:'', txt:'(copie sans capacité)'});
    copy.cAtk=m.atk; copy.cDef=m.def;
    G.players[p].field.push(copy);
    addLog(`${m.n} Exit — Auto-copie invoquée!`,'event');
  }
});
registerEffect('exit', cap => cap.includes('exit_dmg3_all') || cap.includes('exit_dmg3_all_opp'), ctx => {
  const { p, m } = ctx;
  const opp3 = p===1?2:1;
  G.players[opp3].field.filter(x=>x&&!x.faceDown).forEach(async x=>{
    x.cDef = Math.max(0, x.cDef-3);
    if(x.cDef<=0) await handleDeath(opp3,x);
  });
  addLog(`${m.n} Exit — 3 dégâts à tous les adverses!`,'dmg');
});
registerEffect('exit', cap => cap.includes('exit_heal4'), ctx => {
  const { p, m } = ctx;
  G.players[p].hp = Math.min(25, G.players[p].hp + 4);
  addLog(`${m.n} Exit — +4 PV!`,'heal');
});

async function applyExit(p, m) {
  // Dispatch composable des effets de sortie (cf. moteur d'effets).
  await runEffects('exit', { p, m, opp: p===1?2:1, cap: m.cap||'' });
}

// =====================================================
// DEATH HANDLING
// =====================================================
// ── Attack lunge animation ────────────────────────────────────────
// Physically moves the attacking card toward its target then snaps back.
// Direction is computed from live DOM positions and stored as CSS vars.
function animateAttack(attackerEl, targetEl) {
  if(!attackerEl || !targetEl) return Promise.resolve();
  const ar = attackerEl.getBoundingClientRect();
  const tr = targetEl.getBoundingClientRect();
  const dx = ((tr.left + tr.width/2)  - (ar.left + ar.width/2))  * 0.52;
  const dy = ((tr.top  + tr.height/2) - (ar.top  + ar.height/2)) * 0.52;
  attackerEl.style.setProperty('--atk-dx', dx + 'px');
  attackerEl.style.setProperty('--atk-dy', dy + 'px');
  attackerEl.classList.add('attacking');
  return new Promise(r => setTimeout(() => {
    attackerEl.classList.remove('attacking');
    r();
  }, 400));
}

function animateDeath(cardDiv, callback) {
  if (!cardDiv) { if(callback) callback(); return; }
  cardDiv.style.animation = 'card-death .45s ease-in forwards';
  setTimeout(() => {
    if (cardDiv.parentNode) cardDiv.parentNode.removeChild(cardDiv);
    if (callback) callback();
  }, 480);
}


async function handleDeath(p, m) {
  const P = G.players[p];
  const idx = P.field.indexOf(m);
  if(idx<0) return;

  // Endure
  if((m.cap||'').includes('endure') && !m.endureUsed) {
    m.endureUsed=true; m.cDef=1; m.cAtk=m.atk;
    m.cap=''; m.txt='(endured)';
    addLog(`${m.n} — Endure! Returns with 1🛡`,'buff');
    P.attacked.delete(idx);
    return;
  }

  // Poseidon trigger
  const opp=p===1?2:1;
  checkFaceDownTrigger(opp,'ally_dies',m,p);

  // Balder
  if(P.balderActive && P.field.length<6) {
    P.field.splice(idx,1);
    P.graveyard.push(m);
    const token = newCard({id:'BALDER_TOKEN',n:'2/2 Token',atk:2,def:2,cost:0,type:'monster',cap:'',txt:'Balder token',faction:P.faction});
    token.cAtk=2; token.cDef=2;
    P.field.splice(idx,0,token);
    addLog(`Balder — 2/2 token replaces ${m.n}`,'event');
    reindexSets(P,idx,false);
    return;
  }

  // death_token22 (CHOHIX): spawn 2/2 token when ally dies
  if(m.id !== 'CHOHIX') {
    G.players[p].field.forEach(ally => {
      if(ally && (ally.cap||'').includes('death_token22') && G.players[p].field.length<6) {
        const tok22 = newCard({id:'TOKEN22',n:'Jeton 2/2',atk:2,def:2,cost:0,type:'monster',cap:'',txt:'',rarity:'common',faction:G.players[p].faction});
        tok22.cAtk=2; tok22.cDef=2; G.players[p].field.push(tok22);
        addLog(`Chohix — Jeton 2/2 invoqué!`,'event');
      }
    });
  }
  // Ragnarök counter: Norse faction death increments counter
  if((G.players[p].faction==='norse'||G.players[p===1?2:1].faction==='norse') && m.type==='monster') {
    G.ragnarok = (G.ragnarok||0) + 1;
  }
  // Reincarnation (AKKOROKAMUI): first death → reshuffle with +3/+3
  if((m.cap||'').includes('reincarnation') && !m.reincarnated) {
    const m2 = newCard({...m, atk:m.atk+3, def:m.def+3, cap:m.cap, reincarnated:true});
    m2.cAtk=m2.atk; m2.cDef=m2.def;
    G.players[p].deck.push(m2); G.players[p].deck.sort(()=>rng()-0.5);
    addLog(`✨ ${m.n} — Réincarnation! Retourne dans le deck avec +3/+3.`,'event');
    // Remove from field before exit, skip graveyard
    P.field.splice(idx,1); reindexSets(P,idx,true); return;
  }

  // BOSS Anubis (4.3) : le premier monstre IA détruit chaque tour revient en jeu.
  if(G.bossRule === 'anubis' && p === 2 && !G._anubisUsedTurn && m.type === 'monster') {
    G._anubisUsedTurn = true;
    m.cAtk = m.atk; m.cDef = m.def;
    m.cursed = false; m.asleep = false; m.faceDown = false; m.endureUsed = false;
    addLog(`⚰️ ANUBIS — ${m.n} refuse la mort et revient en jeu !`, 'special');
    return;
  }

  Audio5L.sfx.death();
  // Death animation: find card in DOM and play card-death before removing
  const _dyingEl = document.querySelector(`[data-player="${p}"][data-idx="${idx}"]`);
  if(_dyingEl) {
    _dyingEl.style.animation = 'card-death .38s ease-in forwards';
    _dyingEl.style.pointerEvents = 'none';
    await new Promise(r => setTimeout(r, 340));
  }
  await applyExit(p, m);
  P.field.splice(idx,1);
  P.graveyard.push(m);
  reindexSets(P, idx, true);
}

function reindexSets(P, removedIdx, removed) {
  const ns=new Set(), na=new Set();
  P.summoned.forEach(i=>{if(i<removedIdx)ns.add(i);else if(i>removedIdx)ns.add(i-1);});
  P.attacked.forEach(i=>{if(i<removedIdx)na.add(i);else if(i>removedIdx)na.add(i-1);});
  P.summoned=ns; P.attacked=na;
}

// =====================================================
// FACE-DOWN GREEK GOD TRIGGERS
// =====================================================
function checkFaceDownTrigger(p, event, trigger, triggerPlayer) {
  const P = G.players[p];
  const opp = p===1?2:1;
  
  for(let i=P.field.length-1;i>=0;i--) {
    const m = P.field[i];
    if(!m||!m.faceDown||m.type!=='god') continue;
    
    if(event==='monster_entry' && m.cap==='fd_cancel_monster') {
      m.faceDown=false;
      // cancel the trigger
      const tIdx = G.players[triggerPlayer].field.indexOf(trigger);
      if(tIdx>=0) {
        G.players[triggerPlayer].field.splice(tIdx,1);
        G.players[triggerPlayer].graveyard.push(trigger);
        addLog(`${m.n} activates — cancels ${trigger.n}!`,'special');
      }
      P.field.splice(i,1); P.graveyard.push(m);
      reindexSets(P,i,true);
      break;
    }
    if(event==='monster_entry' && m.cap==='fd_copy_monster') {
      m.faceDown=false;
      const copy = newCard({...trigger});
      copy.cAtk=trigger.atk; copy.cDef=trigger.def;
      if(P.field.length<6) { P.field.push(copy); addLog(`${m.n} activates — copies ${trigger.n}!`,'special'); }
      P.field.splice(i,1); P.graveyard.push(m);
      reindexSets(P,i,true);
      break;
    }
    if(event==='monster_entry' && m.cap==='fd_minus4_all') {
      m.faceDown=false;
      [1,2].forEach(pl=>G.players[pl].field.forEach(x=>{if(x){x.cDef=Math.max(0,x.cDef-4);}}));
      addLog(`${m.n} (Zeus) activates — −4 all shields!`,'special');
      checkAllDeaths();
      P.field.splice(i,1); P.graveyard.push(m);
      reindexSets(P,i,true);
      break;
    }
    if(event==='ally_dies' && m.cap==='fd_resurrect') {
      m.faceDown=false;
      const grave = P.graveyard.filter(c=>c.type==='monster');
      if(grave.length>0 && P.field.length<6) {
        const res = grave[grave.length-1];
        P.graveyard.splice(P.graveyard.lastIndexOf(res),1);
        res.cAtk=res.atk; res.cDef=res.def; res.endureUsed=false; res.cursed=false;
        P.field.push(res);
        addLog(`${m.n} (Poseidon) — ${res.n} resurrected!`,'special');
      }
      P.field.splice(i,1); P.graveyard.push(m);
      reindexSets(P,i,true);
      break;
    }
  }
}

async function checkAllDeaths() {
  for(let p=1;p<=2;p++) {
    for(let i=G.players[p].field.length-1;i>=0;i--) {
      const m=G.players[p].field[i];
      if(m&&m.cDef<=0&&!m.faceDown) await handleDeath(p,m);
    }
  }
}

// =====================================================
// GODS & SPELLS
// =====================================================
function showGodBurst(p) {
  // Brief sparkle effect at the center of the playing player's zone
  const bar = document.getElementById(`p${p}-bar`);
  if(!bar) return;
  const r = bar.getBoundingClientRect();
  const el = document.createElement('div');
  el.style.cssText = `position:fixed;left:${r.left+r.width/2-16}px;top:${r.top-30}px;`+
    `font-size:28px;pointer-events:none;z-index:500;animation:godBurst .65s ease-out forwards;`;
  el.textContent = '⚡';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 700);
}

// ════════════════════════════════════════════════════════════════════
// DISPATCH COMPOSABLE DES DIEUX — map cap -> handler (remplace la chaîne
// else-if de playGod). Chaque handler = {c,p,opp,cap}. Un handler qui
// renvoie 'noDiscard' indique que la carte ne doit pas être défaussée
// (déjà placée/équipée/rendue à la main), reproduisant les `return;` d'origine.
// async UNIQUEMENT si le corps contient un await (timing préservé via
// runEffects-like conditional-await dans playGod).
// ════════════════════════════════════════════════════════════════════
const GOD_EFFECTS = {};
GOD_EFFECTS["god_minus3_draw"] = async (ctx) => { const {c,p,opp,cap}=ctx; await pickTarget('minus3',p,false); drawCard(p); addLog(`Draw 1`,'buff'); };
GOD_EFFECTS["god_cancel_m"] = (ctx) => { const {c,p,opp,cap}=ctx;
    // Bug #2 fix: actually cancel the monster on the stack
    const stackM = G.stack && G.stack.find(s=>s.type==='monster');
    if(stackM) {
      G.stack = G.stack.filter(s=>s.type!=='monster');
      addLog(`${c.n} — ${stackM.card.n} COUNTERED!`,'special');
    } else if(G.lastPlayedByOpp && G.lastPlayedByOpp.type==='monster') {
      const oppP=p===1?2:1;
      const idx=G.players[oppP].field.indexOf(G.lastPlayedByOpp);
      if(idx>=0){ G.players[oppP].field.splice(idx,1); G.players[oppP].graveyard.push(G.lastPlayedByOpp); addLog(`${c.n} — ${G.lastPlayedByOpp.n} CANCELLED!`,'special'); G.lastPlayedByOpp=null; }
    } else { addLog(`${c.n} — No monster to counter`,'special'); }
  };
GOD_EFFECTS["god_create2"] = (ctx) => { const {c,p,opp,cap}=ctx;
    for(let i=0;i<2&&G.players[p].field.length<6;i++) {
      const t=newCard({id:'T',n:'0/2 Protect',atk:0,def:2,cost:0,type:'monster',cap:'protect',txt:'Protect'});
      t.cAtk=0;t.cDef=2; G.players[p].field.push(t);
    }
    addLog(`Izanagi — 2 blank 0/2 Protect tokens`,'event');
  };
GOD_EFFECTS["god_equip_return"] = async (ctx) => { const {c,p,opp,cap}=ctx;
    await pickTarget('equip_return', p, false, c);
  };
GOD_EFFECTS["god_cancel_s_draw"] = (ctx) => { const {c,p,opp,cap}=ctx;
    const stackS = G.stack && G.stack.find(s=>s.type==='spell');
    if(stackS) {
      G.stack = G.stack.filter(s=>s.type!=='spell');
      addLog(`${c.n} — ${stackS.card.n} COUNTERED!`,'special');
    } else if(G.lastPlayedSpell) {
      addLog(`${c.n} — ${G.lastPlayedSpell.n} cancelled`,'special'); G.lastPlayedSpell=null;
    } else { addLog(`${c.n} — No spell to counter`,'special'); }
    drawCard(p);
  };
GOD_EFFECTS["god_susanoo"] = async (ctx) => { const {c,p,opp,cap}=ctx; await pickTarget('destroy', p, false); };
GOD_EFFECTS["god_sleep"] = async (ctx) => { const {c,p,opp,cap}=ctx; await pickTarget('sleep', p, false); };
GOD_EFFECTS["god_steal"] = async (ctx) => { const {c,p,opp,cap}=ctx; await pickTarget('steal', p, false); };
GOD_EFFECTS["god_balder"] = (ctx) => { const {c,p,opp,cap}=ctx;
    G.players[p].balderActive=true;
    G.players[p].field.forEach(m=>{ if(m) m.balder=true; });
    addLog(`Balder — Your monsters create 2/2 on death!`,'buff');
    G.players[p].graveyard.push(c); return 'noDiscard';
  };
GOD_EFFECTS["god_minus2"] = async (ctx) => { const {c,p,opp,cap}=ctx; await pickTarget('minus2', p, false); };
GOD_EFFECTS["god_cancel_ms"] = (ctx) => { const {c,p,opp,cap}=ctx;
    if(G.stack && G.stack.length>0) {
      const entry=G.stack[0]; G.stack=[];
      addLog(`${c.n} — ${entry.card.n} COUNTERED!`,'special');
    } else { addLog(`${c.n} — Nothing on stack to counter`,'special'); }
  };
GOD_EFFECTS["god_swap"] = async (ctx) => { const {c,p,opp,cap}=ctx; await pickTarget('swap', p, false); };
GOD_EFFECTS["god_odin"] = (ctx) => { const {c,p,opp,cap}=ctx;
    const my=G.players[p].field.length, op=G.players[opp].field.length;
    if(my>op) { for(let i=0;i<my-op;i++) { const m=G.players[p].field.pop(); G.players[p].graveyard.push(m); addLog(`Odin — You sacrifice ${m.n}`); } }
    else if(op>my) { for(let i=0;i<op-my;i++) { const m=G.players[opp].field.shift(); G.players[opp].graveyard.push(m); addLog(`Odin — Opp sacrifices ${m.n}`); } }
    addLog(`Odin — Fields equalized!`,'event');
  };
GOD_EFFECTS["god_thor"] = (ctx) => { const {c,p,opp,cap}=ctx;
    if(G.players[opp].field.length>0) {
      const m=G.players[opp].field.shift(); G.players[opp].graveyard.push(m);
      addLog(`Thor — Opponent sacrifices ${m.n}!`,'event');
    }
  };
GOD_EFFECTS["god_blank11"] = async (ctx) => { const {c,p,opp,cap}=ctx; await pickTarget('blank11', p, false); };
GOD_EFFECTS["god_blind_draw"] = async (ctx) => { const {c,p,opp,cap}=ctx; await pickTarget('blind', p, false); drawCard(p); };
GOD_EFFECTS["god_force_attack"] = async (ctx) => { const {c,p,opp,cap}=ctx; await pickTarget('force_attack', p, false); };
GOD_EFFECTS["god_copy"] = async (ctx) => { const {c,p,opp,cap}=ctx; await pickTarget('copy', p, false); };
GOD_EFFECTS["god_buff3"] = async (ctx) => { const {c,p,opp,cap}=ctx; await pickTarget('buff3', p, false); };
GOD_EFFECTS["god_osiris"] = (ctx) => { const {c,p,opp,cap}=ctx;
    const specs=[{cap:'hurry',txt:'Hurry'},{cap:'hit',txt:'Hit'},{cap:'',txt:'Normal'}];
    specs.forEach(s=>{
      if(G.players[p].field.length<6){
        const t=newCard({id:'T',n:`2/2 ${s.txt}`,atk:2,def:2,cost:0,type:'monster',cap:s.cap,txt:s.txt});
        t.cAtk=2;t.cDef=2; G.players[p].field.push(t);
      }
    });
    addLog(`Osiris — 3 blank 2/2 Monsters!`,'event');
  };
GOD_EFFECTS["god_equip_minus2"] = async (ctx) => { const {c,p,opp,cap}=ctx; await pickTarget('equip_seth', p, false, c); return 'noDiscard'; };
GOD_EFFECTS["god_sandup2_draw"] = async (ctx) => { const {c,p,opp,cap}=ctx; await pickTarget('sandup', p, false); await pickTarget('sandup', p, false); drawCard(p); addLog(`Toth — Draw 1`,'buff'); };
GOD_EFFECTS["god_mutual_sacrifice"] = (ctx) => { const {c,p,opp,cap}=ctx;
    for(let pl=1;pl<=2;pl++) {
      if(G.players[pl].field.length>0) {
        const m=G.players[pl].field.shift(); G.players[pl].graveyard.push(m);
        addLog(`${c.n} — P${pl} sacrifices ${m.n}`,'event');
      }
    }
  };
GOD_EFFECTS["god_bewitch_draw"] = async (ctx) => { const {c,p,opp,cap}=ctx; await pickTarget('bewitch', p, false); drawCard(p); };
GOD_EFFECTS["god_minus4_all"] = async (ctx) => { const {c,p,opp,cap}=ctx;
    [1,2].forEach(pl=>G.players[pl].field.forEach(m=>{if(m){m.cDef=Math.max(0,m.cDef-4);}}));
    addLog(`${c.n} — −4 shield ALL!`,'dmg');
    await checkAllDeaths();
  };
GOD_EFFECTS["god_resurrect"] = (ctx) => { const {c,p,opp,cap}=ctx;
    const grave=G.players[p].graveyard.filter(x=>x.type==='monster');
    if(grave.length>0&&G.players[p].field.length<6){
      const m=grave[grave.length-1];
      G.players[p].graveyard.splice(G.players[p].graveyard.lastIndexOf(m),1);
      m.cAtk=m.atk;m.cDef=m.def;m.endureUsed=false;m.cursed=false;
      G.players[p].field.push(m);
      addLog(`${c.n} — ${m.n} resurrected!`,'event');
    }
  };
GOD_EFFECTS["god_cancel_attack"] = (ctx) => { const {c,p,opp,cap}=ctx; addLog(`${c.n} — Attack cancelled! +HP`,'special'); G.players[p].hp=Math.min(25,G.players[p].hp+3); drawCard(p); };
GOD_EFFECTS["god_redirect"] = async (ctx) => { const {c,p,opp,cap}=ctx; await pickTarget('redirect', p, false); };
GOD_EFFECTS["god_destroy_ms"] = async (ctx) => { const {c,p,opp,cap}=ctx; await pickTarget('destroy', p, false); };
GOD_EFFECTS["god_cancel_m_steal"] = (ctx) => { const {c,p,opp,cap}=ctx;
    // Amaterasu: cancel + steal
    const stackM2 = G.stack && G.stack.find(s=>s.type==='monster');
    if(stackM2) {
      G.stack = G.stack.filter(s=>s.type!=='monster');
      const stolen = stackM2.card;
      if(G.players[p].field.length<6) {
        const s2 = newCard({...stolen}); s2.cAtk=stolen.atk; s2.cDef=stolen.def;
        G.players[p].field.push(s2);
        addLog(`${c.n} — ${stolen.n} annulé et invoqué sur votre terrain!`,'special');
      }
    } else { addLog(`${c.n} — Rien à annuler`,'special'); }
  };
GOD_EFFECTS["god_heal_all"] = (ctx) => { const {c,p,opp,cap}=ctx;
    G.players[p].field.forEach(m=>{ if(m&&!m.faceDown) { m.cDef=m.def; } });
    addLog(`${c.n} — Tous les monstres soignés!`,'heal');
    Audio5L.sfx.heal();
  };
GOD_EFFECTS["god_resurrect2"] = (ctx) => { const {c,p,opp,cap}=ctx;
    const grave2 = G.players[p].graveyard.filter(x=>x.type==='monster'&&x.cost<=5);
    const toRes = grave2.slice(-2);
    for(const res2 of toRes) {
      G.players[p].graveyard.splice(G.players[p].graveyard.lastIndexOf(res2),1);
      G.players[p].hand.push(res2);
    }
    addLog(`${c.n} — ${toRes.length} monstre(s) retourné(s) en main!`,'event');
  };
GOD_EFFECTS["god_discard_hand_monster"] = async (ctx) => { const {c,p,opp,cap}=ctx;
    if(aiControls(p)) {
      const oppHand = G.players[opp].hand.filter(x=>x.type==='monster');
      if(oppHand.length>0) {
        const disc = oppHand.reduce((a,b)=>a.cost>b.cost?a:b);
        G.players[opp].hand.splice(G.players[opp].hand.indexOf(disc),1);
        G.players[opp].graveyard.push(disc);
        addLog(`${c.n} — ${disc.n} défaussé de la main adverse!`,'event');
      }
    } else { await pickTarget('discard_hand_monster',p,false); }
  };
GOD_EFFECTS["god_dmg3_or_6"] = async (ctx) => { const {c,p,opp,cap}=ctx; await pickTarget('dmg3or6',p,false); };
GOD_EFFECTS["god_sacrifice_opp_draw2"] = async (ctx) => { const {c,p,opp,cap}=ctx;
    if(G.players[opp].field.length>0) {
      const _live = G.players[opp].field.filter(x=>x&&!x.faceDown);
      const biggest = _live.length ? _live.reduce((a,b)=>a.cAtk>b.cAtk?a:b) : null;
      if(biggest) {
        const bIdx = G.players[opp].field.indexOf(biggest);
        await handleDeath(opp,biggest);
        addLog(`${c.n} — ${biggest.n} sacrifié!`,'event');
      }
    }
    drawCard(p); drawCard(p);
    addLog(`${c.n} — Piochez 2!`,'buff');
  };
GOD_EFFECTS["god_equalize_board_hand"] = (ctx) => { const {c,p,opp,cap}=ctx;
    const myF=G.players[p].field.length, opF=G.players[opp].field.length;
    if(myF>opF) for(let i=0;i<myF-opF;i++) { const m3=G.players[p].field.pop(); G.players[p].graveyard.push(m3); }
    else if(opF>myF) for(let i=0;i<opF-myF;i++) { const m3=G.players[opp].field.shift(); G.players[opp].graveyard.push(m3); }
    addLog(`${c.n} — Terrains équilibrés!`,'event');
  };
GOD_EFFECTS["god_draw_per_faction"] = (ctx) => { const {c,p,opp,cap}=ctx;
    const myCt = G.players[p].field.filter(m=>m&&m.faction===G.players[p].faction).length;
    for(let i=0;i<myCt;i++) drawCard(p);
    addLog(`${c.n} — Piochez ${myCt}!`,'buff');
  };
GOD_EFFECTS["god_5life_3faction"] = (ctx) => { const {c,p,opp,cap}=ctx;
    const factionCounts = {};
    G.players[p].field.filter(m=>m).forEach(m=>{ factionCounts[m.faction]=(factionCounts[m.faction]||0)+1; });
    const has3 = Object.values(factionCounts).some(n=>n>=3);
    if(has3) { G.players[p].hp=Math.min(25,G.players[p].hp+5); drawCard(p); addLog(`${c.n} — +5 PV + Pioche!`,'heal'); }
    else { addLog(`${c.n} — Condition non remplie`,'special'); G.players[p].hand.push(c); G.players[p].gems+=c.cost; return 'noDiscard'; }
  };
GOD_EFFECTS["god_cancel_ms_cap"] = async (ctx) => { const {c,p,opp,cap}=ctx; await pickTarget('cancel_ms',p,false); };
GOD_EFFECTS["god_cancel_attack_heal"] = (ctx) => { const {c,p,opp,cap}=ctx;
    // Osiris: cancel attack + heal
    addLog(`${c.n} — Attaque annulée!`,'special');
    // This is an anytime — handled when player uses it during reaction
  };
GOD_EFFECTS["god_force_fight"] = async (ctx) => { const {c,p,opp,cap}=ctx;
    const oppField4 = G.players[opp].field.filter(x=>x&&!x.faceDown);
    if(oppField4.length>=2) {
      const atker = oppField4.reduce((a,b)=>a.cAtk>b.cAtk?a:b);
      const victim = oppField4.filter(x=>x!==atker).reduce((a,b)=>a.cDef<b.cDef?a:b);
      victim.cDef = Math.max(0,victim.cDef-atker.cAtk);
      addLog(`${c.n} — ${atker.n}(${atker.cAtk}) forcé à attaquer ${victim.n}!`,'event');
      if(victim.cDef<=0) await handleDeath(opp,victim);
    }
  };
GOD_EFFECTS["god_copy_bonus"] = async (ctx) => { const {c,p,opp,cap}=ctx; await pickTarget('copy',p,false); };
GOD_EFFECTS["god_destroy_low_all"] = async (ctx) => { const {c,p,opp,cap}=ctx;
    const toDestroy = [];
    [1,2].forEach(pl=>G.players[pl].field.forEach(m=>{ if(m&&!m.faceDown&&m.cDef<=5) toDestroy.push({pl,m}); }));
    for(const {pl,m} of toDestroy) await handleDeath(pl,m);
    addLog(`${c.n} — Tous les monstres DEF≤5 détruits!`,'dmg');
  };
GOD_EFFECTS["god_cancel_spell_draw"] = async (ctx) => { const {c,p,opp,cap}=ctx; await pickTarget('cancel_ms',p,false); drawCard(p); };
GOD_EFFECTS["god_3shield_attacks"] = (ctx) => { const {c,p,opp,cap}=ctx;
    // Hestia: permanent 3-shield
    const hestiaToken = newCard({id:'HESTIA_TOKEN',n:'Hestia (3 boucliers)',atk:0,def:0,cost:0,type:'monster',cap:'hestia_passive',txt:'Annule 3 attaques adverses',rarity:'rare'});
    hestiaToken.cAtk=0; hestiaToken.cDef=0; hestiaToken._hestiaShields=3;
    if(G.players[p].field.length<6) G.players[p].field.push(hestiaToken);
    addLog(`${c.n} — 3 boucliers anti-attaque!`,'event');
    G.players[p].graveyard.push(c); return 'noDiscard';
  };
GOD_EFFECTS["god_bounce_1or2"] = async (ctx) => { const {c,p,opp,cap}=ctx; await pickTarget('bounce',p,false); };
GOD_EFFECTS["god_double_atk"] = async (ctx) => { const {c,p,opp,cap}=ctx; await pickTarget('buff_dbl_atk',p,false); };
GOD_EFFECTS["god_destroy_ms_bonus"] = async (ctx) => { const {c,p,opp,cap}=ctx; await pickTarget('destroy',p,false); };
GOD_EFFECTS["god_draw4_cheaper"] = (ctx) => { const {c,p,opp,cap}=ctx;
    for(let i=0;i<4;i++) drawCard(p);
    addLog(`${c.n} — Piochez 4!`,'buff');
  };
GOD_EFFECTS["god_steal_spell_monster"] = (ctx) => { const {c,p,opp,cap}=ctx;
    const stackAny = G.stack && G.stack[0];
    if(stackAny) {
      G.stack=[];
      G.players[p].hand.push(stackAny.card);
      addLog(`${c.n} — ${stackAny.card.n} annulé et mis en main!`,'special');
    } else { addLog(`${c.n} — Rien sur la pile`,'special'); }
  };
GOD_EFFECTS["god_all_opp_atk1"] = (ctx) => { const {c,p,opp,cap}=ctx;
    G.players[opp].field.filter(m=>m&&!m.faceDown).forEach(m=>{ m._origAtk=m.cAtk; m.cAtk=1; m._atk1Until=G.turn+1; });
    addLog(`${c.n} — ATK adverses → 1!`,'event');
  };
GOD_EFFECTS["god_5life_draw"] = (ctx) => { const {c,p,opp,cap}=ctx;
    G.players[p].hp=Math.min(25,G.players[p].hp+5);
    drawCard(p);
    addLog(`${c.n} — +5 PV + Pioche!`,'heal');
    Audio5L.sfx.heal();
  };
GOD_EFFECTS["god_scrye4_draw"] = (ctx) => { const {c,p,opp,cap}=ctx;
    // Ebisu: look at top 4, reorder, draw 1
    const P4 = G.players[p];
    const top4 = P4.deck.splice(0, 4);
    // AI: just put best card first; Human: simplified - draw the best
    top4.sort((a,b) => (b.cost||0)-(a.cost||0));
    P4.hand.push(top4.shift());
    P4.deck.unshift(...top4);
    addLog(`${c.n} — Scrye 4, pioche 1!`,'buff');
    Audio5L.sfx.draw();
  };
GOD_EFFECTS["god_steal_temp_perm"] = async (ctx) => { const {c,p,opp,cap}=ctx; await pickTarget('steal', p, false); };
GOD_EFFECTS["god_swap_hands"] = (ctx) => { const {c,p,opp,cap}=ctx;
    const h1=[...G.players[1].hand], h2=[...G.players[2].hand];
    const bigger = h1.length >= h2.length ? h1.length : h2.length;
    G.players[1].hand=[...h2]; G.players[2].hand=[...h1];
    // Draw to bigger size
    while(G.players[p].hand.length < bigger && G.players[p].deck.length > 0) drawCard(p);
    addLog(`${c.n} — Échange de mains!`,'event');
  };
GOD_EFFECTS["god_redirect_to_monster"] = (ctx) => { const {c,p,opp,cap}=ctx;
    addLog(`${c.n} — Attaque redirigée vers un monstre adverse!`,'special');
    // Handled during reaction window
  };
GOD_EFFECTS["god_draft4"] = (ctx) => { const {c,p,opp,cap}=ctx;
    const P5 = G.players[p];
    const drawn = P5.deck.splice(0, 4);
    if(drawn.length > 0) {
      // AI picks best for opponent; simplified: player keeps first
      const kept = drawn[0];
      P5.hand.push(kept);
      drawn.slice(1).forEach(x => P5.graveyard.push(x));
      addLog(`${c.n} — Draft: ${kept.n} en main!`,'event');
    }
  };
GOD_EFFECTS["god_atk5_buff"] = async (ctx) => { const {c,p,opp,cap}=ctx; await pickTarget('buff_atk5', p, false); };
GOD_EFFECTS["god_dmg3"] = async (ctx) => { const {c,p,opp,cap}=ctx; await pickTarget('dmg3', p, false); };
GOD_EFFECTS["god_copy_spell"] = (ctx) => { const {c,p,opp,cap}=ctx; addLog(`${c.n} — Copie le sort adverse!`,'special'); };
GOD_EFFECTS["god_recover_1or2"] = (ctx) => { const {c,p,opp,cap}=ctx;
    const grave3 = G.players[p].graveyard;
    if(grave3.length > 0) {
      const found2 = grave3.pop();
      G.players[p].hand.push(found2);
      addLog(`${c.n} — ${found2.n} retourné en main!`,'event');
    }
  };
GOD_EFFECTS["god_search2_cost2"] = (ctx) => { const {c,p,opp,cap}=ctx;
    const found3 = G.players[p].deck.filter(x=>x.type==='monster'&&x.cost<=2).slice(0,2);
    found3.forEach(x => {
      G.players[p].deck.splice(G.players[p].deck.indexOf(x),1);
      G.players[p].hand.push(x);
    });
    addLog(`${c.n} — ${found3.length} monstre(s) cherché(s)!`,'event');
  };
GOD_EFFECTS["god_discard2_random"] = (ctx) => { const {c,p,opp,cap}=ctx;
    for(let i=0;i<2&&G.players[opp].hand.length>0;i++) {
      const ri=Math.floor(rng()*G.players[opp].hand.length);
      const disc2=G.players[opp].hand.splice(ri,1)[0];
      G.players[opp].graveyard.push(disc2);
      addLog(`${c.n} — ${disc2.n} défaussé!`,'event');
    }
  };
GOD_EFFECTS["god_sacrifice_ms"] = (ctx) => { const {c,p,opp,cap}=ctx;
    if(G.players[opp].field.length>0) {
      const m4=G.players[opp].field.shift(); G.players[opp].graveyard.push(m4);
      addLog(`${c.n} — ${m4.n} sacrifié!`,'event');
    }
  };
GOD_EFFECTS["god_equip_draw_attack"] = async (ctx) => { const {c,p,opp,cap}=ctx; await pickTarget('equip_draw_attack', p, false, c); return 'noDiscard'; };
GOD_EFFECTS["god_equip_2shield"] = async (ctx) => { const {c,p,opp,cap}=ctx; await pickTarget('equip_2shield', p, false, c); return 'noDiscard'; };
GOD_EFFECTS["god_swap_hand_field"] = (ctx) => { const {c,p,opp,cap}=ctx;
    const handMonsters = G.players[p].hand.filter(x=>x.type==='monster'&&x.faction===G.players[p].faction);
    const fieldMonsters = G.players[p].field.filter(x=>x&&!x.faceDown);
    if(handMonsters.length>0 && fieldMonsters.length>0) {
      const hm = handMonsters[0];
      const fm = fieldMonsters[0];
      G.players[p].hand.splice(G.players[p].hand.indexOf(hm),1);
      G.players[p].field.splice(G.players[p].field.indexOf(fm),1,hm);
      G.players[p].hand.push(fm);
      addLog(`${c.n} — ${hm.n} ↔ ${fm.n}!`,'event');
    }
  };
GOD_EFFECTS["god_draw2_free_if_solo"] = (ctx) => { const {c,p,opp,cap}=ctx;
    drawCard(p); drawCard(p);
    addLog(`${c.n} — Piochez 2!`,'buff');
  };
GOD_EFFECTS["god_draw_if_ally_dies"] = (ctx) => { const {c,p,opp,cap}=ctx;
    G.players[p]._gebActive = true;
    addLog(`${c.n} — Si un allié meurt ce tour, piochez 1!`,'event');
    G.players[p].graveyard.push(c); return 'noDiscard';
  };
GOD_EFFECTS["god_sacrifice_search_plus1"] = (ctx) => { const {c,p,opp,cap}=ctx;
    if(G.players[p].field.length>0) {
      const sacrificed = G.players[p].field.shift();
      G.players[p].graveyard.push(sacrificed);
      const targetCost = (sacrificed.cost||0)+1;
      const found4 = G.players[p].deck.find(x=>x.type==='monster'&&x.cost===targetCost);
      if(found4 && G.players[p].field.length<6) {
        G.players[p].deck.splice(G.players[p].deck.indexOf(found4),1);
        found4.cAtk=found4.atk; found4.cDef=found4.def;
        G.players[p].field.push(found4);
        addLog(`${c.n} — ${sacrificed.n} sacrifié → ${found4.n} invoqué!`,'event');
      }
    }
  };
GOD_EFFECTS["god_draft6"] = (ctx) => { const {c,p,opp,cap}=ctx;
    const top6 = G.players[p].deck.splice(0,6);
    // Simple: player keeps first 3
    const keep = top6.slice(0,3);
    keep.forEach(x => G.players[p].hand.push(x));
    top6.slice(3).forEach(x => G.players[p].graveyard.push(x));
    addLog(`${c.n} — Draft 6: ${keep.map(x=>x.n).join(', ')} en main!`,'event');
  };
GOD_EFFECTS["god_equip_discard_attack"] = async (ctx) => { const {c,p,opp,cap}=ctx; await pickTarget('equip_discard_attack', p, false, c); return 'noDiscard'; };
GOD_EFFECTS["god_tokens22_faction"] = (ctx) => { const {c,p,opp,cap}=ctx;
    const myField3 = G.players[p].field.filter(x=>x&&!x.faceDown&&x.faction===G.players[p].faction);
    myField3.forEach(()=>{
      if(G.players[p].field.length<6) {
        const tok3=newCard({id:'TOKEN22',n:'Jeton 2/2',atk:2,def:2,cost:0,type:'monster',cap:'',txt:'',rarity:'common',faction:G.players[p].faction});
        tok3.cAtk=2; tok3.cDef=2; zenithTokenBoost(p, tok3); G.players[p].field.push(tok3);
      }
    });
    addLog(`${c.n} — ${myField3.length} jeton(s) 2/2!`,'event');
  };
GOD_EFFECTS["god_search_monster"] = (ctx) => { const {c,p,opp,cap}=ctx;
    const found5 = G.players[p].deck.find(x=>x.type==='monster');
    if(found5) {
      G.players[p].deck.splice(G.players[p].deck.indexOf(found5),1);
      G.players[p].hand.push(found5);
      addLog(`${c.n} — ${found5.n} trouvé!`,'event');
    }
  };
GOD_EFFECTS["god_equip_resurrect"] = async (ctx) => { const {c,p,opp,cap}=ctx; await pickTarget('equip_resurrect', p, false, c); return 'noDiscard'; };
GOD_EFFECTS["god_draw3_discard2"] = (ctx) => { const {c,p,opp,cap}=ctx; drawCard(p); drawCard(p); drawCard(p); while(G.players[p].hand.length>7) G.players[p].graveyard.push(G.players[p].hand.pop()); addLog(`${c.n} — Pioche 3, défausse 2!`,'buff'); };
GOD_EFFECTS["god_halve_atk"] = async (ctx) => { const {c,p,opp,cap}=ctx; await pickTarget('halve_atk', p, false); };
GOD_EFFECTS["god_equip_bounce_attack"] = async (ctx) => { const {c,p,opp,cap}=ctx; await pickTarget('equip_bounce', p, false, c); return 'noDiscard'; };
GOD_EFFECTS["god_tokens_protect"] = (ctx) => { const {c,p,opp,cap}=ctx;
    const count2 = G.players[p].field.filter(x=>x).length === 0 ? 2 : 4;
    const tokStats = G.players[p].field.filter(x=>x).length === 0 ? {a:2,d:2} : {a:0,d:2};
    for(let i=0;i<count2&&G.players[p].field.length<6;i++) {
      const tok4=newCard({id:'DEMETER_TOK',n:`${tokStats.a}/${tokStats.d} Protection`,atk:tokStats.a,def:tokStats.d,cost:0,type:'monster',cap:'protect',txt:'Protection',rarity:'common',faction:G.players[p].faction});
      tok4.cAtk=tokStats.a; tok4.cDef=tokStats.d; G.players[p].field.push(tok4);
    }
    addLog(`${c.n} — ${count2} jeton(s) Protection!`,'event');
  };
GOD_EFFECTS["god_swap_monsters"] = async (ctx) => { const {c,p,opp,cap}=ctx; await pickTarget('swap', p, false); };
GOD_EFFECTS["god_discard_per_faction"] = (ctx) => { const {c,p,opp,cap}=ctx;
    const myFact = G.players[p].field.filter(x=>x&&!x.faceDown&&x.faction===G.players[p].faction).length;
    for(let i=0;i<myFact&&G.players[opp].hand.length>0;i++) {
      const ri2=Math.floor(rng()*G.players[opp].hand.length);
      const disc3=G.players[opp].hand.splice(ri2,1)[0];
      G.players[opp].graveyard.push(disc3);
      addLog(`${c.n} — ${disc3.n} défaussé!`,'event');
    }
  };
GOD_EFFECTS["fd_draw3_no_dmg"] = (ctx) => { const {c,p,opp,cap}=ctx;
    // Hera: face-down - handled as passive token
    const m5=newCard({...c, faceDown:true});
    G.players[p].field.push(m5);
    G.players[p].summoned.add(G.players[p].field.length-1);
    addLog(`${c.n} — Entre face caché!`,'event');
    return 'noDiscard';
  };
GOD_EFFECTS["god_equip_hurry_all"] = (ctx) => { const {c,p,opp,cap}=ctx;
    G.players[p].field.filter(x=>x&&!x.faceDown).forEach(x=>{ if(!x.cap.includes('hurry')) x.cap+=' hurry'; });
    addLog(`${c.n} — Tous vos monstres ont Rapide ce tour!`,'buff');
  };
GOD_EFFECTS["god_death_draw_cost4"] = (ctx) => { const {c,p,opp,cap}=ctx;
    G.players[p]._centeotlActive=true;
    addLog(`${c.n} — Permanent: mort alliée → pioche (coût 4 PV)!`,'event');
    G.players[p].graveyard.push(c); return 'noDiscard';
  };
GOD_EFFECTS["god_search_spell"] = (ctx) => { const {c,p,opp,cap}=ctx;
    const spell2 = G.players[p].deck.find(x=>x.type==='god'&&x.cost<=3);
    if(spell2) {
      G.players[p].deck.splice(G.players[p].deck.indexOf(spell2),1);
      G.players[p].hand.push(spell2);
      addLog(`${c.n} — ${spell2.n} trouvé!`,'event');
    }
  };
GOD_EFFECTS["god_resurrect_any_grave"] = (ctx) => { const {c,p,opp,cap}=ctx;
    const allGraves=[...G.players[1].graveyard,...G.players[2].graveyard].filter(x=>x.type==='monster');
    if(allGraves.length>0&&G.players[p].field.length<6) {
      const best2=allGraves.reduce((a,b)=>a.cost>b.cost?a:b);
      const fromP2=G.players[1].graveyard.includes(best2)?1:2;
      G.players[fromP2].graveyard.splice(G.players[fromP2].graveyard.indexOf(best2),1);
      best2.cAtk=best2.atk; best2.cDef=best2.def; best2.endureUsed=false; best2.cursed=false;
      G.players[p].field.push(best2);
      addLog(`${c.n} — ${best2.n} ressuscité depuis n'importe quelle défausse!`,'event');
    }
  };
GOD_EFFECTS["god_dmg5_all"] = (ctx) => { const {c,p,opp,cap}=ctx;
    [1,2].forEach(pl=>G.players[pl].field.filter(x=>x&&!x.faceDown).forEach(async x=>{
      x.cDef=Math.max(0,x.cDef-5);
      if(x.cDef<=0) await handleDeath(pl,x);
    }));
    addLog(`${c.n} — 5 dégâts à tous les monstres!`,'dmg');
  };
GOD_EFFECTS["god_equip_sacrifice_next"] = async (ctx) => { const {c,p,opp,cap}=ctx; await pickTarget('equip_sacrifice', p, false, c); return 'noDiscard'; };
GOD_EFFECTS["god_reveal_discard_spell"] = (ctx) => { const {c,p,opp,cap}=ctx;
    const oppSpells=G.players[opp].hand.filter(x=>x.type==='god');
    if(oppSpells.length>0) {
      const disc4=oppSpells[0];
      G.players[opp].hand.splice(G.players[opp].hand.indexOf(disc4),1);
      G.players[opp].graveyard.push(disc4);
      addLog(`${c.n} — ${disc4.n} défaussé!`,'event');
    } else { drawCard(p); addLog(`${c.n} — Pas de sort, piochez 1!`,'buff'); }
  };
GOD_EFFECTS["god_freeze_attacks"] = (ctx) => { const {c,p,opp,cap}=ctx;
    G.players[opp].field.filter(x=>x&&!x.faceDown).forEach(x=>{ x.sanded=true; });
    addLog(`${c.n} — Monstres adverses immobilisés!`,'event');
  };
GOD_EFFECTS["god_redirect_attack"] = (ctx) => { const {c,p,opp,cap}=ctx;
    addLog(`${c.n} — Attaque redirigée vers monstre adverse!`,'special');
  };

// ── Dieux temporels (3.2) — nouvelles entrées GOD_EFFECTS ──────────
GOD_EFFECTS["god_cycle_advance1"] = (ctx) => { setCyclePhase(G.cycle + 1, ctx.c.n); };
GOD_EFFECTS["god_cycle_random"] = (ctx) => {
  const cur = G.cycle % 5;
  let r = Math.floor(rng() * 5);
  if(r === cur) r = (r + 1) % 5; // « relance » = change forcément de phase
  setCyclePhase(r, ctx.c.n);
};
GOD_EFFECTS["god_cycle_freeze2"] = (ctx) => {
  G.cycleFrozen = (G.cycleFrozen||0) + 2;
  addLog(`🧊 ${ctx.c.n} — le Cycle Céleste est figé 2 tours !`,'special');
};
GOD_EFFECTS["god_cycle_prophecy"] = async (ctx) => {
  const cur = G.cycle % 5;
  const opts = [(cur+1)%5, (cur+2)%5, (cur+3)%5];
  const chosen = await pickCyclePhase(ctx.p, opts, 'Prophétie — choisissez la prochaine phase');
  setCyclePhase(chosen, ctx.c.n);
};
GOD_EFFECTS["god_cycle_choose"] = async (ctx) => {
  const cur = G.cycle % 5;
  const opts = [0,1,2,3,4].filter(o => o !== cur);
  const chosen = await pickCyclePhase(ctx.p, opts, 'Kaguya — choisissez la prochaine phase');
  setCyclePhase(chosen, ctx.c.n);
};

async function playGod(c, p) {
  addLog(`Player ${p} plays God: ${c.n}!`,'summon');
  showGodBurst(p);
  const cap = c.cap||'';
  const opp = p===1?2:1;

  if(cap.startsWith('fd_')) {
    // Face-down Greek god
    const m = newCard({...c, faceDown:true});
    G.players[p].field.push(m);
    G.players[p].summoned.add(G.players[p].field.length-1);
    addLog(`${c.n} enters Face Down`,'event');
    if(p === 1) showTuto('facedown'); // TUTO 6
    return;
  }

const __h = GOD_EFFECTS[cap];
  if(__h){ const __r = __h({c,p,opp,cap}); const __res = (__r && typeof __r.then==='function') ? await __r : __r; if(__res==='noDiscard') return; }
  G.players[p].graveyard.push(c);
}

async function playSpell(c, p) {
  addLog(`Player ${p} plays: ${c.n}!`,'summon');
  const opp=p===1?2:1;

  // Bug #2 fix: timing stack for spell counter window
  if(p===2 && G.mode==='pve') {
    G.lastPlayedSpell = c;
    G.stack = [{ type:'spell', card:c, player:p }];
    await reactionWindow(1, c);
    G.lastPlayedSpell = null;
    if(G.stack.length === 0) {
      addLog(`${c.n} was countered!`,'special');
      G.players[p].graveyard.push(c);
      G.stack = [];
      return;
    }
    G.stack = [];
  }

  // Check Apollo face-down on opponent's side
  const apolloIdx = G.players[opp].field.findIndex(m=>m&&m.faceDown&&m.cap==='fd_cancel_spell');
  if(apolloIdx>=0) {
    const apollo = G.players[opp].field[apolloIdx];
    apollo.faceDown=false;
    G.players[opp].field.splice(apolloIdx,1);
    G.players[opp].graveyard.push(apollo);
    reindexSets(G.players[opp],apolloIdx,true);
    addLog(`Apollo activates — ${c.n} cancelled!`,'special');
    G.players[p].graveyard.push(c);
    return;
  }
  await applySpellEffect(c, p);
  G.players[p].graveyard.push(c);
}

// ── Registre des effets de SORTS ([Sort] / spells) — Event 'spell' ─────
// Caps mutuellement exclusives (égalité exacte) → dispatch cumulatif
// équivalent à l'ancien else-if. async uniquement si await dans le corps.
registerEffect('spell', cap => cap==='spell_dmg4'||cap==='spell_dmg4_sand'||cap==='spell_dmg4_bewitch', async ctx => {
  const { c, p, cap } = ctx;
  await pickTarget('spell4dmg', p, false, c);
  if(cap==='spell_dmg4_sand') await pickTarget('sandup', p, false);
  if(cap==='spell_dmg4_bewitch') await pickTarget('bewitch', p, false);
});
registerEffect('spell', cap => cap==='spell_draw3', ctx => {
  const { p } = ctx;
  drawCard(p); drawCard(p); drawCard(p);
  // discard 2 (just auto-discard last 2 for AI, prompt for human)
  if(G.cp===p && G.mode==='pvp' || (G.mode==='pve'&&p===1)) {
    const P=G.players[p];
    if(P.hand.length>7) { const d=P.hand.splice(7); d.forEach(x=>P.graveyard.push(x)); }
  } else {
    const P=G.players[p]; while(P.hand.length>7){P.graveyard.push(P.hand.pop());}
  }
  addLog(`Draw 3, discard to 7`,'buff');
});
registerEffect('spell', cap => cap==='spell_cancel', ctx => {
  const { c } = ctx;
  if(G.stack && G.stack.length>0) {
    const entry=G.stack[0]; G.stack=[];
    addLog(`${c.n} — ${entry.card.n} COUNTERED!`,'special');
  } else { addLog(`${c.n} — Nothing to counter`,'special'); }
});
registerEffect('spell', cap => cap==='oracle_3', async ctx => { await showOracleModal(ctx.p); });

async function applySpellEffect(c, p) {
  // Dispatch composable des effets de sort (cf. moteur d'effets, Event 'spell').
  await runEffects('spell', { c, p, opp: p===1?2:1, cap: c.cap||'' });
}

// ── Oracle de Delphes — UI modal ─────────────────────────────
async function showOracleModal(p) {
  const P = G.players[p];
  const cards = P.deck.slice(0, 3);
  if(cards.length === 0) { addLog('Oracle — deck vide!','event'); return; }

  // AI: do nothing (keep order)
  if(aiControls(p)) {
    addLog('Oracle — IA garde l\'ordre du deck.','event');
    return;
  }

  addLog('Oracle — Choisissez l\'ordre des 3 prochaines cartes.','event');

  return new Promise(resolve => {
    let order = [...cards];

    // Create modal dynamically
    let modal = document.getElementById('oracle-modal');
    if(!modal) {
      modal = document.createElement('div');
      modal.id = 'oracle-modal';
      modal.className = 'oracle-modal';
      document.body.appendChild(modal);
    }

    const render = () => {
      modal.innerHTML = `
        <h3 style="color:#ffd700;margin:0 0 8px">🔮 Oracle de Delphes</h3>
        <p style="font-size:12px;color:#aaa;margin:0 0 12px">Réordonnez les 3 prochaines cartes (cliquez pour monter)</p>
        <div id="oracle-cards" style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
          ${order.map((card,i) => `
            <div class="oracle-card" data-idx="${i}" style="
              background:rgba(255,255,255,0.07);border:1px solid rgba(200,164,74,0.4);
              border-radius:8px;padding:8px 12px;cursor:pointer;min-width:80px;text-align:center;
              font-size:11px;color:#fff">
              <div style="font-size:18px">${card.type==='monster'?'🐉':card.type==='spell'?'✨':'⚡'}</div>
              <div style="font-weight:bold;font-size:10px;margin:4px 0">${card.n}</div>
              <div style="color:#888;font-size:9px">coût ${card.cost}</div>
              <div style="color:#aaa;margin-top:4px">
                ${i>0?'<span style="font-size:14px;cursor:pointer" data-up="'+i+'">⬆</span>':''}
                ${i<order.length-1?'<span style="font-size:14px;cursor:pointer" data-down="'+i+'">⬇</span>':''}
              </div>
            </div>
          `).join('')}
        </div>
        <button id="oracle-confirm" style="
          margin-top:16px;padding:8px 20px;background:linear-gradient(135deg,#1a472a,#2d6a4f);
          color:#ffd700;border:1px solid rgba(200,164,74,0.5);border-radius:6px;
          font-size:13px;font-weight:bold;cursor:pointer">✅ Confirmer</button>
      `;

      modal.querySelectorAll('[data-up]').forEach(btn => {
        btn.addEventListener('click', e => {
          const i = parseInt(btn.dataset.up);
          [order[i-1], order[i]] = [order[i], order[i-1]];
          render();
        });
      });
      modal.querySelectorAll('[data-down]').forEach(btn => {
        btn.addEventListener('click', e => {
          const i = parseInt(btn.dataset.down);
          [order[i], order[i+1]] = [order[i+1], order[i]];
          render();
        });
      });
      document.getElementById('oracle-confirm').addEventListener('click', () => {
        // Put ordered cards back on top of deck
        P.deck.splice(0, order.length, ...order);
        addLog(`Oracle — Ordre confirmé: ${order.map(c=>c.n).join(', ')}`, 'event');
        modal.style.display = 'none';
        resolve();
      });
    };

    modal.style.display = 'flex';
    render();
  });
}

// =====================================================
// COMBAT
// =====================================================
async function doAttack(attackerP, attackerIdx, targetP, targetIdx, isSecondStrike=false) {
  const AP = G.players[attackerP];
  const DP = G.players[targetP];
  const atk = AP.field[attackerIdx];
  if(!atk) return;

  const atkVal = atk.cAtk; // (3.1) plus de +1/+1 universel au zénith
  const hasHit = (atk.cap||'').includes('hit');
  const hasHeal = (atk.cap||'').includes('heal');
  // Capacités de combat pré-frappe composables (solo_destroy, coinflip_defense,
  // splash_adjacent). 'abort' annule l'attaque (RAIJU / SIRENES).
  if(await runCombatEffects('preStrike', { attackerP, attackerIdx, targetP, targetIdx, AP, DP, atk, cap: atk.cap||'' }) === 'abort') return;
  // token_per_dmg (YMIR): generate tokens when taking damage


  // ── Attack lunge: card visually lunges toward target ─────────────
  const _atkEl = document.querySelector(`[data-player="${attackerP}"][data-idx="${attackerIdx}"]`);
  const _tgtEl = targetIdx === 'player'
    ? document.getElementById(`p${targetP}-orb`)
    : document.querySelector(`[data-player="${targetP}"][data-idx="${targetIdx}"]`);
  if(_atkEl) await animateAttack(_atkEl, _tgtEl);

  const performStrike = async () => {
    // Blind: random target
    let finalTargetIdx = targetIdx;
    if(atk.blinded && targetIdx !== 'player') {
      const allTargets = DP.field.map((m,i)=>m&&!m.faceDown?i:null).filter(i=>i!==null);
      if(allTargets.length > 1) {
        finalTargetIdx = allTargets[Math.floor(rng()*allTargets.length)];
        atk.blinded = false;
        addLog(`${atk.n} is blind — attacks random target!`,'debuff');
      }
    }
    targetIdx = finalTargetIdx;

    if(targetIdx==='player') {
      // Direct attack
      Audio5L.sfx.attack(); Audio5L.sfx.damage();
      DP.hp -= atkVal;
      flashDamage(document.getElementById(`p${targetP}-orb`));
      addLog(`${atk.n} attacks P${targetP} directly — ${atkVal} dmg (❤${DP.hp})`,'dmg');
      // Big flash + shake on direct damage
      const hpbar = document.getElementById(`p${targetP}-hpbar`);
      if(hpbar) { hpbar.style.boxShadow='inset 0 0 20px rgba(231,76,60,0.9)'; setTimeout(()=>{hpbar.style.boxShadow='';},400); }
      const pbarEl = document.getElementById(`p${targetP}-bar`);
      if(pbarEl) { pbarEl.classList.add('direct-hit'); setTimeout(()=>pbarEl.classList.remove('direct-hit'),400); }
      screenShake(atkVal >= 8);
      const orbEl = document.getElementById(`p${targetP}-orb`);
      showFloatDmg(atkVal, orbEl, '#ff4444');
      Audio5L.sfx.damage();
      if(hasHeal) { Audio5L.sfx.heal(); AP.hp=Math.min(25,AP.hp+atkVal); addLog(`Heal — P${attackerP} +${atkVal} HP`,'heal'); showFloatHeal(atkVal, document.getElementById(`p${attackerP}-orb`)); }
    } else {
      let def = DP.field[targetIdx];
      if(!def) return;
      // Check Seth equip
      if(atk.sethEquipped) {
        def.cDef = Math.max(0,def.cDef-2);
        addLog(`Seth — ${def.n} −2 shield`,'dmg');
      }
      // Check Athena/Hephaistos face-down traps BEFORE damage
      const fdResult = checkFaceDownAthena(targetP, atk, attackerP);
      if(fdResult === 'cancel') { renderAll(); return; } // attack fully cancelled
      if(fdResult === 'redirect') {
        // Hephaistos: redirect to the new Protect blocker
        const blockerIdx = G.players[targetP].field.findIndex(
          m => m && !m.faceDown && (m.cap||'').includes('protect')
        );
        if(blockerIdx >= 0) { targetIdx = blockerIdx; def = DP.field[blockerIdx]; }
        else return; // no valid target
      }
      // Check Arthemis on YOUR side (curse target + draw)
      checkArthemisAttack(attackerP, def, targetP, targetIdx);

      const dmgToDef = atk.cursed ? 1 : atkVal; // if attacker cursed, deals 1? no - cursed = defender
      const defHP = def.cDef;
      const retVal = def.cAtk;

      // cursed defender: 1 dmg = death
      const actualDmg = def.cursed ? def.cDef : atkVal;
      def.cDef -= actualDmg;
      const retDmg = (def.cursed || def.asleep) ? 0 : retVal; // un dormeur ne riposte pas
      atk.cDef -= retDmg;

      Audio5L.sfx.attack();
      addLog(`${atk.n}(${atkVal}⚔) vs ${def.n}(${retVal}⚔/${defHP}🛡) — def:${def.cDef}🛡 atk:${atk.cDef}🛡`,'combat');

      // UX #4: shake and floating damage
      shakeCard(targetP, targetIdx);
      const defEl = document.querySelector(`[data-player="${targetP}"][data-idx="${targetIdx}"]`);
      showFloatDmg(actualDmg, defEl, '#e74c3c');
      const atkEl2 = document.querySelector(`[data-player="${attackerP}"][data-idx="${attackerIdx}"]`);
      if(retDmg > 0) showFloatDmg(retDmg, atkEl2, '#e74c3c');

      if(hasHeal) { Audio5L.sfx.heal(); AP.hp=Math.min(25,AP.hp+actualDmg); addLog(`Heal — P${attackerP} +${actualDmg} HP`,'heal'); }
      // token_per_dmg (YMIR): N tokens per damage received
      if((atk.cap||'').includes('token_per_dmg') && retDmg>0) {
        for(let t=0;t<retDmg&&AP.field.length<6;t++) {
          const yTok=newCard({id:'ICE_TOKEN',n:'Glace 1/1',atk:1,def:1,cost:0,type:'monster',cap:'',txt:'',rarity:'common',faction:AP.faction});
          yTok.cAtk=1; yTok.cDef=1; AP.field.push(yTok);
        }
        addLog(`${atk.n} — ${retDmg} jetons Glace!`,'event');
      }
      if(atk.izanamiEquipped && targetIdx!=='player') {
        // Send target back to owner's hand
        const defIdx = DP.field.indexOf(def);
        if(defIdx >= 0 && def.cDef > 0) {
          DP.field.splice(defIdx, 1);
          DP.hand.push(def);
          reindexSets(DP, defIdx, true);
          addLog(`Izanami — ${def.n} sent back to hand!`,'event');
        }
      }

      if(def.cDef <= 0) await handleDeath(targetP, def);
      if(atk.cDef <= 0) await handleDeath(attackerP, atk);
    }
  };

  await performStrike();
  const stillAlive = AP.field.includes(atk);

  // Bug #6 fix: Hit double works for both AI and P1 human
  if(hasHit && stillAlive && !isSecondStrike) {
    addLog(`${atk.n} — HIT: attacks again!`,'event');
    renderAll();
    await new Promise(r=>setTimeout(r,300));
    const newAtkIdx = AP.field.indexOf(atk);
    if(newAtkIdx>=0) {
      if(aiControls(attackerP)) {
        const newTarget = pickAITarget(targetP, attackerP);
        if(newTarget!==null) await doAttack(attackerP, newAtkIdx, targetP, newTarget, true);
      } else if(attackerP===1) {
        // Open targeting for P1's second hit via promise
        await new Promise(resolve => {
          window._hitStrikeResolve = resolve;
          G.selAtk = {p:1, i:newAtkIdx};
          startAttackTargeting(atk, 1, newAtkIdx);
        });
      }
    }
  }


  // ── combat_dmg2 (DJINN): extra 2 dmg to target
  if((atk.cap||'').includes('combat_dmg2') && typeof targetIdx === 'number' && AP.field.includes(atk)) {
    const defT = DP.field[targetIdx];
    if(defT && defT.cDef > 0) {
      defT.cDef = Math.max(0, defT.cDef - 2);
      addLog(`${atk.n} — Combat +2 dégâts!`,'dmg');
      if(defT.cDef<=0) await handleDeath(targetP, defT);
    }
  }
  // ── attack_draw (NINGYO): draw 1 after combat
  if((atk.cap||'').includes('attack_draw') && AP.field.includes(atk)) {
    drawCard(attackerP); addLog(`${atk.n} — Draw 1!`,'buff');
  }
  // ── copy_on_attack (LADON): copy the attacked monster (without cap)
  if((atk.cap||'').includes('copy_on_attack') && AP.field.includes(atk) && typeof targetIdx==='number') {
    const copied = DP.field[targetIdx];
    if(copied && AP.field.length<6) {
      const cpL = newCard({...copied, cap:'', txt:'(copie Ladon)'});
      cpL.cAtk=copied.atk; cpL.cDef=copied.def;
      AP.field.push(cpL);
      addLog(`${atk.n} — Copie ${copied.n}!`,'event');
    }
  }

  const finalIdx = AP.field.indexOf(atk);
  if(finalIdx >= 0) AP.attacked.add(finalIdx);
  G.selAtk=null;
  renderAll();
  checkVictory();
}

function checkArthemisAttack(attackerP, target, targetP, targetIdx) {
  // Arthemis: Face Down on YOUR side — when YOU attack, curse 1 monster + draw
  const P = G.players[attackerP];
  for(let i=P.field.length-1;i>=0;i--) {
    const m = P.field[i];
    if(!m||!m.faceDown||m.type!=='god'||m.cap!=='fd_curse_draw') continue;
    m.faceDown=false;
    if(target) { target.cursed=true; addLog(`Arthemis activates — ${target.n} CURSED!`,'special'); }
    drawCard(attackerP);
    addLog(`Arthemis — Draw 1`,'buff');
    P.field.splice(i,1); P.graveyard.push(m);
    reindexSets(P,i,true);
    break;
  }
}

function checkFaceDownAthena(p, attacker, attackerP) {
  const P = G.players[p];
  for(let i = P.field.length-1; i >= 0; i--) {
    const m = P.field[i];
    if(!m || !m.faceDown || m.type !== 'god') continue;

    if(m.cap === 'fd_destroy_attacker') {
      m.faceDown = false;
      const ai = G.players[attackerP].field.indexOf(attacker);
      if(ai >= 0) {
        G.players[attackerP].field.splice(ai, 1);
        G.players[attackerP].graveyard.push(attacker);
        reindexSets(G.players[attackerP], ai, true);
        Audio5L.sfx.death();
        addLog(`⚡ ${m.n} (Athena) activates — ${attacker.n} DESTROYED! Attack cancelled.`, 'special');
      }
      P.field.splice(i, 1); P.graveyard.push(m);
      reindexSets(P, i, true);
      renderAll();
      return 'cancel';  // ← attack fully cancelled, skip damage
    }

    if(m.cap === 'fd_blocker') {
      m.faceDown = false;
      addLog(`🛡 ${m.n} (Hephaistos) activates — 2/3 Protect blocker created!`, 'special');
      if(P.field.length < 6) {
        P.field.push({
          id:'BLK', n:'Blocker', atk:2, def:3, cost:0,
          type:'monster', cap:'protect', txt:'Protect',
          cAtk:2, cDef:3, faction:P.faction,
          cursed:false, asleep:false, sanded:false,
          bewitched:false, blinded:false, endureUsed:false, faceDown:false
        });
      }
      P.field.splice(i, 1); P.graveyard.push(m);
      reindexSets(P, i, true);
      renderAll();
      return 'redirect'; // ← caller should retarget to the new blocker
    }
  }
  return null;
}

// =====================================================
// PICK TARGET (human interaction)
// =====================================================
async function pickTarget(type, p, isEntry, card=null) {
  const opp=p===1?2:1;
  // If AI controls this player (pve P2, or sim both), auto-pick
  if(aiControls(p)) {
    return aiPickTarget(type, p, card);
  }
  // Human: show modal
  return new Promise(resolve => {
    pendingAction = {type, p, opp, card, resolve};
    showTargetModal(type, p, opp);
  });
}

// =====================================================
// VICTORY CHECK
// =====================================================
function checkVictory() {
  for(let p=1;p<=2;p++) {
    if(G.players[p].hp<=0) {
      const w=p===1?2:1;
      // ARENA (4.2) : le résultat alimente la run, pas l'écran de victoire normal.
      if(ARENA) { arenaOnDuelEnd(w); return; }
      if(w===1) Audio5L.sfx.victory(); else Audio5L.sfx.defeat();
      const localWin = (G.mode==='pve') ? (w===1) : true; // en PvP, le gagnant est "victorieux"
      const titleEl=document.getElementById('vic-title');
      titleEl.textContent = (G.mode==='pve')
        ? (w===1 ? 'VICTOIRE' : 'DÉFAITE')
        : `JOUEUR ${w} — VICTOIRE`;
      titleEl.classList.toggle('defeat', G.mode==='pve' && w===2);
      document.getElementById('vic-sub').textContent=`${(G.players[w].faction||'').toUpperCase()} triomphe au tour ${G.turn}`;
      document.getElementById('victory').style.display='flex';
    }
  }
}

// =====================================================
// AI SYSTEM
// =====================================================
// Let human player respond with anytime/instant cards
/**
 * Pause le tour de l'IA et attend que le joueur appuie sur ESPACE ou OK.
 * Pendant ce temps, le joueur peut jouer des cartes Anytime.
 */
async function waitForPlayerAck(triggerCard, context) {
  if(G.mode==='sim') return; // headless IA-vs-IA: aucune attente d'input humain
  const P1 = G.players[1];
  const hasReactable = P1.hand.some(c => isAnytime(c) && P1.gems >= c.cost);

  G.waitingForPlayer = true;
  G.cp = 1;
  G.inReaction = true;
  G.reactionDone = false;

  showReactionBanner(triggerCard, context, hasReactable);
  renderAll();

  await new Promise(resolve => {
    window._resolveReaction = resolve;
  });

  G.waitingForPlayer = false;
  G.inReaction = false;
  G.reactionDone = true;
  G.cp = 2;
  hideReactionBanner();
  window._resolveReaction = null;
  renderAll();
}

// Alias de compatibilité pour les appels existants dans playMonster/playSpell
async function reactionWindow(humanP, triggerCard) {
  await waitForPlayerAck(triggerCard, 'play');
}

function showReactionBanner(triggerCard, context, hasReactable) {
  const banner = document.getElementById('reaction-banner');
  if (!banner) return;
  const icons  = { play:'🃏', attack:'⚔️', spell:'✨' };
  const titles = { play:"L'IA JOUE UNE CARTE", attack:"L'IA ATTAQUE", spell:"L'IA LANCE UN SORT" };
  const iconEl  = document.getElementById('reaction-icon');
  const titleEl = document.getElementById('reaction-title');
  const subEl   = document.getElementById('reaction-sub');
  const nameEl  = document.getElementById('reaction-card-name');
  if(iconEl)  iconEl.textContent  = icons[context]  || '⚡';
  if(titleEl) titleEl.textContent = titles[context] || 'TOUR ADVERSAIRE';
  if(nameEl)  nameEl.textContent  = triggerCard ? triggerCard.n : '';
  if(subEl)   subEl.textContent   = hasReactable
    ? '⚡ Tu as des cartes rapides ! Joue-en une ou appuie ESPACE pour continuer'
    : 'Appuie sur ESPACE ou clique OK pour continuer';
  banner.style.background = hasReactable
    ? 'linear-gradient(135deg, rgba(231,76,60,0.95), rgba(192,57,43,0.95))'
    : 'linear-gradient(135deg, rgba(243,156,18,0.95), rgba(230,126,34,0.95))';
  banner.style.display = 'flex';
  showTuto('anytime'); // TUTO 7 : première fenêtre de réaction
}

function hideReactionBanner() {
  const banner = document.getElementById('reaction-banner');
  if (banner) banner.style.display = 'none';
}

function resolveReaction() {
  if (window._resolveReaction) window._resolveReaction();
}

async function aiTurn(p=2) {
  if(!G||G.cp!==p||aiThinking) return;
  aiThinking=true;

  addLog(`── AI thinking... ──`,'phase');
  renderAll();

  // Main1 phase
  G.phase='Main1';
  handlePhaseStart(p);
  renderAll();
  await delay(300);

  await aiMainPhase(p);

  // Combat phase
  G.phase='Combat';
  renderAll();
  Audio5L.combatMode();
  await delay(300);
  await aiCombatPhase(p);

  // Main2 phase
  G.phase='Main2';
  handlePhaseStart(p);
  Audio5L.menuMode();
  renderAll();
  await delay(200);

  await aiMainPhase(p);

  // End phase
  G.phase='End';
  renderAll();
  await delay(300);

  aiThinking=false;
  doEndTurn();
}

async function aiMainPhase(p=2) {
  const P = G.players[p];
  // ZÉNITH GREC (3.1) : l'IA déclenche manuellement ses dieux face cachée
  // (toujours rentable : l'effet est immédiat et la carte est déjà payée).
  if(canManualTriggerFD(p)) {
    for(let i=P.field.length-1; i>=0; i--) {
      const fd = P.field[i];
      if(fd && fd.faceDown && fd.type==='god' && !fd.asleep) await manualTriggerFaceDown(p, i);
    }
  }
  let played = true;

  let safety = 0;
  while (played && safety < 12) {
    safety++;
    played = false;
    const playable = P.hand
      .map((c, i) => ({ c, i, score: scoreCard(c, p) }))
      .filter(x => x.c.cost <= P.gems)
      .sort((a, b) => b.score - a.score);

    if (playable.length > 0 && P.gems > 0) {
      const best = playable[0];
      addLog(`AI joue : ${best.c.n}`, 'summon');
      P.gems -= best.c.cost;
      P.hand.splice(best.i, 1);

      if (best.c.type === 'monster')      await playMonster(best.c, p);
      else if (best.c.type === 'god')     await playGod(best.c, p);
      else                                await playSpell(best.c, p);

      renderAll();

      // Pause obligatoire : joueur doit appuyer ESPACE pour continuer
      const context = best.c.type === 'spell' ? 'spell' : 'play';
      await waitForPlayerAck(best.c, context);

      renderAll();
      played = true;
    }
  }
}

function scoreCard(c, p) {
  const opp    = p === 1 ? 2 : 1;
  const P      = G.players[p];
  const OP     = G.players[opp];
  const myField  = P.field.filter(m => m && !m.faceDown);
  const oppField = OP.field.filter(m => m && !m.faceDown && !m.asleep);
  const myHP     = P.hp;
  const oppHP    = OP.hp;
  const board    = myField.length - oppField.length; // positive = I'm ahead
  const losing   = myHP < oppHP - 5;
  const winning  = myHP > oppHP + 5;
  const urgency  = myHP <= 8 ? 1.8 : (myHP <= 15 ? 1.3 : 1.0);
  const lethalPressure = oppHP <= 6 ? 2.0 : (oppHP <= 12 ? 1.3 : 1.0);
  const cap      = c.cap || '';

  if(c.type === 'monster') {
    let score = c.atk * 1.6 + c.def * 0.9;

    // Keywords
    if(cap.includes('hurry'))   score += 5;               // tempo = most valuable
    if(cap.includes('hit'))     score += c.atk * 0.9;     // double attack is huge
    if(cap.includes('heal'))    score += (myHP < 20 ? 4 : 1.5);
    if(cap.includes('endure'))  score += 3.5;
    if(cap.includes('protect')) score += (oppField.length > 1 ? 3.5 : 1.5);

    // Entry effects (only valuable if targets exist)
    if(cap.includes('entry_sleep')   && oppField.length > 0) score += 6;
    if(cap.includes('entry_curse2')  && oppField.length > 1) score += 7;
    if(cap.includes('entry_curse2')  && oppField.length === 1) score += 4;
    if(cap.includes('entry_dmg3'))   score += (oppField.length > 0 ? 5 : (oppHP <= 3 ? 8 : 2));
    if(cap.includes('entry_blind')   && oppField.length > 0) score += 3;
    if(cap.includes('entry_buff11')  && myField.length > 0)  score += myField.length * 1.8;
    if(cap.includes('entry_buff_atk')&& myField.length > 0)  score += myField.length * 1.2;
    if(cap.includes('entry_shield_all') && myField.length > 0) score += myField.length;
    if(cap.includes('entry_cancel')  && oppField.length > 0) score += 5;
    if(cap.includes('entry_draw'))   score += 2.5;

    // Cartes temporelles (3.2) : valeur selon la distance à notre zénith
    if(cap.includes('cycle_')) {
      const myZen = FACTION_PHASE_IDX[P.faction];
      const cur = G.cycle % 5;
      const dist = ((myZen - cur) % 5 + 5) % 5; // 0 = on y est
      if(cap.includes('advance1'))  score += (dist === 1 ? 7 : dist === 2 ? 3 : 1);
      if(cap.includes('delay1'))    score += (dist === 4 ? 7 : (cur === FACTION_PHASE_IDX[OP.faction] ? 4 : 1));
      if(cap.includes('freeze'))    score += (dist === 0 ? 8 : 1);
      if(cap.includes('prophecy') || cap.includes('choose')) score += (dist >= 1 && dist <= 3 ? 7 : 3);
      if(cap.includes('random'))    score += (cur === FACTION_PHASE_IDX[OP.faction] ? 4 : 1);
    }

    // Exit effects: more valuable when field is already contested
    if(cap.includes('exit_destroy') && oppField.length > 0) score += 4;
    if(cap.includes('exit_curse')   && oppField.length > 0) score += 3;
  // New ability caps from xlsx
  if(cap.includes('attack_draw')||cap.includes('draw_on_attack'))   score += 3;
  if(cap.includes('passive_yokai_buff')||cap.includes('passive_buff11_faction') && myField.length > 0) score += myField.length * 2;
  if(cap.includes('exit_copy_killer')||cap.includes('exit_copy_token'))  score += 2;
  if(cap.includes('solo_destroy') && myField.filter(m=>m).length === 0) score += 8;
  if(cap.includes('passive_adj_buff') && myField.length > 0) score += myField.length * 1.5;
  if(cap.includes('combat_recycle_dmg2') && oppField.length > 0) score += 3;
  if(cap.includes('start_draw'))       score += 3;
  if(cap.includes('splash_adj'))       score += 4;
  if(cap.includes('token_per_dmg')||cap.includes('token_on_dmg'))     score += 3;
  if(cap.includes('entry_wipe')||cap.includes('entry_boardwipe_noatk')) score += 8;
  if(cap.includes('start_tokens2')||cap.includes('start_token_capped')) score += 4;
  if(cap.includes('recycle_return'))   score += 2;
  if(cap.includes('hurry_entry_revive')||cap.includes('hurry entry_resurrect3')) score += 5;
  if(cap.includes('temp_steal_hurry')||cap.includes('steal_hurry') && oppField.length > 0) score += 7;
  if(cap.includes('token_copies_graveyard')||cap.includes('entry_tokens_graveyard')) score += 4;
  if(cap.includes('end_heal_ally') && myField.length > 0) score += 3;
  if(cap.includes('combat_dmg2') && oppField.length > 0) score += 4;
  if(cap.includes('exit_self_sleep_return')) score += 2;
  if(cap.includes('endure_cooldown')||cap.includes('alt_attack'))       score += 2;
  if(cap.includes('entry_draw_per_ally') && myField.length > 0) score += myField.length * 2.5;
  if(cap.includes('esquive'))          score += 3; // esquive déterministe = vraie valeur défensive
  if(cap.includes('start_filter'))     score += 2;
  if(cap.includes('passive_entry_buff11') && myField.length > 0) score += myField.length * 2;
  if(cap.includes('entry_copy_any'))   score += 4;
  if(cap.includes('entry_draw_per_greek')||cap.includes('entry_pioche_grec') && myField.length > 0) score += 3;
  if(cap.includes('entry_reclaim')||cap.includes('entry_recover_grave')) score += 3;
  if(cap.includes('copy_on_attack')||cap.includes('copy_on_kill') && oppField.length > 0) score += 5;
  if((cap.includes('entry_token_per_greek')||cap.includes('entry_tokens_grec')) && myField.length > 0) score += myField.length * 3;
  if(cap.includes('start_coinflip_destroy')||cap.includes('coinflip_atk5'))    score += 4;
  if(cap.includes('oracle_dmg3')||cap.includes('scrye_dmg3_cond'))  score += 3;
  if(cap.includes('reveal_play_free')||cap.includes('challenge_free'))   score += 3;
  if((cap.includes('copy_ally_def')||cap.includes('copy_ally_def')||cap.includes('entry_copy_def')) && myField.length > 0) score += 3;
  if(cap.includes('death_token22')||cap.includes('token22_on_death') && myField.length > 1) score += 5;
  if(cap.includes('passive_empty_hand_buff')||cap.includes('catchup_empty_hand') && P.hand.length === 0) score += 8;
  if(cap.includes('passive_all_hurry')||cap.includes('global_hurry'))     score += 8;
  if(cap.includes('entry_destroy_catchup') && P.hp <= OP.hp) score += 10;
  if(cap.includes('entry_token_copies_2')||cap.includes('entry_2copy_tokens') && myField.length >= 2) score += 6;

    // Don't flood the field unnecessarily
    if(P.field.length >= 5) score -= 10;
    if(P.field.length >= 4 && board > 2 && winning) score -= 4;

    // Prefer spending gems efficiently (don't hoard)
    if(c.cost >= P.gems * 0.7) score += 1.5;

    return score * urgency * lethalPressure;
  }

  if(c.type === 'god') {
    const fdCount = P.field.filter(m => m && m.faceDown).length;

    // Face-down traps
    if(cap.startsWith('fd_')) {
      if(fdCount >= 2) return -1;    // don't stack traps uselessly
      if(oppField.length === 0 && cap === 'fd_cancel_monster') return 8; // always good
      if(cap === 'fd_destroy_attacker') return 7;
      if(cap === 'fd_blocker')          return 6;
      if(cap === 'fd_cancel_monster')   return 7;
      return 5;
    }

    let score = 3;
    const oppMaxAtk  = oppField.length > 0 ? Math.max(...oppField.map(m=>m.cAtk)) : 0;
    const myMaxAtk   = myField.length  > 0 ? Math.max(...myField.map(m=>m.cAtk))  : 0;

    if(cap.includes('destroy') || cap.includes('thor') || cap.includes('cancel')) {
      score += oppField.length > 0 ? 4 + oppMaxAtk * 0.4 : 0;
    }
    if(cap.includes('minus4_all')) {
      score += oppField.length > myField.length ? 9 : (oppField.length > 0 ? 5 : 0);
    }
    if(cap.includes('steal') && oppField.length > 0) {
      score += 5 + oppMaxAtk * 0.6;
    }
    if(cap.includes('sleep') && oppField.length > 0)  score += 6;
    if(cap.includes('buff3') && myField.length > 0)   score += 4 + myMaxAtk * 0.4;
    if(cap.includes('minus3') || cap.includes('minus2')) {
      score += oppField.length > 0 ? 5 : -3;
    }
    if(cap.includes('blind_draw') && oppField.length > 0) score += 4;
    if(cap.includes('balder') && myField.length > 1)   score += 4;
    if(cap.includes('osiris') && P.field.length <= 2)  score += 7;
    if(cap.includes('odin'))  score += (board < -1 ? 7 : 2);
    if(cap.includes('create2') && P.field.length <= 3) score += 4;
    if(cap.includes('resurrect')) {
      const hasDead = P.graveyard.some(c => c.type === 'monster');
      score += hasDead ? 7 : -5;
    }
    if(cap.includes('mutual_sacrifice')) {
      const myLive = P.field.filter(m=>m&&!m.faceDown).length;
      // Don't sacrifice own creature when we'd lose more than we gain
      if(myLive === 0) score = -10; // suicide, never
      else if(myLive <= 1 && oppField.length <= 1) score = 0; // even trade on tiny board
      else score += oppField.length > myLive ? 7 : (oppField.length === myLive ? 3 : 0);
    }
    if(cap.includes('cancel_attack')) score += 4;
    // Dieux temporels (3.2)
    if(cap.includes('cycle_')) {
      const myZen = FACTION_PHASE_IDX[P.faction];
      const cur = G.cycle % 5;
      const dist = ((myZen - cur) % 5 + 5) % 5;
      if(cap.includes('advance1'))  score += (dist === 1 ? 8 : dist === 2 ? 4 : 0);
      if(cap.includes('random'))    score += (cur === FACTION_PHASE_IDX[OP.faction] ? 5 : 0);
      if(cap.includes('freeze'))    score += (dist === 0 ? 9 : 0);
      if(cap.includes('prophecy') || cap.includes('choose')) score += (dist >= 1 && dist <= 3 ? 8 : 2);
    }

    // General: gods with no valid targets are worthless
    const needsTarget = ['minus','destroy','steal','sleep','buff','blank','blind','force','thor'];
    const hasTarget = oppField.length > 0 || myField.length > 0;
    if(!hasTarget && needsTarget.some(k => cap.includes(k))) score = Math.max(score - 4, 0);

    return score * urgency;
  }

  // Spell
  let score = 3;
  if(cap.includes('dmg4')) {
    if(oppField.length > 0) score += 4;
    if(oppHP <= 4)           score += 10; // direct lethal
    if(oppHP <= 8)           score += 3;
  }
  if(cap.includes('cancel') && oppField.length > 0) score += 5;
  if(cap.includes('draw3'))   score += P.hand.length < 3 ? 5 : 2;

  return score * urgency;
}

async function aiCombatPhase(p=2) {
  const P   = G.players[p];
  const opp = p===1?2:1;
  const OP  = G.players[opp];

  // Build list of monsters that can attack this phase
  const getAttackers = () => P.field
    .map((m,i) => ({m,i}))
    .filter(({m,i}) =>
      m && !m.faceDown && !m.asleep && !m.sanded &&
      !P.attacked.has(i) &&
      (!P.summoned.has(i) || (m.cap||'').includes('hurry'))
    );

  // ── PRE-COMBAT LETHAL CHECK ──────────────────────────────────────
  const attackers = getAttackers();
  const oppHasProtect = OP.field.some(m => m && effProtect(m, opp) && !m.asleep);
  const totalAtk = attackers.reduce((s,{m}) => s + (m.cAtk||0), 0);

  if(!oppHasProtect && totalAtk >= OP.hp) {
    addLog('🎯 AI détecte une victoire — tout en face !', 'special');
    for(const {m,i} of attackers) {
      if(!G.players[p].field[i]) continue;
      addLog(`${m.n} attaque le joueur directement !`, 'dmg');
      renderAll();
      await waitForPlayerAck(m, 'attack');
      if(!G.players[p].field[i]) continue;
      await doAttack(p, i, opp, 'player');
      renderAll();
      await new Promise(r => setTimeout(r, 350));
      if(checkVictoryBool()) return;
    }
    return;
  }

  // ── ANTI-STALL: opponent has no monsters → all attackers go face ─
  const oppAlive = OP.field.filter(m => m && !m.faceDown && !m.asleep && !m.sanded);
  if(oppAlive.length === 0) {
    for(const {m,i} of getAttackers()) {
      if(!G.players[p].field[i]) continue;
      addLog(`${m.n} attaque directement (terrain adverse vide) !`, 'dmg');
      renderAll();
      await waitForPlayerAck(m, 'attack');
      if(!G.players[p].field[i]) continue;
      await doAttack(p, i, opp, 'player');
      renderAll();
      await new Promise(r => setTimeout(r, 350));
      if(checkVictoryBool()) return;
    }
    return;
  }

  // ── NORMAL COMBAT: strongest attackers first ────────────────────
  // Sort: Hurry/high-atk first, then others
  const sorted = getAttackers().sort((a,b) => {
    const aScore = (a.m.cAtk||0) + ((a.m.cap||'').includes('hurry') ? 5 : 0);
    const bScore = (b.m.cAtk||0) + ((b.m.cap||'').includes('hurry') ? 5 : 0);
    return bScore - aScore;
  });

  for(const {m,i} of sorted) {
    if(!G.players[p].field[i]) continue;
    if(G.players[p].attacked.has(i)) continue;

    const target = pickAITarget(opp, p);
    if(target === null) break;

    addLog(`${m.n} se prépare à attaquer...`, 'combat');
    renderAll();

    await waitForPlayerAck(m, 'attack');
    // FIX 1.1 : 'G.players[2]' codé en dur faisait sauter les attaques de P1
    // (en sim) dès que le board adverse n'avait pas de monstre au même index.
    if(!G.players[p].field[i]) continue;

    await doAttack(p, i, opp, target);
    renderAll();
    await new Promise(r => setTimeout(r, 450));

    if(checkVictoryBool()) break;
  }
}

function pickAITarget(targetP, attackerP=2) {
  const TP = G.players[targetP];
  const AP = G.players[attackerP];

  // Monsters that haven't attacked yet
  const myAttackers = AP.field
    .map((m,i) => ({m,i}))
    .filter(({m,i}) => m && !m.faceDown && !m.asleep && !m.sanded && !AP.attacked.has(i));

  const alive = TP.field.map((m,i)=>({m,i})).filter(x => x.m && (!x.m.faceDown || (x.m.asleep && canTargetSleeping(attackerP))));
  const hasProtect = alive.some(x => effProtect(x.m, targetP));

  // ── LETHAL CHECK: can remaining attackers kill the player? ──────
  const totalRemainingAtk = myAttackers.reduce((s,{m}) => s + (m.cAtk||0), 0);
  if(!hasProtect && totalRemainingAtk >= TP.hp) {
    addLog('🎯 AI vise le coup fatal !', 'special');
    return 'player';
  }

  // ── Must attack Protect first ───────────────────────────────────
  if(hasProtect) {
    const prot = alive.find(x => effProtect(x.m, targetP));
    return prot ? prot.i : (alive.length ? alive[0].i : 'player');
  }

  if(alive.length === 0) return 'player';

  // Get current attacker's stats
  const cur = AP.field.find((m,i) => m && !m.faceDown && !m.asleep && !m.sanded && !AP.attacked.has(i));
  const myAtk = cur?.cAtk || 0;
  const myDef = cur?.cDef || 0;

  // ── CLEAN KILLS: kill target without losing our monster ─────────
  const cleanKills = alive.filter(x =>
    x.m.cDef <= myAtk &&      // we kill it
    x.m.cAtk < myDef          // we survive (it can't kill us back)
  );
  if(cleanKills.length > 0) {
    // Kill most dangerous target first
    cleanKills.sort((a,b) => (b.m.cAtk + b.m.cDef) - (a.m.cAtk + a.m.cDef));
    return cleanKills[0].i;
  }

  // ── TRADE UP: kill stronger enemy even if we die ────────────────
  if(myAtk >= 4) {  // only worth trading if our attacker is decent
    const tradeUp = alive.filter(x =>
      x.m.cDef <= myAtk &&
      x.m.cAtk >= myAtk  // target is at least as strong
    );
    if(tradeUp.length > 0) {
      tradeUp.sort((a,b) => b.m.cAtk - a.m.cAtk);
      return tradeUp[0].i;
    }
  }

  // ── CHIP DAMAGE: go face if nothing good to kill ────────────────
  if(myAtk >= 4 && TP.hp <= 15) return 'player';

  // ── LAST RESORT: weakest shield ─────────────────────────────────
  alive.sort((a,b) => a.m.cDef - b.m.cDef);
  return alive[0].i;
}

function aiPickTarget(type, p, card) {
  const opp=p===1?2:1;
  // Simple AI target picks
  const oppField=G.players[opp].field.filter(m=>m&&!m.faceDown);
  const ownField=G.players[p].field.filter(m=>m&&!m.faceDown);

  if(type==='sleep'||type==='blank11'||type==='destroy'||type==='curse'||type==='minus3'||type==='minus2') {
    if(oppField.length>0) {
      // target highest atk
      const best=oppField.reduce((a,b)=>a.cAtk>b.cAtk?a:b);
      const idx=G.players[opp].field.indexOf(best);
      applyTargetEffect(type,opp,idx,card);
    }
  } else if(type==='blind') {
    if(oppField.length>0) {
      const best=oppField[0];
      const idx=G.players[opp].field.indexOf(best);
      applyTargetEffect(type,opp,idx,card);
    }
  } else if(type==='buff3'||type==='equip_seth'||type==='equip_return') {
    if(ownField.length>0) {
      const best=ownField.reduce((a,b)=>a.cAtk>b.cAtk?a:b);
      const idx=G.players[p].field.indexOf(best);
      applyTargetEffect(type,p,idx,card);
    }
  } else if(type==='spell4dmg') {
    if(oppField.length>0) {
      const best=oppField.reduce((a,b)=>a.cDef<b.cDef?a:b);
      const idx=G.players[opp].field.indexOf(best);
      applyTargetEffect(type,opp,idx,card);
    } else {
      G.players[opp].hp-=4;
      addLog(`Spell — P${opp} takes 4 direct dmg (❤${G.players[opp].hp})`,'dmg');
    }
  } else if(type==='steal') {
    if(oppField.length>0) {
      const best=oppField.reduce((a,b)=>a.cAtk>b.cAtk?a:b);
      const idx=G.players[opp].field.indexOf(best);
      applyTargetEffect(type,opp,idx,card);
    }
  } else if(type==='copy') {
    const all=[...G.players[1].field,...G.players[2].field].filter(m=>m&&!m.faceDown);
    if(all.length>0) {
      const best=all.reduce((a,b)=>a.cAtk>b.cAtk?a:b);
      const fromP=G.players[1].field.includes(best)?1:2;
      const idx=G.players[fromP].field.indexOf(best);
      applyTargetEffect(type,fromP,idx,card);
    }
  } else if(type==='swap') {
    if(ownField.length>0&&oppField.length>0) {
      const myWorst=ownField.reduce((a,b)=>a.cAtk<b.cAtk?a:b);
      const theirBest=oppField.reduce((a,b)=>a.cAtk>b.cAtk?a:b);
      const mi=G.players[p].field.indexOf(myWorst);
      const oi=G.players[opp].field.indexOf(theirBest);
      G.players[p].field.splice(mi,1,theirBest);
      G.players[opp].field.splice(oi,1,myWorst);
      addLog(`Loki — swaps ${myWorst.n} ↔ ${theirBest.n}`,'event');
    }
  } else if(type==='force_attack') {
    if(oppField.length>=2) {
      const sorted=[...oppField].sort((a,b)=>b.cAtk-a.cAtk);
      const attacker=sorted[0], victim=sorted[sorted.length-1];
      const dmg=attacker.cAtk;
      victim.cDef=Math.max(0,victim.cDef-dmg);
      addLog(`${card.n} — ${attacker.n} forced to attack ${victim.n} (${dmg} dmg)`,'event');
      if(victim.cDef<=0) handleDeath(opp, victim);
    }
  } else if(type==='redirect') {
    // just log it
    addLog(`${card?.n||'God'} — redirect effect (complex, skipped in AI)`,'special');
  }
}

function checkVictoryBool() {
  return G.players[1].hp<=0 || G.players[2].hp<=0;
}

function delay(ms) { return new Promise(r=>setTimeout(r,ms)); }

// UX #4: Floating damage text
function showFloatDmg(amount, targetEl, color='#e74c3c') {
  if(!targetEl) return;
  const r = targetEl.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'float-dmg';
  el.textContent = '-' + amount;
  el.style.color = color;
  el.style.left = (r.left + r.width/2 - 15) + 'px';
  el.style.top = (r.top + r.height/2 - 15) + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

// Soin flottant +X vert (damageFloatAnim variante heal)
function showFloatHeal(amount, targetEl) {
  if(!targetEl) return;
  const r = targetEl.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'float-dmg float-heal';
  el.textContent = '+' + amount;
  el.style.left = (r.left + r.width/2 - 15) + 'px';
  el.style.top = (r.top + r.height/2 - 15) + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

// Secousse d'écran (shakeScreenAnim) — gros coup
function screenShake(big) {
  const g = document.getElementById('game');
  if(!g) return;
  g.classList.remove('screen-shake','screen-shake-big');
  void g.offsetHeight;
  g.classList.add(big ? 'screen-shake-big' : 'screen-shake');
  setTimeout(() => g.classList.remove('screen-shake','screen-shake-big'), big ? 500 : 350);
}

// UX #4: Shake animation on a field card element
function shakeCard(p, idx) {
  const el = document.querySelector(`[data-player="${p}"][data-idx="${idx}"]`);
  if(!el) return;
  el.classList.remove('shaking');
  el.offsetHeight;
  el.classList.add('shaking');
  setTimeout(() => el.classList.remove('shaking'), 400);
}

// =====================================================
// CARD PREVIEW SYSTEM
// =====================================================
// ── ABILITY GLOSSARY ──────────────────────────────────────────────────────
const ABILITY_GLOSSARY = {
  hurry:       {icon:"⚡", name:"Hurry",       desc:"Can attack the same turn it enters the field"},
  protect:     {icon:"🛡", name:"Protect",     desc:"Opponent must attack this monster before any other target"},
  hit:         {icon:"🎯", name:"Hit",         desc:"Can attack twice per combat phase"},
  heal:        {icon:"💚", name:"Heal",        desc:"Every damage this monster deals restores your HP"},
  endure:      {icon:"🔥", name:"Endure",      desc:"When it dies, returns with 1 shield and loses all abilities"},
  entry:       {icon:"✨", name:"Entry",       desc:"Triggered when this monster enters the field"},
  exit:        {icon:"💀", name:"Exit",        desc:"Triggered when this monster is destroyed or dies"},
  anytime:     {icon:"⚡", name:"Anytime",     desc:"Can be played at any time, even during the opponent turn"},
  face_down:   {icon:"🂠", name:"Face Down",   desc:"Enters the field hidden — flips when trigger condition is met"},
  sand:        {icon:"⏳", name:"Immobilisé",  desc:"Ne peut pas attaquer au prochain tour"},
  sleep:       {icon:"💤", name:"Sleep",       desc:"Face down and untouchable — wakes up 2 opponent turns later"},
  curse:       {icon:"💀", name:"Cursed",      desc:"Only 1 damage is enough to destroy this monster"},
  esquive:     {icon:"💨", name:"Esquive",     desc:"La première attaque subie à chaque phase du Cycle Céleste rate"},
  blind:       {icon:"👁",  name:"Blinded",    desc:"Next attack hits a random target instead of the chosen one"},
};

function getAbilityBadges(card) {
  const cap = card.cap||'';
  const badges = [];
  const add = (key) => { if(ABILITY_GLOSSARY[key]) badges.push(ABILITY_GLOSSARY[key]); };

  if(cap.includes('hurry')) add('hurry');
  if(cap.includes('protect')) add('protect');
  if(cap.includes('hit')) add('hit');
  if(cap.includes('heal')) add('heal');
  if(cap.includes('endure')) add('endure');
  if(cap.includes('entry')) add('entry');
  if(cap.includes('exit')) add('exit');
  if(isAnytime(card)) add('anytime');
  if(cap.startsWith('fd_')) add('face_down');

  // Status effects on field cards
  if(card.sanded) add('sand');
  if(card.asleep) add('sleep');
  if(card.cursed) add('curse');
  if((card.cap||'').includes('esquive') && !card.esquiveUsed) add('esquive');
  if(card.blinded) add('blind');

  return badges;
}

function showCardPreview(card, anchorEl) {
  if (!card) return;
  const pv = document.getElementById('card-preview');
  if (!pv) return;
  const imgSrc = getCardImage(card.id || '');
  const isMonster = card.type === 'monster';

  const imgEl = document.getElementById('cpv-img');
  if (imgSrc) { imgEl.src = imgSrc; imgEl.style.display = 'block'; }
  else { imgEl.style.display = 'none'; imgEl.src = ''; }

  const atkEl = document.getElementById('cpv-atk');
  const defEl = document.getElementById('cpv-def');
  if (isMonster) {
    atkEl.textContent = (card.cAtk ?? card.atk ?? 0) + '⚔';
    defEl.textContent = (card.cDef ?? card.def ?? 0) + '🛡';
    atkEl.style.display = defEl.style.display = '';
  } else {
    atkEl.textContent = ''; defEl.textContent = '';
  }
  document.getElementById('cpv-cost-overlay').textContent = (card.cost != null ? card.cost + ' 💎' : '');
  document.getElementById('cpv-name-overlay').textContent = card.n || card.name || '';
  document.getElementById('cpv-name').textContent = card.n || card.name || '';

  const isAnytimeC = isAnytime(card);
  const tagType  = isAnytimeC ? 'anytime' : card.type === 'god' ? 'god' : card.type === 'spell' ? 'spell' : 'monster';
  const tagLabel = isAnytimeC ? '⚡ ANYTIME' : card.type === 'god' ? '⚡ Dieu' : card.type === 'spell' ? '✨ Sort' : '🐉 Monstre';
  const tagEl = document.getElementById('cpv-tag');
  if (tagEl) { tagEl.className = 'cpv-tag ' + tagType; tagEl.textContent = tagLabel; }

  document.getElementById('cpv-txt').textContent = card.txt || card.capText || '';

  const badges = getAbilityBadges(card);
  const abEl = document.getElementById('cpv-abilities');
  abEl.innerHTML = badges.map(b =>
    '<div class="cpv-ability"><span class="cpv-abil-icon">' + b.icon + '</span><div>' +
      '<span class="cpv-abil-name">' + b.name + '</span>' +
      '<span class="cpv-abil-desc">' + b.desc + '</span></div></div>'
  ).join('');

  pv.style.display = 'flex';
  positionCardPreview(pv, anchorEl);
}

// Positionne le popup près de la carte survolée, clampé au viewport.
function positionCardPreview(pv, anchorEl) {
  const m = 12, vw = window.innerWidth, vh = window.innerHeight;
  const w = pv.offsetWidth || 480, h = pv.offsetHeight || 320;
  let x, y;
  if (anchorEl && anchorEl.getBoundingClientRect) {
    const r = anchorEl.getBoundingClientRect();
    x = r.left + r.width / 2 - w / 2;
    y = r.top - h - 12;                 // au-dessus de la carte
    if (y < m) y = r.bottom + 12;       // sinon en dessous
  } else { x = (vw - w) / 2; y = (vh - h) / 2; }
  x = Math.max(m, Math.min(x, vw - w - m));
  y = Math.max(m, Math.min(y, vh - h - m));
  pv.style.left = x + 'px';
  pv.style.top = y + 'px';
}

function hideCardPreview() {
  const pv = document.getElementById('card-preview');
  if(pv) pv.style.display = 'none';
}

// =====================================================
// ARROW / TARGETING SYSTEM
// =====================================================
let arrowAnim = null;
let arrowStart = {x:0, y:0};
let arrowMousePos = {x:0, y:0};

function getElCenter(el) {
  const r = el.getBoundingClientRect();
  return {x: r.left + r.width/2, y: r.top + r.height/2};
}

function startAttackTargeting(attacker, p, idx) {
  if(!G) return;
  const opp = p===1?2:1;
  const OP = G.players[opp];
  hideCardPreview();

  // Find attacker DOM element
  const atkEl = document.querySelector(`[data-player="${p}"][data-idx="${idx}"]`);
  const startPos = atkEl ? getElCenter(atkEl) : {x: window.innerWidth/2, y: window.innerHeight/2};
  arrowStart = startPos;

  // Set targeting state
  G.targeting = {
    mode: 'attack',
    p, idx, attacker,
    opp,
    resolve: null,
  };

  // Mark valid targets
  document.body.classList.add('targeting');
  const hasProtect = OP.field.some(m=>m&&effProtect(m,opp)&&!m.asleep);
  
  // Mark opponent field cards
  document.querySelectorAll(`[data-player="${opp}"]`).forEach(el => {
    const mi = parseInt(el.dataset.idx);
    const m = OP.field[mi];
    if(m && (!m.faceDown || (m.asleep && canTargetSleeping(p)))) el.classList.add('valid-target-dmg');
  });

  // Mark player HP bar as target (if no protect)
  const oppBar = document.getElementById(`p${opp}-bar`);
  if(oppBar && !hasProtect) oppBar.classList.add('targetable');
  if(hasProtect && p === 1) showTuto('protect'); // TUTO 4

  // Show hint
  const hint = document.getElementById('targeting-hint');
  hint.style.display = 'block';
  hint.innerHTML = `⚔ <b>${attacker.n}</b> — Choisis une cible (clic ou glisser) · <span style="color:#888">ESC pour annuler</span>`;
  
  startArrow(startPos);
  addLog(`${attacker.n} ready — click a target to attack`, 'event');
  renderAll();
}

function startCardTargeting(handIdx, card) {
  if(!G) return;
  // For anytime / god / spell cards: start targeting mode before playing
  const p = G.cp;
  const opp = p===1?2:1;
  const cap = card.cap||'';

  // Determine what this card targets
  let targetMode = 'any'; // 'any','opp_field','own_field','opp_player','all_field'
  let needsTarget = true;

  if(['god_cancel_m','god_cancel_ms','god_cancel_s_draw','fd_cancel_monster','fd_cancel_spell'].includes(cap)) {
    // These counter during opp turn — no field target needed now, play directly
    needsTarget = false;
  } else if(['god_create2','god_odin','god_mutual_sacrifice','god_osiris','god_balder','god_cancel_attack'].includes(cap)) {
    needsTarget = false;
  } else if(['god_minus4_all','god_susanoo'].includes(cap)) {
    needsTarget = false;
  }

  if(!needsTarget) {
    playCard(handIdx);
    return;
  }

  const handEl = document.querySelectorAll('.hcard')[handIdx];
  const startPos = handEl ? getElCenter(handEl) : {x:window.innerWidth/2, y:window.innerHeight-100};
  arrowStart = startPos;
  hideCardPreview();

  G.targeting = {
    mode: 'card',
    handIdx, card, p, opp,
    cap,
  };

  document.body.classList.add('targeting');
  if(handEl) handEl.classList.add('targeting-src');

  // Mark valid targets based on card effect
  markValidTargets(cap, p, opp);

  const hint = document.getElementById('targeting-hint');
  hint.style.display = 'block';
  hint.innerHTML = `⚡ <b>${card.n}</b> — Choisis une cible · <span style="color:#888">ESC pour annuler</span>`;

  startArrow(startPos);
}

function markValidTargets(cap, p, opp) {
  const markOppField = () => {
    document.querySelectorAll(`[data-player="${opp}"]`).forEach(el=>{
      const m = G.players[opp].field[parseInt(el.dataset.idx)];
      if(m&&!m.faceDown) el.classList.add('valid-target');
    });
  };
  const markOwnField = () => {
    document.querySelectorAll(`[data-player="${p}"]`).forEach(el=>{
      const m = G.players[p].field[parseInt(el.dataset.idx)];
      if(m&&!m.faceDown) el.classList.add('valid-target');
    });
  };
  const markAllField = () => { markOppField(); markOwnField(); };
  const markOppPlayer = () => {
    const bar = document.getElementById(`p${opp}-bar`);
    if(bar) bar.classList.add('targetable');
  };
  const markOwnPlayer = () => {
    const bar = document.getElementById(`p${p}-bar`);
    if(bar) bar.classList.add('targetable');
  };

  // Map cap to target types
  const oppOnly = ['god_sleep','god_blank11','god_steal','god_minus3_draw','god_minus2','god_blind_draw','god_force_attack','god_redirect','god_thor','fd_destroy_attacker','fd_blocker','fd_copy_monster','fd_minus4_all','fd_curse_draw'];
  const ownOnly = ['god_buff3','god_equip_minus2','god_equip_return'];
  const anyField = ['god_destroy_ms','god_bewitch_draw','god_copy','god_swap'];
  const dmgTarget = ['spell_dmg4','spell_dmg4_sand','spell_dmg4_bewitch'];

  if(oppOnly.includes(cap)) { markOppField(); }
  else if(ownOnly.includes(cap)) { markOwnField(); }
  else if(anyField.includes(cap)) { markAllField(); }
  else if(dmgTarget.includes(cap)) { markOppField(); markOppPlayer(); }
  else if(cap==='god_resurrect') {
    // show graveyard items — for now mark opp player as "from graveyard"
    markOwnPlayer();
  }
  else { markOppField(); markOwnField(); } // default: any field
}

function resolveTarget(target) {
  if(!G || !G.targeting) return;
  const t = G.targeting;
  stopTargeting();

  if(t.mode==='attack') {
    const {p, idx, opp} = t;
    // Bug #6 fix: handle second hit strike for P1
    if(window._hitStrikeResolve) {
      const resolve = window._hitStrikeResolve;
      window._hitStrikeResolve = null;
      if(target.type==='player') {
        doAttack(p, idx, opp, 'player', true);
      } else {
        doAttack(p, idx, target.p, target.i, true);
      }
      resolve();
      return;
    }
    if(target.type==='player') {
      doAttack(p, idx, opp, 'player');
    } else {
      doAttack(p, idx, target.p, target.i);
    }
  } else if(t.mode==='card') {
    if(t.pendingResolve) {
      applyTargetEffect(t.pendingType, target.p, target.i, t.card);
      t.pendingResolve();
    } else {
      window._forcedTarget = target;
      playCard(t.handIdx);
    }
  }

  // If we were in a reaction window and targeting is now done, end reaction
  if(G.inReaction && !G.targeting) {
    if(window._endReaction) window._endReaction();
  }

  renderAll();
  checkVictory();
}

function resolvePlayerTarget(targetP) {
  if(!G || !G.targeting) return;
  const t = G.targeting;
  stopTargeting();

  if(t.mode==='attack') {
    const {p, idx, opp} = t;
    // Bug #6 fix: second hit for P1 direct attack
    if(window._hitStrikeResolve) {
      const resolve = window._hitStrikeResolve;
      window._hitStrikeResolve = null;
      doAttack(p, idx, opp, 'player', true);
      resolve();
      return;
    }
    doAttack(p, idx, opp, 'player');
  } else if(t.mode==='card') {
    if(t.pendingResolve) {
      G.players[targetP].hp -= 4;
      addLog('Spell — P' + targetP + ' takes 4 dmg (❤' + G.players[targetP].hp + ')','dmg');
      t.pendingResolve();
    }
  }

  // End reaction if targeting done
  if(G.inReaction && !G.targeting) {
    if(window._endReaction) window._endReaction();
  }

  renderAll();
  checkVictory();
}

function stopTargeting() {
  G.targeting = null;
  document.body.classList.remove('targeting');
  document.querySelectorAll('.valid-target,.valid-target-dmg,.targetable,.targeting-src,.atk-source').forEach(el=>{
    el.classList.remove('valid-target','valid-target-dmg','targetable','targeting-src','atk-source');
  });
  document.getElementById('targeting-hint').style.display='none';
  hideCardPreview();
  stopArrow();
}

// Arrow drawing
function startArrow(startPos) {
  arrowStart = startPos;
  const canvas = document.getElementById('arrow-canvas');
  canvas.style.display = 'block';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  
  const draw = () => {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);
    drawArrow(ctx, arrowStart, arrowMousePos);
    arrowAnim = requestAnimationFrame(draw);
  };
  arrowAnim = requestAnimationFrame(draw);
}

function stopArrow() {
  if(arrowAnim) { cancelAnimationFrame(arrowAnim); arrowAnim=null; }
  const canvas = document.getElementById('arrow-canvas');
  canvas.style.display='none';
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
}

function drawArrow(ctx, from, to) {
  const dx=to.x-from.x, dy=to.y-from.y;
  const len=Math.sqrt(dx*dx+dy*dy);
  if(len<20) return;
  
  const angle=Math.atan2(dy,dx);
  const headLen=18;
  
  // Gradient color
  const grad=ctx.createLinearGradient(from.x,from.y,to.x,to.y);
  grad.addColorStop(0,'rgba(243,156,18,0.2)');
  grad.addColorStop(1,'rgba(243,156,18,0.9)');
  
  // Shaft
  ctx.beginPath();
  ctx.moveTo(from.x,from.y);
  ctx.lineTo(to.x-Math.cos(angle)*headLen*.7,to.y-Math.sin(angle)*headLen*.7);
  ctx.strokeStyle=grad;
  ctx.lineWidth=3;
  ctx.lineCap='round';
  ctx.setLineDash([8,4]);
  ctx.stroke();
  ctx.setLineDash([]);
  
  // Arrowhead
  ctx.beginPath();
  ctx.moveTo(to.x,to.y);
  ctx.lineTo(to.x-headLen*Math.cos(angle-0.4),to.y-headLen*Math.sin(angle-0.4));
  ctx.lineTo(to.x-headLen*Math.cos(angle+0.4),to.y-headLen*Math.sin(angle+0.4));
  ctx.closePath();
  ctx.fillStyle='rgba(243,156,18,0.9)';
  ctx.fill();
  
  // Glow circle at origin
  ctx.beginPath();
  ctx.arc(from.x,from.y,7,0,Math.PI*2);
  ctx.fillStyle='rgba(243,156,18,0.5)';
  ctx.fill();
}

// Global mouse move for arrow
document.addEventListener('mousemove', e=>{
  arrowMousePos = {x:e.clientX, y:e.clientY};
});

// ESC / right-click to cancel targeting
document.addEventListener('keydown', e=>{
  // ESPACE : valider la réaction ou avancer la phase
  if (e.code === 'Space' || e.key === ' ') {
    e.preventDefault();
    if (G && G.waitingForPlayer) {
      resolveReaction();
      return;
    }
    if (G && G.cp === 1 && G.activeTurn === 1 && !aiThinking) {
      nextPhase();
      return;
    }
  }
  // ESC : annuler ciblage
  if(e.key==='Escape' && G && G.targeting) {
    G.selAtk=null;
    stopTargeting();
    if(G.inReaction && window._resolveReaction) window._resolveReaction();
    renderAll();
  }
});
document.addEventListener('contextmenu', e=>{
  if(G && G.targeting) { e.preventDefault(); G.selAtk=null; stopTargeting(); renderAll(); }
});

// Override showTargetModal to use arrow targeting instead
const _origPickTarget = pickTarget;


// =====================================================
// HUMAN TARGET MODAL
// =====================================================
function showTargetModal(type, p, opp) {
  const srcEl = document.querySelector('.targeting-src') || document.querySelector('.atk-source') || document.querySelector('.hcard.playable');
  const startPos = srcEl ? getElCenter(srcEl) : {x:window.innerWidth/2, y:window.innerHeight-100};
  arrowStart = startPos;

  G.targeting = {
    mode: 'card',
    pendingType: type,
    pendingResolve: pendingAction ? pendingAction.resolve : null,
    card: pendingAction ? pendingAction.card : null,
    p, opp,
  };

  document.body.classList.add('targeting');
  markValidTargets(type, p, opp);

  const hint = document.getElementById('targeting-hint');
  hint.style.display = 'block';
  hint.innerHTML = '🎯 <b>' + targetTitle(type) + '</b> — Choisis une cible en surbrillance · <span style="color:#888">ESC pour annuler</span>';

  startArrow(startPos);
}

function targetTitle(type) {
  const map={sleep:'Put to sleep',blind:'Blind',curse:'Curse',minus3:'-3 Shield',minus2:'-2 Shield',blank11:'→ 1/1 blank',destroy:'Destroy',buff3:'+3/+3 target',equip_seth:'Equip Seth',equip_return:'Equip Izanami',steal:'Steal',copy:'Copy Monster',force_attack:'Force to attack',swap:'Swap Monster',spell4dmg:'4 Damage target',redirect:'Redirect attack'};
  return map[type]||type;
}

async function applyTargetEffect(type, fromP, idx, card) {
  const m=G.players[fromP].field[idx];
  if(!m) return;
  const p=pendingAction?.p||G.cp;
  const opp=fromP;

  if(type==='sleep') {
    const dur = (getZenithFaction()==='yokai' && G.players[p] && G.players[p].faction==='yokai') ? 3 : 2; // zénith Nuit (3.1)
    m.faceDown=true; m.asleep=true; m.sleepTurns=dur;
    addLog(`${m.n} put to sleep (${dur}t)!`,'debuff');
  }
  else if(type==='blind') { m.blinded=true; addLog(`${m.n} blinded — next attack random`,'debuff'); }
  else if(type==='curse') { m.cursed=true; addLog(`${m.n} CURSED — 1 dmg = death!`,'debuff'); }
  else if(type==='minus3') { m.cDef=Math.max(0,m.cDef-3); addLog(`${m.n} −3 shield → ${m.cDef}`,'dmg'); if(m.cDef<=0) await handleDeath(fromP,m); }
  else if(type==='minus2') { m.cDef=Math.max(0,m.cDef-2); addLog(`${m.n} −2 shield → ${m.cDef}`,'dmg'); if(m.cDef<=0) await handleDeath(fromP,m); }
  else if(type==='blank11') { m.cAtk=1;m.cDef=1;m.cap='';m.txt='1/1 blank'; addLog(`${m.n} → 1/1 blank!`,'event'); }
  else if(type==='destroy') { addLog(`${m.n} destroyed!`,'dmg'); await handleDeath(fromP,m); }
  else if(type==='buff3') { m.cAtk+=3;m.cDef+=3;m.buff3turn=true; addLog(`${m.n} +3/+3!`,'buff'); }
  else if(type==='equip_seth') { m.sethEquipped=true; addLog(`Seth equipped to ${m.n}`,'event'); if(card) G.players[p>1?p:G.cp].graveyard.push(card); }
  else if(type==='equip_return') { m.izanamiEquipped=true; addLog(`Izanami equipped to ${m.n}`,'event'); if(card) G.players[p>1?p:G.cp].graveyard.push(card); }
  else if(type==='steal') {
    const srcP=fromP, dstP=srcP===1?2:1;
    if(G.players[dstP].field.length<6){
      G.players[srcP].field.splice(idx,1);
      G.players[dstP].field.push(m);
      reindexSets(G.players[srcP],idx,true);
      addLog(`${m.n} stolen!`,'event');
    }
  }
  else if(type==='copy') {
    const dstP=G.cp;
    if(G.players[dstP].field.length<6){
      const copy=newCard({...m});copy.cAtk=m.atk;copy.cDef=m.def;
      G.players[dstP].field.push(copy);
      addLog(`Copy of ${m.n} created!`,'event');
    }
  }
  else if(type==='force_attack') {
    // force this monster to attack another on same team
    const oppField=G.players[fromP].field.filter(x=>x&&x!==m&&!x.faceDown);
    if(oppField.length>0){
      const victim=oppField[0];
      victim.cDef=Math.max(0,victim.cDef-m.cAtk);
      addLog(`${m.n} forced to attack ${victim.n} (${m.cAtk} dmg)`,'event');
      if(victim.cDef<=0) await handleDeath(fromP,victim);
    }
  }
  else if(type==='spell4dmg') {
    m.cDef=Math.max(0,m.cDef-(m.cursed?m.cDef:4));
    addLog(`Spell — ${m.n} takes 4 dmg → ${m.cDef}🛡`,'dmg');
    if(m.cDef<=0) await handleDeath(fromP,m);
  }
  // Bug #10 fix: Scylla entry_cancel → cancel_ms was missing
  else if(type==='cancel_ms') {
    addLog(`${m.n} cancelled and destroyed!`,'special');
    await handleDeath(fromP,m);
  }
}

// =====================================================
// RENDER FUNCTIONS
// =====================================================

// ═══════════════════════════════════════════════════════════════════
// RENDER FUNCTIONS — Hearthstone-style
// ═══════════════════════════════════════════════════════════════════
const FC = {yokai:'#d04030',norse:'#8090a0',egyptian:'#3090d0',greek:'#9050c0',aztec:'#d0b010'};
const FE = {yokai:'🦊',norse:'⚡',egyptian:'🏺',greek:'🏛️',aztec:'🌿'};

// ── Cycle Céleste — render & animation ────────────────────────────
function renderCycleBanner() {
  const el = document.getElementById('cycle-banner');
  if(!el || !G) return;
  const cur = G.cycle % 5;
  const phaseName = CYCLE_PHASES[cur];
  const zenFaction = ZENITH_MAP[phaseName];

  const iconsHTML = CYCLE_PHASES.map((ph, idx) => {
    const active = idx === cur;
    return `<div class="cycle-phase${active?' active':''}" title="${CYCLE_NAMES[ph]}">
      <span class="cycle-icon">${CYCLE_ICONS[ph]}</span>
      <span class="cycle-phase-label">${CYCLE_NAMES[ph]}</span>
    </div>`;
  }).join('');

  const zenCol = (typeof FC!=='undefined' && FC[zenFaction]) || 'var(--gold-bright)';
  el.style.setProperty('--zen', zenCol);
  el.innerHTML = `
    <div class="cycle-phases">${iconsHTML}</div>
    <div class="cycle-zenith" data-zen="${zenFaction}">ZÉNITH · <strong style="color:${zenCol};text-shadow:0 0 10px ${zenCol}">${ZENITH_LABEL[zenFaction]}</strong><span class="cycle-bonus">${ZENITH_BONUS_TXT[zenFaction]||''}</span></div>`;

  // Teinte du champ de bataille selon la phase
  const game = document.getElementById('game');
  if(game) game.dataset.cyclePhase = phaseName;
  // Médaillon central
  const medIcon = document.getElementById('divider-medallion-icon');
  if(medIcon) medIcon.textContent = CYCLE_ICONS[phaseName];
}

let _cycleAnimPending = false;
function scheduleCycleAnim() {
  _cycleAnimPending = true;
}

function applyCycleAnim() {
  if(!_cycleAnimPending) return;
  _cycleAnimPending = false;
  const el = document.getElementById('cycle-banner');
  if(!el) return;
  el.classList.remove('cycle-transition');
  el.offsetHeight;
  el.classList.add('cycle-transition');
  setTimeout(() => el.classList.remove('cycle-transition'), 1200);
  // Flash du médaillon central
  const med = document.getElementById('divider-medallion');
  if(med){ med.style.animation='none'; med.offsetHeight; med.style.animation='medallionFlash 1s ease-out, medallionFloat 6s ease-in-out 1s infinite'; }
  // SFX
  if(typeof Audio5L !== 'undefined') {
    Audio5L.sfx.mana();
    setTimeout(() => Audio5L.sfx.draw(), 180);
  }
  // Log
  const ph = CYCLE_PHASES[G.cycle % 5];
  addLog(`🌌 Cycle Céleste — ${CYCLE_NAMES[ph]} ! Zénith : ${ZENITH_LABEL[ZENITH_MAP[ph]]}`, 'special');
}

function renderAll() {
  if(G) { [1,2].forEach(p => { if(G.players[p]) renderPassiveIndicators(p); }); }
  if(!G) return;
  renderCycleBanner();
  applyCycleAnim();
  renderPlayerBar(1); renderPlayerBar(2);
  renderField(1); renderField(2);
  renderHand();
  renderPhaseBar();
  renderLog();
  updateButtons();
  // Bug #8 fix: close attack modal if attacker no longer exists
  const atkModal = document.getElementById('atk-modal');
  if(atkModal && atkModal.style.display==='flex' && G.selAtk) {
    const {p,i} = G.selAtk;
    if(!G.players[p] || !G.players[p].field[i]) {
      atkModal.style.display='none'; G.selAtk=null;
    }
  }
  // Re-apply player bar targetable state in attack mode
  if(G.targeting && G.targeting.mode==='attack') {
    const opp=G.targeting.opp;
    const OP=G.players[opp];
    const hasProtect=OP.field.some(m=>m&&effProtect(m,opp)&&!m.asleep);
    if(!hasProtect) {
      const bar=document.getElementById(`p${opp}-bar`);
      if(bar) bar.classList.add('targetable');
    }
  }
  // Re-apply card targeting markers
  if(G.targeting && G.targeting.mode==='card') {
    const {cap,p,opp}=G.targeting;
    markValidTargets(cap,p,opp);
  }
}

function flashDamage(selector) {
  const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (!el) return;
  el.style.animation = 'none';
  el.offsetHeight; // force reflow
  el.style.animation = 'dmg-flash .35s ease-out';
  setTimeout(() => { if(el) el.style.animation = ''; }, 400);
}


function renderPlayerBar(p) {
  const P = G.players[p];
  const maxHp = 25;
  const pct = Math.max(0, P.hp / maxHp * 100);
  const hpColor = pct > 50 ? '#2ecc71' : pct > 25 ? '#e67e22' : '#e74c3c';
  const hpGlow  = pct > 50 ? 'rgba(46,204,113,0.7)' : pct > 25 ? 'rgba(230,126,34,0.7)' : 'rgba(231,76,60,0.7)';
  const col = { yokai:'#d04030', norse:'#7090b0', egyptian:'#2090d0', greek:'#9050c0', aztec:'#c8a010' };
  const emo = { yokai:'🦊', norse:'⚡', egyptian:'🏺', greek:'🏛', aztec:'🌞' };

  const nameEl = document.getElementById(`p${p}-name`);
  if (nameEl) { nameEl.textContent = `${(P.faction||'').toUpperCase()}`; nameEl.style.color = col[P.faction] || '#fff'; }

  // Portrait écusson de faction
  const portrait = document.getElementById(`p${p}-portrait`);
  if (portrait) { portrait.textContent = emo[P.faction]||'⚔'; portrait.dataset.faction = P.faction||''; }
  const bar = document.getElementById(`p${p}-bar`);
  if (bar) bar.dataset.faction = P.faction||'';

  const orb = document.getElementById(`p${p}-orb`);
  if (orb) {
    orb.style.background = `radial-gradient(circle at 38% 32%, ${hpColor}dd 0%, ${hpColor}88 45%, ${hpColor}22 100%)`;
    orb.style.color = hpColor;
    orb.style.boxShadow = `0 0 0 2px rgba(255,255,255,0.06), 0 0 0 4px rgba(0,0,0,0.5), 0 0 18px ${hpGlow}, inset 0 3px 10px rgba(255,255,255,0.18), inset 0 -3px 8px rgba(0,0,0,0.5)`;
    orb.style.setProperty('--hp', pct);          // anneau qui se vide
    orb.classList.toggle('low-hp', P.hp < 10);   // glow rouge critique
  }
  const hpEl = document.getElementById(`p${p}-hp`);
  if (hpEl) hpEl.textContent = P.hp;
  const hpBar = document.getElementById(`p${p}-hpbar`);
  if (hpBar) { hpBar.style.width = `${pct}%`; hpBar.style.background = hpColor; }

  const gemsEl = document.getElementById(`p${p}-gems`);
  if (gemsEl) {
    let html = '';
    for (let i = 0; i < (P.maxGems || 0); i++)
      html += `<div class="gem${i < P.gems ? ' on' : ''}"></div>`;
    html += `<span class="gem-label">${P.gems}/${P.maxGems}</span>`;
    gemsEl.innerHTML = html;
  }
  const deckEl = document.getElementById(`p${p}-deck`);
  if (deckEl) deckEl.innerHTML =
    `<span class="deck-pile">🂠</span><span class="deck-count">${P.deck ? P.deck.length : 0}</span>`
    + `<span class="grave-count">${P.graveyard ? P.graveyard.length : 0}†</span>`;
}



// ── Passive indicators in HUD ──────────────────────────────────
function renderPassiveIndicators(p) {
  const P = G.players[p];
  let el = document.getElementById(`p${p}-passives`);
  if(!el) {
    const bar = document.getElementById(`p${p}-bar`);
    if(!bar) return;
    el = document.createElement('div');
    el.id = `p${p}-passives`;
    el.className = 'passive-row';
    bar.appendChild(el);
  }
  const indicators = [];
  P.field.forEach(m => {
    if(!m||m.faceDown) return;
    const c = m.cap||'';
    if(c.includes('passive_all_hurry'))    indicators.push(`⚡ QUETZAL — Tous vos monstres ont Rapide`);
    if(c.includes('passive_yokai_buff'))   indicators.push(`🐢 KAPPA — Yokai alliés +1/+1`);
    if(c.includes('passive_entry_buff11')) indicators.push(`🐴 CENTAURE — Entrée +1/+1`);
    if(c.includes('passive_adj_buff21'))   indicators.push(`🦌 EIKTHYRNIR — Adjacents +2 ATK/+1 DEF`);
    if(c.includes('passive_empty_hand_buff') && P.hand.length===0) indicators.push(`💪 OTOMITL — Main vide: Alliés +2/+1`);
  });
  if((G.ragnarok||0)>0 && P.faction==='norse') indicators.push(`⚡ RAGNARÖK: ${G.ragnarok}/5`);
  // Zenith indicator
  const zFaction = getZenithFaction();
  if(P.faction === zFaction) indicators.push(`🌌 ZÉNITH — ${ZENITH_BONUS_TXT[zFaction]}`);
  el.innerHTML = indicators.map(i=>`<span class="passive-indicator">${i}</span>`).join('');
}

function renderField(p) {
  const P=G.players[p];
  const isCurrent=p===G.cp;
  const el=document.getElementById(`field${p}`);
  el.innerHTML='';

  if(P.field.filter(m=>m).length===0) {
    el.innerHTML='<div class="empty-field">— Terrain vide —</div>';
    return;
  }

  P.field.forEach((m,i)=>{
    if(!m) return;
    const isSelAtk=G.selAtk&&G.selAtk.p===p&&G.selAtk.i===i;
    const canAtk=isCurrent&&G.phase==='Combat'
      &&!P.attacked.has(i)
      &&(!P.summoned.has(i)||((m.cap||'').includes('hurry'))||P.field.some(x=>x&&(x.cap||'').includes('passive_all_hurry')))
      &&!m.asleep&&!m.sanded&&!m.faceDown;

    // Visuel uniquement : monstre invoqué ce tour, encore en mal d'invocation
    const summonSick = P.summoned.has(i)
      && !((m.cap||'').includes('hurry'))
      && !P.field.some(x=>x&&(x.cap||'').includes('passive_all_hurry'))
      && !m.faceDown && !m.asleep && !P.attacked.has(i);

    let cls='fcard';
    if(canAtk)     cls+=' can-atk';
    if(isSelAtk)   cls+=' atk-source';
    if(P.attacked.has(i)) cls+=' tapped';
    if(summonSick && !canAtk) cls+=' summon-sick';
    if(m.faceDown) cls+=' face-down';
    if(isZenith(m)) cls+=' zenith-card';
    // Re-apply targeting highlights when in targeting mode
    if(G.targeting && !m.faceDown) {
      if(G.targeting.mode==='attack') {
        // Attack: all visible opponent monsters + player bar (handled in renderPlayerBar)
        const opp=G.targeting.p===1?2:1;
        if(p===opp) cls+=' valid-target-dmg';
      } else if(G.targeting.mode==='card') {
        // Card targeting: defer to markValidTargets (called separately)
      }
    }

    const factionCol=FC[m.faction||P.faction]||'var(--brd2)';
    const div=document.createElement('div');
    div.className=cls;
    if (m._newCard) {
  div.style.animation = 'card-summon .42s cubic-bezier(0.34,1.56,0.64,1) forwards';
  setTimeout(() => { if(div) div.style.animation = ''; }, 500);
  delete m._newCard;
}
    div.dataset.player=p;div.dataset.idx=i;
    div.dataset.faction=m.faction||P.faction;
    div.dataset.rarity=m.rarity||(m.type==='god'?'god':'common');
    div.dataset.type=m.type||'monster';
    div.addEventListener('mouseenter',()=>showCardPreview(m,div));
    div.addEventListener('mouseleave',()=>{ if(!G||!G.targeting) hideCardPreview(); });
    div.addEventListener('contextmenu',(e)=>{ e.preventDefault(); showBigPreview(m); });
    div.addEventListener('dblclick',()=>showBigPreview(m));
    div.onclick=()=>onFieldClick(p,i);

    if(m.faceDown) {
      // Sleeping monsters look DIFFERENT from intentional traps
      const isSleeping = m.asleep;
      const fdIcon  = isSleeping ? '😴' : '🂠';
      const fdLabel = isSleeping ? `Zzz (${m.sleepTurns||'?'}t)` : 'Face Down';
      const fdBg    = isSleeping
        ? 'radial-gradient(ellipse at 50% 40%, rgba(20,40,100,0.7), var(--bg3))'
        : 'radial-gradient(ellipse at 50% 40%, rgba(60,50,120,0.4), var(--bg3))';
      const fdNameColor = isSleeping ? '#88aaff' : factionCol;
      const fdName      = isSleeping ? '💤 Sleeping' : `${FE[P.faction]} Trap`;
      div.innerHTML=`
        <div class="fc-frame" style="${isSleeping?'box-shadow:0 0 12px rgba(100,140,255,0.4)':''}">
          <div class="fc-inner">
            <div class="fc-art" style="background:${fdBg}">
              <div class="fd-inner">
                <div class="fd-icon" style="font-size:${isSleeping?'28px':'20px'}">${fdIcon}</div>
                <div class="fd-label" style="color:${isSleeping?'#88aaff':'var(--brd3)'}">${fdLabel}</div>
              </div>
            </div>
            <div class="fc-info">
              <div class="fc-name-band" style="color:${fdNameColor}">${fdName}</div>
            </div>
          </div>
        </div>
      `;
    } else {
      const imgSrc=IMGS[m.id]||'';
      const statuses=[];
      if(m.cursed)        statuses.push('<span class="st cursed">CURSED</span>');
      if(m.asleep)        statuses.push('<span class="st asleep">😴</span>');
      if(m.sanded)        statuses.push('<span class="st sanded">⏳</span>');
      if((m.cap||'').includes('esquive') && !m.esquiveUsed) statuses.push('<span class="st esquive" title="Esquive disponible">💨</span>');
      if(m.sethEquipped)  statuses.push('<span class="st seth">SETH</span>');
      if(m.izanamiEquipped)statuses.push('<span class="st izanami">IZA</span>');

      const capShort=(m.cap||'').replace(/_/g,' ').split(' ').slice(0,2).join(' ')||'—';
      const z=isZenith(m);

      div.innerHTML=`
        <div class="fc-frame">
          <div class="fc-inner">
            <div class="fc-art">
              ${imgSrc
                ?`<img src="${imgSrc}" alt="${m.n}" loading="lazy">`
                :`<div class="art-placeholder"><span class="ap-icon">${FE[m.faction||P.faction]}</span><span class="ap-name">${m.n}</span><span class="ap-soon">illustration à venir</span></div>`
              }
            </div>
            <div class="fc-info">
              ${statuses.length?`<div class="fc-status">${statuses.join('')}</div>`:''}
              <div class="fc-name-band">${m.n}</div>
              <div class="fc-cap-text">${capShort}</div>
            </div>
          </div>
          ${m.cost!=null&&m.cost!==''?`<div class="fc-cost">${m.cost}</div>`:''}
          <div class="fc-rarity"></div>
        </div>
        ${m.type==='monster'?`<div class="fc-atk${z?' boosted':''}">${m.cAtk}</div><div class="fc-def${z?' boosted':''}">${m.cDef}</div>`:''}
      `;
    }
    // ── Bouton RITUEL pour monstres aztèques compatibles ────────
    if(isCurrent && (G.phase==='Main1'||G.phase==='Main2')
       && (m.cap||'').match(/ritual_/)
       && P.faction==='aztec'
       && P.field.filter(x=>x&&!x.faceDown).length >= 2
       && !G.targeting && !G.ritualPending) {
      const ritBtn = document.createElement('button');
      ritBtn.className = 'btn-ritual';
      ritBtn.textContent = '🔥 RITUEL';
      ritBtn.style.cssText = 'display:block;width:100%;margin-top:4px;';
      ritBtn.onclick = (e) => { e.stopPropagation(); startRitual(p, i); };
      div.appendChild(ritBtn);
    }

    el.appendChild(div);
  });
}

// ── Sacrifice Rituel ──────────────────────────────────────────
function startRitual(p, cardIdx) {
  G.ritualPending = {p, cardIdx};
  addLog('🔥 RITUEL — Choisissez un allié à sacrifier.','special');
  renderAll();
}

async function executeRitual(p, cardIdx, sacrificeIdx) {
  const P = G.players[p];
  const ritualCard = P.field[cardIdx];
  const sacrifice = P.field[sacrificeIdx];
  if(!ritualCard || !sacrifice || sacrificeIdx === cardIdx) return;

  addLog(`🔥 ${sacrifice.n} sacrifié pour ${ritualCard.n}!`,'special');
  // Remove sacrifice WITHOUT triggering exit effects
  P.field.splice(sacrificeIdx, 1);
  P.graveyard.push(sacrifice);

  const cap = ritualCard.cap||'';
  const opp = p===1?2:1;

  if(cap.includes('ritual_wipe5')) {
    const targets = G.players[opp].field.filter(x=>x&&!x.faceDown);
    for(const t of targets) {
      t.cDef = Math.max(0, t.cDef-5);
      if(t.cDef<=0) await handleDeath(opp, t);
    }
    addLog(`🔥 Rituel — 5 dégâts à tous les monstres adverses!`,'dmg');
  }
  if(cap.includes('ritual_tokens3')) {
    for(let t=0;t<3&&P.field.length<6;t++) {
      const tok=newCard({id:'RITUAL_TOK',n:'Jeton 2/2',atk:2,def:2,cost:0,type:'monster',
        cap:'hurry',txt:'Jeton Rituel',rarity:'common',faction:P.faction});
      tok.cAtk=2;tok.cDef=2; P.field.push(tok);
    }
    addLog(`🔥 Rituel — 3 jetons 2/2 Rapide!`,'event');
  }

  G.ritualPending = null;
  renderAll();
  checkVictory();
}

function renderHand() {
  // En PvE, le joueur humain (J1) ne doit JAMAIS voir la main de l'IA :
  // le « viewer » (main affichée face visible) est toujours J1. En PvP
  // hot-seat, c'est le joueur actif. La main de l'autre est rendue en dos.
  const cp = (G.mode==='pve') ? 1 : G.cp;
  const viewerActive = (G.cp === cp); // le viewer peut-il agir en ce moment ?
  const ownTurn2=G.cp===G.activeTurn&&!G.waitingForPlayer;
  const banner=document.getElementById('opp-banner');
  if(banner) banner.classList.toggle('visible',!ownTurn2||G.waitingForPlayer);
  const P=G.players[cp];
  const el=document.getElementById('hand-cards');
  el.innerHTML='';
  // UX #2: visual action counter with icons
  // Gems are the only resource — no action counter
  const ownTurnLabel = G.waitingForPlayer ? '⚡ PAUSE — ESPACE pour continuer' : G.inReaction ? '⚡ RÉACTION' : (G.cp===G.activeTurn?'Ton tour':'Tour adverse');
  document.getElementById('hand-label').innerHTML=
    `<span>Main — J${cp} ${FE[P.faction]} (${P.hand.length} cartes)</span>`
    +`<span style="margin-left:12px;color:${G.inReaction?'#f39c12':'var(--gold)'};font-size:12px">`
    +`${ownTurnLabel}&nbsp;&nbsp;◆ ${P.gems}/${P.maxGems} gems</span>`;

  P.hand.forEach((c,i)=>{
    const isAnytimeC=isAnytime(c);
    const ownTurn=G.cp===G.activeTurn;
    const canPlay=viewerActive&&P.gems>=c.cost&&(
      (ownTurn&&(G.phase==='Main1'||G.phase==='Main2'))||
      (ownTurn&&isAnytimeC&&G.phase!=='End')||
      (!ownTurn&&isAnytimeC)||
      (G.waitingForPlayer&&isAnytimeC)  // réaction à une action IA
    );
    const div=document.createElement('div');
    let hcardCls=`hcard${canPlay?' playable':' dim'}`
      +`${c.type==='god'?' god':c.type==='spell'?' spell':''}`
      +`${isAnytimeC?' anytime':''}`;
    if(G.waitingForPlayer&&isAnytimeC&&P.gems>=c.cost) hcardCls+=' reaction-ready';
    div.className=hcardCls;
    div.dataset.faction=c.faction||P.faction;
    div.dataset.rarity=c.rarity||(c.type==='god'?'god':c.type==='spell'?'common':'common');
    div.addEventListener('mouseenter',()=>{ showCardPreview(c,div); if(div.classList.contains('playable')) Audio5L.sfx.select(); });
    div.addEventListener('mouseleave',()=>{ if(!G||!G.targeting) hideCardPreview(); });
    div.onclick=()=>{
      if(!G) return;
      if(G.targeting){ resolveTarget({type:'hand',idx:i}); return; }
      if(canPlay){
        if(isAnytimeC||c.type==='god'||c.type==='spell'){ startCardTargeting(i,c); }
        else { playCard(i); }
      }
    };
    div.addEventListener('contextmenu',(e)=>{ e.preventDefault(); showBigPreview(c); });
    div.addEventListener('dblclick',()=>showBigPreview(c));
    const imgSrc=IMGS[c.id]||'';
    const typeLabel=isAnytimeC?'<span class="anytime-badge">⚡ ANYTIME</span>':
      c.type==='god'?'⚡ Dieu':c.type==='spell'?'✨ Sort':'🐉 Monstre';

    div.innerHTML=`
      <div class="hc-frame-inner">
        <div class="hc-art">
          ${imgSrc?`<img src="${imgSrc}" alt="${c.n}" loading="lazy">`:`<div class="art-placeholder"><span class="ap-icon">${c.type==='spell'?'✨':c.type==='god'?'⚡':FE[c.faction||P.faction]}</span><span class="ap-name">${c.n}</span><span class="ap-soon">illustration à venir</span></div>`}
        </div>
        <div class="hc-name-band">${c.n}</div>
        <div class="hc-bottom">
          <div class="hc-type-row">${typeLabel}</div>
          <div class="hc-txt">${c.txt||''}</div>
        </div>
      </div>
      <div class="hc-cost">${c.cost}</div>
      <div class="hc-rarity"></div>
      ${c.type==='monster'?`<div class="hc-atk">${c.atk}</div><div class="hc-def">${c.def}</div>`:''}
    `;
    el.appendChild(div);
  });

  // ── Arc layout (Hearthstone fan) ───────────────────────────────────
  const cards = [...el.children];
  const n = cards.length;
  if(n > 0) {
    const maxAngle = Math.min(30, n * 4.2);
    cards.forEach((card, i) => {
      const t = n === 1 ? 0 : (i / (n-1)) * 2 - 1; // -1..+1
      const angle = t * maxAngle;
      const yOff  = -(1 - t*t) * 6; // centre légèrement plus haut (plus accessible)
      card.style.transform = `rotate(${angle}deg) translateY(${yOff}px)`;
      card.style.transformOrigin = 'bottom center';
      card.style.zIndex = String(Math.round((n+1)/2) - Math.abs(i - Math.floor((n-1)/2)));
      if(i > 0) card.style.marginLeft = n > 5 ? '-14px' : '-8px';
    });
  }

  // ── Opponent hand (card backs) ─────────────────────────────────────
  const oppEl = document.getElementById('opp-hand-cards');
  if(oppEl) {
    const oppP = G.players[cp === 1 ? 2 : 1];
    oppEl.innerHTML = '';
    const on = oppP.hand.length;
    const maxA2 = Math.min(22, on * 3.5);
    oppP.hand.forEach((_, j) => {
      const back = document.createElement('div');
      back.className = 'hcard-back';
      const t2 = on > 1 ? (j / (on-1)) * 2 - 1 : 0;
      back.style.transform = `rotate(${t2 * maxA2}deg)`;
      back.style.transformOrigin = 'bottom center';
      if(j > 0) back.style.marginLeft = on > 5 ? '-10px' : '-6px';
      back.innerHTML = '🂠';
      oppEl.appendChild(back);
    });
  }
}

function showOppTurnBanner() {
  const el = document.getElementById('opp-turn-banner');
  if (!el) return;
  el.style.display = 'block';
  el.style.animation = 'none';
  el.offsetHeight;
  el.style.animation = 'oppBanner 0.5s ease-out';
  setTimeout(() => { el.style.display = 'none'; }, 1600);
}


const LOG_ICONS = {turn:'⚔',event:'✨',summon:'🐉',dmg:'💥',heal:'💚',buff:'⬆',debuff:'⬇',combat:'⚔',phase:'◈',special:'🌟',warn:'⚠'};
function renderLog() {
  document.getElementById('log').innerHTML=
    G.log.map(l=>{
      const ico = LOG_ICONS[l.cls]||'·';
      return `<div class="log-e ${l.cls||''}"><span class="log-ico">${ico}</span><span>${l.msg}</span></div>`;
    }).join('');
}

function updateButtons() {
  const isAI=G.mode==='pve'&&G.cp===2;
  const ownTurn=G.cp===G.activeTurn;
  // Bug #9 fix: hide End Turn and Next Phase during reaction window
  const locked=isAI||aiThinking||!ownTurn||G.inReaction;
  const btnNext=document.getElementById('btn-next'); if(btnNext) btnNext.disabled=locked;
  const btnEnd=document.getElementById('btn-endturn'); if(btnEnd){ btnEnd.disabled=locked; btnEnd.classList.toggle('your-turn',!locked); }
  // Highlight doré des emplacements jouables (ton tour, phase principale)
  const gameEl=document.getElementById('game');
  if(gameEl) gameEl.classList.toggle('placing', !locked && (G.phase==='Main1'||G.phase==='Main2'));
  // AI thinking overlay
  const aiOv=document.getElementById('ai-overlay');
  if(aiOv) aiOv.classList.toggle('visible', aiThinking);
}

// ═══════════════════════════════════════════════════════════════════
// FIELD CLICK
// ═══════════════════════════════════════════════════════════════════
function onFieldClick(p,i) {
  if(!G) return;
  // Ritual: picking an ally to sacrifice
  if(G.ritualPending && p===G.ritualPending.p && i!==G.ritualPending.cardIdx) {
    const m = G.players[p].field[i];
    if(m && !m.faceDown) { executeRitual(p, G.ritualPending.cardIdx, i); return; }
  }
  if(G.ritualPending && p===G.ritualPending.p && i===G.ritualPending.cardIdx) {
    G.ritualPending=null; addLog('Rituel annulé.','event'); renderAll(); return;
  }
  if(G.targeting){ resolveTarget({type:'field',p,i}); return; }
  if(G.mode==='pve'&&G.cp===2) return;
  const cp=G.cp;
  // ZÉNITH GREC (3.1) : clic sur son dieu face caché en Main → déclenchement manuel.
  if(p===cp && (G.phase==='Main1'||G.phase==='Main2') && canManualTriggerFD(cp)) {
    const fd = G.players[cp].field[i];
    if(fd && fd.faceDown && fd.type==='god' && !fd.asleep) { manualTriggerFaceDown(cp, i); return; }
  }
  if(p===cp&&G.phase==='Combat'){
    const P=G.players[cp];
    const m=P.field[i];
    if(!m||m.faceDown||m.asleep) return;
    if(P.attacked.has(i)){ addLog(`${m.n} already attacked`); return; }
    const hasHurry=(m.cap||'').includes('hurry');
    if(P.summoned.has(i)&&!hasHurry){ addLog(`${m.n} summoned this turn — can't attack`); return; }
    if(m.sanded){ addLog(`${m.n} is sanded!`); return; }
    G.selAtk={p:cp,i};
    startAttackTargeting(m,cp,i);
  }
}

// ═══════════════════════════════════════════════════════════════════
// ATTACK MODAL
// ═══════════════════════════════════════════════════════════════════
function showAtkModal(attacker) {
  const opp=G.cp===1?2:1;
  const modal=document.getElementById('atk-modal');
  const title=document.getElementById('atk-title');
  const body=document.getElementById('atk-body');
  title.textContent=`${attacker.n} (${attacker.cAtk}⚔) — choose target`;
  body.innerHTML='';

  const OP=G.players[opp];
  const hasProtect=OP.field.some(m=>m&&effProtect(m,opp)&&!m.asleep);

  // Direct attack option
  const divP=document.createElement('div');
  const blocked0=hasProtect;
  divP.className=`tgt-item${blocked0?' blocked':''}`;
  const pct0=Math.max(0,OP.hp/25*100);
  const col0=pct0>50?'#2ecc71':pct0>25?'#e67e22':'#e74c3c';
  divP.innerHTML=`
    <div style="font-size:24px">👤</div>
    <div style="flex:1">
      <div style="font-family:'Cinzel',serif;font-size:13px;font-weight:600;margin-bottom:4px;color:var(--text)">Player ${opp} — Direct Attack</div>
      <div style="height:7px;background:rgba(0,0,0,0.5);border-radius:4px;overflow:hidden">
        <div style="width:${pct0}%;height:100%;background:${col0}"></div>
      </div>
      <div style="font-size:11px;color:${col0};margin-top:3px">❤ ${OP.hp} / 25${blocked0?' &nbsp;🛡 Protect monsters must be destroyed first':''}</div>
    </div>`;
  if(!blocked0) divP.onclick=()=>{
    modal.style.display='none';
    const {p,i}=G.selAtk;
    G.players[p].attacked.add(i);
    doAttack(p,i,opp,'player');
  };
  body.appendChild(divP);

  // Monster targets
  OP.field.forEach((m,i)=>{
    if(!m||m.faceDown) return;
    const blocked=hasProtect&&!effProtect(m,opp);
    const div=document.createElement('div');
    div.className=`tgt-item${blocked?' blocked':''}`;
    const img=IMGS[m.id]?`<img src="${IMGS[m.id]}" alt="">`:'';
    div.innerHTML=`${img}<span style="flex:1">${m.n} <span style="color:var(--atk-color)">${m.cAtk}⚔</span>/<span style="color:var(--def-color)">${m.cDef}🛡</span>${m.cursed?' 💀':''}</span>`;
    if(!blocked) div.onclick=()=>{
      modal.style.display='none';
      doAttack(G.selAtk.p,G.selAtk.i,opp,i);
    };
    body.appendChild(div);
  });

  const cancel=document.createElement('button');
  cancel.className='btn-sm';cancel.textContent='Cancel';
  cancel.onclick=()=>{modal.style.display='none';G.selAtk=null;renderAll();};
  body.appendChild(cancel);
  modal.style.display='flex';
}

// ═══════════════════════════════════════════════════════════════════
// SETUP — 2 écrans successifs
// ═══════════════════════════════════════════════════════════════════
let setupP1 = null, setupP2 = null;

// Injecter les images de faction dans toutes les .fp-bg
function initFactionArt() {
  if (typeof FACTION_ART === 'undefined') return;
  document.querySelectorAll('.fp').forEach(fp => {
    const f = fp.dataset.f;
    const img = fp.querySelector('.fp-bg');
    if (img && FACTION_ART[f]) img.src = FACTION_ART[f];
  });
}

// Changer le fond selon la faction survolée/sélectionnée
function updateBg(bgId, faction) {
  const bg = document.getElementById(bgId);
  if (!bg) return;
  bg.className = 'setup-screen-bg' + (faction ? ' ' + faction : '');
}

// ── ÉCRAN 0 : Titre → lancement ──────────────────────────────────
document.getElementById('btn-play').addEventListener('click', () => {
  Audio5L.startMusic();
  document.getElementById('setup-title').classList.remove('active');
  document.getElementById('setup-p1').classList.add('active');
});

// ── ÉCRAN 1 : Player 1 ───────────────────────────────────────────
document.querySelectorAll('.fp[data-p="1"]').forEach(fp => {
  const f = fp.dataset.f;
  fp.addEventListener('mouseenter', () => updateBg('bg-p1', f));
  fp.addEventListener('mouseleave', () => updateBg('bg-p1', setupP1));
  fp.addEventListener('click', () => {
    Audio5L.startMusic();
    document.querySelectorAll('.fp[data-p="1"]').forEach(x => x.classList.remove('sel'));
    fp.classList.add('sel');
    setupP1 = f;
    updateBg('bg-p1', f);
    document.getElementById('btn-p1-confirm').disabled = false;
  });
});

document.getElementById('btn-p1-confirm').addEventListener('click', () => {
  if (!setupP1) return;
  document.getElementById('setup-p1').classList.remove('active');
  document.getElementById('setup-p2').classList.add('active');
});

// ── ÉCRAN 2 : Player 2 ───────────────────────────────────────────
document.querySelectorAll('.fp[data-p="2"]').forEach(fp => {
  const f = fp.dataset.f;
  fp.addEventListener('mouseenter', () => updateBg('bg-p2', f));
  fp.addEventListener('mouseleave', () => updateBg('bg-p2', setupP2));
  fp.addEventListener('click', () => {
    document.querySelectorAll('.fp[data-p="2"]').forEach(x => x.classList.remove('sel'));
    fp.classList.add('sel');
    Audio5L.startMusic();
    setupP2 = f;
    updateBg('bg-p2', f);
    const sb = document.getElementById('start-btn');
    sb.disabled = false;
    sb.textContent = `⚔ ${setupP1.toUpperCase()} vs ${setupP2.toUpperCase()}`;
  });
});

document.getElementById('start-btn').addEventListener('click', () => {
  Audio5L.startMusic();
  if (!setupP1 || !setupP2) return;
  const mode = document.querySelector('input[name=mode]:checked').value;
  document.getElementById('setup').style.display = 'none';
  document.getElementById('game').style.display = 'grid';
  initGame(setupP1, setupP2, mode);
});

document.getElementById('mull-confirm').addEventListener('click', confirmMulligan);

document.getElementById('btn-next').addEventListener('click',nextPhase);
document.getElementById('btn-endturn').addEventListener('click',endTurn);

// ── Tiroir du journal de combat (rétractable) ──
(function(){
  const drawer=document.getElementById('log-drawer');
  const toggle=document.getElementById('log-toggle');
  const close=document.getElementById('log-close');
  if(toggle&&drawer) toggle.addEventListener('click',()=>drawer.classList.toggle('open'));
  if(close&&drawer)  close.addEventListener('click',()=>drawer.classList.remove('open'));
})();

// Victory display
function showVictory(winner,faction,turn){
  const v=document.getElementById('victory');
  document.getElementById('vic-title').textContent=`Player ${winner} Wins!`;
  document.getElementById('vic-sub').textContent=`${FE[faction]} ${faction.toUpperCase()} triumphs after turn ${turn}`;
  v.style.display='flex';
}

// ESC / right-click to cancel targeting (keydown 2 — conservé pour cancelTargeting)
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&G&&G.targeting){ cancelTargeting(); }
});
document.addEventListener('contextmenu',e=>{
  if(G&&G.targeting){ e.preventDefault(); cancelTargeting(); }
});

function cancelTargeting(){
  if(!G||!G.targeting) return;
  G.targeting=null;
  G._validTargetSet=null;
  document.body.classList.remove('targeting');
  const hint=document.getElementById('targeting-hint');
  if(hint) hint.style.display='none';
  const canvas=document.getElementById('arrow-canvas');
  if(canvas){ canvas.style.display='none'; }
  renderAll();
}

// Étape 5 : Grande preview au clic droit / double-clic
function showBigPreview(card) {
  const imgSrc = getCardImage(card.id || '');
  if (!imgSrc) return;
  const overlay = document.getElementById('big-preview-overlay');
  document.getElementById('big-preview-img').src = imgSrc;
  const info = [];
  if (card.n) info.push('<strong style="font-family:Cinzel,serif;font-size:18px;color:var(--gold2)">' + card.n + '</strong>');
  if (card.type === 'monster') info.push(
    '<span style="color:#e74c3c">' + (card.cAtk != null ? card.cAtk : card.atk) + '⚔</span> / ' +
    '<span style="color:#3498db">' + (card.cDef != null ? card.cDef : card.def) + '🛡</span>' +
    '  <span style="color:var(--gold)">Coût ' + card.cost + '💎</span>'
  );
  if (card.txt) info.push('<em style="color:var(--text2)">' + card.txt + '</em>');
  document.getElementById('big-preview-info').innerHTML = info.join('<br>');
  overlay.style.display = 'flex';
}


// ══════════════════════════════════════════════════════════════════════════
// TUTORIEL (5.2) — 7 popups contextuels à la première partie. Flag de session
// en mémoire uniquement (R7 : pas de localStorage) : il revient à chaque reload.
// ══════════════════════════════════════════════════════════════════════════
const TUTO = { active: true, seen: new Set(), pending: null };
const TUTO_STEPS = {
  gems:    { n:1, title:'💎 Tes gems',            txt:"Chaque carte coûte des gems (chiffre en haut à gauche). Ton plafond augmente de 1 à chaque ronde. Clique une carte jouable (surbrillance) pour la poser." },
  phases:  { n:2, title:'🔁 Les phases',          txt:'Ton tour : MAIN 1 (poser des cartes) → COMBAT (attaquer) → MAIN 2 (reposer des cartes) → FIN. Avance avec le bouton en bas ou ESPACE.' },
  attack:  { n:3, title:'⚔️ Attaquer',            txt:"En phase de COMBAT, clique un de tes monstres puis sa cible (monstre adverse ou joueur). Une flèche suit ton curseur. Les monstres fraîchement invoqués ne peuvent pas attaquer (sauf Rapide)." },
  protect: { n:4, title:'🛡 Protection',          txt:"L'adversaire a un monstre PROTECTION : tu dois le détruire avant de pouvoir attaquer le joueur directement." },
  cycle:   { n:5, title:'🌌 Le Cycle Céleste',    txt:'Le ciel vient de changer ! À chaque ronde le Cycle avance : Aube → Midi → Crépuscule → Nuit → Ténèbres. Quand TA phase arrive, ta faction débloque son bonus de zénith (affiché dans le bandeau).' },
  facedown:{ n:6, title:'🂠 Dieux face cachée',   txt:"Ce dieu est entré face cachée : c'est un piège qui se déclenchera automatiquement quand sa condition sera remplie. L'adversaire ne sait pas ce que c'est." },
  anytime: { n:7, title:'⚡ Fenêtre ANYTIME',     txt:"L'IA agit — le jeu se met en pause. Tu peux jouer une carte à bordure ORANGE (ANYTIME) en réaction, ou appuyer sur ESPACE pour continuer." },
};
function showTuto(id) {
  if(!TUTO.active || TUTO.seen.has(id)) return;
  if(!G || G.mode !== 'pve') return;
  const step = TUTO_STEPS[id];
  const pop = document.getElementById('tuto-popup');
  if(!step || !pop) return;
  TUTO.seen.add(id);
  document.getElementById('tuto-step').textContent = `TUTORIEL ${step.n}/7`;
  document.getElementById('tuto-title').textContent = step.title;
  document.getElementById('tuto-txt').textContent = step.txt;
  pop.style.display = 'block';
  const ok = document.getElementById('tuto-ok');
  const skip = document.getElementById('tuto-skip');
  if(ok) ok.onclick = () => { pop.style.display = 'none'; };
  if(skip) skip.onclick = () => { TUTO.active = false; pop.style.display = 'none'; };
}

// ══════════════════════════════════════════════════════════════════════════
// MODE ARENA (Phase 4) — porté de feat-gameplay-v2 (draft 40 cartes, pick 1/4,
// difficulté IA progressive) et adapté v5 : PAS de marché, PAS de pouvoirs
// divins. Structure de run façon Slay the Spire : 6 nœuds à embranchements
// (Combat / Élite / Sanctuaire) + 1 Boss à règle cassée. HP de run persistants
// (25 ; duel perdu = −10 ; 0 = run terminée). État en mémoire uniquement.
// ══════════════════════════════════════════════════════════════════════════
let ARENA = null;
let CARD_POOL = null;

const ARENA_DECK_SIZE   = 40;
const ARENA_PICK_SIZE   = 4;
const ARENA_RUN_HP      = 25;
const ARENA_LOSS_DMG    = 10;
const ARENA_NODES       = 6;   // + 1 boss = 7 duels max
const ARENA_SANCT_HEAL  = 5;

// Boss à règles cassées (4.3) — 1 par faction ; boss final tiré HORS faction joueur.
const ARENA_BOSS_DEFS = {
  zeus:        { name:'ZEUS',          faction:'greek',    ruleTxt:'Le Cycle Céleste avance d\'une phase CHAQUE tour.' },
  anubis:      { name:'ANUBIS',        faction:'egyptian', ruleTxt:'Le premier monstre du boss détruit chaque tour revient en jeu.' },
  odin:        { name:'ODIN',          faction:'norse',    ruleTxt:'Le boss commence avec 2 murs Protection 0/4 en jeu.' },
  quetzalcoatl:{ name:'QUETZALCOATL',  faction:'aztec',    ruleTxt:'Tous les monstres du boss ont Endurance.' },
  amaterasu:   { name:'AMATERASU',     faction:'yokai',    ruleTxt:'Le Cycle Céleste est figé sur la NUIT pendant tout le duel.' },
};

function showBossAnnounce(B) {
  let el = document.getElementById('boss-announce');
  if(!el) {
    el = document.createElement('div');
    el.id = 'boss-announce';
    document.body.appendChild(el);
  }
  el.innerHTML = `<div class="boss-an-inner"><div class="boss-an-crown">👑</div>
    <div class="boss-an-name">${B.name}</div>
    <div class="boss-an-rule">${B.ruleTxt}</div></div>`;
  el.style.display = 'flex';
  setTimeout(() => { el.style.display = 'none'; }, 3200);
}

// ── Pool complet & draft ─────────────────────────────────────────────────
function buildCardPool() {
  if(CARD_POOL) return CARD_POOL;
  const pool = [];
  for(const f of FACTIONS) {
    for(const m of (MONSTERS[f]||[])) pool.push({...m, type:'monster', faction:f});
    for(const g of (GODS[f]||[]))     pool.push({...g, type:g.type||'god', faction:f});
  }
  CARD_POOL = pool;
  return pool;
}

// Tire ARENA_PICK_SIZE cartes DISTINCTES (doublons entre picks OK). Garantit
// ≥1 carte de la faction choisie par pick (deck cohérent → run gagnable).
function arenaDraw4(pool, chosenFaction) {
  const picks = [], used = new Set();
  let guard = 0;
  while (picks.length < ARENA_PICK_SIZE && guard < 2000) {
    guard++;
    const c = pool[Math.floor(rng() * pool.length)];
    if (used.has(c.id)) continue;
    used.add(c.id);
    picks.push(c);
  }
  if (chosenFaction && !picks.some(c => c.faction === chosenFaction)) {
    const facPool = pool.filter(c => c.faction === chosenFaction && !used.has(c.id));
    if (facPool.length) {
      const repl = facPool[Math.floor(rng() * facPool.length)];
      picks[Math.floor(rng() * picks.length)] = repl;
    }
  }
  return picks;
}

// Valeur d'une carte pour le draft IA (stats + mots-clés + bonus faction choisie).
let ARENA_FACTION_BONUS = 50;
function arenaCardValue(c, chosenFaction) {
  let v = (c.atk || 0) + (c.def || 0);
  const cap = c.cap || '';
  if (c.type === 'god') v += 5;
  if (/\bhit\b/.test(cap)) v += 2;
  if (/protect|endure/.test(cap)) v += 2;
  if (/hurry/.test(cap)) v += 1;
  if (/curse/.test(cap)) v += 1;
  if (/cycle_/.test(cap)) v += 2;            // manipulation du temps = flexible
  if (/entry|exit|combat|token|draw|search|wipe|destroy|copy|revive|reclaim|dmg/.test(cap)) v += 1;
  if (c.faction === chosenFaction) v += ARENA_FACTION_BONUS;
  return v;
}
function arenaAIPick(options, chosenFaction) {
  let best = 0, bv = -Infinity;
  options.forEach((c, i) => { const v = arenaCardValue(c, chosenFaction); if (v > bv) { bv = v; best = i; } });
  return best;
}
function arenaAIDraft(chosenFaction, nPicks) {
  const pool = buildCardPool();
  const deck = [];
  for (let i = 0; i < (nPicks || ARENA_DECK_SIZE); i++) {
    const opts = arenaDraw4(pool, chosenFaction);
    deck.push({ ...opts[arenaAIPick(opts, chosenFaction)] });
  }
  return deck;
}

// ── Carte de run (4.2, Slay the Spire) ───────────────────────────────────
// Génère 6 nœuds de 2-3 options + le boss. Le boss est tiré hors faction joueur.
function arenaGenMap(playerFaction) {
  const map = [];
  for(let i = 1; i <= ARENA_NODES; i++) {
    const opts = ['combat'];
    if(rng() < 0.55 || i === 3) opts.push('elite');
    if(rng() < 0.55 || i === 2 || i === 5) opts.push('sanctuaire');
    map.push(opts.slice(0, 3));
  }
  const bossIds = Object.keys(ARENA_BOSS_DEFS).filter(b => ARENA_BOSS_DEFS[b].faction !== playerFaction);
  map.push(['boss:' + bossIds[Math.floor(rng() * bossIds.length)]]);
  return map;
}

// Difficulté d'un duel selon la progression (0 facile · 1 normal · 2 élite/boss).
function arenaNodeDifficulty(nodeIdx, kind) {
  if(kind === 'boss') return 2;
  let d = nodeIdx <= 2 ? 0 : 1;
  if(kind === 'elite') d += 1;
  return Math.min(2, d);
}

function arenaStart() {
  ARENA = {
    faction: null,
    deck: null,
    runHP: ARENA_RUN_HP,
    node: 0,            // index du prochain nœud (0-based ; ARENA_NODES = boss)
    map: null,
    wins: 0, losses: 0,
    _pendingPicks: 0,
  };
  arenaSelectFaction();
}

// ── Sélection de faction (réutilise le pattern .fp du setup) ─────────────
function arenaSelectFaction() {
  document.querySelectorAll('.setup-screen').forEach(sc => sc.classList.remove('active'));
  const screen = document.getElementById('arena-faction');
  const grid = document.getElementById('arena-faction-grid');
  if(!screen || !grid) return;
  grid.innerHTML = FACTIONS.map(f => `
    <div class="fp ${f}" data-f="${f}">
      <div class="fp-bg-wrap"><img class="fp-bg" src="${FACTION_ART[f]||''}" alt="${f}"></div>
      <div class="fp-overlay"><span class="fp-name">${f.charAt(0).toUpperCase()+f.slice(1)}</span><span class="fp-style">${FE[f]||''}</span></div>
    </div>`).join('');
  grid.querySelectorAll('.fp').forEach(fp => {
    fp.addEventListener('click', () => {
      if(typeof Audio5L!=='undefined') Audio5L.startMusic();
      ARENA.faction = fp.dataset.f;
      arenaStartDraft();
    });
  });
  screen.classList.add('active');
}

// ── Draft humain : 40 picks de 1 carte sur 4 ────────────────────────────
function arenaStartDraft() {
  ARENA.deck = [];
  ARENA._pool = buildCardPool();
  document.querySelectorAll('.setup-screen').forEach(sc => sc.classList.remove('active'));
  const screen = document.getElementById('arena-draft');
  if(screen) screen.classList.add('active');
  const maxEl = document.getElementById('draft-count-max');
  if(maxEl) maxEl.textContent = ARENA_DECK_SIZE;
  const idEl = document.getElementById('draft-identity');
  if(idEl) idEl.innerHTML = `<span style="color:${FC[ARENA.faction]||'var(--gold)'}">${FE[ARENA.faction]||''} ${(ARENA.faction||'').toUpperCase()}</span>`;
  arenaRenderPick();
}

function arenaKeywords(c) {
  const cap = c.cap || '', kw = [];
  if(/\bhit\b/.test(cap)) kw.push('Double atk');
  if(/protect/.test(cap)) kw.push('Protection');
  if(/endure/.test(cap)) kw.push('Endurance');
  if(/hurry/.test(cap)) kw.push('Rapide');
  if(/curse/.test(cap)) kw.push('Malédiction');
  if(/esquive/.test(cap)) kw.push('Esquive');
  if(/cycle_/.test(cap)) kw.push('Temps');
  if(/entry/.test(cap)) kw.push('Entrée');
  if(/exit/.test(cap)) kw.push('Sortie');
  if(/ritual/.test(cap)) kw.push('Rituel');
  if(c.type === 'god') kw.unshift('Dieu');
  return kw.slice(0, 4);
}

function arenaCardHTML(c, idx) {
  const img = getCardImage(c.id || '');
  const col = FC[c.faction] || 'var(--gold)';
  const isMonster = c.type === 'monster';
  const kw = arenaKeywords(c).map(k => `<span class="dc-kw">${k}</span>`).join('');
  const art = img
    ? `<img src="${img}" alt="${c.n}" loading="lazy">`
    : `<div class="art-placeholder"><span class="ap-icon">${c.type==='god'?'⚡':FE[c.faction]||'★'}</span><span class="ap-name">${c.n}</span><span class="ap-soon">illustration à venir</span></div>`;
  return `<div class="draft-card" data-i="${idx}" data-faction="${c.faction}" style="--fcol:${col}">
    <div class="dc-art">${art}<span class="dc-cost">${c.cost}💎</span></div>
    <div class="dc-band">${c.n}</div>
    <div class="dc-faction">${FE[c.faction]||''} ${(c.faction||'').toUpperCase()}${c.type==='god'?' · DIEU':''}</div>
    ${isMonster ? `<div class="dc-stats"><span class="dc-atk">${c.atk}⚔</span><span class="dc-def">${c.def}🛡</span></div>` : `<div class="dc-stats dc-god">⚡ Pouvoir divin</div>`}
    <div class="dc-kws">${kw}</div>
    <div class="dc-txt">${c.txt || ''}</div>
  </div>`;
}

function arenaRenderPick() {
  if(ARENA.deck.length >= ARENA_DECK_SIZE) {
    // Draft terminé → génère la carte de run et l'affiche.
    ARENA.map = arenaGenMap(ARENA.faction);
    arenaShowMap();
    return;
  }
  const opts = arenaDraw4(ARENA._pool, ARENA.faction);
  ARENA._currentPick = opts;
  const cur = document.getElementById('draft-count-cur'); if(cur) cur.textContent = ARENA.deck.length;
  const fill = document.getElementById('draft-bar-fill'); if(fill) fill.style.width = (100*ARENA.deck.length/ARENA_DECK_SIZE)+'%';
  const cont = document.getElementById('draft-picks');
  if(cont){
    cont.innerHTML = opts.map((c,i)=>arenaCardHTML(c,i)).join('');
    cont.querySelectorAll('.draft-card').forEach(el=>{
      const i = +el.dataset.i;
      el.addEventListener('click', ()=>{ if(typeof Audio5L!=='undefined' && Audio5L.sfx.draw) Audio5L.sfx.draw(); arenaPick(i); });
    });
  }
}

function arenaPick(i) {
  const c = ARENA._currentPick && ARENA._currentPick[i];
  if(!c) return;
  ARENA.deck.push({ ...c });
  // Picks de récompense en cours de run (1 après Combat, 2 après Élite)
  if(ARENA._pendingPicks > 0) {
    ARENA._pendingPicks--;
    if(ARENA._pendingPicks > 0) { arenaRenderReward(); return; }
    arenaShowMap(); return;
  }
  const cont = document.getElementById('draft-picks');
  const el = cont && cont.querySelector(`.draft-card[data-i="${i}"]`);
  if(el){ el.classList.add('picked'); }
  setTimeout(arenaRenderPick, 160);
}

// ── Carte de run : écran de choix du prochain nœud ──────────────────────
function arenaShowMap() {
  document.querySelectorAll('.setup-screen').forEach(sc => sc.classList.remove('active'));
  ['arena-between','arena-end'].forEach(id => { const e=document.getElementById(id); if(e) e.style.display='none'; });
  const setupEl = document.getElementById('setup'); if(setupEl) setupEl.style.display = '';
  const gameEl = document.getElementById('game'); if(gameEl) gameEl.style.display = 'none';
  const screen = document.getElementById('arena-map');
  if(!screen) return;
  screen.classList.add('active');

  const hpEl = document.getElementById('am-hp');
  if(hpEl) hpEl.innerHTML = `❤️ <b>${ARENA.runHP}</b> / ${ARENA_RUN_HP} HP de run`;
  const progEl = document.getElementById('am-progress');
  if(progEl) {
    progEl.innerHTML = ARENA.map.map((node, i) => {
      const isBoss = node[0].startsWith('boss:');
      const cls = i < ARENA.node ? 'done' : i === ARENA.node ? 'cur' : '';
      return `<span class="am-node ${cls} ${isBoss?'boss':''}">${isBoss?'👑':(i+1)}</span>`;
    }).join('<span class="am-link"></span>');
  }

  const node = ARENA.map[ARENA.node];
  const optsEl = document.getElementById('am-options');
  if(!optsEl) return;
  const OPT_DEFS = {
    combat:     { icon:'⚔️', name:'COMBAT',     desc:'Adversaire normal · récompense : 1 carte (pick 1 sur 4)' },
    elite:      { icon:'💀', name:'ÉLITE',      desc:'IA +1 difficulté · récompense : 2 cartes' },
    sanctuaire: { icon:'⛩️', name:'SANCTUAIRE', desc:`Soigne ${ARENA_SANCT_HEAL} HP de run OU retire 1 carte du deck` },
  };
  optsEl.innerHTML = node.map(opt => {
    if(opt.startsWith('boss:')) {
      const B = ARENA_BOSS_DEFS[opt.slice(5)];
      return `<div class="am-opt boss" data-opt="${opt}">
        <div class="am-opt-icon">👑</div><div class="am-opt-name">BOSS — ${B.name}</div>
        <div class="am-opt-desc">${B.ruleTxt}</div></div>`;
    }
    const D = OPT_DEFS[opt];
    return `<div class="am-opt ${opt}" data-opt="${opt}">
      <div class="am-opt-icon">${D.icon}</div><div class="am-opt-name">${D.name}</div>
      <div class="am-opt-desc">${D.desc}</div></div>`;
  }).join('');
  optsEl.querySelectorAll('.am-opt').forEach(el => {
    el.addEventListener('click', () => arenaChooseNode(el.dataset.opt));
  });
}

function arenaChooseNode(opt) {
  if(opt === 'sanctuaire') { arenaShowSanctuary(); return; }
  const kind = opt.startsWith('boss:') ? 'boss' : opt;
  const boss = opt.startsWith('boss:') ? opt.slice(5) : null;
  arenaStartDuel(kind, boss);
}

// ── Sanctuaire : soin OU retrait d'une carte ─────────────────────────────
function arenaShowSanctuary() {
  document.querySelectorAll('.setup-screen').forEach(sc => sc.classList.remove('active'));
  const screen = document.getElementById('arena-sanctuary');
  if(!screen) return;
  screen.classList.add('active');
  const healBtn = document.getElementById('as-heal');
  if(healBtn) {
    healBtn.textContent = `💚 Soigner ${ARENA_SANCT_HEAL} HP de run (${ARENA.runHP}/${ARENA_RUN_HP})`;
    healBtn.onclick = () => {
      ARENA.runHP = Math.min(ARENA_RUN_HP, ARENA.runHP + ARENA_SANCT_HEAL);
      addLog('⛩️ Sanctuaire — HP de run soignés.','heal');
      arenaAdvanceNode();
    };
  }
  const listEl = document.getElementById('as-cards');
  if(listEl) {
    const sorted = ARENA.deck.map((c,i)=>({c,i})).sort((a,b)=>(a.c.cost-b.c.cost)||(a.c.n>b.c.n?1:-1));
    listEl.innerHTML = sorted.map(({c,i}) => `<div class="sum-litem as-removable" data-i="${i}" style="border-left-color:${FC[c.faction]||'#888'}">
      <span class="sum-lcost">${c.cost}</span><span class="sum-lname">${c.n}</span>
      <span class="sum-ltag">${c.type==='god'?'⚡':FE[c.faction]||''}</span></div>`).join('');
    listEl.querySelectorAll('.as-removable').forEach(el => {
      el.addEventListener('click', () => {
        const i = +el.dataset.i;
        const removed = ARENA.deck.splice(i, 1)[0];
        addLog(`⛩️ Sanctuaire — ${removed ? removed.n : 'carte'} retirée du deck.`,'event');
        arenaAdvanceNode();
      });
    });
  }
}

function arenaAdvanceNode() {
  ARENA.node++;
  arenaShowMap();
}

// ── Duel ─────────────────────────────────────────────────────────────────
function arenaStartDuel(kind, boss) {
  ARENA._duelKind = kind;
  const difficulty = arenaNodeDifficulty(ARENA.node + 1, kind);
  const oppFaction = boss
    ? ARENA_BOSS_DEFS[boss].faction
    : FACTIONS[Math.floor(rng() * FACTIONS.length)];

  document.querySelectorAll('.setup-screen').forEach(sc => sc.classList.remove('active'));
  const setupEl = document.getElementById('setup'); if(setupEl) setupEl.style.display = 'none';
  const gameEl = document.getElementById('game'); if(gameEl) gameEl.style.display = 'grid';

  initGame(ARENA.faction, oppFaction, 'pve', { customDeck: ARENA.deck, difficulty, boss });
  arenaUpdateHUD();
}

function arenaUpdateHUD() {
  const hud = document.getElementById('arena-hud');
  if(!hud) return;
  if(!ARENA) { hud.style.display = 'none'; return; }
  hud.style.display = 'flex';
  const m = document.getElementById('ah-match');
  if(m) m.textContent = ARENA.node >= ARENA_NODES ? 'BOSS' : `Nœud ${ARENA.node + 1}/${ARENA_NODES + 1}`;
  const hp = document.getElementById('ah-runhp'); if(hp) hp.textContent = `❤️ ${ARENA.runHP}`;
  const w = document.getElementById('ah-w'); if(w) w.textContent = ARENA.wins;
  const l = document.getElementById('ah-l'); if(l) l.textContent = ARENA.losses;
}

// Fin de duel (hook depuis checkVictory). winner = 1 (joueur) | 2 (IA).
function arenaOnDuelEnd(winner) {
  if(!ARENA || ARENA._duelOver) return;
  ARENA._duelOver = true;
  const playerWon = winner === 1;
  const wasBoss = ARENA._duelKind === 'boss';
  if(playerWon) ARENA.wins++;
  else { ARENA.losses++; ARENA.runHP -= ARENA_LOSS_DMG; }
  arenaUpdateHUD();

  setTimeout(() => {
    ARENA._duelOver = false;
    const hud = document.getElementById('arena-hud'); if(hud) hud.style.display = 'none';
    const gameEl = document.getElementById('game'); if(gameEl) gameEl.style.display = 'none';
    const setupEl = document.getElementById('setup'); if(setupEl) setupEl.style.display = '';

    if(ARENA.runHP <= 0) { arenaShowEnd(false); return; }       // run terminée
    if(wasBoss && playerWon) { arenaShowEnd(true); return; }     // CHAMPION
    if(wasBoss && !playerWon) { arenaShowMap(); return; }        // retente le boss (HP de run en moins)

    if(playerWon) {
      // Récompense : 1 pick (combat) ou 2 picks (élite), puis nœud suivant.
      ARENA._pendingPicks = ARENA._duelKind === 'elite' ? 2 : 1;
      ARENA.node++;
      arenaRenderReward();
    } else {
      arenaAdvanceNode();
    }
  }, 1100);
}

// Récompense post-duel : pick 1 sur 4 (réutilise l'écran de draft).
function arenaRenderReward() {
  document.querySelectorAll('.setup-screen').forEach(sc => sc.classList.remove('active'));
  const screen = document.getElementById('arena-draft');
  if(screen) screen.classList.add('active');
  const idEl = document.getElementById('draft-identity');
  if(idEl) idEl.innerHTML = `<span style="color:var(--gold-bright)">🎁 RÉCOMPENSE — choisis ${ARENA._pendingPicks} carte${ARENA._pendingPicks>1?'s':''}</span>`;
  const cur = document.getElementById('draft-count-cur'); if(cur) cur.textContent = ARENA.deck.length;
  const maxEl = document.getElementById('draft-count-max'); if(maxEl) maxEl.textContent = ARENA.deck.length + ARENA._pendingPicks;
  const fill = document.getElementById('draft-bar-fill'); if(fill) fill.style.width = '100%';
  const opts = arenaDraw4(buildCardPool(), ARENA.faction);
  ARENA._currentPick = opts;
  const cont = document.getElementById('draft-picks');
  if(cont){
    cont.innerHTML = opts.map((c,i)=>arenaCardHTML(c,i)).join('');
    cont.querySelectorAll('.draft-card').forEach(el=>{
      const i = +el.dataset.i;
      el.addEventListener('click', ()=>arenaPick(i));
    });
  }
}

// ── Fin de run ───────────────────────────────────────────────────────────
function arenaShowEnd(champion) {
  document.querySelectorAll('.setup-screen').forEach(sc => sc.classList.remove('active'));
  const scr = document.getElementById('arena-end');
  if(!scr){ location.reload(); return; }
  scr.classList.toggle('champion', champion);
  scr.classList.toggle('eliminated', !champion);
  const icon = document.getElementById('ae-icon'); if(icon) icon.textContent = champion ? '🏆' : '☠️';
  const title = document.getElementById('ae-title'); if(title) title.textContent = champion ? 'CHAMPION' : 'ÉLIMINÉ';
  const sub = document.getElementById('ae-sub');
  if(sub) sub.textContent = champion
    ? `Le Boss est tombé — ${ARENA.wins} victoires, ${ARENA.losses} défaite${ARENA.losses>1?'s':''}.`
    : `La run s'achève : ${ARENA.wins} victoire${ARENA.wins>1?'s':''} / ${ARENA.losses} défaites.`;
  const recap = document.getElementById('ae-recap');
  if(recap){
    const byF = {}; FACTIONS.forEach(f=>byF[f]=0);
    (ARENA.deck||[]).forEach(c=>{ byF[c.faction]=(byF[c.faction]||0)+1; });
    const facLine = FACTIONS.filter(f=>byF[f]>0)
      .map(f=>`<span style="color:${FC[f]}">${FE[f]} ${byF[f]}</span>`).join('&nbsp;&nbsp;');
    recap.innerHTML = `<div class="ae-recap-row"><span class="ae-recap-lbl">Panthéon</span>
        <span style="color:${FC[ARENA.faction]||'var(--gold)'}">${FE[ARENA.faction]||''} ${(ARENA.faction||'').toUpperCase()}</span></div>
      <div class="ae-recap-row"><span class="ae-recap-lbl">Score</span><span><b style="color:#7be084">${ARENA.wins}V</b> / <b style="color:#e8736a">${ARENA.losses}D</b></span></div>
      <div class="ae-recap-row"><span class="ae-recap-lbl">Deck final</span><span>${facLine}</span></div>`;
  }
  if(typeof Audio5L!=='undefined' && Audio5L.sfx) (champion ? Audio5L.sfx.victory() : Audio5L.sfx.defeat());
  scr.style.display = 'flex';
  const replay = document.getElementById('ae-replay');
  if(replay) replay.onclick = () => location.reload();
}

// ── Branchements écran-titre (4.4) ───────────────────────────────────────
(function(){
  const bRules = document.getElementById('btn-rules');
  if(bRules) bRules.addEventListener('click', () => {
    const m = document.getElementById('rules-modal');
    if(m) m.style.display = 'flex';
  });
  const bArena = document.getElementById('btn-arena');
  if(bArena) bArena.addEventListener('click', () => {
    if(typeof Audio5L!=='undefined') Audio5L.startMusic();
    document.getElementById('setup-title').classList.remove('active');
    arenaStart();
  });
})();

// Test automatique des images (5.3) — les illustrations sont des FICHIERS
// (./assets/cards/...), plus du base64 : on compte les IDs résolus vers un
// chemin ; les cartes sans mapping affichent le placeholder volontaire.
function testImages() {
  let ok = 0, placeholders = [];
  const allIds = [
    ...Object.values(MONSTERS).flat().map(m => m.id),
    ...Object.values(GODS).flat().map(g => g.id),
  ];
  for (const id of allIds) {
    const src = getCardImage(id);
    if (src) ok++;
    else placeholders.push(id);
  }
  console.log(`Images mappées : ${ok}/${allIds.length} (+${placeholders.length} placeholders volontaires)`);
  if (placeholders.length) console.info('Placeholders (illustration à venir) :', placeholders.join(', '));
  return { ok, placeholders };
}
window.addEventListener('load', testImages);



