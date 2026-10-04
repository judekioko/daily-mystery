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

## Case generator
```bash
set ANTHROPIC_API_KEY=sk-ant-...            # PowerShell: $env:ANTHROPIC_API_KEY="..."
npm run generate -- --count 5               # optional: --theme "a forged delivery signature"
npm run approve                             # list pending cases
npm run approve -- <file>                   # read the case + answer key
npm run approve -- <file> --yes             # publish into the rotation
```
Pipeline: an author model (`AUTHOR_MODEL`, default claude-opus-5-5) writes a case via a forced tool call → structural validation → **2 independent solver models** (`SOLVER_MODEL`, default claude-sonnet-5-5) solve it from the evidence only. The case passes only if both match the intended answers and neither flags a question as ambiguous. Failures feed the solvers' reasoning back to the author for up to 3 attempts. Options are shuffled, and verified cases land in `data/cases/pending/` for a human read-through before `approve` makes them live.

Note: approved cases are appended to the rotation, so changing the case list changes which case a past day maps to. Fine pre-launch; once real players exist, switch to a fixed date→case schedule.
