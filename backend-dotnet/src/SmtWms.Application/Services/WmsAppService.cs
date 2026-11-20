using System.Collections.Concurrent;
using System.Text.Json;
using SmtWms.Application.Contracts;
using SmtWms.Domain.Common;
using SmtWms.Domain.Entities;
using SmtWms.Domain.Repositories;
using SmtWms.Domain.ValueObjects;

namespace SmtWms.Application.Services;

/// <summary>
/// SMT-WMS 核心应用服务：封装全部仓储用例并保证按租户串行一致持久化。
/// </summary>
public sealed class WmsAppService(IWmsWorkspaceRepository repository)
{
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> UserLocks = new();
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    private static SemaphoreSlim GetLock(string ownerUid) =>
        UserLocks.GetOrAdd(ownerUid, _ => new SemaphoreSlim(1, 1));

    public async Task<WmsStateDto> GetStateAsync(string ownerUid, CancellationToken ct = default)
    {
        var gate = GetLock(ownerUid);
        await gate.WaitAsync(ct);
        try
        {
            var snapshot = await LoadOrSeedAsync(ownerUid, ct);
            return ToStateDto(snapshot);
        }
        finally
        {
            gate.Release();
        }
    }

    public async Task<WmsStateDto> ResetAsync(string ownerUid, CancellationToken ct = default)
    {
        var gate = GetLock(ownerUid);
        await gate.WaitAsync(ct);
        try
        {
            var seed = WmsSeedFactory.CreateInitialSnapshot(ownerUid);
            await repository.SaveAsync(ownerUid, seed, null, ct);
            return ToStateDto(seed);
        }
        finally
        {
            gate.Release();
        }
    }

    public async Task<ApiEnvelope<object>> InboundAsync(string ownerUid, InboundCommand cmd, CancellationToken ct = default)
    {
        return await MutateAsync<object>(ownerUid, ["Reels", "TraceEvents", "Asns"], snapshot =>
        {
            if (cmd.Qty <= 0) throw new DomainException("入库数量必须大于 0");
            if (string.IsNullOrWhiteSpace(cmd.DateCode) || cmd.DateCode.Trim().Length != 4)
                throw new DomainException("DateCode 必须为 4 位周期码 (YYWW)，例如 2645");

            var mat = snapshot.Materials.FirstOrDefault(m =>
                (!string.IsNullOrWhiteSpace(cmd.MaterialKey) && string.Equals(m.MaterialKey, cmd.MaterialKey, StringComparison.OrdinalIgnoreCase)) ||
                string.Equals(m.SkuCode, cmd.SkuCode, StringComparison.OrdinalIgnoreCase));

            if (mat is null) throw new DomainException($"未找到物料档案：{cmd.SkuCode}");

            var nowIso = DateTime.UtcNow.ToString("O");
            var reelId = string.IsNullOrWhiteSpace(cmd.ReelId)
                ? $"RL{DateTime.UtcNow:yyMMdd}-{Random.Shared.Next(100, 999)}"
                : cmd.ReelId.Trim().ToUpperInvariant();

            if (snapshot.Reels.Any(r => string.Equals(r.ReelId, reelId, StringComparison.OrdinalIgnoreCase)))
                throw new DomainException($"料盘 UID \"{reelId}\" 已存在，请勿重复赋码入库");

            var docNo = string.IsNullOrWhiteSpace(cmd.ReceiptDocNo)
                ? $"RCV-{DateTime.UtcNow:yyyyMMddHHmmss}"
                : cmd.ReceiptDocNo.Trim();

            var reel = new ReelItemEntity
            {
                OwnerUid = ownerUid,
                ReelId = reelId,
                MaterialKey = mat.MaterialKey,
                SkuCode = mat.SkuCode,
                Mpn = mat.Mpn,
                LotNumber = cmd.LotNumber.Trim(),
                DateCode = cmd.DateCode.Trim(),
                Supplier = string.IsNullOrWhiteSpace(cmd.Supplier) ? (mat.SupplierName ?? "默认供应商") : cmd.Supplier.Trim(),
                OwnershipType = mat.OwnershipType,
                OwnerCode = mat.OwnerCode,
                OwnerName = mat.OwnerName,
                CustomerCode = mat.CustomerCode,
                CustomerName = mat.CustomerName,
                PackagingCode = mat.PackagingCode,
                Mpq = mat.Mpq,
                ReceiptDocNo = docNo,
                AsnNo = cmd.AsnNo,
                InitialQty = cmd.Qty,
                Qty = cmd.Qty,
                IssuedQty = 0,
                BinCode = string.IsNullOrWhiteSpace(cmd.BinCode) ? mat.DefaultBin : cmd.BinCode.Trim(),
                MsdLevel = mat.MsdLevel,
                MsdState = "SEALED",
                Status = "IN_STOCK",
                ReceivedAt = nowIso,
                UpdatedAt = nowIso,
            };

            var evt = new TraceEventEntity
            {
                OwnerUid = ownerUid,
                EventId = $"EVT-{Guid.NewGuid().ToString("N")[..8].ToUpperInvariant()}",
                Timestamp = nowIso,
                Action = "INBOUND",
                ReelId = reel.ReelId,
                SkuCode = reel.SkuCode,
                Mpn = reel.Mpn,
                LotNumber = reel.LotNumber,
                DateCode = reel.DateCode,
                QtyDelta = cmd.Qty,
                BalanceAfter = cmd.Qty,
                ToBin = reel.BinCode,
                DocNo = docNo,
                Reason = cmd.Reason ?? "标准扫码收料入库",
                Operator = string.IsNullOrWhiteSpace(cmd.Operator) ? "仓管员" : cmd.Operator.Trim(),
            };

            snapshot.Reels.Insert(0, reel);
            snapshot.TraceEvents.Insert(0, evt);
            return new { reel = MapReel(reel), @event = MapTrace(evt) };
        }, ct);
    }

    public async Task<ApiEnvelope<object>> GeneralOutboundAsync(string ownerUid, GeneralOutboundCommand cmd, CancellationToken ct = default)
    {
        return await MutateAsync<object>(ownerUid, ["Reels", "TraceEvents"], snapshot =>
        {
            if (cmd.Qty <= 0) throw new DomainException("出库数量必须大于 0");
            var reel = snapshot.Reels.FirstOrDefault(r => string.Equals(r.ReelId, cmd.ReelId, StringComparison.OrdinalIgnoreCase))
                ?? throw new DomainException($"未找到料盘：{cmd.ReelId}");

            if (reel.Status is "SCRAPPED" or "DEPLETED")
                throw new DomainException($"料盘 {reel.ReelId} 当前状态为 {reel.Status}，不可出库");
            if (MsdFloorLifePolicy.IsBakingRequired(reel.MsdLevel, reel.MsdState, reel.MsdOpenAt))
                throw new DomainException($"料盘 {reel.ReelId} 湿敏超时需烘烤，严禁直接发料");
            if (cmd.Qty > reel.Qty)
                throw new DomainException($"出库数量 ({cmd.Qty}) 超过当前库存余额 ({reel.Qty})");

            var nowIso = DateTime.UtcNow.ToString("O");
            var fromBin = reel.BinCode;
            reel.Qty -= cmd.Qty;
            reel.IssuedQty += cmd.Qty;
            reel.Status = reel.Qty == 0 ? "DEPLETED" : reel.Status;
            reel.UpdatedAt = nowIso;

            var evt = new TraceEventEntity
            {
                OwnerUid = ownerUid,
                EventId = $"EVT-{Guid.NewGuid().ToString("N")[..8].ToUpperInvariant()}",
                Timestamp = nowIso,
                Action = "GENERAL_OUTBOUND",
                ReelId = reel.ReelId,
                SkuCode = reel.SkuCode,
                Mpn = reel.Mpn,
                LotNumber = reel.LotNumber,
                DateCode = reel.DateCode,
                QtyDelta = -cmd.Qty,
                BalanceAfter = reel.Qty,
                FromBin = fromBin,
                LineOrStation = cmd.TargetDept,
                DocNo = $"OUT-{DateTime.UtcNow:yyyyMMddHHmmss}",
                Reason = cmd.Reason,
                Operator = cmd.Operator,
            };
            snapshot.TraceEvents.Insert(0, evt);
            return new { reel = MapReel(reel), @event = MapTrace(evt) };
        }, ct);
    }

