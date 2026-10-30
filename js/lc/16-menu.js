/*
 * ============================================================================
 *  16-menu.js — MENU INICIAL "THE LAST HORIZON", CONTAS E PROGRESSO SALVO
 * ============================================================================
 *  - Contas ficam salvas NESTE navegador (localStorage). Cada conta tem 3
 *    espaços de save. O jogo salva sozinho toda vez que a nave volta pra órbita.
 *  - "Exportar" baixa um arquivo .json com a conta inteira; "Importar" carrega
 *    esse arquivo em outro aparelho (é assim que se leva o progresso do PC pro
 *    celular, por exemplo).
 *  - A senha é só uma trava simples pra quem divide o computador; não é uma
 *    conta online de verdade (isso precisaria de um servidor/banco de dados).
 * ============================================================================
 */

const GAME_TITLE = 'THE LAST HORIZON';
const MENU = {account:null, slot:0, screen:'main', cloud:null}; // cloud = {nick, slots} quando logado online

// ------------------------------------------------------------------ CONTAS ONLINE (banco de dados)
// Usa o servidor/servidor.js (se o jogo foi aberto por ele, ou CONFIG.SERVER_URL) ou o Firebase.
const CLOUD = {kind:null, base:'', fb:null};
const SESSION_KEY = 'tlh_sessao_v1';
function cloudSession(){ try{ return JSON.parse(localStorage.getItem(SESSION_KEY)||'null'); }catch(e){ return null; } }
function cloudSetSession(s){ try{ s ? localStorage.setItem(SESSION_KEY, JSON.stringify(s)) : localStorage.removeItem(SESSION_KEY); }catch(e){} }
function loadScript(src){ return new Promise((ok, fail)=>{ const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = fail; document.head.appendChild(s); }); }
async function cloudDetect(){
  const fb = CONFIG.FIREBASE || {};
  if(fb.apiKey){
    try{
      const V = 'https://www.gstatic.com/firebasejs/10.12.2/';
      await loadScript(V+'firebase-app-compat.js'); await loadScript(V+'firebase-auth-compat.js'); await loadScript(V+'firebase-firestore-compat.js');
      firebase.initializeApp(fb); CLOUD.fb = {auth:firebase.auth(), db:firebase.firestore()}; CLOUD.kind = 'firebase';
      await new Promise(r=>{ const off = CLOUD.fb.auth.onAuthStateChanged(()=>{ off(); r(); }); });
      if(CLOUD.fb.auth.currentUser) await cloudRefresh().catch(()=>{});
      return;
    }catch(e){ console.warn('Firebase não carregou', e); }
  }
  const bases = [CONFIG.SERVER_URL, location.protocol.startsWith('http') ? location.origin : ''].filter(Boolean);
  for(const b of bases){
    try{ const r = await fetch(b.replace(/\/$/,'')+'/api/status', {cache:'no-store'}); if(r.ok){ const j = await r.json(); if(j.jogo){ CLOUD.kind = 'servidor'; CLOUD.base = b.replace(/\/$/,''); break; } } }catch(e){}
  }
  if(CLOUD.kind==='servidor' && cloudSession()) await cloudRefresh().catch(()=>{ cloudSetSession(null); });
}
async function api(path, method='GET', body){
  const s = cloudSession();
  const r = await fetch(CLOUD.base+path, {method, headers:Object.assign({'Content-Type':'application/json'}, s&&s.token?{'Authorization':'Bearer '+s.token}:{}), body: body!==undefined ? JSON.stringify(body) : undefined});
  const j = await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(j.erro || ('erro '+r.status));
  return j;
}
const fbEmail = nick=>nick.trim().toLowerCase().replace(/[^a-z0-9._-]/g,'_')+'@thelasthorizon.app';
async function cloudRegister(nick, senha){
  if(CLOUD.kind==='firebase'){
    if(senha.length < 6) throw new Error('No Firebase a senha precisa de 6+ caracteres');
    const cred = await CLOUD.fb.auth.createUserWithEmailAndPassword(fbEmail(nick), senha);
    await CLOUD.fb.db.collection('contas').doc(cred.user.uid).set({nick, s0:'', s1:'', s2:''});
    MENU.cloud = {nick, slots:[null,null,null]}; return;
  }
  const j = await api('/api/conta/registrar', 'POST', {nick, senha});
  cloudSetSession({token:j.token, nick:j.nick, base:CLOUD.base}); MENU.cloud = {nick:j.nick, slots:j.slots};
}
async function cloudLogin(nick, senha){
  if(CLOUD.kind==='firebase'){ await CLOUD.fb.auth.signInWithEmailAndPassword(fbEmail(nick), senha); await cloudRefresh(); return; }
  const j = await api('/api/conta/entrar', 'POST', {nick, senha});
  cloudSetSession({token:j.token, nick:j.nick, base:CLOUD.base}); MENU.cloud = {nick:j.nick, slots:j.slots};
}
async function cloudRefresh(){
  if(CLOUD.kind==='firebase'){
    const u = CLOUD.fb.auth.currentUser; if(!u) throw new Error('sem login');
    const d = (await CLOUD.fb.db.collection('contas').doc(u.uid).get()).data() || {};
    MENU.cloud = {nick:d.nick || u.email.split('@')[0], slots:[0,1,2].map(i=>{ try{ return d['s'+i] ? JSON.parse(d['s'+i]) : null; }catch(e){ return null; } })};
    return;
  }
  const j = await api('/api/conta/saves'); MENU.cloud = {nick:j.nick, slots:j.slots};
}
async function cloudPutSlot(i, save){
  if(CLOUD.kind==='firebase'){ const u = CLOUD.fb.auth.currentUser; await CLOUD.fb.db.collection('contas').doc(u.uid).set({['s'+i]: save ? JSON.stringify(save) : ''}, {merge:true}); return; }
  if(save) await api('/api/conta/save/'+i, 'PUT', save); else await api('/api/conta/save/'+i, 'DELETE');
}
async function cloudLogout(){
  if(CLOUD.kind==='firebase'){ await CLOUD.fb.auth.signOut(); }
  else { try{ await api('/api/conta/sair', 'POST', {}); }catch(e){} cloudSetSession(null); }
  MENU.cloud = null;
}
const SAVE_KEY = 'tlh_contas_v1';

