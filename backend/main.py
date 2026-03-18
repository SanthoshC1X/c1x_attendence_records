from fastapi import FastAPI, UploadFile, File, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from contextlib import asynccontextmanager
from typing import Optional
import asyncio
import json
import os
from backend import parser
from backend import analytics
from backend import database
from backend import websocket_manager as ws_module
from backend import watcher
from backend import sheets_fetcher

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.json")


def _read_config() -> dict:
    try:
        with open(CONFIG_PATH, "r") as f:
            cfg = json.load(f)
    except Exception:
        cfg = {}
    # Environment variables override config.json (used in production on Railway)
    cfg.setdefault("admin_attendance_sheet_id", os.getenv("ADMIN_ATTENDANCE_SHEET_ID", ""))
    cfg.setdefault("admin_leave_sheet_id",      os.getenv("ADMIN_LEAVE_SHEET_ID", ""))
    cfg.setdefault("google_api_key",            os.getenv("GOOGLE_API_KEY", ""))
    cfg.setdefault("admin_attendance_path",     "")
    cfg.setdefault("admin_leave_path",          "")
    # Env vars win over empty config.json values
    if not cfg["admin_attendance_sheet_id"]:
        cfg["admin_attendance_sheet_id"] = os.getenv("ADMIN_ATTENDANCE_SHEET_ID", "")
    if not cfg["admin_leave_sheet_id"]:
        cfg["admin_leave_sheet_id"] = os.getenv("ADMIN_LEAVE_SHEET_ID", "")
    if not cfg["google_api_key"]:
        cfg["google_api_key"] = os.getenv("GOOGLE_API_KEY", "")
    return cfg


def _write_config(data: dict) -> None:
    with open(CONFIG_PATH, "w") as f:
        json.dump(data, f, indent=2)


async def _reload_from_paths(changed_path: str) -> None:
    """Called by file watcher when an Excel file changes."""
    paths = database.get_watch_paths()
    att_path = paths.get("attendance", "")
    leave_path = paths.get("leave", "")

    if not att_path or not os.path.exists(att_path):
        return

    try:
        with open(att_path, "rb") as f:
            att_bytes = f.read()
        leave_bytes = None
        if leave_path and os.path.exists(leave_path):
            with open(leave_path, "rb") as f:
                leave_bytes = f.read()

        att_hash = database.get_file_hash(att_bytes)
        leave_hash = database.get_file_hash(leave_bytes) if leave_bytes else "none"

        # Only re-parse if something actually changed
        cached = database.load_from_cache(att_hash, leave_hash)
        if cached is None:
            dashboard_data = parser.build_dashboard_data(att_bytes, leave_bytes)
            analytics_data = _build_analytics(dashboard_data, att_bytes, leave_bytes)
            database.save_to_cache(att_hash, leave_hash, dashboard_data, analytics_data)

        await ws_module.manager.broadcast({
            "event": "data_updated",
            "changed_file": os.path.basename(changed_path),
        })
    except Exception as e:
        print(f"[watcher] reload error: {e}")


def _is_sheets_mode(cfg: dict) -> bool:
    """True when Google Sheets IDs + API key are configured."""
    return bool(
        cfg.get("admin_attendance_sheet_id", "").strip()
        and cfg.get("google_api_key", "").strip()
    )


