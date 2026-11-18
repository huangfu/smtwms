import { Barcode, GitBranch, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReelItem, WmsState } from '../types/wms';
import {
  ACTION_META,
  formatTime,
  MSD_STATE_LABEL,
  REEL_STATUS_LABEL,
  WORK_ORDER_STATUS_LABEL,
} from '../utils/formatters';
import { traceByQuery } from '../utils/wmsLogic';

interface TraceabilityViewProps {
  state: WmsState;
  initialQuery: string;
  onOpenLabel: (reel: ReelItem) => void;
}

export function TraceabilityView({
  state,
  initialQuery,
  onOpenLabel,
}: TraceabilityViewProps) {
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const result = traceByQuery(state, query);

  return (
    <div className="space-y-6">
      {/* Search / Scanner Bar */}
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">
          全流程双向扫码追溯中心 (正查流向 · 反查源头)
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          支持扫描或输入料盘 UID、IPC-1782 复合二维码、原厂批次 Lot、物料 MPN、生产工单号或库位号
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="全程扫码追溯查询框"
              placeholder="扫描条码或输入 UID (如 RL261010-010) / Lot / 工单号 (WO-...) / MPN..."
              className="w-full rounded-md border border-slate-300 py-2.5 pl-10 pr-4 font-mono text-sm text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-sky-600 focus:outline-none"
            />
          </div>
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              显示全部流水
            </button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500">快速检索示例:</span>
          {['RL261010-010', 'RL261005-011', 'WO-20261115-01', 'STM32F407VET6'].map((sample) => (
            <button
              key={sample}
              type="button"
              onClick={() => setQuery(sample)}
              className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-xs text-sky-700 hover:bg-sky-50"
            >
              {sample}
            </button>
          ))}
        </div>
      </section>

      {/* Matched Reels Summary */}
      {query && result.matchedReels.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-3.5">
            <h3 className="text-sm font-semibold text-slate-900">
              匹配料盘档案与父子分拆谱系 ({result.matchedReels.length})
            </h3>
          </div>
          <div className="divide-y divide-slate-100">
            {result.matchedReels.map((reel) => {
              const st = REEL_STATUS_LABEL[reel.status];
              const msd = MSD_STATE_LABEL[reel.msdState];
              return (
                <div
                  key={reel.reelId}
                  className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-slate-900">
                        {reel.reelId}
                      </span>
                      <span className={`font-medium ${st.toneClass}`}>{st.label}</span>
                      <span className="text-slate-300">·</span>
                      <span className={`font-medium ${msd.toneClass}`}>
                        {reel.msdLevel} ({msd.label})
                      </span>
                      {reel.parentReelId && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span className="inline-flex items-center gap-1 font-mono text-sky-700">
                            <GitBranch className="h-3 w-3" />
                            母盘 {reel.parentReelId}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="font-mono text-slate-600">
                      MPN: {reel.mpn} · Lot: {reel.lotNumber} · D/C: {reel.dateCode} · 供应商:{' '}
                      {reel.supplier}
                    </div>
                    <div className="text-slate-500">
                      当前库位: <strong className="font-mono text-slate-800">{reel.binCode}</strong> ·
                      收货单: <span className="font-mono">{reel.receiptDocNo}</span>
                      {reel.workOrderId && (
                        <span>
                          {' '}
                          · 绑定工单: <strong className="font-mono">{reel.workOrderId}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right font-mono tabular-nums">
                      <div className="text-slate-500">初始 / 已发 / 当前余量</div>
                      <div className="mt-0.5 text-sm font-semibold text-slate-900">
                        {reel.initialQty.toLocaleString()} / {reel.issuedQty.toLocaleString()} /{' '}
                        <span className="text-sky-700">{reel.qty.toLocaleString()}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenLabel(reel)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                    >
                      <Barcode className="h-3.5 w-3.5" />
                      条码标签
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Matched Work Orders */}
      {query && result.matchedWorkOrders.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-3.5">
            <h3 className="text-sm font-semibold text-slate-900">
              关联工单用料明细 ({result.matchedWorkOrders.length})
            </h3>
          </div>
          <div className="divide-y divide-slate-100">
            {result.matchedWorkOrders.map((wo) => (
              <div key={wo.workOrderId} className="px-5 py-4 text-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono text-sm font-bold text-slate-900">
                      {wo.workOrderId}
                    </span>
                    <span className="mx-2 text-slate-300">·</span>
                    <span className="font-medium text-slate-800">{wo.productName}</span>
                    <span className="mx-2 text-slate-300">·</span>
                    <span className="text-slate-500">
                      {wo.lineName} · 计划 {wo.targetQty} PCS
                    </span>
                  </div>
                  <span className="font-medium text-sky-700">
                    {WORK_ORDER_STATUS_LABEL[wo.status]}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-4 font-mono text-[11px] text-slate-600">
                  {wo.bom.map((b) => (
                    <span key={b.skuCode}>
                      {b.skuCode}: 发料 {wo.issuedBySku[b.skuCode] ?? 0} / 补料{' '}
                      {wo.replenishedBySku[b.skuCode] ?? 0} / 退料{' '}
                      {wo.returnedBySku[b.skuCode] ?? 0}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Trace Timeline Ledger */}
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              全程扫码移动审计链 ({result.events.length} 条记录)
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              不可篡改作业流水：按时间倒序展示每一次条码扫描、库位迁移及数量变更
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-5 py-2.5 font-medium">时间戳</th>
                <th className="px-4 py-2.5 font-medium">操作环节</th>
                <th className="px-4 py-2.5 font-medium">料盘 UID</th>
                <th className="px-4 py-2.5 font-medium">MPN / 批次 / 周期</th>
                <th className="px-4 py-2.5 font-medium">库位流转</th>
                <th className="px-4 py-2.5 font-medium text-right">变动 / 结存</th>
                <th className="px-4 py-2.5 font-medium">关联单据/工单</th>
                <th className="px-5 py-2.5 font-medium">操作员与说明</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.events.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-500">
                    未查询到匹配「{query}」的追溯记录，请核对 UID / Lot / 工单号
                  </td>
                </tr>
              ) : (
                result.events.map((evt) => {
                  const meta = ACTION_META[evt.action];
                  return (
                    <tr key={evt.eventId} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-mono text-slate-500 whitespace-nowrap">
                        {formatTime(evt.timestamp)}
                      </td>
                      <td className={`px-4 py-3 font-semibold whitespace-nowrap ${meta.toneClass}`}>
                        {meta.label}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setQuery(evt.reelId)}
                          className="font-mono font-medium text-sky-700 hover:underline"
                        >
                          {evt.reelId}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-slate-900">{evt.mpn}</div>
                        <div className="font-mono text-[11px] text-slate-500">
                          Lot {evt.lotNumber} · D/C {evt.dateCode}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700 whitespace-nowrap">
                        {evt.fromBin || '收料区'} → {evt.toBin || '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap">
                        <span
                          className={`font-semibold ${
                            evt.qtyDelta > 0
                              ? 'text-emerald-700'
                              : evt.qtyDelta < 0
                                ? 'text-slate-900'
                                : 'text-slate-400'
                          }`}
                        >
                          {evt.qtyDelta > 0 ? `+${evt.qtyDelta}` : evt.qtyDelta}
                        </span>
                        <span className="text-slate-400"> / 余 {evt.balanceAfter}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700">
                        <div>{evt.docNo}</div>
                        {evt.workOrderId && (
                          <button
                            type="button"
                            onClick={() => setQuery(evt.workOrderId!)}
                            className="text-[11px] text-sky-700 hover:underline"
                          >
                            {evt.workOrderId}
                          </button>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        <div className="font-medium text-slate-800">{evt.operator}</div>
                        <div className="text-[11px] text-slate-500">{evt.reason}</div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
