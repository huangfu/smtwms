import fs from 'node:fs';
import path from 'node:path';
import PptxGenJS from 'pptxgenjs';

const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_16x9'; // 10 x 5.625 in
pptx.author = 'SMT-WMS Engineering Team';
pptx.company = '智造 SMT-WMS';
pptx.subject = '新建工厂导入 SMT-WMS 智能仓储系统实施方案与管理模式设计';
pptx.title = '新建工厂导入 SMT-WMS 实施方案';

const C = {
  navy: '0F2942',
  deepNavy: '0B1F33',
  sky: '0284C7',
  lightSky: 'E0F2FE',
  paleBg: 'F8FAFC',
  white: 'FFFFFF',
  slate: '334155',
  muted: '64748B',
  border: 'CBD5E1',
  amber: 'D97706',
  amberBg: 'FFFBEB',
  green: '16A34A',
  greenBg: 'F0FDF4',
  red: 'DC2626',
  redBg: 'FEF2F2',
};

const FONT = 'Microsoft YaHei';

const textRow = (cells: string[]): PptxGenJS.TableRow => cells.map((text) => ({ text }));

function addSlideHeader(slide: PptxGenJS.Slide, num: string, title: string, subtitle: string, pageIdx: number) {
  slide.background = { color: C.white };
  // Top accent bar
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 10, h: 0.08, fill: { color: C.sky }, line: { color: C.sky } });
  // Section badge
  slide.addShape(pptx.ShapeType.rect, { x: 0.45, y: 0.25, w: 0.48, h: 0.42, fill: { color: C.navy }, line: { color: C.navy } });
  slide.addText(num, {
    x: 0.45, y: 0.25, w: 0.48, h: 0.42,
    fontFace: FONT, fontSize: 14, bold: true, color: '7DD3FC', align: 'center', valign: 'middle',
  });
  slide.addText(title, {
    x: 1.05, y: 0.22, w: 7.8, h: 0.34,
    fontFace: FONT, fontSize: 19, bold: true, color: C.navy,
  });
  slide.addText(subtitle, {
    x: 1.05, y: 0.54, w: 8.2, h: 0.22,
    fontFace: FONT, fontSize: 9.5, color: C.muted,
  });
  // Divider line
  slide.addShape(pptx.ShapeType.line, { x: 0.45, y: 0.82, w: 9.1, h: 0, line: { color: C.border, width: 1 } });

  // Footer
  slide.addShape(pptx.ShapeType.line, { x: 0.45, y: 5.28, w: 9.1, h: 0, line: { color: 'E2E8F0', width: 0.75 } });
  slide.addText('新建电子制造工厂导入 SMT-WMS 实施方案与管理模式设计', {
    x: 0.45, y: 5.33, w: 6.5, h: 0.22,
    fontFace: FONT, fontSize: 8, color: C.muted,
  });
  slide.addText(`${pageIdx} / 12`, {
    x: 8.6, y: 5.33, w: 0.95, h: 0.22,
    fontFace: FONT, fontSize: 8.5, bold: true, color: C.navy, align: 'right',
  });
}

// ============================================================
// SLIDE 1: COVER
// ============================================================
{
  const s = pptx.addSlide();
  s.background = { color: C.deepNavy };
  // Decorative right geometric panel
  s.addShape(pptx.ShapeType.rect, { x: 7.2, y: 0, w: 2.8, h: 5.625, fill: { color: C.navy }, line: { color: C.navy } });
  s.addShape(pptx.ShapeType.rect, { x: 7.2, y: 0, w: 0.06, h: 5.625, fill: { color: C.sky }, line: { color: C.sky } });

  // Top tag
  s.addShape(pptx.ShapeType.roundRect, {
    x: 0.65, y: 0.72, w: 3.45, h: 0.34, rectRadius: 0.05,
    fill: { color: '0C4A6E' }, line: { color: '38BDF8', width: 1 },
  });
  s.addText('SMT-WMS GREENFIELD IMPLEMENTATION', {
    x: 0.65, y: 0.72, w: 3.45, h: 0.34,
    fontFace: FONT, fontSize: 9.5, bold: true, color: '7DD3FC', align: 'center', valign: 'middle',
  });

  s.addText('新建工厂导入 SMT-WMS\n智能仓储系统实施方案', {
    x: 0.65, y: 1.35, w: 6.2, h: 1.45,
    fontFace: FONT, fontSize: 30, bold: true, color: C.white, lineSpacingMultiple: 1.18,
  });
  s.addText('准入条件 · 主数据标准 · 硬件选型 · 车间管理模式 · 8 周落地路线图', {
    x: 0.65, y: 2.95, w: 6.2, h: 0.42,
    fontFace: FONT, fontSize: 13, color: 'BAE6FD',
  });
  s.addShape(pptx.ShapeType.rect, { x: 0.65, y: 3.55, w: 1.6, h: 0.06, fill: { color: '38BDF8' }, line: { color: '38BDF8' } });

  s.addText('架构支撑：前后端分离（React + .NET 10 + FreeSql 多库 MSSQL/SQLite/PG）\n核心能力：一盘一码 UID · 复合产权隔离 · 单表特料/代用 BOM · MSD 防潮闭环 · Zebra ZPL', {
    x: 0.65, y: 3.8, w: 6.3, h: 0.75,
    fontFace: FONT, fontSize: 9.5, color: 'CBD5E1', lineSpacingMultiple: 1.4,
  });

  // Right-side 4 pillars summary
  const pillars = [
    ['01', '前置准入条件', '组织 · 空间 · 网络 · 红线'],
    ['02', '7 大主数据准备', '4 批次初始化与编码规范'],
    ['03', '硬件与部署架构', '300DPI Zebra · 点数机 · MSSQL'],
    ['04', '6 大车间管理闭环', 'FIFO · MSD · 产权隔离 · 追溯'],
  ];
  pillars.forEach(([n, t, d], idx) => {
    const y = 0.95 + idx * 1.05;
    s.addShape(pptx.ShapeType.roundRect, {
      x: 7.48, y, w: 2.22, h: 0.85, rectRadius: 0.05,
      fill: { color: '163A5C' }, line: { color: '2B5C8A', width: 1 },
    });
    s.addText(`${n}  ${t}`, {
      x: 7.6, y: y + 0.12, w: 2.0, h: 0.28,
      fontFace: FONT, fontSize: 11, bold: true, color: C.white,
    });
    s.addText(d, {
      x: 7.6, y: y + 0.44, w: 2.0, h: 0.26,
      fontFace: FONT, fontSize: 8.5, color: '93C5FD',
    });
  });

  s.addText('编制：SMT-WMS 工程实施组   |   版本：V1.0   |   2026 年 11 月', {
    x: 0.65, y: 5.05, w: 6.2, h: 0.3,
    fontFace: FONT, fontSize: 9, color: '94A3B8',
  });
  s.addNotes('开场说明：本方案面向新建 SMT / PCBA 电子制造工厂，结合当前 SMT-WMS 系统的核心数据模型与前后端分离架构，系统阐述从零导入所需的准入条件、数据与硬件准备、车间管理模式及 8 周落地路径。');
}

