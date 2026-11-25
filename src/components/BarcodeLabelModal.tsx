import {
  Check,
  Code2,
  Copy,
  Download,
  Eye,
  Printer,
  RefreshCw,
  Save,
  Wifi,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  probeZebraBrowserPrint,
  sendZebraBrowserPrint,
  wmsApi,
  type ZebraBrowserPrintDevice,
} from '../services/wmsApi';
import type {
  LabelTemplate,
  MaterialSku,
  ReelItem,
  ZebraPrinterConfig,
  ZebraPrinterMode,
} from '../types/wms';
import { buildCompositeBarcode } from '../utils/formatters';
import {
  formatPaperSizeLabel,
  generateZplFromTemplate,
  normalizeDpi,
} from '../utils/zplEngine';
import { ThermalLabelPreview } from './ThermalLabelPreview';

interface BarcodeLabelModalProps {
  reel: ReelItem | null;
  templates?: LabelTemplate[];
  materials?: MaterialSku[];
  printerConfig?: ZebraPrinterConfig;
  onSavePrinterConfig?: (cfg: Partial<ZebraPrinterConfig>) => Promise<void>;
  onClose: () => void;
}

const DEFAULT_FALLBACK_TPL: LabelTemplate = {
  templateId: 'DEFAULT',
  templateName: '标准追溯标 (70×40mm)',
  paperSize: '70x40mm',
  dpi: 203,
  barcodeType: 'CODE128',
  zplMode: 'VISUAL',
  fontScale: 'STANDARD',
  barcodeHeightMm: 9,
  headerTitle: '智造 SMT-WMS · 料盘唯一标识',
  footerNote: '严格FIFO先进先出 · 扫码上机防错校验',
  showFields: {
    mpn: true,
    skuCode: true,
    ownership: true,
    packagingMpq: true,
    supplier: true,
    lotDateCode: true,
    binMsd: true,
    compositeBarcode: true,
  },
  isDefault: true,
};

