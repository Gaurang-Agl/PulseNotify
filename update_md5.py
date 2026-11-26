#!/usr/bin/env python3
"""
PulseNotify MD5 Checksum and Guide Synchronization Engine.

Functions:
  1. Synchronizes GOOGLE_NOTEBOOK_GUIDE.md <-> GOOGLE_NOTEBOOK_GUIDE.txt.
  2. Synchronizes PulseNotify_Study_Notes.md <-> PulseNotify_Study_Notes.txt.
  3. Computes cryptographic MD5 hashes for all tracked code, configuration,
     Postman collections, documentation (.md / .txt), and frontend source files.
  4. Writes/updates .md5 manifest.
  5. Provides verification mode (--check) to ensure zero corruption across environments.

Usage:
  python update_md5.py          # Synchronizes guides and refreshes .md5
  python update_md5.py --check  # Verifies current files against .md5
"""

import hashlib
import os
import subprocess
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
MD5_FILE = ROOT_DIR / ".md5"

GUIDE_PAIRS = [
    (ROOT_DIR / "GOOGLE_NOTEBOOK_GUIDE.md", ROOT_DIR / "GOOGLE_NOTEBOOK_GUIDE.txt"),
    (ROOT_DIR / "PulseNotify_Study_Notes.md", ROOT_DIR / "PulseNotify_Study_Notes.txt"),
]

EXCLUDED_DIRS = {
    ".git",
    "__pycache__",
    ".pytest_cache",
    ".venv",
    "venv",
    "env",
    "node_modules",
    "dist",
    "build",
    ".coverage",
}

EXCLUDED_FILES = {
    ".md5",
    "celerybeat-schedule",
    "celerybeat-schedule-shm",
    "celerybeat-schedule-wal",
    ".coverage",
}


def sync_notebook_guides():
    """Ensure .md and .txt guide pairs are synchronized based on modification time."""
    for md_path, txt_path in GUIDE_PAIRS:
        if md_path.is_file() and txt_path.is_file():
            if md_path.stat().st_mtime >= txt_path.stat().st_mtime:
                txt_path.write_text(md_path.read_text(encoding="utf-8"), encoding="utf-8")
            else:
                md_path.write_text(txt_path.read_text(encoding="utf-8"), encoding="utf-8")
        elif md_path.is_file():
            txt_path.write_text(md_path.read_text(encoding="utf-8"), encoding="utf-8")
        elif txt_path.is_file():
            md_path.write_text(txt_path.read_text(encoding="utf-8"), encoding="utf-8")


def compute_md5(file_path: Path) -> str:
    """Calculate MD5 hash of a file."""
    hasher = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            hasher.update(chunk)
    return hasher.hexdigest().lower()


def get_all_target_files():
    """Collect all git tracked files, root documentation, and frontend project files."""
    files = set()
    try:
        res = subprocess.run(
            ["git", "ls-files"],
            cwd=ROOT_DIR,
            capture_output=True,
            text=True,
            check=True,
        )
        for line in res.stdout.splitlines():
            line = line.strip()
            if line:
                files.add(line)
    except Exception:
        pass

    for p in ROOT_DIR.glob("*.md"):
        if p.name not in EXCLUDED_FILES:
            files.add(p.relative_to(ROOT_DIR).as_posix())
    for p in ROOT_DIR.glob("*.txt"):
        if p.name not in EXCLUDED_FILES:
            files.add(p.relative_to(ROOT_DIR).as_posix())
    for p in ROOT_DIR.glob("*.html"):
        if p.name not in EXCLUDED_FILES:
            files.add(p.relative_to(ROOT_DIR).as_posix())

    # Include frontend source and configuration files
    frontend_dir = ROOT_DIR / "frontend"
    if frontend_dir.is_dir():
        for p in frontend_dir.rglob("*"):
            if p.is_file():
                rel = p.relative_to(ROOT_DIR).as_posix()
                parts = rel.split("/")
                if not any(excluded in parts for excluded in EXCLUDED_DIRS):
                    if p.name not in EXCLUDED_FILES:
                        files.add(rel)

    filtered = []
    for f in sorted(files):
        if f in EXCLUDED_FILES:
            continue
        parts = f.split("/")
        if any(p in EXCLUDED_DIRS for p in parts):
            continue
        filtered.append(f)
    return filtered


def update_manifest():
    """Update .md5 with all current file hashes."""
    sync_notebook_guides()
    files = get_all_target_files()
    lines = []
    for rel_path in files:
        abs_path = ROOT_DIR / rel_path
        if abs_path.is_file():
            checksum = compute_md5(abs_path)
            lines.append(f"{checksum}  {rel_path}\n")

    with open(MD5_FILE, "w", encoding="ascii", newline="\n") as f:
        f.writelines(lines)
    print(f"Successfully synchronized guides and updated .md5 with {len(lines)} files.")


def verify_manifest() -> bool:
    """Verify all files against .md5 manifest."""
    if not MD5_FILE.is_file():
        print("Error: .md5 does not exist. Run python update_md5.py first.")
        return False

    with open(MD5_FILE, "r", encoding="ascii") as f:
        lines = [l.strip() for l in f if l.strip()]

    all_ok = True
    verified_count = 0
    for line in lines:
        parts = line.split(maxsplit=1)
        if len(parts) != 2:
            continue
        expected_hash, rel_path = parts[0], parts[1].lstrip("*").strip()
        abs_path = ROOT_DIR / rel_path
        if not abs_path.is_file():
            print(f"MISSING: {rel_path}")
            all_ok = False
            continue
        actual_hash = compute_md5(abs_path)
        if actual_hash != expected_hash:
            print(f"MISMATCH: {rel_path} (expected {expected_hash}, got {actual_hash})")
            all_ok = False
        else:
            verified_count += 1

    if all_ok:
        print(f"All {verified_count} files verified 100% OK against .md5.")
    else:
        print("Errors found during checksum verification!")
    return all_ok


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--check":
        ok = verify_manifest()
        sys.exit(0 if ok else 1)
    else:
        update_manifest()
