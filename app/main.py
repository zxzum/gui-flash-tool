"""GUI bootstrapper for the OnePlus Pad 2 flasher.

This script launches a pywebview window that renders the Preact-based UI.
It is intentionally Mac-focused and keeps the runtime portable: the only
Python dependency is pywebview. The front-end assets are served from the
`frontend` directory in this repository.
"""
from __future__ import annotations

import sys
from pathlib import Path

import webview

from .api import FlasherAPI


def main() -> None:
    assets_dir = Path(__file__).resolve().parent.parent / "frontend"
    index_file = assets_dir / "index.html"

    if not index_file.exists():
        raise SystemExit("Front-end bundle missing. Run npm build or keep frontend/index.html in place.")

    api = FlasherAPI()
    window = webview.create_window(
        "OnePlus Pad 2 Universal Flasher",
        index_file.as_uri(),
        width=1280,
        height=800,
        resizable=True,
        text_select=True,
        js_api=api,
    )

    # Start the GUI loop. api.on_start will receive the window once ready.
    webview.start(api.on_start, window)


if __name__ == "__main__":
    sys.exit(main())
