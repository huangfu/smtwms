using System.Collections.Concurrent;
using FreeSql;
using Microsoft.Extensions.Logging;
using SmtWms.Domain.Entities;

namespace SmtWms.Infrastructure.Persistence;

public interface IMultiDatabaseRegistry : IDisposable
{
    IFreeSql Default { get; }
    IFreeSql Get(string name);
    IReadOnlyCollection<string> RegisteredNames { get; }
}

/// <summary>
/// FreeSql 多数据库工厂与注册表：
/// 通过 Fluent API 集中配置全部实体的跨库映射（主键、自增、唯一索引、超长 JSON 列），
/// 让 SmtWms.Domain 保持零 ORM 依赖，同时无痛兼容 SQLite / MSSQL / PostgreSQL / MySQL。
/// </summary>
public sealed class MultiDatabaseRegistry : IMultiDatabaseRegistry
{
    private readonly ConcurrentDictionary<string, IFreeSql> _instances = new(StringComparer.OrdinalIgnoreCase);

    public MultiDatabaseRegistry(DatabaseOptions options, ILogger<MultiDatabaseRegistry> logger)
    {
        var primary = FreeSqlFactory.Create(
            options.Provider,
            options.ConnectionString,
            options.AutoSyncStructure,
            options.SlaveConnectionStrings,
            options.LogSql,
            logger,
            configureWmsSchema: true);

        _instances["default"] = primary;

        foreach (var (name, cfg) in options.AdditionalDatabases)
        {
            if (string.IsNullOrWhiteSpace(cfg.ConnectionString)) continue;
            var secondary = FreeSqlFactory.Create(
                cfg.Provider,
                cfg.ConnectionString,
                cfg.AutoSyncStructure,
                cfg.SlaveConnectionStrings,
                options.LogSql,
                logger,
                configureWmsSchema: false);
            _instances[name] = secondary;
        }
    }

    public IFreeSql Default => _instances["default"];

    public IFreeSql Get(string name)
    {
        if (_instances.TryGetValue(name, out var instance)) return instance;
        throw new KeyNotFoundException($"未找到名为 \"{name}\" 的数据源配置，请检查 appsettings.json 的 Database:AdditionalDatabases。");
    }

    public IReadOnlyCollection<string> RegisteredNames => _instances.Keys.ToList().AsReadOnly();

    public void Dispose()
    {
        foreach (var instance in _instances.Values)
        {
            instance.Dispose();
        }
        _instances.Clear();
    }
}

public static class FreeSqlFactory
{
    public static DataType ParseDataType(string provider) => provider.Trim().ToLowerInvariant() switch
    {
        "sqlite" => DataType.Sqlite,
        "mssql" or "sqlserver" or "sql_server" => DataType.SqlServer,
        "postgres" or "postgresql" or "pgsql" => DataType.PostgreSQL,
        "mysql" or "mariadb" => DataType.MySql,
        _ => throw new NotSupportedException(
            $"不支持的数据库驱动 \"{provider}\"。可选值：Sqlite、SqlServer (MSSQL)、PostgreSQL、MySql。")
    };

    public static IFreeSql Create(
        string provider,
        string connectionString,
        bool autoSyncStructure,
        IReadOnlyList<string>? slaveConnectionStrings,
        bool logSql,
        ILogger logger,
        bool configureWmsSchema)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
            throw new InvalidOperationException($"数据库 ({provider}) 的 ConnectionString 不能为空。");

        var dataType = ParseDataType(provider);
        var builder = new FreeSqlBuilder()
            .UseConnectionString(dataType, connectionString)
            .UseAutoSyncStructure(autoSyncStructure);

        if (slaveConnectionStrings is { Count: > 0 })
        {
            var validSlaves = slaveConnectionStrings.Where(s => !string.IsNullOrWhiteSpace(s)).ToArray();
            if (validSlaves.Length > 0)
            {
                builder.UseSlave(validSlaves);
            }
        }

        if (logSql)
        {
            builder.UseMonitorCommand(cmd =>
                logger.LogDebug("[FreeSql:{Provider}] {Sql}", dataType, cmd.CommandText));
        }

