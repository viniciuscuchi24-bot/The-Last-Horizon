/*
 * ============================================================================
 *  00-config.js — CONFIGURAÇÃO E CATÁLOGOS (o arquivo mais fácil de mexer)
 * ============================================================================
 *  Tudo que é "número de jogo" ou "conteúdo" mora aqui:
 *    CONFIG      → duração do dia, cota inicial, velocidade do jogador, visual
 *    WEATHERS    → climas
 *    MOONS       → luas (planetas): risco, preço da rota, clima, monstros...
 *    SCRAP       → sucata (itens que você vende)
 *    TOOLS       → ferramentas (itens que você usa) e a LOJA
 *    CREATURES   → criaturas + texto do bestiário
 *    TRAPS       → armadilhas
 *  O lugar pra trocar MODELOS 3D e SPRITES 2D é o arquivo 01-assets.js.
 * ============================================================================
 */

// Gerador de números aleatórios do jogo. É separado do Math.random porque o three.js
// também usa o Math.random por dentro; assim a "semente" de cada lua gera exatamente
// o mesmo mapa em todos os computadores do multiplayer.
const rawRandom = Math.random.bind(Math);
let _grFn = rawRandom;
function GR(){ return _grFn(); }

const CONFIG = {
  // ---- tempo ----
  DAY_LENGTH_SECONDS: 1500,  // quanto dura (em segundos reais) das 08:00 até a meia-noite. 1500 = 25 min
  DAY_START_HOUR: 8,
  DAY_END_HOUR: 24,          // a nave decola sozinha nesse horário
  WARNING_HOUR: 23,          // aviso "a nave vai partir à meia-noite"

  // ---- economia ----
  DEADLINE_DAYS: 3,          // dias até o prazo da cota
  START_CREDITS: 60,
  START_QUOTA: 130,
  // % pago pela Empresa conforme os dias restantes (igual ao jogo original: começa baixo, 100% no último dia)
  SELL_RATE_BY_DAYS_LEFT: {3: 0.30, 2: 0.53, 1: 0.77, 0: 1.00},
  DEATH_FINE_PERCENT: 0.2,   // multa sobre os créditos quando a tripulação inteira morre

  // ---- jogador ----
  PLAYER: {
    walk: 4.4, sprint: 7.0, crouch: 2.0,
    jump: 5.2, gravity: 16,
    eye: 1.62, eyeCrouch: 1.0, radius: 0.38,
    maxHp: 100,
    staminaDrain: 0.21, staminaRegen: 0.15,
    weightSlowPerLb: 0.0045,   // cada libra carregada deixa você um pouco mais lento
    maxStep: 0.55,             // degrau máximo que dá pra subir sem pular
  },
  INVENTORY_SLOTS: 4,
  MOUSE_SENS: 0.0022,
  FOV: 72,

  // ---- visual (estilo "câmera de segurança" do jogo original) ----
  RENDER_HEIGHT: 520,        // resolução interna; menor = mais pixelado e mais leve
  POSTERIZE: true,           // reduz as cores, igual ao filtro do original
  POSTERIZE_LEVELS: 24,
  FILM_GRAIN: 0.05,
  HUD_COLOR: '#ff7a1a',

  // ---- música (só a bordo, em órbita) ----
  MUSIC_SRC: 'audio/bgm.mp3',
  MUSIC_VOLUME: 0.18,
  SFX_VOLUME: 0.8,

  // ---- contas online (banco de dados) ----
  // Opção 1 (mais fácil): abrir o jogo pelo servidor/servidor.js → as contas ficam no servidor.
  //   Se o jogo estiver no GitHub Pages e o servidor em outro lugar, coloque o endereço aqui:
  SERVER_URL: '',            // ex: 'https://the-last-horizon.onrender.com'
  // Opção 2: Firebase (Google), grátis e fica online 24h. Cole aqui a configuração do seu projeto
  //   (veja o LEIA-ME). Se apiKey ficar vazio, o Firebase não é usado.
  FIREBASE: {apiKey:'', authDomain:'', projectId:'', appId:''},
  // servidores pra conexão direta (P2P) no multiplayer por código
  ICE_SERVERS: [{urls:'stun:stun.l.google.com:19302'}, {urls:'stun:stun1.l.google.com:19302'}],

  // ---- debug ----
  DEBUG_KEYS: false,         // true = F9 dá $1000, F10 pula pra 23:00, F11 mostra o mapa da instalação
};

