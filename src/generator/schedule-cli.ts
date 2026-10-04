import { assignThrough, readSchedule, runway } from "../schedule.js";
import { loadEntries } from "../store.js";

// npm run schedule              show the schedule and how many fresh days remain
// npm run schedule -- --lock 30  assign (freeze) every day through case #30
const i = process.argv.indexOf("--lock");
if (i >= 0) {
  const n = Number(process.argv[i + 1]);
  if (!Number.isInteger(n) || n < 1) {
    console.error("Usage: npm run schedule -- --lock <caseNumber>");
    process.exit(1);
  }
  assignThrough(n);
  console.log(`Locked days 1-${n}.`);
}

const titles = new Map(loadEntries().map((e) => [e.id, e.case.title]));
const s = readSchedule();
for (const [day, id] of Object.entries(s)) console.log(`#${day.padStart(3)}  ${titles.get(id) ?? `MISSING (${id})`}`);

const left = runway();
console.log(`\n${left.length} fresh case(s) in the queue${left.length ? ": " + left.map((e) => e.case.title).join(", ") : ""}.`);
if (left.length < 7) console.log("⚠ Under a week of fresh content. Run `npm run generate` and approve more cases.");
