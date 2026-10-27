#!/usr/bin/env python3
"""build/control/: the Gen-FM1 control page. Felucca's emulator page (web/emu/index.html) for the virtual FM-1, the
generator panel (web/emu/gen_panel.*), the link (gen_link.js) and the connection (control.*). One page: it drives a
real FM-1 over USB (Web MIDI) or the virtual one it runs. Run after tools/emu_build_zig.sh (build/emu/felucca.wasm)."""
import base64, pathlib, re, shutil

here = pathlib.Path(__file__).resolve().parent
root = here.parent.parent
emu = root / "web" / "emu"
out = root / "build" / "control"
out.mkdir(parents=True, exist_ok=True)
src = (emu / "index.html").read_text()
ver = re.search(r'#define FELUCCA_VERSION "([^"]*)"', (root / "firmware/src/felucca.c").read_text()).group(1)
font = base64.b64encode((emu / "fonts/DotGothic16-subset.woff").read_bytes()).decode()

head = src[src.index("<head>") + 6:src.index("</head>")]
body = src[src.index("<body>") + 6:src.index("</body>")]
head = re.sub(r"<title>.*?</title>", '<title>Gen-FM1 Control</title>\n<meta name="claude:viewport-fit-sides" content="cover">', head)
head = re.sub(r'<meta name="description" content="[^"]*">',
              '<meta name="description" content="Control the Gen-FM1 generative machine on an M-VAVE FM-1 over USB, or on a virtual FM-1 in the browser.">', head)
head = head.replace('url("fonts/DotGothic16-subset.woff")', f'url("data:font/woff;base64,{font}")')
head = head.replace("main { max-width: 1040px; margin: 0 auto; padding: 24px 16px 32px; }",
    "main { max-width: 1280px; margin: 0 auto; padding-block: 24px 32px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }")
head = head.replace("@media (orientation: portrait) and (max-width: 700px) { main { padding: 8px 8px 24px; } }",
    "@media (orientation: portrait) and (max-width: 700px) { main { padding-block: 8px 24px; } }")
head = head.replace("</style>", (emu / "gen_panel.css").read_text() + (here / "control.css").read_text() + "</style>")
assert "max(16px" in head

# the connection bar first; the virtual FM-1 and its key hints hidden until it is asked for
body = body.replace("<main>", "<main>\n" + (here / "control.html").read_text(), 1)
body = body.replace('<div class="device" id="device">', '<div class="device" id="device" hidden>', 1)
body = body.replace('<p class="keys">', '<p class="keys" id="keyhints" hidden>', 1)
panel = (emu / "gen_panel.html").read_text().replace(
    "Switch the FM-1 on above. The generator starts with it.", "Connect an FM-1 above: its generator's settings show here.")
body = body.replace("\n<footer>", "\n" + panel + "\n<footer>", 1)
body = re.sub(r"<footer>.*?</footer>", f"""<footer>
  <small class="version">Gen-FM1 control · Felucca {ver} with the generative machine</small><br>
  Firmware: <a href="https://github.com/hugelton/Felucca">Felucca</a> by Leo Kuroshita, Hügelton Instruments, with a generative layer added · <a href="https://www.gnu.org/licenses/gpl-3.0.html">GPL-3.0</a> · browser build after charlesvestal's <a href="https://github.com/charlesvestal/fm1-x0x">X0X</a> · DotGothic16 font, SIL OFL 1.1<br>
  <small>M-VAVE and FM-1 are trademarks of their respective owners. Gen-FM1 is not affiliated with or endorsed by them or by Hügelton Instruments.</small>
</footer>""", body, flags=re.S)

link = re.sub(r"^export ", "", (here / "gen_link.js").read_text(), flags=re.M)
js = link + "\n" + (emu / "gen_panel.js").read_text() + "\n" + (here / "control.js").read_text()
body = body.replace("\n</script>", "\n" + js + "\n</script>", 1)
for a, b in [('        else if (m.type === "frame") {',
              '        else if (m.type === "midi") onMidiOut(m.events);\n        else if (m.type === "sxout") onVirtualSx(m.bytes);\n        else if (m.type === "frame") {'),
             ('    midiOn();\n', '    midiOn();\n    afterSwitchOn();\n'),
             ('const STORE = "felucca-emu-flash"', 'const STORE = "gen-fm1-control-flash"'),
             ('master: masterValue }, [wasm]);', 'master: masterValue, seed: crypto.getRandomValues(new Uint32Array(1))[0] }, [wasm]);')]:
    assert a in body, a
    body = body.replace(a, b, 1)
(out / "index.html").write_text(head.strip() + "\n" + body.strip() + "\n")
shutil.copy(emu / "worklet.js", out / "worklet.js")
shutil.copy(root / "build/emu/felucca.wasm", out / "felucca.wasm")
print("control:", out, (out / "index.html").stat().st_size, "B page")
