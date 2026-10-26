// SPDX-License-Identifier: GPL-3.0-only
// The generative machine (firmware/src/gen.c) in the browser build, in Node:
//   node web/emu/gen_test.mjs build/emu/felucca.wasm
// Checks: switching it on sets up four FM6 tracks; PLAY makes sound; MIDI OUT sends notes on channels 1..4, each
// note-on matched by a note-off; every note is in the key's scale; the bass follows the master chord; a x2 track
// changes chord half as often; FREEZE keeps a pattern; mutation 0 repeats the bar; the same seed gives the same audio.
import fs from "fs";

const bytes = fs.readFileSync(process.argv[2] || "build/emu/felucca.wasm");
let fails = 0;
const check = (what, ok) => { console.log(`gen: ${what.padEnd(80)} ${ok ? "ok" : "FAIL"}`); if (!ok) fails++; };
const GP = { ON: 0, ROOT: 1, SCALE: 2, UMASK: 3, SRC: 4, PRESET: 5, PLEN: 6, RATE: 7, MUT: 8, COMBINE: 9, BPM: 10,
             PLAY: 11, REGEN: 12 };
const GK = { MULT: 0, LOCK: 1, FREEZE: 2, OUT: 3, MODE: 4, RHY: 5, DENS: 6, OCT: 7, LEAP: 8, REST: 9, PATCH: 10, MUTE: 11, LEN: 12 };
const tk = (t, k) => 16 + t * 16 + k;

async function device() {
  const { instance } = await WebAssembly.instantiate(bytes, {});
  const ex = instance.exports, mem = ex.memory;
  ex._initialize();
  ex.web_nor_erase();
  ex.web_boot();
  const d = { ex, mem, peak: 0, midi: [], audio: [] };
  d.render = (ms, keep) => {
    const n = Math.round(ms * 44.1);
    for (let k = 0; k < n; k += 128) {
      const m = Math.min(128, n - k);
      ex.web_render(m);
      const l = new Float32Array(mem.buffer, ex.web_out_l(), m);
      for (let i = 0; i < m; i++) {
        d.peak = Math.max(d.peak, Math.abs(l[i]));
        if (keep) d.audio.push(l[i]);
      }
      for (let p; (p = ex.web_midi_out()) !== 0;) d.midi.push({ st: (p >>> 8) & 255, n: (p >>> 16) & 127, v: p >>> 24, f: d.f });
      d.f = (d.f || 0) + m;
    }
  };
  d.info = () => {
    const b = new Uint8Array(mem.buffer, ex.web_gen_info(), 64);
    return { on: b[0], playing: b[1], root: b[2], llen: b[5], cur_m: b[6], cur_t: [...b.slice(7, 11)],
             mask: b[11] | b[12] << 8, step: [...b.slice(13, 17)], loop: [...b.slice(17, 17 + b[5])].map((x) => (x << 24) >> 24) };
  };
  return d;
}

const a = await device();
a.render(1200);
a.ex.web_gen(GP.BPM, 120);
a.ex.web_gen(GP.ON, 1);
a.render(100);
let i = a.info();
check(`on: a loop of ${i.llen} chords [${i.loop}] in C major (mask ${i.mask.toString(16)})`, i.on === 1 && i.llen === 4 && i.mask === 0xab5);
a.peak = 0;
a.ex.web_gen(GP.PLAY, 1);
const changes = [[], [], [], []];
let last = [-1, -1, -1, -1], lastM = -1, mchanges = 0;
for (let k = 0; k < 16 * 8; k++) {                           // 16 bars at 120 BPM: 2 s a bar, sampled every 1/8 bar
  a.render(250);
  i = a.info();
  for (let t = 0; t < 4; t++) if (i.cur_t[t] !== last[t]) { changes[t].push(k); last[t] = i.cur_t[t]; }
  if (i.cur_m !== lastM) { mchanges++; lastM = i.cur_m; }
}
check(`PLAY: it sounds (peak ${a.peak.toFixed(3)})`, a.peak > 0.02 && a.peak < 1.0);
const ons = a.midi.filter((e) => (e.st & 0xf0) === 0x90), offs = a.midi.filter((e) => (e.st & 0xf0) === 0x80);
const chans = new Set(ons.map((e) => e.st & 15));
check(`MIDI OUT: ${ons.length} note-ons on channels ${[...chans].map((c) => c + 1)}`, ons.length > 50 && chans.size === 4 && [...chans].every((c) => c < 4));
// every note-on ends (per channel, per note), allowing the ones still held now
const held = new Map();
let unmatched = 0;
for (const e of a.midi) {
  const key = (e.st & 15) * 128 + e.n;
  if ((e.st & 0xf0) === 0x90) held.set(key, (held.get(key) || 0) + 1);
  else if (held.get(key)) held.set(key, held.get(key) - 1); else unmatched++;
}
const stillHeld = [...held.values()].reduce((x, y) => x + y, 0);
check(`note-offs: ${offs.length}, none without its note-on, ${stillHeld} held at the end`, unmatched === 0 && stillHeld <= 6);
const MAJ = new Set([0, 2, 4, 5, 7, 9, 11]);
check("every note in C major", ons.every((e) => MAJ.has(e.n % 12)));
const byCh = (c) => ons.filter((e) => (e.st & 15) === c).map((e) => e.n);
const bass = byCh(2), mel = byCh(3), dy = byCh(0);
check(`ranges: bass ${Math.min(...bass)}..${Math.max(...bass)}, dyads ${Math.min(...dy)}..${Math.max(...dy)}, melody ${Math.min(...mel)}..${Math.max(...mel)}`,
      Math.max(...bass) <= 55 && Math.min(...mel) >= 62 && Math.min(...dy) >= 48);
