/*
 * ============================================================================
 *  02-engine.js — MOTOR: renderização, câmera, luzes, colisão, chão e visão
 *  (raramente precisa mexer aqui)
 * ============================================================================
 *  - Renderiza numa resolução baixa e aplica o filtro "posterizado" (CONFIG.POSTERIZE)
 *  - Luzes fixas (sol, céu, lanterna, e um "pool" de 8 luzes de lâmpada que são
 *    remanejadas pras lâmpadas mais próximas do jogador — assim dá pra ter
 *    centenas de lâmpadas sem pesar)
 *  - Colisão: caixas/círculos (nave, pedras, árvores) + grade da instalação
 *  - Chão: função de altura (terreno procedural, heightmap "assado" do modelo, nave)
 *  - Linha de visão: grade (dentro) ou heightmap (fora)
 * ============================================================================
 */

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({canvas, antialias:false, powerPreference:'high-performance'});
renderer.setPixelRatio(1);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(CONFIG.FOV, innerWidth/innerHeight, 0.05, 600);
camera.rotation.order = 'YXZ';
scene.add(camera);

// ---- render em baixa resolução + pós-processamento ----
let rtW = 0, rtH = 0;
const renderTarget = new THREE.WebGLRenderTarget(16, 16, {minFilter:THREE.NearestFilter, magFilter:THREE.NearestFilter});
const postScene = new THREE.Scene();
const postCam = new THREE.OrthographicCamera(-1,1,1,-1,0,1);
const postMat = new THREE.ShaderMaterial({
  uniforms:{ tDiffuse:{value:renderTarget.texture}, levels:{value:CONFIG.POSTERIZE_LEVELS}, poster:{value:CONFIG.POSTERIZE?1:0},
    time:{value:0}, grain:{value:CONFIG.FILM_GRAIN}, res:{value:new THREE.Vector2(1,1)}, hurt:{value:0}, blind:{value:0}, bright:{value:1.0}, tint:{value:new THREE.Vector3(1,1,1)} },
  vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader:`
    uniform sampler2D tDiffuse; uniform float levels; uniform float poster; uniform float time; uniform float grain;
    uniform vec2 res; uniform float bright; uniform float hurt; uniform float blind; uniform vec3 tint; varying vec2 vUv;
    float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))+time*7.13)*43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = pow(c.rgb * tint * bright, vec3(1.0/bright));
      if(poster>0.5){
        float d = (rnd(floor(vUv*res))-0.5)/levels;           // pontilhado leve
        col = floor((col+d)*levels+0.5)/levels;
      }
      col += (rnd(vUv*res)-0.5)*grain;
      float v = smoothstep(0.95, 0.35, length(vUv-0.5));      // vinheta
      col *= mix(0.55, 1.0, v);
      col = mix(col, vec3(0.45,0.0,0.0), hurt*0.45*(1.0-v*0.6));
      col = mix(col, vec3(0.06,0.02,0.02), blind);
      gl_FragColor = vec4(col, 1.0);
    }`,
  depthTest:false, depthWrite:false,
});
postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2), postMat));

