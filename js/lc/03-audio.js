/*
 * ============================================================================
 *  03-audio.js — SONS (todos sintetizados por código, nada de arquivo)
 * ============================================================================
 *  sfx('nome', posicao, volume) toca um som; se tiver posição, ele fica mais
 *  baixo com a distância e vai pro lado certo (esquerda/direita).
 *  Pra trocar um som por um arquivo seu: ASSETS.sounds.nome = 'audio/arquivo.mp3'
 * ============================================================================
 */

let AC = null, masterGain = null, muffleFilter = null;
const _noiseBuf = {};
function audioInit(){
  if(AC) return;
  AC = new (window.AudioContext || window.webkitAudioContext)();
  muffleFilter = AC.createBiquadFilter(); muffleFilter.type='lowpass'; muffleFilter.frequency.value = 20000;
  masterGain = AC.createGain(); masterGain.gain.value = CONFIG.SFX_VOLUME;
  muffleFilter.connect(masterGain); masterGain.connect(AC.destination);
  const len = AC.sampleRate*2, b = AC.createBuffer(1, len, AC.sampleRate), d = b.getChannelData(0);
  for(let i=0;i<len;i++) d[i] = GR()*2-1;
  _noiseBuf.white = b;
  const b2 = AC.createBuffer(1, len, AC.sampleRate), d2 = b2.getChannelData(0); let last=0;
  for(let i=0;i<len;i++){ last = (last + 0.02*(GR()*2-1))/1.02; d2[i] = last*3.5; }
  _noiseBuf.brown = b2;
}
function setMuffled(on){ if(muffleFilter) muffleFilter.frequency.setTargetAtTime(on?600:20000, AC.currentTime, 0.1); }

// nó de saída com volume/pan pela posição
function spatialOut(pos, vol=1, maxDist=40){
  const g = AC.createGain(), p = AC.createStereoPanner ? AC.createStereoPanner() : null;
  let v = vol;
  if(pos){
    const dx = pos.x-camera.position.x, dz = pos.z-camera.position.z, d = Math.hypot(dx,dz);
    // som de outro "andar" (dentro x fora) fica quase mudo
    if(pos.inFacility !== undefined && pos.inFacility !== player.inFacility) v *= 0.0;
    v *= Math.max(0, 1 - d/maxDist) ** 1.6;
    if(p){
      const ang = Math.atan2(dx, dz) - (player.yaw + Math.PI);
      p.pan.value = clamp(Math.sin(-ang), -0.9, 0.9);
    }
  }
  g.gain.value = v;
  if(p){ g.connect(p); p.connect(muffleFilter); } else g.connect(muffleFilter);
  return g;
}
function tone(out, {type='sine', f=440, f2=null, t=0.2, a=0.005, v=0.4, delay=0}){
  const o = AC.createOscillator(), g = AC.createGain(), now = AC.currentTime+delay;
  o.type = type; o.frequency.setValueAtTime(f, now);
  if(f2) o.frequency.exponentialRampToValueAtTime(Math.max(1,f2), now+t);
  g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(v, now+a); g.gain.exponentialRampToValueAtTime(0.0001, now+t);
  o.connect(g); g.connect(out); o.start(now); o.stop(now+t+0.05);
}
function noise(out, {t=0.2, a=0.005, v=0.4, filter='lowpass', f=1200, f2=null, q=1, kind='white', delay=0}){
  const s = AC.createBufferSource(), g = AC.createGain(), fl = AC.createBiquadFilter(), now = AC.currentTime+delay;
  s.buffer = _noiseBuf[kind]; s.loop = true;
  fl.type = filter; fl.frequency.setValueAtTime(f, now); fl.Q.value = q;
  if(f2) fl.frequency.exponentialRampToValueAtTime(Math.max(20,f2), now+t);
  g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(v, now+a); g.gain.exponentialRampToValueAtTime(0.0001, now+t);
  s.connect(fl); fl.connect(g); g.connect(out); s.start(now, GR()); s.stop(now+t+0.05);
}

const _fileSounds = {};
function playFileSound(url, out){
  let a = _fileSounds[url];
  if(!a){ a = _fileSounds[url] = {buf:null}; fetch(url).then(r=>r.arrayBuffer()).then(b=>AC.decodeAudioData(b)).then(buf=>a.buf=buf).catch(()=>{}); }
  if(a.buf){ const s = AC.createBufferSource(); s.buffer = a.buf; s.connect(out); s.start(); return true; }
  return false;
}

