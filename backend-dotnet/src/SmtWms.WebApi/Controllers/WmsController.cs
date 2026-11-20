using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using SmtWms.Application.Contracts;
using SmtWms.Application.Services;
using SmtWms.Infrastructure.Persistence;
using SmtWms.WebApi.Middleware;

namespace SmtWms.WebApi.Controllers;

[ApiController]
[Route("api/wms")]
public sealed class WmsController(
    WmsAppService wmsService,
    DatabaseOptions dbOptions,
    IMultiDatabaseRegistry dbRegistry) : ControllerBase
{
    private string CurrentUid => HttpContext.RequireAuthUser().Uid;

    [HttpGet("health/db")]
    public IActionResult DatabaseHealth()
    {
        return Ok(new
        {
            ok = true,
            provider = dbOptions.Provider,
            autoSyncStructure = dbOptions.AutoSyncStructure,
            readReplicas = dbOptions.SlaveConnectionStrings.Count,
            registeredDatabases = dbRegistry.RegisteredNames,
        });
    }

    [HttpGet("state")]
    public async Task<ActionResult<ApiEnvelope<object>>> GetState(CancellationToken ct)
    {
        var state = await wmsService.GetStateAsync(CurrentUid, ct);
        return Ok(new ApiEnvelope<object>(true, state));
    }

    [HttpPost("reset")]
    public async Task<ActionResult<ApiEnvelope<object>>> Reset(CancellationToken ct)
    {
        var state = await wmsService.ResetAsync(CurrentUid, ct);
        return Ok(new ApiEnvelope<object>(true, state));
    }

    [HttpPost("inbound")]
    public Task<ApiEnvelope<object>> Inbound([FromBody] InboundCommand cmd, CancellationToken ct)
        => wmsService.InboundAsync(CurrentUid, cmd, ct);

    [HttpPost("outbound")]
    public Task<ApiEnvelope<object>> GeneralOutbound([FromBody] GeneralOutboundCommand cmd, CancellationToken ct)
        => wmsService.GeneralOutboundAsync(CurrentUid, cmd, ct);

    [HttpPost("waves")]
    public Task<ApiEnvelope<object>> CreateWave([FromBody] CreateWaveCommand cmd, CancellationToken ct)
        => wmsService.CreateWaveAsync(CurrentUid, cmd, ct);

    [HttpPost("waves/{waveId}/issue")]
    public Task<ApiEnvelope<object>> IssueWaveReel(
        [FromRoute] string waveId,
        [FromBody] IssueWaveReelCommand cmd,
        CancellationToken ct)
        => wmsService.IssueWaveReelAsync(CurrentUid, waveId, cmd, ct);

    [HttpPost("replenish")]
    public Task<ApiEnvelope<object>> Replenish([FromBody] ReplenishCommand cmd, CancellationToken ct)
        => wmsService.ReplenishAsync(CurrentUid, cmd, ct);

    [HttpPost("return")]
    public Task<ApiEnvelope<object>> ProductionReturn([FromBody] ProductionReturnCommand cmd, CancellationToken ct)
        => wmsService.ProductionReturnAsync(CurrentUid, cmd, ct);

    [HttpPost("msd-bake")]
    public Task<ApiEnvelope<object>> BakeMsd([FromBody] MsdBakeCommand cmd, CancellationToken ct)
        => wmsService.BakeMsdAsync(CurrentUid, cmd, ct);

    [HttpPost("scrap")]
    public Task<ApiEnvelope<object>> Scrap([FromBody] ScrapCommand cmd, CancellationToken ct)
        => wmsService.ScrapAsync(CurrentUid, cmd, ct);

    [HttpPost("cycle-counts")]
    public Task<ApiEnvelope<object>> CreateCycleCount([FromBody] CreateCycleCountCommand cmd, CancellationToken ct)
        => wmsService.CreateCycleCountAsync(CurrentUid, cmd, ct);

    [HttpPost("cycle-counts/{countId}/reconcile")]
    public Task<ApiEnvelope<object>> ReconcileCycleCount(
        [FromRoute] string countId,
        [FromBody] ReconcileCycleCountCommand cmd,
        CancellationToken ct)
        => wmsService.ReconcileCycleCountAsync(CurrentUid, countId, cmd, ct);

    [HttpPost("materials")]
    public Task<ApiEnvelope<object>> AddMaterial([FromBody] MaterialSkuDto dto, CancellationToken ct)
        => wmsService.SaveMaterialAsync(CurrentUid, dto, null, ct);

    [HttpPut("materials")]
    public Task<ApiEnvelope<object>> UpdateMaterial([FromBody] UpdateMaterialCommand cmd, CancellationToken ct)
        => wmsService.SaveMaterialAsync(CurrentUid, cmd.Material, cmd.OriginalKey, ct);

    [HttpDelete("materials")]
    public Task<ApiEnvelope<object>> DeleteMaterial([FromBody] DeleteMaterialCommand cmd, CancellationToken ct)
        => wmsService.DeleteMaterialAsync(CurrentUid, cmd.MaterialKey, ct);

    [HttpPost("work-orders")]
    public Task<ApiEnvelope<object>> CreateWorkOrder([FromBody] WorkOrderDto dto, CancellationToken ct)
        => wmsService.CreateWorkOrderAsync(CurrentUid, dto, ct);

    [HttpPost("warehouses")]
    public Task<ApiEnvelope<object>> AddWarehouse([FromBody] WarehouseDto dto, CancellationToken ct)
        => wmsService.UpsertWarehouseAsync(CurrentUid, dto, null, ct);

    [HttpPut("warehouses/{code}")]
    public Task<ApiEnvelope<object>> UpdateWarehouse(
        [FromRoute] string code,
        [FromBody] WarehouseDto dto,
        CancellationToken ct)
        => wmsService.UpsertWarehouseAsync(CurrentUid, dto, code, ct);

    [HttpDelete("warehouses/{code}")]
    public Task<ApiEnvelope<object>> DeleteWarehouse([FromRoute] string code, CancellationToken ct)
        => wmsService.DeleteWarehouseAsync(CurrentUid, code, ct);

    [HttpPost("bins")]
    public Task<ApiEnvelope<object>> AddBin([FromBody] WarehouseBinDto dto, CancellationToken ct)
        => wmsService.UpsertBinAsync(CurrentUid, dto, null, ct);

    [HttpPut("bins/{binCode}")]
    public Task<ApiEnvelope<object>> UpdateBin(
        [FromRoute] string binCode,
        [FromBody] WarehouseBinDto dto,
        CancellationToken ct)
        => wmsService.UpsertBinAsync(CurrentUid, dto, binCode, ct);

    [HttpDelete("bins/{binCode}")]
    public Task<ApiEnvelope<object>> DeleteBin([FromRoute] string binCode, CancellationToken ct)
        => wmsService.DeleteBinAsync(CurrentUid, binCode, ct);

    [HttpPost("keepers")]
    public Task<ApiEnvelope<object>> AddKeeper([FromBody] WarehouseKeeperDto dto, CancellationToken ct)
        => wmsService.UpsertKeeperAsync(CurrentUid, dto, null, ct);

    [HttpPut("keepers/{keeperId}")]
    public Task<ApiEnvelope<object>> UpdateKeeper(
        [FromRoute] string keeperId,
        [FromBody] WarehouseKeeperDto dto,
        CancellationToken ct)
        => wmsService.UpsertKeeperAsync(CurrentUid, dto, keeperId, ct);

    [HttpDelete("keepers/{keeperId}")]
    public Task<ApiEnvelope<object>> DeleteKeeper([FromRoute] string keeperId, CancellationToken ct)
        => wmsService.DeleteKeeperAsync(CurrentUid, keeperId, ct);

    [HttpPost("suppliers")]
    public Task<ApiEnvelope<object>> AddSupplier([FromBody] SupplierDto dto, CancellationToken ct)
        => wmsService.UpsertSupplierAsync(CurrentUid, dto, null, ct);

    [HttpPut("suppliers/{code}")]
    public Task<ApiEnvelope<object>> UpdateSupplier(
        [FromRoute] string code,
        [FromBody] SupplierDto dto,
        CancellationToken ct)
        => wmsService.UpsertSupplierAsync(CurrentUid, dto, code, ct);

    [HttpDelete("suppliers/{code}")]
    public Task<ApiEnvelope<object>> DeleteSupplier([FromRoute] string code, CancellationToken ct)
        => wmsService.DeleteSupplierAsync(CurrentUid, code, ct);

    [HttpPost("customers")]
    public Task<ApiEnvelope<object>> AddCustomer([FromBody] CustomerDto dto, CancellationToken ct)
        => wmsService.UpsertCustomerAsync(CurrentUid, dto, null, ct);

    [HttpPut("customers/{code}")]
    public Task<ApiEnvelope<object>> UpdateCustomer(
        [FromRoute] string code,
        [FromBody] CustomerDto dto,
        CancellationToken ct)
        => wmsService.UpsertCustomerAsync(CurrentUid, dto, code, ct);

    [HttpDelete("customers/{code}")]
    public Task<ApiEnvelope<object>> DeleteCustomer([FromRoute] string code, CancellationToken ct)
        => wmsService.DeleteCustomerAsync(CurrentUid, code, ct);

    [HttpPost("boms")]
    public Task<ApiEnvelope<object>> SaveBom([FromBody] BomMasterDto dto, CancellationToken ct)
        => wmsService.SaveBomAsync(CurrentUid, dto, ct);

    [HttpDelete("boms/{bomId}")]
    public Task<ApiEnvelope<object>> DeleteBom([FromRoute] string bomId, CancellationToken ct)
        => wmsService.DeleteBomAsync(CurrentUid, bomId, ct);

    [HttpPost("asns")]
    public Task<ApiEnvelope<object>> CreateAsn([FromBody] AsnOrderDto dto, CancellationToken ct)
        => wmsService.CreateAsnAsync(CurrentUid, dto, ct);

    [HttpPost("asns/import-csv")]
    public Task<ApiEnvelope<object>> ImportAsnCsv([FromBody] ImportAsnCsvCommand cmd, CancellationToken ct)
        => wmsService.ImportAsnCsvAsync(CurrentUid, cmd, ct);

    [HttpPost("asns/{asnNo}/cancel")]
    public Task<ApiEnvelope<object>> CancelAsn([FromRoute] string asnNo, CancellationToken ct)
        => wmsService.CancelAsnAsync(CurrentUid, asnNo, ct);

    [HttpPost("packaging-specs")]
    public Task<ApiEnvelope<object>> AddPackagingSpec([FromBody] PackagingSpecDto dto, CancellationToken ct)
        => wmsService.UpsertPackagingSpecAsync(CurrentUid, dto, null, ct);

    [HttpPut("packaging-specs/{code}")]
    public Task<ApiEnvelope<object>> UpdatePackagingSpec(
        [FromRoute] string code,
        [FromBody] PackagingSpecDto dto,
        CancellationToken ct)
        => wmsService.UpsertPackagingSpecAsync(CurrentUid, dto, code, ct);

    [HttpDelete("packaging-specs/{code}")]
    public Task<ApiEnvelope<object>> DeletePackagingSpec([FromRoute] string code, CancellationToken ct)
        => wmsService.DeletePackagingSpecAsync(CurrentUid, code, ct);

    [HttpPost("barcode-rules")]
    public Task<ApiEnvelope<object>> SaveBarcodeRule([FromBody] BarcodeRuleDto dto, CancellationToken ct)
        => wmsService.SaveBarcodeRuleAsync(CurrentUid, dto, ct);

    [HttpDelete("barcode-rules/{ruleId}")]
    public Task<ApiEnvelope<object>> DeleteBarcodeRule([FromRoute] string ruleId, CancellationToken ct)
        => wmsService.DeleteBarcodeRuleAsync(CurrentUid, ruleId, ct);

    [HttpPost("label-templates")]
    public Task<ApiEnvelope<object>> SaveLabelTemplate([FromBody] LabelTemplateDto dto, CancellationToken ct)
        => wmsService.SaveLabelTemplateAsync(CurrentUid, dto, ct);

    [HttpDelete("label-templates/{templateId}")]
    public Task<ApiEnvelope<object>> DeleteLabelTemplate([FromRoute] string templateId, CancellationToken ct)
        => wmsService.DeleteLabelTemplateAsync(CurrentUid, templateId, ct);

    [HttpPut("printer-config")]
    public Task<ApiEnvelope<object>> SavePrinterConfig([FromBody] JsonElement cfg, CancellationToken ct)
        => wmsService.SavePrinterConfigAsync(CurrentUid, cfg, ct);
}