async def _reload_from_sheets(att_id: str, leave_id: str, api_key: str) -> bool:
    """
    Fetch latest data from Google Sheets, rebuild cache if content changed.
    Returns True if new data was parsed and cached.
    """
    try:
        dashboard_data = parser.build_dashboard_data_from_google_sheets(
            att_id, leave_id or None, api_key
        )
        if not dashboard_data.get("dates_processed"):
            print(f"[sheets] No dates found. Errors: {dashboard_data.get('errors')}")
            return False

        # Hash the content to detect changes
        content_bytes = json.dumps(dashboard_data, sort_keys=True, default=str).encode()
        content_hash = database.get_file_hash(content_bytes)
        sheets_marker = "gsheets"

        cached = database.load_from_cache(content_hash, sheets_marker)
        if cached is not None:
            return False  # Same content as last fetch

        analytics_data = _build_analytics(dashboard_data, None, None)
        database.save_to_cache(content_hash, sheets_marker, dashboard_data, analytics_data)

        await ws_module.manager.broadcast({"event": "data_updated", "changed_file": "google_sheets"})
        print(f"[sheets] Refreshed — {dashboard_data['employee_count']} employees, "
              f"{len(dashboard_data['dates_processed'])} dates")
        return True
    except Exception as e:
        print(f"[sheets] Reload error: {e}")
        return False


async def _sheets_poll_loop() -> None:
    """Background task: poll Google Sheets every 5 minutes for changes."""
    while True:
        await asyncio.sleep(300)
        cfg = _read_config()
        if _is_sheets_mode(cfg):
            att_id   = sheets_fetcher.extract_sheet_id(cfg["admin_attendance_sheet_id"])
            leave_id = sheets_fetcher.extract_sheet_id(cfg.get("admin_leave_sheet_id", ""))
            api_key  = cfg["google_api_key"].strip()
            await _reload_from_sheets(att_id, leave_id, api_key)


def _build_analytics(dashboard_data: dict, att_bytes: bytes, leave_bytes: bytes | None) -> dict:
    filter_start, filter_end = analytics.get_date_range("all", dashboard_data["dates_processed"])
    filtered = analytics.filter_data_by_date_range(dashboard_data, filter_start, filter_end)
    overall = analytics.get_overall_analytics(filtered, "all")
    leave_a = analytics.get_leave_type_analytics(filtered)
    analytics.enrich_with_week_breakdown(filtered)
    return {
        "period_info": {"period": "all", "start_date": filter_start, "end_date": filter_end,
                        "total_days": len(filtered["dates_processed"])},
        "overall": overall,
        "leave_breakdown": leave_a,
        "filtered_data": filtered,
    }


@asynccontextmanager
async def lifespan(app: FastAPI):
    loop = asyncio.get_event_loop()
    watcher.set_reload_callback(_reload_from_paths, loop)

    cfg = _read_config()

    if _is_sheets_mode(cfg):
        # ── Google Sheets mode ──────────────────────────────────────────────
        # extract_sheet_id handles both full URLs and bare IDs
        att_id   = sheets_fetcher.extract_sheet_id(cfg["admin_attendance_sheet_id"])
        leave_id = sheets_fetcher.extract_sheet_id(cfg.get("admin_leave_sheet_id", ""))
        api_key  = cfg["google_api_key"].strip()
        print(f"[startup] Google Sheets mode — att:{att_id[:12]}... polling every 5 min")
        asyncio.ensure_future(_reload_from_sheets(att_id, leave_id, api_key))
        asyncio.ensure_future(_sheets_poll_loop())
    else:
        # ── Local Excel file mode (legacy / HR mode) ────────────────────────
        att = cfg.get("admin_attendance_path", "").strip()
        leave = cfg.get("admin_leave_path", "").strip()
        if att and os.path.exists(att):
            database.register_watch_path("attendance", att)
            if leave and os.path.exists(leave):
                database.register_watch_path("leave", leave)
            watch_dir = os.path.dirname(os.path.abspath(att))
            watcher.start_watcher(watch_dir)
            asyncio.ensure_future(_reload_from_paths(att))
        else:
            paths = database.get_watch_paths()
            if paths.get("attendance") and os.path.isdir(os.path.dirname(paths["attendance"])):
                watcher.start_watcher(os.path.dirname(paths["attendance"]))

    yield
    watcher.stop_watcher()


