// ------------------------------------------------------------------ the generative machine (firmware/src/gen.c)
// Its settings go to the firmware by id (gen.c GP_*, GP_TRK + 24 x track + GK_*); its state comes back in the
// frames (felucca_web.c web_gen_info), all its settings when they change at once (genAll: power-on, Randomize,
// Defaults), its MIDI OUT as it happens (web_midi_out).
const GP = { ON: 0, ROOT: 1, SCALE: 2, UMASK: 3, SRC: 4, PRESET: 5, PLEN: 6, RATE: 7, MUT: 8, COMBINE: 9, BPM: 10, PLAY: 11, REGEN: 12, MACRO: 13, DRIFT: 14, SWING: 15, RANDOM: 16, DEFAULTS: 17, SAVE: 18, LOAD: 19, BOOT: 20, CLEAR: 21, SLOTS: 22, PENDING: 23 };
const GK = { MULT: 0, LOCK: 1, FREEZE: 2, OUT: 3, MODE: 4, RHY: 5, DENS: 6, OCT: 7, LEAP: 8, REST: 9, PATCH: 10, MUTE: 11, LEN: 12, DMSRC: 13, DMRATE: 14, DMDEPTH: 15, WEIGHT: 16, CHANCE: 17, DRIFT: 18, SWING: 19 };
const gtk = (t, k) => 32 + t * 24 + k;
const gset = (id, v) => send({ type: "gen", id, v: v | 0 });
const $ = (id) => document.getElementById(id);
const NOTE = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const SCALES = [["Chromatic", 0xFFF], ["Major", 0xAB5], ["Natural minor", 0x5AD], ["Dorian", 0x6AD], ["Mixolydian", 0x6B5],
  ["Major pentatonic", 0x295], ["Minor pentatonic", 0x4A9], ["Harmonic minor", 0x9AD], ["Phrygian", 0x5AB], ["Lydian", 0xAD5],
  ["Locrian", 0x56B], ["Melodic minor", 0xAAD], ["Blues", 0x4E9], ["Whole tone", 0x555], ["Diminished (half-whole)", 0x6DB],
  ["Diminished (whole-half)", 0xB6D], ["Custom", 0]];
const SOURCES = ["Fixed", "Random walk", "Weighted rules", "Functional harmony", "Circle of fifths", "Voice-leading", "Pendulum", "Pedal (drone bass)"];
const PRESETS = ["I – V – vi – IV", "ii – V – I – I", "vi – IV – I – V", "I – vi – IV – V", "i – VII – VI – VII", "I – IV – I – V"];
const RATES = ["½ bar", "1 bar", "2 bars", "3 bars", "4 bars", "5 bars", "6 bars", "7 bars", "8 bars", "12 bars", "16 bars", "24 bars", "32 bars"];
const MULTS = ["×¼", "×½", "×1", "×2", "×3", "×4", "×8"];
const PATCHES = ["Tine EP", "Bell", "FM Bass", "Brass", "Pad", "Marimba", "Organ", "Pluck"];
const OUTS = ["Synth + MIDI", "Synth only", "MIDI only"];
const TRACKS = [
  { name: "Dyad A", short: "A", modes: ["3rds", "5ths", "6ths", "Auto (voice-led)"], rhythms: true,
    d: { patch: 0, mult: 2, lock: 0, mode: 0, rhy: 0, dens: 50, oct: 0, weight: 60, chance: 100 } },
  { name: "Dyad B", short: "B", modes: ["3rds", "5ths", "6ths", "Auto (voice-led)"], rhythms: true,
    d: { patch: 4, mult: 3, lock: 0, mode: 3, rhy: 1, dens: 40, oct: 0, weight: 80, chance: 100 } },
  { name: "Bass", short: "Bs", modes: ["Root", "Root and 5th", "Walking", "Octaves"],
    d: { patch: 2, mult: 2, lock: 1, mode: 1, dens: 45, oct: 0, weight: 40, chance: 100 } },
  { name: "Melody", short: "M", modes: ["Chord tones", "Scale", "Passing tones"], melody: true,
    d: { patch: 7, mult: 2, lock: 0, mode: 2, dens: 45, oct: 0, leap: 25, rest: 20, weight: 100, chance: 100 } },
];
const RHYTHMS = ["Sustain", "Pulse", "Arpeggio", "Euclidean"];
const DMSHAPES = ["Off", "Sine", "Triangle", "Ramp up", "Ramp down", "Square", "Random", "Drift"];
const DMRATES = ["¼ bar", "½ bar", "1 bar", "2 bars", "4 bars", "8 bars", "16 bars", "32 bars"];
let genOn = false, genPlaying = false, genState = null, umask = 0xAB5, rootNow = 0;