// ============================================================
// SLIDE 2: EXECUTIVE SUMMARY & GOALS
// ============================================================
{
  const s = pptx.addSlide();
  addSlideHeader(s, '01', '新建工厂导入 SMT-WMS 的核心价值与目标', '跳过手工 Excel 粗放阶段，一步到位建立一盘一码、防错防呆的精益电子仓', 2);

  const kpis = [
    ['≥ 99.8%', '库存账实准确率', 'X-Ray 复点退料 + 循环盘点平账', C.sky],
    ['0%', 'FIFO / MSD 违规上线', '扫码硬拦截取代人工肉眼核对', C.green],
    ['≤ 15 秒', '单盘收料赋码耗时', '原厂条码解析 + Zebra ZPL 直打', C.amber],
    ['≤ 10 秒', '全链路批次追溯', '支持 UID / Lot / 工单双向秒查', C.navy],
  ];
  kpis.forEach(([val, lbl, sub, col], i) => {
    const x = 0.45 + i * 2.33;
    s.addShape(pptx.ShapeType.roundRect, {
      x, y: 1.05, w: 2.18, h: 1.32, rectRadius: 0.06,
      fill: { color: C.paleBg }, line: { color: C.border, width: 1 },
    });
    s.addShape(pptx.ShapeType.rect, { x, y: 1.05, w: 2.18, h: 0.07, fill: { color: col }, line: { color: col } });
    s.addText(val, { x: x + 0.12, y: 1.2, w: 1.94, h: 0.46, fontFace: FONT, fontSize: 22, bold: true, color: col });
    s.addText(lbl, { x: x + 0.12, y: 1.68, w: 1.94, h: 0.25, fontFace: FONT, fontSize: 10.5, bold: true, color: C.navy });
    s.addText(sub, { x: x + 0.12, y: 1.96, w: 1.94, h: 0.34, fontFace: FONT, fontSize: 8.3, color: C.muted });
  });

  // Pain points vs Solution comparison table
  const rows: PptxGenJS.TableRow[] = [
    [
      { text: '新厂常见痛点', options: { bold: true, color: C.white, fill: { color: C.navy } } },
      { text: '传统手工/Excel 模式弊端', options: { bold: true, color: C.white, fill: { color: C.navy } } },
      { text: '本 SMT-WMS 系统级解决方案', options: { bold: true, color: C.white, fill: { color: C.sky } } },
    ],
    textRow(['初期无 ERP 支撑', '系统无法启动或被迫手工录单，账物脱节', '内置 SKU/BOM/工单/ASN 完整闭环，支持独立无 ERP 快速上线']),
    textRow(['多客户客供料混发', '同一 MPN 多家客户共用料架，误发导致索赔', 'SKU+产权+归属复合主键 + 客户强绑定，发料/补料系统硬拦截']),
    textRow(['MSD 湿敏爆板隐患', '靠纸质湿度卡人工估算暴露时长，极易遗漏', '发料拆封自动启表、超时强制锁盘、125°C 烘烤复位全留痕']),
    textRow(['余料退库黑洞', '产线估数退库、旧标签不换，次月账实误差 >10%', '退料复点 + 拆分子盘（父子追溯）+ Zebra ZPL 实时重打新标']),
  ];
  s.addTable(rows, {
    x: 0.45, y: 2.6, w: 9.1, h: 2.45,
    colW: [1.8, 3.2, 4.1],
    fontFace: FONT, fontSize: 9.5, color: C.slate,
    border: { type: 'solid', color: C.border, pt: 0.75 },
    valign: 'middle',
    autoPage: false,
  });

  s.addNotes('讲解要点：强调新建工厂最大的红利是没有历史脏数据，应直接绕过手工账阶段，一步到位把防错规则写进系统。');
}

// ============================================================
// SLIDE 3: FOUR PREREQUISITES
// ============================================================
{
  const s = pptx.addSlide();
  addSlideHeader(s, '02', '新建工厂导入四大前置准入条件', '人、场、网、制四维达标，确保系统真正落地而非事后补录', 3);

  const cards = [
    {
      title: '1. 组织与岗位权责就绪（人）',
      color: C.sky,
      bg: C.paleBg,
      items: [
        '明确项目总负责人（仓储/供应链负责人），具备跨 PMC/工程/生产拍板权',
        '配置 6 大专职角色并实行「一人一账号」：仓库主管、仓管员、IQC/MSD 专员、PMC、ME、IT',
        '全员通过扫码枪、ZPL 打印、防呆报错实操考核后方可上岗',
      ],
    },
    {
      title: '2. 物理仓区与环境达标（场）',
      color: C.green,
      bg: C.greenBg,
      items: [
        '电子料主仓符合 EPA 防静电标准（20–26°C，30–60% RH）',
        'MSD 防潮专仓配备低湿氮气柜（RH < 5%）与 125°C 恒温烤箱',
        '划分五区硬隔离（IQC/主仓/MSD/线边/MRB），货架全部张贴物理库位码',
      ],
    },
    {
      title: '3. 网络与 IT 基础设施（网 / 算）',
      color: C.navy,
      bg: C.lightSky,
      items: [
        '操作台千兆有线 + 全库区与 SMT 产线工业级 Wi-Fi 6 无缝漫游',
        '部署独立应用/数据库服务器（推荐 MSSQL 或 PostgreSQL + 每日异地全备）',
        '网口 Zebra 打印机配置静态 IP 且放通 TCP 9100；USB 工位预装 Browser Print',
      ],
    },
    {
      title: '4. 不可逾越的 4 条管理红线（制）',
      color: C.red,
      bg: C.redBg,
      items: [
        '一盘一码：无系统唯一 Reel UID 标签的料盘严禁上架或上线',
        '见单发料：杜绝口头借料、先拿后补，急料统一走扫码「补料」流程',
        '敬畏防呆：严禁跳过 FIFO 拦截，严禁 MSD 超时未烘烤强行上线，严禁跨客户挪料',
      ],
    },
  ];

  cards.forEach((c, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = 0.45 + col * 4.65;
    const y = 1.02 + row * 2.08;
    s.addShape(pptx.ShapeType.roundRect, {
      x, y, w: 4.45, h: 1.92, rectRadius: 0.06,
      fill: { color: c.bg }, line: { color: C.border, width: 1 },
    });
    s.addShape(pptx.ShapeType.rect, { x, y, w: 0.09, h: 1.92, fill: { color: c.color }, line: { color: c.color } });
    s.addText(c.title, {
      x: x + 0.22, y: y + 0.12, w: 4.1, h: 0.3,
      fontFace: FONT, fontSize: 12, bold: true, color: C.navy,
    });
    s.addText(
      c.items.map((t) => ({ text: t, options: { bullet: true, breakLine: true } })),
      {
        x: x + 0.22, y: y + 0.46, w: 4.08, h: 1.38,
        fontFace: FONT, fontSize: 9.5, color: C.slate, lineSpacingMultiple: 1.25,
      }
    );
  });
  s.addNotes('讲解要点：第四象限「管理红线」是新厂最容易松懈的环节，必须在项目启动会上由厂长签发制度公告。');
}