app = FastAPI(title="C1X Attendance Transformer", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Vercel frontend domain is set at runtime; wildcard is safe for read-only API
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/transform")
async def transform_attendance(
    attendance_file: UploadFile = File(...),
    leave_file: Optional[UploadFile] = File(None),
):
    """Upload raw attendance Excel (+ optional Leave/WFH Excel), get back report."""
    if not attendance_file.filename or not attendance_file.filename.endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Attendance file must be .xlsx")

    attendance_bytes = await attendance_file.read()
    if len(attendance_bytes) == 0:
        raise HTTPException(status_code=400, detail="Attendance file is empty")

    leave_bytes = None
    if leave_file and leave_file.filename:
        if not leave_file.filename.endswith(".xlsx"):
            raise HTTPException(status_code=400, detail="Leave file must be .xlsx")
        leave_bytes = await leave_file.read()
        if len(leave_bytes) == 0:
            leave_bytes = None

    result = parser.transform_excel(attendance_bytes, leave_bytes)

    if result["output_bytes"] is None:
        raise HTTPException(
            status_code=400,
            detail=result["errors"][0] if result["errors"] else "No data found",
        )

    return Response(
        content=result["output_bytes"],
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": "attachment; filename=Attendance_Report.xlsx",
            "X-Dates-Processed": ",".join(result["dates_processed"]),
            "X-Employee-Count": str(result["employee_count"]),
            "X-Record-Count": str(result["record_count"]),
            "X-Errors": "|".join(result["errors"]) if result["errors"] else "",
            "Access-Control-Expose-Headers": "X-Dates-Processed, X-Employee-Count, X-Record-Count, X-Errors, Content-Disposition",
        },
    )


@app.post("/api/preview")
async def preview_attendance(
    attendance_file: UploadFile = File(...),
    leave_file: Optional[UploadFile] = File(None),
):
    """Upload raw attendance Excel (+ optional Leave/WFH), get back stats only."""
    if not attendance_file.filename or not attendance_file.filename.endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Attendance file must be .xlsx")

    attendance_bytes = await attendance_file.read()
    if len(attendance_bytes) == 0:
        raise HTTPException(status_code=400, detail="Attendance file is empty")

    leave_bytes = None
    if leave_file and leave_file.filename:
        if not leave_file.filename.endswith(".xlsx"):
            raise HTTPException(status_code=400, detail="Leave file must be .xlsx")
        leave_bytes = await leave_file.read()
        if len(leave_bytes) == 0:
            leave_bytes = None

    result = parser.transform_excel(attendance_bytes, leave_bytes)

    return {
        "dates_processed": result["dates_processed"],
        "employee_count": result["employee_count"],
        "record_count": result["record_count"],
        "errors": result["errors"],
    }


@app.post("/api/dashboard")
async def dashboard_attendance(
    attendance_file: UploadFile = File(...),
    leave_file: Optional[UploadFile] = File(None),
):
    """Upload raw attendance Excel (+ optional Leave/WFH), get back dashboard JSON."""
    if not attendance_file.filename or not attendance_file.filename.endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Attendance file must be .xlsx")

    attendance_bytes = await attendance_file.read()
    if len(attendance_bytes) == 0:
        raise HTTPException(status_code=400, detail="Attendance file is empty")

    leave_bytes = None
    if leave_file and leave_file.filename:
        if not leave_file.filename.endswith(".xlsx"):
            raise HTTPException(status_code=400, detail="Leave file must be .xlsx")
        leave_bytes = await leave_file.read()
        if len(leave_bytes) == 0:
            leave_bytes = None

    data = parser.build_dashboard_data(attendance_bytes, leave_bytes)

    if not data["dates_processed"]:
        raise HTTPException(
            status_code=400,
            detail=data["errors"][0] if data["errors"] else "No data found",
        )

    return data


