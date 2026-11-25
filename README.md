# 智造 SMT-WMS 智能电子仓储管理系统（前端工程）

面向电子制造（SMT / PCBA）车间的精益智能仓储前端应用，基于 **React 19 + TypeScript + Vite 8 + Tailwind CSS v4** 构建，支持「一盘一码 Reel UID 全程追溯」、复合产权隔离、单表特料/代用 BOM、IPC/JEDEC MSD 湿敏闭环、可视化 Zebra ZPL 标签设计与双通道直打，以及前后端完全分离架构。

---

## 1. 核心业务模块

| 模块 | 页面组件 | 核心能力 |
| --- | --- | --- |
| **仓储总览与看板** | `DashboardView` / `SmtAnomalyMonitor` / `LowStockAlertPanel` | 实时库存 KPI、缺料与低库存预警、MSD 湿敏超时锁定告警、快捷收料与 ASN 入口 |
| **入库与 ASN 管理** | `InboundView` / `AsnManagerPanel` | 手工建单与 CSV 批量导入 ASN、原厂条码规则自动解析（MPN/Lot/DC/Qty）、唯一 UID 赋码上架 |
| **波次发料与出库** | `WavePickView` | 多工单合并波次齐套、按单表 BOM 计算缺料、强制 DateCode 升序 FIFO 扫码硬拦截、跨客户产权防混发 |
| **产线补料与退料** | `ReplenishReturnView` | 抛料/断带按工单与机台扫码补料、完工余料退库、拆分子盘（`ParentReelId` 父子追溯）并重打新标 |
| **报废与循环盘点** | `ScrapCountView` | MRB 不良隔离与报废处置核销、按库区循环盘点与自动盈亏调账 |
| **全程扫码追溯** | `TraceabilityView` / `TopBar` | 顶部全局扫码入口，输入 UID / Lot / 工单号秒级正反向追溯完整流转履历 |
| **单表 BOM 管理** | `BomMasterView` | 单表维护机型主料（`MAIN`）、特料（`SPECIAL_MAIN`）与代用料（`SUBSTITUTE`）及位号损耗率 |
| **基础档案与台账** | `InventoryMasterView` 及 5 大子面板 | 仓库/库位/仓管员、供应商/客户、包装方式与 SPQ、物料清单（默认 MPN 料号 + `SKU+产权+归属` 复合键 + 客户绑定）、供应商条码规则 |
| **ZPL 标签设计器与打印** | `ZplLabelDesigner` / `ThermalLabelPreview` / `BarcodeLabelModal` | 自定义纸张 mm、203/300/600 DPI、整体 X/Y 偏移校准、多条码（Code128/QR/DM）与 HRI 样式编排、实时 ZPL 生成与预览 |
| **身份认证与多租户隔离** | `AuthGate` / `ChangePasswordModal` / `AuthContext` | 支持自定义工号/账号密码注册登录、修改密码，以及 Google 账号登录，租户数据严格隔离 |

---

## 2. 技术栈

- **前端框架**：React 19、TypeScript、Vite 8
- **样式与图标**：Tailwind CSS v4（`@tailwindcss/vite`）、`lucide-react`、`motion`
- **接口层与前后端分离**：`src/services/wmsApi.ts`（支持 `VITE_API_BASE_URL` 环境变量切换任意后端地址，自动携带 `Authorization: Bearer` 与 `credentials: 'include'`）
- **内置开发/预览后端**：Express + `tsx` + Drizzle ORM + PostgreSQL（`server.ts`）
- **独立企业级后端（可选对接）**：`backend-dotnet/`（`.NET 10 + FreeSql + DDD` 四层架构，支持 MSSQL / SQLite / PostgreSQL / MySQL）

---

## 3. 目录结构

