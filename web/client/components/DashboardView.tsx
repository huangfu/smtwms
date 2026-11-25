import { ArrowRight, RotateCcw } from 'lucide-react';
import type { AsnOrder, ReelItem, WmsState } from '../../shared/types/wms';
import {
  ACTION_META,
  formatTime,
  MSD_STATE_LABEL,
  WORK_ORDER_STATUS_LABEL,
} from '../../shared/domain/formatters';
import { computeSmtAnomalies, computeWorkOrderKitting } from '../../shared/domain/wmsLogic';
import { LowStockAlertPanel } from './LowStockAlertPanel';
import type { NavKey } from './Sidebar';
import { SmtAnomalyMonitor } from './SmtAnomalyMonitor';

interface DashboardViewProps {
  state: WmsState;
  onNavigate: (nav: NavKey) => void;
  onGoInboundWithSku: (skuCode: string) => void;
  onQuickInbound: (payload: {
    skuCode: string;
    lotNumber: string;
    dateCode: string;
    supplier: string;
    qty: number;
    binCode: string;
    receiptDocNo?: string;
    operator: string;
    reason?: string;
  }) => Promise<ReelItem>;
  onQuickCreateAsn: (payload: {
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
  onOpenLabel: (reel: ReelItem) => void;
  onInspectTrace: (query: string) => void;
  onBakeMsd: (reelId: string) => Promise<void>;
  onResetDemo: () => Promise<void>;
}

export function DashboardView({
  state,
  onNavigate,
  onGoInboundWithSku,
  onQuickInbound,
  onQuickCreateAsn,
  onOpenLabel,
  onInspectTrace,
  onBakeMsd,
  onResetDemo,
}: DashboardViewProps) {
  const inStockReels = state.reels.filter(
    (r) => r.status === 'IN_STOCK' || r.status === 'ALLOCATED'
  );
  const lineReels = state.reels.filter((r) => r.status === 'ISSUED_TO_LINE');
  const activeWaves = state.waves.filter((w) => w.status !== 'COMPLETED');
  const anomalies = computeSmtAnomalies(state, new Date());
  const recentEvents = state.traceEvents.slice(0, 8);

  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      <section aria-label="关键仓储指标" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="mes-panel rounded-lg p-5">
          <div className="text-xs font-medium text-slate-500">在库料盘数 (UID)</div>
          <div className="mt-2.5 flex items-baseline justify-between gap-2">
            <span className="font-mono text-[26px] font-bold leading-none text-slate-900 tabular-nums">
              {inStockReels.length}
            </span>
            <span className="text-xs text-slate-500 tabular-nums">
              线边在制 <strong className="font-mono font-semibold text-slate-700">{lineReels.length}</strong> 盘
            </span>
          </div>
        </div>

        <div className="mes-panel rounded-lg p-5">
          <div className="text-xs font-medium text-slate-500">活跃 SMT 工单 / 波次</div>
          <div className="mt-2.5 flex items-baseline justify-between gap-2">
            <span className="font-mono text-[26px] font-bold leading-none text-slate-900 tabular-nums">
              {state.workOrders.filter((w) => w.status !== 'COMPLETED').length}
            </span>
            <span className="text-xs font-semibold text-teal-700 tabular-nums">
              进行中波次 {activeWaves.length} 单
            </span>
          </div>
        </div>

        <div className="mes-panel rounded-lg p-5">
          <div className="text-xs font-medium text-slate-500">全链路扫码追溯流水</div>
          <div className="mt-2.5 flex items-baseline justify-between gap-2">
            <span className="font-mono text-[26px] font-bold leading-none text-slate-900 tabular-nums">
              {state.traceEvents.length}
            </span>
            <span className="text-xs font-medium text-emerald-700">实时闭环留痕</span>
          </div>
        </div>

        <div className="mes-panel rounded-lg p-5">
          <div className="text-xs font-medium text-slate-500">车间异常预警项</div>
          <div className="mt-2.5 flex items-baseline justify-between gap-2">
            <span
              className={`font-mono text-[26px] font-bold leading-none tabular-nums ${
                anomalies.criticalCount > 0
                  ? 'text-red-600'
                  : anomalies.warningCount > 0
                    ? 'text-amber-600'
                    : 'text-emerald-700'
              }`}
            >
              {anomalies.totalCount}
            </span>
            <span className="text-xs text-slate-500 tabular-nums">
              阻断 <strong className="font-mono font-semibold text-red-700">{anomalies.criticalCount}</strong> · 临界{' '}
              <strong className="font-mono font-semibold text-amber-700">{anomalies.warningCount}</strong>
            </span>
          </div>
        </div>
      </section>

      {/* Low Stock Safety Threshold Cards with Quick Replenishment */}
      <LowStockAlertPanel
        state={state}
        onNavigate={onNavigate}
        onGoInboundWithSku={onGoInboundWithSku}
        onQuickInbound={onQuickInbound}
        onQuickCreateAsn={onQuickCreateAsn}
        onOpenLabel={onOpenLabel}
      />

      {/* Dedicated SMT Shop-Floor Anomaly Monitoring Module */}
      <SmtAnomalyMonitor
        state={state}
        onNavigate={onNavigate}
        onInspectTrace={onInspectTrace}
        onBakeMsd={onBakeMsd}
      />

      {/* Main Split */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Left 2/3: Work Orders + Recent Traceability */}
        <div className="space-y-6 xl:col-span-2">
          <section className="mes-panel rounded-lg">
            <div className="flex items-center justify-between border-b border-slate-200/90 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  SMT 生产工单与 BOM 齐套率（无 ERP 独立排程）
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  自动汇总 BOM 耗损需求并比对在库可用料盘，支持一键生成波次发料
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('wavePick')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 transition-colors hover:text-teal-800 whitespace-nowrap shrink-0"
              >
                前往波次发料
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200/90 bg-[#f8fafb] text-slate-500">
                  <tr>
                    <th className="px-5 py-2.5 font-medium whitespace-nowrap">工单编号</th>
                    <th className="px-4 py-2.5 font-medium whitespace-nowrap">产品与SMT线别</th>
                    <th className="px-4 py-2.5 font-medium text-right whitespace-nowrap">计划产量</th>
                    <th className="px-4 py-2.5 font-medium whitespace-nowrap">BOM齐套率</th>
                    <th className="px-4 py-2.5 font-medium whitespace-nowrap">状态</th>
                    <th className="px-5 py-2.5 font-medium text-right whitespace-nowrap">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.workOrders.map((wo) => {
                    const kitting = computeWorkOrderKitting(wo, state.reels, state.materials);
                    return (
                      <tr key={wo.workOrderId} className="hover:bg-slate-50">
                        <td className="px-5 py-3 font-mono font-medium text-slate-900 whitespace-nowrap">
                          {wo.workOrderId}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{wo.productName}</div>
                          <div className="font-mono text-[11px] text-slate-500">
                            {wo.productCode} · {wo.lineName}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-900 tabular-nums whitespace-nowrap">
                          {wo.targetQty} PCS
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={`h-full ${
                                  kitting.isFullyKitted ? 'bg-emerald-600' : 'bg-amber-500'
                                }`}
                                style={{ width: `${kitting.readinessPercent}%` }}
                              />
                            </div>
                            <span
                              className={`font-mono font-medium tabular-nums ${
                                kitting.isFullyKitted ? 'text-emerald-700' : 'text-amber-700'
                              }`}
                            >
                              {kitting.readinessPercent}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                          {WORK_ORDER_STATUS_LABEL[wo.status]}
                        </td>
                        <td className="px-5 py-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onInspectTrace(wo.workOrderId)}
                            className="text-xs font-semibold text-teal-700 transition-colors hover:text-teal-800"
                          >
                            追溯用料
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mes-panel rounded-lg">
            <div className="flex items-center justify-between border-b border-slate-200/90 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">最新作业扫码追溯流水</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  入库、波次发料、产线补料、退料、盘点与报废全链路留痕
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('trace')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 transition-colors hover:text-teal-800 whitespace-nowrap shrink-0"
              >
                完整追溯中心
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200/90 bg-[#f8fafb] text-slate-500">
                  <tr>
                    <th className="px-5 py-2.5 font-medium whitespace-nowrap">时间</th>
                    <th className="px-4 py-2.5 font-medium whitespace-nowrap">作业类型</th>
                    <th className="px-4 py-2.5 font-medium whitespace-nowrap">料盘 UID</th>
                    <th className="px-4 py-2.5 font-medium whitespace-nowrap">物料 MPN</th>
                    <th className="px-4 py-2.5 font-medium text-right whitespace-nowrap">变动数量</th>
                    <th className="px-5 py-2.5 font-medium whitespace-nowrap">库位/工单</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentEvents.map((evt) => {
                    const meta = ACTION_META[evt.action];
                    return (
                      <tr key={evt.eventId} className="hover:bg-slate-50">
                        <td className="px-5 py-2.5 font-mono text-slate-500 whitespace-nowrap">
                          {formatTime(evt.timestamp)}
                        </td>
                        <td className={`px-4 py-2.5 font-medium whitespace-nowrap ${meta.toneClass}`}>
                          {meta.label}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onInspectTrace(evt.reelId)}
                            className="font-mono font-semibold text-teal-700 hover:underline"
                          >
                            {evt.reelId}
                          </button>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-slate-700 whitespace-nowrap">
                          {evt.mpn}
                        </td>
                        <td
                          className={`px-4 py-2.5 text-right font-mono font-medium tabular-nums whitespace-nowrap ${
                            evt.qtyDelta > 0
                              ? 'text-emerald-700'
                              : evt.qtyDelta < 0
                                ? 'text-slate-900'
                                : 'text-slate-400'
                          }`}
                        >
                          {evt.qtyDelta > 0 ? `+${evt.qtyDelta}` : evt.qtyDelta}
                        </td>
                        <td className="px-5 py-2.5 text-slate-600 whitespace-nowrap">
                          <div className="font-mono">{evt.toBin || evt.fromBin || '-'}</div>
                          {evt.workOrderId && (
                            <div className="font-mono text-[11px] text-slate-400">
                              {evt.workOrderId}
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

        {/* Right 1/3: SMT Line-side Active Reels + Zone Capacity */}
        <div className="space-y-6">
          <section className="mes-panel rounded-lg">
            <div className="flex items-center justify-between border-b border-slate-200/90 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">SMT 线边在制料盘状态</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  已发至产线飞达料架的实时余量与湿敏状态
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('replenish')}
                className="text-xs font-semibold text-teal-700 transition-colors hover:text-teal-800 whitespace-nowrap shrink-0"
              >
                补料/退库
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {lineReels.length === 0 ? (
                <div className="px-5 py-6 text-xs text-slate-500">当前无线边在制料盘</div>
              ) : (
                lineReels.map((r) => {
                  const msd = MSD_STATE_LABEL[r.msdState];
                  return (
                    <div key={r.reelId} className="flex items-center justify-between gap-3 px-5 py-3.5 text-xs">
                      <div>
                        <button
                          type="button"
                          onClick={() => onInspectTrace(r.reelId)}
                          className="font-mono font-semibold text-teal-700 hover:underline"
                        >
                          {r.reelId}
                        </button>
                        <div className="mt-0.5 font-mono text-[11px] text-slate-700">
                          {r.mpn} · {r.workOrderId || r.binCode}
                        </div>
                        <div className={`mt-0.5 text-[11px] ${msd.toneClass}`}>
                          {r.msdLevel} · {msd.label}
                        </div>
                      </div>
                      <div className="text-right font-mono tabular-nums">
                        <div className="font-semibold text-slate-900">
                          {r.qty.toLocaleString()}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          已发 {r.issuedQty.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section className="mes-panel rounded-lg p-5">
            <h2 className="text-sm font-semibold text-slate-900">库区存储占用概况</h2>
            <div className="mt-4 space-y-3.5">
              {['电子料主库区', '防潮恒温柜(MSD)', 'PCB板库区', '锡膏冷藏库'].map((zone) => {
                const zoneBins = state.bins.filter((b) => b.zone === zone);
                const binCodes = new Set(zoneBins.map((b) => b.binCode));
                const cap = zoneBins.reduce((s, b) => s + b.capacityReels, 0);
                const used = state.reels.filter(
                  (r) =>
                    binCodes.has(r.binCode) &&
                    r.status !== 'DEPLETED' &&
                    r.status !== 'SCRAPPED'
                ).length;
                const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
                return (
                  <div key={zone}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{zone}</span>
                      <span className="font-mono text-slate-500 tabular-nums">
                        {used} / {cap} 盘
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full bg-teal-600 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 border-t border-slate-200/90 pt-4">
              <button
                type="button"
                onClick={onResetDemo}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                重置演示仓储数据
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
