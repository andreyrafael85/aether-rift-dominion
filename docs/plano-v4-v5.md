# Aether Rift: Dominion — Plano Diretor v4.0 e v5.0

Data: 2026-10-10 · Base real: Beta 3.0d (commit 8847dec) · Autoria: direção técnica do projeto
Público: arte, design, narrativa e engenharia. Este documento é a referência única das versões 4.0 e 5.0.

---

## 0. Leitura crítica do briefing (análise sênior)

O briefing está correto na direção e foi adotado quase integralmente. Pontos em que a execução foi **adaptada com justificativa técnica**:

1. **"Raça" substitui "Facção" em toda a superfície do jogo** (UI, textos, páginas, docs). No código, a chave interna `faction` permanece até a 4.0b: ela participa do protocolo de rede versionado e do estado determinístico; renomear junto com a entrada das novas Raças evita duas quebras de compatibilidade.
2. **Estilizado, não fotorrealista — e voxel continua sendo a identidade.** Subsurface scattering, refração e materiais complexos entram como aproximações baratas (wrap lighting, matcap, fresnel falso, bloom já existente), não como técnicas físicas. Em WebGL2 mobile, PBR completo custaria o frame budget inteiro.
3. **WebGPU é aprimoramento progressivo, não base.** WebGL2 (Three.js atual) é o piso de compatibilidade; WebGPU entra como renderer opcional quando o Three.js estabilizar o backend para o nosso caso (instancing massivo).
4. **Progressão que dá poder vale para Campanha e partidas contra IA. No PvP ranqueado, nível dá apenas cosméticos e títulos.** Decisão inegociável de fair play: lockstep determinístico com perks assimétricos por nível criaria pay-to-grind e quebraria o ranking da v5.0.
5. **Marketplace fica para a v5.5+, somente cosméticos, com ledger imutável.** Antes de inventário com valor, é preciso conta, temporada e moderação funcionando.
6. **A v4.0 não tem servidor**, então a progressão é local (ProgressStore v1 em localStorage + código de exportação), já no formato que a conta da v5.0 importa automaticamente.
7. **As 2 Raças novas são o maior custo da v4.0**: entram no sim determinístico, na contra-tabela de armas, na IA e no teste de determinismo entre motores (`tools/det-test.cjs`). O balanceamento usa self-play automatizado (IA x IA headless), não achismo.
8. **LGPD desde o design na v5.0**: dados mínimos, consentimento explícito, exclusão de conta, Argon2id para senhas, verificação de e-mail.

---

## 1. As 5 Raças

Regra geral de identidade: cada Raça tem biologia própria, **nascimento de construção** próprio (animação de build é o maior marcador visual de identidade em RTS), paleta e materiais próprios, e mapeia para sistemas que o sim já possui (auras, destroços, pactos, fotossíntese, roubo), o que torna a implementação verificável.

### 1.1 CONSÓRCIO VEHNAR — a indústria que não dorme
- **Biologia e fisiologia**: pós-humanos ciborgues de gravidade alta; corpos curtos e densos, próteses de trabalho soldadas ao esqueleto. Respiram ar rico em particulado; a fuligem faz parte da cultura ("o cheiro do lucro").
- **Nascimento das construções**: chassi metálico desce em módulos pré-fabricados; andaimes e guindastes automontantes soldam com chuvas de fagulhas; vapor e fumaça alaranjada até a ativação.
- **Unidades e veículos**: blocos pesados, rebites visíveis, escapamentos gêmeos, lagartas largas. Robôs de carga quadrúpedes; veículos fumegam sob dano.
- **Clima preferencial**: tundra e basalto; neve suja de fuligem ao redor da base (decal térmico).
- **Vantagens mecânicas**: Lotes de produção, Reatores com Sobrecarga, blindagem superior, Fundição Orbital (superarma), Rebocador (pirata).
- **Desvantagens**: consumo de energia alto, unidades caras e lentas, pivô de estratégia lento.
- **Upgrades de nível (PvE)**: n5 Lote +1 · n10 Reator +10% · n15 fumaça intimida (civis inimigos fogem) · n20 skin Núcleo-Forja · n25 Fundição -15% recarga · n30 título "Barão da Fuligem".
- **Paleta/materiais**: aço escovado, laranja industrial `#ff7733`, emissivos de fornalha, vapor constante.

