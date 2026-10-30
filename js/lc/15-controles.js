/*
 * ============================================================================
 *  15-controles.js — CELULAR (TOQUE) E CONTROLE (GAMEPAD), TUDO CONFIGURÁVEL
 * ============================================================================
 *  - Toque: joystick na esquerda pra andar, arrastar na direita pra olhar,
 *    botões na tela. O layout é editável (arraste e mude o tamanho de cada botão).
 *  - Controle: Xbox/PlayStation/genérico via USB ou Bluetooth (Gamepad API).
 *    Cada ação pode ser remapeada pra qualquer botão.
 *  - Tudo fica salvo no navegador (localStorage).
 *  Abra em: tela inicial ou pausa → CONFIGURAÇÕES
 * ============================================================================
 */

// ---------------------------------------------------------------- TECLADO CONFIGURÁVEL
const KEY_ACTIONS = [
  ['frente','Andar pra frente','KeyW'], ['tras','Andar pra trás','KeyS'], ['esquerda','Andar pra esquerda','KeyA'], ['direita','Andar pra direita','KeyD'],
  ['correr','Correr','ShiftLeft'], ['agachar','Agachar','ControlLeft'], ['pular','Pular','Space'],
  ['interagir','Interagir / pegar','KeyE'], ['largar','Largar item','KeyG'], ['usar','Usar item','Mouse0'], ['escanear','Escanear','Mouse2'],
  ['lanterna','Lanterna','KeyF'], ['recarregar','Recarregar','KeyR'],
  ['item1','Item 1','Digit1'], ['item2','Item 2','Digit2'], ['item3','Item 3','Digit3'], ['item4','Item 4','Digit4'],
  ['chat','Chat de texto','KeyT'], ['falar','Falar (voz)','KeyV'],
];
function defaultKeys(){ const o = {}; KEY_ACTIONS.forEach(([a,,k])=>o[a]=k); return o; }
let _codeMap = null;
function codeToAction(code){
  if(!_codeMap){ _codeMap = {}; const k = (typeof SET!=='undefined' && SET.keys) || defaultKeys(); for(const a in k) _codeMap[k[a]] = a; }
  return _codeMap[code] || null;
}
function kdown(action){ const k = (SET.keys && SET.keys[action]) || defaultKeys()[action]; return !!keys[k]; }
function keyName(code){
  if(!code) return '—';
  if(code==='Mouse0') return 'Clique esquerdo'; if(code==='Mouse2') return 'Clique direito'; if(code==='Mouse1') return 'Clique do meio';
  if(/^Mouse\d/.test(code)) return 'Botão '+code.slice(5)+' do mouse';
  return code.replace(/^Key/,'').replace(/^Digit/,'').replace('ShiftLeft','Shift').replace('ShiftRight','Shift dir.').replace('ControlLeft','Ctrl').replace('ControlRight','Ctrl dir.').replace('AltLeft','Alt').replace('Space','Espaço').replace('ArrowUp','↑').replace('ArrowDown','↓').replace('ArrowLeft','←').replace('ArrowRight','→');
}
let keyWaiting = null;
// quando o jogador clica "mudar" numa tecla, a próxima tecla apertada vira a nova
function keyCapture(code, e){
  if(!keyWaiting) return false;
  if(code==='Escape'){ keyWaiting = null; renderSettings(); return true; }
  for(const a in SET.keys) if(SET.keys[a]===code && a!==keyWaiting) SET.keys[a] = null; // tira de outra ação
  SET.keys[keyWaiting] = code; keyWaiting = null; _codeMap = null; saveSettings();
  if(e && e.preventDefault) e.preventDefault();
  setTimeout(renderSettings, 0);
  return true;
}

// estado lido pelo 14-main.js
const INPUT = {moveX:0, moveY:0, sprint:false, crouch:false, lookX:0, lookY:0};