const SFX = {
  step:      o=>noise(o,{t:0.09, v:0.25, f:700, filter:'bandpass', q:0.7}),
  stepMetal: o=>{ noise(o,{t:0.07, v:0.2, f:2400, filter:'bandpass', q:2}); tone(o,{type:'triangle', f:180, f2:120, t:0.08, v:0.08}); },
  jump:      o=>noise(o,{t:0.12, v:0.18, f:500}),
  land:      o=>noise(o,{t:0.15, v:0.35, f:400, kind:'brown'}),
  pickup:    o=>{ tone(o,{type:'square', f:620, t:0.05, v:0.08}); tone(o,{type:'square', f:930, t:0.06, v:0.08, delay:0.05}); },
  drop:      o=>noise(o,{t:0.18, v:0.4, f:600, kind:'brown'}),
  door:      o=>{ noise(o,{t:0.5, v:0.3, f:300, f2:1200, filter:'bandpass', q:1.5}); tone(o,{type:'sawtooth', f:70, f2:55, t:0.4, v:0.05}); },
  doorLocked:o=>{ tone(o,{type:'square', f:160, t:0.08, v:0.12}); tone(o,{type:'square', f:120, t:0.12, v:0.12, delay:0.1}); },
  lever:     o=>{ noise(o,{t:0.25, v:0.35, f:900, filter:'bandpass', q:3}); tone(o,{type:'square', f:90, t:0.15, v:0.12}); },
  shipDoor:  o=>{ noise(o,{t:1.0, v:0.35, f:200, f2:900, filter:'bandpass', q:1}); tone(o,{type:'sine', f:60, t:1.0, v:0.15}); },
  scan:      o=>{ tone(o,{type:'sine', f:880, f2:1760, t:0.35, v:0.15}); noise(o,{t:0.3, v:0.05, f:3000, filter:'highpass'}); },
  bell:      o=>{ [1,2.76,5.4].forEach((m,i)=>tone(o,{type:'sine', f:520*m, t:1.6-i*0.4, v:0.25/(i+1)})); },
  register:  o=>{ tone(o,{type:'square', f:1400, t:0.06, v:0.1}); [0,0.08,0.16].forEach(d=>noise(o,{t:0.05, v:0.2, f:3000, filter:'bandpass', delay:d})); tone(o,{type:'sine', f:2100, t:0.8, v:0.18, delay:0.25}); },
  horn:      o=>{ tone(o,{type:'sawtooth', f:330, f2:300, t:0.35, v:0.25}); tone(o,{type:'square', f:440, f2:400, t:0.35, v:0.12}); },
  phone:     o=>{ for(let i=0;i<4;i++){ tone(o,{type:'square', f:1300, t:0.05, v:0.1, delay:i*0.1}); tone(o,{type:'square', f:1700, t:0.05, v:0.1, delay:i*0.1+0.05}); } },
  fart:      o=>{ tone(o,{type:'sawtooth', f:90, f2:60, t:0.6, v:0.25}); noise(o,{t:0.6, v:0.15, f:200, kind:'brown'}); },
  swing:     o=>noise(o,{t:0.2, v:0.25, f:600, f2:2400, filter:'bandpass', q:2}),
  hit:       o=>{ noise(o,{t:0.15, v:0.6, f:500, kind:'brown'}); tone(o,{type:'square', f:110, f2:60, t:0.12, v:0.2}); },
  hitMetal:  o=>{ tone(o,{type:'triangle', f:900, f2:700, t:0.3, v:0.2}); noise(o,{t:0.08, v:0.3, f:3000, filter:'bandpass'}); },
  gun:       o=>{ noise(o,{t:0.5, v:0.9, f:3000, f2:200}); tone(o,{type:'square', f:80, f2:30, t:0.3, v:0.4}); },
  explosion: o=>{ noise(o,{t:1.6, v:1.0, f:1800, f2:60, kind:'brown'}); tone(o,{type:'sine', f:70, f2:25, t:1.2, v:0.6}); },
  beep:      o=>tone(o,{type:'square', f:1250, t:0.06, v:0.12}),
  mineClick: o=>{ tone(o,{type:'square', f:2000, t:0.04, v:0.2}); tone(o,{type:'square', f:900, t:0.12, v:0.2, delay:0.05}); },
  turretBeep:o=>{ tone(o,{type:'square', f:1800, t:0.08, v:0.1}); tone(o,{type:'square', f:1800, t:0.08, v:0.1, delay:0.15}); },
  turretFire:o=>{ noise(o,{t:0.07, v:0.6, f:2500, filter:'highpass'}); tone(o,{type:'square', f:200, t:0.04, v:0.2}); },
  crusher:   o=>{ noise(o,{t:0.6, v:0.9, f:300, kind:'brown'}); tone(o,{type:'square', f:50, f2:30, t:0.4, v:0.4}); },
  chirp:     o=>{ tone(o,{type:'square', f:1800+GR()*600, f2:2600, t:0.07, v:0.06}); tone(o,{type:'square', f:2200, f2:1700, t:0.07, v:0.06, delay:0.09}); },
  screech:   o=>{ tone(o,{type:'sawtooth', f:900, f2:2400, t:0.4, v:0.25}); noise(o,{t:0.4, v:0.2, f:3000, filter:'bandpass', q:3}); },
  growl:     o=>{ tone(o,{type:'sawtooth', f:60, f2:45, t:0.8, v:0.25}); noise(o,{t:0.8, v:0.25, f:300, kind:'brown'}); },
  breath:    o=>noise(o,{t:0.9, a:0.3, v:0.15, f:500, filter:'bandpass', q:0.8}),
  roar:      o=>{ tone(o,{type:'sawtooth', f:120, f2:50, t:1.8, v:0.4}); noise(o,{t:1.8, a:0.2, v:0.5, f:500, f2:150, kind:'brown'}); },
  giantStep: o=>{ noise(o,{t:0.5, v:0.7, f:150, kind:'brown'}); tone(o,{type:'sine', f:45, f2:30, t:0.4, v:0.4}); },
  rumble:    o=>noise(o,{t:2.5, a:0.6, v:0.6, f:120, kind:'brown'}),
  boing:     o=>{ tone(o,{type:'sine', f:200, f2:600, t:0.25, v:0.3}); tone(o,{type:'triangle', f:600, f2:150, t:0.35, v:0.2, delay:0.2}); },
  springStep:o=>{ tone(o,{type:'triangle', f:300, f2:500, t:0.12, v:0.2}); noise(o,{t:0.1, v:0.2, f:900}); },
  slime:     o=>noise(o,{t:0.6, a:0.2, v:0.25, f:250, kind:'brown', filter:'lowpass'}),
  skitter:   o=>{ for(let i=0;i<5;i++) noise(o,{t:0.03, v:0.15, f:3500, filter:'bandpass', q:4, delay:i*0.05}); },
  popScream: o=>{ tone(o,{type:'sawtooth', f:400, f2:1600, t:1.2, v:0.35}); tone(o,{type:'square', f:620, f2:1900, t:1.2, v:0.2}); noise(o,{t:1.0, v:0.3, f:2000, filter:'bandpass'}); },
  hum:       o=>tone(o,{type:'triangle', f:330, t:0.25, v:0.08}),
  kill:      o=>{ noise(o,{t:0.35, v:0.9, f:900, kind:'brown'}); tone(o,{type:'square', f:120, f2:40, t:0.3, v:0.3}); noise(o,{t:0.12, v:0.5, f:4000, filter:'highpass', delay:0.05}); },
  hurt:      o=>{ noise(o,{t:0.2, v:0.5, f:700, kind:'brown'}); tone(o,{type:'sawtooth', f:180, f2:90, t:0.2, v:0.15}); },
  thunder:   o=>{ noise(o,{t:3.0, a:0.02, v:0.9, f:900, f2:80, kind:'brown'}); },
  buy:       o=>{ tone(o,{type:'square', f:780, t:0.07, v:0.1}); tone(o,{type:'square', f:1170, t:0.12, v:0.1, delay:0.08}); },
  key:       o=>tone(o,{type:'square', f:900+GR()*300, t:0.025, v:0.04}),
  error:     o=>{ tone(o,{type:'square', f:200, t:0.15, v:0.1}); },
  alarm:     o=>{ for(let i=0;i<3;i++){ tone(o,{type:'square', f:880, t:0.25, v:0.15, delay:i*0.6}); tone(o,{type:'square', f:660, t:0.25, v:0.15, delay:i*0.6+0.3}); } },
  engine:    o=>{ noise(o,{t:3.5, a:0.8, v:0.6, f:200, f2:90, kind:'brown'}); tone(o,{type:'sawtooth', f:40, f2:70, t:3.5, v:0.15}); },
  click:     o=>tone(o,{type:'square', f:2400, t:0.02, v:0.08}),
  flashbang: o=>{ noise(o,{t:2.2, v:1.0, f:6000, f2:500, filter:'lowpass'}); tone(o,{type:'sine', f:4000, t:2.5, v:0.12}); },
  stun:      o=>{ tone(o,{type:'sine', f:3000, f2:2800, t:1.5, v:0.08}); },
  spray:     o=>noise(o,{t:0.25, v:0.2, f:5000, filter:'highpass'}),
  heal:      o=>{ tone(o,{type:'sine', f:520, f2:780, t:0.25, v:0.12}); tone(o,{type:'sine', f:780, f2:1040, t:0.3, v:0.1, delay:0.15}); noise(o,{t:0.3, v:0.08, f:3000, filter:'highpass'}); },
  chat:      o=>{ tone(o,{type:'sine', f:880, t:0.06, v:0.06}); tone(o,{type:'sine', f:1320, t:0.08, v:0.05, delay:0.06}); },
  sell:      o=>{ [0,0.1,0.2,0.3].forEach((d,i)=>tone(o,{type:'square', f:600+i*200, t:0.1, v:0.08, delay:d})); },
  splat:     o=>noise(o,{t:0.3, v:0.5, f:700, kind:'brown'}),
  bite:      o=>{ noise(o,{t:0.2, v:0.8, f:1200, kind:'brown'}); tone(o,{type:'sawtooth', f:300, f2:80, t:0.2, v:0.3}); },
  laugh:     o=>{ for(let i=0;i<5;i++) tone(o,{type:'sawtooth', f:260-i*12, f2:200-i*10, t:0.12, v:0.12, delay:i*0.15}); },
  vent:      o=>{ noise(o,{t:0.6, v:0.35, f:900, filter:'bandpass', q:2}); for(let i=0;i<4;i++) tone(o,{type:'square', f:140, t:0.05, v:0.08, delay:i*0.12}); },
};
function sfx(name, pos=null, vol=1, maxDist=40, fromNet=false){
  if(pos && !fromNet && typeof netShareSfx==='function') netShareSfx(name, pos, vol, maxDist);
  if(!AC) return;
  const out = spatialOut(pos, vol, maxDist);
  if(out.gain.value < 0.003) return;
  if(ASSETS.sounds[name] && playFileSound(ASSETS.sounds[name], out)) return;
  const f = SFX[name]; if(f) f(out);
}

