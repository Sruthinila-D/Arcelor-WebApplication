using System;
using System.Collections.Generic;

namespace ArcelorMittalPortal.Models
{
    public class StockCategory
    {
        public string Label { get; set; } = string.Empty;
        public int Count { get; set; }
        public double Percentage { get; set; }
        public string Color { get; set; } = string.Empty;
    }

    public class TrendPoint
    {
        public DateTime Date { get; set; }
        public string DateLabel { get; set; } = string.Empty;
        public int Inspections { get; set; }
        public int Passed { get; set; }
        public int Rejected { get; set; }
    }

    public class DashboardMetrics
    {
        public int TotalPipes { get; set; }
        public int Available { get; set; }
        public int InTransit { get; set; }
        public int Inspections { get; set; }
        public int Passed { get; set; }
        public int Rejected { get; set; }
        public int Users { get; set; }
        public int Roles { get; set; }
        public string DateRangeLabel { get; set; } = "Jun 01, 2025 - Jun 15, 2025";
        public List<StockCategory> StockDistribution { get; set; } = new();
        public List<TrendPoint> InspectionTrends { get; set; } = new();
    }

    public class LoginRequest
    {
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public bool RememberMe { get; set; }
    }

    public class ApiResponse<T>
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
        public T? Data { get; set; }
    }
}
