import type {
  LabelBarcodeType,
  LabelElementKey,
  LabelFontScale,
  LabelTemplate,
  MaterialSku,
  ReelItem,
} from '../types/wms';
import { buildCompositeBarcode, OWNERSHIP_TYPE_LABEL } from './formatters';

export const DEFAULT_ELEMENT_ORDER: LabelElementKey[] = [
  'header',
  'mpnQty',
  'lotDcBin',
  'ownership',
  'packagingMpq',
  'supplier',
  'barcode',
  'composite',
  'footer',
];

export const LABEL_ELEMENT_META: Record<
  LabelElementKey,
  { label: string; desc: string; toggleField?: keyof LabelTemplate['showFields'] }
> = {
  header: { label: '标签抬头栏', desc: '顶部标题 + 纸张规格角标' },
  mpnQty: { label: '物料型号 (MPN) & 数量', desc: 'MPN / SKU 与当前余量', toggleField: 'skuCode' },
  lotDcBin: { label: '批次 / 周期 / 库位 / MSD', desc: 'Lot / DateCode / Bin / 湿敏等级', toggleField: 'lotDateCode' },
  ownership: { label: '产权与客户准入', desc: '自购 / 客供 / VMI 隔离标记', toggleField: 'ownership' },
  packagingMpq: { label: '包装规格与 MPQ', desc: '卷盘/托盘与最小包装数量', toggleField: 'packagingMpq' },
  supplier: { label: '供应商名称', desc: '来料供应商信息', toggleField: 'supplier' },
  barcode: { label: '主条码 / 二维码', desc: 'Code128 一维码或 QR / DataMatrix' },
  composite: { label: 'IPC-1782 复合串', desc: 'UID|P|L|D|Q 明文校验串', toggleField: 'compositeBarcode' },
  footer: { label: '页脚防错提示语', desc: '底部 FIFO / 管控提示' },
};

export const ZPL_PLACEHOLDERS: { token: string; desc: string }[] = [
  { token: '{{REEL_ID}}', desc: '料盘唯一 UID' },
  { token: '{{MPN}}', desc: '原厂型号 MPN' },
  { token: '{{SKU}}', desc: '系统物料编码' },
  { token: '{{QTY}}', desc: '当前数量' },
  { token: '{{UNIT}}', desc: '计量单位' },
  { token: '{{LOT}}', desc: '生产批次 Lot' },
  { token: '{{DC}}', desc: '生产周期 D/C' },
  { token: '{{BIN}}', desc: '存放库位号' },
  { token: '{{MSD}}', desc: 'MSD 湿敏等级' },
  { token: '{{OWNERSHIP}}', desc: '产权类型简称' },
  { token: '{{OWNER}}', desc: '货主名称' },
  { token: '{{CUSTOMER}}', desc: '业务客户归属' },
  { token: '{{PACKAGING}}', desc: '包装载体规格' },
  { token: '{{MPQ}}', desc: '最小包装 MPQ' },
  { token: '{{SUPPLIER}}', desc: '供应商名称' },
  { token: '{{COMPOSITE}}', desc: 'IPC-1782 复合条码串' },
  { token: '{{HEADER}}', desc: '模板抬头文字' },
  { token: '{{FOOTER}}', desc: '模板页脚提示' },
  { token: '{{COPIES}}', desc: '打印份数' },
];

export function getPaperDimensionsMm(
  paperSize: LabelTemplate['paperSize']
): { widthMm: number; heightMm: number } {
  switch (paperSize) {
    case '50x30mm':
      return { widthMm: 50, heightMm: 30 };
    case '100x60mm':
      return { widthMm: 100, heightMm: 60 };
    case '70x40mm':
    default:
      return { widthMm: 70, heightMm: 40 };
  }
}

export function mmToDots(mm: number, dpi: 203 | 300 = 203): number {
  return Math.round((mm * dpi) / 25.4);
}

