// Bank — the page: setup, the table, scores, settings, local play driver, online rooms, coach, profile.
import { setup, apply, toAct, canBankNow, winners, game, DEFAULT_OPTIONS, ROUND_CHOICES, normOptions } from "./engine.mjs";

const FX = window.FX, TABLE = window.TABLE, COACH = window.COACH, Profile = window.Profile;
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clone = (o) => JSON.parse(JSON.stringify(o));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const COLORS = ["#6ea8fe", "#f0b354", "#6ee7a8", "#f08c8c", "#c49bff", "#5fd4e0", "#f2a3d0", "#cfd56b"];
const LEVEL_NAMES = { easy: "Easy", medium: "Medium", hard: "Hard", tutor: "Hard" };
const DIE_ICON = '<svg class="dieic" viewBox="0 0 16 16" aria-label="rolling"><rect x="1.5" y="1.5" width="13" height="13" rx="3.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="5.5" cy="5.5" r="1.4" fill="currentColor"/><circle cx="10.5" cy="10.5" r="1.4" fill="currentColor"/><circle cx="8" cy="8" r="1.4" fill="currentColor"/></svg>';
const TRAINER = "https://timothyhadfield.github.io/bank-ai-trainer/";

// ------------------------------------------------------------------ storage (always try/catch)
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
};
const SET_DEF = { pace: "wait", speed: "normal", early: true, mode: "computer", people: 2, computers: 3, level: "medium", rounds: DEFAULT_OPTIONS.rounds, names: [], dice: "app", awake: false };
const settings = Object.assign({}, SET_DEF, store.get("bank:settings", {}));
const saveSettings = () => store.set("bank:settings", settings);

// ------------------------------------------------------------------ game holder
// G.s = engine state; G.here = seats this device plays; G.mode = local | online
let G = null;
let busy = false, timer = null, online = null, snap = null, tab = "play", rng = Math.random;

function saveGame() { if (G && G.mode === "local") store.set("bank:game", { s: G.s, here: G.here, level: G.level, tutorial: G.tutorial, daily: G.daily, gid: G.gid, recorded: G.recorded, kind: G.kind, real: G.real, undo: G.undo }); }

function newLocal({ people, computers, level, rounds, names, tutorial = false, daily = false, real = false }) {
  const seats = [];
  for (let i = 0; i < people; i++) seats.push({ kind: "human", name: names[i] || (people === 1 ? (Profile && Profile.name) || "You" : "Player " + (i + 1)) });
  const botNames = ["Ava", "Ben", "Cleo", "Dev", "Esme", "Finn", "Gus"];
  for (let i = 0; i < computers; i++) seats.push({ kind: "computer", name: botNames[i], level });
  rng = tutorial ? tutorialRng(seats.length) : daily ? Profile.daily.rng(undefined, "bank") : Math.random;
  const s = setup(seats.length, { rounds, early: settings.early }, rng, seats);
  if (tutorial) { s.roller = 0; s.levels = s.levels.map((l, i) => (s.kinds[i] === "computer" ? "tutor" : l)); }
  G = { mode: "local", s, here: seats.map((x, i) => (x.kind === "human" ? i : -1)).filter((i) => i >= 0), level, tutorial, daily,
    gid: Date.now().toString(36), recorded: false, kind: people > 1 ? "friends" : "computer", real: !!real && !tutorial && !daily };
  saveGame();
  if (COACH) COACH.closeOffer();
  buildTable();
  schedule();
}

// ------------------------------------------------------------------ local driver
function localAct(seat, action, r = rng) {
  if (!G || G.mode !== "local" || busy) return;
  let next;
  try { next = apply(clone(G.s), seat, action, r); } catch (e) { toast(e.message); return; }
  const prev = G.s;
  if (G.real) G.undo = (G.undo || []).concat([prev]).slice(-30);   // real dice: a mis-tapped die can be taken back
  G.s = next; saveGame();
  present(prev, next).then(schedule);
}
const hereIn = () => (G ? G.here.filter((i) => !G.s.banked[i]) : []);
function schedule() {
  clearTimeout(timer); timer = null;
  if (!G || busy) return;
  const s = G.s;
  if (s.over) { finish(); return; }
  if (G.mode !== "local") { renderActions(); return; }
  const rollerIsComputer = s.kinds[s.roller] === "computer";
  const someoneHere = hereIn().length > 0;
  if (rollerIsComputer && !G.real && !(someoneHere && settings.pace === "wait")) {
    const d = someoneHere ? (settings.speed === "fast" ? 900 : 1500) : (settings.speed === "fast" ? 220 : 520);
    timer = setTimeout(() => localAct(s.roller, { t: "roll" }), d);
  }
  renderActions();
  if (window.COACH) COACH.update();
}

// ------------------------------------------------------------------ animation of one move (from the event list)
async function present(prev, s) {
  busy = true; renderActions();
  try {
    const evs = s.ev || [];
    const roll = evs.find((e) => e.t === "roll");
    if (roll) await showRoll(prev, roll);
    const banks = evs.filter((e) => e.t === "bank");
    for (const b of banks) showBank(b);
    if (banks.length) await wait(fast(420));
    const end = evs.find((e) => e.t === "end");
    if (end && end.bust) { msg(`7! Round ${end.round} is over.`, "bad"); await wait(fast(1100)); }
    else if (end) { msg(`Everyone banked. Round ${end.round} is over.`); await wait(fast(800)); }
  } catch (e) { /* never block the game on an animation */ }
  busy = false;
  renderTable();
  if (s.over) finish();
}
const fast = (ms) => (FX && FX.settings && FX.settings.animSpeed === "fast" ? Math.round(ms * 0.55) : ms);

