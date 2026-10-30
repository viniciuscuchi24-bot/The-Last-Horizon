/*
 * ============================================================================
 *  04-state.js — ESTADO DA PARTIDA, JOGADOR E ITENS
 * ============================================================================
 *  S        → dinheiro, cota, dias, lua atual, sucata guardada na nave...
 *  player   → posição, vida, fôlego, inventário (4 espaços)
 *  Itens    → cada sucata/ferramenta é um objeto {def, value, mesh...}
 *  makeNoise() → avisa as criaturas que caçam pelo som (ex: Farejador)
 * ============================================================================
 */

const S = {
  credits: CONFIG.START_CREDITS,
  quota: CONFIG.START_QUOTA,
  quotaIndex: 0,           // quantas cotas já foram batidas
  soldThisQuota: 0,
  daysLeft: CONFIG.DEADLINE_DAYS,
  routeMoon: 'ferrugem',   // pra onde a nave vai quando puxar a alavanca
  moon: null,              // lua atual (objeto de MOONS) quando pousado
  weather: {},             // clima sorteado de cada lua pro dia de hoje
  phase: 'orbit',          // 'orbit' | 'moon' | 'transition'
  dayTime: 0,              // segundos desde as 08:00
  shipDoorOpen: false,
  shipItems: [],           // {item, lx, ly, lz} itens guardados no chão da nave
  pendingDeliveries: ['lanterna'], // ferramentas compradas (aparecem na nave) — começa com uma lanterna grátis
  discovered: new Set(),   // criaturas escaneadas (bestiário)
  stats: {daysSurvived:0, scrapCollected:0, deaths:0},
  apparatusTaken: false,
  powerOn: true,
  warnedLeaving: false,
  deadThisDay: false,
};
function rollWeather(){
  MOONS.forEach(m=>{ S.weather[m.id] = pick(m.weathers); });
  // o clima ruim é mais raro: 45% de chance de virar "Limpo"
  MOONS.forEach(m=>{ if(m.weathers.includes('none') && GR()<0.45) S.weather[m.id]='none'; });
}
rollWeather();

let player = {
  pos: new THREE.Vector3(0,0,0), yaw: Math.PI/2, pitch: 0,
  vy: 0, airY: 0, grounded: true, crouch: false, sprinting: false, moving: false,
  vel: new THREE.Vector2(), // velocidade horizontal (pra Sentinela)
  hp: CONFIG.PLAYER.maxHp, stamina: 1, exhausted: false,
  inFacility: false, alive: true,
  slot: 0, inv: new Array(CONFIG.INVENTORY_SLOTS).fill(null),
  stepTimer: 0, eyeY: CONFIG.PLAYER.eye, camY: 0,
  latched: null,           // Lacrador grudado na cabeça
  grabbedBy: null,         // criatura segurando o jogador (Sósia/Colosso)
  stunned: 0, hurtFlash: 0, invuln: 0,
  lastHitTime: 0, regenDelay: 0,
  sinceGrounded: 0,
};
const localPlayer = player; // o jogador DESTE computador (player pode apontar pra outro durante a IA no multiplayer)
function heldItem(){ return player.inv[player.slot]; }
function carriedWeight(){ return player.inv.reduce((s,it)=>s+(it?it.def.lb||0:0),0); }
function holdingTwoHanded(){ const h = heldItem(); return h && h.def.twoHanded; }

// ---------------------------------------------------------------------------
//  ITENS
// ---------------------------------------------------------------------------
let worldItems = [];   // itens soltos no nível atual (no chão)
let _itemUid = 1;
function makeScrapItem(def, valueMul=1){
  const v = Math.round(randInt(def.min, def.max)*valueMul);
  return {uid:_itemUid++, kind:'scrap', def, value:v, mesh:null, inFacility:false, pos:new THREE.Vector3(), onShip:false};
}
function makeToolItem(toolId){
  const def = TOOLS[toolId];
  const it = {uid:_itemUid++, kind:'tool', def, value:0, mesh:null, inFacility:false, pos:new THREE.Vector3(), onShip:false};
  if(def.battery) it.battery = def.battery;
  if(def.charges) it.charges = def.charges;
  if(def.uses) it.uses = def.uses;
  if(def.gun) it.shells = def.gun.shells;
  it.on = false;
  return it;
}
function itemDisplayName(it){ return it.def.name; }

