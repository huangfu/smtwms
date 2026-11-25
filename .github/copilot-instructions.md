# GitHub Copilot Repository Instructions

本仓库以根目录 `AGENTS.md` 与 `.agents/skills/*/SKILL.md` 作为所有 AI 编程 Agent 的单一真相源（Single Source of Truth）。

在生成或修改代码前，请先遵循 `AGENTS.md` 中的全局红线，并根据改动模块按需读取 `.agents/skills/` 下对应的 `SKILL.md`：
- 通用纯逻辑解耦与测试：`.agents/skills/domain-logic-tdd/SKILL.md`
- 通用浏览器与移动端 UI 验收：`.agents/skills/browser-ui-verification/SKILL.md`
- SMT-WMS 领域防呆红线：`.agents/skills/smt-wms-domain-sop/SKILL.md`
- 工业 PDA 单功能扫码 UI（含统一 `<PdaScanField />` 扫码区组件规范）：`.agents/skills/pda-single-task-ui/SKILL.md`
- Zebra ZPL 可视化打印：`.agents/skills/zpl-thermal-printing/SKILL.md`
- 全栈与 .NET 10 DDD 同步：`.agents/skills/fullstack-ddd-sync/SKILL.md`

强制 UI 红线：所有扫码/条码输入框必须复用 `src/components/PdaScanField.tsx` 并遵循 MES 方案 B（深碳导航 + 浅灰作业区 + 深海工业青 + `.mes-panel`），错误与成功提示必须通过 `feedback` 插槽紧贴扫码框正下方就近展示并联动 2px 告警红框（严禁放到表单底部），同时调用 `src/utils/pdaScanFocus.ts` 实现成功清空获焦、失败保留全选获焦并自动回正视口。
