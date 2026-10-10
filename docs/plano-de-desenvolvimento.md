# AETHER RIFT: DOMINION — Plano de Desenvolvimento
### v0.1 · 9 de outubro de 2026 · complementa o Documento de Conceito v0.1

> Objetivo: começar a construir o app web / site do jogo imediatamente, com segurança e estabilidade do multiplayer como prioridades. Todas as tecnologias citadas existem e são amplamente adotadas em 2026; nenhuma foi inventada para este plano.

---

## 0. Validação das premissas do briefing

Antes do plano, o que no briefing se sustenta e o que precisa de ajuste.

| Premissa do briefing | Veredito | Ajuste recomendado |
|---|---|---|
| Browser-first, PWA, desktop e mobile | **Mantida** | PWA instalável com Web Push funciona em Chrome, Edge, Firefox e Safari iOS 16.4+ (quando instalado). Sem loja de apps no lançamento. |
| Estado autoritativo no servidor contra cheats | **Mantida e reforçada** | O cliente envia só comandos; nunca estado. Isso elimina por construção duplicação de recurso, speedhack e teleporte. Sobra maphack, bots e conluio, tratados na seção 4. |
| "Three.js, Babylon.js, PixiJS ou alternativas" | **Mantida** | Three.js com WebGPURenderer e fallback WebGL2. Babylon.js é a alternativa válida se o time preferir engine com baterias incluídas. PixiJS só se o jogo virar 2D. |
| "WebSockets, WebTransport, WebRTC" | **Parcial** | WebSocket como base (funciona em todo lugar, inclusive PWA iOS). WebTransport como aprimoramento progressivo. WebRTC DataChannel servidor-cliente não compensa: exige ICE/STUN/TURN e foi feito para P2P. |
| "Colyseus, Nakama, Mirror, Photon" | **Parcial** | Mirror é exclusivo de Unity; não se aplica a browser. Photon Fusion/Quantum são Unity; o SDK JS do Photon é relay, não serve para simulação autoritativa própria. Colyseus roda a simulação em Node single-thread por sala: limitante para RTS com centenas de unidades. Nakama é a única opção viável, para serviços de plataforma (auth, social, leaderboards), não para a simulação. |
| "Relacional + NoSQL + cache" | **Parcial** | PostgreSQL cobre o relacional e, com JSONB, o semiestruturado. Um banco NoSQL dedicado não é necessário no MVP. Cache e filas em Redis; analítica em ClickHouse; snapshots e replays em object storage. |
| "End-to-end onde aplicável" | **Ajustada** | Tráfego de jogo é servidor-autoritativo: o servidor precisa ler tudo, então E2E não se aplica. Chat E2E impediria moderação, que é obrigação legal e de produto. TLS 1.3 em tudo, criptografia em repouso e segredos em cofre. |
| "Detecção de speedhack, resource duplication, packet manipulation" | **Ajustada** | Com servidor autoritativo, esses três deixam de ser detecção e viram validação: todo comando é checado antes de executar. O esforço de detecção vai para bots, maphack e conluio. |
| Marketplace player-to-player com itens raros | **Mantida com restrição legal** | Moeda premium de circuito fechado, sem saque em dinheiro real. Saque transformaria o jogo em intermediador financeiro e atrairia regulação de pagamentos e de jogos de azar. |
| Battle pass, cosméticos, sem pay-to-win | **Mantida** | Sem loot boxes pagas: evita restrições na Bélgica, Países Baixos e exigências de divulgação de probabilidade em outros mercados. |

---

## 1. Arquitetura técnica geral

### 1.1 Princípios

1. **Um motor de simulação, dois hosts.** A simulação é uma biblioteca Rust determinística. Compila nativa para o servidor (autoridade) e para WebAssembly no navegador (tutorial e campanha offline, visualizador de replay). O mesmo código, o mesmo resultado.
2. **O cliente é um terminal burro com bom gosto.** Envia comandos, recebe estado filtrado pela névoa de guerra, renderiza com interpolação. Nunca decide nada.
3. **Plataforma e jogo são sistemas separados.** Serviços de conta, economia e social em TypeScript, com transações em PostgreSQL. Servidores de partida em Rust, efêmeros, orquestrados em Kubernetes.
4. **Toda mutação econômica é um lançamento em um livro-razão imutável.** Nenhum saldo é um campo editável.
5. **Observabilidade e segurança nascem com o código**, não depois do primeiro incidente.

### 1.2 Diagrama de arquitetura (textual)

