/*
 * ============================================================================
 *  05-ship.js — A NAVE (seu "hub"): terminal, alavanca, porta, carregador, monitor
 * ============================================================================
 *  A nave é a mesma em órbita e pousada na lua. Tudo que você larga no chão
 *  dela fica guardado entre os dias (S.shipItems).
 *  Medidas internas: 13m x 6.4m. Porta na lateral direita (z+), cabine na frente (x-).
 * ============================================================================
 */

const SHIP = {x:0, y:0, z:0, floorY:0.6, group:null, doorMesh:null, monitor:null, termScreen:null, lever:null, doorT:0};
const SHIP_IN = {minX:-6.4, maxX:6.4, minZ:-3.1, maxZ:3.1};
const SHIP_DOOR = {x0:2.4, x1:4.6};

function isInsideShip(x, z){
  if(!SHIP.group) return false;
  const lx = x-SHIP.x, lz = z-SHIP.z;
  return lx>SHIP_IN.minX && lx<SHIP_IN.maxX && lz>SHIP_IN.minZ && lz<SHIP_IN.maxZ;
}
function playerInShip(){ return !player.inFacility && isInsideShip(player.pos.x, player.pos.z); }

function buildShip(x, groundY, z, inOrbit){
  SHIP.x = x; SHIP.z = z; SHIP.y = groundY; SHIP.floorY = groundY + 0.6;
  const fy = SHIP.floorY;
  const g = new THREE.Group(); g.position.set(x, groundY, z);
  SHIP.group = g; addToLevel(g);
  const hullMat = new THREE.MeshStandardMaterial({color:0x5c6168, roughness:0.6, metalness:0.55});
  const innerMat = new THREE.MeshStandardMaterial({color:0x3e4248, roughness:0.75, metalness:0.4});
  const floorMat = new THREE.MeshStandardMaterial({color:0x2a2c30, roughness:0.85, metalness:0.3, map:themeTexture('fabrica_chao')});
  const H = 3.3, F = 0.6; // altura interna e altura do piso
  // estrutura
  const placeholder = new THREE.Group(); g.add(placeholder);
  placeholder.add(box(13.4, 0.6, 7.0, hullMat, 0, F-0.3, 0));               // piso
  placeholder.add(box(12.8, 0.02, 6.2, floorMat, 0, F+0.01, 0));
  placeholder.add(box(13.4, 0.35, 7.0, hullMat, 0, F+H+0.17, 0));          // teto
  placeholder.add(box(13.4, H, 0.3, innerMat, 0, F+H/2, -3.35));            // parede z-
  // parede z+ com a porta
  const doorL = SHIP_DOOR.x0, doorR = SHIP_DOOR.x1;
  placeholder.add(box(doorL+6.7, H, 0.3, innerMat, (-6.7+doorL)/2, F+H/2, 3.35));
  placeholder.add(box(6.7-doorR, H, 0.3, innerMat, (doorR+6.7)/2, F+H/2, 3.35));
  placeholder.add(box(doorR-doorL, 0.9, 0.3, innerMat, (doorL+doorR)/2, F+H-0.45, 3.35));
  // parede de trás (x+) e frente com janela (x-)
  placeholder.add(box(0.3, H, 7.0, innerMat, 6.7, F+H/2, 0));
  placeholder.add(box(0.3, 1.3, 7.0, innerMat, -6.7, F+0.65, 0));
  placeholder.add(box(0.3, 0.7, 7.0, innerMat, -6.7, F+H-0.35, 0));
  placeholder.add(box(0.3, 1.3, 1.9, innerMat, -6.7, F+1.95, -2.55));
  placeholder.add(box(0.3, 1.3, 1.9, innerMat, -6.7, F+1.95, 2.55));
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.3), new THREE.MeshStandardMaterial({color:0x223344, transparent:true, opacity:0.25, roughness:0.1, metalness:0.9, side:THREE.DoubleSide}));
  glass.position.set(-6.7, F+1.95, 0); glass.rotation.y = Math.PI/2; g.add(glass);
  // detalhes de fora: motores, pernas, luz
  placeholder.add(cyl(0.9, 1.1, 1.6, hullMat, 7.5, F+1.2, -1.8).rotateZ(Math.PI/2));
  placeholder.add(cyl(0.9, 1.1, 1.6, hullMat, 7.5, F+1.2, 1.8).rotateZ(Math.PI/2));
  [[-5,-3],[5,-3],[-5,3],[5,3]].forEach(([lx,lz])=>placeholder.add(box(0.3, F+0.4, 0.3, MAT.dark, lx, (F)/2-0.1, lz)));
  const beacon = box(0.3,0.2,0.3, MAT.glowY, 3.5, F+H+0.45, 3.2); g.add(beacon);
  const stripe = box(13.4, 0.12, 0.05, MAT.orange, 0, F+H-0.2, 3.52); g.add(stripe);
  // rampa
  const ramp = box(doorR-doorL, 0.12, 2.3, hullMat, (doorL+doorR)/2, F/2, 4.5); ramp.rotation.x = Math.atan2(F, 2.3); g.add(ramp);

  if(ASSETS.props.nave && ASSETS.props.nave.model){
    loadModelCached(ASSETS.props.nave.model, m=>{ const c=ASSETS.props.nave; m.scale.setScalar(c.scale||1); m.position.y=c.yOffset||0; m.rotation.y=c.rotY||0; g.add(m); if(c.hidePlaceholder) placeholder.visible=false; });
  }

  // porta corrediça
  const door = box(doorR-doorL, H-0.9, 0.12, new THREE.MeshStandardMaterial({color:0x7a8088, metalness:0.7, roughness:0.35}), (doorL+doorR)/2, F+(H-0.9)/2, 3.35);
  g.add(door); SHIP.doorMesh = door;
  S.shipDoorOpen = !inOrbit && S.shipDoorOpen;
  addBoxObstacle(x+(doorL+doorR)/2, z+3.35, doorR-doorL, 0.3, ()=>!S.shipDoorOpen);

  // colisões das paredes
  addBoxObstacle(x, z-3.35, 13.4, 0.3);
  addBoxObstacle(x+(-6.7+doorL)/2, z+3.35, doorL+6.7, 0.3);
  addBoxObstacle(x+(doorR+6.7)/2, z+3.35, 6.7-doorR, 0.3);
  addBoxObstacle(x+6.7, z, 0.3, 7.0);
  addBoxObstacle(x-6.7, z, 0.3, 7.0);
  // piso e rampa
  shipFloor = {minX:x-6.7, maxX:x+6.7, minZ:z-3.35, maxZ:z+3.35, y:fy};
  if(!inOrbit){
    const rampEndZ = z+5.7;
    extraFloors.push({minX:x+doorL, maxX:x+doorR, minZ:z+3.35, maxZ:rampEndZ, y:(px,pz)=>{
      const t = clamp((pz-(z+3.35))/(rampEndZ-(z+3.35)),0,1); const gEnd = heightFn(px, rampEndZ);
      return fy + (gEnd-fy)*t;
    }});
  }

  // ---- terminal ----
  const term = new THREE.Group(); term.position.set(-2.2, F, -2.9); g.add(term);
  term.add(box(1.4, 0.9, 0.6, MAT.dark, 0, 0.45, 0));
  term.add(box(1.0, 0.75, 0.12, MAT.black, 0, 1.35, -0.12));
  const scr = makeTextPlane(['> TERMINAL','','digite AJUDA'], 0.9, 0.62, {fontSize:44});
  scr.position.set(0, 1.35, -0.05); term.add(scr); SHIP.termScreen = scr;
  interactables.push({x:x-2.2, y:fy+1.2, z:z-2.6, range:1.8, prompt:()=>'[E] Usar terminal', action:()=>openTerminal()});

  // ---- alavanca ----
  const consoleM = box(1.0, 1.0, 2.4, MAT.dark, -6.0, F+0.5, 0); g.add(consoleM);
  const leverBase = box(0.25, 0.15, 0.25, MAT.metal, -5.7, F+1.05, 0); g.add(leverBase);
  const lever = new THREE.Group(); lever.position.set(-5.7, F+1.1, 0);
  const stick = box(0.06, 0.6, 0.06, MAT.metal, 0, 0.3, 0); lever.add(stick);
  lever.add(sph(0.08, MAT.glowR, 0, 0.62, 0));
  lever.rotation.z = 0.5; g.add(lever); SHIP.lever = lever;
  interactables.push({x:x-5.7, y:fy+1.2, z:z, range:1.9, prompt:()=>leverPrompt(), action:()=>pullLever()});

  // ---- monitor da cota (acima da janela) ----
  const mon = makeTextPlane(['COTA'], 2.4, 0.7, {fontSize:40});
  mon.position.set(-6.53, F+2.85, 0); mon.rotation.y = Math.PI/2; g.add(mon); SHIP.monitor = mon;
  updateShipMonitor();

  // ---- botões da porta ----
  const panel = box(0.4, 0.5, 0.08, MAT.dark, doorR+0.6, F+1.3, 3.15); g.add(panel);
  g.add(box(0.12,0.12,0.05, MAT.glowG, doorR+0.6, F+1.4, 3.1));
  g.add(box(0.12,0.12,0.05, MAT.glowR, doorR+0.6, F+1.2, 3.1));
  interactables.push({x:x+doorR+0.6, y:fy+1.3, z:z+2.95, range:1.7,
    prompt:()=> inOrbitNow() ? 'Porta travada (no espaço)' : (S.shipDoorOpen ? '[E] Fechar porta da nave' : '[E] Abrir porta da nave'),
    action:()=>{ if(inOrbitNow()){ sfx('doorLocked'); return; } if(netRelay('shipdoor')) return; S.shipDoorOpen = !S.shipDoorOpen; sfx('shipDoor', {x:x+3.5, z:z+3.3}); }});

  // ---- carregador de bateria ----
  const ch = box(0.6, 0.6, 0.3, MAT.dark, -0.5, F+1.3, -3.1); g.add(ch);
  g.add(box(0.15,0.15,0.05, MAT.glowY, -0.5, F+1.3, -2.93));
  interactables.push({x:x-0.5, y:fy+1.3, z:z-2.9, range:1.6, prompt:()=>{ const h=heldItem(); return (h && h.battery!==undefined) ? '[E] Carregar bateria' : 'Carregador (segure uma lanterna)'; },
    action:()=>{ const h=heldItem(); if(h && h.battery!==undefined){ h.battery = h.def.battery; sfx('buy'); toast('Bateria carregada'); } }});

  // ---- móveis ----
  g.add(box(1.8, 0.4, 0.9, MAT.wood, 2.2, F+0.3, -2.6)); g.add(box(1.8, 0.4, 0.9, MAT.wood, 2.2, F+1.5, -2.6));
  g.add(box(0.08, 1.8, 0.08, MAT.metal, 1.35, F+0.9, -2.2)); g.add(box(0.08, 1.8, 0.08, MAT.metal, 3.05, F+0.9, -2.2));
  addBoxObstacle(x+2.2, z-2.6, 1.8, 0.9);
  g.add(box(1.2, 2.2, 0.7, MAT.rust, 5.6, F+1.1, -2.7)); addBoxObstacle(x+5.6, z-2.7, 1.2, 0.7); // armário
  addBoxObstacle(x-6.0, z, 1.0, 2.4); // console da alavanca
  addBoxObstacle(x-2.2, z-2.9, 1.4, 0.6); // mesa do terminal

  // ---- luzes ----
  [[-3,0],[2.5,0]].forEach(([lx,lz])=>{
    const lampMesh = box(1.2, 0.06, 0.25, MAT.glowW.clone(), lx, F+H-0.04, lz); g.add(lampMesh);
    lamps.push({x:x+lx, y:fy+H-0.3, z:z+lz, color:0xdde6ff, range:9, base:0.9, on:true, mesh:lampMesh, inFacility:false});
  });
  lamps.push({x:x+3.5, y:fy+H+0.6, z:z+4.0, color:0xffb060, range:16, base:1.4, on:!inOrbit, mesh:beacon, inFacility:false});

  // itens guardados na nave
  S.shipItems.forEach(si=>{ placeItemInWorld(si.item, x+si.lx, fy, z+si.lz, false); });
  // entregas da loja
  if(typeof gameStarted!=='undefined' && gameStarted) S.pendingDeliveries.splice(0).forEach((toolId,i)=>{
    const it = makeToolItem(toolId);
    placeItemInWorld(it, x+4.5+(i%3)*0.5, fy, z-1.6+Math.floor(i/3)*0.5, false);
  });
}
function inOrbitNow(){ return S.phase==='orbit'; }
function updateShipMonitor(){
  if(!SHIP.monitor) return;
  SHIP.monitor.userData.redraw([
    `COTA: $${S.soldThisQuota} / $${S.quota}`,
    `PRAZO: ${S.daysLeft} dia${S.daysLeft===1?'':'s'}`,
  ]);
}
// guarda a posição dos itens que estão dentro da nave (chamado ao decolar/morrer)
function snapshotShipItems(){
  S.shipItems = worldItems.filter(it=>!it.inFacility && isInsideShip(it.pos.x, it.pos.z))
    .map(it=>({item:it, lx:it.pos.x-SHIP.x, ly:0, lz:it.pos.z-SHIP.z}));
}
function shipScrapValue(){
  return worldItems.filter(it=>it.kind==='scrap' && !it.inFacility && isInsideShip(it.pos.x,it.pos.z)).reduce((s,it)=>s+it.value,0);
}
function animateShip(dt){
  if(!SHIP.doorMesh) return;
  SHIP.doorT += ((S.shipDoorOpen?1:0) - SHIP.doorT) * Math.min(1, dt*4);
  SHIP.doorMesh.position.x = (SHIP_DOOR.x0+SHIP_DOOR.x1)/2 + SHIP.doorT*2.3;
}
