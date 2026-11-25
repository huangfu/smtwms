---
name: fullstack-ddd-sync
description: >-
  前后端数据分离架构与 .NET 10 + FreeSQL 多数据库（SQLite / MSSQL / PostgreSQL）
  DDD 后端同步规范。新增/变更 API 路由、请求响应契约、持久化字段或数据库实体时使用。
---

# 前后端分离与多库 DDD 后端同步规范

## 1. 适用场景
- 新增或修改 REST API 端点（如 Node/Express 中间层 `/api/wms/*` 或 `backend-dotnet/` 中的 `.NET 10` API）。
- 为现有实体增加持久化字段（如 ASN 的 `receivingCompletedAt`、`iqcNote`、`workflowStage`）。
- 调整身份认证（JWT / Session / 自定义账号密码登录）或数据库映射逻辑。

---

## 2. 架构与同步铁律（MUST）

### 2.1 前后端完全解耦契约
- 前端所有数据请求必须经由统一 API 服务层（`src/services/wmsApi.ts`），通过 `VITE_API_BASE_URL` 控制后端地址：
  - 未配置时默认走同源相对路径（`/api/*`）；
  - 配置独立后端地址（如 `http://localhost:5080`）时无缝切换至 `.NET 10` 服务，业务组件零改动。
- 认证凭证采用标准 `Authorization: Bearer <token>`（及同源 Cookie 兼容），禁止把密钥或数据库连接串暴露在前端代码或 `VITE_*` 变量中。

### 2.2 字段变更四端同步检查
每当业务模型新增字段或状态枚举时，必须同步检查以下 4 处，避免出现“刷新页面状态丢失”：
1. **领域类型定义**：`src/types/wms.ts`（前端 TS 类型）。
2. **领域纯逻辑与旧数据归一化**：`src/utils/wmsLogic.ts`（`normalizeWmsState` 必须能平滑兼容数据库里的历史记录）。
3. **Node 持久化映射层与路由**：`src/db/wmsMapper.ts`（序列化/反序列化）+ `server.ts`（API 路由）。
4. **.NET 10 DDD 后端对应层**（当本次需求涉及 .NET 后端同步时）：
   - `Domain`（实体/值对象/领域事件与业务规则）
   - `Application`（Command/Query/DTO/应用服务）
   - `Infrastructure`（FreeSQL 仓储实现与多库字段类型兼容）
   - `WebApi`（Endpoint/Controller 路由与错误码映射）

### 2.3 多数据库兼容注意（SQLite / MSSQL / PostgreSQL）
- 严禁在应用逻辑中拼接某单一数据库方言的原生 SQL（如仅 PostgreSQL 支持的语法或仅 MSSQL 的 `TOP`/`GETDATE()`）；统一通过 ORM/Query Builder 或参数化查询处理。
- JSON/扩展元数据字段在关系表中需做好明确序列化与反序列化单元测试（如 `wmsMapper.test.ts`）。
- 所有输入参数必须校验，密码哈希必须使用加盐慢哈希（如 `scrypt` / `PBKDF2`），禁止明文存储或弱哈希。

---

## 3. 禁止的反模式（DON'T）
- ❌ **禁止只改前端 `useState` 而不走后端持久化接口**：用户刷新页面后所有作业记录必须真实留存。
- ❌ **禁止在前端做“假成功提示”**：提交动作必须真实等待后端响应并回写权威状态，失败时清晰展示错误原因。
- ❌ **禁止把破坏性 schema 变更直接推向生产**：新增字段优先兼容可空默认值或在归一化层自动补齐旧数据。

---

## 4. 交付前自检清单
- [ ] API URL 解析与请求服务测试（`wmsApi.test.ts`）、认证测试（`passwordAuth.test.ts`）、数据库映射测试（`wmsMapper.test.ts`）全部通过。
- [ ] 新增字段在「写入 → 刷新页面重新拉取 → 再次渲染」闭环中无丢失。
- [ ] 新增环境变量已同步登记至 `.env.example`（不含真实密钥）。
