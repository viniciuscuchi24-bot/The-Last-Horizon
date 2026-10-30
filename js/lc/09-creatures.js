/*
 * ============================================================================
 *  09-creatures.js — CRIATURAS: aparência (placeholder) e comportamento
 * ============================================================================
 *  Cada criatura tem uma função build (visual) e uma função think (IA por frame).
 *  Pra trocar o visual: ASSETS.creatures.<id> em 01-assets.js (modelo ou sprite).
 *  Pra mudar quantas aparecem e onde: MOONS[x].indoor/outdoor em 00-config.js.
 *  Pra mudar velocidade/dano: constantes no topo de cada think abaixo.
 * ============================================================================
 */

let creatures = [];
let spawnDirector = {inT:0, outT:0, inPower:0, outPower:0};

// ------------------------------------------------------------------ visuais
const CMAT = (c, o={})=>new THREE.MeshStandardMaterial(Object.assign({color:c, roughness:0.8, metalness:0.1}, o));
const CREATURE_BUILD = {
  // besouro azulado, carapaça brilhante, sem asas
  juntador(){
    const g = new THREE.Group(), shell = CMAT(0x1a2a4a, {metalness:0.6, roughness:0.3}), d = CMAT(0x0e1218);
    const body = sph(0.42, shell, 0, 0.5, 0.05); body.scale.set(1, 0.6, 1.3); g.add(body);
    g.add(box(0.04, 0.3, 1.0, CMAT(0x3a6ab0,{emissive:0x10203a}), 0, 0.72, 0.05)); // risca da carapaça
    g.add(sph(0.2, d, 0, 0.5, -0.5));
    [-1,1].forEach(s=>{ const m = box(0.03, 0.03, 0.35, d, s*0.12, 0.45, -0.75); m.rotation.y = s*0.4; g.add(m); }); // pinças
    g.add(sph(0.04, CMAT(0xa0e0ff,{emissive:0x60c0ff, emissiveIntensity:1.5}), -0.08, 0.58, -0.66)); g.add(sph(0.04, CMAT(0xa0e0ff,{emissive:0x60c0ff, emissiveIntensity:1.5}), 0.08, 0.58, -0.66));
    for(let k=0;k<6;k++){ const leg = box(0.04, 0.45, 0.04, d, (k%2?0.36:-0.36), 0.22, -0.3+Math.floor(k/2)*0.3); leg.rotation.z = (k%2?-0.6:0.6); leg.name='leg'; g.add(leg); }
    return g;
  },
  // larva pálida e lisa, com brilho vermelho na ponta
  lacrador(){
    const g = new THREE.Group(), m = CMAT(0xd8d0c0, {roughness:0.4}), d = CMAT(0xb8a898);
    for(let k=0;k<6;k++){ const s = sph(0.16-k*0.015, k%2?m:d, 0, 0.16, -0.45+k*0.17); s.scale.set(1.1,0.6,1); g.add(s); }
    g.add(sph(0.06, CMAT(0xff3020,{emissive:0xff2010, emissiveIntensity:2}), 0, 0.2, -0.58));
    for(let k=0;k<4;k++){ const t = box(0.015,0.015,0.28,d,0,0.18,-0.62); t.rotation.y = -0.6+k*0.4; t.rotation.x = 0.3; g.add(t); } // tentáculos
    return g;
  },
  // aranha grande e escura
  tecela(){
    const g = new THREE.Group(), m = CMAT(0x1c1a1e), d = CMAT(0x2c2830);
    const abd = sph(0.75, m, 0, 1.0, 0.7); abd.scale.set(1,0.85,1.2); g.add(abd);
    g.add(box(0.3, 0.05, 0.9, CMAT(0x6a5a20), 0, 1.62, 0.7)); // listra
    g.add(sph(0.45, d, 0, 0.95, -0.35));
    for(let k=0;k<6;k++) g.add(sph(0.05, CMAT(0x30ff60,{emissive:0x20c040, emissiveIntensity:1.5}), -0.18+(k%3)*0.18, 1.12+Math.floor(k/3)*0.08, -0.74));
    for(let k=0;k<8;k++){
      const side = k%2?1:-1, idx = Math.floor(k/2);
      const leg = new THREE.Group(); leg.position.set(side*0.35, 1.0, -0.5+idx*0.35); leg.name='leg';
      const up = box(1.3, 0.07, 0.07, d, side*0.6, 0.35, 0); up.rotation.z = side*-0.55; leg.add(up);
      const low = box(0.07, 1.3, 0.07, d, side*1.25, -0.3, 0); low.rotation.z = side*0.25; leg.add(low);
      leg.rotation.y = side*(idx-1.5)*0.35; g.add(leg);
    }
    return g;
  },
  // sombra alta e magra, dedos longos, um olho branco
  espreitador(){
    const g = new THREE.Group(), m = CMAT(0x0a0a0c, {roughness:1}), d = CMAT(0x141418, {roughness:1});
    const torso = box(0.4, 1.1, 0.25, m, 0, 1.45, 0); torso.rotation.x = 0.25; g.add(torso);
    const head = sph(0.22, m, 0, 2.15, -0.15); head.scale.set(0.8,1.3,0.8); g.add(head);
    g.add(sph(0.06, CMAT(0xffffff,{emissive:0xffffff, emissiveIntensity:1.2}), 0.05, 2.2, -0.33));
    [-0.3,0.3].forEach(x=>{ const a = box(0.07, 1.5, 0.07, d, x, 1.15, -0.1); a.rotation.x = -0.2; a.name='arm'; g.add(a);
      for(let f=0;f<3;f++){ const fi = box(0.02, 0.35, 0.02, d, x+(f-1)*0.04, 0.3, -0.25); fi.rotation.x = -0.4; g.add(fi); } });
    [-0.12,0.12].forEach(x=>{ const l = box(0.09, 0.95, 0.09, d, x, 0.47, 0.05); l.name='leg'; g.add(l); });
    return g;
  },
  // manequim de porcelana rachada
  manequim(){
    const g = new THREE.Group(), m = CMAT(0xe0dcd2, {roughness:0.35}), crack = CMAT(0x2a2420);
    [-0.14,0.14].forEach(x=>g.add(box(0.13, 0.95, 0.13, m, x, 0.48, 0)));
    g.add(box(0.5, 0.75, 0.26, m, 0, 1.33, 0));
    [-0.35,0.35].forEach(x=>{ const a = box(0.1, 0.85, 0.1, m, x, 1.25, -0.05); a.rotation.x = -0.15; g.add(a); });
    g.add(cyl(0.06, 0.07, 0.25, m, 0, 1.82, 0));
    const head = sph(0.2, m, 0, 2.08, 0); head.scale.set(0.85, 1.15, 0.9); g.add(head);
    g.add(box(0.015, 0.3, 0.01, crack, 0.06, 2.05, -0.19)); g.add(box(0.12, 0.015, 0.01, crack, 0.0, 1.95, -0.19));
    g.add(box(0.012, 0.4, 0.01, crack, -0.1, 1.4, -0.135));
    return g;
  },
  // réptil comprido e espinhento
  rasteiro(){
    const g = new THREE.Group(), m = CMAT(0x2e3a24, {roughness:0.7}), d = CMAT(0x1a2214);
    const body = sph(0.5, m, 0, 0.55, 0.1); body.scale.set(0.8, 0.55, 2.2); g.add(body);
    const head = box(0.5, 0.3, 0.7, m, 0, 0.6, -1.2); g.add(head);
    g.add(box(0.46, 0.06, 0.6, CMAT(0xc84020), 0, 0.5, -1.25));
    for(let k=0;k<7;k++) g.add(new THREE.Mesh(new THREE.ConeGeometry(0.06,0.3,4), CMAT(0xb8b090)).translateY(0.85).translateZ(-0.7+k*0.28));
    g.add(sph(0.04, CMAT(0xffd020,{emissive:0xffc010,emissiveIntensity:1.5}), -0.2, 0.72, -1.4)); g.add(sph(0.04, CMAT(0xffd020,{emissive:0xffc010,emissiveIntensity:1.5}), 0.2, 0.72, -1.4));
    [[-0.5,-0.6],[0.5,-0.6],[-0.5,0.7],[0.5,0.7]].forEach(([x,z])=>{ const a = box(0.13, 0.55, 0.13, d, x, 0.27, z); a.rotation.z = x>0?-0.4:0.4; a.name='leg'; g.add(a); });
    const tail = box(0.18, 0.15, 1.4, m, 0, 0.45, 1.6); tail.rotation.x = 0.1; g.add(tail);
    return g;
  },
  // poça de piche viva
  gosma(){
    const g = new THREE.Group();
    const blob = sph(1.0, new THREE.MeshStandardMaterial({color:0x0c0a10, emissive:0x1a0820, emissiveIntensity:0.4, roughness:0.05, metalness:0.6}), 0, 0.4, 0);
    blob.scale.set(1.3, 0.45, 1.3); blob.name='blob'; g.add(blob);
    for(let k=0;k<6;k++) g.add(sph(0.14, CMAT(0x1a1020,{roughness:0.1, metalness:0.5}), rand(-0.8,0.8), rand(0.15,0.5), rand(-0.8,0.8)));
    return g;
  },
  // caixa de madeira com chave de corda em cima; quando "abre", vira uma criatura alta
  caixa_musica(){
    const g = new THREE.Group(), wood = CMAT(0x5a3418, {roughness:0.6}), brass = CMAT(0xb08a3a, {metalness:0.8, roughness:0.3});
    const boxM = box(0.8, 0.6, 0.6, wood, 0, 0.3, 0); g.add(boxM);
    g.add(box(0.82, 0.05, 0.62, brass, 0, 0.12, 0)); g.add(box(0.82, 0.05, 0.62, brass, 0, 0.5, 0));
    const crank = new THREE.Group(); crank.position.set(0, 0.62, 0); crank.name='crank';
    crank.add(cyl(0.03, 0.03, 0.2, brass, 0, 0.1, 0)); crank.add(box(0.28, 0.12, 0.03, brass, 0, 0.24, 0)); g.add(crank);
    const lid = box(0.82, 0.06, 0.62, CMAT(0x3a2010), 0, 0.63, 0); lid.name='lid'; g.add(lid);
    const jack = new THREE.Group(); jack.name='jack'; jack.visible = false; g.add(jack);
    const dark = CMAT(0x1a1210, {roughness:0.9});
    jack.add(box(0.35, 2.2, 0.3, dark, 0, 1.7, 0));
    const head = box(0.5, 0.6, 0.45, CMAT(0xd8ccb0), 0, 3.05, 0); jack.add(head);
    jack.add(box(0.36, 0.1, 0.02, CMAT(0x200000), 0, 2.9, -0.24));
    jack.add(sph(0.07, CMAT(0xff2010,{emissive:0xff1000,emissiveIntensity:2}), -0.12, 3.15, -0.23)); jack.add(sph(0.07, CMAT(0xff2010,{emissive:0xff1000,emissiveIntensity:2}), 0.12, 3.15, -0.23));
    [-0.55,0.55].forEach(x=>{ const arm = box(0.08, 2.0, 0.08, dark, x, 2.0, -0.3); arm.rotation.x = -1.0; arm.rotation.z = x>0?-0.3:0.3; jack.add(arm); });
    return g;
  },
  // robô de vigilância cinza com sensor vermelho e arma no braço
  sentinela(){
    const g = new THREE.Group(), grey = CMAT(0x5a5e62, {metalness:0.6, roughness:0.4}), dark = CMAT(0x22262a, {metalness:0.5});
    [-0.2,0.2].forEach(x=>{ const l = box(0.22, 1.0, 0.26, dark, x, 0.5, 0); l.name='leg'; g.add(l); });
    g.add(box(0.8, 0.9, 0.5, grey, 0, 1.45, 0));
    g.add(box(0.82, 0.08, 0.52, CMAT(0xc8a020), 0, 1.05, 0));
    g.add(box(0.5, 0.4, 0.45, grey, 0, 2.1, 0));
    const eye = sph(0.1, CMAT(0x200000), 0, 2.12, -0.23); eye.name='eye'; g.add(eye);
    g.add(box(0.15, 0.15, 0.6, dark, -0.5, 1.5, 0)); // braço esquerdo
    const gun = box(0.12, 0.14, 1.0, dark, 0.5, 1.4, -0.35); g.add(gun);
    g.add(cyl(0.04, 0.04, 0.2, CMAT(0x101010), 0.5, 1.4, -0.9).rotateX(Math.PI/2));
    g.add(box(0.05, 0.4, 0.05, dark, 0.15, 2.45, 0.1)); // antena
    return g;
  },
  // tripulante de macacão com o visor do capacete vazio
  sosia(){
    const g = new THREE.Group(), suit = MAT.suit, d = CMAT(0x3a2a1a);
    [-0.13,0.13].forEach(x=>{ const l = box(0.18, 0.85, 0.2, suit, x, 0.43, 0); l.name='leg'; g.add(l); });
    g.add(box(0.55, 0.75, 0.32, suit, 0, 1.25, 0)); g.add(box(0.45, 0.5, 0.2, CMAT(0x4a4a4a), 0, 1.3, 0.25));
    [-0.35,0.35].forEach(x=>{ const a = box(0.13, 0.8, 0.13, suit, x, 1.15, 0); a.name='arm'; g.add(a); });
    g.add(sph(0.24, CMAT(0xb0b4b8, {metalness:0.5, roughness:0.3}), 0, 1.86, 0));
    const visor = sph(0.17, CMAT(0x000000, {roughness:0.05, metalness:1}), 0, 1.87, -0.1); visor.scale.set(1, 0.7, 0.8); g.add(visor);
    return g;
  },
  mimico_sucata(){ return new THREE.Group(); }, // usa o visual de uma sucata (ver spawn)
  // cão pálido sem pelos, focinho comprido
  farejador(){
    const g = new THREE.Group(), m = CMAT(0xc8b8a8, {roughness:0.6}), d = CMAT(0x8a7a6a);
    const body = sph(0.5, m, 0, 0.9, 0.2); body.scale.set(0.7, 0.7, 1.8); g.add(body);
    for(let k=0;k<5;k++) g.add(box(0.72, 0.03, 0.06, d, 0, 0.95, -0.1+k*0.15)); // costelas
    const head = box(0.3, 0.3, 0.8, m, 0, 1.0, -0.95); g.add(head);
    g.add(box(0.26, 0.06, 0.5, CMAT(0x7a1010), 0, 0.88, -1.2));
    [[-0.26,-0.5],[0.26,-0.5],[-0.26,0.8],[0.26,0.8]].forEach(([x,z])=>{ const l = box(0.12, 0.85, 0.12, d, x, 0.42, z); l.name='leg'; g.add(l); });
    [-0.12,0.12].forEach(x=>{ const e = box(0.06, 0.2, 0.05, d, x, 1.22, -0.65); e.rotation.x = 0.4; g.add(e); }); // orelhas
    return g;
  },
  // humanoide magro e altíssimo, cabeça sem rosto
  colosso(){
    const g = new THREE.Group(), skin = CMAT(0x5a524a, {roughness:1}), d = CMAT(0x3a342e);
    [-0.9,0.9].forEach(x=>{ const l = cyl(0.4, 0.55, 7.5, skin, x, 3.75, 0); l.name='leg'; g.add(l); });
    g.add(cyl(1.2, 0.9, 5, skin, 0, 9.8, 0));
    [-1.6,1.6].forEach(x=>{ const a = cyl(0.3, 0.25, 7.5, skin, x, 8.2, 0); a.rotation.z = x>0?0.08:-0.08; a.name='arm'; g.add(a); });
    const head = sph(0.9, skin, 0, 13.0, 0); head.scale.set(0.8, 1.4, 0.8); g.add(head);
    g.add(box(0.9, 0.12, 0.1, d, 0, 12.4, -0.72));
    g.add(sph(0.12, CMAT(0xffe8a0,{emissive:0xffd060,emissiveIntensity:1.5}), -0.3, 13.3, -0.68)); g.add(sph(0.12, CMAT(0xffe8a0,{emissive:0xffd060,emissiveIntensity:1.5}), 0.3, 13.3, -0.68));
    return g;
  },
  verme(){
    const g = new THREE.Group(), m = CMAT(0x5a4a3a, {roughness:1}), d = CMAT(0x2a1a12);
    for(let k=0;k<7;k++){ const s = cyl(2.4-k*0.08, 2.5-k*0.08, 3, k%2?m:d, 0, 1.5+k*3, 0, 12); g.add(s); }
    const mouth = new THREE.Group(); mouth.position.y = 21; g.add(mouth);
    for(let k=0;k<12;k++){ const a = k/12*Math.PI*2; mouth.add(new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.2, 4), CMAT(0xe8e2d0)).translateX(Math.cos(a)*1.9).translateZ(Math.sin(a)*1.9).rotateX(Math.PI)); }
    return g;
  },
};

