import { useState, useMemo, useRef, useCallback } from "react";

/* ── Interfaces ──────────────────────────────────────────────────────────── */

interface WeeklyUnderEmployee {
  emp: { emp_id: string; name: string; department?: string };
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

interface Props {
  months: WeeklyUnderMonthCard[];
  totalFlags: number;
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function fmtHours(minutes: number): string {
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  return `${hh}h ${String(mm).padStart(2, "0")}m`;
}

/* ── Main Component ──────────────────────────────────────────────────────── */

export default function WeeklyUnderHoursSection({ months, totalFlags }: Props) {
  const allEmpty = months.every((m) => m.flaggedCount === 0);

  return (
    <div className="overflow-hidden rounded-[24px] border border-slate-200/70 bg-white/90 shadow-sm">
      {/* Section Header */}
      <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="text-[14px] font-semibold tracking-tight text-slate-900">
            Weekly under 45 hours
          </h3>
          <p className="mt-0.5 text-[12px] text-slate-500">
            Monthly cards split by ISO week slices. Cross-month weeks are prorated to the visible tracked weekdays in each month.
          </p>
        </div>
        <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-800 ring-1 ring-rose-200">
          {totalFlags}
        </span>
      </div>

      {allEmpty ? (
        <div className="px-5 py-8 text-center text-[12.5px] text-slate-500">
          Nobody is below the weekly target in the available month slices.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-2">
          {months.map((month) => (
            <MonthSection key={month.key} month={month} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── MonthSection ────────────────────────────────────────────────────────── */

function MonthSection({ month }: { month: WeeklyUnderMonthCard }) {
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);

  const toggle = useCallback(
    (weekKey: string) => {
      setExpandedWeek((prev) => (prev === weekKey ? null : weekKey));
    },
    []
  );

  return (
    <div className="overflow-hidden rounded-[20px] border border-slate-200/70 bg-slate-50/60">
      {/* Sticky month header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200/70 bg-white/95 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <h4 className="text-[15px] font-semibold tracking-tight text-slate-900">
            {month.title}
          </h4>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10.5px] font-medium text-slate-600">
            {month.weeks.length} {month.weeks.length === 1 ? "Week" : "Weeks"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500">{month.throughLabel}</span>
          <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-200">
            {month.flaggedCount} flags
          </span>
        </div>
      </div>

      {/* Week accordions */}
      <div className="divide-y divide-slate-200/70">
        {month.weeks.map((week) => (
          <WeekAccordion
            key={week.key}
            week={week}
            isOpen={expandedWeek === week.key}
            onToggle={() => toggle(week.key)}
          />
        ))}
      </div>
    </div>
  );
}

/* ── WeekAccordion ───────────────────────────────────────────────────────── */

function WeekAccordion({
  week,
  isOpen,
  onToggle,
}: {
  week: WeeklyUnderSection;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const hasFlags = week.employees.length > 0;

  return (
    <div className="bg-white/70">
      {/* Accordion header */}
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-slate-50/80"
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Expand/collapse icon */}
          <svg
            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${
              isOpen ? "rotate-90" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>

          <div className="min-w-0">
            <p className="text-[12.5px] font-semibold text-slate-900">{week.weekLabel}</p>
            <p className="text-[10.5px] text-slate-500 truncate">
              {week.sliceLabel} · Target: {fmtHours(week.expectedMinutes)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-2">
          {hasFlags && (
            <span className="text-[10.5px] text-slate-500">
              {week.employees.length} {week.employees.length === 1 ? "employee" : "employees"}
            </span>
          )}
          <span
            className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1 ${
              hasFlags
                ? "bg-rose-50 text-rose-700 ring-rose-200"
                : "bg-emerald-50 text-emerald-700 ring-emerald-200"
            }`}
          >
            {hasFlags ? `${week.employees.length} below target` : "Met target"}
          </span>
        </div>
      </button>

      {/* Collapsible content */}
      <div
        ref={contentRef}
        className="overflow-hidden"
        style={{
          maxHeight: isOpen ? `${(contentRef.current?.scrollHeight ?? 1000) + 50}px` : "0px",
          opacity: isOpen ? 1 : 0,
          transition: "max-height 250ms ease-in-out, opacity 200ms ease-in-out",
        }}
      >
        {hasFlags ? (
          <ExpandedWeekContent week={week} />
        ) : (
          <div className="px-4 pb-3 text-[11.5px] text-slate-500">
            Everyone in this week slice met the prorated target.
          </div>
        )}
      </div>
    </div>
  );
}

/* ── ExpandedWeekContent (search + employee list) ────────────────────────── */

function ExpandedWeekContent({ week }: { week: WeeklyUnderSection }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return week.employees;
    const q = search.toLowerCase().trim();
    return week.employees.filter(
      (item) =>
        item.emp.name.toLowerCase().includes(q) ||
        item.emp.emp_id.toLowerCase().includes(q)
    );
  }, [week.employees, search]);

  return (
    <div className="border-t border-slate-100">
      {/* Search bar */}
      <div className="px-4 pt-2.5 pb-1.5">
        <div className="relative">
          <svg
            className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employee in this week..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50/80 py-1.5 pl-8 pr-3 text-[12px] text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Employee list */}
      {filtered.length === 0 ? (
        <div className="px-4 py-3 text-center text-[11.5px] text-slate-500">
          No matching employees.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {filtered.map((item) => (
            <EmployeeRow key={`${week.key}-${item.emp.emp_id}`} item={item} />
          ))}
        </ul>
      )}

      {/* Result count when searching */}
      {search.trim() && filtered.length > 0 && (
        <div className="px-4 pb-2 text-[10.5px] text-slate-400">
          Showing {filtered.length} of {week.employees.length}
        </div>
      )}
    </div>
  );
}

/* ── EmployeeRow ─────────────────────────────────────────────────────────── */

function EmployeeRow({ item }: { item: WeeklyUnderEmployee }) {
  return (
    <li className="flex items-center justify-between px-4 py-2">
      <div className="min-w-0">
        <p className="truncate text-[12.5px] font-medium text-slate-900">
          {item.emp.name}
        </p>
        <p className="truncate text-[11px] text-slate-500">
          {item.emp.department || "—"} · ID {item.emp.emp_id} · tracked{" "}
          {item.trackedWeekdays} weekday
          {item.trackedWeekdays === 1 ? "" : "s"}
        </p>
      </div>
      <div className="ml-3 shrink-0 text-right">
        <p className="text-[12.5px] font-semibold text-rose-700 tabular-nums">
          {fmtHours(item.actualMinutes)} / {fmtHours(item.expectedMinutes)}
        </p>
        <p className="text-[10.5px] text-slate-500">
          short by {fmtHours(item.deficitMinutes)}
        </p>
      </div>
    </li>
  );
}
