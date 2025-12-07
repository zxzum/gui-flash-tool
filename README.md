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

2. **Launch the UI preview**:

   ```bash
   python -m app.main
   ```

   The window renders the `frontend/index.html` bundle directly. On macOS, pywebview will use
   the built-in WKWebView engine.

3. **Front-end**

   The UI uses CDN-hosted Preact + htm. If you prefer a local build toolchain, replace
   `frontend/main.js` with a Vite/Vue/Preact build and point `index.html` to the compiled assets.

## Project layout

- `app/` — Python backend scaffolding exposed to pywebview.
  - `api.py` — structured method stubs for device detection, flashing, scrcpy, and root tools.
  - `main.py` — launches the pywebview window and wires the JS API.
- `frontend/` — static Preact UI with an OxygenOS-inspired aesthetic.
  - `index.html`, `styles.css`, `main.js`.

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
