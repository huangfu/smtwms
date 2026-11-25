# AGENTS.md — 跨 Agent 通用工程宪法与技能路由（Single Source of Truth）

> 本文件遵循开放的 **AGENTS.md + Agent Skills (`.agents/skills/`)** 跨工具标准。无论当前执行任务的是 **Claude Code、OpenAI Codex、Cursor、Windsurf、GitHub Copilot、Gemini CLI、Cline 还是其他通用编程 Agent**，开工前均须遵守本文件约定，并按场景读取 `.agents/skills/` 下对应的 `SKILL.md`。

---

## 1. 项目概览与技术栈
- **项目定位**：SMT-WMS 电子制造智能仓储管理系统（支持 PC 管理端 + 390×844 工业移动 PDA 扫码端）。
- **前端**：React 19 + TypeScript + Vite 8 + Tailwind CSS v4（`src/`）。
- **内置 Node 服务端**：Express + `tsx` + Drizzle ORM + PostgreSQL（`server.ts`、`src/db/`），支持账号密码登录与多租户隔离。
- **独立企业级后端**：`backend-dotnet/`（`.NET 10 + FreeSql + DDD` 四层架构，支持 MSSQL / SQLite / PostgreSQL / MySQL）。
- **常用命令**：
  - 类型检查：`npm run lint`（`tsc --noEmit`）
  - 生产构建：`npm run build`
  - 核心单元测试：`npx --yes tsx --test src/utils/wmsLogic.test.ts src/db/wmsMapper.test.ts src/utils/passwordAuth.test.ts src/services/wmsApi.test.ts`

---

## 2. 技能自动路由表（按任务按需读取 `.agents/skills/`）

在修改或新增代码前，先根据任务类型读取对应的标准化 `SKILL.md`：

| 任务触发场景 | 必须读取的 Skill 路径 | 适用范围 |
| :--- | :--- | :--- |
| 任何核心业务规则、状态机、计算公式、Bug 修复 | `.agents/skills/domain-logic-tdd/SKILL.md` | 通用（跨项目适用） |
| 任何 UI 改版、页面交互、PDA 移动端适配验收 | `.agents/skills/browser-ui-verification/SKILL.md` | 通用（跨项目适用） |
| 收料 ASN、IQC 质检、入库上架、MRB 不良隔离、FIFO、MSD、产权隔离 | `.agents/skills/smt-wms-domain-sop/SKILL.md` | SMT-WMS 领域 |
| 移动 PDA 单功能扫码页、连扫自动匹配、已刷/作业中/未刷 3-Tab | `.agents/skills/pda-single-task-ui/SKILL.md` | 工业 PDA 交互 |
| Zebra ZPL 可视化标签设计、DPI、自定义纸张、全局 X/Y 偏移、HRI 样式 | `.agents/skills/zpl-thermal-printing/SKILL.md` | 热敏打印领域 |
| 新增/修改 API 契约、数据库持久化字段、同步 `.NET 10 + FreeSQL` 后端 | `.agents/skills/fullstack-ddd-sync/SKILL.md` | 全栈多库 DDD |

---

## 3. 全局不可违背红线（所有 Agent 强制生效）

1. **安全与配置**：严禁硬编码 API Key、数据库密码或私钥；所有环境变量登记在 `.env.example`（脱敏）；密码必须使用加盐慢哈希，SQL 必须参数化。
2. **职责与防呆底线（三权分立 + 7 阶段门禁）**：
   - **采购 / 仓库 / IQC 严格三权分立（`src/utils/roleAccess.ts`）**：ASN 建单/导入仅归属采购部，严禁出现在仓库菜单、仓库看板弹窗或仓库作业画面中；仓库部仅处理待收料初步收料并发送异步「IQC 报检通知」，以及接收 IQC 放行后的「合格品入库上架」；IQC 品质部独立作业并在放行后异步通知仓库，**严禁仓库与 IQC 页面之间出现直接跳转或互相暴露页面入口**。
   - 收料 7 阶段严格顺序：`供应商送货 → 预约登记(ASN) → 收料登记 → IQC质检 → 入库上架 → 库存更新 → 信息同步`。
   - 预约与收料阶段**严禁**出现 IQC 合格/不良选项；未收齐禁止 IQC；未完成 IQC 禁止上架。
   - **IQC 整行判定不良（`iqcPassedQty <= 0`）的物料严禁出现在入库上架列表（已刷/作业中/未刷）中**，严禁渲染为 `0/0 已上架入库`。
3. **逻辑与验证底线**：
   - 领域规则必须抽离在纯函数模块中并补齐 `node:test` 单元测试，禁止把核心业务校验只写在前端点击事件里。
   - 交付前必须在最后一次修改之后跑通：**单元测试 + `npm run lint` + `npm run build`**；涉及 UI/PDA 改动须在真实浏览器对应视口验证交互与无控制台报错。
4. **UI 视觉与扫码区组件统一底线（防风格割裂 + 零手工介入连扫 + 零滚屏就近报错）**：
   - 全站严格遵循 **MES 方案 B（深碳导航 `#11161E` + 浅灰作业区 `#F3F5F7` + 深海工业青 `teal-700/800`）** 与 `.mes-panel` 容器体系。
   - **全站所有扫码输入区必须统一复用 `src/components/PdaScanField.tsx`**（2px 深海青扫描边框 + 左侧 `ScanBarcode` 图标 + `min-h-[48px]` 触控高度 + 统一高对比禁用态按钮），严禁在补料、退库、报废、领料、入库、盘点或追溯等任一页面手写普通 `<input>` 或纯 `<select>` 替代扫码框。
   - **扫码完成后标准作业逻辑（强制调用 `src/utils/pdaScanFocus.ts`）**：业务成功 → 自动清空扫码框 + 自动获焦 + 联动清单/表单/追溯数据自动更新；业务失败 → 保留上次刷入值 + 内容全选（`.select()`）+ 保持焦点（`.focus()`）+ `scrollIntoView` 自动回正，确保作业员处理后可直接重扫，无需人工介入 UI。
   - **错误/结果就近反馈与红框联动（浏览器端 PDA 零滚屏可见）**：所有扫码与作业报错/成功提示必须通过 `<PdaScanField feedback={...} />` 内置插槽紧贴输入框正下方显示，严禁放在表单底部导致 PDA 竖屏需要滚屏才能看到原因；报错时扫码框与左侧图标自动切换为 2px 告警红（`border-red-600` + `aria-invalid`），重新输入时立即恢复深海工业青。
5. **需求模板协作约定**：用户可使用 `docs/ai-dev/templates/` 下的 4 套模板发起需求、报 Bug 或对齐重大架构方案；若用户指定“先出方案再编码”，必须先等待确认后再改代码。
