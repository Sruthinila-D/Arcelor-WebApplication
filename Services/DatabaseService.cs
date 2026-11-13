using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using ArcelorMittalPortal.Models;

namespace ArcelorMittalPortal.Services
{
    public class DatabaseService
    {
        private readonly string _dbDirectory;
        private readonly object _lock = new();
        private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };

        public DatabaseService()
        {
            _dbDirectory = Path.Combine(Directory.GetCurrentDirectory(), "database");
            if (!Directory.Exists(_dbDirectory))
            {
                Directory.CreateDirectory(_dbDirectory);
            }

            InitializeSeedData();
        }

        public string GetDbDirectory() => _dbDirectory;

        #region Helper IO
        private T LoadFromFile<T>(string fileName, T fallback)
        {
            lock (_lock)
            {
                var filePath = Path.Combine(_dbDirectory, fileName);
                if (!File.Exists(filePath)) return fallback;

                try
                {
                    var json = File.ReadAllText(filePath);
                    return JsonSerializer.Deserialize<T>(json, JsonOptions) ?? fallback;
                }
                catch
                {
                    return fallback;
                }
            }
        }

        private void SaveToFile<T>(string fileName, T data)
        {
            lock (_lock)
            {
                var filePath = Path.Combine(_dbDirectory, fileName);
                var json = JsonSerializer.Serialize(data, JsonOptions);
                File.WriteAllText(filePath, json);
            }
        }
        #endregion

        #region Users
        public List<User> GetUsers()
        {
            return LoadFromFile<List<User>>("users.json", new List<User>());
        }

        public User? GetUserById(string employeeId)
        {
            return GetUsers().FirstOrDefault(u => u.EmployeeId.Equals(employeeId, StringComparison.OrdinalIgnoreCase));
        }

        public bool AddUser(User user)
        {
            var users = GetUsers();
            if (users.Any(u => u.EmployeeId.Equals(user.EmployeeId, StringComparison.OrdinalIgnoreCase) ||
                               u.Email.Equals(user.Email, StringComparison.OrdinalIgnoreCase)))
            {
                return false;
            }

            users.Insert(0, user);
            SaveToFile("users.json", users);
            UpdateRoleUserCounts(users);
            AddAudit("Created User", "User Management", $"New user: {user.Name} ({user.EmployeeId})");
            return true;
        }

        public bool UpdateUser(User updatedUser)
        {
            var users = GetUsers();
            var index = users.FindIndex(u => u.EmployeeId.Equals(updatedUser.EmployeeId, StringComparison.OrdinalIgnoreCase));
            if (index == -1) return false;

            users[index].Name = updatedUser.Name;
            users[index].Email = updatedUser.Email;
            users[index].Role = updatedUser.Role;
            users[index].Status = updatedUser.Status;
            SaveToFile("users.json", users);
            UpdateRoleUserCounts(users);
            AddAudit("Updated User", "User Management", $"Modified user: {updatedUser.Name} ({updatedUser.EmployeeId})");
            return true;
        }

        public bool DeleteUser(string employeeId)
        {
            var users = GetUsers();
            var user = users.FirstOrDefault(u => u.EmployeeId.Equals(employeeId, StringComparison.OrdinalIgnoreCase));
            if (user == null) return false;

            users.Remove(user);
            SaveToFile("users.json", users);
            UpdateRoleUserCounts(users);
            AddAudit("Deleted User", "User Management", $"User: {user.Email}");
            return true;
        }

        private void UpdateRoleUserCounts(List<User> users)
        {
            var roles = GetRoles();
            foreach (var r in roles)
            {
                r.Users = users.Count(u => u.Role.Equals(r.Name, StringComparison.OrdinalIgnoreCase));
            }
            SaveToFile("roles.json", roles);
        }
        #endregion

        #region Roles (Only 4 core roles: Administrator, Engineer, Supervisor, Operator)
        public List<Role> GetRoles()
        {
            var roles = LoadFromFile<List<Role>>("roles.json", new List<Role>());
            // Ensure Inspector and Viewer are strictly excluded
            return roles.Where(r => !r.Name.Equals("Inspector", StringComparison.OrdinalIgnoreCase) &&
                                     !r.Name.Equals("Viewer", StringComparison.OrdinalIgnoreCase)).ToList();
        }

        public Role? GetRoleByName(string name)
        {
            return GetRoles().FirstOrDefault(r => r.Name.Equals(name, StringComparison.OrdinalIgnoreCase));
        }