// ---------------------------------------------------------------- ações
const ACTIONS = {
  jump:     {name:'Pular'},
  sprint:   {name:'Correr'},
  crouch:   {name:'Agachar'},
  interact: {name:'Interagir / Pegar'},
  drop:     {name:'Largar item'},
  use:      {name:'Usar item'},
  scan:     {name:'Escanear'},
  light:    {name:'Lanterna'},
  reload:   {name:'Recarregar'},
  prev:     {name:'Item anterior'},
  next:     {name:'Próximo item'},
  pause:    {name:'Pausa'},
};
// celular/tablet de verdade (tela de toque como principal). PC com tela touch não conta.
const IS_TOUCH = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// ---------------------------------------------------------------- configurações
const DEFAULT_SETTINGS = {
  touchMode: 'auto',          // 'auto' | 'on' | 'off'
  touchSens: 1.0, touchInvertY: false, touchOpacity: 0.4, touchScale: 1.0,
  hideTouchWithPad: true,     // esconde os botões de toque quando um controle está conectado
  brightness: 1.0,
  joystickFixed: false,       // false = o joystick aparece onde o dedo encostar
  sprintToggle: true, crouchToggle: true,
  padSens: 1.0, padInvertY: false, padDeadzone: 0.15,
  mouseSens: 1.0,
  voiceMode: 'ptt',           // 'ptt' (segurar pra falar) | 'aberto' | 'desligado'
  voiceVolume: 1.0,
  keys: null,                 // preenchido com defaultKeys()
  quality: IS_TOUCH ? 'baixa' : 'alta',
  // botão do controle (índice padrão da Gamepad API) → ação
  padMap: {0:'jump', 1:'crouch', 2:'interact', 3:'light', 4:'prev', 5:'next', 6:'scan', 7:'use', 8:'drop', 9:'pause', 10:'sprint', 11:'reload'},
  // posição (% da tela) e tamanho (px) dos botões de toque
  layout: {
    joystick: {x:13, y:74, s:120},
    use:      {x:90, y:66, s:66},
    jump:     {x:93, y:86, s:54},
    interact: {x:82, y:84, s:54},
    scan:     {x:80, y:62, s:46},
    sprint:   {x:71, y:88, s:44},
    crouch:   {x:94, y:46, s:42},
    drop:     {x:72, y:72, s:40},
    light:    {x:84, y:44, s:38},
    reload:   {x:74, y:44, s:36},
    prev:     {x:42, y:92, s:36},
    next:     {x:58, y:92, s:36},
    pause:    {x:96, y:9,  s:36},
    talk:     {x:6,  y:40, s:48},
    chat:     {x:6,  y:24, s:36},
  },
};
const BTN_LABEL = {use:'USAR', jump:'PULAR', interact:'E', scan:'SCAN', sprint:'CORRER', crouch:'AGACH.', drop:'LARGAR', light:'LUZ', reload:'RECAR.', prev:'◀', next:'▶', pause:'❚❚', talk:'🎙', chat:'💬', joystick:''};
let SET = loadSettings();
function loadSettings(){
  let s = null;
  try{ s = JSON.parse(localStorage.getItem('terrorcoop_controles_v2')||'null'); }catch(e){}
  const d = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  if(!s){ d.keys = defaultKeys(); return d; }
  const out = Object.assign(d, s);
  out.layout = Object.assign(JSON.parse(JSON.stringify(DEFAULT_SETTINGS.layout)), s.layout||{});
  out.padMap = s.padMap || d.padMap;
  out.keys = Object.assign(defaultKeys(), s.keys||{});
  return out;
}
function saveSettings(){ try{ localStorage.setItem('terrorcoop_controles_v2', JSON.stringify(SET)); }catch(e){} }
let padConnected = false;
function touchEnabled(){
  if(SET.touchMode==='off') return false;
  if(SET.hideTouchWithPad && padConnected && !editMode) return false;
  return SET.touchMode==='on' || IS_TOUCH;
}
// tamanho dos botões acompanha o tamanho da tela (celular pequeno = botões menores)
function screenK(){ return clamp(Math.min(innerWidth, innerHeight)/430, 0.55, 1.25) * SET.touchScale; }
function applySettings(){
  CONFIG.MOUSE_SENS = 0.0022 * SET.mouseSens;
  CONFIG.RENDER_HEIGHT = {baixa:300, media:420, alta:520}[SET.quality] || 520;
  if(typeof resize==='function') resize();
  postMat.uniforms.bright.value = SET.brightness;
  document.body.classList.toggle('touch', touchEnabled());
  buildTouchUI();
  if(typeof voiceApplyTalk==='function') voiceApplyTalk();
}

