/*
 * ============================================================================
 *  06-exterior.js — O LADO DE FORA: terreno, céu, clima, entrada principal e
 *  saída de emergência. Também monta o Posto da Empresa (onde se vende).
 * ============================================================================
 *  - Luas com terrain:'proc' → terreno gerado por código com as cores de MOONS[x].look
 *  - Luas com terrain:'model' → usa o modelo 3D (ASSETS.exteriors) — ex: 21-Fornalha = seu scene.gltf
 * ============================================================================
 */

const ENTR = {main:null, fire:null}; // {out:{x,y,z,yaw}, in:{x,z,yaw}}
let skyStars = null, rainPoints = null, outdoorMoon = null;
const EXT_SIZE = 150; // metade do tamanho do mapa procedural

// --------------------------- céu e iluminação -------------------------------
function makeStars(){
  const n = 1200, pos = new Float32Array(n*3);
  for(let i=0;i<n;i++){
    const th = GR()*Math.PI*2, ph = Math.acos(GR()*0.95), r = 450;
    pos[i*3] = Math.cos(th)*Math.sin(ph)*r; pos[i*3+1] = Math.cos(ph)*r; pos[i*3+2] = Math.sin(th)*Math.sin(ph)*r;
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({color:0xffffff, size:1.6, sizeAttenuation:false, transparent:true, opacity:1, fog:false}));
  return pts;
}
const _cA = new THREE.Color(), _cB = new THREE.Color();
// hora 8..24 → luz do sol, cor do céu, neblina
function updateOutdoorLighting(hour){
  const m = S.moon; if(!m) return;
  const w = S.weather[m.id];
  const look = m.look;
  // 0 = dia pleno, 1 = noite
  let night = clamp((hour-16.5)/4.5, 0, 1);
  if(w==='eclipse') night = 1;
  const dusk = clamp(1-Math.abs(hour-18.5)/2.5, 0, 1) * (w==='eclipse'?0:1);
  _cA.set(look.skyDay); _cB.set(look.skyNight);
  const sky = _cA.clone().lerp(_cB, night);
  if(dusk>0) sky.lerp(new THREE.Color(0xc0602a), dusk*0.35);
  let cloudy = (w==='rain'||w==='storm') ? 0.45 : (w==='fog'?0.25:0);
  sky.lerp(new THREE.Color(0x3a3f44), cloudy*(1-night));
  if(!player.inFacility){
    scene.background = sky;
    const fogD = look.fog * (w==='fog'?3.2:1) * (w==='rain'||w==='storm'?1.6:1) * (1+night*0.6);
    scene.fog = new THREE.FogExp2(sky.getHex(), fogD);
    sun.intensity = (1-night)*(1-cloudy*0.6)*1.25;
    sun.color.set(0xfff0d8).lerp(new THREE.Color(0xff8a40), dusk*0.6);
    const ang = (hour-8)/16*Math.PI; sun.position.set(Math.cos(ang)*80, 20+Math.sin(ang)*90, 30);
    sun.target.position.set(0,0,0);
    hemi.intensity = 0.25 + (1-night)*0.55;
    hemi.color.copy(sky); hemi.groundColor.set(look.ground2);
    ambient.intensity = 0.06 + (1-night)*0.1;
    if(skyStars) skyStars.material.opacity = night;
    if(skyStars) skyStars.position.copy(camera.position);
  }
}
function setFacilityLighting(){
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.FogExp2(0x050506, 0.03);
  sun.intensity = 0; hemi.intensity = 0.18; hemi.color.set(0x8a8070); hemi.groundColor.set(0x201a14); ambient.intensity = 0.32; ambient.color.set(0x6a6050);
}
function setOrbitLighting(){
  scene.background = new THREE.Color(0x000002);
  scene.fog = null;
  sun.intensity = 0.8; sun.color.set(0xffffff); sun.position.set(-60, 30, 40);
  hemi.intensity = 0.15; hemi.color.set(0x8899bb); hemi.groundColor.set(0x111111);
  ambient.intensity = 0.12; ambient.color.set(0x405060);
}