check(`chord changes in 16 bars: master ${mchanges}, A ${changes[0].length}, B (x2) ${changes[1].length}, bass (lock) ${changes[2].length}`,
      changes[1].length < changes[0].length && Math.abs(changes[2].length - mchanges) <= 1);

// FREEZE: track 4's pattern stops changing; MUTATION 0: the other tracks repeat their bar (re-voiced with the chords)
a.ex.web_gen(tk(3, GK.FREEZE), 1);
a.ex.web_gen(GP.MUT, 0);
a.ex.web_gen(GP.RATE, 12);                                   // 32 bars: no chord change while we look
a.render(4000);
a.midi.length = 0;
a.render(4000);
const barA = a.midi.filter((e) => e.st === 0x93 && e.f < a.midi[0].f + 88200).map((e) => e.n).join(",");
const bars = [0, 1].map((b) => a.midi.filter((e) => e.st === 0x93 && e.f >= a.midi[0].f + b * 88200 && e.f < a.midi[0].f + (b + 1) * 88200).map((e) => e.n).join(","));
check(`FREEZE, MUTATION 0: the melody's two bars the same (${bars[0].split(",").length} notes)`, bars[0] === bars[1] && bars[0].length > 0);

// determinism: the same gestures twice, the same audio
async function run() {
  const d = await device();
  d.render(1200);
  d.ex.web_gen(GP.BPM, 120);
  d.ex.web_gen(GP.ON, 1);
  d.ex.web_gen(GP.PLAY, 1);
  d.render(3000, true);
  return d.audio;
}
const [x, y] = [await run(), await run()];
check(`deterministic: two runs, ${x.length} samples the same`, x.length === y.length && x.every((v, k) => v === y[k]));

// every source makes a loop of degrees in range
const b = await device();
b.render(1200);
b.ex.web_gen(GP.ON, 1);
let ok = true;
for (let s = 0; s < 8; s++) {
  b.ex.web_gen(GP.SRC, s);
  for (const n of [2, 4, 8]) {
    b.ex.web_gen(GP.PLEN, n);
    const q = b.info();
    if (q.loop.some((d) => d < 0 || d > 6) || (s !== 6 && q.llen !== n)) ok = false;
  }
}
check("every progression source: loops of 2, 4, 8 chords on the scale's degrees", ok);
// a pentatonic user scale: notes stay in it
b.ex.web_gen(GP.SRC, 1);
b.ex.web_gen(GP.UMASK, 0b001010010101);                      // C D E G A
b.ex.web_gen(GP.SCALE, 16);
b.ex.web_gen(GP.PLAY, 1);
b.render(6000);
const pen = new Set([0, 2, 4, 7, 9]);
const bon = b.midi.filter((e) => (e.st & 0xf0) === 0x90);
check(`user scale C D E G A: ${bon.length} notes, all in it`, bon.length > 10 && bon.every((e) => pen.has(e.n % 12)));

// LEN: each track its own length (polymeter); a frozen 5-step melody repeats every 5 steps; 1 step works
{
  const c = await device();
  c.render(1200);
  c.ex.web_gen(GP.BPM, 120);
  c.ex.web_gen(GP.ON, 1);
  c.ex.web_gen(tk(0, GK.LEN), 1);
  c.ex.web_gen(tk(1, GK.LEN), 12);
  c.ex.web_gen(tk(2, GK.LEN), 7);
  c.ex.web_gen(tk(3, GK.LEN), 5);
  c.ex.web_gen(tk(3, GK.DENS), 90);
  c.ex.web_gen(tk(3, GK.REST), 0);
  c.ex.web_gen(GP.PLAY, 1);
  c.render(4000);
  const on = c.midi.filter((e) => (e.st & 0xf0) === 0x90);
  check(`LEN 1 / 12 / 7 / 5: all four tracks play (${[0, 1, 2, 3].map((ch) => on.filter((e) => (e.st & 15) === ch).length)} notes), all in C major`,
        [0, 1, 2, 3].every((ch) => on.some((e) => (e.st & 15) === ch)) && on.every((e) => MAJ.has(e.n % 12)));
  c.ex.web_gen(GP.MUT, 0);
  c.ex.web_gen(tk(3, GK.FREEZE), 1);
  c.ex.web_gen(GP.RATE, 12);
  c.render(3000);
  c.midi.length = 0;
  c.render(3000);
  const step = 44100 * 60 / 120 / 4, t0 = c.midi[0].f;
  const mel = c.midi.filter((e) => e.st === 0x93);
  const win = (k) => mel.filter((e) => e.f >= t0 + k * 5 * step && e.f < t0 + (k + 1) * 5 * step).map((e) => `${Math.round((e.f - t0 - k * 5 * step) / step)}:${e.n}`).join(",");
  check(`frozen 5-step melody repeats every 5 steps (${win(0)})`, win(0).length > 0 && win(0) === win(1) && win(1) === win(2));
}

console.log(fails ? `gen: ${fails} failed` : "gen: all ok");
process.exit(fails ? 1 : 0);
