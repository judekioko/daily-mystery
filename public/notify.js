// Daily "new case is live" reminders for the native apps (iOS/Android) via Capacitor Local Notifications.
//
// Everything is local: no server, no push token, no account. The app plans the next HORIZON days of
// reminders at the player's chosen time, and re-plans whenever it opens or a case is solved, so a
// reminder for a case you've already solved never fires.
(function () {
  const DAY = 86_400_000;
  const HORIZON = 14; // iOS caps pending local notifications at 64; 14 is plenty and re-planned on every open
  const KEY = "notify";

  const TEASERS = [
    "A new mystery is waiting. Can you crack it before the clock beats you?",
    "Someone's story doesn't add up. Find out who.",
    "Today's evidence is in. Ready, detective?",
    "3 questions. One truth. Go.",
    "The same case for everyone on Earth. How fast are you?",
  ];

  // ---- pure planning logic (also exported for tests) ---------------------------------------------

  /**
   * Which reminders to schedule. `doneCases` is a Set of case numbers already solved on this device,
   * `streak` is {count, last}. Case numbers follow the server rule: UTC days since launch, 1-based,
   * evaluated at the instant the notification fires.
   */
  function planNotifications({ now, launchUtc, hour, minute, doneCases, streak, horizon = HORIZON }) {
    const out = [];
    for (let k = 0; k <= horizon; k++) {
      const fire = new Date(now.getFullYear(), now.getMonth(), now.getDate() + k, hour, minute, 0, 0);
      if (fire <= now) continue;
      const n = Math.floor((fire.getTime() - launchUtc) / DAY) + 1;
      if (n < 1 || doneCases.has(n)) continue;

      const streaking = streak && streak.count > 0 && streak.last === n - 1;
      out.push({
        id: n,
        title: `🕵️ Case #${n} is live`,
        body: streaking ? `Keep your ${streak.count}-day streak alive. Today's case is waiting.` : TEASERS[n % TEASERS.length],
        at: fire,
        caseNumber: n,
      });
    }
    return out;
  }

  const api = { planNotifications, TEASERS };
  if (typeof module !== "undefined") module.exports = api;
  if (typeof window === "undefined") return;
  window.Notify = api;

  // ---- native integration ------------------------------------------------------------------------

  const plugin = () => window.Capacitor?.Plugins?.LocalNotifications;
  const isNative = () => !!window.Capacitor?.isNativePlatform?.() && !!plugin();

  const read = (k, d) => {
    try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; }
  };
  const write = (k, v) => {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
  };
  const settings = () => ({ enabled: false, hour: 9, minute: 0, dismissed: false, ...read(KEY, {}) });
  const save = (patch) => write(KEY, { ...settings(), ...patch });

  function solvedSet() {
    const done = new Set();
    for (let i = 0; i < localStorage.length; i++) {
      const m = /^done-(\d+)$/.exec(localStorage.key(i) || "");
      if (m) done.add(Number(m[1]));
    }
    return done;
  }

  async function hasPermission() {
    return (await plugin().checkPermissions()).display === "granted";
  }

  async function cancelOurs() {
    const { notifications } = await plugin().getPending();
    if (notifications.length) await plugin().cancel({ notifications: notifications.map((n) => ({ id: n.id })) });
  }

  async function sync() {
    if (!isNative()) return;
    const s = settings();
    try {
      await cancelOurs();
      if (!s.enabled || !(await hasPermission())) return;
      const plan = planNotifications({
        now: new Date(),
        launchUtc: Date.parse(window.LAUNCH_DATE || "2026-10-05"),
        hour: s.hour,
        minute: s.minute,
        doneCases: solvedSet(),
        streak: read("streak", { count: 0, last: 0 }),
      });
      if (plan.length) {
        await plugin().schedule({
          notifications: plan.map((p) => ({
            id: p.id,
            title: p.title,
            body: p.body,
            schedule: { at: p.at, allowWhileIdle: true },
            isExactNotification: false, // a daily nudge doesn't need exact timing; avoids Android's "Alarms & reminders" prompt
            extra: { caseNumber: p.caseNumber },
          })),
        });
      }
    } catch (e) {
      console.warn("notification sync failed", e);
    }
  }

  async function enable(hour, minute) {
    let perm = await plugin().checkPermissions();
    if (perm.display !== "granted") perm = await plugin().requestPermissions();
    if (perm.display !== "granted") return { ok: false, reason: "denied" };
    save({ enabled: true, hour, minute });
    await sync();
    return { ok: true };
  }

  async function disable() {
    save({ enabled: false });
    await sync();
  }

  async function sendTest() {
    if (!(await hasPermission())) {
      const r = await plugin().requestPermissions();
      if (r.display !== "granted") return false;
    }
    await plugin().schedule({
      notifications: [{ id: 999999, title: "🕵️ Test notification", body: "Daily reminders are working.", schedule: { at: new Date(Date.now() + 5000) }, isExactNotification: false }],
    });
    return true;
  }

  // ---- UI ----------------------------------------------------------------------------------------

  const pad = (n) => String(n).padStart(2, "0");
  const timeValue = (s) => `${pad(s.hour)}:${pad(s.minute)}`;
  const parseTime = (v) => {
    const [h, m] = (v || "09:00").split(":").map(Number);
    return { hour: Number.isFinite(h) ? h : 9, minute: Number.isFinite(m) ? m : 0 };
  };

  function mountBell() {
    const header = document.querySelector("header");
    if (!header || document.getElementById("bell")) return;
    const bell = document.createElement("button");
    bell.id = "bell";
    bell.className = "ghost bell";
    bell.setAttribute("aria-label", "Daily reminder settings");
    header.appendChild(bell);
    bell.onclick = openPanel;
    refreshBell();
  }

  function refreshBell() {
    const bell = document.getElementById("bell");
    if (bell) bell.textContent = settings().enabled ? "🔔" : "🔕";
  }

  function openPanel() {
    document.getElementById("notify-panel")?.remove();
    const s = settings();
    const el = document.createElement("div");
    el.id = "notify-panel";
    el.className = "panel-backdrop";
    el.innerHTML = `
      <div class="panel" role="dialog" aria-label="Daily reminder">
        <h2>Daily reminder</h2>
        <p class="brief">Get a notification when the new case is live. It stays on your device, and it's skipped on days you've already solved.</p>
        <label class="row-between">Remind me at <input type="time" id="np-time" value="${timeValue(s)}"></label>
        <div class="msg" id="np-msg"></div>
        <div class="row">
          <button id="np-save">${s.enabled ? "Update" : "Turn on"}</button>
          ${s.enabled ? '<button class="ghost" id="np-off">Turn off</button>' : ""}
          <button class="ghost" id="np-test">Send test</button>
          <button class="ghost" id="np-close">Close</button>
        </div>
      </div>`;
    document.body.appendChild(el);
    const msg = el.querySelector("#np-msg");
    const close = () => { el.remove(); refreshBell(); };
    el.onclick = (e) => { if (e.target === el) close(); };
    el.querySelector("#np-close").onclick = close;
    el.querySelector("#np-save").onclick = async () => {
      const { hour, minute } = parseTime(el.querySelector("#np-time").value);
      const r = await enable(hour, minute);
      if (!r.ok) { msg.textContent = "Notifications are blocked. Allow them for Daily Mystery in your phone's settings."; return; }
      close();
    };
    el.querySelector("#np-off")?.addEventListener("click", async () => { await disable(); close(); });
    el.querySelector("#np-test").onclick = async () => {
      msg.style.color = "var(--muted)";
      msg.textContent = (await sendTest()) ? "Test sent. It arrives in about 5 seconds." : "Notifications are blocked in your phone's settings.";
    };
  }

  // After the first solve is the best moment to ask: the player has just seen why they'd come back tomorrow.
  function fillResultSlot() {
    const slot = document.getElementById("notify-slot");
    const s = settings();
    if (!slot || s.enabled || s.dismissed) return;
    slot.innerHTML = `
      <div class="nudge">
        <div>🔔 <strong>Don't miss tomorrow's case.</strong><br><span class="brief">Get a daily reminder, and keep your streak alive.</span></div>
        <div class="row"><button id="nudge-yes">Remind me</button><button class="ghost" id="nudge-no">Not now</button></div>
      </div>`;
    slot.querySelector("#nudge-yes").onclick = () => { slot.innerHTML = ""; openPanel(); };
    slot.querySelector("#nudge-no").onclick = () => { save({ dismissed: true }); slot.innerHTML = ""; };
  }

  function init() {
    if (!isNative()) return;
    mountBell();
    sync();
    document.addEventListener("visibilitychange", () => { if (!document.hidden) sync(); });
    document.addEventListener("case-solved", sync);
    document.addEventListener("result-rendered", fillResultSlot);
  }

  Object.assign(api, { sync, enable, disable, sendTest, mountBell, openPanel, fillResultSlot, settings, isNative, init });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
