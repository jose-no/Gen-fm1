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
             PLAY: 11, REGEN: 12, MACRO: 13, DRIFT: 14, SWING: 15 };
const GK = { MULT: 0, LOCK: 1, FREEZE: 2, OUT: 3, MODE: 4, RHY: 5, DENS: 6, OCT: 7, LEAP: 8, REST: 9, PATCH: 10, MUTE: 11, LEN: 12, DMSRC: 13, DMRATE: 14, DMDEPTH: 15, WEIGHT: 16, CHANCE: 17, DRIFT: 18, SWING: 19 };
const tk = (t, k) => 16 + t * 24 + k;

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

// DENSITY's modulation: a square over 2 bars, depth 100: the melody busy in the first bar, sparse in the second
{
  const e = await device();
  e.render(1200);
  e.ex.web_gen(GP.BPM, 120);
  e.ex.web_gen(GP.ON, 1);
  e.ex.web_gen(tk(3, GK.REST), 0);
  e.ex.web_gen(tk(3, GK.DMSRC), 5);                          // square
  e.ex.web_gen(tk(3, GK.DMRATE), 3);                         // 2 bars
  e.ex.web_gen(tk(3, GK.DMDEPTH), 100);
  e.ex.web_gen(GP.PLAY, 1);
  const seen = new Set();
  for (let k = 0; k < 64; k++) { e.render(250); seen.add(new Uint8Array(e.mem.buffer, e.ex.web_gen_info(), 37)[36]); }
  const bar = 88200, mel = e.midi.filter((x) => x.st === 0x93), first = mel[0] ? mel[0].f : 0;
  let hi = 0, lo = 0;
  for (const x of mel) ((Math.floor((x.f - first + 2000) / bar) % 2) ? lo++ : hi++);
  check(`density square 2 bars, depth 100: ${hi} melody notes in the busy bars, ${lo} in the sparse ones; density read back ${[...seen].sort((a, b) => a - b)}`,
        hi > 3 * lo && seen.has(100) && seen.has(0));
  // every shape keeps density within 0..100 and is the same twice
  let ok = true;
  for (let src = 1; src < 8; src++) {
    e.ex.web_gen(tk(3, GK.DMSRC), src);
    e.ex.web_gen(tk(3, GK.DMRATE), 0);
    for (let k = 0; k < 8; k++) { e.render(60); const d = new Uint8Array(e.mem.buffer, e.ex.web_gen_info(), 37)[36]; if (d > 100) ok = false; }
  }
  check("every modulation shape keeps density within 0..100", ok);
}

// MACRO: every track's density by its weight; MIDI CC 16 turns it; CHANCE thins a frozen pattern's notes
{
  const f = await device();
  f.render(1200);
  f.ex.web_gen(GP.BPM, 120);
  f.ex.web_gen(GP.ON, 1);
  f.ex.web_gen(tk(0, GK.WEIGHT), 100);
  f.ex.web_gen(tk(1, GK.WEIGHT), -100);
  f.ex.web_gen(tk(2, GK.WEIGHT), 0);
  f.ex.web_gen(tk(3, GK.WEIGHT), 50);
  f.ex.web_gen(GP.PLAY, 1);
  f.render(300);
  const dn = () => [...new Uint8Array(f.mem.buffer, f.ex.web_gen_info(), 38).slice(33, 38)];
  f.ex.web_gen(GP.MACRO, 40);
  f.render(300);
  const a1 = dn();
  f.ex.web_midi(0xB5, 16, 0);                                // CC 16 on channel 6: the macro to -100
  f.render(300);
  const a2 = dn();
  check(`MACRO +40: densities ${a1.slice(0, 4)}; CC 16 = 0 (-100): ${a2.slice(0, 4)}, macro read back ${a2[4] - 100}`,
        a1[0] === 90 && a1[1] === 0 && a1[2] === 45 && a1[3] === 65 && a2[0] === 0 && a2[1] === 100 && a2[2] === 45 && a2[4] === 0);
  // CHANCE: a frozen, mutation-0 melody at 100 % plays the same notes each bar; at 40 % about 40 % of them, and bars differ
  f.ex.web_midi(0xB0, 16, 64);
  f.ex.web_gen(tk(3, GK.DENS), 100);
  f.ex.web_gen(tk(3, GK.REST), 0);
  f.ex.web_gen(GP.MUT, 0);
  f.ex.web_gen(GP.RATE, 12);
  f.render(2000);
  f.ex.web_gen(tk(3, GK.FREEZE), 1);
  f.render(2000);
  const count = (bars) => { f.midi.length = 0; f.render(bars * 2000); const m = f.midi.filter((x) => x.st === 0x93); return m; };
  const full = count(4).length;
  f.ex.web_gen(tk(3, GK.CHANCE), 40);
  f.render(2000);
  const part = count(8);
  const perBar = [0, 1, 2, 3, 4, 5, 6, 7].map((b) => part.filter((x) => x.f >= part[0].f - 3000 + b * 88200 && x.f < part[0].f - 3000 + (b + 1) * 88200).map((x) => x.n).join(","));
  const ratio = part.length / 2 / full;
  check(`CHANCE 40 % on a frozen melody: ${(ratio * 100).toFixed(0)} % of its notes play, the bars differ`,
        ratio > 0.25 && ratio < 0.55 && new Set(perBar).size > 3);
}

