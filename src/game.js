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
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
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
  };
  for (const [id, faction] of Object.entries(FACTION_MAP)) {
    const filename = id.toLowerCase().replace(/-/g,'').replace(/_/g,'');
    B64_IMAGES[id] = `./assets/cards/${faction}/${filename}.jpeg`;
    B64_IMAGES[id.charAt(0) + id.slice(1).toLowerCase()] = `./assets/cards/${faction}/${filename}.jpeg`;
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
  {id:'BAKENEKO',n:'Bakeneko',atk:3,def:3,cost:3,cap:'entry_sleep',txt:'Entry: Put 1 Monster to sleep (2 turns)'},
  {id:'BAKU',n:'Baku',atk:4,def:5,cost:4,cap:'entry_sleep',txt:'Entry: Put 1 Monster to sleep (2 turns)'},
  {id:'KAPPA',n:'Kappa',atk:2,def:3,cost:2,cap:'entry_sleep',txt:'Entry: Put 1 Monster to sleep (2 turns)'},
  {id:'KEUKEGEN',n:'Keukegen',atk:5,def:4,cost:4,cap:'hurry',txt:'Hurry'},
  {id:'KITSUNE',n:'Kitsune',atk:3,def:2,cost:3,cap:'hurry',txt:'Hurry'},
  {id:'MUJNINA',n:'Mujnina',atk:2,def:2,cost:1,cap:'exit_sleep',txt:'Exit: Put 1 Monster to sleep'},
  {id:'NAMAZU',n:'Namazu',atk:6,def:6,cost:7,cap:'protect',txt:'Protect'},
  {id:'ONIKUMA',n:'Onikuma',atk:2,def:4,cost:2,cap:'protect',txt:'Protect'},
  {id:'RAIJU',n:'Raiju',atk:5,def:5,cost:5,cap:'protect',txt:'Protect'},
  {id:'RYUU',n:'Ryuu',atk:6,def:4,cost:6,cap:'exit_destroy',txt:'Exit: Destroy 1 Monster or Spell'},
  {id:'TANUKI',n:'Tanuki',atk:2,def:2,cost:1,cap:'hurry',txt:'Hurry'},
  {id:'USHI-ONI',n:'Ushi-Oni',atk:5,def:5,cost:5,cap:'exit_destroy',txt:'Exit: Destroy 1 Monster or Spell'},
],
norse:[
  {id:'DOKKALFAR',n:'Dokkalfar',atk:6,def:3,cost:4,cap:'exit_blind',txt:'Exit: Blind 1 Monster'},
  {id:'DRAUGR',n:'Draugr',atk:2,def:2,cost:1,cap:'exit_draw',txt:'Exit: Draw 1 card'},
  {id:'EITRI',n:'Eitri',atk:2,def:3,cost:2,cap:'protect',txt:'Protect'},
  {id:'FENRIR',n:'Fenrir',atk:5,def:4,cost:5,cap:'endure',txt:'Endure'},
  {id:'HILDISVINI',n:'Hildisvini',atk:5,def:5,cost:5,cap:'protect',txt:'Protect'},
  {id:'IDI',n:'Idi',atk:3,def:3,cost:3,cap:'endure',txt:'Endure'},
  {id:'JORMUNGANDR',n:'Jörmungandr',atk:5,def:6,cost:6,cap:'protect',txt:'Protect'},
  {id:'KRAKEN',n:'Kraken',atk:6,def:5,cost:6,cap:'entry_shield_all',txt:'Entry: +1 Shield to all allies'},
  {id:'LJOSALFAR',n:'Ljosalfar',atk:3,def:5,cost:4,cap:'entry_blind',txt:'Entry: Blind 1 Monster'},
  {id:'RATATOSK',n:'Ratatosk',atk:1,def:3,cost:1,cap:'entry_draw',txt:'Entry: Draw 1 card'},
  {id:'SLEIPNIR',n:'Sleipnir',atk:3,def:3,cost:2,cap:'endure',txt:'Endure'},
  {id:'TANNGRISNIR',n:'Tanngrisnir',atk:4,def:3,cost:3,cap:'entry_buff11',txt:'Entry: +1/+1 all allies'},
],
egyptian:[
  {id:'AANI',n:'Aani',atk:4,def:4,cost:4,cap:'exit_destroy',txt:'Exit: Destroy 1 Monster or Spell'},
  {id:'BABAI',n:'Babaï',atk:6,def:4,cost:5,cap:'entry_shield_all',txt:'Entry: +1 Shield all allies'},
  {id:'BENOU',n:'Benou',atk:2,def:2,cost:1,cap:'hurry',txt:'Hurry'},
  {id:'CRIOSPHINX',n:'Criosphinx',atk:2,def:3,cost:2,cap:'exit_sandup',txt:'Exit: Sand up 1 Monster'},
  {id:'EFRIT',n:'Efrit',atk:5,def:4,cost:4,cap:'entry_dmg3',txt:'Entry: Deal 3 damage to a target'},
  {id:'GOLEM',n:'Golem',atk:6,def:6,cost:6,cap:'endure',txt:'Endure'},
  {id:'LEVIATHAN',n:'Leviathan',atk:4,def:6,cost:6,cap:'hit',txt:'Hit (attacks twice)'},
  {id:'MANTICORE',n:'Manticore',atk:2,def:3,cost:2,cap:'hurry',txt:'Hurry'},
  {id:'ROKH',n:'Rokh',atk:5,def:6,cost:5,cap:'hurry',txt:'Hurry'},
  {id:'SERPOPARD',n:'Serpopard',atk:3,def:4,cost:3,cap:'hit',txt:'Hit (attacks twice)'},
  {id:'SPHINX',n:'Sphinx',atk:2,def:3,cost:2,cap:'hurry',txt:'Hurry'},
  {id:'URAEUS',n:'Uraeus',atk:3,def:5,cost:3,cap:'entry_sandup',txt:'Entry: Sand up 1 Monster'},
],
greek:[
  {id:'CENTAUR',n:'Centaur',atk:3,def:4,cost:2,cap:'protect',txt:'Protect'},
  {id:'CERBERUS',n:'Cerberus',atk:6,def:4,cost:4,cap:'heal',txt:'Heal: damage restores your HP'},
  {id:'CHARYBDE',n:'Charybde',atk:5,def:7,cost:6,cap:'hit',txt:'Hit (attacks twice)'},
  {id:'CHIMERA',n:'Chimera',atk:3,def:2,cost:1,cap:'exit_draw',txt:'Exit: Draw 1 card'},
  {id:'CYCLOP',n:'Cyclop',atk:4,def:4,cost:3,cap:'hit_heal',txt:'Hit + Heal'},
  {id:'GORGON',n:'Gorgon',atk:6,def:6,cost:5,cap:'exit_curse',txt:'Exit: Curse 1 Monster'},
  {id:'HYDRA',n:'Hydra',atk:6,def:5,cost:5,cap:'hit',txt:'Hit (attacks twice)'},
  {id:'MINOTAUR',n:'Minotaur',atk:4,def:5,cost:4,cap:'hit_heal',txt:'Hit + Heal'},
  {id:'SATYR',n:'Satyr',atk:3,def:3,cost:2,cap:'hit',txt:'Hit (attacks twice)'},
  {id:'SCYLLA',n:'Scylla',atk:4,def:4,cost:3,cap:'entry_cancel',txt:'Entry+Anytime: Cancel Monster or Spell'},
  {id:'SIREN',n:'Siren',atk:2,def:3,cost:1,cap:'heal',txt:'Heal: damage restores your HP'},
  {id:'TYPHON',n:'Typhon',atk:6,def:7,cost:6,cap:'entry_curse2',txt:'Entry: Curse 2 Monsters'},
],
aztec:[
  {id:'AHUIZOTL',n:'Ahuizotl',atk:2,def:1,cost:1,cap:'endure',txt:'Endure'},
  {id:'CEUYATL',n:'Ceuyatl',atk:3,def:2,cost:1,cap:'heal',txt:'Heal: damage restores your HP'},
  {id:'CIPACTLI',n:'Cipactli',atk:5,def:7,cost:6,cap:'endure_heal',txt:'Endure + Heal'},
  {id:'HUAY_CHIVO',n:'Huay Chivo',atk:7,def:7,cost:6,cap:'exit_bewitch',txt:'Exit: Bewitch 1 Monster'},
  {id:'IZCAQLLI',n:'Izcaqlli',atk:7,def:5,cost:5,cap:'heal',txt:'Heal: damage restores your HP'},
  {id:'IZCOALT',n:'Izcoalt',atk:5,def:6,cost:5,cap:'entry_bewitch',txt:'Entry: Bewitch 1 Monster'},
  {id:'KAQKOJ',n:'Kaqkoj',atk:3,def:4,cost:3,cap:'endure_heal',txt:'Endure + Heal'},
  {id:'OCELOTL',n:'Ocelotl',atk:4,def:2,cost:2,cap:'hurry',txt:'Hurry'},
  {id:'QUETZAL',n:'Quetzal',atk:6,def:4,cost:4,cap:'hurry',txt:'Hurry'},
  {id:'TEUZAUHTOTOTL',n:'Teuzauhtototl',atk:3,def:2,cost:2,cap:'exit_copy',txt:'Exit: Create a copy (no caps)'},
  {id:'TZI',n:'Tzi',atk:5,def:3,cost:3,cap:'entry_buff_atk',txt:'Entry: +1 ATK all allies'},
  {id:'XIUHCOATL',n:'Xiuhcoatl',atk:6,def:5,cost:4,cap:'endure',txt:'Endure'},
]};

