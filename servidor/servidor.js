/*
 * ============================================================================
 *  servidor.js — SERVIDOR LAN DO THE LAST HORIZON (sem instalar nada além do Node)
 * ============================================================================
 *  O que faz:
 *   1. Serve o jogo (os arquivos da pasta de cima) em http://SEU-IP:8080
 *      → resolve o problema do navegador bloquear o scene.gltf
 *   2. Cria as salas de multiplayer e repassa as mensagens entre os jogadores
 *      (WebSocket em /ws). Até 4 jogadores por sala.
 *
 *  Como usar:  node servidor/servidor.js      (ou dois cliques em INICIAR.bat)
 *  Depois abra o endereço que aparecer aqui no navegador de cada jogador
 *  (todos no mesmo Wi-Fi/rede). Celular também funciona.
 *
 *  Porta diferente:  node servidor/servidor.js 3000
 *
 *  3. Guarda as CONTAS e os SAVES (servidor/dados/contas.json), então você entra
 *     com o mesmo usuário e senha em qualquer aparelho que abrir esse servidor.
 * ============================================================================
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PORT = parseInt(process.argv[2] || process.env.PORT || '8080', 10);
const HTTPS_PORT = PORT + 1;   // https (necessário pro microfone do chat de voz na LAN)
function lanIPs(){ const ips = []; Object.values(os.networkInterfaces()).forEach(list=>(list||[]).forEach(a=>{ if(a.family === 'IPv4' && !a.internal) ips.push(a.address); })); return ips; }
const ROOT = path.resolve(__dirname, '..');
const MAX_PLAYERS = 4;
const TYPES = {'.html':'text/html; charset=utf-8', '.js':'application/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json',
  '.gltf':'model/gltf+json', '.glb':'model/gltf-binary', '.bin':'application/octet-stream', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
  '.mp3':'audio/mpeg', '.ogg':'audio/ogg', '.wav':'audio/wav', '.svg':'image/svg+xml', '.ico':'image/x-icon', '.md':'text/plain; charset=utf-8'};

// ---------------------------------------------------------------- salas
const rooms = new Map(); // code -> {code, name, host:conn, clients:Map(id->conn)}
let nextId = 1;
function roomCode(){ const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c; do { c = ''; for(let i=0;i<4;i++) c += L[Math.floor(Math.random()*L.length)]; } while(rooms.has(c)); return c; }
function listRooms(){ return [...rooms.values()].map(r=>({room:r.code, name:r.name, players:1 + r.clients.size})); }

// ---------------------------------------------------------------- BANCO DE DADOS (contas + saves)
// Um arquivo JSON simples. Senhas são guardadas com scrypt (nunca em texto puro).
const DATA_DIR = path.join(__dirname, 'dados');
const DB_FILE = path.join(DATA_DIR, 'contas.json');
let DB = {users:{}, tokens:{}};
try{ DB = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); DB.users = DB.users || {}; DB.tokens = DB.tokens || {}; }catch(e){}
let dbTimer = null;
function saveDB(){
  clearTimeout(dbTimer);
  dbTimer = setTimeout(()=>{
    try{ fs.mkdirSync(DATA_DIR, {recursive:true}); fs.writeFileSync(DB_FILE+'.tmp', JSON.stringify(DB)); fs.renameSync(DB_FILE+'.tmp', DB_FILE); }
    catch(e){ console.error('Não consegui salvar o banco:', e.message); }
  }, 300);
}
function hashPass(senha, salt){ return crypto.scryptSync(String(senha), salt, 32).toString('hex'); }
function newToken(user){ const t = crypto.randomBytes(24).toString('hex'); DB.tokens[t] = {user, exp: Date.now() + 1000*60*60*24*60}; saveDB(); return t; }
function userFromReq(req){ const h = req.headers['authorization'] || ''; const t = h.replace(/^Bearer\s+/i, ''); const s = DB.tokens[t]; if(!s || s.exp < Date.now()) return null; return DB.users[s.user] ? s.user : null; }
function readBody(req, cb){ let size = 0, chunks = []; req.on('data', c=>{ size += c.length; if(size > 3e6){ req.destroy(); return; } chunks.push(c); }); req.on('end', ()=>{ try{ cb(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }catch(e){ cb(null); } }); }
function json(res, code, obj){ res.writeHead(code, {'Content-Type':'application/json', 'Cache-Control':'no-store', 'Access-Control-Allow-Origin':'*'}); res.end(JSON.stringify(obj)); }
function handleApi(req, res, url){
  if(req.method === 'OPTIONS'){ res.writeHead(204, {'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'Content-Type, Authorization', 'Access-Control-Allow-Methods':'GET, POST, PUT, DELETE, OPTIONS'}); res.end(); return true; }
  if(url === '/api/status'){ json(res, 200, {ok:true, jogo:'The Last Horizon', contas:Object.keys(DB.users).length, ips:lanIPs(), porta:PORT, portaHttps:httpsOn?HTTPS_PORT:null}); return true; }
  if(url === '/api/conta/registrar' && req.method === 'POST'){
    readBody(req, b=>{
      if(!b) return json(res, 400, {erro:'Pedido inválido'});
      const nick = String(b.nick||'').trim(), key = nick.toLowerCase(), senha = String(b.senha||'');
      if(!/^[\wÀ-ú .-]{2,16}$/.test(nick)) return json(res, 400, {erro:'Usuário deve ter de 2 a 16 letras/números'});
      if(senha.length < 4) return json(res, 400, {erro:'Senha precisa de pelo menos 4 caracteres'});
      if(DB.users[key]) return json(res, 409, {erro:'Esse usuário já existe'});
      const salt = crypto.randomBytes(12).toString('hex');
      DB.users[key] = {nick, salt, hash: hashPass(senha, salt), created: Date.now(), slots:[null,null,null]};
      saveDB(); log('nova conta: ' + nick);
      json(res, 200, {token:newToken(key), nick, slots:[null,null,null]});
    });
    return true;
  }
  if(url === '/api/conta/entrar' && req.method === 'POST'){
    readBody(req, b=>{
      if(!b) return json(res, 400, {erro:'Pedido inválido'});
      const key = String(b.nick||'').trim().toLowerCase(), u = DB.users[key];
      if(!u || hashPass(String(b.senha||''), u.salt) !== u.hash) return json(res, 401, {erro:'Usuário ou senha errados'});
      json(res, 200, {token:newToken(key), nick:u.nick, slots:u.slots});
    });
    return true;
  }
  if(url === '/api/conta/saves' && req.method === 'GET'){
    const key = userFromReq(req); if(!key) return json(res, 401, {erro:'Faça login de novo'}), true;
    json(res, 200, {nick:DB.users[key].nick, slots:DB.users[key].slots}); return true;
  }
  const m = url.match(/^\/api\/conta\/save\/([0-2])$/);
  if(m){
    const key = userFromReq(req); if(!key){ json(res, 401, {erro:'Faça login de novo'}); return true; }
    const i = +m[1];
    if(req.method === 'PUT'){ readBody(req, b=>{ if(!b) return json(res, 400, {erro:'Save inválido'}); DB.users[key].slots[i] = b; saveDB(); json(res, 200, {ok:true}); }); return true; }
    if(req.method === 'DELETE'){ DB.users[key].slots[i] = null; saveDB(); json(res, 200, {ok:true}); return true; }
  }
  if(url === '/api/conta/sair' && req.method === 'POST'){ const t = (req.headers['authorization']||'').replace(/^Bearer\s+/i,''); delete DB.tokens[t]; saveDB(); json(res, 200, {ok:true}); return true; }
  return false;
}

// ---------------------------------------------------------------- HTTP (arquivos do jogo)
function handler(req, res){
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  if(url === '/api/salas'){ json(res, 200, listRooms()); return; }
  if(url.startsWith('/api/') && handleApi(req, res, url)) return;
  if(url.startsWith('/servidor/dados')){ res.writeHead(403); res.end('proibido'); return; }
  let file = path.normalize(path.join(ROOT, url));
  if(!file.startsWith(ROOT)){ res.writeHead(403); res.end('proibido'); return; }
  if(url === '/' ) file = path.join(ROOT, 'index.html');
  fs.stat(file, (err, st)=>{
    if(err || !st.isFile()){ res.writeHead(404); res.end('não encontrado'); return; }
    res.writeHead(200, {'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size});
    fs.createReadStream(file).pipe(res);
  });
}
const server = http.createServer(handler);
// HTTPS com certificado caseiro (servidor/cert). Sem ele o navegador não libera o microfone na LAN.
let httpsServer = null, httpsOn = false;
try{
  const key = fs.readFileSync(path.join(__dirname, 'cert', 'chave.pem')), cert = fs.readFileSync(path.join(__dirname, 'cert', 'certificado.pem'));
  httpsServer = https.createServer({key, cert}, handler);
}catch(e){ httpsServer = null; }

// ---------------------------------------------------------------- WebSocket (feito à mão, sem bibliotecas)
function onUpgrade(req, socket){
  if((req.url||'').split('?')[0] !== '/ws'){ socket.destroy(); return; }
  const key = req.headers['sec-websocket-key'];
  if(!key){ socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  socket.setNoDelay(true);
  const conn = {id: 'p' + (nextId++), socket, buf: Buffer.alloc(0), room: null, isHost: false, name: '', frags: [], lastSeen: Date.now()};
  allConns.add(conn);
  socket.on('data', chunk=>{ conn.buf = Buffer.concat([conn.buf, chunk]); readFrames(conn); });
  socket.on('close', ()=>onClose(conn));
  socket.on('error', ()=>onClose(conn));
}
server.on('upgrade', onUpgrade);
if(httpsServer) httpsServer.on('upgrade', onUpgrade);
function readFrames(conn){
  conn.lastSeen = Date.now();
  while(conn.buf.length >= 2){
    const b0 = conn.buf[0], b1 = conn.buf[1];
    const fin = (b0 & 0x80) !== 0, op = b0 & 0x0f, masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f, off = 2;
    if(len === 126){ if(conn.buf.length < 4) return; len = conn.buf.readUInt16BE(2); off = 4; }
    else if(len === 127){ if(conn.buf.length < 10) return; len = Number(conn.buf.readBigUInt64BE(2)); off = 10; }
    const maskOff = off; if(masked) off += 4;
    if(conn.buf.length < off + len) return;
    let payload = conn.buf.slice(off, off + len);
    if(masked){ const m = conn.buf.slice(maskOff, maskOff + 4); payload = Buffer.from(payload); for(let i=0;i<payload.length;i++) payload[i] ^= m[i & 3]; }
    conn.buf = conn.buf.slice(off + len);
    if(op === 0x8){ onClose(conn); try{ conn.socket.end(); }catch(e){} return; }
    if(op === 0x9){ sendFrame(conn, payload, 0xA); continue; }
    if(op === 0x1 || op === 0x0){
      conn.frags.push(payload);
      if(fin){ const text = Buffer.concat(conn.frags).toString('utf8'); conn.frags = []; onText(conn, text); }
    }
  }
}
function sendFrame(conn, data, op=0x1){
  if(conn.closed) return;
  const payload = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
  let header;
  if(payload.length < 126){ header = Buffer.from([0x80 | op, payload.length]); }
  else if(payload.length < 65536){ header = Buffer.alloc(4); header[0] = 0x80 | op; header[1] = 126; header.writeUInt16BE(payload.length, 2); }
  else { header = Buffer.alloc(10); header[0] = 0x80 | op; header[1] = 127; header.writeBigUInt64BE(BigInt(payload.length), 2); }
  try{ conn.socket.write(Buffer.concat([header, payload])); }catch(e){}
}
function send(conn, obj){ sendFrame(conn, JSON.stringify(obj)); }

// ---------------------------------------------------------------- protocolo das salas
function onText(conn, text){
  let m; try{ m = JSON.parse(text); }catch(e){ return; }
  if(m.op === 'host'){
    const code = roomCode();
    const room = {code, name: String(m.name||'Sala').slice(0,40), host: conn, clients: new Map()};
    rooms.set(code, room); conn.room = room; conn.isHost = true; conn.name = room.name;
    send(conn, {op:'hosted', room:code, id:'host'});
    log(`sala ${code} criada por ${room.name}`);
  } else if(m.op === 'join'){
    const room = rooms.get(String(m.room||'').toUpperCase());
    if(!room){ send(conn, {op:'error', msg:'Sala não encontrada'}); return; }
    if(room.clients.size >= MAX_PLAYERS-1){ send(conn, {op:'error', msg:'Sala cheia'}); return; }
    conn.room = room; conn.name = String(m.name||'Tripulante').slice(0,16);
    room.clients.set(conn.id, conn);
    send(conn, {op:'joined', id:conn.id});
    send(room.host, {op:'peer-join', id:conn.id, name:conn.name});
    log(`${conn.name} entrou na sala ${room.code}`);
  } else if(m.op === 'list'){
    send(conn, {op:'rooms', rooms:listRooms()});
  } else if(m.op === 'send' && conn.room){
    const room = conn.room;
    if(conn.isHost){
      const msg = JSON.stringify({op:'msg', from:'host', data:m.data});
      if(m.to === '*'){ room.clients.forEach((c,id)=>{ if(id !== m.except) sendFrame(c, msg); }); }
      else { const c = room.clients.get(m.to); if(c) sendFrame(c, msg); }
    } else {
      send(room.host, {op:'msg', from:conn.id, data:m.data});
    }
  }
}
function onClose(conn){
  if(conn.closed) return; conn.closed = true; allConns.delete(conn);
  const room = conn.room; if(!room) return;
  if(conn.isHost){
    room.clients.forEach(c=>send(c, {op:'host-left'}));
    rooms.delete(room.code); log(`sala ${room.code} fechada`);
  } else {
    room.clients.delete(conn.id);
    send(room.host, {op:'peer-leave', id:conn.id});
    log(`${conn.name} saiu da sala ${room.code}`);
  }
}
// a cada 10s manda um "ping"; quem não responder em 30s (aba fechada, celular bloqueado) sai da sala
const allConns = new Set();
setInterval(()=>{ const now = Date.now(); allConns.forEach(c=>{ if(now - c.lastSeen > 30000){ onClose(c); try{ c.socket.destroy(); }catch(e){} } else sendFrame(c, Buffer.alloc(0), 0x9); }); }, 10000);
function log(s){ console.log(new Date().toLocaleTimeString() + '  ' + s); }

// ---------------------------------------------------------------- iniciar
server.listen(PORT, '0.0.0.0', ()=>{
  const ips = lanIPs();
  console.log('');
  console.log('  =====================================================');
  console.log('   THE LAST HORIZON — servidor LAN ligado');
  console.log('  =====================================================');
  console.log('   Neste computador:  http://localhost:' + PORT);
  ips.forEach(ip=>console.log('   Na rede (amigos):  http://' + ip + ':' + PORT));
  if(httpsServer){ console.log(''); console.log('   COM CHAT DE VOZ (microfone precisa de https):'); ips.forEach(ip=>console.log('   https://' + ip + ':' + HTTPS_PORT + '   (clique em "Avançado" → "Continuar")')); }
  console.log('');
  console.log('   Todos no mesmo Wi-Fi abrem o endereço "Na rede" no navegador.');
  console.log('   Pra desligar: feche esta janela (ou Ctrl+C).');
  console.log('');
});
if(httpsServer){ httpsServer.listen(HTTPS_PORT, '0.0.0.0', ()=>{ httpsOn = true; }); httpsServer.on('error', e=>{ console.error('HTTPS desligado (porta ' + HTTPS_PORT + '): ' + e.message); }); }
server.on('error', e=>{ console.error('Erro: ' + e.message + (e.code==='EADDRINUSE' ? ' (a porta ' + PORT + ' já está em uso — tente: node servidor/servidor.js 3000)' : '')); });
