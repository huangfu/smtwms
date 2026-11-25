# 跨 Agent 通用 AI 辅助研发体系指南

本仓库遵循开放的 **Single Source of Truth（单一真相源）+ 多 Agent 自动发现适配层** 架构，确保无论您切换到 **Claude Code、OpenAI Codex、Cursor、Windsurf、GitHub Copilot、Gemini CLI、Cline 还是其他通用编程 Agent**，所有工程红线与领域 Skill 都能**开箱即用、自动生效、零内容漂移**。

---

## 1. 跨 Agent 标准目录布局

```text
.
├── AGENTS.md                                  # 【核心单一真相源】跨 Agent 开放标准入口（Codex/Cursor/Windsurf/Gemini/Cline 等自动读取）
├── CLAUDE.md                                  # 【薄适配层】Claude Code 自动加载入口（直接指向 @AGENTS.md）
├── .github/copilot-instructions.md            # 【薄适配层】GitHub Copilot 自动加载入口
├── .cursor/rules/project-constitution.mdc     # 【薄适配层】Cursor alwaysApply 自动加载入口
│
├── .agents/skills/                            # 【开放 Agent Skills 标准目录】跨 Agent 自动发现技能库
│   ├── domain-logic-tdd/SKILL.md              # [通用跨项目] 领域纯逻辑解耦与测试驱动防回归
│   ├── browser-ui-verification/SKILL.md       # [通用跨项目] 真实浏览器与多视口 UI 验收闭环
│   ├── smt-wms-domain-sop/SKILL.md            # [领域] SMT-WMS 业务 SOP 与防呆红线
│   ├── pda-single-task-ui/SKILL.md            # [领域] 工业手持 PDA 单功能扫码 UI 规范
│   ├── zpl-thermal-printing/SKILL.md          # [领域] Zebra ZPL 可视化打印与指令规范
│   └── fullstack-ddd-sync/SKILL.md            # [领域] 前后端分离与 .NET 10 + FreeSQL 多库 DDD 同步
│
└── docs/ai-dev/
    ├── README.md                              # 本指南（组织方法与迁移说明）
    └── templates/                             # 【给您填】面向人的轻量需求/缺陷沟通模板
        ├── 01-feature-requirement-template.md # 新功能需求模板（主力）
        ├── 02-bug-report-template.md          # 缺陷定位模板（截图 + 4 行）
        ├── 03-pda-workflow-spec-template.md   # PDA 单功能扫码规格模板
        └── 04-architecture-change-template.md # 重大架构 / 数据库 / 接口方案对齐模板
```

---

## 2. 换其他 Agent 时为什么不会失效？

| 目标 AI 编程 Agent | 自动读取的仓库文件 | 发现 Skill 的方式 |
| :--- | :--- | :--- |
| **OpenAI Codex / Gemini CLI / Windsurf / Amp / Cline / Zed** | 根目录 `AGENTS.md` | 自动发现 `.agents/skills/*/SKILL.md` + `AGENTS.md` 路由表 |
| **Claude Code** | 根目录 `CLAUDE.md`（`@AGENTS.md`） | 同步加载 `AGENTS.md` 并按需读取 `.agents/skills/*/SKILL.md` |
| **Cursor IDE** | `.cursor/rules/project-constitution.mdc` + `AGENTS.md` | `alwaysApply: true` 常驻生效并引导读取 `.agents/skills/` |
| **GitHub Copilot** | `.github/copilot-instructions.md` | 自动读取指令并指向 `AGENTS.md` 与 `.agents/skills/` |
| **任意新出的通用网页/本地 Agent** | 对话第一句说：`请先阅读 AGENTS.md` | 只需 1 句话即可加载整套规则与全部 6 个 Skill |

---

## 3. 如何迁移到您的下一个新项目？

当您开启一个全新的 MES / ERP / 工业项目时，只需把以下 **2 个通用件** 直接拷贝到新仓库即可：
1. 拷贝 `.agents/skills/domain-logic-tdd/` 与 `.agents/skills/browser-ui-verification/`（以及可复用的 `pda-single-task-ui/`、`zpl-thermal-printing/`、`fullstack-ddd-sync/`）。
2. 拷贝根目录的 `AGENTS.md`、`CLAUDE.md`、`.cursor/rules/`、`.github/copilot-instructions.md` 与 `docs/ai-dev/templates/`，把 `AGENTS.md` 里的项目简介替换成新项目即可。

---

## 4. 维护铁律（防止规范腐化）
- **单一真相源（SSOT）**：所有规则只写在 `AGENTS.md` 和 `.agents/skills/*/SKILL.md` 里；`CLAUDE.md`、`.cursor/rules/`、`.github/copilot-instructions.md` 永远只做几行薄指针，**绝不复制粘贴大段规则**。
- **沉淀即升级**：每次修完一个典型业务 Bug 或新增一条车间防呆规矩，直接追加到对应 `.agents/skills/<name>/SKILL.md` 的红线或反模式清单中，换任何 Agent 都永久有效。
