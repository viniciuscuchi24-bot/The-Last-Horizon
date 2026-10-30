/*
 * ============================================================================
 *  18-chat-voz.js — CHAT DE TEXTO E CHAT DE VOZ POR PROXIMIDADE
 * ============================================================================
 *  TEXTO: aperte T (ou o botão 💬 no celular), digite e Enter.
 *         O cliente manda pro host, o host repassa pra todo mundo.
 *
 *  VOZ:   igual ao Lethal Company — você ouve quem está PERTO de você.
 *         Quanto mais longe, mais baixo; dentro da instalação x lado de fora
 *         não se escutam; os mortos se ouvem entre si, mas os vivos não ouvem
 *         os mortos. Falar faz barulho e ATRAI criaturas!
 *         Modos (Configurações → Geral): apertar pra falar (V) ou microfone aberto.
 *
 *  Como funciona por baixo: cada par de jogadores abre uma conexão WebRTC
 *  só de áudio. Os "convites" (offer/answer/ice) passam pelo host, pelo mesmo
 *  caminho das outras mensagens do jogo — então funciona tanto na sala do
 *  servidor (LAN) quanto na sala por código (P2P).
 *
 *  IMPORTANTE: o navegador só libera o microfone em https:// ou em localhost.
 *  Na LAN, abra o endereço https://IP:PORTA+1 que o servidor mostra
 *  (aceite o aviso de "conexão não segura" — o certificado é caseiro).
 * ============================================================================
 */

// ============================================================ CHAT DE TEXTO
const chatLog = document.createElement('div'); chatLog.id = 'chatLog'; document.body.appendChild(chatLog);
const chatBox = document.createElement('div'); chatBox.id = 'chatBox';
chatBox.innerHTML = '<input id="chatInput" maxlength="120" placeholder="Mensagem... (Enter envia, Esc fecha)" autocomplete="off">';
document.body.appendChild(chatBox);
const chatInput = chatBox.querySelector('input');
let chatOpen = false;

function openChat(){
  if(NET.mode==='off'){ toast('O chat só funciona no multiplayer'); return; }
  if(chatOpen) return;
  chatOpen = true; menuOpen = true;
  chatBox.style.display = 'block'; chatLog.classList.add('open');
  document.exitPointerLock && document.exitPointerLock();
  for(const k in keys) keys[k] = false;                 // para de andar enquanto digita
  chatInput.focus(); setTimeout(()=>chatInput.focus(), 30);
}
function closeChat(){
  if(!chatOpen) return;
  chatOpen = false; menuOpen = false;
  chatBox.style.display = 'none'; chatLog.classList.remove('open');
  chatInput.value = ''; chatInput.blur();
  if(gameStarted) lockPointer();
}
chatInput.addEventListener('keydown', e=>{
  e.stopPropagation();
  if(e.key==='Escape'){ e.preventDefault(); closeChat(); return; }
  if(e.key==='Enter'){ const t = chatInput.value.trim(); if(t) sendChat(t); closeChat(); }
});
chatInput.addEventListener('keyup', e=>e.stopPropagation());

function sendChat(txt){
  txt = String(txt).slice(0, 120);
  if(NET.mode==='client') netSend({t:'chat', txt});
  else if(NET.mode==='host'){ const n = playerNick(); addChatLine(n, txt); netBroadcast({t:'chat', n, txt}); }
}
// o host recebe de um cliente: coloca o nome e repassa pra todos
function hostChat(p, txt){ const n = p.name; txt = String(txt||'').slice(0,120); if(!txt) return; addChatLine(n, txt); netBroadcast({t:'chat', n, txt}); }
function addChatLine(name, txt, system){
  const el = document.createElement('div'); el.className = 'chatLine' + (system?' sys':'');
  el.innerHTML = system ? escapeHtml(txt) : `<b>${escapeHtml(name)}:</b> ${escapeHtml(txt)}`;
  chatLog.appendChild(el);
  while(chatLog.children.length > 40) chatLog.removeChild(chatLog.firstChild);
  el._t = performance.now();
  if(!system) sfx('chat', null, 0.6);
}
function chatSystem(txt){ addChatLine('', txt, true); }
// as linhas somem depois de 12s (continuam no histórico quando o chat está aberto)
setInterval(()=>{ const now = performance.now(); chatLog.querySelectorAll('.chatLine').forEach(l=>l.classList.toggle('old', now - l._t > 12000)); }, 1000);