@app.get("/")
def root():
    return {"status": "C1X Attendance API is running"}


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/analytics/summary")
async def get_analytics_summary(
    attendance_file: UploadFile = File(...),
    leave_file: Optional[UploadFile] = File(None),
    period: str = Query("today", description="Time period: today, week, month, year, custom"),
    start_date: Optional[str] = Query(None, description="Start date for custom period (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date for custom period (YYYY-MM-DD)"),
):
    """Get comprehensive analytics summary with time-based filtering."""
    if not attendance_file.filename or not attendance_file.filename.endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Attendance file must be .xlsx")

    attendance_bytes = await attendance_file.read()
    if len(attendance_bytes) == 0:
        raise HTTPException(status_code=400, detail="Attendance file is empty")

    leave_bytes = None
    if leave_file and leave_file.filename:
        if not leave_file.filename.endswith(".xlsx"):
            raise HTTPException(status_code=400, detail="Leave file must be .xlsx")
        leave_bytes = await leave_file.read()
        if len(leave_bytes) == 0:
            leave_bytes = None

    # Build dashboard data
    dashboard_data = parser.build_dashboard_data(attendance_bytes, leave_bytes)
    
    if not dashboard_data["dates_processed"]:
        raise HTTPException(
            status_code=400,
            detail=dashboard_data["errors"][0] if dashboard_data["errors"] else "No data found",
        )

    # Apply date filtering
    filter_start, filter_end = analytics.get_date_range(period, dashboard_data["dates_processed"], start_date, end_date)
    filtered_data = analytics.filter_data_by_date_range(dashboard_data, filter_start, filter_end)
    
    # Get analytics
    overall_analytics = analytics.get_overall_analytics(filtered_data, period)
    leave_analytics = analytics.get_leave_type_analytics(filtered_data)
    analytics.enrich_with_week_breakdown(filtered_data)

    return {
        "period_info": {
            "period": period,
            "start_date": filter_start,
            "end_date": filter_end,
            "total_days": len(filtered_data["dates_processed"])
        },
        "overall": overall_analytics,
        "leave_breakdown": leave_analytics,
        "filtered_data": filtered_data
    }


@app.post("/api/analytics/leaves/{leave_type}")
async def get_employees_by_leave_type(
    leave_type: str,
    attendance_file: UploadFile = File(...),
    leave_file: Optional[UploadFile] = File(None),
    period: str = Query("today", description="Time period: today, week, month, year, custom"),
    start_date: Optional[str] = Query(None, description="Start date for custom period (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date for custom period (YYYY-MM-DD)"),
):
    """Get employees filtered by specific leave type."""
    if not attendance_file.filename or not attendance_file.filename.endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Attendance file must be .xlsx")

    attendance_bytes = await attendance_file.read()
    leave_bytes = None
    if leave_file and leave_file.filename:
        leave_bytes = await leave_file.read()

    dashboard_data = parser.build_dashboard_data(attendance_bytes, leave_bytes)
    filter_start, filter_end = analytics.get_date_range(period, dashboard_data["dates_processed"], start_date, end_date)
    filtered_data = analytics.filter_data_by_date_range(dashboard_data, filter_start, filter_end)
    
    leave_analytics = analytics.get_leave_type_analytics(filtered_data)
    
    if leave_type not in leave_analytics:
        raise HTTPException(status_code=400, detail=f"Invalid leave type: {leave_type}")
    
    return {
        "leave_type": leave_type,
        "period": period,
        "date_range": {"start": filter_start, "end": filter_end},
        "total_count": leave_analytics[leave_type]["count"],
        "employees": leave_analytics[leave_type]["employees"]
    }


@app.get("/api/admin/config")
async def get_admin_config():
    """Return current admin config (Google Sheets IDs or Excel paths)."""
    cfg = _read_config()
    if _is_sheets_mode(cfg):
        att_id = cfg.get("admin_attendance_sheet_id", "").strip()
        leave_id = cfg.get("admin_leave_sheet_id", "").strip()
        return {
            "mode": "sheets",
            "configured": True,
            "attendance_sheet_id": att_id,
            "leave_sheet_id": leave_id,
            "has_api_key": True,
        }
    att = cfg.get("admin_attendance_path", "").strip()
    leave = cfg.get("admin_leave_path", "").strip()
    return {
        "mode": "excel",
        "configured": bool(att),
        "attendance_path": att,
        "leave_path": leave,
        "attendance_exists": os.path.exists(att) if att else False,
        "leave_exists": os.path.exists(leave) if leave else False,
    }


