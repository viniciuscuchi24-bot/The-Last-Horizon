/*
 * ============================================================================
 *  12-flow.js — FLUXO DO JOGO: órbita → pouso → dia na lua → decolagem → cota
 * ============================================================================
 *  - Cada decolagem passa 1 dia. Quando o prazo chega a 0 e você decola, a
 *    Empresa avalia a cota: bateu → nova cota maior; não bateu → DEMITIDO
 *    (ejetado no espaço, tudo recomeça).
 *  - Morreu (single player = tripulação toda morta) → perde a sucata da nave.
 *  - Meia-noite → a nave decola sozinha. Quem estiver fora fica pra trás.
 * ============================================================================
 */

let menuOpen = false, transitioning = false, lastWarnHour = 0, stormT = 20, strikeWarn = null;
function currentHour(){ return CONFIG.DAY_START_HOUR + S.dayTime/CONFIG.DAY_LENGTH_SECONDS*(CONFIG.DAY_END_HOUR-CONFIG.DAY_START_HOUR); }
function clockText(){ const h = currentHour(); const hh = Math.floor(h)%24, mm = Math.floor((h%1)*60/5)*5; const ampm = hh<12?'AM':'PM'; const h12 = ((hh+11)%12)+1; return `${h12}:${String(mm).padStart(2,'0')} ${ampm}`; }

function showTransition(text, ms, mid, after){
  transitioning = true;
  const el = document.getElementById('transition');
  el.innerHTML = text; el.style.opacity = 1; el.style.display = 'flex';
  setTimeout(()=>{
    const finish = ()=>{ setTimeout(()=>{ el.style.opacity = 0; setTimeout(()=>{ el.style.display='none'; transitioning = false; if(after) after(); }, 400); }, 200); };
    try{ if(mid){ if(mid.length) mid(finish); else { mid(); finish(); } } else finish(); }
    catch(err){ showError(err); finish(); }
  }, ms);
}

// ----------------------------------------------------------------- órbita
function loadOrbit(){
  clearLevel(); stopAllLoops(); worldItems = []; creatures = []; traps = []; thrown = []; noiseEvents = [];
  FAC.doors = null; FAC.walk = null; FAC.webs = [];
  S.phase = 'orbit'; S.moon = null; ENTR.main = null; ENTR.fire = null;
  setOrbitLighting();
  heightFn = ()=>-1000; worldBounds = {minX:-8, maxX:8, minZ:-5, maxZ:5};
  S.shipDoorOpen = false;
  buildShip(0, -0.6, 0, true);
  skyStars = makeStars(); skyStars.material.opacity = 1; addToLevel(skyStars);
  // planeta lá embaixo (a lua da rota)
  const m = MOONS.find(x=>x.id===S.routeMoon) || MOONS[0];
  const planet = new THREE.Mesh(new THREE.SphereGeometry(60, 32, 24), new THREE.MeshStandardMaterial({color:m.look.ground, roughness:1, emissive:new THREE.Color(m.look.ground).multiplyScalar(0.15)}));
  planet.position.set(-150, -40, 20); addToLevel(planet);
  placePlayer(SHIP.x+1, SHIP.floorY, SHIP.z, Math.PI/2, false);
  updateShipMonitor(); updateHud();
  musicPlay();
}
function placePlayer(x, y, z, yaw, inFacility){
  player.pos.set(x, y, z); player.yaw = yaw; player.pitch = 0; player.vy = 0; player.airY = 0; player.grounded = true;
  player.inFacility = inFacility; player.camY = y + CONFIG.PLAYER.eye;
}

// ----------------------------------------------------------------- alavanca
function leverPrompt(){
  if(S.phase==='orbit'){ const m = MOONS.find(x=>x.id===S.routeMoon); return `[E] Puxar alavanca: pousar em ${m?m.name:'?'}`; }
  if(S.phase==='moon') return '[E] Puxar alavanca: decolar';
  return '';
}
function pullLever(){
  if(transitioning) return;
  if(typeof NET!=='undefined' && NET.mode==='client'){ netSend({t:'act', a:'lever'}); sfx('lever'); return; }
  sfx('lever', {x:SHIP.x-5.7, z:SHIP.z});
  SHIP.lever.rotation.z = -0.5; setTimeout(()=>{ if(SHIP.lever) SHIP.lever.rotation.z = 0.5; }, 900);
  if(S.phase==='orbit'){ const m = MOONS.find(x=>x.id===S.routeMoon); if(!m){ toast('Defina uma rota no terminal'); return; } landOn(m); }
  else if(S.phase==='moon'){ takeOff('lever'); }
}