// =============================================================================
//  CLIMAS
// =============================================================================
const WEATHERS = {
  none:    {name:'Limpo',        desc:'Sem alterações.'},
  rain:    {name:'Chuvoso',      desc:'Chuva forte. Visibilidade reduzida.'},
  fog:     {name:'Neblina',      desc:'Neblina densa do lado de fora.'},
  storm:   {name:'Tempestuoso',  desc:'Raios caem em objetos de metal. Guarde o metal no bolso!'},
  eclipse: {name:'Eclipsado',    desc:'Escuridão total. Criaturas de fora aparecem desde o pouso.'},
};

// =============================================================================
//  LUAS
//  terrain: 'proc' = terreno gerado por código | 'model' = usa modelo 3D (veja ASSETS.exteriors)
//  facility.cells = quantas "salas" a instalação tem (min,max)
//  indoor/outdoor.power = "orçamento" de monstros (cada criatura custa CREATURES[x].power)
// =============================================================================
const MOONS = [
  {
    id:'ferrugem', name:'12-Ferrugem', risk:'D', cost:0,
    desc:'Deserto enferrujado e quente. Pouca sucata, poucas ameaças. Bom pra começar.',
    terrain:'proc',
    look:{biome:'deserto', ground:'#8a5430', ground2:'#5a3420', rock:'#6e4028', skyDay:'#d9a46a', skyNight:'#1a0d08', fog:0.010, amp:7, freq:0.016, mountains:2.2, rocks:60, trees:0, treeColor:'#000'},
    weathers:['none','none','rain','fog','storm'],
    facility:{cells:[14,18], theme:{fabrica:1, mansao:0}},
    scrap:{count:[9,13], valueMul:0.9},
    indoor:{power:5, weights:{juntador:5, lacrador:4, gosma:2, tecela:2, mimico_sucata:2, sosia:1}},
    outdoor:{power:2, startHour:16, weights:{farejador:1, verme:2}},
    traps:{turrets:[0,1], mines:[2,4], crushers:[0,1], mimicDoors:[0,1]},
  },
  {
    id:'cinzal', name:'33-Cinzal', risk:'D', cost:0,
    desc:'Morros de cinza vulcânica. Um verme enorme vive sob a superfície.',
    terrain:'proc',
    look:{biome:'cinzas', ground:'#5a5856', ground2:'#2e2d2c', rock:'#3d3b3a', skyDay:'#8f9aa3', skyNight:'#07090c', fog:0.014, amp:10, freq:0.014, mountains:2.0, rocks:45, trees:0, treeColor:'#000'},
    weathers:['none','rain','fog','storm','eclipse'],
    facility:{cells:[16,22], theme:{fabrica:3, mansao:1}},
    scrap:{count:[11,15], valueMul:1.0},
    indoor:{power:6, weights:{juntador:4, lacrador:3, rasteiro:3, tecela:3, espreitador:1, mimico_sucata:2, gosma:1}},
    outdoor:{power:3, startHour:14, weights:{farejador:2, verme:3}},
    traps:{turrets:[1,2], mines:[3,5], crushers:[0,2], mimicDoors:[0,1]},
  },
  {
    id:'musgo', name:'47-Musgo', risk:'C', cost:0,
    desc:'Floresta úmida e enevoada. Colossos caminham entre as árvores durante o dia.',
    terrain:'proc',
    look:{biome:'floresta', ground:'#3e5a2c', ground2:'#22331a', rock:'#4a4f44', skyDay:'#9fb59a', skyNight:'#05080a', fog:0.02, amp:8, freq:0.018, mountains:1.8, rocks:30, trees:260, treeColor:'#1f3a22'},
    weathers:['none','fog','fog','rain','storm'],
    facility:{cells:[18,24], theme:{fabrica:2, mansao:2}},
    scrap:{count:[13,18], valueMul:1.15},
    indoor:{power:7, weights:{juntador:3, lacrador:3, espreitador:3, sosia:2, tecela:2, caixa_musica:1, mimico_sucata:2}},
    outdoor:{power:4, startHour:9, weights:{colosso:3, farejador:2}},
    traps:{turrets:[1,2], mines:[3,6], crushers:[1,2], mimicDoors:[1,2]},
  },
  {
    id:'fornalha', name:'21-Fornalha', risk:'B', cost:0,
    desc:'Cânion industrial abandonado, com tanques de combustível e uma fábrica enorme.',
    terrain:'model', exterior:'fornalha', // usa o seu scene.gltf (ASSETS.exteriors.fornalha)
    look:{biome:'deserto', ground:'#8a5a34', ground2:'#5a3720', rock:'#6d4428', skyDay:'#d4935a', skyNight:'#120806', fog:0.010, amp:8, freq:0.016, mountains:2.0, rocks:40, trees:0, treeColor:'#000'},
    weathers:['none','rain','storm','eclipse','fog'],
    facility:{cells:[20,26], theme:{fabrica:1, mansao:0}},
    scrap:{count:[14,19], valueMul:1.2},
    indoor:{power:9, weights:{rasteiro:4, manequim:2, juntador:3, tecela:3, sentinela:2, lacrador:2, mimico_sucata:2, gosma:1}},
    outdoor:{power:5, startHour:13, weights:{farejador:3, verme:2}},
    traps:{turrets:[2,4], mines:[4,7], crushers:[1,3], mimicDoors:[1,2]},
  },
  {
    id:'geada', name:'88-Geada', risk:'A', cost:550,
    desc:'Planície congelada sob nevasca. Uma mansão antiga cheia de objetos caros... e coisas famintas.',
    terrain:'proc',
    look:{biome:'neve', ground:'#a9b4bc', ground2:'#7e8a93', rock:'#6e7880', skyDay:'#b8c4cc', skyNight:'#040608', fog:0.026, amp:9, freq:0.016, mountains:2.6, rocks:35, trees:150, treeColor:'#26352c'},
    weathers:['none','fog','storm','eclipse'],
    facility:{cells:[24,30], theme:{fabrica:1, mansao:3}},
    scrap:{count:[18,24], valueMul:1.6},
    indoor:{power:13, weights:{caixa_musica:3, manequim:3, espreitador:3, sentinela:3, sosia:2, tecela:2, lacrador:2, juntador:2, mimico_sucata:3}},
    outdoor:{power:6, startHour:11, weights:{farejador:3, colosso:3}},
    traps:{turrets:[3,5], mines:[5,8], crushers:[2,4], mimicDoors:[2,3]},
  },
  {
    id:'abismo', name:'09-Abismo', risk:'S', cost:700,
    desc:'Uma lua vermelha onde o sol quase não aparece. A instalação é gigantesca e ninguém volta igual.',
    terrain:'proc',
    look:{biome:'abismo', ground:'#4a1e1c', ground2:'#220c0b', rock:'#311413', skyDay:'#7a3028', skyNight:'#050101', fog:0.022, amp:12, freq:0.012, mountains:2.4, rocks:60, trees:0, treeColor:'#000'},
    weathers:['eclipse','eclipse','storm','fog'],
    facility:{cells:[30,38], theme:{fabrica:1, mansao:1}},
    scrap:{count:[24,32], valueMul:2.1},
    indoor:{power:18, weights:{caixa_musica:3, manequim:3, espreitador:3, sentinela:3, sosia:3, rasteiro:3, tecela:2, lacrador:2, juntador:2, gosma:2, mimico_sucata:3}},
    outdoor:{power:8, startHour:8, weights:{farejador:3, colosso:2, verme:2}},
    traps:{turrets:[4,7], mines:[6,10], crushers:[3,5], mimicDoors:[2,4]},
  },
  {
    id:'posto', name:'71-Posto', risk:'—', cost:0, company:true,
    desc:'O posto da Empresa. Venda sua sucata no balcão. Não há perigo aqui... provavelmente.',
    terrain:'company',
    look:{ground:'#3a3a3c', ground2:'#262628', rock:'#444', skyDay:'#6f7a86', skyNight:'#0b0d10', fog:0.02, amp:0, freq:0, rocks:0, trees:0, treeColor:'#000'},
    weathers:['none'],
  },
];

