import { useState, useMemo, type Dispatch, type SetStateAction } from "react";
import type { AppPage, DashboardData, AnalyticsData, EmployeeDashboard, EmployeeWeekStats, PeriodState, PeriodActions } from "../types";
import { avatarColor, initials, getMonthIsoWeeks } from "../utils";
import EmployeeSlideOver from "../components/EmployeeSlideOver";

interface Props {
  dashboard: DashboardData;
  analyticsData: AnalyticsData | null;
  onNavigate: (page: AppPage, filter?: string) => void;
  periodState: PeriodState;
  periodActions: PeriodActions;
  search: string;
  onSearchChange: (v: string) => void;
  leaveFilter: LeaveFilter;
  onLeaveFilterChange: (v: LeaveFilter) => void;
  sortKey: SortKey;
  onSortKeyChange: (v: SortKey) => void;
  minHours: number;
  onMinHoursChange: (v: number) => void;
  hoursDir: "gte" | "lte";
  onHoursDirChange: Dispatch<SetStateAction<"gte" | "lte">>;
}

type SortKey = "name" | "absent" | "leave" | "wfh" | "hours";
type LeaveFilter = "all" | "wfh" | "cl" | "sl" | "pl" | "comp_off" | "half_leave" | "absent";

const LEAVE_TYPE_CONFIG = [
  { key: "absent",     label: "Absent",       fullLabel: "Absent Days",      bg: "bg-red-50",     border: "border-red-100",     text: "text-red-700",     bar: "bg-red-400",     dot: "bg-red-400",     activeBg: "bg-red-500",    color: "#f87171" },
  { key: "wfh",        label: "WFH",          fullLabel: "Work From Home",   bg: "bg-teal-50",    border: "border-teal-100",    text: "text-teal-700",    bar: "bg-teal-400",    dot: "bg-teal-400",    activeBg: "bg-teal-500",   color: "#2dd4bf" },
  { key: "cl",         label: "Casual Leave", fullLabel: "Casual Leave",     bg: "bg-blue-50",    border: "border-blue-100",    text: "text-blue-700",    bar: "bg-blue-400",    dot: "bg-blue-400",    activeBg: "bg-blue-500",   color: "#60a5fa" },
  { key: "sl",         label: "Sick Leave",   fullLabel: "Sick Leave",       bg: "bg-purple-50",  border: "border-purple-100",  text: "text-purple-700",  bar: "bg-purple-400",  dot: "bg-purple-400",  activeBg: "bg-purple-500", color: "#c084fc" },
  { key: "pl",         label: "Privilege",    fullLabel: "Privilege Leave",  bg: "bg-violet-50",  border: "border-violet-100",  text: "text-violet-700",  bar: "bg-violet-400",  dot: "bg-violet-400",  activeBg: "bg-violet-500", color: "#a78bfa" },
  { key: "comp_off",   label: "Comp Off",     fullLabel: "Compensatory Off", bg: "bg-amber-50",   border: "border-amber-100",   text: "text-amber-700",   bar: "bg-amber-400",   dot: "bg-amber-400",   activeBg: "bg-amber-500",  color: "#fbbf24" },
  { key: "half_leave", label: "Half Day",     fullLabel: "Half Day Leave",   bg: "bg-yellow-50",  border: "border-yellow-100",  text: "text-yellow-700",  bar: "bg-yellow-400",  dot: "bg-yellow-300",  activeBg: "bg-yellow-400", color: "#facc15" },
] as const;

