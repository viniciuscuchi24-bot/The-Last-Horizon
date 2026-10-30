/*
 * ============================================================================
 *  06b-scenery.js — CENÁRIOS DAS LUAS (relevo + elementos)
 * ============================================================================
 *  Cada lua tem um "bioma" (MOONS[x].look.biome em 00-config.js):
 *    'deserto'  → mesetas em degraus, arcos de pedra, torres de rocha, carcaças enferrujadas
 *    'cinzas'   → morros de cinza, crateras, rachaduras de lava, árvores mortas
 *    'floresta' → morros suaves, floresta densa, arbustos, troncos caídos, cogumelos que brilham
 *    'neve'     → montanhas, pinheiros com neve, espinhos de gelo, lago congelado
 *    'abismo'   → agulhas vermelhas, costelas gigantes, cristais que brilham, monólitos
 *  Tudo que se repete muito usa InstancedMesh (1 desenho pra centenas de cópias),
 *  então roda bem até em GPU integrada e celular.
 * ============================================================================
 */

// ----------------------------------------------------------------- relevo
function ridged(x, z){ let v = 0, a = 0.5, f = 1; for(let i=0;i<4;i++){ const n = 1-Math.abs(vnoise(x*f, z*f)*2-1); v += n*n*a; f *= 2.1; a *= 0.5; } return v; }
function biomeHeight(x, z, look, F){
  const f = look.freq, A = look.amp;
  let h = (fbm(x*f+13.1, z*f+7.7, 5)-0.5)*2*A;                    // ondulação geral
  h += (fbm(x*f*3.3+4, z*f*3.3-9, 3)-0.5)*A*0.35;                 // detalhe
  const r = Math.hypot(x, z);
  const far = clamp((r-45)/60, 0, 1);                              // longe da nave = mais montanhoso
  h += ridged(x*f*0.9+31, z*f*0.9-17) * A * (look.mountains||1.6) * far;
  switch(look.biome){
    case 'deserto': { // mesetas em degraus
      const m = fbm(x*0.012+70, z*0.012-40, 3);
      if(m > 0.56){ const t = clamp((m-0.56)/0.06, 0, 1); h += t*t*(3-2*t)*A*2.2; }
      const step = 2.2; h = Math.floor(h/step)*step + Math.pow((h/step)%1, 4)*step*0.6;
      break; }
    case 'cinzas': case 'abismo':
      for(const c of F.craters){ const d = Math.hypot(x-c.x, z-c.z)/c.r; if(d < 1.6){ h += d < 1 ? -c.depth*(1-d*d) : c.depth*0.5*Math.max(0,1-(d-1)/0.6)*Math.sin(Math.min(1,d)*Math.PI*0.5); } }
      break;
    case 'neve':
      h += ridged(x*f*1.8+5, z*f*1.8+5) * A * 0.5 * far;
      if(F.lake){ const d = Math.hypot(x-F.lake.x, z-F.lake.z); if(d < F.lake.r){ const t = 1-d/F.lake.r; h = h*(1-Math.min(1,t*3)) + (F.lake.h)*Math.min(1,t*3); } }
      break;
  }
  // áreas planas (nave e entradas) + trilha entre a nave e a entrada principal
  for(const fl of F.flats){
    const d = Math.hypot(x-fl.x, z-fl.z);
    const t = clamp((d-fl.r)/fl.blend, 0, 1), s = t*t*(3-2*t);
    h = fl.h*(1-s) + h*s;
  }
  if(F.path){ const d = segDist(x, z, F.path); if(d < 7){ const t = clamp((d-2.5)/4.5,0,1), s = t*t*(3-2*t); const ph = pathHeightAt(x, z, F); h = ph*(1-s) + h*s; } }
  // paredão de montanhas nas bordas (limite do mapa)
  const edge = Math.max(Math.abs(x), Math.abs(z));
  h += Math.pow(clamp((edge-(EXT_SIZE-38))/32, 0, 1), 2)*60*(0.7+0.6*vnoise(x*0.05, z*0.05));
  return h;
}
function segDist(x, z, s){ const dx = s.x2-s.x1, dz = s.z2-s.z1, L = dx*dx+dz*dz; const t = clamp(((x-s.x1)*dx+(z-s.z1)*dz)/L, 0, 1); return Math.hypot(x-(s.x1+dx*t), z-(s.z1+dz*t)); }
function pathHeightAt(x, z, F){ const s = F.path, dx = s.x2-s.x1, dz = s.z2-s.z1, L = dx*dx+dz*dz; const t = clamp(((x-s.x1)*dx+(z-s.z1)*dz)/L, 0, 1); return s.h1 + (s.h2-s.h1)*t; }

