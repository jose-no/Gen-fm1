// SPDX-License-Identifier: GPL-3.0-only
// The generator's side of the editor protocol (web/EDITOR_PROTOCOL.md "Generator", firmware/src/editor_gen.c), for a
// control page or a test. One request at a time (the FM-1 holds one incoming SysEx frame at a time): a queue; settings
// set again before they went out are merged (the latest value goes). The device's own changes arrive as pushes.
//   const link = new GenLink((bytes) => output.send(bytes), {
//     onAll(values),            every setting, {id: value}: after connecting, and when the device changed them all
//     onChanged(id, value),     one setting changed on the device (or the device answered with another value)
//     onStatus(status),         42 numbers, ~10 times a second (playing, chords, steps, densities, slots, ...)
//     onLost(),                 no answer for a while
//   });
//   input.onmidimessage = (e) => link.receive(e.data);
//   await link.connect();  link.set(id, value);  link.close();
export const GEN = { INFO: 96, ALL: 97, SET: 98, STATUS: 99, CHANGED: 100, RELOAD: 101, WATCH: 22 };
const HDR = [0x7D, 0x46, 0x4C];
const v14 = (v) => [(v + 8192) & 127, ((v + 8192) >> 7) & 127];
const rv = (a, i) => (a[i] | a[i + 1] << 7) - 8192;

export class GenLink {
  constructor(send, handlers = {}, opts = {}) {
    this.send = send;
    this.h = handlers;
    this.timeout = opts.timeout ?? 500;
    this.pollMs = opts.pollMs ?? 100;
    this.queue = [];                                // {cmd, args, resolve, reject, key}
    this.busy = null;                               // the request in flight
    this.frame = null;                              // bytes of a frame arriving in pieces
    this.values = {};
    this.info = null;
    this.misses = 0;
    this.timer = null;
  }

  // incoming MIDI: whole frames (Web MIDI) or a byte stream in pieces
  receive(data) {
    for (const b of data) {
      if (b >= 0xF8) continue;                        // realtime
      if (b === 0xF0) { this.frame = []; continue; }
      if (b === 0xF7) { if (this.frame) this.frame_(this.frame); this.frame = null; continue; }
      if (b & 0x80) { this.frame = null; continue; }   // another status ends it
      if (this.frame) this.frame.push(b);
    }
  }
  frame_(f) {
    if (f.length < 4 || f[0] !== HDR[0] || f[1] !== HDR[1] || f[2] !== HDR[2]) return;
    const cmd = f[3], a = f.slice(4);
    if (cmd === GEN.CHANGED && a.length >= 3) {      // pushes: never replies
      this.values[a[0]] = rv(a, 1);
      this.h.onChanged?.(a[0], this.values[a[0]]);
      return;
    }
    if (cmd === GEN.RELOAD) { this.readAll().catch(() => {}); return; }
    if (this.busy && this.busy.cmd === cmd) {
      const r = this.busy;
      clearTimeout(r.t);
      this.busy = null;
      this.misses = 0;
      r.resolve(a);
      this.pump();
    }
  }

  request(cmd, args = [], key = null) {
    return new Promise((resolve, reject) => {
      if (key !== null) {                             // a setting asked for again: its latest value only
        const q = this.queue.find((r) => r.key === key);
        if (q) { q.args = args; q.resolvers.push({ resolve, reject }); return; }
      }
      this.queue.push({ cmd, args, key, resolvers: [{ resolve, reject }] });
      this.pump();
    });
  }
  pump() {
    if (this.busy || !this.queue.length) return;
    const r = this.queue.shift();
    const done = (fn) => (x) => r.resolvers.forEach((p) => p[fn](x));
    this.busy = { cmd: r.cmd, resolve: done("resolve"), reject: done("reject") };
    this.busy.t = setTimeout(() => {                  // no answer: once more, then give up on it
      const b = this.busy;
      this.busy = null;
      if (!r.retried) { r.retried = true; this.queue.unshift(r); }
      else { b.reject(new Error(`no reply to ${r.cmd}`)); if (++this.misses >= 3) this.h.onLost?.(); }
      this.pump();
    }, this.timeout);
    this.send([0xF0, ...HDR, r.cmd, ...r.args, 0xF7]);
  }

  async connect() {
    const i = await this.request(GEN.INFO);
    this.info = { version: i[0], ids: rv(i, 1), trk: i[3], perTrack: i[4], tracks: i[5], slots: i[6] };
    await this.request(GEN.WATCH, [1]);
    await this.readAll();
    this.timer = setInterval(() => this.poll(), this.pollMs);
    return this.info;
  }
  async readAll() {
    const a = await this.request(GEN.ALL);
    const start = a[0], n = rv(a, 1);
    for (let i = 0; i < n; i++) this.values[start + i] = rv(a, 3 + 2 * i);
    this.h.onAll?.({ ...this.values });
    return this.values;
  }
  async poll() {
    if (this.queue.length) return;                    // settings first; the status can wait a moment
    try {
      const a = await this.request(GEN.STATUS);
      const s = [];
      for (let i = 0; i + 1 < a.length; i += 2) s.push(rv(a, i));
      this.h.onStatus?.(s);
    } catch { /* (counted by the request) */ }
  }
  async set(id, v) {
    this.values[id] = v;
    try {
      const a = await this.request(GEN.SET, [id, ...v14(v | 0)], id);
      const got = rv(a, 1);
      if (got !== this.values[id] && id !== 16 && id !== 17 && id !== 18 && id !== 19 && id !== 21 && id !== 11) {
        this.values[id] = got;                        // clamped, or another rule of the device's
        this.h.onChanged?.(id, got);
      }
      return got;
    } catch { return null; }
  }
  close() {
    clearInterval(this.timer);
    this.timer = null;
    if (this.busy) clearTimeout(this.busy.t);
    this.busy = null;
    this.queue = [];
    try { this.send([0xF0, ...HDR, GEN.WATCH, 0, 0xF7]); } catch { /* gone */ }
  }
}
