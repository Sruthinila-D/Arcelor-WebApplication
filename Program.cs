using System.IO;
using ArcelorMittalPortal.Models;
using ArcelorMittalPortal.Services;
using Microsoft.AspNetCore.DataProtection;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<DatabaseService>();
builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(Directory.GetCurrentDirectory(), "database", "keys")));

var app = builder.Build();

app.UseStaticFiles();
app.UseDefaultFiles();

// ───── AUTH ─────
app.MapPost("/api/auth/login", (LoginRequest req, DatabaseService db) =>
{
    var uName = (req.Username ?? "").Trim();
    var pwd = (req.Password ?? "").Trim();

    if ((uName.Equals("admin", StringComparison.OrdinalIgnoreCase) ||
         uName.Equals("admin@arcelormittal.com", StringComparison.OrdinalIgnoreCase)) &&
        pwd == "admin")
    {
        db.AddAudit("User Login", "Authentication", "User admin logged in successfully", "Admin User");
        return Results.Ok(new {
            success = true,
            isAuthenticated = true,
            token = "admin-token-001",
            user = new { name = "Admin User", username = "Admin User", role = "Administrator", initials = "AD" }
        });
    }

    var user = db.GetUsers().FirstOrDefault(u =>
        (u.Email.Equals(uName, StringComparison.OrdinalIgnoreCase) ||
         u.EmployeeId.Equals(uName, StringComparison.OrdinalIgnoreCase)) &&
        u.Password == pwd);

    if (user != null)
    {
        var initials = string.Concat(user.Name.Split(' ', StringSplitOptions.RemoveEmptyEntries).Select(w => w[0]));
        db.AddAudit("User Login", "Authentication", $"User {user.Name} ({user.EmployeeId}) logged in successfully", user.Name);
        return Results.Ok(new {
            success = true,
            isAuthenticated = true,
            token = $"tok-{user.EmployeeId}",
            user = new { name = user.Name, username = user.Name, role = user.Role, initials = initials }
        });
    }

    return Results.Json(new { success = false, message = "Invalid credentials. Use admin / admin" }, statusCode: 401);
});

app.MapGet("/api/auth/current", () => Results.Ok(new {
    isAuthenticated = true,
    username = "Admin User",
    name = "Admin User",
    role = "Administrator",
    initials = "AD"
}));

app.MapPost("/api/auth/logout", (DatabaseService db) =>
{
    db.AddAudit("User Logout", "Authentication", "User logged out", "Admin User");
    return Results.Ok(new { success = true });
});

// ───── DASHBOARD ─────
app.MapGet("/api/dashboard", (DateTime? startDate, DateTime? endDate, DatabaseService db) =>
    Results.Ok(db.GetDashboardMetrics(startDate, endDate)));

// ───── USERS ─────
app.MapGet("/api/users", (string? search, int? page, int? pageSize, DatabaseService db) =>
{
    var users = db.GetUsers();
    if (!string.IsNullOrWhiteSpace(search))
    {
        var s = search.Trim().ToLowerInvariant();
        users = users.Where(u => u.Name.ToLowerInvariant().Contains(s) ||
                                  u.Email.ToLowerInvariant().Contains(s) ||
                                  u.EmployeeId.ToLowerInvariant().Contains(s) ||
                                  u.Role.ToLowerInvariant().Contains(s)).ToList();
    }
    var total = users.Count;
    var p = page.GetValueOrDefault(1);
    var ps = pageSize.GetValueOrDefault(10);
    var items = users.Skip((p - 1) * ps).Take(ps).ToList();
    return Results.Ok(new { items, total, page = p, pageSize = ps, totalPages = (int)Math.Ceiling(total / (double)ps) });
});

app.MapGet("/api/users/next-id", (DatabaseService db) =>
{
    var users = db.GetUsers();
    int maxNum = 56;
    foreach (var u in users)
    {
        if (u.EmployeeId.StartsWith("EMP", StringComparison.OrdinalIgnoreCase) && int.TryParse(u.EmployeeId[3..], out int num))
        {
            if (num > maxNum) maxNum = num;
        }
    }
    var next = maxNum + 1;
    return Results.Ok(new { nextId = $"EMP{next:D3}", nextNumber = next });
});

app.MapPost("/api/users", (User user, DatabaseService db) =>
    db.AddUser(user) ? Results.Ok(new { success = true }) : Results.BadRequest(new { success = false, message = "Employee ID or Email already exists" }));

app.MapPut("/api/users/{id}", (string id, User user, DatabaseService db) =>
{
    user.EmployeeId = id;
    return db.UpdateUser(user) ? Results.Ok(new { success = true }) : Results.NotFound(new { success = false });
});

app.MapDelete("/api/users/{id}", (string id, DatabaseService db) =>
    db.DeleteUser(id) ? Results.Ok(new { success = true }) : Results.NotFound(new { success = false }));

// ───── ROLES ─────
app.MapGet("/api/roles", (DatabaseService db) => Results.Ok(db.GetRoles()));
app.MapPost("/api/roles", (Role role, DatabaseService db) =>
    db.AddRole(role) ? Results.Ok(new { success = true }) : Results.BadRequest(new { success = false, message = "Role already exists" }));
app.MapPut("/api/roles/{name}", (string name, Role role, DatabaseService db) =>
{
    role.Name = name;
    return db.UpdateRole(role) ? Results.Ok(new { success = true }) : Results.NotFound(new { success = false });
});
app.MapDelete("/api/roles/{name}", (string name, DatabaseService db) =>
    db.DeleteRole(name) ? Results.Ok(new { success = true }) : Results.NotFound(new { success = false }));

// ───── PERMISSIONS ─────
app.MapGet("/api/permissions", (DatabaseService db) => Results.Ok(db.GetAllRolePermissions()));
app.MapGet("/api/permissions/{role}", (string role, DatabaseService db) => Results.Ok(db.GetRolePermissions(role)));
app.MapPut("/api/permissions/{role}", (string role, RolePermissions perms, DatabaseService db) =>
{
    perms.RoleName = role;
    return db.SaveRolePermissions(perms) ? Results.Ok(new { success = true }) : Results.BadRequest(new { success = false });
});

// ───── SETTINGS ─────
app.MapGet("/api/settings", (DatabaseService db) => Results.Ok(db.GetSettings()));
app.MapPut("/api/settings", (AppSettingsModel settings, DatabaseService db) =>
    db.SaveSettings(settings) ? Results.Ok(new { success = true }) : Results.BadRequest(new { success = false }));

// ───── AUDIT ─────
app.MapGet("/api/audits", (string? search, DateTime? startDate, DateTime? endDate, int? page, int? pageSize, DatabaseService db) =>
{
    var records = db.GetAudits(search, startDate, endDate);
    var total = records.Count;
    var p = page.GetValueOrDefault(1);
    var ps = pageSize.GetValueOrDefault(10);
    var items = records.Skip((p - 1) * ps).Take(ps).ToList();
    return Results.Ok(new { items, total, page = p, pageSize = ps, totalPages = (int)Math.Ceiling(total / (double)ps) });
});

// ───── HTML PAGE ROUTES ─────
app.MapGet("/", () => Results.Redirect("/login.html"));
app.MapGet("/login", () => Results.Redirect("/login.html"));
app.MapGet("/dashboard", () => Results.Redirect("/index.html"));

app.Run();
