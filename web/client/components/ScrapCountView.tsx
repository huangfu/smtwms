import { ArrowRight, CheckCircle2, ClipboardCheck, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ScanTabBucket, WmsState } from '../../shared/types/wms';
import { formatTime } from '../../shared/domain/formatters';
import { completePdaScan, focusScanInputOnMount, scheduleScanInputFocus } from '../utils/pdaScanFocus';
import { parseBarcodeString } from '../../shared/domain/wmsLogic';
import { PdaScanField } from './PdaScanField';
import { ScanProgressTabs } from './ScanProgressTabs';
import type { NavKey } from './Sidebar';

export type ScrapCountPageMode = 'scrap' | 'countPlan' | 'cycleCount';

interface ScrapCountViewProps {
  pageMode: ScrapCountPageMode;
  state: WmsState;
  onNavigate?: (nav: NavKey) => void;
  onScrap: (payload: {
    reelId: string;
    qty: number;
    reason: string;
    disposition: string;
    workOrderId?: string;
    operator: string;
  }) => Promise<void>;
  onCreateCycleCount: (payload: { title: string; zoneFilter: string }) => Promise<void>;
  onReconcileCycleCount: (
    countId: string,
    payload: { counts: Record<string, number>; operator: string }
  ) => Promise<void>;
}

