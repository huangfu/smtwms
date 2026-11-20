using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using SmtWms.Application.Interfaces;
using SmtWms.Application.Services;
using SmtWms.Domain.Repositories;
using SmtWms.Infrastructure.Persistence;
using SmtWms.Infrastructure.Printing;
using SmtWms.Infrastructure.Security;

namespace SmtWms.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddWmsInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var dbOptions = new DatabaseOptions();
        configuration.GetSection(DatabaseOptions.SectionName).Bind(dbOptions);

        services.AddSingleton(dbOptions);
        services.AddSingleton<IMultiDatabaseRegistry>(sp =>
            new MultiDatabaseRegistry(
                sp.GetRequiredService<DatabaseOptions>(),
                sp.GetRequiredService<ILogger<MultiDatabaseRegistry>>()));

        services.AddSingleton<IFreeSql>(sp =>
            sp.GetRequiredService<IMultiDatabaseRegistry>().Default);

        // Domain Repositories
        services.AddScoped<IUserRepository, FreeSqlUserRepository>();
        services.AddScoped<IWmsWorkspaceRepository, FreeSqlWmsWorkspaceRepository>();

        // Infrastructure Ports
        services.AddSingleton<IPasswordHasher, Pbkdf2PasswordHasher>();
        services.AddSingleton<IZebraTcpPrinter, ZebraTcpPrinterClient>();

        // Application Services
        services.AddScoped<AuthAppService>();
        services.AddScoped<WmsAppService>();

        return services;
    }
}