const opts = (sel, list, val) => { sel.innerHTML = list.map((n, i) => `<option value="${i}">${n}</option>`).join(""); sel.value = String(val); };
opts($("g-root"), NOTE, 0);
opts($("g-scale"), SCALES.map((s) => s[0]), 1);
opts($("g-src"), SOURCES, 2);
opts($("g-preset"), PRESETS, 0);
opts($("g-plen"), [2, 3, 4, 5, 6, 7, 8].map((n) => `${n} chords`), 2);
opts($("g-rate"), RATES, 1);
const bindSel = (id, gp, after) => $(id).addEventListener("change", (e) => { gset(gp, +e.target.value); if (after) after(); });
bindSel("g-root", GP.ROOT, () => { rootNow = +$("g-root").value; drawUmask(); });
bindSel("g-scale", GP.SCALE, () => { $("g-umask-row").hidden = +$("g-scale").value !== 16; });
bindSel("g-src", GP.SRC, showPreset);
bindSel("g-preset", GP.PRESET);
$("g-plen").addEventListener("change", (e) => gset(GP.PLEN, +e.target.value + 2));
bindSel("g-rate", GP.RATE);
bindSel("g-combine", GP.COMBINE);
$("g-bpm").addEventListener("change", (e) => { const v = Math.min(240, Math.max(40, +e.target.value || 120)); e.target.value = v; gset(GP.BPM, v); });
$("g-mut").addEventListener("input", (e) => { $("g-mut-o").textContent = e.target.value; gset(GP.MUT, +e.target.value); });
$("g-regen").addEventListener("click", () => gset(GP.REGEN, 1));
for (const [k, gp] of [["g-drift", GP.DRIFT], ["g-swing", GP.SWING]])
  $(k).addEventListener("input", (e) => { $(k + "-o").textContent = e.target.value; gset(gp, +e.target.value); });
$("g-macro").addEventListener("input", (e) => { $("g-macro-o").textContent = e.target.value; gset(GP.MACRO, +e.target.value); });
$("g-macro").addEventListener("dblclick", (e) => { e.target.value = 0; $("g-macro-o").textContent = 0; gset(GP.MACRO, 0); });
function showPreset() { const s = +$("g-src").value; $("g-preset-l").hidden = !(s === 0 || s === 6); }
showPreset();

function drawUmask() {
  const box = $("g-umask");
  box.innerHTML = "";
  for (let i = 0; i < 12; i++) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = NOTE[(rootNow + i) % 12];
    b.setAttribute("aria-pressed", String(!!(umask >> i & 1)));
    if (i === 0) { b.className = "root"; b.title = "The key's root is always in"; }
    b.addEventListener("click", () => {
      if (i === 0) return;
      umask ^= 1 << i;
      drawUmask();
      gset(GP.UMASK, umask);
    });
    box.appendChild(b);
  }
}
drawUmask();

