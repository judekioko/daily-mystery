import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { caseForDay } from "./schedule.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const resultsFile = path.join(root, "data", "results.json");

// Override with LAUNCH_DATE=YYYY-MM-DD to fast-forward the calendar while testing.
const LAUNCH_UTC = Date.parse(process.env.LAUNCH_DATE ?? "2026-10-05");
const DAY_MS = 86_400_000;

interface Result {
  case: number;
  score: number;
  seconds: number;
  at: number;
}

function todayNumber(): number {
  return Math.max(1, Math.floor((Date.now() - LAUNCH_UTC) / DAY_MS) + 1);
}

function loadResults(): Result[] {
  try {
    return JSON.parse(fs.readFileSync(resultsFile, "utf8"));
  } catch {
    return [];
  }
}

function saveResult(r: Result) {
  const all = loadResults();
  all.push(r);
  fs.writeFileSync(resultsFile, JSON.stringify(all));
}

// Day → case comes from the append-only schedule (src/schedule.ts), so history never shifts.
function caseFor(n: number) {
  return caseForDay(n).case;
}

const app = express();
app.use(express.json());

// The native apps load from capacitor://localhost (iOS) and https://localhost (Android) and call this API cross-origin.
const allowedOrigins = new Set(["capacitor://localhost", "https://localhost", "http://localhost", ...(process.env.ALLOWED_ORIGINS?.split(",") ?? [])]);
app.use("/api", (req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.static(path.join(root, "public")));

app.get("/api/case/:n", (req, res) => {
  const n = req.params.n === "today" ? todayNumber() : Number(req.params.n);
  if (!Number.isInteger(n) || n < 1 || n > todayNumber()) return res.status(404).json({ error: "No such case" });
  const c = caseFor(n);
  res.json({
    number: n,
    isToday: n === todayNumber(),
    title: c.title,
    brief: c.brief,
    evidence: c.evidence,
    questions: c.questions.map(({ q, options }) => ({ q, options })),
  });
});

app.post("/api/case/:n/solve", (req, res) => {
  const n = Number(req.params.n);
  if (!Number.isInteger(n) || n < 1 || n > todayNumber()) return res.status(404).json({ error: "No such case" });
  const c = caseFor(n);
  const { answers, seconds, wrong } = req.body ?? {};
  if (!Array.isArray(answers) || answers.length !== c.questions.length) return res.status(400).json({ error: "Bad answers" });

  const correct = c.questions.filter((q, i) => answers[i] === q.answer).length;
  if (correct < c.questions.length) return res.json({ solved: false, correct, total: c.questions.length });

  const secs = Math.min(Math.max(Math.floor(Number(seconds) || 0), 5), 3600);
  const misses = Math.min(Math.max(Math.floor(Number(wrong) || 0), 0), 20);
  const score = Math.max(100, 1000 - secs * 2 - misses * 150);

  const prior = loadResults().filter((r) => r.case === n);
  const below = prior.filter((r) => r.score < score).length;
  const topPercent = Math.max(1, Math.round(((prior.length - below) / (prior.length + 1)) * 100));
  saveResult({ case: n, score, seconds: secs, at: Date.now() });

  res.json({
    solved: true,
    score,
    seconds: secs,
    rank: prior.length - below + 1,
    players: prior.length + 1,
    topPercent,
    explanation: c.explanation,
  });
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`Daily Mystery on http://localhost:${port}`));
