/*
 * ============================================================================
 *  07-facility.js — A INSTALAÇÃO (gerada aleatoriamente a cada pouso)
 * ============================================================================
 *  A instalação é uma grade de "células" (salas e corredores) feita de ladrilhos
 *  de 1,5m. O gerador:
 *    1. cresce um labirinto de células a partir da entrada (com alguns loops)
 *    2. escolhe o tipo de cada célula (sala ou corredor)
 *    3. coloca portas (algumas trancadas), lâmpadas, móveis, dutos de ventilação
 *       (de onde saem os monstros), quadro de energia, o Núcleo de energia e a saída de emergência
 *  Temas: 'fabrica' e 'mansao' (texturas em ASSETS.textures).
 * ============================================================================
 */

const FAC = {T:1.5, CT:8, H:4.2};
let facilityDebugMap = false;

function tIdx(i,j){ return j*FAC.tw + i; }
function tileOf(x,z){ return [Math.floor((x-FAC_ORIGIN.x)/FAC.T), Math.floor((z-FAC_ORIGIN.z)/FAC.T)]; }
function tileCenter(i,j){ return {x:FAC_ORIGIN.x+(i+0.5)*FAC.T, z:FAC_ORIGIN.z+(j+0.5)*FAC.T}; }
function inGrid(i,j){ return i>=0 && j>=0 && i<FAC.tw && j<FAC.th; }
function tileWalkable(i,j, forMonster=false){
  if(!inGrid(i,j)) return false;
  const k = tIdx(i,j);
  if(!FAC.walk[k] || FAC.block[k]) return false;
  const d = FAC.doorAt[k];
  if(d){
    if(d.open) return true;
    if(forMonster) return !d.locked && !d.mimic;
    return false;
  }
  return true;
}
function cellOfPos(x,z){ const [i,j] = tileOf(x,z); return {cx:Math.floor(i/FAC.CT), cz:Math.floor(j/FAC.CT)}; }

// ---------------------------------------------------------------- colisão
function facilityResolve(pos, r, forMonster){
  const [ti,tj] = tileOf(pos.x,pos.z);
  for(let j=tj-1;j<=tj+1;j++) for(let i=ti-1;i<=ti+1;i++){
    if(tileWalkable(i,j,forMonster)) continue;
    const x0 = FAC_ORIGIN.x+i*FAC.T, z0 = FAC_ORIGIN.z+j*FAC.T, x1 = x0+FAC.T, z1 = z0+FAC.T;
    const cx = clamp(pos.x, x0, x1), cz = clamp(pos.z, z0, z1);
    const dx = pos.x-cx, dz = pos.z-cz, d = Math.hypot(dx,dz);
    if(d < r){
      if(d > 1e-5){ pos.x = cx + dx/d*r; pos.z = cz + dz/d*r; }
      else { // dentro do ladrilho: empurra pro lado mais próximo
        const px = Math.min(pos.x-x0, x1-pos.x), pz = Math.min(pos.z-z0, z1-pos.z);
        if(px<pz) pos.x = (pos.x-x0 < x1-pos.x) ? x0-r : x1+r; else pos.z = (pos.z-z0 < z1-pos.z) ? z0-r : z1+r;
      }
    }
  }
}
function facilityMove(pos, dx, dz, r, forMonster){
  const steps = Math.ceil(Math.hypot(dx,dz)/0.3) || 1;
  for(let s=0;s<steps;s++){
    pos.x += dx/steps; facilityResolve(pos, r, forMonster);
    pos.z += dz/steps; facilityResolve(pos, r, forMonster);
  }
  if(forMonster){ // criaturas abrem portas comuns ao passar
    const [i,j] = tileOf(pos.x,pos.z);
    for(let jj=j-1;jj<=j+1;jj++) for(let ii=i-1;ii<=i+1;ii++){
      if(!inGrid(ii,jj)) continue;
      const d = FAC.doorAt[tIdx(ii,jj)];
      if(d && !d.open && !d.locked && !d.mimic){
        const c = tileCenter(ii,jj);
        if(Math.hypot(c.x-pos.x, c.z-pos.z) < 1.6) openDoor(d, true);
      }
    }
  }
}
// linha de visão pela grade (DDA)
function facilityLOS(x1,z1,x2,z2){
  const d = Math.hypot(x2-x1, z2-z1); const n = Math.ceil(d/(FAC.T*0.35));
  for(let s=1;s<n;s++){
    const t = s/n; const [i,j] = tileOf(x1+(x2-x1)*t, z1+(z2-z1)*t);
    if(!inGrid(i,j)) return false;
    const k = tIdx(i,j);
    if(!FAC.walk[k]) return false;
    const dr = FAC.doorAt[k]; if(dr && !dr.open) return false;
    if(FAC.block[k]===2) return false; // móveis altos bloqueiam a visão
  }
  return true;
}

