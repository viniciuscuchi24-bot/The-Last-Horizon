/*
 * ============================================================================
 *  13-hud-input.js — INTERFACE (HUD) E CONTROLES
 * ============================================================================
 *  HUD laranja estilo "capacete": vida, fôlego, peso, relógio, 4 espaços de
 *  inventário, marcadores do scanner e mensagens.
 *  Controles: WASD, Shift correr, Ctrl agachar, Espaço pular, E interagir/pegar,
 *  G largar, 1-4/rodinha trocar item, clique esq. usar, clique dir. escanear,
 *  F lanterna, R recarregar, Esc pausa.
 * ============================================================================
 */

const hud2d = document.getElementById('hud2d'); const h2 = hud2d.getContext('2d');
function resizeHud(){ hud2d.width = innerWidth; hud2d.height = innerHeight; }
addEventListener('resize', resizeHud); resizeHud();
document.documentElement.style.setProperty('--hud', CONFIG.HUD_COLOR);

const $ = id=>document.getElementById(id);
let toastT = 0, shake = 0, flashT = 0;
function toast(msg, secs=2.6){ const el = $('toast'); el.textContent = msg; el.style.opacity = 1; toastT = secs; }
function addShake(v){ if(player!==localPlayer) return; shake = Math.min(1.2, shake + v); }
function screenFlash(color='#fff', secs=0.15){ const el = $('flash'); el.style.background = color; el.style.opacity = 0.85; flashT = secs; }