// the four track cards
const cards = TRACKS.map((T, t) => {
  const c = document.createElement("article");
  c.className = "trk";
  c.style.setProperty("--c", `var(--tk${t})`);
  const id = (k) => `t${t}-${k}`;
  c.innerHTML = `
    <header><h3>${T.name}<small>Ch ${t + 1}</small></h3><span class="cur" id="${id("cur")}">–</span></header>
    <div class="steps" id="${id("steps")}">${"<span></span>".repeat(16)}</div>
    <div class="grid2">
      <label>Sound <select id="${id("patch")}"></select></label>
      <label>${T.melody ? "Note pool" : T.rhythms ? "Interval" : "Pattern"} <select id="${id("mode")}"></select></label>
      ${T.rhythms ? `<label>Rhythm <select id="${id("rhy")}"></select></label>` : ""}
      <label>Length <select id="${id("len")}"></select></label>
      <label>Chord rate <select id="${id("mult")}"></select></label>
      <label>Octave <select id="${id("oct")}"><option value="-2">−2</option><option value="-1">−1</option><option value="0">0</option><option value="1">+1</option><option value="2">+2</option></select></label>
      <label>Output <select id="${id("out")}"></select></label>
    </div>
    <label class="wide">Density <input type="range" id="${id("dens")}" min="0" max="100"> <output id="${id("dens-o")}"></output></label>
    <div class="dmod">
      <div class="grid2">
        <label>Density mod <select id="${id("dmsrc")}"></select></label>
        <label>Mod rate <select id="${id("dmrate")}"></select></label>
      </div>
      <label class="wide">Mod depth <input type="range" id="${id("dmdepth")}" min="-100" max="100" value="0"> <output id="${id("dmdepth-o")}">0</output></label>
      <label class="wide">Macro weight <input type="range" id="${id("weight")}" min="-100" max="100"> <output id="${id("weight-o")}"></output></label>
      <div class="meter" aria-label="Density now"><span id="${id("dnow")}"></span><em id="${id("dnow-o")}">–</em></div>
    </div>
    ${T.melody ? `<label class="wide">Leaps <input type="range" id="${id("leap")}" min="0" max="100"> <output id="${id("leap-o")}"></output></label>
    <label class="wide">Rests <input type="range" id="${id("rest")}" min="0" max="100"> <output id="${id("rest-o")}"></output></label>` : ""}
    <label class="wide">Chance <input type="range" id="${id("chance")}" min="1" max="100"> <output id="${id("chance-o")}"></output></label>
    <div class="grid2">
      <label class="wide">Drift <input type="range" id="${id("drift")}" min="0" max="100" value="0"> <output id="${id("drift-o")}">0</output></label>
      <label class="wide">Swing <input type="range" id="${id("swing")}" min="0" max="100" value="0"> <output id="${id("swing-o")}">0</output></label>
    </div>
    <div class="checks">
      <label class="check"><input type="checkbox" id="${id("lock")}"> Harmony lock</label>
      <label class="check"><input type="checkbox" id="${id("freeze")}"> Freeze</label>
      <label class="check"><input type="checkbox" id="${id("mute")}"> Mute</label>
    </div>`;
  $("g-tracks").appendChild(c);
  const q = (k) => c.querySelector("#" + id(k));
  opts(q("patch"), PATCHES, T.d.patch);
  opts(q("mode"), T.modes, T.d.mode);
  if (T.rhythms) opts(q("rhy"), RHYTHMS, T.d.rhy);
  opts(q("mult"), MULTS, T.d.mult);
  opts(q("dmsrc"), DMSHAPES, 0);
  opts(q("dmrate"), DMRATES, 3);
  const dmOn = () => { const on = +q("dmsrc").value > 0; q("dmrate").disabled = !on; q("dmdepth").disabled = !on; };
  q("dmsrc").addEventListener("change", (e) => { gset(gtk(t, GK.DMSRC), +e.target.value); dmOn(); });
  q("dmrate").addEventListener("change", (e) => gset(gtk(t, GK.DMRATE), +e.target.value));
  q("dmdepth").addEventListener("input", (e) => { q("dmdepth-o").textContent = e.target.value; gset(gtk(t, GK.DMDEPTH), +e.target.value); });
  dmOn();
  opts(q("len"), Array.from({ length: 16 }, (_, i) => `${i + 1} step${i ? "s" : ""}`), 15);
  const stepsEl = q("steps");
  q("len").addEventListener("change", (e) => {
    const n = +e.target.value + 1;
    gset(gtk(t, GK.LEN), n);
    [...stepsEl.children].forEach((x, i) => { x.hidden = i >= n; });
    stepsEl.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
  });
  opts(q("out"), OUTS, 0);
  q("oct").value = "0";
  q("lock").checked = !!T.d.lock;
  q("mult").disabled = !!T.d.lock;
  const sel = (k, gk, after) => q(k).addEventListener("change", (e) => { gset(gtk(t, gk), +e.target.value); if (after) after(e); });
  sel("patch", GK.PATCH); sel("mode", GK.MODE); sel("mult", GK.MULT); sel("oct", GK.OCT); sel("out", GK.OUT);
  if (T.rhythms) sel("rhy", GK.RHY);
  const range = (k, gk) => {
    const r = q(k), o = q(k + "-o");
    r.value = T.d[k];
    o.textContent = T.d[k];
    r.addEventListener("input", () => { o.textContent = r.value; gset(gtk(t, gk), +r.value); });
  };
  range("dens", GK.DENS);
  range("weight", GK.WEIGHT);
  range("chance", GK.CHANCE);
  for (const [k, gk] of [["drift", GK.DRIFT], ["swing", GK.SWING]])
    q(k).addEventListener("input", (e) => { q(k + "-o").textContent = e.target.value; gset(gtk(t, gk), +e.target.value); });
  q("chance-o").textContent += " %";
  q("chance").addEventListener("input", () => { q("chance-o").textContent = q("chance").value + " %"; });
  if (T.melody) { range("leap", GK.LEAP); range("rest", GK.REST); }
  q("lock").addEventListener("change", (e) => { gset(gtk(t, GK.LOCK), e.target.checked ? 1 : 0); q("mult").disabled = e.target.checked; });
  q("freeze").addEventListener("change", (e) => { gset(gtk(t, GK.FREEZE), e.target.checked ? 1 : 0); c.classList.toggle("frozen", e.target.checked); });
  q("mute").addEventListener("change", (e) => gset(gtk(t, GK.MUTE), e.target.checked ? 1 : 0));
  // the card shows the firmware's settings (power-on, Randomize, Defaults): sync(get), get(GK_*) -> value
  const sync = (g) => {
    q("patch").value = g(GK.PATCH); q("mode").value = g(GK.MODE); if (T.rhythms) q("rhy").value = g(GK.RHY);
    q("mult").value = g(GK.MULT); q("oct").value = g(GK.OCT); q("out").value = g(GK.OUT);
    const n = g(GK.LEN);
    q("len").value = n - 1;
    [...stepsEl.children].forEach((x, i) => { x.hidden = i >= n; });
    stepsEl.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    q("dmsrc").value = g(GK.DMSRC); q("dmrate").value = g(GK.DMRATE); dmOn();
    const ranges = [["dens", GK.DENS], ["dmdepth", GK.DMDEPTH], ["weight", GK.WEIGHT], ["drift", GK.DRIFT], ["swing", GK.SWING]]
      .concat(T.melody ? [["leap", GK.LEAP], ["rest", GK.REST]] : []);
    for (const [k, gk] of ranges) { q(k).value = g(gk); q(k + "-o").textContent = g(gk); }
    q("chance").value = g(GK.CHANCE); q("chance-o").textContent = g(GK.CHANCE) + " %";
    q("lock").checked = !!g(GK.LOCK); q("mult").disabled = !!g(GK.LOCK);
    q("freeze").checked = !!g(GK.FREEZE); c.classList.toggle("frozen", !!g(GK.FREEZE));
    q("mute").checked = !!g(GK.MUTE);
  };
  return { sync, el: c, cur: q("cur"), steps: [...q("steps").children], lastStep: -1, dnow: q("dnow"), dnowO: q("dnow-o") };
});

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
// chord names from the scale: degree d's triad
function pcsOf(mask) { const p = []; for (let i = 0; i < 12; i++) if (mask >> i & 1) p.push(i); return p.length ? p : [0]; }
function chordOf(d, root, mask) {
  const p = pcsOf(mask), n = p.length, at = (x) => p[((x % n) + n) % n] + 12 * Math.floor(x / n);
  const r = at(d), a = at(d + 2) - r, b = at(d + 4) - r;
  // the stacked tones' shape -> its name (pentatonic and other scales stack into 6ths, 7ths and suspensions); a shape
  // with no name shows its three notes
  const SHAPES = { "4,7": ["", true], "3,7": ["m", false], "3,6": ["dim", false], "4,8": ["aug", true], "5,7": ["sus4", true],
    "2,7": ["sus2", true], "4,9": ["6", true], "3,9": ["m6", false], "4,10": ["7", true], "3,10": ["m7", false], "4,11": ["maj7", true],
    "5,10": ["7sus4", true], "2,10": ["7sus2", true], "5,9": ["6sus4", true], "2,9": ["6sus2", true], "3,8": ["m♭6", false],
    "4,6": ["♭5", true], "2,6": ["sus2♭5", true], "1,7": ["sus♭2", false], "1,5": ["(♭2 4)", false], "5,8": ["sus4♭6", true] };
  let q = SHAPES[a + "," + b];
  if (!q) return { name: [r, r + a, r + b].map((x) => NOTE[(root + x) % 12]).join(" "), roman: ROMAN[((d % n) + n) % n] || "?" };
  let rn = ROMAN[((d % n) + n) % n] || "?";
  if (!q[1]) rn = rn.toLowerCase();
  if (q[0] === "dim") rn += "°";
  if (q[0] === "aug") rn += "+";
  return { name: NOTE[(root + r) % 12] + q[0], roman: rn };
}