        var fsql = builder.Build();

        if (configureWmsSchema)
        {
            ConfigureWmsEntities(fsql);
            if (autoSyncStructure)
            {
                SyncWmsTables(fsql);
            }
        }

        logger.LogInformation(
            "FreeSql 数据源初始化完成：Provider={Provider}, AutoSyncStructure={AutoSync}",
            dataType,
            autoSyncStructure);

        return fsql;
    }

    /// <summary>
    /// 跨库实体映射配置：
    /// StringLength(-1) 在 MSSQL 映射为 NVARCHAR(MAX)，在 SQLite/PostgreSQL 为 TEXT，在 MySQL 为 LONGTEXT。
    /// </summary>
    public static void ConfigureWmsEntities(IFreeSql fsql)
    {
        fsql.CodeFirst.ConfigEntity<UserAccount>(e =>
        {
            e.Name("wms_users");
            e.Property(x => x.Id).IsPrimary(true).IsIdentity(true);
            e.Property(x => x.DomainEvents).IsIgnore(true);
            e.Property(x => x.Uid).StringLength(64).IsNullable(false);
            e.Property(x => x.Email).StringLength(160).IsNullable(false);
            e.Property(x => x.DisplayName).StringLength(120);
            e.Index("uk_wms_users_uid", nameof(UserAccount.Uid), isUnique: true);
        });

        fsql.CodeFirst.ConfigEntity<UserCredential>(e =>
        {
            e.Name("wms_user_credentials");
            e.Property(x => x.Id).IsPrimary(true).IsIdentity(true);
            e.Property(x => x.UserUid).StringLength(64).IsNullable(false);
            e.Property(x => x.Username).StringLength(64).IsNullable(false);
            e.Property(x => x.PasswordHash).StringLength(512).IsNullable(false);
            e.Index("uk_wms_cred_uid", nameof(UserCredential.UserUid), isUnique: true);
            e.Index("uk_wms_cred_username", nameof(UserCredential.Username), isUnique: true);
        });

        fsql.CodeFirst.ConfigEntity<UserSession>(e =>
        {
            e.Name("wms_user_sessions");
            e.Property(x => x.Id).IsPrimary(true).IsIdentity(true);
            e.Property(x => x.TokenHash).StringLength(128).IsNullable(false);
            e.Property(x => x.UserUid).StringLength(64).IsNullable(false);
            e.Index("uk_wms_session_token", nameof(UserSession.TokenHash), isUnique: true);
            e.Index("idx_wms_session_uid", nameof(UserSession.UserUid), isUnique: false);
        });

        fsql.CodeFirst.ConfigEntity<WmsWorkspace>(e =>
        {
            e.Name("wms_workspaces");
            e.Property(x => x.Id).IsPrimary(true).IsIdentity(true);
            e.Property(x => x.DomainEvents).IsIgnore(true);
            e.Property(x => x.OwnerUid).StringLength(64).IsNullable(false);
            e.Property(x => x.PrinterConfigJson).StringLength(-1);
            e.Index("uk_wms_workspace_owner", nameof(WmsWorkspace.OwnerUid), isUnique: true);
        });

        fsql.CodeFirst.ConfigEntity<WarehouseEntity>(e =>
        {
            e.Name("wms_warehouses");
            e.Property(x => x.Id).IsPrimary(true).IsIdentity(true);
            e.Property(x => x.OwnerUid).StringLength(64).IsNullable(false);
            e.Property(x => x.WarehouseCode).StringLength(64).IsNullable(false);
            e.Property(x => x.WarehouseName).StringLength(128).IsNullable(false);
            e.Property(x => x.Address).StringLength(256);
            e.Index("uk_wms_warehouse", $"{nameof(WarehouseEntity.OwnerUid)},{nameof(WarehouseEntity.WarehouseCode)}", isUnique: true);
        });

        fsql.CodeFirst.ConfigEntity<WarehouseKeeperEntity>(e =>
        {
            e.Name("wms_warehouse_keepers");
            e.Property(x => x.Id).IsPrimary(true).IsIdentity(true);
            e.Property(x => x.OwnerUid).StringLength(64).IsNullable(false);
            e.Property(x => x.KeeperId).StringLength(64).IsNullable(false);
            e.Index("uk_wms_keeper", $"{nameof(WarehouseKeeperEntity.OwnerUid)},{nameof(WarehouseKeeperEntity.KeeperId)}", isUnique: true);
        });

        fsql.CodeFirst.ConfigEntity<WarehouseBinEntity>(e =>
        {
            e.Name("wms_warehouse_bins");
            e.Property(x => x.Id).IsPrimary(true).IsIdentity(true);
            e.Property(x => x.OwnerUid).StringLength(64).IsNullable(false);
            e.Property(x => x.BinCode).StringLength(64).IsNullable(false);
            e.Property(x => x.Description).StringLength(256);
            e.Index("uk_wms_bin", $"{nameof(WarehouseBinEntity.OwnerUid)},{nameof(WarehouseBinEntity.BinCode)}", isUnique: true);
        });

        fsql.CodeFirst.ConfigEntity<SupplierEntity>(e =>
        {
            e.Name("wms_suppliers");
            e.Property(x => x.Id).IsPrimary(true).IsIdentity(true);
            e.Property(x => x.OwnerUid).StringLength(64).IsNullable(false);
            e.Property(x => x.SupplierCode).StringLength(64).IsNullable(false);
            e.Property(x => x.Notes).StringLength(512);
            e.Index("uk_wms_supplier", $"{nameof(SupplierEntity.OwnerUid)},{nameof(SupplierEntity.SupplierCode)}", isUnique: true);
        });

        fsql.CodeFirst.ConfigEntity<CustomerEntity>(e =>
        {
            e.Name("wms_customers");
            e.Property(x => x.Id).IsPrimary(true).IsIdentity(true);
            e.Property(x => x.OwnerUid).StringLength(64).IsNullable(false);
            e.Property(x => x.CustomerCode).StringLength(64).IsNullable(false);
            e.Property(x => x.DeliveryAddress).StringLength(256);
            e.Index("uk_wms_customer", $"{nameof(CustomerEntity.OwnerUid)},{nameof(CustomerEntity.CustomerCode)}", isUnique: true);
        });

        fsql.CodeFirst.ConfigEntity<PackagingSpecEntity>(e =>
        {
            e.Name("wms_packaging_specs");
            e.Property(x => x.Id).IsPrimary(true).IsIdentity(true);
            e.Property(x => x.OwnerUid).StringLength(64).IsNullable(false);
            e.Property(x => x.PackagingCode).StringLength(64).IsNullable(false);
            e.Property(x => x.Description).StringLength(256);
            e.Index("uk_wms_pkg", $"{nameof(PackagingSpecEntity.OwnerUid)},{nameof(PackagingSpecEntity.PackagingCode)}", isUnique: true);
        });

        fsql.CodeFirst.ConfigEntity<BarcodeRuleEntity>(e =>
        {
            e.Name("wms_barcode_rules");
            e.Property(x => x.Id).IsPrimary(true).IsIdentity(true);
            e.Property(x => x.OwnerUid).StringLength(64).IsNullable(false);
            e.Property(x => x.RuleId).StringLength(64).IsNullable(false);
            e.Property(x => x.FieldMapJson).StringLength(-1);
            e.Property(x => x.SampleBarcode).StringLength(512);
            e.Index("uk_wms_barcode_rule", $"{nameof(BarcodeRuleEntity.OwnerUid)},{nameof(BarcodeRuleEntity.RuleId)}", isUnique: true);
        });

        fsql.CodeFirst.ConfigEntity<LabelTemplateEntity>(e =>
        {
            e.Name("wms_label_templates");
            e.Property(x => x.Id).IsPrimary(true).IsIdentity(true);
            e.Property(x => x.OwnerUid).StringLength(64).IsNullable(false);
            e.Property(x => x.TemplateId).StringLength(64).IsNullable(false);
            e.Property(x => x.ElementOrderJson).StringLength(-1);
            e.Property(x => x.ElementLayoutsJson).StringLength(-1);
            e.Property(x => x.CustomZpl).StringLength(-1);
            e.Property(x => x.ShowFieldsJson).StringLength(-1);
            e.Index("uk_wms_label_tpl", $"{nameof(LabelTemplateEntity.OwnerUid)},{nameof(LabelTemplateEntity.TemplateId)}", isUnique: true);
        });

        fsql.CodeFirst.ConfigEntity<MaterialSkuEntity>(e =>
        {
            e.Name("wms_materials");
            e.Property(x => x.Id).IsPrimary(true).IsIdentity(true);
            e.Property(x => x.OwnerUid).StringLength(64).IsNullable(false);
            e.Property(x => x.MaterialKey).StringLength(160).IsNullable(false);
            e.Property(x => x.SkuCode).StringLength(100).IsNullable(false);
            e.Property(x => x.Mpn).StringLength(120).IsNullable(false);
            e.Index("uk_wms_material_key", $"{nameof(MaterialSkuEntity.OwnerUid)},{nameof(MaterialSkuEntity.MaterialKey)}", isUnique: true);
        });

        fsql.CodeFirst.ConfigEntity<BomMasterEntity>(e =>
        {
            e.Name("wms_boms");
            e.Property(x => x.Id).IsPrimary(true).IsIdentity(true);
            e.Property(x => x.OwnerUid).StringLength(64).IsNullable(false);
            e.Property(x => x.BomId).StringLength(80).IsNullable(false);
            e.Property(x => x.ItemsJson).StringLength(-1);
            e.Index("uk_wms_bom", $"{nameof(BomMasterEntity.OwnerUid)},{nameof(BomMasterEntity.BomId)}", isUnique: true);
        });

        fsql.CodeFirst.ConfigEntity<AsnOrderEntity>(e =>
        {
            e.Name("wms_asns");
            e.Property(x => x.Id).IsPrimary(true).IsIdentity(true);
            e.Property(x => x.OwnerUid).StringLength(64).IsNullable(false);
            e.Property(x => x.AsnNo).StringLength(64).IsNullable(false);
            e.Property(x => x.Notes).StringLength(512);
            e.Property(x => x.LinesJson).StringLength(-1);
            e.Index("uk_wms_asn", $"{nameof(AsnOrderEntity.OwnerUid)},{nameof(AsnOrderEntity.AsnNo)}", isUnique: true);
        });

        fsql.CodeFirst.ConfigEntity<ReelItemEntity>(e =>
        {
            e.Name("wms_reels");
            e.Property(x => x.Id).IsPrimary(true).IsIdentity(true);
            e.Property(x => x.DomainEvents).IsIgnore(true);
            e.Property(x => x.OwnerUid).StringLength(64).IsNullable(false);
            e.Property(x => x.ReelId).StringLength(80).IsNullable(false);
            e.Index("uk_wms_reel", $"{nameof(ReelItemEntity.OwnerUid)},{nameof(ReelItemEntity.ReelId)}", isUnique: true);
            e.Index("idx_wms_reel_sku", $"{nameof(ReelItemEntity.OwnerUid)},{nameof(ReelItemEntity.SkuCode)}", isUnique: false);
        });

        fsql.CodeFirst.ConfigEntity<WorkOrderEntity>(e =>
        {
            e.Name("wms_work_orders");
            e.Property(x => x.Id).IsPrimary(true).IsIdentity(true);
            e.Property(x => x.DomainEvents).IsIgnore(true);
            e.Property(x => x.OwnerUid).StringLength(64).IsNullable(false);
            e.Property(x => x.WorkOrderId).StringLength(64).IsNullable(false);
            e.Property(x => x.BomJson).StringLength(-1);
            e.Property(x => x.IssuedBySkuJson).StringLength(-1);
            e.Property(x => x.ReplenishedBySkuJson).StringLength(-1);
            e.Property(x => x.ReturnedBySkuJson).StringLength(-1);
            e.Index("uk_wms_wo", $"{nameof(WorkOrderEntity.OwnerUid)},{nameof(WorkOrderEntity.WorkOrderId)}", isUnique: true);
        });

        fsql.CodeFirst.ConfigEntity<WaveOrderEntity>(e =>
        {
            e.Name("wms_waves");
            e.Property(x => x.Id).IsPrimary(true).IsIdentity(true);
            e.Property(x => x.DomainEvents).IsIgnore(true);
            e.Property(x => x.OwnerUid).StringLength(64).IsNullable(false);
            e.Property(x => x.WaveId).StringLength(64).IsNullable(false);
            e.Property(x => x.WorkOrderIdsJson).StringLength(-1);
            e.Property(x => x.AllocationsJson).StringLength(-1);
            e.Index("uk_wms_wave", $"{nameof(WaveOrderEntity.OwnerUid)},{nameof(WaveOrderEntity.WaveId)}", isUnique: true);
        });

        fsql.CodeFirst.ConfigEntity<CycleCountTaskEntity>(e =>
        {
            e.Name("wms_cycle_counts");
            e.Property(x => x.Id).IsPrimary(true).IsIdentity(true);
            e.Property(x => x.OwnerUid).StringLength(64).IsNullable(false);
            e.Property(x => x.CountId).StringLength(64).IsNullable(false);
            e.Property(x => x.LinesJson).StringLength(-1);
            e.Index("uk_wms_cycle_count", $"{nameof(CycleCountTaskEntity.OwnerUid)},{nameof(CycleCountTaskEntity.CountId)}", isUnique: true);
        });

        fsql.CodeFirst.ConfigEntity<ScrapRecordEntity>(e =>
        {
            e.Name("wms_scrap_records");
            e.Property(x => x.Id).IsPrimary(true).IsIdentity(true);
            e.Property(x => x.OwnerUid).StringLength(64).IsNullable(false);
            e.Property(x => x.ScrapId).StringLength(64).IsNullable(false);
            e.Property(x => x.Reason).StringLength(512);
            e.Index("uk_wms_scrap", $"{nameof(ScrapRecordEntity.OwnerUid)},{nameof(ScrapRecordEntity.ScrapId)}", isUnique: true);
        });

        fsql.CodeFirst.ConfigEntity<TraceEventEntity>(e =>
        {
            e.Name("wms_trace_events");
            e.Property(x => x.Id).IsPrimary(true).IsIdentity(true);
            e.Property(x => x.OwnerUid).StringLength(64).IsNullable(false);
            e.Property(x => x.EventId).StringLength(64).IsNullable(false);
            e.Property(x => x.Reason).StringLength(512);
            e.Index("uk_wms_trace_event", $"{nameof(TraceEventEntity.OwnerUid)},{nameof(TraceEventEntity.EventId)}", isUnique: true);
            e.Index("idx_wms_trace_reel", $"{nameof(TraceEventEntity.OwnerUid)},{nameof(TraceEventEntity.ReelId)}", isUnique: false);
        });
    }

    private static void SyncWmsTables(IFreeSql fsql)
    {
        fsql.CodeFirst.SyncStructure(
            typeof(UserAccount),
            typeof(UserCredential),
            typeof(UserSession),
            typeof(WmsWorkspace),
            typeof(WarehouseEntity),
            typeof(WarehouseKeeperEntity),
            typeof(WarehouseBinEntity),
            typeof(SupplierEntity),
            typeof(CustomerEntity),
            typeof(PackagingSpecEntity),
            typeof(BarcodeRuleEntity),
            typeof(LabelTemplateEntity),
            typeof(MaterialSkuEntity),
            typeof(BomMasterEntity),
            typeof(AsnOrderEntity),
            typeof(ReelItemEntity),
            typeof(WorkOrderEntity),
            typeof(WaveOrderEntity),
            typeof(CycleCountTaskEntity),
            typeof(ScrapRecordEntity),
            typeof(TraceEventEntity));
    }
}
