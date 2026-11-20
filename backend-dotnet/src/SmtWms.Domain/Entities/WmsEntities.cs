using SmtWms.Domain.Common;

namespace SmtWms.Domain.Entities;

public sealed class WmsWorkspace : AggregateRoot
{
    public string OwnerUid { get; set; } = string.Empty;
    public string? PrinterConfigJson { get; set; }
    public DateTime SeededAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}

public sealed class WarehouseEntity : Entity
{
    public string OwnerUid { get; set; } = string.Empty;
    public string WarehouseCode { get; set; } = string.Empty;
    public string WarehouseName { get; set; } = string.Empty;
    public string WarehouseType { get; set; } = string.Empty;
    public string ManagerId { get; set; } = string.Empty;
    public string ManagerName { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string Status { get; set; } = "ACTIVE";
    public string CreatedAt { get; set; } = string.Empty;
}

public sealed class WarehouseKeeperEntity : Entity
{
    public string OwnerUid { get; set; } = string.Empty;
    public string KeeperId { get; set; } = string.Empty;
    public string EmployeeNo { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string WarehouseCode { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Shift { get; set; } = string.Empty;
    public string Status { get; set; } = "ACTIVE";
}

public sealed class WarehouseBinEntity : Entity
{
    public string OwnerUid { get; set; } = string.Empty;
    public string BinCode { get; set; } = string.Empty;
    public string? WarehouseCode { get; set; }
    public string Zone { get; set; } = string.Empty;
    public int CapacityReels { get; set; }
    public string? KeeperName { get; set; }
    public string Description { get; set; } = string.Empty;
}

public sealed class SupplierEntity : Entity
{
    public string OwnerUid { get; set; } = string.Empty;
    public string SupplierCode { get; set; } = string.Empty;
    public string SupplierName { get; set; } = string.Empty;
    public string ContactName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string CategoryTags { get; set; } = string.Empty;
    public string QualityGrade { get; set; } = string.Empty;
    public int LeadTimeDays { get; set; }
    public string? Notes { get; set; }
}

public sealed class CustomerEntity : Entity
{
    public string OwnerUid { get; set; } = string.Empty;
    public string CustomerCode { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string ContactName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Industry { get; set; } = string.Empty;
    public string TraceRequirement { get; set; } = string.Empty;
    public string DeliveryAddress { get; set; } = string.Empty;
}

public sealed class PackagingSpecEntity : Entity
{
    public string OwnerUid { get; set; } = string.Empty;
    public string PackagingCode { get; set; } = string.Empty;
    public string PackagingName { get; set; } = string.Empty;
    public string CarrierType { get; set; } = "REEL";
    public string ReelDiameter { get; set; } = string.Empty;
    public double TapeWidthMm { get; set; }
    public double PitchMm { get; set; }
    public int DefaultSpq { get; set; }
    public bool AllowSplit { get; set; }
    public bool AllowMerge { get; set; }
    public string Description { get; set; } = string.Empty;
}

public sealed class BarcodeRuleEntity : Entity
{
    public string OwnerUid { get; set; } = string.Empty;
    public string RuleId { get; set; } = string.Empty;
    public string RuleName { get; set; } = string.Empty;
    public string SupplierCode { get; set; } = string.Empty;
    public string SupplierName { get; set; } = string.Empty;
    public string FormatType { get; set; } = "KEY_VALUE";
    public string Delimiter { get; set; } = "|";
    public string FieldMapJson { get; set; } = "{}";
    public string SampleBarcode { get; set; } = string.Empty;
    public bool Enabled { get; set; } = true;
}

public sealed class LabelTemplateEntity : Entity
{
    public string OwnerUid { get; set; } = string.Empty;
    public string TemplateId { get; set; } = string.Empty;
    public string TemplateName { get; set; } = string.Empty;
    public string PaperSize { get; set; } = "70x40mm";
    public double? CustomWidthMm { get; set; }
    public double? CustomHeightMm { get; set; }
    public int? Dpi { get; set; }
    public double? OffsetXMm { get; set; }
    public double? OffsetYMm { get; set; }
    public string? BarcodeType { get; set; }
    public string? ZplMode { get; set; }
    public string? ElementOrderJson { get; set; }
    public string? ElementLayoutsJson { get; set; }
    public string? FontScale { get; set; }
    public double? BarcodeHeightMm { get; set; }
    public string? CustomZpl { get; set; }
    public string HeaderTitle { get; set; } = string.Empty;
    public string FooterNote { get; set; } = string.Empty;
    public string ShowFieldsJson { get; set; } = "{}";
    public bool IsDefault { get; set; }
}

public sealed class MaterialSkuEntity : Entity
{
    public string OwnerUid { get; set; } = string.Empty;
    public string MaterialKey { get; set; } = string.Empty;
    public string SkuCode { get; set; } = string.Empty;
    public string Mpn { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? OwnershipType { get; set; }
    public string? OwnerCode { get; set; }
    public string? OwnerName { get; set; }
    public string? CustomerCode { get; set; }
    public string? CustomerName { get; set; }
    public string Manufacturer { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string PackageType { get; set; } = string.Empty;
    public string? PackagingCode { get; set; }
    public string? PackagingName { get; set; }
    public int? Mpq { get; set; }
    public string? SupplierCode { get; set; }
    public string? SupplierName { get; set; }
    public string Unit { get; set; } = "PCS";
    public string MsdLevel { get; set; } = "Level 1";
    public int SafetyStock { get; set; }
    public string DefaultBin { get; set; } = string.Empty;
}

public sealed class BomMasterEntity : Entity
{
    public string OwnerUid { get; set; } = string.Empty;
    public string BomId { get; set; } = string.Empty;
    public string ProductCode { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public string Version { get; set; } = string.Empty;
    public string? CustomerCode { get; set; }
    public string? CustomerName { get; set; }
    public string ProcessType { get; set; } = string.Empty;
    public string Status { get; set; } = "ACTIVE";
    public string ItemsJson { get; set; } = "[]";
    public string UpdatedAt { get; set; } = string.Empty;
}

public sealed class AsnOrderEntity : Entity
{
    public string OwnerUid { get; set; } = string.Empty;
    public string AsnNo { get; set; } = string.Empty;
    public string PoNo { get; set; } = string.Empty;
    public string SupplierCode { get; set; } = string.Empty;
    public string SupplierName { get; set; } = string.Empty;
    public string WarehouseCode { get; set; } = string.Empty;
    public string ExpectedDate { get; set; } = string.Empty;
    public string Purchaser { get; set; } = string.Empty;
    public string Source { get; set; } = "MANUAL";
    public string Status { get; set; } = "PENDING";
    public string? Notes { get; set; }
    public string LinesJson { get; set; } = "[]";
    public string CreatedAt { get; set; } = string.Empty;
}

public sealed class ReelItemEntity : AggregateRoot
{
    public string OwnerUid { get; set; } = string.Empty;
    public string ReelId { get; set; } = string.Empty;
    public string? ParentReelId { get; set; }
    public string? MaterialKey { get; set; }
    public string SkuCode { get; set; } = string.Empty;
    public string Mpn { get; set; } = string.Empty;
    public string LotNumber { get; set; } = string.Empty;
    public string DateCode { get; set; } = string.Empty;
    public string Supplier { get; set; } = string.Empty;
    public string? OwnershipType { get; set; }
    public string? OwnerCode { get; set; }
    public string? OwnerName { get; set; }
    public string? CustomerCode { get; set; }
    public string? CustomerName { get; set; }
    public string? PackagingCode { get; set; }
    public int? Mpq { get; set; }
    public string ReceiptDocNo { get; set; } = string.Empty;
    public string? AsnNo { get; set; }
    public int InitialQty { get; set; }
    public int Qty { get; set; }
    public int IssuedQty { get; set; }
    public string BinCode { get; set; } = string.Empty;
    public string MsdLevel { get; set; } = "Level 1";
    public string MsdState { get; set; } = "SEALED";
    public string? MsdOpenAt { get; set; }
    public string Status { get; set; } = "IN_STOCK";
    public string? WorkOrderId { get; set; }
    public string ReceivedAt { get; set; } = string.Empty;
    public string UpdatedAt { get; set; } = string.Empty;
}

public sealed class WorkOrderEntity : AggregateRoot
{
    public string OwnerUid { get; set; } = string.Empty;
    public string WorkOrderId { get; set; } = string.Empty;
    public string ProductCode { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public string? BomId { get; set; }
    public string? CustomerCode { get; set; }
    public string? CustomerName { get; set; }
    public string LineName { get; set; } = string.Empty;
    public int TargetQty { get; set; }
    public string Status { get; set; } = "PLANNED";
    public string? WaveId { get; set; }
    public string BomJson { get; set; } = "[]";
    public string IssuedBySkuJson { get; set; } = "{}";
    public string ReplenishedBySkuJson { get; set; } = "{}";
    public string ReturnedBySkuJson { get; set; } = "{}";
    public string CreatedAt { get; set; } = string.Empty;
}

public sealed class WaveOrderEntity : AggregateRoot
{
    public string OwnerUid { get; set; } = string.Empty;
    public string WaveId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string WorkOrderIdsJson { get; set; } = "[]";
    public string Status { get; set; } = "OPEN";
    public string AllocationsJson { get; set; } = "[]";
    public string CreatedAt { get; set; } = string.Empty;
    public string? CompletedAt { get; set; }
}

public sealed class CycleCountTaskEntity : Entity
{
    public string OwnerUid { get; set; } = string.Empty;
    public string CountId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string ZoneFilter { get; set; } = string.Empty;
    public string Status { get; set; } = "IN_PROGRESS";
    public string LinesJson { get; set; } = "[]";
    public string CreatedAt { get; set; } = string.Empty;
    public string? CompletedAt { get; set; }
}

public sealed class ScrapRecordEntity : Entity
{
    public string OwnerUid { get; set; } = string.Empty;
    public string ScrapId { get; set; } = string.Empty;
    public string Timestamp { get; set; } = string.Empty;
    public string ReelId { get; set; } = string.Empty;
    public string SkuCode { get; set; } = string.Empty;
    public string Mpn { get; set; } = string.Empty;
    public string LotNumber { get; set; } = string.Empty;
    public int Qty { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string Disposition { get; set; } = string.Empty;
    public string? WorkOrderId { get; set; }
    public string Operator { get; set; } = string.Empty;
}

public sealed class TraceEventEntity : Entity
{
    public string OwnerUid { get; set; } = string.Empty;
    public string EventId { get; set; } = string.Empty;
    public string Timestamp { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string ReelId { get; set; } = string.Empty;
    public string SkuCode { get; set; } = string.Empty;
    public string Mpn { get; set; } = string.Empty;
    public string LotNumber { get; set; } = string.Empty;
    public string DateCode { get; set; } = string.Empty;
    public int QtyDelta { get; set; }
    public int BalanceAfter { get; set; }
    public string? FromBin { get; set; }
    public string? ToBin { get; set; }
    public string? WorkOrderId { get; set; }
    public string? WaveId { get; set; }
    public string? LineOrStation { get; set; }
    public string DocNo { get; set; } = string.Empty;
    public string? Reason { get; set; }
    public string Operator { get; set; } = string.Empty;
}
