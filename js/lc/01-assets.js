/*
 * ============================================================================
 *  01-assets.js — ONDE VOCÊ TROCA A ARTE DO JOGO
 * ============================================================================
 *  Pra cada criatura, sucata, ferramenta ou cenário você pode colocar:
 *    model:  'assets/criaturas/manequim.glb'   → modelo 3D (.gltf ou .glb)
 *    sprite: 'assets/criaturas/manequim.png'   → desenho 2D (fica sempre virado pra câmera)
 *  Deixe os dois como null pra usar o placeholder feito de formas geométricas.
 *
 *    scale   → tamanho (1 = tamanho original do modelo; pra sprite = altura em metros)
 *    yOffset → sobe/desce o modelo
 *    rotY    → gira o modelo (em radianos; Math.PI = meia volta)
 *
 *  IMPORTANTE: modelos 3D e imagens só carregam se o jogo for aberto por um
 *  servidor local (ex: extensão "Live Server" do VS Code). Abrindo o .html
 *  com duplo clique o navegador bloqueia, e o jogo usa os placeholders.
 * ============================================================================
 */

const ASSETS = {
  creatures: {
    juntador:      {model:null, sprite:null, scale:1, yOffset:0, rotY:0},
    lacrador:      {model:null, sprite:null, scale:1, yOffset:0, rotY:0},
    tecela:        {model:null, sprite:null, scale:1, yOffset:0, rotY:0},
    espreitador:   {model:null, sprite:null, scale:1, yOffset:0, rotY:0},
    manequim:          {model:null, sprite:null, scale:1, yOffset:0, rotY:0},
    rasteiro:      {model:null, sprite:null, scale:1, yOffset:0, rotY:0},
    gosma:         {model:null, sprite:null, scale:1, yOffset:0, rotY:0},
    caixa_musica:      {model:null, sprite:null, scale:1, yOffset:0, rotY:0},
    sentinela:   {model:null, sprite:null, scale:1, yOffset:0, rotY:0},
    sosia:     {model:null, sprite:null, scale:1, yOffset:0, rotY:0},
    mimico_sucata: {model:null, sprite:null, scale:1, yOffset:0, rotY:0},
    farejador:           {model:null, sprite:null, scale:1, yOffset:0, rotY:0},
    colosso:       {model:null, sprite:null, scale:1, yOffset:0, rotY:0},
    verme:         {model:null, sprite:null, scale:1, yOffset:0, rotY:0},
  },
  // sucata: use o mesmo id da lista SCRAP em 00-config.js. Ex: barra_ouro:{model:'assets/sucata/ouro.glb', scale:1}
  scrap: {
    // barra_ouro: {model:null, sprite:null, scale:1, yOffset:0, rotY:0},
  },
  tools: {
    // pa: {model:null, sprite:null, scale:1, yOffset:0, rotY:0},
  },
  props: {
    nave:          {model:null, scale:1, yOffset:0, rotY:0, hidePlaceholder:false}, // casco externo da nave
    torreta:       {model:null, sprite:null, scale:1, yOffset:0, rotY:0},
    mina:          {model:null, sprite:null, scale:1, yOffset:0, rotY:0},
    entrada:       {model:null, scale:1, yOffset:0, rotY:0}, // prédio da entrada principal (luas procedurais)
  },
  // exteriores feitos com modelo 3D. points = posições NO MODELO (antes da escala) de cada coisa.
  exteriors: {
    fornalha: {
      model: 'scene.gltf', scale: 2.6,
      origin: [88, 35, -93],              // ponto do modelo que vira o (0,0,0) do jogo
      points: {
        ship: [80, -95],                  // onde a nave pousa
        // pode ser [x, z] no modelo OU o nome de uma parte do modelo (a porta é achada sozinha)
        main: 'BuildingDoor',             // porta da fábrica = entrada principal
        fire: 'Door_Baked',               // porta pequena perto dos tanques = saída de emergência
      },
      // nomes de partes do modelo que contam como chão/parede (o resto é só visual)
      solidNames: ['hill','ground','floor','platform','base_baked','rock','factory','wall_baked','tank','metalcolums','background'],
    },
  },
  // texturas de parede/chão das instalações (imagens .png/.jpg). null = textura gerada por código
  textures: {
    fabrica_parede: null, fabrica_chao: null, fabrica_teto: null,
    mansao_parede: null,  mansao_chao: null,  mansao_teto: null,
  },
  // sons opcionais (.mp3/.ogg). Se ficar null, o som é sintetizado pelo próprio jogo.
  sounds: {
    // passo: 'audio/passo.mp3',
  },
};

