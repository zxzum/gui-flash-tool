"""Filesystem locations used by the backend."""

from __future__ import annotations

from pathlib import Path


DATA_DIR = Path(__file__).resolve().parent / "data"
WALLPAPER_DIR = DATA_DIR / "wallpapers"
MEDIA_INDEX = DATA_DIR / "device_media.json"

DATA_DIR.mkdir(exist_ok=True)
WALLPAPER_DIR.mkdir(parents=True, exist_ok=True)
