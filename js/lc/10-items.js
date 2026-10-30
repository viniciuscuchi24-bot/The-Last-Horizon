/*
 * ============================================================================
 *  10-items.js — PEGAR, LARGAR, USAR E ESCANEAR ITENS
 * ============================================================================
 *  E = pegar | G = largar | 1-4 / rodinha = trocar de espaço | clique esquerdo = usar
 *  clique direito = escanear | F = lanterna | R = recarregar espingarda
 * ============================================================================
 */

const viewModel = new THREE.Group(); camera.add(viewModel);
viewModel.position.set(0.32, -0.3, -0.55);
let useCooldown = 0, swingT = -1, thrown = [], decals = [];
const swingPivot = new THREE.Group();
let sprayHeld = false, sprayT = 0, spraySndT = 0;
// segurar o botão de usar (a tinta spray pinta enquanto estiver apertado)
function useHeldDown(on){ sprayHeld = !!on; if(!on) sprayT = 0; }
let scanMarks = [], scanCooldown = 0, scanTotal = 0, scanTotalT = 0;

function refreshViewModel(){
  while(viewModel.children.length) viewModel.remove(viewModel.children[0]);
  const it = heldItem(); if(!it) return;
  if(!it.mesh) buildItemMesh(it);
  const m = it.mesh;
  m.position.set(0, 0, 0); m.rotation.set(0, 0.6, 0);
  const tw = it.def.twoHanded;
  m.scale.setScalar(tw ? 0.55 : 0.75);
  if(tw){ viewModel.position.set(0, -0.45, -0.75); } else viewModel.position.set(0.32, -0.3, -0.55);
  swingPivot.rotation.set(0,0,0); swingPivot.position.set(0,0,0);
  while(swingPivot.children.length) swingPivot.remove(swingPivot.children[0]);
  if(it.def.id==='pa' || it.def.use==='weapon'){
    // a arma fica num "pivô" na mão: a animação gira o pivô, não o item
    const isPa = it.def.id==='pa';
    if(isPa){ m.scale.setScalar(0.55); m.rotation.set(0.3, -0.45, 1.15); m.position.set(-0.06, -0.08, 0.0); }
    else { m.rotation.set(0.3, 0, -0.25); }
    swingPivot.add(m); viewModel.add(swingPivot); return;
  }
  if(it.def.id==='espingarda'){ m.scale.setScalar(0.9); m.rotation.set(0, Math.PI/2, 0); m.position.set(-0.05,0.02,0.1); }
  if(it.def.id==='spray'){ m.rotation.set(0.2, 0, 0); m.position.set(0, -0.06, 0); }
  if(it.def.id==='lanterna' || it.def.id==='lanterna_pro'){ m.scale.setScalar(0.5); m.rotation.set(0, Math.PI/2, 0.06); m.position.set(0.04, -0.03, 0.0); }
  if(it.def.id==='kit_medico'){ m.rotation.set(0.3, 0.4, 0); }
  viewModel.add(m);
}

