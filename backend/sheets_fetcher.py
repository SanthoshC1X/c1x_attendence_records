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
import requests
from typing import Optional

_BASE = "https://sheets.googleapis.com/v4/spreadsheets"


def extract_sheet_id(url_or_id: str) -> str:
    """Extract spreadsheet ID from a Google Sheets URL, or return as-is if already an ID."""
    match = re.search(r"/spreadsheets/d/([a-zA-Z0-9_-]+)", url_or_id)
    return match.group(1) if match else url_or_id.strip()


def get_sheet_tabs(sheet_id: str, api_key: str) -> list[dict]:
    """
    Returns list of {name, gid} for all tabs in a spreadsheet.
    Raises ValueError on bad API key or inaccessible sheet.
    """
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