const GODS = {
yokai:[
  {id:'EBISU',n:'Ebisu',cost:1,cap:'god_minus3_draw',txt:'−3 shield 1 Monster + Draw 1'},
  {id:'FUJIN',n:'Fujin',cost:2,cap:'god_cancel_m',txt:'Cancel 1 Monster'},
  {id:'IZANAGI',n:'Izanagi',cost:3,cap:'god_create2',txt:'Create 2 blank 0/2 Protect'},
  {id:'IZANAMI',n:'Izanami',cost:3,cap:'god_equip_return',txt:'Equip: each attack returns opp monster'},
  {id:'RAIJIN',n:'Raijin',cost:2,cap:'god_cancel_s_draw',txt:'Cancel 1 Spell + Draw 1'},
  {id:'SUSANOO',n:'Susanoo',cost:4,cap:'god_susanoo',txt:'Destroy 1 Monster OR all (6 counters)'},
  {id:'TSUKUYOMI',n:'Tsukuyomi',cost:1,cap:'god_sleep',txt:'Put to sleep 1 Monster'},
  {id:'AMATERASU',n:'Amaterasu',cost:4,cap:'god_steal',txt:'Steal 1 Monster temporarily'},
],
norse:[
  {id:'BALDER',n:'Balder',cost:3,cap:'god_balder',txt:'Your monsters: Exit → create 2/2'},
  {id:'FREYA',n:'Freya',cost:1,cap:'god_minus2',txt:'−2 shield 1 Monster'},
  {id:'HEIMDALL',n:'Heimdall',cost:2,cap:'god_cancel_ms',txt:'Cancel 1 Monster or Spell'},
  {id:'LOKI',n:'Loki',cost:3,cap:'god_swap',txt:'Swap ally ↔ opponent monster'},
  {id:'ODIN',n:'Odin',cost:4,cap:'god_odin',txt:'Equalize monster counts'},
  {id:'THOR',n:'Thor',cost:4,cap:'god_thor',txt:'Opponent sacrifices 1 Monster'},
  {id:'TYR',n:'Tyr',cost:2,cap:'god_blank11',txt:'Opp monster → 1/1 blank'},
  {id:'VIDAR',n:'Vidar',cost:1,cap:'god_blind_draw',txt:'Blind 1 Monster + Draw 1'},
],
egyptian:[
  {id:'AMUNRA',n:'Amun-Ra',cost:4,cap:'god_force_attack',txt:'Force opp monster to attack another'},
  {id:'ANUBIS',n:'Anubis',cost:3,cap:'god_copy',txt:'Copy a Monster on your field'},
  {id:'HORUS',n:'Horus',cost:2,cap:'god_cancel_ms',txt:'Cancel 1 Monster or Spell'},
  {id:'ISIS',n:'Isis',cost:1,cap:'god_buff3',txt:'+3/+3 to 1 Monster until end of turn'},
  {id:'OSIRIS',n:'Osiris',cost:4,cap:'god_osiris',txt:'Create 3 blank 2/2 (Hurry/Hit/Normal)'},
  {id:'RA',n:'Ra',cost:3,cap:'god_copy',txt:'Copy a Monster on field'},
  {id:'SETH',n:'Seth',cost:1,cap:'god_equip_minus2',txt:'Equip: each attack −2 opp shield'},
  {id:'TOTH',n:'Toth',cost:3,cap:'god_sandup2_draw',txt:'Sand up 2 Monsters + Draw 1'},
],
greek:[
  {id:'APOLLO',n:'Apollo',cost:2,cap:'god_destroy_ms',txt:'Destroy 1 Monster or Spell'},
  {id:'ARES',n:'Ares',cost:2,cap:'fd_cancel_monster',txt:'Face Down: Cancel next opp Monster'},
  {id:'ARTHEMIS',n:'Arthemis',cost:1,cap:'god_buff3',txt:'+3/+3 to 1 Monster until end of turn'},
  {id:'ATHENA',n:'Athena',cost:3,cap:'fd_destroy_attacker',txt:'Face Down: Next opp attack → destroy it'},
  {id:'HADES',n:'Hades',cost:4,cap:'god_steal',txt:'Steal 1 Monster temporarily'},
  {id:'HEPHAISTOS',n:'Hephaistos',cost:1,cap:'fd_blocker',txt:'Face Down: Next attack → create 2/3 blocker'},
  {id:'POSEIDON',n:'Poseidon',cost:4,cap:'god_destroy_ms',txt:'Destroy 1 Monster or Spell'},
  {id:'ZEUS',n:'Zeus',cost:4,cap:'god_minus4_all',txt:'−4 Shield to ALL Monsters'},
],
aztec:[
  {id:'CHALCHIUHTLICUE',n:'Chalchiuhtlicue',cost:2,cap:'god_cancel_ms',txt:'Cancel Monster or Spell'},
  {id:'HUITZILOPOCHTLI',n:'Huitzilopochtli',cost:4,cap:'god_redirect',txt:'Redirect opp attack to another opp'},
  {id:'MAYAHUEL',n:'Mayahuel',cost:2,cap:'god_destroy_ms',txt:'Destroy 1 Monster OR Spell'},
  {id:'MICTLANTECUHTLI',n:'Mictlantecuhtli',cost:1,cap:'god_mutual_sacrifice',txt:'Each player sacrifices 1 Monster'},
  {id:'TEZCATLIPOCA',n:'Tezcatlipoca',cost:3,cap:'god_bewitch_draw',txt:'Bewitch 1 Monster + Draw'},
  {id:'TLALOC',n:'Tlaloc',cost:4,cap:'god_minus4_all',txt:'−4 shield ALL Monsters'},
  {id:'TONATIUH',n:'Tonatiuh',cost:3,cap:'god_resurrect',txt:'Resurrect from YOUR discard'},
  {id:'XIUHTECUHTLI',n:'Xiuhtecuhtli',cost:1,cap:'god_cancel_attack',txt:'Cancel opp attack + gain HP + Draw'},
]};