function drawGen(g) {
  const s = { on: g[0], playing: g[1], root: g[2], scale: g[3], llen: g[5], curM: g[6], curT: [g[7], g[8], g[9], g[10]],
              mask: g[11] | g[12] << 8, step: [g[13], g[14], g[15], g[16]], loop: [...g.slice(17, 17 + g[5])] };
  genState = s;
  if (g.length > 41) {
    const was = savePending;
    slotsUsed = g[39];
    bootMode = g[40];
    savePending = g[41];
    if (was && !savePending && storeMsg && !/Stored\./.test(storeMsg)) storeMsg += " Stored.";
    drawSlots();
  }
  if (g.length > 37 && document.activeElement !== $("g-macro")) { $("g-macro").value = g[37] - 100; $("g-macro-o").textContent = g[37] - 100; }
  genOn = !!s.on;
  genPlaying = !!s.playing;
  $("gen-on").setAttribute("aria-pressed", String(genOn));
  $("gen-on").textContent = genOn ? "On" : "Off";
  $("gen-play").setAttribute("aria-pressed", String(genPlaying));
  $("gen-play").textContent = genPlaying ? "Stop" : "Play";
  $("g-keyname").textContent = `${NOTE[s.root]} ${SCALES[Math.min(s.scale, 16)][0].toLowerCase()}`;
  const chips = s.loop.map((d, i) => {
    const c = chordOf(d, s.root, s.mask), who = s.curT.map((x, t) => (x === i ? `<span style="background:var(--tk${t})" title="${TRACKS[t].name}"></span>` : "")).join("");
    return `<div class="chip${i === s.curM && genPlaying ? " master" : ""}"><b>${c.name}</b><i>${c.roman}</i><div class="who">${genPlaying ? who : ""}</div></div>`;
  });
  $("g-loop").innerHTML = chips.join("");
  $("g-tracks-now").innerHTML = genPlaying
    ? `<span>Master: <b>${chordOf(s.loop[s.curM] ?? 0, s.root, s.mask).name}</b></span>` +
      TRACKS.map((T, t) => `<span>${T.name}: <b>${chordOf(s.loop[s.curT[t]] ?? 0, s.root, s.mask).name}</b></span>`).join("")
    : `<span>${genOn ? "Press Play to hear it. The ring marks the master chord; dots show where each track is." : "Turn the generator on to set up the four FM tracks."}</span>`;
  cards.forEach((c, t) => {
    c.cur.textContent = genPlaying ? chordOf(s.loop[s.curT[t]] ?? 0, s.root, s.mask).name : "–";
    if (c.lastStep >= 0) c.steps[c.lastStep].classList.remove("on");
    c.lastStep = genPlaying ? s.step[t] % 16 : -1;
    if (c.lastStep >= 0) c.steps[c.lastStep].classList.add("on");
    const dn = g.length > 36 ? g[33 + t] : null;
    c.dnow.style.width = genPlaying && dn !== null ? dn + "%" : "0";
    c.dnowO.textContent = genPlaying && dn !== null ? `density now ${dn}` : "–";
  });
}