// --------------------------------------------------------------------- pegar
function itemUnderCrosshair(maxDist=2.6){
  const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
  let best = null, bestA = 0.42;
  for(const it of worldItems){
    if(it.inFacility !== player.inFacility || it.busy || it.carriedBy) continue;
    const c = new THREE.Vector3(it.pos.x, it.pos.y+0.15, it.pos.z);
    const to = c.sub(camera.position); const d = to.length();
    if(d > maxDist) continue;
    const a = to.normalize().angleTo(fwd) - (d < 1.2 ? 0.2 : 0);
    if(a < bestA){ bestA = a; best = it; }
  }
  return best;
}
function tryPickup(){
  const it = itemUnderCrosshair(); if(!it) return false;
  if(isNetClient()){
    if(!it.mimicOf){ if(holdingTwoHanded()){ toast('Suas mãos estão ocupadas (G para largar)'); return true; } if(!player.inv.some(s=>!s) && heldItem()){ toast('Inventário cheio'); sfx('error'); return true; } }
    netRelay('pickup', {uid:it.uid}); return true;
  }
  if(it.mimicOf){ mimicReveal(it.mimicOf); return true; }
  if(holdingTwoHanded()){ toast('Suas mãos estão ocupadas (G para largar)'); return true; }
  let slot = heldItem() ? player.inv.findIndex(s=>!s) : player.slot;
  if(slot < 0){ toast('Inventário cheio'); sfx('error'); return true; }
  if(it.def.twoHanded && heldItem()){ // item de duas mãos vai pra um espaço livre e vira o selecionado
    player.slot = slot;
  }
  removeItemFromWorld(it);
  player.inv[slot] = it; player.slot = slot;
  sfx('pickup');
  if(it.nestOf){ /* o Juntador vai lembrar disso */ }
  if(it.def.apparatus && !S.apparatusTaken){ S.apparatusTaken = true; setPower(false); if(FAC.apparatusGlow) FAC.apparatusGlow.intensity = 0; sfx('alarm', camera.position, 0.6); toast('As luzes se apagaram...'); }
  if(it.kind==='scrap') S.stats.scrapCollected++;
  refreshViewModel(); updateHud();
  return true;
}
function removeFromInventory(it){
  const i = player.inv.indexOf(it); if(i>=0) player.inv[i] = null;
  if(it.mesh && it.mesh.parent===viewModel) viewModel.remove(it.mesh);
  refreshViewModel(); updateHud();
}
function consumeHeld(){ const h = heldItem(); if(h) removeFromInventory(h); }
function dropHeld(silent){
  const it = heldItem(); if(!it) return;
  removeFromInventory(it);
  if(isNetClient()){
    const fx0 = -Math.sin(player.yaw), fz0 = -Math.cos(player.yaw);
    let x = player.pos.x + fx0*0.6, z = player.pos.z + fz0*0.6;
    if(player.inFacility){ const p = {x, z}; facilityResolve(p, 0.2, false); x = p.x; z = p.z; }
    netRelay('drop', {item:serItem(it), x, y:groundAt(x, z, player.inFacility), z, inF:player.inFacility});
    if(!silent){ sfx('drop', {x, z, inFacility:player.inFacility}); makeNoise(x, z, it.def.lb>30?10:6, player.inFacility); }
    return;
  }
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
  let x = player.pos.x + fx*0.6, z = player.pos.z + fz*0.6;
  if(player.inFacility){ const p = {x, z}; facilityResolve(p, 0.2, false); x = p.x; z = p.z; }
  const y = groundAt(x, z, player.inFacility);
  placeItemInWorld(it, x, y, z, player.inFacility);
  if(!silent){ sfx('drop', {x, z, inFacility:player.inFacility}); makeNoise(x, z, it.def.lb>30?10:6, player.inFacility); }
}
function dropAll(){ for(let i=0;i<player.inv.length;i++){ player.slot = i; dropHeld(true); } player.slot = 0; }
function switchSlot(i){
  if(holdingTwoHanded()){ toast('Largue o item de duas mãos primeiro (G)'); return; }
  player.slot = (i + player.inv.length) % player.inv.length; refreshViewModel(); updateHud(); sfx('click');
}

