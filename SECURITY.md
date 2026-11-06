# Security

**English** · [Português](SECURITY.pt-BR.md) · [Español](SECURITY.es.md)

## Reporting a security issue

Found a security problem in the game or in this repository (for example a token or password published by mistake, a way to break someone else's multiplayer match, or a script running where it should not)? **Please do not open a public Issue.** Use GitHub's private reporting: **Security** tab → **Report a vulnerability** in this repository. Describe what you found, how to reproduce it and the possible impact. You will get an answer within 7 days.

## What the game stores

The game runs entirely in the browser: there is no game server, no accounts and no personal data kept by us. Multiplayer uses PeerJS/WebRTC between browsers, with the public PeerJS signaling server used only to find the room; matches and saves stay on each player's device.
