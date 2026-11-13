using System.Collections.Generic;

namespace ArcelorMittalPortal.Models
{
    public class RejectionReasonItem
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        public string Status { get; set; } = "Active";
    }

    public class AlertConfigItem
    {
        public string Type { get; set; } = "";
        public bool InApp { get; set; } = true;
        public bool Email { get; set; } = true;
        public bool Sms { get; set; } = false;
    }

    public class AppSettingsModel
    {
        // ==========================================
        // 1. GENERAL TAB
        // ==========================================
        public string CompanyName { get; set; } = "ArcelorMittal Tubular Products";
        public string DefaultUnit { get; set; } = "Metric (m, mm, kg)";
        public string DateFormat { get; set; } = "DD-MMM-YYYY";
        public string TimeZone { get; set; } = "(GMT+04:00) Abu Dhabi";
        public int SessionTimeoutMinutes { get; set; } = 30;

        public bool EnableMixWarning { get; set; } = true;
        public bool EnableDuplicatePipeCheck { get; set; } = true;
        public bool EnableRejectionReasons { get; set; } = true;
        public bool EnableStockCountUpload { get; set; } = true;
        public bool EnableAuditTrail { get; set; } = true;

        // ==========================================
        // 2. PIPE & TALLY TAB
        // ==========================================
        public string PipeIdPrefix { get; set; } = "P-";
        public int JointNumberStart { get; set; } = 1;
        public string DefaultConnectionType { get; set; } = "API";
        public string DefaultDriftType { get; set; } = "Full Drift";
        public string EffectiveLengthUnit { get; set; } = "m (Meter)";

        public bool AllowTallyCreation { get; set; } = true;
        public bool AllowTallyEditing { get; set; } = true;
        public bool EnforceUniquePipeInTally { get; set; } = true;
        public bool AutoGenerateJointSequence { get; set; } = true;
        public bool AllowTallyClosure { get; set; } = true;

        // ==========================================
        // 3. INSPECTION & QUALITY TAB
        // ==========================================
        public double InspectionThresholdMm { get; set; } = 0.25;
        public string DefaultInspectionType { get; set; } = "Dimensional";
        public int MaxReworkAttempts { get; set; } = 2;
        public int InspectionValidityDays { get; set; } = 180;

        public List<RejectionReasonItem> RejectionReasons { get; set; } = new()
        {
            new RejectionReasonItem { Id = "1", Name = "Crack", Status = "Active" },
            new RejectionReasonItem { Id = "2", Name = "Corrosion", Status = "Active" },
            new RejectionReasonItem { Id = "3", Name = "Out of Tolerance", Status = "Active" },
            new RejectionReasonItem { Id = "4", Name = "Thread Damage", Status = "Active" },
            new RejectionReasonItem { Id = "5", Name = "Other", Status = "Active" }
        };

        // ==========================================
        // 4. NOTIFICATIONS TAB
        // ==========================================
        public List<AlertConfigItem> AlertConfigurations { get; set; } = new()
        {
            new AlertConfigItem { Type = "Inspection Rejected", InApp = true, Email = true, Sms = false },
            new AlertConfigItem { Type = "Duplicate Pipe Detected", InApp = true, Email = true, Sms = true },
            new AlertConfigItem { Type = "Stock Count Threshold", InApp = true, Email = true, Sms = false },
            new AlertConfigItem { Type = "Tally Approval Pending", InApp = true, Email = false, Sms = false },
            new AlertConfigItem { Type = "System Alerts & Errors", InApp = true, Email = true, Sms = true }
        };

        public bool EnableNotifications { get; set; } = true;
        public string NotificationFrequency { get; set; } = "Real-time";
        public bool DailySummaryEmail { get; set; } = true;
        public string RecipientsAdmin { get; set; } = "admin@arcelormittal.com";

        // ==========================================
        // 5. SYSTEM TAB
        // ==========================================
        public string ApplicationVersion { get; set; } = "v1.0.0";
        public string Environment { get; set; } = "Production";
        public string SystemName { get; set; } = "Pipe Traceability Web Portal";
        public string LastUpdated { get; set; } = "Jun 15, 2025 10:24";

        public bool EnableAutoBackup { get; set; } = true;
        public string BackupFrequency { get; set; } = "Daily";
        public int RetentionPeriodDays { get; set; } = 90;
        public string BackupLocation { get; set; } = @"D:\Backups\PipeTraceability";

        public bool EnableMfa { get; set; } = true;
        public bool EnableSso { get; set; } = false;
        public bool ErpIntegrationApi { get; set; } = true;
        public bool DataWarehouseIntegration { get; set; } = true;
        public int LogRetentionDays { get; set; } = 365;
    }
}