    public async Task<ApiEnvelope<object>> BakeMsdAsync(string ownerUid, MsdBakeCommand cmd, CancellationToken ct = default)
    {
        return await MutateAsync<object>(ownerUid, ["Reels", "TraceEvents"], snapshot =>
        {
            var reel = snapshot.Reels.FirstOrDefault(r => string.Equals(r.ReelId, cmd.ReelId, StringComparison.OrdinalIgnoreCase))
                ?? throw new DomainException($"未找到料盘：{cmd.ReelId}");

            var nowIso = DateTime.UtcNow.ToString("O");
            reel.MsdState = "SEALED";
            reel.MsdOpenAt = null;
            reel.UpdatedAt = nowIso;

            var evt = new TraceEventEntity
            {
                OwnerUid = ownerUid,
                EventId = $"EVT-{Guid.NewGuid().ToString("N")[..8].ToUpperInvariant()}",
                Timestamp = nowIso,
                Action = "MSD_BAKE",
                ReelId = reel.ReelId,
                SkuCode = reel.SkuCode,
                Mpn = reel.Mpn,
                LotNumber = reel.LotNumber,
                DateCode = reel.DateCode,
                QtyDelta = 0,
                BalanceAfter = reel.Qty,
                FromBin = reel.BinCode,
                ToBin = reel.BinCode,
                DocNo = $"BAKE-{DateTime.UtcNow:yyyyMMddHHmmss}",
                Reason = string.IsNullOrWhiteSpace(cmd.OvenNotes) ? "125℃烘烤复位完成" : cmd.OvenNotes,
                Operator = cmd.Operator,
            };
            snapshot.TraceEvents.Insert(0, evt);
            return new { reel = MapReel(reel), @event = MapTrace(evt) };
        }, ct);
    }

    public async Task<ApiEnvelope<object>> ScrapAsync(string ownerUid, ScrapCommand cmd, CancellationToken ct = default)
    {
        return await MutateAsync<object>(ownerUid, ["Reels", "ScrapRecords", "TraceEvents"], snapshot =>
        {
            if (cmd.Qty <= 0) throw new DomainException("报废数量必须大于 0");
            var reel = snapshot.Reels.FirstOrDefault(r => string.Equals(r.ReelId, cmd.ReelId, StringComparison.OrdinalIgnoreCase))
                ?? throw new DomainException($"未找到料盘：{cmd.ReelId}");
            if (cmd.Qty > reel.Qty)
                throw new DomainException($"报废数量 ({cmd.Qty}) 超过当前余额 ({reel.Qty})");

            var nowIso = DateTime.UtcNow.ToString("O");
            reel.Qty -= cmd.Qty;
            if (reel.Qty == 0) reel.Status = "SCRAPPED";
            reel.UpdatedAt = nowIso;

            var scrap = new ScrapRecordEntity
            {
                OwnerUid = ownerUid,
                ScrapId = $"SCR-{DateTime.UtcNow:yyyyMMddHHmmss}",
                Timestamp = nowIso,
                ReelId = reel.ReelId,
                SkuCode = reel.SkuCode,
                Mpn = reel.Mpn,
                LotNumber = reel.LotNumber,
                Qty = cmd.Qty,
                Reason = cmd.Reason,
                Disposition = cmd.Disposition,
                WorkOrderId = cmd.WorkOrderId,
                Operator = cmd.Operator,
            };

            var evt = new TraceEventEntity
            {
                OwnerUid = ownerUid,
                EventId = $"EVT-{Guid.NewGuid().ToString("N")[..8].ToUpperInvariant()}",
                Timestamp = nowIso,
                Action = "SCRAP",
                ReelId = reel.ReelId,
                SkuCode = reel.SkuCode,
                Mpn = reel.Mpn,
                LotNumber = reel.LotNumber,
                DateCode = reel.DateCode,
                QtyDelta = -cmd.Qty,
                BalanceAfter = reel.Qty,
                FromBin = reel.BinCode,
                WorkOrderId = cmd.WorkOrderId,
                DocNo = scrap.ScrapId,
                Reason = $"{cmd.Reason} ({cmd.Disposition})",
                Operator = cmd.Operator,
            };

            snapshot.ScrapRecords.Insert(0, scrap);
            snapshot.TraceEvents.Insert(0, evt);
            return new { scrap = MapScrap(scrap), @event = MapTrace(evt) };
        }, ct);
    }

    public async Task<ApiEnvelope<object>> SaveMaterialAsync(string ownerUid, MaterialSkuDto dto, string? originalKey, CancellationToken ct = default)
    {
        return await MutateAsync<object>(ownerUid, ["Materials"], snapshot =>
        {
            var mpn = (dto.Mpn ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(mpn)) throw new DomainException("原厂型号 MPN 不能为空");
            var skuCode = string.IsNullOrWhiteSpace(dto.SkuCode) ? mpn : dto.SkuCode.Trim();
            var key = new MaterialCompositeKey(skuCode, dto.OwnershipType, dto.OwnerCode);

            if (originalKey is null)
            {
                if (snapshot.Materials.Any(m => string.Equals(m.MaterialKey, key.Value, StringComparison.OrdinalIgnoreCase)))
                    throw new DomainException($"物料主键 \"{key.Value}\" 已存在");
                var entity = MapMaterialToEntity(ownerUid, dto, skuCode, key);
                snapshot.Materials.Add(entity);
                return new { material = MapMaterial(entity) };
            }

            var target = snapshot.Materials.FirstOrDefault(m => string.Equals(m.MaterialKey, originalKey, StringComparison.OrdinalIgnoreCase))
                ?? throw new DomainException($"未找到原物料：{originalKey}");

            if (!string.Equals(originalKey, key.Value, StringComparison.OrdinalIgnoreCase) &&
                snapshot.Materials.Any(m => string.Equals(m.MaterialKey, key.Value, StringComparison.OrdinalIgnoreCase)))
                throw new DomainException($"目标物料主键 \"{key.Value}\" 已存在");

            var updated = MapMaterialToEntity(ownerUid, dto, skuCode, key);
            var idx = snapshot.Materials.IndexOf(target);
            snapshot.Materials[idx] = updated;
            return new { material = MapMaterial(updated) };
        }, ct);
    }

    public async Task<ApiEnvelope<object>> DeleteMaterialAsync(string ownerUid, string materialKey, CancellationToken ct = default)
    {
        return await MutateAsync<object>(ownerUid, ["Materials"], snapshot =>
        {
            var target = snapshot.Materials.FirstOrDefault(m => string.Equals(m.MaterialKey, materialKey, StringComparison.OrdinalIgnoreCase))
                ?? throw new DomainException($"未找到物料：{materialKey}");

            if (snapshot.Reels.Any(r => string.Equals(r.MaterialKey, materialKey, StringComparison.OrdinalIgnoreCase) && r.Qty > 0))
                throw new DomainException("该物料存在在库料盘库存，无法删除");

            snapshot.Materials.Remove(target);
            return new { deleted = materialKey };
        }, ct);
    }

    public async Task<ApiEnvelope<object>> SaveLabelTemplateAsync(string ownerUid, LabelTemplateDto dto, CancellationToken ct = default)
    {
        return await MutateAsync<object>(ownerUid, ["LabelTemplates"], snapshot =>
        {
            if (string.IsNullOrWhiteSpace(dto.TemplateName))
                throw new DomainException("标签模板名称不能为空");

            var templateId = string.IsNullOrWhiteSpace(dto.TemplateId)
                ? $"TPL-{snapshot.LabelTemplates.Count + 1:D3}"
                : dto.TemplateId.Trim();

            if (dto.IsDefault)
            {
                foreach (var t in snapshot.LabelTemplates) t.IsDefault = false;
            }

            var entity = new LabelTemplateEntity
            {
                OwnerUid = ownerUid,
                TemplateId = templateId,
                TemplateName = dto.TemplateName.Trim(),
                PaperSize = dto.PaperSize,
                CustomWidthMm = dto.CustomWidthMm,
                CustomHeightMm = dto.CustomHeightMm,
                Dpi = dto.Dpi is >= 150 and <= 600 ? dto.Dpi : 203,
                OffsetXMm = dto.OffsetXMm ?? 0,
                OffsetYMm = dto.OffsetYMm ?? 0,
                BarcodeType = dto.BarcodeType ?? "CODE128",
                ZplMode = dto.ZplMode ?? "VISUAL",
                ElementOrderJson = dto.ElementOrder?.GetRawText(),
                ElementLayoutsJson = dto.ElementLayouts?.GetRawText(),
                FontScale = dto.FontScale ?? "STANDARD",
                BarcodeHeightMm = dto.BarcodeHeightMm ?? 10,
                CustomZpl = dto.CustomZpl,
                HeaderTitle = dto.HeaderTitle ?? string.Empty,
                FooterNote = dto.FooterNote ?? string.Empty,
                ShowFieldsJson = dto.ShowFields.ValueKind == JsonValueKind.Undefined ? "{}" : dto.ShowFields.GetRawText(),
                IsDefault = dto.IsDefault,
            };

            var idx = snapshot.LabelTemplates.FindIndex(t => string.Equals(t.TemplateId, templateId, StringComparison.OrdinalIgnoreCase));
            if (idx >= 0) snapshot.LabelTemplates[idx] = entity;
            else snapshot.LabelTemplates.Add(entity);

            return new { template = MapLabelTemplate(entity) };
        }, ct);
    }

    public async Task<ApiEnvelope<object>> DeleteLabelTemplateAsync(string ownerUid, string templateId, CancellationToken ct = default)
    {
        return await MutateAsync<object>(ownerUid, ["LabelTemplates"], snapshot =>
        {
            if (snapshot.LabelTemplates.Count <= 1)
                throw new DomainException("至少保留一个标签模板");
            var removed = snapshot.LabelTemplates.RemoveAll(t => string.Equals(t.TemplateId, templateId, StringComparison.OrdinalIgnoreCase));
            if (removed == 0) throw new DomainException($"未找到标签模板：{templateId}");
            if (!snapshot.LabelTemplates.Any(t => t.IsDefault))
                snapshot.LabelTemplates[0].IsDefault = true;
            return new { deleted = templateId };
        }, ct);
    }

