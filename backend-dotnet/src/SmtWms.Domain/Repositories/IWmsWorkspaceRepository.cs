using SmtWms.Domain.Entities;

namespace SmtWms.Domain.Repositories;

public sealed class WmsWorkspaceSnapshot
{
    public required WmsWorkspace Workspace { get; set; }
    public List<WarehouseEntity> Warehouses { get; set; } = [];
    public List<WarehouseKeeperEntity> Keepers { get; set; } = [];
    public List<WarehouseBinEntity> Bins { get; set; } = [];
    public List<SupplierEntity> Suppliers { get; set; } = [];
    public List<CustomerEntity> Customers { get; set; } = [];
    public List<PackagingSpecEntity> PackagingSpecs { get; set; } = [];
    public List<BarcodeRuleEntity> BarcodeRules { get; set; } = [];
    public List<LabelTemplateEntity> LabelTemplates { get; set; } = [];
    public List<MaterialSkuEntity> Materials { get; set; } = [];
    public List<BomMasterEntity> Boms { get; set; } = [];
    public List<AsnOrderEntity> Asns { get; set; } = [];
    public List<ReelItemEntity> Reels { get; set; } = [];
    public List<WorkOrderEntity> WorkOrders { get; set; } = [];
    public List<WaveOrderEntity> Waves { get; set; } = [];
    public List<CycleCountTaskEntity> CycleCounts { get; set; } = [];
    public List<ScrapRecordEntity> ScrapRecords { get; set; } = [];
    public List<TraceEventEntity> TraceEvents { get; set; } = [];
}

public interface IWmsWorkspaceRepository
{
    Task<WmsWorkspaceSnapshot?> LoadAsync(string ownerUid, CancellationToken ct = default);
    Task SaveAsync(
        string ownerUid,
        WmsWorkspaceSnapshot snapshot,
        IReadOnlySet<string>? dirtySlices = null,
        CancellationToken ct = default);
}