export function ScrapCountView({
  pageMode,
  state,
  onNavigate,
  onScrap,
  onCreateCycleCount,
  onReconcileCycleCount,
}: ScrapCountViewProps) {

  // Scrap form state
  const scrappableReels = state.reels.filter(
    (r) => r.status !== 'SCRAPPED' && r.status !== 'DEPLETED' && r.qty > 0
  );
  const [scrapReelId, setScrapReelId] = useState(scrappableReels[0]?.reelId ?? '');
  const [scrapQty, setScrapQty] = useState('50');
  const [scrapReason, setScrapReason] = useState('MSD湿敏元件暴露超期失效');
  const [scrapDisposition, setScrapDisposition] = useState('MRB评审隔离销毁');
  const [scrapWo, setScrapWo] = useState('');
  const [operator, setOperator] = useState('王磊 (QE/库管)');
  const [scrapError, setScrapError] = useState<string | null>(null);
  const [scrapSuccess, setScrapSuccess] = useState<string | null>(null);

  // Cycle count state
  const [countTitle, setCountTitle] = useState('SMT主库区周末循环盘点');
  const [zoneFilter, setZoneFilter] = useState('全部库区');
  const [activeCountId, setActiveCountId] = useState(state.cycleCounts[0]?.countId ?? '');
  const [countsMap, setCountsMap] = useState<Record<string, string>>({});
  const [scannedCountReels, setScannedCountReels] = useState<Record<string, 'SCANNED' | 'IN_PROGRESS'>>({});
  const [countScanInput, setCountScanInput] = useState('');
  const [countBucket, setCountBucket] = useState<ScanTabBucket>('SCANNED');
  const [countError, setCountError] = useState<string | null>(null);
  const [countSuccess, setCountSuccess] = useState<string | null>(null);

  const activeTask =
    state.cycleCounts.find((c) => c.countId === activeCountId) ?? state.cycleCounts[0] ?? null;

  useEffect(() => {
    if (!activeTask) return;
    const init: Record<string, string> = {};
    const scannedInit: Record<string, 'SCANNED' | 'IN_PROGRESS'> = {};
    for (const line of activeTask.lines) {
      init[line.reelId] =
        line.countedQty !== null ? String(line.countedQty) : String(line.bookQty);
      if (activeTask.status === 'COMPLETED' || line.countedQty !== null) {
        scannedInit[line.reelId] = 'SCANNED';
      }
    }
    setCountsMap(init);
    setScannedCountReels(scannedInit);
  }, [activeTask?.countId, activeTask?.status]);

  const scrapScanInputRef = useRef<HTMLInputElement>(null);
  const countScanInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pageMode === 'scrap') {
      focusScanInputOnMount(scrapScanInputRef);
    } else if (pageMode === 'cycleCount' && activeTask?.status === 'IN_PROGRESS') {
      focusScanInputOnMount(countScanInputRef);
    }
  }, [pageMode, activeTask?.countId, activeTask?.status]);

  const handleCountScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTask || !countScanInput.trim()) return;
    setCountError(null);
    const parsed = parseBarcodeString(countScanInput.trim(), state.barcodeRules);
    const targetCode = (parsed.reelId ?? countScanInput.trim()).toUpperCase();
    const matched = activeTask.lines.find(
      (l) =>
        l.reelId.toUpperCase() === targetCode ||
        l.mpn.toUpperCase() === targetCode ||
        (parsed.mpn && l.mpn.toUpperCase() === parsed.mpn.toUpperCase())
    );
    if (!matched) {
      setCountError(`当前盘点单中未找到料盘或料号: ${countScanInput.trim()}`);
      completePdaScan({
        currentValue: countScanInput,
        setValue: setCountScanInput,
        inputRef: countScanInputRef,
        outcome: 'error',
      });
      return;
    }
    if (parsed.qty !== undefined) {
      setCountsMap((prev) => ({ ...prev, [matched.reelId]: String(parsed.qty) }));
    }
    setScannedCountReels((prev) => ({ ...prev, [matched.reelId]: 'SCANNED' }));
    setCountSuccess(`已扫码核对料盘 ${matched.reelId} (${matched.mpn})，归入「已刷」清单`);
    completePdaScan({
      currentValue: countScanInput,
      setValue: setCountScanInput,
      inputRef: countScanInputRef,
      outcome: 'success',
    });
  };

  const handleScrapReelChange = (raw: string) => {
    if (scrapError) setScrapError(null);
    if (raw.includes('|') || raw.includes(';') || raw.includes(',') || /^UID:/i.test(raw.trim())) {
      const parsed = parseBarcodeString(raw.trim(), state.barcodeRules);
      if (parsed.reelId) {
        setScrapReelId(parsed.reelId);
        return;
      }
    }
    setScrapReelId(raw);
  };

  const selectedScrapReel = state.reels.find((r) => r.reelId === scrapReelId.trim());

  const handleScrapSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setScrapError(null);
    setScrapSuccess(null);
    const trimmed = scrapReelId.trim();
    try {
      await onScrap({
        reelId: trimmed,
        qty: Number(scrapQty),
        reason: scrapReason,
        disposition: scrapDisposition,
        workOrderId: scrapWo || undefined,
        operator,
      });
      setScrapSuccess(`报废处理完成: 料盘 ${trimmed} 已扣减报废数量 ${scrapQty}`);
      completePdaScan({
        currentValue: scrapReelId,
        setValue: setScrapReelId,
        inputRef: scrapScanInputRef,
        outcome: 'success',
      });
    } catch (err) {
      setScrapError(err instanceof Error ? err.message : '报废提交失败');
      completePdaScan({
        currentValue: scrapReelId,
        setValue: setScrapReelId,
        inputRef: scrapScanInputRef,
        outcome: 'error',
      });
    }
  };

  const handleCreateCount = async () => {
    setCountError(null);
    setCountSuccess(null);
    try {
      await onCreateCycleCount({ title: countTitle, zoneFilter });
      setCountSuccess('已生成盘点任务单，请在右侧录入X-Ray实盘数量。');
    } catch (err) {
      setCountError(err instanceof Error ? err.message : '创建盘点单失败');
    }
  };

  const handleReconcile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTask) return;
    setCountError(null);
    setCountSuccess(null);
    const numericCounts: Record<string, number> = {};
    for (const line of activeTask.lines) {
      const val = Number(countsMap[line.reelId]);
      if (!Number.isFinite(val) || val < 0) {
        setCountError(`料盘 ${line.reelId} 实盘数量无效`);
        scheduleScanInputFocus(countScanInputRef, 'error');
        return;
      }
      numericCounts[line.reelId] = val;
    }
    try {
      await onReconcileCycleCount(activeTask.countId, {
        counts: numericCounts,
        operator,
      });
      setCountSuccess(`盘点单 ${activeTask.countId} 已完成差异调账并写入追溯台账`);
    } catch (err) {
      setCountError(err instanceof Error ? err.message : '盘点调账失败');
      scheduleScanInputFocus(countScanInputRef, 'error');
    }
  };

  if (pageMode === 'scrap') {
    return (
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <section className="mes-panel p-4 sm:p-6 xl:col-span-5">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-4">
              <Trash2 className="h-4 w-4 text-red-600" />
              <div>
                <h2 className="text-base font-semibold text-slate-900">物料报废登记</h2>
                <p className="text-xs text-slate-500">
                  对受潮失效、SMT压伤报废、锡膏过期物料执行核销，全量报废自动移入 MRB-01-01 隔离区
                </p>
              </div>
            </div>

            <form onSubmit={handleScrapSubmit} className="mt-5 space-y-4">
              <div>
                <PdaScanField
                  id="scrap-reel"
                  inputRef={scrapScanInputRef}
                  label="扫描或选择报废料盘 UID"
                  subtitle="支持扫码枪直接扫料盘 UID 或复合码，核销后自动留痕"
                  value={scrapReelId}
                  onChange={handleScrapReelChange}
                  list="scrap-reel-options"
                  placeholder="扫描报废料盘 UID 或复合码..."
                  feedback={
                    scrapError
                      ? { type: 'error', message: scrapError }
                      : scrapSuccess
                        ? { type: 'success', message: scrapSuccess }
                        : null
                  }
                  helperHint={
                    selectedScrapReel ? (
                      <span className="font-mono text-[11px] text-slate-500">
                        {selectedScrapReel.mpn} · 库位 {selectedScrapReel.binCode} · 当前余量{' '}
                        {selectedScrapReel.qty.toLocaleString()}
                      </span>
                    ) : undefined
                  }
                  quickItemsLabel="快捷点选："
                  quickItems={scrappableReels.slice(0, 3).map((r) => ({
                    key: r.reelId,
                    label: `${r.reelId} (${r.mpn})`,
                    onClick: () => handleScrapReelChange(r.reelId),
                  }))}
                />
                <datalist id="scrap-reel-options">
                  {scrappableReels.map((r) => (
                    <option key={r.reelId} value={r.reelId}>
                      {r.mpn} | 余量 {r.qty} | {r.binCode}
                    </option>
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="scrap-qty" className="block text-xs font-medium text-slate-700">
                    报废数量
                  </label>
                  <input
                    id="scrap-qty"
                    type="number"
                    min={1}
                    required
                    value={scrapQty}
                    onChange={(e) => setScrapQty(e.target.value)}
                    className="mt-1.5 min-h-[44px] w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 tabular-nums focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15"
                  />
                </div>
                <div>
                  <label htmlFor="scrap-wo" className="block text-xs font-medium text-slate-700">
                    关联工单 (选填)
                  </label>
                  <input
                    id="scrap-wo"
                    type="text"
                    value={scrapWo}
                    onChange={(e) => setScrapWo(e.target.value)}
                    placeholder="如 WO-20261115-01"
                    className="mt-1.5 min-h-[44px] w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="scrap-reason" className="block text-xs font-medium text-slate-700">
                  报废原因
                </label>
                <select
                  id="scrap-reason"
                  value={scrapReason}
                  onChange={(e) => setScrapReason(e.target.value)}
                  className="mt-1.5 min-h-[44px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15"
                >
                  <option value="MSD湿敏元件暴露超期失效">MSD湿敏元件暴露超期失效</option>
                  <option value="SMT抛料/吸嘴压伤损毁">SMT抛料/吸嘴压伤损毁</option>
                  <option value="IQC复检氧化/引脚变形不良">IQC复检氧化/引脚变形不良</option>
                  <option value="锡膏超过冷藏保质期">锡膏超过冷藏保质期</option>
                </select>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="scrap-disp" className="block text-xs font-medium text-slate-700">
                    MRB处置方式
                  </label>
                  <input
                    id="scrap-disp"
                    type="text"
                    value={scrapDisposition}
                    onChange={(e) => setScrapDisposition(e.target.value)}
                    className="mt-1.5 min-h-[44px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15"
                  />
                </div>
                <div>
                  <label htmlFor="scrap-op" className="block text-xs font-medium text-slate-700">
                    审批/执行人
                  </label>
                  <input
                    id="scrap-op"
                    type="text"
                    value={operator}
                    onChange={(e) => setOperator(e.target.value)}
                    className="mt-1.5 min-h-[44px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!scrapReelId.trim()}
                className="min-h-[48px] w-full rounded-md bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
              >
                确认物料报废并核销库存
              </button>
            </form>
          </section>

          <section className="mes-panel xl:col-span-7">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">物料报废与MRB处置台账</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-[#f8fafb] text-slate-500">
                  <tr>
                    <th className="px-5 py-2.5 font-medium">报废单号 / 时间</th>
                    <th className="px-4 py-2.5 font-medium">料盘 UID / MPN</th>
                    <th className="px-4 py-2.5 font-medium text-right">报废数量</th>
                    <th className="px-4 py-2.5 font-medium">原因与处置</th>
                    <th className="px-5 py-2.5 font-medium">审批人</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.scrapRecords.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                        暂无物料报废记录
                      </td>
                    </tr>
                  ) : (
                    state.scrapRecords.map((s) => (
                      <tr key={s.scrapId} className="hover:bg-slate-50">
                        <td className="px-5 py-3">
                          <div className="font-mono font-medium text-slate-900">{s.scrapId}</div>
                          <div className="font-mono text-[11px] text-slate-500">
                            {formatTime(s.timestamp)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-mono font-medium text-slate-900">{s.reelId}</div>
                          <div className="font-mono text-[11px] text-slate-500">
                            {s.mpn} · Lot {s.lotNumber}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-red-700 tabular-nums">
                          -{s.qty.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          <div>{s.reason}</div>
                          <div className="text-[11px] text-slate-500">{s.disposition}</div>
                        </td>
                        <td className="px-5 py-3 text-slate-600">{s.operator}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
      </div>
    );
  }

  if (pageMode === 'countPlan') {
    return (
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left: Create Cycle Count */}
        <section className="mes-panel p-5 xl:col-span-5">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3.5">
              <ClipboardCheck className="h-4 w-4 text-teal-700" />
              <h2 className="text-sm font-semibold text-slate-900">新建循环盘点任务</h2>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label htmlFor="cc-title" className="block text-xs font-medium text-slate-700">
                  盘点单名称
                </label>
                <input
                  id="cc-title"
                  type="text"
                  value={countTitle}
                  onChange={(e) => setCountTitle(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900"
                />
              </div>

              <div>
                <label htmlFor="cc-zone" className="block text-xs font-medium text-slate-700">
                  盘点库区范围
                </label>
                <select
                  id="cc-zone"
                  value={zoneFilter}
                  onChange={(e) => setZoneFilter(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900"
                >
                  <option value="全部库区">全部库区</option>
                  <option value="电子料主库区">电子料主库区</option>
                  <option value="防潮恒温柜(MSD)">防潮恒温柜(MSD)</option>
                  <option value="PCB板库区">PCB板库区</option>
                  <option value="锡膏冷藏库">锡膏冷藏库</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleCreateCount}
                className="w-full rounded-md bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800"
              >
                生成盘点明细单
              </button>

              {countSuccess && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                  <span>{countSuccess}</span>
                  {onNavigate && (
                    <button
                      type="button"
                      onClick={() => onNavigate('cycleCount')}
                      className="inline-flex min-h-[36px] items-center gap-1 rounded bg-emerald-700 px-3 py-1 font-semibold text-white hover:bg-emerald-800"
                    >
                      <span>去 PDA 扫码盘点</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Right: Existing Cycle Count Tasks */}
          <section className="mes-panel p-5 xl:col-span-7">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3.5">
              <h2 className="text-sm font-semibold text-slate-900">历史及进行中盘点任务单</h2>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                共 {state.cycleCounts.length} 单
              </span>
            </div>
            <div className="mt-4 space-y-2.5">
              {state.cycleCounts.map((c) => (
                <div
                  key={c.countId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 p-3.5 text-xs"
                >
                  <div>
                    <div className="font-mono font-semibold text-slate-900">
                      {c.countId} · {c.title}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      共 {c.lines.length} 盘 ·{' '}
                      <span
                        className={
                          c.status === 'COMPLETED' ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'
                        }
                      >
                        {c.status === 'COMPLETED' ? '已完成调账' : '盘点进行中'}
                      </span>
                    </div>
                  </div>
                  {onNavigate && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveCountId(c.countId);
                        onNavigate('cycleCount');
                      }}
                      className="inline-flex min-h-[40px] items-center gap-1 rounded-md bg-teal-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
                    >
                      <span>进入扫码盘点</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
    );
  }

  /* Pure PDA Cycle Count Scanning Execution Page */
  return (
    <section className="mes-panel">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 sm:px-5 sm:py-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900 truncate">
            {activeTask ? `${activeTask.countId} · ${activeTask.title}` : '循环盘点扫码'}
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-500">
            PDA 扫料盘核对数量，按「已刷 / 作业中 / 未刷」分组，核对完提交自动调账
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {state.cycleCounts.length > 0 && (
            <select
              aria-label="选择盘点任务单"
              value={activeTask?.countId ?? ''}
              onChange={(e) => setActiveCountId(e.target.value)}
              className="min-h-[40px] rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900"
            >
              {state.cycleCounts.map((c) => (
                <option key={c.countId} value={c.countId}>
                  {c.countId} ({c.status === 'COMPLETED' ? '已调账' : '盘点中'})
                </option>
              ))}
            </select>
          )}
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('countPlan')}
              className="min-h-[40px] rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              新建盘点
            </button>
          )}
        </div>
      </div>

      {!activeTask ? (
        <div className="px-6 py-10 text-center">
          <div className="text-sm font-semibold text-slate-900">暂无盘点任务单</div>
          <p className="mt-1 text-xs text-slate-500">请先新建按库区生成的循环盘点明细单。</p>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('countPlan')}
              className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800"
            >
              <span>前往新建盘点任务</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        <div className="p-3.5 sm:p-5 space-y-3.5">
                {activeTask.status === 'IN_PROGRESS' && (
                  <form onSubmit={handleCountScan}>
                    <PdaScanField
                      id="pda-cycle-count-scan"
                      inputRef={countScanInputRef}
                      title="扫料盘核对库存数量"
                      subtitle="支持扫描料盘 UID 或原厂复合码，自动定位并标记「已刷」"
                      ariaLabel="扫描盘点料盘UID"
                      value={countScanInput}
                      onChange={(val) => {
                        setCountScanInput(val);
                        if (countError) setCountError(null);
                      }}
                      placeholder="PDA 扫描料盘 UID 或复合码自动定位并标记「已刷」..."
                      actionLabel="扫码盘点核对"
                      actionDisabled={!countScanInput.trim()}
                      feedback={
                        countError
                          ? { type: 'error', message: countError }
                          : countSuccess
                            ? { type: 'success', message: countSuccess }
                            : null
                      }
                      quickItemsLabel="快捷模拟扫码："
                      quickItems={activeTask.lines
                        .filter((l) => scannedCountReels[l.reelId] !== 'SCANNED')
                        .slice(0, 3)
                        .map((l) => ({
                          key: l.reelId,
                          label: `扫 ${l.reelId} (${l.mpn})`,
                          onClick: () => {
                            setScannedCountReels((prev) => ({ ...prev, [l.reelId]: 'SCANNED' }));
                            setCountError(null);
                            setCountSuccess(
                              `已扫码核对料盘 ${l.reelId} (${l.mpn})，归入「已刷」清单`
                            );
                            scheduleScanInputFocus(countScanInputRef, 'success');
                          },
                        }))}
                    />
                  </form>
                )}

                <form onSubmit={handleReconcile} className="space-y-4">
                  {activeTask.status !== 'IN_PROGRESS' && countError && (
                    <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {countError}
                    </div>
                  )}
                  {activeTask.status !== 'IN_PROGRESS' && countSuccess && (
                    <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{countSuccess}</span>
                    </div>
                  )}

                  {(() => {
                    const counts = { SCANNED: 0, IN_PROGRESS: 0, UNSCANNED: 0 };
                    const enriched = activeTask.lines.map((line) => {
                      const bucket: ScanTabBucket =
                        activeTask.status === 'COMPLETED'
                          ? 'SCANNED'
                          : scannedCountReels[line.reelId] ?? 'UNSCANNED';
                      counts[bucket] += 1;
                      return { line, bucket };
                    });
                    const filtered = enriched.filter((x) => x.bucket === countBucket);

                    return (
                      <div className="overflow-hidden rounded-md border border-slate-200">
                        <ScanProgressTabs
                          activeBucket={countBucket}
                          onChange={setCountBucket}
                          counts={counts}
                          ariaLabel="盘点扫码进度标签页"
                        />

                        {filtered.length === 0 ? (
                          <div className="px-4 py-8 text-center">
                            <div className="text-xs font-medium text-slate-700">
                              {countBucket === 'SCANNED'
                                ? '暂无「已刷」核对完成的盘点料盘'
                                : countBucket === 'IN_PROGRESS'
                                  ? '暂无「作业中」待复核的盘点料盘'
                                  : '全部料盘均已扫码盘点'}
                            </div>
                            {countBucket === 'SCANNED' && counts.UNSCANNED > 0 && (
                              <button
                                type="button"
                                onClick={() => setCountBucket('UNSCANNED')}
                                className="mt-2.5 min-h-[44px] rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                查看「未刷 ({counts.UNSCANNED})」待盘清单
                              </button>
                            )}
                          </div>
                        ) : (
                          <>
                            {/* Mobile PDA Cards */}
                            <div className="divide-y divide-slate-100 md:hidden">
                              {filtered.map(({ line }) => {
                                const rawVal = countsMap[line.reelId] ?? String(line.bookQty);
                                const numVal = Number(rawVal);
                                const variance =
                                  activeTask.status === 'COMPLETED'
                                    ? line.variance
                                    : Number.isFinite(numVal)
                                      ? numVal - line.bookQty
                                      : 0;
                                return (
                                  <div key={line.reelId} className="p-3.5 space-y-2.5">
                                    <div className="flex items-start justify-between gap-2">
                                      <div>
                                        <div className="font-mono text-sm font-bold text-teal-800">
                                          {line.reelId}
                                        </div>
                                        <div className="font-mono text-xs text-slate-700">
                                          {line.mpn} · 库位 {line.binCode}
                                        </div>
                                      </div>
                                      <div className="text-right font-mono text-xs tabular-nums">
                                        <div className="text-slate-500">账面 {line.bookQty.toLocaleString()}</div>
                                        <div
                                          className={`font-semibold ${
                                            variance > 0
                                              ? 'text-emerald-700'
                                              : variance < 0
                                                ? 'text-red-700'
                                                : 'text-slate-400'
                                          }`}
                                        >
                                          差异 {variance > 0 ? `+${variance}` : variance}
                                        </div>
                                      </div>
                                    </div>
                                    {activeTask.status === 'IN_PROGRESS' && (
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="number"
                                          min={0}
                                          aria-label={`移动端实盘数量 ${line.reelId}`}
                                          value={rawVal}
                                          onChange={(e) => {
                                            setCountsMap((prev) => ({
                                              ...prev,
                                              [line.reelId]: e.target.value,
                                            }));
                                            setScannedCountReels((prev) => ({
                                              ...prev,
                                              [line.reelId]: 'IN_PROGRESS',
                                            }));
                                          }}
                                          className="min-h-[44px] flex-1 rounded-md border border-slate-300 px-3 py-2 font-mono text-sm tabular-nums"
                                        />
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setScannedCountReels((prev) => ({
                                              ...prev,
                                              [line.reelId]: 'SCANNED',
                                            }))
                                          }
                                          className="min-h-[44px] rounded-md border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800"
                                        >
                                          确认已盘
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {/* Desktop Table */}
                            <div className="hidden overflow-x-auto md:block">
                              <table className="w-full text-left text-xs">
                                <thead className="border-b border-slate-200 bg-[#f8fafb] text-slate-500">
                                  <tr>
                                    <th className="px-4 py-2 font-medium">库位</th>
                                    <th className="px-3 py-2 font-medium">料盘 UID</th>
                                    <th className="px-3 py-2 font-medium">MPN</th>
                                    <th className="px-3 py-2 font-medium text-right">账面数量</th>
                                    <th className="px-3 py-2 font-medium text-right">实盘数量</th>
                                    <th className="px-4 py-2 font-medium text-right">盈亏差异</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {filtered.map(({ line }) => {
                                    const rawVal = countsMap[line.reelId] ?? String(line.bookQty);
                                    const numVal = Number(rawVal);
                                    const variance =
                                      activeTask.status === 'COMPLETED'
                                        ? line.variance
                                        : Number.isFinite(numVal)
                                          ? numVal - line.bookQty
                                          : 0;
                                    return (
                                      <tr key={line.reelId} className="hover:bg-slate-50">
                                        <td className="px-4 py-2.5 font-mono text-slate-900 whitespace-nowrap">
                                          {line.binCode}
                                        </td>
                                        <td className="px-3 py-2.5 font-mono font-medium text-teal-700 whitespace-nowrap">
                                          {line.reelId}
                                        </td>
                                        <td className="px-3 py-2.5 font-mono text-slate-700 whitespace-nowrap">
                                          {line.mpn}
                                        </td>
                                        <td className="px-3 py-2.5 text-right font-mono text-slate-900 tabular-nums">
                                          {line.bookQty.toLocaleString()}
                                        </td>
                                        <td className="px-3 py-2.5 text-right">
                                          {activeTask.status === 'COMPLETED' ? (
                                            <span className="font-mono font-semibold text-slate-900 tabular-nums">
                                              {(line.countedQty ?? line.bookQty).toLocaleString()}
                                            </span>
                                          ) : (
                                            <div className="inline-flex items-center gap-1.5">
                                              <input
                                                type="number"
                                                min={0}
                                                aria-label={`实盘数量 ${line.reelId}`}
                                                value={rawVal}
                                                onChange={(e) => {
                                                  setCountsMap((prev) => ({
                                                    ...prev,
                                                    [line.reelId]: e.target.value,
                                                  }));
                                                  setScannedCountReels((prev) => ({
                                                    ...prev,
                                                    [line.reelId]: 'IN_PROGRESS',
                                                  }));
                                                }}
                                                className="w-24 rounded border border-slate-300 px-2 py-1 text-right font-mono text-xs text-slate-900 tabular-nums focus:border-teal-600 focus:outline-none"
                                              />
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setScannedCountReels((prev) => ({
                                                    ...prev,
                                                    [line.reelId]: 'SCANNED',
                                                  }))
                                                }
                                                className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100"
                                              >
                                                确认
                                              </button>
                                            </div>
                                          )}
                                        </td>
                                        <td
                                          className={`px-4 py-2.5 text-right font-mono font-semibold tabular-nums ${
                                            variance > 0
                                              ? 'text-emerald-700'
                                              : variance < 0
                                                ? 'text-red-700'
                                                : 'text-slate-400'
                                          }`}
                                        >
                                          {variance > 0 ? `+${variance}` : variance}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}

                  {activeTask.status === 'IN_PROGRESS' && (
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="min-h-[44px] w-full sm:w-auto rounded-md bg-teal-700 px-5 py-2 text-xs font-semibold text-white hover:bg-teal-800"
                      >
                        确认盘点结果并自动调账
                      </button>
                    </div>
                  )}
                </form>
        </div>
      )}
    </section>
  );
}