// --------------------------------------------------------------------- usar
function useHeld(){
  const it = heldItem(); if(!it || useCooldown > 0) return;
  const d = it.def;
  if(d.battery){ if(it.battery <= 0){ toast('Bateria vazia'); sfx('click'); return; } it.on = !it.on; sfx('click'); useCooldown = 0.15; return; }
  if(d.id==='pa' || d.use==='weapon'){ if(swingT < 0){ swingT = 0; useCooldown = (d.weapon?d.weapon.cooldown:0.85); sfx('swing'); } return; }
  if(d.id==='granada' || d.use==='flashbang'){ throwGrenade(it); return; }
  if(d.use==='horn'){ sfx(d.sound||'horn', {x:player.pos.x, z:player.pos.z, inFacility:player.inFacility}, 1.2); makeNoise(player.pos.x, player.pos.z, 32, player.inFacility); useCooldown = 0.6; return; }
  if(d.use==='light'){ it.on = !it.on; sfx('click'); useCooldown = 0.15; return; }
  if(d.id==='spray'){ sprayPaint(it); sprayT = 0.06; return; }
  if(d.id==='kit_medico'){
    const max = CONFIG.PLAYER.maxHp;
    if(player.hp >= max){ toast('Sua vida já está cheia'); return; }
    player.hp = Math.min(max, player.hp + (d.heal||45)); it.uses = (it.uses ?? d.uses ?? 1) - 1;
    sfx('heal'); screenFlash('#40ff80', 0.18); useCooldown = 0.8;
    toast(it.uses > 0 ? `Curado! (${it.uses} uso restante)` : 'Curado! O kit acabou.');
    if(it.uses <= 0) consumeHeld();
    updateHud(); return;
  }
  if(d.id==='espingarda'){ fireShotgun(it); return; }
}
function meleeHit(){
  const d = heldItem() ? heldItem().def : null;
  const range = (d && d.weapon) ? d.weapon.range : 2.0;
  const fwd = {x:-Math.sin(player.yaw), z:-Math.cos(player.yaw)};
  let hitSomething = false;
  creatures.forEach(c=>{
    if(!c.alive || c.inFacility!==player.inFacility) return;
    const dx = c.pos.x-player.pos.x, dz = c.pos.z-player.pos.z, dist = Math.hypot(dx,dz);
    if(dist > range + (c.radius||0.5)) return;
    if((dx*fwd.x+dz*fwd.z)/Math.max(dist,0.01) < 0.55 && dist > 0.8) return;
    if(c.type==='lacrador' && c.state==='ceiling') return;
    if(c.type==='mimico_sucata' && c.state==='disguised'){ mimicReveal(c); }
    hurtCreature(c, 1, player.pos); stunCreature(c, 0.4); hitSomething = true;
    discoverCreature(c.type);
  });
  // teias
  if(FAC.webs) FAC.webs = FAC.webs.filter(w=>{
    if(!player.inFacility) return true;
    const dx = w.x-player.pos.x, dz = w.z-player.pos.z, dist = Math.hypot(dx,dz);
    if(dist < range+0.6 && (dx*fwd.x+dz*fwd.z)/Math.max(dist,0.01) > 0.4){ w.hp--; hitSomething = true; if(w.hp<=0){ if(w.mesh.parent) w.mesh.parent.remove(w.mesh); return false; } }
    return true;
  });
  // portas mímicas
  if(player.inFacility && FAC.doors) FAC.doors.forEach(dr=>{ if(dr.mimic && !dr.open && Math.hypot(dr.x-player.pos.x,dr.z-player.pos.z)<range+0.5){ dr.mimicHp--; hitSomething=true; if(dr.mimicHp<=0){ dr.mimic=false; openDoor(dr); toast('A porta mímica morreu.'); } } });
  sfx(hitSomething?'hit':'swing', {x:player.pos.x, z:player.pos.z, inFacility:player.inFacility}, hitSomething?1:0.4);
  makeNoise(player.pos.x, player.pos.z, 8, player.inFacility);
}
function throwGrenade(it){
  consumeHeld();
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  if(!it.mesh) buildItemMesh(it);
  it.mesh.scale.setScalar(1); addToLevel(it.mesh);
  const p = camera.position.clone().add(dir.clone().multiplyScalar(0.5));
  thrown.push({it, pos:p, vel:dir.multiplyScalar(13).add(new THREE.Vector3(0,3,0)), fuse:1.5, inFacility:player.inFacility, flash:it.def.use==='flashbang'||it.def.id==='granada'});
  sfx('swing');
}
function updateThrown(dt){
  thrown = thrown.filter(g=>{
    g.vel.y -= 16*dt;
    const nx = g.pos.x + g.vel.x*dt, nz = g.pos.z + g.vel.z*dt, ny = g.pos.y + g.vel.y*dt;
    if(g.inFacility){
      const [i,j] = tileOf(nx, nz);
      if(!tileWalkable(i,j,false)){ g.vel.x *= -0.3; g.vel.z *= -0.3; } else { g.pos.x = nx; g.pos.z = nz; }
      if(ny > FAC.H-0.1){ g.vel.y = -Math.abs(g.vel.y)*0.3; }
    } else { g.pos.x = nx; g.pos.z = nz; }
    g.pos.y = ny;
    const gy = groundAt(g.pos.x, g.pos.z, g.inFacility);
    if(g.pos.y < gy+0.08){ g.pos.y = gy+0.08; g.vel.y = Math.abs(g.vel.y)*0.3; g.vel.x *= 0.6; g.vel.z *= 0.6; }
    g.it.mesh.position.copy(g.pos); g.it.mesh.rotation.x += dt*8;
    g.fuse -= dt;
    if(g.fuse <= 0){ stunBlast(g.pos, g.inFacility); if(g.it.mesh.parent) g.it.mesh.parent.remove(g.it.mesh); return false; }
    return true;
  });
}
function stunBlast(pos, inFacility){
  sfx('flashbang', {x:pos.x, z:pos.z, inFacility}, 1.3, 60);
  const fl = new THREE.PointLight(0xffffff, 12, 20); fl.position.copy(pos); addToLevel(fl); setTimeout(()=>fl.parent&&fl.parent.remove(fl), 120);
  creatures.forEach(c=>{
    if(c.inFacility!==inFacility) return;
    const d = Math.hypot(c.pos.x-pos.x, c.pos.z-pos.z);
    if(d < 10 && lineOfSight({x:pos.x,y:pos.y+0.3,z:pos.z}, creatureEye(c), inFacility)) stunCreature(c, c.type==='colosso'?3:5.5);
  });
  if(player.inFacility===inFacility){
    const d = Math.hypot(player.pos.x-pos.x, player.pos.z-pos.z);
    if(d < 9 && lineOfSight({x:pos.x,y:pos.y+0.3,z:pos.z}, playerEye(), inFacility)){
      const to = new THREE.Vector3(pos.x-camera.position.x, pos.y-camera.position.y, pos.z-camera.position.z).normalize();
      const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
      const k = clamp(fwd.dot(to)+0.3, 0, 1) * (1-d/9);
      if(k > 0.05){ screenFlash('#fff', 1.6*k+0.3); player.stunned = 2.5*k; sfx('stun'); }
    }
  }
}
function sprayPaint(it, quiet){
  if(it.charges <= 0){ if(!quiet) toast('Lata vazia'); sprayHeld = false; return; }
  const rc = new THREE.Raycaster(); rc.setFromCamera({x:0,y:0}, camera); rc.far = 4;
  const targets = player.inFacility ? [FAC.wallMesh, FAC.root] : [levelRoot, SHIP.group];
  const hits = rc.intersectObjects(targets.filter(Boolean), true).filter(h=>h.object!==it.mesh && !h.object.isSprite && h.face);
  if(!hits.length) return;
  const h = hits[0]; it.charges--;
  const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
  placeDecal(h.point, n);
  if(spraySndT <= 0){ sfx('spray', {x:h.point.x, z:h.point.z, inFacility:player.inFacility}, 0.7); spraySndT = 0.22; }
  if(isNetClient() || isNetHost()) netShareDecal(h.point, n);
}
const decalMat = new THREE.MeshBasicMaterial({color:CONFIG.HUD_COLOR, transparent:true, opacity:0.9, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-2});
const decalGeos = [0.1,0.12,0.14,0.16].map(r=>new THREE.CircleGeometry(r, 9));
function placeDecal(p, n){
  const P = Array.isArray(p) ? new THREE.Vector3(p[0],p[1],p[2]) : p, N = Array.isArray(n) ? new THREE.Vector3(n[0],n[1],n[2]) : n;
  const splat = new THREE.Mesh(decalGeos[Math.floor(GR()*decalGeos.length)], decalMat);
  splat.position.copy(P).add(N.clone().multiplyScalar(0.02));
  splat.lookAt(P.clone().add(N)); splat.rotation.z = GR()*6;
  addToLevel(splat); decals.push(splat);
  if(decals.length > 1200){ const old = decals.shift(); if(old.parent) old.parent.remove(old); }
}
function fireShotgun(it){
  if(it.shells <= 0){ sfx('click'); toast('Sem cartuchos (R para recarregar)'); useCooldown = 0.3; return; }
  it.shells--; useCooldown = 0.7;
  sfx('gun', {x:player.pos.x, z:player.pos.z, inFacility:player.inFacility}, 1.3, 80);
  makeNoise(player.pos.x, player.pos.z, 45, player.inFacility);
  addShake(0.3); screenFlash('#ffd080', 0.25);
  const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
  creatures.forEach(c=>{
    if(!c.alive || c.inFacility!==player.inFacility) return;
    const to = new THREE.Vector3(c.pos.x-camera.position.x, c.pos.y+1-camera.position.y, c.pos.z-camera.position.z);
    const d = to.length(); if(d > it.def.gun.range) return;
    if(to.normalize().angleTo(fwd) > 0.22 + 0.5/d) return;
    if(!lineOfSight(playerEye(), creatureEye(c), c.inFacility)) return;
    if(c.type==='mimico_sucata' && c.state==='disguised') mimicReveal(c);
    hurtCreature(c, d < 6 ? it.def.gun.damage : Math.ceil(it.def.gun.damage/2), player.pos); stunCreature(c, 0.6);
  });
  updateHud();
}
function reloadShotgun(){
  const it = heldItem(); if(!it || it.def.id!=='espingarda') return;
  if(it.shells >= it.def.gun.shells){ toast('Já está carregada'); return; }
  const ammo = player.inv.find(x=>x && x.def.id==='cartucho');
  if(!ammo){ toast('Sem cartuchos no inventário'); return; }
  const i = player.inv.indexOf(ammo); player.inv[i] = null; it.shells++; sfx('click'); updateHud();
}
function toggleAnyFlashlight(){
  const fl = player.inv.find(x=>x && x.def.battery);
  if(!fl){ toast('Você não tem lanterna (compre no terminal)'); return; }
  if(fl.battery <= 0){ toast('Bateria vazia'); return; }
  fl.on = !fl.on; sfx('click');
}
function updateFlashlight(dt){
  let beam = null, held = heldItem();
  player.inv.forEach(it=>{
    if(!it) return;
    if(it.def.battery && it.on){ it.battery -= dt; if(it.battery <= 0){ it.battery = 0; it.on = false; sfx('click'); } if(!beam || it===held) beam = it; }
  });
  if(held && held.def.use==='light' && held.on){ flashlight.color.set(0xff2020); flashlight.intensity = 0.8; flashlight.distance = 30; flashlight.angle = 0.03; flashlight.penumbra = 0.1; }
  else if(beam){
    const b = beam.def.beam, inHand = beam===held;
    const low = beam.battery < 15 ? (GR()<0.1?0.2:0.7) : 1;
    flashlight.color.set(0xfff0d0); flashlight.intensity = b.intensity*(inHand?1:0.7)*low; flashlight.distance = b.range; flashlight.angle = b.angle; flashlight.penumbra = 0.45;
  } else flashlight.intensity = 0;
  camera.getWorldDirection(flashAim);
  flashlight.position.copy(camera.position).add(new THREE.Vector3(0,-0.15,0));
  flashlight.target.position.copy(camera.position).add(flashAim);
}
function updateSwing(dt){
  if(useCooldown > 0) useCooldown -= dt;
  if(spraySndT > 0) spraySndT -= dt;
  // spray contínuo enquanto o botão estiver apertado
  const hi = heldItem();
  if(sprayHeld && hi && hi.def.id==='spray' && !menuOpen){
    sprayT -= dt; if(sprayT <= 0){ sprayT = 0.06; sprayPaint(hi, true); }
    swingPivot.position.x = 0;
    viewModel.rotation.z = Math.sin(performance.now()*0.05)*0.01; // treme a lata
  } else if(viewModel.rotation.z) viewModel.rotation.z = 0;
  if(swingT >= 0){
    swingT += dt;
    const w = hi && hi.def.weapon ? hi.def.weapon.windup : 0.4;
    const P = swingPose(swingT, w);
    swingPivot.rotation.set(P.rx, P.ry, P.rz); swingPivot.position.set(P.px, P.py, P.pz);
    if(swingT >= w + 0.06 && !updateSwing._hit){ updateSwing._hit = true; meleeHit(); }
    if(swingT > w + 0.5){ swingT = -1; updateSwing._hit = false; swingPivot.rotation.set(0,0,0); swingPivot.position.set(0,0,0); }
  }
  // balanço da mão ao andar
  const bob = player.moving && player.grounded ? Math.sin(performance.now()*0.012)*(player.sprinting?0.025:0.012) : 0;
  viewModel.position.y = (holdingTwoHanded()?-0.45:-0.3) + bob;
}

