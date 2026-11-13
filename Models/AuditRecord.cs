using System;

namespace ArcelorMittalPortal.Models
{
    public class AuditRecord
    {
        public string Id { get; set; } = Guid.NewGuid().ToString("N");
        public string DateTimeString { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public string User { get; set; } = "Admin User";
        public string Action { get; set; } = string.Empty;
        public string Module { get; set; } = string.Empty;
        public string Details { get; set; } = string.Empty;
    }
}
