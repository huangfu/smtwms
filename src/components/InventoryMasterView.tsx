import { Barcode, Flame } from 'lucide-react';
import { useState } from 'react';
import type {
  BarcodeRule,
  BomItem,
  Customer,
  LabelTemplate,
  MaterialSku,
  PackagingSpec,
  ReelItem,
  Supplier,
  WarehouseBin,
  WarehouseKeeper,
  WmsState,
} from '../types/wms';
import {
  MSD_STATE_LABEL,
  OWNERSHIP_TYPE_LABEL,
  REEL_STATUS_LABEL,
  WORK_ORDER_STATUS_LABEL,
} from '../utils/formatters';
import { BarcodeTemplatePanel } from './BarcodeTemplatePanel';
import { MaterialCatalogPanel } from './MaterialCatalogPanel';
import { PackagingMasterPanel } from './PackagingMasterPanel';
import { PartnerMasterPanel } from './PartnerMasterPanel';
import { WarehouseMasterPanel } from './WarehouseMasterPanel';

interface InventoryMasterViewProps {
  state: WmsState;
  onOpenLabel: (reel: ReelItem) => void;
  onInspectTrace: (query: string) => void;
  onBakeMsd: (reelId: string) => Promise<void>;
  onAddMaterial: (mat: MaterialSku) => Promise<void>;
  onUpdateMaterial: (originalKey: string, mat: MaterialSku) => Promise<void>;
  onDeleteMaterial: (materialKey: string) => Promise<void>;
  onAddPackagingSpec: (spec: PackagingSpec) => Promise<void>;
  onUpdatePackagingSpec: (code: string, spec: PackagingSpec) => Promise<void>;
  onDeletePackagingSpec: (code: string) => Promise<void>;
  onSaveBarcodeRule: (
    rule: Omit<BarcodeRule, 'ruleId' | 'supplierName'> & {
      ruleId?: string;
      supplierName?: string;
    }
  ) => Promise<void>;
  onDeleteBarcodeRule: (ruleId: string) => Promise<void>;
  onSaveLabelTemplate: (
    tpl: Omit<LabelTemplate, 'templateId'> & { templateId?: string }
  ) => Promise<void>;
  onDeleteLabelTemplate: (templateId: string) => Promise<void>;
  onAddWarehouse: (payload: {
    warehouseCode: string;
    warehouseName: string;
    warehouseType: string;
    managerId: string;
    address: string;
  }) => Promise<void>;
  onUpdateWarehouse: (
    code: string,
    payload: {
      warehouseName: string;
      warehouseType: string;
      managerId: string;
      address: string;
      status?: 'ACTIVE' | 'MAINTENANCE';
    }
  ) => Promise<void>;
  onDeleteWarehouse: (code: string) => Promise<void>;
  onAddBin: (payload: WarehouseBin) => Promise<void>;
  onUpdateBin: (binCode: string, payload: Omit<WarehouseBin, 'binCode'>) => Promise<void>;
  onDeleteBin: (binCode: string) => Promise<void>;
  onAddKeeper: (
    payload: Omit<WarehouseKeeper, 'keeperId' | 'status'> & { keeperId?: string }
  ) => Promise<void>;
  onUpdateKeeper: (
    keeperId: string,
    payload: Omit<WarehouseKeeper, 'keeperId' | 'status'> & { status?: 'ACTIVE' | 'OFF_DUTY' }
  ) => Promise<void>;
  onDeleteKeeper: (keeperId: string) => Promise<void>;
  onAddSupplier: (payload: Supplier) => Promise<void>;
  onUpdateSupplier: (code: string, payload: Omit<Supplier, 'supplierCode'>) => Promise<void>;
  onDeleteSupplier: (code: string) => Promise<void>;
  onAddCustomer: (payload: Customer) => Promise<void>;
  onUpdateCustomer: (code: string, payload: Omit<Customer, 'customerCode'>) => Promise<void>;
  onDeleteCustomer: (code: string) => Promise<void>;
  onAddWorkOrder: (wo: {
    workOrderId?: string;
    productCode: string;
    productName: string;
    bomId?: string;
    customerCode?: string;
    lineName: string;
    targetQty: number;
    bom: BomItem[];
  }) => Promise<void>;
}

