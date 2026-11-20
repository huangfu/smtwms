using Microsoft.AspNetCore.Mvc;
using SmtWms.Application.Contracts;
using SmtWms.Application.Interfaces;
using SmtWms.WebApi.Middleware;

namespace SmtWms.WebApi.Controllers;

[ApiController]
[Route("api/wms/print/zpl")]
public sealed class ZebraPrintController(IZebraTcpPrinter zebraPrinter) : ControllerBase
{
    [HttpPost("test")]
    public async Task<IActionResult> TestConnection(
        [FromBody] ZebraTestRequest req,
        CancellationToken ct)
    {
        _ = HttpContext.RequireAuthUser();
        var latencyMs = await zebraPrinter.TestConnectionAsync(req.Host, req.Port, ct);
        return Ok(new
        {
            ok = true,
            payload = new
            {
                host = req.Host.Trim(),
                port = req.Port,
                latencyMs,
            },
        });
    }

    [HttpPost]
    public async Task<IActionResult> SendZpl(
        [FromBody] ZebraPrintRequest req,
        CancellationToken ct)
    {
        _ = HttpContext.RequireAuthUser();
        var bytesSent = await zebraPrinter.SendZplAsync(req.Host, req.Port, req.Zpl, ct);
        return Ok(new
        {
            ok = true,
            payload = new
            {
                host = req.Host.Trim(),
                port = req.Port,
                bytesSent,
            },
        });
    }
}
