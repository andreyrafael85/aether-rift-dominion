# AETHER RIFT: DOMINION — Avaliação da stack 3D, do multiplayer e do "3.5D"
### 10 de outubro de 2026 · verificado no GitHub e nos repositórios citados

## 0. O que verifiquei (não é de memória)

| Projeto | Licença real | Atividade | Observação |
|---|---|---|---|
| Three.js | MIT | 116 mil estrelas, commit em 10/10/2026 | Já validado por nós em `estilo3d.html` (r160, WebGL2) |
| Babylon.js | **Apache-2.0** (não MIT, mas igualmente permissiva) | 26 mil estrelas, ativo | Motor completo: colisão, física, áudio espacial, editor de nós, WebGPU maduro |
| Rogue Engine | **sem repositório público do motor**; o GitHub `RogueEngine/RogueEngine` não tem código nem licença | n/a | É um editor fechado sobre Three.js, com plano gratuito. Não é open source |
| Threlte | MIT | ativo | Three.js declarativo para Svelte |
| React Three Fiber | MIT | 33 mil estrelas, ativo | Three.js declarativo para React |
| geckos.io | **BSD-3-Clause** (permissiva) | 1,5 mil estrelas, último commit mar/2026 | UDP via WebRTC cliente-servidor em Node |
| Colyseus | MIT | 7 mil estrelas, ativo | Salas, matchmaking e sincronização de estado em Node |
| PeerJS | MIT | 13 mil estrelas, último commit fev/2026 | WebRTC P2P simples com servidor de sinalização público gratuito |
| **VOIDSTRIKE** (braedonsaunders) | MIT | criado em jan/2026, 25 estrelas, 4 forks, 1.161 arquivos, 354 MB | Three.js r182 + TSL em WebGPU com fallback WebGL2, Next.js 16, React 19, Phaser 4 como overlay, recast-navigation (WASM), nostr-tools, zustand; 157 modelos .glb com LOD; docs de arquitetura de rede e render |

**Correções ao briefing recebido:** Babylon.js é Apache-2.0; Rogue Engine não é MIT nem aberto; geckos.io é BSD-3. Nada disso impede o uso, mas o registro de licenças precisa estar certo.

---

## 1. O que "3.5D" significa na prática

O termo descreve o que os RTS 3D clássicos fazem: **câmera presa como num jogo 2.5D** (ângulo fixo, rotação limitada, zoom contido, para legibilidade e para a arte ser feita para um ponto de vista) sobre **um mundo inteiramente 3D** (luz dinâmica, sombras, relevo real, efeitos volumétricos, câmera de replay livre). Não é uma tecnologia; é uma disciplina de câmera somada a um renderizador 3D completo.

O que faz o jogador dizer "visual incrível", em ordem de impacto por custo:

1. **Luz e sombra reais** com ciclo de dia e noite e luzes emissivas (já funciona na validação).
2. **Relevo com penhascos e rampas** que a simulação respeita: as cordilheiras viram montanhas de verdade; altura dá visão.
3. **Pós-processamento**: bloom nos emissivos, oclusão ambiente leve, névoa volumétrica na Fenda e na Tempestade, correção de cor por bioma.
4. **Partículas em GPU**: fumaça, neve, faíscas, destroços; milhares sem custo de CPU.
5. **Decalques e persistência**: crateras, rastros de esteira, carcaças que ficam.
6. **Animação por partes**: torretas, esteiras, pernas de mech, portões abrindo.
7. **Água e plasma** com shader (lagos de plasma perto da Fenda, gelo refletindo).
8. **LOD e instancing** para centenas de unidades a 60 fps, com presets de qualidade por dispositivo.

Tudo isso está ao alcance do Three.js, e o VOIDSTRIKE prova em produção que dá para ir ainda além no navegador.

---

## 2. Motor: manter Three.js, com um upgrade

| Opção | Prós | Contras | Veredito |
|---|---|---|---|
| **Three.js** (atual) | MIT, maior comunidade e mão de obra, validado por nós, WebGPU via `WebGPURenderer` + TSL nas versões recentes | É biblioteca, não motor: montamos câmera, picking e pós-processamento | **Manter** |
| Babylon.js | Motor completo, WebGPU maduro, editor de nós, áudio espacial, inspetor | Apache-2.0; port de tudo que validamos; física e colisão não servem (a simulação é nossa); menos mão de obra | Não trocar |
| Rogue Engine | Editor visual sobre Three.js | Fechado; nossos mapas são procedurais, não montados à mão | Não |

**Upgrade recomendado:** sair do `three.min.js` r160 (UMD, só WebGL) para a versão ESM atual via import map (r17x+), com **WebGPU quando disponível e WebGL2 como fallback**, exatamente a configuração do VOIDSTRIKE (r182). O custo é pequeno agora e evita um port depois.

**Camadas declarativas (Threlte/R3F):** ótimas para telas, menus e protótipos; inadequadas para 500 entidades atualizadas 10 vezes por segundo, porque cada mudança passa pela reconciliação do framework. Nosso HUD já é DOM e a cena é gerida por arrays. Opcional só para telas de lobby, se adotarmos React.

---

## 3. Rede: o que cada opção resolve de verdade

Nosso multiplayer é **lockstep de comandos sobre uma simulação determinística**: cada cliente simula tudo; só comandos trafegam; checksums detectam divergência. Isso muda o que importa na rede: precisamos de **entrega confiável e ordenada** de pacotes pequenos, não de UDP de baixa latência.

