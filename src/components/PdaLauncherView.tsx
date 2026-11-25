import {
  ArrowUpRight,
  ClipboardCheck,
  Layers,
  PackageCheck,
  PackageMinus,
  PackagePlus,
  RotateCcw,
  ScanBarcode,
  SlidersHorizontal,
  Trash2,
  Truck,
} from 'lucide-react';
import type { WmsState } from '../types/wms';
import { getCrossDepartmentQueueCounts } from '../utils/roleAccess';
import type { NavKey } from './Sidebar';

interface PdaLauncherViewProps {
  state: WmsState;
  onSelectNav: (nav: NavKey) => void;
}

interface LauncherTile {
  key: NavKey;
  title: string;
  desc: string;
  metricText?: string;
  highlight?: boolean;
  icon: typeof Truck;
  accentClass: string;
}

export function PdaLauncherView({ state, onSelectNav }: PdaLauncherViewProps) {
  const {
    pendingArrivalCount: arrivalCount,
    pendingReceiveCount: receivingCount,
    notifiedIqcCount: iqcCount,
    iqcReleasedPutawayCount: putawayCount,
  } = getCrossDepartmentQueueCounts(state.asns);

  const openWaveCount = state.waves.filter((w) => w.status !== 'COMPLETED').length;
  const openCountTasks = state.cycleCounts.filter((c) => c.status !== 'COMPLETED').length;
  const lineReelsCount = state.reels.filter((r) => r.status === 'ISSUED_TO_LINE').length;
  const plannedWoCount = state.workOrders.filter((w) => w.status === 'PLANNED').length;

  // Strictly Warehouse-owned inbound tiles (NO Procurement ASN creation, NO IQC inspection)
  const inboundTiles: LauncherTile[] = [
    {
      key: 'asnArrival',
      title: '1. 到货签到',
      desc: '核对供应商送货单到厂签到',
      metricText: arrivalCount > 0 ? `待签到 ${arrivalCount} 单` : '暂无待签到',
      highlight: arrivalCount > 0,
      icon: Truck,
      accentClass: 'bg-teal-50 text-teal-700',
    },
    {
      key: 'asnReceive',
      title: '2. 待收料初收',
      desc: '扫箱码初收 · 完结自动通知IQC',
      metricText: receivingCount > 0 ? `待初收 ${receivingCount} 单` : '查看待收清单',
      highlight: receivingCount > 0,
      icon: ScanBarcode,
      accentClass: 'bg-teal-50 text-teal-700',
    },
    {
      key: 'asnPutaway',
      title: '3. 合格品入库上架',
      desc: 'IQC检验放行后绑库位入库',
      metricText: putawayCount > 0 ? `IQC放行 ${putawayCount} 单` : '暂无待入库',
      highlight: putawayCount > 0,
      icon: PackageCheck,
      accentClass: 'bg-emerald-50 text-emerald-700',
    },
    {
      key: 'quickInbound',
      title: '无单急料入库',
      desc: '应急散料直扫赋码上架',
      metricText: '应急直入',
      icon: PackagePlus,
      accentClass: 'bg-slate-100 text-slate-700',
    },
  ];

  const outboundStockTiles: LauncherTile[] = [
    {
      key: 'wavePick',
      title: '波次扫码发料',
      desc: 'FIFO防错扫料盘拣货',
      metricText: openWaveCount > 0 ? `拣货中 ${openWaveCount} 单` : '暂无待拣波次',
      highlight: openWaveCount > 0,
      icon: Layers,
      accentClass: 'bg-teal-50 text-teal-700',
    },
    {
      key: 'replenish',
      title: 'SMT产线补料',
      desc: '抛料/断带紧急补领',
      metricText: `在制料盘 ${lineReelsCount} 盘`,
      icon: ArrowUpRight,
      accentClass: 'bg-amber-50 text-amber-700',
    },
    {
      key: 'returnStock',
      title: '产线余料退库',
      desc: '点料回库 / 拆盘子UID',
      metricText: `可退 ${lineReelsCount} 盘`,
      icon: RotateCcw,
      accentClass: 'bg-emerald-50 text-emerald-700',
    },
    {
      key: 'cycleCount',
      title: '循环盘点扫码',
      desc: 'PDA扫料盘核对调账',
      metricText: openCountTasks > 0 ? `盘点中 ${openCountTasks} 单` : '暂无进行中',
      highlight: openCountTasks > 0,
      icon: ClipboardCheck,
      accentClass: 'bg-teal-50 text-teal-700',
    },
    {
      key: 'scrap',
      title: '物料报废隔离',
      desc: '不良/超期转入MRB',
      metricText: 'MRB管控',
      icon: Trash2,
      accentClass: 'bg-red-50 text-red-700',
    },
    {
      key: 'generalOutbound',
      title: '其他领料出库',
      desc: '研发/试产非工单领用',
      metricText: '非工单出库',
      icon: PackageMinus,
      accentClass: 'bg-slate-100 text-slate-700',
    },
    {
      key: 'trace',
      title: '全程扫码追溯',
      desc: '扫UID查批次与工单',
      metricText: `${state.reels.length} 盘台账`,
      icon: ScanBarcode,
      accentClass: 'bg-slate-100 text-slate-700',
    },
  ];

  const renderTile = (tile: LauncherTile) => {
    const Icon = tile.icon;
    return (
      <button
        key={tile.key}
        type="button"
        onClick={() => onSelectNav(tile.key)}
        className="mes-panel group flex min-h-[108px] flex-col justify-between rounded-lg p-3.5 text-left transition-all duration-150 hover:border-teal-500/70 hover:bg-teal-50/25 active:scale-[0.99]"
      >
        <div className="flex items-start justify-between gap-2">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors ${tile.accentClass}`}
          >
            <Icon className="h-4 w-4" />
          </div>
          {tile.metricText && (
            <span
              className={`font-mono text-[11px] font-semibold tabular-nums text-right ${
                tile.highlight ? 'text-teal-700' : 'text-slate-400'
              }`}
            >
              {tile.metricText}
            </span>
          )}
        </div>

        <div className="mt-3">
          <div className="text-sm font-semibold leading-snug text-slate-900 group-hover:text-teal-900">
            {tile.title}
          </div>
          <div className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">{tile.desc}</div>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-5">
      {/* Deep Carbon Industrial Warehouse PDA Queue Console Banner */}
      <section className="rounded-lg bg-[#11161e] px-4 py-4 text-slate-100 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-sm font-semibold tracking-tight text-white sm:text-base">
              仓库 PDA 单功能作业控制台
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              严格职权分离：仓库接收采购下发待收清单完成初收并通知 IQC，待 IQC 放行后执行入库上架
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2 border-t border-white/[0.08] pt-3 sm:border-t-0 sm:pt-0 sm:gap-4">
            <div className="sm:text-right">
              <div className="text-[11px] text-slate-400">待收料</div>
              <div className="font-mono text-base font-bold text-teal-300 tabular-nums">
                {arrivalCount + receivingCount}
              </div>
            </div>
            <div className="sm:text-right" title="已发送报检通知，等待 IQC 品质部独立检验">
              <div className="text-[11px] text-slate-400">已报检(IQC)</div>
              <div
                className={`font-mono text-base font-bold tabular-nums ${
                  iqcCount > 0 ? 'text-amber-300' : 'text-slate-400'
                }`}
              >
                {iqcCount}
              </div>
            </div>
            <div className="sm:text-right">
              <div className="text-[11px] text-slate-400">IQC放行待入</div>
              <div
                className={`font-mono text-base font-bold tabular-nums ${
                  putawayCount > 0 ? 'text-emerald-300' : 'text-slate-300'
                }`}
              >
                {putawayCount}
              </div>
            </div>
            <div className="sm:text-right">
              <div className="text-[11px] text-slate-400">待发波次</div>
              <div className="font-mono text-base font-bold text-white tabular-nums">
                {openWaveCount}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Group 1: Warehouse Receiving & Putaway (Strictly decoupled from Procurement & IQC) */}
      <section className="space-y-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-1">
          <h3 className="text-xs font-semibold text-slate-700">仓库收料与入库作业</h3>
          <span className="text-[11px] text-slate-400">
            到货签到 → 待收料初收(通知IQC) → IQC放行后仓库入库
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 lg:grid-cols-4 sm:gap-3">
          {inboundTiles.map((tile) => renderTile(tile))}
        </div>
      </section>

      {/* Group 2: Picking, Line Support & Inventory Ops */}
      <section className="space-y-2.5">
        <h3 className="text-xs font-semibold text-slate-700">发料、产线与在库扫码作业</h3>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 sm:gap-3">
          {outboundStockTiles.map((tile) => renderTile(tile))}
        </div>
      </section>

      {/* Quick Warehouse Planning Shortcuts (NO Procurement ASN creation) */}
      <section className="flex flex-wrap items-center gap-2 border-t border-slate-200/90 pt-4 text-xs">
        <span className="font-medium text-slate-500">仓库计划建单：</span>
        <button
          type="button"
          onClick={() => onSelectNav('wavePlan')}
          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 transition-colors hover:border-teal-300 hover:bg-teal-50/40 hover:text-teal-800"
        >
          <Layers className="h-3.5 w-3.5 text-teal-700" />
          波次排产建单 ({plannedWoCount} 待排工单)
        </button>
        <button
          type="button"
          onClick={() => onSelectNav('countPlan')}
          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 transition-colors hover:border-teal-300 hover:bg-teal-50/40 hover:text-teal-800"
        >
          <SlidersHorizontal className="h-3.5 w-3.5 text-teal-700" />
          盘点任务建单
        </button>
      </section>
    </div>
  );
}
