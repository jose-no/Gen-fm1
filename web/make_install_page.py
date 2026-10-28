#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Gen-FM1's web installer: Felucca's installer page (web/make_site.py, index_pkg.html) around Gen-FM1's own
package, named Gen-FM1, placed into the GitHub Pages site next to the control page.

  web/make_install_page.py build/felucca.fwsc VERSION SITE_DIR

Writes SITE_DIR/webapp/installer/ (the installer), SITE_DIR/webapp/editor/, SITE_DIR/firmware/ (the package and
its licences) and SITE_DIR/install/ (a short address that opens the installer). SITE_DIR/index.html (the control
page) is left as it is.
"""
import shutil
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import make_site  # noqa: E402

# what the installer page says, Felucca's words -> Gen-FM1's (each must be found once or more)
RENAME = [
    ("<title>Felucca</title>", "<title>Install Gen-FM1</title>"),
    ("<h1>Felucca</h1>", "<h1>Gen-FM1</h1>"),
    ("say(`Felucca ${meta.version}`);", "say(`Gen-FM1 ${meta.version}`);"),
    ("Felucca 1.0 is a field-testing release; please report problems on GitHub.",
     "Gen-FM1 is Felucca with a generative machine, not yet tested on many FM-1s; please report problems on "
     "github.com/Jose-no/Gen-fm1."),
    ("Felucca 1.0 は実地テスト版です。不具合は GitHub で知らせてください。",
     "Gen-FM1 は Felucca に生成機能を加えたもので、実機でのテストはまだ多くありません。不具合は github.com/Jose-no/Gen-fm1 で知らせてください。"),
]


def main(pkg, version, site):
    site = Path(site)
    with tempfile.TemporaryDirectory() as tmp:
        make_site.main(pkg, version, tmp)
        page = Path(tmp) / "webapp" / "installer" / "index.html"
        html = page.read_text(encoding="utf-8")
        for old, new in RENAME:
            if old not in html:
                raise SystemExit(f"make_install_page: {old!r} is no longer in the installer page; update RENAME")
            html = html.replace(old, new)
        page.write_text(html, encoding="utf-8")
        for part in ("webapp", "firmware"):
            if (site / part).exists():
                shutil.rmtree(site / part)
            shutil.copytree(Path(tmp) / part, site / part)
    (site / "install").mkdir(parents=True, exist_ok=True)
    (site / "install" / "index.html").write_text(
        '<!doctype html><meta charset="utf-8"><title>Install Gen-FM1</title>'
        '<meta http-equiv="refresh" content="0; url=../webapp/installer/">'
        '<a href="../webapp/installer/">Install Gen-FM1</a>\n', encoding="utf-8")
    print(f"installer: {site}/webapp/installer/ (and {site}/install/), package {version}")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    main(*sys.argv[1:4])
