// Native builds bundle public/ with no server behind it, so an empty API_BASE would ship a broken app.
import fs from "node:fs";
const cfg = fs.readFileSync("public/config.js", "utf8");
const m = cfg.match(/^\s*window\.API_BASE\s*=\s*"([^"]*)"/m);
if (!m || !/^https:\/\/[^/]+/.test(m[1])) {
  console.error('\n✗ public/config.js: set window.API_BASE to your deployed API (https://…) before building the mobile apps.\n');
  process.exit(1);
}
console.log("API_BASE =", m[1]);