// ---------------------------------------------------------------- executar ação
function canAct(){ return gameStarted && !menuOpen && player.alive && !transitioning && !terminalOpen; }
function fakeKey(code){ dispatchEvent(new KeyboardEvent('keydown', {code})); dispatchEvent(new KeyboardEvent('keyup', {code})); }
function doAction(a, pressed){
  // ações de segurar
  if(a==='sprint'){ if(SET.sprintToggle){ if(pressed) INPUT.sprint = !INPUT.sprint; } else INPUT.sprint = pressed; refreshToggles(); return; }
  if(a==='crouch'){ if(SET.crouchToggle){ if(pressed) INPUT.crouch = !INPUT.crouch; } else INPUT.crouch = pressed; refreshToggles(); return; }
  if(a==='use' && !pressed){ useHeldDown(false); return; }
  if(a==='talk'){ voicePTT(pressed); return; }
  if(a==='chat'){ if(pressed && gameStarted) openChat(); return; }
  if(!pressed) return;
  if(a==='pause'){
    if(!gameStarted) return;
    if($('settings').style.display==='flex'){ closeSettings(); return; }
    if($('pause').style.display==='flex'){ showPause(false); menuOpen = false; } else if(!menuOpen) showPause(true);
    return;
  }
  if(!canAct()) return;
  switch(a){
    case 'jump': fakeKey('Space'); break;
    case 'interact': fakeKey('KeyE'); break;
    case 'drop': fakeKey('KeyG'); break;
    case 'light': fakeKey('KeyF'); break;
    case 'reload': fakeKey('KeyR'); break;
    case 'use': useHeld(); useHeldDown(true); break;
    case 'scan': doScan(); break;
    case 'prev': switchSlot(player.slot-1); break;
    case 'next': switchSlot(player.slot+1); break;
  }
}
function refreshToggles(){
  document.querySelectorAll('.tbtn[data-a="sprint"]').forEach(b=>b.classList.toggle('on', INPUT.sprint));
  document.querySelectorAll('.tbtn[data-a="crouch"]').forEach(b=>b.classList.toggle('on', INPUT.crouch));
}

// chamado a cada frame pelo 14-main.js
function updateControls(dt){
  if(INPUT.lookX || INPUT.lookY){
    player.yaw -= INPUT.lookX*dt; player.pitch -= INPUT.lookY*dt;
    player.pitch = clamp(player.pitch, -1.45, 1.45);
  }
  // correr desliga sozinho quando para de andar (modo alternar)
  if(SET.sprintToggle && INPUT.sprint && !player.moving && !INPUT.moveX && !INPUT.moveY && !kdown('frente')){ INPUT.sprint = false; refreshToggles(); }
}

// ================================================================ TOQUE
const touchRoot = document.createElement('div'); touchRoot.id = 'touchUI'; document.body.appendChild(touchRoot);
let joy = null, lookTouch = null, editMode = false, editSel = null;
function px(v, total){ return v/100*total; }
function buildTouchUI(){
  touchRoot.innerHTML = '';
  touchRoot.style.display = (touchEnabled() || editMode) ? 'block' : 'none';
  touchRoot.style.opacity = editMode ? 1 : SET.touchOpacity;
  touchRoot.classList.toggle('editing', editMode);
  for(const [id, L] of Object.entries(SET.layout)){
    if((id==='talk'||id==='chat') && !editMode && !(typeof NET!=='undefined' && NET.mode!=='off')) continue;
    const el = document.createElement('div');
    const size = L.s * screenK();
    el.className = id==='joystick' ? 'tjoy' : 'tbtn';
    el.dataset.a = id;
    el.style.width = el.style.height = size+'px';
    el.style.left = `calc(${L.x}% - ${size/2}px)`; el.style.top = `calc(${L.y}% - ${size/2}px)`;
    el.style.fontSize = Math.max(10, size*0.2)+'px';
    if(id==='joystick'){ const k = document.createElement('div'); k.className = 'knob'; el.appendChild(k); if(!SET.joystickFixed && !editMode) el.classList.add('ghost'); }
    else el.textContent = BTN_LABEL[id];
    if(editMode && editSel===id) el.classList.add('sel');
    touchRoot.appendChild(el);
  }
  refreshToggles();
}
function joyEl(){ return touchRoot.querySelector('.tjoy'); }