// ------------------------------------------------------------------ utilidades
function creatureEye(c){ return {x:c.pos.x, y:c.pos.y+(c.eyeH||1.6), z:c.pos.z}; }
function playerEye(){ if(player===localPlayer) return {x:camera.position.x, y:camera.position.y, z:camera.position.z}; return {x:player.pos.x, y:player.pos.y+(player.crouch?1.0:1.62), z:player.pos.z}; }
function sameZone(c){ return c.inFacility === player.inFacility && player.alive && S.phase==='moon'; }
function distToPlayer(c){ return Math.hypot(c.pos.x-player.pos.x, c.pos.z-player.pos.z); }
// a criatura enxerga o jogador?
function creatureSeesPlayer(c, range, fov){
  if(!sameZone(c)) return false;
  if(!c.inFacility && playerInShip() && !S.shipDoorOpen) return false;
  const d = distToPlayer(c); if(d > range) return false;
  if(fov < Math.PI*2){
    const ang = Math.atan2(-(player.pos.x-c.pos.x), -(player.pos.z-c.pos.z));
    if(Math.abs(angleDiff(ang, c.yaw)) > fov/2 && d > 2.5) return false;
  }
  return lineOfSight(creatureEye(c), playerEye(), c.inFacility);
}
// o jogador está olhando pra criatura? (dentro da tela + linha de visão)
const _v3 = new THREE.Vector3();
function playerLooksAt(c, maxDist=40, margin=1.0){
  if(!sameZone(c) || player.latched) return false;
  if(distToPlayer(c) > maxDist) return false;
  const pts = c.lookPoints || [0.3, 1.1, 1.9];
  if(player!==localPlayer){ // jogador remoto: usa o ângulo da câmera dele
    const e = playerEye();
    for(const h of pts){
      const dx = c.pos.x-e.x, dy = c.pos.y+h-e.y, dz = c.pos.z-e.z, d = Math.hypot(dx,dz);
      const yawTo = Math.atan2(-dx, -dz), pitchTo = Math.atan2(dy, d);
      if(Math.abs(angleDiff(yawTo, player.yaw)) < 0.95*margin && Math.abs(pitchTo-player.pitch) < 0.62*margin && lineOfSight(e, {x:c.pos.x, y:c.pos.y+h, z:c.pos.z}, c.inFacility)) return true;
    }
    return false;
  }
  for(const h of pts){
    _v3.set(c.pos.x, c.pos.y+h, c.pos.z).project(camera);
    if(_v3.z < 1 && Math.abs(_v3.x) < margin && Math.abs(_v3.y) < margin){
      if(lineOfSight(playerEye(), {x:c.pos.x, y:c.pos.y+h, z:c.pos.z}, c.inFacility)) return true;
    }
  }
  return false;
}
function faceTowards(c, x, z, dt, rate=8){
  const target = Math.atan2(-(x-c.pos.x), -(z-c.pos.z));
  c.yaw += angleDiff(target, c.yaw)*Math.min(1, dt*rate);
}
// anda até (x,z) — dentro usa A*, fora vai direto desviando
function moveTowards(c, x, z, speed, dt){
  if(speed<=0) return true;
  let tx = x, tz = z;
  if(c.inFacility){
    c.pathT -= dt;
    const goalMoved = !c.pathGoal || Math.hypot(c.pathGoal.x-x, c.pathGoal.z-z) > 1.5;
    if(c.pathT <= 0 || goalMoved || !c.path){
      c.path = findPath(c.pos.x, c.pos.z, x, z, true) || null;
      c.pathGoal = {x, z}; c.pathT = 0.45 + GR()*0.3;
    }
    if(c.path && c.path.length){
      // pula nós já visíveis (caminho mais suave)
      let k = 0;
      for(let n=Math.min(c.path.length-1, 6); n>0; n--){ if(facilityLOS(c.pos.x, c.pos.z, c.path[n].x, c.path[n].z)){ k = n; break; } }
      if(k>0) c.path.splice(0, k);
      tx = c.path[0].x; tz = c.path[0].z;
      if(Math.hypot(tx-c.pos.x, tz-c.pos.z) < 0.4){ c.path.shift(); if(c.path.length){ tx = c.path[0].x; tz = c.path[0].z; } else { tx = x; tz = z; } }
    } else if(!c.path && !facilityLOS(c.pos.x,c.pos.z,x,z)) { return false; }
  }
  const dx = tx-c.pos.x, dz = tz-c.pos.z, d = Math.hypot(dx,dz);
  if(d < 0.05) return true;
  const step = Math.min(d, speed*dt);
  let ux = dx/d, uz = dz/d;
  const ok = moveEntity(c.pos, ux*step, uz*step, c.radius||0.5, c.inFacility, c.maxStep||1.2, true);
  if(!ok && !c.inFacility){ // desvia de obstáculos lá fora
    for(const a of [0.7,-0.7,1.4,-1.4]){
      const rx = ux*Math.cos(a)-uz*Math.sin(a), rz = ux*Math.sin(a)+uz*Math.cos(a);
      if(moveEntity(c.pos, rx*step, rz*step, c.radius||0.5, false, c.maxStep||1.2, true)) break;
    }
  }
  c.yaw += angleDiff(Math.atan2(-dx,-dz), c.yaw)*Math.min(1, dt*(c.turnRate||8));
  c.moving = true;
  return Math.hypot(x-c.pos.x, z-c.pos.z) < 0.8;
}
function randomFacilityPoint(nearX, nearZ, minD=0, maxD=999){
  for(let k=0;k<60;k++){
    const c = pick(FAC.cells), i = c.x*FAC.CT+randInt(3,4), j = c.z*FAC.CT+randInt(3,4);
    if(!tileWalkable(i,j,true)) continue;
    const p = tileCenter(i,j), d = Math.hypot(p.x-nearX, p.z-nearZ);
    if(d>=minD && d<=maxD) return p;
  }
  return tileCenter(FAC.lobby.x*FAC.CT+3, FAC.lobby.z*FAC.CT+3);
}
function randomOutdoorPoint(nearX, nearZ, minD=0, maxD=999){
  for(let k=0;k<80;k++){
    const x = rand(worldBounds.minX+10, worldBounds.maxX-10), z = rand(worldBounds.minZ+10, worldBounds.maxZ-10);
    if(isSolidOutside(x,z)) continue;
    const d = Math.hypot(x-nearX, z-nearZ);
    if(d<minD || d>maxD) continue;
    if(isInsideShip(x,z)) continue;
    return {x, z};
  }
  return {x:nearX+rand(-10,10), z:nearZ+rand(-10,10)};
}
function discoverCreature(type){
  if(S.discovered.has(type)) return;
  S.discovered.add(type);
  toast(`Novo registro no bestiário: ${CREATURES[type].name}`);
}