// =============================================================================
//  SUCATA — o que você coleta e vende.
//  min/max = valor base ($) | lb = peso | twoHanded = ocupa as duas mãos
//  metal = atrai raios no clima Tempestuoso
//  shape = placeholder (box/cyl/sphere/cone/torus/flat) até você trocar por modelo/sprite em 01-assets.js
//  use = comportamento especial ao clicar: 'horn' (faz barulho), 'flashbang', 'weapon', 'light'
// =============================================================================
const SCRAP = [
  {id:'parafuso',    name:'Parafuso grande',     min:20, max:32,  lb:19, metal:true,  shape:{t:'cyl', s:[0.12,0.5], c:'#8c8c8c'}},
  {id:'garrafas',    name:'Garrafas',            min:22, max:52,  lb:19,              shape:{t:'cyl', s:[0.18,0.42], c:'#3f7a4a'}},
  {id:'sino',        name:'Sino de bronze',      min:48, max:80,  lb:24, metal:true,  shape:{t:'cone', s:[0.25,0.38], c:'#b5852a'}, use:'horn', sound:'bell'},
  {id:'doces',       name:'Doces',               min:6,  max:36,  lb:11,              shape:{t:'box', s:[0.3,0.12,0.2], c:'#d64b8a'}},
  {id:'caixa_reg',   name:'Caixa registradora',  min:80, max:160, lb:84, metal:true,  twoHanded:true, shape:{t:'box', s:[0.6,0.4,0.5], c:'#5a5f66'}, use:'horn', sound:'register'},
  {id:'galao',       name:'Galão químico',       min:32, max:84,  lb:32,              twoHanded:true, shape:{t:'box', s:[0.35,0.55,0.3], c:'#d6c83a'}},
  {id:'buzina',      name:'Buzina de palhaço',   min:52, max:72,  lb:3,               shape:{t:'cone', s:[0.12,0.3], c:'#d63a3a'}, use:'horn', sound:'horn'},
  {id:'caneca',      name:'Caneca de café',      min:24, max:68,  lb:5,               shape:{t:'cyl', s:[0.1,0.16], c:'#e8e2d0'}},
  {id:'mascara_c',   name:'Máscara de comédia',  min:28, max:52,  lb:11,              shape:{t:'flat', s:[0.3,0.36], c:'#e8e2d0'}},
  {id:'mascara_t',   name:'Máscara de tragédia', min:28, max:52,  lb:11,              shape:{t:'flat', s:[0.3,0.36], c:'#cfc8b0'}},
  {id:'forma',       name:'Forma de biscoito',   min:12, max:40,  lb:16, metal:true,  shape:{t:'box', s:[0.4,0.05,0.3], c:'#9aa3ab'}},
  {id:'pa_lixo',     name:'Pá de lixo',          min:12, max:32,  lb:5,               shape:{t:'box', s:[0.3,0.05,0.35], c:'#3a6ad6'}},
  {id:'batedor',     name:'Batedor de ovos',     min:12, max:44,  lb:11, metal:true,  shape:{t:'cyl', s:[0.06,0.38], c:'#c0c6cc'}},
  {id:'motor',       name:'Motor',               min:52, max:100, lb:82, metal:true,  twoHanded:true, shape:{t:'box', s:[0.6,0.5,0.5], c:'#4a4d52'}},
  {id:'abajur',      name:'Abajur chique',       min:60, max:128, lb:21, metal:true,  twoHanded:true, shape:{t:'cone', s:[0.3,0.9], c:'#d6b56a'}},
  {id:'frasco',      name:'Frasco',              min:16, max:44,  lb:19,              shape:{t:'sphere', s:[0.2], c:'#7ad6c8'}},
  {id:'presente',    name:'Caixa de presente',   min:12, max:28,  lb:15,              shape:{t:'box', s:[0.35,0.35,0.35], c:'#d63a6a'}},
  {id:'barra_ouro',  name:'Barra de ouro',       min:102,max:210, lb:77, metal:true,  shape:{t:'box', s:[0.32,0.12,0.16], c:'#e8c03a'}},
  {id:'taca',        name:'Taça dourada',        min:40, max:80,  lb:16, metal:true,  shape:{t:'cone', s:[0.14,0.3], c:'#e8c03a'}},
  {id:'escova',      name:'Escova de cabelo',    min:8,  max:36,  lb:11,              shape:{t:'box', s:[0.08,0.06,0.3], c:'#7a4a2a'}},
  {id:'secador',     name:'Secador de cabelo',   min:60, max:100, lb:7,               shape:{t:'box', s:[0.12,0.2,0.3], c:'#d6a6c8'}},
  {id:'picles',      name:'Pote de picles',      min:32, max:60,  lb:17,              shape:{t:'cyl', s:[0.13,0.25], c:'#6a8a3a'}},
  {id:'eixo',        name:'Eixo grande',         min:36, max:56,  lb:17, metal:true,  twoHanded:true, shape:{t:'cyl', s:[0.08,1.2], c:'#707780'}},
  {id:'laser',       name:'Ponteiro laser',      min:32, max:100, lb:3,               shape:{t:'cyl', s:[0.03,0.18], c:'#202020'}, use:'light'},
  {id:'bola7',       name:'Bola mágica 7',       min:36, max:72,  lb:17,              shape:{t:'sphere', s:[0.17], c:'#1a1a1a'}},
  {id:'lupa',        name:'Lupa',                min:44, max:60,  lb:12,              shape:{t:'torus', s:[0.14,0.025], c:'#b5852a'}},
  {id:'chapa',       name:'Chapa de metal',      min:10, max:22,  lb:23, metal:true,  shape:{t:'box', s:[0.6,0.03,0.4], c:'#8a9096'}},
  {id:'telefone',    name:'Telefone velho',      min:48, max:64,  lb:6,               shape:{t:'box', s:[0.25,0.15,0.2], c:'#2a2a2a'}, use:'horn', sound:'phone'},
  {id:'quadro',      name:'Quadro',              min:60, max:124, lb:31,              twoHanded:true, shape:{t:'box', s:[0.9,0.7,0.06], c:'#7a5a3a'}},
  {id:'perfume',     name:'Frasco de perfume',   min:48, max:104, lb:5,               shape:{t:'box', s:[0.1,0.16,0.1], c:'#c86ad6'}},
  {id:'remedio',     name:'Frasco de remédio',   min:16, max:40,  lb:3,               shape:{t:'cyl', s:[0.06,0.14], c:'#d68a2a'}},
  {id:'peixe',       name:'Peixe de plástico',   min:28, max:40,  lb:7,               shape:{t:'sphere', s:[0.14], c:'#d6d63a'}},
  {id:'refri',       name:'Refrigerante vermelho',min:18,max:90,  lb:7,               shape:{t:'cyl', s:[0.06,0.16], c:'#c82a2a'}},
  {id:'controle',    name:'Controle remoto',     min:20, max:48,  lb:5,               shape:{t:'box', s:[0.06,0.03,0.2], c:'#1a1a1a'}},
  {id:'anel',        name:'Anel',                min:52, max:144, lb:18, metal:true,  shape:{t:'torus', s:[0.1,0.03], c:'#e8c03a'}},
  {id:'robo',        name:'Robô de brinquedo',   min:56, max:88,  lb:32, metal:true,  twoHanded:true, shape:{t:'box', s:[0.35,0.55,0.25], c:'#9aa3ab'}},
  {id:'patinho',     name:'Patinho de borracha', min:2,  max:100, lb:5,               shape:{t:'sphere', s:[0.13], c:'#f0d03a'}},
  {id:'placa_pare',  name:'Placa de PARE',       min:20, max:52,  lb:21, metal:true,  shape:{t:'flat', s:[0.5,0.5], c:'#c82a2a'}, use:'weapon'},
  {id:'placa_pref',  name:'Placa de PREFERÊNCIA',min:18, max:36,  lb:16, metal:true,  shape:{t:'flat', s:[0.5,0.45], c:'#e8e2d0'}, use:'weapon'},
  {id:'volante',     name:'Volante',             min:16, max:28,  lb:16,              shape:{t:'torus', s:[0.2,0.03], c:'#2a2a2a'}},
  {id:'chaleira',    name:'Chaleira',            min:32, max:80,  lb:10, metal:true,  shape:{t:'sphere', s:[0.18], c:'#c86a3a'}},
  {id:'dentadura',   name:'Dentadura',           min:60, max:84,  lb:5,               shape:{t:'box', s:[0.12,0.06,0.1], c:'#f0ecd8'}},
  {id:'pasta',       name:'Pasta de dente',      min:14, max:48,  lb:5,               shape:{t:'box', s:[0.04,0.04,0.2], c:'#e8e8f0'}},
  {id:'cubo',        name:'Cubo de brinquedo',   min:24, max:44,  lb:5,               shape:{t:'box', s:[0.18,0.18,0.18], c:'#3ab5d6'}},
  {id:'motor_v',     name:'Motor V',             min:20, max:56,  lb:16, metal:true,  twoHanded:true, shape:{t:'box', s:[0.5,0.45,0.4], c:'#3a3d42'}},
  {id:'almofada',    name:'Almofada de pum',     min:6,  max:20,  lb:0,               shape:{t:'sphere', s:[0.15], c:'#d64a6a'}, use:'horn', sound:'fart'},
  {id:'flashbang_c', name:'Granada caseira',     min:10, max:28,  lb:5,               shape:{t:'cyl', s:[0.07,0.18], c:'#5a6a3a'}, use:'flashbang'},
  {id:'brinquedo_pato',name:'Trenzinho de brinquedo',min:20,max:44,lb:7,              shape:{t:'box', s:[0.4,0.15,0.12], c:'#c8402a'}},
];
// itens especiais (não aparecem no sorteio normal)
const SCRAP_SPECIAL = {
  aparelho:   {id:'aparelho', name:'Núcleo de energia', min:80, max:80, lb:31, metal:true, twoHanded:true, shape:{t:'cyl', s:[0.25,0.6], c:'#e8d03a'}, apparatus:true},
  chave:      {id:'chave', name:'Chave', min:3, max:3, lb:0, metal:true, shape:{t:'box', s:[0.03,0.02,0.12], c:'#c8a63a'}, tool:'chave'},
  ovo_ninho:  {id:'ovo_ninho', name:'Ovo de pássaro', min:50, max:90, lb:10, shape:{t:'sphere', s:[0.2], c:'#e8dcc0'}},
};

