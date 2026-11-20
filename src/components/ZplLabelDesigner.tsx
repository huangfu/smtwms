import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Barcode,
  Check,
  Code2,
  Copy,
  Download,
  Eye,
  LayoutGrid,
  Minus,
  Move,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import { useState } from 'react';
import type {
  BarcodeHriPosition,
  LabelBarcodeType,
  LabelElementLayout,
  LabelElementRotation,
  LabelFontFamily,
  LabelFontScale,
  LabelPaperPreset,
  LabelTemplate,
  LabelTextAlign,
  ReelItem,
  WmsState,
} from '../types/wms';
import {
  buildDefaultElementLayouts,
  buildGlobalShiftZplLines,
  BUILTIN_KEY_SET,
  DPI_PRESETS,
  formatPaperSizeLabel,
  generateZplFromTemplate,
  getElementDisplayName,
  getPaperDimensionsMm,
  isBarcodeElement,
  mmToDots,
  normalizeDpi,
  normalizeElementLayouts,
  resolveElementKind,
  ZPL_PLACEHOLDERS,
} from '../utils/zplEngine';
import { ThermalLabelPreview } from './ThermalLabelPreview';

interface ZplLabelDesignerProps {
  state: WmsState;
  onSaveLabelTemplate: (
    tpl: Omit<LabelTemplate, 'templateId'> & { templateId?: string }
  ) => Promise<void>;
  onDeleteLabelTemplate: (templateId: string) => Promise<void>;
}

const QUICK_VARS = ZPL_PLACEHOLDERS.slice(0, 12);

