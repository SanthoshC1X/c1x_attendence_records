import type { ReactNode } from "react";
import type { AppPage, DashboardData, PeriodState, PeriodActions } from "../types";
import type { WsStatus } from "../hooks/useWebSocket";
import { ScrollDrumPicker } from "./ScrollDrumPicker";
import { getMonthIsoWeeks } from "../utils";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface NavItem {
  key: AppPage;
  label: string;
  shortLabel: string;
  description: string;
  icon: ReactNode;
}

const navItems: NavItem[] = [
  {
    key: "overview",
    label: "Overview",
    shortLabel: "Overview",
    description: "Team pulse and trends",
    icon: <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M3 12l2-2 7-7 7 7 2 2M5 10v10a1 1 0 001 1h3m10-11v10a1 1 0 01-1 1h-3m-6 0h6m-6 0v-4a1 1 0 011-1h2a1 1 0 011 1v4" /></svg>,
  },
  {
    key: "employees",
    label: "Employees",
    shortLabel: "Employees",
    description: "People, hours, and drilldown",
    icon: <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M17 20h5v-2a3 3 0 00-5.36-1.86M17 20H7m10 0v-2c0-.66-.13-1.28-.36-1.86M7 20H2v-2a3 3 0 015.36-1.86M7 20v-2c0-.66.13-1.28.36-1.86m0 0a5 5 0 019.28 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  },
  {
    key: "attendance",
    label: "Attendance",
    shortLabel: "Attendance",
    description: "Sortable daily attendance view",
    icon: <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 6h11M9 12h11M9 18h11M5 6h.01M5 12h.01M5 18h.01" /></svg>,
  },
  {
    key: "leave",
    label: "Leave Analysis",
    shortLabel: "Leave",
    description: "Leave distribution and patterns",
    icon: <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  },
  {
    key: "misspunch",
    label: "Miss Punch",
    shortLabel: "Miss Punch",
    description: "Punch anomalies and fixes",
    icon: <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  },
  {
    key: "reports",
    label: "Reports",
    shortLabel: "Reports",
    description: "Underperformance and exports",
    icon: <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.59a1 1 0 01.7.29l5.42 5.42a1 1 0 01.29.7V19a2 2 0 01-2 2z" /></svg>,
  },
];

const pageTitles: Record<AppPage, string> = {
  overview: "Overview",
  employees: "Employees",
  attendance: "Attendance",
  leave: "Leave Analysis",
  reports: "Reports",
  misspunch: "Miss Punch",
};