// Animação da pá em 3 fases (as poses são misturadas com quaternions pra não "entortar" no meio): levanta por cima do ombro (preparo), desce com força
// num arco diagonal (golpe) e volta devagar (recuperação).
const _SW = (()=>{ const mk = (rx,ry,rz,px,py,pz)=>({q:new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,rz)), p:new THREE.Vector3(px,py,pz)});
  return {REST:mk(0,0,0, 0,0,0), UP:mk(-0.55,0.35,0.55, 0.06,0.12,0.08), HIT:mk(0.75,-0.3,-0.45, -0.16,0.02,-0.14)}; })();
const _swQ = new THREE.Quaternion(), _swP = new THREE.Vector3(), _swE = new THREE.Euler();
function swingPose(t, w){
  const ease = x=>x<0?0:x>1?1:x*x*(3-2*x);
  let A, B, k;
  if(t < w){ A = _SW.REST; B = _SW.UP; k = ease(t/w); }
  else if(t < w + 0.12){ A = _SW.UP; B = _SW.HIT; k = (t-w)/0.12; k = k*k; }   // o golpe é rápido
  else { A = _SW.HIT; B = _SW.REST; k = ease((t-w-0.12)/0.38); }
  _swQ.copy(A.q).slerp(B.q, k); _swP.copy(A.p).lerp(B.p, k); _swE.setFromQuaternion(_swQ);
  return {rx:_swE.x, ry:_swE.y, rz:_swE.z, px:_swP.x, py:_swP.y, pz:_swP.z};
}

