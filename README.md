# OnePlus Pad 2 Universal Flasher (design scaffold)

A Mac-first GUI concept for flashing OxygenOS/ColorOS payloads on the OnePlus Pad 2.
The application pairs **pywebview** (Python backend) with a **Preact** UI to provide a modern,
resilient flashing experience: device discovery, firmware validation, fastbootd orchestration,
scrcpy mirroring, and root tooling in one place.

> This repository currently ships a design-forward scaffold with mocked backend responses.
> Flashing, adb, fastboot, and rooting flows are stubbed for future wiring.

## Getting started

1. **Install Python deps** (only `pywebview` is required for the preview):

   ```bash
   python -m pip install --upgrade pywebview
   ```

2. **Build everything with one command** (runs npm install + Vite build, then starts pywebview):

   ```bash
   make run
   ```

   The helper `Makefile` installs front-end deps into `frontend/node_modules`, produces the
   `frontend/dist` bundle with a relative base (no manual HTML edits), and boots the Python
   window.

   You can still run steps manually if you prefer:

   ```bash
   cd frontend && npm install && npm run build
   cd .. && python -m app.main
   ```

   The window prefers the built bundle in `frontend/dist/index.html` and falls back to the root
   `frontend/index.html` when the build artifacts are missing. On macOS, pywebview will use the
   built-in WKWebView engine.

4. **Front-end**

   The UI ships as a Vite-built Preact single-page app (`frontend/src`). Use `npm run dev` for
   hot reloads during design tweaks or `npm run build` for production bundles consumed by pywebview.

## Project layout

- `app/` — Python backend scaffolding exposed to pywebview.
  - `api.py` — structured method stubs for device detection, flashing, scrcpy, and root tools.
  - `main.py` — launches the pywebview window and wires the JS API.
- `frontend/` — Vite + Preact UI with an OxygenOS-inspired aesthetic.
  - `src/` — components, styling, and pywebview bridge calls.
  - `package.json`, `vite.config.js` — build + dev server setup.

## Roadmap hooks (already surfaced in UI)

- Platform-tools detection with Homebrew + `~/.zshrc` guidance when missing.
- Firmware integrity checks (archives or partition sets) with progress logging.
- Fastbootd automation with fallbacks for `super.img` and discrete partitions.
- scrcpy launch/stop controls with mirrored status.
- Root toolkit pipeline (Magisk/Magisk Delta/KernelSU + LSPosed/LuckyTools modules).
- Diagnostics tab for storage, thermals, battery, and verified-boot signals.

## macOS portability notes

- The design targets Apple Silicon Macs; pywebview will automatically use WKWebView.
- Platform-tools installation hint defaults to Homebrew (`brew install android-platform-tools`).
- Keep the `frontend` directory next to `app` when distributing portable builds.