// ----------------------------------------------------------------- terreno
function buildProcTerrainMesh(look){
  const N = 180, size = EXT_SIZE*2;
  const geo = new THREE.PlaneGeometry(size, size, N, N); geo.rotateX(-Math.PI/2);
  const pa = geo.attributes.position, cols = new Float32Array(pa.count*3);
  const c1 = new THREE.Color(look.ground), c2 = new THREE.Color(look.ground2), cr = new THREE.Color(look.rock), tmp = new THREE.Color();
  const snow = new THREE.Color(0xc4ccd2);
  for(let i=0;i<pa.count;i++){ pa.setY(i, heightFn(pa.getX(i), pa.getZ(i))); }
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal;
  for(let i=0;i<pa.count;i++){
    const x = pa.getX(i), z = pa.getZ(i), y = pa.getY(i), ny = nrm.getY(i);
    const n = fbm(x*0.05+50, z*0.05, 3);
    tmp.copy(c1).lerp(c2, clamp(n*1.5-0.25, 0, 1));
    const steep = clamp((0.86-ny)/0.25, 0, 1);              // encostas íngremes viram pedra
    tmp.lerp(cr, steep*0.85);
    if(look.biome==='neve' && ny>0.8) tmp.lerp(snow, 0.55);
    if(look.biome==='neve' && y > look.amp*1.2) tmp.lerp(snow, 0.8);
    const v = 0.9 + hash2(Math.floor(x*0.7), Math.floor(z*0.7))*0.2;  // leve granulado
    cols[i*3]=tmp.r*v; cols[i*3+1]=tmp.g*v; cols[i*3+2]=tmp.b*v;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols,3));
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({vertexColors:true, roughness:1, flatShading:true}));
  addToLevel(ground);
  // horizonte: anel de montanhas distantes (só visual)
  const ring = new THREE.Group();
  const mMat = new THREE.MeshStandardMaterial({color:new THREE.Color(look.rock).multiplyScalar(0.7), roughness:1, flatShading:true});
  for(let k=0;k<26;k++){
    const a = k/26*Math.PI*2 + rand(-0.08,0.08), d = rand(230, 300), hgt = rand(50, 120);
    const m = new THREE.Mesh(new THREE.ConeGeometry(rand(45,80), hgt, 6), mMat);
    m.position.set(Math.cos(a)*d, hgt/2-15, Math.sin(a)*d); m.rotation.y = rand(0,3); ring.add(m);
  }
  addToLevel(ring);
}

