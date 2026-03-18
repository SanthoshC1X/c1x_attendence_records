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
    const emps = analyticsData.leave_breakdown[activeLeaveFilter]?.employees ?? [];
    return new Set(emps.map((e) => e.emp_id));
  }, [activeLeaveFilter, analyticsData]);

  const filtered = useMemo(() => {
    let emps = dashboard.employees;
    if (leaveFilteredIds) emps = emps.filter((e) => leaveFilteredIds.has(e.emp_id));
    if (search) {
      const q = search.toLowerCase();
      emps = emps.filter((e) => e.name.toLowerCase().includes(q) || e.emp_id.includes(q));
    }
    return [...emps].sort((a, b) => {
      let diff = 0;
      if (sortCol === "name")    diff = a.name.localeCompare(b.name);
      if (sortCol === "hours")   diff = (b.summary.total_minutes || 0) - (a.summary.total_minutes || 0);
      if (sortCol === "working") diff = b.summary.working_days - a.summary.working_days;
      if (sortCol === "wfh")     diff = b.summary.wfh_days - a.summary.wfh_days;
      if (sortCol === "leave")   diff = b.summary.leave_days - a.summary.leave_days;
      if (sortCol === "absent")  diff = b.summary.absent_days - a.summary.absent_days;
      return sortAsc ? -diff : diff;
    });
  }, [dashboard, leaveFilteredIds, search, sortCol, sortAsc]);

  const selectedEmployee: EmployeeDashboard | null = useMemo(
    () => dashboard.employees.find((e) => e.emp_id === selectedId) || null,
    [dashboard, selectedId]
  );
  const weekStats: EmployeeWeekStats | null = useMemo(() => {
    if (!analyticsData || !selectedId) return null;
    return analyticsData.filtered_data.employees.find((e) => e.emp_id === selectedId)?.week_breakdown || null;
  }, [analyticsData, selectedId]);

  const handleSort = (col: SortCol) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(false); }
  };

  const SortIcon = ({ col }: { col: SortCol }) => (
    <span className={`ml-1 text-xs ${sortCol === col ? "text-indigo-500" : "text-gray-300"}`}>
      {sortCol === col ? (sortAsc ? "↑" : "↓") : "↕"}
    </span>
  );

  const activeLeaveCfg = leaveFilterConfig.find((c) => c.key === activeLeaveFilter);
  const activePeriodLabel = periodOptions.find((p) => p.key === activePeriod)?.label ?? activePeriod;

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm space-y-3">
        {/* Period pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">Period</span>
          {periodOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => { onPeriodChange(opt.key); setActiveLeaveFilter(null); }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                activePeriod === opt.key
                  ? "bg-gray-900 text-white border-gray-900"
                  : "border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Leave filter chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">Leave Type</span>
          {leaveFilterConfig.map((lf) => {
            const count = analyticsData?.leave_breakdown[lf.key]?.count ?? 0;
            const isActive = activeLeaveFilter === lf.key;
            return (
              <button
                key={lf.key}
                onClick={() => setActiveLeaveFilter(isActive ? null : lf.key)}
                disabled={count === 0}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  isActive ? lf.active : lf.chip
                }`}
              >
                {lf.label}{count > 0 ? ` · ${count}` : ""}
              </button>
            );
          })}
          {activeLeaveFilter && (
            <button
              onClick={() => setActiveLeaveFilter(null)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
            >
              Clear ×
            </button>
          )}
        </div>

        {/* Active filter description */}
        {activeLeaveFilter && (
          <p className="text-xs text-gray-500">
            Showing <span className="font-semibold text-gray-800">{filtered.length}</span> employee{filtered.length !== 1 ? "s" : ""} with
            <span className="font-semibold text-gray-800"> {activeLeaveCfg?.fullLabel}</span> in
            <span className="font-semibold text-gray-800"> {activePeriodLabel}</span>
          </p>
        )}
      </div>

      {/* Search + table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employee…"
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <p className="text-sm text-gray-400 shrink-0">{filtered.length} employees</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-left">
                  <button onClick={() => handleSort("name")} className="font-semibold hover:text-gray-800 flex items-center">
                    Employee <SortIcon col="name" />
                  </button>
                </th>
                <th className="px-6 py-3 text-left font-semibold">Department</th>
                <th className="px-6 py-3 text-left">
                  <button onClick={() => handleSort("hours")} className="font-semibold hover:text-gray-800 flex items-center">
                    Total Hrs <SortIcon col="hours" />
                  </button>
                </th>
                <th className="px-6 py-3 text-left">
                  <button onClick={() => handleSort("working")} className="font-semibold hover:text-gray-800 flex items-center">
                    Working <SortIcon col="working" />
                  </button>
                </th>
                <th className="px-6 py-3 text-left">
                  <button onClick={() => handleSort("wfh")} className="font-semibold hover:text-gray-800 flex items-center">
                    WFH <SortIcon col="wfh" />
                  </button>
                </th>
                <th className="px-6 py-3 text-left">
                  <button onClick={() => handleSort("leave")} className="font-semibold hover:text-gray-800 flex items-center">
                    Leave <SortIcon col="leave" />
                  </button>
                </th>
                <th className="px-6 py-3 text-left">
                  <button onClick={() => handleSort("absent")} className="font-semibold hover:text-gray-800 flex items-center">
                    Absent <SortIcon col="absent" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-400 text-sm">
                    No employees match the current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((emp) => (
                  <tr
                    key={emp.emp_id}
                    onClick={() => setSelectedId(emp.emp_id)}
                    className="hover:bg-indigo-50/50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-3">
                      <p className="font-medium text-gray-900">{emp.name}</p>
                      <p className="text-xs text-gray-400">ID {emp.emp_id}</p>
                    </td>
                    <td className="px-6 py-3 text-gray-600">{emp.department}</td>
                    <td className="px-6 py-3 font-semibold text-gray-900">{emp.summary.total_hours || "0:00"}</td>
                    <td className="px-6 py-3 text-gray-700">{emp.summary.working_days}</td>
                    <td className="px-6 py-3">
                      {emp.summary.wfh_days > 0
                        ? <span className="text-teal-700 font-medium">{emp.summary.wfh_days}</span>
                        : <span className="text-gray-300">0</span>}
                    </td>
                    <td className="px-6 py-3">
                      {emp.summary.leave_days > 0
                        ? <span className="text-rose-700 font-medium">{emp.summary.leave_days}</span>
                        : <span className="text-gray-300">0</span>}
                    </td>
                    <td className="px-6 py-3">
                      {emp.summary.absent_days > 0
                        ? <span className="text-red-600 font-semibold">{emp.summary.absent_days}</span>
                        : <span className="text-gray-300">0</span>}
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