const pageDescriptions: Record<AppPage, string> = {
  overview: "Team pulse, leave trends, and anomalies.",
  employees: "Employee drilldown and comparisons.",
  attendance: "Compact attendance table and sorting.",
  leave: "Leave mix and affected employees.",
  reports: "Exports and underperformance review.",
  misspunch: "Punch anomalies that need follow-up.",
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
  activePage,
  dashboard,
  liveStatus,
  periodState,
  periodActions,
  onNavigate,
  onUploadNew,
  onLogout,
  onExport,
  children,
}: Props) {
  const { periodMode, selMonth, selYear, selWeek, customFrom, customTo } = periodState;
  const { setPeriodMode, setSelMonth, setSelYear, setSelWeek, setCustomFrom, setCustomTo } = periodActions;

  const monthIsoWeeks = getMonthIsoWeeks(selYear, selMonth);
  const clampedWeek = Math.min(selWeek, monthIsoWeeks.length || 1);
  const dateRange = (() => {
    const dates = dashboard.dates_processed;
    if (!dates.length) return "No dates loaded";
    const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    return dates.length === 1 ? fmt(dates[0]) : `${fmt(dates[0])} - ${fmt(dates[dates.length - 1])}`;
  })();
  const activeNav = navItems.find((item) => item.key === activePage);
  const liveTone =
    liveStatus === "connected"
      ? "bg-emerald-100/80 text-emerald-900 ring-1 ring-emerald-200"
      : liveStatus === "connecting"
        ? "bg-amber-100/80 text-amber-900 ring-1 ring-amber-200"
        : "bg-slate-200/70 text-slate-700 ring-1 ring-slate-300";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(247,148,29,0.16),_transparent_26%),radial-gradient(circle_at_top_right,_rgba(13,148,136,0.12),_transparent_24%),linear-gradient(180deg,_#fffaf3_0%,_#f8fafc_42%,_#eef2f7_100%)] text-slate-900">
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-20 lg:flex lg:w-72">
        <aside className="m-4 flex w-full flex-col rounded-[28px] border border-slate-200/80 bg-white/95 p-3 shadow-[0_18px_50px_rgba(15,23,42,0.07)] backdrop-blur">
          <nav className="flex-1 space-y-2 overflow-y-auto pr-1">
            {navItems.map((item) => {
              const isActive = item.key === activePage;
              return (
                <button
                  key={item.key}
                  onClick={() => onNavigate(item.key)}
                  className={`w-full rounded-2xl border px-4 py-3.5 text-left transition-all ${
                    isActive
                      ? "border-amber-200 bg-amber-50 text-slate-950 shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`rounded-xl p-2.5 ${isActive ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{item.icon}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold tracking-tight">{item.label}</p>
                      <p className={`truncate text-xs ${isActive ? "text-slate-600" : "text-slate-400"}`}>{item.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>
        </aside>
      </div>

      <div className="lg:ml-72">
        <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/70 backdrop-blur-xl">
          <div className="px-4 pb-3 pt-3 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-slate-500">
                  <span className="rounded-full bg-white/80 px-2.5 py-1 shadow-sm ring-1 ring-slate-200">Live dashboard</span>
                  <span>{activeNav?.shortLabel ?? pageTitles[activePage]}</span>
                </div>
                <div className="mt-2 flex items-end gap-3">
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-[2rem]">
                    {pageTitles[activePage]}
                  </h1>
                  <p className="hidden pb-1 text-sm text-slate-500 lg:block">
                    {pageDescriptions[activePage]}
                  </p>
                </div>
                <p className="mt-1 text-sm text-slate-600 lg:hidden">
                  {pageDescriptions[activePage]}
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[390px]">
                <div className="rounded-2xl border border-white/80 bg-white/85 p-2.5 shadow-sm shadow-slate-200/50">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Status</p>
                  <div className={`mt-1.5 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${liveTone}`}>
                    <span className={`h-2 w-2 rounded-full ${liveStatus === "connected" ? "bg-emerald-500" : liveStatus === "connecting" ? "bg-amber-500" : "bg-slate-400"}`} />
                    {liveStatus === "connected" ? "Live sync active" : liveStatus === "connecting" ? "Connecting" : "Offline"}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/80 bg-white/85 p-2.5 shadow-sm shadow-slate-200/50">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Coverage</p>
                  <p className="mt-1.5 text-sm font-semibold text-slate-900">{dateRange}</p>
                </div>
                <div className="rounded-2xl border border-white/80 bg-white/85 p-2.5 shadow-sm shadow-slate-200/50">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Quality</p>
                  <p className="mt-1.5 text-sm font-semibold text-slate-900">
                    {dashboard.errors.length > 0 ? `${dashboard.errors.length} warnings` : "Clean snapshot"}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:hidden">
              {navItems.map((item) => {
                const isActive = item.key === activePage;
                return (
                  <button
                    key={item.key}
                    onClick={() => onNavigate(item.key)}
                    className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
                      isActive ? "bg-slate-950 text-white shadow-lg shadow-slate-900/15" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-950"
                    }`}
                  >
                    {item.shortLabel}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
              <div className="rounded-[20px] border border-white/80 bg-white/85 p-2.5 shadow-sm shadow-slate-200/40">
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-900">
                    Control
                  </span>
                  <p className="text-xs text-slate-500">Switch time windows quickly.</p>
                </div>

                {(activePage === "overview" || activePage === "misspunch") ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {(["yesterday", "today", "week", "month", "year", "custom"] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setPeriodMode(mode)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition ${
                          periodMode === mode
                            ? "bg-slate-950 text-white shadow-sm"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-950"
                        }`}
                      >
                        {mode}
                      </button>
                    ))}

                    {(periodMode === "today" || periodMode === "yesterday") && (
                      <input
                        type="date"
                        value={(() => {
                          if (periodMode === "yesterday") {
                            const yesterday = new Date();
                            yesterday.setDate(yesterday.getDate() - 1);
                            return yesterday.toISOString().slice(0, 10);
                          }
                          return customFrom || new Date().toISOString().slice(0, 10);
                        })()}
                        onChange={(e) => {
                          if (periodMode === "today") setCustomFrom(e.target.value);
                        }}
                        readOnly={periodMode === "yesterday"}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none transition focus:border-slate-900"
                      />
                    )}

                    {(periodMode === "month" || periodMode === "week") && (
                      <ScrollDrumPicker
                        items={MONTH_NAMES.map((month, idx) => ({ value: idx, label: month }))}
                        value={selMonth}
                        onChange={setSelMonth}
                      />
                    )}

                    {periodMode === "week" && (
                      <ScrollDrumPicker
                        items={monthIsoWeeks.map((week) => ({
                          value: week.weekNum,
                          label: `Week ${week.weekNum}`,
                          sublabel: week.sublabel,
                        }))}
                        value={clampedWeek}
                        onChange={setSelWeek}
                      />
                    )}

                    {(periodMode === "week" || periodMode === "month" || periodMode === "year") && (
                      <ScrollDrumPicker
                        items={Array.from({ length: 26 }, (_, idx) => ({ value: 2025 + idx, label: String(2025 + idx) }))}
                        value={selYear}
                        onChange={setSelYear}
                      />
                    )}

                    {periodMode === "custom" && (
                      <>
                        <input
                          type="date"
                          value={customFrom}
                          onChange={(e) => setCustomFrom(e.target.value)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none transition focus:border-slate-900"
                        />
                        <span className="text-xs text-slate-400">to</span>
                        <input
                          type="date"
                          value={customTo}
                          onChange={(e) => setCustomTo(e.target.value)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none transition focus:border-slate-900"
                        />
                      </>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">
                    Use the navigation and page-specific filters below to move from high-level team signals into employee-level details.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={onUploadNew}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-slate-900/15 transition hover:bg-slate-800"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.9} d="M4 4v5h.58m14.84 2A8 8 0 004.58 9M20 20v-5h-.58m0 0A8 8 0 015.06 13" />
                  </svg>
                  Refresh from Sheets
                </button>
                <button
                  onClick={onExport}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-900 hover:text-slate-950"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.9} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.59a1 1 0 01.7.29l5.42 5.42a1 1 0 01.29.7V19a2 2 0 01-2 2z" />
                  </svg>
                  Export workbook
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="px-4 py-4 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
