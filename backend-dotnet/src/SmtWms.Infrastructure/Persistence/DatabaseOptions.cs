namespace SmtWms.Infrastructure.Persistence;

/// <summary>
/// 多数据库配置项：支持 SQLite、MSSQL (SqlServer)、PostgreSQL、MySQL 一键切换，
/// 并支持读写分离（SlaveConnectionStrings）与多数据源注册（AdditionalDatabases）。
/// </summary>
public sealed class DatabaseOptions
{
    public const string SectionName = "Database";

    /// <summary>
    /// 主库驱动类型：Sqlite | SqlServer | PostgreSQL | MySql
    /// </summary>
    public string Provider { get; set; } = "Sqlite";

    /// <summary>
    /// 主库连接字符串
    /// </summary>
    public string ConnectionString { get; set; } = "Data Source=smtwms.db";

    /// <summary>
    /// 是否启用 FreeSql CodeFirst 自动迁移建表（开发环境建议 true，生产 MSSQL 可按需设为 false）
    /// </summary>
    public bool AutoSyncStructure { get; set; } = true;

    /// <summary>
    /// 是否输出 SQL 执行日志（用于排查慢查询或跨库 SQL 差异）
    /// </summary>
    public bool LogSql { get; set; } = false;

    /// <summary>
    /// 可选：读写分离从库连接字符串列表（MSSQL AlwaysOn / PostgreSQL 只读副本 / MySQL 主从）
    /// </summary>
    public List<string> SlaveConnectionStrings { get; set; } = [];

    /// <summary>
    /// 可选：多数据源配置（例如同时连接本地 SQLite 缓存库 + 企业 ERP MSSQL 库）
    /// Key 为数据源别名，例如 "ErpSqlServer"、"MesPostgres"
    /// </summary>
    public Dictionary<string, NamedDatabaseOption> AdditionalDatabases { get; set; } = new(StringComparer.OrdinalIgnoreCase);
}

public sealed class NamedDatabaseOption
{
    public string Provider { get; set; } = "SqlServer";
    public string ConnectionString { get; set; } = string.Empty;
    public bool AutoSyncStructure { get; set; } = false;
    public List<string> SlaveConnectionStrings { get; set; } = [];
}
