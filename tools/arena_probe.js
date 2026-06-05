#!/usr/bin/env node
'use strict';
// Probe per-match winrate (joueur p1, deck mono drafté) vs IA CONTROL, selon la
// compensation de départ. Usage : node tools/arena_probe.js [N]
const { loadGameCustom } = require('./sim_core');
const API = loadGameCustom([
  'initGame','aiTurn','seedRNG','checkVictoryBool','setAIProfile',
  'FACTIONS','randomGodAssign','FAITH_WIN','TURN_CAP','rng',
  'arenaAIDraft','setArenaStart','setArenaFactionBonus',
]);
const N = parseInt(process.argv[2]||'80',10);
API.setArenaFactionBonus(50);

async function match(seed, pf, oppProfile){
  API.seedRNG(seed);
  const pfac = API.FACTIONS[seed % 5];
  const deck = API.arenaAIDraft(pfac);
  const ofac = API.FACTIONS[(seed*3+1)%5];
  const god = API.randomGodAssign(pfac);
  API.setArenaStart(5,4,pf,0);
  API.initGame(pfac, ofac, 'sim', { customDeck: deck });
  const G = API.getG();
  G.players[1].god=god.godId; G.players[1].godName=god.godName; G.players[1].godPower=god.godPower;
  API.setAIProfile(1,'CONTROL'); API.setAIProfile(2,oppProfile);
  let g=0;
  while(!API.checkVictoryBool() && G.turn<=50 && g<4000){ g++; await API.aiTurn(G.cp); if(API.checkVictoryBool())break; }
  const f1=G.players[1].faith||0,f2=G.players[2].faith||0;
  if(f1>=API.FAITH_WIN&&f2<API.FAITH_WIN)return 1;
  if(f2>=API.FAITH_WIN&&f1<API.FAITH_WIN)return 0;
  if(G.turn>API.TURN_CAP) return f1>f2?1:0;
  return f1>=f2?1:0;
}

(async()=>{
  for(const prof of ['CONTROL','RUSH','GUARD','RAID']){
    const row=[];
    for(const pf of [0,2,4,6,8]){
      let w=0; for(let i=0;i<N;i++){ w+=await match(9000+i, pf, prof); }
      row.push(`pf${pf}:${(100*w/N).toFixed(0)}%`);
    }
    console.log(prof.padEnd(8), row.join('  '));
  }
})();
