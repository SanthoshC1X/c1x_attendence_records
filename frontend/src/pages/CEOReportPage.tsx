import { useMemo, useState } from "react";
import type { DashboardData, EmployeeDashboard, DailyEntry, PeriodState } from "../types";
import { dateInPeriod, describePeriod, getMonthIsoWeeks } from "../utils";
import EmployeeListModal from "../components/EmployeeListModal";
import EmployeeMonthlyCalendar from "../components/EmployeeMonthlyCalendar";
import WeeklyUnderHoursSection from "../components/WeeklyUnderHoursSection";

interface Props {
  dashboard: DashboardData;
  periodState: PeriodState;
}

function parseFirstPunchMinutes(t: string): number | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (Number.isNaN(h) || Number.isNaN(mm)) return null;
  return h * 60 + mm;
}

const LATE_CUTOFF_MIN = 12 * 60;
const TARGET_MINUTES_PER_WEEKDAY = 9 * 60;

type Category = "present" | "absent" | "wfh" | "cl" | "sl" | "pl" | "comp_off" | "half_leave";

const CATEGORY_META: Record<Category, { label: string; title: string; accent: string; bar: string; dot: string }> = {
  present:    { label: "Present",  title: "Present Employees",   accent: "bg-emerald-50 text-emerald-800 ring-emerald-200", bar: "bg-emerald-500", dot: "bg-emerald-500" },
  absent:     { label: "Absent",   title: "Absent Employees",    accent: "bg-red-50 text-red-800 ring-red-200",             bar: "bg-red-500",     dot: "bg-red-500" },
  wfh:        { label: "WFH",      title: "WFH Employees",       accent: "bg-teal-50 text-teal-800 ring-teal-200",          bar: "bg-teal-500",    dot: "bg-teal-500" },
  cl:         { label: "CL",       title: "CL Employees",        accent: "bg-blue-50 text-blue-800 ring-blue-200",          bar: "bg-blue-500",    dot: "bg-blue-500" },
  sl:         { label: "SL",       title: "SL Employees",        accent: "bg-rose-50 text-rose-800 ring-rose-200",          bar: "bg-rose-500",    dot: "bg-rose-500" },
  pl:         { label: "PL",       title: "PL Employees",        accent: "bg-violet-50 text-violet-800 ring-violet-200",    bar: "bg-violet-500",  dot: "bg-violet-500" },
  comp_off:   { label: "Comp Off", title: "Comp Off Employees",  accent: "bg-orange-50 text-orange-800 ring-orange-200",    bar: "bg-orange-500",  dot: "bg-orange-500" },
  half_leave: { label: "Half Day", title: "Half Day Employees",  accent: "bg-yellow-50 text-yellow-800 ring-yellow-200",    bar: "bg-yellow-500",  dot: "bg-yellow-500" },
};

const SUMMARY_ORDER: Category[] = ["present", "absent", "wfh", "cl", "sl", "pl", "comp_off", "half_leave"];
const LEAVE_LIST_ORDER: Category[] = ["wfh", "cl", "sl", "pl", "comp_off", "half_leave"];

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
    case "half_leave":return st === "half_leave";
  }
}

interface DayRow {
  emp: EmployeeDashboard;
  day: DailyEntry;
}

interface WeeklyUnderEmployee {
  emp: EmployeeDashboard;
  actualMinutes: number;
  expectedMinutes: number;
  deficitMinutes: number;
  trackedWeekdays: number;
}

interface WeeklyUnderSection {
  key: string;
  weekLabel: string;
  sliceLabel: string;
  throughLabel: string;
  expectedMinutes: number;
  employees: WeeklyUnderEmployee[];
}

interface WeeklyUnderMonthCard {
  key: string;
  title: string;
  throughLabel: string;
  flaggedCount: number;
  weeks: WeeklyUnderSection[];
}

