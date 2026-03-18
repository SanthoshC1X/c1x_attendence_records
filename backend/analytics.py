"""
Advanced analytics and filtering for attendance data.
Provides time-based filtering, leave analysis, and working hours insights.
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from collections import defaultdict
import calendar
from . import parser


def get_date_range(period: str, available_dates: List[str], custom_start: Optional[str] = None, custom_end: Optional[str] = None) -> Tuple[str, str]:
    """
    Get start and end dates based on period type, considering available data.
    
    Args:
        period: 'today', 'week', 'month', 'year', 'custom', 'all'
        available_dates: List of dates available in the data
        custom_start: Start date for custom range (YYYY-MM-DD)
        custom_end: End date for custom range (YYYY-MM-DD)
    
    Returns:
        Tuple of (start_date, end_date) in YYYY-MM-DD format
    """
    if not available_dates:
        today = datetime.now().date()
        return today.strftime('%Y-%m-%d'), today.strftime('%Y-%m-%d')
    
    # Sort available dates
    sorted_dates = sorted(available_dates)
    data_start = datetime.strptime(sorted_dates[0], '%Y-%m-%d').date()
    data_end = datetime.strptime(sorted_dates[-1], '%Y-%m-%d').date()
    today = datetime.now().date()
    
    if period == 'all':
        # Return all available data
        return sorted_dates[0], sorted_dates[-1]
    
    elif period == 'today':
        # Today or closest available date
        today_str = today.strftime('%Y-%m-%d')
        if today_str in available_dates:
            return today_str, today_str
        else:
            # Find closest date to today
            closest_date = min(available_dates, key=lambda x: abs((datetime.strptime(x, '%Y-%m-%d').date() - today).days))
            return closest_date, closest_date
    
    elif period == 'week':
        # Current week or best available week
        week_start = today - timedelta(days=today.weekday())
        week_end = week_start + timedelta(days=6)
        
        # Adjust to available data range
        actual_start = max(week_start, data_start)
        actual_end = min(week_end, data_end)
        
        return actual_start.strftime('%Y-%m-%d'), actual_end.strftime('%Y-%m-%d')
    
    elif period == 'month':
        # Current month or best available month
        month_start = today.replace(day=1)
        _, last_day = calendar.monthrange(today.year, today.month)
        month_end = today.replace(day=last_day)
        
        # Adjust to available data range
        actual_start = max(month_start, data_start)
        actual_end = min(month_end, data_end)
        
        return actual_start.strftime('%Y-%m-%d'), actual_end.strftime('%Y-%m-%d')
    
    elif period == 'year':
        # Current year or best available year
        year_start = today.replace(month=1, day=1)
        year_end = today.replace(month=12, day=31)
        
        # Adjust to available data range
        actual_start = max(year_start, data_start)
        actual_end = min(year_end, data_end)
        
        return actual_start.strftime('%Y-%m-%d'), actual_end.strftime('%Y-%m-%d')
    
    elif period == 'custom' and custom_start and custom_end:
        # Custom range, but constrain to available data
        custom_start_date = datetime.strptime(custom_start, '%Y-%m-%d').date()
        custom_end_date = datetime.strptime(custom_end, '%Y-%m-%d').date()
        
        actual_start = max(custom_start_date, data_start)
        actual_end = min(custom_end_date, data_end)
        
        return actual_start.strftime('%Y-%m-%d'), actual_end.strftime('%Y-%m-%d')
    
    else:
        # Default to all available data
        return sorted_dates[0], sorted_dates[-1]


def filter_data_by_date_range(dashboard_data: dict, start_date: str, end_date: str) -> dict:
    """
    Filter dashboard data by date range.
    
    Args:
        dashboard_data: Original dashboard data
        start_date: Start date (YYYY-MM-DD)
        end_date: End date (YYYY-MM-DD)
    
    Returns:
        Filtered dashboard data
    """
    start_dt = datetime.strptime(start_date, '%Y-%m-%d').date()
    end_dt = datetime.strptime(end_date, '%Y-%m-%d').date()
    
    # Filter dates processed
    filtered_dates = [
        date for date in dashboard_data['dates_processed']
        if start_dt <= datetime.strptime(date, '%Y-%m-%d').date() <= end_dt
    ]
    
    # Filter employee daily data
    filtered_employees = []
    total_records = 0
    
    for emp in dashboard_data['employees']:
        filtered_daily = [
            day for day in emp['daily']
            if start_dt <= datetime.strptime(day['date'], '%Y-%m-%d').date() <= end_dt
        ]
        
        if filtered_daily:
            # Recalculate summary for filtered period
            summary = calculate_employee_summary(filtered_daily)
            
            filtered_emp = {
                **emp,
                'daily': filtered_daily,
                'summary': summary
            }
            filtered_employees.append(filtered_emp)
            total_records += len([d for d in filtered_daily if d['status_type'] in ['present', 'weekend_worked', 'wfh']])
    
    return {
        'dates_processed': filtered_dates,
        'employee_count': len(filtered_employees),
        'record_count': total_records,
        'errors': dashboard_data.get('errors', []),
        'employees': filtered_employees
    }


def calculate_employee_summary(daily_data: List[dict]) -> dict:
    """
    Recalculate employee summary from daily data.
    
    Args:
        daily_data: List of daily attendance records
    
    Returns:
        Updated summary dictionary
    """
    weekday_minutes = 0
    weekend_minutes = 0
    weekday_days = 0
    weekend_days = 0
    wfh_days = 0
    leave_days = 0
    absent_days = 0
    
    for day in daily_data:
        if day['status_type'] == 'present':
            if day['is_weekend']:
                weekend_minutes += day['total_minutes'] or 0
                weekend_days += 1
            else:
                weekday_minutes += day['total_minutes'] or 0
                weekday_days += 1
        elif day['status_type'] == 'weekend_worked':
            weekend_minutes += day['total_minutes'] or 0
            weekend_days += 1
        elif day['status_type'] == 'wfh':
            wfh_days += 1
            weekday_minutes += 480  # 8 hours default
        elif day['status_type'] in ['leave', 'comp_off']:
            leave_days += 1
        elif day['status_type'] == 'half_leave':
            leave_days += 0.5
            if day['total_minutes']:
                weekday_minutes += day['total_minutes']
                weekday_days += 1
        elif day['status_type'] == 'absent':
            absent_days += 1
    
    def minutes_to_hhmm(minutes):
        if not minutes or minutes <= 0:
            return "00:00"
        h, m = divmod(minutes, 60)
        return f"{h:02d}:{m:02d}"
    
    return {
        'weekday_minutes': weekday_minutes,
        'weekend_minutes': weekend_minutes,
        'total_minutes': weekday_minutes + weekend_minutes,
        'weekday_hours': minutes_to_hhmm(weekday_minutes),
        'weekend_hours': minutes_to_hhmm(weekend_minutes),
        'total_hours': minutes_to_hhmm(weekday_minutes + weekend_minutes),
        'working_days': weekday_days,
        'weekend_days': weekend_days,
        'wfh_days': wfh_days,
        'leave_days': leave_days,
        'absent_days': absent_days,
    }


def get_leave_type_analytics(dashboard_data: dict) -> dict:
    """
    Analyze leave types across all employees.
    
    Args:
        dashboard_data: Dashboard data
    
    Returns:
        Leave type analytics with employee details
    """
    leave_analytics = {
        'wfh': {'count': 0, 'employees': []},
        'cl': {'count': 0, 'employees': []},
        'sl': {'count': 0, 'employees': []},
        'pl': {'count': 0, 'employees': []},
        'comp_off': {'count': 0, 'employees': []},
        'half_leave': {'count': 0, 'employees': []},
        'absent': {'count': 0, 'employees': []},
    }
    
    for emp in dashboard_data['employees']:
        emp_leave_counts = defaultdict(int)
        
        for day in emp['daily']:
            status_type = day['status_type']
            status = day['status'].upper()
            
            if status_type == 'wfh':
                emp_leave_counts['wfh'] += 1
            elif status_type == 'leave':
                if 'CL' in status:
                    emp_leave_counts['cl'] += 1
                elif 'SL' in status:
                    emp_leave_counts['sl'] += 1
                elif 'PL' in status:
                    emp_leave_counts['pl'] += 1
            elif status_type == 'comp_off':
                emp_leave_counts['comp_off'] += 1
            elif status_type == 'half_leave':
                emp_leave_counts['half_leave'] += 0.5
            elif status_type == 'absent':
                emp_leave_counts['absent'] += 1
        
        # Add employee to relevant leave type analytics
        for leave_type, count in emp_leave_counts.items():
            if count > 0:
                leave_analytics[leave_type]['count'] += count
                leave_analytics[leave_type]['employees'].append({
                    'emp_id': emp['emp_id'],
                    'name': emp['name'],
                    'department': emp['department'],
                    'leave_count': count,
                    'total_hours': emp['summary']['total_hours']
                })
    
    # Sort employees by leave count (descending)
    for leave_type in leave_analytics:
        leave_analytics[leave_type]['employees'].sort(
            key=lambda x: x['leave_count'], reverse=True
        )
    
    return leave_analytics


def get_underperforming_employees(dashboard_data: dict, period: str, threshold_hours: int = 40) -> dict:
    """
    Find employees working below threshold hours.
    
    Args:
        dashboard_data: Dashboard data
        period: 'week', 'month', 'year'
        threshold_hours: Minimum hours threshold
    
    Returns:
        List of underperforming employees with details
    """
    # Calculate expected hours based on period
    if period == 'week':
        expected_hours = threshold_hours
    elif period == 'month':
        # Approximate 4.33 weeks per month
        expected_hours = threshold_hours * 4.33
    elif period == 'year':
        # 52 weeks per year
        expected_hours = threshold_hours * 52
    else:
        expected_hours = threshold_hours
    
    underperformers = []
    
    for emp in dashboard_data['employees']:
        total_minutes = emp['summary']['total_minutes']
        total_hours = total_minutes / 60 if total_minutes else 0
        
        if total_hours < expected_hours:
            underperformers.append({
                'emp_id': emp['emp_id'],
                'name': emp['name'],
                'department': emp['department'],
                'actual_hours': round(total_hours, 2),
                'expected_hours': round(expected_hours, 2),
                'deficit_hours': round(expected_hours - total_hours, 2),
                'working_days': emp['summary']['working_days'],
                'leave_days': emp['summary']['leave_days'],
                'absent_days': emp['summary']['absent_days'],
                'wfh_days': emp['summary']['wfh_days']
            })
    
    # Sort by deficit hours (highest deficit first)
    underperformers.sort(key=lambda x: x['deficit_hours'], reverse=True)
    
    return {
        'period': period,
        'threshold_hours': threshold_hours,
        'expected_hours': round(expected_hours, 2),
        'underperformer_count': len(underperformers),
        'employees': underperformers
    }


def get_overall_analytics(dashboard_data: dict, period: str) -> dict:
    """
    Get comprehensive analytics overview.
    
    Args:
        dashboard_data: Dashboard data
        period: Time period for analysis
    
    Returns:
        Overall analytics summary
    """
    total_employees = dashboard_data['employee_count']
    total_days = len(dashboard_data['dates_processed'])
    
    # Status counts
    status_counts = {
        'present': 0,
        'wfh': 0,
        'leave': 0,
        'absent': 0,
        'weekend_worked': 0
    }
    
    # Department breakdown
    dept_stats = defaultdict(lambda: {
        'employee_count': 0,
        'total_hours': 0,
        'avg_hours_per_employee': 0
    })
    
    total_working_hours = 0
    
    for emp in dashboard_data['employees']:
        dept = emp['department']
        emp_hours = emp['summary']['total_minutes'] / 60 if emp['summary']['total_minutes'] else 0
        
        dept_stats[dept]['employee_count'] += 1
        dept_stats[dept]['total_hours'] += emp_hours
        total_working_hours += emp_hours
        
        # Count daily statuses
        for day in emp['daily']:
            status_type = day['status_type']
            if status_type in status_counts:
                status_counts[status_type] += 1
            elif status_type in ['leave', 'comp_off', 'half_leave']:
                status_counts['leave'] += 1
    
    # Calculate averages
    for dept in dept_stats:
        if dept_stats[dept]['employee_count'] > 0:
            dept_stats[dept]['avg_hours_per_employee'] = round(
                dept_stats[dept]['total_hours'] / dept_stats[dept]['employee_count'], 2
            )
    
    return {
        'period': period,
        'total_employees': total_employees,
        'total_days': total_days,
        'total_working_hours': round(total_working_hours, 2),
        'avg_hours_per_employee': round(total_working_hours / total_employees, 2) if total_employees > 0 else 0,
        'status_breakdown': status_counts,
        'department_stats': dict(dept_stats),
        'dates_covered': {
            'start': dashboard_data['dates_processed'][0] if dashboard_data['dates_processed'] else None,
            'end': dashboard_data['dates_processed'][-1] if dashboard_data['dates_processed'] else None
        }
    }

def get_employee_week_breakdown(emp: dict) -> dict:
    """Groups an employee's daily records into ISO weeks with totals and day-level detail."""
    from collections import OrderedDict

    weeks_map = OrderedDict()

    for day in emp.get("daily", []):
        date_str = day.get("date", "")
        if not date_str:
            continue
        try:
            dt = datetime.strptime(date_str, "%Y-%m-%d")
        except ValueError:
            continue

        iso = dt.isocalendar()
        week_key = (iso[0], iso[1])  # (iso_year, iso_week)

        if week_key not in weeks_map:
            weeks_map[week_key] = {
                "iso_year": iso[0],
                "iso_week": iso[1],
                "dates": [],
                "total_minutes": 0,
                "days": [],
            }

        minutes = day.get("total_minutes") or 0
        weeks_map[week_key]["total_minutes"] += minutes
        weeks_map[week_key]["dates"].append(dt)
        weeks_map[week_key]["days"].append({
            "date": date_str,
            "weekday": day.get("weekday", ""),
            "status": day.get("status", ""),
            "status_type": day.get("status_type", ""),
            "leave_subtype": day.get("leave_subtype", ""),
            "in_time": day.get("in_time", ""),
            "out_time": day.get("out_time", ""),
            "total_minutes": day.get("total_minutes"),
            "total_hhmm": day.get("total_hhmm", ""),
        })

    weeks = []
    for idx, (week_key, data) in enumerate(weeks_map.items(), start=1):
        mins = data["total_minutes"]
        hours = mins // 60
        remaining = mins % 60
        start_date = min(data["dates"]).strftime("%Y-%m-%d")
        end_date = max(data["dates"]).strftime("%Y-%m-%d")
        weeks.append({
            "week_label": f"Week {idx}",
            "iso_year": data["iso_year"],
            "iso_week": data["iso_week"],
            "start_date": start_date,
            "end_date": end_date,
            "total_minutes": mins,
            "total_hhmm": f"{hours}:{remaining:02d}",
            "days": data["days"],
        })

    total_week_minutes = sum(w["total_minutes"] for w in weeks)
    num_weeks = max(len(weeks), 1)
    avg_minutes = total_week_minutes // num_weeks
    avg_hours = avg_minutes // 60
    avg_remaining = avg_minutes % 60

    return {
        "weeks": weeks,
        "monthly_avg_weekly_minutes": avg_minutes,
        "monthly_avg_weekly_hhmm": f"{avg_hours}:{avg_remaining:02d}",
    }


def enrich_with_week_breakdown(filtered_data: dict) -> None:
    """Mutates each employee in filtered_data to add a week_breakdown field."""
    for emp in filtered_data.get("employees", []):
        emp["week_breakdown"] = get_employee_week_breakdown(emp)
