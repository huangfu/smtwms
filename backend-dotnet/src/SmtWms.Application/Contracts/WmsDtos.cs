using System.Text.Json;

namespace SmtWms.Application.Contracts;

public sealed class WmsStateDto
{
    public JsonElement? PrinterConfig { get; set; }
    public List<WarehouseDto> Warehouses { get; set; } = [];
    public List<WarehouseKeeperDto> Keepers { get; set; } = [];
    public List<SupplierDto> Suppliers { get; set; } = [];
    public List<CustomerDto> Customers { get; set; } = [];
    public List<PackagingSpecDto> PackagingSpecs { get; set; } = [];
    public List<BarcodeRuleDto> BarcodeRules { get; set; } = [];
    public List<LabelTemplateDto> LabelTemplates { get; set; } = [];
    public List<BomMasterDto> Boms { get; set; } = [];
    public List<AsnOrderDto> Asns { get; set; } = [];
    public List<MaterialSkuDto> Materials { get; set; } = [];
    public List<WarehouseBinDto> Bins { get; set; } = [];
    public List<ReelItemDto> Reels { get; set; } = [];
    public List<WorkOrderDto> WorkOrders { get; set; } = [];
    public List<WaveOrderDto> Waves { get; set; } = [];
    public List<CycleCountTaskDto> CycleCounts { get; set; } = [];
    public List<ScrapRecordDto> ScrapRecords { get; set; } = [];
    public List<TraceEventDto> TraceEvents { get; set; } = [];
}

