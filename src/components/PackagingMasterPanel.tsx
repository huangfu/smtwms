import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import type { PackagingCarrierType, PackagingSpec, WmsState } from '../types/wms';
import { PACKAGING_CARRIER_LABEL } from '../utils/formatters';

interface PackagingMasterPanelProps {
  state: WmsState;
  onAddPackagingSpec: (spec: PackagingSpec) => Promise<void>;
  onUpdatePackagingSpec: (code: string, spec: PackagingSpec) => Promise<void>;
  onDeletePackagingSpec: (code: string) => Promise<void>;
}

export function PackagingMasterPanel({
  state,
  onAddPackagingSpec,
  onUpdatePackagingSpec,
  onDeletePackagingSpec,
}: PackagingMasterPanelProps) {
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [confirmDeleteCode, setConfirmDeleteCode] = useState<string | null>(null);

  const [packagingCode, setPackagingCode] = useState('');
  const [packagingName, setPackagingName] = useState('');
  const [carrierType, setCarrierType] = useState<PackagingCarrierType>('REEL');
  const [reelDiameter, setReelDiameter] = useState('7寸 (178mm)');
  const [tapeWidthMm, setTapeWidthMm] = useState('12');
  const [pitchMm, setPitchMm] = useState('8');
  const [defaultSpq, setDefaultSpq] = useState('2000');
  const [allowSplit, setAllowSplit] = useState(true);
  const [allowMerge, setAllowMerge] = useState(false);
  const [description, setDescription] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const resetForm = () => {
    setEditingCode(null);
    setPackagingCode('');
    setPackagingName('');
    setCarrierType('REEL');
    setReelDiameter('7寸 (178mm)');
    setTapeWidthMm('12');
    setPitchMm('8');
    setDefaultSpq('2000');
    setAllowSplit(true);
    setAllowMerge(false);
    setDescription('');
  };

  const startEdit = (spec: PackagingSpec) => {
    setEditingCode(spec.packagingCode);
    setPackagingCode(spec.packagingCode);
    setPackagingName(spec.packagingName);
    setCarrierType(spec.carrierType);
    setReelDiameter(spec.reelDiameter);
    setTapeWidthMm(String(spec.tapeWidthMm));
    setPitchMm(String(spec.pitchMm));
    setDefaultSpq(String(spec.defaultSpq));
    setAllowSplit(spec.allowSplit);
    setAllowMerge(spec.allowMerge);
    setDescription(spec.description);
    setErr(null);
    setMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    try {
      const payload: PackagingSpec = {
        packagingCode,
        packagingName,
        carrierType,
        reelDiameter,
        tapeWidthMm: Number(tapeWidthMm) || 0,
        pitchMm: Number(pitchMm) || 0,
        defaultSpq: Number(defaultSpq) || 1000,
        allowSplit,
        allowMerge,
        description,
      };
      if (editingCode) {
        await onUpdatePackagingSpec(editingCode, payload);
        setMsg(`已更新包装规格 ${editingCode} (SPQ ${defaultSpq})`);
      } else {
        await onAddPackagingSpec(payload);
        setMsg(`已新增包装规格 ${packagingCode.toUpperCase()} (SPQ ${defaultSpq})`);
      }
      resetForm();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '保存包装方式失败');
    }
  };

  const handleConfirmDelete = async (code: string) => {
    setErr(null);
    setMsg(null);
    try {
      await onDeletePackagingSpec(code);
      if (editingCode === code) resetForm();
      setConfirmDeleteCode(null);
      setMsg(`已删除包装规格 ${code}`);
    } catch (e) {
      setConfirmDeleteCode(null);
      setErr(e instanceof Error ? e.message : '删除包装方式失败');
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              {editingCode ? `修改包装方式 (${editingCode})` : '新增物料包装方式与 SPQ 标准'}
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              定义 SMT 载带卷盘/托盘/料管规格、默认最小包装量及拆合盘控制规则
            </p>
          </div>
          {editingCode && (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <X className="h-3.5 w-3.5" />
              取消编辑
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
            <div className="md:col-span-2">
              <label htmlFor="pkg-code" className="block text-xs font-medium text-slate-700">
                包装编码 <span className="text-red-600">*</span>
              </label>
              <input
                id="pkg-code"
                type="text"
                required
                readOnly={Boolean(editingCode)}
                value={packagingCode}
                onChange={(e) => setPackagingCode(e.target.value)}
                placeholder="PKG-REEL-7-12"
                className={`mt-1 w-full rounded-md border px-2.5 py-1.5 font-mono text-xs ${
                  editingCode ? 'border-slate-200 bg-slate-100 text-slate-500' : 'border-slate-300'
                }`}
              />
            </div>
            <div className="md:col-span-4">
              <label htmlFor="pkg-name" className="block text-xs font-medium text-slate-700">
                包装方式名称 <span className="text-red-600">*</span>
              </label>
              <input
                id="pkg-name"
                type="text"
                required
                value={packagingName}
                onChange={(e) => setPackagingName(e.target.value)}
                placeholder="7寸卷盘 · 12mm载带 (2000/盘)"
                className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="pkg-carrier" className="block text-xs font-medium text-slate-700">
                包装载具形态
              </label>
              <select
                id="pkg-carrier"
                value={carrierType}
                onChange={(e) => setCarrierType(e.target.value as PackagingCarrierType)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
              >
                {Object.entries(PACKAGING_CARRIER_LABEL).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label htmlFor="pkg-dia" className="block text-xs font-medium text-slate-700">
                卷盘直径/尺寸
              </label>
              <input
                id="pkg-dia"
                type="text"
                value={reelDiameter}
                onChange={(e) => setReelDiameter(e.target.value)}
                placeholder="7寸 / 13寸 / -"
                className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="pkg-spq" className="block text-xs font-medium text-slate-700">
                标准 SPQ <span className="text-red-600">*</span>
              </label>
              <input
                id="pkg-spq"
                type="number"
                min={1}
                required
                value={defaultSpq}
                onChange={(e) => setDefaultSpq(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-xs tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-12 items-end">
            <div className="md:col-span-2">
              <label htmlFor="pkg-width" className="block text-xs font-medium text-slate-700">
                载带宽度 (mm)
              </label>
              <input
                id="pkg-width"
                type="number"
                min={0}
                value={tapeWidthMm}
                onChange={(e) => setTapeWidthMm(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-xs tabular-nums"
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="pkg-pitch" className="block text-xs font-medium text-slate-700">
                间距 Pitch (mm)
              </label>
              <input
                id="pkg-pitch"
                type="number"
                min={0}
                value={pitchMm}
                onChange={(e) => setPitchMm(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-xs tabular-nums"
              />
            </div>
            <div className="md:col-span-4">
              <label htmlFor="pkg-desc" className="block text-xs font-medium text-slate-700">
                适用封装及Feeder说明
              </label>
              <input
                id="pkg-desc"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="例如：匹配 Yamaha 12mm 电动飞达"
                className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
              />
            </div>
            <div className="md:col-span-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-4 text-xs">
                <label className="inline-flex items-center gap-1.5 text-slate-700 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={allowSplit}
                    onChange={(e) => setAllowSplit(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  允许分盘
                </label>
                <label className="inline-flex items-center gap-1.5 text-slate-700 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={allowMerge}
                    onChange={(e) => setAllowMerge(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  允许合盘
                </label>
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1 rounded-md bg-sky-700 px-4 py-2 text-xs font-medium text-white hover:bg-sky-800 whitespace-nowrap shrink-0"
              >
                {editingCode ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                {editingCode ? '保存修改' : '保存包装规格'}
              </button>
            </div>
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
        </form>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">
            SMT 包装方式与 SPQ 主数据台账 ({state.packagingSpecs.length} 种)
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-500">
            收料入库、Feeder 选型与散料分盘退库均校验此标准最小包装量 (SPQ)
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium whitespace-nowrap">编码</th>
                <th className="px-4 py-2.5 font-medium whitespace-nowrap">包装方式名称 / 说明</th>
                <th className="px-3 py-2.5 font-medium whitespace-nowrap">载具形态</th>
                <th className="px-3 py-2.5 font-medium whitespace-nowrap">盘径 / 带宽 / 间距</th>
                <th className="px-3 py-2.5 font-medium text-right whitespace-nowrap">标准 SPQ</th>
                <th className="px-3 py-2.5 font-medium whitespace-nowrap">分合盘规则</th>
                <th className="px-3 py-2.5 font-medium text-right whitespace-nowrap">引用SKU</th>
                <th className="px-4 py-2.5 font-medium text-right whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.packagingSpecs.map((spec) => {
                const refCount = state.materials.filter(
                  (m) => m.packagingCode === spec.packagingCode
                ).length;
                const isConfirming = confirmDeleteCode === spec.packagingCode;
                return (
                  <tr
                    key={spec.packagingCode}
                    className={`hover:bg-slate-50 ${
                      editingCode === spec.packagingCode ? 'bg-sky-50/40' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-mono font-semibold text-slate-900 whitespace-nowrap">
                      {spec.packagingCode}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{spec.packagingName}</div>
                      <div className="text-[11px] text-slate-400">{spec.description}</div>
                    </td>
                    <td className="px-3 py-3 text-slate-700 whitespace-nowrap">
                      {PACKAGING_CARRIER_LABEL[spec.carrierType]}
                    </td>
                    <td className="px-3 py-3 font-mono text-slate-600 whitespace-nowrap">
                      {spec.reelDiameter} · {spec.tapeWidthMm > 0 ? `${spec.tapeWidthMm}mm` : '-'} ·{' '}
                      {spec.pitchMm > 0 ? `P${spec.pitchMm}` : '-'}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                      {spec.defaultSpq.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className={spec.allowSplit ? 'text-emerald-700' : 'text-slate-400'}>
                        {spec.allowSplit ? '允许分盘' : '禁止分盘'}
                      </span>
                      <span className="mx-1.5 text-slate-300">·</span>
                      <span className={spec.allowMerge ? 'text-sky-700' : 'text-slate-400'}>
                        {spec.allowMerge ? '可合盘' : '禁止合盘'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                      {refCount}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {isConfirming ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleConfirmDelete(spec.packagingCode)}
                            className="rounded bg-red-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-red-700"
                          >
                            确认?
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteCode(null)}
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-600"
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => startEdit(spec)}
                            className="inline-flex items-center gap-1 font-medium text-sky-700 hover:text-sky-900"
                          >
                            <Pencil className="h-3 w-3" />
                            编辑
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteCode(spec.packagingCode)}
                            aria-label={`删除 ${spec.packagingCode}`}
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
