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
import Button from "./components/ui/Button";
import { SkeletonDashboard } from "./components/ui/Skeleton";

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

  const handleOpenSettings = useCallback(() => {
    setStage("admin-setup");
  }, []);

  const handleCancelSettings = useCallback(() => {
    setStage("dashboard");
  }, []);

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

  const handleExportEmployeeSummary = async () => {
    try {
      const res = await axios.get("/api/admin/export-employee-summary", { responseType: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }));
      a.download = "Employee_Summary_Report.xlsx";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch {
      setError("Export failed. Make sure the dashboard is loaded.");
    }
  };

  const handleExportLeaveSummary = async () => {
    try {
      const res = await axios.get("/api/admin/export-leave-summary", { responseType: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }));
      a.download = "Leave_Summary_Report.xlsx";
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
    return (
      <AdminSetupPage
        onConfigured={handleAdminConfigured}
        onCancel={dashboard ? handleCancelSettings : undefined}
      />
    );
  }

  if (stage === "admin-loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        {error ? (
          <div className="mx-auto max-w-md space-y-5 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center border border-red-200 bg-red-50 text-red-500">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div className="space-y-2">
              <p className="text-[14px] font-semibold text-slate-900">Failed to load dashboard</p>
              <p className="text-[12.5px] leading-relaxed text-red-500">{error}</p>
            </div>
            <Button variant="primary" onClick={() => { setError(null); loadAdminDashboard(); }}>
              Retry
            </Button>
            <div className="pt-1">
              <button onClick={handleLogout} className="text-[12px] text-slate-400 transition hover:text-slate-600">
                Back to login
              </button>
            </div>
          </div>
        ) : (
          <SkeletonDashboard />
        )}
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
      onOpenSettings={handleOpenSettings}
      onUploadNew={handleUploadNew}
      onLogout={handleLogout}
      onExport={handleDownload}
      onExportEmployeeSummary={handleExportEmployeeSummary}
      onExportLeaveSummary={handleExportLeaveSummary}
    >
      {dashboard.errors.length > 0 && (
        <div className="mb-4 flex items-center justify-between gap-3 border border-amber-200 bg-amber-50 px-4 py-2.5 text-[12.5px] text-amber-900">
          <p className="font-medium">{dashboard.errors.length} data warning{dashboard.errors.length === 1 ? "" : "s"} — a few source rows may need cleanup.</p>
        </div>
      )}

      {analyticsLoading && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-slate-900 px-3.5 py-2 text-[12px] font-medium text-white shadow-md">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          Updating…
        </div>
      )}

      {liveUpdateBanner && (
        <div className="fixed right-6 top-20 z-50 flex items-center gap-2 bg-emerald-600 px-3.5 py-2 text-[12px] font-medium text-white shadow-md">
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
          Dashboard updated
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