// every setting at once, as the firmware has them (worklet.js genAll: {id: value})
function syncGen(a) {
  $("g-root").value = a[GP.ROOT];
  rootNow = a[GP.ROOT];
  $("g-scale").value = a[GP.SCALE];
  $("g-umask-row").hidden = a[GP.SCALE] !== 16;
  umask = a[GP.UMASK];
  drawUmask();
  $("g-src").value = a[GP.SRC];
  $("g-preset").value = a[GP.PRESET];
  showPreset();
  $("g-plen").value = a[GP.PLEN] - 2;
  $("g-rate").value = a[GP.RATE];
  $("g-combine").value = a[GP.COMBINE];
  $("g-bpm").value = a[GP.BPM];
  for (const [id, gp] of [["g-mut", GP.MUT], ["g-drift", GP.DRIFT], ["g-swing", GP.SWING], ["g-macro", GP.MACRO]]) {
    $(id).value = a[gp];
    $(id + "-o").textContent = a[gp];
  }
  cards.forEach((c, t) => c.sync((k) => a[gtk(t, k)]));
}
// ---- setups: 8 slots in the FM-1's memory (written once playback stops), and what power-on does
let slotSel = 1, slotsUsed = 0, bootMode = 0, savePending = 0, storeMsg = "", clearArmed = 0;
const BOOTS = ["New random setup", "Resume last session"].concat([1, 2, 3, 4, 5, 6, 7, 8].map((n) => `Setup ${n}`));
opts($("g-boot"), BOOTS, 0);
for (let n = 1; n <= 8; n++) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = n;
  b.setAttribute("role", "radio");
  b.addEventListener("click", () => { slotSel = n; clearArmed = 0; drawSlots(); });
  $("g-slots").appendChild(b);
}
function drawSlots() {
  [...$("g-slots").children].forEach((b, i) => {
    const n = i + 1, used = !!(slotsUsed >> i & 1);
    b.setAttribute("aria-checked", String(n === slotSel));
    b.classList.toggle("used", used);
    b.classList.toggle("boot", bootMode === n + 1);
    b.setAttribute("aria-label", `Setup ${n}${used ? "" : ", empty"}${bootMode === n + 1 ? ", starts at power-on" : ""}`);
  });
  const used = !!(slotsUsed >> (slotSel - 1) & 1), live = !$("g-save").dataset.off;
  $("g-load").disabled = !live || !used;
  $("g-clear").disabled = !live || !used;
  $("g-clear").textContent = clearArmed ? `Clear ${slotSel}?` : "Clear";
  $("g-clear").classList.toggle("confirm", !!clearArmed);
  [...$("g-boot").options].forEach((o, i) => { o.disabled = i >= 2 && !(slotsUsed >> (i - 2) & 1); });
  if (document.activeElement !== $("g-boot")) $("g-boot").value = String(bootMode);
  $("g-store").textContent = savePending ? (genPlaying ? `${storeMsg} It goes into the FM-1's memory when playback stops.` : `${storeMsg} Storing…`)
                                         : storeMsg;
}
drawSlots();
$("g-save").addEventListener("click", () => {
  gset(GP.SAVE, slotSel);
  storeMsg = (slotsUsed >> (slotSel - 1) & 1) ? `Setup ${slotSel} replaced.` : `Saved as setup ${slotSel}.`;
  savePending = 1;
  clearArmed = 0;
  drawSlots();
});
$("g-load").addEventListener("click", () => { gset(GP.LOAD, slotSel); storeMsg = `Playing setup ${slotSel}.`; clearArmed = 0; drawSlots(); });
$("g-clear").addEventListener("click", () => {
  if (!clearArmed) {                                // a second press within 4 s clears it (no dialog boxes here)
    clearArmed = setTimeout(() => { clearArmed = 0; drawSlots(); }, 4000);
    drawSlots();
    return;
  }
  clearTimeout(clearArmed);
  clearArmed = 0;
  gset(GP.CLEAR, slotSel);
  storeMsg = `Setup ${slotSel} cleared.`;
  savePending = 1;
  drawSlots();
});
$("g-boot").addEventListener("change", (e) => {
  gset(GP.BOOT, +e.target.value);
  storeMsg = `At power-on: ${BOOTS[+e.target.value].toLowerCase()}.`;
  savePending = 1;
  drawSlots();
});

