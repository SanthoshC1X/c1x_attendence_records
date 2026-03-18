import { useState, useCallback, useMemo, useEffect } from "react";
import axios from "axios";
import type { AppPage, AnalyticsData, DashboardData, PeriodMode, PeriodState, PeriodActions } from "./types";
import { useWebSocket } from "./hooks/useWebSocket";
import LoginPage, { type UserRole } from "./pages/LoginPage";
import AdminSetupPage from "./pages/AdminSetupPage";
import AppShell from "./components/AppShell";
import OverviewPage from "./pages/OverviewPage";
import EmployeesPage from "./pages/EmployeesPage";
import AttendancePage from "./pages/AttendancePage";
import LeaveAnalysisPage from "./pages/LeaveAnalysisPage";
import ReportsPage from "./pages/ReportsPage";
import MissPunchPage from "./pages/MissPunchPage";

const _backendBase = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
const WS_URL = _backendBase.replace(/^http/, "ws") + "/ws/live";
const SESSION_KEY = "c1x_role";

type AppStage = "login" | "admin-setup" | "admin-loading" | "dashboard";

export default function App() {
  const savedRole = localStorage.getItem(SESSION_KEY) as UserRole | null;
  const [stage, setStage]       = useState<AppStage>(savedRole ? "admin-loading" : "login");
  const [userRole, setUserRole] = useState<UserRole | null>(savedRole);

  // Data
  const [dashboard, setDashboard]         = useState<DashboardData | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);

  // UI
  const [error, setError]                       = useState<string | null>(null);
  const [activePage, setActivePage]             = useState<AppPage>("overview");
  const [activePeriod, setActivePeriod]         = useState("all");
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [liveUpdateBanner, setLiveUpdateBanner] = useState(false);
  const [leavePageInitialType, setLeavePageInitialType] = useState<string | null>(null);

  // ── Overview page filter state (lifted so it survives page navigation) ────
  const [overviewSearch,      setOverviewSearch]      = useState("");
  const [overviewLeaveFilter, setOverviewLeaveFilter] = useState<"all" | "wfh" | "cl" | "sl" | "pl" | "comp_off" | "half_leave" | "absent">("all");
  const [overviewSortKey,     setOverviewSortKey]     = useState<"name" | "absent" | "leave" | "wfh" | "hours">("name");
  const [overviewMinHours,    setOverviewMinHours]    = useState(0);
  const [overviewHoursDir,    setOverviewHoursDir]    = useState<"gte" | "lte">("gte");

  // ── Period filter (lifted so header and overview page share state) ─────────
  const [periodMode, setPeriodMode] = useState<PeriodMode>("month");
  const [selMonth,   setSelMonth]   = useState(new Date().getMonth());
  const [selYear,    setSelYear]    = useState(new Date().getFullYear());
  const [selWeek,    setSelWeek]    = useState(() => Math.ceil(new Date().getDate() / 7));
  const [customFrom, setCustomFrom] = useState("");
  const [customTo,   setCustomTo]   = useState("");

  const periodState: PeriodState = { periodMode, selMonth, selYear, selWeek, customFrom, customTo };
  const periodActions: PeriodActions = { setPeriodMode, setSelMonth, setSelYear, setSelWeek, setCustomFrom, setCustomTo };

  const availableYears = useMemo(() => {
    const emps = analyticsData?.filtered_data?.employees ?? dashboard?.employees ?? [];
    const years = [...new Set(emps.flatMap(e => e.daily?.map((d: { date: string }) => parseInt(d.date.substring(0, 4))) ?? []))].sort() as number[];
    return years.length > 0 ? years : [new Date().getFullYear()];
  }, [analyticsData, dashboard]);

  const handleNavigate = (page: AppPage, filter?: string) => {
    setActivePage(page);
    setLeavePageInitialType(page === "leave" && filter ? filter : null);
  };

  // ── Load dashboard from Google Sheets cache (both admin + HR) ────────────

  const loadAdminDashboard = useCallback(async () => {
    setStage("admin-loading");
    setError(null);
    try {
      const res = await axios.get("/api/cached-dashboard");
      setDashboard(res.data.dashboard as DashboardData);
      setAnalyticsData(res.data.analytics as AnalyticsData);
      setActivePage("overview");
      setActivePeriod("all");
      setStage("dashboard");
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data?.detail || "Failed to load dashboard.");
      } else {
        setError("Network error — is the backend running?");
      }
      // Stay on admin-loading so the error + retry button shows
    }
  }, []);

  // ── WebSocket live updates ────────────────────────────────────────────────

  const refreshFromCache = useCallback(async () => {
    try {
      const res = await axios.get("/api/cached-dashboard");
      setDashboard(res.data.dashboard as DashboardData);
      setAnalyticsData(res.data.analytics as AnalyticsData);
    } catch {
      // keep old data on failure
    }
  }, []);

  const { status: wsStatus } = useWebSocket(
    WS_URL,
    useCallback((msg: unknown) => {
      const data = msg as { event?: string };
      if (data?.event === "data_updated") {
        setLiveUpdateBanner(true);
        setTimeout(() => setLiveUpdateBanner(false), 4000);
        if (userRole === "admin" || userRole === "hr") {
          refreshFromCache();
        }
      }
    }, [userRole, refreshFromCache]),
    stage === "dashboard"
  );

  // ── Login handler — both roles go straight to dashboard ──────────────────

  // Auto-load dashboard on refresh if session exists
  useEffect(() => {
    if (savedRole) loadAdminDashboard();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = useCallback(async (role: UserRole) => {
    localStorage.setItem(SESSION_KEY, role);
    setUserRole(role);
    await loadAdminDashboard();
  }, [loadAdminDashboard]);

  // After admin finishes setup, load the dashboard
  const handleAdminConfigured = useCallback(async () => {
    await loadAdminDashboard();
  }, [loadAdminDashboard]);

  // ── Period change — both roles use cache ─────────────────────────────────

  const handlePeriodChange = async (period: string) => {
    setActivePeriod(period);
    setAnalyticsLoading(true);
    try {
      await refreshFromCache();
    } catch {
      // silent
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // ── Export CSV (combines attendance + leave from Google Sheets cache) ─────

  const handleDownload = async () => {
    try {
      const res = await axios.get("/api/admin/export", { responseType: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
      a.download = "Attendance_Report.csv";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch {
      setError("Export failed. Make sure the dashboard is loaded.");
    }
  };

  // ── Logout ───────────────────────────────────────────────────────────────

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY);
    setStage("login");
    setUserRole(null);
    setDashboard(null);
    setAnalyticsData(null);
    setError(null);
    setActivePage("overview");
    setActivePeriod("all");
  };

  // ── Refresh dashboard from Google Sheets ─────────────────────────────────

  const handleUploadNew = () => {
    setActivePage("overview");
    setActivePeriod("all");
    loadAdminDashboard();
  };

  // ── Screens ──────────────────────────────────────────────────────────────

  if (stage === "login") {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (stage === "admin-setup") {
    return <AdminSetupPage onConfigured={handleAdminConfigured} />;
  }

  if (stage === "admin-loading") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4 max-w-sm mx-auto px-6">
          {error ? (
            <>
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-gray-900 font-semibold text-sm">Failed to load dashboard</p>
              <p className="text-red-500 text-xs leading-relaxed">{error}</p>
              <button
                onClick={() => { setError(null); loadAdminDashboard(); }}
                className="text-sm text-indigo-600 hover:text-indigo-700 font-semibold underline underline-offset-2"
              >
                Retry
              </button>
              <div className="pt-2">
                <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-gray-600">
                  ← Back to login
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="w-12 h-12 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
              <p className="text-gray-900 font-semibold text-sm">Loading dashboard…</p>
              <p className="text-gray-400 text-xs">Fetching from Google Sheets</p>
            </>
          )}
        </div>
      </div>
    );
  }


  // ── Main dashboard ───────────────────────────────────────────────────────

  if (!dashboard) return null;

  return (
    <AppShell
      activePage={activePage}
      activePeriod={activePeriod}
      dashboard={dashboard}
      liveStatus={wsStatus}
      userRole={userRole ?? "hr"}
      periodState={periodState}
      periodActions={periodActions}
      availableYears={availableYears}
      onNavigate={(page) => handleNavigate(page)}
      onPeriodChange={handlePeriodChange}
      onUploadNew={handleUploadNew}
      onLogout={handleLogout}
      onExport={handleDownload}
    >
      {analyticsLoading && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-gray-900 text-white text-xs font-medium px-4 py-2.5 rounded-full shadow-lg">
          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          Updating analytics…
        </div>
      )}

      {liveUpdateBanner && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2 bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg">
          <span className="w-1.5 h-1.5 rounded-full bg-white" />
          Dashboard updated from Google Sheets
        </div>
      )}

      {activePage === "overview" && (
        <OverviewPage
          dashboard={dashboard}
          analyticsData={analyticsData}
          onNavigate={handleNavigate}
          periodState={periodState}
          periodActions={periodActions}
          search={overviewSearch}
          onSearchChange={setOverviewSearch}
          leaveFilter={overviewLeaveFilter}
          onLeaveFilterChange={setOverviewLeaveFilter}
          sortKey={overviewSortKey}
          onSortKeyChange={setOverviewSortKey}
          minHours={overviewMinHours}
          onMinHoursChange={setOverviewMinHours}
          hoursDir={overviewHoursDir}
          onHoursDirChange={setOverviewHoursDir}
        />
      )}
      {activePage === "employees" && (
        <EmployeesPage dashboard={dashboard} analyticsData={analyticsData} />
      )}
      {activePage === "attendance" && (
        <AttendancePage dashboard={dashboard} analyticsData={analyticsData} activePeriod={activePeriod} onPeriodChange={handlePeriodChange} />
      )}
      {activePage === "leave" && (
        <LeaveAnalysisPage analyticsData={analyticsData} initialLeaveType={leavePageInitialType} />
      )}
      {activePage === "reports" && (
        <ReportsPage activePeriod={activePeriod} />
      )}
      {activePage === "misspunch" && (
        <MissPunchPage dashboard={dashboard} analyticsData={analyticsData} periodState={periodState} periodActions={periodActions} />
      )}
    </AppShell>
  );
}
