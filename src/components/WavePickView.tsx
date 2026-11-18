import { CheckCircle2, Layers, PackageMinus, ScanBarcode } from 'lucide-react';
import { useState } from 'react';
import type { WmsState } from '../types/wms';
import { computeWorkOrderKitting } from '../utils/wmsLogic';

interface WavePickViewProps {
  state: WmsState;
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
  state,
  onCreateWave,
  onIssueWaveReel,
  onGeneralOutbound,
}: WavePickViewProps) {
  const [tab, setTab] = useState<'wave' | 'general'>('wave');
  const [selectedWos, setSelectedWos] = useState<string[]>(() =>
    state.workOrders.filter((w) => w.status === 'PLANNED').map((w) => w.workOrderId)
  );
  const [waveName, setWaveName] = useState('SMT早班合并发料波次');
  const [operator, setOperator] = useState('李敏 (SMT发料员)');
  const [activeWaveId, setActiveWaveId] = useState<string>(state.waves[0]?.waveId ?? '');
  const [scanReelInput, setScanReelInput] = useState('');
  const [waveError, setWaveError] = useState<string | null>(null);
  const [waveNotice, setWaveNotice] = useState<string | null>(null);
  const [shortages, setShortages] = useState<
    { skuCode: string; mpn: string; shortageQty: number }[]
  >([]);

  // General outbound state
  const [outReelId, setOutReelId] = useState(
    state.reels.find((r) => r.status === 'IN_STOCK' && r.msdState !== 'BAKING_REQUIRED')?.reelId ?? ''
  );
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

  const handleScanIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWave || !scanReelInput.trim()) return;
    setWaveError(null);
    setWaveNotice(null);
    try {
      await onIssueWaveReel(currentWave.waveId, scanReelInput.trim(), operator);
      setWaveNotice(`扫码发料成功: ${scanReelInput.trim()} 已出库至 SMT 线边仓`);
      setScanReelInput('');
    } catch (err) {
      setWaveError(err instanceof Error ? err.message : '扫码发料拦截');
    }
  };

  const handleConfirmRowIssue = async (reelId: string) => {
    if (!currentWave) return;
    setWaveError(null);
    setWaveNotice(null);
    try {
      await onIssueWaveReel(currentWave.waveId, reelId, operator);
      setWaveNotice(`已确认发料: ${reelId} -> 产线线边仓`);
    } catch (err) {
      setWaveError(err instanceof Error ? err.message : '发料失败');
    }
  };

  const handleGeneralSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOutError(null);
    setOutSuccess(null);
    try {
      await onGeneralOutbound({
        reelId: outReelId,
        qty: Number(outQty),
        targetDept,
        reason: outReason,
        operator,
      });
      setOutSuccess(`出库完成: ${outReelId} 扣减 ${outQty}，已记录追溯流水`);
    } catch (err) {
      setOutError(err instanceof Error ? err.message : '出库失败');
    }
  };

  const eligibleWos = state.workOrders.filter((w) => w.status === 'PLANNED');
  const inStockReels = state.reels.filter(
    (r) => r.status === 'IN_STOCK' && r.msdState !== 'BAKING_REQUIRED' && r.qty > 0
  );

  return (
    <div className="space-y-6">
      {/* Segmented Tabs */}
      <div className="inline-flex items-center gap-1 rounded-lg bg-slate-200/70 p-1">
        <button
          type="button"
          onClick={() => setTab('wave')}
          className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
            tab === 'wave'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          工单波次发料 (FIFO齐套拣货)
        </button>
        <button
          type="button"
          onClick={() => setTab('general')}
          className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
            tab === 'general'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          其他领料出库 (非工单/试产)
        </button>
      </div>

      {tab === 'wave' ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          {/* Left: Create Wave from Work Orders */}
          <section className="rounded-lg border border-slate-200 bg-white p-5 xl:col-span-5">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3.5">
              <Layers className="h-4 w-4 text-sky-700" />
              <h2 className="text-sm font-semibold text-slate-900">
                1. 合并工单生成波次 (按DateCode FIFO)
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
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
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
                              ? 'border-sky-300 bg-sky-50/50'
                              : 'border-slate-200 bg-white hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleWo(wo.workOrderId)}
                              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-600"
                            />
                            <div>
                              <div className="font-mono text-xs font-semibold text-slate-900">
                                {wo.workOrderId}
                              </div>
                              <div className="text-xs text-slate-700">
                                {wo.productName} · {wo.targetQty} PCS
                              </div>
                              <div className="text-[11px] text-slate-500">
                                线别 {wo.lineName} · BOM {wo.bom.length} 项
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
                className="w-full rounded-md bg-sky-700 px-4 py-2 text-xs font-medium text-white hover:bg-sky-800 disabled:opacity-50"
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
            </div>
          </section>

          {/* Right: Wave Picking Execution */}
          <section className="rounded-lg border border-slate-200 bg-white xl:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  2. 波次拣货与扫码发料防错 (Poka-Yoke)
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  按库位与最老周期(DateCode)引导拣货，扫错批次或跳过FIFO将被系统拦截
                </p>
              </div>
              {state.waves.length > 0 && (
                <select
                  aria-label="选择波次单"
                  value={currentWave?.waveId ?? ''}
                  onChange={(e) => setActiveWaveId(e.target.value)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs text-slate-900"
                >
                  {state.waves.map((w) => (
                    <option key={w.waveId} value={w.waveId}>
                      {w.waveId} ({w.status === 'COMPLETED' ? '已完成' : '拣货中'})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {!currentWave ? (
              <div className="px-6 py-12 text-center text-xs text-slate-500">
                暂无发料波次单。请在左侧勾选工单点击「生成波次并FIFO锁定料盘」。
              </div>
            ) : (
              <div className="p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                  <div>
                    <span className="font-semibold text-slate-900">{currentWave.name}</span>
                    <span className="mx-2 text-slate-300">·</span>
                    <span>关联工单: {currentWave.workOrderIds.join(', ')}</span>
                  </div>
                  <span className="font-mono tabular-nums text-sky-700 font-semibold">
                    进度 {currentWave.allocations.filter((a) => a.status === 'PICKED').length} /{' '}
                    {currentWave.allocations.length} 盘
                  </span>
                </div>

                {/* Barcode Scan Issue Bar */}
                <form onSubmit={handleScanIssue} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <ScanBarcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={scanReelInput}
                      onChange={(e) => setScanReelInput(e.target.value)}
                      aria-label="扫描发料料盘UID"
                      placeholder="扫描波次清单中的料盘 UID 条码确认发料出库..."
                      className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 font-mono text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="rounded-md bg-sky-700 px-4 py-2 text-xs font-medium text-white hover:bg-sky-800 whitespace-nowrap shrink-0"
                  >
                    扫码核销发料
                  </button>
                </form>

                {waveError && (
                  <div
                    role="alert"
                    className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
                  >
                    {waveError}
                  </div>
                )}

                {waveNotice && (
                  <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{waveNotice}</span>
                  </div>
                )}

                <div className="overflow-x-auto rounded-md border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
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
                      {currentWave.allocations.map((alloc) => (
                        <tr key={alloc.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-mono font-semibold text-slate-900 whitespace-nowrap">
                            {alloc.binCode}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-sky-700 whitespace-nowrap">
                            {alloc.reelId}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="font-mono text-slate-900">{alloc.mpn}</div>
                            <div className="font-mono text-[11px] text-slate-500">
                              D/C {alloc.dateCode} · Lot {alloc.lotNumber}
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
                                className="rounded border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-800 hover:bg-sky-100"
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
              </div>
            )}
          </section>
        </div>
      ) : (
        /* General Non-WO Outbound */
        <section className="max-w-2xl rounded-lg border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-4">
            <PackageMinus className="h-4 w-4 text-sky-700" />
            <div>
              <h2 className="text-base font-semibold text-slate-900">其他领料出库 (非工单)</h2>
              <p className="text-xs text-slate-500">
                适用于工程打样、外协加工、研发借料或内部调拨出库
              </p>
            </div>
          </div>

          <form onSubmit={handleGeneralSubmit} className="mt-5 space-y-4">
            <div>
              <label htmlFor="out-reel" className="block text-xs font-medium text-slate-700">
                扫描或选择出库料盘 UID
              </label>
              <select
                id="out-reel"
                value={outReelId}
                onChange={(e) => setOutReelId(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900"
              >
                {inStockReels.map((r) => (
                  <option key={r.reelId} value={r.reelId}>
                    {r.reelId} | {r.mpn} | 余量 {r.qty} | 库位 {r.binCode}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
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
                  className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 tabular-nums"
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
                  className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
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
                className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </div>

            {outError && (
              <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {outError}
              </div>
            )}
            {outSuccess && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                {outSuccess}
              </div>
            )}

            <button
              type="submit"
              className="rounded-md bg-sky-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-sky-800"
            >
              确认出库并扣减库存
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
