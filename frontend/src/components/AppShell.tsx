import type { ReactNode } from "react";
import type { AppPage, DashboardData, PeriodState, PeriodActions } from "../types";
import type { WsStatus } from "../hooks/useWebSocket";
import PeriodSelector from "./PeriodSelector";
import OverviewFooter from "./OverviewFooter";

interface NavItem {
  key: AppPage;
  label: string;
  shortLabel: string;
  description: string;
  icon: ReactNode;
}

const navItems: NavItem[] = [
  {
    key: "ceo",
    label: "CEO Report",
    shortLabel: "CEO",
    description: "Daily snapshot for leadership",
    icon: <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M3 17l6-6 4 4 8-8M14 7h7v7" /></svg>,
  },
  {
    key: "employees",
    label: "Employees",
    shortLabel: "Employees",
    description: "People and monthly attendance",
    icon: <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M17 20h5v-2a3 3 0 00-5.36-1.86M17 20H7m10 0v-2c0-.66-.13-1.28-.36-1.86M7 20H2v-2a3 3 0 015.36-1.86M7 20v-2c0-.66.13-1.28.36-1.86m0 0a5 5 0 019.28 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  },
  {
    key: "misspunch",
    label: "Miss Punch",
    shortLabel: "Miss Punch",
    description: "Punch anomalies and fixes",
    icon: <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  },
];

const pageTitles: Record<AppPage, string> = {
  ceo: "CEO Report",
  employees: "Employees",
  misspunch: "Miss Punch",
};

const pageDescriptions: Record<AppPage, string> = {
  ceo: "Daily snapshot, leave roster, late arrivals and short days.",
  employees: "Browse people and open monthly attendance calendars.",
  misspunch: "Missing-punch incidents that need follow-up.",
};

interface Props {
  activePage: AppPage;
  dashboard: DashboardData;
  liveStatus: WsStatus;
  periodState: PeriodState;
  periodActions: PeriodActions;
  availableYears: number[];
  onNavigate: (page: AppPage) => void;
  onUploadNew: () => void;
  onLogout: () => void;
  onExport: () => void;
  onExportEmployeeSummary: () => void;
  onExportLeaveSummary: () => void;
  children: ReactNode;
}

function todayLabel(): string {
  return new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function AppShell({
  activePage,
  dashboard,
  liveStatus,
  periodState,
  periodActions,
  availableYears,
  onNavigate,
  onUploadNew,
  onLogout,
  onExport,
  onExportEmployeeSummary,
  onExportLeaveSummary,
  children,
}: Props) {
  const liveTone =
    liveStatus === "connected"
      ? "bg-lime-300 text-lime-950"
      : liveStatus === "connecting"
        ? "bg-amber-200 text-amber-900"
        : "bg-slate-200 text-slate-600";

  return (
    <div className="min-h-screen bg-[#e7e8ec] p-4 text-slate-900">
      <div className="mx-auto flex max-w-[1500px] gap-4">
        {/* Sidebar */}
        <div className="hidden lg:flex lg:w-64 lg:shrink-0">
          <aside className="flex w-full flex-col rounded-[28px] bg-white p-4 shadow-[0_10px_40px_-12px_rgba(15,23,42,0.08)]">
            <div className="flex items-center gap-2 px-2 pb-6 pt-1">
              <span className="text-[18px] font-black text-slate-950">%</span>
              <p className="text-[17px] font-bold tracking-tight text-slate-950">C1X</p>
            </div>
            <nav className="flex-1 space-y-1.5">
              {navItems.map((item) => {
                const isActive = item.key === activePage;
                return (
                  <button
                    key={item.key}
                    onClick={() => onNavigate(item.key)}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left transition-all ${
                      isActive
                        ? "bg-lime-300 text-slate-950"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <span className={isActive ? "text-slate-950" : "text-slate-400"}>{item.icon}</span>
                    <p className="text-[13.5px] font-semibold tracking-tight">{item.label}</p>
                  </button>
                );
              })}
            </nav>

            <div className="mt-6 space-y-3 border-t border-slate-100 pt-4">
              <div className="flex items-center gap-3 rounded-2xl px-1">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lime-200 text-[13px] font-bold text-slate-900">
                  A
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-slate-900">Admin</p>
                  <p className="truncate text-[11px] text-slate-400">System Admin</p>
                </div>
              </div>
              <button
                onClick={onLogout}
                className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-[12.5px] font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Log Out
              </button>
            </div>
          </aside>
        </div>

        <div className="min-w-0 flex-1">
          {/* Header */}
          <div className="rounded-[28px] bg-white/60 px-1 pb-2">
            <div className="flex flex-col gap-3 px-4 pt-3 sm:px-2 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <h1 className="text-[28px] font-bold tracking-tight text-slate-950">{pageTitles[activePage]}</h1>
                <p className="mt-0.5 text-[13px] text-slate-400">{todayLabel()} · {pageDescriptions[activePage]}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold ${liveTone}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${liveStatus === "connected" ? "bg-lime-700" : liveStatus === "connecting" ? "bg-amber-600" : "bg-slate-400"}`} />
                  {liveStatus === "connected" ? "Live" : liveStatus === "connecting" ? "Connecting" : "Offline"}
                </div>
                <button
                  onClick={onUploadNew}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm transition hover:text-slate-950"
                  aria-label="Refresh"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.58m14.84 2A8 8 0 004.58 9M20 20v-5h-.58m0 0A8 8 0 015.06 13" />
                  </svg>
                </button>
                <button
                  onClick={onExport}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-[12px] font-semibold text-slate-700 shadow-sm transition hover:text-slate-950"
                >
                  Export
                </button>
                <button
                  onClick={onExportEmployeeSummary}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-[12px] font-semibold text-slate-700 shadow-sm transition hover:text-slate-950"
                >
                  Employee Summary
                </button>
                <button
                  onClick={onExportLeaveSummary}
                  className="inline-flex items-center gap-1.5 rounded-full bg-lime-300 px-3.5 py-1.5 text-[12px] font-semibold text-slate-950 shadow-sm transition hover:bg-lime-400"
                >
                  Leave Summary
                </button>
              </div>
            </div>

            {/* Mobile nav strip */}
            <div className="mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:px-2 lg:hidden">
              {navItems.map((item) => {
                const isActive = item.key === activePage;
                return (
                  <button
                    key={item.key}
                    onClick={() => onNavigate(item.key)}
                    className={`shrink-0 rounded-full px-4 py-1.5 text-[12px] font-semibold transition ${
                      isActive ? "bg-lime-300 text-slate-950" : "bg-white text-slate-600 hover:text-slate-950"
                    }`}
                  >
                    {item.shortLabel}
                  </button>
                );
              })}
            </div>

            {/* Unified period selector (hidden on Employees page) */}
            {activePage !== "employees" && (
              <div className="mt-2 px-4 pb-2 sm:px-2">
                <PeriodSelector period={periodState} actions={periodActions} availableYears={availableYears} />
              </div>
            )}
          </div>

          <main className="px-1 py-4">
            {children}
            {activePage !== "employees" && <OverviewFooter dashboard={dashboard} period={periodState} />}
          </main>
        </div>
      </div>
    </div>
  );
}
