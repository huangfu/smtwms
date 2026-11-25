import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import type { Customer, Supplier, WmsState } from '../../shared/types/wms';

interface PartnerMasterPanelProps {
  state: WmsState;
  readOnly?: boolean;
  onAddSupplier: (payload: Supplier) => Promise<void>;
  onUpdateSupplier: (code: string, payload: Omit<Supplier, 'supplierCode'>) => Promise<void>;
  onDeleteSupplier: (code: string) => Promise<void>;
  onAddCustomer: (payload: Customer) => Promise<void>;
  onUpdateCustomer: (code: string, payload: Omit<Customer, 'customerCode'>) => Promise<void>;
  onDeleteCustomer: (code: string) => Promise<void>;
}

export function PartnerMasterPanel({
  state,
  readOnly = false,
  onAddSupplier,
  onUpdateSupplier,
  onDeleteSupplier,
  onAddCustomer,
  onUpdateCustomer,
  onDeleteCustomer,
}: PartnerMasterPanelProps) {
  const [subTab, setSubTab] = useState<'suppliers' | 'customers'>('suppliers');

  // Supplier form
  const [editingSupCode, setEditingSupCode] = useState<string | null>(null);
  const [confirmDeleteSupCode, setConfirmDeleteSupCode] = useState<string | null>(null);
  const [supCode, setSupCode] = useState('');
  const [supName, setSupName] = useState('');
  const [supContact, setSupContact] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supTags, setSupTags] = useState('IC芯片 / 阻容感');
  const [supGrade, setSupGrade] = useState<Supplier['qualityGrade']>('B级抽检');
  const [supLead, setSupLead] = useState('7');
  const [supNotes, setSupNotes] = useState('');

  // Customer form
  const [editingCusCode, setEditingCusCode] = useState<string | null>(null);
  const [confirmDeleteCusCode, setConfirmDeleteCusCode] = useState<string | null>(null);
  const [cusCode, setCusCode] = useState('');
  const [cusName, setCusName] = useState('');
  const [cusContact, setCusContact] = useState('');
  const [cusPhone, setCusPhone] = useState('');
  const [cusIndustry, setCusIndustry] = useState('工业控制PCBA');
  const [cusTrace, setCusTrace] = useState('需IPC-1782全程UID+DateCode追溯');
  const [cusAddr, setCusAddr] = useState('');

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const resetSupForm = () => {
    setEditingSupCode(null);
    setSupCode('');
    setSupName('');
    setSupContact('');
    setSupPhone('');
    setSupTags('IC芯片 / 阻容感');
    setSupGrade('B级抽检');
    setSupLead('7');
    setSupNotes('');
  };

  const startEditSup = (s: Supplier) => {
    setEditingSupCode(s.supplierCode);
    setSupCode(s.supplierCode);
    setSupName(s.supplierName);
    setSupContact(s.contactName);
    setSupPhone(s.phone);
    setSupTags(s.categoryTags);
    setSupGrade(s.qualityGrade);
    setSupLead(String(s.leadTimeDays));
    setSupNotes(s.notes ?? '');
    setErr(null);
    setMsg(null);
  };

  const handleSupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    try {
      if (editingSupCode) {
        await onUpdateSupplier(editingSupCode, {
          supplierName: supName,
          contactName: supContact,
          phone: supPhone,
          categoryTags: supTags,
          qualityGrade: supGrade,
          leadTimeDays: Number(supLead) || 7,
          notes: supNotes,
        });
        setMsg(`已更新供应商 ${supName}`);
      } else {
        await onAddSupplier({
          supplierCode: supCode,
          supplierName: supName,
          contactName: supContact,
          phone: supPhone,
          categoryTags: supTags,
          qualityGrade: supGrade,
          leadTimeDays: Number(supLead) || 7,
          notes: supNotes,
        });
        setMsg(`已新增供应商 ${supName}`);
      }
      resetSupForm();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '保存供应商失败');
    }
  };

  const handleConfirmDeleteSup = async (code: string) => {
    setErr(null);
    setMsg(null);
    try {
      await onDeleteSupplier(code);
      if (editingSupCode === code) resetSupForm();
      setConfirmDeleteSupCode(null);
      setMsg(`已删除供应商 ${code}`);
    } catch (e) {
      setConfirmDeleteSupCode(null);
      setErr(e instanceof Error ? e.message : '删除供应商失败');
    }
  };

  const resetCusForm = () => {
    setEditingCusCode(null);
    setCusCode('');
    setCusName('');
    setCusContact('');
    setCusPhone('');
    setCusIndustry('工业控制PCBA');
    setCusTrace('需IPC-1782全程UID+DateCode追溯');
    setCusAddr('');
  };

  const startEditCus = (c: Customer) => {
    setEditingCusCode(c.customerCode);
    setCusCode(c.customerCode);
    setCusName(c.customerName);
    setCusContact(c.contactName);
    setCusPhone(c.phone);
    setCusIndustry(c.industry);
    setCusTrace(c.traceRequirement);
    setCusAddr(c.deliveryAddress);
    setErr(null);
    setMsg(null);
  };

  const handleCusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    try {
      if (editingCusCode) {
        await onUpdateCustomer(editingCusCode, {
          customerName: cusName,
          contactName: cusContact,
          phone: cusPhone,
          industry: cusIndustry,
          traceRequirement: cusTrace,
          deliveryAddress: cusAddr,
        });
        setMsg(`已更新客户 ${cusName}`);
      } else {
        await onAddCustomer({
          customerCode: cusCode,
          customerName: cusName,
          contactName: cusContact,
          phone: cusPhone,
          industry: cusIndustry,
          traceRequirement: cusTrace,
          deliveryAddress: cusAddr,
        });
        setMsg(`已新增客户 ${cusName}`);
      }
      resetCusForm();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '保存客户失败');
    }
  };

  const handleConfirmDeleteCus = async (code: string) => {
    setErr(null);
    setMsg(null);
    try {
      await onDeleteCustomer(code);
      if (editingCusCode === code) resetCusForm();
      setConfirmDeleteCusCode(null);
      setMsg(`已删除客户 ${code}`);
    } catch (e) {
      setConfirmDeleteCusCode(null);
      setErr(e instanceof Error ? e.message : '删除客户失败');
    }
  };

  return (
    <div className="space-y-4">
      <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => {
            setSubTab('suppliers');
            setErr(null);
            setMsg(null);
          }}
          className={`rounded-md px-3.5 py-1.5 text-xs whitespace-nowrap shrink-0 ${
            subTab === 'suppliers'
              ? 'bg-white font-semibold text-teal-800 shadow-sm border border-slate-200/80'
              : 'font-medium text-slate-600 hover:text-slate-900 border border-transparent'
          }`}
        >
          供应商管理 ({state.suppliers.length})
        </button>
        <button
          type="button"
          onClick={() => {
            setSubTab('customers');
            setErr(null);
            setMsg(null);
          }}
          className={`rounded-md px-3.5 py-1.5 text-xs whitespace-nowrap shrink-0 ${
            subTab === 'customers'
              ? 'bg-white font-semibold text-teal-800 shadow-sm border border-slate-200/80'
              : 'font-medium text-slate-600 hover:text-slate-900 border border-transparent'
          }`}
        >
          客户管理 ({state.customers.length})
        </button>
      </div>

      {subTab === 'suppliers' ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          {!readOnly && (
          <section className="rounded-lg border border-slate-200 bg-white p-5 xl:col-span-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-sm font-semibold text-slate-900">
                {editingSupCode ? `修改供应商 (${editingSupCode})` : '新增电子料供应商档案'}
              </h2>
              {editingSupCode && (
                <button
                  type="button"
                  onClick={resetSupForm}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-0.5 text-[11px] text-slate-600"
                >
                  <X className="h-3 w-3" />
                  取消
                </button>
              )}
            </div>
            <form onSubmit={handleSupSubmit} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="s-code" className="block text-xs font-medium text-slate-700">
                    供应商编码 <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="s-code"
                    type="text"
                    required
                    readOnly={Boolean(editingSupCode)}
                    value={supCode}
                    onChange={(e) => setSupCode(e.target.value)}
                    placeholder="SUP-MOUSER"
                    className={`mt-1 w-full rounded-md border px-2.5 py-1.5 font-mono text-xs ${
                      editingSupCode ? 'border-slate-200 bg-slate-100 text-slate-500' : 'border-slate-300'
                    }`}
                  />
                </div>
                <div>
                  <label htmlFor="s-grade" className="block text-xs font-medium text-slate-700">
                    IQC 检验等级
                  </label>
                  <select
                    id="s-grade"
                    value={supGrade}
                    onChange={(e) => setSupGrade(e.target.value as Supplier['qualityGrade'])}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                  >
                    <option value="A级免检">A级免检</option>
                    <option value="B级抽检">B级抽检</option>
                    <option value="C级加严">C级加严</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="s-name" className="block text-xs font-medium text-slate-700">
                  供应商名称 <span className="text-red-600">*</span>
                </label>
                <input
                  id="s-name"
                  type="text"
                  required
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  placeholder="如 贸泽电子(Mouser)"
                  className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="s-contact" className="block text-xs font-medium text-slate-700">
                    商务联系人
                  </label>
                  <input
                    id="s-contact"
                    type="text"
                    value={supContact}
                    onChange={(e) => setSupContact(e.target.value)}
                    placeholder="张经理"
                    className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="s-phone" className="block text-xs font-medium text-slate-700">
                    联系电话
                  </label>
                  <input
                    id="s-phone"
                    type="text"
                    value={supPhone}
                    onChange={(e) => setSupPhone(e.target.value)}
                    placeholder="0755-8820-0000"
                    className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <div className="col-span-2">
                  <label htmlFor="s-tags" className="block text-xs font-medium text-slate-700">
                    主供物料类别
                  </label>
                  <input
                    id="s-tags"
                    type="text"
                    value={supTags}
                    onChange={(e) => setSupTags(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="s-lead" className="block text-xs font-medium text-slate-700">
                    交期(天)
                  </label>
                  <input
                    id="s-lead"
                    type="number"
                    min={1}
                    value={supLead}
                    onChange={(e) => setSupLead(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-xs"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="s-notes" className="block text-xs font-medium text-slate-700">
                  备注 / 供货条款
                </label>
                <input
                  id="s-notes"
                  type="text"
                  value={supNotes}
                  onChange={(e) => setSupNotes(e.target.value)}
                  placeholder="支持IPC-1782条码"
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
                {editingSupCode ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                {editingSupCode ? '保存供应商修改' : '保存供应商档案'}
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
                合格供应商名录 (AVL · {state.suppliers.length} 家)
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5 font-medium whitespace-nowrap">编码 / 供应商名称</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">主供类别</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">IQC等级</th>
                    <th className="px-3 py-2.5 font-medium text-right whitespace-nowrap">交期</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">联系人 / 电话</th>
                    {!readOnly && (
                      <th className="px-4 py-2.5 font-medium text-right whitespace-nowrap">操作</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.suppliers.map((s) => {
                    const isConfirming = confirmDeleteSupCode === s.supplierCode;
                    return (
                      <tr
                        key={s.supplierCode}
                        className={`hover:bg-slate-50 ${
                          editingSupCode === s.supplierCode ? 'bg-teal-50/40' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{s.supplierName}</div>
                          <div className="font-mono text-[11px] text-slate-500">{s.supplierCode}</div>
                        </td>
                        <td className="px-3 py-3 text-slate-700">
                          <div>{s.categoryTags}</div>
                          {s.notes && <div className="text-[11px] text-slate-400">{s.notes}</div>}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span
                            className={`font-medium ${
                              s.qualityGrade === 'A级免检'
                                ? 'text-emerald-700'
                                : s.qualityGrade === 'C级加严'
                                  ? 'text-red-700'
                                  : 'text-amber-700'
                            }`}
                          >
                            {s.qualityGrade}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums whitespace-nowrap">
                          {s.leadTimeDays} 天
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="text-slate-800">{s.contactName}</div>
                          <div className="font-mono text-[11px] text-slate-500">{s.phone}</div>
                        </td>
                        {!readOnly && (
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {isConfirming ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleConfirmDeleteSup(s.supplierCode)}
                                className="rounded bg-red-600 px-2 py-0.5 text-[11px] font-medium text-white"
                              >
                                确认?
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteSupCode(null)}
                                className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-600"
                              >
                                取消
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-2.5">
                              <button
                                type="button"
                                onClick={() => startEditSup(s)}
                                className="font-medium text-teal-700 hover:text-teal-900"
                              >
                                编辑
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteSupCode(s.supplierCode)}
                                aria-label={`删除供应商 ${s.supplierCode}`}
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
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          {!readOnly && (
          <section className="rounded-lg border border-slate-200 bg-white p-5 xl:col-span-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-sm font-semibold text-slate-900">
                {editingCusCode ? `修改客户 (${editingCusCode})` : '新增客户档案 (PCBA交付方)'}
              </h2>
              {editingCusCode && (
                <button
                  type="button"
                  onClick={resetCusForm}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-0.5 text-[11px] text-slate-600"
                >
                  <X className="h-3 w-3" />
                  取消
                </button>
              )}
            </div>
            <form onSubmit={handleCusSubmit} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="c-code" className="block text-xs font-medium text-slate-700">
                    客户编码 <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="c-code"
                    type="text"
                    required
                    readOnly={Boolean(editingCusCode)}
                    value={cusCode}
                    onChange={(e) => setCusCode(e.target.value)}
                    placeholder="CUS-BYD"
                    className={`mt-1 w-full rounded-md border px-2.5 py-1.5 font-mono text-xs ${
                      editingCusCode ? 'border-slate-200 bg-slate-100 text-slate-500' : 'border-slate-300'
                    }`}
                  />
                </div>
                <div>
                  <label htmlFor="c-ind" className="block text-xs font-medium text-slate-700">
                    行业领域
                  </label>
                  <input
                    id="c-ind"
                    type="text"
                    value={cusIndustry}
                    onChange={(e) => setCusIndustry(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="c-name" className="block text-xs font-medium text-slate-700">
                  客户名称 <span className="text-red-600">*</span>
                </label>
                <input
                  id="c-name"
                  type="text"
                  required
                  value={cusName}
                  onChange={(e) => setCusName(e.target.value)}
                  placeholder="如 比亚迪汽车电子"
                  className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="c-contact" className="block text-xs font-medium text-slate-700">
                    客户对接人
                  </label>
                  <input
                    id="c-contact"
                    type="text"
                    value={cusContact}
                    onChange={(e) => setCusContact(e.target.value)}
                    placeholder="陈工 (SQE)"
                    className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="c-phone" className="block text-xs font-medium text-slate-700">
                    联系电话
                  </label>
                  <input
                    id="c-phone"
                    type="text"
                    value={cusPhone}
                    onChange={(e) => setCusPhone(e.target.value)}
                    placeholder="0755-8988-0000"
                    className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-xs"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="c-trace" className="block text-xs font-medium text-slate-700">
                  品质与追溯要求
                </label>
                <input
                  id="c-trace"
                  type="text"
                  value={cusTrace}
                  onChange={(e) => setCusTrace(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
                />
              </div>
              <div>
                <label htmlFor="c-addr" className="block text-xs font-medium text-slate-700">
                  交付工厂地址
                </label>
                <input
                  id="c-addr"
                  type="text"
                  value={cusAddr}
                  onChange={(e) => setCusAddr(e.target.value)}
                  placeholder="深圳市..."
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
                {editingCusCode ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                {editingCusCode ? '保存客户修改' : '保存客户档案'}
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
                客户主数据名录 ({state.customers.length} 家)
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5 font-medium whitespace-nowrap">编码 / 客户名称</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">行业领域</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">追溯与质控要求</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">联系人 / 地址</th>
                    {!readOnly && (
                      <th className="px-4 py-2.5 font-medium text-right whitespace-nowrap">操作</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.customers.map((c) => {
                    const isConfirming = confirmDeleteCusCode === c.customerCode;
                    return (
                      <tr
                        key={c.customerCode}
                        className={`hover:bg-slate-50 ${
                          editingCusCode === c.customerCode ? 'bg-teal-50/40' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{c.customerName}</div>
                          <div className="font-mono text-[11px] text-slate-500">{c.customerCode}</div>
                        </td>
                        <td className="px-3 py-3 text-slate-700">{c.industry}</td>
                        <td className="px-3 py-3 text-slate-700">{c.traceRequirement}</td>
                        <td className="px-3 py-3">
                          <div className="text-slate-800">
                            {c.contactName} · <span className="font-mono">{c.phone}</span>
                          </div>
                          <div className="text-[11px] text-slate-500">{c.deliveryAddress}</div>
                        </td>
                        {!readOnly && (
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {isConfirming ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleConfirmDeleteCus(c.customerCode)}
                                className="rounded bg-red-600 px-2 py-0.5 text-[11px] font-medium text-white"
                              >
                                确认?
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteCusCode(null)}
                                className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-600"
                              >
                                取消
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-2.5">
                              <button
                                type="button"
                                onClick={() => startEditCus(c)}
                                className="font-medium text-teal-700 hover:text-teal-900"
                              >
                                编辑
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteCusCode(c.customerCode)}
                                aria-label={`删除客户 ${c.customerCode}`}
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