async function showRoll(prev, e) {
  const d1 = $("#d1"), d2 = $("#d2"), pot = $("#pot");
  if (!d1) return;
  FX && FX.play("diceRoll");
  await Promise.all([TABLE.roll(d1, e.d[0], { duration: 600 }), TABLE.roll(d2, e.d[1], { duration: 650 })]);
  FX && FX.play("diceLand");
  const who = (G.s.names || [])[e.seat] || "";
  const sum = e.d[0] + e.d[1];
  setPhase(e.roll, prev.opts || G.s.opts);
  if (e.kind === "bust") {
    msg(`${who} rolled 7.`, "bad");
    FX && FX.play("hit");
    FX && FX.shake($(".felt"));
    FX && FX.flash($(".felt"), "rgba(240,80,80,.45)");
    pot.textContent = "0"; pot.classList.add("bust");
    return;
  }
  pot.classList.remove("bust");
  if (e.kind === "double") {
    msg(`${who}: doubles! The pot doubles.`, "good");
    FX && FX.play("ding");
    FX && FX.floatText(pot, "×2", "var(--accent-warm)");
    FX && FX.celebrate({ kind: "big", at: pot });
  } else if (e.kind === "seven70") {
    msg(`${who} rolled a safe 7: +70`, "good");
    FX && FX.play("coins");
    FX && FX.floatText(pot, "+70", "var(--good)");
  } else {
    msg(`${who} rolled ${sum}${e.kind === "dblface" ? " (doubles add only)" : ""}.`);
    FX && FX.floatText(pot, "+" + sum, "var(--text)");
  }
  if (FX) await FX.countUp(pot, e.before, e.pot, { duration: fast(380) }); else pot.textContent = e.pot;
  pot.textContent = e.pot;
  chips(e.pot);
}

function showBank(b) {
  const el = document.querySelector(`.seat[data-seat="${b.seat}"]`);
  const mine = G.here.includes(b.seat);
  FX && FX.play(mine ? "coins" : "chips");
  if (el) {
    el.classList.add("banked");
    const st = el.querySelector(".st"); if (st) st.textContent = "+" + b.pot;
    const sc = el.querySelector(".sc"); if (sc) sc.textContent = G.s.scores[b.seat];
    FX && FX.pop(el);
    FX && FX.floatText(el, "BANK! +" + b.pot, "var(--accent-warm)");
  }
  if (mine && FX) FX.celebrate({ kind: "big", at: $("#pot") });
  msg(`${G.s.names[b.seat]} banked ${b.pot}!`, "warm");
}

// ------------------------------------------------------------------ end of game
let finishedShown = null;
function finish() {
  if (!G || !G.s.over) return;
  const key = G.gid + ":" + G.s.rid;
  renderTable();
  if (finishedShown === key) return;
  finishedShown = key;
  const s = G.s, win = winners(s);
  const me = G.here.length === 1 ? G.here[0] : -1;
  const iWon = me >= 0 && win.includes(me);
  if (!G.recorded && Profile && !G.tutorial) {
    G.recorded = true; saveGame();
    try {
      const comps = s.kinds.filter((k) => k === "computer").length;
      const maxBank = me >= 0 ? Math.max(0, ...s.hist.map((h) => h.g[me])) : 0;
      const res = Profile.recordResult({
        mode: G.mode === "online" ? "online" : G.kind === "friends" ? "friends" : "computer",
        level: G.mode === "local" && G.kind === "computer" && comps ? G.level : undefined,
        won: me < 0 ? null : iWon && win.length === 1, draw: iWon && win.length > 1,
        score: me >= 0 ? s.scores[me] : undefined, daily: !!G.daily,
        extra: { maxBank, players: s.n, level: G.level, rounds: s.opts.rounds, wonHard: iWon && G.level === "hard" && comps > 0 },
      });
      G.eloChange = res && res.elo ? res.elo.change : null;
    } catch (e) { /* stats must never break the game */ }
  }
  setTimeout(() => {
    if (me >= 0) FX && FX.celebrate({ kind: iWon ? "win" : "lose" });
    else FX && FX.celebrate({ kind: "win" });
    showResults();
  }, 350);
}

function showResults() {
  const s = G.s, win = winners(s);
  const order = s.scores.map((v, i) => i).sort((a, b) => s.scores[b] - s.scores[a]);
  const me = G.here.length === 1 ? G.here[0] : -1;
  const title = win.length > 1 ? "Shared win: " + win.map((i) => s.names[i]).join(" & ") : (win[0] === me ? "You win!" : s.names[win[0]] + " wins");
  const elo = G.eloChange != null ? `<span class="muted">Rating ${G.eloChange >= 0 ? "+" : ""}${G.eloChange}</span>` : "";
  sheet(`<h3>${esc(title)}</h3>
    <ol class="ranks">${order.map((i) => `<li class="${win.includes(i) ? "win" : ""}${i === me ? " me" : ""}"><span class="dot" style="--c:${COLORS[i]}"></span><span class="grow">${esc(s.names[i])}</span><b class="num">${s.scores[i]}</b></li>`).join("")}</ol>
    ${elo}
    <div class="row"><button class="btn primary grow" data-act="again">Play again</button><button class="btn grow" data-act="newsetup">New setup</button></div>`,
  (act) => {
    if (act === "again") { if (G.mode === "online") return; const k = G.lastSetup; G = null; if (k) newLocal(k); else showSetup(); }
    if (act === "newsetup") { quitGame(); }
  });
}