const SPELLS = {
  yokai:{id:'SPELL_Y',n:'Lancez de Vie',cost:2,cap:'spell_dmg4',txt:'Inflict 4 damage to target',type:'spell'},
  norse:{id:'SPELL_N',n:'Piochez 1',cost:2,cap:'spell_draw3',txt:'Draw 3 then discard 2',type:'spell'},
  egyptian:{id:'SPELL_E',n:'Lancez de Vie',cost:2,cap:'spell_dmg4_sand',txt:'4 damage + Sand up 1',type:'spell'},
  greek:{id:'SPELL_G',n:'Sorts',cost:2,cap:'spell_cancel',txt:'Cancel 1 Monster or Spell',type:'spell'},
  aztec:{id:'SPELL_A',n:'Lancez de Vie',cost:2,cap:'spell_dmg4_bewitch',txt:'4 damage + Bewitch 1',type:'spell'},
};

// =====================================================
// GAME STATE
// =====================================================
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
  const ms = MONSTERS[faction].map(m => newCard({...m, type:'monster'}));
  const gs = GODS[faction].map(g => newCard({...g, type:'god'}));
  const sp = [0,1,2].map(() => newCard({...SPELLS[faction]}));
  let deck = [...ms, ...gs, ...sp];
  return shuffle(deck).slice(0,20);
}

function shuffle(a) {
  const r=[...a];
  for(let i=r.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[r[i],r[j]]=[r[j],r[i]];}
  return r;
}

function initGame(f1, f2, mode) {
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
  };
  for(let p=1;p<=2;p++){
    const f = p===1?f1:f2;
    const deck = buildDeck(f);
    G.players[p] = {
      id: p,
      faction: f,
      hp: 25,
      maxGems: 1,
      gems: 1,
      field: [],
      hand: deck.splice(0, p===1?4:5),
      deck,
      graveyard: [],
      attacked: new Set(),
      summoned: new Set(),
      golems: [],
      balderActive: false,
    };
  }
  G.activeTurn = 1; // Player 1 starts
  addLog('⚔ Battle begins!', 'event');
  renderAll();
  applyBattlefieldArt(f1, f2);
  if(G.mode==='pve' && G.cp===2) setTimeout(aiTurn, 800);
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
  if(G.log.length>80) G.log.pop();
}

// =====================================================
// GAME FLOW
// =====================================================
const PHASES = ['Main1','Combat','Main2','End'];
const PHASE_LABELS = {Main1:'MAIN 1',Combat:'COMBAT',Main2:'MAIN 2',End:'END'};
const PHASE_NAMES = PHASE_LABELS; // backwards compat

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
  if(G.cp===1) G.turn++;
  G.phase='Main1';
  G.selAtk=null;

  const NP = G.players[G.cp];
  NP.maxGems = Math.min(6, (NP.maxGems || 0) + 1);
  NP.gems = NP.maxGems;
  Audio5L.sfx.mana();
  NP.attacked = new Set();
  NP.summoned = new Set();
  G.actions = 1;
  // Auto-draw
  if(NP.deck.length > 0) { NP.hand.push(NP.deck.shift()); Audio5L.sfx.draw(); }
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
const ANYTIME_CAPS_SET = new Set(["god_cancel_m","god_cancel_s_draw","god_cancel_ms","god_sleep","god_minus3_draw","god_minus2","god_blind_draw","god_buff3","god_blank11","god_steal","god_redirect","god_cancel_attack","fd_cancel_spell","fd_cancel_monster","fd_destroy_attacker","fd_blocker","fd_resurrect","fd_copy_monster","fd_minus4_all","fd_curse_draw"]);

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
  P.field.push(m);
  const idx = P.field.length-1;
  P.summoned.add(idx);
  addLog(`Player ${p} summons ${m.n} (${m.cAtk}⚔/${m.cDef}🛡)`,'summon');

  // Check face-down Greek gods triggered by monster entry
  checkFaceDownTrigger(opp, 'monster_entry', m, p);

  await applyEntry(p, idx, m);
}