// ----------------------------------------------------------------- espalhar elementos
// Coloca 'count' cópias de uma geometria usando InstancedMesh, longe das áreas proibidas.
function scatter(geo, mat, count, o={}){
  const im = new THREE.InstancedMesh(geo, mat, count);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  let n = 0;
  for(let tries=0; n<count && tries<count*12; tries++){
    let x, z;
    if(o.near){ const c = pick(o.near), a = rand(0,Math.PI*2), d = rand(o.nearMin||0, o.nearMax||10); x = c.x+Math.cos(a)*d; z = c.z+Math.sin(a)*d; }
    else { x = rand(-EXT_SIZE+(o.edge||12), EXT_SIZE-(o.edge||12)); z = rand(-EXT_SIZE+(o.edge||12), EXT_SIZE-(o.edge||12)); }
    if(SCN.avoid.some(a=>Math.hypot(x-a.x, z-a.z) < a.r + (o.pad||0))) continue;
    if(SCN.path && segDist(x, z, SCN.path) < (o.pathPad!==undefined?o.pathPad:3.5)) continue;
    if(o.density && fbm(x*o.density[0]+11, z*o.density[0]-7, 2) < o.density[1]) continue;
    const y = heightFn(x, z);
    if(o.maxY!==undefined && y > o.maxY) continue;
    if(o.minY!==undefined && y < o.minY) continue;
    const s = rand(o.s0||1, o.s1||1);
    e.set(o.tilt ? rand(-o.tilt,o.tilt) : 0, rand(0, Math.PI*2), o.tilt ? rand(-o.tilt,o.tilt) : 0);
    q.setFromEuler(e); p.set(x, y + (o.y||0)*s, z); sc.set(s*(o.sx||1), s*(o.sy||1), s*(o.sz||1));
    m4.compose(p, q, sc); im.setMatrixAt(n++, m4);
    if(o.collide) addCircleObstacle(x, z, o.collide*s);
    if(o.onPlace) o.onPlace(x, y, z, s);
  }
  im.count = n; im.instanceMatrix.needsUpdate = true;
  addToLevel(im);
  return im;
}
const SCN = {avoid:[], path:null};
function M(c, o={}){ return new THREE.MeshStandardMaterial(Object.assign({color:c, roughness:0.95, flatShading:true}, o)); }
function glowM(c, k=1.6){ return new THREE.MeshStandardMaterial({color:c, emissive:c, emissiveIntensity:k, roughness:0.4}); }
// junta várias geometrias numa só (pra InstancedMesh de objetos compostos)
function mergeGeos(parts){
  const pos=[], nor=[], idx=[]; let off=0;
  for(const [g, x=0, y=0, z=0, rx=0, ry=0, rz=0, sx=1, sy=1, sz=1] of parts){
    const gg = g.index ? g.toNonIndexed() : g.clone();
    gg.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x,y,z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,rz)), new THREE.Vector3(sx,sy,sz)));
    gg.computeVertexNormals();
    const p = gg.attributes.position, n = gg.attributes.normal;
    for(let i=0;i<p.count;i++){ pos.push(p.getX(i),p.getY(i),p.getZ(i)); nor.push(n.getX(i),n.getY(i),n.getZ(i)); idx.push(off+i); }
    off += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos,3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor,3)); out.setIndex(idx);
  return out;
}
let _grassTex = null;
function grassTexture(){
  if(_grassTex) return _grassTex;
  _grassTex = canvasTex(64, (g,s)=>{ g.clearRect(0,0,s,s); for(let i=0;i<14;i++){ const x = rand(4,s-4), h = rand(s*0.4, s*0.95); g.strokeStyle = `rgba(255,255,255,${rand(0.7,1)})`; g.lineWidth = rand(1.5,3); g.beginPath(); g.moveTo(x, s); g.quadraticCurveTo(x+rand(-6,6), s-h*0.5, x+rand(-10,10), s-h); g.stroke(); } });
  return _grassTex;
}
function tuftGeo(){ return mergeGeos([[new THREE.PlaneGeometry(1,1),0,0.5,0], [new THREE.PlaneGeometry(1,1),0,0.5,0,0,Math.PI/2,0]]); }

