import { Barcode } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type {
  AsnLine,
  AsnOrder,
  AsnWorkflowStage,
  ReelItem,
  ScanTabBucket,
  WmsState,
} from '../types/wms';
import { formatTime } from '../utils/formatters';
import { completePdaScan, focusScanInputOnMount, scheduleScanInputFocus } from '../utils/pdaScanFocus';
import { parseBarcodeString } from '../utils/wmsLogic';
import { AsnManagerPanel } from './AsnManagerPanel';
import { AsnPdaReceivingWorkbench } from './AsnPdaReceivingWorkbench';
import { PdaScanField } from './PdaScanField';
import type { NavKey } from './Sidebar';

export type InboundPageMode =
  | 'asnArrival'
  | 'asnReceive'
  | 'asnIqc'
  | 'asnPutaway'
  | 'asnPlan'
  | 'quickInbound';

interface InboundViewProps {
  pageMode: InboundPageMode;
  state: WmsState;
  selectedAsnNo: string;
  onSelectAsnNo: (asnNo: string) => void;
  transitionNotice?: string | null;
  onClearTransitionNotice?: () => void;
  onAdvanceStagePage: (nextNav: NavKey, asnNo: string, notice: string) => void;
  onNavigate: (nav: NavKey) => void;
  onInbound: (payload: {
    materialKey?: string;
    skuCode: string;
    lotNumber: string;
    dateCode: string;
    supplier: string;
    qty: number;
    binCode: string;
    receiptDocNo?: string;
    asnNo?: string;
    asnLineId?: string;
    reelId?: string;
    operator: string;
    reason?: string;
  }) => Promise<ReelItem>;
  onCreateAsn: (payload: {
    poNo: string;
    supplierCode: string;
    warehouseCode: string;
    expectedDate: string;
    purchaser: string;
    notes?: string;
    lines: {
      skuCode: string;
      expectedQty: number;
      lotNumber?: string;
      dateCode?: string;
      targetBin?: string;
    }[];
  }) => Promise<AsnOrder>;
  onImportAsnCsv: (payload: {
    csvText: string;
    warehouseCode?: string;
    purchaser?: string;
    notes?: string;
  }) => Promise<AsnOrder>;
  onCancelAsn: (asnNo: string) => Promise<void>;
  onArriveAsn: (
    asnNo: string,
    payload: { deliveryNoteNo?: string; carrierName?: string; operator?: string }
  ) => Promise<{ asn: AsnOrder; stageAdvancedTo: AsnWorkflowStage }>;
  onScanAsnReceive: (
    asnNo: string,
    payload: {
      rawBarcode?: string;
      manualSkuOrMpn?: string;
      lineId?: string;
      qty?: number;
      lotNumber?: string;
      dateCode?: string;
      targetBin?: string;
      operator: string;
    }
  ) => Promise<{
    asn: AsnOrder;
    matchedLine: AsnLine;
    addedQty: number;
    lineBucket: ScanTabBucket;
    stageAdvancedTo?: AsnWorkflowStage;
  }>;
  onInspectAsnIqc: (
    asnNo: string,
    payload: {
      lineId?: string;
      rawBarcode?: string;
      manualSkuOrMpn?: string;
      result?: 'PASSED' | 'FAILED';
      qty?: number;
      passedQty?: number;
      rejectedQty?: number;
      note?: string;
      operator: string;
    }
  ) => Promise<{
    asn: AsnOrder;
    matchedLine: AsnLine;
    passedAdded: number;
    rejectedAdded: number;
    lineBucket: ScanTabBucket;
    stageAdvancedTo?: AsnWorkflowStage;
  }>;
  onPutawayAsnLine: (
    asnNo: string,
    payload: {
      lineId?: string;
      rawBarcode?: string;
      manualSkuOrMpn?: string;
      binCode?: string;
      qty?: number;
      lotNumber?: string;
      dateCode?: string;
      reelId?: string;
      operator: string;
    }
  ) => Promise<{
    asn: AsnOrder;
    matchedLine: AsnLine;
    reel: ReelItem;
    stageAdvancedTo?: AsnWorkflowStage;
  }>;
  onSyncAsnInfo: (
    asnNo: string,
    payload?: { syncChannel?: string }
  ) => Promise<AsnOrder>;
  onOpenLabel: (reel: ReelItem) => void;
  onInspectTrace: (query: string) => void;
  initialSkuCode?: string;
}