// ------------------------------------------------------------------ setup screen
function showSetup() {
  clearTimeout(timer);
  const v = $("#v-play");
  const m = settings.mode;
  const total = m === "computer" ? 1 + settings.computers : settings.people + settings.computers;
  const names = settings.names;
  v.innerHTML = `<div class="setup split"><div class="sa">
    <div class="hero"><div class="hero-dice"><span class="hd" id="hd1"></span><span class="hd" id="hd2"></span></div><h1>Bank</h1></div>
    <div class="seg" role="group" aria-label="Mode">
      ${[["computer", "Computers"], ["friends", "Pass & play"], ["online", "Online"]].map(([k, t]) => `<button data-mode="${k}" aria-pressed="${m === k}">${t}</button>`).join("")}
    </div>
    ${m === "online" ? onlineSetupHTML() + `</div><div class="sb">` : `
    <div class="set-grid">
      ${m === "friends" ? stepper("people", "People", settings.people, 1, 8 - settings.computers) : ""}
      ${stepper("computers", "Computers", settings.computers, m === "computer" ? 1 : 0, 8 - (m === "friends" ? settings.people : 1))}
    </div>
    ${m === "friends" ? `<div class="names${settings.people > 4 ? " many" : ""}">${Array.from({ length: settings.people }, (_, i) => `<input class="txt" maxlength="14" data-name="${i}" value="${esc(names[i] || "")}" placeholder="Player ${i + 1}" aria-label="Player ${i + 1} name">`).join("")}</div>` : ""}
    ${m === "friends" ? `<div class="lbl-row"><span class="label">Dice</span><button class="q" data-q="dice">?</button>
    <div class="seg mini push" role="group" aria-label="Dice">${[["app", "In the app"], ["real", "Real dice"]].map(([k, t]) => `<button data-dice="${k}" aria-pressed="${settings.dice === k}">${t}</button>`).join("")}</div></div>` : ""}
    </div><div class="sb">
    ${settings.computers > 0 || m === "computer" ? `<div class="lbl-row"><span class="label">Computer level</span><button class="q" data-q="levels">?</button></div>
    <div class="seg" role="group" aria-label="Computer level">${["easy", "medium", "hard"].map((l) => `<button data-level="${l}" aria-pressed="${settings.level === l}">${LEVEL_NAMES[l]}</button>`).join("")}</div>` : ""}
    <div class="lbl-row"><span class="label">Rounds</span></div>
    <div class="seg" role="group" aria-label="Rounds">${ROUND_CHOICES.map((r) => `<button data-rounds="${r}" aria-pressed="${settings.rounds === r}">${r}</button>`).join("")}</div>
    <button class="btn primary big" data-act="start" ${total < 2 ? "disabled" : ""}>Start game<span class="sub">${total} players</span></button>`}
    <div class="links">
      <button class="btn small ghost" data-act="rules">Rules</button>
      <button class="btn small ghost" data-act="tutorial">Guided game</button>
      <button class="btn small ghost" data-act="daily">Daily game</button>
      <button class="btn small ghost pf-open" data-act="stats">${Profile ? Profile.avatarSVG(Profile.avatar, 22) : ""}My stats</button>
    </div>
  </div></div>`;
  TABLE.die($("#hd1"), 5); TABLE.die($("#hd2"), 2);
  if (m === "online") wireOnlineSetup(v);
  if (COACH && !COACH.offered("bank-first")) {
    COACH.offer({ id: "bank-first", title: "First time playing Bank?", text: "A guided game shows you the rules in two minutes.", yes: "Show me", no: "No thanks", onYes: startTutorial });
  }
}
const stepper = (key, label, val, min, max) => `<div class="stepper"><span class="label">${label}</span><div class="row"><button class="btn small" data-step="${key}" data-d="-1" ${val <= min ? "disabled" : ""} aria-label="Fewer ${label}">−</button><b class="num">${val}</b><button class="btn small" data-step="${key}" data-d="1" ${val >= max ? "disabled" : ""} aria-label="More ${label}">+</button></div></div>`;

function readNames() { document.querySelectorAll("[data-name]").forEach((el) => { settings.names[+el.dataset.name] = el.value.trim(); }); }

function startFromSetup() {
  readNames(); saveSettings();
  const people = settings.mode === "computer" ? 1 : settings.people;
  const k = { people, computers: settings.computers, level: settings.level, rounds: settings.rounds, names: settings.mode === "friends" ? settings.names : [], real: settings.mode === "friends" && settings.dice === "real" };
  newLocal(k); G.lastSetup = k;
}
function startTutorial() {
  closeSheet(); setTab("play");
  newLocal({ people: 1, computers: 2, level: "hard", rounds: 10, names: [], tutorial: true });
  G.lastSetup = { people: 1, computers: 2, level: "hard", rounds: 10, names: [] };
  tour().reset(); tour().start();
}
function startDaily() {
  closeSheet(); setTab("play");
  const k = { people: 1, computers: 3, level: "hard", rounds: 10, names: [], daily: true };
  newLocal(k); G.lastSetup = null;
}
function quitGame() {
  closeSheet();
  if (G && G.mode === "online" && online) { online.leave(); online = null; snap = null; }
  G = null; store.del("bank:game"); clearTimeout(timer);
  if (COACH) { try { tour().stop(); } catch (e) { /* ignore */ } }
  renderAll();
}

// ------------------------------------------------------------------ the table
function buildTable() {
  const v = $("#v-play");
  v.innerHTML = `<div class="game">
    <div class="topbar"><span class="rnd" id="rnd"></span><span class="phase" id="phase"></span><button class="undo-btn" data-act="undo" aria-label="Undo the last move" hidden>Undo</button><button class="q" data-act="rules" aria-label="Rules">?</button></div>
    <div class="seats" id="seats"></div>
    <div class="felt tbl-surface tbl-felt-green" id="felt">
      <div class="msg" id="msg"></div>
      <div class="dice"><span id="d1"></span><span id="d2"></span></div>
      <div class="potbox"><span class="label">Bank</span><span class="potnum num" id="pot">0</span></div>
      <div class="chips" id="chips"></div>
    </div>
    <div class="standing" id="standing"></div>
    <div class="actions" id="actions"></div>
  </div>
  <aside class="side" id="side"></aside>`;
  renderTable();
}
function setPhase(roll, opts) {
  const el = $("#phase"); if (!el) return;
  if (roll < 3) { el.className = "phase safe"; el.innerHTML = `Safe roll ${roll + 1} of 3<small>7 = +70</small>`; }
  else { el.className = "phase risk"; el.innerHTML = `Roll ${roll + 1}<small>7 ends the round</small>`; }
}
function chips(pot) { const c = $("#chips"); if (c) TABLE.chips(c, Math.min(pot, 2000), { cap: 8 }); }

