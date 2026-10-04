import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEntries, type Entry } from "./store.js";

/**
 * Fixed date → case schedule. `data/schedule.json` maps case number → case id and is append-only:
 * once a day is assigned it never changes, so adding or approving cases can't reshuffle history.
 *
 * Days are assigned lazily, in order, the first time anyone asks for them. Each new day gets the
 * next case that hasn't been scheduled yet (a queue: approve more cases to extend the runway).
 * Only when every case has been used does it replay the one that has gone longest without airing.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
export const scheduleFile = process.env.SCHEDULE_FILE ?? path.join(here, "..", "data", "schedule.json");

export type Schedule = Record<string, string>;

export function readSchedule(): Schedule {
  try {
    return JSON.parse(fs.readFileSync(scheduleFile, "utf8"));
  } catch {
    return {};
  }
}

function writeSchedule(s: Schedule) {
  fs.mkdirSync(path.dirname(scheduleFile), { recursive: true });
  const tmp = scheduleFile + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(s, null, 2) + "\n");
  fs.renameSync(tmp, scheduleFile); // atomic, so a crash never leaves a half-written schedule
}

/** Assign every unassigned day up to and including `n`. Returns true if anything was written. */
export function assignThrough(n: number, entries: Entry[] = loadEntries()): boolean {
  const s = readSchedule();
  let changed = false;

  for (let day = 1; day <= n; day++) {
    if (s[day]) continue;
    const used = new Set(Object.values(s));
    const fresh = entries.find((e) => !used.has(e.id));
    if (fresh) {
      s[day] = fresh.id;
    } else {
      const lastAired = new Map<string, number>();
      for (const [d, id] of Object.entries(s)) lastAired.set(id, Math.max(lastAired.get(id) ?? 0, Number(d)));
      s[day] = [...entries].sort((a, b) => (lastAired.get(a.id) ?? 0) - (lastAired.get(b.id) ?? 0))[0].id;
    }
    changed = true;
  }
  if (changed) writeSchedule(s);
  return changed;
}

export function caseForDay(n: number): Entry {
  const entries = loadEntries();
  assignThrough(n, entries);
  const id = readSchedule()[n];
  const found = entries.find((e) => e.id === id);
  if (!found) throw new Error(`Schedule day ${n} points at "${id}", but that case no longer exists. Restore its file; never delete aired cases.`);
  return found;
}

/** Cases that have never aired, i.e. days of fresh content left in the queue. */
export function runway(): Entry[] {
  const used = new Set(Object.values(readSchedule()));
  return loadEntries().filter((e) => !used.has(e.id));
}
