import { Pencil, Plus, ScanBarcode, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import type { BarcodeRule, LabelTemplate, WmsState } from '../types/wms';
import { parseBarcodeString } from '../utils/wmsLogic';
import { ZplLabelDesigner } from './ZplLabelDesigner';

interface BarcodeTemplatePanelProps {
  state: WmsState;
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
}

export function BarcodeTemplatePanel({
  state,
  onSaveBarcodeRule,
  onDeleteBarcodeRule,
  onSaveLabelTemplate,
  onDeleteLabelTemplate,
}: BarcodeTemplatePanelProps) {
  // Barcode Rule form
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [confirmDeleteRuleId, setConfirmDeleteRuleId] = useState<string | null>(null);
  const [ruleName, setRuleName] = useState('');
  const [supplierCode, setSupplierCode] = useState(state.suppliers[0]?.supplierCode ?? 'ALL');
  const [formatType, setFormatType] = useState<'KEY_VALUE' | 'DELIMITED_ORDER'>('DELIMITED_ORDER');
  const [delimiter, setDelimiter] = useState<'|' | ';' | ','>(';');
  const [mpnKey, setMpnKey] = useState('0');
  const [lotKey, setLotKey] = useState('1');
  const [dateCodeKey, setDateCodeKey] = useState('2');
  const [qtyKey, setQtyKey] = useState('3');
  const [reelIdKey, setReelIdKey] = useState('4');
  const [sampleBarcode, setSampleBarcode] = useState(
    'STM32F407VET6;ST2646A9;2646;1000;RL-TEST-01'
  );
  const [ruleEnabled, setRuleEnabled] = useState(true);
  const [ruleMsg, setRuleMsg] = useState<string | null>(null);
  const [ruleErr, setRuleErr] = useState<string | null>(null);

  // Live barcode parser tester
  const [testSupplier, setTestSupplier] = useState('ALL');
  const [testInput, setTestInput] = useState(
    state.barcodeRules[1]?.sampleBarcode ??
      'STM32F407VET6;ST2646A9;2646;1000;RL-ARROW-088'
  );

  const resetRuleForm = () => {
    setEditingRuleId(null);
    setRuleName('');
    setSupplierCode(state.suppliers[0]?.supplierCode ?? 'ALL');
    setFormatType('DELIMITED_ORDER');
    setDelimiter(';');
    setMpnKey('0');
    setLotKey('1');
    setDateCodeKey('2');
    setQtyKey('3');
    setReelIdKey('4');
    setSampleBarcode('STM32F407VET6;ST2646A9;2646;1000;RL-TEST-01');
    setRuleEnabled(true);
  };

  const startEditRule = (rule: BarcodeRule) => {
    setEditingRuleId(rule.ruleId);
    setRuleName(rule.ruleName);
    setSupplierCode(rule.supplierCode);
    setFormatType(rule.formatType);
    setDelimiter(rule.delimiter);
    setMpnKey(rule.fieldMap.mpnKey ?? '');
    setLotKey(rule.fieldMap.lotKey ?? '');
    setDateCodeKey(rule.fieldMap.dateCodeKey ?? '');
    setQtyKey(rule.fieldMap.qtyKey ?? '');
    setReelIdKey(rule.fieldMap.reelIdKey ?? '');
    setSampleBarcode(rule.sampleBarcode);
    setRuleEnabled(rule.enabled);
    setRuleErr(null);
    setRuleMsg(null);
  };

  const handleRuleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRuleErr(null);
    setRuleMsg(null);
    try {
      await onSaveBarcodeRule({
        ruleId: editingRuleId ?? undefined,
        ruleName,
        supplierCode,
        formatType,
        delimiter,
        fieldMap: {
          mpnKey,
          lotKey,
          dateCodeKey,
          qtyKey,
          reelIdKey,
        },
        sampleBarcode,
        enabled: ruleEnabled,
      });
      setRuleMsg(
        editingRuleId ? `已更新条码规则：${ruleName}` : `已保存条码解析规则：${ruleName}`
      );
      resetRuleForm();
    } catch (err) {
      setRuleErr(err instanceof Error ? err.message : '保存条码规则失败');
    }
  };

  const handleToggleRuleEnabled = async (rule: BarcodeRule) => {
    setRuleErr(null);
    setRuleMsg(null);
    try {
      await onSaveBarcodeRule({
        ...rule,
        enabled: !rule.enabled,
      });
      setRuleMsg(`规则「${rule.ruleName}」已${rule.enabled ? '停用' : '启用'}`);
    } catch (err) {
      setRuleErr(err instanceof Error ? err.message : '切换规则状态失败');
    }
  };

  const handleConfirmDeleteRule = async (rule: BarcodeRule) => {
    setRuleErr(null);
    setRuleMsg(null);
    try {
      await onDeleteBarcodeRule(rule.ruleId);
      if (editingRuleId === rule.ruleId) resetRuleForm();
      setConfirmDeleteRuleId(null);
      setRuleMsg(`已删除条码规则：${rule.ruleName}`);
    } catch (err) {
      setConfirmDeleteRuleId(null);
      setRuleErr(err instanceof Error ? err.message : '删除条码规则失败');
    }
  };

  const parsedPreview = parseBarcodeString(
    testInput,
    state.barcodeRules,
    testSupplier === 'ALL' ? undefined : testSupplier
  );

  return (
    <div className="space-y-6">
      {/* Section 1: Supplier Barcode Rules */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <section className="rounded-lg border border-slate-200 bg-white p-5 xl:col-span-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                {editingRuleId ? `修改条码规则 (${editingRuleId})` : '新建供应商条码解析规则'}
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-500">
                适配原厂键值复合码 (如 PN:/LN:/QTY:) 或定序分隔符码 (如 MPN;LOT;DC;QTY)
              </p>
            </div>
            {editingRuleId && (
              <button
                type="button"
                onClick={resetRuleForm}
                className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
              >
                <X className="h-3 w-3" />
                取消
              </button>
            )}
          </div>

          <form onSubmit={handleRuleSubmit} className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="br-name" className="block text-xs font-medium text-slate-700">
                  规则名称 <span className="text-red-600">*</span>
                </label>
                <input
                  id="br-name"
                  type="text"
                  required
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="文晔(WT) 竖线四段码"
                  className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
                />
              </div>
              <div>
                <label htmlFor="br-sup" className="block text-xs font-medium text-slate-700">
                  绑定供应商
                </label>
                <select
                  id="br-sup"
                  value={supplierCode}
                  onChange={(e) => setSupplierCode(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  <option value="ALL">全部供应商 (通用兜底)</option>
                  {state.suppliers.map((s) => (
                    <option key={s.supplierCode} value={s.supplierCode}>
                      {s.supplierName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="br-fmt" className="block text-xs font-medium text-slate-700">
                  编码解析模式
                </label>
                <select
                  id="br-fmt"
                  value={formatType}
                  onChange={(e) => {
                    const nextFmt = e.target.value as typeof formatType;
                    setFormatType(nextFmt);
                    if (nextFmt === 'KEY_VALUE') {
                      setMpnKey('P,PN');
                      setLotKey('L,LOT');
                      setDateCodeKey('D,DC');
                      setQtyKey('Q,QTY');
                      setReelIdKey('UID,ID');
                    } else {
                      setMpnKey('0');
                      setLotKey('1');
                      setDateCodeKey('2');
                      setQtyKey('3');
                      setReelIdKey('4');
                    }
                  }}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  <option value="DELIMITED_ORDER">定序分隔分段 (按段位0/1/2/3)</option>
                  <option value="KEY_VALUE">前缀键值匹配 (如 PN: / LN:)</option>
                </select>
              </div>
              <div>
                <label htmlFor="br-delim" className="block text-xs font-medium text-slate-700">
                  字段分隔符
                </label>
                <select
                  id="br-delim"
                  value={delimiter}
                  onChange={(e) => setDelimiter(e.target.value as typeof delimiter)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs"
                >
                  <option value=";">分号 (;)</option>
                  <option value="|">竖线 (|)</option>
                  <option value=",">逗号 (,)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-2">
              <div>
                <label className="block text-[10px] text-slate-500">MPN</label>
                <input
                  type="text"
                  value={mpnKey}
                  onChange={(e) => setMpnKey(e.target.value)}
                  className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500">Lot批次</label>
                <input
                  type="text"
                  value={lotKey}
                  onChange={(e) => setLotKey(e.target.value)}
                  className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500">DateCode</label>
                <input
                  type="text"
                  value={dateCodeKey}
                  onChange={(e) => setDateCodeKey(e.target.value)}
                  className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500">数量Qty</label>
                <input
                  type="text"
                  value={qtyKey}
                  onChange={(e) => setQtyKey(e.target.value)}
                  className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500">UID序号</label>
                <input
                  type="text"
                  value={reelIdKey}
                  onChange={(e) => setReelIdKey(e.target.value)}
                  className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 font-mono text-xs"
                />
              </div>
            </div>

            <div>
              <label htmlFor="br-sample" className="block text-xs font-medium text-slate-700">
                供应商样例条码
              </label>
              <input
                id="br-sample"
                type="text"
                value={sampleBarcode}
                onChange={(e) => setSampleBarcode(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-xs"
              />
            </div>

            {ruleErr && (
              <div role="alert" className="rounded border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
                {ruleErr}
              </div>
            )}
            {ruleMsg && (
              <div className="rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-800">
                {ruleMsg}
              </div>
            )}

            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-1 rounded-md bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800 whitespace-nowrap"
            >
              {editingRuleId ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {editingRuleId ? '保存条码规则修改' : '保存供应商条码规则'}
            </button>
          </form>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white xl:col-span-7">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">
              已配置供应商条码解析规则 ({state.barcodeRules.length} 条) & 在线解码测试
            </h2>
          </div>

          <div className="border-b border-slate-200 bg-slate-50 p-4 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <ScanBarcode className="h-4 w-4 text-teal-700" />
                实时条码规则解析测试台
              </div>
              <select
                aria-label="测试模拟供应商"
                value={testSupplier}
                onChange={(e) => setTestSupplier(e.target.value)}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
              >
                <option value="ALL">自动匹配全部规则</option>
                {state.suppliers.map((s) => (
                  <option key={s.supplierCode} value={s.supplierCode}>
                    模拟：{s.supplierName}
                  </option>
                ))}
              </select>
            </div>
            <input
              type="text"
              aria-label="测试条码字符串"
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              className="w-full rounded border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs text-slate-900"
            />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 rounded border border-slate-200 bg-white p-2.5 font-mono text-[11px]">
              <div>
                <span className="text-slate-400">命中规则: </span>
                <span className="font-semibold text-teal-700">
                  {parsedPreview.matchedRuleName || 'IPC-1782默认'}
                </span>
              </div>
              <div>
                <span className="text-slate-400">MPN: </span>
                <span className="font-semibold text-slate-900">{parsedPreview.mpn || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400">Lot: </span>
                <span className="font-semibold text-slate-900">
                  {parsedPreview.lotNumber || '-'}
                </span>
              </div>
              <div>
                <span className="text-slate-400">D/C: </span>
                <span className="font-semibold text-slate-900">
                  {parsedPreview.dateCode || '-'}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Qty: </span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  {parsedPreview.qty?.toLocaleString() || '-'}
                </span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium whitespace-nowrap">规则名称 / 供应商</th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">模式 / 状态</th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">样例串</th>
                  <th className="px-4 py-2 font-medium text-right whitespace-nowrap">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.barcodeRules.map((rule) => {
                  const isConfirming = confirmDeleteRuleId === rule.ruleId;
                  return (
                    <tr
                      key={rule.ruleId}
                      className={`hover:bg-slate-50 ${
                        editingRuleId === rule.ruleId ? 'bg-teal-50/40' : ''
                      }`}
                    >
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-slate-900">{rule.ruleName}</div>
                        <div className="font-mono text-[11px] text-slate-500">
                          {rule.ruleId} · {rule.supplierName}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="font-mono text-slate-700">
                          {rule.formatType === 'DELIMITED_ORDER' ? '定序分段' : '前缀键值'} (
                          {rule.delimiter})
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleRuleEnabled(rule)}
                          className={`text-[11px] font-medium ${
                            rule.enabled ? 'text-emerald-700' : 'text-slate-400'
                          }`}
                        >
                          {rule.enabled ? '● 启用中 (点击停用)' : '○ 已停用 (点击启用)'}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500 max-w-[180px] truncate">
                        {rule.sampleBarcode}
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        {isConfirming ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleConfirmDeleteRule(rule)}
                              className="rounded bg-red-600 px-2 py-0.5 text-[11px] font-medium text-white"
                            >
                              确认?
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteRuleId(null)}
                              className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-600"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => {
                                setTestSupplier(rule.supplierCode);
                                setTestInput(rule.sampleBarcode);
                              }}
                              className="font-medium text-slate-600 hover:text-teal-700"
                            >
                              测试
                            </button>
                            <button
                              type="button"
                              onClick={() => startEditRule(rule)}
                              className="font-medium text-teal-700 hover:text-teal-900"
                            >
                              编辑
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteRuleId(rule.ruleId)}
                              aria-label={`删除规则 ${rule.ruleId}`}
                              className="text-slate-400 hover:text-red-600"
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

      {/* Section 2: ZPL Label Designer & Live Preview */}
      <ZplLabelDesigner
        state={state}
        onSaveLabelTemplate={onSaveLabelTemplate}
        onDeleteLabelTemplate={onDeleteLabelTemplate}
      />
    </div>
  );
}
