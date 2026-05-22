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
];

const pageTitles: Record<AppPage, string> = {
  ceo: "CEO Report",
  employees: "Employees",
  leave: "Leave Analysis",
  misspunch: "Miss Punch",
};

const pageDescriptions: Record<AppPage, string> = {
  ceo: "Daily snapshot, leave roster, late arrivals and short days.",
  employees: "Browse people and open monthly attendance calendars.",
  leave: "Leave mix and the employees behind each category.",
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
  children: ReactNode;
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
  onExport,
  children,
}: Props) {
  const liveTone =
    liveStatus === "connected"
      ? "bg-emerald-100/80 text-emerald-900 ring-1 ring-emerald-200"
      : liveStatus === "connecting"
        ? "bg-amber-100/80 text-amber-900 ring-1 ring-amber-200"
        : "bg-slate-200/70 text-slate-700 ring-1 ring-slate-300";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(247,148,29,0.10),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(13,148,136,0.08),_transparent_26%),linear-gradient(180deg,_#fbfaf7_0%,_#f7f8fb_45%,_#eef1f6_100%)] text-slate-900">
      {/* Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-20 lg:flex lg:w-64">
        <aside className="m-4 flex w-full flex-col rounded-[28px] border border-slate-200/80 bg-white/95 p-3 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur">
          <div className="px-2 pb-4 pt-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400">Attendance</p>
            <p className="mt-1 text-[15px] font-semibold tracking-tight text-slate-950">Workspace</p>
          </div>
          <nav className="flex-1 space-y-1.5 overflow-y-auto pr-1">
            {navItems.map((item) => {
              const isActive = item.key === activePage;
              return (
                <button
                  key={item.key}
                  onClick={() => onNavigate(item.key)}
                  className={`w-full rounded-2xl border px-3.5 py-3 text-left transition-all ${
                    isActive
                      ? "border-slate-200 bg-slate-50 text-slate-950 shadow-sm"
                      : "border-transparent bg-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`rounded-xl p-2 ${isActive ? "bg-white text-slate-900 ring-1 ring-slate-200" : "bg-slate-100 text-slate-500"}`}>{item.icon}</span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold tracking-tight">{item.label}</p>
                      <p className={`truncate text-[11px] ${isActive ? "text-slate-500" : "text-slate-400"}`}>{item.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>
        </aside>
      </div>

      <div className="lg:ml-64">
        {/* Sticky top header — title row + global period selector */}
        <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/70 backdrop-blur-xl">
          <div className="px-4 pt-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.28em] text-slate-400">{pageTitles[activePage]}</p>
                <h1 className="mt-1 text-[26px] font-semibold tracking-tight text-slate-950 sm:text-[30px]">
                  {pageTitles[activePage]}
                </h1>
                <p className="mt-1 text-[13px] text-slate-500">{pageDescriptions[activePage]}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold ${liveTone}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${liveStatus === "connected" ? "bg-emerald-500" : liveStatus === "connecting" ? "bg-amber-500" : "bg-slate-400"}`} />
                  {liveStatus === "connected" ? "Live" : liveStatus === "connecting" ? "Connecting" : "Offline"}
                </div>
                <button
                  onClick={onUploadNew}
                  className="inline-flex items-center gap-1.5 rounded-full bg-slate-950 px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-sm transition hover:bg-slate-800"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.58m14.84 2A8 8 0 004.58 9M20 20v-5h-.58m0 0A8 8 0 015.06 13" />
                  </svg>
                  Refresh
                </button>
                <button
                  onClick={onExport}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.59a1 1 0 01.7.29l5.42 5.42a1 1 0 01.29.7V19a2 2 0 01-2 2z" />
                  </svg>
                  Export
                </button>
              </div>
            </div>

            {/* Mobile nav strip */}
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:hidden">
              {navItems.map((item) => {
                const isActive = item.key === activePage;
                return (
                  <button
                    key={item.key}
                    onClick={() => onNavigate(item.key)}
                    className={`shrink-0 rounded-full px-4 py-1.5 text-[12px] font-semibold transition ${
                      isActive ? "bg-slate-950 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-950"
                    }`}
                  >
                    {item.shortLabel}
                  </button>
                );
              })}
            </div>

            {/* Unified period selector (hidden on Employees page) */}
            {activePage !== "employees" && (
              <div className="mt-3 pb-3">
                <PeriodSelector period={periodState} actions={periodActions} availableYears={availableYears} />
              </div>
            )}
            {activePage === "employees" && <div className="pb-3" />}
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          {children}
          {activePage !== "employees" && <OverviewFooter dashboard={dashboard} period={periodState} />}
        </main>
      </div>
    </div>
  );
}