```
┌──────────────────────────── BORDA (Cloudflare) ─────────────────────────────┐
│  DNS · CDN · WAF · Rate limiting · Bot Management · Turnstile · Spectrum    │
└───────┬──────────────────────┬───────────────────────────────┬──────────────┘
        │ HTTPS                │ HTTPS / WSS                   │ WSS / WebTransport (QUIC)
        ▼                      ▼                               ▼
┌──────────────┐   ┌───────────────────────────┐   ┌────────────────────────────────┐
│ SITE         │   │ APP DO JOGO (PWA)         │   │ FROTA DE GAME SERVERS (Rust)   │
│ Astro,       │   │ React 19 + TS + Vite      │   │ Kubernetes + Agones            │
│ estático     │   │ Three.js (WebGPU/WebGL2)  │   │ • Arena: 1v1, 2v2, FFA         │
│ marketing,   │   │ Sim core em WASM (offline)│   │ • Shard: round sazonal 120 jog.│
│ blog, status │   │ Service Worker (Workbox)  │   │ Simulação autoritativa 10 Hz   │
└──────────────┘   └─────────────┬─────────────┘   │ Snapshots delta filtrados      │
                                 │ HTTPS (REST/JSON) │ por névoa · gravação de replay │
                                 ▼                   └──────────┬─────────────────────┘
┌──────────────────────────────────────────────────┐            │ gRPC interno
│ PLATAFORMA (TypeScript · NestJS/Fastify)         │◀───────────┘ (resultado, telemetria,
│ monolito modular, módulos isolados por domínio:  │              persistência de shard)
│  Identidade & Perfil │ Matchmaking & Lobby       │
│  Economia & Ledger   │ Marketplace & Inventário  │
│  Passe & Loja        │ Ranked & Temporadas       │
│  Chat & Diplomacia   │ Moderação & Reports       │
│  Telemetria          │ Admin                     │
└───────┬──────────┬──────────┬──────────┬─────────┘
        │          │          │          │
        ▼          ▼          ▼          ▼
┌───────────┐ ┌─────────┐ ┌──────────┐ ┌──────────────┐   ┌─────────────────────┐
│ Keycloak  │ │ Postgres│ │ Redis    │ │ Filas        │   │ EXTERNOS            │
│ OIDC,     │ │ 16+     │ │ sessões, │ │ BullMQ /     │   │ Stripe (cartão, Pix)│
│ 2FA,      │ │ contas, │ │ presença,│ │ Redis Streams│   │ ou MoR (Xsolla)     │
│ passkeys  │ │ ledger, │ │ filas MM,│ │ outbox →     │   │ Sentry · PostHog    │
│ social    │ │ itens,  │ │ rate     │ │ ClickHouse   │   │ Resend/SES (e-mail) │
│ login     │ │ mercado │ │ limit    │ │ (analítica)  │   │ Perspective (chat)  │
└───────────┘ └─────────┘ └──────────┘ └──────────────┘   │ Fingerprint (device)│
                                                          └─────────────────────┘
┌──────────────────────────────────────────────────────────────────────────────┐
│ OBJECT STORAGE (Cloudflare R2 / S3): assets versionados, replays, snapshots   │
│ de shard, logs WORM (Object Lock) para auditoria do ledger                    │
└──────────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────────┐
│ OBSERVABILIDADE: OpenTelemetry → Prometheus/Grafana/Loki/Tempo (ou Dynatrace │
│ / Datadog) · Sentry (erros) · alertas → on-call                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Camadas e responsabilidades

| Camada | Responsabilidade | Tecnologia | O que nunca faz |
|---|---|---|---|
| **Site** | Marketing, blog, status, notas de patch, SEO | Astro, estático na CDN | Lógica de conta |
| **App do jogo (PWA)** | Lobby, HUD, render, input, marketplace, diplomacia | React 19, TypeScript, Vite, Three.js, Workbox | Decidir resultado de qualquer ação |
| **Game server** | Simulação autoritativa, validação de comandos, névoa, snapshots, replay | Rust (tokio, axum, tokio-tungstenite, wtransport) | Tocar em dinheiro ou inventário diretamente |
| **Plataforma** | Conta, matchmaking, economia, marketplace, passe, ranked, chat, moderação | NestJS (Fastify), Drizzle ORM, Zod | Simular partida |
| **Identidade** | Login, OIDC, 2FA, passkeys, social login | Keycloak | Guardar dados de jogo |
| **Dados** | Transações, cache, filas, analítica, arquivos | PostgreSQL, Redis, ClickHouse, R2/S3 | — |
| **Pagamentos** | Cobrança, Pix, cartão, webhooks, impostos | Stripe (BR) e Merchant of Record para global | Guardar dados de cartão (PCI SAQ-A) |

### 1.4 Modelo de simulação e sincronização de estado

**Tick fixo.** A simulação roda a 10 Hz (100 ms por tick) nas Arenas e 5 Hz nos Shards. O render interpola a 60 fps (desktop) ou 30 fps (mobile). RTS tolera 100–200 ms de latência de comando; o cliente mascara isso com confirmação visual e sonora imediata (a unidade "acusa" a ordem antes de se mover).

**Comandos, não estado.** O cliente envia comandos tipados (mover, construir, atacar, assinar tratado) com um número de sequência. O servidor valida cada um: o jogador é dono da unidade? A ação é legal nesse estado? Há recursos? Respeita o limite de comandos por tick (anti-bot)? Só então agenda para o próximo tick.

**Snapshots delta filtrados por névoa.** A cada tick o servidor calcula, por cliente, o conjunto de interesse: entidades próprias, entidades visíveis pelos sensores e um resumo de minimapa. Envia só as diferenças em relação ao último snapshot confirmado, em binário com posições quantizadas. Meta de banda: 8 KB/s médio e 25 KB/s de pico por cliente. O cliente nunca recebe o que não pode ver; maphack fica impossível por construção.

**Determinismo como seguro barato.** Mesmo com o servidor como única autoridade, o core é determinístico desde o primeiro dia: matemática em ponto fixo (Q16.16) ou f32 sem funções transcendentais de libm (seno e cosseno por tabela), sem iteração sobre HashMap em ordem indefinida, RNG com semente por partida. Isso garante que replays gravados como comandos reproduzam a partida byte a byte, que o tutorial offline em WASM se comporte igual ao servidor e que, no futuro, predição no cliente seja possível sem reescrever nada. Teste de CI: mesma sequência de comandos, mesmo hash de estado em nativo e em WASM.

**Dois modos de rede, um motor.**

| Modo | Jogadores | Tick | Persistência | Escala |
|---|---|---|---|---|
| **Arena** (1v1, 2v2, FFA 6, Expedição) | 2–6 | 10 Hz | Nenhuma durante a partida; resultado enviado à plataforma no fim | Um processo por partida; dezenas por vCPU |
| **Shard** (round sazonal) | até 120 | 5 Hz | Snapshot a cada 60 s em object storage, log de eventos para recuperação | Um processo por mapa; 2–4 vCPU; partição por quadrante como opção futura |

No Shard, bases em Dormência são simuladas em taxa grosseira (só economia) pelo mesmo processo: a autoridade nunca sai do game server.

### 1.5 Transporte de rede

- **WebSocket sobre TLS** é a base. Funciona em todos os navegadores, atravessa proxies corporativos e redes móveis, e o RTS a 10 Hz não sofre com o bloqueio de cabeça de fila do TCP de forma perceptível.
- **WebTransport (HTTP/3 e QUIC)** entra como aprimoramento progressivo na Fase 3: datagramas não confiáveis para snapshots, streams confiáveis para comandos. Chrome, Edge e Firefox suportam; o suporte do Safari é recente e deve ser confirmado na matriz de dispositivos antes de se tornar padrão. O servidor Rust expõe ambos os transportes sobre o mesmo protocolo de mensagens.
- **Formato binário** próprio ou FlatBuffers, com versionamento de esquema. Nada de JSON no caminho quente.
- **Reconexão** com token de sessão de partida: o cliente volta à mesma partida em até 60 s sem perder a base.

### 1.6 Fluxo de uma partida de Arena

1. O jogador autentica no app (OIDC com PKCE via Keycloak) e entra na fila de matchmaking (REST para a plataforma; estado da fila em Redis).
2. O módulo de matchmaking forma a partida por MMR, latência e facção, e pede ao Agones a alocação de um game server disponível na região escolhida.
3. A plataforma emite um **ticket de partida**: JWT assinado, válido por 60 s, contendo jogador, partida, facção, servidor e região.
4. O cliente abre WebSocket direto com o game server e apresenta o ticket. O servidor valida assinatura e expiração; sem ticket válido, encerra a conexão antes de alocar qualquer estado.
5. A partida roda. Comandos sobem, snapshots filtrados descem, o servidor grava o replay como sequência de comandos mais hashes de estado a cada 10 ticks.
6. No fim, o game server envia o resultado assinado à plataforma por gRPC interno. A plataforma atualiza MMR, temporada, contratos diários e XP de passe em uma transação, publica o evento na fila e grava o replay no object storage.
7. O Agones recicla o game server.

### 1.7 Stack tecnológica recomendada

| Área | Escolha | Por quê | Alternativa aceitável |
|---|---|---|---|
| Simulação | **Rust** (crate `sim`), ECS leve (`hecs` ou `bevy_ecs` isolado), ponto fixo | Desempenho previsível, sem GC, compila para nativo e WASM a partir do mesmo código, segurança de memória | Go (sem compartilhamento WASM eficiente) |
| Game server | **Rust** com tokio, axum, tokio-tungstenite, wtransport | Mesmo crate da simulação; milhares de conexões por processo; latência estável | C# (.NET 8) se o time vier de Unity |
| Render | **Three.js** com WebGPURenderer e fallback WebGL2; InstancedMesh e BatchedMesh; partículas em compute via TSL | Maior ecossistema e mercado de contratação; WebGPU maduro; instancing para 2.000+ unidades | Babylon.js 8 |
| App | **React 19 + TypeScript + Vite** | Contratação, ecossistema, TanStack Query e Router; React fica fora do laço de render | SolidJS (reatividade mais fina, menos gente) |
| Site | **Astro** | Estático, SEO, zero JS por padrão | Next.js |
| PWA | **vite-plugin-pwa (Workbox)** | Padrão de mercado para service worker, precache e atualização | — |
| Plataforma | **NestJS com adaptador Fastify**, Drizzle ORM, Zod | Modularidade forçada, injeção de dependência, mesmo TS do front; Fastify pelo desempenho | Go (Chi/Echo) com sqlc |
| Identidade | **Keycloak** (OIDC, TOTP, WebAuthn/passkeys, social login) | Comprovado em escala, sem custo por usuário ativo, operador Kubernetes oficial | Ory Kratos/Hydra; Auth0 ou Clerk se preferir gerenciado e aceitar custo por MAU |
| Banco transacional | **PostgreSQL 16+** (Cloud SQL ou RDS, HA) | Transações serializáveis para economia, JSONB, particionamento, maturidade | — |
| Cache, filas leves, presença | **Redis 7** | Sessões, filas de matchmaking, rate limiting, pub/sub de chat | Valkey |
| Jobs assíncronos | **BullMQ** sobre Redis, padrão outbox no Postgres | Simples, confiável, mesmo runtime | NATS JetStream quando o volume exigir |
| Analítica | **ClickHouse** | Eventos de telemetria e balanceamento em bilhões de linhas, barato | BigQuery |
| Arquivos | **Cloudflare R2** (assets, replays, snapshots, logs WORM) | Egress zero, compatível com S3, integrado à CDN | S3 + CloudFront |
| Orquestração de game servers | **Kubernetes + Agones** | Open source, alocação e autoscaling de servidores dedicados, independente de nuvem | Hathora ou Edgegap (gerenciados) |
| Nuvem | **GCP** (GKE, Cloud SQL, Memorystore) na fase inicial, infraestrutura como código para manter portabilidade | GKE é o Kubernetes mais maduro, Agones nasceu nele, região em São Paulo, descontos por uso comprometido | AWS (EKS, RDS, GameLift) |
| Borda | **Cloudflare** (CDN, WAF, Bot Management, Turnstile, Spectrum para WSS) | Proteção L3–L7 e CDN em um só lugar, custo previsível | AWS Shield + CloudFront + WAF |
| Pagamentos | **Stripe** (cartão, Apple Pay, Google Pay, Pix no Brasil) no lançamento; **Merchant of Record** (Xsolla ou Paddle) para expansão global | Stripe cobre o Brasil com Pix; MoR assume impostos e conformidade em dezenas de países | Mercado Pago para reforço local |
| Observabilidade | **OpenTelemetry** em tudo; Prometheus, Grafana, Loki, Tempo; **Sentry** para erros | Padrão aberto, sem lock-in; Sentry tem source maps e release health | Dynatrace ou Datadog como plataforma unificada |
| Produto e analytics | **PostHog** (self-hosted ou cloud UE/BR) | Funis, retenção, feature flags, aderente à LGPD | Amplitude |
| CI/CD | **GitHub Actions**, Turborepo (TS), Cargo workspace (Rust), **ArgoCD** (GitOps), **Terraform/OpenTofu** | Monorepo com cache de build, deploy declarativo, infra versionada | GitLab CI |
| Segurança de código | Semgrep ou CodeQL (SAST), Trivy (imagens e SBOM), Renovate, gitleaks | Cobertura do SDLC sem custo alto | Snyk |

---

## 2. Frontend (app e site)

### 2.1 Frameworks e divisão

- **Site (Astro):** páginas de marketing, Boletins da Maré (patch notes), status, FAQ, documentos legais. Estático, publicado na CDN.
- **App (React 19 SPA/PWA):** lobby, matchmaking, perfil, marketplace, passe, diplomacia assíncrona, visualizador de replay e **a partida**. Um único bundle inicial pequeno; o módulo de partida (Three.js, WASM, assets) carrega sob demanda.
- **Partida:** o canvas é controlado por um módulo TypeScript puro (`engine`), sem React no laço de render. O React desenha o HUD por cima e assina seletivamente um store (Zustand) que o engine atualiza a 10 Hz com dados agregados (recursos, seleção, alertas). Minimapa, barras de vida e contadores de alta frequência são desenhados em canvas 2D ou por manipulação direta do DOM, nunca por reconciliação React.

### 2.2 Estrutura do monorepo

```
aether-rift/
├─ apps/
│  ├─ web/                 # React PWA (lobby, HUD, marketplace, replay)
│  │  ├─ src/app/          # rotas (TanStack Router), providers, layout
│  │  ├─ src/features/     # auth, lobby, matchmaking, marketplace, pass, diplomacy, replay
│  │  ├─ src/game/         # ponte HUD ↔ engine: stores, hooks, componentes de HUD
│  │  ├─ src/ui/           # design system: tokens, componentes base, ícones
│  │  ├─ src/pwa/          # service worker, manifest, push, estratégia offline
│  │  └─ public/           # manifest.webmanifest, ícones
│  ├─ site/                # Astro
│  └─ admin/               # painel interno (moderação, economia, feature flags)
├─ packages/
│  ├─ engine/              # TS: render Three.js, câmera, input (touch/mouse/teclado), áudio, FX
│  ├─ netcode/             # TS: protocolo binário, cliente WS/WebTransport, interpolação, reconexão
│  ├─ protocol/            # esquemas de mensagens e tipos gerados (FlatBuffers) para TS e Rust
│  ├─ sim-wasm/            # empacotamento WASM do crate sim (wasm-bindgen) para offline e replay
│  ├─ api-client/          # cliente tipado da plataforma (OpenAPI → TS)
│  └─ config/              # eslint, tsconfig, prettier compartilhados
├─ services/
│  ├─ platform/            # NestJS: módulos identity, matchmaking, economy, marketplace, pass, ranked, chat, moderation, telemetry
│  └─ gameserver/          # Rust: binário do servidor de partida (depende de crates/sim)
├─ crates/
│  ├─ sim/                 # Rust: simulação determinística (ECS, pathfinding, combate, economia, névoa)
│  ├─ sim-bots/            # Rust: IA de teste e balanceamento (headless)
│  └─ proto/               # Rust: tipos gerados do protocolo
├─ infra/
│  ├─ terraform/           # GKE, Cloud SQL, Memorystore, R2, Cloudflare, IAM
│  ├─ k8s/                 # manifests e Helm charts; Agones Fleets; ArgoCD apps
│  └─ ci/                  # workflows reutilizáveis
├─ tools/                  # pipeline de assets (gltfpack, KTX2), geradores, scripts de balanceamento
└─ docs/                   # ADRs (decisões de arquitetura), runbooks, GDD, protocolo
```

### 2.3 PWA

- **Instalação:** manifest com ícones maskable, `display: standalone`, atalhos para "Jogar", "Mercado", "Replays".
- **Offline parcial:** precache do shell do app, tutorial e campanha (sim em WASM, sem servidor), visualizador de replay, editor de loadout e leitura da Sala de Negociação. Matchmaking e marketplace exigem conexão e mostram estado offline claro.
- **Atualização:** service worker com `skipWaiting` controlado por prompt ("Nova versão disponível. Atualizar agora?"), nunca no meio de uma partida.
- **Notificações:** Web Push (VAPID) para Cerco declarado, tratado proposto, Alerta de Sifão em Dormência e fim de round. Opt-in explícito, por categoria, revogável nas configurações.
- **Armazenamento:** IndexedDB para replays baixados e cache de assets por facção (Cache Storage), com limite e limpeza por LRU.

### 2.4 Responsividade, touch e hotkeys

- **Breakpoints de HUD:** telefone (≥ 360 px, retrato bloqueado para paisagem na partida), tablet, desktop. O HUD muda de layout; o engine não muda.
- **Gramática touch:** toque seleciona; toque longo abre menu radial de ordens; arrastar com um dedo desenha caixa de seleção; dois dedos movem e aproximam a câmera; seis **Fichas** de atalho configuráveis na borda (grupos de controle, Sobrecarga, Prioridade de Energia, Salto).
- **Desktop:** hotkeys remapeáveis, grupos de controle 1–9, câmera por bordas e teclas, atalhos de construção em grade (QWER/ASDF), modo de clique inteligente.
- **Alvos de toque** com 44 px mínimo; feedback háptico leve onde houver suporte.
- **Acessibilidade:** contraste AA no HUD, modo daltônico para as cores de facção e de contra, legendas para alertas sonoros, escala de interface.

### 2.5 Sistema de UI/UX para RTS

| Componente | Função | Implementação |
|---|---|---|
| Seleção e grupos | Caixa, shift-adicionar, duplo clique por tipo, grupos de controle | Engine (picking por ID em render target) + HUD React |
| Painel de comando | Ordens contextuais da seleção, fila de produção, pesquisa | React, atualizado a 10 Hz via store |
| Construção | Grade de posicionamento, validação local prévia (visual), confirmação pelo servidor | Engine desenha fantasma; servidor valida |
| Minimapa | Terreno, névoa, alertas, pings, Fumaça inimiga | Canvas 2D dedicado, 10 Hz |
| Energia | Barra de regime (Pleno/Racionado/Colapso), Prioridade de Energia | HUD fixo, sempre visível |
| Alertas | Sifão, Cerco, traição, superarma anunciada | Fila de alertas com ícone, direção e som; toque centraliza a câmera |
| Chat e diplomacia | Canais, Sala de Negociação (contrato com termos, Caução, testemunha), reputação do interlocutor | React, WebSocket da plataforma, moderação automática |
| Marketplace | Livro de ofertas, histórico de preço, inventário, Mercado Cinza | React + TanStack Query; toda ação é idempotente |
| Replay e espectador | Linha do tempo, câmera livre, visão por jogador (com atraso), botão Momento | Engine em modo replay; snapshots do object storage |

### 2.6 Gerenciamento de estado e desempenho

- **Orçamentos:** 60 fps em desktop médio e 30 fps em celular Android de entrada de 2024; 16 ms de frame; até 2.000 unidades visíveis instanciadas; 50 mil partículas em GPU; primeiro frame jogável com menos de 25 MB baixados.
- **Estado de jogo:** arrays tipados (SoA) no engine, espelho do snapshot do servidor; nunca objetos JS por entidade.
- **Render:** instancing por tipo de unidade com atlas de textura por facção; LOD em três níveis; sombras só no desktop; partículas e névoa em compute shader (WebGPU) com fallback em vertex shader (WebGL2).
- **Assets:** glTF com compressão meshopt (gltfpack), texturas KTX2 (Basis Universal) com mipmaps, áudio Opus. Pipeline automatizado em `tools/`, com orçamento por facção e verificação em CI.
- **Threads:** decodificação de snapshots e interpolação em Web Worker; OffscreenCanvas para o minimapa onde houver suporte.
- **Medição:** painel de desempenho interno (frame time, draw calls, banda) e telemetria de desempenho anônima por dispositivo para orientar otimizações.

---

## 3. Backend e serviços

### 3.1 Linguagens e frameworks

- **Rust** para `sim` e `gameserver`: desempenho, determinismo, segurança de memória e compartilhamento com WASM.
- **TypeScript (Node 22 LTS) com NestJS sobre Fastify** para a plataforma: velocidade de desenvolvimento, mesmo idioma do front, ecossistema de pagamentos e ORMs, modularidade imposta pelo framework.
- **Comunicação interna** game server ↔ plataforma por gRPC com mTLS; externa por REST/JSON com OpenAPI gerado e validado por Zod.

### 3.2 Monolito modular agora, microserviços quando doer

Começar com **um deploy da plataforma**, dividido em módulos NestJS com fronteiras explícitas: cada módulo é dono de suas tabelas, expõe uma interface interna e publica eventos de domínio. Regra: nenhum módulo lê a tabela de outro. Isso permite extrair um serviço (o primeiro candidato é o Marketplace, pelo perfil de carga e de risco) sem reescrever contratos. Os game servers já nascem separados, porque têm ciclo de vida e escala próprios.

### 3.3 Serviços essenciais

| Módulo | Responsabilidades | Dados principais |
|---|---|---|
| **Identidade e Perfil** | Integração OIDC com Keycloak, perfil público, configurações, consentimentos LGPD, exportação e exclusão de dados | `players`, `consents`, `settings` |
| **Matchmaking e Lobby** | Filas por modo e região, MMR, grupos, alocação via Agones, emissão de tickets de partida | Redis (filas, presença), `matches` |
| **Game Server (Rust)** | Simulação, validação, névoa, snapshots, replay, resultado assinado | Memória; snapshots e replays em R2 |
| **Economia e Ledger** | Moeda premium e recursos de conta, livro-razão de dupla entrada imutável, saldos derivados | `ledger_entries` (append-only), `balances` (materializada) |
| **Marketplace e Inventário** | Itens como instâncias únicas, listagens, ordens, custódia (escrow), taxa, Mercado Cinza, histórico | `items`, `listings`, `trades`, `item_history` |
| **Passe e Loja** | Temporadas, trilhas, XP, recompensas, catálogo, direitos adquiridos (entitlements) | `seasons`, `pass_progress`, `catalog`, `entitlements` |
| **Ranked e Temporadas** | Ladder por facção, divisões, pontuação de round, distribuição de Relíquias | `ratings`, `season_results` |
| **Chat e Diplomacia** | Canais, mensagens, tratados com Caução e testemunhas, reputação persistente | `treaties`, `reputation_events`, Redis pub/sub, histórico em Postgres particionado |
| **Moderação e Reports** | Reports, filas de revisão, sanções escalonadas, apelações, evidências (replay e chat) | `reports`, `sanctions`, `appeals` |
| **Telemetria** | Ingestão de eventos de jogo e produto, agregação para balanceamento | ClickHouse |
| **Admin** | Painel interno com RBAC, trilha de auditoria de toda ação administrativa | `admin_audit` |

### 3.4 Bancos de dados: o que vai onde

| Dado | Armazenamento | Motivo |
|---|---|---|
| Contas, perfis, consentimentos | PostgreSQL | Integridade e direitos do titular (exportar, apagar) |
| Ledger econômico, itens, trades, listagens | PostgreSQL, isolamento serializável, tabelas append-only com triggers que proíbem UPDATE/DELETE | Dinheiro exige ACID; imutabilidade para auditoria |
| Sessões, presença, filas de matchmaking, rate limiting | Redis | Latência de milissegundos, expiração nativa |
| Estado de partida de Arena | Memória do game server | Efêmero; resultado persiste na plataforma |
| Estado de Shard | Memória do game server + snapshot a cada 60 s em R2 + log de eventos | Recuperação após falha sem banco no caminho quente |
| Replays | R2 (comandos + hashes), índice em PostgreSQL | Arquivos pequenos, acesso raro |
| Eventos de telemetria e balanceamento | ClickHouse | Agregações sobre bilhões de linhas |
| Chat (histórico) | PostgreSQL particionado por mês, retenção de 90 dias | Moderação exige busca; LGPD exige retenção limitada |
| Logs de auditoria | Loki (operacional) + cópia em R2 com Object Lock (WORM) | Prova de não adulteração |

### 3.5 Filas e processamento assíncrono

- **Padrão outbox:** toda transação que precisa publicar um evento grava o evento na mesma transação, em `outbox`; um relay publica para a fila. Nunca "salvar e depois publicar".
- **BullMQ** para jobs: processar resultado de partida, recalcular MMR, conceder XP de passe, expirar listagens, enviar push e e-mail, gerar clipes, agregar telemetria.
- **Idempotência** em todo consumidor: chave de idempotência por evento, tabela `processed_events`.
- **Dead-letter queue** com alerta; retries com backoff exponencial.
- Migração para **NATS JetStream** só se a taxa de eventos ou a necessidade de múltiplos consumidores independentes justificar.

---

## 4. Segurança (prioridade máxima)

### 4.1 Autenticação e autorização

- **OIDC Authorization Code com PKCE** via Keycloak. O app nunca vê a senha.
- **Tokens:** access token JWT de 10 minutos; refresh token rotativo com detecção de reutilização (reuso revoga a família inteira); armazenados em cookie `HttpOnly`, `Secure`, `SameSite=Lax`, nunca em `localStorage`.
- **2FA:** TOTP e **passkeys (WebAuthn)** opcionais; obrigatórios para contas com acesso a marketplace acima de um limiar de valor e para toda conta administrativa.
- **Social login:** Google, Apple e Discord. E-mail com verificação obrigatória.
- **Tickets de partida:** JWT de 60 s assinado pela plataforma com chave rotativa (JWKS); o game server valida offline.
- **Autorização:** RBAC para admin, ownership check em toda rota de jogador, política de "negar por padrão". Admin com SSO corporativo, 2FA obrigatório e IP allowlist.
- **Sessões:** lista de dispositivos ativos, logout remoto, invalidação em troca de senha.

### 4.2 Proteção contra cheats e exploits

| Ameaça | Tratamento |
|---|---|
| Duplicação de recursos, speedhack, teleporte, dano alterado | **Impossíveis por construção**: o cliente só envia comandos; toda regra roda no servidor |
| Pacotes malformados ou fora de ordem | Parser estrito com limites de tamanho; sequência monotônica; desconexão em violação, com log |
| Maphack | O servidor só envia o que a névoa permite; o cliente nunca tem o estado oculto |
| Bots e macros | Limite de comandos por tick e por segundo; análise de distribuição de APM, tempo de reação e regularidade de intervalos; sinais alimentam um score de risco por conta; revisão humana antes de sanção |
| Conluio em ranked e FFA | Detecção por grafo (quem nunca ataca quem, transferências de recurso recorrentes), partidas repetidas entre as mesmas contas, resultado em horário suspeito |
| Multi-contas e boosting | Fingerprint de dispositivo (Fingerprint), correlação de pagamento, IP e comportamento; limites para contas novas |
| Abuso de reconexão e desconexão tática | Janela de reconexão de 60 s; a simulação não pausa; desconexão conta como derrota em ranked após a janela |
| Exploits de regras (ex.: sifão em loop) | Testes de propriedade (proptest) no `sim` para invariantes econômicas: recursos nunca negativos, soma conservada em roubo, caps respeitados |

Não há anti-cheat de kernel no navegador, e isso é aceitável: a arquitetura autoritativa remove as classes de cheat que o kernel tentaria pegar.

### 4.3 Segurança do marketplace e das transações

- **Itens são instâncias** com ID único (UUIDv7) e histórico completo de posse (`item_history`).
- **Ledger de dupla entrada** append-only: toda movimentação cria lançamentos que somam zero; saldos são materializados e reconciliados em job diário.
- **Trade atômico:** uma transação serializável bloqueia item e saldos (`SELECT ... FOR UPDATE`), confere posse e saldo, move item e lançamentos, publica evento via outbox. Falha em qualquer passo desfaz tudo.
- **Custódia:** ao listar, o item sai do inventário para custódia da plataforma; ao cancelar, volta. Nunca há dois donos.
- **Idempotência** em toda mutação (`Idempotency-Key` obrigatória); repetir a requisição não repete o efeito.
- **Encadeamento de hash** diário do ledger, com o hash publicado em log WORM: adulteração retroativa fica detectável.
- **Limites e holds:** teto diário de valor por conta, hold de 24 h em itens recém-adquiridos, 10 h de jogo para liberar negociação, 2FA para valores altos.
- **Auditoria:** toda ação administrativa sobre economia é registrada com autor, motivo e diff; concessões manuais exigem dupla aprovação.

### 4.4 DDoS, rate limiting e bots

- **Cloudflare** à frente de site, app e API: WAF com regras gerenciadas, rate limiting por rota, Bot Management, **Turnstile** em cadastro, login, criação de listagem e report.
- **Game servers** atrás de **Cloudflare Spectrum** (proxy TCP para WSS) ou da proteção L3/L4 da nuvem; conexões só com ticket válido; limite de conexões por IP e por conta; descarte precoce de tráfego sem handshake válido.
- **Rate limiting** em camadas: borda (IP), API (conta, token bucket em Redis), game server (comandos por tick).
- **Capacidade de absorção:** fleets com headroom de 30% e autoscaling; runbook de incidente com modo "só ranqueado" para preservar o núcleo competitivo sob ataque.

### 4.5 Criptografia

- **TLS 1.3** em toda borda, HSTS com preload; mTLS entre game server e plataforma.
- **Em repouso:** discos e bancos criptografados pela nuvem (chaves gerenciadas em KMS); campos sensíveis (documento, dados de pagamento tokenizados pelo provedor, segredos de 2FA) com criptografia de aplicação adicional.
- **Segredos** em Secret Manager da nuvem, injetados em runtime, rotacionados; nunca em repositório ou imagem.
- **Senhas** ficam no Keycloak (Argon2id). O app nunca toca em credenciais.
- **Assinaturas:** tickets, resultados de partida e webhooks de pagamento são assinados e verificados.

### 4.6 LGPD e GDPR

- **Encarregado (DPO)** nomeado e publicado; **registro de operações** de tratamento; **DPIA** para detecção de bots e fingerprint de dispositivo, que são perfilamento.
- **Bases legais** explícitas: execução de contrato (jogar), legítimo interesse (anti-cheat e segurança, com teste de balanceamento documentado), consentimento (marketing, analytics não essenciais, push).
- **Direitos do titular** automatizados no app: exportar dados (JSON), corrigir, apagar. Exclusão respeita retenção legal de registros financeiros (anonimização do perfil, manutenção do ledger sem identificação direta).
- **Minimização e retenção:** chat 90 dias, telemetria bruta 13 meses, IPs 30 dias, logs de segurança 12 meses; tudo documentado na política de privacidade.
- **Menores:** verificação de idade no cadastro; abaixo de 18 com limites de gasto e sem marketplace até consentimento parental verificado; abaixo de 13 bloqueado.
- **Transferência internacional:** dados de brasileiros em região brasileira ou com cláusulas-padrão; usuários da UE com dados em região europeia quando o lançamento chegar lá.
- **Consumidor (CDC):** política clara de reembolso para compras digitais, com orientação jurídica sobre o direito de arrependimento de 7 dias para conteúdo digital.
- **Incidentes:** plano de resposta com notificação à ANPD e aos titulares nos prazos legais.

### 4.7 Banimento, reports e moderação

- **Report em um toque** em chat, perfil, partida e marketplace, com categoria e anexo automático de evidência (trecho de replay, mensagens).
- **Filtro de chat** em duas camadas: lista local de termos por idioma e classificação de toxicidade (Perspective API ou fornecedor especializado), com ação graduada (ocultar, avisar, mutar).
- **Sanções escalonadas e específicas:** silêncio de chat, bloqueio de trade, suspensão de ranqueado, suspensão de conta, banimento permanente com bloqueio de dispositivo.
- **Processo:** fila de revisão com SLA, decisão fundamentada visível ao jogador, apelação com segundo revisor, estatísticas públicas trimestrais de moderação.
- **Ferramentas internas:** visualizar replay pelo ponto de vista do suspeito, grafo de trades, linha do tempo da conta.

### 4.8 Boas práticas de código seguro

- **OWASP Top 10 e ASVS nível 2** como baseline; checklist por PR para rotas novas.
- **Validação de entrada** em toda fronteira (Zod no TS, parsers estritos no Rust); saída escapada; CSP estrita com nonce; sem `eval`; Trusted Types onde suportado.
- **Dependências:** Renovate semanal, Trivy e `cargo audit` no CI, SBOM por release, bloqueio de build com vulnerabilidade crítica.
- **SAST** (Semgrep ou CodeQL) e **secret scanning** (gitleaks) no CI; revisão obrigatória por par em tudo que toca auth, economia e protocolo.
- **Ambientes:** nenhum dado real em dev ou staging; contas de serviço com privilégio mínimo; acesso a produção por quebra de vidro auditada.
- **Modelagem de ameaças** por módulo na Fase 0 e revisada a cada fase.

---

## 5. Monetização e economia in-game

### 5.1 Pagamentos

- **Lançamento (Brasil e Américas):** Stripe com Payment Element (cartão, Apple Pay, Google Pay) e **Pix**; webhooks verificados por assinatura, idempotentes, com reconciliação diária contra o ledger. PCI DSS no escopo SAQ-A: dados de cartão nunca passam pelos nossos servidores.
- **Expansão global:** **Merchant of Record** (Xsolla, especializado em jogos, ou Paddle) assume cobrança de impostos e conformidade local em dezenas de países, com métodos locais incluídos. Decisão na Fase 4 com base nas regiões-alvo.
- **PayPal** opcional via Stripe ou MoR. Mercado Pago como reforço de cobertura no Brasil se a conversão em Pix e boleto justificar.

### 5.2 Moeda premium de circuito fechado

- Compra em pacotes com preço em moeda local; conversão fixa e exibida; sem saque, transferência direta entre contas ou compra com desconto por volume que crie arbitragem.
- Toda moeda é lançamento no ledger; o "saldo" é uma visão.
- Preços de loja em moeda premium com equivalente em moeda local exibido ao lado, por transparência.

### 5.3 Marketplace player-to-player seguro

1. Vendedor lista o item: o item entra em custódia; a listagem tem preço, validade de 7 dias e histórico de preço público.
2. Comprador aceita: transação serializável debita o comprador, credita o vendedor menos a taxa (8%, reduzida por Relíquias até 2 pontos), transfere o item e registra tudo no ledger.
3. Eventos saem pela outbox para notificações, analytics e detecção de fraude.
4. Mercado Cinza (lavagem de Recursos Marcados) é um módulo do mesmo marketplace com taxa de 15%.
5. Toda listagem, oferta e cancelamento é idempotente e auditável; a interface mostra a taxa antes da confirmação.

### 5.4 Inventário, itens raros, trade e histórico

- **Catálogo** (definições) separado de **instâncias** (itens possuídos). Relíquias têm `mint_number` e `mint_cap`.
- **Histórico de posse** completo por item, visível ao dono atual (procedência é parte do valor da Relíquia).
- **Trade direto** entre dois jogadores com janela de confirmação dupla e revisão final imutável por 5 s (contra troca de item no último instante).
- **Hold** de 24 h em itens recém-adquiridos; itens de evento com bloqueio até o fim da temporada quando indicado.

### 5.5 Battle pass e loja

- **Passe da Maré:** 100 níveis por temporada; XP vem de partidas, Contratos e eventos; trilha gratuita e premium; progresso é lançamento imutável (sem edição manual).
- **Loja:** rotação semanal com feature flags; preço, descrição e preview em 3D antes da compra; sem loot boxes pagas; limites de gasto configuráveis pelo jogador e obrigatórios para menores.
- **Direitos adquiridos (entitlements)** desacoplados do pagamento: a concessão só ocorre após webhook confirmado; chargebacks revertem o entitlement e abrem revisão.

### 5.6 Prevenção de fraude financeira e RMT

- **Fraude de pagamento:** Stripe Radar com regras próprias (velocidade, país, BIN), 3DS quando exigido, limites para contas novas, bloqueio de reembolso em cadeia.
- **RMT (venda por dinheiro real fora do jogo):** sinais combinados — preço muito abaixo do mercado, fluxo de itens de muitas contas para uma, contas recém-criadas vendendo itens raros, correlação de dispositivo e pagamento. Score de risco → hold automático de trade → revisão humana → sanção de trade antes de sanção de conta.
- **Fazenda de contas:** Turnstile no cadastro, verificação de e-mail, carência de 10 h de jogo, limites diários, fingerprint.
- **Transparência:** termos de uso proíbem RMT explicitamente; comunicação clara de que itens não têm valor monetário fora do jogo.

---

## 6. Infraestrutura, DevOps e escalabilidade

### 6.1 Nuvem

**GCP** como provedor inicial: GKE (Autopilot para plataforma, Standard para game servers com node pools dedicados), Cloud SQL para PostgreSQL com HA, Memorystore para Redis, Secret Manager, KMS, Cloud Armor como segunda camada. Região primária **southamerica-east1 (São Paulo)**, depois **us-east** e **europe-west** conforme o público. Tudo em Terraform, nada criado à mão, para que a migração para AWS seja uma decisão de negócio, não técnica. Multi-cloud só quando houver motivo concreto (latência em região sem cobertura, negociação comercial).

### 6.2 Game servers

- **Kubernetes + Agones:** cada partida de Arena é um `GameServer` alocado de uma `Fleet` por região; os Shards são uma `Fleet` separada com recursos maiores e `terminationGracePeriod` longo para snapshot.
- **Imagens** mínimas (distroless), um binário Rust, start em menos de 2 s.
- **Alternativa gerenciada:** Hathora ou Edgegap operam a frota por nós, com API de alocação e regiões globais. Vale considerar se o time de DevOps for de uma pessoa até a Fase 3.

### 6.3 Autoscaling

- **Fleet autoscaler** do Agones por buffer: manter N servidores prontos por região (ex.: 10 Arenas, 1 Shard), com N variando por hora do dia a partir de histórico.
- **Cluster autoscaler** nos node pools de jogo com headroom de 30%; nodes de jogo com `taint` para não receber plataforma.
- **Plataforma** com HPA por CPU e por latência p95; Redis e Postgres dimensionados com margem e alarmes de saturação.
- **Shards** não escalam horizontalmente dentro de um mapa; escalam por número de mapas. O limite de 120 jogadores e 120 unidades por jogador é um parâmetro, validado em carga antes de subir.

### 6.4 CI/CD

- **GitHub Actions** com cache remoto (Turborepo para TS, sccache para Rust): lint, typecheck, testes, build, SAST, scan de imagem, SBOM, em menos de 15 minutos.
- **Teste de determinismo** obrigatório: replay de referência produz o mesmo hash em nativo e WASM.
- **Ambientes:** preview por PR (plataforma e app), `staging` espelhando produção com dados sintéticos, `production` por **ArgoCD** (GitOps, rollout progressivo, rollback em um comando).
- **Game servers:** rollout por versão de protocolo; partidas em andamento terminam na versão antiga (Agones drena), novas alocam na nova.
- **Banco:** migrações versionadas (Drizzle), sempre compatíveis para frente e para trás por uma versão, aplicadas antes do deploy.

### 6.5 Observabilidade

- **OpenTelemetry** em app (Web SDK), plataforma e game server: traces de ponta a ponta com o ID da partida como atributo.
- **Métricas-chave:** tick time p99 por game server, banda por cliente, comandos rejeitados por motivo, latência de matchmaking, tempo de alocação do Agones, erro por rota, saldo de reconciliação do ledger, fila de moderação.
- **Logs** estruturados (JSON) com correlação por request e partida; **Loki** para operação; auditoria em R2 WORM.
- **Sentry** com source maps e release health no app; alertas por release.
- **Alertas** com SLOs: disponibilidade de matchmaking 99,9%, p95 de comando→efeito abaixo de 250 ms, zero divergência de ledger; on-call com escalonamento.
- **Plataforma unificada** (Dynatrace ou Datadog) é uma opção válida quando o custo de operar a stack aberta superar a assinatura.

### 6.6 CDN e otimização de assets

- Assets versionados por hash em **R2** servidos pela CDN com cache imutável; manifesto de assets por versão do jogo.
- Pipeline em CI: glTF → gltfpack (meshopt), texturas → KTX2 (Basis), áudio → Opus; orçamentos por facção falham o build se estourarem.
- Carga por prioridade: shell do app, HUD, mapa, facção própria, facções visíveis; prefetch de facção inimiga ao formar a partida.
- Brotli para texto, HTTP/3 na borda, `preload` dos recursos críticos.

### 6.7 Custos estimados e controle

Estimativas em dólar por mês, ordem de grandeza, sujeitas a região e negociação.

| Fase | Infra e serviços | Principais itens |
|---|---|---|
| Fases 0–2 (dev e staging) | 800–1.500 | GKE pequeno, Cloud SQL HA pequeno, Memorystore, Cloudflare Pro, R2, Sentry, GitHub, PostHog |
| Fase 3 (alfa fechado, até 300 CCU) | 1.500–3.000 | Primeiro node pool de jogo, ClickHouse pequeno, observabilidade |
| Fase 5 (soft launch, 2.000 CCU) | 5.000–10.000 | 40–60 vCPU de game servers, egress de 25–40 TB, Postgres maior, Cloudflare Business ou Enterprise, moderação de chat |

**Onde o dinheiro vai:** egress de rede dos game servers e CPU de simulação. O orçamento de banda por cliente (8 KB/s médio) é um indicador de engenharia acompanhado em todo sprint. **Como controlar:** descontos por uso comprometido depois de três meses de dados reais, R2 para evitar egress de arquivos, nodes spot para staging e bots de carga, `budget alerts` por projeto, tags de custo por módulo, revisão mensal.

A folha de pagamento representa 85–90% do custo total do projeto; a infraestrutura é a menor parte até o lançamento.

---

## 7. Equipe e especialidades

| Função | Responsabilidades | MVP (Fases 0–1) | Entrada |
|---|---|---|---|
| **Producer / Product Manager** | Escopo, roadmap, prioridades, rituais, métricas de produto, relação com jurídico e financeiro | **Crítica** | Fase 0 |
| **Lead Game Designer** | GDD vivo, economia, balanceamento, contras, diplomacia, playtests, especificações para engenharia | **Crítica** | Fase 0 |
| **Engenheiro de Simulação (Rust)** | Crate `sim`: ECS, pathfinding, combate, economia, névoa, determinismo, bots de teste | **Crítica** | Fase 0 |
| **Engenheiro de Rede e Tempo Real (Rust)** | Game server, protocolo, snapshots, interest management, reconexão, Agones | **Crítica** (pode ser a mesma pessoa da simulação até a Fase 1) | Fase 0 |
| **Engenheiro Frontend de Jogos (TS, Three.js)** | Engine de render, câmera, input touch e teclado, FX, orçamento de desempenho, pipeline de assets | **Crítica** | Fase 0 |
| **Engenheiro Frontend de Aplicação (React)** | Lobby, HUD, marketplace, passe, diplomacia, PWA, acessibilidade | **Crítica** | Fase 1 |
| **Engenheiro Backend (TS)** | Plataforma: identidade, matchmaking, ledger, ranked, chat, moderação | **Crítica** | Fase 0 |
| **DevOps / SRE** | Terraform, GKE, Agones, CI/CD, observabilidade, on-call, custos | **Crítica em meio período**, integral a partir da Fase 3 | Fase 0 |
| **UI/UX Designer de jogos** | Design system, HUD mobile e desktop, fluxos de lobby e marketplace, Sala de Negociação, testes de usabilidade | **Crítica** | Fase 0 |
| **Technical Artist** | Direção de arte aplicada, modelos low-poly, atlas, LOD, KTX2, orçamentos por facção, shaders | Contrato na Fase 1; integral na Fase 2 | Fase 1 |
| **QA / Automação de testes** | Estratégia de testes, E2E (Playwright), bots de carga, testes de balanceamento, matriz de dispositivos | Fase 2 | Fase 2 |
| **Engenheiro de Segurança** | Modelagem de ameaças, revisão de auth e economia, pentest interno, resposta a incidentes, LGPD técnica | Consultoria pontual na Fase 0–1; integral antes da Fase 4 | Fase 0 (consultor) |
| **Especialista em Marketplace e Pagamentos** | Stripe e MoR, ledger, antifraude, reconciliação, conformidade fiscal | Fase 4 (pode ser o backend sênior com consultoria) | Fase 4 |
| **Analista de Dados / Economia** | ClickHouse, dashboards de balanceamento, inflação da moeda, detecção de RMT | Fase 3 | Fase 3 |
| **Community Manager** | Discord, Boletins da Maré, playtests externos, feedback, moderação inicial | Fase 3 | Fase 3 |
| **Jurídico e Privacidade (contrato)** | Termos, política de privacidade, DPO, consumidor, menores, impostos | Fase 0 (contrato) | Fase 0 |

**Núcleo mínimo para começar:** 7 pessoas (Producer, Lead Designer, Rust sim/rede, Frontend jogos, Backend TS, UI/UX, DevOps meio período) mais consultoria de segurança e jurídico. Crescimento para 11–13 até a Fase 4.

---

## 8. Roadmap

Sprints de duas semanas. Durações realistas para o núcleo de 7 crescendo até 12.

### Fase 0 · Preparação · 6 semanas (3 sprints)

**Escopo:** decisões técnicas registradas em ADRs; monorepo, CI e ambientes; protótipo de rede (comandos e snapshots) com cubos; protótipo de render com 2.000 instâncias em celular de entrada; esqueleto do `sim` com teste de determinismo; Keycloak e login funcionando; modelagem de ameaças inicial; GDD técnico das Fases 1–2; contratação do núcleo.

**Definition of Done**
- ADRs aprovados para: simulação, transporte, render, auth, nuvem, pagamentos, dados.
- CI verde com lint, testes, SAST, scan de imagem e teste de determinismo.
- Protótipo de rede: 2 clientes, 500 entidades, 10 Hz, banda medida abaixo de 10 KB/s por cliente.
- Protótipo de render: 2.000 unidades instanciadas a 30 fps em Android de entrada de 2024.
- Login OIDC funcionando em dev; staging provisionado por Terraform.
- Modelagem de ameaças documentada para auth, protocolo e economia.

### Fase 1 · MVP técnico · 12 semanas (6 sprints)

**Escopo:** login, lobby, fila 1v1, alocação via Agones, partida 1v1 em um mapa (Anel de Kessa reduzido) com uma facção genérica: construir 4 estruturas, 3 tipos de unidade, coletar 2 recursos, energia dinâmica com os três regimes, combate com a tabela de contras, névoa, vitória por destruição de Núcleo. HUD desktop e mobile funcional. Replay gravado.

**Definition of Done**
- 100 partidas 1v1 internas completas sem desconexão não planejada.
- p95 de comando→efeito abaixo de 250 ms com 80 ms de RTT simulado.
- Reconexão em até 60 s recupera a partida.
- Tabela de contras implementada com multiplicadores configuráveis por dados, não por código.
- Replay reproduz a partida com hash idêntico.
- Playtest interno semanal rodando desde o sprint 3.

### Fase 2 · Mecânicas core · 16 semanas (8 sprints)

**Escopo:** três recursos; Nódulos de Avanço; Salto de Núcleo; roubo completo (Interceptação, Sifão, Captura, Recursos Marcados, Caixa, piso anti-grief, Recompensa); facções Vehnar e Erevane completas, Tessara e Vael em versão jogável; superarmas; anomalias; Sala de Negociação com Cessar-fogo, Não-agressão, Caução e Quebra de Pacto; reputação persistente em versão inicial; FFA de 4; bots de balanceamento headless.

**Definition of Done**
- Quatro facções jogáveis com taxa de vitória entre 45% e 55% em 10.000 partidas bot contra bot por par.
- Roubo gera alerta em 100% dos casos dentro do atraso especificado; taxa de contra-ataque após alerta medida.
- Invariantes econômicas verificadas por testes de propriedade (recursos nunca negativos, conservação no roubo).
- Tratado assinado, quebrado e penalizado de ponta a ponta, com clipe automático gerado.
- Playtest externo fechado (50 pessoas) com NPS e retenção D1 medidos.

### Fase 3 · Multiplayer completo, ranked e progressão · 12 semanas (6 sprints)

**Escopo:** 2v2 e FFA 6; ranqueado com MMR por facção e divisões; Shard sazonal com 60 jogadores, Dormência, Cerco e snapshot; Contratos diários; Decreto da Maré; perfil, títulos, banners; chat com moderação automática e reports; WebTransport como aprimoramento; espectador e visualizador de replay público; PWA completo com push; alfa fechado de 300 CCU.

**Definition of Done**
- Shard de 60 jogadores por 7 dias contínuos sem perda de estado; recuperação de falha em menos de 2 minutos a partir de snapshot.
- Matchmaking com p95 abaixo de 90 s em horário de pico do alfa.
- Pentest interno de auth, protocolo e API sem achados críticos abertos.
- Taxa de reports resolvidos dentro do SLA acima de 90%.
- Retenção D7 do alfa acima de 20%.

### Fase 4 · Monetização, marketplace e Battle Pass · 12 semanas (6 sprints)

**Escopo:** ledger em produção; moeda premium; Stripe com Pix e cartão; loja e Passe da Maré; inventário, Relíquias com cunhagem, marketplace com custódia, Mercado Cinza, trade direto; Núcleo Premium; antifraude e detecção de RMT; painel admin de economia; decisão sobre MoR; termos, privacidade e fluxos LGPD em produção.

**Definition of Done**
- Reconciliação diária do ledger com divergência zero por 30 dias em staging com carga sintética.
- Compra, reembolso e chargeback testados de ponta a ponta com webhooks reais em modo teste.
- Teste de concorrência: 1.000 compras simultâneas do mesmo item resultam em exatamente uma transferência.
- Exportação e exclusão de dados do titular funcionando em menos de 72 h, automatizadas.
- Revisão externa de segurança da economia (pentest focado) sem achados altos abertos.

### Fase 5 · Polimento, segurança avançada, soft launch · 12 semanas (6 sprints)

**Escopo:** otimização de desempenho e banda; acessibilidade; onboarding e campanha leve; Expedição; eventos sazonais (Noite da Traição, Maré Negra); pentest externo completo; teste de carga de 5.000 CCU sintéticos; runbooks e on-call; soft launch em uma região (Brasil) com cap de contas; Nhyr em protótipo para a Temporada 2.

**Definition of Done**
- Pentest externo com todos os achados críticos e altos corrigidos e revalidados.
- Teste de carga: 5.000 CCU, 2.000 partidas simultâneas, p99 de tick abaixo de 60 ms, sem erro de alocação.
- Crash-free sessions acima de 99,5% no app.
- Primeiro frame jogável abaixo de 25 MB e 8 s em 4G.
- Soft launch com 10.000 contas, retenção D1 acima de 40% e D7 acima de 20%, ARPDAU e taxa de conversão medidos por duas semanas antes de abrir cadastro geral.

**Total:** cerca de 70 semanas, 16 a 17 meses até o soft launch. Começando em novembro de 2026, soft launch previsto para o primeiro semestre de 2028.

---

## 9. Riscos técnicos e mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Custo de egress dos game servers acima do previsto | Alta | Alto | Orçamento de banda por cliente como KPI de sprint; delta compression e quantização desde a Fase 0; tick de 10 Hz; R2 para arquivos |
| Shard de 120 jogadores não cabe em um processo | Média | Alto | Começar com 60; tick de 5 Hz; cap de unidades configurável; partição por quadrante desenhada na Fase 0 como opção, implementada só se a medição exigir |
| Latência em celular e redes móveis | Alta | Médio | RTS tolera 100–200 ms; confirmação visual imediata; regiões próximas; WebTransport como aprimoramento; matchmaking por latência |
| Determinismo quebrado por dependência ou atualização de toolchain | Média | Médio | Teste de determinismo em CI com replays de referência; toolchain fixada; sem libm transcendental; revisão de dependências do `sim` |
| Bots e automação em ranqueado | Alta | Médio | Limites por tick; análise comportamental; revisão humana; ranqueado com Relíquias desativadas reduz incentivo econômico |
| RMT e fraude no marketplace | Alta | Alto | Circuito fechado sem saque; holds; score de risco; grafo de trades; limites por conta nova; sanção de trade antes de conta |
| Divergência de ledger | Baixa | Crítico | Dupla entrada append-only; transações serializáveis; reconciliação diária; hash encadeado em WORM; alerta em qualquer centavo |
| Dependência de uma pessoa em Rust | Alta | Alto | Duas pessoas em Rust até a Fase 2; documentação do `sim`; pareamento; código simples sem macros exóticas |
| Three.js WebGPU com comportamento diferente entre navegadores | Média | Médio | Fallback WebGL2 testado em CI visual; matriz de dispositivos no BrowserStack; feature flag por renderer |
| Safari e iOS (PWA, WebTransport, memória) | Alta | Médio | WebSocket como base; orçamento de memória para iOS; testes em dispositivo real a cada sprint |
| Escopo de cinco facções e diplomacia estourar o prazo | Alta | Alto | Nhyr adiada para a Temporada 2; Tessara e Vael entram "jogáveis" na Fase 2 e "completas" na Fase 3; cortes decididos pelo Producer com dados de playtest |
| Incidente de dados pessoais | Baixa | Crítico | Minimização; criptografia; acesso por quebra de vidro; plano de resposta; DPO; simulação de incidente antes do soft launch |
| Ataque DDoS no soft launch | Média | Alto | Cloudflare na borda; Spectrum para WSS; tickets obrigatórios; headroom; modo degradado ensaiado |
| Custos de nuvem crescerem sem controle | Média | Médio | Budgets e alertas por projeto; tags por módulo; revisão mensal; uso comprometido só após dados reais |

---

## 10. Entregáveis deste plano

### 10.1 Diagrama de arquitetura

Ver seção 1.2 (diagrama textual) e 1.6 (fluxo de uma partida).

### 10.2 Stack final recomendada

Ver tabela em 1.7. Em uma linha: **Rust para simular, TypeScript para servir, React e Three.js para mostrar, PostgreSQL para guardar dinheiro, Redis para o que é rápido, ClickHouse para o que é muito, Kubernetes com Agones para alocar partidas, Cloudflare na frente de tudo, Keycloak para identidade, Stripe com Pix para cobrar.**

### 10.3 Tarefas priorizadas para as primeiras 4–6 semanas

**Semana 1–2 · Fundações**
1. Criar o monorepo com Turborepo e Cargo workspace; configurar lint, typecheck, testes e Renovate. *(Backend, Frontend)*
2. Escrever os ADRs de simulação, transporte, render, auth, nuvem, dados e pagamentos; revisar com todo o time. *(Producer, todos)*
3. Provisionar projeto GCP, GKE de dev e staging, Cloud SQL, Memorystore, R2 e Cloudflare por Terraform. *(DevOps)*
4. Esqueleto do crate `sim`: tick fixo, ECS, RNG com semente, ponto fixo, hash de estado, teste de determinismo nativo vs WASM. *(Rust)*
5. Esqueleto do game server: aceitar WebSocket, validar ticket JWT, laço de tick, enviar snapshot vazio. *(Rust)*
6. Esqueleto da plataforma NestJS com módulos vazios, OpenAPI, Zod, Drizzle e migração inicial. *(Backend)*
7. Keycloak em dev com realm, OIDC PKCE, Google e e-mail; app React faz login e mostra perfil. *(Backend, Frontend app)*

**Semana 3–4 · Protótipos que respondem perguntas**
8. Protótipo de rede: dois clientes, 500 cubos, comandos de mover, snapshots delta com névoa simplificada; medir banda e latência. *(Rust, Frontend jogos)*
9. Protótipo de render: 2.000 unidades instanciadas com Three.js WebGPU e fallback WebGL2; medir fps em Android de entrada e iPhone de 2022. *(Frontend jogos)*
10. Definir o protocolo binário (FlatBuffers) e gerar tipos para Rust e TS. *(Rust, Frontend jogos)*
11. Design system inicial: tokens, tipografia, HUD de referência mobile e desktop em Figma. *(UI/UX)*
12. Modelagem de ameaças de auth, protocolo e economia; checklist de segurança por PR. *(Segurança consultor, Backend)*
13. Pipeline de assets: gltfpack e KTX2 em CI com orçamento por facção. *(Frontend jogos, Technical Artist)*

**Semana 5–6 · Fechar a Fase 0**
14. Agones instalado no GKE de staging; alocação de um game server por chamada da plataforma; ticket de partida de ponta a ponta. *(DevOps, Backend, Rust)*
15. OpenTelemetry em plataforma e game server; Grafana com tick time e banda; Sentry no app. *(DevOps)*
16. GDD técnico das Fases 1–2 com dados de unidades, estruturas, contras e economia em arquivos de configuração versionados. *(Lead Designer)*
17. Testes: Playwright de login e lobby; proptest das primeiras invariantes do `sim`; k6 de 500 conexões WebSocket. *(Backend, Rust)*
18. Documentos legais em rascunho (termos, privacidade, moeda virtual) e nomeação do DPO. *(Jurídico, Producer)*
19. Revisão de Fase 0 contra a Definition of Done; decisão go/no-go para a Fase 1. *(Producer)*

### 10.4 Checklist de segurança obrigatório antes de qualquer teste público

- [ ] OIDC com PKCE; refresh token rotativo com detecção de reuso; cookies `HttpOnly`, `Secure`, `SameSite`.
- [ ] 2FA (TOTP e passkeys) disponível; obrigatório para admin.
- [ ] Admin atrás de SSO, 2FA, IP allowlist e trilha de auditoria.
- [ ] Tickets de partida assinados, com expiração de 60 s e chaves rotativas (JWKS).
- [ ] Game server rejeita qualquer conexão sem ticket válido antes de alocar estado.
- [ ] Toda mensagem de rede validada por parser estrito com limites de tamanho e sequência.
- [ ] Limite de comandos por tick e por segundo, com log de violação.
- [ ] Snapshots filtrados por névoa verificados por teste automatizado (cliente nunca recebe entidade invisível).
- [ ] TLS 1.3 e HSTS em todos os domínios; mTLS entre game server e plataforma.
- [ ] CSP estrita com nonce; sem `eval`; cabeçalhos de segurança (X-Content-Type-Options, Referrer-Policy, Permissions-Policy).
- [ ] Rate limiting em borda, API e game server; Turnstile em cadastro, login, listagem e report.
- [ ] Cloudflare WAF e Bot Management ativos; game servers atrás de Spectrum ou proteção L3/L4.
- [ ] Segredos em Secret Manager; nenhum segredo em repositório, imagem ou log (gitleaks no CI).
- [ ] SAST, scan de imagem e `cargo audit` sem vulnerabilidade crítica aberta.
- [ ] Ledger append-only com triggers contra UPDATE/DELETE; reconciliação diária testada.
- [ ] Idempotência em toda mutação econômica; teste de concorrência de compra simultânea aprovado.
- [ ] Webhooks de pagamento com verificação de assinatura e replay protection.
- [ ] Dados pessoais minimizados; retenções configuradas; exportação e exclusão funcionando.
- [ ] Termos de uso, política de privacidade e aviso de cookies publicados; consentimentos registrados.
- [ ] Verificação de idade e limites para menores ativos.
- [ ] Filtro de chat e fluxo de report com fila de revisão operante.
- [ ] Logs de auditoria em WORM; acesso a produção por quebra de vidro auditada.
- [ ] Backups de Postgres testados por restauração; snapshot de Shard restaurado com sucesso em staging.
- [ ] Plano de resposta a incidentes escrito e ensaiado uma vez; contatos de ANPD e provedor definidos.
- [ ] Pentest interno de auth, protocolo e API concluído, sem achados críticos ou altos abertos.
- [ ] Teste de carga com 2x o CCU esperado do teste público, sem erros de alocação.

### 10.5 Ferramentas e serviços externos sugeridos

| Necessidade | Ferramenta | Observação |
|---|---|---|
| Identidade | Keycloak (self-hosted) | Alternativas: Ory, Auth0, Clerk |
| Pagamentos | Stripe (cartão, Pix, wallets), Stripe Radar | MoR global: Xsolla ou Paddle; reforço BR: Mercado Pago |
| Borda e proteção | Cloudflare (CDN, WAF, Bot Management, Turnstile, Spectrum, R2) | — |
| Orquestração de game servers | Agones | Gerenciados: Hathora, Edgegap |
| Erros | Sentry | Source maps, release health |
| Observabilidade | OpenTelemetry, Prometheus, Grafana, Loki, Tempo | Unificado: Dynatrace ou Datadog |
| Analytics de produto | PostHog | Funis, retenção, feature flags, aderente à LGPD |
| Analítica de jogo | ClickHouse | Balanceamento e economia |
| E-mail transacional | Resend ou Amazon SES | Verificação, recibos, alertas |
| Moderação de chat | Perspective API ou fornecedor especializado (ActiveFence, Modulate para voz no futuro) | — |
| Fingerprint de dispositivo | Fingerprint (FingerprintJS) | Com DPIA e base legal documentada |
| Testes em dispositivos | BrowserStack ou dispositivos físicos no estúdio | Matriz mínima: 2 Android de entrada, 1 Android topo, 2 iPhones, 1 iPad, Chrome/Edge/Firefox/Safari desktop |
| Carga | Grafana k6 (HTTP e WebSocket) + bots Rust headless | — |
| Pentest | Fornecedor externo independente | Antes da Fase 4 (economia) e antes do soft launch (completo) |
| Feature flags | PostHog ou Unleash | Rollout gradual e kill switch |
| Status page | Instatus ou Statuspage | Transparência operacional |
| Comunidade | Discord | Playtests, suporte, Boletins da Maré |

Anti-cheat de terceiros (kernel) não se aplica a navegador e não é recomendado; a proteção vem da arquitetura autoritativa e da análise comportamental.

### 10.6 Recomendações de testes

| Tipo | Escopo | Ferramentas | Quando |
|---|---|---|---|
| **Unitários** | `sim` (regras, contras, economia), plataforma (serviços), engine (protocolo, interpolação) | Rust test, proptest; Vitest | Todo PR |
| **Determinismo** | Replays de referência produzem o mesmo hash em nativo e WASM, em três versões de toolchain | CI dedicado | Todo PR que toca o `sim` |
| **Propriedade (invariantes)** | Recursos nunca negativos, conservação no roubo, caps, nenhuma unidade sem dono, ledger soma zero | proptest; fast-check | Todo PR |
| **Integração** | API com banco e Redis reais; game server com cliente de teste; webhooks de pagamento em modo teste | Testcontainers, supertest | Todo PR, suíte completa noturna |
| **Contrato** | Protocolo binário entre Rust e TS; OpenAPI entre plataforma e app | Testes gerados a partir dos esquemas | Todo PR |
| **E2E** | Login, lobby, fila, partida curta, compra, listagem, report | Playwright em Chrome, Firefox e WebKit | Noturno e pré-deploy |
| **Visual e desempenho de render** | Screenshots de referência por renderer; fps e memória em dispositivos reais | Playwright + BrowserStack | Semanal e por release |
| **Balanceamento** | 10.000 partidas bot contra bot por par de facções; distribuição de duração; taxa de roubo por minuto | `sim-bots` headless em nodes spot | Noturno |
| **Carga** | 5.000 CCU sintéticos, 2.000 partidas, 1 Shard de 120; p99 de tick; alocação do Agones; API sob pico | k6 e bots Rust | Fim de cada fase e antes de testes públicos |
| **Caos** | Matar game server durante partida, Postgres failover, Redis indisponível, perda de região | Scripts e ferramentas de caos no Kubernetes | Fase 3 em diante, mensal |
| **Segurança** | SAST, DAST, scan de dependências e imagens, pentest interno por fase, pentest externo antes da Fase 4 e do soft launch, bug bounty privado após o soft launch | Semgrep/CodeQL, ZAP, Trivy, fornecedor externo | Contínuo e por marco |
| **Playtest** | Interno semanal desde a Fase 1; externo fechado de 50 na Fase 2; alfa de 300 na Fase 3; beta de 2.000 na Fase 5 | Sessões moderadas, questionários, telemetria, replays | Conforme fases |
| **Acessibilidade** | Contraste, navegação por teclado, leitores de tela no lobby, modo daltônico | axe, testes manuais | Fase 3 em diante |

---

*Aether Rift: Dominion · Plano de Desenvolvimento v0.1 · próximo passo: aprovar os ADRs da Fase 0 e montar o núcleo de sete pessoas.*
