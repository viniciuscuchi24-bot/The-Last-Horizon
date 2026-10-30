/*
 * ============================================================================
 *  11-terminal.js — O TERMINAL DA NAVE (digite comandos, igual ao original)
 * ============================================================================
 *  Comandos: AJUDA, LUAS, ROTA <lua>, LOJA, COMPRAR <item> [qtd], BESTIARIO [nome],
 *            SCAN, CLIMA, OUTROS e os códigos das armadilhas (ex: C4)
 * ============================================================================
 */

const termEl = document.getElementById('terminal');
const termOut = document.getElementById('termOut');
const termIn = document.getElementById('termIn');
let terminalOpen = false;

function norm(s){ return (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim(); }
function findMoon(q){
  q = norm(q); if(!q) return null;
  return MOONS.find(m=>norm(m.name)===q || norm(m.id)===q) || MOONS.find(m=>norm(m.name).includes(q) || norm(m.id).startsWith(q));
}
function findStore(q){
  q = norm(q); if(!q) return null;
  return STORE.find(s=>norm(TOOLS[s.tool].name)===q || s.tool===q) || STORE.find(s=>norm(TOOLS[s.tool].name).includes(q) || s.tool.startsWith(q));
}
function termHeader(){ return `CRÉDITOS: $${S.credits}     COTA: $${S.soldThisQuota}/$${S.quota}     PRAZO: ${S.daysLeft} dia(s)`; }
function termPrint(text){ termOut.textContent = termHeader() + '\n' + '─'.repeat(58) + '\n\n' + text; termOut.scrollTop = 0; }

function openTerminal(){
  terminalOpen = true; menuOpen = true;
  termEl.style.display = 'flex';
  document.exitPointerLock && document.exitPointerLock();
  termPrint(TERM_HELP());
  termIn.value = ''; setTimeout(()=>termIn.focus(), 30);
  if(SHIP.termScreen) SHIP.termScreen.userData.redraw(['> EM USO...']);
}
function closeTerminal(){
  terminalOpen = false; menuOpen = false;
  termEl.style.display = 'none'; termIn.blur();
  if(SHIP.termScreen) SHIP.termScreen.userData.redraw(['> TERMINAL','','digite AJUDA']);
  lockPointer();
}
termIn.addEventListener('keydown', e=>{
  e.stopPropagation();
  if(e.key==='Escape'){ closeTerminal(); return; }
  if(e.key==='Enter'){ const v = termIn.value; termIn.value=''; runCommand(v); return; }
  sfx('key');
});
termIn.addEventListener('keyup', e=>e.stopPropagation());
document.getElementById('termClose').addEventListener('click', closeTerminal);

const TERM_HELP = ()=>`>AJUDA

Bem-vindo ao terminal da Empresa.

>LUAS
Lista as luas, o clima de hoje e o preço da rota.

>ROTA [lua]
Define o destino (só em órbita). Ex: ROTA FERRUGEM

>LOJA
Lista os itens à venda.

>COMPRAR [item] [quantidade]
Ex: COMPRAR LANTERNA 2   (entregue na nave)

>BESTIARIO [criatura]
Registros das criaturas que você escaneou.

>SCAN
Conta a sucata que ainda está na lua.

>OUTROS
Mais comandos e dicas.

Digite ESC para sair.`;

function runCommand(raw, fromNet){
  const parts = norm(raw).split(/\s+/).filter(Boolean);
  if(isNetClient() && parts.length && (/^[a-z][0-9]$/.test(parts[0]) || ['rota','route','ir','comprar','buy'].includes(parts[0]))){
    netRelay('term', {raw}); termPrint('Pedido enviado ao host: ' + raw.toUpperCase() + '\n\n(o host da sala executa compras, rotas e códigos)'); return;
  }
  if(!parts.length){ termPrint(TERM_HELP()); return; }
  const cmd = parts[0], arg = parts.slice(1).join(' ');
  // códigos de armadilha (ex: c4)
  if(/^[a-z][0-9]$/.test(cmd)){
    if(S.phase!=='moon'){ termPrint('Nenhum objeto com esse código.'); return; }
    if(disableTrapByCode(cmd)){ sfx('buy'); termPrint(`Objeto ${cmd.toUpperCase()} desativado por ${TRAPS.TERMINAL_DISABLE_SECONDS} segundos.`); }
    else { sfx('error'); termPrint(`Nenhum objeto com o código ${cmd.toUpperCase()}.`); }
    return;
  }
  switch(cmd){
    case 'ajuda': case 'help': case '?': termPrint(TERM_HELP()); break;
    case 'luas': case 'moons': case 'lua': {
      const lines = MOONS.map(m=>{
        const w = S.weather[m.id]; const wt = (w && w!=='none') ? `(${WEATHERS[w].name})` : '';
        const cost = m.cost ? `$${m.cost}` : '';
        return `* ${m.name.padEnd(12)} ${wt.padEnd(15)} ${('Risco '+m.risk).padEnd(9)} ${cost}`;
      });
      const rate = Math.round((CONFIG.SELL_RATE_BY_DAYS_LEFT[S.daysLeft] ?? 1)*100);
      termPrint(`>LUAS\n\nA Empresa está pagando ${rate}% hoje.\n\n${lines.join('\n')}\n\nRota atual: ${(MOONS.find(m=>m.id===S.routeMoon)||{}).name||'-'}\n\nDigite ROTA [nome] para viajar. Digite INFO [nome] para detalhes.`);
      break;
    }
    case 'info': {
      const m = findMoon(arg); if(!m){ termPrint('Lua não encontrada. Digite LUAS.'); return; }
      const w = S.weather[m.id];
      termPrint(`>${m.name.toUpperCase()}\n\nRisco: ${m.risk}\nClima hoje: ${WEATHERS[w].name} — ${WEATHERS[w].desc}\nPreço da rota: ${m.cost?('$'+m.cost):'grátis'}\n\n${m.desc}`);
      break;
    }
    case 'rota': case 'route': case 'ir': {
      const m = findMoon(arg); if(!m){ termPrint('Lua não encontrada. Digite LUAS para ver a lista.'); sfx('error'); return; }
      if(S.phase!=='orbit'){ termPrint('A nave precisa estar em órbita para mudar a rota.\nPuxe a alavanca para decolar primeiro.'); sfx('error'); return; }
      if(m.id===S.routeMoon){ termPrint(`A rota já está definida para ${m.name}.\nPuxe a alavanca para pousar.`); return; }
      if(m.cost > S.credits){ termPrint(`Créditos insuficientes. A rota para ${m.name} custa $${m.cost}.`); sfx('error'); return; }
      S.credits -= m.cost; S.routeMoon = m.id; sfx('buy');
      termPrint(`Rota definida: ${m.name}.${m.cost?`\nCusto: $${m.cost}.`:''}\nClima: ${WEATHERS[S.weather[m.id]].name}.\n\nPuxe a alavanca na frente da nave para pousar.`);
      updateHud();
      break;
    }
    case 'loja': case 'store': {
      const lines = STORE.map(s=>`* ${TOOLS[s.tool].name.padEnd(26)} $${s.price}`);
      termPrint(`>LOJA\n\n${lines.join('\n')}\n\nDigite COMPRAR [item] [quantidade].\nOs itens aparecem no chão da nave, perto da porta.`);
      break;
    }
    case 'comprar': case 'buy': {
      let qty = 1; const m = arg.match(/^(.*?)\s+(\d+)$/); let name = arg;
      if(m){ name = m[1]; qty = clamp(parseInt(m[2]),1,12); }
      const s = findStore(name); if(!s){ termPrint('Item não encontrado. Digite LOJA.'); sfx('error'); return; }
      const total = s.price*qty;
      if(total > S.credits){ termPrint(`Créditos insuficientes. ${qty}x ${TOOLS[s.tool].name} = $${total}.`); sfx('error'); return; }
      S.credits -= total;
      for(let k=0;k<qty;k++) deliverPurchase(s.tool);
      sfx('buy');
      termPrint(`Você comprou ${qty}x ${TOOLS[s.tool].name} por $${total}.\nNovo saldo: $${S.credits}.\n\nOs itens estão no chão da nave.`);
      updateHud();
      break;
    }
    case 'bestiario': case 'bestiary': case 'criaturas': {
      if(!arg){
        const list = Object.entries(CREATURES).map(([id,c])=> S.discovered.has(id) ? `* ${c.name}` : '* ???');
        termPrint(`>BESTIÁRIO\n\nEscaneie criaturas (clique direito) para registrá-las.\n\n${list.join('\n')}\n\nDigite BESTIARIO [nome].`);
        return;
      }
      const e = Object.entries(CREATURES).find(([id,c])=>norm(c.name).includes(norm(arg)) || id.startsWith(norm(arg)));
      if(!e || !S.discovered.has(e[0])){ termPrint('Registro não encontrado. Escaneie a criatura primeiro.'); sfx('error'); return; }
      termPrint(`>${e[1].name.toUpperCase()}\n\n${e[1].bestiary}\n\n${e[1].hp===null?'Classificação: IMORTAL':'Resistência: '+e[1].hp+' golpes de pá'}\nOnde: ${e[1].zone==='in'?'dentro das instalações':'do lado de fora'}`);
      break;
    }
    case 'scan': {
      if(S.phase!=='moon' || !S.moon || S.moon.company){ termPrint('Nada para escanear aqui.'); return; }
      const left = worldItems.filter(it=>it.kind==='scrap' && !isInsideShip(it.pos.x,it.pos.z) && !it.mimicOf);
      const val = left.reduce((s,it)=>s+it.value,0);
      termPrint(`Há ${left.length} objetos fora da nave, valendo aproximadamente $${val}.\n\nSucata dentro da nave: $${shipScrapValue()}.`);
      break;
    }
    case 'clima': case 'weather': {
      termPrint('>CLIMA\n\n' + Object.values(WEATHERS).map(w=>`* ${w.name.padEnd(13)} ${w.desc}`).join('\n'));
      break;
    }
    case 'outros': case 'other': {
      termPrint(`>OUTROS\n\n>INFO [lua]  — detalhes de uma lua
>CLIMA       — o que cada clima faz
>[código]    — desliga uma torreta/mina/esmagador por ${TRAPS.TERMINAL_DISABLE_SECONDS}s
              (o código aparece sobre ela, ex: C4)

DICAS
- Largue a sucata DENTRO da nave (G) pra ela ficar guardada.
- Venda no 71-Posto. No último dia a Empresa paga 100%.
- A nave decola sozinha à meia-noite. Quem ficar fora morre.
- Se todos morrerem, toda a sucata da nave é perdida.
- Itens de metal atraem raios no clima Tempestuoso.`);
      break;
    }
    case 'sair': case 'exit': case 'quit': closeTerminal(); break;
    default:
      if(findMoon(cmd)){ runCommand('info '+cmd); return; }
      if(findStore(cmd)){ runCommand('comprar '+parts.join(' ')); return; }
      sfx('error'); termPrint(`[Comando "${raw.toUpperCase()}" não reconhecido]\n\n` + TERM_HELP());
  }
}
function deliverPurchase(toolId){
  if(SHIP.group){
    const n = worldItems.filter(it=>isInsideShip(it.pos.x,it.pos.z)).length;
    const it = makeToolItem(toolId);
    placeItemInWorld(it, SHIP.x+4.6+((n%4)-1.5)*0.45, SHIP.floorY, SHIP.z-1.4+Math.floor(n/4)%5*0.45, false);
  } else S.pendingDeliveries.push(toolId);
}