export function InventoryMasterView({
  state,
  onOpenLabel,
  onInspectTrace,
  onBakeMsd,
  onAddMaterial,
  onUpdateMaterial,
  onDeleteMaterial,
  onAddPackagingSpec,
  onUpdatePackagingSpec,
  onDeletePackagingSpec,
  onSaveBarcodeRule,
  onDeleteBarcodeRule,
  onSaveLabelTemplate,
  onDeleteLabelTemplate,
  onAddWarehouse,
  onUpdateWarehouse,
  onDeleteWarehouse,
  onAddBin,
  onUpdateBin,
  onDeleteBin,
  onAddKeeper,
  onUpdateKeeper,
  onDeleteKeeper,
  onAddSupplier,
  onUpdateSupplier,
  onDeleteSupplier,
  onAddCustomer,
  onUpdateCustomer,
  onDeleteCustomer,
  onAddWorkOrder,
}: InventoryMasterViewProps) {
  const [tab, setTab] = useState<
    | 'reels'
    | 'materials'
    | 'packaging'
    | 'barcodeRules'
    | 'warehouse'
    | 'partners'
    | 'workOrders'
  >('reels');
  const [filterText, setFilterText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // New Work Order form
  const [selectedBomId, setSelectedBomId] = useState(state.boms[0]?.bomId ?? '');
  const [productCode, setProductCode] = useState('PCBA-IOT-V2');
  const [productName, setProductName] = useState('物联网无线采集板 V2');
  const [customerCode, setCustomerCode] = useState(state.customers[0]?.customerCode ?? '');
  const [lineName, setLineName] = useState('SMT-Line-01');
  const [targetQty, setTargetQty] = useState('100');
  const [bomSku, setBomSku] = useState(state.materials[0]?.skuCode ?? '');
  const [bomQtyPerBoard, setBomQtyPerBoard] = useState('2');
  const [bomDraft, setBomDraft] = useState<BomItem[]>([
    { skuCode: 'MAT-IC-001', qtyPerBoard: 1, attritionRate: 0.01, designators: 'U1' },
    { skuCode: 'MAT-RES-001', qtyPerBoard: 10, attritionRate: 0.05, designators: 'R1-R10' },
  ]);
  const [woMsg, setWoMsg] = useState<string | null>(null);
  const [woErr, setWoErr] = useState<string | null>(null);

  const filteredReels = state.reels.filter((r) => {
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    if (!filterText.trim()) return true;
    const q = filterText.trim().toUpperCase();
    return (
      r.reelId.toUpperCase().includes(q) ||
      r.mpn.toUpperCase().includes(q) ||
      r.lotNumber.toUpperCase().includes(q) ||
      r.binCode.toUpperCase().includes(q) ||
      (r.ownerName ?? '').toUpperCase().includes(q) ||
      (r.customerName ?? '').toUpperCase().includes(q)
    );
  });

  const handleApplyBomTemplate = (bomId: string) => {
    setSelectedBomId(bomId);
    const bom = state.boms.find((b) => b.bomId === bomId);
    if (!bom) return;
    setProductCode(bom.productCode);
    setProductName(bom.productName);
    if (bom.customerCode) setCustomerCode(bom.customerCode);
    setBomDraft(
      bom.items
        .filter((item) => item.itemRole !== 'SUBSTITUTE')
        .map((item) => ({ ...item }))
    );
  };

  const handleAddBomRow = () => {
    if (!bomSku) return;
    setBomDraft((prev) => {
      if (prev.some((b) => b.skuCode === bomSku)) return prev;
      return [
        ...prev,
        {
          skuCode: bomSku,
          qtyPerBoard: Math.max(1, Number(bomQtyPerBoard) || 1),
          attritionRate: 0.02,
          designators: 'BOM项',
        },
      ];
    });
  };

  const handleAddWorkOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWoErr(null);
    setWoMsg(null);
    try {
      await onAddWorkOrder({
        productCode,
        productName,
        bomId: selectedBomId || undefined,
        customerCode: customerCode || undefined,
        lineName,
        targetQty: Number(targetQty),
        bom: bomDraft,
      });
      setWoMsg(`已创建独立工单 (${productName} · ${targetQty} PCS)，可前往波次发料。`);
    } catch (err) {
      setWoErr(err instanceof Error ? err.message : '创建工单失败');
    }
  };

  return (
    <div className="space-y-6">
      <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-slate-200/70 p-1">
        {[
          { id: 'reels', label: '料盘库存台账 (UID明细)' },
          { id: 'materials', label: '物料与产权归属清单' },
          { id: 'packaging', label: '包装方式与 SPQ' },
          { id: 'barcodeRules', label: '条码规则与标签模板' },
          { id: 'warehouse', label: '仓库 / 库位 / 管理员' },
          { id: 'partners', label: '供应商与客户管理' },
          { id: 'workOrders', label: '生产工单管理' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id as typeof tab)}
            className={`rounded-md px-3.5 py-1.5 text-xs whitespace-nowrap shrink-0 ${
              tab === item.id
                ? 'bg-white font-semibold text-teal-800 shadow-sm border border-slate-200/80'
                : 'font-medium text-slate-600 hover:text-slate-900 border border-transparent'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'reels' && (
        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                aria-label="筛选库存料盘"
                placeholder="搜索 UID / MPN / Lot / 库位..."
                className="w-64 rounded-md border border-slate-300 px-3 py-1.5 font-mono text-xs text-slate-900 placeholder:font-sans"
              />
              <select
                aria-label="按库存状态筛选"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700"
              >
                <option value="ALL">全部状态</option>
                <option value="IN_STOCK">在库可用</option>
                <option value="ALLOCATED">波次锁定</option>
                <option value="ISSUED_TO_LINE">线边在制</option>
                <option value="DEPLETED">已耗尽</option>
                <option value="SCRAPPED">已报废</option>
              </select>
            </div>
            <div className="font-mono text-xs text-slate-500 tabular-nums">
              共 {filteredReels.length} 盘
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-5 py-2.5 font-medium whitespace-nowrap">料盘 UID</th>
                  <th className="px-4 py-2.5 font-medium whitespace-nowrap">MPN / 批次 / 周期</th>
                  <th className="px-4 py-2.5 font-medium whitespace-nowrap">库位</th>
                  <th className="px-4 py-2.5 font-medium whitespace-nowrap">状态 / MSD</th>
                  <th className="px-4 py-2.5 font-medium text-right whitespace-nowrap">当前余量</th>
                  <th className="px-5 py-2.5 font-medium text-right whitespace-nowrap">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReels.map((r) => {
                  const st = REEL_STATUS_LABEL[r.status];
                  const msd = MSD_STATE_LABEL[r.msdState];
                  const own = OWNERSHIP_TYPE_LABEL[r.ownershipType ?? 'SELF_PURCHASED'];
                  return (
                    <tr key={r.reelId} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-mono font-semibold text-slate-900 whitespace-nowrap">
                        <div>{r.reelId}</div>
                        <div className={`text-[10px] font-sans ${own.toneClass}`}>
                          {own.short} · {r.ownerName || '本厂自购'}
                          {r.customerCode ? ` · 限[${r.customerName || r.customerCode}]` : ' · 通用共享'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono font-medium text-slate-900">{r.mpn}</div>
                        <div className="font-mono text-[11px] text-slate-500">
                          Lot {r.lotNumber} · D/C {r.dateCode}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700 whitespace-nowrap">
                        {r.binCode}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`font-medium ${st.toneClass}`}>{st.label}</span>
                        <span className="mx-1.5 text-slate-300">·</span>
                        <span className={msd.toneClass}>
                          {r.msdLevel} ({msd.label})
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                        {r.qty.toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-3">
                          {r.msdState === 'BAKING_REQUIRED' && (
                            <button
                              type="button"
                              onClick={() => onBakeMsd(r.reelId)}
                              className="inline-flex items-center gap-1 font-medium text-red-700 hover:text-red-800"
                            >
                              <Flame className="h-3.5 w-3.5" />
                              烘烤解锁
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onOpenLabel(r)}
                            className="inline-flex items-center gap-1 font-medium text-teal-700 hover:text-teal-800"
                          >
                            <Barcode className="h-3.5 w-3.5" />
                            标签
                          </button>
                          <button
                            type="button"
                            onClick={() => onInspectTrace(r.reelId)}
                            className="font-medium text-slate-600 hover:text-slate-900"
                          >
                            追溯
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'materials' && (
        <MaterialCatalogPanel
          state={state}
          onAddMaterial={onAddMaterial}
          onUpdateMaterial={onUpdateMaterial}
          onDeleteMaterial={onDeleteMaterial}
        />
      )}

      {tab === 'packaging' && (
        <PackagingMasterPanel
          state={state}
          onAddPackagingSpec={onAddPackagingSpec}
          onUpdatePackagingSpec={onUpdatePackagingSpec}
          onDeletePackagingSpec={onDeletePackagingSpec}
        />
      )}

      {tab === 'barcodeRules' && (
        <BarcodeTemplatePanel
          state={state}
          onSaveBarcodeRule={onSaveBarcodeRule}
          onDeleteBarcodeRule={onDeleteBarcodeRule}
          onSaveLabelTemplate={onSaveLabelTemplate}
          onDeleteLabelTemplate={onDeleteLabelTemplate}
        />
      )}

      {tab === 'warehouse' && (
        <WarehouseMasterPanel
          state={state}
          onAddWarehouse={onAddWarehouse}
          onUpdateWarehouse={onUpdateWarehouse}
          onDeleteWarehouse={onDeleteWarehouse}
          onAddBin={onAddBin}
          onUpdateBin={onUpdateBin}
          onDeleteBin={onDeleteBin}
          onAddKeeper={onAddKeeper}
          onUpdateKeeper={onUpdateKeeper}
          onDeleteKeeper={onDeleteKeeper}
        />
      )}

      {tab === 'partners' && (
        <PartnerMasterPanel
          state={state}
          onAddSupplier={onAddSupplier}
          onUpdateSupplier={onUpdateSupplier}
          onDeleteSupplier={onDeleteSupplier}
          onAddCustomer={onAddCustomer}
          onUpdateCustomer={onUpdateCustomer}
          onDeleteCustomer={onDeleteCustomer}
        />
      )}

      {tab === 'workOrders' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <section className="rounded-lg border border-slate-200 bg-white p-5 xl:col-span-5">
            <h2 className="border-b border-slate-200 pb-3 text-sm font-semibold text-slate-900">
              新建独立生产工单 (支持引用BOM模板与客户)
            </h2>
            <form onSubmit={handleAddWorkOrderSubmit} className="mt-4 space-y-3">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <label htmlFor="wo-bom-tpl" className="block text-xs font-medium text-slate-700">
                  引用标准 BOM 模板快速填充
                </label>
                <div className="mt-1.5 flex gap-2">
                  <select
                    id="wo-bom-tpl"
                    value={selectedBomId}
                    onChange={(e) => handleApplyBomTemplate(e.target.value)}
                    className="flex-1 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                  >
                    <option value="">-- 手动自定义 --</option>
                    {state.boms.map((b) => (
                      <option key={b.bomId} value={b.bomId}>
                        {b.productCode} · {b.productName} ({b.version})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleApplyBomTemplate(selectedBomId)}
                    className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-teal-700 hover:bg-slate-100 whitespace-nowrap"
                  >
                    载入BOM
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="wo-pcode" className="block text-xs font-medium text-slate-700">
                    产品编码
                  </label>
                  <input
                    id="wo-pcode"
                    type="text"
                    required
                    value={productCode}
                    onChange={(e) => setProductCode(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="wo-pname" className="block text-xs font-medium text-slate-700">
                    PCBA产品名称
                  </label>
                  <input
                    id="wo-pname"
                    type="text"
                    required
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="wo-cus" className="block text-xs font-medium text-slate-700">
                  所属交付客户
                </label>
                <select
                  id="wo-cus"
                  value={customerCode}
                  onChange={(e) => setCustomerCode(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  <option value="">内部自研 / 无指定客户</option>
                  {state.customers.map((c) => (
                    <option key={c.customerCode} value={c.customerCode}>
                      {c.customerName} ({c.customerCode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="wo-line" className="block text-xs font-medium text-slate-700">
                    SMT 生产产线
                  </label>
                  <select
                    id="wo-line"
                    value={lineName}
                    onChange={(e) => setLineName(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                  >
                    <option value="SMT-Line-01">SMT-Line-01</option>
                    <option value="SMT-Line-02">SMT-Line-02</option>
                    <option value="DIP-Line-01">DIP-Line-01</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="wo-qty" className="block text-xs font-medium text-slate-700">
                    计划生产套数 (PCS)
                  </label>
                  <input
                    id="wo-qty"
                    type="number"
                    min={1}
                    required
                    value={targetQty}
                    onChange={(e) => setTargetQty(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-medium text-slate-700">配置工单BOM清单</div>
                <div className="mt-2 flex gap-2">
                  <select
                    aria-label="选择BOM物料"
                    value={bomSku}
                    onChange={(e) => setBomSku(e.target.value)}
                    className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs"
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
                    aria-label="单板用量"
                    value={bomQtyPerBoard}
                    onChange={(e) => setBomQtyPerBoard(e.target.value)}
                    className="w-16 rounded border border-slate-300 px-2 py-1 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddBomRow}
                    className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                  >
                    加入BOM
                  </button>
                </div>

                <ul className="mt-2.5 space-y-1 text-xs">
                  {bomDraft.map((item) => (
                    <li
                      key={item.skuCode}
                      className="flex items-center justify-between rounded bg-white px-2.5 py-1.5 font-mono border border-slate-200"
                    >
                      <span>
                        {item.skuCode} × {item.qtyPerBoard}/板
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setBomDraft((prev) => prev.filter((b) => b.skuCode !== item.skuCode))
                        }
                        className="text-red-600 hover:underline"
                      >
                        移除
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {woErr && (
                <div className="rounded border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
                  {woErr}
                </div>
              )}
              {woMsg && (
                <div className="rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-800">
                  {woMsg}
                </div>
              )}

              <button
                type="submit"
                className="w-full rounded-md bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800"
              >
                创建独立生产工单
              </button>
            </form>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white xl:col-span-7">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-900">
                全部生产工单台账 ({state.workOrders.length})
              </h2>
            </div>
            <div className="divide-y divide-slate-100">
              {state.workOrders.map((wo) => (
                <div key={wo.workOrderId} className="px-5 py-4 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-slate-900">{wo.workOrderId}</span>
                      <span className="mx-2 text-slate-300">·</span>
                      <span className="font-medium text-slate-800">{wo.productName}</span>
                    </div>
                    <span className="font-medium text-teal-700">
                      {WORK_ORDER_STATUS_LABEL[wo.status]}
                    </span>
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-slate-500">
                    产品码 {wo.productCode} · 客户 {wo.customerName || '内部自研'} · 产线{' '}
                    {wo.lineName} · 计划 {wo.targetQty} PCS · BOM {wo.bom.length} 项
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