@app.post("/api/admin/config")
async def save_admin_config(body: dict):
    """
    Save admin config. Accepts either:
      - Google Sheets mode: {attendance_sheet_url, leave_sheet_url (opt), google_api_key}
      - Excel file mode:    {attendance_path, leave_path (opt)}
    """
    att_url = body.get("attendance_sheet_url", "").strip()
    leave_url = body.get("leave_sheet_url", "").strip()
    api_key = body.get("google_api_key", "").strip()
    att_path = body.get("attendance_path", "").strip()
    leave_path = body.get("leave_path", "").strip()

    cfg = _read_config()

    if att_url and api_key:
        # ── Google Sheets mode ──────────────────────────────────────────────
        att_id = sheets_fetcher.extract_sheet_id(att_url)
        leave_id = sheets_fetcher.extract_sheet_id(leave_url) if leave_url else ""

        # Validate connection before saving
        result = sheets_fetcher.validate_connection(att_id, leave_id or None, api_key)
        if not result["ok"]:
            raise HTTPException(status_code=400, detail=result["error"])

        cfg["admin_attendance_sheet_id"] = att_id
        cfg["admin_leave_sheet_id"] = leave_id
        cfg["google_api_key"] = api_key
        _write_config(cfg)

        await _reload_from_sheets(att_id, leave_id, api_key)
        asyncio.ensure_future(_sheets_poll_loop())
        return {"status": "saved", "mode": "sheets", "attendance_sheet_id": att_id}

    elif att_path:
        # ── Excel file mode (legacy) ────────────────────────────────────────
        if not os.path.exists(att_path):
            raise HTTPException(status_code=400, detail=f"File not found: {att_path}")

        cfg["admin_attendance_path"] = att_path
        cfg["admin_leave_path"] = leave_path
        _write_config(cfg)

        database.register_watch_path("attendance", att_path)
        if leave_path and os.path.exists(leave_path):
            database.register_watch_path("leave", leave_path)

        loop = asyncio.get_event_loop()
        watcher.set_reload_callback(_reload_from_paths, loop)
        watcher.start_watcher(os.path.dirname(os.path.abspath(att_path)))

        await _reload_from_paths(att_path)
        return {"status": "saved", "mode": "excel", "watching": True}

    else:
        raise HTTPException(
            status_code=400,
            detail="Provide either (attendance_sheet_url + google_api_key) or attendance_path."
        )


@app.websocket("/ws/live")
async def websocket_live(websocket: WebSocket):
    await ws_module.manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()  # keep-alive ping/pong
    except WebSocketDisconnect:
        ws_module.manager.disconnect(websocket)


@app.post("/api/set-watch-paths")
async def set_watch_paths(attendance_path: str, leave_path: Optional[str] = None):
    """Register file paths to watch. Backend will auto-reload when these files change."""
    if not os.path.exists(attendance_path):
        raise HTTPException(status_code=400, detail=f"Attendance file not found: {attendance_path}")

    database.register_watch_path("attendance", attendance_path)
    if leave_path:
        database.register_watch_path("leave", leave_path)

    watch_dir = os.path.dirname(os.path.abspath(attendance_path))
    loop = asyncio.get_event_loop()
    watcher.set_reload_callback(_reload_from_paths, loop)
    watcher.start_watcher(watch_dir)

    # Immediately parse and cache
    await _reload_from_paths(attendance_path)

    return {"status": "watching", "watch_dir": watch_dir, "attendance": attendance_path, "leave": leave_path}


