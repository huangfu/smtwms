import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import type { Warehouse, WarehouseBin, WarehouseKeeper, WarehouseZone, WmsState } from '../../shared/types/wms';

interface WarehouseMasterPanelProps {
  state: WmsState;
  readOnly?: boolean;
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
}

const ZONES: WarehouseZone[] = [
  '电子料主库区',
  '防潮恒温柜(MSD)',
  'PCB板库区',
  '锡膏冷藏库',
  '产线暂存区',
  '待检/隔离区',
];

export function WarehouseMasterPanel({
  state,
  readOnly = false,
  onAddWarehouse,
  onUpdateWarehouse,
  onDeleteWarehouse,
  onAddBin,
  onUpdateBin,
  onDeleteBin,
  onAddKeeper,
  onUpdateKeeper,
  onDeleteKeeper,
}: WarehouseMasterPanelProps) {
  const [subSection, setSubSection] = useState<'warehouses' | 'bins' | 'keepers'>('warehouses');

  // Warehouse form
  const [editingWhCode, setEditingWhCode] = useState<string | null>(null);
  const [confirmDeleteWhCode, setConfirmDeleteWhCode] = useState<string | null>(null);
  const [whCode, setWhCode] = useState('');
  const [whName, setWhName] = useState('');
  const [whType, setWhType] = useState('恒温防静电主仓 (22±3℃)');
  const [whManagerId, setWhManagerId] = useState(state.keepers[0]?.keeperId ?? '');
  const [whAddress, setWhAddress] = useState('');

  // Bin form
  const [editingBinCode, setEditingBinCode] = useState<string | null>(null);
  const [confirmDeleteBinCode, setConfirmDeleteBinCode] = useState<string | null>(null);
  const [binCode, setBinCode] = useState('');
  const [binWarehouse, setBinWarehouse] = useState(
    state.warehouses[0]?.warehouseCode ?? 'WH-SMT-01'
  );
  const [binZone, setBinZone] = useState<WarehouseZone>('电子料主库区');
  const [binCap, setBinCap] = useState('30');
  const [binKeeper, setBinKeeper] = useState(state.keepers[0]?.name ?? '张伟');
  const [binDesc, setBinDesc] = useState('');
  const [binFilterWh, setBinFilterWh] = useState('ALL');

  // Keeper form
  const [editingKeeperId, setEditingKeeperId] = useState<string | null>(null);
  const [confirmDeleteKeeperId, setConfirmDeleteKeeperId] = useState<string | null>(null);
  const [empNo, setEmpNo] = useState('');
  const [keeperName, setKeeperName] = useState('');
  const [keeperRole, setKeeperRole] = useState<WarehouseKeeper['role']>('收料仓管员');
  const [keeperWh, setKeeperWh] = useState(state.warehouses[0]?.warehouseCode ?? 'WH-SMT-01');
  const [keeperPhone, setKeeperPhone] = useState('');
  const [keeperShift, setKeeperShift] = useState<WarehouseKeeper['shift']>('白班');

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const resetWhForm = () => {
    setEditingWhCode(null);
    setWhCode('');
    setWhName('');
    setWhType('恒温防静电主仓 (22±3℃)');
    setWhManagerId(state.keepers[0]?.keeperId ?? '');
    setWhAddress('');
  };

  const startEditWh = (wh: Warehouse) => {
    setEditingWhCode(wh.warehouseCode);
    setWhCode(wh.warehouseCode);
    setWhName(wh.warehouseName);
    setWhType(wh.warehouseType);
    setWhManagerId(wh.managerId);
    setWhAddress(wh.address);
    setErr(null);
    setMsg(null);
  };

  const handleWhSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    try {
      if (editingWhCode) {
        await onUpdateWarehouse(editingWhCode, {
          warehouseName: whName,
          warehouseType: whType,
          managerId: whManagerId,
          address: whAddress,
        });
        setMsg(`已更新仓库 ${whName} (${editingWhCode})`);
      } else {
        await onAddWarehouse({
          warehouseCode: whCode,
          warehouseName: whName,
          warehouseType: whType,
          managerId: whManagerId,
          address: whAddress,
        });
        setMsg(`已新增仓库 ${whName} (${whCode.toUpperCase()})`);
      }
      resetWhForm();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '保存仓库失败');
    }
  };

  const handleConfirmDeleteWh = async (code: string) => {
    setErr(null);
    setMsg(null);
    try {
      await onDeleteWarehouse(code);
      if (editingWhCode === code) resetWhForm();
      setConfirmDeleteWhCode(null);
      setMsg(`已删除仓库 ${code}`);
    } catch (e) {
      setConfirmDeleteWhCode(null);
      setErr(e instanceof Error ? e.message : '删除仓库失败');
    }
  };

  const resetBinForm = () => {
    setEditingBinCode(null);
    setBinCode('');
    setBinWarehouse(state.warehouses[0]?.warehouseCode ?? 'WH-SMT-01');
    setBinZone('电子料主库区');
    setBinCap('30');
    setBinKeeper(state.keepers[0]?.name ?? '张伟');
    setBinDesc('');
  };

  const startEditBin = (b: WarehouseBin) => {
    setEditingBinCode(b.binCode);
    setBinCode(b.binCode);
    setBinWarehouse(b.warehouseCode ?? state.warehouses[0]?.warehouseCode ?? 'WH-SMT-01');
    setBinZone(b.zone);
    setBinCap(String(b.capacityReels));
    setBinKeeper(b.keeperName ?? state.keepers[0]?.name ?? '张伟');
    setBinDesc(b.description);
    setErr(null);
    setMsg(null);
  };

  const handleBinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    try {
      if (editingBinCode) {
        await onUpdateBin(editingBinCode, {
          warehouseCode: binWarehouse,
          zone: binZone,
          capacityReels: Number(binCap) || 20,
          keeperName: binKeeper,
          description: binDesc || `${binZone} 标准储位`,
        });
        setMsg(`已更新库位 ${editingBinCode}`);
      } else {
        await onAddBin({
          binCode,
          warehouseCode: binWarehouse,
          zone: binZone,
          capacityReels: Number(binCap) || 20,
          keeperName: binKeeper,
          description: binDesc || `${binZone} 标准储位`,
        });
        setMsg(`已新增库位 ${binCode.toUpperCase()}`);
      }
      resetBinForm();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '保存库位失败');
    }
  };

  const handleConfirmDeleteBin = async (code: string) => {
    setErr(null);
    setMsg(null);
    try {
      await onDeleteBin(code);
      if (editingBinCode === code) resetBinForm();
      setConfirmDeleteBinCode(null);
      setMsg(`已删除库位 ${code}`);
    } catch (e) {
      setConfirmDeleteBinCode(null);
      setErr(e instanceof Error ? e.message : '删除库位失败');
    }
  };

  const resetKeeperForm = () => {
    setEditingKeeperId(null);
    setEmpNo('');
    setKeeperName('');
    setKeeperRole('收料仓管员');
    setKeeperWh(state.warehouses[0]?.warehouseCode ?? 'WH-SMT-01');
    setKeeperPhone('');
    setKeeperShift('白班');
  };

  const startEditKeeper = (k: WarehouseKeeper) => {
    setEditingKeeperId(k.keeperId);
    setEmpNo(k.employeeNo);
    setKeeperName(k.name);
    setKeeperRole(k.role);
    setKeeperWh(k.warehouseCode);
    setKeeperPhone(k.phone);
    setKeeperShift(k.shift);
    setErr(null);
    setMsg(null);
  };

  const handleKeeperSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    try {
      if (editingKeeperId) {
        await onUpdateKeeper(editingKeeperId, {
          employeeNo: empNo,
          name: keeperName,
          role: keeperRole,
          warehouseCode: keeperWh,
          phone: keeperPhone,
          shift: keeperShift,
        });
        setMsg(`已更新仓库管理员 ${keeperName}`);
      } else {
        await onAddKeeper({
          employeeNo: empNo,
          name: keeperName,
          role: keeperRole,
          warehouseCode: keeperWh,
          phone: keeperPhone,
          shift: keeperShift,
        });
        setMsg(`已新增仓库管理员 ${keeperName}`);
      }
      resetKeeperForm();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '保存管理员失败');
    }
  };

  const handleConfirmDeleteKeeper = async (k: WarehouseKeeper) => {
    setErr(null);
    setMsg(null);
    try {
      await onDeleteKeeper(k.keeperId);
      if (editingKeeperId === k.keeperId) resetKeeperForm();
      setConfirmDeleteKeeperId(null);
      setMsg(`已删除管理员 ${k.name}`);
    } catch (e) {
      setConfirmDeleteKeeperId(null);
      setErr(e instanceof Error ? e.message : '删除管理员失败');
    }
  };

  const filteredBins = state.bins.filter(
    (b) => binFilterWh === 'ALL' || b.warehouseCode === binFilterWh
  );

  return (
    <div className="space-y-4">
      <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
        {[
          { id: 'warehouses', label: `仓库管理 (${state.warehouses.length})` },
          { id: 'bins', label: `库位管理 (${state.bins.length})` },
          { id: 'keepers', label: `仓库管理员 (${state.keepers.length})` },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setSubSection(item.id as typeof subSection);
              setErr(null);
              setMsg(null);
            }}
            className={`rounded-md px-3.5 py-1.5 text-xs whitespace-nowrap shrink-0 ${
              subSection === item.id
                ? 'bg-white font-semibold text-teal-800 shadow-sm border border-slate-200/80'
                : 'font-medium text-slate-600 hover:text-slate-900 border border-transparent'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {subSection === 'warehouses' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          {!readOnly && (
          <section className="rounded-lg border border-slate-200 bg-white p-5 xl:col-span-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-sm font-semibold text-slate-900">
                {editingWhCode ? `修改仓库 (${editingWhCode})` : '新增仓库档案'}
              </h2>
              {editingWhCode && (
                <button
                  type="button"
                  onClick={resetWhForm}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-0.5 text-[11px] text-slate-600"
                >
                  <X className="h-3 w-3" />
                  取消
                </button>
              )}
            </div>
            <form onSubmit={handleWhSubmit} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="wh-code" className="block text-xs font-medium text-slate-700">
                    仓库编码 <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="wh-code"
                    type="text"
                    required
                    readOnly={Boolean(editingWhCode)}
                    value={whCode}
                    onChange={(e) => setWhCode(e.target.value)}
                    placeholder="WH-SMT-02"
                    className={`mt-1 w-full rounded-md border px-2.5 py-1.5 font-mono text-xs ${
                      editingWhCode ? 'border-slate-200 bg-slate-100 text-slate-500' : 'border-slate-300'
                    }`}
                  />
                </div>
                <div>
                  <label htmlFor="wh-mgr" className="block text-xs font-medium text-slate-700">
                    仓库管理员 <span className="text-red-600">*</span>
                  </label>
                  <select
                    id="wh-mgr"
                    value={whManagerId}
                    onChange={(e) => setWhManagerId(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                  >
                    {state.keepers.map((k) => (
                      <option key={k.keeperId} value={k.keeperId}>
                        {k.name} ({k.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="wh-name" className="block text-xs font-medium text-slate-700">
                  仓库名称 <span className="text-red-600">*</span>
                </label>
                <input
                  id="wh-name"
                  type="text"
                  required
                  value={whName}
                  onChange={(e) => setWhName(e.target.value)}
                  placeholder="如 SMT二厂防静电主仓"
                  className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
                />
              </div>
              <div>
                <label htmlFor="wh-type" className="block text-xs font-medium text-slate-700">
                  仓库温湿度/类型
                </label>
                <input
                  id="wh-type"
                  type="text"
                  value={whType}
                  onChange={(e) => setWhType(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
                />
              </div>
              <div>
                <label htmlFor="wh-addr" className="block text-xs font-medium text-slate-700">
                  物理位置 / 区域
                </label>
                <input
                  id="wh-addr"
                  type="text"
                  value={whAddress}
                  onChange={(e) => setWhAddress(e.target.value)}
                  placeholder="如 B栋1楼东侧"
                  className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
                />
              </div>

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

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-1 rounded-md bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800"
              >
                {editingWhCode ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                {editingWhCode ? '保存仓库修改' : '保存仓库信息'}
              </button>
            </form>
          </section>
          )}

          <section
            className={`rounded-lg border border-slate-200 bg-white ${
              readOnly ? 'xl:col-span-12' : 'xl:col-span-8'
            }`}
          >
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-900">
                仓库档案台账 ({state.warehouses.length} 个)
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5 font-medium whitespace-nowrap">仓库编码 / 名称</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">环境类型</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">仓库管理员</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">物理位置</th>
                    <th className="px-3 py-2.5 font-medium text-right whitespace-nowrap">库位 / 在库</th>
                    {!readOnly && (
                      <th className="px-4 py-2.5 font-medium text-right whitespace-nowrap">操作</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.warehouses.map((wh) => {
                    const whBins = state.bins.filter((b) => b.warehouseCode === wh.warehouseCode);
                    const binSet = new Set(whBins.map((b) => b.binCode));
                    const reelCount = state.reels.filter(
                      (r) =>
                        binSet.has(r.binCode) &&
                        r.status !== 'DEPLETED' &&
                        r.status !== 'SCRAPPED'
                    ).length;
                    const isConfirming = confirmDeleteWhCode === wh.warehouseCode;
                    return (
                      <tr
                        key={wh.warehouseCode}
                        className={`hover:bg-slate-50 ${
                          editingWhCode === wh.warehouseCode ? 'bg-teal-50/40' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{wh.warehouseName}</div>
                          <div className="font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {wh.warehouseCode}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-slate-700">{wh.warehouseType}</td>
                        <td className="px-3 py-3 font-medium text-slate-900 whitespace-nowrap">
                          {wh.managerName}
                        </td>
                        <td className="px-3 py-3 text-slate-600">{wh.address}</td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums whitespace-nowrap text-slate-700">
                          {whBins.length} 位 · {reelCount} 盘
                        </td>
                        {!readOnly && (
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {isConfirming ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleConfirmDeleteWh(wh.warehouseCode)}
                                className="rounded bg-red-600 px-2 py-0.5 text-[11px] font-medium text-white"
                              >
                                确认?
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteWhCode(null)}
                                className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-600"
                              >
                                取消
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-2.5">
                              <button
                                type="button"
                                onClick={() => startEditWh(wh)}
                                className="font-medium text-teal-700 hover:text-teal-900"
                              >
                                编辑
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteWhCode(wh.warehouseCode)}
                                aria-label={`删除仓库 ${wh.warehouseCode}`}
                                className="text-slate-400 hover:text-red-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {subSection === 'bins' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          {!readOnly && (
          <section className="rounded-lg border border-slate-200 bg-white p-5 xl:col-span-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-sm font-semibold text-slate-900">
                {editingBinCode ? `修改库位 (${editingBinCode})` : '新增库位储位'}
              </h2>
              {editingBinCode && (
                <button
                  type="button"
                  onClick={resetBinForm}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-0.5 text-[11px] text-slate-600"
                >
                  <X className="h-3 w-3" />
                  取消
                </button>
              )}
            </div>
            <form onSubmit={handleBinSubmit} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="b-code" className="block text-xs font-medium text-slate-700">
                    库位编码 <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="b-code"
                    type="text"
                    required
                    readOnly={Boolean(editingBinCode)}
                    value={binCode}
                    onChange={(e) => setBinCode(e.target.value)}
                    placeholder="C-01-01"
                    className={`mt-1 w-full rounded-md border px-2.5 py-1.5 font-mono text-xs ${
                      editingBinCode ? 'border-slate-200 bg-slate-100 text-slate-500' : 'border-slate-300'
                    }`}
                  />
                </div>
                <div>
                  <label htmlFor="b-cap" className="block text-xs font-medium text-slate-700">
                    最大容盘数
                  </label>
                  <input
                    id="b-cap"
                    type="number"
                    min={1}
                    value={binCap}
                    onChange={(e) => setBinCap(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-xs"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="b-wh" className="block text-xs font-medium text-slate-700">
                  所属仓库
                </label>
                <select
                  id="b-wh"
                  value={binWarehouse}
                  onChange={(e) => setBinWarehouse(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  {state.warehouses.map((w) => (
                    <option key={w.warehouseCode} value={w.warehouseCode}>
                      {w.warehouseName} ({w.warehouseCode})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="b-zone" className="block text-xs font-medium text-slate-700">
                    所属库区类型
                  </label>
                  <select
                    id="b-zone"
                    value={binZone}
                    onChange={(e) => setBinZone(e.target.value as WarehouseZone)}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                  >
                    {ZONES.map((z) => (
                      <option key={z} value={z}>
                        {z}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="b-keeper" className="block text-xs font-medium text-slate-700">
                    责任管理员
                  </label>
                  <select
                    id="b-keeper"
                    value={binKeeper}
                    onChange={(e) => setBinKeeper(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                  >
                    {state.keepers.map((k) => (
                      <option key={k.keeperId} value={k.name}>
                        {k.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="b-desc" className="block text-xs font-medium text-slate-700">
                  库位用途说明
                </label>
                <input
                  id="b-desc"
                  type="text"
                  value={binDesc}
                  onChange={(e) => setBinDesc(e.target.value)}
                  placeholder="如 QFN/BGA专用防潮柜层架"
                  className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
                />
              </div>

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

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-1 rounded-md bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800"
              >
                {editingBinCode ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                {editingBinCode ? '保存库位修改' : '新增库位'}
              </button>
            </form>
          </section>
          )}

          <section
            className={`rounded-lg border border-slate-200 bg-white ${
              readOnly ? 'xl:col-span-12' : 'xl:col-span-8'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-900">
                库位明细台账 ({filteredBins.length} 个)
              </h2>
              <select
                aria-label="按仓库筛选库位"
                value={binFilterWh}
                onChange={(e) => setBinFilterWh(e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700"
              >
                <option value="ALL">全部仓库</option>
                {state.warehouses.map((w) => (
                  <option key={w.warehouseCode} value={w.warehouseCode}>
                    {w.warehouseName}
                  </option>
                ))}
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5 font-medium whitespace-nowrap">库位编码</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">所属仓库 / 库区</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">责任管理员</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">说明</th>
                    <th className="px-3 py-2.5 font-medium text-right whitespace-nowrap">占用 / 容量</th>
                    {!readOnly && (
                      <th className="px-4 py-2.5 font-medium text-right whitespace-nowrap">操作</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBins.map((b) => {
                    const wh = state.warehouses.find((w) => w.warehouseCode === b.warehouseCode);
                    const used = state.reels.filter(
                      (r) =>
                        r.binCode === b.binCode &&
                        r.status !== 'DEPLETED' &&
                        r.status !== 'SCRAPPED'
                    ).length;
                    const isConfirming = confirmDeleteBinCode === b.binCode;
                    return (
                      <tr
                        key={b.binCode}
                        className={`hover:bg-slate-50 ${
                          editingBinCode === b.binCode ? 'bg-teal-50/40' : ''
                        }`}
                      >
                        <td className="px-4 py-3 font-mono font-semibold text-slate-900 whitespace-nowrap">
                          {b.binCode}
                        </td>
                        <td className="px-3 py-3">
                          <div className="text-slate-900">{wh?.warehouseName ?? b.warehouseCode}</div>
                          <div className="text-[11px] text-slate-500">{b.zone}</div>
                        </td>
                        <td className="px-3 py-3 text-slate-700 whitespace-nowrap">
                          {b.keeperName || wh?.managerName || '-'}
                        </td>
                        <td className="px-3 py-3 text-slate-600">{b.description}</td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums whitespace-nowrap text-slate-800">
                          {used} / {b.capacityReels} 盘
                        </td>
                        {!readOnly && (
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {isConfirming ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleConfirmDeleteBin(b.binCode)}
                                className="rounded bg-red-600 px-2 py-0.5 text-[11px] font-medium text-white"
                              >
                                确认?
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteBinCode(null)}
                                className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-600"
                              >
                                取消
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-2.5">
                              <button
                                type="button"
                                onClick={() => startEditBin(b)}
                                className="font-medium text-teal-700 hover:text-teal-900"
                              >
                                编辑
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteBinCode(b.binCode)}
                                aria-label={`删除库位 ${b.binCode}`}
                                className="text-slate-400 hover:text-red-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {subSection === 'keepers' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          {!readOnly && (
          <section className="rounded-lg border border-slate-200 bg-white p-5 xl:col-span-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-sm font-semibold text-slate-900">
                {editingKeeperId ? `修改管理员 (${editingKeeperId})` : '新增仓库管理员 / 作业员'}
              </h2>
              {editingKeeperId && (
                <button
                  type="button"
                  onClick={resetKeeperForm}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-0.5 text-[11px] text-slate-600"
                >
                  <X className="h-3 w-3" />
                  取消
                </button>
              )}
            </div>
            <form onSubmit={handleKeeperSubmit} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="k-emp" className="block text-xs font-medium text-slate-700">
                    员工工号 <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="k-emp"
                    type="text"
                    required
                    value={empNo}
                    onChange={(e) => setEmpNo(e.target.value)}
                    placeholder="EMP-106"
                    className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="k-name" className="block text-xs font-medium text-slate-700">
                    管理员姓名 <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="k-name"
                    type="text"
                    required
                    value={keeperName}
                    onChange={(e) => setKeeperName(e.target.value)}
                    placeholder="刘洋"
                    className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="k-role" className="block text-xs font-medium text-slate-700">
                    岗位角色
                  </label>
                  <select
                    id="k-role"
                    value={keeperRole}
                    onChange={(e) => setKeeperRole(e.target.value as WarehouseKeeper['role'])}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                  >
                    <option value="仓库主管">仓库主管</option>
                    <option value="收料仓管员">收料仓管员</option>
                    <option value="波次发料员">波次发料员</option>
                    <option value="IQC/MSD专员">IQC/MSD专员</option>
                    <option value="产线物料员">产线物料员</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="k-shift" className="block text-xs font-medium text-slate-700">
                    班次
                  </label>
                  <select
                    id="k-shift"
                    value={keeperShift}
                    onChange={(e) => setKeeperShift(e.target.value as WarehouseKeeper['shift'])}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                  >
                    <option value="常白班">常白班</option>
                    <option value="白班">白班</option>
                    <option value="夜班">夜班</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="k-wh" className="block text-xs font-medium text-slate-700">
                  主责仓库
                </label>
                <select
                  id="k-wh"
                  value={keeperWh}
                  onChange={(e) => setKeeperWh(e.target.value)}
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
                <label htmlFor="k-phone" className="block text-xs font-medium text-slate-700">
                  联系电话
                </label>
                <input
                  id="k-phone"
                  type="text"
                  value={keeperPhone}
                  onChange={(e) => setKeeperPhone(e.target.value)}
                  placeholder="138-0013-8006"
                  className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-xs"
                />
              </div>

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

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-1 rounded-md bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800"
              >
                {editingKeeperId ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                {editingKeeperId ? '保存管理员修改' : '保存管理员档案'}
              </button>
            </form>
          </section>
          )}

          <section
            className={`rounded-lg border border-slate-200 bg-white ${
              readOnly ? 'xl:col-span-12' : 'xl:col-span-8'
            }`}
          >
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-900">
                仓库管理员名录 ({state.keepers.length} 人)
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5 font-medium whitespace-nowrap">工号 / 姓名</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">岗位角色</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">主责仓库</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">班次</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">联系电话</th>
                    {!readOnly && (
                      <th className="px-4 py-2.5 font-medium text-right whitespace-nowrap">操作</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.keepers.map((k) => {
                    const wh = state.warehouses.find((w) => w.warehouseCode === k.warehouseCode);
                    const isConfirming = confirmDeleteKeeperId === k.keeperId;
                    return (
                      <tr
                        key={k.keeperId}
                        className={`hover:bg-slate-50 ${
                          editingKeeperId === k.keeperId ? 'bg-teal-50/40' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{k.name}</div>
                          <div className="font-mono text-[11px] text-slate-500">{k.employeeNo}</div>
                        </td>
                        <td className="px-3 py-3 text-slate-700 whitespace-nowrap">{k.role}</td>
                        <td className="px-3 py-3 text-slate-700">
                          {wh?.warehouseName ?? k.warehouseCode}
                        </td>
                        <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{k.shift}</td>
                        <td className="px-3 py-3 font-mono text-slate-600 whitespace-nowrap">
                          {k.phone}
                        </td>
                        {!readOnly && (
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {isConfirming ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleConfirmDeleteKeeper(k)}
                                className="rounded bg-red-600 px-2 py-0.5 text-[11px] font-medium text-white"
                              >
                                确认?
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteKeeperId(null)}
                                className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-600"
                              >
                                取消
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-2.5">
                              <button
                                type="button"
                                onClick={() => startEditKeeper(k)}
                                className="font-medium text-teal-700 hover:text-teal-900"
                              >
                                编辑
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteKeeperId(k.keeperId)}
                                aria-label={`删除管理员 ${k.keeperId}`}
                                className="text-slate-400 hover:text-red-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
