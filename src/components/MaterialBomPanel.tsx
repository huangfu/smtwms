import { Plus } from 'lucide-react';
import { useState } from 'react';
import type { BomItem, MaterialCategory, MaterialSku, MsdLevel, WmsState } from '../types/wms';
import { formatTime } from '../utils/formatters';

interface MaterialBomPanelProps {
  state: WmsState;
  onAddMaterial: (mat: MaterialSku) => Promise<void>;
  onSaveBom: (payload: {
    bomId?: string;
    productCode: string;
    productName: string;
    version: string;
    customerCode?: string;
    processType: string;
    items: BomItem[];
  }) => Promise<void>;
}

export function MaterialBomPanel({
  state,
  onAddMaterial,
  onSaveBom,
}: MaterialBomPanelProps) {
  const [subTab, setSubTab] = useState<'boms' | 'materials'>('boms');

  // BOM Master form
  const [productCode, setProductCode] = useState('');
  const [productName, setProductName] = useState('');
  const [version, setVersion] = useState('V1.0');
  const [customerCode, setCustomerCode] = useState(state.customers[0]?.customerCode ?? '');
  const [processType, setProcessType] = useState('双面SMT + 回流焊 + AOI');
  const [bomSku, setBomSku] = useState(state.materials[0]?.skuCode ?? '');
  const [bomQty, setBomQty] = useState('1');
  const [bomAttr, setBomAttr] = useState('0.02');
  const [bomDesig, setBomDesig] = useState('U1');
  const [bomItems, setBomItems] = useState<BomItem[]>([
    { skuCode: 'MAT-PCB-001', qtyPerBoard: 1, attritionRate: 0.01, designators: 'PCB1' },
    { skuCode: 'MAT-IC-001', qtyPerBoard: 1, attritionRate: 0.01, designators: 'U1' },
  ]);
  const [bomMsg, setBomMsg] = useState<string | null>(null);
  const [bomErr, setBomErr] = useState<string | null>(null);

  // Material SKU form
  const [skuCode, setSkuCode] = useState('');
  const [mpn, setMpn] = useState('');
  const [matName, setMatName] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [category, setCategory] = useState<MaterialCategory>('IC芯片');
  const [packageType, setPackageType] = useState('QFN-32');
  const [msdLevel, setMsdLevel] = useState<MsdLevel>('Level 3');
  const [safetyStock, setSafetyStock] = useState('500');
  const [defaultBin, setDefaultBin] = useState('MSD-01-01');
  const [matMsg, setMatMsg] = useState<string | null>(null);
  const [matErr, setMatErr] = useState<string | null>(null);

  const handleAddBomItem = () => {
    if (!bomSku) return;
    setBomItems((prev) => {
      if (prev.some((i) => i.skuCode === bomSku)) return prev;
      return [
        ...prev,
        {
          skuCode: bomSku,
          qtyPerBoard: Math.max(1, Number(bomQty) || 1),
          attritionRate: Math.max(0, Number(bomAttr) || 0.02),
          designators: bomDesig.trim() || 'SMT',
        },
      ];
    });
  };

  const handleSaveBomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBomErr(null);
    setBomMsg(null);
    try {
      await onSaveBom({
        productCode,
        productName,
        version,
        customerCode: customerCode || undefined,
        processType,
        items: bomItems,
      });
      setBomMsg(`已保存物料清单 BOM (${productCode.toUpperCase()} ${version})`);
      setProductCode('');
      setProductName('');
    } catch (e) {
      setBomErr(e instanceof Error ? e.message : '保存BOM失败');
    }
  };

  const handleAddMaterialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMatErr(null);
    setMatMsg(null);
    try {
      await onAddMaterial({
        skuCode,
        mpn,
        name: matName,
        manufacturer: manufacturer || '原厂直供',
        category,
        packageType,
        unit: 'PCS',
        msdLevel,
        safetyStock: Number(safetyStock) || 0,
        defaultBin,
      });
      setMatMsg(`已新增物料 ${mpn} (${skuCode})`);
      setSkuCode('');
      setMpn('');
      setMatName('');
    } catch (e) {
      setMatErr(e instanceof Error ? e.message : '添加失败');
    }
  };

  return (
    <div className="space-y-4">
      <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setSubTab('boms')}
          className={`rounded-md px-3.5 py-1.5 text-xs whitespace-nowrap shrink-0 ${
            subTab === 'boms'
              ? 'bg-white font-semibold text-sky-800 shadow-sm border border-slate-200/80'
              : 'font-medium text-slate-600 hover:text-slate-900 border border-transparent'
          }`}
        >
          物料清单 BOM 管理 ({state.boms.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('materials')}
          className={`rounded-md px-3.5 py-1.5 text-xs whitespace-nowrap shrink-0 ${
            subTab === 'materials'
              ? 'bg-white font-semibold text-sky-800 shadow-sm border border-slate-200/80'
              : 'font-medium text-slate-600 hover:text-slate-900 border border-transparent'
          }`}
        >
          电子料 SKU 主数据 ({state.materials.length})
        </button>
      </div>

      {subTab === 'boms' ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <section className="rounded-lg border border-slate-200 bg-white p-5 xl:col-span-5">
            <h2 className="border-b border-slate-200 pb-3 text-sm font-semibold text-slate-900">
              新建 / 维护 PCBA 物料清单 (BOM)
            </h2>
            <form onSubmit={handleSaveBomSubmit} className="mt-4 space-y-3">
              <div className="grid grid-cols-3 gap-2.5">
                <div className="col-span-2">
                  <label htmlFor="bom-pcode" className="block text-xs font-medium text-slate-700">
                    成品编码 <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="bom-pcode"
                    type="text"
                    required
                    value={productCode}
                    onChange={(e) => setProductCode(e.target.value)}
                    placeholder="PCBA-BMS-01"
                    className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="bom-ver" className="block text-xs font-medium text-slate-700">
                    版本号
                  </label>
                  <input
                    id="bom-ver"
                    type="text"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-xs"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="bom-pname" className="block text-xs font-medium text-slate-700">
                  PCBA 产品名称 <span className="text-red-600">*</span>
                </label>
                <input
                  id="bom-pname"
                  type="text"
                  required
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="储能BMS主控采集板"
                  className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="bom-cus" className="block text-xs font-medium text-slate-700">
                    关联客户
                  </label>
                  <select
                    id="bom-cus"
                    value={customerCode}
                    onChange={(e) => setCustomerCode(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                  >
                    <option value="">通用自研产品</option>
                    {state.customers.map((c) => (
                      <option key={c.customerCode} value={c.customerCode}>
                        {c.customerName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="bom-proc" className="block text-xs font-medium text-slate-700">
                    SMT 工艺路线
                  </label>
                  <input
                    id="bom-proc"
                    type="text"
                    value={processType}
                    onChange={(e) => setProcessType(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
                  />
                </div>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2">
                <div className="text-xs font-medium text-slate-700">BOM 子件物料行配置</div>
                <select
                  aria-label="选择子件物料"
                  value={bomSku}
                  onChange={(e) => setBomSku(e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                >
                  {state.materials.map((m) => (
                    <option key={m.skuCode} value={m.skuCode}>
                      {m.mpn} ({m.skuCode}) — {m.name}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-3">
                    <label className="block text-[10px] text-slate-500">单板用量</label>
                    <input
                      type="number"
                      min={1}
                      aria-label="单板用量"
                      value={bomQty}
                      onChange={(e) => setBomQty(e.target.value)}
                      className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-[10px] text-slate-500">损耗率</label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      max={0.5}
                      aria-label="损耗率"
                      value={bomAttr}
                      onChange={(e) => setBomAttr(e.target.value)}
                      className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-[10px] text-slate-500">贴片位号</label>
                    <input
                      type="text"
                      aria-label="贴片位号"
                      value={bomDesig}
                      onChange={(e) => setBomDesig(e.target.value)}
                      placeholder="U1"
                      className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs"
                    />
                  </div>
                  <div className="col-span-3 pt-3.5">
                    <button
                      type="button"
                      onClick={handleAddBomItem}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                    >
                      加入BOM行
                    </button>
                  </div>
                </div>

                <ul className="space-y-1 pt-1">
                  {bomItems.map((item) => (
                    <li
                      key={item.skuCode}
                      className="flex items-center justify-between rounded border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs"
                    >
                      <span>
                        {item.skuCode} × {item.qtyPerBoard}/板 · 损耗{' '}
                        {Math.round(item.attritionRate * 100)}% · 位号 {item.designators}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setBomItems((prev) => prev.filter((b) => b.skuCode !== item.skuCode))
                        }
                        className="text-red-600 hover:underline"
                      >
                        移除
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {bomErr && (
                <div className="rounded border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
                  {bomErr}
                </div>
              )}
              {bomMsg && (
                <div className="rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-800">
                  {bomMsg}
                </div>
              )}

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-1 rounded-md bg-sky-700 px-4 py-2 text-xs font-medium text-white hover:bg-sky-800"
              >
                <Plus className="h-3.5 w-3.5" />
                保存 BOM 清单模板
              </button>
            </form>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white xl:col-span-7">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-900">
                标准 BOM 物料清单库 ({state.boms.length} 套)
              </h2>
            </div>
            <div className="divide-y divide-slate-200">
              {state.boms.map((bom) => (
                <div key={bom.bomId} className="p-5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-mono text-sm font-bold text-slate-900">
                        {bom.productCode}
                      </span>
                      <span className="mx-2 text-slate-300">·</span>
                      <span className="font-semibold text-slate-800">{bom.productName}</span>
                      <span className="ml-2 font-mono text-sky-700">{bom.version}</span>
                    </div>
                    <span className="font-mono text-[11px] text-slate-500">
                      {bom.bomId} · 更新 {formatTime(bom.updatedAt)}
                    </span>
                  </div>
                  <div className="mt-1 text-slate-500">
                    客户 {bom.customerName || '通用产品'} · 工艺 {bom.processType} · 子件{' '}
                    {bom.items.length} 项
                  </div>
                  <div className="mt-3 overflow-x-auto rounded border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                        <tr>
                          <th className="px-3 py-1.5 font-medium whitespace-nowrap">SKU / MPN</th>
                          <th className="px-3 py-1.5 font-medium whitespace-nowrap">位号</th>
                          <th className="px-3 py-1.5 font-medium text-right whitespace-nowrap">单板用量</th>
                          <th className="px-3 py-1.5 font-medium text-right whitespace-nowrap">抛料损耗</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {bom.items.map((item) => {
                          const mat = state.materials.find((m) => m.skuCode === item.skuCode);
                          return (
                            <tr key={item.skuCode}>
                              <td className="px-3 py-1.5 font-mono text-slate-900">
                                {mat?.mpn ?? item.skuCode}{' '}
                                <span className="text-slate-400">({item.skuCode})</span>
                              </td>
                              <td className="px-3 py-1.5 font-mono text-slate-600">
                                {item.designators}
                              </td>
                              <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                                {item.qtyPerBoard}
                              </td>
                              <td className="px-3 py-1.5 text-right font-mono tabular-nums text-slate-600">
                                {Math.round(item.attritionRate * 100)}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <section className="rounded-lg border border-slate-200 bg-white p-5 xl:col-span-4">
            <h2 className="border-b border-slate-200 pb-3 text-sm font-semibold text-slate-900">
              新增电子物料 SKU
            </h2>
            <form onSubmit={handleAddMaterialSubmit} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="m-sku" className="block text-xs font-medium text-slate-700">
                    内部料号 SKU
                  </label>
                  <input
                    id="m-sku"
                    type="text"
                    required
                    value={skuCode}
                    onChange={(e) => setSkuCode(e.target.value)}
                    placeholder="MAT-IC-009"
                    className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="m-mpn" className="block text-xs font-medium text-slate-700">
                    原厂型号 MPN
                  </label>
                  <input
                    id="m-mpn"
                    type="text"
                    required
                    value={mpn}
                    onChange={(e) => setMpn(e.target.value)}
                    placeholder="ESP32-S3-WROOM"
                    className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-xs"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="m-name" className="block text-xs font-medium text-slate-700">
                  物料规格名称
                </label>
                <input
                  id="m-name"
                  type="text"
                  required
                  value={matName}
                  onChange={(e) => setMatName(e.target.value)}
                  placeholder="Wi-Fi/BLE 双核无线模组"
                  className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="m-cat" className="block text-xs font-medium text-slate-700">
                    物料分类
                  </label>
                  <select
                    id="m-cat"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as MaterialCategory)}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                  >
                    <option value="IC芯片">IC芯片</option>
                    <option value="阻容感">阻容感</option>
                    <option value="连接器">连接器</option>
                    <option value="PCB光板">PCB光板</option>
                    <option value="辅料锡膏">辅料锡膏</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="m-msd" className="block text-xs font-medium text-slate-700">
                    MSD 湿敏等级
                  </label>
                  <select
                    id="m-msd"
                    value={msdLevel}
                    onChange={(e) => setMsdLevel(e.target.value as MsdLevel)}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                  >
                    <option value="Level 1">Level 1 (非湿敏)</option>
                    <option value="Level 2">Level 2 (1年)</option>
                    <option value="Level 2a">Level 2a (4周)</option>
                    <option value="Level 3">Level 3 (168小时)</option>
                    <option value="Level 4">Level 4 (72小时)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="m-bin" className="block text-xs font-medium text-slate-700">
                    默认上架库位
                  </label>
                  <select
                    id="m-bin"
                    value={defaultBin}
                    onChange={(e) => setDefaultBin(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs"
                  >
                    {state.bins.map((b) => (
                      <option key={b.binCode} value={b.binCode}>
                        {b.binCode}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="m-safety" className="block text-xs font-medium text-slate-700">
                    安全库存预警线
                  </label>
                  <input
                    id="m-safety"
                    type="number"
                    value={safetyStock}
                    onChange={(e) => setSafetyStock(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="m-mfg" className="block text-xs font-medium text-slate-700">
                    品牌/原厂
                  </label>
                  <input
                    id="m-mfg"
                    type="text"
                    value={manufacturer}
                    onChange={(e) => setManufacturer(e.target.value)}
                    placeholder="Espressif"
                    className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="m-pkg" className="block text-xs font-medium text-slate-700">
                    封装规格
                  </label>
                  <input
                    id="m-pkg"
                    type="text"
                    value={packageType}
                    onChange={(e) => setPackageType(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
                  />
                </div>
              </div>

              {matErr && (
                <div className="rounded border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
                  {matErr}
                </div>
              )}
              {matMsg && (
                <div className="rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-800">
                  {matMsg}
                </div>
              )}

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-1 rounded-md bg-sky-700 px-4 py-2 text-xs font-medium text-white hover:bg-sky-800"
              >
                <Plus className="h-3.5 w-3.5" />
                保存物料主数据
              </button>
            </form>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white xl:col-span-8">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-900">
                物料主数据清单 ({state.materials.length} 种)
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-5 py-2.5 font-medium whitespace-nowrap">SKU / MPN</th>
                    <th className="px-4 py-2.5 font-medium whitespace-nowrap">物料名称与封装</th>
                    <th className="px-4 py-2.5 font-medium whitespace-nowrap">MSD等级</th>
                    <th className="px-4 py-2.5 font-medium whitespace-nowrap">默认库位</th>
                    <th className="px-5 py-2.5 font-medium text-right whitespace-nowrap">安全库存</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.materials.map((m) => (
                    <tr key={m.skuCode} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <div className="font-mono font-semibold text-slate-900">{m.mpn}</div>
                        <div className="font-mono text-[11px] text-slate-500">{m.skuCode}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-900">{m.name}</div>
                        <div className="text-[11px] text-slate-500">
                          {m.manufacturer} · {m.packageType}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700 whitespace-nowrap">
                        {m.msdLevel}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700 whitespace-nowrap">
                        {m.defaultBin}
                      </td>
                      <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                        {m.safetyStock.toLocaleString()} {m.unit}
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
