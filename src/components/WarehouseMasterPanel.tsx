import { Plus } from 'lucide-react';
import { useState } from 'react';
import type { WarehouseBin, WarehouseKeeper, WarehouseZone, WmsState } from '../types/wms';

interface WarehouseMasterPanelProps {
  state: WmsState;
  onAddWarehouse: (payload: {
    warehouseCode: string;
    warehouseName: string;
    warehouseType: string;
    managerId: string;
    address: string;
  }) => Promise<void>;
  onAddBin: (payload: WarehouseBin) => Promise<void>;
  onAddKeeper: (
    payload: Omit<WarehouseKeeper, 'keeperId' | 'status'> & { keeperId?: string }
  ) => Promise<void>;
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
  onAddWarehouse,
  onAddBin,
  onAddKeeper,
}: WarehouseMasterPanelProps) {
  const [subSection, setSubSection] = useState<'warehouses' | 'bins' | 'keepers'>('warehouses');

  // Add Warehouse form
  const [whCode, setWhCode] = useState('');
  const [whName, setWhName] = useState('');
  const [whType, setWhType] = useState('恒温防静电主仓 (22±3℃)');
  const [whManagerId, setWhManagerId] = useState(state.keepers[0]?.keeperId ?? '');
  const [whAddress, setWhAddress] = useState('');

  // Add Bin form
  const [binCode, setBinCode] = useState('');
  const [binWarehouse, setBinWarehouse] = useState(
    state.warehouses[0]?.warehouseCode ?? 'WH-SMT-01'
  );
  const [binZone, setBinZone] = useState<WarehouseZone>('电子料主库区');
  const [binCap, setBinCap] = useState('30');
  const [binKeeper, setBinKeeper] = useState(state.keepers[0]?.name ?? '张伟');
  const [binDesc, setBinDesc] = useState('');
  const [binFilterWh, setBinFilterWh] = useState('ALL');

  // Add Keeper form
  const [empNo, setEmpNo] = useState('');
  const [keeperName, setKeeperName] = useState('');
  const [keeperRole, setKeeperRole] = useState<WarehouseKeeper['role']>('收料仓管员');
  const [keeperWh, setKeeperWh] = useState(state.warehouses[0]?.warehouseCode ?? 'WH-SMT-01');
  const [keeperPhone, setKeeperPhone] = useState('');
  const [keeperShift, setKeeperShift] = useState<WarehouseKeeper['shift']>('白班');

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const handleWhSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    try {
      await onAddWarehouse({
        warehouseCode: whCode,
        warehouseName: whName,
        warehouseType: whType,
        managerId: whManagerId,
        address: whAddress,
      });
      setMsg(`已新增仓库 ${whName} (${whCode.toUpperCase()})`);
      setWhCode('');
      setWhName('');
      setWhAddress('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : '新增仓库失败');
    }
  };

  const handleBinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    try {
      await onAddBin({
        binCode,
        warehouseCode: binWarehouse,
        zone: binZone,
        capacityReels: Number(binCap) || 20,
        keeperName: binKeeper,
        description: binDesc || `${binZone} 标准储位`,
      });
      setMsg(`已新增库位 ${binCode.toUpperCase()}`);
      setBinCode('');
      setBinDesc('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : '新增库位失败');
    }
  };

  const handleKeeperSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    try {
      await onAddKeeper({
        employeeNo: empNo,
        name: keeperName,
        role: keeperRole,
        warehouseCode: keeperWh,
        phone: keeperPhone,
        shift: keeperShift,
      });
      setMsg(`已新增仓库管理员 ${keeperName}`);
      setEmpNo('');
      setKeeperName('');
      setKeeperPhone('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : '新增管理员失败');
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
                ? 'bg-white font-semibold text-sky-800 shadow-sm border border-slate-200/80'
                : 'font-medium text-slate-600 hover:text-slate-900 border border-transparent'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {subSection === 'warehouses' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <section className="rounded-lg border border-slate-200 bg-white p-5 xl:col-span-4">
            <h2 className="border-b border-slate-200 pb-3 text-sm font-semibold text-slate-900">
              新增仓库档案
            </h2>
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
                    value={whCode}
                    onChange={(e) => setWhCode(e.target.value)}
                    placeholder="WH-SMT-02"
                    className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-xs"
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
                <div className="rounded border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
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
                className="inline-flex w-full items-center justify-center gap-1 rounded-md bg-sky-700 px-4 py-2 text-xs font-medium text-white hover:bg-sky-800"
              >
                <Plus className="h-3.5 w-3.5" />
                保存仓库信息
              </button>
            </form>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white xl:col-span-8">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-900">
                仓库档案台账 ({state.warehouses.length} 个)
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-5 py-2.5 font-medium whitespace-nowrap">仓库编码 / 名称</th>
                    <th className="px-4 py-2.5 font-medium whitespace-nowrap">环境类型</th>
                    <th className="px-4 py-2.5 font-medium whitespace-nowrap">仓库管理员</th>
                    <th className="px-4 py-2.5 font-medium whitespace-nowrap">物理位置</th>
                    <th className="px-5 py-2.5 font-medium text-right whitespace-nowrap">库位 / 在库盘数</th>
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
                    return (
                      <tr key={wh.warehouseCode} className="hover:bg-slate-50">
                        <td className="px-5 py-3">
                          <div className="font-semibold text-slate-900">{wh.warehouseName}</div>
                          <div className="font-mono text-[11px] text-slate-500">{wh.warehouseCode}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{wh.warehouseType}</td>
                        <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                          {wh.managerName}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{wh.address}</td>
                        <td className="px-5 py-3 text-right font-mono tabular-nums whitespace-nowrap text-slate-700">
                          {whBins.length} 位 · {reelCount} 盘
                        </td>
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
          <section className="rounded-lg border border-slate-200 bg-white p-5 xl:col-span-4">
            <h2 className="border-b border-slate-200 pb-3 text-sm font-semibold text-slate-900">
              新增库位储位
            </h2>
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
                    value={binCode}
                    onChange={(e) => setBinCode(e.target.value)}
                    placeholder="C-01-01"
                    className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-xs"
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
                <div className="rounded border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
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
                className="inline-flex w-full items-center justify-center gap-1 rounded-md bg-sky-700 px-4 py-2 text-xs font-medium text-white hover:bg-sky-800"
              >
                <Plus className="h-3.5 w-3.5" />
                新增库位
              </button>
            </form>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white xl:col-span-8">
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
                    <th className="px-5 py-2.5 font-medium whitespace-nowrap">库位编码</th>
                    <th className="px-4 py-2.5 font-medium whitespace-nowrap">所属仓库 / 库区</th>
                    <th className="px-4 py-2.5 font-medium whitespace-nowrap">责任管理员</th>
                    <th className="px-4 py-2.5 font-medium whitespace-nowrap">说明</th>
                    <th className="px-5 py-2.5 font-medium text-right whitespace-nowrap">占用 / 容量</th>
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
                    return (
                      <tr key={b.binCode} className="hover:bg-slate-50">
                        <td className="px-5 py-3 font-mono font-semibold text-slate-900 whitespace-nowrap">
                          {b.binCode}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-slate-900">{wh?.warehouseName ?? b.warehouseCode}</div>
                          <div className="text-[11px] text-slate-500">{b.zone}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                          {b.keeperName || wh?.managerName || '-'}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{b.description}</td>
                        <td className="px-5 py-3 text-right font-mono tabular-nums whitespace-nowrap text-slate-800">
                          {used} / {b.capacityReels} 盘
                        </td>
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
          <section className="rounded-lg border border-slate-200 bg-white p-5 xl:col-span-4">
            <h2 className="border-b border-slate-200 pb-3 text-sm font-semibold text-slate-900">
              新增仓库管理员 / 作业员
            </h2>
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
                <div className="rounded border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
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
                className="inline-flex w-full items-center justify-center gap-1 rounded-md bg-sky-700 px-4 py-2 text-xs font-medium text-white hover:bg-sky-800"
              >
                <Plus className="h-3.5 w-3.5" />
                保存管理员档案
              </button>
            </form>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white xl:col-span-8">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-900">
                仓库管理员名录 ({state.keepers.length} 人)
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-5 py-2.5 font-medium whitespace-nowrap">工号 / 姓名</th>
                    <th className="px-4 py-2.5 font-medium whitespace-nowrap">岗位角色</th>
                    <th className="px-4 py-2.5 font-medium whitespace-nowrap">主责仓库</th>
                    <th className="px-4 py-2.5 font-medium whitespace-nowrap">班次</th>
                    <th className="px-5 py-2.5 font-medium whitespace-nowrap">联系电话</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.keepers.map((k) => {
                    const wh = state.warehouses.find((w) => w.warehouseCode === k.warehouseCode);
                    return (
                      <tr key={k.keeperId} className="hover:bg-slate-50">
                        <td className="px-5 py-3">
                          <div className="font-semibold text-slate-900">{k.name}</div>
                          <div className="font-mono text-[11px] text-slate-500">{k.employeeNo}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{k.role}</td>
                        <td className="px-4 py-3 text-slate-700">
                          {wh?.warehouseName ?? k.warehouseCode}
                        </td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{k.shift}</td>
                        <td className="px-5 py-3 font-mono text-slate-600 whitespace-nowrap">
                          {k.phone}
                        </td>
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
