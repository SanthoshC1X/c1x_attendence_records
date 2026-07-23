import { useMemo, useState } from "react";
import type { DashboardData, EmployeeDashboard, PeriodState } from "../types";
import { avatarColor, initials, dateInPeriod, describePeriod, isMissPunch, formatDate } from "../utils";
import EmployeeMonthlyCalendar from "../components/EmployeeMonthlyCalendar";
import EmptyState from "../components/ui/EmptyState";
import StatCard from "../components/ui/StatCard";

interface Props {
  dashboard: DashboardData;
  periodState: PeriodState;
}

interface Incident {
  emp: EmployeeDashboard;
  date: string;
}

export default function MissPunchPage({ dashboard, periodState }: Props) {
  const [search, setSearch] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeDashboard | null>(null);

  const incidents: Incident[] = useMemo(() => {
    const out: Incident[] = [];
    for (const emp of dashboard.employees) {
      for (const d of emp.daily) {
        if (dateInPeriod(d.date, periodState) && isMissPunch(d)) out.push({ emp, date: d.date });
      }
    }
    return out.sort((a, b) => b.date.localeCompare(a.date));
  }, [dashboard, periodState]);

  const filtered = useMemo(() => {
    if (!search.trim()) return incidents;
    const q = search.toLowerCase();
    return incidents.filter(({ emp }) => emp.name.toLowerCase().includes(q) || emp.emp_id.toLowerCase().includes(q));
  }, [incidents, search]);

  const affectedCount = useMemo(() => new Set(incidents.map((i) => i.emp.emp_id)).size, [incidents]);
  const periodLabel = describePeriod(periodState);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Incidents" value={String(incidents.length)} tone="missPunch" hint={periodLabel} />
        <StatCard label="Employees affected" value={String(affectedCount)} hint={`of ${dashboard.employees.length} total`} />
        <StatCard
          label="Avg per employee"
          value={affectedCount > 0 ? (incidents.length / affectedCount).toFixed(1) : "0"}
          hint="incidents / affected employee"
        />
      </div>

      {incidents.length === 0 ? (
        <EmptyState
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          title="No miss-punches found"
          description={`${periodLabel} is clean.`}
        />
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-2.5">
            <div className="relative flex-1 max-w-xs">
              <svg className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or ID"
                className="w-full border border-slate-200 py-1.5 pl-8 pr-3 text-[12.5px] outline-none transition focus:border-slate-900"
              />
            </div>
            <span className="shrink-0 text-[11.5px] text-slate-400">{filtered.length} of {incidents.length}</span>
          </div>

          <div className="grid grid-cols-[1fr_7rem_8rem_6rem] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2 text-[10.5px] font-medium uppercase tracking-wide text-slate-400">
            <span>Employee</span>
            <span>Date</span>
            <span>Missing Punch Type</span>
            <span>Status</span>
          </div>

          <div className="max-h-[480px] divide-y divide-slate-50 overflow-y-auto">
            {filtered.map(({ emp, date }) => (
              <button
                key={`${emp.emp_id}-${date}`}
                onClick={() => setSelectedEmployee(emp)}
                className="grid w-full grid-cols-[1fr_7rem_8rem_6rem] items-center gap-3 px-4 py-2.5 text-left transition hover:bg-slate-50"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center text-[10px] font-semibold text-white ${avatarColor(emp.emp_id)}`}>
                    {initials(emp.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-medium text-slate-900">{emp.name}</p>
                    <p className="truncate text-[10.5px] text-slate-400">#{emp.emp_id}</p>
                  </div>
                </div>
                <span className="text-[12px] text-slate-600">{formatDate(date)}</span>
                <span className="text-[12px] text-slate-500">Single Punch</span>
                <span className="w-fit bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-700">Needs Fix</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedEmployee && (
        <EmployeeMonthlyCalendar
          employee={selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
        />
      )}
    </div>
  );
}
