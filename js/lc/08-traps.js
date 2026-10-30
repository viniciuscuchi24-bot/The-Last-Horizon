/*
 * ============================================================================
 *  08-traps.js — ARMADILHAS: torretas, minas, esmagadores e portas mímicas
 * ============================================================================
 *  Cada torreta/mina/esmagador tem um código (ex: "c4") que aparece sobre ela.
 *  Digitando o código no terminal da nave, ela desliga por alguns segundos
 *  (útil quando tiver co-op: um jogador na nave ajuda quem está lá dentro).
 * ============================================================================
 */

let traps = [];
let lockpicks = []; // {door, item, t}
function trapCode(){
  const L = 'abcdefghijkmnopqrstuvwxyz';
  let c; do { c = L[randInt(0,L.length-1)] + randInt(0,9); } while(traps.some(t=>t.code===c));
  return c;
}
function codeSprite(code, color='#ff5a3a'){
  const cvs = document.createElement('canvas'); cvs.width=64; cvs.height=32;
  const g = cvs.getContext('2d'); g.fillStyle = color; g.font='bold 24px monospace'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(code.toUpperCase(), 32, 17);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cvs), transparent:true, depthWrite:false}));
  s.scale.set(0.5, 0.25, 1);
  return s;
}

function spawnTraps(moon){
  traps = []; lockpicks = [];
  const tc = moon.traps; const CT = FAC.CT;
  const halls = FAC.trapSpots.hall.slice(), rooms = FAC.trapSpots.room.filter(c=>!c.lobby);
  const pickHallTile = ()=>{
    const c = halls.length ? halls[randInt(0,halls.length-1)] : pick(rooms);
    if(!c || c.lobby || c.dist < 1) return null;
    const dirs = Object.keys(c.conn); const d = pick(dirs);
    const bi = c.x*CT, bj = c.z*CT;
    let ti = bi+randInt(3,4), tj = bj+randInt(3,4);
    const off = randInt(1,2);
    if(d==='n') tj = bj+3-off; if(d==='s') tj = bj+4+off; if(d==='w') ti = bi+3-off; if(d==='e') ti = bi+4+off;
    const k = tIdx(ti,tj);
    if(!FAC.walk[k] || FAC.block[k] || FAC.doorAt[k]) return null;
    if(traps.some(t=>t.ti===ti && t.tj===tj)) return null;
    return {ti, tj, c};
  };
  // torretas: no meio de uma célula, mirando pra uma passagem
  const nT = randInt(tc.turrets[0], tc.turrets[1]);
  for(let n=0, tries=0; n<nT && tries<50; tries++){
    const pool = rooms.concat(FAC.trapSpots.hall).filter(c=>!c.lobby && c.dist>=2);
    if(!pool.length) break;
    const c = pick(pool); const bi=c.x*CT, bj=c.z*CT;
    const ti = bi+3, tj = bj+3, k = tIdx(ti,tj);
    if(!FAC.walk[k] || FAC.block[k] || traps.some(t=>t.ti===ti&&t.tj===tj)) continue;
    const d = pick(Object.keys(c.conn));
    const baseYaw = {n:0, s:Math.PI, e:-Math.PI/2, w:Math.PI/2}[d];
    makeTurret(ti, tj, baseYaw); n++;
  }
  const nM = randInt(tc.mines[0], tc.mines[1]);
  for(let n=0, tries=0; n<nM && tries<60; tries++){ const s = pickHallTile(); if(s){ makeMine(s.ti, s.tj); n++; } }
  const nC = randInt(tc.crushers[0], tc.crushers[1]);
  for(let n=0, tries=0; n<nC && tries<60; tries++){ const s = pickHallTile(); if(s){ makeCrusher(s.ti, s.tj); n++; } }
  // portas mímicas
  const nD = randInt(tc.mimicDoors[0], tc.mimicDoors[1]);
  const cand = FAC.doors.filter(d=>!d.locked);
  for(let n=0;n<nD && cand.length;n++){ const d = cand.splice(randInt(0,cand.length-1),1)[0]; d.mimic = true; d.mimicHp = 3; }
}