// ---------------------------------------------------------------- A* (caminho das criaturas)
function findPath(fromX, fromZ, toX, toZ, forMonster=true, maxIter=6000){
  const [si,sj] = tileOf(fromX,fromZ), [gi,gj] = tileOf(toX,toZ);
  if(!inGrid(gi,gj)) return null;
  const W = FAC.tw, N = W*FAC.th;
  const g = FAC._g || (FAC._g = new Float32Array(N)), came = FAC._came || (FAC._came = new Int32Array(N));
  const stamp = FAC._stamp || (FAC._stamp = new Int32Array(N)); FAC._run = (FAC._run||0)+1; const run = FAC._run;
  const open = [], start = tIdx(si,sj), goal = tIdx(gi,gj);
  const h = k=>{ const i=k%W, j=(k/W)|0; return Math.hypot(i-gi, j-gj); };
  const push = (f,k)=>{ open.push([f,k]); let c=open.length-1; while(c>0){ const p=(c-1)>>1; if(open[p][0]<=open[c][0]) break; [open[p],open[c]]=[open[c],open[p]]; c=p; } };
  const pop = ()=>{ const top=open[0], last=open.pop(); if(open.length){ open[0]=last; let c=0; for(;;){ const l=c*2+1, r=l+1; let m=c; if(l<open.length&&open[l][0]<open[m][0]) m=l; if(r<open.length&&open[r][0]<open[m][0]) m=r; if(m===c) break; [open[m],open[c]]=[open[c],open[m]]; c=m; } } return top; };
  stamp[start]=run; g[start]=0; came[start]=-1; push(h(start), start);
  let it=0, found=false;
  const dirs = [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[1,-1,1.414],[-1,1,1.414],[-1,-1,1.414]];
  while(open.length && it++<maxIter){
    const [,k] = pop();
    if(k===goal){ found=true; break; }
    const i=k%W, j=(k/W)|0;
    for(const [di,dj,c] of dirs){
      const ni=i+di, nj=j+dj;
      if(!tileWalkable(ni,nj,forMonster) && tIdx(ni,nj)!==goal) continue;
      if(di&&dj && (!tileWalkable(i+di,j,forMonster) || !tileWalkable(i,j+dj,forMonster))) continue;
      const nk = tIdx(ni,nj), ng = g[k]+c;
      if(stamp[nk]!==run || ng < g[nk]){ stamp[nk]=run; g[nk]=ng; came[nk]=k; push(ng+h(nk), nk); }
    }
  }
  if(!found) return null;
  const path = []; let k = goal;
  while(k!==-1 && k!==start){ path.push(k); k = came[k]; }
  path.reverse();
  return path.map(k=>tileCenter(k%W, (k/W)|0));
}

// ---------------------------------------------------------------- portas
function openDoor(d, byMonster){
  if(d.open) return;
  d.open = true; sfx('door', {x:d.x, z:d.z, inFacility:true}, byMonster?0.8:1);
}
function closeDoor(d){
  if(!d.open) return;
  // não fecha em cima de alguém
  if(Math.hypot(player.pos.x-d.x, player.pos.z-d.z) < 1.2 && player.inFacility) return;
  d.open = false; sfx('door', {x:d.x, z:d.z, inFacility:true}, 0.8);
}
function animateDoors(dt){
  if(!FAC.doors) return;
  FAC.doors.forEach(d=>{
    const target = d.open ? d.swing : 0;
    d.rot += (target-d.rot)*Math.min(1, dt*8);
    d.pivot.rotation.y = d.baseRot + d.rot;
  });
}

