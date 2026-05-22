import { useState, useCallback, useMemo, useEffect } from "react";
import axios from "axios";
import type { AppPage, AnalyticsData, DashboardData, PeriodMode, PeriodState, PeriodActions } from "./types";
import { useWebSocket } from "./hooks/useWebSocket";
import { todayIso } from "./utils";
import LoginPage from "./pages/LoginPage";
import AdminSetupPage from "./pages/AdminSetupPage";
import AppShell from "./components/AppShell";
import CEOReportPage from "./pages/CEOReportPage";
import EmployeesPage from "./pages/EmployeesPage";
import MissPunchPage from "./pages/MissPunchPage";

const _backendBase = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
const WS_URL = _backendBase.replace(/^http/, "ws") + "/ws/live";
const SESSION_KEY = "c1x_session";

type AppStage = "login" | "admin-setup" | "admin-loading" | "dashboard";

export default function App() {
  const hasSession = localStorage.getItem(SESSION_KEY) === "1";
  const [stage, setStage] = useState<AppStage>(hasSession ? "admin-loading" : "login");

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<AppPage>("ceo");
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [liveUpdateBanner, setLiveUpdateBanner] = useState(false);

  const [periodMode, setPeriodMode] = useState<PeriodMode>("today");
  const [selDate, setSelDate] = useState<string>(todayIso());
  const [selMonth, setSelMonth] = useState(new Date().getMonth());
  const [selYear, setSelYear] = useState(new Date().getFullYear());

  const periodState: PeriodState = { periodMode, selDate, selMonth, selYear };
  const periodActions: PeriodActions = { setPeriodMode, setSelDate, setSelMonth, setSelYear };

  const availableYears = useMemo(() => {
    const employees = analyticsData?.filtered_data?.employees ?? dashboard?.employees ?? [];
    const years = [...new Set(employees.flatMap((employee) => employee.daily?.map((day: { date: string }) => parseInt(day.date.substring(0, 4), 10)) ?? []))].sort();
    return years.length > 0 ? years : [new Date().getFullYear()];
  }, [analyticsData, dashboard]);

  const handleNavigate = (page: AppPage) => {
    setActivePage(page);
  };

  const loadAdminDashboard = useCallback(async () => {
    setStage("admin-loading");
    setError(null);
    try {
      const res = await axios.get("/api/cached-dashboard");
      setDashboard(res.data.dashboard as DashboardData);
      setAnalyticsData(res.data.analytics as AnalyticsData);
      setActivePage("ceo");
      setStage("dashboard");
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data?.detail || "Failed to load dashboard.");
      } else {
        setError("Network error - is the backend running?");
      }
    }
  }, []);

  const refreshFromCache = useCallback(async () => {
    try {
      const res = await axios.get("/api/cached-dashboard");
      setDashboard(res.data.dashboard as DashboardData);
      setAnalyticsData(res.data.analytics as AnalyticsData);
    } catch {
      // Keep existing data if refresh fails.
    }
  }, []);

  const { status: wsStatus } = useWebSocket(
    WS_URL,
    useCallback((msg: unknown) => {
      const data = msg as { event?: string };
      if (data?.event === "data_updated") {
        setLiveUpdateBanner(true);
        setTimeout(() => setLiveUpdateBanner(false), 4000);
        refreshFromCache();
      }
    }, [refreshFromCache]),
    stage === "dashboard",
  );

  useEffect(() => {
    if (hasSession) loadAdminDashboard();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = useCallback(async () => {
    localStorage.setItem(SESSION_KEY, "1");
    await loadAdminDashboard();
  }, [loadAdminDashboard]);

  const handleAdminConfigured = useCallback(async () => {
    await loadAdminDashboard();
  }, [loadAdminDashboard]);

  const handleDownload = async () => {
    try {
      const res = await axios.get("/api/admin/export", { responseType: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }));
      a.download = "Attendance_Report.xlsx";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch {
      setError("Export failed. Make sure the dashboard is loaded.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY);
    setStage("login");
    setDashboard(null);
    setAnalyticsData(null);
    setError(null);
    setActivePage("ceo");
  };

  const handleUploadNew = () => {
    setActivePage("ceo");
    setAnalyticsLoading(true);
    refreshFromCache().finally(() => setAnalyticsLoading(false));
  };

  if (stage === "login") {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (stage === "admin-setup") {
    return <AdminSetupPage onConfigured={handleAdminConfigured} />;
  }

  if (stage === "admin-loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(247,148,29,0.18),_transparent_28%),linear-gradient(180deg,_#fffaf3_0%,_#f8fafc_45%,_#eef2f7_100%)] px-6">
        <div className="mx-auto max-w-md text-center">
          {error ? (
            <div className="space-y-5">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 shadow-sm ring-1 ring-red-200">
                <svg className="h-6 w-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-950">Failed to load dashboard</p>
                <p className="text-xs leading-relaxed text-red-500">{error}</p>
              </div>
              <button
                onClick={() => { setError(null); loadAdminDashboard(); }}
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Retry
              </button>
              <div className="pt-1">
                <button onClick={handleLogout} className="text-xs text-slate-400 transition hover:text-slate-600">
                  Back to login
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-[28px] border border-white/80 bg-white/90 px-8 py-10 shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-400 via-orange-400 to-rose-500 shadow-lg shadow-orange-500/30">
                <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-950/15 border-t-slate-950" />
              </div>
              <p className="mt-5 text-lg font-semibold tracking-tight text-slate-950">Loading the live attendance workspace</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Pulling the latest snapshot from Google Sheets and preparing attendance, leave, and punch insights.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!dashboard) return null;

  return (
    <AppShell
      activePage={activePage}
      dashboard={dashboard}
      liveStatus={wsStatus}
      periodState={periodState}
      periodActions={periodActions}
      availableYears={availableYears}
      onNavigate={(page) => handleNavigate(page)}
      onUploadNew={handleUploadNew}
      onLogout={handleLogout}
      onExport={handleDownload}
    >
      {dashboard.errors.length > 0 && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-900 shadow-sm">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-semibold">Parser noticed {dashboard.errors.length} data warning{dashboard.errors.length === 1 ? "" : "s"}.</p>
            <p className="text-xs text-amber-700">The dashboard is usable, but a few source tabs or rows may need cleanup.</p>
          </div>
        </div>
      )}

      {analyticsLoading && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2.5 text-xs font-medium text-white shadow-lg">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          Updating analytics...
        </div>
      )}

      {liveUpdateBanner && (
        <div className="fixed right-6 top-20 z-50 flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg">
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
          Dashboard updated from Google Sheets
        </div>
      )}

      {activePage === "ceo" && (
        <CEOReportPage dashboard={dashboard} periodState={periodState} />
      )}
      {activePage === "employees" && (
        <EmployeesPage dashboard={dashboard} />
      )}
      {activePage === "misspunch" && (
        <MissPunchPage dashboard={dashboard} periodState={periodState} />
      )}
    </AppShell>
  );
}
