#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Gen-FM1: Felucca's installer page (web/make_site.py -> webapp/installer/index.html) named for Gen-FM1, in place.
The installer itself is Felucca's, unchanged: the same update, backup and return to official V15.
  tools/gen_installer_page.py SITE/webapp/installer/index.html"""
import sys
from pathlib import Path

p = Path(sys.argv[1])
s = p.read_text(encoding="utf-8")
for a, b in [
    ("<title>Felucca</title>", "<title>Gen-FM1 Installer</title>"),
    ("<h1>Felucca</h1>", "<h1>Gen-FM1</h1>"),
    ('beta: "Felucca 1.0 is a field-testing release; please report problems on GitHub.',
     'beta: "Gen-FM1 is Felucca with a generative machine added, by a different author, and not yet field-tested; please report problems on GitHub (jose-no/Gen-fm1), not to Felucca.'),
    ('editor: "Editor (after installing: edit sounds and sequences from the computer)",',
     'editor: "Felucca editor (after installing: edit sounds and sequences from the computer). The generator\'s control page: jose-no.github.io/Gen-fm1/",'),
]:
    if a not in s:
        sys.exit(f"gen_installer_page.py: not found in {p}: {a[:60]}")
    s = s.replace(a, b, 1)
p.write_text(s, encoding="utf-8")
print("installer:", p)
