import { useMemo, useState } from "react";
import type { AnalyticsData, DashboardData, EmployeeDashboard, EmployeeWeekStats } from "../types";
import { leaveFilterConfig, periodOptions } from "../utils";
import EmployeeSlideOver from "../components/EmployeeSlideOver";

interface Props {
  dashboard: DashboardData;
  analyticsData: AnalyticsData | null;
  activePeriod: string;
  onPeriodChange: (p: string) => void;
}

type SortCol = "name" | "hours" | "working" | "wfh" | "leave" | "absent";

export default function AttendancePage({ dashboard, analyticsData, activePeriod, onPeriodChange }: Props) {
  const [activeLeaveFilter, setActiveLeaveFilter] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<SortCol>("hours");
  const [sortAsc, setSortAsc] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const leaveFilteredIds = useMemo<Set<string> | null>(() => {
    if (!activeLeaveFilter || !analyticsData) return null;
    const employees = analyticsData.leave_breakdown[activeLeaveFilter]?.employees ?? [];
    return new Set(employees.map((employee) => employee.emp_id));
  }, [activeLeaveFilter, analyticsData]);

  const filtered = useMemo(() => {
    let employees = dashboard.employees;
    if (leaveFilteredIds) employees = employees.filter((employee) => leaveFilteredIds.has(employee.emp_id));
    if (search) {
      const query = search.toLowerCase();
      employees = employees.filter((employee) => employee.name.toLowerCase().includes(query) || employee.emp_id.includes(query));
    }

    return [...employees].sort((a, b) => {
      let diff = 0;
      if (sortCol === "name") diff = a.name.localeCompare(b.name);
      if (sortCol === "hours") diff = (b.summary.total_minutes || 0) - (a.summary.total_minutes || 0);
      if (sortCol === "working") diff = b.summary.working_days - a.summary.working_days;
      if (sortCol === "wfh") diff = b.summary.wfh_days - a.summary.wfh_days;
      if (sortCol === "leave") diff = b.summary.leave_days - a.summary.leave_days;
      if (sortCol === "absent") diff = b.summary.absent_days - a.summary.absent_days;
      return sortAsc ? -diff : diff;
    });
  }, [dashboard, leaveFilteredIds, search, sortCol, sortAsc]);

  const selectedEmployee: EmployeeDashboard | null = useMemo(
    () => dashboard.employees.find((employee) => employee.emp_id === selectedId) || null,
    [dashboard, selectedId],
  );

  const weekStats: EmployeeWeekStats | null = useMemo(() => {
    if (!analyticsData || !selectedId) return null;
    return analyticsData.filtered_data.employees.find((employee) => employee.emp_id === selectedId)?.week_breakdown || null;
  }, [analyticsData, selectedId]);

  const handleSort = (col: SortCol) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else {
      setSortCol(col);
      setSortAsc(false);
    }
  };

  const activeLeaveCfg = leaveFilterConfig.find((cfg) => cfg.key === activeLeaveFilter);
  const activePeriodLabel = periodOptions.find((period) => period.key === activePeriod)?.label ?? activePeriod;
  const totals = useMemo(() => ({
    employees: filtered.length,
    totalHours: filtered.reduce((sum, employee) => sum + (employee.summary.total_minutes || 0), 0),
    absences: filtered.reduce((sum, employee) => sum + employee.summary.absent_days, 0),
    leaveDays: filtered.reduce((sum, employee) => sum + employee.summary.leave_days, 0),
  }), [filtered]);

  const totalHoursLabel = `${Math.floor(totals.totalHours / 60)}h ${String(totals.totalHours % 60).padStart(2, "0")}m`;

  const SortIcon = ({ col }: { col: SortCol }) => (
    <span className={`ml-1 text-[10px] ${sortCol === col ? "text-slate-700" : "text-slate-300"}`}>
      {sortCol === col ? (sortAsc ? "↑" : "↓") : "↕"}
    </span>
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
        <div className="rounded-[28px] border border-white/80 bg-white/90 p-5 shadow-sm shadow-slate-200/60">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Attendance table</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">Read the daily attendance picture faster</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Narrow the table by period and leave type, then sort the columns to surface hours, absences, and work-from-home patterns.
          </p>

          <div className="mt-5 rounded-2xl bg-slate-50 p-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[11px] font-medium uppercase tracking-wider text-slate-400">Period</span>
              {periodOptions.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => { onPeriodChange(opt.key); setActiveLeaveFilter(null); }}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                    activePeriod === opt.key
                      ? "bg-slate-950 text-white"
                      : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-950"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[11px] font-medium uppercase tracking-wider text-slate-400">Leave type</span>
              {leaveFilterConfig.map((filter) => {
                const count = analyticsData?.leave_breakdown[filter.key]?.count ?? 0;
                const isActive = activeLeaveFilter === filter.key;
                return (
                  <button
                    key={filter.key}
                    onClick={() => setActiveLeaveFilter(isActive ? null : filter.key)}
                    disabled={count === 0}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                      isActive ? "bg-slate-950 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-950"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${filter.dot}`} />
                    {filter.label}
                    {count > 0 && <span className={`text-[11px] ${isActive ? "text-white/70" : "text-slate-400"}`}>{count}</span>}
                  </button>
                );
              })}
              {activeLeaveFilter && (
                <button
                  onClick={() => setActiveLeaveFilter(null)}
                  className="rounded-full px-3 py-1.5 text-[12px] font-medium text-slate-500 transition hover:bg-white hover:text-slate-900"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[24px] border border-white/80 bg-white/90 p-4 shadow-sm shadow-slate-200/60">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Employees</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{totals.employees}</p>
            <p className="mt-1 text-xs text-slate-500">shown in this view</p>
          </div>
          <div className="rounded-[24px] border border-white/80 bg-white/90 p-4 shadow-sm shadow-slate-200/60">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Hours</p>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{totalHoursLabel}</p>
            <p className="mt-1 text-xs text-slate-500">combined visible time</p>
          </div>
          <div className="rounded-[24px] border border-white/80 bg-white/90 p-4 shadow-sm shadow-slate-200/60">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Absences</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-red-600">{totals.absences}</p>
            <p className="mt-1 text-xs text-slate-500">days across visible employees</p>
          </div>
          <div className="rounded-[24px] border border-white/80 bg-white/90 p-4 shadow-sm shadow-slate-200/60">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Leave</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-blue-700">{totals.leaveDays}</p>
            <p className="mt-1 text-xs text-slate-500">leave days in view</p>
          </div>
        </div>
      </div>

      {activeLeaveFilter && (
        <div className="rounded-2xl border border-teal-200 bg-teal-50/80 px-4 py-3 text-sm text-teal-900 shadow-sm">
          Showing <span className="font-semibold">{filtered.length}</span> employee{filtered.length !== 1 ? "s" : ""} with
          <span className="font-semibold"> {activeLeaveCfg?.fullLabel}</span> during
          <span className="font-semibold"> {activePeriodLabel}</span>.
        </div>
      )}

      <div className="overflow-hidden rounded-[28px] border border-white/80 bg-white/92 shadow-sm shadow-slate-200/60">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Attendance table</p>
            <p className="mt-1 text-xs text-slate-400">Sort columns and open any row for employee-level weekly detail.</p>
          </div>
          <div className="relative w-full md:max-w-sm">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employee"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 py-2.5 pl-10 pr-3 text-[13px] placeholder-slate-400 outline-none transition focus:border-slate-900 focus:bg-white"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="border-b border-slate-100 text-[11px] font-medium uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-3 text-left">
                  <button onClick={() => handleSort("name")} className="flex items-center hover:text-slate-700">
                    Employee <SortIcon col="name" />
                  </button>
                </th>
                <th className="px-5 py-3 text-left">Department</th>
                <th className="px-5 py-3 text-left">
                  <button onClick={() => handleSort("hours")} className="flex items-center hover:text-slate-700">
                    Hours <SortIcon col="hours" />
                  </button>
                </th>
                <th className="px-5 py-3 text-left">
                  <button onClick={() => handleSort("working")} className="flex items-center hover:text-slate-700">
                    Working <SortIcon col="working" />
                  </button>
                </th>
                <th className="px-5 py-3 text-left">
                  <button onClick={() => handleSort("wfh")} className="flex items-center hover:text-slate-700">
                    WFH <SortIcon col="wfh" />
                  </button>
                </th>
                <th className="px-5 py-3 text-left">
                  <button onClick={() => handleSort("leave")} className="flex items-center hover:text-slate-700">
                    Leave <SortIcon col="leave" />
                  </button>
                </th>
                <th className="px-5 py-3 text-left">
                  <button onClick={() => handleSort("absent")} className="flex items-center hover:text-slate-700">
                    Absent <SortIcon col="absent" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-[13px] text-slate-400">
                    No employees match the current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((employee) => (
                  <tr
                    key={employee.emp_id}
                    onClick={() => setSelectedId(employee.emp_id)}
                    className="cursor-pointer transition-colors hover:bg-amber-50/40"
                  >
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-900">{employee.name}</p>
                      <p className="text-[11px] text-slate-400">{employee.emp_id}</p>
                    </td>
                    <td className="px-5 py-3 text-[12px] text-slate-500">{employee.department}</td>
                    <td className="px-5 py-3 font-medium tabular-nums text-slate-900">{employee.summary.total_hours || "0:00"}</td>
                    <td className="px-5 py-3 text-slate-700">{employee.summary.working_days}</td>
                    <td className="px-5 py-3">
                      {employee.summary.wfh_days > 0
                        ? <span className="font-medium text-teal-700">{employee.summary.wfh_days}</span>
                        : <span className="text-slate-300">0</span>}
                    </td>
                    <td className="px-5 py-3">
                      {employee.summary.leave_days > 0
                        ? <span className="font-medium text-blue-700">{employee.summary.leave_days}</span>
                        : <span className="text-slate-300">0</span>}
                    </td>
                    <td className="px-5 py-3">
                      {employee.summary.absent_days > 0
                        ? <span className="font-medium text-red-600">{employee.summary.absent_days}</span>
                        : <span className="text-slate-300">0</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <EmployeeSlideOver
        employee={selectedEmployee}
        weekStats={weekStats}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
