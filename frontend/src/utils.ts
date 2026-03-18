import type { DailyEntry, WeekDay } from "./types";

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
  if (entry.status_type === "half_leave" && entry.leave_subtype)
    return entry.leave_subtype === "half_cl" ? "Half CL" : "Half SL";
  return entry.status;
}

export const statusStyles: Record<string, string> = {
  present:        "border-emerald-200 bg-emerald-100 text-emerald-800",
  weekend_worked: "border-amber-200 bg-amber-100 text-amber-800",
  wfh:            "border-teal-200 bg-teal-100 text-teal-800",
  leave:          "border-rose-200 bg-rose-100 text-rose-800",
  half_leave:     "border-yellow-200 bg-yellow-100 text-yellow-800",
  comp_off:       "border-orange-200 bg-orange-100 text-orange-800",
  holiday:        "border-slate-200 bg-slate-100 text-slate-600",
  absent:         "border-red-200 bg-red-100 text-red-800",
  lwd:            "border-indigo-200 bg-indigo-100 text-indigo-800",
  default:        "border-slate-200 bg-slate-100 text-slate-600",
};

// ── Leave filter config ─────────────────────────────────────────────────────

export const leaveFilterConfig = [
  { key: "wfh",        label: "WFH",      fullLabel: "Work From Home",    chip: "border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100",     active: "bg-teal-600 text-white border-teal-600",   dot: "bg-teal-500" },
  { key: "cl",         label: "CL",       fullLabel: "Casual Leave",      chip: "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100",     active: "bg-blue-600 text-white border-blue-600",   dot: "bg-blue-500" },
  { key: "sl",         label: "SL",       fullLabel: "Sick Leave",        chip: "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100",     active: "bg-rose-600 text-white border-rose-600",   dot: "bg-rose-500" },
  { key: "pl",         label: "PL",       fullLabel: "Privilege Leave",   chip: "border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100", active: "bg-purple-600 text-white border-purple-600", dot: "bg-purple-500" },
  { key: "comp_off",   label: "Comp Off", fullLabel: "Compensatory Off",  chip: "border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100", active: "bg-orange-500 text-white border-orange-500", dot: "bg-orange-500" },
  { key: "half_leave", label: "Half Day", fullLabel: "Half Day Leave",    chip: "border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100", active: "bg-yellow-500 text-white border-yellow-500", dot: "bg-yellow-500" },
  { key: "absent",     label: "Absent",   fullLabel: "Absent",            chip: "border-red-300 bg-red-50 text-red-700 hover:bg-red-100",         active: "bg-red-600 text-white border-red-600",     dot: "bg-red-500" },
];

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