// =============================================================================
//  FERRAMENTAS (itens úteis) e LOJA
// =============================================================================
const TOOLS = {
  lanterna:     {id:'lanterna', name:'Lanterna', lb:5, metal:true, battery:150, beam:{range:22, angle:0.5, intensity:1.0}, shape:{t:'cyl', s:[0.05,0.22], c:'#d6c83a'}},
  lanterna_pro: {id:'lanterna_pro', name:'Lanterna profissional', lb:5, metal:true, battery:300, beam:{range:34, angle:0.42, intensity:1.35}, shape:{t:'cyl', s:[0.06,0.26], c:'#2a2a2a'}},
  pa:           {id:'pa', name:'Pá', lb:8, metal:true, weapon:{damage:1, range:2.1, windup:0.45, cooldown:0.75}, shape:{t:'cyl', s:[0.04,1.0], c:'#8a6a4a'}},
  granada:      {id:'granada', name:'Granada de atordoamento', lb:5, metal:true, shape:{t:'cyl', s:[0.07,0.16], c:'#3a4a3a'}},
  gazua:        {id:'gazua', name:'Gazua automática', lb:16, metal:true, shape:{t:'box', s:[0.25,0.15,0.18], c:'#b55a2a'}},
  spray:        {id:'spray', name:'Tinta spray', lb:5, metal:true, charges:200, shape:{t:'cyl', s:[0.06,0.22], c:'#ff7a1a'}},
  chave:        {id:'chave', name:'Chave', lb:0, metal:true, shape:{t:'box', s:[0.03,0.02,0.12], c:'#c8a63a'}},
  espingarda:   {id:'espingarda', name:'Espingarda', lb:16, metal:true, gun:{shells:2, damage:5, range:18}, shape:{t:'cyl', s:[0.05,1.0], c:'#3a2a1a'}},
  cartucho:     {id:'cartucho', name:'Cartucho', lb:0, metal:false, shape:{t:'cyl', s:[0.03,0.07], c:'#c82a2a'}},
  kit_medico:   {id:'kit_medico', name:'Kit médico', lb:6, metal:false, uses:2, heal:45, shape:{t:'box', s:[0.26,0.12,0.18], c:'#eeeeea'}},
};
const STORE = [
  {tool:'lanterna',     price:15, desc:'Ilumina o caminho. Bateria dura uns 2 minutos e meio.'},
  {tool:'lanterna_pro', price:25, desc:'Mais forte e com o dobro de bateria.'},
  {tool:'pa',           price:30, desc:'Para autodefesa. Bata com o clique esquerdo.'},
  {tool:'granada',      price:30, desc:'Atordoa criaturas próximas por alguns segundos. Clique para arremessar.'},
  {tool:'gazua',        price:20, desc:'Encaixe numa porta trancada e espere: ela abre sozinha.'},
  {tool:'spray',        price:50, desc:'Segure o botão de usar pra pintar paredes e chão e não se perder.'},
  {tool:'kit_medico',   price:40, desc:'Cura 45 de vida. Dá pra usar 2 vezes.'},
];

