"""Utility helpers for command execution and parsing."""

from __future__ import annotations

import subprocess
from typing import Any, Dict, List, Optional, Tuple


def run(cmd: List[str]) -> Tuple[bool, str]:
    """Run a subprocess command and return (ok, output)."""
    try:
        completed = subprocess.run(cmd, check=False, capture_output=True, text=True)
    except FileNotFoundError:
        return False, ""
    output = completed.stdout.strip() or completed.stderr.strip()
    return completed.returncode == 0, output


def parse_usage_percent(value: str) -> Optional[float]:
    try:
        return float(value.strip().replace("%", ""))
    except ValueError:
        return None


def parse_battery_dump(output: str) -> Dict[str, Any]:
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


def parse_storage(df_output: str) -> Dict[str, Any]:
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
        usage_pct = parse_usage_percent(usage)
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