// --------------------------------------------------------------------- scanner
function doScan(){
  if(scanCooldown > 0) return;
  scanCooldown = 1.3; sfx('scan');
  const marks = [], eye = playerEye();
  let total = 0;
  const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
  const inFront = (x,y,z)=>{ const v = new THREE.Vector3(x-eye.x, y-eye.y, z-eye.z); return v.normalize().dot(fwd) > 0.25; };
  worldItems.forEach(it=>{
    if(it.inFacility!==player.inFacility || it.carriedBy) return;
    const d = Math.hypot(it.pos.x-eye.x, it.pos.z-eye.z); if(d > 24) return;
    if(!inFront(it.pos.x, it.pos.y+0.2, it.pos.z)) return;
    if(d > 5 && !lineOfSight(eye, {x:it.pos.x, y:it.pos.y+0.3, z:it.pos.z}, it.inFacility)) return;
    const val = it.kind==='scrap' ? it.value : 0;
    marks.push({get pos(){ return {x:it.pos.x, y:it.pos.y+0.35, z:it.pos.z}; }, title:it.def.name, sub: it.kind==='scrap' ? `Valor: $${val}` : 'Ferramenta', kind:'item'});
    total += val;
  });
  creatures.forEach(c=>{
    if(!c.alive || c.inFacility!==player.inFacility) return;
    if(c.type==='mimico_sucata' && c.state==='disguised') return;
    if(c.type==='verme' && c.state!=='emerge') return;
    const d = Math.hypot(c.pos.x-eye.x, c.pos.z-eye.z); if(d > 32) return;
    if(!inFront(c.pos.x, c.pos.y+1, c.pos.z)) return;
    if(!lineOfSight(eye, creatureEye(c), c.inFacility)) return;
    discoverCreature(c.type);
    marks.push({get pos(){ return {x:c.pos.x, y:c.pos.y+(c.eyeH||1.5)+0.4, z:c.pos.z}; }, title:c.def.name, sub:'Criatura', kind:'creature'});
  });
  if(player.inFacility){
    if(FAC.doors) FAC.doors.forEach(dr=>{ if(dr.mimic && !dr.open && Math.hypot(dr.x-eye.x,dr.z-eye.z)<6 && facilityLOS(eye.x,eye.z,dr.x,dr.z)) marks.push({pos:{x:dr.x,y:2.2,z:dr.z}, title:'???', sub:'Algo está errado com essa porta', kind:'creature'}); });
    traps.forEach(t=>{ if(Math.hypot(t.x-eye.x,t.z-eye.z)<20 && facilityLOS(eye.x,eye.z,t.x,t.z) && inFront(t.x,1,t.z) && t.state!=='done') marks.push({pos:{x:t.x,y:1.4,z:t.z}, title:TRAPS[t.type].name, sub:`Código: ${t.code.toUpperCase()}`, kind:'creature'}); });
    ['main','fire'].forEach(k=>{ const e = ENTR[k] && ENTR[k].in; if(e && Math.hypot(e.x-eye.x,e.z-eye.z)<40) marks.push({pos:{x:e.x,y:2.4,z:e.z}, title:k==='main'?'Entrada principal':'Saída de emergência', sub:'', kind:'place'}); });
  } else {
    ['main','fire'].forEach(k=>{ const e = ENTR[k] && ENTR[k].out; if(e) marks.push({pos:{x:e.x,y:e.y+3,z:e.z}, title:k==='main'?'Entrada principal':'Saída de emergência', sub:'', kind:'place'}); });
    if(SHIP.group && S.moon) marks.push({pos:{x:SHIP.x, y:SHIP.floorY+5, z:SHIP.z}, title:'Nave', sub: playerInShip() ? `Sucata a bordo: $${shipScrapValue()}` : '', kind:'place'});
  }
  scanMarks = marks.map(m=>Object.assign(m, {t:3.5}));
  scanTotal = playerInShip() ? shipScrapValue() : total; scanTotalT = 3.5;
}
