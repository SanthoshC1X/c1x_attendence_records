import { useMemo, useState } from "react";
import type { DashboardData, EmployeeDashboard, PeriodState } from "../types";
import { avatarColor, initials, dateInPeriod, describePeriod } from "../utils";
import EmployeeMonthlyCalendar from "../components/EmployeeMonthlyCalendar";

interface Props {
  dashboard: DashboardData;
  periodState: PeriodState;
}

function isMissPunch(d: { in_time: string; out_time: string; is_weekend?: boolean }) {
  return !d.is_weekend && d.in_time && d.out_time && d.in_time === d.out_time && d.in_time !== "00:00:00";
}

export default function MissPunchPage({ dashboard, periodState }: Props) {
  const [search, setSearch] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeDashboard | null>(null);

  const missPunchData = useMemo(() => {
    return dashboard.employees
      .map((emp) => ({
        emp,
        days: emp.daily.filter((d) => dateInPeriod(d.date, periodState) && isMissPunch(d)),
      }))
      .filter((x) => x.days.length > 0)
      .sort((a, b) => b.days.length - a.days.length);
  }, [dashboard, periodState]);

  const filtered = useMemo(() => {
    if (!search.trim()) return missPunchData;
    const q = search.toLowerCase();
    return missPunchData.filter(({ emp }) =>
      emp.name.toLowerCase().includes(q) ||
      emp.emp_id.toLowerCase().includes(q) ||
      (emp.department || "").toLowerCase().includes(q),
    );
  }, [missPunchData, search]);

  const totalMissDays = missPunchData.reduce((s, x) => s + x.days.length, 0);
  const periodLabel = describePeriod(periodState);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Total miss-punches" value={String(totalMissDays)} tone="text-orange-700" hint={periodLabel} />
        <Stat label="Employees affected" value={String(missPunchData.length)} tone="text-slate-900" hint={`out of ${dashboard.employees.length} total`} />
        <Stat
          label="Avg per affected"
          value={missPunchData.length > 0 ? (totalMissDays / missPunchData.length).toFixed(1) : "0"}
          tone="text-slate-900"
          hint="days per affected employee"
        />
      </div>

      {missPunchData.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-slate-300 bg-white/70 px-6 py-16 text-center">
          <p className="text-sm font-semibold text-slate-700">No miss-punches found</p>
          <p className="mt-2 text-sm text-slate-500">{periodLabel} is clean.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[20px] border border-slate-200/80 bg-white">
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3.5">
            <div className="relative flex-1">
              <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, ID, or department"
                className="w-full rounded-full border border-slate-200 py-1.5 pl-9 pr-9 text-[13px] outline-none transition focus:border-slate-900"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <span className="shrink-0 text-[12px] text-slate-400">{filtered.length} employees</span>
          </div>

          <div className="grid grid-cols-[2rem_1fr_1fr_minmax(8rem,1fr)_4.5rem] gap-3 border-b border-slate-100 px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
            <span>#</span>
            <span>Employee</span>
            <span>Department</span>
            <span>Miss-punch days</span>
            <span className="text-center">Count</span>
          </div>

          <div className="divide-y divide-slate-50">
            {filtered.map(({ emp, days }, idx) => (
              <button
                key={emp.emp_id}
                onClick={() => setSelectedEmployee(emp)}
                className="grid w-full grid-cols-[2rem_1fr_1fr_minmax(8rem,1fr)_4.5rem] items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-slate-50"
              >
                <span className="text-[11px] tabular-nums text-slate-300">{idx + 1}</span>
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ${avatarColor(emp.emp_id)}`}>
                    {initials(emp.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-slate-900">{emp.name}</p>
                    <p className="text-[11px] text-slate-400">#{emp.emp_id}</p>
                  </div>
                </div>
                <span className="truncate text-[12px] text-slate-500">{emp.department || "—"}</span>
                <div className="flex flex-wrap gap-1">
                  {days.slice(0, 3).map((d) => (
                    <span key={d.date} className="whitespace-nowrap rounded bg-orange-50 px-1.5 py-0.5 text-[10px] font-medium text-orange-700">
                      {new Date(d.date + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                    </span>
                  ))}
                  {days.length > 3 && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">+{days.length - 3}</span>
                  )}
                </div>
                <div className="flex justify-center">
                  <span className="text-[12px] font-medium text-orange-700 tabular-nums">{days.length}d</span>
                </div>
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

function Stat({ label, value, tone, hint }: { label: string; value: string; tone: string; hint?: string }) {
  return (
    <div className="rounded-[20px] border border-slate-200/70 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tracking-tight tabular-nums ${tone}`}>{value}</p>
      {hint && <p className="mt-1.5 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}
