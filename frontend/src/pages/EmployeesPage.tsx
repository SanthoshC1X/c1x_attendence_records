import { useMemo, useState } from "react";
import type { DashboardData, EmployeeDashboard, DailyEntry } from "../types";
import { avatarColor, initials, getStatusLabel, statusStyles } from "../utils";
import EmployeeMonthlyCalendar from "../components/EmployeeMonthlyCalendar";
import EmptyState from "../components/ui/EmptyState";

interface Props {
  dashboard: DashboardData;
}

function latestEntry(emp: EmployeeDashboard): DailyEntry | undefined {
  return emp.daily.length > 0 ? emp.daily[emp.daily.length - 1] : undefined;
}

export default function EmployeesPage({ dashboard }: Props) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let employees = dashboard.employees;
    if (search.trim()) {
      const query = search.toLowerCase();
      employees = employees.filter((e) =>
        e.name.toLowerCase().includes(query) || e.emp_id.toLowerCase().includes(query),
      );
    }
    return [...employees].sort((a, b) => a.name.localeCompare(b.name));
  }, [dashboard, search]);

  const selectedEmployee: EmployeeDashboard | null = useMemo(
    () => dashboard.employees.find((e) => e.emp_id === selectedId) || null,
    [dashboard, selectedId],
  );

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or employee ID"
          className="w-full border border-slate-200 bg-white py-2 pl-9 pr-3 text-[13px] text-slate-900 placeholder-slate-400 outline-none transition focus:border-slate-900"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          }
          title="No employees match your search"
          description="Try a shorter name or a different employee ID."
        />
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((employee) => {
            const color = avatarColor(employee.emp_id);
            const ini = initials(employee.name);
            const last = latestEntry(employee);
            const statusLabel = last ? getStatusLabel(last) : "—";
            const statusCls = last ? (statusStyles[last.status_type] || statusStyles.default) : statusStyles.default;
            return (
              <button
                key={employee.emp_id}
                onClick={() => setSelectedId(employee.emp_id)}
                className="flex items-center gap-3 border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-slate-300 hover:shadow-sm"
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center ${color}`}>
                  <span className="text-[13px] font-semibold text-white">{ini}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium text-slate-900">{employee.name}</p>
                  <p className="truncate text-[11px] text-slate-400">#{employee.emp_id} · {employee.department || "—"}</p>
                </div>
                <span className={`shrink-0 px-2 py-0.5 text-[10.5px] font-medium ${statusCls}`}>{statusLabel}</span>
              </button>
            );
          })}
        </div>
      )}

      <EmployeeMonthlyCalendar
        employee={selectedEmployee}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
