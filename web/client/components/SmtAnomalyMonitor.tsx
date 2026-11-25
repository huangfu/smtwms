import { AlertTriangle, Clock, Flame, Layers, PackageCheck, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import type { WmsState } from '../../shared/types/wms';
import { computeSmtAnomalies, type AnomalySeverity } from '../../shared/domain/wmsLogic';
import type { NavKey } from './Sidebar';

interface SmtAnomalyMonitorProps {
  state: WmsState;
  onNavigate: (nav: NavKey) => void;
  onInspectTrace: (query: string) => void;
  onBakeMsd: (reelId: string) => Promise<void>;
}

type FilterTab = 'ALL' | 'SHORTAGE' | 'MSD' | 'LEVEL';

interface UnifiedRow {
  id: string;
  category: 'SHORTAGE' | 'MSD' | 'LEVEL';
  categoryLabel: string;
  severity: AnomalySeverity;
  subjectPrimary: string;
  subjectSecondary: string;
  metricValue: string;
  metricSub: string;
  context: string;
  recommendation: string;
  actionLabel: string;
  onAction: () => void;
}

const SEVERITY_META: Record<AnomalySeverity, { label: string; textClass: string }> = {
  CRITICAL: { label: '紧急阻断', textClass: 'text-red-700' },
  WARNING: { label: '临界预警', textClass: 'text-amber-700' },
  INFO: { label: '水位提示', textClass: 'text-teal-700' },
};

export function SmtAnomalyMonitor({
  state,
  onNavigate,
  onInspectTrace,
  onBakeMsd,
}: SmtAnomalyMonitorProps) {
  const [tab, setTab] = useState<FilterTab>('ALL');
  const [bakingId, setBakingId] = useState<string | null>(null);

  const report = computeSmtAnomalies(state, new Date());

  const handleBake = async (reelId: string) => {
    setBakingId(reelId);
    try {
      await onBakeMsd(reelId);
    } finally {
      setBakingId(null);
    }
  };

  const rows: UnifiedRow[] = [
    ...report.shortages.map((s): UnifiedRow => ({
      id: s.id,
      category: 'SHORTAGE',
      categoryLabel: '物料缺料预警',
      severity: s.severity,
      subjectPrimary: s.mpn,
      subjectSecondary: `${s.skuCode} · ${s.name}`,
      metricValue: `缺口 ${s.shortageQty.toLocaleString()} ${s.unit}`,
      metricSub: `总需 ${s.requiredQty.toLocaleString()} / 可用 ${s.availableQty.toLocaleString()}`,
      context: s.affectedWorkOrders.join(', '),
      recommendation: s.recommendation,
      actionLabel: '去收料入库',
      onAction: () => onNavigate('asnReceive'),
    })),
    ...report.msdAlerts.map((m): UnifiedRow => ({
      id: m.id,
      category: 'MSD',
      categoryLabel: m.status === 'EXPIRED_LOCKED' ? 'MSD超时锁定' : 'MSD有效期临界',
      severity: m.severity,
      subjectPrimary: m.reelId,
      subjectSecondary: `${m.mpn} · ${m.msdLevel}`,
      metricValue:
        m.status === 'EXPIRED_LOCKED'
          ? '0.0h (已锁码)'
          : `剩 ${m.remainingHours}h / ${m.totalFloorLifeHours}h`,
      metricSub: `当前余量 ${m.qty.toLocaleString()} PCS`,
      context: `库位 ${m.binCode}`,
      recommendation: m.recommendation,
      actionLabel: m.status === 'EXPIRED_LOCKED' ? '烘烤复位解锁' : '追溯定位',
      onAction:
        m.status === 'EXPIRED_LOCKED'
          ? () => handleBake(m.reelId)
          : () => onInspectTrace(m.reelId),
    })),
    ...report.inventoryLevels.map((l): UnifiedRow => {
      const typeLabel =
        l.anomalyType === 'ZERO_STOCK'
          ? '零库存断料'
          : l.anomalyType === 'LOW_STOCK'
            ? '低于安全水位'
            : l.anomalyType === 'OVERSTOCK'
              ? '高水位超储'
              : '长库龄呆滞';
      return {
        id: l.id,
        category: 'LEVEL',
        categoryLabel: typeLabel,
        severity: l.severity,
        subjectPrimary: l.reelId ? `${l.reelId} (${l.mpn})` : l.mpn,
        subjectSecondary: `${l.skuCode} · ${l.name}`,
        metricValue:
          l.anomalyType === 'STAGNANT_AGING'
            ? `库龄 ${l.ageDays} 天`
            : `${l.currentQty.toLocaleString()} / ${l.thresholdQty.toLocaleString()} ${l.unit}`,
        metricSub:
          l.anomalyType === 'STAGNANT_AGING'
            ? `静置数量 ${l.currentQty.toLocaleString()} ${l.unit}`
            : `安全库存线 ${l.thresholdQty.toLocaleString()} ${l.unit}`,
        context: l.binCode ? `库位 ${l.binCode}` : '全仓在库汇总',
        recommendation: l.recommendation,
        actionLabel:
          l.anomalyType === 'ZERO_STOCK' || l.anomalyType === 'LOW_STOCK'
            ? '去收料入库'
            : l.reelId
              ? '去波次消耗'
              : '查看台账',
        onAction: () => {
          if (l.anomalyType === 'ZERO_STOCK' || l.anomalyType === 'LOW_STOCK') {
            onNavigate('asnReceive');
          } else if (l.reelId) {
            onNavigate('wavePick');
          } else {
            onNavigate('master');
          }
        },
      };
    }),
  ].sort((a, b) => {
    const rank = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    return rank[a.severity] - rank[b.severity];
  });

  const filteredRows =
    tab === 'ALL' ? rows : rows.filter((r) => r.category === tab);

  return (
    <section
      aria-label="SMT车间异常监控中心"
      className="mes-panel rounded-lg"
    >
      {/* Header & Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/90 px-5 py-4">
        <div className="flex items-start gap-2.5">
          <ShieldAlert
            className={`mt-0.5 h-4 w-4 shrink-0 ${
              report.criticalCount > 0 ? 'text-red-600' : 'text-amber-600'
            }`}
          />
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              SMT 车间异常监控中心 (主管决策视图)
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              实时监测工单BOM缺料预警、J-STD-033湿敏暴露临界点及安全/呆滞库存水位
            </p>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="异常分类筛选"
          className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1"
        >
          {(
            [
              { key: 'ALL', label: `全部异常 (${report.totalCount})` },
              { key: 'SHORTAGE', label: `物料缺料 (${report.shortages.length})` },
              { key: 'MSD', label: `MSD临界 (${report.msdAlerts.length})` },
              { key: 'LEVEL', label: `异常水位 (${report.inventoryLevels.length})` },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              onClick={() => setTab(item.key)}
              className={`rounded-md px-3 py-1 text-xs transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                tab === item.key
                  ? 'bg-white font-semibold text-teal-800 shadow-xs'
                  : 'font-medium text-slate-600 hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3-Column Summary Strip */}
      <div className="grid grid-cols-1 divide-y divide-slate-200 border-b border-slate-200 bg-slate-50/70 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" />
            <span>工单缺料阻断项</span>
          </div>
          <span
            className={`font-mono text-sm font-bold tabular-nums ${
              report.shortages.length > 0 ? 'text-red-700' : 'text-emerald-700'
            }`}
          >
            {report.shortages.length} 项
          </span>
        </div>

        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <span>MSD 超时锁定 / ≤24h临界</span>
          </div>
          <span
            className={`font-mono text-sm font-bold tabular-nums ${
              report.msdAlerts.length > 0 ? 'text-amber-700' : 'text-emerald-700'
            }`}
          >
            {report.msdAlerts.length} 盘
          </span>
        </div>

        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Layers className="h-3.5 w-3.5 text-teal-700 shrink-0" />
            <span>异常水位 (低仓/超储/呆滞)</span>
          </div>
          <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
            {report.inventoryLevels.length} 项
          </span>
        </div>
      </div>

      {/* Anomaly Table */}
      {filteredRows.length === 0 ? (
        <div className="flex items-center justify-center gap-2 px-5 py-8 text-xs text-emerald-700">
          <PackageCheck className="h-4 w-4 shrink-0" />
          <span>当前筛选维度下无车间异常，物料齐套、MSD暴露寿命与库存水位均处于受控状态</span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200/90 bg-[#f8fafb] text-slate-500">
              <tr>
                <th className="px-5 py-2.5 font-medium whitespace-nowrap">异常类别 / 级别</th>
                <th className="px-4 py-2.5 font-medium whitespace-nowrap">异常对象 (UID / MPN)</th>
                <th className="px-4 py-2.5 font-medium whitespace-nowrap">实况指标与阈值</th>
                <th className="px-4 py-2.5 font-medium whitespace-nowrap">影响工单 / 库位</th>
                <th className="px-4 py-2.5 font-medium whitespace-nowrap">主管决策建议</th>
                <th className="px-5 py-2.5 font-medium text-right whitespace-nowrap">快速处置</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map((row) => {
                const sev = SEVERITY_META[row.severity];
                const isBaking = bakingId === row.subjectPrimary;
                return (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 whitespace-nowrap">
                      <div className={`flex items-center gap-1.5 font-semibold ${sev.textClass}`}>
                        {row.category === 'MSD' && row.severity === 'CRITICAL' ? (
                          <Flame className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        )}
                        <span>{row.categoryLabel}</span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">{sev.label}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono font-semibold text-slate-900">
                        {row.subjectPrimary}
                      </div>
                      <div className="text-[11px] text-slate-500">{row.subjectSecondary}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className={`font-mono font-semibold tabular-nums ${sev.textClass}`}>
                        {row.metricValue}
                      </div>
                      <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                        {row.metricSub}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700">{row.context}</td>
                    <td className="px-4 py-3 text-slate-700">{row.recommendation}</td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        disabled={isBaking}
                        onClick={row.onAction}
                        className={`rounded-md border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                          row.actionLabel === '烘烤复位解锁'
                            ? 'border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-teal-300 hover:bg-teal-50/40 hover:text-teal-800'
                        }`}
                      >
                        {isBaking ? '复位中...' : row.actionLabel}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
