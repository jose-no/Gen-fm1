# Gen-FM1

A generative chord and melody machine for the M-VAVE FM-1 pocket synthesizer: four tracks, each with its own 6-operator FM synth and its own USB MIDI channel, driven by one shared harmony engine.

- **Dyad A and Dyad B:** two-note chord tracks.
- **Bass:** a mono bass line that follows the chords.
- **Melody:** a mono melody built from chord and scale tones.

Gen-FM1 is a fork of [Felucca](https://github.com/hugelton/Felucca) by Leo Kuroshita (Hügelton Instruments). Felucca supplies the hardware layer, the FM engine, the sequencer, the screen and the browser emulator. Gen-FM1 adds the generator on top.

> **Status: proof of concept.** The generator runs in the browser emulator and passes its tests. It has not been flashed to a real FM-1 yet, and it has no controls on the FM-1's own screen yet: it is switched on and set from the web page.

## What it does

- **Harmony:** pick a key and a scale (16 built in, or your own), and a progression source: fixed, random walk, weighted rules, functional harmony, circle of fifths, voice-leading, pendulum, or pedal. The progression is a loop of 2 to 8 chords.
- **Chord timing:** a master rate from ½ bar to 32 bars. Each track walks the progression at the master rate times its own multiplier (×¼ to ×8), or follows the master chord exactly with harmony lock.
- **Mutation:** one control for how much the patterns and progression change from pass to pass. At 0 every track repeats its bar, re-voiced onto each new chord. Freeze stops a track changing at all.
- **Density modulation:** each track's density can move by itself with a sine, triangle, ramp, square, random or drifting shape, synced from ¼ bar to 32 bars.
- **Per track:** pattern length (1–16 steps, so tracks can run in different lengths), FM sound, interval or pattern, rhythm, density, octave, mute, and output to the synth, USB MIDI, or both.
- **MIDI out:** each track sends its notes on its own channel (tracks 1–4 on channels 1–4).

The generator writes each track's pattern one step ahead of the playhead, so Felucca's own sequencer plays the notes and the SEQ screen shows the pattern as it is written.

See [docs/MANUAL.md](docs/MANUAL.md) for every control.

## Try it in the browser

The browser build is the FM-1 firmware compiled to WebAssembly, running against a simulated FM-1. Build and serve it locally:

```sh
git clone --recurse-submodules https://github.com/jose-no/Gen-fm1.git
cd Gen-fm1
pip3 install Pillow fonttools ziglang
tools/gen_headers.sh               # generated tables, fonts and samples -> build/gen
tools/emu_build_zig.sh             # the firmware -> build/emu/felucca.wasm
python3 web/emu/make_gen_page.py   # the page -> build/genemu/
cd build/genemu && python3 -m http.server 8000
```

Then open http://localhost:8000 in Chrome, Edge, Firefox or Safari, press **Switch on**, turn the generator **On** and press **Play**.

## Tests

```sh
node web/emu/gen_test.mjs build/emu/felucca.wasm   # the generator
node web/emu/emu_test.mjs build/emu/felucca.wasm   # Felucca's own emulator checks
```

The generator test checks that it sounds, that every note stays in the scale, that MIDI note-ons and note-offs pair up on channels 1–4, that track multipliers and harmony lock change chords at the right times, that freeze with mutation at 0 repeats the bar, that every progression source makes a valid loop, and that the same settings always give the same audio.

## Building for the FM-1

The firmware builds the same way as Felucca. It needs the JieLi toolchain and three files from JieLi's AC79 SDK; see [BUILDING.md](BUILDING.md). Installing other firmware on the FM-1 is at your own risk. Felucca's web installer can put M-VAVE's firmware back.

## Where the code is

| File | What |
| --- | --- |
| `firmware/src/gen.c` | The generator: harmony engine, progression sources, the four track generators, MIDI out |
| `firmware/src/gen_setup.c` | Switching it on and changing settings |
| `firmware/src/seq.c` | Felucca's sequencer, with three small hooks into the generator |
| `web/emu/gen_panel.*` | The generator's controls on the web page |
| `web/emu/make_gen_page.py` | Builds the test page from Felucca's emulator page |
| `web/emu/gen_test.mjs` | The generator's tests |
| `tools/emu_build_zig.sh` | Builds the browser version with Zig (no Emscripten needed) |

## Planned

- Controls on the FM-1's own screen and knobs
- Modulation of the chord rate (LFO, random, rate sequences, probability), and MIDI CC control of the density mod
- Scala (.scl) scale import and microtonal tuning
- MIDI in modes: play a track, transpose the generator, or reseed it
- More progression sources: borrowed chords, melody-led, MIDI-led, and a blend of two

## Credits and licence

Gen-FM1 is free software under [GPL-3.0-only](LICENSE), as Felucca is.

- **Felucca** by Leo Kuroshita (@kurogedelic), Hügelton Instruments: the firmware this builds on. Its own README is kept in [docs/FELUCCA_README.md](docs/FELUCCA_README.md), and its credits in [CREDITS.md](CREDITS.md) and [LICENSING.md](LICENSING.md).
- **X0X** by charlesvestal: the design of the browser build that Felucca's emulator follows.
- The 6-operator FM engine is msfa, Dexed's core (Apache-2.0); the engines in `firmware/engines` are MIT ([Felucca-Engines](https://github.com/hugelton/Felucca-Engines)).

M-VAVE and FM-1 are trademarks of their respective owners. Gen-FM1 is not affiliated with or endorsed by M-VAVE or Hügelton Instruments.
