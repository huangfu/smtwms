import {
  ArrowDown,
  ArrowUp,
  Check,
  Code2,
  Copy,
  Download,
  Eye,
  Pencil,
  Plus,
  ScanBarcode,
  Trash2,
  X,
} from 'lucide-react';
import { useState } from 'react';
import type {
  BarcodeRule,
  LabelBarcodeType,
  LabelElementKey,
  LabelFontScale,
  LabelTemplate,
  ReelItem,
  WmsState,
} from '../types/wms';
import { parseBarcodeString } from '../utils/wmsLogic';
import {
  DEFAULT_ELEMENT_ORDER,
  generateZplFromTemplate,
  LABEL_ELEMENT_META,
  normalizeElementOrder,
  ZPL_PLACEHOLDERS,
} from '../utils/zplEngine';
import { ThermalLabelPreview } from './ThermalLabelPreview';

interface BarcodeTemplatePanelProps {
  state: WmsState;
  onSaveBarcodeRule: (
    rule: Omit<BarcodeRule, 'ruleId' | 'supplierName'> & {
      ruleId?: string;
      supplierName?: string;
    }
  ) => Promise<void>;
  onDeleteBarcodeRule: (ruleId: string) => Promise<void>;
  onSaveLabelTemplate: (
    tpl: Omit<LabelTemplate, 'templateId'> & { templateId?: string }
  ) => Promise<void>;
  onDeleteLabelTemplate: (templateId: string) => Promise<void>;
}

