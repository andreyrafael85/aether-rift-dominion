# Aether Rift: Dominion documentation

[Back to the README](../README.md) · The game pages below exist in English, Português (`.pt-BR.md`) and Español (`.es.md`).

## The game

| Page | What it has | Languages |
|:--|:--|:--|
| [All Races](racas/README.md) | the five Races side by side, Core Eras, research, modules with a choice and the counters table | English · [Português](racas/README.pt-BR.md) · [Español](racas/README.es.md) |
| [Vehnar Consortium](racas/vehnar.md) · [Erevane](racas/erevane.md) · [Tessara](racas/tessara.md) · [Quorith Choir](racas/quorith.md) · [Vorag Brood](racas/vorag.md) | leader and story, abilities, superweapon, Ascension, the Commander in the field with its three abilities, every unit and building, and the two unique buildings, with images and numbers | English · `.pt-BR.md` · `.es.md` |
| [Bosses and modes](bosses-and-modes.md) | The Herald, The Mother Forge and the Sentinel with phases and attacks; Hunt, Rift Events, mutators, the Living world (ruins, corsairs and mercenaries, wildlife, Aether surge), maps and the campaign epics | English · [Português](bosses-and-modes.pt-BR.md) · [Español](bosses-and-modes.es.md) |
| [Glossary](glossario.md) | every game term in Portuguese, English and Spanish | pt · en · es |

The Race and boss pages are **generated from the game code** (`node tools/docs-gerar.cjs`): the numbers come from the simulation and the texts from the game dictionaries. Do not edit them by hand; change the game and generate again (`node tools/docs-gerar.cjs --conferir` checks that they match).

## Roadmap and plans (in Portuguese)

| Document | What it is |
|:--|:--|
| [plano-v5.md](plano-v5.md) | **the current roadmap**: v5.0 "Beyond the Rift", wave by wave, with what has shipped (5.0a to 5.0h) and what comes next (5.0i to 5.0k) |
| [plano-v4-v5.md](plano-v4-v5.md) | the v4.0 master plan and what was left for v6.0 (servers and scale) |
| [plano-de-desenvolvimento.md](plano-de-desenvolvimento.md) | the original development plan (v0.1) |
| [conceito.md](conceito.md) | the concept document (v0.1) |
| [proposta-beta-v1.5.md](proposta-beta-v1.5.md) | the beta v1.5 proposal and the visual proof |
| [avaliacao-stack-3d.md](avaliacao-stack-3d.md) | the evaluation of the 3D stack, multiplayer and Engine 5 (WebGPU) |

## Images

`imagens/` holds the documentation images: `imagens/<race>/` (every unit, building, unique building and commander avatar), `imagens/chefoes/` (bosses and epics), `imagens/partida/` (screenshots and animations of real matches) and `imagens/compartilhar.jpg` (the repository's social preview). Units, buildings and bosses come from the game's own models through `node tools/galeria.cjs` (`--faltando` draws only the missing ones); the match images through `node tools/capturas-docs.cjs` (photos and the battle) and `python3 tools/animacao-montar.py`; the boss animation through `node tools/galeria.cjs --giro=chefe_arauto_2,chefe_forja 720 405`.