### 1.2 EREVANE — o que você não viu, já era deles
- **Biologia**: esguios, pele que difrata luz (iridescência estrutural, como besouros); enxergam no infravermelho; falam baixo por cultura — ruído entrega posição.
- **Nascimento das construções**: placas dobráveis se desdobram como origami e **desaparecem** sob camuflagem óptica ao concluir; só a distorção do ar denuncia.
- **Unidades e veículos**: silhuetas finas, bordas translúcidas, motores silenciosos; franjas de refração falsa (fresnel + distorção de fundo barata).
- **Clima preferencial**: noite, gelo e névoa; a base fica mais forte onde a visibilidade é pior.
- **Vantagens**: camuflagem, roubo limpo (Sifonador), mobilidade, Blecaute (superarma).
- **Desvantagens**: HP baixo, economia fraca sem roubo, revelados por sensores perdem a vantagem.
- **Upgrades (PvE)**: n5 Sifão +10% · n10 camuflagem em movimento para Atirador · n15 Nódulos +1 camuflado · n20 skin Núcleo-Véu · n25 Blecaute +5 s · n30 título "Mão Invisível".
- **Paleta/materiais**: grafite azulado `#33ffd0` sobre `#0d1420`, vidro fumê, brilhos sutis.

### 1.3 TESSARA — a carne que aprende
- **Biologia**: simbiose de polímero vivo e colônias fotossintéticas; tecidos reconfiguráveis; cicatrizes viram blindagem (Traços).
- **Nascimento das construções**: broto translúcido emerge do solo, incha como casulo e **floresce** na estrutura final; bioluminescência pulsa durante o crescimento.
- **Unidades e veículos**: superfícies orgânicas com veios luminosos; mudam sutilmente conforme ganham Traços (módulos visuais acoplados).
- **Clima preferencial**: zonas férteis próximas à Fenda; auroras alimentam a Fotossíntese.
- **Vantagens**: Traços contra o que combatem, Núcleo fotossintético, Salto Evolutivo (superarma), Enxerto (pirata).
- **Desvantagens**: dependência de luz (noite enfraquece), início lento, fraca contra rush antes dos Traços.
- **Upgrades (PvE)**: n5 Traço inicial grátis · n10 Fotossíntese +15% · n15 Enxerto duplo · n20 skin Núcleo-Jardim · n25 Salto +10 s · n30 título "Jardineiro da Fenda".
- **Paleta/materiais**: verde-esmeralda `#55e68a` e âmbar, fake-SSS (wrap lighting) nos tecidos, brilho fotossintético noturno.

### 1.4 CORO QUORITH — mente-colmeia de cristal ressonante (NOVA)
- **Biologia**: não há indivíduos; há **vozes** — poliedros de cristal piezoelétrico animados por uma única onda portadora ("o Coro"). Uma voz isolada é quase inerte; três vozes são um acorde; um exército é uma catedral sonora. Morte não existe: a onda recua e o cristal silencia.
- **Nascimento das construções**: a estrutura **cristaliza do chão em facetas**, como gelo acelerado; cada faceta "afina" com um harmônico audível até o acorde final (áudio e visual casados).
- **Unidades e veículos**: geometrias flutuantes e terrestres com núcleo luminoso; sem rosto, sem frente óbvia; giram para "olhar". Elenco inicial: **Voz** (pulso básico), **Prisma** (tanque refrator), **Diapasão** (suporte, amplia o Elo), **Agulha** (antiaéreo), **Monólito** (cerco ressonante), **Harmônico** (voador), **Afinador** (coletor/construtor), **Ressonador** (pirata: "desafina" uma área — drena energia e silencia torres por segundos), épico **Catedral Errante**.
- **Clima preferencial**: cavernas de cristal e noites límpidas com auroras; o Coro "ouve melhor" sem tempestade.
- **Vantagens mecânicas**: **Elo de Sincronia** — cada aliado Quorith num raio de 90 wu dá +4% dano e +3% armadura (máx. 3 vizinhos; usa a infraestrutura de auras existente); pactos diplomáticos custam metade e rendem o dobro de reputação; superarma **Uníssono** (20 s: todo o exército conta como sincronizado + escudo).
- **Desvantagens**: unidades individualmente fracas, péssimas dispersas; custo alto de Dados; cerco lento sem Monólitos.
- **Upgrades (PvE)**: n5 Elo raio +15% · n10 Diapasão +1 vizinho no cap · n15 pactos instantâneos · n20 skin Núcleo-Órgão · n25 Uníssono +5 s · n30 título "Primeira Voz".
- **Paleta/materiais**: ametista `#b388ff` e branco-gelo, refração falsa (parallax interno), bloom alto, arestas emissivas.
- **IAs de escaramuça**: "Coro de Zayin", "Acorde Sétimo", "Silêncio de Quor".

