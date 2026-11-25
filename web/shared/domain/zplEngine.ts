import type {
  BarcodeHriPosition,
  LabelBarcodeType,
  LabelElementKey,
  LabelElementKind,
  LabelElementLayout,
  LabelElementRotation,
  LabelFontFamily,
  LabelFontScale,
  LabelPaperPreset,
  LabelTemplate,
  LabelTextAlign,
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

export const BUILTIN_KEY_SET = new Set<string>(DEFAULT_ELEMENT_ORDER);

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
  barcode: { label: '主条码 / 二维码', desc: 'Code128 / Code39 / QR / DataMatrix 及 HRI 文字' },
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

export const DPI_PRESETS = [203, 300, 600] as const;

export function normalizeDpi(dpi?: number): number {
  if (typeof dpi !== 'number' || !Number.isFinite(dpi)) return 203;
  return Math.max(150, Math.min(600, Math.round(dpi)));
}

export function getPaperDimensionsMm(
  paperSize: LabelPaperPreset,
  customWidthMm?: number,
  customHeightMm?: number
): { widthMm: number; heightMm: number } {
  switch (paperSize) {
    case '50x30mm':
      return { widthMm: 50, heightMm: 30 };
    case '100x60mm':
      return { widthMm: 100, heightMm: 60 };
    case 'CUSTOM': {
      const w =
        typeof customWidthMm === 'number' && Number.isFinite(customWidthMm)
          ? Math.max(20, Math.min(200, Math.round(customWidthMm * 10) / 10))
          : 70;
      const h =
        typeof customHeightMm === 'number' && Number.isFinite(customHeightMm)
          ? Math.max(10, Math.min(200, Math.round(customHeightMm * 10) / 10))
          : 40;
      return { widthMm: w, heightMm: h };
    }
    case '70x40mm':
    default:
      return { widthMm: 70, heightMm: 40 };
  }
}

export function formatPaperSizeLabel(
  template: Pick<LabelTemplate, 'paperSize' | 'customWidthMm' | 'customHeightMm'>
): string {
  const { widthMm, heightMm } = getPaperDimensionsMm(
    template.paperSize,
    template.customWidthMm,
    template.customHeightMm
  );
  return `${widthMm}×${heightMm}mm`;
}

export function mmToDots(mm: number, dpi = 203): number {
  const safeDpi = normalizeDpi(dpi);
  return Math.max(0, Math.round((mm * safeDpi) / 25.4));
}

export function mmToSignedDots(mm: number, dpi = 203): number {
  const safeDpi = normalizeDpi(dpi);
  if (!Number.isFinite(mm)) return 0;
  return Math.round((mm * safeDpi) / 25.4);
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

export function interpolateZplTemplate(
  templateStr: string,
  vars: Record<string, string>
): string {
  let out = templateStr;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{{${k}}}`, v);
  }
  return sanitizeZplText(out);
}

export function resolveElementKind(el: Pick<LabelElementLayout, 'key' | 'kind'>): LabelElementKind {
  if (el.kind) return el.kind;
  if (BUILTIN_KEY_SET.has(el.key)) return 'BUILTIN';
  if (el.key.startsWith('CUSTOM_BC_')) return 'BARCODE';
  if (el.key.startsWith('CUSTOM_BOX_')) return 'BOX';
  return 'TEXT';
}

export function isBarcodeElement(el: Pick<LabelElementLayout, 'key' | 'kind'>): boolean {
  return el.key === 'barcode' || resolveElementKind(el) === 'BARCODE';
}

export function getElementDisplayName(el: LabelElementLayout): string {
  if (el.label?.trim()) return el.label.trim();
  if (BUILTIN_KEY_SET.has(el.key)) {
    return LABEL_ELEMENT_META[el.key as LabelElementKey].label;
  }
  const kind = resolveElementKind(el);
  if (kind === 'BARCODE') return '自定义条码';
  if (kind === 'BOX') return '线条 / 边框';
  return '自定义文本';
}

export function normalizeElementOrder(order?: string[]): string[] {
  const result: string[] = [];
  if (Array.isArray(order)) {
    for (const key of order) {
      if (typeof key === 'string' && key.trim() && !result.includes(key)) {
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

export function buildDefaultElementLayouts(
  paperSize: LabelPaperPreset,
  showFields?: Partial<LabelTemplate['showFields']>,
  fontScale: LabelFontScale = 'STANDARD',
  barcodeHeightMm?: number,
  customWidthMm?: number,
  customHeightMm?: number
): LabelElementLayout[] {
  const fontFactor = fontScale === 'COMPACT' ? 0.88 : fontScale === 'LARGE' ? 1.15 : 1;
  const roundMm = (v: number) => Math.round(v * 2) / 2;

  const isVisible = (key: LabelElementKey): boolean => {
    if (!showFields) return true;
    if (key === 'ownership') return showFields.ownership ?? true;
    if (key === 'packagingMpq') return showFields.packagingMpq ?? true;
    if (key === 'supplier') return showFields.supplier ?? true;
    if (key === 'lotDcBin') return (showFields.lotDateCode ?? true) || (showFields.binMsd ?? true);
    if (key === 'composite') return showFields.compositeBarcode ?? true;
    return true;
  };

  if (paperSize === '50x30mm') {
    const bh = barcodeHeightMm ?? 6;
    return [
      { key: 'header', kind: 'BUILTIN', visible: isVisible('header'), xMm: 1.5, yMm: 1.0, fontSizeMm: roundMm(1.9 * fontFactor), widthMm: 47, rotation: 'N', fontFamily: '0', bold: true },
      { key: 'mpnQty', kind: 'BUILTIN', visible: isVisible('mpnQty'), xMm: 1.5, yMm: 3.5, fontSizeMm: roundMm(2.6 * fontFactor), widthMm: 47, rotation: 'N', fontFamily: '0', bold: true },
      { key: 'lotDcBin', kind: 'BUILTIN', visible: isVisible('lotDcBin'), xMm: 1.5, yMm: 8.5, fontSizeMm: roundMm(1.9 * fontFactor), widthMm: 47, rotation: 'N', fontFamily: '0' },
      { key: 'ownership', kind: 'BUILTIN', visible: isVisible('ownership'), xMm: 1.5, yMm: 11.5, fontSizeMm: roundMm(1.7 * fontFactor), widthMm: 47, rotation: 'N', fontFamily: '0' },
      { key: 'packagingMpq', kind: 'BUILTIN', visible: isVisible('packagingMpq'), xMm: 1.5, yMm: 14.0, fontSizeMm: roundMm(1.7 * fontFactor), widthMm: 47, rotation: 'N', fontFamily: '0' },
      { key: 'supplier', kind: 'BUILTIN', visible: showFields?.supplier ?? false, xMm: 1.5, yMm: 16.0, fontSizeMm: roundMm(1.7 * fontFactor), widthMm: 47, rotation: 'N', fontFamily: '0' },
      {
        key: 'barcode',
        kind: 'BUILTIN',
        visible: true,
        xMm: 2.0,
        yMm: 16.5,
        fontSizeMm: bh,
        widthMm: 46,
        rotation: 'N',
        barcodeContent: '{{REEL_ID}}',
        hriPosition: 'BOTTOM',
        hriFontSizeMm: 1.8,
        hriFontFamily: '0',
        hriBold: true,
        hriAlign: 'LEFT',
        hriOffsetXMm: 0,
        hriOffsetYMm: 0.4,
      },
      { key: 'composite', kind: 'BUILTIN', visible: isVisible('composite'), xMm: 1.5, yMm: 24.8, fontSizeMm: roundMm(1.5 * fontFactor), widthMm: 47, rotation: 'N', fontFamily: '0' },
      { key: 'footer', kind: 'BUILTIN', visible: true, xMm: 1.5, yMm: 27.5, fontSizeMm: roundMm(1.5 * fontFactor), widthMm: 47, rotation: 'N', fontFamily: '0' },
    ];
  }

  if (paperSize === '100x60mm') {
    const bh = barcodeHeightMm ?? 12;
    return [
      { key: 'header', kind: 'BUILTIN', visible: isVisible('header'), xMm: 3.0, yMm: 2.0, fontSizeMm: roundMm(3.0 * fontFactor), widthMm: 94, rotation: 'N', fontFamily: '0', bold: true },
      { key: 'mpnQty', kind: 'BUILTIN', visible: isVisible('mpnQty'), xMm: 3.0, yMm: 6.5, fontSizeMm: roundMm(4.2 * fontFactor), widthMm: 94, rotation: 'N', fontFamily: '0', bold: true },
      { key: 'lotDcBin', kind: 'BUILTIN', visible: isVisible('lotDcBin'), xMm: 3.0, yMm: 15.5, fontSizeMm: roundMm(2.8 * fontFactor), widthMm: 94, rotation: 'N', fontFamily: '0' },
      { key: 'ownership', kind: 'BUILTIN', visible: isVisible('ownership'), xMm: 3.0, yMm: 20.5, fontSizeMm: roundMm(2.5 * fontFactor), widthMm: 94, rotation: 'N', fontFamily: '0' },
      { key: 'packagingMpq', kind: 'BUILTIN', visible: isVisible('packagingMpq'), xMm: 3.0, yMm: 24.5, fontSizeMm: roundMm(2.5 * fontFactor), widthMm: 94, rotation: 'N', fontFamily: '0' },
      { key: 'supplier', kind: 'BUILTIN', visible: isVisible('supplier'), xMm: 3.0, yMm: 28.5, fontSizeMm: roundMm(2.5 * fontFactor), widthMm: 94, rotation: 'N', fontFamily: '0' },
      {
        key: 'barcode',
        kind: 'BUILTIN',
        visible: true,
        xMm: 3.5,
        yMm: 33.5,
        fontSizeMm: bh,
        widthMm: 93,
        rotation: 'N',
        barcodeContent: '{{REEL_ID}}',
        hriPosition: 'BOTTOM',
        hriFontSizeMm: 2.5,
        hriFontFamily: '0',
        hriBold: true,
        hriAlign: 'LEFT',
        hriOffsetXMm: 0,
        hriOffsetYMm: 0.6,
      },
      { key: 'composite', kind: 'BUILTIN', visible: isVisible('composite'), xMm: 3.0, yMm: 49.5, fontSizeMm: roundMm(2.1 * fontFactor), widthMm: 94, rotation: 'N', fontFamily: '0' },
      { key: 'footer', kind: 'BUILTIN', visible: true, xMm: 3.0, yMm: 55.0, fontSizeMm: roundMm(2.1 * fontFactor), widthMm: 94, rotation: 'N', fontFamily: '0' },
    ];
  }

  // Proportional scaling for CUSTOM or standard 70x40mm
  const { widthMm, heightMm } = getPaperDimensionsMm(paperSize, customWidthMm, customHeightMm);
  const sx = widthMm / 70;
  const sy = heightMm / 40;
  const sf = Math.max(0.65, Math.min(1.6, Math.min(sx, sy)));
  const marginX = roundMm(Math.max(1.5, 2.0 * sx));
  const contentW = roundMm(Math.max(14, widthMm - marginX * 2));
  const bh = barcodeHeightMm ?? roundMm(Math.max(5, Math.min(18, 9 * sy)));

  return [
    { key: 'header', kind: 'BUILTIN', visible: isVisible('header'), xMm: marginX, yMm: roundMm(1.5 * sy), fontSizeMm: roundMm(Math.max(1.4, 2.2 * sf * fontFactor)), widthMm: contentW, rotation: 'N', fontFamily: '0', bold: true },
    { key: 'mpnQty', kind: 'BUILTIN', visible: isVisible('mpnQty'), xMm: marginX, yMm: roundMm(4.5 * sy), fontSizeMm: roundMm(Math.max(1.8, 3.2 * sf * fontFactor)), widthMm: contentW, rotation: 'N', fontFamily: '0', bold: true },
    { key: 'lotDcBin', kind: 'BUILTIN', visible: isVisible('lotDcBin'), xMm: marginX, yMm: roundMm(10.5 * sy), fontSizeMm: roundMm(Math.max(1.4, 2.1 * sf * fontFactor)), widthMm: contentW, rotation: 'N', fontFamily: '0' },
    { key: 'ownership', kind: 'BUILTIN', visible: isVisible('ownership'), xMm: marginX, yMm: roundMm(14.0 * sy), fontSizeMm: roundMm(Math.max(1.4, 1.9 * sf * fontFactor)), widthMm: contentW, rotation: 'N', fontFamily: '0' },
    { key: 'packagingMpq', kind: 'BUILTIN', visible: isVisible('packagingMpq'), xMm: marginX, yMm: roundMm(17.0 * sy), fontSizeMm: roundMm(Math.max(1.4, 1.9 * sf * fontFactor)), widthMm: contentW, rotation: 'N', fontFamily: '0' },
    { key: 'supplier', kind: 'BUILTIN', visible: isVisible('supplier'), xMm: marginX, yMm: roundMm(20.0 * sy), fontSizeMm: roundMm(Math.max(1.4, 1.9 * sf * fontFactor)), widthMm: contentW, rotation: 'N', fontFamily: '0' },
    {
      key: 'barcode',
      kind: 'BUILTIN',
      visible: true,
      xMm: roundMm(marginX + 0.5),
      yMm: roundMm(23.0 * sy),
      fontSizeMm: bh,
      widthMm: roundMm(Math.max(12, contentW - 1)),
      rotation: 'N',
      barcodeContent: '{{REEL_ID}}',
      hriPosition: 'BOTTOM',
      hriFontSizeMm: roundMm(Math.max(1.5, 2.0 * sf)),
      hriFontFamily: '0',
      hriBold: true,
      hriAlign: 'LEFT',
      hriOffsetXMm: 0,
      hriOffsetYMm: 0.5,
    },
    { key: 'composite', kind: 'BUILTIN', visible: isVisible('composite'), xMm: marginX, yMm: roundMm(33.5 * sy), fontSizeMm: roundMm(Math.max(1.3, 1.7 * sf * fontFactor)), widthMm: contentW, rotation: 'N', fontFamily: '0' },
    { key: 'footer', kind: 'BUILTIN', visible: true, xMm: marginX, yMm: roundMm(36.8 * sy), fontSizeMm: roundMm(Math.max(1.3, 1.7 * sf * fontFactor)), widthMm: contentW, rotation: 'N', fontFamily: '0' },
  ];
}

export function normalizeElementLayouts(
  template: Pick<
    LabelTemplate,
    | 'paperSize'
    | 'customWidthMm'
    | 'customHeightMm'
    | 'elementLayouts'
    | 'elementOrder'
    | 'showFields'
    | 'fontScale'
    | 'barcodeHeightMm'
  >
): LabelElementLayout[] {
  const defaults = buildDefaultElementLayouts(
    template.paperSize,
    template.showFields,
    template.fontScale ?? 'STANDARD',
    template.barcodeHeightMm,
    template.customWidthMm,
    template.customHeightMm
  );
  const { widthMm, heightMm } = getPaperDimensionsMm(
    template.paperSize,
    template.customWidthMm,
    template.customHeightMm
  );
  const defaultByKey = new Map(defaults.map((d) => [d.key, d]));

  if (Array.isArray(template.elementLayouts) && template.elementLayouts.length > 0) {
    const incomingByKey = new Map(template.elementLayouts.map((l) => [l.key, l]));
    const order = normalizeElementOrder([
      ...template.elementLayouts.map((l) => l.key),
      ...(template.elementOrder ?? []),
    ]);
    return order
      .map((key) => {
        const def = defaultByKey.get(key);
        const inc = incomingByKey.get(key);
        if (!inc && def) return def;
        if (!inc) return null;
        const kind = resolveElementKind(inc);
        const minSize = kind === 'BOX' ? 0.2 : 1.2;
        const maxSize = kind === 'BOX' ? heightMm : 36;
        const base: LabelElementLayout = {
          ...(def ?? {}),
          ...inc,
          key,
          kind,
          visible: Boolean(inc.visible),
          xMm: Math.max(0, Math.min(widthMm - 1, Number(inc.xMm) || 0)),
          yMm: Math.max(0, Math.min(heightMm - 1, Number(inc.yMm) || 0)),
          fontSizeMm: Math.max(
            minSize,
            Math.min(maxSize, Number(inc.fontSizeMm) || def?.fontSizeMm || 2.4)
          ),
          widthMm: Math.max(
            4,
            Math.min(widthMm, Number(inc.widthMm) || def?.widthMm || Math.max(16, widthMm - 4))
          ),
          rotation: inc.rotation ?? def?.rotation ?? 'N',
          fontFamily: inc.fontFamily ?? def?.fontFamily ?? '0',
          textAlign: inc.textAlign ?? def?.textAlign ?? 'LEFT',
        };
        if (isBarcodeElement(base)) {
          base.hriPosition = inc.hriPosition ?? def?.hriPosition ?? 'BOTTOM';
          base.hriFontSizeMm = Math.max(
            1.2,
            Math.min(12, Number(inc.hriFontSizeMm) || def?.hriFontSizeMm || 2.0)
          );
          base.hriFontFamily = inc.hriFontFamily ?? def?.hriFontFamily ?? '0';
          base.hriAlign = inc.hriAlign ?? def?.hriAlign ?? 'LEFT';
          base.hriBold = inc.hriBold ?? def?.hriBold ?? true;
          base.hriInvert = inc.hriInvert ?? false;
          base.hriOffsetXMm = Number.isFinite(Number(inc.hriOffsetXMm))
            ? Number(inc.hriOffsetXMm)
            : def?.hriOffsetXMm ?? 0;
          base.hriOffsetYMm = Number.isFinite(Number(inc.hriOffsetYMm))
            ? Number(inc.hriOffsetYMm)
            : def?.hriOffsetYMm ?? 0.5;
          if (inc.moduleWidthDots !== undefined) {
            base.moduleWidthDots = Math.max(1, Math.min(8, Math.round(Number(inc.moduleWidthDots) || 2)));
          }
        }
        if (kind === 'BOX') {
          base.borderThicknessMm = Math.max(
            0.2,
            Math.min(5, Number(inc.borderThicknessMm) || 0.4)
          );
        }
        return base;
      })
      .filter((item): item is LabelElementLayout => item !== null);
  }

  const order = normalizeElementOrder(template.elementOrder);
  return order
    .map((key) => defaultByKey.get(key))
    .filter((item): item is LabelElementLayout => Boolean(item));
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

export interface ComputedHriBox {
  visible: boolean;
  xMm: number;
  yMm: number;
  widthMm: number;
  fontSizeMm: number;
  fontFamily: LabelFontFamily;
  bold: boolean;
  invert: boolean;
  align: LabelTextAlign;
  text: string;
}

export function resolveBarcodeValue(
  el: LabelElementLayout,
  barcodeType: LabelBarcodeType,
  vars: Record<string, string>
): string {
  if (el.barcodeContent && el.barcodeContent.trim()) {
    return interpolateZplTemplate(el.barcodeContent, vars);
  }
  if (barcodeType === 'QR' || barcodeType === 'DATAMATRIX') {
    return vars.COMPOSITE;
  }
  return vars.REEL_ID;
}

export function computeBarcodeHriBoxMm(
  el: LabelElementLayout,
  barcodeType: LabelBarcodeType,
  vars: Record<string, string>,
  paperWidthMm: number,
  paperHeightMm: number
): ComputedHriBox {
  const pos: BarcodeHriPosition = el.hriPosition ?? 'BOTTOM';
  const fontSizeMm = Math.max(1.2, Math.min(12, el.hriFontSizeMm ?? 2.0));
  const fontFamily: LabelFontFamily = el.hriFontFamily ?? '0';
  const bold = el.hriBold ?? true;
  const invert = Boolean(el.hriInvert);
  const align: LabelTextAlign = el.hriAlign ?? 'LEFT';
  const barcodeVal = resolveBarcodeValue(el, barcodeType, vars);
  const text =
    el.hriTextTemplate && el.hriTextTemplate.trim()
      ? interpolateZplTemplate(el.hriTextTemplate, vars)
      : barcodeType === 'QR' || barcodeType === 'DATAMATRIX'
      ? vars.REEL_ID
      : barcodeVal;

  if (pos === 'NONE' || !text) {
    return {
      visible: false,
      xMm: el.xMm,
      yMm: el.yMm,
      widthMm: el.widthMm ?? 20,
      fontSizeMm,
      fontFamily,
      bold,
      invert,
      align,
      text,
    };
  }

  const is2D = barcodeType === 'QR' || barcodeType === 'DATAMATRIX';
  const barWidthMm = is2D
    ? Math.max(6, el.fontSizeMm || 8)
    : el.widthMm ?? Math.max(16, paperWidthMm - el.xMm * 2);
  const barHeightMm = Math.max(4, el.fontSizeMm || 8);
  const dx = Number(el.hriOffsetXMm) || 0;
  const dy = Number(el.hriOffsetYMm) || 0;

  let xMm = el.xMm;
  let yMm = el.yMm;
  let boxWidthMm = is2D ? Math.max(barWidthMm, Math.min(paperWidthMm - el.xMm, 26)) : barWidthMm;

  if (pos === 'BOTTOM') {
    xMm = el.xMm + dx;
    yMm = el.yMm + barHeightMm + 0.5 + dy;
  } else if (pos === 'TOP') {
    xMm = el.xMm + dx;
    yMm = el.yMm - fontSizeMm - 0.6 + dy;
  } else if (pos === 'RIGHT') {
    xMm = el.xMm + barWidthMm + 1.2 + dx;
    yMm = el.yMm + Math.max(0, (barHeightMm - fontSizeMm) / 2) + dy;
    boxWidthMm = Math.max(12, paperWidthMm - xMm - 1);
  } else if (pos === 'LEFT') {
    boxWidthMm = Math.max(10, Math.min(el.xMm - 1.5, 24));
    xMm = Math.max(0.5, el.xMm - boxWidthMm - 1.0) + dx;
    yMm = el.yMm + Math.max(0, (barHeightMm - fontSizeMm) / 2) + dy;
  } else {
    // CUSTOM: user-specified offset relative to barcode origin
    xMm = el.xMm + dx;
    yMm = el.yMm + dy;
  }

  return {
    visible: true,
    xMm: Math.max(0, Math.min(paperWidthMm - 2, Math.round(xMm * 10) / 10)),
    yMm: Math.max(0, Math.min(paperHeightMm - 1.5, Math.round(yMm * 10) / 10)),
    widthMm: Math.max(6, Math.round(boxWidthMm * 10) / 10),
    fontSizeMm,
    fontFamily,
    bold,
    invert,
    align,
    text,
  };
}

export function buildGlobalShiftZplLines(
  offsetXMm = 0,
  offsetYMm = 0,
  dpi = 203
): { lines: string[]; shiftXDots: number; shiftYDots: number; summary: string } {
  const safeX = Number.isFinite(offsetXMm) ? Math.max(-30, Math.min(30, offsetXMm)) : 0;
  const safeY = Number.isFinite(offsetYMm) ? Math.max(-30, Math.min(30, offsetYMm)) : 0;
  const shiftXDots = mmToSignedDots(safeX, dpi);
  const shiftYDots = mmToSignedDots(safeY, dpi);

  const lhX = Math.max(0, shiftXDots);
  const lhY = Math.max(0, shiftYDots);
  const lines: string[] = [`^LH${lhX},${lhY}`];
  const parts: string[] = [`^LH${lhX},${lhY}`];

  if (shiftXDots < 0) {
    lines.push(`^LS${shiftXDots}`);
    parts.push(`^LS${shiftXDots}`);
  }
  if (shiftYDots < 0) {
    const clampedLt = Math.max(-120, shiftYDots);
    lines.push(`^LT${clampedLt}`);
    parts.push(`^LT${clampedLt}`);
  }

  return {
    lines,
    shiftXDots,
    shiftYDots,
    summary: parts.join(' '),
  };
}

function alignToZplFb(align?: LabelTextAlign): 'L' | 'C' | 'R' {
  if (align === 'CENTER') return 'C';
  if (align === 'RIGHT') return 'R';
  return 'L';
}

function emitStyledZplTextLines(params: {
  x: number;
  y: number;
  fh: number;
  fw: number;
  boxW: number;
  rot: LabelElementRotation;
  fontFamily?: LabelFontFamily;
  align?: LabelTextAlign;
  bold?: boolean;
  invert?: boolean;
  text: string;
}): string[] {
  const {
    x,
    y,
    fh,
    fw,
    boxW,
    rot,
    fontFamily = '0',
    align = 'LEFT',
    bold = false,
    invert = false,
    text,
  } = params;
  if (!text) return [];

  const out: string[] = [];
  const fbAlign = alignToZplFb(align);
  const fontCmd = `^A${fontFamily}${rot},${fh},${fw}`;
  const fbCmd = align !== 'LEFT' ? `^FB${boxW},1,0,${fbAlign}` : '';

  if (invert) {
    const padX = Math.max(3, Math.round(fh * 0.18));
    const padY = Math.max(2, Math.round(fh * 0.15));
    const estW =
      align === 'LEFT'
        ? Math.min(boxW, Math.max(fh * 2, Math.round(text.length * fw * 0.68) + padX * 2))
        : boxW;
    const bgH = fh + padY * 2;
    out.push(`^FO${Math.max(0, x - padX)},${Math.max(0, y - padY)}^GB${estW},${bgH},${bgH}^FS`);
    out.push(`^FO${x},${y}^FR${fontCmd}${fbCmd}^FD${text}^FS`);
    if (bold) {
      out.push(`^FO${x + 1},${y}^FR${fontCmd}${fbCmd}^FD${text}^FS`);
    }
    return out;
  }

  out.push(`^FO${x},${y}${fontCmd}${fbCmd}^FD${text}^FS`);
  if (bold) {
    out.push(`^FO${x + 1},${y}${fontCmd}${fbCmd}^FD${text}^FS`);
  }
  return out;
}

export function generateZplFromTemplate(options: {
  template: LabelTemplate;
  reel: ReelItem;
  material?: MaterialSku;
  copies?: number;
  darkness?: number;
  printSpeed?: number;
  offsetXMm?: number;
  offsetYMm?: number;
  forceVisual?: boolean;
}): string {
  const {
    template,
    reel,
    material,
    copies = 1,
    darkness = 18,
    printSpeed = 4,
    offsetXMm,
    offsetYMm,
    forceVisual = false,
  } = options;

  const dpi = normalizeDpi(template.dpi);
  const { widthMm, heightMm } = getPaperDimensionsMm(
    template.paperSize,
    template.customWidthMm,
    template.customHeightMm
  );
  const paperLabel = formatPaperSizeLabel(template);
  const pw = mmToDots(widthMm, dpi);
  const ll = mmToDots(heightMm, dpi);
  const safeCopies = Math.max(1, Math.min(999, Math.round(copies || 1)));
  const safeDarkness = Math.max(0, Math.min(30, Math.round(darkness)));
  const safeSpeed = Math.max(2, Math.min(12, Math.round(printSpeed)));
  const effectiveOffsetX = offsetXMm ?? template.offsetXMm ?? 0;
  const effectiveOffsetY = offsetYMm ?? template.offsetYMm ?? 0;
  const shift = buildGlobalShiftZplLines(effectiveOffsetX, effectiveOffsetY, dpi);
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
    if (effectiveOffsetX !== 0 || effectiveOffsetY !== 0) {
      raw = raw.replace(/^\^XA/i, `^XA\n${shift.lines.join('\n')}`);
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

  const layouts = normalizeElementLayouts(template);
  const defaultBarcodeType: LabelBarcodeType = template.barcodeType ?? 'CODE128';

  const lines: string[] = [
    '^XA',
    '^CI28',
    `^PW${pw}`,
    `^LL${ll}`,
    ...shift.lines,
    `^MD${safeDarkness}`,
    `^PR${safeSpeed}`,
    `; Template: ${sanitizeZplText(template.templateName)} (${paperLabel} @ ${dpi}dpi, Shift X:${effectiveOffsetX}mm Y:${effectiveOffsetY}mm)`,
  ];

  for (const el of layouts) {
    if (!el.visible) continue;
    const kind = resolveElementKind(el);
    const x = mmToDots(el.xMm, dpi);
    const y = mmToDots(el.yMm, dpi);
    const fh = Math.max(10, mmToDots(el.fontSizeMm, dpi));
    const fw = Math.max(8, Math.round(fh * 0.84));
    const boxW = Math.max(40, mmToDots(el.widthMm ?? widthMm - el.xMm * 2, dpi));
    const rot: LabelElementRotation = el.rotation ?? 'N';
    const fontFamily: LabelFontFamily = el.fontFamily ?? '0';

    if (kind === 'BOX') {
      const boxH = Math.max(1, mmToDots(el.fontSizeMm, dpi));
      const thick = Math.max(1, mmToDots(el.borderThicknessMm ?? 0.4, dpi));
      lines.push(`^FO${x},${y}^GB${boxW},${boxH},${thick}^FS`);
      continue;
    }

    if (kind === 'TEXT') {
      const resolved = interpolateZplTemplate(el.contentTemplate ?? '', vars);
      lines.push(
        ...emitStyledZplTextLines({
          x,
          y,
          fh,
          fw,
          boxW,
          rot,
          fontFamily,
          align: el.textAlign ?? 'LEFT',
          bold: Boolean(el.bold),
          invert: Boolean(el.invert),
          text: resolved,
        })
      );
      continue;
    }

    if (isBarcodeElement(el)) {
      const bcType: LabelBarcodeType =
        el.key === 'barcode' ? el.barcodeType ?? defaultBarcodeType : el.barcodeType ?? 'CODE128';
      const barH = Math.max(20, mmToDots(el.fontSizeMm || template.barcodeHeightMm || 8, dpi));
      const bcData = resolveBarcodeValue(el, bcType, vars);
      const defaultModuleW = dpi >= 450 ? 4 : dpi >= 280 ? 3 : widthMm <= 55 ? 1 : 2;
      const modW = el.moduleWidthDots ?? defaultModuleW;

      if (bcType === 'CODE128') {
        lines.push(`^FO${x},${y}^BY${modW},2,${barH}`);
        // Always disable rigid built-in HRI ('N') so our positioned & styled HRI text below is exact
        lines.push(`^BC${rot},${barH},N,N,N^FD${bcData}^FS`);
      } else if (bcType === 'CODE39') {
        lines.push(`^FO${x},${y}^BY${modW},2,${barH}`);
        lines.push(`^B3${rot},N,${barH},N,N^FD${bcData.toUpperCase()}^FS`);
      } else if (bcType === 'QR') {
        const mag =
          el.moduleWidthDots ??
          Math.max(2, Math.min(10, Math.round((el.fontSizeMm || 8) * (dpi / 203) * 0.42)));
        lines.push(`^FO${x},${y}^BQ${rot},2,${mag}^FDQA,${bcData}^FS`);
      } else {
        const modDots =
          el.moduleWidthDots ??
          Math.max(3, Math.min(10, Math.round((el.fontSizeMm || 8) * (dpi / 203) * 0.5)));
        lines.push(`^FO${x},${y}^BX${rot},${modDots},200^FD${bcData}^FS`);
      }

      const hri = computeBarcodeHriBoxMm(el, bcType, vars, widthMm, heightMm);
      if (hri.visible) {
        const hriX = mmToDots(hri.xMm, dpi);
        const hriY = mmToDots(hri.yMm, dpi);
        const hriFh = Math.max(10, mmToDots(hri.fontSizeMm, dpi));
        const hriFw = Math.max(8, Math.round(hriFh * 0.84));
        const hriBoxW = Math.max(40, mmToDots(hri.widthMm, dpi));
        lines.push(
          ...emitStyledZplTextLines({
            x: hriX,
            y: hriY,
            fh: hriFh,
            fw: hriFw,
            boxW: hriBoxW,
            rot,
            fontFamily: hri.fontFamily,
            align: hri.align,
            bold: hri.bold,
            invert: hri.invert,
            text: hri.text,
          })
        );
      }
      continue;
    }

    // Built-in fields (also respect custom fontFamily / bold / invert / contentTemplate override)
    if (el.contentTemplate && el.contentTemplate.trim()) {
      const overrideText = interpolateZplTemplate(el.contentTemplate, vars);
      lines.push(
        ...emitStyledZplTextLines({
          x,
          y,
          fh,
          fw,
          boxW,
          rot,
          fontFamily,
          align: el.textAlign ?? 'LEFT',
          bold: Boolean(el.bold),
          invert: Boolean(el.invert),
          text: overrideText,
        })
      );
      continue;
    }

    if (el.key === 'header') {
      lines.push(
        ...emitStyledZplTextLines({
          x,
          y,
          fh,
          fw,
          boxW,
          rot,
          fontFamily,
          bold: Boolean(el.bold),
          invert: Boolean(el.invert),
          text: vars.HEADER,
        })
      );
      lines.push(
        `^FO${x},${y}^A${fontFamily}${rot},${Math.round(fh * 0.85)},${Math.round(fw * 0.85)}^FB${boxW},1,0,R^FD${paperLabel}^FS`
      );
      lines.push(`^FO${x},${y + fh + Math.round(fh * 0.18)}^GB${boxW},1,1^FS`);
      continue;
    }

    if (el.key === 'mpnQty') {
      lines.push(
        ...emitStyledZplTextLines({
          x,
          y,
          fh,
          fw,
          boxW,
          rot,
          fontFamily,
          bold: Boolean(el.bold),
          invert: Boolean(el.invert),
          text: `MPN:${vars.MPN}`,
        })
      );
      lines.push(
        `^FO${x},${y}^A${fontFamily}${rot},${fh},${fw}^FB${boxW},1,0,R^FDQTY:${vars.QTY} ${vars.UNIT}^FS`
      );
      if (template.showFields.skuCode) {
        const skuH = Math.max(10, Math.round(fh * 0.65));
        lines.push(
          `^FO${x},${y + fh + Math.round(fh * 0.12)}^A${fontFamily}${rot},${skuH},${Math.round(skuH * 0.85)}^FDSKU:${vars.SKU}^FS`
        );
      }
      continue;
    }

    if (el.key === 'lotDcBin') {
      const leftTxt = template.showFields.lotDateCode ? `LOT:${vars.LOT}  D/C:${vars.DC}` : '';
      const rightTxt = template.showFields.binMsd ? `BIN:${vars.BIN} ${vars.MSD}` : '';
      if (leftTxt) {
        lines.push(
          ...emitStyledZplTextLines({
            x,
            y,
            fh,
            fw,
            boxW,
            rot,
            fontFamily,
            bold: Boolean(el.bold),
            invert: Boolean(el.invert),
            text: leftTxt,
          })
        );
      }
      if (rightTxt) {
        lines.push(`^FO${x},${y}^A${fontFamily}${rot},${fh},${fw}^FB${boxW},1,0,R^FD${rightTxt}^FS`);
      }
      continue;
    }

    if (el.key === 'ownership') {
      lines.push(
        ...emitStyledZplTextLines({
          x,
          y,
          fh,
          fw,
          boxW,
          rot,
          fontFamily,
          align: el.textAlign ?? 'LEFT',
          bold: Boolean(el.bold),
          invert: Boolean(el.invert),
          text: `[${vars.OWNERSHIP}] ${vars.OWNER} (${vars.CUSTOMER})`,
        })
      );
      continue;
    }

    if (el.key === 'packagingMpq') {
      const mpqPart = vars.MPQ ? ` MPQ:${vars.MPQ}` : '';
      lines.push(
        ...emitStyledZplTextLines({
          x,
          y,
          fh,
          fw,
          boxW,
          rot,
          fontFamily,
          align: el.textAlign ?? 'LEFT',
          bold: Boolean(el.bold),
          invert: Boolean(el.invert),
          text: `PKG:${vars.PACKAGING}${mpqPart}`,
        })
      );
      continue;
    }

    if (el.key === 'supplier') {
      lines.push(
        ...emitStyledZplTextLines({
          x,
          y,
          fh,
          fw,
          boxW,
          rot,
          fontFamily,
          align: el.textAlign ?? 'LEFT',
          bold: Boolean(el.bold),
          invert: Boolean(el.invert),
          text: `SUP:${vars.SUPPLIER}`,
        })
      );
      continue;
    }

    if (el.key === 'composite') {
      lines.push(`^FO${x},${y}^A${fontFamily}${rot},${fh},${fw}^FB${boxW},2,0,L^FD${vars.COMPOSITE}^FS`);
      continue;
    }

    if (el.key === 'footer') {
      if (!vars.FOOTER) continue;
      lines.push(`^FO${x},${Math.max(0, y - 4)}^GB${boxW},1,1^FS`);
      lines.push(
        ...emitStyledZplTextLines({
          x,
          y,
          fh,
          fw,
          boxW,
          rot,
          fontFamily,
          align: el.textAlign ?? 'LEFT',
          bold: Boolean(el.bold),
          invert: Boolean(el.invert),
          text: vars.FOOTER,
        })
      );
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
    for (let i = 0; i < size; i++) {
      grid[i][0] = true;
      grid[size - 1][i] = true;
      grid[0][i] = i % 2 === 0;
      grid[i][size - 1] = i % 2 === 1;
    }
  }

  return grid;
}
