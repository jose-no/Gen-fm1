// ------------------------------------------------------------------ the control page's connection (web/control/)
// The generator panel (gen_panel.js) talks to an FM-1 through GenLink (gen_link.js): a real one over USB (Web MIDI
// with SysEx), or the virtual one this page runs (felucca.wasm in an AudioWorklet, its editor over the same SysEx).
// Changes on either side show on the other: the FM-1 pushes its own (its knobs, keys, MIDI CC), the page sends its.
let link = null, linkMode = "", usb = null, genValues = {};
const cstat = (t, kind = "") => { const p = $("c-status"); p.textContent = t; p.className = "ctl-status" + (kind ? " " + kind : ""); };
const linkHandlers = {
  onAll: (v) => { genValues = v; syncGen(v); },
  onChanged: (id, v) => { genValues[id] = v; syncGen(genValues); },
  onStatus: (s) => drawGen(s),
  onLost: () => { cstat("The FM-1 stopped answering. Check the cable, then press Connect FM-1 again.", "bad"); disconnect(); },
};
genSetHook = (id, v) => { genValues[id] = v; return link ? link.set(id, v) : null; };

function showConnected(on) {
  $("c-usb").hidden = on;
  $("c-virt").hidden = on;
  $("c-off").hidden = !on;
  for (const id of ["gen-on", "gen-play", "gen-random", "gen-defaults", "g-save", "g-boot"]) $(id).disabled = !on;
  if (on) delete $("g-save").dataset.off; else $("g-save").dataset.off = "1";
  drawSlots();
}

async function connectUsb() {
  if (!navigator.requestMIDIAccess) {
    cstat("This browser has no Web MIDI. Use Chrome or Edge on a computer, or try the virtual FM-1.", "bad");
    return;
  }
  cstat("Asking the browser for MIDI access…");
  let access;
  try { access = await navigator.requestMIDIAccess({ sysex: true }); }
  catch {
    cstat("MIDI access was refused. Allow it for this page (with SysEx), or open the page from its own address.", "bad");
    return;
  }
  const isFm1 = (p) => /felucca|gen-fm1|fm-1/i.test(p.name || "") && p.state !== "disconnected";
  const input = [...access.inputs.values()].find(isFm1), output = [...access.outputs.values()].find(isFm1);
  if (!input || !output) {
    cstat("No FM-1 found. Check the USB cable and that the FM-1 runs Gen-FM1, then press Connect FM-1 again.", "bad");
    return;
  }
  link = new GenLink((b) => output.send(b), linkHandlers);
  input.onmidimessage = (e) => {
    const d = e.data;
    if (d[0] === 0xF0) link?.receive(d);
    else if (d.length >= 3 && ((d[0] & 0xF0) === 0x90 || (d[0] & 0xF0) === 0x80)) onMidiOut([[d[0], d[1], d[2]]]);   // its notes
  };
  if (input.open) await input.open().catch(() => {});
  usb = { access, input, output };
  access.onstatechange = (e) => {
    if (usb && (e.port === usb.input || e.port === usb.output) && e.port.state === "disconnected") {
      cstat("The FM-1 was unplugged.", "bad");
      disconnect();
    }
  };
  try {
    await link.connect();
  } catch {
    cstat("The FM-1 did not answer. Is it running Gen-FM1? Plain Felucca has no generator.", "bad");
    disconnect();
    return;
  }
  linkMode = "usb";
  $("device").hidden = true;
  $("keyhints").hidden = true;
  showConnected(true);
  genMidiPorts();
  cstat(`Connected to ${input.name}. Changes here go to the FM-1, and its own changes show here.`, "ok");
}

// the virtual FM-1: switch it on (the page's own button does the same), then link to it over its SysEx
async function connectVirtual() {
  $("device").hidden = false;
  $("keyhints").hidden = false;
  if (!node) await switchOn();
  else afterSwitchOn();
}
async function afterSwitchOn() {
  if (!node || link) return;
  link = new GenLink((b) => node.port.postMessage({ type: "sx", bytes: b }), linkHandlers);
  try { await link.connect(); }
  catch { cstat("The virtual FM-1 did not answer.", "bad"); link = null; return; }
  linkMode = "virtual";
  showConnected(true);
  cstat("Virtual FM-1 running in this page. Its knobs and keys, and the panel below, change the same generator.", "ok");
}
function onVirtualSx(bytes) { if (linkMode === "virtual" || (link && !linkMode)) link.receive(bytes); }

function disconnect() {
  if (link) link.close();
  link = null;
  if (usb) { usb.input.onmidimessage = null; usb = null; }
  linkMode = "";
  showConnected(false);
}
$("c-usb").addEventListener("click", connectUsb);
$("c-virt").addEventListener("click", connectVirtual);
$("c-off").addEventListener("click", () => { disconnect(); cstat("Disconnected."); });
showConnected(false);
