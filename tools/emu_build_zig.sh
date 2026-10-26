#!/bin/sh
# Build the browser emulator with Zig's wasm32-wasi toolchain (no Emscripten needed)
set -e
cd "$(dirname "$0")/.."
VERSION=$(sed -n 's/^#define FELUCCA_VERSION "\([^"]*\)".*/\1/p' firmware/src/felucca.c | head -n 1)
mkdir -p build/emu/fonts
python3 -m ziglang cc -target wasm32-wasi -mexec-model=reactor ${EMU_OPT:--O2} -ffp-contract=off -std=gnu99 -w \
  "-DFELUCCA_VERSION=\"$VERSION\"" ${EMU_CFLAGS:-} -Itools/wasi-shim -Ibuild/gen -Ifirmware/src \
  -Wl,--gc-sections -Wl,--export-dynamic -Wl,-z,stack-size=1048576 -Wl,--initial-memory=33554432 \
  -o build/emu/felucca.wasm ${EMU_SRC:-web/emu/felucca_web.c}
sed -e "s/@VERSION@/$VERSION/g" -e "s/@PREVIEW@/ (preview)/g" web/emu/index.html > build/emu/index.html
cp web/emu/worklet.js build/emu/
cp web/emu/fonts/DotGothic16-subset.woff web/emu/fonts/OFL.txt build/emu/fonts/ 2>/dev/null || true
echo "emu: $(wc -c < build/emu/felucca.wasm) B"