@app.post("/api/notify-save")
async def notify_save(body: dict):
    """Called by Excel VBA macro on save. Triggers reload + WebSocket broadcast."""
    file_path = body.get("file_path", "")
    if not file_path:
        raise HTTPException(status_code=400, detail="file_path required")
    await _reload_from_paths(file_path)
    return {"status": "ok", "connections": ws_module.manager.connection_count}


@app.get("/api/cached-dashboard")
async def get_cached_dashboard():
    """Return the last parsed dashboard from SQLite cache (instant, no file upload needed)."""
    cfg = _read_config()

    if _is_sheets_mode(cfg):
        # ── Google Sheets mode ──────────────────────────────────────────────
        cached = database.get_latest_cache_entry()
        if cached is None:
            att_id   = sheets_fetcher.extract_sheet_id(cfg["admin_attendance_sheet_id"])
            leave_id = sheets_fetcher.extract_sheet_id(cfg.get("admin_leave_sheet_id", ""))
            api_key  = cfg["google_api_key"].strip()
            await _reload_from_sheets(att_id, leave_id, api_key)
            cached = database.get_latest_cache_entry()
            if cached is None:
                raise HTTPException(status_code=500, detail="Failed to load data from Google Sheets.")
        dashboard_data, analytics_data = cached
        return {"dashboard": dashboard_data, "analytics": analytics_data}

    # ── Excel file mode ─────────────────────────────────────────────────────
    paths = database.get_watch_paths()
    att_path = paths.get("attendance", "")
    leave_path = paths.get("leave", "")

    if not att_path or not os.path.exists(att_path):
        raise HTTPException(status_code=404, detail="No data source configured. Use /api/admin/config first.")

    att_hash = database.get_path_hash(att_path)
    leave_hash = database.get_path_hash(leave_path) if leave_path and os.path.exists(leave_path) else "none"

    if att_hash is None:
        raise HTTPException(status_code=404, detail="Attendance file not readable.")

    cached = database.load_from_cache(att_hash, leave_hash)
    if cached is None:
        await _reload_from_paths(att_path)
        att_hash = database.get_path_hash(att_path)
        cached = database.load_from_cache(att_hash, leave_hash or "none")
        if cached is None:
            raise HTTPException(status_code=500, detail="Parsing failed.")

    dashboard_data, analytics_data = cached
    return {"dashboard": dashboard_data, "analytics": analytics_data}


