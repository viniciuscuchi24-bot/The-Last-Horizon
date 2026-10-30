/*
 * ============================================================================
 *  17-net.js — MULTIPLAYER (até 4 jogadores)
 * ============================================================================
 *  Modelo "host autoritativo": o computador de quem criou a sala simula TUDO
 *  (criaturas, armadilhas, relógio, itens, cota). Os outros jogadores mandam
 *  a posição deles e os pedidos (pegar item, abrir porta, puxar alavanca...),
 *  e recebem 10 "fotos" por segundo do mundo (snapshot).
 *
 *  Duas formas de conectar (mesmas mensagens nas duas):
 *   - LAN: servidor/servidor.js (Node) roda no PC do host, serve o jogo e
 *     repassa as mensagens por WebSocket. Todos abrem http://IP-DO-HOST:8080
 *   - Online: WebRTC direto entre os navegadores usando PeerJS (precisa de
 *     internet; o servidor público do PeerJS só apresenta os jogadores).
 *
 *  A lua é gerada com a mesma "semente" em todos os computadores, então o
 *  mapa é idêntico sem precisar mandar o mapa inteiro pela rede.
 * ============================================================================
 */

const NET = {mode:'off', kind:null, tr:null, myId:'host', room:null, peers:new Map(), snapT:0, stT:0, sfxBudget:0, given:{}, lastLand:null};
const MAX_PLAYERS = 4;
const PEERJS_URL = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';

function netStatus(msg){ const el = document.getElementById('netStatus'); if(el) el.textContent = msg; }
function netSend(msg){ if(NET.mode==='client' && NET.tr) NET.tr.toHost(msg); }
function netBroadcast(msg, except){ if(NET.mode==='host' && NET.tr) NET.tr.broadcast(msg, except); }
function netSendTo(id, msg){ if(NET.mode==='host' && NET.tr) NET.tr.sendTo(id, msg); }

// ================================================================== TRANSPORTES
// LAN: WebSocket com o servidor/servidor.js
function lanTransport(onEvent){
  const ws = new WebSocket((location.protocol==='https:'?'wss://':'ws://') + location.host + '/ws');
  const tr = {
    ws,
    send(o){ if(ws.readyState===1) ws.send(JSON.stringify(o)); },
    toHost(data){ tr.send({op:'send', to:'host', data}); },
    sendTo(id, data){ tr.send({op:'send', to:id, data}); },
    broadcast(data, except){ tr.send({op:'send', to:'*', except, data}); },
    close(){ try{ ws.close(); }catch(e){} },
  };
  ws.onopen = ()=>onEvent('open');
  ws.onclose = ()=>onEvent('closed');
  ws.onerror = ()=>onEvent('error');
  ws.onmessage = ev=>{ let m; try{ m = JSON.parse(ev.data); }catch(e){ return; } onEvent('server', m); };
  return tr;
}
// Online: PeerJS (WebRTC)
function loadPeerJS(cb){
  if(window.Peer) return cb();
  const s = document.createElement('script'); s.src = PEERJS_URL; s.onload = cb;
  s.onerror = ()=>{ netStatus('Não consegui carregar o PeerJS (sem internet?)'); toast('Sem internet pro modo online'); };
  document.head.appendChild(s);
}
function makeRoomCode(){ const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c = ''; for(let i=0;i<5;i++) c += L[Math.floor(GR()*L.length)]; return c; }