// ============================================================
// SLIDE 4: PHYSICAL LAYOUT & FLOW
// ============================================================
{
  const s = pptx.addSlide();
  addSlideHeader(s, '03', '物理仓区规划与防静电 / 防潮物流动线', '五区硬隔离布局，让实体物流与系统状态机 1:1 同频运转', 4);

  const zones = [
    { x: 0.45, y: 1.15, w: 1.65, h: 2.35, title: '1. 收货 / IQC 区', bg: 'F0F9FF', bd: C.sky, lines: ['• ASN 预约核验', '• 扫原厂码解析', '• ZPL 赋唯一 UID', '• 贴标分流上架'] },
    { x: 2.4, y: 1.05, w: 2.1, h: 1.15, title: '2A. 电子料主仓 (EPA)', bg: C.white, bd: C.navy, lines: ['• 20–26°C / 30–60%RH', '• 自购/客供/VMI 分区存放'] },
    { x: 2.4, y: 2.35, w: 2.1, h: 1.15, title: '2B. MSD 防潮烘烤仓', bg: C.amberBg, bd: C.amber, lines: ['• 氮气柜 RH<5% + 烤箱', '• MSL 2a–5a 拆封计时锁盘'] },
    { x: 4.82, y: 1.15, w: 1.95, h: 2.35, title: '3. 波次备料发料区', bg: C.greenBg, bd: C.green, lines: ['• 多工单合并齐套', '• 强制 FIFO 拣货', '• 客户防混发硬拦截', '• 备料车配发产线'] },
    { x: 7.1, y: 1.15, w: 2.45, h: 2.35, title: '4. SMT 线边仓 (LINE)', bg: C.navy, bd: C.navy, dark: true, lines: ['• 按工单 / 站位上线贴片', '• 抛料异常 → 扫码补料', '• 完工余料 → 点数退库', '• MSD 拆封自动倒计时'] },
  ];

  zones.forEach((z) => {
    s.addShape(pptx.ShapeType.roundRect, {
      x: z.x, y: z.y, w: z.w, h: z.h, rectRadius: 0.06,
      fill: { color: z.bg }, line: { color: z.bd, width: 1.5 },
    });
    s.addText(z.title, {
      x: z.x + 0.1, y: z.y + 0.1, w: z.w - 0.2, h: 0.3,
      fontFace: FONT, fontSize: 10.5, bold: true, color: z.dark ? '7DD3FC' : C.navy,
    });
    s.addText(z.lines.join('\n'), {
      x: z.x + 0.1, y: z.y + 0.44, w: z.w - 0.2, h: z.h - 0.5,
      fontFace: FONT, fontSize: 9, color: z.dark ? C.white : C.slate, lineSpacingMultiple: 1.32,
    });
  });

  // Arrows between zones
  const arrows = [
    { x: 2.13, y: 1.6, w: 0.24 },
    { x: 2.13, y: 2.85, w: 0.24 },
    { x: 4.53, y: 1.6, w: 0.26 },
    { x: 4.53, y: 2.85, w: 0.26 },
    { x: 6.8, y: 2.22, w: 0.26 },
  ];
  arrows.forEach((a) => {
    s.addShape(pptx.ShapeType.rightArrow, {
      x: a.x, y: a.y, w: a.w, h: 0.18,
      fill: { color: C.sky }, line: { color: C.sky },
    });
  });

  // Bottom return & MRB bar
  s.addShape(pptx.ShapeType.roundRect, {
    x: 0.45, y: 3.85, w: 5.7, h: 1.15, rectRadius: 0.06,
    fill: { color: C.lightSky }, line: { color: C.sky, width: 1.2 },
  });
  s.addText('逆向物流闭环：完工余料退库 & 拆子盘回仓', {
    x: 0.62, y: 3.96, w: 5.3, h: 0.28,
    fontFace: FONT, fontSize: 10.5, bold: true, color: C.navy,
  });
  s.addText('SMT 线边下机余料 → 经 X-Ray / 光学点数机复点真实数量 → 系统执行退库或拆分子盘（保留 ParentReelId 父子追溯）→ 重打最新数量 ZPL 标签 → 良品回主仓 / MSD 料盘回防潮柜。', {
    x: 0.62, y: 4.28, w: 5.35, h: 0.62,
    fontFace: FONT, fontSize: 9, color: C.slate, lineSpacingMultiple: 1.3,
  });

  s.addShape(pptx.ShapeType.roundRect, {
    x: 6.35, y: 3.85, w: 3.2, h: 1.15, rectRadius: 0.06,
    fill: { color: C.redBg }, line: { color: C.red, width: 1.2 },
  });
  s.addText('5. MRB 不良 / 报废隔离区', {
    x: 6.52, y: 3.96, w: 2.9, h: 0.28,
    fontFace: FONT, fontSize: 10.5, bold: true, color: '991B1B',
  });
  s.addText('物理上锁隔离受潮/氧化/抛损料盘，品质判定后在系统执行报废核销，严禁误混良品库。', {
    x: 6.52, y: 4.28, w: 2.9, h: 0.62,
    fontFace: FONT, fontSize: 9, color: '7F1D1D', lineSpacingMultiple: 1.3,
  });

  s.addNotes('讲解要点：强调货架编码如 A-01-01（排-架-层）必须物理贴码，客供与自购料最好通过明显颜色分区牌实现物理目视化隔离。');
}