export default function OverviewPage({
  dashboard, analyticsData, periodState, periodActions,
  search, onSearchChange: setSearch,
  leaveFilter, onLeaveFilterChange: setLeaveFilter,
  sortKey, onSortKeyChange: setSortKey,
  minHours, onMinHoursChange: setMinHours,
  hoursDir, onHoursDirChange: setHoursDir,
}: Props) {
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeDashboard | null>(null);
  const [panelSearch, setPanelSearch] = useState("");

  // ── Period state from header ──────────────────────────────────────────────
  const { periodMode, selMonth, selYear, selWeek, customFrom, customTo } = periodState;
  const { setPeriodMode, setSelMonth, setSelYear } = periodActions;

  const employees: EmployeeDashboard[] =
    analyticsData?.filtered_data?.employees ?? dashboard.employees;

  // ── Period helpers (defined first so all derived data can use them) ────────
  const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const monthIsoWeeks = getMonthIsoWeeks(selYear, selMonth);
  const clampedWeek   = Math.min(selWeek, monthIsoWeeks.length);

  const dateInPeriod = (dateStr: string): boolean => {
    if (!dateStr) return false;
    const d = new Date(dateStr + "T00:00:00");
    const today = new Date(); today.setHours(0, 0, 0, 0);
    switch (periodMode) {
      case "yesterday": {
        const yest = new Date(today); yest.setDate(yest.getDate() - 1);
        return d.getTime() === yest.getTime();
      }
      case "today": {
        const ref = customFrom ? new Date(customFrom + "T00:00:00") : today;
        ref.setHours(0, 0, 0, 0);
        return d.getTime() === ref.getTime();
      }
      case "year":  return d.getFullYear() === selYear;
      case "month": return d.getFullYear() === selYear && d.getMonth() === selMonth;
      case "week": {
        const w = monthIsoWeeks[clampedWeek - 1];
        if (!w) return false;
        return d.getTime() >= w.start.getTime() && d.getTime() <= w.end.getTime();
      }
      case "custom": {
        const from = customFrom ? new Date(customFrom + "T00:00:00").getTime() : -Infinity;
        const to   = customTo   ? new Date(customTo   + "T23:59:59").getTime() :  Infinity;
        return d.getTime() >= from && d.getTime() <= to;
      }
    }
  };

  const isMissPunch = (d: { in_time: string; out_time: string; is_weekend?: boolean }) =>
    !d.is_weekend && d.in_time && d.out_time && d.in_time === d.out_time && d.in_time !== "00:00:00";

  // Format a possibly-fractional day count as "1½" / "½" / "2" rather than "1.5" / "0.5" / "2".
  const fmtDays = (v: number): string => {
    if (v <= 0) return "0";
    const whole = Math.floor(v);
    const hasHalf = v % 1 !== 0;
    if (!hasHalf) return String(whole);
    return whole > 0 ? `${whole}½` : "½";
  };

  const getPeriodStats = (emp: EmployeeDashboard) => {
    const days = emp.daily.filter(d => dateInPeriod(d.date));
    // Half-day events per subtype (each event = 0.5 of a day)
    const halfCl   = days.filter(d => d.leave_subtype === "half_cl").length;
    const halfSl   = days.filter(d => d.leave_subtype === "half_sl").length;
    const halfPl   = days.filter(d => d.leave_subtype === "half_pl").length;
    const halfWfh  = days.filter(d => d.leave_subtype === "half_wfh").length;
    const halfComp = days.filter(d => d.leave_subtype === "half_comp").length;
    // Day-equivalents: full + 0.5 × half
    const absent    = days.filter(d => d.status_type === "absent").length;
    const wfh       = days.filter(d => d.status_type === "wfh").length        + halfWfh  * 0.5;
    const cl        = days.filter(d => d.leave_subtype === "cl").length       + halfCl   * 0.5;
    const sl        = days.filter(d => d.leave_subtype === "sl").length       + halfSl   * 0.5;
    const pl        = days.filter(d => d.leave_subtype === "pl").length       + halfPl   * 0.5;
    const comp      = days.filter(d => d.status_type === "comp_off").length   + halfComp * 0.5;
    const half      = days.filter(d => d.status_type === "half_leave").length; // total half-day events (informational)
    const misspunch = days.filter(d => isMissPunch(d)).length;
    const working   = days.filter(d => d.status_type === "present" || d.status_type === "wfh" || d.status_type === "half_leave").length;
    const totalMins = days.reduce((s, d) => s + (d.total_minutes ?? 0), 0);
    const hrs  = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return { absent, wfh, cl, sl, pl, comp, half, halfCl, halfSl, halfPl, halfWfh, halfComp, misspunch, working,
      totalHours: totalMins > 0 ? `${hrs}:${String(mins).padStart(2, "0")}` : "—",
      hasData: days.length > 0 };
  };

  // Single period-aware counter — replaces the old unfiltered countSub/countComp/countHalf
  const periodCount = (emp: EmployeeDashboard, filter: string): number => {
    const ps = getPeriodStats(emp);
    if (filter === "absent")     return ps.absent;
    if (filter === "wfh")        return ps.wfh;
    if (filter === "cl")         return ps.cl;
    if (filter === "sl")         return ps.sl;
    if (filter === "pl")         return ps.pl;
    if (filter === "comp_off")   return ps.comp;
    if (filter === "half_leave") return ps.half;
    return 0;
  };

  // ── Period-filtered derived lists ─────────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const absentEmployees = useMemo(() =>
    [...employees].filter(e => getPeriodStats(e).absent > 0)
      .sort((a, b) => getPeriodStats(b).absent - getPeriodStats(a).absent),
    [employees, periodMode, selYear, selMonth, clampedWeek, customFrom, customTo] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const topLeaveEmployees = useMemo(() => {
    // cl/sl/pl/comp/wfh already include half-day contributions at 0.5 — don't add p.half again
    const tot = (e: EmployeeDashboard) => { const p = getPeriodStats(e); return p.cl+p.sl+p.pl+p.comp+p.wfh+p.absent; };
    return [...employees].filter(e => tot(e) > 0).sort((a, b) => tot(b) - tot(a));
  }, [employees, periodMode, selYear, selMonth, clampedWeek, customFrom, customTo]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Side panel employees (for clicked leave type) — period-filtered ───────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const panelEmployees = useMemo(() => {
    if (leaveFilter === "all") return [];
    let list = [...employees].filter(e => periodCount(e, leaveFilter) > 0);
    if (panelSearch.trim()) {
      const q = panelSearch.toLowerCase();
      list = list.filter(e => e.name.toLowerCase().includes(q) || e.emp_id.toLowerCase().includes(q));
    }
    return list.sort((a, b) => periodCount(b, leaveFilter) - periodCount(a, leaveFilter));
  }, [leaveFilter, employees, panelSearch, periodMode, selYear, selMonth, clampedWeek, customFrom, customTo]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Period-based aggregates (for KPI cards + donut) ─────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const periodAgg = useMemo(() => {
    const pEmps = employees.filter(e => e.daily.some(d => dateInPeriod(d.date)));
    const stats  = pEmps.map(e => getPeriodStats(e));
    const sum    = (fn: (p: ReturnType<typeof getPeriodStats>) => number) => stats.reduce((s, p) => s + fn(p), 0);
    const cnt    = (fn: (p: ReturnType<typeof getPeriodStats>) => number) => stats.filter(p => fn(p) > 0).length;
    return {
      hasData:  pEmps.length > 0,
      empCount: pEmps.length,
      absent:     sum(p => p.absent),     absentEmp:     cnt(p => p.absent),
      wfh:        sum(p => p.wfh),        wfhEmp:        cnt(p => p.wfh),
      cl:         sum(p => p.cl),         clEmp:         cnt(p => p.cl),
      sl:         sum(p => p.sl),         slEmp:         cnt(p => p.sl),
      pl:         sum(p => p.pl),         plEmp:         cnt(p => p.pl),
      comp:       sum(p => p.comp),       compEmp:       cnt(p => p.comp),
      half:       sum(p => p.half),       halfEmp:       cnt(p => p.half),
      halfCl:     sum(p => p.halfCl),
      halfSl:     sum(p => p.halfSl),
      halfPl:     sum(p => p.halfPl),
      halfWfh:    sum(p => p.halfWfh),
      halfComp:   sum(p => p.halfComp),
      misspunch:  sum(p => p.misspunch),  misspunchEmp:  cnt(p => p.misspunch),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees, periodMode, selYear, selMonth, clampedWeek, customFrom, customTo]);

  const leaveCountByKey: Record<string, number> = {
    absent: periodAgg.absent, wfh: periodAgg.wfh, cl: periodAgg.cl,
    sl: periodAgg.sl, pl: periodAgg.pl, comp_off: periodAgg.comp, half_leave: periodAgg.half,
  };
  // Exclude half_leave from the total: half-day events are already in cl/sl/pl/wfh/comp at 0.5 each.
  const totalLeaveEvents = (["absent", "wfh", "cl", "sl", "pl", "comp_off"] as const)
    .reduce((s, k) => s + (leaveCountByKey[k] ?? 0), 0);

  const DONUT_R    = 70;
  const DONUT_CIRC = 2 * Math.PI * DONUT_R;
  const donutArcs = (() => {
    let cumLen = 0;
    return LEAVE_TYPE_CONFIG.map((lt) => {
      const count  = leaveCountByKey[lt.key] ?? 0;
      const segLen = totalLeaveEvents > 0 ? (count / totalLeaveEvents) * DONUT_CIRC : 0;
      const offset = DONUT_CIRC / 4 - cumLen;
      cumLen += segLen;
      return { key: lt.key, color: lt.color, segLen, offset };
    });
  })();

  // ── Miss Punch employees for the selected period ─────────────────────────
  const missPunchEmployees = useMemo(() => {
    return employees
      .map(e => ({
        emp: e,
        days: e.daily.filter(d => dateInPeriod(d.date) && isMissPunch(d)),
      }))
      .filter(x => x.days.length > 0)
      .sort((a, b) => b.days.length - a.days.length);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees, periodMode, selYear, selMonth, clampedWeek, customFrom, customTo]);

  // ── Period label ──────────────────────────────────────────────────────────
  const periodLabel = (() => {
    if (periodMode === "yesterday") {
      const y = new Date(); y.setDate(y.getDate() - 1);
      return `Yesterday · ${y.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;
    }
    if (periodMode === "today") {
      const ref = customFrom ? new Date(customFrom + "T00:00:00") : new Date();
      return `${ref.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;
    }
    if (periodMode === "year")   return `Year ${selYear}`;
    if (periodMode === "month")  return `${MONTH_NAMES[selMonth]} ${selYear}`;
    if (periodMode === "custom") {
      if (!customFrom && !customTo) return "Custom range (all dates)";
      const fmt = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      if (customFrom && customTo) return `${fmt(customFrom)} – ${fmt(customTo)}`;
      if (customFrom) return `From ${fmt(customFrom)}`;
      return `Until ${fmt(customTo)}`;
    }
    const w = monthIsoWeeks[clampedWeek - 1];
    const range = w ? w.sublabel : `Week ${clampedWeek}`;
    return `Week ${clampedWeek} · ${range}, ${selYear}`;
  })();

  // ── Filter + sort employees (period-based) ────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...employees].filter(e => e.daily.some(d => dateInPeriod(d.date)));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.name.toLowerCase().includes(q) ||
        e.emp_id.toLowerCase().includes(q) ||
        (e.department || "").toLowerCase().includes(q)
      );
    }
    // Leave type filter still active from distribution card click
    if (leaveFilter !== "all") {
      list = list.filter(e => {
        const ps = getPeriodStats(e);
        if (leaveFilter === "wfh")        return ps.wfh > 0;
        if (leaveFilter === "absent")     return ps.absent > 0;
        if (leaveFilter === "cl")         return ps.cl > 0;
        if (leaveFilter === "sl")         return ps.sl > 0;
        if (leaveFilter === "pl")         return ps.pl > 0;
        if (leaveFilter === "comp_off")   return ps.comp > 0;
        if (leaveFilter === "half_leave") return ps.half > 0;
        return true;
      });
    }
    if (sortKey === "absent")     list.sort((a, b) => getPeriodStats(b).absent  - getPeriodStats(a).absent);
    else if (sortKey === "leave") list.sort((a, b) => { const sa = getPeriodStats(a), sb = getPeriodStats(b); return (sb.cl+sb.sl+sb.pl+sb.comp) - (sa.cl+sa.sl+sa.pl+sa.comp); });
    else if (sortKey === "wfh")   list.sort((a, b) => getPeriodStats(b).wfh     - getPeriodStats(a).wfh);
    else if (sortKey === "hours") list.sort((a, b) => { const m = (e: EmployeeDashboard) => e.daily.filter(d => dateInPeriod(d.date)).reduce((s,d) => s+(d.total_minutes??0),0); return m(b)-m(a); });
    else                          list.sort((a, b) => a.name.localeCompare(b.name));
    // Hours filter
    if (minHours > 0) {
      const threshold = minHours * 60;
      list = list.filter(e => {
        const mins = e.daily.filter(d => dateInPeriod(d.date)).reduce((s, d) => s + (d.total_minutes ?? 0), 0);
        return hoursDir === "gte" ? mins >= threshold : mins < threshold;
      });
      // When hours filter active, sort by hours desc
      list.sort((a, b) => {
        const ma = a.daily.filter(d => dateInPeriod(d.date)).reduce((s, d) => s + (d.total_minutes ?? 0), 0);
        const mb = b.daily.filter(d => dateInPeriod(d.date)).reduce((s, d) => s + (d.total_minutes ?? 0), 0);
        return mb - ma;
      });
    }
    return list;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees, search, leaveFilter, sortKey, periodMode, selYear, selMonth, clampedWeek, customFrom, customTo, minHours, hoursDir]);

  const weekStats: EmployeeWeekStats | null = selectedEmployee
    ? (analyticsData?.filtered_data?.employees?.find(e => e.emp_id === selectedEmployee.emp_id)?.week_breakdown ?? null)
    : null;

  // Tooltip describing the half-day-events breakdown by subtype (e.g. "2 ½CL · 1 ½WFH")
  const halfBreakdownTip = (() => {
    const parts = [
      periodAgg.halfWfh  > 0 && `${periodAgg.halfWfh} ½WFH`,
      periodAgg.halfCl   > 0 && `${periodAgg.halfCl} ½CL`,
      periodAgg.halfSl   > 0 && `${periodAgg.halfSl} ½SL`,
      periodAgg.halfPl   > 0 && `${periodAgg.halfPl} ½PL`,
      periodAgg.halfComp > 0 && `${periodAgg.halfComp} ½Comp`,
    ].filter(Boolean);
    return parts.length ? parts.join(" · ") : undefined;
  })();

  // ── KPI cards (period-filtered) ──────────────────────────────────────────
  // Each card's `count` is a day-equivalent (full + 0.5 × half) — fmtDays renders "1½" instead of "1.5".
  // The Half Day card is special: its count is the *number of half-day events*, not day-equivalents.
  const kpiCards: Array<{
    label: string; count: number | string; emp: number | null; sub: string;
    cls: string; labelCls: string; countCls: string; empCls: string; title?: string;
  }> = [
    { label: "Total Employees", count: dashboard.employee_count, emp: null,                sub: `${dashboard.dates_processed.length} days tracked`, cls: "bg-white border border-gray-100",          labelCls: "text-gray-400",  countCls: "text-gray-900",   empCls: "text-gray-400"   },
    { label: "Absent Days",     count: periodAgg.absent,         emp: periodAgg.absentEmp, sub: "days",   cls: "bg-white border border-gray-100",          labelCls: "text-gray-400",  countCls: "text-red-600",    empCls: "text-gray-400"   },
    { label: "WFH Days",        count: periodAgg.wfh,            emp: periodAgg.wfhEmp,    sub: "days",   cls: "bg-white border border-gray-100",          labelCls: "text-gray-400",  countCls: "text-teal-600",   empCls: "text-gray-400"   },
    { label: "Casual Leave",    count: periodAgg.cl,             emp: periodAgg.clEmp,     sub: "days",   cls: "bg-white border border-gray-100",          labelCls: "text-gray-400",  countCls: "text-blue-600",   empCls: "text-gray-400"   },
    { label: "Sick Leave",      count: periodAgg.sl,             emp: periodAgg.slEmp,     sub: "days",   cls: "bg-white border border-gray-100",          labelCls: "text-gray-400",  countCls: "text-purple-600", empCls: "text-gray-400"   },
    { label: "Half Day",        count: periodAgg.half,           emp: periodAgg.halfEmp,   sub: "events", cls: "bg-white border border-gray-100",          labelCls: "text-gray-400",  countCls: "text-yellow-700", empCls: "text-gray-400", title: halfBreakdownTip },
    { label: "Privilege Leave", count: periodAgg.pl,             emp: periodAgg.plEmp,     sub: "days",   cls: "bg-white border border-gray-100",          labelCls: "text-gray-400",  countCls: "text-violet-600", empCls: "text-gray-400"   },
    { label: "Comp Off",        count: periodAgg.comp,           emp: periodAgg.compEmp,       sub: "days",   cls: "bg-white border border-gray-100",      labelCls: "text-gray-400",  countCls: "text-amber-600",   empCls: "text-gray-400"   },
    { label: "Miss Punch",      count: periodAgg.misspunch,      emp: periodAgg.misspunchEmp,  sub: "days",   cls: "bg-white border border-gray-100",      labelCls: "text-gray-400",  countCls: "text-orange-600",  empCls: "text-gray-400"   },
  ];

  // ── No data for period — full-page message ───────────────────────────────
  if (!periodAgg.hasData) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-indigo-100 bg-indigo-50 shadow-sm">
          <svg className="w-10 h-10 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h2 className="mb-2 text-2xl font-black text-gray-800">Data not uploaded yet</h2>
        <p className="mb-1 text-sm text-gray-400">No attendance records found for</p>
        <p className="mb-6 text-base font-bold text-indigo-600">{periodLabel}</p>
        <div className="flex gap-3">
          <button
            onClick={() => { setPeriodMode("month"); setSelMonth(new Date().getMonth()); setSelYear(new Date().getFullYear()); }}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
          >
            Go to current month
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── KPI strip ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 lg:grid-cols-8 gap-3">
        {kpiCards.map((card) => (
          <div key={card.label} title={card.title} className={`rounded-xl p-4 ${card.cls} ${card.title ? "cursor-help" : ""}`}>
            <p className={`text-[10px] font-medium uppercase tracking-wider leading-tight ${card.labelCls}`}>{card.label}</p>
            <div className="flex items-end justify-between mt-3 gap-1">
              <div>
                <p className={`text-2xl font-semibold leading-none tracking-tight ${card.countCls}`}>{typeof card.count === "number" ? fmtDays(card.count) : card.count}</p>
                <p className={`text-[11px] mt-1.5 ${card.labelCls}`}>{card.sub}</p>
              </div>
              {card.emp !== null && (
                <div className="text-right shrink-0">
                  <p className={`text-sm font-semibold leading-none ${card.countCls}`}>{card.emp}</p>
                  <p className={`text-[10px] mt-1 ${card.empCls}`}>employees</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Leave Analysis section ─────────────────────────────────────────── */}
      <div className="space-y-4">

        {/* Leave Distribution card — full width with slide-in employee panel */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-[13px] font-semibold text-gray-900">Leave Distribution</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{fmtDays(totalLeaveEvents)} day-equivalents · {periodAgg.empCount} employees</p>
            </div>
            {leaveFilter !== "all" ? (
              <button
                onClick={() => { setLeaveFilter("all"); setPanelSearch(""); }}
                className="flex items-center gap-1.5 text-[12px] text-gray-500 hover:text-gray-900 font-medium transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear filter
              </button>
            ) : (
              <span className="text-[11px] text-gray-400">Click a type to filter</span>
            )}
          </div>

          <div className="flex" style={{ height: 520 }}>
            {/* Left column: donut stacked above legend */}
            <div className="flex flex-col items-center px-7 py-6 gap-4 shrink-0 border-r border-gray-50" style={{ width: 380 }}>

              {/* Donut */}
              <svg viewBox="0 0 180 180" className="w-48 h-48">
                <circle cx="90" cy="90" r={DONUT_R} fill="none" stroke="#f1f5f9" strokeWidth="22" />
                {totalLeaveEvents > 0
                  ? donutArcs.map((arc) =>
                      arc.segLen > 0 && (
                        <circle
                          key={arc.key}
                          cx="90" cy="90" r={DONUT_R}
                          fill="none"
                          stroke={leaveFilter === arc.key ? arc.color : arc.color}
                          strokeWidth="22"
                          strokeDasharray={`${arc.segLen} ${DONUT_CIRC}`}
                          strokeDashoffset={arc.offset}
                          strokeLinecap="butt"
                          style={{ opacity: leaveFilter !== "all" && leaveFilter !== arc.key ? 0.25 : 1, transition: "opacity 0.2s", cursor: "pointer" }}
                          onClick={() => {
                            const isActive = leaveFilter === arc.key;
                            setLeaveFilter(isActive ? "all" : arc.key as LeaveFilter);
                            setPanelSearch("");
                          }}
                        />
                      )
                    )
                  : null}
                <text x="90" y="82" textAnchor="middle" fontSize="28" fontWeight="600" fill="#111827">{fmtDays(totalLeaveEvents)}</text>
                <text x="90" y="100" textAnchor="middle" fontSize="7.5" fill="#9ca3af" style={{ letterSpacing: 1.5 }}>TOTAL DAYS</text>
              </svg>

              {/* Legend */}
              <div className="w-full space-y-0.5">
                {LEAVE_TYPE_CONFIG.map((lt) => {
                  const count    = leaveCountByKey[lt.key] ?? 0;
                  const empCount =
                    lt.key === "absent"     ? periodAgg.absentEmp
                    : lt.key === "wfh"      ? periodAgg.wfhEmp
                    : lt.key === "cl"       ? periodAgg.clEmp
                    : lt.key === "sl"       ? periodAgg.slEmp
                    : lt.key === "pl"       ? periodAgg.plEmp
                    : lt.key === "comp_off" ? periodAgg.compEmp
                    : periodAgg.halfEmp;
                  const isActive = leaveFilter === lt.key;
                  return (
                    <button
                      key={lt.key}
                      onClick={() => { setLeaveFilter(isActive ? "all" : lt.key as LeaveFilter); setPanelSearch(""); }}
                      className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-md transition-colors text-left ${
                        isActive ? "bg-gray-900" : "hover:bg-gray-50"
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: lt.color }} />
                      <span className={`text-[12px] font-medium flex-1 ${isActive ? "text-white" : "text-gray-700"}`}>{lt.fullLabel}</span>
                      <span className={`text-[13px] font-semibold ${isActive ? "text-white" : "text-gray-900"}`}>{fmtDays(count)}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium min-w-[40px] text-center ${
                        isActive ? "bg-white/15 text-white/80" : "bg-gray-100 text-gray-500"
                      }`}>{empCount}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Employee side panel — appears when a type is selected */}
            {leaveFilter !== "all" && (() => {
              const activeCfg = LEAVE_TYPE_CONFIG.find(l => l.key === leaveFilter)!;
              const totalDays  = leaveCountByKey[leaveFilter] ?? 0;
              return (
                <div className="flex-1 border-l border-gray-100 flex flex-col min-w-0 overflow-hidden">

                  {/* Header */}
                  <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: activeCfg.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-gray-900 leading-tight">{activeCfg.fullLabel}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{panelEmployees.length} employees affected</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xl font-semibold leading-none text-gray-900">{fmtDays(totalDays)}</p>
                      <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider">{leaveFilter === "half_leave" ? "Events" : "Days"}</p>
                    </div>
                  </div>

                  {/* Search */}
                  <div className="px-4 pt-3 pb-1">
                    <input
                      type="text"
                      value={panelSearch}
                      onChange={(e) => setPanelSearch(e.target.value)}
                      placeholder="Search employees"
                      className="w-full px-3 py-2 rounded-md border border-gray-200 text-[13px] text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:border-gray-900 transition-colors"
                    />
                  </div>

                  {/* Employee list */}
                  <div className="overflow-y-scroll divide-y divide-gray-100 pb-1" style={{ scrollbarGutter: "stable", flex: 1, minHeight: 0 }}>
                    {panelEmployees.length === 0 ? (
                      <div className="py-8 text-center">
                        <p className="text-xs text-gray-400">No employees found</p>
                      </div>
                    ) : panelEmployees.map((emp, idx) => {
                      const cnt = periodCount(emp, leaveFilter);
                      return (
                        <button
                          key={emp.emp_id}
                          onClick={() => setSelectedEmployee(emp)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
                        >
                          <span className="text-[11px] text-gray-300 w-5 shrink-0 tabular-nums">{idx + 1}</span>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shrink-0 ${avatarColor(emp.emp_id)}`}>
                            {initials(emp.name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-gray-900 truncate">{emp.name}</p>
                            <p className="text-[11px] text-gray-400 truncate mt-0.5">{emp.department || emp.emp_id}</p>
                          </div>
                          <div className="shrink-0 flex flex-col items-end">
                            <span className="text-[15px] font-semibold leading-none text-gray-900">{fmtDays(cnt)}</span>
                            <span className="text-[9px] text-gray-400 uppercase tracking-wider mt-1">{leaveFilter === "half_leave" ? "Events" : "Days"}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Absent Employees + Miss Punch + Most Leave Taken */}
        <div className="grid grid-cols-3 gap-4">

          {/* Absent employees */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${absentEmployees.length > 0 ? "bg-red-500" : "bg-gray-300"}`} />
                <p className="text-[13px] font-semibold text-gray-900">Absent Employees</p>
              </div>
              <span className="text-[11px] font-medium px-1.5 py-0.5 rounded text-gray-500 bg-gray-100">{absentEmployees.length}</span>
            </div>
            {absentEmployees.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-[12px] text-gray-400">No absences recorded</p>
              </div>
            ) : (
              <div className="overflow-y-auto divide-y divide-gray-50" style={{ maxHeight: 280, scrollbarGutter: "stable" }}>
                {absentEmployees.map(emp => (
                  <button key={emp.emp_id} onClick={() => setSelectedEmployee(emp)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0 ${avatarColor(emp.emp_id)}`}>
                      {initials(emp.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-gray-900 truncate">{emp.name}</p>
                      <p className="text-[11px] text-gray-400 truncate">{emp.department || "—"}</p>
                    </div>
                    <span className="text-[11px] font-medium text-red-600 shrink-0">{getPeriodStats(emp).absent}d</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Miss Punch */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${missPunchEmployees.length > 0 ? "bg-orange-500" : "bg-gray-300"}`} />
                <p className="text-[13px] font-semibold text-gray-900">Miss Punch</p>
              </div>
              <span className="text-[11px] font-medium px-1.5 py-0.5 rounded text-gray-500 bg-gray-100">{missPunchEmployees.length}</span>
            </div>
            {missPunchEmployees.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-[12px] text-gray-400">No miss punches recorded</p>
              </div>
            ) : (
              <div className="overflow-y-auto divide-y divide-gray-50" style={{ maxHeight: 280, scrollbarGutter: "stable" }}>
                {missPunchEmployees.map(({ emp, days }) => (
                  <button key={emp.emp_id} onClick={() => setSelectedEmployee(emp)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0 ${avatarColor(emp.emp_id)}`}>
                      {initials(emp.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-gray-900 truncate">{emp.name}</p>
                      <p className="text-[11px] text-gray-400 truncate">{emp.department || "—"}</p>
                    </div>
                    <span className="text-[11px] font-medium text-orange-600 shrink-0">{days.length}d</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Most leave taken */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-[13px] font-semibold text-gray-900">Most Leave Taken</p>
              <p className="text-[11px] text-gray-400 mt-0.5">All types combined</p>
            </div>
            {topLeaveEmployees.length === 0 ? (
              <p className="px-4 py-8 text-[12px] text-center text-gray-400">No leave data available</p>
            ) : (
              <div className="overflow-y-auto divide-y divide-gray-50" style={{ maxHeight: 280, scrollbarGutter: "stable" }}>
                {topLeaveEmployees.map((emp, idx) => {
                  const ps  = getPeriodStats(emp);
                  const total = ps.cl + ps.sl + ps.pl + ps.comp + ps.wfh + ps.absent;
                  const cl  = ps.cl;
                  const sl  = ps.sl;
                  const wfh = ps.wfh;
                  const abs = ps.absent;
                  return (
                    <button key={emp.emp_id} onClick={() => setSelectedEmployee(emp)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left">
                      <span className="text-[10px] text-gray-300 w-4 shrink-0">{idx + 1}</span>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0 ${avatarColor(emp.emp_id)}`}>
                        {initials(emp.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-gray-900 truncate">{emp.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {wfh > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 font-medium">WFH {fmtDays(wfh)}</span>}
                          {cl > 0  && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">CL {fmtDays(cl)}</span>}
                          {sl > 0  && <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-medium">SL {fmtDays(sl)}</span>}
                          {abs > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-50 text-red-700 font-medium">Abs {abs}</span>}
                        </div>
                      </div>
                      <span className="text-[12px] font-medium text-gray-700 shrink-0">{fmtDays(total)}d</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Search + filter bar ───────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 p-3.5 space-y-3">
        <div className="flex gap-2.5 items-center">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, ID or department"
              className="w-full pl-9 pr-9 py-2 rounded-md border border-gray-200 text-[13px] text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-900 transition-colors"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="text-[13px] border border-gray-200 rounded-md px-2.5 py-2 text-gray-700 font-medium focus:outline-none focus:border-gray-900 bg-white cursor-pointer"
          >
            <option value="name">Name A–Z</option>
            <option value="absent">Most Absent</option>
            <option value="leave">Most Leave</option>
            <option value="wfh">Most WFH</option>
            <option value="hours">Most Hours</option>
          </select>
        </div>

        {/* ── Hours filter — quick pills ── */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] text-gray-500">Hours</span>
          <span className="text-[11px] text-gray-400">
            {periodMode === "week" ? "per week" : periodMode === "month" ? "per month" : periodMode === "year" ? "per year" : periodMode === "today" ? "today" : periodMode === "yesterday" ? "yesterday" : "in period"}
          </span>
          {([{ label: "< 40 hrs", hours: 40 }, { label: "< 45 hrs", hours: 45 }] as const).map(preset => {
            const isActive = minHours === preset.hours && hoursDir === "lte";
            return (
              <button
                key={preset.label}
                onClick={() => {
                  if (isActive) { setMinHours(0); }
                  else { setMinHours(preset.hours); setHoursDir(() => "lte"); }
                }}
                className={`text-[12px] font-medium px-2.5 py-1 rounded-md transition-colors ${
                  isActive
                    ? "bg-gray-900 text-white"
                    : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                }`}
              >
                {preset.label}
                {isActive && <span className="ml-1 opacity-70">×</span>}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-1">
          <p className="text-[12px] text-gray-500">
            <span className="font-medium text-gray-900">{filtered.length}</span> of {employees.length} employees
            <span className="mx-1.5 text-gray-300">·</span>
            <span className="text-gray-600">{periodLabel}</span>
            {search && <span className="ml-1 text-gray-400">· "<span className="text-gray-700">{search}</span>"</span>}
          </p>
          {(search || leaveFilter !== "all" || minHours > 0) && (
            <button onClick={() => { setSearch(""); setLeaveFilter("all"); setMinHours(0); }} className="text-[12px] text-gray-500 hover:text-gray-900 font-medium">
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* ── Employee table ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-gray-100 text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                <th className="px-5 py-3 text-left">Employee</th>
                <th className="px-5 py-3 text-left">Department</th>
                <th className="px-4 py-3 text-center">Days</th>
                <th className="px-4 py-3 text-center">Hours</th>
                <th className="px-4 py-3 text-center">WFH</th>
                <th className="px-4 py-3 text-center">CL</th>
                <th className="px-4 py-3 text-center">SL</th>
                <th className="px-4 py-3 text-center">PL</th>
                <th className="px-4 py-3 text-center">Comp</th>
                <th className="px-4 py-3 text-center">½ Day</th>
                <th className="px-4 py-3 text-center">Absent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-5 py-14 text-center">
                    <p className="text-gray-700 text-[13px] font-medium">No data recorded for this period</p>
                    <p className="text-gray-400 text-[12px] mt-1">{periodLabel}</p>
                    <button onClick={() => { setPeriodMode("month"); setSelMonth(new Date().getMonth()); setSelYear(new Date().getFullYear()); }} className="mt-3 text-[12px] text-gray-500 hover:text-gray-900 font-medium underline underline-offset-2">
                      Go to current month
                    </button>
                  </td>
                </tr>
              ) : (
                filtered.map((emp) => {
                  const ps    = getPeriodStats(emp);
                  const color = avatarColor(emp.emp_id);
                  const cell  = (v: number, bg: string, text: string, title?: string) =>
                    v > 0 ? <span title={title} className={`inline-flex min-w-[24px] h-[22px] px-1.5 items-center justify-center rounded ${bg} ${text} text-[11px] font-medium`}>{fmtDays(v)}</span>
                           : <span className="text-gray-200">—</span>;
                  // Tooltip for a leave-type cell showing the half-day breakdown if any
                  const tip = (full: number, half: number, label: string) =>
                    half > 0 ? `${full} full + ${half} half ${label}` : undefined;
                  // Half Day tooltip combines all five subtypes
                  const halfTip = ps.half > 0
                    ? [
                        ps.halfWfh  && `${ps.halfWfh} ½WFH`,
                        ps.halfCl   && `${ps.halfCl} ½CL`,
                        ps.halfSl   && `${ps.halfSl} ½SL`,
                        ps.halfPl   && `${ps.halfPl} ½PL`,
                        ps.halfComp && `${ps.halfComp} ½Comp`,
                      ].filter(Boolean).join(" · ")
                    : undefined;
                  return (
                    <tr key={emp.emp_id} onClick={() => setSelectedEmployee(emp)} className="hover:bg-gray-50 cursor-pointer transition-colors">
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0 ${color}`}>
                            {initials(emp.name)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{emp.name}</p>
                            <p className="text-[11px] text-gray-400">{emp.emp_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-2.5 text-[12px] text-gray-500">{emp.department || "—"}</td>
                      <td className="px-4 py-2.5 text-center text-gray-700">{ps.working}</td>
                      <td className="px-4 py-2.5 text-center font-medium text-gray-900 tabular-nums">{ps.totalHours}</td>
                      <td className="px-4 py-2.5 text-center">{cell(ps.wfh,  "bg-teal-50",   "text-teal-700",   tip(ps.wfh  - ps.halfWfh  * 0.5, ps.halfWfh,  "WFH"))}</td>
                      <td className="px-4 py-2.5 text-center">{cell(ps.cl,   "bg-blue-50",   "text-blue-700",   tip(ps.cl   - ps.halfCl   * 0.5, ps.halfCl,   "CL"))}</td>
                      <td className="px-4 py-2.5 text-center">{cell(ps.sl,   "bg-purple-50", "text-purple-700", tip(ps.sl   - ps.halfSl   * 0.5, ps.halfSl,   "SL"))}</td>
                      <td className="px-4 py-2.5 text-center">{cell(ps.pl,   "bg-violet-50", "text-violet-700", tip(ps.pl   - ps.halfPl   * 0.5, ps.halfPl,   "PL"))}</td>
                      <td className="px-4 py-2.5 text-center">{cell(ps.comp, "bg-amber-50",  "text-amber-700",  tip(ps.comp - ps.halfComp * 0.5, ps.halfComp, "Comp"))}</td>
                      <td className="px-4 py-2.5 text-center">{cell(ps.half, "bg-yellow-50", "text-yellow-700", halfTip)}</td>
                      <td className="px-4 py-2.5 text-center">{cell(ps.absent, "bg-red-50",  "text-red-700")}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="px-5 py-2.5 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <p className="text-[11px] text-gray-400">{filtered.length} employees</p>
          </div>
        )}
      </div>

      <EmployeeSlideOver employee={selectedEmployee} weekStats={weekStats} onClose={() => setSelectedEmployee(null)} />
    </div>
  );
}