// ============================================================ CHAT DE VOZ
const VOICE = {
  stream: null, track: null, micState: 'off',   // 'off' | 'pedindo' | 'ok' | 'negado'
  pcs: new Map(),          // id do outro jogador -> {pc, sender, audio, gain, pan, an, level}
  ptt: false, talking: false, level: 0, an: null, noiseT: 0,
};
function voiceMode(){ return SET.voiceMode || 'ptt'; }      // 'ptt' | 'aberto' | 'desligado'

function micAllowedHere(){ return window.isSecureContext && navigator.mediaDevices && navigator.mediaDevices.getUserMedia; }
function micHelp(){
  const p = location.port ? (+location.port + 1) : 8081;
  return `O navegador só libera o microfone em https://. Abra https://${location.hostname}:${p} (aceite o aviso do certificado).`;
}
// pede o microfone (só uma vez; depois só liga/desliga a trilha)
function voiceEnsureMic(){
  if(VOICE.micState==='ok' || VOICE.micState==='pedindo') return Promise.resolve(VOICE.micState==='ok');
  if(voiceMode()==='desligado') return Promise.resolve(false);
  if(!micAllowedHere()){ if(VOICE.micState!=='negado'){ VOICE.micState = 'negado'; toast(micHelp(), 7); } return Promise.resolve(false); }
  VOICE.micState = 'pedindo';
  return navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true, noiseSuppression:true, autoGainControl:true}, video:false})
    .then(stream=>{
      VOICE.stream = stream; VOICE.track = stream.getAudioTracks()[0]; VOICE.micState = 'ok';
      VOICE.track.enabled = false;
      audioInit();
      const src = AC.createMediaStreamSource(stream); VOICE.an = AC.createAnalyser(); VOICE.an.fftSize = 512; src.connect(VOICE.an);
      VOICE.pcs.forEach(v=>{ if(v.sender) v.sender.replaceTrack(VOICE.track).catch(()=>{}); });
      voiceApplyTalk();
      return true;
    })
    .catch(err=>{ VOICE.micState = 'negado'; toast('Microfone bloqueado: ' + (err.name==='NotAllowedError' ? 'permita o microfone no navegador' : err.message), 6); return false; });
}
function voicePTT(on){
  if(NET.mode==='off') return;
  VOICE.ptt = !!on;
  if(on && VOICE.micState!=='ok') voiceEnsureMic();
  voiceApplyTalk();
}
function voiceApplyTalk(){
  const mode = voiceMode();
  const on = mode!=='desligado' && (mode==='aberto' || VOICE.ptt);
  if(VOICE.track) VOICE.track.enabled = on;
  VOICE.talking = on && VOICE.micState==='ok';
}