// --------------------------- clima (chuva, raios) ---------------------------
function buildRain(){
  const n = 1600, pos = new Float32Array(n*3);
  for(let i=0;i<n;i++){ pos[i*3]=rand(-25,25); pos[i*3+1]=rand(0,22); pos[i*3+2]=rand(-25,25); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
  rainPoints = new THREE.Points(geo, new THREE.PointsMaterial({color:0x9ab0c8, size:0.07, transparent:true, opacity:0.55}));
  addToLevel(rainPoints);
}
function updateRain(dt){
  if(!rainPoints) return;
  rainPoints.visible = !player.inFacility;
  const p = rainPoints.geometry.attributes.position, a = p.array;
  for(let i=0;i<a.length;i+=3){
    a[i+1] -= dt*22;
    if(a[i+1] < -2){ a[i+1] = 20+GR()*4; a[i] = rand(-25,25); a[i+2] = rand(-25,25); }
  }
  p.needsUpdate = true;
  rainPoints.position.set(camera.position.x, camera.position.y-6, camera.position.z);
}

// --------------------------- terreno procedural: ver 06b-scenery.js
function buildMainEntranceBuilding(x, y, z, yaw){
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = yaw; addToLevel(g);
  const concrete = new THREE.MeshStandardMaterial({color:0x56585a, roughness:0.95, map:themeTexture('fabrica_parede')});
  const body = new THREE.Group(); g.add(body);
  body.add(box(16, 9, 10, concrete, 0, 4.5, -5));
  body.add(box(4.2, 4.2, 0.6, MAT.black, 0, 2.1, 0.05));   // vão da porta
  body.add(box(5.2, 0.5, 1.4, MAT.metal, 0, 4.5, 0.6));    // marquise
  body.add(box(0.4, 4.5, 0.4, MAT.metal, -2.4, 2.25, 0.2)); body.add(box(0.4, 4.5, 0.4, MAT.metal, 2.4, 2.25, 0.2));
  body.add(cyl(0.6, 0.6, 6, MAT.rust, 6, 3, -0.6)); body.add(cyl(0.4, 0.4, 7, MAT.rust, -6.5, 3.5, -0.4));
  const sign = makeTextPlane(['ENTRADA PRINCIPAL'], 4.2, 0.6, {bg:'#1a1a1a', color:'#e8d8a8', fontSize:44}); sign.position.set(0, 5.4, 0.12); g.add(sign);
  const lampMesh = box(0.6, 0.15, 0.3, MAT.glowW.clone(), 0, 4.3, 1.1); g.add(lampMesh);
  if(ASSETS.props.entrada && ASSETS.props.entrada.model){
    loadModelCached(ASSETS.props.entrada.model, m=>{ const c=ASSETS.props.entrada; m.scale.setScalar(c.scale||1); m.position.y=c.yOffset||0; m.rotation.y=c.rotY||0; g.add(m); body.visible=false; });
  }
  // colisão: caixa girada junto com o prédio (antes era uma caixa alinhada aos eixos,
  // que ficava maior que o prédio e virava uma "parede invisível" na frente da porta)
  const fwd = {x:Math.sin(yaw), z:Math.cos(yaw)};
  addBoxObstacle(x - fwd.x*5.1, z - fwd.z*5.1, 16, 9.8, null, yaw);
  const out = {x:x+fwd.x*1.8, z:z+fwd.z*1.8};
  lamps.push({x:out.x, y:y+4, z:out.z, color:0xffe2b0, range:14, base:1.2, on:true, mesh:lampMesh, inFacility:false});
  ENTR.main = ENTR.main || {};
  ENTR.main.out = {x:out.x, y, z:out.z, dir:fwd};
  // o ponto de interação fica colado na porta (antes ficava 1,8m na frente: quem chegava
  // perto da porta já tinha passado dele e não conseguia entrar)
  interactables.push({x:x+fwd.x*0.6, y:y+1.2, z:z+fwd.z*0.6, range:3.2, easy:true, prompt:()=>'[E] Entrar na instalação', action:()=>useEntrance('main', true)});
}
function buildFireExitHatch(x, y, z, yaw){
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = yaw; addToLevel(g);
  const concrete = new THREE.MeshStandardMaterial({color:0x4a4c4e, roughness:0.95});
  g.add(box(3.2, 3.4, 2.6, concrete, 0, 1.7, -1.3));
  g.add(box(1.4, 2.3, 0.15, new THREE.MeshStandardMaterial({color:0x7a1a14, roughness:0.6, metalness:0.4}), 0, 1.15, 0.02));
  const lampMesh = box(0.25, 0.25, 0.25, MAT.glowR.clone(), 0, 2.7, 0.15); g.add(lampMesh);
  const sign = makeTextPlane(['SAÍDA DE EMERGÊNCIA'], 2.2, 0.35, {bg:'#3a0a08', color:'#ffd0c0', fontSize:40}); sign.position.set(0, 3.0, 0.08); g.add(sign);
  const fwd = {x:Math.sin(yaw), z:Math.cos(yaw)};
  addBoxObstacle(x-fwd.x*1.35, z-fwd.z*1.35, 3.2, 2.5, null, yaw);
  const out = {x:x+fwd.x*1.3, z:z+fwd.z*1.3};
  lamps.push({x:out.x, y:y+2.8, z:out.z, color:0xff4030, range:9, base:0.9, on:true, mesh:lampMesh, inFacility:false});
  ENTR.fire = ENTR.fire || {};
  ENTR.fire.out = {x:out.x, y, z:out.z, dir:fwd};
  interactables.push({x:x+fwd.x*0.4, y:y+1.2, z:z+fwd.z*0.4, range:2.8, easy:true, prompt:()=>'[E] Entrar pela saída de emergência', action:()=>useEntrance('fire', true)});
}

// --------------------------- exterior com modelo 3D -------------------------
function buildModelExterior(moon, onDone){
  const cfg = ASSETS.exteriors[moon.exterior];
  loadModelCached(cfg.model, model=>{
    const S_ = cfg.scale, o = cfg.origin;
    model.scale.setScalar(S_);
    model.position.set(-o[0]*S_, -o[1]*S_, -o[2]*S_);
    addToLevel(model);
    model.updateMatrixWorld(true);
    const solids = [];
    const bb = new THREE.Box3();
    model.traverse(c=>{
      if(!c.isMesh) return;
      const n = (c.name||'').toLowerCase() + ' ' + ((c.parent&&c.parent.name)||'').toLowerCase();
      if(cfg.solidNames.some(s=>n.includes(s))){ solids.push(c); bb.expandByObject(c); }
      if(c.material){ c.material.side = THREE.FrontSide; }
    });
    const minX = bb.min.x-2, maxX = bb.max.x+2, minZ = bb.min.z-2, maxZ = bb.max.z+2;
    const sample = bakeHeightmap(solids, minX, maxX, minZ, maxZ, 768);
    heightFn = (x,z)=>{ const h = sample(x,z); return isNaN(h) ? -50 : h; };
    heightSolidFn = (x,z)=> isNaN(sample(x,z));
    worldBounds = {minX, maxX, minZ, maxZ};
    const toW = p=>({x:(p[0]-o[0])*S_, z:(p[1]-o[2])*S_});
    const lowestNear = (p, r)=>{ // ponto mais baixo e andável perto de p
      let best = p, bh = Infinity;
      for(let dx=-r;dx<=r;dx+=0.5) for(let dz=-r;dz<=r;dz+=0.5){
        const h = sample(p.x+dx, p.z+dz); if(isNaN(h)) continue;
        if(h < bh-0.05){ bh = h; best = {x:p.x+dx, z:p.z+dz}; }
      }
      return best;
    };
    // acha uma porta pelo nome da parte do modelo e devolve o ponto do chão logo na frente dela
    const doorPoint = (spec)=>{
      if(Array.isArray(spec)) return lowestNear(toW(spec), 4);
      let mesh = null;
      model.traverse(c=>{ if(!mesh && c.isMesh && ((c.name||'')+' '+((c.parent&&c.parent.name)||'')).toLowerCase().includes(spec.toLowerCase())) mesh = c; });
      if(!mesh){ console.warn('Parte não encontrada no modelo:', spec); return toW([o[0], o[2]]); }
      const b = new THREE.Box3().setFromObject(mesh), c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3());
      const thinX = sz.x < sz.z;
      let best = null, bestErr = Infinity;
      for(const sgn of [1,-1]) for(const d of [1.2, 2.0, 3.0]){
        const p = thinX ? {x:c.x+sgn*d, z:c.z} : {x:c.x, z:c.z+sgn*d};
        const h = sample(p.x, p.z); if(isNaN(h)) continue;
        const err = Math.abs(h - b.min.y);
        if(err < bestErr){ bestErr = err; best = p; }
      }
      if(best && bestErr < 1.5) return best;
      // a porta não tem chão na frente (fica no alto): anda em direção à nave até achar o chão
      // e coloca uma porta nossa na parede do prédio
      const sp = toW(cfg.points.ship), shipH = sample(sp.x, sp.z);
      const dx = sp.x-c.x, dz = sp.z-c.z, dl = Math.hypot(dx,dz)||1;
      for(let t=0.5;t<dl;t+=0.5){
        const p = {x:c.x+dx/dl*t, z:c.z+dz/dl*t}, h = sample(p.x,p.z), h2 = sample(p.x+dx/dl, p.z+dz/dl);
        if(!isNaN(h) && !isNaN(h2) && h < shipH+4 && Math.abs(h2-h) < 0.8){
          const q = {x:p.x+dx/dl*0.8, z:p.z+dz/dl*0.8};
          const gy = sample(q.x, q.z), yaw = Math.atan2(dx/dl, dz/dl);
          const door = new THREE.Group(); door.position.set(p.x, gy, p.z); door.rotation.y = yaw; addToLevel(door);
          door.add(box(3.4, 3.6, 0.5, MAT.dark, 0, 1.8, -0.1));
          door.add(box(2.6, 3.0, 0.15, new THREE.MeshStandardMaterial({color:0x5a6068, metalness:0.6, roughness:0.4}), 0, 1.5, 0.12));
          door.add(box(0.15, 3.0, 0.18, MAT.black, 0, 1.5, 0.13));
          return q;
        }
      }
      return best || {x:c.x, z:c.z};
    };
    const shipP = toW(cfg.points.ship);
    const mainP = doorPoint(cfg.points.main);
    const fireP = doorPoint(cfg.points.fire);
    // marcadores das entradas (luz + placa) e interação
    [['main',mainP,'ENTRADA PRINCIPAL',0xffe2b0],['fire',fireP,'SAÍDA DE EMERGÊNCIA',0xff4030]].forEach(([k,p,label,col])=>{
      const y = heightFn(p.x,p.z);
      const lampMesh = box(0.3,0.3,0.3, (k==='main'?MAT.glowW:MAT.glowR).clone(), p.x, y+3.2, p.z); addToLevel(lampMesh);
      lamps.push({x:p.x, y:y+3, z:p.z, color:col, range:k==='main'?14:9, base:1.1, on:true, mesh:lampMesh, inFacility:false});
      ENTR[k] = ENTR[k] || {};
      { const dx=shipP.x-p.x, dz=shipP.z-p.z, dl=Math.hypot(dx,dz)||1; ENTR[k].out = {x:p.x, y, z:p.z, dir:{x:dx/dl, z:dz/dl}}; }
      interactables.push({x:p.x, y:y+1.2, z:p.z, range:3.4, easy:true, prompt:()=> k==='main'?'[E] Entrar na instalação':'[E] Entrar pela saída de emergência', action:()=>useEntrance(k, true)});
    });
    // altura da nave = ponto mais alto embaixo dela (pra não afundar)
    let gy = -Infinity;
    for(let dx=-6;dx<=6;dx+=1.5) for(let dz=-3;dz<=3;dz+=1.5){ const h = sample(shipP.x+dx, shipP.z+dz); if(!isNaN(h)) gy = Math.max(gy, h); }
    if(!isFinite(gy)) gy = 0;
    onDone({ship:{x:shipP.x, z:shipP.z, y:gy}});
  }, err=>{
    toast('Modelo do exterior não carregou (abra com um servidor local). Usando terreno gerado.');
    onDone(buildProcExterior(moon));
  });
}

