import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAllCases } from "./store.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const resultsFile = path.join(root, "data", "results.json");

const LAUNCH_UTC = Date.UTC(2026, 9, 5);
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

// Cases cycle until the content pipeline supplies a fresh one per day.
// Approved cases are re-read on every request so `npm run approve` goes live without a restart.
function caseFor(n: number) {
  const all = loadAllCases();
  return all[(n - 1) % all.length];
}

const app = express();
app.use(express.json());
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