// ============================================================================
//  Carregadores (não precisa mexer daqui pra baixo)
// ============================================================================
const _gltfLoader = (typeof THREE.GLTFLoader === 'function') ? new THREE.GLTFLoader() : null;
const _texLoader = new THREE.TextureLoader();
const _modelCache = {};   // url -> {scene, waiting:[], failed}
const _texCache = {};

function loadModelCached(url, onReady, onFail){
  if(!_gltfLoader){ if(onFail) onFail('sem GLTFLoader'); return; }
  let c = _modelCache[url];
  if(c && c.scene){ onReady(c.scene.clone(true)); return; }
  if(c && c.failed){ if(onFail) onFail(c.failed); return; }
  if(!c){
    c = _modelCache[url] = {scene:null, waiting:[], failed:null};
    _gltfLoader.load(url, g=>{
      c.scene = g.scene;
      g.scene.traverse(o=>{ if(o.isMesh){ o.castShadow=false; o.receiveShadow=false; } });
      c.waiting.splice(0).forEach(w=>w.ok(c.scene.clone(true)));
    }, undefined, err=>{
      console.warn('Não carregou o modelo', url, err);
      c.failed = err || 'erro';
      c.waiting.splice(0).forEach(w=>w.fail && w.fail(c.failed));
    });
  }
  c.waiting.push({ok:onReady, fail:onFail});
}
function loadTextureCached(url){
  if(_texCache[url]) return _texCache[url];
  const t = _texLoader.load(url, undefined, undefined, ()=>console.warn('Não carregou a textura', url));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  _texCache[url] = t;
  return t;
}

// Cria o visual de algo. Devolve um Group na hora (com o placeholder);
// se houver modelo/sprite configurado, troca quando terminar de carregar.
function makeVisual(category, id, buildPlaceholder){
  const root = new THREE.Group();
  const cfg = (ASSETS[category] && ASSETS[category][id]) || null;
  const placeholder = buildPlaceholder();
  root.add(placeholder);
  root.userData.placeholder = placeholder;
  if(!cfg) return root;
  if(cfg.sprite){
    const tex = loadTextureCached(cfg.sprite);
    const mat = new THREE.SpriteMaterial({map:tex, transparent:true, alphaTest:0.3});
    const spr = new THREE.Sprite(mat);
    const h = cfg.scale || 1.8;
    spr.scale.set(h, h, 1);
    spr.position.y = h/2 + (cfg.yOffset||0);
    // ajusta proporção quando a imagem carregar
    const fix = ()=>{ if(tex.image && tex.image.width){ spr.scale.set(h*tex.image.width/tex.image.height, h, 1); } else setTimeout(fix, 200); };
    fix();
    root.remove(placeholder); root.add(spr);
    root.userData.visualMeshes = [spr];
  } else if(cfg.model){
    loadModelCached(cfg.model, model=>{
      model.scale.setScalar(cfg.scale||1);
      model.position.y = cfg.yOffset||0;
      model.rotation.y = cfg.rotY||0;
      if(!cfg.keepPlaceholder) placeholder.visible = false;
      root.add(model);
      const meshes = [];
      model.traverse(o=>{ if(o.isMesh) meshes.push(o); });
      root.userData.visualMeshes = meshes;
      if(root.userData.onModelReady) root.userData.onModelReady(meshes);
    });
  }
  return root;
}