function updateHud(){
  const slots = $('slots'); if(!slots) return;
  slots.innerHTML = player.inv.map((it,i)=>{
    const sel = i===player.slot ? ' sel' : '';
    if(!it) return `<div class="slot${sel}"><span class="n">${i+1}</span></div>`;
    let extra = '';
    if(it.battery!==undefined) extra = `<div class="bar"><div style="width:${Math.round(it.battery/it.def.battery*100)}%"></div></div>`;
    if(it.shells!==undefined) extra = `<div class="mini">${it.shells}/2</div>`;
    if(it.charges!==undefined) extra = `<div class="mini">${it.charges}</div>`;
    if(it.on) extra += `<div class="mini on">ON</div>`;
    return `<div class="slot${sel}${it.def.twoHanded?' two':''}"><span class="n">${i+1}</span><div class="nm">${it.def.name}</div>${extra}</div>`;
  }).join('');
  const w = carriedWeight();
  $('weight').textContent = `${w} lb`;
  $('credits').textContent = `$${S.credits}`;
}
function updateHudFrame(dt){
  // vida e fôlego
  $('hpFill').style.width = Math.max(0, player.hp/CONFIG.PLAYER.maxHp*100)+'%';
  $('stFill').style.width = (player.stamina*100)+'%';
  $('stFill').style.background = player.exhausted ? '#a33' : 'var(--hud)';
  // relógio: só fora da instalação
  const showClock = S.phase==='moon' && S.moon && !S.moon.company && !player.inFacility;
  $('clock').style.display = showClock ? 'block' : 'none';
  if(showClock){ $('clockT').textContent = clockText(); $('clockW').textContent = WEATHERS[S.weather[S.moon.id]].name; }
  // prompt
  let prompt = '';
  if(!menuOpen && player.alive && !transitioning){
    if(player.latched) prompt = 'APERTE [E] VÁRIAS VEZES!';
    else {
      const it = itemUnderCrosshair();
      if(it){ prompt = it.mimicOf ? `[E] Pegar ${it.def.name}` : (holdingTwoHanded() ? 'Mãos ocupadas' : `[E] Pegar ${it.def.name}${it.def.twoHanded?' (duas mãos)':''}`); }
      else { const ia = nearestInteractable(); if(ia) prompt = ia.prompt(); }
    }
  }
  $('prompt').textContent = prompt; $('prompt').style.display = prompt ? 'block' : 'none';
  // toast
  if(toastT > 0){ toastT -= dt; if(toastT <= 0) $('toast').style.opacity = 0; }
  if(flashT > 0){ flashT -= dt; if(flashT <= 0) $('flash').style.opacity = 0; }
  // efeitos de pós-processamento
  player.hurtFlash = Math.max(0, player.hurtFlash - dt*1.5);
  const low = player.hp < 35 ? (0.35 + Math.sin(performance.now()*0.006)*0.1) : 0;
  postMat.uniforms.hurt.value = Math.max(player.hurtFlash, low);
  if(player.alive) postMat.uniforms.blind.value = player.latched ? 0.88 : (player.stunned>0 ? Math.min(0.9, player.stunned*0.5) : 0);
  $('latched').style.display = player.latched ? 'block' : 'none';
  // marcadores do scanner
  h2.clearRect(0,0,hud2d.width,hud2d.height);
  if(scanCooldown > 0) scanCooldown -= dt;
  scanMarks = scanMarks.filter(m=>(m.t-=dt) > 0);
  h2.textAlign = 'center';
  scanMarks.forEach(m=>{
    const p = m.pos; _v3.set(p.x, p.y, p.z).project(camera);
    if(_v3.z > 1) return;
    const x = (_v3.x*0.5+0.5)*hud2d.width, y = (-_v3.y*0.5+0.5)*hud2d.height;
    const a = Math.min(1, m.t);
    const col = m.kind==='creature' ? `rgba(255,60,40,${a})` : (m.kind==='place' ? `rgba(120,200,255,${a})` : `rgba(140,255,110,${a})`);
    h2.strokeStyle = col; h2.lineWidth = 2;
    h2.beginPath(); h2.arc(x, y, 9, 0, Math.PI*2); h2.stroke();
    h2.font = 'bold 13px monospace'; h2.fillStyle = 'rgba(0,0,0,'+(0.55*a)+')'; const tw = Math.max(h2.measureText(m.title).width, h2.measureText(m.sub).width)+16; h2.fillRect(x-tw/2, y-48, tw, m.sub?36:22);
    h2.fillStyle = col; h2.fillText(m.title, x, y-32); h2.font = '12px monospace'; if(m.sub) h2.fillText(m.sub, x, y-17);
  });
  if(scanTotalT > 0){ scanTotalT -= dt; if(scanTotal > 0){ h2.font = 'bold 18px monospace'; h2.fillStyle = `rgba(140,255,110,${Math.min(1,scanTotalT)})`; h2.textAlign='right'; h2.fillText(`VALOR TOTAL: $${scanTotal}`, hud2d.width-24, hud2d.height-130); } }
  // agarrado
  if(player.grabbedBy){ h2.font='bold 22px monospace'; h2.fillStyle='rgba(255,60,40,.9)'; h2.textAlign='center'; h2.fillText('VOCÊ FOI AGARRADO!', hud2d.width/2, hud2d.height*0.3); }
  if(CONFIG.DEBUG_KEYS && facilityDebugMap && player.inFacility) drawFacilityDebugMap(h2, 360, 360);
  // atualiza barras do inventário de vez em quando
  updateHudFrame._t = (updateHudFrame._t||0) - dt; if(updateHudFrame._t <= 0){ updateHudFrame._t = 0.5; updateHud(); }
}

function nearestInteractable(){
  const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
  let best = null, bestScore = Infinity;
  for(const ia of interactables){
    if(!!ia.inFacility !== player.inFacility) continue;
    const dx = ia.x-camera.position.x, dy = (ia.y!==undefined?ia.y:camera.position.y)-camera.position.y, dz = ia.z-camera.position.z;
    const d = Math.hypot(dx, dz); if(d > ia.range) continue;
    const dl = Math.hypot(dx,dy,dz) || 1;
    const dot = (dx*fwd.x + dy*fwd.y + dz*fwd.z)/dl;
    if(dot < 0.55 && d > 0.9 && !(ia.easy && d < ia.range*0.75)) continue;
    const score = d*(1.6-dot);
    if(score < bestScore){ bestScore = score; best = ia; }
  }
  return best;
}

