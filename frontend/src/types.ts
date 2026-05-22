// ── Period filter ─────────────────────────────────────────────────────────────

export type PeriodMode = "today" | "yesterday" | "date" | "month";

export interface PeriodState {
  periodMode: PeriodMode;
  selDate: string;   // ISO yyyy-mm-dd (used when periodMode === "date")
  selMonth: number;
  selYear: number;
}

export interface PeriodActions {
  setPeriodMode: (m: PeriodMode) => void;
  setSelDate:  (v: string) => void;
  setSelMonth: (v: number) => void;
  setSelYear:  (v: number) => void;
}

// ── Core attendance data ────────────────────────────────────────────────────

export interface DailyEntry {
  date: string;
  weekday: string;
  is_weekend: boolean;
  status: string;
  status_type: string;
  leave_subtype: string;
  note: string;
  in_time: string;
  out_time: string;
  total_minutes: number | null;
  total_hhmm: string;
}

export interface EmployeeSummary {
  weekday_minutes: number;
  weekend_minutes: number;
  total_minutes: number;
  weekday_hours: string;
  weekend_hours: string;
  total_hours: string;
  working_days: number;
  weekend_days: number;
  wfh_days: number;
  leave_days: number;
  absent_days: number;
}

export interface WeekDay {
  date: string;
  weekday: string;
  status: string;
  status_type: string;
  leave_subtype: string;
  in_time: string;
  out_time: string;
  total_minutes: number | null;
  total_hhmm: string;
}

export interface WeekBreakdown {
  week_label: string;
  iso_year: number;
  iso_week: number;
  start_date: string;
  end_date: string;
  total_minutes: number;
  total_hhmm: string;
  days: WeekDay[];
}

export interface EmployeeWeekStats {
  weeks: WeekBreakdown[];
  monthly_avg_weekly_minutes: number;
  monthly_avg_weekly_hhmm: string;
}

export interface EmployeeDashboard {
  emp_id: string;
  name: string;
  department: string;
  summary: EmployeeSummary;
  daily: DailyEntry[];
  week_breakdown?: EmployeeWeekStats;
}

export interface DashboardData {
  dates_processed: string[];
  employee_count: number;
  record_count: number;
  errors: string[];
  employees: EmployeeDashboard[];
}

// ── Analytics data ──────────────────────────────────────────────────────────

export interface AnalyticsLeaveEmployee {
  emp_id: string;
  name: string;
  department: string;
  leave_count: number;
  total_hours: string;
}

export interface AnalyticsLeaveData {
  count: number;
  employees: AnalyticsLeaveEmployee[];
}

export interface DeptStat {
  employee_count: number;
  total_hours: number;
  avg_hours_per_employee: number;
}

export interface AnalyticsData {
  period_info: {
    period: string;
    start_date: string;
    end_date: string;
    total_days: number;
  };
  overall: {
    total_employees: number;
    total_days: number;
    total_working_hours: number;
    avg_hours_per_employee: number;
    status_breakdown: Record<string, number>;
    department_stats: Record<string, DeptStat>;
  };
  leave_breakdown: Record<string, AnalyticsLeaveData>;
  filtered_data: {
    employees: EmployeeDashboard[];
    dates_processed: string[];
  };
}

// ── Reports / underperformers ───────────────────────────────────────────────

export interface UnderperformerEmployee {
  emp_id: string;
  name: string;
  department: string;
  actual_hours: number;
  expected_hours: number;
  deficit_hours: number;
  working_days: number;
  leave_days: number;
  absent_days: number;
  wfh_days: number;
}

export interface UnderperformerData {
  period: string;
  threshold_hours: number;
  expected_hours: number;
  underperformer_count: number;
  employees: UnderperformerEmployee[];
}

// ── App navigation ──────────────────────────────────────────────────────────

export type AppPage = "ceo" | "employees" | "misspunch";
