# Daily Mystery

One case a day, the same for everyone worldwide. Read the evidence, answer the questions, get a score and a rank, share the result.

- **Stack:** TypeScript, Node, Express. Plain web client (PWA-ready), no build step.
- **Run:** `npm install && npm start` → http://localhost:3000
- **Cases:** 3 built-in in `src/cases.ts` + approved ones in `data/cases/approved/` (6 total). Case number = days since 2026-10-05 (UTC); cases cycle. Test the calendar with `LAUNCH_DATE=2026-09-25 npm start`.
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

## Fixed schedule
`data/schedule.json` maps case number → case id and is **append-only**. Each new day is assigned the next never-aired case the first time anyone requests it, so approving or adding cases can never change a past day. When every case has aired, the one that has gone longest without airing is replayed.
```bash
npm run schedule              # show the schedule + how many fresh days are queued
npm run schedule -- --lock 30 # freeze days through #30 now (commit schedule.json)
```
Never delete a case file that has aired; the server refuses to guess and errors loudly instead. Keep ≥7 fresh cases queued (the command warns).

## Mobile apps (iOS + Android via Capacitor)
The same `public/` web client is wrapped in native shells (`android/`, `ios/`). The apps call your deployed API, so:

1. **Deploy the server** to any Node host with a persistent disk (or after moving to Postgres). Set `ALLOWED_ORIGINS` only if you add extra web origins; the native origins are already allowed.
2. **Set `window.API_BASE`** in `public/config.js` to that https URL. `npm run mobile:sync` refuses to run while it's empty.
3. **Change the app id** `com.dailymystery.app` in `capacitor.config.json` to one you own (it's permanent once published), and update `ios/`/`android/` if you've already opened them.
4. **Android** (any OS): install Android Studio, then `npm run mobile:android` → Build → Generate Signed Bundle (.aab) → upload to Google Play Console (one-time $25 developer fee).
5. **iOS** (needs a Mac with Xcode): `npm run mobile:ios` → set your team/signing → Archive → upload to App Store Connect (Apple Developer Program, $99/year).
6. Both stores require a **privacy policy URL** (the game stores no personal data: anonymous scores only) and screenshots.

`npm run icons` regenerates every icon/splash from `assets/icon.svg`. After any change in `public/`, run `npm run mobile:sync`.

**App Store risk:** Apple can reject apps that are just a website in a wrapper (guideline 4.2). Before submitting, add genuinely native value, e.g. a daily local notification when the new case drops (`@capacitor/local-notifications`), haptics, and offline caching of the current case.

## Daily reminder (native apps)
`public/notify.js` schedules local notifications ("🕵️ Case #N is live") through `@capacitor/local-notifications`. No server or push service is involved.
- The player opts in after their first solve (or via the 🔔 button) and picks a time; permission is requested only then.
- The app plans the next 14 days at once and re-plans every time it opens or a case is solved, so a reminder for an already-solved case never fires. With an active streak the text becomes "Keep your N-day streak alive".
- Case numbers come from `window.LAUNCH_DATE` in `public/config.js`: keep it equal to the server's `LAUNCH_DATE` (default 2026-10-05).
- Notifications are scheduled inexact on Android, and the plugin's `SCHEDULE_EXACT_ALARM` permission is removed in `AndroidManifest.xml` (Google Play restricts it to alarm/calendar apps). Expect delivery within a few minutes of the chosen time.
- The bell and prompt only appear inside the native shell. On the web build there is no reminder UI.
- Android 13+ and iOS ask for notification permission at opt-in; if denied, the panel tells the player to enable it in system settings.