touchRoot.addEventListener('touchstart', e=>{
  if(editMode) return;
  for(const t of e.changedTouches){
    const b = t.target.closest && t.target.closest('.tbtn');
    if(b){ e.preventDefault(); b.classList.add('down'); b._tid = t.identifier; doAction(b.dataset.a, true); continue; }
  }
}, {passive:false});
touchRoot.addEventListener('touchend', e=>{
  if(editMode) return;
  for(const t of e.changedTouches){
    touchRoot.querySelectorAll('.tbtn.down').forEach(b=>{ if(b._tid===t.identifier){ b.classList.remove('down'); doAction(b.dataset.a, false); } });
  }
});
// joystick e olhar: toques na tela que não caíram num botão
addEventListener('touchstart', e=>{
  if(!touchEnabled() || editMode || !gameStarted || menuOpen) return;
  for(const t of e.changedTouches){
    if(t.target.closest && (t.target.closest('.tbtn') || t.target.closest('#slots'))) continue;
    const L = SET.layout.joystick, size = L.s*screenK();
    const jx = px(L.x, innerWidth), jy = px(L.y, innerHeight);
    const leftSide = t.clientX < innerWidth*0.45;
    if(!joy && (SET.joystickFixed ? Math.hypot(t.clientX-jx, t.clientY-jy) < size*0.8 : leftSide)){
      joy = {id:t.identifier, cx: SET.joystickFixed ? jx : t.clientX, cy: SET.joystickFixed ? jy : t.clientY, r:size/2};
      const el = joyEl(); if(el){ el.classList.remove('ghost'); el.style.left = (joy.cx-size/2)+'px'; el.style.top = (joy.cy-size/2)+'px'; }
      moveJoy(t);
    } else if(!lookTouch){
      lookTouch = {id:t.identifier, x:t.clientX, y:t.clientY};
    }
  }
}, {passive:true});
addEventListener('touchmove', e=>{
  if(!touchEnabled() || editMode) return;
  for(const t of e.changedTouches){
    if(joy && t.identifier===joy.id) moveJoy(t);
    if(lookTouch && t.identifier===lookTouch.id){
      if(gameStarted && !menuOpen){
        const k = 0.0045*SET.touchSens;
        player.yaw -= (t.clientX-lookTouch.x)*k;
        player.pitch -= (t.clientY-lookTouch.y)*k*(SET.touchInvertY?-1:1);
        player.pitch = clamp(player.pitch, -1.45, 1.45);
      }
      lookTouch.x = t.clientX; lookTouch.y = t.clientY;
    }
  }
  if(gameStarted && !menuOpen && !terminalOpen) e.preventDefault();
}, {passive:false});
function endTouches(e){
  for(const t of e.changedTouches){
    if(joy && t.identifier===joy.id){
      joy = null; INPUT.moveX = INPUT.moveY = 0;
      const el = joyEl(); if(el){ const k = el.querySelector('.knob'); k.style.transform = ''; if(!SET.joystickFixed) el.classList.add('ghost'); const L = SET.layout.joystick, size=L.s*screenK(); el.style.left = `calc(${L.x}% - ${size/2}px)`; el.style.top = `calc(${L.y}% - ${size/2}px)`; }
    }
    if(lookTouch && t.identifier===lookTouch.id) lookTouch = null;
  }
}
addEventListener('touchend', endTouches); addEventListener('touchcancel', endTouches);
function moveJoy(t){
  let dx = t.clientX-joy.cx, dy = t.clientY-joy.cy; const d = Math.hypot(dx,dy), r = joy.r*0.8;
  if(d > r){ dx = dx/d*r; dy = dy/d*r; }
  INPUT.moveX = dx/r; INPUT.moveY = -dy/r;
  const el = joyEl(); if(el) el.querySelector('.knob').style.transform = `translate(${dx}px, ${dy}px)`;
}
// tocar num espaço do inventário seleciona o item
document.getElementById('slots').addEventListener('touchstart', e=>{
  const s = e.target.closest('.slot'); if(!s || !canAct()) return;
  const i = [...s.parentNode.children].indexOf(s); if(i>=0) switchSlot(i);
}, {passive:true});

