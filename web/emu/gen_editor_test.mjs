// SPDX-License-Identifier: GPL-3.0-only
// The generator over the editor protocol (firmware/src/editor_gen.c), against the browser build in Node:
//   node web/emu/gen_editor_test.mjs build/emu/felucca.wasm
// A page that sets a value hears no echo; a change made on the device (MIDI CC, its own controls) is pushed;
// a change of everything at once (RANDOM, LOAD) pushes GEN_RELOAD; watching ends 3 s after the last request.
import fs from "fs";

const MOD = new WebAssembly.Module(fs.readFileSync(process.argv[2] || "build/emu/felucca.wasm"));
let fails = 0;
const check = (what, ok) => { console.log(`gen-editor: ${what.padEnd(78)} ${ok ? "ok" : "FAIL"}`); if (!ok) fails++; };
const CMD = { WATCH: 22, PING: 25, INFO: 96, ALL: 97, SET: 98, STATUS: 99, CHANGED: 100, RELOAD: 101 };
const v14 = (v) => [(v + 8192) & 127, ((v + 8192) >> 7) & 127];
const rv = (a, i) => (a[i] | a[i + 1] << 7) - 8192;

const instance = await WebAssembly.instantiate(MOD, {});
const ex = instance.exports, mem = ex.memory;
ex._initialize();
ex.web_nor_erase();
ex.web_gen_seed(31337);
ex.web_boot();
const render = (ms) => { for (let k = 0; k < ms * 44.1; k += 128) { ex.web_render(128); while (ex.web_midi_out()); } };
let inbox = [];
function pump() {                                         // the device's frames since the last look
  const n = ex.web_sx_out_len();
  const bytes = new Uint8Array(mem.buffer, ex.web_sx_out(), n).slice();
  ex.web_sx_out_clear();
  let f = null;
  for (const b of bytes) {
    if (b === 0xF0) f = [];
    else if (b === 0xF7) { if (f && f[0] === 0x7D && f[1] === 0x46 && f[2] === 0x4C) inbox.push({ cmd: f[3], a: f.slice(4) }); f = null; }
    else if (f) f.push(b);
  }
}
function send(cmd, args = []) {
  const frame = [0xF0, 0x7D, 0x46, 0x4C, cmd, ...args, 0xF7];
  new Uint8Array(mem.buffer, ex.web_sx_ibuf_ptr(), frame.length).set(frame);
  ex.web_sx_in(frame.length);
}
async function ask(cmd, args = [], ms = 40) {               // a request, and its reply (pushes stay in the inbox)
  send(cmd, args);
  for (let t = 0; t < 40; t++) {
    render(ms / 4);
    pump();
    const i = inbox.findIndex((m) => m.cmd === cmd);
    if (i >= 0) return inbox.splice(i, 1)[0].a;
  }
  return null;
}
const pushes = (cmd) => { const p = inbox.filter((m) => m.cmd === cmd); inbox = inbox.filter((m) => m.cmd !== cmd); return p; };

render(1500);
const info = await ask(CMD.INFO);
check(`GEN_INFO: version ${info?.[0]}, ${info ? rv(info, 1) : "?"} ids, GP_TRK ${info?.[3]}, ${info?.[4]} per track, ${info?.[5]} tracks, ${info?.[6]} slots`,
      info && info[0] === 1 && rv(info, 1) === 128 && info[3] === 32 && info[4] === 24 && info[5] === 4 && info[6] === 8);
const all = await ask(CMD.ALL);
const vals = all ? [...Array(rv(all, 1)).keys()].map((i) => rv(all, 3 + 2 * i)) : [];
check(`GEN_ALL: ${vals.length} values; key ${vals[1]}, tempo ${vals[10]}, tuning ${vals[24]}, melody density ${vals[32 + 3 * 24 + 6]}`,
      vals.length === 128 && vals[1] === ex.web_gen_get(1) && vals[10] === ex.web_gen_get(10) && vals[24] === 432 &&
      vals[32 + 3 * 24 + 6] === ex.web_gen_get(32 + 3 * 24 + 6));
