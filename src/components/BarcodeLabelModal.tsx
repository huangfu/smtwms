import { Check, Copy, Printer, X } from 'lucide-react';
import { useState } from 'react';
import type { ReelItem } from '../types/wms';
import { buildCompositeBarcode, generateBarcodeBars } from '../utils/formatters';

interface BarcodeLabelModalProps {
  reel: ReelItem | null;
  onClose: () => void;
}

export function BarcodeLabelModal({ reel, onClose }: BarcodeLabelModalProps) {
  const [copied, setCopied] = useState(false);

  if (!reel) return null;

  const bars = generateBarcodeBars(reel.reelId);
  const lastBar = bars[bars.length - 1];
  const svgWidth = lastBar ? lastBar.x + lastBar.width + 6 : 220;
  const composite = buildCompositeBarcode(reel);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(composite);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard fallback ignored
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="barcode-modal-title"
    >
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="no-print flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="barcode-modal-title" className="text-base font-semibold text-slate-900">
              SMT 料盘唯一标识标签 (UID)
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              符合 IPC-1782 追溯规范 · 可直接打印或复制复合条码用于扫码验证
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

        <div className="p-6">
          <div className="rounded-md border border-slate-900 bg-white p-5">
            <div className="flex items-start justify-between border-b border-slate-300 pb-3">
              <div>
                <div className="text-xs font-medium text-slate-500">物料型号 (MPN)</div>
                <div className="font-mono text-base font-semibold text-slate-900">
                  {reel.mpn}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-medium text-slate-500">当前余量</div>
                <div className="font-mono text-lg font-bold text-slate-900">
                  {reel.qty.toLocaleString()} PCS
                </div>
              </div>
            </div>

            <div className="grid grid-cols-[1fr_0.8fr_1.4fr] gap-3 border-b border-slate-300 py-3 text-xs">
              <div>
                <div className="text-slate-500">批次号 (Lot)</div>
                <div className="font-mono font-semibold text-slate-900">{reel.lotNumber}</div>
              </div>
              <div>
                <div className="text-slate-500">周期 (D/C)</div>
                <div className="font-mono font-semibold text-slate-900">{reel.dateCode}</div>
              </div>
              <div>
                <div className="text-slate-500">库位 / MSD</div>
                <div className="font-mono font-semibold text-slate-900 whitespace-nowrap">
                  {reel.binCode} · {reel.msdLevel}
                </div>
              </div>
            </div>

            <div className="pt-4">
              <div className="flex flex-col items-center">
                <svg
                  viewBox={`0 0 ${svgWidth} 52`}
                  className="h-14 w-full max-w-xs"
                  aria-label={`条码 ${reel.reelId}`}
                >
                  {bars.map((b, i) => (
                    <rect
                      key={i}
                      x={b.x}
                      y={2}
                      width={b.width}
                      height={46}
                      fill="#0f172a"
                    />
                  ))}
                </svg>
                <div className="mt-1 font-mono text-sm font-semibold tracking-wider text-slate-900">
                  {reel.reelId}
                </div>
              </div>
            </div>

            <div className="mt-4 border-t border-dashed border-slate-300 pt-2.5">
              <div className="text-[11px] text-slate-500">IPC-1782 复合扫码串</div>
              <div className="mt-0.5 break-all font-mono text-xs text-slate-700">
                {composite}
              </div>
            </div>
          </div>
        </div>

        <div className="no-print flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-3.5">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? '已复制复合码' : '复制复合条码'}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-md bg-sky-700 px-4 py-2 text-xs font-medium text-white hover:bg-sky-800 whitespace-nowrap shrink-0"
          >
            <Printer className="h-3.5 w-3.5" />
            打印标签
          </button>
        </div>
      </div>
    </div>
  );
}