// ---------------------------------------------------------------- GERADOR
function generateFacility(moon){
  const cfg = moon.facility;
  const theme = weightedPick(cfg.theme);
  const N = randInt(cfg.cells[0], cfg.cells[1]);
  const side = Math.ceil(Math.sqrt(N*2.0))+1;
  const cw = side, ch = side;
  FAC.cw = cw; FAC.ch = ch; FAC.tw = cw*FAC.CT; FAC.th = ch*FAC.CT; FAC.theme = theme;
  FAC.walk = new Uint8Array(FAC.tw*FAC.th);
  FAC.block = new Uint8Array(FAC.tw*FAC.th);  // 1 = móvel baixo, 2 = móvel alto
  FAC.doorAt = {}; FAC.doors = []; FAC.vents = []; FAC.cellLamps = []; FAC._g = null; FAC._came=null; FAC._stamp=null;
  FAC.trapSpots = {hall:[], room:[]}; FAC.scrapSpots = []; FAC.decals = [];
  FAC.webs = [];
  const cells = {}; const key = (x,z)=>x+','+z;
  const DIRS = {n:[0,-1], s:[0,1], e:[1,0], w:[-1,0]}, OPP = {n:'s', s:'n', e:'w', w:'e'};
  const start = {x:Math.floor(cw/2), z:ch-1};
  const order = [];
  const addCell = (x,z)=>{ const c = {x, z, conn:{}, type:'hall', dist:0}; cells[key(x,z)] = c; order.push(c); return c; };
  addCell(start.x, start.z);
  let guard = 0;
  while(order.length < N && guard++ < 5000){
    const from = GR()<0.55 ? order[order.length-1] : pick(order);
    const dname = pick(Object.keys(DIRS)), [dx,dz] = DIRS[dname];
    const nx = from.x+dx, nz = from.z+dz;
    if(nx<0||nz<0||nx>=cw||nz>=ch||cells[key(nx,nz)]) continue;
    if(from===order[0] && dname==='s') continue;
    const c = addCell(nx,nz);
    from.conn[dname] = true; c.conn[OPP[dname]] = true;
  }
  // loops extras
  order.forEach(c=>{ for(const [dn,[dx,dz]] of Object.entries(DIRS)){ const o = cells[key(c.x+dx,c.z+dz)]; if(o && !c.conn[dn] && GR()<0.13){ c.conn[dn]=true; o.conn[OPP[dn]]=true; } } });
  // distâncias (BFS) a partir da entrada
  const lobby = order[0]; lobby.dist = 0; const q=[lobby]; const seen = new Set([lobby]);
  while(q.length){ const c=q.shift(); for(const [dn,[dx,dz]] of Object.entries(DIRS)){ if(!c.conn[dn]) continue; const o=cells[key(c.x+dx,c.z+dz)]; if(o && !seen.has(o)){ seen.add(o); o.dist=c.dist+1; q.push(o); } } }
  // tipos
  order.forEach((c,i)=>{
    const deg = Object.keys(c.conn).length;
    if(i===0){ c.type='room'; c.lobby=true; return; }
    if(deg===1) c.type = GR()<0.6 ? 'room' : 'hall';
    else c.type = GR()<(theme==='mansao'?0.5:0.35) ? 'room' : 'hall';
  });
  const byDist = order.slice().sort((a,b)=>b.dist-a.dist);
  const appCell = byDist[0]; appCell.type='room'; appCell.apparatus=true;
  const fireCell = byDist.find(c=>c!==appCell && c.dist>=Math.max(2, appCell.dist*0.5) && Object.keys(c.conn).length<4) || byDist[1];
  fireCell.type='room'; fireCell.fire=true;
  FAC.cells = order; FAC.cellMap = cells; FAC.lobby = lobby;

  // ---- escava os ladrilhos ----
  const CT = FAC.CT, carve = (i,j)=>{ if(inGrid(i,j)) FAC.walk[tIdx(i,j)] = 1; };
  order.forEach(c=>{
    const bi = c.x*CT, bj = c.z*CT;
    if(c.type==='room'){ for(let j=1;j<=6;j++) for(let i=1;i<=6;i++) carve(bi+i,bj+j); }
    else { for(let j=3;j<=4;j++) for(let i=3;i<=4;i++) carve(bi+i,bj+j); }
    for(const dn of Object.keys(c.conn)){
      if(dn==='n') for(let j=0;j<=4;j++){ carve(bi+3,bj+j); carve(bi+4,bj+j); }
      if(dn==='s') for(let j=3;j<=7;j++){ carve(bi+3,bj+j); carve(bi+4,bj+j); }
      if(dn==='w') for(let i=0;i<=4;i++){ carve(bi+i,bj+3); carve(bi+i,bj+4); }
      if(dn==='e') for(let i=3;i<=7;i++){ carve(bi+i,bj+3); carve(bi+i,bj+4); }
    }
  });

  const root = new THREE.Group(); root.position.set(FAC_ORIGIN.x, 0, FAC_ORIGIN.z); addToLevel(root);
  FAC.root = root;
  const wallTex = themeTexture(theme+'_parede'), floorTex = themeTexture(theme+'_chao'), ceilTex = themeTexture(theme+'_teto');
  buildWallsMesh(root, wallTex);
  // chão e teto
  const W = FAC.tw*FAC.T, D = FAC.th*FAC.T;
  const ft = floorTex.clone(); ft.needsUpdate = true; ft.repeat.set(W/3, D/3);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({map:ft, roughness:0.9, metalness:0.1}));
  floor.rotation.x = -Math.PI/2; floor.position.set(W/2, 0, D/2); root.add(floor);
  const ct = ceilTex.clone(); ct.needsUpdate = true; ct.repeat.set(W/3, D/3);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({map:ct, roughness:1}));
  ceil.rotation.x = Math.PI/2; ceil.position.set(W/2, FAC.H, D/2); root.add(ceil);

  // ---- portas entre células ----
  const doorMat = theme==='mansao' ? new THREE.MeshStandardMaterial({color:0x4a2e1a, roughness:0.7}) : new THREE.MeshStandardMaterial({color:0x6e757c, roughness:0.5, metalness:0.6});
  const lockedMat = new THREE.MeshStandardMaterial({color:0x6a2420, roughness:0.5, metalness:0.5});
  let lockedCount = 0;
  order.forEach(c=>{
    ['e','s'].forEach(dn=>{
      if(!c.conn[dn]) return;
      const o = cells[key(c.x+DIRS[dn][0], c.z+DIRS[dn][1])];
      const roomish = c.type==='room' || o.type==='room';
      if(GR() > (roomish?0.6:0.3)) return;
      const locked = !c.lobby && !o.lobby && GR()<0.2;
      if(locked) lockedCount++;
      const bi = c.x*CT, bj = c.z*CT;
      const tiles = dn==='e' ? [[bi+7,bj+3],[bi+7,bj+4]] : [[bi+3,bj+7],[bi+4,bj+7]];
      makeDoor(root, tiles, dn==='e', locked, locked?lockedMat:doorMat);
    });
  });
  FAC.lockedCount = lockedCount;

  // ---- lâmpadas, móveis, dutos ----
  order.forEach(c=>{
    const bi = c.x*CT, bj = c.z*CT;
    const center = tileCenter(bi+3.5, bj+3.5);
    const lampMesh = new THREE.Mesh(new THREE.BoxGeometry(c.type==='room'?1.6:1.0, 0.08, 0.35), MAT.glowW.clone());
    lampMesh.position.set(center.x-FAC_ORIGIN.x, FAC.H-0.05, center.z-FAC_ORIGIN.z);
    root.add(lampMesh);
    const lamp = {x:center.x, y:FAC.H-0.4, z:center.z, color: theme==='mansao'?0xffc890:0xe8f0ff, range: c.type==='room'?18:15, base: c.type==='room'?2.2:1.8, on:true, flicker: GR()<0.18, mesh:lampMesh, inFacility:true};
    lamps.push(lamp); FAC.cellLamps.push(lamp);
    if(c.type==='room'){
      addRoomProps(root, c, theme);
      for(let k=0;k<4;k++) FAC.scrapSpots.push({i:bi+randInt(2,5), j:bj+randInt(2,5), room:true});
      FAC.trapSpots.room.push(c);
    } else {
      FAC.scrapSpots.push({i:bi+randInt(3,4), j:bj+randInt(3,4), room:false});
      FAC.trapSpots.hall.push(c);
    }
  });
  // dutos de ventilação (de onde as criaturas saem)
  const ventCells = order.filter(c=>!c.lobby && c.dist>=1);
  for(let k=0;k<Math.min(ventCells.length, 3+Math.floor(N/5));k++){
    const c = ventCells.splice(randInt(0,ventCells.length-1),1)[0];
    const bi=c.x*CT, bj=c.z*CT; const ti = bi+ (c.type==='room'?randInt(2,5):3), tj = bj+(c.type==='room'?randInt(2,5):4);
    if(!FAC.walk[tIdx(ti,tj)] || FAC.block[tIdx(ti,tj)]) continue;
    const p = tileCenter(ti,tj);
    const v = new THREE.Group(); v.position.set(p.x-FAC_ORIGIN.x, 0.02, p.z-FAC_ORIGIN.z); root.add(v);
    v.add(box(1.0, 0.04, 1.0, MAT.dark, 0, 0, 0));
    for(let s=-0.35;s<=0.36;s+=0.14) v.add(box(0.06, 0.05, 0.9, MAT.metal, s, 0.02, 0));
    FAC.vents.push({x:p.x, z:p.z, mesh:v, cell:c});
  }

  // ---- entrada principal (porta na parede sul do saguão) ----
  {
    const bi = lobby.x*CT, bj = lobby.z*CT;
    const p = tileCenter(bi+3.5, bj+6);
    const g = new THREE.Group(); g.position.set(p.x-FAC_ORIGIN.x, 0, p.z-FAC_ORIGIN.z+0.74); root.add(g);
    g.add(box(2.4, 3.0, 0.12, new THREE.MeshStandardMaterial({color:0x3a4048, metalness:0.6, roughness:0.4}), 0, 1.5, 0));
    g.add(box(0.5, 0.18, 0.05, MAT.glowG, 0, 3.25, -0.05));
    const sign = makeTextPlane(['SAÍDA'], 1.2, 0.35, {bg:'#062010', color:'#5aff8a', fontSize:60}); sign.position.set(0, 3.6, -0.07); sign.rotation.y = Math.PI; g.add(sign);
    ENTR.main = ENTR.main || {};
    ENTR.main.in = {x:p.x, z:p.z-1.2, dir:{x:0, z:-1}};
    interactables.push({x:p.x, y:1.2, z:p.z+0.4, range:2.8, easy:true, inFacility:true, prompt:()=>'[E] Sair da instalação', action:()=>useEntrance('main', false)});
  }
  // ---- saída de emergência ----
  {
    const c = fireCell, bi = c.x*CT, bj = c.z*CT;
    const free = ['n','s','e','w'].filter(d=>!c.conn[d]);
    const side = free.length ? pick(free) : 'n';
    const P = {n:[3.5,1,0,-0.74, 0], s:[3.5,6,0,0.74, Math.PI], w:[1,3.5,-0.74,0, Math.PI/2], e:[6,3.5,0.74,0, -Math.PI/2]}[side];
    const p = tileCenter(bi+P[0], bj+P[1]);
    const g = new THREE.Group(); g.position.set(p.x-FAC_ORIGIN.x+P[2], 0, p.z-FAC_ORIGIN.z+P[3]); g.rotation.y = P[4]; root.add(g);
    g.add(box(1.6, 2.6, 0.12, new THREE.MeshStandardMaterial({color:0x7a1a14, roughness:0.6, metalness:0.4}), 0, 1.3, 0));
    g.add(box(1.2, 0.08, 0.1, MAT.metal, 0, 1.1, 0.1));
    const sign = makeTextPlane(['SAÍDA DE EMERGÊNCIA'], 1.8, 0.3, {bg:'#3a0a08', color:'#ffd0c0', fontSize:40}); sign.position.set(0, 2.95, 0.08); g.add(sign);
    const lampMesh = box(0.2,0.2,0.1, MAT.glowR.clone(), 0, 2.75, 0.1); g.add(lampMesh);
    lamps.push({x:p.x, y:2.6, z:p.z, color:0xff3020, range:6, base:0.7, on:true, mesh:lampMesh, inFacility:true});
    ENTR.fire = ENTR.fire || {};
    ENTR.fire.in = {x:p.x-P[2]*0.3, z:p.z-P[3]*0.3, dir:{x:-Math.sign(P[2]), z:-Math.sign(P[3])}};
    interactables.push({x:p.x+P[2]*0.5, y:1.2, z:p.z+P[3]*0.5, range:2.6, easy:true, inFacility:true, prompt:()=>'[E] Sair pela saída de emergência', action:()=>useEntrance('fire', false)});
  }
  // ---- Núcleo de energia (a "bateria" da instalação) ----
  {
    const c = appCell, bi=c.x*CT, bj=c.z*CT; const p = tileCenter(bi+3.5, bj+3.5);
    const machine = new THREE.Group(); machine.position.set(p.x-FAC_ORIGIN.x, 0, p.z-FAC_ORIGIN.z); root.add(machine);
    machine.add(box(2.2, 0.5, 2.2, MAT.dark, 0, 0.25, 0));
    for(let k=0;k<4;k++){ const a=k*Math.PI/2; machine.add(cyl(0.12,0.12,FAC.H-0.5, MAT.metal, Math.cos(a)*0.9, (FAC.H-0.5)/2+0.5, Math.sin(a)*0.9)); }
    const glow = new THREE.PointLight(0xffd040, 0.8, 7); glow.position.set(0,1.5,0); machine.add(glow);
    FAC.apparatusGlow = glow;
    const it = makeScrapItem(SCRAP_SPECIAL.aparelho, 1);
    FAC.apparatusItem = it;
    FAC.apparatusPos = {x:p.x, z:p.z};
    FAC.apparatusSpot = {x:p.x, y:0.5, z:p.z};
    FAC.block[tIdx(bi+3,bj+3)] = 0;
  }
  // ---- quadro de energia ----
  {
    const halls = order.filter(c=>c.type==='hall' && !c.lobby);
    const c = halls.length ? pick(halls) : pick(order.filter(c=>!c.lobby));
    const bi=c.x*CT, bj=c.z*CT;
    // encosta numa parede do ladrilho central
    const sides = [['n',bi+3,bj+3,0,-0.74,0],['s',bi+4,bj+4,0,0.74,Math.PI],['w',bi+3,bj+4,-0.74,0,-Math.PI/2],['e',bi+4,bj+3,0.74,0,Math.PI/2]].filter(s=>!c.conn[s[0]]);
    const s = sides.length ? pick(sides) : ['n',bi+3,bj+3,0,-0.74,0];
    const p = tileCenter(s[1], s[2]);
    const g = new THREE.Group(); g.position.set(p.x-FAC_ORIGIN.x+s[3], 0, p.z-FAC_ORIGIN.z+s[4]); g.rotation.y = s[5]+Math.PI; root.add(g);
    g.add(box(0.8, 1.0, 0.25, new THREE.MeshStandardMaterial({color:0x4a5a4a, metalness:0.5, roughness:0.5}), 0, 1.5, 0));
    const ind = box(0.12, 0.12, 0.05, MAT.glowG.clone(), 0.25, 1.85, -0.14); g.add(ind);
    FAC.breaker = {x:p.x+s[3]*0.4, z:p.z+s[4]*0.4, ind};
    interactables.push({x:p.x, y:1.5, z:p.z, range:1.9, inFacility:true,
      prompt:()=> S.apparatusTaken ? 'Quadro de energia (sem energia)' : (S.powerOn ? '[E] Desligar a energia' : '[E] Ligar a energia'),
      action:()=>{ if(netRelay('breaker')) return; if(S.apparatusTaken){ sfx('error'); toast('Não há energia pra religar. Alguém levou o Núcleo de energia.'); return; } setPower(!S.powerOn); sfx('lever', {x:p.x,z:p.z,inFacility:true}); }});
  }
  console.log(`Instalação: ${order.length} células (${theme}), grade ${cw}x${ch}`);
}