// ---- conexões (uma por par de jogadores; quem tem o id "menor" faz a oferta)
function voiceMakePC(id){
  let v = VOICE.pcs.get(id); if(v) return v;
  const pc = new RTCPeerConnection({iceServers: CONFIG.ICE_SERVERS});
  v = {pc, sender:null, audio:null, gain:null, pan:null, an:null, level:0, made:performance.now()};
  VOICE.pcs.set(id, v);
  pc.onicecandidate = e=>{ if(e.candidate) voiceSignalOut(id, {ice:e.candidate.toJSON ? e.candidate.toJSON() : e.candidate}); };
  pc.ontrack = e=>{
    audioInit();
    const stream = e.streams[0] || new MediaStream([e.track]);
    // o Chrome só manda áudio WebRTC pro WebAudio se ele também estiver num <audio> (mudo)
    v.audio = new Audio(); v.audio.srcObject = stream; v.audio.muted = true; v.audio.play().catch(()=>{});
    const src = AC.createMediaStreamSource(stream);
    v.gain = AC.createGain(); v.gain.gain.value = 0;
    v.pan = AC.createStereoPanner ? AC.createStereoPanner() : null;
    v.an = AC.createAnalyser(); v.an.fftSize = 256;
    src.connect(v.an); src.connect(v.gain);
    if(v.pan){ v.gain.connect(v.pan); v.pan.connect(AC.destination); } else v.gain.connect(AC.destination);
  };
  pc.onconnectionstatechange = ()=>{ if(['failed','closed'].includes(pc.connectionState)) voiceDrop(id); };
  return v;
}
function voiceDrop(id){
  const v = VOICE.pcs.get(id); if(!v) return;
  try{ v.pc.close(); }catch(e){}
  try{ v.gain && v.gain.disconnect(); v.pan && v.pan.disconnect(); }catch(e){}
  if(v.audio){ v.audio.srcObject = null; }
  VOICE.pcs.delete(id);
}
function voiceDropAll(){ [...VOICE.pcs.keys()].forEach(voiceDrop); }
async function voiceCall(id){
  const v = voiceMakePC(id);
  const tr = v.pc.addTransceiver('audio', {direction:'sendrecv'});
  v.sender = tr.sender;
  if(VOICE.track) await v.sender.replaceTrack(VOICE.track).catch(()=>{});
  const offer = await v.pc.createOffer(); await v.pc.setLocalDescription(offer);
  voiceSignalOut(id, {sdp:v.pc.localDescription.toJSON ? v.pc.localDescription.toJSON() : {type:offer.type, sdp:offer.sdp}});
}
async function voiceSignalIn(from, d){
  if(!d || typeof RTCPeerConnection==='undefined') return;
  try{
    if(d.sdp){
      if(d.sdp.type==='offer'){
        if(VOICE.pcs.has(from)) voiceDrop(from);  // conexão nova substitui a velha
        const v = voiceMakePC(from);
        await v.pc.setRemoteDescription(d.sdp);
        const tr = v.pc.getTransceivers()[0];
        if(tr){ tr.direction = 'sendrecv'; v.sender = tr.sender; if(VOICE.track) await v.sender.replaceTrack(VOICE.track).catch(()=>{}); }
        const ans = await v.pc.createAnswer(); await v.pc.setLocalDescription(ans);
        voiceSignalOut(from, {sdp:v.pc.localDescription.toJSON ? v.pc.localDescription.toJSON() : {type:ans.type, sdp:ans.sdp}});
        (v.pending||[]).forEach(c=>v.pc.addIceCandidate(c).catch(()=>{})); v.pending = null;
      } else if(d.sdp.type==='answer'){
        const v = VOICE.pcs.get(from); if(v) { await v.pc.setRemoteDescription(d.sdp); (v.pending||[]).forEach(c=>v.pc.addIceCandidate(c).catch(()=>{})); v.pending = null; }
      }
    } else if(d.ice){
      let v = VOICE.pcs.get(from);
      if(!v){ v = voiceMakePC(from); }
      if(!v.pc.remoteDescription){ (v.pending = v.pending||[]).push(d.ice); return; }
      await v.pc.addIceCandidate(d.ice).catch(()=>{});
    }
  }catch(err){ console.warn('voz: sinalização falhou', err); }
}
// manda o "convite" pro outro jogador passando pelo host
function voiceSignalOut(to, d){
  if(NET.mode==='host') netSendTo(to, {t:'rtc', from:NET.myId, d});
  else if(NET.mode==='client') netSend({t:'rtc', to, d});
}
// o host recebe: se é pra ele, processa; senão, repassa
function hostRtc(from, m){
  if(m.to===NET.myId || m.to==='host') voiceSignalIn(from, m.d);
  else netSendTo(m.to, {t:'rtc', from, d:m.d});
}

