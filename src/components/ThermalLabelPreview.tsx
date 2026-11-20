import { useRef, useState } from 'react';
import type {
  LabelBarcodeType,
  LabelElementLayout,
  LabelFontFamily,
  LabelTemplate,
  LabelTextAlign,
  MaterialSku,
  ReelItem,
} from '../types/wms';
import {
  buildCompositeBarcode,
  generateBarcodeBars,
  OWNERSHIP_TYPE_LABEL,
} from '../utils/formatters';
import {
  buildZplVariables,
  computeBarcodeHriBoxMm,
  formatPaperSizeLabel,
  generatePseudo2dMatrix,
  getPaperDimensionsMm,
  interpolateZplTemplate,
  isBarcodeElement,
  mmToDots,
  normalizeDpi,
  normalizeElementLayouts,
  resolveBarcodeValue,
  resolveElementKind,
} from '../utils/zplEngine';

interface ThermalLabelPreviewProps {
  template: LabelTemplate;
  reel: ReelItem;
  material?: MaterialSku;
  compact?: boolean;
  interactive?: boolean;
  offsetXMm?: number;
  offsetYMm?: number;
  selectedKey?: string | null;
  onSelectKey?: (key: string) => void;
  onMoveElement?: (key: string, xMm: number, yMm: number) => void;
}

function getFontFamilyClass(family?: LabelFontFamily): string {
  if (family === 'D') return 'font-mono tracking-normal';
  if (family === 'B') return 'font-sans tracking-tighter';
  return 'font-sans';
}

function getAlignClass(align?: LabelTextAlign): string {
  if (align === 'CENTER') return 'text-center';
  if (align === 'RIGHT') return 'text-right';
  return 'text-left';
}