// ------------------------------------------------------------------ itens <-> texto
function findDef(kind, id){
  if(kind==='tool') return TOOLS[id];
  return SCRAP.find(s=>s.id===id) || SCRAP_SPECIAL[id] || null;
}
function serItem(it){ return {u:it.uid, k:it.kind, i:it.def.id, v:it.value, b:it.battery, c:it.charges, s:it.shells, o:it.on?1:0}; }
function deserItem(o){
  const def = findDef(o.k, o.i); if(!def) return null;
  const it = o.k==='tool' ? makeToolItem(o.i) : makeScrapItem(def, 1);
  it.value = o.v||0; if(o.b!==undefined && o.b!==null) it.battery = o.b; if(o.c!==undefined && o.c!==null) it.charges = o.c; if(o.s!==undefined && o.s!==null) it.shells = o.s;
  it.on = !!o.o; if(o.u) it.uid = o.u;
  return it;
}

// ------------------------------------------------------------------ armazenamento
function loadDB(){ try{ return JSON.parse(localStorage.getItem(SAVE_KEY)||'null') || {accounts:{}, last:null}; }catch(e){ return {accounts:{}, last:null}; } }
function saveDB(db){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(db)); return true; }catch(e){ toast('Não deu pra salvar (armazenamento do navegador cheio ou bloqueado)'); return false; } }
function simpleHash(s){ let h = 2166136261; for(const ch of 'tlh#'+s){ h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h>>>0).toString(36); }
function currentAccount(){
  if(MENU.cloud) return {nick:MENU.cloud.nick, slots:MENU.cloud.slots, cloud:true};
  const db = loadDB(); return MENU.account ? db.accounts[MENU.account] : null;
}
// grava um save no lugar certo (nuvem ou este aparelho)
function writeSlot(i, save, silent){
  if(MENU.cloud){
    MENU.cloud.slots[i] = save;
    cloudPutSlot(i, save).then(()=>{ if(!silent) toast(save ? '☁ Progresso salvo na nuvem' : 'Save apagado'); })
      .catch(err=>{ toast('Não consegui salvar online ('+err.message+'). Guardei uma cópia neste aparelho.', 5); backupLocal(i, save); });
    return;
  }
  const db = loadDB(), acc = db.accounts[MENU.account]; if(!acc) return;
  acc.slots[i] = save;
  if(saveDB(db) && !silent) toast(save ? '💾 Progresso salvo' : 'Save apagado');
}
function backupLocal(i, save){ try{ localStorage.setItem('tlh_backup_'+(MENU.cloud?MENU.cloud.nick:'x')+'_'+i, JSON.stringify(save)); }catch(e){} }

