using System.Diagnostics;
using System.Net.Sockets;
using System.Text;
using SmtWms.Application.Interfaces;
using SmtWms.Domain.Common;

namespace SmtWms.Infrastructure.Printing;

public sealed class ZebraTcpPrinterClient : IZebraTcpPrinter
{
    private static readonly TimeSpan ConnectTimeout = TimeSpan.FromSeconds(5);

    public async Task<long> TestConnectionAsync(string host, int port, CancellationToken ct = default)
    {
        ValidateEndpoint(host, port);
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(ConnectTimeout);

        var sw = Stopwatch.StartNew();
        using var client = new TcpClient();
        try
        {
            await client.ConnectAsync(host.Trim(), port, cts.Token);
            sw.Stop();
            return sw.ElapsedMilliseconds;
        }
        catch (Exception ex) when (ex is SocketException or OperationCanceledException)
        {
            throw new DomainException($"无法连接到 Zebra 打印机 {host}:{port}（{ex.Message}）", 502);
        }
    }

    public async Task<int> SendZplAsync(string host, int port, string zpl, CancellationToken ct = default)
    {
        ValidateEndpoint(host, port);
        if (string.IsNullOrWhiteSpace(zpl) || !zpl.Contains("^XA", StringComparison.OrdinalIgnoreCase))
            throw new DomainException("无效的 ZPL 指令：必须包含 ^XA 起始标签", 400);

        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(ConnectTimeout);

        var payload = Encoding.UTF8.GetBytes(zpl);
        using var client = new TcpClient();
        try
        {
            await client.ConnectAsync(host.Trim(), port, cts.Token);
            await using var stream = client.GetStream();
            await stream.WriteAsync(payload, cts.Token);
            await stream.FlushAsync(cts.Token);
            return payload.Length;
        }
        catch (Exception ex) when (ex is SocketException or OperationCanceledException)
        {
            throw new DomainException($"发送 ZPL 至 {host}:{port} 失败（{ex.Message}）", 502);
        }
    }

    private static void ValidateEndpoint(string host, int port)
    {
        if (string.IsNullOrWhiteSpace(host))
            throw new DomainException("打印机 IP/主机地址不能为空", 400);
        if (port is < 1 or > 65535)
            throw new DomainException("打印机端口必须在 1 - 65535 之间（Zebra 默认 9100）", 400);
    }
}