/**
 * Prevents raw ^ or ~ control prefixes inside user data from breaking ZPL II commands.
 */
export function sanitizeZplText(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[\^~]/g, '-')
    .trim();
}

export function normalizeElementOrder(order?: LabelElementKey[]): LabelElementKey[] {
  const validSet = new Set<LabelElementKey>(DEFAULT_ELEMENT_ORDER);
  const result: LabelElementKey[] = [];
  if (Array.isArray(order)) {
    for (const key of order) {
      if (validSet.has(key) && !result.includes(key)) {
        result.push(key);
      }
    }
  }
  for (const key of DEFAULT_ELEMENT_ORDER) {
    if (!result.includes(key)) {
      result.push(key);
    }
  }
  return result;
}

export function buildZplVariables(
  reel: ReelItem,
  material?: MaterialSku,
  template?: Pick<LabelTemplate, 'headerTitle' | 'footerNote'>,
  copies = 1
): Record<string, string> {
  const ownershipType =
    reel.ownershipType ?? material?.ownershipType ?? 'SELF_PURCHASED';
  const ownershipMeta = OWNERSHIP_TYPE_LABEL[ownershipType];
  const ownerName = reel.ownerName ?? material?.ownerName ?? '本厂自购';
  const customerLabel =
    reel.customerCode || material?.customerCode
      ? reel.customerName ?? material?.customerName ?? reel.customerCode ?? ''
      : '通用共享';
  const packagingLabel =
    material?.packagingName ?? material?.packageType ?? '标准卷盘';
  const mpqVal = reel.mpq ?? material?.mpq ?? '';
  const unit = material?.unit ?? 'PCS';
  const composite = buildCompositeBarcode(reel);

  return {
    REEL_ID: sanitizeZplText(reel.reelId),
    MPN: sanitizeZplText(reel.mpn),
    SKU: sanitizeZplText(reel.skuCode),
    QTY: sanitizeZplText(reel.qty),
    UNIT: sanitizeZplText(unit),
    LOT: sanitizeZplText(reel.lotNumber),
    DC: sanitizeZplText(reel.dateCode),
    BIN: sanitizeZplText(reel.binCode),
    MSD: sanitizeZplText(reel.msdLevel),
    OWNERSHIP: sanitizeZplText(ownershipMeta.short),
    OWNER: sanitizeZplText(ownerName),
    CUSTOMER: sanitizeZplText(customerLabel),
    PACKAGING: sanitizeZplText(packagingLabel),
    MPQ: sanitizeZplText(mpqVal),
    SUPPLIER: sanitizeZplText(reel.supplier),
    COMPOSITE: sanitizeZplText(composite),
    HEADER: sanitizeZplText(template?.headerTitle ?? 'SMT-WMS 料盘追溯标'),
    FOOTER: sanitizeZplText(template?.footerNote ?? 'IPC-1782 全程追溯'),
    COPIES: String(Math.max(1, Math.min(999, Math.round(copies || 1)))),
  };
}

