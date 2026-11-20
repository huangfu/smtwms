using System.Data.Common;
using SmtWms.Domain.Common;
using SmtWms.Domain.Entities;
using SmtWms.Domain.Repositories;

namespace SmtWms.Infrastructure.Persistence;

/// <summary>
/// 基于 FreeSql IUnitOfWork 的多数据库仓储实现：
/// 在单事务内按变更切片（dirtySlices）原子持久化，兼容 SQLite / MSSQL / PostgreSQL / MySQL。
/// </summary>
public sealed class FreeSqlWmsWorkspaceRepository(IFreeSql fsql) : IWmsWorkspaceRepository
{
    public async Task<WmsWorkspaceSnapshot?> LoadAsync(string ownerUid, CancellationToken ct = default)
    {
        var workspace = await fsql.Select<WmsWorkspace>()
            .Where(x => x.OwnerUid == ownerUid)
            .FirstAsync(ct);

        if (workspace is null) return null;

        var snapshot = new WmsWorkspaceSnapshot
        {
            Workspace = workspace,
            Warehouses = await fsql.Select<WarehouseEntity>().Where(x => x.OwnerUid == ownerUid).OrderBy(x => x.Id).ToListAsync(ct),
            Keepers = await fsql.Select<WarehouseKeeperEntity>().Where(x => x.OwnerUid == ownerUid).OrderBy(x => x.Id).ToListAsync(ct),
            Bins = await fsql.Select<WarehouseBinEntity>().Where(x => x.OwnerUid == ownerUid).OrderBy(x => x.Id).ToListAsync(ct),
            Suppliers = await fsql.Select<SupplierEntity>().Where(x => x.OwnerUid == ownerUid).OrderBy(x => x.Id).ToListAsync(ct),
            Customers = await fsql.Select<CustomerEntity>().Where(x => x.OwnerUid == ownerUid).OrderBy(x => x.Id).ToListAsync(ct),
            PackagingSpecs = await fsql.Select<PackagingSpecEntity>().Where(x => x.OwnerUid == ownerUid).OrderBy(x => x.Id).ToListAsync(ct),
            BarcodeRules = await fsql.Select<BarcodeRuleEntity>().Where(x => x.OwnerUid == ownerUid).OrderBy(x => x.Id).ToListAsync(ct),
            LabelTemplates = await fsql.Select<LabelTemplateEntity>().Where(x => x.OwnerUid == ownerUid).OrderBy(x => x.Id).ToListAsync(ct),
            Materials = await fsql.Select<MaterialSkuEntity>().Where(x => x.OwnerUid == ownerUid).OrderBy(x => x.Id).ToListAsync(ct),
            Boms = await fsql.Select<BomMasterEntity>().Where(x => x.OwnerUid == ownerUid).OrderBy(x => x.Id).ToListAsync(ct),
            Asns = await fsql.Select<AsnOrderEntity>().Where(x => x.OwnerUid == ownerUid).OrderBy(x => x.Id).ToListAsync(ct),
            Reels = await fsql.Select<ReelItemEntity>().Where(x => x.OwnerUid == ownerUid).OrderBy(x => x.Id).ToListAsync(ct),
            WorkOrders = await fsql.Select<WorkOrderEntity>().Where(x => x.OwnerUid == ownerUid).OrderBy(x => x.Id).ToListAsync(ct),
            Waves = await fsql.Select<WaveOrderEntity>().Where(x => x.OwnerUid == ownerUid).OrderBy(x => x.Id).ToListAsync(ct),
            CycleCounts = await fsql.Select<CycleCountTaskEntity>().Where(x => x.OwnerUid == ownerUid).OrderBy(x => x.Id).ToListAsync(ct),
            ScrapRecords = await fsql.Select<ScrapRecordEntity>().Where(x => x.OwnerUid == ownerUid).OrderBy(x => x.Id).ToListAsync(ct),
            TraceEvents = await fsql.Select<TraceEventEntity>().Where(x => x.OwnerUid == ownerUid).OrderBy(x => x.Id).ToListAsync(ct),
        };

        return snapshot;
    }

