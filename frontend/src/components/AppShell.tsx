import { useEffect, useRef, useState, type ReactNode } from "react";
import type { AppPage, DashboardData, PeriodState, PeriodActions } from "../types";
import type { WsStatus } from "../hooks/useWebSocket";
import PeriodSelector from "./PeriodSelector";
import OverviewFooter from "./OverviewFooter";
import Button from "./ui/Button";

interface NavItem {
  key: AppPage;
  label: string;
  icon: ReactNode;
}

const navItems: NavItem[] = [
  {
    key: "ceo",
    label: "Dashboard",
    icon: <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M3 17l6-6 4 4 8-8M14 7h7v7" /></svg>,
  },
  {
    key: "employees",
    label: "Employees",
    icon: <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M17 20h5v-2a3 3 0 00-5.36-1.86M17 20H7m10 0v-2c0-.66-.13-1.28-.36-1.86M7 20H2v-2a3 3 0 015.36-1.86M7 20v-2c0-.66.13-1.28.36-1.86m0 0a5 5 0 019.28 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  },
  {
    key: "misspunch",
    label: "Miss Punch",
    icon: <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  },
];

const SettingsIcon = (
  <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const pageTitles: Record<AppPage, string> = {
  ceo: "Dashboard",
  employees: "Employees",
  misspunch: "Miss Punch",
};

interface Props {
  activePage: AppPage;
  dashboard: DashboardData;
  liveStatus: WsStatus;
  periodState: PeriodState;
  periodActions: PeriodActions;
  availableYears: number[];
  onNavigate: (page: AppPage) => void;
  onOpenSettings: () => void;
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

function ExportMenu({
  onExport,
  onExportEmployeeSummary,
  onExportLeaveSummary,
}: {
  onExport: () => void;
  onExportEmployeeSummary: () => void;
  onExportLeaveSummary: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const items = [
    { label: "Attendance report", onClick: onExport },
    { label: "Employee summary", onClick: onExportEmployeeSummary },
    { label: "Leave summary", onClick: onExportLeaveSummary },
  ];

  return (
    <div className="relative" ref={ref}>
      <Button variant="primary" onClick={() => setOpen((v) => !v)}>
        Export
        <svg className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-52 border border-slate-200 bg-white py-1 shadow-md">
          {items.map((it) => (
            <button
              key={it.label}
              onClick={() => { it.onClick(); setOpen(false); }}
              className="block w-full px-3.5 py-2 text-left text-[12.5px] font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AppShell({
  activePage,
  dashboard,
  liveStatus,
  periodState,
  periodActions,
  availableYears,
  onNavigate,
  onOpenSettings,
  onUploadNew,
  onLogout,
  onExport,
  onExportEmployeeSummary,
  onExportLeaveSummary,
  children,
}: Props) {
  const liveTone =
    liveStatus === "connected"
      ? "bg-emerald-50 text-emerald-700"
      : liveStatus === "connecting"
        ? "bg-amber-50 text-amber-700"
        : "bg-slate-100 text-slate-500";
  const liveDot =
    liveStatus === "connected" ? "bg-emerald-500" : liveStatus === "connecting" ? "bg-amber-500" : "bg-slate-400";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex max-w-[1440px] gap-6 px-4 py-4 sm:px-6">
        {/* Sidebar */}
        <div className="hidden lg:flex lg:w-56 lg:shrink-0">
          <aside className="flex w-full flex-col border border-slate-200 bg-white p-3">
            <div className="flex items-center gap-2 px-2 py-3">
              <span className="text-[16px] font-bold text-slate-900">%</span>
              <p className="text-[14.5px] font-semibold tracking-tight text-slate-900">C1X</p>
            </div>

            <nav className="mt-1 flex-1 space-y-0.5">
              {navItems.map((item) => {
                const isActive = item.key === activePage;
                return (
                  <button
                    key={item.key}
                    onClick={() => onNavigate(item.key)}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium transition ${
                      isActive
                        ? "border-l-2 border-slate-900 bg-slate-100 text-slate-900"
                        : "border-l-2 border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <span className={isActive ? "text-slate-900" : "text-slate-400"}>{item.icon}</span>
                    {item.label}
                  </button>
                );
              })}
              <button
                onClick={onOpenSettings}
                className="flex w-full items-center gap-2.5 border-l-2 border-transparent px-3 py-2 text-left text-[13px] font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
              >
                <span className="text-slate-400">{SettingsIcon}</span>
                Settings
              </button>
            </nav>

            <div className="space-y-1 border-t border-slate-100 pt-3">
              <div className="flex items-center gap-2.5 px-3 py-1.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-slate-100 text-[12px] font-semibold text-slate-600">
                  A
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-medium text-slate-900">Admin</p>
                </div>
              </div>
              <button
                onClick={onLogout}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
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
          <div className="border-b border-slate-200 pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">{pageTitles[activePage]}</h1>
                <p className="mt-0.5 text-[12.5px] text-slate-400">{todayLabel()}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium ${liveTone}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${liveDot}`} />
                  {liveStatus === "connected" ? "Live" : liveStatus === "connecting" ? "Connecting" : "Offline"}
                </div>
                <Button variant="ghost" onClick={onUploadNew} aria-label="Refresh">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.58m14.84 2A8 8 0 004.58 9M20 20v-5h-.58m0 0A8 8 0 015.06 13" />
                  </svg>
                </Button>
                <ExportMenu
                  onExport={onExport}
                  onExportEmployeeSummary={onExportEmployeeSummary}
                  onExportLeaveSummary={onExportLeaveSummary}
                />
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
                    className={`shrink-0 px-3.5 py-1.5 text-[12px] font-medium transition ${
                      isActive ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
              <button
                onClick={onOpenSettings}
                className="shrink-0 border border-slate-200 bg-white px-3.5 py-1.5 text-[12px] font-medium text-slate-600"
              >
                Settings
              </button>
            </div>

            {/* Unified period selector (hidden on Employees page) */}
            {activePage !== "employees" && (
              <div className="mt-3">
                <PeriodSelector period={periodState} actions={periodActions} availableYears={availableYears} />
              </div>
            )}
          </div>

          <main className="py-4">
            {children}
            {activePage !== "employees" && <OverviewFooter dashboard={dashboard} period={periodState} />}
          </main>
        </div>
      </div>
    </div>
  );
}
