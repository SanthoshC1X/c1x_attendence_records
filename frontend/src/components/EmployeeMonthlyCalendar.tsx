import { useEffect, useMemo, useState } from "react";
import type { EmployeeDashboard, DailyEntry } from "../types";

interface Props {
  employee: EmployeeDashboard | null;
  onClose: () => void;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface CellMeta {
  date: Date;
  inMonth: boolean;
  iso: string;
  isWeekend: boolean;
  isFuture: boolean;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function buildMonthGrid(year: number, month: number): CellMeta[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDow = first.getDay();
  const today = startOfToday();
  const cells: CellMeta[] = [];

  const mk = (d: Date, inMonth: boolean): CellMeta => ({
    date: d,
    inMonth,
    iso: toIso(d),
    isWeekend: d.getDay() === 0 || d.getDay() === 6,
    isFuture: d.getTime() > today.getTime(),
  });

  for (let i = startDow; i > 0; i--) cells.push(mk(new Date(year, month, 1 - i), false));
  for (let d = 1; d <= last.getDate(); d++) cells.push(mk(new Date(year, month, d), true));
  while (cells.length < 42) {
    const prev = cells[cells.length - 1].date;
    const dt = new Date(prev);
    dt.setDate(prev.getDate() + 1);
    cells.push(mk(dt, false));
  }
  return cells;
}

function formatHours(entry: DailyEntry): string | null {
  if (!entry.total_hhmm) return null;
  const [hStr, mStr] = entry.total_hhmm.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (Number.isNaN(h)) return null;
  if (h === 0 && (Number.isNaN(m) || m === 0)) return null;
  if (!m || m === 0) return `${h}h`;
  return `${h}h ${pad(m)}m`;
}

type ClassKey =
  | "wfh" | "cl" | "sl" | "pl"
  | "comp" | "lwd" | "leave-other" | "holiday"
  | "present" | "absent" | "weekend" | "future";

/**
 * Priority-ordered classifier:
 *   1. WFH  →  2. CL  →  3. SL  →  4. PL  →  5. Other leave types  →  6. Absent (fallback)
 * Present (with real hours) is its own bucket; weekends/holidays/future stay muted.
 */
function classify(entry: DailyEntry | undefined, cell: CellMeta): { key: ClassKey; label: string; weight: number } {
  if (!entry) {
    if (cell.isFuture) return { key: "future", label: "", weight: 0 };
    if (cell.isWeekend) return { key: "weekend", label: "", weight: 0 };
    // No record for a past working day -> Absent fallback.
    return { key: "absent", label: "Absent", weight: 1 };
  }

  const subtype = (entry.leave_subtype || "").toLowerCase();
  const st = entry.status_type;

  if (st === "wfh")             return { key: "wfh", label: "WFH",       weight: 1 };
  if (subtype === "half_wfh")   return { key: "wfh", label: "Half WFH",  weight: 0.5 };
  if (subtype === "cl")         return { key: "cl",  label: "Casual Leave", weight: 1 };
  if (subtype === "half_cl")    return { key: "cl",  label: "Half CL",   weight: 0.5 };
  if (subtype === "sl")         return { key: "sl",  label: "Sick Leave",   weight: 1 };
  if (subtype === "half_sl")    return { key: "sl",  label: "Half SL",   weight: 0.5 };
  if (subtype === "pl")         return { key: "pl",  label: "Paid Leave",   weight: 1 };
  if (subtype === "half_pl")    return { key: "pl",  label: "Half PL",   weight: 0.5 };
  if (st === "comp_off")        return { key: "comp", label: "Comp Off", weight: 1 };
  if (subtype === "half_comp")  return { key: "comp", label: "Half Comp", weight: 0.5 };
  if (st === "lwd")             return { key: "lwd", label: "LWD",       weight: 1 };
  if (st === "leave")           return { key: "leave-other", label: "Leave", weight: 1 };
  if (st === "holiday")         return { key: "holiday", label: "Holiday", weight: 0 };

  if (st === "present" || st === "weekend_worked") {
    const hrs = formatHours(entry);
    if (hrs) return { key: "present", label: hrs, weight: 0 };
    // Marked present but no real hours → treat as Absent per spec.
    return { key: "absent", label: "Absent", weight: 1 };
  }

  if (st === "absent") return { key: "absent", label: "Absent", weight: 1 };
  return { key: "absent", label: "Absent", weight: 1 };
}

const TONE_STYLES: Record<ClassKey, { bg: string; text: string; dot: string }> = {
  wfh:           { bg: "bg-teal-50/70",     text: "text-teal-700",     dot: "bg-teal-400" },
  cl:            { bg: "bg-blue-50/70",     text: "text-blue-700",     dot: "bg-blue-400" },
  sl:            { bg: "bg-rose-50/70",     text: "text-rose-700",     dot: "bg-rose-400" },
  pl:            { bg: "bg-violet-50/70",   text: "text-violet-700",   dot: "bg-violet-400" },
  comp:          { bg: "bg-orange-50/70",   text: "text-orange-700",   dot: "bg-orange-400" },
  lwd:           { bg: "bg-indigo-50/70",   text: "text-indigo-700",   dot: "bg-indigo-400" },
  "leave-other": { bg: "bg-indigo-50/70",   text: "text-indigo-700",   dot: "bg-indigo-400" },
  holiday:       { bg: "bg-slate-50",       text: "text-slate-400",    dot: "bg-slate-300" },
  present:       { bg: "bg-emerald-50/60",  text: "text-emerald-700",  dot: "bg-emerald-400" },
  absent:        { bg: "bg-red-50/70",      text: "text-red-600",      dot: "bg-red-400" },
  weekend:       { bg: "bg-slate-50/40",    text: "text-slate-300",    dot: "bg-slate-200" },
  future:        { bg: "bg-white",          text: "text-slate-300",    dot: "bg-slate-200" },
};

export default function EmployeeMonthlyCalendar({ employee, onClose }: Props) {
  const [visible, setVisible] = useState(false);

  const initialMonth = useMemo(() => {
    const lastDate = employee?.daily?.[employee.daily.length - 1]?.date;
    if (lastDate) {
      const d = new Date(`${lastDate}T00:00:00`);
      return { year: d.getFullYear(), month: d.getMonth() };
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  }, [employee]);

  const [view, setView] = useState(initialMonth);

  useEffect(() => {
    if (employee) {
      setView(initialMonth);
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [employee, initialMonth]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const entriesByDate = useMemo(() => {
    const map = new Map<string, DailyEntry>();
    employee?.daily.forEach((d) => map.set(d.date, d));
    return map;
  }, [employee]);

  const grid = useMemo(() => buildMonthGrid(view.year, view.month), [view]);

  // Per-bucket totals for the displayed month, computed via the same priority classifier.
  const totals = useMemo(() => {
    const t = { absent: 0, wfh: 0, cl: 0, sl: 0, pl: 0 };
    for (const cell of grid) {
      if (!cell.inMonth) continue;
      const entry = entriesByDate.get(cell.iso);
      const c = classify(entry, cell);
      if (c.key === "wfh") t.wfh += c.weight;
      else if (c.key === "cl") t.cl += c.weight;
      else if (c.key === "sl") t.sl += c.weight;
      else if (c.key === "pl") t.pl += c.weight;
      else if (c.key === "absent") t.absent += c.weight;
    }
    return t;
  }, [grid, entriesByDate]);

  if (!employee) return null;

  const goPrev = () => setView((v) => v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 });
  const goNext = () => setView((v) => v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 });

  const fmtCount = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

  const chips: { label: string; value: number; dot: string }[] = [
    { label: "Absent", value: totals.absent, dot: "bg-red-400" },
    { label: "WFH",    value: totals.wfh,    dot: "bg-teal-400" },
    { label: "CL",     value: totals.cl,     dot: "bg-blue-400" },
    { label: "SL",     value: totals.sl,     dot: "bg-rose-400" },
    { label: "PL",     value: totals.pl,     dot: "bg-violet-400" },
  ];

  return (
    <div
      className={`fixed inset-0 z-50 overflow-y-auto transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
      style={{
        background:
          "radial-gradient(1200px 600px at 20% -10%, rgba(216,180,254,0.35), transparent 60%)," +
          "radial-gradient(900px 500px at 100% 10%, rgba(186,230,253,0.35), transparent 60%)," +
          "linear-gradient(180deg, #fbfaff 0%, #f5f3ff 50%, #eef2ff 100%)",
      }}
    >
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 sm:px-6 sm:py-7">
        {/* Close */}
        <div className="flex items-center justify-end">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/70 bg-white/80 px-3 py-1 text-[11.5px] font-medium text-slate-600 shadow-sm backdrop-blur transition hover:bg-white hover:text-slate-900"
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Close
          </button>
        </div>

        {/* Header — centered employee identity */}
        <div className="mt-1 text-center">
          <h1 className="bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 bg-clip-text text-[26px] font-semibold tracking-tight text-transparent sm:text-[32px]">
            {employee.name}
          </h1>
          <p className="mt-0.5 text-[12px] font-medium text-slate-500">
            ID · <span className="text-slate-700">{employee.emp_id}</span>
            <span className="mx-1.5 text-slate-300">|</span>
            <span className="text-slate-700">{MONTH_NAMES[view.month]} {view.year}</span>
          </p>

          {/* 5-chip summary */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
            {chips.map((c) => (
              <div key={c.label} className="flex items-center gap-1.5 rounded-full border border-white/80 bg-white/80 px-2.5 py-1 shadow-sm shadow-slate-200/60 backdrop-blur">
                <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
                <span className="text-[10.5px] uppercase tracking-[0.16em] text-slate-400">{c.label}</span>
                <span className="text-[13px] font-semibold tabular-nums text-slate-900">{fmtCount(c.value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Calendar card */}
        <div className="mt-4 rounded-[20px] border border-white/80 bg-white/90 p-3 shadow-[0_24px_60px_-30px_rgba(76,29,149,0.22)] backdrop-blur sm:p-4">
          {/* Calendar header */}
          <div className="flex items-center justify-between">
            <p className="text-[20px] font-semibold uppercase tracking-tight text-slate-900 sm:text-[22px]">
              {MONTH_NAMES[view.month]}
            </p>
            <div className="flex items-center gap-1.5">
              <button onClick={goPrev} aria-label="Previous month" className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <p className="min-w-[48px] text-center text-[11.5px] font-medium tracking-[0.16em] text-slate-500">· {view.year} ·</p>
              <button onClick={goNext} aria-label="Next month" className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Day-of-week header */}
          <div className="mt-2.5 grid grid-cols-7 border-b border-slate-100 pb-1.5">
            {WEEKDAY_LABELS.map((lbl, i) => (
              <div key={lbl} className={`text-[10.5px] font-medium ${i === 0 || i === 6 ? "text-rose-400" : "text-slate-500"}`}>{lbl}</div>
            ))}
          </div>

          {/* Day grid */}
          <div className="mt-1.5 grid grid-cols-7 gap-px overflow-hidden rounded-xl bg-slate-100/70">
            {grid.map((cell, idx) => {
              const entry = entriesByDate.get(cell.iso);
              const c = classify(entry, cell);
              const tone = TONE_STYLES[c.key];
              const showBadge = cell.inMonth && c.label !== "";

              return (
                <div
                  key={`${cell.iso}-${idx}`}
                  className={`relative flex h-[60px] flex-col justify-between p-1.5 sm:h-[68px] ${cell.inMonth ? "bg-white" : "bg-slate-50/50"}`}
                >
                  <span
                    className={`text-[10.5px] font-medium tabular-nums ${
                      cell.inMonth
                        ? cell.isWeekend ? "text-rose-400" : "text-slate-700"
                        : "text-slate-300"
                    }`}
                  >
                    {cell.date.getDate()}
                  </span>

                  {showBadge && (
                    <div className={`inline-flex w-fit items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-none ${tone.bg} ${tone.text}`}>
                      {c.key !== "present" && <span className={`h-1 w-1 shrink-0 rounded-full ${tone.dot}`} />}
                      <span className="truncate">{c.label}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-slate-500">
            <LegendDot color="bg-emerald-400" label="Present" />
            <LegendDot color="bg-teal-400" label="WFH" />
            <LegendDot color="bg-blue-400" label="Casual Leave" />
            <LegendDot color="bg-rose-400" label="Sick Leave" />
            <LegendDot color="bg-violet-400" label="Paid Leave" />
            <LegendDot color="bg-orange-400" label="Comp Off" />
            <LegendDot color="bg-red-400" label="Absent" />
          </div>
        </div>
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}