function renderTable() {
  if (!G || !$("#seats")) return;
  const s = G.s;
  $("#rnd").innerHTML = `Round <b>${Math.min(s.round, s.opts.rounds)}</b>/${s.opts.rounds}`;
  if (s.over) { const p = $("#phase"); p.className = "phase"; p.textContent = "Game over"; }
  else setPhase(s.roll, s.opts);
  const cols = s.n <= 4 ? s.n : Math.ceil(s.n / 2);
  const seats = $("#seats");
  seats.style.setProperty("--cols", cols); seats.classList.toggle("c4", cols >= 4);
  seats.innerHTML = s.names.map((nm, i) => {
    const cls = ["seat", i === s.roller && !s.over ? "roller" : "", s.banked[i] ? "banked" : "", G.here.includes(i) && G.here.length === 1 ? "me" : ""].join(" ");
    const st = s.over ? (winners(s).includes(i) ? "won" : "") : s.banked[i] ? "+" + s.gains[i] : i === s.roller ? DIE_ICON : "in";
    const lvl = s.kinds[i] === "computer" ? `<i class="lv">${LEVEL_NAMES[s.levels[i]][0]}</i>` : "";
    return `<div class="${cls}" data-seat="${i}" style="--c:${COLORS[i]}"><span class="nm"><span class="dot"></span><span class="nmt">${esc(nm)}</span>${lvl}</span><b class="sc num">${s.scores[i]}</b><span class="st">${st}</span></div>`;
  }).join("");
  const pot = $("#pot"); pot.textContent = s.pot; pot.classList.toggle("bust", false);
  if (s.dice) { TABLE.die($("#d1"), s.dice[0]); TABLE.die($("#d2"), s.dice[1]); }
  else { TABLE.die($("#d1"), 1); TABLE.die($("#d2"), 1); $("#d1").classList.add("idle"); $("#d2").classList.add("idle"); }
  if (s.dice) { $("#d1").classList.remove("idle"); $("#d2").classList.remove("idle"); }
  chips(s.pot);
  if (!$("#msg").textContent) msg(s.roll === 0 ? `${s.names[s.roller] === "You" ? "You roll" : s.names[s.roller] + " rolls"} first.` : "");
  if (s.roll === 0 && !s.over) msg(`Round ${s.round}: ${s.names[s.roller] === "You" ? "You roll" : s.names[s.roller] + " rolls"} first.`);
  renderStanding();
  renderActions();
  renderSide();
  const ub = $("[data-act=undo]");
  if (ub) ub.hidden = !(G.mode === "local" && G.real && G.undo && G.undo.length);
}
function renderStanding() {
  const s = G.s, el = $("#standing"); if (!el) return;
  const me = G.here.length === 1 ? G.here[0] : -1;
  const top = Math.max(...s.scores);
  if (me < 0) { const lead = s.scores.indexOf(top); el.innerHTML = top ? `Leader <b>${esc(s.names[lead])}</b> ${top}` : "&nbsp;"; return; }
  const others = Math.max(...s.scores.filter((_, i) => i !== me));
  const gap = s.scores[me] - others;
  el.innerHTML = `You <b class="num">${s.scores[me]}</b> · ${gap > 0 ? `leading by <b class="good num">${gap}</b>` : gap === 0 ? "level with the leader" : `<b class="bad num">${-gap}</b> behind the leader`}`;
}

function renderActions() {
  const el = $("#actions"); if (!el || !G) return;
  const s = G.s;
  if (s.over) { el.innerHTML = `<button class="btn primary big grow" data-act="results">See results</button>`; return; }
  const ins = hereIn();
  const can = canBankNow(s) && !busy;
  const rollerHere = G.here.includes(s.roller);
  const rollerComp = s.kinds[s.roller] === "computer";
  let rollBtn;
  if (G.mode === "online") {
    rollBtn = rollerHere ? `<button class="btn primary big roll" data-act="roll" ${busy ? "disabled" : ""}>Roll<span class="sub">your dice</span></button>`
      : `<button class="btn big roll" disabled>${esc(s.names[s.roller])}<span class="sub">is rolling</span></button>`;
  } else if (ins.length === 0 && !G.real) {
    rollBtn = `<button class="btn big roll" data-act="skip" ${busy ? "disabled" : ""}>Skip<span class="sub">to round end</span></button>`;
  } else if (rollerComp && settings.pace !== "wait" && !G.real) {
    rollBtn = `<button class="btn big roll" disabled>${esc(s.names[s.roller])}<span class="sub">is rolling</span></button>`;
  } else {
    rollBtn = `<button class="btn primary big roll" data-act="roll" ${busy ? "disabled" : ""}>Roll<span class="sub">${rollerHere ? (G.here.length > 1 ? esc(s.names[s.roller]) + "'s dice" : "your dice") : esc(s.names[s.roller]) + "'s dice"}</span></button>`;
  }
  let bank;
  if (G.here.length <= 1) {
    const me = G.here[0];
    if (me == null) bank = "";
    else if (s.banked[me]) bank = `<button class="btn big bank done" disabled>Banked<span class="sub num">+${s.gains[me]}</span></button>`;
    else bank = `<button class="btn warm big bank" data-act="bank" data-seat="${me}" ${can ? "" : "disabled"}>BANK<span class="sub num">${s.pot}</span></button>`;
    el.className = "actions";
    el.innerHTML = bank + rollBtn;
  } else {
    el.className = "actions multi";
    el.innerHTML = `<div class="banks" style="--cols:${Math.min(4, G.here.length)}">${G.here.map((i) => s.banked[i]
      ? `<button class="btn bank-sm done" disabled style="--c:${COLORS[i]}"><span>${esc(s.names[i])}</span><b class="num">+${s.gains[i]}</b></button>`
      : `<button class="btn warm bank-sm" data-act="bank" data-seat="${i}" ${can ? "" : "disabled"} style="--c:${COLORS[i]}"><span>${esc(s.names[i])}</span><b>BANK</b></button>`).join("")}</div>${rollBtn}`;
  }
}

function renderSide() {
  const side = $("#side"); if (!side || !G) return;
  side.innerHTML = `<div class="label">Scores</div>${scoreTableHTML()}`;
}