// ------------------------------------------------------------------ spawn
// Pernas e braços giravam pelo meio (atravessando o chão). Aqui cada perna/braço vira
// um "pivô" no quadril/ombro, pra balançar do jeito certo ao andar.
function wrapLimbs(root){
  const limbs = [];
  root.traverse(o=>{ if(o.isMesh && (o.name==='leg' || o.name==='arm')) limbs.push(o); });
  limbs.forEach(m=>{
    m.geometry.computeBoundingBox();
    const bb = m.geometry.boundingBox, half = (bb.max.y-bb.min.y)/2*m.scale.y;
    const pivot = new THREE.Group(); pivot.name = m.name;
    pivot.position.set(m.position.x, m.position.y + half, m.position.z);
    pivot.rotation.copy(m.rotation); m.rotation.set(0,0,0);
    m.position.set(0, -half, 0); m.name = '';
    const parent = m.parent; parent.remove(m); pivot.add(m); parent.add(pivot);
    pivot.userData.baseX = pivot.rotation.x;
  });
  root.traverse(o=>{ if(o.isGroup && (o.name==='leg' || o.name==='arm') && o.userData.baseX===undefined) o.userData.baseX = o.rotation.x; });
}
function spawnCreature(type, x, z, inFacility, opts={}){
  const def = CREATURES[type];
  const g = makeVisual('creatures', type, ()=>{ const v = CREATURE_BUILD[type](); wrapLimbs(v); return v; });
  addToLevel(g);
  const c = {type, def, pos:new THREE.Vector3(x, inFacility?0:groundAt(x,z,false), z), yaw:rand(0,Math.PI*2), inFacility,
    hp:def.hp, state:'idle', t:0, timer:0, visual:g, stun:0, path:null, pathT:0, pathGoal:null, attackCd:0, alive:true,
    radius:0.45, eyeH:1.6, anim:0, moving:false, target:null};
  Object.assign(c, opts);
  CREATURE_INIT[type] && CREATURE_INIT[type](c);
  g.traverse(o=>{ if(o.isMesh || o.isSprite) o.userData.creature = c; });
  g.userData.onModelReady = meshes=>meshes.forEach(m=>m.userData.creature=c);
  c.nid = (spawnCreature._n = (spawnCreature._n||0)+1);
  creatures.push(c);
  return c;
}
function removeCreature(c){
  c.alive = false;
  if(c.visual.parent) c.visual.parent.remove(c.visual);
  if(c.fakeItem) removeItemFromWorld(c.fakeItem);
  if(player.latched===c){ player.latched = null; setMuffled(false); }
  if(player.grabbedBy===c) player.grabbedBy = null;
  if(c.loopId) loopStop(c.loopId);
}
function hurtCreature(c, dmg, fromPos){
  if(c.isProxy){ netRelay('hurt', {nid:c.nid, dmg}); return; }
  if(!c.alive) return;
  if(c.onHurt) c.onHurt(c, fromPos);
  if(c.hp===null || c.hp===undefined){ return; }
  c.hp -= dmg;
  c.hurtFlash = 0.15;
  if(c.hp <= 0){
    sfx('splat', {x:c.pos.x, z:c.pos.z, inFacility:c.inFacility});
    if(CREATURE_DIE[c.type]) CREATURE_DIE[c.type](c);
    // corpo vira um "monte" escuro
    const corpse = c.visual; corpse.rotation.z = Math.PI/2; corpse.position.y = c.pos.y+0.2; corpse.scale.multiplyScalar(0.9);
    c.alive = false; c.dead = true;
    if(player.latched===c){ player.latched=null; setMuffled(false); }
    if(player.grabbedBy===c) player.grabbedBy = null;
    if(c.fakeItem) removeItemFromWorld(c.fakeItem);
    creatures = creatures.filter(x=>x!==c);
  }
}
function stunCreature(c, secs){ if(c.isProxy){ netRelay('stun', {nid:c.nid, secs}); return; } c.stun = Math.max(c.stun, secs); }