| Opção | Serve para | Encaixe no nosso lockstep |
|---|---|---|
| geckos.io (UDP via WebRTC, cliente-servidor) | Jogos de ação com streaming de posições | Pouco: o ganho do UDP não aparece em lockstep; exige servidor Node com portas UDP e TURN |
| Colyseus | Salas, matchmaking e sincronização de estado automática | Parcial: salas e matchmaking são úteis, mas o state sync é inútil para nós e viraria peso morto; um relay WebSocket próprio tem 200 linhas |
| **P2P por WebRTC** (VOIDSTRIKE com Nostr, ou PeerJS) | Partidas entre amigos sem servidor de jogo | **Alto**: lockstep é o modelo natural do P2P; zero custo de servidor; código de sala; nossa simulação já está pronta |
| Servidor autoritativo (plano original, Rust) | Ranqueado, anti-cheat, replays oficiais | Continua sendo o destino para competição |

**Sobre o VOIDSTRIKE sem servidor (WebRTC + Nostr):** é uma solução elegante e real. Prós: nenhum servidor para pagar ou manter; lobby por código; comandos assinados criptograficamente; adaptação de atraso por RTT e jitter; reconexão e ressincronização. Contras: sem autoridade central, trapaça é possível entre desconhecidos (maphack, pois todo cliente tem o estado inteiro); a sinalização depende de relays Nostr públicos que não controlamos; NAT simétrico falha sem servidor TURN; não há contas, ranking ou proteção contra desconexão tática além do que os pares combinam.

**Recomendação:** dois trilhos. **Agora (beta com amigos): P2P lockstep por código de sala**, com sinalização via PeerJS (MIT, servidor público gratuito, mais simples) ou via Nostr reaproveitando o módulo do VOIDSTRIKE; comandos assinados e checksums por tick com busca de divergência (ideias do VOIDSTRIKE). **Depois (ranqueado): o servidor autoritativo do plano.** O código de jogo não muda entre os dois, porque ambos falam a mesma linguagem de comandos.

---

## 4. VOIDSTRIKE: o que aproveitar e o que evitar

É o projeto mais próximo do que queremos ser tecnicamente, e é MIT: **podemos reutilizar código com atribuição**. Mas é jovem (janeiro de 2026), de autor único, com 25 estrelas e 354 MB; as APIs mudam.

**Aproveitar (módulos isolados, com testes nossos e crédito no `ASSETS.md`):**

- `src/engine/network/`: `CommandSigning`, `DesyncDetection`, `MerkleTree`, `p2p/NostrRelays`. É o lockstep P2P pronto, com forense de dessincronia.
- `src/rendering/tsl/` e `compute/`: pós-processamento em TSL, névoa de guerra em compute shader sem leitura de CPU, instancing com vetores de movimento, pool de luzes. Referência direta para o nosso v3.0b.
- `src/workers/`: simulação em Web Worker com passo fixo que não trava quando a aba perde foco. Vale adotar cedo: o nosso laço ainda roda na thread principal.
- `recast-navigation` (WASM): navmesh com obstáculos dinâmicos, formações e multidões. Evolução natural do nosso campo de fluxo quando houver relevo.
- `docs/reference/models.md` e os 157 `.glb` com três níveis de LOD como **padrão de pipeline** (voxel → glTF → LOD0/1/2), não como assets.
- Editor de mapas e validação de conectividade de navmesh: a ideia, para a Temporada 2.

**Evitar:**

- Adotar o projeto como base. Ele é Next.js + React + Phaser; nós somos arquivo único em Vite, HUD em DOM, simulação determinística já testada e identidade própria. Trocar de base jogaria fora o que validamos.
- Os assets. O README não documenta a origem dos 157 modelos e das texturas; sem procedência por arquivo, nada entra.
- A estética. É sci-fi militar genérico; a nossa é industrial-orgânica em voxel, com a Fenda, o roubo e a diplomacia como assinatura.

---

## 5. Plano "v3.0 · 3.5D" (ordem de execução)

| Entrega | Conteúdo | Resultado visível |
|---|---|---|
| **3.0a Renderizador 3D no jogo** | Three.js ESM atual com WebGPU/WebGL2; câmera RTS (inclinação 50–65°, quatro orientações mais rotação livre com Alt, zoom); `InstancedMesh` por modelo e cor de jogador; terreno com relevo real a partir dos biomas e das cordilheiras; névoa de guerra projetada no terreno; seleção por raycast; sombras; dia e noite; HUD em DOM mantido; Canvas 2D mantido como fallback para celulares fracos | O jogo inteiro em 3D, com a mesma jogabilidade |
| **3.0b Efeitos** | Bloom, oclusão ambiente leve, névoa volumétrica na Fenda e na Tempestade, partículas em GPU, destroços, lagos de plasma com shader, decalques, presets de qualidade | O "visual incrível" |
| **3.0c Modelos e animação** | Pipeline voxel → glTF com LOD, esteiras e pernas animadas, portões, 12 unidades por facção, Tessara e Vael | Variedade e vida |
| **3.0d Multiplayer P2P** | Lockstep por código de sala (PeerJS ou Nostr), comandos assinados, checksums com Merkle, reconexão; simulação em Worker | Partidas entre amigos sem servidor |
| **3.0e Validação** | fps em três classes de aparelho, draw calls, tempo de carga, retenção e feedback dos testadores | Decisão sobre WebGPU como padrão e sobre o servidor autoritativo |

Comece-se por 3.0a: é a fundação e é o que já foi validado.
