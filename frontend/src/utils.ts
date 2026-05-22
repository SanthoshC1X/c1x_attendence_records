import type { DailyEntry, WeekDay, PeriodState } from "./types";

// ── Date formatting ─────────────────────────────────────────────────────────

export function formatDate(dateStr: string): string {
  const dt = new Date(`${dateStr}T00:00:00`);
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateShort(dateStr: string): string {
  const dt = new Date(`${dateStr}T00:00:00`);
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

// ── Status display ──────────────────────────────────────────────────────────

export function getStatusLabel(entry: Pick<DailyEntry | WeekDay, "status" | "status_type" | "leave_subtype">): string {
  if (entry.status_type === "leave" && entry.leave_subtype)
    return entry.leave_subtype.toUpperCase();
  if (entry.status_type === "half_leave" && entry.leave_subtype) {
    const halfLabels: Record<string, string> = { half_cl: "Half CL", half_sl: "Half SL", half_wfh: "Half WFH", half_pl: "Half PL", half_comp: "Half Comp Off" };
    return halfLabels[entry.leave_subtype] || entry.leave_subtype;
  }
  return entry.status;
}

export const statusStyles: Record<string, string> = {
  present:        "bg-emerald-50 text-emerald-700",
  weekend_worked: "bg-amber-50 text-amber-700",
  wfh:            "bg-teal-50 text-teal-700",
  leave:          "bg-blue-50 text-blue-700",
  half_leave:     "bg-yellow-50 text-yellow-700",
  comp_off:       "bg-violet-50 text-violet-700",
  holiday:        "bg-gray-50 text-gray-500",
  absent:         "bg-red-50 text-red-700",
  lwd:            "bg-indigo-50 text-indigo-700",
  default:        "bg-gray-50 text-gray-500",
};

// ── Period options ──────────────────────────────────────────────────────────

export const periodOptions = [
  { key: "today", label: "Today" },
  { key: "week",  label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "year",  label: "This Year" },
  { key: "all",   label: "All Data" },
];

// ── ISO week boundaries (Mon–Sun) clipped to a calendar month ───────────────
// Mirrors the backend analytics.py week splitting (isocalendar-based).

export interface MonthWeek {
  weekNum: number;   // sequential 1-based index within the month
  start: Date;       // first day of this week that falls in the month
  end: Date;         // last day of this week that falls in the month
  sublabel: string;  // e.g. "1 Feb", "2–8 Feb"
}

export function getMonthIsoWeeks(year: number, month: number): MonthWeek[] {
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth  = new Date(year, month + 1, 0);

  const weeks: MonthWeek[] = [];
  let cursor = new Date(firstOfMonth);
  let weekNum = 1;

  while (cursor <= lastOfMonth) {
    // Find the Monday of the ISO week containing cursor
    const dow = cursor.getDay(); // 0=Sun … 6=Sat
    const daysToMon = dow === 0 ? -6 : 1 - dow;
    const weekMon = new Date(cursor);
    weekMon.setDate(cursor.getDate() + daysToMon);

    // The Sunday ending this ISO week
    const weekSun = new Date(weekMon);
    weekSun.setDate(weekMon.getDate() + 6);

    // Clip to month boundaries
    const start = weekMon < firstOfMonth ? new Date(firstOfMonth) : new Date(weekMon);
    const end   = weekSun > lastOfMonth  ? new Date(lastOfMonth)  : new Date(weekSun);

    // Build compact sublabel
    const d1 = start.getDate();
    const d2 = end.getDate();
    const mo  = start.toLocaleDateString("en-GB", { month: "short" });
    const sublabel = d1 === d2 ? `${d1} ${mo}` : `${d1}–${d2} ${mo}`;

    weeks.push({ weekNum, start, end, sublabel });
    weekNum++;

    // Advance cursor to the day after this ISO week's Sunday
    cursor = new Date(weekSun);
    cursor.setDate(weekSun.getDate() + 1);
  }

  return weeks;
}

// ── Period filtering ────────────────────────────────────────────────────────

const MONTH_NAMES_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function yesterdayIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dateInPeriod(dateStr: string, period: PeriodState): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(d.getTime())) return false;

  switch (period.periodMode) {
    case "today":     return dateStr === todayIso();
    case "yesterday": return dateStr === yesterdayIso();
    case "date":      return !!period.selDate && dateStr === period.selDate;
    case "month":     return d.getFullYear() === period.selYear && d.getMonth() === period.selMonth;
  }
}

function fmtFullDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function describePeriod(period: PeriodState): string {
  switch (period.periodMode) {
    case "today":     return `Today · ${fmtFullDate(todayIso())}`;
    case "yesterday": return `Yesterday · ${fmtFullDate(yesterdayIso())}`;
    case "date":      return period.selDate ? fmtFullDate(period.selDate) : "Pick a date";
    case "month":     return `${MONTH_NAMES_FULL[period.selMonth]} ${period.selYear}`;
  }
}

// ── Avatar color ─────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-indigo-500", "bg-violet-500", "bg-blue-500", "bg-emerald-500",
  "bg-teal-500", "bg-sky-500", "bg-rose-500", "bg-orange-500",
];

export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── FormData builder ─────────────────────────────────────────────────────────

export function buildFormData(attendanceFile: File | null, leaveFile: File | null): FormData {
  const fd = new FormData();
  if (attendanceFile) fd.append("attendance_file", attendanceFile);
  if (leaveFile) fd.append("leave_file", leaveFile);
  return fd;
}
