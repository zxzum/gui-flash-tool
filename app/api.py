"""Backend API exposed to the webview layer."""

from __future__ import annotations

from typing import Any, Dict, List

from .device import DeviceManager
from .firmware import FirmwareManager
from .media import MediaStore
from .platform import platform_tools_status


class FlasherAPI:
    """Expose all backend capabilities to the web UI."""

    def __init__(self) -> None:
        self.media = MediaStore()
        self.devices = DeviceManager(self.media)
        self.firmware = FirmwareManager()
        self.selected_device: str | None = None

    # Device discovery -------------------------------------------------
    def list_devices(self) -> List[Dict[str, Any]]:
        devices = self.devices.list_devices()
        if len(devices) == 1:
            self.selected_device = devices[0].get("serial")
        return devices

    def select_device(self, serial: str) -> Dict[str, str]:
        self.selected_device = serial
        return {"selected": serial}

    def refresh_wallpaper(self, serial: str, model: str | None = None) -> Dict[str, Any]:
        chosen = self.media.refresh_wallpaper(serial, model)
        if chosen:
            self.devices.cache_update_wallpaper(serial, chosen)
        return {"wallpaper": chosen}

    def rotate_mock_image(self, serial: str, model: str | None = None) -> Dict[str, Any]:
        chosen = self.media.rotate_mock(serial, model)
        if chosen:
            self.devices.cache_update_wallpaper(serial, chosen)
        return {"wallpaper": chosen}

    # Platform tools ---------------------------------------------------
    def platform_tools_status(self) -> Dict[str, Any]:
        return platform_tools_status()

    # Firmware handling -----------------------------------------------
    def set_firmware_path(self, path: str) -> Dict[str, Any]:
        return self.firmware.set_path(path)

    def inspect_firmware_tree(self, max_depth: int = 2, max_entries: int = 120) -> Dict[str, Any]:
        return self.firmware.inspect_tree(max_depth=max_depth, max_entries=max_entries)

    def validate_firmware(self) -> Dict[str, Any]:
        return self.firmware.validate()

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
        serial = self.selected_device or next(iter(self.devices.device_cache.keys()), None)
        device = self.devices.device_cache.get(serial)
        storage_summary = device.storage.get("summary") if device and device.storage else "—"
        battery = device.battery if device else None
        battery_summary = None
        if battery:
            level = battery.get("level")
            state = battery.get("capacity_label") or battery.get("capacity_state")
            battery_summary = f"{level}% ({state})" if level is not None else str(state)
        safety = {
            "verified_boot": device.bootloader if device else "unknown",
            "vaultkeeper": "unknown",
            "bootloader": device.bootloader if device else "unknown",
        }
        kernel = device.kernel if device else None
        return {
            "storage": storage_summary,
            "battery": battery_summary or "—",
            "thermals": "Nominal",
            "kernel": kernel,
            "soc": device.soc if device else None,
            "safety": safety,
        }

    # Lifecycle --------------------------------------------------------
    def on_start(self, window: Any) -> None:
        self.selected_device = None