// ---------------- editor de layout
let dragEdit = null;
function startEditLayout(){
  editMode = true; editSel = null; closeSettings(true);
  menuOpen = true; $('editBar').style.display = 'flex'; buildTouchUI();
}
function endEditLayout(){ editMode = false; $('editBar').style.display = 'none'; saveSettings(); buildTouchUI(); openSettings(); }
function editPointerDown(x, y, target){
  const el = target.closest && target.closest('.tbtn, .tjoy'); if(!el) return;
  editSel = el.dataset.a; dragEdit = {id:editSel};
  touchRoot.querySelectorAll('.sel').forEach(n=>n.classList.remove('sel')); el.classList.add('sel');
  $('editName').textContent = editSel==='joystick' ? 'Joystick' : ACTIONS[editSel].name;
}
function editPointerMove(x, y){
  if(!dragEdit) return;
  const L = SET.layout[dragEdit.id];
  L.x = clamp(x/innerWidth*100, 2, 98); L.y = clamp(y/innerHeight*100, 3, 97);
  const el = touchRoot.querySelector(`[data-a="${dragEdit.id}"]`), size = L.s*screenK();
  el.style.left = `calc(${L.x}% - ${size/2}px)`; el.style.top = `calc(${L.y}% - ${size/2}px)`;
}
touchRoot.addEventListener('touchstart', e=>{ if(!editMode) return; e.preventDefault(); const t = e.changedTouches[0]; editPointerDown(t.clientX, t.clientY, t.target); }, {passive:false});
touchRoot.addEventListener('touchmove', e=>{ if(!editMode) return; e.preventDefault(); const t = e.changedTouches[0]; editPointerMove(t.clientX, t.clientY); }, {passive:false});
touchRoot.addEventListener('touchend', ()=>{ dragEdit = null; });
touchRoot.addEventListener('mousedown', e=>{ if(editMode) editPointerDown(e.clientX, e.clientY, e.target); });
addEventListener('mousemove', e=>{ if(editMode) editPointerMove(e.clientX, e.clientY); });
addEventListener('mouseup', ()=>{ dragEdit = null; });
function editResize(k){
  if(!editSel) { toast('Toque num botão primeiro'); return; }
  const L = SET.layout[editSel]; L.s = clamp(Math.round(L.s*k), 30, 260); buildTouchUI();
}

// ================================================================ CONTROLE (GAMEPAD)
let padPrev = [], padIndex = null, remapWaiting = null, padAnnounced = false;
addEventListener('gamepadconnected', e=>{ if(realPad(e.gamepad)) toast('Controle encontrado — aperte A (ou ✕) pra ativar'); });
function onPadChange(){ if(setEl && setEl.style.display==='flex' && !remapWaiting) renderSettings(); const h = document.getElementById('padHint'); if(h) h.style.display = padConnected ? 'block' : 'none'; buildTouchUI(); }
addEventListener('gamepaddisconnected', e=>{ delete padActivated[e.gamepad.index]; if(padIndex===e.gamepad.index){ padIndex = null; padConnected = false; onPadChange(); INPUT.moveX = INPUT.moveY = INPUT.lookX = INPUT.lookY = 0; toast('Controle desconectado'); } });
// Alguns celulares Android listam "controles fantasmas" (sensor de digital, botões de volume...).
// Por isso só aceitamos um controle com analógicos e botões suficientes, e só depois que
// um botão de verdade (A/B/X/Y/gatilhos/Start) for apertado nele.
let padActivated = {};
function realPad(p){ return p && p.connected !== false && p.axes.length >= 4 && p.buttons.length >= 12; }
function getPad(){
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for(const p of pads){
    if(!realPad(p)) continue;
    if(!padActivated[p.index] && p.buttons.slice(0,10).some(b=>b.pressed)) padActivated[p.index] = true;
    if(padActivated[p.index]){ padIndex = p.index; return p; }
  }
  return null;
}
function dz(v){ const d = SET.padDeadzone; return Math.abs(v) < d ? 0 : Math.sign(v)*(Math.abs(v)-d)/(1-d); }
function pollGamepad(){
  const pad = getPad();
  if(pad && !padConnected){ padConnected = true; onPadChange(); toast('Controle ativado: '+pad.id.slice(0,40)); padPrev = pad.buttons.map(b=>b.pressed); }
  if(!pad && padConnected){ padConnected = false; INPUT.lookX = INPUT.lookY = 0; if(!joy){ INPUT.moveX = INPUT.moveY = 0; } onPadChange(); }
  if(pad){
    const pressed = pad.buttons.map(b=>b.pressed || b.value > 0.5);
    // esperando o jogador apertar um botão pra remapear
    if(remapWaiting){
      const i = pressed.findIndex((p,k)=>p && !padPrev[k]);
      if(i >= 0){ for(const k of Object.keys(SET.padMap)) if(SET.padMap[k]===remapWaiting) delete SET.padMap[k]; SET.padMap[i] = remapWaiting; remapWaiting = null; saveSettings(); renderSettings(); }
      padPrev = pressed; requestAnimationFrame(pollGamepad); return;
    }
    // menus: A confirma
    const justA = pressed[0] && !padPrev[0];
    if(justA){
      if($('start').style.display!=='none' && !gameStarted){ const b = document.querySelector('#start .primary'); if(b) b.click(); }
      else if($('bigScreen').style.display==='flex'){ const b = $('bigBtn'); if(b) b.click(); }
      else if($('pause').style.display==='flex'){ showPause(false); menuOpen = false; }
    }
    pressed.forEach((p,k)=>{
      const a = SET.padMap[k]; if(!a) return;
      if(p && !padPrev[k]) doAction(a, true);
      if(!p && padPrev[k]) doAction(a, false);
    });
    padPrev = pressed;
    // analógicos: esquerdo anda, direito olha
    const lx = dz(pad.axes[0]||0), ly = dz(pad.axes[1]||0), rx = dz(pad.axes[2]||0), ry = dz(pad.axes[3]||0);
    if(!joy){ INPUT.moveX = Math.abs(lx)>0.02?lx:0; INPUT.moveY = Math.abs(ly)>0.02?-ly:0; }
    INPUT.lookX = rx*Math.abs(rx)*3.2*SET.padSens;
    INPUT.lookY = ry*Math.abs(ry)*2.4*SET.padSens*(SET.padInvertY?-1:1);
    // direcional também troca de item
    if(pressed[14] && !pollGamepad._d14 && canAct()) switchSlot(player.slot-1);
    if(pressed[15] && !pollGamepad._d15 && canAct()) switchSlot(player.slot+1);
    pollGamepad._d14 = pressed[14]; pollGamepad._d15 = pressed[15];
  }
  requestAnimationFrame(pollGamepad);
}
requestAnimationFrame(pollGamepad);