function isoToDate(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfIsoWeek(date: Date): Date {
  const d = new Date(date);
  const dow = d.getDay();
  const daysToMon = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + daysToMon);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfIsoWeek(date: Date): Date {
  const d = startOfIsoWeek(date);
  d.setDate(d.getDate() + 6);
  return d;
}

function isWeekdayIso(iso: string): boolean {
  const dow = isoToDate(iso).getDay();
  return dow >= 1 && dow <= 5;
}

function workedMinutes(day: DailyEntry | undefined): number {
  if (!day || typeof day.total_minutes !== "number" || day.total_minutes <= 0) return 0;
  return day.total_minutes;
}

function formatShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function formatMonthYear(year: number, monthIndex: number): string {
  return new Date(year, monthIndex, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function fmtHours(minutes: number): string {
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  return `${hh}h ${String(mm).padStart(2, "0")}m`;
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
    const c = { present: 0, wfh: 0, cl: 0, sl: 0, pl: 0, comp_off: 0, half_leave: 0, absent: 0, total: rows.length };
    for (const { day } of rows) {
      const st = day.status_type;
      const sub = day.leave_subtype;
      if (st === "present" || st === "weekend_worked") c.present += 1;
      else if (st === "wfh") c.wfh += 1;
      else if (st === "absent") c.absent += 1;
      else if (st === "comp_off") c.comp_off += 1;
      else if (st === "half_leave") {
        c.half_leave += 1;
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

  const leaveLists = useMemo(() => {
    const groups: Record<Category, DayRow[]> = {
      present: [], absent: [], wfh: [], cl: [], sl: [], pl: [], comp_off: [], half_leave: [],
    };
    for (const row of rows) {
      for (const key of SUMMARY_ORDER) {
        if (rowMatches(key, row.day)) groups[key].push(row);
      }
    }
    return groups;
  }, [rows]);

  const categoryEmployees = useMemo(() => {
    const out: Record<Category, EmployeeDashboard[]> = {
      present: [], absent: [], wfh: [], cl: [], sl: [], pl: [], comp_off: [], half_leave: [],
    };
    for (const key of SUMMARY_ORDER) {
      const seen = new Set<string>();
      for (const { emp } of leaveLists[key]) {
        if (!seen.has(emp.emp_id)) {
          seen.add(emp.emp_id);
          out[key].push(emp);
        }
      }
      out[key].sort((a, b) => a.name.localeCompare(b.name));
    }
    return out;
  }, [leaveLists]);

  const lateArrivals = useMemo(() => {
    return rows
      .filter(({ day }) => {
        if (day.status_type !== "present" && day.status_type !== "weekend_worked" && day.status_type !== "wfh") return false;
        const m = parseFirstPunchMinutes(day.in_time);
        return m !== null && m > LATE_CUTOFF_MIN;
      })
      .sort((a, b) => (parseFirstPunchMinutes(a.day.in_time) ?? 0) - (parseFirstPunchMinutes(b.day.in_time) ?? 0));
  }, [rows]);

  const weeklyUnderHoursByMonth = useMemo(() => {
    if (dashboard.dates_processed.length === 0) return [] as WeeklyUnderMonthCard[];

    const dayMaps = new Map<string, Map<string, DailyEntry>>();
    const firstActiveDates = new Map<string, string>();

    for (const emp of dashboard.employees) {
      const perDay = new Map<string, DailyEntry>();
      let firstActive: string | null = null;
      for (const day of emp.daily) {
        perDay.set(day.date, day);
        if (!firstActive && day.status_type) firstActive = day.date;
      }
      dayMaps.set(emp.emp_id, perDay);
      if (firstActive) firstActiveDates.set(emp.emp_id, firstActive);
    }

    const monthMap = new Map<string, string[]>();
    for (const iso of dashboard.dates_processed) {
      const key = iso.slice(0, 7);
      const bucket = monthMap.get(key);
      if (bucket) bucket.push(iso);
      else monthMap.set(key, [iso]);
    }

    return Array.from(monthMap.entries()).map(([monthKey, monthDates]) => {
      monthDates.sort();
      const [yearStr, monthStr] = monthKey.split("-");
      const year = Number(yearStr);
      const monthIndex = Number(monthStr) - 1;
      const latestMonthIso = monthDates[monthDates.length - 1];

      const weeks = getMonthIsoWeeks(year, monthIndex)
        .map((slice) => {
          const sliceStartIso = toIso(slice.start);
          const sliceEndIso = toIso(slice.end);
          const visibleDates = monthDates.filter((iso) => iso >= sliceStartIso && iso <= sliceEndIso);
          if (visibleDates.length === 0) return null;

          const fullWeekStart = startOfIsoWeek(slice.start);
          const fullWeekEnd = endOfIsoWeek(slice.start);
          const sectionExpectedMinutes = visibleDates.filter(isWeekdayIso).length * TARGET_MINUTES_PER_WEEKDAY;

          const employees = dashboard.employees
            .map((emp) => {
              const firstActive = firstActiveDates.get(emp.emp_id);
              if (!firstActive) return null;

              const trackedDates = visibleDates.filter((iso) => iso >= firstActive);
              const trackedWeekdays = trackedDates.filter(isWeekdayIso).length;
              if (trackedWeekdays === 0) return null;

              const actualMinutes = trackedDates.reduce((sum, iso) => {
                return sum + workedMinutes(dayMaps.get(emp.emp_id)?.get(iso));
              }, 0);
              const expectedMinutes = trackedWeekdays * TARGET_MINUTES_PER_WEEKDAY;
              if (actualMinutes >= expectedMinutes) return null;

              return {
                emp,
                actualMinutes,
                expectedMinutes,
                deficitMinutes: expectedMinutes - actualMinutes,
                trackedWeekdays,
              } satisfies WeeklyUnderEmployee;
            })
            .filter((item): item is WeeklyUnderEmployee => item !== null)
            .sort((a, b) => {
              if (b.deficitMinutes !== a.deficitMinutes) return b.deficitMinutes - a.deficitMinutes;
              if (a.actualMinutes !== b.actualMinutes) return a.actualMinutes - b.actualMinutes;
              return a.emp.name.localeCompare(b.emp.name);
            });

          return {
            key: `${monthKey}-${slice.weekNum}`,
            weekLabel: `${formatShort(toIso(fullWeekStart))} - ${formatShort(toIso(fullWeekEnd))}`,
            sliceLabel: `${formatShort(visibleDates[0])}${visibleDates.length > 1 ? ` - ${formatShort(visibleDates[visibleDates.length - 1])}` : ""}`,
            throughLabel: visibleDates[visibleDates.length - 1] === latestMonthIso ? `Through ${formatShort(latestMonthIso)}` : `Clipped at ${formatShort(visibleDates[visibleDates.length - 1])}`,
            expectedMinutes: sectionExpectedMinutes,
            employees,
          } satisfies WeeklyUnderSection;
        })
        .filter((week): week is WeeklyUnderSection => week !== null);

      return {
        key: monthKey,
        title: formatMonthYear(year, monthIndex),
        throughLabel: `Data through ${formatShort(latestMonthIso)}`,
        flaggedCount: weeks.reduce((sum, week) => sum + week.employees.length, 0),
        weeks,
      } satisfies WeeklyUnderMonthCard;
    });
  }, [dashboard]);

  const hasData = rows.length > 0;
  const periodLabel = describePeriod(periodState);
  const totalWeeklyFlags = weeklyUnderHoursByMonth.reduce((sum, month) => sum + month.flaggedCount, 0);

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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {SUMMARY_ORDER.map((key) => {
              const meta = CATEGORY_META[key];
              return (
                <SummaryCard
                  key={key}
                  label={meta.label}
                  value={counts[key as keyof typeof counts] as number}
                  accent={meta.accent}
                  bar={meta.bar}
                  onClick={() => setModalCategory(key)}
                />
              );
            })}
          </div>

          <Section title="Who's away" subtitle={`Leave, WFH and comp-off in ${periodLabel}`}>
            <div className="divide-y divide-slate-100">
              {LEAVE_LIST_ORDER.map((key) => {
                const list = leaveLists[key];
                if (!list || list.length === 0) return null;
                const meta = CATEGORY_META[key];
                return (
                  <div key={key} className="px-5 py-4">
                    <div className="mb-2.5 flex items-center gap-2">
                      <button
                        onClick={() => setModalCategory(key)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 transition hover:brightness-95 ${meta.accent}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${meta.bar}`} />
                        {meta.label}
                      </button>
                      <span className="text-[12px] text-slate-500">{list.length} {list.length === 1 ? "record" : "records"}</span>
                    </div>
                    <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                      {list.map(({ emp, day }, idx) => (
                        <li key={`${emp.emp_id}-${day.date}-${idx}`} className="flex items-center justify-between rounded-xl bg-slate-50/80 px-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-[12.5px] font-medium text-slate-900">{emp.name}</p>
                            <p className="truncate text-[11px] text-slate-500">{emp.department || "—"} · {formatShort(day.date)}</p>
                          </div>
                          {day.status_type === "half_leave" && day.leave_subtype && (
                            <span className="ml-2 shrink-0 rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-semibold text-yellow-800">
                              {day.leave_subtype.replace("half_", "1/2 ").toUpperCase()}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
              {LEAVE_LIST_ORDER.every((k) => (leaveLists[k]?.length ?? 0) === 0) && (
                <div className="px-5 py-8 text-center text-[12.5px] text-slate-500">No leave / WFH in this period.</div>
              )}
            </div>
          </Section>

          <Section
            title="Late arrivals"
            subtitle="First punch after 12:00 PM"
            badge={<span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">{lateArrivals.length}</span>}
          >
            {lateArrivals.length === 0 ? (
              <div className="px-5 py-8 text-center text-[12.5px] text-slate-500">Nobody clocked in after noon.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {lateArrivals.map(({ emp, day }, idx) => (
                  <li key={`${emp.emp_id}-${day.date}-${idx}`} className="flex items-center justify-between px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-slate-900">{emp.name}</p>
                      <p className="truncate text-[11.5px] text-slate-500">{emp.department || "—"} · {formatShort(day.date)} · ID {emp.emp_id}</p>
                    </div>
                    <div className="ml-3 shrink-0 text-right">
                      <p className="text-[13px] font-semibold text-amber-700 tabular-nums">{day.in_time}</p>
                      <p className="text-[11px] text-slate-500">first punch</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <WeeklyUnderHoursSection months={weeklyUnderHoursByMonth} totalFlags={totalWeeklyFlags} />
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

function Section({ title, subtitle, badge, children }: { title: string; subtitle?: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-slate-200/70 bg-white/90 shadow-sm">
      <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="text-[14px] font-semibold tracking-tight text-slate-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[12px] text-slate-500">{subtitle}</p>}
        </div>
        {badge}
      </div>
      {children}
    </div>
  );
}

function SummaryCard({ label, value, accent, bar, onClick }: { label: string; value: number; accent: string; bar: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl px-3.5 py-3.5 text-left ring-1 transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-900/20 ${accent}`}
    >
      <span className={`absolute left-0 top-0 h-full w-1 ${bar}`} />
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-semibold leading-none tabular-nums">{value % 1 === 0 ? value : value.toFixed(1)}</p>
    </button>
  );
}