// ---- volume por proximidade (todo frame)
function voiceListenerPos(){ return {x:localPlayer.pos.x, z:localPlayer.pos.z, inF:localPlayer.inFacility, alive:localPlayer.alive}; }
function voiceTick(dt){
  if(NET.mode==='off'){ if(VOICE.pcs.size) voiceDropAll(); return; }
  if(typeof RTCPeerConnection==='undefined') return;
  // 1) liga com quem ainda não tem conexão
  VOICE.syncT = (VOICE.syncT||0) - dt;
  if(VOICE.syncT <= 0){
    VOICE.syncT = 1.5;
    const ids = new Set(NET.peers.keys());
    if(NET.mode==='client') ids.add('host');
    ids.forEach(id=>{
      if(id===NET.myId) return;
      const v = VOICE.pcs.get(id);
      if(!v && String(NET.myId) < String(id)) voiceCall(id).catch(e=>console.warn('voz', e));
      // conexão que nunca completou: tenta de novo
      if(v && String(NET.myId) < String(id) && v.pc.connectionState!=='connected' && performance.now()-v.made > 15000){ voiceDrop(id); }
    });
    VOICE.pcs.forEach((v,id)=>{ if(!ids.has(id)) voiceDrop(id); });
    if(voiceMode()==='aberto' && VOICE.micState==='off') voiceEnsureMic();
  }
  // 2) volume e lado de cada um
  const me = voiceListenerPos();
  const fx = -Math.sin(localPlayer.yaw), fz = -Math.cos(localPlayer.yaw);
  const rx = -fz, rz = fx; // vetor "direita" (fx,fz girado)
  const buf = new Uint8Array(128);
  VOICE.pcs.forEach((v,id)=>{
    if(!v.gain) return;
    const p = id==='host' ? (NET.peers.get('host')) : NET.peers.get(id);
    let g = 0, pan = 0;
    if(!gameStarted || !p){ g = 0.8; }
    else {
      const dx = p.pos.x - me.x, dz = p.pos.z - me.z, d = Math.hypot(dx, dz);
      if(!me.alive) g = 0.9;                                    // morto ouve todo mundo
      else if(!p.alive) g = 0;                                  // vivo não ouve os mortos
      else if(S.phase==='orbit' || (isInsideShip(p.pos.x,p.pos.z) && isInsideShip(me.x,me.z))) g = 1;
      else if(p.inFacility !== me.inF) g = 0;                   // paredes da instalação
      else g = Math.pow(clamp(1 - d/(me.inF ? 22 : 35), 0, 1), 1.4);
      if(d > 0.5) pan = clamp((dx*rx + dz*rz)/d, -1, 1)*0.7;
    }
    g *= (SET.voiceVolume ?? 1);
    v.gain.gain.setTargetAtTime(g, AC.currentTime, 0.08);
    if(v.pan) v.pan.pan.setTargetAtTime(pan, AC.currentTime, 0.08);
    if(v.an){ v.an.getByteTimeDomainData(buf); let s = 0; for(let i=0;i<buf.length;i++){ const x = (buf[i]-128)/128; s += x*x; } v.level = Math.sqrt(s/buf.length); }
    if(p && p.avatar) voiceMarkAvatar(p, v.level > 0.03 && g > 0.02);
  });
  // 3) minha voz: nível e barulho que atrai monstros
  if(VOICE.an && VOICE.talking){
    const b = new Uint8Array(256); VOICE.an.getByteTimeDomainData(b); let s = 0; for(let i=0;i<b.length;i++){ const x=(b[i]-128)/128; s += x*x; }
    VOICE.level = Math.sqrt(s/b.length);
  } else VOICE.level = 0;
  VOICE.noiseT -= dt;
  if(VOICE.level > 0.04 && VOICE.noiseT <= 0 && S.phase==='moon' && localPlayer.alive){
    VOICE.noiseT = 0.6;
    makeNoise(localPlayer.pos.x, localPlayer.pos.z, 8 + VOICE.level*60, localPlayer.inFacility);
  }
  voiceHud();
}
function voiceMarkAvatar(p, on){
  let ic = p.avatar.userData.voiceIcon;
  if(!ic){
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    g.fillStyle = '#8fd3ff'; g.beginPath(); g.moveTo(10,24); g.lineTo(22,24); g.lineTo(36,12); g.lineTo(36,52); g.lineTo(22,40); g.lineTo(10,40); g.fill();
    g.strokeStyle = '#8fd3ff'; g.lineWidth = 4; [12,20].forEach(r=>{ g.beginPath(); g.arc(36,32,r,-0.8,0.8); g.stroke(); });
    ic = new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c), transparent:true, depthTest:false}));
    ic.scale.set(0.3,0.3,1); ic.position.y = 2.25; p.avatar.add(ic); p.avatar.userData.voiceIcon = ic;
  }
  ic.visible = on;
}
const voiceHudEl = document.createElement('div'); voiceHudEl.id = 'voiceHud'; document.body.appendChild(voiceHudEl);
function voiceHud(){
  if(NET.mode==='off' || !gameStarted){ voiceHudEl.style.display = 'none'; return; }
  voiceHudEl.style.display = 'block';
  const mode = voiceMode();
  let txt;
  if(mode==='desligado') txt = '🔇 voz desligada';
  else if(VOICE.micState==='negado') txt = '🎙✖ sem microfone';
  else if(VOICE.talking) txt = VOICE.level > 0.03 ? '🎙 FALANDO' : '🎙 microfone aberto';
  else txt = mode==='ptt' ? `🎙 segure ${touchEnabled() ? 'o botão 🎙' : keyName(SET.keys.falar)} pra falar` : '🎙 ...';
  const n = [...VOICE.pcs.values()].filter(v=>v.pc.connectionState==='connected').length;
  voiceHudEl.textContent = txt + (n ? `  ·  ${n} na voz` : '');
  voiceHudEl.classList.toggle('talking', VOICE.talking && VOICE.level > 0.03);
}

