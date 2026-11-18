import {
  AlertTriangle,
  ArrowRight,
  Barcode,
  CheckCircle2,
  ClipboardList,
  PackageCheck,
  Plus,
  X,
} from 'lucide-react';
import { useState } from 'react';
import type { AsnOrder, ReelItem, WmsState } from '../types/wms';
import { computeLowStockAlerts, type LowStockAlertItem } from '../utils/wmsLogic';
import type { NavKey } from './Sidebar';

interface LowStockAlertPanelProps {
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
}

export function LowStockAlertPanel({
  state,
  onNavigate,
  onGoInboundWithSku,
  onQuickInbound,
  onQuickCreateAsn,
  onOpenLabel,
}: LowStockAlertPanelProps) {
  const alerts = computeLowStockAlerts(state);

  const [activeAlert, setActiveAlert] = useState<LowStockAlertItem | null>(null);
  const [mode, setMode] = useState<'inbound' | 'asn'>('inbound');

  // Direct quick inbound fields
  const [qty, setQty] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [dateCode, setDateCode] = useState('2646');
  const [binCode, setBinCode] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [operator, setOperator] = useState(
    state.keepers[0] ? `${state.keepers[0].name} (${state.keepers[0].role})` : '张伟 (仓库主管)'
  );

  // Quick ASN fields
  const [poNo, setPoNo] = useState('');
  const [supplierCode, setSupplierCode] = useState('');
  const [warehouseCode, setWarehouseCode] = useState('');
  const [expectedDate, setExpectedDate] = useState('2026-11-18');
  const [purchaser, setPurchaser] = useState('林采购');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdReel, setCreatedReel] = useState<ReelItem | null>(null);
  const [createdAsn, setCreatedAsn] = useState<AsnOrder | null>(null);

  const openQuickReplenish = (item: LowStockAlertItem, initialMode: 'inbound' | 'asn' = 'inbound') => {
    setActiveAlert(item);
    setMode(initialMode);
    setQty(String(item.deficitQty));
    setLotNumber(`REP${new Date().toISOString().slice(2, 10).replace(/-/g, '')}`);
    setDateCode('2646');
    setBinCode(item.defaultBin);
    setSupplierName(item.preferredSupplierName);
    setPoNo(`PO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-R1`);
    setSupplierCode(item.preferredSupplierCode || state.suppliers[0]?.supplierCode || '');
    setWarehouseCode(item.defaultWarehouseCode || state.warehouses[0]?.warehouseCode || '');
    setError(null);
    setCreatedReel(null);
    setCreatedAsn(null);
  };

  const closeQuickModal = () => {
    setActiveAlert(null);
    setError(null);
    setCreatedReel(null);
    setCreatedAsn(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAlert) return;
    setError(null);
    setSubmitting(true);
    try {
      const numericQty = Number(qty);
      if (!Number.isFinite(numericQty) || numericQty <= 0) {
        throw new Error('补货数量必须大于 0');
      }
      if (mode === 'inbound') {
        const reel = await onQuickInbound({
          skuCode: activeAlert.skuCode,
          lotNumber,
          dateCode,
          supplier: supplierName,
          qty: numericQty,
          binCode,
          operator,
          reason: `低库存安全水位快速补货入库 (原可用 ${activeAlert.availableQty}/${activeAlert.safetyStock})`,
        });
        setCreatedReel(reel);
      } else {
        const asn = await onQuickCreateAsn({
          poNo,
          supplierCode,
          warehouseCode,
          expectedDate,
          purchaser,
          notes: `安全库存低水位快速补货预约 (${activeAlert.mpn})`,
          lines: [
            {
              skuCode: activeAlert.skuCode,
              expectedQty: Math.round(numericQty),
              lotNumber: lotNumber.trim() || undefined,
              dateCode: dateCode.trim() || undefined,
              targetBin: binCode,
            },
          ],
        });
        setCreatedAsn(asn);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '快速补货提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section aria-label="低库存安全水位预警" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2.5">
          <h2 className="text-sm font-semibold text-slate-900">
            低库存安全水位预警
          </h2>
          <span className="font-mono text-xs text-slate-500 tabular-nums">
            {alerts.length > 0
              ? `共 ${alerts.length} 种物料低于安全库存`
              : '全仓安全库存受控'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('master')}
          className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:text-sky-800 whitespace-nowrap shrink-0"
        >
          调整安全库存线
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {alerts.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-5 py-4 text-xs">
          <div className="flex items-center gap-2 text-emerald-700 font-medium">
            <PackageCheck className="h-4 w-4 shrink-0" />
            <span>所有已设定安全库存的电子物料当前均处于安全水位以上</span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('inbound')}
            className="text-xs font-medium text-sky-700 hover:text-sky-800 whitespace-nowrap shrink-0"
          >
            前往常规入库
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {alerts.map((item) => {
            const isCritical = item.severity === 'CRITICAL';
            return (
              <article
                key={item.skuCode}
                aria-label={`低库存预警卡片 ${item.mpn}`}
                className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-4"
              >
                <div>
                  {/* Quiet metadata + severity indicator (no static pills) */}
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-500 truncate">
                      <span className="font-mono">{item.skuCode}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.category}</span>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 font-semibold whitespace-nowrap shrink-0 ${
                        isCritical ? 'text-red-700' : 'text-amber-700'
                      }`}
                    >
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      {item.availableQty === 0
                        ? '零库存断料'
                        : isCritical
                          ? '严重低仓'
                          : '低于安全线'}
                    </span>
                  </div>

                  {/* MPN & Name */}
                  <div className="mt-2">
                    <div className="font-mono text-sm font-bold text-slate-900 truncate">
                      {item.mpn}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-600 truncate" title={item.name}>
                      {item.name}
                    </div>
                  </div>

                  {/* Current Qty vs Safety Stock & Deficit */}
                  <div className="mt-3 flex items-baseline justify-between gap-2">
                    <div className="font-mono tabular-nums">
                      <span
                        className={`text-lg font-bold ${
                          isCritical ? 'text-red-700' : 'text-amber-700'
                        }`}
                      >
                        {item.availableQty.toLocaleString()}
                      </span>
                      <span className="ml-1 text-xs text-slate-400">
                        / {item.safetyStock.toLocaleString()} {item.unit}
                      </span>
                    </div>
                    <div className="font-mono text-xs font-semibold text-red-700 tabular-nums whitespace-nowrap">
                      缺口 {item.deficitQty.toLocaleString()} {item.unit}
                    </div>
                  </div>

                  {/* Coverage progress bar */}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full ${isCritical ? 'bg-red-600' : 'bg-amber-500'}`}
                        style={{ width: `${Math.max(4, item.coveragePct)}%` }}
                      />
                    </div>
                    <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                      {item.coveragePct}%
                    </span>
                  </div>

                  {/* Context: Default Bin, Pending ASN, Line-side */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                    <span>
                      库位 <span className="font-mono text-slate-700">{item.defaultBin}</span>
                    </span>
                    {item.pendingAsnQty > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-medium text-sky-700 tabular-nums">
                          在途ASN +{item.pendingAsnQty.toLocaleString()} {item.unit}
                        </span>
                      </>
                    )}
                    {item.lineSideQty > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                          线边 {item.lineSideQty.toLocaleString()} {item.unit}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    aria-label={`快速补货 ${item.mpn}`}
                    onClick={() => openQuickReplenish(item, 'inbound')}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-sky-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-800 whitespace-nowrap"
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0" />
                    快速补货
                  </button>
                  <button
                    type="button"
                    aria-label={`前往完整入库 ${item.mpn}`}
                    onClick={() => onGoInboundWithSku(item.skuCode)}
                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                  >
                    完整入库
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Quick Replenishment Modal */}
      {activeAlert && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`快速补货 ${activeAlert.mpn}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
        >
          <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  快速补货 — <span className="font-mono">{activeAlert.mpn}</span>
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {activeAlert.skuCode} · {activeAlert.name} · 当前可用{' '}
                  <span className="font-mono font-semibold text-red-700 tabular-nums">
                    {activeAlert.availableQty.toLocaleString()}
                  </span>{' '}
                  / 安全线{' '}
                  <span className="font-mono tabular-nums">
                    {activeAlert.safetyStock.toLocaleString()}
                  </span>{' '}
                  {activeAlert.unit}
                </p>
              </div>
              <button
                type="button"
                aria-label="关闭快速补货窗口"
                onClick={closeQuickModal}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 pt-4">
              <div className="inline-flex w-full rounded-lg bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode('inbound');
                    setError(null);
                  }}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs whitespace-nowrap ${
                    mode === 'inbound'
                      ? 'bg-white font-semibold text-sky-800 shadow-sm border border-slate-200/80'
                      : 'font-medium text-slate-600 hover:text-slate-900 border border-transparent'
                  }`}
                >
                  <Plus className="h-3.5 w-3.5" />
                  直接收料入库 (赋UID上架)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('asn');
                    setError(null);
                  }}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs whitespace-nowrap ${
                    mode === 'asn'
                      ? 'bg-white font-semibold text-sky-800 shadow-sm border border-slate-200/80'
                      : 'font-medium text-slate-600 hover:text-slate-900 border border-transparent'
                  }`}
                >
                  <ClipboardList className="h-3.5 w-3.5" />
                  下达采购补货 ASN 预约
                </button>
              </div>
            </div>

            {createdReel ? (
              <div className="space-y-4 p-5">
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900">
                  <div className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>
                      快速补货入库成功！已赋码 <span className="font-mono">{createdReel.reelId}</span>
                    </span>
                  </div>
                  <div className="mt-1.5 font-mono text-[11px] text-emerald-800">
                    {createdReel.mpn} · +{createdReel.qty.toLocaleString()} {activeAlert.unit} · 库位{' '}
                    {createdReel.binCode}
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onOpenLabel(createdReel);
                      closeQuickModal();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Barcode className="h-3.5 w-3.5" />
                    打印UID标签
                  </button>
                  <button
                    type="button"
                    onClick={closeQuickModal}
                    className="rounded-md bg-sky-700 px-4 py-2 text-xs font-medium text-white hover:bg-sky-800"
                  >
                    完成并返回看板
                  </button>
                </div>
              </div>
            ) : createdAsn ? (
              <div className="space-y-4 p-5">
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900">
                  <div className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>
                      已生成补货 ASN 预约单 <span className="font-mono">{createdAsn.asnNo}</span>
                    </span>
                  </div>
                  <div className="mt-1.5 font-mono text-[11px] text-emerald-800">
                    PO {createdAsn.poNo} · {createdAsn.supplierName} · 预计 {createdAsn.expectedDate}
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      closeQuickModal();
                      onGoInboundWithSku(activeAlert.skuCode);
                    }}
                    className="rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    前往ASN收料中心
                  </button>
                  <button
                    type="button"
                    onClick={closeQuickModal}
                    className="rounded-md bg-sky-700 px-4 py-2 text-xs font-medium text-white hover:bg-sky-800"
                  >
                    完成并返回看板
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3.5 p-5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="qr-qty" className="block text-xs font-medium text-slate-700">
                      补货数量 ({activeAlert.unit}) <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="qr-qty"
                      type="number"
                      min={1}
                      required
                      value={qty}
                      onChange={(e) => setQty(e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-xs tabular-nums"
                    />
                  </div>
                  {mode === 'inbound' ? (
                    <div>
                      <label htmlFor="qr-bin" className="block text-xs font-medium text-slate-700">
                        上架目标库位
                      </label>
                      <select
                        id="qr-bin"
                        value={binCode}
                        onChange={(e) => setBinCode(e.target.value)}
                        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs"
                      >
                        {state.bins.map((b) => (
                          <option key={b.binCode} value={b.binCode}>
                            {b.binCode} ({b.zone})
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label htmlFor="qr-po" className="block text-xs font-medium text-slate-700">
                        采购单号 (PO) <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="qr-po"
                        type="text"
                        required
                        value={poNo}
                        onChange={(e) => setPoNo(e.target.value)}
                        className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-xs"
                      />
                    </div>
                  )}
                </div>

                {mode === 'inbound' ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="qr-lot" className="block text-xs font-medium text-slate-700">
                          供应商批次 (Lot) <span className="text-red-600">*</span>
                        </label>
                        <input
                          id="qr-lot"
                          type="text"
                          required
                          value={lotNumber}
                          onChange={(e) => setLotNumber(e.target.value)}
                          className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label htmlFor="qr-dc" className="block text-xs font-medium text-slate-700">
                          周期码 (DateCode 4位) <span className="text-red-600">*</span>
                        </label>
                        <input
                          id="qr-dc"
                          type="text"
                          required
                          maxLength={4}
                          value={dateCode}
                          onChange={(e) => setDateCode(e.target.value)}
                          className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-xs"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="qr-sup" className="block text-xs font-medium text-slate-700">
                          供应商
                        </label>
                        <select
                          id="qr-sup"
                          value={supplierName}
                          onChange={(e) => setSupplierName(e.target.value)}
                          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                        >
                          {state.suppliers.map((s) => (
                            <option key={s.supplierCode} value={s.supplierName}>
                              {s.supplierName}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="qr-op" className="block text-xs font-medium text-slate-700">
                          收料操作员
                        </label>
                        <select
                          id="qr-op"
                          value={operator}
                          onChange={(e) => setOperator(e.target.value)}
                          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                        >
                          {state.keepers.map((k) => {
                            const val = `${k.name} (${k.role})`;
                            return (
                              <option key={k.keeperId} value={val}>
                                {val}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="qr-sup-code" className="block text-xs font-medium text-slate-700">
                          供应商档案
                        </label>
                        <select
                          id="qr-sup-code"
                          value={supplierCode}
                          onChange={(e) => setSupplierCode(e.target.value)}
                          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                        >
                          {state.suppliers.map((s) => (
                            <option key={s.supplierCode} value={s.supplierCode}>
                              {s.supplierName}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="qr-wh" className="block text-xs font-medium text-slate-700">
                          收货仓库
                        </label>
                        <select
                          id="qr-wh"
                          value={warehouseCode}
                          onChange={(e) => setWarehouseCode(e.target.value)}
                          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                        >
                          {state.warehouses.map((w) => (
                            <option key={w.warehouseCode} value={w.warehouseCode}>
                              {w.warehouseName}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="qr-date" className="block text-xs font-medium text-slate-700">
                          预计到货日
                        </label>
                        <input
                          id="qr-date"
                          type="date"
                          value={expectedDate}
                          onChange={(e) => setExpectedDate(e.target.value)}
                          className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label htmlFor="qr-purch" className="block text-xs font-medium text-slate-700">
                          采购员
                        </label>
                        <input
                          id="qr-purch"
                          type="text"
                          value={purchaser}
                          onChange={(e) => setPurchaser(e.target.value)}
                          className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
                        />
                      </div>
                    </div>
                  </>
                )}

                {error && (
                  <div
                    role="alert"
                    className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
                  >
                    {error}
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      const sku = activeAlert.skuCode;
                      closeQuickModal();
                      onGoInboundWithSku(sku);
                    }}
                    className="text-xs font-medium text-sky-700 hover:text-sky-800 whitespace-nowrap"
                  >
                    跳转完整入库界面
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={closeQuickModal}
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="rounded-md bg-sky-700 px-4 py-1.5 text-xs font-medium text-white hover:bg-sky-800 disabled:opacity-50"
                    >
                      {submitting
                        ? '处理中...'
                        : mode === 'inbound'
                          ? '确认快速入库上架'
                          : '生成补货ASN预约单'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
