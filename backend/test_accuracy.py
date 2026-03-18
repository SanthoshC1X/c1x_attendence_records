"""
Accuracy test for the Google Sheets parser.

Runs against the live Google Sheets configured in config.json and
prints a detailed accuracy report -- does NOT modify any production data.

Usage:
    python -m backend.test_accuracy
  or:
    cd c:\\C1XPROJECT\\c1x_attendence_records
    python backend/test_accuracy.py
"""

import json
import os
import sys
from datetime import datetime
from collections import defaultdict

# -- Load config --------------------------------------------------------------
CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.json")

def load_config():
    try:
        with open(CONFIG_PATH) as f:
            return json.load(f)
    except FileNotFoundError:
        print("ERROR: config.json not found. Make sure you run from the project root.")
        sys.exit(1)

# -- Helpers ------------------------------------------------------------------
def pct(n, total):
    return f"{n/total*100:.1f}%" if total else "N/A"

def bar(n, total, width=30):
    filled = int(width * n / total) if total else 0
    return "#" * filled + "." * (width - filled)

def sep(char="-", width=65):
    print(char * width)

def header(title):
    sep("=")
    print(f"  {title}")
    sep("=")

def section(title):
    print()
    sep()
    print(f"  {title}")
    sep()

# -- Main test ----------------------------------------------------------------
def run():
    cfg = load_config()

    att_id   = cfg.get("admin_attendance_sheet_id", "").strip()
    leave_id = cfg.get("admin_leave_sheet_id", "").strip()
    api_key  = cfg.get("google_api_key", "").strip()

    if not att_id or not api_key:
        print("ERROR: Google Sheets not configured in config.json")
        sys.exit(1)

    header("C1X ATTENDANCE PARSER -- ACCURACY REPORT")
    print(f"  Attendance sheet : {att_id[:20]}...")
    print(f"  Leave sheet      : {leave_id[:20]}..." if leave_id else "  Leave sheet      : (not configured)")
    print(f"  Run time         : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # -- Step 1: Raw tab listing -----------------------------------------------
    section("1. SHEET TAB DISCOVERY")
    from backend.sheets_fetcher import get_sheet_tabs, get_sheet_values

    try:
        att_tabs = get_sheet_tabs(att_id, api_key)
        print(f"  [OK] Attendance sheet accessible -- {len(att_tabs)} tab(s) found")
    except Exception as e:
        print(f"  [FAIL] Cannot access attendance sheet: {e}")
        sys.exit(1)

    leave_tabs = []
    if leave_id:
        try:
            leave_tabs = get_sheet_tabs(leave_id, api_key)
            print(f"  [OK] Leave sheet accessible -- {len(leave_tabs)} tab(s) found")
        except Exception as e:
            print(f"  [FAIL] Cannot access leave sheet: {e}")

    # Classify attendance tabs
    date_tabs, skipped_tabs = [], []
    for tab in att_tabs:
        try:
            datetime.strptime(tab["name"].strip(), "%d-%m-%Y")
            date_tabs.append(tab)
        except ValueError:
            skipped_tabs.append(tab["name"])

    print(f"\n  Attendance tabs  : {len(att_tabs)} total")
    print(f"    [OK] Valid date tabs (DD-MM-YYYY) : {len(date_tabs)}")
    if skipped_tabs:
        print(f"    [FAIL] Skipped (wrong format)       : {len(skipped_tabs)}")
        for t in skipped_tabs[:5]:
            print(f"        +- '{t}'")
        if len(skipped_tabs) > 5:
            print(f"        +- ... and {len(skipped_tabs)-5} more")

    # -- Step 2: Row-level parsing accuracy -----------------------------------
    section("2. RAW ROW PARSING ACCURACY")

    total_rows         = 0
    skipped_no_id      = 0
    skipped_no_name    = 0
    skipped_total_rows = 0
    parsed_rows        = 0

    has_in_and_out     = 0
    has_in_only        = 0
    has_out_only       = 0
    has_neither        = 0
    time_from_sheet    = 0
    time_computed      = 0
    time_missing       = 0

    emp_dates: dict[str, set] = defaultdict(set)
    name_per_emp: dict[str, str] = {}
    dept_per_emp: dict[str, str] = {}

    from backend.parser import parse_time_value, time_to_minutes

    print(f"\n  Scanning {len(date_tabs)} date tab(s)... (may take a moment)")

    for tab in date_tabs:
        tab_name = tab["name"].strip()
        rows = get_sheet_values(att_id, api_key, tab_name)
        data_rows = rows[7:] if len(rows) > 7 else []

        for row in data_rows:
            total_rows += 1

            # emp ID check
            emp_id_raw = row[1] if len(row) > 1 else None
            if emp_id_raw is None or str(emp_id_raw).strip() == "":
                skipped_no_id += 1
                continue
            emp_id_str = str(emp_id_raw).strip()
            if emp_id_str.lower() in ("total", "grand total"):
                skipped_total_rows += 1
                continue
            try:
                emp_id = str(int(float(emp_id_str)))
            except (ValueError, TypeError):
                skipped_no_id += 1
                continue

            # name check
            raw_name = row[2] if len(row) > 2 else None
            emp_name = str(raw_name).strip() if raw_name else ""
            if not emp_name:
                skipped_no_name += 1
                continue

            parsed_rows += 1
            name_per_emp[emp_id] = emp_name
            dept_raw = row[3] if len(row) > 3 else None
            dept_per_emp[emp_id] = str(dept_raw).strip() if dept_raw else "Unknown"

            in_time  = parse_time_value(row[5] if len(row) > 5 else None)
            out_time = parse_time_value(row[6] if len(row) > 6 else None)
            total_str = parse_time_value(row[7] if len(row) > 7 else None)
            total_min = time_to_minutes(total_str)

            if in_time and out_time:
                has_in_and_out += 1
                emp_dates[emp_id].add(tab_name)
            elif in_time:
                has_in_only += 1
                emp_dates[emp_id].add(tab_name)
            elif out_time:
                has_out_only += 1
                emp_dates[emp_id].add(tab_name)
            else:
                has_neither += 1

            if total_min is not None:
                time_from_sheet += 1
            elif in_time and out_time:
                in_m  = time_to_minutes(in_time)
                out_m = time_to_minutes(out_time)
                if in_m is not None and out_m is not None and out_m > in_m:
                    time_computed += 1
                else:
                    time_missing += 1
            else:
                time_missing += 1

    print(f"\n  Total raw rows read       : {total_rows}")
    print(f"  Skipped -- no/invalid ID   : {skipped_no_id}")
    print(f"  Skipped -- 'total' rows    : {skipped_total_rows}")
    print(f"  Skipped -- no name         : {skipped_no_name}")
    print(f"  [OK] Successfully parsed     : {parsed_rows}  ({pct(parsed_rows, total_rows)} of all rows)")

    print(f"\n  Punch completeness ({parsed_rows} parsed rows):")
    print(f"    Both IN + OUT : {has_in_and_out:5d}  {bar(has_in_and_out, parsed_rows)}  {pct(has_in_and_out, parsed_rows)}")
    print(f"    IN only       : {has_in_only:5d}  {bar(has_in_only, parsed_rows)}  {pct(has_in_only, parsed_rows)}")
    print(f"    OUT only      : {has_out_only:5d}  {bar(has_out_only, parsed_rows)}  {pct(has_out_only, parsed_rows)}")
    print(f"    No punch      : {has_neither:5d}  {bar(has_neither, parsed_rows)}  {pct(has_neither, parsed_rows)}")

    print(f"\n  Total hours accuracy:")
    print(f"    From sheet (direct)  : {time_from_sheet:5d}  {pct(time_from_sheet, parsed_rows)}")
    print(f"    Computed (IN-OUT)    : {time_computed:5d}  {pct(time_computed, parsed_rows)}")
    print(f"    Missing / unresolved : {time_missing:5d}  {pct(time_missing, parsed_rows)}")

    # -- Step 3: Employee summary ----------------------------------------------
    section("3. EMPLOYEE COVERAGE")

    total_emps = len(name_per_emp)
    print(f"\n  Unique employees found : {total_emps}")

    # Department breakdown
    dept_counts: dict[str, int] = defaultdict(int)
    for dept in dept_per_emp.values():
        dept_counts[dept] += 1

    print(f"\n  Department breakdown:")
    for dept, cnt in sorted(dept_counts.items(), key=lambda x: -x[1])[:10]:
        print(f"    {dept:<30s}  {cnt:3d}  {bar(cnt, total_emps, 20)}  {pct(cnt, total_emps)}")
    if len(dept_counts) > 10:
        print(f"    ... and {len(dept_counts)-10} more departments")

    # Date coverage per employee
    date_counts = [len(v) for v in emp_dates.values()]
    if date_counts:
        avg_dates = sum(date_counts) / len(date_counts)
        min_dates = min(date_counts)
        max_dates = max(date_counts)
        print(f"\n  Days with attendance data (per employee):")
        print(f"    Avg: {avg_dates:.1f}  |  Min: {min_dates}  |  Max: {max_dates}")

        # Histogram buckets
        buckets = {"0": 0, "1-5": 0, "6-10": 0, "11-15": 0, "16-20": 0, "21+": 0}
        for c in date_counts:
            if   c == 0:  buckets["0"] += 1
            elif c <= 5:  buckets["1-5"] += 1
            elif c <= 10: buckets["6-10"] += 1
            elif c <= 15: buckets["11-15"] += 1
            elif c <= 20: buckets["16-20"] += 1
            else:         buckets["21+"] += 1
        for label, cnt in buckets.items():
            print(f"    {label:>6} days : {cnt:4d}  {bar(cnt, total_emps, 20)}")

    # -- Step 4: Leave sheet cross-check --------------------------------------
    if leave_tabs:
        section("4. LEAVE SHEET CROSS-CHECK")

        leave_emp_ids: set[str] = set()
        leave_status_counts: dict[str, int] = defaultdict(int)
        leave_rows_parsed = 0
        leave_rows_skipped_no_name = 0

        from backend.parser import MONTH_MAP
        from calendar import monthrange

        year = None
        if date_tabs:
            try:
                year = datetime.strptime(date_tabs[0]["name"].strip(), "%d-%m-%Y").year
            except Exception:
                pass

        for tab in leave_tabs:
            clean = tab["name"].strip().lower()
            month_num = MONTH_MAP.get(clean)
            if month_num is None:
                continue

            rows = get_sheet_values(leave_id, api_key, tab["name"])
            if not rows:
                continue

            yr = year or datetime.now().year
            days_in_month = monthrange(yr, month_num)[1]

            # Auto-detect header
            header_row_idx = 0
            day_col_start = 3
            for row_idx, row in enumerate(rows[:5]):
                for col_idx, val in enumerate(row):
                    if val is not None and str(val).strip():
                        try:
                            if int(float(str(val))) == 1:
                                nxt = row[col_idx + 1] if col_idx + 1 < len(row) else None
                                if nxt is not None and int(float(str(nxt))) == 2:
                                    header_row_idx = row_idx
                                    day_col_start = col_idx
                                    break
                        except (ValueError, TypeError):
                            pass
                else:
                    continue
                break

            for row in rows[header_row_idx + 1:]:
                if not row or len(row) < day_col_start + 1:
                    continue
                emp_id_raw = row[1] if len(row) > 1 else None
                if not emp_id_raw or str(emp_id_raw).strip() == "":
                    continue
                emp_id_str = str(emp_id_raw).strip()
                if emp_id_str.lower() in ("total", "grand total", "nan"):
                    continue
                try:
                    emp_id = str(int(float(emp_id_str)))
                except (ValueError, TypeError):
                    continue

                name_raw = row[2] if len(row) > 2 else None
                name = str(name_raw).strip() if name_raw else ""
                if not name:
                    leave_rows_skipped_no_name += 1
                    continue

                leave_emp_ids.add(emp_id)
                leave_rows_parsed += 1

                from backend.parser import LEAVE_STATUSES
                for day in range(1, days_in_month + 1):
                    col_idx = day_col_start + (day - 1)
                    val = row[col_idx] if col_idx < len(row) else None
                    if val is None or str(val).strip() == "":
                        continue
                    status = str(val).strip().upper()
                    if status in ("NAN", "NONE", ""):
                        continue
                    if status in ("COMP OFF", "COMPOFF", "COMP-OFF"):
                        status = "COMP OFF"
                    elif status in ("1/2 CL", "HALF CL"):
                        status = "1/2CL"
                    elif status in ("1/2 SL", "HALF SL"):
                        status = "1/2SL"
                    if status in LEAVE_STATUSES:
                        leave_status_counts[status] += 1

        att_emp_ids = set(name_per_emp.keys())
        in_both  = att_emp_ids & leave_emp_ids
        att_only = att_emp_ids - leave_emp_ids
        leave_only = leave_emp_ids - att_emp_ids

        print(f"\n  Leave rows parsed         : {leave_rows_parsed}")
        print(f"  Leave rows skipped (no name): {leave_rows_skipped_no_name}")
        print(f"  Unique employees in leave : {len(leave_emp_ids)}")
        print(f"\n  Overlap with attendance sheet:")
        print(f"    In BOTH sheets  : {len(in_both):4d}  {pct(len(in_both), total_emps)} of attendance employees")
        print(f"    Attendance only : {len(att_only):4d}")
        print(f"    Leave only      : {len(leave_only):4d}")

        if att_only:
            print(f"\n  Employees in attendance but NOT in leave sheet (first 10):")
            for eid in sorted(att_only, key=int)[:10]:
                print(f"    ID {eid:<6s} -- {name_per_emp.get(eid, '?')}")

        print(f"\n  Leave type distribution:")
        total_leave = sum(leave_status_counts.values())
        for status, cnt in sorted(leave_status_counts.items(), key=lambda x: -x[1]):
            print(f"    {status:<12s} : {cnt:5d}  {bar(cnt, total_leave, 20)}  {pct(cnt, total_leave)}")

    else:
        section("4. LEAVE SHEET CROSS-CHECK")
        print("  (Leave sheet not configured -- skipped)")

    # -- Step 5: Overall accuracy score ---------------------------------------
    section("5. OVERALL ACCURACY SCORE")

    scores = {}

    # A) Tab discovery -- what % of tabs were valid date tabs
    tab_score = len(date_tabs) / len(att_tabs) * 100 if att_tabs else 0
    scores["Tab format compliance"] = tab_score
    print(f"  Tab format (DD-MM-YYYY) : {tab_score:.1f}%  -- {len(date_tabs)}/{len(att_tabs)} tabs usable")

    # B) Row parse rate -- parsed vs total (excl. total/separator rows)
    meaningful = total_rows - skipped_total_rows
    row_score = parsed_rows / meaningful * 100 if meaningful else 0
    scores["Row parse rate"] = row_score
    print(f"  Row parse rate          : {row_score:.1f}%  -- {parsed_rows}/{meaningful} data rows usable")

    # C) Punch completeness -- rows with at least one punch
    punched = has_in_and_out + has_in_only + has_out_only
    punch_score = punched / parsed_rows * 100 if parsed_rows else 0
    scores["Punch completeness"] = punch_score
    print(f"  Punch completeness      : {punch_score:.1f}%  -- {punched}/{parsed_rows} rows have at least one time")

    # D) Full punch (both in + out)
    full_punch_score = has_in_and_out / parsed_rows * 100 if parsed_rows else 0
    scores["Full punch (IN+OUT)"] = full_punch_score
    print(f"  Full punch (IN+OUT)     : {full_punch_score:.1f}%  -- {has_in_and_out}/{parsed_rows} rows have both times")

    # E) Total-time availability
    time_avail = (time_from_sheet + time_computed) / parsed_rows * 100 if parsed_rows else 0
    scores["Total-time availability"] = time_avail
    print(f"  Total-time availability : {time_avail:.1f}%  -- {time_from_sheet+time_computed}/{parsed_rows} rows have computable hours")

    # F) Employee-level cross-sheet match (if leave sheet available)
    if leave_tabs and total_emps:
        match_score = len(in_both) / total_emps * 100
        scores["Attendance<->Leave match"] = match_score
        print(f"  Att<->Leave emp match     : {match_score:.1f}%  -- {len(in_both)}/{total_emps} employees in both sheets")

    overall = sum(scores.values()) / len(scores)
    sep("-")
    print(f"  OVERALL ACCURACY ESTIMATE : {overall:.1f}%")
    sep("=")

    if overall >= 90:
        print("  Grade: EXCELLENT -- data quality is very high.")
    elif overall >= 75:
        print("  Grade: GOOD -- minor gaps but mostly usable.")
    elif overall >= 55:
        print("  Grade: FAIR -- some issues worth investigating.")
    else:
        print("  Grade: POOR -- significant data quality problems.")

    sep("=")
    print()


if __name__ == "__main__":
    # Allow running as a plain script from project root
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if project_root not in sys.path:
        sys.path.insert(0, project_root)
    run()