const CREATURE_INIT = {
  juntador(c){
    c.radius = 0.4; c.eyeH = 0.7; c.lookPoints=[0.5];
    const p = randomFacilityPoint(c.pos.x, c.pos.z, 0, 30);
    c.nest = {x:p.x, z:p.z, items:[]};
    const nest = new THREE.Group(); nest.position.set(p.x, 0.02, p.z); addToLevel(nest);
    for(let k=0;k<14;k++){ const tw = box(0.6, 0.05, 0.05, CMAT(0x4a3a22), 0, 0.03, 0); tw.rotation.y = k*0.45; tw.position.set(Math.cos(k)*0.5, 0.03, Math.sin(k)*0.5); nest.add(tw); }
    c.state = 'search'; c.chirpT = rand(1,4);
  },
  lacrador(c){ c.radius = 0.3; c.eyeH = 0.3; c.lookPoints=[0.2]; c.state = 'toCeiling'; c.goal = randomFacilityPoint(c.pos.x, c.pos.z, 4, 40); c.y = 0; c.struggle = 0; },
  tecela(c){
    c.radius = 0.8; c.eyeH = 1.0; c.lookPoints=[0.6,1.2]; c.lair = {x:c.pos.x, z:c.pos.z}; c.state = 'wait';
    // teias nas passagens próximas
    const [ti,tj] = tileOf(c.pos.x, c.pos.z); let made = 0;
    for(let k=0;k<80 && made<5;k++){
      const i = ti+randInt(-14,14), j = tj+randInt(-14,14);
      if(!inGrid(i,j) || !FAC.walk[tIdx(i,j)] || FAC.block[tIdx(i,j)] || FAC.doorAt[tIdx(i,j)]) continue;
      // só em corredores (vizinhos opostos bloqueados)
      const corridorX = !FAC.walk[tIdx(i,j-1)] && !FAC.walk[tIdx(i,j+1)];
      const corridorZ = !FAC.walk[tIdx(i-1,j)] && !FAC.walk[tIdx(i+1,j)];
      if(!corridorX && !corridorZ) continue;
      if(FAC.webs.some(w=>Math.abs(w.i-i)<3 && Math.abs(w.j-j)<3)) continue;
      const p = tileCenter(i,j);
      const web = new THREE.Mesh(new THREE.PlaneGeometry(FAC.T*1.0, 3.2), MAT.web);
      web.position.set(p.x, 1.6, p.z); web.rotation.y = corridorX ? 0 : Math.PI/2; addToLevel(web);
      FAC.webs.push({i, j, x:p.x, z:p.z, mesh:web, hp:2, owner:c}); made++;
    }
  },
  espreitador(c){ c.radius = 0.4; c.eyeH = 2.1; c.state = 'stalk'; c.anger = 0; c.stalkT = 0; c.lookPoints=[0.6,1.4,2.1]; },
  manequim(c){ c.radius = 0.4; c.eyeH = 2.0; c.state = 'idle'; c.wasMoving = false; c.lookPoints=[0.2,1.0,1.7,2.1]; },
  rasteiro(c){ c.radius = 0.6; c.eyeH = 0.9; c.state = 'roam'; c.speed = 0; c.lookPoints=[0.5,1.0]; c.turnRate = 3; },
  gosma(c){ c.radius = 1.0; c.eyeH = 0.5; c.state = 'ooze'; c.lookPoints=[0.4]; },
  caixa_musica(c){ c.radius = 0.5; c.eyeH = 1.0; c.state = 'follow'; c.timer = rand(30, 55); c.lookPoints=[0.5]; },
  sentinela(c){ c.radius = 0.5; c.eyeH = 2.1; c.state = 'patrol'; c.timer = rand(6,10); c.shells = 2; c.lookPoints=[0.6,1.5,2.4]; c.speakT = 0; },
  sosia(c){ c.radius = 0.4; c.eyeH = 1.8; c.state = 'wander'; c.lookPoints=[0.5,1.3,1.9]; },
  mimico_sucata(c){
    c.radius = 0.35; c.eyeH = 0.4; c.state = 'disguised'; c.lookPoints=[0.2];
    // finge ser uma sucata: cria um item falso no chão
    const def = pick(SCRAP.filter(s=>!s.twoHanded));
    const fake = makeScrapItem(def, 1.3);
    fake.value = Math.round(fake.value*rand(1.3, 2.0)); // valor "bom demais"
    fake.mimicOf = c;
    placeItemInWorld(fake, c.pos.x, 0, c.pos.z, true);
    c.fakeItem = fake; c.visual.visible = false;
    const mouth = new THREE.Group(); mouth.visible = false; mouth.name = 'mouth'; c.visual.add(mouth);
    mouth.add(sph(0.35, CMAT(0x6a1a1a), 0, 0.35, 0));
    for(let k=0;k<10;k++){ const a=k/10*Math.PI*2; mouth.add(new THREE.Mesh(new THREE.ConeGeometry(0.04,0.18,4), CMAT(0xe8e2d0)).translateX(Math.cos(a)*0.28).translateZ(Math.sin(a)*0.28).translateY(0.5)); }
  },
  farejador(c){ c.radius = 0.6; c.eyeH = 1.1; c.state = 'roam'; c.breathT = rand(1,3); c.lookPoints=[0.6,1.1]; c.maxStep = 1.0; },
  colosso(c){ c.radius = 1.4; c.eyeH = 13.0; c.state = 'roam'; c.stepT = 0; c.lookPoints=[2,7,12]; c.maxStep = 3; },
  verme(c){ c.state = 'under'; c.timer = rand(25, 50); c.visual.visible = false; c.lookPoints=[5,12]; c.radius = 2.5; },
};
const CREATURE_DIE = {
  sentinela(c){
    const gun = makeToolItem('espingarda'); gun.value = randInt(30,90); gun.kind='tool';
    placeItemInWorld(gun, c.pos.x+0.4, 0, c.pos.z, true);
    for(let k=0;k<2;k++){ const sh = makeToolItem('cartucho'); placeItemInWorld(sh, c.pos.x-0.3+k*0.2, 0, c.pos.z+0.4, true); }
  },
  juntador(c){ if(c.carrying){ placeItemInWorld(c.carrying, c.pos.x, 0, c.pos.z, true); c.carrying.carriedBy = null; c.carrying = null; } },
};

