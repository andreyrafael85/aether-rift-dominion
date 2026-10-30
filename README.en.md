# Aether Rift: Dominion — playtest beta

**Languages:** [Português (Brasil)](README.md) · **English** · [Español](README.es.md)

A free real-time strategy game made for the browser. Five Races fight over the Rift: the industrial **Vehnar Consortium**, the stealthy **Erevane**, the adaptive **Tessara**, the crystal hive mind **Quorith Choir** and the ravenous **Vorag Brood**, each with its own leader, army, Pirate and superweapon. It runs on PC and phone, with nothing to install.

**Play now:** open the GitHub Pages link in this repository's description, or open `index.html` locally in any modern browser. The game picks your language on its own (English, Spanish or Brazilian Portuguese) and you can switch any time in **Language** on the start screen, in Settings or in the in-match settings window. To share a specific language, add `?lang=en`, `?lang=es` or `?lang=pt` to the link.

## What is in the game
- **Skirmish** against 1 to 3 AIs (Easy, Normal, Hard, Brutal) on two maps: the **Rift Plains** and **The Belt**, asteroid platforms floating in space.
- **Campaign "The Great Alignment":** 20 scripted missions (Prologue, Acts 1 to 4 and the Identity Missions of each Race), with stars, a Commander level, relics, achievements and the Hangar.
- **Multiplayer for 2 to 4 friends** by room code, peer to peer (no game server).
- Dynamic energy, three resources (Plasma, Ore and Data), territory with Outposts, resource theft with Pirates, Non-Aggression Pacts that can be broken at the right moment, Core Eras and a Race Ascension.
- **War Room** in 3D on the start screen with the **Command Academy** (every unit and building, explained), **Photo Mode** (📷 or J), a 30 s **benchmark** with a stutter detector, and autosave that brings you back if the internet or power goes out.
- Graphics: classic 3D engine (Three.js), the new **Engine 5** in testing (WebGPU, falls back to WebGL2) and a light 2D mode for low-end phones.

## What to test
1. A 1v1 on Easy to learn the controls (the H key opens the help).
2. A free-for-all with 2 AIs on Normal.
3. Steal: train a Pirate at the Barracks and right-click an enemy Refinery.
4. Propose a pact through Diplomacy and, if you dare, break it at the right moment.
5. Draw walls by dragging the mouse (B, then M) and leave a Gate (G) for your units.
6. Multiplayer: the host picks the lobby size (2 to 4), clicks **Create lobby** and sends the six-letter code; each friend picks a Race, types the code and clicks **Join**.
7. On a phone: tap one of your units, then tap the ground to move or an enemy to attack.

## Feedback
On the end screen, **Copy result (JSON)** copies a match summary to paste into an Issue, and **Send feedback** opens the Issue template already filled in. Questions that help the most: where did you get lost, were the theft and the alerts clear, was the AI fair, and what was missing for the match to be fun? The automatic diagnostics sent with the feedback stay in Portuguese, for the developer.

## For developers
The whole game is one HTML file generated from `src/` by `node tools/build.mjs` (no npm dependencies for the game itself). Languages live in `src/i18n.js` (the `ARD.t(key, vars)` API, plurals with `Intl.PluralRules`, `data-i18n` attributes in the HTML) and in the dictionaries `src/i18n/pt-BR.js`, `en.js` and `es.js`; the glossary with every game term in the three languages is in `docs/glossario.md`. The full quality gate is `node tools/qa.cjs` (it includes the "idiomas" check: missing keys, mismatched `{x}` placeholders and Portuguese left on screen in English or Spanish).

Content in testing. All rights reserved; redistribution outside this repository is not allowed without permission.
