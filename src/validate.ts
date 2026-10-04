import type { Case } from "./cases.js";

const TYPES = ["message", "log", "receipt", "statement", "photo", "note", "document"];

/** Structural checks only; solvability is verified separately by independent solver passes. */
export function validateCase(c: unknown): string[] {
  const errs: string[] = [];
  const x = c as Partial<Case> | null;
  if (!x || typeof x !== "object") return ["not an object"];

  if (!x.title || x.title.length > 60) errs.push("title missing or over 60 chars");
  if (!x.brief || x.brief.length < 60 || x.brief.length > 600) errs.push("brief must be 60-600 chars");
  if (!x.explanation || x.explanation.length < 80) errs.push("explanation too short");

  if (!Array.isArray(x.evidence) || x.evidence.length < 5 || x.evidence.length > 9) {
    errs.push("need 5-9 evidence items");
  } else {
    x.evidence.forEach((e, i) => {
      if (!TYPES.includes(e.type)) errs.push(`evidence[${i}] bad type "${e.type}"`);
      if (!e.title || !e.body) errs.push(`evidence[${i}] missing title/body`);
      if (e.body && e.body.length > 400) errs.push(`evidence[${i}] body over 400 chars`);
    });
  }

  if (!Array.isArray(x.questions) || x.questions.length !== 3) {
    errs.push("need exactly 3 questions");
  } else {
    x.questions.forEach((q, i) => {
      if (!q.q) errs.push(`questions[${i}] missing text`);
      if (!Array.isArray(q.options) || q.options.length !== 4) errs.push(`questions[${i}] needs 4 options`);
      else if (new Set(q.options.map((o) => o.trim().toLowerCase())).size !== 4) errs.push(`questions[${i}] duplicate options`);
      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) errs.push(`questions[${i}] answer out of range`);
    });
  }
  return errs;
}

/** Shuffle options per question so the right answer isn't biased toward any slot. */
export function shuffleOptions(c: Case): Case {
  return {
    ...c,
    questions: c.questions.map((q) => {
      const order = q.options.map((_, i) => i);
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      return { ...q, options: order.map((i) => q.options[i]), answer: order.indexOf(q.answer) };
    }),
  };
}
