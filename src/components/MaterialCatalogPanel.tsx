import { Pencil, Plus, RotateCcw, Search, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import type {
  MaterialCategory,
  MaterialOwnershipType,
  MaterialSku,
  MsdLevel,
  WmsState,
} from '../types/wms';
import { OWNERSHIP_TYPE_LABEL } from '../utils/formatters';
import { buildMaterialKey } from '../utils/wmsLogic';

interface MaterialCatalogPanelProps {
  state: WmsState;
  onAddMaterial: (mat: MaterialSku) => Promise<void>;
  onUpdateMaterial: (originalKey: string, mat: MaterialSku) => Promise<void>;
  onDeleteMaterial: (materialKey: string) => Promise<void>;
}

export function MaterialCatalogPanel({
  state,
  onAddMaterial,
  onUpdateMaterial,
  onDeleteMaterial,
}: MaterialCatalogPanelProps) {
  const [searchText, setSearchText] = useState('');
  const [ownershipFilter, setOwnershipFilter] = useState<'ALL' | MaterialOwnershipType>('ALL');
  const [customerFilter, setCustomerFilter] = useState<string>('ALL');

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);

  const [mpn, setMpn] = useState('');
  const [skuCode, setSkuCode] = useState('');
  const [skuManuallyEdited, setSkuManuallyEdited] = useState(false);

  const [matName, setMatName] = useState('');
  const [ownershipType, setOwnershipType] = useState<MaterialOwnershipType>('SELF_PURCHASED');
  const [ownerCode, setOwnerCode] = useState('INTERNAL');
  const [customerCode, setCustomerCode] = useState(''); // '' = 通用共享 (不限客户)
  const [manufacturer, setManufacturer] = useState('');
  const [category, setCategory] = useState<MaterialCategory>('IC芯片');
  const [packagingCode, setPackagingCode] = useState(
    state.packagingSpecs[0]?.packagingCode ?? 'PKG-REEL-7-8'
  );
  const [mpq, setMpq] = useState(String(state.packagingSpecs[0]?.defaultSpq ?? 4000));
  const [supplierCode, setSupplierCode] = useState(state.suppliers[0]?.supplierCode ?? '');
  const [unit, setUnit] = useState<'PCS' | '张' | '瓶' | '卷'>('PCS');
  const [msdLevel, setMsdLevel] = useState<MsdLevel>('Level 3');
  const [safetyStock, setSafetyStock] = useState('500');
  const [defaultBin, setDefaultBin] = useState(state.bins[0]?.binCode ?? 'MSD-01-01');
  const [matMsg, setMatMsg] = useState<string | null>(null);
  const [matErr, setMatErr] = useState<string | null>(null);

  const resetForm = () => {
    setEditingKey(null);
    setMpn('');
    setSkuCode('');
    setSkuManuallyEdited(false);
    setMatName('');
    setOwnershipType('SELF_PURCHASED');
    setOwnerCode('INTERNAL');
    setCustomerCode('');
    setManufacturer('');
    setCategory('IC芯片');
    setPackagingCode(state.packagingSpecs[0]?.packagingCode ?? 'PKG-REEL-7-8');
    setMpq(String(state.packagingSpecs[0]?.defaultSpq ?? 4000));
    setSupplierCode(state.suppliers[0]?.supplierCode ?? '');
    setUnit('PCS');
    setMsdLevel('Level 3');
    setSafetyStock('500');
    setDefaultBin(state.bins[0]?.binCode ?? 'MSD-01-01');
  };

  const handleMpnChange = (val: string) => {
    setMpn(val);
    if (!skuManuallyEdited) {
      setSkuCode(val.trim().toUpperCase());
    }
  };

  const handleSkuChange = (val: string) => {
    setSkuCode(val);
    setSkuManuallyEdited(val.trim().length > 0 && val.trim().toUpperCase() !== mpn.trim().toUpperCase());
  };

  const handleSyncSkuToMpn = () => {
    setSkuCode(mpn.trim().toUpperCase());
    setSkuManuallyEdited(false);
  };

  const handlePackagingChange = (code: string) => {
    setPackagingCode(code);
    const pkg = state.packagingSpecs.find((p) => p.packagingCode === code);
    if (pkg) {
      setMpq(String(pkg.defaultSpq));
    }
  };

  const handleOwnershipChange = (nextType: MaterialOwnershipType) => {
    setOwnershipType(nextType);
    if (nextType === 'SELF_PURCHASED') {
      setOwnerCode('INTERNAL');
    } else if (nextType === 'CUSTOMER_CONSIGNED') {
      const firstCus = state.customers[0]?.customerCode ?? '';
      setOwnerCode(firstCus);
      setCustomerCode(firstCus);
      setSafetyStock('0');
    } else {
      setOwnerCode(state.suppliers[0]?.supplierCode ?? '');
    }
  };

  const startEdit = (m: MaterialSku) => {
    const ownType = m.ownershipType ?? 'SELF_PURCHASED';
    const key =
      m.materialKey ??
      buildMaterialKey(m.skuCode, ownType, m.ownerCode, m.customerCode);
    setEditingKey(key);
    setMpn(m.mpn);
    setSkuCode(m.skuCode);
    setSkuManuallyEdited(m.skuCode.toUpperCase() !== m.mpn.trim().toUpperCase());
    setMatName(m.name);
    setOwnershipType(ownType);
    setOwnerCode(m.ownerCode ?? (ownType === 'SELF_PURCHASED' ? 'INTERNAL' : ''));
    setCustomerCode(
      ownType === 'CUSTOMER_CONSIGNED'
        ? (m.ownerCode ?? m.customerCode ?? '')
        : (m.customerCode ?? '')
    );
    setManufacturer(m.manufacturer);
    setCategory(m.category);
    setPackagingCode(m.packagingCode ?? state.packagingSpecs[0]?.packagingCode ?? '');
    setMpq(String(m.mpq ?? 1000));
    setSupplierCode(m.supplierCode ?? state.suppliers[0]?.supplierCode ?? '');
    setUnit(m.unit);
    setMsdLevel(m.msdLevel);
    setSafetyStock(String(m.safetyStock));
    setDefaultBin(m.defaultBin);
    setMatErr(null);
    setMatMsg(null);
  };

  const handleSaveMaterialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMatErr(null);
    setMatMsg(null);
    try {
      const selectedPkg = state.packagingSpecs.find((p) => p.packagingCode === packagingCode);
      const selectedSup = state.suppliers.find((s) => s.supplierCode === supplierCode);
      const resolvedOwnerCode =
        ownershipType === 'SELF_PURCHASED' ? 'INTERNAL' : ownerCode;
      const resolvedCustomerCode =
        ownershipType === 'CUSTOMER_CONSIGNED' ? resolvedOwnerCode : customerCode;
      const effectiveSku = (skuCode.trim() || mpn.trim()).toUpperCase();

      const payload: MaterialSku = {
        skuCode: effectiveSku,
        mpn: mpn.trim(),
        name: matName.trim(),
        ownershipType,
        ownerCode: resolvedOwnerCode,
        customerCode: resolvedCustomerCode,
        manufacturer: manufacturer.trim() || selectedSup?.supplierName || '原厂直供',
        category,
        packageType: selectedPkg?.packagingName ?? '标准卷盘',
        packagingCode: selectedPkg?.packagingCode,
        packagingName: selectedPkg?.packagingName,
        mpq: Number(mpq) || selectedPkg?.defaultSpq || 1000,
        supplierCode: selectedSup?.supplierCode,
        supplierName: selectedSup?.supplierName,
        unit,
        msdLevel,
        safetyStock: Number(safetyStock) || 0,
        defaultBin,
      };

      if (editingKey) {
        await onUpdateMaterial(editingKey, payload);
        setMatMsg(`已更新物料主数据 ${effectiveSku} (${mpn.trim()})`);
      } else {
        await onAddMaterial(payload);
        setMatMsg(
          `已新增物料主数据 ${effectiveSku} · ${OWNERSHIP_TYPE_LABEL[ownershipType].label}`
        );
      }
      resetForm();
    } catch (e) {
      setMatErr(e instanceof Error ? e.message : '保存物料失败');
    }
  };

  const handleConfirmDelete = async (key: string, label: string) => {
    setMatErr(null);
    setMatMsg(null);
    try {
      await onDeleteMaterial(key);
      if (editingKey === key) resetForm();
      setConfirmDeleteKey(null);
      setMatMsg(`已删除物料档案：${label}`);
    } catch (e) {
      setConfirmDeleteKey(null);
      setMatErr(e instanceof Error ? e.message : '删除物料失败');
    }
  };

  const filteredMaterials = state.materials.filter((m) => {
    const own = m.ownershipType ?? 'SELF_PURCHASED';
    if (ownershipFilter !== 'ALL' && own !== ownershipFilter) return false;
    const cus = own === 'CUSTOMER_CONSIGNED' ? m.ownerCode : (m.customerCode ?? '');
    if (customerFilter === 'COMMON' && cus !== '') return false;
    if (customerFilter !== 'ALL' && customerFilter !== 'COMMON' && cus !== customerFilter) {
      return false;
    }
    if (!searchText.trim()) return true;
    const q = searchText.trim().toUpperCase();
    return (
      m.skuCode.toUpperCase().includes(q) ||
      m.mpn.toUpperCase().includes(q) ||
      m.name.toUpperCase().includes(q) ||
      (m.ownerName ?? '').toUpperCase().includes(q) ||
      (m.customerName ?? '').toUpperCase().includes(q) ||
      (m.supplierName ?? '').toUpperCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      {/* Top Compact Full-Width Form Card */}
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              {editingKey ? '修改物料主数据' : '新增物料主数据 (默认以 MPN 为料号，可自由修改)'}
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              复合主键：料号 (SKU) + 产权归属 + 业务对应客户 · 非客供料亦可指定专属服务客户以隔离发料
            </p>
          </div>
          {editingKey && (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <X className="h-3.5 w-3.5" />
              取消编辑
            </button>
          )}
        </div>

        <form onSubmit={handleSaveMaterialSubmit} className="mt-4 space-y-3">
          {/* Row 1: MPN, SKU (auto from MPN, editable), Description, Category */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
            <div className="md:col-span-3">
              <label htmlFor="mc-mpn" className="block text-xs font-medium text-slate-700">
                原厂型号 (MPN) <span className="text-red-600">*</span>
              </label>
              <input
                id="mc-mpn"
                type="text"
                required
                value={mpn}
                onChange={(e) => handleMpnChange(e.target.value)}
                placeholder="STM32F407VET6"
                className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-xs"
              />
            </div>

            <div className="md:col-span-3">
              <div className="flex items-center justify-between">
                <label htmlFor="mc-sku" className="block text-xs font-medium text-slate-700">
                  物料料号 (SKU) <span className="text-red-600">*</span>
                </label>
                {skuManuallyEdited && mpn.trim() && (
                  <button
                    type="button"
                    onClick={handleSyncSkuToMpn}
                    className="inline-flex items-center gap-0.5 text-[11px] font-medium text-teal-700 hover:underline whitespace-nowrap"
                  >
                    <RotateCcw className="h-2.5 w-2.5" />
                    同MPN
                  </button>
                )}
              </div>
              <input
                id="mc-sku"
                type="text"
                required
                value={skuCode}
                onChange={(e) => handleSkuChange(e.target.value)}
                placeholder="自动同步MPN，可自由输入厂内料号"
                className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-xs"
              />
            </div>

            <div className="md:col-span-4">
              <label htmlFor="mc-name" className="block text-xs font-medium text-slate-700">
                物料描述 <span className="text-red-600">*</span>
              </label>
              <input
                id="mc-name"
                type="text"
                required
                value={matName}
                onChange={(e) => setMatName(e.target.value)}
                placeholder="ARM Cortex-M4 32位MCU (支持自定义厂内料号或直接用MPN)"
                className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="mc-cat" className="block text-xs font-medium text-slate-700">
                物料分类
              </label>
              <select
                id="mc-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value as MaterialCategory)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
              >
                <option value="IC芯片">IC芯片</option>
                <option value="阻容感">阻容感</option>
                <option value="连接器">连接器</option>
                <option value="PCB光板">PCB光板</option>
                <option value="辅料锡膏">辅料锡膏</option>
                <option value="结构件">结构件</option>
              </select>
            </div>
          </div>

          {/* Row 2: Ownership, Owner Code, Business Customer Scope (Available for ALL types) */}
          <div className="grid grid-cols-1 gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 md:grid-cols-12">
            <div className="md:col-span-3">
              <label htmlFor="mc-own-type" className="block text-xs font-medium text-slate-700">
                产权 / 采购模式
              </label>
              <select
                id="mc-own-type"
                value={ownershipType}
                onChange={(e) =>
                  handleOwnershipChange(e.target.value as MaterialOwnershipType)
                }
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
              >
                <option value="SELF_PURCHASED">本厂自购 (SELF)</option>
                <option value="CUSTOMER_CONSIGNED">客户客供 (CONSIGNED)</option>
                <option value="VMI_CONSIGNED">VMI 寄售 (VMI)</option>
              </select>
            </div>

            <div className="md:col-span-4">
              <label htmlFor="mc-owner-code" className="block text-xs font-medium text-slate-700">
                物权归属方 (货主)
              </label>
              {ownershipType === 'SELF_PURCHASED' ? (
                <input
                  id="mc-owner-code"
                  type="text"
                  readOnly
                  value="INTERNAL · 本厂自有资产"
                  className="mt-1 w-full rounded border border-slate-200 bg-slate-100 px-2.5 py-1.5 font-mono text-xs text-slate-500"
                />
              ) : ownershipType === 'CUSTOMER_CONSIGNED' ? (
                <select
                  id="mc-owner-code"
                  value={ownerCode}
                  onChange={(e) => {
                    setOwnerCode(e.target.value);
                    setCustomerCode(e.target.value);
                  }}
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  {state.customers.map((c) => (
                    <option key={c.customerCode} value={c.customerCode}>
                      {c.customerName} ({c.customerCode})
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  id="mc-owner-code"
                  value={ownerCode}
                  onChange={(e) => setOwnerCode(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  {state.suppliers.map((s) => (
                    <option key={s.supplierCode} value={s.supplierCode}>
                      {s.supplierName} ({s.supplierCode})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="md:col-span-5">
              <label htmlFor="mc-cus-scope" className="block text-xs font-medium text-slate-700">
                业务对应客户 (发料准入范围)
              </label>
              {ownershipType === 'CUSTOMER_CONSIGNED' ? (
                <input
                  id="mc-cus-scope"
                  type="text"
                  readOnly
                  value={`绑定客供方：${
                    state.customers.find((c) => c.customerCode === ownerCode)?.customerName ??
                    ownerCode
                  } (仅限该客户工单发料)`}
                  className="mt-1 w-full rounded border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-xs font-medium text-teal-900"
                />
              ) : (
                <select
                  id="mc-cus-scope"
                  value={customerCode}
                  onChange={(e) => setCustomerCode(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  <option value="">通用共享 (不限客户 · 全部工单可发)</option>
                  {state.customers.map((c) => (
                    <option key={c.customerCode} value={c.customerCode}>
                      专备客户：{c.customerName} ({c.customerCode} 仅限该客户发料)
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Row 3: Packaging, MPQ, Supplier, MSL, Unit, Safety Stock, Default Bin, Manufacturer */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-12">
            <div className="col-span-2 md:col-span-3">
              <label htmlFor="mc-pkg" className="block text-xs font-medium text-slate-700">
                包装方式
              </label>
              <select
                id="mc-pkg"
                value={packagingCode}
                onChange={(e) => handlePackagingChange(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
              >
                {state.packagingSpecs.map((p) => (
                  <option key={p.packagingCode} value={p.packagingCode}>
                    {p.packagingName}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-1">
              <label htmlFor="mc-mpq" className="block text-xs font-medium text-slate-700">
                MPQ
              </label>
              <input
                id="mc-mpq"
                type="number"
                min={1}
                value={mpq}
                onChange={(e) => setMpq(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 font-mono text-xs tabular-nums"
              />
            </div>
            <div className="col-span-2 md:col-span-2">
              <label htmlFor="mc-sup" className="block text-xs font-medium text-slate-700">
                主供应商
              </label>
              <select
                id="mc-sup"
                value={supplierCode}
                onChange={(e) => setSupplierCode(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
              >
                {state.suppliers.map((s) => (
                  <option key={s.supplierCode} value={s.supplierCode}>
                    {s.supplierCode} · {s.supplierName}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label htmlFor="mc-msd" className="block text-xs font-medium text-slate-700">
                MSL 等级
              </label>
              <select
                id="mc-msd"
                value={msdLevel}
                onChange={(e) => setMsdLevel(e.target.value as MsdLevel)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
              >
                <option value="Level 1">Level 1 (非湿敏)</option>
                <option value="Level 2">Level 2 (1年)</option>
                <option value="Level 2a">Level 2a (4周)</option>
                <option value="Level 3">Level 3 (168h)</option>
                <option value="Level 4">Level 4 (72h)</option>
                <option value="Level 5a">Level 5a (24h)</option>
              </select>
            </div>
            <div className="md:col-span-1">
              <label htmlFor="mc-unit" className="block text-xs font-medium text-slate-700">
                单位
              </label>
              <select
                id="mc-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value as typeof unit)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
              >
                <option value="PCS">PCS</option>
                <option value="张">张</option>
                <option value="瓶">瓶</option>
                <option value="卷">卷</option>
              </select>
            </div>
            <div className="md:col-span-1">
              <label htmlFor="mc-safety" className="block text-xs font-medium text-slate-700">
                安全库存
              </label>
              <input
                id="mc-safety"
                type="number"
                min={0}
                value={safetyStock}
                onChange={(e) => setSafetyStock(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 font-mono text-xs tabular-nums"
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="mc-bin" className="block text-xs font-medium text-slate-700">
                默认库位 / 原厂品牌
              </label>
              <div className="mt-1 grid grid-cols-2 gap-1.5">
                <select
                  id="mc-bin"
                  value={defaultBin}
                  onChange={(e) => setDefaultBin(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-1.5 py-1.5 font-mono text-xs"
                >
                  {state.bins.map((b) => (
                    <option key={b.binCode} value={b.binCode}>
                      {b.binCode}
                    </option>
                  ))}
                </select>
                <input
                  id="mc-mfg"
                  type="text"
                  aria-label="原厂品牌"
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                  placeholder="品牌"
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex-1">
              {matErr && (
                <div role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
                  {matErr}
                </div>
              )}
              {matMsg && (
                <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800">
                  {matMsg}
                </div>
              )}
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-teal-700 px-5 py-2 text-xs font-medium text-white hover:bg-teal-800 whitespace-nowrap shrink-0"
            >
              {editingKey ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {editingKey ? '保存修改' : '保存至物料归属清单'}
            </button>
          </div>
        </form>
      </section>

      {/* Full-Width Master Table */}
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              物料清单与业务归属主表 ({filteredMaterials.length} 条记录)
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              支持一料一码或同料号按产权与业务客户隔离管控；点击行内「编辑」可自定义料号与发料准入客户
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                aria-label="搜索物料清单"
                placeholder="搜料号 / MPN / 客户 / 供应商"
                className="w-56 rounded-md border border-slate-300 py-1.5 pl-8 pr-2.5 text-xs"
              />
            </div>
            <select
              aria-label="筛选业务归属"
              value={ownershipFilter}
              onChange={(e) => setOwnershipFilter(e.target.value as typeof ownershipFilter)}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
            >
              <option value="ALL">全部产权模式</option>
              <option value="SELF_PURCHASED">本厂自购</option>
              <option value="CUSTOMER_CONSIGNED">客户客供</option>
              <option value="VMI_CONSIGNED">VMI 寄售</option>
            </select>
            <select
              aria-label="筛选业务客户"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
            >
              <option value="ALL">全部准入客户</option>
              <option value="COMMON">仅看通用共享</option>
              {state.customers.map((c) => (
                <option key={c.customerCode} value={c.customerCode}>
                  {c.customerName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium whitespace-nowrap">料号 (SKU) / MPN</th>
                <th className="px-4 py-2.5 font-medium whitespace-nowrap">物料描述</th>
                <th className="px-3 py-2.5 font-medium whitespace-nowrap">产权归属</th>
                <th className="px-3 py-2.5 font-medium whitespace-nowrap">业务对应客户 (发料准入)</th>
                <th className="px-3 py-2.5 font-medium whitespace-nowrap">MSL</th>
                <th className="px-3 py-2.5 font-medium whitespace-nowrap">包装方式 / MPQ</th>
                <th className="px-3 py-2.5 font-medium whitespace-nowrap">主供应商</th>
                <th className="px-3 py-2.5 font-medium text-right whitespace-nowrap">库位 / 安全线</th>
                <th className="px-4 py-2.5 font-medium text-right whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMaterials.map((m) => {
                const ownType = m.ownershipType ?? 'SELF_PURCHASED';
                const ownMeta = OWNERSHIP_TYPE_LABEL[ownType];
                const rowKey =
                  m.materialKey ??
                  buildMaterialKey(m.skuCode, ownType, m.ownerCode, m.customerCode);
                const effectiveCusCode =
                  ownType === 'CUSTOMER_CONSIGNED' ? m.ownerCode : m.customerCode;
                const effectiveCusName =
                  ownType === 'CUSTOMER_CONSIGNED'
                    ? m.ownerName
                    : effectiveCusCode
                      ? m.customerName || effectiveCusCode
                      : '通用共享 (不限客户)';
                const isConfirming = confirmDeleteKey === rowKey;

                return (
                  <tr
                    key={rowKey}
                    className={`hover:bg-slate-50 ${editingKey === rowKey ? 'bg-teal-50/40' : ''}`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-mono font-semibold text-slate-900">{m.skuCode}</div>
                      <div className="font-mono text-[11px] text-slate-500">{m.mpn}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{m.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {m.category} · {m.manufacturer}
                      </div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className={`font-semibold ${ownMeta.toneClass}`}>{ownMeta.label}</div>
                      <div className="font-mono text-[11px] text-slate-500">
                        {m.ownerName || '本厂自购'}
                      </div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {effectiveCusCode ? (
                        <div>
                          <div className="font-medium text-teal-800">{effectiveCusName}</div>
                          <div className="font-mono text-[11px] text-slate-500">
                            仅限 {effectiveCusCode} 工单
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-600">通用共享 (不限客户)</span>
                      )}
                    </td>
                    <td className="px-3 py-3 font-mono text-slate-800 whitespace-nowrap">
                      {m.msdLevel}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="text-slate-800">
                        {m.packagingName || m.packageType}
                      </div>
                      <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                        MPQ {(m.mpq ?? 1000).toLocaleString()} {m.unit}
                      </div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="font-mono text-[11px] font-medium text-slate-700">
                        {m.supplierCode || '-'}
                      </div>
                      <div className="text-slate-600">{m.supplierName || '-'}</div>
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <div className="font-mono text-slate-800">{m.defaultBin}</div>
                      <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                        {m.safetyStock.toLocaleString()} {m.unit}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {isConfirming ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleConfirmDelete(rowKey, m.skuCode)}
                            className="rounded bg-red-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-red-700"
                          >
                            确认?
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteKey(null)}
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => startEdit(m)}
                            className="inline-flex items-center gap-1 font-medium text-teal-700 hover:text-teal-900"
                          >
                            <Pencil className="h-3 w-3" />
                            编辑
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteKey(rowKey)}
                            aria-label={`删除 ${m.skuCode}`}
                            className="inline-flex items-center gap-0.5 text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            删除
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
