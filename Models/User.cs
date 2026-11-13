using System;

namespace ArcelorMittalPortal.Models
{
    public class User
    {
        public string EmployeeId { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string Status { get; set; } = "Active"; // Active | Inactive
        public string Password { get; set; } = "password";
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
