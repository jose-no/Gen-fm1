#!/usr/bin/env python3
"""build/genemu/: the generative machine's browser page (index.html after Felucca's web/emu/index.html, with the
generator's panel), worklet.js, felucca.wasm. Run after build/emu-build.sh."""
import base64, pathlib, re, shutil, sys
emu = pathlib.Path(__file__).resolve().parent
root = emu.parent.parent
out = root / "build" / "genemu"
out.mkdir(parents=True, exist_ok=True)
src = (emu / "index.html").read_text()
ver = re.search(r'#define FELUCCA_VERSION "([^"]*)"', (root / "firmware/src/felucca.c").read_text()).group(1)
font = base64.b64encode((emu / "fonts/DotGothic16-subset.woff").read_bytes()).decode()
head = src[src.index("<head>") + 6:src.index("</head>")]
body = src[src.index("<body>") + 6:src.index("</body>")]
head = head.replace('<meta charset="utf-8">\n', "").replace('<meta name="viewport" content="width=device-width, initial-scale=1">\n', "")
head = re.sub(r"<title>.*?</title>", '<title>FM-1 Generative Machine</title>\n<meta name="claude:viewport-fit-sides" content="cover">', head)
head = re.sub(r'<meta name="description" content="[^"]*">', '<meta name="description" content="A generative chord and melody machine for the M-VAVE FM-1, running in the browser on the same firmware the instrument runs.">', head)
head = head.replace('url("fonts/DotGothic16-subset.woff")', f'url("data:font/woff;base64,{font}")')
head = head.replace("main { max-width: 1040px; margin: 0 auto; padding: 24px 16px 32px; }",
    "main { max-width: 1040px; margin: 0 auto; padding-block: 24px 32px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }")
head = head.replace("@media (orientation: portrait) and (max-width: 700px) { main { padding: 8px 8px 24px; } }",
    "@media (orientation: portrait) and (max-width: 700px) { main { padding-block: 8px 24px; } }")
head = head.replace("</style>", (emu / "gen_panel.css").read_text() + "</style>")
assert "max(16px" in head
# the panel goes under the device and its key hints; the footer names this fork
panel = (emu / "gen_panel.html").read_text()
body = body.replace("\n<footer>", "\n" + panel + "\n<footer>", 1)
body = re.sub(r"<footer>.*?</footer>", f"""<footer>
  <small class="version">Felucca {ver} with the generative machine (proof of concept)</small><br>
  Firmware: <a href="https://github.com/hugelton/Felucca">Felucca</a> by Leo Kuroshita, Hügelton Instruments, with a generative layer added · <a href="https://www.gnu.org/licenses/gpl-3.0.html">GPL-3.0</a> · browser build after charlesvestal's <a href="https://github.com/charlesvestal/fm1-x0x">X0X</a> · DotGothic16 font, SIL OFL 1.1<br>
  <small>M-VAVE and FM-1 are trademarks of their respective owners. This build is not affiliated with or endorsed by them or by Hügelton Instruments.</small>
</footer>""", body, flags=re.S)
js = (emu / "gen_panel.js").read_text()
body = body.replace("\n</script>", "\n" + js + "\n</script>", 1)
for a, b in [('          if (m.leds) drawLights(lastLeds = m.leds, m.anim);',
              '          if (m.leds) drawLights(lastLeds = m.leds, m.anim);\n          if (m.gen) drawGen(m.gen);'),
             ('        else if (m.type === "frame") {', '        else if (m.type === "midi") onMidiOut(m.events);\n        else if (m.type === "frame") {'),
             ('    midiOn();\n', '    midiOn();\n    genReady();\n'),
             ('const STORE = "felucca-emu-flash"', 'const STORE = "fm1-gen-emu-flash"')]:
    assert a in body, a
    body = body.replace(a, b, 1)
(out / "index.html").write_text(head.strip() + "\n" + body.strip() + "\n")
shutil.copy(emu / "worklet.js", out / "worklet.js")
shutil.copy(root / "build/emu/felucca.wasm", out / "felucca.wasm")
print("genemu:", out, (out / "index.html").stat().st_size, "B page")