// ============================================================
// SLIDE 5: MASTER DATA PREPARATION
// ============================================================
{
  const s = pptx.addSlide();
  addSlideHeader(s, '04', '7 大主数据准备清单与 4 批次初始化顺序', '严格按外键依赖分批清洗导入，夯实系统精准齐套与防呆基础', 5);

  const rows: PptxGenJS.TableRow[] = [
    [
      { text: '导入批次', options: { bold: true, color: C.white, fill: { color: C.navy } } },
      { text: '主数据模块', options: { bold: true, color: C.white, fill: { color: C.navy } } },
      { text: '核心准备字段与建模亮点', options: { bold: true, color: C.white, fill: { color: C.navy } } },
      { text: '责任部门', options: { bold: true, color: C.white, fill: { color: C.navy } } },
    ],
    textRow(['第 1 批\n(基础骨架)', '仓库 / 仓管员 / 库位\n供应商 & 客户档案', '仓库温湿度属性、物理库位码及容量；供应商免检等级/交期；客户追溯要求（如 IPC-1782）', '仓库主管\n采购 / 业务']),
    textRow(['第 2 批\n(条码标准)', '包装 SPQ / 条码规则\nZPL 标签模板', '7寸/13寸卷盘及 Tray 的 SPQ/拆合盘属性；Top20 供应商原厂码解析规则；300DPI 标签模板打样', 'IQC / 仓库\nIT 实施']),
    textRow(['第 3 批\n(核心物料)', '物料清单（复合主键）', '料号默认取 MPN（允许自定义）；SKU+产权+归属编码复合主键；支持非客供料绑定业务客户；MSL/SPQ/安全库存', 'ME 工程\nPMC / 采购']),
    textRow(['第 4 批\n(工程期初)', '单表 BOM（特料/代用）\n期初静态盘点台账', '单表维护主料/特料/代用料及位号（齐套不重复扣减）；期初每盘实盘余量、4位 YYWW DateCode 与实测库位', 'ME / NPI\n仓库 / 财务']),
  ];

  s.addTable(rows, {
    x: 0.45, y: 1.0, w: 9.1, h: 3.1,
    colW: [1.15, 1.95, 4.55, 1.45],
    fontFace: FONT, fontSize: 9.3, color: C.slate,
    border: { type: 'solid', color: C.border, pt: 0.75 },
    valign: 'middle',
  });

  // Highlight bar for composite key & single-table BOM
  s.addShape(pptx.ShapeType.roundRect, {
    x: 0.45, y: 4.25, w: 9.1, h: 0.85, rectRadius: 0.05,
    fill: { color: C.lightSky }, line: { color: C.sky, width: 1 },
  });
  s.addText('关键建模设计提醒：', {
    x: 0.6, y: 4.33, w: 2.0, h: 0.26,
    fontFace: FONT, fontSize: 10, bold: true, color: C.navy,
  });
  s.addText('① DateCode 统一清洗为 4 位数字 YYWW（如 2645），确保 FIFO 排序绝对准确；   ② 物料复合主键（SKU+产权+归属）与单表代用 BOM 为本系统核心优势，导入模板须在 W4 结束前冻结签字。', {
    x: 0.6, y: 4.6, w: 8.8, h: 0.42,
    fontFace: FONT, fontSize: 9, color: C.slate,
  });
  s.addNotes('讲解要点：强调主数据准备占整个实施工作量的 40%，尤其要提前收集主要供应商的实物条码照片并配置好解析规则，否则收料效率提不上来。');
}

// ============================================================
// SLIDE 6: HARDWARE SELECTION
// ============================================================
{
  const s = pptx.addSlide();
  addSlideHeader(s, '05', '硬件设备选型清单与工位配置标准', '以 2–4 条 SMT 产线起步规模为基准（可随产线扩展线性增配）', 6);

  const rows: PptxGenJS.TableRow[] = [
    [
      { text: '设备类别', options: { bold: true, color: C.white, fill: { color: C.navy } } },
      { text: '推荐规格与型号参考', options: { bold: true, color: C.white, fill: { color: C.navy } } },
      { text: '配置数量', options: { bold: true, color: C.white, fill: { color: C.navy } } },
      { text: '与 SMT-WMS 对接方式与关键要求', options: { bold: true, color: C.white, fill: { color: C.navy } } },
    ],
    textRow(['Zebra ZPL 打印机', 'ZT411 / ZT231 / ZD621\n必选 300 DPI 热转印 + 网口', '2–3 台\n(含1备机)', '优先局域网 TCP 9100 直打（静态 IP）；云端场景走 USB + Zebra Browser Print；配哑银/防静电纸 + 树脂碳带']),
    textRow(['工业二维扫码枪', 'Zebra DS3678 / Honeywell 1952g\n支持 3mil 高密 DataMatrix', '4–6 把', 'HID 键盘模式追加回车，收/发/退料台即插即用，兼容全局扫码追溯与波次 FIFO 核验']),
    textRow(['工业安卓 PDA', 'Zebra TC22 / 优博讯（Wi-Fi 6）', '2–4 台\n(选配)', '浏览器直登响应式 Web 端，大幅提升货架走动拣料与区位循环盘点效率']),
    textRow(['物料点数机', 'X-Ray 智能点料机 / 光学点数机', '1–2 台', '退料工位标配！精准复点余量后系统拆子盘并重打新标，消除账实偏差']),
    textRow(['防潮与烘烤设备', 'RH<5% 氮气柜 + 125°C 精密烤箱', '柜 2–4 台\n箱 1–2 台', '与系统 MSD 倒计时、超时锁盘及 MSD_BAKE 烘烤复位流程形成硬闭环']),
    textRow(['服务器与终端 PC', '工位触控一体机 + 机房服务器 (RAID10)', 'PC 3–4 台\n服务器 1–2 台', '部署 React + .NET 10 WebApi + MSSQL/PG；确保每日自动全备与异地容灾']),
  ];

  s.addTable(rows, {
    x: 0.45, y: 0.98, w: 9.1, h: 4.12,
    colW: [1.55, 2.45, 1.05, 4.05],
    fontFace: FONT, fontSize: 9, color: C.slate,
    border: { type: 'solid', color: C.border, pt: 0.75 },
    valign: 'middle',
  });
  s.addNotes('讲解要点：特别提醒不要为了省钱采购 203 DPI 低精度打印机或热敏纸——SMT 小尺寸二维复合码在 203 DPI 下易糊码，热敏纸遇烘烤会变黑。');
}