public sealed class WarehouseDto
{
    public string WarehouseCode { get; set; } = string.Empty;
    public string WarehouseName { get; set; } = string.Empty;
    public string WarehouseType { get; set; } = string.Empty;
    public string ManagerId { get; set; } = string.Empty;
    public string ManagerName { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string Status { get; set; } = "ACTIVE";
    public string CreatedAt { get; set; } = string.Empty;
}

public sealed class WarehouseKeeperDto
{
    public string KeeperId { get; set; } = string.Empty;
    public string EmployeeNo { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string WarehouseCode { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Shift { get; set; } = string.Empty;
    public string Status { get; set; } = "ACTIVE";
}

public sealed class WarehouseBinDto
{
    public string BinCode { get; set; } = string.Empty;
    public string? WarehouseCode { get; set; }
    public string Zone { get; set; } = string.Empty;
    public int CapacityReels { get; set; }
    public string? KeeperName { get; set; }
    public string Description { get; set; } = string.Empty;
}

public sealed class SupplierDto
{
    public string SupplierCode { get; set; } = string.Empty;
    public string SupplierName { get; set; } = string.Empty;
    public string ContactName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string CategoryTags { get; set; } = string.Empty;
    public string QualityGrade { get; set; } = "A级免检";
    public int LeadTimeDays { get; set; }
    public string? Notes { get; set; }
}

public sealed class CustomerDto
{
    public string CustomerCode { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string ContactName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Industry { get; set; } = string.Empty;
    public string TraceRequirement { get; set; } = string.Empty;
    public string DeliveryAddress { get; set; } = string.Empty;
}

public sealed class PackagingSpecDto
{
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

public sealed class BarcodeRuleDto
{
    public string RuleId { get; set; } = string.Empty;
    public string RuleName { get; set; } = string.Empty;
    public string SupplierCode { get; set; } = string.Empty;
    public string SupplierName { get; set; } = string.Empty;
    public string FormatType { get; set; } = "KEY_VALUE";
    public string Delimiter { get; set; } = "|";
    public JsonElement FieldMap { get; set; }
    public string SampleBarcode { get; set; } = string.Empty;
    public bool Enabled { get; set; } = true;
}

public sealed class LabelTemplateDto
{
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
    public JsonElement? ElementOrder { get; set; }
    public JsonElement? ElementLayouts { get; set; }
    public string? FontScale { get; set; }
    public double? BarcodeHeightMm { get; set; }
    public string? CustomZpl { get; set; }
    public string HeaderTitle { get; set; } = string.Empty;
    public string FooterNote { get; set; } = string.Empty;
    public JsonElement ShowFields { get; set; }
    public bool IsDefault { get; set; }
}

public sealed class MaterialSkuDto
{
    public string? MaterialKey { get; set; }
    public string SkuCode { get; set; } = string.Empty;
    public string Mpn { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? OwnershipType { get; set; }
    public string? OwnerCode { get; set; }
    public string? OwnerName { get; set; }
    public string? CustomerCode { get; set; }
    public string? CustomerName { get; set; }
    public string Manufacturer { get; set; } = string.Empty;
    public string Category { get; set; } = "IC芯片";
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

public sealed class BomMasterDto
{
    public string BomId { get; set; } = string.Empty;
    public string ProductCode { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public string Version { get; set; } = string.Empty;
    public string? CustomerCode { get; set; }
    public string? CustomerName { get; set; }
    public string ProcessType { get; set; } = string.Empty;
    public string Status { get; set; } = "ACTIVE";
    public JsonElement Items { get; set; }
    public string UpdatedAt { get; set; } = string.Empty;
}

public sealed class AsnOrderDto
{
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
    public string CreatedAt { get; set; } = string.Empty;
    public JsonElement Lines { get; set; }
}

public sealed class ReelItemDto
{
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

public sealed class WorkOrderDto
{
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
    public JsonElement Bom { get; set; }
    public Dictionary<string, int> IssuedBySku { get; set; } = new();
    public Dictionary<string, int> ReplenishedBySku { get; set; } = new();
    public Dictionary<string, int> ReturnedBySku { get; set; } = new();
    public string CreatedAt { get; set; } = string.Empty;
}

public sealed class WaveOrderDto
{
    public string WaveId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public List<string> WorkOrderIds { get; set; } = [];
    public string Status { get; set; } = "OPEN";
    public JsonElement Allocations { get; set; }
    public string CreatedAt { get; set; } = string.Empty;
    public string? CompletedAt { get; set; }
}

public sealed class CycleCountTaskDto
{
    public string CountId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string ZoneFilter { get; set; } = string.Empty;
    public string Status { get; set; } = "IN_PROGRESS";
    public JsonElement Lines { get; set; }
    public string CreatedAt { get; set; } = string.Empty;
    public string? CompletedAt { get; set; }
}

public sealed class ScrapRecordDto
{
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

public sealed class TraceEventDto
{
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

// Command Requests matching React wmsApi.ts
public sealed record InboundCommand(
    string? MaterialKey,
    string SkuCode,
    string LotNumber,
    string DateCode,
    string Supplier,
    int Qty,
    string BinCode,
    string? ReceiptDocNo,
    string? AsnNo,
    string? AsnLineId,
    string? ReelId,
    string Operator,
    string? Reason);

public sealed record GeneralOutboundCommand(
    string ReelId,
    int Qty,
    string TargetDept,
    string Reason,
    string Operator);

public sealed record CreateWaveCommand(string Name, List<string> WorkOrderIds, string Operator);

public sealed record IssueWaveReelCommand(string ReelId, string Operator);

public sealed record ReplenishCommand(
    string WorkOrderId,
    string ReelId,
    int Qty,
    string Reason,
    string Station,
    string Operator);

public sealed record ProductionReturnCommand(
    string WorkOrderId,
    string ReelId,
    int ReturnQty,
    string ToBin,
    string Reason,
    string Operator,
    bool SplitChildReel = false);

public sealed record MsdBakeCommand(string ReelId, string Operator, string? OvenNotes);

public sealed record ScrapCommand(
    string ReelId,
    int Qty,
    string Reason,
    string Disposition,
    string? WorkOrderId,
    string Operator);

public sealed record CreateCycleCountCommand(string Title, string ZoneFilter);

public sealed record ReconcileCycleCountCommand(Dictionary<string, int> Counts, string Operator);

public sealed record UpdateMaterialCommand(string OriginalKey, MaterialSkuDto Material);

public sealed record DeleteMaterialCommand(string MaterialKey);

public sealed record ZebraTestRequest(string Host, int Port = 9100);

public sealed record ZebraPrintRequest(string Host, int Port, string Zpl);

public sealed record ImportAsnCsvCommand(
    string CsvText,
    string? WarehouseCode,
    string? Purchaser,
    string? Notes);