### 1.5 PROLE VORAG — a fome que floresce (NOVA)
- **Biologia**: superorganismo fúngico-artrópode; cada criatura é um órgão descartável da mesma biomassa. Crescem comendo; param de comer, morrem. A Prole não odeia ninguém — tem fome.
- **Nascimento das construções**: um **casulo úmido** irrompe do solo, pulsa, estica e **rompe** na estrutura final; respingos e membrana que escorre (partículas existentes reaproveitadas).
- **Unidades e veículos**: quitina molhada, membranas translúcidas, demais patas; "veículos" são bestas de carga seladas com órgãos-arma. Elenco inicial: **Cria** (enxame corpo a corpo, eclode em pares), **Cuspidor** (ácido, médio alcance), **Escaravelho** (besta-transporte), **Ferroada** (voadora), **Brutamonte** (tanque biológico), **Semeador** (coletor/planta órgãos), **Carniceiro** (pirata: **consome destroços** — sistema de wrecks existente — e nódulos inimigos, convertendo em biomassa), épica **Matriarca**.
- **Clima preferencial**: pântano quente e chuva ácida; territórios da Prole ganham musgo e esporos no terreno.
- **Vantagens mecânicas**: unidades 30–40% mais baratas e rápidas de produzir; Carniceiro transforma campo de batalha em despensa; expansão agressiva; superarma **Eclosão** (ovos irrompem num ponto e liberam crias temporárias).
- **Desvantagens**: frágeis individualmente, teto tecnológico baixo, dependem de massa contínua; **Fome** (candidata, validar em self-play): fora de território próprio, crias perdem HP lentamente.
- **Upgrades (PvE)**: n5 Cria +1 por eclosão · n10 Carniceiro digere 25% mais · n15 casulos 20% mais rápidos · n20 skin Núcleo-Ninhada · n25 Eclosão +2 crias · n30 título "Boca da Prole".
- **Paleta/materiais**: carmim `#e6455a` e osso, specular úmido, pulsação por vertex animation, membranas translúcidas.
- **IAs de escaramuça**: "Prole Velk", "Ninhada Cega", "Fome de Oru".

**Líderes (nomes e retratos aprovados em 2026-10-10)**: Vehnar · **Barão-Forja** (retrato triunfante); Erevane · **Vesper Ísk** (retrato furioso); Tessara · **Sylva Oriel** (retrato furioso); Quorith · **Zayin Coral** (retrato furioso); Vorag · **Oru Voraz** (retrato sereno). Cada líder tem três expressões (sereno, furioso, triunfante) usadas pelo retrato no HUD, que reage aos avisos da partida.

---

## 2. Reformulação gráfica e redesign 3D (v4.0)

- **Identidade**: voxel estilizado "industrial-orgânico" segue sendo a assinatura; a 4.0 eleva material e movimento, não troca a linguagem.
- **Materiais por Raça** (aproximações baratas, WebGL2): Vehnar metal escovado + emissivo de fornalha; Erevane vidro fumê + fresnel + distorção; Tessara fake-SSS por wrap lighting; Quorith refração falsa por parallax interno + bloom; Vorag specular úmido + pulsação por vertex shader.
- **Nascimento de construção por Raça** (ver fichas): a animação de build é prioridade de arte da 4.0a.
- **Clima local configurável** (presets sobre fog/partículas/luzes existentes): névoa tóxica, tempestade de plasma, chuva de cristais, aurora, chuva ácida.
- **Partículas de recurso**: plasma gotejante, minério em estilhaços, dados como glifos ascendentes.
- **Orçamento de performance**: ≤ 300 draw calls em partida 4 jogadores; InstancedMesh por def+jogador (existente); LOD em 2 níveis para unidades; metas na seção 6.

### 2.1 Engine gráfica 4.x — a inteligência dos renders entra no jogo (continuidade)