// ================================================================ TELA DE CONFIGURAÇÕES
const setEl = document.createElement('div'); setEl.id = 'settings'; setEl.className = 'screen'; document.body.appendChild(setEl);
const editBar = document.createElement('div'); editBar.id = 'editBar';
editBar.innerHTML = `<span id="editName">Toque e arraste um botão</span><button data-k="0.85">− menor</button><button data-k="1.15">+ maior</button><button id="editReset">padrão</button><button id="editDone">CONCLUIR</button>`;
document.body.appendChild(editBar);
editBar.querySelectorAll('[data-k]').forEach(b=>b.addEventListener('click', ()=>editResize(parseFloat(b.dataset.k))));
editBar.querySelector('#editReset').addEventListener('click', ()=>{ SET.layout = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.layout)); buildTouchUI(); });
editBar.querySelector('#editDone').addEventListener('click', endEditLayout);

let settingsReturnToPause = false;
function openSettings(){
  settingsReturnToPause = $('pause').style.display==='flex';
  $('pause').style.display = 'none';
  menuOpen = true; document.exitPointerLock && document.exitPointerLock();
  setEl.style.display = 'flex'; renderSettings();
}
function closeSettings(keepMenu){
  setEl.style.display = 'none'; remapWaiting = null; keyWaiting = null; saveSettings();
  if(keepMenu) return;
  if(gameStarted && settingsReturnToPause) showPause(true); else if(!gameStarted) menuOpen = false;
}
function padName(i){ const n = {0:'A / ✕',1:'B / ○',2:'X / □',3:'Y / △',4:'LB / L1',5:'RB / R1',6:'LT / L2',7:'RT / R2',8:'Back / Share',9:'Start / Options',10:'L3 (apertar analógico esq.)',11:'R3 (apertar analógico dir.)',12:'Cima',13:'Baixo',14:'Esquerda',15:'Direita',16:'Home'}; return n[i] || ('Botão '+i); }
function renderSettings(){
  const pad = getPad();
  const rows = Object.entries(ACTIONS).map(([a,info])=>{
    const btn = Object.keys(SET.padMap).find(k=>SET.padMap[k]===a);
    const label = remapWaiting===a ? '<b>aperte um botão...</b>' : (btn!==undefined ? padName(+btn) : '—');
    return `<tr><td>${info.name}</td><td>${label}</td><td><button class="sm" data-remap="${a}">mudar</button></td></tr>`;
  }).join('');
  const sel = (id, opts, v)=>`<select data-set="${id}">${opts.map(([k,t])=>`<option value="${k}" ${String(v)===String(k)?'selected':''}>${t}</option>`).join('')}</select>`;
  const rng = (id, min, max, step, v)=>`<input type="range" data-set="${id}" min="${min}" max="${max}" step="${step}" value="${v}"><span class="val">${(+v).toFixed(2)}</span>`;
  const chk = (id, v)=>`<input type="checkbox" data-set="${id}" ${v?'checked':''}>`;
  setEl.innerHTML = `<div class="inner setBox">
    <h1>CONFIGURAÇÕES</h1>
    <div class="tabs"><button class="tab" data-tab="teclado">Teclado</button><button class="tab" data-tab="toque">Toque</button><button class="tab" data-tab="controle">Controle</button><button class="tab" data-tab="voz">Voz e chat</button><button class="tab" data-tab="geral">Geral</button></div>
    <div class="tabBody" data-body="teclado">
      <p class="small">Clique em "mudar" e aperte a tecla (ou botão do mouse) nova. Esc cancela.</p>
      <table class="map">${KEY_ACTIONS.map(([a,name])=>`<tr><td>${name}</td><td>${keyWaiting===a?'<b>aperte uma tecla...</b>':keyName(SET.keys[a])}</td><td><button class="sm" data-key="${a}">mudar</button></td></tr>`).join('')}</table>
      <button id="btnKeysReset" class="sm">restaurar teclas padrão</button>
    </div>
    <div class="tabBody" data-body="toque">
      <label>Controles de toque ${sel('touchMode', [['auto','Automático'],['on','Sempre ligado'],['off','Desligado']], SET.touchMode)}</label>
      <label>Sensibilidade pra olhar ${rng('touchSens',0.3,3,0.05,SET.touchSens)}</label>
      <label>Inverter eixo vertical ${chk('touchInvertY', SET.touchInvertY)}</label>
      <label>Transparência dos botões ${rng('touchOpacity',0.15,1,0.05,SET.touchOpacity)}</label>
      <label>Tamanho de todos os botões ${rng('touchScale',0.6,1.6,0.05,SET.touchScale)}</label>
      <label>Joystick fixo no lugar ${chk('joystickFixed', SET.joystickFixed)}</label>
      <label>Esconder botões quando tiver controle ${chk('hideTouchWithPad', SET.hideTouchWithPad)}</label>
      <label>Correr: tocar liga/desliga ${chk('sprintToggle', SET.sprintToggle)}</label>
      <label>Agachar: tocar liga/desliga ${chk('crouchToggle', SET.crouchToggle)}</label>
      <button id="btnEditLayout">EDITAR POSIÇÃO DOS BOTÕES</button>
    </div>
    <div class="tabBody" data-body="controle">
      <p class="small">${pad ? '✅ Conectado: '+pad.id.slice(0,50) : '❌ Nenhum controle detectado. Conecte por USB ou Bluetooth e aperte qualquer botão (o navegador só "enxerga" o controle depois de um botão apertado).'}</p>
      <label>Sensibilidade pra olhar ${rng('padSens',0.3,3,0.05,SET.padSens)}</label>
      <label>Inverter eixo vertical ${chk('padInvertY', SET.padInvertY)}</label>
      <label>Zona morta dos analógicos ${rng('padDeadzone',0.02,0.4,0.01,SET.padDeadzone)}</label>
      <p class="small">Analógico esquerdo anda, direito olha. Direcional ◀ ▶ troca de item.</p>
      <table class="map">${rows}</table>
      <button id="btnPadReset" class="sm">restaurar botões padrão</button>
    </div>
    <div class="tabBody" data-body="voz">
      <label>Chat de voz ${sel('voiceMode', [['ptt','Segurar pra falar ('+keyName(SET.keys.falar)+' / botão 🎙)'],['aberto','Microfone sempre aberto'],['desligado','Desligado']], SET.voiceMode)}</label>
      <label>Volume das vozes ${rng('voiceVolume',0,2,0.05,SET.voiceVolume ?? 1)}</label>
      <button id="btnMicTest" class="sm">testar / permitir microfone</button>
      <p class="small">A voz é por proximidade: você só ouve quem está perto. Falar faz barulho e atrai criaturas.<br>Chat de texto: ${keyName(SET.keys.chat)} (no celular, botão 💬).<br>${window.isSecureContext ? '✅ Este endereço pode usar o microfone.' : '⚠ Este endereço NÃO pode usar o microfone (precisa de https). Abra o endereço https:// que o servidor mostra.'}</p>
    </div>
    <div class="tabBody" data-body="geral">
      <label>Brilho ${rng('brightness',0.7,2.0,0.05,SET.brightness)}</label>
      <label>Qualidade gráfica ${sel('quality', [['baixa','Baixa (celular)'],['media','Média'],['alta','Alta']], SET.quality)}</label>
      <label>Sensibilidade do mouse ${rng('mouseSens',0.2,3,0.05,SET.mouseSens)}</label>
      <button id="btnFull">TELA CHEIA</button>
      <button id="btnResetAll" class="sm" style="margin-top:12px">restaurar TODAS as configurações</button>
    </div>
    <button id="btnSetClose">VOLTAR</button>
  </div>`;
  const tab = renderSettings._tab || (pad ? 'controle' : (IS_TOUCH ? 'toque' : 'teclado'));
  setEl.querySelectorAll('.tabBody').forEach(b=>b.style.display = b.dataset.body===tab ? 'block' : 'none');
  setEl.querySelectorAll('.tab').forEach(b=>{ b.classList.toggle('on', b.dataset.tab===tab); b.onclick = ()=>{ renderSettings._tab = b.dataset.tab; renderSettings(); }; });
  setEl.querySelectorAll('[data-set]').forEach(inp=>{
    inp.addEventListener('input', ()=>{
      const k = inp.dataset.set;
      SET[k] = inp.type==='checkbox' ? inp.checked : (inp.type==='range' ? parseFloat(inp.value) : inp.value);
      if(inp.type==='range') inp.nextElementSibling.textContent = SET[k].toFixed(2);
      saveSettings(); applySettings();
    });
  });
  setEl.querySelectorAll('[data-key]').forEach(b=>b.addEventListener('click', e=>{ e.stopPropagation(); setTimeout(()=>{ keyWaiting = b.dataset.key; renderSettings(); }, 50); }));
  setEl.querySelectorAll('[data-remap]').forEach(b=>b.addEventListener('click', ()=>{ remapWaiting = b.dataset.remap; renderSettings(); }));
  const g = id=>setEl.querySelector('#'+id);
  g('btnEditLayout').onclick = ()=>{ if(SET.touchMode==='off'){ SET.touchMode='on'; } startEditLayout(); };
  g('btnKeysReset').onclick = ()=>{ SET.keys = defaultKeys(); _codeMap = null; saveSettings(); renderSettings(); };
  g('btnPadReset').onclick = ()=>{ SET.padMap = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.padMap)); saveSettings(); renderSettings(); };
  g('btnFull').onclick = goFullscreen;
  g('btnMicTest').onclick = ()=>{ if(VOICE.micState==='negado') VOICE.micState = 'off'; voiceEnsureMic().then(ok=>toast(ok ? '🎙 Microfone liberado!' : 'Não consegui usar o microfone')); };
  g('btnResetAll').onclick = ()=>{ try{ localStorage.removeItem('terrorcoop_controles_v2'); }catch(e){} SET = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)); applySettings(); renderSettings(); toast('Configurações restauradas'); };
  g('btnSetClose').onclick = ()=>closeSettings();
}
function goFullscreen(){
  const el = document.documentElement;
  const p = el.requestFullscreen ? el.requestFullscreen() : (el.webkitRequestFullscreen ? el.webkitRequestFullscreen() : null);
  if(p && p.then) p.then(()=>{ try{ screen.orientation.lock('landscape').catch(()=>{}); }catch(e){} }).catch(()=>{});
}

// botões "CONFIGURAÇÕES" na tela inicial e na pausa
function addSettingsButton(parentSel){
  const host = document.querySelector(parentSel); if(!host) return;
  const b = document.createElement('button'); b.textContent = 'CONFIGURAÇÕES'; b.className = 'setBtn';
  b.addEventListener('click', e=>{ e.stopPropagation(); openSettings(); });
  host.appendChild(b);
}
addSettingsButton('#start .startRow'); addSettingsButton('#pause .inner');
// no celular: tela cheia ao começar e texto da pausa
document.getElementById('startBtn').addEventListener('click', ()=>{ if(touchEnabled()) goFullscreen(); });
if(IS_TOUCH){ const p = document.querySelector('#pause .inner p'); if(p) p.textContent = 'Toque para continuar'; }
addEventListener('keydown', e=>{ if(e.defaultPrevented) return; if(e.code==='Escape' && setEl.style.display==='flex'){ closeSettings(); } if(e.code==='Escape' && editMode){ endEditLayout(); } });
applySettings();

addEventListener('resize', ()=>{ if(touchEnabled() || editMode) buildTouchUI(); });
