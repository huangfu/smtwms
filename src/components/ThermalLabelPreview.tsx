import type { LabelTemplate, MaterialSku, ReelItem } from '../types/wms';
import {
  buildCompositeBarcode,
  generateBarcodeBars,
  OWNERSHIP_TYPE_LABEL,
} from '../utils/formatters';
import {
  generatePseudo2dMatrix,
  getPaperDimensionsMm,
  mmToDots,
  normalizeElementOrder,
} from '../utils/zplEngine';

interface ThermalLabelPreviewProps {
  template: LabelTemplate;
  reel: ReelItem;
  material?: MaterialSku;
  compact?: boolean;
}

export function ThermalLabelPreview({
  template,
  reel,
  material,
  compact = false,
}: ThermalLabelPreviewProps) {
  const dpi: 203 | 300 = template.dpi === 300 ? 300 : 203;
  const { widthMm, heightMm } = getPaperDimensionsMm(template.paperSize);
  const pw = mmToDots(widthMm, dpi);
  const ll = mmToDots(heightMm, dpi);

  const ownershipType =
    reel.ownershipType ?? material?.ownershipType ?? 'SELF_PURCHASED';
  const ownerName = reel.ownerName ?? material?.ownerName ?? '本厂自购';
  const customerLabel =
    reel.customerCode || material?.customerCode
      ? reel.customerName ?? material?.customerName ?? reel.customerCode
      : '通用共享';
  const ownershipMeta = OWNERSHIP_TYPE_LABEL[ownershipType];
  const packagingLabel =
    material?.packagingName ?? material?.packageType ?? '标准卷盘';
  const mpqVal = reel.mpq ?? material?.mpq;
  const unit = material?.unit ?? 'PCS';
  const composite = buildCompositeBarcode(reel);

  const bars = generateBarcodeBars(reel.reelId);
  const lastBar = bars[bars.length - 1];
  const svgWidth = lastBar ? lastBar.x + lastBar.width + 6 : 220;

  const barcodeType = template.barcodeType ?? 'CODE128';
  const matrix2d =
    barcodeType === 'QR'
      ? generatePseudo2dMatrix(composite, 'QR', 21)
      : barcodeType === 'DATAMATRIX'
      ? generatePseudo2dMatrix(composite, 'DATAMATRIX', 20)
      : null;

  const order = normalizeElementOrder(template.elementOrder);
  const fontScale = template.fontScale ?? 'STANDARD';
  const scaleSizeClass =
    fontScale === 'COMPACT'
      ? 'text-[10px] leading-tight'
      : fontScale === 'LARGE'
      ? 'text-xs leading-snug'
      : 'text-[11px] leading-snug';

  const maxWidthClass =
    template.paperSize === '50x30mm'
      ? 'max-w-[330px]'
      : template.paperSize === '100x60mm'
      ? 'max-w-[460px]'
      : 'max-w-[390px]';

  const barcodeHeightPx = Math.max(
    28,
    Math.min(68, Math.round((template.barcodeHeightMm ?? 8) * (compact ? 3.2 : 4)))
  );

  return (
    <div className="flex flex-col items-center">
      {/* Millimeter ruler / specs strip */}
      <div
        className={`mb-1.5 flex w-full ${maxWidthClass} items-center justify-between font-mono text-[10px] text-slate-500`}
      >
        <span>
          纸张 {widthMm} × {heightMm} mm
        </span>
        <span className="tabular-nums">
          {pw} × {ll} dots ({dpi} dpi · {barcodeType})
        </span>
      </div>

      {/* Physical Thermal Label Card */}
      <div
        className={`w-full ${maxWidthClass} rounded border-2 border-slate-900 bg-white ${
          compact ? 'p-3' : 'p-4'
        } shadow-sm ${scaleSizeClass}`}
      >
        <div className="space-y-1.5">
          {order.map((key) => {
            if (key === 'header') {
              return (
                <div
                  key="header"
                  className="flex items-center justify-between gap-2 border-b border-slate-300 pb-1"
                >
                  <span className="truncate font-semibold text-slate-900">
                    {template.headerTitle || 'SMT 料盘唯一标识'}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-slate-500">
                    {template.paperSize}
                  </span>
                </div>
              );
            }

            if (key === 'mpnQty') {
              return (
                <div
                  key="mpnQty"
                  className="flex items-start justify-between gap-2 border-b border-slate-300 pb-1.5"
                >
                  <div className="min-w-0">
                    <div className="text-[10px] text-slate-500">物料型号 (MPN)</div>
                    <div
                      className={`truncate font-mono font-bold text-slate-900 ${
                        fontScale === 'LARGE' ? 'text-base' : 'text-sm'
                      }`}
                    >
                      {reel.mpn}
                    </div>
                    {template.showFields.skuCode && (
                      <div className="truncate font-mono text-[10px] text-slate-500">
                        SKU: {reel.skuCode}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[10px] text-slate-500">当前余量</div>
                    <div
                      className={`font-mono font-bold text-slate-900 tabular-nums ${
                        fontScale === 'LARGE' ? 'text-base' : 'text-sm'
                      }`}
                    >
                      {reel.qty.toLocaleString()} {unit}
                    </div>
                  </div>
                </div>
              );
            }

            if (key === 'lotDcBin') {
              if (!template.showFields.lotDateCode && !template.showFields.binMsd) {
                return null;
              }
              return (
                <div
                  key="lotDcBin"
                  className="grid grid-cols-[1fr_0.7fr_1.3fr] gap-2 border-b border-slate-200 pb-1.5"
                >
                  {template.showFields.lotDateCode ? (
                    <>
                      <div className="min-w-0">
                        <div className="text-[10px] text-slate-500">批次 (Lot)</div>
                        <div className="truncate font-mono font-semibold text-slate-900">
                          {reel.lotNumber}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] text-slate-500">周期 (D/C)</div>
                        <div className="font-mono font-semibold text-slate-900">
                          {reel.dateCode}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="col-span-2" />
                  )}
                  {template.showFields.binMsd && (
                    <div className="min-w-0">
                      <div className="text-[10px] text-slate-500">库位 / MSD</div>
                      <div className="truncate font-mono font-semibold text-slate-900">
                        {reel.binCode} · {reel.msdLevel}
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            if (key === 'ownership') {
              if (!template.showFields.ownership) return null;
              return (
                <div key="ownership" className="flex items-center justify-between gap-2 text-[10px]">
                  <span className="text-slate-500">产权/准入：</span>
                  <span className={`truncate font-semibold ${ownershipMeta.toneClass}`}>
                    [{ownershipMeta.short}] {ownerName} ({customerLabel})
                  </span>
                </div>
              );
            }

            if (key === 'packagingMpq') {
              if (!template.showFields.packagingMpq) return null;
              return (
                <div key="packagingMpq" className="flex items-center justify-between gap-2 text-[10px]">
                  <span className="text-slate-500">包装/MPQ：</span>
                  <span className="truncate font-mono text-slate-800">
                    {packagingLabel}
                    {mpqVal ? ` (${mpqVal})` : ''}
                  </span>
                </div>
              );
            }

            if (key === 'supplier') {
              if (!template.showFields.supplier) return null;
              return (
                <div key="supplier" className="flex items-center justify-between gap-2 text-[10px]">
                  <span className="text-slate-500">供应商：</span>
                  <span className="truncate font-medium text-slate-800">{reel.supplier}</span>
                </div>
              );
            }

            if (key === 'barcode') {
              if (barcodeType === 'CODE128') {
                return (
                  <div
                    key="barcode"
                    className="flex flex-col items-center border-t border-slate-200 pt-2"
                  >
                    <svg
                      viewBox={`0 0 ${svgWidth} 48`}
                      style={{ height: `${barcodeHeightPx}px` }}
                      className="w-full max-w-[260px]"
                      aria-label={`Code128 ${reel.reelId}`}
                    >
                      {bars.map((b, i) => (
                        <rect
                          key={i}
                          x={b.x}
                          y={1}
                          width={b.width}
                          height={44}
                          fill="#0f172a"
                        />
                      ))}
                    </svg>
                    <div className="mt-0.5 font-mono text-xs font-bold tracking-wider text-slate-900">
                      {reel.reelId}
                    </div>
                  </div>
                );
              }

              const size = matrix2d?.length ?? 21;
              return (
                <div
                  key="barcode"
                  className="flex items-center gap-3 border-t border-slate-200 pt-2"
                >
                  <svg
                    viewBox={`0 0 ${size} ${size}`}
                    style={{
                      width: `${Math.max(48, Math.min(72, barcodeHeightPx + 14))}px`,
                      height: `${Math.max(48, Math.min(72, barcodeHeightPx + 14))}px`,
                    }}
                    className="shrink-0 border border-slate-200 bg-white p-0.5"
                    aria-label={`${barcodeType} ${reel.reelId}`}
                  >
                    {matrix2d?.map((row, r) =>
                      row.map((cell, c) =>
                        cell ? (
                          <rect
                            key={`${r}-${c}`}
                            x={c}
                            y={r}
                            width={1}
                            height={1}
                            fill="#0f172a"
                          />
                        ) : null
                      )
                    )}
                  </svg>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[10px] font-semibold uppercase text-slate-500">
                      {barcodeType === 'QR' ? 'QR Code (^BQN)' : 'DataMatrix (^BXN)'}
                    </div>
                    <div className="truncate font-mono text-xs font-bold text-slate-900">
                      {reel.reelId}
                    </div>
                    <div className="truncate font-mono text-[10px] text-slate-600">
                      LOT:{reel.lotNumber} · D/C:{reel.dateCode}
                    </div>
                  </div>
                </div>
              );
            }

            if (key === 'composite') {
              if (!template.showFields.compositeBarcode) return null;
              return (
                <div
                  key="composite"
                  className="border-t border-dashed border-slate-300 pt-1.5"
                >
                  <div className="text-[10px] text-slate-500">IPC-1782 复合扫码串</div>
                  <div className="break-all font-mono text-[10px] text-slate-700">
                    {composite}
                  </div>
                </div>
              );
            }

            if (key === 'footer') {
              if (!template.footerNote) return null;
              return (
                <div
                  key="footer"
                  className="border-t border-slate-200 pt-1 text-[10px] text-slate-500"
                >
                  {template.footerNote}
                </div>
              );
            }

            return null;
          })}
        </div>
      </div>
    </div>
  );
}