function buildItemMesh(it){
  const cat = it.kind==='tool' ? 'tools' : 'scrap';
  const g = makeVisual(cat, it.def.id, ()=> (it.kind==='tool' && TOOL_MODELS[it.def.id]) ? TOOL_MODELS[it.def.id]() : shapeMesh(it.def.shape || {t:'box', s:[0.3,0.3,0.3], c:'#888'}));
  g.userData.item = it;
  g.traverse(o=>{ if(o.isMesh) o.userData.item = it; });
  it.mesh = g;
  return g;
}
// coloca o item no chão do nível
function placeItemInWorld(it, x, y, z, inFacility){
  if(!it.mesh || !it.mesh.parent) buildItemMesh(it);
  it.pos.set(x, y, z); it.inFacility = !!inFacility;
  it.mesh.position.set(x, y, z);
  it.mesh.rotation.set(0, GR()*Math.PI*2, 0);
  it.mesh.scale.setScalar(1);
  addToLevel(it.mesh);
  if(!worldItems.includes(it)) worldItems.push(it);
  it.onShip = isInsideShip(x, z) && !inFacility;
}
function removeItemFromWorld(it){
  worldItems = worldItems.filter(w=>w!==it);
  if(it.mesh && it.mesh.parent) it.mesh.parent.remove(it.mesh);
  it.onShip = false;
}

// ---------------------------------------------------------------------------
//  BARULHO (criaturas que ouvem: Farejador)
// ---------------------------------------------------------------------------
let noiseEvents = []; // {x,z,loud,t,inFacility}
function makeNoise(x, z, loud, inFacility){
  noiseEvents.push({x, z, loud, t:0, inFacility:!!inFacility});
  if(typeof NET!=='undefined' && NET.mode==='client') netSend({t:'act', a:'noise', x, z, loud, inF:!!inFacility});
}
function tickNoise(dt){ noiseEvents.forEach(n=>n.t+=dt); noiseEvents = noiseEvents.filter(n=>n.t<0.6); }

// ---------------------------------------------------------------------------
//  DANO
// ---------------------------------------------------------------------------
function damagePlayer(amount, cause, sourcePos){
  if(player!==localPlayer){ if(typeof netDamageRemote==='function') netDamageRemote(player, amount, cause, false); return; }
  if(!player.alive || S.phase!=='moon') return;
  if(player.invuln > 0) return;
  player.hp -= amount;
  player.hurtFlash = 1;
  player.regenDelay = 6;
  sfx('hurt');
  if(sourcePos){ // empurrãozinho
    const dx = player.pos.x-sourcePos.x, dz = player.pos.z-sourcePos.z, d = Math.hypot(dx,dz)||1;
    moveEntity(player.pos, dx/d*0.4, dz/d*0.4, CONFIG.PLAYER.radius, player.inFacility);
  }
  if(player.hp <= 0){ player.hp = 0; killPlayer(cause || 'Ferimentos'); }
}
function killPlayer(cause){
  if(player!==localPlayer){ if(typeof netDamageRemote==='function') netDamageRemote(player, 999, cause, true); return; }
  if(!player.alive) return;
  player.alive = false;
  sfx('kill');
  onPlayerDeath(cause); // definido em 11-flow.js
}

// ---------------------------------------------------------------------------
//  MULTIPLAYER: no cliente, ações que mudam o mundo viram pedidos pro host
// ---------------------------------------------------------------------------
function isNetClient(){ return typeof NET!=='undefined' && NET.mode==='client'; }
function isNetHost(){ return typeof NET!=='undefined' && NET.mode==='host'; }
function netRelay(a, payload={}){ if(!isNetClient()) return false; netSend(Object.assign({t:'act', a}, payload)); return true; }
