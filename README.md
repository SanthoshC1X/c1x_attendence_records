# C1X Attendance Intelligence System

A comprehensive employee attendance management system with advanced analytics and filtering capabilities.

## Features

### Core Functionality
- **Excel Data Processing**: Transform raw attendance Excel files into clean reports
- **Leave Management**: Handle WFH, CL, SL, PL, COMP OFF, and half-day leaves
- **Interactive Dashboard**: Real-time employee attendance visualization
- **Advanced Analytics**: Time-based filtering and performance analysis

### New Analytics Features
- **Leave Type Analysis**: Filter employees by specific leave types (WFH, CL, SL, PL, etc.)
- **Time Period Filtering**: Today, Weekly, Monthly, Yearly, and custom date ranges
- **Underperformer Analysis**: Identify employees working below threshold hours
- **Department-wise Statistics**: Breakdown by departments with averages
- **Real-time Filtering**: Click on leave type boxes to see employee details

## Setup Instructions

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000

## Usage

### 1. Upload Files
- **Attendance File**: Excel with daily punch data (sheets named DD-MM-YYYY)
- **Leave File** (optional): Excel with monthly leave data (sheets named Jan, Feb, etc.)

### 2. Choose Analysis Mode
- **Employee Dashboard**: Individual employee details and daily attendance
- **Advanced Analytics**: Leave analysis, time filtering, and performance insights

### 3. Filter and Analyze
- Select time periods (Today/Week/Month/Year/Custom)
- Click on leave type boxes to see employees who took that leave
- View underperformer analysis for employees below working hour thresholds
- Filter by departments and search employees

## API Endpoints

### Core Endpoints
- `POST /api/dashboard` - Generate employee dashboard
- `POST /api/transform` - Download Excel report
- `POST /api/preview` - Quick statistics

### Analytics Endpoints
- `POST /api/analytics/summary` - Comprehensive analytics with filtering
- `POST /api/analytics/leaves/{leave_type}` - Employees by leave type
- `POST /api/analytics/underperformers` - Employees below hour thresholds

## Data Structure

### Attendance File Format
```
Sheet Name: DD-MM-YYYY (e.g., 15-03-2026)
Columns: No. | Employee ID | First Name | Department | Weekday | First Punch | Last Punch | Total Time
```

### Leave File Format
```
Sheet Name: Month name (e.g., Jan, Feb, Mar)
Columns: S.No | Emp ID | Name | Day1 | Day2 | ... | Day31 | WFH Count | SL | CL | PL
Values: WFH, CL, SL, PL, COMP OFF, 1/2CL, 1/2SL, Holiday, LWD, or empty
```

## Technology Stack
- **Backend**: FastAPI, Python, OpenPyXL
- **Frontend**: React, TypeScript, Tailwind CSS, Vite
- **Data Processing**: Excel manipulation with intelligent status detection

## Future Enhancements
- Database integration (SQL support planned)
- Real-time notifications
- Advanced reporting with charts
- Mobile app support
- Integration with HR systems