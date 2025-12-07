"""Backend API exposed to the webview layer.

This module contains a light-weight scaffolding for the future flashing logic.
It focuses on providing predictable method signatures and structured results
that the UI can consume. Each method currently returns mock data while the
hardware-specific functionality is implemented later.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, List, Optional


@dataclass
class DeviceInfo:
    serial: str
    state: str
    model: str
    build: str
    bootloader: str
    is_rooted: bool
    transport: str = "usb"

    def asdict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class PlatformToolsStatus:
    installed: bool
    location: Optional[str]
    install_hint: str

    def asdict(self) -> Dict[str, Any]:
        return asdict(self)


class FlasherAPI:
    """Expose all backend capabilities to the web UI.

    Methods should remain asynchronous-friendly. pywebview will coerce
    return values into JSON, so prefer primitives or mappings. Every method
    returns structured data with explicit keys to simplify the front-end
    data handling.
    """

    def __init__(self) -> None:
        self.firmware_path: Optional[Path] = None
        self.selected_device: Optional[str] = None

    # Device discovery -------------------------------------------------
    def list_devices(self) -> List[Dict[str, Any]]:
        """Return mock devices until adb integration is wired."""
        demo_devices = [
            DeviceInfo(
                serial="FAKE123456",
                state="device",
                model="OnePlus Pad 2",
                build="OxygenOS 16.0.0.201",
                bootloader="locked",
                is_rooted=False,
                transport="usb",
            ),
            DeviceInfo(
                serial="FAKEEMU001",
                state="recovery",
                model="Emulated Device",
                build="developer-preview",
                bootloader="unlocked",
                is_rooted=True,
                transport="tcp",
            ),
        ]
        return [device.asdict() for device in demo_devices]

    def select_device(self, serial: str) -> Dict[str, str]:
        self.selected_device = serial
        return {"selected": serial}

    # Platform tools ---------------------------------------------------
    def platform_tools_status(self) -> Dict[str, Any]:
        """Stub that reports missing platform-tools on macOS systems."""
        status = PlatformToolsStatus(
            installed=False,
            location=None,
            install_hint="brew install android-platform-tools"
            " && ensure adb/fastboot are on PATH in ~/.zshrc",
        )
        return status.asdict()

    # Firmware handling -----------------------------------------------
    def set_firmware_path(self, path: str) -> Dict[str, Any]:
        self.firmware_path = Path(path)
        return {"path": str(self.firmware_path), "exists": self.firmware_path.exists()}

    def validate_firmware(self) -> Dict[str, Any]:
        """Placeholder validation result."""
        return {
            "path": str(self.firmware_path) if self.firmware_path else None,
            "is_valid": bool(self.firmware_path and self.firmware_path.exists()),
            "message": "Validation routine not yet implemented.",
        }

    # Flashing ---------------------------------------------------------
    def flash(self) -> Dict[str, str]:
        return {
            "status": "queued",
            "message": "Flashing pipeline scaffolding ready.",
            "device": self.selected_device,
        }

    # Scrcpy -----------------------------------------------------------
    def start_scrcpy(self) -> Dict[str, str]:
        return {"status": "pending", "message": "Scrcpy start stub."}

    def stop_scrcpy(self) -> Dict[str, str]:
        return {"status": "pending", "message": "Scrcpy stop stub."}

    # Root tools -------------------------------------------------------
    def list_root_tools(self) -> List[Dict[str, str]]:
        return [
            {"name": "Magisk", "channel": "stable", "status": "available"},
            {"name": "Magisk Delta", "channel": "beta", "status": "available"},
            {"name": "KernelSU", "channel": "stable", "status": "available"},
            {"name": "LSPosed", "channel": "stable", "status": "available"},
            {"name": "LuckyTools", "channel": "community", "status": "available"},
        ]

    def prepare_root(self, tool: str) -> Dict[str, str]:
        return {"status": "pending", "tool": tool, "message": "Download and sideload stub."}

    # Diagnostics ------------------------------------------------------
    def diagnostics(self) -> Dict[str, Any]:
        return {
            "storage": "128GB / 512GB free",
            "battery": "72%",
            "thermals": "Nominal",
            "safety": {
                "verified_boot": False,
                "vaultkeeper": "unknown",
                "bootloader": "locked",
            },
        }

    # Lifecycle --------------------------------------------------------
    def on_start(self, window: Any) -> None:
        """Hook invoked by pywebview once the GUI is ready."""
        self.selected_device = None