async function applyEntry(p, idx, m) {
  const opp = p===1?2:1;
  const cap = m.cap||'';

  if(cap.includes('entry_dmg3')) {
    const oppField = G.players[opp].field.filter(x=>x&&!x.faceDown);
    if(oppField.length>0) {
      const tgt = oppField.reduce((a,b)=> (a.cDef<=b.cDef?a:b));
      tgt.cDef -= 3;
      addLog(`${m.n} — 3 damage to ${tgt.n}`,'dmg');
      if(tgt.cDef<=0) await handleDeath(opp, tgt);
    } else {
      G.players[opp].hp -= 3;
      addLog(`${m.n} — 3 damage to Player ${opp}`,'dmg');
    }
  }
  if(cap.includes('entry_sleep')) await pickTarget('sleep', p, true);
  if(cap.includes('entry_blind')) await pickTarget('blind', p, true);
  if(cap.includes('entry_draw') && !cap.includes('exit')) { drawCard(p); addLog(`${m.n} — Draw 1`,'buff'); }
  if(cap.includes('entry_curse2')) {
    const oppField = G.players[opp].field.filter(x=>x&&!x.faceDown);
    let cnt=0;
    for(const x of oppField) { if(cnt<2){ x.cursed=true; cnt++; addLog(`${x.n} CURSED!`,'debuff'); } }
  }
  if(cap.includes('entry_sandup')) await pickTarget('sandup', p, true);
  if(cap.includes('entry_shield_all')) {
    G.players[p].field.forEach((x,i) => { if(x && i!==idx) { x.cDef++; } });
    addLog(`${m.n} — +1 shield all allies`,'buff');
  }
  if(cap.includes('entry_buff11')) {
    G.players[p].field.forEach((x,i) => { if(x && i!==idx) { x.cAtk++; x.cDef++; } });
    addLog(`${m.n} — +1/+1 all allies`,'buff');
  }
  if(cap.includes('entry_buff_atk')) {
    G.players[p].field.forEach((x,i) => { if(x && i!==idx) { x.cAtk++; } });
    addLog(`${m.n} — +1 ATK all allies`,'buff');
  }
  if(cap.includes('entry_bewitch')) await pickTarget('bewitch', p, true);
  if(cap.includes('entry_freeplay2')) {
    const pi = G.players[p].hand.findIndex(c=>c.type==='monster'&&c.cost<=2);
    if(pi>=0) {
      const free = G.players[p].hand.splice(pi,1)[0];
      addLog(`${m.n} — Plays ${free.n} for free!`,'event');
      await playMonster(free, p);
    }
  }
  if(cap.includes('entry_freespell2')) {
    const pi = G.players[p].hand.findIndex(c=>c.type==='spell'&&c.cost<=2);
    if(pi>=0) {
      const free = G.players[p].hand.splice(pi,1)[0];
      addLog(`${m.n} — Plays ${free.n} for free!`,'event');
      await applySpellEffect(free, p);
      G.players[p].graveyard.push(free);
    }
  }
  if(cap.includes('entry_draw_exit_draw')) { drawCard(p); addLog(`${m.n} — Draw 1`,'buff'); }
  if(cap.includes('entry_cancel')) await pickTarget('cancel_ms', p, true);
}

async function applyExit(p, m) {
  const opp = p===1?2:1;
  const cap = m.cap||'';
  if(cap.includes('exit_sleep')) await pickTarget('sleep', p, false);
  if(cap.includes('exit_destroy')) await pickTarget('destroy', p, false);
  if(cap.includes('exit_blind')) await pickTarget('blind', p, false);
  if(cap.includes('exit_curse')) await pickTarget('curse', p, false);
  if(cap.includes('exit_draw')) { drawCard(p); addLog(`${m.n} Exit — Draw 1`,'buff'); }
  if(cap.includes('exit_sandup')) await pickTarget('sandup', p, false);
  if(cap.includes('exit_bewitch')) await pickTarget('bewitch', p, false);
  if(cap.includes('exit_copy')) {
    const P = G.players[p];
    if(P.field.length<6) {
      const copy = newCard({...m, cap:'', txt:'(copy, no capacity)'});
      copy.cAtk=m.atk; copy.cDef=m.def;
      P.field.push(copy);
      addLog(`${m.n} Exit — Creates a copy!`,'event');
    }
  }
  if(cap.includes('exit_freeplay')) {
    const P = G.players[p];
    if(P.hand.length>0) {
      const ri = Math.floor(Math.random()*P.hand.length);
      const free = P.hand.splice(ri,1)[0];
      addLog(`${m.n} Exit — Plays ${free.n} for free!`,'event');
      if(free.type==='monster') await playMonster(free, p);
      else { await applySpellEffect(free, p); P.graveyard.push(free); }
    }
  }
  if(cap.includes('entry_draw_exit_draw')) { drawCard(p); addLog(`${m.n} Exit — Draw 1`,'buff'); }
}