// ---- sons contínuos (loops) ----
const loops = {};
function loopStart(id, build){ if(!AC || loops[id]) return loops[id]; const g = AC.createGain(); g.gain.value = 0; g.connect(muffleFilter); loops[id] = {g, nodes:build(g)}; return loops[id]; }
function loopSetVolume(id, v){ const l = loops[id]; if(l) l.g.gain.setTargetAtTime(v, AC.currentTime, 0.15); }
function loopStop(id){ const l = loops[id]; if(!l) return; l.g.gain.setTargetAtTime(0, AC.currentTime, 0.1); setTimeout(()=>{ (l.nodes||[]).forEach(n=>{ try{n.stop();}catch(e){} }); l.g.disconnect(); }, 400); delete loops[id]; }
function stopAllLoops(){ Object.keys(loops).forEach(loopStop); }
function buildRainLoop(g){ const s = AC.createBufferSource(); s.buffer = _noiseBuf.white; s.loop = true; const f = AC.createBiquadFilter(); f.type='bandpass'; f.frequency.value=2200; f.Q.value=0.4; s.connect(f); f.connect(g); s.start(); return [s]; }
function buildWindLoop(g){ const s = AC.createBufferSource(); s.buffer = _noiseBuf.brown; s.loop = true; const f = AC.createBiquadFilter(); f.type='lowpass'; f.frequency.value=400; s.connect(f); f.connect(g); s.start(); return [s]; }
function buildHumLoop(g){ const o = AC.createOscillator(); o.type='sawtooth'; o.frequency.value=58; const f = AC.createBiquadFilter(); f.type='lowpass'; f.frequency.value=180; o.connect(f); f.connect(g); o.start(); return [o]; }
// Caixa de Música (melodia original, toca em loop e acelera)
let _musicBoxT = 0, _musicBoxIdx = 0;
const MUSIC_BOX_NOTES = [784,659,523,659,784,1047,988,784, 880,698,587,698,880,1175,1047,880];
function tickMusicBox(dt, pos, speed){
  _musicBoxT -= dt*speed;
  if(_musicBoxT <= 0){
    _musicBoxT = 0.28;
    const out = spatialOut(pos, 0.9, 45);
    if(out.gain.value > 0.003) tone(out,{type:'sine', f:MUSIC_BOX_NOTES[_musicBoxIdx%MUSIC_BOX_NOTES.length], t:0.35, v:0.18});
    _musicBoxIdx++;
  }
}

// música de fundo (arquivo do seu projeto)
const bgm = new Audio(); bgm.loop = true; bgm.volume = CONFIG.MUSIC_VOLUME;
function musicPlay(){ if(!bgm.src) bgm.src = CONFIG.MUSIC_SRC; bgm.play().catch(()=>{}); }
function musicStop(){ bgm.pause(); }