Tudo o que foi produzido na galeria (pipeline `tools/arte3d.html`) é código reaproveitável dentro do motor da partida, não só imagem. Mapa de transferência, com a release em que cada item entra:

| Da galeria | No jogo | Release |
|---|---|---|
| Hero 3D Oceano de Tempestades | fundo da tela inicial em 2560×1280 (arquivo separado + placeholder) | 4.0b ✔ |
| Logo Final 2 (Escudo-Órbita) | marca na tela inicial, favicon, carregamento, rodapé; versão viva com a órbita girando | 4.0b ✔ · animado 4.0d ✔ |
| Líderes cartoon 3D com expressões | portais, HUD em "chamada" reagindo à partida, diplomacia, carregamento e fim | 4.0b ✔ |
| Mundos natais (Postal) | tela de carregamento e fundo dos portais; geografia por Raça no mapa: props de território (chaminés, lanças de gelo, brotos, cristais, ovos) crescem em volta do Núcleo e dos Nódulos | 4.0b ✔ |
| Nuvens e atmosfera dos mundos | sombras de nuvem deslizando no terreno; névoa de horizonte por clima | 4.0b ✔ · 4.0c |
| Planetas, luas e nebulosas | céu de fundo com o planeta-mãe da Raça visível ao inclinar a câmera (inclinação livre entra junto) | 4.0d ✔ |
| Materiais com reflexo (env map), anti-aliasing MSAA no pós | materiais das unidades e construções com reflexo real; MSAA no composer nos presets Alta/Ultra | MSAA 4.0c ✔ · env map 4.0d ✔ |
| Cinturão de asteroides | mapa "Cinturão": combate em rochas flutuantes com buracos no terreno | 4.1 |
| Insígnia Cristal | HUD ✔; bandeira no Núcleo e nos Nódulos | 4.0b ✔ · bandeiras 4.0d ✔ |
| Expressões dos líderes | cenas de diplomacia com os dois líderes frente a frente; briefing da campanha | diplomacia 4.0c ✔ · briefing 4.0e |
| Modelos 3D por Raça (Engine gráfica 2) | construções, unidades, nós, rochas, ruínas e adereços em malhas suaves com PBR por peça (src/meshes.js), ícones do HUD renderizados dos modelos, terreno com textura de detalhe, cordilheiras além do mapa | 4.0d ✔ |

Regra de ouro: cada técnica nova no renderizador da galeria vira um módulo do jogo (shader, modelo voxel ou cena Three.js) com orçamento de performance medido em celular intermediário antes de entrar no preset Automática.

## 3. Homepage v4.0

- **Hero cinematográfico**: fundo em canvas com diorama voxel da Raça em foco (renderer existente reaproveitado), parallax leve; fallback estático com `prefers-reduced-motion` e em aparelhos fracos.
- **"Escolha sua Raça"**: 5 portais interativos; focar/tocar um portal muda paleta, névoa e partículas do fundo inteiro.
- **Seções**: modos de jogo (Campanha · Escaramuça · Multiplayer 2–4), notas da versão, requisitos, FAQ curto.
- **Rodapé profissional**: logo + nome; links essenciais; **"Aether Rift Dominion — Versão 4.0 | Lançamento Global 2026"**; créditos, Discord, GitHub, Termos de Uso e Política de Privacidade (páginas estáticas próprias).
- **Mobile-first**: portais em carrossel com swipe, alvos ≥ 44 px, gutter 16 px, sem scroll horizontal.

## 4. Modo História — "O Grande Alinhamento" (até a 4.1a: "O Ciclo da Maré")

**Arco**: de tempos em tempos os cinco mundos do sistema ficam em fila, como no logo. O alinhamento rasga a Fenda e o Domínio — o direito de ditar o que a Fenda cospe — troca de mãos. Cinco Raças, uma vaga. O nome antigo lembrava mar; o novo é cósmico e combina com os eclipses e as tempestades de Éter das missões.

**Estrutura**: Prólogo (3 missões-tutorial) + 4 Atos × 3 missões + 5 Missões de Identidade (uma por Raça) = **20 missões**. Campanha principal jogável com qualquer Raça; diálogos e objetivos secundários variam por Raça (matriz missão × Raça na narrativa).