// ----------------------------------------------------------------- montar a lua
function buildProcExterior(moon){
  const look = moon.look;
  const ang = rand(0, Math.PI*2), d1 = rand(58, 78);
  const main = {x:Math.cos(ang)*d1, z:Math.sin(ang)*d1};
  const ang2 = ang + (GR()<0.5?1:-1)*rand(1.0,1.7), d2 = rand(50, 85);
  const fire = {x:Math.cos(ang2)*d2, z:Math.sin(ang2)*d2};
  // elementos do relevo
  const F = {flats:[], craters:[], lake:null, path:null};
  const pre = (x,z)=>biomeHeight(x, z, look, {flats:[], craters:[], lake:null, path:null});
  if(look.biome==='cinzas' || look.biome==='abismo'){
    for(let k=0;k<9;k++){ const a = rand(0,Math.PI*2), d = rand(30, 120); const c = {x:Math.cos(a)*d, z:Math.sin(a)*d, r:rand(7,18), depth:rand(3,7)}; if(Math.hypot(c.x-main.x,c.z-main.z)<c.r+14 || Math.hypot(c.x-fire.x,c.z-fire.z)<c.r+10 || Math.hypot(c.x,c.z)<c.r+18) continue; F.craters.push(c); }
  }
  if(look.biome==='neve'){ const a = ang+Math.PI+rand(-0.8,0.8), d = rand(40,70); F.lake = {x:Math.cos(a)*d, z:Math.sin(a)*d, r:rand(14,22), h:pre(0,0)-1.5}; }
  F.flats = [
    {x:0, z:0, r:13, blend:15, h:pre(0,0)},
    {x:main.x, z:main.z, r:10, blend:13, h:pre(main.x,main.z)},
    {x:fire.x, z:fire.z, r:6, blend:9, h:pre(fire.x,fire.z)},
  ];
  F.path = {x1:0, z1:0, x2:main.x*0.9, z2:main.z*0.9, h1:F.flats[0].h, h2:F.flats[1].h};
  heightFn = (x,z)=>biomeHeight(x, z, look, F);
  worldBounds = {minX:-EXT_SIZE, maxX:EXT_SIZE, minZ:-EXT_SIZE, maxZ:EXT_SIZE};
  buildProcTerrainMesh(look);
  // áreas onde não se coloca nada
  SCN.avoid = [{x:0,z:0,r:16}, {x:main.x,z:main.z,r:15}, {x:fire.x,z:fire.z,r:8}];
  if(F.lake) SCN.avoid.push({x:F.lake.x, z:F.lake.z, r:F.lake.r});
  SCN.path = F.path;
  decorateBiome(look, F, main, fire);
  decorateCommon(look, main, fire);
  buildMainEntranceBuilding(main.x, heightFn(main.x,main.z), main.z, Math.atan2(-main.x, -main.z));
  buildFireExitHatch(fire.x, heightFn(fire.x,fire.z), fire.z, Math.atan2(-fire.x, -fire.z));
  return {ship:{x:0, z:0}};
}