// ================================================================== CRIAR / ENTRAR
function netHostLan(name){
  NET.mode = 'host'; NET.kind = 'lan'; NET.myId = 'host'; NET.peers.clear();
  NET.tr = lanTransport((ev, m)=>{
    if(ev==='open') NET.tr.send({op:'host', name:name+' (The Last Horizon)'});
    if(ev==='closed' || ev==='error'){ if(NET.mode==='host'){ toast('Conexão com o servidor LAN caiu'); netLeave(); } }
    if(ev==='server'){
      if(m.op==='hosted'){ NET.room = m.room; showRoomCreated(); buildTouchUI(); }
      if(m.op==='peer-join') hostPeerJoin(m.id, m.name);
      if(m.op==='peer-leave') hostPeerLeave(m.id);
      if(m.op==='msg') hostOnMessage(m.from, m.data);
    }
  });
}
function netJoinLan(room, name){
  netStatus('Conectando...');
  NET.mode = 'client'; NET.kind = 'lan'; NET.room = room;
  NET.tr = lanTransport((ev, m)=>{
    if(ev==='open') NET.tr.send({op:'join', room, name});
    if(ev==='closed' || ev==='error'){ if(NET.mode==='client'){ clientLostHost('Conexão perdida'); } }
    if(ev==='server'){
      if(m.op==='joined'){ NET.myId = m.id; netSend({t:'hello', name}); }
      if(m.op==='error'){ netStatus(m.msg + (m.msg.includes('encontrada') ? ' — confira o código' : '')); toast(m.msg); NET.mode = 'off'; try{ NET.tr.close(); }catch(e){} NET.tr = null; }
      if(m.op==='host-left') clientLostHost('O host saiu da sala');
      if(m.op==='msg') clientOnMessage(m.data);
    }
  });
}
function netHostOnline(name){
  loadPeerJS(()=>{
    const code = makeRoomCode();
    NET.mode = 'host'; NET.kind = 'online'; NET.myId = 'host'; NET.peers.clear(); NET.room = code;
    const peer = new Peer('tlh-'+code, {config:{iceServers:CONFIG.ICE_SERVERS}});
    const conns = new Map();
    NET.tr = {
      peer, conns,
      sendTo(id, data){ const c = conns.get(id); if(c && c.open) c.send(data); },
      broadcast(data, except){ conns.forEach((c,id)=>{ if(id!==except && c.open) c.send(data); }); },
      close(){ try{ peer.destroy(); }catch(e){} },
    };
    peer.on('open', ()=>{ showRoomCreated(); buildTouchUI(); });
    peer.on('error', e=>{ toast('Erro no modo online: '+(e.type||e)); });
    peer.on('connection', conn=>{
      conn.on('open', ()=>{ if(NET.peers.size >= MAX_PLAYERS-1){ conn.send({t:'full'}); setTimeout(()=>conn.close(), 300); return; } conns.set(conn.peer, conn); });
      conn.on('data', d=>{ if(d && d.t==='hello' && !NET.peers.has(conn.peer)) hostPeerJoin(conn.peer, d.name); hostOnMessage(conn.peer, d); });
      conn.on('close', ()=>{ conns.delete(conn.peer); hostPeerLeave(conn.peer); });
    });
  });
}
function netJoinOnline(code, name){
  netStatus('Conectando...');
  loadPeerJS(()=>{
    NET.mode = 'client'; NET.kind = 'online'; NET.room = code;
    const peer = new Peer({config:{iceServers:CONFIG.ICE_SERVERS}});
    peer.on('error', e=>{ netStatus('Não achei a sala '+code+' ('+(e.type||'erro')+')'); toast('Sala não encontrada'); NET.mode = 'off'; });
    peer.on('open', id=>{
      NET.myId = id;
      const conn = peer.connect('tlh-'+code, {reliable:true});
      NET.tr = { peer, conn, toHost(d){ if(conn.open) conn.send(d); }, close(){ try{ peer.destroy(); }catch(e){} } };
      conn.on('open', ()=>conn.send({t:'hello', name}));
      conn.on('data', d=>{ if(d && d.t==='full'){ toast('Sala cheia'); netLeave(); return; } clientOnMessage(d); });
      conn.on('close', ()=>clientLostHost('O host saiu da sala'));
    });
  });
}
function netLeave(){
  if(typeof voiceDropAll==='function'){ voiceDropAll(); closeChat(); }
  if(NET.tr) NET.tr.close();
  NET.peers.forEach(p=>removeAvatar(p));
  NET.peers.clear(); NET.tr = null; NET.mode = 'off'; NET.room = null;
  clientProxies.forEach(c=>{ if(c.visual.parent) c.visual.parent.remove(c.visual); }); clientProxies.clear();
}
function clientLostHost(msg){
  if(NET.mode!=='client') return;
  netLeave(); toast(msg, 5);
  if(gameStarted){ gameStarted = false; stopAllLoops(); S.phase = 'orbit'; loadOrbit(); menuShow('main'); }
}

// ================================================================== JOGADORES REMOTOS
function makeRemotePlayer(id, name){
  return {id, name, isRemote:true, pos:new THREE.Vector3(), target:new THREE.Vector3(), yaw:0, pitch:0, inFacility:false, alive:true, crouch:false,
    vel:new THREE.Vector2(), grounded:true, moving:false, latched:null, grabbedBy:null, inv:[null], slot:0, hp:100, flash:false, avatar:null, _dmg:0, _cause:''};
}
function makeAvatar(name){
  const g = new THREE.Group();
  const suit = new THREE.MeshStandardMaterial({color:0xc8611e, roughness:0.85});
  [-0.13,0.13].forEach(x=>{ const l = box(0.18, 0.85, 0.2, suit, x, 0.43, 0); l.name='leg'; g.add(l); });
  g.add(box(0.55, 0.75, 0.32, suit, 0, 1.25, 0)); g.add(box(0.45, 0.5, 0.2, MAT.dark, 0, 1.3, 0.25));
  [-0.35,0.35].forEach(x=>{ const a = box(0.13, 0.8, 0.13, suit, x, 1.15, 0); a.name='arm'; g.add(a); });
  g.add(sph(0.24, new THREE.MeshStandardMaterial({color:0xd0d4d8, metalness:0.4, roughness:0.4}), 0, 1.86, 0));
  const visor = sph(0.16, new THREE.MeshStandardMaterial({color:0x4ab0ff, emissive:0x2080c0, emissiveIntensity:1.2, roughness:0.2}), 0, 1.88, -0.1); visor.scale.set(1,0.7,0.8); g.add(visor);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(1.4, 8, 12, 1, true), new THREE.MeshBasicMaterial({color:0xfff0c0, transparent:true, opacity:0.06, depthWrite:false, side:THREE.DoubleSide}));
  beam.rotation.x = Math.PI/2; beam.position.set(0, 1.7, -4.2); beam.name = 'beam'; beam.visible = false; g.add(beam);
  // nome em cima da cabeça
  const cvs = document.createElement('canvas'); cvs.width = 256; cvs.height = 48; const c2 = cvs.getContext('2d');
  c2.font = 'bold 30px monospace'; c2.textAlign = 'center'; c2.fillStyle = 'rgba(0,0,0,.5)'; c2.fillRect(0,0,256,48); c2.fillStyle = '#ffb070'; c2.fillText(name.slice(0,14), 128, 34);
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cvs), transparent:true, depthTest:false}));
  tag.scale.set(1.2, 0.22, 1); tag.position.y = 2.35; g.add(tag);
  wrapLimbs(g);
  return g;
}
function ensureAvatar(p){ if(!p.avatar){ p.avatar = makeAvatar(p.name); } if(levelRoot && p.avatar.parent!==levelRoot) addToLevel(p.avatar); return p.avatar; }
function removeAvatar(p){ if(p.avatar && p.avatar.parent) p.avatar.parent.remove(p.avatar); p.avatar = null; }
function animateAvatar(p, dt){
  const av = ensureAvatar(p);
  // fica invisível se estiver em outro "andar" (dentro x fora) ou morto
  av.visible = p.alive && (p.inFacility === localPlayer.inFacility);
  const k = Math.min(1, dt*12);
  const ox = p.pos.x, oz = p.pos.z;
  p.pos.lerp(p.target, k);
  const sp = Math.hypot(p.pos.x-ox, p.pos.z-oz)/Math.max(dt,1e-4);
  p.moving = sp > 0.4;
  av.position.copy(p.pos); av.rotation.y = p.yaw;
  av.scale.y = p.crouch ? 0.7 : 1;
  const beam = av.getObjectByName('beam'); if(beam) beam.visible = !!p.flash;
  p._anim = (p._anim||0) + (p.moving ? dt*9 : 0);
  let n = 0; av.traverse(o=>{ if(o.name==='leg') o.rotation.x = p.moving ? Math.sin(p._anim + (n++%2)*Math.PI)*0.5 : 0; if(o.name==='arm') o.rotation.x = p.moving ? Math.sin(p._anim + Math.PI + (n++%2)*Math.PI)*0.35 : 0; });
  if(p.moving && av.visible){ p._step = (p._step||0) - dt*sp; if(p._step <= 0){ p._step = 1.7; sfx('step', {x:p.pos.x, z:p.pos.z, inFacility:p.inFacility}, 0.5, 25, true); } }
}