- **Prólogo — "Primeira Luz"**: M1 base e coleta · M2 energia e regimes · M3 primeira tempestade do Éter.
- **Ato 1 — "Penumbra"**: M4 cerco com muros e portões · M5 caça a comboios (caixas) · M6 sobrevivência noturna.
- **Ato 2 — "Rotas de Éter"**: M7 roubo e contrarroubo (Erevane em destaque) · M8 diplomacia forçada (pacto obrigatório que será traído) · M9 escolta sob tempestade.
- **Ato 3 — "Coro e Fome"**: M10 primeiro contato Quorith (defesa contra acordes) · M11 a Prole devora um aliado (corrida contra Carniceiros) · M12 aliança tripla instável.
- **Ato 4 — "Eclipse Total"**: M13 assalto à Catedral Errante · M14 Matriarca encurralada · M15 a Fenda aberta (final com as 5 Raças no mapa).
- **Missões de Identidade**: I-Vehnar produção sob sabotagem · I-Erevane só furtividade, sem exército · I-Tessara vencer começando à noite · I-Quorith vencer sem nenhuma unidade isolada · I-Vorag consumir X de biomassa antes do tempo.

**Dificuldades**: Fácil → Normal → Difícil → **Fenda** (IA mais agressiva, tempestades mais frequentes, névoa fechada, sem pausa). Modificadores declarados na tela de missão.

**Progressão**: XP por missão e por estrelas (até 3: objetivo principal + 2 bônus). Nível de Comandante 1–30. Recompensas: passivas por Raça (PvE, fichas acima), módulos de construção, variantes de unidade (sidegrades), cosméticos, **Relíquias** (modificadores de campanha equipáveis, 2 slots, ex.: "Âncora de Órbita: superarma recarrega 30% mais rápido, −10% de energia"). **Conquistas permanentes** (ex.: "Núcleo intacto", "Vitória só com infantaria", "Pacifista até o minuto 10").

**Persistência**: ProgressStore v1 (localStorage + código de exportação/backup). A v5.0 importa esse formato na criação da conta.

## 5. Sistema de personalização 3D

- **v4.0 (local)**: cor primária/secundária do jogador; skin de Núcleo (3 por Raça); emblema/decalque; retrato de líder (3 variantes voxel por Raça); bioma e clima da base (presets da seção 2); títulos de conquista. Tela **Hangar**: viewer 3D girável (renderer existente) com as escolhas aplicadas em tempo real.
- **v5.0 (conta)**: inventário server-side, raridades, itens de temporada, presentes; nada que afete poder em PvP.

## 6. Diretrizes mobile-first

- **Metas**: 30 FPS estáveis em Android intermediário (classe Snapdragon 7xx), partida de 25 min sem throttle térmico; carga inicial < 5 MB; TTI < 5 s em 4G.
- **Qualidade automática** por heurística (DPR, núcleos, memória, `prefers-reduced-motion`); cap de DPR 1,5 no touch (existente); modo 30 fps com economia de bateria.
- **Entrada**: alvos ≥ 44 px; HUD pelos polegares (barra inferior existente evolui); gestos: toque move, toque no inimigo ataca, pinça zoom, dois dedos giram.
- **PWA**: manifest + service worker (solo offline); aviso claro de que multiplayer exige rede; haptics leves em eventos-chave.
- **Ciclo de vida**: aba em segundo plano pausa o solo e avisa a sala no multiplayer (limite atual documentado).

## 7. v5.0 — contas, ranking e infraestrutura persistente

**Princípio: evoluir, não reescrever.** O cliente do jogo continua estático em CDN. O meta-portal (conta, ranking, loja) nasce separado (Next.js ou equivalente) consumindo APIs.