// ------------------------------------------------------------------ comportamento
const THINK = {
  juntador(c, dt){
    c.chirpT -= dt; if(c.chirpT<=0){ c.chirpT = rand(2,6); sfx('chirp', {x:c.pos.x, z:c.pos.z, inFacility:true}, 0.7, 25); }
    const dP = distToPlayer(c), nearNest = Math.hypot(player.pos.x-c.nest.x, player.pos.z-c.nest.z);
    const holdingNestItem = player.inv.some(it=>it && it.nestOf===c);
    if(sameZone(c) && c.state!=='angry' && ((nearNest < 2.8 && Math.hypot(c.pos.x-c.nest.x,c.pos.z-c.nest.z) < 9) || (holdingNestItem && dP < 9 && creatureSeesPlayer(c, 12, Math.PI*2)))){
      c.state = 'angry'; c.timer = 12; sfx('screech', {x:c.pos.x, z:c.pos.z, inFacility:true});
    }
    if(c.state==='angry'){
      c.timer -= dt;
      if(!sameZone(c) || c.timer<=0){ c.state='search'; return; }
      moveTowards(c, player.pos.x, player.pos.z, 5.2, dt);
      if(dP < 1.1 && c.attackCd<=0){ c.attackCd = 1.0; damagePlayer(30, 'Juntador', c.pos); sfx('bite', {x:c.pos.x,z:c.pos.z,inFacility:true}); }
      return;
    }
    if(c.state==='search'){
      if(!c.goalItem || !worldItems.includes(c.goalItem) || c.goalItem.nestOf===c){
        const free = worldItems.filter(it=>it.inFacility && !it.nestOf && !it.mimicOf && !it.busy && !it.carriedBy && Math.hypot(it.pos.x-c.pos.x,it.pos.z-c.pos.z) < 35 && !it.def.apparatus);
        c.goalItem = free.length ? free.sort((a,b)=>Math.hypot(a.pos.x-c.pos.x,a.pos.z-c.pos.z)-Math.hypot(b.pos.x-c.pos.x,b.pos.z-c.pos.z))[0] : null;
        if(!c.goalItem){ c.state = 'guard'; c.timer = rand(6,12); return; }
      }
      if(moveTowards(c, c.goalItem.pos.x, c.goalItem.pos.z, 3.2, dt) || Math.hypot(c.goalItem.pos.x-c.pos.x, c.goalItem.pos.z-c.pos.z)<0.9){
        const it = c.goalItem; removeItemFromWorld(it); it.carriedBy = c; c.carrying = it; c.goalItem = null; c.state = 'carry';
        buildItemMesh(it); addToLevel(it.mesh);
      }
    } else if(c.state==='carry'){
      if(c.carrying && c.carrying.mesh){ c.carrying.mesh.position.set(c.pos.x, 1.05, c.pos.z); }
      if(moveTowards(c, c.nest.x, c.nest.z, 3.2, dt)){
        const it = c.carrying; c.carrying = null; it.carriedBy = null;
        if(it.mesh && it.mesh.parent) it.mesh.parent.remove(it.mesh);
        placeItemInWorld(it, c.nest.x+rand(-0.5,0.5), 0, c.nest.z+rand(-0.5,0.5), true);
        it.nestOf = c; c.nest.items.push(it);
        c.state = 'guard'; c.timer = rand(4,10);
      }
    } else if(c.state==='guard'){
      c.timer -= dt; if(c.timer<=0) c.state='search';
      if(Math.hypot(c.pos.x-c.nest.x, c.pos.z-c.nest.z) > 1.5) moveTowards(c, c.nest.x, c.nest.z, 2.5, dt);
    }
  },
  lacrador(c, dt){
    const dP = distToPlayer(c);
    if(c.state==='toCeiling'){
      if(moveTowards(c, c.goal.x, c.goal.z, 2.5, dt)){ c.state='climb'; }
      c.y = 0;
    } else if(c.state==='climb'){
      c.y = Math.min(FAC.H-0.25, c.y + dt*2.5); c.visual.rotation.z = Math.PI*(c.y/(FAC.H-0.25));
      if(c.y >= FAC.H-0.26) c.state = 'ceiling';
    } else if(c.state==='ceiling'){
      c.visual.rotation.z = Math.PI;
      if(sameZone(c) && dP < 1.0){ c.state='drop'; sfx('skitter', {x:c.pos.x,z:c.pos.z,inFacility:true}, 1); }
    } else if(c.state==='drop'){
      c.y -= dt*9; c.visual.rotation.z = 0;
      if(sameZone(c) && dP < 1.3 && c.y < 1.9 && !player.latched){ c.state='latched'; player.latched = c; c.struggle = 0; if(player===localPlayer){ setMuffled(true); toast('ALGO GRUDOU NA SUA CABEÇA! Aperte E várias vezes!'); } return; }
      if(c.y <= 0){ c.y = 0; c.state='floor'; c.timer = rand(2,4); }
    } else if(c.state==='floor'){
      c.timer -= dt; c.visual.rotation.z = 0;
      if(c.timer<=0){ c.state='toCeiling'; c.goal = randomFacilityPoint(c.pos.x, c.pos.z, 6, 40); }
    } else if(c.state==='latched'){
      c.pos.x = player.pos.x; c.pos.z = player.pos.z; c.y = (player===localPlayer ? camera.position.y : player.pos.y+1.62) - 0.05;
      c.visual.rotation.z = 0;
      if(!player.inFacility || !player.alive){ detachLacrador(c); return; }
      damagePlayer(9*dt, 'Sufocado pelo Lacrador');
      player.invuln = 0;
      if(c.struggle >= 12) detachLacrador(c);
    }
    c.pos.y = c.y;
  },
  tecela(c, dt){
    const dP = distToPlayer(c);
    if(c.state==='wait'){
      if(creatureSeesPlayer(c, 9, Math.PI*1.4)){ c.state='hunt'; c.timer = 8; sfx('skitter', {x:c.pos.x,z:c.pos.z,inFacility:true}, 1); }
      if(Math.hypot(c.pos.x-c.lair.x, c.pos.z-c.lair.z) > 1) moveTowards(c, c.lair.x, c.lair.z, 3, dt);
    } else if(c.state==='hunt'){
      const sees = creatureSeesPlayer(c, 20, Math.PI*2);
      if(sees){ c.timer = 8; c.last = {x:player.pos.x, z:player.pos.z}; }
      c.timer -= dt;
      const tgt = c.alertPos || c.last || player.pos;
      moveTowards(c, sees?player.pos.x:tgt.x, sees?player.pos.z:tgt.z, 5.6, dt);
      if(c.alertPos && Math.hypot(c.pos.x-c.alertPos.x, c.pos.z-c.alertPos.z)<1.2) c.alertPos = null;
      if(GR()<dt*3) sfx('skitter', {x:c.pos.x,z:c.pos.z,inFacility:true}, 0.6, 20);
      if(dP < 1.5 && sameZone(c) && c.attackCd<=0){ c.attackCd = 1.2; damagePlayer(45, 'Tecelã', c.pos); sfx('bite', {x:c.pos.x,z:c.pos.z,inFacility:true}); }
      if(c.timer <= 0 || Math.hypot(c.pos.x-c.lair.x, c.pos.z-c.lair.z) > 35){ c.state='return'; }
    } else if(c.state==='return'){
      if(moveTowards(c, c.lair.x, c.lair.z, 3.5, dt)) c.state='wait';
      if(creatureSeesPlayer(c, 7, Math.PI)) { c.state='hunt'; c.timer = 8; }
    }
  },
  espreitador(c, dt){
    const dP = distToPlayer(c);
    const seen = playerLooksAt(c, 28, 0.85);
    if(!sameZone(c)){ c.state='stalk'; if(GR()<dt*0.2){ c.wander = randomFacilityPoint(c.pos.x,c.pos.z,5,30); } if(c.wander) moveTowards(c, c.wander.x, c.wander.z, 2.5, dt); return; }
    if(c.state==='angry'){
      moveTowards(c, player.pos.x, player.pos.z, 7.6, dt);
      if(dP < 1.2) killPlayer('Pescoço quebrado (Espreitador)');
      c.timer -= dt; if(c.timer<=0){ c.state='evade'; c.timer = 5; c.anger = 0; }
      return;
    }
    if(seen){
      c.anger += dt*(dP < 5 ? 2.2 : 1);
      if(c.state!=='evade'){ c.state='evade'; c.timer = rand(3,6); c.flee = randomFacilityPoint(player.pos.x, player.pos.z, 14, 50); sfx('growl', {x:c.pos.x,z:c.pos.z,inFacility:true}, 0.4); }
      if(c.anger > 3.5){ c.state='angry'; c.timer = 10; sfx('screech', {x:c.pos.x,z:c.pos.z,inFacility:true}, 1.2); return; }
    } else c.anger = Math.max(0, c.anger - dt*0.15);
    if(c.state==='evade'){
      moveTowards(c, c.flee.x, c.flee.z, 6.5, dt);
      c.timer -= dt; if(c.timer <= 0){ c.state='stalk'; }
      return;
    }
    // persegue por trás, fora da vista
    const back = {x:player.pos.x + Math.sin(player.yaw)*3.0, z:player.pos.z + Math.cos(player.yaw)*3.0};
    const goal = dP < 4 ? player.pos : back;
    moveTowards(c, goal.x, goal.z, dP > 6 ? 5.0 : 3.2, dt);
    c.stalkT += dt;
    if(dP < 1.3 && !seen && c.stalkT > 6) killPlayer('Pescoço quebrado (Espreitador)');
  },
  manequim(c, dt){
    const seen = playerLooksAt(c, 45, 1.05);
    if(c.stun > 0) return;
    if(!sameZone(c)){ c.wasMoving = false; return; }
    if(seen){
      if(c.wasMoving){ sfx('boing', {x:c.pos.x,z:c.pos.z,inFacility:true}, 1.0); c.wasMoving = false; c.wobble = 1; }
      return;
    }
    c.wasMoving = true;
    moveTowards(c, player.pos.x, player.pos.z, 9.0, dt);
    c.stepS = (c.stepS||0) - dt; if(c.stepS<=0){ c.stepS = 0.28; sfx('springStep', {x:c.pos.x,z:c.pos.z,inFacility:true}, 0.7, 30); }
    if(distToPlayer(c) < 1.1) killPlayer('Manequim');
  },
  rasteiro(c, dt){
    const sees = creatureSeesPlayer(c, 18, 2.4);
    if(sees){ if(c.state!=='chase') sfx('roar', {x:c.pos.x,z:c.pos.z,inFacility:true}, 0.6); c.state='chase'; c.lost = 0; c.last = {x:player.pos.x, z:player.pos.z}; }
    if(c.state==='chase'){
      if(!sees){ c.lost += dt; if(c.lost > 5){ c.state='roam'; c.speed = 0; } }
      const tgt = sees ? player.pos : c.last;
      const desired = Math.atan2(-(tgt.x-c.pos.x), -(tgt.z-c.pos.z));
      const turn = Math.abs(angleDiff(desired, c.yaw));
      if(turn > 0.6) c.speed = Math.max(1.8, c.speed - dt*18); else c.speed = Math.min(9.5, c.speed + dt*4.5);
      moveTowards(c, tgt.x, tgt.z, c.speed, dt);
      if(distToPlayer(c) < 1.3 && sameZone(c) && c.attackCd<=0){ c.attackCd = 1.0; damagePlayer(40, 'Rasteiro', c.pos); sfx('bite', {x:c.pos.x,z:c.pos.z,inFacility:true}); }
    } else {
      if(!c.wander || Math.hypot(c.wander.x-c.pos.x, c.wander.z-c.pos.z)<1) c.wander = randomFacilityPoint(c.pos.x, c.pos.z, 8, 40);
      moveTowards(c, c.wander.x, c.wander.z, 3.0, dt);
    }
  },
  gosma(c, dt){
    const d = distToPlayer(c);
    if(sameZone(c) && d < 28) moveTowards(c, player.pos.x, player.pos.z, 1.1, dt);
    else if(GR()<dt*0.1){ c.wander = randomFacilityPoint(c.pos.x,c.pos.z,3,15); }
    else if(c.wander) moveTowards(c, c.wander.x, c.wander.z, 0.6, dt);
    if(sameZone(c) && d < 1.5){ damagePlayer(35*dt, 'Gosma'); player.invuln = 0; player.slowed = 0.5; }
    if(GR()<dt*0.5) sfx('slime', {x:c.pos.x,z:c.pos.z,inFacility:true}, 0.6, 18);
    const blob = c.visual.getObjectByName('blob'); if(blob){ const t = performance.now()*0.003; blob.scale.set(1.2+Math.sin(t)*0.08, 0.6+Math.cos(t*1.3)*0.06, 1.2+Math.cos(t)*0.08); }
  },
  caixa_musica(c, dt){
    const jack = c.visual.getObjectByName('jack'), lid = c.visual.getObjectByName('lid'), crank = c.visual.getObjectByName('crank');
    const inside = sameZone(c);
    if(c.state==='follow'){
      if(inside){
        const d = distToPlayer(c);
        if(d > 7) moveTowards(c, player.pos.x, player.pos.z, 3.0, dt);
        c.timer -= dt;
        if(c.timer <= 0){ c.state='crank'; c.timer = rand(18,28); }
      }
    } else if(c.state==='crank'){
      c.timer -= dt;
      if(crank) crank.rotation.x += dt*8;
      c.visual.position.x = c.pos.x + Math.sin(performance.now()*0.05)*0.02;
      tickMusicBox(dt, {x:c.pos.x, z:c.pos.z, inFacility:true}, 1 + (1-c.timer/28)*0.6);
      if(c.timer <= 0){ c.state='pop'; sfx('popScream', {x:c.pos.x,z:c.pos.z,inFacility:true}, 1.4, 80); if(jack) jack.visible = true; if(lid) lid.visible=false; c.lookPoints=[1,2.2,3.0]; c.radius = 0.6; c.outT = 0; }
    } else if(c.state==='pop'){
      if(inside){ moveTowards(c, player.pos.x, player.pos.z, 10.5, dt); c.outT = 0; if(distToPlayer(c) < 1.3) killPlayer('Caixa de Música'); }
      else { c.outT += dt; if(c.outT > 15){ c.state='follow'; c.timer = rand(40,70); if(jack) jack.visible=false; if(lid) lid.visible=true; } }
      if(GR()<dt*2) sfx('screech', {x:c.pos.x,z:c.pos.z,inFacility:true}, 0.4, 40);
    }
  },
  sentinela(c, dt){
    const eye = c.visual.getObjectByName('eye');
    const sees = creatureSeesPlayer(c, 26, 2.2);
    const moving = player.vel.length() > 0.35 || !player.grounded;
    const shoot = ()=>{
      if(c.shells<=0){ c.state='reload'; c.timer = 3; return; }
      c.shells--; sfx('gun', {x:c.pos.x,z:c.pos.z,inFacility:true}, 1.3, 70);
      const fl = new THREE.PointLight(0xffc070, 4, 8); fl.position.set(c.pos.x, 1.6, c.pos.z); addToLevel(fl); setTimeout(()=>fl.parent&&fl.parent.remove(fl), 70);
      if(creatureSeesPlayer(c, 30, Math.PI*2)){
        const d = distToPlayer(c);
        damagePlayer(d < 8 ? 75 : (d < 16 ? 40 : 15), 'Baleado pela Sentinela', c.pos);
      }
      c.aimT = 1.2;
    };
    if(eye) eye.material.emissive.set((c.state==='inspect'||c.state==='hunt'||c.state==='aim') ? 0xff0000 : 0x000000);
    if(eye) eye.material.emissiveIntensity = 2;
    if(c.state==='patrol'){
      if(!c.wander || Math.hypot(c.wander.x-c.pos.x,c.wander.z-c.pos.z)<1) c.wander = randomFacilityPoint(c.pos.x,c.pos.z,8,40);
      moveTowards(c, c.wander.x, c.wander.z, 2.8, dt);
      c.speakT -= dt; if(c.speakT<=0){ c.speakT = 0.5; sfx('hum', {x:c.pos.x,z:c.pos.z,inFacility:true}, 0.3, 20); }
      c.timer -= dt;
      if(c.timer<=0){ c.state='inspect'; c.timer = 4; sfx('hitMetal', {x:c.pos.x,z:c.pos.z,inFacility:true}, 0.6); }
    } else if(c.state==='inspect'){
      c.yaw += Math.sin(performance.now()*0.002)*dt*1.2;
      c.timer -= dt;
      if(sees && moving){ c.state='aim'; c.aimT = 0.7; }
      if(c.timer<=0){ c.state='patrol'; c.timer = rand(7,13); }
    } else if(c.state==='aim' || c.state==='hunt'){
      if(sees){ c.last = {x:player.pos.x, z:player.pos.z}; c.lost = 0; faceTowards(c, player.pos.x, player.pos.z, dt, 10); c.aimT -= dt; if(c.aimT<=0) shoot(); }
      else { c.lost = (c.lost||0) + dt; if(c.last) moveTowards(c, c.last.x, c.last.z, 4.0, dt); if(c.lost > 12){ c.state='patrol'; c.timer = rand(6,10); } }
      c.state = c.state==='aim' && !sees ? 'hunt' : c.state;
    } else if(c.state==='reload'){
      c.timer -= dt; if(c.timer<=0){ c.shells = 2; c.state='hunt'; c.aimT = 0.6; }
    }
  },
  sosia(c, dt){
    const d = distToPlayer(c);
    if(player.grabbedBy===c){
      c.timer -= dt;
      faceTowards(c, player.pos.x, player.pos.z, dt);
      if(c.timer<=0){ player.grabbedBy = null; killPlayer('Virou um Sósia'); }
      return;
    }
    if(creatureSeesPlayer(c, 15, 2.4)){ c.state='approach'; c.lost = 0; }
    if(c.state==='approach'){
      moveTowards(c, player.pos.x, player.pos.z, 3.9, dt);
      if(!creatureSeesPlayer(c, 25, Math.PI*2)){ c.lost += dt; if(c.lost>6) c.state='wander'; }
      if(d < 1.2 && sameZone(c) && !player.grabbedBy){ player.grabbedBy = c; c.timer = 1.6; sfx('laugh', {x:c.pos.x,z:c.pos.z,inFacility:c.inFacility}, 1); }
    } else {
      if(!c.wander || Math.hypot(c.wander.x-c.pos.x,c.wander.z-c.pos.z)<1) c.wander = c.inFacility ? randomFacilityPoint(c.pos.x,c.pos.z,6,35) : randomOutdoorPoint(c.pos.x,c.pos.z,6,35);
      moveTowards(c, c.wander.x, c.wander.z, 2.2, dt);
    }
  },
  mimico_sucata(c, dt){
    const mouth = c.visual.getObjectByName('mouth');
    const d = distToPlayer(c);
    if(c.state==='disguised'){
      if(sameZone(c) && d < 1.1){ c.closeT = (c.closeT||0) + dt; if(c.closeT > 1.4) mimicReveal(c); } else c.closeT = 0;
    } else if(c.state==='revealed'){
      c.timer -= dt;
      if(sameZone(c)) moveTowards(c, player.pos.x, player.pos.z, 3.0, dt);
      if(d < 1.1 && c.attackCd<=0 && sameZone(c)){ c.attackCd = 1.2; damagePlayer(30, 'Mímico', c.pos); sfx('bite', {x:c.pos.x,z:c.pos.z,inFacility:true}); }
      if(c.timer <= 0){ // volta a se disfarçar
        c.state = 'disguised'; c.visual.visible = false; if(mouth) mouth.visible = false;
        if(c.fakeItem){ placeItemInWorld(c.fakeItem, c.pos.x, 0, c.pos.z, true); }
      }
    }
  },
  farejador(c, dt){
    c.breathT -= dt; if(c.breathT<=0){ c.breathT = rand(1.5,3); sfx('breath', {x:c.pos.x,z:c.pos.z,inFacility:false}, 0.6, 22); }
    // ouve barulhos
    let heard = null;
    for(const n of noiseEvents){ if(n.inFacility) continue; const d = Math.hypot(n.x-c.pos.x, n.z-c.pos.z); if(d < n.loud) { if(!heard || d < heard.d) heard = {x:n.x, z:n.z, d, loud:n.loud}; } }
    if(heard){
      if(c.state!=='hunt') sfx('growl', {x:c.pos.x,z:c.pos.z,inFacility:false}, 1, 50);
      c.state='hunt'; c.goal = {x:heard.x, z:heard.z}; c.timer = 6;
      if(heard.d < 4.5 && sameZone(c) && Math.hypot(heard.x-player.pos.x, heard.z-player.pos.z) < 2){ c.state='lunge'; c.timer = 1.2; c.goal={x:player.pos.x,z:player.pos.z}; }
    }
    const dP = distToPlayer(c);
    if(sameZone(c) && dP < 1.4 && !(playerInShip() && !S.shipDoorOpen)) { if(player.moving || c.state!=='roam') killPlayer('Farejador'); }
    if(c.state==='lunge'){ moveTowards(c, c.goal.x, c.goal.z, 12, dt); c.timer -= dt; if(c.timer<=0) c.state='hunt'; }
    else if(c.state==='hunt'){ moveTowards(c, c.goal.x, c.goal.z, 6.5, dt); c.timer -= dt; if(c.timer<=0) c.state='roam'; }
    else {
      if(!c.wander || Math.hypot(c.wander.x-c.pos.x,c.wander.z-c.pos.z)<2) c.wander = randomOutdoorPoint(c.pos.x,c.pos.z,10,50);
      moveTowards(c, c.wander.x, c.wander.z, 2.5, dt);
    }
  },
  colosso(c, dt){
    c.stepT -= dt;
    const spd = c.state==='chase' ? 5.6 : 2.0;
    if(c.moving && c.stepT<=0){ c.stepT = c.state==='chase'?0.55:0.95; sfx('giantStep', {x:c.pos.x,z:c.pos.z,inFacility:false}, 1.2, 80); if(sameZone(c) && distToPlayer(c)<25) addShake(0.15); }
    if(player.grabbedBy===c){
      c.timer -= dt;
      if(c.timer<=0){ player.grabbedBy=null; killPlayer('Devorado pelo Colosso'); }
      return;
    }
    const sees = creatureSeesPlayer(c, 38, 2.0) && !playerInShip();
    if(sees){ c.state='chase'; c.lost = 0; c.last = {x:player.pos.x, z:player.pos.z}; }
    if(c.state==='chase'){
      if(!sees){ c.lost += dt; if(c.lost>8) c.state='roam'; }
      const t = sees ? player.pos : c.last;
      moveTowards(c, t.x, t.z, spd, dt);
      if(sees && distToPlayer(c) < 3.2 && sameZone(c)){ player.grabbedBy = c; c.timer = 2.4; sfx('roar', {x:c.pos.x,z:c.pos.z,inFacility:false}, 1.3, 90); }
    } else {
      if(!c.wander || Math.hypot(c.wander.x-c.pos.x,c.wander.z-c.pos.z)<3) c.wander = randomOutdoorPoint(c.pos.x,c.pos.z,20,90);
      moveTowards(c, c.wander.x, c.wander.z, spd, dt);
    }
  },
  verme(c, dt){
    const outside = sameZone(c) && !playerInShip();
    if(c.state==='under'){
      c.timer -= dt;
      if(c.timer<=0 && outside){ c.state='track'; c.timer = 3.2; c.target = {x:player.pos.x, z:player.pos.z}; sfx('rumble', {x:player.pos.x, z:player.pos.z, inFacility:false}, 1.2); }
    } else if(c.state==='track'){
      c.timer -= dt;
      if(c.timer > 0.9 && outside){ c.target.x += (player.pos.x-c.target.x)*Math.min(1,dt*3); c.target.z += (player.pos.z-c.target.z)*Math.min(1,dt*3); }
      if(outside && Math.hypot(player.pos.x-c.target.x, player.pos.z-c.target.z) < 20) addShake(0.25*(1-c.timer/3.2)+0.05);
      if(GR()<dt*4) sfx('rumble', {x:c.target.x, z:c.target.z, inFacility:false}, 0.5, 30);
      if(c.timer<=0){
        c.state='emerge'; c.timer = 0; c.pos.set(c.target.x, groundAt(c.target.x,c.target.z,false), c.target.z);
        c.visual.visible = true; sfx('roar', {x:c.pos.x,z:c.pos.z,inFacility:false}, 1.6, 120);
        if(sameZone(c) && Math.hypot(player.pos.x-c.target.x, player.pos.z-c.target.z) < 3.8 && !playerInShip()) killPlayer('Engolido pelo Verme colossal');
        creatures.forEach(o=>{ if(o!==c && !o.inFacility && Math.hypot(o.pos.x-c.pos.x,o.pos.z-c.pos.z)<4) { o.hp=1; hurtCreature(o, 99); removeCreature(o); } });
      }
    } else if(c.state==='emerge'){
      c.timer += dt;
      const h = c.timer < 0.6 ? c.timer/0.6 : (c.timer < 2.6 ? 1 : Math.max(0, 1-(c.timer-2.6)/1.4));
      c.visual.position.y = c.pos.y - 22 + h*24;
      if(c.timer > 4.0){ c.state='under'; c.visual.visible=false; c.timer = rand(30,60); }
      return 'noPlace';
    }
    return 'noPlace';
  },
};

