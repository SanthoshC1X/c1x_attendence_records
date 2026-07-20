import { useMemo, useState } from "react";
import type { DashboardData, EmployeeDashboard, DailyEntry, PeriodState } from "../types";
import { dateInPeriod, describePeriod } from "../utils";
import EmployeeListModal from "../components/EmployeeListModal";
import EmployeeMonthlyCalendar from "../components/EmployeeMonthlyCalendar";
import MonthlyHoursThresholdCard from "../components/MonthlyHoursThresholdCard";

interface Props {
  dashboard: DashboardData;
  periodState: PeriodState;
}

type Category = "present" | "absent" | "wfh" | "cl" | "sl" | "pl" | "comp_off";

const CATEGORY_META: Record<Category, { label: string; title: string; accent: string; bar: string; dot: string }> = {
  present:  { label: "Present",  title: "Present Employees",  accent: "bg-emerald-50 text-emerald-800 ring-emerald-200", bar: "bg-emerald-500", dot: "bg-emerald-500" },
  absent:   { label: "Absent",   title: "Absent Employees",   accent: "bg-red-50 text-red-800 ring-red-200",             bar: "bg-red-500",     dot: "bg-red-500" },
  wfh:      { label: "WFH",      title: "WFH Employees",      accent: "bg-teal-50 text-teal-800 ring-teal-200",          bar: "bg-teal-500",    dot: "bg-teal-500" },
  cl:       { label: "CL",       title: "CL Employees",       accent: "bg-blue-50 text-blue-800 ring-blue-200",          bar: "bg-blue-500",    dot: "bg-blue-500" },
  sl:       { label: "SL",       title: "SL Employees",       accent: "bg-rose-50 text-rose-800 ring-rose-200",          bar: "bg-rose-500",    dot: "bg-rose-500" },
  pl:       { label: "PL",       title: "PL Employees",       accent: "bg-violet-50 text-violet-800 ring-violet-200",    bar: "bg-violet-500",  dot: "bg-violet-500" },
  comp_off: { label: "Comp Off", title: "Comp Off Employees", accent: "bg-orange-50 text-orange-800 ring-orange-200",   bar: "bg-orange-500",  dot: "bg-orange-500" },
};

const LEAVE_CARD_ORDER: Category[] = ["cl", "sl", "pl", "wfh", "comp_off", "absent"];
const ALL_CATEGORIES: Category[] = ["present", "absent", "wfh", "cl", "sl", "pl", "comp_off"];

function rowMatches(category: Category, day: DailyEntry): boolean {
  const st = day.status_type;
  const sub = (day.leave_subtype || "").toLowerCase();
  switch (category) {
    case "present":   return st === "present" || st === "weekend_worked";
    case "absent":    return st === "absent";
    case "wfh":       return st === "wfh" || sub === "half_wfh";
    case "cl":        return sub === "cl" || sub === "half_cl";
    case "sl":        return sub === "sl" || sub === "half_sl";
    case "pl":        return sub === "pl" || sub === "half_pl";
    case "comp_off":  return st === "comp_off" || sub === "half_comp";
  }
}

interface DayRow {
  emp: EmployeeDashboard;
  day: DailyEntry;
}