function scoreTableHTML() {
  if (!G) return `<p class="muted">No game yet.</p>`;
  const s = G.s;
  const rows = [];
  for (let r = 1; r <= s.opts.rounds; r++) {
    const h = s.hist[r - 1];
    const cur = !s.over && r === s.round;
    if (!h && !cur && r > s.round) continue;
    const cells = s.names.map((_, i) => {
      if (h) return `<td class="${h.g[i] ? "" : h.bust ? "lost" : ""}">${h.g[i] || (h.bust ? "·" : "0")}</td>`;
      return `<td class="live">${s.banked[i] ? s.gains[i] : ""}</td>`;
    }).join("");
    rows.push(`<tr class="${cur ? "cur" : ""}${h && h.bust ? " bust" : ""}"><th>${r}${h && h.bust ? '<i title="ended by a 7">7</i>' : ""}</th>${cells}</tr>`);
  }
  const top = Math.max(...s.scores);
  return `<div class="scroll tablewrap"><table class="scores${s.n > 5 ? " wide" : ""}"><thead><tr><th>#</th>${s.names.map((n, i) => `<th style="--c:${COLORS[i]}" title="${esc(n)}"><span class="dot"></span><span class="nmc">${esc(n)}</span></th>`).join("")}</tr></thead>
    <tbody>${rows.reverse().join("")}</tbody>
    <tfoot><tr><th>Σ</th>${s.scores.map((v) => `<td class="${v === top && v > 0 ? "lead" : ""}">${v}</td>`).join("")}</tr></tfoot></table></div>`;
}

function msg(text, tone = "") { const el = $("#msg"); if (!el) return; el.textContent = text; el.className = "msg " + tone; }

// ------------------------------------------------------------------ scores + settings tabs
function renderScores() {
  const v = $("#v-scores");
  v.innerHTML = `<div class="page"><div class="label">Round by round</div>${scoreTableHTML()}<p class="muted small">· = lost to a 7</p></div>`;
}
function renderSettings() {
  const v = $("#v-settings");
  const sw = (key, on) => `<label class="switch"><input type="checkbox" data-set="${key}" ${on ? "checked" : ""}><span></span></label>`;
  v.innerHTML = `<div class="page scroll settings">
    <div class="label">Game</div>
    <div class="set-row"><span class="grow">Computer rolls</span><div class="seg mini">${[["wait", "Wait for me"], ["auto", "Automatic"]].map(([k, t]) => `<button data-pace="${k}" aria-pressed="${settings.pace === k}">${t}</button>`).join("")}</div></div>
    <div class="set-row"><span class="grow">Computer speed</span><div class="seg mini">${[["normal", "Normal"], ["fast", "Fast"]].map(([k, t]) => `<button data-speed2="${k}" aria-pressed="${settings.speed === k}">${t}</button>`).join("")}</div></div>
    <div class="set-row"><span class="grow">No banking before roll 3 <button class="q" data-q="early">?</button></span>${sw("late", !settings.early)}</div>
    <div class="set-row"><span class="grow">Keep screen on <button class="q" data-q="awake">?</button></span>${sw("awake", settings.awake)}</div>
    <div class="label">Sound &amp; effects</div>
    <div id="fxset"></div>
    <div class="label">Help</div>
    <div class="row wrap"><button class="btn small" data-act="rules">Rules</button><button class="btn small" data-act="tutorial">Guided game</button><button class="btn small pf-open" data-act="stats">${Profile ? Profile.avatarSVG(Profile.avatar, 22) : ""}My stats</button></div>
    ${G ? `<div class="label">This game</div><div class="row"><button class="btn small danger" data-act="quit">${G.mode === "online" ? "Leave room" : "Quit game"}</button></div>` : ""}
    <div class="label">More</div>
    <div class="row wrap"><a class="btn small" href="${TRAINER}" target="_blank" rel="noopener">AI trainer ↗</a><a class="btn small" href="../">All games</a></div>
  </div>`;
  if (FX) FX.renderSettings($("#fxset"));
}

// ------------------------------------------------------------------ rules + tutorial
const RULES = [
  { id: "goal", title: "Goal", short: "Goal", html: `<p>Everyone shares one pot. Bank it before a 7 wipes it out. After the last round, the highest score wins (ties share the win).</p><p>2 to 8 players. 10, 15 or 20 rounds (most tables play 20). 5 rounds makes a quick game.</p>` },
  { id: "roll", title: "Rolling", short: "Rolling", html: `<p>The dice pass round the table: each roll is made by the next player still in the round. Every roll adds to the pot.</p>
    <table><tr><th></th><th>Rolls 1–3</th><th>Roll 4 on</th></tr><tr><td>A 7</td><td>+70</td><td>Round over: the pot is lost</td></tr><tr><td>Doubles</td><td>add the dice</td><td>double the pot</td></tr><tr><td>Anything else</td><td>add the dice</td><td>add the dice</td></tr></table>` },
  { id: "bank", title: "Banking", short: "Bank", html: `<p>Anyone still in may call <b>Bank</b> at any moment, even when it isn't their roll. The whole pot goes onto your score, and you sit out the rest of the round.</p><p>Several players can bank the same round; each gets the pot as it was when they banked. Players who never banked get nothing from a round that ends with a 7.</p><p class="tip">A round also ends when everyone has banked.</p>` },
  { id: "app", title: "In this app", short: "App", html: `<p>Tap <b>BANK</b> to bank. With <b>Wait for me</b> (Settings), the computers' rolls wait for your Roll tap, so you never miss a moment to bank.</p><p>Computer levels: <b>Easy</b> banks at a set target. <b>Medium</b> is the neural network trained by self-play in Bank Pro AI, with the odd careless round. <b>Hard</b> plays whatever measured hardest to beat at your table size (a tuned rule set or the network) and plays the last round exactly.</p><p>House rule in Settings: no banking before roll 3 (the old AI trainer's rule).</p>` },
  { id: "videos", title: "Videos", short: "Videos", html: `<p>Short how-to-play videos (open in YouTube):</p><ul class="vids">
    <li><a href="https://www.youtube.com/watch?v=KuXX9qmcIro" target="_blank" rel="noopener">Dice Game Bank</a> <span class="muted">· GroupGrape, 1:38</span></li>
    <li><a href="https://www.youtube.com/watch?v=xHHGJfrKaVU" target="_blank" rel="noopener">How to play BANK</a> <span class="muted">· Misclick, 1:56</span></li></ul>
    <p class="tip">Only a few real Bank videos exist so far. Both teach the same rules as this app.</p>` },
];
function openRules(open) { COACH.rules({ title: "How to play Bank", sections: RULES, open }); }