        public bool AddRole(Role role)
        {
            var roles = GetRoles();
            if (roles.Any(r => r.Name.Equals(role.Name, StringComparison.OrdinalIgnoreCase)))
            {
                return false;
            }

            role.Id = Guid.NewGuid().ToString("N")[..8];
            roles.Add(role);
            SaveToFile("roles.json", roles);
            AddAudit("Created Role", "Role & Permissions", $"New role: {role.Name}");
            return true;
        }

        public bool UpdateRole(Role updated)
        {
            var roles = GetRoles();
            var r = roles.FirstOrDefault(x => x.Name.Equals(updated.Name, StringComparison.OrdinalIgnoreCase) || x.Id == updated.Id);
            if (r == null) return false;

            r.Description = updated.Description;
            r.Status = updated.Status;
            SaveToFile("roles.json", roles);
            AddAudit("Updated Role", "Role & Permissions", $"Modified: {r.Name}");
            return true;
        }

        public bool DeleteRole(string roleName)
        {
            var roles = GetRoles();
            var r = roles.FirstOrDefault(x => x.Name.Equals(roleName, StringComparison.OrdinalIgnoreCase));
            if (r == null || r.Name.Equals("Administrator", StringComparison.OrdinalIgnoreCase)) return false;

            roles.Remove(r);
            SaveToFile("roles.json", roles);
            AddAudit("Deleted Role", "Role & Permissions", $"Deleted role: {roleName}");
            return true;
        }
        #endregion

        #region Permissions
        public List<RolePermissions> GetAllRolePermissions()
        {
            var list = LoadFromFile<List<RolePermissions>>("permissions.json", new List<RolePermissions>());
            return list.Where(p => !p.RoleName.Equals("Inspector", StringComparison.OrdinalIgnoreCase) &&
                                   !p.RoleName.Equals("Viewer", StringComparison.OrdinalIgnoreCase)).ToList();
        }

        public RolePermissions GetRolePermissions(string roleName)
        {
            var all = GetAllRolePermissions();
            var found = all.FirstOrDefault(p => p.RoleName.Equals(roleName, StringComparison.OrdinalIgnoreCase));
            if (found != null) return found;

            return new RolePermissions
            {
                RoleName = roleName,
                Modules = GetDefaultModulesForRole(roleName)
            };
        }

        public bool SaveRolePermissions(RolePermissions permissions)
        {
            var all = GetAllRolePermissions();
            var index = all.FindIndex(p => p.RoleName.Equals(permissions.RoleName, StringComparison.OrdinalIgnoreCase));
            if (index >= 0)
            {
                all[index] = permissions;
            }
            else
            {
                all.Add(permissions);
            }

            SaveToFile("permissions.json", all);
            AddAudit("Updated Role Permissions", "Role & Permissions", $"Updated permissions matrix for: {permissions.RoleName}");
            return true;
        }
        #endregion

        #region App Settings
        public AppSettingsModel GetSettings()
        {
            return LoadFromFile<AppSettingsModel>("settings.json", new AppSettingsModel());
        }

        public bool SaveSettings(AppSettingsModel settings)
        {
            SaveToFile("settings.json", settings);
            AddAudit("Configuration Update", "App Settings", "Updated system and business configurations");
            return true;
        }
        #endregion

        #region Audit Logs with Precise Date Filtering
        public List<AuditRecord> GetAudits(string? search = null, DateTime? startDate = null, DateTime? endDate = null)
        {
            var list = LoadFromFile<List<AuditRecord>>("audits.json", new List<AuditRecord>());
            var query = list.AsEnumerable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim().ToLowerInvariant();
                query = query.Where(a => a.User.ToLowerInvariant().Contains(s) ||
                                         a.Action.ToLowerInvariant().Contains(s) ||
                                         a.Module.ToLowerInvariant().Contains(s) ||
                                         a.Details.ToLowerInvariant().Contains(s));
            }

            if (startDate.HasValue)
            {
                var s = startDate.Value.Date;
                query = query.Where(a => a.Timestamp >= s);
            }

            if (endDate.HasValue)
            {
                var e = endDate.Value.Date.AddDays(1).AddTicks(-1);
                query = query.Where(a => a.Timestamp <= e);
            }