// =============================================================================
//  CRIATURAS
//  power = custo no "orçamento" da lua | hp = golpes de pá pra matar (null = imortal)
//  bestiary = texto que aparece no terminal ao digitar "bestiario <nome>"
// =============================================================================
const CREATURES = {
  // ---------------- DENTRO da instalação ----------------
  juntador: {name:'Juntador', zone:'in', power:1, max:4, hp:2,
    bestiary:'Besouro grande de carapaça azulada que junta objetos num ninho de gravetos. É territorial: chegue perto do ninho ou pegue algo dele e ele ataca. Morre com dois golpes de pá — e o ninho costuma ter boa sucata.'},
  lacrador: {name:'Lacrador', zone:'in', power:1, max:4, hp:2,
    bestiary:'Larva pálida que fica grudada no teto esperando alguém passar embaixo. Cai na cabeça da vítima e a sufoca. Aperte E repetidamente pra arrancá-la, ou saia da instalação. Olhe para o teto.'},
  tecela: {name:'Tecelã', zone:'in', power:2, max:1, hp:5,
    bestiary:'Aranha enorme que tece teias nas passagens. Se você tocar numa teia, ela sabe onde você está. Mais rápida que você andando, mais lenta que você correndo. Teias podem ser cortadas com a pá.'},
  espreitador: {name:'Espreitador', zone:'in', power:3, max:1, hp:3,
    bestiary:'Sombra de dedos longos que te segue pelas costas, sempre fora de vista. Se você olhar pra ela, ela recua — mas encarar demais a deixa furiosa. Se ela te alcançar sem ser vista... já era.'},
  manequim: {name:'Manequim', zone:'in', power:2, max:5, hp:null,
    bestiary:'Um manequim de porcelana rachada. Só se move quando NINGUÉM está olhando, e muito rápido. Não tire os olhos dele: recue de costas. Imortal. Granadas o deixam parado por alguns segundos.'},
  rasteiro: {name:'Rasteiro', zone:'in', power:3, max:4, hp:4,
    bestiary:'Réptil comprido e cheio de espinhos. Rápido em linha reta, péssimo nas curvas. Ataca qualquer coisa que vê. Fuja fazendo curvas e passando por portas.'},
  gosma: {name:'Piche', zone:'in', power:1, max:2, hp:null,
    bestiary:'Poça de piche vivo que se arrasta devagar na direção de qualquer ser vivo próximo. Corrói rápido quem encosta. Imortal, mas muito lento. Só não fique parado.'},
  caixa_musica: {name:'Caixa de Música', zone:'in', power:3, max:1, hp:null,
    bestiary:'Uma caixa de música de madeira que aparece sempre um pouco atrás de você. Em algum momento a chave em cima dela começa a girar sozinha... Quando a melodia acabar, SAIA DA INSTALAÇÃO. Imortal.'},
  sentinela: {name:'Sentinela', zone:'in', power:2, max:3, hp:5,
    bestiary:'Robô de vigilância antigo com uma arma no braço. Patrulha os corredores e de vez em quando para e escaneia: se você se MEXER enquanto o sensor vermelho estiver aceso, ele atira. Fique parado. Ao ser destruído, larga a arma.'},
  sosia: {name:'Sósia', zone:'in', power:1, max:3, hp:4,
    bestiary:'De longe parece um tripulante de macacão e capacete. Anda como um de nós. Não é um de nós: o visor é vazio por dentro. Se te agarrar, você vira um deles.'},
  mimico_sucata: {name:'Mímico', zone:'in', power:1, max:4, hp:3,
    bestiary:'Organismo que imita a forma de sucata valiosa. O scanner mostra um valor bom demais pra ser verdade... Quando alguém tenta pegá-lo, ele morde. Às vezes imita até portas.'},
  // ---------------- FORA da instalação ----------------
  farejador: {name:'Farejador', zone:'out', power:2, max:4, hp:12,
    bestiary:'Cão pálido e sem pelos que caça pelo SOM. Correr, pular, derrubar coisas e fazer barulho chamam atenção. Ande agachado e em silêncio perto deles. Aparece ao entardecer.'},
  colosso: {name:'Colosso', zone:'out', power:3, max:2, hp:null,
    bestiary:'Humanoide magro de quase quinze metros que caça com a visão. Se te vir, te persegue, te pega e te come. Não consegue entrar na nave nem na instalação. Imortal.'},
  verme: {name:'Verme colossal', zone:'out', power:2, max:1, hp:null,
    bestiary:'Verme gigantesco que nada por baixo do solo. O chão treme antes do ataque — CORRA pra longe do lugar onde você estava. Imortal.'},
};

// =============================================================================
//  ARMADILHAS
// =============================================================================
const TRAPS = {
  turret:  {name:'Torreta', range:14, fov:1.0, warmup:1.2, dps:55, sweep:0.6},
  mine:    {name:'Mina terrestre', killRadius:2.6, hurtRadius:5.5, hurtDamage:50},
  crusher: {name:'Esmagador', warn:0.55, cooldown:4.0, damage:200},
  mimicDoor:{name:'Porta mímica', damage:45},
  // ao digitar o código (ex: "c4") no terminal da nave, a armadilha desliga por esse tempo:
  TERMINAL_DISABLE_SECONDS: 7,
};
