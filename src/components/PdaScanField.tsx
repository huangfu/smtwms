import React from 'react';
import { AlertCircle, CheckCircle2, ScanBarcode } from 'lucide-react';

export type PdaScanActionTone = 'teal' | 'emerald' | 'red' | 'slate';

export interface PdaScanQuickItem {
  key: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}

export interface PdaScanFeedback {
  type: 'error' | 'success';
  message: React.ReactNode;
  action?: React.ReactNode;
}

export interface PdaScanFieldProps {
  id: string;
  /** Section heading style (used for standalone scan cards like ASN / IQC / WavePick / CycleCount / Trace). */
  title?: string;
  /** Compact form-field label style (used inside multi-field forms like Replenish / Return / Scrap / Outbound). */
  label?: string;
  subtitle?: string;
  ariaLabel?: string;
  headerExtra?: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  list?: string;
  required?: boolean;
  disabled?: boolean;
  leadingControl?: React.ReactNode;
  actionLabel?: string;
  actionIcon?: React.ReactNode;
  actionDisabled?: boolean;
  actionTone?: PdaScanActionTone;
  actionType?: 'submit' | 'button';
  onActionClick?: () => void;
  /**
   * Inline scan/submit result rendered immediately beneath the scan input (zero-scroll visible).
   * When `type === 'error'`, the scan input frame also switches to high-contrast alert red.
   */
  feedback?: PdaScanFeedback | null;
  helperHint?: React.ReactNode;
  quickItemsLabel?: string;
  quickItems?: PdaScanQuickItem[];
  trailingControl?: React.ReactNode;
}

const ACTION_TONE_CLASSES: Record<PdaScanActionTone, string> = {
  teal: 'bg-teal-700 hover:bg-teal-800',
  emerald: 'bg-emerald-700 hover:bg-emerald-800',
  red: 'bg-red-700 hover:bg-red-800',
  slate: 'bg-slate-900 hover:bg-slate-800',
};

/**
 * Canonical MES / PDA Scan Input Component.
 * Enforces one unified visual & ergonomic standard across all scanning workflows:
 * - 2px Deep Marine Industrial Teal scan-focus frame (`border-2 border-teal-600/80`)
 * - Automatic 2px Alert Red frame (`border-red-600`) when `feedback.type === 'error'`
 * - Built-in zero-scroll inline feedback slot immediately beneath the scan box
 * - 48px touch target (`min-h-[48px]`) with monospaced barcode typography
 * - Left `ScanBarcode` affordance icon + tactile high-contrast CTA
 */
export const PdaScanField: React.FC<PdaScanFieldProps> = ({
  id,
  title,
  label,
  subtitle,
  ariaLabel,
  headerExtra,
  value,
  onChange,
  placeholder,
  inputRef,
  list,
  required,
  disabled,
  leadingControl,
  actionLabel,
  actionIcon,
  actionDisabled,
  actionTone = 'teal',
  actionType = 'submit',
  onActionClick,
  feedback,
  helperHint,
  quickItemsLabel,
  quickItems,
  trailingControl,
}) => {
  const hasFooter = (quickItems && quickItems.length > 0) || Boolean(trailingControl);
  const isError = feedback?.type === 'error';
  const feedbackId = `${id}-feedback`;

  return (
    <div className="space-y-2.5">
      {title && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <label
              htmlFor={id}
              className="flex items-center gap-1.5 text-sm font-semibold text-slate-900"
            >
              <ScanBarcode
                className={`h-4 w-4 shrink-0 ${isError ? 'text-red-600' : 'text-teal-700'}`}
                aria-hidden="true"
              />
              <span>{title}</span>
            </label>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {headerExtra && <div className="flex items-center gap-2">{headerExtra}</div>}
        </div>
      )}

      {!title && label && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <label
              htmlFor={id}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-800"
            >
              <ScanBarcode
                className={`h-3.5 w-3.5 shrink-0 ${isError ? 'text-red-600' : 'text-teal-700'}`}
                aria-hidden="true"
              />
              <span>{label}</span>
            </label>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {headerExtra && <div className="flex items-center gap-2">{headerExtra}</div>}
        </div>
      )}

      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-stretch">
        {leadingControl && <div className="shrink-0">{leadingControl}</div>}

        <div className="relative flex-1">
          <ScanBarcode
            aria-hidden="true"
            className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors ${
              isError ? 'text-red-600' : 'text-teal-700/80'
            }`}
          />
          <input
            ref={inputRef}
            id={id}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            list={list}
            required={required}
            disabled={disabled}
            placeholder={placeholder}
            autoComplete="off"
            aria-label={ariaLabel || title || label}
            aria-invalid={isError || undefined}
            aria-describedby={feedback ? feedbackId : undefined}
            className={`min-h-[48px] w-full rounded-md border-2 bg-white py-2 pl-9 pr-3 font-mono text-sm text-slate-900 placeholder:font-sans placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-500 ${
              isError
                ? 'border-red-600 focus:border-red-700 focus:ring-red-600/20'
                : 'border-teal-600/80 focus:border-teal-700 focus:ring-teal-600/20'
            }`}
          />
        </div>

        {actionLabel && (
          <button
            type={actionType}
            onClick={onActionClick}
            disabled={actionDisabled}
            className={`inline-flex min-h-[48px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-5 py-2.5 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 ${ACTION_TONE_CLASSES[actionTone]}`}
          >
            {actionIcon}
            {actionLabel}
          </button>
        )}
      </div>

      {/* Inline Zero-Scroll Feedback Slot (immediately beneath scan input) */}
      {feedback && (
        <div
          id={feedbackId}
          role={isError ? 'alert' : 'status'}
          className={`flex items-start justify-between gap-2.5 rounded-md border px-3 py-2 text-xs font-medium ${
            isError
              ? 'border-red-300 bg-red-50 text-red-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          <div className="flex items-start gap-2 min-w-0">
            {isError ? (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            )}
            <span className="break-words">{feedback.message}</span>
          </div>
          {feedback.action && <div className="shrink-0">{feedback.action}</div>}
        </div>
      )}

      {helperHint && <div className="text-xs text-slate-600">{helperHint}</div>}

      {hasFooter && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            {quickItemsLabel && quickItems && quickItems.length > 0 && (
              <span className="text-slate-500">{quickItemsLabel}</span>
            )}
            {quickItems?.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={item.onClick}
                disabled={item.disabled}
                title={item.title}
                className="min-h-[36px] rounded border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-xs text-slate-700 transition-colors hover:border-teal-600/50 hover:bg-teal-50/70 hover:text-teal-900 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {item.label}
              </button>
            ))}
          </div>
          {trailingControl && <div className="shrink-0">{trailingControl}</div>}
        </div>
      )}
    </div>
  );
};