export function ThermalLabelPreview({
  template,
  reel,
  material,
  compact = false,
  interactive = false,
  offsetXMm,
  offsetYMm,
  selectedKey = null,
  onSelectKey,
  onMoveElement,
}: ThermalLabelPreviewProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const dragOriginRef = useRef<{
    startClientX: number;
    startClientY: number;
    origXMm: number;
    origYMm: number;
  } | null>(null);

  const dpi = normalizeDpi(template.dpi);
  const { widthMm, heightMm } = getPaperDimensionsMm(
    template.paperSize,
    template.customWidthMm,
    template.customHeightMm
  );
  const paperLabel = formatPaperSizeLabel(template);
  const pw = mmToDots(widthMm, dpi);
  const ll = mmToDots(heightMm, dpi);
  const effectiveOffsetX = offsetXMm ?? template.offsetXMm ?? 0;
  const effectiveOffsetY = offsetYMm ?? template.offsetYMm ?? 0;

  const layouts = normalizeElementLayouts(template);
  const vars = buildZplVariables(reel, material, template, 1);

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
  const defaultBarcodeType: LabelBarcodeType = template.barcodeType ?? 'CODE128';

  const maxWidthPx =
    widthMm <= 55
      ? compact
        ? 340
        : 390
      : widthMm >= 95
      ? compact
        ? 460
        : 520
      : compact
      ? 410
      : 470;

  const pxPerMm = maxWidthPx / widthMm;

  const handlePointerDown = (e: React.PointerEvent, el: LabelElementLayout) => {
    if (!interactive) return;
    e.stopPropagation();
    onSelectKey?.(el.key);
    if (!onMoveElement) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDraggingKey(el.key);
    dragOriginRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      origXMm: el.xMm,
      origYMm: el.yMm,
    };
  };

  const handlePointerMove = (e: React.PointerEvent, key: string) => {
    if (
      !interactive ||
      draggingKey !== key ||
      !dragOriginRef.current ||
      !canvasRef.current ||
      !onMoveElement
    ) {
      return;
    }
    const rect = canvasRef.current.getBoundingClientRect();
    const dxMm = ((e.clientX - dragOriginRef.current.startClientX) / rect.width) * widthMm;
    const dyMm = ((e.clientY - dragOriginRef.current.startClientY) / rect.height) * heightMm;
    const snap = (v: number, max: number) =>
      Math.max(0, Math.min(max, Math.round(v * 2) / 2));
    onMoveElement(
      key,
      snap(dragOriginRef.current.origXMm + dxMm, widthMm - 2),
      snap(dragOriginRef.current.origYMm + dyMm, heightMm - 2)
    );
  };

  const handlePointerUp = () => {
    setDraggingKey(null);
    dragOriginRef.current = null;
  };

  const tickStepX = widthMm > 120 ? 20 : 10;
  const tickStepY = heightMm > 100 ? 20 : 10;
  const xTicks = Array.from(
    { length: Math.floor(widthMm / tickStepX) + 1 },
    (_, i) => i * tickStepX
  );
  const yTicks = Array.from(
    { length: Math.floor(heightMm / tickStepY) + 1 },
    (_, i) => i * tickStepY
  );

  const rotationTransform = (rot?: LabelElementLayout['rotation']) => {
    if (rot === 'R') return 'rotate(90deg)';
    if (rot === 'I') return 'rotate(180deg)';
    if (rot === 'B') return 'rotate(270deg)';
    return undefined;
  };

  const barcodeCount = layouts.filter((l) => l.visible && isBarcodeElement(l)).length;
  const hasShift = effectiveOffsetX !== 0 || effectiveOffsetY !== 0;

  return (
    <div className="flex flex-col items-center">
      {/* Millimeter, DPI & Global Shift Header */}
      <div
        style={{ maxWidth: `${maxWidthPx + (interactive ? 24 : 0)}px` }}
        className="mb-1.5 flex w-full flex-wrap items-center justify-between gap-1 font-mono text-[10px] text-slate-500"
      >
        <span>
          纸张 {widthMm} × {heightMm} mm
          {interactive ? ' · 点击/拖拽定位' : ''}
          {hasShift
            ? ` · 整体偏移 (${effectiveOffsetX >= 0 ? '+' : ''}${effectiveOffsetX}, ${effectiveOffsetY >= 0 ? '+' : ''}${effectiveOffsetY})mm`
            : ''}
        </span>
        <span className="tabular-nums">
          {pw} × {ll} dots ({dpi} dpi · {barcodeCount}个条码)
        </span>
      </div>

      {/* Ruler + Physical Canvas Wrapper */}
      <div
        style={{ maxWidth: `${maxWidthPx + (interactive ? 24 : 0)}px` }}
        className="w-full"
      >
        {interactive && (
          <div className="ml-6 mb-0.5 relative h-3.5 border-b border-slate-300 font-mono text-[9px] text-slate-400 select-none">
            {xTicks.map((mm) => (
              <span
                key={mm}
                style={{ left: `${(mm / widthMm) * 100}%` }}
                className="absolute bottom-0 -translate-x-1/2 tabular-nums"
              >
                {mm}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-stretch">
          {interactive && (
            <div className="relative w-6 shrink-0 border-r border-slate-300 font-mono text-[9px] text-slate-400 select-none">
              {yTicks.map((mm) => (
                <span
                  key={mm}
                  style={{ top: `${(mm / heightMm) * 100}%` }}
                  className="absolute right-1 -translate-y-1/2 tabular-nums"
                >
                  {mm}
                </span>
              ))}
            </div>
          )}

          {/* Physical Paper Boundary */}
          <div
            ref={canvasRef}
            data-testid="thermal-label-canvas"
            style={{
              aspectRatio: `${widthMm} / ${heightMm}`,
              backgroundImage: interactive
                ? `linear-gradient(to right, rgba(148,163,184,0.16) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.16) 1px, transparent 1px)`
                : undefined,
              backgroundSize: interactive
                ? `${(5 / widthMm) * 100}% ${(5 / heightMm) * 100}%`
                : undefined,
            }}
            className="relative w-full overflow-hidden rounded border-2 border-slate-900 bg-white shadow-sm"
          >
            {/* Global X/Y Shift Layer */}
            <div
              data-testid="thermal-label-shift-layer"
              style={{
                transform: hasShift
                  ? `translate(${(effectiveOffsetX / widthMm) * 100}%, ${(effectiveOffsetY / heightMm) * 100}%)`
                  : undefined,
              }}
              className="relative h-full w-full transition-transform duration-150"
            >
              {layouts.map((el) => {
                if (!el.visible) return null;
                const kind = resolveElementKind(el);
                const isSelected = interactive && selectedKey === el.key;
                const fontPx = Math.max(8, Math.round(el.fontSizeMm * pxPerMm * 0.85));
                const widthPct = Math.min(
                  100 - (el.xMm / widthMm) * 100,
                  ((el.widthMm ?? widthMm - el.xMm * 2) / widthMm) * 100
                );
                const fontCls = getFontFamilyClass(el.fontFamily);
                const alignCls = getAlignClass(el.textAlign);
                const weightCls = el.bold ? 'font-bold' : 'font-normal';
                const invertCls = el.invert ? 'bg-slate-950 text-white px-1 py-0.5' : 'text-slate-900';

                // Render BOX / LINE element
                if (kind === 'BOX') {
                  const heightPct = Math.max(
                    (0.3 / heightMm) * 100,
                    (el.fontSizeMm / heightMm) * 100
                  );
                  const borderPx = Math.max(1, Math.round((el.borderThicknessMm ?? 0.4) * pxPerMm * 0.85));
                  const isLine = el.fontSizeMm <= 1.0;

                  return (
                    <div
                      key={el.key}
                      onPointerDown={(e) => handlePointerDown(e, el)}
                      onPointerMove={(e) => handlePointerMove(e, el.key)}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerUp}
                      style={{
                        left: `${(el.xMm / widthMm) * 100}%`,
                        top: `${(el.yMm / heightMm) * 100}%`,
                        width: `${widthPct}%`,
                        height: isLine ? `${Math.max(2, borderPx)}px` : `${heightPct}%`,
                        borderWidth: isLine ? undefined : `${borderPx}px`,
                      }}
                      className={`absolute select-none ${
                        isLine ? 'bg-slate-900' : 'border-slate-900 bg-transparent'
                      } ${interactive ? 'cursor-move' : ''} ${
                        isSelected ? 'z-20 ring-2 ring-sky-600' : ''
                      }`}
                    >
                      {isSelected && (
                        <span className="pointer-events-none -top-4 left-0 absolute whitespace-nowrap rounded bg-sky-700 px-1 py-0.5 font-mono text-[8px] text-white">
                          X:{el.xMm} Y:{el.yMm}mm (^FO{mmToDots(el.xMm, dpi)},{mmToDots(el.yMm, dpi)})
                        </span>
                      )}
                    </div>
                  );
                }

                // Render BARCODE (built-in or custom) + positioned/styled HRI
                if (isBarcodeElement(el)) {
                  const bcType: LabelBarcodeType =
                    el.key === 'barcode'
                      ? el.barcodeType ?? defaultBarcodeType
                      : el.barcodeType ?? 'CODE128';
                  const bcVal = resolveBarcodeValue(el, bcType, vars);
                  const is2D = bcType === 'QR' || bcType === 'DATAMATRIX';
                  const hri = computeBarcodeHriBoxMm(el, bcType, vars, widthMm, heightMm);
                  const hriFontPx = Math.max(7, Math.round(hri.fontSizeMm * pxPerMm * 0.85));

                  const bars = !is2D ? generateBarcodeBars(bcVal || '000000') : [];
                  const lastBar = bars[bars.length - 1];
                  const svgWidth = lastBar ? lastBar.x + lastBar.width + 6 : 200;
                  const matrix2d = is2D
                    ? generatePseudo2dMatrix(bcVal || '000000', bcType, bcType === 'QR' ? 21 : 20)
                    : null;

                  return (
                    <div key={el.key}>
                      <div
                        onPointerDown={(e) => handlePointerDown(e, el)}
                        onPointerMove={(e) => handlePointerMove(e, el.key)}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        style={{
                          left: `${(el.xMm / widthMm) * 100}%`,
                          top: `${(el.yMm / heightMm) * 100}%`,
                          width: is2D ? 'auto' : `${widthPct}%`,
                          transform: rotationTransform(el.rotation),
                          transformOrigin: 'top left',
                        }}
                        className={`absolute select-none ${
                          interactive ? 'cursor-move rounded-sm transition-shadow' : ''
                        } ${
                          isSelected
                            ? 'z-20 bg-sky-50/75 ring-1 ring-sky-600'
                            : interactive
                            ? 'hover:ring-1 hover:ring-sky-300'
                            : ''
                        }`}
                      >
                        {isSelected && (
                          <span className="pointer-events-none -top-4 left-0 absolute whitespace-nowrap rounded bg-sky-700 px-1 py-0.5 font-mono text-[8px] text-white">
                            X:{el.xMm} Y:{el.yMm}mm (^FO{mmToDots(el.xMm, dpi)},{mmToDots(el.yMm, dpi)})
                          </span>
                        )}

                        {!is2D ? (
                          <svg
                            viewBox={`0 0 ${svgWidth} 44`}
                            style={{
                              height: `${Math.max(14, Math.round((el.fontSizeMm || 8) * pxPerMm * 0.9))}px`,
                            }}
                            className="block w-full"
                            preserveAspectRatio="none"
                            aria-label={`${bcType} ${bcVal}`}
                          >
                            {bars.map((b, i) => (
                              <rect
                                key={i}
                                x={b.x}
                                y={0}
                                width={b.width}
                                height={44}
                                fill="#0f172a"
                              />
                            ))}
                          </svg>
                        ) : (
                          <svg
                            viewBox={`0 0 ${matrix2d?.length ?? 21} ${matrix2d?.length ?? 21}`}
                            style={{
                              width: `${Math.max(22, Math.round((el.fontSizeMm || 8) * pxPerMm * 0.95))}px`,
                              height: `${Math.max(22, Math.round((el.fontSizeMm || 8) * pxPerMm * 0.95))}px`,
                            }}
                            className="block shrink-0 border border-slate-200 bg-white p-0.5"
                            aria-label={`${bcType} ${bcVal}`}
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
                        )}
                      </div>

                      {/* Positioned & Styled Barcode HRI Text */}
                      {hri.visible && (
                        <div
                          onClick={(e) => {
                            if (!interactive) return;
                            e.stopPropagation();
                            onSelectKey?.(el.key);
                          }}
                          style={{
                            left: `${(hri.xMm / widthMm) * 100}%`,
                            top: `${(hri.yMm / heightMm) * 100}%`,
                            width: `${Math.min(100 - (hri.xMm / widthMm) * 100, (hri.widthMm / widthMm) * 100)}%`,
                            fontSize: `${hriFontPx}px`,
                            lineHeight: 1.12,
                            transform: rotationTransform(el.rotation),
                            transformOrigin: 'top left',
                          }}
                          className={`absolute truncate select-none ${getFontFamilyClass(hri.fontFamily)} ${getAlignClass(hri.align)} ${
                            hri.bold ? 'font-bold' : 'font-normal'
                          } ${
                            hri.invert
                              ? 'bg-slate-950 text-white px-1 py-0.5'
                              : 'text-slate-900'
                          } ${
                            isSelected ? 'z-20 ring-1 ring-dashed ring-sky-500' : ''
                          }`}
                        >
                          {hri.text}
                        </div>
                      )}
                    </div>
                  );
                }

                // Render Custom TEXT or Built-in Elements
                return (
                  <div
                    key={el.key}
                    onPointerDown={(e) => handlePointerDown(e, el)}
                    onPointerMove={(e) => handlePointerMove(e, el.key)}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    style={{
                      left: `${(el.xMm / widthMm) * 100}%`,
                      top: `${(el.yMm / heightMm) * 100}%`,
                      width: `${widthPct}%`,
                      fontSize: `${fontPx}px`,
                      lineHeight: 1.15,
                      transform: rotationTransform(el.rotation),
                      transformOrigin: 'top left',
                    }}
                    className={`absolute select-none ${
                      interactive ? 'cursor-move rounded-sm px-0.5 transition-shadow' : ''
                    } ${
                      isSelected
                        ? 'z-20 bg-sky-50/75 ring-1 ring-sky-600'
                        : interactive
                        ? 'hover:ring-1 hover:ring-sky-300'
                        : ''
                    }`}
                  >
                    {isSelected && (
                      <span className="pointer-events-none -top-4 left-0 absolute whitespace-nowrap rounded bg-sky-700 px-1 py-0.5 font-mono text-[8px] text-white">
                        X:{el.xMm} Y:{el.yMm}mm (^FO{mmToDots(el.xMm, dpi)},{mmToDots(el.yMm, dpi)})
                      </span>
                    )}

                    {kind === 'TEXT' || (el.contentTemplate && el.contentTemplate.trim()) ? (
                      <div className={`truncate ${fontCls} ${alignCls} ${weightCls} ${invertCls}`}>
                        {interpolateZplTemplate(el.contentTemplate ?? '', vars) || '(空文本)'}
                      </div>
                    ) : (
                      <>
                        {el.key === 'header' && (
                          <div className={`flex items-center justify-between gap-1 border-b border-slate-400 pb-0.5 ${fontCls} ${invertCls}`}>
                            <span className={`truncate ${el.bold !== false ? 'font-semibold' : ''}`}>
                              {template.headerTitle || 'SMT 料盘唯一标识'}
                            </span>
                            <span className="shrink-0 font-mono text-[0.8em] opacity-75">
                              {paperLabel}
                            </span>
                          </div>
                        )}

                        {el.key === 'mpnQty' && (
                          <div className={fontCls}>
                            <div className={`flex items-baseline justify-between gap-1 ${invertCls}`}>
                              <span className={`truncate font-mono ${el.bold !== false ? 'font-bold' : ''}`}>
                                MPN:{reel.mpn}
                              </span>
                              <span className={`shrink-0 font-mono tabular-nums ${el.bold !== false ? 'font-bold' : ''}`}>
                                {reel.qty.toLocaleString()} {unit}
                              </span>
                            </div>
                            {template.showFields.skuCode && (
                              <div className="truncate font-mono text-[0.68em] text-slate-500">
                                SKU:{reel.skuCode}
                              </div>
                            )}
                          </div>
                        )}

                        {el.key === 'lotDcBin' && (
                          <div className={`flex items-center justify-between gap-1 font-mono ${weightCls || 'font-semibold'} ${invertCls}`}>
                            <span className="truncate">
                              {template.showFields.lotDateCode
                                ? `LOT:${reel.lotNumber} D/C:${reel.dateCode}`
                                : ''}
                            </span>
                            {template.showFields.binMsd && (
                              <span className="shrink-0">
                                {reel.binCode} · {reel.msdLevel}
                              </span>
                            )}
                          </div>
                        )}

                        {el.key === 'ownership' && (
                          <div className={`truncate ${fontCls} ${alignCls} ${el.bold ? 'font-bold' : 'font-semibold'} ${el.invert ? 'bg-slate-950 text-white px-1' : ownershipMeta.toneClass}`}>
                            [{ownershipMeta.short}] {ownerName} ({customerLabel})
                          </div>
                        )}

                        {el.key === 'packagingMpq' && (
                          <div className={`truncate ${fontCls} ${alignCls} ${weightCls} ${invertCls}`}>
                            PKG:{packagingLabel}
                            {mpqVal ? ` MPQ:${mpqVal}` : ''}
                          </div>
                        )}

                        {el.key === 'supplier' && (
                          <div className={`truncate ${fontCls} ${alignCls} ${weightCls} ${invertCls}`}>
                            SUP:{reel.supplier}
                          </div>
                        )}

                        {el.key === 'composite' && (
                          <div className={`break-all font-mono text-[0.92em] ${el.invert ? 'bg-slate-950 text-white px-1' : 'text-slate-600'}`}>
                            {composite}
                          </div>
                        )}

                        {el.key === 'footer' && (
                          <div className={`truncate border-t border-slate-300 pt-0.5 ${fontCls} ${alignCls} ${weightCls} ${el.invert ? 'bg-slate-950 text-white px-1' : 'text-slate-500'}`}>
                            {template.footerNote}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