export function BarcodeTemplatePanel({
  state,
  onSaveBarcodeRule,
  onDeleteBarcodeRule,
  onSaveLabelTemplate,
  onDeleteLabelTemplate,
}: BarcodeTemplatePanelProps) {
  // Barcode Rule form
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [confirmDeleteRuleId, setConfirmDeleteRuleId] = useState<string | null>(null);
  const [ruleName, setRuleName] = useState('');
  const [supplierCode, setSupplierCode] = useState(state.suppliers[0]?.supplierCode ?? 'ALL');
  const [formatType, setFormatType] = useState<'KEY_VALUE' | 'DELIMITED_ORDER'>('DELIMITED_ORDER');
  const [delimiter, setDelimiter] = useState<'|' | ';' | ','>(';');
  const [mpnKey, setMpnKey] = useState('0');
  const [lotKey, setLotKey] = useState('1');
  const [dateCodeKey, setDateCodeKey] = useState('2');
  const [qtyKey, setQtyKey] = useState('3');
  const [reelIdKey, setReelIdKey] = useState('4');
  const [sampleBarcode, setSampleBarcode] = useState(
    'STM32F407VET6;ST2646A9;2646;1000;RL-TEST-01'
  );
  const [ruleEnabled, setRuleEnabled] = useState(true);
  const [ruleMsg, setRuleMsg] = useState<string | null>(null);
  const [ruleErr, setRuleErr] = useState<string | null>(null);

  // Live barcode parser tester
  const [testSupplier, setTestSupplier] = useState('ALL');
  const [testInput, setTestInput] = useState(
    state.barcodeRules[1]?.sampleBarcode ??
      'STM32F407VET6;ST2646A9;2646;1000;RL-ARROW-088'
  );

  // Label Template ZPL Designer form
  const [editingTplId, setEditingTplId] = useState<string | null>(null);
  const [confirmDeleteTplId, setConfirmDeleteTplId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [paperSize, setPaperSize] = useState<'50x30mm' | '70x40mm' | '100x60mm'>('70x40mm');
  const [dpi, setDpi] = useState<203 | 300>(203);
  const [barcodeType, setBarcodeType] = useState<LabelBarcodeType>('CODE128');
  const [zplMode, setZplMode] = useState<'VISUAL' | 'CUSTOM_ZPL'>('VISUAL');
  const [fontScale, setFontScale] = useState<LabelFontScale>('STANDARD');
  const [barcodeHeightMm, setBarcodeHeightMm] = useState(9);
  const [elementOrder, setElementOrder] = useState<LabelElementKey[]>(DEFAULT_ELEMENT_ORDER);
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

  // Live preview reel & ZPL view state
  const [previewReelId, setPreviewReelId] = useState<string>(state.reels[0]?.reelId ?? '');
  const [zplCopied, setZplCopied] = useState(false);
  const [showZplCode, setShowZplCode] = useState(true);

  const resetRuleForm = () => {
    setEditingRuleId(null);
    setRuleName('');
    setSupplierCode(state.suppliers[0]?.supplierCode ?? 'ALL');
    setFormatType('DELIMITED_ORDER');
    setDelimiter(';');
    setMpnKey('0');
    setLotKey('1');
    setDateCodeKey('2');
    setQtyKey('3');
    setReelIdKey('4');
    setSampleBarcode('STM32F407VET6;ST2646A9;2646;1000;RL-TEST-01');
    setRuleEnabled(true);
  };

  const startEditRule = (rule: BarcodeRule) => {
    setEditingRuleId(rule.ruleId);
    setRuleName(rule.ruleName);
    setSupplierCode(rule.supplierCode);
    setFormatType(rule.formatType);
    setDelimiter(rule.delimiter);
    setMpnKey(rule.fieldMap.mpnKey ?? '');
    setLotKey(rule.fieldMap.lotKey ?? '');
    setDateCodeKey(rule.fieldMap.dateCodeKey ?? '');
    setQtyKey(rule.fieldMap.qtyKey ?? '');
    setReelIdKey(rule.fieldMap.reelIdKey ?? '');
    setSampleBarcode(rule.sampleBarcode);
    setRuleEnabled(rule.enabled);
    setRuleErr(null);
    setRuleMsg(null);
  };

  const handleRuleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRuleErr(null);
    setRuleMsg(null);
    try {
      await onSaveBarcodeRule({
        ruleId: editingRuleId ?? undefined,
        ruleName,
        supplierCode,
        formatType,
        delimiter,
        fieldMap: {
          mpnKey,
          lotKey,
          dateCodeKey,
          qtyKey,
          reelIdKey,
        },
        sampleBarcode,
        enabled: ruleEnabled,
      });
      setRuleMsg(
        editingRuleId ? `已更新条码规则：${ruleName}` : `已保存条码解析规则：${ruleName}`
      );
      resetRuleForm();
    } catch (err) {
      setRuleErr(err instanceof Error ? err.message : '保存条码规则失败');
    }
  };

  const handleToggleRuleEnabled = async (rule: BarcodeRule) => {
    setRuleErr(null);
    setRuleMsg(null);
    try {
      await onSaveBarcodeRule({
        ...rule,
        enabled: !rule.enabled,
      });
      setRuleMsg(`规则「${rule.ruleName}」已${rule.enabled ? '停用' : '启用'}`);
    } catch (err) {
      setRuleErr(err instanceof Error ? err.message : '切换规则状态失败');
    }
  };

  const handleConfirmDeleteRule = async (rule: BarcodeRule) => {
    setRuleErr(null);
    setRuleMsg(null);
    try {
      await onDeleteBarcodeRule(rule.ruleId);
      if (editingRuleId === rule.ruleId) resetRuleForm();
      setConfirmDeleteRuleId(null);
      setRuleMsg(`已删除条码规则：${rule.ruleName}`);
    } catch (err) {
      setConfirmDeleteRuleId(null);
      setRuleErr(err instanceof Error ? err.message : '删除条码规则失败');
    }
  };

  const resetTplForm = () => {
    setEditingTplId(null);
    setTemplateName('');
    setPaperSize('70x40mm');
    setDpi(203);
    setBarcodeType('CODE128');
    setZplMode('VISUAL');
    setFontScale('STANDARD');
    setBarcodeHeightMm(9);
    setElementOrder(DEFAULT_ELEMENT_ORDER);
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
    setDpi(tpl.dpi === 300 ? 300 : 203);
    setBarcodeType(tpl.barcodeType ?? 'CODE128');
    setZplMode(tpl.zplMode ?? 'VISUAL');
    setFontScale(tpl.fontScale ?? 'STANDARD');
    setBarcodeHeightMm(tpl.barcodeHeightMm ?? 8);
    setElementOrder(normalizeElementOrder(tpl.elementOrder));
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

  const draftTemplate: LabelTemplate = {
    templateId: editingTplId ?? 'PREVIEW-DRAFT',
    templateName: templateName.trim() || '当前设计预览模板',
    paperSize,
    dpi,
    barcodeType,
    zplMode,
    fontScale,
    barcodeHeightMm,
    elementOrder,
    customZpl,
    headerTitle,
    footerNote,
    showFields: {
      mpn: true,
      skuCode: showSkuCode,
      ownership: showOwnership,
      packagingMpq: showPackagingMpq,
      supplier: showSupplier,
      lotDateCode: showLotDateCode,
      binMsd: showBinMsd,
      compositeBarcode: showComposite,
    },
    isDefault,
  };

  const moveElementOrder = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= elementOrder.length) return;
    const next = [...elementOrder];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    setElementOrder(next);
  };

  const toggleShowField = (field: keyof LabelTemplate['showFields']) => {
    if (field === 'skuCode') setShowSkuCode((v) => !v);
    else if (field === 'lotDateCode') setShowLotDateCode((v) => !v);
    else if (field === 'binMsd') setShowBinMsd((v) => !v);
    else if (field === 'ownership') setShowOwnership((v) => !v);
    else if (field === 'packagingMpq') setShowPackagingMpq((v) => !v);
    else if (field === 'supplier') setShowSupplier((v) => !v);
    else if (field === 'compositeBarcode') setShowComposite((v) => !v);
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
    }).replaceAll('QTY:1000 PCS', 'QTY:{{QTY}} {{UNIT}}')
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
        dpi,
        barcodeType,
        zplMode,
        fontScale,
        barcodeHeightMm,
        elementOrder,
        customZpl,
        headerTitle,
        footerNote,
        showFields: {
          mpn: true,
          skuCode: showSkuCode,
          ownership: showOwnership,
          packagingMpq: showPackagingMpq,
          supplier: showSupplier,
          lotDateCode: showLotDateCode,
          binMsd: showBinMsd,
          compositeBarcode: showComposite,
        },
        isDefault,
      });
      setTplMsg(
        editingTplId ? `已更新 ZPL 标签模板：${templateName}` : `已保存 ZPL 标签模板：${templateName}`
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

  const parsedPreview = parseBarcodeString(
    testInput,
    state.barcodeRules,
    testSupplier === 'ALL' ? undefined : testSupplier
  );

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

  return (
    <div className="space-y-6">
      {/* Section 1: Supplier Barcode Rules */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <section className="rounded-lg border border-slate-200 bg-white p-5 xl:col-span-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                {editingRuleId ? `修改条码规则 (${editingRuleId})` : '新建供应商条码解析规则'}
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-500">
                适配原厂键值复合码 (如 PN:/LN:/QTY:) 或定序分隔符码 (如 MPN;LOT;DC;QTY)
              </p>
            </div>
            {editingRuleId && (
              <button
                type="button"
                onClick={resetRuleForm}
                className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
              >
                <X className="h-3 w-3" />
                取消
              </button>
            )}
          </div>

          <form onSubmit={handleRuleSubmit} className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="br-name" className="block text-xs font-medium text-slate-700">
                  规则名称 <span className="text-red-600">*</span>
                </label>
                <input
                  id="br-name"
                  type="text"
                  required
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="文晔(WT) 竖线四段码"
                  className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
                />
              </div>
              <div>
                <label htmlFor="br-sup" className="block text-xs font-medium text-slate-700">
                  绑定供应商
                </label>
                <select
                  id="br-sup"
                  value={supplierCode}
                  onChange={(e) => setSupplierCode(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  <option value="ALL">全部供应商 (通用兜底)</option>
                  {state.suppliers.map((s) => (
                    <option key={s.supplierCode} value={s.supplierCode}>
                      {s.supplierName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="br-fmt" className="block text-xs font-medium text-slate-700">
                  编码解析模式
                </label>
                <select
                  id="br-fmt"
                  value={formatType}
                  onChange={(e) => {
                    const nextFmt = e.target.value as typeof formatType;
                    setFormatType(nextFmt);
                    if (nextFmt === 'KEY_VALUE') {
                      setMpnKey('P,PN');
                      setLotKey('L,LOT');
                      setDateCodeKey('D,DC');
                      setQtyKey('Q,QTY');
                      setReelIdKey('UID,ID');
                    } else {
                      setMpnKey('0');
                      setLotKey('1');
                      setDateCodeKey('2');
                      setQtyKey('3');
                      setReelIdKey('4');
                    }
                  }}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  <option value="DELIMITED_ORDER">定序分隔分段 (按段位0/1/2/3)</option>
                  <option value="KEY_VALUE">前缀键值匹配 (如 PN: / LN:)</option>
                </select>
              </div>
              <div>
                <label htmlFor="br-delim" className="block text-xs font-medium text-slate-700">
                  字段分隔符
                </label>
                <select
                  id="br-delim"
                  value={delimiter}
                  onChange={(e) => setDelimiter(e.target.value as typeof delimiter)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs"
                >
                  <option value=";">分号 (;)</option>
                  <option value="|">竖线 (|)</option>
                  <option value=",">逗号 (,)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-2">
              <div>
                <label className="block text-[10px] text-slate-500">MPN</label>
                <input
                  type="text"
                  value={mpnKey}
                  onChange={(e) => setMpnKey(e.target.value)}
                  className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500">Lot批次</label>
                <input
                  type="text"
                  value={lotKey}
                  onChange={(e) => setLotKey(e.target.value)}
                  className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500">DateCode</label>
                <input
                  type="text"
                  value={dateCodeKey}
                  onChange={(e) => setDateCodeKey(e.target.value)}
                  className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500">数量Qty</label>
                <input
                  type="text"
                  value={qtyKey}
                  onChange={(e) => setQtyKey(e.target.value)}
                  className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500">UID序号</label>
                <input
                  type="text"
                  value={reelIdKey}
                  onChange={(e) => setReelIdKey(e.target.value)}
                  className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 font-mono text-xs"
                />
              </div>
            </div>

            <div>
              <label htmlFor="br-sample" className="block text-xs font-medium text-slate-700">
                供应商样例条码
              </label>
              <input
                id="br-sample"
                type="text"
                value={sampleBarcode}
                onChange={(e) => setSampleBarcode(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-xs"
              />
            </div>

            {ruleErr && (
              <div role="alert" className="rounded border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
                {ruleErr}
              </div>
            )}
            {ruleMsg && (
              <div className="rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-800">
                {ruleMsg}
              </div>
            )}

            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-1 rounded-md bg-sky-700 px-4 py-2 text-xs font-medium text-white hover:bg-sky-800 whitespace-nowrap"
            >
              {editingRuleId ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {editingRuleId ? '保存条码规则修改' : '保存供应商条码规则'}
            </button>
          </form>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white xl:col-span-7">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">
              已配置供应商条码解析规则 ({state.barcodeRules.length} 条) & 在线解码测试
            </h2>
          </div>

          <div className="border-b border-slate-200 bg-slate-50 p-4 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <ScanBarcode className="h-4 w-4 text-sky-700" />
                实时条码规则解析测试台
              </div>
              <select
                aria-label="测试模拟供应商"
                value={testSupplier}
                onChange={(e) => setTestSupplier(e.target.value)}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
              >
                <option value="ALL">自动匹配全部规则</option>
                {state.suppliers.map((s) => (
                  <option key={s.supplierCode} value={s.supplierCode}>
                    模拟：{s.supplierName}
                  </option>
                ))}
              </select>
            </div>
            <input
              type="text"
              aria-label="测试条码字符串"
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              className="w-full rounded border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs text-slate-900"
            />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 rounded border border-slate-200 bg-white p-2.5 font-mono text-[11px]">
              <div>
                <span className="text-slate-400">命中规则: </span>
                <span className="font-semibold text-sky-700">
                  {parsedPreview.matchedRuleName || 'IPC-1782默认'}
                </span>
              </div>
              <div>
                <span className="text-slate-400">MPN: </span>
                <span className="font-semibold text-slate-900">{parsedPreview.mpn || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400">Lot: </span>
                <span className="font-semibold text-slate-900">
                  {parsedPreview.lotNumber || '-'}
                </span>
              </div>
              <div>
                <span className="text-slate-400">D/C: </span>
                <span className="font-semibold text-slate-900">
                  {parsedPreview.dateCode || '-'}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Qty: </span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  {parsedPreview.qty?.toLocaleString() || '-'}
                </span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium whitespace-nowrap">规则名称 / 供应商</th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">模式 / 状态</th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">样例串</th>
                  <th className="px-4 py-2 font-medium text-right whitespace-nowrap">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.barcodeRules.map((rule) => {
                  const isConfirming = confirmDeleteRuleId === rule.ruleId;
                  return (
                    <tr
                      key={rule.ruleId}
                      className={`hover:bg-slate-50 ${
                        editingRuleId === rule.ruleId ? 'bg-sky-50/40' : ''
                      }`}
                    >
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-slate-900">{rule.ruleName}</div>
                        <div className="font-mono text-[11px] text-slate-500">
                          {rule.ruleId} · {rule.supplierName}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="font-mono text-slate-700">
                          {rule.formatType === 'DELIMITED_ORDER' ? '定序分段' : '前缀键值'} (
                          {rule.delimiter})
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleRuleEnabled(rule)}
                          className={`text-[11px] font-medium ${
                            rule.enabled ? 'text-emerald-700' : 'text-slate-400'
                          }`}
                        >
                          {rule.enabled ? '● 启用中 (点击停用)' : '○ 已停用 (点击启用)'}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500 max-w-[180px] truncate">
                        {rule.sampleBarcode}
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        {isConfirming ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleConfirmDeleteRule(rule)}
                              className="rounded bg-red-600 px-2 py-0.5 text-[11px] font-medium text-white"
                            >
                              确认?
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteRuleId(null)}
                              className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-600"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => {
                                setTestSupplier(rule.supplierCode);
                                setTestInput(rule.sampleBarcode);
                              }}
                              className="font-medium text-slate-600 hover:text-sky-700"
                            >
                              测试
                            </button>
                            <button
                              type="button"
                              onClick={() => startEditRule(rule)}
                              className="font-medium text-sky-700 hover:text-sky-900"
                            >
                              编辑
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteRuleId(rule.ruleId)}
                              aria-label={`删除规则 ${rule.ruleId}`}
                              className="text-slate-400 hover:text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Section 2: ZPL Label Designer & Live Preview */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left: ZPL Label Template Designer */}
        <section className="rounded-lg border border-slate-200 bg-white p-5 xl:col-span-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                {editingTplId ? `修改 ZPL 标签模板 (${editingTplId})` : 'ZPL 斑马标签模板设计器'}
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-500">
                支持可视化积木拖拽/排序设计或直接编写 ZPL II 指令源码，右侧实时渲染预览
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

          <form onSubmit={handleTemplateSubmit} className="mt-4 space-y-3">
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
                  placeholder="产线防错加急标"
                  className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
                />
              </div>
              <div>
                <label htmlFor="tpl-size" className="block text-xs font-medium text-slate-700">
                  纸张尺寸
                </label>
                <select
                  id="tpl-size"
                  value={paperSize}
                  onChange={(e) => setPaperSize(e.target.value as typeof paperSize)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs"
                >
                  <option value="50x30mm">50 × 30 mm (小盘标)</option>
                  <option value="70x40mm">70 × 40 mm (标准详标)</option>
                  <option value="100x60mm">100 × 60 mm (外箱大标)</option>
                </select>
              </div>
            </div>

            {/* Printhead & Barcode Specs */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label htmlFor="tpl-dpi" className="block text-xs font-medium text-slate-700">
                  打印头精度
                </label>
                <select
                  id="tpl-dpi"
                  value={dpi}
                  onChange={(e) => setDpi(Number(e.target.value) === 300 ? 300 : 203)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs"
                >
                  <option value={203}>203 dpi (8 dot/mm)</option>
                  <option value={300}>300 dpi (12 dot/mm)</option>
                </select>
              </div>
              <div>
                <label htmlFor="tpl-barcode-type" className="block text-xs font-medium text-slate-700">
                  条码码制
                </label>
                <select
                  id="tpl-barcode-type"
                  value={barcodeType}
                  onChange={(e) => setBarcodeType(e.target.value as LabelBarcodeType)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs"
                >
                  <option value="CODE128">Code 128 (^BCN)</option>
                  <option value="QR">QR 二维码 (^BQN)</option>
                  <option value="DATAMATRIX">DataMatrix (^BXN)</option>
                </select>
              </div>
              <div>
                <label htmlFor="tpl-font-scale" className="block text-xs font-medium text-slate-700">
                  字号密度
                </label>
                <select
                  id="tpl-font-scale"
                  value={fontScale}
                  onChange={(e) => setFontScale(e.target.value as LabelFontScale)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
                >
                  <option value="COMPACT">紧凑型</option>
                  <option value="STANDARD">标准型</option>
                  <option value="LARGE">大字体</option>
                </select>
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
                可视化积木设计
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

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="tpl-header" className="block text-xs font-medium text-slate-700">
                  标签抬头文字
                </label>
                <input
                  id="tpl-header"
                  type="text"
                  value={headerTitle}
                  onChange={(e) => setHeaderTitle(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
                />
              </div>
              <div>
                <label htmlFor="tpl-bar-h" className="block text-xs font-medium text-slate-700">
                  条码高度 ({barcodeHeightMm} mm)
                </label>
                <input
                  id="tpl-bar-h"
                  type="range"
                  min={5}
                  max={20}
                  step={1}
                  value={barcodeHeightMm}
                  onChange={(e) => setBarcodeHeightMm(Number(e.target.value))}
                  className="mt-2.5 w-full accent-sky-700"
                />
              </div>
            </div>

            <div>
              <label htmlFor="tpl-footer" className="block text-xs font-medium text-slate-700">
                页脚管控提示语
              </label>
              <input
                id="tpl-footer"
                type="text"
                value={footerNote}
                onChange={(e) => setFooterNote(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
              />
            </div>

            {zplMode === 'VISUAL' ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800">
                    排版积木顺序与字段显隐
                  </span>
                  <button
                    type="button"
                    onClick={() => setElementOrder(DEFAULT_ELEMENT_ORDER)}
                    className="text-[11px] font-medium text-sky-700 hover:underline"
                  >
                    恢复默认顺序
                  </button>
                </div>
                <div className="mt-2 divide-y divide-slate-200 rounded border border-slate-200 bg-white">
                  {elementOrder.map((key, idx) => {
                    const meta = LABEL_ELEMENT_META[key];
                    const toggleField = meta.toggleField;
                    const checked = toggleField ? draftTemplate.showFields[toggleField] : true;
                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs"
                      >
                        <label className="flex min-w-0 flex-1 items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!toggleField}
                            onChange={() => toggleField && toggleShowField(toggleField)}
                          />
                          <span className="truncate font-medium text-slate-800">
                            {meta.label}
                          </span>
                        </label>
                        <div className="inline-flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveElementOrder(idx, -1)}
                            aria-label={`上移 ${meta.label}`}
                            className="rounded border border-slate-200 p-0.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                          >
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === elementOrder.length - 1}
                            onClick={() => moveElementOrder(idx, 1)}
                            aria-label={`下移 ${meta.label}`}
                            className="rounded border border-slate-200 p-0.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                          >
                            <ArrowDown className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
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
                  {ZPL_PLACEHOLDERS.slice(0, 12).map((p) => (
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
                  选择仓库真实料盘数据进行动态打样验证，调整左侧尺寸、DPI、码制或积木顺序即时生效
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
                <pre className="mt-2 max-h-56 overflow-auto rounded-md border border-slate-800 bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-emerald-300">
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
                          {tpl.paperSize} · {tpl.dpi ?? 203}dpi · {tpl.barcodeType ?? 'CODE128'}
                        </span>
                        <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                          {tpl.zplMode === 'CUSTOM_ZPL' ? '自定义ZPL' : '可视化排版'}
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
                    <div className="mt-1 font-mono text-[11px] text-slate-500">
                      展示字段：MPN / UID / Lot+DC / 库位+MSD
                      {tpl.showFields.ownership ? ' / 产权归属' : ''}
                      {tpl.showFields.packagingMpq ? ' / 包装MPQ' : ''}
                      {tpl.showFields.supplier ? ' / 供应商' : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