export default function CEOReportPage({ dashboard, periodState }: Props) {
  const [modalCategory, setModalCategory] = useState<Category | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeDashboard | null>(null);

  const rows: DayRow[] = useMemo(() => {
    const out: DayRow[] = [];
    for (const emp of dashboard.employees) {
      for (const day of emp.daily) {
        if (dateInPeriod(day.date, periodState)) out.push({ emp, day });
      }
    }
    return out;
  }, [dashboard, periodState]);

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, wfh: 0, cl: 0, sl: 0, pl: 0, comp_off: 0 };
    for (const { day } of rows) {
      const st = day.status_type;
      const sub = day.leave_subtype;
      if (st === "present" || st === "weekend_worked") c.present += 1;
      else if (st === "absent") c.absent += 1;
      else if (st === "wfh") c.wfh += 1;
      else if (st === "comp_off") c.comp_off += 1;
      else if (st === "half_leave") {
        if (sub === "half_wfh") c.wfh += 0.5;
        else if (sub === "half_cl") c.cl += 0.5;
        else if (sub === "half_sl") c.sl += 0.5;
        else if (sub === "half_pl") c.pl += 0.5;
        else if (sub === "half_comp") c.comp_off += 0.5;
      } else if (st === "leave") {
        if (sub === "cl") c.cl += 1;
        else if (sub === "sl") c.sl += 1;
        else if (sub === "pl") c.pl += 1;
      }
    }
    return c;
  }, [rows]);

  const noOfLeave = counts.wfh + counts.cl + counts.sl + counts.pl + counts.comp_off;

  const categoryEmployees = useMemo(() => {
    const out: Record<Category, EmployeeDashboard[]> = { present: [], absent: [], wfh: [], cl: [], sl: [], pl: [], comp_off: [] };
    for (const key of ALL_CATEGORIES) {
      const seen = new Set<string>();
      for (const row of rows) {
        if (!rowMatches(key, row.day)) continue;
        if (!seen.has(row.emp.emp_id)) {
          seen.add(row.emp.emp_id);
          out[key].push(row.emp);
        }
      }
      out[key].sort((a, b) => a.name.localeCompare(b.name));
    }
    return out;
  }, [rows]);

  const hasData = rows.length > 0;
  const periodLabel = describePeriod(periodState);

  return (
    <div className="space-y-6">
      <div className="rounded-[24px] border border-slate-200/70 bg-white/90 px-5 py-5 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Executive snapshot</p>
        <h2 className="mt-1.5 text-[22px] font-semibold tracking-tight text-slate-950">{periodLabel}</h2>
        <p className="mt-1 text-[13px] text-slate-500">
          {hasData ? `${rows.length} attendance ${rows.length === 1 ? "record" : "records"} across the selected period.` : "No records for this period."}
        </p>
      </div>

      {!hasData ? (
        <div className="rounded-[24px] border border-dashed border-slate-300 bg-white/70 px-6 py-16 text-center">
          <p className="text-sm font-semibold text-slate-700">No attendance for {periodLabel}</p>
          <p className="mt-2 text-sm text-slate-500">Try selecting a different period from the top.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SummaryCard label="Total Employees" value={dashboard.employee_count} accent="bg-slate-50 text-slate-800 ring-slate-200" bar="bg-slate-500" />
            <SummaryCard label="No. of Leave" value={noOfLeave} accent="bg-indigo-50 text-indigo-800 ring-indigo-200" bar="bg-indigo-500" />
            <SummaryCard
              label="No. of Present"
              value={counts.present}
              accent="bg-emerald-50 text-emerald-800 ring-emerald-200"
              bar="bg-emerald-500"
              onClick={() => setModalCategory("present")}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {LEAVE_CARD_ORDER.map((key) => {
              const meta = CATEGORY_META[key];
              return (
                <SummaryCard
                  key={key}
                  label={meta.label}
                  value={counts[key]}
                  accent={meta.accent}
                  bar={meta.bar}
                  onClick={() => setModalCategory(key)}
                />
              );
            })}
          </div>

          <MonthlyHoursThresholdCard employees={dashboard.employees} datesProcessed={dashboard.dates_processed} />
        </>
      )}

      <EmployeeListModal
        open={modalCategory !== null}
        title={modalCategory ? CATEGORY_META[modalCategory].title : ""}
        accentDot={modalCategory ? CATEGORY_META[modalCategory].dot : undefined}
        employees={modalCategory ? categoryEmployees[modalCategory] : []}
        onClose={() => setModalCategory(null)}
        onSelectEmployee={(emp) => {
          setModalCategory(null);
          setSelectedEmployee(emp);
        }}
      />

      <EmployeeMonthlyCalendar
        employee={selectedEmployee}
        onClose={() => setSelectedEmployee(null)}
      />
    </div>
  );
}

function SummaryCard({ label, value, accent, bar, onClick }: { label: string; value: number; accent: string; bar: string; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl px-5 py-5 text-left ring-1 transition ${accent} ${
        onClick ? "hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-900/20" : ""
      }`}
    >
      <span className={`absolute left-0 top-0 h-full w-1 ${bar}`} />
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-80">{label}</p>
      <p className="mt-1.5 text-3xl font-semibold leading-none tabular-nums">{value % 1 === 0 ? value : value.toFixed(1)}</p>
    </Tag>
  );
}