// ============================================================
// SLIDE 7: TECHNICAL DEPLOYMENT ARCHITECTURE
// ============================================================
{
  const s = pptx.addSlide();
  addSlideHeader(s, '06', '前后端分离技术架构：.NET 10 + FreeSql 多数据库', '一套代码无缝适配 SQLite、企业 MSSQL、PostgreSQL 与 MySQL', 7);

  // Left: Frontend
  s.addShape(pptx.ShapeType.roundRect, { x: 0.45, y: 1.05, w: 2.35, h: 3.1, rectRadius: 0.06, fill: { color: C.paleBg }, line: { color: C.sky, width: 1.5 } });
  s.addText('前端表现层\nReact + TypeScript', { x: 0.58, y: 1.18, w: 2.1, h: 0.52, fontFace: FONT, fontSize: 11.5, bold: true, color: C.navy, align: 'center' });
  const feItems = ['工位操作台 / PDA / 看板', 'VITE_API_BASE_URL\n自由切换后端地址', '可视 ZPL 标签设计器\n(mm 坐标 / DPI / 偏移)', '支持 USB Browser Print\n与局域网 TCP 打印'];
  feItems.forEach((t, i) => {
    s.addShape(pptx.ShapeType.roundRect, { x: 0.6, y: 1.82 + i * 0.56, w: 2.05, h: 0.46, rectRadius: 0.04, fill: { color: C.white }, line: { color: C.border } });
    s.addText(t, { x: 0.64, y: 1.84 + i * 0.56, w: 1.97, h: 0.42, fontFace: FONT, fontSize: 8.2, color: C.slate, align: 'center', valign: 'middle' });
  });

  s.addShape(pptx.ShapeType.rightArrow, { x: 2.88, y: 2.45, w: 0.32, h: 0.22, fill: { color: C.sky }, line: { color: C.sky } });

  // Center: .NET 10 DDD 4 Layers
  s.addShape(pptx.ShapeType.roundRect, { x: 3.28, y: 1.05, w: 3.15, h: 3.1, rectRadius: 0.06, fill: { color: C.navy }, line: { color: C.navy } });
  s.addText('.NET 10 独立后端（DDD 四层）', { x: 3.4, y: 1.16, w: 2.9, h: 0.3, fontFace: FONT, fontSize: 11, bold: true, color: '7DD3FC', align: 'center' });
  const layers = [
    ['SmtWms.WebApi', 'REST API · OpenAPI 3.1 · CORS · 会话鉴权'],
    ['SmtWms.Application', '收/发/退/波次/BOM/盘点用例编排与 DTO'],
    ['SmtWms.Domain', '零依赖领域实体 · 复合主键 · MSD 策略'],
    ['SmtWms.Infrastructure', 'FreeSql 3.5 多库仓储 · PBKDF2 · TCP 9100'],
  ];
  layers.forEach(([l, d], i) => {
    const y = 1.56 + i * 0.62;
    s.addShape(pptx.ShapeType.roundRect, { x: 3.44, y, w: 2.83, h: 0.52, rectRadius: 0.04, fill: { color: i === 3 ? C.sky : '1B3B5C' }, line: { color: '38BDF8', width: 0.75 } });
    s.addText(l, { x: 3.52, y: y + 0.04, w: 2.65, h: 0.2, fontFace: FONT, fontSize: 9.2, bold: true, color: C.white });
    s.addText(d, { x: 3.52, y: y + 0.25, w: 2.65, h: 0.22, fontFace: FONT, fontSize: 7.8, color: 'E0F2FE' });
  });

  s.addShape(pptx.ShapeType.rightArrow, { x: 6.5, y: 2.1, w: 0.32, h: 0.22, fill: { color: C.sky }, line: { color: C.sky } });
  s.addShape(pptx.ShapeType.rightArrow, { x: 6.5, y: 3.48, w: 0.32, h: 0.22, fill: { color: C.amber }, line: { color: C.amber } });

  // Right: Databases + Printer
  s.addShape(pptx.ShapeType.roundRect, { x: 6.9, y: 1.05, w: 2.65, h: 2.05, rectRadius: 0.06, fill: { color: C.lightSky }, line: { color: C.sky, width: 1.2 } });
  s.addText('FreeSql 多数据库引擎', { x: 7.0, y: 1.15, w: 2.45, h: 0.26, fontFace: FONT, fontSize: 10.5, bold: true, color: C.navy, align: 'center' });
  const dbs = [
    'MSSQL (企业工厂主力推荐)',
    'SQLite (边端/试点零配置)',
    'PostgreSQL / MySQL',
    '读写分离 & 多库 (对接 ERP)',
  ];
  dbs.forEach((t, i) => {
    s.addShape(pptx.ShapeType.roundRect, { x: 7.05, y: 1.48 + i * 0.38, w: 2.35, h: 0.31, rectRadius: 0.04, fill: { color: i === 0 ? C.navy : C.white }, line: { color: C.sky, width: 0.75 } });
    s.addText(t, { x: 7.1, y: 1.49 + i * 0.38, w: 2.25, h: 0.29, fontFace: FONT, fontSize: 8.2, bold: i === 0, color: i === 0 ? '7DD3FC' : C.navy, align: 'center', valign: 'middle' });
  });

  s.addShape(pptx.ShapeType.roundRect, { x: 6.9, y: 3.25, w: 2.65, h: 0.9, rectRadius: 0.06, fill: { color: C.amberBg }, line: { color: C.amber, width: 1.2 } });
  s.addText('Zebra 工业打印集群', { x: 7.0, y: 3.35, w: 2.45, h: 0.26, fontFace: FONT, fontSize: 10, bold: true, color: '92400E', align: 'center' });
  s.addText('TCP Raw 9100 毫秒级下发\n无浏览器打印弹窗干扰', { x: 7.0, y: 3.63, w: 2.45, h: 0.44, fontFace: FONT, fontSize: 8.2, color: '78350F', align: 'center' });

  // Bottom bar
  s.addShape(pptx.ShapeType.roundRect, { x: 0.45, y: 4.35, w: 9.1, h: 0.75, rectRadius: 0.05, fill: { color: C.paleBg }, line: { color: C.border } });
  s.addText('部署演进建议：试运行阶段可用 SQLite 快速验证；正式投产切至工厂内网 Microsoft SQL Server (MSSQL)，仅需修改 appsettings.json 的 Database:Provider 与连接串，CodeFirst 自动建表且零业务代码改动。', {
    x: 0.62, y: 4.45, w: 8.76, h: 0.54,
    fontFace: FONT, fontSize: 9.2, color: C.slate, valign: 'middle',
  });
  s.addNotes('讲解要点：向 IT 团队重点说明 DDD 领域层零数据库依赖，以及 FreeSql 如何通过 Fluent 配置让超长 JSON 列在 MSSQL 自动映射为 NVARCHAR(MAX)。');
}

