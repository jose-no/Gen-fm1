// SPDX-License-Identifier: GPL-3.0-only
// The generator on the FM-1's own screen (firmware/src/ui_gen.c), driven through the panel in the browser build:
//   node web/emu/gen_ui_test.mjs build/emu/felucca.wasm
// ARP's taps reach the GEN and TRACK pages and their knobs change the generator; ALGORITHM picks the track the TRACK
// pages edit; SAVE's SETUPS saves, asks before replacing, loads; POWER ON sets what power-on does and draws a new setup;
// ARP held: a key sets the key, OCT+ draws a new setup, OCT- puts it back; a change over USB shows on the card.
import fs from "fs";

const MOD = new WebAssembly.Module(fs.readFileSync(process.argv[2] || "build/emu/felucca.wasm"));
let fails = 0;
const check = (what, ok) => { console.log(`gen-ui: ${what.padEnd(80)} ${ok ? "ok" : "FAIL"}`); if (!ok) fails++; };
const B = { FX: 0, SCL: 1, ENV: 2, LFO: 3, EDIT: 4, GLO: 5, HOME: 6, SAVE: 7, ARP: 8, SEQ: 9, PLAY: 10, REC: 11, OCTDN: 12, OCTUP: 13 };
const EN = { SELECT: 0, ALGO: 1, PRESETS: 2, K1: 3, K2: 4, K3: 5, K4: 6 };
const T = (t, k) => 32 + t * 24 + k;

const ex = (await WebAssembly.instantiate(MOD, {})).exports, mem = ex.memory;
ex._initialize(); ex.web_nor_erase(); ex.web_gen_seed(777); ex.web_boot();
const render = (ms) => { for (let k = 0; k < ms * 44.1; k += 128) { ex.web_render(128); while (ex.web_midi_out()); } };
const tap = (b) => { ex.web_buttons(1 << B[b]); render(60); ex.web_buttons(0); render(120); };
const btn = (...bs) => { ex.web_buttons(bs.reduce((m, b) => m | 1 << B[b], 0)); render(150); };
const turn = (e, n) => { for (let i = 0; i < Math.abs(n); i++) { ex.web_enc(EN[e], Math.sign(n)); render(30); } render(100); };
const key = (k) => { ex.web_keys(1 << k); render(80); ex.web_keys(0); render(120); };
const g = (id) => ex.web_gen_get(id);
const screen = () => new Uint16Array(mem.buffer, ex.web_screen(), 240 * 240).slice();
const differs = (a, b) => { let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n; };
render(1500);

// GEN 1: KNOB 1 the key, KNOB 4 the chords
tap("ARP");
const k0 = g(1), c0 = g(6);
turn("K1", 2);
turn("K4", -1);
check(`GEN 1: KNOB 1 +2 moves the key ${k0} -> ${g(1)}, KNOB 4 -1 the chords ${c0} -> ${g(6)}`,
      g(1) === Math.min(11, k0 + 2) && g(6) === Math.max(2, c0 - 1));
// GEN 2: MUT, GEN 3: TUNE
tap("ARP");
const m0 = g(8);
turn("K2", 3);
check(`GEN 2: KNOB 2 turns MUT ${m0} -> ${g(8)}`, g(8) > m0);
tap("ARP");
turn("K4", 1);
check(`GEN 3: KNOB 4 sets TUNE to ${g(24)}`, g(24) === 440);
turn("K4", -1);
// TRACK pages follow ALGORITHM: track 4's LEAP on TRACK 1's KNOB 3
tap("ARP");
turn("ALGO", 3);
const l0 = g(T(3, 8));
turn("K3", 4);
check(`TRACK 1 on track 4: KNOB 3 is the melody's LEAP ${l0} -> ${g(T(3, 8))}`, g(T(3, 8)) > l0);
const d0 = g(T(3, 6));
turn("K4", -5);
check(`TRACK 1 on track 4: KNOB 4 its density ${d0} -> ${g(T(3, 6))}`, g(T(3, 6)) < d0);
tap("ARP");
turn("K1", -16);
check(`TRACK 2: KNOB 1 the length down to ${g(T(3, 12))}`, g(T(3, 12)) === 1);
turn("K1", 15);
turn("ALGO", -3);
// a change over USB (the control page) shows on the card at once
tap("ARP"); tap("ARP"); tap("ARP"); tap("ARP"); tap("ARP"); tap("ARP"); tap("ARP");   // round to GEN 1
const before = screen();
{
  const v = 3 + 8192, f = [0xF0, 0x7D, 0x46, 0x4C, 98, 1, v & 127, (v >> 7) & 127, 0xF7];   // GEN_SET KEY (id 1) = 3
  new Uint8Array(mem.buffer, ex.web_sx_ibuf_ptr(), f.length).set(f);
  ex.web_sx_in(f.length);
  render(300);
}
check(`a key set over USB: the device has ${g(1)}, the screen redrew (${differs(before, screen())} pixels)`, g(1) === 3 && differs(before, screen()) > 50);

// SAVE's SETUPS (the sixth tap): SLOT 2, SAVE; again: the dialog, OCT+ replaces; LOAD brings it back
tap("SAVE"); tap("SAVE"); tap("SAVE"); tap("SAVE"); tap("SAVE"); tap("SAVE");
turn("K1", 1);
turn("K4", 1);
tap("OCTUP");
check(`SETUPS: slot 2 saved (slots ${g(22).toString(2)})`, g(22) === 2);
ex.web_gen(1, 9);
render(100);
turn("K3", 1);
tap("OCTUP");
check(`SETUPS: LOAD 2 puts the key back to ${g(1)}`, g(1) === 3);
turn("K4", 1);
tap("OCTUP");
const dlg = screen();
tap("OCTUP");
check("SETUPS: SAVE over slot 2 asks first, OCT+ replaces", differs(dlg, screen()) > 1000 && g(22) === 2);
turn("K2", 1);
tap("OCTUP");
tap("OCTUP");
check(`SETUPS: CLEAR 2 (after the dialog): slots ${g(22).toString(2)}`, g(22) === 0);
// POWER ON: START over the empty slots stays on LAST; RAND + OCT+ a new setup
tap("SAVE");
turn("K1", 1);
check(`POWER ON: START to LAST (${g(20)}); further right: no saved setup, stays`, g(20) === 1 && (turn("K1", 3), g(20) === 1));
const rk = [g(1), g(2), g(4), g(10)].join();
turn("K2", 1);
tap("OCTUP");
check("POWER ON: RAND + OCT+ draws a new setup", [g(1), g(2), g(4), g(10)].join() !== rk);
turn("K1", -1);

// ARP held: a key sets the key, OCT+ a new setup, OCT- puts back what was there when it opened
const open = [g(1), g(2), g(4), g(10)].join();
btn("ARP");
render(600);
key(14);                                                      // G4: (14 + 5) % 12 = 7, G
const kG = g(1);
btn("ARP", "OCTUP"); btn("ARP");
const rnd = [g(1), g(2), g(4), g(10)].join();
btn("ARP", "OCTDN"); btn("ARP");
btn();
check(`ARP held: key G4 sets G (${kG}); OCT+ a new setup; OCT- puts back the one it opened on`,
      kG === 7 && rnd !== open && [g(1), g(2), g(4), g(10)].join() === open);

console.log(fails ? `gen-ui: ${fails} failed` : "gen-ui: all ok");
process.exit(fails ? 1 : 0);