// --------------------------- Posto da Empresa -------------------------------
let SELL_DESK = null;
function buildCompanyExterior(){
  const look = S.moon.look;
  heightFn = ()=>0;
  worldBounds = {minX:-40, maxX:40, minZ:-30, maxZ:45};
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 75), new THREE.MeshStandardMaterial({color:look.ground, roughness:1, map:themeTexture('fabrica_chao')}));
  ground.material.map = themeTexture('fabrica_chao').clone(); ground.material.map.repeat.set(20,20); ground.material.map.needsUpdate = true;
  ground.rotation.x = -Math.PI/2; ground.position.z = 7.5; addToLevel(ground);
  // prédio da Empresa
  const wallMat = new THREE.MeshStandardMaterial({color:0x3c3e42, roughness:0.9, map:themeTexture('fabrica_parede')});
  addToLevel(box(60, 22, 6, wallMat, 0, 11, -24));
  addBoxObstacle(0, -24, 60, 6);
  addToLevel(box(8, 3.2, 0.3, MAT.black, 0, 3.4, -20.9)); // janela do balcão (escura)
  const deskMat = new THREE.MeshStandardMaterial({color:0x5a4a3a, roughness:0.8});
  addToLevel(box(9, 1.1, 2.2, deskMat, 0, 0.55, -19.6)); addBoxObstacle(0, -19.6, 9, 2.2);
  extraFloors.push({minX:-4.5, maxX:4.5, minZ:-20.7, maxZ:-18.5, y:1.1});
  const sign = makeTextPlane(['A EMPRESA — BALCÃO DE VENDAS'], 10, 1.0, {bg:'#101010', color:'#e8c070', fontSize:52});
  sign.position.set(0, 6.0, -20.95); addToLevel(sign);
  const rate = Math.round((CONFIG.SELL_RATE_BY_DAYS_LEFT[S.daysLeft] ?? 1)*100);
  const rateSign = makeTextPlane([`HOJE A EMPRESA PAGA: ${rate}%`], 7, 0.8, {bg:'#05120a', color:'#3aff7a', fontSize:48});
  rateSign.position.set(0, 7.2, -20.95); addToLevel(rateSign);
  // sino
  const bell = new THREE.Group(); bell.position.set(3.4, 1.1, -19.2); addToLevel(bell);
  bell.add(cyl(0.18,0.22,0.05, MAT.metal, 0,0.03,0)); bell.add(sph(0.14, new THREE.MeshStandardMaterial({color:0xc8a040, metalness:0.9, roughness:0.3}), 0, 0.12, 0));
  SELL_DESK = {x:0, z:-19.6, y:1.1, items:[]};
  interactables.push({x:0, y:1.6, z:-18.3, range:2.6, prompt:()=>{ const h=heldItem(); return h ? `[E] Colocar ${h.def.name} no balcão` : 'Balcão (segure algo pra vender)'; },
    action:()=>placeOnDesk()});
  interactables.push({x:3.4, y:1.3, z:-18.6, range:1.8, prompt:()=>`[E] Tocar o sino (vender ${SELL_DESK.items.length} itens)`, action:()=>ringBell()});
  // luzes
  [[-12,-18],[12,-18],[0,-10]].forEach(([lx,lz])=>{ const m=box(0.6,0.2,0.6,MAT.glowW.clone(),lx,8,lz); addToLevel(m); lamps.push({x:lx,y:7.5,z:lz,color:0xffe8c0,range:22,base:1.3,on:true,mesh:m,inFacility:false}); });
  // decoração: contêineres e postes
  [[-20,-8],[22,-6],[-26,10],[25,14]].forEach(([cx,cz])=>{ addToLevel(box(6,2.6,2.6,MAT.rust,cx,1.3,cz)); addBoxObstacle(cx,cz,6,2.6); });
  return {ship:{x:0, z:16}};
}