export function InboundView({
  pageMode,
  state,
  selectedAsnNo: sharedAsnNo,
  onSelectAsnNo: onSelectSharedAsnNo,
  transitionNotice,
  onClearTransitionNotice,
  onAdvanceStagePage,
  onInbound,
  onCreateAsn,
  onImportAsnCsv,
  onCancelAsn,
  onArriveAsn,
  onScanAsnReceive,
  onInspectAsnIqc,
  onPutawayAsnLine,
  onSyncAsnInfo,
  onOpenLabel,
  onInspectTrace,
  initialSkuCode,
}: InboundViewProps) {
  const defaultMaterial = state.materials[0];
  const [selectedAsnNo, setSelectedAsnNo] = useState('');
  const [selectedAsnLineId, setSelectedAsnLineId] = useState('');

  const [scanBuffer, setScanBuffer] = useState('');
  const [matchedRuleHint, setMatchedRuleHint] = useState<string | null>(null);
  const [scanParseError, setScanParseError] = useState<string | null>(null);
  const [scanParseSummary, setScanParseSummary] = useState<string | null>(null);
  const quickScanInputRef = useRef<HTMLInputElement>(null);
  const [materialKey, setMaterialKey] = useState(
    defaultMaterial?.materialKey ?? defaultMaterial?.skuCode ?? ''
  );
  const [skuCode, setSkuCode] = useState(defaultMaterial?.skuCode ?? '');
  const [lotNumber, setLotNumber] = useState('');
  const [dateCode, setDateCode] = useState('2646');
  const [supplier, setSupplier] = useState(state.suppliers[0]?.supplierName ?? '艾睿电子(Arrow)');
  const [qty, setQty] = useState('1000');
  const [binCode, setBinCode] = useState(defaultMaterial?.defaultBin ?? 'MSD-01-01');
  const [receiptDocNo, setReceiptDocNo] = useState('');
  const [reelId, setReelId] = useState('');
  const [operator, setOperator] = useState(
    state.keepers[0] ? `${state.keepers[0].name} (${state.keepers[0].role})` : '张伟 (仓管员)'
  );
  const [reason, setReason] = useState('来料IQC抽检合格入库上架');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCreated, setLastCreated] = useState<ReelItem | null>(null);

  useEffect(() => {
    if (pageMode === 'quickInbound') {
      focusScanInputOnMount(quickScanInputRef);
    }
  }, [pageMode]);

  useEffect(() => {
    if (!initialSkuCode) return;
    const mat = state.materials.find((m) => m.skuCode === initialSkuCode);
    if (!mat) return;
    setMaterialKey(mat.materialKey ?? mat.skuCode);
    setSkuCode(mat.skuCode);
    setBinCode(mat.defaultBin);
    if (mat.safetyStock > 0) {
      const avail = state.reels
        .filter((r) => r.skuCode === mat.skuCode && r.status === 'IN_STOCK' && r.msdState !== 'BAKING_REQUIRED')
        .reduce((s, r) => s + r.qty, 0);
      const deficit = Math.max(1, mat.safetyStock - avail);
      setQty(String(deficit));
    }
    setReason('低库存安全水位快速补货收料上架');
  }, [initialSkuCode, state.materials, state.reels]);

  const openAsns = state.asns.filter(
    (a) => a.status === 'PENDING' || a.status === 'PARTIAL'
  );
  const activeAsn = openAsns.find((a) => a.asnNo === selectedAsnNo);

  const applyAsnLineToForm = (asn: AsnOrder, lineId?: string) => {
    const targetLine =
      (lineId ? asn.lines.find((l) => l.lineId === lineId) : undefined) ??
      asn.lines.find((l) => l.receivedQty < l.expectedQty) ??
      asn.lines[0];

    setSelectedAsnNo(asn.asnNo);
    setSupplier(asn.supplierName);
    setReceiptDocNo(asn.asnNo);
    setReason(`按ASN预约单 (${asn.asnNo} / ${asn.poNo}) 到货IQC合格入库`);
    if (targetLine) {
      setSelectedAsnLineId(targetLine.lineId);
      const matchedMat = state.materials.find((m) => m.skuCode === targetLine.skuCode);
      setMaterialKey(matchedMat?.materialKey ?? targetLine.skuCode);
      setSkuCode(targetLine.skuCode);
      const rem = Math.max(1, targetLine.expectedQty - targetLine.receivedQty);
      setQty(String(rem));
      if (targetLine.lotNumber) setLotNumber(targetLine.lotNumber);
      if (targetLine.dateCode) setDateCode(targetLine.dateCode);
      if (targetLine.targetBin) setBinCode(targetLine.targetBin);
    }
    setError(null);
    setLastCreated(null);
  };

  const handleSelectAsn = (asnNo: string) => {
    if (!asnNo) {
      setSelectedAsnNo('');
      setSelectedAsnLineId('');
      setReceiptDocNo('');
      setReason('无ASN独立收料IQC抽检合格上架');
      return;
    }
    const found = openAsns.find((a) => a.asnNo === asnNo);
    if (found) {
      applyAsnLineToForm(found);
    }
  };

  const handleSelectAsnLine = (lineId: string) => {
    if (!activeAsn) return;
    applyAsnLineToForm(activeAsn, lineId);
  };

  const handleMaterialChange = (keyOrSku: string) => {
    setMaterialKey(keyOrSku);
    const mat =
      state.materials.find((m) => m.materialKey === keyOrSku) ??
      state.materials.find((m) => m.skuCode === keyOrSku);
    if (mat) {
      setSkuCode(mat.skuCode);
      setBinCode(mat.defaultBin);
      if (mat.supplierName) setSupplier(mat.supplierName);
    }
  };

  const applyParsedBarcode = (raw: string): { ok: boolean; summary?: string } => {
    const trimmed = raw.trim();
    const parsed = parseBarcodeString(trimmed, state.barcodeRules, supplier);
    setMatchedRuleHint(parsed.matchedRuleName ?? null);
    let matchedMat = parsed.mpn
      ? state.materials.find((m) => m.mpn.toUpperCase() === parsed.mpn!.toUpperCase())
      : undefined;
    if (!matchedMat && trimmed) {
      matchedMat = state.materials.find(
        (m) =>
          m.mpn.toUpperCase() === trimmed.toUpperCase() ||
          m.skuCode.toUpperCase() === trimmed.toUpperCase()
      );
    }
    if (matchedMat) {
      setMaterialKey(matchedMat.materialKey ?? matchedMat.skuCode);
      setSkuCode(matchedMat.skuCode);
      setBinCode(matchedMat.defaultBin);
    }
    if (parsed.lotNumber) setLotNumber(parsed.lotNumber);
    if (parsed.dateCode) setDateCode(parsed.dateCode);
    if (parsed.qty) setQty(String(parsed.qty));
    const hasComposite =
      trimmed.includes('|') ||
      trimmed.includes(';') ||
      trimmed.includes(',') ||
      /^UID:/i.test(trimmed);
    if (parsed.reelId && hasComposite) {
      setReelId(parsed.reelId);
    }
    const recognized = Boolean(
      matchedMat || parsed.lotNumber || parsed.dateCode || parsed.qty || (parsed.reelId && hasComposite)
    );
    if (!recognized) {
      return { ok: false };
    }
    const parts: string[] = [];
    if (matchedMat) parts.push(`料号 ${matchedMat.mpn}`);
    if (parsed.lotNumber) parts.push(`批次 ${parsed.lotNumber}`);
    if (parsed.dateCode) parts.push(`D/C ${parsed.dateCode}`);
    if (parsed.qty) parts.push(`数量 ${parsed.qty}`);
    if (parsed.reelId && hasComposite) parts.push(`UID ${parsed.reelId}`);
    return { ok: true, summary: parts.join(' · ') };
  };

  const handleParseComposite = (raw: string) => {
    setScanBuffer(raw);
    setScanParseError(null);
    if (error) setError(null);
    if (raw.trim()) {
      const res = applyParsedBarcode(raw);
      if (res.ok && res.summary) {
        setScanParseSummary(`已自动带出：${res.summary}`);
      } else {
        setScanParseSummary(null);
      }
    } else {
      setMatchedRuleHint(null);
      setScanParseSummary(null);
    }
  };

  const handleParseScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanBuffer.trim()) return;
    setScanParseError(null);
    const res = applyParsedBarcode(scanBuffer);
    if (res.ok) {
      setScanParseSummary(`已解析并带出表单：${res.summary}`);
      completePdaScan({
        currentValue: scanBuffer,
        setValue: setScanBuffer,
        inputRef: quickScanInputRef,
        outcome: 'success',
      });
    } else {
      setScanParseSummary(null);
      setScanParseError(`无法解析条码「${scanBuffer.trim()}」，未匹配已知料号或原厂复合规则`);
      completePdaScan({
        currentValue: scanBuffer,
        setValue: setScanBuffer,
        inputRef: quickScanInputRef,
        outcome: 'error',
      });
    }
  };

  const fillSampleComposite = () => {
    const sample = 'STM32F407VET6;ST2646A9;2646;1000;RL261117-901';
    setScanParseError(null);
    const res = applyParsedBarcode(sample);
    if (res.ok && res.summary) {
      setScanParseSummary(`已解析并带出表单：${res.summary}`);
    }
    completePdaScan({
      currentValue: sample,
      setValue: setScanBuffer,
      inputRef: quickScanInputRef,
      outcome: 'success',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await onInbound({
        materialKey: materialKey || undefined,
        skuCode,
        lotNumber,
        dateCode,
        supplier,
        qty: Number(qty),
        binCode,
        receiptDocNo: receiptDocNo || undefined,
        asnNo: selectedAsnNo || undefined,
        asnLineId: selectedAsnLineId || undefined,
        reelId: reelId || undefined,
        operator,
        reason,
      });
      setLastCreated(created);
      setLotNumber('');
      setReelId('');
      setMatchedRuleHint(null);
      setScanParseSummary(null);
      setScanParseError(null);
      completePdaScan({
        currentValue: scanBuffer,
        setValue: setScanBuffer,
        inputRef: quickScanInputRef,
        outcome: 'success',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '入库提交失败');
      scheduleScanInputFocus(quickScanInputRef, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedMaterial =
    state.materials.find((m) => m.materialKey === materialKey) ??
    state.materials.find((m) => m.skuCode === skuCode);
  const recentInboundReels = state.reels.slice(0, 10);

  if (
    pageMode === 'asnArrival' ||
    pageMode === 'asnReceive' ||
    pageMode === 'asnIqc' ||
    pageMode === 'asnPutaway'
  ) {
    const wbMode =
      pageMode === 'asnArrival'
        ? 'arrival'
        : pageMode === 'asnReceive'
          ? 'receive'
          : pageMode === 'asnIqc'
            ? 'iqc'
            : 'putaway';
    return (
      <AsnPdaReceivingWorkbench
        pageMode={wbMode}
        state={state}
        selectedAsnNo={sharedAsnNo}
        onSelectAsnNo={onSelectSharedAsnNo}
        operator={operator}
        onOperatorChange={setOperator}
        transitionNotice={transitionNotice}
        onClearTransitionNotice={onClearTransitionNotice}
        onAdvanceStagePage={onAdvanceStagePage}
        onArriveAsn={onArriveAsn}
        onScanAsnReceive={onScanAsnReceive}
        onInspectAsnIqc={onInspectAsnIqc}
        onPutawayAsnLine={onPutawayAsnLine}
        onSyncAsnInfo={onSyncAsnInfo}
        onOpenLabel={onOpenLabel}
        onInspectTrace={onInspectTrace}
      />
    );
  }

  if (pageMode === 'asnPlan') {
    return (
      <AsnManagerPanel
        state={state}
        onCreateAsn={onCreateAsn}
        onImportAsnCsv={onImportAsnCsv}
        onCancelAsn={onCancelAsn}
      />
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          {/* Left: Inbound Form */}
          <section className="mes-panel p-4 sm:p-6 xl:col-span-5">
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-base font-semibold text-slate-900">
                来料收货与UID赋码上架
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                支持关联采购ASN预约单核销收料，或直接扫码原厂复合标签独立入库
              </p>
            </div>

            {/* Canonical Composite Barcode Parser */}
            <form onSubmit={handleParseScanSubmit} className="mt-4 border-b border-slate-100 pb-4">
              <PdaScanField
                id="inbound-scan-parser"
                inputRef={quickScanInputRef}
                label="原厂复合条码快扫解析 (IPC-1782)"
                subtitle="扫描原厂 2D 标签回车自动带出料号、批次、周期与数量，成功后自动清空待下次扫描"
                headerExtra={
                  <button
                    type="button"
                    onClick={fillSampleComposite}
                    className="text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap"
                  >
                    填入示例条码
                  </button>
                }
                value={scanBuffer}
                onChange={handleParseComposite}
                placeholder="支持原厂复合码或供应商定制规则（如 Arrow/Yageo）"
                actionLabel="扫码解析"
                actionDisabled={!scanBuffer.trim()}
                feedback={
                  scanParseError || error
                    ? { type: 'error', message: scanParseError || error }
                    : lastCreated
                      ? {
                          type: 'success',
                          message: (
                            <>
                              入库成功！已赋码 <strong className="font-mono">{lastCreated.reelId}</strong>
                            </>
                          ),
                          action: (
                            <button
                              type="button"
                              onClick={() => onOpenLabel(lastCreated)}
                              className="font-medium text-emerald-900 underline whitespace-nowrap shrink-0"
                            >
                              打印UID标签
                            </button>
                          ),
                        }
                      : scanParseSummary
                        ? { type: 'success', message: scanParseSummary }
                        : null
                }
                helperHint={
                  matchedRuleHint ? (
                    <span className="text-[11px] font-medium text-teal-800">
                      已命中供应商规则：{matchedRuleHint}
                    </span>
                  ) : undefined
                }
              />
            </form>

            {/* Optional Link to Procurement-Issued Notice */}
            <div className="mt-4 space-y-2.5 border-b border-slate-100 pb-4">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="in-asn-select"
                  className="text-xs font-medium text-slate-700"
                >
                  关联采购下发通知单 (可选)
                </label>
                <span className="text-[11px] text-slate-400">
                  仅限采购部下发通知
                </span>
              </div>
              <select
                id="in-asn-select"
                value={selectedAsnNo}
                onChange={(e) => handleSelectAsn(e.target.value)}
                className="min-h-[44px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15"
              >
                <option value="">-- 无采购通知直收 (应急散料入库) --</option>
                {openAsns.map((a) => (
                  <option key={a.asnNo} value={a.asnNo}>
                    {a.asnNo} · {a.supplierName} (PO: {a.poNo})
                  </option>
                ))}
              </select>

              {activeAsn && (
                <div className="space-y-1.5 pt-1">
                  <div className="text-[11px] font-medium text-slate-600">
                    选择本次到货物料明细行：
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {activeAsn.lines
                      .filter(
                        (line) =>
                          !(
                            line.iqcStatus === 'FAILED' ||
                            ((line.iqcRejectedQty ?? 0) > 0 &&
                              (line.iqcPassedQty ?? 0) <= 0 &&
                              line.receivedQty >= line.expectedQty)
                          )
                      )
                      .map((line) => {
                        const rem = Math.max(0, line.expectedQty - line.receivedQty);
                        const isSel = selectedAsnLineId === line.lineId;
                        return (
                          <button
                            key={line.lineId}
                            type="button"
                            onClick={() => handleSelectAsnLine(line.lineId)}
                            className={`min-h-[36px] rounded border px-2.5 py-1 text-left font-mono text-xs transition-colors ${
                              isSel
                                ? 'border-teal-600 bg-teal-50 text-teal-900 font-semibold'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {line.mpn} · 待收 {rem}/{line.expectedQty}
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label htmlFor="in-sku" className="block text-xs font-medium text-slate-700">
                  物料编码 / 业务归属 <span className="text-red-600">*</span>
                </label>
                <select
                  id="in-sku"
                  value={materialKey}
                  onChange={(e) => handleMaterialChange(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                >
                  {state.materials.map((m) => {
                    const key = m.materialKey ?? m.skuCode;
                    const cusLabel = m.customerCode
                      ? `限${m.customerName || m.customerCode}`
                      : '通用共享';
                    return (
                      <option key={key} value={key}>
                        {m.mpn} [{m.ownerName || '本厂自购'} · {cusLabel}] — {m.name} ({m.msdLevel})
                      </option>
                    );
                  })}
                </select>
                {selectedMaterial && (
                  <div className="mt-1 text-[11px] text-slate-500">
                    料号 {selectedMaterial.skuCode} · 产权{' '}
                    <span className="font-semibold text-slate-700">
                      {selectedMaterial.ownerName || '本厂自购'}
                    </span>{' '}
                    · 准入{' '}
                    <span className="font-semibold text-teal-800">
                      {selectedMaterial.customerCode
                        ? `专备 ${selectedMaterial.customerName || selectedMaterial.customerCode}`
                        : '通用共享 (不限客户)'}
                    </span>{' '}
                    · 包装 {selectedMaterial.packagingName || selectedMaterial.packageType} (MPQ{' '}
                    <span className="font-mono">{selectedMaterial.mpq ?? '-'}</span>)
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="in-lot" className="block text-xs font-medium text-slate-700">
                    供应商批次 (Lot No) <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="in-lot"
                    type="text"
                    required
                    value={lotNumber}
                    onChange={(e) => setLotNumber(e.target.value)}
                    placeholder="如 ST2646A1"
                    className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="in-dc" className="block text-xs font-medium text-slate-700">
                    周期码 (DateCode 4位) <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="in-dc"
                    type="text"
                    required
                    maxLength={4}
                    value={dateCode}
                    onChange={(e) => setDateCode(e.target.value)}
                    placeholder="如 2646"
                    className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="in-qty" className="block text-xs font-medium text-slate-700">
                    入库数量 ({selectedMaterial?.unit ?? 'PCS'}) <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="in-qty"
                    type="number"
                    min={1}
                    required
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 tabular-nums focus:border-teal-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="in-bin" className="block text-xs font-medium text-slate-700">
                    上架目标库位 <span className="text-red-600">*</span>
                  </label>
                  <select
                    id="in-bin"
                    value={binCode}
                    onChange={(e) => setBinCode(e.target.value)}
                    className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  >
                    {state.bins.map((b) => (
                      <option key={b.binCode} value={b.binCode}>
                        {b.binCode} ({b.zone})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="in-supplier" className="block text-xs font-medium text-slate-700">
                    供应商档案
                  </label>
                  <select
                    id="in-supplier"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  >
                    {state.suppliers.map((s) => (
                      <option key={s.supplierCode} value={s.supplierName}>
                        {s.supplierName}
                      </option>
                    ))}
                    {!state.suppliers.some((s) => s.supplierName === supplier) && (
                      <option value={supplier}>{supplier}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label htmlFor="in-reel" className="block text-xs font-medium text-slate-700">
                    指定UID (留空自动生成)
                  </label>
                  <input
                    id="in-reel"
                    type="text"
                    value={reelId}
                    onChange={(e) => setReelId(e.target.value)}
                    placeholder="自动生成 RL-YYMMDD-XXXX"
                    className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="in-doc" className="block text-xs font-medium text-slate-700">
                    收料单号 / ASN
                  </label>
                  <input
                    id="in-doc"
                    type="text"
                    value={receiptDocNo}
                    onChange={(e) => setReceiptDocNo(e.target.value)}
                    placeholder="自动生成 RCV-..."
                    className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="in-operator" className="block text-xs font-medium text-slate-700">
                    收料操作员
                  </label>
                  <select
                    id="in-operator"
                    value={operator}
                    onChange={(e) => setOperator(e.target.value)}
                    className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  >
                    {state.keepers.map((k) => {
                      const val = `${k.name} (${k.role})`;
                      return (
                        <option key={k.keeperId} value={val}>
                          {val}
                        </option>
                      );
                    })}
                    {!state.keepers.some((k) => `${k.name} (${k.role})` === operator) && (
                      <option value={operator}>{operator}</option>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="in-reason" className="block text-xs font-medium text-slate-700">
                  IQC检验/入库备注
                </label>
                <input
                  id="in-reason"
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="min-h-[48px] w-full rounded-md bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
              >
                {submitting ? '正在生成UID并入库...' : '确认收料并生成UID条码上架'}
              </button>
            </form>
          </section>

          {/* Right: Recent Inbound Reels */}
          <section className="mes-panel xl:col-span-7">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">最新收料入库料盘与标签管理</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                每盘电子料拥有独立UID，支持关联ASN单号追溯及随时补打条码标签
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-[#f8fafb] text-slate-500">
                  <tr>
                    <th className="px-3.5 py-2.5 font-medium whitespace-nowrap">料盘 UID / 准入</th>
                    <th className="px-2.5 py-2.5 font-medium whitespace-nowrap">MPN / 批次 / 周期</th>
                    <th className="px-2.5 py-2.5 font-medium whitespace-nowrap">库位 / 单据</th>
                    <th className="px-2.5 py-2.5 font-medium text-right whitespace-nowrap">余量 / 时间</th>
                    <th className="px-3.5 py-2.5 font-medium text-right whitespace-nowrap">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentInboundReels.map((reel) => (
                    <tr key={reel.reelId} className="hover:bg-slate-50">
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <div className="font-mono font-semibold text-slate-900">{reel.reelId}</div>
                        <div
                          title={reel.customerName || '通用共享'}
                          className="max-w-[125px] truncate text-[11px] text-slate-500"
                        >
                          {reel.customerCode
                            ? `限[${reel.customerName || reel.customerCode}]`
                            : '通用共享'}
                        </div>
                      </td>
                      <td className="px-2.5 py-2.5">
                        <div className="font-mono font-medium text-slate-900">{reel.mpn}</div>
                        <div className="font-mono text-[11px] text-slate-500">
                          {reel.lotNumber} · {reel.dateCode} · {reel.msdLevel}
                        </div>
                      </td>
                      <td className="px-2.5 py-2.5 whitespace-nowrap">
                        <div className="font-mono text-slate-800">{reel.binCode}</div>
                        <div className="font-mono text-[11px] text-slate-400">
                          {reel.asnNo || reel.receiptDocNo}
                        </div>
                      </td>
                      <td className="px-2.5 py-2.5 text-right font-mono tabular-nums whitespace-nowrap">
                        <div>
                          <span className="font-semibold text-slate-900">
                            {reel.qty.toLocaleString()}
                          </span>
                          <span className="text-slate-400">
                            /{reel.initialQty.toLocaleString()}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {formatTime(reel.receivedAt).slice(5)}
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onOpenLabel(reel)}
                            className="inline-flex items-center gap-1 font-medium text-teal-700 hover:text-teal-800"
                          >
                            <Barcode className="h-3.5 w-3.5" />
                            打印
                          </button>
                          <button
                            type="button"
                            onClick={() => onInspectTrace(reel.reelId)}
                            className="font-medium text-slate-600 hover:text-slate-900"
                          >
                            追溯
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
      </div>
    </div>
  );
}
