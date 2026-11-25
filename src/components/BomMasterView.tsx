import { GitBranch, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import type { BomItem, BomItemRole, BomMaster, WmsState } from '../types/wms';
import { BOM_ROLE_LABEL, formatTime } from '../utils/formatters';

interface BomMasterViewProps {
  state: WmsState;
  onSaveBom: (payload: {
    bomId?: string;
    productCode: string;
    productName: string;
    version: string;
    customerCode?: string;
    processType: string;
    items: BomItem[];
  }) => Promise<void>;
  onDeleteBom: (bomId: string) => Promise<void>;
}

interface UnifiedBomRow {
  bom: BomMaster;
  item: BomItem;
  indexInBom: number;
}

export function BomMasterView({ state, onSaveBom, onDeleteBom }: BomMasterViewProps) {
  const [selectedBomId, setSelectedBomId] = useState<string>('ALL');
  const [roleFilter, setRoleFilter] = useState<'ALL' | BomItemRole>('ALL');
  const [searchText, setSearchText] = useState('');

  // Form mode: add/edit line, edit model header, or create new BOM model
  const [formMode, setFormMode] = useState<'ADD_LINE' | 'NEW_MODEL' | 'EDIT_MODEL'>('ADD_LINE');
  const [targetBomId, setTargetBomId] = useState(state.boms[0]?.bomId ?? '');
  const [editingLine, setEditingLine] = useState<{ bomId: string; index: number } | null>(null);
  const [confirmDeleteRowKey, setConfirmDeleteRowKey] = useState<string | null>(null);
  const [confirmDeleteBomId, setConfirmDeleteBomId] = useState<string | null>(null);

  // New / Edit model fields
  const [newProductCode, setNewProductCode] = useState('');
  const [newProductName, setNewProductName] = useState('');
  const [newVersion, setNewVersion] = useState('V1.0');
  const [newCustomerCode, setNewCustomerCode] = useState(
    state.customers[0]?.customerCode ?? ''
  );
  const [newProcessType, setNewProcessType] = useState('双面SMT + 回流焊 + AOI');

  // Row fields
  const [itemRole, setItemRole] = useState<BomItemRole>('SPECIAL_MAIN');
  const [skuCode, setSkuCode] = useState(state.materials[0]?.skuCode ?? '');
  const [substituteForSku, setSubstituteForSku] = useState('MAT-RES-001');
  const [substitutePriority, setSubstitutePriority] = useState('1');
  const [substituteRatio, setSubstituteRatio] = useState('1');
  const [qtyPerBoard, setQtyPerBoard] = useState('1');
  const [attritionRate, setAttritionRate] = useState('0.02');
  const [designators, setDesignators] = useState('U4');
  const [remark, setRemark] = useState('');

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const uniqueMaterials = Array.from(
    new Map(state.materials.map((m) => [m.skuCode, m])).values()
  );

  const stockBySku = new Map<string, number>();
  for (const r of state.reels) {
    if (r.status === 'IN_STOCK' && r.msdState !== 'BAKING_REQUIRED' && r.qty > 0) {
      stockBySku.set(r.skuCode, (stockBySku.get(r.skuCode) ?? 0) + r.qty);
    }
  }

  const allRows: UnifiedBomRow[] = [];
  for (const bom of state.boms) {
    if (selectedBomId !== 'ALL' && bom.bomId !== selectedBomId) continue;
    bom.items.forEach((item, idx) => {
      const role: BomItemRole = item.itemRole ?? 'MAIN';
      if (roleFilter !== 'ALL' && role !== roleFilter) return;
      if (searchText.trim()) {
        const q = searchText.trim().toUpperCase();
        const mat = uniqueMaterials.find((m) => m.skuCode === item.skuCode);
        const hit =
          bom.productCode.toUpperCase().includes(q) ||
          bom.productName.toUpperCase().includes(q) ||
          item.skuCode.toUpperCase().includes(q) ||
          (mat?.mpn ?? '').toUpperCase().includes(q) ||
          (item.substituteForSku ?? '').toUpperCase().includes(q) ||
          item.designators.toUpperCase().includes(q) ||
          (item.remark ?? '').toUpperCase().includes(q);
        if (!hit) return;
      }
      allRows.push({ bom, item, indexInBom: idx });
    });
  }

  const totalSpecialCount = state.boms.reduce(
    (sum, b) => sum + b.items.filter((i) => i.itemRole === 'SPECIAL_MAIN').length,
    0
  );
  const totalSubCount = state.boms.reduce(
    (sum, b) => sum + b.items.filter((i) => i.itemRole === 'SUBSTITUTE').length,
    0
  );

  const activeTargetBom = state.boms.find((b) => b.bomId === targetBomId) ?? state.boms[0];
  const mainOrSpecialSkusInTargetBom = (activeTargetBom?.items ?? []).filter(
    (i) => i.itemRole !== 'SUBSTITUTE'
  );

  const resetLineEdit = () => {
    setEditingLine(null);
    setRemark('');
  };

  const handleStartEditRow = (row: UnifiedBomRow) => {
    setFormMode('ADD_LINE');
    setTargetBomId(row.bom.bomId);
    setEditingLine({ bomId: row.bom.bomId, index: row.indexInBom });
    setItemRole(row.item.itemRole ?? 'MAIN');
    setSkuCode(row.item.skuCode);
    setSubstituteForSku(row.item.substituteForSku ?? 'MAT-RES-001');
    setSubstitutePriority(String(row.item.substitutePriority ?? 1));
    setSubstituteRatio(String(row.item.substituteRatio ?? 1));
    setQtyPerBoard(String(row.item.qtyPerBoard));
    setAttritionRate(String(row.item.attritionRate));
    setDesignators(row.item.designators);
    setRemark(row.item.remark ?? '');
    setMsg(null);
    setErr(null);
  };

  const handleStartEditModel = (bom: BomMaster) => {
    setFormMode('EDIT_MODEL');
    setTargetBomId(bom.bomId);
    setEditingLine(null);
    setNewProductCode(bom.productCode);
    setNewProductName(bom.productName);
    setNewVersion(bom.version);
    setNewCustomerCode(bom.customerCode ?? '');
    setNewProcessType(bom.processType);
    setMsg(null);
    setErr(null);
  };

  const handleQuickAddSubstitute = (row: UnifiedBomRow) => {
    setEditingLine(null);
    setFormMode('ADD_LINE');
    setTargetBomId(row.bom.bomId);
    setItemRole('SUBSTITUTE');
    setSubstituteForSku(row.item.skuCode);
    setQtyPerBoard(String(row.item.qtyPerBoard));
    setAttritionRate(String(row.item.attritionRate));
    setDesignators(row.item.designators);
    setRemark(`替代 ${row.item.skuCode}`);
    setMsg(null);
    setErr(null);
  };

  const handleRemoveRow = async (row: UnifiedBomRow) => {
    setErr(null);
    setMsg(null);
    if (row.bom.items.length <= 1) {
      setConfirmDeleteRowKey(null);
      setErr('BOM 清单至少需保留一条物料行（如需删除整个机型请点击“删除机型BOM”）');
      return;
    }
    const nextItems = row.bom.items.filter((_, idx) => idx !== row.indexInBom);
    try {
      await onSaveBom({
        bomId: row.bom.bomId,
        productCode: row.bom.productCode,
        productName: row.bom.productName,
        version: row.bom.version,
        customerCode: row.bom.customerCode,
        processType: row.bom.processType,
        items: nextItems,
      });
      setConfirmDeleteRowKey(null);
      if (editingLine?.bomId === row.bom.bomId && editingLine.index === row.indexInBom) {
        resetLineEdit();
      }
      setMsg(`已从 ${row.bom.productCode} 移除行 ${row.item.skuCode}`);
    } catch (e) {
      setConfirmDeleteRowKey(null);
      setErr(e instanceof Error ? e.message : '移除BOM行失败');
    }
  };

  const handleDeleteBomModel = async (bom: BomMaster) => {
    setErr(null);
    setMsg(null);
    try {
      await onDeleteBom(bom.bomId);
      setConfirmDeleteBomId(null);
      if (selectedBomId === bom.bomId) setSelectedBomId('ALL');
      if (formMode === 'EDIT_MODEL' && targetBomId === bom.bomId) setFormMode('ADD_LINE');
      setMsg(`已删除机型 BOM：${bom.productCode}`);
    } catch (e) {
      setConfirmDeleteBomId(null);
      setErr(e instanceof Error ? e.message : '删除机型 BOM 失败');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);

    try {
      if (formMode === 'EDIT_MODEL') {
        if (!activeTargetBom) throw new Error('请选择待修改的机型 BOM');
        await onSaveBom({
          bomId: activeTargetBom.bomId,
          productCode: newProductCode || activeTargetBom.productCode,
          productName: newProductName,
          version: newVersion,
          customerCode: newCustomerCode || undefined,
          processType: newProcessType,
          items: activeTargetBom.items,
        });
        setMsg(`已更新机型 BOM 基本信息：${newProductCode.toUpperCase()} (${newVersion})`);
        setFormMode('ADD_LINE');
        return;
      }

      const linePayload: BomItem = {
        lineId:
          editingLine && activeTargetBom
            ? activeTargetBom.items[editingLine.index]?.lineId ??
              `BL-${Date.now().toString(36).slice(-5).toUpperCase()}`
            : `BL-${Date.now().toString(36).slice(-5).toUpperCase()}`,
        skuCode,
        qtyPerBoard: Math.max(1, Number(qtyPerBoard) || 1),
        attritionRate: Math.max(0, Number(attritionRate) || 0.02),
        designators: designators.trim() || '-',
        itemRole,
        substituteForSku: itemRole === 'SUBSTITUTE' ? substituteForSku : undefined,
        substitutePriority:
          itemRole === 'SUBSTITUTE' ? Math.max(1, Number(substitutePriority) || 1) : undefined,
        substituteRatio:
          itemRole === 'SUBSTITUTE' ? Math.max(0.01, Number(substituteRatio) || 1) : undefined,
        remark: remark.trim() || undefined,
      };

      if (formMode === 'NEW_MODEL') {
        await onSaveBom({
          productCode: newProductCode,
          productName: newProductName,
          version: newVersion,
          customerCode: newCustomerCode || undefined,
          processType: newProcessType,
          items: [linePayload],
        });
        setMsg(`已创建机型 BOM (${newProductCode.toUpperCase()}) 并写入首条物料`);
        setSelectedBomId(`BOM-${newProductCode.trim().toUpperCase().replace(/^PCBA-/, '')}`);
        setNewProductCode('');
        setNewProductName('');
        setRemark('');
      } else {
        if (!activeTargetBom) {
          throw new Error('请先新建一个机型 BOM');
        }
        const nextItems = editingLine
          ? activeTargetBom.items.map((it, idx) =>
              idx === editingLine.index ? linePayload : it
            )
          : [...activeTargetBom.items, linePayload];

        await onSaveBom({
          bomId: activeTargetBom.bomId,
          productCode: activeTargetBom.productCode,
          productName: activeTargetBom.productName,
          version: activeTargetBom.version,
          customerCode: activeTargetBom.customerCode,
          processType: activeTargetBom.processType,
          items: nextItems,
        });
        setMsg(
          editingLine
            ? `已更新 ${activeTargetBom.productCode} BOM行：${skuCode}`
            : `已向 ${activeTargetBom.productCode} 添加 ${BOM_ROLE_LABEL[itemRole].label}: ${skuCode}`
        );
        resetLineEdit();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : '保存 BOM 失败');
    }
  };

  const selectedModelObj =
    selectedBomId !== 'ALL' ? state.boms.find((b) => b.bomId === selectedBomId) : undefined;

  return (
    <div className="space-y-5">
      {/* Compact Header Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-4">
          <div className="text-xs font-medium text-slate-500">已维护机型 BOM</div>
          <div className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {state.boms.length}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-400">支持按机型与工单模板一键下发</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-4">
          <div className="text-xs font-medium text-slate-500">机型独占特料行</div>
          <div className="mt-1 font-mono text-2xl font-bold text-teal-700 tabular-nums">
            {totalSpecialCount}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-400">单表标明机型专配特料及位号</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-4">
          <div className="text-xs font-medium text-slate-500">生效代用关系 (替代料)</div>
          <div className="mt-1 font-mono text-2xl font-bold text-amber-700 tabular-nums">
            {totalSubCount}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-400">主料缺料时可按优先级替代上机</div>
        </div>
      </div>

      {/* Top Full-Width Single-Table Maintenance Form Card */}
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              {editingLine
                ? `修改 BOM 物料行 (${activeTargetBom?.productCode})`
                : formMode === 'EDIT_MODEL'
                  ? `修改机型 BOM 主档 (${activeTargetBom?.productCode})`
                  : 'BOM 单表维护 (特料 / 通用主料 / 替代料代用关系)'}
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              单表维护各机型的特料配置、贴片位号与工程批准的代用替代关系
            </p>
          </div>
          <div className="flex items-center gap-2">
            {editingLine && (
              <button
                type="button"
                onClick={resetLineEdit}
                className="inline-flex items-center gap-1 rounded border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 whitespace-nowrap"
              >
                <X className="h-3.5 w-3.5" />
                取消编辑
              </button>
            )}
            <div className="inline-flex rounded bg-slate-100 p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => {
                  setFormMode('ADD_LINE');
                  setErr(null);
                }}
                className={`rounded px-2.5 py-1 whitespace-nowrap ${
                  formMode === 'ADD_LINE'
                    ? 'bg-white font-semibold text-teal-800 shadow-sm'
                    : 'text-slate-600'
                }`}
              >
                {editingLine ? '编辑行' : '追加行'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (activeTargetBom) handleStartEditModel(activeTargetBom);
                }}
                className={`rounded px-2.5 py-1 whitespace-nowrap ${
                  formMode === 'EDIT_MODEL'
                    ? 'bg-white font-semibold text-teal-800 shadow-sm'
                    : 'text-slate-600'
                }`}
              >
                改机型信息
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingLine(null);
                  setFormMode('NEW_MODEL');
                  setNewProductCode('');
                  setNewProductName('');
                  setErr(null);
                }}
                className={`rounded px-2.5 py-1 whitespace-nowrap ${
                  formMode === 'NEW_MODEL'
                    ? 'bg-white font-semibold text-teal-800 shadow-sm'
                    : 'text-slate-600'
                }`}
              >
                新建机型
              </button>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          {formMode === 'NEW_MODEL' || formMode === 'EDIT_MODEL' ? (
            <div className="grid grid-cols-1 gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 md:grid-cols-12">
              {formMode === 'EDIT_MODEL' && (
                <div className="md:col-span-3">
                  <label htmlFor="bom-edit-target" className="block text-[11px] font-medium text-slate-700">
                    选择要修改的机型
                  </label>
                  <select
                    id="bom-edit-target"
                    value={activeTargetBom?.bomId ?? ''}
                    onChange={(e) => {
                      const found = state.boms.find((b) => b.bomId === e.target.value);
                      if (found) handleStartEditModel(found);
                    }}
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs"
                  >
                    {state.boms.map((b) => (
                      <option key={b.bomId} value={b.bomId}>
                        {b.productCode} ({b.version})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className={formMode === 'EDIT_MODEL' ? 'md:col-span-2' : 'md:col-span-3'}>
                <label htmlFor="nb-code" className="block text-[11px] font-medium text-slate-700">
                  机型编码 <span className="text-red-600">*</span>
                </label>
                <input
                  id="nb-code"
                  type="text"
                  required
                  readOnly={formMode === 'EDIT_MODEL'}
                  value={newProductCode}
                  onChange={(e) => setNewProductCode(e.target.value)}
                  placeholder="PCBA-DRIVE-X1"
                  className={`mt-1 w-full rounded border px-2 py-1.5 font-mono text-xs ${
                    formMode === 'EDIT_MODEL'
                      ? 'border-slate-200 bg-slate-100 text-slate-500'
                      : 'border-slate-300 bg-white'
                  }`}
                />
              </div>
              <div className="md:col-span-3">
                <label htmlFor="nb-name" className="block text-[11px] font-medium text-slate-700">
                  机型名称 <span className="text-red-600">*</span>
                </label>
                <input
                  id="nb-name"
                  type="text"
                  required
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  placeholder="工业伺服驱动控制板 X1"
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs"
                />
              </div>
              <div className="md:col-span-1">
                <label htmlFor="nb-ver" className="block text-[11px] font-medium text-slate-700">
                  版本
                </label>
                <input
                  id="nb-ver"
                  type="text"
                  value={newVersion}
                  onChange={(e) => setNewVersion(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[11px] font-medium text-slate-700">所属客户</label>
                <select
                  aria-label="机型关联客户"
                  value={newCustomerCode}
                  onChange={(e) => setNewCustomerCode(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs"
                >
                  <option value="">通用自研产品</option>
                  {state.customers.map((c) => (
                    <option key={c.customerCode} value={c.customerCode}>
                      {c.customerName}
                    </option>
                  ))}
                </select>
              </div>
              <div className={formMode === 'EDIT_MODEL' ? 'md:col-span-1' : 'md:col-span-3'}>
                <label className="block text-[11px] font-medium text-slate-700">工艺路线</label>
                <input
                  type="text"
                  aria-label="工艺路线"
                  value={newProcessType}
                  onChange={(e) => setNewProcessType(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs"
                />
              </div>
            </div>
          ) : null}

          {formMode !== 'EDIT_MODEL' && (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                {formMode === 'ADD_LINE' && (
                  <div className="md:col-span-3">
                    <label htmlFor="bom-target" className="block text-xs font-medium text-slate-700">
                      所属机型 BOM
                    </label>
                    <select
                      id="bom-target"
                      disabled={Boolean(editingLine)}
                      value={activeTargetBom?.bomId ?? ''}
                      onChange={(e) => setTargetBomId(e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs disabled:bg-slate-100"
                    >
                      {state.boms.map((b) => (
                        <option key={b.bomId} value={b.bomId}>
                          {b.productCode} · {b.productName} ({b.version})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className={formMode === 'ADD_LINE' ? 'md:col-span-3' : 'md:col-span-4'}>
                  <label htmlFor="bom-role" className="block text-xs font-medium text-slate-700">
                    物料角色属性
                  </label>
                  <select
                    id="bom-role"
                    value={itemRole}
                    onChange={(e) => setItemRole(e.target.value as BomItemRole)}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                  >
                    <option value="SPECIAL_MAIN">机型特料 (该机型专配主料)</option>
                    <option value="MAIN">通用主料 (标准BOM物料)</option>
                    <option value="SUBSTITUTE">替代料 (代用关系)</option>
                  </select>
                </div>

                <div className={formMode === 'ADD_LINE' ? 'md:col-span-6' : 'md:col-span-8'}>
                  <label htmlFor="bom-sku-sel" className="block text-xs font-medium text-slate-700">
                    {itemRole === 'SUBSTITUTE' ? '替代料料号 (新料)' : '物料编码 / MPN'}
                  </label>
                  <select
                    id="bom-sku-sel"
                    value={skuCode}
                    onChange={(e) => setSkuCode(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                  >
                    {uniqueMaterials.map((m) => (
                      <option key={m.skuCode} value={m.skuCode}>
                        {m.skuCode} · {m.mpn} — {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {itemRole === 'SUBSTITUTE' && (
                <div className="grid grid-cols-1 gap-3 rounded-md border border-amber-200 bg-amber-50/70 p-3 md:grid-cols-12">
                  <div className="md:col-span-6">
                    <label htmlFor="bom-sub-for" className="block text-[11px] font-medium text-slate-700">
                      被替代主/特料料号
                    </label>
                    <select
                      id="bom-sub-for"
                      value={substituteForSku}
                      onChange={(e) => setSubstituteForSku(e.target.value)}
                      className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs"
                    >
                      {(formMode === 'ADD_LINE' && mainOrSpecialSkusInTargetBom.length > 0
                        ? mainOrSpecialSkusInTargetBom
                        : uniqueMaterials
                      ).map((m) => (
                        <option key={m.skuCode} value={m.skuCode}>
                          {m.skuCode}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-[11px] text-slate-600">替代优先级</label>
                    <input
                      type="number"
                      min={1}
                      value={substitutePriority}
                      onChange={(e) => setSubstitutePriority(e.target.value)}
                      className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-[11px] text-slate-600">替代换算比</label>
                    <input
                      type="number"
                      step="0.1"
                      min={0.1}
                      value={substituteRatio}
                      onChange={(e) => setSubstituteRatio(e.target.value)}
                      className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 md:grid-cols-12">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-700">单板用量</label>
                  <input
                    type="number"
                    min={1}
                    value={qtyPerBoard}
                    onChange={(e) => setQtyPerBoard(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 font-mono text-xs tabular-nums"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-700">损耗率</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    max={0.5}
                    value={attritionRate}
                    onChange={(e) => setAttritionRate(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 font-mono text-xs tabular-nums"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-700">贴片位号</label>
                  <input
                    type="text"
                    value={designators}
                    onChange={(e) => setDesignators(e.target.value)}
                    placeholder="U1 / R1-R8"
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 font-mono text-xs"
                  />
                </div>
                <div className="col-span-2 md:col-span-6">
                  <label htmlFor="bom-remark" className="block text-xs font-medium text-slate-700">
                    特料 / 代用工程说明 (ECN备注)
                  </label>
                  <input
                    id="bom-remark"
                    type="text"
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    placeholder="例如：ECN-2026-11 批准 Pin-to-Pin 代用"
                    className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
                  />
                </div>
              </div>
            </>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex-1">
              {err && (
                <div role="alert" className="rounded border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
                  {err}
                </div>
              )}
              {msg && (
                <div className="rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-800">
                  {msg}
                </div>
              )}
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-teal-700 px-5 py-2 text-xs font-medium text-white hover:bg-teal-800 whitespace-nowrap shrink-0"
            >
              {editingLine || formMode === 'EDIT_MODEL' ? (
                <Pencil className="h-3.5 w-3.5" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              {editingLine
                ? '保存行修改'
                : formMode === 'EDIT_MODEL'
                  ? '保存机型主档修改'
                  : formMode === 'NEW_MODEL'
                    ? '创建机型并写入BOM单表'
                    : '追加至机型BOM单表'}
            </button>
          </div>
        </form>
      </section>

      {/* Full-Width Unified Single Table */}
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              机型BOM、特料与替代料代用关系总表 ({allRows.length} 行)
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              一张表集中管控各机型的通用主料、机型独占特料及工程批准替代代用关系；支持行级编辑与整机BOM删除
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                aria-label="筛选BOM单表"
                placeholder="搜机型 / 料号 / 位号..."
                className="w-48 rounded-md border border-slate-300 py-1.5 pl-8 pr-2.5 text-xs"
              />
            </div>
            <select
              aria-label="按机型筛选"
              value={selectedBomId}
              onChange={(e) => setSelectedBomId(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
            >
              <option value="ALL">全部机型 ({state.boms.length})</option>
              {state.boms.map((b) => (
                <option key={b.bomId} value={b.bomId}>
                  {b.productCode} ({b.version})
                </option>
              ))}
            </select>
            <select
              aria-label="按BOM角色筛选"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
            >
              <option value="ALL">全部属性</option>
              <option value="SPECIAL_MAIN">仅看机型特料</option>
              <option value="SUBSTITUTE">仅看替代料</option>
              <option value="MAIN">仅看通用主料</option>
            </select>

            {selectedModelObj && (
              confirmDeleteBomId === selectedModelObj.bomId ? (
                <div className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleDeleteBomModel(selectedModelObj)}
                    className="rounded bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-700 whitespace-nowrap"
                  >
                    确认删整机BOM?
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteBomId(null)}
                    className="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-600 whitespace-nowrap"
                  >
                    取消
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteBomId(selectedModelObj.bomId)}
                  className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 whitespace-nowrap"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  删除整机BOM
                </button>
              )
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium whitespace-nowrap">所属机型</th>
                <th className="px-3 py-2.5 font-medium whitespace-nowrap">物料角色</th>
                <th className="px-4 py-2.5 font-medium whitespace-nowrap">料号 / MPN & 描述</th>
                <th className="px-4 py-2.5 font-medium whitespace-nowrap">代用关系 / 说明</th>
                <th className="px-3 py-2.5 font-medium whitespace-nowrap">位号 / 用量</th>
                <th className="px-3 py-2.5 font-medium text-right whitespace-nowrap">可用库存</th>
                <th className="px-4 py-2.5 font-medium text-right whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allRows.map((row) => {
                const role: BomItemRole = row.item.itemRole ?? 'MAIN';
                const roleMeta = BOM_ROLE_LABEL[role];
                const mat = uniqueMaterials.find((m) => m.skuCode === row.item.skuCode);
                const avail = stockBySku.get(row.item.skuCode) ?? 0;
                const rowKey = `${row.bom.bomId}-${row.item.lineId ?? row.indexInBom}`;
                const isEditingThis =
                  editingLine?.bomId === row.bom.bomId &&
                  editingLine.index === row.indexInBom;
                const isConfirming = confirmDeleteRowKey === rowKey;

                return (
                  <tr
                    key={rowKey}
                    className={`hover:bg-slate-50 ${
                      isEditingThis
                        ? 'bg-teal-50/50'
                        : role === 'SUBSTITUTE'
                          ? 'bg-amber-50/25'
                          : ''
                    }`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-mono font-semibold text-slate-900">
                        {row.bom.productCode}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {row.bom.productName} · {row.bom.version}
                        {row.bom.customerName ? ` · ${row.bom.customerName}` : ''}
                      </div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className={`font-semibold ${roleMeta.toneClass}`}>
                        {role === 'SUBSTITUTE' ? '↳ 替代料' : roleMeta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono font-semibold text-slate-900 whitespace-nowrap">
                        {row.item.skuCode}{' '}
                        <span className="font-normal text-slate-500">
                          ({mat?.mpn ?? row.item.skuCode})
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[240px]">
                        {mat?.name ?? '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {role === 'SUBSTITUTE' ? (
                        <div>
                          <div className="font-mono font-medium text-amber-800 whitespace-nowrap">
                            替代 {row.item.substituteForSku} · P{row.item.substitutePriority ?? 1} (1:
                            {row.item.substituteRatio ?? 1})
                          </div>
                          {row.item.remark && (
                            <div className="text-[11px] text-slate-500">{row.item.remark}</div>
                          )}
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-500">
                          {row.item.remark || `更新 ${formatTime(row.bom.updatedAt)}`}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 font-mono whitespace-nowrap">
                      <div className="text-slate-800">{row.item.designators}</div>
                      <div className="text-[11px] text-slate-500 tabular-nums">
                        {row.item.qtyPerBoard}/板 · {Math.round(row.item.attritionRate * 100)}%
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums whitespace-nowrap">
                      <span
                        className={
                          avail > 0 ? 'font-semibold text-emerald-700' : 'font-semibold text-red-600'
                        }
                      >
                        {avail.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {isConfirming ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(row)}
                            className="rounded bg-red-600 px-2 py-0.5 text-[11px] font-medium text-white"
                          >
                            确认?
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteRowKey(null)}
                            className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-600"
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => handleStartEditRow(row)}
                            className="inline-flex items-center gap-1 font-medium text-teal-700 hover:text-teal-900"
                          >
                            <Pencil className="h-3 w-3" />
                            编辑
                          </button>
                          {role !== 'SUBSTITUTE' && (
                            <button
                              type="button"
                              onClick={() => handleQuickAddSubstitute(row)}
                              className="inline-flex items-center gap-1 font-medium text-amber-700 hover:text-amber-800"
                            >
                              <GitBranch className="h-3 w-3" />
                              加替代
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteRowKey(rowKey)}
                            aria-label={`移除 ${row.item.skuCode}`}
                            className="inline-flex items-center text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
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
  );
}
