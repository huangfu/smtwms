namespace SmtWms.Domain.ValueObjects;

/// <summary>
/// IPC/JEDEC J-STD-033 湿敏元件(MSD)车间寿命领域策略
/// </summary>
public static class MsdFloorLifePolicy
{
    private static readonly Dictionary<string, int> FloorLifeHoursMap = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Level 1"] = int.MaxValue,
        ["Level 2"] = 8760,
        ["Level 2a"] = 672,
        ["Level 3"] = 168,
        ["Level 4"] = 72,
        ["Level 5a"] = 24,
    };

    public static int GetFloorLifeHours(string msdLevel) =>
        FloorLifeHoursMap.TryGetValue(msdLevel ?? "Level 1", out var hours) ? hours : 168;

    public static bool IsBakingRequired(string msdLevel, string msdState, string? msdOpenAtIso, DateTime? nowUtc = null)
    {
        if (string.Equals(msdState, "BAKING_REQUIRED", StringComparison.OrdinalIgnoreCase))
            return true;
        if (!string.Equals(msdState, "EXPOSED", StringComparison.OrdinalIgnoreCase))
            return false;
        var limitHours = GetFloorLifeHours(msdLevel);
        if (limitHours == int.MaxValue || string.IsNullOrWhiteSpace(msdOpenAtIso))
            return false;
        if (!DateTime.TryParse(msdOpenAtIso, out var opened))
            return false;
        var elapsed = ((nowUtc ?? DateTime.UtcNow) - opened.ToUniversalTime()).TotalHours;
        return elapsed >= limitHours;
    }
}
