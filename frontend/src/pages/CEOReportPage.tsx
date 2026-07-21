import { useMemo, useState } from "react";
import type { DashboardData, EmployeeDashboard, DailyEntry, PeriodState } from "../types";
import { dateInPeriod, describePeriod, isRealAttendanceDay } from "../utils";
import EmployeeListModal from "../components/EmployeeListModal";
import EmployeeMonthlyCalendar from "../components/EmployeeMonthlyCalendar";
import MonthlyHoursThresholdCard from "../components/MonthlyHoursThresholdCard";

interface Props {
  dashboard: DashboardData;
  periodState: PeriodState;
}

type Category = "present" | "absent" | "wfh" | "cl" | "sl" | "pl" | "comp_off";

const CATEGORY_META: Record<Category, { label: string; title: string; dot: string }> = {
  present:  { label: "Present",  title: "Present Employees",  dot: "bg-emerald-400" },
  absent:   { label: "Absent",   title: "Absent Employees",   dot: "bg-red-400" },
  wfh:      { label: "WFH",      title: "WFH Employees",      dot: "bg-teal-400" },
  cl:       { label: "CL",       title: "CL Employees",       dot: "bg-blue-400" },
  sl:       { label: "SL",       title: "SL Employees",       dot: "bg-rose-400" },
  pl:       { label: "PL",       title: "PL Employees",       dot: "bg-violet-400" },
  comp_off: { label: "Comp Off", title: "Comp Off Employees", dot: "bg-orange-400" },
};

const LEAVE_CARD_ORDER: Category[] = ["cl", "sl", "pl", "wfh", "comp_off", "absent"];
const ALL_CATEGORIES: Category[] = ["present", "absent", "wfh", "cl", "sl", "pl", "comp_off"];

// Pastel card palette, cycled by index — matches the reference dashboard's
// violet / blue / emerald stat-tile look.
const PALETTE = [
  { bg: "bg-violet-200",  badge: "bg-white/60 text-violet-700",  label: "text-violet-700", value: "text-violet-950" },
  { bg: "bg-blue-200",    badge: "bg-white/60 text-blue-700",    label: "text-blue-700",   value: "text-blue-950" },
  { bg: "bg-emerald-200", badge: "bg-white/60 text-emerald-700", label: "text-emerald-700", value: "text-emerald-950" },
  { bg: "bg-rose-200",    badge: "bg-white/60 text-rose-700",    label: "text-rose-700",   value: "text-rose-950" },
  { bg: "bg-amber-200",   badge: "bg-white/60 text-amber-700",   label: "text-amber-700",  value: "text-amber-950" },
  { bg: "bg-teal-200",    badge: "bg-white/60 text-teal-700",    label: "text-teal-700",   value: "text-teal-950" },
];

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

function CardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {children}
    </div>
  );
}