const part = await ask(CMD.ALL, [32, 24]);
check("GEN_ALL 32, 24: track 1's 24 settings", part && part[0] === 32 && rv(part, 1) === 24 && rv(part, 3 + 2 * 6) === ex.web_gen_get(32 + 6));

const w = await ask(CMD.WATCH, [1]);
check("WATCH 1", w && (w[0] & 1) === 1);
inbox = [];
const set = await ask(CMD.SET, [1, ...v14(9)]);                    // the page sets the key to A
render(200); pump();
check(`GEN_SET key 9: reply ${set ? rv(set, 1) : "?"}, the device has ${ex.web_gen_get(1)}, no echo pushed`,
      set && set[0] === 1 && rv(set, 1) === 9 && ex.web_gen_get(1) === 9 && pushes(CMD.CHANGED).length === 0);
const sd = await ask(CMD.SET, [32 + 3 * 24 + 6, ...v14(77)]);     // melody density 77
check("GEN_SET melody density 77", sd && rv(sd, 1) === 77 && ex.web_gen_get(32 + 3 * 24 + 6) === 77);
const clamp = await ask(CMD.SET, [32 + 3 * 24 + 6, ...v14(500)]);
check(`GEN_SET 500 -> clamped to ${clamp ? rv(clamp, 1) : "?"}`, clamp && rv(clamp, 1) === 100);

// a change made on the device: MIDI CC 16 (the macro), then the device's own gen_set (its knobs go this way)
ex.web_midi(0xB0, 16, 127);
ex.web_gen(32 + 1 * 24 + 17, 55);                                   // dyad B chance 55, as the panel would
render(300); pump();
const ch = pushes(CMD.CHANGED).map((m) => [m.a[0], rv(m.a, 1)]);
check(`device changes pushed: ${JSON.stringify(ch)} (macro 13 = 100, dyad B chance 73 = 55)`,
      ch.some(([id, v]) => id === 13 && v === 100) && ch.some(([id, v]) => id === 32 + 24 + 17 && v === 55));
// everything at once on the device: RELOAD, then the page reads it all again
ex.web_gen(16, 4242);                                               // RANDOM
render(300); pump();
const rl = pushes(CMD.RELOAD);
check(`RANDOM on the device: GEN_RELOAD pushed (${rl.length}), no flood of CHANGED (${pushes(CMD.CHANGED).length})`, rl.length === 1);
// the page's own RANDOM: a RELOAD too (its settings changed beyond the one it set)
await ask(CMD.SET, [16, ...v14(7)]);
render(300); pump();
check("the page's own RANDOM: GEN_RELOAD pushed", pushes(CMD.RELOAD).length === 1);

// GEN_STATUS: the live state; playing, and the steps moving
await ask(CMD.SET, [11, ...v14(1)]);                               // PLAY
render(1000);
const s1 = await ask(CMD.STATUS);
render(500);
const s2 = await ask(CMD.STATUS);
const st = (s) => [...Array(42).keys()].map((i) => rv(s, 2 * i));
const a1 = s1 && st(s1), a2 = s2 && st(s2);
check(`GEN_STATUS: 42 values, playing ${a1?.[1]}, loop of ${a1?.[5]}, steps ${a1?.slice(13, 17)} -> ${a2?.slice(13, 17)}`,
      a1 && a1[0] === 1 && a1[1] === 1 && a1[5] >= 2 && a1.slice(13, 17).join() !== a2.slice(13, 17).join());

// watching ends 3 s after the last request: no pushes after that
inbox = [];
render(3600);
ex.web_gen(1, 3);
render(400); pump();
check("watching ends 3 s after the last request: no push after", pushes(CMD.CHANGED).length === 0);
// a new WATCH starts from the values as they are (no stale pushes)
await ask(CMD.WATCH, [1]);
render(300); pump();
check("a new WATCH: nothing stale pushed", pushes(CMD.CHANGED).length === 0);
// Felucca's own commands still answer
const ping = await ask(CMD.PING);
check("PING (Felucca's own) still answers", ping && ping[0] === 0);

console.log(fails ? `gen-editor: ${fails} failed` : "gen-editor: all ok");
process.exit(fails ? 1 : 0);