// ============================================================
// SLIDE 8: MANAGEMENT MODEL PART 1 (INBOUND & OWNERSHIP)
// ============================================================
{
  const s = pptx.addSlide();
  addSlideHeader(s, '07', '核心管理模式（上）：收料赋码与产权隔离闭环', '把好入库第一道关，做到来源可查、包装合规、客户产权绝对不混', 8);

  // Left Card: ASN & ZPL Inbound
  s.addShape(pptx.ShapeType.roundRect, { x: 0.45, y: 1.02, w: 4.4, h: 4.05, rectRadius: 0.06, fill: { color: C.paleBg }, line: { color: C.sky, width: 1.2 } });
  s.addShape(pptx.ShapeType.rect, { x: 0.45, y: 1.02, w: 4.4, h: 0.42, fill: { color: C.sky }, line: { color: C.sky } });
  s.addText('机制一：ASN 预约 + 扫码解析 + 一盘一码打标', { x: 0.58, y: 1.08, w: 4.15, h: 0.3, fontFace: FONT, fontSize: 11, bold: true, color: C.white });

  const inboundSteps = [
    ['Step 1  ASN 预约建单', '采购手工或 CSV 批量导入到货预报单，锁定 PO、料号与预计量。'],
    ['Step 2  IQC 扫码解析', '扫描原厂料盘条码，按供应商规则自动提取 MPN / Lot / DC / Qty。'],
    ['Step 3  赋唯一 UID & 打标', '校验 SPQ 与 4 位 DateCode，生成 Reel UID 并直推 Zebra 输出标签。'],
    ['Step 4  定位上架', '依物料推荐库位/MSD 专仓上架，ASN 收货进度自动闭环核销。'],
  ];
  inboundSteps.forEach(([h, b], i) => {
    const y = 1.6 + i * 0.84;
    s.addShape(pptx.ShapeType.roundRect, { x: 0.62, y, w: 4.06, h: 0.72, rectRadius: 0.04, fill: { color: C.white }, line: { color: C.border } });
    s.addText(h, { x: 0.74, y: y + 0.06, w: 3.8, h: 0.24, fontFace: FONT, fontSize: 9.8, bold: true, color: C.navy });
    s.addText(b, { x: 0.74, y: y + 0.32, w: 3.8, h: 0.36, fontFace: FONT, fontSize: 8.6, color: C.slate });
  });

  // Right Card: Ownership & Customer Isolation
  s.addShape(pptx.ShapeType.roundRect, { x: 5.15, y: 1.02, w: 4.4, h: 4.05, rectRadius: 0.06, fill: { color: C.paleBg }, line: { color: C.navy, width: 1.2 } });
  s.addShape(pptx.ShapeType.rect, { x: 5.15, y: 1.02, w: 4.4, h: 0.42, fill: { color: C.navy }, line: { color: C.navy } });
  s.addText('机制二：客供 / 专料产权隔离与防混发红线', { x: 5.28, y: 1.08, w: 4.15, h: 0.3, fontFace: FONT, fontSize: 11, bold: true, color: '7DD3FC' });

  const ownBlocks = [
    ['复合主键账务隔离', 'SKU + 产权类型（自购/客供/VMI/专属）+ 归属编码，彻底隔离同一 MPN 不同产权库存。', C.white, C.border],
    ['非客供料同样可绑定客户', '即使自购或 VMI 寄售料，若专为某大客户备库，可指定对应业务客户防止被他单挪用。', C.white, C.border],
    ['发料/补料优先级与硬拦截', '工单绑定客户后，波次优先锁定该客户客供/专属料，其次公用料；严禁跨客户发料（系统直接阻断）。', C.redBg, C.red],
  ];
  ownBlocks.forEach(([h, b, bg, bd], i) => {
    const y = 1.62 + i * 1.12;
    s.addShape(pptx.ShapeType.roundRect, { x: 5.32, y, w: 4.06, h: 0.96, rectRadius: 0.05, fill: { color: bg }, line: { color: bd, width: 1 } });
    s.addText(h, { x: 5.45, y: y + 0.1, w: 3.8, h: 0.25, fontFace: FONT, fontSize: 10, bold: true, color: i === 2 ? '991B1B' : C.navy });
    s.addText(b, { x: 5.45, y: y + 0.38, w: 3.8, h: 0.52, fontFace: FONT, fontSize: 8.8, color: C.slate, lineSpacingMultiple: 1.25 });
  });

  s.addNotes('讲解要点：很多 EMS/PCBA 代工厂因为客供料和自购料混发导致重大客户投诉，本系统的复合主键与客户绑定机制可从源头根治。');
}

