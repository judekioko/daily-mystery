const API = window.API_BASE || "";
const view = document.getElementById("view");
const ICONS = { message: "💬", log: "📟", receipt: "🧾", statement: "🗣️", photo: "📷", note: "📝", document: "📄" };
const params = new URLSearchParams(location.search);
const wanted = params.get("case") || "today";

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function renderStreak() {
  const s = store.get("streak", { count: 0 });
  document.getElementById("streak").textContent = s.count ? `🔥 ${s.count}-day streak` : "";
}

function bumpStreak(caseNo) {
  const s = store.get("streak", { count: 0, last: 0 });
  if (s.last === caseNo) return;
  store.set("streak", { count: s.last === caseNo - 1 ? s.count + 1 : 1, last: caseNo });
  renderStreak();
}

async function init() {
  renderStreak();
  const res = await fetch(`${API}/api/case/${wanted}`);
  if (!res.ok) { view.innerHTML = "<p>Case not found.</p>"; return; }
  const c = await res.json();
  const done = store.get(`done-${c.number}`, null);
  if (done) return renderResult(c, done);
  renderIntro(c);
}

function renderIntro(c) {
  view.innerHTML = `
    <div class="case-no">Case #${c.number}</div>
    <h1>${esc(c.title)}</h1>
    <p class="brief">${esc(c.brief)}</p>
    <p class="brief">${c.questions.length} questions. Faster and fewer wrong guesses = higher score. The clock starts when you open the file.</p>
    <button id="go">Open the case file</button>`;
  document.getElementById("go").onclick = () => renderCase(c);
}

function renderCase(c) {
  const answers = new Array(c.questions.length).fill(null);
  let wrong = 0;
  const started = Date.now();

  view.innerHTML = `
    <div class="timer"><span>Case #${c.number}</span><span id="clock">0:00</span></div>
    <h2>Evidence</h2>
    ${c.evidence.map((e) => `
      <div class="ev">
        <div class="meta"><span>${ICONS[e.type] || "•"} ${esc(e.type)}</span><span>${esc(e.time || "")}</span></div>
        <div class="title">${esc(e.title)}</div>
        <div class="body">${esc(e.body)}</div>
      </div>`).join("")}
    <h2>What happened?</h2>
    ${c.questions.map((q, i) => `
      <div class="q">
        <div class="qt">${i + 1}. ${esc(q.q)}</div>
        ${q.options.map((o, j) => `<label class="opt" data-q="${i}" data-o="${j}"><input type="radio" name="q${i}">${esc(o)}</label>`).join("")}
      </div>`).join("")}
    <div class="msg" id="msg"></div>
    <button id="solve" disabled>Submit solution</button>`;

  const clock = document.getElementById("clock");
  const tick = setInterval(() => (clock.textContent = fmt(Math.floor((Date.now() - started) / 1000))), 500);
  const solveBtn = document.getElementById("solve");
  const msg = document.getElementById("msg");

  view.querySelectorAll(".opt").forEach((el) => {
    el.onclick = () => {
      const q = Number(el.dataset.q);
      answers[q] = Number(el.dataset.o);
      view.querySelectorAll(`.opt[data-q="${q}"]`).forEach((x) => x.classList.toggle("sel", x === el));
      solveBtn.disabled = answers.some((a) => a === null);
      msg.textContent = "";
    };
  });

  solveBtn.onclick = async () => {
    solveBtn.disabled = true;
    const seconds = Math.floor((Date.now() - started) / 1000);
    const r = await fetch(`${API}/api/case/${c.number}/solve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers, seconds, wrong }),
    });
    const out = await r.json();
    solveBtn.disabled = false;
    if (!out.solved) {
      wrong++;
      msg.textContent = `${out.correct} of ${out.total} correct. Not quite. Re-check the timeline (-150 pts).`;
      return;
    }
    clearInterval(tick);
    store.set(`done-${c.number}`, out);
    if (c.isToday) bumpStreak(c.number);
    renderResult(c, out);
    document.dispatchEvent(new Event("case-solved"));
    window.scrollTo(0, 0);
  };
}

// Shared links must point at the public site, never at the app's local capacitor:// origin.
function shareUrl(c) {
  const base = window.SHARE_BASE || window.API_BASE || location.origin;
  return `${base}/?case=${c.number}`;
}

function shareText(c, r) {
  return `🕵️ DAILY MYSTERY #${c.number}\n✅ Solved in ${fmt(r.seconds)}\n🏆 Top ${r.topPercent}% · ${r.score} pts\nCan you beat me?`;
}

function renderResult(c, r) {
  const text = shareText(c, r);
  view.innerHTML = `
    <div class="result">
      <div class="case-no">Case #${c.number} · ${esc(c.title)}</div>
      <div class="big">${r.score}</div>
      <div>Solved in ${fmt(r.seconds)} · Rank #${r.rank} of ${r.players}</div>
      <div class="share" id="share">${esc(text)}</div>
      <div class="row">
        <button id="copy">Share result</button>
        <button class="ghost" id="archive">Play an earlier case</button>
      </div>
      <div id="notify-slot"></div>
      <div class="explain"><strong>What really happened</strong><p>${esc(r.explanation)}</p></div>
    </div>`;
  document.getElementById("copy").onclick = async (e) => {
    const full = `${text}
${shareUrl(c)}`;
    const nativeShare = window.Capacitor?.Plugins?.Share;
    if (nativeShare) { try { await nativeShare.share({ text: full }); return; } catch {} }
    if (navigator.share) { try { await navigator.share({ text: full }); return; } catch {} }
    try { await navigator.clipboard.writeText(full); e.target.textContent = "Copied!"; } catch {}
  };
  document.dispatchEvent(new Event("result-rendered"));
  document.getElementById("archive").onclick = () => {
    const n = Math.max(1, c.number - 1);
    location.href = `/?case=${n}`;
  };
}

init();