// DRIFT and SWING: where the notes land against the 1/16 grid, in 1/16 of a step (the NUDGE unit)
{
  const STEP = 44100 * 60 / 120 / 4, U = STEP / 16;
  async function onsets(setup, ms = 16000) {
    const g = await device();
    g.render(1200);
    g.ex.web_gen(GP.BPM, 120);
    g.ex.web_gen(GP.ON, 1);
    g.ex.web_gen(tk(2, GK.DENS), 100);                     // a busy bass: notes on most steps
    g.ex.web_gen(tk(2, GK.WEIGHT), 0);
    setup(g);
    g.ex.web_gen(GP.PLAY, 1);
    g.render(ms);
    const on = g.midi.filter((x) => x.st === 0x92);
    const t0 = on[0].f;                                    // step 0 always plays on time (drift draws late or 0 there? see below)
    return on.map((x) => { const k = Math.round((x.f - t0) / STEP); return { k, off: (x.f - t0 - k * STEP) / U }; });
  }
  const tight = await onsets(() => {});
  const maxTight = Math.max(...tight.map((o) => Math.abs(o.off)));
  check(`DRIFT 0: ${tight.length} bass notes all on the grid (within ${maxTight.toFixed(2)} of 1/16 step)`, maxTight < 0.5);
  const loose = await onsets((g) => g.ex.web_gen(tk(2, GK.DRIFT), 100));
  // the first note is the reference: measure the rest against the median grid phase instead
  const offs = loose.map((o) => o.off), med = [...offs].sort((a, b) => a - b)[offs.length >> 1];
  const rel = offs.map((o) => o - med);
  const early = rel.filter((o) => o < -0.6).length, late = rel.filter((o) => o > 0.6).length, span = Math.max(...rel) - Math.min(...rel);
  check(`track DRIFT 100: ${early} notes early, ${late} late, spread ${span.toFixed(1)}/16 of a step (at most 14)`,
        early > 5 && late > 5 && span <= 14.6);
  const glob = await onsets((g) => g.ex.web_gen(GP.DRIFT, 50));
  const go = glob.map((o) => o.off), gm = [...go].sort((a, b) => a - b)[go.length >> 1], gspan = Math.max(...go) - Math.min(...go);
  check(`global DRIFT 50 alone moves the tracks too (spread ${gspan.toFixed(1)}/16, at most 8)`, gspan > 1.5 && gspan <= 8.6);
  const sw = await onsets((g) => g.ex.web_gen(GP.SWING, 50));
  const odd = sw.filter((o) => o.k % 2 === 1), even = sw.filter((o) => o.k % 2 === 0);
  const avg = (a) => a.reduce((x, o) => x + o.off, 0) / a.length;
  check(`global SWING 50: odd steps ${avg(odd).toFixed(1)}/16 late, even ${avg(even).toFixed(1)} (expect 3.2, 0)`,
        Math.abs(avg(odd) - 3.2) < 0.6 && Math.abs(avg(even)) < 0.6);
  const tsw = await onsets((g) => g.ex.web_gen(tk(2, GK.SWING), 100));
  const todd = tsw.filter((o) => o.k % 2 === 1);
  check(`track SWING 100: odd steps ${avg(todd).toFixed(1)}/16 late (expect 6.4)`, Math.abs(avg(todd) - 6.4) < 0.6);
  // everything at once: DRIFT 100 and SWING 100 on all four tracks, odd lengths: no stuck notes, all in key
  const h = await device();
  h.render(1200);
  h.ex.web_gen(GP.ON, 1);
  h.ex.web_gen(GP.SWING, 100);
  for (let t = 0; t < 4; t++) { h.ex.web_gen(tk(t, GK.DRIFT), 100); h.ex.web_gen(tk(t, GK.LEN), [16, 7, 5, 1][t]); }
  h.ex.web_gen(GP.PLAY, 1);
  h.render(12000);
  h.ex.web_gen(GP.PLAY, 0);
  h.render(1000);
  const hold = new Map();
  let bad = 0;
  for (const e of h.midi) {
    const key = (e.st & 15) * 128 + e.n;
    if ((e.st & 0xf0) === 0x90) hold.set(key, (hold.get(key) || 0) + 1);
    else if (hold.get(key)) hold.set(key, hold.get(key) - 1); else bad++;
  }
  const left = [...hold.values()].reduce((x, y) => x + y, 0), hon = h.midi.filter((e) => (e.st & 0xf0) === 0x90);
  check(`DRIFT 100 + SWING 100, lengths 16/7/5/1: ${hon.length} notes, ${left} left sounding after STOP, all in C major`,
        hon.length > 100 && bad === 0 && left === 0 && hon.every((e) => MAJ.has(e.n % 12)));
}

console.log(fails ? `gen: ${fails} failed` : "gen: all ok");
process.exit(fails ? 1 : 0);
