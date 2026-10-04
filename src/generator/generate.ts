import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import type { Case } from "../cases.js";
import { loadAllCases, pendingDir } from "../store.js";
import { shuffleOptions, validateCase } from "../validate.js";

const AUTHOR_MODEL = process.env.AUTHOR_MODEL ?? "claude-opus-5-5";
const SOLVER_MODEL = process.env.SOLVER_MODEL ?? "claude-sonnet-5-5";
const MAX_ATTEMPTS = 3;
const SOLVERS = 2;

const THEMES = [
  "a missing-person timeline that hinges on phone metadata",
  "a workplace expense fraud caught by receipts that don't line up",
  "a smart-home log that contradicts a witness",
  "an online-marketplace scam with a forged payment screenshot",
  "a restaurant or shop incident explained by an equipment log",
  "a travel mishap where two itineraries conflict",
  "a museum or gallery theft solved from access logs",
  "a fake job offer exposed by small inconsistencies",
  "a school or office prank traced through timestamps",
  "a delivery that never arrived, with a forged signature",
];

const client = new Anthropic();

const caseTool: Anthropic.Tool = {
  name: "submit_case",
  description: "Submit the finished mystery case.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Short, intriguing, max 60 chars" },
      brief: { type: "string", description: "2-4 sentence hook shown before the evidence. Do not reveal the solution." },
      evidence: {
        type: "array",
        description: "5-9 pieces of evidence, in a sensible reading order",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["message", "log", "receipt", "statement", "photo", "note", "document"] },
            title: { type: "string" },
            time: { type: "string", description: "Timestamp or window, e.g. '21:14' or 'Yesterday'" },
            body: { type: "string", description: "Max 400 chars. Concrete, specific details." },
          },
          required: ["type", "title", "body"],
        },
      },
      questions: {
        type: "array",
        description: "Exactly 3 questions, each with 4 options and exactly one correct answer",
        items: {
          type: "object",
          properties: {
            q: { type: "string" },
            options: { type: "array", items: { type: "string" } },
            answer: { type: "integer", description: "Index 0-3 of the correct option" },
          },
          required: ["q", "options", "answer"],
        },
      },
      explanation: { type: "string", description: "Reveal shown after solving: the chain of reasoning, citing the evidence" },
    },
    required: ["title", "brief", "evidence", "questions", "explanation"],
  },
};

const solveTool: Anthropic.Tool = {
  name: "submit_answers",
  description: "Submit your answers to the case questions.",
  input_schema: {
    type: "object",
    properties: {
      reasoning: { type: "string", description: "Brief reasoning using only the evidence provided" },
      answers: { type: "array", items: { type: "integer" }, description: "Chosen option index (0-3) per question, in order" },
      ambiguous_questions: {
        type: "array",
        items: { type: "integer" },
        description: "Indices of questions where more than one option could be defended from the evidence alone",
      },
    },
    required: ["reasoning", "answers", "ambiguous_questions"],
  },
};

const AUTHOR_SYSTEM = `You write cases for "Daily Mystery", a worldwide daily deduction game. Players read evidence and answer 3 multiple-choice questions.

Hard rules:
- SOLVABLE FROM THE EVIDENCE ALONE. Every correct answer must be provable by combining 2+ evidence items. No outside knowledge, no guessing, no "gut feel" answers.
- UNAMBIGUOUS. Exactly one option per question is defensible. Distractors must be plausible but clearly contradicted by specific evidence.
- Include 1-2 red herrings: items that look important but don't change the outcome.
- The key insight is a contradiction between two items (timestamps, locations, amounts, names). Build the timeline first and check the arithmetic: travel times, durations, time zones, totals.
- Question 1 = what/where, question 2 = who/how, question 3 = why or which-evidence-is-misleading. Escalating difficulty.
- Global audience: neutral names from varied cultures, USD for money, 24-hour times, no real people, brands, or places. Family-friendly: no graphic violence, no sexual content. Benign or comic motives are welcome; a surprise ending is better than a crime.
- Vary the position of the correct option; do not always use the same index.
- Each evidence body is concise (under 400 chars) with concrete specifics.`;

const SOLVER_SYSTEM = `You are a sharp detective playing "Daily Mystery". Use ONLY the evidence given. Choose the single best option for each question. If more than one option could be defended from the evidence alone, list that question's index in ambiguous_questions.`;

function toolInput<T>(res: Anthropic.Message, name: string): T {
  const block = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === name);
  if (!block) throw new Error(`Model did not call ${name}`);
  return block.input as T;
}