function detachLacrador(c){
  player.latched = null; if(player===localPlayer) setMuffled(false);
  c.state = 'floor'; c.timer = rand(2,3); c.y = 0;
  const a = rand(0,Math.PI*2); c.pos.x = player.pos.x + Math.cos(a)*1.2; c.pos.z = player.pos.z + Math.sin(a)*1.2;
  if(c.inFacility) facilityResolve(c.pos, 0.3, true);
  sfx('skitter', {x:c.pos.x,z:c.pos.z,inFacility:c.inFacility}, 1);
  if(player===localPlayer) toast('Você arrancou a criatura da cabeça!');
}
function mimicReveal(c){
  if(c.isProxy){ netRelay('reveal', {nid:c.nid}); return; }
  if(c.state!=='disguised') return;
  c.state = 'revealed'; c.timer = 9; c.visual.visible = true;
  const mouth = c.visual.getObjectByName('mouth'); if(mouth) mouth.visible = true;
  if(c.fakeItem){ c.pos.x = c.fakeItem.pos.x; c.pos.z = c.fakeItem.pos.z; removeItemFromWorld(c.fakeItem); }
  sfx('bite', {x:c.pos.x,z:c.pos.z,inFacility:true}, 1.3);
  if(distToPlayer(c) < 2){ damagePlayer(45, 'Mímico', c.pos); }
  if(player===localPlayer){ discoverCreature('mimico_sucata'); screenFlash('#400'); }
}