// participantes (pra IA das criaturas): o jogador local + os remotos
function netParticipants(){
  const arr = [localPlayer];
  if(NET.mode==='host') NET.peers.forEach(p=>arr.push(p));
  return arr;
}
function netPickTarget(c){
  if(NET.mode!=='host' || !NET.peers.size) return localPlayer;
  let best = null, bd = Infinity;
  for(const p of netParticipants()){
    if(!p.alive || p.inFacility !== c.inFacility) continue;
    // quem já está agarrando/grudado em alguém continua focado nele
    if(p.grabbedBy===c || p.latched===c) return p;
    const d = Math.hypot(p.pos.x-c.pos.x, p.pos.z-c.pos.z);
    if(d < bd){ bd = d; best = p; }
  }
  return best || localPlayer;
}
function netNearestTo(x, z, inF){
  if(NET.mode!=='host' || !NET.peers.size) return localPlayer;
  let best = localPlayer, bd = (localPlayer.alive && localPlayer.inFacility===inF) ? Math.hypot(localPlayer.pos.x-x, localPlayer.pos.z-z) : Infinity;
  NET.peers.forEach(p=>{ if(!p.alive || p.inFacility!==inF) return; const d = Math.hypot(p.pos.x-x, p.pos.z-z); if(d < bd){ bd = d; best = p; } });
  return best;
}
// dano em jogador remoto (o host acumula e manda junto com o snapshot)
function netDamageRemote(p, amount, cause, kill){
  if(!p.alive) return;
  if(kill){ p.alive = false; netSendTo(p.id, {t:'kill', c:cause}); sfx('kill', {x:p.pos.x, z:p.pos.z, inFacility:p.inFacility}); checkAllDead(); return; }
  if(p.invuln > 0) return;
  p._dmg += amount; p._cause = cause;
  p.hp -= amount; if(p.hp <= 0){ p.hp = 0; }
}
function checkAllDead(){
  if(NET.mode!=='host') return;
  if(S.phase!=='moon' || transitioning) return;
  const anyAlive = localPlayer.alive || [...NET.peers.values()].some(p=>p.alive);
  if(!anyAlive){ document.getElementById('spectate').style.display='none'; crewWipe(); }
}