function serializeGame(){
  if(S.phase==='orbit' && SHIP.group) snapshotShipItems();
  return {
    v:1, savedAt:Date.now(),
    S:{credits:S.credits, quota:S.quota, quotaIndex:S.quotaIndex, soldThisQuota:S.soldThisQuota, daysLeft:S.daysLeft,
       routeMoon:S.routeMoon, weather:S.weather, discovered:[...S.discovered], stats:S.stats, pending:S.pendingDeliveries},
    ship:S.shipItems.map(si=>({it:serItem(si.item), x:+si.lx.toFixed(2), z:+si.lz.toFixed(2)})),
    inv:player.inv.map(it=>it?serItem(it):null),
  };
}
function applySave(sv){
  fullReset();
  const s = sv.S;
  Object.assign(S, {credits:s.credits, quota:s.quota, quotaIndex:s.quotaIndex, soldThisQuota:s.soldThisQuota, daysLeft:s.daysLeft, routeMoon:s.routeMoon||'ferrugem', stats:s.stats||S.stats});
  if(s.weather) S.weather = s.weather;
  S.discovered = new Set(s.discovered||[]);
  S.pendingDeliveries = s.pending || [];
  S.shipItems = (sv.ship||[]).map(o=>{ const it = deserItem(o.it); return it ? {item:it, lx:o.x, ly:0, lz:o.z} : null; }).filter(Boolean);
  player.inv = (sv.inv||[]).slice(0, CONFIG.INVENTORY_SLOTS).map(o=>o?deserItem(o):null);
  while(player.inv.length < CONFIG.INVENTORY_SLOTS) player.inv.push(null);
  player.slot = 0; refreshViewModel();
}
function autoSave(silent){
  if(isNetClient() || (!MENU.account && !MENU.cloud) || !gameStarted) return;
  if(S.phase!=='orbit') return; // só salva com a nave em órbita (início de um dia)
  writeSlot(MENU.slot, serializeGame(), silent);
}
function saveSummary(sv){
  if(!sv) return 'Vazio';
  const d = new Date(sv.savedAt);
  return `Cota $${sv.S.soldThisQuota}/$${sv.S.quota} · ${sv.S.daysLeft} dia(s) · $${sv.S.credits} · ${sv.S.stats.daysSurvived||0} dias jogados<br><small>${d.toLocaleDateString()} ${d.toLocaleTimeString().slice(0,5)}</small>`;
}