function updateCreatures(dt){
  creatures.forEach(c=>{
    if(!c.alive) return;
    c.attackCd -= dt; c.moving = false;
    if(c.stun > 0){ c.stun -= dt; if(player.grabbedBy===c) player.grabbedBy=null; if(c.type==='lacrador' && player.latched===c) detachLacrador(c); }
    let r;
    const tgt = (typeof netPickTarget==='function') ? netPickTarget(c) : localPlayer;
    player = tgt;
    try{ if(c.stun <= 0 || c.type==='verme') r = THINK[c.type](c, dt); } finally { player = localPlayer; }
    // visual
    if(r!=='noPlace'){
      const gy = c.type==='lacrador' ? c.pos.y : (c.inFacility ? 0 : groundAt(c.pos.x, c.pos.z, false));
      if(c.type!=='lacrador') c.pos.y = gy;
      c.visual.position.set(c.pos.x, gy, c.pos.z);
    }
    if(c.type!=='verme') c.visual.rotation.y = c.yaw;
    if(c.moving){
      const spd = c.type==='colosso' ? 3 : 8;
      c.anim += dt*spd;
      let k = 0;
      c.visual.traverse(o=>{
        if(o.name==='leg'){ o.rotation.x = (o.userData.baseX||0) + Math.sin(c.anim + (k++%2)*Math.PI)*0.45; }
        else if(o.name==='arm'){ o.rotation.x = (o.userData.baseX||0) + Math.sin(c.anim + Math.PI + (k++%2)*Math.PI)*0.3; }
      });
    } else if(c._wasMoving){ c.visual.traverse(o=>{ if(o.name==='leg'||o.name==='arm') o.rotation.x = o.userData.baseX||0; }); }
    c._wasMoving = c.moving;
    if(c.stun > 0) c.visual.rotation.z = Math.sin(performance.now()*0.03)*0.08;
    if(c.wobble){ c.wobble = Math.max(0, c.wobble-dt*2); c.visual.rotation.z = Math.sin(performance.now()*0.04)*0.1*c.wobble; }
  });
  creatures = creatures.filter(c=>c.alive);
  runSpawnDirector(dt);
}

