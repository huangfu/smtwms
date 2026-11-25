import {
  ArrowRight,
  Barcode,
  BellRing,
  CheckCircle2,
  ClipboardCheck,
  Keyboard,
  RefreshCw,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  AsnLine,
  AsnOrder,
  AsnWorkflowStage,
  ReelItem,
  ScanTabBucket,
  WmsState,
} from '../types/wms';
import { ASN_STAGE_META, formatTime } from '../utils/formatters';
import { completePdaScan, focusScanInputOnMount } from '../utils/pdaScanFocus';
import {
  canCrossNavigateStage,
  getCrossDepartmentQueueCounts,
  getDepartmentAsns,
} from '../utils/roleAccess';
import {
  deriveAsnWorkflowStage,
  getAsnLineStageMetrics,
  getIqcRejectedAsnLines,
  parseBarcodeString,
} from '../utils/wmsLogic';
import { AsnWorkflowStepper } from './AsnWorkflowStepper';
import { PdaScanField } from './PdaScanField';
import { ScanProgressTabs } from './ScanProgressTabs';

import type { NavKey } from './Sidebar';

export type AsnPdaPageMode = 'arrival' | 'receive' | 'iqc' | 'putaway';

interface AsnPdaReceivingWorkbenchProps {
  pageMode: AsnPdaPageMode;
  state: WmsState;
  selectedAsnNo: string;
  onSelectAsnNo: (asnNo: string) => void;
  operator: string;
  onOperatorChange: (op: string) => void;
  transitionNotice?: string | null;
  onClearTransitionNotice?: () => void;
  onAdvanceStagePage?: (nextNav: NavKey, asnNo: string, notice: string) => void;
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
}

