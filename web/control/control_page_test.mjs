// node web/control/control_page_test.mjs build/control [virtual|usb]: the control page in jsdom, linked to a virtual FM-1 or to a second one behind mock Web MIDI
import fs from "fs";
import vm from "vm";
import { JSDOM } from "jsdom";
const dir = process.argv[2], mode = process.argv[3] || "virtual";
const html = fs.readFileSync(dir + "/index.html", "utf8");
const wasm = fs.readFileSync(dir + "/felucca.wasm");
const workletSrc = fs.readFileSync(dir + "/worklet.js", "utf8");
const dom = new JSDOM(`<!doctype html><html><head></head><body>${html}</body></html>`, { pretendToBeVisual: true, runScripts: "outside-only" });
const w = dom.window;
const errors = [];
w.addEventListener("error", (e) => errors.push(String(e.error || e.message)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = 0, bad = 0;
const check = (what, c) => { console.log(`ctl(${mode}): ${what.padEnd(78)} ${c ? "ok" : "FAIL"}`); c ? ok++ : bad++; };

let Proc = null;
const wctx = { console, performance, Float32Array, Uint8Array, Uint16Array, WebAssembly, Object, Math, String, Array, Date,
  currentTime: 0, registerProcessor: (n, c) => { Proc = c; } };
wctx.globalThis = wctx;
class AWP { constructor() { this.port = makePort(); } }
wctx.AudioWorkletProcessor = AWP;
const exportsObj = {};
vm.runInNewContext(workletSrc.replace(/^export /gm, "").concat("\n;__ex.midiKnob=midiKnob;__ex.KNOB_MODES=KNOB_MODES;"), Object.assign(wctx, { __ex: exportsObj }));
function makePort() { return { onmessage: null, other: null, postMessage(m) { const o = this.other; setTimeout(() => o.onmessage && o.onmessage({ data: m }), 0); } }; }
class FakeNode {
  constructor() {
    FakeNode.last = this;
    this.proc = new Proc();
    this.port = makePort();
    this.port.other = this.proc.port;
    this.proc.port.other = this.port;
    let t = 0;
    this.timer = setInterval(() => {
      for (let i = 0; i < 4; i++) {
        const out = [[new Float32Array(128), new Float32Array(128)]];
        this.proc.process([], out);
        t += 128 / 44100; wctx.currentTime = t;
      }
    }, 10);
  }
  connect() {}
}
w.AudioContext = class { constructor() { this.sampleRate = 44100; this.destination = {}; this.audioWorklet = { addModule: async () => {} }; } resume() { return Promise.resolve(); } };
w.AudioWorkletNode = FakeNode;
w.fetch = async () => ({ ok: true, arrayBuffer: async () => wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) });
if (!w.crypto || !w.crypto.getRandomValues) w.crypto = globalThis.crypto;
w.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
w.SVGElement.prototype.getBBox = () => ({ x: 0, y: 0, width: 10, height: 10 });
w.requestAnimationFrame = (f) => setTimeout(f, 16);
w.HTMLCanvasElement.prototype.getContext = () => ({ createImageData: (a, b) => ({ data: new Uint8ClampedArray(a * b * 4) }), putImageData() {}, fillRect() {}, drawImage() {} });

// USB: a second FM-1 here in Node, behind mock Web MIDI ports named as the real one
let hw = null;
if (mode === "usb") {
  const MOD = new WebAssembly.Module(wasm);
  const ex = (await WebAssembly.instantiate(MOD, {})).exports;
  ex._initialize(); ex.web_nor_erase(); ex.web_gen_seed(555); ex.web_boot();
  for (let i = 0; i < 1500 * 44.1 / 128; i++) ex.web_render(128);
  const input = { id: "in1", name: "Felucca MIDI 1", state: "connected", onmidimessage: null, open: async () => {} };
  const output = { id: "out1", name: "Felucca MIDI 1", state: "connected",
    send(bytes) { const b = Uint8Array.from(bytes); new Uint8Array(ex.memory.buffer, ex.web_sx_ibuf_ptr(), b.length).set(b); ex.web_sx_in(b.length); } };
  setInterval(() => {                                  // the FM-1 runs; its SysEx and notes come back in
    for (let i = 0; i < 3; i++) { ex.web_render(128); for (let p; (p = ex.web_midi_out()) !== 0;) input.onmidimessage?.({ data: Uint8Array.of((p >>> 8) & 255, (p >>> 16) & 127, (p >>> 24) & 127) }); }
    const n = ex.web_sx_out_len();
    if (n) {
      const b = new Uint8Array(ex.memory.buffer, ex.web_sx_out(), n).slice(); ex.web_sx_out_clear();
      let f = null;
      for (const x of b) { if (x === 0xF0) f = [x]; else if (f) { f.push(x); if (x === 0xF7) { input.onmidimessage?.({ data: Uint8Array.from(f) }); f = null; } } }
    }
  }, 8);
  w.navigator.requestMIDIAccess = async () => ({ inputs: new Map([["in1", input]]), outputs: new Map([["out1", output]]), onstatechange: null, addEventListener() {} });
  hw = { ex, input };
}

const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/^import .*$/m, "const { midiKnob, KNOB_MODES } = window.__wk;");
w.__wk = exportsObj;
try { w.eval(script); } catch (e) { errors.push("eval: " + e); }
const $ = (id) => w.document.getElementById(id);
const dev = () => (mode === "usb" ? hw.ex : FakeNode.last.proc.ex);
check("before connecting: the panel's controls are off", $("gen-on").disabled && $("g-save").disabled);
$(mode === "usb" ? "c-usb" : "c-virt").click();
await sleep(2500);
check(`connected: "${$("c-status").textContent.slice(0, 60)}"`, /Connected|Virtual FM-1 running/.test($("c-status").textContent) && !$("gen-on").disabled);
check(`the virtual FM-1 shown only in virtual mode (${!$("device").hidden})`, $("device").hidden === (mode === "usb"));
const T = (t, k) => 32 + t * 24 + k;
const page = () => ({ key: +$("g-root").value, bpm: +$("g-bpm").value, scale: +$("g-scale").value, mdens: +$("t3-dens").value, tune: +$("g-tune").value });
const devv = () => ({ key: dev().web_gen_get(1), bpm: dev().web_gen_get(10), scale: dev().web_gen_get(2), mdens: dev().web_gen_get(T(3, 6)), tune: dev().web_gen_get(24) });
check(`the page shows the FM-1's settings: ${JSON.stringify(page())}`, JSON.stringify(page()) === JSON.stringify(devv()));
// page -> FM-1
const sel = $("g-root"); sel.value = String((+sel.value + 5) % 12); sel.dispatchEvent(new w.Event("change"));
const r = $("t3-dens"); r.value = "83"; r.dispatchEvent(new w.Event("input"));
await sleep(400);
check(`page -> FM-1: key ${dev().web_gen_get(1)} (page ${sel.value}), melody density ${dev().web_gen_get(T(3, 6))}`, dev().web_gen_get(1) === +sel.value && dev().web_gen_get(T(3, 6)) === 83);
// FM-1 -> page: the four knobs turned on the FM-1's ARP page
dev().web_buttons(1 << 8); await sleep(80); dev().web_buttons(0); await sleep(150);
const before = Array.from({ length: 128 }, (_, i) => dev().web_gen_get(i));
for (const k of [3, 4, 5, 6]) for (let i = 0; i < 3; i++) { dev().web_enc(k, 1); await sleep(40); }
await sleep(700);
const moved = before.map((v, i) => (v !== dev().web_gen_get(i) ? i : -1)).filter((i) => i >= 0);
const pk = { key: +$("g-root").value, scale: +$("g-scale").value, mut: +$("g-mut").value };
const dk = { key: dev().web_gen_get(1), scale: dev().web_gen_get(2), mut: dev().web_gen_get(8) };
check(`FM-1 -> page: knobs moved ids ${moved}; page ${JSON.stringify(pk)}`, moved.length >= 3 && JSON.stringify(pk) === JSON.stringify(dk));
// RANDOM on the FM-1 (ARP held + OCT+): the page follows all of it
dev().web_buttons(1 << 8); await sleep(700); dev().web_buttons(1 << 8 | 1 << 13); await sleep(150); dev().web_buttons(1 << 8); await sleep(150); dev().web_buttons(0);
await sleep(800);
check(`FM-1 RANDOM: the page has it all ${JSON.stringify(page())}`, JSON.stringify(page()) === JSON.stringify(devv()));
// Play from the page, status shows
$("gen-play").click();
await sleep(1200);
check(`Play from the page: playing ${dev().web_gen_get(11)}, the page's button says ${$("gen-play").textContent}, chords ${$("g-loop").children.length}`,
      dev().web_gen_get(11) === 1 && $("gen-play").textContent === "Stop" && $("g-loop").children.length >= 2);
// Save from the page into slot 2; the FM-1 has it
$("g-slots").children[1].click(); $("g-save").click();
await sleep(400);
check(`Save from the page: the FM-1's slots ${dev().web_gen_get(22).toString(2)}, the page marks slot 2 (${$("g-slots").children[1].classList.contains("used")})`,
      dev().web_gen_get(22) === 2 && $("g-slots").children[1].classList.contains("used"));
if (mode === "usb") {
  await sleep(500);
  check(`its notes reach the page's MIDI line: "${$("g-midi").textContent.slice(0, 50)}"`, /[A-G]/.test($("g-midi").textContent));
}
$("c-off").click();
await sleep(200);
check("Disconnect: the controls are off again", $("gen-on").disabled);
console.log("errors:", errors.length ? errors : "none");
console.log(bad ? `ctl(${mode}): ${bad} failed` : `ctl(${mode}): all ok`);
process.exit(0);
