namespace SmtWms.Domain.ValueObjects;

/// <summary>
/// 物料复合业务主键：料号 + 产权类型 + 归属主体代码
/// </summary>
public sealed record MaterialCompositeKey
{
    public string SkuCode { get; }
    public string OwnershipType { get; }
    public string OwnerCode { get; }
    public string Value { get; }

    public MaterialCompositeKey(string skuCode, string? ownershipType, string? ownerCode)
    {
        SkuCode = (skuCode ?? string.Empty).Trim().ToUpperInvariant();
        OwnershipType = string.IsNullOrWhiteSpace(ownershipType)
            ? "SELF_PURCHASED"
            : ownershipType.Trim().ToUpperInvariant();
        OwnerCode = string.IsNullOrWhiteSpace(ownerCode)
            ? "SELF"
            : ownerCode.Trim().ToUpperInvariant();
        Value = $"{SkuCode}::{OwnershipType}::{OwnerCode}";
    }

    public override string ToString() => Value;
}