// ================================================================== HOST
function hostPeerJoin(id, name){
  if(NET.peers.has(id)) return;
  if(NET.peers.size >= MAX_PLAYERS-1){ netSendTo(id, {t:'full'}); return; }
  const p = makeRemotePlayer(id, name || 'Tripulante');
  p.pos.set(SHIP.x+1, SHIP.floorY, SHIP.z); p.target.copy(p.pos);
  NET.peers.set(id, p);
  toast(`${p.name} entrou na nave`); chatSystem(`${p.name} entrou na sala`); netBroadcast({t:'sys', txt:`${p.name} entrou na sala`}, id);
  netSendTo(id, {t:'welcome', id, S:netStateS(), w:S.weather, disc:[...S.discovered]});
  if(S.phase==='moon' && S.moon) netSendTo(id, {t:'land', m:S.moon.id, seed:S.levelSeed, w:S.weather, now:true});
}
function hostPeerLeave(id){
  const p = NET.peers.get(id); if(!p) return;
  // o que ele carregava cai no chão
  (p.carried||[]).forEach(o=>{ const it = deserItem(o); if(it) placeItemInWorld(it, p.pos.x, groundAt(p.pos.x,p.pos.z,p.inFacility), p.pos.z, p.inFacility); });
  removeAvatar(p); NET.peers.delete(id);
  toast(`${p.name} saiu da sala`); chatSystem(`${p.name} saiu da sala`); netBroadcast({t:'sys', txt:`${p.name} saiu da sala`});
  if(typeof voiceDrop==='function') voiceDrop(id);
  checkAllDead();
}
function netOnLand(moon, seed){ if(NET.mode==='host') netBroadcast({t:'land', m:moon.id, seed, w:S.weather}); }
function netOnTakeOff(reason){
  if(NET.mode!=='host') return;
  // quem ficou fora da nave à meia-noite morre
  NET.peers.forEach(p=>{ if(p.alive && (p.inFacility || !isInsideShip(p.pos.x, p.pos.z))){ if(reason==='midnight'){ p.alive = false; netSendTo(p.id, {t:'kill', c:'Deixado para trás'}); } } });
  netBroadcast({t:'takeoff', reason});
  localPlayer.alive = true; localPlayer.hp = CONFIG.PLAYER.maxHp; hideSpectate();
  NET.peers.forEach(p=>{ p.alive = true; p.hp = 100; p.latched = null; p.grabbedBy = null; p.inFacility = false; });
}
function netOnWipe(lost, fine){ if(NET.mode==='host'){ netBroadcast({t:'wipe', lost, fine}); NET.peers.forEach(p=>{ p.alive = true; p.hp = 100; p.inFacility = false; }); } }
function netBroadcastBig(html){ if(NET.mode==='host') netBroadcast({t:'big', html}); }
function netOnLocalDeath(cause){
  if(NET.mode==='client'){ netSend({t:'act', a:'dead', cause}); showSpectate(); return true; }
  if(NET.mode==='host'){ const anyAlive = [...NET.peers.values()].some(p=>p.alive); if(anyAlive){ showSpectate(); return true; } }
  return false;
}
function showSpectate(){ document.getElementById('spectate').style.display = 'flex'; }
function hideSpectate(){ document.getElementById('spectate').style.display = 'none'; }

// som compartilhado: o host repassa sons com posição (criaturas, portas, tiros...)
function netShareSfx(name, pos, vol, maxDist){
  if(NET.mode==='off' || !pos) return;
  if(['step','stepMetal'].includes(name)) return;
  if(NET.sfxBudget <= 0) return; NET.sfxBudget--;
  const msg = {t:'sfx', n:name, x:+pos.x.toFixed(1), z:+pos.z.toFixed(1), f:pos.inFacility===undefined?null:!!pos.inFacility, v:vol, m:maxDist};
  if(NET.mode==='host') netBroadcast(msg); else netSend(msg);
}

// marcas de tinta spray aparecem pra todo mundo
function netShareDecal(point, n){
  const msg = {t:'decal', p:[r2(point.x), r2(point.y), r2(point.z)], n:[r2(n.x), r2(n.y), r2(n.z)]};
  if(NET.mode==='host') netBroadcast(msg); else if(NET.mode==='client') netSend(msg);
}
function netStateS(){
  return {cr:S.credits, q:S.quota, qi:S.quotaIndex, so:S.soldThisQuota, d:S.daysLeft, dt:+S.dayTime.toFixed(1), ph:S.phase, pw:S.powerOn?1:0, sd:S.shipDoorOpen?1:0, rt:S.routeMoon, ap:S.apparatusTaken?1:0};
}
function hostSnapshot(){
  const P = [[NET.myId, playerNick(), r2(localPlayer.pos.x), r2(localPlayer.pos.y), r2(localPlayer.pos.z), r2(localPlayer.yaw), r2(localPlayer.pitch), localPlayer.inFacility?1:0, localPlayer.crouch?1:0, localPlayer.alive?1:0, flashOn(localPlayer)?1:0, 0, null, 0]];
  NET.peers.forEach(p=>P.push([p.id, p.name, r2(p.pos.x), r2(p.pos.y), r2(p.pos.z), r2(p.yaw), r2(p.pitch), p.inFacility?1:0, p.crouch?1:0, p.alive?1:0, p.flash?1:0, p.latched?1:0, p.grabbedBy?p.grabbedBy.type:null, p.grabbedBy?r2(p.grabbedBy.pos.y):0]));
  const C = creatures.filter(c=>c.alive).map(c=>[c.nid, c.type, r2(c.pos.x), r2(c.pos.y), r2(c.pos.z), r2(c.yaw), c.state, c.visual.visible?1:0, c.type==='verme'?r2(c.visual.position.y):(c.stun>0?1:0), c.moving?1:0]);
  const I = worldItems.filter(it=>!it.carriedBy).map(it=>[it.uid, it.kind, it.def.id, it.value, r2(it.pos.x), r2(it.pos.y), r2(it.pos.z), it.inFacility?1:0, it.busy?1:0]);
  // itens carregados por criaturas (Juntador) também aparecem
  creatures.forEach(c=>{ if(c.carrying && c.carrying.mesh) I.push([c.carrying.uid, c.carrying.kind, c.carrying.def.id, c.carrying.value, r2(c.pos.x), 1.05, r2(c.pos.z), 1, 1]); });
  const msg = {t:'snap', S:netStateS(), P, C, I};
  if(FAC.doors) msg.D = FAC.doors.map(d=>(d.open?1:0) + (d.locked?2:0)).join('');
  if(traps.length) msg.T = traps.map(t=>[t.type==='turret'?r2(t.aim):0, t.state, t.type==='crusher'?r2(t.y):0, t.off>0?1:0]);
  if(FAC.webs) msg.W = FAC.webs.map(w=>[w.i, w.j]);
  return msg;
}
function r2(v){ return Math.round(v*100)/100; }
function flashOn(pl){ return pl.inv.some(it=>it && it.def && it.def.battery && it.on); }