```text
.
├── index.html                  # 应用 HTML 入口
├── vite.config.ts              # Vite 与 Tailwind 配置
├── server.ts                   # 本地一体化 Express + Vite 服务入口（默认监听 3000）
├── .env.example                # 环境变量示例
├── src/
│   ├── main.tsx                # React 挂载入口
│   ├── App.tsx                 # 主应用布局与模块路由调度
│   ├── index.css               # Tailwind 全局样式与字体配置
│   ├── components/             # 业务页面、基础档案面板与 ZPL 标签设计器
│   ├── context/                # AuthContext（账号密码会话 + Firebase Google 认证）
│   ├── services/               # wmsApi.ts（统一 API 客户端与 Zebra Browser Print 调用）
│   ├── types/                  # wms.ts 完整领域类型定义
│   ├── utils/                  # wmsLogic.ts（核心业务规则）、zplEngine.ts（ZPL 编译引擎）、passwordAuth.ts
│   ├── db/                     # Drizzle Schema、仓储与映射（供内置 Node 服务使用）
│   └── middleware/             # 鉴权中间件（供内置 Node 服务使用）
├── AGENTS.md                   # 跨 Agent 通用工程宪法与技能路由（Codex/Cursor/Windsurf/Copilot/Gemini 等自动读取）
├── CLAUDE.md                   # Claude Code 薄适配入口（引用 AGENTS.md）
├── .agents/skills/             # 开放 Agent Skills 标准目录（通用工程技能 + SMT-WMS 领域技能）
├── backend-dotnet/             # 独立前后端分离 .NET 10 + FreeSql + DDD 后端工程
├── docs/ai-dev/                # AI 研发协作指南与需求/缺陷沟通模板
├── downloads/                  # 新建工厂导入实施蓝图（PDF）与管理汇报方案（PPTX）
└── scripts/                    # 实施蓝图文档与演示文稿生成脚本
```

---

## 4. 快速启动

### 4.1 环境要求
- Node.js `>= 20`（推荐 `22.x`）
- npm / bun

### 4.2 安装依赖与启动

```bash
# 安装依赖
npm install

# 启动本地开发服务（默认 http://localhost:3000）
npm run dev
```

### 4.3 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动内置 Express + Vite 开发服务器（端口 `3000`） |
| `npm run build` | 执行 Vite 生产环境打包，产物输出至 `dist/` |
| `npm run start` | 以生产模式运行 `server.ts` 并托管 `dist/` 静态资源 |
| `npm run lint` | 运行 `tsc --noEmit` 执行全项目 TypeScript 类型检查 |

---

## 5. 前后端分离配置（对接 `.NET 10` 或自定义后端）

前端默认在未配置 `VITE_API_BASE_URL` 时采用同源相对路径请求（`/api/auth/*`、`/api/wms/*`）。  
若需对接独立的 `.NET 10 + FreeSql` 后端（支持 MSSQL / SQLite / PostgreSQL / MySQL），请按以下步骤操作：

1. 在项目根目录新建 `.env.local`（可参考 `.env.example`）：
   ```env
   VITE_API_BASE_URL="http://localhost:5000"
   ```
2. 按照 `backend-dotnet/README.md` 启动 `.NET 10` Web API 服务（确保其 `Cors:AllowedOrigins` 包含前端访问域名，例如 `http://localhost:3000`）。
3. 重启前端 `npm run dev` 或重新执行 `npm run build`，所有 API 请求将自动转发至指定后端地址。

---

## 6. Zebra ZPL 打印对接模式

系统支持三种打印输出方式，可在「基础档案 → 条码规则与标签模板」中配置：

1. **局域网 TCP Raw 9100 直连（推荐内网部署）**：配置 Zebra 打印机静态 IP 与端口 `9100`，支持连通性测试及毫秒级 Raw ZPL 无弹窗直打。
2. **本机 USB / Zebra Browser Print（推荐云端部署）**：工位电脑安装官方 Zebra Browser Print 客户端（默认 `http://127.0.0.1:9100`），浏览器直接探测本地 USB/网口斑马打印机下发 ZPL。
3. **离线导出 `.zpl` / 浏览器打印兜底**：无打印机环境下支持实时仿真预览与导出标准 ZPL 指令文件。

---

## 7. 单元测试

项目使用 Node.js 原生测试框架（`node:test`）覆盖核心仓储逻辑、ZPL 坐标编译引擎、密码认证、数据映射及前后端分离 API 路由解析：

```bash
npx tsx --test src/utils/wmsLogic.test.ts src/db/wmsMapper.test.ts src/utils/passwordAuth.test.ts src/services/wmsApi.test.ts
```

---

## 8. 相关工程与实施文档

- **独立 `.NET 10 + FreeSql + DDD` 多数据库后端说明**：见 `backend-dotnet/README.md`
- **新建工厂导入实施蓝图（PDF）**：见 `downloads/SMT-WMS-Factory-Onboarding-Blueprint.pdf`
- **新建工厂导入管理汇报（PPTX）**：见 `downloads/SMT-WMS-Factory-Onboarding-Deck.pptx`