// ============================================================================
//  Texturas procedurais (placeholder até você trocar em ASSETS.textures)
// ============================================================================
// texturas geradas usam o aleatório "de verdade" (não a semente da lua)
function canvasTex(size, draw, repeatX=1, repeatY=1){
  const cvs = document.createElement('canvas'); cvs.width = cvs.height = size;
  const g = cvs.getContext('2d');
  const saved = _grFn; _grFn = rawRandom; try{ draw(g, size); } finally { _grFn = saved; }
  const t = new THREE.CanvasTexture(cvs);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeatX, repeatY);
  t.magFilter = THREE.NearestFilter;
  return t;
}
function noiseFill(g, size, base, amount, n=1600){
  g.fillStyle = base; g.fillRect(0,0,size,size);
  for(let i=0;i<n;i++){
    const v = GR();
    g.fillStyle = v<0.5 ? `rgba(0,0,0,${GR()*amount})` : `rgba(255,255,255,${GR()*amount*0.5})`;
    const s = 1+GR()*3;
    g.fillRect(GR()*size, GR()*size, s, s);
  }
}
const PROC_TEX = {
  fabrica_parede: ()=>canvasTex(256,(g,s)=>{
    noiseFill(g,s,'#4c4f52',0.12);
    g.fillStyle='rgba(0,0,0,0.25)'; g.fillRect(0,s*0.62,s,4);
    g.fillStyle='#6a5a2a'; g.fillRect(0,s*0.86,s,s*0.14);                     // faixa amarela suja embaixo
    g.fillStyle='rgba(20,20,20,0.6)';
    for(let x=-s;x<s*2;x+=28){ g.beginPath(); g.moveTo(x,s); g.lineTo(x+14,s); g.lineTo(x+28,s*0.86); g.lineTo(x+14,s*0.86); g.fill(); }
    g.strokeStyle='rgba(0,0,0,0.35)'; g.lineWidth=2;
    for(let x=0;x<s;x+=64){ g.beginPath(); g.moveTo(x,0); g.lineTo(x,s*0.86); g.stroke(); }
    for(let i=0;i<8;i++){ g.fillStyle='rgba(60,40,20,0.15)'; g.fillRect(GR()*s, GR()*s*0.5, 6+GR()*10, 30+GR()*80); }
  }),
  fabrica_chao: ()=>canvasTex(256,(g,s)=>{
    noiseFill(g,s,'#2e3033',0.16,2600);
    g.strokeStyle='rgba(0,0,0,0.5)'; g.lineWidth=2;
    for(let i=0;i<=s;i+=64){ g.beginPath(); g.moveTo(i,0); g.lineTo(i,s); g.stroke(); g.beginPath(); g.moveTo(0,i); g.lineTo(s,i); g.stroke(); }
    for(let i=0;i<5;i++){ const x=GR()*s,y=GR()*s,r=10+GR()*30; const gr=g.createRadialGradient(x,y,1,x,y,r); gr.addColorStop(0,'rgba(10,8,5,0.4)'); gr.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=gr; g.fillRect(x-r,y-r,r*2,r*2); }
  }),
  fabrica_teto: ()=>canvasTex(128,(g,s)=>{ noiseFill(g,s,'#1a1b1d',0.12); g.strokeStyle='rgba(0,0,0,0.6)'; for(let i=0;i<s;i+=32){g.beginPath();g.moveTo(i,0);g.lineTo(i,s);g.stroke();} }),
  mansao_parede: ()=>canvasTex(256,(g,s)=>{
    noiseFill(g,s,'#5a4232',0.1);
    for(let x=0;x<s;x+=32){ g.fillStyle = (x/32)%2 ? 'rgba(90,40,30,0.25)' : 'rgba(40,20,10,0.2)'; g.fillRect(x,0,16,s*0.7); }
    g.fillStyle='#3a2416'; g.fillRect(0,s*0.7,s,s*0.3);                        // lambri de madeira
    g.strokeStyle='rgba(0,0,0,0.4)'; for(let x=0;x<s;x+=48){ g.strokeRect(x+4,s*0.74,40,s*0.22); }
    g.fillStyle='#2a180c'; g.fillRect(0,s*0.68,s,6);
  }),
  mansao_chao: ()=>canvasTex(256,(g,s)=>{
    noiseFill(g,s,'#4a2c18',0.12,1200);
    g.strokeStyle='rgba(0,0,0,0.45)'; g.lineWidth=2;
    for(let y=0;y<s;y+=24){ g.beginPath(); g.moveTo(0,y); g.lineTo(s,y); g.stroke(); const off=(y/24%2)*60; for(let x=off;x<s;x+=120){ g.beginPath(); g.moveTo(x,y); g.lineTo(x,y+24); g.stroke(); } }
  }),
  mansao_teto: ()=>canvasTex(128,(g,s)=>{ noiseFill(g,s,'#2a1e16',0.1); }),
};
const _themeTex = {};
function themeTexture(key){
  if(_themeTex[key]) return _themeTex[key];
  const url = ASSETS.textures[key];
  _themeTex[key] = url ? loadTextureCached(url) : PROC_TEX[key]();
  return _themeTex[key];
}

