import type { ReactNode } from "react";
import type { AppPage, DashboardData, PeriodState, PeriodActions } from "../types";
import type { WsStatus } from "../hooks/useWebSocket";
import { ScrollDrumPicker } from "./ScrollDrumPicker";
import { getMonthIsoWeeks } from "../utils";

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

interface NavItem { key: AppPage; label: string; icon: ReactNode; }

const navItems: NavItem[] = [
  { key: "overview",   label: "Overview",      icon: <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg> },
  { key: "employees",  label: "Employees",     icon: <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
  { key: "leave",      label: "Leave Analysis",icon: <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
  { key: "misspunch",  label: "Miss Punch",    icon: <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg> },
];

const pageTitles: Record<AppPage, string> = {
  overview: "Overview", employees: "Employees", attendance: "Attendance",
  leave: "Leave Analysis", reports: "Reports", misspunch: "Miss Punch",
};

interface Props {
  activePage: AppPage;
  activePeriod: string;
  dashboard: DashboardData;
  liveStatus: WsStatus;
  periodState: PeriodState;
  periodActions: PeriodActions;
  availableYears: number[];
  onNavigate: (page: AppPage) => void;
  onPeriodChange: (period: string) => void;
  onUploadNew: () => void;
  onLogout: () => void;
  onExport: () => void;
  children: ReactNode;
}

export default function AppShell({
  activePage, dashboard, liveStatus,
  periodState, periodActions,
  onNavigate, onUploadNew, onLogout, onExport,
  children,
}: Props) {
  const { periodMode, selMonth, selYear, selWeek, customFrom, customTo } = periodState;
  const { setPeriodMode, setSelMonth, setSelYear, setSelWeek, setCustomFrom, setCustomTo } = periodActions;

  const monthIsoWeeks = getMonthIsoWeeks(selYear, selMonth);
  const clampedWeek   = Math.min(selWeek, monthIsoWeeks.length);
  const dateRange = (() => {
    const dates = dashboard.dates_processed;
    if (!dates.length) return "";
    const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    return dates.length === 1 ? fmt(dates[0]) : `${fmt(dates[0])} – ${fmt(dates[dates.length - 1])}`;
  })();

  return (
    <div className="flex min-h-screen bg-slate-50">

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 flex flex-col z-20 shadow-sm">

        {/* Brand */}
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0 shadow-sm">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p className="text-gray-900 font-bold text-sm leading-tight tracking-tight">C1X</p>
              <p className="text-gray-400 text-xs">Attendance Platform</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = activePage === item.key;
            return (
              <button
                key={item.key}
                onClick={() => onNavigate(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm"
                    : "text-gray-500 hover:text-gray-800 hover:bg-gray-100 border border-transparent"
                }`}
              >
                <span className={isActive ? "text-indigo-600" : "text-gray-400"}>{item.icon}</span>
                {item.label}
                {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500" />}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-gray-100 space-y-2.5">
          {/* Info row */}
          <div className="px-1 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-700">{dashboard.employee_count} employees</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{dateRange}</p>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-indigo-50 text-indigo-600 border-indigo-200">
              ADMIN
            </span>
          </div>

          {/* Action button */}
          <button
            onClick={onUploadNew}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-800 text-xs font-medium transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Change Excel Paths
          </button>

          {/* Sign out */}
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 text-xs font-medium transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────────── */}
      <div className="ml-64 flex-1 flex flex-col min-h-screen">

        {/* Top header */}
        <header className="sticky top-0 bg-white border-b border-gray-200 z-10 shadow-sm">
          {/* Row 1: title + live + export */}
          <div className="flex items-center justify-between px-8 pt-3 pb-2">
            <div>
              <h1 className="text-base font-bold text-gray-900">{pageTitles[activePage]}</h1>
              <p className="text-[11px] text-gray-400 mt-0.5">{dateRange}</p>
            </div>
            <div className="flex items-center gap-2.5">
              {/* Live indicator */}
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${
                liveStatus === "connected"  ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
                liveStatus === "connecting" ? "bg-amber-50 border-amber-200 text-amber-700" :
                "bg-gray-100 border-gray-200 text-gray-400"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  liveStatus === "connected"  ? "bg-emerald-500 animate-pulse" :
                  liveStatus === "connecting" ? "bg-amber-400 animate-pulse" :
                  "bg-gray-400"
                }`} />
                {liveStatus === "connected" ? "Live" : liveStatus === "connecting" ? "Connecting…" : "Offline"}
              </div>
              {/* Export */}
              <button
                onClick={onExport}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export
              </button>
            </div>
          </div>

          {/* Row 2: period filter (overview page only) */}
          {(activePage === "overview" || activePage === "misspunch") && (
            <div className="flex items-center gap-2 flex-wrap px-8 pb-2.5">

              {/* Mode pills */}
              {(["yesterday","today","week","month","year","custom"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setPeriodMode(mode)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all capitalize ${
                    periodMode === mode
                      ? "bg-gray-900 text-white border-gray-900 shadow-sm"
                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700"
                  }`}
                >
                  {mode}
                </button>
              ))}

              <span className="w-px h-4 bg-gray-200" />

              {/* Today / Yesterday: date override */}
              {(periodMode === "today" || periodMode === "yesterday") && (
                <input
                  type="date"
                  value={(() => {
                    if (periodMode === "yesterday") {
                      const y = new Date(); y.setDate(y.getDate() - 1);
                      return y.toISOString().slice(0, 10);
                    }
                    return customFrom || new Date().toISOString().slice(0, 10);
                  })()}
                  onChange={(e) => { if (periodMode === "today") setCustomFrom(e.target.value); }}
                  readOnly={periodMode === "yesterday"}
                  className="text-xs border border-gray-200 rounded-xl px-3 py-1.5 font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400/40 cursor-pointer shadow-sm"
                />
              )}

              {/* Month drum */}
              {(periodMode === "month" || periodMode === "week") && (
                <ScrollDrumPicker
                  items={MONTH_NAMES.map((m, i) => ({ value: i, label: m }))}
                  value={selMonth}
                  onChange={setSelMonth}
                />
              )}

              {/* Week drum — ISO week boundaries matching progress bar */}
              {periodMode === "week" && (
                <ScrollDrumPicker
                  items={monthIsoWeeks.map(w => ({
                    value: w.weekNum,
                    label: `Week ${w.weekNum}`,
                    sublabel: w.sublabel,
                  }))}
                  value={clampedWeek}
                  onChange={setSelWeek}
                />
              )}

              {/* Year drum — fixed range 2025–2050 */}
              {(periodMode === "week" || periodMode === "month" || periodMode === "year") && (
                <ScrollDrumPicker
                  items={Array.from({ length: 26 }, (_, i) => ({ value: 2025 + i, label: String(2025 + i) }))}
                  value={selYear}
                  onChange={setSelYear}
                />
              )}

              {/* Custom: date range */}
              {periodMode === "custom" && (
                <>
                  <input
                    type="date" value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="text-xs border border-gray-200 rounded-xl px-3 py-1.5 font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400/40 cursor-pointer shadow-sm"
                  />
                  <span className="text-xs text-gray-400 font-bold">→</span>
                  <input
                    type="date" value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="text-xs border border-gray-200 rounded-xl px-3 py-1.5 font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400/40 cursor-pointer shadow-sm"
                  />
                </>
              )}

              {/* Active period label */}
              <span className="ml-auto text-[11px] font-medium text-indigo-600">
                {periodMode === "yesterday"
                  ? (() => { const y = new Date(); y.setDate(y.getDate() - 1); return y.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); })()
                  : periodMode === "today"
                  ? (customFrom ? new Date(customFrom + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }))
                  : periodMode === "year"  ? `Year ${selYear}`
                  : periodMode === "month" ? `${MONTH_NAMES[selMonth]} ${selYear}`
                  : periodMode === "week"  ? `Week ${clampedWeek} · ${MONTH_NAMES[selMonth]} ${selYear}`
                  : periodMode === "custom" && (customFrom || customTo) ? `${customFrom || "…"} → ${customTo || "…"}`
                  : "Custom range"
                }
              </span>
            </div>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 p-7">
          {children}
        </main>
      </div>
    </div>
  );
}