export function BarcodeLabelModal({
  reel,
  templates = [],
  materials = [],
  printerConfig,
  onSavePrinterConfig,
  onClose,
}: BarcodeLabelModalProps) {
  const [copiedType, setCopiedType] = useState<'COMPOSITE' | 'ZPL' | null>(null);
  const defaultTemplate = templates.find((t) => t.isDefault) ?? templates[0];
  const [selectedTplId, setSelectedTplId] = useState(defaultTemplate?.templateId ?? '');
  const [viewMode, setViewMode] = useState<'PREVIEW' | 'ZPL'>('PREVIEW');
  const [copies, setCopies] = useState(1);

  // Zebra printer connection state
  const [mode, setMode] = useState<ZebraPrinterMode>(printerConfig?.mode ?? 'LAN_TCP');
  const [host, setHost] = useState(printerConfig?.host ?? '192.168.10.88');
  const [port, setPort] = useState(printerConfig?.port ?? 9100);
  const [browserPrintUrl, setBrowserPrintUrl] = useState(
    printerConfig?.browserPrintUrl ?? 'http://127.0.0.1:9100'
  );
  const [darkness, setDarkness] = useState(printerConfig?.darkness ?? 18);
  const [printSpeed, setPrintSpeed] = useState(printerConfig?.printSpeed ?? 4);
  const [bpDevices, setBpDevices] = useState<ZebraBrowserPrintDevice[]>([]);
  const [selectedDeviceName, setSelectedDeviceName] = useState(
    printerConfig?.selectedDeviceName ?? ''
  );

  const [busyAction, setBusyAction] = useState<'SAVE' | 'TEST' | 'PRINT' | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusErr, setStatusErr] = useState<string | null>(null);

  const [printOffsetXMm, setPrintOffsetXMm] = useState<number>(defaultTemplate?.offsetXMm ?? 0);
  const [printOffsetYMm, setPrintOffsetYMm] = useState<number>(defaultTemplate?.offsetYMm ?? 0);

  useEffect(() => {
    if (defaultTemplate) {
      setSelectedTplId(defaultTemplate.templateId);
      setPrintOffsetXMm(defaultTemplate.offsetXMm ?? 0);
      setPrintOffsetYMm(defaultTemplate.offsetYMm ?? 0);
    }
  }, [defaultTemplate?.templateId, reel?.reelId]);

  useEffect(() => {
    if (!printerConfig) return;
    setMode(printerConfig.mode);
    setHost(printerConfig.host);
    setPort(printerConfig.port);
    setBrowserPrintUrl(printerConfig.browserPrintUrl);
    setSelectedDeviceName(printerConfig.selectedDeviceName ?? '');
    setDarkness(printerConfig.darkness);
    setPrintSpeed(printerConfig.printSpeed);
  }, [printerConfig]);

  if (!reel) return null;

  const activeTpl =
    templates.find((t) => t.templateId === selectedTplId) ??
    defaultTemplate ??
    DEFAULT_FALLBACK_TPL;
  const matchedMaterial =
    (reel.materialKey
      ? materials.find((m) => m.materialKey === reel.materialKey)
      : undefined) ?? materials.find((m) => m.skuCode === reel.skuCode);

  const composite = buildCompositeBarcode(reel);
  const compiledZpl = generateZplFromTemplate({
    template: activeTpl,
    reel,
    material: matchedMaterial,
    copies,
    darkness,
    printSpeed,
    offsetXMm: printOffsetXMm,
    offsetYMm: printOffsetYMm,
  });

  const handleCopy = async (kind: 'COMPOSITE' | 'ZPL') => {
    try {
      await navigator.clipboard.writeText(kind === 'ZPL' ? compiledZpl : composite);
      setCopiedType(kind);
      setTimeout(() => setCopiedType(null), 1800);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handleDownloadZpl = () => {
    const blob = new Blob([compiledZpl], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reel.reelId}.zpl`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveConfig = async () => {
    if (!onSavePrinterConfig) return;
    setBusyAction('SAVE');
    setStatusErr(null);
    setStatusMsg(null);
    try {
      await onSavePrinterConfig({
        mode,
        host,
        port,
        browserPrintUrl,
        selectedDeviceName,
        darkness,
        printSpeed,
      });
      setStatusMsg('Zebra 打印机连接参数已持久化保存');
    } catch (err) {
      setStatusErr(err instanceof Error ? err.message : '保存打印机配置失败');
    } finally {
      setBusyAction(null);
    }
  };

  const handleTestConnection = async () => {
    setBusyAction('TEST');
    setStatusErr(null);
    setStatusMsg(null);
    try {
      if (mode === 'LAN_TCP') {
        const res = await wmsApi.testZplPrinter({ host: host.trim(), port: Number(port) });
        setStatusMsg(
          `连接成功：Zebra (${res.payload.host}:${res.payload.port}) TCP 握手耗时 ${res.payload.latencyMs} ms`
        );
      } else if (mode === 'BROWSER_PRINT') {
        const list = await probeZebraBrowserPrint(browserPrintUrl);
        setBpDevices(list);
        if (list.length === 0) {
          setStatusErr('已连接 Zebra Browser Print 服务，但未发现已绑定的 USB/本地斑马打印机');
        } else {
          const picked =
            list.find((d) => d.name === selectedDeviceName) ?? list[0];
          setSelectedDeviceName(picked.name);
          setStatusMsg(
            `探测成功：发现 ${list.length} 台本机斑马设备，当前选中「${picked.name}」`
          );
        }
      } else {
        setStatusMsg('当前为浏览器系统打印 / .zpl 导出模式，无需端口握手');
      }
    } catch (err) {
      setStatusErr(err instanceof Error ? err.message : '测试连接失败');
    } finally {
      setBusyAction(null);
    }
  };

  const handlePrint = async () => {
    setStatusErr(null);
    setStatusMsg(null);

    if (mode === 'DRIVER_PRINT') {
      window.print();
      return;
    }

    setBusyAction('PRINT');
    try {
      if (mode === 'LAN_TCP') {
        const res = await wmsApi.sendZplPrint({
          host: host.trim(),
          port: Number(port),
          zpl: compiledZpl,
        });
        setStatusMsg(
          `ZPL 打印指令已发送至 ${res.payload.host}:${res.payload.port}（${res.payload.bytesSent} bytes · ${copies} 份）`
        );
      } else {
        const devices =
          bpDevices.length > 0 ? bpDevices : await probeZebraBrowserPrint(browserPrintUrl);
        setBpDevices(devices);
        const device =
          devices.find((d) => d.name === selectedDeviceName) ?? devices[0];
        if (!device) {
          throw new Error('未检测到可用的 Zebra Browser Print 打印机，请先连接 USB 或检查默认设备');
        }
        setSelectedDeviceName(device.name);
        await sendZebraBrowserPrint(browserPrintUrl, device, compiledZpl);
        setStatusMsg(`已通过 Zebra Browser Print 下发至「${device.name}」（${copies} 份）`);
      }
    } catch (err) {
      setStatusErr(err instanceof Error ? err.message : 'ZPL 下发打印失败');
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="barcode-modal-title"
    >
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-lg border border-slate-200 bg-white shadow-xl">
        {/* Modal Header */}
        <div className="no-print flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <div>
            <h2 id="barcode-modal-title" className="text-base font-semibold text-slate-900">
              SMT 料盘 ZPL 标签预览与斑马打印控制台
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              支持局域网 Zebra TCP:9100 直连、USB Browser Print 客户端及 .zpl 指令导出
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭标签预览"
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Template & View Bar */}
        <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-2.5 text-xs">
          <div className="flex flex-1 items-center gap-2 min-w-[240px]">
            <label htmlFor="lbl-tpl-select" className="font-medium text-slate-700 whitespace-nowrap">
              选用模板
            </label>
            <select
              id="lbl-tpl-select"
              value={activeTpl.templateId}
              onChange={(e) => {
                const nextId = e.target.value;
                setSelectedTplId(nextId);
                const nextTpl = templates.find((t) => t.templateId === nextId);
                setPrintOffsetXMm(nextTpl?.offsetXMm ?? 0);
                setPrintOffsetYMm(nextTpl?.offsetYMm ?? 0);
              }}
              className="flex-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs"
            >
              {(templates.length > 0 ? templates : [activeTpl]).map((t) => {
                const dimLabel = formatPaperSizeLabel(t);
                const normalizedName = t.templateName.replace('×', 'x').toLowerCase();
                const alreadyHasDim = normalizedName.includes(dimLabel.replace('×', 'x').toLowerCase());
                return (
                  <option key={t.templateId} value={t.templateId}>
                    {alreadyHasDim ? t.templateName : `${t.templateName} (${dimLabel})`} ·{' '}
                    {normalizeDpi(t.dpi)}dpi
                  </option>
                );
              })}
            </select>
          </div>

          <div className="inline-flex rounded border border-slate-200 bg-white p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setViewMode('PREVIEW')}
              className={`inline-flex items-center gap-1 rounded px-2.5 py-1 font-medium whitespace-nowrap ${
                viewMode === 'PREVIEW'
                  ? 'bg-teal-700 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="h-3 w-3" />
              标签可视化预览
            </button>
            <button
              type="button"
              onClick={() => setViewMode('ZPL')}
              className={`inline-flex items-center gap-1 rounded px-2.5 py-1 font-medium whitespace-nowrap ${
                viewMode === 'ZPL'
                  ? 'bg-teal-700 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Code2 className="h-3 w-3" />
              ZPL II 指令源码
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Preview Area */}
          {viewMode === 'PREVIEW' ? (
            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4">
              <ThermalLabelPreview
                template={activeTpl}
                reel={reel}
                material={matchedMaterial}
                offsetXMm={printOffsetXMm}
                offsetYMm={printOffsetYMm}
                compact
              />
            </div>
          ) : (
            <div className="no-print space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-slate-600">
                  生成指令：{formatPaperSizeLabel(activeTpl)} @ {normalizeDpi(activeTpl.dpi)} dpi · 偏移 ({printOffsetXMm},{printOffsetYMm})mm · 黑度 ^MD{darkness}
                </span>
                <div className="inline-flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy('ZPL')}
                    className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {copiedType === 'ZPL' ? (
                      <Check className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    {copiedType === 'ZPL' ? '已复制 ZPL' : '复制 ZPL'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadZpl}
                    className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="h-3 w-3" />
                    下载 .zpl
                  </button>
                </div>
              </div>
              <pre className="max-h-60 overflow-auto rounded-md border border-slate-800 bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-emerald-300">
                {compiledZpl}
              </pre>
            </div>
          )}

          {/* Zebra Printer Connection Console */}
          <div className="no-print rounded-md border border-slate-200 bg-slate-50 p-3.5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <div className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
                <Wifi className="h-3.5 w-3.5 text-teal-700" />
                Zebra 打印机连接通道设置
              </div>
              {onSavePrinterConfig && (
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={handleSaveConfig}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  <Save className="h-3 w-3" />
                  保存默认连接配置
                </button>
              )}
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-12">
              <div className="sm:col-span-5">
                <label htmlFor="zpl-mode-select" className="block text-[11px] font-medium text-slate-600">
                  连接方式
                </label>
                <select
                  id="zpl-mode-select"
                  value={mode}
                  onChange={(e) => {
                    setMode(e.target.value as ZebraPrinterMode);
                    setStatusErr(null);
                    setStatusMsg(null);
                  }}
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs"
                >
                  <option value="LAN_TCP">局域网 Zebra 网口/Wi-Fi (TCP 9100)</option>
                  <option value="BROWSER_PRINT">本机 USB (Zebra Browser Print)</option>
                  <option value="DRIVER_PRINT">浏览器系统驱动 / .zpl 导出</option>
                </select>
              </div>

              {mode === 'LAN_TCP' && (
                <>
                  <div className="sm:col-span-4">
                    <label htmlFor="zpl-host" className="block text-[11px] font-medium text-slate-600">
                      打印机 IP / 主机名
                    </label>
                    <input
                      id="zpl-host"
                      type="text"
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      placeholder="192.168.10.88"
                      className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label htmlFor="zpl-port" className="block text-[11px] font-medium text-slate-600">
                      TCP 端口
                    </label>
                    <input
                      id="zpl-port"
                      type="number"
                      min={1}
                      max={65535}
                      value={port}
                      onChange={(e) => setPort(Number(e.target.value))}
                      className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs tabular-nums"
                    />
                  </div>
                </>
              )}

              {mode === 'BROWSER_PRINT' && (
                <>
                  <div className="sm:col-span-4">
                    <label htmlFor="zpl-bp-url" className="block text-[11px] font-medium text-slate-600">
                      Browser Print 本机地址
                    </label>
                    <input
                      id="zpl-bp-url"
                      type="text"
                      value={browserPrintUrl}
                      onChange={(e) => setBrowserPrintUrl(e.target.value)}
                      placeholder="http://127.0.0.1:9100"
                      className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label htmlFor="zpl-bp-dev" className="block text-[11px] font-medium text-slate-600">
                      USB 斑马设备
                    </label>
                    <select
                      id="zpl-bp-dev"
                      value={selectedDeviceName}
                      onChange={(e) => setSelectedDeviceName(e.target.value)}
                      className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs"
                    >
                      {bpDevices.length === 0 ? (
                        <option value={selectedDeviceName}>
                          {selectedDeviceName || '点击测试连接以探测'}
                        </option>
                      ) : (
                        bpDevices.map((d) => (
                          <option key={d.name} value={d.name}>
                            {d.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </>
              )}

              {mode === 'DRIVER_PRINT' && (
                <div className="flex items-end sm:col-span-7">
                  <div className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-600">
                    适用于本机未部署 Zebra Browser Print 或无法访问内网 IP 的场景：可调用浏览器打印驱动或导出 .zpl 发送至 Zebra Setup Utilities。
                  </div>
                </div>
              )}
            </div>

            <div className="mt-2.5 grid grid-cols-5 gap-2">
              <div>
                <label htmlFor="zpl-offset-x" className="block text-[11px] font-medium text-slate-600">
                  整体 X 移转(mm)
                </label>
                <input
                  id="zpl-offset-x"
                  type="number"
                  step="any"
                  min={-30}
                  max={30}
                  value={printOffsetXMm}
                  onChange={(e) =>
                    setPrintOffsetXMm(Math.max(-30, Math.min(30, Number(e.target.value) || 0)))
                  }
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="zpl-offset-y" className="block text-[11px] font-medium text-slate-600">
                  整体 Y 移转(mm)
                </label>
                <input
                  id="zpl-offset-y"
                  type="number"
                  step="any"
                  min={-30}
                  max={30}
                  value={printOffsetYMm}
                  onChange={(e) =>
                    setPrintOffsetYMm(Math.max(-30, Math.min(30, Number(e.target.value) || 0)))
                  }
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="zpl-darkness" className="block text-[11px] font-medium text-slate-600">
                  黑度 ^MD (0-30)
                </label>
                <input
                  id="zpl-darkness"
                  type="number"
                  min={0}
                  max={30}
                  value={darkness}
                  onChange={(e) => setDarkness(Number(e.target.value))}
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="zpl-speed" className="block text-[11px] font-medium text-slate-600">
                  速度 ^PR (2-12)
                </label>
                <input
                  id="zpl-speed"
                  type="number"
                  min={2}
                  max={12}
                  value={printSpeed}
                  onChange={(e) => setPrintSpeed(Number(e.target.value))}
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="zpl-copies" className="block text-[11px] font-medium text-slate-600">
                  份数 ^PQ
                </label>
                <input
                  id="zpl-copies"
                  type="number"
                  min={1}
                  max={50}
                  value={copies}
                  onChange={(e) => setCopies(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs tabular-nums"
                />
              </div>
            </div>

            {statusErr && (
              <div
                role="alert"
                className="mt-2.5 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
              >
                {statusErr}
              </div>
            )}
            {statusMsg && (
              <div className="mt-2.5 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                {statusMsg}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="no-print flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-5 py-3.5">
          <div className="inline-flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleCopy('COMPOSITE')}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              {copiedType === 'COMPOSITE' ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copiedType === 'COMPOSITE' ? '已复制复合码' : '复制复合码'}
            </button>
            <button
              type="button"
              onClick={handleDownloadZpl}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              导出 .zpl
            </button>
          </div>

          <div className="inline-flex items-center gap-2">
            {mode !== 'DRIVER_PRINT' && (
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={handleTestConnection}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${busyAction === 'TEST' ? 'animate-spin' : ''}`} />
                {mode === 'BROWSER_PRINT' ? '探测本机打印机' : '测试连接'}
              </button>
            )}
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-50 whitespace-nowrap"
            >
              <Printer className="h-3.5 w-3.5" />
              {busyAction === 'PRINT'
                ? '正在发送 ZPL...'
                : mode === 'DRIVER_PRINT'
                ? '系统驱动打印'
                : '发送 ZPL 打印'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