    public async Task SaveAsync(
        string ownerUid,
        WmsWorkspaceSnapshot snapshot,
        IReadOnlySet<string>? dirtySlices = null,
        CancellationToken ct = default)
    {
        bool ShouldWrite(string slice) => dirtySlices is null || dirtySlices.Contains(slice);

        using var uow = fsql.CreateUnitOfWork();
        var tx = uow.GetOrBeginTransaction();

        var existingWorkspace = await fsql.Select<WmsWorkspace>()
            .WithTransaction(tx)
            .Where(x => x.OwnerUid == ownerUid)
            .FirstAsync(ct);

        if (existingWorkspace is null)
        {
            snapshot.Workspace.Id = 0;
            snapshot.Workspace.OwnerUid = ownerUid;
            await fsql.Insert(snapshot.Workspace).WithTransaction(tx).ExecuteAffrowsAsync(ct);
        }
        else if (ShouldWrite("Workspace"))
        {
            await fsql.Update<WmsWorkspace>()
                .WithTransaction(tx)
                .Set(x => x.PrinterConfigJson, snapshot.Workspace.PrinterConfigJson)
                .Set(x => x.UpdatedAtUtc, DateTime.UtcNow)
                .Where(x => x.OwnerUid == ownerUid)
                .ExecuteAffrowsAsync(ct);
        }
        else
        {
            await fsql.Update<WmsWorkspace>()
                .WithTransaction(tx)
                .Set(x => x.UpdatedAtUtc, DateTime.UtcNow)
                .Where(x => x.OwnerUid == ownerUid)
                .ExecuteAffrowsAsync(ct);
        }

        if (ShouldWrite("Warehouses")) await ReplaceSliceAsync(tx, ownerUid, x => x.OwnerUid == ownerUid, snapshot.Warehouses, ct);
        if (ShouldWrite("Keepers")) await ReplaceSliceAsync(tx, ownerUid, x => x.OwnerUid == ownerUid, snapshot.Keepers, ct);
        if (ShouldWrite("Bins")) await ReplaceSliceAsync(tx, ownerUid, x => x.OwnerUid == ownerUid, snapshot.Bins, ct);
        if (ShouldWrite("Suppliers")) await ReplaceSliceAsync(tx, ownerUid, x => x.OwnerUid == ownerUid, snapshot.Suppliers, ct);
        if (ShouldWrite("Customers")) await ReplaceSliceAsync(tx, ownerUid, x => x.OwnerUid == ownerUid, snapshot.Customers, ct);
        if (ShouldWrite("PackagingSpecs")) await ReplaceSliceAsync(tx, ownerUid, x => x.OwnerUid == ownerUid, snapshot.PackagingSpecs, ct);
        if (ShouldWrite("BarcodeRules")) await ReplaceSliceAsync(tx, ownerUid, x => x.OwnerUid == ownerUid, snapshot.BarcodeRules, ct);
        if (ShouldWrite("LabelTemplates")) await ReplaceSliceAsync(tx, ownerUid, x => x.OwnerUid == ownerUid, snapshot.LabelTemplates, ct);
        if (ShouldWrite("Materials")) await ReplaceSliceAsync(tx, ownerUid, x => x.OwnerUid == ownerUid, snapshot.Materials, ct);
        if (ShouldWrite("Boms")) await ReplaceSliceAsync(tx, ownerUid, x => x.OwnerUid == ownerUid, snapshot.Boms, ct);
        if (ShouldWrite("Asns")) await ReplaceSliceAsync(tx, ownerUid, x => x.OwnerUid == ownerUid, snapshot.Asns, ct);
        if (ShouldWrite("Reels")) await ReplaceSliceAsync(tx, ownerUid, x => x.OwnerUid == ownerUid, snapshot.Reels, ct);
        if (ShouldWrite("WorkOrders")) await ReplaceSliceAsync(tx, ownerUid, x => x.OwnerUid == ownerUid, snapshot.WorkOrders, ct);
        if (ShouldWrite("Waves")) await ReplaceSliceAsync(tx, ownerUid, x => x.OwnerUid == ownerUid, snapshot.Waves, ct);
        if (ShouldWrite("CycleCounts")) await ReplaceSliceAsync(tx, ownerUid, x => x.OwnerUid == ownerUid, snapshot.CycleCounts, ct);
        if (ShouldWrite("ScrapRecords")) await ReplaceSliceAsync(tx, ownerUid, x => x.OwnerUid == ownerUid, snapshot.ScrapRecords, ct);
        if (ShouldWrite("TraceEvents")) await ReplaceSliceAsync(tx, ownerUid, x => x.OwnerUid == ownerUid, snapshot.TraceEvents, ct);

        uow.Commit();
    }

    private async Task ReplaceSliceAsync<TEntity>(
        DbTransaction tx,
        string ownerUid,
        System.Linq.Expressions.Expression<Func<TEntity, bool>> ownerPredicate,
        List<TEntity> items,
        CancellationToken ct) where TEntity : Entity
    {
        await fsql.Delete<TEntity>()
            .WithTransaction(tx)
            .Where(ownerPredicate)
            .ExecuteAffrowsAsync(ct);

        if (items.Count == 0) return;

        // 重置自增主键，避免 MSSQL IDENTITY_INSERT 或 PostgreSQL SERIAL 冲突
        foreach (var item in items)
        {
            item.Id = 0;
        }

        await fsql.Insert(items)
            .WithTransaction(tx)
            .ExecuteAffrowsAsync(ct);
    }
}
