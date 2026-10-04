import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cases as builtIn, type Case } from "./cases.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const casesDir = path.join(here, "..", "data", "cases");
export const pendingDir = path.join(casesDir, "pending");
export const approvedDir = path.join(casesDir, "approved");

function readDir(dir: string): Case[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).case as Case);
}

/** Built-in cases first, then human-approved generated cases in filename (= creation) order. */
export function loadAllCases(): Case[] {
  return [...builtIn, ...readDir(approvedDir)];
}
