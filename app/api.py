"""Backend API exposed to the webview layer.

This module contains a light-weight scaffolding for the future flashing logic.
It focuses on providing predictable method signatures and structured results
that the UI can consume. Each method currently returns mock data while the
hardware-specific functionality is implemented later.
"""
from __future__ import annotations

import shutil
import subprocess
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


@dataclass
class DeviceInfo:
    serial: str
    state: str
    model: str
    build: str
    bootloader: str
    is_rooted: bool
    android_version: Optional[str] = None
    transport: str = "usb"
    battery: Optional[Dict[str, Any]] = None
    wallpaper_hint: str = "oxygen-gradient"
    charging_icon: str = "charging"

    def asdict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class PlatformToolsStatus:
    installed: bool
    location: Optional[str]
    install_hint: str
    adb_version: Optional[str] = None
    fastboot_version: Optional[str] = None

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

    # Utility -----------------------------------------------------------
    @staticmethod
    def _run(cmd: List[str]) -> Tuple[bool, str]:
        try:
            completed = subprocess.run(
                cmd, check=False, capture_output=True, text=True
            )
        except FileNotFoundError:
            return False, ""
        output = completed.stdout.strip() or completed.stderr.strip()
        return completed.returncode == 0, output

    @staticmethod
    def _parse_battery_dump(output: str) -> Dict[str, Any]:
        battery: Dict[str, Any] = {
            "level": None,
            "status": None,
            "health": None,
            "charging": False,
            "power_save": False,
        }
        for line in output.splitlines():
            if "level" in line:
                try:
                    battery["level"] = int(line.split(":")[-1].strip())
                except ValueError:
                    continue
            if "status" in line:
                battery["status"] = line.split(":")[-1].strip()
            if "AC powered" in line or "USB powered" in line:
                battery["charging"] = "true" in line.lower() or "1" in line
            if "health" in line:
                battery["health"] = line.split(":")[-1].strip()
            if "battery_saver" in line or "power_save" in line:
                battery["power_save"] = "true" in line.lower() or "1" in line
        return battery

    @staticmethod
    def _read_prop(serial: str, prop: str) -> Optional[str]:
        ok, output = FlasherAPI._run(["adb", "-s", serial, "shell", "getprop", prop])
        return output.strip() if ok and output else None

    def _collect_device_detail(self, serial: str) -> DeviceInfo:
        build = self._read_prop(serial, "ro.build.display.id") or "Unknown build"
        model = self._read_prop(serial, "ro.product.model") or "Android Device"
        android_version = self._read_prop(serial, "ro.build.version.release")
        bootloader = self._read_prop(serial, "ro.boot.verifiedbootstate") or "unknown"
        rooted = False
        ok, su_check = self._run(["adb", "-s", serial, "shell", "which", "su"])
        if ok and su_check:
            rooted = True
        ok, battery_dump = self._run(["adb", "-s", serial, "shell", "dumpsys", "battery"])
        battery = self._parse_battery_dump(battery_dump) if battery_dump else None
        return DeviceInfo(
            serial=serial,
            state="device",
            model=model,
            build=build,
            bootloader=bootloader,
            is_rooted=rooted,
            android_version=android_version,
            battery=battery,
        )

    def _fastboot_devices(self) -> List[DeviceInfo]:
        ok, output = self._run(["fastboot", "devices"])
        if not ok or not output:
            return []
        devices: List[DeviceInfo] = []
        for line in output.splitlines():
            if not line.strip():
                continue
            parts = line.split()
            serial = parts[0]
            mode = "fastboot"
            ok_var, userspace = self._run(["fastboot", "-s", serial, "getvar", "is-userspace"])
            if ok_var and "yes" in userspace.lower():
                mode = "fastbootd"
            devices.append(
                DeviceInfo(
                    serial=serial,
                    state=mode,
                    model="Awaiting device query",
                    build="-",
                    bootloader="unlocked",
                    is_rooted=False,
                    android_version=None,
                    wallpaper_hint="fastbootd" if mode == "fastbootd" else "fastboot",
                    charging_icon="plug",
                )
            )
        return devices

    # Device discovery -------------------------------------------------
    def list_devices(self) -> List[Dict[str, Any]]:
        adb_devices: List[DeviceInfo] = []
        ok, output = self._run(["adb", "devices", "-l"])
        if ok and output:
            for line in output.splitlines():
                if line.startswith("List of devices") or not line.strip():
                    continue
                parts = line.split()
                serial = parts[0]
                state = parts[1] if len(parts) > 1 else "device"
                if state in {"device", "recovery"}:
                    info = self._collect_device_detail(serial)
                    info.state = state
                    adb_devices.append(info)
        fastboot_devices = self._fastboot_devices()
        devices = adb_devices + fastboot_devices
        if not devices:
            demo = DeviceInfo(
                serial="FAKE123456",
                state="device",
                model="OnePlus Pad 2",
                build="OxygenOS 16.0.0.201",
                bootloader="locked",
                is_rooted=False,
                android_version="15",
                battery={"level": 72, "status": "Discharging", "charging": False, "power_save": False},
                wallpaper_hint="oxygen-gradient",
                charging_icon="bolt",
            )
            devices.append(demo)
        return [device.asdict() for device in devices]

    def select_device(self, serial: str) -> Dict[str, str]:
        self.selected_device = serial
        return {"selected": serial}

    # Platform tools ---------------------------------------------------
    def platform_tools_status(self) -> Dict[str, Any]:
        adb_path = shutil.which("adb")
        fastboot_path = shutil.which("fastboot")
        ok_adb, adb_version = self._run(["adb", "version"]) if adb_path else (False, None)
        ok_fastboot, fastboot_version = (
            self._run(["fastboot", "--version"]) if fastboot_path else (False, None)
        )
        installed = bool(adb_path and fastboot_path)
        hint = (
            "brew install android-platform-tools && add /opt/homebrew/bin to PATH via ~/.zshrc"
        )
        status = PlatformToolsStatus(
            installed=installed,
            location=adb_path or fastboot_path,
            install_hint=hint,
            adb_version=adb_version.strip() if ok_adb and adb_version else None,
            fastboot_version=fastboot_version.strip() if ok_fastboot and fastboot_version else None,
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
