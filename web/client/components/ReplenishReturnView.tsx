import { ArrowUpRight, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ReelItem, WmsState } from '../../shared/types/wms';
import { formatTime } from '../../shared/domain/formatters';
import { completePdaScan, focusScanInputOnMount } from '../utils/pdaScanFocus';
import { parseBarcodeString } from '../../shared/domain/wmsLogic';
import { PdaScanField } from './PdaScanField';

export type ReplenishPageMode = 'replenish' | 'returnStock';

interface ReplenishReturnViewProps {
  pageMode: ReplenishPageMode;
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
  pageMode,
  state,
  onReplenish,
  onReturn,
  onOpenLabel,
}: ReplenishReturnViewProps) {
  const isReplenish = pageMode === 'replenish';
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

  const normalizeScannedReel = (raw: string): string => {
    if (raw.includes('|') || raw.includes(';') || raw.includes(',') || /^UID:/i.test(raw.trim())) {
      const parsed = parseBarcodeString(raw.trim(), state.barcodeRules);
      if (parsed.reelId) return parsed.reelId;
    }
    return raw;
  };

  const selectReplenishReel = (raw: string) => {
    setRepReelId(normalizeScannedReel(raw));
    if (repError) setRepError(null);
  };

  const selectReturnReel = (raw: string) => {
    const reelId = normalizeScannedReel(raw);
    setRetReelId(reelId);
    if (retError) setRetError(null);
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

  const selectedReplenishReel = state.reels.find((r) => r.reelId === repReelId.trim());
  const selectedReturnReel = state.reels.find((r) => r.reelId === retReelId.trim());

  const repScanInputRef = useRef<HTMLInputElement>(null);
  const retScanInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isReplenish) {
      focusScanInputOnMount(repScanInputRef);
    } else {
      focusScanInputOnMount(retScanInputRef);
    }
  }, [isReplenish]);

  const handleReplenishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRepError(null);
    setRepSuccess(null);
    const trimmed = repReelId.trim();
    try {
      await onReplenish({
        workOrderId: repWo,
        reelId: trimmed,
        qty: Number(repQty),
        reason: repReason,
        station: repStation,
        operator: repOperator,
      });
      setRepSuccess(`补料成功: 已向工单 ${repWo} (${repStation}) 补发 ${repQty}`);
      completePdaScan({
        currentValue: repReelId,
        setValue: setRepReelId,
        inputRef: repScanInputRef,
        outcome: 'success',
      });
    } catch (err) {
      setRepError(err instanceof Error ? err.message : '补料操作失败');
      completePdaScan({
        currentValue: repReelId,
        setValue: setRepReelId,
        inputRef: repScanInputRef,
        outcome: 'error',
      });
    }
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRetError(null);
    setReturnedReel(null);
    const trimmed = retReelId.trim();
    try {
      const reel = await onReturn({
        workOrderId: retWo,
        reelId: trimmed,
        returnQty: Number(retQty),
        toBin: retBin,
        reason: retReason,
        operator: repOperator,
        splitChildReel,
      });
      setReturnedReel(reel);
      completePdaScan({
        currentValue: retReelId,
        setValue: setRetReelId,
        inputRef: retScanInputRef,
        outcome: 'success',
      });
    } catch (err) {
      setRetError(err instanceof Error ? err.message : '退料操作失败');
      completePdaScan({
        currentValue: retReelId,
        setValue: setRetReelId,
        inputRef: retScanInputRef,
        outcome: 'error',
      });
    }
  };

  const recentRepRetEvents = state.traceEvents
    .filter((e) => e.action === (isReplenish ? 'REPLENISH' : 'RETURN'))
    .slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <section className="mes-panel p-4 sm:p-6 xl:col-span-5">
          {isReplenish ? (
            <>
              <div className="flex items-center gap-2 border-b border-slate-200 pb-4">
                <ArrowUpRight className="h-4 w-4 text-teal-700" />
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
                    className="mt-1.5 min-h-[44px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15"
                  >
                    {activeWos.map((w) => (
                      <option key={w.workOrderId} value={w.workOrderId}>
                        {w.workOrderId} — {w.productName} ({w.customerName || '通用'} · {w.lineName})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <PdaScanField
                    id="rep-reel"
                    inputRef={repScanInputRef}
                    label="扫描或选择补料料盘 UID"
                    subtitle="自动校验客户发料准入与 MSD 状态，支持扫描复合条码"
                    value={repReelId}
                    onChange={selectReplenishReel}
                    list="replenish-reel-options"
                    placeholder="扫描补料料盘 UID 或复合码..."
                    feedback={
                      repError
                        ? { type: 'error', message: repError }
                        : repSuccess
                          ? { type: 'success', message: repSuccess }
                          : null
                    }
                    helperHint={
                      selectedReplenishReel ? (
                        <span className="font-mono text-[11px] text-slate-500">
                          {selectedReplenishReel.mpn} · 库位 {selectedReplenishReel.binCode} · 余量{' '}
                          {selectedReplenishReel.qty.toLocaleString()} ·{' '}
                          {selectedReplenishReel.customerCode
                            ? `${selectedReplenishReel.customerName}专备`
                            : '通用共享'}
                        </span>
                      ) : undefined
                    }
                    quickItemsLabel="快捷点选："
                    quickItems={availableReelsForReplenish.slice(0, 3).map((r) => ({
                      key: r.reelId,
                      label: `${r.reelId} (${r.mpn}${r.customerCode ? ` · ${r.customerCode}` : ''})`,
                      onClick: () => selectReplenishReel(r.reelId),
                    }))}
                  />
                  <datalist id="replenish-reel-options">
                    {availableReelsForReplenish.map((r) => (
                      <option key={r.reelId} value={r.reelId}>
                        {r.mpn} | {r.customerCode ? `${r.customerName}专备` : '通用共享'} | 余量 {r.qty} | {r.binCode}
                      </option>
                    ))}
                  </datalist>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                      className="mt-1.5 min-h-[44px] w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 tabular-nums focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15"
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
                      className="mt-1.5 min-h-[44px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15"
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
                    className="mt-1.5 min-h-[44px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15"
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
                    className="mt-1.5 min-h-[44px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!repReelId.trim()}
                  className="min-h-[48px] w-full rounded-md bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                >
                  确认补料出库
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 border-b border-slate-200 pb-4">
                <RotateCcw className="h-4 w-4 text-teal-700" />
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
                    className="mt-1.5 min-h-[44px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15"
                  >
                    {activeWos.map((w) => (
                      <option key={w.workOrderId} value={w.workOrderId}>
                        {w.workOrderId} — {w.productName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <PdaScanField
                    id="ret-reel"
                    inputRef={retScanInputRef}
                    label="扫描退库料盘 UID"
                    subtitle="扫线边余料盘 UID 或复合码，自动回填原工单与默认上架库位"
                    value={retReelId}
                    onChange={selectReturnReel}
                    list="return-reel-options"
                    placeholder="扫描线边退回料盘 UID..."
                    feedback={
                      retError
                        ? { type: 'error', message: retError }
                        : returnedReel
                          ? {
                              type: 'success',
                              message: (
                                <>
                                  退料完成！<strong className="font-mono">{returnedReel.reelId}</strong> 已回库至{' '}
                                  <strong className="font-mono">{returnedReel.binCode}</strong> (余量{' '}
                                  {returnedReel.qty})
                                </>
                              ),
                              action: (
                                <button
                                  type="button"
                                  onClick={() => onOpenLabel(returnedReel)}
                                  className="font-medium text-emerald-900 underline whitespace-nowrap"
                                >
                                  打印新标签
                                </button>
                              ),
                            }
                          : null
                    }
                    helperHint={
                      selectedReturnReel ? (
                        <span className="font-mono text-[11px] text-slate-500">
                          {selectedReturnReel.mpn} · 初始 {selectedReturnReel.initialQty} · 已发{' '}
                          {selectedReturnReel.issuedQty} · 线边余 {selectedReturnReel.qty}
                        </span>
                      ) : undefined
                    }
                    quickItemsLabel="快捷点选："
                    quickItems={returnableReels.slice(0, 3).map((r) => ({
                      key: r.reelId,
                      label: `${r.reelId} (已发${r.issuedQty})`,
                      onClick: () => selectReturnReel(r.reelId),
                    }))}
                  />
                  <datalist id="return-reel-options">
                    {returnableReels.map((r) => (
                      <option key={r.reelId} value={r.reelId}>
                        {r.mpn} | 线边剩余 {r.qty} | 已发 {r.issuedQty}
                      </option>
                    ))}
                  </datalist>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                      className="mt-1.5 min-h-[44px] w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 tabular-nums focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15"
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
                      className="mt-1.5 min-h-[44px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15"
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

                <label className="flex items-start gap-2.5 rounded-md border border-slate-200 bg-[#f8fafb] p-3 text-xs">
                  <input
                    type="checkbox"
                    checked={splitChildReel}
                    onChange={(e) => setSplitChildReel(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
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
                    className="mt-1.5 min-h-[44px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!retReelId.trim()}
                  className="min-h-[48px] w-full rounded-md bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                >
                  确认余料点数退库
                </button>
              </form>
            </>
          )}
        </section>

        {/* Right: Recent History */}
        <section className="mes-panel xl:col-span-7">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">
              {isReplenish ? '产线补料实时流水' : '产线余料退库实时流水'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {isReplenish
                ? '实时记录工单额外损耗补料明细，自动关联单据与机台站位'
                : '实时记录完工/换线退库明细与分拆子UID回库记录'}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-[#f8fafb] text-slate-500">
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
