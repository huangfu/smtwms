import { CheckCircle2, ClipboardCheck, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { WmsState } from '../types/wms';
import { formatTime } from '../utils/formatters';

interface ScrapCountViewProps {
  state: WmsState;
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
  state,
  onScrap,
  onCreateCycleCount,
  onReconcileCycleCount,
}: ScrapCountViewProps) {
  const [tab, setTab] = useState<'scrap' | 'count'>('scrap');

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
  const [countError, setCountError] = useState<string | null>(null);
  const [countSuccess, setCountSuccess] = useState<string | null>(null);

  const activeTask =
    state.cycleCounts.find((c) => c.countId === activeCountId) ?? state.cycleCounts[0] ?? null;

  useEffect(() => {
    if (!activeTask) return;
    const init: Record<string, string> = {};
    for (const line of activeTask.lines) {
      init[line.reelId] =
        line.countedQty !== null ? String(line.countedQty) : String(line.bookQty);
    }
    setCountsMap(init);
  }, [activeTask?.countId, activeTask?.status]);

  const handleScrapSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setScrapError(null);
    setScrapSuccess(null);
    try {
      await onScrap({
        reelId: scrapReelId,
        qty: Number(scrapQty),
        reason: scrapReason,
        disposition: scrapDisposition,
        workOrderId: scrapWo || undefined,
        operator,
      });
      setScrapSuccess(`报废处理完成: 料盘 ${scrapReelId} 已扣减报废数量 ${scrapQty}`);
    } catch (err) {
      setScrapError(err instanceof Error ? err.message : '报废提交失败');
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
    }
  };

  return (
    <div className="space-y-6">
      <div className="inline-flex items-center gap-1 rounded-lg bg-slate-200/70 p-1">
        <button
          type="button"
          onClick={() => setTab('scrap')}
          className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
            tab === 'scrap'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          物料报废与MRB隔离
        </button>
        <button
          type="button"
          onClick={() => setTab('count')}
          className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
            tab === 'count'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          库存盘点与差异调账
        </button>
      </div>

      {tab === 'scrap' ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <section className="rounded-lg border border-slate-200 bg-white p-6 xl:col-span-5">
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
                <label htmlFor="scrap-reel" className="block text-xs font-medium text-slate-700">
                  扫描或选择报废料盘 UID
                </label>
                <input
                  id="scrap-reel"
                  list="scrap-reel-options"
                  value={scrapReelId}
                  onChange={(e) => setScrapReelId(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900"
                />
                <datalist id="scrap-reel-options">
                  {scrappableReels.map((r) => (
                    <option key={r.reelId} value={r.reelId}>
                      {r.mpn} | 余量 {r.qty} | {r.binCode}
                    </option>
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                    className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 tabular-nums"
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
                    className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900"
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
                  className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  <option value="MSD湿敏元件暴露超期失效">MSD湿敏元件暴露超期失效</option>
                  <option value="SMT抛料/吸嘴压伤损毁">SMT抛料/吸嘴压伤损毁</option>
                  <option value="IQC复检氧化/引脚变形不良">IQC复检氧化/引脚变形不良</option>
                  <option value="锡膏超过冷藏保质期">锡膏超过冷藏保质期</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="scrap-disp" className="block text-xs font-medium text-slate-700">
                    MRB处置方式
                  </label>
                  <input
                    id="scrap-disp"
                    type="text"
                    value={scrapDisposition}
                    onChange={(e) => setScrapDisposition(e.target.value)}
                    className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
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
                    className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  />
                </div>
              </div>

              {scrapError && (
                <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {scrapError}
                </div>
              )}
              {scrapSuccess && (
                <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{scrapSuccess}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full rounded-md bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700"
              >
                确认物料报废并核销库存
              </button>
            </form>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white xl:col-span-7">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">物料报废与MRB处置台账</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
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
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          {/* Left: Create Cycle Count */}
          <section className="rounded-lg border border-slate-200 bg-white p-5 xl:col-span-4">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3.5">
              <ClipboardCheck className="h-4 w-4 text-sky-700" />
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
                className="w-full rounded-md bg-sky-700 px-4 py-2 text-xs font-medium text-white hover:bg-sky-800"
              >
                生成盘点明细单
              </button>

              <div className="border-t border-slate-200 pt-4">
                <div className="text-xs font-medium text-slate-700">历史及进行中盘点单</div>
                <div className="mt-2 space-y-1.5">
                  {state.cycleCounts.map((c) => (
                    <button
                      key={c.countId}
                      type="button"
                      onClick={() => setActiveCountId(c.countId)}
                      className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-xs ${
                        activeTask?.countId === c.countId
                          ? 'border-sky-300 bg-sky-50 text-sky-900'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <div className="font-mono font-semibold">{c.countId}</div>
                        <div className="text-[11px] text-slate-500">{c.title}</div>
                      </div>
                      <span
                        className={`font-medium ${
                          c.status === 'COMPLETED' ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {c.status === 'COMPLETED' ? '已调账' : '盘点中'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Right: Active Cycle Count Execution */}
          <section className="rounded-lg border border-slate-200 bg-white xl:col-span-8">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  {activeTask ? `${activeTask.countId} · ${activeTask.title}` : '盘点明细'}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  录入实盘数量 (X-Ray 点料数或整盘核对数)，系统自动计算盈亏差异并生成调账流水
                </p>
              </div>
              {activeTask && (
                <span
                  className={`text-xs font-semibold ${
                    activeTask.status === 'COMPLETED' ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {activeTask.status === 'COMPLETED' ? '已完成盘点调账' : '待提交调账'}
                </span>
              )}
            </div>

            {!activeTask ? (
              <div className="px-6 py-12 text-center text-xs text-slate-500">
                请在左侧选择或新建盘点任务单
              </div>
            ) : (
              <form onSubmit={handleReconcile} className="p-5 space-y-4">
                {countError && (
                  <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {countError}
                  </div>
                )}
                {countSuccess && (
                  <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{countSuccess}</span>
                  </div>
                )}

                <div className="overflow-x-auto rounded-md border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
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
                      {activeTask.lines.map((line) => {
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
                            <td className="px-3 py-2.5 font-mono font-medium text-sky-700 whitespace-nowrap">
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
                                <input
                                  type="number"
                                  min={0}
                                  aria-label={`实盘数量 ${line.reelId}`}
                                  value={rawVal}
                                  onChange={(e) =>
                                    setCountsMap((prev) => ({
                                      ...prev,
                                      [line.reelId]: e.target.value,
                                    }))
                                  }
                                  className="w-28 rounded border border-slate-300 px-2 py-1 text-right font-mono text-xs text-slate-900 tabular-nums focus:border-sky-600 focus:outline-none"
                                />
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

                {activeTask.status === 'IN_PROGRESS' && (
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="rounded-md bg-sky-700 px-5 py-2 text-xs font-medium text-white hover:bg-sky-800"
                    >
                      确认盘点结果并自动调账
                    </button>
                  </div>
                )}
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