export function generateZplFromTemplate(options: {
  template: LabelTemplate;
  reel: ReelItem;
  material?: MaterialSku;
  copies?: number;
  darkness?: number;
  printSpeed?: number;
  forceVisual?: boolean;
}): string {
  const {
    template,
    reel,
    material,
    copies = 1,
    darkness = 18,
    printSpeed = 4,
    forceVisual = false,
  } = options;

  const dpi: 203 | 300 = template.dpi === 300 ? 300 : 203;
  const { widthMm, heightMm } = getPaperDimensionsMm(template.paperSize);
  const pw = mmToDots(widthMm, dpi);
  const ll = mmToDots(heightMm, dpi);
  const safeCopies = Math.max(1, Math.min(999, Math.round(copies || 1)));
  const safeDarkness = Math.max(0, Math.min(30, Math.round(darkness)));
  const safeSpeed = Math.max(2, Math.min(12, Math.round(printSpeed)));
  const vars = buildZplVariables(reel, material, template, safeCopies);

  if (!forceVisual && template.zplMode === 'CUSTOM_ZPL' && template.customZpl?.trim()) {
    let raw = template.customZpl;
    for (const [k, v] of Object.entries(vars)) {
      raw = raw.replaceAll(`{{${k}}}`, v);
    }
    raw = raw.trim();
    if (!raw.startsWith('^XA')) {
      raw = `^XA\n${raw}`;
    }
    if (!/\^PQ\d+/i.test(raw)) {
      const pqLine = `^PQ${safeCopies},0,1,Y`;
      if (raw.includes('^XZ')) {
        raw = raw.replace(/\^XZ\s*$/i, `${pqLine}\n^XZ`);
      } else {
        raw = `${raw}\n${pqLine}\n^XZ`;
      }
    } else if (!raw.endsWith('^XZ')) {
      raw = `${raw}\n^XZ`;
    }
    return raw;
  }

  const dpiScale = dpi / 203;
  const fontScale: LabelFontScale = template.fontScale ?? 'STANDARD';
  const fontMultiplier =
    (fontScale === 'COMPACT' ? 0.85 : fontScale === 'LARGE' ? 1.18 : 1.0) *
    (template.paperSize === '50x30mm'
      ? 0.86
      : template.paperSize === '100x60mm'
      ? 1.28
      : 1.0);

  const px = (dotsAt203: number) => Math.max(8, Math.round(dotsAt203 * dpiScale * fontMultiplier));
  const marginX = Math.round(14 * dpiScale);
  const contentW = pw - marginX * 2;
  const order = normalizeElementOrder(template.elementOrder);
  const barcodeType: LabelBarcodeType = template.barcodeType ?? 'CODE128';
  const barcodeHeightMm =
    template.barcodeHeightMm && template.barcodeHeightMm >= 4 && template.barcodeHeightMm <= 24
      ? template.barcodeHeightMm
      : template.paperSize === '50x30mm'
      ? 7
      : template.paperSize === '100x60mm'
      ? 12
      : 9;

  const lines: string[] = [
    '^XA',
    '^CI28',
    `^PW${pw}`,
    `^LL${ll}`,
    '^LH0,0',
    `^MD${safeDarkness}`,
    `^PR${safeSpeed}`,
    `; Template: ${sanitizeZplText(template.templateName)} (${template.paperSize} @ ${dpi}dpi)`,
  ];

  let y = Math.round(10 * dpiScale);
  const gap = Math.max(4, Math.round(6 * dpiScale));
  const divider = (curY: number) => {
    lines.push(`^FO${marginX},${curY}^GB${contentW},1,1^FS`);
    return curY + Math.max(4, Math.round(4 * dpiScale));
  };

  for (const key of order) {
    if (y >= ll - Math.round(14 * dpiScale)) break;

    if (key === 'header') {
      const fh = px(18);
      const fw = Math.round(fh * 0.82);
      lines.push(`^FO${marginX},${y}^A0N,${fh},${fw}^FD${vars.HEADER}^FS`);
      lines.push(
        `^FO${marginX},${y}^A0N,${Math.round(fh * 0.85)},${Math.round(fw * 0.85)}^FB${contentW},1,0,R^FD${template.paperSize}^FS`
      );
      y += fh + Math.round(4 * dpiScale);
      y = divider(y);
      continue;
    }

    if (key === 'mpnQty') {
      const mpnH = px(26);
      const mpnW = Math.round(mpnH * 0.85);
      lines.push(`^FO${marginX},${y}^A0N,${mpnH},${mpnW}^FDMPN:${vars.MPN}^FS`);
      lines.push(
        `^FO${marginX},${y}^A0N,${mpnH},${mpnW}^FB${contentW},1,0,R^FDQTY:${vars.QTY} ${vars.UNIT}^FS`
      );
      y += mpnH + Math.round(3 * dpiScale);
      if (template.showFields.skuCode) {
        const skuH = px(16);
        lines.push(
          `^FO${marginX},${y}^A0N,${skuH},${Math.round(skuH * 0.85)}^FDSKU:${vars.SKU}^FS`
        );
        y += skuH + Math.round(3 * dpiScale);
      }
      y = divider(y);
      continue;
    }

    if (key === 'lotDcBin') {
      if (!template.showFields.lotDateCode && !template.showFields.binMsd) continue;
      const fh = px(17);
      const fw = Math.round(fh * 0.82);
      const leftTxt = template.showFields.lotDateCode
        ? `LOT:${vars.LOT}  D/C:${vars.DC}`
        : '';
      const rightTxt = template.showFields.binMsd ? `BIN:${vars.BIN} ${vars.MSD}` : '';
      if (leftTxt) {
        lines.push(`^FO${marginX},${y}^A0N,${fh},${fw}^FD${leftTxt}^FS`);
      }
      if (rightTxt) {
        lines.push(`^FO${marginX},${y}^A0N,${fh},${fw}^FB${contentW},1,0,R^FD${rightTxt}^FS`);
      }
      y += fh + gap;
      continue;
    }

    if (key === 'ownership') {
      if (!template.showFields.ownership) continue;
      const fh = px(16);
      lines.push(
        `^FO${marginX},${y}^A0N,${fh},${Math.round(fh * 0.82)}^FD[${vars.OWNERSHIP}] ${vars.OWNER} (${vars.CUSTOMER})^FS`
      );
      y += fh + gap;
      continue;
    }

    if (key === 'packagingMpq') {
      if (!template.showFields.packagingMpq) continue;
      const fh = px(16);
      const mpqPart = vars.MPQ ? ` MPQ:${vars.MPQ}` : '';
      lines.push(
        `^FO${marginX},${y}^A0N,${fh},${Math.round(fh * 0.82)}^FDPKG:${vars.PACKAGING}${mpqPart}^FS`
      );
      y += fh + gap;
      continue;
    }

    if (key === 'supplier') {
      if (!template.showFields.supplier) continue;
      const fh = px(16);
      lines.push(
        `^FO${marginX},${y}^A0N,${fh},${Math.round(fh * 0.82)}^FDSUP:${vars.SUPPLIER}^FS`
      );
      y += fh + gap;
      continue;
    }

    if (key === 'barcode') {
      const barDots = Math.min(
        mmToDots(barcodeHeightMm, dpi),
        Math.max(Math.round(28 * dpiScale), ll - y - Math.round(36 * dpiScale))
      );
      if (barcodeType === 'CODE128') {
        const moduleW = dpi === 300 ? 3 : template.paperSize === '50x30mm' ? 1 : 2;
        lines.push(`^FO${marginX},${y}^BY${moduleW},2,${barDots}`);
        lines.push(`^BCN,${barDots},Y,N,N^FD${vars.REEL_ID}^FS`);
        y += barDots + Math.round(22 * dpiScale);
      } else if (barcodeType === 'QR') {
        const mag = dpi === 300 ? 5 : template.paperSize === '50x30mm' ? 3 : 4;
        lines.push(`^FO${marginX},${y}^BQN,2,${mag}^FDQA,${vars.COMPOSITE}^FS`);
        const infoX = marginX + Math.round(mag * 28);
        const uidH = px(18);
        lines.push(
          `^FO${infoX},${y + Math.round(8 * dpiScale)}^A0N,${uidH},${Math.round(uidH * 0.85)}^FDUID:${vars.REEL_ID}^FS`
        );
        lines.push(
          `^FO${infoX},${y + Math.round(28 * dpiScale)}^A0N,${px(14)},${Math.round(px(14) * 0.85)}^FDLOT:${vars.LOT} DC:${vars.DC}^FS`
        );
        y += Math.max(barDots, mag * 26) + gap;
      } else {
        const modDots = dpi === 300 ? 6 : template.paperSize === '50x30mm' ? 4 : 5;
        lines.push(`^FO${marginX},${y}^BXN,${modDots},200^FD${vars.COMPOSITE}^FS`);
        const infoX = marginX + Math.round(modDots * 24);
        const uidH = px(18);
        lines.push(
          `^FO${infoX},${y + Math.round(8 * dpiScale)}^A0N,${uidH},${Math.round(uidH * 0.85)}^FDUID:${vars.REEL_ID}^FS`
        );
        lines.push(
          `^FO${infoX},${y + Math.round(28 * dpiScale)}^A0N,${px(14)},${Math.round(px(14) * 0.85)}^FDMPN:${vars.MPN}^FS`
        );
        y += Math.max(barDots, modDots * 22) + gap;
      }
      continue;
    }

    if (key === 'composite') {
      if (!template.showFields.compositeBarcode) continue;
      const fh = px(14);
      lines.push(
        `^FO${marginX},${y}^A0N,${fh},${Math.round(fh * 0.82)}^FB${contentW},2,0,L^FD${vars.COMPOSITE}^FS`
      );
      y += fh * 2 + gap;
      continue;
    }

    if (key === 'footer') {
      if (!vars.FOOTER) continue;
      const fh = px(14);
      const footerY = Math.max(y, ll - fh - Math.round(10 * dpiScale));
      lines.push(`^FO${marginX},${footerY - Math.round(4 * dpiScale)}^GB${contentW},1,1^FS`);
      lines.push(
        `^FO${marginX},${footerY}^A0N,${fh},${Math.round(fh * 0.82)}^FD${vars.FOOTER}^FS`
      );
      y = footerY + fh + 4;
    }
  }

  lines.push(`^PQ${safeCopies},0,1,Y`);
  lines.push('^XZ');
  return lines.join('\n');
}