function hostOnMessage(from, m){
  if(!m || !m.t) return;
  const p = NET.peers.get(from);
  if(m.t==='hello'){ if(!p) hostPeerJoin(from, m.name); return; }
  if(!p) return;
  if(m.t==='st'){
    p.target.set(m.x, m.y, m.z); p.yaw = m.yaw; p.pitch = m.pi; p.crouch = !!m.cr; p.flash = !!m.fl;
    if(!!m.inF !== p.inFacility){ p.inFacility = !!m.inF; p.pos.copy(p.target); }
    if(m.al===0 && p.alive){ p.alive = false; checkAllDead(); }
    p.vel.set(m.vx||0, m.vz||0); p.grounded = !m.air;
    p.carried = m.inv || [];
    const h = m.h ? (NET.given[m.h.u] || {def:findDef(m.h.k, m.h.i), uid:m.h.u}) : null;
    p.inv = [h]; p.slot = 0;
    return;
  }
  if(m.t==='chat'){ hostChat(p, m.txt); return; }
  if(m.t==='rtc'){ hostRtc(from, m); return; }
  if(m.t==='decal'){ placeDecal(m.p, m.n); netBroadcast(m, from); return; }
  if(m.t==='sfx'){ sfx(m.n, {x:m.x, z:m.z, inFacility:m.f===null?undefined:m.f}, m.v, m.m, true); netBroadcast(m, from); return; }
  if(m.t!=='act') return;
  // executa o pedido "como se fosse" esse jogador
  player = p;
  try{ hostAction(p, m, from); }
  catch(err){ console.error('ação de rede falhou', m, err); }
  finally{ player = localPlayer; }
}
function hostAction(p, m, from){
  switch(m.a){
    case 'noise': noiseEvents.push({x:m.x, z:m.z, loud:m.loud, t:0, inFacility:!!m.inF}); break;
    case 'lever': player = localPlayer; pullLever(); break;
    case 'shipdoor': if(S.phase!=='orbit'){ S.shipDoorOpen = !S.shipDoorOpen; sfx('shipDoor', {x:SHIP.x+3.5, z:SHIP.z+3.3}); } break;
    case 'breaker': if(!S.apparatusTaken){ setPower(!S.powerOn); } break;
    case 'door': { const d = FAC.doors && FAC.doors[m.i]; if(d) interactDoor(d); break; }
    case 'unlock': { const d = FAC.doors && FAC.doors[m.i]; if(d && d.locked){ d.locked = false; d.panel.material = d.panel.material.clone(); d.panel.material.color.set(0x6e757c); openDoor(d); } break; }
    case 'lockpick': { const d = FAC.doors && FAC.doors[m.i]; const it = deserItem(m.item); if(d && it){ const px = d.x+(p.pos.x>d.x?0.9:-0.9)*(d.alongX?1:0), pz = d.z+(p.pos.z>d.z?0.9:-0.9)*(d.alongX?0:1); placeItemInWorld(it, px, 1.0, pz, true); it.busy = true; lockpicks.push({door:d, item:it, t:8}); } break; }
    case 'pickup': {
      const it = worldItems.find(w=>w.uid===m.uid);
      if(!it || it.busy || it.carriedBy) return;
      if(it.mimicOf){ mimicReveal(it.mimicOf); return; }
      removeItemFromWorld(it);
      if(it.def.apparatus && !S.apparatusTaken){ S.apparatusTaken = true; setPower(false); if(FAC.apparatusGlow) FAC.apparatusGlow.intensity = 0; sfx('alarm', {x:it.pos.x, z:it.pos.z, inFacility:true}, 0.6); }
      NET.given[it.uid] = it;
      netSendTo(from, {t:'give', item:serItem(it), nest:!!it.nestOf});
      break; }
    case 'drop': { const it = deserItem(m.item); if(!it) return; const g = NET.given[it.uid]; if(g && g.nestOf) it.nestOf = g.nestOf; placeItemInWorld(it, m.x, m.y, m.z, !!m.inF); break; }
    case 'desk': { const it = deserItem(m.item); if(!it || !SELL_DESK) return; const k = SELL_DESK.items.length; placeItemInWorld(it, SELL_DESK.x-3.5+(k%10)*0.7, SELL_DESK.y, SELL_DESK.z+(Math.floor(k/10)%2)*0.6-0.3, false); it.onDesk = true; SELL_DESK.items.push(it); break; }
    case 'bell': player = localPlayer; ringBell(); break;
    case 'term': player = localPlayer; runCommand(m.raw, true); updateHud(); break;
    case 'hurt': { const c = creatures.find(c=>c.nid===m.nid); if(c) hurtCreature(c, m.dmg, p.pos); break; }
    case 'stun': { const c = creatures.find(c=>c.nid===m.nid); if(c) stunCreature(c, m.secs); break; }
    case 'reveal': { const c = creatures.find(c=>c.nid===m.nid); if(c) mimicReveal(c); break; }
    case 'struggle': { const c = p.latched; if(c) c.struggle = (c.struggle||0)+1; break; }
    case 'dead': p.alive = false; p.latched = null; p.grabbedBy = null; checkAllDead(); break;
  }
}

