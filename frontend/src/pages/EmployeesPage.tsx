import { useMemo, useState } from "react";
import type { AnalyticsData, DashboardData, EmployeeDashboard, EmployeeWeekStats } from "../types";
import { avatarColor, initials } from "../utils";
import EmployeeSlideOver from "../components/EmployeeSlideOver";

interface Props {
  dashboard: DashboardData;
  analyticsData: AnalyticsData | null;
}

type SortKey = "name" | "hours" | "working" | "absent";

export default function EmployeesPage({ dashboard, analyticsData }: Props) {
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("All");
  const [sortKey, setSortKey] = useState<SortKey>("hours");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const departments = useMemo(() => {
    const set = new Set(dashboard.employees.map((e) => e.department).filter(Boolean));
    return ["All", ...Array.from(set).sort()];
  }, [dashboard]);

  const filtered = useMemo(() => {
    let emps = dashboard.employees;
    if (deptFilter !== "All") emps = emps.filter((e) => e.department === deptFilter);
    if (search) {
      const q = search.toLowerCase();
      emps = emps.filter((e) => e.name.toLowerCase().includes(q) || e.emp_id.includes(q));
    }
    return [...emps].sort((a, b) => {
      if (sortKey === "name")    return a.name.localeCompare(b.name);
      if (sortKey === "hours")   return (b.summary.total_minutes || 0) - (a.summary.total_minutes || 0);
      if (sortKey === "working") return b.summary.working_days - a.summary.working_days;
      if (sortKey === "absent")  return b.summary.absent_days - a.summary.absent_days;
      return 0;
    });
  }, [dashboard, search, deptFilter, sortKey]);

  const selectedEmployee: EmployeeDashboard | null = useMemo(
    () => dashboard.employees.find((e) => e.emp_id === selectedId) || null,
    [dashboard, selectedId]
  );

  const weekStats: EmployeeWeekStats | null = useMemo(() => {
    if (!analyticsData || !selectedId) return null;
    return analyticsData.filtered_data.employees.find((e) => e.emp_id === selectedId)?.week_breakdown || null;
  }, [analyticsData, selectedId]);

  return (
    <div>
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or ID…"
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          />
        </div>
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {departments.map((d) => <option key={d}>{d}</option>)}
        </select>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="hours">Sort: Most Hours</option>
          <option value="name">Sort: Name A–Z</option>
          <option value="working">Sort: Working Days</option>
          <option value="absent">Sort: Most Absent</option>
        </select>
        <div className="flex items-center px-4 py-2.5 bg-gray-100 rounded-xl text-sm text-gray-500 font-medium shrink-0">
          {filtered.length} employee{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Employee grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">No employees match your search.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((emp) => {
            const color = avatarColor(emp.emp_id);
            const ini = initials(emp.name);
            const totalMin = emp.summary.total_minutes || 0;
            const barPct = Math.min((totalMin / 10800) * 100, 100); // 180h = full bar
            const hasAbsent = emp.summary.absent_days > 0;

            return (
              <button
                key={emp.emp_id}
                onClick={() => setSelectedId(emp.emp_id)}
                className="text-left bg-white rounded-2xl border border-gray-200 p-5 hover:border-indigo-300 hover:shadow-md transition-all group"
              >
                {/* Name + avatar row */}
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                    <span className="text-white text-sm font-bold">{ini}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{emp.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{emp.department || "Unknown"} · #{emp.emp_id}</p>
                  </div>
                  <svg className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 transition-colors shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>

                {/* Hours bar */}
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                    <span>Total Hours</span>
                    <span className="font-semibold text-gray-700">{emp.summary.total_hours || "0:00"}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${barPct}%` }} />
                  </div>
                </div>

                {/* Stat badges */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium">
                    Working {emp.summary.working_days}
                  </span>
                  {emp.summary.wfh_days > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-700 font-medium">
                      WFH {emp.summary.wfh_days}
                    </span>
                  )}
                  {emp.summary.leave_days > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 font-medium">
                      Leave {emp.summary.leave_days}
                    </span>
                  )}
                  {hasAbsent && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700 font-medium">
                      Absent {emp.summary.absent_days}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Slide-over */}
      <EmployeeSlideOver
        employee={selectedEmployee}
        weekStats={weekStats}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