// ============================================================
// SLIDE 9: MANAGEMENT MODEL PART 2 (FIFO, MSD, RETURN, TRACE)
// ============================================================
{
  const s = pptx.addSlide();
  addSlideHeader(s, '08', '核心管理模式（下）：FIFO 防呆、MSD 闭环与退料追溯', '用系统硬防错取代人工记忆，构建 SMT 车间全过程防呆防线', 9);

  const blocks = [
    {
      title: '机制三：波次齐套与强制 FIFO 硬拦截',
      color: C.green, bg: C.greenBg,
      text: '• 多工单合并波次，按单表 BOM（含特料与代用料）自动齐套并输出缺料清单。\n• 系统严格按 4 位 DateCode + 入库时间升序锁盘。\n• 拣货扫码若拿新盘而老盘未发，系统弹窗硬拦截！',
    },
    {
      title: '机制四：MSD 湿敏全生命周期闭环',
      color: C.amber, bg: C.amberBg,
      text: '• 密封入柜 (SEALED) → 产线发料拆封自动启动寿命倒计时 (OPENED)。\n• 超时自动锁定需烘烤 (BAKING_REQUIRED)，禁发禁补。\n• 125°C 烘烤后执行 MSD_BAKE 系统复位并全程留痕。',
    },
    {
      title: '机制五：异常补料、退料拆子盘与报废',
      color: C.sky, bg: C.lightSky,
      text: '• 抛料/断带按工单与机台扫码补料，精准统计产线超领。\n• 完工余料必经点数机复点，支持拆分子盘 (ParentReelId) 并重打最新余量 ZPL 标签。\n• 损毁/过期料移入 MRB 隔离并规范报废核销。',
    },
    {
      title: '机制六：ABC 循环盘点与 3 秒全追溯',
      color: C.navy, bg: C.paleBg,
      text: '• A 类 IC 周盘、B 类月盘、C 类季盘，不停产完成账实平账。\n• 全局扫码输入 Reel UID / Lot / 工单号，3 秒还原「入库→发料→补料→退料→报废」全链路履历，轻松通过汽车/医疗客户审计。',
    },
  ];

  blocks.forEach((b, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = 0.45 + col * 4.65;
    const y = 1.02 + row * 2.08;
    s.addShape(pptx.ShapeType.roundRect, { x, y, w: 4.45, h: 1.92, rectRadius: 0.06, fill: { color: b.bg }, line: { color: b.color, width: 1.2 } });
    s.addText(b.title, { x: x + 0.16, y: y + 0.12, w: 4.15, h: 0.3, fontFace: FONT, fontSize: 11.2, bold: true, color: C.navy });
    s.addText(b.text, { x: x + 0.16, y: y + 0.46, w: 4.15, h: 1.38, fontFace: FONT, fontSize: 9.2, color: C.slate, lineSpacingMultiple: 1.32 });
  });
  s.addNotes('讲解要点：强调这四个机制环环相扣——没有退料复点就没有准确库存，没有准确库存就没有波次齐套，没有 MSD 锁盘就会出现回流焊爆板风险。');
}

// ============================================================
// SLIDE 10: RACI MATRIX
// ============================================================
{
  const s = pptx.addSlide();
  addSlideHeader(s, '09', '跨部门组织协同与 RACI 职责分工矩阵', '消除「仓库背全锅」现象，明确工程、计划、品质、仓库与 IT 职责边界', 10);

  const rows: PptxGenJS.TableRow[] = [
    [
      { text: '关键业务流程', options: { bold: true, color: C.white, fill: { color: C.navy } } },
      { text: '仓库主管', options: { bold: true, color: C.white, fill: { color: C.navy }, align: 'center' } },
      { text: '仓管员', options: { bold: true, color: C.white, fill: { color: C.navy }, align: 'center' } },
      { text: 'IQC/MSD', options: { bold: true, color: C.white, fill: { color: C.navy }, align: 'center' } },
      { text: 'PMC计划', options: { bold: true, color: C.white, fill: { color: C.navy }, align: 'center' } },
      { text: 'ME工程', options: { bold: true, color: C.white, fill: { color: C.navy }, align: 'center' } },
      { text: 'IT运维', options: { bold: true, color: C.white, fill: { color: C.navy }, align: 'center' } },
    ],
    textRow(['仓库 / 库位 / 包装 SPQ 维护', 'A / R', 'C', 'C', 'I', 'C', 'I']),
    textRow(['物料清单（MPN/产权/MSL）维护', 'C', 'I', 'C', 'C', 'A / R', 'I']),
    textRow(['单表 BOM（特料/代用料）维护', 'I', 'I', 'I', 'C', 'A / R', 'I']),
    textRow(['条码解析规则 & ZPL 模板调试', 'A', 'C', 'R', 'I', 'I', 'R']),
    textRow(['ASN 建单 & 到货赋码上架', 'A', 'R', 'C', 'R (ASN)', 'I', 'I']),
    textRow(['工单排程 & 波次 FIFO 发料', 'A', 'R (发料)', 'I', 'R (排单)', 'I', 'I']),
    textRow(['MSD 湿敏监控 & 烘烤复位', 'A', 'C', 'R', 'I', 'I', 'I']),
    textRow(['产线补料 / 退料点数拆子盘', 'A', 'R', 'C', 'I', 'I', 'I']),
    textRow(['循环盘点平账 & MRB 报废', 'A / R', 'R', 'C', 'I', 'I', 'I']),
    textRow(['MSSQL 备份 & 账号权限安全', 'I', 'I', 'I', 'I', 'I', 'A / R']),
  ];

  s.addTable(rows, {
    x: 0.45, y: 0.98, w: 9.1, h: 3.72,
    colW: [2.8, 1.05, 1.05, 1.05, 1.05, 1.05, 1.05],
    fontFace: FONT, fontSize: 9, color: C.slate, align: 'center',
    border: { type: 'solid', color: C.border, pt: 0.75 },
    valign: 'middle',
  });

  s.addText('图例：R = 执行负责人 (Responsible)   |   A = 最终审批与问责 (Accountable)   |   C = 协同参与 (Consulted)   |   I = 结果知情 (Informed)', {
    x: 0.45, y: 4.82, w: 9.1, h: 0.3,
    fontFace: FONT, fontSize: 8.8, bold: true, color: C.navy, align: 'center',
  });
  s.addNotes('讲解要点：重点指出物料清单的 MSL 等级和单表 BOM 必须由 ME 工程部负责维护，仓库只负责收发存执行，避免源头数据无人负责。');
}

