import { useMemo, useState } from "react";
import type { DashboardData, EmployeeDashboard, DailyEntry, PeriodState } from "../types";
import { dateInPeriod, describePeriod, isRealAttendanceDay, isMissPunch } from "../utils";
import EmployeeListModal from "../components/EmployeeListModal";
import EmployeeMonthlyCalendar from "../components/EmployeeMonthlyCalendar";
import MonthlyHoursThresholdCard from "../components/MonthlyHoursThresholdCard";
import EmptyState from "../components/ui/EmptyState";
import StatCard from "../components/ui/StatCard";

interface Props {
  dashboard: DashboardData;
  periodState: PeriodState;
}

type Category = "present" | "absent" | "wfh" | "cl" | "sl" | "pl" | "comp_off" | "misspunch";

const CATEGORY_META: Record<Category, { label: string; title: string; dot: string }> = {
  present:   { label: "Present",    title: "Present Employees",    dot: "bg-emerald-400" },
  absent:    { label: "Absent",     title: "Absent Employees",     dot: "bg-red-400" },
  wfh:       { label: "WFH",        title: "WFH Employees",        dot: "bg-blue-400" },
  cl:        { label: "CL",         title: "Casual Leave",         dot: "bg-amber-400" },
  sl:        { label: "SL",         title: "Sick Leave",           dot: "bg-amber-400" },
  pl:        { label: "PL",         title: "Paid Leave",           dot: "bg-amber-400" },
  comp_off:  { label: "Comp Off",   title: "Comp Off",             dot: "bg-amber-400" },
  misspunch: { label: "Miss Punch", title: "Miss-Punch Employees", dot: "bg-orange-400" },
};

const LEAVE_SUBTYPES: Category[] = ["cl", "sl", "pl", "comp_off"];
const ALL_CATEGORIES: Category[] = ["present", "absent", "wfh", "cl", "sl", "pl", "comp_off", "misspunch"];

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
    case "misspunch": return isMissPunch(day);
  }
}

interface DayRow {
  emp: EmployeeDashboard;
  day: DailyEntry;
}

export default function CEOReportPage({ dashboard, periodState }: Props) {
  const [modalCategory, setModalCategory] = useState<Category | null>(null);
  const [showLeaveGroupModal, setShowLeaveGroupModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeDashboard | null>(null);
  const [showMissingModal, setShowMissingModal] = useState(false);

  const isMonthMode = periodState.periodMode === "month";

  // For month view only: an employee counts toward the month's stats only if
  // they have at least one *real* attendance record that month (present /
  // WFH / leave / comp-off / lwd). Employees whose whole month is nothing
  // but blank / absent / holiday placeholders are treated as missing data —
  // their sheet almost certainly wasn't uploaded for that month — and are
  // excluded from every count below.
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
    const c = { present: 0, absent: 0, wfh: 0, cl: 0, sl: 0, pl: 0, comp_off: 0, misspunch: 0 };
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
      if (isMissPunch(day)) c.misspunch += 1;
    }
    return c;
  }, [rows]);

  const leaveTotal = counts.cl + counts.sl + counts.pl + counts.comp_off;

  const categoryEmployees = useMemo(() => {
    const out: Record<Category, EmployeeDashboard[]> = {
      present: [], absent: [], wfh: [], cl: [], sl: [], pl: [], comp_off: [], misspunch: [],
    };
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

  const leaveGroupEmployees = useMemo(() => {
    const seen = new Set<string>();
    const out: EmployeeDashboard[] = [];
    for (const key of LEAVE_SUBTYPES) {
      for (const emp of categoryEmployees[key]) {
        if (!seen.has(emp.emp_id)) {
          seen.add(emp.emp_id);
          out.push(emp);
        }
      }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, [categoryEmployees]);

  const hasData = rows.length > 0;
  const periodLabel = describePeriod(periodState);
  const totalEmployeesForPeriod = isMonthMode ? (properlyMarkedIds?.size ?? 0) : dashboard.employee_count;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-slate-500">
        <p>
          {periodLabel} · {totalEmployeesForPeriod} of {dashboard.employee_count} employees
        </p>
        {isMonthMode && missingDataEmployees.length > 0 && (
          <button
            onClick={() => setShowMissingModal(true)}
            className="font-medium text-orange-600 underline-offset-2 hover:underline"
          >
            {missingDataEmployees.length} employee{missingDataEmployees.length === 1 ? "" : "s"} with no data this month
          </button>
        )}
      </div>

      {!hasData ? (
        <EmptyState
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
          title={`No attendance for ${periodLabel}`}
          description="Try a different period from the filter above."
        />
      ) : (
        <>
          {/* Row 1 — key business metrics */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard label="Present" value={fmt(counts.present)} tone="present" onClick={() => setModalCategory("present")} />
            <StatCard label="WFH" value={fmt(counts.wfh)} tone="wfh" onClick={() => setModalCategory("wfh")} />
            <StatCard label="Leave" value={fmt(leaveTotal)} tone="leave" onClick={() => setShowLeaveGroupModal(true)} />
            <StatCard label="Absent" value={fmt(counts.absent)} tone="absent" onClick={() => setModalCategory("absent")} />
            <StatCard label="Miss Punch" value={fmt(counts.misspunch)} tone="missPunch" onClick={() => setModalCategory("misspunch")} />
          </div>

          {/* Leave breakdown — secondary detail, not top-level noise */}
          <div className="flex flex-wrap items-center gap-1.5">
            {LEAVE_SUBTYPES.map((key) => (
              <button
                key={key}
                onClick={() => setModalCategory(key)}
                className="border border-slate-200 bg-white px-2.5 py-1 text-[11.5px] font-medium text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
              >
                {CATEGORY_META[key].label} <span className="tabular-nums text-slate-700">{fmt(counts[key])}</span>
              </button>
            ))}
          </div>

          {/* Row 2 — monthly hours target */}
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
        open={showLeaveGroupModal}
        title="On Leave"
        accentDot="bg-amber-400"
        employees={leaveGroupEmployees}
        onClose={() => setShowLeaveGroupModal(false)}
        onSelectEmployee={(emp) => {
          setShowLeaveGroupModal(false);
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

function fmt(value: number): string {
  return value % 1 === 0 ? String(value) : value.toFixed(1);
}
