namespace ArcelorMittalPortal.Models
{
    public class Role
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public int Users { get; set; } = 0;
        public string Status { get; set; } = "Active"; // Active | Inactive
    }
}