function setPower(on){
  S.powerOn = on;
  FAC.cellLamps.forEach(l=>{ l.on = on; if(l.mesh) l.mesh.material.emissiveIntensity = on?1.4:0; });
  if(FAC.breaker) FAC.breaker.ind.material.emissive.set(on?0x2aff5a:0x330000);
  if(!on) sfx('hum', camera.position, 1);
}

function makeDoor(root, tiles, alongX, locked, mat){
  const a = tileCenter(tiles[0][0], tiles[0][1]), b = tileCenter(tiles[1][0], tiles[1][1]);
  const cx = (a.x+b.x)/2, cz = (a.z+b.z)/2;
  const pivot = new THREE.Group();
  // dobradiça numa ponta
  const hx = alongX ? cx : cx - FAC.T, hz = alongX ? cz - FAC.T : cz;
  pivot.position.set(hx-FAC_ORIGIN.x, 0, hz-FAC_ORIGIN.z);
  const panel = box(FAC.T*2-0.1, 3.0, 0.12, mat, FAC.T-0.05, 1.5, 0);
  pivot.add(panel);
  pivot.add(box(0.1, 0.1, 0.25, MAT.metal, FAC.T*1.7, 1.2, 0));
  const baseRot = alongX ? -Math.PI/2 : 0;
  pivot.rotation.y = baseRot;
  root.add(pivot);
  // batente
  root.add(box(alongX?0.3:FAC.T*2+0.3, 0.3, alongX?FAC.T*2+0.3:0.3, MAT.dark, cx-FAC_ORIGIN.x, 3.15, cz-FAC_ORIGIN.z));
  const d = {x:cx, z:cz, tiles, open:false, locked, mimic:false, pivot, panel, baseRot, rot:0, swing: (GR()<0.5?1:-1)*1.45, code:null, alongX};
  tiles.forEach(([i,j])=> FAC.doorAt[tIdx(i,j)] = d);
  FAC.doors.push(d);
  interactables.push({x:cx, y:1.4, z:cz, range:2.3, inFacility:true,
    prompt:()=> d.mimic && !d.open ? '[E] Abrir porta' : (d.locked ? (heldItem()&&heldItem().def.id==='chave' ? '[E] Destrancar com a chave' : (heldItem()&&heldItem().def.id==='gazua' ? '[E] Encaixar a gazua' : 'Porta trancada')) : (d.open ? '[E] Fechar porta' : '[E] Abrir porta')),
    action:()=>interactDoor(d)});
  return d;
}
function interactDoor(d){
  if(isNetClient()){
    const i = FAC.doors.indexOf(d), h = heldItem();
    if(d.locked && !d.mimic && h && h.def.id==='chave'){ consumeHeld(); netRelay('unlock', {i}); return; }
    if(d.locked && !d.mimic && h && h.def.id==='gazua'){ removeFromInventory(h); netRelay('lockpick', {i, item:serItem(h)}); toast('Gazua encaixada... aguarde.'); return; }
    netRelay('door', {i}); return;
  }
  if(d.mimic && !d.open){ mimicDoorBite(d); return; }
  if(d.locked){
    const h = heldItem();
    if(h && h.def.id==='chave'){ d.locked = false; d.panel.material = d.panel.material.clone(); d.panel.material.color.set(0x6e757c); consumeHeld(); openDoor(d); toast('Porta destrancada'); return; }
    if(h && h.def.id==='gazua'){ attachLockpicker(d, h); return; }
    sfx('doorLocked', {x:d.x, z:d.z, inFacility:true}); toast('Trancada. Use uma chave ou uma gazua.'); return;
  }
  d.open ? closeDoor(d) : openDoor(d);
}