export function ZplLabelDesigner({
  state,
  onSaveLabelTemplate,
  onDeleteLabelTemplate,
}: ZplLabelDesignerProps) {
  const [editingTplId, setEditingTplId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [paperSize, setPaperSize] = useState<LabelPaperPreset>('70x40mm');
  const [customWidthMm, setCustomWidthMm] = useState<number>(80);
  const [customHeightMm, setCustomHeightMm] = useState<number>(45);
  const [dpiPreset, setDpiPreset] = useState<'203' | '300' | '600' | 'CUSTOM'>('203');
  const [dpi, setDpi] = useState<number>(203);
  const [offsetXMm, setOffsetXMm] = useState<number>(0);
  const [offsetYMm, setOffsetYMm] = useState<number>(0);
  const [barcodeType, setBarcodeType] = useState<LabelBarcodeType>('CODE128');
  const [zplMode, setZplMode] = useState<'VISUAL' | 'CUSTOM_ZPL'>('VISUAL');
  const [fontScale, setFontScale] = useState<LabelFontScale>('STANDARD');
  const [barcodeHeightMm, setBarcodeHeightMm] = useState<number>(9);
  const [elementLayouts, setElementLayouts] = useState<LabelElementLayout[]>(() =>
    buildDefaultElementLayouts('70x40mm', undefined, 'STANDARD', 9)
  );
  const [selectedElementKey, setSelectedElementKey] = useState<string>('barcode');
  const [customZpl, setCustomZpl] = useState('');
  const [headerTitle, setHeaderTitle] = useState('智造 SMT-WMS · 料盘追溯标签');
  const [footerNote, setFooterNote] = useState('专料专账隔离管控 · 严格FIFO先进先出');
  const [showSkuCode, setShowSkuCode] = useState(true);
  const [showLotDateCode, setShowLotDateCode] = useState(true);
  const [showBinMsd, setShowBinMsd] = useState(true);
  const [showOwnership, setShowOwnership] = useState(true);
  const [showPackagingMpq, setShowPackagingMpq] = useState(true);
  const [showSupplier, setShowSupplier] = useState(true);
  const [showComposite, setShowComposite] = useState(true);
  const [isDefault, setIsDefault] = useState(false);

  const [tplMsg, setTplMsg] = useState<string | null>(null);
  const [tplErr, setTplErr] = useState<string | null>(null);
  const [confirmDeleteTplId, setConfirmDeleteTplId] = useState<string | null>(null);

  const [previewReelId, setPreviewReelId] = useState<string>(
    state.reels[0]?.reelId ?? ''
  );
  const [showZplCode, setShowZplCode] = useState(true);
  const [zplCopied, setZplCopied] = useState(false);

  const currentShowFields = {
    mpn: true,
    skuCode: showSkuCode,
    ownership: showOwnership,
    packagingMpq: showPackagingMpq,
    supplier: showSupplier,
    lotDateCode: showLotDateCode,
    binMsd: showBinMsd,
    compositeBarcode: showComposite,
  };

  const { widthMm, heightMm } = getPaperDimensionsMm(
    paperSize,
    customWidthMm,
    customHeightMm
  );
  const safeDpi = normalizeDpi(dpi);
  const shiftInfo = buildGlobalShiftZplLines(offsetXMm, offsetYMm, safeDpi);

  const draftTemplate: LabelTemplate = {
    templateId: editingTplId ?? 'PREVIEW-DRAFT',
    templateName: templateName.trim() || '当前设计预览模板',
    paperSize,
    customWidthMm: paperSize === 'CUSTOM' ? customWidthMm : undefined,
    customHeightMm: paperSize === 'CUSTOM' ? customHeightMm : undefined,
    dpi: safeDpi,
    offsetXMm,
    offsetYMm,
    barcodeType,
    zplMode,
    fontScale,
    barcodeHeightMm,
    elementOrder: elementLayouts.map((l) => l.key),
    elementLayouts,
    customZpl,
    headerTitle,
    footerNote,
    showFields: currentShowFields,
    isDefault,
  };

  const resetTplForm = () => {
    setEditingTplId(null);
    setTemplateName('');
    setPaperSize('70x40mm');
    setCustomWidthMm(80);
    setCustomHeightMm(45);
    setDpiPreset('203');
    setDpi(203);
    setOffsetXMm(0);
    setOffsetYMm(0);
    setBarcodeType('CODE128');
    setZplMode('VISUAL');
    setFontScale('STANDARD');
    setBarcodeHeightMm(9);
    setElementLayouts(buildDefaultElementLayouts('70x40mm', undefined, 'STANDARD', 9));
    setSelectedElementKey('barcode');
    setCustomZpl('');
    setHeaderTitle('智造 SMT-WMS · 料盘追溯标签');
    setFooterNote('专料专账隔离管控 · 严格FIFO先进先出');
    setShowSkuCode(true);
    setShowLotDateCode(true);
    setShowBinMsd(true);
    setShowOwnership(true);
    setShowPackagingMpq(true);
    setShowSupplier(true);
    setShowComposite(true);
    setIsDefault(false);
  };

  const startEditTpl = (tpl: LabelTemplate) => {
    setEditingTplId(tpl.templateId);
    setTemplateName(tpl.templateName);
    setPaperSize(tpl.paperSize);
    const dims = getPaperDimensionsMm(tpl.paperSize, tpl.customWidthMm, tpl.customHeightMm);
    setCustomWidthMm(tpl.customWidthMm ?? dims.widthMm);
    setCustomHeightMm(tpl.customHeightMm ?? dims.heightMm);
    const loadedDpi = normalizeDpi(tpl.dpi);
    setDpi(loadedDpi);
    setDpiPreset(
      (DPI_PRESETS as readonly number[]).includes(loadedDpi)
        ? (String(loadedDpi) as '203' | '300' | '600')
        : 'CUSTOM'
    );
    setOffsetXMm(tpl.offsetXMm ?? 0);
    setOffsetYMm(tpl.offsetYMm ?? 0);
    setBarcodeType(tpl.barcodeType ?? 'CODE128');
    setZplMode(tpl.zplMode ?? 'VISUAL');
    setFontScale(tpl.fontScale ?? 'STANDARD');
    setBarcodeHeightMm(tpl.barcodeHeightMm ?? 8);
    setElementLayouts(normalizeElementLayouts(tpl));
    setSelectedElementKey('barcode');
    setCustomZpl(tpl.customZpl ?? '');
    setHeaderTitle(tpl.headerTitle);
    setFooterNote(tpl.footerNote);
    setShowSkuCode(tpl.showFields.skuCode);
    setShowLotDateCode(tpl.showFields.lotDateCode);
    setShowBinMsd(tpl.showFields.binMsd);
    setShowOwnership(tpl.showFields.ownership);
    setShowPackagingMpq(tpl.showFields.packagingMpq);
    setShowSupplier(tpl.showFields.supplier);
    setShowComposite(tpl.showFields.compositeBarcode);
    setIsDefault(tpl.isDefault);
    setTplErr(null);
    setTplMsg(null);
  };

  const handlePaperSizeChange = (nextPaper: LabelPaperPreset) => {
    setPaperSize(nextPaper);
    const nextW = nextPaper === 'CUSTOM' ? customWidthMm : undefined;
    const nextH = nextPaper === 'CUSTOM' ? customHeightMm : undefined;
    const dims = getPaperDimensionsMm(nextPaper, nextW, nextH);
    const nextBh = dims.heightMm <= 32 ? 6 : dims.heightMm >= 55 ? 12 : 9;
    setBarcodeHeightMm(nextBh);
    const customExtras = elementLayouts.filter((l) => !BUILTIN_KEY_SET.has(l.key));
    setElementLayouts([
      ...buildDefaultElementLayouts(nextPaper, currentShowFields, fontScale, nextBh, nextW, nextH),
      ...customExtras,
    ]);
  };

  const handleAutoRelayout = () => {
    const customExtras = elementLayouts.filter((l) => !BUILTIN_KEY_SET.has(l.key));
    setElementLayouts([
      ...buildDefaultElementLayouts(
        paperSize,
        currentShowFields,
        fontScale,
        barcodeHeightMm,
        customWidthMm,
        customHeightMm
      ),
      ...customExtras,
    ]);
  };

  const nudgeGlobalOffset = (dx: number, dy: number) => {
    setOffsetXMm((prev) => Math.max(-30, Math.min(30, Math.round((prev + dx) * 10) / 10)));
    setOffsetYMm((prev) => Math.max(-30, Math.min(30, Math.round((prev + dy) * 10) / 10)));
  };

  const applyOffsetToAllElements = () => {
    if (offsetXMm === 0 && offsetYMm === 0) return;
    setElementLayouts((prev) =>
      prev.map((item) => ({
        ...item,
        xMm: Math.max(0, Math.min(widthMm - 1, Math.round((item.xMm + offsetXMm) * 10) / 10)),
        yMm: Math.max(0, Math.min(heightMm - 1, Math.round((item.yMm + offsetYMm) * 10) / 10)),
      }))
    );
    setOffsetXMm(0);
    setOffsetYMm(0);
    setTplMsg('已将整体 X/Y 偏移量合并写入所有元素坐标，全局偏移已归零');
  };

  const updateLayoutField = (key: string, patch: Partial<LabelElementLayout>) => {
    setElementLayouts((prev) =>
      prev.map((item) => (item.key === key ? { ...item, ...patch } : item))
    );
    if (key === 'barcode' && patch.barcodeType) {
      setBarcodeType(patch.barcodeType);
    }
    if (key === 'barcode' && patch.fontSizeMm !== undefined) {
      setBarcodeHeightMm(patch.fontSizeMm);
    }
    if (key === 'ownership' && patch.visible !== undefined) setShowOwnership(patch.visible);
    if (key === 'packagingMpq' && patch.visible !== undefined) setShowPackagingMpq(patch.visible);
    if (key === 'supplier' && patch.visible !== undefined) setShowSupplier(patch.visible);
    if (key === 'composite' && patch.visible !== undefined) setShowComposite(patch.visible);
    if (key === 'lotDcBin' && patch.visible !== undefined) {
      setShowLotDateCode(patch.visible);
      setShowBinMsd(patch.visible);
    }
  };

  const handleAddCustomElement = (kind: 'TEXT' | 'BARCODE' | 'BOX') => {
    const existingCount = elementLayouts.filter((l) => resolveElementKind(l) === kind).length + 1;
    const prefix = kind === 'BARCODE' ? 'CUSTOM_BC' : kind === 'BOX' ? 'CUSTOM_BOX' : 'CUSTOM_TXT';
    const key = `${prefix}_${Date.now().toString(36).slice(-4)}_${existingCount}`;

    let newEl: LabelElementLayout;
    if (kind === 'BARCODE') {
      newEl = {
        key,
        kind: 'BARCODE',
        label: `自定义条码 #${existingCount}`,
        visible: true,
        xMm: Math.max(2, Math.round((widthMm * 0.55) * 2) / 2),
        yMm: Math.max(4, Math.round((heightMm * 0.25) * 2) / 2),
        fontSizeMm: 8,
        widthMm: Math.min(28, Math.max(12, Math.round(widthMm * 0.38))),
        rotation: 'N',
        barcodeType: 'CODE128',
        barcodeContent: '{{MPN}}',
        moduleWidthDots: 2,
        hriPosition: 'BOTTOM',
        hriTextTemplate: '',
        hriFontSizeMm: 2.0,
        hriFontFamily: '0',
        hriBold: true,
        hriInvert: false,
        hriAlign: 'CENTER',
        hriOffsetXMm: 0,
        hriOffsetYMm: 0.4,
      };
    } else if (kind === 'BOX') {
      newEl = {
        key,
        kind: 'BOX',
        label: `分隔线/框 #${existingCount}`,
        visible: true,
        xMm: 2,
        yMm: Math.max(3, Math.round((heightMm * 0.5) * 2) / 2),
        fontSizeMm: 0.4,
        widthMm: Math.max(12, widthMm - 4),
        borderThicknessMm: 0.4,
        rotation: 'N',
      };
    } else {
      newEl = {
        key,
        kind: 'TEXT',
        label: `自定义文本 #${existingCount}`,
        visible: true,
        xMm: 2,
        yMm: Math.max(4, Math.round((heightMm * 0.35) * 2) / 2),
        fontSizeMm: 2.4,
        widthMm: Math.max(18, Math.round(widthMm * 0.5)),
        rotation: 'N',
        contentTemplate: 'RoHS无铅 · 客户:{{CUSTOMER}}',
        fontFamily: '0',
        bold: true,
        invert: false,
        textAlign: 'LEFT',
      };
    }

    setElementLayouts((prev) => [...prev, newEl]);
    setSelectedElementKey(key);
    setZplMode('VISUAL');
  };

  const handleDeleteCustomElement = (key: string) => {
    if (BUILTIN_KEY_SET.has(key)) return;
    setElementLayouts((prev) => prev.filter((item) => item.key !== key));
    if (selectedElementKey === key) {
      setSelectedElementKey('barcode');
    }
  };

  const buildSkeletonZplFromVisual = () => {
    const placeholderReel: ReelItem = {
      reelId: '{{REEL_ID}}',
      skuCode: '{{SKU}}',
      mpn: '{{MPN}}',
      lotNumber: '{{LOT}}',
      dateCode: '{{DC}}',
      supplier: '{{SUPPLIER}}',
      ownershipType: 'SELF_PURCHASED',
      ownerName: '{{OWNER}}',
      customerName: '{{CUSTOMER}}',
      mpq: undefined,
      receiptDocNo: 'RCV-PREVIEW',
      initialQty: 1000,
      qty: 1000,
      issuedQty: 0,
      binCode: '{{BIN}}',
      msdLevel: 'Level 3',
      msdState: 'SEALED',
      status: 'IN_STOCK',
      receivedAt: '',
      updatedAt: '',
    };
    const generated = generateZplFromTemplate({
      template: draftTemplate,
      reel: placeholderReel,
      forceVisual: true,
    })
      .replaceAll('QTY:1000 PCS', 'QTY:{{QTY}} {{UNIT}}')
      .replaceAll('Level 3', '{{MSD}}')
      .replaceAll('UID:{{REEL_ID}}|P:{{MPN}}|L:{{LOT}}|D:{{DC}}|Q:1000', '{{COMPOSITE}}');
    setCustomZpl(generated);
    setZplMode('CUSTOM_ZPL');
  };

  const handleTemplateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTplErr(null);
    setTplMsg(null);
    try {
      await onSaveLabelTemplate({
        templateId: editingTplId ?? undefined,
        templateName,
        paperSize,
        customWidthMm: paperSize === 'CUSTOM' ? customWidthMm : undefined,
        customHeightMm: paperSize === 'CUSTOM' ? customHeightMm : undefined,
        dpi: safeDpi,
        offsetXMm,
        offsetYMm,
        barcodeType,
        zplMode,
        fontScale,
        barcodeHeightMm,
        elementOrder: elementLayouts.map((l) => l.key),
        elementLayouts,
        customZpl,
        headerTitle,
        footerNote,
        showFields: currentShowFields,
        isDefault,
      });
      setTplMsg(
        editingTplId
          ? `已更新 ZPL 标签模板：${templateName}`
          : `已保存 ZPL 标签模板：${templateName}`
      );
      resetTplForm();
    } catch (err) {
      setTplErr(err instanceof Error ? err.message : '保存标签模板失败');
    }
  };

  const handleSetDefaultTpl = async (tpl: LabelTemplate) => {
    setTplErr(null);
    setTplMsg(null);
    try {
      await onSaveLabelTemplate({
        ...tpl,
        isDefault: true,
      });
      setTplMsg(`已将「${tpl.templateName}」设为默认打印模板`);
    } catch (err) {
      setTplErr(err instanceof Error ? err.message : '设置默认模板失败');
    }
  };

  const handleConfirmDeleteTpl = async (tpl: LabelTemplate) => {
    setTplErr(null);
    setTplMsg(null);
    try {
      await onDeleteLabelTemplate(tpl.templateId);
      if (editingTplId === tpl.templateId) resetTplForm();
      setConfirmDeleteTplId(null);
      setTplMsg(`已删除标签模板：${tpl.templateName}`);
    } catch (err) {
      setConfirmDeleteTplId(null);
      setTplErr(err instanceof Error ? err.message : '删除标签模板失败');
    }
  };

  const fallbackSampleReel: ReelItem = {
    reelId: 'RL261015-001',
    skuCode: 'MAT-IC-001',
    mpn: 'STM32F407VET6',
    lotNumber: 'ST2638A1',
    dateCode: '2638',
    supplier: '艾睿电子授权代理',
    ownershipType: 'SELF_PURCHASED',
    ownerName: '本厂自购',
    customerName: '通用共享',
    mpq: 90,
    receiptDocNo: 'RCV-20261015-01',
    initialQty: 1000,
    qty: 1000,
    issuedQty: 0,
    binCode: 'MSD-01-01',
    msdLevel: 'Level 3',
    msdState: 'SEALED',
    status: 'IN_STOCK',
    receivedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const previewReel =
    state.reels.find((r) => r.reelId === previewReelId) ?? state.reels[0] ?? fallbackSampleReel;
  const previewMaterial =
    (previewReel.materialKey
      ? state.materials.find((m) => m.materialKey === previewReel.materialKey)
      : undefined) ?? state.materials.find((m) => m.skuCode === previewReel.skuCode);

  const liveZpl = generateZplFromTemplate({
    template: draftTemplate,
    reel: previewReel,
    material: previewMaterial,
    copies: 1,
    darkness: state.printerConfig?.darkness ?? 18,
    printSpeed: state.printerConfig?.printSpeed ?? 4,
  });

  const handleCopyLiveZpl = async () => {
    try {
      await navigator.clipboard.writeText(liveZpl);
      setZplCopied(true);
      setTimeout(() => setZplCopied(false), 1800);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handleDownloadZpl = () => {
    const blob = new Blob([liveZpl], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(templateName || 'smt-label').replace(/[^a-zA-Z0-9_-]/g, '_')}.zpl`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedEl =
    elementLayouts.find((el) => el.key === selectedElementKey) ?? elementLayouts[0];
  const selectedKind = selectedEl ? resolveElementKind(selectedEl) : 'BUILTIN';
  const selectedIsBarcode = selectedEl ? isBarcodeElement(selectedEl) : false;
  const selectedIsCustom = selectedEl ? !BUILTIN_KEY_SET.has(selectedEl.key) : false;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      {/* Left: ZPL Label Template Designer */}
      <section className="rounded-lg border border-slate-200 bg-white p-5 xl:col-span-5">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              {editingTplId ? `修改 ZPL 标签模板 (${editingTplId})` : 'ZPL 斑马标签可视化设计器'}
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              支持自定义纸张/DPI、整体 X/Y 移转、新增多条码与文本、条码 HRI 文字样式与位置调整
            </p>
          </div>
          {editingTplId && (
            <button
              type="button"
              onClick={resetTplForm}
              className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50 whitespace-nowrap"
            >
              <X className="h-3 w-3" />
              取消编辑
            </button>
          )}
        </div>

        <form onSubmit={handleTemplateSubmit} className="mt-4 space-y-3.5">
          {/* Template Name + Paper Preset */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label htmlFor="tpl-name" className="block text-xs font-medium text-slate-700">
                模板名称 <span className="text-red-600">*</span>
              </label>
              <input
                id="tpl-name"
                type="text"
                required
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="例如：85×45 产线双码标"
                className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
              />
            </div>
            <div>
              <label htmlFor="tpl-size" className="block text-xs font-medium text-slate-700">
                纸张规格
              </label>
              <select
                id="tpl-size"
                value={paperSize}
                onChange={(e) => handlePaperSizeChange(e.target.value as LabelPaperPreset)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs"
              >
                <option value="50x30mm">50 × 30 mm (小盘标)</option>
                <option value="70x40mm">70 × 40 mm (标准详标)</option>
                <option value="100x60mm">100 × 60 mm (外箱大标)</option>
                <option value="CUSTOM">自定义纸张尺寸 (mm)</option>
              </select>
            </div>
          </div>

          {/* Custom Paper Dimensions (when CUSTOM selected) */}
          {paperSize === 'CUSTOM' && (
            <div className="grid grid-cols-2 gap-2.5 rounded-md border border-sky-200 bg-sky-50/50 p-2.5">
              <div>
                <label htmlFor="tpl-custom-w" className="block text-[11px] font-medium text-sky-900">
                  自定义纸宽 (20-200 mm)
                </label>
                <input
                  id="tpl-custom-w"
                  type="number"
                  step="any"
                  min={20}
                  max={200}
                  value={customWidthMm}
                  onChange={(e) =>
                    setCustomWidthMm(Math.max(20, Math.min(200, Number(e.target.value) || 20)))
                  }
                  className="mt-1 w-full rounded border border-sky-300 bg-white px-2 py-1 font-mono text-xs tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="tpl-custom-h" className="block text-[11px] font-medium text-sky-900">
                  自定义纸高 (10-200 mm)
                </label>
                <input
                  id="tpl-custom-h"
                  type="number"
                  step="any"
                  min={10}
                  max={200}
                  value={customHeightMm}
                  onChange={(e) =>
                    setCustomHeightMm(Math.max(10, Math.min(200, Number(e.target.value) || 10)))
                  }
                  className="mt-1 w-full rounded border border-sky-300 bg-white px-2 py-1 font-mono text-xs tabular-nums"
                />
              </div>
            </div>
          )}

          {/* Printhead DPI (Presets + Custom) + Font Density */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label htmlFor="tpl-dpi" className="block text-xs font-medium text-slate-700">
                打印精度 (DPI)
              </label>
              <select
                id="tpl-dpi"
                value={dpiPreset}
                onChange={(e) => {
                  const val = e.target.value as typeof dpiPreset;
                  setDpiPreset(val);
                  if (val !== 'CUSTOM') setDpi(Number(val));
                }}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs"
              >
                <option value="203">203 dpi (8 d/mm)</option>
                <option value="300">300 dpi (12 d/mm)</option>
                <option value="600">600 dpi (24 d/mm)</option>
                <option value="CUSTOM">自定义 DPI</option>
              </select>
            </div>
            {dpiPreset === 'CUSTOM' ? (
              <div>
                <label htmlFor="tpl-custom-dpi" className="block text-xs font-medium text-sky-900">
                  精度值 (150-600)
                </label>
                <input
                  id="tpl-custom-dpi"
                  type="number"
                  step={1}
                  min={150}
                  max={600}
                  value={dpi}
                  onChange={(e) => setDpi(normalizeDpi(Number(e.target.value)))}
                  className="mt-1 w-full rounded-md border border-sky-300 bg-white px-2 py-1.5 font-mono text-xs tabular-nums"
                />
              </div>
            ) : (
              <div>
                <label htmlFor="tpl-barcode-type" className="block text-xs font-medium text-slate-700">
                  主条码码制
                </label>
                <select
                  id="tpl-barcode-type"
                  value={barcodeType}
                  onChange={(e) => {
                    const nextType = e.target.value as LabelBarcodeType;
                    setBarcodeType(nextType);
                    updateLayoutField('barcode', { barcodeType: nextType });
                  }}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs"
                >
                  <option value="CODE128">Code 128 (^BC)</option>
                  <option value="CODE39">Code 39 (^B3)</option>
                  <option value="QR">QR 二维码 (^BQ)</option>
                  <option value="DATAMATRIX">DataMatrix (^BX)</option>
                </select>
              </div>
            )}
            <div>
              <label htmlFor="tpl-font-scale" className="block text-xs font-medium text-slate-700">
                基础字号密度
              </label>
              <select
                id="tpl-font-scale"
                value={fontScale}
                onChange={(e) => {
                  const nextScale = e.target.value as LabelFontScale;
                  setFontScale(nextScale);
                  const base = buildDefaultElementLayouts(
                    paperSize,
                    currentShowFields,
                    nextScale,
                    barcodeHeightMm,
                    customWidthMm,
                    customHeightMm
                  );
                  const baseByKey = new Map(base.map((b) => [b.key, b]));
                  setElementLayouts((prev) =>
                    prev.map((item) =>
                      !BUILTIN_KEY_SET.has(item.key) || item.key === 'barcode'
                        ? item
                        : { ...item, fontSizeMm: baseByKey.get(item.key)?.fontSizeMm ?? item.fontSizeMm }
                    )
                  );
                }}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
              >
                <option value="COMPACT">紧凑型</option>
                <option value="STANDARD">标准型</option>
                <option value="LARGE">大字体</option>
              </select>
            </div>
          </div>

          {/* Global X / Y Canvas Shift Bar */}
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <Move className="h-3.5 w-3.5 text-sky-700" />
                整体列印 X / Y 移转（全局偏移校准）
              </div>
              <span className="font-mono text-[10px] text-sky-800 tabular-nums">
                {shiftInfo.summary}
              </span>
            </div>

            <div className="mt-2 grid grid-cols-12 items-end gap-2">
              <div className="col-span-3">
                <label htmlFor="tpl-offset-x" className="block text-[10px] text-slate-600">
                  整体 X 移转 (mm)
                </label>
                <input
                  id="tpl-offset-x"
                  type="number"
                  step="any"
                  min={-30}
                  max={30}
                  value={offsetXMm}
                  onChange={(e) =>
                    setOffsetXMm(Math.max(-30, Math.min(30, Number(e.target.value) || 0)))
                  }
                  className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs tabular-nums"
                />
              </div>
              <div className="col-span-3">
                <label htmlFor="tpl-offset-y" className="block text-[10px] text-slate-600">
                  整体 Y 移转 (mm)
                </label>
                <input
                  id="tpl-offset-y"
                  type="number"
                  step="any"
                  min={-30}
                  max={30}
                  value={offsetYMm}
                  onChange={(e) =>
                    setOffsetYMm(Math.max(-30, Math.min(30, Number(e.target.value) || 0)))
                  }
                  className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs tabular-nums"
                />
              </div>
              <div className="col-span-6 flex flex-wrap items-center justify-end gap-1">
                <button
                  type="button"
                  title="整体左移 0.5mm"
                  aria-label="整体左移 0.5mm"
                  onClick={() => nudgeGlobalOffset(-0.5, 0)}
                  className="rounded border border-slate-300 bg-white p-1 text-slate-700 hover:bg-slate-100"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="整体右移 0.5mm"
                  aria-label="整体右移 0.5mm"
                  onClick={() => nudgeGlobalOffset(0.5, 0)}
                  className="rounded border border-slate-300 bg-white p-1 text-slate-700 hover:bg-slate-100"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="整体上移 0.5mm"
                  aria-label="整体上移 0.5mm"
                  onClick={() => nudgeGlobalOffset(0, -0.5)}
                  className="rounded border border-slate-300 bg-white p-1 text-slate-700 hover:bg-slate-100"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="整体下移 0.5mm"
                  aria-label="整体下移 0.5mm"
                  onClick={() => nudgeGlobalOffset(0, 0.5)}
                  className="rounded border border-slate-300 bg-white p-1 text-slate-700 hover:bg-slate-100"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="偏移归零"
                  aria-label="整体偏移归零"
                  onClick={() => {
                    setOffsetXMm(0);
                    setOffsetYMm(0);
                  }}
                  className="inline-flex items-center gap-0.5 rounded border border-slate-300 bg-white px-1.5 py-1 text-[10px] text-slate-600 hover:bg-slate-100"
                >
                  <RotateCcw className="h-3 w-3" />
                  归零
                </button>
                {(offsetXMm !== 0 || offsetYMm !== 0) && zplMode === 'VISUAL' && (
                  <button
                    type="button"
                    onClick={applyOffsetToAllElements}
                    className="rounded border border-sky-300 bg-sky-50 px-1.5 py-1 text-[10px] font-medium text-sky-800 hover:bg-sky-100 whitespace-nowrap"
                  >
                    固化到坐标
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Design Mode Switch */}
          <div className="grid grid-cols-2 gap-1.5 rounded-md border border-slate-200 bg-slate-50 p-1 text-xs">
            <button
              type="button"
              onClick={() => setZplMode('VISUAL')}
              className={`inline-flex items-center justify-center gap-1.5 rounded px-2.5 py-1.5 font-medium transition-colors ${
                zplMode === 'VISUAL'
                  ? 'bg-white text-sky-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              可视化画布设计
            </button>
            <button
              type="button"
              onClick={() => setZplMode('CUSTOM_ZPL')}
              className={`inline-flex items-center justify-center gap-1.5 rounded px-2.5 py-1.5 font-medium transition-colors ${
                zplMode === 'CUSTOM_ZPL'
                  ? 'bg-white text-sky-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Code2 className="h-3.5 w-3.5" />
              ZPL II 源码编辑
            </button>
          </div>

          {zplMode === 'VISUAL' ? (
            <div className="space-y-3">
              {/* Add Custom Elements Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleAddCustomElement('TEXT')}
                    className="inline-flex items-center gap-1 rounded border border-sky-300 bg-white px-2 py-1 text-[11px] font-medium text-sky-800 hover:bg-sky-50 whitespace-nowrap"
                  >
                    <Type className="h-3 w-3" />
                    + 新增文本
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddCustomElement('BARCODE')}
                    className="inline-flex items-center gap-1 rounded border border-sky-300 bg-white px-2 py-1 text-[11px] font-medium text-sky-800 hover:bg-sky-50 whitespace-nowrap"
                  >
                    <Barcode className="h-3 w-3" />
                    + 新增条码
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddCustomElement('BOX')}
                    className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                  >
                    <Minus className="h-3 w-3" />
                    + 新增线条/框
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleAutoRelayout}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                >
                  <LayoutGrid className="h-3 w-3" />
                  自动排版
                </button>
              </div>

              {/* Layer List */}
              <div className="rounded-md border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-100 px-2.5 py-1.5 text-[11px] font-medium text-slate-600">
                  <span>打印元素图层 ({elementLayouts.length} 项 · 点击选中编辑属性)</span>
                  <span className="font-mono text-[10px] text-slate-400">
                    {widthMm}×{heightMm}mm
                  </span>
                </div>
                <div className="max-h-40 divide-y divide-slate-100 overflow-y-auto">
                  {elementLayouts.map((el) => {
                    const kind = resolveElementKind(el);
                    const isSel = selectedEl?.key === el.key;
                    const isCustom = !BUILTIN_KEY_SET.has(el.key);
                    const xDot = mmToDots(el.xMm, safeDpi);
                    const yDot = mmToDots(el.yMm, safeDpi);
                    const typeTag =
                      kind === 'BARCODE' || el.key === 'barcode'
                        ? el.barcodeType ?? (el.key === 'barcode' ? barcodeType : 'CODE128')
                        : kind === 'TEXT'
                        ? '文本'
                        : kind === 'BOX'
                        ? '线框'
                        : '内置';

                    return (
                      <div
                        key={el.key}
                        className={`flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs ${
                          isSel ? 'bg-sky-50 text-sky-900' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <input
                            type="checkbox"
                            aria-label={`显示 ${getElementDisplayName(el)}`}
                            checked={el.visible}
                            onChange={(e) =>
                              updateLayoutField(el.key, { visible: e.target.checked })
                            }
                          />
                          <button
                            type="button"
                            onClick={() => setSelectedElementKey(el.key)}
                            className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                          >
                            <span className="font-mono text-[10px] text-slate-500 shrink-0">
                              [{typeTag}]
                            </span>
                            <span className="truncate font-medium">
                              {getElementDisplayName(el)}
                            </span>
                          </button>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="font-mono text-[10px] text-slate-500 tabular-nums">
                            {el.xMm},{el.yMm}mm · ^FO{xDot},{yDot}
                          </span>
                          {isCustom && (
                            <button
                              type="button"
                              aria-label={`删除元素 ${getElementDisplayName(el)}`}
                              onClick={() => handleDeleteCustomElement(el.key)}
                              className="text-slate-400 hover:text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Selected Element Inspector */}
              {selectedEl && (
                <div
                  data-testid="element-inspector"
                  className="space-y-2.5 rounded-md border border-sky-200 bg-sky-50/35 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-200/80 pb-2">
                    <div className="text-xs font-semibold text-sky-950">
                      属性编辑：{getElementDisplayName(selectedEl)}
                    </div>
                    <div className="font-mono text-[10px] text-sky-800 tabular-nums">
                      ^FO{mmToDots(selectedEl.xMm, safeDpi)},{mmToDots(selectedEl.yMm, safeDpi)}
                    </div>
                  </div>

                  {/* Custom Element Name */}
                  {selectedIsCustom && (
                    <div>
                      <label htmlFor="el-label-input" className="block text-[10px] font-medium text-slate-600">
                        元素名称
                      </label>
                      <input
                        id="el-label-input"
                        type="text"
                        value={selectedEl.label ?? ''}
                        onChange={(e) => updateLayoutField(selectedEl.key, { label: e.target.value })}
                        className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                      />
                    </div>
                  )}

                  {/* Built-in header / footer direct text shortcuts */}
                  {selectedEl.key === 'header' && (
                    <div>
                      <label htmlFor="tpl-header" className="block text-[10px] font-medium text-slate-600">
                        标签抬头文字
                      </label>
                      <input
                        id="tpl-header"
                        type="text"
                        value={headerTitle}
                        onChange={(e) => setHeaderTitle(e.target.value)}
                        className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                      />
                    </div>
                  )}
                  {selectedEl.key === 'footer' && (
                    <div>
                      <label htmlFor="tpl-footer" className="block text-[10px] font-medium text-slate-600">
                        页脚管控提示语
                      </label>
                      <input
                        id="tpl-footer"
                        type="text"
                        value={footerNote}
                        onChange={(e) => setFooterNote(e.target.value)}
                        className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                      />
                    </div>
                  )}

                  {/* Common X, Y, Size, Width, Rotation */}
                  <div className="grid grid-cols-5 gap-1.5 font-mono text-[10px]">
                    <div>
                      <label className="block text-[9px] text-slate-600">X 轴 (mm)</label>
                      <input
                        type="number"
                        step="any"
                        min={0}
                        max={widthMm - 1}
                        aria-label="当前元素 X坐标"
                        value={selectedEl.xMm}
                        onChange={(e) =>
                          updateLayoutField(selectedEl.key, {
                            xMm: Math.max(0, Math.min(widthMm - 1, Number(e.target.value) || 0)),
                          })
                        }
                        className="mt-0.5 w-full rounded border border-slate-300 bg-white px-1.5 py-1 text-[11px] tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-slate-600">Y 轴 (mm)</label>
                      <input
                        type="number"
                        step="any"
                        min={0}
                        max={heightMm - 1}
                        aria-label="当前元素 Y坐标"
                        value={selectedEl.yMm}
                        onChange={(e) =>
                          updateLayoutField(selectedEl.key, {
                            yMm: Math.max(0, Math.min(heightMm - 1, Number(e.target.value) || 0)),
                          })
                        }
                        className="mt-0.5 w-full rounded border border-slate-300 bg-white px-1.5 py-1 text-[11px] tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-slate-600">
                        {selectedIsBarcode ? '码高 (mm)' : selectedKind === 'BOX' ? '高度 (mm)' : '字高 (mm)'}
                      </label>
                      <input
                        type="number"
                        step="any"
                        min={selectedKind === 'BOX' ? 0.2 : 1.2}
                        max={selectedKind === 'BOX' ? heightMm : 36}
                        aria-label="当前元素 高度尺寸"
                        value={selectedEl.fontSizeMm}
                        onChange={(e) =>
                          updateLayoutField(selectedEl.key, {
                            fontSizeMm: Math.max(
                              selectedKind === 'BOX' ? 0.2 : 1.2,
                              Math.min(selectedKind === 'BOX' ? heightMm : 36, Number(e.target.value) || 2)
                            ),
                          })
                        }
                        className="mt-0.5 w-full rounded border border-slate-300 bg-white px-1.5 py-1 text-[11px] tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-slate-600">宽度 (mm)</label>
                      <input
                        type="number"
                        step="any"
                        min={4}
                        max={widthMm}
                        aria-label="当前元素 宽度"
                        value={selectedEl.widthMm ?? Math.max(12, widthMm - 4)}
                        onChange={(e) =>
                          updateLayoutField(selectedEl.key, {
                            widthMm: Math.max(4, Math.min(widthMm, Number(e.target.value) || 12)),
                          })
                        }
                        className="mt-0.5 w-full rounded border border-slate-300 bg-white px-1.5 py-1 text-[11px] tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-slate-600">旋转</label>
                      <select
                        aria-label="当前元素 旋转"
                        value={selectedEl.rotation ?? 'N'}
                        onChange={(e) =>
                          updateLayoutField(selectedEl.key, {
                            rotation: e.target.value as LabelElementRotation,
                          })
                        }
                        className="mt-0.5 w-full rounded border border-slate-300 bg-white px-1 py-1 text-[10px]"
                      >
                        <option value="N">0°</option>
                        <option value="R">90°</option>
                        <option value="I">180°</option>
                        <option value="B">270°</option>
                      </select>
                    </div>
                  </div>

                  {/* BOX Thickness */}
                  {selectedKind === 'BOX' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-600">线条粗细 (mm)</label>
                        <input
                          type="number"
                          step="any"
                          min={0.2}
                          max={5}
                          aria-label="线条粗细"
                          value={selectedEl.borderThicknessMm ?? 0.4}
                          onChange={(e) =>
                            updateLayoutField(selectedEl.key, {
                              borderThicknessMm: Math.max(0.2, Math.min(5, Number(e.target.value) || 0.4)),
                            })
                          }
                          className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs tabular-nums"
                        />
                      </div>
                      <div className="flex items-end text-[10px] text-slate-500">
                        提示：高度设为 0.4mm 为分隔横线，增大高度即为矩形边框
                      </div>
                    </div>
                  )}

                  {/* TEXT & Built-in Text Styling */}
                  {!selectedIsBarcode && selectedKind !== 'BOX' && (
                    <div className="space-y-2 border-t border-sky-200/70 pt-2">
                      <div>
                        <label htmlFor="el-content-tpl" className="block text-[10px] font-medium text-slate-700">
                          {selectedKind === 'TEXT'
                            ? '打印内容模板（支持静态文字 + 动态变量）'
                            : '自定义内容覆写（留空使用系统默认格式）'}
                        </label>
                        <input
                          id="el-content-tpl"
                          type="text"
                          value={selectedEl.contentTemplate ?? ''}
                          onChange={(e) =>
                            updateLayoutField(selectedEl.key, { contentTemplate: e.target.value })
                          }
                          placeholder={
                            selectedKind === 'TEXT'
                              ? '如：RoHS 无铅 · 料号:{{MPN}}'
                              : '留空使用内置字段内容，填入则覆写'
                          }
                          className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs"
                        />
                        <div className="mt-1 flex flex-wrap gap-1">
                          {QUICK_VARS.slice(0, 8).map((v) => (
                            <button
                              key={v.token}
                              type="button"
                              title={v.desc}
                              onClick={() =>
                                updateLayoutField(selectedEl.key, {
                                  contentTemplate: `${selectedEl.contentTemplate ?? ''}${v.token}`,
                                })
                              }
                              className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-[9px] text-slate-700 hover:border-sky-400 hover:text-sky-800"
                            >
                              {v.token}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-4 items-center gap-2 text-[11px]">
                        <div>
                          <label className="block text-[9px] text-slate-600">字体样式</label>
                          <select
                            aria-label="文本字体"
                            value={selectedEl.fontFamily ?? '0'}
                            onChange={(e) =>
                              updateLayoutField(selectedEl.key, {
                                fontFamily: e.target.value as LabelFontFamily,
                              })
                            }
                            className="mt-0.5 w-full rounded border border-slate-300 bg-white px-1.5 py-1 text-[11px]"
                          >
                            <option value="0">无衬线 ^A0</option>
                            <option value="D">点阵等宽 ^AD</option>
                            <option value="B">紧凑体 ^AB</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[9px] text-slate-600">水平对齐</label>
                          <select
                            aria-label="文本对齐"
                            value={selectedEl.textAlign ?? 'LEFT'}
                            onChange={(e) =>
                              updateLayoutField(selectedEl.key, {
                                textAlign: e.target.value as LabelTextAlign,
                              })
                            }
                            className="mt-0.5 w-full rounded border border-slate-300 bg-white px-1.5 py-1 text-[11px]"
                          >
                            <option value="LEFT">左对齐</option>
                            <option value="CENTER">居中</option>
                            <option value="RIGHT">右对齐</option>
                          </select>
                        </div>
                        <label className="mt-3.5 inline-flex items-center gap-1.5 text-xs text-slate-700">
                          <input
                            type="checkbox"
                            checked={Boolean(selectedEl.bold)}
                            onChange={(e) =>
                              updateLayoutField(selectedEl.key, { bold: e.target.checked })
                            }
                          />
                          加粗
                        </label>
                        <label className="mt-3.5 inline-flex items-center gap-1.5 text-xs text-slate-700">
                          <input
                            type="checkbox"
                            checked={Boolean(selectedEl.invert)}
                            onChange={(e) =>
                              updateLayoutField(selectedEl.key, { invert: e.target.checked })
                            }
                          />
                          黑底反白
                        </label>
                      </div>
                    </div>
                  )}

                  {/* BARCODE + HRI Position & Style Controls */}
                  {selectedIsBarcode && (
                    <div className="space-y-2.5 border-t border-sky-200/70 pt-2">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] font-medium text-slate-700">
                            条码码制
                          </label>
                          <select
                            aria-label="当前条码码制"
                            value={
                              selectedEl.barcodeType ??
                              (selectedEl.key === 'barcode' ? barcodeType : 'CODE128')
                            }
                            onChange={(e) =>
                              updateLayoutField(selectedEl.key, {
                                barcodeType: e.target.value as LabelBarcodeType,
                              })
                            }
                            className="mt-0.5 w-full rounded border border-slate-300 bg-white px-1.5 py-1 font-mono text-[11px]"
                          >
                            <option value="CODE128">Code 128 (^BC)</option>
                            <option value="CODE39">Code 39 (^B3)</option>
                            <option value="QR">QR 二维码 (^BQ)</option>
                            <option value="DATAMATRIX">DataMatrix (^BX)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-slate-700">
                            条码内容模板
                          </label>
                          <input
                            type="text"
                            aria-label="条码内容模板"
                            value={selectedEl.barcodeContent ?? '{{REEL_ID}}'}
                            onChange={(e) =>
                              updateLayoutField(selectedEl.key, { barcodeContent: e.target.value })
                            }
                            placeholder="{{REEL_ID}} 或 {{MPN}}"
                            className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2 py-1 font-mono text-[11px]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-slate-700">
                            窄条宽/倍率 (dots)
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={8}
                            aria-label="窄条宽倍率"
                            value={selectedEl.moduleWidthDots ?? 2}
                            onChange={(e) =>
                              updateLayoutField(selectedEl.key, {
                                moduleWidthDots: Math.max(1, Math.min(8, Number(e.target.value) || 2)),
                              })
                            }
                            className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2 py-1 font-mono text-[11px] tabular-nums"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {['{{REEL_ID}}', '{{MPN}}', '{{LOT}}', '{{DC}}', '{{QTY}}', '{{COMPOSITE}}'].map(
                          (tok) => (
                            <button
                              key={tok}
                              type="button"
                              onClick={() =>
                                updateLayoutField(selectedEl.key, { barcodeContent: tok })
                              }
                              className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-[9px] text-slate-700 hover:border-sky-400 hover:text-sky-800"
                            >
                              设为 {tok}
                            </button>
                          )
                        )}
                      </div>

                      {/* Barcode HRI Text Position & Styling Section */}
                      <div className="rounded border border-slate-200 bg-white p-2.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-slate-800">
                            条码对应文字 (HRI) 位置与样式
                          </span>
                          <select
                            aria-label="条码文字位置"
                            value={selectedEl.hriPosition ?? 'BOTTOM'}
                            onChange={(e) =>
                              updateLayoutField(selectedEl.key, {
                                hriPosition: e.target.value as BarcodeHriPosition,
                              })
                            }
                            className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-medium text-sky-900"
                          >
                            <option value="BOTTOM">条码正下方</option>
                            <option value="TOP">条码正上方</option>
                            <option value="LEFT">条码左侧</option>
                            <option value="RIGHT">条码右侧</option>
                            <option value="CUSTOM">自定义相对偏移</option>
                            <option value="NONE">隐藏不打印</option>
                          </select>
                        </div>

                        {(selectedEl.hriPosition ?? 'BOTTOM') !== 'NONE' && (
                          <>
                            <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                              <div>
                                <label className="block text-[9px] text-slate-500">HRI 字高 (mm)</label>
                                <input
                                  type="number"
                                  step="any"
                                  min={1.2}
                                  max={12}
                                  aria-label="条码文字字高"
                                  value={selectedEl.hriFontSizeMm ?? 2.0}
                                  onChange={(e) =>
                                    updateLayoutField(selectedEl.key, {
                                      hriFontSizeMm: Math.max(
                                        1.2,
                                        Math.min(12, Number(e.target.value) || 2)
                                      ),
                                    })
                                  }
                                  className="mt-0.5 w-full rounded border border-slate-300 px-1.5 py-0.5 font-mono text-[11px] tabular-nums"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] text-slate-500">HRI 字体</label>
                                <select
                                  aria-label="条码文字字体"
                                  value={selectedEl.hriFontFamily ?? '0'}
                                  onChange={(e) =>
                                    updateLayoutField(selectedEl.key, {
                                      hriFontFamily: e.target.value as LabelFontFamily,
                                    })
                                  }
                                  className="mt-0.5 w-full rounded border border-slate-300 bg-white px-1 py-0.5 text-[11px]"
                                >
                                  <option value="0">无衬线 ^A0</option>
                                  <option value="D">等宽点阵 ^AD</option>
                                  <option value="B">紧凑体 ^AB</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-[9px] text-slate-500">对齐方式</label>
                                <select
                                  aria-label="条码文字对齐"
                                  value={selectedEl.hriAlign ?? 'LEFT'}
                                  onChange={(e) =>
                                    updateLayoutField(selectedEl.key, {
                                      hriAlign: e.target.value as LabelTextAlign,
                                    })
                                  }
                                  className="mt-0.5 w-full rounded border border-slate-300 bg-white px-1 py-0.5 text-[11px]"
                                >
                                  <option value="LEFT">左对齐</option>
                                  <option value="CENTER">居中</option>
                                  <option value="RIGHT">右对齐</option>
                                </select>
                              </div>
                            </div>

                            <div className="grid grid-cols-12 items-end gap-1.5 text-[10px]">
                              <div className="col-span-3">
                                <label className="block text-[9px] text-slate-500">文字 X 微调(mm)</label>
                                <input
                                  type="number"
                                  step="any"
                                  min={-60}
                                  max={60}
                                  aria-label="条码文字 X偏移"
                                  value={selectedEl.hriOffsetXMm ?? 0}
                                  onChange={(e) =>
                                    updateLayoutField(selectedEl.key, {
                                      hriOffsetXMm: Number(e.target.value) || 0,
                                    })
                                  }
                                  className="mt-0.5 w-full rounded border border-slate-300 px-1.5 py-0.5 font-mono text-[11px] tabular-nums"
                                />
                              </div>
                              <div className="col-span-3">
                                <label className="block text-[9px] text-slate-500">文字 Y 微调(mm)</label>
                                <input
                                  type="number"
                                  step="any"
                                  min={-60}
                                  max={60}
                                  aria-label="条码文字 Y偏移"
                                  value={selectedEl.hriOffsetYMm ?? 0.5}
                                  onChange={(e) =>
                                    updateLayoutField(selectedEl.key, {
                                      hriOffsetYMm: Number(e.target.value) || 0,
                                    })
                                  }
                                  className="mt-0.5 w-full rounded border border-slate-300 px-1.5 py-0.5 font-mono text-[11px] tabular-nums"
                                />
                              </div>
                              <div className="col-span-6 flex items-center justify-end gap-3 pb-1 text-[11px]">
                                <label className="inline-flex items-center gap-1 text-slate-700">
                                  <input
                                    type="checkbox"
                                    aria-label="条码文字加粗"
                                    checked={selectedEl.hriBold ?? true}
                                    onChange={(e) =>
                                      updateLayoutField(selectedEl.key, { hriBold: e.target.checked })
                                    }
                                  />
                                  加粗
                                </label>
                                <label className="inline-flex items-center gap-1 text-slate-700">
                                  <input
                                    type="checkbox"
                                    aria-label="条码文字黑底反白"
                                    checked={Boolean(selectedEl.hriInvert)}
                                    onChange={(e) =>
                                      updateLayoutField(selectedEl.key, { hriInvert: e.target.checked })
                                    }
                                  />
                                  黑底反白
                                </label>
                              </div>
                            </div>

                            <div>
                              <label className="block text-[9px] text-slate-500">
                                自定义 HRI 显示格式（留空默认同条码内容，如 UID:{'{{REEL_ID}}'}）
                              </label>
                              <input
                                type="text"
                                aria-label="条码文字内容模板"
                                value={selectedEl.hriTextTemplate ?? ''}
                                onChange={(e) =>
                                  updateLayoutField(selectedEl.key, {
                                    hriTextTemplate: e.target.value,
                                  })
                                }
                                placeholder="留空自动显示条码值"
                                className="mt-0.5 w-full rounded border border-slate-300 px-2 py-0.5 font-mono text-[11px]"
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-800">
                  ZPL II 指令模板（支持 {'{{变量}}'} 占位符）
                </span>
                <button
                  type="button"
                  onClick={buildSkeletonZplFromVisual}
                  className="rounded border border-sky-300 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800 hover:bg-sky-100 whitespace-nowrap"
                >
                  从可视化生成 ZPL 骨架
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {QUICK_VARS.map((p) => (
                  <button
                    key={p.token}
                    type="button"
                    title={p.desc}
                    onClick={() =>
                      setCustomZpl((prev) => `${prev}${prev.endsWith('\n') || !prev ? '' : ' '}${p.token}`)
                    }
                    className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-700 hover:border-sky-400 hover:text-sky-800"
                  >
                    {p.token}
                  </button>
                ))}
              </div>
              <textarea
                id="tpl-custom-zpl"
                rows={8}
                value={customZpl}
                onChange={(e) => setCustomZpl(e.target.value)}
                placeholder="^XA&#10;^CI28&#10;^FO20,20^A0N,28,24^FDMPN:{{MPN}}^FS&#10;^FO20,60^BQN,2,4^FDQA,{{COMPOSITE}}^FS&#10;^XZ"
                className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 font-mono text-[11px] text-slate-900"
              />
            </div>
          )}

          <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-sky-800">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
            />
            保存后设为全厂默认打印模板
          </label>

          {tplErr && (
            <div role="alert" className="rounded border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
              {tplErr}
            </div>
          )}
          {tplMsg && (
            <div className="rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-800">
              {tplMsg}
            </div>
          )}

          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-1 rounded-md bg-sky-700 px-4 py-2 text-xs font-medium text-white hover:bg-sky-800 whitespace-nowrap"
          >
            {editingTplId ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {editingTplId ? '保存 ZPL 模板修改' : '保存 ZPL 标签模板'}
          </button>
        </form>
      </section>

      {/* Right: Live WYSIWYG Preview + ZPL Code Output + Template Library */}
      <div className="space-y-6 xl:col-span-7">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                所见即所得预览台 & ZPL II 实时编译输出
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-500">
                画布实时反映自定义纸张、DPI 点阵、整体 X/Y 移转、多条码及 HRI 文字样式与位置
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="preview-reel-select" className="text-[11px] text-slate-500 whitespace-nowrap">
                测试料盘
              </label>
              <select
                id="preview-reel-select"
                value={previewReel.reelId}
                onChange={(e) => setPreviewReelId(e.target.value)}
                className="rounded border border-slate-300 bg-white px-2 py-1 font-mono text-[11px]"
              >
                {state.reels.slice(0, 12).map((r) => (
                  <option key={r.reelId} value={r.reelId}>
                    {r.reelId} ({r.mpn})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 rounded-md border border-dashed border-slate-300 bg-slate-50 p-4">
            <ThermalLabelPreview
              template={draftTemplate}
              reel={previewReel}
              material={previewMaterial}
              interactive={zplMode === 'VISUAL'}
              selectedKey={selectedElementKey}
              onSelectKey={setSelectedElementKey}
              onMoveElement={(key, xMm, yMm) => updateLayoutField(key, { xMm, yMm })}
            />
          </div>

          <div className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setShowZplCode((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 hover:text-sky-700"
              >
                <Code2 className="h-3.5 w-3.5 text-sky-700" />
                ZPL II 编译指令流 ({liveZpl.split('\n').length} 行)
              </button>
              <div className="inline-flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyLiveZpl}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  {zplCopied ? (
                    <Check className="h-3 w-3 text-emerald-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {zplCopied ? '已复制 ZPL' : '复制 ZPL'}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadZpl}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  <Download className="h-3 w-3" />
                  下载 .zpl
                </button>
              </div>
            </div>

            {showZplCode && (
              <pre
                data-testid="live-zpl-code"
                className="mt-2 max-h-56 overflow-auto rounded-md border border-slate-800 bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-emerald-300"
              >
                {liveZpl}
              </pre>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">
              标签模板档案库 ({state.labelTemplates.length} 套)
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {state.labelTemplates.map((tpl) => {
              const isConfirming = confirmDeleteTplId === tpl.templateId;
              const dimLabel = formatPaperSizeLabel(tpl);
              const layoutsCount = tpl.elementLayouts?.length ?? 9;
              const customCount = (tpl.elementLayouts ?? []).filter(
                (l) => !BUILTIN_KEY_SET.has(l.key)
              ).length;
              const bcCount = (tpl.elementLayouts ?? []).filter(
                (l) => l.visible && isBarcodeElement(l)
              ).length;

              return (
                <div
                  key={tpl.templateId}
                  className={`px-5 py-4 text-xs ${
                    editingTplId === tpl.templateId ? 'bg-sky-50/40' : ''
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">{tpl.templateName}</span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {dimLabel} · {normalizeDpi(tpl.dpi)}dpi · {bcCount || 1}个条码
                        {tpl.offsetXMm || tpl.offsetYMm
                          ? ` · 偏移(${tpl.offsetXMm ?? 0},${tpl.offsetYMm ?? 0})mm`
                          : ''}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {tpl.zplMode === 'CUSTOM_ZPL'
                          ? '自定义ZPL'
                          : customCount > 0
                          ? `含 ${customCount} 项自定义内容`
                          : `可视化 (${layoutsCount}层)`}
                      </span>
                      {tpl.isDefault && (
                        <span className="font-mono text-[11px] font-semibold text-emerald-700">
                          [默认启用]
                        </span>
                      )}
                    </div>
                    <div className="inline-flex items-center gap-2.5 whitespace-nowrap">
                      {!tpl.isDefault && (
                        <button
                          type="button"
                          onClick={() => handleSetDefaultTpl(tpl)}
                          className="font-medium text-emerald-700 hover:underline"
                        >
                          设为默认
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => startEditTpl(tpl)}
                        className="inline-flex items-center gap-1 font-medium text-sky-700 hover:text-sky-900"
                      >
                        <Pencil className="h-3 w-3" />
                        编辑/设计
                      </button>
                      {isConfirming ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleConfirmDeleteTpl(tpl)}
                            className="rounded bg-red-600 px-2 py-0.5 text-[11px] font-medium text-white"
                          >
                            确认?
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteTplId(null)}
                            className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-600"
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteTplId(tpl.templateId)}
                          aria-label={`删除模板 ${tpl.templateId}`}
                          className="inline-flex items-center gap-0.5 text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          删除
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-1 text-slate-600">
                    抬头：{tpl.headerTitle} · 页脚：{tpl.footerNote}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