function makeTurret(ti, tj, baseYaw){
  const p = tileCenter(ti, tj);
  const g = makeVisual('props', 'torreta', ()=>{
    const t = new THREE.Group();
    t.add(cyl(0.35, 0.45, 0.4, MAT.dark, 0, 0.2, 0));
    t.add(cyl(0.08, 0.08, 0.6, MAT.metal, 0, 0.7, 0));
    const head = new THREE.Group(); head.position.y = 1.05; head.name='head';
    head.add(box(0.45, 0.35, 0.6, MAT.metal, 0, 0, 0));
    head.add(cyl(0.05, 0.05, 0.6, MAT.dark, 0, 0, -0.55).rotateX(Math.PI/2));
    head.add(box(0.12, 0.08, 0.05, MAT.glowR, 0, 0.08, -0.31));
    t.add(head);
    return t;
  });
  g.position.set(p.x, 0, p.z); addToLevel(g);
  const laser = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 1), new THREE.MeshBasicMaterial({color:0xff2020, transparent:true, opacity:0.6}));
  addToLevel(laser);
  const code = trapCode(); const cs = codeSprite(code); cs.position.set(p.x, 1.8, p.z); addToLevel(cs);
  FAC.block[tIdx(ti,tj)] = 1;
  traps.push({type:'turret', x:p.x, z:p.z, ti, tj, g, laser, code, baseYaw, aim:baseYaw, state:'scan', t:0, off:0, fireT:0, lostT:0});
}
function makeMine(ti, tj){
  const p = tileCenter(ti, tj);
  const jitter = {x:rand(-0.3,0.3), z:rand(-0.3,0.3)};
  const g = makeVisual('props', 'mina', ()=>{
    const m = new THREE.Group();
    m.add(cyl(0.32, 0.36, 0.1, new THREE.MeshStandardMaterial({color:0x3a4030, roughness:0.7, metalness:0.4}), 0, 0.05, 0));
    m.add(cyl(0.1, 0.1, 0.06, MAT.metal, 0, 0.12, 0));
    return m;
  });
  g.position.set(p.x+jitter.x, 0, p.z+jitter.z); addToLevel(g);
  const led = sph(0.04, new THREE.MeshStandardMaterial({color:0xff2020, emissive:0xff2020, emissiveIntensity:2}), p.x+jitter.x, 0.17, p.z+jitter.z); addToLevel(led);
  const code = trapCode(); const cs = codeSprite(code); cs.position.set(p.x+jitter.x, 0.6, p.z+jitter.z); cs.scale.set(0.35,0.17,1); addToLevel(cs);
  traps.push({type:'mine', x:p.x+jitter.x, z:p.z+jitter.z, ti, tj, g, led, code, state:'idle', t:GR()*2, off:0, codeSprite:cs});
}
function makeCrusher(ti, tj){
  const p = tileCenter(ti, tj);
  const slab = new THREE.Group(); slab.position.set(p.x, FAC.H-0.35, p.z); addToLevel(slab);
  slab.add(box(FAC.T*1.0, 0.5, FAC.T*1.0, MAT.rust, 0, 0, 0));
  for(let a=-0.5;a<=0.5;a+=0.5) for(let b=-0.5;b<=0.5;b+=0.5) slab.add(new THREE.Mesh(new THREE.ConeGeometry(0.08,0.35,5), MAT.metal).translateX(a).translateZ(b).translateY(-0.4).rotateX(Math.PI));
  const code = trapCode(); const cs = codeSprite(code); cs.position.set(p.x, FAC.H-0.9, p.z); cs.scale.set(0.35,0.17,1); addToLevel(cs);
  traps.push({type:'crusher', x:p.x, z:p.z, ti, tj, slab, code, state:'up', t:0, off:0, y:FAC.H-0.35});
}

function disableTrapByCode(code){
  const t = traps.find(t=>t.code===code.toLowerCase());
  if(!t) return false;
  t.off = TRAPS.TERMINAL_DISABLE_SECONDS;
  return true;
}

function explodeAt(x, z, inFacility, killR, hurtR, hurtDmg){
  sfx('explosion', {x, z, inFacility}, 1.2, 60);
  const fl = new THREE.PointLight(0xffa040, 6, 14); fl.position.set(x, 1.2, z); addToLevel(fl);
  const ball = sph(0.5, new THREE.MeshBasicMaterial({color:0xffc070, transparent:true, opacity:0.9}), x, 0.8, z); addToLevel(ball);
  let t = 0; const iv = setInterval(()=>{ t+=0.05; ball.scale.setScalar(1+t*8); ball.material.opacity = Math.max(0,0.9-t*2.5); fl.intensity = Math.max(0, 6-t*16); if(t>0.45){ clearInterval(iv); if(ball.parent) ball.parent.remove(ball); if(fl.parent) fl.parent.remove(fl); } }, 50);
  const everyone = (typeof netParticipants==='function') ? netParticipants() : [localPlayer];
  everyone.forEach(pl=>{
    if(pl.inFacility!==inFacility || !pl.alive) return;
    player = pl;
    try{
      const d = Math.hypot(player.pos.x-x, player.pos.z-z);
      if(d < killR) killPlayer('Explosão');
      else if(d < hurtR) damagePlayer(Math.round(hurtDmg*(1-(d-killR)/(hurtR-killR))), 'Explosão', {x,z});
      if(d < hurtR*2) addShake(0.6);
    } finally { player = localPlayer; }
  });
  creatures.forEach(c=>{ if(c.inFacility===inFacility && Math.hypot(c.pos.x-x,c.pos.z-z) < hurtR) hurtCreature(c, 99, {x,z}); });
}

