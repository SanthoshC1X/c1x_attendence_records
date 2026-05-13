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
    const values = new Set(dashboard.employees.map((employee) => employee.department).filter(Boolean));
    return ["All", ...Array.from(values).sort()];
  }, [dashboard]);

  const filtered = useMemo(() => {
    let employees = dashboard.employees;
    if (deptFilter !== "All") employees = employees.filter((employee) => employee.department === deptFilter);
    if (search) {
      const query = search.toLowerCase();
      employees = employees.filter((employee) => employee.name.toLowerCase().includes(query) || employee.emp_id.includes(query));
    }

    return [...employees].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      if (sortKey === "hours") return (b.summary.total_minutes || 0) - (a.summary.total_minutes || 0);
      if (sortKey === "working") return b.summary.working_days - a.summary.working_days;
      if (sortKey === "absent") return b.summary.absent_days - a.summary.absent_days;
      return 0;
    });
  }, [dashboard, search, deptFilter, sortKey]);

  const selectedEmployee: EmployeeDashboard | null = useMemo(
    () => dashboard.employees.find((employee) => employee.emp_id === selectedId) || null,
    [dashboard, selectedId],
  );

  const weekStats: EmployeeWeekStats | null = useMemo(() => {
    if (!analyticsData || !selectedId) return null;
    return analyticsData.filtered_data.employees.find((employee) => employee.emp_id === selectedId)?.week_breakdown || null;
  }, [analyticsData, selectedId]);

  const employeeSummary = useMemo(() => {
    const totalMinutes = filtered.reduce((sum, employee) => sum + (employee.summary.total_minutes || 0), 0);
    const activeEmployees = filtered.filter((employee) => employee.summary.working_days > 0).length;
    const absentEmployees = filtered.filter((employee) => employee.summary.absent_days > 0).length;
    const leaveEmployees = filtered.filter((employee) => employee.summary.leave_days > 0).length;
    const avgMinutes = filtered.length ? Math.round(totalMinutes / filtered.length) : 0;
    const avgHours = `${Math.floor(avgMinutes / 60)}h ${String(avgMinutes % 60).padStart(2, "0")}m`;
    return { activeEmployees, absentEmployees, leaveEmployees, avgHours };
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        <div className="rounded-[28px] border border-white/80 bg-white/90 p-5 shadow-sm shadow-slate-200/60">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">People explorer</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">Find the right employee fast</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Filter by team, sort by hours or attendance risk, then open the employee panel for weekly and daily detail.
          </p>

          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by employee name or ID"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 py-3 pl-10 pr-3 text-[13px] text-slate-900 placeholder-slate-400 outline-none transition focus:border-slate-900 focus:bg-white"
              />
            </div>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-[13px] font-medium text-slate-700 outline-none transition focus:border-slate-900"
            >
              {departments.map((department) => <option key={department}>{department}</option>)}
            </select>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-[13px] font-medium text-slate-700 outline-none transition focus:border-slate-900"
            >
              <option value="hours">Sort: Most Hours</option>
              <option value="name">Sort: Name A-Z</option>
              <option value="working">Sort: Working Days</option>
              <option value="absent">Sort: Most Absent</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2">
          <div className="rounded-[24px] border border-white/80 bg-white/90 p-4 shadow-sm shadow-slate-200/60">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Visible</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{filtered.length}</p>
            <p className="mt-1 text-xs text-slate-500">employees in current view</p>
          </div>
          <div className="rounded-[24px] border border-white/80 bg-white/90 p-4 shadow-sm shadow-slate-200/60">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Active</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-emerald-700">{employeeSummary.activeEmployees}</p>
            <p className="mt-1 text-xs text-slate-500">with working days logged</p>
          </div>
          <div className="rounded-[24px] border border-white/80 bg-white/90 p-4 shadow-sm shadow-slate-200/60">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Attention</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-red-600">{employeeSummary.absentEmployees}</p>
            <p className="mt-1 text-xs text-slate-500">employees with absences</p>
          </div>
          <div className="rounded-[24px] border border-white/80 bg-white/90 p-4 shadow-sm shadow-slate-200/60">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Average</p>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{employeeSummary.avgHours}</p>
            <p className="mt-1 text-xs text-slate-500">{employeeSummary.leaveEmployees} employees with leave</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-1">
        <p className="text-sm font-medium text-slate-700">Employee cards</p>
        <p className="text-xs text-slate-400">Tap any card to open detailed attendance history.</p>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/70 px-6 py-16 text-center">
          <p className="text-sm font-semibold text-slate-700">No employees match the current filters</p>
          <p className="mt-2 text-sm text-slate-500">Try clearing the department filter or searching with a shorter name.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((employee) => {
            const color = avatarColor(employee.emp_id);
            const ini = initials(employee.name);
            const totalMinutes = employee.summary.total_minutes || 0;
            const barPct = Math.min((totalMinutes / 10800) * 100, 100);
            const hasAbsent = employee.summary.absent_days > 0;

            return (
              <button
                key={employee.emp_id}
                onClick={() => setSelectedId(employee.emp_id)}
                className="group rounded-[24px] border border-white/80 bg-white/92 p-4 text-left shadow-sm shadow-slate-200/60 transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/70"
              >
                <div className="flex items-start gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${color}`}>
                    <span className="text-[12px] font-semibold text-white">{ini}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-slate-950">{employee.name}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">{employee.department || "Unknown"} · #{employee.emp_id}</p>
                  </div>
                  <svg className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5l7 7-7 7" />
                  </svg>
                </div>

                <div className="mt-4 rounded-2xl bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Total hours</span>
                    <span className="font-semibold text-slate-700 tabular-nums">{employee.summary.total_hours || "0:00"}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-rose-500 transition-all" style={{ width: `${barPct}%` }} />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-700">
                    Work {employee.summary.working_days}
                  </span>
                  {employee.summary.wfh_days > 0 && (
                    <span className="rounded-full bg-teal-50 px-2 py-1 text-[10px] font-medium text-teal-700">
                      WFH {employee.summary.wfh_days}
                    </span>
                  )}
                  {employee.summary.leave_days > 0 && (
                    <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-700">
                      Leave {employee.summary.leave_days}
                    </span>
                  )}
                  {hasAbsent && (
                    <span className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-medium text-red-700">
                      Absent {employee.summary.absent_days}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <EmployeeSlideOver
        employee={selectedEmployee}
        weekStats={weekStats}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