// ============================================================================
//  Placeholders geométricos (o "boneco de teste" de cada coisa)
// ============================================================================
function shapeMesh(shape, matOpts={}){
  const c = new THREE.Color(shape.c||'#888');
  const mat = new THREE.MeshStandardMaterial(Object.assign({color:c, roughness:0.6, metalness:0.3}, matOpts));
  const s = shape.s;
  let geo;
  switch(shape.t){
    case 'cyl':    geo = new THREE.CylinderGeometry(s[0], s[0], s[1], 10); break;
    case 'sphere': geo = new THREE.SphereGeometry(s[0], 10, 8); break;
    case 'cone':   geo = new THREE.ConeGeometry(s[0], s[1], 10); break;
    case 'torus':  geo = new THREE.TorusGeometry(s[0], s[1], 6, 14); break;
    case 'flat':   geo = new THREE.BoxGeometry(s[0], s[1], 0.04); break;
    default:       geo = new THREE.BoxGeometry(s[0], s[1], s[2]);
  }
  const m = new THREE.Mesh(geo, mat);
  // apoia no chão
  geo.computeBoundingBox();
  m.position.y = -geo.boundingBox.min.y;
  if(shape.t==='torus'){ m.rotation.x = Math.PI/2; m.position.y = s[1]; }
  if(shape.t==='flat'){ m.rotation.x = -Math.PI/2.3; m.position.y = 0.05; }
  return m;
}

// materiais compartilhados
const MAT = {
  black:  new THREE.MeshStandardMaterial({color:0x0a0a0a, roughness:1}),
  dark:   new THREE.MeshStandardMaterial({color:0x222428, roughness:0.9}),
  metal:  new THREE.MeshStandardMaterial({color:0x6a7078, roughness:0.45, metalness:0.7}),
  rust:   new THREE.MeshStandardMaterial({color:0x6a3c22, roughness:0.9, metalness:0.3}),
  orange: new THREE.MeshStandardMaterial({color:0xd0631c, roughness:0.7, metalness:0.2}),
  suit:   new THREE.MeshStandardMaterial({color:0xc8611e, roughness:0.85}),
  wood:   new THREE.MeshStandardMaterial({color:0x5a3a22, roughness:0.85}),
  crate:  new THREE.MeshStandardMaterial({color:0x6b5434, roughness:0.9}),
  glowR:  new THREE.MeshStandardMaterial({color:0xff2a1a, emissive:0xff2a1a, emissiveIntensity:2}),
  glowG:  new THREE.MeshStandardMaterial({color:0x2aff5a, emissive:0x2aff5a, emissiveIntensity:1.6}),
  glowY:  new THREE.MeshStandardMaterial({color:0xffd23a, emissive:0xffc23a, emissiveIntensity:1.6}),
  glowW:  new THREE.MeshStandardMaterial({color:0xfff2d8, emissive:0xfff2d8, emissiveIntensity:1.4}),
  lampOff:new THREE.MeshStandardMaterial({color:0x2a2a2a, emissive:0x000000}),
  web:    new THREE.MeshBasicMaterial({color:0xdcdcdc, transparent:true, opacity:0.35, side:THREE.DoubleSide, depthWrite:false}),
};
function box(w,h,d,mat,x=0,y=0,z=0){ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); m.position.set(x,y,z); return m; }
function cyl(rt,rb,h,mat,x=0,y=0,z=0,seg=10){ const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg),mat); m.position.set(x,y,z); return m; }
function sph(r,mat,x=0,y=0,z=0){ const m=new THREE.Mesh(new THREE.SphereGeometry(r,10,8),mat); m.position.set(x,y,z); return m; }

// texto em placa (pra placas na parede, telas, etc.)
function makeTextPlane(lines, w, h, opts={}){
  const cvs = document.createElement('canvas');
  cvs.width = opts.px || 512; cvs.height = Math.round(cvs.width*h/w);
  const g = cvs.getContext('2d');
  const draw = (ls)=>{
    g.fillStyle = opts.bg || '#05120a'; g.fillRect(0,0,cvs.width,cvs.height);
    g.fillStyle = opts.color || '#3aff7a';
    const fs = opts.fontSize || Math.floor(cvs.height/(ls.length+1.2));
    g.font = `bold ${fs}px monospace`; g.textBaseline='top';
    ls.forEach((l,i)=> g.fillText(l, fs*0.4, fs*0.5 + i*fs*1.05));
  };
  draw(lines);
  const tex = new THREE.CanvasTexture(cvs); tex.magFilter = THREE.NearestFilter;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w,h), new THREE.MeshBasicMaterial({map:tex}));
  mesh.userData.redraw = (ls)=>{ draw(ls); tex.needsUpdate = true; };
  return mesh;
}

