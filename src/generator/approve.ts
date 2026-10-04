import fs from "node:fs";
import path from "node:path";
import { approvedDir, pendingDir } from "../store.js";

// Human review gate: generated cases only go live once approved.
//   npm run approve            list pending cases
//   npm run approve -- <file>  print the case for review (and the answer key)
//   npm run approve -- <file> --yes   publish it
const [file, flag] = process.argv.slice(2);
const pending = fs.existsSync(pendingDir) ? fs.readdirSync(pendingDir).filter((f) => f.endsWith(".json")) : [];

if (!file) {
  if (!pending.length) console.log("No pending cases.");
  for (const f of pending) {
    const { case: c } = JSON.parse(fs.readFileSync(path.join(pendingDir, f), "utf8"));
    console.log(`${f}  ${c.title}`);
  }
  process.exit(0);
}

const src = path.join(pendingDir, path.basename(file));
if (!fs.existsSync(src)) {
  console.error(`Not found: ${src}`);
  process.exit(1);
}

if (flag !== "--yes") {
  const { case: c } = JSON.parse(fs.readFileSync(src, "utf8"));
  console.log(`# ${c.title}\n${c.brief}\n`);
  c.evidence.forEach((e: any, i: number) => console.log(`${i + 1}. [${e.type} @ ${e.time ?? "-"}] ${e.title}: ${e.body}`));
  c.questions.forEach((q: any, i: number) => {
    console.log(`\nQ${i + 1}. ${q.q}`);
    q.options.forEach((o: string, j: number) => console.log(`  ${j === q.answer ? "✔" : " "} ${o}`));
  });
  console.log(`\nExplanation: ${c.explanation}\n\nPublish with: npm run approve -- ${path.basename(file)} --yes`);
  process.exit(0);
}

fs.mkdirSync(approvedDir, { recursive: true });
fs.renameSync(src, path.join(approvedDir, path.basename(src)));
console.log(`Approved ${path.basename(src)}. It joins the rotation immediately.`);
