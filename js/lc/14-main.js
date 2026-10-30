/*
 * ============================================================================
 *  14-main.js — MOVIMENTO DO JOGADOR E LOOP PRINCIPAL (último script carregado)
 * ============================================================================
 */

let gameStarted = false;

function tryJump(){
  if(!player.grounded || player.crouch || player.grabbedBy || player.stamina < 0.08) return;
  player.vy = CONFIG.PLAYER.jump * (carriedWeight()>60 ? 0.8 : 1);
  player.grounded = false; player.stamina -= 0.08;
  sfx('jump', null, 0.5);
  makeNoise(player.pos.x, player.pos.z, 10, player.inFacility);
}

function updatePlayer(dt){
  const P = CONFIG.PLAYER;
  if(player.invuln > 0) player.invuln -= dt;
  if(player.stunned > 0) player.stunned -= dt;
  if(player.regenDelay > 0) player.regenDelay -= dt;
  else if(player.hp < 20) player.hp = Math.min(20, player.hp + dt*2);
  player.slowed = Math.max(0, (player.slowed||0) - dt*0.8);

  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
  const rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
  let mx = 0, mz = 0;
  if(kdown('frente')){ mx += fx; mz += fz; }
  if(kdown('tras')){ mx -= fx; mz -= fz; }
  if(kdown('direita')){ mx += rx; mz += rz; }
  if(kdown('esquerda')){ mx -= rx; mz -= rz; }
  // controle analógico (joystick de toque / gamepad) — ver 15-controles.js
  if(INPUT.moveX || INPUT.moveY){ mx += fx*INPUT.moveY + rx*INPUT.moveX; mz += fz*INPUT.moveY + rz*INPUT.moveX; }
  const ml = Math.hypot(mx, mz);
  const grabbed = !!player.grabbedBy;
  player.crouch = (kdown('agachar') || INPUT.crouch) && player.grounded && !grabbed;
  const wantSprint = (kdown('correr') || INPUT.sprint) && ml > 0 && !player.crouch;
  if(player.stamina <= 0.01) player.exhausted = true;
  if(player.exhausted && player.stamina > 0.3) player.exhausted = false;
  player.sprinting = wantSprint && !player.exhausted && player.grounded;
  const w = carriedWeight();
  let speed = player.crouch ? P.crouch : (player.sprinting ? P.sprint : P.walk);
  speed *= Math.max(0.5, 1 - w*P.weightSlowPerLb);
  if(player.exhausted) speed *= 0.75;
  if(player.slowed > 0) speed *= 1 - Math.min(0.7, player.slowed);
  if(player.stunned > 0) speed *= 0.5;
  if(grabbed) speed = 0;
  // teias
  if(player.inFacility && FAC.webs && FAC.webs.length){
    for(const wb of FAC.webs){ if(Math.hypot(wb.x-player.pos.x, wb.z-player.pos.z) < 0.9){ player.slowed = 0.65; if(wb.owner && wb.owner.alive && wb.owner.state!=='hunt'){ wb.owner.state='hunt'; wb.owner.timer = 10; wb.owner.alertPos = {x:player.pos.x, z:player.pos.z}; } } }
  }
  const sx = player.pos.x, sz = player.pos.z;
  if(ml > 0 && speed > 0){
    const air = player.grounded ? 1 : 0.85;
    moveEntity(player.pos, mx/ml*speed*air*dt, mz/ml*speed*air*dt, P.radius, player.inFacility);
  }
  const moved = Math.hypot(player.pos.x-sx, player.pos.z-sz);
  player.vel.set((player.pos.x-sx)/dt, (player.pos.z-sz)/dt);
  player.moving = moved > 0.002;
  // fôlego
  if(player.sprinting && player.moving) player.stamina = Math.max(0, player.stamina - dt*P.staminaDrain*(1 + w/120));
  else player.stamina = Math.min(1, player.stamina + dt*P.staminaRegen*(player.moving?0.7:1)*(w>80?0.6:1));

  // vertical
  const ground = groundAt(player.pos.x, player.pos.z, player.inFacility);
  if(player.grounded){
    if(ground < player.pos.y - 0.7){ player.grounded = false; player.vy = 0; }
    else player.pos.y = ground;
  }
  if(!player.grounded){
    player.vy -= P.gravity*dt;
    player.pos.y += player.vy*dt;
    if(player.inFacility && player.pos.y + P.eye > FAC.H-0.1){ player.pos.y = FAC.H-0.1-P.eye; player.vy = Math.min(0, player.vy); }
    if(player.pos.y <= ground){
      if(player.vy < -13) damagePlayer(Math.round((-player.vy-13)*12), 'Queda');
      player.pos.y = ground; player.grounded = true;
      if(player.vy < -4){ sfx('land', null, 0.6); makeNoise(player.pos.x, player.pos.z, 8, player.inFacility); }
      player.vy = 0;
    }
  }
  if(player.pos.y < -45 && !player.inFacility) killPlayer('Caiu num buraco');
  // passos
  if(player.grounded && player.moving){
    player.stepTimer -= moved;
    if(player.stepTimer <= 0){
      player.stepTimer = player.sprinting ? 2.1 : (player.crouch ? 1.1 : 1.6);
      const onMetal = playerInShip() || player.inFacility && FAC.theme==='fabrica';
      sfx(onMetal?'stepMetal':'step', null, player.crouch?0.25:(player.sprinting?0.8:0.5));
      makeNoise(player.pos.x, player.pos.z, player.crouch ? 1.2 : (player.sprinting ? 14 : 5.5), player.inFacility);
    }
  }
  // câmera
  const eyeT = player.crouch ? P.eyeCrouch : P.eye;
  player.eyeY += (eyeT - player.eyeY)*Math.min(1, dt*10);
  let camY = player.pos.y + player.eyeY;
  if(player.grabbedBy && player.grabbedBy.type==='colosso'){ camY = player.grabbedBy.pos.y + 11 + Math.sin(performance.now()*0.004)*0.3; }
  player.camY += (camY - player.camY)*Math.min(1, dt*(player.grounded?18:40));
  if(!player.grounded) player.camY = camY;
  shake = Math.max(0, shake - dt*1.2);
  const sh = shake*shake*0.25;
  camera.position.set(player.pos.x + rand(-sh,sh), player.camY + rand(-sh,sh), player.pos.z + rand(-sh,sh));
  camera.rotation.y = player.yaw; camera.rotation.x = player.pitch;
  camera.rotation.z = player.grabbedBy ? Math.sin(performance.now()*0.01)*0.1 : 0;
}

