import { Plus } from 'lucide-react';
import { useState } from 'react';
import type { Customer, Supplier, WmsState } from '../types/wms';

interface PartnerMasterPanelProps {
  state: WmsState;
  onAddSupplier: (payload: Supplier) => Promise<void>;
  onAddCustomer: (payload: Customer) => Promise<void>;
}

export function PartnerMasterPanel({
  state,
  onAddSupplier,
  onAddCustomer,
}: PartnerMasterPanelProps) {
  const [subTab, setSubTab] = useState<'suppliers' | 'customers'>('suppliers');

  // Supplier form
  const [supCode, setSupCode] = useState('');
  const [supName, setSupName] = useState('');
  const [supContact, setSupContact] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supTags, setSupTags] = useState('IC芯片 / 阻容感');
  const [supGrade, setSupGrade] = useState<Supplier['qualityGrade']>('B级抽检');
  const [supLead, setSupLead] = useState('7');
  const [supNotes, setSupNotes] = useState('');

  // Customer form
  const [cusCode, setCusCode] = useState('');
  const [cusName, setCusName] = useState('');
  const [cusContact, setCusContact] = useState('');
  const [cusPhone, setCusPhone] = useState('');
  const [cusIndustry, setCusIndustry] = useState('工业控制PCBA');
  const [cusTrace, setCusTrace] = useState('需IPC-1782全程UID+DateCode追溯');
  const [cusAddr, setCusAddr] = useState('');

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const handleSupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    try {
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
      setSupCode('');
      setSupName('');
      setSupContact('');
      setSupPhone('');
      setSupNotes('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : '新增供应商失败');
    }
  };

  const handleCusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    try {
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
      setCusCode('');
      setCusName('');
      setCusContact('');
      setCusPhone('');
      setCusAddr('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : '新增客户失败');
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
              ? 'bg-white font-semibold text-sky-800 shadow-sm border border-slate-200/80'
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
              ? 'bg-white font-semibold text-sky-800 shadow-sm border border-slate-200/80'
              : 'font-medium text-slate-600 hover:text-slate-900 border border-transparent'
          }`}
        >
          客户管理 ({state.customers.length})
        </button>
      </div>

      {subTab === 'suppliers' ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <section className="rounded-lg border border-slate-200 bg-white p-5 xl:col-span-4">
            <h2 className="border-b border-slate-200 pb-3 text-sm font-semibold text-slate-900">
              新增电子料供应商档案
            </h2>
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
                    value={supCode}
                    onChange={(e) => setSupCode(e.target.value)}
                    placeholder="SUP-MOUSER"
                    className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-xs"
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
                保存供应商档案
              </button>
            </form>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white xl:col-span-8">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-900">
                合格供应商名录 (AVL · {state.suppliers.length} 家)
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-5 py-2.5 font-medium whitespace-nowrap">编码 / 供应商名称</th>
                    <th className="px-4 py-2.5 font-medium whitespace-nowrap">主供类别</th>
                    <th className="px-4 py-2.5 font-medium whitespace-nowrap">IQC等级</th>
                    <th className="px-4 py-2.5 font-medium text-right whitespace-nowrap">交期</th>
                    <th className="px-5 py-2.5 font-medium whitespace-nowrap">联系人 / 电话</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.suppliers.map((s) => (
                    <tr key={s.supplierCode} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <div className="font-semibold text-slate-900">{s.supplierName}</div>
                        <div className="font-mono text-[11px] text-slate-500">{s.supplierCode}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <div>{s.categoryTags}</div>
                        {s.notes && <div className="text-[11px] text-slate-400">{s.notes}</div>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
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
                      <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap">
                        {s.leadTimeDays} 天
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <div className="text-slate-800">{s.contactName}</div>
                        <div className="font-mono text-[11px] text-slate-500">{s.phone}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <section className="rounded-lg border border-slate-200 bg-white p-5 xl:col-span-4">
            <h2 className="border-b border-slate-200 pb-3 text-sm font-semibold text-slate-900">
              新增客户档案 (PCBA交付方)
            </h2>
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
                    value={cusCode}
                    onChange={(e) => setCusCode(e.target.value)}
                    placeholder="CUS-BYD"
                    className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-xs"
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
                保存客户档案
              </button>
            </form>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white xl:col-span-8">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-900">
                客户主数据名录 ({state.customers.length} 家)
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-5 py-2.5 font-medium whitespace-nowrap">编码 / 客户名称</th>
                    <th className="px-4 py-2.5 font-medium whitespace-nowrap">行业领域</th>
                    <th className="px-4 py-2.5 font-medium whitespace-nowrap">追溯与质控要求</th>
                    <th className="px-5 py-2.5 font-medium whitespace-nowrap">联系人 / 地址</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.customers.map((c) => (
                    <tr key={c.customerCode} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <div className="font-semibold text-slate-900">{c.customerName}</div>
                        <div className="font-mono text-[11px] text-slate-500">{c.customerCode}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{c.industry}</td>
                      <td className="px-4 py-3 text-slate-700">{c.traceRequirement}</td>
                      <td className="px-5 py-3">
                        <div className="text-slate-800">
                          {c.contactName} · <span className="font-mono">{c.phone}</span>
                        </div>
                        <div className="text-[11px] text-slate-500">{c.deliveryAddress}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