function tutorialRng(n) {
  const r = COACH.rng(7);
  r.stackInts([0], n);                                       // you roll first
  r.stackInts([2, 3, 4, 4, 5, 1, 2, 2, 3, 4, 1, 4], 6);      // 3+4 (safe 7), 5+5, 6+2, 3+3 (double), 4+5, 2+5 (7: round over)
  return r;
}
let _tour = null;
function tour() {
  if (_tour) return _tour;
  const S = () => (G && G.s) || null;
  _tour = COACH.tour({
    id: "bank-first-game",
    pauseIf: () => !!document.querySelector(".sheet-back") || COACH.rulesOpen(),
    steps: [
      { title: "One shared pot", text: "Every roll adds to this pot. Bank it to put it on your score.", target: ".potbox" },
      { title: "Roll", text: "You go first. Tap Roll.", target: "[data-act=roll]", until: () => S() && S().roll >= 1 },
      { title: "A safe 7", text: "In the first 3 rolls a 7 is worth 70, not a disaster.", target: ".potbox" },
      { title: "The dice go round", text: "Each roll is the next player's. Tap Roll for them until roll 3 is done.", target: "[data-act=roll]", until: () => S() && S().roll >= 3 },
      { title: "Danger from now on", text: "From roll 4, a 7 ends the round and everyone still in loses the pot.", target: "#phase" },
      { title: "Roll 4", text: "Roll once more.", target: "[data-act=roll]", until: () => S() && S().roll >= 4 },
      { title: "Doubles!", text: "From roll 4 doubles double the pot. Bank it now!", target: "[data-act=bank]", until: () => S() && (S().banked[0] || S().round > 1) },
      { title: "You're out this round", text: "The others keep rolling. Watch what a 7 does to them.", target: "#seats", until: () => S() && S().round > 1 },
      { title: "Scores", text: "Each round lands in the score table. Highest total after the last round wins.", target: () => document.querySelector("#side .scores") && innerWidth >= 900 ? "#side" : "[data-tab=scores]" },
      { title: "That's it", text: "Bank any time, even on someone else's roll. Good luck!", target: "#actions" },
    ],
  });
  return _tour;
}

// ------------------------------------------------------------------ sheets + toasts
let sheetHandler = null;
function sheet(html, onAct) {
  closeSheet();
  const back = document.createElement("div");
  back.className = "sheet-back";
  back.innerHTML = `<div class="sheet" role="dialog">${html}</div>`;
  back.addEventListener("click", (e) => {
    if (e.target === back) { closeSheet(); return; }
    const b = e.target.closest("[data-act]"); if (b && onAct) { const a = b.dataset.act; closeSheet(); onAct(a, b); }
  });
  document.body.appendChild(back);
  sheetHandler = onAct;
}
function closeSheet() { document.querySelectorAll(".sheet-back").forEach((e) => e.remove()); sheetHandler = null; }
let toastT = null;
function toast(text) {
  document.querySelectorAll(".toast").forEach((e) => e.remove());
  const t = document.createElement("div"); t.className = "toast"; t.textContent = text; document.body.appendChild(t);
  clearTimeout(toastT); toastT = setTimeout(() => t.remove(), 2600);
}
const QS = {
  levels: "Measured in thousands of computer games: Medium beats Easy, and Hard beats Medium (clearly with 2 to 4 players, narrowly with more). Your rating moves with each game.",
  early: "The rulebook lets anyone bank at any time. The old AI trainer blocked banking until 3 rolls were in. Takes effect next game.",
  dice: "Real dice: roll your own dice at the table and tap in what came up. The app keeps the pot and the scores. Undo takes back a mis-tap.",
  awake: "Stops the phone going dark while it sits on the table keeping score. Uses a little more battery.",
};

// ------------------------------------------------------------------ real dice: tap in what was rolled
function pickDice() {
  if (!G || busy) return;
  const s = G.s, pick = [0, 0];
  const row = (r) => `<div class="pick-row" role="group" aria-label="Die ${r + 1}">${[1, 2, 3, 4, 5, 6].map((v) => `<button class="pick" data-r="${r}" data-v="${v}" aria-label="${v}"><span class="pd"></span></button>`).join("")}</div>`;
  sheet(`<h3>${esc(s.names[s.roller])} rolled</h3><p class="muted">Tap both dice.</p>${row(0)}${row(1)}
    <div class="row"><button class="btn grow" data-act="cancel">Cancel</button></div>`, () => {});
  const sh = $(".sheet");
  sh.querySelectorAll(".pick").forEach((b) => TABLE.die(b.querySelector(".pd"), +b.dataset.v));
  sh.addEventListener("click", (e) => {
    const b = e.target.closest(".pick"); if (!b) return;
    const r = +b.dataset.r; pick[r] = +b.dataset.v;
    sh.querySelectorAll(`.pick[data-r="${r}"]`).forEach((x) => x.setAttribute("aria-pressed", x === b));
    if (pick[0] && pick[1]) {
      const q = pick.map((v) => (v - 0.5) / 6);
      closeSheet();
      localAct(G.s.roller, { t: "roll" }, () => (q.length ? q.shift() : Math.random()));
    }
  });
}
function pop(btn, text) {
  document.querySelectorAll(".pop").forEach((e) => e.remove());
  const p = document.createElement("div"); p.className = "pop"; p.textContent = text; document.body.appendChild(p);
  const r = btn.getBoundingClientRect();
  p.style.left = Math.max(12, Math.min(innerWidth - p.offsetWidth - 12, r.left - 20)) + "px";
  p.style.top = (r.bottom + 8 + p.offsetHeight > innerHeight ? r.top - p.offsetHeight - 8 : r.bottom + 8) + "px";
  setTimeout(() => document.addEventListener("click", () => p.remove(), { once: true }), 0);
}