// elementos de cada bioma
function decorateBiome(look, F, main, fire){
  const rockM = M(look.rock), rockDark = M(new THREE.Color(look.rock).multiplyScalar(0.7));
  const boulder = new THREE.IcosahedronGeometry(1, 0), boulder1 = new THREE.DodecahedronGeometry(1, 0);
  // pedras em todos os biomas (grandes com colisão, pequenas sem)
  scatter(boulder, rockM, look.rocks, {s0:0.8, s1:3.4, sy:0.7, y:0.2, tilt:0.4, collide:0.85, pad:2});
  scatter(boulder1, rockDark, look.rocks*3, {s0:0.15, s1:0.6, sy:0.6, tilt:0.6, pathPad:0});
  switch(look.biome){
    case 'deserto': {
      const spire = mergeGeos([[new THREE.CylinderGeometry(0.6,1.6,8,6),0,4,0],[new THREE.CylinderGeometry(1.4,0.7,2.2,6),0.2,8.8,0]]);
      scatter(spire, M(0x8a5233), 22, {s0:0.8, s1:2.0, collide:1.4, pad:4});
      // arcos de pedra
      for(let k=0;k<4;k++){ const a = rand(0,Math.PI*2), d = rand(40,120); const x = Math.cos(a)*d, z = Math.sin(a)*d; if(SCN.avoid.some(v=>Math.hypot(x-v.x,z-v.z)<v.r+10)) continue;
        const arch = new THREE.Mesh(new THREE.TorusGeometry(7, 1.6, 6, 12, Math.PI), M(0x7a4428)); arch.position.set(x, heightFn(x,z)-1, z); arch.rotation.y = rand(0,3); addToLevel(arch);
        const ex = Math.cos(arch.rotation.y)*7, ez = -Math.sin(arch.rotation.y)*7; addCircleObstacle(x+ex, z+ez, 1.8); addCircleObstacle(x-ex, z-ez, 1.8); }
      const shrub = mergeGeos([[new THREE.IcosahedronGeometry(0.5,0),0,0.3,0,0,0,0,1,0.6,1],[new THREE.CylinderGeometry(0.02,0.04,0.6,4),0.2,0.4,0,0,0,0.5]]);
      scatter(shrub, M(0x6a5a30), 160, {s0:0.6, s1:1.4, pathPad:1});
      scatter(new THREE.ConeGeometry(0.25, 1.6, 5), M(0x4a6a3a), 60, {s0:0.6, s1:1.8, y:0.8, collide:0.3}); // cactos
      // carcaças enferrujadas
      for(let k=0;k<5;k++) placeWreck(look, rand(-110,110), rand(-110,110));
      break; }
    case 'cinzas': {
      const dead = mergeGeos([[new THREE.CylinderGeometry(0.15,0.35,6,5),0,3,0],[new THREE.CylinderGeometry(0.06,0.12,2.6,4),0.6,4.4,0,0,0,-0.8],[new THREE.CylinderGeometry(0.05,0.1,2,4),-0.5,5,0.2,0.3,0,0.9],[new THREE.CylinderGeometry(0.04,0.08,1.6,4),0.1,5.6,-0.5,-0.9,0,0]]);
      scatter(dead, M(0x15120f), 90, {s0:0.7, s1:1.6, collide:0.3, pad:1, tilt:0.12});
      // rachaduras de lava (brilham à noite)
      const crack = new THREE.BoxGeometry(0.35, 0.06, 4);
      scatter(crack, glowM(0xff4a10, 1.4), 70, {s0:0.6, s1:2.0, y:0.02, pathPad:1});
      // fumaça das crateras
      F.craters.forEach(c=>{ const y = heightFn(c.x, c.z); for(let k=0;k<3;k++){ const s = sph(rand(1.5,3), new THREE.MeshBasicMaterial({color:0x2a2624, transparent:true, opacity:0.25, depthWrite:false}), c.x+rand(-3,3), y+rand(2,8), c.z+rand(-3,3)); addToLevel(s); } const l = glowM(0xff3a08, 2.2); const pool = new THREE.Mesh(new THREE.CircleGeometry(c.r*0.35, 10), l); pool.rotation.x = -Math.PI/2; pool.position.set(c.x, y-c.depth*0.92, c.z); addToLevel(pool); lamps.push({x:c.x, y:y-c.depth+2, z:c.z, color:0xff5020, range:16, base:1.5, on:true, inFacility:false}); });
      scatter(boulder, M(0x2a2826), 40, {s0:1, s1:2.5, sy:0.5, collide:0.8});
      break; }
    case 'floresta': {
      const pine = mergeGeos([[new THREE.CylinderGeometry(0.25,0.45,4,6),0,2,0],[new THREE.ConeGeometry(2.8,5,7),0,5,0],[new THREE.ConeGeometry(2.1,4,7),0,7.5,0],[new THREE.ConeGeometry(1.3,3.2,7),0,9.8,0]]);
      const broad = mergeGeos([[new THREE.CylinderGeometry(0.3,0.5,5,6),0,2.5,0],[new THREE.IcosahedronGeometry(2.8,0),0,6.5,0,0,0,0,1,0.8,1],[new THREE.IcosahedronGeometry(2,0),1.5,5.8,0.8]]);
      const leaf = M(look.treeColor), leaf2 = M(new THREE.Color(look.treeColor).offsetHSL(0.03, 0, 0.06));
      scatter(pine, leaf, look.trees, {s0:0.8, s1:1.7, collide:0.45, pad:2, density:[0.02, 0.35]});
      scatter(broad, leaf2, Math.floor(look.trees*0.5), {s0:0.8, s1:1.5, collide:0.5, pad:2, density:[0.02, 0.4]});
      const bush = new THREE.IcosahedronGeometry(1, 0);
      scatter(bush, M(0x2e4a26), 260, {s0:0.4, s1:1.2, sy:0.7, y:0.3, pathPad:1.5});
      const logG = new THREE.CylinderGeometry(0.45, 0.5, 7, 7); logG.rotateZ(Math.PI/2);
      scatter(logG, M(0x3a2a1c), 18, {s0:0.7, s1:1.2, y:0.35, collide:0.9, pad:2});
      const shroom = mergeGeos([[new THREE.CylinderGeometry(0.06,0.08,0.4,5),0,0.2,0],[new THREE.SphereGeometry(0.22,6,4,0,Math.PI*2,0,Math.PI/2),0,0.38,0]]);
      scatter(shroom, glowM(0x5affd0, 1.2), 140, {s0:0.6, s1:1.8, near:[{x:0,z:0}], nearMin:20, nearMax:130, density:[0.05, 0.55], pathPad:1});
      break; }
    case 'neve': {
      const spruce = mergeGeos([[new THREE.CylinderGeometry(0.2,0.35,3,6),0,1.5,0],[new THREE.ConeGeometry(2.4,4.5,7),0,4,0],[new THREE.ConeGeometry(1.7,3.6,7),0,6.2,0],[new THREE.ConeGeometry(1.0,2.6,7),0,8.2,0]]);
      const snowCap = mergeGeos([[new THREE.ConeGeometry(2.0,1.2,7),0,5.6,0],[new THREE.ConeGeometry(1.4,1,7),0,7.6,0],[new THREE.ConeGeometry(0.8,0.9,7),0,9.2,0]]);
      const im1 = scatter(spruce, M(look.treeColor), look.trees, {s0:0.8, s1:1.6, collide:0.4, pad:2, density:[0.025, 0.38]});
      const im2 = new THREE.InstancedMesh(snowCap, M(0xeef4f8), im1.count); for(let i=0;i<im1.count;i++){ const m4 = new THREE.Matrix4(); im1.getMatrixAt(i, m4); im2.setMatrixAt(i, m4); } addToLevel(im2);
      const ice = new THREE.ConeGeometry(0.5, 4, 5);
      scatter(ice, new THREE.MeshStandardMaterial({color:0x9ad8f0, emissive:0x2a6a8a, emissiveIntensity:0.4, transparent:true, opacity:0.85, roughness:0.1, metalness:0.2, flatShading:true}), 90, {s0:0.5, s1:2.2, y:1.6, tilt:0.35, collide:0.35, pad:1});
      scatter(new THREE.SphereGeometry(1, 7, 5), M(0xdfe8ee), 70, {s0:1, s1:3.5, sy:0.35, pathPad:2});
      if(F.lake){ const y = F.lake.h+0.08; const lake = new THREE.Mesh(new THREE.CircleGeometry(F.lake.r*0.95, 28), new THREE.MeshStandardMaterial({color:0xa8d0e0, roughness:0.05, metalness:0.6})); lake.rotation.x = -Math.PI/2; lake.position.set(F.lake.x, y, F.lake.z); addToLevel(lake); }
      break; }
    case 'abismo': {
      const needle = new THREE.ConeGeometry(1.4, 14, 5);
      scatter(needle, M(0x3a0e0c), 70, {s0:0.5, s1:2.0, y:6.5, tilt:0.15, collide:1.0, pad:3});
      // costelas gigantes
      for(let k=0;k<4;k++){ const a = rand(0,Math.PI*2), d = rand(35,110); const x = Math.cos(a)*d, z = Math.sin(a)*d; if(SCN.avoid.some(v=>Math.hypot(x-v.x,z-v.z)<v.r+12)) continue;
        const ry = rand(0,3), g = new THREE.Group(); g.position.set(x, heightFn(x,z)-1, z); g.rotation.y = ry; addToLevel(g);
        for(let r=0;r<6;r++){ const rib = new THREE.Mesh(new THREE.TorusGeometry(6-r*0.4, 0.45, 5, 10, Math.PI*0.9), M(0xd8cbb0)); rib.position.z = r*2.4 - 6; rib.rotation.z = 0.15; g.add(rib); }
        g.add(box(0.9, 0.9, 16, M(0xc8bba0), 0, 0.3, 0)); }
      scatter(new THREE.OctahedronGeometry(0.6, 0), glowM(0xff1a2a, 1.8), 120, {s0:0.5, s1:2.2, sy:1.8, y:0.6, tilt:0.5, pathPad:1});
      scatter(new THREE.BoxGeometry(1.6, 9, 0.8), M(0x080606, {roughness:0.3, metalness:0.6}), 10, {s0:0.8, s1:1.4, y:4.3, collide:1.0, pad:4});
      break; }
  }
  // grama/tufos rasteiros em todos os biomas (cor do chão)
  if(look.biome!=='neve' && look.biome!=='abismo'){
    const grassCol = look.biome==='floresta' ? 0x5a8a3a : (look.biome==='deserto' ? 0x9a8a50 : 0x4a4640);
    const gm = new THREE.MeshStandardMaterial({color:grassCol, map:grassTexture(), alphaTest:0.5, side:THREE.DoubleSide, roughness:1});
    scatter(tuftGeo(), gm, look.biome==='floresta' ? 2200 : 900, {s0:0.4, s1:1.1, pathPad:0.5, density:[0.03, 0.3]});
  }
}
// carcaça de veículo
function placeWreck(look, x, z){
  if(SCN.avoid.some(a=>Math.hypot(x-a.x,z-a.z)<a.r+8)) return;
  const y = heightFn(x,z), g = new THREE.Group(); g.position.set(x, y, z); g.rotation.set(rand(-0.08,0.08), rand(0,6), rand(-0.12,0.12)); addToLevel(g);
  const rust = M(0x6a3a1e, {metalness:0.4}), dark = M(0x1a1612);
  g.add(box(5.2, 1.2, 2.4, rust, 0, 1.0, 0)); g.add(box(2.4, 1.1, 2.2, rust, -0.9, 2.1, 0)); g.add(box(1.6, 0.7, 2.25, dark, -0.9, 2.2, 0));
  [[-1.8,1.2],[1.8,1.2],[-1.8,-1.2],[1.8,-1.2]].forEach(([wx,wz])=>{ const w = cyl(0.55,0.55,0.4,dark,wx,0.5,wz,8); w.rotation.x = Math.PI/2; g.add(w); });
  addCircleObstacle(x, z, 2.6);
}
// elementos comuns: torre de rádio, postes de luz na trilha, contêineres, ruínas perto da entrada
function decorateCommon(look, main, fire){
  // postes de luz acompanhando a trilha até a entrada principal
  const pathLen = Math.hypot(main.x, main.z);
  for(let t=18; t<pathLen-12; t+=16){
    const k = t/pathLen, side = (Math.round(t/16)%2) ? 1 : -1;
    const nx = -main.z/pathLen, nz = main.x/pathLen;
    const x = main.x*k + nx*3.2*side, z = main.z*k + nz*3.2*side, y = heightFn(x,z);
    const pole = new THREE.Group(); pole.position.set(x, y, z); addToLevel(pole);
    pole.add(cyl(0.08, 0.12, 4.2, MAT.metal, 0, 2.1, 0)); const lm = box(0.5, 0.15, 0.25, MAT.glowY.clone(), 0, 4.2, 0); pole.add(lm);
    lamps.push({x, y:y+4, z, color:0xffc070, range:12, base:0.9, on:true, flicker:GR()<0.25, mesh:lm, inFacility:false});
    addCircleObstacle(x, z, 0.2);
  }
  // torre de rádio com luz piscando
  { const a = rand(0,Math.PI*2), d = rand(70, 110); const x = Math.cos(a)*d, z = Math.sin(a)*d;
    if(!SCN.avoid.some(v=>Math.hypot(x-v.x,z-v.z)<v.r+6)){
      const y = heightFn(x,z), g = new THREE.Group(); g.position.set(x, y, z); addToLevel(g);
      const H = 28; [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([a1,b1])=>{ const leg = cyl(0.1,0.15,H,MAT.metal,a1*0.9,H/2,b1*0.9,5); leg.rotation.z = -a1*0.03; leg.rotation.x = b1*0.03; g.add(leg); });
      for(let h=2;h<H;h+=3) g.add(box(2,0.08,0.08,MAT.metal,0,h,0.9)).add(box(0.08,0.08,2,MAT.metal,0.9,0,-0.9));
      const red = sph(0.35, MAT.glowR.clone(), 0, H+0.4, 0); g.add(red);
      lamps.push({x, y:y+H, z, color:0xff2010, range:30, base:1.4, on:true, flicker:true, mesh:red, inFacility:false});
      addCircleObstacle(x, z, 1.4);
    } }
  // contêineres e caixas espalhados perto da entrada (área "abandonada")
  const crateM = M(0x5a4a30), contM = [M(0x6a2a1a, {metalness:0.4}), M(0x2a4a5a, {metalness:0.4}), M(0x5a5a2a, {metalness:0.4})];
  for(let k=0;k<4;k++){
    const a = rand(0,Math.PI*2), d = rand(16, 26), x = main.x+Math.cos(a)*d, z = main.z+Math.sin(a)*d;
    if(Math.hypot(x,z)<18 || segDist(x,z,SCN.path)<5) continue;
    const c = box(6, 2.6, 2.5, pick(contM), x, heightFn(x,z)+1.25, z); c.rotation.y = rand(0,3); addToLevel(c); addCircleObstacle(x, z, 2.2);
  }
  scatter(new THREE.BoxGeometry(1,1,1), crateM, 20, {near:[main], nearMin:10, nearMax:24, s0:0.6, s1:1.2, y:0.5, collide:0.6, pathPad:2.5});
  // ruínas: pilares e muros quebrados
  const wallM = M(0x5a5856);
  for(let k=0;k<6;k++){
    const a = rand(0,Math.PI*2), d = rand(30, 120), x = Math.cos(a)*d, z = Math.sin(a)*d;
    if(SCN.avoid.some(v=>Math.hypot(x-v.x,z-v.z)<v.r+6) || segDist(x,z,SCN.path)<6) continue;
    const g = new THREE.Group(); g.position.set(x, heightFn(x,z)-0.3, z); g.rotation.y = rand(0,3); addToLevel(g);
    const len = rand(5, 10); g.add(box(len, rand(1.5,3.5), 0.5, wallM, 0, 1.2, 0));
    g.add(box(0.8, rand(3,6), 0.8, wallM, len/2, 2, 0)); g.add(box(rand(1,2), 0.8, 0.5, wallM, -len/2-0.6, 0.3, 0.3));
    const cxw = Math.cos(g.rotation.y), szw = -Math.sin(g.rotation.y);
    for(let s=-len/2; s<=len/2; s+=1.5) addCircleObstacle(x+cxw*s, z+szw*s, 0.5);
  }
}
