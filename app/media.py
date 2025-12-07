"""Device media helpers (wallpapers, mockups)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Optional

from .paths import MEDIA_INDEX, WALLPAPER_DIR
from .utils import run


def _load_media_index() -> Dict[str, Dict[str, str]]:
    if not MEDIA_INDEX.exists():
        return {}
    try:
        return json.loads(MEDIA_INDEX.read_text())
    except Exception:
        return {}


def _save_media_index(index: Dict[str, Dict[str, str]]) -> None:
    try:
        MEDIA_INDEX.write_text(json.dumps(index, indent=2))
    except Exception:
        pass


def fallback_wallpapers(model: Optional[str]) -> List[str]:
    defaults = [
        "https://image01.oneplus.net/media/202407/09/fba6399523cbd6126ddcedb6920c9046.png?x-amz-process=image/format,webp/quality,Q_80",
        "https://image01.oneplus.net/media/202408/17/08f67608a0b45d031b6a9bb4f3bb9224.png?x-amz-process=image/format,webp/quality,Q_80",
    ]
    model_key = (model or "").lower()
    if "opd2403" in model_key or "pad 2" in model_key:
        defaults.insert(0, "https://image01.oneplus.net/media/202407/09/fba6399523cbd6126ddcedb6920c9046.png?x-amz-process=image/format,webp/quality,Q_80")
    return defaults


class MediaStore:
    def __init__(self) -> None:
        self.media_index: Dict[str, Dict[str, str]] = _load_media_index()

    def persist(self) -> None:
        _save_media_index(self.media_index)

    def wallpaper_for(self, serial: str, model: Optional[str]) -> str:
        return self.media_index.get(serial, {}).get("wallpaper") or fallback_wallpapers(model)[0]

    def rotate_mock(self, serial: str, model: Optional[str]) -> Optional[str]:
        options = fallback_wallpapers(model)
        current = self.media_index.get(serial, {}).get("wallpaper")
        if current in options:
            idx = options.index(current)
            chosen = options[(idx + 1) % len(options)]
        else:
            chosen = options[0] if options else None
        if chosen:
            self.media_index[serial] = {"wallpaper": chosen}
            self.persist()
        return chosen

    def capture_lock_wallpaper(self, serial: str) -> Optional[str]:
        dest = WALLPAPER_DIR / f"{serial}.png"
        cmds = [
            ["adb", "-s", serial, "shell", "cmd", "power", "sleep"],
            ["adb", "-s", serial, "shell", "input", "keyevent", "224"],
            ["adb", "-s", serial, "shell", "settings", "put", "system", "user_rotation", "0"],
            ["adb", "-s", serial, "shell", "settings", "put", "system", "accelerometer_rotation", "0"],
            ["adb", "-s", serial, "shell", "screencap", "-p", "/sdcard/lock.png"],
            ["adb", "-s", serial, "pull", "/sdcard/lock.png", str(dest)],
            ["adb", "-s", serial, "shell", "settings", "put", "system", "accelerometer_rotation", "1"],
        ]
        for cmd in cmds:
            run(cmd)
        if dest.exists():
            self.media_index[serial] = {"wallpaper": str(dest)}
            self.persist()
            return str(dest)
        return None

    def refresh_wallpaper(self, serial: str, model: Optional[str]) -> Optional[str]:
        local = self.capture_lock_wallpaper(serial)
        chosen = local or self.rotate_mock(serial, model) or fallback_wallpapers(model)[0]
        if chosen:
            self.media_index[serial] = {"wallpaper": chosen}
            self.persist()
        return chosen
