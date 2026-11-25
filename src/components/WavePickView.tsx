import { ArrowRight, Layers, PackageMinus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ScanTabBucket, WmsState } from '../types/wms';
import { completePdaScan, focusScanInputOnMount, scheduleScanInputFocus } from '../utils/pdaScanFocus';
import { classifyScanBucket, computeWorkOrderKitting, parseBarcodeString } from '../utils/wmsLogic';
import { PdaScanField } from './PdaScanField';
import { ScanProgressTabs } from './ScanProgressTabs';
import type { NavKey } from './Sidebar';

export type WavePageMode = 'wavePlan' | 'wavePick' | 'generalOutbound';

interface WavePickViewProps {
  pageMode: WavePageMode;
  state: WmsState;
  onNavigate?: (nav: NavKey) => void;
  onCreateWave: (payload: {
    name: string;
    workOrderIds: string[];
    operator: string;
  }) => Promise<{ shortages: { skuCode: string; mpn: string; shortageQty: number }[] }>;
  onIssueWaveReel: (waveId: string, reelId: string, operator: string) => Promise<void>;
  onGeneralOutbound: (payload: {
    reelId: string;
    qty: number;
    targetDept: string;
    reason: string;
    operator: string;
  }) => Promise<void>;
}

export function WavePickView({
  pageMode,
  state,
  onNavigate,
  onCreateWave,
  onIssueWaveReel,
  onGeneralOutbound,
}: WavePickViewProps) {
  const [selectedWos, setSelectedWos] = useState<string[]>(() =>
    state.workOrders.filter((w) => w.status === 'PLANNED').map((w) => w.workOrderId)
  );
  const [waveName, setWaveName] = useState('SMT早班合并发料波次');
  const [operator, setOperator] = useState('李敏 (SMT发料员)');
  const [activeWaveId, setActiveWaveId] = useState<string>(state.waves[0]?.waveId ?? '');
  const [scanReelInput, setScanReelInput] = useState('');
  const [waveBucket, setWaveBucket] = useState<ScanTabBucket>('SCANNED');
  const scanInputRef = useRef<HTMLInputElement>(null);
  const [waveError, setWaveError] = useState<string | null>(null);
  const [waveNotice, setWaveNotice] = useState<string | null>(null);
  const [shortages, setShortages] = useState<
    { skuCode: string; mpn: string; shortageQty: number }[]
  >([]);

  // General outbound state
  const [outReelId, setOutReelId] = useState(
    state.reels.find((r) => r.status === 'IN_STOCK' && r.msdState !== 'BAKING_REQUIRED')?.reelId ?? ''
  );
  const outScanInputRef = useRef<HTMLInputElement>(null);
  const [outQty, setOutQty] = useState('50');
  const [targetDept, setTargetDept] = useState('NPI工程试产线');
  const [outReason, setOutReason] = useState('打样验证领料出库');
  const [outError, setOutError] = useState<string | null>(null);
  const [outSuccess, setOutSuccess] = useState<string | null>(null);

  const toggleWo = (woId: string) => {
    setSelectedWos((prev) =>
      prev.includes(woId) ? prev.filter((id) => id !== woId) : [...prev, woId]
    );
  };

  const handleGenerateWave = async () => {
    setWaveError(null);
    setWaveNotice(null);
    try {
      const res = await onCreateWave({
        name: waveName,
        workOrderIds: selectedWos,
        operator,
      });
      setShortages(res.shortages);
      setWaveNotice('波次发料单已生成，已按周期(DateCode)严格FIFO锁定最优料盘。');
      setSelectedWos([]);
    } catch (err) {
      setWaveError(err instanceof Error ? err.message : '生成波次失败');
    }
  };

  const currentWave =
    state.waves.find((w) => w.waveId === activeWaveId) ?? state.waves[0] ?? null;

  useEffect(() => {
    if (pageMode === 'wavePick' && currentWave) {
      focusScanInputOnMount(scanInputRef);
    } else if (pageMode === 'generalOutbound') {
      focusScanInputOnMount(outScanInputRef);
    }
  }, [pageMode, currentWave?.waveId]);

  const handleScanIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWave || !scanReelInput.trim()) return;
    setWaveError(null);
    setWaveNotice(null);
    const raw = scanReelInput.trim();
    const parsed = parseBarcodeString(raw, state.barcodeRules);
    const targetReelId = parsed.reelId || raw;
    try {
      await onIssueWaveReel(currentWave.waveId, targetReelId, operator);
      setWaveNotice(`扫码发料成功: ${targetReelId} 已出库至 SMT 线边仓`);
      completePdaScan({
        currentValue: scanReelInput,
        setValue: setScanReelInput,
        inputRef: scanInputRef,
        outcome: 'success',
      });
    } catch (err) {
      setWaveError(err instanceof Error ? err.message : '扫码发料拦截');
      completePdaScan({
        currentValue: scanReelInput,
        setValue: setScanReelInput,
        inputRef: scanInputRef,
        outcome: 'error',
      });
    }
  };

  const handleConfirmRowIssue = async (reelId: string) => {
    if (!currentWave) return;
    setWaveError(null);
    setWaveNotice(null);
    try {
      await onIssueWaveReel(currentWave.waveId, reelId, operator);
      setWaveNotice(`已确认发料: ${reelId} -> 产线线边仓`);
      scheduleScanInputFocus(scanInputRef, 'success');
    } catch (err) {
      setWaveError(err instanceof Error ? err.message : '发料失败');
      scheduleScanInputFocus(scanInputRef, 'error');
    }
  };

  const handleGeneralReelChange = (raw: string) => {
    if (outError) setOutError(null);
    if (raw.includes('|') || raw.includes(';') || raw.includes(',') || /^UID:/i.test(raw.trim())) {
      const parsed = parseBarcodeString(raw.trim(), state.barcodeRules);
      if (parsed.reelId) {
        setOutReelId(parsed.reelId);
        return;
      }
    }
    setOutReelId(raw);
  };

  const handleGeneralSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOutError(null);
    setOutSuccess(null);
    const trimmed = outReelId.trim();
    try {
      await onGeneralOutbound({
        reelId: trimmed,
        qty: Number(outQty),
        targetDept,
        reason: outReason,
        operator,
      });
      setOutSuccess(`出库完成: ${trimmed} 扣减 ${outQty}，已记录追溯流水`);
      completePdaScan({
        currentValue: outReelId,
        setValue: setOutReelId,
        inputRef: outScanInputRef,
        outcome: 'success',
      });
    } catch (err) {
      setOutError(err instanceof Error ? err.message : '出库失败');
      completePdaScan({
        currentValue: outReelId,
        setValue: setOutReelId,
        inputRef: outScanInputRef,
        outcome: 'error',
      });
    }
  };

  const eligibleWos = state.workOrders.filter((w) => w.status === 'PLANNED');
  const inStockReels = state.reels.filter(
    (r) => r.status === 'IN_STOCK' && r.msdState !== 'BAKING_REQUIRED' && r.qty > 0
  );
  const selectedOutReel = state.reels.find((r) => r.reelId === outReelId.trim());

  if (pageMode === 'wavePlan') {
    return (
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left: Create Wave from Work Orders */}
        <section className="mes-panel p-5 xl:col-span-6">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3.5">
            <Layers className="h-4 w-4 text-teal-700" />
            <h2 className="text-sm font-semibold text-slate-900">
              合并工单生成 FIFO 波次单
            </h2>
          </div>

            <div className="mt-4 space-y-3">
              <div>
                <label htmlFor="wave-name" className="block text-xs font-medium text-slate-700">
                  波次名称
                </label>
                <input
                  id="wave-name"
                  type="text"
                  value={waveName}
                  onChange={(e) => setWaveName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div>
                <div className="text-xs font-medium text-slate-700">选择待发料工单</div>
                <div className="mt-2 space-y-2">
                  {eligibleWos.length === 0 ? (
                    <div className="rounded-md border border-dashed border-slate-200 px-4 py-5 text-center text-xs text-slate-500">
                      当前所有计划工单均已进入波次或生产中，可在右侧执行扫码发料或在「库存与主数据」新建工单。
                    </div>
                  ) : (
                    eligibleWos.map((wo) => {
                      const kitting = computeWorkOrderKitting(wo, state.reels, state.materials);
                      const checked = selectedWos.includes(wo.workOrderId);
                      return (
                        <label
                          key={wo.workOrderId}
                          className={`flex cursor-pointer items-start justify-between gap-3 rounded-md border p-3 transition-colors ${
                            checked
                              ? 'border-teal-300 bg-teal-50/50'
                              : 'border-slate-200 bg-white hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleWo(wo.workOrderId)}
                              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                            />
                            <div>
                              <div className="font-mono text-xs font-semibold text-slate-900">
                                {wo.workOrderId}
                              </div>
                              <div className="text-xs text-slate-700">
                                {wo.productName} · {wo.targetQty} PCS
                              </div>
                              <div className="text-[11px] text-slate-500">
                                线别 {wo.lineName} · 客户 {wo.customerName || '内部通用'} · BOM{' '}
                                {wo.bom.length} 项
                              </div>
                            </div>
                          </div>
                          <span
                            className={`font-mono text-xs font-semibold tabular-nums ${
                              kitting.isFullyKitted ? 'text-emerald-700' : 'text-amber-700'
                            }`}
                          >
                            齐套 {kitting.readinessPercent}%
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <button
                type="button"
                disabled={selectedWos.length === 0}
                onClick={handleGenerateWave}
                className="w-full rounded-md bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-50"
              >
                生成波次并FIFO锁定料盘 ({selectedWos.length} 个工单)
              </button>

              {shortages.length > 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  <div className="font-semibold">波次存在部分缺料:</div>
                  <ul className="mt-1 list-disc pl-4 font-mono">
                    {shortages.map((s) => (
                      <li key={s.skuCode}>
                        {s.mpn} 缺 {s.shortageQty}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {waveNotice && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                  <span>{waveNotice}</span>
                  {onNavigate && (
                    <button
                      type="button"
                      onClick={() => onNavigate('wavePick')}
                      className="inline-flex min-h-[36px] items-center gap-1 rounded bg-emerald-700 px-3 py-1 font-semibold text-white hover:bg-emerald-800"
                    >
                      <span>进入波次扫码发料</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Right: Existing Waves List with 1-tap Jump to PDA Wave Pick */}
          <section className="mes-panel p-5 xl:col-span-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3.5">
              <h2 className="text-sm font-semibold text-slate-900">已生成波次任务列表</h2>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                共 {state.waves.length} 单
              </span>
            </div>
            {state.waves.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">
                暂无波次单，请在左侧勾选待发料工单后点击生成。
              </div>
            ) : (
              <div className="mt-4 space-y-2.5">
                {state.waves.map((w) => {
                  const picked = w.allocations.filter((a) => a.status === 'PICKED').length;
                  return (
                    <div
                      key={w.waveId}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 p-3.5"
                    >
                      <div>
                        <div className="font-mono text-xs font-semibold text-slate-900">
                          {w.waveId} · {w.name}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          工单 {w.workOrderIds.join(', ')} · 进度 {picked}/{w.allocations.length} 盘
                        </div>
                      </div>
                      {onNavigate && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveWaveId(w.waveId);
                            onNavigate('wavePick');
                          }}
                          className="inline-flex min-h-[40px] items-center gap-1 rounded-md bg-teal-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
                        >
                          <span>去 PDA 扫码发料</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
    );
  }

  if (pageMode === 'wavePick') {
    return (
      <section className="mes-panel">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 sm:px-5 sm:py-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900">
              波次扫码发料防错 (FIFO)
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              按最老周期(DateCode)引导扫料盘核销，扫错或跳FIFO自动拦截
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {state.waves.length > 0 && (
              <select
                aria-label="选择波次单"
                value={currentWave?.waveId ?? ''}
                onChange={(e) => setActiveWaveId(e.target.value)}
                className="min-h-[40px] rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900"
              >
                {state.waves.map((w) => (
                  <option key={w.waveId} value={w.waveId}>
                    {w.waveId} ({w.status === 'COMPLETED' ? '已完成' : '拣货中'})
                  </option>
                ))}
              </select>
            )}
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('wavePlan')}
                className="min-h-[40px] rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                新建波次
              </button>
            )}
          </div>
        </div>

        {!currentWave ? (
          <div className="px-6 py-10 text-center">
            <div className="text-sm font-semibold text-slate-900">暂无待拣货发料波次单</div>
            <p className="mt-1 text-xs text-slate-500">
              请先前往「波次排产建单」合并工单并按 FIFO 锁定发料料盘。
            </p>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('wavePlan')}
                className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800"
              >
                <span>前往波次排产建单</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="p-3.5 sm:p-5 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                  <div>
                    <span className="font-semibold text-slate-900">{currentWave.name}</span>
                    <span className="mx-2 text-slate-300">·</span>
                    <span>关联工单: {currentWave.workOrderIds.join(', ')}</span>
                  </div>
                  <span className="font-mono tabular-nums text-teal-700 font-semibold">
                    进度 {currentWave.allocations.filter((a) => a.status === 'PICKED').length} /{' '}
                    {currentWave.allocations.length} 盘
                  </span>
                </div>

                {/* Barcode Scan Issue Bar (Canonical PDA Scan Field) */}
                <form onSubmit={handleScanIssue}>
                  <PdaScanField
                    id="pda-wave-pick-scan"
                    inputRef={scanInputRef}
                    title="扫料盘 UID 核销发料"
                    subtitle="按最老周期(DateCode)严格 FIFO 核销出库，扫错自动拦截"
                    ariaLabel="扫描发料料盘UID"
                    value={scanReelInput}
                    onChange={(val) => {
                      setScanReelInput(val);
                      if (waveError) setWaveError(null);
                    }}
                    placeholder="扫描波次清单中的料盘 UID 条码确认发料出库..."
                    actionLabel="扫码核销发料"
                    actionDisabled={!scanReelInput.trim()}
                    feedback={
                      waveError
                        ? { type: 'error', message: waveError }
                        : waveNotice
                          ? { type: 'success', message: waveNotice }
                          : null
                    }
                    quickItemsLabel="待发料盘快捷扫码："
                    quickItems={currentWave.allocations
                      .filter((a) => a.status === 'PENDING')
                      .slice(0, 3)
                      .map((a) => ({
                        key: a.id,
                        label: `扫 ${a.reelId} (${a.binCode})`,
                        onClick: () => handleConfirmRowIssue(a.reelId),
                      }))}
                  />
                </form>

                {(() => {
                  const counts = { SCANNED: 0, IN_PROGRESS: 0, UNSCANNED: 0 };
                  const enriched = currentWave.allocations.map((alloc) => {
                    const bucket =
                      alloc.status === 'PICKED'
                        ? 'SCANNED'
                        : classifyScanBucket(alloc.pickedQty, alloc.requiredQty);
                    counts[bucket] += 1;
                    return { alloc, bucket };
                  });
                  const filtered = enriched.filter((x) => x.bucket === waveBucket);

                  return (
                    <div className="overflow-hidden rounded-md border border-slate-200">
                      <ScanProgressTabs
                        activeBucket={waveBucket}
                        onChange={setWaveBucket}
                        counts={counts}
                        ariaLabel="波次发料扫码状态标签页"
                      />

                      {filtered.length === 0 ? (
                        <div className="px-4 py-8 text-center">
                          <div className="text-xs font-medium text-slate-700">
                            {waveBucket === 'SCANNED'
                              ? '暂无「已刷」发料完成的料盘'
                              : waveBucket === 'IN_PROGRESS'
                                ? '暂无「作业中」部分发料的料盘'
                                : '本波次所有料盘均已发料完毕'}
                          </div>
                          {waveBucket === 'SCANNED' && counts.UNSCANNED > 0 && (
                            <button
                              type="button"
                              onClick={() => setWaveBucket('UNSCANNED')}
                              className="mt-2.5 min-h-[44px] rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              查看「未刷 ({counts.UNSCANNED})」待发料盘
                            </button>
                          )}
                        </div>
                      ) : (
                        <>
                          {/* Mobile PDA Touch Cards */}
                          <div className="divide-y divide-slate-100 md:hidden">
                            {filtered.map(({ alloc }) => (
                              <div key={alloc.id} className="p-3.5 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="font-mono text-sm font-bold text-teal-800">
                                      {alloc.binCode} · {alloc.reelId}
                                    </div>
                                    <div className="font-mono text-xs text-slate-900">
                                      {alloc.mpn}
                                    </div>
                                    <div className="font-mono text-[11px] text-slate-500">
                                      D/C {alloc.dateCode} · Lot {alloc.lotNumber}
                                    </div>
                                  </div>
                                  <div className="text-right font-mono tabular-nums">
                                    <div className="text-sm font-bold text-slate-900">
                                      {alloc.pickedQty.toLocaleString()}/{alloc.requiredQty.toLocaleString()}
                                    </div>
                                    <div
                                      className={`text-[11px] font-medium ${
                                        alloc.status === 'PICKED'
                                          ? 'text-emerald-700'
                                          : 'text-amber-700'
                                      }`}
                                    >
                                      {alloc.status === 'PICKED' ? '已发至线边' : '待扫码发料'}
                                    </div>
                                  </div>
                                </div>
                                {alloc.status === 'PENDING' && (
                                  <button
                                    type="button"
                                    onClick={() => handleConfirmRowIssue(alloc.reelId)}
                                    className="min-h-[44px] w-full rounded-md border border-teal-300 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-900 hover:bg-teal-100"
                                  >
                                    确认发料 ({alloc.reelId})
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Desktop Table */}
                          <div className="hidden overflow-x-auto md:block">
                            <table className="w-full text-left text-xs">
                              <thead className="border-b border-slate-200 bg-[#f8fafb] text-slate-500">
                                <tr>
                                  <th className="px-4 py-2 font-medium whitespace-nowrap">库位</th>
                                  <th className="px-3 py-2 font-medium whitespace-nowrap">料盘 UID</th>
                                  <th className="px-3 py-2 font-medium whitespace-nowrap">MPN / D/C</th>
                                  <th className="px-3 py-2 font-medium text-right whitespace-nowrap">应发数量</th>
                                  <th className="px-3 py-2 font-medium whitespace-nowrap">状态</th>
                                  <th className="px-4 py-2 font-medium text-right whitespace-nowrap">操作</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {filtered.map(({ alloc }) => (
                                  <tr key={alloc.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-2.5 font-mono font-semibold text-slate-900 whitespace-nowrap">
                                      {alloc.binCode}
                                    </td>
                                    <td className="px-3 py-2.5 font-mono text-teal-700 whitespace-nowrap">
                                      {alloc.reelId}
                                    </td>
                                    <td className="px-3 py-2.5">
                                      <div className="font-mono text-slate-900">{alloc.mpn}</div>
                                      <div className="font-mono text-[11px] text-slate-500">
                                        D/C {alloc.dateCode} · Lot {alloc.lotNumber} ·{' '}
                                        <span className={alloc.customerCode ? 'text-teal-700 font-sans font-medium' : 'font-sans'}>
                                          {alloc.customerName || '通用共享'}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-900 tabular-nums">
                                      {alloc.requiredQty.toLocaleString()}
                                    </td>
                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                      {alloc.status === 'PICKED' ? (
                                        <span className="font-medium text-emerald-700">已发至线边</span>
                                      ) : (
                                        <span className="font-medium text-amber-700">待扫码发料</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                      {alloc.status === 'PENDING' ? (
                                        <button
                                          type="button"
                                          onClick={() => handleConfirmRowIssue(alloc.reelId)}
                                          className="rounded border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800 hover:bg-teal-100"
                                        >
                                          扫码确认发料
                                        </button>
                                      ) : (
                                        <span className="font-mono text-slate-400">OK</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}
          </div>
        )}
      </section>
    );
  }

  /* General Non-WO Outbound */
  return (
    <section className="mes-panel max-w-2xl p-4 sm:p-6">
      <div className="flex items-center gap-2 border-b border-slate-200 pb-4">
        <PackageMinus className="h-4 w-4 text-teal-700" />
        <div>
          <h2 className="text-base font-semibold text-slate-900">其他领料出库 (非工单)</h2>
          <p className="text-xs text-slate-500">
            适用于工程打样、外协加工、研发借料或内部调拨出库
          </p>
        </div>
      </div>

      <form onSubmit={handleGeneralSubmit} className="mt-5 space-y-4">
        <div>
          <PdaScanField
            id="out-reel"
            inputRef={outScanInputRef}
            label="扫描或选择出库料盘 UID"
            subtitle="支持 PDA 直接扫描料盘条码 / 复合码，或点选下方在库料盘"
            value={outReelId}
            onChange={handleGeneralReelChange}
            list="general-outbound-reel-options"
            placeholder="扫描出库料盘 UID 或复合码..."
            feedback={
              outError
                ? { type: 'error', message: outError }
                : outSuccess
                  ? { type: 'success', message: outSuccess }
                  : null
            }
            helperHint={
              selectedOutReel ? (
                <span className="font-mono text-[11px] text-slate-500">
                  {selectedOutReel.mpn} · 库位 {selectedOutReel.binCode} · 余量{' '}
                  {selectedOutReel.qty.toLocaleString()} ·{' '}
                  {selectedOutReel.customerCode
                    ? `${selectedOutReel.customerName}专备`
                    : '通用共享'}
                </span>
              ) : undefined
            }
            quickItemsLabel="快捷点选："
            quickItems={inStockReels.slice(0, 3).map((r) => ({
              key: r.reelId,
              label: `${r.reelId} (${r.mpn})`,
              onClick: () => handleGeneralReelChange(r.reelId),
            }))}
          />
          <datalist id="general-outbound-reel-options">
            {inStockReels.map((r) => (
              <option key={r.reelId} value={r.reelId}>
                {r.mpn} | {r.customerCode ? `${r.customerName}专备` : '通用共享'} | 余量 {r.qty} | 库位 {r.binCode}
              </option>
            ))}
          </datalist>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="out-qty" className="block text-xs font-medium text-slate-700">
              出库数量
            </label>
            <input
              id="out-qty"
              type="number"
              min={1}
              required
              value={outQty}
              onChange={(e) => setOutQty(e.target.value)}
              className="mt-1.5 min-h-[44px] w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 tabular-nums focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15"
            />
          </div>

          <div>
            <label htmlFor="out-dept" className="block text-xs font-medium text-slate-700">
              领用部门 / 去向
            </label>
            <input
              id="out-dept"
              type="text"
              required
              value={targetDept}
              onChange={(e) => setTargetDept(e.target.value)}
              className="mt-1.5 min-h-[44px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15"
            />
          </div>
        </div>

        <div>
          <label htmlFor="out-reason" className="block text-xs font-medium text-slate-700">
            出库原因说明
          </label>
          <input
            id="out-reason"
            type="text"
            required
            value={outReason}
            onChange={(e) => setOutReason(e.target.value)}
            className="mt-1.5 min-h-[44px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15"
          />
        </div>

        <button
          type="submit"
          disabled={!outReelId.trim()}
          className="min-h-[48px] w-full sm:w-auto rounded-md bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
        >
          确认出库并扣减库存
        </button>
      </form>
    </section>
  );
}