    public async Task<ApiEnvelope<object>> SavePrinterConfigAsync(string ownerUid, JsonElement cfg, CancellationToken ct = default)
    {
        return await MutateAsync<object>(ownerUid, ["Workspace"], snapshot =>
        {
            snapshot.Workspace.PrinterConfigJson = cfg.GetRawText();
            snapshot.Workspace.UpdatedAtUtc = DateTime.UtcNow;
            return new { printerConfig = cfg };
        }, ct);
    }

    public async Task<ApiEnvelope<object>> UpsertWarehouseAsync(string ownerUid, WarehouseDto dto, string? codeForUpdate, CancellationToken ct = default)
    {
        return await MutateAsync<object>(ownerUid, ["Warehouses"], snapshot =>
        {
            var code = (codeForUpdate ?? dto.WarehouseCode).Trim().ToUpperInvariant();
            if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(dto.WarehouseName))
                throw new DomainException("仓库编码与仓库名称不能为空");

            var entity = new WarehouseEntity
            {
                OwnerUid = ownerUid,
                WarehouseCode = code,
                WarehouseName = dto.WarehouseName.Trim(),
                WarehouseType = dto.WarehouseType,
                ManagerId = dto.ManagerId,
                ManagerName = string.IsNullOrWhiteSpace(dto.ManagerName)
                    ? snapshot.Keepers.FirstOrDefault(k => k.KeeperId == dto.ManagerId)?.Name ?? dto.ManagerId
                    : dto.ManagerName,
                Address = dto.Address,
                Status = string.IsNullOrWhiteSpace(dto.Status) ? "ACTIVE" : dto.Status,
                CreatedAt = string.IsNullOrWhiteSpace(dto.CreatedAt) ? DateTime.UtcNow.ToString("O") : dto.CreatedAt,
            };

            var idx = snapshot.Warehouses.FindIndex(w => string.Equals(w.WarehouseCode, code, StringComparison.OrdinalIgnoreCase));
            if (codeForUpdate is null && idx >= 0) throw new DomainException($"仓库编码 {code} 已存在");
            if (idx >= 0) snapshot.Warehouses[idx] = entity;
            else snapshot.Warehouses.Add(entity);

            return new { warehouse = MapWarehouse(entity) };
        }, ct);
    }

    public async Task<ApiEnvelope<object>> DeleteWarehouseAsync(string ownerUid, string code, CancellationToken ct = default)
    {
        return await MutateAsync<object>(ownerUid, ["Warehouses"], snapshot =>
        {
            if (snapshot.Bins.Any(b => string.Equals(b.WarehouseCode, code, StringComparison.OrdinalIgnoreCase)))
                throw new DomainException("该仓库下仍有关联库位，请先清理库位后再删除");
            var removed = snapshot.Warehouses.RemoveAll(w => string.Equals(w.WarehouseCode, code, StringComparison.OrdinalIgnoreCase));
            if (removed == 0) throw new DomainException($"未找到仓库：{code}");
            return new { deleted = code };
        }, ct);
    }

    public async Task<ApiEnvelope<object>> UpsertSupplierAsync(string ownerUid, SupplierDto dto, string? codeForUpdate, CancellationToken ct = default)
    {
        return await MutateAsync<object>(ownerUid, ["Suppliers"], snapshot =>
        {
            var code = (codeForUpdate ?? dto.SupplierCode).Trim().ToUpperInvariant();
            if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(dto.SupplierName))
                throw new DomainException("供应商编码与名称不能为空");

            var entity = new SupplierEntity
            {
                OwnerUid = ownerUid,
                SupplierCode = code,
                SupplierName = dto.SupplierName.Trim(),
                ContactName = dto.ContactName,
                Phone = dto.Phone,
                CategoryTags = dto.CategoryTags,
                QualityGrade = dto.QualityGrade,
                LeadTimeDays = dto.LeadTimeDays,
                Notes = dto.Notes,
            };

            var idx = snapshot.Suppliers.FindIndex(s => string.Equals(s.SupplierCode, code, StringComparison.OrdinalIgnoreCase));
            if (codeForUpdate is null && idx >= 0) throw new DomainException($"供应商编码 {code} 已存在");
            if (idx >= 0) snapshot.Suppliers[idx] = entity;
            else snapshot.Suppliers.Add(entity);

            return new { supplier = MapSupplier(entity) };
        }, ct);
    }

    public async Task<ApiEnvelope<object>> DeleteSupplierAsync(string ownerUid, string code, CancellationToken ct = default)
    {
        return await MutateAsync<object>(ownerUid, ["Suppliers"], snapshot =>
        {
            var removed = snapshot.Suppliers.RemoveAll(s => string.Equals(s.SupplierCode, code, StringComparison.OrdinalIgnoreCase));
            if (removed == 0) throw new DomainException($"未找到供应商：{code}");
            return new { deleted = code };
        }, ct);
    }

    public async Task<ApiEnvelope<object>> UpsertCustomerAsync(string ownerUid, CustomerDto dto, string? codeForUpdate, CancellationToken ct = default)
    {
        return await MutateAsync<object>(ownerUid, ["Customers"], snapshot =>
        {
            var code = (codeForUpdate ?? dto.CustomerCode).Trim().ToUpperInvariant();
            if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(dto.CustomerName))
                throw new DomainException("客户编码与名称不能为空");

            var entity = new CustomerEntity
            {
                OwnerUid = ownerUid,
                CustomerCode = code,
                CustomerName = dto.CustomerName.Trim(),
                ContactName = dto.ContactName,
                Phone = dto.Phone,
                Industry = dto.Industry,
                TraceRequirement = dto.TraceRequirement,
                DeliveryAddress = dto.DeliveryAddress,
            };

            var idx = snapshot.Customers.FindIndex(c => string.Equals(c.CustomerCode, code, StringComparison.OrdinalIgnoreCase));
            if (codeForUpdate is null && idx >= 0) throw new DomainException($"客户编码 {code} 已存在");
            if (idx >= 0) snapshot.Customers[idx] = entity;
            else snapshot.Customers.Add(entity);

            return new { customer = MapCustomer(entity) };
        }, ct);
    }

    public async Task<ApiEnvelope<object>> DeleteCustomerAsync(string ownerUid, string code, CancellationToken ct = default)
    {
        return await MutateAsync<object>(ownerUid, ["Customers"], snapshot =>
        {
            var removed = snapshot.Customers.RemoveAll(c => string.Equals(c.CustomerCode, code, StringComparison.OrdinalIgnoreCase));
            if (removed == 0) throw new DomainException($"未找到客户：{code}");
            return new { deleted = code };
        }, ct);
    }

    public async Task<ApiEnvelope<object>> SaveBomAsync(string ownerUid, BomMasterDto dto, CancellationToken ct = default)
    {
        return await MutateAsync<object>(ownerUid, ["Boms"], snapshot =>
        {
            if (string.IsNullOrWhiteSpace(dto.ProductCode) || string.IsNullOrWhiteSpace(dto.ProductName))
                throw new DomainException("机型料号与名称不能为空");

            var bomId = string.IsNullOrWhiteSpace(dto.BomId)
                ? $"BOM-{dto.ProductCode.Trim().ToUpperInvariant()}-{dto.Version.Trim()}"
                : dto.BomId.Trim();

            var entity = new BomMasterEntity
            {
                OwnerUid = ownerUid,
                BomId = bomId,
                ProductCode = dto.ProductCode.Trim().ToUpperInvariant(),
                ProductName = dto.ProductName.Trim(),
                Version = dto.Version.Trim(),
                CustomerCode = dto.CustomerCode,
                CustomerName = dto.CustomerName ?? snapshot.Customers.FirstOrDefault(c => c.CustomerCode == dto.CustomerCode)?.CustomerName,
                ProcessType = dto.ProcessType,
                Status = string.IsNullOrWhiteSpace(dto.Status) ? "ACTIVE" : dto.Status,
                ItemsJson = dto.Items.ValueKind == JsonValueKind.Undefined ? "[]" : dto.Items.GetRawText(),
                UpdatedAt = DateTime.UtcNow.ToString("O"),
            };

            var idx = snapshot.Boms.FindIndex(b => string.Equals(b.BomId, bomId, StringComparison.OrdinalIgnoreCase));
            if (idx >= 0) snapshot.Boms[idx] = entity;
            else snapshot.Boms.Add(entity);

            return new { bom = MapBom(entity) };
        }, ct);
    }

    public async Task<ApiEnvelope<object>> DeleteBomAsync(string ownerUid, string bomId, CancellationToken ct = default)
    {
        return await MutateAsync<object>(ownerUid, ["Boms"], snapshot =>
        {
            var removed = snapshot.Boms.RemoveAll(b => string.Equals(b.BomId, bomId, StringComparison.OrdinalIgnoreCase));
            if (removed == 0) throw new DomainException($"未找到 BOM：{bomId}");
            return new { deleted = bomId };
        }, ct);
    }

    public async Task<ApiEnvelope<object>> UpsertBinAsync(string ownerUid, WarehouseBinDto dto, string? codeForUpdate, CancellationToken ct = default)
    {
        return await MutateAsync<object>(ownerUid, ["Bins"], snapshot =>
        {
            var code = (codeForUpdate ?? dto.BinCode).Trim().ToUpperInvariant();
            if (string.IsNullOrWhiteSpace(code)) throw new DomainException("库位编码不能为空");

            var entity = new WarehouseBinEntity
            {
                OwnerUid = ownerUid,
                BinCode = code,
                WarehouseCode = dto.WarehouseCode,
                Zone = dto.Zone,
                CapacityReels = dto.CapacityReels,
                KeeperName = dto.KeeperName,
                Description = dto.Description,
            };

            var idx = snapshot.Bins.FindIndex(b => string.Equals(b.BinCode, code, StringComparison.OrdinalIgnoreCase));
            if (codeForUpdate is null && idx >= 0) throw new DomainException($"库位编码 {code} 已存在");
            if (idx >= 0) snapshot.Bins[idx] = entity;
            else snapshot.Bins.Add(entity);

            return new { bin = new WarehouseBinDto
            {
                BinCode = entity.BinCode,
                WarehouseCode = entity.WarehouseCode,
                Zone = entity.Zone,
                CapacityReels = entity.CapacityReels,
                KeeperName = entity.KeeperName,
                Description = entity.Description,
            } };
        }, ct);
    }

    public async Task<ApiEnvelope<object>> DeleteBinAsync(string ownerUid, string binCode, CancellationToken ct = default)
    {
        return await MutateAsync<object>(ownerUid, ["Bins"], snapshot =>
        {
            if (snapshot.Reels.Any(r => string.Equals(r.BinCode, binCode, StringComparison.OrdinalIgnoreCase) && r.Qty > 0))
                throw new DomainException($"库位 {binCode} 仍有在库料盘，无法删除");
            var removed = snapshot.Bins.RemoveAll(b => string.Equals(b.BinCode, binCode, StringComparison.OrdinalIgnoreCase));
            if (removed == 0) throw new DomainException($"未找到库位：{binCode}");
            return new { deleted = binCode };
        }, ct);
    }

    public async Task<ApiEnvelope<object>> UpsertKeeperAsync(string ownerUid, WarehouseKeeperDto dto, string? idForUpdate, CancellationToken ct = default)
    {
        return await MutateAsync<object>(ownerUid, ["Keepers"], snapshot =>
        {
            if (string.IsNullOrWhiteSpace(dto.Name)) throw new DomainException("仓管员姓名不能为空");
            var keeperId = string.IsNullOrWhiteSpace(idForUpdate ?? dto.KeeperId)
                ? $"KP-{snapshot.Keepers.Count + 1:D3}"
                : (idForUpdate ?? dto.KeeperId).Trim();

            var entity = new WarehouseKeeperEntity
            {
                OwnerUid = ownerUid,
                KeeperId = keeperId,
                EmployeeNo = dto.EmployeeNo,
                Name = dto.Name.Trim(),
                Role = dto.Role,
                WarehouseCode = dto.WarehouseCode,
                Phone = dto.Phone,
                Shift = dto.Shift,
                Status = string.IsNullOrWhiteSpace(dto.Status) ? "ACTIVE" : dto.Status,
            };

            var idx = snapshot.Keepers.FindIndex(k => string.Equals(k.KeeperId, keeperId, StringComparison.OrdinalIgnoreCase));
            if (idForUpdate is null && idx >= 0) throw new DomainException($"仓管员编号 {keeperId} 已存在");
            if (idx >= 0) snapshot.Keepers[idx] = entity;
            else snapshot.Keepers.Add(entity);

            return new { keeper = entity };
        }, ct);
    }

    public async Task<ApiEnvelope<object>> DeleteKeeperAsync(string ownerUid, string keeperId, CancellationToken ct = default)
    {
        return await MutateAsync<object>(ownerUid, ["Keepers"], snapshot =>
        {
            var removed = snapshot.Keepers.RemoveAll(k => string.Equals(k.KeeperId, keeperId, StringComparison.OrdinalIgnoreCase));
            if (removed == 0) throw new DomainException($"未找到仓管员：{keeperId}");
            return new { deleted = keeperId };
        }, ct);
    }

    public async Task<ApiEnvelope<object>> UpsertPackagingSpecAsync(string ownerUid, PackagingSpecDto dto, string? codeForUpdate, CancellationToken ct = default)
    {
        return await MutateAsync<object>(ownerUid, ["PackagingSpecs"], snapshot =>
        {
            var code = (codeForUpdate ?? dto.PackagingCode).Trim().ToUpperInvariant();
            if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(dto.PackagingName))
                throw new DomainException("包装方式编码与名称不能为空");

            var entity = new PackagingSpecEntity
            {
                OwnerUid = ownerUid,
                PackagingCode = code,
                PackagingName = dto.PackagingName.Trim(),
                CarrierType = dto.CarrierType,
                ReelDiameter = dto.ReelDiameter,
                TapeWidthMm = dto.TapeWidthMm,
                PitchMm = dto.PitchMm,
                DefaultSpq = dto.DefaultSpq,
                AllowSplit = dto.AllowSplit,
                AllowMerge = dto.AllowMerge,
                Description = dto.Description,
            };

            var idx = snapshot.PackagingSpecs.FindIndex(p => string.Equals(p.PackagingCode, code, StringComparison.OrdinalIgnoreCase));
            if (codeForUpdate is null && idx >= 0) throw new DomainException($"包装方式编码 {code} 已存在");
            if (idx >= 0) snapshot.PackagingSpecs[idx] = entity;
            else snapshot.PackagingSpecs.Add(entity);

            return new { spec = dto };
        }, ct);
    }

    public async Task<ApiEnvelope<object>> DeletePackagingSpecAsync(string ownerUid, string code, CancellationToken ct = default)
    {
        return await MutateAsync<object>(ownerUid, ["PackagingSpecs"], snapshot =>
        {
            var removed = snapshot.PackagingSpecs.RemoveAll(p => string.Equals(p.PackagingCode, code, StringComparison.OrdinalIgnoreCase));
            if (removed == 0) throw new DomainException($"未找到包装方式：{code}");
            return new { deleted = code };
        }, ct);
    }

    public async Task<ApiEnvelope<object>> SaveBarcodeRuleAsync(string ownerUid, BarcodeRuleDto dto, CancellationToken ct = default)
    {
        return await MutateAsync<object>(ownerUid, ["BarcodeRules"], snapshot =>
        {
            if (string.IsNullOrWhiteSpace(dto.RuleName)) throw new DomainException("条码规则名称不能为空");
            var ruleId = string.IsNullOrWhiteSpace(dto.RuleId)
                ? $"BR-{snapshot.BarcodeRules.Count + 1:D3}"
                : dto.RuleId.Trim();

            var supplierName = string.IsNullOrWhiteSpace(dto.SupplierName)
                ? snapshot.Suppliers.FirstOrDefault(s => s.SupplierCode == dto.SupplierCode)?.SupplierName ?? dto.SupplierCode
                : dto.SupplierName;

            var entity = new BarcodeRuleEntity
            {
                OwnerUid = ownerUid,
                RuleId = ruleId,
                RuleName = dto.RuleName.Trim(),
                SupplierCode = dto.SupplierCode,
                SupplierName = supplierName,
                FormatType = dto.FormatType,
                Delimiter = dto.Delimiter,
                FieldMapJson = dto.FieldMap.ValueKind == JsonValueKind.Undefined ? "{}" : dto.FieldMap.GetRawText(),
                SampleBarcode = dto.SampleBarcode,
                Enabled = dto.Enabled,
            };

            var idx = snapshot.BarcodeRules.FindIndex(r => string.Equals(r.RuleId, ruleId, StringComparison.OrdinalIgnoreCase));
            if (idx >= 0) snapshot.BarcodeRules[idx] = entity;
            else snapshot.BarcodeRules.Add(entity);

            return new { rule = dto };
        }, ct);
    }

    public async Task<ApiEnvelope<object>> DeleteBarcodeRuleAsync(string ownerUid, string ruleId, CancellationToken ct = default)
    {
        return await MutateAsync<object>(ownerUid, ["BarcodeRules"], snapshot =>
        {
            var removed = snapshot.BarcodeRules.RemoveAll(r => string.Equals(r.RuleId, ruleId, StringComparison.OrdinalIgnoreCase));
            if (removed == 0) throw new DomainException($"未找到条码规则：{ruleId}");
            return new { deleted = ruleId };
        }, ct);
    }

    public async Task<ApiEnvelope<object>> CreateWorkOrderAsync(string ownerUid, WorkOrderDto dto, CancellationToken ct = default)
    {
        return await MutateAsync<object>(ownerUid, ["WorkOrders"], snapshot =>
        {
            if (string.IsNullOrWhiteSpace(dto.ProductCode) || dto.TargetQty <= 0)
                throw new DomainException("机型代码不能为空且计划产量必须大于 0");

            var woId = string.IsNullOrWhiteSpace(dto.WorkOrderId)
                ? $"WO-{DateTime.UtcNow:yyyyMMdd}-{snapshot.WorkOrders.Count + 1:D3}"
                : dto.WorkOrderId.Trim().ToUpperInvariant();

            if (snapshot.WorkOrders.Any(w => string.Equals(w.WorkOrderId, woId, StringComparison.OrdinalIgnoreCase)))
                throw new DomainException($"工单号 {woId} 已存在");

            var entity = new WorkOrderEntity
            {
                OwnerUid = ownerUid,
                WorkOrderId = woId,
                ProductCode = dto.ProductCode.Trim(),
                ProductName = dto.ProductName.Trim(),
                BomId = dto.BomId,
                CustomerCode = dto.CustomerCode,
                CustomerName = dto.CustomerName,
                LineName = dto.LineName,
                TargetQty = dto.TargetQty,
                Status = "PLANNED",
                BomJson = dto.Bom.ValueKind == JsonValueKind.Undefined ? "[]" : dto.Bom.GetRawText(),
                IssuedBySkuJson = "{}",
                ReplenishedBySkuJson = "{}",
                ReturnedBySkuJson = "{}",
                CreatedAt = DateTime.UtcNow.ToString("O"),
            };

            snapshot.WorkOrders.Insert(0, entity);
            return new { workOrder = entity };
        }, ct);
    }

    public async Task<ApiEnvelope<object>> CreateAsnAsync(string ownerUid, AsnOrderDto dto, CancellationToken ct = default)
    {
        return await MutateAsync<object>(ownerUid, ["Asns"], snapshot =>
        {
            if (string.IsNullOrWhiteSpace(dto.PoNo)) throw new DomainException("采购订单号 (PO) 不能为空");
            var asnNo = string.IsNullOrWhiteSpace(dto.AsnNo)
                ? $"ASN-{DateTime.UtcNow:yyyyMMdd}-{snapshot.Asns.Count + 1:D3}"
                : dto.AsnNo.Trim().ToUpperInvariant();

            var supplierName = string.IsNullOrWhiteSpace(dto.SupplierName)
                ? snapshot.Suppliers.FirstOrDefault(s => s.SupplierCode == dto.SupplierCode)?.SupplierName ?? dto.SupplierCode
                : dto.SupplierName;

            var entity = new AsnOrderEntity
            {
                OwnerUid = ownerUid,
                AsnNo = asnNo,
                PoNo = dto.PoNo.Trim(),
                SupplierCode = dto.SupplierCode,
                SupplierName = supplierName,
                WarehouseCode = dto.WarehouseCode,
                ExpectedDate = dto.ExpectedDate,
                Purchaser = dto.Purchaser,
                Source = string.IsNullOrWhiteSpace(dto.Source) ? "MANUAL" : dto.Source,
                Status = "PENDING",
                Notes = dto.Notes,
                LinesJson = dto.Lines.ValueKind == JsonValueKind.Undefined ? "[]" : dto.Lines.GetRawText(),
                CreatedAt = DateTime.UtcNow.ToString("O"),
            };

            snapshot.Asns.Insert(0, entity);
            return new { asn = entity };
        }, ct);
    }

    public async Task<ApiEnvelope<object>> CancelAsnAsync(string ownerUid, string asnNo, CancellationToken ct = default)
    {
        return await MutateAsync<object>(ownerUid, ["Asns"], snapshot =>
        {
            var asn = snapshot.Asns.FirstOrDefault(a => string.Equals(a.AsnNo, asnNo, StringComparison.OrdinalIgnoreCase))
                ?? throw new DomainException($"未找到入库单：{asnNo}");
            asn.Status = "CANCELLED";
            return new { asnNo };
        }, ct);
    }

    public async Task<ApiEnvelope<object>> ImportAsnCsvAsync(string ownerUid, ImportAsnCsvCommand cmd, CancellationToken ct = default)
    {
        return await MutateAsync<object>(ownerUid, ["Asns"], snapshot =>
        {
            if (string.IsNullOrWhiteSpace(cmd.CsvText))
                throw new DomainException("导入的 CSV 内容不能为空");

            var rows = cmd.CsvText
                .Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Skip(1) // skip header row
                .ToList();

            if (rows.Count == 0)
                throw new DomainException("CSV 中未解析到有效的入库明细行");

            var lines = new List<object>();
            var poNo = $"PO-CSV-{DateTime.UtcNow:yyyyMMddHHmm}";
            var supplierCode = snapshot.Suppliers.FirstOrDefault()?.SupplierCode ?? "SUP-STD";

            for (var i = 0; i < rows.Count; i++)
            {
                var cols = rows[i].Split(',').Select(c => c.Trim()).ToArray();
                if (cols.Length < 2) continue;
                var sku = cols[0];
                var qty = int.TryParse(cols[1], out var parsedQty) && parsedQty > 0 ? parsedQty : 1000;
                var lot = cols.Length > 2 ? cols[2] : $"LOT-{DateTime.UtcNow:yyMMdd}";
                var dc = cols.Length > 3 ? cols[3] : $"{DateTime.UtcNow:yy}45";
                var bin = cols.Length > 4 ? cols[4] : snapshot.Bins.FirstOrDefault()?.BinCode ?? "A-01-01";
                if (cols.Length > 5 && !string.IsNullOrWhiteSpace(cols[5])) poNo = cols[5];
                if (cols.Length > 6 && !string.IsNullOrWhiteSpace(cols[6])) supplierCode = cols[6];

                var mat = snapshot.Materials.FirstOrDefault(m => string.Equals(m.SkuCode, sku, StringComparison.OrdinalIgnoreCase));
                lines.Add(new
                {
                    lineId = $"L-{i + 1}",
                    skuCode = sku,
                    mpn = mat?.Mpn ?? sku,
                    materialName = mat?.Name ?? sku,
                    expectedQty = qty,
                    receivedQty = 0,
                    lotNumber = lot,
                    dateCode = dc,
                    targetBin = bin,
                });
            }

            if (lines.Count == 0)
                throw new DomainException("CSV 格式无效，至少需要包含 料号,预计数量 两列");

            var asnNo = $"ASN-{DateTime.UtcNow:yyyyMMdd}-{snapshot.Asns.Count + 1:D3}";
            var supplierName = snapshot.Suppliers.FirstOrDefault(s => s.SupplierCode == supplierCode)?.SupplierName ?? supplierCode;
            var entity = new AsnOrderEntity
            {
                OwnerUid = ownerUid,
                AsnNo = asnNo,
                PoNo = poNo,
                SupplierCode = supplierCode,
                SupplierName = supplierName,
                WarehouseCode = string.IsNullOrWhiteSpace(cmd.WarehouseCode)
                    ? snapshot.Warehouses.FirstOrDefault()?.WarehouseCode ?? "WH-SMT-01"
                    : cmd.WarehouseCode.Trim(),
                ExpectedDate = DateTime.UtcNow.ToString("yyyy-MM-dd"),
                Purchaser = string.IsNullOrWhiteSpace(cmd.Purchaser) ? "ERP/CSV导入" : cmd.Purchaser.Trim(),
                Source = "CSV_IMPORT",
                Status = "PENDING",
                Notes = cmd.Notes,
                LinesJson = JsonSerializer.Serialize(lines, JsonOpts),
                CreatedAt = DateTime.UtcNow.ToString("O"),
            };

            snapshot.Asns.Insert(0, entity);
            return new { asn = entity };
        }, ct);
    }

    public async Task<ApiEnvelope<object>> CreateWaveAsync(string ownerUid, CreateWaveCommand cmd, CancellationToken ct = default)
    {
        return await MutateAsync<object>(ownerUid, ["Waves", "WorkOrders", "Reels", "TraceEvents"], snapshot =>
        {
            if (cmd.WorkOrderIds.Count == 0) throw new DomainException("请至少选择一个待排程工单");
            var nowIso = DateTime.UtcNow.ToString("O");
            var waveId = $"WV-{DateTime.UtcNow:yyyyMMdd}-{snapshot.Waves.Count + 1:D3}";

            var allocations = new List<object>();
            var shortages = new List<object>();

            foreach (var woId in cmd.WorkOrderIds)
            {
                var wo = snapshot.WorkOrders.FirstOrDefault(w => string.Equals(w.WorkOrderId, woId, StringComparison.OrdinalIgnoreCase))
                    ?? throw new DomainException($"未找到工单：{woId}");
                wo.WaveId = waveId;
                wo.Status = "WAVED";

                using var bomDoc = JsonDocument.Parse(string.IsNullOrWhiteSpace(wo.BomJson) ? "[]" : wo.BomJson);
                foreach (var item in bomDoc.RootElement.EnumerateArray())
                {
                    var sku = item.TryGetProperty("skuCode", out var skuEl) ? skuEl.GetString() ?? "" : "";
                    var qtyPerBoard = item.TryGetProperty("qtyPerBoard", out var qEl) ? qEl.GetInt32() : 1;
                    var required = qtyPerBoard * wo.TargetQty;
                    if (string.IsNullOrWhiteSpace(sku) || required <= 0) continue;

                    // FIFO 优先按 DateCode 与入库时间分配在库且非 MSD 烘烤锁定料盘
                    var candidates = snapshot.Reels
                        .Where(r => string.Equals(r.SkuCode, sku, StringComparison.OrdinalIgnoreCase)
                                    && r.Status == "IN_STOCK"
                                    && r.Qty > 0
                                    && !MsdFloorLifePolicy.IsBakingRequired(r.MsdLevel, r.MsdState, r.MsdOpenAt))
                        .OrderBy(r => r.DateCode, StringComparer.Ordinal)
                        .ThenBy(r => r.ReceivedAt, StringComparer.Ordinal)
                        .ToList();

                    var remaining = required;
                    foreach (var reel in candidates)
                    {
                        if (remaining <= 0) break;
                        var alloc = Math.Min(remaining, reel.Qty);
                        reel.Status = "ALLOCATED";
                        reel.WorkOrderId = wo.WorkOrderId;
                        reel.UpdatedAt = nowIso;
                        allocations.Add(new
                        {
                            reelId = reel.ReelId,
                            skuCode = reel.SkuCode,
                            mpn = reel.Mpn,
                            binCode = reel.BinCode,
                            dateCode = reel.DateCode,
                            allocQty = alloc,
                            workOrderId = wo.WorkOrderId,
                            picked = false,
                        });
                        remaining -= alloc;
                    }

                    if (remaining > 0)
                    {
                        var mpn = snapshot.Materials.FirstOrDefault(m => m.SkuCode == sku)?.Mpn ?? sku;
                        shortages.Add(new { skuCode = sku, mpn, shortageQty = remaining });
                    }
                }
            }

            var wave = new WaveOrderEntity
            {
                OwnerUid = ownerUid,
                WaveId = waveId,
                Name = string.IsNullOrWhiteSpace(cmd.Name) ? $"波次 {waveId}" : cmd.Name.Trim(),
                WorkOrderIdsJson = JsonSerializer.Serialize(cmd.WorkOrderIds, JsonOpts),
                Status = "OPEN",
                AllocationsJson = JsonSerializer.Serialize(allocations, JsonOpts),
                CreatedAt = nowIso,
            };

            snapshot.Waves.Insert(0, wave);
            return new { wave, shortages };
        }, ct);
    }

    public async Task<ApiEnvelope<object>> IssueWaveReelAsync(string ownerUid, string waveId, IssueWaveReelCommand cmd, CancellationToken ct = default)
    {
        return await MutateAsync<object>(ownerUid, ["Waves", "Reels", "WorkOrders", "TraceEvents"], snapshot =>
        {
            var wave = snapshot.Waves.FirstOrDefault(w => string.Equals(w.WaveId, waveId, StringComparison.OrdinalIgnoreCase))
                ?? throw new DomainException($"未找到波次：{waveId}");
            var reel = snapshot.Reels.FirstOrDefault(r => string.Equals(r.ReelId, cmd.ReelId, StringComparison.OrdinalIgnoreCase))
                ?? throw new DomainException($"未找到料盘：{cmd.ReelId}");

            var nowIso = DateTime.UtcNow.ToString("O");
            var fromBin = reel.BinCode;
            var issued = reel.Qty;
            reel.Status = "ON_LINE";
            reel.IssuedQty += issued;
            reel.BinCode = "LINE-SIDE";
            if (!string.Equals(reel.MsdLevel, "Level 1", StringComparison.OrdinalIgnoreCase) && reel.MsdState == "SEALED")
            {
                reel.MsdState = "OPENED";
                reel.MsdOpenAt = nowIso;
            }
            reel.UpdatedAt = nowIso;

            var evt = new TraceEventEntity
            {
                OwnerUid = ownerUid,
                EventId = $"EVT-{Guid.NewGuid().ToString("N")[..8].ToUpperInvariant()}",
                Timestamp = nowIso,
                Action = "WAVE_ISSUE",
                ReelId = reel.ReelId,
                SkuCode = reel.SkuCode,
                Mpn = reel.Mpn,
                LotNumber = reel.LotNumber,
                DateCode = reel.DateCode,
                QtyDelta = -issued,
                BalanceAfter = reel.Qty,
                FromBin = fromBin,
                ToBin = reel.BinCode,
                WorkOrderId = reel.WorkOrderId,
                WaveId = wave.WaveId,
                DocNo = wave.WaveId,
                Reason = "波次拣料发料至产线",
                Operator = cmd.Operator,
            };

            snapshot.TraceEvents.Insert(0, evt);
            return new { reel = MapReel(reel), @event = MapTrace(evt) };
        }, ct);
    }

    public async Task<ApiEnvelope<object>> ReplenishAsync(string ownerUid, ReplenishCommand cmd, CancellationToken ct = default)
    {
        return await MutateAsync<object>(ownerUid, ["Reels", "WorkOrders", "TraceEvents"], snapshot =>
        {
            if (cmd.Qty <= 0) throw new DomainException("补料数量必须大于 0");
            var reel = snapshot.Reels.FirstOrDefault(r => string.Equals(r.ReelId, cmd.ReelId, StringComparison.OrdinalIgnoreCase))
                ?? throw new DomainException($"未找到料盘：{cmd.ReelId}");
            if (cmd.Qty > reel.Qty) throw new DomainException($"补料数量 ({cmd.Qty}) 超出料盘库存 ({reel.Qty})");

            var nowIso = DateTime.UtcNow.ToString("O");
            var fromBin = reel.BinCode;
            reel.Qty -= cmd.Qty;
            reel.IssuedQty += cmd.Qty;
            reel.WorkOrderId = cmd.WorkOrderId;
            reel.Status = reel.Qty == 0 ? "DEPLETED" : "ON_LINE";
            reel.UpdatedAt = nowIso;

            var evt = new TraceEventEntity
            {
                OwnerUid = ownerUid,
                EventId = $"EVT-{Guid.NewGuid().ToString("N")[..8].ToUpperInvariant()}",
                Timestamp = nowIso,
                Action = "REPLENISH",
                ReelId = reel.ReelId,
                SkuCode = reel.SkuCode,
                Mpn = reel.Mpn,
                LotNumber = reel.LotNumber,
                DateCode = reel.DateCode,
                QtyDelta = -cmd.Qty,
                BalanceAfter = reel.Qty,
                FromBin = fromBin,
                WorkOrderId = cmd.WorkOrderId,
                LineOrStation = cmd.Station,
                DocNo = $"RPL-{DateTime.UtcNow:yyyyMMddHHmmss}",
                Reason = cmd.Reason,
                Operator = cmd.Operator,
            };
            snapshot.TraceEvents.Insert(0, evt);
            return new { reel = MapReel(reel), @event = MapTrace(evt) };
        }, ct);
    }

    public async Task<ApiEnvelope<object>> ProductionReturnAsync(string ownerUid, ProductionReturnCommand cmd, CancellationToken ct = default)
    {
        return await MutateAsync<object>(ownerUid, ["Reels", "WorkOrders", "TraceEvents"], snapshot =>
        {
            if (cmd.ReturnQty <= 0) throw new DomainException("退料数量必须大于 0");
            var reel = snapshot.Reels.FirstOrDefault(r => string.Equals(r.ReelId, cmd.ReelId, StringComparison.OrdinalIgnoreCase))
                ?? throw new DomainException($"未找到料盘：{cmd.ReelId}");

            var nowIso = DateTime.UtcNow.ToString("O");
            ReelItemEntity targetReel = reel;

            if (cmd.SplitChildReel)
            {
                targetReel = new ReelItemEntity
                {
                    OwnerUid = ownerUid,
                    ReelId = $"{reel.ReelId}-R{Random.Shared.Next(10, 99)}",
                    ParentReelId = reel.ReelId,
                    MaterialKey = reel.MaterialKey,
                    SkuCode = reel.SkuCode,
                    Mpn = reel.Mpn,
                    LotNumber = reel.LotNumber,
                    DateCode = reel.DateCode,
                    Supplier = reel.Supplier,
                    OwnershipType = reel.OwnershipType,
                    OwnerCode = reel.OwnerCode,
                    OwnerName = reel.OwnerName,
                    CustomerCode = reel.CustomerCode,
                    CustomerName = reel.CustomerName,
                    PackagingCode = reel.PackagingCode,
                    Mpq = reel.Mpq,
                    ReceiptDocNo = reel.ReceiptDocNo,
                    InitialQty = cmd.ReturnQty,
                    Qty = cmd.ReturnQty,
                    IssuedQty = 0,
                    BinCode = cmd.ToBin,
                    MsdLevel = reel.MsdLevel,
                    MsdState = reel.MsdState,
                    MsdOpenAt = reel.MsdOpenAt,
                    Status = "IN_STOCK",
                    ReceivedAt = nowIso,
                    UpdatedAt = nowIso,
                };
                snapshot.Reels.Insert(0, targetReel);
            }
            else
            {
                reel.Qty = cmd.ReturnQty;
                reel.BinCode = cmd.ToBin;
                reel.Status = "IN_STOCK";
                reel.WorkOrderId = null;
                reel.UpdatedAt = nowIso;
            }

            var evt = new TraceEventEntity
            {
                OwnerUid = ownerUid,
                EventId = $"EVT-{Guid.NewGuid().ToString("N")[..8].ToUpperInvariant()}",
                Timestamp = nowIso,
                Action = "RETURN",
                ReelId = targetReel.ReelId,
                SkuCode = targetReel.SkuCode,
                Mpn = targetReel.Mpn,
                LotNumber = targetReel.LotNumber,
                DateCode = targetReel.DateCode,
                QtyDelta = cmd.ReturnQty,
                BalanceAfter = targetReel.Qty,
                ToBin = cmd.ToBin,
                WorkOrderId = cmd.WorkOrderId,
                DocNo = $"RET-{DateTime.UtcNow:yyyyMMddHHmmss}",
                Reason = cmd.Reason,
                Operator = cmd.Operator,
            };
            snapshot.TraceEvents.Insert(0, evt);
            return new { reel = MapReel(targetReel), @event = MapTrace(evt) };
        }, ct);
    }

    public async Task<ApiEnvelope<object>> CreateCycleCountAsync(string ownerUid, CreateCycleCountCommand cmd, CancellationToken ct = default)
    {
        return await MutateAsync<object>(ownerUid, ["CycleCounts"], snapshot =>
        {
            var countId = $"CC-{DateTime.UtcNow:yyyyMMdd}-{snapshot.CycleCounts.Count + 1:D3}";
            var matchedReels = snapshot.Reels
                .Where(r => r.Status == "IN_STOCK" && (string.IsNullOrWhiteSpace(cmd.ZoneFilter) || cmd.ZoneFilter == "ALL" || r.BinCode.StartsWith(cmd.ZoneFilter, StringComparison.OrdinalIgnoreCase)))
                .Select(r => new
                {
                    reelId = r.ReelId,
                    skuCode = r.SkuCode,
                    mpn = r.Mpn,
                    binCode = r.BinCode,
                    systemQty = r.Qty,
                    countedQty = (int?)null,
                    variance = 0,
                })
                .ToList();

            var task = new CycleCountTaskEntity
            {
                OwnerUid = ownerUid,
                CountId = countId,
                Title = string.IsNullOrWhiteSpace(cmd.Title) ? $"盘点任务 {countId}" : cmd.Title.Trim(),
                ZoneFilter = string.IsNullOrWhiteSpace(cmd.ZoneFilter) ? "ALL" : cmd.ZoneFilter,
                Status = "IN_PROGRESS",
                LinesJson = JsonSerializer.Serialize(matchedReels, JsonOpts),
                CreatedAt = DateTime.UtcNow.ToString("O"),
            };

            snapshot.CycleCounts.Insert(0, task);
            return new { cycleCount = task };
        }, ct);
    }

    public async Task<ApiEnvelope<object>> ReconcileCycleCountAsync(string ownerUid, string countId, ReconcileCycleCountCommand cmd, CancellationToken ct = default)
    {
        return await MutateAsync<object>(ownerUid, ["CycleCounts", "Reels", "TraceEvents"], snapshot =>
        {
            var task = snapshot.CycleCounts.FirstOrDefault(c => string.Equals(c.CountId, countId, StringComparison.OrdinalIgnoreCase))
                ?? throw new DomainException($"未找到盘点任务：{countId}");

            var nowIso = DateTime.UtcNow.ToString("O");
            var updatedLines = new List<object>();

            foreach (var (reelId, countedQty) in cmd.Counts)
            {
                var reel = snapshot.Reels.FirstOrDefault(r => string.Equals(r.ReelId, reelId, StringComparison.OrdinalIgnoreCase));
                if (reel is null) continue;

                var diff = countedQty - reel.Qty;
                updatedLines.Add(new
                {
                    reelId = reel.ReelId,
                    skuCode = reel.SkuCode,
                    mpn = reel.Mpn,
                    binCode = reel.BinCode,
                    systemQty = reel.Qty,
                    countedQty,
                    variance = diff,
                });

                if (diff != 0)
                {
                    reel.Qty = countedQty;
                    reel.UpdatedAt = nowIso;
                    snapshot.TraceEvents.Insert(0, new TraceEventEntity
                    {
                        OwnerUid = ownerUid,
                        EventId = $"EVT-{Guid.NewGuid().ToString("N")[..8].ToUpperInvariant()}",
                        Timestamp = nowIso,
                        Action = "CYCLE_COUNT_ADJ",
                        ReelId = reel.ReelId,
                        SkuCode = reel.SkuCode,
                        Mpn = reel.Mpn,
                        LotNumber = reel.LotNumber,
                        DateCode = reel.DateCode,
                        QtyDelta = diff,
                        BalanceAfter = countedQty,
                        FromBin = reel.BinCode,
                        ToBin = reel.BinCode,
                        DocNo = task.CountId,
                        Reason = $"盘点平账差异 {diff:+#;-#;0}",
                        Operator = cmd.Operator,
                    });
                }
            }

            task.LinesJson = JsonSerializer.Serialize(updatedLines, JsonOpts);
            task.Status = "COMPLETED";
            task.CompletedAt = nowIso;
            return new { cycleCount = task };
        }, ct);
    }

    private async Task<ApiEnvelope<TPayload>> MutateAsync<TPayload>(
        string ownerUid,
        string[] dirtySlices,
        Func<WmsWorkspaceSnapshot, TPayload> mutator,
        CancellationToken ct)
    {
        var gate = GetLock(ownerUid);
        await gate.WaitAsync(ct);
        try
        {
            var snapshot = await LoadOrSeedAsync(ownerUid, ct);
            var payload = mutator(snapshot);
            snapshot.Workspace.UpdatedAtUtc = DateTime.UtcNow;
            await repository.SaveAsync(ownerUid, snapshot, new HashSet<string>(dirtySlices), ct);
            return new ApiEnvelope<TPayload>(true, ToStateDto(snapshot), payload);
        }
        finally
        {
            gate.Release();
        }
    }

    private async Task<WmsWorkspaceSnapshot> LoadOrSeedAsync(string ownerUid, CancellationToken ct)
    {
        var existing = await repository.LoadAsync(ownerUid, ct);
        if (existing is not null) return existing;

        var seed = WmsSeedFactory.CreateInitialSnapshot(ownerUid);
        await repository.SaveAsync(ownerUid, seed, null, ct);
        return seed;
    }

    private static MaterialSkuEntity MapMaterialToEntity(string ownerUid, MaterialSkuDto dto, string skuCode, MaterialCompositeKey key) => new()
    {
        OwnerUid = ownerUid,
        MaterialKey = key.Value,
        SkuCode = skuCode,
        Mpn = dto.Mpn.Trim(),
        Name = dto.Name.Trim(),
        OwnershipType = key.OwnershipType,
        OwnerCode = key.OwnerCode,
        OwnerName = dto.OwnerName,
        CustomerCode = dto.CustomerCode,
        CustomerName = dto.CustomerName,
        Manufacturer = dto.Manufacturer,
        Category = dto.Category,
        PackageType = dto.PackageType,
        PackagingCode = dto.PackagingCode,
        PackagingName = dto.PackagingName,
        Mpq = dto.Mpq,
        SupplierCode = dto.SupplierCode,
        SupplierName = dto.SupplierName,
        Unit = dto.Unit,
        MsdLevel = dto.MsdLevel,
        SafetyStock = dto.SafetyStock,
        DefaultBin = dto.DefaultBin,
    };

    private static JsonElement ParseJsonOrDefault(string? json, string fallback)
    {
        using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(json) ? fallback : json);
        return doc.RootElement.Clone();
    }

    private static JsonElement? ParseNullableJson(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        using var doc = JsonDocument.Parse(json);
        return doc.RootElement.Clone();
    }

    private static WmsStateDto ToStateDto(WmsWorkspaceSnapshot s) => new()
    {
        PrinterConfig = ParseNullableJson(s.Workspace.PrinterConfigJson),
        Warehouses = s.Warehouses.Select(MapWarehouse).ToList(),
        Keepers = s.Keepers.Select(k => new WarehouseKeeperDto
        {
            KeeperId = k.KeeperId, EmployeeNo = k.EmployeeNo, Name = k.Name,
            Role = k.Role, WarehouseCode = k.WarehouseCode, Phone = k.Phone,
            Shift = k.Shift, Status = k.Status,
        }).ToList(),
        Bins = s.Bins.Select(b => new WarehouseBinDto
        {
            BinCode = b.BinCode, WarehouseCode = b.WarehouseCode, Zone = b.Zone,
            CapacityReels = b.CapacityReels, KeeperName = b.KeeperName, Description = b.Description,
        }).ToList(),
        Suppliers = s.Suppliers.Select(MapSupplier).ToList(),
        Customers = s.Customers.Select(MapCustomer).ToList(),
        PackagingSpecs = s.PackagingSpecs.Select(p => new PackagingSpecDto
        {
            PackagingCode = p.PackagingCode, PackagingName = p.PackagingName, CarrierType = p.CarrierType,
            ReelDiameter = p.ReelDiameter, TapeWidthMm = p.TapeWidthMm, PitchMm = p.PitchMm,
            DefaultSpq = p.DefaultSpq, AllowSplit = p.AllowSplit, AllowMerge = p.AllowMerge, Description = p.Description,
        }).ToList(),
        BarcodeRules = s.BarcodeRules.Select(r => new BarcodeRuleDto
        {
            RuleId = r.RuleId, RuleName = r.RuleName, SupplierCode = r.SupplierCode,
            SupplierName = r.SupplierName, FormatType = r.FormatType, Delimiter = r.Delimiter,
            FieldMap = ParseJsonOrDefault(r.FieldMapJson, "{}"), SampleBarcode = r.SampleBarcode, Enabled = r.Enabled,
        }).ToList(),
        LabelTemplates = s.LabelTemplates.Select(MapLabelTemplate).ToList(),
        Materials = s.Materials.Select(MapMaterial).ToList(),
        Boms = s.Boms.Select(MapBom).ToList(),
        Asns = s.Asns.Select(a => new AsnOrderDto
        {
            AsnNo = a.AsnNo, PoNo = a.PoNo, SupplierCode = a.SupplierCode, SupplierName = a.SupplierName,
            WarehouseCode = a.WarehouseCode, ExpectedDate = a.ExpectedDate, Purchaser = a.Purchaser,
            Source = a.Source, Status = a.Status, Notes = a.Notes, CreatedAt = a.CreatedAt,
            Lines = ParseJsonOrDefault(a.LinesJson, "[]"),
        }).ToList(),
        Reels = s.Reels.Select(MapReel).ToList(),
        WorkOrders = s.WorkOrders.Select(w => new WorkOrderDto
        {
            WorkOrderId = w.WorkOrderId, ProductCode = w.ProductCode, ProductName = w.ProductName,
            BomId = w.BomId, CustomerCode = w.CustomerCode, CustomerName = w.CustomerName,
            LineName = w.LineName, TargetQty = w.TargetQty, Status = w.Status, WaveId = w.WaveId,
            Bom = ParseJsonOrDefault(w.BomJson, "[]"),
            IssuedBySku = JsonSerializer.Deserialize<Dictionary<string, int>>(w.IssuedBySkuJson, JsonOpts) ?? new(),
            ReplenishedBySku = JsonSerializer.Deserialize<Dictionary<string, int>>(w.ReplenishedBySkuJson, JsonOpts) ?? new(),
            ReturnedBySku = JsonSerializer.Deserialize<Dictionary<string, int>>(w.ReturnedBySkuJson, JsonOpts) ?? new(),
            CreatedAt = w.CreatedAt,
        }).ToList(),
        Waves = s.Waves.Select(w => new WaveOrderDto
        {
            WaveId = w.WaveId, Name = w.Name,
            WorkOrderIds = JsonSerializer.Deserialize<List<string>>(w.WorkOrderIdsJson, JsonOpts) ?? [],
            Status = w.Status, Allocations = ParseJsonOrDefault(w.AllocationsJson, "[]"),
            CreatedAt = w.CreatedAt, CompletedAt = w.CompletedAt,
        }).ToList(),
        CycleCounts = s.CycleCounts.Select(c => new CycleCountTaskDto
        {
            CountId = c.CountId, Title = c.Title, ZoneFilter = c.ZoneFilter, Status = c.Status,
            Lines = ParseJsonOrDefault(c.LinesJson, "[]"), CreatedAt = c.CreatedAt, CompletedAt = c.CompletedAt,
        }).ToList(),
        ScrapRecords = s.ScrapRecords.Select(MapScrap).ToList(),
        TraceEvents = s.TraceEvents.Select(MapTrace).ToList(),
    };

    private static WarehouseDto MapWarehouse(WarehouseEntity w) => new()
    {
        WarehouseCode = w.WarehouseCode, WarehouseName = w.WarehouseName, WarehouseType = w.WarehouseType,
        ManagerId = w.ManagerId, ManagerName = w.ManagerName, Address = w.Address, Status = w.Status, CreatedAt = w.CreatedAt,
    };

    private static SupplierDto MapSupplier(SupplierEntity s) => new()
    {
        SupplierCode = s.SupplierCode, SupplierName = s.SupplierName, ContactName = s.ContactName,
        Phone = s.Phone, CategoryTags = s.CategoryTags, QualityGrade = s.QualityGrade, LeadTimeDays = s.LeadTimeDays, Notes = s.Notes,
    };

    private static CustomerDto MapCustomer(CustomerEntity c) => new()
    {
        CustomerCode = c.CustomerCode, CustomerName = c.CustomerName, ContactName = c.ContactName,
        Phone = c.Phone, Industry = c.Industry, TraceRequirement = c.TraceRequirement, DeliveryAddress = c.DeliveryAddress,
    };

    private static MaterialSkuDto MapMaterial(MaterialSkuEntity m) => new()
    {
        MaterialKey = m.MaterialKey, SkuCode = m.SkuCode, Mpn = m.Mpn, Name = m.Name,
        OwnershipType = m.OwnershipType, OwnerCode = m.OwnerCode, OwnerName = m.OwnerName,
        CustomerCode = m.CustomerCode, CustomerName = m.CustomerName, Manufacturer = m.Manufacturer,
        Category = m.Category, PackageType = m.PackageType, PackagingCode = m.PackagingCode,
        PackagingName = m.PackagingName, Mpq = m.Mpq, SupplierCode = m.SupplierCode,
        SupplierName = m.SupplierName, Unit = m.Unit, MsdLevel = m.MsdLevel,
        SafetyStock = m.SafetyStock, DefaultBin = m.DefaultBin,
    };

    private static BomMasterDto MapBom(BomMasterEntity b) => new()
    {
        BomId = b.BomId, ProductCode = b.ProductCode, ProductName = b.ProductName, Version = b.Version,
        CustomerCode = b.CustomerCode, CustomerName = b.CustomerName, ProcessType = b.ProcessType,
        Status = b.Status, Items = ParseJsonOrDefault(b.ItemsJson, "[]"), UpdatedAt = b.UpdatedAt,
    };

    private static LabelTemplateDto MapLabelTemplate(LabelTemplateEntity t) => new()
    {
        TemplateId = t.TemplateId, TemplateName = t.TemplateName, PaperSize = t.PaperSize,
        CustomWidthMm = t.CustomWidthMm, CustomHeightMm = t.CustomHeightMm, Dpi = t.Dpi,
        OffsetXMm = t.OffsetXMm, OffsetYMm = t.OffsetYMm, BarcodeType = t.BarcodeType, ZplMode = t.ZplMode,
        ElementOrder = ParseNullableJson(t.ElementOrderJson), ElementLayouts = ParseNullableJson(t.ElementLayoutsJson),
        FontScale = t.FontScale, BarcodeHeightMm = t.BarcodeHeightMm, CustomZpl = t.CustomZpl,
        HeaderTitle = t.HeaderTitle, FooterNote = t.FooterNote,
        ShowFields = ParseJsonOrDefault(t.ShowFieldsJson, "{}"), IsDefault = t.IsDefault,
    };

    private static ReelItemDto MapReel(ReelItemEntity r) => new()
    {
        ReelId = r.ReelId, ParentReelId = r.ParentReelId, MaterialKey = r.MaterialKey, SkuCode = r.SkuCode,
        Mpn = r.Mpn, LotNumber = r.LotNumber, DateCode = r.DateCode, Supplier = r.Supplier,
        OwnershipType = r.OwnershipType, OwnerCode = r.OwnerCode, OwnerName = r.OwnerName,
        CustomerCode = r.CustomerCode, CustomerName = r.CustomerName, PackagingCode = r.PackagingCode,
        Mpq = r.Mpq, ReceiptDocNo = r.ReceiptDocNo, AsnNo = r.AsnNo, InitialQty = r.InitialQty,
        Qty = r.Qty, IssuedQty = r.IssuedQty, BinCode = r.BinCode, MsdLevel = r.MsdLevel,
        MsdState = r.MsdState, MsdOpenAt = r.MsdOpenAt, Status = r.Status, WorkOrderId = r.WorkOrderId,
        ReceivedAt = r.ReceivedAt, UpdatedAt = r.UpdatedAt,
    };

    private static ScrapRecordDto MapScrap(ScrapRecordEntity s) => new()
    {
        ScrapId = s.ScrapId, Timestamp = s.Timestamp, ReelId = s.ReelId, SkuCode = s.SkuCode,
        Mpn = s.Mpn, LotNumber = s.LotNumber, Qty = s.Qty, Reason = s.Reason,
        Disposition = s.Disposition, WorkOrderId = s.WorkOrderId, Operator = s.Operator,
    };

    private static TraceEventDto MapTrace(TraceEventEntity e) => new()
    {
        EventId = e.EventId, Timestamp = e.Timestamp, Action = e.Action, ReelId = e.ReelId,
        SkuCode = e.SkuCode, Mpn = e.Mpn, LotNumber = e.LotNumber, DateCode = e.DateCode,
        QtyDelta = e.QtyDelta, BalanceAfter = e.BalanceAfter, FromBin = e.FromBin, ToBin = e.ToBin,
        WorkOrderId = e.WorkOrderId, WaveId = e.WaveId, LineOrStation = e.LineOrStation,
        DocNo = e.DocNo, Reason = e.Reason, Operator = e.Operator,
    };
}