// ------------------------------------------------------------------ interface
const startEl = document.getElementById('start');
function menuShow(screen){
  MENU.screen = screen || 'main';
  startEl.style.display = 'flex'; menuOpen = true; document.body.classList.add('inMenu');
  document.exitPointerLock && document.exitPointerLock();
  const db = loadDB();
  if(!MENU.account && db.last && db.accounts[db.last] && !db.accounts[db.last].pass) MENU.account = db.last;
  const acc = currentAccount();
  const accLine = acc ? `${acc.cloud?'☁ Conta online':'Conta neste aparelho'}: <b>${escapeHtml(acc.nick)}</b> <button class="link" data-go="conta">trocar</button>` : `<button class="link" data-go="conta">Entrar / criar conta</button>`;
  let body = '';
  if(MENU.screen==='main'){
    body = `
      <div class="menuCol">
        <button id="startBtn" class="primary" data-go="${acc?'slots':'conta'}">JOGAR</button>
        <button data-go="multi">MULTIPLAYER</button>
        <button data-act="settings">CONFIGURAÇÕES</button>
        <button data-go="conta">CONTA</button>
        <button data-go="ajuda">COMO JOGAR</button>
        <a class="menuLink" href="index.html">← voltar ao site</a>
      </div>`;
  } else if(MENU.screen==='slots'){
    body = `<h2>Escolha o save</h2><div class="slots">` + [0,1,2].map(i=>{
      const sv = acc.slots[i];
      return `<div class="slotCard"><b>SAVE ${i+1}</b><p>${saveSummary(sv)}</p>
        ${sv ? `<button class="primary" data-load="${i}">CONTINUAR</button><button class="sm" data-new="${i}">novo jogo</button><button class="sm danger" data-del="${i}">apagar</button>`
             : `<button class="primary" data-new="${i}">NOVO JOGO</button>`}</div>`;
    }).join('') + `</div>
      <div class="menuRow"><button class="sm" data-act="export">exportar conta (.json)</button><button class="sm" data-act="import">importar conta</button></div>
      <button data-go="main">VOLTAR</button>`;
  } else if(MENU.screen==='conta'){
    const names = Object.keys(db.accounts);
    const cloudBox = CLOUD.kind ? `
      <h2>☁ Conta online ${CLOUD.kind==='firebase'?'(Firebase)':'(servidor)'}</h2>
      ${MENU.cloud ? `<p class="small">Logado como <b>${escapeHtml(MENU.cloud.nick)}</b>. Seus saves ficam guardados no banco de dados e aparecem em qualquer aparelho.</p><div class="menuRow"><button class="primary" data-go="slots">VER SAVES</button><button class="sm" data-act="cloudOut">sair</button></div>`
      : `<p class="small">Entre com usuário e senha em qualquer aparelho pra continuar de onde parou.</p>
        <div class="form"><input id="cNick" maxlength="16" placeholder="usuário" autocomplete="username"><input id="cPass" type="password" maxlength="40" placeholder="senha" autocomplete="current-password"></div>
        <div class="menuRow"><button class="primary" data-act="cloudIn">ENTRAR</button><button data-act="cloudNew">CRIAR CONTA ONLINE</button></div>`}
      <p id="cloudMsg" class="warn"></p>`
      : `<p class="warn">Contas online desligadas: abra o jogo pelo servidor (servidor/INICIAR.bat) ou configure o Firebase (veja o LEIA-ME).</p>`;
    body = cloudBox + `
      <h2>Contas só deste aparelho (offline)</h2>
      <div class="accList">${names.length ? names.map(n=>`<button class="${(!MENU.cloud && n===MENU.account)?'primary':''}" data-login="${escapeHtml(n)}">${escapeHtml(db.accounts[n].nick)}${db.accounts[n].pass?' 🔒':''}</button>`).join('') : '<p class="small">Nenhuma.</p>'}</div>
      <div class="form"><input id="accNick" maxlength="16" placeholder="apelido"><input id="accPass" type="password" maxlength="24" placeholder="senha (opcional)"><button data-act="create">CRIAR OFFLINE</button></div>
      <div class="menuRow">${(MENU.account&&!MENU.cloud)?'<button class="sm" data-act="logout">sair da conta</button>':''}<button class="sm" data-act="import">importar conta (.json)</button></div>
      <button data-go="main">VOLTAR</button>`;
  } else if(MENU.screen==='multi'){
    const nick = playerNick();
    body = `<h2>Multiplayer — até 4 tripulantes</h2>
      <div class="mpGrid">
        <div class="mpCard">
          <h3>CRIAR SALA</h3>
          <p class="small">Você é o host: a nave e o save são seus. Depois é só passar o <b>código</b> (ou o link) pros amigos.</p>
          <button class="primary big" data-act="mpHost">CRIAR SALA</button>
          <label class="small mpOpt" id="mpOptBox" style="display:none"><input type="checkbox" id="mpInternet" ${MENU.mpInternet?'checked':''}> sala pela internet (amigos fora do seu Wi-Fi)</label>
        </div>
        <div class="mpCard">
          <h3>ENTRAR NUMA SALA</h3>
          <div class="form"><input id="joinCode" maxlength="6" placeholder="CÓDIGO" value="${escapeHtml(MENU.inviteCode||'')}" style="text-transform:uppercase;letter-spacing:.25em;font-size:1.3em;text-align:center"><button class="primary" data-act="mpJoin">ENTRAR</button></div>
          <div id="roomList" class="accList"></div>
        </div>
      </div>
      <div class="form"><span class="small">Seu nome:</span><input id="mpNick" maxlength="16" value="${escapeHtml(nick)}" ${currentAccount()?'disabled title="nome da sua conta"':''}></div>
      <p id="netStatus" class="small"></p>
      <p class="small">No jogo: <b>${keyName(SET.keys.chat)}</b> abre o chat · segure <b>${keyName(SET.keys.falar)}</b> pra falar (voz por proximidade) · Esc mostra o código da sala.</p>
      <button data-go="main">VOLTAR</button>`;
  } else if(MENU.screen==='ajuda'){
    body = `<div class="helpText">
      <p>Você trabalha pra Empresa. A cada 3 dias ela cobra uma cota em dinheiro.</p>
      <p>1. Na nave, use o <b>terminal</b> pra escolher a lua (ROTA) e comprar itens (LOJA).<br>
      2. Puxe a <b>alavanca</b> pra pousar. Ache a entrada da instalação.<br>
      3. Pegue sucata e <b>largue dentro da nave</b> (G). Volte antes da meia-noite.<br>
      4. Venda no <b>71-Posto</b>. No último dia a Empresa paga 100%.<br>
      5. Bata a cota ou seja demitido.</p>
      <p class="small">${keysHelp()}</p><p class="small">As teclas podem ser trocadas em CONFIGURAÇÕES → Teclado.</p></div>
      <button data-go="main">VOLTAR</button>`;
  }
  startEl.querySelector('.inner').innerHTML = `
    <h1 class="title">${GAME_TITLE}</h1>
    <p class="sub">Colete sucata. Bata a cota. Volte antes da meia-noite.</p>
    <p class="accLine">${accLine}</p>
    ${body}
    <p id="padHint" class="sub" style="display:${typeof padConnected!=='undefined'&&padConnected?'block':'none'}">🎮 Controle detectado — aperte A</p>`;
  wireMenu();
  if(MENU.screen==='multi'){ refreshRoomList(); const jc = document.getElementById('joinCode'); if(MENU.inviteCode && jc) setTimeout(()=>jc.focus(), 50); }
}
function keysHelp(){ return KEY_ACTIONS.map(([a,n])=>`<b>${escapeHtml(keyName(SET.keys[a]))}</b> ${escapeHtml(n.toLowerCase())}`).join(' · '); }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function wireMenu(){
  const root = startEl;
  root.querySelectorAll('[data-go]').forEach(b=>b.onclick = e=>{ e.stopPropagation(); menuShow(b.dataset.go); });
  root.querySelectorAll('[data-mtab]').forEach(b=>b.onclick = ()=>{ MENU.mtab = b.dataset.mtab; menuShow('multi'); });
  root.querySelectorAll('[data-load]').forEach(b=>b.onclick = ()=>startSlot(+b.dataset.load, false));
  root.querySelectorAll('[data-new]').forEach(b=>b.onclick = ()=>{
    const i = +b.dataset.new, acc = currentAccount();
    if(acc.slots[i] && !confirmBox('Começar um jogo novo vai apagar o SAVE '+(i+1)+'. Continuar?')) return;
    startSlot(i, true);
  });
  root.querySelectorAll('[data-del]').forEach(b=>b.onclick = ()=>{
    const i = +b.dataset.del; if(!confirmBox('Apagar o SAVE '+(i+1)+'?')) return;
    writeSlot(i, null); menuShow('slots');
  });
  root.querySelectorAll('[data-login]').forEach(b=>b.onclick = ()=>{
    const db = loadDB(), a = db.accounts[b.dataset.login];
    if(a.pass){ const p = prompt('Senha de '+a.nick+':'); if(p===null) return; if(simpleHash(p)!==a.pass){ toast('Senha errada'); sfx('error'); return; } }
    MENU.cloud = null; MENU.account = b.dataset.login; db.last = MENU.account; saveDB(db); cloudDetect().finally(()=>{ if(!gameStarted) menuShow(MENU.screen||'main'); });
menuShow('main');
  });
  root.querySelectorAll('[data-act]').forEach(b=>b.onclick = e=>{
    e.stopPropagation();
    const a = b.dataset.act;
    if(a==='settings') openSettings();
    if(a==='create'){
      const nick = (document.getElementById('accNick').value||'').trim(), pass = document.getElementById('accPass').value;
      if(nick.length < 2){ toast('Apelido com pelo menos 2 letras'); return; }
      const db = loadDB(), key = nick.toLowerCase();
      if(db.accounts[key]){ toast('Já existe uma conta com esse apelido'); return; }
      db.accounts[key] = {nick, pass: pass ? simpleHash(pass) : null, created:Date.now(), slots:[null,null,null]};
      db.last = key; saveDB(db); MENU.cloud = null; MENU.account = key; toast('Conta criada!'); menuShow('slots');
    }
    if(a==='cloudIn' || a==='cloudNew'){
      const nick = (document.getElementById('cNick').value||'').trim(), senha = document.getElementById('cPass').value||'';
      const msg = document.getElementById('cloudMsg');
      if(nick.length < 2 || senha.length < 4){ msg.textContent = 'Preencha usuário (2+ letras) e senha (4+ caracteres)'; return; }
      msg.textContent = 'Conectando...';
      (a==='cloudNew' ? cloudRegister(nick, senha) : cloudLogin(nick, senha))
        .then(()=>{ MENU.account = null; toast('☁ Bem-vindo, '+MENU.cloud.nick+'!'); menuShow('slots'); })
        .catch(err=>{ msg.textContent = traduzErro(err); sfx('error'); });
    }
    if(a==='cloudOut'){ cloudLogout().then(()=>menuShow('conta')); }
    if(a==='logout'){ MENU.account = null; const db = loadDB(); db.last = null; saveDB(db); menuShow('conta'); }
    if(a==='export') exportAccount();
    if(a==='import') importAccount();
    if(a==='mpHost'){
      saveMpNick();
      const net = document.getElementById('mpInternet'); MENU.mpInternet = net ? net.checked : true;
      MENU.pendingHost = (MENU.lanOK && !MENU.mpInternet) ? 'lan' : 'online';
      if(!MENU.account && !MENU.cloud){ toast('Entre numa conta primeiro (o mundo do host fica salvo nela)'); menuShow('conta'); return; }
      menuShow('slots'); toast('Escolha qual save vai ser o mundo da sala');
    }
    if(a==='mpJoin'){
      saveMpNick();
      const code = (document.getElementById('joinCode').value||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
      if(code.length<4){ toast('Digite o código da sala'); return; }
      joinByCode(code);
    }
  });
}
function traduzErro(err){
  const c = (err && (err.code || err.message)) || String(err);
  if(/user-not-found|wrong-password|invalid-credential|invalid-login/.test(c)) return 'Usuário ou senha errados';
  if(/email-already-in-use/.test(c)) return 'Esse usuário já existe';
  if(/weak-password/.test(c)) return 'Senha fraca (use 6+ caracteres)';
  if(/network|Failed to fetch/.test(c)) return 'Sem conexão com o servidor';
  return err.message || c;
}
function confirmBox(msg){ return window.confirm(msg); }
function playerNick(){
  const a = currentAccount(); if(a) return a.nick;
  let n = null; try{ n = localStorage.getItem('tlh_nick'); }catch(e){}
  if(!n){ n = 'Tripulante' + Math.floor(Math.random()*90+10); try{ localStorage.setItem('tlh_nick', n); }catch(e){} }
  return n;
}
function saveMpNick(){ const el = document.getElementById('mpNick'); if(el && !el.disabled){ const v = el.value.trim().slice(0,16); if(v.length>=2) try{ localStorage.setItem('tlh_nick', v); }catch(e){} } }
// código de 4 letras = sala do servidor (LAN); 5 letras = sala pela internet (P2P)
function joinByCode(code){
  netStatus('Procurando a sala ' + code + '...');
  if(MENU.lanOK && code.length===4){ netJoinLan(code, playerNick()); return; }
  netJoinOnline(code, playerNick());
}
function startSlot(i, fresh){
  MENU.slot = i;
  const acc = currentAccount();
  if(fresh || !acc.slots[i]) fullReset(); else applySave(acc.slots[i]);
  beginGame();
  if(fresh) autoSave(true);
  if(MENU.pendingHost){ const kind = MENU.pendingHost; MENU.pendingHost = null; if(kind==='lan') netHostLan(playerNick()); else netHostOnline(playerNick()); }
}
function refreshRoomList(){
  const el = document.getElementById('roomList');
  fetch('/api/status').then(r=>r.json()).then(st=>{ if(st && st.ips) MENU.server = st; }).catch(()=>{});
  fetch('/api/salas').then(r=>{ if(!r.ok) throw 0; return r.json(); }).then(list=>{
    MENU.lanOK = true;
    const opt = document.getElementById('mpOptBox'); if(opt) opt.style.display = 'flex';
    if(!el) return;
    el.innerHTML = list.length ? '<p class="small">Salas abertas neste servidor:</p>' + list.map(r=>`<button data-room="${r.room}">${escapeHtml(r.name)} · <b>${r.room}</b> · ${r.players}/4</button>`).join('') : '<p class="small">Nenhuma sala aberta neste servidor ainda.</p>';
    el.querySelectorAll('[data-room]').forEach(b=>b.onclick = ()=>{ saveMpNick(); netJoinLan(b.dataset.room, playerNick()); });
    clearTimeout(refreshRoomList._t); refreshRoomList._t = setTimeout(()=>{ if(MENU.screen==='multi' && !gameStarted) refreshRoomList(); }, 4000);
  }).catch(()=>{
    MENU.lanOK = false;
    if(el) el.innerHTML = '<p class="small">Sem servidor aqui: as salas são criadas pela internet (P2P) e você entra pelo código.</p>';
  });
}
function exportAccount(){
  const acc = currentAccount(); if(!acc){ toast('Entre numa conta primeiro'); return; }
  const blob = new Blob([JSON.stringify({tlh:1, account:acc})], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `the-last-horizon-${acc.nick}.json`; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 2000);
}
function importAccount(){
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = ()=>{
    const f = inp.files[0]; if(!f) return;
    f.text().then(t=>{
      const d = JSON.parse(t); if(!d.tlh || !d.account || !d.account.nick) throw new Error('arquivo inválido');
      const db = loadDB(), key = d.account.nick.toLowerCase();
      if(db.accounts[key] && !confirmBox('Já existe a conta '+d.account.nick+' aqui. Substituir?')) return;
      db.accounts[key] = d.account; db.last = key; saveDB(db); MENU.account = key; toast('Conta importada!'); menuShow('slots');
    }).catch(err=>{ toast('Não consegui ler esse arquivo'); });
  };
  inp.click();
}

// ------------------------------------------------------------------ pausa: salvar e sair
(function(){
  const inner = document.querySelector('#pause .inner'); if(!inner) return;
  const b = document.createElement('button'); b.className = 'setBtn'; b.textContent = 'SALVAR E SAIR PRO MENU';
  b.addEventListener('click', e=>{ e.stopPropagation(); quitToMenu(); });
  inner.appendChild(b);
})();
function quitToMenu(){
  if(S.phase==='orbit') autoSave(true);
  else if(!isNetClient()) toast('O dia em andamento não é salvo — o jogo salva sempre que a nave volta pra órbita.', 4);
  if(typeof netLeave==='function') netLeave();
  document.getElementById('pause').style.display = 'none';
  gameStarted = false; stopAllLoops(); musicStop();
  S.phase = 'orbit'; loadOrbit();
  cloudDetect().finally(()=>{ if(!gameStarted) menuShow(MENU.screen||'main'); });
menuShow('main');
}

// jogar.html?tela=multi ou ?sala=CODIGO (vindo do site ou de um convite) abre direto o multiplayer
const _qs = new URLSearchParams(location.search);
if(_qs.get('sala')) MENU.inviteCode = _qs.get('sala').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);
const START_SCREEN = (_qs.get('tela')==='multi' || MENU.inviteCode) ? 'multi' : 'main';
cloudDetect().finally(()=>{ if(!gameStarted) menuShow(MENU.screen||START_SCREEN); });
menuShow(START_SCREEN);