// ============================================================================
//  Modelos das ferramentas da loja (feitos com formas simples, mas reconhecíveis).
//  Pra trocar por um modelo seu: ASSETS.tools.<id> = {model:'...glb'} lá em cima.
//  Todos ficam "deitados" no chão; o ponto (0,0,0) é o chão.
// ============================================================================
function TM(c, o={}){ return new THREE.MeshStandardMaterial(Object.assign({color:c, roughness:0.55, metalness:0.3}, o)); }
const TOOL_MODELS = {
  lanterna(){ const g = new THREE.Group();
    const body = cyl(0.045, 0.045, 0.26, TM(0xd6b83a), 0, 0, 0, 12); body.rotation.z = Math.PI/2; g.add(body);
    const head = cyl(0.07, 0.05, 0.08, TM(0x2a2a2a), 0.16, 0, 0, 12); head.rotation.z = Math.PI/2; g.add(head);
    const lens = cyl(0.06, 0.06, 0.01, TM(0xfff6d0, {emissive:0xfff0c0, emissiveIntensity:0.6}), 0.205, 0, 0, 12); lens.rotation.z = Math.PI/2; g.add(lens);
    g.add(box(0.05, 0.02, 0.03, TM(0x1a1a1a), -0.02, 0.05, 0)); // botão
    g.position.y = 0.07; const r = new THREE.Group(); r.add(g); return r; },
  lanterna_pro(){ const g = new THREE.Group();
    const body = cyl(0.05, 0.05, 0.32, TM(0x1c1c1e, {metalness:0.7}), 0, 0, 0, 12); body.rotation.z = Math.PI/2; g.add(body);
    for(let i=0;i<5;i++){ const ring = cyl(0.053, 0.053, 0.012, TM(0x3a3a3c), -0.1+i*0.035, 0, 0, 12); ring.rotation.z = Math.PI/2; g.add(ring); } // grip
    const head = cyl(0.085, 0.055, 0.1, TM(0x2a2a2c, {metalness:0.7}), 0.21, 0, 0, 14); head.rotation.z = Math.PI/2; g.add(head);
    const lens = cyl(0.075, 0.075, 0.01, TM(0xe8f4ff, {emissive:0xdff0ff, emissiveIntensity:0.7}), 0.262, 0, 0, 14); lens.rotation.z = Math.PI/2; g.add(lens);
    g.position.y = 0.085; const r = new THREE.Group(); r.add(g); return r; },
  pa(){ const g = new THREE.Group();
    const handle = cyl(0.022, 0.022, 0.85, TM(0x8a5a32, {metalness:0}), 0, 0, 0, 8); handle.rotation.z = Math.PI/2; g.add(handle);
    const grip = box(0.04, 0.1, 0.03, TM(0x2a2a2a), -0.44, 0, 0); g.add(grip); g.add(box(0.03, 0.03, 0.12, TM(0x2a2a2a), -0.48, 0, 0));
    const neck = cyl(0.03, 0.022, 0.08, TM(0x7a7f86, {metalness:0.8}), 0.45, 0, 0, 8); neck.rotation.z = Math.PI/2; g.add(neck);
    const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.26, 12, 1, false, 0, Math.PI), TM(0x8a9098, {metalness:0.85, roughness:0.35, side:THREE.DoubleSide}));
    blade.rotation.z = Math.PI/2; blade.position.set(0.6, 0, 0); g.add(blade);
    g.position.y = 0.03; const r = new THREE.Group(); r.add(g); r.userData.isShovel = true; return r; },
  granada(){ const g = new THREE.Group();
    g.add(cyl(0.05, 0.05, 0.12, TM(0x3e4a34), 0, 0.06, 0, 10));
    g.add(cyl(0.03, 0.04, 0.03, TM(0x6a6e72, {metalness:0.8}), 0, 0.135, 0, 8));
    g.add(box(0.02, 0.1, 0.025, TM(0x6a6e72, {metalness:0.8}), 0.045, 0.1, 0)); // alavanca
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.005, 5, 12), TM(0xc0c4c8, {metalness:0.9})); ring.position.set(-0.035, 0.16, 0); g.add(ring);
    g.add(box(0.102, 0.012, 0.102, TM(0xe8c03a), 0, 0.03, 0)); // faixa amarela
    return g; },
  gazua(){ const g = new THREE.Group();
    g.add(box(0.22, 0.12, 0.14, TM(0xc0581e), 0, 0.06, 0));
    g.add(box(0.18, 0.05, 0.12, TM(0x2a2a2a), 0, 0.125, 0));
    for(let i=0;i<3;i++) g.add(box(0.012, 0.012, 0.09, TM(0xb8bcc0, {metalness:0.9}), -0.05+i*0.05, 0.06, 0.11));
    g.add(box(0.03, 0.02, 0.01, TM(0x30ff60, {emissive:0x20ff40, emissiveIntensity:1.5}), 0.06, 0.155, 0.04));
    return g; },
  spray(){ const g = new THREE.Group();
    g.add(cyl(0.045, 0.045, 0.2, TM(0xe86a1a), 0, 0.1, 0, 12));
    g.add(cyl(0.046, 0.046, 0.05, TM(0xf0ece0), 0, 0.12, 0, 12)); // rótulo
    g.add(cyl(0.035, 0.045, 0.03, TM(0xb8bcc0, {metalness:0.9}), 0, 0.215, 0, 12));
    g.add(cyl(0.015, 0.015, 0.03, TM(0x1a1a1a), 0, 0.245, 0, 8));
    g.add(box(0.012, 0.012, 0.02, TM(0x1a1a1a), 0, 0.25, -0.02)); // bico
    return g; },
  chave(){ const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.01, 6, 14), TM(0xc8a63a, {metalness:0.9})); ring.rotation.x = Math.PI/2; ring.position.set(-0.05, 0.01, 0); g.add(ring);
    g.add(box(0.09, 0.012, 0.016, TM(0xc8a63a, {metalness:0.9}), 0.02, 0.01, 0));
    g.add(box(0.012, 0.012, 0.03, TM(0xc8a63a, {metalness:0.9}), 0.055, 0.01, 0.015)); g.add(box(0.012, 0.012, 0.022, TM(0xc8a63a, {metalness:0.9}), 0.035, 0.01, 0.012));
    return g; },
  espingarda(){ const g = new THREE.Group();
    const wood = TM(0x6a3e1e, {metalness:0}), metal = TM(0x2a2c30, {metalness:0.8});
    g.add(box(0.3, 0.07, 0.05, wood, -0.35, 0.05, 0)); // coronha
    g.add(box(0.2, 0.06, 0.06, metal, -0.12, 0.06, 0));
    [-0.017,0.017].forEach(z=>{ const b = cyl(0.016, 0.016, 0.6, metal, 0.28, 0.07, z, 8); b.rotation.z = Math.PI/2; g.add(b); });
    g.add(box(0.25, 0.03, 0.05, wood, 0.12, 0.035, 0)); // guarda-mão
    g.add(box(0.03, 0.05, 0.015, metal, -0.15, 0.015, 0)); // gatilho
    return g; },
  cartucho(){ const g = new THREE.Group();
    g.add(cyl(0.016, 0.016, 0.06, TM(0xc82a2a), 0, 0.04, 0, 8)); g.add(cyl(0.017, 0.017, 0.018, TM(0xc8a03a, {metalness:0.9}), 0, 0.009, 0, 8)); return g; },
  kit_medico(){ const g = new THREE.Group();
    g.add(box(0.26, 0.12, 0.18, TM(0xeeeeea, {metalness:0}), 0, 0.06, 0));
    g.add(box(0.27, 0.02, 0.19, TM(0xb8b8b4), 0, 0.09, 0));
    g.add(box(0.1, 0.002, 0.03, TM(0xd02020, {emissive:0x400000}), 0, 0.121, 0)); g.add(box(0.03, 0.002, 0.1, TM(0xd02020, {emissive:0x400000}), 0, 0.121, 0));
    g.add(box(0.08, 0.02, 0.02, TM(0x2a2a2a), 0, 0.13, 0)); // alça
    return g; },
};