- **Acesso**: cadastro e-mail+senha (Argon2id), login por nome de usuário, verificação de e-mail, recuperação de senha, 2FA TOTP opcional, social (Google/Discord) depois. JWT curto + refresh token rotativo.
- **Progressão**: nível de conta visível, títulos; importação automática do ProgressStore local da v4.0.
- **Ranking**: Glicko-2; ranking global e por Raça; **temporadas de 8–10 semanas** com recompensas cosméticas e reset suave.
- **Partidas**: relé autoritativo-lite WebSocket substitui o anfitrião-relé P2P: valida o protocolo versionado, ordena comandos, grava replays, confere os hashes por tick (o determinismo entre navegadores já está garantido — detecção de trapaça e desync vira auditoria de replay). Recomendação: relé próprio primeiro (o lockstep já existe e é simples); Colyseus/Nakama se o matchmaking crescer.
- **Dados**: PostgreSQL (contas, progresso, rating, temporadas, ledger), Redis (sessões, filas de matchmaking), objeto/S3 (replays).
- **Infra**: Docker; começar em 1 provedor gerenciado (Fly/Render/VPS) com 3 containers (api, relé, portal); Kubernetes apenas quando a escala exigir; CDN Cloudflare; observabilidade com OneAgent/Grail desde o dia 1.
- **Segurança/LGPD**: dados mínimos, consentimento, exclusão de conta self-service, rate limiting, logs de auditoria.
- **Marketplace (v5.5+)**: somente cosméticos, ledger append-only, sem dinheiro real no lançamento.
- **Roadmap**: 5.0a contas+perfil+importação · 5.0b relé+replays · 5.0c ranking+temporadas · 5.0d social (amigos, Discord, espectador) · 5.0e loja cosmética.

## 8. Comparativo de evolução

| Dimensão | v3.0 (hoje) | v4.0 | v5.0 |
|---|---|---|---|
| Identidade | 3 "facções" | **5 Raças**, termo "facção" eliminado | idem + títulos/temporadas |
| Visual | voxel 3D, bloom, presets | materiais por Raça, nascimento de construção, clima local | idem + cosméticos de conta |
| Conteúdo | escaramuça vs IA | **Campanha 20 missões**, 4 dificuldades | missões de temporada |
| Progressão | nenhuma | Comandante 1–30 local, conquistas, relíquias | conta persistente, importação |
| Multiplayer | P2P 2–4, host-relé, determinístico | idem + polimento (reconexão básica) | relé autoritativo, replays, ranked |
| Contas | — | — | e-mail/usuário, 2FA, LGPD |
| Ranking | — | — | Glicko-2 global e por Raça |
| Monetização | — | — | v5.5+: cosméticos |
| Infra | GitHub Pages | Pages + PWA | CDN + api + relé + Postgres/Redis |

## 9. Prioridades de implementação

**v4.0 em quatro incrementos** (mesmo método 3.0a→3.0e):
- **4.0a — Identidade** ✔ (2026-10-10): rename Raça em toda a superfície; homepage nova com portais; materiais/paletas por Raça; animações de nascimento de construção; presets de clima.
- **4.0b — Arte aprovada dentro do jogo** ✔ (2026-10-10): logo Escudo-Órbita (tela inicial, favicon, carregamento, rodapé), hero 4K, líderes com três expressões no HUD/diplomacia/fim, mundos natais nos portais, insígnia Cristal, props de território e sombras de nuvem no terreno.
- **4.0c — Raças novas** ✔ (2026-10-10): Quorith e Vorag no sim (Elo de Sincronia, Uníssono, Ressonador que emudece torres, pactos pela metade; Crias em pares, Fome, Carniceiro que devora carcaças e Nódulos, Eclosão), IA com ordens de construção e nomes próprios, self-play round-robin (`tools/selfplay-all.sh`), det-test com as 5 Raças; MSAA 4× nos presets Alta/Ultra; cena de diplomacia frente a frente; controles no PC (rolagem de borda pela janela inteira e botão direito arrastando). *Medido em 2026-10-10 (1v1, IA normal, 4 sementes, 20 min): Vorag 62% de vitórias nos seus confrontos (rush de Crias; perde 0–4 para Quorith), Quorith e Vehnar ≈44%, Tessara 31%, Erevane 25% — Erevane e Tessara já eram as mais fracas antes da 4.0c; próxima rodada de balanceamento na 4.0d (buff Erevane/Tessara, defesa contra rush).*
- **4.0d — Engine gráfica 2 (restilização 3D)** ✔ (2026-10-10): 191 modelos 3D suaves por Raça com PBR por peça e reflexo de ambiente (kits de arquitetura por Raça em src/meshes.js), ícones do HUD renderizados dos modelos, céu com sol e estrelas, planeta-mãe e lua no horizonte, cordilheiras além da borda do mapa, terreno com textura de detalhe e relevo fino, inclinação livre da câmera, bandeiras com a Insígnia, logo vivo, nível de detalhe menor no celular, catálogo 3D (tools/catalogo3d.html), portão de qualidade (tools/qa.cjs); balanceamento Erevane/Tessara.
- **4.0e — Campanha e progresso** ✔ (2026-10-11): ProgressStore v1 (src/progress.js, localStorage + código de backup ARD1), Comandante 1–30, 19 conquistas com títulos, 6 relíquias (2 espaços), 20 missões roteirizadas (src/campaign.js: Prólogo, Atos 1–4 e 5 Missões de Identidade; ondas, comboios, pactos forçados, escolta, tempestades, chefes épicos Catedral Errante e Matriarca), briefing com líderes, HUD de objetivos e transmissões, fim de missão com estrelas e XP, Hangar com visualizador 3D (cor, 3 Núcleos, retrato, título); tools/missions-test.cjs no portão de qualidade. *Critério atendido: campanha jogável com progressão salva.*
- **4.0f — Mobile/PWA e beta** ✔ (2026-10-11): manifesto + ícones (app instalável), service worker versionado pelo build (solo e campanha offline; Three.js/PeerJS/fontes em cache), qualidade automática por GPU/memória/núcleos e ajuste por FPS medido (degrau abaixo de ~26 fps, aquecimento de 6 s), economia de bateria 30 fps (automática com bateria < 20%), dois dedos giram a câmera, vibração em perigo e superarma, pausa ao trocar de aba (aviso no multiplayer), feedback com diagnóstico automático em issue do GitHub. *Próximo passo do beta: rodada com testadores usando o botão Feedback; limite conhecido: aba em segundo plano no multiplayer ainda para o lockstep (cai em 8 s).*