// =====================================================
// DEATH HANDLING
// =====================================================
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

  Audio5L.sfx.death();
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
async function playGod(c, p) {
  addLog(`Player ${p} plays God: ${c.n}!`,'summon');
  const cap = c.cap||'';
  const opp = p===1?2:1;

  if(cap.startsWith('fd_')) {
    // Face-down Greek god
    const m = newCard({...c, faceDown:true});
    G.players[p].field.push(m);
    G.players[p].summoned.add(G.players[p].field.length-1);
    addLog(`${c.n} enters Face Down`,'event');
    return;
  }

  if(cap==='god_minus3_draw') { await pickTarget('minus3',p,false); drawCard(p); addLog(`Draw 1`,'buff'); }
  else if(cap==='god_cancel_m') {
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
  }
  else if(cap==='god_create2') {
    for(let i=0;i<2&&G.players[p].field.length<6;i++) {
      const t=newCard({id:'T',n:'0/2 Protect',atk:0,def:2,cost:0,type:'monster',cap:'protect',txt:'Protect'});
      t.cAtk=0;t.cDef=2; G.players[p].field.push(t);
    }
    addLog(`Izanagi — 2 blank 0/2 Protect tokens`,'event');
  }
  else if(cap==='god_equip_return') {
    await pickTarget('equip_return', p, false, c);
  }
  else if(cap==='god_cancel_s_draw') {
    const stackS = G.stack && G.stack.find(s=>s.type==='spell');
    if(stackS) {
      G.stack = G.stack.filter(s=>s.type!=='spell');
      addLog(`${c.n} — ${stackS.card.n} COUNTERED!`,'special');
    } else if(G.lastPlayedSpell) {
      addLog(`${c.n} — ${G.lastPlayedSpell.n} cancelled`,'special'); G.lastPlayedSpell=null;
    } else { addLog(`${c.n} — No spell to counter`,'special'); }
    drawCard(p);
  }
  else if(cap==='god_susanoo') { await pickTarget('destroy', p, false); }
  else if(cap==='god_sleep') { await pickTarget('sleep', p, false); }
  else if(cap==='god_steal') { await pickTarget('steal', p, false); }
  else if(cap==='god_balder') {
    G.players[p].balderActive=true;
    G.players[p].field.forEach(m=>{ if(m) m.balder=true; });
    addLog(`Balder — Your monsters create 2/2 on death!`,'buff');
    G.players[p].graveyard.push(c); return;
  }
  else if(cap==='god_minus2') { await pickTarget('minus2', p, false); }
  else if(cap==='god_cancel_ms') {
    if(G.stack && G.stack.length>0) {
      const entry=G.stack[0]; G.stack=[];
      addLog(`${c.n} — ${entry.card.n} COUNTERED!`,'special');
    } else { addLog(`${c.n} — Nothing on stack to counter`,'special'); }
  }
  else if(cap==='god_swap') { await pickTarget('swap', p, false); }
  else if(cap==='god_odin') {
    const my=G.players[p].field.length, op=G.players[opp].field.length;
    if(my>op) { for(let i=0;i<my-op;i++) { const m=G.players[p].field.pop(); G.players[p].graveyard.push(m); addLog(`Odin — You sacrifice ${m.n}`); } }
    else if(op>my) { for(let i=0;i<op-my;i++) { const m=G.players[opp].field.shift(); G.players[opp].graveyard.push(m); addLog(`Odin — Opp sacrifices ${m.n}`); } }
    addLog(`Odin — Fields equalized!`,'event');
  }
  else if(cap==='god_thor') {
    if(G.players[opp].field.length>0) {
      const m=G.players[opp].field.shift(); G.players[opp].graveyard.push(m);
      addLog(`Thor — Opponent sacrifices ${m.n}!`,'event');
    }
  }
  else if(cap==='god_blank11') { await pickTarget('blank11', p, false); }
  else if(cap==='god_blind_draw') { await pickTarget('blind', p, false); drawCard(p); }
  else if(cap==='god_force_attack') { await pickTarget('force_attack', p, false); }
  else if(cap==='god_copy') { await pickTarget('copy', p, false); }
  else if(cap==='god_buff3') { await pickTarget('buff3', p, false); }
  else if(cap==='god_osiris') {
    const specs=[{cap:'hurry',txt:'Hurry'},{cap:'hit',txt:'Hit'},{cap:'',txt:'Normal'}];
    specs.forEach(s=>{
      if(G.players[p].field.length<6){
        const t=newCard({id:'T',n:`2/2 ${s.txt}`,atk:2,def:2,cost:0,type:'monster',cap:s.cap,txt:s.txt});
        t.cAtk=2;t.cDef=2; G.players[p].field.push(t);
      }
    });
    addLog(`Osiris — 3 blank 2/2 Monsters!`,'event');
  }
  else if(cap==='god_equip_minus2') { await pickTarget('equip_seth', p, false, c); return; }
  else if(cap==='god_sandup2_draw') { await pickTarget('sandup', p, false); await pickTarget('sandup', p, false); drawCard(p); addLog(`Toth — Draw 1`,'buff'); }
  else if(cap==='god_mutual_sacrifice') {
    for(let pl=1;pl<=2;pl++) {
      if(G.players[pl].field.length>0) {
        const m=G.players[pl].field.shift(); G.players[pl].graveyard.push(m);
        addLog(`${c.n} — P${pl} sacrifices ${m.n}`,'event');
      }
    }
  }
  else if(cap==='god_bewitch_draw') { await pickTarget('bewitch', p, false); drawCard(p); }
  else if(cap==='god_minus4_all') {
    [1,2].forEach(pl=>G.players[pl].field.forEach(m=>{if(m){m.cDef=Math.max(0,m.cDef-4);}}));
    addLog(`${c.n} — −4 shield ALL!`,'dmg');
    await checkAllDeaths();
  }
  else if(cap==='god_resurrect') {
    const grave=G.players[p].graveyard.filter(x=>x.type==='monster');
    if(grave.length>0&&G.players[p].field.length<6){
      const m=grave[grave.length-1];
      G.players[p].graveyard.splice(G.players[p].graveyard.lastIndexOf(m),1);
      m.cAtk=m.atk;m.cDef=m.def;m.endureUsed=false;m.cursed=false;
      G.players[p].field.push(m);
      addLog(`${c.n} — ${m.n} resurrected!`,'event');
    }
  }
  else if(cap==='god_cancel_attack') { addLog(`${c.n} — Attack cancelled! +HP`,'special'); G.players[p].hp=Math.min(25,G.players[p].hp+3); drawCard(p); }
  else if(cap==='god_redirect') { await pickTarget('redirect', p, false); }
  else if(cap==='god_destroy_ms') { await pickTarget('destroy', p, false); }

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

async function applySpellEffect(c, p) {
  const cap = c.cap||'';
  if(cap==='spell_dmg4'||cap==='spell_dmg4_sand'||cap==='spell_dmg4_bewitch') {
    await pickTarget('spell4dmg', p, false, c);
    if(cap==='spell_dmg4_sand') await pickTarget('sandup', p, false);
    if(cap==='spell_dmg4_bewitch') await pickTarget('bewitch', p, false);
  }
  else if(cap==='spell_draw3') {
    drawCard(p); drawCard(p); drawCard(p);
    // discard 2 (just auto-discard last 2 for AI, prompt for human)
    if(G.cp===p && G.mode==='pvp' || (G.mode==='pve'&&p===1)) {
      const P=G.players[p];
      if(P.hand.length>7) { const d=P.hand.splice(7); d.forEach(x=>P.graveyard.push(x)); }
    } else {
      const P=G.players[p]; while(P.hand.length>7){P.graveyard.push(P.hand.pop());}
    }
    addLog(`Draw 3, discard to 7`,'buff');
  }
  else if(cap==='spell_cancel') {
    if(G.stack && G.stack.length>0) {
      const entry=G.stack[0]; G.stack=[];
      addLog(`${c.n} — ${entry.card.n} COUNTERED!`,'special');
    } else { addLog(`${c.n} — Nothing to counter`,'special'); }
  }
}

// =====================================================
// COMBAT
// =====================================================
async function doAttack(attackerP, attackerIdx, targetP, targetIdx, isSecondStrike=false) {
  const AP = G.players[attackerP];
  const DP = G.players[targetP];
  const atk = AP.field[attackerIdx];
  if(!atk) return;

  const atkVal = atk.cAtk;
  const hasHit = (atk.cap||'').includes('hit');
  const hasHeal = (atk.cap||'').includes('heal');

  const performStrike = async () => {
    // Blind: random target
    let finalTargetIdx = targetIdx;
    if(atk.blinded && targetIdx !== 'player') {
      const allTargets = DP.field.map((m,i)=>m&&!m.faceDown?i:null).filter(i=>i!==null);
      if(allTargets.length > 1) {
        finalTargetIdx = allTargets[Math.floor(Math.random()*allTargets.length)];
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
      // UX #4: flash HP bar on direct damage
      const hpbar = document.getElementById(`p${targetP}-hpbar`);
      if(hpbar) { hpbar.style.boxShadow='inset 0 0 20px rgba(231,76,60,0.9)'; setTimeout(()=>{hpbar.style.boxShadow='';},400); }
      if(hasHeal) { Audio5L.sfx.heal(); AP.hp=Math.min(25,AP.hp+atkVal); addLog(`Heal — P${attackerP} +${atkVal} HP`,'heal'); }
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
      const retDmg = def.cursed ? 0 : retVal;
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

      if(def.cDef<=0) await handleDeath(targetP, def);
      if(atk.cDef<=0) await handleDeath(attackerP, atk);
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
      if(attackerP===2 && G.mode==='pve') {
        const newTarget = pickAITarget(targetP);
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
  // If AI turn, auto-pick
  if(p===2 && G.mode==='pve') {
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
      if(w===1) Audio5L.sfx.victory(); else Audio5L.sfx.defeat();
      document.getElementById('vic-title').textContent=`Player ${w} Wins!`;
      document.getElementById('vic-sub').textContent=`${G.players[w].faction} triumphs after turn ${G.turn}`;
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
}

function hideReactionBanner() {
  const banner = document.getElementById('reaction-banner');
  if (banner) banner.style.display = 'none';
}

function resolveReaction() {
  if (window._resolveReaction) window._resolveReaction();
}

async function aiTurn() {
  if(!G||G.cp!==2||aiThinking) return;
  aiThinking=true;

  addLog(`── AI thinking... ──`,'phase');
  renderAll();

  // Main1 phase
  G.phase='Main1';
  handlePhaseStart(2);
  renderAll();
  await delay(300);

  await aiMainPhase();

  // Combat phase
  G.phase='Combat';
  renderAll();
  Audio5L.combatMode();
  await delay(300);
  await aiCombatPhase();

  // Main2 phase
  G.phase='Main2';
  handlePhaseStart(2);
  Audio5L.menuMode();
  renderAll();
  await delay(200);

  await aiMainPhase();

  // End phase
  G.phase='End';
  renderAll();
  await delay(300);

  aiThinking=false;
  doEndTurn();
}

async function aiMainPhase() {
  const P = G.players[2];
  let played = true;

  let safety = 0;
  while (played && safety < 12) {
    safety++;
    played = false;
    const playable = P.hand
      .map((c, i) => ({ c, i, score: scoreCard(c, 2) }))
      .filter(x => x.c.cost <= P.gems)
      .sort((a, b) => b.score - a.score);

    if (playable.length > 0 && P.gems > 0) {
      const best = playable[0];
      addLog(`AI joue : ${best.c.n}`, 'summon');
      P.gems -= best.c.cost;
      P.hand.splice(best.i, 1);

      if (best.c.type === 'monster')      await playMonster(best.c, 2);
      else if (best.c.type === 'god')     await playGod(best.c, 2);
      else                                await playSpell(best.c, 2);

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
    if(cap.includes('entry_sandup')  && oppField.length > 0) score += 4;
    if(cap.includes('entry_bewitch') && oppField.length > 0) score += 4;
    if(cap.includes('entry_buff11')  && myField.length > 0)  score += myField.length * 1.8;
    if(cap.includes('entry_buff_atk')&& myField.length > 0)  score += myField.length * 1.2;
    if(cap.includes('entry_shield_all') && myField.length > 0) score += myField.length;
    if(cap.includes('entry_cancel')  && oppField.length > 0) score += 5;
    if(cap.includes('entry_draw'))   score += 2.5;

    // Exit effects: more valuable when field is already contested
    if(cap.includes('exit_destroy') && oppField.length > 0) score += 4;
    if(cap.includes('exit_curse')   && oppField.length > 0) score += 3;

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
    if(cap.includes('bewitch_draw') && oppField.length > 0) score += 5;
    if(cap.includes('sandup') && oppField.length > 0)  score += 4;
    if(cap.includes('balder') && myField.length > 1)   score += 4;
    if(cap.includes('osiris') && P.field.length <= 2)  score += 7;
    if(cap.includes('odin'))  score += (board < -1 ? 7 : 2);
    if(cap.includes('create2') && P.field.length <= 3) score += 4;
    if(cap.includes('resurrect')) {
      const hasDead = P.graveyard.some(c => c.type === 'monster');
      score += hasDead ? 7 : -5;
    }
    if(cap.includes('mutual_sacrifice')) {
      score += (oppField.length > P.field.filter(m=>m&&!m.faceDown).length ? 6 : 1);
    }
    if(cap.includes('cancel_attack')) score += 4;

    // General: gods with no valid targets are worthless
    const needsTarget = ['minus','destroy','steal','sleep','buff','blank','blind','bewitch','sandup','force','thor'];
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

async function aiCombatPhase() {
  const P   = G.players[2];
  const OP  = G.players[1];
  const opp = 1;

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
  const oppHasProtect = OP.field.some(m => m && (m.cap||'').includes('protect') && !m.faceDown && !m.asleep);
  const totalAtk = attackers.reduce((s,{m}) => s + (m.cAtk||0), 0);

  if(!oppHasProtect && totalAtk >= OP.hp) {
    addLog('🎯 AI détecte une victoire — tout en face !', 'special');
    for(const {m,i} of attackers) {
      if(!G.players[2].field[i]) continue;
      if(m.bewitched && Math.random() < 0.5) { P.attacked.add(i); continue; }
      addLog(`${m.n} attaque le joueur directement !`, 'dmg');
      renderAll();
      await waitForPlayerAck(m, 'attack');
      if(!G.players[2].field[i]) continue;
      await doAttack(2, i, opp, 'player');
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
    if(!G.players[2].field[i]) continue;
    if(G.players[2].attacked.has(i)) continue;

    if(m.bewitched) {
      if(Math.random() < 0.5) {
        addLog(`${m.n} envoûté — rate son attaque !`, 'debuff');
        P.attacked.add(i);
        continue;
      }
    }

    const target = pickAITarget(opp);
    if(target === null) break;

    addLog(`${m.n} se prépare à attaquer...`, 'combat');
    renderAll();

    await waitForPlayerAck(m, 'attack');
    if(!G.players[2].field[i]) continue;

    await doAttack(2, i, opp, target);
    renderAll();
    await new Promise(r => setTimeout(r, 450));

    if(checkVictoryBool()) break;
  }
}

function pickAITarget(targetP) {
  const TP = G.players[targetP];
  const AP = G.players[2];

  // Monsters that haven't attacked yet
  const myAttackers = AP.field
    .map((m,i) => ({m,i}))
    .filter(({m,i}) => m && !m.faceDown && !m.asleep && !m.sanded && !AP.attacked.has(i));

  const alive = TP.field.map((m,i)=>({m,i})).filter(x => x.m && !x.m.faceDown && !x.m.asleep);
  const hasProtect = alive.some(x => (x.m.cap||'').includes('protect'));

  // ── LETHAL CHECK: can remaining attackers kill the player? ──────
  const totalRemainingAtk = myAttackers.reduce((s,{m}) => s + (m.cAtk||0), 0);
  if(!hasProtect && totalRemainingAtk >= TP.hp) {
    addLog('🎯 AI vise le coup fatal !', 'special');
    return 'player';
  }

  // ── Must attack Protect first ───────────────────────────────────
  if(hasProtect) {
    const prot = alive.find(x => (x.m.cap||'').includes('protect'));
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

  if(type==='sleep'||type==='sandup'||type==='blank11'||type==='destroy'||type==='curse'||type==='bewitch'||type==='minus3'||type==='minus2') {
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
  sand:        {icon:"⏳", name:"Sanded",      desc:"Cannot attack next turn"},
  sleep:       {icon:"💤", name:"Sleep",       desc:"Face down and untouchable — wakes up 2 opponent turns later"},
  curse:       {icon:"💀", name:"Cursed",      desc:"Only 1 damage is enough to destroy this monster"},
  bewitch:     {icon:"🌀", name:"Bewitched",   desc:"Must flip a coin before attacking — tails means no attack"},
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
  if(card.bewitched) add('bewitch');
  if(card.blinded) add('blind');

  return badges;
}

function showCardPreview(card, anchorEl) {
  if (!card) return;
  // Ne pas bloquer pendant le targeting
  const imgSrc = getCardImage(card.id || '');
  const isMonster = card.type === 'monster';

  const sp = document.getElementById('side-preview');
  if (!sp) return;

  const imgEl = document.getElementById('spv-img');
  if (imgSrc) {
    imgEl.src = imgSrc;
    imgEl.style.display = 'block';
  } else {
    imgEl.style.display = 'none';
    imgEl.src = '';
  }

  document.getElementById('spv-name').textContent = card.n || card.name || '';

  const costBadge = document.getElementById('spv-cost-badge');
  if (costBadge) costBadge.textContent = (card.cost != null ? card.cost : '') + ' 💎';

  if (isMonster) {
    document.getElementById('spv-stats').innerHTML =
      '<span style="color:#e74c3c">' + (card.cAtk ?? card.atk ?? 0) + '⚔</span>' +
      '  <span style="color:#3498db">' + (card.cDef ?? card.def ?? 0) + '🛡</span>';
  } else {
    document.getElementById('spv-stats').textContent = card.type === 'god' ? '⚡ God' : '✨ Spell';
  }

  const isAnytimeC = isAnytime(card);
  const tagType  = isAnytimeC ? 'anytime' : card.type === 'god' ? 'god' : card.type === 'spell' ? 'spell' : 'monster';
  const tagLabel = isAnytimeC ? '⚡ ANYTIME' : card.type === 'god' ? '⚡ God' : card.type === 'spell' ? '✨ Spell' : '🐉 Monster';
  const tagEl = document.getElementById('spv-tag');
  if (tagEl) { tagEl.className = 'cpv-tag ' + tagType; tagEl.textContent = tagLabel; }

  document.getElementById('spv-txt').textContent = card.txt || card.capText || '';

  const badges = getAbilityBadges(card);
  const abEl = document.getElementById('spv-abilities');
  if (badges.length > 0) {
    abEl.innerHTML = badges.map(b =>
      '<div style="display:flex;align-items:flex-start;gap:5px;padding:4px 6px;background:rgba(255,255,255,.04);border-radius:5px;border:1px solid rgba(255,255,255,.06)">' +
        '<span style="font-size:12px;flex-shrink:0">' + b.icon + '</span>' +
        '<div>' +
          '<span style="font-family:Cinzel,serif;font-size:9px;font-weight:700;color:var(--gold2);display:block;margin-bottom:1px">' + b.name + '</span>' +
          '<span style="font-size:9px;color:#aaa;line-height:1.3;display:block">' + b.desc + '</span>' +
        '</div>' +
      '</div>'
    ).join('');
    abEl.style.display = 'flex';
    abEl.style.flexDirection = 'column';
  } else {
    abEl.style.display = 'none';
    abEl.innerHTML = '';
  }

  sp.style.display = 'flex';
  sp.style.flexDirection = 'column';
}

function hideCardPreview() {
  const sp = document.getElementById('side-preview');
  if(sp) sp.style.display = 'none';
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
  const hasProtect = OP.field.some(m=>m&&(m.cap||'').includes('protect')&&!m.faceDown&&!m.asleep);
  
  // Mark opponent field cards
  document.querySelectorAll(`[data-player="${opp}"]`).forEach(el => {
    const mi = parseInt(el.dataset.idx);
    const m = OP.field[mi];
    if(m && !m.faceDown) el.classList.add('valid-target-dmg');
  });

  // Mark player HP bar as target (if no protect)
  const oppBar = document.getElementById(`p${opp}-bar`);
  if(oppBar && !hasProtect) oppBar.classList.add('targetable');

  // Show hint
  const hint = document.getElementById('targeting-hint');
  hint.style.display = 'block';
  hint.innerHTML = `⚔ <b>${attacker.n}</b> — drag to target or click · <span style="color:#888">ESC to cancel</span>`;
  
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
  hint.innerHTML = `⚡ <b>${card.n}</b> — click target · <span style="color:#888">ESC to cancel</span>`;

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
  hint.innerHTML = '🎯 <b>' + targetTitle(type) + '</b> — click a highlighted target · <span style="color:#888">ESC to cancel</span>';

  startArrow(startPos);
}

function targetTitle(type) {
  const map={sleep:'Put to sleep',sandup:'Sand up (cant attack)',bewitch:'Bewitch',blind:'Blind',curse:'Curse',minus3:'-3 Shield',minus2:'-2 Shield',blank11:'→ 1/1 blank',destroy:'Destroy',buff3:'+3/+3 target',equip_seth:'Equip Seth',equip_return:'Equip Izanami',steal:'Steal',copy:'Copy Monster',force_attack:'Force to attack',swap:'Swap Monster',spell4dmg:'4 Damage target',redirect:'Redirect attack'};
  return map[type]||type;
}

async function applyTargetEffect(type, fromP, idx, card) {
  const m=G.players[fromP].field[idx];
  if(!m) return;
  const p=pendingAction?.p||G.cp;
  const opp=fromP;

  if(type==='sleep') { m.faceDown=true; m.asleep=true; m.sleepTurns=2; addLog(`${m.n} put to sleep!`,'debuff'); }
  else if(type==='sandup') { m.sanded=true; addLog(`${m.n} sanded — can't attack`,'debuff'); }
  else if(type==='bewitch') { m.bewitched=true; addLog(`${m.n} bewitched — must flip coin to attack`,'debuff'); }
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

function renderAll() {
  if(!G) return;
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
    const hasProtect=OP.field.some(m=>m&&(m.cap||'').includes('protect')&&!m.faceDown&&!m.asleep);
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
  if (nameEl) { nameEl.textContent = `P${p} ${emo[P.faction]||''} ${(P.faction||'').toUpperCase()}`; nameEl.style.color = col[P.faction] || '#fff'; }

  const orb = document.getElementById(`p${p}-orb`);
  if (orb) {
    orb.style.background = `radial-gradient(circle at 38% 32%, ${hpColor}dd 0%, ${hpColor}88 45%, ${hpColor}22 100%)`;
    orb.style.color = hpColor;
    orb.style.boxShadow = `0 0 0 2px rgba(255,255,255,0.06), 0 0 0 4px rgba(0,0,0,0.5), 0 0 18px ${hpGlow}, inset 0 3px 10px rgba(255,255,255,0.18), inset 0 -3px 8px rgba(0,0,0,0.5)`;
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
  if (deckEl) deckEl.textContent = `${P.deck ? P.deck.length : 0} cards · ${P.graveyard ? P.graveyard.length : 0} dead`;
}


function renderField(p) {
  const P=G.players[p];
  const isCurrent=p===G.cp;
  const el=document.getElementById(`field${p}`);
  el.innerHTML='';

  if(P.field.filter(m=>m).length===0) {
    el.innerHTML='<div class="empty-field">— Empty Field —</div>';
    return;
  }

  P.field.forEach((m,i)=>{
    if(!m) return;
    const isSelAtk=G.selAtk&&G.selAtk.p===p&&G.selAtk.i===i;
    const canAtk=isCurrent&&G.phase==='Combat'
      &&!P.attacked.has(i)
      &&(!P.summoned.has(i)||((m.cap||'').includes('hurry')))
      &&!m.asleep&&!m.sanded&&!m.faceDown;

    let cls='fcard';
    if(canAtk)     cls+=' can-atk';
    if(isSelAtk)   cls+=' atk-source';
    if(P.attacked.has(i)) cls+=' tapped';
    if(m.faceDown) cls+=' face-down';
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
      if(m.bewitched)     statuses.push('<span class="st bewitch">🌀</span>');
      if(m.sethEquipped)  statuses.push('<span class="st seth">SETH</span>');
      if(m.izanamiEquipped)statuses.push('<span class="st izanami">IZA</span>');

      const capShort=(m.cap||'').replace(/_/g,' ').split(' ').slice(0,2).join(' ')||'—';

      div.innerHTML=`
        <div class="fc-frame">
          <div class="fc-inner">
            <div class="fc-art">
              ${imgSrc
                ?`<img src="${imgSrc}" alt="${m.n}" loading="lazy">`
                :`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:34px">${FE[P.faction]}</div>`
              }
            </div>
            <div class="fc-info">
              ${statuses.length?`<div class="fc-status">${statuses.join('')}</div>`:''}
              <div class="fc-name-band">${m.n}</div>
              <div class="fc-cap-text">${capShort}</div>
            </div>
          </div>
        </div>
        <div class="fc-atk">${m.cAtk}</div>
        <div class="fc-def">${m.cDef}</div>
      `;
    }
    el.appendChild(div);
  });
}

function renderHand() {
  const cp=G.cp;
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
    const canPlay=P.gems>=c.cost&&(
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
      c.type==='god'?'⚡ God':c.type==='spell'?'✨ Spell':'🐉 Monster';

    div.innerHTML=`
      <div class="hc-art" style="position:relative">
        ${imgSrc?`<img src="${imgSrc}" alt="${c.n}" loading="lazy">`:`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:22px;color:var(--brd3)">${c.type==='spell'?'✨':c.type==='god'?'⚡':FE[P.faction]}</div>`}
        <div class="hc-cost-badge">${c.cost}</div>
      </div>
      <div class="hc-name-band">${c.n}</div>
      <div class="hc-bottom">
        <div class="hc-type-row">${typeLabel}</div>
        ${c.type==='monster'?`<div class="hc-stats"><span class="hc-atk">${c.atk}⚔</span><span class="hc-def">${c.def}🛡</span></div>`:''}
        <div class="hc-txt">${c.txt||''}</div>
      </div>
    `;
    el.appendChild(div);
  });
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


function renderLog() {
  document.getElementById('log').innerHTML=
    G.log.map(l=>`<div class="log-e ${l.cls||''}">${l.msg}</div>`).join('');
}

function updateButtons() {
  const isAI=G.mode==='pve'&&G.cp===2;
  const ownTurn=G.cp===G.activeTurn;
  // Bug #9 fix: hide End Turn and Next Phase during reaction window
  const locked=isAI||aiThinking||!ownTurn||G.inReaction;
  const btnNext=document.getElementById('btn-next'); if(btnNext) btnNext.disabled=locked;
  const btnEnd=document.getElementById('btn-endturn'); if(btnEnd) btnEnd.disabled=locked;
  // AI thinking overlay
  const aiOv=document.getElementById('ai-overlay');
  if(aiOv) aiOv.classList.toggle('visible', aiThinking);
}

// ═══════════════════════════════════════════════════════════════════
// FIELD CLICK
// ═══════════════════════════════════════════════════════════════════
function onFieldClick(p,i) {
  if(!G) return;
  if(G.targeting){ resolveTarget({type:'field',p,i}); return; }
  if(G.mode==='pve'&&G.cp===2) return;
  const cp=G.cp;
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
  const hasProtect=OP.field.some(m=>m&&(m.cap||'').includes('protect')&&!m.faceDown&&!m.asleep);

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
    const blocked=hasProtect&&!(m.cap||'').includes('protect');
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

document.getElementById('btn-next').addEventListener('click',nextPhase);
document.getElementById('btn-endturn').addEventListener('click',endTurn);

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

// Étape 6 : Test automatique des images
function testImages() {
  let ok = 0, fail = 0, fails = [];
  const allIds = [
    ...Object.values(MONSTERS).flat().map(m => m.id),
    ...Object.values(GODS).flat().map(g => g.id),
  ];
  for (const id of allIds) {
    const src = getCardImage(id);
    if (src && src.startsWith('data:')) ok++;
    else { fail++; fails.push(id); }
  }
  console.log('Images OK: ' + ok + '/' + (ok + fail));
  if (fails.length) console.warn('Missing:', fails);
  return { ok, fail, fails };
}
window.addEventListener('load', () => {
  const r = testImages();
  if (r.fail > 0) console.warn('⚠ ' + r.fail + ' images manquantes:', r.fails);
  else console.log('✅ Toutes les images chargées (' + r.ok + ')');
});