// ============================================================ SALA (código, convite, quem está nela)
function inviteLink(){
  if(!NET.room || location.protocol==='file:') return '';
  let host = location.host, proto = location.protocol;
  const sv = (typeof MENU!=='undefined' && MENU.server) || null;
  if(NET.kind==='lan' && sv){
    if(/^(localhost|127\.)/.test(location.hostname) && sv.ips && sv.ips.length) host = sv.ips[0] + ':' + (location.port || sv.porta);
    // com https os amigos já conseguem usar o microfone
    if(sv.portaHttps && proto==='http:'){ proto = 'https:'; host = host.replace(/:\d+$/, '') + ':' + sv.portaHttps; }
  }
  return `${proto}//${host}${location.pathname}?sala=${NET.room}`;
}
function copyInvite(){
  const link = inviteLink() || NET.room;
  const ok = ()=>toast('Copiado! Mande pros amigos.');
  if(navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(link).then(ok).catch(()=>prompt('Copie o link:', link));
  else prompt('Copie o link:', link);
}
function roomPlayersHtml(){
  const list = [`${escapeHtml(NET.mode==='host' ? playerNick()+' (host, você)' : playerNick()+' (você)')}`];
  NET.peers.forEach((p,id)=>list.push(escapeHtml(p.name + (id==='host'?' (host)':'')) + (p.alive===false && S.phase==='moon' ? ' ☠' : '')));
  return list.map(n=>`<li>${n}</li>`).join('');
}
function roomInfoHtml(){
  const link = inviteLink();
  return `<div class="roomCode">${NET.room || '...'}</div>
    <p class="small">${NET.kind==='lan' ? 'Amigos na mesma rede: MULTIPLAYER → ENTRAR → digitam o código.' : 'Amigos (de qualquer lugar): MULTIPLAYER → ENTRAR → digitam o código.'}</p>
    ${link ? `<p class="small linkTxt">${escapeHtml(link)}</p><button class="sm" onclick="event.stopPropagation();copyInvite()">copiar link de convite</button>` : ''}
    <h3>Tripulantes (${1 + NET.peers.size}/4)</h3><ul class="crew">${roomPlayersHtml()}</ul>`;
}
function showRoomCreated(){
  showBig(`<h1>SALA CRIADA!</h1><p>Passe este código pros seus amigos:</p>${roomInfoHtml()}
    <p class="small">Você pode ver o código de novo a qualquer hora apertando Esc.</p>`, 'COMEÇAR');
  chatSystem(`Sala ${NET.room} criada. Esperando tripulantes...`);
}
// etiqueta no canto da tela + bloco no menu de pausa
const roomTagEl = document.createElement('div'); roomTagEl.id = 'roomTag'; document.body.appendChild(roomTagEl);
const pauseRoomEl = document.createElement('div'); pauseRoomEl.id = 'pauseRoom';
pauseRoomEl.addEventListener('click', e=>e.stopPropagation());
(function(){ const inner = document.querySelector('#pause .inner'); if(inner) inner.insertBefore(pauseRoomEl, inner.firstChild.nextSibling); })();
setInterval(()=>{
  const on = NET.mode!=='off' && gameStarted;
  roomTagEl.style.display = on ? 'block' : 'none';
  if(on) roomTagEl.textContent = `SALA ${NET.room||'...'} · ${1 + NET.peers.size}/4`;
  const pv = document.getElementById('pause').style.display==='flex';
  if(pv){ const k = document.querySelector('#pause .keys'); if(k){ const h = keysHelp(); if(k._h!==h){ k._h = h; k.innerHTML = h; } } }
  pauseRoomEl.style.display = on ? 'block' : 'none';
  if(on && pv){ const h = roomInfoHtml(); if(pauseRoomEl._h !== h){ pauseRoomEl._h = h; pauseRoomEl.innerHTML = h; } }
}, 500);
// (o link de convite ?sala=CODIGO é tratado no fim do 16-menu.js)
