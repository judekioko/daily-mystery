import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cases as builtIn, type Case } from "./cases.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const casesDir = path.join(here, "..", "data", "cases");
export const pendingDir = path.join(casesDir, "pending");
export const approvedDir = path.join(casesDir, "approved");

/** A case plus the stable id the schedule refers to. */
export interface Entry {
  id: string;
  case: Case;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function readDir(dir: string): Entry[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => ({ id: f.replace(/\.json$/, ""), case: JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).case as Case }));
}

/**
 * Built-in cases first, then human-approved generated cases in filename (= creation) order.
 * Ids are permanent: built-ins use their title slug, generated cases use their file name.
 */
export function loadEntries(): Entry[] {
  return [...builtIn.map((c) => ({ id: slug(c.title), case: c })), ...readDir(approvedDir)];
}

export function loadAllCases(): Case[] {
  return loadEntries().map((e) => e.case);
}