$("gen-random").addEventListener("click", () => gset(GP.RANDOM, Math.floor(Math.random() * 0x7fffffff)));
$("gen-defaults").addEventListener("click", () => gset(GP.DEFAULTS, 1));

// On starts it playing at once; Off stops the transport too (the patterns it wrote stay)
$("gen-on").addEventListener("click", () => {
  if (genOn) { gset(GP.PLAY, 0); gset(GP.ON, 0); }
  else { gset(GP.ON, 1); gset(GP.PLAY, 1); }
});
$("gen-play").addEventListener("click", () => gset(GP.PLAY, genPlaying ? 0 : 1));

// USB MIDI OUT: what each channel holds now, and (where the browser allows Web MIDI) a port to send it to
const held = [new Set(), new Set(), new Set(), new Set()];
let midiOut = null, midiAccess = null;
const noteName = (n) => NOTE[n % 12] + (Math.floor(n / 12) - 1);
function drawMidi() {
  $("g-midi").innerHTML = held.map((h, c) => `<span style="--c:var(--tk${c})"><em>Ch ${c + 1}</em> ${h.size ? [...h].sort((a, b) => a - b).map(noteName).join(" ") : "·"}</span>`).join("");
}
drawMidi();
let midiDirty = false;
function onMidiOut(events) {
  for (const [st, n, v] of events) {
    const ch = st & 15, kind = st & 0xf0;
    if (ch < 4) { if (kind === 0x90 && v) held[ch].add(n); else held[ch].delete(n); }
    if (midiOut) try { midiOut.send([st, n, v]); } catch {}
  }
  if (!midiDirty) { midiDirty = true; requestAnimationFrame(() => { midiDirty = false; drawMidi(); }); }
}
async function genMidiPorts() {
  if (!navigator.requestMIDIAccess) return;
  try {
    midiAccess = await navigator.requestMIDIAccess();
    const fill = () => {
      const sel = $("g-out"), was = sel.value;
      sel.innerHTML = `<option value="">None</option>` + [...midiAccess.outputs.values()].map((o) => `<option value="${o.id}">${o.name}</option>`).join("");
      sel.value = [...sel.options].some((o) => o.value === was) ? was : "";
      $("g-out-l").hidden = midiAccess.outputs.size === 0;
    };
    $("g-out").addEventListener("change", (e) => { midiOut = e.target.value ? midiAccess.outputs.get(e.target.value) : null; });
    midiAccess.addEventListener("statechange", fill);
    fill();
  } catch { /* no Web MIDI here: the notes still show above */ }
}

function genReady() {
  for (const id of ["gen-on", "gen-play", "gen-random", "gen-defaults", "g-save", "g-boot"]) $(id).disabled = false;
  delete $("g-save").dataset.off;
  drawSlots();
  $("gen-hint").textContent = "Each power-on draws a new setup. Press Play here or on the FM-1; Randomize draws another.";
  genMidiPorts();
}