// paredes: um único mesh com todas as faces (rápido de desenhar)
function buildWallsMesh(root, tex){
  const pos=[], nor=[], uv=[], idx=[]; const T = FAC.T, H = FAC.H;
  const quad = (x1,z1,x2,z2,nx,nz)=>{
    const b = pos.length/3, len = Math.hypot(x2-x1, z2-z1);
    pos.push(x1,0,z1, x2,0,z2, x2,H,z2, x1,H,z1);
    for(let k=0;k<4;k++) nor.push(nx,0,nz);
    const u0 = (x1+z1)/3; uv.push(u0,0, u0+len/3,0, u0+len/3,H/3*0.75, u0,H/3*0.75);
    if(nx+nz>0 || (nx===0&&nz>0) ) idx.push(b,b+1,b+2, b,b+2,b+3); else idx.push(b,b+2,b+1, b,b+3,b+2);
  };
  const w = (i,j)=> inGrid(i,j) && FAC.walk[tIdx(i,j)];
  // faces horizontais (ao longo de x): corre linha por linha
  for(let j=0;j<=FAC.th;j++){
    for(const facing of [1,-1]){ // 1 = parede ao norte do ladrilho (normal +z)
      let runStart = -1;
      for(let i=0;i<=FAC.tw;i++){
        const need = facing===1 ? (w(i,j) && !w(i,j-1)) : (w(i,j-1) && !w(i,j));
        if(need && runStart<0) runStart = i;
        if(!need && runStart>=0){
          const z = j*T; if(facing===1) quad(i*T, z, runStart*T, z, 0, 1); else quad(runStart*T, z, i*T, z, 0, -1);
          runStart = -1;
        }
      }
    }
  }
  for(let i=0;i<=FAC.tw;i++){
    for(const facing of [1,-1]){
      let runStart = -1;
      for(let j=0;j<=FAC.th;j++){
        const need = facing===1 ? (w(i,j) && !w(i-1,j)) : (w(i-1,j) && !w(i,j));
        if(need && runStart<0) runStart = j;
        if(!need && runStart>=0){
          const x = i*T; if(facing===1) quad(x, runStart*T, x, j*T, 1, 0); else quad(x, j*T, x, runStart*T, -1, 0);
          runStart = -1;
        }
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor,3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv,2));
  geo.setIndex(idx);
  const t = tex.clone(); t.needsUpdate = true; t.repeat.set(1,1);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({map:t, roughness:0.9, metalness:0.1, side:THREE.DoubleSide}));
  root.add(mesh);
  FAC.wallMesh = mesh;
}

