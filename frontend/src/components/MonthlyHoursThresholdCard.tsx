import { useMemo, useState } from "react";
import type { EmployeeDashboard } from "../types";
import { isRealAttendanceDay } from "../utils";

interface Props {
  employees: EmployeeDashboard[];
  datesProcessed: string[];
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function fmtHours(minutes: number): string {
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  return `${hh}h ${String(mm).padStart(2, "0")}m`;
}

function weekdaysInMonth(year: number, monthIndex: number): number {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, monthIndex, d).getDay();
    if (dow !== 0 && dow !== 6) count += 1;
  }
  return count;
}

function workedMinutes(status: string, totalMinutes: number | null): number {
  if (status !== "present" && status !== "weekend_worked") return 0;
  return typeof totalMinutes === "number" && totalMinutes > 0 ? totalMinutes : 0;
}

export default function MonthlyHoursThresholdCard({ employees, datesProcessed }: Props) {
  const availableMonths = useMemo(() => {
    const keys = new Set<string>();
    for (const iso of datesProcessed) keys.add(iso.slice(0, 7));
    return Array.from(keys).sort();
  }, [datesProcessed]);

  const [selMonthKey, setSelMonthKey] = useState<string>(availableMonths[availableMonths.length - 1] ?? "");

  const effectiveMonthKey = availableMonths.includes(selMonthKey)
    ? selMonthKey
    : availableMonths[availableMonths.length - 1] ?? "";

  const result = useMemo(() => {
    if (!effectiveMonthKey) return { thresholdMinutes: 0, weekdayCount: 0, below: [] as { emp: EmployeeDashboard; actualMinutes: number }[] };

    const [yearStr, monthStr] = effectiveMonthKey.split("-");
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;
    const weekdayCount = weekdaysInMonth(year, monthIndex);
    const thresholdMinutes = weekdayCount * 8 * 60;

    const below: { emp: EmployeeDashboard; actualMinutes: number }[] = [];
    for (const emp of employees) {
      let actualMinutes = 0;
      let hasRealData = false;
      for (const day of emp.daily) {
        if (!day.date.startsWith(effectiveMonthKey)) continue;
        if (isRealAttendanceDay(day)) hasRealData = true;
        actualMinutes += workedMinutes(day.status_type, day.total_minutes);
      }
      if (hasRealData && actualMinutes < thresholdMinutes) {
        below.push({ emp, actualMinutes });
      }
    }
    below.sort((a, b) => a.actualMinutes - b.actualMinutes);

    return { thresholdMinutes, weekdayCount, below };
  }, [employees, effectiveMonthKey]);

  const [expanded, setExpanded] = useState(false);

  if (availableMonths.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 px-5 py-4">
        <div>
          <h3 className="text-[14px] font-semibold tracking-tight text-white">Below monthly hours target</h3>
          <p className="mt-0.5 text-[12px] text-slate-300">
            Target: 8h × {result.weekdayCount} weekdays = {fmtHours(result.thresholdMinutes)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MonthPicker months={availableMonths} value={effectiveMonthKey} onChange={setSelMonthKey} />
          <span className="rounded-md bg-red-500 px-2.5 py-0.5 text-[11px] font-semibold text-white">
            {result.below.length}
          </span>
        </div>
      </div>

      {result.below.length === 0 ? (
        <div className="px-5 py-8 text-center text-[12.5px] text-slate-500">Everyone met the target this month.</div>
      ) : (
        <>
          <ul className="divide-y divide-slate-100">
            {(expanded ? result.below : result.below.slice(0, 6)).map(({ emp, actualMinutes }) => (
              <li key={emp.emp_id} className="flex items-center justify-between px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-slate-900">{emp.name}</p>
                  <p className="truncate text-[11.5px] text-slate-400">{emp.department || "—"} · ID {emp.emp_id}</p>
                </div>
                <div className="ml-3 shrink-0 text-right">
                  <p className="text-[13px] font-semibold text-rose-600 tabular-nums">
                    {fmtHours(actualMinutes)} / {fmtHours(result.thresholdMinutes)}
                  </p>
                  <p className="text-[11px] text-slate-400">short by {fmtHours(result.thresholdMinutes - actualMinutes)}</p>
                </div>
              </li>
            ))}
          </ul>
          {result.below.length > 6 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="w-full border-t border-slate-100 px-5 py-2.5 text-center text-[12px] font-semibold text-slate-900 hover:bg-slate-50"
            >
              {expanded ? "Show less" : `Show all ${result.below.length}`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function MonthPicker({ months, value, onChange }: { months: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-full bg-white/15 px-3.5 py-1.5 pr-8 text-[12px] font-medium text-white outline-none transition focus:bg-white/25"
      >
        {months.map((key) => {
          const [yearStr, monthStr] = key.split("-");
          const label = `${MONTH_NAMES[Number(monthStr) - 1]} ${yearStr}`;
          return <option key={key} value={key} className="text-slate-900">{label}</option>;
        })}
      </select>
      <svg className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}
