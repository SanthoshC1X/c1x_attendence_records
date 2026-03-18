"""
SQLite cache for parsed attendance/leave data.
Prevents re-parsing identical files; persists across restarts.
"""

import sqlite3
import hashlib
import json
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "c1x_cache.db")


def _conn() -> sqlite3.Connection:
    return sqlite3.connect(DB_PATH, check_same_thread=False)


def init_db() -> None:
    with _conn() as con:
        con.execute("""
            CREATE TABLE IF NOT EXISTS file_registry (
                role      TEXT PRIMARY KEY,
                file_path TEXT,
                file_hash TEXT,
                last_parsed TEXT
            )
        """)
        con.execute("""
            CREATE TABLE IF NOT EXISTS parsed_cache (
                file_hash      TEXT PRIMARY KEY,
                dashboard_json TEXT,
                analytics_json TEXT,
                cached_at      TEXT
            )
        """)


def get_file_hash(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def get_path_hash(file_path: str) -> str | None:
    """Hash of file at given path; None if file doesn't exist."""
    try:
        with open(file_path, "rb") as f:
            return get_file_hash(f.read())
    except (OSError, IOError):
        return None


def register_watch_path(role: str, file_path: str) -> None:
    """Store watch path for attendance/leave role."""
    with _conn() as con:
        con.execute(
            "INSERT OR REPLACE INTO file_registry (role, file_path, file_hash, last_parsed) VALUES (?, ?, ?, ?)",
            (role, file_path, "", "")
        )


def get_watch_paths() -> dict[str, str]:
    """Return {role: file_path} for all registered paths."""
    with _conn() as con:
        rows = con.execute("SELECT role, file_path FROM file_registry").fetchall()
    return {row[0]: row[1] for row in rows}


def get_registered_hashes() -> dict[str, str]:
    """Return {role: file_hash} stored in registry."""
    with _conn() as con:
        rows = con.execute("SELECT role, file_hash FROM file_registry").fetchall()
    return {row[0]: row[1] for row in rows}


def save_to_cache(
    attendance_hash: str,
    leave_hash: str,
    dashboard_json: dict,
    analytics_json: dict,
) -> None:
    """Cache parsed results keyed by combined hash."""
    combined = attendance_hash + ":" + leave_hash
    with _conn() as con:
        con.execute(
            "INSERT OR REPLACE INTO parsed_cache (file_hash, dashboard_json, analytics_json, cached_at) VALUES (?, ?, ?, ?)",
            (combined, json.dumps(dashboard_json), json.dumps(analytics_json), datetime.utcnow().isoformat())
        )
        # Update hashes in registry
        con.execute("UPDATE file_registry SET file_hash = ?, last_parsed = ? WHERE role = 'attendance'",
                    (attendance_hash, datetime.utcnow().isoformat()))
        con.execute("UPDATE file_registry SET file_hash = ?, last_parsed = ? WHERE role = 'leave'",
                    (leave_hash, datetime.utcnow().isoformat()))


def load_from_cache(attendance_hash: str, leave_hash: str) -> tuple[dict, dict] | None:
    """Return (dashboard_dict, analytics_dict) if cached, else None."""
    combined = attendance_hash + ":" + leave_hash
    with _conn() as con:
        row = con.execute(
            "SELECT dashboard_json, analytics_json FROM parsed_cache WHERE file_hash = ?",
            (combined,)
        ).fetchone()
    if row:
        return json.loads(row[0]), json.loads(row[1])
    return None


def get_latest_cache_entry() -> tuple[dict, dict] | None:
    """Return the most recently saved (dashboard, analytics) pair regardless of key."""
    with _conn() as con:
        row = con.execute(
            "SELECT dashboard_json, analytics_json FROM parsed_cache ORDER BY cached_at DESC LIMIT 1"
        ).fetchone()
    if row:
        return json.loads(row[0]), json.loads(row[1])
    return None


def get_last_parsed_info() -> dict | None:
    """Return info about the most recent parse, or None if no data cached."""
    with _conn() as con:
        rows = con.execute("SELECT role, file_path, file_hash, last_parsed FROM file_registry").fetchall()
    if not rows:
        return None
    info: dict = {}
    for role, path, h, ts in rows:
        info[role] = {"path": path, "hash": h, "last_parsed": ts}
    return info if info else None


# Initialise on import
init_db()