@app.get("/api/admin/export")
async def export_dashboard_csv():
    """
    Generate a combined CSV report from cached dashboard data (attendance + leave).
    Works for both Google Sheets mode and Excel file mode.
    Two sections: Summary (one row per employee) + Daily Detail (one row per employee-day).
    """
    import csv
    import io

    cached = database.get_latest_cache_entry()
    if cached is None:
        raise HTTPException(status_code=404, detail="No dashboard data available. Load the dashboard first.")

    dashboard_data, _ = cached
    employees = dashboard_data.get("employees", [])
    dates = dashboard_data.get("dates_processed", [])

    output = io.StringIO()
    writer = csv.writer(output)

    # ── Section 1: Summary ───────────────────────────────────────────────────
    writer.writerow(["=== ATTENDANCE SUMMARY ==="])
    writer.writerow([
        "EMP ID", "Name", "Department",
        "Total Hours", "Weekday Hours", "Weekend Hours",
        "Working Days", "Weekend Days", "WFH Days",
        "Leave Days", "Absent Days",
    ])
    for emp in employees:
        s = emp["summary"]
        writer.writerow([
            emp["emp_id"], emp["name"], emp["department"],
            s["total_hours"], s["weekday_hours"], s["weekend_hours"],
            s["working_days"], s["weekend_days"], s["wfh_days"],
            s["leave_days"], s["absent_days"],
        ])

    writer.writerow([])  # blank separator

    # ── Section 2: Daily Detail ──────────────────────────────────────────────
    writer.writerow(["=== DAILY ATTENDANCE DETAIL ==="])
    writer.writerow([
        "EMP ID", "Name", "Department",
        "Date", "Day", "Status", "In Time", "Out Time", "Hours",
    ])
    for emp in employees:
        for day in emp.get("daily", []):
            writer.writerow([
                emp["emp_id"], emp["name"], emp["department"],
                day["date"], day["weekday"], day["status"],
                day["in_time"], day["out_time"], day["total_hhmm"],
            ])

    csv_bytes = output.getvalue().encode("utf-8-sig")  # BOM for Excel compatibility
    filename = f"Attendance_Report_{dates[0]}_to_{dates[-1]}.csv" if dates else "Attendance_Report.csv"
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@app.get("/api/admin/underperformers")
async def get_underperformers_from_cache(
    period: str = Query("month"),
    threshold_hours: int = Query(40),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
):
    """Get underperforming employees from cached dashboard data (no file upload needed)."""
    cached = database.get_latest_cache_entry()
    if cached is None:
        raise HTTPException(status_code=404, detail="No cached data. Load the dashboard first.")
    dashboard_data, _ = cached
    if start_date and end_date:
        filtered = analytics.filter_data_by_date_range(dashboard_data, start_date, end_date)
    else:
        fs, fe = analytics.get_date_range(period, dashboard_data["dates_processed"])
        filtered = analytics.filter_data_by_date_range(dashboard_data, fs, fe)
    return analytics.get_underperforming_employees(filtered, period, threshold_hours)


@app.post("/api/sheets/refresh")
async def refresh_sheets():
    """Manually trigger a re-fetch from Google Sheets (force bypass cache)."""
    cfg = _read_config()
    if not _is_sheets_mode(cfg):
        raise HTTPException(status_code=400, detail="Not in Google Sheets mode.")
    att_id   = sheets_fetcher.extract_sheet_id(cfg["admin_attendance_sheet_id"])
    leave_id = sheets_fetcher.extract_sheet_id(cfg.get("admin_leave_sheet_id", ""))
    api_key  = cfg["google_api_key"].strip()
    updated = await _reload_from_sheets(att_id, leave_id, api_key)
    return {"refreshed": updated}


@app.get("/api/watch-status")
async def watch_status():
    """Returns current watch path config and last-parsed info."""
    paths = database.get_watch_paths()
    info = database.get_last_parsed_info()
    return {
        "watching": bool(paths.get("attendance")),
        "paths": paths,
        "last_parsed": info,
        "connected_dashboards": ws_module.manager.connection_count,
    }


@app.post("/api/analytics/underperformers")
async def get_underperforming_employees_endpoint(
    attendance_file: UploadFile = File(...),
    leave_file: Optional[UploadFile] = File(None),
    period: str = Query("week", description="Time period: week, month, year"),
    threshold_hours: int = Query(40, description="Minimum hours threshold"),
    start_date: Optional[str] = Query(None, description="Start date for custom period (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date for custom period (YYYY-MM-DD)"),
):
    """Get employees working below threshold hours."""
    if not attendance_file.filename or not attendance_file.filename.endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Attendance file must be .xlsx")

    attendance_bytes = await attendance_file.read()
    leave_bytes = None
    if leave_file and leave_file.filename:
        leave_bytes = await leave_file.read()

    dashboard_data = parser.build_dashboard_data(attendance_bytes, leave_bytes)
    
    # Apply custom date filtering if provided
    if start_date and end_date:
        filtered_data = analytics.filter_data_by_date_range(dashboard_data, start_date, end_date)
    else:
        filter_start, filter_end = analytics.get_date_range(period, dashboard_data["dates_processed"])
        filtered_data = analytics.filter_data_by_date_range(dashboard_data, filter_start, filter_end)
    
    underperformers = analytics.get_underperforming_employees(filtered_data, period, threshold_hours)
    
    return underperformers
