import { useMemo, useState } from "react";
import type { DashboardData, AnalyticsData, EmployeeDashboard, PeriodState, PeriodActions } from "../types";
import { avatarColor, initials, getMonthIsoWeeks } from "../utils";
import EmployeeSlideOver from "../components/EmployeeSlideOver";

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

interface Props {
  dashboard: DashboardData;
  analyticsData: AnalyticsData | null;
  periodState: PeriodState;
  periodActions: PeriodActions;
}

export default function MissPunchPage({ dashboard, analyticsData, periodState }: Props) {
  const employees: EmployeeDashboard[] =
    analyticsData?.filtered_data?.employees ?? dashboard.employees;

  const [search, setSearch] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeDashboard | null>(null);

  const { periodMode, selMonth, selYear, selWeek, customFrom, customTo } = periodState;

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

  const periodLabel = (() => {
    if (periodMode === "yesterday") {
      const y = new Date(); y.setDate(y.getDate() - 1);
      return `Yesterday · ${y.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;
    }
    if (periodMode === "today") {
      const ref = customFrom ? new Date(customFrom + "T00:00:00") : new Date();
      return ref.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    }
    if (periodMode === "year")  return `Year ${selYear}`;
    if (periodMode === "month") return `${MONTH_NAMES[selMonth]} ${selYear}`;
    if (periodMode === "custom") {
      if (!customFrom && !customTo) return "Custom range";
      const fmt = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      if (customFrom && customTo) return `${fmt(customFrom)} – ${fmt(customTo)}`;
      if (customFrom) return `From ${fmt(customFrom)}`;
      return `Until ${fmt(customTo)}`;
    }
    const w = monthIsoWeeks[clampedWeek - 1];
    const range = w ? w.sublabel : `Week ${clampedWeek}`;
    return `Week ${clampedWeek} · ${range}, ${selYear}`;
  })();

  const missPunchData = useMemo(() => {
    return employees
      .map(e => ({
        emp: e,
        days: e.daily.filter(d => dateInPeriod(d.date) && isMissPunch(d)),
      }))
      .filter(x => x.days.length > 0)
      .sort((a, b) => b.days.length - a.days.length);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees, periodMode, selYear, selMonth, clampedWeek, customFrom, customTo]);

  const filtered = useMemo(() => {
    if (!search.trim()) return missPunchData;
    const q = search.toLowerCase();
    return missPunchData.filter(({ emp }) =>
      emp.name.toLowerCase().includes(q) ||
      emp.emp_id.toLowerCase().includes(q) ||
      (emp.department || "").toLowerCase().includes(q)
    );
  }, [missPunchData, search]);

  const totalMissDays = missPunchData.reduce((s, x) => s + x.days.length, 0);

  return (
    <div className="space-y-5">

      {/* Header stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-orange-600 rounded-2xl p-5 text-white shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-orange-200">Total Miss Punches</p>
          <p className="text-4xl font-black mt-2">{totalMissDays}</p>
          <p className="text-xs text-orange-200 mt-1">days · {periodLabel}</p>
        </div>
        <div className="bg-white rounded-2xl border border-orange-200 p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-orange-400">Employees Affected</p>
          <p className="text-4xl font-black mt-2 text-orange-600">{missPunchData.length}</p>
          <p className="text-xs text-orange-400 mt-1">out of {employees.length} total</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Avg per Employee</p>
          <p className="text-4xl font-black mt-2 text-gray-700">
            {missPunchData.length > 0 ? (totalMissDays / missPunchData.length).toFixed(1) : "0"}
          </p>
          <p className="text-xs text-gray-400 mt-1">days per affected employee</p>
        </div>
      </div>

      {/* No data state */}
      {missPunchData.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-gray-700 font-bold text-base">No miss punches found</p>
          <p className="text-gray-400 text-sm mt-1">{periodLabel}</p>
        </div>
      )}

      {/* Employee list */}
      {missPunchData.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Search */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="relative flex-1">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text" value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, ID or department…"
                className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-400 transition-all"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <span className="text-xs text-gray-400 shrink-0">{filtered.length} employees</span>
          </div>

          {/* Table header */}
          <div className="grid grid-cols-[2rem_1fr_1fr_8rem_6rem] gap-3 px-5 py-2.5 bg-gray-50 border-b border-gray-100 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            <span>#</span>
            <span>Employee</span>
            <span>Department</span>
            <span>Miss Punch Days</span>
            <span className="text-center">Count</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-50">
            {filtered.map(({ emp, days }, idx) => (
              <button
                key={emp.emp_id}
                onClick={() => setSelectedEmployee(emp)}
                className="w-full grid grid-cols-[2rem_1fr_1fr_8rem_6rem] gap-3 px-5 py-3 hover:bg-orange-50/40 transition-colors text-left items-center"
              >
                <span className="text-[11px] font-bold text-gray-300 tabular-nums">#{idx + 1}</span>
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${avatarColor(emp.emp_id)}`}>
                    {initials(emp.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{emp.name}</p>
                    <p className="text-[10px] text-gray-400">{emp.emp_id}</p>
                  </div>
                </div>
                <span className="text-xs text-gray-500 truncate">{emp.department || "—"}</span>
                <div className="flex flex-wrap gap-1">
                  {days.slice(0, 3).map(d => (
                    <span key={d.date} className="text-[9px] px-1.5 py-0.5 rounded-lg bg-orange-100 text-orange-700 font-semibold whitespace-nowrap">
                      {new Date(d.date + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                    </span>
                  ))}
                  {days.length > 3 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-lg bg-gray-100 text-gray-500 font-semibold">+{days.length - 3}</span>
                  )}
                </div>
                <div className="flex justify-center">
                  <span className="text-sm font-black text-orange-600 bg-orange-100 px-2.5 py-0.5 rounded-full">{days.length}d</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedEmployee && (
        <EmployeeSlideOver
          employee={selectedEmployee}
          weekStats={null}
          onClose={() => setSelectedEmployee(null)}
        />
      )}
    </div>
  );
}