function updateAmbience(){
  if(!AC) return;
  if(S.phase==='moon' && S.moon && !S.moon.company){
    loopStart('hum', buildHumLoop);
    loopSetVolume('hum', player.inFacility ? (S.powerOn?0.05:0.0) : 0);
    loopSetVolume('wind', player.inFacility ? 0.0 : 0.12);
    loopSetVolume('rain', player.inFacility ? 0.03 : (playerInShip()?0.12:0.3));
  } else if(S.phase==='moon'){ loopSetVolume('wind', 0.06); }
}

let last = performance.now();
function frame(t){
  const dt = Math.min(0.05, (t-last)/1000); last = t;
  if(gameStarted){
    const active = !menuOpen && !transitioning;
    if(active && player.alive){
      updateControls(dt);
      updatePlayer(dt);
      if(S.phase==='moon'){
        if(!isNetClient()){ updateCreatures(dt); updateTraps(dt); updateDay(dt); }
      }
      updateThrown(dt); tickNoise(dt);
    }
    if(S.phase==='moon') updateRain(dt);
    animateDoors(dt); animateShip(dt);
    updateFlashlight(dt); updateSwing(dt); updateLightPool(dt, t); updateAmbience();
    updateHudFrame(dt);
    if(typeof netTick==='function') netTick(dt);
    if(skyStars && (S.phase==='orbit')) skyStars.position.copy(camera.position);
  } else {
    // tela de título: câmera parada dentro da nave, olhando pela janela
    camera.position.set(player.pos.x+2, player.camY, player.pos.z+0.3); camera.rotation.set(0.05, Math.PI/2 + Math.sin(t*0.0002)*0.15, 0);
    updateLightPool(0.016, t);
  }
  renderFrame(t);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// chamado pelo menu (16-menu.js) depois de escolher o save
function beginGame(skipOrbit){
  document.getElementById('start').style.display = 'none'; document.body.classList.remove('inMenu');
  audioInit();
  gameStarted = true; menuOpen = false;
  player.alive = true; player.hp = CONFIG.PLAYER.maxHp;
  if(!skipOrbit) loadOrbit();
  lockPointer();
  toast('Use o TERMINAL pra escolher a lua e a ALAVANCA na frente da nave pra pousar.', 6);
}
// tela de título: mostra a nave em órbita ao fundo
loadOrbit(); musicStop();