/**
 * Generates deterministic 2D matrix cells for QR or DataMatrix visual preview in SVG.
 */
export function generatePseudo2dMatrix(
  text: string,
  variant: 'QR' | 'DATAMATRIX' = 'QR',
  size = 21
): boolean[][] {
  const grid: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false)
  );

  // Hash seed from text
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const charCode = text.charCodeAt((r * size + c) % Math.max(1, text.length)) || 0;
      const bit = ((hash ^ (r * 131 + c * 17 + charCode * 31)) >>> ((r + c) % 8)) & 1;
      grid[r][c] = bit === 1;
    }
  }

  if (variant === 'QR') {
    const drawFinder = (top: number, left: number) => {
      for (let dr = 0; dr < 7; dr++) {
        for (let dc = 0; dc < 7; dc++) {
          const isBorder = dr === 0 || dr === 6 || dc === 0 || dc === 6;
          const isCenter = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
          grid[top + dr][left + dc] = isBorder || isCenter;
        }
      }
      // Quiet separator
      for (let k = -1; k <= 7; k++) {
        if (top + 7 < size && left + k >= 0 && left + k < size) grid[top + 7][left + k] = false;
        if (top - 1 >= 0 && left + k >= 0 && left + k < size) grid[top - 1][left + k] = false;
        if (left + 7 < size && top + k >= 0 && top + k < size) grid[top + k][left + 7] = false;
        if (left - 1 >= 0 && top + k >= 0 && top + k < size) grid[top + k][left - 1] = false;
      }
    };
    drawFinder(0, 0);
    drawFinder(0, size - 7);
    drawFinder(size - 7, 0);
  } else {
    // DataMatrix L-shaped solid finder & alternating timing edges
    for (let i = 0; i < size; i++) {
      grid[i][0] = true;
      grid[size - 1][i] = true;
      grid[0][i] = i % 2 === 0;
      grid[i][size - 1] = i % 2 === 1;
    }
  }

  return grid;
}
