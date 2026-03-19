"""
Fetches data from Google Sheets using the Sheets API v4.

For public Google Sheets (shared as "Anyone with the link can view"),
only a Google API key is needed — no OAuth or service account required.

One-time setup (takes ~5 minutes):
  1. Go to https://console.cloud.google.com → create or select a project
  2. Search "Google Sheets API" → Enable it
  3. Go to APIs & Services → Credentials → "+ Create Credentials" → API Key
  4. Copy the key and paste it in the Admin Setup page
  5. Make sure your Google Sheets are shared as "Anyone with the link can view"
"""

import re
import time
import requests
from typing import Optional

_BASE = "https://sheets.googleapis.com/v4/spreadsheets"

# ── Rate limiter: max 55 requests per 60 seconds (Google limit is 60) ────────
_request_times: list[float] = []
_RATE_LIMIT = 55
_RATE_WINDOW = 60


def _rate_limit():
    """Sleep if needed to stay under Google Sheets API quota."""
    now = time.time()
    # Remove timestamps older than the window
    while _request_times and _request_times[0] < now - _RATE_WINDOW:
        _request_times.pop(0)
    if len(_request_times) >= _RATE_LIMIT:
        wait = _request_times[0] + _RATE_WINDOW - now + 0.5
        if wait > 0:
            print(f"[sheets] Rate limit: waiting {wait:.1f}s")
            time.sleep(wait)
    _request_times.append(time.time())


def extract_sheet_id(url_or_id: str) -> str:
    """Extract spreadsheet ID from a Google Sheets URL, or return as-is if already an ID."""
    match = re.search(r"/spreadsheets/d/([a-zA-Z0-9_-]+)", url_or_id)
    return match.group(1) if match else url_or_id.strip()


def get_sheet_tabs(sheet_id: str, api_key: str) -> list[dict]:
    """
    Returns list of {name, gid} for all tabs in a spreadsheet.
    Raises ValueError on bad API key or inaccessible sheet.
    """
    _rate_limit()
    resp = requests.get(
        f"{_BASE}/{sheet_id}",
        params={"key": api_key, "fields": "sheets.properties"},
        timeout=30,
    )
    if resp.status_code == 400:
        raise ValueError(
            f"Invalid spreadsheet ID or request. Response: {resp.text[:300]}"
        )
    if resp.status_code == 403:
        raise ValueError(
            "Access denied (403). Please ensure: "
            "1) Google Sheets API is enabled in Cloud Console, "
            "2) your API key is valid, "
            "3) the sheet is shared as 'Anyone with the link can view'."
        )
    if resp.status_code == 404:
        raise ValueError(
            f"Spreadsheet not found (404). Check the sheet ID/URL."
        )
    resp.raise_for_status()
    return [
        {"name": s["properties"]["title"], "gid": s["properties"]["sheetId"]}
        for s in resp.json().get("sheets", [])
    ]


def get_sheet_values(sheet_id: str, api_key: str, sheet_name: str) -> list[list]:
    """
    Returns all values from a named tab as a list of rows (list of strings).
    Returns [] if the tab doesn't exist or has no data.
    Each row may be shorter than the header row if trailing cells are empty
    (Google Sheets omits trailing empty cells).
    """
    _rate_limit()
    safe_name = sheet_name.replace("'", "\\'")
    resp = requests.get(
        f"{_BASE}/{sheet_id}/values/'{safe_name}'!A:Z",
        params={"key": api_key, "valueRenderOption": "FORMATTED_VALUE"},
        timeout=30,
    )
    if resp.status_code in (400, 404):
        return []
    resp.raise_for_status()
    return resp.json().get("values", [])


def batch_get_sheet_values(sheet_id: str, api_key: str, sheet_names: list[str]) -> dict[str, list[list]]:
    """
    Fetch multiple tabs in batches using batchGet API.
    Returns {tab_name: rows} dict. Much more efficient than individual calls.
    Google allows ~50 ranges per batchGet call.
    """
    BATCH_SIZE = 40  # stay well under URL length limits
    result: dict[str, list[list]] = {}

    for i in range(0, len(sheet_names), BATCH_SIZE):
        batch = sheet_names[i:i + BATCH_SIZE]
        ranges = []
        for name in batch:
            safe = name.replace("'", "\\'")
            ranges.append(f"'{safe}'!A:Z")

        _rate_limit()
        resp = requests.get(
            f"{_BASE}/{sheet_id}/values:batchGet",
            params={
                "key": api_key,
                "ranges": ranges,
                "valueRenderOption": "FORMATTED_VALUE",
            },
            timeout=60,
        )
        if resp.status_code == 429:
            # Back off and retry once
            print(f"[sheets] 429 on batchGet, waiting 30s...")
            time.sleep(30)
            _rate_limit()
            resp = requests.get(
                f"{_BASE}/{sheet_id}/values:batchGet",
                params={
                    "key": api_key,
                    "ranges": ranges,
                    "valueRenderOption": "FORMATTED_VALUE",
                },
                timeout=60,
            )
        resp.raise_for_status()

        value_ranges = resp.json().get("valueRanges", [])
        for j, vr in enumerate(value_ranges):
            result[batch[j]] = vr.get("values", [])

        if i + BATCH_SIZE < len(sheet_names):
            print(f"[sheets] Fetched {min(i + BATCH_SIZE, len(sheet_names))}/{len(sheet_names)} tabs...")

    return result


def validate_connection(att_sheet_id: str, leave_sheet_id: Optional[str], api_key: str) -> dict:
    """
    Quick connection test. Returns {"ok": True} or {"ok": False, "error": "..."}.
    """
    try:
        tabs = get_sheet_tabs(att_sheet_id, api_key)
        if not tabs:
            return {"ok": False, "error": "Attendance sheet has no tabs."}
        if leave_sheet_id:
            get_sheet_tabs(leave_sheet_id, api_key)
        return {"ok": True, "tab_count": len(tabs)}
    except ValueError as e:
        return {"ok": False, "error": str(e)}
    except Exception as e:
        return {"ok": False, "error": f"Connection failed: {e}"}