function resize(){
  renderer.setSize(innerWidth, innerHeight, false);
  canvas.style.width = innerWidth+'px'; canvas.style.height = innerHeight+'px';
  rtH = Math.min(CONFIG.RENDER_HEIGHT, innerHeight);
  rtW = Math.round(rtH * innerWidth / innerHeight);
  renderTarget.setSize(rtW, rtH);
  postMat.uniforms.res.value.set(rtW, rtH);
  camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

function renderFrame(t){
  postMat.uniforms.time.value = t*0.001;
  renderer.setRenderTarget(renderTarget);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  renderer.render(postScene, postCam);
}

// ---- luzes persistentes (mesma quantidade sempre = sem travadas de shader) ----
const sun = new THREE.DirectionalLight(0xfff0d8, 0.0); sun.position.set(40,80,20);
const hemi = new THREE.HemisphereLight(0x8899aa, 0x221a14, 0.0);
const ambient = new THREE.AmbientLight(0x404050, 0.0);
const flashlight = new THREE.SpotLight(0xfff0d0, 0, 26, 0.5, 0.45, 1.8);
const flashAim = new THREE.Vector3();
const LIGHT_POOL_SIZE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? 5 : 8; // celular aguenta menos luzes
const lightPool = [];
for(let i=0;i<LIGHT_POOL_SIZE;i++){ const l = new THREE.PointLight(0xffe6c0, 0, 12, 1.2); lightPool.push(l); }
const persistent = [camera, sun, sun.target, hemi, ambient, flashlight, flashlight.target, ...lightPool];
persistent.forEach(o=>{ if(!o.parent) scene.add(o); });

// lâmpadas registradas no nível: {x,y,z, color, range, base, on, flicker, mesh, inFacility}
let lamps = [];
let _lampTimer = 0;
function updateLightPool(dt, now){
  _lampTimer -= dt;
  if(_lampTimer <= 0){
    _lampTimer = 0.2;
    const p = camera.position;
    const cand = lamps.filter(l=>l.on && l.inFacility===player.inFacility);
    cand.forEach(l=> l._d = (l.x-p.x)*(l.x-p.x)+(l.z-p.z)*(l.z-p.z));
    cand.sort((a,b)=>a._d-b._d);
    for(let i=0;i<LIGHT_POOL_SIZE;i++){
      const l = lightPool[i], lamp = cand[i];
      l.userData.lamp = lamp || null;
      if(lamp){ l.position.set(lamp.x, lamp.y, lamp.z); l.color.set(lamp.color||0xffe6c0); l.distance = lamp.range||12; }
    }
  }
  lightPool.forEach(l=>{
    const lamp = l.userData.lamp;
    if(!lamp || !lamp.on){ l.intensity = 0; return; }
    let k = lamp.base || 1;
    if(lamp.flicker){
      lamp._ft = (lamp._ft||0) - dt;
      if(lamp._ft <= 0){ lamp._ft = 0.05 + GR()*(GR()<0.15?0.6:0.15); lamp._fv = GR()<0.3 ? 0.1 : 1; }
      k *= lamp._fv;
    }
    l.intensity = k;
    if(lamp.mesh && lamp.mesh.material && lamp.mesh.material.emissiveIntensity!==undefined) lamp.mesh.material.emissiveIntensity = k*1.4;
  });
}

// ---- estado de mundo ----
const FAC_ORIGIN = {x:4000, z:4000};  // a instalação fica "longe", no mesmo cenário
let obstacles = [];          // {x,z,hw,hd} caixas | {x,z,r} círculos (fora da instalação)
let interactables = [];      // {x,y,z,range,prompt(),action(),inFacility,enabled()}
let worldBounds = {minX:-200,maxX:200,minZ:-200,maxZ:200};
let heightFn = (x,z)=>0;     // altura do terreno lá fora
let heightSolidFn = null;    // opcional: se devolver true, o ponto é parede (fora do mapa)
let shipFloor = null;        // {minX,maxX,minZ,maxZ,y}
let extraFloors = [];        // pisos elevados retangulares {minX,maxX,minZ,maxZ,y}
let levelRoot = null;        // grupo com tudo do nível atual

function clearLevel(){
  if(levelRoot){ scene.remove(levelRoot); disposeTree(levelRoot); }
  levelRoot = new THREE.Group(); scene.add(levelRoot);
  obstacles = []; interactables = []; lamps = []; extraFloors = []; shipFloor = null;
  heightFn = ()=>0; heightSolidFn = null;
  lightPool.forEach(l=>{ l.userData.lamp=null; l.intensity=0; });
}
function disposeTree(o){
  o.traverse(c=>{
    if(c.geometry && !c.geometry.userData.shared) c.geometry.dispose();
  });
}
function addToLevel(o){ levelRoot.add(o); return o; }

// altura do chão onde o jogador/criatura pisa
function groundAt(x, z, inFacility){
  if(inFacility) return 0;
  if(shipFloor && x>shipFloor.minX && x<shipFloor.maxX && z>shipFloor.minZ && z<shipFloor.maxZ) return shipFloor.y;
  for(const f of extraFloors){ if(x>f.minX && x<f.maxX && z>f.minZ && z<f.maxZ) return (typeof f.y==='function') ? f.y(x,z) : f.y; }
  return heightFn(x,z);
}
function isSolidOutside(x,z){
  if(x<worldBounds.minX || x>worldBounds.maxX || z<worldBounds.minZ || z>worldBounds.maxZ) return true;
  return heightSolidFn ? heightSolidFn(x,z) : false;
}

// colisão contra caixas e círculos (fora da instalação)
function resolveObstacles(pos, radius){
  for(const o of obstacles){
    if(o.r !== undefined){
      const dx = pos.x-o.x, dz = pos.z-o.z, d = Math.hypot(dx,dz), min = o.r+radius;
      if(d < min && d > 1e-4){ pos.x = o.x + dx/d*min; pos.z = o.z + dz/d*min; }
    } else {
      if(o.enabled && !o.enabled()) continue;
      if(o.rot){ // caixa girada (prédios virados pra nave): resolve no espaço da caixa
        const c = Math.cos(o.rot), s = Math.sin(o.rot);
        const wx = pos.x-o.x, wz = pos.z-o.z;
        let lx = wx*c - wz*s, lz = wx*s + wz*c;
        const ox = o.hw+radius, oz = o.hd+radius;
        if(Math.abs(lx)<ox && Math.abs(lz)<oz){
          const px = ox-Math.abs(lx), pz = oz-Math.abs(lz);
          if(px<pz) lx += Math.sign(lx||1)*px; else lz += Math.sign(lz||1)*pz;
          pos.x = o.x + lx*c + lz*s; pos.z = o.z - lx*s + lz*c;
        }
        continue;
      }
      const dx = pos.x-o.x, dz = pos.z-o.z, ox = o.hw+radius, oz = o.hd+radius;
      if(Math.abs(dx)<ox && Math.abs(dz)<oz){
        const px = ox-Math.abs(dx), pz = oz-Math.abs(dz);
        if(px<pz) pos.x += Math.sign(dx||1)*px; else pos.z += Math.sign(dz||1)*pz;
      }
    }
  }
}
function addBoxObstacle(x,z,w,d,enabled,rot){ const o={x,z,hw:w/2,hd:d/2,enabled,rot:rot||0}; obstacles.push(o); return o; }
function addCircleObstacle(x,z,r){ const o={x,z,r}; obstacles.push(o); return o; }

// Move uma entidade de 'from' na direção (dx,dz) respeitando paredes/degraus.
// Devolve true se conseguiu andar quase tudo.
function moveEntity(pos, dx, dz, radius, inFacility, maxStep=CONFIG.PLAYER.maxStep, ignoreDoors=false){
  const sx = pos.x, sz = pos.z;
  if(inFacility){
    facilityMove(pos, dx, dz, radius, ignoreDoors);
  } else {
    const h0 = groundAt(pos.x, pos.z, false);
    const tryAxis = (ax, az)=>{
      const nx = pos.x+ax, nz = pos.z+az;
      if(isSolidOutside(nx,nz)) return false;
      const h1 = groundAt(nx, nz, false);
      const dist = Math.hypot(ax,az);
      if(h1 - h0 > Math.max(maxStep*0.35, dist*1.6) && h1-h0 > 0.08) return false;
      pos.x = nx; pos.z = nz; return true;
    };
    if(!tryAxis(dx,dz)){ tryAxis(dx,0); tryAxis(0,dz); }
    resolveObstacles(pos, radius);
    if(isSolidOutside(pos.x,pos.z)){ pos.x = sx; pos.z = sz; }
  }
  const moved = Math.hypot(pos.x-sx, pos.z-sz), want = Math.hypot(dx,dz);
  return want < 1e-5 || moved > want*0.5;
}

// linha de visão entre dois pontos 3D
function lineOfSight(a, b, inFacility){
  if(inFacility) return facilityLOS(a.x, a.z, b.x, b.z);
  const d = Math.hypot(b.x-a.x, b.z-a.z);
  const steps = Math.max(2, Math.ceil(d/1.5));
  for(let i=1;i<steps;i++){
    const t = i/steps, x = a.x+(b.x-a.x)*t, z = a.z+(b.z-a.z)*t, y = a.y+(b.y-a.y)*t;
    if(heightFn(x,z) > y+0.1) return false;
    if(heightSolidFn && heightSolidFn(x,z)) return false;
  }
  return true;
}

// "assa" um heightmap a partir de meshes (renderiza de cima pra baixo e lê a altura de cada pixel)
function bakeHeightmap(meshes, minX, maxX, minZ, maxZ, res=512){
  const minY = -60, maxY = 260;
  const rt = new THREE.WebGLRenderTarget(res, res, {minFilter:THREE.NearestFilter, magFilter:THREE.NearestFilter});
  const cam = new THREE.OrthographicCamera(-(maxX-minX)/2, (maxX-minX)/2, (maxZ-minZ)/2, -(maxZ-minZ)/2, 1, 1000);
  cam.position.set((minX+maxX)/2, 500, (minZ+maxZ)/2); cam.up.set(0,0,-1); cam.lookAt((minX+maxX)/2, 0, (minZ+maxZ)/2);
  cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const mat = new THREE.ShaderMaterial({
    side:THREE.DoubleSide,
    uniforms:{minY:{value:minY}, maxY:{value:maxY}},
    vertexShader:`varying float vY; void main(){ vec4 w = modelMatrix*vec4(position,1.); vY=w.y; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader:`uniform float minY; uniform float maxY; varying float vY;
      void main(){ float v = clamp((vY-minY)/(maxY-minY),0.,1.); float hi = floor(v*255.); float lo = floor(fract(v*255.)*255.);
        gl_FragColor = vec4(hi/255., lo/255., 0., 1.); }`
  });
  const tmp = new THREE.Scene();
  const clones = meshes.map(m=>{ const c = new THREE.Mesh(m.geometry, mat); m.updateMatrixWorld(true); c.matrixAutoUpdate=false; c.matrix.copy(m.matrixWorld); c.matrixWorld.copy(m.matrixWorld); tmp.add(c); return c; });
  renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear();
  renderer.render(tmp, cam);
  const px = new Uint8Array(res*res*4);
  renderer.readRenderTargetPixels(rt, 0, 0, res, res, px);
  renderer.setRenderTarget(null); renderer.setClearColor(0x000000, 1);
  rt.dispose(); mat.dispose();
  const H = new Float32Array(res*res);
  for(let i=0;i<res*res;i++){
    if(px[i*4+3] < 128){ H[i] = NaN; continue; }
    const v = (px[i*4]*255 + px[i*4+1]) / (255*255);
    H[i] = minY + v*(maxY-minY);
  }
  // pixel (0,0) da leitura = canto de baixo da imagem = z máximo
  const sample = (x,z)=>{
    const u = (x-minX)/(maxX-minX)*res, v = (maxZ-z)/(maxZ-minZ)*res;
    const ix = Math.floor(u), iz = Math.floor(v);
    if(ix<0||iz<0||ix>=res||iz>=res) return NaN;
    return H[iz*res+ix];
  };
  return sample;
}

// pequenas utilidades
const rand = (a,b)=>a+GR()*(b-a);
const randInt = (a,b)=>Math.floor(a+GR()*(b-a+1));
const pick = arr=>arr[Math.floor(GR()*arr.length)];
function weightedPick(weights){ // {id:peso}
  const entries = Object.entries(weights); let total = entries.reduce((s,e)=>s+e[1],0), r = GR()*total;
  for(const [k,w] of entries){ r -= w; if(r<=0) return k; }
  return entries[0][0];
}
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
function dist2D(a,b){ return Math.hypot(a.x-b.x, a.z-b.z); }
function angleDiff(a,b){ let d = a-b; while(d>Math.PI) d-=Math.PI*2; while(d<-Math.PI) d+=Math.PI*2; return d; }
// valor de ruído suave (pra terreno)
function hash2(x,z){ const s = Math.sin(x*127.1+z*311.7)*43758.5453; return s-Math.floor(s); }
function vnoise(x,z){
  const ix=Math.floor(x), iz=Math.floor(z), fx=x-ix, fz=z-iz;
  const a=hash2(ix,iz), b=hash2(ix+1,iz), c=hash2(ix,iz+1), d=hash2(ix+1,iz+1);
  const ux=fx*fx*(3-2*fx), uz=fz*fz*(3-2*fz);
  return a+(b-a)*ux+(c-a)*uz+(a-b-c+d)*ux*uz;
}
function fbm(x,z,oct=4){ let v=0, a=0.5, f=1; for(let i=0;i<oct;i++){ v+=a*vnoise(x*f,z*f); f*=2.03; a*=0.5; } return v; }

// ---- se algo der errado, mostra o erro na tela (tire um print e mande!) ----
function showError(err){
  console.error(err);
  let el = document.getElementById('errBox');
  if(!el){ el = document.createElement('div'); el.id = 'errBox'; el.onclick = ()=>el.remove(); document.body.appendChild(el); }
  const msg = (err && (err.stack || err.message)) || String(err);
  el.textContent = '⚠ ERRO (toque pra fechar):\n' + String(msg).split('\n').slice(0,4).join('\n');
}
addEventListener('error', e=>{ if(e.target && e.target!==window) return; const m = String(e.message||''); if(/Pointer Lock|user gesture|ResizeObserver/i.test(m)) return; showError(e.error || e.message); });
addEventListener('unhandledrejection', e=>{ const r = e.reason; if(r && (r.name==='NotAllowedError' || /Pointer Lock|pointer lock|play\(\)|user gesture/i.test(String(r.message||r)))) return; showError(r); });
canvas.addEventListener('webglcontextlost', e=>{ e.preventDefault(); showError('A placa de vídeo do aparelho reiniciou (WebGL perdido). Diminua a qualidade em Configurações → Geral e recarregue a página.'); });