// ================================================================== CLIENTE
const clientProxies = new Map(); // nid -> criatura "de mentira" (só visual)
const clientItems = new Map();   // uid -> item
let lastSnap = null;
function clientOnMessage(m){
  if(!m || !m.t) return;
  switch(m.t){
    case 'welcome': {
      NET.myId = m.id; S.weather = m.w; (m.disc||[]).forEach(d=>S.discovered.add(d));
      applyNetS(m.S);
      player.inv = new Array(CONFIG.INVENTORY_SLOTS).fill(null); refreshViewModel();
      netStatus('Conectado!'); toast('Você entrou na nave do host'); beginGame(true); buildTouchUI();
      chatSystem(`Você entrou na sala ${NET.room||''}. ${keyName(SET.keys.chat)} = chat · segure ${keyName(SET.keys.falar)} = falar`);
      S.phase = 'orbit'; loadOrbit(); clearClientWorld();
      break; }
    case 'land': {
      S.weather = m.w;
      const moon = MOONS.find(x=>x.id===m.m); if(!moon) return;
      if(transitioning){ setTimeout(()=>clientOnMessage(m), 500); return; }
      hideSpectate(); localPlayer.alive = true; localPlayer.hp = CONFIG.PLAYER.maxHp;
      landOn(moon, m.seed);
      break; }
    case 'takeoff': case 'wipe': {
      const txt = m.t==='wipe' ? `<div style="color:#ff4a2a;font-size:1.3em">TODOS OS TRIPULANTES MORRERAM</div><div style="opacity:.8;margin-top:10px">A sucata a bordo foi perdida ($${m.lost}).</div>` : `<div style="font-size:1.3em;color:${CONFIG.HUD_COLOR}">${m.reason==='midnight'?'O PILOTO AUTOMÁTICO DECOLOU':'DECOLANDO'}</div>`;
      sfx('engine');
      showTransition(txt, 1500, ()=>{ stopAllLoops(); hideSpectate(); localPlayer.alive = true; localPlayer.hp = CONFIG.PLAYER.maxHp; localPlayer.latched = null; localPlayer.grabbedBy = null; setMuffled(false); S.phase = 'orbit'; loadOrbit(); clearClientWorld(); }, null);
      break; }
    case 'big': showBig(m.html, 'OK'); break;
    case 'give': {
      const it = deserItem(m.item); if(!it) return;
      if(m.nest) it.nestOf = true;
      let slot = heldItem() ? player.inv.findIndex(s=>!s) : player.slot;
      if(slot < 0){ netRelay('drop', {item:m.item, x:player.pos.x, y:groundAt(player.pos.x,player.pos.z,player.inFacility), z:player.pos.z, inF:player.inFacility}); toast('Inventário cheio'); return; }
      player.inv[slot] = it; player.slot = slot; sfx('pickup'); refreshViewModel(); updateHud();
      if(it.kind==='scrap') S.stats.scrapCollected++;
      break; }
    case 'dmg': if(localPlayer.alive){ damagePlayer(m.a, m.c); } break;
    case 'kill': if(localPlayer.alive){ killPlayer(m.c); } break;
    case 'sfx': sfx(m.n, {x:m.x, z:m.z, inFacility:m.f===null?undefined:m.f}, m.v, m.m, true); break;
    case 'toast': toast(m.msg); break;
    case 'chat': addChatLine(m.n, m.txt); break;
    case 'sys': chatSystem(m.txt); break;
    case 'rtc': voiceSignalIn(m.from, m.d); break;
    case 'decal': placeDecal(m.p, m.n); break;
    case 'snap': lastSnap = m; applySnapshot(m); break;
  }
}
function applyNetS(s){
  S.credits = s.cr; S.quota = s.q; S.quotaIndex = s.qi; S.soldThisQuota = s.so; S.daysLeft = s.d; S.routeMoon = s.rt;
  if(S.phase==='moon'){ S.dayTime = s.dt; if(s.pw !== (S.powerOn?1:0) && FAC.cellLamps) setPower(!!s.pw); S.apparatusTaken = !!s.ap; }
  S.shipDoorOpen = !!s.sd;
}
function clearClientWorld(){
  worldItems.slice().forEach(removeItemFromWorld); worldItems = []; clientItems.clear();
  creatures.forEach(c=>{ if(c.visual && c.visual.parent) c.visual.parent.remove(c.visual); if(c.fakeItem) removeItemFromWorld(c.fakeItem); });
  creatures = []; clientProxies.clear();
  NET.peers.forEach(p=>removeAvatar(p));
}
function netAfterBuild(){
  if(NET.mode!=='client') return;
  clearClientWorld();
  // no cliente, as criaturas e armadilhas só são "desenhadas" (quem simula é o host)
  spawnDirector.inT = spawnDirector.outT = 1e12;
}
function applySnapshot(m){
  if(!gameStarted) return;
  applyNetS(m.S);
  if(transitioning) return;
  if(m.S.ph !== S.phase) return; // ainda trocando de cenário
  // jogadores
  const seen = new Set();
  m.P.forEach(a=>{
    const [id, name, x, y, z, yaw, pitch, inF, cr, al, fl, lat, grab, grabY] = a;
    if(id===NET.myId){
      // o host diz se tem algo grudado/agarrando você
      if(lat && !localPlayer.latched){ localPlayer.latched = {struggle:0, net:true}; setMuffled(true); toast('ALGO GRUDOU NA SUA CABEÇA! Aperte E várias vezes!'); }
      if(!lat && localPlayer.latched && localPlayer.latched.net){ localPlayer.latched = null; setMuffled(false); }
      localPlayer.grabbedBy = grab ? {type:grab, pos:{y:grabY}} : null;
      return;
    }
    seen.add(id);
    let p = NET.peers.get(id);
    if(!p){ p = makeRemotePlayer(id, name); p.pos.set(x,y,z); NET.peers.set(id, p); }
    p.target.set(x,y,z); p.yaw = yaw; p.pitch = pitch; p.crouch = !!cr; p.alive = !!al; p.flash = !!fl;
    if(!!inF !== p.inFacility){ p.inFacility = !!inF; p.pos.set(x,y,z); }
  });
  NET.peers.forEach((p,id)=>{ if(!seen.has(id)){ removeAvatar(p); NET.peers.delete(id); } });
  if(S.phase!=='moon' && S.phase!=='orbit') return;
  // criaturas
  const cseen = new Set();
  (m.C||[]).forEach(a=>{
    const [nid, type, x, y, z, yaw, state, vis, extra, moving] = a;
    cseen.add(nid);
    let c = clientProxies.get(nid);
    if(!c){
      const g = makeVisual('creatures', type, ()=>{ const v = CREATURE_BUILD[type](); wrapLimbs(v); return v; });
      addToLevel(g);
      c = {nid, type, def:CREATURES[type], isProxy:true, pos:new THREE.Vector3(x,y,z), target:new THREE.Vector3(x,y,z), yaw, inFacility:!!(x>FAC_ORIGIN.x-500 && z>FAC_ORIGIN.z-500), alive:true, visual:g, radius:0.5, eyeH:CREATURE_EYE[type]||1.5, state, moving:false, anim:0};
      g.traverse(o=>{ if(o.isMesh) o.userData.creature = c; });
      if(type==='mimico_sucata'){ const mouth = new THREE.Group(); mouth.name='mouth'; mouth.add(sph(0.35, new THREE.MeshStandardMaterial({color:0x6a1a1a}), 0, 0.35, 0)); g.add(mouth); }
      clientProxies.set(nid, c); creatures.push(c);
    }
    c.target.set(x,y,z); c.yaw = yaw; c.state = state; c.netVis = !!vis; c.extra = extra; c.netMoving = !!moving;
  });
  clientProxies.forEach((c,nid)=>{ if(!cseen.has(nid)){ if(c.visual.parent) c.visual.parent.remove(c.visual); clientProxies.delete(nid); creatures = creatures.filter(x=>x!==c); } });
  // itens
  const iseen = new Set();
  (m.I||[]).forEach(a=>{
    const [uid, kind, id, value, x, y, z, inF, busy] = a;
    iseen.add(uid);
    let it = clientItems.get(uid);
    if(!it){
      const def = findDef(kind, id); if(!def) return;
      it = kind==='tool' ? makeToolItem(id) : makeScrapItem(def, 1); it.uid = uid; it.value = value;
      placeItemInWorld(it, x, y, z, !!inF); clientItems.set(uid, it);
    } else if(Math.abs(it.pos.x-x)+Math.abs(it.pos.z-z)+Math.abs(it.pos.y-y) > 0.05){
      it.pos.set(x,y,z); it.inFacility = !!inF; if(it.mesh) it.mesh.position.set(x,y,z);
    }
    it.busy = !!busy;
  });
  clientItems.forEach((it,uid)=>{ if(!iseen.has(uid)){ removeItemFromWorld(it); clientItems.delete(uid); } });
  // portas
  if(m.D && FAC.doors && m.D.length===FAC.doors.length){
    for(let i=0;i<FAC.doors.length;i++){ const v = +m.D[i], d = FAC.doors[i]; const open = !!(v&1), locked = !!(v&2);
      if(d.locked && !locked){ d.panel.material = d.panel.material.clone(); d.panel.material.color.set(0x6e757c); }
      d.locked = locked; d.open = open; }
  }
  // armadilhas
  if(m.T && traps.length===m.T.length){
    m.T.forEach((a,i)=>{ const t = traps[i]; const [aim, st, y, off] = a; t.state = st; t.off = off?1:0;
      if(t.type==='turret'){ t.aim = aim; const head = t.g.getObjectByName('head'); if(head) head.rotation.y = aim; t.laser.visible = st!=='off'; t.laser.rotation.y = aim; t.laser.material.color.set(st==='fire'?0xff0000:(st==='warn'?0xff8020:0xff2020)); }
      if(t.type==='mine' && st==='done'){ t.g.visible = false; t.led.visible = false; if(t.codeSprite) t.codeSprite.visible = false; }
      if(t.type==='crusher'){ t.y = y; t.slab.position.y = y; } });
  }
  // teias
  if(m.W && FAC.walk){
    const key = w=>w.i+','+w.j, want = new Set(m.W.map(([i,j])=>i+','+j));
    FAC.webs = (FAC.webs||[]).filter(w=>{ if(want.has(key(w))) return true; if(w.mesh.parent) w.mesh.parent.remove(w.mesh); return false; });
    m.W.forEach(([i,j])=>{ if(FAC.webs.some(w=>w.i===i&&w.j===j)) return; const p = tileCenter(i,j); const web = new THREE.Mesh(new THREE.PlaneGeometry(FAC.T, 3.2), MAT.web); web.position.set(p.x, 1.6, p.z); web.rotation.y = (!FAC.walk[tIdx(i,j-1)] && !FAC.walk[tIdx(i,j+1)]) ? 0 : Math.PI/2; addToLevel(web); FAC.webs.push({i, j, x:p.x, z:p.z, mesh:web, hp:2}); });
  }
}
const CREATURE_EYE = {juntador:0.7, lacrador:0.3, tecela:1.0, espreitador:2.1, manequim:2.0, rasteiro:0.9, gosma:0.5, caixa_musica:1.0, sentinela:2.1, sosia:1.8, mimico_sucata:0.4, farejador:1.1, colosso:13, verme:12};
function animateProxies(dt){
  clientProxies.forEach(c=>{
    const k = Math.min(1, dt*10);
    c.pos.lerp(c.target, k);
    c.inFacility = c.pos.x > FAC_ORIGIN.x-500 && c.pos.z > FAC_ORIGIN.z-500;
    const v = c.visual;
    v.position.copy(c.pos); v.rotation.y = c.yaw;
    if(c.type==='verme'){ v.visible = c.netVis; v.position.y = c.extra; }
    else if(c.type==='mimico_sucata'){ v.visible = c.state==='revealed'; const mouth = v.getObjectByName('mouth'); if(mouth) mouth.visible = v.visible; }
    else v.visible = true;
    if(c.type==='lacrador') v.rotation.z = (c.state==='ceiling'||c.state==='climb') ? Math.PI : 0;
    if(c.type==='caixa_musica'){ const jack = v.getObjectByName('jack'), lid = v.getObjectByName('lid'); if(jack) jack.visible = c.state==='pop'; if(lid) lid.visible = c.state!=='pop'; if(c.state==='crank') tickMusicBox(dt, {x:c.pos.x, z:c.pos.z, inFacility:true}, 1.2); }
    if(c.type==='sentinela'){ const eye = v.getObjectByName('eye'); if(eye){ eye.material.emissive.set(['inspect','hunt','aim'].includes(c.state)?0xff0000:0x000000); eye.material.emissiveIntensity = 2; } }
    if(c.netMoving){ c.anim += dt*(c.type==='colosso'?3:8); let n = 0; v.traverse(o=>{ if(o.name==='leg') o.rotation.x = (o.userData.baseX||0) + Math.sin(c.anim + (n++%2)*Math.PI)*0.45; }); }
  });
}