            return query.OrderByDescending(a => a.Timestamp).ToList();
        }

        public void AddAudit(string action, string module, string details, string user = "Admin User")
        {
            var audits = LoadFromFile<List<AuditRecord>>("audits.json", new List<AuditRecord>());
            var now = DateTime.Now;
            var record = new AuditRecord
            {
                Id = Guid.NewGuid().ToString("N")[..10],
                Timestamp = DateTime.UtcNow,
                DateTimeString = now.ToString("MMM dd, yyyy HH:mm"),
                User = user,
                Action = action,
                Module = module,
                Details = details
            };

            audits.Insert(0, record);
            SaveToFile("audits.json", audits);
        }
        #endregion

        #region Dashboard Metrics with Dynamic Date Range Filtering
        private static readonly List<TrendPoint> AllTrendData = new()
        {
            new() { Date = new DateTime(2025, 6, 1), DateLabel = "Jun 01", Inspections = 310, Passed = 285, Rejected = 5 },
            new() { Date = new DateTime(2025, 6, 2), DateLabel = "Jun 02", Inspections = 375, Passed = 340, Rejected = 6 },
            new() { Date = new DateTime(2025, 6, 3), DateLabel = "Jun 03", Inspections = 440, Passed = 398, Rejected = 8 },
            new() { Date = new DateTime(2025, 6, 4), DateLabel = "Jun 04", Inspections = 515, Passed = 465, Rejected = 10 },
            new() { Date = new DateTime(2025, 6, 5), DateLabel = "Jun 05", Inspections = 590, Passed = 530, Rejected = 12 },
            new() { Date = new DateTime(2025, 6, 6), DateLabel = "Jun 06", Inspections = 660, Passed = 590, Rejected = 14 },
            new() { Date = new DateTime(2025, 6, 7), DateLabel = "Jun 07", Inspections = 730, Passed = 655, Rejected = 15 },
            new() { Date = new DateTime(2025, 6, 8), DateLabel = "Jun 08", Inspections = 805, Passed = 720, Rejected = 17 },
            new() { Date = new DateTime(2025, 6, 9), DateLabel = "Jun 09", Inspections = 880, Passed = 790, Rejected = 19 },
            new() { Date = new DateTime(2025, 6, 10), DateLabel = "Jun 10", Inspections = 945, Passed = 850, Rejected = 20 },
            new() { Date = new DateTime(2025, 6, 11), DateLabel = "Jun 11", Inspections = 1010, Passed = 910, Rejected = 22 },
            new() { Date = new DateTime(2025, 6, 12), DateLabel = "Jun 12", Inspections = 1075, Passed = 965, Rejected = 23 },
            new() { Date = new DateTime(2025, 6, 13), DateLabel = "Jun 13", Inspections = 1140, Passed = 1015, Rejected = 25 },
            new() { Date = new DateTime(2025, 6, 14), DateLabel = "Jun 14", Inspections = 1190, Passed = 1055, Rejected = 27 },
            new() { Date = new DateTime(2025, 6, 15), DateLabel = "Jun 15", Inspections = 1236, Passed = 1091, Rejected = 28 }
        };

        public DashboardMetrics GetDashboardMetrics(DateTime? startDate = null, DateTime? endDate = null)
        {
            var users = GetUsers();
            var roles = GetRoles();

            var start = startDate ?? new DateTime(2025, 6, 1);
            var end = endDate ?? new DateTime(2025, 6, 15);

            var filteredTrends = AllTrendData.Where(t => t.Date.Date >= start.Date && t.Date.Date <= end.Date).ToList();
            if (!filteredTrends.Any())
            {
                filteredTrends = AllTrendData;
            }

            var latest = filteredTrends.Last();
            var totalPipes = 12450;
            var available = 8200;
            var inTransit = 320;
            var inspections = latest.Inspections;
            var passed = latest.Passed;
            var rejected = latest.Rejected;

            return new DashboardMetrics
            {
                TotalPipes = totalPipes,
                Available = available,
                InTransit = inTransit,
                Inspections = inspections,
                Passed = passed,
                Rejected = rejected,
                Users = users.Count > 0 ? users.Count : 56,
                Roles = roles.Count > 0 ? roles.Count : 4,
                DateRangeLabel = $"{start:MMM dd, yyyy} - {end:MMM dd, yyyy}",
                StockDistribution = new List<StockCategory>
                {
                    new() { Label = "Available", Count = 8200, Percentage = 65.9, Color = "#10B981" },
                    new() { Label = "In Transit", Count = 320, Percentage = 2.6, Color = "#F59E0B" },
                    new() { Label = "Inspection", Count = 150, Percentage = 1.2, Color = "#06B6D4" },
                    new() { Label = "Rejected", Count = rejected, Percentage = Math.Round((double)rejected / totalPipes * 100, 1), Color = "#EF4444" },
                    new() { Label = "Other", Count = totalPipes - 8200 - 320 - 150 - rejected, Percentage = 30.0, Color = "#3B82F6" }
                },
                InspectionTrends = filteredTrends
            };
        }
        #endregion

        #region Seed Initialization (Excluding Inspector and Viewer)
        private void InitializeSeedData()
        {
            var usersFile = Path.Combine(_dbDirectory, "users.json");
            var rolesFile = Path.Combine(_dbDirectory, "roles.json");
            var permsFile = Path.Combine(_dbDirectory, "permissions.json");
            var settsFile = Path.Combine(_dbDirectory, "settings.json");
            var auditsFile = Path.Combine(_dbDirectory, "audits.json");

            if (!File.Exists(rolesFile))
            {
                var seedRoles = new List<Role>
                {
                    new() { Id = "r1", Name = "Administrator", Description = "Full system access and configuration", Users = 4, Status = "Active" },
                    new() { Id = "r2", Name = "Engineer", Description = "Operations, analytics, documents access", Users = 24, Status = "Active" },
                    new() { Id = "r3", Name = "Supervisor", Description = "Operational control and confirmations", Users = 14, Status = "Active" },
                    new() { Id = "r4", Name = "Operator", Description = "Field operations and data capture", Users = 14, Status = "Active" }
                };
                SaveToFile("roles.json", seedRoles);
            }

            if (!File.Exists(permsFile))
            {
                var seedPerms = new List<RolePermissions>
                {
                    new() { RoleName = "Administrator", Modules = GetFullAccessModules() },
                    new() { RoleName = "Engineer", Modules = GetDefaultModulesForRole("Engineer") },
                    new() { RoleName = "Supervisor", Modules = GetDefaultModulesForRole("Supervisor") },
                    new() { RoleName = "Operator", Modules = GetDefaultModulesForRole("Operator") }
                };
                SaveToFile("permissions.json", seedPerms);
            }

            if (!File.Exists(settsFile))
            {
                var seedSettings = new AppSettingsModel
                {
                    CompanyName = "ArcelorMittal Tubular Products",
                    DefaultUnit = "Metric (m, mm, kg)",
                    DateFormat = "DD-MMM-YYYY",
                    TimeZone = "(GMT+04:00) Abu Dhabi",
                    SessionTimeoutMinutes = 30,
                    EnableMixWarning = true,
                    EnableDuplicatePipeCheck = true,
                    EnableRejectionReasons = true,
                    EnableStockCountUpload = true,
                    EnableAuditTrail = true
                };
                SaveToFile("settings.json", seedSettings);
            }
        }

        private static List<ModulePermission> GetDefaultModulesForRole(string roleName)
        {
            var isEngineer = roleName.Equals("Engineer", StringComparison.OrdinalIgnoreCase);
            var isSupervisor = roleName.Equals("Supervisor", StringComparison.OrdinalIgnoreCase);
            var isOperator = roleName.Equals("Operator", StringComparison.OrdinalIgnoreCase);

            return new List<ModulePermission>
            {
                new() { ModuleName = "Pipe Identification", Icon = "box", View = true, Create = true, Edit = isEngineer || isSupervisor, Delete = false, Approve = isSupervisor },
                new() { ModuleName = "Digital Tally", Icon = "clipboard-list", View = true, Create = true, Edit = isEngineer || isSupervisor, Delete = false, Approve = isSupervisor },
                new() { ModuleName = "Rig Operations", Icon = "industry", View = true, Create = true, Edit = isEngineer || isSupervisor, Delete = false, Approve = isSupervisor },
                new() { ModuleName = "Stock Management", Icon = "archive", View = true, Create = isEngineer || isSupervisor, Edit = isEngineer || isSupervisor, Delete = false, Approve = isSupervisor },
                new() { ModuleName = "Storage Locations", Icon = "map-pin", View = true, Create = true, Edit = isEngineer || isSupervisor, Delete = false, Approve = false },
                new() { ModuleName = "Quality & Inspection", Icon = "check-circle", View = true, Create = true, Edit = isEngineer || isSupervisor, Delete = false, Approve = isSupervisor },
                new() { ModuleName = "MTC & Documents", Icon = "file-text", View = true, Create = true, Edit = isEngineer || isSupervisor, Delete = false, Approve = isSupervisor },
                new() { ModuleName = "Analytics & Reports", Icon = "bar-chart-2", View = true, Create = true, Edit = false, Delete = false, Approve = false }
            };
        }

        private static List<ModulePermission> GetFullAccessModules()
        {
            var modules = new[]
            {
                ("Pipe Identification", "box"),
                ("Digital Tally", "clipboard-list"),
                ("Rig Operations", "industry"),
                ("Stock Management", "archive"),
                ("Storage Locations", "map-pin"),
                ("Quality & Inspection", "check-circle"),
                ("MTC & Documents", "file-text"),
                ("Analytics & Reports", "bar-chart-2")
            };

            return modules.Select(m => new ModulePermission
            {
                ModuleName = m.Item1,
                Icon = m.Item2,
                View = true,
                Create = true,
                Edit = true,
                Delete = true,
                Approve = true
            }).ToList();
        }
        #endregion
    }
}
