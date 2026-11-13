# ArcelorMittal Pipe Traceability Web Portal

A full-stack .NET 9 web application for industrial pipe traceability, operational dashboarding, role-based access control, configuration settings, and activity auditing.

Built to match the ArcelorMittal enterprise design template and screens.

---

## 🚀 Quick Start

### Option 1: Double Click Launch
Double-click `run.bat` in this folder. It will launch the .NET web application and automatically open your browser to `http://localhost:5000/login.html`.

### Option 2: Command Line
Open PowerShell or Terminal in this folder and run:
```powershell
dotnet run --urls "http://localhost:5000"
```
Then navigate to: **`http://localhost:5000`**

---

## 🔐 Credentials
- **Username:** `admin`
- **Password:** `admin`

*(An alternate operator user `EMP001` / `password` is also supported)*

---

## 📁 System Architecture & Database Folder

All operational data is persisted in JSON database files inside the `database/` folder:

```
Arcelor/
├── database/
│   ├── users.json          # 56 user profiles with roles, statuses, emails
│   ├── roles.json          # System roles with descriptions and user counts
│   ├── permissions.json    # 8-module permission matrix per role
│   ├── settings.json       # General and operational system configurations
│   ├── audits.json         # 128+ audit activity records
│   └── keys/               # ASP.NET Core DataProtection key store
├── Models/
│   ├── User.cs
│   ├── Role.cs
│   ├── PermissionMatrix.cs
│   ├── AppSettingsModel.cs
│   ├── AuditRecord.cs
│   └── DashboardMetrics.cs
├── Services/
│   └── DatabaseService.cs  # High-performance JSON DB data access layer
├── wwwroot/
│   ├── login.html          # ArcelorMittal branded Login Screen
│   ├── index.html          # Main application shell with all 6 views
│   ├── css/
│   │   ├── portal.css
│   │   └── login.css
│   ├── js/
│   │   └── portal.js       # Dynamic SVG charting, live CRUD, pagination
│   └── images/
│       └── logo.svg        # ArcelorMittal corporate vector logo
├── Program.cs              # ASP.NET Core web server & minimal REST APIs
└── Arcelor.sln
```

---

## 🖥️ Implemented Screens & Functionalities

1. **Login Screen (Gate)**
   - Corporate ArcelorMittal dark navy & orange branding
   - Username: `admin` | Password: `admin`
   - Autofill helper & security validation
   - Auto-session establishment and redirect to Dashboard

2. **Screen 1: Admin Dashboard (Operational & System Overview)**
   - Date range picker (`Jun 01, 2025 - Jun 15, 2025`)
   - 8 KPI Metric Cards:
     - Total Pipes: `12,450`
     - Available: `8,200`
     - In Transit: `320`
     - Inspections: `1,236`
     - Passed: `1,091`
     - Rejected: `28`
     - Users: `56`
     - Roles: `4`
   - **Stock Distribution Chart:** High-resolution interactive SVG donut chart with center pipe counter and legend (Available 65.9%, In Transit 2.6%, Inspection 1.2%, Rejected 0.3%, Other 30.0%).
   - **Inspection Trend Chart:** SVG spline area curve with smooth orange gradient, interactive metric selector (`Inspections`, `Passed`, `Rejected`), and date axis.

3. **Screen 2: User Management (Users & Role Assignments)**
   - Search by Name, Email, or Employee ID
   - Filter by Status (`All`, `Active`, `Inactive`)
   - Filter by Role (`All`, `Administrator`, `Engineer`, `Supervisor`, `Operator`, `Inspector`, `Viewer`)
   - Paginated user list (`Showing 1 - 5 of 56 users`)
   - **+ Add User Modal:** Create user and persist to `database/users.json`
   - **Edit User Modal:** Update role, status, email, name
   - **Delete User Modal:** Remove user with confirmation and automatic audit trail logging

4. **Screen 3: Role & Permissions (Roles & Access Rights)**
   - Role table with descriptions, active user counts, and status pills
   - Subtabs: `[Roles]` and `[Permissions]`
   - Search by Role Name
   - **+ Add Role Modal** & Edit Role modal
   - Direct jump to Permission Matrix

5. **Screen 4: Permission Configuration (Module-Wise Access Control)**
   - Role selector dropdown: (`Engineer`, `Administrator`, `Supervisor`, `Operator`, `Inspector`, `Viewer`)
   - Full 8-Module permission matrix:
     1. Pipe Identification
     2. Digital Tally
     3. Rig Operations
     4. Stock Management
     5. Storage Locations
     6. Quality & Inspection
     7. MTC & Documents
     8. Analytics & Reports
   - Permission columns: `View`, `Create`, `Edit`, `Delete`, `Approve`
   - Interactive orange checkmarks, column select, `Cancel` and `Save Changes` buttons

6. **Screen 5: Application Settings (System & Business Configurations)**
   - Horizontal tabs: `[General]`, `[Pipe & Tally]`, `[Inspection & Quality]`, `[Notifications]`, `[System]`
   - Company Name (`ArcelorMittal Tubular Products`)
   - Default Unit (`Metric (m, mm, kg)`)
   - Date Format (`DD-MMM-YYYY`)
   - Time Zone (`(GMT+04:00) Abu Dhabi`)
   - Session Timeout (`30`)
   - Orange Toggle Switches:
     - Enable Mix Warning
     - Enable Duplicate Pipe Check
     - Enable Rejection Reasons
     - Enable Stock Count Upload
     - Enable Audit Trail
   - `Reset` and `Save` buttons with persistent database storage

7. **Screen 6: Audit & Activity (User & System History)**
   - Activity log table with Date & Time, User, Action, Module, and Details
   - Matches initial historical log entries + logs new user actions in real-time
   - Search by User, Action, or Module
   - Date range filter
   - Dynamic pagination (`Showing 1 - 5 of 128 records`)
   - **Export CSV:** One-click download of full system audit trail
