# Documentação do Aether Rift: Dominion

[Voltar ao README](../README.md) · English: the game pages below have `.en.md` versions · Español: las páginas del juego tienen versión `.es.md`

## O jogo

| Página | O que tem | Idiomas |
|:--|:--|:--|
| [Todas as Raças](racas/README.md) | as cinco Raças lado a lado, Eras do Núcleo, pesquisas e a tabela de contras | [en](racas/README.en.md) · [es](racas/README.es.md) |
| [Consórcio Vehnar](racas/vehnar.md) · [Erevane](racas/erevane.md) · [Tessara](racas/tessara.md) · [Coro Quorith](racas/quorith.md) · [Prole Vorag](racas/vorag.md) | líder e história, habilidades, superarma, Ascensão, cada unidade e construção com imagem e números | `.en.md` · `.es.md` |
| [Chefões e modos](chefoes-e-modos.md) | O Arauto, A Forja-Mãe e a Sentinela com as fases e os golpes; Caçada, Eventos da Fenda, mutadores, mapas e os épicos da campanha | [en](chefoes-e-modos.en.md) · [es](chefoes-e-modos.es.md) |
| [Glossário](glossario.md) | cada termo do jogo em português, inglês e espanhol | pt · en · es |

As páginas das Raças e dos chefões são **geradas do código do jogo** (`node tools/docs-gerar.cjs`): os números vêm da simulação e os textos, dos dicionários. Não edite à mão; mude o jogo e gere de novo.

## Roteiro e planos

| Documento | O que é |
|:--|:--|
| [plano-v5.md](plano-v5.md) | **o roteiro atual**: a v5.0 "Além da Fenda", onda por onda, com o que já saiu (5.0a a 5.0g) e o que vem (5.0h a 5.0k) |
| [plano-v4-v5.md](plano-v4-v5.md) | o plano diretor da v4.0 e o que ficou para a v6.0 (servidores e escala) |
| [plano-de-desenvolvimento.md](plano-de-desenvolvimento.md) | o plano de desenvolvimento original (v0.1) |
| [conceito.md](conceito.md) | o documento de conceito (v0.1) |
| [proposta-beta-v1.5.md](proposta-beta-v1.5.md) | a proposta do beta v1.5 e a prova visual |
| [avaliacao-stack-3d.md](avaliacao-stack-3d.md) | a avaliação da stack 3D, do multiplayer e do Motor 5 (WebGPU) |
| [analise-referencias-v2.md](analise-referencias-v2.md) | o estudo de motores de código aberto feito para o beta v2.0 |

## Imagens

`imagens/` guarda as imagens da documentação: `imagens/<raça>/` (cada unidade e construção), `imagens/chefoes/` (chefões e épicos), `imagens/partida/` (capturas e animações de partidas de verdade) e `imagens/compartilhar.jpg` (a imagem de compartilhamento do repositório). As de unidades, construções e chefões saem dos modelos do próprio jogo por `node tools/galeria.cjs`; as de partida, por `node tools/capturas-docs.cjs` (fotos e a batalha) e `python3 tools/animacao-montar.py`; a animação dos chefões, por `node tools/galeria.cjs --giro=chefe_arauto_2,chefe_forja 720 405`.
