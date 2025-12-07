"""Backend API exposed to the webview layer.

This module contains a light-weight scaffolding for the future flashing logic.
It focuses on providing predictable method signatures and structured results
that the UI can consume. Each method currently returns mock data while the
hardware-specific functionality is implemented later.
"""
from __future__ import annotations

import shutil
import subprocess
import json
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
    model_code: Optional[str] = None
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

    DATA_DIR = Path(__file__).resolve().parent / "data"
    WALLPAPER_DIR = DATA_DIR / "wallpapers"
    MEDIA_INDEX = DATA_DIR / "device_media.json"

    def __init__(self) -> None:
        self.firmware_path: Optional[Path] = None
        self.selected_device: Optional[str] = None
        self.device_cache: Dict[str, DeviceInfo] = {}
        self.DATA_DIR.mkdir(exist_ok=True)
        self.WALLPAPER_DIR.mkdir(parents=True, exist_ok=True)
        self.media_index: Dict[str, Dict[str, str]] = self._load_media_index()

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
    def _parse_usage_percent(value: str) -> Optional[float]:
        try:
            return float(value.strip().replace("%", ""))
        except ValueError:
            return None

    def _load_media_index(self) -> Dict[str, Dict[str, str]]:
        if not self.MEDIA_INDEX.exists():
            return {}
        try:
            return json.loads(self.MEDIA_INDEX.read_text())
        except Exception:
            return {}

    def _save_media_index(self) -> None:
        try:
            self.MEDIA_INDEX.write_text(json.dumps(self.media_index, indent=2))
        except Exception:
            pass

    @staticmethod
    def _read_prop(serial: str, prop: str) -> Optional[str]:
        ok, output = FlasherAPI._run(["adb", "-s", serial, "shell", "getprop", prop])
        return output.strip() if ok and output else None

    def _collect_device_detail(self, serial: str) -> DeviceInfo:
        build = self._read_prop(serial, "ro.build.display.id") or "Unknown build"
        firmware_version = build.split()[0] if build else None
        if firmware_version and "_" in firmware_version:
            parts = firmware_version.split("_", 1)
            if len(parts) == 2:
                firmware_version = parts[1]
        model = self._read_prop(serial, "ro.product.model") or "Android Device"
        model_code = model if model and model.startswith("OP") else None
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

        wallpaper_url = self.media_index.get(serial, {}).get("wallpaper")
        if not wallpaper_url:
            wallpaper_url = "https://image01.oneplus.net/media/202407/09/fba6399523cbd6126ddcedb6920c9046.png?x-amz-process=image/format,webp/quality,Q_80"

        return DeviceInfo(
            serial=serial,
            state="device",
            model=model,
            build=build,
            firmware_version=firmware_version,
            model_code=model_code,
            bootloader=bootloader,
            is_rooted=rooted,
            android_version=android_version,
            sdk_version=sdk_version,
            battery=battery,
            soc=soc,
            kernel=kernel,
            storage=storage,
            wallpaper_url=wallpaper_url,
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
        if nominal and usage:
            usage_pct = self._parse_usage_percent(usage)
            if usage_pct is not None:
                recalculated_used = round((nominal * usage_pct) / 100, 1)
        if recalculated_used is None and nominal and size and used is not None:
            recalculated_used = round((used / size) * nominal, 1)
        if recalculated_used is None and nominal and avail is not None:
            recalculated_used = round(max(nominal - avail, 0), 1)

        return {
            "raw": {"size_gb": size, "used_gb": used, "avail_gb": avail, "usage": usage},
            "nominal_total_gb": nominal,
            "normalized_used_gb": recalculated_used,
            "summary": f"{recalculated_used or used or '—'}/{nominal or size or '—'}",
        }

    # Media helpers ----------------------------------------------------
    def _capture_lock_wallpaper(self, serial: str) -> Optional[str]:
        dest = self.WALLPAPER_DIR / f"{serial}.png"
        cmds = [
            ["adb", "-s", serial, "shell", "cmd", "power", "sleep"],
            ["adb", "-s", serial, "shell", "input", "keyevent", "224"],
            ["adb", "-s", serial, "shell", "settings", "put", "system", "user_rotation", "0"],
            ["adb", "-s", serial, "shell", "settings", "put", "system", "accelerometer_rotation", "0"],
            ["adb", "-s", serial, "shell", "screencap", "-p", "/sdcard/lock.png"],
            ["adb", "-s", serial, "pull", "/sdcard/lock.png", str(dest)],
            ["adb", "-s", serial, "shell", "settings", "put", "system", "accelerometer_rotation", "1"],
        ]
        success = False
        for cmd in cmds:
            ok, _ = self._run(cmd)
            success = success or (ok and dest.exists())
        if dest.exists():
            return str(dest)
        return None

    @staticmethod
    def _fallback_wallpapers(model: Optional[str]) -> List[str]:
        defaults = [
            "https://image01.oneplus.net/media/202407/09/fba6399523cbd6126ddcedb6920c9046.png?x-amz-process=image/format,webp/quality,Q_80",
            "https://image01.oneplus.net/media/202408/17/08f67608a0b45d031b6a9bb4f3bb9224.png?x-amz-process=image/format,webp/quality,Q_80",
        ]
        model_key = (model or "").lower()
        if "opd2403" in model_key or "pad 2" in model_key:
            defaults.insert(0, "https://image01.oneplus.net/media/202407/09/fba6399523cbd6126ddcedb6920c9046.png?x-amz-process=image/format,webp/quality,Q_80")
        return defaults

    def refresh_wallpaper(self, serial: str, model: Optional[str] = None) -> Dict[str, Any]:
        local_capture = self._capture_lock_wallpaper(serial)
        chosen = local_capture
        if not chosen:
            fallbacks = self._fallback_wallpapers(model)
            for candidate in fallbacks:
                chosen = candidate
                break
        if chosen:
            self.media_index[serial] = {"wallpaper": chosen}
            self._save_media_index()
            if serial in self.device_cache:
                self.device_cache[serial].wallpaper_url = chosen
        return {"wallpaper": chosen}

    def rotate_mock_image(self, serial: str, model: Optional[str] = None) -> Dict[str, Any]:
        options = self._fallback_wallpapers(model)
        current = self.media_index.get(serial, {}).get("wallpaper")
        if current in options:
            idx = options.index(current)
            chosen = options[(idx + 1) % len(options)]
        else:
            chosen = options[0] if options else None
        if chosen:
            self.media_index[serial] = {"wallpaper": chosen}
            self._save_media_index()
            if serial in self.device_cache:
                self.device_cache[serial].wallpaper_url = chosen
        return {"wallpaper": chosen}

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
                    wallpaper_url=self.media_index.get(serial, {}).get(
                        "wallpaper",
                        "https://image01.oneplus.net/media/202407/09/fba6399523cbd6126ddcedb6920c9046.png?x-amz-process=image/format,webp/quality,Q_80",
                    ),
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

    def inspect_firmware_tree(self, max_depth: int = 2, max_entries: int = 120) -> Dict[str, Any]:
        if not self.firmware_path:
            return {"error": "path not set"}
        base = self.firmware_path
        if not base.exists():
            return {"error": "path missing"}

        def walk(path: Path, depth: int = 0) -> Dict[str, Any]:
            node = {"name": path.name, "type": "dir" if path.is_dir() else "file"}
            if path.is_dir() and depth < max_depth:
                children = []
                for child in sorted(path.iterdir()):
                    if len(children) >= max_entries:
                        break
                    children.append(walk(child, depth + 1))
                node["children"] = children
            return node

        return {"tree": walk(base)}

    def validate_firmware(self) -> Dict[str, Any]:
        required_images = {
            "boot.img",
            "dtbo.img",
            "init_boot.img",
            "modem.img",
            "recovery.img",
            "vbmeta.img",
            "vbmeta_system.img",
            "vbmeta_vendor.img",
            "vendor_boot.img",
        }
        optional_partitions = {
            "super.img",
            "my_bigball.img",
            "my_carrier.img",
            "my_company.img",
            "my_engineering.img",
            "my_heytap.img",
            "my_manifest.img",
            "my_preload.img",
            "my_product.img",
            "my_region.img",
            "my_stock.img",
            "odm.img",
            "product.img",
            "system.img",
            "system_dlkm.img",
            "system_ext.img",
            "vendor.img",
            "vendor_dlkm.img",
        }
        if not self.firmware_path:
            return {"path": None, "is_valid": False, "message": "Не указан путь"}
        if not self.firmware_path.exists():
            return {"path": str(self.firmware_path), "is_valid": False, "message": "Путь не найден"}

        files_present: set[str] = set()
        base = self.firmware_path
        if base.is_file():
            suffix = base.suffix.lower()
            if suffix == ".zip":
                return {"path": str(base), "is_valid": False, "message": "Нужна распаковка архива (.zip) перед прошивкой"}
            files_present = {base.name}
        else:
            for child in base.iterdir():
                if child.is_file():
                    files_present.add(child.name)

        missing = sorted(list(required_images - files_present))
        maybe_present = sorted(list(files_present & (required_images | optional_partitions)))
        is_valid = not missing and bool(files_present)
        return {
            "path": str(self.firmware_path),
            "is_valid": is_valid,
            "message": "Готово к прошивке" if is_valid else "Не хватает обязательных образов",
            "missing": missing,
            "present": maybe_present,
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
