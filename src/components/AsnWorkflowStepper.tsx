import { Check } from 'lucide-react';
import type { AsnOrder, AsnWorkflowStage } from '../types/wms';
import { ASN_WORKFLOW_STAGES, formatTime } from '../utils/formatters';

interface AsnWorkflowStepperProps {
  currentStage: AsnWorkflowStage;
  asn: AsnOrder;
  compact?: boolean;
}

export function AsnWorkflowStepper({
  currentStage,
  asn,
  compact = false,
}: AsnWorkflowStepperProps) {
  const currentIndex = ASN_WORKFLOW_STAGES.findIndex((s) => s.key === currentStage);
  const activeStep = ASN_WORKFLOW_STAGES[currentIndex] ?? ASN_WORKFLOW_STAGES[0];

  const totalSteps = ASN_WORKFLOW_STAGES.length;

  const getStageTimestamp = (stage: AsnWorkflowStage): string | undefined => {
    switch (stage) {
      case 'SUPPLIER_DELIVERY':
        return asn.arrivedAt;
      case 'ASN_REGISTERED':
        return asn.createdAt;
      case 'RECEIVING':
        return asn.receivingCompletedAt;
      case 'IQC_INSPECTION':
        return asn.iqcCompletedAt;
      case 'PUTAWAY':
        return asn.putawayCompletedAt;
      case 'INVENTORY_UPDATED':
        return asn.inventoryUpdatedAt;
      case 'INFO_SYNCED':
        return asn.syncedAt;
      default:
        return undefined;
    }
  };

  if (compact) {
    return (
      <div
        aria-label="收料流转进度"
        className="mes-panel rounded-lg px-3.5 py-2.5"
      >
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="truncate font-semibold text-slate-900">
            步骤{' '}
            <span className="font-mono text-teal-700 tabular-nums">
              {activeStep.step}/{totalSteps}
            </span>{' '}
            · <span className="text-teal-800">{activeStep.label}</span>
          </div>
          <span className="hidden text-[11px] text-slate-500 sm:inline">{activeStep.desc}</span>
        </div>

        {/* Ultra-compact 7-bar visual indicator for PDA screens; expands with labels on sm+ */}
        <ol className="mt-2 grid grid-cols-7 gap-1">
          {ASN_WORKFLOW_STAGES.map((stage, idx) => {
            const isCompleted = currentStage === 'INFO_SYNCED' ? true : idx < currentIndex;
            const isCurrent = currentStage !== 'INFO_SYNCED' && idx === currentIndex;
            return (
              <li
                key={stage.key}
                aria-current={isCurrent ? 'step' : undefined}
                title={`${stage.step}. ${stage.label}`}
                className="flex flex-col gap-1"
              >
                <div
                  className={`h-1.5 w-full rounded-full ${
                    isCompleted
                      ? 'bg-emerald-600'
                      : isCurrent
                        ? 'bg-teal-700'
                        : 'bg-slate-200'
                  }`}
                />
                <span
                  className={`hidden truncate text-[10px] sm:block ${
                    isCurrent
                      ? 'font-semibold text-teal-800'
                      : isCompleted
                        ? 'font-medium text-emerald-700'
                        : 'text-slate-400'
                  }`}
                >
                  {stage.step}.{stage.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  return (
    <div
      aria-label="收料流转进度"
      className="mes-panel rounded-lg p-3.5 sm:p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="text-xs font-semibold text-slate-900">
          收料标准流程 · 当前第{' '}
          <span className="font-mono text-teal-700 tabular-nums">
            {activeStep.step}/{totalSteps}
          </span>{' '}
          步：<span className="text-teal-800">{activeStep.label}</span>
        </div>
        <div className="text-[11px] text-slate-500">{activeStep.desc}</div>
      </div>

      <ol className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {ASN_WORKFLOW_STAGES.map((stage, idx) => {
          const isCompleted =
            currentStage === 'INFO_SYNCED' ? true : idx < currentIndex;
          const isCurrent =
            currentStage !== 'INFO_SYNCED' && idx === currentIndex;
          const ts = getStageTimestamp(stage.key);

          return (
            <li
              key={stage.key}
              aria-current={isCurrent ? 'step' : undefined}
              className={`rounded-md border px-2.5 py-2 transition-colors ${
                isCurrent
                  ? 'border-teal-600 bg-teal-50/75'
                  : isCompleted
                    ? 'border-emerald-200 bg-emerald-50/40'
                    : 'border-slate-200 bg-slate-50/50'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-mono font-bold tabular-nums ${
                    isCurrent
                      ? 'bg-teal-700 text-white'
                      : isCompleted
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {isCompleted ? <Check className="h-3 w-3" /> : stage.step}
                </span>
                <span
                  className={`truncate text-xs ${
                    isCurrent
                      ? 'font-semibold text-teal-900'
                      : isCompleted
                        ? 'font-medium text-emerald-800'
                        : 'font-medium text-slate-500'
                  }`}
                >
                  {stage.label}
                </span>
              </div>
              <div className="mt-1 truncate font-mono text-[10px] text-slate-500 tabular-nums">
                {ts
                  ? formatTime(ts).slice(5)
                  : isCurrent
                    ? '进行中'
                    : isCompleted
                      ? '已完成'
                      : '待进入'}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
