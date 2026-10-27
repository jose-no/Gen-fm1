// ------------------------------------------------------------------ the generative machine (firmware/src/gen.c)
// Its settings go to the firmware by id (gen.c GP_*, GP_TRK + 16 x track + GK_*); its state comes back in the
// frames (felucca_web.c web_gen_info), its MIDI OUT as it happens (web_midi_out).
const GP = { ON: 0, ROOT: 1, SCALE: 2, UMASK: 3, SRC: 4, PRESET: 5, PLEN: 6, RATE: 7, MUT: 8, COMBINE: 9, BPM: 10, PLAY: 11, REGEN: 12, MACRO: 13, DRIFT: 14, SWING: 15 };
const GK = { MULT: 0, LOCK: 1, FREEZE: 2, OUT: 3, MODE: 4, RHY: 5, DENS: 6, OCT: 7, LEAP: 8, REST: 9, PATCH: 10, MUTE: 11, LEN: 12, DMSRC: 13, DMRATE: 14, DMDEPTH: 15, WEIGHT: 16, CHANCE: 17, DRIFT: 18, SWING: 19 };
const gtk = (t, k) => 16 + t * 24 + k;
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
  return { el: c, cur: q("cur"), steps: [...q("steps").children], lastStep: -1, dnow: q("dnow"), dnowO: q("dnow-o") };
});

// chord names from the scale: degree d's triad
function pcsOf(mask) { const p = []; for (let i = 0; i < 12; i++) if (mask >> i & 1) p.push(i); return p.length ? p : [0]; }
function chordOf(d, root, mask) {
  const p = pcsOf(mask), n = p.length, at = (x) => p[((x % n) + n) % n] + 12 * Math.floor(x / n);
  const r = at(d), a = at(d + 2) - r, b = at(d + 4) - r;
  const q = a === 4 && b === 7 ? ["", true] : a === 3 && b === 7 ? ["m", false] : a === 3 && b === 6 ? ["dim", false]
          : a === 4 && b === 8 ? ["aug", true] : a === 5 && b === 7 ? ["sus4", true] : a === 2 && b === 7 ? ["sus2", true] : ["(" + a + "," + b + ")", true];
  const ROM = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
  let rn = ROM[((d % n) + n) % n] || "?";
  if (!q[1]) rn = rn.toLowerCase();
  if (q[0] === "dim") rn += "°";
  if (q[0] === "aug") rn += "+";
  return { name: NOTE[(root + r) % 12] + q[0], roman: rn };
}

function drawGen(g) {
  const s = { on: g[0], playing: g[1], root: g[2], scale: g[3], llen: g[5], curM: g[6], curT: [g[7], g[8], g[9], g[10]],
              mask: g[11] | g[12] << 8, step: [g[13], g[14], g[15], g[16]], loop: [...g.slice(17, 17 + g[5])] };
  genState = s;
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
  $("gen-on").disabled = false;
  $("gen-play").disabled = false;
  $("gen-hint").textContent = "Press On to start the generator playing. The FM-1 panel works too: SEQ shows the patterns being written.";
  gset(GP.BPM, +$("g-bpm").value);
  genMidiPorts();
}
