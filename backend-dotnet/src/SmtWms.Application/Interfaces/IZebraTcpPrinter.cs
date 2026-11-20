namespace SmtWms.Application.Interfaces;

public interface IZebraTcpPrinter
{
    Task<long> TestConnectionAsync(string host, int port, CancellationToken ct = default);
    Task<int> SendZplAsync(string host, int port, string zpl, CancellationToken ct = default);
}
