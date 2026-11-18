import { ArrowUpRight, CheckCircle2, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import type { ReelItem, WmsState } from '../types/wms';
import { formatTime } from '../utils/formatters';

interface ReplenishReturnViewProps {
  state: WmsState;
  onReplenish: (payload: {
    workOrderId: string;
    reelId: string;
    qty: number;
    reason: string;
    station: string;
    operator: string;
  }) => Promise<void>;
  onReturn: (payload: {
    workOrderId: string;
    reelId: string;
    returnQty: number;
    toBin: string;
    reason: string;
    operator: string;
    splitChildReel: boolean;
  }) => Promise<ReelItem>;
  onOpenLabel: (reel: ReelItem) => void;
}

export function ReplenishReturnView({
  state,
  onReplenish,
  onReturn,
  onOpenLabel,
}: ReplenishReturnViewProps) {
  const [tab, setTab] = useState<'replenish' | 'return'>('replenish');
  const activeWos = state.workOrders.filter((w) => w.status !== 'COMPLETED');
  const firstWo = activeWos[0]?.workOrderId ?? '';

  // Replenish state
  const [repWo, setRepWo] = useState(firstWo);
  const [repReelId, setRepReelId] = useState(
    state.reels.find((r) => r.status === 'IN_STOCK' && r.msdState !== 'BAKING_REQUIRED')?.reelId ?? ''
  );
  const [repQty, setRepQty] = useState('150');
  const [repStation, setRepStation] = useState('SMT-Line-01 · 贴片机M1 飞达#08');
  const [repReason, setRepReason] = useState('飞达(Feeder)抛料损耗补料');
  const [repOperator, setRepOperator] = useState('陈强 (SMT物料员)');
  const [repError, setRepError] = useState<string | null>(null);
  const [repSuccess, setRepSuccess] = useState<string | null>(null);

  // Return state
  const returnableReels = state.reels.filter(
    (r) => r.status === 'ISSUED_TO_LINE' || (r.status === 'DEPLETED' && r.issuedQty > 0)
  );
  const initialRetReel = returnableReels[0];
  const [retWo, setRetWo] = useState(firstWo);
  const [retReelId, setRetReelId] = useState(initialRetReel?.reelId ?? '');
  const [retQty, setRetQty] = useState(
    initialRetReel ? String(initialRetReel.issuedQty) : '100'
  );
  const [retBin, setRetBin] = useState(() => {
    const mat = state.materials.find((m) => m.skuCode === initialRetReel?.skuCode);
    return mat?.defaultBin ?? 'A-01-02';
  });
  const [retReason, setRetReason] = useState('工单完工/换线余料 X-Ray点数退库');
  const [splitChildReel, setSplitChildReel] = useState(false);
  const [retError, setRetError] = useState<string | null>(null);
  const [returnedReel, setReturnedReel] = useState<ReelItem | null>(null);

  const selectReturnReel = (reelId: string) => {
    setRetReelId(reelId);
    const found = state.reels.find((r) => r.reelId === reelId);
    if (found) {
      if (found.issuedQty > 0) {
        setRetQty(String(found.issuedQty));
      }
      const mat = state.materials.find((m) => m.skuCode === found.skuCode);
      if (mat) {
        setRetBin(mat.defaultBin);
      }
      if (found.workOrderId) {
        setRetWo(found.workOrderId);
      }
    }
  };

  const availableReelsForReplenish = state.reels.filter(
    (r) =>
      (r.status === 'IN_STOCK' || r.status === 'ISSUED_TO_LINE') &&
      r.msdState !== 'BAKING_REQUIRED' &&
      r.qty > 0
  );

  const selectedReturnReel = state.reels.find((r) => r.reelId === retReelId);

  const handleReplenishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRepError(null);
    setRepSuccess(null);
    try {
      await onReplenish({
        workOrderId: repWo,
        reelId: repReelId,
        qty: Number(repQty),
        reason: repReason,
        station: repStation,
        operator: repOperator,
      });
      setRepSuccess(`补料成功: 已向工单 ${repWo} (${repStation}) 补发 ${repQty}`);
    } catch (err) {
      setRepError(err instanceof Error ? err.message : '补料操作失败');
    }
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRetError(null);
    setReturnedReel(null);
    try {
      const reel = await onReturn({
        workOrderId: retWo,
        reelId: retReelId,
        returnQty: Number(retQty),
        toBin: retBin,
        reason: retReason,
        operator: repOperator,
        splitChildReel,
      });
      setReturnedReel(reel);
    } catch (err) {
      setRetError(err instanceof Error ? err.message : '退料操作失败');
    }
  };

  const recentRepRetEvents = state.traceEvents
    .filter((e) => e.action === 'REPLENISH' || e.action === 'RETURN')
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="inline-flex items-center gap-1 rounded-lg bg-slate-200/70 p-1">
        <button
          type="button"
          onClick={() => setTab('replenish')}
          className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
            tab === 'replenish'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          生产中补料 (抛料/断带紧急补领)
        </button>
        <button
          type="button"
          onClick={() => setTab('return')}
          className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
            tab === 'return'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          生产退料 (余料点数/分拆回库)
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <section className="rounded-lg border border-slate-200 bg-white p-6 xl:col-span-5">
          {tab === 'replenish' ? (
            <>
              <div className="flex items-center gap-2 border-b border-slate-200 pb-4">
                <ArrowUpRight className="h-4 w-4 text-amber-600" />
                <div>
                  <h2 className="text-base font-semibold text-slate-900">SMT 产线补料作业</h2>
                  <p className="text-xs text-slate-500">
                    针对飞达抛料、吸嘴丢料或接料损耗，快速关联工单与贴片站位补发物料
                  </p>
                </div>
              </div>

              <form onSubmit={handleReplenishSubmit} className="mt-5 space-y-4">
                <div>
                  <label htmlFor="rep-wo" className="block text-xs font-medium text-slate-700">
                    关联生产工单
                  </label>
                  <select
                    id="rep-wo"
                    value={repWo}
                    onChange={(e) => setRepWo(e.target.value)}
                    className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900"
                  >
                    {activeWos.map((w) => (
                      <option key={w.workOrderId} value={w.workOrderId}>
                        {w.workOrderId} — {w.productName} ({w.customerName || '通用'} · {w.lineName})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="rep-reel" className="block text-xs font-medium text-slate-700">
                    扫描或选择补料料盘 UID (自动校验客户发料准入)
                  </label>
                  <input
                    id="rep-reel"
                    list="replenish-reel-options"
                    value={repReelId}
                    onChange={(e) => setRepReelId(e.target.value)}
                    placeholder="扫码或输入料盘 UID..."
                    className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900"
                  />
                  <datalist id="replenish-reel-options">
                    {availableReelsForReplenish.map((r) => (
                      <option key={r.reelId} value={r.reelId}>
                        {r.mpn} | {r.customerCode ? `${r.customerName}专备` : '通用共享'} | 余量 {r.qty} | {r.binCode}
                      </option>
                    ))}
                  </datalist>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {availableReelsForReplenish.slice(0, 3).map((r) => (
                      <button
                        key={r.reelId}
                        type="button"
                        onClick={() => setRepReelId(r.reelId)}
                        className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] text-slate-700 hover:bg-slate-100"
                      >
                        {r.reelId} ({r.mpn}{r.customerCode ? ` · ${r.customerCode}` : ''})
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="rep-qty" className="block text-xs font-medium text-slate-700">
                      补料数量
                    </label>
                    <input
                      id="rep-qty"
                      type="number"
                      min={1}
                      required
                      value={repQty}
                      onChange={(e) => setRepQty(e.target.value)}
                      className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 tabular-nums"
                    />
                  </div>
                  <div>
                    <label htmlFor="rep-station" className="block text-xs font-medium text-slate-700">
                      SMT机台/飞达站位
                    </label>
                    <input
                      id="rep-station"
                      type="text"
                      required
                      value={repStation}
                      onChange={(e) => setRepStation(e.target.value)}
                      className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="rep-reason" className="block text-xs font-medium text-slate-700">
                    补料原因代码
                  </label>
                  <select
                    id="rep-reason"
                    value={repReason}
                    onChange={(e) => setRepReason(e.target.value)}
                    className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  >
                    <option value="飞达(Feeder)抛料损耗补料">飞达(Feeder)抛料损耗补料</option>
                    <option value="吸嘴真空异常丢料">吸嘴真空异常丢料</option>
                    <option value="换料接料剪带损耗">换料接料剪带损耗</option>
                    <option value="首件调试与AOI返修消耗">首件调试与AOI返修消耗</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="rep-op" className="block text-xs font-medium text-slate-700">
                    补料操作员
                  </label>
                  <input
                    id="rep-op"
                    type="text"
                    value={repOperator}
                    onChange={(e) => setRepOperator(e.target.value)}
                    className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  />
                </div>

                {repError && (
                  <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {repError}
                  </div>
                )}
                {repSuccess && (
                  <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{repSuccess}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full rounded-md bg-sky-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-800"
                >
                  确认补料出库
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 border-b border-slate-200 pb-4">
                <RotateCcw className="h-4 w-4 text-emerald-700" />
                <div>
                  <h2 className="text-base font-semibold text-slate-900">SMT 产线余料退库</h2>
                  <p className="text-xs text-slate-500">
                    支持整盘原码退库或 X-Ray 点料后散料分拆生成子UID重新上架
                  </p>
                </div>
              </div>

              <form onSubmit={handleReturnSubmit} className="mt-5 space-y-4">
                <div>
                  <label htmlFor="ret-wo" className="block text-xs font-medium text-slate-700">
                    退料来源工单
                  </label>
                  <select
                    id="ret-wo"
                    value={retWo}
                    onChange={(e) => setRetWo(e.target.value)}
                    className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900"
                  >
                    {activeWos.map((w) => (
                      <option key={w.workOrderId} value={w.workOrderId}>
                        {w.workOrderId} — {w.productName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="ret-reel" className="block text-xs font-medium text-slate-700">
                    扫描退库料盘 UID
                  </label>
                  <input
                    id="ret-reel"
                    list="return-reel-options"
                    value={retReelId}
                    onChange={(e) => selectReturnReel(e.target.value)}
                    placeholder="扫描线边退回料盘 UID..."
                    className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900"
                  />
                  <datalist id="return-reel-options">
                    {returnableReels.map((r) => (
                      <option key={r.reelId} value={r.reelId}>
                        {r.mpn} | 线边剩余 {r.qty} | 已发 {r.issuedQty}
                      </option>
                    ))}
                  </datalist>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {returnableReels.slice(0, 3).map((r) => (
                      <button
                        key={r.reelId}
                        type="button"
                        onClick={() => selectReturnReel(r.reelId)}
                        className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] text-slate-700 hover:bg-slate-100"
                      >
                        {r.reelId} (已发{r.issuedQty})
                      </button>
                    ))}
                  </div>
                  {selectedReturnReel && (
                    <div className="mt-1.5 font-mono text-[11px] text-slate-500">
                      {selectedReturnReel.mpn} · 初始 {selectedReturnReel.initialQty} · 已发{' '}
                      {selectedReturnReel.issuedQty} · 线边余 {selectedReturnReel.qty}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="ret-qty" className="block text-xs font-medium text-slate-700">
                      X-Ray点料实退数量
                    </label>
                    <input
                      id="ret-qty"
                      type="number"
                      min={1}
                      required
                      value={retQty}
                      onChange={(e) => setRetQty(e.target.value)}
                      className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 tabular-nums"
                    />
                  </div>

                  <div>
                    <label htmlFor="ret-bin" className="block text-xs font-medium text-slate-700">
                      退回上架库位
                    </label>
                    <select
                      id="ret-bin"
                      value={retBin}
                      onChange={(e) => setRetBin(e.target.value)}
                      className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900"
                    >
                      {state.bins
                        .filter((b) => b.zone !== '产线暂存区')
                        .map((b) => (
                          <option key={b.binCode} value={b.binCode}>
                            {b.binCode} ({b.zone})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <label className="flex items-start gap-2.5 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs">
                  <input
                    type="checkbox"
                    checked={splitChildReel}
                    onChange={(e) => setSplitChildReel(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-700"
                  />
                  <span>
                    <strong className="text-slate-900">分拆生成子UID料盘</strong>
                    <span className="block text-slate-500">
                      若母盘仍在产线，勾选此项可为退回零头料生成新子条码并继承原Lot/DateCode追溯链
                    </span>
                  </span>
                </label>

                <div>
                  <label htmlFor="ret-reason" className="block text-xs font-medium text-slate-700">
                    退料说明
                  </label>
                  <input
                    id="ret-reason"
                    type="text"
                    value={retReason}
                    onChange={(e) => setRetReason(e.target.value)}
                    className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  />
                </div>

                {retError && (
                  <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {retError}
                  </div>
                )}

                {returnedReel && (
                  <div className="flex items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
                    <span>
                      退料完成！<strong className="font-mono">{returnedReel.reelId}</strong> 已回库至{' '}
                      <strong className="font-mono">{returnedReel.binCode}</strong> (余量{' '}
                      {returnedReel.qty})
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpenLabel(returnedReel)}
                      className="font-medium text-emerald-900 underline whitespace-nowrap"
                    >
                      打印新标签
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full rounded-md bg-sky-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-800"
                >
                  确认余料点数退库
                </button>
              </form>
            </>
          )}
        </section>

        {/* Right: Recent Replenish & Return History */}
        <section className="rounded-lg border border-slate-200 bg-white xl:col-span-7">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">产线补料与退料实时流水</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              实时记录工单额外损耗补料与完工/换线退库明细，自动关联单据与机台站位
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-5 py-2.5 font-medium whitespace-nowrap">时间</th>
                  <th className="px-4 py-2.5 font-medium whitespace-nowrap">类型</th>
                  <th className="px-4 py-2.5 font-medium whitespace-nowrap">料盘 UID</th>
                  <th className="px-4 py-2.5 font-medium whitespace-nowrap">工单 / 站位</th>
                  <th className="px-4 py-2.5 font-medium text-right whitespace-nowrap">变动数量</th>
                  <th className="px-5 py-2.5 font-medium whitespace-nowrap">原因说明</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentRepRetEvents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-slate-500">
                      暂无补料或退料记录
                    </td>
                  </tr>
                ) : (
                  recentRepRetEvents.map((evt) => (
                    <tr key={evt.eventId} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-mono text-slate-500 whitespace-nowrap">
                        {formatTime(evt.timestamp)}
                      </td>
                      <td
                        className={`px-4 py-3 font-medium whitespace-nowrap ${
                          evt.action === 'REPLENISH' ? 'text-amber-700' : 'text-emerald-700'
                        }`}
                      >
                        {evt.action === 'REPLENISH' ? '生产补料' : '生产退料'}
                      </td>
                      <td className="px-4 py-3 font-mono font-medium text-slate-900 whitespace-nowrap">
                        {evt.reelId}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-mono text-slate-900">{evt.workOrderId || '-'}</div>
                        <div className="text-[11px] text-slate-500">{evt.lineOrStation || '-'}</div>
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono font-semibold tabular-nums whitespace-nowrap ${
                          evt.qtyDelta > 0 ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {evt.qtyDelta > 0 ? `+${evt.qtyDelta}` : evt.qtyDelta}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{evt.reason}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
