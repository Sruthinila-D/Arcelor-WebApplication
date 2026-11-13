using System.Collections.Generic;

namespace ArcelorMittalPortal.Models
{
    public class ModulePermission
    {
        public string ModuleName { get; set; } = string.Empty;
        public string Icon { get; set; } = "box";
        public bool View { get; set; }
        public bool Create { get; set; }
        public bool Edit { get; set; }
        public bool Delete { get; set; }
        public bool Approve { get; set; }
    }

    public class RolePermissions
    {
        public string RoleName { get; set; } = string.Empty;
        public List<ModulePermission> Modules { get; set; } = new();
    }
}