function updateTraps(dt){
  traps.forEach(t=>{
    player = (typeof netNearestTo==='function') ? netNearestTo(t.x, t.z, true) : localPlayer;
    try{ updateOneTrap(t, dt); } finally { player = localPlayer; }
  });
  updateLockpicks(dt);
}
function updateOneTrap(t, dt){
  const pin = player.inFacility && player.alive;
  {
    if(t.off > 0) t.off -= dt;
    const off = t.off > 0 || (!S.powerOn && t.type!=='mine');
    if(t.type==='turret'){
      const head = t.g.getObjectByName('head');
      const dx = player.pos.x-t.x, dz = player.pos.z-t.z, d = Math.hypot(dx,dz);
      const toP = Math.atan2(-dx, -dz);
      let canSee = false;
      if(!off && pin && d < TRAPS.turret.range){
        const ad = Math.abs(angleDiff(toP, t.aim));
        if(ad < TRAPS.turret.fov/2 && facilityLOS(t.x, t.z, player.pos.x, player.pos.z)) canSee = true;
      }
      if(off){ t.state = 'off'; }
      else if(t.state==='off'){ t.state='scan'; }
      if(t.state==='scan'){
        t.t += dt; t.aim = t.baseYaw + Math.sin(t.t*0.7)*TRAPS.turret.sweep;
        if(canSee){ t.state='warn'; t.t2 = 0; sfx('turretBeep', {x:t.x,z:t.z,inFacility:true}); }
      } else if(t.state==='warn'){
        t.t2 += dt; t.aim += angleDiff(toP, t.aim)*Math.min(1, dt*3);
        if(!canSee && t.t2>0.3){ t.state='scan'; }
        else if(t.t2 > TRAPS.turret.warmup){ t.state='fire'; t.lostT = 0; }
      } else if(t.state==='fire'){
        t.aim += angleDiff(toP, t.aim)*Math.min(1, dt*2.2);
        t.fireT -= dt;
        if(t.fireT <= 0){
          t.fireT = 0.09; sfx('turretFire', {x:t.x,z:t.z,inFacility:true}, 0.8);
          if(canSee && Math.abs(angleDiff(toP, t.aim))<0.25) damagePlayer(TRAPS.turret.dps*0.09, 'Torreta');
          creatures.forEach(c=>{ if(c.inFacility && c.hp!==null && Math.hypot(c.pos.x-t.x,c.pos.z-t.z)<TRAPS.turret.range && Math.abs(angleDiff(Math.atan2(-(c.pos.x-t.x),-(c.pos.z-t.z)), t.aim))<0.2 && facilityLOS(t.x,t.z,c.pos.x,c.pos.z)) hurtCreature(c, 0.25, {x:t.x,z:t.z}); });
        }
        if(!canSee){ t.lostT += dt; if(t.lostT > 2.0){ t.state='scan'; t.t = 0; } } else t.lostT = 0;
      }
      if(head) head.rotation.y = t.aim;
      // laser
      if(t.state!=='off'){
        let L = 0.5; const fx = -Math.sin(t.aim), fz = -Math.cos(t.aim);
        while(L < TRAPS.turret.range){ const [i,j] = tileOf(t.x+fx*L, t.z+fz*L); if(!inGrid(i,j)||!FAC.walk[tIdx(i,j)]||FAC.block[tIdx(i,j)]===2) break; L += 0.3; }
        t.laser.visible = true; t.laser.scale.z = L; t.laser.position.set(t.x+fx*L/2, 1.05, t.z+fz*L/2); t.laser.rotation.y = t.aim;
        t.laser.material.color.set(t.state==='fire' ? 0xff0000 : (t.state==='warn'?0xff8020:0xff2020));
        t.laser.material.opacity = t.state==='fire' ? 0.9 : 0.35;
      } else t.laser.visible = false;
    }
    else if(t.type==='mine'){
      t.t += dt;
      t.led.visible = !off && (t.state==='armed' ? (t.t%0.2<0.1) : (t.t%1.6<0.12));
      if(off || t.state==='done') return;
      const triggerers = [];
      if(pin) triggerers.push(player.pos);
      creatures.forEach(c=>{ if(c.inFacility && c.type!=='manequim' && c.type!=='gosma') triggerers.push(c.pos); });
      const on = triggerers.some(p=>Math.hypot(p.x-t.x,p.z-t.z) < 0.65);
      if(t.state==='idle' && on){ t.state='armed'; sfx('mineClick', {x:t.x,z:t.z,inFacility:true}, 1); }
      else if(t.state==='armed' && !on){
        t.state='done'; t.g.visible = false; t.led.visible = false; if(t.codeSprite) t.codeSprite.visible=false;
        setTimeout(()=>explodeAt(t.x, t.z, true, TRAPS.mine.killRadius, TRAPS.mine.hurtRadius, TRAPS.mine.hurtDamage), 250);
      }
    }
    else if(t.type==='crusher'){
      const under = pin && Math.abs(player.pos.x-t.x)<FAC.T*0.75 && Math.abs(player.pos.z-t.z)<FAC.T*0.75;
      if(t.state==='up'){
        t.slab.position.x = t.x; t.slab.position.z = t.z;
        if(!off && under){ t.state='warn'; t.t = 0; sfx('hitMetal', {x:t.x,z:t.z,inFacility:true}, 0.6); }
      } else if(t.state==='warn'){
        t.t += dt; t.slab.position.x = t.x + Math.sin(t.t*80)*0.03;
        if(t.t > TRAPS.crusher.warn){ t.state='down'; t.t = 0; sfx('crusher', {x:t.x,z:t.z,inFacility:true}, 1.2);
          if(pin && Math.abs(player.pos.x-t.x)<FAC.T*0.7 && Math.abs(player.pos.z-t.z)<FAC.T*0.7){ killPlayer('Esmagado'); }
          creatures.forEach(c=>{ if(c.inFacility && Math.abs(c.pos.x-t.x)<FAC.T*0.7 && Math.abs(c.pos.z-t.z)<FAC.T*0.7) hurtCreature(c, 99, {x:t.x,z:t.z}); });
          if(pin && Math.hypot(player.pos.x-t.x, player.pos.z-t.z) < 8) addShake(0.4);
        }
      } else if(t.state==='down'){
        t.t += dt; t.y = Math.max(0.25, t.y - dt*40);
        if(t.t > 1.0){ t.state='rise'; }
      } else if(t.state==='rise'){
        t.y = Math.min(FAC.H-0.35, t.y + dt*1.0);
        if(t.y >= FAC.H-0.36){ t.state='cool'; t.t = 0; }
      } else if(t.state==='cool'){ t.t += dt; if(t.t > TRAPS.crusher.cooldown) t.state='up'; }
      t.slab.position.y = t.y;
    }
  }
}
function updateLockpicks(dt){
  // gazuas trabalhando
  lockpicks = lockpicks.filter(l=>{
    l.t -= dt;
    if(GR()<dt*6) sfx('click', {x:l.door.x, z:l.door.z, inFacility:true}, 0.5);
    if(l.t <= 0){ l.door.locked = false; l.door.panel.material = l.door.panel.material.clone(); l.door.panel.material.color.set(0x6e757c); openDoor(l.door); l.item.busy = false; toast('A gazua destrancou a porta'); return false; }
    return true;
  });
}

function attachLockpicker(d, item){
  removeFromInventory(item);
  const side = {x:d.alongX?0.9:0, z:d.alongX?0:0.9};
  const px = d.x + (player.pos.x>d.x?1:-1)*side.x, pz = d.z + (player.pos.z>d.z?1:-1)*side.z;
  placeItemInWorld(item, px, 1.0, pz, true);
  item.busy = true;
  lockpicks.push({door:d, item, t:8});
  toast('Gazua encaixada... aguarde.');
}
function mimicDoorBite(d){
  sfx('bite', {x:d.x, z:d.z, inFacility:true}, 1.2);
  screenFlash('#400');
  d.pivot.rotation.y = d.baseRot + 0.25; setTimeout(()=>{ d.pivot.rotation.y = d.baseRot; }, 200);
  damagePlayer(TRAPS.mimicDoor.damage, 'Porta mímica', {x:d.x, z:d.z});
  toast('A porta MORDEU você!');
  discoverCreature('mimico_sucata');
}