// ============================================================
// SLIDE 11: 8-WEEK ROADMAP
// ============================================================
{
  const s = pptx.addSlide();
  addSlideHeader(s, '10', '新建工厂 8 周分阶段上线路线图', '「先试点单线闭环，再全厂静态盘点切换」，将上线风险降至最低', 11);

  const phases = [
    {
      wk: 'W1 – W2', name: '阶段一：环境与底座就绪', col: C.sky,
      tasks: [
        '完成五区物理隔离与货架编码贴标',
        '部署 .NET 10 + MSSQL 与 Wi-Fi 6 网络',
        'Zebra 300DPI 打印机/扫码枪/点数机到位',
        '发布仓库管理红线与岗位 RACI 制度',
      ],
    },
    {
      wk: 'W3 – W4', name: '阶段二：主数据清洗与联调', col: C.amber,
      tasks: [
        '4 批次导入仓库/SPQ/物料/单表 BOM',
        '配置 Top20 供应商条码解析规则并实测',
        '完成 70×40 / 50×30mm ZPL 标签实机打样',
        '冻结核心主数据并通过 Go/No-Go 评审',
      ],
    },
    {
      wk: 'W5 – W6', name: '阶段三：单线闭环试运行', col: C.green,
      tasks: [
        '选取 1 条 SMT 产线跑通全流程闭环',
        '实测 ASN→收料→波次FIFO→补料→退料拆盘',
        '演练 MSD 超时锁盘与 125°C 烘烤复位',
        '优化异常流程，完成全员实操上岗考核',
      ],
    },
    {
      wk: 'W7 – W8', name: '阶段四：全厂切换与 KPI 固化', col: C.navy,
      tasks: [
        '周末静态盘点，在库料盘全量贴系统 UID',
        '停止旧手工台账，全产线切入 SMT-WMS',
        '启动每周 A 类循环盘点与看板日清机制',
        '对照 KPI 达成率组织管理层项目结项验收',
      ],
    },
  ];

  phases.forEach((p, i) => {
    const x = 0.45 + i * 2.32;
    // Timeline chevron/header
    s.addShape(pptx.ShapeType.roundRect, { x, y: 1.02, w: 2.18, h: 0.56, rectRadius: 0.05, fill: { color: p.col }, line: { color: p.col } });
    s.addText(p.wk, { x: x + 0.1, y: 1.05, w: 1.98, h: 0.22, fontFace: FONT, fontSize: 10, bold: true, color: 'E0F2FE' });
    s.addText(p.name, { x: x + 0.1, y: 1.28, w: 1.98, h: 0.26, fontFace: FONT, fontSize: 9.8, bold: true, color: C.white });

    // Body card
    s.addShape(pptx.ShapeType.roundRect, { x, y: 1.66, w: 2.18, h: 3.35, rectRadius: 0.05, fill: { color: C.paleBg }, line: { color: C.border } });
    s.addText(
      p.tasks.map((t) => ({ text: t, options: { bullet: true, breakLine: true } })),
      {
        x: x + 0.12, y: 1.8, w: 1.95, h: 3.05,
        fontFace: FONT, fontSize: 9, color: C.slate, lineSpacingMultiple: 1.38,
      }
    );
  });
  s.addNotes('讲解要点：第 4 周末的「主数据冻结评审」与第 6 周末的「单线闭环验证」是两大关键关口，未达标绝不盲目全厂切换。');
}

// ============================================================
// SLIDE 12: KPI & 5 PITFALLS
// ============================================================
{
  const s = pptx.addSlide();
  addSlideHeader(s, '11', '上线验收 KPI 体系与新厂导入 5 大避坑指南', '用量化指标守住成果，提前规避 90% 新建电子厂踩过的管理陷阱', 12);

  // Left: KPI Table
  const kpiRows: PptxGenJS.TableRow[] = [
    [
      { text: '验收 KPI 指标', options: { bold: true, color: C.white, fill: { color: C.navy } } },
      { text: '验收红线', options: { bold: true, color: C.white, fill: { color: C.sky }, align: 'center' } },
    ],
    textRow(['库存账实准确率（循环盘点）', '≥ 99.8%']),
    textRow(['FIFO 先进先出违规率', '= 0%']),
    textRow(['MSD 湿敏超时上线率', '= 0%']),
    textRow(['跨客户客供/专料混发事件', '= 0 起']),
    textRow(['单盘扫码解析与 ZPL 赋码耗时', '≤ 15 秒']),
    textRow(['客诉/审核批次全链路追溯耗时', '≤ 10 秒']),
    textRow(['工单备料齐套效率提升幅度', '≥ 40%']),
  ];
  s.addTable(kpiRows, {
    x: 0.45, y: 1.02, w: 3.85, h: 4.0,
    colW: [2.65, 1.2],
    fontFace: FONT, fontSize: 9.2, color: C.slate,
    border: { type: 'solid', color: C.border, pt: 0.75 },
    valign: 'middle',
  });

  // Right: 5 Pitfalls
  const pitfalls = [
    ['坑 1：跳过主数据清洗急于上线', 'MSL 全填 Level 1、SPQ 缺失 → 严格卡住 W4 数据冻结评审'],
    ['坑 2：省钱买 203DPI 打印机 / 热敏纸', '小码扫不出、过烘箱发黑 → 一步到位 300DPI 热转印 + 哑银纸'],
    ['坑 3：产线退料肉眼估算、不换新标', '1 个月后账实偏差超 15% → 退料必过点数机并重打 ZPL 标签'],
    ['坑 4：急单口头先拿料、次日再补账', '系统沦为事后台账 → 急料统一 10 秒扫码走「产线补料」'],
    ['坑 5：忽视专料客户绑定与数据库备份', '挪料违约或丢数据 → 启用客户归属防混发 + MSSQL 每日异地全备'],
  ];
  pitfalls.forEach(([h, d], i) => {
    const y = 1.02 + i * 0.82;
    s.addShape(pptx.ShapeType.roundRect, { x: 4.55, y, w: 5.0, h: 0.72, rectRadius: 0.05, fill: { color: i === 0 ? C.redBg : C.amberBg }, line: { color: i === 0 ? C.red : C.amber, width: 1 } });
    s.addText(h, { x: 4.7, y: y + 0.06, w: 4.7, h: 0.25, fontFace: FONT, fontSize: 9.8, bold: true, color: i === 0 ? '991B1B' : '92400E' });
    s.addText(d, { x: 4.7, y: y + 0.34, w: 4.7, h: 0.32, fontFace: FONT, fontSize: 8.6, color: C.slate });
  });

  s.addNotes('结束语：建议管理层将左侧 7 项 KPI 纳入仓库与 PMC 月度绩效，并在上线前 30 天每日召开 15 分钟异常复盘站会，确保新模式固化为工厂肌肉记忆。');
}

async function main() {
  const outDir = path.resolve(process.cwd(), 'downloads');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'SMT-WMS-Factory-Onboarding-Deck.pptx');
  await pptx.writeFile({ fileName: outFile });
  const stat = fs.statSync(outFile);
  console.log(`Generated PPTX deck: ${outFile} (${stat.size} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