// móveis das salas (ficam nos cantos/bordas pra não bloquear o caminho)
function addRoomProps(root, c, theme){
  const CT = FAC.CT, bi = c.x*CT, bj = c.z*CT;
  if(c.lobby){ // saguão: placa e balcão
    const p = tileCenter(bi+1.5, bj+1.5);
    root.add(box(2.6, 1.1, 1.0, MAT.dark, p.x-FAC_ORIGIN.x+0.4, 0.55, p.z-FAC_ORIGIN.z));
    FAC.block[tIdx(bi+1,bj+1)] = 1; FAC.block[tIdx(bi+2,bj+1)] = 1;
    return;
  }
  const ring = [];
  for(let j=1;j<=6;j++) for(let i=1;i<=6;i++){
    const edge = i===1||i===6||j===1||j===6; if(!edge) continue;
    if((i===3||i===4) || (j===3||j===4)) continue; // não bloqueia as passagens do meio
    ring.push([i,j]);
  }
  const count = randInt(2, 5);
  const fabricaProps = ['caixas','estante','barris','maquina','canos'];
  const mansaoProps = ['mesa','estante_m','sofa','relogio','cama'];
  for(let k=0;k<count && ring.length;k++){
    const [i,j] = ring.splice(randInt(0,ring.length-1),1)[0];
    const ti = bi+i, tj = bj+j; const p = tileCenter(ti,tj);
    const lx = p.x-FAC_ORIGIN.x, lz = p.z-FAC_ORIGIN.z;
    const kind = pick(theme==='mansao' ? mansaoProps : fabricaProps);
    let tall = false;
    const g = new THREE.Group(); g.position.set(lx, 0, lz); root.add(g);
    switch(kind){
      case 'caixas': g.add(box(1.2,1.2,1.2,MAT.crate,0,0.6,0)); if(GR()<0.5) g.add(box(0.8,0.8,0.8,MAT.crate,0.1,1.6,0.05)); tall=true; break;
      case 'estante': g.add(box(1.3,2.6,0.6,MAT.rust,0,1.3,0)); for(let y=0.5;y<2.6;y+=0.65) g.add(box(1.25,0.05,0.55,MAT.metal,0,y,0)); tall=true; break;
      case 'barris': g.add(cyl(0.4,0.4,1.1,MAT.rust,-0.2,0.55,0)); g.add(cyl(0.4,0.4,1.1,MAT.orange,0.35,0.55,0.25)); break;
      case 'maquina': g.add(box(1.3,1.8,1.1,MAT.dark,0,0.9,0)); g.add(box(0.3,0.15,0.05,MAT.glowR,0.3,1.5,0.56)); tall=true; break;
      case 'canos': g.add(cyl(0.18,0.18,FAC.H,MAT.metal,0,FAC.H/2,0)); g.add(cyl(0.12,0.12,FAC.H,MAT.rust,0.35,FAC.H/2,0.2)); break;
      case 'mesa': g.add(box(1.3,0.08,0.9,MAT.wood,0,0.8,0)); [[-0.55,-0.35],[0.55,-0.35],[-0.55,0.35],[0.55,0.35]].forEach(([a,b])=>g.add(box(0.08,0.8,0.08,MAT.wood,a,0.4,b))); break;
      case 'estante_m': g.add(box(1.3,2.4,0.5,MAT.wood,0,1.2,0)); for(let y=0.45;y<2.4;y+=0.5) g.add(box(1.1,0.25,0.35,new THREE.MeshStandardMaterial({color:new THREE.Color().setHSL(GR(),0.4,0.3)}),0,y+0.14,0.02)); tall=true; break;
      case 'sofa': g.add(box(1.4,0.5,0.8,new THREE.MeshStandardMaterial({color:0x5a2a2a,roughness:1}),0,0.25,0)); g.add(box(1.4,0.6,0.2,new THREE.MeshStandardMaterial({color:0x5a2a2a,roughness:1}),0,0.7,-0.3)); break;
      case 'relogio': g.add(box(0.6,2.2,0.4,MAT.wood,0,1.1,0)); g.add(cyl(0.2,0.2,0.05,MAT.glowY,0,1.8,0.21).rotateX(Math.PI/2)); tall=true; break;
      case 'cama': g.add(box(1.3,0.5,1.3,new THREE.MeshStandardMaterial({color:0x6a6050,roughness:1}),0,0.25,0)); break;
    }
    g.rotation.y = pick([0, Math.PI/2, Math.PI, -Math.PI/2]);
    FAC.block[tIdx(ti,tj)] = tall ? 2 : 1;
  }
}

// mapa de depuração (F11 com CONFIG.DEBUG_KEYS)
function drawFacilityDebugMap(ctx, w, h){
  if(!FAC.walk) return;
  const s = Math.min(w/FAC.tw, h/FAC.th)*0.9, ox = 10, oy = 10;
  ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(ox-4, oy-4, FAC.tw*s+8, FAC.th*s+8);
  for(let j=0;j<FAC.th;j++) for(let i=0;i<FAC.tw;i++){
    const k = tIdx(i,j);
    if(!FAC.walk[k]) continue;
    ctx.fillStyle = FAC.doorAt[k] ? (FAC.doorAt[k].locked?'#a33':'#aa6') : (FAC.block[k]?'#555':'#2a6');
    ctx.fillRect(ox+i*s, oy+j*s, s, s);
  }
  const [pi,pj] = tileOf(player.pos.x, player.pos.z);
  ctx.fillStyle = '#fff'; ctx.fillRect(ox+pi*s-1, oy+pj*s-1, s+2, s+2);
  creatures.filter(c=>c.inFacility).forEach(c=>{ const [ci,cj] = tileOf(c.pos.x,c.pos.z); ctx.fillStyle='#f22'; ctx.fillRect(ox+ci*s, oy+cj*s, s, s); });
}