export default function CEOReportPage({ dashboard, periodState }: Props) {
  const [modalCategory, setModalCategory] = useState<Category | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeDashboard | null>(null);
  const [showMissingModal, setShowMissingModal] = useState(false);

  const isMonthMode = periodState.periodMode === "month";

  // For month view only: an employee counts toward the month's stats only if
  // they have at least one *real* attendance record that month (present /
  // WFH / leave / comp-off / lwd). Employees whose whole month is nothing
  // but blank / absent / holiday placeholders are treated as missing data —
  // their sheet almost certainly wasn't uploaded for that month — and are
  // excluded from every count and average below.
  const properlyMarkedIds = useMemo(() => {
    if (!isMonthMode) return null;
    const set = new Set<string>();
    for (const emp of dashboard.employees) {
      for (const day of emp.daily) {
        if (dateInPeriod(day.date, periodState) && isRealAttendanceDay(day)) {
          set.add(emp.emp_id);
          break;
        }
      }
    }
    return set;
  }, [dashboard, periodState, isMonthMode]);

  const missingDataEmployees = useMemo(() => {
    if (!properlyMarkedIds) return [];
    return dashboard.employees.filter((e) => !properlyMarkedIds.has(e.emp_id));
  }, [dashboard, properlyMarkedIds]);

  const rows: DayRow[] = useMemo(() => {
    const out: DayRow[] = [];
    for (const emp of dashboard.employees) {
      if (properlyMarkedIds && !properlyMarkedIds.has(emp.emp_id)) continue;
      for (const day of emp.daily) {
        if (dateInPeriod(day.date, periodState)) out.push({ emp, day });
      }
    }
    return out;
  }, [dashboard, periodState, properlyMarkedIds]);

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

  const totalEmployeesForPeriod = isMonthMode ? (properlyMarkedIds?.size ?? 0) : dashboard.employee_count;
  const activeCount = properlyMarkedIds?.size ?? 0;
  const avgPresent = activeCount ? counts.present / activeCount : 0;
  const avgAbsent = activeCount ? counts.absent / activeCount : 0;
  const avgLeave = activeCount ? noOfLeave / activeCount : 0;

  return (
    <div className="space-y-6">
      <div className="rounded-[24px] bg-white px-5 py-5 shadow-sm">
        <p className="text-[13px] text-slate-500">
          {hasData ? `${rows.length} attendance ${rows.length === 1 ? "record" : "records"} across ${periodLabel}.` : "No records for this period."}
          {isMonthMode && hasData && (
            <span> {totalEmployeesForPeriod} of {dashboard.employee_count} employees have properly marked data this month.</span>
          )}
        </p>
        {isMonthMode && missingDataEmployees.length > 0 && (
          <button
            onClick={() => setShowMissingModal(true)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-[11px] font-semibold text-orange-700 transition hover:bg-orange-200"
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m0 3.75h.008v.008H12v-.008zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {missingDataEmployees.length} employee{missingDataEmployees.length === 1 ? "" : "s"} with no attendance data this month
          </button>
        )}
      </div>

      {!hasData ? (
        <div className="rounded-[24px] border border-dashed border-slate-300 bg-white/70 px-6 py-16 text-center">
          <p className="text-sm font-semibold text-slate-700">No attendance for {periodLabel}</p>
          <p className="mt-2 text-sm text-slate-500">Try selecting a different period from the top.</p>
        </div>
      ) : (
        <>
          <CardGrid>
            <SummaryCard
              index={0}
              label={isMonthMode ? "Employees (Data)" : "Total Employees"}
              value={totalEmployeesForPeriod}
              onClick={isMonthMode && missingDataEmployees.length > 0 ? () => setShowMissingModal(true) : undefined}
            />
            <SummaryCard index={1} label="No. of Leave" value={noOfLeave} />
            <SummaryCard index={2} label="No. of Present" value={counts.present} onClick={() => setModalCategory("present")} />
            {LEAVE_CARD_ORDER.map((key, i) => {
              const meta = CATEGORY_META[key];
              return (
                <SummaryCard
                  key={key}
                  index={i + 3}
                  label={meta.label}
                  value={counts[key]}
                  onClick={() => setModalCategory(key)}
                />
              );
            })}
          </CardGrid>

          {isMonthMode && (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Monthly averages · per employee with data
              </p>
              <CardGrid>
                <SummaryCard index={0} label="Employees w/ Data" value={activeCount} suffix={`of ${dashboard.employee_count} total`} />
                <SummaryCard index={1} label="Avg Present" value={avgPresent} suffix="days / employee" />
                <SummaryCard index={2} label="Avg Absent" value={avgAbsent} suffix="days / employee" />
                <SummaryCard index={3} label="Avg Leave" value={avgLeave} suffix="days / employee" />
              </CardGrid>
            </div>
          )}

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

      <EmployeeListModal
        open={showMissingModal}
        title="No Attendance Data"
        accentDot="bg-orange-400"
        employees={missingDataEmployees}
        onClose={() => setShowMissingModal(false)}
        onSelectEmployee={(emp) => {
          setShowMissingModal(false);
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

function SummaryCard({
  index,
  label,
  value,
  suffix,
  onClick,
}: {
  index: number;
  label: string;
  value: number;
  suffix?: string;
  onClick?: () => void;
}) {
  const tone = PALETTE[index % PALETTE.length];
  const Tag = onClick ? "button" : "div";
  const display = value % 1 === 0 ? value : value.toFixed(1);
  return (
    <Tag
      onClick={onClick}
      className={`group relative flex w-full flex-col items-start rounded-[22px] ${tone.bg} px-4 py-4 text-left transition ${
        onClick ? "hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-white" : ""
      }`}
    >
      <span className={`flex h-8 w-8 items-center justify-center rounded-full ${tone.badge}`}>
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </span>
      <p className={`mt-3 w-full truncate text-[11px] font-semibold ${tone.label}`}>{label}</p>
      <p className={`mt-1 text-[26px] font-bold leading-none tabular-nums ${tone.value}`}>{display}</p>
      {suffix && <p className={`mt-1 w-full truncate text-[10.5px] ${tone.label} opacity-70`}>{suffix}</p>}
    </Tag>
  );
}
