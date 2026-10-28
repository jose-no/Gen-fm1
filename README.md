# Gen-FM1

A generative chord and melody machine for the M-VAVE FM-1 pocket synthesizer: four tracks, each with its own 6-operator FM synth and its own USB MIDI channel, driven by one shared harmony engine.

- **Dyad A and Dyad B:** two-note chord tracks.
- **Bass:** a mono bass line that follows the chords.
- **Melody:** a mono melody built from chord and scale tones.

Gen-FM1 is a fork of [Felucca](https://github.com/hugelton/Felucca) by Leo Kuroshita (Hügelton Instruments). Felucca supplies the hardware layer, the FM engine, the sequencer, the screen and the browser emulator. Gen-FM1 adds the generator on top.

> **Status: not yet tested on hardware.** The generator runs in the browser emulator and passes its tests and Felucca's own. GitHub Actions builds the installable package with JieLi's toolchain. It has not been flashed to a real FM-1 yet.

## What it does

- **A new start every time:** each power-on draws a fresh setup (key, scale, tempo, progression, sounds, rhythms, densities) within musical ranges, and the generator is ready to play. Randomize and Defaults buttons on the web page do the same at any time.
- **Saved setups:** 8 slots in the FM-1's memory, frozen phrases included. Power-on can start random, resume the last session, or start from a saved setup.
- **Tuning:** A = 432 Hz by default, or 440.
- **Harmony:** pick a key and a scale (16 built in, or your own), and a progression source: fixed, random walk, weighted rules, functional harmony, circle of fifths, voice-leading, pendulum, or pedal. The progression is a loop of 2 to 8 chords.
- **Chord timing:** a master rate from ½ bar to 32 bars. Each track walks the progression at the master rate times its own multiplier (×¼ to ×8), or follows the master chord exactly with harmony lock.
- **Mutation:** one control for how much the patterns and progression change from pass to pass. At 0 every track repeats its bar, re-voiced onto each new chord. Freeze stops a track changing at all.
- **Density modulation:** each track's density can move by itself with a sine, triangle, ramp, square, random or drifting shape, synced from ¼ bar to 32 bars.
- **Macro:** one knob (or MIDI CC 16) that moves every track's density at once, each by its own weight, which can be negative.
- **Chance:** each track's notes play at a chance from 1 to 100 %, so even a frozen pattern varies.
- **Drift and swing:** notes can land a little early or late by a random amount each pass (drift), or with a regular shuffle (swing), set for all tracks and for each track.
- **Per track:** pattern length (1–16 steps, so tracks can run in different lengths), FM sound, interval or pattern, rhythm, density, octave, mute, and output to the synth, USB MIDI, or both.
- **MIDI out:** each track sends its notes on its own channel (tracks 1–4 on channels 1–4).
- **Two ways to control it:** the FM-1's own knobs and keys (ARP's GEN and TRACK pages, a quick layer on ARP held, SAVE's SETUPS and POWER ON pages), and a control page in the browser that talks to the FM-1 over USB. Changes on either side show on the other.

The generator writes each track's pattern one step ahead of the playhead, so Felucca's own sequencer plays the notes and the SEQ screen shows the pattern as it is written.

See [docs/MANUAL.md](docs/MANUAL.md) for every control.

## Control page

Once Pages is on for the repository, the control page is at https://jose-no.github.io/Gen-fm1/ and the test page at https://jose-no.github.io/Gen-fm1/try/. Connect the FM-1 with USB, open the page in Chrome or Edge, and press **Connect FM-1**, or press **Virtual FM-1** to try it without one. See the manual's [Control page](docs/MANUAL.md#control-page) section.

## Installing

Open the installer at **https://jose-no.github.io/Gen-fm1/webapp/installer/** in Chrome or Edge, connect the FM-1 with a USB data cable, and press **Install**. It is Felucca's installer, unchanged, with Gen-FM1's package: it works from M-VAVE's firmware or from Felucca, and its **Return to official V15** puts M-VAVE's firmware back (download M-VAVE's FM-1.fwsc first). See the manual's [Installing](docs/MANUAL.md#installing) section.

Every push to `main` builds the package on GitHub Actions (the **build** workflow; the run's **gen-fm1-firmware** artifact). The version is in `GEN_VERSION`; a tag such as `v0.1` also makes a GitHub release. Installing other firmware on the FM-1 is at your own risk.

## Try it in the browser

The browser build is the FM-1 firmware compiled to WebAssembly, running against a simulated FM-1. Build and serve it locally:

```sh
git clone --recurse-submodules https://github.com/jose-no/Gen-fm1.git
cd Gen-fm1
pip3 install Pillow fonttools ziglang
tools/gen_headers.sh               # generated tables, fonts and samples -> build/gen
tools/emu_build_zig.sh             # the firmware -> build/emu/felucca.wasm
python3 web/emu/make_gen_page.py   # the test page -> build/genemu/
python3 web/control/make_control_page.py   # the control page -> build/control/
cd build/control && python3 -m http.server 8000
```

Then open http://localhost:8000 in Chrome or Edge and press **Connect FM-1** or **Virtual FM-1**.

## Tests

```sh
node web/emu/gen_test.mjs           # the generator
node web/emu/gen_editor_test.mjs    # its USB protocol
node web/emu/gen_ui_test.mjs        # its pages on the FM-1's screen
node web/control/gen_link_test.mjs  # the control page's link
node web/control/control_page_test.mjs build/control usb   # the control page (npm install jsdom)
node web/emu/emu_test.mjs           # Felucca's own emulator checks
tests/run_tests.sh                  # Felucca's host suite (after ./build.sh)
```

The generator test checks that it sounds, that every note stays in the scale, that MIDI note-ons and note-offs pair up on channels 1–4, that track multipliers and harmony lock change chords at the right times, that freeze with mutation at 0 repeats the bar, that every progression source makes a valid loop, and that the same settings always give the same audio.

## Building for the FM-1

The firmware builds the same way as Felucca. It needs the JieLi toolchain and three files from JieLi's AC79 SDK; see [BUILDING.md](BUILDING.md), or let GitHub Actions do it (`.github/workflows/build.yml`).

## Where the code is

| File | What |
| --- | --- |
| `firmware/src/gen.c` | The generator: harmony engine, progression sources, the four track generators, MIDI out |
| `firmware/src/gen_setup.c` | Switching it on, settings, setups and power-on |
| `firmware/src/ui_gen.c` | Its pages on the FM-1's screen and the ARP quick layer |
| `firmware/src/editor_gen.c` | Its USB SysEx protocol (see `web/EDITOR_PROTOCOL.md`) |
| `web/control/` | The control page and its link (`gen_link.js`) |
| `firmware/src/seq.c` | Felucca's sequencer, with three small hooks into the generator |
| `web/emu/gen_panel.*` | The generator's controls on the web page |
| `web/emu/make_gen_page.py` | Builds the test page from Felucca's emulator page |
| `web/emu/gen_test.mjs` | The generator's tests |
| `tools/emu_build_zig.sh` | Builds the browser version with Zig (no Emscripten needed) |

## Planned

- Modulation of the chord rate (LFO, random, rate sequences, probability)
- Scala (.scl) scale import and microtonal tuning
- MIDI in modes: play a track, transpose the generator, or reseed it
- More progression sources: borrowed chords, melody-led, MIDI-led, and a blend of two

## Credits and licence

Gen-FM1 is free software under [GPL-3.0-only](LICENSE), as Felucca is.

- **Felucca** by Leo Kuroshita (@kurogedelic), Hügelton Instruments: the firmware this builds on. Its own README is kept in [docs/FELUCCA_README.md](docs/FELUCCA_README.md), and its credits in [CREDITS.md](CREDITS.md) and [LICENSING.md](LICENSING.md).
- **X0X** by charlesvestal: the design of the browser build that Felucca's emulator follows.
- The 6-operator FM engine is msfa, Dexed's core (Apache-2.0); the engines in `firmware/engines` are MIT ([Felucca-Engines](https://github.com/hugelton/Felucca-Engines)).

M-VAVE and FM-1 are trademarks of their respective owners. Gen-FM1 is not affiliated with or endorsed by M-VAVE or Hügelton Instruments.