// ------------------------------------------------------------------ "diretor" de spawn
function resetSpawnDirector(moon){
  creatures.forEach(removeCreature); creatures = [];
  spawnDirector = {inT:rand(25,50), outT:rand(20,40), inPower:0, outPower:0};
  // mímicos de sucata nascem junto com a sucata
  const mimics = Math.min(CREATURES.mimico_sucata.max, Math.floor(rand(0, (moon.indoor.weights.mimico_sucata||0)*0.8+0.5)));
  for(let k=0;k<mimics;k++){
    const s = pick(FAC.scrapSpots); if(!s) break; const p = tileCenter(s.i, s.j);
    if(FAC.block[tIdx(s.i,s.j)]) continue;
    spawnCreature('mimico_sucata', p.x, p.z, true); spawnDirector.inPower += CREATURES.mimico_sucata.power;
  }
}
function countType(t){ return creatures.filter(c=>c.type===t && c.alive).length; }
function runSpawnDirector(dt){
  if(S.phase!=='moon' || !S.moon || S.moon.company) return;
  const m = S.moon, hour = currentHour();
  const prog = clamp((hour-8)/14, 0, 1);
  // dentro
  spawnDirector.inT -= dt;
  if(spawnDirector.inT <= 0){
    spawnDirector.inT = rand(45, 100) * (1-prog*0.5) * (S.apparatusTaken?0.6:1);
    const budget = m.indoor.power - spawnDirector.inPower;
    const opts = Object.entries(m.indoor.weights).filter(([t,w])=>t!=='mimico_sucata' && CREATURES[t].power<=budget && countType(t)<CREATURES[t].max);
    if(opts.length && FAC.vents.length){
      const t = weightedPick(Object.fromEntries(opts));
      const vents = FAC.vents.filter(v=>Math.hypot(v.x-player.pos.x, v.z-player.pos.z) > 14 || !player.inFacility);
      const v = vents.length ? pick(vents) : pick(FAC.vents);
      sfx('vent', {x:v.x, z:v.z, inFacility:true}, 1, 30);
      spawnCreature(t, v.x, v.z, true);
      spawnDirector.inPower += CREATURES[t].power;
    }
  }
  // fora
  const eclipse = S.weather[m.id]==='eclipse';
  if(hour >= m.outdoor.startHour || eclipse){
    spawnDirector.outT -= dt * (hour>19?1.8:1) * (eclipse?1.5:1);
    if(spawnDirector.outT <= 0){
      spawnDirector.outT = rand(50, 110);
      const budget = m.outdoor.power*(eclipse?1.5:1) - spawnDirector.outPower;
      const opts = Object.entries(m.outdoor.weights).filter(([t,w])=>CREATURES[t].power<=budget && countType(t)<CREATURES[t].max);
      // gigantes preferem o dia; cães preferem a noite
      if(opts.length){
        const t = weightedPick(Object.fromEntries(opts));
        const p = randomOutdoorPoint(SHIP.x, SHIP.z, 45, 400);
        spawnCreature(t, p.x, p.z, false);
        spawnDirector.outPower += CREATURES[t].power;
      }
    }
  }
}