// ================================================================== TICK (todo frame)
function netTick(dt){
  if(NET.mode==='off') return;
  NET.sfxBudget = Math.min(30, NET.sfxBudget + dt*40);
  NET.peers.forEach(p=>animateAvatar(p, dt));
  voiceTick(dt);
  if(NET.mode==='host'){
    NET.peers.forEach(p=>{ if(p.invuln>0) p.invuln -= dt; });
    // remotos encostando em teias avisam a aranha
    if(FAC.webs) NET.peers.forEach(p=>{ if(!p.inFacility || !p.alive) return; FAC.webs.forEach(w=>{ if(Math.hypot(w.x-p.pos.x, w.z-p.pos.z)<0.9 && w.owner && w.owner.alive && w.owner.state!=='hunt'){ w.owner.state='hunt'; w.owner.timer = 10; w.owner.alertPos = {x:p.pos.x, z:p.pos.z}; } }); });
    NET.snapT -= dt;
    if(NET.snapT <= 0 && NET.peers.size){
      NET.snapT = 0.1;
      // dano acumulado
      NET.peers.forEach(p=>{ if(p._dmg > 0.5){ netSendTo(p.id, {t:'dmg', a:Math.round(p._dmg), c:p._cause}); p._dmg = 0; } });
      netBroadcast(hostSnapshot());
    }
  } else if(NET.mode==='client'){
    animateProxies(dt);
    NET.stT -= dt;
    if(NET.stT <= 0){
      NET.stT = 0.066;
      const h = heldItem();
      netSend({t:'st', x:r2(player.pos.x), y:r2(player.pos.y), z:r2(player.pos.z), yaw:r2(player.yaw), pi:r2(player.pitch), inF:player.inFacility?1:0, cr:player.crouch?1:0, al:player.alive?1:0,
        fl:flashOn(player)?1:0, vx:r2(player.vel.x), vz:r2(player.vel.y), air:player.grounded?0:1, h:h?{u:h.uid,k:h.kind,i:h.def.id}:null, inv:player.inv.filter(Boolean).map(serItem)});
    }
    if(S.phase==='moon' && !player.inFacility && S.moon && !S.moon.company){ NET._lt = (NET._lt||0) - dt; if(NET._lt<=0){ NET._lt = 0.5; updateOutdoorLighting(currentHour()); } }
  }
}
