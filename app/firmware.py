"""Firmware path handling, inspection, and validation."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Optional


class FirmwareManager:
    def __init__(self) -> None:
        self.firmware_path: Optional[Path] = None

    def set_path(self, path: str) -> Dict[str, Any]:
        self.firmware_path = Path(path)
        return {"path": str(self.firmware_path), "exists": self.firmware_path.exists()}

    def inspect_tree(self, max_depth: int = 2, max_entries: int = 120) -> Dict[str, Any]:
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

    def validate(self) -> Dict[str, Any]:
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
