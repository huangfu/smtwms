# SMT-WMS 独立后端服务（.NET 10 + FreeSql + DDD 多数据库架构）

本目录为与 React 前端完全前后端分离的独立 **.NET 10 Web API** 工程，基于 **DDD 四层架构** 与 **FreeSql (`3.5.311`)** 构建，支持 **SQLite、Microsoft SQL Server (MSSQL)、PostgreSQL、MySQL** 一键切换、读写分离及多数据源并发注册。

> **说明**：在线预览沙盒为 Node.js 运行环境（未预装 `.NET 10 SDK`），因此当前在线预览仍由内置 Node.js + Cloud SQL 服务支撑；将本项目导出到本地或企业内网服务器（安装 `.NET 10 SDK`）后，即可直接启动本后端并与前端通过 `VITE_API_BASE_URL` 联调。

---

## 1. DDD 四层目录结构

```text
backend-dotnet/
├── SmtWms.sln
└── src/
    ├── SmtWms.Domain/            # 领域层（零数据库与 Web 依赖）
    │   ├── Common/               # Entity, AggregateRoot, DomainException
    │   ├── Entities/             # UserAccount, ReelItemEntity, WorkOrderEntity 等 21 个领域实体
    │   ├── ValueObjects/         # MaterialCompositeKey (SKU+产权复合键), MsdFloorLifePolicy (IPC/JEDEC)
    │   └── Repositories/         # IUserRepository, IWmsWorkspaceRepository 仓储契约
    ├── SmtWms.Application/       # 应用层（用例编排与 DTO 契约）
    │   ├── Contracts/            # 1:1 对齐 React src/services/wmsApi.ts 的 JSON 契约
    │   ├── Interfaces/           # IPasswordHasher, IZebraTcpPrinter 端口接口
    │   └── Services/             # AuthAppService, WmsAppService, WmsSeedFactory
    ├── SmtWms.Infrastructure/    # 基础设施层（FreeSql 多数据库 + 安全 + 硬件通讯）
    │   ├── Persistence/          # DatabaseOptions, FreeSqlFactory, MultiDatabaseRegistry, 仓储实现
    │   ├── Security/             # Pbkdf2PasswordHasher (PBKDF2-SHA512 + SHA-256 会话令牌)
    │   ├── Printing/             # ZebraTcpPrinterClient (TCP Raw 9100 ZPL 直连)
    │   └── DependencyInjection.cs
    └── SmtWms.WebApi/            # 接口表现层 (.NET 10 ASP.NET Core)
        ├── Controllers/          # AuthController, WmsController, ZebraPrintController
        ├── Middleware/           # GlobalExceptionMiddleware, SessionAuthMiddleware
        ├── appsettings.json      # 默认 SQLite 零配置启动
        └── appsettings.SqlServer.example.json  # 生产 MSSQL + 读写分离 + 多库示例
```

---

## 2. 切换数据库（SQLite / MSSQL / PostgreSQL / MySQL）

无需修改任何业务代码，只需调整 `src/SmtWms.WebApi/appsettings.json` 中的 `Database` 节点（或通过环境变量 `Database__Provider` / `Database__ConnectionString` 覆盖）：

### 2.1 连接 Microsoft SQL Server (MSSQL)

```json
{
  "Database": {
    "Provider": "SqlServer",
    "ConnectionString": "Server=192.168.1.50,1433;Database=SmtWmsDb;User Id=sa;Password=YourStrong!Passw0rd;TrustServerCertificate=True;Encrypt=True;",
    "AutoSyncStructure": true,
    "SlaveConnectionStrings": [],
    "AdditionalDatabases": {}
  }
}
```

### 2.2 切换为 SQLite（默认，零配置）

```json
{
  "Database": {
    "Provider": "Sqlite",
    "ConnectionString": "Data Source=smtwms.db",
    "AutoSyncStructure": true
  }
}
```

### 2.3 切换为 PostgreSQL 或 MySQL

- **PostgreSQL**：`Provider` 设为 `"PostgreSQL"`，`ConnectionString` 为 `Host=...;Port=5432;Database=smt_wms;Username=...;Password=...;`
- **MySQL / MariaDB**：`Provider` 设为 `"MySql"`，`ConnectionString` 为 `Server=...;Port=3306;Database=smt_wms;Uid=...;Pwd=...;Charset=utf8mb4;`

### 2.4 多数据源与读写分离

- **读写分离**：在 `Database:SlaveConnectionStrings` 中填入只读副本连接串（例如 MSSQL AlwaysOn ReadOnly 副本），FreeSql 自动将查询分流到从库。
- **多数据源并发**：在 `Database:AdditionalDatabases` 中声明多个命名库（如 `ErpSqlServer`、`LocalEdgeSqlite`），在基础设施服务中注入 `IMultiDatabaseRegistry` 并调用 `registry.Get("ErpSqlServer")` 即可跨库查询。

---

## 3. 本地启动与前后端分离联调

### 启动 .NET 10 后端（默认监听 `http://localhost:5000`）

```bash
cd backend-dotnet
dotnet restore
dotnet run --project src/SmtWms.WebApi --urls http://localhost:5000
```

- 启动后会自动通过 FreeSql CodeFirst 创建全部 21 张数据表（含唯一索引及跨库 `NVARCHAR(MAX)/TEXT/LONGTEXT` 字段）。
- 查看数据库健康与当前驱动状态：`GET http://localhost:5000/api/wms/health/db`
- 开发环境 OpenAPI 3.1 文档：`GET http://localhost:5000/openapi/v1.json`

### 前端指向独立 .NET 10 后端

在项目根目录创建 `.env.local` 并配置：

```bash
VITE_API_BASE_URL="http://localhost:5000"
```

随后运行前端开发服务：

```bash
npm run dev
```

前端 `src/services/wmsApi.ts` 会自动将所有 `/api/auth/*` 与 `/api/wms/*` 请求发送至 `http://localhost:5000`（携带 `Authorization: Bearer wms_sess_...` 与 `credentials: 'include'`）。