async function author(theme: string, feedback: string | null, existingTitles: string[]): Promise<Case> {
  const prompt = [
    `Write a new case. Theme seed: ${theme}.`,
    existingTitles.length ? `Do not reuse these existing titles or premises: ${existingTitles.join("; ")}.` : "",
    feedback ? `Your previous draft failed verification. Fix these problems and resubmit a corrected case:\n${feedback}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const res = await client.messages.create({
    model: AUTHOR_MODEL,
    max_tokens: 4000,
    system: AUTHOR_SYSTEM,
    tools: [caseTool],
    tool_choice: { type: "tool", name: "submit_case" },
    messages: [{ role: "user", content: prompt }],
  });
  return toolInput<Case>(res, "submit_case");
}

interface SolverOut {
  reasoning: string;
  answers: number[];
  ambiguous_questions: number[];
}

async function solve(c: Case): Promise<SolverOut> {
  const text = [
    `CASE: ${c.title}`,
    c.brief,
    "",
    "EVIDENCE:",
    ...c.evidence.map((e, i) => `${i + 1}. [${e.type}${e.time ? " @ " + e.time : ""}] ${e.title}: ${e.body}`),
    "",
    "QUESTIONS:",
    ...c.questions.map((q, i) => `Q${i + 1}. ${q.q}\n${q.options.map((o, j) => `  ${j}) ${o}`).join("\n")}`),
  ].join("\n");

  const res = await client.messages.create({
    model: SOLVER_MODEL,
    max_tokens: 1500,
    system: SOLVER_SYSTEM,
    tools: [solveTool],
    tool_choice: { type: "tool", name: "submit_answers" },
    messages: [{ role: "user", content: text }],
  });
  return toolInput<SolverOut>(res, "submit_answers");
}

/** Returns null if the case is verified, otherwise feedback for the author. */
async function verify(c: Case): Promise<string | null> {
  const outs = await Promise.all(Array.from({ length: SOLVERS }, () => solve(c)));
  const problems: string[] = [];

  c.questions.forEach((q, i) => {
    const wrongSolvers = outs.filter((o) => o.answers[i] !== q.answer);
    const flagged = outs.filter((o) => o.ambiguous_questions?.includes(i));
    if (wrongSolvers.length) {
      problems.push(
        `Q${i + 1} (intended "${q.options[q.answer]}"): ${wrongSolvers.length}/${SOLVERS} solvers chose differently. ` +
          `Their reasoning: ${wrongSolvers.map((o) => o.reasoning.slice(0, 300)).join(" | ")}`,
      );
    } else if (flagged.length) {
      problems.push(`Q${i + 1}: solvers got it right but flagged it ambiguous (another option is defensible). Tighten the evidence or distractors.`);
    }
  });
  return problems.length ? problems.join("\n") : null;
}

async function generateOne(theme: string, existingTitles: string[]): Promise<string | null> {
  let feedback: string | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`  attempt ${attempt}/${MAX_ATTEMPTS}: authoring…`);
    const draft = await author(theme, feedback, existingTitles);

    const errs = validateCase(draft);
    if (errs.length) {
      feedback = `Structural errors:\n- ${errs.join("\n- ")}`;
      console.log(`  ✗ invalid: ${errs.join("; ")}`);
      continue;
    }

    console.log(`  "${draft.title}": running ${SOLVERS} independent solvers…`);
    feedback = await verify(draft);
    if (feedback) {
      console.log(`  ✗ failed verification:\n${feedback.replace(/^/gm, "    ")}`);
      continue;
    }

    const final = shuffleOptions(draft);
    fs.mkdirSync(pendingDir, { recursive: true });
    const id = new Date().toISOString().replace(/[:.]/g, "-");
    const file = path.join(pendingDir, `${id}.json`);
    fs.writeFileSync(
      file,
      JSON.stringify({ case: final, meta: { theme, authorModel: AUTHOR_MODEL, solverModel: SOLVER_MODEL, attempts: attempt, generatedAt: new Date().toISOString() } }, null, 2),
    );
    console.log(`  ✓ verified → ${path.relative(process.cwd(), file)}`);
    return file;
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const count = Number(get("--count") ?? 1);
  const theme = get("--theme");

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Set ANTHROPIC_API_KEY first.");
    process.exit(1);
  }

  const existingTitles = loadAllCases().map((c) => c.title);
  let ok = 0;
  for (let i = 0; i < count; i++) {
    const t = theme ?? THEMES[Math.floor(Math.random() * THEMES.length)];
    console.log(`Case ${i + 1}/${count}: ${t}`);
    const file = await generateOne(t, existingTitles);
    if (file) ok++;
  }
  console.log(`\n${ok}/${count} cases verified. Review pending files, then: npm run approve`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
