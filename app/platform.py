"""Platform tools detection helpers."""

from __future__ import annotations

import shutil
from dataclasses import dataclass, asdict
from typing import Any, Dict, Optional

from .utils import run


@dataclass
class PlatformToolsStatus:
    installed: bool
    location: Optional[str]
    install_hint: str
    adb_version: Optional[str] = None
    fastboot_version: Optional[str] = None

    def asdict(self) -> Dict[str, Any]:
        return asdict(self)


def platform_tools_status() -> Dict[str, Any]:
    adb_path = shutil.which("adb")
    fastboot_path = shutil.which("fastboot")
    ok_adb, adb_version = run(["adb", "version"]) if adb_path else (False, None)
    ok_fastboot, fastboot_version = run(["fastboot", "--version"]) if fastboot_path else (False, None)
    installed = bool(adb_path and fastboot_path)
    hint = "brew install android-platform-tools && add /opt/homebrew/bin to PATH via ~/.zshrc"
    status = PlatformToolsStatus(
        installed=installed,
        location=adb_path or fastboot_path,
        install_hint=hint,
        adb_version=adb_version.strip() if ok_adb and adb_version else None,
        fastboot_version=fastboot_version.strip() if ok_fastboot and fastboot_version else None,
    )
    return status.asdict()
