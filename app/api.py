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
    wallpaper_url: Optional[str] = None
    firmware_version: Optional[str] = None
    sdk_version: Optional[str] = None
    soc: Optional[Dict[str, Any]] = None
    kernel: Optional[Dict[str, str]] = None
    storage: Optional[Dict[str, Any]] = None

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
        self.device_cache: Dict[str, DeviceInfo] = {}

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
            "capacity_raw": None,
            "capacity_state": None,
            "capacity_label": None,
            "status": None,
            "health": None,
            "charging": False,
            "power_save": False,
        }
        capacity_map = {
            0: "UNKNOWN",
            1: "CRITICAL",
            2: "LOW",
            3: "NORMAL",
            4: "HIGH",
        }
        for line in output.splitlines():
            normalized = line.strip()
            if normalized.lower().startswith("level"):
                try:
                    battery["level"] = int(normalized.split(":")[-1].strip())
                except ValueError:
                    continue
            if normalized.lower().startswith("capacity level"):
                try:
                    raw = int(normalized.split(":")[-1].strip())
                    battery["capacity_raw"] = raw
                    battery["capacity_state"] = raw
                    battery["capacity_label"] = capacity_map.get(raw)
                except ValueError:
                    continue
            if normalized.lower().startswith("status"):
                battery["status"] = normalized.split(":")[-1].strip()
            if "ac powered" in normalized.lower() or "usb powered" in normalized.lower():
                battery["charging"] = "true" in normalized.lower() or "1" in normalized
            if "health" in normalized.lower():
                battery["health"] = normalized.split(":")[-1].strip()
            if "battery_saver" in normalized.lower() or "power_save" in normalized.lower():
                battery["power_save"] = "true" in normalized.lower() or "1" in normalized
        return battery

    @staticmethod
    def _read_prop(serial: str, prop: str) -> Optional[str]:
        ok, output = FlasherAPI._run(["adb", "-s", serial, "shell", "getprop", prop])
        return output.strip() if ok and output else None

    def _collect_device_detail(self, serial: str) -> DeviceInfo:
        build = self._read_prop(serial, "ro.build.display.id") or "Unknown build"
        firmware_version = build.split()[0] if build else None
        model = self._read_prop(serial, "ro.product.model") or "Android Device"
        android_version = self._read_prop(serial, "ro.build.version.release")
        sdk_version = self._read_prop(serial, "ro.build.version.sdk")
        bootloader = self._read_prop(serial, "ro.boot.verifiedbootstate") or "unknown"
        rooted = False
        ok, su_check = self._run(["adb", "-s", serial, "shell", "which", "su"])
        if ok and su_check:
            ok_root, su_id = self._run(["adb", "-s", serial, "shell", "su", "-c", "id"])
            rooted = ok_root and "uid=0" in su_id
        ok, battery_dump = self._run(["adb", "-s", serial, "shell", "dumpsys", "battery"])
        battery = self._parse_battery_dump(battery_dump) if battery_dump else None

        soc_vendor = self._read_prop(serial, "ro.soc.manufacturer")
        soc_model = self._read_prop(serial, "ro.soc.model")
        platform = self._read_prop(serial, "ro.board.platform")
        cpuinfo = None
        ok_cpu, cpu_dump = self._run(["adb", "-s", serial, "shell", "cat", "/proc/cpuinfo"])
        if ok_cpu and cpu_dump:
            cpuinfo = "\n".join(cpu_dump.splitlines()[:20])
        soc = None
        if any([soc_vendor, soc_model, platform, cpuinfo]):
            soc = {
                "vendor": soc_vendor,
                "model": soc_model,
                "platform": platform,
                "codename": platform,
                "friendly": "Snapdragon 8 Gen 3 (SM8650)" if (soc_model == "SM8650" or platform == "pineapple") else None,
                "cpuinfo": cpuinfo,
            }

        ok_kernel, kernel_release = self._run(["adb", "-s", serial, "shell", "uname", "-r"])
        kernel_full = None
        if ok_kernel and kernel_release:
            ok_full, full_desc = self._run(["adb", "-s", serial, "shell", "cat", "/proc/version"])
            kernel_full = full_desc if ok_full else None
        kernel = None
        if kernel_release or kernel_full:
            kernel = {"release": kernel_release.strip() if kernel_release else None, "full": kernel_full}

        storage = None
        ok_df, df_out = self._run(["adb", "-s", serial, "shell", "df", "-h", "/data"])
        if ok_df and df_out:
            storage = self._parse_storage(df_out)

        return DeviceInfo(
            serial=serial,
            state="device",
            model=model,
            build=build,
            firmware_version=firmware_version,
            bootloader=bootloader,
            is_rooted=rooted,
            android_version=android_version,
            sdk_version=sdk_version,
            battery=battery,
            soc=soc,
            kernel=kernel,
            storage=storage,
            wallpaper_url="https://image01.oneplus.net/media/202407/09/fba6399523cbd6126ddcedb6920c9046.png?x-amz-process=image/format,webp/quality,Q_80",
        )

    @staticmethod
    def _parse_storage(df_output: str) -> Dict[str, Any]:
        lines = [line for line in df_output.splitlines() if line.strip() and not line.startswith("Filesystem")]
        if not lines:
            return {}
        parts = lines[0].split()
        if len(parts) < 6:
            return {}

        def _to_gb(value: str) -> Optional[float]:
            try:
                if value.lower().endswith("g"):
                    return float(value[:-1])
                if value.lower().endswith("m"):
                    return round(float(value[:-1]) / 1024, 2)
                return float(value)
            except ValueError:
                return None

        size = _to_gb(parts[1])
        used = _to_gb(parts[2])
        avail = _to_gb(parts[3])
        usage = parts[4] if len(parts) > 4 else None

        nominal_sizes = [64, 128, 256, 512, 1024]
        nominal = None
        if size:
            nominal = min(nominal_sizes, key=lambda n: abs(n - size))
        recalculated_used = None
        if nominal and size and used is not None:
            recalculated_used = round((used / size) * nominal, 1)

        return {
            "raw": {"size_gb": size, "used_gb": used, "avail_gb": avail, "usage": usage},
            "nominal_total_gb": nominal,
            "normalized_used_gb": recalculated_used,
            "summary": f"{recalculated_used or used or '—'}/{nominal or size or '—'}",
        }

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
                    wallpaper_url="https://image01.oneplus.net/media/202407/09/fba6399523cbd6126ddcedb6920c9046.png?x-amz-process=image/format,webp/quality,Q_80",
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
                    self.device_cache[serial] = info
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
                firmware_version="OPD2403_16.0.0.201",
                sdk_version="34",
                battery={"level": 72, "status": "Discharging", "charging": False, "power_save": False},
                wallpaper_hint="oxygen-gradient",
                charging_icon="bolt",
                wallpaper_url="https://image01.oneplus.net/media/202407/09/fba6399523cbd6126ddcedb6920c9046.png?x-amz-process=image/format,webp/quality,Q_80",
                storage={"summary": "49.2/256"},
            )
            devices.append(demo)
            self.device_cache[demo.serial] = demo
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
        serial = self.selected_device or next(iter(self.device_cache.keys()), None)
        device = self.device_cache.get(serial)
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
        """Hook invoked by pywebview once the GUI is ready."""
        self.selected_device = None