// ---------------------------------------------------------------- controles
const keys = {};
let pointerLocked = false;
function lockPointer(){ if(!menuOpen && canvas.requestPointerLock && !IS_TOUCH_DEVICE()) { try{ const r = canvas.requestPointerLock(); if(r && r.catch) r.catch(()=>{}); }catch(e){} } }
function IS_TOUCH_DEVICE(){ return (window.matchMedia && matchMedia('(pointer: coarse)').matches) || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent); }
document.addEventListener('pointerlockchange', ()=>{
  pointerLocked = document.pointerLockElement === canvas;
  if(!pointerLocked && !menuOpen && gameStarted && player.alive && !transitioning) showPause(true);
});
function showPause(on){ $('pause').style.display = on ? 'flex' : 'none'; if(on) menuOpen = true; }
$('pause').addEventListener('click', e=>{ if(e.target.closest && e.target.closest('button')) return; showPause(false); menuOpen = false; lockPointer(); });
canvas.addEventListener('click', ()=>{ if(!pointerLocked && !menuOpen) lockPointer(); });

// as teclas passam pelo mapa configurável (CONFIGURAÇÕES → Teclado), ver 15-controles.js
function pressAction(act, e){
  switch(act){
    case 'interagir':
      if(player.latched){ if(isNetClient()) netRelay('struggle'); else player.latched.struggle = (player.latched.struggle||0)+1; addShake(0.1); break; }
      if(!tryPickup()){ const ia = nearestInteractable(); if(ia) ia.action(); }
      break;
    case 'largar': dropHeld(); break;
    case 'lanterna': toggleAnyFlashlight(); break;
    case 'recarregar': reloadShotgun(); break;
    case 'pular': tryJump(); break;
    case 'usar': useHeld(); useHeldDown(true); break;
    case 'escanear': doScan(); break;
    case 'item1': case 'item2': case 'item3': case 'item4': switchSlot(parseInt(act.slice(4))-1); break;
    case 'chat': if(typeof openChat==='function'){ openChat(); if(e) e.preventDefault(); } break;
    case 'falar': if(typeof voicePTT==='function') voicePTT(true); break;
  }
}
function releaseAction(act){
  if(act==='usar') useHeldDown(false);
  if(act==='falar' && typeof voicePTT==='function') voicePTT(false);
}
addEventListener('keydown', e=>{
  if(terminalOpen || (typeof chatOpen!=='undefined' && chatOpen)) return;
  if(typeof keyCapture==='function' && keyCapture(e.code, e)) return;
  keys[e.code] = true;
  if(!gameStarted || menuOpen || !player.alive || transitioning) return;
  if(e.repeat) return;
  const act = codeToAction(e.code);
  if(act) pressAction(act, e);
  switch(e.code){
    case 'F9': if(CONFIG.DEBUG_KEYS){ S.credits += 1000; updateHud(); toast('+$1000 (debug)'); } break;
    case 'F10': if(CONFIG.DEBUG_KEYS && S.phase==='moon'){ S.dayTime = CONFIG.DAY_LENGTH_SECONDS*(23-8)/16; toast('23:00 (debug)'); } break;
    case 'F11': if(CONFIG.DEBUG_KEYS){ facilityDebugMap = !facilityDebugMap; e.preventDefault(); } break;
  }
});
addEventListener('keyup', e=>{ keys[e.code] = false; const act = codeToAction(e.code); if(act) releaseAction(act); });
addEventListener('wheel', e=>{ if(!gameStarted || menuOpen || !player.alive) return; switchSlot(player.slot + (e.deltaY>0?1:-1)); }, {passive:true});
addEventListener('mousedown', e=>{
  const code = 'Mouse'+e.button;
  if(typeof keyCapture==='function' && keyCapture(code, e)) return;
  keys[code] = true;
  if(!pointerLocked || menuOpen || !player.alive || transitioning) return;
  const act = codeToAction(code); if(act) pressAction(act, e);
});
addEventListener('mouseup', e=>{ const code = 'Mouse'+e.button; keys[code] = false; const act = codeToAction(code); if(act) releaseAction(act); });
addEventListener('contextmenu', e=>e.preventDefault());
addEventListener('mousemove', e=>{
  if(!pointerLocked || menuOpen) return;
  const sens = CONFIG.MOUSE_SENS * (player.grabbedBy ? 0.2 : 1);
  player.yaw -= e.movementX*sens; player.pitch -= e.movementY*sens;
  player.pitch = clamp(player.pitch, -1.45, 1.45);
});
