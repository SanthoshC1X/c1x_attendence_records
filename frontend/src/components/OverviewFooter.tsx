import { useMemo } from "react";
import type { DashboardData, PeriodState } from "../types";
import { dateInPeriod, describePeriod, isMissPunch } from "../utils";

interface Props {
  dashboard: DashboardData;
  period: PeriodState;
}

interface Totals {
  employees: number;
  present: number;
  wfh: number;
  leave: number;
  absent: number;
  missPunch: number;
  totalMinutes: number;
}

export default function OverviewFooter({ dashboard, period }: Props) {
  const totals = useMemo<Totals>(() => {
    const t: Totals = { employees: 0, present: 0, wfh: 0, leave: 0, absent: 0, missPunch: 0, totalMinutes: 0 };
    const activeEmps = new Set<string>();

    for (const emp of dashboard.employees) {
      for (const d of emp.daily) {
        if (!dateInPeriod(d.date, period)) continue;
        activeEmps.add(emp.emp_id);
        switch (d.status_type) {
          case "present":
          case "weekend_worked":
            t.present += 1; break;
          case "wfh":
            t.wfh += 1; break;
          case "leave":
          case "comp_off":
          case "lwd":
            t.leave += 1; break;
          case "half_leave":
            t.leave += 0.5; break;
          case "absent":
            t.absent += 1; break;
        }
        if (isMissPunch(d)) t.missPunch += 1;
        t.totalMinutes += d.total_minutes ?? 0;
      }
    }
    t.employees = activeEmps.size;
    return t;
  }, [dashboard, period]);

  const avgMins = totals.employees > 0 ? Math.round(totals.totalMinutes / totals.employees) : 0;
  const avgLabel = `${Math.floor(avgMins / 60)}h ${String(avgMins % 60).padStart(2, "0")}m`;

  const items: { label: string; value: string; tone: string }[] = [
    { label: "Employees", value: String(totals.employees), tone: "text-slate-900" },
    { label: "Present",   value: String(totals.present),   tone: "text-emerald-700" },
    { label: "WFH",       value: String(totals.wfh),       tone: "text-teal-700" },
    { label: "On leave",  value: fmtCount(totals.leave),   tone: "text-blue-700" },
    { label: "Absent",    value: String(totals.absent),    tone: totals.absent > 0 ? "text-rose-700" : "text-slate-400" },
    { label: "Miss-punch", value: String(totals.missPunch), tone: totals.missPunch > 0 ? "text-orange-700" : "text-slate-400" },
    { label: "Avg hours", value: avgLabel,                 tone: "text-slate-900" },
  ];

  return (
    <footer className="mt-10 border-t border-slate-200/70 pt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-400">Overview · {describePeriod(period)}</p>
        <p className="text-[11px] text-slate-400">Aggregated across the selected period.</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4 lg:grid-cols-7">
        {items.map((it) => (
          <div key={it.label} className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{it.label}</p>
            <p className={`mt-1 text-[18px] font-semibold tabular-nums tracking-tight ${it.tone}`}>{it.value}</p>
          </div>
        ))}
      </div>
    </footer>
  );
}

function fmtCount(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