// ------------------------------------------------------------------ online (on since 2026-10-27, Tim's go; cost in docs/online.md)
const ONLINE_ON = true;
function onlineSetupHTML() {
  if (!ONLINE_ON) return `<div class="panel off"><b>Online rooms are coming.</b><p class="muted">Built, switched off for now to stay inside the free plan.</p></div>`;
  const code = (new URLSearchParams(location.search).get("room") || "").toUpperCase();
  return `<div class="panel online">
    <input class="txt" id="oname" maxlength="14" placeholder="Your name" value="${esc((Profile && Profile.name) || "")}">
    <div class="row"><button class="btn primary grow" data-act="create">New room</button></div>
    <div class="row"><input class="txt code" id="ocode" maxlength="5" placeholder="CODE" value="${esc(code)}"><button class="btn" data-act="join">Join</button></div>
  </div>`;
}
function wireOnlineSetup() { /* handled by the delegated click handler */ }
async function getOnline() {
  if (online) return online;
  const mod = await import("./online.js?v=a3d0418b");
  online = mod.createOnline({ game, gameId: "bank", botDelayMs: 1500 });
  online.on("change", onSnap);
  online.on("error", (m) => toast(m));
  return online;
}
async function createRoom() {
  const name = ($("#oname").value || "Host").trim();
  const o = await getOnline();
  const seats = ["human"].concat(Array(Math.max(1, settings.computers)).fill("empty"));
  const r = await o.createRoom({ name, seats, options: { rounds: settings.rounds, early: settings.early, level: settings.level } });
  if (!r.ok) toast(r.message);
}
async function joinRoom() {
  const name = ($("#oname").value || "Guest").trim(), code = ($("#ocode").value || "").trim().toUpperCase();
  if (code.length !== 5) { toast("Room codes have 5 letters."); return; }
  const o = await getOnline();
  const r = await o.joinRoom(code, name);
  if (!r.ok) toast(r.message);
}
function onSnap(sn) {
  const prevSnap = snap; snap = sn;
  if (sn.status === "lobby" || sn.status === "joining") { G = null; renderLobby(); return; }
  if (sn.status === "closed" || sn.status === "left" || sn.status === "none") { G = null; online = null; snap = null; toast("The room closed."); renderAll(); return; }
  if (!sn.pub) return;
  const first = !G || G.mode !== "online";
  const prev = G && G.mode === "online" ? G.s : null;
  G = { mode: "online", s: sn.pub, here: sn.mySeat >= 0 ? [sn.mySeat] : [], level: (sn.options || {}).level, gid: sn.code, recorded: G && G.mode === "online" ? G.recorded : false, kind: "online" };
  if (first || !$("#seats")) { buildTable(); if (sn.pub.over) finish(); return; }
  if (prev && (prev.rid !== sn.pub.rid || prev.scores.join() !== sn.pub.scores.join() || prev.round !== sn.pub.round)) present(prev, sn.pub);
  else renderTable();
}
function renderLobby() {
  const v = $("#v-play"), sn = snap;
  if (sn.status === "joining") { v.innerHTML = `<div class="setup"><p class="muted">${sn.askingHost ? "Waiting for the host to let you in…" : "Joining…"}</p></div>`; return; }
  v.innerHTML = `<div class="setup lobby">
    <div class="label">Room code</div><div class="code-big">${esc(sn.code)}</div>
    <div class="row"><button class="btn small" data-act="share">Share link</button></div>
    <ul class="lobby-seats">${sn.seats.map((st, i) => `<li><span class="dot" style="--c:${COLORS[i]}"></span><span class="grow">${st.kind === "empty" ? '<i class="muted">Open seat</i>' : esc(st.name || "Computer")}${st.isHost ? ' <small class="muted">host</small>' : ""}</span>${sn.isHost && i !== sn.mySeat ? `<button class="btn small" data-act="seat" data-i="${i}" data-k="${st.kind === "computer" ? "empty" : "computer"}">${st.kind === "computer" ? "Open" : "Computer"}</button>` : ""}</li>`).join("")}</ul>
    ${sn.isHost ? `<button class="btn primary big" data-act="ostart">Start game<span class="sub">open seats become computers</span></button>` : `<p class="muted">Waiting for the host to start.</p>`}
    <button class="btn small ghost" data-act="quit">Leave</button>
  </div>`;
}

// ------------------------------------------------------------------ tabs + events
function setTab(t) {
  tab = t;
  document.querySelectorAll("#tabs [data-tab]").forEach((b) => b.classList.toggle("on", b.dataset.tab === t));
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("on", v.id === "v-" + t));
  if (t === "scores") renderScores();
  if (t === "settings") renderSettings();
  if (t === "play") renderPlay();
  if (COACH) COACH.update();
}
function renderPlay() {
  if (G) { if (!$("#seats")) buildTable(); else renderTable(); }
  else if (snap && (snap.status === "lobby" || snap.status === "joining")) renderLobby();
  else showSetup();
}
function renderAll() { setTab(tab); }

