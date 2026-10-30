# The Last Horizon

Jogo de terror e exploração em 3D no navegador (three.js). Single-player ou multiplayer até 4 jogadores.

## Como jogar no PC

**Jeito recomendado (já liga o multiplayer LAN):**
1. Instale o Node.js (https://nodejs.org), uma vez só.
2. Dois cliques em `servidor/INICIAR.bat` (Windows). No Linux/Mac: `sh servidor/iniciar.sh`.
3. O navegador abre sozinho em http://localhost:8080.

**Sem Node:** abra `index.html` (o site) com o Live Server do VS Code e clique em JOGAR.

## Site do jogo (pra mandar pros amigos)

- `index.html` agora é o **site** (abas Menu, Sobre, Como jogar, Luas e criaturas, Contato). O botão **JOGAR** abre o jogo (`jogar.html`) e **JOGAR COM AMIGOS** abre direto a tela de multiplayer.
- Estilo do site: `site/site.css`. Imagens (fundos e prints do jogo): `site/img/`.
- **Colocar no ar de graça (GitHub Pages):**
  1. Crie um repositório no GitHub (ex: `the-last-horizon`) e envie TODOS os arquivos desta pasta (dá pra arrastar na página do repositório → "Add file" → "Upload files").
  2. No repositório: **Settings → Pages → Branch: main / (root) → Save**.
  3. Em 1 ou 2 minutos o site fica em `https://SEU-USUARIO.github.io/the-last-horizon/`. É esse link que você manda pros amigos.
- No GitHub Pages o multiplayer usa as salas pela internet (código de 5 letras) e o chat de voz funciona direto, porque o site já é https. As contas ficam salvas no aparelho (ou no Firebase, se você configurar, veja abaixo).
- Pra trocar as imagens do site: tire prints do jogo (tecla Print Screen) e substitua os arquivos em `site/img/` mantendo o mesmo nome.

## Contas e progresso (banco de dados)

Existem 3 jeitos de guardar a conta. O jogo escolhe sozinho o melhor que estiver disponível:

1. **Pelo servidor (`servidor/servidor.js`):** se o jogo foi aberto pelo servidor, aparece **☁ Conta online** em CONTA.
   - Usuário e senha ficam no banco `servidor/dados/contas.json`, com a senha criptografada.
   - Entra com a mesma conta em qualquer aparelho que abrir esse servidor: PC, celular, PC da escola na mesma rede.
2. **Firebase (Google, grátis, online 24h):** pra a conta funcionar de qualquer lugar, até com o jogo no GitHub Pages:
   1. https://console.firebase.google.com → Criar projeto.
   2. Engrenagem → Configurações do projeto → "Seus apps" → ícone `</>` (Web). Copie `apiKey`, `authDomain`, `projectId` e `appId`.
   3. Cole esses valores em `js/lc/00-config.js`, em `FIREBASE: {...}`.
   4. Authentication → Sign-in method → ative **E-mail/senha**. Na aba Settings → Domínios autorizados, adicione o domínio do seu GitHub Pages.
   5. Firestore Database → Criar banco → aba Regras → cole:
      ```
      rules_version = '2';
      service cloud.firestore {
        match /databases/{database}/documents {
          match /contas/{uid} { allow read, write: if request.auth != null && request.auth.uid == uid; }
        }
      }
      ```
3. **Offline (só neste aparelho):** contas salvas no navegador. Dá pra levar pra outro aparelho com Exportar/Importar.

O jogo salva sozinho toda vez que a nave volta pra órbita. Cada conta tem 3 saves.

## Multiplayer (até 4), igual ao Lethal Company

**O host cria a sala, passa o código, os amigos entram.**

1. O host vai em **MULTIPLAYER → CRIAR SALA**, escolhe o save e recebe um **código** (ex: `K7P2`) e um **link de convite**.
2. Os amigos vão em **MULTIPLAYER → ENTRAR NUMA SALA**, digitam o código e clicam em ENTRAR. Também dá pra abrir o link de convite direto.
3. O código aparece de novo a qualquer hora no **Esc** (menu de pausa), junto com quem está na sala.

Qual caminho a sala usa, o jogo escolhe sozinho:
- **Aberto pelo servidor** (`servidor/INICIAR.bat`, mesma rede): a sala fica no servidor e o código tem 4 letras. As salas abertas também aparecem numa lista, é só clicar. Marque "sala pela internet" se algum amigo estiver fora do seu Wi-Fi.
- **Sem servidor** (arquivo aberto direto ou hospedado num site): a sala é P2P pela internet (WebRTC/PeerJS) e o código tem 5 letras. Algumas redes de escola bloqueiam esse tipo de conexão.

O mundo é do host. Ele simula os monstros e salva o progresso. Os convidados mandam os pedidos (pegar item, abrir porta, alavanca, terminal) e o host executa.

**Chat de texto:** aperte **T** (celular: botão 💬), digite e Enter.

**Chat de voz por proximidade:** segure **V** pra falar (celular: segure o botão 🎙). Em CONFIGURAÇÕES → Voz e chat dá pra deixar o microfone sempre aberto, desligar a voz ou mudar o volume.
- Você só ouve quem está perto, e mais baixo quanto mais longe. Quem está dentro da instalação não ouve quem está fora.
- Os mortos se ouvem entre si, mas os vivos não ouvem os mortos.
- **Falar faz barulho e atrai as criaturas.**
- O navegador só libera o microfone em `https://` (ou em `localhost`). Por isso o servidor também abre uma porta https (a do jogo + 1, ex: `https://192.168.0.10:8081`). Na primeira vez o navegador mostra um aviso de "conexão não segura" porque o certificado é caseiro (pasta `servidor/cert`): clique em **Avançado → Continuar**. O link de convite do host já usa esse endereço.
- Num servidor online com https (ex: Render) e no modo P2P em site https, o microfone funciona direto.

**Servidor online (opcional):** suba a pasta num servidor Node grátis (ex: Render.com → New Web Service → seu repositório do GitHub → Start Command `node servidor/servidor.js`). No plano grátis o servidor dorme quando ninguém usa e o arquivo de contas pode ser apagado quando ele reinicia. Pra contas permanentes, use o Firebase.

## Celular, teclado e controle

- **Teclas:** todas podem ser trocadas em CONFIGURAÇÕES → Teclado (clique em "mudar" e aperte a tecla nova).

- Os botões de toque aparecem sozinhos no celular. Dá pra arrastar e redimensionar cada um em CONFIGURAÇÕES → Toque → EDITAR POSIÇÃO DOS BOTÕES.
- Controle Xbox/PlayStation: conecte e aperte A (ou ✕). Os botões podem ser remapeados em CONFIGURAÇÕES → Controle.

## Onde mexer

| Quero mudar... | Arquivo |
|---|---|
| Duração do dia, cota, preços, velocidade | `js/lc/00-config.js` → `CONFIG` |
| Luas (bioma, cores, clima, monstros) | `js/lc/00-config.js` → `MOONS` |
| Sucata, loja, criaturas, bestiário | `js/lc/00-config.js` |
| **Trocar placeholders por modelos 3D ou desenhos 2D** | `js/lc/01-assets.js` → `ASSETS` |
| Elementos dos cenários (árvores, pedras, ruínas...) | `js/lc/06b-scenery.js` |
| Comportamento das criaturas | `js/lc/09-creatures.js` |
| Menu, contas e saves | `js/lc/16-menu.js` |
| Multiplayer | `js/lc/17-net.js` e `servidor/servidor.js` |
| Chat de texto e de voz | `js/lc/18-chat-voz.js` |
| Teclas padrão | `js/lc/15-controles.js` → `KEY_ACTIONS` |
| Aparência dos itens da loja | `js/lc/01-assets.js` → `TOOL_MODELS` |

## Estrutura

```
index.html               o site do jogo (botão JOGAR → jogar.html)
jogar.html               o jogo
site/                    estilo e imagens do site
servidor/servidor.js     servidor LAN (serve o jogo + salas multiplayer), sem dependências
servidor/INICIAR.bat     liga o servidor no Windows
js/lc/00 ... 18          código (comentado em português)
css/lethal.css           visual da interface
scene.gltf/.bin, textures/   seu modelo da lua 21-Fornalha
```

Teclas de teste: em `00-config.js` coloque `DEBUG_KEYS: true`. F9 dá $1000, F10 pula pras 23:00 e F11 mostra o mapa.