// ----------------------------------------------------------------- pouso
// gerador de números aleatórios com semente: a mesma semente gera a MESMA lua
// (é assim que todos os jogadores do multiplayer veem o mesmo mapa)
function seededRandom(seed){ let a = seed>>>0; return ()=>{ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function withSeed(seed, fn){ const orig = _grFn; _grFn = seededRandom(seed); try{ return fn(); } finally { _grFn = orig; } }
function landOn(moon, seed){
  if(transitioning) return;
  if(seed===undefined) seed = Math.floor(GR()*1e9);
  S.levelSeed = seed;
  if(typeof netOnLand==='function') netOnLand(moon, seed);
  musicStop(); sfx('engine');
  const w = S.weather[moon.id];
  showTransition(`<div><div style="font-size:1.6em;color:${CONFIG.HUD_COLOR}">POUSANDO EM ${moon.name.toUpperCase()}</div><div style="opacity:.7;margin-top:10px">Clima: ${WEATHERS[w].name}${moon.company?'':' — Risco '+moon.risk}</div></div>`, 1400,
    done=>{ buildMoonLevel(moon, done, seed); },
    ()=>{ S.shipDoorOpen = true; sfx('shipDoor', {x:SHIP.x+3.5, z:SHIP.z+3.3}); addShake(0.35); if(!moon.company) toast(`${clockText()} — Sucata à vista. Boa sorte.`); else toast('Coloque a sucata no balcão e toque o sino.'); });
}
function buildMoonLevel(moon, done, seed=1){
  clearLevel(); stopAllLoops(); worldItems = []; creatures = []; traps = []; thrown = []; noiseEvents = []; decals = [];
  FAC.doors = null; FAC.walk = null; FAC.webs = []; ENTR.main = null; ENTR.fire = null;
  S.moon = moon; S.phase = 'moon'; S.dayTime = 0; S.apparatusTaken = false; S.powerOn = true; S.deadThisDay = false; S.warnedLeaving = false;
  stormT = rand(15,30); strikeWarn = null; rainPoints = null;
  skyStars = makeStars(); addToLevel(skyStars);
  const after = (info)=>withSeed(seed+7, ()=>{
    const sp = info.ship;
    const gy = sp.y!==undefined ? sp.y : heightFn(sp.x, sp.z);
    buildShip(sp.x, gy, sp.z, false);
    if(!moon.company){
      generateFacility(moon);
      spawnScrap(moon);
      spawnTraps(moon);
      resetSpawnDirector(moon);
    }
    const w = S.weather[moon.id];
    if(w==='rain' || w==='storm'){ buildRain(); loopStart('rain', buildRainLoop); }
    loopStart('wind', buildWindLoop);
    placePlayer(SHIP.x-3.5, SHIP.floorY, SHIP.z+0.5, -Math.PI/2, false);
    updateOutdoorLighting(currentHour());
    updateShipMonitor(); updateHud();
    if(typeof netAfterBuild==='function') netAfterBuild();
    done && done();
  });
  if(moon.company) after(withSeed(seed, ()=>buildCompanyExterior()));
  else if(moon.terrain==='model') buildModelExterior(moon, after);
  else after(withSeed(seed, ()=>buildProcExterior(moon)));
}
function spawnScrap(moon){
  const n = randInt(moon.scrap.count[0], moon.scrap.count[1]);
  const spots = FAC.scrapSpots.filter(s=>FAC.walk[tIdx(s.i,s.j)] && !FAC.block[tIdx(s.i,s.j)] && !FAC.doorAt[tIdx(s.i,s.j)]);
  const used = new Set();
  for(let k=0;k<n && spots.length;k++){
    const s = spots.splice(randInt(0,spots.length-1),1)[0];
    const key = s.i+','+s.j; if(used.has(key)) continue; used.add(key);
    const p = tileCenter(s.i, s.j);
    const def = pick(SCRAP);
    placeItemInWorld(makeScrapItem(def, moon.scrap.valueMul), p.x+rand(-0.4,0.4), 0, p.z+rand(-0.4,0.4), true);
  }
  // chaves pras portas trancadas
  for(let k=0;k<Math.max(0, FAC.lockedCount);k++){
    const s = spots.length ? spots.splice(randInt(0,spots.length-1),1)[0] : null; if(!s) break;
    const p = tileCenter(s.i, s.j);
    placeItemInWorld(makeScrapItem(SCRAP_SPECIAL.chave, 1), p.x, 0, p.z, true);
  }
  // o Núcleo de energia
  if(FAC.apparatusItem) placeItemInWorld(FAC.apparatusItem, FAC.apparatusSpot.x, 0.5, FAC.apparatusSpot.z, true);
}

// ----------------------------------------------------------------- decolagem
function takeOff(reason){
  if(transitioning || S.phase!=='moon') return;
  if(typeof NET!=='undefined' && NET.mode==='client') return;
  if(typeof netOnTakeOff==='function') netOnTakeOff(reason);
  const leftBehind = player.alive && !playerInShip();
  if(leftBehind && reason==='midnight'){
    // multiplayer: se alguém está na nave, ela decola mesmo assim e você fica pra trás
    if(isNetHost() && [...NET.peers.values()].some(p=>p.alive && !p.inFacility && isInsideShip(p.pos.x,p.pos.z))){ player.inv = new Array(CONFIG.INVENTORY_SLOTS).fill(null); refreshViewModel(); toast('Você ficou pra trás...'); }
    else { killPlayer('Deixado para trás'); return; }
  }
  S.shipDoorOpen = false;
  snapshotShipItems();
  // itens na mão também vão pra órbita (se o jogador está na nave)
  sfx('engine'); addShake(0.4);
  const moonWasCompany = S.moon && S.moon.company;
  showTransition(`<div><div style="font-size:1.4em;color:${CONFIG.HUD_COLOR}">${reason==='midnight'?'O PILOTO AUTOMÁTICO DECOLOU':'DECOLANDO'}</div><div style="opacity:.7;margin-top:10px">Voltando para a órbita...</div></div>`, 1600,
    ()=>{ endOfDay(); },
    ()=>{ afterOrbitArrive(); });
}
function endOfDay(){
  stopAllLoops();
  S.stats.daysSurvived++;
  S._evaluate = (S.daysLeft === 0);
  if(!S._evaluate) S.daysLeft--;
  rollWeather();
  loadOrbit();
}
function afterOrbitArrive(){
  if(S._evaluate){ S._evaluate = false; evaluateQuota(); }
  else toast(`Faltam ${S.daysLeft} dia(s) para o prazo. Cota: $${S.soldThisQuota}/$${S.quota}`);
  if(typeof autoSave==='function') autoSave();
}
function evaluateQuota(){
  const el = document.getElementById('bigScreen');
  if(S.soldThisQuota >= S.quota){
    const over = S.soldThisQuota - S.quota, bonus = Math.floor(over/5);
    S.credits += bonus; S.quotaIndex++;
    const n = S.quotaIndex;
    const inc = Math.round(100*(1 + n*n/16)*(1 + rand(-0.15, 0.3)));
    const oldQ = S.quota; S.quota += inc; S.soldThisQuota = 0; S.daysLeft = CONFIG.DEADLINE_DAYS;
    if(typeof netBroadcastBig==='function') netBroadcastBig(`<h1 style="color:#8fef6a">COTA ATINGIDA</h1><p>Nova cota: $${S.quota}</p>`);
    showBig(`<h1 style="color:#8fef6a">COTA ATINGIDA</h1><p>Você bateu a cota de $${oldQ}.</p><p>Hora extra: +$${bonus}</p><p style="margin-top:14px">NOVA COTA: <b>$${S.quota}</b><br>Prazo: ${S.daysLeft} dias</p>`, 'Continuar');
  } else {
    if(typeof netBroadcastBig==='function') netBroadcastBig(`<h1 style="color:#ff4a2a">VOCÊS FORAM DEMITIDOS</h1><p>A cota não foi atingida. O host vai recomeçar.</p>`);
    showBig(`<h1 style="color:#ff4a2a">VOCÊ FOI DEMITIDO</h1><p>A cota de $${S.quota} não foi atingida (vendido: $${S.soldThisQuota}).</p><p>A Empresa agradece seus serviços.<br>Você será ejetado em 3... 2... 1...</p><p style="opacity:.6;margin-top:12px">Dias sobrevividos: ${S.stats.daysSurvived} · Cotas batidas: ${S.quotaIndex} · Sucata coletada: ${S.stats.scrapCollected}</p>`, 'Recomeçar', ()=>{ fullReset(); loadOrbit(); if(typeof autoSave==='function') autoSave(); });
    S._fired = true;
  }
  updateShipMonitor(); updateHud();
}
function showBig(html, btn, onClose){
  const el = document.getElementById('bigScreen');
  el.querySelector('.inner').innerHTML = html + `<button id="bigBtn">${btn}</button>`;
  el.style.display = 'flex'; menuOpen = true; document.exitPointerLock && document.exitPointerLock();
  document.getElementById('bigBtn').onclick = ()=>{ el.style.display='none'; menuOpen = false; if(onClose) onClose(); lockPointer(); };
}
function fullReset(){
  S.credits = CONFIG.START_CREDITS; S.quota = CONFIG.START_QUOTA; S.quotaIndex = 0; S.soldThisQuota = 0; S.daysLeft = CONFIG.DEADLINE_DAYS;
  S.shipItems = []; S.pendingDeliveries = ['lanterna']; S.routeMoon = 'ferrugem'; S.stats = {daysSurvived:0, scrapCollected:0, deaths:0};
  player.inv = new Array(CONFIG.INVENTORY_SLOTS).fill(null); player.slot = 0; refreshViewModel();
  rollWeather();
}

// ----------------------------------------------------------------- morte
function onPlayerDeath(cause){
  S.stats.deaths++; S.deadThisDay = true;
  player.latched = null; player.grabbedBy = null; setMuffled(false);
  // o que você carregava cai no chão onde você morreu (outro jogador pode buscar)
  player.inv.forEach((it,k)=>{
    if(!it) return;
    if(it.mesh && it.mesh.parent===viewModel) viewModel.remove(it.mesh);
    const a = k*1.6, x = player.pos.x+Math.cos(a)*0.5, z = player.pos.z+Math.sin(a)*0.5, y = groundAt(x, z, player.inFacility);
    if(isNetClient()) netRelay('drop', {item:serItem(it), x, y, z, inF:player.inFacility});
    else if(S.phase==='moon') placeItemInWorld(it, x, y, z, player.inFacility);
  });
  player.inv = new Array(CONFIG.INVENTORY_SLOTS).fill(null); refreshViewModel();
  document.exitPointerLock && document.exitPointerLock();
  const el = document.getElementById('deathScreen');
  el.querySelector('.cause').textContent = 'Causa da morte: ' + cause;
  el.style.display = 'flex'; postMat.uniforms.blind.value = 0.7;
  setTimeout(()=>{
    el.style.display = 'none'; postMat.uniforms.blind.value = 0;
    // multiplayer: se ainda tem gente viva, você fica assistindo até a nave voltar
    if(typeof netOnLocalDeath==='function' && netOnLocalDeath(cause)) return;
    crewWipe();
  }, 3200);
}
// tripulação inteira morta: perde toda a sucata da nave + multa
function crewWipe(){
  {
    const lost = worldItems.filter(it=>it.kind==='scrap' && isInsideShip(it.pos.x,it.pos.z) && !it.inFacility);
    const lostVal = lost.reduce((s,it)=>s+it.value,0);
    lost.forEach(removeItemFromWorld);
    const fine = Math.floor(S.credits*CONFIG.DEATH_FINE_PERCENT); S.credits -= fine;
    player.alive = true; player.hp = CONFIG.PLAYER.maxHp; player.stamina = 1;
    S.shipDoorOpen = false;
    snapshotShipItems();
    showTransition(`<div><div style="font-size:1.4em;color:#ff4a2a">TODOS OS TRIPULANTES MORRERAM</div><div style="opacity:.8;margin-top:12px">A sucata a bordo foi perdida ($${lostVal}).<br>Multa por perda de funcionário: $${fine}.<br><br>O piloto automático está levando a nave de volta.</div></div>`, 3500,
      ()=>{ endOfDay(); }, ()=>{ afterOrbitArrive(); });
    if(typeof netOnWipe==='function') netOnWipe(lostVal, fine);
  }
}

// ----------------------------------------------------------------- entradas
function useEntrance(kind, entering){
  const E = ENTR[kind];
  if(!E || !E.in || !E.out){ toast('Esta porta está emperrada.'); return; }
  sfx('door');
  const fade = document.getElementById('fade'); fade.style.opacity = 1;
  transitioning = true;
  setTimeout(()=>{
    try{
    if(entering){
      placePlayer(E.in.x, 0, E.in.z, Math.atan2(-E.in.dir.x, -E.in.dir.z), true);
      setFacilityLighting();
    } else {
      if(player.latched) detachLacrador(player.latched);
      const y = groundAt(E.out.x, E.out.z, false);
      placePlayer(E.out.x, y, E.out.z, Math.atan2(-E.out.dir.x, -E.out.dir.z), false);
      updateOutdoorLighting(currentHour());
    }
    // quem estava te agarrando não te segue pela porta
    if(player.grabbedBy && player.grabbedBy.inFacility!==player.inFacility) player.grabbedBy = null;
    sfx('door');
    fade.style.opacity = 0; transitioning = false;
    }catch(err){ showError(err); }
    fade.style.opacity = 0; transitioning = false;
  }, 450);
}

// ----------------------------------------------------------------- venda
function placeOnDesk(){
  const it = heldItem(); if(!it) return;
  if(it.kind!=='scrap'){ toast('A Empresa só compra sucata.'); sfx('error'); return; }
  removeFromInventory(it);
  if(netRelay('desk', {item:serItem(it)})) return;
  const k = SELL_DESK.items.length;
  placeItemInWorld(it, SELL_DESK.x-3.5+(k%10)*0.7, SELL_DESK.y, SELL_DESK.z+(Math.floor(k/10)%2)*0.6-0.3, false);
  it.onDesk = true;
  SELL_DESK.items.push(it);
  sfx('drop', {x:SELL_DESK.x, z:SELL_DESK.z});
}
function ringBell(){
  if(netRelay('bell')) return;
  sfx('bell', {x:3.4, z:-19.2});
  if(!SELL_DESK.items.length){ toast('O balcão está vazio.'); return; }
  const rate = CONFIG.SELL_RATE_BY_DAYS_LEFT[S.daysLeft] ?? 1;
  const items = SELL_DESK.items.splice(0);
  const raw = items.reduce((s,it)=>s+it.value,0), paid = Math.round(raw*rate);
  setTimeout(()=>{
    items.forEach(removeItemFromWorld);
    S.credits += paid; S.soldThisQuota += paid;
    sfx('sell'); toast(`A Empresa pagou $${paid} (${Math.round(rate*100)}% de $${raw}). Cota: $${S.soldThisQuota}/$${S.quota}`);
    updateShipMonitor(); updateHud();
  }, 1200);
}

// ----------------------------------------------------------------- relógio e clima
function updateDay(dt){
  if(S.phase!=='moon' || !S.moon) return;
  if(S.moon.company){ return; }
  S.dayTime += dt;
  const h = currentHour();
  if(h >= CONFIG.WARNING_HOUR && !S.warnedLeaving){ S.warnedLeaving = true; sfx('alarm'); toast('AVISO: A nave vai decolar sozinha à meia-noite!', 5); if(isNetHost()) netBroadcast({t:'toast', msg:'AVISO: A nave vai decolar sozinha à meia-noite!'}); }
  if(h >= CONFIG.DAY_END_HOUR){ takeOff('midnight'); }
  if(!player.inFacility) updateOutdoorLighting(h);
  // tempestade: raios
  if(S.weather[S.moon.id]==='storm'){
    stormT -= dt;
    if(stormT <= 0){
      stormT = rand(9, 22);
      const metalInHand = heldItem() && heldItem().def.metal;
      if(!player.inFacility && !playerInShip() && metalInHand && GR()<0.5 && !strikeWarn){
        strikeWarn = {t:3.2}; toast('Seu item de metal está chiando... LARGUE ou GUARDE!', 3); sfx('stun');
      } else {
        const a = rand(0,Math.PI*2), d = rand(15,60); lightningAt(player.pos.x+Math.cos(a)*d, player.pos.z+Math.sin(a)*d);
      }
    }
    if(strikeWarn){
      strikeWarn.t -= dt;
      if(GR()<dt*10) sfx('click', null, 0.6);
      const still = heldItem() && heldItem().def.metal && !player.inFacility && !playerInShip();
      if(!still){ strikeWarn = null; }
      else if(strikeWarn.t <= 0){ strikeWarn = null; lightningAt(player.pos.x, player.pos.z); killPlayer('Atingido por um raio'); }
    }
  }
}
function lightningAt(x, z){
  const y = groundAt(x, z, false);
  const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.4, 120, 5), new THREE.MeshBasicMaterial({color:0xe8f0ff}));
  bolt.position.set(x, y+60, z); addToLevel(bolt);
  const l = new THREE.PointLight(0xdde8ff, 8, 80); l.position.set(x, y+10, z); addToLevel(l);
  if(!player.inFacility){ hemi.intensity += 2.5; setTimeout(()=>updateOutdoorLighting(currentHour()), 120); }
  setTimeout(()=>{ bolt.parent && bolt.parent.remove(bolt); l.parent && l.parent.remove(l); }, 180);
  setTimeout(()=>sfx('thunder', {x, z, inFacility:false}, 1.4, 250), 300);
  // destrói sucata de metal largada perto
  worldItems.filter(it=>!it.inFacility && it.def.metal && Math.hypot(it.pos.x-x,it.pos.z-z)<3).forEach(it=>{ it.value = Math.floor(it.value*0.3); });
}