export function AsnPdaReceivingWorkbench({
  pageMode,
  state,
  selectedAsnNo,
  onSelectAsnNo,
  operator,
  onOperatorChange,
  transitionNotice,
  onClearTransitionNotice,
  onAdvanceStagePage,
  onArriveAsn,
  onScanAsnReceive,
  onInspectAsnIqc,
  onPutawayAsnLine,
  onSyncAsnInfo,
  onOpenLabel,
  onInspectTrace,
}: AsnPdaReceivingWorkbenchProps) {
  const scanInputRef = useRef<HTMLInputElement>(null);

  // Default bottom progress tab is strictly 'SCANNED' (已刷) per PDA workflow spec
  const [activeBucket, setActiveBucket] = useState<ScanTabBucket>('SCANNED');

  // Arrival check-in inputs
  const [deliveryNoteNo, setDeliveryNoteNo] = useState('');
  const [carrierName, setCarrierName] = useState('顺丰快运 / 供应商专车');

  // Continuous barcode scan input
  const [scanCode, setScanCode] = useState('');
  // IQC inspection state (used strictly in pageMode === 'iqc' after receiving registration completes)
  const [iqcResult, setIqcResult] = useState<'PASSED' | 'FAILED'>('PASSED');
  const [iqcSplitOpen, setIqcSplitOpen] = useState(false);
  const [iqcSplitLineId, setIqcSplitLineId] = useState('');
  const [iqcPassedInput, setIqcPassedInput] = useState('');
  const [iqcRejectedInput, setIqcRejectedInput] = useState('0');
  const [iqcNote, setIqcNote] = useState('');
  const [putawayBin, setPutawayBin] = useState(state.bins[0]?.binCode ?? 'MSD-01-01');

  // Manual fallback form when carton has no barcode
  const [manualOpen, setManualOpen] = useState(false);
  const [manualLineId, setManualLineId] = useState('');
  const [manualSkuOrMpn, setManualSkuOrMpn] = useState('');
  const [manualQty, setManualQty] = useState('');
  const [manualLot, setManualLot] = useState('');
  const [manualDc, setManualDc] = useState('2646');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [stageBanner, setStageBanner] = useState<string | null>(null);
  const [lastPutawayReel, setLastPutawayReel] = useState<ReelItem | null>(null);

  const queueCounts = useMemo(
    () => getCrossDepartmentQueueCounts(state.asns),
    [state.asns]
  );

  const scopedAsns = useMemo(
    () => getDepartmentAsns(state.asns, pageMode),
    [state.asns, pageMode]
  );

  const activeAsn = useMemo(() => {
    const chosen = scopedAsns.find((a) => a.asnNo === selectedAsnNo);
    if (chosen) {
      return chosen;
    }
    return scopedAsns[0] ?? null;
  }, [scopedAsns, selectedAsnNo]);

  useEffect(() => {
    if (!activeAsn) return;
    if (!selectedAsnNo || !scopedAsns.some((a) => a.asnNo === selectedAsnNo)) {
      onSelectAsnNo(activeAsn.asnNo);
    }
  }, [selectedAsnNo, activeAsn, scopedAsns, onSelectAsnNo]);

  const currentStage: AsnWorkflowStage = activeAsn
    ? deriveAsnWorkflowStage(activeAsn)
    : 'ASN_REGISTERED';

  // Sync defaults when active ASN changes
  useEffect(() => {
    if (!activeAsn) return;
    setDeliveryNoteNo(activeAsn.deliveryNoteNo ?? `DN-${activeAsn.asnNo.slice(-6)}`);
    setCarrierName(activeAsn.carrierName ?? '供应商直发专车');
    const firstPending =
      activeAsn.lines.find((l) => l.receivedQty < l.expectedQty) ?? activeAsn.lines[0];
    if (firstPending) {
      setManualLineId(firstPending.lineId);
      setManualSkuOrMpn(firstPending.mpn);
      setManualQty(String(Math.max(1, firstPending.expectedQty - firstPending.receivedQty)));
      setManualLot(firstPending.lotNumber ?? '');
      setManualDc(firstPending.dateCode ?? '2646');
      if (firstPending.targetBin) setPutawayBin(firstPending.targetBin);
    }
    setError(null);
  }, [activeAsn?.asnNo]);

  // Reset bottom progress tab back to default 「已刷」 whenever stage advances or ASN switches
  useEffect(() => {
    setActiveBucket('SCANNED');
  }, [activeAsn?.asnNo, currentStage]);

  // Scope the line-progress view strictly to the current department's own work stage
  // so Warehouse never renders IQC inspection queues and IQC never renders Warehouse receiving/putaway queues.
  const displayStage: AsnWorkflowStage =
    pageMode === 'arrival' || pageMode === 'receive'
      ? 'RECEIVING'
      : pageMode === 'iqc'
        ? 'IQC_INSPECTION'
        : currentStage === 'INFO_SYNCED' || currentStage === 'INVENTORY_UPDATED'
          ? currentStage
          : 'PUTAWAY';

  const isPutawayOrPostStage = pageMode === 'putaway';

  // Classify ASN lines into 已刷 / 作业中 / 未刷 for this department's displayStage.
  // In Warehouse Putaway, strictly exclude 100% IQC-rejected lines (iqcPassedQty <= 0)
  // so rejected/quarantined items NEVER appear in the inbound putaway queue.
  const classifiedLines = useMemo(() => {
    if (!activeAsn) return [];
    return activeAsn.lines
      .map((line) => ({
        line,
        metrics: getAsnLineStageMetrics(line, displayStage),
      }))
      .filter(({ metrics }) => !isPutawayOrPostStage || !metrics.excludedFromPutaway);
  }, [activeAsn, displayStage, isPutawayOrPostStage]);

  const iqcRejectedLines = useMemo(() => {
    if (!activeAsn || !isPutawayOrPostStage) return [];
    return getIqcRejectedAsnLines(activeAsn);
  }, [activeAsn, isPutawayOrPostStage]);

  const fullyRejectedLinesCount = useMemo(
    () => iqcRejectedLines.filter((l) => (l.iqcPassedQty ?? 0) <= 0).length,
    [iqcRejectedLines]
  );

  const totalIqcRejectedQty = useMemo(
    () => iqcRejectedLines.reduce((sum, l) => sum + (l.iqcRejectedQty ?? 0), 0),
    [iqcRejectedLines]
  );

  const bucketCounts = useMemo(() => {
    const counts = { SCANNED: 0, IN_PROGRESS: 0, UNSCANNED: 0 };
    for (const item of classifiedLines) {
      counts[item.metrics.bucket] += 1;
    }
    return counts;
  }, [classifiedLines]);

  const visibleLines = useMemo(
    () => classifiedLines.filter((item) => item.metrics.bucket === activeBucket),
    [classifiedLines, activeBucket]
  );

  const parsedPreview = useMemo(() => {
    if (!scanCode.trim() || !activeAsn) return null;
    return parseBarcodeString(scanCode, state.barcodeRules, activeAsn.supplierName);
  }, [scanCode, state.barcodeRules, activeAsn]);

  const asnReels = useMemo(() => {
    if (!activeAsn) return [];
    return state.reels.filter((r) => r.asnNo === activeAsn.asnNo);
  }, [state.reels, activeAsn]);

  useEffect(() => {
    if (
      (pageMode === 'receive' && currentStage === 'RECEIVING') ||
      (pageMode === 'iqc' && currentStage === 'IQC_INSPECTION') ||
      (pageMode === 'putaway' && currentStage === 'PUTAWAY')
    ) {
      focusScanInputOnMount(scanInputRef);
    }
  }, [pageMode, activeAsn?.asnNo, currentStage]);

  const handleConfirmArrival = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAsn) return;
    setBusy(true);
    setError(null);
    setFeedback(null);
    setStageBanner(null);
    onClearTransitionNotice?.();
    try {
      const res = await onArriveAsn(activeAsn.asnNo, {
        deliveryNoteNo: deliveryNoteNo.trim() || undefined,
        carrierName: carrierName.trim() || undefined,
        operator,
      });
      const banner = `供应商送货已签到 (${res.asn.deliveryNoteNo})，已自动进入【2. 待收料初收】`;
      if (onAdvanceStagePage && canCrossNavigateStage('arrival', 'RECEIVING')) {
        onAdvanceStagePage('asnReceive', activeAsn.asnNo, banner);
      } else {
        setStageBanner(banner);
        focusScanInputOnMount(scanInputRef);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '到货签到失败');
    } finally {
      setBusy(false);
    }
  };

  const executeReceivingScan = async (payload: {
    rawBarcode?: string;
    manualSkuOrMpn?: string;
    lineId?: string;
    qty?: number;
    lotNumber?: string;
    dateCode?: string;
  }) => {
    if (!activeAsn) return;
    setBusy(true);
    setError(null);
    setFeedback(null);
    setStageBanner(null);
    onClearTransitionNotice?.();
    try {
      const res = await onScanAsnReceive(activeAsn.asnNo, {
        ...payload,
        operator,
      });
      const bucketLabel =
        res.lineBucket === 'SCANNED'
          ? '已刷'
          : res.lineBucket === 'IN_PROGRESS'
            ? '作业中'
            : '未刷';
      setFeedback(
        `已点收登记 ${res.matchedLine.mpn}：本次 +${res.addedQty.toLocaleString()}，累计 ${res.matchedLine.receivedQty.toLocaleString()}/${res.matchedLine.expectedQty.toLocaleString()}（状态：${bucketLabel}，待初收齐后通知IQC）`
      );
      completePdaScan({
        currentValue: scanCode,
        setValue: setScanCode,
        inputRef: scanInputRef,
        outcome: 'success',
      });
      // Segregation of duties: NEVER auto-jump from Warehouse Receiving to IQC page.
      // Emit clear IQC inspection handoff notification and remain in Warehouse workspace.
      if (res.stageAdvancedTo === 'IQC_INSPECTION') {
        setStageBanner(
          `初步收料全部完成 (${activeAsn.asnNo})！系统已自动发送【IQC 报检通知】至品质部待检队列，待 IQC 检验放行后，合格物料将自动进入仓库「3. 合格品入库上架」清单。`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '扫码核收失败');
      completePdaScan({
        currentValue: scanCode,
        setValue: setScanCode,
        inputRef: scanInputRef,
        outcome: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleReceivingScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanCode.trim()) return;
    await executeReceivingScan({ rawBarcode: scanCode.trim() });
  };

  const handleManualReceiveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qtyNum = Number(manualQty);
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      setError('请输入大于 0 的收货数量');
      return;
    }
    await executeReceivingScan({
      lineId: manualLineId || undefined,
      manualSkuOrMpn: manualSkuOrMpn.trim() || undefined,
      qty: qtyNum,
      lotNumber: manualLot.trim() || undefined,
      dateCode: manualDc.trim() || undefined,
    });
  };

  const executeIqcInspect = async (payload: {
    lineId?: string;
    rawBarcode?: string;
    result?: 'PASSED' | 'FAILED';
    qty?: number;
    passedQty?: number;
    rejectedQty?: number;
    note?: string;
  }) => {
    if (!activeAsn) return;
    setBusy(true);
    setError(null);
    setFeedback(null);
    setStageBanner(null);
    onClearTransitionNotice?.();
    try {
      const res = await onInspectAsnIqc(activeAsn.asnNo, {
        ...payload,
        operator,
      });
      const summaryParts: string[] = [];
      if (res.passedAdded > 0) summaryParts.push(`合格 +${res.passedAdded.toLocaleString()}`);
      if (res.rejectedAdded > 0) summaryParts.push(`不良 +${res.rejectedAdded.toLocaleString()}`);
      setFeedback(
        `IQC 判定完成 ${res.matchedLine.mpn}：${summaryParts.join(' / ')}（累计合格 ${(res.matchedLine.iqcPassedQty ?? 0).toLocaleString()}，不良 ${(res.matchedLine.iqcRejectedQty ?? 0).toLocaleString()}）`
      );
      completePdaScan({
        currentValue: scanCode,
        setValue: setScanCode,
        inputRef: scanInputRef,
        outcome: 'success',
      });
      setIqcSplitOpen(false);
      setIqcNote('');
      // Segregation of duties: NEVER auto-jump from IQC to Warehouse Putaway page.
      // Emit clear release notification back to Warehouse putaway queue and stay in IQC workspace.
      if (res.stageAdvancedTo === 'PUTAWAY') {
        setStageBanner(
          `IQC 来料检验全部完成 (${activeAsn.asnNo})！系统已自动发送【合格品放行通知】至仓库部「3. 合格品入库上架」清单，仓库人员可开始执行入库上架。`
        );
      } else if (res.stageAdvancedTo === 'INFO_SYNCED') {
        setStageBanner(
          `该批物料 IQC 全部判定不良隔离 (${activeAsn.asnNo})，已自动阻断入库并生成 MRB 退供回传流水 ${res.asn.syncRefNo}。`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'IQC 判定提交失败');
      completePdaScan({
        currentValue: scanCode,
        setValue: setScanCode,
        inputRef: scanInputRef,
        outcome: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleIqcScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanCode.trim()) return;
    await executeIqcInspect({
      rawBarcode: scanCode.trim(),
      result: iqcResult,
      note: iqcNote.trim() || undefined,
    });
  };

  const openIqcSplitForLine = (line: AsnLine) => {
    const rem = Math.max(
      0,
      line.receivedQty - ((line.iqcPassedQty ?? 0) + (line.iqcRejectedQty ?? 0))
    );
    setIqcSplitLineId(line.lineId);
    setIqcPassedInput(String(rem));
    setIqcRejectedInput('0');
    setIqcNote(line.iqcNote ?? '');
    setIqcSplitOpen(true);
    setError(null);
  };

  const handleIqcSplitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const passed = Number(iqcPassedInput);
    const rejected = Number(iqcRejectedInput);
    if (!Number.isFinite(passed) || passed < 0 || !Number.isFinite(rejected) || rejected < 0) {
      setError('合格数量与不良数量不能为负数');
      return;
    }
    if (passed + rejected <= 0) {
      setError('合格与不良合计必须大于 0');
      return;
    }
    await executeIqcInspect({
      lineId: iqcSplitLineId || undefined,
      passedQty: passed,
      rejectedQty: rejected,
      note: iqcNote.trim() || undefined,
    });
  };

  const executePutaway = async (payload: {
    lineId?: string;
    rawBarcode?: string;
    binCode?: string;
    qty?: number;
  }) => {
    if (!activeAsn) return;
    setBusy(true);
    setError(null);
    setFeedback(null);
    setStageBanner(null);
    try {
      const res = await onPutawayAsnLine(activeAsn.asnNo, {
        ...payload,
        binCode: payload.binCode || putawayBin,
        operator,
      });
      setLastPutawayReel(res.reel);
      setFeedback(
        `入库上架成功：${res.matchedLine.mpn} (${res.reel.qty.toLocaleString()}) -> 库位 ${res.reel.binCode}，已生成 UID ${res.reel.reelId}`
      );
      if (res.stageAdvancedTo === 'INFO_SYNCED') {
        setStageBanner(
          `全部合格物料已完成上架！系统已自动完成【6. 库存更新】→【7. 信息同步】（同步流水 ${res.asn.syncRefNo}）`
        );
      }
      completePdaScan({
        currentValue: scanCode,
        setValue: setScanCode,
        inputRef: scanInputRef,
        outcome: 'success',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '入库上架失败');
      completePdaScan({
        currentValue: scanCode,
        setValue: setScanCode,
        inputRef: scanInputRef,
        outcome: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const handlePutawayScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanCode.trim()) return;
    await executePutaway({ rawBarcode: scanCode.trim(), binCode: putawayBin });
  };

  const handleManualResync = async () => {
    if (!activeAsn) return;
    setBusy(true);
    setError(null);
    try {
      const synced = await onSyncAsnInfo(activeAsn.asnNo, {
        syncChannel: 'ERP/MES 实时回传',
      });
      setStageBanner(
        `信息同步回传成功：${synced.syncChannel} · 流水号 ${synced.syncRefNo}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '信息同步失败');
    } finally {
      setBusy(false);
    }
  };

  const openManualForLine = (line: AsnLine) => {
    setManualLineId(line.lineId);
    setManualSkuOrMpn(line.mpn);
    setManualQty(String(Math.max(1, line.expectedQty - line.receivedQty)));
    setManualLot(line.lotNumber ?? '');
    setManualDc(line.dateCode ?? '2646');
    setManualOpen(true);
    setError(null);
  };

  if (!activeAsn) {
    const emptyCopy =
      pageMode === 'iqc'
        ? {
            title: '暂无仓库报检待检任务',
            desc: '当仓库部完成初步收料并发送报检通知后，待检批次将自动进入本 IQC 队列。',
          }
        : pageMode === 'putaway'
          ? {
              title: '暂无 IQC 已放行待入库清单',
              desc:
                queueCounts.notifiedIqcCount > 0
                  ? `当前有 ${queueCounts.notifiedIqcCount} 笔初收批次正在 IQC 品质部检验中，检验放行后将自动出现在本清单中。`
                  : '请等待 IQC 品质部完成来料检验放行，放行后的合格物料将自动进入本待入库清单。',
            }
          : {
              title: '暂无采购下发待收料清单',
              desc: '由采购部在「采购 ASN 预约管理」下发到货预约通知后，将自动同步到仓库待收料清单。',
            };
    return (
      <div className="mes-panel rounded-lg p-8 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          {pageMode === 'iqc' ? (
            <ShieldCheck className="h-5 w-5" />
          ) : (
            <BellRing className="h-5 w-5" />
          )}
        </div>
        <div className="mt-3 text-sm font-semibold text-slate-900">{emptyCopy.title}</div>
        <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">{emptyCopy.desc}</p>
      </div>
    );
  }

  const totalStageTarget = classifiedLines.reduce((s, item) => s + item.metrics.targetQty, 0);
  const totalStageDone = classifiedLines.reduce((s, item) => s + item.metrics.doneQty, 0);
  const stagePct =
    totalStageTarget > 0 ? Math.min(100, Math.round((totalStageDone / totalStageTarget) * 100)) : 100;

  const activeBanner = stageBanner || transitionNotice;
  const stageNeedsArrival =
    currentStage === 'SUPPLIER_DELIVERY' || currentStage === 'ASN_REGISTERED';
  const stageIsReceiving = currentStage === 'RECEIVING';
  const stageIsIqc = currentStage === 'IQC_INSPECTION';
  const stageIsPutaway = currentStage === 'PUTAWAY';
  const stageIsSynced =
    currentStage === 'INVENTORY_UPDATED' || currentStage === 'INFO_SYNCED';

  const stageTargetNav = (stage: AsnWorkflowStage): NavKey => {
    if (stage === 'SUPPLIER_DELIVERY' || stage === 'ASN_REGISTERED') return 'asnArrival';
    if (stage === 'RECEIVING') return 'asnReceive';
    if (stage === 'IQC_INSPECTION') return 'asnIqc';
    return 'asnPutaway';
  };

  const stageTargetLabel = (stage: AsnWorkflowStage): string => {
    if (stage === 'SUPPLIER_DELIVERY' || stage === 'ASN_REGISTERED') return '1. 到货签到';
    if (stage === 'RECEIVING') return '2. 待收料初收';
    if (stage === 'IQC_INSPECTION') return 'IQC 品质部检验';
    return '3. 合格品入库上架';
  };

  const queueSelectorLabel =
    pageMode === 'arrival'
      ? '采购到货待签到清单'
      : pageMode === 'receive'
        ? '仓库待收料清单（采购下发）'
        : pageMode === 'iqc'
          ? 'IQC 报检待检清单（仓库送检）'
          : 'IQC 已放行 · 待入库清单';

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Compact Single-Row Department Queue Selector + Inline Progress (Optimized for 390px PDA 1-screen fit) */}
      <section className="mes-panel rounded-lg p-3.5 sm:p-4">
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-12 md:items-end">
          <div className="md:col-span-6">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="pda-asn-select" className="text-xs font-medium text-slate-700">
                {queueSelectorLabel}
              </label>
              <span className="font-mono text-xs font-semibold text-teal-700 tabular-nums md:hidden">
                {totalStageDone.toLocaleString()} / {totalStageTarget.toLocaleString()} ({stagePct}%)
              </span>
            </div>
            <select
              id="pda-asn-select"
              value={activeAsn.asnNo}
              onChange={(e) => {
                onSelectAsnNo(e.target.value);
                setFeedback(null);
                setStageBanner(null);
                onClearTransitionNotice?.();
                setLastPutawayReel(null);
              }}
              className="mt-1 min-h-[42px] w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 font-mono text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
            >
              {scopedAsns.map((a) => {
                const st = ASN_STAGE_META[deriveAsnWorkflowStage(a)];
                return (
                  <option key={a.asnNo} value={a.asnNo}>
                    {a.asnNo} · {a.supplierName} [{st.label}]
                  </option>
                );
              })}
            </select>
          </div>

          <div className="hidden md:block md:col-span-3">
            <label htmlFor="pda-operator" className="block text-xs font-medium text-slate-700">
              作业人员 (PDA)
            </label>
            <select
              id="pda-operator"
              value={operator}
              onChange={(e) => onOperatorChange(e.target.value)}
              className="mt-1 min-h-[42px] w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
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

          <div className="hidden md:flex md:col-span-3 flex-col justify-end">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>当前阶段进度</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {totalStageDone.toLocaleString()} / {totalStageTarget.toLocaleString()} ({stagePct}%)
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full transition-all ${
                  stagePct >= 100 ? 'bg-emerald-600' : 'bg-teal-600'
                }`}
                style={{ width: `${stagePct}%` }}
              />
            </div>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-600">
          <span>
            PO <strong className="font-mono text-slate-900">{activeAsn.poNo}</strong>
          </span>
          <span className="text-slate-300">·</span>
          <span>{activeAsn.supplierName}</span>
          {activeAsn.deliveryNoteNo && (
            <>
              <span className="text-slate-300">·</span>
              <span className="font-mono text-slate-700">送货单 {activeAsn.deliveryNoteNo}</span>
            </>
          )}
          {activeAsn.syncRefNo && (
            <>
              <span className="text-slate-300">·</span>
              <span className="font-mono text-emerald-700">同步号 {activeAsn.syncRefNo}</span>
            </>
          )}
        </div>
      </section>

      {/* Compact 6-Stage Standard Receiving Indicator */}
      <AsnWorkflowStepper currentStage={currentStage} asn={activeAsn} compact />

      {/* Auto-advance & Scan Result Feedback */}
      {activeBanner && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-emerald-900"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{activeBanner}</span>
        </div>
      )}

      {(() => {
        const hasInlineScanField =
          (pageMode === 'receive' && stageIsReceiving) ||
          (pageMode === 'iqc' && stageIsIqc) ||
          (pageMode === 'putaway' && stageIsPutaway);
        if (hasInlineScanField) return null;
        return (
          <>
            {feedback && (
              <div
                role="status"
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3.5 py-2 text-xs font-medium text-teal-900"
              >
                <span>{feedback}</span>
                {lastPutawayReel && (
                  <button
                    type="button"
                    onClick={() => onOpenLabel(lastPutawayReel)}
                    className="inline-flex min-h-[36px] items-center gap-1 rounded border border-teal-300 bg-white px-2.5 py-1 font-medium text-teal-800 hover:bg-teal-100"
                  >
                    <Barcode className="h-3.5 w-3.5" />
                    打印 {lastPutawayReel.reelId}
                  </button>
                )}
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700"
              >
                {error}
              </div>
            )}
          </>
        );
      })()}

      {/* Single-Function Focused Operation Deck */}
      <section className="mes-panel rounded-lg p-3.5 sm:p-5">
        {pageMode === 'arrival' && (
          stageNeedsArrival ? (
            <form onSubmit={handleConfirmArrival} className="space-y-3.5">
              <div className="flex items-start gap-2.5">
                <Truck className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    供应商送货到厂签到 ({activeAsn.asnNo})
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    核对送货单号与承运信息后签到，系统将自动进入「2. 待收料初收」执行扫码点收
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="pda-dn" className="block text-xs font-medium text-slate-700">
                    供应商送货单号
                  </label>
                  <input
                    id="pda-dn"
                    type="text"
                    value={deliveryNoteNo}
                    onChange={(e) => setDeliveryNoteNo(e.target.value)}
                    placeholder="如 DN-261117-01"
                    className="mt-1 min-h-[44px] w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="pda-carrier" className="block text-xs font-medium text-slate-700">
                    物流承运 / 送货车牌
                  </label>
                  <input
                    id="pda-carrier"
                    type="text"
                    value={carrierName}
                    onChange={(e) => setCarrierName(e.target.value)}
                    className="mt-1 min-h-[44px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
              >
                <span>确认到货签到并进入待收料初收</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-slate-600">
                <div className="text-sm font-semibold text-slate-900">
                  {activeAsn.asnNo} 已完成到货签到
                </div>
                <p className="mt-0.5">
                  当前处于「{ASN_STAGE_META[currentStage].step}. {ASN_STAGE_META[currentStage].label}」。
                  {canCrossNavigateStage('arrival', currentStage)
                    ? '可直接进入仓库「2. 待收料初收」继续作业。'
                    : '该单已转入后续工序。'}
                </p>
              </div>
              {canCrossNavigateStage('arrival', currentStage) && (
                <button
                  type="button"
                  onClick={() =>
                    onAdvanceStagePage?.(stageTargetNav(currentStage), activeAsn.asnNo, '')
                  }
                  className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 whitespace-nowrap"
                >
                  <span>进入 {stageTargetLabel(currentStage)}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          )
        )}

        {pageMode === 'receive' && !stageIsReceiving && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-slate-600">
              <div className="text-sm font-semibold text-slate-900">
                {stageNeedsArrival
                  ? `${activeAsn.asnNo} 尚未完成供应商到货签到`
                  : stageIsIqc
                    ? `${activeAsn.asnNo} 初步收料已完成，已通知 IQC 品质部检验`
                    : `${activeAsn.asnNo} 已完成初步收料`}
              </div>
              <p className="mt-0.5">
                {stageNeedsArrival
                  ? '请先执行仓库到货签到登记送货单，签到后将自动进入本页开启扫码初收。'
                  : stageIsIqc
                    ? '职权分离：仓库仅负责初步点收与报检通知，等待 IQC 品质部独立检验放行后，合格物料将自动出现在「3. 合格品入库上架」。'
                    : '该单已完成收料登记。'}
              </p>
            </div>
            {canCrossNavigateStage('receive', currentStage) ? (
              <button
                type="button"
                onClick={() =>
                  onAdvanceStagePage?.(stageTargetNav(currentStage), activeAsn.asnNo, '')
                }
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 whitespace-nowrap"
              >
                <span>前往 {stageTargetLabel(currentStage)}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <div className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 whitespace-nowrap">
                <BellRing className="h-3.5 w-3.5 shrink-0" />
                <span>已通知 IQC · 等待放行</span>
              </div>
            )}
          </div>
        )}

        {pageMode === 'receive' && stageIsReceiving && (
          <div className="space-y-3">
            {/* Primary Continuous 2D Carton Barcode Scan Form */}
            <form onSubmit={handleReceivingScanSubmit}>
              <PdaScanField
                id="pda-carton-scan"
                inputRef={scanInputRef}
                title="扫箱上二维码初步点收登记"
                subtitle="仓库只核收实到数量 · 全部收齐后自动发送报检通知至【IQC 品质部】"
                ariaLabel="扫描外箱二维码"
                value={scanCode}
                onChange={(val) => {
                  setScanCode(val);
                  if (error) setError(null);
                }}
                placeholder="扫描箱上二维码 (如 P:STM32F407VET6|L:ST2646A1|D:2646|Q:500) 后回车..."
                actionLabel={busy ? '核收中...' : '扫码自动匹配'}
                actionDisabled={busy || !scanCode.trim()}
                feedback={
                  error
                    ? { type: 'error', message: error }
                    : feedback
                      ? { type: 'success', message: feedback }
                      : null
                }
                helperHint={
                  parsedPreview && (parsedPreview.mpn || parsedPreview.qty) ? (
                    <span className="font-mono text-xs text-slate-600">
                      实时解析：料号 {parsedPreview.mpn ?? '-'} · 数量 {parsedPreview.qty ?? '-'} · 批次{' '}
                      {parsedPreview.lotNumber ?? '-'} · D/C {parsedPreview.dateCode ?? '-'}
                      {parsedPreview.matchedRuleName ? ` · 规则 ${parsedPreview.matchedRuleName}` : ''}
                    </span>
                  ) : undefined
                }
                quickItemsLabel="快捷模拟扫箱码："
                quickItems={activeAsn.lines
                  .filter((l) => l.receivedQty < l.expectedQty)
                  .map((line) => {
                    const rem = Math.max(1, line.expectedQty - line.receivedQty);
                    const halfOrRem = rem > 400 ? Math.ceil(rem / 2) : rem;
                    const sampleQr = `P:${line.mpn}|L:${line.lotNumber || 'LOT2646'}|D:${line.dateCode || '2646'}|Q:${halfOrRem}`;
                    return {
                      key: line.lineId,
                      label: `扫 ${line.mpn} ×${halfOrRem}`,
                      disabled: busy,
                      onClick: () => executeReceivingScan({ rawBarcode: sampleQr }),
                    };
                  })}
                trailingControl={
                  <button
                    type="button"
                    aria-expanded={manualOpen}
                    onClick={() => setManualOpen((v) => !v)}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                  >
                    <Keyboard className="h-3.5 w-3.5 text-slate-500" />
                    {manualOpen ? '收起人工录入' : '无箱码？人工录入'}
                  </button>
                }
              />
            </form>

            {/* Manual Fallback Panel when carton has no 2D barcode */}
            {manualOpen && (
              <form
                onSubmit={handleManualReceiveSubmit}
                className="rounded-md border border-slate-200 bg-slate-50 p-3.5 space-y-3"
              >
                <div className="text-xs font-semibold text-slate-800">
                  无二维码人工补录（直接匹配当前 ASN 明细行）
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                  <div className="sm:col-span-5">
                    <label htmlFor="manual-asn-line" className="block text-xs font-medium text-slate-700">
                      选择 ASN 物料 / 输入料号
                    </label>
                    <select
                      id="manual-asn-line"
                      value={manualLineId}
                      onChange={(e) => {
                        const line = activeAsn.lines.find((l) => l.lineId === e.target.value);
                        setManualLineId(e.target.value);
                        if (line) {
                          setManualSkuOrMpn(line.mpn);
                          setManualQty(String(Math.max(1, line.expectedQty - line.receivedQty)));
                          setManualLot(line.lotNumber ?? '');
                          setManualDc(line.dateCode ?? '2646');
                        }
                      }}
                      className="mt-1 min-h-[44px] w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 font-mono text-xs text-slate-900"
                    >
                      {activeAsn.lines.map((l) => (
                        <option key={l.lineId} value={l.lineId}>
                          {l.mpn} ({l.skuCode}) · 余 {Math.max(0, l.expectedQty - l.receivedQty)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="manual-qty" className="block text-xs font-medium text-slate-700">
                      本次数量
                    </label>
                    <input
                      id="manual-qty"
                      type="number"
                      min={1}
                      required
                      value={manualQty}
                      onChange={(e) => setManualQty(e.target.value)}
                      className="mt-1 min-h-[44px] w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 font-mono text-sm tabular-nums text-slate-900"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label htmlFor="manual-lot" className="block text-xs font-medium text-slate-700">
                      批次 Lot
                    </label>
                    <input
                      id="manual-lot"
                      type="text"
                      value={manualLot}
                      onChange={(e) => setManualLot(e.target.value)}
                      placeholder="如 ST2646A1"
                      className="mt-1 min-h-[44px] w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 font-mono text-xs text-slate-900"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="manual-dc" className="block text-xs font-medium text-slate-700">
                      周期 D/C
                    </label>
                    <input
                      id="manual-dc"
                      type="text"
                      maxLength={4}
                      value={manualDc}
                      onChange={(e) => setManualDc(e.target.value)}
                      className="mt-1 min-h-[44px] w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 font-mono text-xs text-slate-900"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={busy}
                    className="min-h-[44px] w-full sm:w-auto rounded-md bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    确认人工收货并更新数量
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {pageMode === 'iqc' && !stageIsIqc && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-slate-600">
              <div className="text-sm font-semibold text-slate-900">
                {stageNeedsArrival || stageIsReceiving
                  ? `${activeAsn.asnNo} 尚未收到仓库初收报检通知`
                  : `${activeAsn.asnNo} 已完成 IQC 质检判定并通知仓库`}
              </div>
              <p className="mt-0.5">
                {stageNeedsArrival || stageIsReceiving
                  ? '职权分离：需等待仓库部完成初步收料点收并发送报检通知后，才可启动 IQC 质检。'
                  : stageIsPutaway
                    ? '职权分离：IQC 已放行并通知仓库部入库，后续库位上架由仓库人员独立完成。'
                    : '该批次已完成全流程质检与仓库入库归档，当前仅供品质追溯查阅。'}
              </p>
            </div>
            <div
              className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium whitespace-nowrap ${
                stageNeedsArrival || stageIsReceiving
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800'
              }`}
            >
              {stageNeedsArrival || stageIsReceiving ? (
                <BellRing className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              )}
              <span>
                {stageNeedsArrival || stageIsReceiving
                  ? '等待仓库报检通知'
                  : stageIsPutaway
                    ? '已放行通知仓库'
                    : '质检已归档'}
              </span>
            </div>
          </div>
        )}

        {pageMode === 'iqc' && stageIsIqc && (
          <div className="space-y-3">
            <form onSubmit={handleIqcScanSubmit}>
              <PdaScanField
                id="pda-iqc-scan"
                inputRef={scanInputRef}
                title="来料 IQC 独立质检判定"
                subtitle="扫箱码执行合格放行或不良隔离 · 判定完自动发送通知至【仓库部】执行入库"
                ariaLabel="扫描待检物料箱码或料号"
                headerExtra={
                  <div className="inline-flex rounded-md border border-slate-200 bg-slate-100 p-0.5">
                    <button
                      type="button"
                      onClick={() => setIqcResult('PASSED')}
                      className={`min-h-[34px] rounded px-2.5 text-xs font-medium ${
                        iqcResult === 'PASSED'
                          ? 'bg-white font-semibold text-emerald-700 shadow-sm'
                          : 'text-slate-600'
                      }`}
                    >
                      IQC 合格放行
                    </button>
                    <button
                      type="button"
                      onClick={() => setIqcResult('FAILED')}
                      className={`min-h-[34px] rounded px-2.5 text-xs font-medium ${
                        iqcResult === 'FAILED'
                          ? 'bg-white font-semibold text-red-700 shadow-sm'
                          : 'text-slate-600'
                      }`}
                    >
                      IQC 不良隔离
                    </button>
                  </div>
                }
                value={scanCode}
                onChange={(val) => {
                  setScanCode(val);
                  if (error) setError(null);
                }}
                placeholder="扫描已收料箱码 / MPN 执行 IQC 判定，或点下方清单一键放行..."
                actionLabel={
                  busy
                    ? '判定中...'
                    : iqcResult === 'FAILED'
                      ? '扫码判定不良'
                      : '扫码判定合格'
                }
                actionTone={iqcResult === 'FAILED' ? 'red' : 'emerald'}
                actionDisabled={busy || !scanCode.trim()}
                feedback={
                  error
                    ? { type: 'error', message: error }
                    : feedback
                      ? { type: 'success', message: feedback }
                      : null
                }
                quickItemsLabel="快捷抽检："
                quickItems={activeAsn.lines
                  .filter(
                    (l) => (l.iqcPassedQty ?? 0) + (l.iqcRejectedQty ?? 0) < l.receivedQty
                  )
                  .map((line) => {
                    const rem = Math.max(
                      0,
                      line.receivedQty -
                        ((line.iqcPassedQty ?? 0) + (line.iqcRejectedQty ?? 0))
                    );
                    return {
                      key: line.lineId,
                      label: `${iqcResult === 'FAILED' ? '判不良' : '判合格'} ${line.mpn} ×${rem}`,
                      disabled: busy,
                      onClick: () =>
                        executeIqcInspect({
                          lineId: line.lineId,
                          result: iqcResult,
                          qty: rem,
                        }),
                    };
                  })}
              />
            </form>

            {/* Partial Pass / Reject Split Form */}
            {iqcSplitOpen && (
              <form
                onSubmit={handleIqcSplitSubmit}
                className="rounded-md border border-amber-200 bg-amber-50/40 p-3.5 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-slate-900">
                    抽检拆分判定（合格放行 + 不良隔离）
                  </div>
                  <button
                    type="button"
                    onClick={() => setIqcSplitOpen(false)}
                    className="text-xs text-slate-500 hover:text-slate-900"
                  >
                    取消
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-12">
                  <div className="sm:col-span-3">
                    <label htmlFor="iqc-pass-qty" className="block text-xs font-medium text-emerald-800">
                      合格放行数量
                    </label>
                    <input
                      id="iqc-pass-qty"
                      type="number"
                      min={0}
                      value={iqcPassedInput}
                      onChange={(e) => setIqcPassedInput(e.target.value)}
                      className="mt-1 min-h-[42px] w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-sm tabular-nums text-slate-900"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label htmlFor="iqc-fail-qty" className="block text-xs font-medium text-red-700">
                      不良隔离数量
                    </label>
                    <input
                      id="iqc-fail-qty"
                      type="number"
                      min={0}
                      value={iqcRejectedInput}
                      onChange={(e) => setIqcRejectedInput(e.target.value)}
                      className="mt-1 min-h-[42px] w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-sm tabular-nums text-slate-900"
                    />
                  </div>
                  <div className="sm:col-span-6">
                    <label htmlFor="iqc-note" className="block text-xs font-medium text-slate-700">
                      IQC 检验记录 / 不良原因 (可选)
                    </label>
                    <input
                      id="iqc-note"
                      type="text"
                      value={iqcNote}
                      onChange={(e) => setIqcNote(e.target.value)}
                      placeholder="如 AQL抽检合格 / 引脚氧化退供"
                      className="mt-1 min-h-[42px] w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={busy}
                    className="min-h-[42px] w-full sm:w-auto rounded-md bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    确认提交 IQC 拆分判定
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {pageMode === 'putaway' && !stageIsPutaway && !stageIsSynced && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-slate-600">
              <div className="text-sm font-semibold text-slate-900">
                {activeAsn.asnNo} 尚未获得 IQC 品质部检验放行，禁止入库上架
              </div>
              <p className="mt-0.5">
                职权分离：请等待 IQC 品质部完成检验判定并发送放行通知，放行后合格物料将自动解锁入库。
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 whitespace-nowrap">
              <BellRing className="h-3.5 w-3.5 shrink-0" />
              <span>等待 IQC 放行通知</span>
            </div>
          </div>
        )}

        {pageMode === 'putaway' && stageIsPutaway && (
          <form onSubmit={handlePutawayScanSubmit}>
            <PdaScanField
              id="pda-putaway-scan"
              inputRef={scanInputRef}
              title="IQC 合格品扫码入库上架并绑定库位"
              subtitle="仅展示 IQC 已检验合格放行的物料 · 上架后自动生成 UID 并更新库存"
              ariaLabel="扫描待上架物料条码"
              value={scanCode}
              onChange={(val) => {
                setScanCode(val);
                if (error) setError(null);
              }}
              placeholder="扫描物料 MPN / 箱码确认上架..."
              leadingControl={
                <div>
                  <label htmlFor="pda-putaway-bin" className="sr-only">
                    上架目标库位
                  </label>
                  <select
                    id="pda-putaway-bin"
                    value={putawayBin}
                    onChange={(e) => setPutawayBin(e.target.value)}
                    className="min-h-[48px] w-full sm:w-52 rounded-md border border-slate-300 bg-white px-2.5 py-2 font-mono text-xs text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15"
                  >
                    {state.bins.map((b) => (
                      <option key={b.binCode} value={b.binCode}>
                        {b.binCode} ({b.zone})
                      </option>
                    ))}
                  </select>
                </div>
              }
              actionLabel="扫码确认上架"
              actionDisabled={busy || !scanCode.trim()}
              feedback={
                error
                  ? { type: 'error', message: error }
                  : feedback
                    ? {
                        type: 'success',
                        message: feedback,
                        action: lastPutawayReel ? (
                          <button
                            type="button"
                            onClick={() => onOpenLabel(lastPutawayReel)}
                            className="inline-flex min-h-[32px] items-center gap-1 rounded border border-emerald-300 bg-white px-2.5 py-0.5 text-xs font-medium text-emerald-900 hover:bg-emerald-100 whitespace-nowrap"
                          >
                            <Barcode className="h-3.5 w-3.5" />
                            打印 {lastPutawayReel.reelId}
                          </button>
                        ) : undefined,
                      }
                    : null
              }
            />
          </form>
        )}

        {pageMode === 'putaway' && stageIsSynced && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <ClipboardCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    {classifiedLines.length === 0 && totalIqcRejectedQty > 0
                      ? 'IQC 整批判定不良隔离 · 已退供回传（无合格品入库）'
                      : '步骤 6-7：库存已更新 · 收料信息已同步回传'}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    同步通道：{activeAsn.syncChannel ?? 'ERP/MES 实时回传'} · 同步流水：
                    <span className="font-mono font-medium text-slate-700">
                      {activeAsn.syncRefNo ?? '已自动入账'}
                    </span>
                    {activeAsn.syncedAt ? ` · ${formatTime(activeAsn.syncedAt)}` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={handleManualResync}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                重新推送信息同步
              </button>
            </div>

            {asnReels.length > 0 && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {asnReels.map((reel) => (
                  <div
                    key={reel.reelId}
                    className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-mono font-semibold text-slate-900 truncate">
                        {reel.reelId} · {reel.mpn}
                      </div>
                      <div className="font-mono text-[11px] text-slate-500">
                        库存 +{reel.initialQty.toLocaleString()} · 库位 {reel.binCode} · D/C {reel.dateCode}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onOpenLabel(reel)}
                        className="min-h-[38px] rounded border border-teal-200 bg-white px-2.5 py-1 font-medium text-teal-800 hover:bg-teal-50"
                      >
                        打印
                      </button>
                      <button
                        type="button"
                        onClick={() => onInspectTrace(reel.reelId)}
                        className="min-h-[38px] rounded border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-100"
                      >
                        追溯
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Bottom 3-Tab Progress List: 已刷 (default) / 作业中 / 未刷 */}
      <section className="mes-panel overflow-hidden rounded-lg">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/90 bg-white px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              {displayStage === 'IQC_INSPECTION'
                ? 'IQC 来料质检进度清单'
                : displayStage === 'PUTAWAY'
                  ? '合格品入库上架进度清单'
                  : displayStage === 'INFO_SYNCED' || displayStage === 'INVENTORY_UPDATED'
                    ? '入库完结核对清单'
                    : '仓库初收登记扫码清单'}
            </h3>
            <p className="text-[11px] text-slate-500">
              下方按「已刷 / 作业中 / 未刷」实时分组（默认显示已刷），作业完成自动流转下一状态
            </p>
          </div>
          <div className="font-mono text-xs text-slate-600 tabular-nums">
            {isPutawayOrPostStage
              ? `共 ${classifiedLines.length} 行合格品${
                  fullyRejectedLinesCount > 0 ? ` · 已剔除不良 ${fullyRejectedLinesCount} 行` : ''
                }`
              : `共 ${activeAsn.lines.length} 行物料`}
          </div>
        </div>

        {isPutawayOrPostStage && iqcRejectedLines.length > 0 && (
          <div
            role="note"
            className="border-b border-red-200 bg-red-50/70 px-4 py-2.5 text-xs text-red-900"
          >
            <div className="font-semibold text-red-800">
              已拦截 IQC 不良隔离物料（共 {totalIqcRejectedQty.toLocaleString()} PCS，严禁入库上架，已转退供/MRB处理）
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[11px] text-red-700">
              {iqcRejectedLines.map((rl) => (
                <span key={rl.lineId}>
                  {rl.mpn} 不良 {(rl.iqcRejectedQty ?? 0).toLocaleString()}
                  {(rl.iqcPassedQty ?? 0) <= 0 ? ' (整行拦截·不入库)' : ' (仅合格部分入库)'}
                  {rl.iqcNote ? ` [${rl.iqcNote}]` : ''}
                </span>
              ))}
            </div>
          </div>
        )}

        <ScanProgressTabs
          activeBucket={activeBucket}
          onChange={setActiveBucket}
          counts={bucketCounts}
          ariaLabel="ASN作业进度状态标签页"
        />

        <div className="divide-y divide-slate-100">
          {visibleLines.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <div className="text-sm font-medium text-slate-700">
                {isPutawayOrPostStage && classifiedLines.length === 0
                  ? '该单无 IQC 合格放行物料，无需入库上架'
                  : activeBucket === 'SCANNED'
                    ? '暂无「已刷」完成的物料行'
                    : activeBucket === 'IN_PROGRESS'
                      ? '暂无「作业中」部分完成的物料行'
                      : '所有合格物料均已完成当前环节作业'}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {activeBucket === 'SCANNED' && bucketCounts.UNSCANNED + bucketCounts.IN_PROGRESS > 0
                  ? displayStage === 'IQC_INSPECTION'
                    ? '切换到「未刷」点击合格/不良，或在上方扫箱码完成 IQC 质检判定'
                    : '在上方直接扫箱上二维码后，完成的料号会自动归入「已刷」清单'
                  : '可点击上方标签切换查看其他分组明细'}
              </p>
              {activeBucket === 'SCANNED' && bucketCounts.UNSCANNED > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveBucket('UNSCANNED')}
                  className="mt-3 min-h-[44px] rounded-md border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:border-teal-300 hover:bg-teal-50/40 hover:text-teal-800"
                >
                  查看「未刷 ({bucketCounts.UNSCANNED})」待作业清单
                </button>
              )}
              {activeBucket === 'SCANNED' &&
                bucketCounts.UNSCANNED === 0 &&
                bucketCounts.IN_PROGRESS > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveBucket('IN_PROGRESS')}
                    className="mt-3 min-h-[44px] rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800 hover:bg-amber-100"
                  >
                    查看「作业中 ({bucketCounts.IN_PROGRESS})」明细
                  </button>
                )}
            </div>
          ) : (
            visibleLines.map(({ line, metrics }) => {
              const pct =
                metrics.targetQty > 0
                  ? Math.min(100, Math.round((metrics.doneQty / metrics.targetQty) * 100))
                  : 100;
              const lineReels = asnReels.filter((r) => r.skuCode === line.skuCode);

              return (
                <div
                  key={line.lineId}
                  className="px-4 py-3.5 transition-colors hover:bg-slate-50/70"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono text-sm font-bold text-slate-900 truncate">
                        {line.mpn}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                        <span className="font-mono">{line.skuCode}</span>
                        <span className="text-slate-300">·</span>
                        <span>Lot {line.lotNumber || '待扫'}</span>
                        <span className="text-slate-300">·</span>
                        <span className="font-mono">D/C {line.dateCode || '-'}</span>
                        <span className="text-slate-300">·</span>
                        <span className="font-mono text-slate-700">
                          库位 {line.targetBin || '-'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono text-sm font-bold tabular-nums text-slate-900">
                        <span
                          className={
                            metrics.bucket === 'SCANNED'
                              ? 'text-emerald-700'
                              : metrics.bucket === 'IN_PROGRESS'
                                ? 'text-amber-700'
                                : 'text-slate-900'
                          }
                        >
                          {metrics.doneQty.toLocaleString()}
                        </span>
                        <span className="text-slate-400">
                          {' '}
                          / {metrics.targetQty.toLocaleString()}
                        </span>
                      </div>
                      <div className="text-[11px] font-medium text-slate-500">
                        {metrics.bucket === 'SCANNED'
                          ? displayStage === 'PUTAWAY' || displayStage === 'INFO_SYNCED' || displayStage === 'INVENTORY_UPDATED'
                            ? '已上架入库'
                            : displayStage === 'IQC_INSPECTION'
                              ? (line.iqcRejectedQty ?? 0) > 0 && (line.iqcPassedQty ?? 0) === 0
                                ? 'IQC 判定不良隔离'
                                : 'IQC 质检完成'
                              : currentStage === 'IQC_INSPECTION'
                                ? '已点收齐 · 已通知 IQC'
                                : '已点收齐 · 待初收齐报检'
                          : metrics.bucket === 'IN_PROGRESS'
                            ? `作业中 · 余 ${metrics.remainingQty.toLocaleString()}`
                            : displayStage === 'IQC_INSPECTION'
                              ? `待IQC质检 ${metrics.remainingQty.toLocaleString()}`
                              : `未刷 · 待收 ${metrics.remainingQty.toLocaleString()}`}
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full transition-all ${
                        metrics.bucket === 'SCANNED'
                          ? 'bg-emerald-600'
                          : metrics.bucket === 'IN_PROGRESS'
                            ? 'bg-amber-500'
                            : 'bg-slate-300'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {/* Line Actions Row */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="font-mono text-[11px] text-slate-500">
                      扫码 {line.scanCount ?? 0} 次
                      {line.lastScannedAt ? ` · 最近 ${formatTime(line.lastScannedAt).slice(5)}` : ''}
                      {(line.iqcPassedQty ?? 0) > 0 && (
                        <span className="ml-2 text-emerald-700 font-semibold">
                          合格 {line.iqcPassedQty}
                        </span>
                      )}
                      {(line.iqcRejectedQty ?? 0) > 0 && (
                        <span className="ml-2 text-red-600 font-semibold">
                          {isPutawayOrPostStage
                            ? `已隔离不良 ${line.iqcRejectedQty}(不入库)`
                            : `不良 ${line.iqcRejectedQty}`}
                        </span>
                      )}
                      {line.iqcNote && (
                        <span className="ml-2 text-slate-600">({line.iqcNote})</span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {pageMode === 'receive' &&
                        currentStage === 'RECEIVING' &&
                        metrics.remainingQty > 0 && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => openManualForLine(line)}
                            className="min-h-[40px] rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            无码人工录入
                          </button>
                        )}

                      {pageMode === 'iqc' &&
                        currentStage === 'IQC_INSPECTION' &&
                        metrics.remainingQty > 0 && (
                          <>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                executeIqcInspect({
                                  lineId: line.lineId,
                                  result: 'PASSED',
                                  qty: metrics.remainingQty,
                                })
                              }
                              className="min-h-[40px] rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                            >
                              整行合格 ({metrics.remainingQty})
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => openIqcSplitForLine(line)}
                              className="min-h-[40px] rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                            >
                              拆分不良
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                executeIqcInspect({
                                  lineId: line.lineId,
                                  result: 'FAILED',
                                  qty: metrics.remainingQty,
                                })
                              }
                              className="min-h-[40px] rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                            >
                              整行不良
                            </button>
                          </>
                        )}

                      {pageMode === 'putaway' &&
                        currentStage === 'PUTAWAY' &&
                        metrics.remainingQty > 0 && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              executePutaway({
                                lineId: line.lineId,
                                binCode: line.targetBin || putawayBin,
                                qty: metrics.remainingQty,
                              })
                            }
                            className="min-h-[44px] rounded-md bg-teal-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                          >
                            确认上架 ({line.targetBin || putawayBin} · {metrics.remainingQty})
                          </button>
                        )}

                      {lineReels.length > 0 && (
                        <button
                          type="button"
                          onClick={() => onOpenLabel(lineReels[0])}
                          className="inline-flex min-h-[40px] items-center gap-1 rounded-md border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-800 hover:bg-teal-100"
                        >
                          <Barcode className="h-3.5 w-3.5" />
                          打印 UID ({lineReels[0].reelId})
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