document.addEventListener("click", (e) => {
  const t = e.target;
  const tb = t.closest("#tabs [data-tab]"); if (tb) { setTab(tb.dataset.tab); return; }
  const q = t.closest("[data-q]"); if (q) { e.stopPropagation(); pop(q, QS[q.dataset.q]); return; }
  if (t.closest(".sheet-back")) return;
  const b = t.closest("button, a"); if (!b) return;
  if (b.dataset.mode) { readNames(); settings.mode = b.dataset.mode; if (settings.mode === "computer" && settings.computers < 1) settings.computers = 1; saveSettings(); showSetup(); return; }
  if (b.dataset.level) { readNames(); settings.level = b.dataset.level; saveSettings(); showSetup(); return; }
  if (b.dataset.rounds) { readNames(); settings.rounds = +b.dataset.rounds; saveSettings(); showSetup(); return; }
  if (b.dataset.dice) { readNames(); settings.dice = b.dataset.dice; saveSettings(); showSetup(); return; }
  if (b.dataset.step) { readNames(); settings[b.dataset.step] += +b.dataset.d; saveSettings(); showSetup(); return; }
  if (b.dataset.pace) { settings.pace = b.dataset.pace; saveSettings(); renderSettings(); schedule(); return; }
  if (b.dataset.speed2) { settings.speed = b.dataset.speed2; saveSettings(); renderSettings(); return; }
  const a = b.dataset.act; if (!a) return;
  if (a === "start") startFromSetup();
  else if (a === "rules") openRules();
  else if (a === "tutorial") startTutorial();
  else if (a === "daily") startDaily();
  else if (a === "stats") Profile && Profile.openPanel();
  else if (a === "quit") quitGame();
  else if (a === "results") showResults();
  else if (a === "roll") { if (G.mode === "online") onlineAct({ t: "roll" }); else if (G.real) pickDice(); else localAct(G.s.roller, { t: "roll" }); }
  else if (a === "bank") { const seat = +b.dataset.seat; if (G.mode === "online") onlineAct({ t: "bank", rid: G.s.rid }); else localAct(seat, { t: "bank", rid: G.s.rid }); }
  else if (a === "skip") skipRound();
  else if (a === "undo") undoMove();
  else if (a === "create") createRoom();
  else if (a === "join") joinRoom();
  else if (a === "ostart") online && online.start();
  else if (a === "seat") online && online.setSeat(+b.dataset.i, b.dataset.k);
  else if (a === "share") shareRoom();
});
document.addEventListener("change", (e) => {
  const k = e.target.dataset && e.target.dataset.set;
  if (k === "late") { settings.early = !e.target.checked; saveSettings(); }
  if (k === "awake") { settings.awake = e.target.checked; saveSettings(); keepAwake(); }
});
async function onlineAct(action) {
  if (!online) return;
  const r = await online.act(action);
  if (!r.ok && !r.stale) toast(r.message);
}
function shareRoom() {
  const url = location.origin + location.pathname + "?online=1&room=" + snap.code;
  if (navigator.share) navigator.share({ title: "Bank", text: "Join my Bank game: " + snap.code, url }).catch(() => {});
  else { try { navigator.clipboard.writeText(url); toast("Link copied"); } catch (e) { toast(url); } }
}
/** Real-dice mode: take back the last roll or bank (a mis-tapped die). */
function undoMove() {
  if (!G || G.mode !== "local" || !G.real || busy || !G.undo || !G.undo.length) return;
  clearTimeout(timer);
  G.s = G.undo.pop(); finishedShown = null; saveGame();
  closeSheet(); buildTable(); msg("Took back the last move."); schedule();
}

// ------------------------------------------------------------------ keep the screen on (a phone left on the table keeping score)
let wakeLock = null;
async function keepAwake() {
  const want = settings.awake && document.visibilityState === "visible";
  try {
    if (want && !wakeLock && navigator.wakeLock) { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => { wakeLock = null; }); }
    else if (!want && wakeLock) { const w = wakeLock; wakeLock = null; await w.release(); }
  } catch (e) { wakeLock = null; /* refused (low power, old iOS): the phone just sleeps as usual */ }
}
document.addEventListener("visibilitychange", keepAwake);

/** Everyone here has banked: play the rest of the round at once. */
async function skipRound() {
  if (!G || G.mode !== "local" || busy) return;
  clearTimeout(timer);
  const r0 = G.s.round;
  let s = G.s;
  const prev = s;
  while (!s.over && s.round === r0) s = apply(clone(s), s.roller, { t: "roll" }, rng);
  G.s = s; saveGame();
  msg(s.hist[s.hist.length - 1].bust ? `A 7 ended round ${r0}.` : `Everyone banked in round ${r0}.`, s.hist[s.hist.length - 1].bust ? "bad" : "");
  buildTable();
  schedule();
  void prev;
}
document.addEventListener("keydown", (e) => {
  if (!G || e.target.closest("input")) return;
  if (e.key === "b" || e.key === "B") { const b = $("[data-act=bank]:not(:disabled)"); if (b) b.click(); }
  if (e.key === " " || e.key === "r" || e.key === "Enter") { const b = $("[data-act=roll]:not(:disabled), [data-act=skip]:not(:disabled)"); if (b) { e.preventDefault(); b.click(); } }
});

// ------------------------------------------------------------------ boot
function boot() {
  if (FX) FX.init({ game: "bank", accent: "#f0b354" });
  if (Profile) {
    Profile.init({
      game: "bank",
      levels: [{ id: "easy", name: "Easy", rating: 1115 }, { id: "medium", name: "Medium", rating: 1200 }, { id: "hard", name: "Hard", rating: 1255 }],
      modes: { friends: { name: "Pass & play" }, online: { name: "Online" } },
      achievements: [
        { id: "first-win", title: "First win", desc: "Win a game of Bank", test: (c) => c.stats.wins >= 1 },
        { id: "big-bank", title: "Big bank", desc: "Bank 500 or more in one go", test: (c) => !!c.last && c.last.extra.maxBank >= 500 },
        { id: "huge-bank", title: "Vault", desc: "Bank 1,000 or more in one go", test: (c) => !!c.last && c.last.extra.maxBank >= 1000 },
        { id: "beat-hard", title: "Beat Hard", desc: "Win against Hard computers", test: (c) => !!c.last && !!c.last.extra.wonHard },
        { id: "full-table", title: "Full table", desc: "Win at an 8-player table", test: (c) => !!c.last && c.last.won && c.last.extra.players >= 8 },
        { id: "ten-wins", title: "Regular", desc: "Win 10 games", test: (c) => c.stats.wins >= 10 },
        { id: "daily", title: "Daily dice", desc: "Play a Daily game", test: (c) => !!c.last && c.last.daily },
      ],
      daily: { title: "Daily game", onPlay: () => { Profile.closePanel(); startDaily(); } },
    });
  }
  const saved = store.get("bank:game", null);
  if (saved && saved.s && !saved.s.over) {
    G = Object.assign({ mode: "local" }, saved);
    rng = Math.random;
    tab = "play"; buildTable(); setTab("play"); schedule();
    if (G.tutorial) { try { tour().resume(); } catch (e) { /* ignore */ } }
  } else {
    store.del("bank:game");
    setTab("play");
  }
  if (ONLINE_ON) getOnline().then((o) => o.resume()).catch(() => {});
  keepAwake();
  // "online" is the room controller, made at start-up to resume a room; only a room snapshot means "in a room"
  if (window.PWA) PWA.safeToReload = () => !snap && !document.querySelector(".sheet-back") && !busy && (!G || G.s.over);
  window.BankApp = { get G() { return G; }, settings, localAct, get busy() { return busy; } };
}
boot();
