# Daily Mystery

One case a day, the same for everyone worldwide. Read the evidence, answer the questions, get a score and a rank, share the result.

- **Stack:** TypeScript, Node, Express. Plain web client (PWA-ready), no build step.
- **Run:** `npm install && npm start` → http://localhost:3000
- **Cases:** `src/cases.ts`. Case number = days since 2026-10-05 (UTC); cases cycle until more are written.
- **Anti-cheat basics:** solutions stay on the server; the client only learns "N of M correct".
- **Scores:** 1000 − 2/sec − 150/wrong guess (min 100). Anonymous; stored in `data/results.json`.

## Next
1. Playtest with strangers (WhatsApp/TikTok), watch where they get stuck.
2. AI-assisted case generator with a consistency checker (every case must be solvable from the evidence alone).
3. Swap JSON file for Postgres; add Cloudflare in front for global latency.
4. Capacitor wrapper for Play Store / App Store once retention is proven.
