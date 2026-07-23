import { useEffect, useMemo, useState } from "react";
import type { DashboardData, EmployeeDashboard, DailyEntry, PeriodState } from "../types";
import { dateInPeriod, describePeriod, isRealAttendanceDay, isMissPunch, formatDate } from "../utils";
import EmployeeListModal from "../components/EmployeeListModal";
import EmployeeMonthlyCalendar from "../components/EmployeeMonthlyCalendar";
import MonthlyHoursThresholdCard from "../components/MonthlyHoursThresholdCard";
import EmptyState from "../components/ui/EmptyState";
import StatCard from "../components/ui/StatCard";
import DonutChart from "../components/ui/DonutChart";
import Button from "../components/ui/Button";

interface Props {
  dashboard: DashboardData;
  periodState: PeriodState;
  onRefresh?: () => void;
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

const TONE = { present: "#10b981", absent: "#ef4444", wfh: "#3b82f6" };
const DAILY_PAGE_SIZE = 8;

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

export default function CEOReportPage({ dashboard, periodState, onRefresh }: Props) {
  const [modalCategory, setModalCategory] = useState<Category | null>(null);
  const [showLeaveGroupModal, setShowLeaveGroupModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeDashboard | null>(null);
  const [showMissingModal, setShowMissingModal] = useState(false);
  const [dailySearch, setDailySearch] = useState("");
  const [dailyPage, setDailyPage] = useState(1);

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

  // Present / Absent / WFH form the "recorded attendance" universe used for
  // the overview donut and daily breakdown — leave/holiday/comp-off are
  // tracked separately above and intentionally excluded from this 3-way split.
  const totalRecorded = counts.present + counts.absent + counts.wfh;
  const avgPresentPct = totalRecorded > 0 ? (counts.present / totalRecorded) * 100 : 0;
  const avgAbsentPct = totalRecorded > 0 ? (counts.absent / totalRecorded) * 100 : 0;
  const avgWfhPct = totalRecorded > 0 ? (counts.wfh / totalRecorded) * 100 : 0;

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

  const dailyStats = useMemo(() => {
    const map = new Map<string, { present: number; absent: number; wfh: number }>();
    for (const { day } of rows) {
      if (!map.has(day.date)) map.set(day.date, { present: 0, absent: 0, wfh: 0 });
      const bucket = map.get(day.date)!;
      const st = day.status_type;
      const sub = day.leave_subtype;
      if (st === "present" || st === "weekend_worked") bucket.present += 1;
      else if (st === "absent") bucket.absent += 1;
      else if (st === "wfh") bucket.wfh += 1;
      else if (st === "half_leave" && sub === "half_wfh") bucket.wfh += 0.5;
    }
    return Array.from(map.entries())
      .map(([date, b]) => {
        const total = b.present + b.absent + b.wfh;
        return {
          date,
          total,
          present: b.present,
          absent: b.absent,
          wfh: b.wfh,
          presentPct: total > 0 ? (b.present / total) * 100 : 0,
          absentPct: total > 0 ? (b.absent / total) * 100 : 0,
          wfhPct: total > 0 ? (b.wfh / total) * 100 : 0,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [rows]);

  const filteredDaily = useMemo(() => {
    if (!dailySearch.trim()) return dailyStats;
    const q = dailySearch.toLowerCase();
    return dailyStats.filter((d) => formatDate(d.date).toLowerCase().includes(q) || d.date.includes(q));
  }, [dailyStats, dailySearch]);

  useEffect(() => {
    setDailyPage(1);
  }, [periodState, dailySearch]);

  const totalDailyPages = Math.max(1, Math.ceil(filteredDaily.length / DAILY_PAGE_SIZE));
  const pagedDaily = filteredDaily.slice((dailyPage - 1) * DAILY_PAGE_SIZE, dailyPage * DAILY_PAGE_SIZE);

  const hasData = rows.length > 0;
  const periodLabel = describePeriod(periodState);
  const totalEmployeesForPeriod = isMonthMode ? (properlyMarkedIds?.size ?? 0) : dashboard.employee_count;

  return (
    <div className="space-y-6">
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
          title="No attendance records available."
          description={`Nothing for ${periodLabel} yet — try a different period, or refresh.`}
        >
          {onRefresh && <Button variant="primary" onClick={onRefresh}>Refresh</Button>}
        </EmptyState>
      ) : (
        <div className="animate-fade-in space-y-6">
          {/* Attendance Overview — donut + averages */}
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="mb-4 text-[13px] font-semibold text-slate-900">Attendance Overview</p>
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
              <DonutChart
                segments={[
                  { label: "Present", value: avgPresentPct, color: TONE.present },
                  { label: "Absent", value: avgAbsentPct, color: TONE.absent },
                  { label: "WFH", value: avgWfhPct, color: TONE.wfh },
                ]}
                centerValue={`${avgPresentPct.toFixed(0)}%`}
                centerLabel="Present"
              />
              <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
                <OverviewStat label="Average Present" pct={avgPresentPct} count={counts.present} tone="text-emerald-600" dot="bg-emerald-500" />
                <OverviewStat label="Average Absent" pct={avgAbsentPct} count={counts.absent} tone="text-red-600" dot="bg-red-500" />
                <OverviewStat label="Average WFH" pct={avgWfhPct} count={counts.wfh} tone="text-blue-600" dot="bg-blue-500" />
              </div>
            </div>
          </section>

          {/* Attendance Statistics */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard label="Total Employees" value={fmt(totalEmployeesForPeriod)} />
            <StatCard label="Attendance Recorded" value={fmt(totalRecorded)} />
            <StatCard label="Overall Present" value={fmt(counts.present)} tone="present" onClick={() => setModalCategory("present")} />
            <StatCard label="Overall Absent" value={fmt(counts.absent)} tone="absent" onClick={() => setModalCategory("absent")} />
            <StatCard label="Overall WFH" value={fmt(counts.wfh)} tone="wfh" onClick={() => setModalCategory("wfh")} />
          </div>

          {/* Leave + miss-punch — secondary detail, not top-level noise */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setShowLeaveGroupModal(true)}
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11.5px] font-medium text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
            >
              Leave <span className="tabular-nums text-slate-700">{fmt(leaveTotal)}</span>
            </button>
            {LEAVE_SUBTYPES.map((key) => (
              <button
                key={key}
                onClick={() => setModalCategory(key)}
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11.5px] font-medium text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
              >
                {CATEGORY_META[key].label} <span className="tabular-nums text-slate-700">{fmt(counts[key])}</span>
              </button>
            ))}
            <button
              onClick={() => setModalCategory("misspunch")}
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11.5px] font-medium text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
            >
              Miss Punch <span className="tabular-nums text-orange-600">{fmt(counts.misspunch)}</span>
            </button>
          </div>

          <MonthlyHoursThresholdCard employees={dashboard.employees} datesProcessed={dashboard.dates_processed} />

          {/* Daily Attendance Cards */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] font-semibold text-slate-900">Daily Attendance</p>
              <div className="relative w-48">
                <svg className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  value={dailySearch}
                  onChange={(e) => setDailySearch(e.target.value)}
                  placeholder="Search by date"
                  className="w-full rounded-md border border-slate-200 py-1.5 pl-8 pr-3 text-[12px] outline-none transition focus:border-slate-900"
                />
              </div>
            </div>

            {filteredDaily.length === 0 ? (
              <EmptyState
                icon={
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                }
                title="No days match your search"
                description="Try a different date."
              />
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {pagedDaily.map((d) => (
                    <div key={d.date} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="text-[13px] font-semibold text-slate-900">{formatDate(d.date)}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">{d.total} employees recorded</p>
                      <div className="mt-3 space-y-1.5">
                        <DailyRow label="Present" count={d.present} pct={d.presentPct} tone="text-emerald-600" dot="bg-emerald-500" />
                        <DailyRow label="Absent" count={d.absent} pct={d.absentPct} tone="text-red-600" dot="bg-red-500" />
                        <DailyRow label="WFH" count={d.wfh} pct={d.wfhPct} tone="text-blue-600" dot="bg-blue-500" />
                      </div>
                    </div>
                  ))}
                </div>

                {totalDailyPages > 1 && (
                  <div className="flex items-center justify-between pt-1">
                    <p className="text-[11.5px] text-slate-400">
                      Page {dailyPage} of {totalDailyPages}
                    </p>
                    <div className="flex gap-1.5">
                      <Button variant="secondary" disabled={dailyPage <= 1} onClick={() => setDailyPage((p) => p - 1)}>
                        Previous
                      </Button>
                      <Button variant="secondary" disabled={dailyPage >= totalDailyPages} onClick={() => setDailyPage((p) => p + 1)}>
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
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

function OverviewStat({ label, pct, count, tone, dot }: { label: string; pct: number; count: number; tone: string; dot: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-4 py-3.5">
      <p className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wide text-slate-400">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} /> {label}
      </p>
      <p className={`mt-1.5 text-[22px] font-semibold leading-none tabular-nums ${tone}`}>{pct.toFixed(1)}%</p>
      <p className="mt-1 text-[11px] text-slate-400">{fmt(count)} employees</p>
    </div>
  );
}

function DailyRow({ label, count, pct, tone, dot }: { label: string; count: number; pct: number; tone: string; dot: string }) {
  return (
    <div className="flex items-center justify-between text-[12px]">
      <span className="flex items-center gap-1.5 text-slate-500">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} /> {label}
      </span>
      <span className={`font-medium tabular-nums ${tone}`}>{fmt(count)} ({pct.toFixed(1)}%)</span>
    </div>
  );
}

function fmt(value: number): string {
  return value % 1 === 0 ? String(value) : value.toFixed(1);
}
