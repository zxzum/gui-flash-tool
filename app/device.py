"""Device discovery and detail collection."""

from __future__ import annotations

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, List, Optional

from .media import MediaStore
from .utils import parse_battery_dump, parse_storage, run


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


class DeviceManager:
    def __init__(self, media: MediaStore) -> None:
        self.media = media
        self.device_cache: Dict[str, DeviceInfo] = {}

    def _read_prop(self, serial: str, prop: str) -> Optional[str]:
        ok, output = run(["adb", "-s", serial, "shell", "getprop", prop])
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
        ok, su_check = run(["adb", "-s", serial, "shell", "which", "su"])
        if ok and su_check:
            ok_root, su_id = run(["adb", "-s", serial, "shell", "su", "-c", "id"])
            rooted = ok_root and "uid=0" in su_id
        ok, battery_dump = run(["adb", "-s", serial, "shell", "dumpsys", "battery"])
        battery = parse_battery_dump(battery_dump) if battery_dump else None

        soc_vendor = self._read_prop(serial, "ro.soc.manufacturer")
        soc_model = self._read_prop(serial, "ro.soc.model")
        platform = self._read_prop(serial, "ro.board.platform")
        cpuinfo = None
        ok_cpu, cpu_dump = run(["adb", "-s", serial, "shell", "cat", "/proc/cpuinfo"])
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

        ok_kernel, kernel_release = run(["adb", "-s", serial, "shell", "uname", "-r"])
        kernel_full = None
        if ok_kernel and kernel_release:
            ok_full, full_desc = run(["adb", "-s", serial, "shell", "cat", "/proc/version"])
            kernel_full = full_desc if ok_full else None
        kernel = None
        if kernel_release or kernel_full:
            kernel = {"release": kernel_release.strip() if kernel_release else None, "full": kernel_full}

        storage = None
        ok_df, df_out = run(["adb", "-s", serial, "shell", "df", "-h", "/data"])
        if ok_df and df_out:
            storage = parse_storage(df_out)

        wallpaper_url = self.media.wallpaper_for(serial, model)
        if wallpaper_url and Path(wallpaper_url).exists():
            wallpaper_url = Path(wallpaper_url).as_uri()

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

    def _fastboot_devices(self) -> List[DeviceInfo]:
        ok, output = run(["fastboot", "devices"])
        if not ok or not output:
            return []
        devices: List[DeviceInfo] = []
        for line in output.splitlines():
            if not line.strip():
                continue
            parts = line.split()
            serial = parts[0]
            mode = "fastboot"
            ok_var, userspace = run(["fastboot", "-s", serial, "getvar", "is-userspace"])
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
                    wallpaper_url=self.media.wallpaper_for(serial, None),
                )
            )
        return devices

    def list_devices(self) -> List[Dict[str, Any]]:
        adb_devices: List[DeviceInfo] = []
        ok, output = run(["adb", "devices", "-l"])
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
                wallpaper_url=self.media.wallpaper_for("demo", "OnePlus Pad 2"),
                storage={"summary": "49.2/256"},
            )
            devices.append(demo)
            self.device_cache[demo.serial] = demo
        return [device.asdict() for device in devices]

    def cache_update_wallpaper(self, serial: str, wallpaper: str) -> None:
        if serial in self.device_cache:
            self.device_cache[serial].wallpaper_url = wallpaper

