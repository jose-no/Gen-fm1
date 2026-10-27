// SPDX-License-Identifier: GPL-3.0-only
// The control page's link (gen_link.js) against the browser build, as the page uses it with a real FM-1:
//   node web/control/gen_link_test.mjs build/emu/felucca.wasm
import fs from "fs";
import { GenLink } from "./gen_link.js";

const MOD = new WebAssembly.Module(fs.readFileSync(process.argv[2] || "build/emu/felucca.wasm"));
let fails = 0;
const check = (what, ok) => { console.log(`gen-link: ${what.padEnd(80)} ${ok ? "ok" : "FAIL"}`); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ex = (await WebAssembly.instantiate(MOD, {})).exports, mem = ex.memory;
ex._initialize(); ex.web_nor_erase(); ex.web_gen_seed(99); ex.web_boot();
let sent = 0;
const toDevice = (bytes) => {
  sent++;
  new Uint8Array(mem.buffer, ex.web_sx_ibuf_ptr(), bytes.length).set(bytes);
  ex.web_sx_in(bytes.length);
};
// the device runs in real time beside the link: 128 frames every 3 ms (~ real time), its SysEx out to the link
let link;
const clock = setInterval(() => {
  for (let i = 0; i < 1; i++) { ex.web_render(128); while (ex.web_midi_out()); }
  const n = ex.web_sx_out_len();
  if (n) { const b = new Uint8Array(mem.buffer, ex.web_sx_out(), n).slice(); ex.web_sx_out_clear(); link?.receive(b); }
}, 3);
for (let i = 0; i < 1200 * 44.1 / 128; i++) ex.web_render(128);     // power-on

const seen = { all: 0, changed: [], status: null, lost: 0 };
link = new GenLink(toDevice, {
  onAll: (v) => { seen.all++; seen.values = v; },
  onChanged: (id, v) => seen.changed.push([id, v]),
  onStatus: (s) => { seen.status = s; },
  onLost: () => seen.lost++,
});
const info = await link.connect();
const ids = [...Array(128).keys()];
check(`connect: info ${JSON.stringify(info)}`, info.ids === 128 && info.trk === 32 && info.slots === 8);
check("every setting as the device has it", ids.every((i) => seen.values[i] === ex.web_gen_get(i)));

await link.set(1, 5);
check(`set KEY 5: the device has ${ex.web_gen_get(1)}`, ex.web_gen_get(1) === 5);
// a knob dragged: 30 moves of the melody's density in a burst; the latest value wins, few frames go
const before = sent;
const dens = 32 + 3 * 24 + 6;
const ps = [];
for (let v = 10; v < 40; v++) ps.push(link.set(dens, v));
await Promise.all(ps);
check(`30 quick moves of a setting: the device has ${ex.web_gen_get(dens)}, ${sent - before} frames sent`, ex.web_gen_get(dens) === 39 && sent - before < 10);
// clamped by the device: the page hears the value it took
seen.changed = [];
await link.set(dens, 400);
check(`set 400: the device clamps to 100, the link says so (${JSON.stringify(seen.changed)})`, seen.changed.some(([i, v]) => i === dens && v === 100));

// changes on the device reach the page; everything at once: onAll
seen.changed = [];
ex.web_gen(8, 61);                                                // MUT, as a knob on the FM-1 would
await sleep(300);
check(`a change on the device (MUT 61) is pushed: ${JSON.stringify(seen.changed)}`, seen.changed.some(([i, v]) => i === 8 && v === 61));
const allBefore = seen.all;
ex.web_gen(16, 1234);                                             // RANDOM on the device
await sleep(400);
check(`RANDOM on the device: the page reads everything again (${seen.all - allBefore}), and has it all`,
      seen.all > allBefore && ids.every((i) => seen.values[i] === ex.web_gen_get(i)));
// the status comes ~10 times a second; PLAY from the page shows in it
await link.set(11, 1);
await sleep(600);
const s1 = seen.status && seen.status.slice();
await sleep(400);
check(`status: playing ${s1?.[1]}, a loop of ${s1?.[5]}, the steps move (${s1?.slice(13, 17)} -> ${seen.status?.slice(13, 17)})`,
      s1 && s1[1] === 1 && s1.slice(13, 17).join() !== seen.status.slice(13, 17).join());
// a save from the page; the slot shows in the status
await link.set(18, 4);
await sleep(300);
check(`SAVE 4 from the page: slots in the status ${seen.status?.[39].toString(2)}`, seen.status && seen.status[39] === 8);
check("no lost link", seen.lost === 0);
link.close();
clearInterval(clock);
console.log(fails ? `gen-link: ${fails} failed` : "gen-link: all ok");
process.exit(fails ? 1 : 0);
