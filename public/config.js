// Where the game API lives.
//  - Web / PWA served by the same server: leave empty (same origin).
//  - Native iOS/Android app: the bundled files have no server, so point this at your deployed API,
//    e.g. "https://api.yourdomain.com". `npm run mobile:sync` fails loudly if this is still empty.
window.API_BASE = "";