**v4.1 — Feedback de campo (2026-10-11), cinco incrementos a partir dos testes no celular e no PC:**
- **4.1a — Jogabilidade** ✔: toque perto da base move o grupo; construir no toque com arrastar e ✓; câmera aberta no celular em pé; barra inferior de uma linha com alvos de 44 px; fila de produção até 50 agrupada (×N, pago ao começar, +1/+5/+10); dificuldades refeitas e medidas por um jogador defensivo de referência (tools/difficulty-test.cjs) e nível Brutal; cores por Raça em todos os modos e Hangar corrigido; noites legíveis; notas enxutas. *Medido (10 partidas por nível, Raças espelhadas, 20 min): o defensor cai 0/10 no Fácil, 1/10 no Normal, 2/10 no Difícil e 7/10 no Brutal; primeiro ataque aos 12, 8, 6 e 5 min.*
- **4.1b — Interface e campanha** ✔: tela inicial com abas (Jogar, Campanha, Multiplayer, Ajustes), aba lembrada; campanha renomeada para "O Grande Alinhamento" (os cinco mundos alinhados abrem a Fenda, como no logo), atos Primeira Luz, Penumbra, Rotas de Éter, Coro e Fome, Eclipse Total; "Continuar" de um clique e "Próxima/Repetir missão" sem briefing; minimapa em radar redondo que gira com a câmera; botão de início próprio da sala multiplayer.
- **4.1c — Persistência** ✔: salvamento automático a cada 10 s e ao sair da aba (solo e campanha) por fotografia exata do estado (sim, IA, roteiro da missão), comprimida com gzip no IndexedDB; volta direta em até 30 s e cartão "Partida interrompida" depois disso; três espaços manuais (💾/Ctrl+S) e "pausar e sair"; multiplayer: lugar guardado por 2 min com ficha secreta, volta automática (mesmo recarregando a página) com o estado enviado pelo anfitrião. A reprodução de comandos foi descartada: levava mais de 1 min em partidas longas. Portões: tools/save-test.cjs (24 casos idênticos depois da retomada) e tools/mp-rejoin-test.cjs.
- **4.1d — Evolução** ✔: Eras I (Fundação), II (Expansão) e III (Domínio) no Núcleo, com requisitos e custo; o Núcleo cresce (vida, energia, território) a cada Era; Fábrica, Hangar e Laboratório na Era II; pesados, superarma, Armamento e Blindagem na Era III; módulos por estrutura (Câmara de Fusão, Academia, Bateria Pesada); Ascensão por Raça no Laboratório (Revolução Industrial, Véu Total, Florescer, Coro Pleno, Fome Sem Fim). IA evolui no ritmo da dificuldade, troca itens trancados da ordem de construção e expande quando o território seca (defeito antigo: esgotava os nós aos 4 min). Medição (tools/difficulty-test.cjs, defensor iniciante que nunca ataca, 10 partidas por nível, 18 min): Fácil 0/10 quedas, 1º ataque 12 min, Era III 13,8 min; Normal 2/10 (11,6 min), ataque 8 min, Era III 8,3 min; Difícil 4/10 (8,3 min), ataque 7 min, Era III 7,2 min (suavizado: renda 1,0 e 4 produções); Brutal 10/10 (6,0 min), ataque 5 min, Era III 5,7 min. Campanha: p2 ensina a evoluir; Atos começam na Era II.
- **4.1e — Líderes vivos** ✔: bustos 3D com rig (olhos, sobrancelhas, boca, cabeça) em src/leaders3d.js, a partir de tools/arte3d.html; um renderizador WebGL fora da tela desenha todos (cartões e HUD); piscar, respirar, olhar para o ponteiro, aceno, negação, susto e fala; humor 1 sereno, 2 furioso, 3 triunfante e 4 preocupado (novo), escolhido pela situação a cada 5 s; celular e movimento reduzido mantêm o retrato 2D.
- **v4.2 — Engine gráfica 3 ("de brilhar os olhos")**, em cinco incrementos. Cada um precisa de captura comparativa (antes e depois) e de medida de FPS em aparelho real. O ambiente de build só tem GPU de software (SwiftShader, 2 a 4 fps), então desempenho real só se mede no aparelho dos testadores.
  - **4.2a — Medir antes de embelezar**: modo de teste (?bench=1 e botão em Ajustes) com 30 s de câmera roteirizada sobre uma batalha fixa. Ele mede FPS médio e percentis 1% e 5% e manda o resultado no Feedback. Orçamento: 60 fps na qualidade Média em GPU integrada de notebook e 30 fps na Baixa em celular intermediário. O ajuste automático segura 26 fps.
  - **4.2b — Movimento vivo**: animação procedural por tipo de locomoção, sem custo de malha nova. Rodas giram conforme a velocidade, esteiras rolam (UV), pernas têm ciclo de passo (Prensa, Colosso, Brutamonte), rotores e asas batem nos drones. Canhões recuam e soltam fumaça de disparo, torres giram para mirar e unidades inclinam nas curvas.
  - **4.2c — Efeitos**: explosões em camadas (clarão, bola de fogo, onda de choque, fumaça), partículas na GPU por instâncias, luz pontual curta nos impactos, rastros de projéteis e destroços que caem e viram carcaça no chão. Marcas de queimado no terreno e superarmas com assinatura visual por Raça.
  - **4.2d — Mundo vestido e luz**: vegetação, pedras e cristais instanciados por bioma, com nível de detalhe. Estradas surgem entre estruturas, há lagos de Plasma com reflexo e sombras de nuvens correndo no chão. À noite, prédios acendem janelas e veículos ligam faróis. Gradação de cor por clima e Raça (LUT), névoa baixa e raios de luz saindo da Fenda.
  - **4.2e — Detalhe de modelos**: épicos (Catedral, Matriarca) e pesados com mais peças, marcas de veterania (★) e desgaste, antenas e bandeirolas com física simples.
  - O mapa Cinturão passa para a v4.3.

**Preparação para a v5.0 dentro da v4.0**: interface ProgressStore (local hoje, conta amanhã); IDs estáveis de itens/conquistas; log de comandos por partida (replay local); protocolo de rede versionado (feito na 3.0d); separação meta/jogo na estrutura de páginas.

**Riscos**: (1) escopo das 2 Raças novas — mitigado por mapear para sistemas existentes; (2) arte voxel em volume — mitigado por geração procedural por código já praticada; (3) performance mobile com 5 paletas de materiais — mitigado pelo orçamento de draw calls e LOD; (4) balanceamento 5 Raças — mitigado por self-play headless automatizado.

---

### Mapa de entregáveis do briefing → seções
1. Cinco Raças completas → §1 · 2. Modo História → §4 · 3. Homepage + rodapé → §3 · 4. Personalização 3D → §5 · 5. Mobile-first → §6 · 6. Arquitetura e roadmap v5.0 → §7 · 7. Comparativo → §8 · 8. Prioridades → §9 · Análise crítica → §0.
