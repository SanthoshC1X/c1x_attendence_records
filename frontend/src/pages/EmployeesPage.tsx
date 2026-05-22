import { useMemo, useState } from "react";
import type { DashboardData, EmployeeDashboard } from "../types";
import { avatarColor, initials } from "../utils";
import EmployeeMonthlyCalendar from "../components/EmployeeMonthlyCalendar";

interface Props {
  dashboard: DashboardData;
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
    <div className="space-y-5">
      <div className="relative">
        <svg className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or employee ID"
          className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-[13px] text-slate-900 placeholder-slate-400 outline-none transition focus:border-slate-900"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-slate-300 bg-white/70 px-6 py-16 text-center">
          <p className="text-sm font-semibold text-slate-700">No employees match your search</p>
          <p className="mt-2 text-sm text-slate-500">Try a shorter name or a different employee ID.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((employee) => {
            const color = avatarColor(employee.emp_id);
            const ini = initials(employee.name);
            return (
              <button
                key={employee.emp_id}
                onClick={() => setSelectedId(employee.emp_id)}
                className="group flex flex-col items-center gap-3 rounded-[22px] border border-slate-200/70 bg-white px-4 py-6 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
              >
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${color} shadow-sm`}>
                  <span className="text-[15px] font-semibold text-white">{ini}</span>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold tracking-tight text-slate-950">{employee.name}</p>
                  <p className="mt-0.5 text-[11px] tracking-wide text-slate-400">#{employee.emp_id}</p>
                </div>
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
