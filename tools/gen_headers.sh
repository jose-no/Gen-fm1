#!/bin/sh
# The generated headers (tables, fonts, icons, FM6 patches, samples) into build/gen, as tools/build.py makes them,
# without the JieLi toolchain: enough for the browser build (tools/emu_build_zig.sh) and the host tests.
set -e
cd "$(dirname "$0")/.."
mkdir -p build/gen
python3 tools/gen_aa_font.py build/gen/ui_fonts.h --preset inter-tight
python3 tools/gen_aa_icons.py build/gen/ui_icons.h
python3 tools/gen_aa_keycaps.py build/gen/ui_keycaps.h
python3 tools/gen_ui_palettes.py build/gen/ui_palettes.h
python3 tools/gen_tables.py build/gen/felucca_tables.h
python3 tools/gen_fm6_patches.py build/gen/felucca_fm6.h
python3 tools/gen_samples.py build/gen/felucca_samples.h
echo "gen: build/gen"
