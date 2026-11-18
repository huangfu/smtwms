import { Download, FileSpreadsheet, Plus, Trash2, Upload } from 'lucide-react';
import { useState } from 'react';
import type { AsnOrder, WmsState } from '../types/wms';
import { ASN_STATUS_LABEL, formatTime } from '../utils/formatters';
import { parseAsnCsv } from '../utils/wmsLogic';

interface AsnManagerPanelProps {
  state: WmsState;
  onCreateAsn: (payload: {
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
  onImportAsnCsv: (payload: {
    csvText: string;
    warehouseCode?: string;
    purchaser?: string;
    notes?: string;
  }) => Promise<AsnOrder>;
  onCancelAsn: (asnNo: string) => Promise<void>;
  onReceiveAsn: (asn: AsnOrder, lineId?: string) => void;
}

const SAMPLE_CSV = `PO号,供应商,预计到货日,SKU/MPN,数量,批次Lot,周期DateCode,建议库位
PO-20261118-01,艾睿电子(Arrow),2026-11-18,STM32F407VET6,1000,ST2646M1,2646,MSD-01-01
PO-20261118-01,艾睿电子(Arrow),2026-11-18,BM04B-GHS-TBT,1000,JS2646M2,2646,B-02-01`;

export function AsnManagerPanel({
  state,
  onCreateAsn,
  onImportAsnCsv,
  onCancelAsn,
  onReceiveAsn,
}: AsnManagerPanelProps) {
  const [createMode, setCreateMode] = useState<'manual' | 'upload'>('manual');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'COMPLETED'>('ALL');

  // Manual ASN state
  const [poNo, setPoNo] = useState('PO-20261117-12');
  const [supplierCode, setSupplierCode] = useState(state.suppliers[0]?.supplierCode ?? '');
  const [warehouseCode, setWarehouseCode] = useState(
    state.warehouses[0]?.warehouseCode ?? 'WH-SMT-01'
  );
  const [expectedDate, setExpectedDate] = useState('2026-11-18');
  const [purchaser, setPurchaser] = useState('林采购');
  const [notes, setNotes] = useState('');
  const [draftSku, setDraftSku] = useState(state.materials[0]?.skuCode ?? '');
  const [draftQty, setDraftQty] = useState('1000');
  const [draftLot, setDraftLot] = useState('');
  const [draftDc, setDraftDc] = useState('2646');
  const [draftLines, setDraftLines] = useState<
    {
      skuCode: string;
      expectedQty: number;
      lotNumber?: string;
      dateCode?: string;
      targetBin?: string;
    }[]
  >([
    {
      skuCode: 'MAT-CON-001',
      expectedQty: 500,
      lotNumber: 'JS2646B1',
      dateCode: '2646',
      targetBin: 'B-02-01',
    },
  ]);

  // CSV Upload state
  const [csvText, setCsvText] = useState('');
  const [csvWarehouse, setCsvWarehouse] = useState(
    state.warehouses[0]?.warehouseCode ?? 'WH-SMT-01'
  );
  const [csvPurchaser, setCsvPurchaser] = useState('采购专员');
  const [csvNotes, setCsvNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  let csvPreview: ReturnType<typeof parseAsnCsv> | null = null;
  let csvParseErr: string | null = null;
  if (createMode === 'upload' && csvText.trim()) {
    try {
      csvPreview = parseAsnCsv(csvText, state, {
        warehouseCode: csvWarehouse,
        purchaser: csvPurchaser,
      });
    } catch (e) {
      csvParseErr = e instanceof Error ? e.message : 'CSV解析失败';
    }
  }

  const handleAddDraftLine = () => {
    const mat = state.materials.find((m) => m.skuCode === draftSku);
    if (!mat) return;
    const qtyNum = Number(draftQty);
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) return;
    setDraftLines((prev) => [
      ...prev,
      {
        skuCode: mat.skuCode,
        expectedQty: Math.round(qtyNum),
        lotNumber: draftLot.trim() || undefined,
        dateCode: draftDc.trim() || undefined,
        targetBin: mat.defaultBin,
      },
    ]);
    setDraftLot('');
  };

  const handleCreateManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setSubmitting(true);
    try {
      const asn = await onCreateAsn({
        poNo,
        supplierCode,
        warehouseCode,
        expectedDate,
        purchaser,
        notes,
        lines: draftLines,
      });
      setMsg(`已手动生成收料通知单 ${asn.asnNo}（共 ${asn.lines.length} 行物料）`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '创建ASN失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCsvFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
    setErr(null);
    setMsg(null);
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob(['\uFEFF' + SAMPLE_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'SMT-WMS-采购ASN导入模板.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCsvSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setSubmitting(true);
    try {
      const asn = await onImportAsnCsv({
        csvText,
        warehouseCode: csvWarehouse,
        purchaser: csvPurchaser,
        notes: csvNotes,
      });
      setMsg(`采购CSV已导入并生成收料单 ${asn.asnNo}（${asn.supplierName}）`);
      setCsvText('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'CSV导入ASN失败');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredAsns = state.asns.filter((a) => {
    if (statusFilter === 'OPEN') return a.status === 'PENDING' || a.status === 'PARTIAL';
    if (statusFilter === 'COMPLETED') return a.status === 'COMPLETED';
    return true;
  });

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      {/* Left: Create Manual ASN or Procurement CSV Upload */}
      <section className="rounded-lg border border-slate-200 bg-white p-6 xl:col-span-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              采购 ASN 收料预约制单
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              支持采购上传CSV送货清单或仓库手动开立ASN预约到货单
            </p>
          </div>
        </div>

        <div className="mt-4 inline-flex rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => {
              setCreateMode('manual');
              setErr(null);
              setMsg(null);
            }}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs whitespace-nowrap shrink-0 ${
              createMode === 'manual'
                ? 'bg-white font-semibold text-sky-800 shadow-sm border border-slate-200/80'
                : 'font-medium text-slate-600 hover:text-slate-900 border border-transparent'
            }`}
          >
            <Plus className="h-3.5 w-3.5" />
            手动产生收料ASN
          </button>
          <button
            type="button"
            onClick={() => {
              setCreateMode('upload');
              setErr(null);
              setMsg(null);
            }}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs whitespace-nowrap shrink-0 ${
              createMode === 'upload'
                ? 'bg-white font-semibold text-sky-800 shadow-sm border border-slate-200/80'
                : 'font-medium text-slate-600 hover:text-slate-900 border border-transparent'
            }`}
          >
            <Upload className="h-3.5 w-3.5" />
            采购上传CSV导入ASN
          </button>
        </div>

        {createMode === 'manual' ? (
          <form onSubmit={handleCreateManualSubmit} className="mt-4 space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="asn-po" className="block text-xs font-medium text-slate-700">
                  采购单号 (PO) <span className="text-red-600">*</span>
                </label>
                <input
                  id="asn-po"
                  type="text"
                  required
                  value={poNo}
                  onChange={(e) => setPoNo(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-xs text-slate-900"
                />
              </div>
              <div>
                <label htmlFor="asn-date" className="block text-xs font-medium text-slate-700">
                  预计到货日期
                </label>
                <input
                  id="asn-date"
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-xs text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="asn-sup" className="block text-xs font-medium text-slate-700">
                  供应商档案 <span className="text-red-600">*</span>
                </label>
                <select
                  id="asn-sup"
                  value={supplierCode}
                  onChange={(e) => setSupplierCode(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                >
                  {state.suppliers.map((s) => (
                    <option key={s.supplierCode} value={s.supplierCode}>
                      {s.supplierName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="asn-wh" className="block text-xs font-medium text-slate-700">
                  收货入库仓库
                </label>
                <select
                  id="asn-wh"
                  value={warehouseCode}
                  onChange={(e) => setWarehouseCode(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
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
                <label htmlFor="asn-purchaser" className="block text-xs font-medium text-slate-700">
                  采购制单人
                </label>
                <input
                  id="asn-purchaser"
                  type="text"
                  value={purchaser}
                  onChange={(e) => setPurchaser(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900"
                />
              </div>
              <div>
                <label htmlFor="asn-notes" className="block text-xs font-medium text-slate-700">
                  到货备注
                </label>
                <input
                  id="asn-notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="如 加急件/需IQC全检"
                  className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900"
                />
              </div>
            </div>

            {/* Line builder */}
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2.5">
              <div className="text-xs font-medium text-slate-700">添加预计到货物料明细</div>
              <div className="grid grid-cols-12 gap-2">
                <select
                  aria-label="选择ASN物料"
                  value={draftSku}
                  onChange={(e) => setDraftSku(e.target.value)}
                  className="col-span-7 rounded border border-slate-300 bg-white px-2 py-1.5 text-xs"
                >
                  {state.materials.map((m) => (
                    <option key={m.skuCode} value={m.skuCode}>
                      {m.mpn} ({m.skuCode})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  aria-label="预计到货数量"
                  value={draftQty}
                  onChange={(e) => setDraftQty(e.target.value)}
                  placeholder="数量"
                  className="col-span-5 rounded border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs"
                />
              </div>
              <div className="grid grid-cols-12 gap-2">
                <input
                  type="text"
                  aria-label="预填批次Lot"
                  value={draftLot}
                  onChange={(e) => setDraftLot(e.target.value)}
                  placeholder="预填Lot (可选)"
                  className="col-span-5 rounded border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs"
                />
                <input
                  type="text"
                  aria-label="预填周期DateCode"
                  maxLength={4}
                  value={draftDc}
                  onChange={(e) => setDraftDc(e.target.value)}
                  placeholder="D/C 2646"
                  className="col-span-4 rounded border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddDraftLine}
                  className="col-span-3 rounded border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                >
                  添加行
                </button>
              </div>

              <ul className="space-y-1.5 pt-1">
                {draftLines.map((line, i) => {
                  const mat = state.materials.find((m) => m.skuCode === line.skuCode);
                  return (
                    <li
                      key={`${line.skuCode}-${i}`}
                      className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                    >
                      <div className="min-w-0">
                        <span className="font-mono font-semibold text-slate-900">
                          {mat?.mpn ?? line.skuCode}
                        </span>
                        <span className="ml-2 font-mono text-slate-600 tabular-nums">
                          {line.expectedQty.toLocaleString()} {mat?.unit ?? 'PCS'}
                        </span>
                        {line.lotNumber && (
                          <span className="ml-2 font-mono text-[11px] text-slate-400">
                            Lot {line.lotNumber}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        aria-label={`移除物料 ${mat?.mpn ?? line.skuCode}`}
                        onClick={() =>
                          setDraftLines((prev) => prev.filter((_, idx) => idx !== i))
                        }
                        className="text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {err && (
              <div
                role="alert"
                className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
              >
                {err}
              </div>
            )}
            {msg && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                {msg}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || draftLines.length === 0}
              className="w-full rounded-md bg-sky-700 px-4 py-2.5 text-xs font-medium text-white hover:bg-sky-800 disabled:opacity-50"
            >
              {submitting ? '正在生成ASN...' : '生成收料预约 ASN 单'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleImportCsvSubmit} className="mt-4 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                <FileSpreadsheet className="h-4 w-4 text-sky-700" />
                采购送货单 CSV 上传或粘贴
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap"
                >
                  <Download className="h-3.5 w-3.5" />
                  下载模板
                </button>
                <button
                  type="button"
                  onClick={() => setCsvText(SAMPLE_CSV)}
                  className="text-xs font-medium text-sky-700 hover:text-sky-800 whitespace-nowrap"
                >
                  填入采购示例CSV
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="asn-csv-file"
                className="block text-xs font-medium text-slate-700"
              >
                选择本地 CSV 文件上传 (可选)
              </label>
              <input
                id="asn-csv-file"
                type="file"
                accept=".csv,.txt"
                onChange={handleCsvFileUpload}
                className="mt-1 block w-full text-xs text-slate-600 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-50"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="csv-wh" className="block text-xs font-medium text-slate-700">
                  默认收货仓库
                </label>
                <select
                  id="csv-wh"
                  value={csvWarehouse}
                  onChange={(e) => setCsvWarehouse(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  {state.warehouses.map((w) => (
                    <option key={w.warehouseCode} value={w.warehouseCode}>
                      {w.warehouseName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="csv-purchaser" className="block text-xs font-medium text-slate-700">
                  上传采购员
                </label>
                <input
                  id="csv-purchaser"
                  type="text"
                  value={csvPurchaser}
                  onChange={(e) => setCsvPurchaser(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
                />
              </div>
            </div>

            <div>
              <label htmlFor="asn-csv-text" className="block text-xs font-medium text-slate-700">
                CSV 内容 (PO号,供应商,预计到货日,SKU/MPN,数量,Lot,DateCode,库位)
              </label>
              <textarea
                id="asn-csv-text"
                rows={5}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={SAMPLE_CSV}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-[11px] text-slate-900 focus:border-sky-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="csv-notes" className="block text-xs font-medium text-slate-700">
                导入备注
              </label>
              <input
                id="csv-notes"
                type="text"
                value={csvNotes}
                onChange={(e) => setCsvNotes(e.target.value)}
                placeholder="如 采购部每周例行到货清单"
                className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
              />
            </div>

            {csvParseErr && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                解析提示: {csvParseErr}
              </div>
            )}

            {csvPreview && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900">
                <div className="font-semibold">
                  解析就绪: PO <span className="font-mono">{csvPreview.poNo}</span> ·{' '}
                  {csvPreview.supplierName} ({csvPreview.lines.length} 项)
                </div>
                <ul className="mt-1.5 space-y-0.5 font-mono text-[11px] text-emerald-800">
                  {csvPreview.lines.map((l, idx) => (
                    <li key={idx}>
                      {l.skuCode} · {l.expectedQty.toLocaleString()} PCS · 库位 {l.targetBin}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {err && (
              <div
                role="alert"
                className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
              >
                {err}
              </div>
            )}
            {msg && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                {msg}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !csvPreview}
              className="w-full rounded-md bg-sky-700 px-4 py-2.5 text-xs font-medium text-white hover:bg-sky-800 disabled:opacity-50"
            >
              {submitting ? '正在导入ASN...' : '确认导入采购ASN收料单'}
            </button>
          </form>
        )}
      </section>

      {/* Right: ASN Ledger & Progress */}
      <section className="rounded-lg border border-slate-200 bg-white xl:col-span-7">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              收料 ASN 通知单台账 ({filteredAsns.length} 单)
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              点击“按此ASN收料”将自动回填物料、供应商与预约数量进入扫码赋码入库流程
            </p>
          </div>
          <div className="inline-flex items-center gap-1 rounded-md bg-slate-100 p-1">
            {[
              { id: 'ALL', label: '全部' },
              { id: 'OPEN', label: '待收/部分' },
              { id: 'COMPLETED', label: '已完结' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setStatusFilter(t.id as typeof statusFilter)}
                className={`rounded px-2.5 py-1 text-xs whitespace-nowrap ${
                  statusFilter === t.id
                    ? 'bg-white font-semibold text-sky-800 shadow-sm border border-slate-200/80'
                    : 'font-medium text-slate-600 hover:text-slate-900 border border-transparent'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-slate-200">
          {filteredAsns.length === 0 ? (
            <div className="px-5 py-10 text-center text-xs text-slate-500">
              暂无符合条件的 ASN 收料通知单
            </div>
          ) : (
            filteredAsns.map((asn) => {
              const st = ASN_STATUS_LABEL[asn.status];
              const wh = state.warehouses.find((w) => w.warehouseCode === asn.warehouseCode);
              const totalExp = asn.lines.reduce((s, l) => s + l.expectedQty, 0);
              const totalRec = asn.lines.reduce((s, l) => s + l.receivedQty, 0);
              const pct = totalExp > 0 ? Math.min(100, Math.round((totalRec / totalExp) * 100)) : 0;
              const isOpen = asn.status === 'PENDING' || asn.status === 'PARTIAL';

              return (
                <div key={asn.asnNo} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-mono text-sm font-bold text-slate-900">
                          {asn.asnNo}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className={`font-semibold ${st.toneClass}`}>{st.label}</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-500">
                          {asn.source === 'UPLOAD_CSV' ? '采购CSV上传' : '手动开立'}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                        <span>PO <span className="font-mono font-medium">{asn.poNo}</span></span>
                        <span className="text-slate-300">·</span>
                        <span>{asn.supplierName}</span>
                        <span className="text-slate-300">·</span>
                        <span>{wh?.warehouseName ?? asn.warehouseCode}</span>
                        <span className="text-slate-300">·</span>
                        <span className="font-mono">预计 {asn.expectedDate}</span>
                      </div>
                      {asn.notes && (
                        <div className="mt-1 text-[11px] text-slate-500">{asn.notes}</div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isOpen && (
                        <>
                          <button
                            type="button"
                            onClick={() => onReceiveAsn(asn)}
                            className="rounded-md bg-sky-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-800 whitespace-nowrap"
                          >
                            按此ASN收料
                          </button>
                          <button
                            type="button"
                            onClick={() => onCancelAsn(asn.asnNo)}
                            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 whitespace-nowrap"
                          >
                            作废
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3 flex items-center gap-3 text-xs">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full ${
                          asn.status === 'COMPLETED' ? 'bg-emerald-600' : 'bg-sky-600'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="font-mono text-[11px] text-slate-600 tabular-nums whitespace-nowrap">
                      已收 {totalRec.toLocaleString()} / 预约 {totalExp.toLocaleString()} ({pct}%)
                    </span>
                  </div>

                  {/* Lines table */}
                  <div className="mt-3 overflow-x-auto rounded border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                        <tr>
                          <th className="px-3 py-2 font-medium whitespace-nowrap">物料 MPN / SKU</th>
                          <th className="px-3 py-2 font-medium whitespace-nowrap">预填批号/周期</th>
                          <th className="px-3 py-2 font-medium whitespace-nowrap">建议库位</th>
                          <th className="px-3 py-2 font-medium text-right whitespace-nowrap">已收 / 预约</th>
                          <th className="px-3 py-2 font-medium text-right whitespace-nowrap">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {asn.lines.map((line) => {
                          const rem = Math.max(0, line.expectedQty - line.receivedQty);
                          return (
                            <tr key={line.lineId} className="hover:bg-slate-50">
                              <td className="px-3 py-2">
                                <div className="font-mono font-medium text-slate-900">{line.mpn}</div>
                                <div className="font-mono text-[11px] text-slate-400">{line.skuCode}</div>
                              </td>
                              <td className="px-3 py-2 font-mono text-slate-600 whitespace-nowrap">
                                {line.lotNumber || '-'} · {line.dateCode || '-'}
                              </td>
                              <td className="px-3 py-2 font-mono text-slate-700 whitespace-nowrap">
                                {line.targetBin || '-'}
                              </td>
                              <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap">
                                <span className="font-semibold text-slate-900">
                                  {line.receivedQty.toLocaleString()}
                                </span>
                                <span className="text-slate-400">
                                  {' '}
                                  / {line.expectedQty.toLocaleString()}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right whitespace-nowrap">
                                {isOpen && rem > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => onReceiveAsn(asn, line.lineId)}
                                    className="font-medium text-sky-700 hover:underline"
                                  >
                                    收料 (余{rem})
                                  </button>
                                ) : (
                                  <span className="text-emerald-700 font-medium">已收齐</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                    <span>采购员 {asn.purchaser}</span>
                    <span className="font-mono">建单 {formatTime(asn.createdAt)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
